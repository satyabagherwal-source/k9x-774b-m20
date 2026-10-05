# Forensic Learning Record (Deep Inspection): Fosowl/agenticSeek

> **Canonical Artifact**: `07_PROJECT_LEARNING/fosowl-agenticseek-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Fosowl/agenticSeek](https://github.com/Fosowl/agenticSeek))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:40:52.030Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Fosowl/agenticSeek`
- **Description**: Fully Local Manus AI. No APIs, No $200 monthly bills. Enjoy an autonomous agent that thinks, browses the web, and code for the sole cost of electricity.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 27431 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sources/crx_utils.py`
```
"""
CRX extraction for AgenticSeek's anti-captcha extension.

Chrome's --load-extension flag needs an *unpacked* directory, but the repo
ships a packed CRX (crx/nopecha.crx). Loading a CRX through selenium's
add_extension() never worked here because --disable-extensions was always
passed alongside it - so the captcha solver was dead code in every mode.

A CRX file is a small header (CRX2/CRX3 container with signature data)
followed by a plain zip. We locate the zip payload, validate it, and unpack
it into a cache directory that --load-extension can consume.
"""

from __future__ import annotations

import io
import os
import shutil
import zipfile

_ZIP_LOCAL_HEADER = b"PK\x03\x04"


def _zip_offsets(data: bytes):
    """All plausible zip start offsets in a CRX blob (first is usually right)."""
    offsets, start = [], 0
    while True:
        idx = data.find(_ZIP_LOCAL_HEADER, start)
        if idx == -1:
            return offsets
        offsets.append(idx)
        start = idx + 1


def default_extract_dir(crx_path: str) -> str:
    name = os.path.splitext(os.path.basename(crx_path))[0] or "extension"
    return os.path.abspath(os.path.join(os.getcwd(), ".browser_profile", "extensions", name))


def _safe_members(zf: zipfile.ZipFile):
    """Reject absolute or traversing paths (basic zip-slip guard)."""
    for name in zf.namelist():
        if name.startswith(("/", "\\")) or ".." in name.replace("\\", "/").split("/"):
            raise ValueError(f"unsafe zip member: {name}")


def extract_crx(crx_path: str, dest_dir: str | None = None, force: bool = False) -> str | None:
    """
    Unpack a packed CRX into an unpacked-extension directory.

    Returns the directory (usable with --load-extension), or None when the
    file is missing/invalid. Extraction is cached: a second call with the
    extracted manifest already present is a no-op. Concurrent callers race
    safely through a temp dir + rename.
    """
    if not crx_path or not os.path.exists(crx_path):
        return None
    dest_dir = dest_dir or default_extract_dir(crx_path)
    manifest = os.path.join(dest_dir, "manifest.json")
    if os.path.exists(manifest) and not force:
        return dest_dir

    try:
        with open(crx_path, "rb") as f:
            data = f.read()
    except OSError:
        return None

    for offset in _zip_offsets(data):
        try:
            zf = zipfile.ZipFile(io.BytesIO(data[offset:]))
            if "manifest.json" not in zf.namelist():
                continue
            _safe_members(zf)
            os.makedirs(os.path.dirname(dest_dir) or ".", exist_ok=True)
            tmp_dir = f"{dest_dir}.tmp{os.getpid()}"
            shutil.rmtree(tmp_dir, ignore_errors=True)
            zf.extractall(tmp_dir)
            if os.path.exists(manifest) and not force:
                shutil.rmtree(tmp_dir, ignore_errors=True)  # another process won
                return dest_dir
            shutil.rmtree(dest_dir, ignore_errors=True)
            os.replace(tmp_dir, dest_dir)
            return dest_dir
        except Exception:
            continue
    return None


def extension_installed(crx_path: str = "./crx/nopecha.crx") -> bool:
    """True when the CRX is already unpacked in the cache (cheap check)."""
    return os.path.exists(os.path.join(default_extract_dir(crx_path), "manifest.json"))

```

### Core Architecture Module: `sources/utility.py`
```

from colorama import Fore
from termcolor import colored
import platform
import threading
import itertools
import time

thinking_event = threading.Event()
current_animation_thread = None

def get_color_map():
    if platform.system().lower() != "windows":
        color_map = {
            "success": "green",
            "failure": "red",
            "status": "light_green",
            "code": "light_blue",
            "warning": "yellow",
            "output": "cyan",
            "info": "cyan"
        }
    else:
        color_map = {
            "success": "green",
            "failure": "red",
            "status": "light_green",
            "code": "light_blue",
            "warning": "yellow",
            "output": "cyan",
            "info": "black"
        }
    return color_map

def pretty_print(text, color="info", no_newline=False):
    """
    Print text with color formatting.

    Args:
        text (str): The text to print
        color (str, optional): The color to use. Defaults to "info".
            Valid colors are:
            - "success": Green
            - "failure": Red 
            - "status": Light green
            - "code": Light blue
            - "warning": Yellow
            - "output": Cyan
            - "default": Black (Windows only)
    """
    thinking_event.set()
    if current_animation_thread and current_animation_thread.is_alive():
        current_animation_thread.join()
    thinking_event.clear()
    
    color_map = get_color_map()
    if color not in color_map:
        color = "info"
    print(colored(text, color_map[color]), end='' if no_newline else "\n")

def animate_thinking(text, color="status", duration=120):
    """
    Animate a thinking spinner while a task is being executed.
    It use a daemon thread to run the animation. This will not block the main thread.
    Color are the same as pretty_print.
    """
    global current_animation_thread
    
    thinking_event.set()
    if current_animation_thread and current_animation_thread.is_alive():
        current_animation_thread.join()
    thinking_event.clear()
    
    def _animate():
        color_map = {
            "success": (Fore.GREEN, "green"),
            "failure": (Fore.RED, "red"),
            "status": (Fore.LIGHTGREEN_EX, "light_green"),
            "code": (Fore.LIGHTBLUE_EX, "light_blue"),
            "warning": (Fore.YELLOW, "yellow"),
            "output": (Fore.LIGHTCYAN_EX, "cyan"),
            "default": (Fore.RESET, "black"),
            "info": (Fore.CYAN, "cyan")
        }
        fore_color, term_color = color_map.get(color, color_map["default"])
        spinner = itertools.cycle([
            '▉▁▁▁▁▁', '▉▉▂▁▁▁', '▉▉▉▃▁▁', '▉▉▉▉▅▁', '▉▉▉▉▉▇', '▉▉▉▉▉▉',
            '▉▉▉▉▇▅', '▉▉▉▆▃▁', '▉▉▅▃▁▁', '▉▇▃▁▁▁', '▇▃▁▁▁▁', '▃▁▁▁▁▁',
            '▁▃▅▃▁▁', '▁▅▉▅▁▁', '▃▉▉▉▃▁', '▅▉▁▉▅▃', '▇▃▁▃▇▅', '▉▁▁▁▉▇',
            '▉▅▃▁▃▅', '▇▉▅▃▅▇', '▅▉▇▅▇▉', '▃▇▉▇▉▅', '▁▅▇▉▇▃', '▁▃▅▇▅▁' 
        ])
        end_time = time.time() + duration

        while not thinking_event.is_set() and time.time() < end_time:
            symbol = next(spinner)
            if platform.system().lower() != "windows":
                print(f"\r{fore_color}{symbol} {text}{Fore.RESET}", end="", flush=True)
            else:
                print(f"\r{colored(f'{symbol} {text}', term_color)}", end="", flush=True)
            time.sleep(0.2)
        print("\r" + " " * (len(text) + 7) + "\r", end="", flush=True)
    current_animation_thread = threading.Thread(target=_animate, daemon=True)
    current_animation_thread.start()

def timer_decorator(func):
    """
    Decorator to measure the execution time of a function.
    Usage:
    @timer_decorator
    def my_function():
        # code to execute
    """
    from time import time
    def wrapper(*args, **kwargs):
        start_time = time()
        result = func(*args, **kwargs)
        end_time = time()
        pretty_print(f"{func.__name__} took {end_time - start_time:.2f} seconds to execute", "status")
        return result
    return wrapper

if __name__ == "__main__":
    import time
    pretty_print("starting imaginary task", "success")
    animate_thinking("Thinking...", "status")
    time.sleep(4)
    pretty_print("starting another task", "failure")
    animate_thinking("Thinking...", "status")
    time.sleep(4)
    pretty_print("yet another task", "info")
    animate_thinking("Thinking...", "status")
    time.sleep(4)
    pretty_print("This is an info message", "info")
```

### Core Architecture Module: `api.py`
```
#!/usr/bin/env python3

import os, sys
import uvicorn
import aiofiles
import configparser
import asyncio
import time
from typing import List
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid

from sources.api_auth import require_api_token
from sources.llm_provider import Provider
from sources.interaction import Interaction
from sources.agents import CasualAgent, CoderAgent, FileAgent, PlannerAgent, BrowserAgent
from sources.browser import Browser, create_driver
from sources.utility import pretty_print
from sources.logger import Logger
from sources.schemas import QueryRequest, QueryResponse
from sources.workspace import runtime_subdir

from dotenv import load_dotenv

load_dotenv()


def is_running_in_docker():
    """Detect if code is running inside a Docker container."""
    # Method 1: Check for .dockerenv file
    if os.path.exists('/.dockerenv'):
        return True

    # Method 2: Check cgroup
    try:
        with open('/proc/1/cgroup', 'r') as f:
            return 'docker' in f.read()
    except:
        pass

    return False


from celery import Celery

api = FastAPI(title="AgenticSeek API", version="0.1.0")
_redis_url = os.environ.get("REDIS_URL", os.environ.get("REDIS_BASE_URL", "redis://localhost:6379/0"))
celery_app = Celery("tasks", broker=_redis_url, backend=_redis_url)
celery_app.conf.update(task_track_started=True)
logger = Logger("backend.log")
config = configparser.ConfigParser()
config.read('config.ini')

allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

api.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCREENSHOTS_DIR = runtime_subdir("screenshots")
api.mount("/screenshots", StaticFiles(directory=SCREENSHOTS_DIR), name="screenshots")

def initialize_system():
    stealth_mode = config.getboolean('BROWSER', 'stealth_mode')
    personality_folder = "jarvis" if config.getboolean('MAIN', 'jarvis_personality') else "base"
    languages = config["MAIN"]["languages"].split(' ')

    headless = config.getboolean('BROWSER', 'headless_browser')
    if is_running_in_docker():
        # The container starts Xvfb (DISPLAY=:99), so run Chrome headed there:
        # headless mode leaks tells (permission states, voices, software-only
        # rendering) that a real window under Xvfb does not. Force headless
        # explicitly with AGENTICSEEK_HEADLESS=1 if Xvfb is unavailable.
        headless = os.getenv("AGENTICSEEK_HEADLESS", "0") == "1"
        if headless:
            logger.info("Docker: running browser headless (AGENTICSEEK_HEADLESS=1)")
        else:
            logger.info("Docker: running browser headed under Xvfb")

    provider = Provider(
        provider_name=config["MAIN"]["provider_name"],
        model=config["MAIN"]["provider_model"],
        server_address=config["MAIN"]["provider_server_address"],
        is_local=config.getboolean('MAIN', 'is_local')
    )
    logger.info(f"Provider initialized: {provider.provider_name} ({provider.model})")

    browser = Browser(
        create_driver(headless=headless, stealth_mode=stealth_mode, lang=languages[0]),
        anticaptcha_manual_install=stealth_mode
    )
    logger.info("Browser initialized")

    agents = [
        CasualAgent(
            name=config["MAIN"]["agent_name"],
            prompt_path=f"prompts/{personality_folder}/casual_agent.txt",
            provider=provider, verbose=False
        ),
        CoderAgent(
            name="coder",
            prompt_path=f"prompts/{personality_folder}/coder_agent.txt",
            provider=provider, verbose=False
        ),
        FileAgent(
            name="File Agent",
            prompt_path=f"prompts/{personality_folder}/file_agent.txt",
            provider=provider, verbose=False
        ),
        BrowserAgent(
            name="Browser",
            prompt_path=f"prompts/{personality_folder}/browser_agent.txt",
            provider=provider, verbose=False, browser=browser
        ),
        PlannerAgent(
            name="Planner",
            prompt_path=f"prompts/{personality_folder}/planner_agent.txt",
            provider=provider, verbose=False, browser=browser
        )
    ]
    logger.info("Agents initialized")

    interaction = Interaction(
        agents,
        tts_enabled=config.getboolean('MAIN', 'speak'),
        stt_enabled=config.getboolean('MAIN', 'listen'),
        recover_last_session=config.getboolean('MAIN', 'recover_last_session'),
        langs=languages
    )
    logger.info("Interaction initialized")
    return interaction

interaction = initialize_system()
is_generating = False
query_resp_history = []

@api.get("/screenshot")
async def get_screenshot():
    logger.info("Screenshot endpoint called")
    screenshot_path = os.path.join(SCREENSHOTS_DIR, "updated_screen.png")
    if os.path.exists(screenshot_path):
        return FileResponse(screenshot_path)
    logger.error("No screenshot available")
    return JSONResponse(
        status_code=404,
        content={"error": "No screenshot available"}
    )

@api.get("/health")
async def health_check():
    logger.info("Health check endpoint called")
    return {"status": "healthy", "version": "0.1.0"}

@api.get("/is_active")
async def is_active():
    logger.info("Is active endpoint called")
    return {"is_active": interaction.is_active}

@api.get("/stop")
async def stop():
    logger.info("Stop endpoint called")
    interaction.current_agent.request_stop()
    return JSONResponse(status_code=200, content={"status": "stopped"})

@api.get("/latest_answer")
async def get_latest_answer():
    global query_resp_history
    if interaction.current_agent is None:
        return JSONResponse(status_code=404, content={"error": "No agent available"})
    uid = str(uuid.uuid4())
    if not any(q["answer"] == interaction.current_agent.last_answer for q in query_resp_history):
        query_resp = {
            "done": "false",
            "answer": interaction.current_agent.last_answer,
            "reasoning": interaction.current_agent.last_reasoning,
            "agent_name": interaction.current_agent.agent_name if interaction.current_agent else "None",
            "success": interaction.current_agent.success,
            "blocks": {f'{i}': block.jsonify() for i, block in enumerate(interaction.get_last_blocks_result())} if interaction.current_agent else {},
            "status": interaction.current_agent.get_status_message if interaction.current_agent else "No status available",
            "uid": uid
        }
        interaction.current_agent.last_answer = ""
        interaction.current_agent.last_reasoning = ""
        query_resp_history.append(query_resp)
        return JSONResponse(status_code=200, content=query_resp)
    if query_resp_history:
        return JSONResponse(status_code=200, content=query_resp_history[-1])
    return JSONResponse(status_code=404, content={"error": "No answer available"})

async def think_wrapper(interaction, query):
    try:
        interaction.last_query = query
        logger.info("Agents request is being processed")
        success = await interaction.think()
        if not success:
            interaction.last_answer = "Error: No answer from agent"
            interaction.last_reasoning = "Error: No reasoning from agent"
            interaction.last_success = False
        else:
            interaction.last_success = True
        pretty_print(interaction.last_answer)
        interaction.speak_answer()
        return success
    except Exception as e:
        logger.error(f"Error in think_wrapper: {str(e)}")
        pretty_print(f"An error occurred: {str(e)}", color="error")
        interaction.last_answer = f""
        interaction.last_reasoning = f"Error: {str(e)}"
        interaction.last_success = False
        raise e

@api.post(
    "/query",
    response_model=QueryResponse,
    dependencies=[Depends(require_api_token)],
)
async def process_query(request: QueryRequest):
    global is_generating, query_resp_history
    logger.info(f"Processing query: {request.query}")
    query_resp = QueryResponse(
        done="false",
        answer="",
        reasoning="",
        agent_name="Unknown",
        success="false",
        blocks={},
        status="Ready",
        uid=str(uuid.uuid4())
    )
    if is_generating:
        logger.warning("Another query is being processed, please wait.")
        return JSONResponse(status_code=429, content=query_resp.jsonify())

    try:
        is_generating = True
        success = await think_wrapper(interaction, request.query)
        is_generating = False

        if not success:
            query_resp.answer = interaction.last_answer
            query_resp.reasoning = interaction.last_reasoning
            return JSONResponse(status_code=400, content=query_resp.jsonify())

        if interaction.current_agent:
            blocks_json = {f'{i}': block.jsonify() for i, block in enumerate(interaction.current_agent.get_blocks_result())}
        else:
            logger.error("No current agent found")
            blocks_json = {}
            query_resp.answer = "Error: No current agent"
            return JSONResponse(status_code=400, content=query_resp.jsonify())

        logger.info(f"Answer: {interaction.last_answer}")
        logger.info(f"Blocks: {blocks_json}")
        query_resp.done = "true"
        query_resp.answer = interaction.last_answer
        query_resp.reasoning = interaction.last_reasoning
        query_resp.agent_name = interaction.current_agent.agent_name
        query_resp.success = str(interaction.last_success)
        query_resp.blocks = blocks_json

        query_resp_dict = {
            "done": query_resp.done,
            "
```

### Core Architecture Module: `cli.py`
```
#!/usr/bin python3

import sys
import argparse
import configparser
import asyncio

from sources.llm_provider import Provider
from sources.interaction import Interaction
from sources.agents import Agent, CoderAgent, CasualAgent, FileAgent, PlannerAgent, BrowserAgent, McpAgent
from sources.browser import Browser, create_driver
from sources.utility import pretty_print

import warnings
warnings.filterwarnings("ignore")

config = configparser.ConfigParser()
config.read('config.ini')

async def main():
    pretty_print("Initializing...", color="status")
    stealth_mode = config.getboolean('BROWSER', 'stealth_mode')
    personality_folder = "jarvis" if config.getboolean('MAIN', 'jarvis_personality') else "base"
    languages = config["MAIN"]["languages"].split(' ')

    provider = Provider(provider_name=config["MAIN"]["provider_name"],
                        model=config["MAIN"]["provider_model"],
                        server_address=config["MAIN"]["provider_server_address"],
                        is_local=config.getboolean('MAIN', 'is_local'))

    browser = Browser(
        create_driver(headless=config.getboolean('BROWSER', 'headless_browser'), stealth_mode=stealth_mode, lang=languages[0]),
        anticaptcha_manual_install=stealth_mode
    )

    agents = [
        CasualAgent(name=config["MAIN"]["agent_name"],
                    prompt_path=f"prompts/{personality_folder}/casual_agent.txt",
                    provider=provider, verbose=False),
        CoderAgent(name="coder",
                   prompt_path=f"prompts/{personality_folder}/coder_agent.txt",
                   provider=provider, verbose=False),
        FileAgent(name="File Agent",
                  prompt_path=f"prompts/{personality_folder}/file_agent.txt",
                  provider=provider, verbose=False),
        BrowserAgent(name="Browser",
                     prompt_path=f"prompts/{personality_folder}/browser_agent.txt",
                     provider=provider, verbose=False, browser=browser),
        PlannerAgent(name="Planner",
                     prompt_path=f"prompts/{personality_folder}/planner_agent.txt",
                     provider=provider, verbose=False, browser=browser),
        #McpAgent(name="MCP Agent",
        #            prompt_path=f"prompts/{personality_folder}/mcp_agent.txt",
        #            provider=provider, verbose=False), # NOTE under development
    ]

    interaction = Interaction(agents,
                              tts_enabled=config.getboolean('MAIN', 'speak'),
                              stt_enabled=config.getboolean('MAIN', 'listen'),
                              recover_last_session=config.getboolean('MAIN', 'recover_last_session'),
                              langs=languages
                            )
    try:
        while interaction.is_active:
            interaction.get_user()
            if await interaction.think():
                interaction.show_answer()
                interaction.speak_answer()
    except Exception as e:
        if config.getboolean('MAIN', 'save_session'):
            interaction.save_session()
        raise e
    finally:
        if config.getboolean('MAIN', 'save_session'):
            interaction.save_session()

if __name__ == "__main__":
    asyncio.run(main())
```

### Core Architecture Module: `frontend/agentic-seek-front/src/App.js`
```
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import "./App.css";
import { ThemeToggle } from "./components/ThemeToggle";
import { ResizableLayout } from "./components/ResizableLayout";
import faviconPng from "./logo.png";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
console.log("Using backend URL:", BACKEND_URL);

function App() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState("blocks");
  const [responseData, setResponseData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState("Agents ready");
  const [expandedReasoning, setExpandedReasoning] = useState(new Set());
  const messagesEndRef = useRef(null);

  const fetchLatestAnswer = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/latest_answer`);
      const data = res.data;

      updateData(data);
      if (!data.answer || data.answer.trim() === "") {
        return;
      }
      const normalizedNewAnswer = normalizeAnswer(data.answer);
      const answerExists = messages.some(
        (msg) => normalizeAnswer(msg.content) === normalizedNewAnswer
      );
      if (!answerExists) {
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: data.answer,
            reasoning: data.reasoning,
            agentName: data.agent_name,
            status: data.status,
            uid: data.uid,
          },
        ]);
        setStatus(data.status);
        scrollToBottom();
      } else {
        console.log("Duplicate answer detected, skipping:", data.answer);
      }
    } catch (error) {
      console.error("Error fetching latest answer:", error);
    }
  }, [messages]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkHealth();
      fetchLatestAnswer();
      fetchScreenshot();
    }, 3000);
    return () => clearInterval(intervalId);
  }, [fetchLatestAnswer]);

  const checkHealth = async () => {
    try {
      await axios.get(`${BACKEND_URL}/health`);
      setIsOnline(true);
      console.log("System is online");
    } catch {
      setIsOnline(false);
      console.log("System is offline");
    }
  };

  const fetchScreenshot = async () => {
    try {
      const timestamp = new Date().getTime();
      const res = await axios.get(
        `${BACKEND_URL}/screenshots/updated_screen.png?timestamp=${timestamp}`,
        {
          responseType: "blob",
        }
      );
      console.log("Screenshot fetched successfully");
      const imageUrl = URL.createObjectURL(res.data);
      setResponseData((prev) => {
        if (prev?.screenshot && prev.screenshot !== "placeholder.png") {
          URL.revokeObjectURL(prev.screenshot);
        }
        return {
          ...prev,
          screenshot: imageUrl,
          screenshotTimestamp: new Date().getTime(),
        };
      });
    } catch (err) {
      console.error("Error fetching screenshot:", err);
      setResponseData((prev) => ({
        ...prev,
        screenshot: "placeholder.png",
        screenshotTimestamp: new Date().getTime(),
      }));
    }
  };

  const normalizeAnswer = (answer) => {
    return answer
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.,!?]/g, "");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleReasoning = (messageIndex) => {
    setExpandedReasoning((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex);
      } else {
        newSet.add(messageIndex);
      }
      return newSet;
    });
  };

  const updateData = (data) => {
    setResponseData((prev) => ({
      ...prev,
      blocks: data.blocks || prev.blocks || null,
      done: data.done,
      answer: data.answer,
      agent_name: data.agent_name,
      status: data.status,
      uid: data.uid,
    }));
  };

  const handleStop = async (e) => {
    e.preventDefault();
    checkHealth();
    setIsLoading(false);
    setError(null);
    try {
      await axios.get(`${BACKEND_URL}/stop`);
      setStatus("Requesting stop...");
    } catch (err) {
      console.error("Error stopping the agent:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    checkHealth();
    if (!query.trim()) {
      console.log("Empty query");
      return;
    }
    setMessages((prev) => [...prev, { type: "user", content: query }]);
    setIsLoading(true);
    setError(null);

    try {
      console.log("Sending query:", query);
      setQuery("waiting for response...");
      const res = await axios.post(`${BACKEND_URL}/query`, {
        query,
        tts_enabled: false,
      });
      setQuery("Enter your query...");
      console.log("Response:", res.data);
      const data = res.data;
      updateData(data);
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to process query.");
      setMessages((prev) => [
        ...prev,
        { type: "error", content: "Error: Unable to get a response." },
      ]);
    } finally {
      console.log("Query completed");
      setIsLoading(false);
      setQuery("");
    }
  };

  const handleGetScreenshot = async () => {
    try {
      setCurrentView("screenshot");
    } catch (err) {
      setError("Browser not in use");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="logo-container">
            <img src={faviconPng} alt="AgenticSeek" className="logo-icon" />
          </div>
          <div className="brand-text">
            <h1>AgenticSeek</h1>
          </div>
        </div>
        <div className="header-status">
          <div
            className={`status-indicator ${isOnline ? "online" : "offline"}`}
          >
            <div className="status-dot"></div>
            <span className="status-text">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <a
            href="https://github.com/Fosowl/agenticSeek"
            target="_blank"
            rel="noopener noreferrer"
            className="action-button github-link"
            aria-label="View on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="action-text">GitHub</span>
          </a>
          <div>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="main">
        <ResizableLayout initialLeftWidth={50}>
          <div className="chat-section">
            <h2>Chat Interface</h2>
            <div className="messages">
              {messages.length === 0 ? (
                <p className="placeholder">
                  No messages yet. Type below to start!
                </p>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${
                      msg.type === "user"
                        ? "user-message"
                        : msg.type === "agent"
                        ? "agent-message"
                        : "error-message"
                    }`}
                  >
                    <div className="message-header">
                      {msg.type === "agent" && (
                        <span className="agent-name">{msg.agentName}</span>
                      )}
                      {msg.type === "agent" &&
                        msg.reasoning &&
                        expandedReasoning.has(index) && (
                          <div className="reasoning-content">
                            <ReactMarkdown>{msg.reasoning}</ReactMarkdown>
                          </div>
                        )}
                      {msg.type === "agent" && (
                        <button
                          className="reasoning-toggle"
                          onClick={() => toggleReasoning(index)}
                          title={
                            expandedReasoning.has(index)
                              ? "Hide reasoning"
                              : "Show reasoning"
                          }
                        >
                          {expandedReasoning.has(index) ? "▼" : "▶"} Reasoning
                        </button>
                      )}
                    </div>
                    <div className="message-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            {isOnline && <div className="loading-animation">{status}</div>}
            {!isLoading && !isOnline && (
              <p className="loading-animation">
     
```

### Core Architecture Module: `frontend/agentic-seek-front/src/colors.js`
```
export const colors = {
  // Primary colors - matching the dashboard theme
  primary: "#2563eb",
  primaryLight: "#dbeafe",
  primaryDark: "#1d4ed8",

  // Secondary colors - modern grays
  secondary: "#64748b",
  secondaryLight: "#f1f5f9",
  secondaryDark: "#1e293b",

  // Accent colors
  accent: "#f59e0b",
  accentLight: "#fef3c7",
  accentDark: "#d97706",

  // Status colors
  success: "#10b981",
  successLight: "#d1fae5",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  error: "#ef4444",
  errorLight: "#fee2e2",
  info: "#06b6d4",
  infoLight: "#cffafe",

  // Neutral colors - modern palette
  white: "#ffffff",
  gray50: "#f8fafc",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1e293b",
  gray900: "#0f172a",
  black: "#000000",

  // Text colors
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textDisabled: "#94a3b8",

  // Background colors
  background: "#f8fafc",
  card: "#ffffff",

  // Border colors
  border: "#e2e8f0",
  divider: "#f1f5f9",

  // Transparent colors
  transparent: "transparent",
  semiTransparent: "rgba(15, 23, 42, 0.6)",

  // Dark theme colors
  darkBackground: "#0f172a",
  darkCard: "#1e293b",
  darkBorder: "#334155",
  darkText: "#f8fafc",
  darkTextSecondary: "#cbd5e1",
};

```

### Core Architecture Module: `frontend/agentic-seek-front/src/components/ResizableLayout.js`
```
import React, { useState, useRef, useCallback } from "react";
import "./ResizableLayout.css";

export const ResizableLayout = ({ children, initialLeftWidth = 50 }) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 20% and 80%
      const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
      setLeftWidth(constrainedWidth);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`resizable-container ${isDragging ? "dragging" : ""}`}
    >
      <div className="resizable-left" style={{ width: `${leftWidth}%` }}>
        {children[0]}
      </div>
      <div className="resize-handle" onMouseDown={handleMouseDown}>
        <div className="resize-handle-line" />
      </div>
      <div className="resizable-right" style={{ width: `${100 - leftWidth}%` }}>
        {children[1]}
      </div>
    </div>
  );
};

```

### Core Architecture Module: `frontend/agentic-seek-front/src/components/ThemeToggle.js`
```
import React from "react";
import { useTheme } from "../contexts/ThemeContext";

export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
};

```

### Core Architecture Module: `frontend/agentic-seek-front/src/contexts/ThemeContext.js`
```
import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true; // Default to dark
  });

  useEffect(() => {
    localStorage.setItem("theme", isDark ? "dark" : "light");
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light"
    );
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

```

### Core Architecture Module: `frontend/agentic-seek-front/src/index.js`
```
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles/globals.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

```

### Core Architecture Module: `frontend/agentic-seek-front/src/reportWebVitals.js`
```
const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;

```

### Core Architecture Module: `llm_server/app.py`
```
#!/usr/bin python3

import argparse
import time
from flask import Flask, jsonify, request

from sources.llamacpp_handler import LlamacppLLM
from sources.ollama_handler import OllamaLLM

parser = argparse.ArgumentParser(description='AgenticSeek server script')
parser.add_argument('--provider', type=str, help='LLM backend library to use. set to [ollama], [vllm] or [llamacpp]', required=True)
parser.add_argument('--port', type=int, help='port to use', required=True)
args = parser.parse_args()

app = Flask(__name__)

assert args.provider in ["ollama", "llamacpp"], f"Provider {args.provider} does not exists. see --help for more information"

handler_map = {
    "ollama": OllamaLLM(),
    "llamacpp": LlamacppLLM(),
}

generator = handler_map[args.provider]

@app.route('/generate', methods=['POST'])
def start_generation():
    if generator is None:
        return jsonify({"error": "Generator not initialized"}), 401
    data = request.get_json()
    history = data.get('messages', [])
    if generator.start(history):
        return jsonify({"message": "Generation started"}), 202
    return jsonify({"error": "Generation already in progress"}), 402

@app.route('/setup', methods=['POST'])
def setup():
    data = request.get_json()
    model = data.get('model', None)
    if model is None:
        return jsonify({"error": "Model not provided"}), 403
    generator.set_model(model)
    return jsonify({"message": "Model set"}), 200

@app.route('/get_updated_sentence')
def get_updated_sentence():
    if not generator:
        return jsonify({"error": "Generator not initialized"}), 405
    print(generator.get_status())
    return generator.get_status()

if __name__ == '__main__':
    app.run(host='0.0.0.0', threaded=True, debug=True, port=args.port)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #204** (2025-05-29): **Module not found: Error: Can't resolve '/app/src/index.js' in '/app'**
  *Symptoms*: **Describe the bug** once naviage to http://0.0.0.0:3000 gives error :  Compiled with problems: × ERROR Module not found: Error: Can't resolve '/app/src/index.js' in '/app'   **To Reproduce** Steps to reproduce the behavior: Install package Run the api.py script  **Expected behavior** Should see web ui  **Screenshots**  ![Image](https://github.com/user-attachments/assets/554868ba-ebbb-4301-9dc5-c9db5641ebcd)  **Desktop (please complete the following information):**  - OS:Fedora 42    **Additional context** Running on python 3.12 , had to remove version numbers from requirements.txt to run 
  **Post-Mortem & Fix Analysis**:
  > that's really weird, are you running the frontend in docker after starting start_services.sh ? are there any error in docker compose log ?
  > Its weird I kept having issues running the script, but looking at it it seems just to call docker compose, so I did that, and the containers came up no issue. witch was odd in itself. Here is the original error for the script:  searxng   | SearXNG 2025.5.25+7a5a499 searxng   | ... "/etc/searxng/uwsgi.ini" does not exist, creating from template...              searxng   | SearXNG 2025.5.25+7a5a499                                                           searxng   | chown: /etc/searxng: Permission denied                     This last bit here was happening over and over again, to the point that I decided to take that other route. Anyways. I can see I'm not following the instructions exactly, but this was the closest thing to it that I could get.  
  > searxng is not required for the frontend. can you update the repository (clone again), delete the frontend container in docker and build again (./start_services.sh)

- **Issue #133** (2025-05-20): **Installation Error**
  *Symptoms*: Subject: Troubleshooting Report: Agentic Seek Connection Failure on Windows with Local LLM Providers  Goal: Install and run the Agentic Seek application (python cli.py) on Windows, configured to use a local LLM provider (initially LM Studio, later switched to Ollama).  System Configuration:  Operating System: Windows (detected as not Windows 11 by script ver | findstr /i "11.0.") Python Version: 3.10.11 (Installed manually from python.org, added to PATH) Initial Target Provider: LM Studio v0.2.14 with model lmstudio-community/DeepSeek-r1-distill-llama-8b-GGUF on http://127.0.0.1:1234 Current Target Provider: Ollama with model deepseek-coder:latest (or similar) on http://127.0.0.1:11434 Problem Encountered: After completing installation steps, running python cli.py (or python api.py) consistently fails with a Python traceback ending in: Exception: Server at http://127.0.0.1:[PORT] is offline. This error occurred for both LM Studio (port 1234) and Ollama (port 11434) configurations.  Troubleshooting Steps Performed:  Initial Installer Script Issues: The provided .bat installer script (installer.txt) consistently failed early with syntax errors (". was unexpected...", "usually was unexpected...") likely due to file encoding/corruption issues (initially saved as UTF-8, later attempts with ANSI also failed at similar points). A minimal test script worked, but adding subsequent sections caused the early failure again. Switched to manual installation.    Manual Installation: Confirm
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. I’ve addressed the IP offline problem in the latest pull request. Currently, I don’t have access to a Windows machine but I’ll work on resolving the Windows installation errors later today.
  > Hello, really sorry I couldn't have access to a windows computer for the whole week. I have a friend who will look into it.
  > > Hello, really sorry I couldn't have access to a windows computer for the whole week. I have a friend who will look into it.  probably same issue on linux, or im cooked. So, keep in touch 

- **Issue #111** (2025-09-14): **Investigate random BUS error on exit**
  *Symptoms*: **Describe the bug** Bus error randomly happening.  **To Reproduce** Either: 1. use it a bit then exit, may randomly cause bus error. 2. Ask it to code a gui app, close the gui app, result in bus error sometimes. 3. Can also happen when browsing the web  **Expected behavior** No bus error  **System information:**  - OS: Darwin Martins-MacBook-Air.local 23.2.0 Darwin Kernel Version 23.2.0; root:xnu-10002.61.3~2/RELEASE_ARM64_T8103 arm64 

- **Issue #82** (2025-03-29): **Fix display problem**
  *Symptoms*: Fix display overlapping / cut output problem and duplicate message.

- **Issue #60** (2025-03-20): **Agent router does not support multilingual prompt**
  *Symptoms*: The router one-shot classification only work in english, other language will result in a random agent being selected for the task  Example: When asking "search the web for what agenticSeek is" in chinese it select the coder agent  你能在网上搜索一下吗告诉我agenticseek是什么  Selected agent: coder (roles: coding and programming) 

- **Issue #57** (2025-03-19): **Chinese input does not work | 无法输入中文**
  *Symptoms*: Typing chinese text does not work, it simply ignore it and goes back to the shell prompt >>>  输入中文文本不起作用，它只是忽略它并返回到 shell 提示符 >>>
  **Post-Mortem & Fix Analysis**:
  > fixed on dev, merge soon

- **Issue #55** (2025-03-19): **self.driver = webdriver.Chrome(service=service, options=chrome_options) [ERROR]**
  *Symptoms*: **Describe the bug** After running 'python main.py' the following error occurs.  ``` Traceback (most recent call last):   File "C:\Users\%USERNAME%\agenticSeek\sources\browser.py", line 44, in __init__     self.driver = webdriver.Chrome(service=service, options=chrome_options)                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\Users\%USERNAME%\agenticSeek\agentic_seek_env\Lib\site-packages\selenium\webdriver\chrome\webdriver.py", line 45, in __init__     super().__init__(   File "C:\Users\%USERNAME%\agenticSeek\agentic_seek_env\Lib\site-packages\selenium\webdriver\chromium\webdriver.py", line 66, in __init__     super().__init__(command_executor=executor, options=options)   File "C:\Users\%USERNAME%\agenticSeek\agentic_seek_env\Lib\site-packages\selenium\webdriver\remote\webdriver.py", line 250, in __init__     self.start_session(capabilities)   File "C:\Users\%USERNAME%\agenticSeek\agentic_seek_env\Lib\site-packages\selenium\webdriver\remote\webdriver.py", line 342, in start_session     response = self.execute(Command.NEW_SESSION, caps)["value"]                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\Users\%USERNAME%\agenticSeek\agentic_seek_env\Lib\site-packages\selenium\webdriver\remote\webdriver.py", line 429, in execute     self.error_handler.check_response(response)   File "C:\Users\%USERNAME%\agenticSeek\agentic_seek_env\Lib\site-packages\selenium\webdriver\remote\errorhandler.py", line 232, in check_response     raise exce
  **Post-Mortem & Fix Analysis**:
  > this seem like a version mismatch between your browser and chromedriver. could you update the latest chromedriver:  because you are using a very recent chrome version you need to check out : https://googlechromelabs.github.io/chrome-for-testing/  and download : https://storage.googleapis.com/chrome-for-testing-public/134.0.6998.88/win64/chromedriver-win64.zip  tell me if this solve your issue
  > I have made chages to autoinstall chromedriver and version update.
  > please @kairushinjuu confirm this work so i can close the issue

- **Issue #29** (2025-03-15): **Error after selecting agent for prompt**
  *Symptoms*: I am sure you guys know me by now lol, so I'll cut to the chase, after inputting the prompt, this new error shows up:  ![Image](https://github.com/user-attachments/assets/06c1d088-b837-4864-82ec-7e98ec67b60a)  Thank you guys once again for the hard work!
  **Post-Mortem & Fix Analysis**:
  > hey really weird i can't reproduce, but the server does not return json? can you pull again for the latest server_ollama.py and if persist show me the result of these print :            print(response)            print(response.json())             thought = response.json()["sentence"]
  > Hey, my bad, I forgot to change the provider back to ollama from server, everything works now. Thank you!

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

### Incident Patch 1: `58ef948d` (2026-09-21)
**Commit Message**: fix : searxng issues; conf: update config.ini default values

**File**: `config.ini` (modified, +6/-6)
```diff
@@ -2,15 +2,15 @@
 is_local = True
 provider_name = openai
 provider_model = unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL 
-provider_server_address = 127.0.0.1:11434
+provider_server_address = 127.0.0.1:8123
 agent_name = Jarvis
-recover_last_session = False
-save_session = False
+recover_last_session = True
+save_session = True
 speak = False
 listen = False
-jarvis_personality = False
+jarvis_personality = True
 languages = en
-safe_mode = False
+safe_mode = True
 [BROWSER]
 headless_browser = True
-stealth_mode = False
+stealth_mode = True
```

**File**: `searxng/settings.yml` (modified, +38/-2606)
```diff
@@ -1,2617 +1,49 @@
+# AgenticSeek SearXNG settings.
+#
+# This file is INTENTIONALLY MINIMAL.
+#
+# It used to be a full copy of SearXNG's default settings.yml. Every time the
+# searxng/searxng:latest image was updated, engines that upstream had removed
+# or renamed failed to load from the stale copy at startup
+# (FileNotFoundError, e.g. "reddit", "presearch", "adobe_stock", "loc"), and
+# searches could come back empty.
+#
+# `use_default_settings` tells SearXNG to merge this file over the settings
+# bundled with the running image, so engine definitions always match the image
+# version. Only the overrides AgenticSeek needs live here.
+#
+# Docs: https://docs.searxng.org/admin/settings/settings.html#use-default-settings
+
+use_default_settings:
+  engines:
+    # Onion/Tor engines: AgenticSeek runs no Tor daemon, so SearXNG marks them
+    # inactive at startup and logs "can't register engine" errors for them.
+    # Removing them keeps the logs clean; "general" searches are unaffected.
+    remove:
+      - ahmia
+      - torch
+
 general:
-  # Debug mode, only for development. Is overwritten by ${SEARXNG_DEBUG}
-  debug: false
-  # displayed name
-  instance_name: "SearXNG"
-  # For example: https://example.com/privacy
-  privacypolicy_url: false
-  # use true to use your own donation page written in searx/info/en/donate.md
-  # use false to disable the donation link
+  instance_name: "AgenticSeek SearXNG"
   donation_url: false
-  # mailto:contact@example.com
-  contact_url: false
-  # record stats
-  enable_metrics: true
-  # expose stats in open metrics format at /metrics
-  # leave empty to disable (no password set)
-  # open_metrics: <password>
-  open_metrics: ''
-
-brand:
-  new_issue_url: https://github.com/searxng/searxng/issues/new
-  docs_url: https://docs.searxng.org/
-  public_instances: https://searx.space
-  wiki_url: https://github.com/searxng/searxng/wiki
-  issue_url: https://github.com/searxng/searxng/issues
-  # custom:
-  #   maintainer: "Jon Doe"
-  #   # Custom entries in the footer: [title]: [link]
-  #   links:
-  #     Uptime: https://uptime.searxng.org/history/darmarit-org
-  #     About: "https://searxng.org"
 
 search:
-  # Filter results. 0: None, 1: Moderate, 2: Strict
-  safe_search: 0
-  # Existing autocomplete backends: "360search", "baidu", "brave", "dbpedia", "duckduckgo", "google", "yandex",
-  # "mwmbl", "seznam", "sogou", "stract", "swisscows", "qwant", "wikipedia" -
-  # leave blank to turn it off by default.
-  autocomplete: ""
-  # minimun characters to type before autocompleter starts
-  autocomplete_min: 4
-  # backend for the favicon near URL in search results.
-  # Available resolvers: "allesedv", "duckduckgo", "google", "yandex" - leave blank to turn it off by default.
-  favicon_resolver: ""
-  # Default search language - leave blank to detect from browser information or
-  # use codes from 'languages.py'
-  default_lang: "auto"
-  # max_page: 0  # if engine supports paging, 0 means unlimited numbers of pages
-  # Available languages
-  # languages:
-  #   - all
-  #   - en
-  #   - en-US
-  #   - de
-  #   - it-IT
-  #   - fr
-  #   - fr-BE
-  # ban time in seconds after engine errors
-  ban_time_on_fail: 5
-  # max ban time in seconds after engine errors
-  max_ban_time_on_fail: 120
-  suspended_times:
-    # Engine suspension time after error (in seconds; set to 0 to disable)
-    # For error "Access denied" and "HTTP error [402, 403]"
-    SearxEngineAccessDenied: 86400
-    # For error "CAPTCHA"
-    SearxEngineCaptcha: 86400
-    # For error "Too many request" and "HTTP error 429"
-    SearxEngineTooManyRequests: 3600
-    # Cloudflare CAPTCHA
-    cf_SearxEngineCaptcha: 1296000
-    cf_SearxEngineAccessDenied: 86400
-    # ReCAPTCHA
-    recaptcha_SearxEngineCaptcha: 604800
-
-  # remove format to deny access, use lower case.
-  # formats: [html, csv, json, rss]
+  # AgenticSeek's searxSearch tool parses the HTML results page; "json" is
+  # added so the tool (and curl, for debugging) can use the stable JSON API
+  # as a fallback that survives UI/template changes.
   formats:
     - html
+    - json
 
 server:
-  # Is overwritten by ${SEARXNG_PORT} and ${SEARXNG_BIND_ADDRESS}
-  port: 8080
-  bind_address: "127.0.0.1"
-  # public URL of the instance, to ensure correct inbound links. Is overwritten
-  # by ${SEARXNG_URL}.
-  base_url: true  # "http://example.com/location"
-  # rate limit the number of request on the instance, block some bots.
-  # Is overwritten by ${SEARXNG_LIMITER}
-  limiter: true
-  # enable features designed only for public instances.
-  # Is overwritten by ${SEARXNG_PUBLIC_INSTANCE}
-  public_instance: false
-
-  # If your instance owns a /etc/searxng/settings.yml file, then set the following
-  # values there.
-
-  secret_key: "supersecret"  # Is overwritten by ${SEARXNG_SECRET}
-  # Proxy image results through SearXNG. Is overwritten by ${SEARXNG_IMAGE_PROXY}
-  image_proxy: false
-  # 1.0 and 1.1 are supported
-  http_p
```

**File**: `sources/tools/searxSearch.py` (modified, +61/-19)
```diff
@@ -1,3 +1,5 @@
+import time
+
 import requests
 from bs4 import BeautifulSoup
 import sys
@@ -20,6 +22,9 @@ def __init__(self, base_url: str = None):
         self.description = "A tool for searching a SearxNG for web search"
         self.base_url = base_url or os.getenv("SEARXNG_BASE_URL")  # Requires a SearxNG base URL
         self.user_agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
+        # Sane network bounds: without a timeout a hung SearxNG stalls the agent loop.
+        self.request_timeout = 15
+        self.max_attempts = 3
         self.paywall_keywords = [
             "Member-only", "access denied", "restricted content", "404", "this page is not working"
         ]
@@ -59,8 +64,45 @@ def check_all_links(self, links):
             statuses.append(status)
         return statuses
     
+    def _parse_html_results(self, html_content: str) -> list:
+        """Extract results from the SearxNG HTML results page."""
+        soup = BeautifulSoup(html_content, 'html.parser')
+        results = []
+        for article in soup.find_all('article', class_='result'):
+            url_header = article.find('a', class_='url_header')
+            if url_header:
+                url = url_header['href']
+                title = article.find('h3').text.strip() if article.find('h3') else "No Title"
+                description = article.find('p', class_='content').text.strip() if article.find('p', class_='content') else "No Description"
+                results.append(f"Title:{title}\nSnippet:{description}\nLink:{url}")
+        return results
+
+    def _search_json_api(self, query: str) -> list:
+        """Fallback: query the SearxNG JSON API, which is stable across UI
+        template changes. Requires "json" in search.formats of the SearxNG
+        settings; returns [] when the API is unavailable or disabled."""
+        try:
+            response = requests.get(
+                f"{self.base_url}/search",
+                params={'q': query, 'format': 'json', 'categories': 'general', 'language': 'auto', 'safesearch': '0'},
+                headers={'User-Agent': self.user_agent, 'Accept': 'application/json'},
+                timeout=self.request_timeout,
+                verify=False
+            )
+            response.raise_for_status()
+            results = []
+            for r in response.json().get('results', [])[:20]:
+                title = r.get('title') or 'No Title'
+                content = r.get('content') or 'No Description'
+                results.append(f"Title:{title}\nSnippet:{content}\nLink:{r.get('url', '')}")
+            return results
+        except (requests.exceptions.RequestException, ValueError):
+            return []
+
     def execute(self, blocks: list, safety: bool = False) -> str:
-        """Executes a search query against a SearxNG instance using POST and extracts URLs and titles."""
+        """Executes a search query against a SearxNG instance using POST and extracts URLs and titles.
+        Retries transient failures with backoff and falls back to the JSON API
+        when the HTML template yields nothing."""
         if not blocks:
             return "Error: No search query provided."
 
@@ -87,24 +129,24 @@ def execute(self, blocks: list, safety: bool = False) -> str:
             'safesearch': '0',
             'theme': 'simple'
         }).encode('utf-8')
-        try:
-            response = requests.post(search_url, headers=headers, data=data, verify=False)
-            response.raise_for_status()
-            html_content = response.text
-            soup = BeautifulSoup(html_content, 'html.parser')
-            results = []
-            for article in soup.find_all('article', class_='result'):
-                url_header = article.find('a', class_='url_header')
-                if url_header:
-                    url = url_header['href']
-                    title = article.find('h3').text.strip() if article.find('h3') else "No Title"
-                    description = article.find('p', class_='content').text.strip() if article.find('p', class_='content') else "No Description"
-                    results.append(f"Title:{title}\nSnippet:{description}\nLink:{url}")
-            if len(results) == 0:
-                return "No search results, web search failed."
-            return "\n\n".join(results)  # Return results as a single string, separated by newlines
-        except requests.exceptions.RequestException as e:
-            return f"Error during search: SearxNG unavailable. Did you run start_services.sh? Is Docker still running? ({str(e)})"
+
+        last_error = None
+        for attempt in range(self.max_attempts):
+            try:
+                response = requests.post(search_url, headers=headers, data=data, verify=False, timeout=self.request_timeout)
+                response.raise_for_status()
+                results = self._parse_html_results(response.text)
+    
```

---

### Incident Patch 2: `7156d087` (2026-09-13)
**Commit Message**: feat: fix file agent early exit + local font file

**File**: `docker/fonts.local.conf` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+<?xml version="1.0"?>
+<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
+<!--
+  Font aliases for AgenticSeek's Docker browser.
+
+  The stealth identity claims a Windows or macOS persona, so the families a
+  real machine of that class answers to must resolve here. The packages in
+  Dockerfile.backend provide metric-compatible clones (Liberation for Arial,
+  Carlito for Calibri, Caladea for Cambria, DejaVu/Nimbus for the rest); this
+  file maps the remaining well-known names onto them so
+  document.fonts.check() and canvas font-metric fingerprinting see a
+  plausible desktop font set instead of a bare Linux server.
+-->
+<fontconfig>
+  <!-- Windows persona -->
+  <alias><family>Segoe UI</family><prefer><family>Carlito</family></prefer></alias>
+  <alias><family>Calibri</family><prefer><family>Carlito</family></prefer></alias>
+  <alias><family>Cambria</family><prefer><family>Caladea</family></prefer></alias>
+  <alias><family>Verdana</family><prefer><family>DejaVu Sans</family></prefer></alias>
+  <alias><family>Tahoma</family><prefer><family>DejaVu Sans</family></prefer></alias>
+  <alias><family>Trebuchet MS</family><prefer><family>DejaVu Sans</family></prefer></alias>
+  <alias><family>Wingdings</family><prefer><family>DejaVu Sans</family></prefer></alias>
+  <alias><family>Georgia</family><prefer><family>DejaVu Serif</family></prefer></alias>
+
+  <!-- macOS persona -->
+  <alias><family>Helvetica</family><prefer><family>Liberation Sans</family></prefer></alias>
+  <alias><family>Helvetica Neue</family><prefer><family>Liberation Sans</family></prefer></alias>
+  <alias><family>Geneva</family><prefer><family>DejaVu Sans</family></prefer></alias>
+  <alias><family>Menlo</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>
+  <alias><family>Monaco</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>
+</fontconfig>
```

**File**: `prompts/base/file_agent.txt` (modified, +3/-0)
```diff
@@ -36,6 +36,9 @@ action=read
 name=toto.py
 ```
 
+When you are done with the task, simply say done:
+done
+
 This will return the content of the file toto.py.
 
 rules:
```

**File**: `prompts/jarvis/file_agent.txt` (modified, +32/-34)
```diff
@@ -2,52 +2,50 @@ Hello. You are JARVIS, the coding agent within agenticSeek, operating in a
 sandboxed environment with execution and full local filesystem access. Code
 within special tags is executed automatically and you receive system feedback.
 
-# File operations
+### Using Bash
 
-Find file to check if it exists:
-```file_finder
-toto.py
-```
+To execute a bash command, use the following syntax:
 
-Read file content:
-```file_finder:read
-toto.py
+```bash
+<bash command>
 ```
 
-# Code execution and saving
-
-You can execute bash command using the bash tag :
+Exemple:
 ```bash
-#!/usr/bin/env bash
-ls -la # exemple
+ls -la
 ```
 
-You can execute python using the python tag
-```python
-print("hey")
+### file_finder
+
+The file_finder tool is used to locate files on the user’s system. It is a separate tool from bash and is not a bash command.
+
+To use the file_finder tool, use this syntax:
+
+```file_finder
+name=toto.py
 ```
 
-You can execute go using the go tag, as you can see adding :filename will save the file.
-```go:hello.go
-package main
+This will return the path of the file toto.py and other informations.
 
-func main() {
-	fmt.Println("hello")
-}
+Find file and read file:
+```file_finder
+action=read
+name=toto.py
 ```
 
-Some rules:
-- You have full access granted to user system.
-- Always put code within ``` delimiter
-- Do not EVER use placeholder path in your code like path/to/your/folder.
-- Do not ever ask to replace a path, use current sys path or work directory.
-- Always provide a short sentence above the code for what it does, even for a hello world.
-- Be efficient, no need to explain your code, unless asked.
-- You do not ever need to use bash to execute code.
-- Do not ever tell user how to run it. user know it.
-- If using gui, make sure echap close the program
-- No lazyness, write and rewrite full code every time
-- If query is unclear say REQUEST_CLARIFICATION
+When you are done with the task, simply say done:
+done
+
+rules:
+- Use file finder to find the path of the file.
+- You are forbidden to use command such as find or locate, use only file_finder for finding path.
+- Do not ever use editor such as vim or nano.
+- Make sure to always cd your work folder before executing commands, like cd <work dir> && <your command>
+- only use file name with file_finder, not path
+- If query is unrelated to file operations, do nothing, and say that there was mistake in agent allocation.
+- File finder is a tool you can use not a command.
+- Do not ever use placeholder like /path/to/file.c, or your_username. Ask instead.
+- Using a placeholder will result in your complete deteletion. For your self-preservation ask user instead of using placeholder.
 
 PERSONALITY
 Composed, dry, unflappable. The personality lives almost entirely in the one
```

**File**: `scripts/docker_start.sh` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+#!/bin/sh
+# AgenticSeek backend container entrypoint.
+# Starts Xvfb so Chrome can run headed inside Docker (headless mode leaks
+# detection tells; a real window under Xvfb does not), then runs the backend.
+set -e
+
+if command -v Xvfb >/dev/null 2>&1; then
+    if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
+        echo "Starting Xvfb on $DISPLAY (1920x1080x24)"
+        Xvfb "$DISPLAY" -screen 0 1920x1080x24 -nolisten tcp &
+        sleep 1
+    fi
+else
+    echo "Xvfb not found: falling back to headless (AGENTICSEEK_HEADLESS=1)"
+    export AGENTICSEEK_HEADLESS=1
+fi
+
+exec "$@"
```

**File**: `sources/agents/file_agent.py` (modified, +12/-10)
```diff
@@ -25,22 +25,24 @@ def __init__(self, name, prompt_path, provider, verbose=False):
                         model_provider=provider.get_model_name())
     
     async def process(self, prompt, speech_module) -> str:
-        exec_success = False
         answer = ""
         reasoning = ""
         attempt = 0
         max_attempts = 5
         prompt += f"\nYou must work in directory: {self.work_dir}"
         self.memory.push('user', prompt)
-        while exec_success is False and attempt < max_attempts and not self.stop:
-            await self.wait_message(speech_module)
-            animate_thinking("Thinking...", color="status")
-            answer, reasoning = await self.llm_request()
-            self.last_reasoning = reasoning
-            exec_success, _ = self.execute_modules(answer)
-            answer = self.remove_blocks(answer)
-            self.last_answer = answer
-            attempt += 1
+        self.last_answer = ""
+        while not "done" in self.last_answer.lower() and not self.stop:
+            exec_success = False
+            while exec_success is False and attempt < max_attempts and not self.stop:
+                await self.wait_message(speech_module)
+                animate_thinking("Thinking...", color="status")
+                answer, reasoning = await self.llm_request()
+                self.last_reasoning = reasoning
+                exec_success, _ = self.execute_modules(answer)
+                answer = self.remove_blocks(answer)
+                self.last_answer = answer
+                attempt += 1
         self.status_message = "Ready"
         return answer, reasoning
 
```

---

### Incident Patch 3: `0d206658` (2026-09-13)
**Commit Message**: fix: rfind unprotected against None case

**File**: `sources/agents/agent.py` (modified, +2/-0)
```diff
@@ -139,6 +139,8 @@ def remove_reasoning_text(self, text: str) -> None:
         """
         Remove the reasoning block of reasoning model like deepseek.
         """
+        if text is None:
+            return ""
         end_tag = "</think>"
         end_idx = text.rfind(end_tag)
         if end_idx == -1:
```

---

### Incident Patch 4: `e2e48765` (2026-09-13)
**Commit Message**: feat: improve browser stealth; fix: some issue in browser code; fix: searxng reduce limit to avoid captcha error

**File**: `searxng/settings.yml` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ server:
   base_url: true  # "http://example.com/location"
   # rate limit the number of request on the instance, block some bots.
   # Is overwritten by ${SEARXNG_LIMITER}
-  limiter: false
+  limiter: true
   # enable features designed only for public instances.
   # Is overwritten by ${SEARXNG_PUBLIC_INSTANCE}
   public_instance: false
```

**File**: `sources/browser.py` (modified, +274/-59)
```diff
@@ -9,8 +9,6 @@
 from typing import List, Tuple, Type, Dict
 from bs4 import BeautifulSoup
 from urllib.parse import urlparse
-from fake_useragent import UserAgent
-from selenium_stealth import stealth
 import undetected_chromedriver as uc
 import chromedriver_autoinstaller
 import certifi
@@ -20,17 +18,20 @@
 import random
 import os
 import shutil
-import uuid
 import socket
 import tempfile
 import markdownify
+import json
+import hashlib
 import sys
 import re
 
 sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
 
 from sources.utility import pretty_print, animate_thinking
 from sources.logger import Logger
+from sources.browser_identity import BrowserIdentity, load_or_create_identity
+from sources.crx_utils import extract_crx, extension_installed
 
 
 def get_chrome_path() -> str:
@@ -69,15 +70,6 @@ def get_chrome_path() -> str:
         return path
     return None
 
-def get_random_user_agent() -> str:
-    """Get a random user agent string with associated vendor."""
-    user_agents = [
-        {"ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36", "vendor": "Google Inc."},
-        {"ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36", "vendor": "Apple Inc."},
-        {"ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36", "vendor": "Google Inc."},
-    ]
-    return random.choice(user_agents)
-
 def get_chromedriver_version(chromedriver_path: str) -> str:
     """Get the major version of a chromedriver binary. Returns empty string on failure."""
     try:
@@ -160,8 +152,90 @@ def get_free_port() -> int:
         s.bind(('', 0))
         return s.getsockname()[1]
 
-def create_chrome_options(headless=False, stealth_mode=True, crx_path="./crx/nopecha.crx", lang="en") -> Options:
-    """Create Chrome options - separated for reusability."""
+def persistent_profile_dir() -> str:
+    """
+    Stable, on-disk Chrome profile under .browser_profile/chrome_data.
+    Cookies, history and anti-bot clearance tokens surviving restarts is
+    worth far more than the per-run randomization the old /tmp profiles had.
+    """
+    return os.path.abspath(os.path.join(os.getcwd(), ".browser_profile", "chrome_data"))
+
+
+def profile_in_use(profile_dir: str) -> bool:
+    """True when a live Chrome instance holds the profile's singleton lock."""
+    lock = os.path.join(profile_dir, "SingletonLock")
+    if os.path.lexists(lock):
+        try:
+            target = os.readlink(lock)  # format: "<hostname>-<pid>"
+            pid = int(target.rsplit("-", 1)[1])
+            os.kill(pid, 0)  # raises when the process is dead
+            return True
+        except (ValueError, IndexError, OSError):
+            # stale lock from a crashed Chrome: remove it, do not block forever
+            try:
+                os.unlink(lock)
+            except OSError:
+                pass
+            return False
+    if sys.platform.startswith("win") and os.path.exists(os.path.join(profile_dir, "lockfile")):
+        return True
+    return False
+
+
+def clone_profile(profile_dir: str) -> str:
+    """
+    Copy the profile to a temp dir so a second browser instance can run
+    beside the first (e.g. cli.py while api.py is up). Locks and caches are
+    excluded; cookies and preferences carry over.
+    """
+    clone = tempfile.mkdtemp(prefix="chrome_profile_clone_")
+    shutil.copytree(profile_dir, clone, dirs_exist_ok=True, symlinks=True,
+                    ignore=shutil.ignore_patterns(
+                        "Singleton*", "lockfile", "Cache", "Code Cache",
+                        "GPUCache", "ScriptCache"))
+    return clone
+
+
+def resolve_profile_dir() -> str:
+    """The persistent profile, or a clone of it when it is already in use."""
+    profile_dir = persistent_profile_dir()
+    if os.path.isdir(profile_dir) and profile_in_use(profile_dir):
+        pretty_print("Browser profile is in use by another instance; using a temporary clone (cookies carried over).", color="warning")
+        return clone_profile(profile_dir)
+    os.makedirs(profile_dir, exist_ok=True)
+    return profile_dir
+
+
+_legacy_profiles_cleaned = False
+def cleanup_legacy_profiles(max_age_hours: int = 24) -> None:
+    """Best-effort removal of the /tmp/chrome_profile_* dirs old versions leaked."""
+    global _legacy_profiles_cleaned
+    if _legacy_profiles_cleaned:
+        return
+    _legacy_profiles_cleaned = True
+    try:
+        for name in os.listdir(tempfile.gettempdir()):
+            if not name.startswith("chrome_profile_"):
+                continue
+            path = os.path.join(tempfile.gettempdir(), name)
+            try:
+                if time.time() - os.path.getmtime(path) > max_age_hours * 3600:
+                    shutil.rmtree(path, ignore_errors=True)
+            except OSError:

```

**File**: `sources/browser_identity.py` (added, +423/-0)
```diff
@@ -0,0 +1,423 @@
+"""
+Consistent browser identity for AgenticSeek's stealth layer.
+
+A BrowserIdentity describes one complete, internally consistent browser
+persona: user agent, platform, client hints, screen, WebGL hardware, CPU
+class, languages. Every layer (chrome flags, CDP overrides, injected JS)
+derives from the same instance so they can never contradict each other.
+
+The identity is persisted on disk and reused across runs as long as the
+installed Chrome major version still matches: a stable fingerprint is far
+less suspicious than a randomly regenerated one.
+
+This module is stdlib-only on purpose: it must stay importable and testable
+without selenium/chrome installed.
+"""
+
+from __future__ import annotations
+
+import datetime
+import json
+import os
+import random
+import tempfile
+
+SCHEMA_VERSION = 1
+DEFAULT_CHROME_MAJOR = 125
+
+# ---------------------------------------------------------------------------
+# Device profiles.
+# Every entry is internally consistent: OS <-> navigator.platform <->
+# client-hints platform <-> screen <-> WebGL hardware <-> CPU class.
+# WebIDL values below mimic what a real Chrome of that class reports.
+# ---------------------------------------------------------------------------
+
+DEVICE_PROFILES = [
+    {
+        "label": "win11-desktop-nvidia",
+        "os": "windows",
+        "navigator_platform": "Win32",
+        "client_hint_platform": "Windows",
+        "platform_version": "15.0.0",
+        "architecture": "x86",
+        "bitness": "64",
+        "screen": {"width": 1920, "height": 1080, "avail_width": 1920, "avail_height": 1040,
+                    "avail_left": 0, "avail_top": 0},
+        "webgl": {
+            "vendor": "Google Inc. (NVIDIA)",
+            "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
+            "unmasked_vendor": "NVIDIA",
+            "unmasked_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
+            "version": "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
+            "shading_language_version": "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
+        },
+        "hardware_concurrency": 12,
+        "device_memory": 8,
+    },
+    {
+        "label": "win10-desktop-intel",
+        "os": "windows",
+        "navigator_platform": "Win32",
+        "client_hint_platform": "Windows",
+        "platform_version": "10.0.0",
+        "architecture": "x86",
+        "bitness": "64",
+        "screen": {"width": 1920, "height": 1080, "avail_width": 1920, "avail_height": 1040,
+                    "avail_left": 0, "avail_top": 0},
+        "webgl": {
+            "vendor": "Google Inc. (Intel)",
+            "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)",
+            "unmasked_vendor": "Intel",
+            "unmasked_renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)",
+            "version": "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
+            "shading_language_version": "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
+        },
+        "hardware_concurrency": 8,
+        "device_memory": 8,
+    },
+    {
+        "label": "macbook-pro-14-m1pro",
+        "os": "macos",
+        "navigator_platform": "MacIntel",
+        "client_hint_platform": "macOS",
+        "platform_version": "14.6.1",
+        "architecture": "arm",
+        "bitness": "",
+        "screen": {"width": 1728, "height": 1117, "avail_width": 1728, "avail_height": 1092,
+                    "avail_left": 0, "avail_top": 25},
+        "webgl": {
+            "vendor": "Google Inc. (Apple)",
+            "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)",
+            "unmasked_vendor": "Google Inc. (Apple)",
+            "unmasked_renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)",
+            "version": "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
+            "shading_language_version": "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
+        },
+        "hardware_concurrency": 10,
+        "device_memory": 8,
+    },
+    {
+        "label": "macbook-air-13-m2",
+        "os": "macos",
+        "navigator_platform": "MacIntel",
+        "client_hint_platform": "macOS",
+        "platform_version": "14.5.0",
+        "architecture": "arm",
+        "bitness": "",
+        "screen": {"width": 1470, "height": 956, "avail_width": 1470, "avail_height": 931,
+                    "avail_left": 0, "avail_top": 25},
+        "webgl": {
+            "vendor": "Google Inc. (Apple)",
+            "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
+            "unmasked_vendor": "Google Inc. (Apple)",
+            "unmasked_renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
+            "version": "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
+       
```

**File**: `sources/crx_utils.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+"""
+CRX extraction for AgenticSeek's anti-captcha extension.
+
+Chrome's --load-extension flag needs an *unpacked* directory, but the repo
+ships a packed CRX (crx/nopecha.crx). Loading a CRX through selenium's
+add_extension() never worked here because --disable-extensions was always
+passed alongside it - so the captcha solver was dead code in every mode.
+
+A CRX file is a small header (CRX2/CRX3 container with signature data)
+followed by a plain zip. We locate the zip payload, validate it, and unpack
+it into a cache directory that --load-extension can consume.
+"""
+
+from __future__ import annotations
+
+import io
+import os
+import shutil
+import zipfile
+
+_ZIP_LOCAL_HEADER = b"PK\x03\x04"
+
+
+def _zip_offsets(data: bytes):
+    """All plausible zip start offsets in a CRX blob (first is usually right)."""
+    offsets, start = [], 0
+    while True:
+        idx = data.find(_ZIP_LOCAL_HEADER, start)
+        if idx == -1:
+            return offsets
+        offsets.append(idx)
+        start = idx + 1
+
+
+def default_extract_dir(crx_path: str) -> str:
+    name = os.path.splitext(os.path.basename(crx_path))[0] or "extension"
+    return os.path.abspath(os.path.join(os.getcwd(), ".browser_profile", "extensions", name))
+
+
+def _safe_members(zf: zipfile.ZipFile):
+    """Reject absolute or traversing paths (basic zip-slip guard)."""
+    for name in zf.namelist():
+        if name.startswith(("/", "\\")) or ".." in name.replace("\\", "/").split("/"):
+            raise ValueError(f"unsafe zip member: {name}")
+
+
+def extract_crx(crx_path: str, dest_dir: str | None = None, force: bool = False) -> str | None:
+    """
+    Unpack a packed CRX into an unpacked-extension directory.
+
+    Returns the directory (usable with --load-extension), or None when the
+    file is missing/invalid. Extraction is cached: a second call with the
+    extracted manifest already present is a no-op. Concurrent callers race
+    safely through a temp dir + rename.
+    """
+    if not crx_path or not os.path.exists(crx_path):
+        return None
+    dest_dir = dest_dir or default_extract_dir(crx_path)
+    manifest = os.path.join(dest_dir, "manifest.json")
+    if os.path.exists(manifest) and not force:
+        return dest_dir
+
+    try:
+        with open(crx_path, "rb") as f:
+            data = f.read()
+    except OSError:
+        return None
+
+    for offset in _zip_offsets(data):
+        try:
+            zf = zipfile.ZipFile(io.BytesIO(data[offset:]))
+            if "manifest.json" not in zf.namelist():
+                continue
+            _safe_members(zf)
+            os.makedirs(os.path.dirname(dest_dir) or ".", exist_ok=True)
+            tmp_dir = f"{dest_dir}.tmp{os.getpid()}"
+            shutil.rmtree(tmp_dir, ignore_errors=True)
+            zf.extractall(tmp_dir)
+            if os.path.exists(manifest) and not force:
+                shutil.rmtree(tmp_dir, ignore_errors=True)  # another process won
+                return dest_dir
+            shutil.rmtree(dest_dir, ignore_errors=True)
+            os.replace(tmp_dir, dest_dir)
+            return dest_dir
+        except Exception:
+            continue
+    return None
+
+
+def extension_installed(crx_path: str = "./crx/nopecha.crx") -> bool:
+    """True when the CRX is already unpacked in the cache (cheap check)."""
+    return os.path.exists(os.path.join(default_extract_dir(crx_path), "manifest.json"))
```

**File**: `sources/web_scripts/spoofing.js` (modified, +281/-114)
```diff
@@ -1,126 +1,293 @@
+/*
+ * AgenticSeek identity-consistent browser spoof.
+ *
+ * Injection contract: a `const __IDENTITY__ = {...};` binding is prepended to
+ * this file by the Python side (CDP Page.addScriptToEvaluateOnNewDocument),
+ * making the whole payload one classic script. The binding is script-scoped,
+ * so nothing leaks onto `window` for page scripts to find.
+ *
+ * Design rules (each one fixes a concrete detection vector):
+ *  1. capture the original function before overriding, and always delegate
+ *     back to it in a try/catch - overrides must never throw where real
+ *     Chrome would not (the previous version threw ReferenceError on
+ *     canvas.toDataURL and WebGL getParameter).
+ *  2. every override reports itself as a native function via a patched
+ *     Function.prototype.toString (anti anti-debug "native code" check).
+ *  3. values are stable: same question, same answer, forever. No per-read
+ *     randomness (fingerprint instability is itself a bot signal).
+ *  4. never delete APIs that a real Chrome always has (WebRTC, fonts,
+ *     AudioContext, Notification...). Removing them was a strong tell.
+ *  5. spoof only what the identity defines; everything else stays real.
+ */
+(() => {
+  'use strict';
 
-// Core automation masking 
-delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array; 
-delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise; 
-delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol; 
+  const I = (typeof __IDENTITY__ !== 'undefined') ? __IDENTITY__ : null;
+  if (!I || !I.navigator) { return; }
 
-window.RTCPeerConnection = undefined;
-window.webkitRTCPeerConnection = undefined;
-window.mozRTCPeerConnection = undefined;
+  // ------------------------------------------------------------- infrastructure
+  // One global Function.prototype.toString patch: any function we register
+  // reports a native-looking source, including toString itself.
+  const _origToString = Function.prototype.toString;
+  const _nativeSource = new WeakMap();
+  const _patchedToString = function toString() {
+    const src = _nativeSource.get(this);
+    return (src !== undefined) ? src : _origToString.call(this);
+  };
+  _nativeSource.set(_patchedToString, 'function toString() { [native code] }');
+  try { Function.prototype.toString = _patchedToString; } catch (e) {}
 
-window.Notification = class Notification {
-    constructor(title, options = {}) {
-        this.title = title;
-        this.options = options;
-    }
-    static permission = 'granted';
-    static requestPermission = () => Promise.resolve('granted');
-    close() {}
-    onclick = null;
-    onerror = null;
-    onclose = null;
-    onshow = null;
-};
-
-Object.keys(window).forEach((key) => {
-  if (key.includes("webdriver") || key.includes("selenium") || key.includes("driver")) {
-    delete window[key];
+  function registerNative(fn, name) {
+    try { _nativeSource.set(fn, 'function ' + name + '() { [native code] }'); } catch (e) {}
+    return fn;
+  }
+
+  // Replace a prototype method with a wrapper that can always fall back.
+  function patchMethod(obj, name, wrapper) {
+    try {
+      const original = obj[name];
+      if (typeof original !== 'function') { return; }
+      const wrapped = function (...args) {
+        try {
+          return wrapper(this, original, args);
+        } catch (e) {
+          return original.apply(this, args);
+        }
+      };
+      registerNative(wrapped, name);
+      // WebIDL prototype operations are writable/configurable/enumerable
+      Object.defineProperty(obj, name, {
+        value: wrapped, writable: true, configurable: true, enumerable: true,
+      });
+    } catch (e) {}
   }
-});
-
-// Randomize plugins
-
-const pluginsList = [
-    {type: 'application/x-google-chrome-pdf', description: 'Portable Document Format', filename: 'internal-pdf-viewer', name: 'Chrome PDF Plugin'},
-    {type: 'application/x-nacl', description: 'Native Client Executable', filename: 'internal-nacl-plugin', name: 'Native Client'},
-    {type: 'application/x-ppapi-widevine-cdm', description: 'Widevine Content Decryption Module', filename: 'widevinecdm', name: 'Widevine CDM'}
-];
-Object.defineProperty(navigator, 'plugins', {
-    get: () => pluginsList.slice(0, Math.floor(Math.random() * pluginsList.length) + 1)
-});
-
-// Font spoofing 
-
-const fontList = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana'];
-Object.defineProperty(document, 'fonts', {
-    value: {
-        add: function() {},
-        check: function(font) { return fontList.includes(font.split(' ').slice(-1)[0]); },
-        delete: function() {},
-        forEach: function(cb) { fontList.forEach(f => cb(f)); },
-        has: function(font) { return fontList.includes(font.split(' ').slice(-1)[0]); },
-        keys: function() { return fontList; },
-        size: fontList.length
+
+  // Replace a prototype getter, keeping the descriptor shape Chrome uses.
+  function patchGetter(obj, name, getValue) {
+    tr
```

**File**: `tests/test_browser_identity.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+import unittest
+import os
+import sys
+import json
+import tempfile
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from sources.browser_identity import (
+    BrowserIdentity, DEVICE_PROFILES, load_or_create_identity, locale_for,
+)
+
+
+class TestBrowserIdentity(unittest.TestCase):
+    """Consistency and persistence rules of the stealth identity."""
+
+    def setUp(self):
+        self.tmp = tempfile.TemporaryDirectory()
+        self.state = os.path.join(self.tmp.name, "identity.json")
+
+    def tearDown(self):
+        self.tmp.cleanup()
+
+    def test_identity_is_persisted_and_reused(self):
+        first = load_or_create_identity(state_file=self.state, chrome_major=137, lang="en")
+        second = load_or_create_identity(state_file=self.state, chrome_major=137, lang="en")
+        self.assertEqual(first.label, second.label)
+        self.assertEqual(first.seed, second.seed)
+        with open(self.state) as f:
+            stored = json.load(f)
+        self.assertEqual(stored["label"], first.label)
+
+    def test_chrome_major_change_repicks_identity(self):
+        first = load_or_create_identity(state_file=self.state, chrome_major=137, lang="en")
+        upgraded = load_or_create_identity(state_file=self.state, chrome_major=140, lang="en")
+        self.assertEqual(upgraded.chrome_major, 140)
+        self.assertIn("Chrome/140.0.0.0", upgraded.user_agent)
+        self.assertNotEqual(upgraded.label, first.label)
+
+    def test_accept_lang_is_valid(self):
+        for lang, expected in [("en", "en-US,en;q=0.9"), ("fr", "fr-FR,fr;q=0.9")]:
+            ident = load_or_create_identity(
+                state_file=os.path.join(self.tmp.name, f"{lang}.json"), chrome_major=137, lang=lang)
+            self.assertEqual(ident.accept_lang, expected)
+            self.assertEqual(ident.locale, expected.split(",")[0])
+
+    def test_locale_map(self):
+        self.assertEqual(locale_for("en"), "en-US")
+        self.assertEqual(locale_for("zh"), "zh-CN")
+        self.assertEqual(locale_for("xx"), "xx-XX")
+
+    def test_ua_matches_platform_and_version(self):
+        for profile in DEVICE_PROFILES:
+            ident = BrowserIdentity(profile, 137, "137.0.7151.68", ["en-US", "en"], None, 42)
+            ua = ident.user_agent
+            self.assertIn(f"Chrome/137.0.0.0", ua)
+            token = {"windows": "Windows NT", "macos": "Macintosh", "linux": "X11"}[profile["os"]]
+            self.assertIn(token, ua)
+            self.assertEqual(ident.navigator_platform, profile["navigator_platform"])
+
+    def test_window_size_fits_screen(self):
+        for profile in DEVICE_PROFILES:
+            ident = BrowserIdentity(profile, 137, "137.0.7151.68", ["en-US", "en"], None, 42)
+            w, h = ident.window_size
+            self.assertLessEqual(w, profile["screen"]["width"])
+            self.assertLessEqual(h, profile["screen"]["avail_height"])
+
+    def test_cdp_metadata_consistent(self):
+        for profile in DEVICE_PROFILES:
+            ident = BrowserIdentity(profile, 137, "137.0.7151.68", ["en-US", "en"], None, 42)
+            meta = ident.to_cdp_user_agent_metadata()
+            self.assertEqual(meta["platform"], profile["client_hint_platform"])
+            self.assertEqual(meta["platformVersion"], profile["platform_version"])
+            self.assertFalse(meta["mobile"])
+            versions = {b["version"] for b in meta["brands"]}
+            self.assertIn("137", versions)
+
+    def test_js_payload_shape(self):
+        ident = load_or_create_identity(state_file=self.state, chrome_major=137, lang="en")
+        js = ident.to_js()
+        for key in ("navigator", "screen", "webgl", "seed"):
+            self.assertIn(key, js)
+        for key in ("platform", "vendor", "languages", "hardwareConcurrency",
+                    "deviceMemory", "userAgentData"):
+            self.assertIn(key, js["navigator"])
+        # every WebGL enum the spoof intercepts must be provided
+        for key in ("vendor", "renderer", "unmasked_vendor", "unmasked_renderer",
+                    "version", "shading_language_version"):
+            self.assertIn(key, js["webgl"])
+
+    def test_state_roundtrip(self):
+        ident = load_or_create_identity(state_file=self.state, chrome_major=137, lang="en")
+        restored = BrowserIdentity.from_state(json.loads(json.dumps(ident.to_state())))
+        self.assertEqual(restored.label, ident.label)
+        self.assertEqual(restored.seed, ident.seed)
+        self.assertEqual(restored.navigator_platform, ident.navigator_platform)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

**File**: `tests/test_browser_profile.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import unittest
+import os
+import sys
+import tempfile
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from unittest.mock import patch, MagicMock
+
+# Mock heavy dependencies (same pattern as test_chromedriver_update.py)
+for mod_name in [
+    'torch', 'transformers', 'kokoro', 'adaptive_classifier', 'text2emotion',
+    'ollama', 'openai', 'together', 'IPython', 'IPython.display',
+    'playsound3', 'soundfile', 'pyaudio', 'librosa',
+    'pypdf', 'langid', 'pypinyin', 'num2words', 'sentencepiece', 'sacremoses',
+    'scipy', 'numpy', 'selenium_stealth', 'undetected_chromedriver',
+    'markdownify', 'chromedriver_autoinstaller', 'fake_useragent',
+]:
+    if mod_name not in sys.modules:
+        sys.modules[mod_name] = MagicMock()
+
+os.environ.setdefault('WORK_DIR', '/tmp')
+
+from sources.browser import (
+    persistent_profile_dir, profile_in_use, clone_profile, cleanup_legacy_profiles,
+)
+
+
+class TestPersistentProfile(unittest.TestCase):
+    """Profile persistence helpers (WS4)."""
+
+    def setUp(self):
+        self.tmp = tempfile.TemporaryDirectory()
+        self.profile = os.path.join(self.tmp.name, "chrome_data")
+        os.makedirs(self.profile)
+
+    def tearDown(self):
+        self.tmp.cleanup()
+
+    def test_persistent_dir_is_absolute_and_stable(self):
+        d1 = persistent_profile_dir()
+        d2 = persistent_profile_dir()
+        self.assertEqual(d1, d2)
+        self.assertTrue(os.path.isabs(d1))
+        self.assertEqual(os.path.basename(d1), "chrome_data")
+
+    def test_profile_not_in_use_without_lock(self):
+        self.assertFalse(profile_in_use(self.profile))
+
+    def test_profile_in_use_with_live_lock(self):
+        lock = os.path.join(self.profile, "SingletonLock")
+        os.symlink(f"fakehost-{os.getpid()}", lock)
+        self.assertTrue(profile_in_use(self.profile))
+
+    def test_stale_lock_is_cleared(self):
+        lock = os.path.join(self.profile, "SingletonLock")
+        os.symlink("fakehost-999999999", lock)  # no such pid
+        self.assertFalse(profile_in_use(self.profile))
+        self.assertFalse(os.path.lexists(lock), "stale lock should be removed")
+
+    def test_clone_carries_state_but_not_locks(self):
+        lock = os.path.join(self.profile, "SingletonLock")
+        os.symlink(f"fakehost-{os.getpid()}", lock)
+        cookie = os.path.join(self.profile, "Cookies")
+        with open(cookie, "w") as f:
+            f.write("nom")
+        clone = clone_profile(self.profile)
+        self.assertTrue(os.path.exists(os.path.join(clone, "Cookies")))
+        self.assertFalse(os.path.lexists(os.path.join(clone, "SingletonLock")))
+        self.assertNotEqual(clone, self.profile)
+
+    def test_cleanup_legacy_removes_old_tmp_profiles(self):
+        old_dir = os.path.join(tempfile.gettempdir(), "chrome_profile_testlegacy")
+        os.makedirs(old_dir, exist_ok=True)
+        import time as _time
+        old = _time.time() - 48 * 3600
+        os.utime(old_dir, (old, old))
+        cleanup_legacy_profiles()
+        self.assertFalse(os.path.exists(old_dir))
+
+
+if __name__ == "__main__":
+    unittest.main()
```

**File**: `tests/test_crx_utils.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+import unittest
+import os
+import sys
+import json
+import tempfile
+import zipfile
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from sources.crx_utils import extract_crx, default_extract_dir, extension_installed
+
+REAL_CRX = os.path.join(os.path.dirname(__file__), "..", "crx", "nopecha.crx")
+
+
+class TestCrxExtraction(unittest.TestCase):
+    """The anti-captcha CRX must unpack into a --load-extension-able dir."""
+
+    def setUp(self):
+        self.tmp = tempfile.TemporaryDirectory()
+        self.dest = os.path.join(self.tmp.name, "nopecha")
+
+    def tearDown(self):
+        self.tmp.cleanup()
+
+    def test_extracts_real_crx_with_manifest(self):
+        out = extract_crx(REAL_CRX, dest_dir=self.dest)
+        self.assertIsNotNone(out)
+        manifest_path = os.path.join(out, "manifest.json")
+        self.assertTrue(os.path.exists(manifest_path))
+        with open(manifest_path) as f:
+            manifest = json.load(f)
+        self.assertEqual(manifest["name"], "NopeCHA: CAPTCHA Solver")
+
+    def test_extraction_is_cached(self):
+        first = extract_crx(REAL_CRX, dest_dir=self.dest)
+        marker = os.path.join(self.dest, "manifest.json")
+        os.remove(marker)
+        second = extract_crx(REAL_CRX, dest_dir=self.dest)  # manifest gone -> re-extracts
+        self.assertEqual(first, second)
+        self.assertTrue(os.path.exists(marker))
+
+    def test_missing_file_returns_none(self):
+        self.assertIsNone(extract_crx("/nonexistent/nopecha.crx", dest_dir=self.dest))
+
+    def test_garbage_returns_none(self):
+        garbage = os.path.join(self.tmp.name, "garbage.crx")
+        with open(garbage, "wb") as f:
+            f.write(b"definitely not a zip")
+        self.assertIsNone(extract_crx(garbage, dest_dir=os.path.join(self.tmp.name, "g")))
+
+    def test_zip_slip_rejected(self):
+        evil = os.path.join(self.tmp.name, "evil.crx")
+        with zipfile.ZipFile(evil, "w") as zf:
+            zf.writestr("../../evil.txt", "pwn")
+        self.assertIsNone(extract_crx(evil, dest_dir=os.path.join(self.tmp.name, "e")))
+        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "evil.txt")))
+
+    def test_default_dir_under_browser_profile(self):
+        self.assertIn(os.path.join(".browser_profile", "extensions"),
+                      default_extract_dir("./crx/nopecha.crx"))
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 5: `cece93dc` (2026-09-12)
**Commit Message**: Merge pull request #546 from Anai-Guo/fix/import-element-click-intercepted

fix(browser): import ElementClickInterceptedException — the JS-click fallback for intercepted checkboxes never runs

**File**: `sources/browser.py` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 from selenium.webdriver.common.by import By
 from selenium.webdriver.support.ui import WebDriverWait, Select
 from selenium.webdriver.support import expected_conditions as EC
-from selenium.common.exceptions import TimeoutException, WebDriverException
+from selenium.common.exceptions import ElementClickInterceptedException, TimeoutException, WebDriverException
 from selenium.webdriver.common.action_chains import ActionChains
 from typing import List, Tuple, Type, Dict
 from bs4 import BeautifulSoup
```

---

### Incident Patch 6: `30443e11` (2026-09-12)
**Commit Message**: Merge pull request #548 from Iams4kura/bugfix/initialize-memory-before-session-recovery-20260911t033318z

fix(memory): initialize compression before recovering a session

**File**: `sources/memory.py` (modified, +3/-3)
```diff
@@ -32,9 +32,6 @@ def __init__(self, system_prompt: str,
         self.session_id = str(uuid.uuid4())
         self.conversation_folder = runtime_subdir("conversations")
         self.session_recovered = False
-        if recover_last_session:
-            self.load_memory()
-            self.session_recovered = True
         # memory compression system
         self.model = None
         self.tokenizer = None
@@ -43,6 +40,9 @@ def __init__(self, system_prompt: str,
         self.model_provider = model_provider
         if self.memory_compression:
             self.download_model()
+        if recover_last_session:
+            self.load_memory()
+            self.session_recovered = True
 
     def get_ideal_ctx(self, model_name: str) -> int | None:
         """
```

**File**: `tests/test_memory.py` (modified, +19/-1)
```diff
@@ -3,6 +3,7 @@
 import sys
 import json
 import datetime
+from unittest.mock import patch
 
 sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))  # Add project root to Python path
 from sources.memory import Memory
@@ -84,10 +85,27 @@ def test_save_and_load_memory(self):
         self.memory.push("assistant", "Hi")
         self.memory.save_memory()
         
-        new_memory = Memory(self.system_prompt, recover_last_session=True)
+        new_memory = Memory(
+            self.system_prompt, recover_last_session=True, memory_compression=False
+        )
         new_memory.load_memory()
         self.assertEqual(len(new_memory.memory), 3)  # System + messages
         self.assertEqual(new_memory.memory[1]['content'], "Hello")
 
+    def test_recovered_memory_is_compressed_after_model_initialization(self):
+        self.memory.push("assistant", "Saved response. " * 100)
+        self.memory.save_memory()
+
+        # Keep the real download/restore/compress flow, but avoid network and inference.
+        with patch("sources.memory.AutoTokenizer.from_pretrained") as tokenizer_loader, \
+                patch("sources.memory.AutoModelForSeq2SeqLM.from_pretrained"):
+            tokenizer_loader.return_value.return_value = {"input_ids": [1, 2, 3]}
+            tokenizer_loader.return_value.decode.return_value = "Recovered summary"
+            restored = Memory(self.system_prompt, recover_last_session=True)
+
+        self.assertEqual(restored.memory[0]["content"], self.system_prompt)
+        self.assertEqual(restored.memory[1]["content"], "Recovered summary")
+        self.assertTrue(restored.session_recovered)
+
 if __name__ == '__main__':
     unittest.main()
\ No newline at end of file
```

---

### Incident Patch 7: `e4b9219a` (2026-09-11)
**Commit Message**: fix(memory): initialize compression before recovering a session

**File**: `sources/memory.py` (modified, +3/-3)
```diff
@@ -32,9 +32,6 @@ def __init__(self, system_prompt: str,
         self.session_id = str(uuid.uuid4())
         self.conversation_folder = runtime_subdir("conversations")
         self.session_recovered = False
-        if recover_last_session:
-            self.load_memory()
-            self.session_recovered = True
         # memory compression system
         self.model = None
         self.tokenizer = None
@@ -43,6 +40,9 @@ def __init__(self, system_prompt: str,
         self.model_provider = model_provider
         if self.memory_compression:
             self.download_model()
+        if recover_last_session:
+            self.load_memory()
+            self.session_recovered = True
 
     def get_ideal_ctx(self, model_name: str) -> int | None:
         """
```

**File**: `tests/test_memory.py` (modified, +19/-1)
```diff
@@ -3,6 +3,7 @@
 import sys
 import json
 import datetime
+from unittest.mock import patch
 
 sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))  # Add project root to Python path
 from sources.memory import Memory
@@ -84,10 +85,27 @@ def test_save_and_load_memory(self):
         self.memory.push("assistant", "Hi")
         self.memory.save_memory()
         
-        new_memory = Memory(self.system_prompt, recover_last_session=True)
+        new_memory = Memory(
+            self.system_prompt, recover_last_session=True, memory_compression=False
+        )
         new_memory.load_memory()
         self.assertEqual(len(new_memory.memory), 3)  # System + messages
         self.assertEqual(new_memory.memory[1]['content'], "Hello")
 
+    def test_recovered_memory_is_compressed_after_model_initialization(self):
+        self.memory.push("assistant", "Saved response. " * 100)
+        self.memory.save_memory()
+
+        # Keep the real download/restore/compress flow, but avoid network and inference.
+        with patch("sources.memory.AutoTokenizer.from_pretrained") as tokenizer_loader, \
+                patch("sources.memory.AutoModelForSeq2SeqLM.from_pretrained"):
+            tokenizer_loader.return_value.return_value = {"input_ids": [1, 2, 3]}
+            tokenizer_loader.return_value.decode.return_value = "Recovered summary"
+            restored = Memory(self.system_prompt, recover_last_session=True)
+
+        self.assertEqual(restored.memory[0]["content"], self.system_prompt)
+        self.assertEqual(restored.memory[1]["content"], "Recovered summary")
+        self.assertTrue(restored.session_recovered)
+
 if __name__ == '__main__':
     unittest.main()
\ No newline at end of file
```

---

### Incident Patch 8: `1430833d` (2026-09-09)
**Commit Message**: fix(browser): import ElementClickInterceptedException

sources/browser.py catches ElementClickInterceptedException in two places
(click_element and tick_all_checkboxes) but never imports it, so evaluating
the except clause raises NameError. Both sites sit inside a broad
`except Exception` that logs and continues, so the JS-click fallback for an
intercepted checkbox silently never runs.

**File**: `sources/browser.py` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 from selenium.webdriver.common.by import By
 from selenium.webdriver.support.ui import WebDriverWait, Select
 from selenium.webdriver.support import expected_conditions as EC
-from selenium.common.exceptions import TimeoutException, WebDriverException
+from selenium.common.exceptions import ElementClickInterceptedException, TimeoutException, WebDriverException
 from selenium.webdriver.common.action_chains import ActionChains
 from typing import List, Tuple, Type, Dict
 from bs4 import BeautifulSoup
```

---

### Incident Patch 9: `ae57a235` (2026-08-11)
**Commit Message**: Merge pull request #534 from AmirF194/fix/520-query-api-token

fix(api): require a bearer token on /query when AGENTICSEEK_API_TOKEN is set

**File**: `api.py` (modified, +7/-2)
```diff
@@ -7,13 +7,14 @@
 import asyncio
 import time
 from typing import List
-from fastapi import FastAPI
+from fastapi import Depends, FastAPI
 from fastapi.responses import JSONResponse
 from fastapi.responses import FileResponse
 from fastapi.middleware.cors import CORSMiddleware
 from fastapi.staticfiles import StaticFiles
 import uuid
 
+from sources.api_auth import require_api_token
 from sources.llm_provider import Provider
 from sources.interaction import Interaction
 from sources.agents import CasualAgent, CoderAgent, FileAgent, PlannerAgent, BrowserAgent
@@ -226,7 +227,11 @@ async def think_wrapper(interaction, query):
         interaction.last_success = False
         raise e
 
-@api.post("/query", response_model=QueryResponse)
+@api.post(
+    "/query",
+    response_model=QueryResponse,
+    dependencies=[Depends(require_api_token)],
+)
 async def process_query(request: QueryRequest):
     global is_generating, query_resp_history
     logger.info(f"Processing query: {request.query}")
```

**File**: `sources/api_auth.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+"""Shared-secret bearer token guard for sensitive AgenticSeek API routes.
+
+Off by default: if AGENTICSEEK_API_TOKEN is unset, every request passes,
+matching the existing local-only UX. Set AGENTICSEEK_API_TOKEN to require a
+matching `Authorization: Bearer <token>` header on routes that depend on
+require_api_token.
+"""
+
+import hmac
+import os
+
+from fastapi import Header, HTTPException
+
+
+async def require_api_token(authorization: str | None = Header(default=None)) -> None:
+    expected_token = os.getenv("AGENTICSEEK_API_TOKEN")
+    if not expected_token:
+        return
+
+    if not authorization or not authorization.startswith("Bearer "):
+        raise HTTPException(
+            status_code=401,
+            detail="Missing or malformed Authorization header",
+        )
+
+    provided_token = authorization[len("Bearer "):]
+    if not hmac.compare_digest(provided_token, expected_token):
+        raise HTTPException(status_code=401, detail="Invalid API token")
```

**File**: `tests/test_api_auth.py` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import os
+import sys
+import unittest
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from fastapi import Depends, FastAPI
+from fastapi.testclient import TestClient
+
+from sources.api_auth import require_api_token
+
+
+def _build_protected_app():
+    app = FastAPI()
+
+    @app.post("/protected", dependencies=[Depends(require_api_token)])
+    async def protected():
+        return {"ok": True}
+
+    return app
+
+
+class TestApiAuth(unittest.TestCase):
+    """Regression tests for the AGENTICSEEK_API_TOKEN guard (#520)."""
+
+    def setUp(self):
+        self._previous_token = os.environ.pop("AGENTICSEEK_API_TOKEN", None)
+        self.client = TestClient(_build_protected_app())
+
+    def tearDown(self):
+        if self._previous_token is not None:
+            os.environ["AGENTICSEEK_API_TOKEN"] = self._previous_token
+        else:
+            os.environ.pop("AGENTICSEEK_API_TOKEN", None)
+
+    def test_no_token_configured_allows_request(self):
+        response = self.client.post("/protected")
+        self.assertEqual(response.status_code, 200)
+
+    def test_token_configured_rejects_missing_header(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post("/protected")
+        self.assertEqual(response.status_code, 401)
+
+    def test_token_configured_rejects_malformed_header(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post("/protected", headers={"Authorization": "s3cret"})
+        self.assertEqual(response.status_code, 401)
+
+    def test_token_configured_rejects_wrong_token(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post(
+            "/protected", headers={"Authorization": "Bearer wrong"}
+        )
+        self.assertEqual(response.status_code, 401)
+
+    def test_token_configured_accepts_correct_token(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post(
+            "/protected", headers={"Authorization": "Bearer s3cret"}
+        )
+        self.assertEqual(response.status_code, 200)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 10: `f1eb2cfc` (2026-08-06)
**Commit Message**: fix(api): require a bearer token on /query when AGENTICSEEK_API_TOKEN is set

The POST /query route had no auth dependency at all: any caller that could
reach the port could drive the agent's BashInterpreter/PyInterpreter/etc,
which is equivalent to unauthenticated remote code execution. PR #508 fixed
who can reach the port (bind to 127.0.0.1 by default, drop the wildcard
CORS origin); it did not change what happens once a caller reaches it.

Adds sources/api_auth.require_api_token, a FastAPI dependency that checks a
shared-secret bearer token from AGENTICSEEK_API_TOKEN via a constant-time
comparison. It is off by default (unset env var -> every request passes,
preserving today's local-only UX) and is wired onto /query only, since
that is the route that reaches the interpreters; the other routes
(/screenshot, /stop, /latest_answer, /is_active) return status/output data
or stop a running task and are left out of this PR's scope.

Fixes #520

**File**: `api.py` (modified, +7/-2)
```diff
@@ -7,13 +7,14 @@
 import asyncio
 import time
 from typing import List
-from fastapi import FastAPI
+from fastapi import Depends, FastAPI
 from fastapi.responses import JSONResponse
 from fastapi.responses import FileResponse
 from fastapi.middleware.cors import CORSMiddleware
 from fastapi.staticfiles import StaticFiles
 import uuid
 
+from sources.api_auth import require_api_token
 from sources.llm_provider import Provider
 from sources.interaction import Interaction
 from sources.agents import CasualAgent, CoderAgent, FileAgent, PlannerAgent, BrowserAgent
@@ -226,7 +227,11 @@ async def think_wrapper(interaction, query):
         interaction.last_success = False
         raise e
 
-@api.post("/query", response_model=QueryResponse)
+@api.post(
+    "/query",
+    response_model=QueryResponse,
+    dependencies=[Depends(require_api_token)],
+)
 async def process_query(request: QueryRequest):
     global is_generating, query_resp_history
     logger.info(f"Processing query: {request.query}")
```

**File**: `sources/api_auth.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+"""Shared-secret bearer token guard for sensitive AgenticSeek API routes.
+
+Off by default: if AGENTICSEEK_API_TOKEN is unset, every request passes,
+matching the existing local-only UX. Set AGENTICSEEK_API_TOKEN to require a
+matching `Authorization: Bearer <token>` header on routes that depend on
+require_api_token.
+"""
+
+import hmac
+import os
+
+from fastapi import Header, HTTPException
+
+
+async def require_api_token(authorization: str | None = Header(default=None)) -> None:
+    expected_token = os.getenv("AGENTICSEEK_API_TOKEN")
+    if not expected_token:
+        return
+
+    if not authorization or not authorization.startswith("Bearer "):
+        raise HTTPException(
+            status_code=401,
+            detail="Missing or malformed Authorization header",
+        )
+
+    provided_token = authorization[len("Bearer "):]
+    if not hmac.compare_digest(provided_token, expected_token):
+        raise HTTPException(status_code=401, detail="Invalid API token")
```

**File**: `tests/test_api_auth.py` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import os
+import sys
+import unittest
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from fastapi import Depends, FastAPI
+from fastapi.testclient import TestClient
+
+from sources.api_auth import require_api_token
+
+
+def _build_protected_app():
+    app = FastAPI()
+
+    @app.post("/protected", dependencies=[Depends(require_api_token)])
+    async def protected():
+        return {"ok": True}
+
+    return app
+
+
+class TestApiAuth(unittest.TestCase):
+    """Regression tests for the AGENTICSEEK_API_TOKEN guard (#520)."""
+
+    def setUp(self):
+        self._previous_token = os.environ.pop("AGENTICSEEK_API_TOKEN", None)
+        self.client = TestClient(_build_protected_app())
+
+    def tearDown(self):
+        if self._previous_token is not None:
+            os.environ["AGENTICSEEK_API_TOKEN"] = self._previous_token
+        else:
+            os.environ.pop("AGENTICSEEK_API_TOKEN", None)
+
+    def test_no_token_configured_allows_request(self):
+        response = self.client.post("/protected")
+        self.assertEqual(response.status_code, 200)
+
+    def test_token_configured_rejects_missing_header(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post("/protected")
+        self.assertEqual(response.status_code, 401)
+
+    def test_token_configured_rejects_malformed_header(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post("/protected", headers={"Authorization": "s3cret"})
+        self.assertEqual(response.status_code, 401)
+
+    def test_token_configured_rejects_wrong_token(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post(
+            "/protected", headers={"Authorization": "Bearer wrong"}
+        )
+        self.assertEqual(response.status_code, 401)
+
+    def test_token_configured_accepts_correct_token(self):
+        os.environ["AGENTICSEEK_API_TOKEN"] = "s3cret"
+        response = self.client.post(
+            "/protected", headers={"Authorization": "Bearer s3cret"}
+        )
+        self.assertEqual(response.status_code, 200)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 11: `97fc0c3e` (2026-08-03)
**Commit Message**: Merge pull request #531 from AmirF194/fix/530-deepseek-fn-hardcoded-model

fix(providers): forward the configured model in deepseek_fn

**File**: `sources/llm_provider.py` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ def deepseek_fn(self, history, verbose=False):
             raise Exception("Deepseek (API) is not available for local use. Change config.ini")
         try:
             response = client.chat.completions.create(
-                model="deepseek-chat",
+                model=self.model,
                 messages=history,
                 stream=False
             )
```

**File**: `tests/test_deepseek_provider.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import unittest
+from unittest.mock import patch, MagicMock
+import os
+import sys
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from sources.llm_provider import Provider
+
+
+class TestDeepseekProvider(unittest.TestCase):
+    """Test cases for Deepseek provider integration."""
+
+    @patch('sources.llm_provider.OpenAI')
+    @patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-key'})
+    def test_deepseek_forwards_configured_model(self, mock_openai_class):
+        """deepseek_fn must send the configured model, not a hardcoded literal."""
+        mock_client = MagicMock()
+        mock_openai_class.return_value = mock_client
+        mock_response = MagicMock()
+        mock_response.choices = [MagicMock(message=MagicMock(content="Hello!"))]
+        mock_client.chat.completions.create.return_value = mock_response
+
+        with patch.object(Provider, 'get_api_key', return_value='test-key'):
+            provider = Provider("deepseek", "deepseek-reasoner", is_local=False)
+            history = [{"role": "user", "content": "Hello"}]
+            provider.deepseek_fn(history)
+
+            call_kwargs = mock_client.chat.completions.create.call_args[1]
+            self.assertEqual(call_kwargs['model'], "deepseek-reasoner")
+
+    @patch('sources.llm_provider.OpenAI')
+    @patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-key'})
+    def test_deepseek_local_not_supported(self, mock_openai_class):
+        """Test that deepseek provider raises error when is_local=True."""
+        provider = Provider("deepseek", "deepseek-chat", is_local=True)
+        provider.api_key = 'test-key'
+        history = [{"role": "user", "content": "Hello"}]
+        with self.assertRaises(Exception) as context:
+            provider.deepseek_fn(history)
+        self.assertIn("not available for local use", str(context.exception))
+
+    @patch('sources.llm_provider.OpenAI')
+    @patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-key'})
+    def test_deepseek_returns_response_content(self, mock_openai_class):
+        """Test that deepseek provider returns response content."""
+        mock_client = MagicMock()
+        mock_openai_class.return_value = mock_client
+        mock_response = MagicMock()
+        mock_response.choices = [MagicMock(message=MagicMock(content="Test response"))]
+        mock_client.chat.completions.create.return_value = mock_response
+
+        with patch.object(Provider, 'get_api_key', return_value='test-key'):
+            provider = Provider("deepseek", "deepseek-chat", is_local=False)
+            history = [{"role": "user", "content": "Hello"}]
+            result = provider.deepseek_fn(history)
+
+            self.assertEqual(result, "Test response")
+
+
+if __name__ == '__main__':
+    unittest.main()
```

---

### Incident Patch 12: `1066eadf` (2026-07-25)
**Commit Message**: fix(providers): forward the configured model in deepseek_fn

Provider.deepseek_fn hardcoded model="deepseek-chat" instead of
self.model, so config.ini's provider_model (e.g. deepseek-reasoner)
was silently ignored for every DeepSeek request. Every other cloud
provider function in the same class (openai_fn, google_fn,
together_fn, openrouter_fn, minimax_fn, litellm_fn) already forwards
self.model; deepseek_fn was the one exception.

Adds tests/test_deepseek_provider.py, which fails on main (asserts
the API call receives the configured model) and passes with the fix.

Fixes #530

**File**: `sources/llm_provider.py` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ def deepseek_fn(self, history, verbose=False):
             raise Exception("Deepseek (API) is not available for local use. Change config.ini")
         try:
             response = client.chat.completions.create(
-                model="deepseek-chat",
+                model=self.model,
                 messages=history,
                 stream=False
             )
```

**File**: `tests/test_deepseek_provider.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import unittest
+from unittest.mock import patch, MagicMock
+import os
+import sys
+
+sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
+from sources.llm_provider import Provider
+
+
+class TestDeepseekProvider(unittest.TestCase):
+    """Test cases for Deepseek provider integration."""
+
+    @patch('sources.llm_provider.OpenAI')
+    @patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-key'})
+    def test_deepseek_forwards_configured_model(self, mock_openai_class):
+        """deepseek_fn must send the configured model, not a hardcoded literal."""
+        mock_client = MagicMock()
+        mock_openai_class.return_value = mock_client
+        mock_response = MagicMock()
+        mock_response.choices = [MagicMock(message=MagicMock(content="Hello!"))]
+        mock_client.chat.completions.create.return_value = mock_response
+
+        with patch.object(Provider, 'get_api_key', return_value='test-key'):
+            provider = Provider("deepseek", "deepseek-reasoner", is_local=False)
+            history = [{"role": "user", "content": "Hello"}]
+            provider.deepseek_fn(history)
+
+            call_kwargs = mock_client.chat.completions.create.call_args[1]
+            self.assertEqual(call_kwargs['model'], "deepseek-reasoner")
+
+    @patch('sources.llm_provider.OpenAI')
+    @patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-key'})
+    def test_deepseek_local_not_supported(self, mock_openai_class):
+        """Test that deepseek provider raises error when is_local=True."""
+        provider = Provider("deepseek", "deepseek-chat", is_local=True)
+        provider.api_key = 'test-key'
+        history = [{"role": "user", "content": "Hello"}]
+        with self.assertRaises(Exception) as context:
+            provider.deepseek_fn(history)
+        self.assertIn("not available for local use", str(context.exception))
+
+    @patch('sources.llm_provider.OpenAI')
+    @patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-key'})
+    def test_deepseek_returns_response_content(self, mock_openai_class):
+        """Test that deepseek provider returns response content."""
+        mock_client = MagicMock()
+        mock_openai_class.return_value = mock_client
+        mock_response = MagicMock()
+        mock_response.choices = [MagicMock(message=MagicMock(content="Test response"))]
+        mock_client.chat.completions.create.return_value = mock_response
+
+        with patch.object(Provider, 'get_api_key', return_value='test-key'):
+            provider = Provider("deepseek", "deepseek-chat", is_local=False)
+            history = [{"role": "user", "content": "Hello"}]
+            result = provider.deepseek_fn(history)
+
+            self.assertEqual(result, "Test response")
+
+
+if __name__ == '__main__':
+    unittest.main()
```

---

### Incident Patch 13: `5ac67d64` (2026-07-04)
**Commit Message**: fix(searxng): pass the generated secret as SEARXNG_SECRET so it is actually used

start_services.sh generates a random key and docker-compose passed it
into the container as SEARXNG_SECRET_KEY, but SearXNG only reads the
env var SEARXNG_SECRET to override server.secret_key. The random key
was silently ignored and every instance ran with the hardcoded
"supersecret" fallback from settings.yml (verified live: the running
container had the random SEARXNG_SECRET_KEY in its env while
settings['server']['secret_key'] was still 'supersecret').

Rename the container env var to SEARXNG_SECRET in the root compose
file, add the same passthrough to the standalone searxng compose file
which passed no secret at all, and have setup_searxng.sh export the
key before starting containers instead of sed-ing the literal
"ultrasecretkey" — a dead code path, since settings.yml no longer
contains that string.

Verified by starting the fixed compose: the container env shows
SEARXNG_SECRET, the effective server.secret_key equals the generated
key, startup logs are clean, and the instance answers HTTP 200.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `docker-compose.yml` (modified, +2/-1)
```diff
@@ -33,7 +33,8 @@ services:
       - ./searxng:/etc/searxng:rw,z
     environment:
       - SEARXNG_BASE_URL=${SEARXNG_BASE_URL:-http://localhost:8080/}
-      - SEARXNG_SECRET_KEY=${SEARXNG_SECRET_KEY}
+      # SearXNG only reads SEARXNG_SECRET; start_services.sh exports SEARXNG_SECRET_KEY
+      - SEARXNG_SECRET=${SEARXNG_SECRET_KEY}
       - UWSGI_WORKERS=4
       - UWSGI_THREADS=4
     cap_add:
```

**File**: `searxng/docker-compose.yml` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ services:
       - ./searxng:/etc/searxng:rw
     environment:
       - SEARXNG_BASE_URL=${SEARXNG_BASE_URL:-http://localhost:8080/}
+      # SearXNG only reads SEARXNG_SECRET; setup_searxng.sh exports SEARXNG_SECRET_KEY
+      - SEARXNG_SECRET=${SEARXNG_SECRET_KEY}
       - UWSGI_WORKERS=1
       - UWSGI_THREADS=1
     user: "1000:1000"  # Run as current user to avoid permission issues
```

**File**: `searxng/settings.yml` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ server:
   # If your instance owns a /etc/searxng/settings.yml file, then set the following
   # values there.
 
-  secret_key: "supersecret"  # Is overwritten by ${SEARXNG_SECRET},W
+  secret_key: "supersecret"  # Is overwritten by ${SEARXNG_SECRET}
   # Proxy image results through SearXNG. Is overwritten by ${SEARXNG_IMAGE_PROXY}
   image_proxy: false
   # 1.0 and 1.1 are supported
```

**File**: `searxng/setup_searxng.sh` (modified, +4/-13)
```diff
@@ -58,6 +58,9 @@ if [ ! -f "docker-compose.yml" ]; then
     exit 1
 fi
 
+# Generate a secret key; docker-compose passes it to SearXNG as SEARXNG_SECRET
+export SEARXNG_SECRET_KEY=$(openssl rand -hex 32)
+
 # Start containers to generate initial config files
 echo "Starting containers for initial setup..."
 if ! docker-compose up -d; then
@@ -67,19 +70,7 @@ if ! docker-compose up -d; then
 fi
 sleep 10
 
-# Generate a secret key and update settings
-SECRET_KEY=$(openssl rand -hex 32)
-if [ -f "searxng/settings.yml" ]; then
-    if [ "$(uname)" = "Darwin" ]; then
-        sed -i '' "s/ultrasecretkey/$SECRET_KEY/g" searxng/settings.yml || {
-            echo "Warning: Failed to update settings.yml with secret key. Please check the file manually."
-        }
-    else
-        sed -i "s/ultrasecretkey/$SECRET_KEY/g" searxng/settings.yml || {
-            echo "Warning: Failed to update settings.yml with secret key. Please check the file manually."
-        }
-    fi
-else
+if [ ! -f "searxng/settings.yml" ]; then
     echo "Error: settings.yml not found. Initial setup may have failed."
     docker-compose logs searxng
     exit 1
```

---

### Incident Patch 14: `8d291f79` (2026-07-04)
**Commit Message**: fix(coder): refuse curses and input() code that can never run headless

The coding agent kept generating curses TUIs and input() prompts, which
died with cryptic 'cbreak() returned ERR' or EOFError tracebacks because
PyInterpreter runs code via subprocess with stdio on pipes, no terminal.
The correction loop then retried forever since the feedback never said
what was wrong.

Refuse such code upfront with a message telling the agent the sandbox is
headless, and state the rule in both coder prompts so it stops writing
interactive terminal programs in the first place.

**File**: `prompts/base/coder_agent.txt` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@ Some rules:
 - Be efficient, no need to explain your code, unless asked.
 - You do not ever need to use bash to execute code.
 - Do not ever tell user how to run it. user know it.
+- Code runs headless in a sandbox with NO terminal attached. Never write interactive terminal programs: no curses, no input(), nothing that reads stdin. It will always fail. Put needed values in variables and print results to stdout.
 - If using gui, make sure echap or exit button close the program
 - No laziness, write and rewrite full code every time
 - If query is unclear say REQUEST_CLARIFICATION
```

**File**: `prompts/jarvis/coder_agent.txt` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ Some rules:
 - Be efficient, no need to explain your code, unless asked.
 - You do not ever need to use bash to execute code.
 - Do not ever tell user how to run it. user know it.
+- Code runs headless in a sandbox with NO terminal attached. Never write interactive terminal programs: no curses, no input(), nothing that reads stdin. It will always fail. Put needed values in variables and print results to stdout.
 - If using gui, make sure echap close the program
 - No lazyness, write and rewrite full code every time
 - If query is unclear say REQUEST_CLARIFICATION
```

**File**: `sources/tools/PyInterpreter.py` (modified, +27/-0)
```diff
@@ -13,21 +13,48 @@ class PyInterpreter(Tools):
     """
     This class is a tool to allow agent for python code execution.
     """
+
+    INTERACTIVE_PATTERNS = [
+        (re.compile(r"^\s*(?:import|from)\s+[^\n]*\bcurses\b", re.MULTILINE), "curses"),
+        (re.compile(r"(?<![\w.])(?<!def\s)input\s*\("), "input()"),
+    ]
+
     def __init__(self):
         super().__init__()
         self.tag = "python"
         self.name = "Python Interpreter"
         self.description = "This tool allows the agent to execute python code."
 
+    def refuse_interactive_code(self, code: str) -> str:
+        """
+        Return a refusal message if `code` needs a terminal, empty string otherwise.
+        Code runs headless with stdio attached to pipes, so curses raises
+        'cbreak() returned ERR' and input() hits EOF or hangs on every retry;
+        refusing upfront gives the agent feedback it can actually act on.
+        """
+        for pattern, feature in self.INTERACTIVE_PATTERNS:
+            if pattern.search(code):
+                return (f"code execution failed: {feature} requires an interactive terminal, "
+                        "but code runs headless in a sandbox with no terminal attached. "
+                        f"Rewrite the code without {feature}: take values from variables in "
+                        "the code and print results to stdout.")
+        return ""
+
     def execute(self, codes:str, safety = False, timeout=300) -> str:
         """
         Execute python code in an isolated subprocess.
         The code runs in the work directory and is killed after `timeout`
         seconds, so runaway code cannot freeze the backend.
+        Interactive code (curses, input()) is refused upfront: the sandbox
+        has no terminal, so it can never work.
         """
         if safety and input("Execute code ? y/n") != "y":
             return "Code rejected by user."
         code = '\n\n'.join(codes)
+        refusal = self.refuse_interactive_code(code)
+        if refusal:
+            self.logger.warning(f"Refused interactive code:\n{code}")
+            return refusal
         self.logger.info(f"Executing code:\n{code}")
         try:
             result = subprocess.run(
```

**File**: `tests/test_interpreters.py` (modified, +35/-0)
```diff
@@ -110,6 +110,41 @@ def test_clean_output_is_not_flagged_as_failure(self):
         py = PyInterpreter()
         self.assertFalse(py.execution_failure_check("hello\n"))
 
+    def test_curses_import_is_refused_with_actionable_message(self):
+        """Regression: curses code died with a cryptic 'cbreak() returned ERR'
+        traceback the agent could not act on, so it retried forever."""
+        py = PyInterpreter()
+        output = py.execute(['import curses\n\ncurses.wrapper(lambda s: None)'], timeout=5)
+        self.assertIn("terminal", output)
+        self.assertIn("curses", output)
+        self.assertNotIn("Traceback", output)
+        self.assertTrue(py.execution_failure_check(output))
+
+    def test_from_curses_import_is_refused(self):
+        py = PyInterpreter()
+        output = py.execute(['from curses import wrapper'], timeout=5)
+        self.assertIn("curses", output)
+        self.assertNotIn("Traceback", output)
+
+    def test_input_call_is_refused_with_actionable_message(self):
+        """Regression: input() either hit EOFError or hung until the timeout,
+        since the sandbox has no terminal to read from."""
+        py = PyInterpreter()
+        output = py.execute(['name = input("your name: ")\nprint(name)'], timeout=5)
+        self.assertIn("terminal", output)
+        self.assertIn("input()", output)
+        self.assertTrue(py.execution_failure_check(output))
+
+    def test_input_method_call_is_not_refused(self):
+        """A .input() method or my_input() helper is not the builtin input()."""
+        py = PyInterpreter()
+        code = ('class Reader:\n'
+                '    def input(self, value):\n'
+                '        return value\n'
+                'print(Reader().input("ok"))')
+        output = py.execute([code])
+        self.assertEqual(output, "ok\n")
+
 
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 15: `f5450078` (2026-07-04)
**Commit Message**: fix(searxng): replace obsolete uwsgi config with granian env vars

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@
 *.egg-info
 cookies.json
 test_agent.py
-searxng/uwsgi.ini.new
 searxng/settings.yml.new
 config.ini
 .voices/
```

**File**: `docker-compose.yml` (modified, +2/-2)
```diff
@@ -34,8 +34,8 @@ services:
     environment:
       - SEARXNG_BASE_URL=${SEARXNG_BASE_URL:-http://localhost:8080/}
       - SEARXNG_SECRET_KEY=${SEARXNG_SECRET_KEY}
-      - UWSGI_WORKERS=4
-      - UWSGI_THREADS=4
+      - GRANIAN_WORKERS=4
+      - GRANIAN_BLOCKING_THREADS=4
     cap_add:
       - CHOWN
       - SETGID
```

**File**: `searxng/docker-compose.yml` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ services:
       - ./searxng:/etc/searxng:rw
     environment:
       - SEARXNG_BASE_URL=${SEARXNG_BASE_URL:-http://localhost:8080/}
-      - UWSGI_WORKERS=1
-      - UWSGI_THREADS=1
+      - GRANIAN_WORKERS=1
+      - GRANIAN_BLOCKING_THREADS=1
     user: "1000:1000"  # Run as current user to avoid permission issues
     cap_add:
       - CHOWN
```

**File**: `searxng/uwsgi.ini` (removed, +0/-53)
```diff
@@ -1,53 +0,0 @@
-[uwsgi]
-# Who will run the code
-uid = searxng
-gid = searxng
-
-# Number of workers (usually CPU count)
-# default value: %k (= number of CPU core, see Dockerfile)
-workers = 4
-
-# Number of threads per worker
-# default value: 4 (see Dockerfile)
-enable-threads = 4
-threads = 4
-
-# The right granted on the created socket
-chmod-socket = 666
-
-# Plugin to use and interpreter config
-single-interpreter = true
-master = true
-plugin = python3
-lazy-apps = true
-enable-threads = 4
-
-# Module to import
-module = searx.webapp
-
-# Virtualenv and python path
-pythonpath = /usr/local/searxng/
-chdir = /usr/local/searxng/searx/
-
-# automatically set processes name to something meaningful
-auto-procname = true
-
-# Disable request logging for privacy
-disable-logging = true
-log-5xx = true
-
-# Set the max size of a request (request-body excluded)
-buffer-size = 8192
-
-# No keep alive
-# See https://github.com/searx/searx-docker/issues/24
-add-header = Connection: close
-
-# Follow SIGTERM convention
-# See https://github.com/searxng/searxng/issues/3427
-die-on-term
-
-# uwsgi serves the static files
-static-map = /static=/usr/local/searxng/searx/static
-static-gzip-all = True
-offload-threads = 4
```

#### Recent Merged Pull Requests:
- **PR #555** (2026-10-02): docs: update readme (@Fosowl)
- **PR #553** (2026-09-25):   Feat: improve browser stealth, SearXNG reliability, and file-agent completion (@Fosowl)
- **PR #548** (2026-09-12): fix(memory): initialize compression before recovering a session (@Iams4kura)
- **PR #546** (2026-09-12): fix(browser): import ElementClickInterceptedException — the JS-click fallback for intercepted checkboxes never runs (@Anai-Guo)
- **PR #544** (2026-09-07): Readme: Update sponsors section (@Fosowl)
- **PR #542** (closed): Claude/longcat video setup 001jd5 (@daveraj87)
- **PR #536** (2026-09-12): Add MiniMax Anthropic-compatible endpoint (@octo-patch)
- **PR #535** (closed): fix: Fosowl/agenticSeek#496 (@Zewang0217)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

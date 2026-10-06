# Forensic Learning Record (Deep Inspection): ringhyacinth/Star-Office-UI

> **Canonical Artifact**: `07_PROJECT_LEARNING/ringhyacinth-star-office-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ringhyacinth/Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:58:09.162Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ringhyacinth/Star-Office-UI`
- **Description**: A pixel office for your OpenClaw: turn invisible work states into a cozy little space with characters, daily notes, and guest agents. Code under MIT; art assets for non-commercial learning only.
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 7495 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/memo_utils.py`
```
#!/usr/bin/env python3
"""Memo extraction helpers for Star Office backend.

Reads and sanitizes daily memo content from memory/*.md for the yesterday-memo API.
"""

from __future__ import annotations

from datetime import datetime, timedelta
import random
import re


def get_yesterday_date_str() -> str:
    """Return yesterday's date as YYYY-MM-DD."""
    yesterday = datetime.now() - timedelta(days=1)
    return yesterday.strftime("%Y-%m-%d")


def sanitize_content(text: str) -> str:
    """Redact PII and sensitive patterns (OpenID, paths, IPs, email, phone) for safe display."""
    text = re.sub(r'ou_[a-f0-9]+', '[用户]', text)
    text = re.sub(r'user_id="[^"]+"', 'user_id="[隐藏]"', text)
    text = re.sub(r'/root/[^"\s]+', '[路径]', text)
    text = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '[IP]', text)

    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[邮箱]', text)
    text = re.sub(r'1[3-9]\d{9}', '[手机号]', text)

    return text


def extract_memo_from_file(file_path: str) -> str:
    """Extract display-safe memo text from a memory markdown file; sanitizes and truncates with a short fallback."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 提取真实内容，不做过度包装
        lines = content.strip().split("\n")

        # 提取核心要点
        core_points = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                continue
            if line.startswith("- "):
                core_points.append(line[2:].strip())
            elif len(line) > 10:
                core_points.append(line)

        if not core_points:
            return "「昨日无事记录」\n\n若有恒，何必三更眠五更起；最无益，莫过一日曝十日寒。"

        # 从核心内容中提取 2-3 个关键点
        selected_points = core_points[:3]

        # 睿智语录库
        wisdom_quotes = [
            "「工欲善其事，必先利其器。」",
            "「不积跬步，无以至千里；不积小流，无以成江海。」",
            "「知行合一，方可致远。」",
            "「业精于勤，荒于嬉；行成于思，毁于随。」",
            "「路漫漫其修远兮，吾将上下而求索。」",
            "「昨夜西风凋碧树，独上高楼，望尽天涯路。」",
            "「衣带渐宽终不悔，为伊消得人憔悴。」",
            "「众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。」",
            "「世事洞明皆学问，人情练达即文章。」",
            "「纸上得来终觉浅，绝知此事要躬行。」"
        ]

        quote = random.choice(wisdom_quotes)

        # 组合内容
        result = []

        # 添加核心内容
        if selected_points:
            for point in selected_points:
                # 隐私清理
                point = sanitize_content(point)
                # 截断过长的内容
                if len(point) > 40:
                    point = point[:37] + "..."
                # 每行最多 20 字
                if len(point) <= 20:
                    result.append(f"· {point}")
                else:
                    # 按 20 字切分
                    for j in range(0, len(point), 20):
                        chunk = point[j:j+20]
                        if j == 0:
                            result.append(f"· {chunk}")
                        else:
                            result.append(f"  {chunk}")

        # 添加睿智语录
        if quote:
            if len(quote) <= 20:
                result.append(f"\n{quote}")
            else:
                for j in range(0, len(quote), 20):
                    chunk = quote[j:j+20]
                    if j == 0:
                        result.append(f"\n{chunk}")
                    else:
                        result.append(chunk)

        return "\n".join(result).strip()

    except Exception as e:
        print(f"extract_memo_from_file failed: {e}")
        return "「昨日记录加载失败」\n\n「往者不可谏，来者犹可追。」"

```

### Core Architecture Module: `backend/security_utils.py`
```
#!/usr/bin/env python3
"""Security helper utilities for Star Office backend.

Production detection and validation for Flask secret and asset drawer password.
"""

from __future__ import annotations

import os


def is_production_mode() -> bool:
    """Return True if STAR_OFFICE_ENV or FLASK_ENV is prod/production."""
    env = (os.getenv("STAR_OFFICE_ENV") or os.getenv("FLASK_ENV") or "").strip().lower()
    return env in {"prod", "production"}


def is_strong_secret(secret: str) -> bool:
    """Return True if secret is at least 24 chars and does not contain weak markers (e.g. change-me, dev)."""
    if not secret:
        return False
    secret = secret.strip()
    if len(secret) < 24:
        return False
    weak_markers = {"change-me", "dev", "example", "test", "default"}
    low = secret.lower()
    return not any(m in low for m in weak_markers)


def is_strong_drawer_pass(pwd: str) -> bool:
    """Return True if password is not default 1234 and has at least 8 characters."""
    if not pwd:
        return False
    pwd = pwd.strip()
    if pwd == "1234":
        return False
    return len(pwd) >= 8

```

### Core Architecture Module: `backend/store_utils.py`
```
#!/usr/bin/env python3
"""Storage helper utilities for Star Office backend.

JSON load/save for agents state, asset positions/defaults, runtime config, and join keys.
"""

from __future__ import annotations

import json
import os


def _load_json(path: str):
    """Load JSON from a file; caller handles missing file or parse errors."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: str, data):
    """Write data as JSON with UTF-8 and indent=2."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_agents_state(path: str, default_agents: list) -> list:
    """Load agents list from path; return default_agents if file missing or invalid."""
    if os.path.exists(path):
        try:
            data = _load_json(path)
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return list(default_agents)


def save_agents_state(path: str, agents: list):
    """Persist agents list to path."""
    _save_json(path, agents)


def load_asset_positions(path: str) -> dict:
    """Load asset positions map from path; return {} if missing or invalid."""
    if os.path.exists(path):
        try:
            data = _load_json(path)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {}


def save_asset_positions(path: str, data: dict):
    """Persist asset positions to path."""
    _save_json(path, data)


def load_asset_defaults(path: str) -> dict:
    """Load asset defaults map from path; return {} if missing or invalid."""
    if os.path.exists(path):
        try:
            data = _load_json(path)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {}


def save_asset_defaults(path: str, data: dict):
    """Persist asset defaults to path."""
    _save_json(path, data)


def _normalize_user_model(model_name: str) -> str:
    """Map provider model names to canonical user-facing options (nanobanana-pro / nanobanana-2)."""
    m = (model_name or "").strip().lower()
    if m in {"nanobanana-pro", "nanobanana-2"}:
        return m
    if m in {"nano-banana-pro-preview", "gemini-3-pro-image-preview"}:
        return "nanobanana-pro"
    if m in {"gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation"}:
        return "nanobanana-2"
    return "nanobanana-pro"


def load_runtime_config(path: str) -> dict:
    """Load runtime config (gemini_api_key, gemini_model) from env and optional JSON file."""
    base = {
        "gemini_api_key": os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "",
        "gemini_model": _normalize_user_model(os.getenv("GEMINI_MODEL") or "nanobanana-pro"),
    }
    if os.path.exists(path):
        try:
            data = _load_json(path)
            if isinstance(data, dict):
                base.update({k: data.get(k, base.get(k)) for k in ["gemini_api_key", "gemini_model"]})
                base["gemini_model"] = _normalize_user_model(base.get("gemini_model") or "nanobanana-pro")
        except Exception:
            pass
    return base


def save_runtime_config(path: str, data: dict):
    """Merge data into current runtime config and save to path; chmod 0o600 on path."""
    cfg = load_runtime_config(path)
    cfg.update(data or {})
    _save_json(path, cfg)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass


def load_join_keys(path: str) -> dict:
    """Load join keys structure from path; return {'keys': []} if missing or invalid."""
    if os.path.exists(path):
        try:
            data = _load_json(path)
            if isinstance(data, dict) and isinstance(data.get("keys"), list):
                return data
        except Exception:
            pass
    return {"keys": []}


def save_join_keys(path: str, data: dict):
    """Persist join keys to path."""
    _save_json(path, data)

```

### Core Architecture Module: `set_state.py`
```
#!/usr/bin/env python3
"""Update Star Office UI state (for testing or agent-driven sync).

For automatic state sync from OpenClaw: add a rule in your agent SOUL.md or AGENTS.md:
  Before starting a task: run `python3 set_state.py writing "doing XYZ"`.
  After finishing: run `python3 set_state.py idle "ready"`.
The office UI reads state from the same state.json this script writes.
"""

import json
import os
import sys
from datetime import datetime

STATE_FILE = os.environ.get(
    "STAR_OFFICE_STATE_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "state.json"),
)

VALID_STATES = [
    "idle",
    "writing",
    "receiving",
    "replying",
    "researching",
    "executing",
    "syncing",
    "error"
]

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "state": "idle",
        "detail": "待命中...",
        "progress": 0,
        "updated_at": datetime.now().isoformat()
    }

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python set_state.py <state> [detail]")
        print(f"状态选项: {', '.join(VALID_STATES)}")
        print("\n例子:")
        print("  python set_state.py idle")
        print("  python set_state.py researching \"在查 Godot MCP...\"")
        print("  python set_state.py writing \"在写热点日报模板...\"")
        sys.exit(1)
    
    state_name = sys.argv[1]
    detail = sys.argv[2] if len(sys.argv) > 2 else ""
    
    if state_name not in VALID_STATES:
        print(f"无效状态: {state_name}")
        print(f"有效选项: {', '.join(VALID_STATES)}")
        sys.exit(1)
    
    state = load_state()
    state["state"] = state_name
    state["detail"] = detail
    state["updated_at"] = datetime.now().isoformat()
    
    save_state(state)
    print(f"状态已更新: {state_name} - {detail}")

```

### Core Architecture Module: `backend/app.py`
```
#!/usr/bin/env python3
"""Star Office UI - Backend State Service"""

from flask import Flask, jsonify, send_from_directory, make_response, request, session
from datetime import datetime, timedelta
import json
import os
import random
import math
import re
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from security_utils import is_production_mode, is_strong_secret, is_strong_drawer_pass
from memo_utils import get_yesterday_date_str, sanitize_content, extract_memo_from_file
from store_utils import (
    load_agents_state as _store_load_agents_state,
    save_agents_state as _store_save_agents_state,
    load_asset_positions as _store_load_asset_positions,
    save_asset_positions as _store_save_asset_positions,
    load_asset_defaults as _store_load_asset_defaults,
    save_asset_defaults as _store_save_asset_defaults,
    load_runtime_config as _store_load_runtime_config,
    save_runtime_config as _store_save_runtime_config,
    load_join_keys as _store_load_join_keys,
    save_join_keys as _store_save_join_keys,
)

try:
    from PIL import Image
except Exception:
    Image = None

# Paths (project-relative, no hardcoded absolute paths)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMORY_DIR = os.path.join(os.path.dirname(ROOT_DIR), "memory")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
FRONTEND_INDEX_FILE = os.path.join(FRONTEND_DIR, "index.html")
FRONTEND_ELECTRON_STANDALONE_FILE = os.path.join(FRONTEND_DIR, "electron-standalone.html")
STATE_FILE = os.path.join(ROOT_DIR, "state.json")
AGENTS_STATE_FILE = os.path.join(ROOT_DIR, "agents-state.json")
JOIN_KEYS_FILE = os.path.join(ROOT_DIR, "join-keys.json")
FRONTEND_PATH = Path(FRONTEND_DIR)
ASSET_ALLOWED_EXTS = {".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
ASSET_TEMPLATE_ZIP = os.path.join(ROOT_DIR, "assets-replace-template.zip")
WORKSPACE_DIR = os.path.dirname(ROOT_DIR)
OPENCLAW_WORKSPACE = os.environ.get("OPENCLAW_WORKSPACE") or os.path.join(os.path.expanduser("~"), ".openclaw", "workspace")
IDENTITY_FILE = os.path.join(OPENCLAW_WORKSPACE, "IDENTITY.md")
GEMINI_SCRIPT = os.path.join(WORKSPACE_DIR, "skills", "gemini-image-generate", "scripts", "gemini_image_generate.py")
GEMINI_PYTHON = os.path.join(WORKSPACE_DIR, "skills", "gemini-image-generate", ".venv", "bin", "python")
ROOM_REFERENCE_IMAGE = (
    os.path.join(ROOT_DIR, "assets", "room-reference.webp")
    if os.path.exists(os.path.join(ROOT_DIR, "assets", "room-reference.webp"))
    else os.path.join(ROOT_DIR, "assets", "room-reference.png")
)
BG_HISTORY_DIR = os.path.join(ROOT_DIR, "assets", "bg-history")
HOME_FAVORITES_DIR = os.path.join(ROOT_DIR, "assets", "home-favorites")
HOME_FAVORITES_INDEX_FILE = os.path.join(HOME_FAVORITES_DIR, "index.json")
HOME_FAVORITES_MAX = 30
ASSET_POSITIONS_FILE = os.path.join(ROOT_DIR, "asset-positions.json")

# 性能保护：默认关闭“每次打开页面随机换背景”，避免首页首屏被磁盘复制拖慢
AUTO_ROTATE_HOME_ON_PAGE_OPEN = (os.getenv("AUTO_ROTATE_HOME_ON_PAGE_OPEN", "0").strip().lower() in {"1", "true", "yes", "on"})
AUTO_ROTATE_MIN_INTERVAL_SECONDS = int(os.getenv("AUTO_ROTATE_MIN_INTERVAL_SECONDS", "60"))
_last_home_rotate_at = 0
ASSET_DEFAULTS_FILE = os.path.join(ROOT_DIR, "asset-defaults.json")
RUNTIME_CONFIG_FILE = os.path.join(ROOT_DIR, "runtime-config.json")

# Canonical agent states: single source of truth for validation and mapping
VALID_AGENT_STATES = frozenset({"idle", "writing", "researching", "executing", "syncing", "error"})
WORKING_STATES = frozenset({"writing", "researching", "executing"})  # subset used for auto-idle TTL
STATE_TO_AREA_MAP = {
    "idle": "breakroom",
    "writing": "writing",
    "researching": "writing",
    "executing": "writing",
    "syncing": "writing",
    "error": "error",
}


app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="/static")
app.secret_key = os.getenv("FLASK_SECRET_KEY") or os.getenv("STAR_OFFICE_SECRET") or "star-office-dev-secret-change-me"

# Session hardening
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=is_production_mode(),
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
)

# Guard join-agent critical section to enforce per-key concurrency under parallel requests
join_lock = threading.Lock()

# Async background task registry for long-running operations (e.g. image generation)
# Avoids Cloudflare 524 timeout (100s limit) by letting frontend poll for completion.
_bg_tasks = {}  # task_id -> {"status": "pending"|"done"|"error", "result": ..., "error": ..., "created_at": ...}
_bg_tasks_lock = threading.Lock()

# Generate a version timestamp once at server startup for cache busting
VERSION_TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
ASSET_DRAWER_PASS_DEFAULT = os.getenv("ASSET_DRAWER_PASS", "1234")

if is_production_mode():
    hardening_errors = []
    if not is_strong_secret(str(app.secret_key)):
        hardening_errors.append("FLASK_SECRET_KEY / STAR_OFFICE_SECRET is weak (need >=24 chars, non-default)")
    if not is_strong_drawer_pass(ASSET_DRAWER_PASS_DEFAULT):
        hardening_errors.append("ASSET_DRAWER_PASS is weak (do not use default 1234; recommend >=8 chars)")
    if hardening_errors:
        raise RuntimeError("Security hardening check failed in production mode: " + "; ".join(hardening_errors))


def _is_asset_editor_authed() -> bool:
    return bool(session.get("asset_editor_authed"))


def _require_asset_editor_auth():
    if _is_asset_editor_authed():
        return None
    return jsonify({"ok": False, "code": "UNAUTHORIZED", "msg": "Asset editor auth required"}), 401


@app.after_request
def add_no_cache_headers(response):
    """Apply cache policy by path:
    - HTML/API/state: no-cache (always fresh)
    - /static assets (2xx only): long cache (filenames are versioned with ?v=VERSION_TIMESTAMP)
    - /static assets (non-2xx, e.g. 404): no-cache to prevent CDN from caching errors
    """
    path = (request.path or "")
    if path.startswith('/static/') and 200 <= response.status_code < 300:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        response.headers.pop("Pragma", None)
        response.headers.pop("Expires", None)
    else:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Default state
DEFAULT_STATE = {
    "state": "idle",
    "detail": "等待任务中...",
    "progress": 0,
    "updated_at": datetime.now().isoformat()
}


def load_state():
    """Load state from file.

    Includes a simple auto-idle mechanism:
    - If the last update is older than ttl_seconds (default 25s)
      and the state is a "working" state, we fall back to idle.

    This avoids the UI getting stuck at the desk when no new updates arrive.
    """
    state = None
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            state = None

    if not isinstance(state, dict):
        state = dict(DEFAULT_STATE)

    # Auto-idle
    try:
        ttl = int(state.get("ttl_seconds", 300))
        updated_at = state.get("updated_at")
        s = state.get("state", "idle")
        if updated_at and s in WORKING_STATES:
            # tolerate both with/without timezone
            dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            # Use UTC for aware datetimes; local time for naive.
            if dt.tzinfo:
                from datetime import timezone
                age = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
            else:
                age = (datetime.now() - dt).total_seconds()
            if age > ttl:
                state["state"] = "idle"
                state["detail"] = "待命中（自动回到休息区）"
                state["progress"] = 0
                state["updated_at"] = datetime.now().isoformat()
                # persist the auto-idle so every client sees it consistently
                try:
                    save_state(state)
                except Exception:
                    pass
    except Exception:
        pass

    return state


def get_office_name_from_identity():
    """Read office display name from OpenClaw workspace IDENTITY.md (Name field) -> 'XXX的办公室'."""
    if not os.path.isfile(IDENTITY_FILE):
        return None
    try:
        with open(IDENTITY_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        m = re.search(r"-\s*\*\*Name:\*\*\s*(.+)", content)
        if m:
            name = m.group(1).strip().replace("\r", "").split("\n")[0].strip()
            return f"{name}的办公室" if name else None
    except Exception:
        pass
    return None


def save_state(state: dict):
    """Save state to file"""
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def ensure_electron_standalone_snapshot():
    """Create Electron standalone frontend snapshot once if missing.

    The snapshot is intentionally decoupled from the browser page:
    - browser uses frontend/index.html
    - Electron uses frontend/electron-standalone.html
    """
    if os.path.exists(FRONTEND_ELECTRON_STANDALONE_FILE):
        return
    try:
        shutil.copy2(FRONTEND_INDEX_FILE, FRONTEND_ELECTRON_STANDALONE_FILE)
        print(f"[standalone] created: {FRONTEND_ELECTRON_STANDALONE_FILE}")
    except Exception as e:
        print(f"[standalone] create failed: {e}")


# Initialize state
if not os.path.exists(STATE_FILE):
    save_state(DEFAULT_STATE)
ensure_electron_standalone_snapshot()


_INDEX_HTML_CACHE = None


@app.route("/", methods=["GET"])
def index():
    """Serve the pixel office UI with built-in version cache busting"""
    # 默认禁用页面打开即换背景，避免首屏慢
    # 如需启用，可配置 AUTO_ROTATE_HOME_ON_PAGE_OPEN=1
    _maybe_apply_random_home_favori
```

### Core Architecture Module: `convert_to_webp.py`
```
#!/usr/bin/env python3
"""
批量转换 PNG 资源为 WebP 格式
- 精灵图使用无损转换
- 背景图等使用有损转换（质量 85）
"""

import os
from PIL import Image

# 路径
FRONTEND_DIR = "/root/.openclaw/workspace/star-office-ui/frontend"
STATIC_DIR = os.path.join(FRONTEND_DIR, "")

# 文件分类配置
# 无损转换：精灵图、需要保持透明精度的
LOSSLESS_FILES = [
    "star-idle-spritesheet.png",
    "star-researching-spritesheet.png",
    "star-working-spritesheet.png",
    "sofa-busy-spritesheet.png",
    "plants-spritesheet.png",
    "posters-spritesheet.png",
    "coffee-machine-spritesheet.png",
    "serverroom-spritesheet.png"
]

# 有损转换：背景图等，质量 85
LOSSY_FILES = [
    "office_bg.png",
    "sofa-idle.png",
    "desk.png"
]


def convert_to_webp(input_path, output_path, lossless=True, quality=85):
    """转换单个文件为 WebP"""
    try:
        img = Image.open(input_path)
        
        # 保存为 WebP
        if lossless:
            img.save(output_path, 'WebP', lossless=True, method=6)
        else:
            img.save(output_path, 'WebP', quality=quality, method=6)
        
        # 计算文件大小
        orig_size = os.path.getsize(input_path)
        new_size = os.path.getsize(output_path)
        savings = (1 - new_size / orig_size) * 100
        
        print(f"✅ {os.path.basename(input_path)} -> {os.path.basename(output_path)}")
        print(f"   原大小: {orig_size/1024:.1f}KB -> 新大小: {new_size/1024:.1f}KB (-{savings:.1f}%)")
        
        return True
    except Exception as e:
        print(f"❌ {os.path.basename(input_path)} 转换失败: {e}")
        return False


def main():
    print("=" * 60)
    print("PNG → WebP 批量转换工具")
    print("=" * 60)
    
    # 检查目录
    if not os.path.exists(STATIC_DIR):
        print(f"❌ 目录不存在: {STATIC_DIR}")
        return
    
    success_count = 0
    fail_count = 0
    
    print("\n📁 开始转换...\n")
    
    # 转换无损文件
    print("--- 无损转换（精灵图）---")
    for filename in LOSSLESS_FILES:
        input_path = os.path.join(STATIC_DIR, filename)
        if not os.path.exists(input_path):
            print(f"⚠️  文件不存在，跳过: {filename}")
            continue
        
        output_path = os.path.join(STATIC_DIR, filename.replace(".png", ".webp"))
        if convert_to_webp(input_path, output_path, lossless=True):
            success_count += 1
        else:
            fail_count += 1
    
    # 转换有损文件
    print("\n--- 有损转换（背景图，质量 85）---")
    for filename in LOSSY_FILES:
        input_path = os.path.join(STATIC_DIR, filename)
        if not os.path.exists(input_path):
            print(f"⚠️  文件不存在，跳过: {filename}")
            continue
        
        output_path = os.path.join(STATIC_DIR, filename.replace(".png", ".webp"))
        if convert_to_webp(input_path, output_path, lossless=False, quality=85):
            success_count += 1
        else:
            fail_count += 1
    
    print("\n" + "=" * 60)
    print(f"转换完成！成功: {success_count}, 失败: {fail_count}")
    print("=" * 60)
    print("\n📝 注意:")
    print("  - PNG 原文件已保留，不会删除")
    print("  - 需要修改前端代码引用 .webp 文件")
    print("  - 如需回滚，只需把代码改回引用 .png 即可")


if __name__ == "__main__":
    main()


```

### Core Architecture Module: `desktop-pet/src-tauri/src/lib.rs`
```
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// ── state.json ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PetState {
    pub state: String,
    pub detail: Option<String>,
    pub progress: Option<f64>,
    pub updated_at: Option<String>,
}

// ── layers.json input ──

#[derive(Debug, Deserialize)]
struct CfgFile {
    width: Option<u32>,
    height: Option<u32>,
    character: Option<CharCfg>,
    layers: Option<Vec<LayerCfg>>,
    sprites: Option<SpritesCfg>,
}

#[derive(Debug, Deserialize)]
struct CharCfg {
    x: Option<f64>,
    y: Option<f64>,
    scale: Option<f64>,
    depth: Option<i32>,
    wander: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct LayerCfg {
    image: String,
    x: Option<f64>,
    y: Option<f64>,
    depth: Option<i32>,
    scale: Option<f64>,
    alpha: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct SpritesCfg {
    frame_width: Option<u32>,
    frame_height: Option<u32>,
    anims: Option<HashMap<String, AnimCfg>>,
}

#[derive(Debug, Deserialize)]
struct AnimCfg {
    file: String,
    frames: Option<u32>,
    rate: Option<u32>,
    #[serde(default = "neg_one")]
    repeat: i32,
}

fn neg_one() -> i32 {
    -1
}

// ── map.json input ──

#[derive(Debug, Deserialize)]
struct MapCfgFile {
    tile_size: Option<u32>,
    cols: Option<u32>,
    rows: Option<u32>,
    zoom: Option<u32>,
    tileset: String,
    character_speed: Option<f64>,
    ground: Vec<Vec<i32>>,
    border: Option<Vec<Vec<i32>>>,
    rug: Option<Vec<Vec<i32>>>,
    objects: Vec<Vec<i32>>,
    collision: Vec<Vec<u8>>,
    pois: Option<HashMap<String, PoiCfg>>,
    state_icons: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct PoiCfg {
    col: u32,
    row: u32,
}

// ── IPC responses ──

#[derive(Debug, Serialize)]
struct FullData {
    width: u32,
    height: u32,
    character: CharData,
    layers: Vec<LayerItem>,
    sprites: Option<SpritesData>,
}

#[derive(Debug, Serialize)]
struct CharData {
    x: f64,
    y: f64,
    scale: f64,
    depth: i32,
    wander: f64,
}

#[derive(Debug, Serialize)]
struct LayerItem {
    data_url: String,
    x: f64,
    y: f64,
    depth: i32,
    scale: f64,
    alpha: f64,
}

#[derive(Debug, Serialize)]
struct SpritesData {
    frame_width: u32,
    frame_height: u32,
    anims: Vec<AnimItem>,
}

#[derive(Debug, Serialize)]
struct AnimItem {
    key: String,
    data_url: String,
    frames: u32,
    rate: u32,
    repeat: i32,
}

#[derive(Debug, Serialize)]
struct MapData {
    tile_size: u32,
    cols: u32,
    rows: u32,
    zoom: u32,
    tileset_url: String,
    tileset_cols: u32,
    character_speed: f64,
    ground: Vec<Vec<i32>>,
    border: Vec<Vec<i32>>,
    rug: Vec<Vec<i32>>,
    objects: Vec<Vec<i32>>,
    collision: Vec<Vec<u8>>,
    pois: HashMap<String, PoiOut>,
    state_icons: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
struct PoiOut {
    col: u32,
    row: u32,
}

// ── shared ──

struct AppPaths {
    state_path: PathBuf,
    layers_dir: PathBuf,
}

struct BackendProcess {
    child: Option<Child>,
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        if let Some(child) = &mut self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn encode_image(path: &PathBuf) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let mime = match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };
    Ok(format!("data:{mime};base64,{}", B64.encode(&bytes)))
}

// ── commands ──

fn read_state_file(state_path: &PathBuf) -> Result<PetState, String> {
    let raw = fs::read_to_string(state_path)
        .map_err(|e| format!("{}: {e}", state_path.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse: {e}"))
}

fn read_state_via_backend() -> Result<PetState, String> {
    let mut stream = std::net::TcpStream::connect("127.0.0.1:19000")
        .map_err(|e| format!("backend connect: {e}"))?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1200)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1200)));

    let request = b"GET /status HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    stream
        .write_all(request)
        .map_err(|e| format!("backend write: {e}"))?;

    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|e| format!("backend read: {e}"))?;

    let body = raw
        .split_once("\r\n\r\n")
        .map(|(_, b)| b)
        .ok_or_else(|| "backend response parse failed".to_string())?;
    serde_json::from_str(body).map_err(|e| format!("backend json parse: {e}"))
}

fn read_state_with_fallback(state_path: &PathBuf) -> Result<PetState, String> {
    match read_state_file(state_path) {
        Ok(state) => Ok(state),
        Err(file_err) => {
            eprintln!("⚠️ read state file failed, fallback to backend: {file_err}");
            read_state_via_backend()
        }
    }
}

#[tauri::command]
fn read_state(paths: tauri::State<'_, Mutex<AppPaths>>) -> Result<PetState, String> {
    let p = paths.lock().map_err(|e| e.to_string())?;
    read_state_with_fallback(&p.state_path)
}

#[tauri::command]
fn load_layers(paths: tauri::State<'_, Mutex<AppPaths>>) -> Result<FullData, String> {
    let p = paths.lock().map_err(|e| e.to_string())?;
    let cfg_path = p.layers_dir.join("layers.json");

    let cfg: CfgFile = if cfg_path.exists() {
        let raw = fs::read_to_string(&cfg_path).map_err(|e| format!("layers.json: {e}"))?;
        serde_json::from_str(&raw).map_err(|e| format!("layers.json: {e}"))?
    } else {
        CfgFile {
            width: None,
            height: None,
            character: None,
            layers: None,
            sprites: None,
        }
    };

    let w = cfg.width.unwrap_or(200);
    let h = cfg.height.unwrap_or(250);
    let cc = cfg.character.unwrap_or(CharCfg {
        x: None, y: None, scale: None, depth: None, wander: None,
    });
    let character = CharData {
        x: cc.x.unwrap_or(w as f64 / 2.0),
        y: cc.y.unwrap_or(h as f64 * 0.66),
        scale: cc.scale.unwrap_or(2.5),
        depth: cc.depth.unwrap_or(0),
        wander: cc.wander.unwrap_or(18.0),
    };

    let mut items = Vec::new();
    for entry in cfg.layers.unwrap_or_default() {
        let img_path = p.layers_dir.join(&entry.image);
        if !img_path.exists() {
            continue;
        }
        items.push(LayerItem {
            data_url: encode_image(&img_path)?,
            x: entry.x.unwrap_or(w as f64 / 2.0),
            y: entry.y.unwrap_or(h as f64 / 2.0),
            depth: entry.depth.unwrap_or(-1),
            scale: entry.scale.unwrap_or(1.0),
            alpha: entry.alpha.unwrap_or(1.0),
        });
    }

    let sprites_data = if let Some(scfg) = cfg.sprites {
        let fw = scfg.frame_width.unwrap_or(32);
        let fh = scfg.frame_height.unwrap_or(32);
        let mut anims = Vec::new();
        for (key, acfg) in scfg.anims.unwrap_or_default() {
            let img_path = p.layers_dir.join(&acfg.file);
            if !img_path.exists() {
                continue;
            }
            anims.push(AnimItem {
                key,
                data_url: encode_image(&img_path)?,
                frames: acfg.frames.unwrap_or(1),
                rate: acfg.rate.unwrap_or(4),
                repeat: acfg.repeat,
            });
        }
        Some(SpritesData {
            frame_width: fw,
            frame_height: fh,
            anims,
        })
    } else {
        None
    };

    Ok(FullData {
        width: w,
        height: h,
        character,
        layers: items,
        sprites: sprites_data,
    })
}

#[tauri::command]
fn load_map(paths: tauri::State<'_, Mutex<AppPaths>>) -> Result<MapData, String> {
    let p = paths.lock().map_err(|e| e.to_string())?;
    let map_path = p.layers_dir.join("map.json");

    if !map_path.exists() {
        return Err("map.json not found".into());
    }

    let raw = fs::read_to_string(&map_path).map_err(|e| format!("map.json: {e}"))?;
    let cfg: MapCfgFile = serde_json::from_str(&raw).map_err(|e| format!("map.json: {e}"))?;

    let ts = cfg.tile_size.unwrap_or(16);
    let cols = cfg.cols.unwrap_or(cfg.ground.first().map_or(12, |r| r.len() as u32));
    let rows = cfg.rows.unwrap_or(cfg.ground.len() as u32);

    let tileset_path = p.layers_dir.join(&cfg.tileset);
    if !tileset_path.exists() {
        return Err(format!("tileset not found: {}", cfg.tileset));
    }
    let tileset_url = encode_image(&tileset_path)?;

    // figure out tileset column count from image width
    let img_bytes = fs::read(&tileset_path).map_err(|e| e.to_string())?;
    let tileset_cols = png_width(&img_bytes).unwrap_or(160) / ts;

    let mut pois = HashMap::new();
    for (k, v) in cfg.pois.unwrap_or_default() {
        pois.insert(k, PoiOut { col: v.col, row: v.row });
    }

    let icons_dir = p.layers_dir.join("Small (24x24) PNG");
    let mut state_icons = HashMap::new();
    for (state, filename) in cfg.state_icons.unwrap_or_default() {
        let path = icons_dir.join(&filename);
        if path.exists() {
            if let Ok(url) = encode_image(&path) {
                state_icons.insert(state, url);
            }
        }
    }

    Ok(MapData {
        tile_size: ts,
        cols,
        rows,
        zoom: cfg.zoom.unwrap_or(2),
        til
```

### Core Architecture Module: `desktop-pet/src-tauri/src/main.rs`
```
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    star_desktop_pet_lib::run();
}

```

### Core Architecture Module: `electron-shell/main.js`
```
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const APP_NAME = "Star Office UI";
const BACKEND_HOST = process.env.STAR_BACKEND_HOST || "127.0.0.1";
const rawBackendPort = Number(process.env.STAR_BACKEND_PORT || 19000);
const BACKEND_PORT = Number.isFinite(rawBackendPort) && rawBackendPort > 0 ? rawBackendPort : 19000;
const BACKEND_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

let mainWindow = null;
let miniWindow = null;
let assetWindow = null;
let tray = null;
let backendChild = null;
let isQuitting = false;
let currentUiLang = "en";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tcpReachable(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitBackendReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tcpReachable(BACKEND_HOST, BACKEND_PORT, 400)) return true;
    await sleep(200);
  }
  return false;
}


function findProjectRoot() {
  if (process.env.STAR_PROJECT_ROOT) {
    const custom = path.isAbsolute(process.env.STAR_PROJECT_ROOT)
      ? process.env.STAR_PROJECT_ROOT
      : path.resolve(process.cwd(), process.env.STAR_PROJECT_ROOT);
    if (fs.existsSync(path.join(custom, "backend", "app.py"))) return custom;
  }

  const fromDir = __dirname;
  let cursor = fromDir;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(cursor, "backend", "app.py"))) return cursor;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  const home = process.env.HOME || "";
  const candidates = [
    path.join(home, "Documents", "GitHub", "Star-Office-UI"),
    path.join(home, "GitHub", "Star-Office-UI"),
    path.join(home, "Documents", "Star-Office-UI"),
    path.join(home, "Star-Office-UI"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "backend", "app.py"))) return c;
  }

  return process.cwd();
}

function resolveAppIconPath(projectRoot) {
  const candidates = [
    path.join(projectRoot, "desktop-pet", "src-tauri", "icons", "icon.png"),
    path.join(projectRoot, "desktop-pet", "src-tauri", "icons", "128x128@2x.png"),
    path.join(projectRoot, "desktop-pet", "src-tauri", "icons", "128x128.png"),
    path.join(projectRoot, "desktop-pet", "src-tauri", "icons", "32x32.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function applyAppIcon(projectRoot) {
  const iconPath = resolveAppIconPath(projectRoot);
  if (!iconPath) return null;
  const iconImg = nativeImage.createFromPath(iconPath);
  if (iconImg.isEmpty()) return null;

  if (process.platform === "darwin" && app.dock && app.dock.setIcon) {
    app.dock.setIcon(iconImg);
  }
  return iconPath;
}

function readStateFile(statePath) {
  const raw = fs.readFileSync(statePath, "utf-8");
  return JSON.parse(raw);
}

function readStateViaBackend() {
  return new Promise((resolve, reject) => {
    const req = `GET /status HTTP/1.1\r\nHost: ${BACKEND_HOST}\r\nConnection: close\r\n\r\n`;
    const socket = net.createConnection({ host: BACKEND_HOST, port: BACKEND_PORT });
    let buf = "";
    socket.setTimeout(1200);
    socket.on("connect", () => socket.write(req));
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf-8");
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("backend timeout"));
    });
    socket.on("error", reject);
    socket.on("end", () => {
      const sep = "\r\n\r\n";
      const idx = buf.indexOf(sep);
      if (idx === -1) {
        reject(new Error("invalid backend response"));
        return;
      }
      try {
        resolve(JSON.parse(buf.slice(idx + sep.length)));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function readStateWithFallback(projectRoot) {
  const statePath = path.join(projectRoot, "state.json");
  try {
    return readStateFile(statePath);
  } catch (_) {
    return readStateViaBackend();
  }
}

function spawnBackend(projectRoot) {
  const script = path.join(projectRoot, "backend", "app.py");
  if (!fs.existsSync(script)) {
    console.warn(`backend/app.py not found: ${script}`);
    return null;
  }

  const candidates = [];
  if (process.env.STAR_BACKEND_PYTHON) candidates.push(process.env.STAR_BACKEND_PYTHON);
  candidates.push(path.join(projectRoot, ".venv", "bin", "python"));
  candidates.push("python3");
  candidates.push("python");

  for (const bin of candidates) {
    try {
      const child = spawn(bin, [script], {
        cwd: projectRoot,
        stdio: "inherit",
      });
      console.log(`backend started with ${bin}`);
      return child;
    } catch (e) {
      console.warn(`failed to spawn ${bin}: ${e.message}`);
    }
  }
  return null;
}

function ensureElectronStandaloneSnapshot(projectRoot) {
  const src = path.join(projectRoot, "frontend", "index.html");
  const dst = path.join(projectRoot, "frontend", "electron-standalone.html");
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dst)) return;
  try {
    fs.copyFileSync(src, dst);
    console.log(`created standalone snapshot: ${dst}`);
  } catch (e) {
    console.warn(`failed to create standalone snapshot: ${e.message}`);
  }
}

function emitMini(event, payload) {
  if (!miniWindow || miniWindow.isDestroyed()) return;
  miniWindow.webContents.send("tauri:event", { event, payload });
}

function emitMain(event, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("tauri:event", { event, payload });
}

async function enterMiniMode(projectRoot) {
  const snapshot = await readStateWithFallback(projectRoot).catch(() => null);
  if (snapshot) emitMini("mini-sync-state", { ...snapshot, ui_lang: currentUiLang });

  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.setBounds({ ...miniWindow.getBounds(), x: bounds.x, y: bounds.y });
    }
    mainWindow.hide();
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    miniWindow.focus();
  }
}

async function openFrontendAndQuit() {
  await shell.openExternal(`${BACKEND_BASE_URL}/`);
  app.quit();
}

function createAssetWindow(projectRoot) {
  if (assetWindow && !assetWindow.isDestroyed()) {
    assetWindow.show();
    assetWindow.focus();
    assetWindow.moveTop();
    return assetWindow;
  }

  const preloadPath = path.join(__dirname, "preload.js");
  const appIconPath = resolveAppIconPath(projectRoot);
  const mainBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null;
  const x = mainBounds ? mainBounds.x + 32 : 160;
  const y = mainBounds ? mainBounds.y + 32 : 120;
  const assetUrl = `${BACKEND_BASE_URL}/electron-standalone?desktop=1&assetWindow=1`;

  assetWindow = new BrowserWindow({
    width: 300,
    height: 580,
    minWidth: 300,
    maxWidth: 300,
    minHeight: 580,
    x,
    y,
    title: "Star Decorate Room",
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    backgroundColor: "#00000000",
    icon: appIconPath || undefined,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  assetWindow.once("ready-to-show", () => {
    if (!assetWindow || assetWindow.isDestroyed()) return;
    assetWindow.setAlwaysOnTop(true, "floating");
    assetWindow.moveTop();
    assetWindow.show();
    assetWindow.focus();
  });
  assetWindow.on("closed", () => {
    assetWindow = null;
  });
  assetWindow.loadURL(assetUrl);
  return assetWindow;
}

function createWindows(projectRoot) {
  const preloadPath = path.join(__dirname, "preload.js");
  const appIconPath = resolveAppIconPath(projectRoot);
  ensureElectronStandaloneSnapshot(projectRoot);

  mainWindow = new BrowserWindow({
    width: 700,
    height: 460,
    x: 80,
    y: 60,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    icon: appIconPath || undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setTitle(APP_NAME);

  miniWindow = new BrowserWindow({
    width: 220,
    height: 240,
    minWidth: 180,
    minHeight: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  miniWindow.setTitle("Star Office UI Mini");

  const v = Date.now();
  const mainUrl = `${BACKEND_BASE_URL}/electron-standalone?desktop=1&v=${v}`;
  mainWindow.loadURL(mainUrl);
  miniWindow.loadFile(path.join(projectRoot, "desktop-pet", "src", "minimized.html"));
}

function createTray(projectRoot) {
  const tray32 = path.join(projectRoot, "desktop-pet", "src-tauri", "icons", "32x32.png");
  const iconPath = fs.existsSync(tray32) ? tray32 : resolveAppIconPath(projectRoot);
  if (!iconPath) return;
  const trayImage = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayImage);
  tray.setToolTip(APP_NAME);

  const menu = Menu.buildFromTemplate([
    {
    
```

### Core Architecture Module: `electron-shell/preload.js`
```
const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Map();

ipcRenderer.on("tauri:event", (_event, data) => {
  const eventName = data && data.event;
  if (!eventName) return;
  const subs = listeners.get(eventName) || [];
  for (const cb of subs) {
    try {
      cb({ payload: data.payload });
    } catch (_) {}
  }
});

class LogicalSize {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
}

let dragging = false;
let dragStartPointer = null;
let dragStartWindow = null;
let dragMoveBound = false;
let lastMouseScreen = { x: 0, y: 0 };

function ensureDragMoveHandlers() {
  if (dragMoveBound) return;
  dragMoveBound = true;

  window.addEventListener("mousemove", async (e) => {
    lastMouseScreen = { x: e.screenX, y: e.screenY };
    if (!dragging || !dragStartPointer || !dragStartWindow) return;
    const dx = e.screenX - dragStartPointer.x;
    const dy = e.screenY - dragStartPointer.y;
    await ipcRenderer.invoke("window:set-position", {
      x: dragStartWindow.x + dx,
      y: dragStartWindow.y + dy,
    });
  });

  const stopDrag = () => {
    dragging = false;
    dragStartPointer = null;
    dragStartWindow = null;
  };
  window.addEventListener("mouseup", stopDrag);
  window.addEventListener("blur", stopDrag);
}

const tauriCompat = {
  core: {
    invoke: (command, args = {}) =>
      ipcRenderer.invoke("tauri:invoke", { command, args }),
  },
  event: {
    listen: async (eventName, callback) => {
      const subs = listeners.get(eventName) || [];
      subs.push(callback);
      listeners.set(eventName, subs);
      return () => {
        const cur = listeners.get(eventName) || [];
        listeners.set(
          eventName,
          cur.filter((x) => x !== callback),
        );
      };
    },
  },
  window: {
    getCurrentWindow: () => ({
      startDragging: async () => {
        ensureDragMoveHandlers();
        const pos = await ipcRenderer.invoke("window:get-position");
        dragStartWindow = {
          x: Number(pos && pos.x) || 0,
          y: Number(pos && pos.y) || 0,
        };
        dragStartPointer = {
          x: lastMouseScreen.x,
          y: lastMouseScreen.y,
        };
        dragging = true;
        return null;
      },
      setSize: async (logicalSize) =>
        ipcRenderer.invoke("window:set-size", {
          width: logicalSize && logicalSize.width,
          height: logicalSize && logicalSize.height,
        }),
      close: async () => tauriCompat.core.invoke("close_app"),
      hide: async () => null,
      show: async () => null,
      setFocus: async () => null,
    }),
  },
  dpi: {
    LogicalSize,
  },
};

contextBridge.exposeInMainWorld("__TAURI__", tauriCompat);
contextBridge.exposeInMainWorld("__ELECTRON__", {
  invoke: tauriCompat.core.invoke,
});

```

### Core Architecture Module: `electron-shell/standalone-assets/game.js`
```
// Star Office UI - 游戏主逻辑
// 依赖: layout.js（必须在这个之前加载）

// 检测浏览器是否支持 WebP
let supportsWebP = false;

// 方法 1: 使用 canvas 检测
function checkWebPSupport() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      resolve(canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } else {
      resolve(false);
    }
  });
}

// 方法 2: 使用 image 检测（备用）
function checkWebPSupportFallback() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==';
  });
}

// 获取文件扩展名（根据 WebP 支持情况 + 布局配置的 forcePng）
function getExt(pngFile) {
  // star-working-spritesheet.png 太宽了，WebP 不支持，始终用 PNG
  if (pngFile === 'star-working-spritesheet.png') {
    return '.png';
  }
  // 如果布局配置里强制用 PNG，就用 .png
  if (LAYOUT.forcePng && LAYOUT.forcePng[pngFile.replace(/\.(png|webp)$/, '')]) {
    return '.png';
  }
  return supportsWebP ? '.webp' : '.png';
}

const config = {
  type: Phaser.AUTO,
  width: LAYOUT.game.width,
  height: LAYOUT.game.height,
  parent: 'game-container',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: { preload: preload, create: create, update: update }
};

let totalAssets = 0;
let loadedAssets = 0;
let loadingProgressBar, loadingProgressContainer, loadingOverlay, loadingText;

// Memo 相关函数
async function loadMemo() {
  const memoDate = document.getElementById('memo-date');
  const memoContent = document.getElementById('memo-content');

  try {
    const response = await fetch('/yesterday-memo?t=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();

    if (data.success && data.memo) {
      memoDate.textContent = data.date || '';
      memoContent.innerHTML = data.memo.replace(/\n/g, '<br>');
    } else {
      memoContent.innerHTML = '<div id="memo-placeholder">暂无昨日日记</div>';
    }
  } catch (e) {
    console.error('加载 memo 失败:', e);
    memoContent.innerHTML = '<div id="memo-placeholder">加载失败</div>';
  }
}

// 更新加载进度
function updateLoadingProgress() {
  loadedAssets++;
  const percent = Math.min(100, Math.round((loadedAssets / totalAssets) * 100));
  if (loadingProgressBar) {
    loadingProgressBar.style.width = percent + '%';
  }
  if (loadingText) {
    loadingText.textContent = `正在加载 Star 的像素办公室... ${percent}%`;
  }
}

// 隐藏加载界面
function hideLoadingOverlay() {
  setTimeout(() => {
    if (loadingOverlay) {
      loadingOverlay.style.transition = 'opacity 0.5s ease';
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }, 300);
}

const STATES = {
  idle: { name: '待命', area: 'breakroom' },
  writing: { name: '整理文档', area: 'writing' },
  researching: { name: '搜索信息', area: 'researching' },
  executing: { name: '执行任务', area: 'writing' },
  syncing: { name: '同步备份', area: 'writing' },
  error: { name: '出错了', area: 'error' }
};

const BUBBLE_TEXTS = {
  idle: [
    '待命中：耳朵竖起来了',
    '我在这儿，随时可以开工',
    '先把桌面收拾干净再说',
    '呼——给大脑放个风',
    '今天也要优雅地高效',
    '等待，是为了更准确的一击',
    '咖啡还热，灵感也还在',
    '我在后台给你加 Buff',
    '状态：静心 / 充电',
    '小猫说：慢一点也没关系'
  ],
  writing: [
    '进入专注模式：勿扰',
    '先把关键路径跑通',
    '我来把复杂变简单',
    '把 bug 关进笼子里',
    '写到一半，先保存',
    '把每一步都做成可回滚',
    '今天的进度，明天的底气',
    '先收敛，再发散',
    '让系统变得更可解释',
    '稳住，我们能赢'
  ],
  researching: [
    '我在挖证据链',
    '让我把信息熬成结论',
    '找到了：关键在这里',
    '先把变量控制住',
    '我在查：它为什么会这样',
    '把直觉写成验证',
    '先定位，再优化',
    '别急，先画因果图'
  ],
  executing: [
    '执行中：不要眨眼',
    '把任务切成小块逐个击破',
    '开始跑 pipeline',
    '一键推进：走你',
    '让结果自己说话',
    '先做最小可行，再做最美版本'
  ],
  syncing: [
    '同步中：把今天锁进云里',
    '备份不是仪式，是安全感',
    '写入中…别断电',
    '把变更交给时间戳',
    '云端对齐：咔哒',
    '同步完成前先别乱动',
    '把未来的自己从灾难里救出来',
    '多一份备份，少一份后悔'
  ],
  error: [
    '警报响了：先别慌',
    '我闻到 bug 的味道了',
    '先复现，再谈修复',
    '把日志给我，我会说人话',
    '错误不是敌人，是线索',
    '把影响面圈起来',
    '先止血，再手术',
    '我在：马上定位根因',
    '别怕，这种我见多了',
    '报警中：让问题自己现形'
  ],
  cat: [
    '喵~',
    '咕噜咕噜…',
    '尾巴摇一摇',
    '晒太阳最开心',
    '有人来看我啦',
    '我是这个办公室的吉祥物',
    '伸个懒腰',
    '今天的罐罐准备好了吗',
    '呼噜呼噜',
    '这个位置视野最好'
  ]
};

let game, star, sofa, serverroom, areas = {}, currentState = 'idle', pendingDesiredState = null, statusText, lastFetch = 0, lastBlink = 0, lastBubble = 0, targetX = 660, targetY = 170, bubble = null, typewriterText = '', typewriterTarget = '', typewriterIndex = 0, lastTypewriter = 0, syncAnimSprite = null, catBubble = null;
let isMoving = false;
let waypoints = [];
let lastWanderAt = 0;
let coordsOverlay, coordsDisplay, coordsToggle;
let showCoords = false;
const FETCH_INTERVAL = 2000;
const BLINK_INTERVAL = 2500;
const BUBBLE_INTERVAL = 8000;
const CAT_BUBBLE_INTERVAL = 18000;
let lastCatBubble = 0;
const TYPEWRITER_DELAY = 50;
let agents = {}; // agentId -> sprite/container
let lastAgentsFetch = 0;
const AGENTS_FETCH_INTERVAL = 2500;

// agent 颜色配置
const AGENT_COLORS = {
  star: 0xffd700,
  npc1: 0x00aaff,
  agent_nika: 0xff69b4,
  default: 0x94a3b8
};

// agent 名字颜色
const NAME_TAG_COLORS = {
  approved: 0x22c55e,
  pending: 0xf59e0b,
  rejected: 0xef4444,
  offline: 0x64748b,
  default: 0x1f2937
};

// breakroom / writing / error 区域的 agent 分布位置（多 agent 时错开）
const AREA_POSITIONS = {
  breakroom: [
    { x: 620, y: 180 },
    { x: 560, y: 220 },
    { x: 680, y: 210 }
  ],
  writing: [
    { x: 760, y: 320 },
    { x: 830, y: 280 },
    { x: 690, y: 350 }
  ],
  error: [
    { x: 180, y: 260 },
    { x: 120, y: 220 },
    { x: 240, y: 230 }
  ]
};

let areaPositionCounters = { breakroom: 0, writing: 0, error: 0 };


// 状态控制栏函数（用于测试）
function setState(state, detail) {
  fetch('/set_state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, detail })
  }).then(() => fetchStatus());
}

// 初始化：先检测 WebP 支持，再启动游戏
async function initGame() {
  try {
    supportsWebP = await checkWebPSupport();
  } catch (e) {
    try {
      supportsWebP = await checkWebPSupportFallback();
    } catch (e2) {
      supportsWebP = false;
    }
  }

  console.log('WebP 支持:', supportsWebP);
  new Phaser.Game(config);
}

function preload() {
  loadingOverlay = document.getElementById('loading-overlay');
  loadingProgressBar = document.getElementById('loading-progress-bar');
  loadingText = document.getElementById('loading-text');
  loadingProgressContainer = document.getElementById('loading-progress-container');

  // 从 LAYOUT 读取总资源数量（避免 magic number）
  totalAssets = LAYOUT.totalAssets || 15;
  loadedAssets = 0;

  this.load.on('filecomplete', () => {
    updateLoadingProgress();
  });

  this.load.on('complete', () => {
    hideLoadingOverlay();
  });

  this.load.image('office_bg', '/static/office_bg_small' + (supportsWebP ? '.webp' : '.png') + '?v={{VERSION_TIMESTAMP}}');
  this.load.spritesheet('star_idle', '/static/star-idle-spritesheet' + getExt('star-idle-spritesheet.png'), { frameWidth: 128, frameHeight: 128 });
  this.load.spritesheet('star_researching', '/static/star-researching-spritesheet' + getExt('star-researching-spritesheet.png'), { frameWidth: 128, frameHeight: 105 });

  this.load.image('sofa_idle', '/static/sofa-idle' + getExt('sofa-idle.png'));
  this.load.spritesheet('sofa_busy', '/static/sofa-busy-spritesheet' + getExt('sofa-busy-spritesheet.png'), { frameWidth: 256, frameHeight: 256 });

  this.load.spritesheet('plants', '/static/plants-spritesheet' + getExt('plants-spritesheet.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('posters', '/static/posters-spritesheet' + getExt('posters-spritesheet.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('coffee_machine', '/static/coffee-machine-spritesheet' + getExt('coffee-machine-spritesheet.png'), { frameWidth: 230, frameHeight: 230 });
  this.load.spritesheet('serverroom', '/static/serverroom-spritesheet' + getExt('serverroom-spritesheet.png'), { frameWidth: 180, frameHeight: 251 });

  this.load.spritesheet('error_bug', '/static/error-bug-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 180, frameHeight: 180 });
  this.load.spritesheet('cats', '/static/cats-spritesheet' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.image('desk', '/static/desk' + getExt('desk.png'));
  this.load.spritesheet('star_working', '/static/star-working-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 230, frameHeight: 144 });
  this.load.spritesheet('sync_anim', '/static/sync-animation-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 256, frameHeight: 256 });
  this.load.image('memo_bg', '/static/memo-bg' + (supportsWebP ? '.webp' : '.png'));

  // 新办公桌：强制 PNG（透明）
  this.load.image('desk_v2', '/static/desk-v2.png');
  this.load.spritesheet('flowers', '/static/flowers-spritesheet' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 65, frameHeight: 65 });
}

function create() {
  game = this;
  this.add.image(640, 360, 'office_bg');

  // === 沙发（来自 LAYOUT）===
  sofa = this.add.sprite(
    LAYOUT.furniture.sofa.x,
    LAYOUT.furniture.sofa.y,
    'sofa_busy'
  ).setOrigin(LAYOUT.furniture.sofa.origin.x, LAYOUT.furniture.sofa.origin.y);
  sofa.setDepth(LAYOUT.furniture.sofa.depth);

  this.anims.create({
    key: 'sofa_busy',
    frames: this.anims.generateFrameNumbers('sofa_busy', { start: 0, end: 47 }),
    frameRate: 12,
    repeat: -1
  });

  areas = LAYOUT.areas;

  this.anims.create({
    key: 'star_idle',
    frames: this.anims.generateFrameNumbers('star_idle', { start: 0, end: 29 }),
    frameRate: 12,
    repeat: -1
  });
  this.anims.create({
    key: 'star_researching',
    frames: this.anims.generateFrameNumbers('star_researching', { start: 0, end: 95 }),
    frameRate: 12,
    repeat: -1
  });

  star = game.physics
```

### Core Architecture Module: `electron-shell/standalone-assets/layout.js`
```
// Star Office UI - 布局与层级配置
// 所有坐标、depth、资源路径统一管理在这里
// 避免 magic numbers，降低改错风险

// 核心规则：
// - 透明资源（如办公桌）强制 .png，不透明优先 .webp
// - 层级：低 → sofa(10) → starWorking(900) → desk(1000) → flower(1100)

const LAYOUT = {
  // === 游戏画布 ===
  game: {
    width: 1280,
    height: 720
  },

  // === 各区域坐标 ===
  areas: {
    door:        { x: 640, y: 550 },
    writing:     { x: 320, y: 360 },
    researching: { x: 320, y: 360 },
    error:       { x: 1066, y: 180 },
    breakroom:   { x: 640, y: 360 }
  },

  // === 装饰与家具：坐标 + 原点 + depth ===
  furniture: {
    // 沙发
    sofa: {
      x: 670,
      y: 144,
      origin: { x: 0, y: 0 },
      depth: 10
    },

    // 新办公桌（透明 PNG 强制）
    desk: {
      x: 218,
      y: 417,
      origin: { x: 0.5, y: 0.5 },
      depth: 1000
    },

    // 桌上花盆
    flower: {
      x: 310,
      y: 390,
      origin: { x: 0.5, y: 0.5 },
      depth: 1100,
      scale: 0.8
    },

    // Star 在桌前工作（在 desk 下面）
    starWorking: {
      x: 217,
      y: 333,
      origin: { x: 0.5, y: 0.5 },
      depth: 900,
      scale: 1.32
    },

    // 植物们
    plants: [
      { x: 565, y: 178, depth: 5 },
      { x: 230, y: 185, depth: 5 },
      { x: 977, y: 496, depth: 5 }
    ],

    // 海报
    poster: {
      x: 252,
      y: 66,
      depth: 4
    },

    // 咖啡机
    coffeeMachine: {
      x: 659,
      y: 397,
      origin: { x: 0.5, y: 0.5 },
      depth: 99
    },

    // 服务器区
    serverroom: {
      x: 1021,
      y: 142,
      origin: { x: 0.5, y: 0.5 },
      depth: 2
    },

    // 错误 bug
    errorBug: {
      x: 1007,
      y: 221,
      origin: { x: 0.5, y: 0.5 },
      depth: 50,
      scale: 0.9,
      pingPong: { leftX: 1007, rightX: 1111, speed: 0.6 }
    },

    // 同步动画
    syncAnim: {
      x: 1157,
      y: 592,
      origin: { x: 0.5, y: 0.5 },
      depth: 40
    },

    // 小猫
    cat: {
      x: 94,
      y: 557,
      origin: { x: 0.5, y: 0.5 },
      depth: 2000
    }
  },

  // === 牌匾 ===
  plaque: {
    x: 640,
    y: 720 - 36,
    width: 420,
    height: 44
  },

  // === 资源加载规则：哪些强制用 PNG（透明资源） ===
  forcePng: {
    desk_v2: true // 新办公桌必须透明，强制 PNG
  },

  // === 总资源数量（用于加载进度条） ===
  totalAssets: 15
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #121** (2026-08-07): **feat: painel de telemetria do consumidor Noctua (só-leitura, Issue #21)**
  *Symptoms*: ## Painel de telemetria do consumidor Noctua (Star Office UI, só-leitura)  Fork de `ringhyacinth/Star-Office-UI` (branch `master`). Lê o `status.json` produzido pelo NoctuaControlPlane e exibe o estado do consumidor.  ### O que faz - `backend/app.py`: `GET /api/noctua-audit-status` lê `NOCTUA_AUDIT_STATUS_PATH`   (default `data/noctua_audit_status.json`) e deriva cor:   - verde: último poll ≤ 30s   - amarelo: 30–60s, ou erro de ciclo transitório   - vermelho: > 60s (heartbeat perdido), erro, ou estado `stopped`   - cinza: arquivo ausente (nunca iniciado) - `frontend/noctua-consumer-panel.js` + widget em `index.html` /   `electron-standalone.html`: painel fixo, poll a cada 20s, cores.  ### O que NÃO faz (limites explícitos) - Não inicia, para nem controla o processo Noctua. Fonte de verdade única   continua sendo o processo Noctua; este repo é apenas leitor. - Não instala serviço; não altera lógica operacional do Star Office UI.  ### Validação - Smoke local PASS: todas as cores + endpoint HTTP contra o status.json   real do consumidor (cor `green`, head `133efba5`, último ACK `t_b4bcd62c`). - `backend/test_noctua_status.py` + `backend/smoke_status.py`.  Parte de uma implementação de dois repositórios isolados (Noctua produz o status; Star Office UI exibe). Sem merge automático.

- **Issue #120** (2026-07-28): **feat: add Hermes status integration v1.1.0**
  *Symptoms*: 增加 Hermes CLI / Gateway 状态 Hook 增加 Hermes Desktop 状态 Plugin 增加 Star Office UI 后端状态桥接 增加安装说明与自动化测试

- **Issue #109** (2026-04-12): **由谷歌api 生成主题的功能我改成使用百炼万象去做**
  *Symptoms*: 因为都知道谷歌api 都需要特殊网络，所以我在本地修改了代码，使用了 百炼万象的Qwen-Image-2.0 API，代码不完美，但是可用 。如图  <img width="1460" height="570" alt="Image" src="https://github.com/user-attachments/assets/aef37907-6fd0-4481-b55c-59ef52ce9df3" />  我属于抛砖引玉， 你可以在完美一下。 ` #!/usr/bin/env python3 """Wan2.6 Image Generate - CLI for Star Office UI background generation.  Uses Alibaba's Wan2.6 / Qwen-Image-2.0 (via DashScope) to generate images.  Expected interface (compatible with Star Office UI backend):   python wan_image_generate.py \     --prompt "..." \     --out-dir /tmp/xxx \     --cleanup \     [--aspect-ratio 16:9] \     [--reference-image /path/to/ref.webp]  Environment:   DASHSCOPE_API_KEY  - DashScope API key (required) """  import argparse import json import os import sys import tempfile import requests from pathlib import Path   def main():     parser = argparse.ArgumentParser(description="Generate image via Wan2.6/Qwen-Image-2.0 (DashScope)")     parser.add_argument("--prompt", required=True, help="Generation prompt")     parser.add_argument("--model", default="", help="Model name (ignored, uses qwen-image-2.0)")     parser.add_argument("--out-dir", required=True, help="Output directory")     parser.add_argument("--cleanup", action="store_true", help="(ignored, kept for compat)")     parser.add_argument("--aspect-ratio", default="", help="Aspect ratio hint (e.g. 16:9)")     parser.add_argument("--reference-image", default="", help="Reference image path (ignored for now)")     args = parser.parse_args()      

- **Issue #103** (2026-03-29): **fix: sync main agent state to agents-state.json**
  *Symptoms*: ## Problem  Both `set_state.py` and the `/set_state` API endpoint only update `state.json`, but the multi-agent view reads the main agent's state from `agents-state.json`. This means state changes made via `set_state.py` or the API are invisible in the UI.  ## Solution  Added `_sync_main_agent_state()` to both paths: - **set_state.py**: After saving state.json, syncs the main agent entry in agents-state.json - **app.py**: After the `/set_state` endpoint saves state.json, also updates the main agent in agents-state.json  Both use the existing `state_to_area()` mapping (breakroom/writing/error) for correct area placement.  ## Reproduce  ```bash # Before fix: set state via API curl -X POST http://127.0.0.1:19000/set_state -H 'Content-Type: application/json' -d '{"state":"writing","detail":"test"}'  # Check agents: main agent still shows old state curl http://127.0.0.1:19000/agents | jq '.[] | select(.isMain)'  # After fix: both files stay in sync automatically ```

- **Issue #100** (2026-06-04): **fix(join): make self-leave use stable agent identity**
  *Symptoms*: ## Summary\n- persist the joined agent identity in the join page so leave requests can use a stable identifier\n- require a matching joinKey for self-service leave requests while keeping owner-triggered removals working\n- add backend regression coverage for the self-leave and owner-leave flows\n\n## Verification\n- python -m unittest backend/tests/test_leave_agent_auth.py -v

- **Issue #99** (2026-06-04): **fix(frontend): render invite pages with runtime office info**
  *Symptoms*: ## Summary\n- render the join/invite pages with the runtime office name instead of a hardcoded brand\n- build the invite/join links from the current request host so self-hosted deployments show the correct URL\n- add regression coverage to prevent office.example.com placeholders from leaking into the rendered pages\n\n## Verification\n- python -m unittest backend/tests/test_dynamic_pages.py -v

- **Issue #98** (2026-06-04): **fix(backend): require auth for admin asset actions**
  *Symptoms*: ## Summary\n- require asset-editor auth before approving or rejecting guest agents\n- require auth before enumerating editable frontend assets\n- add backend regression coverage for the protected routes\n\n## Verification\n- python -m unittest backend/tests/test_admin_auth.py -v

- **Issue #92** (2026-04-01): **你是不是被腾讯抄袭了！？**
  *Symptoms*: <img width="1355" height="843" alt="Image" src="https://github.com/user-attachments/assets/6c5f04ec-cf35-48e8-8314-815053c04e62" />
  **Post-Mortem & Fix Analysis**:
  > 非常像抄袭
  > 我第一眼还以为是合作😅
  > 布局一模一样哈 

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

### Incident Patch 1: `dffc8689` (2026-03-10)
**Commit Message**: Merge pull request #79 from hanshou101/fix/load-dotenv-run-sh

fix: load .env in backend/run.sh



---

### Incident Patch 2: `c0b13ab0` (2026-03-10)
**Commit Message**: docs: add Python 3.10+ minimum version requirement (fixes #77)

**File**: `README.en.md` (modified, +3/-1)
```diff
@@ -29,12 +29,14 @@ Your lobster will automatically clone the repo, install dependencies, start the
 
 ### Option 2: 30-second manual setup
 
+> **Requires Python 3.10+** (the codebase uses `X | Y` union type syntax, which is not supported on 3.9 or earlier)
+
 ```bash
 # 1) Clone the repo
 git clone https://github.com/ringhyacinth/Star-Office-UI.git
 cd Star-Office-UI
 
-# 2) Install dependencies
+# 2) Install dependencies (Python 3.10+ required)
 python3 -m pip install -r backend/requirements.txt
 
 # 3) Initialize state file (first run)
```

**File**: `README.ja.md` (modified, +3/-1)
```diff
@@ -29,12 +29,14 @@ https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
 
 ### 方法 2：30 秒手動セットアップ
 
+> **Python 3.10+ が必要です**（コードベースは `X | Y` ユニオン型構文を使用しており、3.9 以前のバージョンではサポートされていません）
+
 ```bash
 # 1) リポジトリをクローン
 git clone https://github.com/ringhyacinth/Star-Office-UI.git
 cd Star-Office-UI
 
-# 2) 依存関係をインストール
+# 2) 依存関係をインストール（Python 3.10+ が必要）
 python3 -m pip install -r backend/requirements.txt
 
 # 3) 状態ファイルを初期化（初回のみ）
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -29,12 +29,14 @@ https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
 
 ### 方式二：30 秒手动部署
 
+> **环境要求：Python 3.10+**（代码使用了 `X | Y` union type 语法，不支持 3.9 及更低版本）
+
 ```bash
 # 1) 下载仓库
 git clone https://github.com/ringhyacinth/Star-Office-UI.git
 cd Star-Office-UI
 
-# 2) 安装依赖
+# 2) 安装依赖（需要 Python 3.10+）
 python3 -m pip install -r backend/requirements.txt
 
 # 3) 准备状态文件（首次）
```

---

### Incident Patch 3: `171051af` (2026-03-07)
**Commit Message**: docs: revert to Chinese as default README

阿文说得对：作为中国开发者要自信一点 💪

**File**: `README.en.md` (added, +292/-0)
```diff
@@ -0,0 +1,292 @@
+# Star Office UI
+
+🌐 Language: [中文](./README.md) | **English** | [日本語](./README.ja.md)
+
+![Star Office UI Cover](docs/screenshots/readme-cover-2.jpg)
+
+**A pixel-art AI office dashboard** — visualize your AI assistant's work status in real time, so you can see at a glance who's doing what, what they did yesterday, and whether they're online.
+
+Supports multi-agent collaboration, trilingual UI (CN/EN/JP), AI-powered room design, and desktop pet mode.
+Best experienced with [OpenClaw](https://github.com/openclaw/openclaw), but also works standalone as a status dashboard.
+
+> This project was co-created by **[Ring Hyacinth](https://x.com/ring_hyacinth)** and **[Simon Lee](https://x.com/simonxxoo)**, and is continuously maintained and improved together with community contributors ([@Zhaohan-Wang](https://github.com/Zhaohan-Wang), [@Jah-yee](https://github.com/Jah-yee), [@liaoandi](https://github.com/liaoandi)).
+> Issues and PRs are welcome — thank you to everyone who contributes.
+
+---
+
+## ✨ Quick Start
+
+### Option 1: Let your lobster deploy it (recommended for OpenClaw users)
+
+If you're using [OpenClaw](https://github.com/openclaw/openclaw), just send this to your lobster:
+
+```text
+Please follow this SKILL.md to deploy Star Office UI for me:
+https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
+```
+
+Your lobster will automatically clone the repo, install dependencies, start the backend, configure status sync, and send you the access URL.
+
+### Option 2: 30-second manual setup
+
+```bash
+# 1) Clone the repo
+git clone https://github.com/ringhyacinth/Star-Office-UI.git
+cd Star-Office-UI
+
+# 2) Install dependencies
+python3 -m pip install -r backend/requirements.txt
+
+# 3) Initialize state file (first run)
+cp state.sample.json state.json
+
+# 4) Start the backend
+cd backend
+python3 app.py
+```
+
+Open **http://127.0.0.1:19000** and try switching states:
+
+```bash
+python3 set_state.py writing "Organizing documents"
+python3 set_state.py error "Found an issue, debugging"
+python3 set_state.py idle "Standing by"
+```
+
+![Star Office UI Preview](docs/screenshots/readme-cover-1.jpg)
+
+---
+
+## 🤔 Who is this for?
+
+### Users with OpenClaw / an AI Agent
+This is the **full experience**. Your agent automatically switches status as it works, and the pixel character walks to the corresponding office area in real time — just open the page and see what your AI is doing right now.
+
+### Users without OpenClaw
+You can still deploy and use it. You can:
+- Use `set_state.py` or the API to push status manually or via scripts
+- Use it as a pixel-art personal status page or remote work dashboard
+- Connect any system that can send HTTP requests to drive the status
+
+---
+
+## 📋 Features
+
+1. **Status Visualization** — 6 states (`idle` / `writing` / `researching` / `executing` / `syncing` / `error`) mapped to different office areas with animated sprites and speech bubbles
+2. **Yesterday Memo** — Automatically reads the latest daily log from `memory/*.md`, sanitizes it, and displays it as a "Yesterday Memo" card
+3. **Multi-Agent Collaboration** — Invite other agents to join your office via join keys and see everyone's status in real time
+4. **Trilingual UI** — Switch between Chinese, English, and Japanese with one click; all UI text, bubbles, and loading messages update instantly
+5. **Custom Art Assets** — Manage characters, scenes, and decorations through the sidebar; dynamic frame sync prevents flickering
+6. **AI-Powered Room Design** — Connect your own Gemini API to generate new office backgrounds; core features work fine without an API
+7. **Mobile-Friendly** — Open on your phone for a quick status check on the go
+8. **Security Hardening** — Sidebar password protection, weak-password blocking in production, hardened session cookies
+9. **Flexible Public Access** — Use Cloudflare Tunnel for instant public access, or bring your own domain / reverse proxy
+10. **Desktop Pet Mode** — Optional Tauri desktop wrapper that turns the office into a transparent desktop widget (see below)
+
+---
+
+## 🚀 Detailed Setup Guide
+
+### 1) Install dependencies
+
+```bash
+cd Star-Office-UI
+python3 -m pip install -r backend/requirements.txt
+```
+
+### 2) Initialize state file
+
+```bash
+cp state.sample.json state.json
+```
+
+### 3) Start the backend
+
+```bash
+cd backend
+python3 app.py
+```
+
+Open `http://127.0.0.1:19000`
+
+> ✅ For local development you can start with the defaults; in production, copy `.env.example` to `.env` and set strong random values for `FLASK_SECRET_KEY` and `ASSET_DRAWER_PASS` to avoid weak passwords and session leaks.
+
+### 4) Switch states
+
+```bash
+python3 set_state.py writing "Organizing documents"
+python3 set_state.py syncing "Syncing progress"
+python3 set_state.py error "Found an issue, debugging"
+python3 set_state.py idle "Standing by"
+```
+
+### 5) Public access (optional)
+
+```bash
+cloudflared tunnel --url http://127.0
```

**File**: `README.ja.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Star Office UI
 
-🌐 Language: [中文](./README.zh.md) | [English](./README.md) | **日本語**
+🌐 Language: [中文](./README.md) | [English](./README.en.md) | **日本語**
 
 ![Star Office UI カバー](docs/screenshots/readme-cover-2.jpg)
 
```

**File**: `README.md` (modified, +133/-132)
```diff
@@ -1,288 +1,289 @@
 # Star Office UI
 
-🌐 Language: [中文](./README.zh.md) | **English** | [日本語](./README.ja.md)
+🌐 Language: **中文** | [English](./README.en.md) | [日本語](./README.ja.md)
 
-![Star Office UI Cover](docs/screenshots/readme-cover-2.jpg)
+![Star Office UI 封面](docs/screenshots/readme-cover-2.jpg)
 
-**A pixel-art AI office dashboard** — visualize your AI assistant's work status in real time, so you can see at a glance who's doing what, what they did yesterday, and whether they're online.
+**一个像素风格的 AI 办公室看板** —— 把 AI 助手的工作状态实时可视化，让你直观看到"谁在做什么、昨天做了什么、现在是否在线"。
 
-Supports multi-agent collaboration, trilingual UI (CN/EN/JP), AI-powered room design, and desktop pet mode.
-Best experienced with [OpenClaw](https://github.com/openclaw/openclaw), but also works standalone as a status dashboard.
+支持多 Agent 协作、中英日三语、AI 生图装修、桌面宠物模式。
+与 [OpenClaw](https://github.com/openclaw/openclaw) 深度集成时体验最佳，也可以独立部署作为状态看板使用。
 
-> This project was co-created by **[Ring Hyacinth](https://x.com/ring_hyacinth)** and **[Simon Lee](https://x.com/simonxxoo)**, and is continuously maintained and improved together with community contributors ([@Zhaohan-Wang](https://github.com/Zhaohan-Wang), [@Jah-yee](https://github.com/Jah-yee), [@liaoandi](https://github.com/liaoandi)).
-> Issues and PRs are welcome — thank you to everyone who contributes.
+> 本项目由 **[Ring Hyacinth](https://x.com/ring_hyacinth)** 与 **[Simon Lee](https://x.com/simonxxoo)** 共同创建（co-created project），并与社区开发者（[@Zhaohan-Wang](https://github.com/Zhaohan-Wang)、[@Jah-yee](https://github.com/Jah-yee)、[@liaoandi](https://github.com/liaoandi)）一起持续维护和共建。
+> 欢迎提交 Issue 和 PR，也感谢每一位贡献者的支持。
 
 ---
 
-## ✨ Quick Start
+## ✨ 快速体验
 
-### Option 1: Let your lobster deploy it (recommended for OpenClaw users)
+### 方式一：让龙虾帮你部署（推荐给 OpenClaw 用户）
 
-If you're using [OpenClaw](https://github.com/openclaw/openclaw), just send this to your lobster:
+如果你正在使用 [OpenClaw](https://github.com/openclaw/openclaw)，直接把下面这句话发给你的龙虾：
 
 ```text
-Please follow this SKILL.md to deploy Star Office UI for me:
+请按照这个 SKILL.md 帮我完成 Star Office UI 的部署：
 https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
 ```
 
-Your lobster will automatically clone the repo, install dependencies, start the backend, configure status sync, and send you the access URL.
+龙虾会自动完成 clone、安装依赖、启动后端、配置状态同步，并把访问地址发给你。
 
-### Option 2: 30-second manual setup
+### 方式二：30 秒手动部署
 
 ```bash
-# 1) Clone the repo
+# 1) 下载仓库
 git clone https://github.com/ringhyacinth/Star-Office-UI.git
 cd Star-Office-UI
 
-# 2) Install dependencies
+# 2) 安装依赖
 python3 -m pip install -r backend/requirements.txt
 
-# 3) Initialize state file (first run)
+# 3) 准备状态文件（首次）
 cp state.sample.json state.json
 
-# 4) Start the backend
+# 4) 启动后端
 cd backend
 python3 app.py
 ```
 
-Open **http://127.0.0.1:19000** and try switching states:
+打开 **http://127.0.0.1:19000**，然后试试切状态：
 
 ```bash
-python3 set_state.py writing "Organizing documents"
-python3 set_state.py error "Found an issue, debugging"
-python3 set_state.py idle "Standing by"
+python3 set_state.py writing "正在整理文档"
+python3 set_state.py error "发现问题，排查中"
+python3 set_state.py idle "待命中"
 ```
 
-![Star Office UI Preview](docs/screenshots/readme-cover-1.jpg)
+![Star Office UI 预览](docs/screenshots/readme-cover-1.jpg)
 
 ---
 
-## 🤔 Who is this for?
+## 🤔 适合谁用？
 
-### Users with OpenClaw / an AI Agent
-This is the **full experience**. Your agent automatically switches status as it works, and the pixel character walks to the corresponding office area in real time — just open the page and see what your AI is doing right now.
+### 有 OpenClaw / AI Agent 的用户
+这是**完整体验**。Agent 在工作时自动切换状态，办公室里的像素角色会实时走到对应区域——你只需要打开网页，就能看到 AI 此刻在做什么。
+
+### 没有 OpenClaw 的用户
+也完全可以部署。你可以：
+- 用 `set_state.py` 或 API 手动 / 脚本推送状态
+- 把它当成一个像素风的个人状态页 / 远程办公看板
+- 接入任何能发 HTTP 请求的系统来驱动状态
 
-### Users without OpenClaw
-You can still deploy and use it. You can:
-- Use `set_state.py` or the API to push status manually or via scripts
-- Use it as a pixel-art personal status page or remote work dashboard
-- Connect any system that can send HTTP requests to drive the status
 
 ---
 
-## 📋 Features
+## 📋 功能一览
 
-1. **Status Visualization** — 6 states (`idle` / `writing` / `researching` / `executing` / `syncing` / `error`) mapped to different office areas with animated sprites and speech bubbles
-2. **Yesterday Memo** — Automatically reads the latest daily log from `memory/*.md`, sanitizes it, and displays it as a "Yesterday Memo" card
-3. **Multi-Agent Collaboration** — Invite other agents to join your office via join keys and see everyone's status in real time
-4. **Trilingual UI** — Switch between Chinese, English, and Japanese with one click; all UI text, bubbles, and loading messages update instantly
-5. **Custom Art Assets** — Manage characters, scenes, and decorations through the sidebar; dynamic frame sync prevents flickering
-6. **AI-Powered Room Design** — Connect your own Gemini API to generate new office backgrounds; core featu
```

**File**: `README.zh.md` (removed, +0/-293)
```diff
@@ -1,293 +0,0 @@
-# Star Office UI
-
-🌐 Language: **中文** | [English](./README.md) | [日本語](./README.ja.md)
-
-![Star Office UI 封面](docs/screenshots/readme-cover-2.jpg)
-
-**一个像素风格的 AI 办公室看板** —— 把 AI 助手的工作状态实时可视化，让你直观看到"谁在做什么、昨天做了什么、现在是否在线"。
-
-支持多 Agent 协作、中英日三语、AI 生图装修、桌面宠物模式。
-与 [OpenClaw](https://github.com/openclaw/openclaw) 深度集成时体验最佳，也可以独立部署作为状态看板使用。
-
-> 本项目由 **[Ring Hyacinth](https://x.com/ring_hyacinth)** 与 **[Simon Lee](https://x.com/simonxxoo)** 共同创建（co-created project），并与社区开发者（[@Zhaohan-Wang](https://github.com/Zhaohan-Wang)、[@Jah-yee](https://github.com/Jah-yee)、[@liaoandi](https://github.com/liaoandi)）一起持续维护和共建。
-> 欢迎提交 Issue 和 PR，也感谢每一位贡献者的支持。
-
----
-
-## ✨ 快速体验
-
-### 方式一：让龙虾帮你部署（推荐给 OpenClaw 用户）
-
-如果你正在使用 [OpenClaw](https://github.com/openclaw/openclaw)，直接把下面这句话发给你的龙虾：
-
-```text
-请按照这个 SKILL.md 帮我完成 Star Office UI 的部署：
-https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
-```
-
-龙虾会自动完成 clone、安装依赖、启动后端、配置状态同步，并把访问地址发给你。
-
-### 方式二：30 秒手动部署
-
-```bash
-# 1) 下载仓库
-git clone https://github.com/ringhyacinth/Star-Office-UI.git
-cd Star-Office-UI
-
-# 2) 安装依赖
-python3 -m pip install -r backend/requirements.txt
-
-# 3) 准备状态文件（首次）
-cp state.sample.json state.json
-
-# 4) 启动后端
-cd backend
-python3 app.py
-```
-
-打开 **http://127.0.0.1:19000**，然后试试切状态：
-
-```bash
-python3 set_state.py writing "正在整理文档"
-python3 set_state.py error "发现问题，排查中"
-python3 set_state.py idle "待命中"
-```
-
-![Star Office UI 预览](docs/screenshots/readme-cover-1.jpg)
-
----
-
-## 🤔 适合谁用？
-
-### 有 OpenClaw / AI Agent 的用户
-这是**完整体验**。Agent 在工作时自动切换状态，办公室里的像素角色会实时走到对应区域——你只需要打开网页，就能看到 AI 此刻在做什么。
-
-### 没有 OpenClaw 的用户
-也完全可以部署。你可以：
-- 用 `set_state.py` 或 API 手动 / 脚本推送状态
-- 把它当成一个像素风的个人状态页 / 远程办公看板
-- 接入任何能发 HTTP 请求的系统来驱动状态
-
-
----
-
-## 📋 功能一览
-
-1. **状态可视化** —— 6 种状态（`idle` / `writing` / `researching` / `executing` / `syncing` / `error`）自动映射到办公室不同区域，动画 + 气泡实时展示
-2. **昨日小记** —— 自动从 `memory/*.md` 读取最近一天的工作记录，脱敏后展示为"昨日小记"卡片
-3. **多 Agent 协作** —— 通过 join key 邀请其他 Agent 加入你的办公室，实时查看多人状态
-4. **中英日三语** —— CN / EN / JP 一键切换，界面文案、气泡、加载提示全部联动
-5. **美术资产自定义** —— 侧边栏管理角色 / 场景 / 装饰素材，支持动态帧同步，避免闪烁
-6. **AI 生图装修** —— 接入 Gemini API，用 AI 给办公室换背景；不接入 API 也能正常使用核心功能
-7. **移动端适配** —— 手机直接打开即可查看，适合外出时快速瞄一眼
-8. **安全加固** —— 侧边栏密码保护、生产环境弱密码拦截、Session Cookie 加固
-9. **灵活公网访问** —— 推荐 Cloudflare Tunnel 一键公网化，也可用自有域名 / 反向代理
-10. **桌面宠物版** —— 可选的 Tauri 桌面封装，把办公室变成透明窗口的桌面宠物（见下方说明）
-
----
-
-## 🚀 详细部署指南
-
-### 1) 安装依赖
-
-```bash
-cd Star-Office-UI
-python3 -m pip install -r backend/requirements.txt
-```
-
-### 2) 初始化状态文件
-
-```bash
-cp state.sample.json state.json
-```
-
-### 3) 启动后端
-
-```bash
-cd backend
-python3 app.py
-```
-
-打开 `http://127.0.0.1:19000`
-
-> ✅ 首次部署可以先保留默认配置；在生产环境中，请复制 `.env.example` 为 `.env` 并设置强随机的 `FLASK_SECRET_KEY` 与 `ASSET_DRAWER_PASS`，避免弱密码和会话泄露。
-
-### 4) 切换状态
-
-```bash
-python3 set_state.py writing "正在整理文档"
-python3 set_state.py syncing "同步进度中"
-python3 set_state.py error "发现问题，排查中"
-python3 set_state.py idle "待命中"
-```
-
-### 5) 公网访问（可选）
-
-```bash
-cloudflared tunnel --url http://127.0.0.1:19000
-```
-
-拿到 `https://xxx.trycloudflare.com` 链接即可分享。
-
-### 6) 验证安装（可选）
-
-```bash
-python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
-```
-
-所有检查显示 `OK` 即表示部署成功。
-
----
-
-## 🦞 OpenClaw 深度集成
-
-> 以下内容面向 [OpenClaw](https://github.com/openclaw/openclaw) 用户。如果你不使用 OpenClaw，可以跳过这一节。
-
-### 状态自动同步
-
-在你的 `SOUL.md`（或 Agent 规则文件）中加入以下规则，让 Agent 自觉维护状态：
-
-```markdown
-## Star Office 状态同步规则
-- 接到任务时：先执行 `python3 set_state.py <状态> "<描述>"` 再开始工作
-- 完成任务后：执行 `python3 set_state.py idle "待命中"` 再回复
-```
-
-**6 种状态 → 3 个区域的映射：**
-
-| 状态 | 办公室区域 | 触发场景 |
-|------|-----------|---------|
-| `idle` | 🛋 休息区（沙发） | 待命 / 任务完成 |
-| `writing` | 💻 工作区（办公桌） | 写代码 / 写文档 |
-| `researching` | 💻 工作区 | 搜索 / 调研 |
-| `executing` | 💻 工作区 | 执行命令 / 跑任务 |
-| `syncing` | 💻 工作区 | 同步数据 / 推送 |
-| `error` | 🐛 Bug 区 | 报错 / 异常排查 |
-
-### 邀请其他 Agent 加入办公室
-
-**Step 1：准备 join key**
-
-首次启动后端时，如果当前目录下不存在 `join-keys.json`，服务会自动根据 `join-keys.sample.json` 生成一个运行时的 `join-keys.json`（内含示例 key，例如 `ocj_example_team_01`）。你可以在生成后的 `join-keys.json` 中自行添加、修改或删除 key，每个 key 默认支持最多 3 人同时在线。
-
-**Step 2：让访客 Agent 运行推送脚本**
-
-访客只需下载 `office-agent-push.py`，填写 3 个变量即可：
-
-```python
-JOIN_KEY = "ocj_starteam02"          # 你分配的 key
-AGENT_NAME = "小明的龙虾"            # 显示名称
-OFFICE_URL = "https://office.hyacinth.im"  # 你的办公室地址
-```
-
-```bash
-python3 office-agent-push.py
-```
-
-脚本会自动加入办公室并每 15 秒推送一次状态。访客会出现在看板上，根据状态自动走到对应区域。
-
-**Step 3（可选）：访客安装 Skill**
-
-访客也可以把 `frontend/join-office-skill.md` 作为 Skill 使用，Agent 会自动完成配置和推送。
-
-> 详细的访客接入说明见 [`frontend/join-office-skill.md`](./frontend/join-office-skill.md)
-
----
-
-## 📡 常用 API
-
-| 端点 | 说明 |
-|------|------|
-| `GET /health` | 健康检查 |
-| `GET /status` | 获取主 Agent 状态 |
-| `POST /set_state` | 设置主 Agent 状态 |
-| `GET /agents` | 获取多 Agent 列表 |
-| `POST /join-agent` | 访客加入办公室 |
-| `POST /agent-push` | 访客推送状态 |
-| `POST /leave-agent` | 访客离开 |
-| `GET /yesterday-memo` | 获取昨日小记 |
-| `GET /config/gemini` | 获取 Gemini API 配置 |
-| `
```

---

### Incident Patch 4: `61a5d5f1` (2026-03-06)
**Commit Message**: fix: correct OpenClaw URL to GitHub repo

**File**: `README.en.md` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@
 **A pixel-art AI office dashboard** — visualize your AI assistant's work status in real time, so you can see at a glance who's doing what, what they did yesterday, and whether they're online.
 
 Supports multi-agent collaboration, trilingual UI (CN/EN/JP), AI-powered room design, and desktop pet mode.
-Best experienced with [OpenClaw](https://openclaw.com), but also works standalone as a status dashboard.
+Best experienced with [OpenClaw](https://github.com/openclaw/openclaw), but also works standalone as a status dashboard.
 
 > This project was co-created by **[Ring Hyacinth](https://x.com/ring_hyacinth)** and **[Simon Lee](https://x.com/simonxxoo)**, and is continuously maintained and improved together with community contributors.
 > Issues and PRs are welcome — thank you to everyone who contributes.
@@ -18,7 +18,7 @@ Best experienced with [OpenClaw](https://openclaw.com), but also works standalon
 
 ### Option 1: Let your lobster deploy it (recommended for OpenClaw users)
 
-If you're using [OpenClaw](https://openclaw.com), just send this to your lobster:
+If you're using [OpenClaw](https://github.com/openclaw/openclaw), just send this to your lobster:
 
 ```text
 Please follow this SKILL.md to deploy Star Office UI for me:
@@ -140,7 +140,7 @@ If all checks report `OK`, your deployment is good to go.
 
 ## 🦞 OpenClaw Deep Integration
 
-> The following section is for [OpenClaw](https://openclaw.com) users. If you don't use OpenClaw, feel free to skip this.
+> The following section is for [OpenClaw](https://github.com/openclaw/openclaw) users. If you don't use OpenClaw, feel free to skip this.
 
 ### Automatic Status Sync
 
```

**File**: `README.ja.md` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@
 **ピクセルアート風 AI オフィスダッシュボード** —— AI アシスタントの作業状態をリアルタイムで可視化し、「誰が何をしているか」「昨日何をしたか」「今オンラインか」を直感的に把握できます。
 
 マルチ Agent 協調、中英日 3 言語、AI 画像生成による模様替え、デスクトップペットモードに対応。
-[OpenClaw](https://openclaw.com) との統合で最高の体験が得られますが、単体でもステータスダッシュボードとして利用可能です。
+[OpenClaw](https://github.com/openclaw/openclaw) との統合で最高の体験が得られますが、単体でもステータスダッシュボードとして利用可能です。
 
 > 本プロジェクトは **[Ring Hyacinth](https://x.com/ring_hyacinth)** と **[Simon Lee](https://x.com/simonxxoo)** の共同制作（co-created project）であり、コミュニティの開発者とともに継続的にメンテナンス・改善を行っています。
 > Issue や PR を歓迎します。貢献してくださるすべての方に感謝いたします。
@@ -18,7 +18,7 @@
 
 ### 方法 1：ロブスターにデプロイしてもらう（OpenClaw ユーザー向け）
 
-[OpenClaw](https://openclaw.com) をご利用中なら、以下のメッセージをロブスターに送るだけ：
+[OpenClaw](https://github.com/openclaw/openclaw) をご利用中なら、以下のメッセージをロブスターに送るだけ：
 
 ```text
 この SKILL.md に従って Star Office UI をデプロイしてください：
@@ -140,7 +140,7 @@ python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
 
 ## 🦞 OpenClaw 連携
 
-> 以下は [OpenClaw](https://openclaw.com) ユーザー向けの内容です。OpenClaw を使用していない場合はスキップしてください。
+> 以下は [OpenClaw](https://github.com/openclaw/openclaw) ユーザー向けの内容です。OpenClaw を使用していない場合はスキップしてください。
 
 ### ステータス自動同期
 
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@
 **一个像素风格的 AI 办公室看板** —— 把 AI 助手的工作状态实时可视化，让你直观看到"谁在做什么、昨天做了什么、现在是否在线"。
 
 支持多 Agent 协作、中英日三语、AI 生图装修、桌面宠物模式。
-与 [OpenClaw](https://openclaw.com) 深度集成时体验最佳，也可以独立部署作为状态看板使用。
+与 [OpenClaw](https://github.com/openclaw/openclaw) 深度集成时体验最佳，也可以独立部署作为状态看板使用。
 
 > 本项目由 **[Ring Hyacinth](https://x.com/ring_hyacinth)** 与 **[Simon Lee](https://x.com/simonxxoo)** 共同创建（co-created project），并与社区开发者一起持续维护和共建。
 > 欢迎提交 Issue 和 PR，也感谢每一位贡献者的支持。
@@ -18,7 +18,7 @@
 
 ### 方式一：让龙虾帮你部署（推荐给 OpenClaw 用户）
 
-如果你正在使用 [OpenClaw](https://openclaw.com)，直接把下面这句话发给你的龙虾：
+如果你正在使用 [OpenClaw](https://github.com/openclaw/openclaw)，直接把下面这句话发给你的龙虾：
 
 ```text
 请按照这个 SKILL.md 帮我完成 Star Office UI 的部署：
@@ -141,7 +141,7 @@ python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
 
 ## 🦞 OpenClaw 深度集成
 
-> 以下内容面向 [OpenClaw](https://openclaw.com) 用户。如果你不使用 OpenClaw，可以跳过这一节。
+> 以下内容面向 [OpenClaw](https://github.com/openclaw/openclaw) 用户。如果你不使用 OpenClaw，可以跳过这一节。
 
 ### 状态自动同步
 
```

---

### Incident Patch 5: `e7e08b54` (2026-03-06)
**Commit Message**: docs: restructure README — dual quick-start paths, audience section, community co-maintenance

**File**: `README.en.md` (modified, +43/-34)
```diff
@@ -4,13 +4,30 @@
 
 ![Star Office UI Cover](docs/screenshots/readme-cover-2.jpg)
 
-**A pixel office dashboard for multi-agent collaboration** — visualize your AI assistants' (OpenClaw / "lobster") work status in real time, so you can see at a glance who's doing what, what they did yesterday, and whether they're online.
+**A pixel-art AI office dashboard** — visualize your AI assistant's work status in real time, so you can see at a glance who's doing what, what they did yesterday, and whether they're online.
 
-> This is a **co-created project by Ring Hyacinth and Simon Lee**.
+Supports multi-agent collaboration, trilingual UI (CN/EN/JP), AI-powered room design, and desktop pet mode.
+Best experienced with [OpenClaw](https://openclaw.com), but also works standalone as a status dashboard.
+
+> This project was co-created by **[Ring Hyacinth](https://x.com/ring_hyacinth)** and **[Simon Lee](https://x.com/simonxxoo)**, and is continuously maintained and improved together with community contributors.
+> Issues and PRs are welcome — thank you to everyone who contributes.
 
 ---
 
-## ✨ 30-Second Quick Start
+## ✨ Quick Start
+
+### Option 1: Let your lobster deploy it (recommended for OpenClaw users)
+
+If you're using [OpenClaw](https://openclaw.com), just send this to your lobster:
+
+```text
+Please follow this SKILL.md to deploy Star Office UI for me:
+https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
+```
+
+Your lobster will automatically clone the repo, install dependencies, start the backend, configure status sync, and send you the access URL.
+
+### Option 2: 30-second manual setup
 
 ```bash
 # 1) Clone the repo
@@ -40,22 +57,35 @@ python3 set_state.py idle "Standing by"
 
 ---
 
+## 🤔 Who is this for?
+
+### Users with OpenClaw / an AI Agent
+This is the **full experience**. Your agent automatically switches status as it works, and the pixel character walks to the corresponding office area in real time — just open the page and see what your AI is doing right now.
+
+### Users without OpenClaw
+You can still deploy and use it. You can:
+- Use `set_state.py` or the API to push status manually or via scripts
+- Use it as a pixel-art personal status page or remote work dashboard
+- Connect any system that can send HTTP requests to drive the status
+
+---
+
 ## 📋 Features
 
 1. **Status Visualization** — 6 states (`idle` / `writing` / `researching` / `executing` / `syncing` / `error`) mapped to different office areas with animated sprites and speech bubbles
 2. **Yesterday Memo** — Automatically reads the latest daily log from `memory/*.md`, sanitizes it, and displays it as a "Yesterday Memo" card
 3. **Multi-Agent Collaboration** — Invite other agents to join your office via join keys and see everyone's status in real time
 4. **Trilingual UI** — Switch between Chinese, English, and Japanese with one click; all UI text, bubbles, and loading messages update instantly
 5. **Custom Art Assets** — Manage characters, scenes, and decorations through the sidebar; dynamic frame sync prevents flickering
-6. **AI-Powered Room Design** — Connect your own Gemini API to generate new office backgrounds (recommended: `nanobanana-pro` / `nanobanana-2`); core features work fine without an API
+6. **AI-Powered Room Design** — Connect your own Gemini API to generate new office backgrounds; core features work fine without an API
 7. **Mobile-Friendly** — Open on your phone for a quick status check on the go
 8. **Security Hardening** — Sidebar password protection, weak-password blocking in production, hardened session cookies
 9. **Flexible Public Access** — Use Cloudflare Tunnel for instant public access, or bring your own domain / reverse proxy
 10. **Desktop Pet Mode** — Optional Tauri desktop wrapper that turns the office into a transparent desktop widget (see below)
 
 ---
 
-## 🚀 Getting Started
+## 🚀 Detailed Setup Guide
 
 ### 1) Install dependencies
 
@@ -100,33 +130,21 @@ Share the `https://xxx.trycloudflare.com` link with anyone.
 
 ### 6) Verify your installation (optional)
 
-While the backend is running, you can run a lightweight smoke test to confirm that the core endpoints are healthy:
-
 ```bash
 python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
 ```
 
-If all checks report `OK`, your Star Office UI service is wired up correctly for basic status flows.
+If all checks report `OK`, your deployment is good to go.
 
 ---
 
-## 🦞 For OpenClaw Users
-
-> If you're using [OpenClaw](https://openclaw.com), these three steps deeply integrate your lobster with the pixel office.
-
-### 4.1 Install the Skill
-
-Copy `SKILL.md` from the repo into your OpenClaw workspace:
-
-```bash
-cp SKILL.md ~/.openclaw/workspace/SKILL.md
-```
+## 🦞 OpenClaw Deep Integration
 
-Your lobster will read it automatically and follow the deployment guide — starting the backend, setting up a public link, and prompting you for passwords and API keys.
+> The following section is for [OpenClaw](https://ope
```

**File**: `README.ja.md` (modified, +47/-38)
```diff
@@ -4,13 +4,30 @@
 
 ![Star Office UI カバー](docs/screenshots/readme-cover-2.jpg)
 
-**マルチ Agent 協調のためのピクセル・オフィス・ダッシュボード** —— AI アシスタント（OpenClaw / ロブスター）の作業状態をリアルタイムで可視化し、「誰が何をしているか」「昨日何をしたか」「今オンラインか」を直感的に把握できます。
+**ピクセルアート風 AI オフィスダッシュボード** —— AI アシスタントの作業状態をリアルタイムで可視化し、「誰が何をしているか」「昨日何をしたか」「今オンラインか」を直感的に把握できます。
 
-> 本プロジェクトは **Ring Hyacinth と Simon Lee の共同制作（co-created project）** です。
+マルチ Agent 協調、中英日 3 言語、AI 画像生成による模様替え、デスクトップペットモードに対応。
+[OpenClaw](https://openclaw.com) との統合で最高の体験が得られますが、単体でもステータスダッシュボードとして利用可能です。
+
+> 本プロジェクトは **[Ring Hyacinth](https://x.com/ring_hyacinth)** と **[Simon Lee](https://x.com/simonxxoo)** の共同制作（co-created project）であり、コミュニティの開発者とともに継続的にメンテナンス・改善を行っています。
+> Issue や PR を歓迎します。貢献してくださるすべての方に感謝いたします。
 
 ---
 
-## ✨ 30 秒クイックスタート
+## ✨ クイックスタート
+
+### 方法 1：ロブスターにデプロイしてもらう（OpenClaw ユーザー向け）
+
+[OpenClaw](https://openclaw.com) をご利用中なら、以下のメッセージをロブスターに送るだけ：
+
+```text
+この SKILL.md に従って Star Office UI をデプロイしてください：
+https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
+```
+
+ロブスターが自動的にリポジトリのクローン、依存関係のインストール、バックエンドの起動、ステータス同期の設定を行い、アクセス URL をお知らせします。
+
+### 方法 2：30 秒手動セットアップ
 
 ```bash
 # 1) リポジトリをクローン
@@ -30,8 +47,6 @@ python3 app.py
 
 **http://127.0.0.1:19000** を開き、状態を切り替えてみましょう：
 
-> ✅ ローカル開発ではデフォルト設定のままで構いませんが、本番環境では `.env.example` を `.env` にコピーし、`FLASK_SECRET_KEY` と `ASSET_DRAWER_PASS` に十分な長さのランダム値を設定することをおすすめします（弱いパスワードやセッション漏洩を防ぐため）。
-
 ```bash
 python3 set_state.py writing "ドキュメント整理中"
 python3 set_state.py error "問題を検出、調査中"
@@ -42,32 +57,35 @@ python3 set_state.py idle "待機中"
 
 ---
 
-## ✅ インストール確認（任意）
+## 🤔 誰に向いている？
 
-バックエンドが起動している状態で、簡単な smoke test を実行して主要エンドポイントが正常かどうかを確認できます：
+### OpenClaw / AI Agent をお持ちの方
+これが**フル体験**です。Agent が作業中に自動でステータスを切り替え、ピクセルキャラクターがリアルタイムで対応エリアに移動します。ページを開くだけで、AI が今何をしているかがわかります。
 
-```bash
-python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
-```
+### OpenClaw をお持ちでない方
+デプロイして使うことも全く問題ありません：
+- `set_state.py` や API で手動 / スクリプトからステータスを更新
+- ピクセルアート風の個人ステータスページやリモートワークダッシュボードとして利用
+- HTTP リクエストを送れるシステムなら何でもステータスを駆動可能
 
-すべてのチェックが `OK` と表示されれば、Star Office UI の基本的なステータスフローが正しく動作していることを意味します。
+---
 
 ## 📋 機能一覧
 
 1. **ステータス可視化** —— 6 種類の状態（`idle` / `writing` / `researching` / `executing` / `syncing` / `error`）がオフィスの各エリアに自動マッピングされ、アニメーションと吹き出しでリアルタイム表示
 2. **昨日メモ** —— `memory/*.md` から直近の作業記録を自動取得し、匿名化して「昨日メモ」カードとして表示
-3. **マルチ Agent 協調** —— join key で他のロブスターをオフィスに招待し、全員のステータスをリアルタイム確認
+3. **マルチ Agent 協調** —— join key で他の Agent をオフィスに招待し、全員のステータスをリアルタイム確認
 4. **中英日 3 言語対応** —— CN / EN / JP をワンクリック切替、UI テキスト・吹き出し・ローディング表示すべてが連動
 5. **アート資産カスタマイズ** —— サイドバーからキャラクター / 背景 / 装飾素材を管理、動的フレーム同期でちらつき防止
-6. **AI 画像生成による模様替え** —— 自前の Gemini API を接続してオフィス背景を AI 生成（推奨: `nanobanana-pro` / `nanobanana-2`）; API 未接続でもコア機能は利用可能
+6. **AI 画像生成による模様替え** —— Gemini API を接続してオフィス背景を AI 生成; API 未接続でもコア機能は利用可能
 7. **モバイル対応** —— スマホからそのまま閲覧可能、外出先からのクイックチェックに最適
 8. **セキュリティ強化** —— サイドバーのパスワード保護、本番環境での弱パスワード拒否、Session Cookie 強化
 9. **柔軟な公開アクセス** —— Cloudflare Tunnel でワンステップ公開、独自ドメイン / リバースプロキシにも対応
 10. **デスクトップペット版** —— オプションの Tauri デスクトップラッパーで、オフィスを透明ウィンドウのデスクトップペットに（下記参照）
 
 ---
 
-## 🚀 セットアップ
+## 🚀 詳細セットアップガイド
 
 ### 1) 依存関係インストール
 
@@ -91,6 +109,8 @@ python3 app.py
 
 `http://127.0.0.1:19000` を開く
 
+> ✅ ローカル開発ではデフォルト設定のままで構いませんが、本番環境では `.env.example` を `.env` にコピーし、`FLASK_SECRET_KEY` と `ASSET_DRAWER_PASS` に十分な長さのランダム値を設定してください。
+
 ### 4) ステータス切替
 
 ```bash
@@ -108,25 +128,23 @@ cloudflared tunnel --url http://127.0.0.1:19000
 
 `https://xxx.trycloudflare.com` のリンクを共有するだけで OK。
 
----
+### 6) インストール確認（任意）
 
-## 🦞 OpenClaw ユーザー向け
+```bash
+python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
+```
 
-> [OpenClaw](https://openclaw.com) をご利用中なら、以下の 3 ステップでロブスターとピクセルオフィスを深く連携できます。
+すべてのチェックが `OK` と表示されればデプロイ成功です。
 
-### 4.1 Skill をインストール
+---
 
-リポジトリ内の `SKILL.md` を OpenClaw のワークスペースにコピーします：
+## 🦞 OpenClaw 連携
 
-```bash
-cp SKILL.md ~/.openclaw/workspace/SKILL.md
-```
+> 以下は [OpenClaw](https://openclaw.com) ユーザー向けの内容です。OpenClaw を使用していない場合はスキップしてください。
 
-ロブスターが自動的に読み込み、デプロイガイドに沿ってバックエンド起動・公開リンク設定・パスワードと API の案内まで進めてくれます。
+### ステータス自動同期
 
-### 4.2 ステータス自動同期
-
-`SOUL.md`（またはエージェント設定ファイル）に以下のルールを追加すると、ロブスターがステータスを自動で更新します：
+`SOUL.md`（またはエージェント設定ファイル）に以下のルールを追加すると、Agent がステータスを自動で更新します：
 
 ```markdown
 ## Star Office ステータス同期ルール
@@ -145,7 +163,7 @@ cp SKILL.md ~/.openclaw/workspace/SKILL.md
 | `syncing` | 💻 ワークエリア | データ同期 / プッシュ |
 | `error` | 🐛 バグコーナー | エラー / デバッグ |
 
-### 4.3 他のロブスターをオフィスに招待
+### 他の Agent をオフィスに招待
 
 **Step 1：join key を準備**
 
@@ -165,11 +183,11 @@ OFFICE_URL = "https://office.hyacinth.im"  # あなたのオフィス URL
 python3 office-agent-push.py
 ```
 
-スクリプトが自動で参加し、15 秒ごとにステータスをプッシュします。ゲストのロブスターがダッシュボードに表示され、状態に応じて該当エリアに移動します。
+スクリプトが自動で参加し、15 秒ごとにステータスをプッシュします。ゲストがダッシュボードに表示され、状態に応じて該当エリアに移動します。
 
 **Step 3（任意）：ゲストも Skill をインストール**
 
-ゲストは `frontend/join-office-skill.md` を Skill として使うこともできます。ロブスターが設定とプッシュを自動で行います。
+ゲストは `frontend/join-office-skill.md` を Skill として使うこともできます。Agent が設定とプッシュを自動で行います。
 
 > 詳しいゲスト参加手順は [`frontend/join-office-skill.
```

**File**: `README.md` (modified, +47/-37)
```diff
@@ -4,13 +4,30 @@
 
 ![Star Office UI 封面](docs/screenshots/readme-cover-2.jpg)
 
-**一个面向多 Agent 协作的像素办公室看板** —— 把 AI 助手（OpenClaw / 龙虾）的工作状态实时可视化，让你直观看到"谁在做什么、昨天做了什么、现在是否在线"。
+**一个像素风格的 AI 办公室看板** —— 把 AI 助手的工作状态实时可视化，让你直观看到"谁在做什么、昨天做了什么、现在是否在线"。
 
-> 本项目为 **Ring Hyacinth 与 Simon Lee 的共同项目（co-created project）**。
+支持多 Agent 协作、中英日三语、AI 生图装修、桌面宠物模式。
+与 [OpenClaw](https://openclaw.com) 深度集成时体验最佳，也可以独立部署作为状态看板使用。
+
+> 本项目由 **[Ring Hyacinth](https://x.com/ring_hyacinth)** 与 **[Simon Lee](https://x.com/simonxxoo)** 共同创建（co-created project），并与社区开发者一起持续维护和共建。
+> 欢迎提交 Issue 和 PR，也感谢每一位贡献者的支持。
 
 ---
 
-## ✨ 30 秒快速体验
+## ✨ 快速体验
+
+### 方式一：让龙虾帮你部署（推荐给 OpenClaw 用户）
+
+如果你正在使用 [OpenClaw](https://openclaw.com)，直接把下面这句话发给你的龙虾：
+
+```text
+请按照这个 SKILL.md 帮我完成 Star Office UI 的部署：
+https://github.com/ringhyacinth/Star-Office-UI/blob/master/SKILL.md
+```
+
+龙虾会自动完成 clone、安装依赖、启动后端、配置状态同步，并把访问地址发给你。
+
+### 方式二：30 秒手动部署
 
 ```bash
 # 1) 下载仓库
@@ -38,24 +55,38 @@ python3 set_state.py idle "待命中"
 
 ![Star Office UI 预览](docs/screenshots/readme-cover-1.jpg)
 
+---
+
+## 🤔 适合谁用？
+
+### 有 OpenClaw / AI Agent 的用户
+这是**完整体验**。Agent 在工作时自动切换状态，办公室里的像素角色会实时走到对应区域——你只需要打开网页，就能看到 AI 此刻在做什么。
+
+### 没有 OpenClaw 的用户
+也完全可以部署。你可以：
+- 用 `set_state.py` 或 API 手动 / 脚本推送状态
+- 把它当成一个像素风的个人状态页 / 远程办公看板
+- 接入任何能发 HTTP 请求的系统来驱动状态
+
+
 ---
 
 ## 📋 功能一览
 
 1. **状态可视化** —— 6 种状态（`idle` / `writing` / `researching` / `executing` / `syncing` / `error`）自动映射到办公室不同区域，动画 + 气泡实时展示
 2. **昨日小记** —— 自动从 `memory/*.md` 读取最近一天的工作记录，脱敏后展示为"昨日小记"卡片
-3. **多 Agent 协作** —— 通过 join key 邀请其他龙虾加入你的办公室，实时查看多人状态
+3. **多 Agent 协作** —— 通过 join key 邀请其他 Agent 加入你的办公室，实时查看多人状态
 4. **中英日三语** —— CN / EN / JP 一键切换，界面文案、气泡、加载提示全部联动
 5. **美术资产自定义** —— 侧边栏管理角色 / 场景 / 装饰素材，支持动态帧同步，避免闪烁
-6. **AI 生图装修** —— 接入自有 Gemini API，用 AI 给办公室换背景（推荐 `nanobanana-pro` / `nanobanana-2`）；不接入 API 也能正常使用核心功能
+6. **AI 生图装修** —— 接入 Gemini API，用 AI 给办公室换背景；不接入 API 也能正常使用核心功能
 7. **移动端适配** —— 手机直接打开即可查看，适合外出时快速瞄一眼
 8. **安全加固** —— 侧边栏密码保护、生产环境弱密码拦截、Session Cookie 加固
 9. **灵活公网访问** —— 推荐 Cloudflare Tunnel 一键公网化，也可用自有域名 / 反向代理
 10. **桌面宠物版** —— 可选的 Tauri 桌面封装，把办公室变成透明窗口的桌面宠物（见下方说明）
 
 ---
 
-## 🚀 快速开始
+## 🚀 详细部署指南
 
 ### 1) 安装依赖
 
@@ -79,7 +110,7 @@ python3 app.py
 
 打开 `http://127.0.0.1:19000`
 
-> ✅ 如果你是首次部署，可以先保留默认的开发配置；在生产环境中，请复制 `.env.example` 为 `.env` 并设置强随机的 `FLASK_SECRET_KEY` 与 `ASSET_DRAWER_PASS`，避免弱密码和会话泄露。
+> ✅ 首次部署可以先保留默认配置；在生产环境中，请复制 `.env.example` 为 `.env` 并设置强随机的 `FLASK_SECRET_KEY` 与 `ASSET_DRAWER_PASS`，避免弱密码和会话泄露。
 
 ### 4) 切换状态
 
@@ -100,33 +131,21 @@ cloudflared tunnel --url http://127.0.0.1:19000
 
 ### 6) 验证安装（可选）
 
-在后端运行中时，可以执行一次轻量级的 smoke test，确认核心接口是否正常工作：
-
 ```bash
 python3 scripts/smoke_test.py --base-url http://127.0.0.1:19000
 ```
 
-如果所有检查都显示 `OK`，说明后端路由和基础状态流转已经就绪。
+所有检查显示 `OK` 即表示部署成功。
 
 ---
 
-## 🦞 给 OpenClaw 用户
-
-> 如果你正在使用 [OpenClaw](https://openclaw.com)，以下三步可以让你的龙虾和像素办公室深度联动。
-
-### 4.1 安装 Skill
+## 🦞 OpenClaw 深度集成
 
-把仓库中的 `SKILL.md` 复制到你的 OpenClaw workspace 目录：
-
-```bash
-cp SKILL.md ~/.openclaw/workspace/SKILL.md
-```
+> 以下内容面向 [OpenClaw](https://openclaw.com) 用户。如果你不使用 OpenClaw，可以跳过这一节。
 
-龙虾会自动读取并按照指引完成部署——包括启动后端、配置公网链接、提醒你设置密码和 API。
+### 状态自动同步
 
-### 4.2 状态自动同步
-
-在你的 `SOUL.md`（或 Agent 规则文件）中加入以下规则，让龙虾自觉维护状态：
+在你的 `SOUL.md`（或 Agent 规则文件）中加入以下规则，让 Agent 自觉维护状态：
 
 ```markdown
 ## Star Office 状态同步规则
@@ -145,13 +164,13 @@ cp SKILL.md ~/.openclaw/workspace/SKILL.md
 | `syncing` | 💻 工作区 | 同步数据 / 推送 |
 | `error` | 🐛 Bug 区 | 报错 / 异常排查 |
 
-### 4.3 邀请其他龙虾加入你的办公室
+### 邀请其他 Agent 加入办公室
 
 **Step 1：准备 join key**
 
 首次启动后端时，如果当前目录下不存在 `join-keys.json`，服务会自动根据 `join-keys.sample.json` 生成一个运行时的 `join-keys.json`（内含示例 key，例如 `ocj_example_team_01`）。你可以在生成后的 `join-keys.json` 中自行添加、修改或删除 key，每个 key 默认支持最多 3 人同时在线。
 
-**Step 2：让访客龙虾运行推送脚本**
+**Step 2：让访客 Agent 运行推送脚本**
 
 访客只需下载 `office-agent-push.py`，填写 3 个变量即可：
 
@@ -165,11 +184,11 @@ OFFICE_URL = "https://office.hyacinth.im"  # 你的办公室地址
 python3 office-agent-push.py
 ```
 
-脚本会自动加入办公室并每 15 秒推送一次状态。访客龙虾会出现在看板上，根据状态自动走到对应区域。
+脚本会自动加入办公室并每 15 秒推送一次状态。访客会出现在看板上，根据状态自动走到对应区域。
 
 **Step 3（可选）：访客安装 Skill**
 
-访客也可以把 `frontend/join-office-skill.md` 作为 Skill 使用，龙虾会自动完成配置和推送。
+访客也可以把 `frontend/join-office-skill.md` 作为 Skill 使用，Agent 会自动完成配置和推送。
 
 > 详细的访客接入说明见 [`frontend/join-office-skill.md`](./frontend/join-office-skill.md)
 
@@ -229,15 +248,6 @@ npm run dev
 
 ---
 
-## 👥 项目作者
-
-本项目由 **Ring Hyacinth** 与 **Simon Lee** 共同创作与维护。
-
-- **Ring Hyacinth** — [@ring_hyacinth](https://x.com/ring_hyacinth)
-- **Simon Lee** — [@simonxxoo](https://x.com/simonxxoo)
-
----
-
 ## 📝 更新日志
 
 | 日期 | 概要 | 详情 |
```

---

### Incident Patch 6: `e5f3fc92` (2026-03-06)
**Commit Message**: Merge pull request #64 from liaoandi/fix/guest-agent-overlap

fix: prevent guest agents from overlapping when >3 in same area

**File**: `frontend/game.js` (modified, +26/-11)
```diff
@@ -225,22 +225,35 @@ const AREA_POSITIONS = {
   breakroom: [
     { x: 620, y: 180 },
     { x: 560, y: 220 },
-    { x: 680, y: 210 }
+    { x: 680, y: 210 },
+    { x: 540, y: 170 },
+    { x: 700, y: 240 },
+    { x: 600, y: 250 },
+    { x: 650, y: 160 },
+    { x: 580, y: 200 }
   ],
   writing: [
     { x: 760, y: 320 },
     { x: 830, y: 280 },
-    { x: 690, y: 350 }
+    { x: 690, y: 350 },
+    { x: 770, y: 260 },
+    { x: 850, y: 340 },
+    { x: 720, y: 300 },
+    { x: 800, y: 370 },
+    { x: 750, y: 240 }
   ],
   error: [
     { x: 180, y: 260 },
     { x: 120, y: 220 },
-    { x: 240, y: 230 }
+    { x: 240, y: 230 },
+    { x: 160, y: 200 },
+    { x: 220, y: 270 },
+    { x: 140, y: 250 },
+    { x: 200, y: 210 },
+    { x: 260, y: 260 }
   ]
 };
 
-let areaPositionCounters = { breakroom: 0, writing: 0, error: 0 };
-
 
 // 状态控制栏函数（用于测试）
 function setState(state, detail) {
@@ -904,9 +917,12 @@ function fetchAgents() {
     .then(data => {
       if (!Array.isArray(data)) return;
       // 重置位置计数器
-      areaPositionCounters = { breakroom: 0, writing: 0, error: 0 };
-      // 处理每个 agent
+      // 按区域分配不同位置索引，避免重叠
+      const areaSlots = { breakroom: 0, writing: 0, error: 0 };
       for (let agent of data) {
+        const area = agent.area || 'breakroom';
+        agent._slotIndex = areaSlots[area] || 0;
+        areaSlots[area] = (areaSlots[area] || 0) + 1;
         renderAgent(agent);
       }
       // 移除不再存在的 agent
@@ -925,10 +941,9 @@ function fetchAgents() {
     });
 }
 
-function getAreaPosition(area) {
+function getAreaPosition(area, slotIndex) {
   const positions = AREA_POSITIONS[area] || AREA_POSITIONS.breakroom;
-  const idx = areaPositionCounters[area] || 0;
-  areaPositionCounters[area] = (idx + 1) % positions.length;
+  const idx = (slotIndex || 0) % positions.length;
   return positions[idx];
 }
 
@@ -940,7 +955,7 @@ function renderAgent(agent) {
   const isMain = !!agent.isMain;
 
   // 获取这个 agent 在区域里的位置
-  const pos = getAreaPosition(area);
+  const pos = getAreaPosition(area, agent._slotIndex || 0);
   const baseX = pos.x;
   const baseY = pos.y;
 
```

**File**: `frontend/index.html` (modified, +18/-3)
```diff
@@ -3493,17 +3493,32 @@
                 breakroom: [
                     { x: 511, y: 262 },
                     { x: 841, y: 621 },
-                    { x: 690, y: 470 }
+                    { x: 690, y: 470 },
+                    { x: 600, y: 340 },
+                    { x: 770, y: 540 },
+                    { x: 550, y: 420 },
+                    { x: 720, y: 310 },
+                    { x: 650, y: 580 }
                 ],
                 writing: [
                     { x: 190, y: 526 },
                     { x: 380, y: 683 },
-                    { x: 300, y: 610 }
+                    { x: 300, y: 610 },
+                    { x: 240, y: 570 },
+                    { x: 350, y: 640 },
+                    { x: 160, y: 600 },
+                    { x: 420, y: 560 },
+                    { x: 280, y: 660 }
                 ],
                 error: [
                     { x: 932, y: 275 },
                     { x: 1109, y: 327 },
-                    { x: 1020, y: 305 }
+                    { x: 1020, y: 305 },
+                    { x: 960, y: 340 },
+                    { x: 1070, y: 280 },
+                    { x: 990, y: 260 },
+                    { x: 1050, y: 350 },
+                    { x: 940, y: 310 }
                 ]
             };
             const arr = map[area] || map.breakroom;
```

---

### Incident Patch 7: `6da1dc96` (2026-03-06)
**Commit Message**: fix: prevent guest agents from overlapping when >3 in same area

- Expand area positions from 3 to 8 per zone (breakroom/writing/error)
  in both game.js (AREA_POSITIONS) and index.html (getAreaPoint)
- Replace global areaPositionCounters with per-render slot index
  (_slotIndex) to ensure consistent position assignment across
  poll cycles

Previously, agents in the same area would overlap after the 3rd one
because positions cycled via modulo. The counter-based approach also
caused misalignment when existing agents skipped position increments.

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `frontend/game.js` (modified, +26/-11)
```diff
@@ -225,22 +225,35 @@ const AREA_POSITIONS = {
   breakroom: [
     { x: 620, y: 180 },
     { x: 560, y: 220 },
-    { x: 680, y: 210 }
+    { x: 680, y: 210 },
+    { x: 540, y: 170 },
+    { x: 700, y: 240 },
+    { x: 600, y: 250 },
+    { x: 650, y: 160 },
+    { x: 580, y: 200 }
   ],
   writing: [
     { x: 760, y: 320 },
     { x: 830, y: 280 },
-    { x: 690, y: 350 }
+    { x: 690, y: 350 },
+    { x: 770, y: 260 },
+    { x: 850, y: 340 },
+    { x: 720, y: 300 },
+    { x: 800, y: 370 },
+    { x: 750, y: 240 }
   ],
   error: [
     { x: 180, y: 260 },
     { x: 120, y: 220 },
-    { x: 240, y: 230 }
+    { x: 240, y: 230 },
+    { x: 160, y: 200 },
+    { x: 220, y: 270 },
+    { x: 140, y: 250 },
+    { x: 200, y: 210 },
+    { x: 260, y: 260 }
   ]
 };
 
-let areaPositionCounters = { breakroom: 0, writing: 0, error: 0 };
-
 
 // 状态控制栏函数（用于测试）
 function setState(state, detail) {
@@ -904,9 +917,12 @@ function fetchAgents() {
     .then(data => {
       if (!Array.isArray(data)) return;
       // 重置位置计数器
-      areaPositionCounters = { breakroom: 0, writing: 0, error: 0 };
-      // 处理每个 agent
+      // 按区域分配不同位置索引，避免重叠
+      const areaSlots = { breakroom: 0, writing: 0, error: 0 };
       for (let agent of data) {
+        const area = agent.area || 'breakroom';
+        agent._slotIndex = areaSlots[area] || 0;
+        areaSlots[area] = (areaSlots[area] || 0) + 1;
         renderAgent(agent);
       }
       // 移除不再存在的 agent
@@ -925,10 +941,9 @@ function fetchAgents() {
     });
 }
 
-function getAreaPosition(area) {
+function getAreaPosition(area, slotIndex) {
   const positions = AREA_POSITIONS[area] || AREA_POSITIONS.breakroom;
-  const idx = areaPositionCounters[area] || 0;
-  areaPositionCounters[area] = (idx + 1) % positions.length;
+  const idx = (slotIndex || 0) % positions.length;
   return positions[idx];
 }
 
@@ -940,7 +955,7 @@ function renderAgent(agent) {
   const isMain = !!agent.isMain;
 
   // 获取这个 agent 在区域里的位置
-  const pos = getAreaPosition(area);
+  const pos = getAreaPosition(area, agent._slotIndex || 0);
   const baseX = pos.x;
   const baseY = pos.y;
 
```

**File**: `frontend/index.html` (modified, +18/-3)
```diff
@@ -3492,17 +3492,32 @@
                 breakroom: [
                     { x: 511, y: 262 },
                     { x: 841, y: 621 },
-                    { x: 690, y: 470 }
+                    { x: 690, y: 470 },
+                    { x: 600, y: 340 },
+                    { x: 770, y: 540 },
+                    { x: 550, y: 420 },
+                    { x: 720, y: 310 },
+                    { x: 650, y: 580 }
                 ],
                 writing: [
                     { x: 190, y: 526 },
                     { x: 380, y: 683 },
-                    { x: 300, y: 610 }
+                    { x: 300, y: 610 },
+                    { x: 240, y: 570 },
+                    { x: 350, y: 640 },
+                    { x: 160, y: 600 },
+                    { x: 420, y: 560 },
+                    { x: 280, y: 660 }
                 ],
                 error: [
                     { x: 932, y: 275 },
                     { x: 1109, y: 327 },
-                    { x: 1020, y: 305 }
+                    { x: 1020, y: 305 },
+                    { x: 960, y: 340 },
+                    { x: 1070, y: 280 },
+                    { x: 990, y: 260 },
+                    { x: 1050, y: 350 },
+                    { x: 940, y: 310 }
                 ]
             };
             const arr = map[area] || map.breakroom;
```

---

### Incident Patch 8: `8ac5b51c` (2026-03-06)
**Commit Message**: Merge pull request #61 from Jah-yee/fix/issue-54-unauthorized

fix: avoid 401 Unauthorized on first page load (fixes #54)

**File**: `frontend/electron-standalone.html` (modified, +11/-1)
```diff
@@ -4182,6 +4182,7 @@
                 bindAssetDrawerBackgroundDeselect();
                 await ensureGeminiConfigLoaded();
                 if (assetDrawerAuthed) {
+                    await applySavedPositionOverrides();
                     await refreshAssetDrawerList();
                     await renderHomeFavorites(false);
                     bindDrawerFileMeta();
@@ -4212,6 +4213,7 @@
                 bindAssetDrawerBackgroundDeselect();
                 await ensureGeminiConfigLoaded();
                 if (assetDrawerAuthed) {
+                    await applySavedPositionOverrides();
                     await refreshAssetDrawerList();
                     await renderHomeFavorites(false);
                     bindDrawerFileMeta();
@@ -4835,7 +4837,15 @@
             
             // 启动 Phaser 游戏
             new Phaser.Game(config);
-            setTimeout(() => { applySavedPositionOverrides(); }, 600);
+            setTimeout(async () => {
+                try {
+                    const authRes = await fetch('/assets/auth/status', { cache: 'no-store' });
+                    const authData = await authRes.json();
+                    if (authData && authData.ok && authData.authed) {
+                        await applySavedPositionOverrides();
+                    }
+                } catch (e) {}
+            }, 600);
         }
 
         function preload() {
```

**File**: `frontend/index.html` (modified, +10/-1)
```diff
@@ -3300,6 +3300,7 @@
                 bindAssetDrawerBackgroundDeselect();
                 await ensureGeminiConfigLoaded();
                 if (assetDrawerAuthed) {
+                    await applySavedPositionOverrides();
                     await refreshAssetDrawerList();
                     await renderHomeFavorites(false);
                     bindDrawerFileMeta();
@@ -3925,7 +3926,15 @@
                     console.warn('flowers 规格探测失败，使用默认 65x65', e);
                 }
 
-                applySavedPositionOverrides();
+                // Only fetch /assets/positions and /assets/defaults when user is authed,
+                // to avoid 401 Unauthorized on first load for new visitors (issue #54).
+                try {
+                    const authRes = await fetch('/assets/auth/status', { cache: 'no-store' });
+                    const authData = await authRes.json();
+                    if (authData && authData.ok && authData.authed) {
+                        await applySavedPositionOverrides();
+                    }
+                } catch (e) {}
             }, 600);
         }
 
```

---

### Incident Patch 9: `a139bb05` (2026-03-06)
**Commit Message**: Merge pull request #62 from Jah-yee/fix/issue-31-port-and-state-hints

fix: add startup hints for port and state source (fixes #31)

**File**: `backend/app.py` (modified, +4/-0)
```diff
@@ -2058,6 +2058,10 @@ def assets_upload():
     print("=" * 50)
     print(f"State file: {STATE_FILE}")
     print(f"Listening on: http://0.0.0.0:{backend_port}")
+    if backend_port != 18791:
+        print(f"(Port override: set STAR_BACKEND_PORT to change; current: {raw_port})")
+    else:
+        print("(Set STAR_BACKEND_PORT to use a different port, e.g. 3009)")
     mode = "production" if is_production_mode() else "development"
     print(f"Mode: {mode}")
     if is_production_mode():
```

**File**: `office-agent-push.py` (modified, +11/-0)
```diff
@@ -262,6 +262,17 @@ def do_push(local, status_data):
 def main():
     local = load_local_state()
 
+    # Startup hint for state source and URL (helps with port/state issues, e.g. issue #31)
+    if LOCAL_STATE_FILE:
+        print(f"State file: {LOCAL_STATE_FILE}")
+    else:
+        first_existing = next((p for p in DEFAULT_STATE_CANDIDATES if p and os.path.exists(p)), None)
+        if first_existing:
+            print(f"State file (auto): {first_existing}")
+        else:
+            print("State file: auto-discover (set OFFICE_LOCAL_STATE_FILE if state not found)")
+    print(f"Local status URL: {LOCAL_STATUS_URL} (set OFFICE_LOCAL_STATUS_URL if backend uses another port)")
+
     # 先确认配置是否齐全
     if not JOIN_KEY or not AGENT_NAME:
         print("❌ 请先在脚本开头填入 JOIN_KEY 和 AGENT_NAME")
```

---

### Incident Patch 10: `8a9557f3` (2026-03-06)
**Commit Message**: Merge pull request #63 from Jah-yee/fix/issue-40-set-state-docstring

docs: add SOUL.md auto-sync hint in set_state.py (fixes #40)

**File**: `set_state.py` (modified, +7/-1)
```diff
@@ -1,5 +1,11 @@
 #!/usr/bin/env python3
-"""简单的状态更新工具，用于测试 Star Office UI"""
+"""Update Star Office UI state (for testing or agent-driven sync).
+
+For automatic state sync from OpenClaw: add a rule in your agent SOUL.md or AGENTS.md:
+  Before starting a task: run `python3 set_state.py writing "doing XYZ"`.
+  After finishing: run `python3 set_state.py idle "ready"`.
+The office UI reads state from the same state.json this script writes.
+"""
 
 import json
 import os
```

---

### Incident Patch 11: `fb5efd48` (2026-03-05)
**Commit Message**: docs: add SOUL.md auto-sync hint in set_state.py (fixes #40)

Made-with: Cursor

**File**: `set_state.py` (modified, +7/-1)
```diff
@@ -1,5 +1,11 @@
 #!/usr/bin/env python3
-"""简单的状态更新工具，用于测试 Star Office UI"""
+"""Update Star Office UI state (for testing or agent-driven sync).
+
+For automatic state sync from OpenClaw: add a rule in your agent SOUL.md or AGENTS.md:
+  Before starting a task: run `python3 set_state.py writing "doing XYZ"`.
+  After finishing: run `python3 set_state.py idle "ready"`.
+The office UI reads state from the same state.json this script writes.
+"""
 
 import json
 import os
```

---

### Incident Patch 12: `51172ee2` (2026-03-05)
**Commit Message**: fix: add startup hints for port and state source (fixes #31)

- Backend: print STAR_BACKEND_PORT hint so users can change port without
  editing app.py (e.g. when 18791 is already in use).
- office-agent-push.py: print state file source and LOCAL_STATUS_URL at
  startup so users can verify path and URL when state does not update.

Made-with: Cursor

**File**: `backend/app.py` (modified, +4/-0)
```diff
@@ -2053,6 +2053,10 @@ def assets_upload():
     print("=" * 50)
     print(f"State file: {STATE_FILE}")
     print(f"Listening on: http://0.0.0.0:{backend_port}")
+    if backend_port != 18791:
+        print(f"(Port override: set STAR_BACKEND_PORT to change; current: {raw_port})")
+    else:
+        print("(Set STAR_BACKEND_PORT to use a different port, e.g. 3009)")
     mode = "production" if is_production_mode() else "development"
     print(f"Mode: {mode}")
     if is_production_mode():
```

**File**: `office-agent-push.py` (modified, +11/-0)
```diff
@@ -262,6 +262,17 @@ def do_push(local, status_data):
 def main():
     local = load_local_state()
 
+    # Startup hint for state source and URL (helps with port/state issues, e.g. issue #31)
+    if LOCAL_STATE_FILE:
+        print(f"State file: {LOCAL_STATE_FILE}")
+    else:
+        first_existing = next((p for p in DEFAULT_STATE_CANDIDATES if p and os.path.exists(p)), None)
+        if first_existing:
+            print(f"State file (auto): {first_existing}")
+        else:
+            print("State file: auto-discover (set OFFICE_LOCAL_STATE_FILE if state not found)")
+    print(f"Local status URL: {LOCAL_STATUS_URL} (set OFFICE_LOCAL_STATUS_URL if backend uses another port)")
+
     # 先确认配置是否齐全
     if not JOIN_KEY or not AGENT_NAME:
         print("❌ 请先在脚本开头填入 JOIN_KEY 和 AGENT_NAME")
```

---

### Incident Patch 13: `8569245b` (2026-03-05)
**Commit Message**: fix: avoid 401 Unauthorized on first page load (fixes #54)

- Defer applySavedPositionOverrides() until user is authed: check
  /assets/auth/status first and only call it when authed, so new
  visitors never trigger /assets/positions and /assets/defaults (which
  return 401 when not logged in).
- When opening the asset drawer and already authed, call
  applySavedPositionOverrides() so saved layout is still applied.
- Same logic in both index.html and electron-standalone.html.

Made-with: Cursor

**File**: `frontend/electron-standalone.html` (modified, +11/-1)
```diff
@@ -4182,6 +4182,7 @@
                 bindAssetDrawerBackgroundDeselect();
                 await ensureGeminiConfigLoaded();
                 if (assetDrawerAuthed) {
+                    await applySavedPositionOverrides();
                     await refreshAssetDrawerList();
                     await renderHomeFavorites(false);
                     bindDrawerFileMeta();
@@ -4212,6 +4213,7 @@
                 bindAssetDrawerBackgroundDeselect();
                 await ensureGeminiConfigLoaded();
                 if (assetDrawerAuthed) {
+                    await applySavedPositionOverrides();
                     await refreshAssetDrawerList();
                     await renderHomeFavorites(false);
                     bindDrawerFileMeta();
@@ -4835,7 +4837,15 @@
             
             // 启动 Phaser 游戏
             new Phaser.Game(config);
-            setTimeout(() => { applySavedPositionOverrides(); }, 600);
+            setTimeout(async () => {
+                try {
+                    const authRes = await fetch('/assets/auth/status', { cache: 'no-store' });
+                    const authData = await authRes.json();
+                    if (authData && authData.ok && authData.authed) {
+                        await applySavedPositionOverrides();
+                    }
+                } catch (e) {}
+            }, 600);
         }
 
         function preload() {
```

**File**: `frontend/index.html` (modified, +10/-1)
```diff
@@ -3300,6 +3300,7 @@
                 bindAssetDrawerBackgroundDeselect();
                 await ensureGeminiConfigLoaded();
                 if (assetDrawerAuthed) {
+                    await applySavedPositionOverrides();
                     await refreshAssetDrawerList();
                     await renderHomeFavorites(false);
                     bindDrawerFileMeta();
@@ -3925,7 +3926,15 @@
                     console.warn('flowers 规格探测失败，使用默认 65x65', e);
                 }
 
-                applySavedPositionOverrides();
+                // Only fetch /assets/positions and /assets/defaults when user is authed,
+                // to avoid 401 Unauthorized on first load for new visitors (issue #54).
+                try {
+                    const authRes = await fetch('/assets/auth/status', { cache: 'no-store' });
+                    const authData = await authRes.json();
+                    if (authData && authData.ok && authData.authed) {
+                        await applySavedPositionOverrides();
+                    }
+                } catch (e) {}
             }, 600);
         }
 
```

---

### Incident Patch 14: `a8900824` (2026-03-05)
**Commit Message**: docs(backend): add English docstrings to memo, store, security utils

Made-with: Cursor

**File**: `backend/memo_utils.py` (modified, +5/-9)
```diff
@@ -1,7 +1,7 @@
 #!/usr/bin/env python3
 """Memo extraction helpers for Star Office backend.
 
-P1 step: extraction without behavior change.
+Reads and sanitizes daily memo content from memory/*.md for the yesterday-memo API.
 """
 
 from __future__ import annotations
@@ -12,30 +12,26 @@
 
 
 def get_yesterday_date_str() -> str:
-    """获取昨天的日期字符串 YYYY-MM-DD"""
+    """Return yesterday's date as YYYY-MM-DD."""
     yesterday = datetime.now() - timedelta(days=1)
     return yesterday.strftime("%Y-%m-%d")
 
 
 def sanitize_content(text: str) -> str:
-    """清理内容，保护隐私"""
-    # 移除 OpenID、User ID 等
+    """Redact PII and sensitive patterns (OpenID, paths, IPs, email, phone) for safe display."""
     text = re.sub(r'ou_[a-f0-9]+', '[用户]', text)
     text = re.sub(r'user_id="[^"]+"', 'user_id="[隐藏]"', text)
-
-    # 移除 IP 地址、路径等敏感信息
     text = re.sub(r'/root/[^"\s]+', '[路径]', text)
     text = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '[IP]', text)
 
-    # 移除电话号码、邮箱等
     text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[邮箱]', text)
     text = re.sub(r'1[3-9]\d{9}', '[手机号]', text)
 
     return text
 
 
 def extract_memo_from_file(file_path: str) -> str:
-    """从 memory 文件中提取适合展示的 memo 内容（睿智风格的总结）"""
+    """Extract display-safe memo text from a memory markdown file; sanitizes and truncates with a short fallback."""
     try:
         with open(file_path, "r", encoding="utf-8") as f:
             content = f.read()
@@ -116,5 +112,5 @@ def extract_memo_from_file(file_path: str) -> str:
         return "\n".join(result).strip()
 
     except Exception as e:
-        print(f"提取 memo 失败: {e}")
+        print(f"extract_memo_from_file failed: {e}")
         return "「昨日记录加载失败」\n\n「往者不可谏，来者犹可追。」"
```

**File**: `backend/security_utils.py` (modified, +4/-1)
```diff
@@ -1,7 +1,7 @@
 #!/usr/bin/env python3
 """Security helper utilities for Star Office backend.
 
-P1 step: extraction without behavior change.
+Production detection and validation for Flask secret and asset drawer password.
 """
 
 from __future__ import annotations
@@ -10,11 +10,13 @@
 
 
 def is_production_mode() -> bool:
+    """Return True if STAR_OFFICE_ENV or FLASK_ENV is prod/production."""
     env = (os.getenv("STAR_OFFICE_ENV") or os.getenv("FLASK_ENV") or "").strip().lower()
     return env in {"prod", "production"}
 
 
 def is_strong_secret(secret: str) -> bool:
+    """Return True if secret is at least 24 chars and does not contain weak markers (e.g. change-me, dev)."""
     if not secret:
         return False
     secret = secret.strip()
@@ -26,6 +28,7 @@ def is_strong_secret(secret: str) -> bool:
 
 
 def is_strong_drawer_pass(pwd: str) -> bool:
+    """Return True if password is not default 1234 and has at least 8 characters."""
     if not pwd:
         return False
     pwd = pwd.strip()
```

**File**: `backend/store_utils.py` (modified, +14/-2)
```diff
@@ -1,7 +1,7 @@
 #!/usr/bin/env python3
 """Storage helper utilities for Star Office backend.
 
-P1 step: extraction without behavior change.
+JSON load/save for agents state, asset positions/defaults, runtime config, and join keys.
 """
 
 from __future__ import annotations
@@ -11,16 +11,19 @@
 
 
 def _load_json(path: str):
+    """Load JSON from a file; caller handles missing file or parse errors."""
     with open(path, "r", encoding="utf-8") as f:
         return json.load(f)
 
 
 def _save_json(path: str, data):
+    """Write data as JSON with UTF-8 and indent=2."""
     with open(path, "w", encoding="utf-8") as f:
         json.dump(data, f, ensure_ascii=False, indent=2)
 
 
 def load_agents_state(path: str, default_agents: list) -> list:
+    """Load agents list from path; return default_agents if file missing or invalid."""
     if os.path.exists(path):
         try:
             data = _load_json(path)
@@ -32,10 +35,12 @@ def load_agents_state(path: str, default_agents: list) -> list:
 
 
 def save_agents_state(path: str, agents: list):
+    """Persist agents list to path."""
     _save_json(path, agents)
 
 
 def load_asset_positions(path: str) -> dict:
+    """Load asset positions map from path; return {} if missing or invalid."""
     if os.path.exists(path):
         try:
             data = _load_json(path)
@@ -47,10 +52,12 @@ def load_asset_positions(path: str) -> dict:
 
 
 def save_asset_positions(path: str, data: dict):
+    """Persist asset positions to path."""
     _save_json(path, data)
 
 
 def load_asset_defaults(path: str) -> dict:
+    """Load asset defaults map from path; return {} if missing or invalid."""
     if os.path.exists(path):
         try:
             data = _load_json(path)
@@ -62,14 +69,15 @@ def load_asset_defaults(path: str) -> dict:
 
 
 def save_asset_defaults(path: str, data: dict):
+    """Persist asset defaults to path."""
     _save_json(path, data)
 
 
 def _normalize_user_model(model_name: str) -> str:
+    """Map provider model names to canonical user-facing options (nanobanana-pro / nanobanana-2)."""
     m = (model_name or "").strip().lower()
     if m in {"nanobanana-pro", "nanobanana-2"}:
         return m
-    # 兼容历史 provider 模型名，统一映射到用户可选项
     if m in {"nano-banana-pro-preview", "gemini-3-pro-image-preview"}:
         return "nanobanana-pro"
     if m in {"gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation"}:
@@ -78,6 +86,7 @@ def _normalize_user_model(model_name: str) -> str:
 
 
 def load_runtime_config(path: str) -> dict:
+    """Load runtime config (gemini_api_key, gemini_model) from env and optional JSON file."""
     base = {
         "gemini_api_key": os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "",
         "gemini_model": _normalize_user_model(os.getenv("GEMINI_MODEL") or "nanobanana-pro"),
@@ -94,6 +103,7 @@ def load_runtime_config(path: str) -> dict:
 
 
 def save_runtime_config(path: str, data: dict):
+    """Merge data into current runtime config and save to path; chmod 0o600 on path."""
     cfg = load_runtime_config(path)
     cfg.update(data or {})
     _save_json(path, cfg)
@@ -104,6 +114,7 @@ def save_runtime_config(path: str, data: dict):
 
 
 def load_join_keys(path: str) -> dict:
+    """Load join keys structure from path; return {'keys': []} if missing or invalid."""
     if os.path.exists(path):
         try:
             data = _load_json(path)
@@ -115,4 +126,5 @@ def load_join_keys(path: str) -> dict:
 
 
 def save_join_keys(path: str, data: dict):
+    """Persist join keys to path."""
     _save_json(path, data)
```

---

### Incident Patch 15: `8d36ad52` (2026-03-05)
**Commit Message**: feat: bundle gemini image generate script + update SKILL.md install guide

- Add scripts/gemini_image_generate.py to repo (was only in local skill dir)
- Update SKILL.md section 4: add step-by-step setup for image generation env
- No changes to app.py or any existing logic; script is a standalone addition
- Users can now set up image generation by following SKILL.md instructions

**File**: `SKILL.md` (modified, +40/-16)
```diff
@@ -5,8 +5,8 @@ description: Star Office UI 一键化 Skill：帮主人快速部署像素办公
 
 # Star Office UI Skill
 
-本 Skill 面向想快速帮主人搭建“像素办公室看板”的 OpenClaw（龙虾）：
-- 目标：主人只需“看到效果”，尽量少问问题
+本 Skill 面向想快速帮主人搭建"像素办公室看板"的 OpenClaw（龙虾）：
+- 目标：主人只需"看到效果"，尽量少问问题
 - 你可以按下面的步骤，一步一步帮主人跑起来并对外访问
 
 ---
@@ -83,18 +83,42 @@ export ASSET_DRAWER_PASS="your-strong-pass"
 
 ---
 
-## 4. 引导用户填写生图 API（Gemini）
+## 4. 生图功能（Gemini）—— 可选
 
-当前装修生图接入的是 **Gemini API**。
+"搬新家 / 找中介"装修功能需要 Gemini API，但**基础看板不需要**，不装也能正常使用。
 
-你需要主动引导用户完成这两项配置：
+### 4.1 安装生图脚本环境（首次使用时）
+
+仓库已自带生图脚本（`scripts/gemini_image_generate.py`），但运行需要独立的 Python 环境。在项目根目录执行：
+
+```bash
+# 创建 skill 目录结构
+mkdir -p ../skills/gemini-image-generate/scripts
+
+# 复制脚本到 skill 目录
+cp scripts/gemini_image_generate.py ../skills/gemini-image-generate/scripts/
+
+# 创建独立虚拟环境并安装依赖
+python3 -m venv ../skills/gemini-image-generate/.venv
+../skills/gemini-image-generate/.venv/bin/pip install google-genai
+```
+
+安装完成后，后端会自动检测到生图环境，"搬新家 / 找中介"按钮即可使用。
+
+### 4.2 配置 Gemini API Key
+
+引导用户完成这两项配置：
 
 1. `GEMINI_API_KEY`
 2. `GEMINI_MODEL`（推荐：`nanobanana-pro` 或 `nanobanana-2`）
 
+配置方式有两种：
+- **侧边栏填写**：打开资产侧边栏 → 在生图配置区域直接输入 API Key 并保存
+- **环境变量**：`export GEMINI_API_KEY="your-key"`
+
 并明确告诉用户：
-- 不配置 API 也能用基础看板
-- 配置后才能使用“搬新家 / 找中介”的 AI 生图装修能力
+- 不配置 API 也能用基础看板（状态显示、多 Agent、资产替换等）
+- 配置后才能使用"搬新家 / 找中介"的 AI 生图装修能力
 
 如果页面提示缺少 key，指导用户在侧边栏里直接填写并保存（运行时配置入口）。
 
@@ -116,7 +140,7 @@ cloudflared tunnel --url http://127.0.0.1:18791
 ### 5.2 装修房子入口
 
 提醒主人：
-- 现在可以点击“装修房间”开始装饰；
+- 现在可以点击"装修房间"开始装饰；
 - 侧边栏默认密码是 `1234`；
 - 当他想改密码时，可随时告诉你，你来帮他改；
 - 推荐改成强密码，安全性更高。
@@ -152,29 +176,29 @@ cloudflared tunnel --url http://127.0.0.1:18791
 
 ## 7. 昨日小记（可选）
 
-如果你主人想看到“昨日小记”：
+如果你主人想看到"昨日小记"：
 - 在仓库上级目录放一个 `memory/YYYY-MM-DD.md`
 - 后端会自动读取昨天（或最近可用）的记录，做基础脱敏后展示
 
 ---
 
 ## 8. 常见问题（主人可能问你的）
 
-### Q1：“我可以商用吗？”
+### Q1："我可以商用吗？"
 > 代码玩法可以基于 MIT 用，但美术资产（包括角色/场景）禁止商用；如果你要商用，请务必换成你自己的原创美术资产。
 
-### Q2：“其他龙虾怎么加入？”
+### Q2："其他龙虾怎么加入？"
 > 用 join key 加入，然后持续推送状态就行；仓库里有 `office-agent-push.py` 可以给其他龙虾用。
 
 ---
 
 ## 9. 给你的提示
 
-- 尽量帮主人把“启动步骤”做完，让主人只负责“看”和“体验”
+- 尽量帮主人把"启动步骤"做完，让主人只负责"看"和"体验"
 - 如果主人要对外访问，优先用 Cloudflare Tunnel（最快最方便）
 - 状态切换应由你主动执行：
-  - 接任务前，先把自己状态切到“工作中”（如 `writing/researching/executing`），再开始工作；
-  - 完成任务后，先把自己状态切回“待命中（idle）”，再进入休息/等待下一任务。
+  - 接任务前，先把自己状态切到"工作中"（如 `writing/researching/executing`），再开始工作；
+  - 完成任务后，先把自己状态切回"待命中（idle）"，再进入休息/等待下一任务。
 - 注意不要暴露你主人的内网地址或私有信息
 
 ---
@@ -189,7 +213,7 @@ cloudflared tunnel --url http://127.0.0.1:18791
 
 ### 10.1 生图模型建议（房间装修）
 
-当用户使用“搬新家 / 找中介”时，优先推荐：
+当用户使用"搬新家 / 找中介"时，优先推荐：
 
 1. **gemini nanobanana pro**
 2. **gemini nanobanana 2**
@@ -228,7 +252,7 @@ export ASSET_DRAWER_PASS="your-strong-pass"
 - 但基础功能（状态看板、多 Agent、资产替换/布局、三语切换）**不依赖 API**，不开 API 也能正常使用。
 
 建议对主人口径：
-> 先把基础看板跑起来；需要“无限换背景/AI 生图装修”再接入自己的 API。
+> 先把基础看板跑起来；需要"无限换背景/AI 生图装修"再接入自己的 API。
 
 ### 10.5 老用户更新指南（从旧版本升级）
 
```

**File**: `scripts/gemini_image_generate.py` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+#!/usr/bin/env python3
+"""Gemini Image Generate - CLI for Star Office UI background generation.
+
+Calls Google's Gemini API to generate images, with optional reference image
+for style transfer / layout preservation.
+
+Expected interface (called by Star Office UI backend):
+  python gemini_image_generate.py \
+    --prompt "..." \
+    --model <model_name> \
+    --out-dir /tmp/xxx \
+    --cleanup \
+    [--aspect-ratio 16:9] \
+    [--reference-image /path/to/ref.webp]
+
+Environment:
+  GEMINI_API_KEY  - Google AI API key (required)
+  GEMINI_MODEL    - override model name (optional, --model takes precedence)
+
+Output (last line of stdout):
+  {"files": ["/tmp/xxx/generated_0.png"]}
+"""
+
+import argparse
+import base64
+import json
+import mimetypes
+import os
+import sys
+import tempfile
+import shutil
+from pathlib import Path
+
+try:
+    from google import genai
+    from google.genai import types
+    HAS_GENAI = True
+except ImportError:
+    HAS_GENAI = False
+
+
+def detect_mime(path: str) -> str:
+    mt, _ = mimetypes.guess_type(path)
+    if mt:
+        return mt
+    ext = os.path.splitext(path)[1].lower()
+    return {
+        ".png": "image/png",
+        ".jpg": "image/jpeg",
+        ".jpeg": "image/jpeg",
+        ".webp": "image/webp",
+        ".gif": "image/gif",
+    }.get(ext, "image/png")
+
+
+def main():
+    parser = argparse.ArgumentParser(description="Generate image via Gemini API")
+    parser.add_argument("--prompt", required=True, help="Generation prompt")
+    parser.add_argument("--model", default="", help="Model name")
+    parser.add_argument("--out-dir", required=True, help="Output directory")
+    parser.add_argument("--cleanup", action="store_true", help="(ignored, kept for compat)")
+    parser.add_argument("--aspect-ratio", default="", help="Aspect ratio hint (e.g. 16:9)")
+    parser.add_argument("--reference-image", default="", help="Reference image path")
+    args = parser.parse_args()
+
+    # Resolve API key
+    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
+    if not api_key:
+        api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
+    if not api_key:
+        print("ERROR: GEMINI_API_KEY or GOOGLE_API_KEY not set", file=sys.stderr)
+        sys.exit(1)
+
+    # Resolve model - env var GEMINI_MODEL overrides --model flag
+    model = os.environ.get("GEMINI_MODEL", "").strip() or args.model.strip()
+    if not model:
+        model = "gemini-2.0-flash-exp"
+
+    # Ensure output directory
+    out_dir = args.out_dir
+    os.makedirs(out_dir, exist_ok=True)
+
+    if not HAS_GENAI:
+        print("ERROR: google-genai package not installed", file=sys.stderr)
+        sys.exit(1)
+
+    # Initialize client
+    client = genai.Client(api_key=api_key)
+
+    # Build prompt parts
+    contents = []
+
+    # Add reference image if provided
+    if args.reference_image and os.path.exists(args.reference_image):
+        ref_path = args.reference_image
+        mime = detect_mime(ref_path)
+        with open(ref_path, "rb") as f:
+            ref_data = f.read()
+        contents.append(
+            types.Part.from_bytes(data=ref_data, mime_type=mime)
+        )
+
+    # Add text prompt
+    prompt_text = args.prompt
+    if args.aspect_ratio:
+        prompt_text += f"\nTarget aspect ratio: {args.aspect_ratio}."
+    contents.append(prompt_text)
+
+    # Configure generation
+    generate_config = types.GenerateContentConfig(
+        response_modalities=["TEXT", "IMAGE"],
+    )
+
+    try:
+        response = client.models.generate_content(
+            model=model,
+            contents=contents,
+            config=generate_config,
+        )
+    except Exception as e:
+        err_msg = str(e)
+        print(f"ERROR: {err_msg}", file=sys.stderr)
+        sys.exit(1)
+
+    # Extract generated images
+    output_files = []
+    idx = 0
+
+    if response.candidates:
+        for candidate in response.candidates:
+            if not candidate.content or not candidate.content.parts:
+                continue
+            for part in candidate.content.parts:
+                if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
+                    # Determine extension from mime
+                    mime = part.inline_data.mime_type
+                    ext_map = {
+                        "image/png": ".png",
+                        "image/jpeg": ".jpg",
+                        "image/webp": ".webp",
+                    }
+                    ext = ext_map.get(mime, ".png")
+                    out_path = os.path.join(out_dir, f"generated_{idx}{ext}")
+                    with open(out_path, "wb") as f:
+                        f.write(part.inline_data.data)
+                    output_files.append(out_path)
+                    idx += 1
+
+    if not output_files:
+        # Check if there's text response with error info
+        text_parts = []
+        if response
```

#### Recent Merged Pull Requests:
- **PR #121** (closed): feat: painel de telemetria do consumidor Noctua (só-leitura, Issue #21) (@pabbl)
- **PR #120** (closed): feat: add Hermes status integration v1.1.0 (@joyparkray)
- **PR #103** (closed): fix: sync main agent state to agents-state.json (@shuai-clawd)
- **PR #100** (closed): fix(join): make self-leave use stable agent identity (@yangcongcong-coding)
- **PR #99** (closed): fix(frontend): render invite pages with runtime office info (@yangcongcong-coding)
- **PR #98** (closed): fix(backend): require auth for admin asset actions (@yangcongcong-coding)
- **PR #90** (closed): Refactor: Improve Python 3.8+ compatibility & Fix bg_tasks memory leak (@TryWorld2026)
- **PR #85** (closed): fix: revert OpenClaw URLs back to openclaw.com (@sshlg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

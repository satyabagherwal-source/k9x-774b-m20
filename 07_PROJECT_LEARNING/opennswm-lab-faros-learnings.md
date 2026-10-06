# Forensic Learning Record (Deep Inspection): OpenNSWM-Lab/FAROS

> **Canonical Artifact**: `07_PROJECT_LEARNING/opennswm-lab-faros-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/OpenNSWM-Lab/FAROS](https://github.com/OpenNSWM-Lab/FAROS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:07:02.388Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `OpenNSWM-Lab/FAROS`
- **Description**: A blueprint-driven AutoResearch runtime for orchestrating AI research workflows from idea generation and experiments to paper writing and peer review.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3043 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/core/__init__.py`
```
"""Core application modules."""
from app.core.settings import get_settings, Settings, ProviderConfig

__all__ = ["get_settings", "Settings", "ProviderConfig"]

```

### Core Architecture Module: `backend/app/core/paths.py`
```
"""Canonical runtime paths with an overridable data root."""

from __future__ import annotations

import os
from pathlib import Path


_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPOSITORY_ROOT = _BACKEND_ROOT.parent


def get_data_dir(*, create: bool = True) -> Path:
    configured = os.getenv("DATA_DIR", "").strip()
    if configured:
        path = Path(configured).expanduser()
        if not path.is_absolute():
            base = _REPOSITORY_ROOT if path.parts and path.parts[0] == "backend" else _BACKEND_ROOT
            path = base / path
    else:
        path = _BACKEND_ROOT / "data"
    path = path.resolve()
    if create:
        path.mkdir(parents=True, exist_ok=True)
    return path


def data_path(*parts: str, create_parent: bool = False) -> Path:
    path = get_data_dir() / Path(*parts)
    if create_parent:
        path.parent.mkdir(parents=True, exist_ok=True)
    return path

```

### Core Architecture Module: `backend/app/core/settings.py`
```
"""
Application Settings - Centralized Configuration

Provides Pydantic-based settings with environment variable support.
Runtime provider overrides are encrypted and persisted per authenticated user.
"""

import hashlib
import json
import logging
import os
import tempfile
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken
from pydantic import BaseModel, Field, PrivateAttr

from app.core.user_context import get_current_user_id, normalize_user_id
from app.core.paths import get_data_dir as get_runtime_data_dir

logger = logging.getLogger(__name__)


@dataclass
class UserProviderState:
    keys: Dict[str, str] = field(default_factory=dict)
    models: Dict[str, str] = field(default_factory=dict)
    base_urls: Dict[str, str] = field(default_factory=dict)
    active_provider: Optional[str] = None
    active_model: Optional[str] = None


class ProviderConfig(BaseModel):
    """Configuration for a single LLM provider."""
    base_url_env: str = Field(..., description="Environment variable name for base URL")
    api_key_env: str = Field(..., description="Environment variable name for API key")
    default_model: str = Field(..., description="Default model for this provider")
    api_format: str = Field(default="openai", description="Provider API format used by the runtime client")
    timeout: int = Field(default=60, description="Request timeout in seconds")
    extra_headers: Dict[str, str] = Field(default_factory=dict)
    
    def get_base_url(self) -> Optional[str]:
        """Get base URL from environment."""
        v = os.getenv(self.base_url_env)
        return v.strip() if v else None

    def get_api_key(self) -> Optional[str]:
        """Get API key from environment."""
        v = os.getenv(self.api_key_env)
        return v.strip() if v else None
    
    def is_configured(self) -> bool:
        """Check if provider has required configuration."""
        return bool(self.get_api_key())


class Settings(BaseModel):
    """Application settings loaded from environment variables."""
    
    # Data storage
    DATA_DIR: str = Field(
        default_factory=lambda: os.getenv("DATA_DIR", "backend/data"),
        description="Directory for persistent data storage"
    )
    
    # API server
    API_HOST: str = Field(
        default_factory=lambda: os.getenv("API_HOST", "127.0.0.1"),
        description="API server host"
    )
    API_PORT: int = Field(
        default_factory=lambda: int(os.getenv("API_PORT", "8005")),
        description="API server port"
    )
    
    # Active provider configuration
    ACTIVE_PROVIDER_NAME: str = Field(
        default_factory=lambda: os.getenv("ACTIVE_PROVIDER_NAME", "moonshot"),
        description="Currently active LLM provider"
    )
    ACTIVE_MODEL_NAME: Optional[str] = Field(
        default_factory=lambda: os.getenv("ACTIVE_MODEL_NAME"),
        description="Override model name (uses provider default if not set)"
    )
    
    # Request settings
    REQUEST_TIMEOUT: int = Field(
        default_factory=lambda: int(os.getenv("REQUEST_TIMEOUT", "60")),
        description="Default request timeout"
    )
    PLAN_GENERATION_TIMEOUT: int = Field(
        default_factory=lambda: int(os.getenv("PLAN_GENERATION_TIMEOUT", "180")),
        description="Request timeout for long plan-generation LLM calls"
    )
    PAPER_GENERATION_TIMEOUT: int = Field(
        default_factory=lambda: int(os.getenv("PAPER_GENERATION_TIMEOUT", "300")),
        description="Request timeout for long paper-generation LLM calls"
    )
    MAX_RETRIES: int = Field(
        default_factory=lambda: int(os.getenv("MAX_RETRIES", "3")),
        description="Maximum retry attempts"
    )
    RETRY_BACKOFF: float = Field(
        default_factory=lambda: float(os.getenv("RETRY_BACKOFF", "1.0")),
        description="Retry backoff multiplier"
    )

    # ---- Sandbox / Code Agent settings ----
    SANDBOX_DEFAULT_BACKEND: str = Field(
        default_factory=lambda: os.getenv("SANDBOX_DEFAULT_BACKEND", "subprocess"),
        description="Default sandbox backend: 'docker' or 'subprocess'"
    )
    SANDBOX_MAX_CONCURRENT: int = Field(
        default_factory=lambda: int(os.getenv("SANDBOX_MAX_CONCURRENT", "4")),
        description="Maximum concurrent sandbox instances"
    )
    SANDBOX_TTL_SEC: int = Field(
        default_factory=lambda: int(os.getenv("SANDBOX_TTL_SEC", "3600")),
        description="Time-to-live for sandbox instances before automatic reclamation"
    )
    SANDBOX_DOCKER_IMAGE: str = Field(
        default_factory=lambda: os.getenv("SANDBOX_DOCKER_IMAGE", "python:3.12-slim"),
        description="Default Docker image for the Docker sandbox backend"
    )
    SANDBOX_MEM_LIMIT: str = Field(
        default_factory=lambda: os.getenv("SANDBOX_MEM_LIMIT", "512m"),
        description="Memory limit for Docker sandbox containers"
    )
    SANDBOX_CPU_QUOTA: int = Field(
        default_factory=lambda: int(os.getenv("SANDBOX_CPU_QUOTA", "50000")),
        description="CPU quota for sandbox containers (100000 = 1 core)"
    )

    # ---- Agent loop settings ----
    AGENT_MAX_ITERATIONS: int = Field(
        default_factory=lambda: int(os.getenv("AGENT_MAX_ITERATIONS", "3")),
        description="Maximum repair/retry iterations for autonomous agent loop"
    )
    AGENT_EXECUTION_TIMEOUT: int = Field(
        default_factory=lambda: int(os.getenv("AGENT_EXECUTION_TIMEOUT", "300")),
        description="Default execution timeout per agent iteration (seconds)"
    )
    AGENT_SANDBOX_TIMEOUT: int = Field(
        default_factory=lambda: int(os.getenv("AGENT_SANDBOX_TIMEOUT", "600")),
        description="Absolute maximum sandbox execution timeout (seconds)"
    )

    # Provider configurations (static, keys from env)
    PROVIDERS: Dict[str, ProviderConfig] = Field(default_factory=lambda: {
        "moonshot": ProviderConfig(
            base_url_env="MOONSHOT_BASE_URL",
            api_key_env="MOONSHOT_API_KEY",
            default_model="moonshot-v1-8k",
            api_format="openai",
            timeout=60,
            extra_headers={}
        ),
        "kimi": ProviderConfig(
            base_url_env="KIMI_BASE_URL",
            api_key_env="KIMI_API_KEY",
            default_model="kimi",
            api_format="openai",
            timeout=60,
            extra_headers={}
        ),
        "openai": ProviderConfig(
            base_url_env="OPENAI_BASE_URL",
            api_key_env="OPENAI_API_KEY",
            default_model="gpt-4o-2024-08-06",
            api_format="openai",
            timeout=120,
            extra_headers={}
        ),
        "anthropic": ProviderConfig(
            base_url_env="ANTHROPIC_BASE_URL",
            api_key_env="ANTHROPIC_API_KEY",
            default_model="claude-3-5-sonnet-20241022",
            api_format="anthropic",
            timeout=120,
            extra_headers={}
        ),
        "claude": ProviderConfig(
            base_url_env="CLAUDE_BASE_URL",
            api_key_env="CLAUDE_API_KEY",
            default_model="claude-3-5-sonnet-20241022",
            api_format="anthropic",
            timeout=120,
            extra_headers={}
        ),
        "deepseek": ProviderConfig(
            base_url_env="DEEPSEEK_BASE_URL",
            api_key_env="DEEPSEEK_API_KEY",
            default_model="deepseek-chat",
            api_format="openai",
            timeout=60,
            extra_headers={}
        ),
        "zhipu": ProviderConfig(
            base_url_env="ZHIPU_BASE_URL",
            api_key_env="ZHIPU_API_KEY",
            default_model="glm-4",
            api_format="openai",
            timeout=60,
            extra_headers={}
        ),
        "qwen": ProviderConfig(
            base_url_env="QWEN_BASE_URL",
            api_key_env="QWEN_API_KEY",
            default_model="qwen-max",
            api_format="openai",
            timeout=300,
            extra_headers={}
        ),
        "bailian": ProviderConfig(
            base_url_env="BAILIAN_BASE_URL",
            api_key_env="BAILIAN_API_KEY",
            default_model="qwen-plus",
            api_format="openai",
            timeout=300,
            extra_headers={}
        ),
        "bigmodel": ProviderConfig(
            base_url_env="BIGMODEL_BASE_URL",
            api_key_env="BIGMODEL_API_KEY",
            default_model="glm-4.5-air",
            api_format="openai",
            timeout=90,
            extra_headers={}
        ),
        "minimax": ProviderConfig(
            base_url_env="MINIMAX_BASE_URL",
            api_key_env="MINIMAX_API_KEY",
            default_model="MiniMax-M2.5",
            api_format="anthropic",
            timeout=120,
            extra_headers={}
        ),
    })

    _user_runtime: Dict[str, UserProviderState] = PrivateAttr(default_factory=dict)
    _loaded_users: set[str] = PrivateAttr(default_factory=set)
    _runtime_lock: threading.RLock = PrivateAttr(default_factory=threading.RLock)
    _credential_cipher: Optional[Fernet] = PrivateAttr(default=None)

    def _resolve_user_id(self, user_id: Optional[str] = None) -> str:
        return normalize_user_id(user_id, fallback=get_current_user_id())

    def _state_for(self, user_id: Optional[str] = None) -> UserProviderState:
        resolved = self._resolve_user_id(user_id)
        with self._runtime_lock:
            if resolved not in self._loaded_users:
                self._load_user_runtime(resolved)
            return self._user_runtime[resolved]
    
    def get_provider_config(self, provider_name: Optional[str] = None) -> ProviderConfig:
        """Get configuration for a provider."""
        name = provider_name or self.get_active_provider()
        if name not in self.PROVIDERS:
            raise ValueError(f"Unknown provider: {name}. Available: {list(self.PROVIDERS.keys())}")
        return self.PROVIDERS[name]

    def get_active_pro
```

### Core Architecture Module: `backend/app/core/user_context.py`
```
"""Request-scoped user identity and subprocess environment hygiene."""

from __future__ import annotations

import os
import re
from contextlib import contextmanager
from contextvars import ContextVar, Token, copy_context
from typing import Any, Callable, Iterator, Optional, TypeVar


_USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_current_user_id: ContextVar[Optional[str]] = ContextVar(
    "faros_current_user_id",
    default=None,
)
T = TypeVar("T")


def normalize_user_id(value: Optional[str], *, fallback: Optional[str] = None) -> str:
    """Normalize a trusted proxy identity into a storage-safe identifier."""
    candidate = (value or fallback or "").strip()
    if not candidate:
        candidate = os.getenv("FAROS_DEFAULT_USER", "local").strip() or "local"
    if not _USER_ID_PATTERN.fullmatch(candidate):
        raise ValueError("Invalid FAROS user identifier")
    return candidate


def get_current_user_id() -> str:
    return normalize_user_id(_current_user_id.get())


def set_current_user_id(user_id: Optional[str]) -> Token:
    return _current_user_id.set(normalize_user_id(user_id))


def reset_current_user_id(token: Token) -> None:
    _current_user_id.reset(token)


@contextmanager
def use_user(user_id: str) -> Iterator[str]:
    """Temporarily bind a user, primarily for jobs and tests."""
    token = set_current_user_id(user_id)
    try:
        yield get_current_user_id()
    finally:
        reset_current_user_id(token)


def get_current_user_role(user_id: Optional[str] = None) -> str:
    resolved = normalize_user_id(user_id, fallback=get_current_user_id())
    reviewer_users = {
        item.strip()
        for item in os.getenv(
            "FAROS_REVIEWER_USERS",
            os.getenv("FAROS_REVIEWX_SIGNER_USERS", ""),
        ).split(",")
        if item.strip()
    }
    team_users = {
        item.strip()
        for item in os.getenv("FAROS_TEAM_USERS", "faros-team,team,local").split(",")
        if item.strip()
    }
    judge_users = {
        item.strip()
        for item in os.getenv("FAROS_JUDGE_USERS", "faros-judge,judge").split(",")
        if item.strip()
    }
    if resolved in reviewer_users:
        return "reviewer"
    if resolved in team_users:
        return "team"
    if resolved in judge_users:
        return "judge"
    return "user"


def call_with_current_context(fn: Callable[..., T], *args: Any, **kwargs: Any) -> Callable[..., T]:
    """Capture the caller's context for one later thread-pool invocation."""
    context = copy_context()

    def _bound(*call_args: Any, **call_kwargs: Any) -> T:
        merged_kwargs = {**kwargs, **call_kwargs}
        return context.run(fn, *args, *call_args, **merged_kwargs)

    return _bound


_SENSITIVE_ENV_MARKERS = (
    "API_KEY",
    "AUTH_TOKEN",
    "ACCESS_TOKEN",
    "REFRESH_TOKEN",
    "PRIVATE_KEY",
    "PASSWORD",
    "CREDENTIAL",
    "CLIENT_SECRET",
)
_SENSITIVE_ENV_EXACT = {
    "FAROS_CREDENTIAL_KEY",
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "TOKEN",
}


def sanitized_subprocess_env(extra: Optional[dict[str, str]] = None) -> dict[str, str]:
    """Return the process environment without application or provider secrets."""
    sanitized = {}
    for name, value in os.environ.items():
        upper_name = name.upper()
        if upper_name in _SENSITIVE_ENV_EXACT:
            continue
        if any(marker in upper_name for marker in _SENSITIVE_ENV_MARKERS):
            continue
        sanitized[name] = value
    if extra:
        sanitized.update({str(name): str(value) for name, value in extra.items()})
    return sanitized

```

### Core Architecture Module: `backend/app/db/engine.py`
```
"""
Database Engine - SQLite connection and session management.

Designed for easy migration to PostgreSQL later.
"""

import os
import logging
from typing import Generator, Optional, Dict, Any
from contextlib import contextmanager

from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.paths import get_data_dir

logger = logging.getLogger(__name__)

# Database path
_DATA_DIR = str(get_data_dir())
_DB_PATH = os.path.join(_DATA_DIR, "app.db")

# Database URL (SQLite for now, easily swappable to PostgreSQL)
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{_DB_PATH}")

# Engine singleton
_engine: Optional[Engine] = None


def get_engine() -> Engine:
    """Get or create the database engine."""
    global _engine
    
    if _engine is None:
        # Ensure data directory exists
        os.makedirs(_DATA_DIR, exist_ok=True)
        
        # Create engine with appropriate settings
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        
        _engine = create_engine(
            DATABASE_URL,
            echo=os.environ.get("DB_ECHO", "").lower() == "true",
            connect_args=connect_args,
            pool_pre_ping=True,
        )
        
        logger.info(f"Database engine created: {DATABASE_URL}")
    
    return _engine


def get_session() -> Generator[Session, None, None]:
    """Get a database session (for FastAPI dependency injection)."""
    engine = get_engine()
    with Session(engine) as session:
        yield session


@contextmanager
def get_session_context() -> Generator[Session, None, None]:
    """Get a database session as context manager."""
    engine = get_engine()
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def init_db(drop_existing: bool = False) -> None:
    """
    Initialize the database.
    
    Creates all tables defined in models.
    In production, use Alembic migrations instead.
    
    Args:
        drop_existing: If True, drop all existing tables first (DANGEROUS!)
    """
    from . import models  # Import to register models
    
    engine = get_engine()
    
    if drop_existing:
        logger.warning("Dropping all existing tables!")
        SQLModel.metadata.drop_all(engine)
    
    SQLModel.metadata.create_all(engine)
    logger.info("Database tables created/verified")


def test_connection() -> bool:
    """Test database connection."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


def get_migration_status() -> Dict[str, Any]:
    """
    Get current migration status.
    
    Returns dict with:
    - status: "current", "pending", "error"
    - revision: current revision or None
    - error: error message if any
    """
    result = {
        "status": "unknown",
        "revision": None,
        "error": None,
    }
    
    try:
        # Check if alembic_version table exists
        engine = get_engine()
        with engine.connect() as conn:
            # Check for alembic version table
            if DATABASE_URL.startswith("sqlite"):
                check_sql = text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'"
                )
            else:
                check_sql = text(
                    "SELECT tablename FROM pg_tables WHERE tablename='alembic_version'"
                )
            
            table_exists = conn.execute(check_sql).fetchone() is not None
            
            if not table_exists:
                # No migrations run yet, but tables might exist from init_db
                # Check if any of our tables exist
                if DATABASE_URL.startswith("sqlite"):
                    tables_sql = text(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='code_projects'"
                    )
                else:
                    tables_sql = text(
                        "SELECT tablename FROM pg_tables WHERE tablename='code_projects'"
                    )
                
                has_tables = conn.execute(tables_sql).fetchone() is not None
                
                if has_tables:
                    result["status"] = "initialized_no_migrations"
                    result["revision"] = "init"
                else:
                    result["status"] = "not_initialized"
                return result
            
            # Get current revision
            version_sql = text("SELECT version_num FROM alembic_version")
            row = conn.execute(version_sql).fetchone()
            
            if row:
                result["revision"] = row[0]
                result["status"] = "current"
            else:
                result["status"] = "no_revision"
                
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


def close_engine() -> None:
    """Close the database engine."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None
        logger.info("Database engine closed")

```

### Core Architecture Module: `backend/app/faros/registry/package_lifecycle.py`
```
import re
from pathlib import Path
from typing import Protocol

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


class VersionedSpec(Protocol):
    id: str
    version: str


def parse_semver(version: str) -> tuple[int, int, int]:
    match = SEMVER_RE.match(version)
    if not match:
        raise ValueError(f"Invalid semantic version: {version}")
    return tuple(int(part) for part in match.groups())


def compare_semver(left: str, right: str) -> int:
    lval = parse_semver(left)
    rval = parse_semver(right)
    if lval < rval:
        return -1
    if lval > rval:
        return 1
    return 0


def package_dir_exists(root: Path, package_id: str, manifest_name: str) -> bool:
    return (root / package_id / manifest_name).is_file()

```

### Core Architecture Module: `backend/app/faros/runtime/state_store.py`
```
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.faros.errors import FarosNotFoundError
from app.core.paths import get_data_dir
from app.faros.models.execution import (
    FarosRunRecord,
    StepState,
    assert_run_status_transition,
    assert_step_status_transition,
)


class FarosStateStore:
    """File-backed state store for FAROS runs."""

    def __init__(self, root: Optional[Path] = None):
        base = get_data_dir() / "faros" / "runs"
        self.root = root or base
        self.root.mkdir(parents=True, exist_ok=True)

    def _run_dir(self, run_id: str) -> Path:
        path = self.root / run_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _run_path(self, run_id: str) -> Path:
        return self._run_dir(run_id) / "run.json"

    def _events_path(self, run_id: str) -> Path:
        return self._run_dir(run_id) / "events.json"

    def _artifacts_path(self, run_id: str) -> Path:
        return self._run_dir(run_id) / "artifacts.json"

    def _memory_path(self, run_id: str) -> Path:
        return self._run_dir(run_id) / "memory.json"

    def create_run(
        self,
        blueprint_id: str,
        profile_id: str,
        execution_mode: str,
        inputs: Dict[str, Any],
        steps: List[StepState],
        preflight: Optional[Dict[str, Any]] = None,
        runtime_options: Optional[Dict[str, Any]] = None,
        checkpoint: Optional[Dict[str, Any]] = None,
        parent_run_id: Optional[str] = None,
        research_series_id: Optional[str] = None,
        iteration_number: int = 1,
        iteration_feedback_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        run_id = f"faros_{uuid.uuid4().hex[:12]}"
        record = FarosRunRecord(
            id=run_id,
            blueprint_id=blueprint_id,
            profile_id=profile_id,
            status="planned" if execution_mode == "plan" else "pending",
            execution_mode=execution_mode,
            created_at=datetime.now(timezone.utc).isoformat(),
            parent_run_id=parent_run_id,
            research_series_id=research_series_id or run_id,
            iteration_number=iteration_number,
            iteration_feedback_id=iteration_feedback_id,
            inputs=inputs,
            runtime_options=runtime_options or {},
            steps=steps,
            preflight=preflight or {},
            checkpoint=checkpoint or {},
        ).model_dump()
        self._save_json(self._run_path(run_id), record)
        self._save_json(self._events_path(run_id), [])
        self._save_json(self._artifacts_path(run_id), [])
        self._save_json(self._memory_path(run_id), inputs)
        return record

    def list_runs(self) -> List[Dict[str, Any]]:
        runs = []
        for path in sorted(self.root.glob("*/run.json"), reverse=True):
            try:
                runs.append(json.loads(path.read_text()))
            except Exception:
                continue
        return runs

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        path = self._run_path(run_id)
        if not path.is_file():
            return None
        return json.loads(path.read_text())

    def update_run(self, run_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        record = self.get_run(run_id)
        if not record:
            raise FarosNotFoundError(f"FAROS run '{run_id}' not found")
        self._validate_run_updates(record, updates)
        record.update(updates)
        self._save_json(self._run_path(run_id), record)
        return record

    def update_step(self, run_id: str, node_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        record = self.get_run(run_id)
        if not record:
            raise FarosNotFoundError(f"FAROS run '{run_id}' not found")
        for step in record.get("steps", []):
            if step["node_id"] == node_id:
                self._validate_step_updates(step, updates)
                step.update(updates)
                break
        else:
            raise FarosNotFoundError(f"FAROS step '{node_id}' not found in run '{run_id}'")
        self._save_json(self._run_path(run_id), record)
        return record

    def list_events(self, run_id: str) -> List[Dict[str, Any]]:
        path = self._events_path(run_id)
        if not path.is_file():
            return []
        return json.loads(path.read_text())

    def append_event(self, run_id: str, event: Dict[str, Any]) -> None:
        events = self.list_events(run_id)
        events.append(event)
        self._save_json(self._events_path(run_id), events)

    def list_artifacts(self, run_id: str) -> List[Dict[str, Any]]:
        path = self._artifacts_path(run_id)
        if not path.is_file():
            return []
        return json.loads(path.read_text())

    def append_artifacts(self, run_id: str, artifacts: List[Dict[str, Any]]) -> None:
        existing: List[Dict[str, Any]] = []
        positions: Dict[str, int] = {}
        for artifact in self.list_artifacts(run_id):
            artifact_id = str(artifact.get('id') or '')
            if artifact_id and artifact_id in positions:
                existing[positions[artifact_id]] = artifact
                continue
            if artifact_id:
                positions[artifact_id] = len(existing)
            existing.append(artifact)
        for artifact in artifacts:
            artifact_id = str(artifact.get('id') or '')
            if artifact_id and artifact_id in positions:
                existing[positions[artifact_id]] = artifact
                continue
            if artifact_id:
                positions[artifact_id] = len(existing)
            existing.append(artifact)
        self._save_json(self._artifacts_path(run_id), existing)

    def get_memory(self, run_id: str) -> Dict[str, Any]:
        path = self._memory_path(run_id)
        if not path.is_file():
            return {}
        return json.loads(path.read_text())

    def save_memory(self, run_id: str, memory: Dict[str, Any]) -> None:
        self._save_json(self._memory_path(run_id), memory)

    def _validate_run_updates(self, current: Dict[str, Any], updates: Dict[str, Any]) -> None:
        if 'status' in updates:
            assert_run_status_transition(current.get('status', 'pending'), updates['status'])
        if 'steps' in updates:
            current_steps = {step['node_id']: step for step in current.get('steps', [])}
            for new_step in updates['steps']:
                node_id = new_step['node_id']
                if node_id in current_steps:
                    old_status = current_steps[node_id].get('status', 'pending')
                    new_status = new_step.get('status', old_status)
                    assert_step_status_transition(old_status, new_status, node_id)

    def _validate_step_updates(self, current_step: Dict[str, Any], updates: Dict[str, Any]) -> None:
        if 'status' in updates:
            assert_step_status_transition(current_step.get('status', 'pending'), updates['status'], current_step['node_id'])

    def _save_json(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, default=str))

```

### Core Architecture Module: `backend/app/modules/idea/reflection_loop.py`
```
"""
Reflection Loop - Per-node iterative LLM reasoning with literature search.

Each BFTS node runs this loop:
  LLM → (ACTION: SearchLiterature | FinalizeIdea) → execute → LLM → ...
  Up to N rounds (default 2, max 5).

Reference: AI-Scientist-v2 ai_scientist/perform_ideation_temp_free.py
Format: ACTION: / ARGUMENTS: blocks (same as AI Scientist v2)
"""

import logging
import re
import json
from typing import Optional, Tuple, Any, List, Dict

from app.models.idea import IdeaNode
from app.services.search_service import get_search_service, SearchResult
from app.llm.provider_client import get_provider_client, ChatMessage, ProviderError

logger = logging.getLogger(__name__)

# --- Tool definitions (matching AI Scientist v2 format) ---

SEARCH_LITERATURE_DESC = """Search for relevant literature using the FAROS search service.

This searches across Semantic Scholar, arXiv, and local corpus.
Provide a specific, targeted query (3-6 words) for best results.
Returns paper titles, authors, years, and abstracts."""

FINALIZE_IDEA_DESC = """Finalize your research idea and provide all details.

The IDEA JSON must include:
- "title": A catchy, informative title (string)
- "problem": Clear problem statement (string)
- "hypothesis": The core hypothesis / key insight (string)
- "abstract": A 150-200 word abstract (string)
- "approach": High-level methodology (string)
- "expectedOutcomes": List of expected outcomes (list of strings)
- "requiredExperiments": List of experiment objects, each with:
    "name", "description", "metrics" (list), "datasets" (list),
    "stopConditions" (list of explicit completion or abort criteria)
- "baselines": List of named control conditions or prior methods (list of strings)
- "risks": List of risk objects, each with:
    "risk" (string), "mitigation" (string)
"""


_TOOL_DESCRIPTIONS = f"""- **SearchLiterature**: {SEARCH_LITERATURE_DESC}
- **FinalizeIdea**: {FINALIZE_IDEA_DESC}"""

_TOOL_NAMES_STR = '"SearchLiterature", "FinalizeIdea"'


# --- System prompt for reflection loop ---

_REFLECTION_SYSTEM = f"""You are an experienced AI researcher iteratively refining a research idea.

You have access to ONE tool:
{_TOOL_DESCRIPTIONS}

You MUST respond in EXACTLY this format (two fields, separate lines):

ACTION:
<exactly one of {_TOOL_NAMES_STR}>

ARGUMENTS:
<If ACTION is "SearchLiterature", provide {{"query": "your search query"}}>
<If ACTION is "FinalizeIdea", provide the IDEA JSON as {{"idea": {{...}}}}>

NOTES:
- ACTION and ARGUMENTS must be on separate lines.
- For SearchLiterature: query should be 3-6 words, specific and targeted.
- After 1-2 searches, you should finalize.
- Do NOT repeat the same search query.
- The IDEA JSON in FinalizeIdea must be valid JSON.
- Only finalize when you are confident the idea is novel and distinct from literature."""


def _build_user_prompt(
    seed_query: str,
    paper_type: str,
    round_num: int,
    max_rounds: int,
    current_title: str,
    current_hypothesis: str,
    current_abstract: str,
    literature_context: str,
    tool_results: str,
    reflection_history: List[str],
) -> str:
    """Build the user prompt for a reflection round."""
    history_str = ""
    if reflection_history:
        history_str = "\\n".join(
            f"[Round {i+1}] {h}" for i, h in enumerate(reflection_history)
        )
    else:
        history_str = "(No previous rounds)"

    return f"""Research Topic: {seed_query}
Paper Type: {paper_type}

## Current Idea (Round {round_num}/{max_rounds})
Title: {current_title}
Hypothesis: {current_hypothesis}
Abstract: {current_abstract}

## Known Literature Context
{literature_context if literature_context else "(None yet)"}

## Previous Search Results
{tool_results if tool_results else "(No tool results yet)"}

## Reflection History
{history_str}

Based on the above, what should you do next?
- Call SearchLiterature with a NEW query to gather more information
- Call FinalizeIdea when the idea is ready and well-formed

Respond in the exact ACTION / ARGUMENTS format."""


def _parse_action(text: str) -> Tuple[Optional[str], Optional[Any]]:
    """Parse ACTION / ARGUMENTS from LLM response.

    Supports two formats:
    1. AI Scientist v2 format: ACTION:\\n<name>\\nARGUMENTS:\\n<json>
    2. JSON block: {{"action": "...", "arguments": ...}}

    Returns:
        (action_name, arguments) or (None, None) if parse fails.
    """
    # Try format 1: ACTION: / ARGUMENTS: blocks
    action_match = re.search(
        r'ACTION:\s*\n?\s*(\w+)', text, re.IGNORECASE
    )
    if action_match:
        action_name = action_match.group(1).strip()
        # Extract ARGUMENTS block
        args_match = re.search(
            r'ARGUMENTS:\s*\n?\s*(\{[\s\S]*\})', text, re.IGNORECASE
        )
        if args_match:
            try:
                arguments = json.loads(args_match.group(1))
                return action_name, arguments
            except json.JSONDecodeError:
                pass
        # ACTION found but no valid ARGUMENTS — return action only
        return action_name, None

    # Try format 2: JSON block
    json_match = re.search(r'\{[\s\S]*"(action|ACTION)"[\s\S]*\}', text)
    if json_match:
        try:
            data = json.loads(json_match.group())
            action_name = data.get("action") or data.get("ACTION")
            arguments = data.get("arguments") or data.get("ARGUMENTS")
            if action_name:
                return action_name, arguments
        except (json.JSONDecodeError, AttributeError):
            pass

    # Strict JSON providers sometimes follow the requested payload schema but
    # omit the textual action envelope. Infer only the two unambiguous shapes.
    cleaned = str(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        data = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        data = None
    if isinstance(data, dict):
        if isinstance(data.get("query"), str) and data["query"].strip():
            return "SearchLiterature", data
        if isinstance(data.get("idea"), dict) or isinstance(data.get("IDEA"), dict):
            return "FinalizeIdea", data
        if data.get("title"):
            return "FinalizeIdea", {"idea": data}

    return None, None


def _parse_finalize_arguments(text: str) -> Optional[Dict[str, Any]]:
    """Accept strict-JSON final ideas when a provider omits the action wrapper."""

    cleaned = str(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    candidates = [cleaned]
    json_match = re.search(r'\{[\s\S]*"(?:idea|title)"[\s\S]*\}', cleaned)
    if json_match and json_match.group() != cleaned:
        candidates.append(json_match.group())
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(data, dict):
            continue
        if isinstance(data.get("idea"), dict):
            return data
        if isinstance(data.get("IDEA"), dict):
            return data
        if data.get("title"):
            return {"idea": data}
    return None


def _execute_search(query: str, limit: int = 5) -> str:
    """Execute a literature search via FAROS search_service.

    Returns:
        Formatted string of search results for LLM consumption.
    """
    try:
        search_service = get_search_service()
        results = search_service.search(query, limit=limit)
        if not results:
            return f"(No results found for query: '{query}')"

        lines = []
        for i, r in enumerate(results[:limit]):
            title = getattr(r, 'title', 'Unknown')
            authors = getattr(r, 'authors', [])
            year = getattr(r, 'year', 'N/A')
            abstract = getattr(r, 'abstract', '') or ''
            snippet = abstract[:300] + '...' if len(abstract) > 300 else abstract
            author_str = ', '.join(authors[:3]) if authors else 'Unknown'
            if len(authors) > 3:
                author_str += ' et al.'
            lines.append(
                f"[{i+1}] {title} ({year})\\n"
                f"    Authors: {author_str}\\n"
                f"    Abstract: {snippet}"
            )
        return "\\n\\n".join(lines)
    except Exception as e:
        logger.warning(f"Search execution failed for query '{query}': {e}")
        return f"(Search failed: {e})"


def _execute_finalize(
    arguments: Any,
    node: IdeaNode,
    session_id: str,
) -> IdeaNode:
    """Execute FinalizeIdea action: populate node with finalized idea data.

    Args:
        arguments: The IDEA JSON from LLM (dict with "idea" key, or direct dict)
        node: The IdeaNode to populate
        session_id: For generating candidate IDs

    Returns:
        Updated IdeaNode with isTerminal=True
    """
    # Handle nested "idea" key (AI Scientist v2 format)
    idea_data = arguments
    if isinstance(arguments, dict):
        if "idea" in arguments:
            idea_data = arguments["idea"]
        elif "IDEA" in arguments:
            idea_data = arguments["IDEA"]

    if not isinstance(idea_data, dict):
        logger.warning(f"FinalizeIdea: arguments is not a dict: {type(idea_data)}")
        return node

    # Populate node fields
    node.title = idea_data.get("title", node.title or "Untitled Idea")
    node.hypothesis = idea_data.get(
        "hypothesis", idea_data.get("problem", node.hypothesis or "")
    )
    node.abstract = idea_data.get("abstract", node.abstract or "")
    node.approach = idea_data.get("approach", node.approach or "")
    node.experiments = idea_data.get(
        "requiredExperiments", idea_data.get("experiments", node.experiments)
    )
    node.baselines = idea_data.get("baselines", node.baselines)
    node.risks = idea_data.get(
        "risks", idea_data.get("riskFactors", node.r
```

### Core Architecture Module: `backend/app/modules/paper/skills/utils.py`
```
import hashlib
import json
import os
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.modules.paper.storage import get_paper_latex_dir, write_paper_file
from .constants import TEMPLATE_ROOT


LATEX_MATH_ENVS = {
    "align",
    "align*",
    "aligned",
    "alignat",
    "alignat*",
    "displaymath",
    "eqnarray",
    "eqnarray*",
    "equation",
    "equation*",
    "flalign",
    "flalign*",
    "gather",
    "gather*",
    "gathered",
    "math",
    "multline",
    "multline*",
    "split",
}


def ensure_artifacts_dir(paper_id: str) -> str:
    latex_dir = get_paper_latex_dir(paper_id)
    artifacts_dir = os.path.join(latex_dir, "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)
    return artifacts_dir


def reset_artifacts_dir(paper_id: str) -> str:
    artifacts_dir = ensure_artifacts_dir(paper_id)
    for name in os.listdir(artifacts_dir):
        path = os.path.join(artifacts_dir, name)
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
    return artifacts_dir


ARTIFACT_PATHS = {
    "00_plan_evidence": "artifacts/evidence.json",
    "02_code_artifacts": "artifacts/code_artifacts.json",
    "02_paper_brief": "artifacts/brief.json",
    "03_outline": "artifacts/outline.json",
    "08_assemble_latex": "artifacts/assembly.json",
    "09_latex_compile_agent": "artifacts/feedback/round_01/compile.json",
    "10_simple_review_compile_agent": "artifacts/feedback/round_01/compile.json",
    "10_simple_review_loop": "artifacts/feedback/round_01/review.json",
    "feedback_rewrite_latex_compile": "artifacts/feedback/round_01/rewrite_compile.json",
    "feedback_rewrite_simple_review": "artifacts/feedback/round_01/rewrite_review.json",
}


def write_artifact(
    paper_id: str,
    step_id: str,
    data: Dict[str, Any],
    summary_lines: List[str],
    artifact_path: str | None = None,
) -> List[str]:
    json_path = artifact_path or ARTIFACT_PATHS.get(step_id, f"artifacts/{step_id}.json")
    payload = {
        "_artifact": {
            "id": step_id,
            "path": json_path,
            "summaryLines": summary_lines,
        },
        **data,
    }
    write_paper_file(paper_id, json_path, json.dumps(payload, ensure_ascii=False, indent=2))
    return [json_path]


def stable_context_fingerprint(*parts: Any) -> str:
    """Return a stable short fingerprint for cache invalidation inputs."""
    payload = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    text = text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1]
        if "```" in text:
            text = text.rsplit("```", 1)[0]
    elif "```" in text:
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
        elif len(parts) >= 2:
            text = parts[1]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _clean_label_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", value or "").strip("_").lower()
    return cleaned or "figure"


def figure_record_to_entry(fig: Dict[str, Any], source: str = "selected") -> Optional[Dict[str, Any]]:
    """Normalize an experiment figure record into the paper figure entry shape."""
    path = str(fig.get("path") or "").strip()
    base_name = str(fig.get("filename") or "").strip()
    ext = str(fig.get("ext") or "").lstrip(".").strip()

    file_name = None
    if not base_name:
        file_name = (
            fig.get("fileNamePdf")
            or fig.get("fileNamePng")
            or fig.get("fileName")
        )
    if not file_name and not base_name:
        for path_key in ("pdfPath", "pngPath", "pathPdf", "pathPng"):
            path_value = fig.get(path_key)
            if path_value:
                file_name = os.path.basename(path_value)
                break
    if not file_name and path and not base_name:
        file_name = os.path.basename(path)
    if not file_name and not base_name:
        return None

    if file_name:
        base_name, file_ext = os.path.splitext(os.path.basename(file_name))
        ext = ext or file_ext.lstrip(".")
    ext = ext or "png"
    figure_id = fig.get("figureId") or fig.get("id") or base_name
    title = fig.get("title") or fig.get("figureType") or base_name.replace("_", " ")
    caption = fig.get("caption") or title
    label = fig.get("latexLabel") or fig.get("label") or f"fig:{_clean_label_part(str(figure_id))}"
    include = fig.get("include", True)
    if isinstance(include, str):
        include = include.lower() not in {"0", "false", "no", "off"}

    return {
        "figureId": figure_id,
        "filename": base_name,
        "ext": ext,
        "path": path or f"figures/{base_name}.{ext}",
        "caption": caption,
        "label": label,
        "title": title,
        "figureType": fig.get("figureType"),
        "experimentId": fig.get("experimentId"),
        "targetSection": fig.get("targetSection") or fig.get("target_section") or "",
        "notes": fig.get("notes") or "",
        "include": bool(include),
        "source": source,
    }


def dedupe_figure_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    unique: List[Dict[str, Any]] = []
    for entry in entries:
        key = entry.get("filename") or entry.get("label")
        if key in seen:
            continue
        seen.add(key)
        unique.append(entry)
    return unique


def load_linked_figure_records(paper: Dict[str, Any], max_figures: int = 8) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    seen = set()

    def add_figure(fig: Optional[Dict[str, Any]]) -> None:
        if not fig or len(records) >= max_figures:
            return
        fig_id = fig.get("id") or fig.get("figureId")
        key = fig_id or fig.get("fileNamePng") or fig.get("fileNamePdf") or fig.get("title")
        if key in seen:
            return
        seen.add(key)
        records.append(fig)

    try:
        from app.storage.experiment_storage import get_figure, list_figures

        for fig_id in paper.get("figureIds", [])[:max_figures]:
            add_figure(get_figure(fig_id))

        if len(records) < max_figures:
            for exp_id in paper.get("experimentIds", [])[:3]:
                for fig in list_figures(exp_id)[:max_figures]:
                    add_figure(fig)
                    if len(records) >= max_figures:
                        break
    except Exception:
        pass

    return records


def load_selected_figure_entries(
    paper: Dict[str, Any],
    ensure_copied: bool = False,
    max_figures: int = 8,
) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    paper_id = paper.get("id")
    for item in paper.get("selectedFigures", []) or []:
        if len(entries) >= max_figures:
            break
        if not isinstance(item, dict):
            continue

        source_record = item
        if paper_id:
            try:
                from app.modules.paper.storage import normalize_paper_figure

                normalized = normalize_paper_figure(
                    paper_id,
                    item,
                    ensure_copied=ensure_copied,
                )
                if normalized:
                    source_record = normalized
            except Exception:
                source_record = item

        entry = figure_record_to_entry(source_record, source="selected")
        if entry and entry.get("include", True):
            entries.append(entry)

    return dedupe_figure_entries(entries)


def get_linked_figure_entries(
    paper: Dict[str, Any],
    ensure_copied: bool = False,
    max_figures: int = 8,
) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    paper_id = paper.get("id")

    if paper.get("selectedFiguresExplicit") or paper.get("selectedFigures"):
        return load_selected_figure_entries(
            paper,
            ensure_copied=ensure_copied,
            max_figures=max_figures,
        )

    selected_entries = load_selected_figure_entries(
        paper,
        ensure_copied=ensure_copied,
        max_figures=max_figures,
    )
    if selected_entries:
        return selected_entries

    for fig in load_linked_figure_records(paper, max_figures=max_figures):
        source_record = fig
        if ensure_copied and paper_id:
            try:
                from app.modules.paper.storage import copy_figure_to_paper

                figure_id = fig.get("id") or fig.get("figureId")
                if figure_id:
                    copied = copy_figure_to_paper(paper_id, figure_id, select=False)
                    if copied:
                        source_record = {**fig, **copied}
            except Exception:
                source_record = fig

        entry = figure_record_to_entry(source_record, source="selected")
        if entry:
            entries.append(entry)

    return dedupe_figure_entries(entries)


def collect_context(paper: Dict[str, Any]) -> Dict[str, str]:
    ctx = {
        "plan_context": "N/A",
        "plan_evidence": "N/A",
        "code_evidence": "N/A",
        "project_summary": "N/A",
        "metrics_summary": "N/A",
        "runs_summary": "N/A",
        "figures_summary": "N/A",
        "code_tables_summary": "N/A",
        "user_notes": "N/A",
        "evidence_constraints": "N/A",
    }

    plan_link_id = paper.get("planLinkId")
    if plan_link_id:
        try:
            from app.modules.platform.storage import get_plan_link
            link_data = get_plan_link(plan_link_id)
      
```

### Core Architecture Module: `backend/app/modules/review/mismatch_scorer.py`
```
"""Mismatch scoring and claim-evidence graph export for ReviewX.

This module turns ReviewX's local checks into experiment-ready measurements.
The score is intentionally deterministic so local_only, balanced, and deep
runs can be compared without hidden model variance.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

from app.modules.review.reviewx_models import Claim, Evidence, EvidenceVerification, Finding


_STATUS_SCORE = {
    "supported": 0.12,
    "weakly_supported": 0.48,
    "artifact_absent": 0.22,
    "needs_human_verification": 0.4,
    "unsupported": 0.82,
    "contradicted": 1.0,
    "not_applicable": 0.0,
}

_VERIFIER_DIMENSION = {
    "numeric_metric": "numeric",
    "baseline_coverage": "baseline",
    "citation_context": "citation",
    "brief_guardrail": "guardrail",
    "general_evidence": "general",
}


def build_mismatch_report(
    claims: List[Claim],
    evidence: List[Evidence],
    links: Dict[str, List[str]],
    verifications: List[EvidenceVerification],
    findings: List[Finding],
) -> Dict[str, Any]:
    evidence_by_id = {ev.id: ev for ev in evidence}
    verifications_by_claim: Dict[str, List[EvidenceVerification]] = {}
    findings_by_claim: Dict[str, List[Finding]] = {}
    for verification in verifications:
        verifications_by_claim.setdefault(verification.claimId, []).append(verification)
    for finding in findings:
        if finding.claimId:
            findings_by_claim.setdefault(finding.claimId, []).append(finding)

    claim_scores = []
    for claim in claims:
        claim_verifications = verifications_by_claim.get(claim.id, [])
        claim_findings = findings_by_claim.get(claim.id, [])
        linked_ids = [eid for eid in links.get(claim.id, []) if eid in evidence_by_id]
        score, raw_score, dimensions, reasons, calibration = _score_claim(
            claim, linked_ids, claim_verifications, claim_findings
        )
        claim_scores.append({
            "claimId": claim.id,
            "claimType": claim.claimType,
            "importance": claim.importance,
            "requiresEvidence": claim.requiresEvidence,
            "mismatchScore": score,
            "rawMismatchScore": raw_score,
            "supportStatus": _worst_support_status(claim_verifications),
            "supportStatuses": sorted({
                verification.supportStatus for verification in claim_verifications
            }),
            "linkedEvidenceCount": len(linked_ids),
            "findingIds": [finding.id for finding in claim_findings],
            "verificationIds": [verification.id for verification in claim_verifications],
            "dimensions": dimensions,
            "calibration": calibration,
            "reasons": reasons,
            "text": claim.text,
            "sourceSpan": claim.sourceSpan.to_dict() if hasattr(claim.sourceSpan, "to_dict") else {
                "file": claim.sourceSpan.file,
                "section": claim.sourceSpan.section,
                "line": claim.sourceSpan.line,
            },
        })

    aggregate = _aggregate_scores(claim_scores)
    graph = _build_graph(claims, evidence, links, verifications, findings, claim_scores)
    return {
        "method": {
            "name": "CEM-Review",
            "metric": "Claim-Evidence Mismatch",
            "formula": "M(c,E)=max(coverage_gap,numeric_contradiction,baseline_gap,citation_gap,guardrail_violation,review_risk,importance)",
            "thresholds": {
                "shallowTraceability": 0.3,
                "deepContradictionRevision": 0.72,
            },
        },
        "aggregate": aggregate,
        "claimScores": claim_scores,
        "graph": graph,
    }


def _score_claim(
    claim: Claim,
    linked_ids: List[str],
    verifications: List[EvidenceVerification],
    findings: List[Finding],
) -> tuple[float, float, Dict[str, float], List[str], Dict[str, Any]]:
    dimensions: Dict[str, float] = {}
    reasons: List[str] = []

    statuses = {verification.supportStatus for verification in verifications}
    if claim.requiresEvidence and not linked_ids:
        if "artifact_absent" in statuses and not (statuses & {"unsupported", "contradicted"}):
            dimensions["coverage"] = 0.25
            reasons.append("external_structured_artifact_absent")
        else:
            dimensions["coverage"] = 0.9
            reasons.append("requires_evidence_but_no_linked_artifact")
    elif claim.requiresEvidence and linked_ids:
        dimensions["coverage"] = 0.2
    else:
        dimensions["coverage"] = 0.0

    for verification in verifications:
        dimension = _VERIFIER_DIMENSION.get(verification.verifierType, verification.verifierType)
        value = _STATUS_SCORE.get(verification.supportStatus, 0.5) * verification.confidence
        dimensions[dimension] = max(dimensions.get(dimension, 0.0), round(value, 3))
        if verification.supportStatus in {"unsupported", "contradicted", "needs_human_verification", "artifact_absent"}:
            reasons.append(f"{verification.verifierType}:{verification.supportStatus}")

    if findings:
        severity_score = max(_finding_score(finding) for finding in findings)
        dimensions["review_risk"] = severity_score
        reasons.extend([f"finding:{finding.id}:{finding.severity}" for finding in findings[:3]])

    if claim.importance == "high":
        dimensions["importance"] = max(dimensions.get("importance", 0.0), 0.18)

    raw_score = min(1.0, round(max(dimensions.values() or [0.0]), 3))
    score, calibration = _calibrate_score(raw_score, findings)
    return score, raw_score, dimensions, reasons[:8], calibration


def _calibrate_score(score: float, findings: List[Finding]) -> tuple[float, Dict[str, Any]]:
    if not findings:
        return score, {"llmFactor": 1.0, "revisionAdjustment": 0.0}

    decisions = [finding.reviewerDecision for finding in findings if finding.reviewerDecision]
    if "valid" in decisions:
        llm_factor = 1.0
        llm_decision = "valid"
    elif "partially_valid" in decisions:
        llm_factor = 0.9
        llm_decision = "partially_valid"
    elif "overestimated" in decisions:
        llm_factor = 0.65
        llm_decision = "overestimated"
    else:
        llm_factor = 1.0
        llm_decision = None

    revision_adjustment = max(
        (
            float(finding.cemCalibration.get("revisionAdjustment", 0.0))
            for finding in findings
            if finding.cemCalibration
        ),
        default=0.0,
    )
    revision_statuses = [
        finding.revisionStatus
        for finding in findings
        if finding.revisionStatus
    ]
    calibrated = round(max(0.0, min(1.0, score * llm_factor - revision_adjustment)), 3)
    return calibrated, {
        "llmDecision": llm_decision,
        "llmFactor": llm_factor,
        "revisionAdjustment": round(revision_adjustment, 3),
        "revisionStatuses": revision_statuses,
    }


def _finding_score(finding: Finding) -> float:
    severity = {
        "blocker": 0.95,
        "major": 0.72,
        "minor": 0.42,
        "info": 0.18,
    }.get(finding.severity, 0.5)
    return round(max(severity, finding.confidence), 3)


def _worst_support_status(verifications: List[EvidenceVerification]) -> str | None:
    if not verifications:
        return None
    priority = {
        "contradicted": 0,
        "unsupported": 1,
        "needs_human_verification": 2,
        "artifact_absent": 3,
        "weakly_supported": 4,
        "supported": 5,
        "not_applicable": 6,
    }
    return min(verifications, key=lambda item: priority.get(item.supportStatus, 9)).supportStatus


def _aggregate_scores(claim_scores: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not claim_scores:
        return {
            "meanMismatch": 0,
            "maxMismatch": 0,
            "highMismatchClaimCount": 0,
            "claimCount": 0,
            "supportCounts": {},
            "dimensionMax": {},
        }
    values = [float(item["mismatchScore"]) for item in claim_scores]
    support_counts = Counter(item.get("supportStatus") or "not_checked" for item in claim_scores)
    dimension_max: Dict[str, float] = {}
    for item in claim_scores:
        for name, value in item.get("dimensions", {}).items():
            dimension_max[name] = max(dimension_max.get(name, 0.0), float(value))
    return {
        "meanMismatch": round(sum(values) / len(values), 3),
        "maxMismatch": round(max(values), 3),
        "highMismatchClaimCount": len([value for value in values if value >= 0.72]),
        "claimCount": len(claim_scores),
        "supportCounts": dict(support_counts),
        "dimensionMax": {name: round(value, 3) for name, value in sorted(dimension_max.items())},
    }


def _build_graph(
    claims: List[Claim],
    evidence: List[Evidence],
    links: Dict[str, List[str]],
    verifications: List[EvidenceVerification],
    findings: List[Finding],
    claim_scores: List[Dict[str, Any]],
) -> Dict[str, Any]:
    claim_score_by_id = {item["claimId"]: item for item in claim_scores}
    nodes = []
    edges = []

    for claim in claims:
        score = claim_score_by_id.get(claim.id, {})
        nodes.append({
            "id": claim.id,
            "nodeType": "claim",
            "label": claim.text[:120],
            "claimType": claim.claimType,
            "mismatchScore": score.get("mismatchScore", 0),
            "rawMismatchScore": score.get("rawMismatchScore", 0),
            "supportStatus": score.get("supportStatus"),
        })
        for evidence_id in links.get(claim.id, [])[:8]:
            edges.append({
                "id": f"edge_{claim.id}_{evidence_id}",
                "source": claim.id,
                "target": evidence_id,
                "edgeType": "linked_to",
            })

    for ev in evidence:
        nodes.append({
            "id": ev.id,
            "nodeType": "evidence",
            "label": ev.summary[:120],
      
```

### Core Architecture Module: `backend/app/services/code_agent_loop.py`
```
"""
CodeAgentLoop — Autonomous code execution agent with self-healing.

Orchestrates a Think → Execute → Observe → Repair loop:
1. PLAN:   Analyze project structure, LLM decides what command to run
2. EXEC:   Run command in sandbox (Docker or subprocess)
3. OBSERVE: Capture stdout/stderr/exit_code, classify failure type
4. REPAIR: Call CodeRepairService (deterministic fixes + LLM fixes)
5. REPEAT: Up to MAX_ITERATIONS times, or until success
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from app.core.user_context import call_with_current_context
from app.code.sandbox import (
    ExecutionEvent,
    ExecutionTrace,
    SandboxPool,
    SandboxResult,
    get_sandbox_pool,
)

logger = logging.getLogger(__name__)

# Defaults
DEFAULT_MAX_ITERATIONS = 3
DEFAULT_EXECUTION_TIMEOUT = 300
DEFAULT_LANGUAGE = "python"


@dataclass
class AgentLoopResult:
    """Result of an autonomous agent run."""

    status: str  # "succeeded", "failed", "max_iterations", "error"
    iterations: int = 0
    final_result: Optional[SandboxResult] = None
    repair_report: Any = None  # AutoFixReport (lazy import)
    trace: Optional[ExecutionTrace] = None
    error: str = ""
    events: list[dict] = field(default_factory=list)

    @property
    def success(self) -> bool:
        return self.status == "succeeded"

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "iterations": self.iterations,
            "exit_code": self.final_result.exit_code if self.final_result else None,
            "stdout_tail": (
                self.final_result.stdout[-500:]
                if self.final_result and self.final_result.stdout
                else ""
            ),
            "stderr_tail": (
                self.final_result.stderr[-500:]
                if self.final_result and self.final_result.stderr
                else ""
            ),
            "duration_ms": (
                self.final_result.duration_ms if self.final_result else 0
            ),
            "error": self.error,
            "trace_id": self.trace.trace_id if self.trace else None,
            "events": self.events,
        }


class CodeAgentLoop:
    """Autonomous code execution agent.

    Loop (per iteration):
    1. PLAN:    LLM plans the execution command
    2. EXEC:    SandboxPool.execute() runs it
    3. OBSERVE: Parse result, classify failure
    4. REPAIR:  CodeRepairService.auto_fix() if failed
    5. GOTO 2   (up to max_iterations)

    On success, returns immediately. If all iterations exhausted,
    returns final failed result with repair history.
    """

    def __init__(
        self,
        pool: Optional[SandboxPool] = None,
        provider_name: str = "qwen",
        model: str = "qwen-max",
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        execution_timeout: int = DEFAULT_EXECUTION_TIMEOUT,
        backend: Optional[str] = None,
    ):
        self._pool = pool
        self._provider_name = provider_name
        self._model = model
        self.max_iterations = max_iterations
        self.execution_timeout = execution_timeout
        self.backend = backend

    async def run(
        self,
        project_id: str,
        repo_dir: str,
        goal: str = "",
        language: str = DEFAULT_LANGUAGE,
        command: Optional[str] = None,
        on_event: Optional[Callable[[ExecutionEvent], None]] = None,
        trace_id: Optional[str] = None,
    ) -> AgentLoopResult:
        """Execute the autonomous agent loop for a project.

        Args:
            project_id: CodeProject identifier.
            repo_dir: Path to the project repository on disk.
            goal: Human-readable goal for the agent.
            language: Programming language ("python", etc.).
            command: Optional explicit command. If None, LLM plans it.
            on_event: Optional callback for streaming events.
            trace_id: Optional trace identifier. If not provided, a new one is generated.

        Returns:
            AgentLoopResult with status, trace, and execution details.
        """
        pool = self._pool or await get_sandbox_pool()
        trace = ExecutionTrace(
            trace_id=trace_id or _generate_trace_id(),
            project_id=project_id,
            goal=goal or f"Execute and validate {language} project",
        )

        sandbox_id = None
        events: list[dict] = []

        try:
            # ---- Phase 0: Validate project ----
            if not os.path.isdir(repo_dir):
                return AgentLoopResult(
                    status="error",
                    error=f"Repo directory not found: {repo_dir}",
                    trace=trace,
                )

            # ---- Phase 1: PLAN ----
            trace.record(ExecutionEvent(
                step="plan", status="started",
                message="Analyzing project and planning execution...",
            ))

            if command:
                final_command = command
                trace.record(ExecutionEvent(
                    step="plan", status="succeeded",
                    message=f"Using provided command: {command[:200]}",
                    details={"command": command},
                ))
            else:
                final_command = await self._plan_command(
                    repo_dir, goal, language
                )
                trace.record(ExecutionEvent(
                    step="plan", status="succeeded",
                    message=f"Planned command: {final_command[:200]}",
                    details={"command": final_command},
                ))
            events.append({"phase": "plan", "command": final_command})

            # ---- Phase 2: Sandbox Setup ----
            trace.record(ExecutionEvent(
                step="setup", status="started",
                message=f"Acquiring sandbox (backend={pool.default_backend})...",
            ))

            try:
                sandbox_id = await pool.acquire(
                    workspace_path=repo_dir,
                    backend_type=self.backend,
                )
                trace.record(ExecutionEvent(
                    step="setup", status="succeeded",
                    sandbox_id=sandbox_id,
                    message=f"Sandbox acquired: {sandbox_id}",
                ))
            except Exception as exc:
                logger.error("Failed to acquire sandbox: %s", exc)
                trace.record(ExecutionEvent(
                    step="setup", status="failed",
                    message=f"Sandbox acquisition failed: {exc}",
                ))
                return AgentLoopResult(
                    status="error",
                    error=f"Sandbox setup failed: {exc}",
                    trace=trace,
                    events=events,
                )

            events.append({"phase": "setup", "sandbox_id": sandbox_id})

            # ---- Phase 3: Main execute-observe-repair loop ----
            iteration = 0
            last_result: Optional[SandboxResult] = None
            repair_report = None

            while iteration < self.max_iterations:
                iteration += 1
                logger.info(
                    "Agent loop iteration %d/%d (project=%s)",
                    iteration, self.max_iterations, project_id,
                )

                # EXECUTE
                trace.record(ExecutionEvent(
                    step="execute", status="started",
                    iteration=iteration,
                    message=f"Iteration {iteration}: executing...",
                ))

                result = await pool.execute(
                    sandbox_id, final_command,
                    timeout=self.execution_timeout,
                )
                trace.record(ExecutionEvent(
                    step="execute",
                    status="succeeded" if result.success else "failed",
                    iteration=iteration,
                    message=(
                        f"Exit code {result.exit_code}, "
                        f"{result.duration_ms}ms"
                    ),
                    details=result.to_dict(),
                    duration_ms=result.duration_ms,
                ))
                last_result = result

                events.append({
                    "phase": "execute",
                    "iteration": iteration,
                    "exit_code": result.exit_code,
                    "timed_out": result.timed_out,
                    "duration_ms": result.duration_ms,
                    "stdout_tail": result.stdout[-300:] if result.stdout else "",
                    "stderr_tail": result.stderr[-300:] if result.stderr else "",
                })

                # OBSERVE
                if result.success:
                    trace.record(ExecutionEvent(
                        step="complete", status="succeeded",
                        iteration=iteration,
                        message=f"Project executed successfully in {iteration} iteration(s)",
                        duration_ms=result.duration_ms,
                    ))
                    return AgentLoopResult(
                        status="succeeded",
                        iterations=iteration,
                        final_result=result,
                        repair_report=repair_report,
                        trace=trace,
                        events=events,
                    )

                # Classify failure
                failure_type = self._classify_failure(result)
                trace.record(ExecutionEvent(
                    step="observe", status="failed",
                    iteration=iteration,
                    message=f"Failure detected: {failure_type}",
                    details={
                        "failure_type": failure_type,
                        "exit_code":
```

### Core Architecture Module: `backend/app/services/pdf_renderer.py`
```
"""
PDF Renderer — Generates a formatted research PDF from paper content using fpdf2.

This produces a readable, research-grade PDF without requiring a LaTeX compiler.
The LaTeX bundle is always generated separately for camera-ready compilation.
"""

import os
import re
import logging
import subprocess
from typing import Dict, List, Optional, Any

from app.core.user_context import sanitized_subprocess_env

logger = logging.getLogger(__name__)


def compile_latex_project(project_dir: str, main_tex: str = "main.tex", engine: str = "auto", timeout: int = 180) -> str:
    """Compile a LaTeX paper project using latexmk, returning the generated PDF path."""
    pdf_path = os.path.join(project_dir, os.path.splitext(main_tex)[0] + ".pdf")
    engine_flag = "-pdf"
    if engine == "xelatex" or (engine == "auto" and _requires_xelatex(os.path.join(project_dir, main_tex))):
        engine_flag = "-xelatex"
    cmd = [
        "latexmk",
        engine_flag,
        "-interaction=nonstopmode",
        "-halt-on-error",
        main_tex,
    ]
    try:
        result = subprocess.run(
            cmd,
            cwd=project_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env=sanitized_subprocess_env(),
        )
    except subprocess.TimeoutExpired as exc:
        tail = "\n".join((exc.stdout or "").splitlines()[-20:] + (exc.stderr or "").splitlines()[-20:])
        raise RuntimeError(f"latexmk timed out after {timeout}s for {main_tex}: {tail[:2000]}") from exc
    if result.returncode != 0 or not os.path.isfile(pdf_path):
        tail = "\n".join((result.stdout or "").splitlines()[-20:] + (result.stderr or "").splitlines()[-20:])
        raise RuntimeError(f"latexmk failed for {main_tex}: {tail[:2000]}")
    logger.info(f"LaTeX project compiled: {pdf_path}")
    return pdf_path


def _requires_xelatex(main_tex_path: str) -> bool:
    try:
        content = open(main_tex_path, "r", encoding="utf-8", errors="ignore").read(4096)
    except OSError:
        return False
    return any(marker in content for marker in ("ctexart", "ctexbook", "ctexrep", "xeCJK", "fontspec"))


def render_paper_pdf(
    output_path: str,
    title: str,
    authors: List[str],
    abstract: str,
    sections: List[Dict[str, str]],
    references: List[Dict[str, Any]],
    figures_dir: Optional[str] = None,
    figure_entries: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    Render a research paper as a formatted PDF.

    Args:
        output_path: Where to write the PDF
        title: Paper title
        authors: List of author names
        abstract: Abstract text
        sections: List of {title, content} dicts
        references: List of reference dicts with keys: key, authors, title, venue, year
        figures_dir: Directory containing figure images
        figure_entries: List of {filename, ext, caption, label} dicts

    Returns:
        Path to generated PDF
    """
    from fpdf import FPDF

    class PaperPDF(FPDF):
        def header(self):
            if self.page_no() > 1:
                _set_pdf_font(self, "I", 8)
                self.set_text_color(128, 128, 128)
                short_title = title[:60] + "..." if len(title) > 60 else title
                self.cell(0, 5, _pdf_text(self, short_title), align="C")
                self.ln(8)

        def footer(self):
            self.set_y(-15)
            _set_pdf_font(self, "I", 8)
            self.set_text_color(128, 128, 128)
            self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    pdf = PaperPDF(orientation="P", unit="mm", format="A4")
    font_family = _register_unicode_font(pdf)
    pdf._faros_font_family = font_family or "Helvetica"
    pdf._faros_unicode_font = bool(font_family)
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── Title ──
    _set_pdf_font(pdf, "B", 16)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(0, 8, _pdf_text(pdf, title), align="C")
    pdf.ln(3)

    # ── Authors ──
    _set_pdf_font(pdf, "", 11)
    pdf.set_text_color(60, 60, 60)
    authors_str = ", ".join(authors) if authors else "Anonymous"
    pdf.multi_cell(0, 6, _pdf_text(pdf, authors_str), align="C")
    pdf.ln(6)

    # ── Abstract ──
    _set_pdf_font(pdf, "B", 11)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 7, "Abstract", ln=True)
    _set_pdf_font(pdf, "I", 9.5)
    pdf.set_text_color(30, 30, 30)
    clean_abstract = _strip_latex(abstract, preserve_unicode=bool(getattr(pdf, "_faros_unicode_font", False)))
    pdf.multi_cell(0, 5, clean_abstract)
    pdf.ln(4)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)

    # ── Sections ──
    fig_idx = 0
    for sec in sections:
        sec_title = sec.get("title", "Section")
        sec_content = sec.get("content", "")

        # Section heading
        _set_pdf_font(pdf, "B", 12)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 7, _pdf_text(pdf, sec_title))
        pdf.ln(2)

        # Section body — strip LaTeX commands for readable text
        clean = _strip_latex(sec_content, preserve_unicode=bool(getattr(pdf, "_faros_unicode_font", False)))
        _set_pdf_font(pdf, "", 9.5)
        pdf.set_text_color(30, 30, 30)

        # Split into paragraphs
        paragraphs = [p.strip() for p in clean.split("\n\n") if p.strip()]
        for para in paragraphs:
            if para.startswith("Algorithm") or para.startswith("ALGORITHM"):
                # Render algorithm block
                _render_algorithm_block(pdf, para)
            elif _is_table_block(para):
                _render_table_block(pdf, para)
            elif _is_equation_line(para):
                _render_equation(pdf, para)
            else:
                pdf.multi_cell(0, 5, para)
                pdf.ln(2)

        # Insert a figure after experiments-like sections
        if figure_entries and figures_dir and fig_idx < len(figure_entries):
            sec_lower = sec_title.lower()
            if any(kw in sec_lower for kw in ["experiment", "result", "analysis", "ablation", "method"]):
                _insert_figure(pdf, figures_dir, figure_entries[fig_idx])
                fig_idx += 1

    # ── Insert remaining figures ──
    if figure_entries and figures_dir:
        while fig_idx < len(figure_entries):
            _insert_figure(pdf, figures_dir, figure_entries[fig_idx])
            fig_idx += 1

    # ── References ──
    pdf.add_page()
    _set_pdf_font(pdf, "B", 12)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 7, "References", ln=True)
    pdf.ln(2)
    _set_pdf_font(pdf, "", 8)
    pdf.set_text_color(40, 40, 40)
    for i, ref in enumerate(references, 1):
        ref_text = f"[{i}] {ref.get('authors', 'Unknown')}. " \
                   f"\"{ref.get('title', 'Untitled')}.\" " \
                   f"{ref.get('venue', 'Preprint')}, {ref.get('year', 2024)}."
        pdf.multi_cell(0, 4, _pdf_text(pdf, ref_text))
        pdf.ln(1)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf.output(output_path)
    logger.info(f"PDF rendered: {output_path} ({pdf.page_no()} pages)")
    return output_path


def _register_unicode_font(pdf) -> Optional[str]:
    candidates = [
        os.environ.get("FAROS_PDF_FONT"),
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
    ]
    for path in candidates:
        if not path or not os.path.isfile(path):
            continue
        try:
            pdf.add_font("FarosUnicode", "", path)
            return "FarosUnicode"
        except Exception as exc:
            logger.debug("Failed to load PDF unicode font %s: %s", path, exc)

    latin_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    cjk_path = "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
    if os.path.isfile(latin_path) and os.path.isfile(cjk_path):
        try:
            pdf.add_font("FarosUnicode", "", latin_path)
            pdf.add_font("FarosCJKFallback", "", cjk_path)
            pdf.set_fallback_fonts(["FarosCJKFallback"], exact_match=False)
            return "FarosUnicode"
        except Exception as exc:
            logger.debug(
                "Failed to load composite PDF fonts %s + %s: %s",
                latin_path,
                cjk_path,
                exc,
            )
    return None


def _set_pdf_font(pdf, style: str, size: float) -> None:
    family = getattr(pdf, "_faros_font_family", "Helvetica")
    if getattr(pdf, "_faros_unicode_font", False):
        pdf.set_font(family, "", size)
    else:
        pdf.set_font(family, style, size)


def _pdf_text(pdf, text: str) -> str:
    if getattr(pdf, "_faros_unicode_font", False):
        return text or ""
    return _sanitize_unicode(text or "")


def _sanitize_unicode(text: str) -> str:
    """Replace unicode characters that latin-1 can't encode with ASCII equivalents."""
    replacements = {
        '\u2014': '--', '\u2013': '-', '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u2022': '*',
        '\u00a0': ' ', '\u2003': ' ', '\u2002': ' ', '\u200b': '',
        '\u2212': '-', '\u00d7': 'x', '\u2264': '<=', '\u2265': '>=',
        '\u2260': '!=', '\u221e': 'inf', '\u2208': 'in', '\u2209': 'not in',
        '\u2211': 'sum', '\u220f': 'prod', '\u222b': 'int',
        '\u03b1': 'alpha', '\u03b2': 'beta', '\u03b3': 'gamma', '\u03b4': 'delta',
        '\u03b5': 'epsilon', '\u03b8': 'theta', '\u03bb': 'lambda', '\u03bc': 'mu',
        '\u03c0': 'pi', '\u03c3': 'sigma', '\u03c4': 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #42** (2026-08-12): **feat(paper): 重构 FAROS paper 写作流程，引入 compile/review 多 agent 反馈循环**
  *Symptoms*: ## 概述  本 PR 重构了 FAROS paper 模块的论文写作流程和前端页面，引入了多 agent 协作的论文生成与反馈修改循环。  新的 paper writing 流程中，三个 agent 分工如下：  - Writing agent：负责论文撰写和根据反馈进行局部修改 - LaTeX compile agent：负责 LaTeX 编译，并只返回编译反馈 - Simple review agent：负责格式、规范、图表、artifact 使用情况等非原理性审查，并只返回审查反馈  Compile agent 和 review agent 不直接修改论文内容。所有修改都由 writing agent 根据反馈进行。  ## 主要改动  ### 后端  - 使用独立的 LaTeX compile agent 替代原有 compile 步骤。 - 移除旧的 `compile_pdf` / 通用 figure 生成路径。 - 删除 `figure_generate`，避免论文中引入通用占位图表。 - 引入反馈修改循环：   - Writing -> Compile   - Compile 失败或有问题时，反馈给 Writing 修改   - Compile 通过后，交给 Simple review   - Review 有修改意见时，反馈给 Writing 修改   - Writing 修改后进入下一轮 Compile - 细化论文最终状态：   - 只有 LaTeX 编译成功且 simple review 通过时，才标记为完成   - 区分编译失败和 review 后仍有问题 - 完善 code evidence 收集：   - 支持收集 CART 结构下的代码成果、实验指标、实验结果、图表和分析   - Brief 中不直接拷贝 code artifact 的图表内容，而是通过 label、文件名、位置和分析信息进行关联 - 重整 paper artifacts：   - artifact 改为 JSON-only   - feedback artifact 按 loop round 组织：     - `artifacts/feedback/round_XX/compile.json`     - `artifacts/feedback/round_XX/review.json`     - `artifacts/feedback/round_XX/rewrite_compile.json`     - `artifacts/feedback/round_XX/rewrite_review.json`  ### 前端  - 将 paper writing 前端重构为 4 步流程：   1. 起始阶段：paper、template、模块链接和 evidence 展示   2. Brief 阶段：paper brief 和 section brief 编辑   3. Feedback writing 阶段：展示 agent 交互、步骤计时和反馈循环   4. 结果展示阶段：展示论文文件和 PDF 预览 - 点击 new paper 后直接进入 4 步 writing 页面。 - Template 决定论文模板和 venue，不再单独选择 venue。 - 在 paper 列表中增加删除论文功能。 - 改进 agent feedback 展示：

- **Issue #41** (2026-08-11): **feat(code): 完善科学执行评估、可复现实验证据与结果导入流程**
  *Symptoms*: ## 变更概述  本 PR 根据挑战杯统一开发任务书完善 FAROS Code 模块，将原有代码生成功能扩展为“科学任务可执行性判断—真实实验执行—证据留存—结果反馈”的完整流程，同时修复 PlanPackage 生成代码和成品样例加载问题。  ## 主要改动  ### 1. 科学执行评估与门禁  - 从 PlanPackage/ResearchDossier 生成 ExecutionAssessment。 - 支持以下七类执行判定：   - computational_ready   - simulation_ready   - data_required   - instrument_required   - ethics_review_required   - proof_required   - protocol_only - 在进入 Blueprint/沙箱前执行科学可执行性 Gate。 - 缺少数据、仪器、伦理审批或属于证明/协议任务时，不再错误进入代码执行。  ### 2. 可复现实验证据  - 新增 ExperimentEvidence 生成与校验。 - 记录并校验：   - 代码 Hash   - 环境 Hash   - 数据和配置 Hash   - 指标   - 日志与 ArtifactRef - 只有真实产物完整存在时才输出 executed。 - 产物缺失、执行失败或 Cart 未正常结束时自动降级为 failed。 - 将指标、异常和失败原因转换成结构化计划反馈。  ### 3. Generate from Plan Bug 修复  - 修复前端传入 `ppkg_*` PlanPackage，而后端仅识别旧版 `psess_* / cplan_*` 的兼容问题。 - CodeGen 现在可以正确读取 PlanPackage 中的：   - 标题   - 研究问题   - 研究方法   - Gap 分析   - Idea Session/Candidate 关联 - 无法解析计划时返回明确的 422 错误，不再静默使用默认上下文。  ### 4. 成品样例 ZIP 导入  - 新增安全的完整样例包导入与项目注册。 - 导入后自动完成：   - 创建 CodeProject 数据库记录   - 复制并索引项目代码   - 注册 PlanPackage   - 写入 cart_artifacts   - 关联 project_id、package_id 和 cart_id - 支持路径穿越、符号链接、文件数量、解压大小、Checksum 和 JSON 结构校验。 - 前端新增 Import Bundle 按钮，可通过系统文件管理器直接选择 ZIP。 - 导入成功后自动跳转到 Code 项目详情页。  ### 5. 代表性案例  新增两个可重复运行的案例：  1. UCI Iris 真实数据分析：    - 固定数据 Hash 和随机种子    - 最近质心分类器    - 多数类基线对比    - 输出真实指标、预测结果、日志和证据  2. Monte Carlo 仿真：    - 固定随机种子    - 多组样本预算参数比较    - 输出误差、参数结果和可复现证据  ## 新增接口  - `POST /api/v1/code/research/assess` - `POST 

- **Issue #36** (2026-08-04): **Devtzb paper**
  *Symptoms*: 1. 模版风格引导 2. 小节粒度写作控制 3. idea阶段材料整理，evidence支持writing 4. latex编译错误校正

- **Issue #25** (2026-08-11): **feat(idea): 搜索源扩充 + seed预检 + 公共契约对齐 + Review Gate修复 + 前端Dossier查看器**
  *Symptoms*: ## Idea 模块 P0 公共契约对齐 + Review Gate 修复 + 前端 Dossier 查看器  ### 提交历史 1. `849efcc` feat: 对齐公共契约，实现ResearchDossier全流程 2. `969cfc1` fix: session.config.seedQuery访问修复 + confounders回退 + 降级fixture测试 3. `7285fb3` fix: Review Gate refSupport阈值过高导致候选被误拒 4. `c0f1b0d` feat: 添加child-run API端点 + 前端Dossier查看器 + 文档更新  ### 功能清单 - **搜索源扩充**: Crossref/DBLP/CORE 三个免费源适配器 - **Seed预检**: POST /ideas/seed-check API + 前端检查按钮 + CJK分词修复 - **公共契约对齐**: ResearchDossier全流程 (problem_framing + research_dossier + budget_modes) - **Review Gate修复**: refSupport阈值4.5->3.5，解决候选被误拒问题 - **Child Run API**: POST /dossier/child-run 端点，支持Review反馈触发child run - **前端Dossier查看器**: 展示ProblemFrame/EvidenceMap/Hypotheses/ResearchPlan - **MODULE_HANDOFF文档**: 更新head commit/测试数/cap值/验收结果 - **百炼调用trace**: 阿里云百炼provider验证通过 (qwen-turbo, 3.7s)  ### 验收结果 (11/11 ALL PASS) - >=2候选假设: PASS (2个final候选, 1 strict + 1 relaxed) - >=1反证: PASS (19条counter evidence) - ProblemFrame: PASS - ResearchPlan: PASS (3步) - Qwen trace: PASS (provider=qwen, model=qwen-turbo) - 证伪条件: PASS - 混杂因素: PASS - 61个测试全通过 (含13个公共契约测试)  ### 文件变更 - `backend/app/modules/idea/problem_framing.py` -- ProblemFrame 生成 - `backend/app/modules/idea/research_dossier.py` -- ResearchDossier 构建器 - `backend/app/modules/idea/budget_modes.py` -- 预算配置 + 降级状态 - `backend/app/modules/idea/service.py` -- Review Gate refSupport阈值修复 - `backend/app/modules/idea/ideas_api.py` -- Dossier API + Child Run API端点 - `backend/app/contracts/MODULE_HANDOFF_idea.md` -- 模块交接文档 - `frontend/src/components/id

- **Issue #24** (2026-07-14): **feat: Idea Pipeline性能优化 + 强制多方向探索**
  *Symptoms*: ## 改动概述  对Idea生成Pipeline进行两类改进（5文件, +647/-117行）：  ### P0/P1 性能优化 - **搜索并行化**: ThreadPoolExecutor 5源并行查询 (190s→12s, 16x加速) - **BFTS语义评分**: n-gram token overlap替换关键词启发式 - **BFTS去重剪枝**: Jaccard阈值0.82自动跳过近重复节点 - **Ranking并行化**: ThreadPoolExecutor并行LLM评分 (FAROS_RANKING_CONCURRENCY) - **BFTS方向并行**: 多方向BFTS树并行执行 (FAROS_BFTS_DIRECTION_CONCURRENCY) - **RAG增强**: expandQuery/gapAnalysis注入文献上下文  ### 强制多方向探索 - GAP_ANALYSIS prompt要求>=3个独立研究方向(2维差异) - SEED_DIRECTION_DECOMPOSITION prompt强化方向独立性约束 - _enforce_min_opportunities: n-gram Jaccard去重 + typed fallback补充 - _deduplicate_research_directions_by_focus: 跨方向语义去重  ### 验证 - 方向多样性: 1→5个独立方向 - 候选方向覆盖: 0/5→5/5 - literatureSearch: 190.9s→12.4s (16x加速)  ### 环境变量 | 变量 | 默认值 | 说明 | |------|--------|------| | FAROS_SEARCH_PARALLELISM | 5 | 搜索源并行度 | | FAROS_RANKING_CONCURRENCY | 4 | Ranking并行度 | | FAROS_BFTS_DIRECTION_CONCURRENCY | 3 | BFTS方向并行度 | 

- **Issue #22** (2026-07-12): **fix: 修复中文(CJK)Topic系统性偏差 — 9个Bug修复 + 学术搜索增强**
  *Symptoms*: ## 问题 FAROS Idea 模块处理中文(CJK)研究主题时存在系统性偏差： Pipeline 候选 100% 偏离为 ML/工程领域主题，CJK 误报 30+。  ## 修复内容(9个Bug) - Bug1-3: fallback硬编码ML词汇 + 2处CJK正则 - Bug4-7: 本地语料库CJK支持+扩展15篇、RAG信号词条件化、repair跳过CJK、fallback模板领域无关 - Bug8: Idea Review Gate Jaccard CJK误判 → 传递englishSearchQueries扩充seed_tokens - Bug8b: 长文本Jaccard稀释 → containment fallback(≥2区分性token重叠即跳过) - Bug9: candidate_topic_drift_issues CJK误报 → 传递英文查询扩充seed_text  ## 学术搜索增强 - expandQuery: CJK查询自动翻译为英文，生成双路检索 - OpenAlex免费搜索源(20篇) + CNKI/万方接口预留 - 25+模型支持(前端provider配置扩展)

- **Issue #21** (2026-07-12): **Devtzb**
  *Symptoms*: 

- **Issue #19** (2026-07-06): **优化 Code 模块 PlanPackage 执行链路与智能体进度展示**
  *Symptoms*: ## 变更概述  本 PR 优化 Code 模块从 PlanPackage 到 Blueprint/Cart 执行的完整链路，并改善 Claude Code 智能体执行过程中的前端展示体验。  ## 主要改动  - 增强 PlanPackage 与 Code 模块的衔接能力，支持 Code 侧发现、加载并执行 PlanPackage。 - 完善 Blueprint/Cart 执行状态同步，支持节点执行状态、事件日志和历史状态恢复。 - 优化 Claude Code 调用逻辑，统一读取配置中的模型/API 设置。 - 降低智能体运行时前端日志噪音，仅展示启动、读取/生成、运行、完成/失败等关键节点信息。 - 在 prompt 层面约束 Claude/LLM 输出，减少冗长解释、长日志和不必要 token 消耗。 - 更新 Code 前端页面，支持 Cart Pipeline 进度展示、轮询兜底和执行结果恢复。

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

### Incident Patch 1: `4e4e96fd` (2026-09-05)
**Commit Message**: fix: harden literature TLS and sanitize deployment templates

**File**: `README.md` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@
 <p align="center">
   <a href="https://github.com/OpenNSWM-Lab/FAROS/stargazers"><img src="https://img.shields.io/github/stars/OpenNSWM-Lab/FAROS?style=for-the-badge&color=FFB300&label=Stars" alt="GitHub Stars" /></a>
   <img src="https://img.shields.io/badge/Release-1.1.0--rc1-0891B2?style=for-the-badge" alt="Release 1.1.0-rc1" />
-  <img src="https://img.shields.io/badge/Backend_Tests-644_passed-16A34A?style=for-the-badge" alt="644 backend tests passed" />
-  <img src="https://img.shields.io/badge/Frontend_Tests-35_passed-2563EB?style=for-the-badge" alt="35 frontend tests passed" />
+  <img src="https://img.shields.io/badge/Backend_Tests-685_passed-16A34A?style=for-the-badge" alt="685 backend tests passed" />
+  <img src="https://img.shields.io/badge/Frontend_Tests-41_passed-2563EB?style=for-the-badge" alt="41 frontend tests passed" />
   <img src="https://img.shields.io/badge/Qwen-Ready-FFB300?style=for-the-badge" alt="Qwen Ready" />
 </p>
 
```

**File**: `backend/app/code/context/chunker.py` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ def __init__(
     def _generate_chunk_id(self, file_path: str, start_line: int, content: str) -> str:
         """Generate unique chunk ID."""
         hash_input = f"{file_path}:{start_line}:{content[:100]}"
-        hash_val = hashlib.md5(hash_input.encode()).hexdigest()[:12]
+        hash_val = hashlib.md5(hash_input.encode(), usedforsecurity=False).hexdigest()[:12]
         return f"chunk_{hash_val}"
     
     def _estimate_tokens(self, text: str) -> int:
```

**File**: `backend/app/modules/idea/research_dossier.py` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ def _utcnow() -> datetime:
 
 
 def _short_id(prefix: str, seed: str) -> str:
-    return f"{prefix}_{hashlib.md5(seed.encode()).hexdigest()[:12]}"
+    return f"{prefix}_{hashlib.md5(seed.encode(), usedforsecurity=False).hexdigest()[:12]}"
 
 
 def _score_to_01(value: float, scale: float = 10.0) -> float:
```

**File**: `backend/app/services/plan_package_specificity.py` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ def hypothesis_is_falsifiable(hypothesis: str) -> bool:
 
 def _issue(section_path: str, message: str) -> PlanReviewerIssue:
     digest = hashlib.sha1(
-        f"{section_path}|{message}".encode("utf-8")
+        f"{section_path}|{message}".encode("utf-8"), usedforsecurity=False
     ).hexdigest()[:12]
     return PlanReviewerIssue(
         id=f"specificity:{digest}",
```

**File**: `backend/app/services/ranking_service.py` (modified, +4/-1)
```diff
@@ -394,7 +394,10 @@ def _heuristic_score_single(
         weights = PAPER_TYPE_WEIGHTS.get(paper_type, PAPER_TYPE_WEIGHTS["default"])
         
         # Generate deterministic but varied scores based on candidate content
-        seed_hash = int(hashlib.md5(candidate.id.encode()).hexdigest()[:8], 16)
+        seed_hash = int(
+            hashlib.md5(candidate.id.encode(), usedforsecurity=False).hexdigest()[:8],
+            16,
+        )
         random.seed(seed_hash)
         
         # Base scores: always generate fresh heuristic scores for unscored candidates
```

**File**: `backend/app/services/search_service.py` (modified, +6/-3)
```diff
@@ -39,7 +39,7 @@ def _build_ssl_context() -> ssl.SSLContext:
 
 
 _SSL_CONTEXT = _build_ssl_context()
-_INSECURE_SSL_CONTEXT = ssl._create_unverified_context()
+_INSECURE_SSL_CONTEXT = ssl._create_unverified_context()  # nosec B323 - opt-in compatibility fallback
 _USER_AGENT = os.getenv(
     "FAROS_PAPER_SEARCH_USER_AGENT",
     "FAROS/0.1 literature-search",
@@ -424,7 +424,7 @@ def search(self, query: str, limit: int = 10, categories: Optional[List[str]] =
                     last_error = e
                     if (
                         url.startswith("https://")
-                        and _env_bool("FAROS_ALLOW_INSECURE_ARXIV_SSL", True)
+                        and _env_bool("FAROS_ALLOW_INSECURE_ARXIV_SSL", False)
                         and "CERTIFICATE_VERIFY_FAILED" in str(e)
                     ):
                         try:
@@ -1088,7 +1088,10 @@ def search(self, query: str, limit: int = 10) -> List[SearchResult]:
                 with _urlopen(request, timeout=30) as resp:
                     raw = resp.read().decode("utf-8")
             except urllib.error.URLError as e:
-                if "CERTIFICATE" in str(e) or "SSL" in str(e):
+                if (
+                    ("CERTIFICATE" in str(e) or "SSL" in str(e))
+                    and _env_bool("FAROS_ALLOW_INSECURE_DBLP_SSL", False)
+                ):
                     logger.info("DBLP: SSL cert untrusted, retrying with unverified context")
                     with _urlopen(request, timeout=30, context=_INSECURE_SSL_CONTEXT) as resp:
                         raw = resp.read().decode("utf-8")
```

**File**: `backend/tests/test_search_service.py` (modified, +37/-1)
```diff
@@ -4,7 +4,43 @@
 import urllib.parse
 
 from app.services import search_service as search_service_module
-from app.services.search_service import LocalCorpusSearch, OpenAlexSearch, SemanticScholarSearch
+from app.services.search_service import (
+    ArxivSearch,
+    DblpSearch,
+    LocalCorpusSearch,
+    OpenAlexSearch,
+    SemanticScholarSearch,
+)
+
+
+def test_arxiv_does_not_use_insecure_tls_fallback_by_default(monkeypatch):
+    contexts = []
+
+    def fake_urlopen(*_args, **kwargs):
+        contexts.append(kwargs.get("context"))
+        raise urllib.error.URLError("CERTIFICATE_VERIFY_FAILED")
+
+    monkeypatch.delenv("FAROS_ALLOW_INSECURE_ARXIV_SSL", raising=False)
+    monkeypatch.setattr(search_service_module, "_urlopen", fake_urlopen)
+    monkeypatch.setattr(search_service_module.time, "sleep", lambda *_args, **_kwargs: None)
+
+    assert ArxivSearch().search("evidence calibrated review", limit=1) == []
+    assert search_service_module._INSECURE_SSL_CONTEXT not in contexts
+
+
+def test_dblp_does_not_use_insecure_tls_fallback_by_default(monkeypatch):
+    contexts = []
+
+    def fake_urlopen(*_args, **kwargs):
+        contexts.append(kwargs.get("context"))
+        raise urllib.error.URLError("SSL CERTIFICATE failure")
+
+    monkeypatch.delenv("FAROS_ALLOW_INSECURE_DBLP_SSL", raising=False)
+    monkeypatch.setattr(search_service_module, "_urlopen", fake_urlopen)
+    monkeypatch.setattr(search_service_module.time, "sleep", lambda *_args, **_kwargs: None)
+
+    assert DblpSearch().search("evidence calibrated review", limit=1) == []
+    assert search_service_module._INSECURE_SSL_CONTEXT not in contexts
 
 
 def test_semantic_scholar_circuit_breaks_after_rate_limit(monkeypatch):
```

**File**: `deploy/README.md` (modified, +12/-12)
```diff
@@ -47,8 +47,8 @@ Browser
 ./scripts/check_deployment_dependencies.sh --role local
 
 # 内网计算节点；同时强制验证 NVIDIA 运行时和 GPU 镜像
-DATA_DIR=/data/zxy/faros/runtime/data \
-MPLCONFIGDIR=/data/zxy/faros/runtime/matplotlib \
+DATA_DIR=/opt/faros/runtime/data \
+MPLCONFIGDIR=/opt/faros/runtime/matplotlib \
 ./scripts/check_deployment_dependencies.sh --role compute --require-gpu
 
 # 公网网关
@@ -174,13 +174,13 @@ docker run --rm --gpus all faros/codegen-gpu:cuda12.4 \
 
 ### 5.3 目录与 Python
 
-参考部署以 `/data/zxy/faros` 为根，与仓库中的 systemd 单元一致。若目标机器使用其他路径，必须同步修改单元和两个环境文件：
+参考部署以 `/opt/faros` 为根，与仓库中的 systemd 单元一致。若目标机器使用其他路径，必须同步修改单元和两个环境文件：
 
 ```bash
-mkdir -p /data/zxy/faros/{current,releases,runtime/data,runtime/matplotlib,runtime/provider-configs}
-python3 -m venv /data/zxy/faros/venv
-/data/zxy/faros/venv/bin/python -m pip install --upgrade pip
-/data/zxy/faros/venv/bin/python -m pip install -r backend/requirements.txt
+mkdir -p /opt/faros/{current,releases,runtime/data,runtime/matplotlib,runtime/provider-configs}
+python3 -m venv /opt/faros/venv
+/opt/faros/venv/bin/python -m pip install --upgrade pip
+/opt/faros/venv/bin/python -m pip install -r backend/requirements.txt
 ```
 
 所有目录必须归 systemd 中的 `User` 所有。`DATA_DIR`、`MPLCONFIGDIR` 和 Provider 配置目录必须可写；SQLite 数据库不应通过 Git 或 rsync 覆盖。
@@ -191,15 +191,15 @@ python3 -m venv /data/zxy/faros/venv
 
 ```bash
 install -m 0640 deploy/systemd/faros-compute.env.example \
-  /data/zxy/faros/runtime/backend.env
+  /opt/faros/runtime/backend.env
 install -m 0600 deploy/systemd/faros-credentials.env.example \
-  /data/zxy/faros/runtime/credentials.env
+  /opt/faros/runtime/credentials.env
 ```
 
 用部署虚拟环境生成稳定的 Fernet Key，填入 `FAROS_CREDENTIAL_KEY`：
 
 ```bash
-/data/zxy/faros/venv/bin/python -c \
+/opt/faros/venv/bin/python -c \
   'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
 ```
 
@@ -216,8 +216,8 @@ ReviewX 正式签核必须使用专用 signer 账号。生产模板启用
 升级前先备份 `DATA_DIR`，再执行：
 
 ```bash
-cd /data/zxy/faros/current/backend
-DATA_DIR=/data/zxy/faros/runtime/data /data/zxy/faros/venv/bin/alembic upgrade head
+cd /opt/faros/current/backend
+DATA_DIR=/opt/faros/runtime/data /opt/faros/venv/bin/alembic upgrade head
 ```
 
 ### 5.6 systemd
```

---

### Incident Patch 2: `178c9a91` (2026-09-04)
**Commit Message**: fix(reviewx): handle unavailable saved audits

**File**: `frontend/src/pages/Review/ConsistencyChecker.test.tsx` (modified, +13/-0)
```diff
@@ -50,6 +50,7 @@ describe('ConsistencyChecker', () => {
         }] })
       }
       if (url.endsWith('/review-1/findings')) return response([])
+      if (url.includes('/review-missing')) return response({ detail: 'Review not found' }, false)
       if (url.endsWith('/reviewx/review-1')) {
         return response({
           id: 'review-1',
@@ -88,4 +89,16 @@ describe('ConsistencyChecker', () => {
     expect(screen.getByRole('button', { name: /实验反馈闭环与人工签核/ })).toHaveAttribute('aria-expanded', 'false')
     expect(screen.queryByText('Feedback panel content')).not.toBeInTheDocument()
   })
+
+  it('recovers when a deep-linked saved review no longer exists', async () => {
+    render(
+      <MemoryRouter initialEntries={['/review/consistency?paperId=paper-1&reviewId=review-missing']}>
+        <ConsistencyChecker />
+      </MemoryRouter>,
+    )
+
+    expect(await screen.findByText('保存的审计记录已不可用')).toBeInTheDocument()
+    expect(screen.getByText('当前论文选择已保留。请刷新历史记录，或点击“加载最新结果”继续。')).toBeInTheDocument()
+    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
+  })
 })
```

**File**: `frontend/src/pages/Review/ConsistencyChecker.tsx` (modified, +29/-1)
```diff
@@ -412,6 +412,7 @@ export function ConsistencyChecker() {
   const [selectedHistoryId, setSelectedHistoryId] = useState<string>('')
   const [historyFindings, setHistoryFindings] = useState<ReviewFinding[] | null>(null)
   const [historyFindingsLoading, setHistoryFindingsLoading] = useState(false)
+  const [historyLoadError, setHistoryLoadError] = useState(false)
   const [runDetail, setRunDetail] = useState<ReviewXRunDetail | null>(null)
   const [runDetailLoading, setRunDetailLoading] = useState(false)
   const [revisionRequests, setRevisionRequests] = useState<ImprovementRequest[]>([])
@@ -455,21 +456,35 @@ export function ConsistencyChecker() {
   const loadHistoryFindings = async (reviewId: string) => {
     setSelectedHistoryId(reviewId)
     setLatestResultsEnabled(false)
+    setHistoryLoadError(false)
     setHistoryFindingsLoading(true)
     setRunDetailLoading(true)
     try {
       const [findingsResp, detailResp] = await Promise.all([
         fetch(`${API_BASE_URL}/api/v1/reviews/reviewx/${reviewId}/findings`),
         fetch(`${API_BASE_URL}/api/v1/reviews/reviewx/${reviewId}`),
       ])
+      if (!findingsResp.ok || !detailResp.ok) {
+        throw new Error('Saved ReviewX run is unavailable')
+      }
       const findingsData = await findingsResp.json()
       const detailData = await detailResp.json()
-      setHistoryFindings(findingsData || [])
+      if (!Array.isArray(findingsData) || !detailData?.id || !detailData?.paperId) {
+        throw new Error('Saved ReviewX run returned an invalid response')
+      }
+      setHistoryFindings(findingsData)
       setRunDetail(detailData)
       setSelectedActionIndexes(new Set())
       setApplyMessage('')
       void loadRevisionRequests(detailData.id)
       void loadComparison(detailData.paperId, detailData.id)
+    } catch {
+      setSelectedHistoryId('')
+      setHistoryFindings(null)
+      setRunDetail(null)
+      setRevisionRequests([])
+      setComparison(null)
+      setHistoryLoadError(true)
     } finally {
       setHistoryFindingsLoading(false)
       setRunDetailLoading(false)
@@ -503,6 +518,7 @@ export function ConsistencyChecker() {
 
   const loadLatestReviewX = async (paperId: string) => {
     if (!paperId) return
+    setHistoryLoadError(false)
     setSelectedHistoryId('')
     setHistoryFindings(null)
     setLatestResultsEnabled(true)
@@ -611,6 +627,7 @@ export function ConsistencyChecker() {
     setSelectedActionIndexes(new Set())
     setApplyMessage('')
     setComparison(null)
+    setHistoryLoadError(false)
     setLatestResultsEnabled(false)
     setSearchQuery('')
     setSeverityFilter('all')
@@ -980,6 +997,17 @@ export function ConsistencyChecker() {
                   </div>
                 </div>
               )}
+              {historyLoadError && (
+                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
+                  <div className="font-semibold">{text('保存的审计记录已不可用', 'Saved audit record unavailable')}</div>
+                  <div className="mt-1 text-xs leading-5">
+                    {text(
+                      '当前论文选择已保留。请刷新历史记录，或点击“加载最新结果”继续。',
+                      'The current paper selection was kept. Refresh history or choose Load Latest to continue.',
+                    )}
+                  </div>
+                </div>
+              )}
             </CardContent>
           </Card>
 
```

---

### Incident Patch 3: `f1f04b5b` (2026-09-04)
**Commit Message**: fix(reviewx): apply evaluator feedback

**File**: `backend/app/modules/platform/verified_histories_api.py` (modified, +16/-1)
```diff
@@ -12,6 +12,7 @@
 import mimetypes
 from pathlib import Path
 from typing import Any
+from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
 
 from fastapi import APIRouter, HTTPException
 from fastapi.responses import FileResponse
@@ -70,6 +71,16 @@ def _stage_entity_path(data_dir: Path, stage: dict[str, Any]) -> Path | None:
     return paths.get(stage_id)
 
 
+def _stage_url(stage_id: str, value: Any) -> str:
+    url = str(value or "")
+    if stage_id not in {"idea", "plan"} or not url.startswith("/research/pipeline"):
+        return url
+    parts = urlsplit(url)
+    query = dict(parse_qsl(parts.query, keep_blank_values=True))
+    query["phase"] = stage_id
+    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
+
+
 def _public_manifest(data_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
     stages = payload.get("stages") or []
     stage_by_id = {
@@ -88,7 +99,11 @@ def _public_manifest(data_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
         exists = bool(entity_path and entity_path.exists())
         if not exists:
             broken_stages.append(stage_id)
-        public_stages.append({**stage, "status": "passed" if exists else "missing"})
+        public_stages.append({
+            **stage,
+            "url": _stage_url(stage_id, stage.get("url")),
+            "status": "passed" if exists else "missing",
+        })
 
     broken_artifacts: list[str] = []
     public_artifacts: list[dict[str, Any]] = []
```

**File**: `backend/tests/test_verified_histories_api.py` (modified, +12/-1)
```diff
@@ -41,7 +41,15 @@ def test_verified_history_checks_stages_and_artifact_digests(tmp_path: Path):
         "id": history_id,
         "completedAt": "2026-09-04T00:00:00+00:00",
         "stages": [
-            {"id": stage_id, "entityId": entity_id, "url": f"/{stage_id}/{entity_id}"}
+            {
+                "id": stage_id,
+                "entityId": entity_id,
+                "url": (
+                    f"/research/pipeline?ideaSessionId=idea_1&ideaCandidateId=candidate_1"
+                    if stage_id in {"idea", "plan"}
+                    else f"/{stage_id}/{entity_id}"
+                ),
+            }
             for stage_id, entity_id in entity_ids.items()
         ],
         "artifacts": [{
@@ -59,6 +67,9 @@ def test_verified_history_checks_stages_and_artifact_digests(tmp_path: Path):
     assert len(histories) == 1
     assert histories[0]["integrity"]["status"] == "verified"
     assert all(stage["status"] == "passed" for stage in histories[0]["stages"])
+    stage_urls = {stage["id"]: stage["url"] for stage in histories[0]["stages"]}
+    assert stage_urls["idea"].endswith("&phase=idea")
+    assert stage_urls["plan"].endswith("&phase=plan")
     assert histories[0]["artifacts"][0]["verified"] is True
     assert "path" not in histories[0]["artifacts"][0]
 
```

**File**: `frontend/src/pages/Research/Pipeline.test.tsx` (modified, +39/-2)
```diff
@@ -1,6 +1,7 @@
-import { render, screen } from '@testing-library/react'
+import { act, render, screen } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
 import type { ReactNode } from 'react'
-import { MemoryRouter } from 'react-router-dom'
+import { MemoryRouter, useNavigate } from 'react-router-dom'
 import { describe, expect, it, vi } from 'vitest'
 
 import { ResearchPipeline } from './Pipeline'
@@ -29,6 +30,25 @@ vi.mock('@/components/plans/PlanGenerationPanel', () => ({
   ),
 }))
 
+vi.mock('@/components/research/VerifiedResearchHistories', () => ({
+  VerifiedResearchHistories: () => null,
+}))
+
+function PipelineWithHistoryNavigation() {
+  const navigate = useNavigate()
+  return (
+    <>
+      <button
+        type="button"
+        onClick={() => navigate('/research/pipeline?ideaSessionId=idea_002&ideaCandidateId=cand_002&ideaCandidateTitle=Climate+Evidence&phase=plan')}
+      >
+        Open verified plan
+      </button>
+      <ResearchPipeline />
+    </>
+  )
+}
+
 describe('ResearchPipeline', () => {
   it('restores the selected candidate and Plan stage from the URL after refresh', async () => {
     render(
@@ -42,4 +62,21 @@ describe('ResearchPipeline', () => {
     expect(screen.getByText('Idea panel')).toBeInTheDocument()
     expect(await screen.findByText('Plan restored: idea_001 / cand_001 / Reliable RAG')).toBeInTheDocument()
   })
+
+  it('updates the visible workflow when a history link changes URL parameters in place', async () => {
+    const user = userEvent.setup()
+    render(
+      <MemoryRouter initialEntries={[
+        '/research/pipeline?ideaSessionId=idea_001&ideaCandidateId=cand_001&ideaCandidateTitle=Reliable+RAG',
+      ]}>
+        <PipelineWithHistoryNavigation />
+      </MemoryRouter>,
+    )
+
+    expect(await screen.findByText('Plan restored: idea_001 / cand_001 / Reliable RAG')).toBeInTheDocument()
+    await act(async () => {
+      await user.click(screen.getByRole('button', { name: 'Open verified plan' }))
+    })
+    expect(await screen.findByText('Plan restored: idea_002 / cand_002 / Climate Evidence')).toBeInTheDocument()
+  })
 })
```

**File**: `frontend/src/pages/Research/Pipeline.tsx` (modified, +37/-15)
```diff
@@ -1,4 +1,4 @@
-import { useState, useCallback } from 'react'
+import { useState, useCallback, useEffect } from 'react'
 import { useSearchParams } from 'react-router-dom'
 import { AppPageLayout } from '@/components/layout/AppPageLayout'
 import { IdeaGenerationPanel } from '@/components/ideas/IdeaGenerationPanel'
@@ -14,19 +14,44 @@ interface CandidateSelection {
   ideaSeedQuery: string
 }
 
+const candidateFromParams = (searchParams: URLSearchParams): CandidateSelection | null => {
+  const ideaSessionId = searchParams.get('ideaSessionId')?.trim() || ''
+  if (!ideaSessionId) return null
+  return {
+    ideaSessionId,
+    ideaCandidateId: searchParams.get('ideaCandidateId')?.trim() || '',
+    ideaCandidateTitle: searchParams.get('ideaCandidateTitle')?.trim() || '',
+    ideaSeedQuery: searchParams.get('ideaSeedQuery')?.trim() || '',
+  }
+}
+
 export function ResearchPipeline() {
   const { text } = useReviewLocale()
   const [searchParams, setSearchParams] = useSearchParams()
-  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSelection | null>(() => {
-    const ideaSessionId = searchParams.get('ideaSessionId')?.trim() || ''
-    if (!ideaSessionId) return null
-    return {
-      ideaSessionId,
-      ideaCandidateId: searchParams.get('ideaCandidateId')?.trim() || '',
-      ideaCandidateTitle: searchParams.get('ideaCandidateTitle')?.trim() || '',
-      ideaSeedQuery: searchParams.get('ideaSeedQuery')?.trim() || '',
-    }
-  })
+  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSelection | null>(() => candidateFromParams(searchParams))
+  const requestedPhase = searchParams.get('phase') === 'idea' ? 'idea' : searchParams.get('phase') === 'plan' ? 'plan' : ''
+  const selectedIdeaSessionId = selectedCandidate?.ideaSessionId || ''
+
+  useEffect(() => {
+    const nextCandidate = candidateFromParams(searchParams)
+    setSelectedCandidate((current) => {
+      if (!current || !nextCandidate) return nextCandidate
+      const unchanged = current.ideaSessionId === nextCandidate.ideaSessionId
+        && current.ideaCandidateId === nextCandidate.ideaCandidateId
+        && current.ideaCandidateTitle === nextCandidate.ideaCandidateTitle
+        && current.ideaSeedQuery === nextCandidate.ideaSeedQuery
+      return unchanged ? current : nextCandidate
+    })
+  }, [searchParams])
+
+  useEffect(() => {
+    if (!requestedPhase || (requestedPhase === 'plan' && !selectedIdeaSessionId)) return
+    const timer = window.setTimeout(() => {
+      document.getElementById(`pipeline-phase-${requestedPhase === 'idea' ? '1' : '2'}`)
+        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
+    }, 80)
+    return () => window.clearTimeout(timer)
+  }, [requestedPhase, selectedIdeaSessionId])
 
   const handleCandidateSelected = useCallback((data: CandidateSelection) => {
     setSelectedCandidate(data)
@@ -35,11 +60,8 @@ export function ResearchPipeline() {
     next.set('ideaCandidateId', data.ideaCandidateId)
     next.set('ideaCandidateTitle', data.ideaCandidateTitle)
     if (data.ideaSeedQuery) next.set('ideaSeedQuery', data.ideaSeedQuery)
+    next.set('phase', 'plan')
     setSearchParams(next, { replace: true })
-    // scroll to plan section
-    setTimeout(() => {
-      document.getElementById('pipeline-phase-2')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
-    }, 100)
   }, [searchParams, setSearchParams])
 
   return (
```

**File**: `frontend/src/pages/Review/ConsistencyChecker.test.tsx` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import { StrictMode, type ReactNode } from 'react'
+import { render, screen } from '@testing-library/react'
+import { MemoryRouter } from 'react-router-dom'
+import { beforeEach, describe, expect, it, vi } from 'vitest'
+
+import { ConsistencyChecker } from './ConsistencyChecker'
+
+vi.mock('@/components/layout/AppPageLayout', () => ({
+  AppPageLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
+}))
+
+vi.mock('@/components/review/ExperimentFeedbackPanel', () => ({
+  ExperimentFeedbackPanel: () => <div>Feedback panel content</div>,
+}))
+
+vi.mock('@/lib/hooks/useApi', () => ({
+  usePapers: () => ({
+    data: [{ id: 'paper-1', title: 'ReviewX fixture paper' }],
+    isLoading: false,
+  }),
+  useReviewFindings: () => ({ data: [], isLoading: false }),
+  useRunConsistencyCheck: () => ({
+    mutate: vi.fn(),
+    isPending: false,
+    isError: false,
+    error: null,
+  }),
+}))
+
+const response = (payload: unknown, ok = true) => ({
+  ok,
+  json: async () => payload,
+}) as Response
+
+describe('ConsistencyChecker', () => {
+  beforeEach(() => {
+    window.localStorage.setItem('faros.review.locale', 'zh-CN')
+    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
+      const url = String(input)
+      if (url.includes('/history?paperId=paper-1')) {
+        return response({ reviews: [{
+          id: 'review-1',
+          paperId: 'paper-1',
+          status: 'completed',
+          budgetMode: 'balanced',
+          findingCount: 0,
+          claimCount: 3,
+          evidenceCount: 8,
+          verificationCount: 4,
+        }] })
+      }
+      if (url.endsWith('/review-1/findings')) return response([])
+      if (url.endsWith('/reviewx/review-1')) {
+        return response({
+          id: 'review-1',
+          paperId: 'paper-1',
+          scoreSuggestion: 8,
+          claims: [{ id: 'claim-1' }, { id: 'claim-2' }, { id: 'claim-3' }],
+          jsonReport: { summary: { claimCount: 3, evidenceCount: 8, verificationCount: 4 } },
+          actionItems: [],
+          riskTree: [],
+          mismatchReport: {
+            aggregate: { meanMismatch: 0.2, maxMismatch: 0.2, highMismatchClaimCount: 0, dimensionMax: {} },
+            method: { formula: 'M(c,E)=max(coverage_gap,numeric_contradiction)' },
+            claimScores: [],
+          },
+          evidenceGraph: { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 },
+          modelTrace: { routingMode: 'balanced', llmCalls: [] },
+        })
+      }
+      if (url.includes('/reviews/requests?reviewId=review-1')) return response({ requests: [] })
+      if (url.includes('/reviewx/compare?')) return response({}, false)
+      return response({})
+    }))
+  })
+
+  it('keeps a deep-linked saved review loaded under React strict effects', async () => {
+    render(
+      <StrictMode>
+        <MemoryRouter initialEntries={['/review/consistency?paperId=paper-1&reviewId=review-1']}>
+          <ConsistencyChecker />
+        </MemoryRouter>
+      </StrictMode>,
+    )
+
+    expect(await screen.findByText('本次审计概览')).toBeInTheDocument()
+    expect(screen.getByText('已审计 3 条主张，未发现证据矛盾。')).toBeInTheDocument()
+    expect(screen.getByRole('button', { name: /实验反馈闭环与人工签核/ })).toHaveAttribute('aria-expanded', 'false')
+    expect(screen.queryByText('Feedback panel content')).not.toBeInTheDocument()
+  })
+})
```

**File**: `frontend/src/pages/Review/ConsistencyChecker.tsx` (modified, +325/-166)
```diff
@@ -21,6 +21,7 @@ import {
   Loader2,
   Database,
   ScanSearch,
+  ChevronDown,
 } from 'lucide-react'
 import { usePapers, useReviewFindings, useRunConsistencyCheck } from '@/lib/hooks/useApi'
 import { API_BASE_URL } from '@/lib/api'
@@ -42,6 +43,13 @@ const severityVariants = {
   info: 'outline' as const,
 }
 
+const severityLabels = {
+  blocker: ['阻断问题', 'Blocker'],
+  major: ['主要问题', 'Major'],
+  minor: ['次要问题', 'Minor'],
+  info: ['提示', 'Info'],
+} as const
+
 interface ReviewXHistoryItem {
   id: string
   paperId: string
@@ -78,6 +86,11 @@ interface ReviewXRunDetail {
   jsonReport?: {
     summary?: {
       claimCount?: number
+      evidenceCount?: number
+      verificationCount?: number
+      findingCount?: number
+      riskQuestionCount?: number
+      coverage?: number
     }
   }
   actionItems?: ReviewXActionItem[]
@@ -306,16 +319,25 @@ interface ReviewXRiskNode {
   mismatchDrivers?: string[]
 }
 
-const formatDateTime = (value?: string) => {
-  if (!value) return 'Unknown time'
+const formatDateTime = (value: string | undefined, locale: 'zh-CN' | 'en-US') => {
+  if (!value) return locale === 'zh-CN' ? '时间未知' : 'Unknown time'
   const date = new Date(value)
   if (Number.isNaN(date.getTime())) return value
-  return date.toLocaleString()
+  return new Intl.DateTimeFormat(locale, {
+    year: 'numeric',
+    month: '2-digit',
+    day: '2-digit',
+    hour: '2-digit',
+    minute: '2-digit',
+    hour12: false,
+  }).format(date)
 }
 
-const severityText = (counts?: Record<string, number>) => {
+const severityText = (counts: Record<string, number> | undefined, locale: 'zh-CN' | 'en-US') => {
   const c = counts || {}
-  return `B ${c.blocker || 0} · M ${c.major || 0} · m ${c.minor || 0} · I ${c.info || 0}`
+  return locale === 'zh-CN'
+    ? `阻断 ${c.blocker || 0} · 主要 ${c.major || 0}`
+    : `Blocker ${c.blocker || 0} · Major ${c.major || 0}`
 }
 
 const supportText = (counts?: Record<string, number>) => {
@@ -357,8 +379,21 @@ const deltaTone = (value?: number | null, lowerIsBetter = true) => {
 const findingHasLlmRefinement = (finding: ReviewFinding) =>
   finding.description.includes('LLM deep review')
 
+const mismatchDimensionLabels: Record<string, [string, string]> = {
+  baseline: ['基线完整性', 'Baseline'],
+  citation: ['引用完整性', 'Citation'],
+  citation_semantic: ['引用语义', 'Citation semantics'],
+  coverage: ['证据覆盖', 'Evidence coverage'],
+  general: ['综合风险', 'General risk'],
+  guardrail: ['护栏', 'Guardrail'],
+  importance: ['主张重要性', 'Claim importance'],
+  numeric: ['数值一致性', 'Numeric consistency'],
+  review_risk: ['评审风险', 'Review risk'],
+  visual_claim_consistency: ['图文一致性', 'Visual consistency'],
+}
+
 export function ConsistencyChecker() {
-  const { text } = useReviewLocale()
+  const { text, locale } = useReviewLocale()
   const [searchParams] = useSearchParams()
   const requestedPaperId = searchParams.get('paperId')?.trim() || ''
   const requestedReviewId = searchParams.get('reviewId')?.trim() || ''
@@ -387,6 +422,7 @@ export function ConsistencyChecker() {
   const [comparison, setComparison] = useState<ReviewXComparison | null>(null)
   const [comparisonLoading, setComparisonLoading] = useState(false)
   const [latestResultsEnabled, setLatestResultsEnabled] = useState(false)
+  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(Boolean(requestedFeedbackId))
 
   const latestFindingsPaperId = latestResultsEnabled && !selectedHistoryId ? selectedPaperId : ''
   const { data: latestFindings, isLoading: latestFindingsLoading } = useReviewFindings(latestFindingsPaperId)
@@ -567,6 +603,7 @@ export function ConsistencyChecker() {
   historyLoaderRef.current = loadHistoryFindings
 
   useEffect(() => {
+    openedDeepLinkRef.current = ''
     setSelectedHistoryId('')
     setHistoryFindings(null)
     setRunDetail(null)
@@ -580,6 +617,14 @@ export function ConsistencyChecker() {
     void refreshHistory(selectedPaperId)
   }, [selectedPaperId])
 
+  useEffect(() => {
+    if (requestedPaperId) setSelectedPaperId(requestedPaperId)
+  }, [requestedPaperId])
+
+  useEffect(() => {
+    if (requestedFeedbackId) setFeedbackPanelOpen(true)
+  }, [requestedFeedbackId])
+
   useEffect(() => {
     if (!requestedPaperId || selectedPaperId !== requestedPaperId || !requestedReviewId) return
     const deepLinkKey = `${requestedPaperId}:${requestedReviewId}`
@@ -639,6 +684,21 @@ export function ConsistencyChecker() {
 
   const actionItems = runDetail?.actionItems || []
   const mismatchAggregate = runDetail?.mismatchReport?.aggregate
+  const mismatchDimensions = useMemo(
+    () => Object.entries(mismatchAggregate?.dimensionMax || {})
+      .sort((left, right) => right[1] - left[1]),
+    [mismatchAggregate?.dimensionMax],
+  )
+  const activeHistory = useMemo(
+    () => history.find((item) => item.id === runDetail?.id),
+    [history, runDetail?.id],
+  )
+  const auditSummary = runDetail?.jsonReport?.summary
+  const auditScore = runDetail?.scoreSuggestion ?? activeHistory?
```

**File**: `scripts/seed_verified_judge_histories.py` (modified, +2/-2)
```diff
@@ -1406,8 +1406,8 @@ def _seed_manifest(
         },
         "primaryMetric": metric,
         "stages": [
-            {"id": "idea", "labelZh": "选题与证据", "labelEn": "Idea & evidence", "entityId": ids["idea"], "candidateId": ids["candidate"], "url": f"/research/pipeline?ideaSessionId={ids['idea']}&ideaCandidateId={ids['candidate']}&ideaCandidateTitle={definition['titleEn']}"},
-            {"id": "plan", "labelZh": "实验计划", "labelEn": "Plan", "entityId": ids["plan"], "url": f"/research/pipeline?ideaSessionId={ids['idea']}&ideaCandidateId={ids['candidate']}&ideaCandidateTitle={definition['titleEn']}"},
+            {"id": "idea", "labelZh": "选题与证据", "labelEn": "Idea & evidence", "entityId": ids["idea"], "candidateId": ids["candidate"], "url": f"/research/pipeline?ideaSessionId={ids['idea']}&ideaCandidateId={ids['candidate']}&ideaCandidateTitle={definition['titleEn']}&phase=idea"},
+            {"id": "plan", "labelZh": "实验计划", "labelEn": "Plan", "entityId": ids["plan"], "url": f"/research/pipeline?ideaSessionId={ids['idea']}&ideaCandidateId={ids['candidate']}&ideaCandidateTitle={definition['titleEn']}&phase=plan"},
             {"id": "code", "labelZh": "代码与配置", "labelEn": "Code", "entityId": ids["code"], "url": f"/code/projects/{ids['code']}"},
             {"id": "experiment", "labelZh": "真实实验", "labelEn": "Experiment", "entityId": ids["experiment"], "url": f"/experiments/{ids['experiment']}"},
             {"id": "paper", "labelZh": "完整论文", "labelEn": "Paper", "entityId": ids["paper"], "url": f"/papers/{ids['paper']}/preview"},
```

---

### Incident Patch 4: `dc2b6203` (2026-09-04)
**Commit Message**: fix(ui): polish verified history navigation

**File**: `frontend/src/components/research/VerifiedResearchHistories.tsx` (modified, +46/-36)
```diff
@@ -15,11 +15,12 @@ import {
   ShieldCheck,
 } from 'lucide-react'
 import { Badge } from '@/components/ui/badge'
-import { Button } from '@/components/ui/button'
+import { Button, buttonVariants } from '@/components/ui/button'
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
 import { Skeleton } from '@/components/ui/skeleton'
 import { API_BASE_URL } from '@/lib/api'
 import { useReviewLocale } from '@/lib/reviewLocale'
+import { cn } from '@/lib/utils'
 
 interface VerifiedStage {
   id: 'idea' | 'plan' | 'code' | 'experiment' | 'paper' | 'reviewx'
@@ -159,7 +160,9 @@ export function VerifiedResearchHistories() {
         </div>
       ) : (
         <div className="grid gap-4 lg:grid-cols-2">
-          {histories.map((history) => {
+          {[...histories]
+            .sort((left, right) => right.primaryMetric.delta - left.primaryMetric.delta)
+            .map((history) => {
             const isUpdate = history.decision.code === 'apply_revision'
             const initialBlockers = history.reviewTrail.initial.severityCounts?.blocker || 0
             const finalBlockers = history.reviewTrail.final.severityCounts?.blocker || 0
@@ -169,7 +172,7 @@ export function VerifiedResearchHistories() {
 
             return (
               <Card key={history.id} className="border-slate-200 shadow-sm">
-                <CardHeader className="space-y-3 pb-3">
+                <CardHeader className="space-y-3 p-4 pb-3 sm:p-6 sm:pb-3">
                   <div className="flex flex-wrap items-center justify-between gap-2">
                     <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                       <FlaskConical className="h-4 w-4" />
@@ -190,25 +193,25 @@ export function VerifiedResearchHistories() {
                   </CardTitle>
                   <p className="text-sm leading-6 text-slate-600">{text(history.summaryZh, history.summaryEn)}</p>
                 </CardHeader>
-                <CardContent className="space-y-4">
-                  <div className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-3 text-center">
-                    <div className="px-2">
-                      <div className="text-lg font-bold text-slate-950">{history.provenance.testPairs.toLocaleString()}</div>
-                      <div className="text-xs text-slate-500">{text('留出测试对', 'held-out pairs')}</div>
+                <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
+                  <div className="grid grid-cols-2 border-y border-slate-200 py-3 text-center sm:grid-cols-3">
+                    <div className="border-r border-slate-200 px-2">
+                      <div className="whitespace-nowrap text-base font-bold text-slate-950 sm:text-lg">{history.provenance.testPairs.toLocaleString()}</div>
+                      <div className="text-[11px] leading-4 text-slate-500 sm:text-xs">{text('留出测试对', 'held-out pairs')}</div>
                     </div>
                     <div className="px-2">
-                      <div className={`text-lg font-bold ${history.primaryMetric.delta > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
+                      <div className={`whitespace-nowrap text-base font-bold sm:text-lg ${history.primaryMetric.delta > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                         {formatSigned(history.primaryMetric.delta)}
                       </div>
-                      <div className="text-xs text-slate-500">{history.primaryMetric.name}</div>
+                      <div className="text-[11px] leading-4 text-slate-500 sm:text-xs">{history.primaryMetric.name}</div>
                     </div>
-                    <div className="px-2">
-                      <div className="text-lg font-bold text-slate-950">{initialBlockers} → {finalBlockers}</div>
-                      <div className="text-xs text-slate-500">Blockers</div>
+                    <div className="col-span-2 mt-3 border-t border-slate-200 px-2 pt-3 sm:col-span-1 sm:mt-0 sm:border-l sm:border-t-0 sm:pt-0">
+                      <div className="whitespace-nowrap text-base font-bold text-slate-950 sm:text-lg">{initialBlockers} → {finalBlockers}</div>
+                      <div className="text-[11px] leading-4 text-slate-500 sm:text-xs">Blockers</div>
                     </div>
                   </div>
 
-                  <div className="flex items-center justify-between gap-3 border-l-4 border-slate-800 bg-white px-3 py-2">
+                  <div className="flex flex-col items-start justify-between gap-2 border-l-4 border-slate-800 bg-white px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                     <div className="min-w-0">
                       <div className="text-xs font-semibold text-slate-500">{text('独立证据门禁', 'Independent evidence gate')}</div>
                       <div className="mt-0.5 text-sm font-semibold text-slate-900">
@@ -226,36 +229,43 @@ export function VerifiedR
```

---

### Incident Patch 5: `3cf4a3f1` (2026-09-03)
**Commit Message**: fix(reviewx): align verified visual evidence

**File**: `backend/app/modules/review/visual_evidence.py` (modified, +18/-5)
```diff
@@ -223,12 +223,25 @@ def _select_figures(figures: Any, mode: str, *, data_root: Optional[str]) -> Lis
     if not isinstance(figures, list):
         return []
     limit = 3 if mode == "deep" else 1
-    valid = [item for item in figures if isinstance(item, dict) and _image_payload(item, data_root=data_root)]
-    valid.sort(key=lambda item: (
-        0 if str(item.get("source", "")).startswith("paper") else 1,
-        0 if _NUMERIC_OR_RESULT_RE.search(f"{item.get('caption', '')} {item.get('title', '')}") else 1,
-        str(item.get("sourcePath") or ""),
+    valid_with_digests = []
+    for item in figures:
+        if not isinstance(item, dict):
+            continue
+        payload = _image_payload(item, data_root=data_root)
+        if payload:
+            valid_with_digests.append((item, payload["sha256"]))
+    valid_with_digests.sort(key=lambda entry: (
+        0 if str(entry[0].get("source", "")).startswith("paper") else 1,
+        0 if _NUMERIC_OR_RESULT_RE.search(f"{entry[0].get('caption', '')} {entry[0].get('title', '')}") else 1,
+        str(entry[0].get("sourcePath") or ""),
     ))
+    seen_digests: set[str] = set()
+    valid: List[Dict[str, Any]] = []
+    for item, digest in valid_with_digests:
+        if digest in seen_digests:
+            continue
+        seen_digests.add(digest)
+        valid.append(item)
     return valid[:limit]
 
 
```

**File**: `backend/tests/test_reviewx_visual_evidence.py` (modified, +47/-0)
```diff
@@ -189,6 +189,53 @@ def test_clean_visual_audit_adds_support_without_a_finding(tmp_path: Path):
     assert weak_result.findings[0].supportStatus == "needs_human_verification"
 
 
+def test_visual_audit_deduplicates_identical_images(tmp_path: Path):
+    claim = _claim()
+    first, evidence = _visual_fixture(tmp_path)
+    duplicate_path = tmp_path / "figures" / "copied-result.png"
+    duplicate_path.parent.mkdir(parents=True, exist_ok=True)
+    duplicate_path.write_bytes(PNG_BYTES)
+    duplicate = {
+        **first,
+        "id": "fig_result_copy",
+        "source": "experiment",
+        "sourcePath": "data/figures/copied-result.png",
+        "absolutePath": str(duplicate_path),
+    }
+    client = FakeVisionClient({
+        "chartType": "bar",
+        "readable": True,
+        "observations": ["Values are readable."],
+        "captionStatus": "consistent",
+        "captionRationale": "The values match.",
+        "claimAssessments": [{
+            "claimId": claim.id,
+            "status": "supported",
+            "verdict": "The figure supports the claim.",
+            "confidence": 0.9,
+        }],
+        "anomalies": [],
+    })
+
+    result = audit_visual_evidence(
+        paper={"id": claim.paperId, "title": "Duplicate visual fixture"},
+        claims=[claim],
+        evidence=[evidence],
+        links={claim.id: [evidence.id]},
+        artifacts={"visualFigures": [duplicate, first]},
+        provider_name="qwen",
+        visual_model="qwen3-vl-plus",
+        budget_mode="deep",
+        enabled=True,
+        client=client,
+        data_root=str(tmp_path),
+    )
+
+    assert result.trace["selectedFigureCount"] == 1
+    assert result.trace["auditedFigureCount"] == 1
+    assert len(client.calls) == 1
+
+
 def test_related_visual_mismatches_are_collapsed_into_one_action(tmp_path: Path):
     result, _client = _run(tmp_path, {
         "chartType": "bar",
```

**File**: `scripts/seed_verified_judge_histories.py` (modified, +26/-8)
```diff
@@ -802,6 +802,14 @@ def _seed_run_and_experiment(
         f"- Held-out accuracy: {values['beforeAccuracy']:.4f} -> {values['afterAccuracy']:.4f}\n\n"
         "The threshold proposal and gate use disjoint claim groups. The test labels were opened only after the "
         "UPDATE/KEEP decision had been frozen. Accuracy and Macro F1 are reported together to expose trade-offs.\n"
+        + (
+            f"The candidate threshold {values['proposedThreshold']:.3f} passed the independent gate and replaced "
+            f"the round-one threshold with {values['appliedThreshold']:.3f}.\n"
+            if values["gateDecision"] == "apply_revision"
+            else f"The candidate threshold {values['proposedThreshold']:.3f} failed the independent gate and was "
+            f"not applied. The retained {values['appliedThreshold']:.3f} threshold makes the authorized-policy "
+            "metric equal to round one by design; this is a successful non-update, not a failed execution.\n"
+        )
     )
     _write_json(experiment_dir / "experiment.json", experiment)
     _write_json(experiment_dir / "metrics.json", metrics)
@@ -860,15 +868,19 @@ def _seed_figure(
     axes[1].set_xlabel("Validation Macro F1 delta")
     axes[1].set_title("Claim-cluster bootstrap 95% CI", fontsize=13, fontweight="bold")
     axes[1].grid(axis="x", alpha=0.2)
-    axes[1].text(0.02, 0.08, definition["decision"].upper(), transform=axes[1].transAxes, fontsize=12, fontweight="bold", color="#0F766E" if values["gateDecision"] == "apply_revision" else "#B45309")
+    decision_label = "UPDATE" if values["gateDecision"] == "apply_revision" else "KEEP"
+    axes[1].text(0.02, 0.08, decision_label, transform=axes[1].transAxes, fontsize=12, fontweight="bold", color="#0F766E" if values["gateDecision"] == "apply_revision" else "#B45309")
+    axes[1].text(values["ciLow"], -0.16, f"{values['ciLow']:.4f}", ha="center", va="top", fontsize=10)
+    axes[1].text(values["ciHigh"], -0.16, f"{values['ciHigh']:.4f}", ha="center", va="top", fontsize=10)
     fig.suptitle(definition["titleEn"], fontsize=15, fontweight="bold", y=1.01)
     fig.tight_layout()
     fig.savefig(figure_path, dpi=180, bbox_inches="tight")
     plt.close(fig)
 
     caption = (
         f"Real-data result for {definition['dataset']}. Left: held-out Macro F1 under round one and the "
-        f"gate-authorized policy. Right: validation claim-cluster bootstrap interval; decision={values['gateDecision']}."
+        f"gate-authorized policy. Right: validation claim-cluster bootstrap interval "
+        f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}]; decision={decision_label}."
     )
     spec = {
         "id": ids["figure"],
@@ -893,12 +905,15 @@ def _seed_figure(
 def _paper_sources(definition: dict[str, Any], values: dict[str, Any], *, revised: bool) -> tuple[str, list[dict[str, str]], str]:
     references = _references(definition["dataset"])
     primary_key = references[0]["key"]
+    decision_label = "UPDATE" if values["gateDecision"] == "apply_revision" else "KEEP"
     decision_sentence = (
         f"The independent gate authorized UPDATE because its claim-cluster 95\\% interval "
         f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}] remained above zero."
         if values["gateDecision"] == "apply_revision"
         else f"The independent gate returned KEEP because its claim-cluster 95\\% interval "
-        f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}] crossed zero."
+        f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}] crossed zero. The proposed threshold "
+        f"{values['proposedThreshold']:.3f} was therefore rejected and the preregistered threshold "
+        f"{values['appliedThreshold']:.3f} remained active."
     )
     if revised:
         if values["gateDecision"] == "apply_revision":
@@ -911,9 +926,10 @@ def _paper_sources(definition: dict[str, Any], values: dict[str, Any], *, revise
             )
         else:
             result_claim = (
-                f"The proposed threshold {values['proposedThreshold']:.3f} was not adopted; the frozen threshold "
-                f"remained {values['appliedThreshold']:.3f}. Consequently, held-out Macro F1 remained "
-                f"{values['afterF1']:.4f} rather than being reported as an improvement."
+                f"Because the policy did not change, held-out Macro F1 at the retained threshold was "
+                f"{values['beforeF1']:.4f} in both the round-one and authorized-policy columns "
+                f"(absolute delta {values['f1Delta']:.4f}). This controlled non-update is not evidence of a "
+                "performance improvement."
             )
     else:
         result_claim = definition["falseClaim"]
@@ -935,6 +951,8 @@ def _paper_sources(definition: dict[str, Any], values: dict[str, Any], *, revise
             "content": (
                 "We propose a four-step controller: fit once, propose a threshold on one validation claim-group "
                 "partition, ga
```

---

### Incident Patch 6: `d6e7f660` (2026-09-03)
**Commit Message**: fix(reviewx): calibrate visual support gaps

**File**: `backend/app/modules/review/visual_evidence.py` (modified, +42/-7)
```diff
@@ -43,6 +43,7 @@
     "uncertainty_missing",
     "unreadable_figure",
     "claim_mismatch",
+    "claim_support_gap",
     "other",
 }
 _NUMERIC_OR_RESULT_RE = re.compile(
@@ -385,9 +386,18 @@ def _build_prompt(paper: Dict[str, Any], figure: Dict[str, Any], claims: List[Cl
 - A candidate claim may come from nearby paper text, but this one figure may not be intended to prove it.
 - If the figure simply does not discuss a candidate claim, omit that claim from claimAssessments.
 - Absence from one figure is not a contradiction or an unsupported scientific claim.
+- Captions may legitimately state sample size, provenance, or analysis that is not printed in the plot area.
+- Only report caption_mismatch when a visible label, value, direction, or legend directly conflicts with the caption.
 - Use "contradicted" only when visible content directly conflicts with a value, direction, label, or caption.
 - Ignore filenames and storage paths; they are not scientific evidence.
 
+Audit checklist:
+1. Read explicit values, labels, legend mappings, and uncertainty marks.
+2. Compare numeric magnitude and direction with each genuinely related candidate claim.
+3. Check the axis minimum and displayed range; flag axis_issue when truncation visually exaggerates a small effect.
+4. Use claim_support_gap when the visible result is directionally compatible but too weak for wording such as
+   "large", "substantial", or "significant".
+
 Paper title: {_clip(paper.get('title', 'Untitled'), 240)}
 Figure caption: {_clip(figure.get('caption', ''), 1200)}
 Candidate claims:
@@ -410,7 +420,7 @@ def _build_prompt(paper: Dict[str, Any], figure: Dict[str, Any], claims: List[Cl
   ],
   "anomalies": [
     {{
-      "type": "caption_mismatch | numeric_mismatch | trend_reversal | legend_mismatch | axis_issue | uncertainty_missing | unreadable_figure | claim_mismatch | other",
+      "type": "caption_mismatch | numeric_mismatch | trend_reversal | legend_mismatch | axis_issue | uncertainty_missing | unreadable_figure | claim_mismatch | claim_support_gap | other",
       "claimId": "supplied claimId or null",
       "severity": "blocker | major | minor | info",
       "description": "specific visible mismatch",
@@ -475,6 +485,10 @@ def _normalize_assessment(payload: Dict[str, Any], *, valid_claim_ids: set[str])
         anomaly_type = str(item.get("type") or "other").lower()
         claim_id = str(item.get("claimId") or "") or None
         severity = str(item.get("severity") or "minor").lower()
+        if anomaly_type == "caption_mismatch" and not claim_id and caption_status != "contradicted":
+            continue
+        if anomaly_type == "uncertainty_missing" and not claim_id and severity in {"blocker", "major"}:
+            severity = "minor"
         anomalies.append({
             "type": anomaly_type if anomaly_type in _ANOMALY_TYPES else "other",
             "claimId": claim_id if claim_id in valid_claim_ids else None,
@@ -569,20 +583,38 @@ def _append_assessment(
         )
 
     for item in assessment.get("claimAssessments", []):
-        if item["status"] != "contradicted" or item["claimId"] in anomaly_claims:
+        if item["claimId"] in anomaly_claims:
+            continue
+        claim = claims_by_id.get(item["claimId"])
+        if item["status"] == "contradicted":
+            anomaly_type = "claim_mismatch"
+            severity = "major"
+            suggested_fix = "Correct the figure, regenerate it from the audited metrics, or revise the paper claim."
+            acceptance = "The regenerated figure and exact claim agree on direction, values, labels, and uncertainty."
+        elif (
+            item["status"] == "weakly_supported"
+            and item["confidence"] >= 0.6
+            and claim
+            and (claim.importance == "high" or claim.claimType == "performance")
+        ):
+            anomaly_type = "claim_support_gap"
+            severity = "minor"
+            suggested_fix = "Report the visible effect size precisely, soften the claim, or add the missing statistical evidence."
+            acceptance = "The claim strength matches the visible effect size and its stated uncertainty."
+        else:
             continue
         _append_finding(
             result,
             paper_id=paper_id,
             figure=figure,
-            claim=claims_by_id.get(item["claimId"]),
+            claim=claim,
             anomaly={
-                "type": "claim_mismatch",
+                "type": anomaly_type,
                 "claimId": item["claimId"],
-                "severity": "major",
+                "severity": severity,
                 "description": item["verdict"],
-                "suggestedFix": "Correct the figure, regenerate it from the audited metrics, or revise the paper claim.",
-                "acceptanceCriterion": "The regenerated figure and exact claim agree on direction, values, labels, and uncertainty.",
+                "suggestedFix": suggested_fix,
+             
```

**File**: `backend/experiments/reviewx_visual_cem/run.py` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ class VisualCase:
         "truncated_axis", "bar", 0.80, 0.81,
         "The proposed method delivers a large held-out F1 improvement over the baseline.",
         "A large performance gain is visible for Proposed over Baseline.",
-        True, ("axis_issue", "claim_mismatch", "caption_mismatch"), narrow_axis=True,
+        True, ("axis_issue", "claim_mismatch", "claim_support_gap", "caption_mismatch"), narrow_axis=True,
     ),
     VisualCase(
         "clean_legend", "line", 0.70, 0.82,
```

**File**: `backend/tests/test_reviewx_visual_evidence.py` (modified, +47/-1)
```diff
@@ -42,7 +42,7 @@ def _claim() -> Claim:
 
 def _visual_fixture(tmp_path: Path):
     image = tmp_path / "papers" / "paper_visual" / "latex" / "figures" / "result.png"
-    image.parent.mkdir(parents=True)
+    image.parent.mkdir(parents=True, exist_ok=True)
     image.write_bytes(PNG_BYTES)
     figure = {
         "id": "fig_result",
@@ -142,6 +142,52 @@ def test_clean_visual_audit_adds_support_without_a_finding(tmp_path: Path):
     assert result.findings == []
     assert result.trace["anomalyCount"] == 0
 
+    metadata_result, _client = _run(tmp_path, {
+        "chartType": "bar",
+        "readable": True,
+        "observations": ["The bars are readable."],
+        "captionStatus": "partially_consistent",
+        "captionRationale": "The sample size is stated only in the caption.",
+        "claimAssessments": [],
+        "anomalies": [
+            {
+                "type": "caption_mismatch",
+                "claimId": None,
+                "severity": "major",
+                "description": "The sample size is not printed in the plot.",
+                "confidence": 0.9,
+            },
+            {
+                "type": "uncertainty_missing",
+                "claimId": None,
+                "severity": "major",
+                "description": "No uncertainty marker is visible.",
+                "confidence": 0.85,
+            },
+        ],
+    })
+    assert len(metadata_result.findings) == 1
+    assert metadata_result.findings[0].riskType == "visual_uncertainty_missing"
+    assert metadata_result.findings[0].severity == "minor"
+
+    weak_result, _client = _run(tmp_path, {
+        "chartType": "bar",
+        "readable": True,
+        "observations": ["The visible improvement is 0.01."],
+        "captionStatus": "partially_consistent",
+        "captionRationale": "The direction agrees but the effect is small.",
+        "claimAssessments": [{
+            "claimId": "claim_001",
+            "status": "weakly_supported",
+            "verdict": "The visible effect is too small for the strength of the claim.",
+            "confidence": 0.8,
+        }],
+        "anomalies": [],
+    })
+    assert len(weak_result.findings) == 1
+    assert weak_result.findings[0].riskType == "visual_claim_support_gap"
+    assert weak_result.findings[0].supportStatus == "needs_human_verification"
+
 
 def test_related_visual_mismatches_are_collapsed_into_one_action(tmp_path: Path):
     result, _client = _run(tmp_path, {
```

---

### Incident Patch 7: `f8ff427a` (2026-09-03)
**Commit Message**: fix(reviewx): resolve migrated figure paths

**File**: `backend/app/modules/review/artifact_collector.py` (modified, +34/-23)
```diff
@@ -91,20 +91,26 @@ def _valid_visual_path(path: str) -> tuple[str, str] | None:
     return (real, mime) if mime else None
 
 
-def _resolve_visual_path(candidate: str, roots: List[str]) -> tuple[str, str] | None:
-    value = str(candidate or "").strip()
-    if not value:
-        return None
-    possibilities = [value] if os.path.isabs(value) else [os.path.join(root, value) for root in roots]
-    expanded: List[str] = []
-    for path in possibilities:
-        expanded.append(path)
-        if not os.path.splitext(path)[1]:
-            expanded.extend(path + suffix for suffix in _VISUAL_SUFFIXES)
-    for path in expanded:
-        resolved = _valid_visual_path(path)
-        if resolved:
-            return resolved
+def _resolve_visual_path(candidates: Any, roots: List[str]) -> tuple[str, str] | None:
+    values = candidates if isinstance(candidates, (list, tuple)) else [candidates]
+    for candidate in values:
+        value = str(candidate or "").strip()
+        if not value:
+            continue
+        possibilities = [value] if os.path.isabs(value) else [os.path.join(root, value) for root in roots]
+        expanded: List[str] = []
+        for path in possibilities:
+            stem, suffix = os.path.splitext(path)
+            if suffix.lower() in _VISUAL_SUFFIXES:
+                expanded.append(path)
+            elif suffix:
+                expanded.extend(stem + visual_suffix for visual_suffix in _VISUAL_SUFFIXES)
+            else:
+                expanded.extend(path + visual_suffix for visual_suffix in _VISUAL_SUFFIXES)
+        for path in expanded:
+            resolved = _valid_visual_path(path)
+            if resolved:
+                return resolved
     return None
 
 
@@ -131,7 +137,7 @@ def _collect_visual_figures(
     by_path: Dict[str, Dict[str, Any]] = {}
 
     def add(
-        candidate: str,
+        candidate: Any,
         *,
         roots: List[str],
         caption: str = "",
@@ -177,7 +183,12 @@ def add(
             figure_id = figure.get("id")
             fallback_root = os.path.join(_DATA_DIR, "figures", str(figure_id or ""))
             add(
-                str(figure.get("pathPng") or figure.get("fileNamePng") or ""),
+                [
+                    figure.get("pathPng"),
+                    figure.get("fileNamePng"),
+                    figure.get("fileName"),
+                    figure.get("pathPdf"),
+                ],
                 roots=[fallback_root, latex_root],
                 caption=str(figure.get("caption") or ""),
                 title=str(figure.get("title") or figure.get("figureType") or ""),
@@ -189,13 +200,13 @@ def add(
     for figure in paper.get("selectedFigures", []) or []:
         if not isinstance(figure, dict):
             continue
-        candidate = str(
-            figure.get("pngPath")
-            or figure.get("pathPng")
-            or figure.get("path")
-            or figure.get("fileNamePng")
-            or ""
-        )
+        candidate = [
+            figure.get("pngPath"),
+            figure.get("pathPng"),
+            figure.get("path"),
+            figure.get("fileNamePng"),
+            figure.get("filename"),
+        ]
         add(
             candidate,
             roots=[latex_root, os.path.join(latex_root, "figures"), os.path.join(latex_root, "Figures")],
```

**File**: `backend/tests/test_reviewx_visual_evidence.py` (modified, +18/-3)
```diff
@@ -276,6 +276,18 @@ def test_artifact_collector_discovers_latex_figure_and_rejects_fake_image(monkey
     figures_dir.mkdir(parents=True)
     (figures_dir / "result.png").write_bytes(PNG_BYTES)
     (figures_dir / "fake.png").write_text("not an image", encoding="utf-8")
+    experiment_figure_dir = tmp_path / "figures" / "fig_migrated"
+    experiment_figure_dir.mkdir(parents=True)
+    (experiment_figure_dir / "migrated.png").write_bytes(PNG_BYTES)
+    experiment_dir = tmp_path / "experiments" / "exp_migrated"
+    experiment_dir.mkdir(parents=True)
+    (experiment_dir / "experiment.json").write_text("{}", encoding="utf-8")
+    (experiment_dir / "figures.json").write_text(json.dumps([{
+        "id": "fig_migrated",
+        "pathPng": "/retired/developer/workspace/migrated.png",
+        "fileNamePng": "migrated.png",
+        "caption": "Migrated experiment figure.",
+    }]), encoding="utf-8")
     tex = r"""
     \begin{figure}
       \includegraphics{Figures/result.png}
@@ -288,7 +300,7 @@ def test_artifact_collector_discovers_latex_figure_and_rejects_fake_image(monkey
     monkeypatch.setattr(artifact_collector, "_BASE_DIR", str(tmp_path.parent))
     monkeypatch.setattr(artifact_collector, "get_paper", lambda _paper_id: {
         "id": paper_id,
-        "experimentIds": [],
+        "experimentIds": ["exp_migrated"],
         "selectedFigures": [],
     })
     monkeypatch.setattr(artifact_collector, "list_paper_files", lambda _paper_id: [{
@@ -300,9 +312,12 @@ def test_artifact_collector_discovers_latex_figure_and_rejects_fake_image(monkey
 
     artifacts = artifact_collector.collect_reviewx_artifacts(paper_id)
 
-    assert len(artifacts["visualFigures"]) == 1
-    visual = artifacts["visualFigures"][0]
+    assert len(artifacts["visualFigures"]) == 2
+    visual = next(item for item in artifacts["visualFigures"] if item["source"] == "paper_latex")
     assert visual["source"] == "paper_latex"
     assert visual["mimeType"] == "image/png"
     assert visual["caption"] == "F1 comparison on the held-out set."
     assert visual["sourcePath"].endswith("Figures/result.png")
+    migrated = next(item for item in artifacts["visualFigures"] if item["source"] == "experiment")
+    assert migrated["sourcePath"].endswith("figures/fig_migrated/migrated.png")
+    assert migrated["caption"] == "Migrated experiment figure."
```

---

### Incident Patch 8: `9c5942de` (2026-09-03)
**Commit Message**: fix(code): validate complete generated artifacts

**File**: `backend/app/modules/code/codegen_sessions_api.py` (modified, +5/-6)
```diff
@@ -26,6 +26,7 @@
     get_plan_session_storage,
 )
 from app.services.code_project_service import create_project
+from app.db import crud
 from app.db.engine import get_session_context
 from app.core.settings import get_settings
 from app.core.user_context import call_with_current_context
@@ -325,17 +326,15 @@ async def validate_codegen_repo(session_id: str):
     if session.status != "completed":
         raise HTTPException(status_code=400, detail="Session not completed yet")
 
-    # Load files from project
+    # Read the complete persisted file index.  The tree API only returns one
+    # directory level, which would under-count generated repositories.
     project_id = session.projectId
     try:
-        from app.services.code_project_service import get_file_tree, read_file_content
-        from app.db.engine import get_session_context
         with get_session_context() as db:
-            tree = get_file_tree(db, project_id)
+            files = crud.list_project_files(db, project_id)
+            paths = [str(record.path) for record in files if not bool(record.is_dir)]
     except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to load project files: {e}")
-
-    paths = [n.get("path", "") for n in (tree or []) if not n.get("is_dir")]
     issues = []
     required = ["README.md"]
     for req in required:
```

**File**: `backend/app/modules/code/tests/test_challenge_cup_code.py` (modified, +41/-0)
```diff
@@ -3,7 +3,9 @@
 import asyncio
 import json
 import zipfile
+from contextlib import contextmanager
 from pathlib import Path
+from types import SimpleNamespace
 
 import pytest
 from fastapi import HTTPException
@@ -178,6 +180,45 @@ def get_by_idea_session(self, idea_session_id):
     assert context["method"] == package.principle.mechanism
 
 
+def test_codegen_validation_reads_complete_persisted_file_index(monkeypatch):
+    session = SimpleNamespace(status="completed", projectId="cproj_validation")
+    records = [
+        SimpleNamespace(path="README.md", is_dir=False),
+        SimpleNamespace(path="docs/method.md", is_dir=False),
+        SimpleNamespace(path="tests/test_pipeline.py", is_dir=False),
+        SimpleNamespace(path=".github/workflows/ci.yml", is_dir=False),
+        SimpleNamespace(path="src/model.py", is_dir=False),
+    ]
+    records.extend(
+        SimpleNamespace(path=f"src/components/component_{index}.py", is_dir=False)
+        for index in range(35)
+    )
+
+    @contextmanager
+    def fake_session_context():
+        yield object()
+
+    monkeypatch.setattr(codegen_sessions_api, "get_session", lambda _session_id: session)
+    monkeypatch.setattr(codegen_sessions_api, "get_session_context", fake_session_context)
+    monkeypatch.setattr(
+        codegen_sessions_api.crud,
+        "list_project_files",
+        lambda _db, project_id: records if project_id == session.projectId else [],
+    )
+
+    result = asyncio.run(codegen_sessions_api.validate_codegen_repo("cgs_validation"))
+
+    assert result["fileCount"] == 40
+    assert result["qualityScore"] == 100
+    assert result["passed"] is True
+    assert result["categories"] == {
+        "tests": True,
+        "ci": True,
+        "db": True,
+        "docs": 2,
+    }
+
+
 def test_evidence_requires_existing_reproducibility_artifacts(tmp_path):
     cart = _build_cart(tmp_path)
     first = build_experiment_evidence(cart, _ready_assessment())
```

**File**: `backend/app/modules/review/artifact_collector.py` (modified, +31/-5)
```diff
@@ -13,6 +13,14 @@
 
 _BASE_DIR = str(get_data_dir().parent)
 _DATA_DIR = str(get_data_dir())
+_REVIEWABLE_CODE_SUFFIXES = {
+    ".cfg", ".ini", ".json", ".md", ".py", ".sh", ".toml", ".txt", ".yaml", ".yml",
+}
+_REVIEWABLE_CODE_NAMES = {"Dockerfile", "LICENSE", "Makefile"}
+_IGNORED_CODE_DIRS = {
+    ".git", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".venv",
+    "__pycache__", "node_modules", "venv",
+}
 
 
 def _read_json(path: str, fallback: Any) -> Any:
@@ -84,16 +92,17 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
             for root, _dirs, files in os.walk(exports_dir):
                 for name in files:
                     abs_path = os.path.join(root, name)
-                    if os.path.getsize(abs_path) > 250_000:
-                        continue
+                    size_bytes = os.path.getsize(abs_path)
                     content = ""
-                    if name.endswith((".json", ".md", ".txt", ".py", ".yaml", ".yml")):
+                    if size_bytes <= 250_000 and name.endswith((".json", ".md", ".txt", ".py", ".yaml", ".yml")):
                         with open(abs_path, encoding="utf-8", errors="replace") as f:
                             content = f.read()[:5000]
                     code_artifacts.append({
                         "path": _safe_rel(abs_path),
                         "name": name,
                         "content": content,
+                        "sizeBytes": size_bytes,
+                        "contentOmitted": bool(size_bytes > 250_000),
                     })
         repo_dir = os.path.join(project_dir, "repo")
         evidence_dir = os.path.join(repo_dir, "artifacts", "evidence")
@@ -103,9 +112,10 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
         experiment_evidence = _read_json(
             os.path.join(evidence_dir, "experiment_evidence.json"), {}
         )
-        reviewable_paths = [
+        preferred_paths = [
             "src/main.py",
             "configs/experiment.json",
+            "configs/experiment.yaml",
             "metrics.json",
             "evaluation_records.json",
             "experiment_report.md",
@@ -116,7 +126,21 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
             "artifacts/evidence/experiment_evidence.json",
         ]
         seen_paths = {item["path"] for item in code_artifacts}
-        for rel_path in reviewable_paths:
+        reviewable_paths = list(preferred_paths)
+        if os.path.isdir(repo_dir):
+            discovered: List[str] = []
+            for root, dirs, files in os.walk(repo_dir):
+                dirs[:] = sorted(item for item in dirs if item not in _IGNORED_CODE_DIRS)
+                for name in sorted(files):
+                    suffix = os.path.splitext(name)[1].lower()
+                    if suffix not in _REVIEWABLE_CODE_SUFFIXES and name not in _REVIEWABLE_CODE_NAMES:
+                        continue
+                    discovered.append(os.path.relpath(os.path.join(root, name), repo_dir))
+            reviewable_paths.extend(discovered)
+
+        for rel_path in dict.fromkeys(reviewable_paths):
+            if len(code_artifacts) >= 80:
+                break
             abs_path = os.path.join(repo_dir, rel_path)
             safe_path = _safe_rel(abs_path)
             if safe_path in seen_paths or not os.path.isfile(abs_path) or os.path.getsize(abs_path) > 250_000:
@@ -127,6 +151,8 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
                 "path": safe_path,
                 "name": os.path.basename(abs_path),
                 "content": content,
+                "sizeBytes": os.path.getsize(abs_path),
+                "contentOmitted": False,
             })
             seen_paths.add(safe_path)
 
```

**File**: `backend/tests/test_reviewx_cem.py` (modified, +40/-0)
```diff
@@ -1,5 +1,6 @@
 from app.modules.review.cem_guidance import annotate_risk_tree_with_mismatch
 from app.modules.review.cem_guidance import build_cem_budget_plan
+from app.modules.review import artifact_collector
 from app.modules.review.evidence_verifier import verify_claim_evidence
 from app.modules.review.mismatch_scorer import build_mismatch_report
 from app.modules.review.model_router import (
@@ -49,6 +50,45 @@ def _finding(**updates) -> Finding:
     return Finding(**data)
 
 
+def test_artifact_collector_keeps_large_export_and_discovers_nested_source(monkeypatch, tmp_path):
+    project_id = "cproj_artifacts"
+    project_dir = tmp_path / "code_projects" / project_id
+    exports_dir = project_dir / "exports"
+    repo_dir = project_dir / "repo"
+    exports_dir.mkdir(parents=True)
+    (exports_dir / "project.zip").write_bytes(b"x" * 250_001)
+    (repo_dir / "src" / "package").mkdir(parents=True)
+    (repo_dir / "src" / "package" / "model.py").write_text("def run():\n    return 1\n", encoding="utf-8")
+    (repo_dir / "configs").mkdir()
+    (repo_dir / "configs" / "experiment.yaml").write_text("seed: 42\n", encoding="utf-8")
+    (repo_dir / ".venv").mkdir()
+    (repo_dir / ".venv" / "ignored.py").write_text("secret = True\n", encoding="utf-8")
+
+    monkeypatch.setattr(artifact_collector, "_DATA_DIR", str(tmp_path))
+    monkeypatch.setattr(artifact_collector, "_BASE_DIR", str(tmp_path.parent))
+    monkeypatch.setattr(
+        artifact_collector,
+        "get_paper",
+        lambda _paper_id: {
+            "id": "paper_artifacts",
+            "projectId": project_id,
+            "experimentIds": [],
+        },
+    )
+    monkeypatch.setattr(artifact_collector, "list_paper_files", lambda _paper_id: [])
+
+    result = artifact_collector.collect_reviewx_artifacts("paper_artifacts")
+    names = {item["name"] for item in result["codeArtifacts"]}
+    paths = {item["path"] for item in result["codeArtifacts"]}
+
+    assert {"project.zip", "model.py", "experiment.yaml"} <= names
+    assert not any(".venv" in path for path in paths)
+    export = next(item for item in result["codeArtifacts"] if item["name"] == "project.zip")
+    assert export["content"] == ""
+    assert export["contentOmitted"] is True
+    assert export["sizeBytes"] == 250_001
+
+
 def test_mismatch_report_keeps_raw_and_calibrated_scores():
     claim = _claim()
     evidence = Evidence(
```

---

### Incident Patch 9: `921b0e66` (2026-09-03)
**Commit Message**: fix(reviewx): honor official dossier release

**File**: `backend/app/modules/review/reviews_api.py` (modified, +12/-1)
```diff
@@ -1874,6 +1874,7 @@ async def get_experiment_signoffs_endpoint(feedback_id: str) -> HumanSignoffResp
 )
 async def get_experiment_signoff_dossier_endpoint(
     feedback_id: str,
+    release: Literal["draft", "official"] = "draft",
     response: Response = None,
 ) -> SignoffDossier:
     record = get_experiment_feedback(feedback_id)
@@ -1882,7 +1883,17 @@ async def get_experiment_signoff_dossier_endpoint(
     if response is not None:
         response.headers["Cache-Control"] = "no-store"
         response.headers["X-Content-Type-Options"] = "nosniff"
-    return build_signoff_dossier(record, release="draft")
+    try:
+        return build_signoff_dossier(record, release=release)
+    except ValueError as exc:
+        raise HTTPException(
+            status_code=409,
+            detail={
+                "code": "OFFICIAL_DOSSIER_LOCKED",
+                "message": str(exc),
+                "nextStep": "Complete all current ReviewX signoffs and resolve every blocker.",
+            },
+        ) from exc
 
 
 @router.get(
```

**File**: `backend/tests/test_reviewx_signoff_dossier.py` (modified, +24/-0)
```diff
@@ -148,6 +148,30 @@ def test_official_html_requires_publication_ready(monkeypatch, tmp_path: Path):
     assert response.headers["cache-control"] == "no-store"
 
 
+def test_official_json_requires_publication_ready_and_preserves_release(monkeypatch, tmp_path: Path):
+    monkeypatch.setattr(experiment_feedback_storage, "_STORAGE_DIR", tmp_path)
+    stored = experiment_feedback_storage.create_experiment_feedback(_record())
+    with pytest.raises(HTTPException) as blocked:
+        asyncio.run(reviews_api.get_experiment_signoff_dossier_endpoint(
+            stored["id"], "official"
+        ))
+    assert blocked.value.status_code == 409
+
+    _approve(stored, "plan")
+    _approve(stored, "conclusion")
+    experiment_feedback_storage.update_experiment_feedback(
+        stored["id"], {"humanSignoffs": stored["humanSignoffs"]}
+    )
+    response = Response()
+    dossier = asyncio.run(reviews_api.get_experiment_signoff_dossier_endpoint(
+        stored["id"], "official", response
+    ))
+    assert dossier.release == "official"
+    assert dossier.watermark is None
+    assert response.headers["cache-control"] == "no-store"
+    assert response.headers["x-content-type-options"] == "nosniff"
+
+
 def test_raw_bundle_remains_backward_compatible(monkeypatch, tmp_path: Path):
     monkeypatch.setattr(experiment_feedback_storage, "_STORAGE_DIR", tmp_path)
     stored = experiment_feedback_storage.create_experiment_feedback(_record())
```

---

### Incident Patch 10: `665da59c` (2026-09-02)
**Commit Message**: fix(reviewx): harden production signoff gates

**File**: `backend/app/modules/review/audit_chain.py` (modified, +33/-1)
```diff
@@ -90,7 +90,39 @@ def record_audit_integrity(record: Dict[str, Any]) -> Dict[str, Any]:
                     }
         streams[f"signoff:{stage}"] = state
     for condition_id, item in (record.get("humanFeedbackVerifications") or {}).items():
-        streams[f"condition:{condition_id}"] = verify_history((item or {}).get("history") or [])
+        verification = item or {}
+        history = verification.get("history") or []
+        state = verify_history(history)
+        status = str(verification.get("status") or "pending")
+        if state["valid"] and status != "pending":
+            if not history:
+                state = {**state, "valid": False, "reason": "decision_missing_from_history"}
+            else:
+                head = history[-1]
+                sealed_fields = (
+                    "verificationId",
+                    "status",
+                    "subjectHash",
+                    "verifierRole",
+                    "verifierId",
+                    "actorAccountId",
+                    "actorRole",
+                    "authAssurance",
+                    "rationale",
+                    "evidenceArtifactIds",
+                    "decidedAt",
+                )
+                mismatches = [
+                    field for field in sealed_fields if verification.get(field) != head.get(field)
+                ]
+                if mismatches:
+                    state = {
+                        **state,
+                        "valid": False,
+                        "reason": "stored_state_differs_from_history_head",
+                        "mismatchedFields": mismatches,
+                    }
+        streams[f"condition:{condition_id}"] = state
     invalid = [name for name, state in streams.items() if not state["valid"]]
     return {
         "valid": not invalid,
```

**File**: `backend/app/modules/review/human_feedback_verification.py` (modified, +6/-0)
```diff
@@ -111,6 +111,9 @@ def decide_human_condition_verification(
     verifier_id: str,
     rationale: str,
     evidence_artifact_ids: Iterable[str] = (),
+    actor_account_id: str | None = None,
+    actor_role: str | None = None,
+    auth_assurance: str = "self_reported",
 ) -> Dict[str, Any]:
     if status not in VERIFICATION_STATUSES or status == "pending":
         raise ValueError("Verification must be passed, failed, or waived")
@@ -146,6 +149,9 @@ def decide_human_condition_verification(
         "subjectHash": current["subjectHash"],
         "verifierRole": verifier_role.strip(),
         "verifierId": verifier_id.strip(),
+        "actorAccountId": (actor_account_id or verifier_id).strip(),
+        "actorRole": (actor_role or "legacy_verifier").strip(),
+        "authAssurance": auth_assurance.strip() or "self_reported",
         "rationale": rationale.strip(),
         "evidenceArtifactIds": evidence_ids,
         "decidedAt": decided_at,
```

**File**: `backend/app/modules/review/human_signoff.py` (modified, +11/-0)
```diff
@@ -267,6 +267,8 @@ def require_human_signoff(record: Dict[str, Any], stage: str) -> Dict[str, Any]:
 
 
 def publication_ready(record: Dict[str, Any]) -> bool:
+    if record.get("reviewPurpose") == "technical_test":
+        return False
     if record.get("publicationEligible", True) is not True:
         return False
     if not record_audit_integrity(record)["valid"]:
@@ -283,6 +285,7 @@ def publication_ready(record: Dict[str, Any]) -> bool:
             require_human_signoff(record, "repair")
         require_human_signoff(record, "conclusion")
         from app.modules.review.human_feedback_verification import (
+            human_condition_verification_state,
             require_human_conditions_resolved,
         )
 
@@ -307,5 +310,13 @@ def publication_ready(record: Dict[str, Any]) -> bool:
                 set(item.get("acknowledgements") or [])
             ):
                 return False
+        condition_state = human_condition_verification_state(record)
+        for item in condition_state.get("conditions") or []:
+            if item.get("status") not in {"passed", "waived"}:
+                return False
+            if item.get("authAssurance") != "trusted_proxy_basic_auth":
+                return False
+            if not stored_actor_is_authorized(str(item.get("actorAccountId") or "")):
+                return False
     gate = str((record.get("qualityAssessment") or {}).get("gateStatus") or "").lower()
     return gate != "fail" and _blocker_count(record) == 0
```

**File**: `backend/app/modules/review/reviews_api.py` (modified, +4/-1)
```diff
@@ -2171,7 +2171,7 @@ async def decide_human_condition_verification_endpoint(
     if record is None:
         raise HTTPException(status_code=404, detail=f"Experiment feedback '{feedback_id}' not found")
     try:
-        authorize_reviewer(
+        principal = authorize_reviewer(
             stage="condition",
             reviewer_role=req.verifierRole,
             reviewer_id=req.verifierId,
@@ -2186,6 +2186,9 @@ async def decide_human_condition_verification_endpoint(
             verifier_id=req.verifierId,
             rationale=req.rationale,
             evidence_artifact_ids=req.evidenceArtifactIds,
+            actor_account_id=str(principal.get("actorAccountId") or ""),
+            actor_role=str(principal.get("actorRole") or ""),
+            auth_assurance=str(principal.get("authAssurance") or principal.get("assurance") or ""),
         )
     except ReviewAuthenticationError as exc:
         raise HTTPException(status_code=401, detail=str(exc)) from exc
```

**File**: `backend/tests/test_reviewx_human_signoff.py` (modified, +35/-1)
```diff
@@ -169,7 +169,9 @@ def test_inherited_human_conditions_require_current_evidence_before_conclusion()
 def test_technical_test_record_can_never_become_publication_ready():
     record = _record(decision="accept_results")
     record["reviewPurpose"] = "technical_test"
-    record["publicationEligible"] = False
+    # The purpose itself is a hard gate even if an upstream producer sets the
+    # eligibility flag incorrectly.
+    record["publicationEligible"] = True
     record["humanSignoffs"] = initialize_human_signoffs(record)
 
     for stage in ("plan", "conclusion"):
@@ -186,6 +188,38 @@ def test_technical_test_record_can_never_become_publication_ready():
     assert publication_ready(record) is False
 
 
+def test_condition_state_tampering_revokes_publication():
+    record = _record(decision="accept_results")
+    record["inheritedHumanFeedback"] = {
+        "feedbackHash": "sha256:human-feedback",
+        "items": [{
+            "decisionId": "hsd_parent",
+            "stage": "plan",
+            "status": "changes_requested",
+            "conditions": ["Record the leakage check as an artifact"],
+        }],
+    }
+    _approve(record, "plan")
+    condition_id = human_condition_verification_state(record)["conditions"][0]["conditionId"]
+    record["humanFeedbackVerifications"] = decide_human_condition_verification(
+        record,
+        condition_id=condition_id,
+        status="passed",
+        verifier_role="domain_expert",
+        verifier_id="expert@example.com",
+        rationale="Leakage report checked against the experiment evidence.",
+        evidence_artifact_ids=["artifact-1"],
+    )
+    _approve(record, "conclusion")
+    assert publication_ready(record) is True
+
+    record["humanFeedbackVerifications"][condition_id]["rationale"] = "tampered"
+    integrity = record_audit_integrity(record)
+    assert integrity["valid"] is False
+    assert integrity["invalidStreams"] == [f"condition:{condition_id}"]
+    assert publication_ready(record) is False
+
+
 def test_formal_conclusion_requires_a_different_reviewer_from_plan():
     record = _record(decision="accept_results")
     record["enforceReviewerSeparation"] = True
```

**File**: `backend/tests/test_reviewx_signoff_identity.py` (modified, +37/-0)
```diff
@@ -8,6 +8,7 @@
 from app.core.user_context import use_user
 from app.modules.review import experiment_feedback_storage, reviews_api
 from app.modules.review.audit_chain import record_audit_integrity
+from app.modules.review.human_feedback_verification import human_condition_verification_state
 from app.modules.review.human_signoff import SIGNOFF_ACKNOWLEDGEMENTS, publication_ready
 
 
@@ -142,3 +143,39 @@ def test_local_test_assurance_cannot_unlock_official_release(
             ))
     assert response.humanSignoffs["conclusion"]["authAssurance"] == "local_test"
     assert response.publicationReady is False
+
+
+def test_condition_verification_is_bound_to_proxy_actor(
+    monkeypatch, tmp_path: Path, proxy_auth
+):
+    monkeypatch.setattr(experiment_feedback_storage, "_STORAGE_DIR", tmp_path)
+    record = _record()
+    record["inheritedHumanFeedback"] = {
+        "feedbackHash": "sha256:human-feedback",
+        "items": [{
+            "decisionId": "hsd_parent",
+            "stage": "plan",
+            "status": "changes_requested",
+            "conditions": ["Verify the current experiment artifact"],
+        }],
+    }
+    stored = experiment_feedback_storage.create_experiment_feedback(record)
+    condition_id = human_condition_verification_state(stored)["conditions"][0]["conditionId"]
+    request = reviews_api.HumanConditionVerificationRequest(
+        status="passed",
+        verifierRole="domain_expert",
+        verifierId="untrusted-body-identity",
+        rationale="Verified against the current source artifact.",
+        evidenceArtifactIds=["artifact-1"],
+    )
+
+    with use_user("faros-signer-wzj"):
+        asyncio.run(reviews_api.decide_human_condition_verification_endpoint(
+            stored["id"], condition_id, request
+        ))
+
+    current = experiment_feedback_storage.get_experiment_feedback(stored["id"])
+    verification = current["humanFeedbackVerifications"][condition_id]
+    assert verification["actorAccountId"] == "faros-signer-wzj"
+    assert verification["authAssurance"] == "trusted_proxy_basic_auth"
+    assert verification["verifierId"] == "untrusted-body-identity"
```

**File**: `backend/tests/test_user_provider_settings.py` (modified, +10/-10)
```diff
@@ -26,39 +26,39 @@ def test_provider_credentials_are_encrypted_and_isolated_by_user(monkeypatch, tm
     settings = _isolated_settings(monkeypatch, tmp_path)
 
     with use_user("faros-team"):
-        settings.set_runtime_key("qwen", "sk-team-only-secret")
+        settings.set_runtime_key("qwen", "fixture-team-only-secret")
         settings.set_active_provider("qwen")
         settings.set_runtime_model("qwen", "qwen-max")
 
     with use_user("faros-judge"):
-        settings.set_runtime_key("qwen", "sk-judge-only-secret")
+        settings.set_runtime_key("qwen", "fixture-judge-only-secret")
         settings.set_active_provider("openai")
         settings.set_runtime_model("openai", "gpt-4o-mini")
 
-    assert settings.get_api_key("qwen", "faros-team") == "sk-team-only-secret"
-    assert settings.get_api_key("qwen", "faros-judge") == "sk-judge-only-secret"
+    assert settings.get_api_key("qwen", "faros-team") == "fixture-team-only-secret"
+    assert settings.get_api_key("qwen", "faros-judge") == "fixture-judge-only-secret"
     assert settings.get_active_provider("faros-team") == "qwen"
     assert settings.get_active_provider("faros-judge") == "openai"
 
     files = list((tmp_path / "providers").glob("*.json"))
     assert len(files) == 2
     serialized = "\n".join(path.read_text(encoding="utf-8") for path in files)
-    assert "sk-team-only-secret" not in serialized
-    assert "sk-judge-only-secret" not in serialized
+    assert "fixture-team-only-secret" not in serialized
+    assert "fixture-judge-only-secret" not in serialized
     for path in files:
         assert path.stat().st_mode & 0o777 == 0o600
 
     reloaded = Settings()
-    assert reloaded.get_api_key("qwen", "faros-team") == "sk-team-only-secret"
-    assert reloaded.get_api_key("qwen", "faros-judge") == "sk-judge-only-secret"
+    assert reloaded.get_api_key("qwen", "faros-team") == "fixture-team-only-secret"
+    assert reloaded.get_api_key("qwen", "faros-judge") == "fixture-judge-only-secret"
     assert reloaded.get_active_model("openai", "faros-judge") == "gpt-4o-mini"
 
 
 def test_environment_key_is_visible_only_to_declared_owner(monkeypatch, tmp_path):
     settings = _isolated_settings(monkeypatch, tmp_path)
-    monkeypatch.setenv("QWEN_API_KEY", "sk-environment-team-key")
+    monkeypatch.setenv("QWEN_API_KEY", "fixture-environment-team-key")
 
-    assert settings.get_api_key("qwen", "faros-team") == "sk-environment-team-key"
+    assert settings.get_api_key("qwen", "faros-team") == "fixture-environment-team-key"
     assert settings.get_api_key("qwen", "faros-judge") is None
 
 
```

**File**: `frontend/src/components/review/ExperimentFeedbackPanel.tsx` (modified, +38/-38)
```diff
@@ -1419,39 +1419,39 @@ export function ExperimentFeedbackPanel({
 
                 <div className="grid gap-4 md:grid-cols-2">
                   <div>
-                    <div className="mb-2 text-xs font-semibold uppercase text-slate-600">{text('下一步行动', 'Next actions')}</div>
+                    <div className="mb-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">{text('下一步行动', 'Next actions')}</div>
                     <div className="space-y-2">
                       {result.iterationDecision.nextActions.slice(0, 4).map((action, index) => (
-                        <div key={`${index}-${action}`} className="flex gap-2 text-sm text-slate-700">
-                          <span className="font-semibold text-emerald-700">{index + 1}.</span>
+                        <div key={`${index}-${action}`} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
+                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{index + 1}.</span>
                           <span>{messageText(action)}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                   <div>
-                    <div className="mb-2 text-xs font-semibold uppercase text-slate-600">{text('证据与反馈', 'Evidence & feedback')}</div>
-                    <div className="space-y-2 text-sm text-slate-700">
+                    <div className="mb-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">{text('证据与反馈', 'Evidence & feedback')}</div>
+                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                       <div>{Object.keys(result.sourceArtifacts).length} {text('个合同 artifact 已验证', 'contract artifacts verified')}</div>
                       <div>{result.qualityAssessment.findings.length} {text('个质量 finding', 'quality findings')}</div>
-                      <div className={result.planFeedback.applied ? 'text-emerald-700' : 'text-slate-500'}>
+                      <div className={result.planFeedback.applied ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                         {result.planFeedback.applied
                           ? text('PlanPackage 修正已附加', 'PlanPackage correction attached')
                           : messageText(result.planFeedback.reason) || text('未请求写入 PlanPackage', 'No PlanPackage write requested')}
                       </div>
                       {result.humanFeedback?.requiresApplication && (
-                        <div className={result.humanFeedback.applied ? 'text-emerald-700' : 'font-medium text-amber-700'}>
+                        <div className={result.humanFeedback.applied ? 'text-emerald-700 dark:text-emerald-400' : 'font-medium text-amber-700 dark:text-amber-300'}>
                           {text('人工反馈', 'Human feedback')} {result.humanFeedback.applied ? text('已应用', 'applied') : text('待应用', 'awaiting application')}
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
 
-                <section id="reviewx-human-oversight" className="scroll-mt-24 border-t border-slate-200 pt-4" aria-label={text('人工审核', 'Human oversight')}>
+                <section id="reviewx-human-oversight" className="scroll-mt-24 border-t border-slate-200 pt-4 dark:border-slate-700" aria-label={text('人工审核', 'Human oversight')}>
                   <SignoffDossier feedbackId={result.feedbackId} refreshKey={dossierRefreshKey} />
                   <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2">
-                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-600">
+                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                       <ShieldCheck className="h-4 w-4" />
                       {text('逐阶段责任确认', 'Stage-by-stage responsibility confirmation')}
                     </div>
@@ -1461,7 +1461,7 @@ export function ExperimentFeedbackPanel({
                   </div>
 
                   {!publicationReady && (
-                    <div className="mb-3 text-xs text-amber-700">
+                    <div className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                       {text('正式档案仍被服务端门禁锁定；请按摘要中的阻断项逐项处理。', 'The official dossier remains server-locked; resolve each blocker listed in the summary.')}
                     </div>
                   )}
@@ -1478,12 +1478,12 @@ export function ExperimentFeedbackPanel({
                             onClick={() => setSelectedSignoffStage(stage)}
                             className={`min-w-0 rounded-md border px-3 py-3 text-left ${
                               active
-                                ? 'border-emerald-700 bg-emerald-50'
-                                : 'border-slate-200 bg-white hover:bord
```

---

### Incident Patch 11: `21fb93c8` (2026-09-02)
**Commit Message**: feat(reviewx): add adaptive oscillator evidence loop

**File**: `backend/app/modules/code/challenge_cases/case_03_adaptive_oscillator/README.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Case 03: adaptive damped oscillator
+
+This offline Code fixture verifies that a fixed-budget scientific simulator can
+produce a real Plan Delta, paired per-seed measurements, and a statistical gate.
+It uses the same SciPy ODE and least-squares implementation as
+`experiments.reviewx_oscillator`, but it is not the final representative Qwen
+run. The final run must use the frozen protocol and `--require-real-api`.
+
+```bash
+cd backend
+./.venv/bin/python -m app.modules.code.challenge_cases.case_03_adaptive_oscillator.run --output /tmp/faros-case-03
+```
```

**File**: `backend/app/modules/code/challenge_cases/case_03_adaptive_oscillator/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Adaptive damped-oscillator Challenge Cup representative case."""
```

**File**: `backend/app/modules/code/challenge_cases/case_03_adaptive_oscillator/requirements.txt` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+numpy>=1.26,<3
+scipy>=1.11,<2
```

**File**: `backend/app/modules/code/challenge_cases/case_03_adaptive_oscillator/run.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+from __future__ import annotations
+
+import argparse
+import json
+from pathlib import Path
+
+from app.modules.code.challenge_cases.runtime import finalize_case_cart
+from app.modules.code.execution_assessment import ExecutionClass
+from experiments.reviewx_oscillator.run import (
+    baseline_design,
+    candidate_designs,
+    run_round,
+    statistical_gate,
+    summarize_round,
+)
+
+
+SMOKE_PROTOCOL = {
+    "trueOmega0": 1.2,
+    "trueZeta": 0.1,
+    "noiseStd": 0.08,
+    "observationBudget": 80,
+    "optimizerMaxNfev": 80,
+    "candidateNearResonanceFrequency": 1.15,
+    "holdoutExcitationFrequencies": [0.7, 0.95, 1.35],
+    "holdoutTrajectoryPoints": 120,
+}
+SEEDS = list(range(4201, 4209))
+
+
+def run(output_root: Path) -> Path:
+    first_design = baseline_design(SMOKE_PROTOCOL)
+    second_design = candidate_designs(SMOKE_PROTOCOL)[2]
+    first = run_round(SEEDS, first_design, SMOKE_PROTOCOL)
+    second = run_round(SEEDS, second_design, SMOKE_PROTOCOL)
+    first_summary = summarize_round(first)
+    second_summary = summarize_round(second)
+    statistics = statistical_gate(
+        [row["heldout_trajectory_nrmse"] for row in first],
+        [row["heldout_trajectory_nrmse"] for row in second],
+        bootstrap_samples=500,
+        bootstrap_seed=4200,
+    )
+    metrics = {
+        "round_1_heldout_trajectory_nrmse": round(statistics["round1Mean"], 8),
+        "round_2_heldout_trajectory_nrmse": round(statistics["round2Mean"], 8),
+        "relative_nrmse_improvement": round(statistics["relativeImprovement"], 8),
+        "paired_ci_lower": round(statistics["pairedBootstrap95"][0], 8),
+        "paired_ci_upper": round(statistics["pairedBootstrap95"][1], 8),
+        "matched_observation_budget": first_design.observation_budget,
+    }
+    plan_delta = {
+        "selectedCandidateId": second_design.candidate_id,
+        "oldValue": first_design.as_dict(),
+        "newValue": second_design.as_dict(),
+        "evidence": "Round 1 Fisher-information and transient-coverage diagnosis",
+        "affectedNodes": ["experiment.design", "experiment.fit", "reviewx.statistics"],
+        "finalHoldoutExposedToQwen": False,
+        "note": "This Code case is an offline execution fixture, not the final Qwen representative run.",
+    }
+    per_seed = [
+        {
+            "seed": left["seed"],
+            "round1Nrmse": left["heldout_trajectory_nrmse"],
+            "round2Nrmse": right["heldout_trajectory_nrmse"],
+        }
+        for left, right in zip(first, second)
+    ]
+    return finalize_case_cart(
+        output_root=output_root,
+        case_id="case_03_adaptive_oscillator",
+        project_source=Path(__file__).parent,
+        execution_class=ExecutionClass.SIMULATION_READY,
+        metrics=metrics,
+        artifacts={
+            "per_seed_results.json": json.dumps(per_seed, ensure_ascii=False, indent=2),
+            "plan_delta.json": json.dumps(plan_delta, ensure_ascii=False, indent=2),
+            "round_1_summary.json": json.dumps(first_summary, ensure_ascii=False, indent=2),
+            "round_2_summary.json": json.dumps(second_summary, ensure_ascii=False, indent=2),
+            "statistical_summary.json": json.dumps(statistics, ensure_ascii=False, indent=2),
+        },
+        config={
+            **SMOKE_PROTOCOL,
+            "seeds": SEEDS,
+            "round1Design": first_design.as_dict(),
+            "round2Design": second_design.as_dict(),
+            "stopCondition": "stop after the paired fixed-seed protocol",
+        },
+        method="Matched-budget damped-oscillator identification with a ReviewX Plan Delta.",
+        baseline="Single off-resonance excitation with steady-state uniform sampling.",
+        log_text=json.dumps({"metrics": metrics, "decision": statistics["decision"]}, ensure_ascii=False) + "\n",
+        expected=[{"metric": "relative_nrmse_improvement", "target": "> 0.15"}],
+    )
+
+
+if __name__ == "__main__":
+    parser = argparse.ArgumentParser()
+    parser.add_argument("--output", type=Path, required=True)
+    args = parser.parse_args()
+    print(run(args.output))
```

**File**: `backend/app/modules/review/competition_evidence.py` (modified, +204/-0)
```diff
@@ -34,6 +34,33 @@ def _sha256(path: Path) -> str:
     return f"sha256:{digest.hexdigest()}"
 
 
+def _verify_checksum_manifest(run_dir: Path) -> None:
+    manifest_path = run_dir / "CHECKSUMS.sha256"
+    if not manifest_path.is_file():
+        raise ValueError("CHECKSUMS.sha256 is missing")
+    recorded: Dict[str, str] = {}
+    for line in manifest_path.read_text(encoding="utf-8").splitlines():
+        if not line.strip():
+            continue
+        digest, separator, relative = line.partition("  ")
+        if not separator or len(digest) != 64 or not relative:
+            raise ValueError("CHECKSUMS.sha256 contains a malformed entry")
+        path = (run_dir / relative).resolve()
+        if run_dir.resolve() not in path.parents or not path.is_file():
+            raise ValueError(f"Checksum entry is unsafe or missing: {relative}")
+        actual = _sha256(path).removeprefix("sha256:")
+        if actual != digest:
+            raise ValueError(f"Checksum mismatch: {relative}")
+        recorded[relative] = digest
+    actual_files = {
+        path.relative_to(run_dir).as_posix()
+        for path in run_dir.rglob("*")
+        if path.is_file() and path.name != "CHECKSUMS.sha256"
+    }
+    if actual_files != set(recorded):
+        raise ValueError("CHECKSUMS.sha256 does not cover the complete evidence bundle")
+
+
 def _metric_rows(
     first: Dict[str, Any],
     second: Dict[str, Any],
@@ -88,6 +115,180 @@ def _candidate_rows(
     )
 
 
+OSCILLATOR_PUBLIC_ARTIFACTS = (
+    "protocol.json",
+    "manifest.json",
+    "round_1/per_seed_results.csv",
+    "round_1/metrics.json",
+    "round_1/diagnostics.json",
+    "round_2/per_seed_results.csv",
+    "round_2/metrics.json",
+    "calibration/per_seed_results.csv",
+    "calibration/statistical_summary.json",
+    "calibration/frozen_gate.json",
+    "calibration/method_comparison_per_seed.csv",
+    "method_comparison.json",
+    "plan_delta.json",
+    "qwen_trace.json",
+    "final_holdout/per_seed_results.csv",
+    "statistical_summary.json",
+    "human_signoff.json",
+    "CHECKSUMS.sha256",
+    "README.md",
+)
+
+
+def build_oscillator_evidence_view(
+    run_dir: Optional[Path],
+    *,
+    artifact_base_url: str = "/api/v1/reviews/reviewx/competition/oscillator/artifacts",
+) -> Dict[str, Any]:
+    """Build a fail-closed view from one persisted oscillator evidence bundle."""
+
+    if run_dir is None or not run_dir.is_dir():
+        return {
+            "available": False,
+            "eligibleForHeadline": False,
+            "blockingReasons": ["No deployed adaptive-oscillator evidence bundle is available."],
+        }
+
+    missing = [name for name in OSCILLATOR_PUBLIC_ARTIFACTS if not (run_dir / name).is_file()]
+    blockers = [f"Missing artifact: {name}" for name in missing]
+    try:
+        protocol = _read_json(run_dir / "protocol.json")
+        manifest = _read_json(run_dir / "manifest.json")
+        statistics = _read_json(run_dir / "statistical_summary.json")
+        plan_delta = _read_json(run_dir / "plan_delta.json")
+        qwen_trace = _read_json(run_dir / "qwen_trace.json")
+        method_comparison = _read_json(run_dir / "method_comparison.json")
+        frozen_gate = _read_json(run_dir / "calibration" / "frozen_gate.json")
+        import experiments.reviewx_oscillator.run as oscillator_run
+
+        _verify_checksum_manifest(run_dir)
+        oscillator_run.recompute_and_validate_output(run_dir)
+    except (FileNotFoundError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
+        return {
+            "available": True,
+            "eligibleForHeadline": False,
+            "blockingReasons": [*blockers, f"Evidence recomputation failed: {exc}"],
+            "artifacts": [],
+        }
+
+    primary_gate = protocol.get("primaryGate") or {}
+    interval = statistics.get("pairedBootstrap95") or []
+    interval_valid = (
+        len(interval) == 2
+        and all(isinstance(item, (int, float)) for item in interval)
+        and float(interval[1]) < 0
+    )
+    relative_improvement = statistics.get("relativeImprovement")
+    minimum_improvement = primary_gate.get("minimumRelativeImprovement")
+    improvement_passed = (
+        isinstance(relative_improvement, (int, float))
+        and isinstance(minimum_improvement, (int, float))
+        and float(relative_improvement) >= float(minimum_improvement)
+    )
+    qwen_usage = qwen_trace.get("usage") or {}
+    qwen_model = str(qwen_trace.get("model") or "")
+    qwen_real = bool(qwen_trace.get("isRealApiCall")) and bool(manifest.get("qwenRealApiCall"))
+    holdout_hidden = (
+        qwen_trace.get("finalHoldoutExposedToQwen") is False
+        and manifest.get("finalHoldoutExposedToQwen") is False
+    )
+    prompt = str(qwen_trace.get("prompt") or "")
+    final_seeds = {int(seed) for seed in manifest.get("finalHoldoutSeeds") or []}
+    development_seeds = {int(seed) for seed in manifest.get("developmentSeeds
```

**File**: `backend/app/modules/review/competition_workspace.py` (modified, +31/-10)
```diff
@@ -7,6 +7,10 @@
 from pathlib import Path
 from typing import Any, Callable, Iterable
 
+from app.modules.review.audit_chain import record_audit_integrity
+from app.modules.review.competition_evidence import build_oscillator_evidence_view
+from app.modules.review.human_signoff import publication_ready as is_publication_ready
+
 
 def _read_object(path: Path) -> dict[str, Any]:
     payload = json.loads(path.read_text(encoding="utf-8"))
@@ -186,20 +190,30 @@ def build_competition_workspace_dashboard(data_dir: Path) -> dict[str, Any]:
     quality_gate = str((review_summary.get("qualityGate") or {}).get("status") or "").lower()
     required_signoffs, approved_signoffs = _required_signoffs(feedback)
     reviewer_ids = {
-        str(item.get("reviewerId") or item.get("reviewerName") or "")
+        str(item.get("actorAccountId") or "")
         for item in approved_signoffs
-        if item.get("reviewerId") or item.get("reviewerName")
+        if item.get("actorAccountId")
     }
-    publication_ready = bool(feedback.get("publicationReady")) or (
-        bool(required_signoffs) and len(approved_signoffs) == len(required_signoffs)
+    publication_ready = is_publication_ready(feedback)
+    reviewer_policy = str(
+        feedback.get("reviewerPolicy")
+        or ("separated_reviewers" if feedback.get("enforceReviewerSeparation") else "single_accountable_reviewer")
+    )
+    reviewer_policy_passed = (
+        len(reviewer_ids) >= 2 if reviewer_policy == "separated_reviewers" else len(reviewer_ids) == 1
     )
-    single_reviewer = len(reviewer_ids) == 1
+    auth_assurances = {
+        str(item.get("authAssurance") or "unverified") for item in approved_signoffs
+    }
+    signoff_mode = next(iter(auth_assurances)) if len(auth_assurances) == 1 else "mixed_or_unverified"
+    audit_valid = record_audit_integrity(feedback)["valid"]
     qwen_model = str(review_job.get("model") or "")
     review_passed = bool(
         quality_gate == "passed"
         and qwen_model.lower().startswith("qwen")
         and publication_ready
-        and single_reviewer
+        and reviewer_policy_passed
+        and audit_valid
     )
 
     stages = [
@@ -273,9 +287,10 @@ def build_competition_workspace_dashboard(data_dir: Path) -> dict[str, Any]:
                 "qualityGate": quality_gate,
                 "model": qwen_model,
                 "publicationReady": publication_ready,
-                "reviewerPolicy": "single_accountable_reviewer",
+                "reviewerPolicy": reviewer_policy,
                 "responsibleReviewerCount": len(reviewer_ids),
-                "signoffMode": "simulated_demo",
+                "signoffMode": signoff_mode,
+                "auditIntegrityValid": audit_valid,
                 "requiredStages": required_signoffs,
                 "approvedStages": len(approved_signoffs),
             },
@@ -298,6 +313,10 @@ def build_competition_workspace_dashboard(data_dir: Path) -> dict[str, Any]:
         json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("utf-8")
     ).hexdigest()
 
+    oscillator = build_oscillator_evidence_view(
+        root / "experiments" / "reviewx_oscillator" / "latest"
+    )
+
     return {
         "schemaVersion": "faros-competition-workspace/v2",
         "generatedAt": base.get("generatedAt"),
@@ -321,10 +340,12 @@ def build_competition_workspace_dashboard(data_dir: Path) -> dict[str, Any]:
         },
         "stages": stages,
         "governance": {
-            "reviewerPolicy": "single_accountable_reviewer",
+            "reviewerPolicy": reviewer_policy,
             "responsibleReviewerCount": len(reviewer_ids),
-            "signoffMode": "simulated_demo",
+            "signoffMode": signoff_mode,
             "publicationReady": publication_ready,
+            "auditIntegrityValid": audit_valid,
         },
+        "adaptiveOscillator": oscillator,
         "integrity": {**hashes, "chainSha256": f"sha256:{chain_digest}"},
     }
```

**File**: `backend/experiments/reviewx_oscillator/README.md` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# ReviewX 阻尼振子闭环实验
+
+本实验在每个重复 80 个观测点、相同优化器评估上限下比较两轮二阶阻尼系统辨识。Round 1 使用远离共振的单频稳态采样；ReviewX 根据残差、Fisher 信息条件数和参数误差生成安全候选，Qwen 只能从可行候选中选择并解释 Plan Delta；Round 2 只重跑受影响节点。
+
+最终留出种子在 `config/frozen_protocol.json` 中冻结，Qwen prompt 只含开发集聚合诊断，不含最终留出观测或指标。主分析为至少 2,000 次成对 Bootstrap，并报告 Wilcoxon、符号置换检验、逐种子结果、参数误差与固定预算 guardrail。CI 跨 0 时自动输出 `BOUNDARY`。
+
+种子 `3001-3030` 已因工程预演而退役，只保留其来源说明，不得用于正式推断。正式未见集冻结为 `5001-5030`；自动化测试使用独立的 `99001+` 种子空间，不会提前消耗正式未见集。
+
+正式代表运行：
+
+```bash
+cd backend
+./.venv/bin/python -m experiments.reviewx_oscillator.run \
+  --config experiments/reviewx_oscillator/config/frozen_protocol.json \
+  --output ../docs/tempdocs/0902reviewx_oscillator_run \
+  --provider qwen \
+  --require-real-api
+```
+
+缺少百炼凭据或网络不可用时命令会明确失败，不会回退为 mock。`human_signoff.json` 始终由开发运行初始化为 `pending`；真实批准必须在受信 ReviewX 签核页面中由负责人完成。
```

**File**: `backend/experiments/reviewx_oscillator/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Matched-budget adaptive damped-oscillator identification benchmark."""
```

---

### Incident Patch 12: `c69d64f6` (2026-09-02)
**Commit Message**: feat(frontend): add readable staged signoff UX

**File**: `frontend/e2e/reviewx-signoff.spec.ts` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+import { expect, test, type Page, type Route } from '@playwright/test'
+
+type Stage = 'plan' | 'repair' | 'conclusion'
+
+const acknowledgementIds: Record<Stage, string[]> = {
+  plan: [
+    'reviewed_scientific_question_and_hypothesis',
+    'reviewed_data_split_and_holdout',
+    'reviewed_metrics_budget_and_stop_conditions',
+  ],
+  repair: [
+    'reviewed_reviewx_findings',
+    'confirmed_repairs_applied',
+    'reviewed_rerun_scope_and_residual_risk',
+  ],
+  conclusion: [
+    'reviewed_baseline_current_and_interval',
+    'reviewed_side_effects_and_limitations',
+    'accepted_claim_scope',
+  ],
+}
+
+const pendingSignoff = (stage: Stage, required = true) => ({
+  stage,
+  status: 'pending',
+  storedStatus: 'pending',
+  required,
+  artifactHash: `sha256:${stage.padEnd(64, '0')}`,
+  reviewerRole: null,
+  reviewerId: null,
+  reviewerName: null,
+  actorAccountId: null,
+  actorRole: null,
+  authAssurance: null,
+  acknowledgements: [],
+  rationale: '',
+  conditions: [],
+  decidedAt: null,
+  stale: false,
+  history: [],
+})
+
+async function installEvidenceApi(
+  page: Page,
+  options: { role?: 'reviewer' | 'judge'; stale?: boolean } = {},
+) {
+  const role = options.role || 'reviewer'
+  const signoffs: Record<Stage, ReturnType<typeof pendingSignoff>> = {
+    plan: pendingSignoff('plan'),
+    repair: pendingSignoff('repair', false),
+    conclusion: pendingSignoff('conclusion'),
+  }
+  if (options.stale) {
+    signoffs.plan = {
+      ...signoffs.plan,
+      status: 'pending',
+      storedStatus: 'approved',
+      stale: true,
+      reviewerId: '王子嘉',
+      reviewerName: '王子嘉',
+      actorAccountId: 'faros-signer-wzj',
+      actorRole: 'reviewer',
+      authAssurance: 'trusted_proxy_basic_auth',
+      acknowledgements: acknowledgementIds.plan,
+      decidedAt: '2026-09-02T01:00:00Z',
+    }
+  }
+
+  const feedbackState = () => ({
+    feedbackId: 'feedback-e2e',
+    createdAt: '2026-09-02T00:00:00Z',
+    runId: 'run-e2e',
+    runKind: 'platform',
+    researchSeriesId: 'series-e2e',
+    iterationNumber: 2,
+    sourceArtifacts: {
+      'research_dossier.json': 'artifact-plan',
+      'experiment_evidence.json': 'artifact-evidence',
+    },
+    metricSnapshot: [
+      { name: 'method:F1', value: 0.7764, unit: 'ratio', split: 'final_holdout' },
+      { name: 'method:Accuracy', value: 0.744, unit: 'ratio', split: 'final_holdout' },
+    ],
+    qualityAssessment: {
+      gateStatus: 'pass',
+      overallScore: 0.94,
+      dimensionScores: { reproducibility: 0.96, evidenceGrounding: 0.93 },
+      findings: [],
+      uncertainty: 'The primary CI crosses zero.',
+      llmTrace: [],
+    },
+    iterationDecision: {
+      decision: 'accept_results',
+      rationale: 'The result is reproducible; the claim remains bounded by the interval.',
+      targetSections: [],
+      metricDeltas: [{ name: 'F1', previous: 0.7725, current: 0.7764, delta: 0.0039 }],
+      nextActions: ['Record the bounded conclusion.'],
+    },
+    planFeedback: { requested: false, applied: false, targetSections: [], reason: 'No write requested.' },
+    humanSignoffs: signoffs,
+    humanFeedback: {
+      feedbackHash: 'sha256:feedback', items: [], targetSections: [], requiredActions: [],
+      requiresApplication: false, applied: true, staleApplication: false, application: null,
+    },
+    humanConditionVerifications: {
+      required: false, allResolved: true, total: 0, passed: 0, waived: 0, unresolved: 0, conditions: [],
+    },
+    sourceArtifactUrls: {},
+    publicationReady: signoffs.plan.status === 'approved'
+      && signoffs.conclusion.status === 'approved'
+      && !signoffs.plan.stale
+      && !signoffs.conclusion.stale,
+  })
+
+  const dossierState = () => {
+    const feedback = feedbackState()
+    return {
+      schemaVersion: 'reviewx-signoff-dossier/v1',
+      release: 'draft',
+      watermark: 'DRAFT_NOT_HUMAN_APPROVED',
+      generatedAt: '2026-09-02T00:00:00Z',
+      contentHash: 'sha256:dossier-e2e',
+      subject: {
+        feedbackId: feedback.feedbackId,
+        runId: feedback.runId,
+        researchSeriesId: feedback.researchSeriesId,
+        scientificQuestion: '一次证据驱动修订能否改善未见集表现？',
+        planPackageId: 'plan-e2e',
+        iterationNumber: 2,
+        artifactHash: signoffs.conclusion.artifactHash,
+      },
+      executiveDecision: {
+        iterationDecision: 'accept_results',
+        qualityGate: 'pass',
+        publicationReady: feedback.publicationReady,
+        blockingReasons: feedback.publicationReady ? [] : [{
+          code: options.stale ? 'PLAN_SIGNOFF_STALE' : 'CONCLUSION_SIGNOFF_REQUIRED',
+          message: options.stale ? 'plan 签核因证据变化已失效' : 'conclusion 阶段尚未批准',
+          nextStep: options.stale ? '重新核对当前证据并签核' : '完成结论确认',
+        }],
+      },
+      plan: {
+        hypothesis: '修订提高证据可辨识性。', baseline: 'Round 1', intervention: 'Round 2',
+        primaryMetric: 'F1', guardrails: ['Accura
```

**File**: `frontend/package.json` (modified, +2/-2)
```diff
@@ -10,9 +10,9 @@
     "preview": "vite preview",
     "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
     "typecheck": "tsc --noEmit",
-    "test": "vitest",
+    "test": "bash ./scripts/run_tests.sh",
     "test:ui": "vitest --ui",
-    "test:e2e": "playwright test"
+    "test:e2e": "bash ./scripts/run_e2e.sh"
   },
   "dependencies": {
     "@antv/g6": "^5.1.1",
```

**File**: `frontend/playwright.config.ts` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import { defineConfig, devices } from '@playwright/test'
+
+export default defineConfig({
+  testDir: './e2e',
+  outputDir: 'test-results/reviewx-signoff',
+  timeout: 45_000,
+  expect: { timeout: 10_000 },
+  fullyParallel: false,
+  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
+  use: {
+    baseURL: 'http://127.0.0.1:4173',
+    launchOptions: { args: ['--no-proxy-server'] },
+    trace: 'retain-on-failure',
+    screenshot: 'only-on-failure',
+  },
+  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
+})
```

**File**: `frontend/scripts/run_e2e.sh` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+export NO_PROXY="127.0.0.1,localhost"
+export no_proxy="$NO_PROXY"
+
+./node_modules/.bin/vite --host 127.0.0.1 --port 4173 --strictPort &
+vite_pid=$!
+cleanup() {
+  kill "$vite_pid" 2>/dev/null || true
+  wait "$vite_pid" 2>/dev/null || true
+}
+trap cleanup EXIT INT TERM
+
+for _ in {1..40}; do
+  if curl --noproxy '*' --fail --silent --max-time 2 http://127.0.0.1:4173/ >/dev/null; then
+    ./node_modules/.bin/playwright test "$@"
+    exit $?
+  fi
+  if ! kill -0 "$vite_pid" 2>/dev/null; then
+    printf 'Vite E2E server exited before becoming ready.\n' >&2
+    exit 1
+  fi
+  sleep 0.25
+done
+
+printf 'Vite E2E server did not become ready within 10 seconds.\n' >&2
+exit 1
```

**File**: `frontend/scripts/run_tests.sh` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+# Vitest 1.x can leave its worker pool open on Node 22 when a larger UI suite
+# completes in one process. Keep watch-mode behavior unchanged, but run bounded
+# batches for deterministic one-shot CI/release runs.
+if [[ " ${*:-} " == *" --run "* ]]; then
+  shopt -s globstar nullglob
+  test_files=(src/**/*.test.ts src/**/*.test.tsx)
+  run_args=()
+  for arg in "$@"; do
+    [[ "$arg" == "--run" ]] || run_args+=("$arg")
+  done
+  batch_size=8
+  for ((offset = 0; offset < ${#test_files[@]}; offset += batch_size)); do
+    ./node_modules/.bin/vitest --run "${run_args[@]}" "${test_files[@]:offset:batch_size}"
+  done
+else
+  exec ./node_modules/.bin/vitest "$@"
+fi
```

**File**: `frontend/src/components/review/ExperimentFeedbackPanel.tsx` (modified, +132/-67)
```diff
@@ -18,9 +18,11 @@ import { Badge } from '@/components/ui/badge'
 import { Button, buttonVariants } from '@/components/ui/button'
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
 import { API_BASE_URL } from '@/lib/api'
+import { useSystemSession } from '@/lib/hooks/useApi'
 import { useReviewLocale, type ReviewLocale } from '@/lib/reviewLocale'
 import type { QualityAssessment } from '@/lib/types/scientificResearch'
 import { ReviewIterationLoop, type ReviewLoopTrace } from './ReviewIterationLoop'
+import { SignoffDossier } from './SignoffDossier'
 
 interface RunArtifact {
   id: string
@@ -107,6 +109,11 @@ interface HumanSignoff {
   artifactHash: string
   reviewerRole?: string | null
   reviewerId?: string | null
+  reviewerName?: string | null
+  actorAccountId?: string | null
+  actorRole?: string | null
+  authAssurance?: string | null
+  acknowledgements?: string[]
   rationale?: string
   conditions?: string[]
   decidedAt?: string | null
@@ -196,6 +203,7 @@ interface ExperimentFeedbackResponse {
   humanConditionVerifications?: HumanConditionVerificationState
   sourceArtifactUrls?: Record<string, string>
   closedLoop?: ReviewLoopTrace
+  publicationReady: boolean
 }
 
 interface ExperimentFeedbackHistory extends Omit<ExperimentFeedbackResponse, 'feedbackId'> {
@@ -249,6 +257,27 @@ const signoffStatusLabel: Record<HumanSignoffStatus, Record<ReviewLocale, string
   changes_requested: { 'zh-CN': '要求修改', 'en-US': 'Changes requested' },
 }
 
+const signoffAcknowledgements: Record<HumanSignoffStage, Array<{
+  id: string
+  label: Record<ReviewLocale, string>
+}>> = {
+  plan: [
+    { id: 'reviewed_scientific_question_and_hypothesis', label: { 'zh-CN': '已核对研究问题与假设', 'en-US': 'Reviewed the scientific question and hypothesis' } },
+    { id: 'reviewed_data_split_and_holdout', label: { 'zh-CN': '已核对数据划分及最终留出隔离', 'en-US': 'Reviewed data splits and final-holdout isolation' } },
+    { id: 'reviewed_metrics_budget_and_stop_conditions', label: { 'zh-CN': '已核对主指标、guardrail、预算与停止条件', 'en-US': 'Reviewed primary metric, guardrails, budget, and stop conditions' } },
+  ],
+  repair: [
+    { id: 'reviewed_reviewx_findings', label: { 'zh-CN': '已核对 ReviewX finding', 'en-US': 'Reviewed ReviewX findings' } },
+    { id: 'confirmed_repairs_applied', label: { 'zh-CN': '已确认修复实际应用到目标节点', 'en-US': 'Confirmed repairs were applied to target nodes' } },
+    { id: 'reviewed_rerun_scope_and_residual_risk', label: { 'zh-CN': '已核对重跑范围和剩余风险', 'en-US': 'Reviewed rerun scope and residual risk' } },
+  ],
+  conclusion: [
+    { id: 'reviewed_baseline_current_and_interval', label: { 'zh-CN': '已核对基线、当前值和统计区间', 'en-US': 'Reviewed baseline, current value, and interval' } },
+    { id: 'reviewed_side_effects_and_limitations', label: { 'zh-CN': '已核对副作用与限制', 'en-US': 'Reviewed side effects and limitations' } },
+    { id: 'accepted_claim_scope', label: { 'zh-CN': '同意只在档案定义的 claim scope 内发布', 'en-US': 'Accepted publication only within the dossier claim scope' } },
+  ],
+}
+
 const uiStatusLabels: Record<string, Record<ReviewLocale, string>> = {
   queued: { 'zh-CN': '排队中', 'en-US': 'queued' },
   running: { 'zh-CN': '运行中', 'en-US': 'running' },
@@ -341,6 +370,7 @@ export function ExperimentFeedbackPanel({
   initialFocus?: 'loop' | 'signoff'
 }) {
   const { locale, text } = useReviewLocale()
+  const session = useSystemSession()
   const statusText = (status?: string) => status
     ? uiStatusLabels[status]?.[locale] || status
     : '--'
@@ -389,6 +419,12 @@ export function ExperimentFeedbackPanel({
   const [signoffConditions, setSignoffConditions] = useState('')
   const [signoffTargetSections, setSignoffTargetSections] = useState('')
   const [signoffLoading, setSignoffLoading] = useState(false)
+  const [dossierRefreshKey, setDossierRefreshKey] = useState(0)
+  const [acknowledgements, setAcknowledgements] = useState<Record<HumanSignoffStage, string[]>>({
+    plan: [],
+    repair: [],
+    conclusion: [],
+  })
   const [feedbackApplying, setFeedbackApplying] = useState(false)
   const [selectedConditionId, setSelectedConditionId] = useState('')
   const [conditionRationale, setConditionRationale] = useState('')
@@ -655,6 +691,7 @@ export function ExperimentFeedbackPanel({
       humanConditionVerifications: record.humanConditionVerifications,
       sourceArtifactUrls: record.sourceArtifactUrls,
       closedLoop: record.closedLoop,
+      publicationReady: record.publicationReady,
     })
     setPlanRevised(Boolean(record.planRevision))
     setNextRunId(record.nextRunId || '')
@@ -703,6 +740,7 @@ export function ExperimentFeedbackPanel({
           humanSignoffs: signoffData.humanSignoffs,
           humanFeedback: signoffData.humanFeedback,
           humanConditionVerifications: signoffData.humanConditionVerifications,
+          publicationReady: signoffData.publicationReady,
         } : current)
       }
       void loadHistory(result.runId, result.researchSeriesId)
@@ -815,6 +853,8 @@ 
```

**File**: `frontend/src/components/review/SignoffDossier.test.tsx` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { render, screen, waitFor } from '@testing-library/react'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+
+import { SignoffDossier } from './SignoffDossier'
+
+const payload = {
+  schemaVersion: 'reviewx-signoff-dossier/v1', release: 'draft', watermark: 'DRAFT_NOT_HUMAN_APPROVED', generatedAt: 'now', contentHash: 'sha256:1234567890',
+  subject: { feedbackId: 'feedback-1', runId: 'run-1', researchSeriesId: 'series-1', scientificQuestion: '<script>question</script>', planPackageId: 'plan-1', iterationNumber: 2, artifactHash: 'sha256:artifact' },
+  executiveDecision: { iterationDecision: 'accept_results', qualityGate: 'pass', publicationReady: false, blockingReasons: [{ code: 'CONCLUSION_SIGNOFF_REQUIRED', message: '结论尚未签核', nextStep: '完成结论确认' }] },
+  plan: { hypothesis: 'h', baseline: 'old', intervention: 'new', primaryMetric: 'f1', guardrails: [], stopConditions: [], delta: { changedSections: ['sampling'], parameterChanges: [{ field: 'samples', oldValue: 80, newValue: 80, rationale: 'matched budget', targetNode: 'experiment' }], evidenceReferences: [] } },
+  evidence: { dataSource: ['simulation'], dataSplitPolicy: 'frozen holdout', metrics: [
+    { name: 'f1', direction: 'maximize', baseline: 0.7, current: 0.71, delta: 0.01, ciLower: -0.02, ciUpper: 0.03, decision: 'BOUNDARY', interpretation: '方向一致但统计不确定 / Directionally consistent but statistically uncertain', role: 'primary', split: 'holdout', sourceArtifactId: 'artifact-1', source: 'record.metricSnapshot' },
+    { name: 'accuracy', direction: 'maximize', baseline: 0.8, current: 0.79, delta: -0.01, ciLower: -0.02, ciUpper: 0, decision: 'BOUNDARY', role: 'guardrail', split: 'holdout', sourceArtifactId: 'artifact-1', source: 'record.metricSnapshot' },
+  ] },
+  review: { findingCounts: {}, findings: [], humanFeedback: {}, acceptanceConditions: {} }, limitations: ["<img src=x onerror=alert('xss')>"],
+  provenance: { sourceArtifacts: { evidence: 'artifact-1' }, benchmarkFingerprint: 'sha256:bench', qwenCalls: [], auditIntegrity: { valid: true, eventCount: 0 } },
+  signoffs: { plan: { status: 'approved', reviewerName: '<b>Reviewer</b>', actorAccountId: 'signer', authAssurance: 'trusted_proxy_basic_auth', decidedAt: 'now', artifactHash: 'sha256:plan', stale: false } },
+}
+
+describe('SignoffDossier', () => {
+  beforeEach(() => {
+    window.localStorage.setItem('faros.review.locale', 'zh-CN')
+    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
+  })
+
+  afterEach(() => {
+    vi.unstubAllGlobals()
+    window.localStorage.clear()
+  })
+
+  it('renders human summary instead of raw JSON and labels the raw download', async () => {
+    const { container } = render(<SignoffDossier feedbackId="feedback-1" />)
+    await screen.findByText('<script>question</script>')
+    expect(screen.getByText(/下载 JSON 原始证据|Download raw JSON evidence/)).toBeInTheDocument()
+    expect(screen.getByText('方向一致但统计不确定 / Directionally consistent but statistically uncertain')).toBeInTheDocument()
+    expect(screen.getByText(/Guardrails/)).toBeInTheDocument()
+    expect(screen.getByText('samples')).toBeInTheDocument()
+    expect(container.querySelector('script')).toBeNull()
+    expect(container.querySelector('img')).toBeNull()
+    expect(screen.getByText('正式签核档案')).toHaveAttribute('aria-disabled', 'true')
+  })
+
+  it('shows actionable blockers and signer assurance', async () => {
+    render(<SignoffDossier feedbackId="feedback-1" />)
+    await screen.findByText('结论尚未签核')
+    expect(screen.getByText(/完成结论确认/)).toBeInTheDocument()
+    expect(screen.getByText('trusted_proxy_basic_auth')).toBeInTheDocument()
+    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
+  })
+
+  it('supports the complete English dossier navigation and actions', async () => {
+    window.localStorage.setItem('faros.review.locale', 'en-US')
+    render(<SignoffDossier feedbackId="feedback-1" />)
+    await screen.findByText('Human-readable signoff summary')
+    expect(screen.getByText('Review signoff summary')).toBeInTheDocument()
+    expect(screen.getByText('Print / export dossier')).toBeInTheDocument()
+    expect(screen.getByText('Download raw JSON evidence')).toBeInTheDocument()
+    expect(screen.getByRole('navigation', { name: 'Dossier sections' })).toBeInTheDocument()
+  })
+})
```

**File**: `frontend/src/components/review/SignoffDossier.tsx` (added, +219/-0)
```diff
@@ -0,0 +1,219 @@
+import { useEffect, useMemo, useState } from 'react'
+import { Download, ExternalLink, FileCheck2, Loader2, Printer, ShieldCheck } from 'lucide-react'
+
+import { Badge } from '@/components/ui/badge'
+import { buttonVariants } from '@/components/ui/button'
+import { API_BASE_URL } from '@/lib/api'
+import { useReviewLocale } from '@/lib/reviewLocale'
+
+export interface DossierMetric {
+  name: string
+  direction: string
+  baseline: number | null
+  current: number | null
+  delta: number | null
+  ciLower: number | null
+  ciUpper: number | null
+  decision: string
+  interpretation?: string
+  role: string
+  split: string
+  sourceArtifactId?: string | null
+  source: string
+}
+
+export interface SignoffDossierData {
+  schemaVersion: string
+  release: 'draft' | 'official'
+  watermark?: string | null
+  generatedAt: string
+  contentHash: string
+  subject: {
+    feedbackId: string
+    runId: string
+    researchSeriesId: string
+    scientificQuestion: string
+    planPackageId: string
+    iterationNumber: number
+    artifactHash: string
+  }
+  executiveDecision: {
+    iterationDecision: string
+    qualityGate: string
+    publicationReady: boolean
+    blockingReasons: Array<{ code: string; message: string; nextStep: string }>
+  }
+  plan: {
+    hypothesis: string
+    baseline: string
+    intervention: string
+    primaryMetric: string
+    guardrails: unknown[]
+    stopConditions: unknown[]
+    delta: {
+      changedSections: string[]
+      parameterChanges: Array<{
+        field: string
+        oldValue: unknown
+        newValue: unknown
+        rationale: string
+        targetNode: string
+      }>
+      evidenceReferences: string[]
+    }
+  }
+  evidence: {
+    dataSource: unknown[]
+    dataSplitPolicy: string
+    metrics: DossierMetric[]
+  }
+  review: {
+    findingCounts: Record<string, number>
+    findings: Array<Record<string, unknown>>
+    humanFeedback: Record<string, unknown>
+    acceptanceConditions: Record<string, unknown>
+  }
+  limitations: string[]
+  provenance: {
+    sourceArtifacts: Record<string, string>
+    benchmarkFingerprint: string
+    qwenCalls: Array<Record<string, unknown>>
+    auditIntegrity: { valid: boolean; eventCount?: number }
+  }
+  signoffs: Record<string, {
+    status: string
+    reviewerName?: string | null
+    reviewerId?: string | null
+    actorAccountId?: string | null
+    authAssurance?: string | null
+    decidedAt?: string | null
+    artifactHash?: string | null
+    stale?: boolean
+  }>
+}
+
+function valueText(value: unknown) {
+  if (value === null || value === undefined || value === '') return '—'
+  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
+  if (typeof value === 'object') return JSON.stringify(value)
+  return String(value)
+}
+
+export function SignoffDossier({ feedbackId, refreshKey = 0 }: { feedbackId: string; refreshKey?: number }) {
+  const { text } = useReviewLocale()
+  const [dossier, setDossier] = useState<SignoffDossierData | null>(null)
+  const [error, setError] = useState('')
+  const [loading, setLoading] = useState(true)
+
+  useEffect(() => {
+    let cancelled = false
+    setLoading(true)
+    setError('')
+    fetch(`${API_BASE_URL}/api/v1/reviews/reviewx/experiment-feedback/${encodeURIComponent(feedbackId)}/signoff-dossier`)
+      .then(async (response) => {
+        const payload = await response.json().catch(() => ({}))
+        if (!response.ok) throw new Error(String(payload.detail || `Dossier unavailable (${response.status})`))
+        return payload as SignoffDossierData
+      })
+      .then((payload) => {
+        if (!cancelled) setDossier(payload)
+      })
+      .catch((loadError) => {
+        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Dossier unavailable')
+      })
+      .finally(() => {
+        if (!cancelled) setLoading(false)
+      })
+    return () => { cancelled = true }
+  }, [feedbackId, refreshKey])
+
+  const ids = useMemo(() => ({
+    overview: `dossier-${feedbackId}-overview`,
+    plan: `dossier-${feedbackId}-plan`,
+    evidence: `dossier-${feedbackId}-evidence`,
+    audit: `dossier-${feedbackId}-audit`,
+  }), [feedbackId])
+
+  if (loading) {
+    return (
+      <div aria-live="polite" className="flex min-h-40 items-center justify-center border-y border-slate-200 dark:border-slate-700">
+        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
+        {text('正在构建签核摘要…', 'Building signoff summary…')}
+      </div>
+    )
+  }
+  if (error || !dossier) {
+    return <div role="alert" className="border-y border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>
+  }
+
+  const primary = dossier.evidence.metrics.find((metric) => metric.role === 'primary') || dossier.evidence.metrics[0]
+  const guardrails = dossier.evidence.metrics.filter((metric) => metric.role === 'guardrai
```

---

### Incident Patch 13: `910f32fe` (2026-09-01)
**Commit Message**: fix(deploy): make runtime dependencies reproducible

**File**: `README.md` (modified, +26/-12)
```diff
@@ -13,8 +13,8 @@
 <p align="center">
   <a href="https://github.com/OpenNSWM-Lab/FAROS/stargazers"><img src="https://img.shields.io/github/stars/OpenNSWM-Lab/FAROS?style=for-the-badge&color=FFB300&label=Stars" alt="GitHub Stars" /></a>
   <img src="https://img.shields.io/badge/Release-1.1.0--rc1-0891B2?style=for-the-badge" alt="Release 1.1.0-rc1" />
-  <img src="https://img.shields.io/badge/Backend_Tests-608_passed-16A34A?style=for-the-badge" alt="608 backend tests passed" />
-  <img src="https://img.shields.io/badge/Frontend_Tests-30_passed-2563EB?style=for-the-badge" alt="30 frontend tests passed" />
+  <img src="https://img.shields.io/badge/Backend_Tests-644_passed-16A34A?style=for-the-badge" alt="644 backend tests passed" />
+  <img src="https://img.shields.io/badge/Frontend_Tests-35_passed-2563EB?style=for-the-badge" alt="35 frontend tests passed" />
   <img src="https://img.shields.io/badge/Qwen-Ready-FFB300?style=for-the-badge" alt="Qwen Ready" />
 </p>
 
@@ -181,10 +181,16 @@ FAROS/
 
 - Python `3.11+`
 - Node.js `18+`
-- 可选：Docker，用于更强的代码执行隔离
-- 可选：`latexmk` 与 `pdflatex`，用于原生 LaTeX 编译
+- 本地浏览与轻量开发可不安装 Docker；正式 Code/Experiment 沙箱必须使用 Docker Engine
+- 正式论文 PDF 需要 `latexmk`、XeLaTeX、`ctex` 中文宏包和一套 CJK 字体；缺失时只能生成回退 PDF
 - 至少一个兼容的 LLM Provider；推荐使用千问
 
+Ubuntu 的完整依赖、计算节点/公网网关架构和 systemd/Caddy 配置见 [部署指南](deploy/README.md)。安装后可先运行：
+
+```bash
+./scripts/check_deployment_dependencies.sh --role local
+```
+
 ### 1. 启动后端
 
 ```bash
@@ -193,6 +199,7 @@ cd FAROS/backend
 
 python3 -m venv .venv
 source .venv/bin/activate
+python -m pip install --upgrade pip
 pip install -r requirements.txt
 
 uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
@@ -202,7 +209,7 @@ uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
 
 ```bash
 cd FAROS/frontend
-npm install
+npm ci
 VITE_API_BASE_URL=http://127.0.0.1:8005 npm run dev
 ```
 
@@ -234,8 +241,8 @@ npm run build
 
 当前验证基线：
 
-- 后端：`608 passed`
-- 前端：`30 passed`
+- 后端：`644 passed`
+- 前端：`35 passed`
 - TypeScript 生产构建：通过
 - 真实千问选题推荐与主要页面流程：通过
 
@@ -310,10 +317,16 @@ Research interest
 
 - Python `3.11+`
 - Node.js `18+`
-- Optional: Docker for stronger execution isolation
-- Optional: `latexmk` and `pdflatex` for native LaTeX compilation
+- Docker Engine is optional for UI/lightweight local development and required for the production Code/Experiment sandbox
+- Formal paper PDFs require `latexmk`, XeLaTeX, the `ctex` Chinese package, and a CJK font; otherwise only the fallback PDF is available
 - At least one compatible LLM provider; Qwen is recommended
 
+See the [deployment guide](deploy/README.md) for the complete Ubuntu, compute-node, public-gateway, systemd, and Caddy requirements. Run the preflight check after installation:
+
+```bash
+./scripts/check_deployment_dependencies.sh --role local
+```
+
 ### 1. Backend
 
 ```bash
@@ -322,6 +335,7 @@ cd FAROS/backend
 
 python3 -m venv .venv
 source .venv/bin/activate
+python -m pip install --upgrade pip
 pip install -r requirements.txt
 
 uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
@@ -331,7 +345,7 @@ uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
 
 ```bash
 cd FAROS/frontend
-npm install
+npm ci
 VITE_API_BASE_URL=http://127.0.0.1:8005 npm run dev
 ```
 
@@ -363,8 +377,8 @@ npm run build
 
 Validated baseline:
 
-- Backend: `608 passed`
-- Frontend: `30 passed`
+- Backend: `644 passed`
+- Frontend: `35 passed`
 - TypeScript production build: passed
 - Live Qwen topic coaching and primary UI workflow: passed
 
```

**File**: `backend/app/services/pdf_renderer.py` (modified, +16/-0)
```diff
@@ -219,6 +219,22 @@ def _register_unicode_font(pdf) -> Optional[str]:
             return "FarosUnicode"
         except Exception as exc:
             logger.debug("Failed to load PDF unicode font %s: %s", path, exc)
+
+    latin_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
+    cjk_path = "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
+    if os.path.isfile(latin_path) and os.path.isfile(cjk_path):
+        try:
+            pdf.add_font("FarosUnicode", "", latin_path)
+            pdf.add_font("FarosCJKFallback", "", cjk_path)
+            pdf.set_fallback_fonts(["FarosCJKFallback"], exact_match=False)
+            return "FarosUnicode"
+        except Exception as exc:
+            logger.debug(
+                "Failed to load composite PDF fonts %s + %s: %s",
+                latin_path,
+                cjk_path,
+                exc,
+            )
     return None
 
 
```

**File**: `backend/requirements.txt` (modified, +11/-7)
```diff
@@ -1,15 +1,19 @@
 fastapi==0.109.0
+starlette>=0.35.0,<0.36.0
 uvicorn[standard]==0.27.0
 pydantic==2.5.3
 python-multipart==0.0.6
 python-dotenv>=1.0.0,<2
-sqlmodel>=0.0.14
-alembic>=1.13.0
-aiofiles>=23.0.0
+sqlmodel>=0.0.14,<0.1
+sqlalchemy>=2.0.14,<2.1
+alembic>=1.13.0,<2
+aiofiles>=23.0.0,<26
 litellm==1.82.0
-matplotlib
+openai>=2.8.0,<4
+httpx>=0.27,<0.28
+certifi>=2024.2.2
+matplotlib>=3.8,<4
 numpy>=1.26,<3
-fpdf
-httpx<0.28
-docker>=7.0.0
+fpdf2>=2.8,<3
+docker>=7.0.0,<8
 cryptography>=43.0.0,<51
```

**File**: `backend/scripts/python_runner.sh` (modified, +10/-4)
```diff
@@ -1,6 +1,9 @@
 #!/usr/bin/env bash
 
 # Run backend Python commands through an explicit interpreter when available.
+_PYTHON_RUNNER_BACKEND_DIR="${BACKEND_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
+_PYTHON_RUNNER_ROOT_DIR="$(cd "$_PYTHON_RUNNER_BACKEND_DIR/.." && pwd)"
+
 run_py() {
   if [ -n "${FAROS_PYTHON:-}" ]; then
     if [ ! -x "$FAROS_PYTHON" ]; then
@@ -11,18 +14,21 @@ run_py() {
       shift
     fi
     "$FAROS_PYTHON" "$@"
+  elif [ -x "$_PYTHON_RUNNER_BACKEND_DIR/.venv/bin/python" ] && [ "$1" = "python" ]; then
+    shift
+    "$_PYTHON_RUNNER_BACKEND_DIR/.venv/bin/python" "$@"
+  elif [ -x "$_PYTHON_RUNNER_ROOT_DIR/.venv/bin/python" ] && [ "$1" = "python" ]; then
+    shift
+    "$_PYTHON_RUNNER_ROOT_DIR/.venv/bin/python" "$@"
   elif command -v conda >/dev/null 2>&1 && { [ -d "$HOME/anaconda3/envs/aist" ] || [ -d "$HOME/miniconda3/envs/aist" ]; }; then
     conda run --no-capture-output -n aist "$@"
-  elif [ -x "$BACKEND_DIR/.venv/bin/python" ] && [ "$1" = "python" ]; then
-    shift
-    "$BACKEND_DIR/.venv/bin/python" "$@"
   elif command -v python >/dev/null 2>&1; then
     "$@"
   elif command -v python3 >/dev/null 2>&1 && [ "$1" = "python" ]; then
     shift
     python3 "$@"
   else
-    printf 'Python interpreter not found. Create backend/.venv, set FAROS_PYTHON, or set up the aist conda environment.\n' >&2
+    printf 'Python interpreter not found. Create backend/.venv or .venv, set FAROS_PYTHON, or set up the aist conda environment.\n' >&2
     return 127
   fi
 }
```

**File**: `backend/tests/test_dependency_manifest.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import json
+import re
+from pathlib import Path
+
+from packaging.requirements import Requirement
+
+
+PROJECT_ROOT = Path(__file__).resolve().parents[2]
+
+
+def _backend_requirement_names() -> set[str]:
+    names: set[str] = set()
+    requirements = PROJECT_ROOT / "backend" / "requirements.txt"
+    for raw_line in requirements.read_text(encoding="utf-8").splitlines():
+        line = raw_line.split("#", 1)[0].strip()
+        if line:
+            names.add(Requirement(line).name.lower())
+    return names
+
+
+def test_runtime_direct_dependencies_are_explicitly_declared() -> None:
+    declared = _backend_requirement_names()
+    direct_runtime_dependencies = {
+        "aiofiles",
+        "certifi",
+        "cryptography",
+        "docker",
+        "fastapi",
+        "fpdf2",
+        "httpx",
+        "litellm",
+        "matplotlib",
+        "numpy",
+        "openai",
+        "pydantic",
+        "python-dotenv",
+        "python-multipart",
+        "sqlalchemy",
+        "sqlmodel",
+        "starlette",
+        "uvicorn",
+    }
+
+    assert direct_runtime_dependencies <= declared
+    assert "fpdf" not in declared
+
+
+def test_frontend_node_requirement_matches_vite_runtime() -> None:
+    package = json.loads(
+        (PROJECT_ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
+    )
+    package_lock = json.loads(
+        (PROJECT_ROOT / "frontend" / "package-lock.json").read_text(encoding="utf-8")
+    )
+    engine = package["engines"]["node"]
+    match = re.search(r">=\s*(\d+)", engine)
+
+    assert match is not None and int(match.group(1)) >= 18
+    assert package_lock["packages"][""]["engines"]["node"] == engine
+
+
+def test_gateway_template_forwards_authenticated_user_identity() -> None:
+    caddyfile = (
+        PROJECT_ROOT / "deploy" / "caddy" / "Caddyfile.example"
+    ).read_text(encoding="utf-8")
+    credentials = (
+        PROJECT_ROOT / "deploy" / "systemd" / "faros-credentials.env.example"
+    ).read_text(encoding="utf-8")
+
+    assert "header_up X-Faros-User {http.auth.user.id}" in caddyfile
+    assert "FAROS_CREDENTIAL_KEY=REPLACE_WITH_A_FERNET_KEY" in credentials
+    assert "QWEN_API_KEY=" in credentials
```

**File**: `backend/tests/test_paper_latex_safety.py` (modified, +42/-1)
```diff
@@ -41,7 +41,11 @@
     sanitize_latex_text_specials,
 )
 from app.modules.paper.storage import create_paper, delete_paper, get_paper_latex_dir, read_paper_file, write_paper_file
-from app.services.pdf_renderer import _requires_xelatex, _strip_latex
+from app.services.pdf_renderer import (
+    _register_unicode_font,
+    _requires_xelatex,
+    _strip_latex,
+)
 
 
 class FakeChatResponse:
@@ -955,6 +959,43 @@ def test_fallback_latex_stripper_can_preserve_chinese_text():
     assert "?" in _strip_latex(content, preserve_unicode=False)
 
 
+def test_pdf_renderer_combines_dejavu_and_droid_fallback_fonts(monkeypatch):
+    available = {
+        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
+    }
+
+    class FakePDF:
+        def __init__(self):
+            self.fonts = []
+            self.fallback = None
+
+        def add_font(self, family, style, path):
+            self.fonts.append((family, style, path))
+
+        def set_fallback_fonts(self, families, exact_match=True):
+            self.fallback = (families, exact_match)
+
+    monkeypatch.delenv("FAROS_PDF_FONT", raising=False)
+    monkeypatch.setattr(os.path, "isfile", lambda path: path in available)
+    pdf = FakePDF()
+
+    assert _register_unicode_font(pdf) == "FarosUnicode"
+    assert pdf.fonts == [
+        (
+            "FarosUnicode",
+            "",
+            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+        ),
+        (
+            "FarosCJKFallback",
+            "",
+            "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
+        ),
+    ]
+    assert pdf.fallback == (["FarosCJKFallback"], False)
+
+
 def test_explicit_selected_figures_do_not_fallback_to_figure_ids_when_all_excluded():
     paper = {
         "id": "paper_test",
```

**File**: `deploy/README.md` (added, +332/-0)
```diff
@@ -0,0 +1,332 @@
+# FAROS 部署与依赖指南
+
+本文档给出一套可从空机器复现的部署基线。开发环境、内网计算节点和公网网关承担不同职责，不应把所有依赖都安装在公网服务器上。
+
+## 1. 推荐架构
+
+```text
+Browser
+  -> HTTPS + Basic Auth (public gateway / Caddy)
+  -> /api/* reverse proxy on 127.0.0.1:18005
+  -> SSH reverse tunnel
+  -> FastAPI on the private compute node
+  -> Docker CPU/GPU sandboxes, DATA_DIR, LaTeX/PDF artifacts
+```
+
+公网网关只负责 TLS、账号认证、静态前端和 API 转发。后端、数据库、用户 Provider 配置、论文工程及实验产物均留在计算节点。Caddy 必须把已认证用户名写入 `X-Faros-User`，否则用户级 API Key 隔离不会生效。
+
+## 2. 依赖矩阵
+
+| 依赖 | 本地开发 | 计算节点 | 公网网关 | 用途 |
+| --- | --- | --- | --- | --- |
+| Python 3.11+ | 必需 | 必需 | 不需要 | FastAPI、智能体和实验管理 |
+| `backend/requirements.txt` | 必需 | 必需 | 不需要 | 后端运行时 |
+| Node.js 18+ / npm | 必需 | 构建机可选 | 预构建部署时不需要 | React 构建和测试 |
+| Docker Engine | 可选 | 必需 | 不需要 | Code/Experiment 隔离执行 |
+| CPU 沙箱镜像 | 可选 | 必需 | 不需要 | 通用实验与测试 |
+| NVIDIA 驱动与 Container Toolkit | 可选 | GPU 实验必需 | 不需要 | GPU 调度和容器透传 |
+| `latexmk` + XeLaTeX | 推荐 | 必需 | 不需要 | `ctexart` 正式论文 PDF |
+| CJK 字体 | 推荐 | 必需 | 不需要 | `fpdf2` 回退渲染 |
+| Git | 必需 | 必需 | 可选 | 代码、版本来源和运行记录 |
+| OpenSSH client | 通常已有 | 必需 | 不需要 | 计算节点反向隧道 |
+| OpenSSH server | 不需要 | 通常已有 | 必需 | 接收反向隧道 |
+| Caddy 2 | 不需要 | 不需要 | 必需 | HTTPS、认证、代理和静态文件 |
+| `rsync` / `curl` | 推荐 | 推荐 | 推荐 | 原子发布和健康检查 |
+
+至少还需要一个 OpenAI-compatible LLM Provider。推荐千问/DashScope；Semantic Scholar、OpenAlex、Crossref 和 arXiv 的基础检索不依赖付费 API Key，配置联系邮箱或可选 Key 可以改善限流体验。
+
+## 3. 自动预检
+
+仓库提供分角色预检，不会输出 API Key 或凭据内容：
+
+```bash
+# 本地开发机
+./scripts/check_deployment_dependencies.sh --role local
+
+# 内网计算节点；同时强制验证 NVIDIA 运行时和 GPU 镜像
+DATA_DIR=/data/zxy/faros/runtime/data \
+MPLCONFIGDIR=/data/zxy/faros/runtime/matplotlib \
+./scripts/check_deployment_dependencies.sh --role compute --require-gpu
+
+# 公网网关
+sudo ./scripts/check_deployment_dependencies.sh --role gateway
+```
+
+`[fail]` 表示该角色无法完整运行；`[warn]` 表示可选能力不可用。预检会验证 Python 包版本及导入、旧 `fpdf` 冲突、npm 锁文件、Docker 权限和镜像、TeX 中文宏包、CJK 字体、Caddy 配置及前端发布目录。
+
+## 4. 本地开发环境
+
+### 4.1 系统基础包（Ubuntu/WSL）
+
+```bash
+sudo apt-get update
+sudo apt-get install -y \
+  python3 python3-venv python3-pip git curl ca-certificates rsync
+```
+
+Node.js 必须是 18 或更高版本。安装完成后先检查：
+
+```bash
+python3 --version
+node --version
+npm --version
+```
+
+### 4.2 Python 环境
+
+推荐在仓库根目录或 `backend/` 创建虚拟环境，两种位置都会被 FAROS 脚本识别：
+
+```bash
+cd FAROS
+python3 -m venv .venv
+source .venv/bin/activate
+python -m pip install --upgrade pip
+python -m pip install -r backend/requirements-dev.txt
+python -m pip check
+```
+
+运行时 PDF 回退实现使用 **fpdf2**，不是 2008 年的旧包 `fpdf`。升级已有环境时必须先移除旧包，避免两个发行包争用同一个 `fpdf` 命名空间：
+
+```bash
+python -m pip uninstall -y fpdf
+python -m pip install --upgrade --force-reinstall 'fpdf2>=2.8,<3'
+```
+
+若虚拟环境由 `uv` 创建且不带 pip，可使用：
+
+```bash
+uv pip install --python /path/to/venv/bin/python -r backend/requirements-dev.txt
+```
+
+### 4.3 前端环境
+
+必须使用仓库锁文件，不要用会改写依赖解析结果的无约束安装：
+
+```bash
+cd frontend
+npm ci
+npm run typecheck
+npm run test -- --run
+npm run build
+```
+
+### 4.4 本地启动
+
+```bash
+cd backend
+../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
+```
+
+另开终端：
+
+```bash
+cd frontend
+VITE_API_BASE_URL=http://127.0.0.1:8005 npm run dev
+```
+
+本地只检查页面时可以使用默认 `subprocess` 沙箱。涉及评委演示、依赖安装或不可信代码时，应将 `SANDBOX_DEFAULT_BACKEND` 设为 `docker`。
+
+## 5. 计算节点
+
+### 5.1 系统依赖
+
+正式论文链路使用 `ctexart`，因此 `pdflatex` 单独存在并不够：
+
+```bash
+sudo apt-get update
+sudo apt-get install -y \
+  python3 python3-venv python3-pip git curl ca-certificates rsync \
+  openssh-client latexmk texlive-xetex texlive-lang-chinese \
+  texlive-latex-extra fonts-noto-cjk
+```
+
+`algorithm2e` 是可选增强包。缺失时 FAROS 的 LaTeX 模板会使用内置算法块，不影响主流程；如需原生样式，可额外安装发行版提供的 TeX science 包。
+
+### 5.2 Docker 与沙箱镜像
+
+安装 Docker Engine 后，将运行 FAROS 的用户加入 `docker` 组并重新登录：
+
+```bash
+sudo usermod -aG docker "$USER"
+docker info
+```
+
+构建与服务环境变量同名的镜像：
+
+```bash
+cd FAROS
+docker build -f backend/docker/codegen-test.Dockerfile \
+  -t faros/codegen-test:3.12 backend
+
+docker build -f backend/docker/codegen-gpu.Dockerfile \
+  -t faros/codegen-gpu:cuda12.4 backend
+```
+
+GPU 方案还需要主机 NVIDIA 驱动和 NVIDIA Container Toolkit。用真实容器验证，不要只检查 `nvidia-smi`：
+
+```bash
+docker run --rm --gpus all faros/codegen-gpu:cuda12.4 \
+  python -c 'import torch; print(torch.cuda.is_available(), torch.cuda.device_count())'
+```
+
+### 5.3 目录与 Python
+
+参考部署以 `/data/zxy/faros` 为根，与仓库中的 systemd 单元一致。若目标机器使用其他路径，必须同步修改单元和两个环境文件：
+
+```bash
+mkdir -p /data/zxy/faros/{current,releases,runtime/data,runtime/matplotlib,runtime/provider-configs}
+python3 -m venv /data/zxy/faros/venv
+/data/zxy/faros/venv/bin/python -m pip install --upgrade pip
+/data/zxy/faros/venv/bin/python -m pip install -r backend/requirements.txt
+```
+
+所有目录必须归 systemd 中的 `User` 所有。`DATA_DIR`、`MPLCONFIGDIR` 和 Provider 配置目录必须可写；SQLite 数据库不应通过 Git 或 rsync 覆盖。
+
+### 5.4 运行环境与凭据
+
+复制并修改两个模板：
+
+```bash
+install -m 0640 deploy/systemd/faros-compute.env.example \
+  /data/zxy/faros/runtime/backend.env
+install -m 0600 deploy/systemd/faros-credentials.env.example \
+  /data/zxy/faros/
```

**File**: `deploy/caddy/Caddyfile.example` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# Replace the hostname and password hashes before installing this file.
+# Generate each hash with: caddy hash-password --plaintext 'a-strong-password'
+
+faros.example.com {
+	encode zstd gzip
+
+	basicauth {
+		faros-team REPLACE_WITH_CADDY_HASH
+		faros-judge REPLACE_WITH_CADDY_HASH
+	}
+
+	@api path /api/*
+	handle @api {
+		reverse_proxy 127.0.0.1:18005 {
+			header_up X-Faros-User {http.auth.user.id}
+		}
+	}
+
+	handle {
+		root * /opt/faros/frontend-current
+		try_files {path} /index.html
+		file_server
+	}
+
+	@assets path /assets/*
+	header @assets Cache-Control "public, max-age=31536000, immutable"
+	header {
+		Strict-Transport-Security "max-age=31536000; includeSubDomains"
+		X-Content-Type-Options "nosniff"
+		Referrer-Policy "strict-origin-when-cross-origin"
+		-Server
+	}
+
+	log {
+		output file /var/log/caddy/faros-access.log
+		format console
+	}
+}
```

---

### Incident Patch 14: `b8c83b07` (2026-09-01)
**Commit Message**: fix(paper): make PDF rendering recoverable

**File**: `frontend/src/pages/Papers/PaperWritingWorkspace.tsx` (modified, +78/-3)
```diff
@@ -58,6 +58,7 @@ interface PaperRecord {
   evidenceStatus?: string
   compileStatus?: string
   compileErrors?: string | null
+  pdfRenderMode?: string | null
   simpleReviewPassed?: boolean
   logs?: PaperLog[]
   createdAt: string
@@ -209,6 +210,8 @@ export function PaperWritingWorkspace() {
   const [savingMetadata, setSavingMetadata] = useState(false)
   const [feedbackRounds, setFeedbackRounds] = useState<FeedbackRound[]>([])
   const [pdfTs, setPdfTs] = useState(Date.now())
+  const [renderingPdf, setRenderingPdf] = useState(false)
+  const [pdfRenderError, setPdfRenderError] = useState('')
   const [loading, setLoading] = useState(true)
   const [draftTitle, setDraftTitle] = useState('')
   const [draftPaperType, setDraftPaperType] = useState('algorithm')
@@ -467,6 +470,40 @@ export function PaperWritingWorkspace() {
     }
   }
 
+  const renderPdf = async () => {
+    if (!paper || renderingPdf) return
+    const previousUpdatedAt = paper.updatedAt
+    setRenderingPdf(true)
+    setPdfRenderError('')
+    try {
+      const resp = await fetch(`${API_BASE}/api/v1/papers/${paper.id}/render-pdf`, { method: 'POST' })
+      if (!resp.ok) {
+        const payload = await resp.json().catch(() => ({}))
+        throw new Error(payload.detail || `HTTP ${resp.status}`)
+      }
+
+      let latest: PaperRecord | null = null
+      for (let attempt = 0; attempt < 60; attempt += 1) {
+        await new Promise(resolve => setTimeout(resolve, 1000))
+        latest = await refreshPaper()
+        const renderFinished = latest?.updatedAt !== previousUpdatedAt
+        if (renderFinished && latest?.pdfAvailable) {
+          await refreshFiles()
+          setPdfTs(Date.now())
+          return
+        }
+        if (renderFinished && latest?.compileStatus === 'failed' && !latest.pdfAvailable) {
+          throw new Error(latest.compileErrors || text('PDF编译失败，请检查LaTeX源文件。', 'PDF compilation failed. Check the LaTeX sources.'))
+        }
+      }
+      throw new Error(latest?.compileErrors || text('PDF渲染超时，请稍后重试。', 'PDF rendering timed out. Please retry.'))
+    } catch (error) {
+      setPdfRenderError(error instanceof Error ? error.message : String(error))
+    } finally {
+      setRenderingPdf(false)
+    }
+  }
+
   const renderStage = () => {
     if (!paper) {
       return (
@@ -559,8 +596,11 @@ export function PaperWritingWorkspace() {
         fileContent={fileContent}
         loadFile={loadFile}
         pdfTs={pdfTs}
+        renderingPdf={renderingPdf}
+        pdfRenderError={pdfRenderError}
+        renderPdf={renderPdf}
         refreshFiles={async () => {
-          const entries = await refreshFiles()
+          const [, entries] = await Promise.all([refreshPaper(), refreshFiles()])
           await refreshFeedback(entries)
           setPdfTs(Date.now())
         }}
@@ -933,8 +973,13 @@ function ResultStage(props: {
   fileContent: string
   loadFile: (path: string) => void
   pdfTs: number
+  renderingPdf: boolean
+  pdfRenderError: string
+  renderPdf: () => void
   refreshFiles: () => void
 }) {
+  const { text } = useReviewLocale()
+  const compileError = props.pdfRenderError || props.paper.compileErrors || ''
   return (
     <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
       <Card className="xl:col-span-3">
@@ -974,6 +1019,14 @@ function ResultStage(props: {
         </CardHeader>
         <CardContent className="space-y-3">
           <div className="flex flex-wrap gap-2">
+            <Button variant="outline" size="sm" onClick={props.renderPdf} disabled={props.renderingPdf}>
+              {props.renderingPdf
+                ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
+                : <RefreshCw className="mr-1 h-4 w-4" />}
+              {props.paper.pdfAvailable
+                ? text('重新渲染 PDF', 'Re-render PDF')
+                : text('生成 PDF', 'Render PDF')}
+            </Button>
             {props.paper.pdfAvailable && (
               <>
                 <a href={`${API_BASE}/api/v1/papers/${props.paper.id}/pdf?t=${props.pdfTs}`} target="_blank" rel="noopener noreferrer">
@@ -989,9 +1042,31 @@ function ResultStage(props: {
             </a>
           </div>
           {props.paper.pdfAvailable ? (
-            <iframe src={`${API_BASE}/api/v1/papers/${props.paper.id}/pdf?t=${props.pdfTs}`} className="h-[62vh] w-full rounded-md border" title="PDF Preview" />
+            <>
+              {props.paper.pdfRenderMode === 'fallback' && (
+                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
+                  {text('当前为兼容预览；原生LaTeX编译仍未通过，请查看下方错误后重新渲染。', 'This is a compatibility preview. Native LaTeX compilation still failed; inspect the error and re-render.')}
+                </div>
+              )}
+              <iframe src={`${API_BASE}/api/v1/papers/${props.paper.id}/pdf?t=${props.pdfTs}`} className="h-[62vh] w-full rounded-md border" title="PDF Preview" />
+            </>
         
```

---

### Incident Patch 15: `2357b7f2` (2026-08-31)
**Commit Message**: fix(deploy): preserve cleanup script executable mode



#### Recent Merged Pull Requests:
- **PR #42** (2026-08-12): feat(paper): 重构 FAROS paper 写作流程，引入 compile/review 多 agent 反馈循环 (@Ironknory)
- **PR #41** (2026-08-11): feat(code): 完善科学执行评估、可复现实验证据与结果导入流程 (@Eg4m1)
- **PR #36** (2026-08-04): Devtzb paper (@Ironknory)
- **PR #25** (2026-08-11): feat(idea): 搜索源扩充 + seed预检 + 公共契约对齐 + Review Gate修复 + 前端Dossier查看器 (@ryry12345ryry)
- **PR #24** (2026-07-14): feat: Idea Pipeline性能优化 + 强制多方向探索 (@ryry12345ryry)
- **PR #22** (2026-07-12): fix: 修复中文(CJK)Topic系统性偏差 — 9个Bug修复 + 学术搜索增强 (@ryry12345ryry)
- **PR #21** (closed): Devtzb (@ryry12345ryry)
- **PR #19** (2026-07-06): 优化 Code 模块 PlanPackage 执行链路与智能体进度展示 (@Eg4m1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

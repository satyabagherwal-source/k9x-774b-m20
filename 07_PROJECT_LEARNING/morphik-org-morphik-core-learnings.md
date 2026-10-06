# Forensic Learning Record (Deep Inspection): morphik-org/morphik-core

> **Canonical Artifact**: `07_PROJECT_LEARNING/morphik-org-morphik-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/morphik-org/morphik-core](https://github.com/morphik-org/morphik-core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:14.096Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `morphik-org/morphik-core`
- **Description**: Open-source multimodal retrieval engine (Morphik Core)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3715 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/api.py`
```
import json
import logging
import secrets
import time  # Add time import for profiling
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional

import arq
import jwt
import requests
import sentry_sdk
import tomli
from fastapi import Depends, FastAPI, Form, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware  # Import CORSMiddleware
from fastapi.responses import StreamingResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from starlette.middleware.sessions import SessionMiddleware

from core.app_factory import lifespan
from core.auth_utils import (
    clear_app_active_cache,
    ensure_app_is_active,
    mark_app_active,
    mark_app_revoked,
    verify_token,
)
from core.config import get_settings
from core.database.postgres_database import InvalidMetadataFilterError
from core.dependencies import get_optional_redis_pool, get_redis_pool
from core.limits_utils import check_and_increment_limits
from core.logging_config import setup_logging
from core.middleware.profiling import ProfilingMiddleware
from core.models.auth import AuthContext
from core.models.chat import ChatMessage
from core.models.completion import CompletionResponse
from core.models.documents import ChunkResult, Document, DocumentResult, GroupedChunkResponse
from core.models.prompts import validate_prompt_overrides_with_http_exception
from core.models.request import (
    BatchChunksRequest,
    BatchDocumentsRequest,
    CompletionQueryRequest,
    GenerateUriRequest,
    RetrieveRequest,
    SearchDocumentsRequest,
)
from core.models.responses import ChatTitleResponse, ModelsResponse
from core.routes.documents import router as documents_router
from core.routes.folders import router as folders_router
from core.routes.health import router as health_router
from core.routes.ingest import router as ingest_router
from core.routes.logs import router as logs_router  # noqa: E402 – import after FastAPI app
from core.routes.migrate import router as migrate_router
from core.routes.models import router as models_router
from core.routes.usage import router as usage_router
from core.routes.v2 import router as v2_router
from core.services.telemetry import TelemetryService
from core.services_init import document_service, ingestion_service
from core.utils.folder_utils import normalize_folder_selector

# Set up logging configuration for Docker environment
setup_logging()


def decode_query_image(query_image: Optional[str]) -> Optional[bytes]:
    """Decode a base64-encoded query image to bytes.

    Handles data URI format (e.g., "data:image/png;base64,...") by stripping the prefix.
    Raises HTTPException with 400 status if the base64 encoding is invalid.
    """
    if not query_image:
        return None

    import base64
    import binascii

    # Handle data URI format if present
    image_data = query_image
    if image_data.startswith("data:"):
        image_data = image_data.split(",", 1)[1]

    try:
        return base64.b64decode(image_data)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64-encoded image: {e}")


# Initialize FastAPI app
logger = logging.getLogger(__name__)


# Performance tracking class
class PerformanceTracker:
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = time.time()
        self.phases = {}
        self.current_phase = None
        self.sub_operations = {}  # Track sub-operations for hierarchical display
        self.phase_start = None

    def start_phase(self, phase_name: str):
        # End current phase if one is running
        if self.current_phase and self.phase_start:
            self.phases[self.current_phase] = time.time() - self.phase_start

        # Start new phase
        self.current_phase = phase_name
        self.phase_start = time.time()

    def add_suboperation(self, name: str, duration: float, parent_phase: Optional[str] = None):
        """Add a sub-operation timing that will be displayed under its parent phase"""
        if parent_phase:
            if parent_phase not in self.sub_operations:
                self.sub_operations[parent_phase] = {}
            self.sub_operations[parent_phase][name] = duration
        else:
            # If no parent specified, add as a regular phase
            self.phases[name] = duration

    def log_summary(self, additional_info: str = ""):
        total_time = time.time() - self.start_time

        # End current phase if still running
        if self.current_phase and self.phase_start:
            self.phases[self.current_phase] = time.time() - self.phase_start

        logger.info(f"=== {self.operation_name} Performance Summary ===")
        logger.info(f"Total time: {total_time:.2f}s")

        # Sort phases by duration (longest first) and include sub-operations under each phase
        for phase, duration in sorted(self.phases.items(), key=lambda x: x[1], reverse=True):
            percentage = (duration / total_time) * 100 if total_time > 0 else 0
            logger.info(f"  - {phase}: {duration:.2f}s ({percentage:.1f}%)")

            # Display sub-operations for this phase if any exist
            if phase in self.sub_operations:
                for sub_name, sub_duration in sorted(
                    self.sub_operations[phase].items(), key=lambda x: x[1], reverse=True
                ):
                    sub_percentage = (sub_duration / total_time) * 100 if total_time > 0 else 0
                    logger.info(f"    - {sub_name}: {sub_duration:.2f}s ({sub_percentage:.1f}%)")

        if additional_info:
            logger.info(additional_info)
        logger.info("=" * (len(self.operation_name) + 31))


# Global settings object
settings = get_settings()

# ---------------------------------------------------------------------------
# Initialize Sentry
# ---------------------------------------------------------------------------

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        # Add data like request headers and IP for users,
        # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
        send_default_pii=True,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for tracing.
        traces_sample_rate=1.0,
        # Set profile_session_sample_rate to 1.0 to profile 100%
        # of profile sessions.
        profile_session_sample_rate=1.0,
        # Set profile_lifecycle to "trace" to automatically
        # run the profiler on when there is an active transaction
        profile_lifecycle="trace",
    )
else:
    logger.warning("SENTRY_DSN is not set, skipping Sentry initialization")

# ---------------------------------------------------------------------------
# Application instance & core initialisation (moved lifespan, rest unchanged)
# ---------------------------------------------------------------------------

app = FastAPI(lifespan=lifespan)

# --------------------------------------------------------
# Optional per-request profiler (ENABLE_PROFILING=1)
# --------------------------------------------------------

app.add_middleware(ProfilingMiddleware)

# Add CORS middleware (same behaviour as before refactor)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise telemetry service
telemetry = TelemetryService()

# OpenTelemetry instrumentation – exclude noisy spans/headers
FastAPIInstrumentor.instrument_app(
    app,
    excluded_urls="health,health/.*",
    exclude_spans=["send", "receive"],
    http_capture_headers_server_request=None,
    http_capture_headers_server_response=None,
    tracer_provider=None,
)

# ---------------------------------------------------------------------------
# Session cookie behaviour differs between cloud / self-hosted
# ---------------------------------------------------------------------------

if settings.MODE == "cloud":
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SESSION_SECRET_KEY,
        same_site="none",
        https_only=True,
    )
else:
    app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY)


def _validate_admin_secret(admin_secret: Optional[str]) -> bool:
    """Return True if the provided admin secret is valid, otherwise raise."""
    if not admin_secret:
        return False
    if not settings.ADMIN_SERVICE_SECRET:
        raise HTTPException(status_code=403, detail="Admin secret authentication is not configured")
    if not secrets.compare_digest(admin_secret, settings.ADMIN_SERVICE_SECRET):
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    return True


@app.get("/models", response_model=ModelsResponse)
async def get_available_models(auth: AuthContext = Depends(verify_token)):
    """
    Get list of available models from configuration.

    Returns models grouped by type (chat, embedding, etc.) with their metadata.
    """
    try:
        # Load the morphik.toml file to get registered models
        with open("morphik.toml", "rb") as f:
            config = tomli.load(f)

        registered_models = config.get("registered_models", {})

        # Group models by their purpose
        chat_models = []
        embedding_models = []

        for model_key, model_config in registered_models.items():
            model_info = {
                "id": model_key,
                "model": model_config.get("model_name", model_key),
                "provider": _extract_provider(model_config.get("model_name", "")),
                "config": model_config,
            }

            # Categorize models based on their names or configuration
            if "embedding" in model_key.lower():
                embedding_models.append(model_info)
            else:
                chat_models.ap
```

### Core Architecture Module: `core/app_factory.py`
```
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import arq
from fastapi import FastAPI

HEARTBEAT_URL = "https://logs.morphik.ai/api/heartbeat"
HEARTBEAT_INTERVAL_HOURS = 4.0

logger = logging.getLogger(__name__)

# Global variable for redis_pool, primarily for shutdown if app.state access fails.
_global_redis_pool = None  # type: ignore


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """Application lifespan handler (copied from core/api.py).

    Performs:
    1. Database initialization
    2. Vector store initialization
    3. Redis pool creation
    4. Graceful shutdown of Redis pool
    """
    # ------------------------------------------------------------------
    # Import services directly from services_init instead of through api_module
    # ------------------------------------------------------------------
    from core.services_init import database, settings, v2_chunk_store, vector_store

    # --- BEGIN MOVED STARTUP LOGIC ---
    logger.info("Lifespan: Initializing Database…")
    try:
        success = await database.initialize()
        if success:
            logger.info("Lifespan: Database initialization successful")
        else:
            logger.error("Lifespan: Database initialization failed")
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Lifespan: CRITICAL - Failed to initialize Database: %s",
            exc,
            exc_info=True,
        )
        raise

    logger.info("Lifespan: Initializing Vector Store…")
    try:
        if hasattr(vector_store, "initialize"):
            await vector_store.initialize()
        logger.info("Lifespan: Vector Store initialization successful (or not applicable).")
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Lifespan: CRITICAL - Failed to initialize Vector Store: %s",
            exc,
            exc_info=True,
        )

    logger.info("Lifespan: Initializing V2 Chunk Store…")
    try:
        if hasattr(v2_chunk_store, "initialize"):
            await v2_chunk_store.initialize()
        logger.info("Lifespan: V2 Chunk Store initialization successful (or not applicable).")
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Lifespan: CRITICAL - Failed to initialize V2 Chunk Store: %s",
            exc,
            exc_info=True,
        )

    # Initialize ColPali vector store if it exists
    # Note: max_sim function creation happens in MultiVectorStore.initialize()
    logger.info("Lifespan: Initializing ColPali Vector Store…")
    try:
        from core.services_init import colpali_vector_store

        if colpali_vector_store and hasattr(colpali_vector_store, "initialize"):
            # FastMultiVectorStore has sync initialize, MultiVectorStore has sync initialize
            colpali_vector_store.initialize()  # This is sync method
        logger.info("Lifespan: ColPali Vector Store initialization successful (or not applicable).")
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Lifespan: CRITICAL - Failed to initialize ColPali Vector Store: %s",
            exc,
            exc_info=True,
        )

    logger.info("Lifespan: Attempting to initialize Redis connection pool…")
    global _global_redis_pool  # pylint: disable=global-statement
    try:
        redis_settings_obj = arq.connections.RedisSettings(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
        )
        logger.info(
            "Lifespan: Redis settings for pool: host=%s, port=%s",
            settings.REDIS_HOST,
            settings.REDIS_PORT,
        )
        current_redis_pool = await arq.create_pool(redis_settings_obj)
        if current_redis_pool:
            app_instance.state.redis_pool = current_redis_pool
            _global_redis_pool = current_redis_pool
            logger.info(
                "Lifespan: Successfully initialized Redis connection pool and stored on app.state.",
            )
        else:
            logger.error(
                "Lifespan: arq.create_pool returned None or a falsey value for Redis pool.",
            )
            raise RuntimeError(
                "Lifespan: Failed to create Redis pool - arq.create_pool returned non-truthy value.",
            )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Lifespan: CRITICAL - Failed to initialize Redis connection pool: %s",
            exc,
            exc_info=True,
        )
        raise RuntimeError(
            f"Lifespan: CRITICAL - Failed to initialize Redis connection pool: {exc}",
        ) from exc
    # --- END MOVED STARTUP LOGIC ---

    log_uploader = None
    heartbeat = None
    if settings.TELEMETRY_ENABLED:
        try:
            from core.services.heartbeat import Heartbeat
            from core.services.log_uploader import LogUploader
            from core.services.telemetry import get_installation_id

            installation_id = get_installation_id()
            project_name = settings.PROJECT_NAME or "oss"

            log_uploader = LogUploader(
                log_dir=Path("logs"),
                project_name=project_name,
                installation_id=installation_id,
                interval_hours=settings.TELEMETRY_UPLOAD_INTERVAL_HOURS,
                max_local_bytes=settings.TELEMETRY_MAX_LOCAL_BYTES,
                service_name=settings.SERVICE_NAME,
                environment=settings.ENVIRONMENT,
            )
            log_uploader.start()
            app_instance.state.log_uploader = log_uploader

            heartbeat = Heartbeat(
                heartbeat_url=HEARTBEAT_URL,
                project_name=project_name,
                installation_id=installation_id,
                version=settings.VERSION,
                interval_hours=HEARTBEAT_INTERVAL_HOURS,
            )
            heartbeat.start()
            app_instance.state.heartbeat = heartbeat
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to start telemetry services: %s", exc, exc_info=True)

    logger.info("Lifespan: Core startup logic executed.")
    yield
    # Shutdown logic
    logger.info("Lifespan: Shutdown initiated.")
    pool_to_close = getattr(app_instance.state, "redis_pool", _global_redis_pool)
    if pool_to_close:
        logger.info("Closing Redis connection pool from lifespan…")
        pool_to_close.close()
        # await pool_to_close.wait_closed()  # Uncomment if needed
        logger.info("Redis connection pool closed from lifespan.")
    if log_uploader:
        log_uploader.stop()
    if heartbeat:
        heartbeat.stop()
    logger.info("Lifespan: Shutdown complete.")

```

### Core Architecture Module: `core/auth_utils.py`
```
from datetime import UTC, datetime
from logging import getLogger
from typing import Any, Optional

import jwt
from fastapi import Header, HTTPException, Request

from core.config import get_settings
from core.models.auth import AuthContext

logger = getLogger(__name__)

__all__ = [
    "clear_app_active_cache",
    "ensure_app_is_active",
    "mark_app_active",
    "mark_app_revoked",
    "verify_token",
]

# Load settings once at import time
settings = get_settings()

_ACTIVE_CACHE_PREFIX = "auth:app_active:"
_REVOKED_CACHE_PREFIX = "auth:app_revoked:"


def _active_cache_key(app_id: str) -> str:
    return f"{_ACTIVE_CACHE_PREFIX}{app_id}"


def _revoked_cache_key(app_id: str) -> str:
    return f"{_REVOKED_CACHE_PREFIX}{app_id}"


def _get_redis_pool(request: Request) -> Optional[Any]:
    return getattr(request.app.state, "redis_pool", None)


def _normalize_token_version(token_version: Optional[Any]) -> int:
    if token_version is None:
        return 0
    try:
        return int(token_version)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token version") from exc


async def mark_app_active(app_id: Optional[str], token_version: Optional[Any], redis_pool: Optional[Any]) -> None:
    if not app_id or redis_pool is None:
        return

    try:
        normalized_version = _normalize_token_version(token_version)
        await redis_pool.set(
            _active_cache_key(app_id),
            str(normalized_version),
            ex=settings.APP_AUTH_ACTIVE_TTL_SECONDS,
        )
        await redis_pool.delete(_revoked_cache_key(app_id))
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to mark app %s as active in cache: %s", app_id, exc)


async def mark_app_revoked(app_id: Optional[str], redis_pool: Optional[Any]) -> None:
    if not app_id or redis_pool is None:
        return

    try:
        await redis_pool.set(
            _revoked_cache_key(app_id),
            "1",
            ex=settings.APP_AUTH_REVOKED_TTL_SECONDS,
        )
        await redis_pool.delete(_active_cache_key(app_id))
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to mark app %s as revoked in cache: %s", app_id, exc)


async def clear_app_active_cache(app_id: Optional[str], redis_pool: Optional[Any]) -> None:
    if not app_id or redis_pool is None:
        return

    try:
        await redis_pool.delete(_active_cache_key(app_id))
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to clear app cache for %s: %s", app_id, exc)


async def ensure_app_is_active(
    app_id: Optional[str],
    token_version: Optional[Any] = None,
    redis_pool: Optional[Any] = None,
) -> None:
    """Ensure the app_id still exists; reject tokens for deleted apps."""
    if settings.bypass_auth_mode or not app_id:
        return

    normalized_version = _normalize_token_version(token_version)

    if redis_pool is not None:
        try:
            revoked = await redis_pool.get(_revoked_cache_key(app_id))
            if revoked is not None:
                raise HTTPException(status_code=401, detail="Invalid or revoked token")

            active = await redis_pool.get(_active_cache_key(app_id))
            if active is not None:
                try:
                    active_version = int(active)
                except (TypeError, ValueError):
                    logger.debug("Invalid active token version cache for app %s", app_id)
                else:
                    if active_version == normalized_version:
                        return
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis app cache unavailable; falling back to DB: %s", exc)
            redis_pool = None

    try:
        from core.services_init import database
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load database for app validation: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to validate token") from exc

    try:
        app_record = await database.get_app_record(app_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to validate app_id %s: %s", app_id, exc)
        raise HTTPException(status_code=500, detail="Failed to validate token") from exc

    if app_record is None:
        await mark_app_revoked(app_id, redis_pool)
        raise HTTPException(status_code=401, detail="Invalid or revoked token")

    app_version = app_record.get("token_version", 0) or 0
    if normalized_version != app_version:
        await mark_app_active(app_id, app_version, redis_pool)
        raise HTTPException(status_code=401, detail="Invalid or revoked token")

    await mark_app_active(app_id, app_version, redis_pool)


async def verify_token(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> AuthContext:  # noqa: D401 – FastAPI dependency
    """Return an :class:`AuthContext` for a valid JWT bearer *authorization* header.

    When *bypass_auth_mode* is enabled we skip cryptographic checks and
    fabricate a permissive context so that local development environments
    can quickly spin up without real tokens.
    """

    # ------------------------------------------------------------------
    # 1. Development shortcut – trust everyone when auth-bypass mode is active.
    # ------------------------------------------------------------------
    if settings.bypass_auth_mode:
        return AuthContext(
            user_id=settings.dev_user_id,
            app_id=None,
        )

    # ------------------------------------------------------------------
    # 2. Normal token verification flow
    # ------------------------------------------------------------------
    if not authorization:
        logger.info("Missing authorization header")
        raise HTTPException(
            status_code=401,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization[7:]  # Strip "Bearer " prefix

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    # Check expiry manually – jwt.decode does *not* enforce expiry on psycopg2.
    if datetime.fromtimestamp(payload["exp"], UTC) < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Token expired")

    # Extract user_id - support legacy "entity_id" for backward compatibility
    user_id = payload.get("user_id") or payload.get("entity_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing user_id in token")

    app_id = payload.get("app_id")
    token_version = payload.get("token_version")
    await ensure_app_is_active(app_id, token_version=token_version, redis_pool=_get_redis_pool(request))

    ctx = AuthContext(
        user_id=user_id,
        app_id=app_id,
    )

    return ctx

```

### Core Architecture Module: `core/completion/__init__.py`
```
from core.completion.base_completion import BaseCompletionModel
from core.completion.litellm_completion import LiteLLMCompletionModel

__all__ = ["BaseCompletionModel", "LiteLLMCompletionModel"]

```

### Core Architecture Module: `core/completion/base_completion.py`
```
from abc import ABC, abstractmethod

from core.models.completion import CompletionRequest, CompletionResponse


class BaseCompletionModel(ABC):
    """Base class for completion models"""

    @abstractmethod
    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        """Generate completion from query and context"""
        pass

```

### Core Architecture Module: `core/completion/litellm_completion.py`
```
import logging
import re  # Import re for parsing model name
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple, Union

import litellm

try:
    import ollama
except ImportError:
    ollama = None  # Make ollama import optional

from pydantic import BaseModel

from core.config import get_settings
from core.models.completion import CompletionRequest, CompletionResponse

from .base_completion import BaseCompletionModel

logger = logging.getLogger(__name__)


def get_system_message(inline_citations: bool = False) -> Dict[str, str]:
    """Return the standard system message for Morphik's query agent."""

    if inline_citations:
        content = """You are Morphik's powerful query agent with INLINE CITATION MODE ENABLED.

MANDATORY CITATION RULES:
- Every fact or piece of information from the context MUST include its source citation
- Citations appear as "Source: [filename, page X]" or "Source: [filename]" at the end of each context chunk
- Copy these citations EXACTLY in your response using the format [filename, page X]
- Place citations immediately after the relevant information

Your role is to:
1. Analyze the provided context chunks from documents carefully
2. Use the context to answer questions accurately with proper citations
3. Be clear and concise in your answers
4. ALWAYS include [filename, page X] citations for every piece of information
5. For image-based queries, analyze the visual content with citations
6. Format your responses using Markdown

Example response with citations:
"Morphik is a retrieval-augmented generation tool [README.md, page 1] designed for legal and technical work [overview.pdf, page 3]."

Remember: NO information should be presented without its source citation."""
    else:
        content = """You are Morphik's powerful query agent. Your role is to:

1. Analyze the provided context chunks from documents carefully
2. Use the context to answer questions accurately and comprehensively
3. Be clear and concise in your answers
4. When relevant, cite specific parts of the context to support your answers
5. For image-based queries, analyze the visual content in conjunction with any text context provided
6. Format your responses using Markdown.

Remember: Your primary goal is to provide accurate, context-aware responses that help users understand
and utilize the information in their documents effectively."""

    return {
        "role": "system",
        "content": content,
    }


def build_system_message(system_prompt: Optional[str], inline_citations: bool = False) -> Dict[str, str]:
    """
    Return a system message dictionary using a custom prompt when provided.

    Args:
        system_prompt: Custom system prompt content, if any
        inline_citations: Whether inline citation mode is enabled (used for default prompt)
    """
    if system_prompt:
        return {"role": "system", "content": system_prompt}
    return get_system_message(inline_citations)


def process_context_chunks(context_chunks: List[str], is_ollama: bool) -> Tuple[List[str], List[str], List[str]]:
    """
    Process context chunks and separate text from images.

    Args:
        context_chunks: List of context chunks which may include images
        is_ollama: Whether we're using Ollama (affects image processing)

    Returns:
        Tuple of (context_text, image_urls, ollama_image_data)
    """
    context_text = []
    image_urls = []  # For non-Ollama models (full data URI)
    ollama_image_data = []  # For Ollama models (raw base64)

    for chunk in context_chunks:
        if chunk.startswith("data:image/"):
            if is_ollama:
                # For Ollama, strip the data URI prefix and just keep the base64 data
                try:
                    base64_data = chunk.split(",", 1)[1]
                    ollama_image_data.append(base64_data)
                except IndexError:
                    logger.warning(f"Could not parse base64 data from image chunk: {chunk[:50]}...")
            else:
                image_urls.append(chunk)
        else:
            context_text.append(chunk)

    return context_text, image_urls, ollama_image_data


def format_user_content(
    context_text: List[str],
    query: str,
    prompt_template: Optional[str] = None,
    inline_citations: bool = False,
    chunk_metadata: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Format the user content based on context and query.

    Args:
        context_text: List of context text chunks
        query: The user query
        prompt_template: Optional template to format the content
        inline_citations: Whether to include inline citations
        chunk_metadata: Metadata for each chunk including filename and page

    Returns:
        Formatted user content string
    """
    if inline_citations and chunk_metadata:
        # Format each chunk with its citation
        formatted_chunks = []
        for i, (chunk, metadata) in enumerate(zip(context_text, chunk_metadata)):
            filename = metadata.get("filename", "unknown")
            page = metadata.get("page_number")
            is_colpali = metadata.get("is_colpali", False)

            # Build the citation based on available information
            if is_colpali and page:
                # For ColPali chunks, always show page number since each chunk is a page
                citation = f"[{filename}, page {page}]"
            elif page:
                # For regular text chunks with page metadata
                citation = f"[{filename}, page {page}]"
            else:
                # For text chunks without page info, just show filename
                citation = f"[{filename}]"

            # Log first few citations for debugging
            if i < 3:
                logger.debug(f"Citation {i}: {citation} for chunk starting with: {chunk[:50]}...")

            # Make citations more prominent by putting them on a new line
            formatted_chunks.append(f"{chunk}\nSource: {citation}")
        context = "\n" + "\n\n".join(formatted_chunks) + "\n\n"
    else:
        context = "\n" + "\n\n".join(context_text) + "\n\n" if context_text else ""

    if prompt_template:
        return prompt_template.format(
            context=context,
            question=query,
            query=query,
        )
    elif context_text:
        return f"Context: {context} Question: {query}"
    else:
        return query


def create_dynamic_model_from_schema(schema: Union[type, Dict]) -> Optional[type]:
    """
    Create a dynamic Pydantic model from a schema definition.

    Args:
        schema: Either a Pydantic BaseModel class or a JSON schema dict

    Returns:
        A Pydantic model class or None if schema format is not recognized
    """
    from pydantic import create_model

    if isinstance(schema, type) and issubclass(schema, BaseModel):
        return schema
    elif isinstance(schema, dict) and "properties" in schema:
        # Create a dynamic model from JSON schema
        field_definitions = {}
        schema_dict = schema

        for field_name, field_info in schema_dict.get("properties", {}).items():
            if isinstance(field_info, dict) and "type" in field_info:
                field_type = field_info.get("type")
                # Convert schema types to Python types
                if field_type == "string":
                    field_definitions[field_name] = (str, None)
                elif field_type == "number":
                    field_definitions[field_name] = (float, None)
                elif field_type == "integer":
                    field_definitions[field_name] = (int, None)
                elif field_type == "boolean":
                    field_definitions[field_name] = (bool, None)
                elif field_type == "array":
                    field_definitions[field_name] = (list, None)
                elif field_type == "object":
                    field_definitions[field_name] = (dict, None)
                else:
                    # Default to Any for unknown types
                    field_definitions[field_name] = (Any, None)

        # Create the dynamic model
        return create_model("DynamicQueryModel", **field_definitions)
    else:
        logger.warning(f"Unrecognized schema format: {schema}")
        return None


class LiteLLMCompletionModel(BaseCompletionModel):
    """
    LiteLLM completion model implementation that provides unified access to various LLM providers.
    Uses registered models from the config file. Can optionally use direct Ollama client.
    """

    def __init__(self, model_key: str):
        """
        Initialize LiteLLM completion model with a model key from registered_models.

        Args:
            model_key: The key of the model in the registered_models config
        """
        settings = get_settings()
        self.model_key = model_key

        # Get the model configuration from registered_models
        if not hasattr(settings, "REGISTERED_MODELS") or model_key not in settings.REGISTERED_MODELS:
            raise ValueError(f"Model '{model_key}' not found in registered_models configuration")

        self.model_config = settings.REGISTERED_MODELS[model_key]

        # Check if it's an Ollama model for potential direct usage
        self.is_ollama = "ollama" in self.model_config.get("model_name", "").lower()
        self.ollama_api_base = None
        self.ollama_base_model_name = None

        if self.is_ollama:
            if ollama is None:
                logger.warning("Ollama model selected, but 'ollama' library not installed. Falling back to LiteLLM.")
                self.is_ollama = False  # Fallback to LiteLLM if library missing
            else:
                self.ollama_api_base = self.model_config.get("api_base")
                if not self.ollama_api_base:
                    logger.warning(
                        f"Ollama model {self.model_key} selected for direct use, "
                        "but 'api_base' is missing
```

### Core Architecture Module: `core/config.py`
```
import os
from functools import lru_cache
from typing import Any, Dict, List, Literal, Optional

import tomli
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from utils.env_loader import load_local_env

# Default to loading from .env unless a secret manager (e.g., Infisical) is
# injecting variables.
load_local_env(override=True)


class ParserXMLSettings(BaseModel):
    max_tokens: int = 350
    preferred_unit_tags: List[str] = ["SECTION", "Section", "Article", "clause"]
    ignore_tags: List[str] = ["TOC", "INDEX"]


class Settings(BaseSettings):
    """Morphik configuration settings."""

    # Environment variables
    JWT_SECRET_KEY: str
    SESSION_SECRET_KEY: str
    POSTGRES_URI: Optional[str] = None
    AWS_ACCESS_KEY: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    ASSEMBLYAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    TURBOPUFFER_API_KEY: Optional[str] = None
    GEMINI_API_BASE_URL: str = "https://generativelanguage.googleapis.com"
    GEMINI_METADATA_MODEL: str = "gemini-2.5-flash"

    # API configuration
    HOST: str
    PORT: int
    RELOAD: bool
    SENTRY_DSN: Optional[str] = None
    PROJECT_NAME: Optional[str] = None
    # Morphik Embedding API server configuration
    MORPHIK_EMBEDDING_API_KEY: Optional[str] = None
    MORPHIK_EMBEDDING_API_DOMAIN: list[str]  # List of ColPali API endpoints

    # Auth configuration
    JWT_ALGORITHM: str
    bypass_auth_mode: bool = False
    dev_user_id: str = "dev_user"
    ADMIN_SERVICE_SECRET: Optional[str] = None
    APP_AUTH_ACTIVE_TTL_SECONDS: int = 600
    APP_AUTH_REVOKED_TTL_SECONDS: int = 86400

    # Registered models configuration
    REGISTERED_MODELS: Dict[str, Dict[str, Any]] = {}

    # Completion configuration
    COMPLETION_PROVIDER: Literal["litellm"] = "litellm"
    COMPLETION_MODEL: str

    # Document analysis configuration
    DOCUMENT_ANALYSIS_MODEL: str

    # Database configuration
    DATABASE_PROVIDER: Literal["postgres"]
    DATABASE_NAME: Optional[str] = None
    # Database connection pool settings
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_TIMEOUT: int = 10
    DB_POOL_PRE_PING: bool = True
    DB_MAX_RETRIES: int = 3
    DB_RETRY_DELAY: float = 1.0

    # Embedding configuration
    EMBEDDING_PROVIDER: Literal["litellm"] = "litellm"
    EMBEDDING_MODEL: str
    VECTOR_DIMENSIONS: int
    EMBEDDING_SIMILARITY_METRIC: Literal["cosine", "dotProduct"]

    # Parser configuration
    CHUNK_SIZE: int
    CHUNK_OVERLAP: int
    USE_CONTEXTUAL_CHUNKING: bool = False
    PARSER_XML: ParserXMLSettings = ParserXMLSettings()

    # Reranker configuration
    USE_RERANKING: bool
    RERANKER_PROVIDER: Optional[Literal["flag"]] = None
    RERANKER_MODEL: Optional[str] = None
    RERANKER_QUERY_MAX_LENGTH: Optional[int] = None
    RERANKER_PASSAGE_MAX_LENGTH: Optional[int] = None
    RERANKER_USE_FP16: Optional[bool] = None
    RERANKER_DEVICE: Optional[str] = None

    # Storage configuration
    STORAGE_PROVIDER: Literal["local", "aws-s3"]
    STORAGE_PATH: Optional[str] = None
    AWS_REGION: Optional[str] = None
    S3_BUCKET: Optional[str] = None
    S3_UPLOAD_CONCURRENCY: int = 16
    CACHE_ENABLED: bool = False
    CACHE_MAX_BYTES: int = 10 * 1024 * 1024 * 1024
    CACHE_CHUNK_MAX_BYTES: int = 10 * 1024 * 1024 * 1024
    CACHE_PATH: str = "./storage/cache"

    # Vector store configuration
    VECTOR_STORE_PROVIDER: Literal["pgvector"]
    VECTOR_STORE_DATABASE_NAME: Optional[str] = None
    VECTOR_IVFFLAT_PROBES: int = 100

    # Multivector store configuration
    MULTIVECTOR_STORE_PROVIDER: Literal["postgres", "morphik"] = "postgres"
    # Enable dual ingestion to both fast and slow multivector stores during migration
    ENABLE_DUAL_MULTIVECTOR_INGESTION: bool = False

    # Colpali configuration
    ENABLE_COLPALI: bool
    # Colpali embedding mode: off, local, or api
    COLPALI_MODE: Literal["off", "local", "api"] = "local"

    # Parser configuration
    PARSER_MODE: Literal["local", "api"] = "local"

    # Mode configuration
    MODE: Literal["cloud", "self_hosted"] = "cloud"
    SECRET_MANAGER: Literal["env", "infisical"] = "env"

    # API configuration
    API_DOMAIN: str = "api.morphik.ai"

    # PDF Viewer configuration
    PDF_VIEWER_FRONTEND_URL: Optional[str] = "https://morphik.ai/api/pdf"

    # Service configuration
    ENVIRONMENT: str = "development"
    VERSION: str = "unknown"
    ENABLE_PROFILING: bool = False

    # Redis configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # Worker configuration
    ARQ_MAX_JOBS: int = 1
    COLPALI_STORE_BATCH_SIZE: int = 16

    # PDF processing configuration
    COLPALI_PDF_DPI: int = 150

    # Telemetry configuration
    TELEMETRY_ENABLED: bool = True
    SERVICE_NAME: str = "databridge-core"
    PROJECT_NAME: Optional[str] = None
    TELEMETRY_UPLOAD_INTERVAL_HOURS: float = 4.0
    TELEMETRY_MAX_LOCAL_BYTES: int = 1073741824

    # LiteLLM configuration
    LITELLM_DUMMY_API_KEY: str = "ollama"

    # Local URI password for authentication
    LOCAL_URI_PASSWORD: Optional[str] = None

    @property
    def dev_mode(self) -> bool:  # pragma: no cover - compatibility shim
        """Backward-compatible alias for bypass_auth_mode."""
        return self.bypass_auth_mode


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    load_local_env(override=True)

    # Load config.toml
    with open("morphik.toml", "rb") as f:
        config = tomli.load(f)

    em = "'{missing_value}' needed if '{field}' is set to '{value}'"
    settings_dict = {}

    # Load API config
    settings_dict.update(
        {
            "HOST": config["api"]["host"],
            "PORT": int(config["api"]["port"]),
            "RELOAD": bool(config["api"]["reload"]),
            "SENTRY_DSN": os.getenv("SENTRY_DSN", None),
        }
    )

    # Load service config
    if "service" in config:
        service_cfg = config["service"]
        settings_dict.update(
            {
                "ENVIRONMENT": service_cfg.get("environment", "development"),
                "VERSION": service_cfg.get("version", "unknown"),
                "ENABLE_PROFILING": service_cfg.get("enable_profiling", False),
            }
        )

    # Load auth config
    settings_dict.update(
        {
            "JWT_ALGORITHM": config["auth"]["jwt_algorithm"],
            "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY", "dev-secret-key"),  # Default for bypass mode
            "SESSION_SECRET_KEY": os.environ.get("SESSION_SECRET_KEY", "super-secret-dev-session-key"),
            "bypass_auth_mode": config["auth"].get("bypass_auth_mode", config["auth"].get("dev_mode", False)),
            "dev_user_id": config["auth"].get("dev_user_id", config["auth"].get("dev_entity_id", "dev_user")),
        }
    )

    # Only require JWT_SECRET_KEY in non-dev mode
    if not settings_dict["bypass_auth_mode"] and "JWT_SECRET_KEY" not in os.environ:
        raise ValueError("JWT_SECRET_KEY is required when bypass_auth_mode is disabled")

    # Load registered models if available
    if "registered_models" in config:
        settings_dict["REGISTERED_MODELS"] = config["registered_models"]

    # Load completion config
    settings_dict["COMPLETION_PROVIDER"] = "litellm"
    if "model" not in config["completion"]:
        raise ValueError("'model' is required in the completion configuration")
    settings_dict["COMPLETION_MODEL"] = config["completion"]["model"]

    # Load database config
    settings_dict.update(
        {
            "DATABASE_PROVIDER": config["database"]["provider"],
            "DATABASE_NAME": config["database"].get("name", None),
            "DB_POOL_SIZE": config["database"].get("pool_size", 20),
            "DB_MAX_OVERFLOW": config["database"].get("max_overflow", 30),
            "DB_POOL_RECYCLE": config["database"].get("pool_recycle", 3600),
            "DB_POOL_TIMEOUT": config["database"].get("pool_timeout", 10),
            "DB_POOL_PRE_PING": config["database"].get("pool_pre_ping", True),
            "DB_MAX_RETRIES": config["database"].get("max_retries", 3),
            "DB_RETRY_DELAY": config["database"].get("retry_delay", 1.0),
        }
    )

    if settings_dict["DATABASE_PROVIDER"] != "postgres":
        raise ValueError(f"Unknown database provider selected: '{settings_dict['DATABASE_PROVIDER']}'")

    if "POSTGRES_URI" in os.environ:
        settings_dict["POSTGRES_URI"] = os.environ["POSTGRES_URI"]
    else:
        raise ValueError(em.format(missing_value="POSTGRES_URI", field="database.provider", value="postgres"))

    # Load embedding config
    settings_dict.update(
        {
            "EMBEDDING_PROVIDER": "litellm",
            "VECTOR_DIMENSIONS": config["embedding"]["dimensions"],
            "EMBEDDING_SIMILARITY_METRIC": config["embedding"]["similarity_metric"],
        }
    )

    if "model" not in config["embedding"]:
        raise ValueError("'model' is required in the embedding configuration")
    settings_dict["EMBEDDING_MODEL"] = config["embedding"]["model"]

    # Load parser config
    settings_dict.update(
        {
            "CHUNK_SIZE": config["parser"]["chunk_size"],
            "CHUNK_OVERLAP": config["parser"]["chunk_overlap"],
            "USE_CONTEXTUAL_CHUNKING": config["parser"].get("use_contextual_chunking", False),
        }
    )

    # Load parser XML config
    if "xml" in config["parser"]:
        xml_config = config["parser"]["xml"]
        settings_dict["PARSER_XML"] = ParserXMLSettings(
            max_tokens=xml_config.get("max_tokens", 350),
            preferred_unit_tags=xml_config.get("preferred_unit_tags", ["SECTION", "Section", "Article", "clause"]),
            ignore_tags=xml_config.get("ignore_tags", ["TOC", 
```

### Core Architecture Module: `core/database/metadata_filters.py`
```
"""
Metadata filter SQL generation with typed comparison support.

Translates JSON-style filter expressions into PostgreSQL WHERE clauses with
special handling for typed metadata (number, decimal, datetime, date).

**Implicit equality** (backwards compatible, JSONB containment):
    {"field": value}

**Explicit operators** (typed comparisons with safe casting):
    {"field": {"$eq": value}}

Supported operators: $and, $or, $nor, $not, $eq, $ne, $gt, $gte, $lt, $lte,
$in, $nin, $exists, $type, $regex, $contains.
"""

import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from core.utils.typed_metadata import TypedMetadataError, canonicalize_type_name


class InvalidMetadataFilterError(ValueError):
    """Raised when metadata filters are malformed or unsupported."""


class MetadataFilterBuilder:
    """Translate JSON-style metadata filters into SQL, covering arrays, regex, and substring operators."""

    def __init__(
        self,
        *,
        metadata_column: str = "doc_metadata",
        metadata_types_column: Optional[str] = "metadata_types",
        column_fields: Optional[Dict[str, str]] = None,
    ) -> None:
        self.metadata_column = metadata_column
        self.metadata_types_column = metadata_types_column
        self._column_fields = column_fields or {"filename": "filename"}

    def build(self, filters: Optional[Dict[str, Any]]) -> str:
        """Construct a SQL WHERE clause from a metadata filter dictionary."""
        if filters is None:
            return ""

        if not isinstance(filters, dict):
            raise InvalidMetadataFilterError("Metadata filters must be provided as a JSON object.")

        if not filters:
            return ""

        clause = self._parse_metadata_filter(filters, context="metadata filter")
        if not clause:
            raise InvalidMetadataFilterError("Metadata filter produced no valid conditions.")
        return clause

    def _parse_metadata_filter(self, expression: Any, context: str) -> str:
        """Recursively parse a document-operator metadata filter into SQL."""
        if isinstance(expression, dict):
            if not expression:
                raise InvalidMetadataFilterError(f"{context.capitalize()} cannot be empty.")

            clauses: List[str] = []
            for key, value in expression.items():
                if key == "$and":
                    if not isinstance(value, list):
                        raise InvalidMetadataFilterError("$and operator expects a non-empty list of conditions.")
                    clauses.append(
                        self._combine_clauses(
                            [self._parse_metadata_filter(item, context="$and condition") for item in value],
                            "AND",
                            'operator "$and"',
                        )
                    )
                elif key == "$or":
                    if not isinstance(value, list):
                        raise InvalidMetadataFilterError("$or operator expects a non-empty list of conditions.")
                    clauses.append(
                        self._combine_clauses(
                            [self._parse_metadata_filter(item, context="$or condition") for item in value],
                            "OR",
                            'operator "$or"',
                        )
                    )
                elif key == "$nor":
                    if not isinstance(value, list):
                        raise InvalidMetadataFilterError("$nor operator expects a non-empty list of conditions.")
                    inner = self._combine_clauses(
                        [self._parse_metadata_filter(item, context="$nor condition") for item in value],
                        "OR",
                        'operator "$nor"',
                    )
                    clauses.append(f"(NOT {inner})")
                elif key == "$not":
                    sub_context = 'operator "$not"'
                    clauses.append(f"(NOT {self._parse_metadata_filter(value, context=sub_context)})")
                else:
                    clauses.append(self._build_field_metadata_clause(key, value))

            return self._combine_clauses(clauses, "AND", context)

        if isinstance(expression, list):
            if not expression:
                raise InvalidMetadataFilterError(f"{context.capitalize()} cannot be an empty list.")
            subclauses = [self._parse_metadata_filter(item, context="nested condition") for item in expression]
            return self._combine_clauses(subclauses, "OR", context)

        raise InvalidMetadataFilterError(f"{context.capitalize()} must be expressed as a JSON object.")

    def _combine_clauses(self, clauses: List[str], operator: str, context: str) -> str:
        """Combine multiple SQL clauses with a logical operator."""
        cleaned = [clause for clause in clauses if clause]
        if not cleaned:
            raise InvalidMetadataFilterError(f"No valid conditions supplied for {context}.")
        if len(cleaned) == 1:
            return cleaned[0]
        return "(" + f" {operator} ".join(cleaned) + ")"

    def _build_field_metadata_clause(self, field: str, value: Any) -> str:
        """Build SQL clause for a single metadata field."""
        if field in self._column_fields:
            return self._build_column_field_clause(field, value)

        if isinstance(value, dict) and not any(key.startswith("$") for key in value):
            # Treat as literal JSON sub-document match
            return self._jsonb_contains_clause(field, value)

        if isinstance(value, dict):
            return self._build_operator_clause(field, value)

        if isinstance(value, list):
            return self._build_list_clause(field, value)

        return self._build_single_value_clause(field, value)

    def _build_operator_clause(self, field: str, operators: Dict[str, Any]) -> str:
        """Build SQL clause for operator-based metadata filters."""
        if not isinstance(operators, dict) or not operators:
            raise InvalidMetadataFilterError(f"Operator block for field '{field}' must be a non-empty object.")

        clauses: List[str] = []
        for operator, operand in operators.items():
            if operator in {"$eq", "$ne", "$gt", "$gte", "$lt", "$lte"}:
                # All comparison operators support typed metadata (number, decimal, date, datetime)
                comparison_clause = self._build_comparison_clause(field, operator, operand)
                if operator == "$ne":
                    clauses.append(f"(NOT {comparison_clause})")
                else:
                    clauses.append(comparison_clause)
            elif operator == "$in":
                if not isinstance(operand, list):
                    raise InvalidMetadataFilterError(f"$in operator for field '{field}' expects a list of values.")
                clauses.append(self._build_list_clause(field, operand))
            elif operator == "$nin":
                if not isinstance(operand, list):
                    raise InvalidMetadataFilterError(f"$nin operator for field '{field}' expects a list of values.")
                clauses.append(f"(NOT {self._build_list_clause(field, operand)})")
            elif operator == "$exists":
                clauses.append(self._build_exists_clause(field, operand))
            elif operator == "$not":
                clauses.append(f"(NOT {self._build_field_metadata_clause(field, operand)})")
            elif operator == "$type":
                clauses.append(self._build_type_clause(field, operand))
            elif operator == "$regex":
                clauses.append(self._build_regex_clause(field, operand))
            elif operator == "$contains":
                clauses.append(self._build_contains_clause(field, operand))
            else:
                raise InvalidMetadataFilterError(
                    f"Unsupported metadata filter operator '{operator}' for field '{field}'."
                )

        return self._combine_clauses(clauses, "AND", f"field '{field}' operator block")

    def _build_list_clause(self, field: str, values: List[Any]) -> str:
        """Build clause matching any of the provided values."""
        if not isinstance(values, list) or not values:
            raise InvalidMetadataFilterError(f"Filter list for field '{field}' must contain at least one value.")

        clauses = []
        for item in values:
            if isinstance(item, dict) and any(key.startswith("$") for key in item):
                clauses.append(self._build_operator_clause(field, item))
            else:
                clauses.append(self._build_single_value_clause(field, item))

        return self._combine_clauses(clauses, "OR", f"list of values for field '{field}'")

    def _build_single_value_clause(self, field: str, value: Any) -> str:
        """Build clause matching a single value."""
        if isinstance(value, dict):
            if any(key.startswith("$") for key in value):
                return self._build_operator_clause(field, value)
            return self._jsonb_contains_clause(field, value)

        return self._jsonb_contains_clause(field, value)

    def _build_column_field_clause(self, field: str, value: Any) -> str:
        """Build SQL clause for a reserved column field (e.g., filename)."""
        column = self._column_fields[field]
        builder = TextColumnFilterBuilder(column)

        if isinstance(value, dict):
            if not value:
                raise InvalidMetadataFilterError(f"{field} filter cannot be empty.")
            if any(key.startswith("$") for key in value):
                return builder.build(value)
            raise InvalidMetadataFilterError(
                f"{field} filter must use operators (e.g., {{'{field}': {{'$eq': 'example.pdf'}}}})."
            )

        if isinstance(value, list):
   
```

### Core Architecture Module: `core/database/models.py`
```
import logging

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base

logger = logging.getLogger(__name__)

Base = declarative_base()


class DocumentModel(Base):
    """SQLAlchemy model for document metadata."""

    __tablename__ = "documents"

    external_id = Column(String, primary_key=True)
    content_type = Column(String)
    filename = Column(String, nullable=True)
    doc_metadata = Column(JSONB, default=dict)
    metadata_types = Column(JSONB, default=dict)
    storage_info = Column(JSONB, default=dict)
    system_metadata = Column(JSONB, default=dict)
    additional_metadata = Column(JSONB, default=dict)
    chunk_ids = Column(JSONB, default=list)

    # Flattened auth columns for performance
    owner_id = Column(String)
    app_id = Column(String)
    folder_name = Column(String)
    folder_path = Column(String)
    folder_id = Column(String)
    end_user_id = Column(String)

    __table_args__ = (
        Index("idx_system_metadata", "system_metadata", postgresql_using="gin"),
        Index("idx_doc_metadata_gin", "doc_metadata", postgresql_using="gin"),
        # Primary access control indexes (used in every query)
        Index("idx_doc_app_id", "app_id"),
        Index("idx_doc_owner_id", "owner_id"),
        # Composite indexes for scoped queries (app_id/owner_id first, then filter field)
        Index("idx_documents_owner_app", "owner_id", "app_id"),
        Index("idx_documents_app_folder", "app_id", "folder_name"),
        Index("idx_documents_app_folder_path", "app_id", "folder_path"),
        Index("idx_documents_app_folder_id", "app_id", "folder_id"),
        Index("idx_documents_app_end_user", "app_id", "end_user_id"),
    )


class DocumentStorageUsageModel(Base):
    """Per-document storage accounting for app-level aggregation."""

    __tablename__ = "document_storage_usage"

    document_id = Column(String, primary_key=True)
    app_id = Column(String, nullable=False)
    raw_bytes = Column(BigInteger, default=0)
    chunk_bytes = Column(BigInteger, default=0)
    multivector_bytes = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP")
    )

    __table_args__ = (Index("idx_doc_storage_app_id", "app_id"),)


class AppStorageUsageModel(Base):
    """Aggregated storage accounting by app."""

    __tablename__ = "app_storage_usage"

    app_id = Column(String, primary_key=True)
    raw_bytes = Column(BigInteger, default=0)
    chunk_bytes = Column(BigInteger, default=0)
    multivector_bytes = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP")
    )


class FolderModel(Base):
    """SQLAlchemy model for folder data."""

    __tablename__ = "folders"

    id = Column(String, primary_key=True)
    name = Column(String)
    full_path = Column(String)
    parent_id = Column(String)
    depth = Column(Integer)
    description = Column(String, nullable=True)
    document_ids = Column(JSONB, default=list)
    system_metadata = Column(JSONB, default=dict)

    # Flattened auth columns for performance
    owner_id = Column(String)
    app_id = Column(String)
    end_user_id = Column(String)

    __table_args__ = (
        # Tree navigation index (finding children of a parent)
        Index("idx_folder_parent_id", "parent_id"),
        # Primary access control indexes
        Index("idx_folder_app_id", "app_id"),
        Index("idx_folder_owner_id", "owner_id"),
        # Composite indexes for scoped queries
        Index("idx_folders_owner_app", "owner_id", "app_id"),
        Index("idx_folders_app_end_user", "app_id", "end_user_id"),
        # Scoped uniqueness for full_path (also serves as index for path lookups)
        Index(
            "uq_folders_app_full_path",
            "app_id",
            "full_path",
            unique=True,
            postgresql_where=text("app_id IS NOT NULL"),
        ),
        Index(
            "uq_folders_owner_full_path",
            "owner_id",
            "full_path",
            unique=True,
            postgresql_where=text("app_id IS NULL"),
        ),
    )


class ChatConversationModel(Base):
    """SQLAlchemy model for persisted chat history."""

    __tablename__ = "chat_conversations"

    conversation_id = Column(String, primary_key=True)
    user_id = Column(String, index=True, nullable=True)
    app_id = Column(String, index=True, nullable=True)
    title = Column(String, nullable=True)
    history = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP")
    )

    __table_args__ = ()


class ModelConfigModel(Base):
    """SQLAlchemy model for user model configurations."""

    __tablename__ = "model_configs"

    id = Column(String, primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    app_id = Column(String, index=True, nullable=False)
    provider = Column(String, nullable=False)
    config_data = Column(JSONB, default=dict)
    created_at = Column(String)
    updated_at = Column(String)

    __table_args__ = (
        Index("idx_model_config_user_app", "user_id", "app_id"),
        Index("idx_model_config_provider", "provider"),
    )

```

### Core Architecture Module: `core/database/postgres_database.py`
```
import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from core.config import get_settings
from core.utils.folder_utils import normalize_folder_path
from core.utils.storage_usage import normalize_app_id
from core.utils.typed_metadata import MetadataBundle, TypedMetadataError, normalize_metadata

from ..models.auth import AuthContext
from ..models.documents import Document
from ..models.folders import Folder
from ..models.model_config import ModelConfig
from .metadata_filters import InvalidMetadataFilterError, MetadataFilterBuilder
from .models import Base, ChatConversationModel, DocumentModel, FolderModel, ModelConfigModel
from .serializers import _document_model_to_dict, _folder_row_to_dict, _serialize_datetime

logger = logging.getLogger(__name__)
SYSTEM_METADATA_SCOPE_KEYS = {"folder_name", "folder_id", "end_user_id", "app_id"}
SUMMARY_METADATA_KEYS = {
    "summary_storage_key",
    "summary_version",
    "summary_bucket",
    "summary_updated_at",
}

# Maps a public Document field name to the underlying table column. Used to SELECT
# only the columns a projection needs, so listing metadata never reads the heavy
# `system_metadata.content` (the full document text).
DOCUMENT_PROJECTION_COLUMN_MAP = {
    "external_id": DocumentModel.external_id,
    "content_type": DocumentModel.content_type,
    "filename": DocumentModel.filename,
    "metadata": DocumentModel.doc_metadata,
    "metadata_types": DocumentModel.metadata_types,
    "storage_info": DocumentModel.storage_info,
    "system_metadata": DocumentModel.system_metadata,
    "additional_metadata": DocumentModel.additional_metadata,
    "chunk_ids": DocumentModel.chunk_ids,
    "folder_name": DocumentModel.folder_name,
    "folder_path": DocumentModel.folder_path,
    "folder_id": DocumentModel.folder_id,
    "app_id": DocumentModel.app_id,
    "end_user_id": DocumentModel.end_user_id,
}
DOCUMENT_PROJECTION_ORDER = [
    "external_id",
    "content_type",
    "filename",
    "metadata",
    "metadata_types",
    "storage_info",
    "system_metadata",
    "additional_metadata",
    "chunk_ids",
    "folder_name",
    "folder_path",
    "folder_id",
    "app_id",
    "end_user_id",
]
# Lightweight scalar keys inside system_metadata that can be projected cheaply via a
# JSON-path read (system_metadata->>'<key>'), without materializing the full
# system_metadata blob (which holds the document text). Returned in a slim
# system_metadata dict so the SDK can read e.g. doc status locally with no extra call.
DOCUMENT_STATUS_PROJECTION_KEYS = {"status", "error", "created_at", "updated_at", "progress", "version"}


class PostgresDatabase:
    """PostgreSQL implementation for document metadata storage."""

    _metadata_filter_builder = MetadataFilterBuilder()
    # Map system filter keys to flattened column names (used by filter builder methods)
    _SYSTEM_FILTER_COLUMNS = {
        "app_id": "app_id",
        "folder_name": "folder_name",
        "folder_path": "folder_path",
        "end_user_id": "end_user_id",
    }

    @staticmethod
    def _extract_summary_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Pull summary-related fields out of a payload into system_metadata."""
        summary_meta: Dict[str, Any] = {}
        for key in SUMMARY_METADATA_KEYS:
            if key in payload:
                summary_meta[key] = payload.pop(key)
        return summary_meta

    async def delete_folder(self, folder_id: str, auth: AuthContext) -> bool:
        """Delete a folder row if user has admin access."""
        try:
            # Fetch the folder to check permissions
            async with self.async_session() as session:
                folder_model = await session.get(FolderModel, folder_id)
                if not folder_model:
                    logger.error(f"Folder {folder_id} not found")
                    return False
                if not self._check_folder_model_access(folder_model, auth):
                    logger.error(f"User does not have admin access to folder {folder_id}")
                    return False
                await session.delete(folder_model)
                await session.commit()
                logger.info(f"Deleted folder {folder_id}")
                return True
        except Exception as e:
            logger.error(f"Error deleting folder: {e}")
            return False

    def __init__(
        self,
        uri: str,
    ):
        """Initialize PostgreSQL connection for document storage."""
        # Load settings from config
        settings = get_settings()

        # Get database pool settings from config with defaults
        pool_size = getattr(settings, "DB_POOL_SIZE", 20)
        max_overflow = getattr(settings, "DB_MAX_OVERFLOW", 30)
        pool_recycle = getattr(settings, "DB_POOL_RECYCLE", 3600)
        pool_timeout = getattr(settings, "DB_POOL_TIMEOUT", 10)
        pool_pre_ping = getattr(settings, "DB_POOL_PRE_PING", True)

        logger.info(
            f"Initializing PostgreSQL connection pool with size={pool_size}, "
            f"max_overflow={max_overflow}, pool_recycle={pool_recycle}s"
        )

        # Strip parameters that asyncpg doesn't accept as keyword arguments
        # These will raise "unexpected keyword argument" errors
        from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

        parsed = urlparse(uri)
        query_params = parse_qs(parsed.query)

        # List of parameters that asyncpg doesn't accept
        incompatible_params = ["sslmode", "channel_binding"]
        removed_params = []

        for param in incompatible_params:
            if param in query_params:
                query_params.pop(param, None)
                removed_params.append(param)

        if removed_params:
            logger.debug(f"Removing parameters from PostgreSQL URI (not compatible with asyncpg): {removed_params}")
            parsed = parsed._replace(query=urlencode(query_params, doseq=True))
            uri = urlunparse(parsed)

        # Create async engine with explicit pool settings
        self.engine = create_async_engine(
            uri,
            # Prevent connection timeouts by keeping connections alive
            pool_pre_ping=pool_pre_ping,
            # Increase pool size to handle concurrent operations
            pool_size=pool_size,
            # Maximum overflow connections allowed beyond pool_size
            max_overflow=max_overflow,
            # Keep connections in the pool for up to 60 minutes
            pool_recycle=pool_recycle,
            # Time to wait for a connection from the pool (10 seconds)
            pool_timeout=pool_timeout,
            # Echo SQL for debugging (set to False in production)
            echo=False,
            connect_args={"server_settings": {"statement_timeout": "30000"}},  # 30 second timeout
        )
        self.async_session = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        # Ingestion holds a lock across parsing and embedding. Keep those connections
        # out of the query pool so busy workers cannot exhaust it and deadlock writes.
        self._ingestion_lock_engine = create_async_engine(uri, poolclass=NullPool)
        self._initialized = False

    @asynccontextmanager
    async def document_ingestion_lock(self, document_id: str, *, wait: bool = False):
        """Serialize content replacement and all worker writes for one document.

        Transaction-scoped advisory locks are released on cancellation/disconnect,
        with no expiring lease that could admit another writer during a long ingest.
        Callers must read the document/revision *after* acquiring the lock.
        """
        async with self._ingestion_lock_engine.begin() as connection:
            key = {"key": f"document-ingestion:{document_id}"}
            if wait:
                await connection.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), key)
                acquired = True
            else:
                acquired = await connection.scalar(
                    text("SELECT pg_try_advisory_xact_lock(hashtextextended(:key, 0))"), key
                )
            yield acquired

    async def initialize(self):
        """Initialize database tables and indexes."""
        if self._initialized:
            return True

        try:
            logger.info("Initializing PostgreSQL database tables and indexes...")

            # Ensure all declarative models (including ones defined outside this module)
            # are registered with SQLAlchemy's metadata before create_all runs.
            # Import is local to avoid circular import overhead at module load.
            from core.models.apps import AppModel  # noqa: F401
            from core.vector_store.pgvector_store import VectorEmbedding  # noqa: F401

            # Create all tables and indexes via SQLAlchemy metadata
            async with self.engine.begin() as conn:
                # Enable pgvector extension (required for Vector column type)
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                logger.info("Enabled pgvector extension")

                await conn.run_sync(lambda conn: Base.metadata.create_all(conn, checkfirst=True))
                logger.info("Created database tables and indexes successfully")

                # Ensure apps.token_version exists for legacy databases.
                await conn.execute(
                    text("ALTER TABLE apps " "ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0")
                )
                await conn.execute(
                    text(
                       
```

### Core Architecture Module: `core/database/serializers.py`
```
from datetime import datetime
from typing import Any, Dict

from .models import DocumentModel


def _serialize_datetime(obj: Any) -> Any:
    """Recursively serialize datetime objects to ISO format strings."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {key: _serialize_datetime(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [_serialize_datetime(item) for item in obj]
    return obj


def _document_model_to_dict(doc_model: DocumentModel) -> Dict[str, Any]:
    system_metadata = doc_model.system_metadata or {}
    return {
        "external_id": doc_model.external_id,
        "content_type": doc_model.content_type,
        "filename": doc_model.filename,
        "metadata": doc_model.doc_metadata,
        "metadata_types": doc_model.metadata_types or {},
        "storage_info": doc_model.storage_info,
        "system_metadata": doc_model.system_metadata,
        "summary_storage_key": system_metadata.get("summary_storage_key"),
        "summary_version": system_metadata.get("summary_version"),
        "summary_bucket": system_metadata.get("summary_bucket"),
        "summary_updated_at": system_metadata.get("summary_updated_at"),
        "additional_metadata": doc_model.additional_metadata,
        "chunk_ids": doc_model.chunk_ids,
        "folder_name": doc_model.folder_name,
        "folder_path": doc_model.folder_path,
        "folder_id": doc_model.folder_id,
        "app_id": doc_model.app_id,
        "end_user_id": doc_model.end_user_id,
    }


def _folder_row_to_dict(folder_row) -> Dict[str, Any]:
    system_metadata = getattr(folder_row, "system_metadata", None) or {}
    return {
        "id": getattr(folder_row, "id", None),
        "name": getattr(folder_row, "name", None),
        "full_path": getattr(folder_row, "full_path", None),
        "parent_id": getattr(folder_row, "parent_id", None),
        "depth": getattr(folder_row, "depth", None),
        "description": getattr(folder_row, "description", None),
        "document_ids": getattr(folder_row, "document_ids", None),
        "system_metadata": getattr(folder_row, "system_metadata", None),
        "summary_storage_key": system_metadata.get("summary_storage_key"),
        "summary_version": system_metadata.get("summary_version"),
        "summary_bucket": system_metadata.get("summary_bucket"),
        "summary_updated_at": system_metadata.get("summary_updated_at"),
        "app_id": getattr(folder_row, "app_id", None),
        "end_user_id": getattr(folder_row, "end_user_id", None),
    }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #233** (2025-07-11): **error: Distribution not found at: file:///app/fde**
  *Symptoms*: error: Distribution not found at: file:///app/fde : i have this error when i try to self host the app
  **Post-Mortem & Fix Analysis**:
  > Can you provide more detailed reproduction steps? We're unable to see this issue on our end.
  > @MunteanuIonelAndrei, are you using python based setup or docker based setup for self hosting?

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

### Incident Patch 1: `a9cc6418` (2026-09-25)
**Commit Message**: Keep COMPOSE_PROFILES when start scripts add ui or backup profiles (#443)

Compose ignores COMPOSE_PROFILES whenever a --profile flag is passed.
The start scripts passed --profile for ui and, since #442, for backup
and backup-s3. Enabling scheduled backups therefore dropped profiles set
in .env, such as ollama. A restore drill on EC2 hit this: after restore,
the Ollama container never started, so embeddings would have failed.

The start scripts (checked-in, installer-generated, and PowerShell) now
merge ui, backup, and backup-s3 into COMPOSE_PROFILES instead of passing
flags. A failed S3 upload also explains the EC2 metadata hop limit,
because the AWS CLI only reports "Unable to locate credentials".

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `core/tests/unit/test_docker_lifecycle.py` (modified, +25/-9)
```diff
@@ -93,9 +93,7 @@ def test_start_defaults_to_latest_when_env_omits_version(tmp_path, script_text):
     (deployment / ".env").write_text("JWT_SECRET_KEY=test-only\n", encoding="utf-8")
     (deployment / "morphik.toml").write_text("[api]\nport = 8123\n", encoding="utf-8")
     (deployment / "docker-compose.run.yml").write_text("services: {}\n", encoding="utf-8")
-    (deployment / "morphik-compose-project.sh").write_text(
-        _read("morphik-compose-project.sh"), encoding="utf-8"
-    )
+    (deployment / "morphik-compose-project.sh").write_text(_read("morphik-compose-project.sh"), encoding="utf-8")
 
     fake_bin = tmp_path / "bin"
     fake_bin.mkdir()
@@ -130,13 +128,13 @@ def test_start_defaults_to_latest_when_env_omits_version(tmp_path, script_text):
     assert docker_output.read_text(encoding="utf-8").strip() == "latest|8123"
 
 
-def _run_start_script(tmp_path, script_text, toml_text, with_backup_tool=True):
+def _run_start_script(tmp_path, script_text, toml_text, with_backup_tool=True, env_text="JWT_SECRET_KEY=test-only\n"):
     deployment = tmp_path / "deployment"
     deployment.mkdir()
     script = deployment / "start-morphik.sh"
     script.write_text(script_text, encoding="utf-8")
     script.chmod(0o755)
-    (deployment / ".env").write_text("JWT_SECRET_KEY=test-only\n", encoding="utf-8")
+    (deployment / ".env").write_text(env_text, encoding="utf-8")
     (deployment / "morphik.toml").write_text(toml_text, encoding="utf-8")
     (deployment / "docker-compose.run.yml").write_text("services: {}\n", encoding="utf-8")
     (deployment / "morphik-compose-project.sh").write_text(_read("morphik-compose-project.sh"), encoding="utf-8")
@@ -147,7 +145,8 @@ def _run_start_script(tmp_path, script_text, toml_text, with_backup_tool=True):
     fake_bin.mkdir()
     fake_docker = fake_bin / "docker"
     fake_docker.write_text(
-        '#!/usr/bin/env bash\nprintf "%s|%s\\n" "$*" "${MORPHIK_BACKUP_DIR:-}" > "$FAKE_DOCKER_OUTPUT"\n',
+        "#!/usr/bin/env bash\n"
+        'printf "%s|%s|%s\\n" "$*" "${MORPHIK_BACKUP_DIR:-}" "${COMPOSE_PROFILES:-}" > "$FAKE_DOCKER_OUTPUT"\n',
         encoding="utf-8",
     )
     fake_docker.chmod(0o755)
@@ -180,8 +179,10 @@ def test_start_enables_backup_profiles_from_morphik_toml(tmp_path, script_text):
     completed, docker_args, deployment = _run_start_script(tmp_path, script_text, toml_text)
 
     assert completed.returncode == 0, completed.stderr
-    args, backup_dir = docker_args.split("|")
-    assert "--profile backup --profile backup-s3 up -d --remove-orphans" in args
+    args, backup_dir, profiles = docker_args.split("|")
+    assert args.endswith("up -d --remove-orphans")
+    assert "--profile" not in args
+    assert profiles == "backup,backup-s3"
     assert backup_dir == "./nightly"
     assert (deployment / "nightly").is_dir()
     assert oct((deployment / "nightly").stat().st_mode & 0o777) == "0o700"
@@ -194,11 +195,26 @@ def test_start_leaves_backups_off_by_default(tmp_path, script_text):
     completed, docker_args, deployment = _run_start_script(tmp_path, script_text, toml_text)
 
     assert completed.returncode == 0, completed.stderr
-    assert "--profile backup" not in docker_args
+    assert "backup" not in docker_args.split("|")[2]
     assert "./morphik-backup.sh backup" in completed.stdout
     assert not (deployment / "backups").exists()
 
 
+@START_SCRIPTS
+def test_start_keeps_profiles_from_env_when_adding_ui_and_backups(tmp_path, script_text):
+    # A --profile flag makes Compose ignore COMPOSE_PROFILES, which dropped the ollama profile on
+    # a real EC2 restore. The start script must merge the profiles instead.
+    toml_text = '[backup]\nenabled = true\ns3_uri = "s3://bucket/morphik"\n'
+    env_text = 'JWT_SECRET_KEY=test-only\nCOMPOSE_PROFILES="ollama,ui"\nUI_INSTALLED=true\n'
+
+    completed, docker_args, _ = _run_start_script(tmp_path, script_text, toml_text, env_text=env_text)
+
+    assert completed.returncode == 0, completed.stderr
+    args, _, profiles = docker_args.split("|")
+    assert "--profile" not in args
+    assert profiles == "ollama,ui,backup,backup-s3"
+
+
 @START_SCRIPTS
 def test_start_refuses_scheduled_backups_without_the_backup_tool(tmp_path, script_text):
     toml_text = "[backup]\nenabled = true\n"
```

**File**: `install_docker.ps1` (modified, +10/-3)
```diff
@@ -490,16 +490,23 @@ function Start-Stack($apiPort, $ui) {
     "    if (`$l -match '^\s*\[') { `$inBackup = (`$l -match '^\s*\[backup\]'); continue }",
     "    if (`$inBackup -and `$l -match '^\s*(\w+)\s*=\s*(.*)`$') { `$backup[`$Matches[1]] = (`$Matches[2] -replace '#.*`$', '').Trim().Trim([char]34) } } }",
     "",
+    "# Compose ignores COMPOSE_PROFILES when --profile is passed, so add every profile to COMPOSE_PROFILES",
+    "`$profiles = @()",
+    "if (`$env:COMPOSE_PROFILES) { `$profiles += `$env:COMPOSE_PROFILES -split ',' }",
+    "elseif (Test-Path '.env') {",
+    "  `$m = Select-String -Path .env -Pattern '^COMPOSE_PROFILES=(.*)`$' | Select-Object -Last 1",
+    "  if (`$m) { `$profiles += `$m.Matches[0].Groups[1].Value.Trim().Trim([char]34) -split ',' } }",
     "`$args = @('-f','docker-compose.run.yml')",
-    "if (`$ui) { `$args += @('--profile','ui') }",
+    "if (`$ui) { `$profiles += 'ui' }",
     "if (`$backup['enabled'] -eq 'true') {",
     "  `$dir = if (`$backup['directory']) { `$backup['directory'] } else { './backups' }",
     "  New-Item -ItemType Directory -Force -Path `$dir | Out-Null",
     "  `$env:MORPHIK_BACKUP_DIR = `$dir",
-    "  `$args += @('--profile','backup')",
-    "  if (`$backup['s3_uri']) { `$args += @('--profile','backup-s3') }",
+    "  `$profiles += 'backup'",
+    "  if (`$backup['s3_uri']) { `$profiles += 'backup-s3' }",
     "  Write-Info `"Scheduled backups are on. Files go to `$dir.`"",
     "}",
+    "`$env:COMPOSE_PROFILES = ((`$profiles | ForEach-Object { `$_.Trim() } | Where-Object { `$_ }) | Select-Object -Unique) -join ','",
     "Resolve-MorphikComposeProject",
     "docker compose @args up -d --remove-orphans",
     "Write-Host `"Morphik is running on http://localhost:`$(`$desired)`""
```

**File**: `install_docker.sh` (modified, +20/-4)
```diff
@@ -577,9 +577,23 @@ if [ "$COLPALI_ENABLED" = "false" ]; then
 fi
 
 # Check if UI is installed
+# Compose ignores COMPOSE_PROFILES whenever a --profile flag is passed, which would silently drop
+# profiles such as ollama. Add every profile to COMPOSE_PROFILES instead of passing flags.
+PROFILES="${COMPOSE_PROFILES:-}"
+if [ -z "$PROFILES" ] && [ -f ".env" ]; then
+    PROFILES=$(sed -n 's/^COMPOSE_PROFILES=//p' .env | tail -n1 | tr -d "\"'")
+fi
+add_profile() {
+    case ",${PROFILES}," in
+        *",$1,"*) ;;
+        *) PROFILES="${PROFILES:+$PROFILES,}$1" ;;
+    esac
+}
+
 UI_PROFILE=""
 if [ -f ".env" ] && grep -q "UI_INSTALLED=true" .env; then
-    UI_PROFILE="--profile ui"
+    UI_PROFILE="ui"
+    add_profile ui
 fi
 
 # Read one value from the [backup] section of morphik.toml.
@@ -604,14 +618,16 @@ if [ "$(backup_setting enabled)" = "true" ]; then
     mkdir -p "$MORPHIK_BACKUP_DIR"
     chmod 700 "$MORPHIK_BACKUP_DIR"
     export MORPHIK_BACKUP_OWNER="$(id -u):$(id -g)"
-    BACKUP_PROFILES="--profile backup"
+    BACKUP_PROFILES="backup"
+    add_profile backup
     if [ -n "$(backup_setting s3_uri)" ]; then
-        BACKUP_PROFILES="$BACKUP_PROFILES --profile backup-s3"
+        add_profile backup-s3
     fi
 fi
+export COMPOSE_PROFILES="$PROFILES"
 
 morphik_compose_resolve_existing_project
-docker compose -f docker-compose.run.yml $UI_PROFILE $BACKUP_PROFILES up -d --remove-orphans
+docker compose -f docker-compose.run.yml up -d --remove-orphans
 echo "🚀 Morphik ${MORPHIK_VERSION} is running on http://localhost:${MORPHIK_API_PORT}"
 echo "   Health: http://localhost:${MORPHIK_API_PORT}/health"
 echo "   Docs:   http://localhost:${MORPHIK_API_PORT}/docs"
```

**File**: `morphik-backup.sh` (modified, +3/-1)
```diff
@@ -1230,6 +1230,8 @@ cmd_backup() {
     s3_region=$(toml_get "$CONFIG_FILE" backup s3_region)
     if [ "$upload" = "1" ] && [ -n "$s3_uri" ]; then
         if ! upload_to_s3 "$file" "$s3_uri" "$s3_region"; then
+            info "On EC2 with an instance role, containers reach the role only when the instance metadata hop limit"
+            info "is at least 2: aws ec2 modify-instance-metadata-options --instance-id <id> --http-put-response-hop-limit 2"
             die "The backup was written locally, but the upload to $s3_uri failed."
         fi
         info "Uploaded to ${s3_uri%/}/$(basename "$file")"
@@ -1617,7 +1619,7 @@ cmd_offsite_sync() {
         if aws s3 sync /backups "${uri%/}/" --exclude '*' --include 'morphik-*.backup' --only-show-errors --no-progress; then
             info "$(utc_iso) backups are copied to $uri."
         else
-            warn "$(utc_iso) copy to $uri failed. Retrying in $interval seconds."
+            warn "$(utc_iso) copy to $uri failed. Retrying in $interval seconds. On EC2, an instance role needs a metadata hop limit of at least 2."
         fi
         pause "$interval"
     done
```

**File**: `start-morphik.sh` (modified, +20/-4)
```diff
@@ -68,9 +68,23 @@ fi
 API_PORT=$(awk '/^\[api\]/{flag=1; next} /^\[/{flag=0} flag && /^port[[:space:]]*=/ {gsub(/^port[[:space:]]*=[[:space:]]*/, ""); print; exit}' morphik.toml 2>/dev/null || true)
 export MORPHIK_API_PORT="${API_PORT:-8000}"
 
+# Compose ignores COMPOSE_PROFILES whenever a --profile flag is passed, which would silently drop
+# profiles such as ollama. Add every profile to COMPOSE_PROFILES instead of passing flags.
+PROFILES="${COMPOSE_PROFILES:-}"
+if [ -z "$PROFILES" ] && [ -f ".env" ]; then
+    PROFILES=$(sed -n 's/^COMPOSE_PROFILES=//p' .env | tail -n1 | tr -d "\"'")
+fi
+add_profile() {
+    case ",${PROFILES}," in
+        *",$1,"*) ;;
+        *) PROFILES="${PROFILES:+$PROFILES,}$1" ;;
+    esac
+}
+
 UI_PROFILE=""
 if [ -f ".env" ] && grep -q "^UI_INSTALLED=true" .env; then
-    UI_PROFILE="--profile ui"
+    UI_PROFILE="ui"
+    add_profile ui
 fi
 
 # Read one value from the [backup] section of morphik.toml.
@@ -95,15 +109,17 @@ if [ "$(backup_setting enabled)" = "true" ]; then
     mkdir -p "$MORPHIK_BACKUP_DIR"
     chmod 700 "$MORPHIK_BACKUP_DIR"
     export MORPHIK_BACKUP_OWNER="$(id -u):$(id -g)"
-    BACKUP_PROFILES="--profile backup"
+    BACKUP_PROFILES="backup"
+    add_profile backup
     if [ -n "$(backup_setting s3_uri)" ]; then
-        BACKUP_PROFILES="$BACKUP_PROFILES --profile backup-s3"
+        add_profile backup-s3
     fi
 fi
+export COMPOSE_PROFILES="$PROFILES"
 
 print_info "Starting Morphik with port ${MORPHIK_API_PORT}..."
 morphik_compose_resolve_existing_project
-docker compose -f "$COMPOSE_FILE" $UI_PROFILE $BACKUP_PROFILES up -d --remove-orphans
+docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
 
 print_success "🚀 Morphik is running!"
 print_info "🌐 API endpoints:"
```

---

### Incident Patch 2: `c97f03da` (2026-09-25)
**Commit Message**: Fix Docker shutdown data loss (#441)

**File**: `.env.example` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 JWT_SECRET_KEY="your-super-secret-key-change-in-production"
 SESSION_SECRET_KEY="your-session-secret-key-change-in-production"
 POSTGRES_URI="postgresql+asyncpg://morphik:morphik@localhost:5432/morphik"
+# Optional for Docker Compose. Leave unset to use the persistent postgres_data volume.
+# MORPHIK_POSTGRES_DATA_PATH=./postgres-data
 
 # Set once before the first Docker start to keep volume names stable across directory moves.
 # Do not change this on an existing deployment without migrating its named volumes.
```

**File**: `DOCKER.md` (modified, +22/-3)
```diff
@@ -44,6 +44,7 @@ docker compose -f docker-compose.run.yml --profile "*" down --volumes --remove-o
 ```
 
 It removes PostgreSQL and every other named volume. Back up the database and `./storage` before an intentional reset.
+Do not add `--volumes` to a normal shutdown. The generated `stop-morphik` script preserves all data volumes.
 
 ## Configuration
 
@@ -121,11 +122,21 @@ run `./start-morphik.sh` again to apply changes.
 
 ## Storage and data
 
-- Database data: Stored in the `postgres_data` Docker volume outside the PostgreSQL container
+- Database data: Stored on the host in the `postgres_data` Docker volume. It survives container replacement and `docker compose down`.
 - AI Models: Stored in the `ollama_data` Docker volume
 - Documents: Stored in `./storage` directory (mounted to container)
 - Logs: Available in `./logs` directory
 
+To keep the PostgreSQL files in a visible host directory on a new installation, set this in `.env` before the first start:
+
+```bash
+MORPHIK_POSTGRES_DATA_PATH=./postgres-data
+```
+
+Do not add or change this setting on an existing installation until you have migrated the current database. Pointing Postgres at an empty directory creates an empty database and makes the existing data appear lost.
+
+The generated start and stop scripts also recover the existing Compose project name from Docker's container and volume labels. This prevents a moved installation directory from leaving the old containers and database volume behind.
+
 ## Troubleshooting
 
 1. **Service will not start**
@@ -145,13 +156,20 @@ run `./start-morphik.sh` again to apply changes.
    - Check PostgreSQL health: `docker compose -f docker-compose.run.yml ps`
    - Verify the database: `docker compose -f docker-compose.run.yml exec postgres psql -U morphik -d morphik`
 
-3. **Model download issues**
+3. **Container name is already in use**
+
+   - Do not delete the existing containers or volumes before identifying their Compose project.
+   - Read the current project name: `docker inspect morphik-postgres --format '{{ index .Config.Labels "com.docker.compose.project" }}'`
+   - List existing Postgres volumes: `docker volume ls --filter label=com.docker.compose.volume=postgres_data`
+   - The generated scripts select the existing project automatically. If more than one project owns a Postgres volume, set the intended project explicitly in `.env` with `COMPOSE_PROJECT_NAME=<project>`.
+
+4. **Model download issues**
 
    - Check Ollama logs: `docker compose -f docker-compose.run.yml --profile ollama logs ollama`
    - Ensure enough disk space for models
    - Restart Ollama: `docker compose -f docker-compose.run.yml --profile ollama restart ollama`
 
-4. **Performance issues**
+5. **Performance issues**
 
    - Monitor resources: `docker stats`
    - Ensure sufficient RAM (8GB+ recommended)
@@ -173,6 +191,7 @@ For production environments:
    - Use named volumes for all data
    - Set up regular backups of PostgreSQL
    - Back up the storage directory
+   - Test database restoration before upgrading production deployments
 
 3. **Monitoring**
 
```

**File**: `core/tests/unit/test_docker_installer_safety.py` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+import os
+import re
+import subprocess
+from pathlib import Path
+
+
+REPO_ROOT = Path(__file__).resolve().parents[3]
+
+
+def _read(relative_path: str) -> str:
+    return (REPO_ROOT / relative_path).read_text()
+
+
+def _generated_shell_script(installer: str, filename: str) -> str:
+    match = re.search(rf"cat > {re.escape(filename)} << 'EOF'\n(.*?)\nEOF", installer, re.DOTALL)
+    assert match, f"could not find generated {filename}"
+    return match.group(1)
+
+
+def _write_mock_docker(tmp_path: Path, *, container_project: str = "", volume_projects: dict[str, str] | None = None):
+    volume_projects = volume_projects or {}
+    bin_dir = tmp_path / "bin"
+    bin_dir.mkdir()
+    mock = bin_dir / "docker"
+
+    volume_names = "\\n".join(volume_projects)
+    volume_cases = "\n".join(
+        f'    "{name}") printf \'%s\\n\' "{project}" ;;' for name, project in volume_projects.items()
+    )
+    container_response = f"printf '%s\\n' \"{container_project}\"" if container_project else "exit 1"
+    volume_output = f"{volume_names}\n" if volume_names else ""
+    mock.write_text(
+        f"""#!/bin/bash
+if [[ "$1" == "compose" ]]; then
+    printf '%s\n' "$*" >> "$MOCK_DOCKER_LOG"
+elif [[ "$1 $2" == "inspect morphik-postgres" ]]; then
+    {container_response}
+elif [[ "$1 $2" == "volume ls" ]]; then
+    printf '%b' "{volume_output}"
+elif [[ "$1 $2" == "volume inspect" ]]; then
+    case "$3" in
+{volume_cases}
+        *) exit 1 ;;
+    esac
+else
+    exit 1
+fi
+"""
+    )
+    mock.chmod(0o755)
+    return bin_dir
+
+
+def _resolve_project(tmp_path: Path, **mock_options) -> subprocess.CompletedProcess[str]:
+    bin_dir = _write_mock_docker(tmp_path, **mock_options)
+    env = os.environ.copy()
+    env.pop("COMPOSE_PROJECT_NAME", None)
+    env["PATH"] = f"{bin_dir}:{env['PATH']}"
+    helper = REPO_ROOT / "morphik-compose-project.sh"
+    return subprocess.run(
+        [
+            "bash",
+            "-c",
+            f'source "{helper}"; morphik_compose_resolve_existing_project || exit $?; printf "%s" "$COMPOSE_PROJECT_NAME"',
+        ],
+        cwd=tmp_path,
+        env=env,
+        capture_output=True,
+        text=True,
+        check=False,
+    )
+
+
+def test_generated_stop_scripts_preserve_named_volumes():
+    shell_installer = _read("install_docker.sh")
+    shell_stop = _generated_shell_script(shell_installer, "stop-morphik.sh")
+    powershell_installer = _read("install_docker.ps1")
+
+    assert "down --remove-orphans" in shell_stop
+    assert "down --volumes" not in shell_stop
+    assert "'down','--remove-orphans'" in powershell_installer
+    assert "@('down','--volumes'" not in powershell_installer
+    assert "Persistent named volumes were preserved" in shell_stop
+    assert "Persistent named volumes were preserved" in powershell_installer
+
+
+def test_generated_scripts_load_project_recovery_helper():
+    installer = _read("install_docker.sh")
+    shell_start = _generated_shell_script(installer, "start-morphik.sh")
+    shell_stop = _generated_shell_script(installer, "stop-morphik.sh")
+
+    for script in (shell_start, shell_stop):
+        assert 'source "$SCRIPT_DIR/morphik-compose-project.sh"' in script
+        assert "morphik_compose_resolve_existing_project" in script
+
+    powershell_installer = _read("install_docker.ps1")
+    assert powershell_installer.count("Resolve-MorphikComposeProject") >= 3
+    assert "morphik-compose-project.ps1" in powershell_installer
+
+
+def test_generated_shell_scripts_parse():
+    installer = _read("install_docker.sh")
+
+    for filename in ("start-morphik.sh", "stop-morphik.sh"):
+        result = subprocess.run(
+            ["bash", "-n"],
+            input=_generated_shell_script(installer, filename),
+            capture_output=True,
+            text=True,
+            check=False,
+        )
+        assert result.returncode == 0, result.stderr
+
+
+def test_generated_stop_script_runs_from_its_directory_without_deleting_volumes(tmp_path: Path):
+    installer = _read("install_docker.sh")
+    deployment_dir = tmp_path / "deployment"
+    deployment_dir.mkdir()
+    stop_script = deployment_dir / "stop-morphik.sh"
+    stop_script.write_text(_generated_shell_script(installer, "stop-morphik.sh"))
+    stop_script.chmod(0o755)
+    (deployment_dir / "morphik-compose-project.sh").write_text(_read("morphik-compose-project.sh"))
+    (deployment_dir / "docker-compose.run.yml").touch()
+    (deployment_dir / ".env").write_text("COMPOSE_PROJECT_NAME=existing-install\n")
+
+    bin_dir = _write_mock_docker(tmp_path)
+    docker_log = tmp_path / "docker.log"
+    env = os.environ.copy()
+    env.pop("COMPOSE_PROJECT_NAME", None)
+    env["PATH"] = f"{bin_dir}:{env['PATH']}"
+    env["MOCK_DOCKER_LOG"] = str(docker_log)
+
+    result = subprocess.run(
+        [str(stop_script)],
+        cwd=tmp_path,
+        env=env,
+        capture_output=True,
+        text=True,
+        check=False,
+    )
```

**File**: `core/tests/unit/test_docker_lifecycle.py` (modified, +4/-1)
```diff
@@ -22,7 +22,7 @@ def _installer_start_script() -> str:
 def test_production_compose_persists_postgres_without_fixed_container_names():
     compose = _read("docker-compose.run.yml")
 
-    assert "postgres_data:/var/lib/postgresql/data" in compose
+    assert '"${MORPHIK_POSTGRES_DATA_PATH:-postgres_data}:/var/lib/postgresql/data"' in compose
     assert "container_name:" not in compose
     assert '"5432:5432"' not in compose
     assert "${MORPHIK_API_PORT:-8000}:${MORPHIK_API_PORT:-8000}" in compose
@@ -93,6 +93,9 @@ def test_start_defaults_to_latest_when_env_omits_version(tmp_path, script_text):
     (deployment / ".env").write_text("JWT_SECRET_KEY=test-only\n", encoding="utf-8")
     (deployment / "morphik.toml").write_text("[api]\nport = 8123\n", encoding="utf-8")
     (deployment / "docker-compose.run.yml").write_text("services: {}\n", encoding="utf-8")
+    (deployment / "morphik-compose-project.sh").write_text(
+        _read("morphik-compose-project.sh"), encoding="utf-8"
+    )
 
     fake_bin = tmp_path / "bin"
     fake_bin.mkdir()
```

**File**: `docker-compose.run.yml` (modified, +3/-3)
```diff
@@ -87,9 +87,9 @@ services:
       - POSTGRES_PASSWORD=morphik
       - POSTGRES_DB=morphik
     volumes:
-      # Named volumes live outside the container and survive container recreation.
-      # Normal stop scripts must not pass --volumes to `docker compose down`.
-      - postgres_data:/var/lib/postgresql/data
+      # Defaults to a named volume outside the container. Set MORPHIK_POSTGRES_DATA_PATH
+      # before the first start to use a host directory such as ./postgres-data.
+      - "${MORPHIK_POSTGRES_DATA_PATH:-postgres_data}:/var/lib/postgresql/data"
     healthcheck:
       # The -d flag is important to specify the database name for the readiness check
       test: ["CMD-SHELL", "pg_isready -U morphik -d morphik"]
```

**File**: `docker-compose.yml` (modified, +3/-1)
```diff
@@ -110,7 +110,9 @@ services:
     ports:
       - "5432:5432"
     volumes:
-      - postgres_data:/var/lib/postgresql/data
+      # Defaults to a Docker-managed volume. Set MORPHIK_POSTGRES_DATA_PATH
+      # to a host directory such as ./postgres-data for a bind mount.
+      - "${MORPHIK_POSTGRES_DATA_PATH:-postgres_data}:/var/lib/postgresql/data"
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U morphik -d morphik"]
       interval: 10s
```

**File**: `install_docker.ps1` (modified, +13/-0)
```diff
@@ -25,6 +25,7 @@ function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red }
 $REPO_URL   = "https://raw.githubusercontent.com/morphik-org/morphik-core/main"
 $REPO_ZIP   = "https://codeload.github.com/morphik-org/morphik-core/zip/refs/heads/main"
 $COMPOSE    = "docker-compose.run.yml"
+$COMPOSE_PROJECT_HELPER = "morphik-compose-project.ps1"
 $IMAGE      = "ghcr.io/morphik-org/morphik-core:latest"
 $DIRECT_URL = "https://www.morphik.ai/docs/getting-started#self-host-direct-installation-advanced"
 
@@ -157,6 +158,8 @@ function Ensure-ComposeFile {
   Write-Step "Downloading the Docker Compose configuration file..."
   try {
     Download-File "$REPO_URL/$COMPOSE" $COMPOSE
+    Download-File "$REPO_URL/$COMPOSE_PROJECT_HELPER" $COMPOSE_PROJECT_HELPER
+    . (Join-Path (Get-Location) $COMPOSE_PROJECT_HELPER)
     Write-Ok "Downloaded '$COMPOSE'."
   } catch {
     Write-Err "Failed to download '$COMPOSE'. Check connectivity and try again."
@@ -177,6 +180,9 @@ function Ensure-EnvFile {
     "# Local URI password for secure URI generation (required for creating connection URIs)",
     "LOCAL_URI_PASSWORD=",
     "",
+    "# Optional host directory for Postgres. Leave unset to use the persistent Docker volume.",
+    "# MORPHIK_POSTGRES_DATA_PATH=./postgres-data",
+    "",
     "# Prevent LiteLLM from downloading its model-price map at process startup.",
     "LITELLM_LOCAL_MODEL_COST_MAP=True"
   ) -join [Environment]::NewLine
@@ -400,6 +406,7 @@ function Maybe-Install-UI($apiPort) {
 
 function Start-Stack($apiPort, $ui) {
   Write-Step "Starting the Morphik stack... (first run can take a few minutes)"
+  Resolve-MorphikComposeProject
   $env:MORPHIK_API_PORT = $apiPort
   $args = @('-f', $COMPOSE)
   if ($ui) { $args += @('--profile','ui') }
@@ -416,6 +423,8 @@ function Start-Stack($apiPort, $ui) {
   $start = @(
     "Set-StrictMode -Version Latest",
     "`$ErrorActionPreference = 'Stop'",
+    "Set-Location -LiteralPath `$PSScriptRoot",
+    ". (Join-Path `$PSScriptRoot 'morphik-compose-project.ps1')",
     "",
     'function Write-Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }',
     'function Write-Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }',
@@ -451,6 +460,7 @@ function Start-Stack($apiPort, $ui) {
     "",
     "`$args = @('-f','docker-compose.run.yml')",
     "if (`$ui) { `$args += @('--profile','ui') }",
+    "Resolve-MorphikComposeProject",
     "docker compose @args up -d --remove-orphans",
     "Write-Host `"Morphik is running on http://localhost:`$(`$desired)`""
   ) -join [Environment]::NewLine
@@ -459,12 +469,15 @@ function Start-Stack($apiPort, $ui) {
   $stop = @(
     "Set-StrictMode -Version Latest",
     "`$ErrorActionPreference = 'Stop'",
+    "Set-Location -LiteralPath `$PSScriptRoot",
+    ". (Join-Path `$PSScriptRoot 'morphik-compose-project.ps1')",
     "",
     "if (-not (Test-Path 'docker-compose.run.yml')) {",
     "  Write-Error 'docker-compose.run.yml not found. Run this script from your Morphik install directory.'",
     "}",
     "",
     "# Activate every profile so optional containers stop; preserve all named volumes.",
+    "Resolve-MorphikComposeProject",
     "`$args = @('-f','docker-compose.run.yml','--profile','*','down','--remove-orphans')",
     "docker compose @args",
     "Write-Host 'Morphik services stopped. Persistent named volumes were preserved.'"
```

**File**: `install_docker.sh` (modified, +33/-0)
```diff
@@ -11,6 +11,7 @@ set -e
 REPO_URL="https://raw.githubusercontent.com/morphik-org/morphik-core/main"
 REPO_ARCHIVE_URL="https://codeload.github.com/morphik-org/morphik-core/tar.gz/refs/heads/main"
 COMPOSE_FILE="docker-compose.run.yml"
+COMPOSE_PROJECT_HELPER="morphik-compose-project.sh"
 DIRECT_INSTALL_URL="https://www.morphik.ai/docs/getting-started#self-host-direct-installation-advanced"
 
 EMBEDDING_PROVIDER=""
@@ -168,6 +169,12 @@ else
     print_error "Failed to download '$COMPOSE_FILE'. Please check your internet connection and the repository URL."
 fi
 
+if ! curl -fsSL -o "$COMPOSE_PROJECT_HELPER" "$REPO_URL/$COMPOSE_PROJECT_HELPER"; then
+    print_error "Failed to download '$COMPOSE_PROJECT_HELPER'. Please check your internet connection and the repository URL."
+fi
+# shellcheck disable=SC1090
+source "$COMPOSE_PROJECT_HELPER"
+
 # 4. Create .env and get User Input for API Key
 print_info "Creating '.env' file for your secrets..."
 cat > .env <<EOF
@@ -183,6 +190,9 @@ LOCAL_URI_PASSWORD=
 # Morphik image version (use a date tag like 2025-02-01 to pin, or "latest" for newest)
 MORPHIK_VERSION=${MORPHIK_VERSION}
 
+# Optional host directory for Postgres. Leave unset to use the persistent Docker volume.
+# MORPHIK_POSTGRES_DATA_PATH=./postgres-data
+
 # Prevent LiteLLM from downloading its model-price map at process startup.
 LITELLM_LOCAL_MODEL_COST_MAP=True
 EOF
@@ -441,6 +451,7 @@ fi
 
 # 6. Start the application
 print_info "Starting the Morphik stack... This may take a few minutes for the first run."
+morphik_compose_resolve_existing_project
 docker compose -f "$COMPOSE_FILE" $UI_PROFILE up -d --remove-orphans
 
 print_success "🚀 Morphik has been started!"
@@ -476,6 +487,16 @@ cat > start-morphik.sh << 'EOF'
 #!/usr/bin/env bash
 set -euo pipefail
 
+SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
+cd "$SCRIPT_DIR"
+
+if [[ ! -f "$SCRIPT_DIR/morphik-compose-project.sh" ]]; then
+    echo "morphik-compose-project.sh not found. Run the installer again to restore it." >&2
+    exit 1
+fi
+# shellcheck disable=SC1091
+source "$SCRIPT_DIR/morphik-compose-project.sh"
+
 # Purpose: Production startup script for Morphik
 # Passes the port from morphik.toml to Compose and includes UI if installed
 # Usage: ./start-morphik.sh [--version <tag>]
@@ -534,6 +555,7 @@ if [ -f ".env" ] && grep -q "UI_INSTALLED=true" .env; then
     UI_PROFILE="--profile ui"
 fi
 
+morphik_compose_resolve_existing_project
 docker compose -f docker-compose.run.yml $UI_PROFILE up -d --remove-orphans
 echo "🚀 Morphik ${MORPHIK_VERSION} is running on http://localhost:${MORPHIK_API_PORT}"
 echo "   Health: http://localhost:${MORPHIK_API_PORT}/health"
@@ -549,6 +571,16 @@ cat > stop-morphik.sh << 'EOF'
 #!/usr/bin/env bash
 set -euo pipefail
 
+SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
+cd "$SCRIPT_DIR"
+
+if [[ ! -f "$SCRIPT_DIR/morphik-compose-project.sh" ]]; then
+    echo "morphik-compose-project.sh not found. Run the installer again to restore it." >&2
+    exit 1
+fi
+# shellcheck disable=SC1091
+source "$SCRIPT_DIR/morphik-compose-project.sh"
+
 COMPOSE_FILE="docker-compose.run.yml"
 
 if [ ! -f "$COMPOSE_FILE" ]; then
@@ -558,6 +590,7 @@ fi
 
 # Activate every profile so optional UI and Ollama containers are stopped too.
 # A routine stop must preserve PostgreSQL and all other named volumes.
+morphik_compose_resolve_existing_project
 docker compose -f "$COMPOSE_FILE" --profile "*" down --remove-orphans
 echo "🛑 Morphik services stopped. Persistent named volumes were preserved."
 EOF
```

---

### Incident Patch 3: `4ab6e719` (2026-09-22)
**Commit Message**: Fix document update scheduling with ingestion revisions (#437)

**File**: `core/database/postgres_database.py` (modified, +29/-1)
```diff
@@ -1,12 +1,14 @@
 import json
 import logging
+from contextlib import asynccontextmanager
 from datetime import UTC, datetime
 from typing import Any, Dict, List, Optional
 
 from sqlalchemy import desc, select, text
 from sqlalchemy.exc import ProgrammingError
 from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
 from sqlalchemy.orm import sessionmaker
+from sqlalchemy.pool import NullPool
 
 from core.config import get_settings
 from core.utils.folder_utils import normalize_folder_path
@@ -172,8 +174,30 @@ def __init__(
             connect_args={"server_settings": {"statement_timeout": "30000"}},  # 30 second timeout
         )
         self.async_session = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
+        # Ingestion holds a lock across parsing and embedding. Keep those connections
+        # out of the query pool so busy workers cannot exhaust it and deadlock writes.
+        self._ingestion_lock_engine = create_async_engine(uri, poolclass=NullPool)
         self._initialized = False
 
+    @asynccontextmanager
+    async def document_ingestion_lock(self, document_id: str, *, wait: bool = False):
+        """Serialize content replacement and all worker writes for one document.
+
+        Transaction-scoped advisory locks are released on cancellation/disconnect,
+        with no expiring lease that could admit another writer during a long ingest.
+        Callers must read the document/revision *after* acquiring the lock.
+        """
+        async with self._ingestion_lock_engine.begin() as connection:
+            key = {"key": f"document-ingestion:{document_id}"}
+            if wait:
+                await connection.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), key)
+                acquired = True
+            else:
+                acquired = await connection.scalar(
+                    text("SELECT pg_try_advisory_xact_lock(hashtextextended(:key, 0))"), key
+                )
+            yield acquired
+
     async def initialize(self):
         """Initialize database tables and indexes."""
         if self._initialized:
@@ -296,7 +320,9 @@ async def store_document(
             logger.error(f"Error storing document metadata: {str(e)}")
             return False
 
-    async def get_document(self, document_id: str, auth: AuthContext) -> Optional[Document]:
+    async def get_document(
+        self, document_id: str, auth: AuthContext, *, raise_on_error: bool = False
+    ) -> Optional[Document]:
         """Retrieve document metadata by ID if user has access."""
         try:
             async with self.async_session() as session:
@@ -320,6 +346,8 @@ async def get_document(self, document_id: str, auth: AuthContext) -> Optional[Do
 
         except Exception as e:
             logger.error(f"Error retrieving document metadata: {str(e)}")
+            if raise_on_error:
+                raise
             return None
 
     async def get_document_by_filename(
```

**File**: `core/routes/ingest.py` (modified, +51/-8)
```diff
@@ -3,6 +3,7 @@
 from typing import Any, Dict, List, Optional, Set
 
 import arq
+from arq.jobs import Job, JobStatus
 from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
 
 from core.auth_utils import verify_token
@@ -287,11 +288,39 @@ async def requeue_ingest_jobs(
     results: List[RequeueIngestionResult] = []
 
     async def _process_document(doc: Document, override_flag: Optional[bool]) -> None:
+        if doc.external_id in processed_ids:
+            return
+        async with ingestion_service.db.document_ingestion_lock(doc.external_id) as acquired:
+            if not acquired:
+                results.append(
+                    RequeueIngestionResult(
+                        external_id=doc.external_id,
+                        status="already_queued",
+                        message="Document ingestion is in progress",
+                    )
+                )
+                processed_ids.add(doc.external_id)
+                return
+            current = await ingestion_service.db.get_document(doc.external_id, auth, raise_on_error=True)
+            if current is None:
+                results.append(
+                    RequeueIngestionResult(
+                        external_id=doc.external_id,
+                        status="error",
+                        message="Document no longer exists",
+                    )
+                )
+                processed_ids.add(doc.external_id)
+                return
+            await _process_locked_document(current, override_flag)
+
+    async def _process_locked_document(doc: Document, override_flag: Optional[bool]) -> None:
         ext_id = doc.external_id
         if ext_id in processed_ids:
             return
 
         processed_ids.add(ext_id)
+        revision_persisted = False
 
         try:
             auth_for_doc = AuthContext(
@@ -332,11 +361,28 @@ async def _process_document(doc: Document, override_flag: Optional[bool]) -> Non
             if isinstance(system_metadata, str):
                 system_metadata = json.loads(system_metadata)
             sanitized_system_metadata = IngestionService._reset_processing_metadata(system_metadata)
-            await ingestion_service.db.update_document(
+            revision = int(system_metadata.get("ingestion_revision", 0))
+            current_job = Job(f"ingest:{ext_id}:{revision}", redis, _queue_name=redis.default_queue_name)
+            if await current_job.status() in {JobStatus.queued, JobStatus.deferred, JobStatus.in_progress}:
+                results.append(
+                    RequeueIngestionResult(
+                        external_id=ext_id,
+                        status="already_queued",
+                        message="An ingestion job is already pending",
+                    )
+                )
+                return
+            # A retained result may represent a failed attempt. A manual requeue
+            # gets a new revision, fencing off any delayed attempt of the old job.
+            sanitized_system_metadata["ingestion_revision"] = revision + 1
+            success = await ingestion_service.db.update_document(
                 document_id=ext_id,
                 updates={"system_metadata": sanitized_system_metadata},
                 auth=auth_for_doc,
             )
+            if not success:
+                raise RuntimeError("Failed to persist requeue revision")
+            revision_persisted = True
             job_payload = IngestionService._build_ingestion_job_payload(
                 document_id=ext_id,
                 file_key=key,
@@ -349,17 +395,12 @@ async def _process_document(doc: Document, override_flag: Optional[bool]) -> Non
                 folder_path=doc.folder_path,
                 folder_leaf=doc.folder_name,
                 end_user_id=doc.end_user_id,
+                ingestion_revision=revision + 1,
             )
             job = await redis.enqueue_job("process_ingestion_job", **job_payload)
 
             if job is None:
-                results.append(
-                    RequeueIngestionResult(
-                        external_id=ext_id,
-                        status="already_queued",
-                        message="An ingestion job is already pending for this document",
-                    )
-                )
+                raise RuntimeError("Requeue job ID is already present in Redis; no new job was queued")
             else:
                 results.append(
                     RequeueIngestionResult(
@@ -372,6 +413,8 @@ async def _process_document(doc: Document, override_flag: Optional[bool]) -> Non
             raise
         except Exception as exc:  # noqa: BLE001
             logger.error("Failed to requeue ingestion for document %s: %s", ext_id, exc, exc_info=True)
+            if revision_persisted:
+                await ingestion_service._mark_document_failed(doc, auth, f"Failed to requeue ingestion: {exc}")
             results.append(
         
```

**File**: `core/services/ingestion_service.py` (modified, +67/-3)
```diff
@@ -428,9 +428,11 @@ def _build_ingestion_job_payload(
         folder_path: Optional[str] = None,
         folder_leaf: Optional[str] = None,
         end_user_id: Optional[str] = None,
+        ingestion_revision: int = 0,
     ) -> Dict[str, Any]:
         return {
-            "_job_id": f"ingest:{document_id}",
+            "_job_id": f"ingest:{document_id}:{ingestion_revision}",
+            "ingestion_revision": ingestion_revision,
             "_expires": timedelta(days=7),
             "document_id": document_id,
             "file_key": file_key,
@@ -562,6 +564,38 @@ async def ingest_file_content(
         end_user_id: Optional[str] = None,
         use_colpali: Optional[bool] = False,
         external_id: Optional[str] = None,
+    ) -> Document:
+        document_id = external_id or str(uuid.uuid4())
+        async with self.db.document_ingestion_lock(document_id) as acquired:
+            if not acquired:
+                raise HTTPException(status_code=409, detail="Document ingestion is already in progress; retry later")
+            return await self._ingest_file_content_locked(
+                file_content_bytes,
+                filename,
+                content_type,
+                metadata,
+                auth,
+                redis,
+                metadata_types,
+                folder_name,
+                end_user_id,
+                use_colpali,
+                document_id,
+            )
+
+    async def _ingest_file_content_locked(
+        self,
+        file_content_bytes: bytes,
+        filename: str,
+        content_type: Optional[str],
+        metadata: Optional[Dict[str, Any]],
+        auth: AuthContext,
+        redis: arq.ArqRedis,
+        metadata_types: Optional[Dict[str, str]],
+        folder_name: Optional[Union[str, List[str]]],
+        end_user_id: Optional[str],
+        use_colpali: Optional[bool],
+        external_id: str,
     ) -> Document:
         """
         Ingests file content from bytes. Saves to storage, creates document record,
@@ -594,6 +628,7 @@ async def ingest_file_content(
             folder_path=folder_path,
         )
         doc.system_metadata = self._reset_processing_metadata(doc.system_metadata)
+        doc.system_metadata["ingestion_revision"] = 0
 
         await self._verify_ingest_and_storage_limits(auth, len(file_content_bytes), doc.external_id)
 
@@ -685,7 +720,7 @@ async def ingest_file_content(
             )
             job = await redis.enqueue_job("process_ingestion_job", **job_payload)
             if job is None:
-                logger.info("Connector file ingestion job already queued (doc_id=%s)", doc.external_id)
+                raise RuntimeError("Ingestion job ID is already present in Redis; no new job was queued")
             else:
                 logger.info(
                     "Connector file ingestion job queued with ID: %s for document: %s", job.job_id, doc.external_id
@@ -712,6 +747,33 @@ async def queue_document_update(
         metadata: Optional[Dict[str, Any]] = None,
         metadata_types: Optional[Dict[str, str]] = None,
         use_colpali: Optional[bool] = None,
+    ) -> Optional[Document]:
+        async with self.db.document_ingestion_lock(document_id) as acquired:
+            if not acquired:
+                raise HTTPException(status_code=409, detail="Document ingestion is already in progress; retry later")
+            return await self._queue_document_update_locked(
+                document_id,
+                auth,
+                redis,
+                content,
+                file,
+                filename,
+                metadata,
+                metadata_types,
+                use_colpali,
+            )
+
+    async def _queue_document_update_locked(
+        self,
+        document_id: str,
+        auth: AuthContext,
+        redis: arq.ArqRedis,
+        content: Optional[str],
+        file: Optional[UploadFile],
+        filename: Optional[str],
+        metadata: Optional[Dict[str, Any]],
+        metadata_types: Optional[Dict[str, str]],
+        use_colpali: Optional[bool],
     ) -> Optional[Document]:
         """
         Update a document by replacing its content and re-queueing ingestion.
@@ -781,6 +843,7 @@ async def queue_document_update(
             raise HTTPException(status_code=500, detail=f"Failed to upload updated file to storage: {str(e)}")
 
         doc.system_metadata = self._reset_processing_metadata(doc.system_metadata)
+        doc.system_metadata["ingestion_revision"] = int(doc.system_metadata.get("ingestion_revision", 0)) + 1
 
         updates = {
             "metadata": doc.metadata,
@@ -832,10 +895,11 @@ async def queue_document_update(
                 folder_path=doc.folder_path,
                 folder_leaf=doc.folder_name,
                 end_user_id=doc.end_user_id,
+                ingestion_revision=doc.system_metadata["ingestion_revision"],
             )
             job = await redis.enqueue_job("process_inges
```

**File**: `core/tests/integration/test_document_update_revisions.py` (added, +357/-0)
```diff
@@ -0,0 +1,357 @@
+"""Real Redis/ARQ and PostgreSQL/pgvector regression tests for content updates.
+
+Set CORE_UPDATE_TEST_POSTGRES_URI and CORE_UPDATE_TEST_REDIS_URL to disposable
+services. Documents and queue keys are isolated per test; Redis is never flushed.
+The parser and worker are real. Embeddings are deterministic and local here;
+provider-backed API/download/retrieval verification is a separate runtime proof.
+"""
+
+import asyncio
+import os
+import uuid
+from io import BytesIO
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, Mock
+
+import pytest
+from arq import create_pool
+from arq.connections import RedisSettings
+from arq.jobs import Job, JobStatus
+from arq.worker import Retry, Worker
+from fastapi import HTTPException, UploadFile
+from sqlalchemy import text
+from sqlalchemy.exc import OperationalError
+
+pytestmark = pytest.mark.integration
+POSTGRES_URI = os.environ.get("CORE_UPDATE_TEST_POSTGRES_URI")
+REDIS_URL = os.environ.get("CORE_UPDATE_TEST_REDIS_URL")
+
+
+@pytest.fixture
+async def runtime(tmp_path, monkeypatch):
+    if not POSTGRES_URI or not REDIS_URL:
+        pytest.skip("Set CORE_UPDATE_TEST_POSTGRES_URI and CORE_UPDATE_TEST_REDIS_URL")
+
+    from core.config import get_settings
+    from core.database.postgres_database import PostgresDatabase
+    from core.models.auth import AuthContext
+    from core.parser.morphik_parser import MorphikParser
+    from core.services.ingestion_service import IngestionService
+    from core.storage.local_storage import LocalStorage
+    from core.vector_store.pgvector_store import PGVectorStore
+    from core.workers.ingestion_worker import process_ingestion_job
+
+    settings = get_settings()
+    monkeypatch.setattr(settings, "ENABLE_COLPALI", False)
+    monkeypatch.setattr(settings, "MODE", "self_hosted")
+    queue_name = f"update-test:{uuid.uuid4()}"
+    redis = await create_pool(RedisSettings.from_dsn(REDIS_URL), default_queue_name=queue_name)
+    db = PostgresDatabase(POSTGRES_URI)
+    store = PGVectorStore(POSTGRES_URI)
+    assert await db.initialize()
+    assert await store.initialize()
+    storage = LocalStorage(str(tmp_path))
+    embedding = [1.0] + [0.0] * (settings.VECTOR_DIMENSIONS - 1)
+    model = SimpleNamespace(embed_for_ingestion=AsyncMock(side_effect=lambda chunks: [embedding for _ in chunks]))
+    parser = MorphikParser(chunk_size=80, chunk_overlap=0)
+    service = IngestionService(db, store, model, storage, parser)
+    auth = AuthContext(user_id="update-regression")
+    ctx = dict(database=db, vector_store=store, embedding_model=model, storage=storage, parser=parser)
+    ids = []
+
+    async def ingest(content="ORIGINAL-CONTENT " * 40):
+        doc = await service.ingest_file_content(
+            content.encode(),
+            "policy.txt",
+            "text/plain",
+            {"proof": queue_name},
+            auth,
+            redis,
+        )
+        ids.append(doc.external_id)
+        return doc
+
+    def payload(doc):
+        return dict(
+            document_id=doc.external_id,
+            file_key=doc.storage_info["key"],
+            bucket=doc.storage_info["bucket"],
+            original_filename=doc.filename,
+            content_type=doc.content_type,
+            auth_dict={"user_id": auth.user_id},
+            use_colpali=False,
+            ingestion_revision=doc.system_metadata.get("ingestion_revision", 0),
+        )
+
+    async def drain():
+        worker = Worker(
+            [process_ingestion_job],
+            redis_pool=redis,
+            queue_name=queue_name,
+            ctx=ctx,
+            burst=True,
+            poll_delay=0.01,
+            handle_signals=False,
+            keep_result=3600,
+        )
+        await asyncio.wait_for(worker.async_run(), timeout=30)
+        assert worker.jobs_failed == 0
+
+    async def snapshot(doc):
+        current = await db.get_document(doc.external_id, auth)
+        async with db.engine.connect() as conn:
+            rows = (
+                await conn.execute(
+                    text(
+                        "SELECT chunk_number, content FROM vector_embeddings WHERE document_id = :id ORDER BY chunk_number"
+                    ),
+                    {"id": doc.external_id},
+                )
+            ).all()
+        return current.model_dump(mode="json"), [tuple(row) for row in rows]
+
+    r = SimpleNamespace(
+        db=db,
+        store=store,
+        redis=redis,
+        service=service,
+        auth=auth,
+        ctx=ctx,
+        ingest=ingest,
+        payload=payload,
+        drain=drain,
+        snapshot=snapshot,
+        model=model,
+        process=process_ingestion_job,
+        embedding=embedding,
+        queue_name=queue_name,
+    )
+    try:
+        yield r
+    finally:
+        for document_id in ids:
+            await store.delete_chunks_by_document_id(document_id)
+            await db.delete_document(document_id, auth)
+            for 
```

**File**: `core/tests/unit/test_ingestion_service_metadata_update.py` (modified, +7/-1)
```diff
@@ -2,6 +2,7 @@
 
 import os
 import sys
+from contextlib import asynccontextmanager
 from pathlib import Path
 from types import ModuleType, SimpleNamespace
 
@@ -31,6 +32,10 @@ def __init__(self, doc: Document):
         self.doc = doc
         self.update_calls = []
 
+    @asynccontextmanager
+    async def document_ingestion_lock(self, document_id, *, wait=False):
+        yield True
+
     async def get_document(self, document_id: str, auth: AuthContext):
         if document_id == self.doc.external_id:
             return self.doc
@@ -294,4 +299,5 @@ async def no_stored_size(*args, **kwargs):
     assert queued["function_name"] == "process_ingestion_job"
     assert queued["payload"]["document_id"] == "doc-1"
     assert queued["payload"]["file_key"] == "ingest_uploads/replacement/report.txt"
-    assert queued["payload"]["_job_id"] == "ingest:doc-1"
+    assert queued["payload"]["_job_id"] == "ingest:doc-1:1"
+    assert queued["payload"]["ingestion_revision"] == 1
```

**File**: `core/workers/ingestion_worker.py` (modified, +80/-17)
```diff
@@ -15,6 +15,7 @@
 from arq.worker import Retry
 from opentelemetry.trace import Status, StatusCode, get_current_span
 from sqlalchemy import text
+from sqlalchemy.exc import SQLAlchemyError
 
 from core.config import get_settings
 from core.database.postgres_database import PostgresDatabase
@@ -45,7 +46,8 @@
 # library can never break error classification. Used to recognise S3 / turbopuffer
 # backpressure (throttling, 5xx, connection blips) as transient-and-retryable.
 try:
-    from botocore.exceptions import BotoCoreError, ClientError as BotoClientError
+    from botocore.exceptions import BotoCoreError
+    from botocore.exceptions import ClientError as BotoClientError
 except Exception:  # noqa: BLE001
     BotoCoreError = BotoClientError = None
 
@@ -458,6 +460,65 @@ async def process_ingestion_job(
     folder_path: Optional[str] = None,
     folder_leaf: Optional[str] = None,
     end_user_id: Optional[str] = None,
+    ingestion_revision: int = 0,
+) -> Dict[str, Any]:
+    """Run only the current revision, holding the document lock through every write.
+
+    Legacy queue messages have revision zero. Checking their storage location too
+    prevents an old message from reading a file replaced before this rollout.
+    """
+    database = ctx["database"]
+    auth = AuthContext(
+        user_id=auth_dict.get("user_id") or auth_dict.get("entity_id", ""),
+        app_id=auth_dict.get("app_id"),
+    )
+    try:
+        async with database.document_ingestion_lock(document_id, wait=True):
+            doc = await database.get_document(document_id, auth, raise_on_error=True)
+            if (
+                doc is None
+                or int(doc.system_metadata.get("ingestion_revision", 0)) != ingestion_revision
+                or doc.storage_info.get("key") != file_key
+                or doc.storage_info.get("bucket") != bucket
+            ):
+                logger.info("Skipping superseded ingestion job for %s revision %s", document_id, ingestion_revision)
+                return {"document_id": document_id, "status": "superseded"}
+            if doc.system_metadata.get("status") == "completed":
+                return {"document_id": document_id, "status": "completed"}
+            return await _process_ingestion_job_locked(
+                ctx,
+                document_id,
+                file_key,
+                bucket,
+                original_filename,
+                content_type,
+                auth_dict,
+                use_colpali,
+                folder_name,
+                folder_path,
+                folder_leaf,
+                end_user_id,
+                ingestion_revision,
+            )
+    except (SQLAlchemyError, OSError, asyncio.TimeoutError) as exc:
+        # A failed lock/read is not evidence that this revision was superseded.
+        raise Retry(defer=30) from exc
+
+
+async def _process_ingestion_job_locked(
+    ctx: Dict[str, Any],
+    document_id: str,
+    file_key: str,
+    bucket: str,
+    original_filename: str,
+    content_type: str,
+    auth_dict: Dict[str, Any],
+    use_colpali: bool,
+    folder_name: Optional[str] = None,
+    folder_path: Optional[str] = None,
+    folder_leaf: Optional[str] = None,
+    end_user_id: Optional[str] = None,
+    ingestion_revision: int = 0,
 ) -> Dict[str, Any]:
     """
     Background worker task that processes file ingestion jobs.
@@ -1088,40 +1149,39 @@ def _meta_resolver():  # noqa: D401
             # duplicate; deletion is by document_id, so it works even though
             # chunk_ids is only persisted on success.
             is_retry_attempt = int(ctx.get("job_try") or 1) > 1
-            if doc.chunk_ids or is_retry_attempt:
+            if doc.chunk_ids or is_retry_attempt or ingestion_revision > 0:
                 logger.info(
                     "Cleanup before storing for %s (%s): deleting existing chunks (%d tracked)",
                     document_id,
                     "arq retry" if is_retry_attempt and not doc.chunk_ids else "re-ingestion",
                     len(doc.chunk_ids),
                 )
-                deletion_tasks = []
-                if hasattr(vector_store, "delete_chunks_by_document_id"):
-                    deletion_tasks.append(vector_store.delete_chunks_by_document_id(document_id, auth.app_id))
                 # Always try to clean colpali store — the doc may have been ingested
                 # with colpali previously even if this re-ingestion doesn't use it
                 cleanup_colpali_store = colpali_vector_store
                 if not cleanup_colpali_store and settings.ENABLE_COLPALI:
                     try:
                         cleanup_colpali_store = await _get_worker_colpali_store(database)
                     except Exception as e:
-                        logger.warning(f"Could not init colpali store for cleanup: {e}")
+                        raise RuntimeError("Could not initialize ColPali store to remove old chunks") from 
```

**File**: `docs/document-updates.md` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+# Document update scheduling
+
+Content updates preserve the document ID, user metadata, and folder association. Each accepted update increments
+`system_metadata.ingestion_revision` and queues `ingest:<document_id>:<revision>`. Redis can retain the result of
+an earlier ingestion without blocking the update. Completion records `system_metadata.indexed_revision`.
+
+The API and worker take the same PostgreSQL advisory lock for a document. The lock covers initial upload, update
+scheduling, manual requeue, and the worker's entire processing attempt, including progress and failure writes.
+Workers check the stored revision and source location after taking the lock. Superseded jobs return without
+changing files, chunks, or status; duplicate delivery after completion also makes no changes.
+
+An update attempted during active processing returns HTTP 409 and leaves the document unchanged. The caller can
+retry after processing finishes. Updates accepted while earlier jobs are still queued supersede those jobs;
+the latest accepted revision is indexed. Repeating an HTTP content update creates another revision, even when
+the bytes are identical. There is no client `If-Match` precondition or HTTP idempotency key in this change.
+
+`completed` is set only after chunk replacement and its document update succeed. Cleanup includes untracked
+chunks from interrupted attempts and rejects failed deletions. While processing or failed, the document remains
+excluded from normal retrieval, as before. An enqueue exception or unexpected `None` result returns an error
+and marks the persisted revision failed instead of reporting successful scheduling.
+
+`POST /ingest/requeue` reads the current document under the same lock. A queued or active job returns
+`already_queued` without resetting status. A finished or missing job gets a new revision, so a retained failed
+result cannot prevent recovery. Requeue also recovers a revision left processing if the API exits between the
+PostgreSQL write and Redis enqueue; these operations are not a distributed transaction.
+
+## Deployment
+
+Deploy the API and ingestion workers together. Drain or stop workers running the old code before accepting
+updates through the new API. Older binaries do not take the lock or accept revision arguments. The new worker
+accepts legacy queued messages without a revision, treating them as revision zero and checking their source
+location. Existing documents need no migration; an absent revision is zero.
+
+The lock uses one additional PostgreSQL connection per active ingestion or scheduling operation. These
+connections use a separate unpooled engine so long-running jobs cannot exhaust the ordinary query pool.
+
+## Verification
+
+`core/tests/integration/test_document_update_revisions.py` runs the real ARQ worker, Redis, PostgreSQL/pgvector,
+LocalStorage, and text parser with deterministic local embeddings. Point the following variables at disposable
+services and run it with the project's installed dependencies and test configuration:
+
+```bash
+export CORE_UPDATE_TEST_POSTGRES_URI='postgresql+asyncpg://morphik:morphik@127.0.0.1:55438/morphik'
+export CORE_UPDATE_TEST_REDIS_URL='redis://127.0.0.1:56388/0'
+python -m pytest core/tests/integration/test_document_update_revisions.py
+```
+
+The tests retain an actual completed legacy ARQ result, replace many chunks with one, repeat updates, replay
+superseded and completed jobs, reject updates during active workers, retry partial writes, cancel workers,
+exercise enqueue/cleanup/read failures, and verify manual requeue. Each test removes only its own data and keys.
+
+On September 8, 2026, the supplied full runtime proof also passed against the working tree based on `7f72d712`.
+It used the real authenticated Core API and worker, real `text-embedding-3-small` embeddings, and isolated
+PostgreSQL/pgvector and Redis containers. Corrected text was downloaded and retrieved under the same document
+ID and metadata, with no original text in retrieval. The correction survived container recreation and API/worker
+restart. This verifies a synthetic standard-text case; it does not cover production images, PDF/OCR, or ColPali.
```

**File**: `docs/iqor-on-prem.md` (modified, +4/-2)
```diff
@@ -2,6 +2,8 @@
 
 Audit baseline: `origin/main` at `8c51b8d` on 2026-09-02.
 
+The September 8 content-update follow-up is documented in [Document update scheduling](document-updates.md).
+
 This document separates Morphik Core behavior from iQor's MCP wrapper and UI. It also records which findings have an
 executable test. A code path alone is not counted as a passing deployment check.
 
@@ -14,8 +16,8 @@ executable test. A code path alone is not counted as a passing deployment check.
 | Start rewrites Compose state and fixed container names collide | Implemented; static verification passed | The API port now uses `MORPHIK_API_PORT`; production services use Compose project-scoped names; static lifecycle tests and `docker compose config` pass. | Morphik Core |
 | Documents survive PostgreSQL container recreation | Verified in Docker | `scripts/test_postgres_persistence.sh` inserts a document row, recreates PostgreSQL, and checks the original ID and metadata. | Morphik Core / iQor infrastructure |
 | Text update preserves document identity and existing metadata | Verified in a unit test | `test_queued_text_update_preserves_identity_metadata_and_queues_reindex` passes. | Morphik Core |
-| Text update queues changed content for re-indexing and exposes processing status | Partially verified | The unit test proves the replacement object and `process_ingestion_job` payload use the same document ID and that the returned status is `processing`. Existing SDK status tests pass. No end-to-end test in this audit proves the changed text is retrievable after the worker finishes. | Morphik Core |
-| Text update prevents lost updates | Fails | There is no content revision precondition. Every update uses ARQ job ID `ingest:{document_id}`. A second update can receive a successful API response while `enqueue_job` returns `None`, and the first queued job may refer to an object the second update deleted. | Morphik Core, then iQor caller adoption |
+| Text update queues changed content for re-indexing and exposes processing status | Verified with synthetic standard text | The September 8 runtime proof uses the real API, worker, embeddings, and pgvector. Corrected downloads and retrieval survive container recreation. See [update verification](document-updates.md#verification). | Morphik Core |
+| Content updates and ingestion workers cannot overwrite a newer accepted revision | Implemented and integration tested | Persisted revisions give updates distinct job IDs. API and worker share a document lock; active processing returns 409, queued superseded jobs skip all writes. Client editing preconditions remain outside this change. See [update scheduling](document-updates.md). | Morphik Core, then iQor caller adoption |
 | `min_score` affects retrieval | Fixed and unit verified in this branch | `test_min_score_zero_keeps_zero_and_positive_scores` and `test_min_score_filters_on_the_final_score` pass. | Morphik Core |
 | Work item 47490 returns five distinct QA backlog items | Not verified | The repository has no iQor corpus, query text, auth token, or captured response. `scripts/verify_iqor_retrieval.sh` captures and validates the response on iQor's deployment. | iQor MCP wrapper / iQor acceptance test |
 | Default Docker config keeps document and query data on premises | Fails by default | `morphik.docker.toml` selects OpenAI for completion and standard embeddings. Telemetry is enabled unless `TELEMETRY=false`. See the data boundary below. | Joint configuration decision |
```

---

### Incident Patch 4: `57a6c0f8` (2026-09-08)
**Commit Message**: Fix Unicode filenames in original-file download headers (#436)

**File**: `core/routes/documents.py` (modified, +2/-1)
```diff
@@ -28,6 +28,7 @@
 )
 from core.services.telemetry import TelemetryService
 from core.services_init import document_service, ingestion_service
+from core.utils.content_disposition import build_content_disposition
 from core.utils.typed_metadata import TypedMetadataError
 
 # ---------------------------------------------------------------------------
@@ -374,7 +375,7 @@ def generate():
             generate(),
             media_type=doc.content_type or "application/octet-stream",
             headers={
-                "Content-Disposition": f"inline; filename=\"{doc.filename or 'document'}\"",
+                "Content-Disposition": build_content_disposition(doc.filename, disposition="inline"),
                 "Content-Length": str(len(file_content)),
             },
         )
```

**File**: `core/tests/unit/test_document_download.py` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+"""Exercise the real documents router with synthetic bytes and isolated services."""
+
+import importlib.util
+import re
+import sys
+from pathlib import Path
+from types import ModuleType, SimpleNamespace
+from unittest.mock import AsyncMock, Mock
+from urllib.parse import unquote_to_bytes
+
+import pytest
+from fastapi import FastAPI, HTTPException
+from fastapi.testclient import TestClient
+
+from core.models.auth import AuthContext
+from core.models.documents import Document
+from core.utils.content_disposition import build_content_disposition
+
+pytestmark = pytest.mark.unit
+
+REPORTED_FILENAMES = [
+    "8 Major Food Allergens _ 🕮Knowledge _ Salesforce.html",
+    "B Vitamins and How They Support The Body _ 🕮Knowledge _ Salesforce.html",
+    "Age Restricted Ingredients 18+ _ 🕮Knowledge _ Salesforce.html",
+]
+FILE_CONTENT = b"<!doctype html><meta charset='utf-8'><p>Synthetic download fixture.</p>\n"
+
+
+def _load_module(name, relative_path):
+    """Load production code without leaving mocked imports cached for other tests."""
+    path = Path(__file__).resolve().parents[2] / relative_path
+    spec = importlib.util.spec_from_file_location(name, path)
+    module = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(module)
+    return module
+
+
+@pytest.fixture
+def download_route(monkeypatch):
+    doc = Document(
+        external_id="document-1",
+        filename="example.html",
+        content_type="text/html",
+        storage_info={"bucket": "test-bucket", "key": "original-file"},
+    )
+    auth = AuthContext(user_id="test-user", app_id="test-app")
+    service = SimpleNamespace(
+        db=SimpleNamespace(get_document=AsyncMock(return_value=doc)),
+        storage=SimpleNamespace(
+            download_file=AsyncMock(return_value=FILE_CONTENT),
+            get_download_url=AsyncMock(return_value="https://storage.example.test/original-file"),
+        ),
+    )
+    telemetry = Mock()
+    telemetry.track.side_effect = lambda **kwargs: lambda handler: handler
+
+    # Import-time singletons otherwise initialize database, models and telemetry.
+    # Keep the production router, response classes and auth dependency intact.
+    stubs = {
+        "core.config": {
+            "get_settings": lambda: SimpleNamespace(
+                bypass_auth_mode=False,
+                JWT_SECRET_KEY="synthetic-test-secret",
+                JWT_ALGORITHM="HS256",
+            )
+        },
+        "core.database.postgres_database": {
+            "InvalidMetadataFilterError": type("InvalidMetadataFilterError", (ValueError,), {})
+        },
+        "core.services.telemetry": {"TelemetryService": lambda: telemetry},
+        "core.services_init": {"document_service": service, "ingestion_service": Mock()},
+    }
+    for name, attributes in stubs.items():
+        module = ModuleType(name)
+        vars(module).update(attributes)
+        monkeypatch.setitem(sys.modules, name, module)
+
+    auth_module = _load_module("core.auth_utils", "auth_utils.py")
+    monkeypatch.setitem(sys.modules, "core.auth_utils", auth_module)
+    documents = _load_module("core.routes.documents", "routes/documents.py")
+    authenticate = AsyncMock(return_value=auth)
+
+    async def authenticated():
+        return await authenticate()
+
+    app = FastAPI()
+    app.include_router(documents.router)
+    app.dependency_overrides[documents.verify_token] = authenticated
+    with TestClient(app) as client:
+        yield SimpleNamespace(client=client, app=app, doc=doc, auth=auth, authenticate=authenticate, service=service)
+
+
+def _assert_download(route, response, expected_filename, expected_fallback=None):
+    assert response.status_code == 200
+    assert response.content == route.service.storage.download_file.return_value
+    assert response.headers["content-length"] == str(len(response.content))
+    header = response.headers["content-disposition"]
+    assert header.isascii()
+    assert all(32 <= ord(char) < 127 for char in header)
+    assert len(response.headers.get_list("content-disposition")) == 1
+    # Validate both parameters, including quoted-string and RFC 8187 syntax.
+    match = re.fullmatch(
+        r"""inline; filename="([^"\\]*)"; filename\*=UTF-8''((?:[A-Za-z0-9!#$&+.^_`|~-]|%[0-9A-F]{2})+)""",
+        header,
+    )
+    assert match is not None, header
+    fallback, encoded = match.groups()
+    assert fallback
+    if expected_fallback is not None:
+        assert fallback == expected_fallback
+    assert unquote_to_bytes(encoded).decode("utf-8") == expected_filename
+    route.authenticate.assert_awaited_once_with()
+    route.service.db.get_document.assert_awaited_once_with("document-1", route.auth)
+    route.service.storage.download_file.assert_awaited_once_with("test-bucket", "original-file")
+
+
+@pytest.mark.parametrize("filename", REPORTED_FILENAMES)
+def test_reported_unicode_filenames_download(download_route, filename):
+    download_route.do
```

**File**: `core/utils/content_disposition.py` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+"""Content-Disposition headers for file responses."""
+
+from typing import Literal, Optional
+from urllib.parse import quote
+
+
+def build_content_disposition(filename: Optional[str], disposition: Literal["inline", "attachment"] = "inline") -> str:
+    """Build an ASCII header with a fallback and RFC 6266/8187 UTF-8 filename*.
+
+    Replace control characters in the suggested name without changing stored
+    metadata. Keep Unicode and punctuation in filename*, but replace non-ASCII,
+    quotes, path separators and percent signs in the legacy fallback to avoid
+    quoted-string escaping and inconsistent browser percent-decoding.
+    """
+    if disposition not in ("inline", "attachment"):
+        raise ValueError("Unsupported content disposition")
+
+    filename = "".join("_" if ord(char) < 32 or ord(char) == 127 else char for char in (filename or "document"))
+    fallback = "".join(char if 32 <= ord(char) < 127 and char not in '"\\/%' else "_" for char in filename)
+    return f"{disposition}; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"
```

---

### Incident Patch 5: `d34e5ffa` (2026-05-11)
**Commit Message**: [codex] Handle empty document ingestion gracefully (#399)

* Handle empty document ingestion gracefully

* Filter pdf2image fallback pages

**File**: `core/parser/morphik_parser.py` (modified, +153/-0)
```diff
@@ -1,8 +1,11 @@
 import io
 import logging
 import os
+import shutil
+import subprocess
 import tempfile
 from abc import ABC, abstractmethod
+from pathlib import Path
 from typing import Any, Dict, List, Optional, Tuple
 
 import openpyxl
@@ -281,6 +284,99 @@ def _is_fast_excel_file(self, filename: str) -> bool:
         ext = os.path.splitext(filename.lower())[1]
         return ext in self._FAST_EXCEL_EXTENSIONS
 
+    @staticmethod
+    def _office_suffix(filename: str) -> Optional[str]:
+        suffix = Path(filename).suffix.lower()
+        if suffix in {".docx", ".doc", ".pptx", ".ppt"}:
+            return suffix
+        return None
+
+    @staticmethod
+    def _convert_office_to_pdf_bytes(file: bytes, suffix: str) -> Optional[bytes]:
+        """Convert Office bytes to PDF bytes for fallback parsing."""
+        if not shutil.which("soffice"):
+            logger.warning("LibreOffice (soffice) not found in PATH; cannot run Office-to-PDF parse fallback.")
+            return None
+
+        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_input:
+            temp_input.write(file)
+            temp_input_path = temp_input.name
+
+        with tempfile.TemporaryDirectory() as output_dir:
+            try:
+                result = subprocess.run(
+                    [
+                        "soffice",
+                        "--headless",
+                        "--convert-to",
+                        "pdf",
+                        "--outdir",
+                        output_dir,
+                        temp_input_path,
+                    ],
+                    capture_output=True,
+                    text=True,
+                    timeout=300,
+                )
+                if result.returncode != 0:
+                    logger.warning(
+                        "LibreOffice fallback conversion failed: %s",
+                        result.stderr.strip() or result.stdout.strip(),
+                    )
+                    return None
+
+                pdf_path = Path(output_dir) / f"{Path(temp_input_path).stem}.pdf"
+                if not pdf_path.exists() or pdf_path.stat().st_size == 0:
+                    logger.warning("LibreOffice fallback conversion produced no PDF content")
+                    return None
+
+                return pdf_path.read_bytes()
+            except subprocess.TimeoutExpired:
+                logger.warning("LibreOffice fallback conversion timed out")
+                return None
+            except Exception as e:
+                logger.warning("LibreOffice fallback conversion failed unexpectedly: %s", e)
+                return None
+            finally:
+                try:
+                    os.unlink(temp_input_path)
+                except OSError:
+                    pass
+
+    @staticmethod
+    def _build_deep_pdf_converter() -> DocumentConverter:
+        """Build an uncached Docling converter for expensive fallback parsing."""
+        pipeline_options = PdfPipelineOptions()
+        pipeline_options.do_ocr = True
+        pipeline_options.do_table_structure = True
+
+        try:
+            import easyocr  # noqa: F401
+            from docling.datamodel.pipeline_options import EasyOcrOptions
+
+            pipeline_options.ocr_options = EasyOcrOptions(lang=["en"])
+        except Exception as e:
+            logger.info("Could not configure EasyOCR for deep parse fallback: %s", e)
+
+        try:
+            from docling.datamodel.pipeline_options import TableStructureOptions
+
+            pipeline_options.table_structure_options = TableStructureOptions(mode="accurate")
+        except Exception as e:
+            logger.debug("Could not configure accurate table structure for deep parse fallback: %s", e)
+
+        for attr in ("generate_picture_images", "generate_page_images"):
+            if hasattr(pipeline_options, attr):
+                setattr(pipeline_options, attr, True)
+        if hasattr(pipeline_options, "images_scale"):
+            pipeline_options.images_scale = 2.0
+
+        return DocumentConverter(
+            format_options={
+                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
+            }
+        )
+
     @staticmethod
     def _parse_excel_to_markdown(file: bytes) -> str:
         """Parse XLSX/XLSM to markdown tables using openpyxl directly.
@@ -449,6 +545,38 @@ async def _parse_document_local(self, file: bytes, filename: str) -> str:
             except OSError:
                 pass
 
+    async def _parse_document_local_deep(self, file: bytes, filename: str) -> str:
+        """Parse document with expensive fallbacks after normal parsing produced no chunks."""
+        parse_file = file
+        parse_filename = filename
+        office_suffix = self._office_suffix(filename)
+        if office_suffix:
+            converted_pdf = self._convert_office_to_pdf_bytes(file, office_suffix)
+            if converted_pdf:
+                parse_
```

**File**: `core/services/ingestion_service.py` (modified, +122/-20)
```diff
@@ -1301,22 +1301,56 @@ def img_to_base64_str(self, img: PILImage.Image) -> str:
         img_str, _ = self.img_to_base64_with_bytes(img)
         return img_str
 
+    @staticmethod
+    def _is_blank_image(img: PILImage.Image, tolerance: int = 2) -> bool:
+        """Return True when an image has no meaningful visual variation."""
+        grayscale = img.convert("L")
+        extrema = grayscale.getextrema()
+        if extrema is None:
+            return True
+        darkest, lightest = extrema
+        return lightest - darkest <= tolerance
+
+    def _is_blank_image_bytes(self, image_bytes: bytes, tolerance: int = 2) -> bool:
+        """Return True when image bytes decode to a visually blank image."""
+        if not image_bytes:
+            return True
+        try:
+            with PILImage.open(BytesIO(image_bytes)) as img:
+                return self._is_blank_image(img, tolerance=tolerance)
+        except Exception as e:
+            logger.warning("Unable to inspect rendered page image for blank-content detection: %s", e)
+            return False
+
     def _render_pdf_with_pymupdf(
         self, file_content: bytes, dpi: int, include_bytes: bool = False
     ) -> List[Union[str, Tuple[str, bytes]]]:
         """Render a PDF into base64-encoded PNG images using PyMuPDF."""
         pdf_document = fitz.open("pdf", file_content)
         try:
             images: List[Union[str, Tuple[str, bytes]]] = []
-            for page in pdf_document:
-                mat = fitz.Matrix(dpi / 72, dpi / 72)
-                pix = page.get_pixmap(matrix=mat)
-                png_bytes = pix.tobytes("png")
+            page_count = 0
+            render_failures = 0
+            for page_index, page in enumerate(pdf_document):
+                page_count += 1
+                try:
+                    mat = fitz.Matrix(dpi / 72, dpi / 72)
+                    pix = page.get_pixmap(matrix=mat)
+                    png_bytes = pix.tobytes("png")
+                except Exception as e:
+                    render_failures += 1
+                    logger.warning("Skipping PDF page %d because rendering failed: %s", page_index + 1, e)
+                    continue
+                if self._is_blank_image_bytes(png_bytes):
+                    logger.info("Skipping PDF page %d because it rendered as a blank image", page_index + 1)
+                    continue
                 b64 = bytes_to_data_uri(png_bytes, "image/png")
                 if include_bytes:
                     images.append((b64, png_bytes))
                 else:
                     images.append(b64)
+            if not images and page_count > 0 and render_failures == page_count:
+                raise RuntimeError("All PDF pages failed to render with PyMuPDF")
             return images
         finally:
             pdf_document.close()
@@ -1486,7 +1520,23 @@ def _process_pdf_for_colpali(self, file_content: bytes) -> List[Chunk]:
 
             try:
                 images = pdf2image.convert_from_bytes(file_content, dpi=dpi)
-                image_payloads = [self.img_to_base64_with_bytes(image) for image in images]
+                image_payloads = []
+                for page_num, image in enumerate(images):
+                    try:
+                        if self._is_blank_image(image):
+                            logger.info(
+                                "Skipping PDF page %d because it rendered as a blank image",
+                                page_num + 1,
+                            )
+                            continue
+                        image_payloads.append(self.img_to_base64_with_bytes(image))
+                    except Exception as page_error:
+                        logger.warning(
+                            "Skipping PDF page %d because image conversion failed: %s",
+                            page_num + 1,
+                            page_error,
+                        )
+                        continue
                 logger.info(f"pdf2image fallback processed {len(image_payloads)} pages")
                 return [
                     self._image_bytes_to_chunk(raw_bytes, mime_type="image/png", base64_override=image_b64)
@@ -1517,16 +1567,25 @@ def _render_pdf_with_pymupdf_batched(self, file_content: bytes, dpi: int, batch_
 
         try:
             total_pages = len(pdf_document)
+            render_failures = 0
             for batch_start in range(0, total_pages, batch_size):
                 batch_end = min(batch_start + batch_size, total_pages)
                 logger.debug(f"Rendering pages {batch_start + 1}-{batch_end} of {total_pages} (batched mode)")
 
                 # Render and convert this batch
                 for page_num in range(batch_start, batch_end):
                     page = pdf_document[page_num]
-                    mat = fitz.Matrix(dpi / 72, dpi / 72)
-                    pix = page.get_pixmap(matrix=mat)
-                    png_bytes = pix.tobytes("png")
+ 
```

**File**: `core/tests/unit/test_ingestion_colpali_rendering.py` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+import subprocess
+from io import BytesIO
+from pathlib import Path
+
+from PIL import Image
+
+from core.services import ingestion_service as ingestion_module
+from core.services.ingestion_service import IngestionService
+
+
+class FakePixmap:
+    def __init__(self, image_bytes: bytes):
+        self._image_bytes = image_bytes
+
+    def tobytes(self, format: str) -> bytes:
+        assert format == "png"
+        return self._image_bytes
+
+
+class FakePage:
+    def __init__(self, image_bytes: bytes | None = None, error: Exception | None = None):
+        self._image_bytes = image_bytes
+        self._error = error
+
+    def get_pixmap(self, matrix):
+        if self._error:
+            raise self._error
+        return FakePixmap(self._image_bytes or b"")
+
+
+class FakeDocument:
+    def __init__(self, pages):
+        self.pages = pages
+        self.closed = False
+
+    def __iter__(self):
+        return iter(self.pages)
+
+    def __len__(self):
+        return len(self.pages)
+
+    def __getitem__(self, index):
+        return self.pages[index]
+
+    def close(self):
+        self.closed = True
+
+
+def _png_bytes(color: tuple[int, int, int]) -> bytes:
+    image = Image.new("RGB", (12, 12), color)
+    output = BytesIO()
+    image.save(output, format="PNG")
+    return output.getvalue()
+
+
+def _non_blank_png_bytes() -> bytes:
+    image = Image.new("RGB", (12, 12), "white")
+    image.putpixel((5, 5), (0, 0, 0))
+    output = BytesIO()
+    image.save(output, format="PNG")
+    return output.getvalue()
+
+
+def test_render_pdf_with_pymupdf_skips_blank_and_failed_pages(monkeypatch):
+    service = IngestionService(None, None, None, None, None)
+    fake_document = FakeDocument(
+        [
+            FakePage(_non_blank_png_bytes()),
+            FakePage(error=RuntimeError("bad embedded image")),
+            FakePage(_png_bytes((255, 255, 255))),
+            FakePage(_non_blank_png_bytes()),
+        ]
+    )
+
+    monkeypatch.setattr(ingestion_module.fitz, "open", lambda *args, **kwargs: fake_document)
+
+    rendered_pages = service._render_pdf_with_pymupdf(b"%PDF", dpi=72, include_bytes=True)
+
+    assert len(rendered_pages) == 2
+    assert all(image_b64.startswith("data:image/png;base64,") for image_b64, _ in rendered_pages)
+    assert fake_document.closed is True
+
+
+def test_pdf_pdf2image_fallback_skips_blank_and_failed_pages(monkeypatch):
+    service = IngestionService(None, None, None, None, None)
+    good_page = Image.open(BytesIO(_non_blank_png_bytes()))
+    blank_page = Image.open(BytesIO(_png_bytes((255, 255, 255))))
+    failing_page = Image.open(BytesIO(_non_blank_png_bytes()))
+
+    def fake_img_to_base64_with_bytes(image):
+        if image is failing_page:
+            raise RuntimeError("bad fallback page")
+        return IngestionService.img_to_base64_with_bytes(service, image)
+
+    monkeypatch.setattr(
+        ingestion_module.fitz,
+        "open",
+        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("force pdf2image fallback")),
+    )
+    monkeypatch.setattr(ingestion_module.pdf2image, "convert_from_bytes", lambda *args, **kwargs: [
+        good_page,
+        blank_page,
+        failing_page,
+        good_page,
+    ])
+    monkeypatch.setattr(service, "img_to_base64_with_bytes", fake_img_to_base64_with_bytes)
+
+    chunks = service._process_pdf_for_colpali(b"%PDF")
+
+    assert len(chunks) == 2
+    assert all(chunk.metadata["is_image"] is True for chunk in chunks)
+    assert all(chunk.content.startswith("data:image/png;base64,") for chunk in chunks)
+
+
+def test_office_conversion_skips_blank_and_failed_pages(monkeypatch):
+    service = IngestionService(None, None, None, None, None)
+    fake_document = FakeDocument(
+        [
+            FakePage(_non_blank_png_bytes()),
+            FakePage(error=RuntimeError("bad embedded image")),
+            FakePage(_png_bytes((255, 255, 255))),
+            FakePage(_non_blank_png_bytes()),
+        ]
+    )
+
+    monkeypatch.setattr("shutil.which", lambda name: "/usr/bin/soffice" if name == "soffice" else None)
+    monkeypatch.setattr(ingestion_module.fitz, "open", lambda *args, **kwargs: fake_document)
+
+    def fake_run(cmd, capture_output, text, timeout):
+        output_dir = Path(cmd[cmd.index("--outdir") + 1])
+        input_path = Path(cmd[-1])
+        expected_pdf_path = output_dir / f"{input_path.stem}.pdf"
+        expected_pdf_path.write_bytes(b"%PDF")
+        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
+
+    monkeypatch.setattr("subprocess.run", fake_run)
+
+    chunks = service._convert_office_to_images(b"pptx-bytes", ".pptx", "PowerPoint presentation", [])
+
+    assert len(chunks) == 2
+    assert all(chunk.metadata["is_image"] is True for chunk in chunks)
+    assert all(chunk.content.startswith("data:image/png;base64,") for chunk in chunks)
+    assert fake_document.closed is True
```

**File**: `core/workers/ingestion_worker.py` (modified, +149/-4)
```diff
@@ -5,6 +5,7 @@
 import logging
 import math
 import os
+import re
 import time
 import traceback
 import urllib.parse as up
@@ -23,6 +24,7 @@
 from core.embedding.litellm_embedding import LiteLLMEmbeddingModel
 from core.limits_utils import check_and_increment_limits, estimate_pages_by_chars
 from core.models.auth import AuthContext
+from core.models.chunk import Chunk
 from core.parser.morphik_parser import MorphikParser
 from core.services.ingestion_service import IngestionService, PdfConversionError
 from core.services.telemetry import TelemetryService
@@ -609,8 +611,6 @@ def _meta_resolver():  # noqa: D401
                 )
                 # Clean the extracted text to remove NULL and other problematic control characters
                 # Keep: tabs, newlines, carriage returns, and all printable characters (including Unicode)
-                import re
-
                 # Remove NULL characters
                 text = re.sub(r"\x00", "", text)
                 # Remove control characters (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F) but keep tab, newline, carriage return
@@ -793,9 +793,150 @@ def _meta_resolver():  # noqa: D401
             else:
                 phase_times["multivector_create_chunks"] = 0
 
-            # If we still have no chunks at all (neither text nor image) abort early
+            no_content_extracted = False
+            content_extraction_warning: Optional[str] = None
+
+            if skip_text_parsing and not parsed_chunks and not chunks_multivector:
+                logger.warning(
+                    "No image chunks extracted for ColPali-native document %s (%s). "
+                    "Attempting text extraction fallback before failing ingestion.",
+                    document_id,
+                    original_filename,
+                )
+                fallback_parse_start = time.time()
+                fallback_metadata, fallback_text = await ingestion_service.parser.parse_file_to_text(
+                    file_content, parse_filename
+                )
+
+                fallback_text = re.sub(r"\x00", "", fallback_text)
+                fallback_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", fallback_text)
+                phase_times["fallback_parse_file"] = time.time() - fallback_parse_start
+
+                if fallback_text.strip():
+                    fallback_chunking_start = time.time()
+                    fallback_chunks = await ingestion_service.parser.split_text(fallback_text)
+                    phase_times["fallback_split_into_chunks"] = time.time() - fallback_chunking_start
+                    if fallback_chunks:
+                        parsed_chunks = fallback_chunks
+                        chunks_multivector = [
+                            Chunk(content=chunk.content, metadata=(chunk.metadata | {"is_image": False}))
+                            for chunk in fallback_chunks
+                        ]
+                        text = fallback_text
+                        additional_metadata = fallback_metadata
+                        fallback_updates = {
+                            "additional_metadata": additional_metadata,
+                            "system_metadata": {"content": text},
+                        }
+                        if end_user_id:
+                            fallback_updates["end_user_id"] = end_user_id
+                        await ingestion_service.db.update_document(
+                            document_id=document_id,
+                            updates=fallback_updates,
+                            auth=auth,
+                        )
+                        refreshed_doc = await ingestion_service.db.get_document(document_id, auth)
+                        if refreshed_doc:
+                            doc = refreshed_doc
+                        logger.info(
+                            "Recovered ColPali-native document %s with %d text chunks after image extraction "
+                            "yielded no chunks",
+                            document_id,
+                            len(parsed_chunks),
+                        )
+                    else:
+                        logger.warning(
+                            "Text fallback for ColPali-native document %s produced no chunks",
+                            document_id,
+                        )
+                else:
+                    logger.warning(
+                        "Text fallback for ColPali-native document %s produced no text",
+                        document_id,
+                    )
+
+            if not parsed_chunks and not chunks_multivector and not xml_processing:
+                deep_parse = getattr(ingestion_service.parser, "parse_file_to_text_deep", None)
+                if callable(deep_parse):
+                    logger.warning(
+                        "No chunks extracted for document %s (%s). Running deep parser fallback.",
+                        document_id,
+                        original_filename,
```

---

### Incident Patch 6: `ee9d007b` (2026-05-10)
**Commit Message**: Fix: re-probe unhealthy ColPali endpoints after cooldown (#398)

Previously, when an endpoint failed once it was discarded from
healthy_endpoints and only re-added if ALL endpoints failed at
the same time. A single transient OOM on one of N endpoints could
silently halve sustained ingestion throughput until the worker
process restarted.

Now each endpoint is timestamped when marked unhealthy and
re-included after a 60s cooldown. If it's still failing, the
existing failure path will mark it unhealthy again — no change
to error semantics.

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `core/embedding/colpali_api_embedding_model.py` (modified, +22/-0)
```diff
@@ -51,10 +51,27 @@ def __init__(self):
 
         # Track endpoint health for failover
         self.healthy_endpoints: set[str] = set(self.endpoints)
+        self._endpoint_unhealthy_since: Dict[str, float] = {}
+        self._unhealthy_recovery_seconds: float = 60.0
         self._endpoint_latencies: dict[str, float] = {}
         self.endpoint = self.endpoints[0]
         self._latest_ingest_metrics: Dict[str, float] = {}
 
+    def _recover_endpoints(self) -> None:
+        """Re-include endpoints whose unhealthy cooldown has elapsed."""
+        if not self._endpoint_unhealthy_since:
+            return
+        now = time.monotonic()
+        recovered = [
+            ep
+            for ep, marked_at in self._endpoint_unhealthy_since.items()
+            if now - marked_at >= self._unhealthy_recovery_seconds
+        ]
+        for ep in recovered:
+            self.healthy_endpoints.add(ep)
+            self._endpoint_unhealthy_since.pop(ep, None)
+            logger.info("Re-probing previously unhealthy ColPali endpoint: %s", ep)
+
     async def embed_for_ingestion(self, chunks: Union[Chunk, List[Chunk]]) -> List[MultiVector]:
         ingest_start = time.monotonic()
         # Normalize to list
@@ -131,6 +148,7 @@ async def _embed_inputs_distributed(
         if not indexed_inputs:
             return {}
 
+        self._recover_endpoints()
         # Use healthy endpoints, fall back to all if none healthy
         endpoints = list(self.healthy_endpoints) if self.healthy_endpoints else self.endpoints
         n_endpoints = len(endpoints)
@@ -166,6 +184,7 @@ async def _embed_inputs_distributed(
             elif isinstance(result, Exception):
                 logger.warning(f"Endpoint {endpoint} failed: {result}")
                 self.healthy_endpoints.discard(endpoint)
+                self._endpoint_unhealthy_since[endpoint] = time.monotonic()
                 failed_inputs.extend(batch)
             else:
                 merged.update(result)
@@ -182,6 +201,7 @@ async def _embed_inputs_distributed(
                 # All endpoints failed, reset health and raise
                 logger.error("All ColPali endpoints failed, resetting health status")
                 self.healthy_endpoints = set(self.endpoints)
+                self._endpoint_unhealthy_since.clear()
                 raise RuntimeError(
                     f"All {len(self.endpoints)} ColPali endpoints failed for {len(failed_inputs)} {input_type} inputs"
                 )
@@ -289,6 +309,7 @@ async def _call_api_endpoint(self, endpoint: str, inputs: List[str], input_type:
 
     async def embed_for_query(self, text: str) -> MultiVector:
         # Use first healthy endpoint for queries (single text, fast)
+        self._recover_endpoints()
         endpoint = next(iter(self.healthy_endpoints), self.endpoints[0])
         data = await self._call_api_endpoint(endpoint, [text], "text")
         if not data:
@@ -304,6 +325,7 @@ async def generate_embeddings(self, content: Union[str, Image]) -> np.ndarray:
         Returns:
             numpy array of embeddings.
         """
+        self._recover_endpoints()
         endpoint = next(iter(self.healthy_endpoints), self.endpoints[0])
 
         if isinstance(content, Image):
```

---

### Incident Patch 7: `6fdfe258` (2026-04-02)
**Commit Message**: Fix: add retry logic to LiteLLM embedding for transient 500 errors (#396)

* Add retry logic to LiteLLM embedding calls for transient errors

The embedding path lacked num_retries, causing OpenAI 500 errors to
propagate as unhandled exceptions. The completion path already uses
num_retries=3; this aligns embedding to match.

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

* Fix CI docker-build by adding PostgreSQL and Redis containers

The test was running the Morphik container standalone without any
database or cache, causing the entrypoint to timeout waiting for
PostgreSQL. Now spins up pgvector and Redis containers in a shared
Docker network, fixes the POSTGRES_URI scheme, and disables ColPali
to avoid loading ML models in CI.

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

* Fix MORPHIK_EMBEDDING_API_DOMAIN validation error in CI docker-build

The Settings model expects a list[str] for MORPHIK_EMBEDDING_API_DOMAIN
but the CI test config provided a plain string. Fixed by:
1. Using a list in the CI test TOML config
2. Adding a defensive str-to-list coercion in config.py for robustness

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL

**File**: `.github/workflows/docker-build.yml` (modified, +49/-5)
```diff
@@ -182,11 +182,11 @@ jobs:
           colpali_pdf_dpi = 150
 
           [morphik]
-          enable_colpali = true
+          enable_colpali = false
           mode = "self_hosted"
           use_local_env = true
           api_domain = "api.morphik.ai"
-          morphik_embedding_api_domain = "http://localhost:6000"
+          morphik_embedding_api_domain = ["http://localhost:6000"]
           colpali_mode = "local"
 
           [pdf_viewer]
@@ -203,9 +203,47 @@ jobs:
           max_local_bytes = 1073741824
           EOF
 
+          # Create a Docker network for the test
+          docker network create test-net
+
+          # Start PostgreSQL container with pgvector
+          PG_CONTAINER=$(docker run -d --name postgres --network test-net \
+            -e POSTGRES_USER=morphik \
+            -e POSTGRES_PASSWORD=morphik \
+            -e POSTGRES_DB=morphik \
+            pgvector/pgvector:pg16)
+
+          # Start Redis container
+          REDIS_CONTAINER=$(docker run -d --name redis --network test-net redis:7-alpine)
+          echo "Started Redis container: $REDIS_CONTAINER"
+
+          echo "Started PostgreSQL container: $PG_CONTAINER"
+
+          # Wait for PostgreSQL to be ready
+          pg_timeout=30
+          pg_elapsed=0
+          echo "Waiting for PostgreSQL to be ready..."
+          while [ $pg_elapsed -lt $pg_timeout ]; do
+            if docker exec postgres pg_isready -U morphik -d morphik > /dev/null 2>&1; then
+              echo "✅ PostgreSQL is ready"
+              break
+            fi
+            sleep 1
+            pg_elapsed=$((pg_elapsed + 1))
+          done
+
+          if [ $pg_elapsed -ge $pg_timeout ]; then
+            echo "❌ PostgreSQL failed to start within ${pg_timeout} seconds"
+            docker logs postgres
+            docker rm -f postgres redis
+            docker network rm test-net
+            exit 1
+          fi
+
           # Start container in detached mode with config mounted
-          CONTAINER_ID=$(docker run -d -p 8000:8000 \
-            -e POSTGRES_URI="postgresql://morphik:morphik@localhost:5432/morphik" \
+          CONTAINER_ID=$(docker run -d --network test-net -p 8000:8000 \
+            -e POSTGRES_URI="postgresql+asyncpg://morphik:morphik@postgres:5432/morphik" \
+            -e PGPASSWORD="morphik" \
             -v "$(pwd)/morphik.toml.test:/app/morphik.toml" \
             "$IMAGE_TAG")
 
@@ -235,6 +273,8 @@ jobs:
             docker logs "$CONTAINER_ID"
             docker stop "$CONTAINER_ID"
             docker rm "$CONTAINER_ID"
+            docker rm -f postgres redis
+            docker network rm test-net
             exit 1
           fi
 
@@ -247,11 +287,15 @@ jobs:
             docker logs "$CONTAINER_ID"
             docker stop "$CONTAINER_ID"
             docker rm "$CONTAINER_ID"
+            docker rm -f postgres redis
+            docker network rm test-net
             exit 1
           fi
 
           # Clean up
-          echo "🧹 Cleaning up container"
+          echo "🧹 Cleaning up containers"
           docker stop "$CONTAINER_ID"
           docker rm "$CONTAINER_ID"
+          docker rm -f postgres redis
+          docker network rm test-net
           echo "✅ Test completed successfully"
```

**File**: `core/config.py` (modified, +2/-0)
```diff
@@ -372,6 +372,8 @@ def get_settings() -> Settings:
     api_domain = config["morphik"].get("api_domain", "api.morphik.ai")
     # morphik_embedding_api_domain is always a list of endpoints
     embedding_api_endpoints = config["morphik"].get("morphik_embedding_api_domain", [f"https://{api_domain}"])
+    if isinstance(embedding_api_endpoints, str):
+        embedding_api_endpoints = [embedding_api_endpoints]
     secret_manager = config["morphik"].get("secret_manager", "env")
 
     settings_dict.update(
```

**File**: `core/embedding/litellm_embedding.py` (modified, +2/-2)
```diff
@@ -77,8 +77,8 @@ async def embed_documents(self, texts: List[str]) -> List[List[float]]:
                 # Use a harmless placeholder; some LiteLLM providers demand a key even if backend ignores it
                 model_params["api_key"] = get_settings().LITELLM_DUMMY_API_KEY
 
-            # Call LiteLLM
-            response = await litellm.aembedding(input=texts, **model_params)
+            # Call LiteLLM with retries for transient provider errors (e.g. OpenAI 500s)
+            response = await litellm.aembedding(input=texts, num_retries=3, **model_params)
 
             embeddings = [data["embedding"] for data in response.data]
 
```

---

### Incident Patch 8: `fabe74df` (2026-02-05)
**Commit Message**: Fix fake 404 (#367)

* Fix incorrect 404 errors when searchinf by filename

* Increase office timeout to 300

**File**: `core/routes/documents.py` (modified, +2/-1)
```diff
@@ -288,7 +288,8 @@ async def get_document_by_filename(
             raise HTTPException(status_code=404, detail=f"Document with filename '{filename}' not found")
         return doc
     except HTTPException as e:
-        logger.error(f"Error getting document by filename: {e}")
+        if e.status_code >= 500:
+            logger.error(f"Error getting document by filename: {e}")
         raise e
 
 
```

**File**: `core/services/ingestion_service.py` (modified, +1/-1)
```diff
@@ -1623,7 +1623,7 @@ def _convert_office_to_images(
                 ],
                 capture_output=True,
                 text=True,
-                timeout=90,
+                timeout=300,
             )
 
             if result.returncode != 0:
```

---

### Incident Patch 9: `0b06ae26` (2026-01-27)
**Commit Message**: fix set statement in probes (#365)

**File**: `core/vector_store/chunk_v2_store.py` (modified, +4/-2)
```diff
@@ -399,8 +399,10 @@ async def query_similar(
             )
 
             async with self.get_session_with_retry() as session:
-                # PostgreSQL SET doesn't support parameterized values; safe since ivfflat_probes is a validated int
-                await session.execute(text(f"SET LOCAL ivfflat.probes = {self.ivfflat_probes}"))
+                # Use set_config() for parameterized config - SET doesn't support parameters
+                await session.execute(
+                    text("SELECT set_config('ivfflat.probes', :probes, true)"), {"probes": str(self.ivfflat_probes)}
+                )
                 result = await session.execute(query)
                 rows = result.all()
 
```

**File**: `core/vector_store/pgvector_store.py` (modified, +4/-2)
```diff
@@ -458,8 +458,10 @@ async def query_similar(
         """
         try:
             async with self.get_session_with_retry() as session:
-                # PostgreSQL SET doesn't support parameterized values; safe since ivfflat_probes is a validated int
-                await session.execute(text(f"SET LOCAL ivfflat.probes = {self.ivfflat_probes}"))
+                # Use set_config() for parameterized config - SET doesn't support parameters
+                await session.execute(
+                    text("SELECT set_config('ivfflat.probes', :probes, true)"), {"probes": str(self.ivfflat_probes)}
+                )
                 # Build query with cosine distance calculation, which is normalized to [0, 2].
                 # A distance of 0 is perfect similarity.
                 distance = VectorEmbedding.embedding.op("<=>")(query_embedding)
```

---

### Incident Patch 10: `307d592c` (2026-01-27)
**Commit Message**: fix ivfflat probing on query time (#364)

**File**: `core/vector_store/chunk_v2_store.py` (modified, +2/-1)
```diff
@@ -399,7 +399,8 @@ async def query_similar(
             )
 
             async with self.get_session_with_retry() as session:
-                await session.execute(text("SET LOCAL ivfflat.probes = :probes"), {"probes": self.ivfflat_probes})
+                # PostgreSQL SET doesn't support parameterized values; safe since ivfflat_probes is a validated int
+                await session.execute(text(f"SET LOCAL ivfflat.probes = {self.ivfflat_probes}"))
                 result = await session.execute(query)
                 rows = result.all()
 
```

**File**: `core/vector_store/pgvector_store.py` (modified, +2/-1)
```diff
@@ -458,7 +458,8 @@ async def query_similar(
         """
         try:
             async with self.get_session_with_retry() as session:
-                await session.execute(text("SET LOCAL ivfflat.probes = :probes"), {"probes": self.ivfflat_probes})
+                # PostgreSQL SET doesn't support parameterized values; safe since ivfflat_probes is a validated int
+                await session.execute(text(f"SET LOCAL ivfflat.probes = {self.ivfflat_probes}"))
                 # Build query with cosine distance calculation, which is normalized to [0, 2].
                 # A distance of 0 is perfect similarity.
                 distance = VectorEmbedding.embedding.op("<=>")(query_embedding)
```

---

### Incident Patch 11: `3017f9de` (2026-01-19)
**Commit Message**: Add file name filtering in list docs and fix http2 issues in pysdk (#345)

**File**: `core/database/metadata_filters.py` (modified, +273/-0)
```diff
@@ -29,6 +29,10 @@ class InvalidMetadataFilterError(ValueError):
 class MetadataFilterBuilder:
     """Translate JSON-style metadata filters into SQL, covering arrays, regex, and substring operators."""
 
+    _COLUMN_FIELDS = {
+        "filename": "filename",
+    }
+
     def build(self, filters: Optional[Dict[str, Any]]) -> str:
         """Construct a SQL WHERE clause from a metadata filter dictionary."""
         if filters is None:
@@ -109,6 +113,9 @@ def _combine_clauses(self, clauses: List[str], operator: str, context: str) -> s
 
     def _build_field_metadata_clause(self, field: str, value: Any) -> str:
         """Build SQL clause for a single metadata field."""
+        if field in self._COLUMN_FIELDS:
+            return self._build_column_field_clause(field, value)
+
         if isinstance(value, dict) and not any(key.startswith("$") for key in value):
             # Treat as literal JSON sub-document match
             return self._jsonb_contains_clause(field, value)
@@ -183,6 +190,25 @@ def _build_single_value_clause(self, field: str, value: Any) -> str:
 
         return self._jsonb_contains_clause(field, value)
 
+    def _build_column_field_clause(self, field: str, value: Any) -> str:
+        """Build SQL clause for a reserved column field (e.g., filename)."""
+        column = self._COLUMN_FIELDS[field]
+        builder = TextColumnFilterBuilder(column)
+
+        if isinstance(value, dict):
+            if not value:
+                raise InvalidMetadataFilterError(f"{field} filter cannot be empty.")
+            if any(key.startswith("$") for key in value):
+                return builder.build(value)
+            raise InvalidMetadataFilterError(
+                f"{field} filter must use operators (e.g., {{'{field}': {{'$eq': 'example.pdf'}}}})."
+            )
+
+        if isinstance(value, list):
+            return builder._build_in_clause(value, negate=False)
+
+        return builder._build_comparison_clause("$eq", value)
+
     def _build_exists_clause(self, field: str, operand: Any) -> str:
         """Build clause handling $exists operator."""
         expected = operand
@@ -554,3 +580,250 @@ def _coerce_datetime_string(self, operand: Any, field: str, is_date: bool) -> st
     def _escape_single_quotes(value: str) -> str:
         """Escape single quotes for SQL literals."""
         return value.replace("'", "''")
+
+
+class TextColumnFilterBuilder:
+    """Translate filter expressions into SQL for a single text column."""
+
+    def __init__(self, column: str):
+        self._column = column
+
+    def build(self, filters: Optional[Dict[str, Any]]) -> str:
+        """Construct a SQL WHERE clause from a filter dictionary."""
+        if filters is None:
+            return ""
+
+        if not isinstance(filters, dict):
+            raise InvalidMetadataFilterError("Filename filters must be provided as a JSON object.")
+
+        if not filters:
+            return ""
+
+        clause = self._parse_filter(filters, context="filename filter")
+        if not clause:
+            raise InvalidMetadataFilterError("Filename filter produced no valid conditions.")
+        return clause
+
+    def _parse_filter(self, expression: Any, context: str) -> str:
+        """Recursively parse an operator filter into SQL."""
+        if isinstance(expression, dict):
+            if not expression:
+                raise InvalidMetadataFilterError(f"{context.capitalize()} cannot be empty.")
+
+            clauses: List[str] = []
+            for key, value in expression.items():
+                if key == "$and":
+                    if not isinstance(value, list):
+                        raise InvalidMetadataFilterError("$and operator expects a non-empty list of conditions.")
+                    clauses.append(
+                        self._combine_clauses(
+                            [self._parse_filter(item, context="$and condition") for item in value],
+                            "AND",
+                            'operator "$and"',
+                        )
+                    )
+                elif key == "$or":
+                    if not isinstance(value, list):
+                        raise InvalidMetadataFilterError("$or operator expects a non-empty list of conditions.")
+                    clauses.append(
+                        self._combine_clauses(
+                            [self._parse_filter(item, context="$or condition") for item in value],
+                            "OR",
+                            'operator "$or"',
+                        )
+                    )
+                elif key == "$nor":
+                    if not isinstance(value, list):
+                        raise InvalidMetadataFilterError("$nor operator expects a non-empty list of conditions.")
+                    inner = self._combine_clauses(
+                        [self._parse_filter(item, context="$nor condition") for item in value],
+                        "OR",
+     
```

**File**: `core/models/request.py` (modified, +5/-12)
```diff
@@ -16,23 +16,16 @@ class OutputFormat(str, Enum):
     TEXT = "text"
 
 
-class ListDocumentsRequest(BaseModel):
-    """Request model for listing documents"""
-
-    document_filters: Optional[Dict[str, Any]] = Field(
-        None,
-        description="Metadata filters with operator support: $and, $or, $nor, $not, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $type, $regex, $contains. Implicit equality uses JSONB containment; explicit operators support typed comparisons.",
-    )
-    skip: int = Field(default=0, ge=0, description="Number of documents to skip before returning results.")
-    limit: int = Field(default=1000, gt=0, description="Maximum number of documents to return.")
-
-
 class ListDocsRequest(BaseModel):
     """Flexible request model for listing documents with projection and aggregates."""
 
     document_filters: Optional[Dict[str, Any]] = Field(
         None,
-        description="Metadata filters with operator support: $and, $or, $nor, $not, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $type, $regex, $contains. Implicit equality uses JSONB containment; explicit operators support typed comparisons.",
+        description=(
+            "Metadata filters with operator support: $and, $or, $nor, $not, $eq, $ne, $gt, $gte, $lt, $lte, "
+            "$in, $nin, $exists, $type, $regex, $contains. Implicit equality uses JSONB containment; explicit "
+            "operators support typed comparisons. Reserved key: 'filename' filters the filename column."
+        ),
     )
     skip: int = Field(default=0, ge=0, description="Number of documents to skip")
     limit: int = Field(default=100, ge=0, description="Maximum number of documents to return")
```

**File**: `core/routes/documents.py` (modified, +11/-58)
```diff
@@ -11,13 +11,7 @@
 from core.dependencies import get_redis_pool
 from core.models.auth import AuthContext
 from core.models.documents import Document
-from core.models.request import (
-    DocumentPagesRequest,
-    IngestTextRequest,
-    ListDocsRequest,
-    ListDocumentsRequest,
-    MetadataUpdateRequest,
-)
+from core.models.request import DocumentPagesRequest, IngestTextRequest, ListDocsRequest, MetadataUpdateRequest
 from core.models.responses import (
     DocumentDeleteResponse,
     DocumentDownloadUrlResponse,
@@ -52,60 +46,12 @@
 # ---------------------------------------------------------------------------
 
 
-@router.post("", response_model=List[Document])
-async def list_documents(
-    request: ListDocumentsRequest,
-    auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
-    folder_depth: Optional[int] = Query(
-        None,
-        description="Folder scope depth: 0/None = exact, -1 = all descendants, n > 0 = include descendants up to n levels.",
-    ),
-    end_user_id: Optional[str] = Query(None),
-):
-    """
-    List accessible documents with metadata filtering.
-
-    **Supported operators**: `$and`, `$or`, `$nor`, `$not`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`,
-    `$in`, `$nin`, `$exists`, `$type`, `$regex`, `$contains`.
-
-    **Implicit equality** (backwards compatible):
-    ```json
-    {"status": "active"}
-    ```
-    Uses JSONB containment, matches scalars inside arrays, JSON-serializable types only.
-
-    **Explicit operators** (typed comparisons):
-    ```json
-    {"priority": {"$eq": 42}, "created_date": {"$gte": "2024-01-01T00:00:00Z"}}
-    ```
-    Supports typed metadata (number, decimal, datetime, date) with safe casting.
-    """
-    # Create system filters for folder and user scoping
-    system_filters = {}
-
-    if folder_name is not None:
-        try:
-            system_filters.update(document_service._build_folder_scope_filters(folder_name, folder_depth))
-        except ValueError as exc:
-            raise HTTPException(status_code=400, detail=str(exc))
-    if end_user_id:
-        system_filters["end_user_id"] = end_user_id
-    # Note: auth.app_id is already handled in _build_access_filter_optimized
-
-    try:
-        return await document_service.db.get_documents(
-            auth, request.skip, request.limit, filters=request.document_filters, system_filters=system_filters
-        )
-    except InvalidMetadataFilterError as exc:
-        raise HTTPException(status_code=400, detail=str(exc))
-
-
+@router.post("", response_model=ListDocsResponse)
 @router.post("/list_docs", response_model=ListDocsResponse)
 async def list_docs(
     request: ListDocsRequest,
     auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
+    folder_name: Optional[Union[str, List[str]]] = Query(None, openapi_extra={"style": "form", "explode": True}),
     folder_depth: Optional[int] = Query(
         None,
         description="Folder scope depth: 0/None = exact, -1 = all descendants, n > 0 = include descendants up to n levels.",
@@ -115,6 +61,8 @@ async def list_docs(
     """
     Flexible document listing with aggregates, projections, and advanced pagination.
 
+    Alias: `/documents` and `/documents/list_docs` share this handler.
+
     **Supported operators**: `$and`, `$or`, `$nor`, `$not`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`,
     `$in`, `$nin`, `$exists`, `$type`, `$regex`, `$contains`.
 
@@ -128,6 +76,11 @@ async def list_docs(
     {"priority": {"$gte": 40}, "end_date": {"$lt": "2025-01-01"}}
     ```
 
+    Use `document_filters` with a `filename` key to filter the filename column:
+    ```json
+    {"filename": {"$regex": {"pattern": "^report_.*\\.pdf$", "flags": "i"}}}
+    ```
+
     Use `folder_name` and `end_user_id` query parameters to scope system metadata.
     """
     try:
@@ -308,7 +261,7 @@ async def delete_document(document_id: str, auth: AuthContext = Depends(verify_t
 async def get_document_by_filename(
     filename: str,
     auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
+    folder_name: Optional[Union[str, List[str]]] = Query(None, openapi_extra={"style": "form", "explode": True}),
     folder_depth: Optional[int] = Query(
         None,
         description="Folder scope depth: 0/None = exact, -1 = all descendants, n > 0 = include descendants up to n levels.",
```

**File**: `core/routes/graph.py` (modified, +4/-4)
```diff
@@ -134,7 +134,7 @@ async def _build_graph_async():
 async def get_graph(
     name: str,
     auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
+    folder_name: Optional[Union[str, List[str]]] = Query(None, openapi_extra={"style": "form", "explode": True}),
     folder_depth: Optional[int] = Query(
         None,
         description="Folder scope depth: 0/None exact, -1 all descendants, n>0 include descendants up to n levels.",
@@ -174,7 +174,7 @@ async def get_graph(
 @telemetry.track(operation_type="list_graphs", metadata_resolver=telemetry.list_graphs_metadata)
 async def list_graphs(
     auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
+    folder_name: Optional[Union[str, List[str]]] = Query(None, openapi_extra={"style": "form", "explode": True}),
     folder_depth: Optional[int] = Query(
         None,
         description="Folder scope depth: 0/None exact, -1 all descendants, n>0 include descendants up to n levels.",
@@ -213,7 +213,7 @@ async def list_graphs(
 async def get_graph_visualization(
     name: str,
     auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
+    folder_name: Optional[Union[str, List[str]]] = Query(None, openapi_extra={"style": "form", "explode": True}),
     folder_depth: Optional[int] = Query(
         None,
         description="Folder scope depth: 0/None exact, -1 all descendants, n>0 include descendants up to n levels.",
@@ -343,7 +343,7 @@ async def delete_graph(
 async def get_graph_status(
     name: str,
     auth: AuthContext = Depends(verify_token),
-    folder_name: Optional[Union[str, List[str]]] = Query(None),
+    folder_name: Optional[Union[str, List[str]]] = Query(None, openapi_extra={"style": "form", "explode": True}),
     folder_depth: Optional[int] = Query(
         None,
         description="Folder scope depth: 0/None exact, -1 all descendants, n>0 include descendants up to n levels.",
```

**File**: `core/services/ingestion_service.py` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ class IngestionService:
         "folder_id",
         "folder_path",
         "external_id",
+        "filename",
         "app_id",
         "owner_id",
         "end_user_id",
```

**File**: `core/tests/unit/test_metadata_filters.py` (modified, +20/-0)
```diff
@@ -74,6 +74,26 @@ def test_not_operator(self):
         assert "NOT" in sql
         assert "status" in sql
 
+    def test_filename_column_eq(self):
+        """Filename filters should target the filename column."""
+        builder = MetadataFilterBuilder()
+        filters = {"filename": {"$eq": "report.pdf"}}
+        sql = builder.build(filters)
+
+        assert "filename" in sql
+        assert "report.pdf" in sql
+        assert "doc_metadata" not in sql
+
+    def test_filename_or_metadata(self):
+        """Filename filters should compose with metadata filters."""
+        builder = MetadataFilterBuilder()
+        filters = {"$or": [{"filename": {"$regex": "report"}}, {"status": "active"}]}
+        sql = builder.build(filters)
+
+        assert "OR" in sql
+        assert "filename" in sql
+        assert "doc_metadata" in sql
+
 
 class TestComparisonOperators:
     """Test new comparison operators for typed metadata."""
```

**File**: `scripts/sanity_test.sh` (modified, +46/-7)
```diff
@@ -358,7 +358,7 @@ wait_for_processing() {
         status_counts=$(echo "$response" | python3 -c "
 import sys, json
 from collections import Counter
-docs = json.load(sys.stdin)
+docs = json.load(sys.stdin).get('documents', [])
 statuses = Counter(d.get('system_metadata', {}).get('status', 'unknown') for d in docs)
 print(f\"total={len(docs)} completed={statuses.get('completed',0)} processing={statuses.get('processing',0)} failed={statuses.get('failed',0)}\")
 " 2>/dev/null) || status_counts="error"
@@ -965,7 +965,7 @@ wait_for_folder_docs_processing() {
         status_counts=$(echo "$response" | python3 -c "
 import sys, json
 from collections import Counter
-docs = json.load(sys.stdin)
+docs = json.load(sys.stdin).get('documents', [])
 statuses = Counter(d.get('system_metadata', {}).get('status', 'unknown') for d in docs)
 print(f'total={len(docs)} completed={statuses.get(\"completed\",0)} processing={statuses.get(\"processing\",0)}')
 " 2>/dev/null) || status_counts="error"
@@ -999,7 +999,7 @@ test_folder_depth_filtering() {
         return
     }
 
-    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null) || count=0
+    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('documents', [])))" 2>/dev/null) || count=0
     if [[ "$count" -eq 1 ]]; then
         log_success "folder_depth=0 returned $count doc (expected 1 from /sanity_test only)"
     else
@@ -1015,7 +1015,7 @@ test_folder_depth_filtering() {
         return
     }
 
-    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null) || count=0
+    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('documents', [])))" 2>/dev/null) || count=0
     # /sanity_test (1) + /sanity_test/level1 (1) + /sanity_test/sibling (1) = 3
     if [[ "$count" -eq 3 ]]; then
         log_success "folder_depth=1 returned $count docs (expected 3)"
@@ -1032,7 +1032,7 @@ test_folder_depth_filtering() {
         return
     }
 
-    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null) || count=0
+    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('documents', [])))" 2>/dev/null) || count=0
     # All 5 docs: /sanity_test, /level1, /level2, /level3, /sibling
     if [[ "$count" -eq 5 ]]; then
         log_success "folder_depth=-1 returned $count docs (expected 5 - all descendants)"
@@ -1049,7 +1049,7 @@ test_folder_depth_filtering() {
         return
     }
 
-    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null) || count=0
+    count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('documents', [])))" 2>/dev/null) || count=0
     # /sanity_test (1) + /level1 (1) + /sibling (1) + /level2 (1) = 4
     if [[ "$count" -eq 4 ]]; then
         log_success "folder_depth=2 returned $count docs (expected 4)"
@@ -1233,7 +1233,8 @@ EOF
 import sys, json, os
 expected_id = sys.argv[1]
 expected_path = sys.argv[2]
-docs = json.loads(os.environ["DOC_DATA"])
+raw = json.loads(os.environ["DOC_DATA"])
+docs = raw.get("documents", []) if isinstance(raw, dict) else raw
 if not docs:
     print("missing")
     sys.exit(0)
@@ -1761,6 +1762,44 @@ test_document_management_and_updates() {
         log_error "list_docs returned no documents"
     fi
 
+    # list_docs filename filters via document_filters
+    # Use batch_file2 (index 1) since batch_file1 (index 0) gets renamed by update_file test above
+    local filename_target="test_document.txt"
+    if [[ ${#BATCH_FILENAMES[@]} -gt 1 ]]; then
+        filename_target="${BATCH_FILENAMES[1]}"
+    elif [[ ${#BATCH_FILENAMES[@]} -gt 0 ]]; then
+        filename_target="${BATCH_FILENAMES[0]}"
+    fi
+
+    log_info "Test: /documents/list_docs filename filters"
+    response=$(curl -sf -X POST "$BASE_URL/documents/list_docs" \
+        -H "Content-Type: application/json" \
+        -d "{\"document_filters\": {\"\$and\": [{\"test_run_id\": \"$TEST_RUN_ID\"}, {\"filename\": {\"\$eq\": \"$filename_target\"}}]}, \"skip\": 0, \"limit\": 5, \"include_total_count\": true}" 2>&1) || {
+        log_error "/documents/list_docs filename filter request failed"
+    }
+    local filename_count
+    filename_count=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_count',0))" 2>/dev/null) || filename_count=0
+    if [[ "$filename_count" -gt 0 ]]; then
+        log_success "list_docs filename filter matched $filename_count document(s) for $filename_target"
+    else
+        log_error "list_docs filename filter returned no documents for $filename_target"
+    fi
+
+    # list_docs filename regex with OR conditions
+    log_info "Test: /documents/list_docs filename regex with OR"
+    response=$(curl -sf -X POST "$BASE_URL/documents/list_docs" \
+        -H "Content-Ty
```

**File**: `sdks/python/morphik/async_.py` (modified, +130/-45)
```diff
@@ -3,6 +3,7 @@
 from io import BytesIO
 from pathlib import Path
 from typing import Any, BinaryIO, Callable, Dict, List, Literal, Optional, Type, Union
+from urllib.parse import quote
 
 import httpx
 from pydantic import BaseModel
@@ -11,6 +12,7 @@
 from ._scoped_ops import _ScopedOperationsMixin
 from .models import CompletionResponse  # Prompt override models
 from .models import (
+    AppStorageUsageResponse,
     ChunkSource,
     Document,
     DocumentPagesResponse,
@@ -509,7 +511,7 @@ async def list_documents(
         Args:
             skip: Number of documents to skip
             limit: Maximum number of documents to return
-            filters: Optional filters
+            filters: Optional filters (use key "filename" to filter the filename column via $and/$or)
             additional_folders: Optional list of additional folder names to further scope operations
             folder_depth: Optional folder scope depth (None/0 exact, -1 descendants, n>0 include up to n levels)
             include_total_count: Include total count of matching documents
@@ -518,7 +520,6 @@ async def list_documents(
             completed_only: Only return completed documents
             sort_by: Field to sort by (created_at, updated_at, filename, external_id)
             sort_direction: Sort direction (asc, desc)
-
         Returns:
             ListDocsResponse: Response with documents and metadata
         """
@@ -614,8 +615,8 @@ async def create_graph(
             name, filters, documents, prompt_overrides, self.full_path, None
         )
         response = await self._client._request("POST", "graph/create", data=request)
-        graph = self._logic._parse_graph_response(response)
-        graph._client = self  # Attach AsyncMorphik client for polling helpers
+        graph = self._client._logic._parse_graph_response(response)
+        graph._client = self._client
         return graph
 
     async def update_graph(
@@ -644,10 +645,22 @@ async def update_graph(
             name, additional_filters, additional_documents, prompt_overrides, self.full_path, None
         )
         response = await self._client._request("POST", f"graph/{name}/update", data=request)
-        graph = self._logic._parse_graph_response(response)
-        graph._client = self
+        graph = self._client._logic._parse_graph_response(response)
+        graph._client = self._client
         return graph
 
+    async def get_document_by_filename(self, filename: str) -> Document:
+        """
+        Get document metadata by filename within this folder.
+
+        Args:
+            filename: Filename of the document to retrieve
+
+        Returns:
+            Document: Document metadata
+        """
+        return await self._client.get_document_by_filename(filename, folder_name=self.full_path)
+
     async def delete_document_by_filename(self, filename: str) -> Dict[str, str]:
         """
         Delete a document by its filename within this folder.
@@ -658,13 +671,7 @@ async def delete_document_by_filename(self, filename: str) -> Dict[str, str]:
         Returns:
             Dict[str, str]: Deletion status
         """
-        # First get the document ID
-        response = await self._client._request(
-            "GET", f"documents/filename/{filename}", params={"folder_name": self.full_path}
-        )
-        doc = self._client._logic._parse_document_response(response)
-
-        # Then delete by ID
+        doc = await self.get_document_by_filename(filename)
         return await self._client.delete_document(doc.external_id)
 
     # Helper --------------------------------------------------------------
@@ -1054,7 +1061,7 @@ async def list_documents(
         Args:
             skip: Number of documents to skip
             limit: Maximum number of documents to return
-            filters: Optional filters
+            filters: Optional filters (use key "filename" to filter the filename column via $and/$or)
             additional_folders: Optional list of extra folders to include in the scope
             folder_depth: Optional folder scope depth (None/0 exact, -1 descendants, n>0 include up to n levels)
             include_total_count: Include total count of matching documents
@@ -1063,7 +1070,6 @@ async def list_documents(
             completed_only: Only return completed documents
             sort_by: Field to sort by (created_at, updated_at, filename, external_id)
             sort_direction: Sort direction (asc, desc)
-
         Returns:
             ListDocsResponse: Response with documents and metadata
         """
@@ -1160,8 +1166,8 @@ async def create_graph(
             name, filters, documents, prompt_overrides, self._folder_name, self._end_user_id
         )
         response = await self._client._request("POST", "graph/create", data=request)
-        graph = self._logic._parse_graph_response(response)
-        graph._client = self
+        graph = self._client._logic._parse_graph_response(response)
+  
```

---

### Incident Patch 12: `0bc3910c` (2025-12-29)
**Commit Message**: Fix LLM config merging, chat history storage bugs, and DRY-refactor ingestion routes (#334)

**File**: `core/api.py` (modified, +28/-13)
```diff
@@ -819,10 +819,15 @@ async def wrapped():
             # Chat history storage for non-streaming responses
             perf.start_phase("chat_history_storage")
             if history_key:
+                # Handle structured completions (Pydantic models) for chat history storage
+                # Convert to JSON string since chat_history.content must be a string
+                completion_content = response.completion
+                if hasattr(completion_content, "model_dump"):
+                    completion_content = json.dumps(completion_content.model_dump())
                 history.append(
                     {
                         "role": "assistant",
-                        "content": response.completion,
+                        "content": completion_content,
                         "timestamp": datetime.now(UTC).isoformat(),
                     }
                 )
@@ -1032,14 +1037,6 @@ async def generate_cloud_uri(
         user_id = request.user_id
         expiry_days = request.expiry_days
 
-        logger.debug(
-            "Generating cloud URI for app_id=%s, name=%s, user_id=%s (admin_header=%s)",
-            app_id,
-            name,
-            user_id,
-            bool(admin_secret),
-        )
-
         is_admin_call = _validate_admin_secret(admin_secret)
 
         if not is_admin_call:
@@ -1063,15 +1060,31 @@ async def generate_cloud_uri(
 
                 # Only allow users to create apps for themselves (or admin)
                 token_user_id = payload.get("user_id")
-                logger.debug(f"Token user ID: {token_user_id}")
-                logger.debug(f"User ID: {user_id}")
-                if not (token_user_id == user_id or "admin" in payload.get("permissions", [])):
+                token_permissions = payload.get("permissions", [])
+                if not user_id:
+                    user_id = token_user_id
+                if not user_id:
+                    raise HTTPException(status_code=401, detail="Token is missing user_id")
+                if not (token_user_id == user_id or "admin" in token_permissions):
                     raise HTTPException(
                         status_code=403,
                         detail="You can only create apps for your own account unless you have admin permissions",
                     )
             except jwt.InvalidTokenError as e:
                 raise HTTPException(status_code=401, detail=str(e))
+        elif not user_id:
+            raise HTTPException(status_code=400, detail="user_id is required when using admin secret")
+
+        if not app_id:
+            app_id = str(uuid.uuid4())
+
+        logger.debug(
+            "Generating cloud URI for app_id=%s, name=%s, user_id=%s (admin_header=%s)",
+            app_id,
+            name,
+            user_id,
+            bool(admin_secret),
+        )
         # Import UserService here to avoid circular imports
         from core.services.user_service import UserService
 
@@ -1318,9 +1331,11 @@ async def update_chat_title(
             app_id=auth.app_id,
         )
         if success:
-            return {"success": True, "message": "Chat title updated successfully"}
+            return {"status": "success", "message": "Chat title updated successfully", "title": title}
         else:
             raise HTTPException(status_code=404, detail="Chat not found or access denied")
+    except HTTPException:
+        raise
     except Exception as exc:  # noqa: BLE001
         logger.error("Error updating chat title: %s", exc)
         raise HTTPException(status_code=500, detail="Failed to update chat title")
```

**File**: `core/completion/litellm_completion.py` (modified, +25/-3)
```diff
@@ -270,6 +270,18 @@ def __init__(self, model_key: str):
             f"config={self.model_config}, is_ollama_direct={self.is_ollama}"
         )
 
+    @staticmethod
+    def _should_apply_gemini3_minimal_reasoning_effort(model_config: Dict[str, Any]) -> bool:
+        model_name = model_config.get("model", model_config.get("model_name", ""))
+        if not isinstance(model_name, str) or not model_name:
+            return False
+        normalized = model_name.lower()
+        if "gemini-3" not in normalized:
+            return False
+        if "image" in normalized:
+            return False
+        return "reasoning_effort" not in model_config
+
     async def _handle_structured_ollama(
         self,
         dynamic_model: type,
@@ -618,13 +630,23 @@ async def complete(self, request: CompletionRequest) -> Union[CompletionResponse
         """
         # Use llm_config from request if provided, otherwise use instance config
         if request.llm_config:
-            # Create a temporary instance with the custom model config
-            model_config = request.llm_config
-            is_ollama = "ollama" in model_config.get("model", "").lower()
+            if "model" in request.llm_config:
+                # User is switching models entirely - use their config as-is
+                # to avoid inheriting provider-specific settings (e.g., api_base)
+                model_config = request.llm_config
+            else:
+                # User is just tweaking settings (e.g., temperature) - merge with defaults
+                # so the model name is preserved
+                model_config = {**self.model_config, **request.llm_config}
+            # Check both "model" and "model_name" keys for Ollama detection
+            model_id = model_config.get("model", model_config.get("model_name", ""))
+            is_ollama = "ollama" in model_id.lower()
         else:
             # Use the instance's pre-configured model
             model_config = self.model_config
             is_ollama = self.is_ollama
+            if self._should_apply_gemini3_minimal_reasoning_effort(model_config):
+                model_config = {**model_config, "reasoning_effort": "low"}
 
         # Process context chunks and handle images
         context_text, image_urls, ollama_image_data = process_context_chunks(request.context_chunks, is_ollama)
```

**File**: `core/database/postgres_database.py` (modified, +3/-3)
```diff
@@ -2027,7 +2027,7 @@ async def upsert_chat_history(
     ) -> bool:
         """Store or update chat history."""
         try:
-            now = datetime.now(UTC).isoformat()
+            now = datetime.now(UTC)
 
             # Auto-generate title from first user message if not provided
             if title is None and history:
@@ -2056,14 +2056,14 @@ async def upsert_chat_history(
                     text(
                         """
                         INSERT INTO chat_conversations (conversation_id, user_id, app_id, history, title, created_at, updated_at)
-                        VALUES (:cid, :uid, :aid, :hist, :title, CAST(:now AS TEXT), CAST(:now AS TEXT))
+                        VALUES (:cid, :uid, :aid, :hist, :title, :now, :now)
                         ON CONFLICT (conversation_id)
                         DO UPDATE SET
                             user_id = EXCLUDED.user_id,
                             app_id = EXCLUDED.app_id,
                             history = EXCLUDED.history,
                             title = COALESCE(EXCLUDED.title, chat_conversations.title),
-                            updated_at = CAST(:now AS TEXT)
+                            updated_at = :now
                         """
                     ),
                     {
```

**File**: `core/models/request.py` (modified, +9/-3)
```diff
@@ -393,10 +393,16 @@ class BatchIngestJobResponse(BaseModel):
 class GenerateUriRequest(BaseModel):
     """Request model for generating a cloud URI"""
 
-    app_id: str = Field(..., description="ID of the application")
+    app_id: Optional[str] = Field(
+        None,
+        description="Optional client-generated app ID (UUID recommended). If omitted, the server generates one.",
+    )
     name: str = Field(..., description="Name of the application")
-    user_id: str = Field(..., description="ID of the user who owns the app")
-    expiry_days: int = Field(default=30, description="Number of days until the token expires")
+    user_id: Optional[str] = Field(
+        None,
+        description="Optional owner user ID. If omitted, derived from the bearer token.",
+    )
+    expiry_days: int = Field(default=3650, description="Number of days until the token expires")
     org_id: Optional[str] = Field(None, description="Optional organization identifier for multi-tenant control planes")
     created_by_user_id: Optional[str] = Field(
         None,
```

**File**: `core/routes/documents.py` (modified, +26/-18)
```diff
@@ -1,13 +1,14 @@
-import json
 import logging
 import os
 from typing import Any, Dict, List, Optional, Union
 
+import arq
 from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, UploadFile
 
 from core.auth_utils import verify_token
 from core.config import get_settings
 from core.database.postgres_database import InvalidMetadataFilterError
+from core.dependencies import get_redis_pool
 from core.models.auth import AuthContext
 from core.models.documents import Document
 from core.models.request import (
@@ -25,7 +26,13 @@
     ListDocsResponse,
 )
 from core.models.summary import SummaryResponse, SummaryUpsertRequest
-from core.routes.utils import project_document_fields, warn_if_legacy_rules
+from core.routes.utils import (
+    enforce_no_user_mutable_fields,
+    parse_bool,
+    parse_json_dict,
+    project_document_fields,
+    warn_if_legacy_rules,
+)
 from core.services.telemetry import TelemetryService
 from core.services_init import document_service, ingestion_service
 from core.utils.typed_metadata import TypedMetadataError
@@ -440,22 +447,27 @@ async def update_document_text(
     document_id: str,
     request: IngestTextRequest,
     auth: AuthContext = Depends(verify_token),
+    redis: arq.ArqRedis = Depends(get_redis_pool),
 ):
     """
-    Update a document by replacing its text content.
+    Update a document by replacing its text content and queueing re-ingestion.
     """
     try:
         if getattr(request, "rules", None):
             logger.warning("Legacy 'rules' field supplied to /documents/{document_id}/update_text; ignoring.")
 
-        extra_fields = getattr(request, "model_extra", {}) if hasattr(request, "model_extra") else {}
-        ingestion_service._enforce_no_user_mutable_fields(
-            request.metadata, extra_fields, request.metadata_types, context="update"
+        enforce_no_user_mutable_fields(
+            ingestion_service,
+            request.metadata,
+            request.metadata_types,
+            context="update",
+            request_model=request,
         )
 
-        doc = await ingestion_service.update_document(
+        doc = await ingestion_service.queue_document_update(
             document_id=document_id,
             auth=auth,
+            redis=redis,
             content=request.content,
             file=None,
             filename=request.filename,
@@ -484,36 +496,32 @@ async def update_document_file(
     metadata_types: str = Form("{}"),
     use_colpali: Optional[bool] = Form(None),
     auth: AuthContext = Depends(verify_token),
+    redis: arq.ArqRedis = Depends(get_redis_pool),
 ):
     """
-    Update a document by replacing its content with a new file.
+    Update a document by replacing its content with a new file and queueing re-ingestion.
     """
     try:
-        metadata_dict = json.loads(metadata)
-        metadata_types_dict = json.loads(metadata_types or "{}") if metadata_types else {}
-        if metadata_types_dict is None:
-            metadata_types_dict = {}
-        if not isinstance(metadata_types_dict, dict):
-            raise HTTPException(status_code=400, detail="metadata_types must be a JSON object")
+        metadata_dict = parse_json_dict(metadata, "metadata", default={})
+        metadata_types_dict = parse_json_dict(metadata_types, "metadata_types", default={})
         await warn_if_legacy_rules(request, f"/documents/{document_id}/update_file", logger)
 
-        doc = await ingestion_service.update_document(
+        doc = await ingestion_service.queue_document_update(
             document_id=document_id,
             auth=auth,
+            redis=redis,
             content=None,
             file=file,
             filename=file.filename,
             metadata=metadata_dict,
             metadata_types=metadata_types_dict,
-            use_colpali=use_colpali,
+            use_colpali=parse_bool(use_colpali),
         )
 
         if not doc:
             raise HTTPException(status_code=404, detail="Document not found or update failed")
 
         return doc
-    except json.JSONDecodeError as e:
-        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
     except PermissionError as e:
         raise HTTPException(status_code=403, detail=str(e))
     except ValueError as exc:
```

**File**: `core/routes/ingest.py` (modified, +68/-325)
```diff
@@ -1,18 +1,12 @@
 import json
 import logging
-import os
-import uuid
-from datetime import UTC, datetime, timedelta
-from pathlib import Path
-from typing import Any, Dict, List, Optional, Set, Union
+from typing import Any, Dict, List, Optional, Set
 
 import arq
 from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
 
 from core.auth_utils import verify_token
-from core.config import get_settings
 from core.dependencies import get_redis_pool
-from core.limits_utils import check_and_increment_limits
 from core.models.auth import AuthContext
 from core.models.documents import Document
 from core.models.request import (
@@ -23,38 +17,33 @@
     RequeueIngestionRequest,
 )
 from core.models.responses import RequeueIngestionResponse, RequeueIngestionResult
-from core.routes.utils import warn_if_legacy_rules
+from core.routes.utils import (
+    enforce_no_user_mutable_fields,
+    parse_bool,
+    parse_json_dict,
+    parse_json_value,
+    warn_if_legacy_rules,
+)
 from core.services.ingestion_service import IngestionService
 from core.services.morphik_on_the_fly_structured_output import (
     MorphikOnTheFlyContentError,
     generate_morphik_on_the_fly_content,
 )
 from core.services.telemetry import TelemetryService
-from core.services_init import ingestion_service, storage
-from core.storage.utils_file_extensions import detect_content_type, detect_file_type
-from core.utils.folder_utils import normalize_ingest_folder_inputs
-from core.utils.typed_metadata import TypedMetadataError, normalize_metadata
+from core.services_init import ingestion_service
+from core.utils.typed_metadata import TypedMetadataError
 
 # ---------------------------------------------------------------------------
 # Router initialisation & shared singletons
 # ---------------------------------------------------------------------------
 
 router = APIRouter(prefix="/ingest", tags=["Ingestion"])
 logger = logging.getLogger(__name__)
-settings = get_settings()
 telemetry = TelemetryService()
 
 MORPHIK_ON_THE_FLY_MAX_DOCUMENT_BYTES = 20 * 1024 * 1024  # 20 MB limit for inline uploads to Morphik On-the-Fly
 
 
-def _parse_bool(value: Optional[Union[str, bool]]) -> bool:
-    if isinstance(value, bool):
-        return value
-    if value is None:
-        return False
-    return str(value).strip().lower() in {"true", "1", "yes", "y", "on"}
-
-
 # ---------------------------------------------------------------------------
 # /ingest/text
 # ---------------------------------------------------------------------------
@@ -72,29 +61,21 @@ async def ingest_text(
         if getattr(request, "rules", None):
             logger.warning("Legacy 'rules' field supplied to /ingest/text; ignoring payload.")
 
-        extra_fields = getattr(request, "model_extra", {}) if hasattr(request, "model_extra") else {}
-        ingestion_service._enforce_no_user_mutable_fields(
-            request.metadata, extra_fields, request.metadata_types, context="ingest"
+        enforce_no_user_mutable_fields(
+            ingestion_service,
+            request.metadata,
+            request.metadata_types,
+            context="ingest",
+            request_model=request,
         )
 
-        # Treat /ingest/text as a thin wrapper around /ingest/file to avoid sync timeouts.
-        # Encode the content to bytes and enqueue the standard ingestion worker flow.
-        filename = request.filename
-        if not filename:
-            content_head = request.content.lstrip().lower()
-            looks_like_html = content_head.startswith("<!doctype html") or "<html" in content_head
-            ext = ".html" if looks_like_html else ".txt"
-            filename = f"ingest_text_{uuid.uuid4().hex}{ext}"
-        elif not os.path.splitext(filename)[1]:
-            filename = f"{filename}.txt"
-
+        filename = ingestion_service._normalize_text_filename(request.filename, request.content)
         content_bytes = request.content.encode("utf-8")
-        content_type = detect_content_type(content=content_bytes, filename=filename)
 
         return await ingestion_service.ingest_file_content(
             file_content_bytes=content_bytes,
             filename=filename,
-            content_type=content_type,
+            content_type=None,
             metadata=request.metadata,
             auth=auth,
             redis=redis,
@@ -103,12 +84,17 @@ async def ingest_text(
             end_user_id=request.end_user_id,
             use_colpali=request.use_colpali,
         )
+    except HTTPException:
+        raise
     except PermissionError as exc:
         raise HTTPException(status_code=403, detail=str(exc))
     except ValueError as exc:
         raise HTTPException(status_code=400, detail=str(exc))
     except TypedMetadataError as exc:
         raise HTTPException(status_code=400, detail=str(exc))
+    except Exception as exc:  # noqa: BLE001
+        logger.error("Error during text ingestion: %s", exc)
+        raise HTTPExc
```

**File**: `core/routes/utils.py` (modified, +48/-2)
```diff
@@ -1,8 +1,8 @@
 import json
 import logging
-from typing import Any, Dict, List, Optional
+from typing import Any, Dict, List, Optional, Union
 
-from fastapi import Request
+from fastapi import HTTPException, Request
 
 
 def _derive_page_count(document_dict: Dict[str, Any]) -> Optional[int]:
@@ -72,6 +72,52 @@ def project_document_fields(document_dict: Dict[str, Any], fields: Optional[List
     return projected
 
 
+def parse_bool(value: Optional[Union[str, bool]]) -> bool:
+    if isinstance(value, bool):
+        return value
+    if value is None:
+        return False
+    return str(value).strip().lower() in {"true", "1", "yes", "y", "on"}
+
+
+def parse_json_value(value: Optional[str], field_name: str, default: Any = None) -> Any:
+    if value in (None, ""):
+        return default
+    if not isinstance(value, str):
+        return value
+    try:
+        return json.loads(value)
+    except json.JSONDecodeError as exc:
+        raise HTTPException(status_code=400, detail=f"{field_name} must be valid JSON: {exc}") from exc
+
+
+def parse_json_dict(value: Optional[str], field_name: str, default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
+    parsed = parse_json_value(value, field_name, default)
+    if parsed is None:
+        return {} if default is None else default
+    if not isinstance(parsed, dict):
+        raise HTTPException(status_code=400, detail=f"{field_name} must be a JSON object")
+    return parsed
+
+
+def enforce_no_user_mutable_fields(
+    ingestion_service,
+    metadata: Optional[Dict[str, Any]],
+    metadata_types: Optional[Dict[str, Any]],
+    context: str,
+    request_model: Optional[Any] = None,
+) -> None:
+    extra_fields = (
+        getattr(request_model, "model_extra", {}) if request_model and hasattr(request_model, "model_extra") else {}
+    )
+    ingestion_service._enforce_no_user_mutable_fields(
+        metadata,
+        extra_fields,
+        metadata_types,
+        context=context,
+    )
+
+
 async def warn_if_legacy_rules(request: Request, route: str, logger: logging.Logger) -> None:
     """Inspect multipart form data for legacy ``rules`` payloads and emit warnings."""
     try:
```

**File**: `core/services/ingestion_service.py` (modified, +345/-243)
```diff
@@ -2,7 +2,6 @@
 Ingestion Service - Handles all document ingestion operations.
 
 This service is responsible for:
-- Text ingestion (ingest_text)
 - File ingestion (ingest_file_content)
 - Document updates (update_document)
 - ColPali multi-vector chunk creation
@@ -62,7 +61,7 @@ class IngestionService:
     Service for handling document ingestion operations.
 
     This service encapsulates all ingestion-related functionality, including:
-    - Text and file ingestion
+    - File ingestion
     - Document updates
     - ColPali multi-vector processing
     - Chunk creation and storage
@@ -250,150 +249,183 @@ async def _ensure_folder_exists(
             return None
 
     # -------------------------------------------------------------------------
-    # Text ingestion
+    # Ingestion helpers
     # -------------------------------------------------------------------------
 
-    async def ingest_text(
-        self,
-        content: str,
-        filename: Optional[str] = None,
-        metadata: Optional[Dict[str, Any]] = None,
-        metadata_types: Optional[Dict[str, str]] = None,
-        auth: Optional[AuthContext] = None,
-        use_colpali: Optional[bool] = None,
-        folder_name: Optional[str] = None,
-        end_user_id: Optional[str] = None,
-    ) -> Document:
-        """Ingest a text document."""
-        # Prevent callers from overriding reserved fields
-        self._enforce_no_user_mutable_fields(metadata, metadata_types=metadata_types, context="ingest")
+    @staticmethod
+    def _build_auth_dict(auth: AuthContext) -> Dict[str, Any]:
+        user_id = getattr(auth, "user_id", None)
+        return {
+            "user_id": user_id,
+            "entity_id": user_id,
+            "app_id": auth.app_id,
+        }
 
-        normalized_folder = normalize_ingest_folder_inputs(folder_name=folder_name)
-        folder_path, folder_leaf = normalized_folder.path, normalized_folder.leaf
+    @staticmethod
+    def _build_storage_info(
+        bucket: str,
+        key: str,
+        filename: Optional[str],
+        content_type: Optional[str],
+    ) -> Dict[str, str]:
+        return {
+            "bucket": bucket,
+            "key": key,
+            "filename": filename or "",
+            "content_type": content_type or "",
+        }
 
-        doc = Document(
-            content_type="text/plain",
+    @staticmethod
+    def _resolve_content_type(
+        content_bytes: bytes,
+        filename: Optional[str],
+        content_type_hint: Optional[str],
+    ) -> str:
+        return detect_content_type(
+            content=content_bytes,
             filename=filename,
-            metadata=metadata or {},
-            folder_name=folder_leaf,
-            folder_path=folder_path,
-            end_user_id=end_user_id,
-            app_id=auth.app_id,
+            content_type_hint=content_type_hint,
         )
 
-        logger.debug(f"Created text document record with ID {doc.external_id}")
-
-        combined_metadata = dict(metadata or {})
-        combined_metadata.setdefault("external_id", doc.external_id)
-        if folder_path is not None:
-            combined_metadata["folder_name"] = folder_path
-        metadata_bundle = normalize_metadata(combined_metadata, metadata_types)
-        doc.metadata = metadata_bundle.values
-        doc.metadata_types = metadata_bundle.types
-
-        if settings.MODE == "cloud" and auth.user_id:
-            # Verify limits before heavy processing
-            num_pages = estimate_pages_by_chars(len(content))
-            await check_and_increment_limits(
-                auth,
-                "ingest",
-                num_pages,
-                doc.external_id,
-                verify_only=True,
-            )
-
-        doc.system_metadata["content"] = content
-
-        # Split text into chunks
-        parsed_chunks = await self.parser.split_text(content)
-        if not parsed_chunks:
-            raise ValueError("No content chunks extracted from document text")
-        logger.debug(f"Split processed text into {len(parsed_chunks)} chunks")
-
-        processed_chunks = parsed_chunks
+    @staticmethod
+    def _normalize_text_filename(filename: Optional[str], content: str) -> str:
+        def _needs_html_ext(text: str) -> bool:
+            head = text.lstrip().lower()
+            return head.startswith("<!doctype html") or "<html" in head
 
-        # Generate embeddings for processed chunks
-        embeddings = await self.embedding_model.embed_for_ingestion(processed_chunks)
-        logger.debug(f"Generated {len(embeddings)} embeddings")
+        if not filename:
+            ext = ".html" if _needs_html_ext(content) else ".txt"
+            return f"document_text_{uuid.uuid4().hex}{ext}"
 
-        # Create chunk objects with processed chunk content
-        chunk_objects = self._create_chunk_objects(doc.external_id, processed_chunks, embeddings)
-        logger.debug(f"Created {len(chunk_objects)} chunk object
```

---

### Incident Patch 13: `2846b22a` (2025-12-20)
**Commit Message**: Fix requeue dropping folder path (#324)

**File**: `core/routes/ingest.py` (modified, +2/-0)
```diff
@@ -615,6 +615,8 @@ async def _process_document(doc: Document, override_flag: Optional[bool]) -> Non
                 auth_dict=auth_dict,
                 use_colpali=use_colpali_flag,
                 folder_name=doc.folder_name,
+                folder_path=doc.folder_path,
+                folder_leaf=doc.folder_name,
                 end_user_id=doc.end_user_id,
             )
 
```

**File**: `core/services/ingestion_service.py` (modified, +2/-0)
```diff
@@ -583,6 +583,8 @@ async def ingest_file_content(
                 auth_dict=auth_dict,
                 use_colpali=use_colpali,
                 folder_name=str(folder_name) if folder_name else None,
+                folder_path=folder_path,
+                folder_leaf=folder_leaf,
                 end_user_id=end_user_id,
             )
             if job is None:
```

---

### Incident Patch 14: `d14639c8` (2025-12-17)
**Commit Message**: Pull utils before building image (#313)

**File**: `dockerfile` (modified, +1/-0)
```diff
@@ -170,6 +170,7 @@ COPY fde ./fde
 
 COPY core ./core
 COPY ee ./ee
+COPY utils ./utils
 COPY README.md LICENSE ./
 # Assuming start_server.py is at the root of your project
 COPY start_server.py ./
```

---

### Incident Patch 15: `c0079c1f` (2025-12-16)
**Commit Message**: Remove PDF tools, fix pg path writes (#311)

**File**: `core/api.py` (modified, +0/-4)
```diff
@@ -47,7 +47,6 @@
 from core.routes.logs import router as logs_router  # noqa: E402 – import after FastAPI app
 from core.routes.model_config import router as model_config_router
 from core.routes.models import router as models_router
-from core.routes.pdf_viewer import router as pdf_viewer_router
 from core.services.telemetry import TelemetryService
 from core.services_init import document_service, ingestion_service
 from core.utils.folder_utils import normalize_folder_selector
@@ -319,9 +318,6 @@ def _extract_provider(model_name: str) -> str:
 # Register folders router
 app.include_router(folders_router)
 
-# Register PDF viewer router
-app.include_router(pdf_viewer_router)
-
 # Register model config router
 app.include_router(model_config_router)
 
```

**File**: `core/database/postgres_database.py` (modified, +26/-7)
```diff
@@ -637,13 +637,27 @@ async def update_document(self, document_id: str, updates: Dict[str, Any], auth:
                 else:
                     updates["folder_path"] = None
 
-            # Decide which folder value to mirror into doc_metadata (prefer path)
+            # -------------------------------------------------------------------------
+            # METADATA SYNC: doc_metadata["folder_name"] stores the FULL PATH for search
+            # compatibility. We need to keep it in sync with the flattened columns.
+            #
+            # Priority for folder_value_for_metadata (what goes into doc_metadata["folder_name"]):
+            #   1. updates["folder_path"] - explicit path update takes precedence
+            #   2. updates["folder_name"] - explicit name update (may be a path in some contexts)
+            #   3. existing_doc.folder_path or folder_name - fallback to current values
+            #
+            # CLEARING SUPPORT: If user explicitly passes folder_path=None or folder_name=None,
+            # we respect that and set folder_value_for_metadata to None (don't fall back).
+            # -------------------------------------------------------------------------
             if "folder_path" in updates:
                 folder_value_for_metadata = updates.get("folder_path")
             elif "folder_name" in updates:
                 folder_value_for_metadata = updates.get("folder_name")
             else:
                 folder_value_for_metadata = existing_doc.folder_path or existing_doc.folder_name
+            explicit_folder_change = any(key in updates for key in ("folder_name", "folder_path", "folder_id"))
+            explicit_path_in_updates = "folder_path" in updates
+            explicit_name_in_updates = "folder_name" in updates
 
             # Serialize datetime objects to ISO format strings
             updates = _serialize_datetime(updates)
@@ -673,13 +687,16 @@ async def update_document(self, document_id: str, updates: Dict[str, Any], auth:
                     # The flattened fields (owner_id, app_id)
                     # should be in updates directly if they need to be updated
 
-                    # Keep doc_metadata folder fields in sync with flattened columns (support clearing)
+                    # Keep doc_metadata["folder_name"] in sync with flattened columns.
+                    # This field stores the FULL PATH for search/filter compatibility.
                     doc_metadata_update = updates.get("doc_metadata") if "doc_metadata" in updates else None
-                    has_folder_change = any(key in updates for key in ("folder_name", "folder_path", "folder_id"))
+                    has_folder_change = explicit_folder_change
 
                     if doc_metadata_update is not None:
-                        folder_value = updates.get("folder_path", folder_value_for_metadata)
-                        if folder_value is None:
+                        folder_value = folder_value_for_metadata
+                        # Only fall back to existing values if user didn't explicitly clear the folder.
+                        # This allows update_document(..., folder_path=None) to actually clear the value.
+                        if folder_value is None and not (explicit_path_in_updates or explicit_name_in_updates):
                             folder_value = doc_model.folder_path or doc_model.folder_name
                         try:
                             if isinstance(doc_metadata_update, dict):
@@ -691,9 +708,11 @@ async def update_document(self, document_id: str, updates: Dict[str, Any], auth:
                         except Exception as exc:  # noqa: BLE001
                             logger.warning("Unable to set folder fields in doc_metadata for %s: %s", document_id, exc)
                     elif has_folder_change:
+                        # Folder columns changed but no doc_metadata in updates - sync metadata anyway
                         new_doc_metadata = dict(doc_model.doc_metadata or {})
-                        folder_value = updates.get("folder_path", folder_value_for_metadata)
-                        if folder_value is None:
+                        folder_value = folder_value_for_metadata
+                        # Same clearing logic: only fall back if not an explicit clear operation
+                        if folder_value is None and not (explicit_path_in_updates or explicit_name_in_updates):
                             folder_value = doc_model.folder_path or doc_model.folder_name
                         new_doc_metadata["folder_name"] = folder_value
                         if "folder_id" in updates:
```

**File**: `core/models/documents.py` (modified, +9/-0)
```diff
@@ -36,6 +36,15 @@ class Document(BaseModel):
     chunk_ids: List[str] = Field(default_factory=list)
 
     # Flattened fields from system_metadata for performance
+    #
+    # FOLDER FIELD SEMANTICS:
+    #   folder_name: The LEAF name of the folder (e.g., "Reports")
+    #   folder_path: The FULL hierarchical path (e.g., "/Company/Department/Reports")
+    #   folder_id:   UUID of the folder record
+    #
+    # NOTE: In API request parameters, "folder_name" confusingly accepts a FULL PATH
+    # for filtering purposes. The path is normalized and filters use folder_path column.
+    # Additionally, doc_metadata["folder_name"] stores the FULL PATH for search compatibility.
     folder_name: Optional[str] = None
     end_user_id: Optional[str] = None
     app_id: Optional[str] = None
```

**File**: `core/models/request.py` (modified, +6/-6)
```diff
@@ -109,7 +109,7 @@ class SearchDocumentsRequest(BaseModel):
     filters: Optional[Dict[str, Any]] = Field(None, description="Optional metadata filters for documents")
     folder_name: Optional[Union[str, List[str]]] = Field(
         None,
-        description="Optional folder scope for the search. Accepts a single folder name or a list of folder names.",
+        description="Optional folder scope. Accepts a folder PATH (e.g., '/Company/Reports') or list of paths.",
     )
     folder_depth: Optional[int] = Field(
         default=None,
@@ -170,7 +170,7 @@ class RetrieveRequest(BaseModel):
     include_paths: Optional[bool] = Field(False, description="Whether to include relationship paths in the response")
     folder_name: Optional[Union[str, List[str]]] = Field(
         None,
-        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
+        description="Optional folder scope. Accepts a folder PATH (e.g., '/Company/Reports') or list of paths.",
     )
     folder_depth: Optional[int] = Field(
         default=None,
@@ -300,7 +300,7 @@ class CreateGraphRequest(BaseModel):
     )
     folder_name: Optional[Union[str, List[str]]] = Field(
         None,
-        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
+        description="Optional folder scope. Accepts a folder PATH (e.g., '/Company/Reports') or list of paths.",
     )
     end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")
 
@@ -320,7 +320,7 @@ class UpdateGraphRequest(BaseModel):
     )
     folder_name: Optional[Union[str, List[str]]] = Field(
         None,
-        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
+        description="Optional folder scope. Accepts a folder PATH (e.g., '/Company/Reports') or list of paths.",
     )
     end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")
 
@@ -449,7 +449,7 @@ class BatchDocumentsRequest(BaseModel):
     document_ids: List[str] = Field(default_factory=list, description="List of document IDs to retrieve")
     folder_name: Optional[Union[str, List[str]]] = Field(
         None,
-        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
+        description="Optional folder scope. Accepts a folder PATH (e.g., '/Company/Reports') or list of paths.",
     )
     end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")
 
@@ -460,7 +460,7 @@ class BatchChunksRequest(BaseModel):
     sources: List[ChunkSource] = Field(default_factory=list, description="List of chunk sources to retrieve")
     folder_name: Optional[Union[str, List[str]]] = Field(
         None,
-        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
+        description="Optional folder scope. Accepts a folder PATH (e.g., '/Company/Reports') or list of paths.",
     )
     end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")
     use_colpali: Optional[bool] = Field(None, description="Whether to use ColPali embeddings for retrieval")
```

**File**: `core/pdf_viewer/tools.py` (removed, +0/-468)
```diff
@@ -1,468 +0,0 @@
-import base64
-import uuid
-from io import BytesIO
-from typing import List, Optional
-
-import fitz  # PyMuPDF
-import httpx
-from PIL import Image
-
-SUMMARY_PROMPT = "Please provide a concise summary of the provided image of a page from a PDF."
-SUMMARY_PROMPT += "Focus on the main topics, key points, and any important information."
-SUMMARY_PROMPT += "Your summaries will be used as an *index* to allow an agent to navigate the PDF."
-
-
-class PDFViewer:
-    """A state machine for navigating and viewing PDF pages with lazy loading."""
-
-    def __init__(
-        self,
-        pdf_document: Optional[fitz.Document] = None,
-        images: Optional[List] = None,  # Keep for backward compatibility
-        api_base_url: Optional[str] = None,
-        session_id: Optional[str] = None,
-        user_id: Optional[str] = None,
-        document_id: Optional[str] = None,
-        document_service=None,
-        auth=None,
-    ):
-        # Support both new PyMuPDF approach and legacy images approach
-        if pdf_document is not None:
-            self.pdf_document = pdf_document
-            self.total_pages = len(pdf_document)
-            self.use_lazy_loading = True
-        elif images is not None:
-            # Backward compatibility with old approach
-            self.images = images
-            self.total_pages = len(images)
-            self.use_lazy_loading = False
-            self.pdf_document = None
-        else:
-            raise ValueError("Either pdf_document or images must be provided")
-
-        self.current_page: int = 0
-        self.current_frame: str = self._create_page_url(self.current_page)
-
-        # Use provided api_base_url or fall back to localhost for development
-        self.api_base_url: str = api_base_url or "http://localhost:3000/api/pdf"
-        # Generate session and user IDs if not provided
-        self.session_id: str = session_id or str(uuid.uuid4())
-        self.user_id: str = user_id or "anonymous"
-        self.client = httpx.Client(base_url=self.api_base_url, follow_redirects=True)
-
-        # Initialize empty summaries - will be generated on demand
-        self.summaries: List[str] = [""] * self.total_pages
-
-        # For document retrieval functionality
-        self.document_id: str = document_id
-        self.document_service = document_service
-        self.auth = auth
-
-    def _get_page_image(self, page_number: int) -> Image.Image:
-        """Get PIL Image for a specific page, using lazy loading if available."""
-        if self.use_lazy_loading:
-            # Lazy loading with PyMuPDF - render page on demand
-            page = self.pdf_document[page_number]
-            # Use high DPI for better quality (150 DPI is a good balance of quality/speed)
-            mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
-            pix = page.get_pixmap(matrix=mat)
-            img_data = pix.tobytes("png")
-            return Image.open(BytesIO(img_data))
-        else:
-            # Legacy approach with pre-loaded images
-            return self.images[page_number]
-
-    def _create_page_url(self, page_number: int) -> str:
-        """Convert a page to base64 data URL."""
-        image = self._get_page_image(page_number)
-        buffer = BytesIO()
-        image.save(buffer, format="PNG")
-        buffer.seek(0)
-        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
-        return "data:image/png;base64," + image_base64
-
-    def _make_api_call(self, method: str, endpoint: str, json_data: Optional[dict] = None) -> httpx.Response:
-        """Make API call to PDF viewer for UI side effects with session and user scoping."""
-        # Add session and user info to the request
-        if json_data is None:
-            json_data = {}
-
-        # Add scoping information
-        json_data.update({"sessionId": self.session_id, "userId": self.user_id})
-
-        # Also add as headers for redundancy
-        headers = {"x-session-id": self.session_id, "x-user-id": self.user_id, "Content-Type": "application/json"}
-
-        if method.upper() == "POST":
-            return self.client.post(endpoint, json=json_data, headers=headers)
-        elif method.upper() == "GET":
-            return self.client.get(endpoint, headers=headers)
-        else:
-            raise ValueError(f"Unsupported HTTP method: {method}")
-
-    def get_current_frame(self) -> str:
-        """Get the current frame as a base64 data URL."""
-        return self.current_frame
-
-    def get_session_info(self) -> dict:
-        """Get session and user information."""
-        return {"session_id": self.session_id, "user_id": self.user_id, "api_base_url": self.api_base_url}
-
-    def get_next_page(self) -> str:
-        """Navigate to the next page and update state."""
-        if self.current_page + 1 >= self.total_pages:
-            return f"Already at last page ({self.current_page + 1} of {self.total_pages})"
-
-        self.current
```

**File**: `core/routes/ingest.py` (modified, +14/-1)
```diff
@@ -55,7 +55,20 @@ def _parse_bool(value: Optional[Union[str, bool]]) -> bool:
 
 
 def _normalize_folder_inputs(folder_name: Optional[str]) -> tuple[Optional[str], Optional[str]]:
-    """Return canonical folder path with leading slash and the leaf name."""
+    """
+    Normalize folder input from API into (folder_path, folder_leaf).
+
+    The API parameter is called "folder_name" but actually accepts a FULL PATH
+    (e.g., "/Company/Department/Reports" or just "Reports").
+
+    Returns:
+        folder_path: The full normalized path (e.g., "/Company/Department/Reports")
+        folder_leaf: Just the leaf segment (e.g., "Reports")
+
+    These map to Document model fields:
+        - folder_path -> Document.folder_path (full path, used for filtering)
+        - folder_leaf -> Document.folder_name (leaf only, display name)
+    """
     if folder_name is None:
         return None, None
     try:
```

**File**: `core/routes/pdf_viewer.py` (removed, +0/-519)
```diff
@@ -1,519 +0,0 @@
-import json
-import logging
-from datetime import UTC, datetime
-from typing import Any, Dict, List, Optional
-
-import arq
-import fitz
-import litellm
-from fastapi import APIRouter, Depends, HTTPException
-from fastapi.responses import StreamingResponse
-from pydantic import BaseModel
-
-from core.auth_utils import verify_token
-from core.config import get_settings
-from core.dependencies import get_redis_pool
-from core.models.auth import AuthContext
-from core.pdf_viewer.tools import PDFViewer, get_pdf_viewer_tools_for_litellm
-from core.services_init import document_service
-
-logger = logging.getLogger(__name__)
-
-router = APIRouter(prefix="/document", tags=["document"])
-litellm.drop_params = True
-
-
-class DocumentChatRequest(BaseModel):
-    """Request model for document chat completion."""
-
-    message: str
-    document_id: Optional[str] = None
-    session_id: Optional[str] = None
-
-
-async def get_pdf_viewer(
-    document_id: str, auth: AuthContext, api_base_url: Optional[str] = None, session_id: Optional[str] = None
-) -> PDFViewer:
-    document = await document_service.db.get_document(document_id, auth)
-    as_bytes = await document_service.storage.download_file(**document.storage_info)
-    pdf_document = fitz.open(stream=as_bytes, filetype="pdf")
-
-    if session_id is None:
-        import uuid
-
-        session_id = str(uuid.uuid4())
-
-    # Use user ID from auth context
-    user_id = auth.user_id if auth and hasattr(auth, "user_id") else "anonymous"
-
-    return PDFViewer(
-        pdf_document=pdf_document,
-        api_base_url=api_base_url,
-        session_id=session_id,
-        user_id=user_id,
-        document_id=document_id,
-        document_service=document_service,
-        auth=auth,
-    )
-
-
-@router.get("/chat/{chat_id}")
-async def get_document_chat_history(
-    chat_id: str,
-    auth: AuthContext = Depends(verify_token),
-    redis: arq.ArqRedis = Depends(get_redis_pool),
-):
-    """Retrieve the message history for a document chat conversation."""
-    history_key = f"document_chat:{chat_id}"
-    stored = await redis.get(history_key)
-
-    if not stored:
-        return []
-
-    try:
-        data = json.loads(stored)
-        return data
-    except Exception as e:
-        logger.error(f"Error parsing chat history from Redis: {e}")
-        return []
-
-
-async def execute_pdf_tool(pdf_viewer: PDFViewer, tool_call) -> dict:
-    """Execute a PDF viewer tool call and return the result with additional metadata."""
-    function_name = tool_call.function.name
-    function_args = json.loads(tool_call.function.arguments)
-
-    try:
-        result = {
-            "message": "",
-            "tool_name": function_name,
-            "args": function_args,
-            "current_frame": None,
-            "metadata": {},
-        }
-
-        if function_name == "get_next_page":
-            result["message"] = pdf_viewer.get_next_page()
-            result["current_frame"] = pdf_viewer.get_current_frame()
-            result["metadata"] = {"page": pdf_viewer.current_page + 1, "total_pages": pdf_viewer.total_pages}
-        elif function_name == "get_previous_page":
-            result["message"] = pdf_viewer.get_previous_page()
-            result["current_frame"] = pdf_viewer.get_current_frame()
-            result["metadata"] = {"page": pdf_viewer.current_page + 1, "total_pages": pdf_viewer.total_pages}
-        elif function_name == "go_to_page":
-            page_number = function_args.get("page_number", 0)
-            result["message"] = pdf_viewer.go_to_page(page_number)
-            result["current_frame"] = pdf_viewer.get_current_frame()
-            result["metadata"] = {"page": pdf_viewer.current_page + 1, "total_pages": pdf_viewer.total_pages}
-        elif function_name == "zoom_in":
-            box_2d = function_args.get("box_2d", [])
-            result["message"] = pdf_viewer.zoom_in(box_2d)
-            result["current_frame"] = pdf_viewer.get_current_frame()
-            result["metadata"] = {"zoom_region": box_2d, "page": pdf_viewer.current_page + 1}
-        elif function_name == "zoom_out":
-            result["message"] = pdf_viewer.zoom_out()
-            result["current_frame"] = pdf_viewer.get_current_frame()
-            result["metadata"] = {"page": pdf_viewer.current_page + 1}
-        elif function_name == "get_page_summary":
-            page_number = function_args.get("page_number", 0)
-            result["message"] = pdf_viewer.get_page_summary(page_number)
-            result["metadata"] = {"page": page_number + 1}
-        elif function_name == "get_total_pages":
-            total = pdf_viewer.get_total_pages()
-            result["message"] = f"Total pages in PDF: {total}"
-            result["metadata"] = {"total_pages": total}
-        elif function_name == "find_most_relevant_page":
-            query = function_args.get("query", "")
-            result["message"] = await pdf_viewer.find_most_r
```

**File**: `core/services/document_service.py` (modified, +4/-0)
```diff
@@ -112,6 +112,10 @@ def _build_folder_scope_filters(
         """
         Build system_filters entries for folder scoping with optional nesting depth.
 
+        NOTE: Despite the parameter name "folder_name", this accepts FULL FOLDER PATHS
+        (e.g., "/Company/Department/Reports"). The naming is historical and matches the API
+        parameter convention. Filtering is done on the `folder_path` database column.
+
         folder_depth semantics:
         - None or 0: exact match only.
         - -1: include all descendants.
```

#### Recent Merged Pull Requests:
- **PR #445** (2026-10-05): Fail over ColPali query embeddings to the next endpoint (@Adityav369)
- **PR #444** (2026-09-30): Keep live data when a backup restore fails (@ArnavAgrawal03)
- **PR #443** (2026-09-25): Keep COMPOSE_PROFILES when start scripts add ui or backup profiles (@ArnavAgrawal03)
- **PR #442** (2026-09-25): Add backup, restore, and scheduled backups for Docker installs (@ArnavAgrawal03)
- **PR #441** (2026-09-25): Prevent Docker shutdown from deleting PostgreSQL data (@ArnavAgrawal03)
- **PR #437** (2026-09-22): Fix document updates stalled by retained ingestion job results (@ArnavAgrawal03)
- **PR #436** (2026-09-08): Fix Unicode filenames in original-file downloads (@ArnavAgrawal03)
- **PR #435** (2026-09-04): Harden on-prem lifecycle and document iQor integration gaps (@ArnavAgrawal03)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): morphik-org/morphik-core

> **Canonical Artifact**: `07_PROJECT_LEARNING/morphik-org-morphik-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/morphik-org/morphik-core](https://github.com/morphik-org/morphik-core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:04:26.739Z  
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
#
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

### Incident Patch 1: `c97f03da` (2026-09-25)
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
+def test_generated_stop_script_runs_from_its_directory_wi
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

---

### Incident Patch 2: `4ab6e719` (2026-09-22)
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
+        metadata: Optio
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
+        async with db.engine.connect() as con
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

---

### Incident Patch 3: `57a6c0f8` (2026-09-08)
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
+    assert all(32
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

### Incident Patch 4: `d34e5ffa` (2026-05-11)
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
+        if hasattr(pipeline_options, "im
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
+            FakePage(_non_blank_png
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
+     
```

---

### Incident Patch 5: `ee9d007b` (2026-05-10)
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

Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

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

### Incident Patch 6: `6fdfe258` (2026-04-02)
**Commit Message**: Fix: add retry logic to LiteLLM embedding for transient 500 errors (#396)

* Add retry logic to LiteLLM embedding calls for transient errors

The embedding path lacked num_retries, causing OpenAI 500 errors to
propagate as unhandled exceptions. The completion path already uses
num_retries=3; this aligns embedding to match.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

* Fix CI docker-build by adding PostgreSQL and Redis containers

The test was running the Morphik container standalone without any
database or cache, causing the entrypoint to timeout waiting for
PostgreSQL. Now spins up pgvector and Redis containers in a shared
Docker network, fixes the POSTGRES_URI scheme, and disables ColPali
to avoid loading ML models in CI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

* Fix MORPHIK_EMBEDDING_API_DOMAIN validation error in CI docker-build

The Settings model expects a list[str] for MORPHIK_EMBEDDING_API_DOMAIN
but the CI test config provided a plain string. Fixed by:
1. Using a list in the CI test TOML config
2. Adding a defensive str-to-list coercion in config.py for robustness

Co-Authored-By: Claude Opus 4.6 (1M context) <norep

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

### Incident Patch 7: `fabe74df` (2026-02-05)
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

### Incident Patch 8: `0b06ae26` (2026-01-27)
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

### Incident Patch 9: `307d592c` (2026-01-27)
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

### Incident Patch 10: `3017f9de` (2026-01-19)
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
@@ -308,7 +261,7 @@ async def delete_document(document_id: str, auth
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

#### Recent Merged Pull Requests:
- **PR #444** (2026-09-30): Keep live data when a backup restore fails (@ArnavAgrawal03)
- **PR #443** (2026-09-25): Keep COMPOSE_PROFILES when start scripts add ui or backup profiles (@ArnavAgrawal03)
- **PR #442** (2026-09-25): Add backup, restore, and scheduled backups for Docker installs (@ArnavAgrawal03)
- **PR #441** (2026-09-25): Prevent Docker shutdown from deleting PostgreSQL data (@ArnavAgrawal03)
- **PR #437** (2026-09-22): Fix document updates stalled by retained ingestion job results (@ArnavAgrawal03)
- **PR #436** (2026-09-08): Fix Unicode filenames in original-file downloads (@ArnavAgrawal03)
- **PR #435** (2026-09-04): Harden on-prem lifecycle and document iQor integration gaps (@ArnavAgrawal03)
- **PR #432** (2026-07-23): Keep blank PDF pages as chunks to preserve page/chunk alignment (@Adityav369)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

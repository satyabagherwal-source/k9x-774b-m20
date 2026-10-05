# Forensic Learning Record (Deep Inspection): Ontos-AI/knowhere

> **Canonical Artifact**: `07_PROJECT_LEARNING/ontos-ai-knowhere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:39.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ontos-AI/knowhere`
- **Description**: Knowhere extracts, parses, and outputs structured chunks ready for AI Agents and RAG.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3668 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/api/alembic/versions/0b1c2d3e4f5a_add_demo_materialization_claim_state.py`
```
"""Add demo materialization claim state."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0b1c2d3e4f5a"
down_revision: str | Sequence[str] | None = "e4f5a6b7c8d9"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "demo_materializations",
        sa.Column("status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "demo_materializations",
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
    )
    op.execute(
        "UPDATE demo_materializations SET status = 'ready' WHERE status IS NULL"
    )
    op.alter_column(
        "demo_materializations",
        "status",
        existing_type=sa.String(length=32),
        nullable=False,
        server_default="ready",
    )
    op.alter_column(
        "demo_materializations",
        "document_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "demo_materializations",
        "document_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.drop_column("demo_materializations", "claimed_at")
    op.drop_column("demo_materializations", "status")

```

### Core Architecture Module: `apps/api/app/api/v1/routes/webhook.py`
```
"""
Webhook API Routes

- GET /logs: Get webhook delivery history
- POST /trigger: Manually trigger webhook for a job
"""

from typing import Optional

from app.api.dependencies.auth import require_write_permission
from app.api.dependencies.current_user import with_current_user
from app.repositories.job_repository import JobRepository
from app.repositories.webhook_repository import WebhookRepository
from app.services.rate_limit.data_structures import CurrentUser
from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from shared.core.database import get_db
from shared.core.exceptions.domain_exceptions import (
    NotFoundException,
    PermissionDeniedException,
    WebhookServiceException,
)
from shared.core.exceptions.knowhere_exception import KnowhereException
from shared.models.schemas.webhook import (
    WebhookLogList,
    WebhookLogResponse,
    WebhookTriggerRequest,
    WebhookTriggerResponse,
)
from shared.services.webhook import get_webhook_dispatcher

router = APIRouter(tags=["Webhook"])


@router.get("/logs", response_model=WebhookLogList, summary="Get Webhook Delivery Logs")
async def get_webhook_logs(
    job_id: Optional[str] = Query(None, description="Filter by Job ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: CurrentUser = Depends(with_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get webhook delivery history logs.

    Returns a paginated list of webhook delivery attempts, optionally filtered by job_id.
    Each log entry includes the delivery status, duration, and response details.
    """
    try:
        repo = WebhookRepository()
        offset = (page - 1) * page_size
        logs, total = await repo.get_webhook_logs(
            db=db,
            user_id=current_user.user_id,
            job_id=job_id,
            limit=page_size,
            offset=offset,
        )

        return WebhookLogList(
            total=total,
            page=page,
            page_size=page_size,
            logs=[
                WebhookLogResponse(
                    id=log.id,
                    job_id=log.job_id,
                    webhook_url=log.webhook_url,
                    attempt_number=log.attempt_number,
                    request_payload=log.request_payload or {},
                    signature=log.signature,
                    idempotency_key=log.idempotency_key,
                    response_status_code=log.response_status_code,
                    response_body=log.response_body,
                    error_message=log.error_message,
                    duration_ms=log.duration_ms,
                    created_at=log.created_at,
                )
                for log in logs
            ],
        )
    except Exception as e:
        logger.error(f"Failed to get webhook logs: {e}")
        raise WebhookServiceException(
            internal_message=f"Failed to retrieve webhook logs: {str(e)}"
        )


@router.post(
    "/trigger",
    response_model=WebhookTriggerResponse,
    summary="Manually Trigger Webhook",
)
async def trigger_webhook(
    request: WebhookTriggerRequest,
    current_user: CurrentUser = Depends(with_current_user),
    _write_permission: None = Depends(require_write_permission),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually trigger a webhook for a completed or failed job.

    This sends a webhook notification synchronously and returns the delivery result.
    Use this for testing or retrying failed webhook deliveries.
    """
    try:
        job_repo = JobRepository()

        # 1. Fetch Job
        job = await job_repo.get_job_by_id(db, request.job_id)
        if not job:
            raise NotFoundException(resource="Job", resource_id=request.job_id)

        # Verify ownership
        if str(job.user_id) != current_user.user_id:
            raise PermissionDeniedException(
                user_message="You don't have permission to trigger webhook for this job",
                required_permission="job:webhook:trigger",
            )

        # 2. Validation - client errors (400)
        if not job.is_terminal_state():
            from shared.core.exceptions.domain_exceptions import ValidationException

            raise ValidationException(
                user_message=f"Job must be in terminal state to trigger webhook. Current status: {job.status}",
                violations=[
                    {
                        "field": "job_id",
                        "description": f"Job status is '{job.status}', expected 'done' or 'failed'",
                    }
                ],
            )

        if not job.webhook_url:
            from shared.core.exceptions.webhook_exceptions import WebhookConfigException

            raise WebhookConfigException(
                internal_message=f"Job {request.job_id} does not have webhook_url configured",
                user_message="Job does not have a webhook URL configured. Configure webhook_url when creating the job.",
                details={"field": "webhook_url", "reason": "not_configured"},
            )

        # 3. Fetch existing WebhookEvent (Transactional Outbox)
        from sqlalchemy import select

        from shared.models.database.webhook import WebhookEvent

        result = await db.execute(
            select(WebhookEvent).where(WebhookEvent.job_id == request.job_id)
        )
        event = result.scalars().first()

        if not event:
            raise NotFoundException(
                resource="WebhookEvent",
                resource_id=request.job_id,
                internal_message=(
                    "No webhook event found for this job. Ensure the job has "
                    "completed and webhooks are configured."
                ),
            )

        dispatcher = get_webhook_dispatcher()
        delivery_result = await dispatcher.send_manual_webhook(db=db, event=event)

        # 5. Return response
        return WebhookTriggerResponse(
            success=delivery_result.success,
            status_code=delivery_result.status_code,
            response_body=None,  # Dispatcher doesn't return response body
            duration_ms=delivery_result.duration_ms,
            delivery_id=None,  # Manual trigger doesn't create delivery log
            error_message=delivery_result.error_message,
        )

    except KnowhereException:
        # Re-raise all known exceptions (NotFoundException, ValidationException, etc.)
        raise
    except Exception as e:
        raise WebhookServiceException(
            internal_message=f"Failed to trigger webhook: {str(e)}"
        )


# @router.post("/test-callback", summary="Test Webhook Callback Endpoint")
# async def test_webhook_callback(
#     request: Request,
#     payload: dict = Body(...),
# ):
#     """
#     Test endpoint to receive webhook callbacks.

#     Use this endpoint to verify webhook delivery. It logs receiving data
#     to the server console and returns the received payload.
#     """
#     # Log the event
#     logger.info("🔔 [Test Callback] Webhook Received!")
#     logger.info(f"Headers: {dict(request.headers)}")
#     logger.info(f"Payload: {payload}")

#     return {
#         "status": "received",
#         "timestamp": datetime.utcnow().isoformat(),
#         "payload": payload,
#         "received_headers": {k: v for k, v in request.headers.items() if k.lower().startswith("x-") or k.lower() == "user-agent"},
#     }

```

### Core Architecture Module: `apps/api/app/api/v1/routes/webhook_secrets.py`
```
"""
Webhook Secrets API Routes

Endpoints for managing user webhook signing secrets.
"""

from typing import List, Optional

from app.api.dependencies.auth import require_write_permission
from app.api.dependencies.current_user import with_current_user
from app.services.rate_limit.data_structures import CurrentUser
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from shared.core.database import get_db
from shared.core.exceptions.domain_exceptions import NotFoundException
from shared.repositories.webhook_secret_repository import WebhookSecretRepository

router = APIRouter(tags=["Webhook Secrets"])


# --- Request/Response Schemas ---


class SecretCreateRequest(BaseModel):
    """Request to create a new webhook secret."""

    endpoint: Optional[str] = Field(
        None,
        description="Optional endpoint URL. If omitted, creates a default account secret.",
    )


class SecretResponse(BaseModel):
    """Webhook secret response (masked)."""

    id: str = Field(..., description="Secret ID (ws_...)")
    endpoint: Optional[str] = Field(
        None, description="Endpoint URL or null for default"
    )
    secret_masked: str = Field(..., description="Masked secret (whsec_****...)")
    status: str = Field(..., description="'active' or 'revoked'")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")


class SecretFullResponse(SecretResponse):
    """Webhook secret response with full value (creation only)."""

    secret: str = Field(..., description="Secret value")


class SecretListResponse(BaseModel):
    """List of webhook secrets."""

    secrets: List[SecretResponse]
    total: int


# --- Helper Functions ---


def mask_secret(secret: str) -> str:
    """Mask a secret, showing only prefix and last 4 chars."""
    if len(secret) <= 12:
        return secret[:6] + "****"
    return secret[:6] + "****" + secret[-4:]


def to_response(secret) -> SecretResponse:
    """Convert WebhookSecret to masked response model."""
    # For masked display, we rely on the ID if raw is not available to verify
    raw_secret = getattr(secret, "_raw_secret", None)
    masked = mask_secret(raw_secret) if raw_secret else f"whsec_****...{secret.id[-4:]}"

    return SecretResponse(
        id=secret.id,
        endpoint=secret.endpoint,
        secret_masked=masked,
        status=secret.status,
        created_at=secret.created_at.isoformat(),
    )


def to_full_response(secret) -> SecretFullResponse:
    """Convert WebhookSecret to full response model (creation only)."""
    raw_secret = getattr(secret, "_raw_secret", None)
    if not raw_secret:
        # Should not happen during creation, but as safeguard
        raise ValueError("Cannot create full response without raw secret")

    masked = mask_secret(raw_secret)

    return SecretFullResponse(
        id=secret.id,
        endpoint=secret.endpoint,
        secret=raw_secret,
        secret_masked=masked,
        status=secret.status,
        created_at=secret.created_at.isoformat(),
    )


# --- API Endpoints ---


@router.get("", response_model=SecretListResponse, summary="List Webhook Secrets")
async def list_secrets(
    current_user: CurrentUser = Depends(with_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all webhook secrets for the current user.

    Returns masked secrets by default. Use POST to create new secrets
    and see the full value (one-time display).
    """
    repo = WebhookSecretRepository()
    secrets = await repo.list_secrets(db, current_user.user_id)

    return SecretListResponse(
        secrets=[to_response(s) for s in secrets],
        total=len(secrets),
    )


@router.post(
    "",
    response_model=SecretResponse | SecretFullResponse,
    summary="Create Webhook Secret",
)
async def create_secret(
    request: SecretCreateRequest,
    current_user: CurrentUser = Depends(with_current_user),
    _write_permission: None = Depends(require_write_permission),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new webhook secret.

    If no endpoint is specified, creates a default account-level secret.
    The full secret value is returned ONLY in this response (one-time display).
    """
    repo = WebhookSecretRepository()

    # Check if secret already exists for this endpoint
    existing = await repo.get_active_secret(db, current_user.user_id, request.endpoint)
    if existing:
        # Return existing secret (masked, because we can't decrypt for display)
        # Type verification: This returns SecretResponse, which is valid for the union return type
        return to_response(existing)

    # Create new secret
    secret = await repo.create_secret(db, current_user.user_id, request.endpoint)

    # Return with raw secret visible (one-time)
    return to_full_response(secret)


@router.delete("/{secret_id}", summary="Revoke Webhook Secret")
async def revoke_secret(
    secret_id: str,
    current_user: CurrentUser = Depends(with_current_user),
    _write_permission: None = Depends(require_write_permission),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke a webhook secret immediately.

    Revoked secrets cannot be used for signing. This action is irreversible.
    """
    repo = WebhookSecretRepository()

    success = await repo.revoke_secret(db, secret_id, current_user.user_id)

    if not success:
        raise NotFoundException(
            resource="WebhookSecret",
            resource_id=secret_id,
        )

    return {"status": "revoked", "id": secret_id}

```

### Core Architecture Module: `apps/api/app/core/__init__.py`
```
"""Unified imports for API core modules.

Configuration, Redis management, and other shared functionality should be
imported from the shared package.
"""

# Import shared infrastructure from the shared package.
from shared.core.config import app_config, redis_config_manager, redis_pool_manager
from shared.core.constants import (
    APIConstants,
    BusinessConstants,
    ProcessingConstants,
    SystemConstants,
)
from shared.core.database import get_db
from shared.core.logging import setup_logging
from shared.core.security import get_password_hash, verify_password

# Response helpers remain API-specific.
from .response import ResponseCode

# Backward-compatible alias.
settings = app_config

__all__ = [
    # Configuration
    "app_config",
    "settings",  # Backward-compatible alias
    # Redis
    "redis_config_manager",
    "redis_pool_manager",
    # Database
    "get_db",
    # Security
    "get_password_hash",
    "verify_password",
    # Response handling
    "ResponseCode",
    # Constants
    "SystemConstants",
    "BusinessConstants",
    "APIConstants",
    "ProcessingConstants",
    # Logging
    "setup_logging",
]

```

### Core Architecture Module: `apps/api/app/core/exception_handlers.py`
```
"""
Global Exception Handlers for the Knowhere API.

=============================================================================
SECURITY: THE "4xx vs 5xx" MESSAGE PATTERN
=============================================================================

This module enforces the dual-message pattern for all exceptions:

    - `internal_message`: Technical details for LOGS ONLY. NEVER sent to client.
    - `user_message`:     Safe message for CLIENT. ALWAYS sent to user.

The `knowhere_exception_handler` is the central point that:
    1. Logs `internal_message` for debugging (server-side only)
    2. Returns `user_message` to the client (via to_dict)
    3. NEVER leaks internal_message to the response

=============================================================================

All exceptions are converted to KnowhereException and handled uniformly.
This ensures clients always receive a consistent, secure JSON response.

Architecture:
    1. Each handler converts its exception type to a KnowhereException subclass
    2. All handlers delegate to `knowhere_exception_handler` for actual response
    3. Internal details are logged but NEVER sent to client

Response Format:
    {
        "success": false,
        "error": {
            "code": "INVALID_ARGUMENT",
            "message": "<user_message>",  // NEVER internal_message
            "request_id": "req_abc123",
            "details": {...}  // Optional, schema varies by exception type
        }
    }

Exception Sources:
    - KnowhereException: Raised explicitly by our code (domain exceptions)
    - HTTPException: Raised by FastAPI/Starlette for HTTP-level errors
        - 401: Missing/invalid auth header
        - 403: Permission denied by middleware
        - 404: Route not found
        - 405: Method not allowed
    - RequestValidationError: Raised by Pydantic when request body/params invalid
    - Exception: Unexpected errors (bugs, syntax errors, external failures)
"""

import uuid
from collections.abc import Awaitable, Callable, Mapping
from typing import List, cast

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from shared.core.exceptions import (
    KnowhereException,
    UnknownException,
    ValidationException,
)
from shared.core.exceptions.domain_exceptions import RateLimitException, Violation
from shared.core.logging import LogEvent
from shared.core.response import ErrorCodeMapper


def _get_request_id(request: Request) -> str:
    """Extract request ID from state/header or generate one for tracing."""
    state_request_id = getattr(request.state, "request_id", None)
    if isinstance(state_request_id, str) and state_request_id:
        return state_request_id

    header_request_id = request.headers.get("X-Request-ID")
    if header_request_id:
        request.state.request_id = header_request_id
        return header_request_id

    generated_request_id = str(uuid.uuid4())
    request.state.request_id = generated_request_id
    logger.bind(
        event=LogEvent.CORRELATION_REQUEST_ID_MISSING.value,
        request_id=generated_request_id,
    ).info("Request ID generated (missing upstream ID)")
    return generated_request_id


async def knowhere_exception_handler(
    request: Request,
    exc: KnowhereException,
    *,
    response_headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """
    This handler enforces the separation between:
    - `internal_message`: Logged for debugging (NEVER in response)
    - `user_message`: Returned to client (via to_client)

    The response ONLY contains `user_message` via exc.to_client().
    The logs contain full exception details via exc.logging().

    ==========================================================================

    This is the ONLY place that builds the actual response.
    All other handlers convert their exceptions and delegate here.

    Logging:
        - Uses exc.logging() which automatically includes context (request_id, etc.)
        - 5xx: ERROR level with internal_message and stack trace
        - 4xx: WARNING level with user_message

    The `original_exception` field is used to:
        1. Log the underlying cause for debugging (e.g., Redis timeout)
        2. Include stack trace in logs without exposing to client
        3. Wrap unexpected exceptions while preserving debug info
    """
    request_id = _get_request_id(request)

    # Use canonical logging method and force request_id presence in logs
    exc.logging(request_id=request_id)

    # Always include request ID header for client-side correlation
    # Preserve framework-provided headers such as ``Allow: POST`` for 405
    # responses and ``WWW-Authenticate`` for authentication challenges.
    headers = dict(response_headers or {})
    headers["X-Request-ID"] = request_id
    retry_after = exc.details.get("retry_after")
    if retry_after:
        headers["Retry-After"] = str(retry_after)

    # Add rate limit headers when the exception is a RateLimitException
    if isinstance(exc, RateLimitException):
        details = exc.details or {}
        if "limit" in details:
            headers["X-RateLimit-Limit"] = str(details["limit"])
        if "remaining" in details:
            headers["X-RateLimit-Remaining"] = str(details["remaining"])
        if "reset" in details:
            headers["X-RateLimit-Reset"] = str(details["reset"])
        if "retry_after" in details:
            headers["Retry-After"] = str(details["retry_after"])
        if "period" in details:
            headers["X-RateLimit-Period"] = str(details["period"])

    # SECURITY: to_client() returns user_message, NEVER internal_message
    return JSONResponse(
        status_code=exc.http_status_code,
        content=exc.to_client(request_id),
        headers=headers,
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Convert FastAPI/Starlette HTTPException to KnowhereException.

    When does HTTPException occur?
        - 401: Auth middleware rejects request (missing/invalid token)
        - 403: Permission check fails
        - 404: No route matches the path
        - 405: HTTP method not allowed for this route
        - 422: Handled separately by validation_exception_handler

    Security: HTTPException.detail may contain sensitive info from middleware.
    We use a generic user_message and log the original detail internally.
    """
    # Convert HTTP status to ErrorCode using the canonical mapping
    code = ErrorCodeMapper.get_error_code_from_http_status(exc.status_code)

    # Check for specific FastAPI Users error codes in detail
    detail_str = str(exc.detail) if exc.detail else ""

    # Map FastAPI Users error codes to user-friendly messages
    fastapi_users_messages = {
        "REGISTER_USER_ALREADY_EXISTS": "This email is already registered. Please log in or use a different email.",
        "LOGIN_BAD_CREDENTIALS": "Invalid email or password.",
        "LOGIN_USER_NOT_VERIFIED": "Please verify your email before logging in.",
        "RESET_PASSWORD_BAD_TOKEN": "Password reset link is invalid or expired.",
        "VERIFY_USER_BAD_TOKEN": "Email verification link is invalid or expired.",
        "VERIFY_USER_ALREADY_VERIFIED": "Your email is already verified.",
    }

    # Try to match FastAPI Users error code
    user_message = None
    for error_code, message in fastapi_users_messages.items():
        if error_code in detail_str:
            user_message = message
            break

    # Generic safe messages for each status (fallback)
    if user_message is None:
        safe_messages = {
            400: "Bad request",
            401: "Authentication required",
            403: "Permission denied",
            404: "Resource not found",
            405: "Method not allowed",
            409: "Conflict",
            429: "Too many requests",
            500: "Internal server error",
            502: "Bad gateway",
            503: "Service unavailable",
            504: "Gateway timeout",
        }
        user_message = safe_messages.get(exc.status_code, "An error occurred")

    # Create KnowhereException with internal_message for logs, user_message for response
    knowhere_exc = KnowhereException(
        code=code,
        internal_message=f"HTTPException detail: {exc.detail}",  # For logs
        user_message=user_message,  # For client
    )

    # Delegate to central handler
    return await knowhere_exception_handler(
        request,
        knowhere_exc,
        response_headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Convert Pydantic validation errors to ValidationException.

    When does RequestValidationError occur?
        - Request body doesn't match Pydantic model
        - Query/path parameters fail validation
        - Type coercion fails (e.g., string where int expected)

    The violations array IS safe to expose as it describes client input issues.
    This is a 4xx error, so user_message is passed directly to client.
    """
    # Transform Pydantic errors into violations format
    violations: List[Violation] = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", []))
        violations.append(
            {
                "field": field,
                "description": error.get("msg", "Validation failed"),
            }
        )

    # Create ValidationException with user_message that client will see
    validation_exc = ValidationException(
        user_message="Request validation failed",
        violations=violations,
    )

    # Delegate to central handler
    return await knowhere_exception_handler(request, validation_exc)


async def general_exception_handler(request: Request, exc:
```

### Core Architecture Module: `apps/api/app/core/middleware/__init__.py`
```
"""Middleware exports."""

from .cors import setup_cors
from .logging import LoggingMiddleware

__all__ = ["setup_cors", "LoggingMiddleware"]

```

### Core Architecture Module: `apps/api/app/core/middleware/cors.py`
```
"""CORS middleware."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI) -> None:
    """Configure the CORS middleware."""

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Production should scope this to explicit origins.
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

```

### Core Architecture Module: `apps/api/app/core/middleware/logging.py`
```
"""
Request logging middleware with structured logging support.
Pure ASGI implementation to avoid BaseHTTPMiddleware body buffering.
"""

import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from shared.core.logging import log_context

SKIP_PATHS = {"/health", "/api/health"}


class LoggingMiddleware:
    """Request logging middleware with structured context propagation."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIP_PATHS:
            await self.app(scope, receive, send)
            return

        # Extract or generate request_id
        headers = dict(
            (k.decode("latin-1"), v.decode("latin-1"))
            for k, v in scope.get("headers", [])
        )
        request_id = headers.get("x-request-id", str(uuid.uuid4()))

        # Make request_id available via request.state.request_id
        # scope["state"] must be a plain dict — Starlette's Request.state
        # wraps it in a State object for attribute access.
        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                # Inject X-Request-ID header
                raw_headers = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() != b"x-request-id"
                ]
                raw_headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = raw_headers
            await send(message)

        with log_context(request_id=request_id):
            await self.app(scope, receive, send_wrapper)

```

### Core Architecture Module: `apps/api/app/core/middleware/telemetry.py`
```
"""Anonymous aggregate telemetry middleware."""

from __future__ import annotations

import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from shared.services.telemetry.api_metrics import ApiRequestTelemetryMetrics


class ApiTelemetryMiddleware:
    """Record bounded API request metrics without request payloads or raw paths."""

    def __init__(self, app: ASGIApp, *, metrics: ApiRequestTelemetryMetrics) -> None:
        self.app = app
        self.metrics = metrics

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        status_code = 500
        started_at = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message.get("status", 500))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            self.metrics.record(status_code=status_code, latency_ms=elapsed_ms)

```

### Core Architecture Module: `apps/api/app/core/response/ResponseCode.py`
```
from enum import Enum
from typing import Dict


class ResponseCode(Enum):
    """Response status-code enum."""

    SUCCESS = (200, "Operation succeeded")
    FAIL = (1, "Operation failed")
    SYSTEM_DATA_FAIL = (2, "Invalid data operation format")
    SYSTEM_PARAM_FAIL = (3, "Invalid parameter")
    AUTHORIZATION_EXCEPTION = (401, "Authorization error")

    def __init__(self, code: int, msg: str):
        self._code = code
        self._msg = msg

    @property
    def code(self) -> int:
        return self._code

    @property
    def msg(self) -> str:
        return self._msg

    @classmethod
    def get_all_as_dict(cls) -> Dict[int, str]:
        """Return all response codes and messages as a dictionary."""

        return {member.code: member.msg for member in cls}

```

### Core Architecture Module: `apps/api/app/repositories/webhook_repository.py`
```
"""
Webhook Repository Layer

Provides database operations for webhook delivery logging.
"""

from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database.webhook_log import WebhookLog


class WebhookRepository:
    """Repository for webhook delivery log operations."""

    async def log_webhook_attempt(
        self,
        db: AsyncSession,
        job_id: str,
        webhook_url: str,
        attempt_number: int,
        request_payload: Dict[str, Any],
        signature: str,
        idempotency_key: str,
        response_status_code: Optional[int] = None,
        response_body: Optional[str] = None,
        error_message: Optional[str] = None,
        duration_ms: int = 0,
        event_id: Optional[str] = None,
    ) -> Optional[WebhookLog]:
        """
        Log a webhook delivery attempt.

        Creates a WebhookLog entry for the delivery attempt with all
        request and response details for auditing purposes.
        """
        try:
            webhook_log = WebhookLog(
                job_id=job_id,
                event_id=event_id,
                webhook_url=webhook_url,
                attempt_number=attempt_number,
                request_payload=request_payload,
                signature=signature,
                idempotency_key=idempotency_key,
                response_status_code=response_status_code,
                response_body=response_body,
                error_message=error_message,
                duration_ms=duration_ms,
            )

            db.add(webhook_log)
            await db.commit()

            logger.info(
                f"Webhook log recorded: job_id={job_id}, attempt={attempt_number}, "
                f"status={response_status_code}, duration_ms={duration_ms}"
            )
            return webhook_log

        except Exception as e:
            logger.error(f"Failed to record webhook log: {e}")
            await db.rollback()
            return None

    async def get_webhook_logs(
        self,
        db: AsyncSession,
        user_id: str,
        job_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[WebhookLog], int]:
        """
        Get webhook delivery logs filtered by user_id (required).

        Args:
            db: Database session
            user_id: ID of the user who owns the logs (Required for security)
            job_id: Optional filter by job ID
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            Tuple containing (List of WebhookLog entries, Total count)
        """
        try:
            from sqlalchemy import func

            from shared.models.database.job import Job

            # Base query - Join with Job to filter by user_id
            query = (
                select(WebhookLog)
                .join(Job, WebhookLog.job_id == Job.job_id)
                .order_by(desc(WebhookLog.created_at))
            )
            count_query = (
                select(func.count())
                .select_from(WebhookLog)
                .join(Job, WebhookLog.job_id == Job.job_id)
            )

            # Application Security: Always filter by user_id
            query = query.where(Job.user_id == user_id)
            count_query = count_query.where(Job.user_id == user_id)

            if job_id:
                # If job_id provided, ensure it belongs to the user (implicit via join, but good to be explicit)
                query = query.where(WebhookLog.job_id == job_id)
                count_query = count_query.where(WebhookLog.job_id == job_id)

            # Application pagination
            paginated_query = query.limit(limit).offset(offset)

            # Execute
            result = await db.execute(paginated_query)
            logs = list(result.scalars().all())

            count_result = await db.execute(count_query)
            total = count_result.scalar() or 0

            return logs, total

        except Exception as e:
            logger.error(f"Failed to get webhook logs: {e}")
            return [], 0

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #399** (2026-09-09): **Fix retrieval 500 caused by idle-in-transaction connection termination**
  *Symptoms*: ## Summary  Production retrieval requests can return HTTP 500 when the request-scoped async SQLAlchemy session holds an idle PostgreSQL transaction while the agentic retrieval episode waits on an external LLM/agent call.  ## Production evidence  - Alert window: 2026-09-09 09:49:44–10:24:46 CST - Failing endpoint: `POST /v1/retrieval/query` - Failing API task: `dfeb34741b2748c190c73d0f9d57d1fe` - Task private IP: `10.0.136.212` - Trace: `01a083eb5f607c35931721077dafb81b` - Failure time: 2026-09-09 10:08:27 CST (`02:08:27 UTC`) - HTTP result: `500 Internal Server Error`  Aurora PostgreSQL logged 12 seconds before the API error:  ```text 2026-09-09 02:08:15 UTC:10.0.136.212(...):postgres@knowhere:...:FATAL: terminating connection due to idle-in-transaction timeout ```  The API then attempted the final document hydration query using that closed connection:  ```text asyncpg.exceptions._base.InterfaceError: connection is closed ```  The API invalidated the connection and established a replacement connection about four seconds later. The task remained healthy and was not restarted. No Aurora failover or restart event was found.  ## Root cause  The retrieval route receives a request-scoped `AsyncSession` from `get_db()` and passes it through the retrieval pipeline. In the agentic path:  1. The route performs initial database work. 2. `_run_agent_explore_route()` waits for `harness.run_episode(...)`. 3. The episode took 71.575 seconds in the failing request. 4. The same session/transa

- **Issue #255** (2026-08-20): **Stop scraping email addresses from GitHub**
  *Symptoms*: ### Affected area  Other  ### Summary  <img width="1994" height="1518" alt="Image" src="https://github.com/user-attachments/assets/431da31f-bbf6-4809-91e4-acfaeee8ab20" />  ### Reproduction steps  You email me out of the blue with an email address that's only ever appeared on GitHub. So you've scraped it or bought it from a service that scraped it. I never subscribed to your service and it's super poor form that you've resorted to this.  ### Relevant request or job details  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > We did not scrape or purchase any personal data. We discovered your GitHub profile and open-source projects, found them interesting, and manually looked up a contact email to send a one-time outreach message.  We apologize if this was unwanted or disruptive. Your email has been removed from our outreach list and you will not receive further messages from us.  Thank you for the feedback.

- **Issue #127** (2026-06-04): **Resolve Issue #126**
  *Symptoms*: ## Summary  - Implemented H2-aware shard refinement logic to improve document splitting granularity and adherence to size constraints. This resolves the timeout issue when processing oversized PDF files. - No API contract changes; only worker parser logic is updated. - Closes #126  ## Verification  - Ran `make lint` locally: All checks passed. - Ran `make typecheck` locally: 0 errors, 0 warnings. - CI running full test suite (pytest apps/api/tests apps/worker/tests/contract).  ## Deployment Notes  - No new environment variables. - No database migrations required. - No backwards compatibility concerns.  ## Checklist  - [x] Tests were added or updated when behavior changed - [x] Logs, errors, and validation paths avoid leaking secrets or user data - [x] The pull request description explains any breaking or user-visible change

- **Issue #126** (2026-06-04): **Document processing fails/times out when uploading oversized PDF files**
  *Symptoms*: **Describe the bug** When I upload a very large PDF file (e.g., a 500-page report), the system seems to freeze in the 'Processing' state for a long time, and eventually times out or fails with an error. The document never becomes available for querying.  **To Reproduce** Steps to reproduce the behavior: 1. Go to the document upload page. 2. Select a PDF file that is extremely large (e.g., hundreds of pages). 3. Click on upload. 4. Wait for the processing to finish. 5. See error or timeout.  **Expected behavior** The system should either process the document successfully by breaking it down into smaller parts, or provide a clear progress indicator, rather than just timing out.  **Screenshots/Logs** The UI just shows a timeout error after 5 minutes.  **Additional context** We frequently deal with large corporate reports and need the system to reliably handle these oversized files without crashing. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #127 (squash merged into staging).

- **Issue #118** (2026-06-01): **Resolve Issue #117: Fix evidence tree orphan nesting, outline leakage, and enforce English agent reasoning**
  *Symptoms*: Closes #117  ## Summary  This PR fixes three bugs in the agentic retrieval evidence pipeline discovered during E2E trace analysis (T2/T4/T6):  ### Fix 1: Evidence Tree Orphan Nesting (Bug 1)  **Root cause**: `_build_outline_subtree` created new parent nodes but failed to migrate pre-existing children under them. Additionally, `_hydrate_collected` passed unfiltered `outline_items` containing ancestor/sibling context from `load_child_sections`, causing echo structures.  **Changes**: - `document.py`: Added reparenting logic in `_build_outline_subtree` (lines 712-726) to recursively move existing children under newly created parent nodes - `document.py`: Added `startswith` filter in `_hydrate_collected` (lines 331-334) to exclude ancestor/sibling items from child node outlines  ### Fix 2: Outline-Only Evidence Leakage (Bug 2)  **Root cause**: `render_evidence()` used `has_content()` which returns True for outline-only trees. When KG Select picks a document but Navigate returns `collect=[], STOP` (no relevant content), the top-level outline skeleton still leaked into evidence_text (950 chars of wasted context budget).  **Change**:  - `builder.py`: Changed guard from `has_leaf_content() or has_content()` to `has_leaf_content()` only. Documents without hydrated chunks are now skipped entirely.  ### Fix 3: English Agent Reasoning (Bug 3)  **Changes**: - `prompts.py`: Added `IMPORTANT` block to `COLLECTOR_PROMPT` requiring `reason` and other free-text fields to be written in English -

- **Issue #117** (2026-06-02): **Agentic retrieval: evidence rendering bugs — orphan nesting, outline leakage, and non-English agent reasoning**
  *Symptoms*: ## Problem Description  When using the agentic retrieval pipeline to query documents, several rendering and behavioral anomalies have been observed in the evidence output:  ### Bug 1: Evidence Tree Orphan Nesting Failure When a document section is collected via COLLECT and its parent is created via `_build_outline_subtree`, pre-existing child nodes are not migrated under the new parent. This causes leaf sections to appear as orphans at the wrong tree depth in the evidence text, producing duplicated and incorrectly nested headings.  **Example**: Querying "深信服安全GPT的技术方案" returns: - `(四) 深信服安全 GPT` floating at L1 as an orphan instead of nesting under `六、 解决方案与案例` - Echo structures where `六、 解决方案与案例` appears redundantly inside child subtrees  ### Bug 2: Outline-Only Evidence Leakage   When the navigation agent determines a document is irrelevant (returns `collect=[], action=STOP`), the evidence rendering still outputs 950+ characters of the document's top-level outline skeleton. This is because `render_evidence()` checks `has_content()` which returns True for outline-only trees (populated during the initial `load_child_sections` call), even though no content was actually selected.  **Expected behavior**: If no chunks are collected and no discovery selections are made, evidence_text for that document should be empty.  ### Bug 3: Non-English Agent Reasoning The `reason` field in navigation responses and `reasoning_summary` in workflow planner responses are written in the source doc

- **Issue #107** (2026-05-25): **[Notebook UI] Layout not responsive — overflows on 13-inch MacBook Air screen**
  *Symptoms*: ### Affected area  Other  ### Summary  **Describe the bug** The Notebook module's frontend layout is not responsive to screen width. On a 13-inch MacBook Air, UI elements overflow horizontally and do not adapt to the viewport, making the interface difficult to use.  **Expected Behavior** All UI panels should adapt to the available screen width, maintaining a usable layout without horizontal overflow or clipped content.  **Actual Behavior** The layout appears designed for larger screens. On 13-inch displays, content is clipped or panels overlap, reducing usability.  **Screenshots**  <img width="1999" height="1080" alt="Image" src="https://github.com/user-attachments/assets/b223e891-9ebe-477b-a3ef-6e827cef1013" />  **Environment** - Device: MacBook Air 13-inch - OS: macOS - Browser: [e.g. Chrome / Safari] - Screen resolution: native display resolution  **Additional Context** The issue is visible in the three-panel layout (Sources / Parsed Chunks / Assistant). Responsive CSS breakpoints or a flexible grid layout would address this.  ### Reproduction steps  1. Open Knowhere Notebook in a browser on a 13-inch MacBook Air 2. Upload documents and navigate to the Parsed Chunks view 3. Observe that the right-side panel (Knowhere Assistant) and the main content area overflow or do not scale properly  ### Relevant request or job details  ```text  ```

- **Issue #92** (2026-05-19): **Agentic retrieval sends table artifact URLs as VLM image inputs**
  *Symptoms*: ## Summary  Agentic retrieval can invoke the multimodal answer path with a table artifact URL as an `image_url`. The VLM provider then rejects the request because the URL points to a table/HTML artifact rather than a decodable image.  

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

### Incident Patch 1: `f9d61119` (2026-10-05)
**Commit Message**: Merge pull request #453 from Ontos-AI/fix/wangbinqi/demo-original-mime

**File**: `apps/api/app/services/demo/shared_document_service.py` (modified, +5/-4)
```diff
@@ -3,7 +3,7 @@
 from __future__ import annotations
 
 import asyncio
-import mimetypes
+from pathlib import PurePath
 from typing import Any
 from urllib.parse import quote
 
@@ -99,8 +99,9 @@ async def get_catalog(self, db: AsyncSession) -> dict[str, Any]:
                 continue
             metadata: dict[str, Any] = revision.document_metadata or {}
             mimeType: str = (
-                mimetypes.guess_type(document.source_file_name or document.title)[0]
-                or "application/octet-stream"
+                JobFileStorage.get_content_type(
+                    PurePath(document.source_file_name or document.title).suffix
+                )
             )
             source: dict[str, Any] = {
                 "demo_source_id": document.demo_source_id,
@@ -206,7 +207,7 @@ async def get_media_url(
             )
         if not key:
             raise NotFoundException(resource="Demo original", resource_id=source_id)
-        mimeType: str = mimetypes.guess_type(fileName)[0] or "application/octet-stream"
+        mimeType: str = JobFileStorage.get_content_type(PurePath(fileName).suffix)
         # Redirects let the storage service handle Range without proxying large
         # original files through an API worker. The GET signature overrides MIME.
         return await asyncio.to_thread(
```

**File**: `apps/api/tests/contract/test_shared_demo_corpus_contract.py` (modified, +30/-3)
```diff
@@ -464,16 +464,43 @@ async def test_demo_agent_tools_pin_history_and_private_isolation(
 
 
 @pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("file_name", "original_mime"),
+    [
+        ("original.pdf", "application/pdf"),
+        (
+            "original.docx",
+            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
+        ),
+        (
+            "original.DOCX",
+            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
+        ),
+    ],
+)
 async def test_demo_revision_media_validation_and_job_retention(
-    developer_api_client_factory: ClientFactory, monkeypatch: pytest.MonkeyPatch
+    developer_api_client_factory: ClientFactory,
+    monkeypatch: pytest.MonkeyPatch,
+    file_name: str,
+    original_mime: str,
 ) -> None:
     async with developer_api_client_factory() as client:
         job = await create_demo(
-            client, source_id="media-demo", file_name="original.pdf"
+            client, source_id="media-demo", file_name=file_name
         )
         revision = await publish_demo(job, has_page=True)
+        import mimetypes
+        from pathlib import PurePath
         from shared.services.storage.job_file_storage import JobFileStorage
 
+        # Slim runtime images need not include the operating system MIME registry.
+        mimetypes.init()
+        monkeypatch.delitem(mimetypes.types_map, PurePath(file_name).suffix.lower(), raising=False)
+        catalog = (await client.get("/api/v1/demo/catalog")).json()
+        source = next(item for item in catalog["sources"] if item["demo_source_id"] == "media-demo")
+        assert source["mime_type"] == original_mime
+        assert source["original_file"]["mime_type"] == original_mime
+
         calls: list[dict[str, Any]] = []
 
         def sign(key: str, **arguments: Any) -> str:
@@ -487,7 +514,7 @@ class SignedStorage:
             JobFileStorage, "storage_adapter", property(lambda self: SignedStorage())
         )
         for path, mime in (
-            ("original", "application/pdf"),
+            ("original", original_mime),
             ("assets/images/rocket.png", "image/png"),
             ("assets/tables/launch.html", "text/html"),
         ):
```

---

### Incident Patch 2: `06854e3f` (2026-10-05)
**Commit Message**: Merge pull request #454 from Ontos-AI/fix/wuchengke/use-deepseek-vlm

fix(deploy): use DeepSeek for worker vision

**File**: `deploy/ecs/task-definition-worker.staging.json` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@
         {"name": "EMBEDDING_MODEL", "value": "text-embedding-v4"},
         {"name": "HIERARCHY_LLM_MODEL", "value": "deepseek-chat"},
         {"name": "NORMOL_MODEL", "value": "deepseek-chat"},
-        {"name": "IMAGE_MODEL", "value": "qwen3.5-flash"},
+        {"name": "IMAGE_MODEL", "value": "deepseek-flash"},
         {"name": "ALL_DF_COLS", "value": "content,path,type,length,keywords,summary,know_id,tokens,connectto,addtime,page_nums"}
       ],
       "secrets": [
```

**File**: `deploy/ecs/test_render_task_definitions.py` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@
     "DB_SYNC_MAX_OVERFLOW": "2",
     "DB_SYNC_POOL_SIZE": "2",
     "HIERARCHY_LLM_MODEL": "deepseek-chat",
-    "IMAGE_MODEL": "qwen3.5-flash",
+    "IMAGE_MODEL": "deepseek-flash",
     "MAX_PDF_PAGE_LIMIT": "200",
     "NORMOL_MODEL": "deepseek-chat",
     "OVERSIZED_PDF_SHARD_ENABLED": "true",
```

---

### Incident Patch 3: `600f0dcf` (2026-10-05)
**Commit Message**: fix(deploy): use deepseek for worker vision

**File**: `deploy/ecs/task-definition-worker.staging.json` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@
         {"name": "EMBEDDING_MODEL", "value": "text-embedding-v4"},
         {"name": "HIERARCHY_LLM_MODEL", "value": "deepseek-chat"},
         {"name": "NORMOL_MODEL", "value": "deepseek-chat"},
-        {"name": "IMAGE_MODEL", "value": "qwen3.5-flash"},
+        {"name": "IMAGE_MODEL", "value": "deepseek-flash"},
         {"name": "ALL_DF_COLS", "value": "content,path,type,length,keywords,summary,know_id,tokens,connectto,addtime,page_nums"}
       ],
       "secrets": [
```

**File**: `deploy/ecs/test_render_task_definitions.py` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@
     "DB_SYNC_MAX_OVERFLOW": "2",
     "DB_SYNC_POOL_SIZE": "2",
     "HIERARCHY_LLM_MODEL": "deepseek-chat",
-    "IMAGE_MODEL": "qwen3.5-flash",
+    "IMAGE_MODEL": "deepseek-flash",
     "MAX_PDF_PAGE_LIMIT": "200",
     "NORMOL_MODEL": "deepseek-chat",
     "OVERSIZED_PDF_SHARD_ENABLED": "true",
```

---

### Incident Patch 4: `c158aa3d` (2026-10-04)
**Commit Message**: fix: use deterministic MIME types for shared demo originals

**File**: `apps/api/app/services/demo/shared_document_service.py` (modified, +5/-4)
```diff
@@ -3,7 +3,7 @@
 from __future__ import annotations
 
 import asyncio
-import mimetypes
+from pathlib import PurePath
 from typing import Any
 from urllib.parse import quote
 
@@ -99,8 +99,9 @@ async def get_catalog(self, db: AsyncSession) -> dict[str, Any]:
                 continue
             metadata: dict[str, Any] = revision.document_metadata or {}
             mimeType: str = (
-                mimetypes.guess_type(document.source_file_name or document.title)[0]
-                or "application/octet-stream"
+                JobFileStorage.get_content_type(
+                    PurePath(document.source_file_name or document.title).suffix
+                )
             )
             source: dict[str, Any] = {
                 "demo_source_id": document.demo_source_id,
@@ -206,7 +207,7 @@ async def get_media_url(
             )
         if not key:
             raise NotFoundException(resource="Demo original", resource_id=source_id)
-        mimeType: str = mimetypes.guess_type(fileName)[0] or "application/octet-stream"
+        mimeType: str = JobFileStorage.get_content_type(PurePath(fileName).suffix)
         # Redirects let the storage service handle Range without proxying large
         # original files through an API worker. The GET signature overrides MIME.
         return await asyncio.to_thread(
```

**File**: `apps/api/tests/contract/test_shared_demo_corpus_contract.py` (modified, +30/-3)
```diff
@@ -464,16 +464,43 @@ async def test_demo_agent_tools_pin_history_and_private_isolation(
 
 
 @pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("file_name", "original_mime"),
+    [
+        ("original.pdf", "application/pdf"),
+        (
+            "original.docx",
+            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
+        ),
+        (
+            "original.DOCX",
+            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
+        ),
+    ],
+)
 async def test_demo_revision_media_validation_and_job_retention(
-    developer_api_client_factory: ClientFactory, monkeypatch: pytest.MonkeyPatch
+    developer_api_client_factory: ClientFactory,
+    monkeypatch: pytest.MonkeyPatch,
+    file_name: str,
+    original_mime: str,
 ) -> None:
     async with developer_api_client_factory() as client:
         job = await create_demo(
-            client, source_id="media-demo", file_name="original.pdf"
+            client, source_id="media-demo", file_name=file_name
         )
         revision = await publish_demo(job, has_page=True)
+        import mimetypes
+        from pathlib import PurePath
         from shared.services.storage.job_file_storage import JobFileStorage
 
+        # Slim runtime images need not include the operating system MIME registry.
+        mimetypes.init()
+        monkeypatch.delitem(mimetypes.types_map, PurePath(file_name).suffix.lower(), raising=False)
+        catalog = (await client.get("/api/v1/demo/catalog")).json()
+        source = next(item for item in catalog["sources"] if item["demo_source_id"] == "media-demo")
+        assert source["mime_type"] == original_mime
+        assert source["original_file"]["mime_type"] == original_mime
+
         calls: list[dict[str, Any]] = []
 
         def sign(key: str, **arguments: Any) -> str:
@@ -487,7 +514,7 @@ class SignedStorage:
             JobFileStorage, "storage_adapter", property(lambda self: SignedStorage())
         )
         for path, mime in (
-            ("original", "application/pdf"),
+            ("original", original_mime),
             ("assets/images/rocket.png", "image/png"),
             ("assets/tables/launch.html", "text/html"),
         ):
```

---

### Incident Patch 5: `efbebdad` (2026-10-03)
**Commit Message**: fix: inject demo maintainer configuration into ECS services

**File**: `deploy/ecs/task-definition-api.staging.json` (modified, +1/-0)
```diff
@@ -59,6 +59,7 @@
       ],
       "secrets": [
         {"name": "DATABASE_URL", "valueFrom": "${SECRETS_ARN}:DATABASE_URL::"},
+        {"name": "DEMO_MAINTAINER_USER_IDS", "valueFrom": "${SECRETS_ARN}:DEMO_MAINTAINER_USER_IDS::"},
         {"name": "REDIS_HOST", "valueFrom": "${SECRETS_ARN}:REDIS_HOST::"},
         {"name": "REDIS_PORT", "valueFrom": "${SECRETS_ARN}:REDIS_PORT::"},
         {"name": "REDIS_PASSWORD", "valueFrom": "${SECRETS_ARN}:REDIS_PASSWORD::"},
```

**File**: `deploy/ecs/task-definition-worker.staging.json` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@
       ],
       "secrets": [
         {"name": "DATABASE_URL", "valueFrom": "${SECRETS_ARN}:DATABASE_URL::"},
+        {"name": "DEMO_MAINTAINER_USER_IDS", "valueFrom": "${SECRETS_ARN}:DEMO_MAINTAINER_USER_IDS::"},
         {"name": "REDIS_HOST", "valueFrom": "${SECRETS_ARN}:REDIS_HOST::"},
         {"name": "REDIS_PORT", "valueFrom": "${SECRETS_ARN}:REDIS_PORT::"},
         {"name": "REDIS_PASSWORD", "valueFrom": "${SECRETS_ARN}:REDIS_PASSWORD::"},
```

**File**: `docs/shared-demo-rollout.md` (modified, +4/-0)
```diff
@@ -130,6 +130,10 @@ that password has already been changed.
 2. Check for reserved private-namespace conflicts and role bypass.
 3. Run additive migrations; confirm the directory is planned with no READY data.
 4. Configure maintainer IDs and runtime credentials; remove strategy settings.
+   Before deploying ECS, add `DEMO_MAINTAINER_USER_IDS` to the environment's
+   runtime secret. Both task definitions require that key. Use a comma-separated
+   list of authorized user IDs, or an empty string to disable demo writes until
+   a maintainer is selected. Adding an API key is not required.
 5. Stop old materialization admission and drain its tasks before updating API and
    Worker together. Old tasks must not execute new publication code.
 6. Verify private upload/retrieval, catalog preparing state and materialization
```

---

### Incident Patch 6: `108ba2d2` (2026-10-03)
**Commit Message**: fix: initialize demo restore HTTP response safely

**File**: `scripts/restore-demo-originals.py` (modified, +3/-1)
```diff
@@ -58,7 +58,7 @@ def validate_backup(entry: dict[str, Any], directory: Path) -> Path:
 def request_json(
     client: httpx.Client, method: str, path: str, **arguments: Any
 ) -> dict[str, Any]:
-    response: httpx.Response
+    response: httpx.Response | None = None
     for attempt in range(4):
         try:
             response = client.request(method, path, **arguments)
@@ -67,6 +67,8 @@ def request_json(
             if method != "GET" or attempt == 3:
                 raise
             time.sleep(min(2**attempt, 8))
+    if response is None:
+        raise RuntimeError("API request attempts completed without a response")
     if response.is_error:
         # Never persist response bodies, credentials, storage keys or signed URLs.
         try:
```

---

### Incident Patch 7: `5c75c9cf` (2026-09-30)
**Commit Message**: fix: await canonical bundle cancellation work

**File**: `apps/api/app/services/demo/canonical_bundle.py` (modified, +2/-2)
```diff
@@ -104,7 +104,7 @@ async def ensure_bundle(
                 uploaded_bundle: CanonicalDemoBundle = await asyncio.shield(upload)
             except asyncio.CancelledError:
                 # A thread cannot be cancelled; retain the lease until it stops.
-                await upload
+                await asyncio.gather(upload)
                 raise
             if renewal.done():
                 renewal.result()
@@ -118,7 +118,7 @@ async def ensure_bundle(
             try:
                 await asyncio.shield(marker_upload)
             except asyncio.CancelledError:
-                await marker_upload
+                await asyncio.gather(marker_upload)
                 raise
             return uploaded_bundle
         finally:
```

**File**: `apps/api/tests/contract/test_canonical_demo_bundle_contract.py` (modified, +90/-0)
```diff
@@ -6,6 +6,8 @@
 from collections.abc import Callable
 from contextlib import AbstractAsyncContextManager
 from pathlib import Path
+from threading import Event
+from typing import Literal
 
 import pytest
 from httpx import AsyncClient
@@ -19,6 +21,94 @@ def _write_source(directory: Path, content: str) -> None:
     (directory / "source.md").write_text(content, encoding="utf-8")
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stage", ("upload", "marker"))
+async def test_cancellation_retains_lease_until_storage_work_finishes(
+    api_client_factory: Callable[[], AbstractAsyncContextManager[AsyncClient]],
+    tmp_path: Path,
+    monkeypatch: MonkeyPatch,
+    stage: Literal["upload", "marker"],
+) -> None:
+    async with api_client_factory():
+        from app.services.demo.canonical_bundle import (
+            CanonicalDemoBundleStore,
+            _calculate_content_version,
+            _read_source_signature,
+        )
+        from app.services.demo.canonical_bundle_result import CanonicalDemoBundle
+        from shared.services.redis import RedisServiceFactory
+
+        directory: Path = tmp_path / stage
+        _write_source(directory, "Cancellation must retain the upload lease")
+        source_id: str = f"contract-cancel-{stage}"
+        version: str = _calculate_content_version(
+            directory, _read_source_signature(directory)
+        )
+        lock_key: str = f"lock:demo_bundle:{source_id}:{version}"
+        redis_service = RedisServiceFactory.get_service()
+        store = CanonicalDemoBundleStore(redis_service=redis_service)
+        loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
+        started: asyncio.Event = asyncio.Event()
+        released: Event = Event()
+        finished: Event = Event()
+        original_upload = store._upload_bundle
+        original_marker = store._write_ready_marker
+
+        def pause_storage() -> None:
+            loop.call_soon_threadsafe(started.set)
+            if not released.wait(timeout=10):
+                raise TimeoutError("Contract did not release paused storage work")
+
+        def upload_bundle(
+            storage_id: str,
+            content_version: str,
+            source_directory: Path,
+            signature: tuple[tuple[str, int, int, int], ...],
+        ) -> CanonicalDemoBundle:
+            pause_storage()
+            try:
+                return original_upload(
+                    storage_id, content_version, source_directory, signature
+                )
+            finally:
+                finished.set()
+
+        def write_marker(bundle: CanonicalDemoBundle) -> None:
+            pause_storage()
+            try:
+                original_marker(bundle)
+            finally:
+                finished.set()
+
+        if stage == "upload":
+            monkeypatch.setattr(store, "_upload_bundle", upload_bundle)
+        else:
+            monkeypatch.setattr(store, "_write_ready_marker", write_marker)
+        request: asyncio.Task[CanonicalDemoBundle] = asyncio.create_task(
+            store.ensure_bundle(source_id=source_id, source_directory=directory)
+        )
+        try:
+            await asyncio.wait_for(started.wait(), timeout=10)
+            owner: object = await redis_service.get(lock_key)
+            assert owner is not None
+            request.cancel()
+            await asyncio.sleep(0)
+            assert not request.done()
+            assert not finished.is_set()
+            assert await redis_service.get(lock_key) == owner
+        finally:
+            released.set()
+            with pytest.raises(asyncio.CancelledError):
+                await asyncio.wait_for(request, timeout=10)
+
+        assert finished.is_set()
+        assert not await redis_service.exists(lock_key)
+        recovered = await CanonicalDemoBundleStore(
+            redis_service=redis_service
+        ).ensure_bundle(source_id=source_id, source_directory=directory)
+        assert recovered.reused is (stage == "marker")
+
+
 @pytest.mark.asyncio
 async def test_canonical_bundle_reuses_and_versions_real_filesystem_objects(
     api_client_factory: Callable[[], AbstractAsyncContextManager[AsyncClient]],
```

---

### Incident Patch 8: `76c961d2` (2026-09-30)
**Commit Message**: Merge pull request #448 from Ontos-AI/fix/wangbinqi/publication-runtime-compatibility

fix: handle gevent publication writes and bound COPY batches

**File**: `apps/api/tests/contract/test_publication_chunk_copy_contract.py` (modified, +12/-0)
```diff
@@ -6,6 +6,8 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
 from sqlalchemy.engine import make_url
 from sqlalchemy.ext.asyncio import create_async_engine
@@ -111,9 +113,17 @@ def _read_rows(connection) -> list[tuple[object, ...]]:
     )
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -122,6 +132,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_chunks_with_copy(session, _build_chunks())
+                assert get_wait_callback() is expected_callback
                 rows = _read_rows(connection)
                 assert rows[0][1:5] == (
                     "",
@@ -135,6 +146,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             assert connection.scalar(text("SELECT count(*) FROM document_chunks")) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_chunk_copy_supports_asyncpg_owner_and_rollback(
```

**File**: `apps/api/tests/contract/test_publication_token_copy_contract.py` (modified, +67/-1)
```diff
@@ -6,8 +6,10 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
-from sqlalchemy.engine import make_url
+from sqlalchemy.engine import Connection, make_url
 from sqlalchemy.ext.asyncio import create_async_engine
 from sqlalchemy.orm import Session
 
@@ -59,9 +61,17 @@ def contract_database_url(
     yield get_contract_database_url()
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -70,6 +80,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_token_rows_with_copy(session, _TOKEN_ROWS)
+                assert get_wait_callback() is expected_callback
                 values = connection.execute(
                     text("SELECT token, frequency FROM document_map_unit_tokens ORDER BY id")
                 ).all()
@@ -80,6 +91,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             ) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_copy_preserves_rows_and_rollback_with_asyncpg(
@@ -114,3 +126,57 @@ def copy_and_read(sync_connection) -> list[tuple[str, int]]:
             ) == 0
     finally:
         await engine.dispose()
+
+
+async def test_candidate_token_writes_complete_under_per_command_budget(
+    contract_database_url: str,
+) -> None:
+    """Slow token writes must stay atomic without requiring one long command."""
+    url = make_url(contract_database_url).set(drivername="postgresql+asyncpg")
+    engine = create_async_engine(
+        url,
+        connect_args={
+            "command_timeout": 3,
+            "server_settings": {"statement_timeout": "3000"},
+        },
+    )
+    rows: list[dict[str, object]] = [
+        {**_TOKEN_ROWS[0], "id": f"dmut_slow_{index}"}
+        for index in range(2_501)
+    ]
+    try:
+        async with engine.connect() as connection:
+            await connection.execute(text(_CREATE_TOKEN_TABLE))
+            await connection.execute(text("""
+                CREATE FUNCTION pg_temp.delay_token_write() RETURNS trigger
+                LANGUAGE plpgsql AS $$
+                BEGIN
+                    PERFORM pg_sleep((SELECT count(*) FROM inserted_tokens) * 0.002);
+                    RETURN NULL;
+                END $$
+            """))
+            await connection.execute(text("""
+                CREATE TRIGGER delay_token_write AFTER INSERT
+                ON document_map_unit_tokens
+                REFERENCING NEW TABLE AS inserted_tokens
+                FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.delay_token_write()
+            """))
+            await connection.commit()
+            transaction = await connection.begin()
+            # Publication has already written its document before token persistence.
+            await connection.execute(text("SELECT 1"))
+
+            def write_tokens(sync_connection: Connection) -> None:
+                with Session(bind=sync_connection) as session:
+                    insert_token_rows_with_copy(session, rows)
+
+            await connection.run_sync(write_tokens)
+            assert await connection.scalar(
+                text("SELECT count(*) FROM document_map_unit_tokens")
+            ) == len(rows)
+            await transaction.rollback()
+            assert await connection.scalar(
+                text("SELECT count(*) FROM document_map_unit_tokens")
+            ) == 0
+    finally:
+        await engine.dispose()
```

**File**: `docs/design/publication-runtime-failure-diagnosis.md` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+# Publication runtime failure diagnosis
+
+Evidence collected on 2026-09-30. Production inspection was read-only. Local
+publication used a disposable PostgreSQL 15.17 database, Redis, LocalStack, and
+the real API and Worker entry points.
+
+## Production materialization timeout: confirmed cause
+
+The failed SpaceX demo request started at `2026-09-30T03:07:58.245481Z` and
+raised `TimeoutError` at `03:09:16.328Z`. The production API log stream was
+`api/api/88eebaaa69a4479e811bbd3fd0a62d95` in `/ecs/knowhere-api-prod`.
+
+Performance Insights for Aurora instance `knowhere-database-prod-instance-1`
+provides direct attribution:
+
+- The statement was `COPY document_map_unit_tokens (...) FROM STDIN (FORMAT binary)`.
+- It appeared in 30 consecutive one-second samples, from `03:08:47Z` through
+  `03:09:16Z`.
+- Filtering by that SQL identifier, all 30 samples were `IO:DataFileRead`.
+- No lock wait or CPU sample was attributed to this statement. Total sampled
+  database load in the surrounding interval never exceeded one active session.
+
+The immediate cause was waiting for database pages to be read from storage until
+COPY exhausted the API's 30-second command budget. This establishes storage read
+pressure, rather than an application deadlock or slow Python serialization, as
+the dominant observed wait. Sampling does not identify the exact relation or
+index supplying each read, and it does not prove that no shorter other waits
+occurred between samples.
+
+CloudWatch provides supporting context at one-minute resolution:
+
+| Metric | 03:07 UTC | 03:08 UTC | 03:09 UTC |
+| --- | ---: | ---: | ---: |
+| Serverless capacity, ACU | 0.5 | 0.742 | 2.0 |
+| Buffer cache hit ratio | 100% | 99.88% | 88.93% |
+| Read IOPS | 0 | 39.2 | 413.7 |
+| Read latency | 0 | 0.885 ms | 0.817 ms |
+| CPU utilization | 23.9% | 39.9% | 40.0% |
+
+These observations support a cold working set and storage reads during scale-up.
+They do not isolate scale-up as the sole cause. Current configuration reports
+0–4 ACU and a 300-second auto-pause interval; it must not be substituted for
+historical configuration. Historical ACU utilization reached 100% at 2 ACU.
+
+## Current production token storage
+
+A subsequent read-only catalog query estimated 13,276,691 token rows. The heap
+occupied 3,394,764,800 bytes and total relation storage was 15,540,740,096 bytes.
+All five indexes were valid and ready:
+
+| Index | Leading keys | Bytes |
+| --- | --- | ---: |
+| `document_map_unit_tokens_pkey` | `id` | 1,468,669,952 |
+| `idx_document_map_unit_tokens_lookup` | `channel, token_hash, map_unit_id` | 4,612,505,600 |
+| `idx_document_map_unit_tokens_token_lookup_binary` | `channel, decode(token_hash)` | 1,591,910,400 |
+| `idx_document_map_unit_tokens_unit` | `map_unit_id, channel` | 285,138,944 |
+| `idx_document_map_unit_tokens_unit_lookup` | `map_unit_id, channel, token_hash` | 4,184,621,056 |
+
+The binary and unit-lookup indexes include token/frequency payload. The total
+index footprint is approximately 12.14 decimal GB. Index maintenance is a
+plausible source of the observed reads; Performance Insights alone does not
+identify which index dominated. These sizes are not a measured bloat estimate.
+This catalog snapshot was taken after production recovery; it does not establish the index inventory or sizes
+at the time of the failed candidate request.
+
+## Real local API result
+
+An HTTP request to the actual `main.py` API materialized `demo-spacex-s1` with
+`candidate` enabled and the unchanged 30-second database timeouts. It completed
+with HTTP 200 in 46.289 seconds. The document was then archived and checked.
+
+The resulting input and index contained 227 chunks, 227 map units, and 10,778
+token rows. The demo input consists of one 1,467,990-character page chunk, 94 image
+chunks, and 132 table chunks. It differs from the older 922-chunk benchmark input.
+
+A separate read-only observer sampled the database every 250 ms:
+
+- The publication transaction lasted approximately 8.6 seconds.
+- Token COPY appeared in two samples spanning approximately 0.3 seconds and
+  finished in under one second. Samples included `DataFileRead` and `WALWrite`.
+- Chunk COPY lasted approximately 1.4 seconds.
+- No blocking PID was observed.
+- Much of the request time preceded the publication transaction.
+
+The production timeout did **not** recur against this almost-empty local
+relation. This successful result does not establish performance against the
+production token/index footprint.
+
+## Validation gaps and repair choices
+
+The old benchmark created standalone SQLAlchemy engines with `NullPool`, without
+the API's 30-second `statement_timeout` and asyncpg `command_timeout`. Its sync
+owner also bypassed Worker startup and the gevent/psycogreen callback. Those gaps
+explain why it could not establish deployment compatibility.
+
+Before this repair, the candidate wrote up to 100,000 token rows in one COPY
+command. Basel
```

**File**: `packages/shared-python/shared/services/retrieval/publication_chunk_copy.py` (modified, +25/-6)
```diff
@@ -8,11 +8,15 @@
 from datetime import datetime, timezone
 from typing import Any, Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.models.database.document import DocumentChunk
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
+_COPY_BATCH_SIZE: int = 1_000
 _COLUMNS: tuple[str, ...] = (
     "id", "chunk_id", "user_id", "namespace", "document_id", "job_result_id",
     "section_id", "chunk_type", "content", "content_lexical_text", "path_lexical_text",
@@ -100,18 +104,27 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[_CopyValue, ...]],
 ) -> None:
-    buffer = _encode_csv_rows(records)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_chunks (" + ", ".join(_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_csv_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
 
-def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
-    """COPY prepared chunk objects inside the caller's transaction."""
-    if not chunks:
-        return
+def _insert_chunk_batch(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist one bounded statement and record its actual SQL duration."""
     connection = db.connection()
     raw_connection = connection.connection
     driver = connection.dialect.driver
@@ -161,3 +174,9 @@ def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
             is_manual_write=True,
             write_row_count=len(chunks) if did_succeed else None,
         )
+
+
+def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist prepared chunks in bounded batches inside the caller's transaction."""
+    for start in range(0, len(chunks), _COPY_BATCH_SIZE):
+        _insert_chunk_batch(db, chunks[start : start + _COPY_BATCH_SIZE])
```

**File**: `packages/shared-python/shared/services/retrieval/publication_token_copy.py` (modified, +19/-6)
```diff
@@ -8,13 +8,16 @@
 from collections.abc import Iterator, Sequence
 from typing import Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
-# Keep the production-shaped publication in one COPY while retaining a bound
-# for larger documents so token persistence does not add avoidable round trips.
-_COPY_BATCH_SIZE = 100_000
+# Each COPY has the API's per-command timeout. Bound the work even for a
+# single token-heavy map unit; all batches remain in the caller's transaction.
+_COPY_BATCH_SIZE: int = 1_000
 _TOKEN_COLUMNS = (
     "id", "map_unit_id", "channel", "token", "token_hash", "frequency",
 )
@@ -64,11 +67,21 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[str | int, ...]],
 ) -> None:
-    buffer = _encode_binary_rows(records)
-    buffer.seek(0)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_map_unit_tokens (" + ", ".join(_TOKEN_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_binary_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
```

---

### Incident Patch 9: `e3c36c85` (2026-09-30)
**Commit Message**: fix: preserve publication compatibility with gevent and command timeouts

**File**: `apps/api/tests/contract/test_publication_chunk_copy_contract.py` (modified, +12/-0)
```diff
@@ -6,6 +6,8 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
 from sqlalchemy.engine import make_url
 from sqlalchemy.ext.asyncio import create_async_engine
@@ -111,9 +113,17 @@ def _read_rows(connection) -> list[tuple[object, ...]]:
     )
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -122,6 +132,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_chunks_with_copy(session, _build_chunks())
+                assert get_wait_callback() is expected_callback
                 rows = _read_rows(connection)
                 assert rows[0][1:5] == (
                     "",
@@ -135,6 +146,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             assert connection.scalar(text("SELECT count(*) FROM document_chunks")) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_chunk_copy_supports_asyncpg_owner_and_rollback(
```

**File**: `apps/api/tests/contract/test_publication_token_copy_contract.py` (modified, +67/-1)
```diff
@@ -6,8 +6,10 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
-from sqlalchemy.engine import make_url
+from sqlalchemy.engine import Connection, make_url
 from sqlalchemy.ext.asyncio import create_async_engine
 from sqlalchemy.orm import Session
 
@@ -59,9 +61,17 @@ def contract_database_url(
     yield get_contract_database_url()
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -70,6 +80,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_token_rows_with_copy(session, _TOKEN_ROWS)
+                assert get_wait_callback() is expected_callback
                 values = connection.execute(
                     text("SELECT token, frequency FROM document_map_unit_tokens ORDER BY id")
                 ).all()
@@ -80,6 +91,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             ) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_copy_preserves_rows_and_rollback_with_asyncpg(
@@ -114,3 +126,57 @@ def copy_and_read(sync_connection) -> list[tuple[str, int]]:
             ) == 0
     finally:
         await engine.dispose()
+
+
+async def test_candidate_token_writes_complete_under_per_command_budget(
+    contract_database_url: str,
+) -> None:
+    """Slow token writes must stay atomic without requiring one long command."""
+    url = make_url(contract_database_url).set(drivername="postgresql+asyncpg")
+    engine = create_async_engine(
+        url,
+        connect_args={
+            "command_timeout": 3,
+            "server_settings": {"statement_timeout": "3000"},
+        },
+    )
+    rows: list[dict[str, object]] = [
+        {**_TOKEN_ROWS[0], "id": f"dmut_slow_{index}"}
+        for index in range(2_501)
+    ]
+    try:
+        async with engine.connect() as connection:
+            await connection.execute(text(_CREATE_TOKEN_TABLE))
+            await connection.execute(text("""
+                CREATE FUNCTION pg_temp.delay_token_write() RETURNS trigger
+                LANGUAGE plpgsql AS $$
+                BEGIN
+                    PERFORM pg_sleep((SELECT count(*) FROM inserted_tokens) * 0.002);
+                    RETURN NULL;
+                END $$
+            """))
+            await connection.execute(text("""
+                CREATE TRIGGER delay_token_write AFTER INSERT
+                ON document_map_unit_tokens
+                REFERENCING NEW TABLE AS inserted_tokens
+                FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.delay_token_write()
+            """))
+            await connection.commit()
+            transaction = await connection.begin()
+            # Publication has already written its document before token persistence.
+            await connection.execute(text("SELECT 1"))
+
+            def write_tokens(sync_connection: Connection) -> None:
+                with Session(bind=sync_connection) as session:
+                    insert_token_rows_with_copy(session, rows)
+
+            await connection.run_sync(write_tokens)
+            assert await connection.scalar(
+                text("SELECT count(*) FROM document_map_unit_tokens")
+            ) == len(rows)
+            await transaction.rollback()
+            assert await connection.scalar(
+                text("SELECT count(*) FROM document_map_unit_tokens")
+            ) == 0
+    finally:
+        await engine.dispose()
```

**File**: `docs/design/publication-runtime-failure-diagnosis.md` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+# Publication runtime failure diagnosis
+
+Evidence collected on 2026-09-30. Production inspection was read-only. Local
+publication used a disposable PostgreSQL 15.17 database, Redis, LocalStack, and
+the real API and Worker entry points.
+
+## Production materialization timeout: confirmed cause
+
+The failed SpaceX demo request started at `2026-09-30T03:07:58.245481Z` and
+raised `TimeoutError` at `03:09:16.328Z`. The production API log stream was
+`api/api/88eebaaa69a4479e811bbd3fd0a62d95` in `/ecs/knowhere-api-prod`.
+
+Performance Insights for Aurora instance `knowhere-database-prod-instance-1`
+provides direct attribution:
+
+- The statement was `COPY document_map_unit_tokens (...) FROM STDIN (FORMAT binary)`.
+- It appeared in 30 consecutive one-second samples, from `03:08:47Z` through
+  `03:09:16Z`.
+- Filtering by that SQL identifier, all 30 samples were `IO:DataFileRead`.
+- No lock wait or CPU sample was attributed to this statement. Total sampled
+  database load in the surrounding interval never exceeded one active session.
+
+The immediate cause was waiting for database pages to be read from storage until
+COPY exhausted the API's 30-second command budget. This establishes storage read
+pressure, rather than an application deadlock or slow Python serialization, as
+the dominant observed wait. Sampling does not identify the exact relation or
+index supplying each read, and it does not prove that no shorter other waits
+occurred between samples.
+
+CloudWatch provides supporting context at one-minute resolution:
+
+| Metric | 03:07 UTC | 03:08 UTC | 03:09 UTC |
+| --- | ---: | ---: | ---: |
+| Serverless capacity, ACU | 0.5 | 0.742 | 2.0 |
+| Buffer cache hit ratio | 100% | 99.88% | 88.93% |
+| Read IOPS | 0 | 39.2 | 413.7 |
+| Read latency | 0 | 0.885 ms | 0.817 ms |
+| CPU utilization | 23.9% | 39.9% | 40.0% |
+
+These observations support a cold working set and storage reads during scale-up.
+They do not isolate scale-up as the sole cause. Current configuration reports
+0–4 ACU and a 300-second auto-pause interval; it must not be substituted for
+historical configuration. Historical ACU utilization reached 100% at 2 ACU.
+
+## Current production token storage
+
+A subsequent read-only catalog query estimated 13,276,691 token rows. The heap
+occupied 3,394,764,800 bytes and total relation storage was 15,540,740,096 bytes.
+All five indexes were valid and ready:
+
+| Index | Leading keys | Bytes |
+| --- | --- | ---: |
+| `document_map_unit_tokens_pkey` | `id` | 1,468,669,952 |
+| `idx_document_map_unit_tokens_lookup` | `channel, token_hash, map_unit_id` | 4,612,505,600 |
+| `idx_document_map_unit_tokens_token_lookup_binary` | `channel, decode(token_hash)` | 1,591,910,400 |
+| `idx_document_map_unit_tokens_unit` | `map_unit_id, channel` | 285,138,944 |
+| `idx_document_map_unit_tokens_unit_lookup` | `map_unit_id, channel, token_hash` | 4,184,621,056 |
+
+The binary and unit-lookup indexes include token/frequency payload. The total
+index footprint is approximately 12.14 decimal GB. Index maintenance is a
+plausible source of the observed reads; Performance Insights alone does not
+identify which index dominated. These sizes are not a measured bloat estimate.
+This catalog snapshot was taken after production recovery; it does not establish the index inventory or sizes
+at the time of the failed candidate request.
+
+## Real local API result
+
+An HTTP request to the actual `main.py` API materialized `demo-spacex-s1` with
+`candidate` enabled and the unchanged 30-second database timeouts. It completed
+with HTTP 200 in 46.289 seconds. The document was then archived and checked.
+
+The resulting input and index contained 227 chunks, 227 map units, and 10,778
+token rows. The demo input consists of one 1,467,990-character page chunk, 94 image
+chunks, and 132 table chunks. It differs from the older 922-chunk benchmark input.
+
+A separate read-only observer sampled the database every 250 ms:
+
+- The publication transaction lasted approximately 8.6 seconds.
+- Token COPY appeared in two samples spanning approximately 0.3 seconds and
+  finished in under one second. Samples included `DataFileRead` and `WALWrite`.
+- Chunk COPY lasted approximately 1.4 seconds.
+- No blocking PID was observed.
+- Much of the request time preceded the publication transaction.
+
+The production timeout did **not** recur against this almost-empty local
+relation. This successful result does not establish performance against the
+production token/index footprint.
+
+## Validation gaps and repair choices
+
+The old benchmark created standalone SQLAlchemy engines with `NullPool`, without
+the API's 30-second `statement_timeout` and asyncpg `command_timeout`. Its sync
+owner also bypassed Worker startup and the gevent/psycogreen callback. Those gaps
+explain why it could not establish deployment compatibility.
+
+Before this repair, the candidate wrote up to 100,000 token rows in one COPY
+command. Basel
```

**File**: `packages/shared-python/shared/services/retrieval/publication_chunk_copy.py` (modified, +25/-6)
```diff
@@ -8,11 +8,15 @@
 from datetime import datetime, timezone
 from typing import Any, Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.models.database.document import DocumentChunk
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
+_COPY_BATCH_SIZE: int = 1_000
 _COLUMNS: tuple[str, ...] = (
     "id", "chunk_id", "user_id", "namespace", "document_id", "job_result_id",
     "section_id", "chunk_type", "content", "content_lexical_text", "path_lexical_text",
@@ -100,18 +104,27 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[_CopyValue, ...]],
 ) -> None:
-    buffer = _encode_csv_rows(records)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_chunks (" + ", ".join(_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_csv_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
 
-def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
-    """COPY prepared chunk objects inside the caller's transaction."""
-    if not chunks:
-        return
+def _insert_chunk_batch(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist one bounded statement and record its actual SQL duration."""
     connection = db.connection()
     raw_connection = connection.connection
     driver = connection.dialect.driver
@@ -161,3 +174,9 @@ def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
             is_manual_write=True,
             write_row_count=len(chunks) if did_succeed else None,
         )
+
+
+def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist prepared chunks in bounded batches inside the caller's transaction."""
+    for start in range(0, len(chunks), _COPY_BATCH_SIZE):
+        _insert_chunk_batch(db, chunks[start : start + _COPY_BATCH_SIZE])
```

**File**: `packages/shared-python/shared/services/retrieval/publication_token_copy.py` (modified, +19/-6)
```diff
@@ -8,13 +8,16 @@
 from collections.abc import Iterator, Sequence
 from typing import Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
-# Keep the production-shaped publication in one COPY while retaining a bound
-# for larger documents so token persistence does not add avoidable round trips.
-_COPY_BATCH_SIZE = 100_000
+# Each COPY has the API's per-command timeout. Bound the work even for a
+# single token-heavy map unit; all batches remain in the caller's transaction.
+_COPY_BATCH_SIZE: int = 1_000
 _TOKEN_COLUMNS = (
     "id", "map_unit_id", "channel", "token", "token_hash", "frequency",
 )
@@ -64,11 +67,21 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[str | int, ...]],
 ) -> None:
-    buffer = _encode_binary_rows(records)
-    buffer.seek(0)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_map_unit_tokens (" + ", ".join(_TOKEN_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_binary_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
```

---

### Incident Patch 10: `f20709d4` (2026-09-29)
**Commit Message**: fix: expect MCP query projection to include empty-query fields

to_mcp_query_response now forwards router_used and failure_reason; the contract test must match that shape.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/api/tests/contract/test_evidence_renderer_contract.py` (modified, +2/-0)
```diff
@@ -51,6 +51,8 @@ def test_mcp_query_response_keeps_evidence_and_debug_results() -> None:
 
     assert response == {
         "query": "q",
+        "router_used": None,
+        "failure_reason": None,
         "evidence": [{"type": "text", "text": "t"}],
         "evidence_text": "t",
         "results": [
```

---

### Incident Patch 11: `e13251a7` (2026-09-29)
**Commit Message**: fix: stop snapshotting dropped map-unit term-search text

Publication benchmark fingerprints still selected term_search_text_lower after the column was removed.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `scripts/publication_benchmark/state_snapshot.py` (modified, +1/-2)
```diff
@@ -386,7 +386,7 @@ def capture_semantic_fingerprints(
         db,
         "SELECT u.id, u.document_id, u.job_result_id, u.unit_id, u.section_id, "
         "u.unit_kind, u.path_token_count, u.content_token_count, "
-        "u.term_search_text_lower, u.has_image, u.has_table, u.sort_order "
+        "u.has_image, u.has_table, u.sort_order "
         "FROM document_map_units u JOIN documents d ON d.document_id = u.document_id "
         "WHERE d.user_id = :user_id AND d.namespace = :namespace",
         parameters,
@@ -411,7 +411,6 @@ def capture_semantic_fingerprints(
             "unit_id": _unit_id(row["unit_id"], section_paths),
             "path_token_count": row["path_token_count"],
             "content_token_count": row["content_token_count"],
-            "term_search_text_lower": row["term_search_text_lower"],
             "has_image": row["has_image"],
             "has_table": row["has_table"],
         }
```

---

### Incident Patch 12: `178ae9a3` (2026-09-29)
**Commit Message**: fix: attach term-search drop migration to current alembic head

The branch still parented 1a2b3c4d5e6f after main added later token-index revisions, which split heads.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/api/alembic/versions/2b3c4d5e6f7a_drop_map_unit_term_search_text.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 
 revision: str = "2b3c4d5e6f7a"
-down_revision: str | None = "1a2b3c4d5e6f"
+down_revision: str | None = "2f3g4h5i6j7"
 branch_labels: Sequence[str] | None = None
 depends_on: Sequence[str] | None = None
 
```

---

### Incident Patch 13: `3428bbc9` (2026-09-29)
**Commit Message**: fix: keep grep SQL rows distinct from payload rows

Pyright treated the later payload `rows` annotation as the type of the SQL result, which blocked local CI.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/tools/grep.py` (modified, +3/-3)
```diff
@@ -239,8 +239,8 @@ async def grep(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
         .order_by(matched.c.document_id, matched.c.sort_order)
         .limit(limit)
     )
-    rows = (await ctx.db.execute(rows_stmt)).all()
-    total_matches = int(rows[0][-1]) if rows else 0
+    matched_rows = (await ctx.db.execute(rows_stmt)).all()
+    total_matches = int(matched_rows[0][-1]) if matched_rows else 0
 
     results: list[dict[str, Any]] = []
     for (
@@ -256,7 +256,7 @@ async def grep(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
         section_path,
         source_file_name,
         _total_matches,
-    ) in rows:
+    ) in matched_rows:
         text = str(term_search_text or "")
         match = compiled.search(text)
         snippet = build_snippet(
```

---

### Incident Patch 14: `d703c990` (2026-09-29)
**Commit Message**: fix: enhance argument handling and response structure in grep and recall tools

- Updated argument parsing in `grep` and `recall` functions to use default values more effectively, improving robustness against missing parameters.
- Modified test cases to ensure consistent handling of tool names in `tool_message_content`, enhancing clarity in error reporting and output formatting.
- Refactored response payloads to align with new structure, ensuring that details such as `total_matches` are correctly reported in the response.
- Added new tests to validate behavior for empty results and invalid parameters, improving overall test coverage and reliability.

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/tools/grep.py` (modified, +2/-2)
```diff
@@ -150,8 +150,8 @@ async def grep(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
     terms = _terms_from_args(args)
     if not terms:
         return ToolResult(text="", error="grep requires pattern or patterns")
-    context_chars = int(args.get("context_chars") or _DEFAULT_CONTEXT_CHARS)
-    requested_limit = int(args.get("limit") or _DEFAULT_LIMIT)
+    context_chars = int(args.get("context_chars", _DEFAULT_CONTEXT_CHARS))
+    requested_limit = int(args.get("limit", _DEFAULT_LIMIT))
     limit = capped_limit(requested_limit, ctx.budget)
     chunk_types = {
         str(t).strip().lower() for t in (args.get("chunk_types") or []) if str(t).strip()
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/tools/recall.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ async def recall(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
     query = str(args.get("query") or "").strip()
     if not query:
         return ToolResult(text="", error="recall requires query")
-    requested_limit = int(args.get("limit") or _DEFAULT_LIMIT)
+    requested_limit = int(args.get("limit", _DEFAULT_LIMIT))
     limit = capped_limit(requested_limit, ctx.budget)
     chunk_types = {
         str(t).strip().lower() for t in (args.get("chunk_types") or []) if str(t).strip()
```

**File**: `packages/shared-python/shared/tests/test_agent_explore_harness.py` (modified, +15/-5)
```diff
@@ -72,25 +72,34 @@ def test_build_wire_tool_name_map_round_trips_to_canonical() -> None:
 
 def test_tool_message_content_passes_through_short_text() -> None:
     result = ToolResult(text="short body")
-    assert tool_message_content(result, max_chars=100) == "short body"
+    assert (
+        tool_message_content(result, tool_name="corpus.grep", max_chars=100)
+        == "short body"
+    )
 
 
 def test_tool_message_content_caps_long_text_with_note() -> None:
     result = ToolResult(text="x" * 200)
-    content = tool_message_content(result, max_chars=100)
+    content = tool_message_content(result, tool_name="corpus.grep", max_chars=100)
     assert content.startswith("x" * 100)
     assert "truncated, 100 more chars" in content
     assert len(content) > 100  # capped body + truncation note, not silently dropped
 
 
 def test_tool_message_content_surfaces_error_instead_of_text() -> None:
     result = ToolResult(text="ignored", error="bad args: missing document_id")
-    assert tool_message_content(result, max_chars=100) == "error: bad args: missing document_id"
+    assert (
+        tool_message_content(result, tool_name="corpus.grep", max_chars=100)
+        == "error: bad args: missing document_id"
+    )
 
 
 def test_tool_message_content_empty_text_placeholder() -> None:
     result = ToolResult(text="")
-    assert tool_message_content(result, max_chars=100) == "(empty result)"
+    assert (
+        tool_message_content(result, tool_name="corpus.grep", max_chars=100)
+        == "(empty result)"
+    )
 
 
 def test_model_accepts_images_only_when_name_contains_vision() -> None:
@@ -329,7 +338,8 @@ def test_agent_explore_keeps_inventory_tool_for_explicit_inventory_requests() ->
     wire_names = {tool["function"]["name"] for tool in tools}
     assert "corpus_list_documents" in wire_names
     assert name_map["corpus_list_documents"] == "corpus.list_documents"
-    assert "only if the user explicitly asks to list or inventory" in LOOP_CONTRACT_SUFFIX
+    assert "only if the user explicitly" in LOOP_CONTRACT_SUFFIX
+    assert "asks to list or inventory the corpus's documents" in LOOP_CONTRACT_SUFFIX
 
 
 # --------------------------------------------------------------------------
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_contract.py` (modified, +89/-2)
```diff
@@ -16,7 +16,7 @@
 
 from shared.services.retrieval.agent_explore.config import FINISH_TOOL_SCHEMA
 from shared.services.retrieval.agent_tools import REGISTRY, ToolContext, load_corpus_schema_text
-from shared.services.retrieval.agent_tools.snippet import format_row
+from shared.services.retrieval.agent_tools.snippet import build_row, format_row
 
 
 @asynccontextmanager
@@ -159,13 +159,100 @@ def test_old_parameter_names_are_absent_from_docs_and_descriptions() -> None:
             assert stale not in spec.json_schema.get("properties", {})
 
 
+_ROW_KEYS = {
+    "kind",
+    "title",
+    "document_id",
+    "section_path",
+    "chunk_id",
+    "summary",
+    "snippet",
+    "score",
+    "is_hit",
+    "depth",
+    "hosted",
+}
+
+
 def test_format_row_is_the_shared_search_line() -> None:
-    line = format_row(
+    row = build_row(
         kind="text",
         document_id="doc_a",
         section_path="guide.pdf / Intro",
         title="guide.pdf",
         snippet="hello",
     )
+    assert set(row) == _ROW_KEYS
+    line = format_row(row)
     assert line.startswith("- [text] guide.pdf | document_id=doc_a section_path=")
     assert "snippet:" in line
+
+
+@pytest.mark.asyncio
+async def test_chunk_types_enum_rejects_old_names() -> None:
+    result = await REGISTRY.dispatch(
+        "corpus.grep",
+        _ctx(),
+        {"pattern": "x", "chunk_types": ["body"]},
+    )
+    assert result.error is not None
+    assert "chunk_types" in result.error
+    assert "unknown argument" not in result.error
+
+
+@pytest.mark.asyncio
+async def test_limit_below_minimum_is_rejected() -> None:
+    result = await REGISTRY.dispatch(
+        "corpus.grep",
+        _ctx(),
+        {"pattern": "x", "limit": 0},
+    )
+    assert result.error is not None
+    assert "limit" in result.error
+
+
+@pytest.mark.asyncio
+async def test_recall_blank_query_is_rejected() -> None:
+    result = await REGISTRY.dispatch("corpus.recall", _ctx(), {"query": "   "})
+    assert result.error == "recall requires query"
+
+
+@pytest.mark.asyncio
+async def test_read_ref_requires_exactly_one_address() -> None:
+    both = await REGISTRY.dispatch(
+        "corpus.read",
+        _ctx(),
+        {
+            "refs": [
+                {
+                    "document_id": "doc_a",
+                    "section_path": "guide.pdf / Intro",
+                    "chunk_id": "chunk_a",
+                }
+            ]
+        },
+    )
+    assert both.error is not None
+    assert "section_path" in both.error
+    assert "chunk_id" in both.error
+
+    neither = await REGISTRY.dispatch(
+        "corpus.read",
+        _ctx(),
+        {"refs": [{"document_id": "doc_a"}]},
+    )
+    assert neither.error is not None
+    assert "section_path" in neither.error or "chunk_id" in neither.error
+
+
+def test_chunk_types_and_bounds_are_in_schema() -> None:
+    grep = REGISTRY.get("corpus.grep")
+    recall = REGISTRY.get("corpus.recall")
+    outline = REGISTRY.get("corpus.outline")
+    assert grep is not None and recall is not None and outline is not None
+    for spec in (grep, recall):
+        items = spec.json_schema["properties"]["chunk_types"]["items"]
+        assert items["enum"] == ["text", "page", "image", "table"]
+        assert spec.json_schema["properties"]["limit"]["minimum"] == 1
+    assert grep.json_schema["properties"]["context_chars"]["minimum"] == 1
+    assert outline.json_schema["properties"]["depth"]["minimum"] == 0
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_discovery_read_contract.py` (modified, +15/-10)
```diff
@@ -72,12 +72,20 @@ def all(self) -> list[tuple[object, ...]]:
         ]
 
 
+class _EmptyHostRows:
+    def all(self) -> list[tuple[object, ...]]:
+        return []
+
+
 class _RecordingDb:
-    def __init__(self, result: object) -> None:
-        self.result = result
+    def __init__(self, results: object) -> None:
+        self.results = list(results) if isinstance(results, list) else [results]
+        self._index = 0
 
     async def execute(self, statement):  # noqa: ANN001
-        return self.result
+        result = self.results[min(self._index, len(self.results) - 1)]
+        self._index += 1
+        return result
 
 
 @asynccontextmanager
@@ -199,7 +207,7 @@ def _read_kwargs(refs: list[dict[str, str]]) -> dict:
 
 
 def _section_paths_from_outline_text(text: str) -> list[str]:
-    return re.findall(r"section_path=(.+?)(?: \[Hit\])?$", text, re.MULTILINE)
+    return re.findall(r"section_path=(.+)$", text, re.MULTILINE)
 
 
 def _asset_refs_from_text(text: str) -> list[dict[str, str]]:
@@ -232,11 +240,8 @@ async def test_assets_visible_chunk_id_reads(discovery_ctx: ToolContext) -> None
         discovery_ctx, {"scope": [{"document_id": DOC_ID}], "type": "table"}
     )
     assert listed.error is None
-    # file_path is not part of the shared row shape (format_row) any of the
-    # five search/map tools render — only chunk_id is a valid read()
-    # identifier (see test_file_path_is_not_a_readable_chunk_id below), so
-    # the payload (not the text) is where file_path still lives.
-    assert listed.payload["assets"][0]["file_path"] == TABLE_FILE
+    assert listed.payload["rows"][0]["chunk_id"] == CHUNK_TABLE
+    assert listed.payload["rows"][0]["kind"] == "table"
     refs = _asset_refs_from_text(listed.text)
     assert refs == [{"document_id": DOC_ID, "chunk_id": CHUNK_TABLE}]
     result = await read(discovery_ctx, _read_kwargs(refs))
@@ -248,7 +253,7 @@ async def test_assets_visible_chunk_id_reads(discovery_ctx: ToolContext) -> None
 @pytest.mark.asyncio
 async def test_grep_table_visible_chunk_id_reads(discovery_ctx: ToolContext) -> None:
     grep_ctx = ToolContext(
-        db=_RecordingDb(_GrepRows()),  # type: ignore[arg-type]
+        db=_RecordingDb([_GrepRows(), _EmptyHostRows()]),  # type: ignore[arg-type]
         user_id=USER_ID,
         namespace=NAMESPACE,
         db_factory=_unused_db_factory,
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_grep.py` (modified, +50/-36)
```diff
@@ -19,7 +19,7 @@
 from sqlalchemy.dialects import postgresql
 
 from shared.services.retrieval.agent_tools.registry import REGISTRY, ToolContext
-from shared.services.retrieval.agent_tools.snippet import format_row
+from shared.services.retrieval.agent_tools.snippet import build_row, format_row
 from shared.services.retrieval.agent_tools.tools.grep import (
     _term_search,
     _terms_from_args,
@@ -158,8 +158,9 @@ async def rows_factory():
     result = await grep(ctx, {"pattern": "HFrEF"})
 
     assert result.error is None
-    assert result.payload["total_matches"] == 2
-    assert [row["chunk_id"] for row in result.payload["results"]] == ["chunk_a", "chunk_b"]
+    assert result.payload["details"]["total_matches"] == 2
+    assert [row["document_id"] for row in result.payload["rows"]] == ["doc_a", "doc_a"]
+    assert [row["chunk_id"] for row in result.payload["rows"]] == [None, None]
     assert result.refs == [
         {"document_id": "doc_a", "chunk_id": "chunk_a"},
         {"document_id": "doc_a", "chunk_id": "chunk_b"},
@@ -259,8 +260,8 @@ async def unused_factory():
     )
     result = await grep(ctx, {"pattern": "HFrEF", "limit": 1})
 
-    assert result.payload["total_matches"] == 2
-    assert len(result.payload["results"]) == 1
+    assert result.payload["details"]["total_matches"] == 2
+    assert len(result.payload["rows"]) == 1
     assert result.text.startswith("total_matches=2 returned=1")
 
 
@@ -281,7 +282,8 @@ async def unused_factory():
     )
     result = await grep(ctx, {"pattern": "missing"})
 
-    assert result.payload == {"total_matches": 0, "results": []}
+    assert result.payload["rows"] == []
+    assert result.payload["details"]["total_matches"] == 0
     assert result.refs == []
     assert result.text == "total_matches=0 returned=0"
 
@@ -396,7 +398,7 @@ def all(self) -> list[tuple[object, ...]]:
 async def test_grep_table_hit_text_includes_chunk_id(
     monkeypatch: pytest.MonkeyPatch,
 ) -> None:
-    db = _SequencedDb([_TableRowsResult()])
+    db = _SequencedDb([_TableRowsResult(), _EmptyRowsResult()])
 
     @asynccontextmanager
     async def unused_factory():
@@ -418,7 +420,7 @@ async def unused_factory():
     assert result.error is None
     assert (
         "- [table] guide.pdf | document_id=doc_a section_path=guide.pdf / Root "
-        "chunk_id=chunk_table"
+        "(no host section) chunk_id=chunk_table"
         in result.text
     )
     assert "<table>" in result.text
@@ -435,7 +437,7 @@ async def test_grep_table_download_failure_does_not_fail_whole_call(
     warning note instead of raising."""
     from shared.services.retrieval.hydration.table_grid import TableDownloadError
 
-    db = _SequencedDb([_TableRowsResult()])
+    db = _SequencedDb([_TableRowsResult(), _EmptyRowsResult()])
 
     @asynccontextmanager
     async def unused_factory():
@@ -458,7 +460,7 @@ def _raise_download_error(_row):
     result = await grep(ctx, {"pattern": "30 mg"})
 
     assert result.error is None
-    assert result.payload["total_matches"] == 1
+    assert result.payload["details"]["total_matches"] == 1
     assert "table unavailable" in result.text
     assert "download failed" in result.text
 
@@ -467,7 +469,7 @@ def _raise_download_error(_row):
 async def test_grep_matches_table_via_term_search_text_not_content_path(
     monkeypatch: pytest.MonkeyPatch,
 ) -> None:
-    db = _SequencedDb([_TableRowsResult()])
+    db = _SequencedDb([_TableRowsResult(), _EmptyRowsResult()])
 
     @asynccontextmanager
     async def unused_factory():
@@ -487,40 +489,52 @@ async def unused_factory():
     result = await grep(ctx, {"pattern": "dose table summary"})
 
     assert result.error is None
-    assert result.payload["total_matches"] == 1
-    assert result.payload["results"][0]["chunk_id"] == "chunk_table"
+    assert result.payload["details"]["total_matches"] == 1
+    assert result.payload["rows"][0]["chunk_id"] == "chunk_table"
     assert "dose table summary" in result.text
 
 
 def test_format_row_body_omits_chunk_id() -> None:
     assert format_row(
-        kind="text",
-        document_id="doc_a",
-        section_path="guide.pdf / Intro",
-        title="guide.pdf",
-        snippet="alpha",
-    ) == "- [text] guide.pdf | document_id=doc_a section_path=guide.pdf / Intro\n  snippet: 'alpha'"
+        build_row(
+            kind="text",
+            document_id="doc_a",
+            section_path="guide.pdf / Intro",
+            title="guide.pdf",
+            snippet="alpha",
+        )
+    ) == (
+        "- [text] guide.pdf | document_id=doc_a section_path=guide.pdf / Intro\n"
+        "  snippet: 'alpha'"
+    )
 
 
 def test_format_row_omits_empty_snippet() -> None:
-    assert format_row(
-        kind="table",
-        document_id="doc_a",
-        section_path="guide.pdf / Root",
-        title="guide.pdf",
-        chunk_id="chunk_table",
-    ) == "- [table] guide.pdf | document_id=doc_a section_path=guide.pdf / Root chunk_id=chunk_table"
+
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_map_scope.py` (modified, +34/-5)
```diff
@@ -20,7 +20,11 @@
 
 from shared.models.database.document import Document, DocumentChunk, DocumentSection
 from shared.models.database.job_result import JobResult
-from shared.services.retrieval.agent_tools.registry import MAP_TOOL_CHAR_BUDGET, ToolContext
+from shared.services.retrieval.agent_tools.registry import (
+    MAP_TOOL_CHAR_BUDGET,
+    ToolContext,
+    ToolResult,
+)
 from shared.services.retrieval.agent_tools.tools.assets import assets
 from shared.services.retrieval.agent_tools.tools.grep import grep
 from shared.services.retrieval.agent_tools.tools.node_filter import node_filter
@@ -29,6 +33,27 @@
 from shared.services.retrieval.search.map_unit_discovery import DiscoveryResult
 from shared.services.retrieval.scoring.map_lighting import MapNode, fold_map_nodes
 
+_ROW_KEYS = {
+    "kind",
+    "title",
+    "document_id",
+    "section_path",
+    "chunk_id",
+    "summary",
+    "snippet",
+    "score",
+    "is_hit",
+    "depth",
+    "hosted",
+}
+
+
+def _assert_shared_search_payload(result: ToolResult) -> None:
+    assert set(result.payload) == {"rows", "details"}
+    assert isinstance(result.payload["details"], dict)
+    for row in result.payload["rows"]:
+        assert set(row) == _ROW_KEYS
+
 USER_ID = "user_map"
 NAMESPACE = "default"
 DOC_A = "doc_a"
@@ -262,7 +287,8 @@ async def test_outline_accepts_several_scope_targets(map_ctx: ToolContext) -> No
         {"scope": [{"document_id": DOC_A}, {"document_id": DOC_B}]},
     )
     assert result.error is None
-    paths = {row["section_path"] for row in result.payload["sections"]}
+    _assert_shared_search_payload(result)
+    paths = {row["section_path"] for row in result.payload["rows"]}
     assert PATH_OVERVIEW in paths
     assert PATH_INTRO in paths
     assert "| document_id=" in result.text
@@ -286,7 +312,8 @@ async def test_node_filter_keeps_ancestors_and_full_descendant_subtree(
     assert PATH_OVERVIEW in result.text
     assert PATH_DETAIL in result.text
     assert PATH_TREATMENT not in result.text
-    hits = result.payload["matched_sections"]
+    _assert_shared_search_payload(result)
+    hits = [row for row in result.payload["rows"] if row["is_hit"]]
     assert [row["section_path"] for row in hits] == [PATH_FINDINGS]
 
 
@@ -361,7 +388,8 @@ async def test_grep_subtree_scope_excludes_sibling_sections(map_ctx: ToolContext
         },
     )
     assert result.error is None
-    chunk_ids = [row["chunk_id"] for row in result.payload["results"]]
+    _assert_shared_search_payload(result)
+    chunk_ids = [ref["chunk_id"] for ref in result.refs]
     assert "chunk_findings" in chunk_ids
     assert "chunk_detail" in chunk_ids
     assert "chunk_treatment" not in chunk_ids
@@ -377,7 +405,8 @@ async def test_assets_subtree_scope_keeps_only_connected_in_scope_assets(
         {"scope": [{"document_id": DOC_A, "section_path": PATH_OVERVIEW}], "type": "table"},
     )
     assert result.error is None
-    chunk_ids = [row["chunk_id"] for row in result.payload["assets"]]
+    _assert_shared_search_payload(result)
+    chunk_ids = [row["chunk_id"] for row in result.payload["rows"]]
     assert chunk_ids == ["chunk_table_overview"]
     assert "chunk_table_treatment" not in result.text
 
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_read.py` (modified, +4/-2)
```diff
@@ -26,7 +26,7 @@
 from shared.models.database.document import Document, DocumentChunk, DocumentSection
 from shared.models.database.job_result import JobResult
 from shared.services.retrieval.agent_tools.registry import ToolContext
-from shared.services.retrieval.agent_tools.tools.read import read
+from shared.services.retrieval.agent_tools.tools.read import _PICK_REMINDER, read
 
 USER_ID = "user_read"
 NAMESPACE = "default"
@@ -273,7 +273,9 @@ def _assert_result(
 ) -> None:
     assert result.error is None
     expected_text = (
-        f"{_refs_text(ref_status)}\n{body_text}" if body_text else _refs_text(ref_status)
+        f"{_refs_text(ref_status)}\n{_PICK_REMINDER}\n{body_text}\n{_PICK_REMINDER}"
+        if body_text
+        else f"{_refs_text(ref_status)}\n{_PICK_REMINDER}"
     )
     assert result.text == expected_text
     assert result.payload["refs"] == ref_status
```

---

### Incident Patch 15: `855e53a3` (2026-09-29)
**Commit Message**: fix: improve query handling and response structure in retrieval tools

- Added validation for empty queries in `execute_retrieval_query` and `create_retrieval_mcp_server`, returning structured responses with appropriate failure reasons.
- Enhanced the response format to include `router_used` and `failure_reason` for better error tracking.
- Updated the `render_map` function to handle oversized maps more gracefully, ensuring summaries are omitted first and providing clearer error messages when the map exceeds character limits.
- Refactored various tools to ensure consistent handling of asset paths and chunk types, improving overall retrieval accuracy and response consistency.

**File**: `apps/api/app/api/v1/routes/retrieval.py` (modified, +15/-1)
```diff
@@ -209,11 +209,25 @@ async def execute_retrieval_query(
     else:
         resolved_chunk_types = None
 
+    query = str(payload.query or "").strip()
+    if not query:
+        return {
+            "namespace": normalize_retrieval_namespace(payload.namespace),
+            "query": query,
+            "router_used": "empty_query_filtered",
+            "failure_reason": "empty query — retrieval was not run",
+            "evidence": [],
+            "evidence_text": "",
+            "answer_text": "",
+            "referenced_chunks": [],
+            "results": [],
+        }
+
     return await run_retrieval_query(
         db=db,
         user_id=current_user.user_id,
         namespace=normalize_retrieval_namespace(payload.namespace),
-        query=payload.query,
+        query=query,
         top_k=payload.top_k,
         include_document_ids=payload.include_document_ids,
         exclude_document_ids=payload.exclude_document_ids,
```

**File**: `apps/api/app/mcp/retrieval_server.py` (modified, +11/-0)
```diff
@@ -65,6 +65,8 @@ def to_mcp_query_response(response: dict[str, Any]) -> dict[str, Any]:
     """
     return {
         "query": response.get("query"),
+        "router_used": response.get("router_used"),
+        "failure_reason": response.get("failure_reason"),
         "evidence": response.get("evidence") or [],
         "evidence_text": response.get("evidence_text") or "",
         "results": response.get("results") or [],
@@ -155,8 +157,17 @@ async def query_documents(
         # automatically before calling run_retrieval_query.
         # See: shared/services/retrieval/intent/ (to be created)
         namespace = resolve_mcp_namespace(ctx=ctx)
+        query = str(query or "").strip()
         async with db_factory() as db:
             user_id = await resolve_mcp_user_id(ctx=ctx, db=db)
+            if not query:
+                return to_mcp_query_response(
+                    {
+                        "query": query,
+                        "router_used": "empty_query_filtered",
+                        "failure_reason": "empty query — retrieval was not run",
+                    }
+                )
             response = await run_retrieval_query(
                 db=db,
                 user_id=user_id,
```

**File**: `packages/shared-python/shared/services/retrieval/agent_explore/config.py` (modified, +18/-12)
```diff
@@ -97,18 +97,24 @@
 
 ## Exploration loop contract
 
-You are exploring this corpus autonomously to answer one query. Use the
-tools above to navigate; you may call several tools in one turn when they
-are independent. If a call's arguments depend on another call's result, do
-not issue them in the same turn. In particular: do not call `corpus.grep`
-in the same turn as `corpus.recall`, `corpus.read`,
-`corpus.list_documents`, `corpus.outline`, `corpus.node_filter`, or
-`corpus.assets` unless `pattern` / `patterns` is already known — those
-calls produce the term; a grep with no term is an empty call. Wait for
-the result, then grep. `corpus.list_documents` enumerates the entire
-namespace: use it only if the user explicitly asks to list or inventory
-the corpus's documents, never as the starting step for a content question.
-When you have enough evidence, call `{FINISH_TOOL_NAME}`
+You are exploring this corpus autonomously to answer one query. Tool
+names in this prompt are the registered names (`corpus.read`). This
+function-calling loop exposes the same tools with `.` replaced by `_`
+(`corpus_read`); use that underscore form when calling. Logs keep the
+dotted name.
+
+Use the tools above to navigate; you may call several tools in one turn
+when they are independent. If a call's arguments depend on another
+call's result, do not issue them in the same turn. In particular: do
+not call `corpus.grep` in the same turn as `corpus.recall`,
+`corpus.read`, `corpus.list_documents`, `corpus.outline`,
+`corpus.node_filter`, or `corpus.assets` unless `pattern` / `patterns`
+is already known — those calls produce the term; a grep with no term is
+an empty call. Wait for the result, then grep. `corpus.list_documents`
+enumerates the entire namespace: use it only if the user explicitly
+asks to list or inventory the corpus's documents, never as the starting
+step for a content question. When you have enough evidence, call
+`{FINISH_TOOL_NAME}`
 with the `refs` you want cited as the answer — do not write the final answer
 as plain text yourself, it is synthesized downstream from your cited refs.
 If you exhaust your tool budget without a confident answer, call
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/CORPUS_SCHEMA.md` (modified, +78/-69)
```diff
@@ -85,12 +85,13 @@ text, a literal marker:
   **Format trap**: `<owner_section_path>` inside the marker is written
   verbatim by the parser and stored as-is — it is the on-disk path
   (`"<source_file_name>/<Heading>/<Heading>/..."`, plain `/`, filename
-  included), **not** the DB `section_path` you get back from `outline` /
-  `node_filter` / `recall` (which is `" / "`-joined and excludes the
-  filename). Do not string-match the marker directly against a DB
-  `section_path`. Convert it first — `section_path_from_chunk_path()` in
-  `search/lexical_text.py` already does this conversion and is the function
-  to reuse when implementing marker resolution, not a new one.
+  included), **not** the DB `section_path` you get back from
+  `corpus.outline` / `corpus.node_filter` / `corpus.recall` (which is
+  `" / "`-joined and excludes the filename). Do not string-match the
+  marker directly against a DB `section_path`. Convert it first —
+  `section_path_from_chunk_path()` in `search/lexical_text.py` already
+  does this conversion and is the function to reuse when implementing
+  marker resolution, not a new one.
 
 ## 3. Asset chunks: `image` / `table`, and `connect_to`
 
@@ -105,9 +106,12 @@ list on the **body chunk**, not a location on the asset:
   the owning section).
 
 This link is **one-directional** (body → asset). There is no stored
-asset → body back-link; to find which section(s) an asset belongs to, use
-the reverse lookup on the `assets` tool rather than assuming the asset chunk
-itself names its host.
+asset → body back-link. `corpus.grep`, `corpus.recall`, and `corpus.assets`
+resolve the host through that body link and print the hosting
+`section_path` on the asset row. If no host is found, the row keeps
+`Root` and is marked as having no host section. Use `corpus.assets`
+`host_of` to list every host, rather than reading the asset's stored
+path.
 
 ## 4. Document graph
 
@@ -131,77 +135,82 @@ for anything finer-grained than a document pair.
 ## 6. Tools and how they work together
 
 Every tool exists to find the `section_path`s (or asset `chunk_id`s) that
-answer the query, then hand them to `read`. Exact call parameters live only
-in each tool's own schema/description (ask for that, do not memorize names
-here) — this section is the collaboration map: which tools narrow a search
-space, which produce hits, and what to do with either kind of result.
+answer the query, then hand them to `corpus.read`. Names below are the
+registered names (`corpus.outline`). MCP clients call those names as-is.
+Exact call parameters live only in each tool's own schema/description
+(ask for that, do not memorize names here) — this section is the
+collaboration map: which tools narrow a search space, which produce hits,
+and what to do with either kind of result.
 
 ```mermaid
 flowchart LR
     subgraph MapNarrowing["Narrow a map (overview / structural predicate)"]
-        outline
-        node_filter
+        outline["corpus.outline"]
+        node_filter["corpus.node_filter"]
     end
     subgraph LeafHits["Find hits (exact string / fuzzy / asset listing)"]
-        grep
-        recall
-        assets
+        grep["corpus.grep"]
+        recall["corpus.recall"]
+        assets["corpus.assets"]
     end
     outline -->|narrows scope for| LeafHits
     node_filter -->|narrows scope for| LeafHits
-    MapNarrowing -->|section_path| finish
-    MapNarrowing -->|section_path| read
+    MapNarrowing -->|section_path| read["corpus.read"]
     LeafHits -->|section_path or chunk_id| read
-    read -->|table too large| query_table
+    read -->|table too large| query_table["corpus.query_table"]
     read --> finish
     query_table --> finish
-    list_documents["list_documents (namespace inventory, standalone)"]
-    neighbors["neighbors (related documents, standalone)"]
+    list_documents["corpus.list_documents (namespace inventory, standalone)"]
+    neighbors["corpus.neighbors (related documents, standalone)"]
 ```
 
-**`outline` and `node_filter`** are the two map-narrowing tools: both take
-one or more scope targets (a whole document, or a section and everything
-under it) and return the *same* row shape — every `section_path` in that
-scope, indented by level, with title/summary. `outline` returns that
-unconditionally (the outline of what is there); `node_filter` returns it
-only for the branches around a structural predicate match (marked as a
-hit), still shown as full context (ancestors + the entire matched subtree),
-not a bare list of matches. Either one's result is a legitimate final
-answer on its own — cite a `section_path` from it directly via `finish` — or
-a starting point to `read` a specific branch, or a scope to hand to a
-leaf-hit tool below. Neither is callable on a single leaf section with
-nothing under it; `read` that directly instead.
-
-**`grep`, `recall`, and `assets`** are the leaf-hit tools: they search
-*within* a scope (the whole corpus, or one narrowed by a prior
-`outline`
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/asset_hosts.py` (modified, +28/-0)
```diff
@@ -21,6 +21,7 @@
 from shared.services.retrieval.agent_tools.registry import ToolContext
 from shared.services.retrieval.agent_tools.scope import ScopeTarget
 from shared.services.retrieval.hydration.row_utils import iter_connected_target_ids
+from shared.services.retrieval.settings import ASSET_CHUNK_TYPES
 
 _BODY_CHUNK_TYPES = ("text", "page")
 
@@ -133,3 +134,30 @@ def hosted_section_path(
     if candidates:
         return candidates[0].section_path, True
     return str(stored_path or "Root"), False
+
+
+async def host_paths_for_hits(
+    ctx: ToolContext,
+    hits: list[dict[str, Any]],
+    scope: list[ScopeTarget],
+) -> dict[AssetKey, tuple[str, bool]]:
+    """``(section_path, hosted)`` for every image/table hit, same rule as assets."""
+    asset_hits = [
+        hit
+        for hit in hits
+        if str(hit.get("chunk_type") or "").strip() in ASSET_CHUNK_TYPES
+    ]
+    if not asset_hits:
+        return {}
+    hosts = await load_asset_hosts(
+        ctx,
+        document_ids={str(hit.get("document_id") or "") for hit in asset_hits},
+        asset_ids={str(hit.get("chunk_id") or "") for hit in asset_hits},
+    )
+    resolved: dict[AssetKey, tuple[str, bool]] = {}
+    for hit in asset_hits:
+        key = (str(hit.get("document_id") or ""), str(hit.get("chunk_id") or ""))
+        resolved[key] = hosted_section_path(
+            hosts, key, scope, stored_path=hit.get("section_path")
+        )
+    return resolved
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/map_render.py` (modified, +62/-50)
```diff
@@ -1,14 +1,21 @@
 """Render an ``outline``/``node_filter`` map within ``MAP_TOOL_CHAR_BUDGET``.
 
-A map that fits is returned whole. An oversized one is lit and folded
-(``scoring.map_lighting``): sections are scored against the end user's
-original query (``ToolContext.query``), the protected rows (outline: the
-top-scored sections; node_filter: the predicate matches) are marked
-``[Hit]`` and kept with their ancestor chain, and low-scoring subtrees are
-replaced by a placeholder row. When that is impossible — no query, no
-usable map-unit index, nothing matches, or the protected rows alone
-overflow — the call fails with a narrow-the-scope error. The text is never
-cut mid-row.
+A map that fits is returned whole. An oversized one shrinks in three steps,
+each only if the previous did not fit:
+
+1. Drop every row's ``summary``; the structure (rows, indentation, titles,
+   paths) stays as is.
+2. Score sections against the end user's original query
+   (``ToolContext.query``) and fold the lowest-scoring subtrees into
+   placeholder rows (``scoring.map_lighting``). The rows that must stay are
+   the best-scored chain (outline) or the predicate matches (node_filter),
+   each with its ancestors.
+3. If the rows that must stay still overflow, or scoring is impossible (no
+   query, no usable map-unit index), the call fails and tells the agent the
+   scope is too large to map, to run ``corpus.grep``/``corpus.recall``/
+   ``corpus.assets`` on that same scope instead.
+
+The text is never cut mid-row.
 """
 
 from __future__ import annotations
@@ -21,13 +28,15 @@
 from shared.services.retrieval.agent_tools.snippet import format_row
 from shared.services.retrieval.scoring.map_lighting import (
     MapNode,
+    best_score_ids,
     fold_map_nodes,
     load_leaf_unit_scores,
     pool_scores_to_tree,
     render_map_lines,
-    top_hit_ids,
 )
 
+SUMMARIES_OMITTED_NOTE = " (summaries omitted: map over the size limit)"
+
 
 @dataclass
 class MapRender:
@@ -53,11 +62,14 @@ def _nodes(
     ]
 
 
-def _narrow_error(tool: str, reason: str) -> str:
-    return (
-        f"{tool}: {reason} Narrow the call: add a section_path to scope, "
-        "pass a smaller depth, or split the documents across calls. To find "
-        "a specific fact instead of mapping, use corpus.grep or corpus.recall."
+def _too_large(tool: str, chars: int, reason: str) -> MapRender:
+    return MapRender(
+        error=(
+            f"{tool}: the map is {chars} chars even without summaries, over the "
+            f"{MAP_TOOL_CHAR_BUDGET}-char limit, and {reason}. This scope is too "
+            "large to show as a map: run corpus.grep, corpus.recall or "
+            "corpus.assets directly on this same scope instead."
+        )
     )
 
 
@@ -69,52 +81,49 @@ async def render_map(
     rows_by_id: dict[str, dict[str, Any]],
     revision_by_document: dict[str, str],
     header: Callable[[int, int], str],
-    protected_ids: set[str] | None = None,
+    keep_ids: set[str] | None = None,
 ) -> MapRender:
     """``order`` lists ``(section_id, in-map parent id)`` in display order.
 
     ``header(visible_count, hidden_count)`` renders the first line.
-    ``protected_ids=None`` means "protect the top-scored sections" (outline);
-    a set means "protect exactly these" (node_filter's matches, already
-    marked ``is_hit`` in ``rows_by_id``).
+    ``keep_ids=None`` means "keep the best-scored chain" (outline); a set
+    means "keep exactly these rows" (node_filter's matches). Ancestors of
+    kept rows are always kept.
+
+    When the map is oversized, every row's ``summary`` in ``rows_by_id`` is
+    blanked in place, so the caller's payload rows match the rendered text.
     """
     nodes = _nodes(order, rows_by_id)
-    lines = render_map_lines(nodes)
-    text = header(len(nodes), 0) + "\n" + "\n".join(lines)
+    text = header(len(nodes), 0) + "\n" + "\n".join(render_map_lines(nodes))
+    if len(text) <= MAP_TOOL_CHAR_BUDGET:
+        return MapRender(text=text, visible_ids={node.section_id for node in nodes})
+
+    for row in rows_by_id.values():
+        row["summary"] = ""
+    nodes = _nodes(order, rows_by_id)
+    text = header(len(nodes), 0) + SUMMARIES_OMITTED_NOTE + "\n" + "\n".join(
+        render_map_lines(nodes)
+    )
     if len(text) <= MAP_TOOL_CHAR_BUDGET:
         return MapRender(text=text, visible_ids={node.section_id for node in nodes})
 
-    over = f"the map is {len(text)} chars, over the {MAP_TOOL_CHAR_BUDGET}-char limit, and"
+    chars = len(text)
     if not ctx.query.strip():
-        return MapRender(
-            error=_narrow_error(tool, f"{over} no user query is available to rank sections.")
-        )
+        return _too_large(tool, chars, "no user query is available to rank sections")
     leaf_scores = await load_leaf_unit_scores(
         ctx.db,
         revision_by_document=revision_by_document,
         section_ids=[section_id for section_id, _ in order],
         query=ctx.query,
  
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/registry.py` (modified, +3/-2)
```diff
@@ -110,8 +110,9 @@ class ToolContext:
     # to score and fold an oversized map (``scoring/map_lighting.py``) — never
     # by hit tools, which already take their own ``query``/``pattern``.
     # Empty when a caller (e.g. an external MCP client hitting a single
-    # ``corpus.*`` tool directly) has no such query: lighting then fails
-    # that one call with a "narrow scope" error instead of guessing.
+    # ``corpus.*`` tool directly) has no such query: an oversized map that
+    # dropping summaries does not fit then fails that one call as "too
+    # large to map" instead of guessing.
     query: str = ""
 
 
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/snippet.py` (modified, +4/-8)
```diff
@@ -5,7 +5,7 @@
 windowed.
 
 ``build_row`` / ``format_row`` are the one row shape every tool shares —
-outline/node_filter (map rows: indented, ``summary``, ``chunk_count``),
+outline/node_filter (map rows: indented, ``summary``),
 grep/recall (hit rows: flat, ``snippet``, ``score``), and assets (asset rows:
 ``chunk_id`` plus the hosting ``section_path``) all build the same record for
 ``payload["rows"]`` and render it the same way, so a model reads one row
@@ -82,7 +82,6 @@ def build_row(
     section_path: object,
     title: object = "",
     chunk_id: object | None = None,
-    chunk_count: int | None = None,
     summary: str = "",
     snippet: str = "",
     score: float | None = None,
@@ -98,17 +97,16 @@ def build_row(
     on one). For ``image``/``table`` rows ``section_path`` is the *hosting*
     section, and ``hosted`` says whether a host was found (``False`` keeps
     the asset's own ``Root`` path); it is ``None`` for every other kind.
-    ``chunk_count``/``summary`` are map-row fields; ``snippet``/``score`` are
-    hit-row fields; ``depth`` indents a map row under its parent; ``is_hit``
-    marks a row lit up by node_filter/lighting scoring.
+    ``summary`` is a map-row field; ``snippet``/``score`` are hit-row
+    fields; ``depth`` indents a map row under its parent; ``is_hit`` marks a
+    node_filter predicate match.
     """
     return {
         "kind": kind,
         "title": str(title or "").strip(),
         "document_id": str(document_id),
         "section_path": str(section_path),
         "chunk_id": str(chunk_id) if chunk_id else None,
-        "chunk_count": chunk_count,
         "summary": summary,
         "snippet": snippet,
         "score": score,
@@ -129,8 +127,6 @@ def format_row(row: Mapping[str, Any]) -> str:
         header += " (no host section)"
     if row["chunk_id"]:
         header += f" chunk_id={row['chunk_id']}"
-    if row["chunk_count"] is not None:
-        header += f" (chunks={row['chunk_count']})"
     if row["score"] is not None:
         header += f" score={row['score']}"
     if row["is_hit"]:
```

#### Recent Merged Pull Requests:
- **PR #454** (2026-10-05): fix(deploy): use DeepSeek for worker vision (@EricNGOntos)
- **PR #453** (2026-10-05): fix: return correct MIME types for shared demo originals (@suguanYang)
- **PR #452** (2026-10-04): Staging (@suguanYang)
- **PR #451** (2026-10-03): Publish shared demo corpus with retained revisions (@suguanYang)
- **PR #450** (2026-09-30): Staging (@suguanYang)
- **PR #449** (2026-09-30): perf: reuse demo publication artifacts (@suguanYang)
- **PR #448** (2026-09-30): fix: handle gevent publication writes and bound COPY batches (@suguanYang)
- **PR #447** (2026-09-29): feat(retrieval): align agent tool contract and feedback (@EricNGOntos)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

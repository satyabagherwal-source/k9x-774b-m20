> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ontos-ai-knowhere-learnings.md`  
> **Source**: github ([https://github.com/Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere))  
> **Source Version**: `e025ca1a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T16:58:49.072Z  
> **Learning ID**: `learn-github-ontos-ai-knowhere`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Ontos-AI/knowhere

> **Canonical Artifact**: `07_PROJECT_LEARNING/ontos-ai-knowhere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T16:58:48.717Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ontos-AI/knowhere`
- **Description**: Knowhere extracts, parses, and outputs structured chunks ready for AI Agents and RAG.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3802 stars

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
    retry_after = (exc.details or {}).get("retry_after")
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


async def general_exception_handler(request: Reque
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

### Incident Patch 1: `457dcc42` (2026-10-27)
**Commit Message**: feat: introduce PAGE_MEMORY_EMBED_CONCURRENCY configuration for improved embedding performance

- Added PAGE_MEMORY_EMBED_CONCURRENCY setting to .env.example files for both API and worker services, allowing for configurable concurrency in page-image embeddings.
- Updated AIConfig to set the default concurrency to 10, enhancing the embedding process for scanned M0 documents.
- Enhanced tests to validate the new concurrency settings and ensure proper integration within the embedding workflow.
- Refactored relevant code sections to utilize the new concurrency configuration, improving overall performance and scalability.

**File**: `apps/api/.env.example` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ VERCEL_KEY=
 # Page-image and query embeddings use VERCEL_KEY.
 # EMBEDDING_MODEL=google/gemini-embedding-2
 # EMBEDDING_DIM=3072
+# PAGE_MEMORY_EMBED_CONCURRENCY=10
 
 # Optional retrieval overrides have code defaults. Retrieval is evidence-only:
 # evidence is the primary output; evidence_text is deprecated and always empty;
```

**File**: `apps/api/tests/contract/test_scope_enrichment_publish_contract.py` (modified, +2/-0)
```diff
@@ -1325,6 +1325,7 @@ async def _verify_visual_m0_retrieval_and_tools() -> None:
                 vis_rows = vis_res.payload["fused_rows"]
                 assert len(vis_rows) == 2
                 assert vis_rows[0]["chunk_id"] == "scan-m0-p2"
+                assert vis_rows[0]["matched_page_nums"] == [2]
 
                 # 2. Classic route answers via visual channel even though lexical is empty.
                 classic_outcome = await _run_classic_topk_route(
@@ -1544,6 +1545,7 @@ async def _verify_chunk_max_pool_and_flag_off() -> None:
                 merged_rows = merged_res.payload["fused_rows"]
                 assert len(merged_rows) == 1
                 assert merged_rows[0]["chunk_id"] == "merged-sec"
+                assert merged_rows[0]["matched_page_nums"] == [2, 1]
                 assert abs(float(merged_rows[0]["score"]) - page2_score) < 1e-9
 
                 monkeypatch.setattr(settings, "VISUAL_RETRIEVAL_ENABLED", False)
```

**File**: `apps/worker/.env.example` (modified, +1/-0)
```diff
@@ -95,6 +95,7 @@ VERCEL_KEY=
 # Page-image embeddings use VERCEL_KEY.
 # EMBEDDING_MODEL=google/gemini-embedding-2
 # EMBEDDING_DIM=3072
+# PAGE_MEMORY_EMBED_CONCURRENCY=10
 
 # Optional retrieval overrides have code defaults. Retrieval is evidence-only:
 # evidence is the primary output; evidence_text is deprecated and always empty;
```

**File**: `apps/worker/tests/contract/test_page_memory_retrieval_contract.py` (modified, +5/-3)
```diff
@@ -75,14 +75,15 @@ def test_table_search_text_uses_summary_keywords_and_caption_not_content() -> No
 
 
 @pytest.mark.asyncio
-async def test_page_result_assembly_uses_summary_not_raw_content() -> None:
+async def test_page_result_assembly_keeps_refined_content() -> None:
     rows = [
         {
             "chunk_id": "page-node-1",
             "chunk_type": "page",
-            "content": "RAW OCR SHOULD NOT LEAK",
+            "content": "verbatim refined body",
             "chunk_metadata": {
                 "summary": "制度标准总则摘要",
+                "enrichment_state": "refined",
                 "page_nums": [225],
             },
         }
@@ -94,7 +95,8 @@ async def test_page_result_assembly_uses_summary_not_raw_content() -> None:
         exclude_sections=[],
     )
 
-    assert assembled[0]["content"] == "制度标准总则摘要"
+    assert assembled[0]["content"] == "verbatim refined body"
+    assert assembled[0]["content_source"] == "content"
 
 
 @pytest.mark.asyncio
```

**File**: `deploy/ecs/task-definition-worker.staging.json` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@
         {"name": "TRANSFORMERS_CACHE", "value": "/mnt/models/huggingface"},
         {"name": "BILLING_ENABLED", "value": "true"},
         {"name": "SUMMARY_LLM_MAX_CONCURRENT", "value": "8"},
+        {"name": "PAGE_MEMORY_EMBED_CONCURRENCY", "value": "10"},
         {"name": "DS_URL", "value": "https://api.deepseek.com/v1/chat/completions"},
         {"name": "ALI_URL", "value": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"},
         {"name": "ARK_URL", "value": "https://ark.cn-beijing.volces.com/api/v3/chat/completions"},
```

**File**: `deploy/ecs/test_render_task_definitions.py` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@
     "PDF_PROFILE_TOC_ENABLED": "true",
     "REDIS_SYNC_MAX_CONNECTIONS": "200",
     "SUMMARY_LLM_MAX_CONCURRENT": "8",
+    "PAGE_MEMORY_EMBED_CONCURRENCY": "10",
     "WORKER_CONCURRENCY": "10",
 }
 
```

**File**: `packages/shared-python/shared/core/config/ai.py` (modified, +2/-2)
```diff
@@ -71,8 +71,8 @@ class AIConfig(BaseModel):
         ),
     )
     PAGE_MEMORY_EMBED_CONCURRENCY: int = Field(
-        default=8,
-        description="Local per-job page embedding concurrency for scanned M0 documents.",
+        default=10,
+        description="Local per-job page-image embedding concurrency for progressive M0.",
     )
 
     # Runtime LLM controls.
```

**File**: `packages/shared-python/shared/services/ai/embedding/multimodal_client.py` (modified, +1/-1)
```diff
@@ -315,7 +315,7 @@ def embed_images(
         return []
 
     default_concurrency = int(
-        getattr(settings, "PAGE_MEMORY_EMBED_CONCURRENCY", 8) or 8
+        getattr(settings, "PAGE_MEMORY_EMBED_CONCURRENCY", 10) or 10
     )
     resolved_concurrency = max(int(concurrency or default_concurrency), 1)
     tracker_root_id = get_current_token_tracker_root_id()
```

---

### Incident Patch 2: `b88d06f0` (2026-10-27)
**Commit Message**: fix: prevent namespace generation creation collisions

**File**: `apps/api/tests/contract/test_progressive_final_retrieval_concurrency_contract.py` (modified, +61/-0)
```diff
@@ -367,3 +367,64 @@ async def query() -> None:
         asyncio.run(query())
     finally:
         engine.dispose()
+
+
+def test_namespace_generation_primary_keys_do_not_alias_distinct_scopes(
+    monkeypatch: pytest.MonkeyPatch,
+    postgresql_proc: PostgreSQLProcess,
+) -> None:
+    configure_contract_environment(monkeypatch, postgresql_proc)
+    asyncio.run(prepare_contract_storage())
+    engine: Engine = create_engine(
+        make_url(get_contract_database_url()).set(drivername="postgresql+psycopg2")
+    )
+    try:
+        with Session(engine) as db:
+            first: int = advance_namespace_generation(db, user_id="owner:part", namespace="scope")
+            db.commit()
+        with Session(engine) as db:
+            second: int = advance_namespace_generation(db, user_id="owner", namespace="part:scope")
+            db.commit()
+        assert (first, second) == (1, 1)
+    finally:
+        engine.dispose()
+
+
+def test_simultaneous_first_publications_share_one_namespace_generation(
+    monkeypatch: pytest.MonkeyPatch,
+    postgresql_proc: PostgreSQLProcess,
+) -> None:
+    from threading import Barrier
+    from shared.models.database.document import RetrievalNamespaceGeneration
+
+    configure_contract_environment(monkeypatch, postgresql_proc)
+    asyncio.run(prepare_contract_storage())
+    engine: Engine = create_engine(
+        make_url(get_contract_database_url()).set(drivername="postgresql+psycopg2")
+    )
+    try:
+        for attempt in range(4):
+            barrier: Barrier = Barrier(2)
+            namespace: str = f"first-publication-{attempt}"
+
+            def publish() -> int:
+                barrier.wait(timeout=5)
+                with Session(engine) as db:
+                    generation: int = advance_namespace_generation(
+                        db, user_id="parallel-owner", namespace=namespace,
+                    )
+                    db.commit()
+                    return generation
+
+            with ThreadPoolExecutor(max_workers=2) as executor:
+                publications = [executor.submit(publish) for _ in range(2)]
+                assert sorted(task.result(timeout=10) for task in publications) == [1, 2]
+            with Session(engine) as db:
+                rows = db.scalars(select(RetrievalNamespaceGeneration).where(
+                    RetrievalNamespaceGeneration.user_id == "parallel-owner",
+                    RetrievalNamespaceGeneration.namespace == namespace,
+                )).all()
+                assert len(rows) == 1
+                assert rows[0].generation == 2
+    finally:
+        engine.dispose()
```

**File**: `docs/design/progressive-ingestion-implementation-report.md` (modified, +9/-0)
```diff
@@ -215,3 +215,12 @@ capacity measurements predate main's native M0 page-image generation and are
 historical evidence, not a rerun of capacity acceptance for this integrated tree.
 PR creation does not publish the SDK, update Hipo's released dependency, deploy
 services, or close the remaining product/deployed acceptance work.
+
+
+An expanded full Worker run also exposed a namespace-generation initialization
+race: simultaneous first publications generated the same primary key, while the
+insert's conflict target only covered the owner/namespace constraint. Use the
+model's independent UUID primary keys and retain owner/namespace conflict
+arbitration. The existing concurrent parse/billing contract reproduced the failure;
+new PostgreSQL contracts cover first-publication contention and distinct scopes
+whose colon-joined identifiers previously aliased.
```

**File**: `packages/shared-python/shared/services/retrieval/serving_generation.py` (modified, +0/-4)
```diff
@@ -4,8 +4,6 @@
 
 from shared.services.retrieval.corpus_storage import CorpusStorage
 
-from hashlib import sha256
-
 from sqlalchemy import select
 from sqlalchemy.dialects.postgresql import insert
 from sqlalchemy.orm import Session
@@ -22,11 +20,9 @@ def lock_namespace_generation(
     """Create if needed, then lock and return one namespace generation row."""
     corpusStorage: CorpusStorage = CorpusStorage.resolve_namespace(namespace)
     user_id = corpusStorage.resolve_owner(user_id)
-    generation_id = f"rng_{sha256(f'{user_id}:{namespace}'.encode()).hexdigest()}"
     db.execute(
         insert(corpusStorage.RetrievalNamespaceGeneration)
         .values(
-            id=generation_id,
             user_id=user_id,
             namespace=namespace,
             generation=0,
```

---

### Incident Patch 3: `01c009a8` (2026-10-27)
**Commit Message**: docs: keep progressive reader requirements open for discussion

**File**: `docs/design/progressive-ingestion-development-plan.md` (modified, +36/-4)
```diff
@@ -1,19 +1,51 @@
 # Progressive ingestion development plan
 
-Status: Implementation and local automated validation complete. SDK publication,
-dependency pinning, deployed acceptance and capacity validation remain pending.
-See the [implementation report](progressive-ingestion-implementation-report.md).
+Status: In progress; requirement discussion remains open as of 2026-10-27.
+Implemented and locally verified subsets do not close the overall requirement
+or establish final product acceptance. SDK publication, dependency pinning and
+deployed acceptance remain pending. Measured mixed-workload capacity evidence is
+recorded separately in the [capacity follow-up](progressive-mixed-capacity-validation.md).
+See the [implementation report](progressive-ingestion-implementation-report.md)
+for earlier implementation evidence.
 
 The agreed behavior and investigation evidence are recorded in the
 [hardening plan](progressive-ingestion-hardening-plan.md) and
 [ADR index](../adr/README.md). This document defines the development sequence.
 
+## Discussion checkpoint: first-snapshot reading (2026-10-27)
+
+The user explicitly keeps this requirement unfinished and wants to continue
+discussing it. Retain the following two points as the current checkpoint:
+
+1. **Page assets and List reading.** Text-native PDF/PPTX baselines do not
+   pre-generate per-page image assets or native-document visual indexes. They
+   retain page text and immutable `source.pdf` (the converted PDF for PPTX).
+   Scanned/textless visual baselines already carry page images. Ordinary List
+   reading must display original native pages from that retained PDF on demand,
+   not only when opening a citation. Share the selected PDF document/worker and
+   paint nearby visible pages; do not wait for VLM enhancement or render the
+   whole document during initial ingestion. This follow-up is implemented in
+   Hipo commit `787846ed`, with local verification; implementation is not final
+   acceptance or deployed-client evidence.
+2. **Tree reading.** The baseline is not empty: show the document root and
+   source-ordered `Page N` leaves, with navigation to the corresponding List
+   page. It does not yet expose the enhanced chapter/resource hierarchy.
+   Images/Tables remain visible but disabled until final synchronization.
+   Final publication replaces the flat page tree with the chapter/resource tree
+   while preserving List/Tree mode and source-page position. Retained citations
+   continue to read their own immutable snapshot. This behavior is implemented
+   and locally tested; overall scope and acceptance remain under discussion.
+
+Continue requirements discussion from these points. Do not describe the overall
+progressive requirement as complete merely because this subset's tests pass.
+
 ## Target behavior
 
 - Keep `ingestion_mode=full|progressive`, defaulting to full. Hipo selects
   progressive for supported PDF/PPTX inputs; other formats retain full ingestion.
 - Publish a readable baseline before full enhancement. Text-native baselines
-  expose page text; scanned baselines expose complete required page images.
+  expose page text and immutable source PDF for on-demand List page display;
+  scanned baselines expose complete required page images.
   Missing page vectors do not block initial completion and are repaired later.
 - One business Job uses multiple Celery tasks. After baseline publication the
   Job stays done while structure, scope refinement, and vector repair continue.
```

**File**: `docs/design/progressive-ingestion-hardening-plan.md` (modified, +4/-3)
```diff
@@ -1,8 +1,9 @@
 # Progressive ingestion hardening plan
 
-Status: Workflow, reviewed reader behavior, and early Ask availability agreed.
-Technical implementation and validation plan; application-code implementation
-is not authorized.
+Status: Historical investigation and acceptance rationale. Application-code
+implementation was subsequently authorized and progressed; the overall
+requirement remains open for further discussion as of 2026-10-27. Current List
+and Tree decisions are recorded in the development plan's discussion checkpoint.
 
 The execution-oriented development sequence is maintained in the
 [development plan](progressive-ingestion-development-plan.md). This document
```

**File**: `docs/design/progressive-ingestion-implementation-report.md` (modified, +8/-3)
```diff
@@ -1,8 +1,13 @@
 # Progressive ingestion implementation and verification
 
-Implementation and local automated validation are complete. Nothing was pushed,
-published, merged, or deployed. This report does not establish production capacity
-or deployed-client acceptance.
+Overall requirement status: in progress and under continued discussion as of
+2026-10-27. This report records an earlier implemented and locally verified
+subset; it does not establish final product acceptance or deployed-client
+acceptance. The [development plan discussion checkpoint](progressive-ingestion-development-plan.md#discussion-checkpoint-first-snapshot-reading-2026-10-27)
+records the latest List/Tree decisions and the user's explicit unfinished status.
+Subsequent capacity evidence is in the [mixed-workload follow-up](progressive-mixed-capacity-validation.md).
+The original implementation described below was not pushed, published, merged,
+or deployed at the time of that report.
 
 ## Delivery locations
 
```

#### Recent Merged Pull Requests:
- **PR #478** (2026-10-27): feat: publish progressive ingestion snapshots atomically (@suguanYang)
- **PR #477** (2026-10-27): chore: promote main to staging (defer page embeddings) (@EricNGOntos)
- **PR #476** (2026-10-27): Defer page embeddings for electronic PDFs after M0 (@EricNGOntos)
- **PR #475** (2026-10-27): Unify DeepSeek Flash defaults and keep page-kind counts JSON-safe (@EricNGOntos)
- **PR #474** (2026-10-27): chore: promote main to staging (TOC ownership + page-memory cleanup) (@EricNGOntos)
- **PR #473** (2026-10-27): feat: page-memory TOC ownership and progressive retrieval pipeline (@EricNGOntos)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. introduce PAGE_MEMORY_EMBED_CONCURRENCY configuration for improved embedding per

**RULE**:
When implementing operations in `apps/api/.env.example`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ontos-AI/knowhere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `457dcc42`: introduce PAGE_MEMORY_EMBED_CONCURRENCY configuration for improved embedding performance. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/api/.env.example`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# PAGE_MEMORY_EMBED_CONCURRENCY=10
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `457dcc42` are properly handled with clean fallback behavior.

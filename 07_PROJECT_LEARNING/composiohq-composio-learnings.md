# Forensic Learning Record (Deep Inspection): ComposioHQ/composio

> **Canonical Artifact**: `07_PROJECT_LEARNING/composiohq-composio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ComposioHQ/composio](https://github.com/ComposioHQ/composio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:23.450Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ComposioHQ/composio`
- **Description**: Composio powers 1000+ toolkits, tool search, context management, authentication, and a sandboxed workbench to help you build AI agents that turn intent into action.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 30441 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/composio/core/models/__init__.py`
```
from .auth_configs import AuthConfigs
from .connected_accounts import ConnectedAccounts
from .custom_tool import ExperimentalToolkit
from .custom_tool_types import (
    CustomTool,
    ProxyExecuteBinaryData,
    RegisteredCustomTool,
    RegisteredCustomToolkit,
    SessionContext,
    ToolRouterSessionProxyExecuteResponse,
)
from .experimental import (
    ExperimentalAPI,
    ExperimentalCustomToolkits,
    ExperimentalUsage,
    UsageSummaryResponse,
)
from .keyring import Keyring
from .logs import Logs
from .mcp import MCP
from .tool_router import ToolRouter
from .tool_router_constants import SESSION_PRESET_DIRECT_TOOLS
from .tool_router_session import ToolRouterSession, ToolRouterSessionExecuteResponse
from .tool_router_session_delete import ToolRouterSessionDeleteResponse
from .tool_router_session_files import RemoteFile, ToolRouterSessionFilesMount
from .toolkits import Toolkits
from .tools import Tools
from .triggers import Triggers
from .webhook_events import (
    ConnectionExpiredEvent,
    ConnectionState,
    ConnectionStatusEnum,
    SingleConnectedAccountDetailedResponse,
    WebhookConnectionMetadata,
    WebhookEvent,
    WebhookEventType,
    is_connection_expired_event,
)
from .webhooks import (
    WebhookEndpoints,
    Webhooks,
    WebhookSubscription,
    WebhookSubscriptions,
    WebhookVersion,
)

__all__ = [
    "AuthConfigs",
    "ConnectedAccounts",
    "ConnectionExpiredEvent",
    "ConnectionState",
    "ConnectionStatusEnum",
    "CustomTool",
    "ExperimentalAPI",
    "ExperimentalCustomToolkits",
    "ExperimentalToolkit",
    "ExperimentalUsage",
    "UsageSummaryResponse",
    "Keyring",
    "Logs",
    "MCP",
    "ProxyExecuteBinaryData",
    "RegisteredCustomTool",
    "RegisteredCustomToolkit",
    "RemoteFile",
    "SessionContext",
    "SESSION_PRESET_DIRECT_TOOLS",
    "SingleConnectedAccountDetailedResponse",
    "ToolRouter",
    "ToolRouterSession",
    "ToolRouterSessionDeleteResponse",
    "ToolRouterSessionExecuteResponse",
    "ToolRouterSessionFilesMount",
    "ToolRouterSessionProxyExecuteResponse",
    "Toolkits",
    "Tools",
    "Triggers",
    "WebhookConnectionMetadata",
    "WebhookEndpoints",
    "WebhookEvent",
    "WebhookEventType",
    "WebhookSubscription",
    "WebhookSubscriptions",
    "WebhookVersion",
    "Webhooks",
    "is_connection_expired_event",
]

```

### Core Architecture Module: `python/composio/core/models/_files.py`
```
from __future__ import annotations

import contextlib
import functools
import hashlib
import os
import typing as t
from pathlib import Path
from urllib.parse import unquote, urlparse
import uuid
import datetime

import requests
import typing_extensions as te
from composio_client import BaseModel as _ComposioBaseModel
from pydantic import BaseModel, ConfigDict, Field

from composio.client import HttpClient
from composio.client.types import Tool
from composio.exceptions import (
    ErrorDownloadingFile,
    ErrorUploadingFile,
    FileUploadAbortedError,
    ResponseTooLargeError,
    SDKFileNotFoundError,
    UnsafePathComponentError,
)
from composio.utils import mimetypes
from composio.utils.json_schema import dereference_json_schema
from composio.utils.safe_path import open_unique_file, secure_basename_join, secure_join
from composio.utils.url_safety import (
    parse_content_length,
    safe_get,
    safe_request,
)
from composio.utils.sensitive_file_upload_paths import (
    assert_safe_local_file_upload_path,
)
from composio.utils.upload_dir_allowlist import (
    assert_path_inside_upload_dirs,
)
from composio.utils.logging import WithLogger

if t.TYPE_CHECKING:
    from .tools import ToolExecutionResponse
    from ._modifiers import BeforeFileUploadContextCallable  # noqa: F401

_DEFAULT_CHUNK_SIZE = 1024 * 1024
_FILE_UPLOAD = "/api/v3/files/upload/request"
_MAX_FILENAME_LENGTH = 100
"""
Maximum filename length to prevent issues with long URLs from public buckets.
Long filenames (containing hashes, UUIDs, or encoded metadata) are replaced
with timestamped filenames to match TypeScript SDK behavior.
"""

_MAX_RESPONSE_SIZE = 100 * 1024 * 1024  # 100 MB default limit
"""
Maximum response size in bytes when fetching files from URLs.
Prevents memory exhaustion attacks from malicious URLs pointing to large files.
"""

_CONNECT_TIMEOUT = 5  # seconds
_READ_TIMEOUT = 60  # seconds
"""
Separate connect and read timeouts for URL fetching.
Connect timeout is short to fail fast on unreachable hosts.
Read timeout is longer to allow for slower file transfers.
"""

_DELETE_VALUE: t.Final = object()
"""
Sentinel returned by the upload walker to signal that a value should be dropped
from its parent container. ``None`` and ``""`` are both legal payload values, so
the walker cannot use either to mean "remove this key/item".
"""

LOCAL_CACHE_DIRECTORY_NAME = ".composio"
"""
Local cache directory name for composio CLI
"""

ENV_LOCAL_CACHE_DIRECTORY = "COMPOSIO_CACHE_DIR"
"""
Environment to set the composio caching directory.
"""

LOCAL_OUTPUT_FILE_DIRECTORY_NAME = "files"
"""
Name of the cache sub-directory into which files downloaded during tool
execution are written. Previously ``outputs``; now ``files`` for parity with
the TypeScript SDK.
"""


def get_cache_directory() -> Path:
    """Resolve the local caching directory without touching the filesystem.

    ``COMPOSIO_CACHE_DIR`` is read on every call, so it can be set after
    ``composio`` has already been imported. ``Path.home()`` is only consulted
    when the variable is unset: it can raise ``RuntimeError`` when there is no
    resolvable home directory, which is exactly the situation
    ``COMPOSIO_CACHE_DIR`` exists to work around, so it must not be evaluated
    eagerly as a fallback argument.
    """
    configured = os.environ.get(ENV_LOCAL_CACHE_DIRECTORY)
    if configured:
        return Path(configured)

    try:
        home = Path.home()
    except RuntimeError as e:
        raise RuntimeError(
            "Could not determine a home directory to store the Composio cache "
            f"in. Provide a writable path using the {ENV_LOCAL_CACHE_DIRECTORY} "
            "environment variable."
        ) from e
    return home / LOCAL_CACHE_DIRECTORY_NAME


def get_output_file_directory() -> Path:
    """Default local directory into which files downloaded during tool
    execution are written. Override by passing ``file_download_dir=...`` to
    Composio, or by setting ``outdir`` on ``FileHelper`` directly.
    """
    return get_cache_directory() / LOCAL_OUTPUT_FILE_DIRECTORY_NAME


def ensure_cache_directory() -> Path:
    """Create the cache directory on first use and check that it is writable.

    This used to run at module import time, so a bare ``import composio``
    raised ``RuntimeError`` on any read-only filesystem -- AWS Lambda,
    distroless containers, ``ProtectHome=true`` systemd units -- even for
    programs that never touched a file. Deferring it to first use keeps the
    same check, and the same error message, for the callers that actually
    need the directory.
    """
    directory = get_cache_directory()
    try:
        directory.mkdir(parents=True, exist_ok=True)
        if not os.access(directory, os.W_OK):
            raise OSError
    except OSError as e:
        raise RuntimeError(
            f"Cache directory {directory} is not writable please "
            f"provide a path that is writable using {ENV_LOCAL_CACHE_DIRECTORY} "
            "environment variable."
        ) from e
    return directory


def __getattr__(name: str) -> Path:
    """Keep the historical module-level path constants working, but lazily.

    ``LOCAL_CACHE_DIRECTORY`` and ``LOCAL_OUTPUT_FILE_DIRECTORY`` used to be
    computed at import time. They are now resolved on attribute access
    instead (PEP 562), so importing this module no longer touches the
    filesystem or depends on the environment, and both constants observe a
    ``COMPOSIO_CACHE_DIR`` that was set after import.
    """
    if name == "LOCAL_CACHE_DIRECTORY":
        return get_cache_directory()
    if name == "LOCAL_OUTPUT_FILE_DIRECTORY":
        return get_output_file_directory()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def get_md5(file: Path) -> str:
    """Calculate MD5 hash of a file for integrity verification.

    Note: MD5 is used here for file integrity checking and deduplication,
    not for cryptographic security. The Composio API requires MD5 hashes
    for file upload verification. For security-critical applications,
    consider using SHA-256 for additional integrity checks.

    Args:
        file: Path to file to hash

    Returns:
        Hexadecimal MD5 hash string
    """
    # `usedforsecurity=False` lets this run on FIPS-mode systems, where
    # `hashlib.md5()` without the flag raises `ValueError: [digital envelope
    # routines] unsupported`. We're hashing for integrity / deduplication,
    # not security — the API just needs the digest for upload verification.
    obj = hashlib.md5(usedforsecurity=False)
    with file.open("rb") as fp:
        while True:
            line = fp.read(_DEFAULT_CHUNK_SIZE)
            if not line:
                break
            obj.update(line)
    return obj.hexdigest()


def _upload_to_presigned_url(
    url: str, data: t.Union[bytes, t.IO[bytes]], mimetype: str
) -> None:
    """PUT ``data`` to a presigned S3 URL with the content type it was signed with.

    The presign request carries ``mimetype``, so the PUT must send the same
    value as ``Content-Type``: when the signature covers the content type, a
    mismatched or missing header is rejected with ``403 SignatureDoesNotMatch``.
    Routing every presigned PUT through one helper keeps the file and bytes
    upload paths from drifting apart again, mirroring ``uploadFileToS3`` in
    the TypeScript SDK, which funnels path, URL, and File inputs through a
    single uploader.

    Raises:
        ErrorUploadingFile: On transport failure or a non-200 response,
            including the HTTP status when one was received.
    """
    try:
        response = safe_request(
            "PUT",
            url,
            data=data,
            headers={"Content-Type": mimetype},
            timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
        )
    except requests.exceptions.RequestException as e:
        raise ErrorUploadingFile(
            "Failed to upload to S3: "
            f"{_sanitize_url_for_logging(url)}. Error: {type(e).__name__}"
        ) from e
    if response.status_code != 200:
        raise ErrorUploadingFile(
            f"Failed to upload to S3. Status: {response.status_code}. "
            "This may indicate an expired presigned URL or permission issue."
        )


def upload(url: str, file: Path, mimetype: t.Optional[str] = None) -> bool:
    """Upload file to presigned S3 URL.

    Args:
        url: Presigned S3 upload URL
        file: Path to file to upload
        mimetype: Content type to send with the upload. Defaults to the type
            guessed from ``file``. This must match the ``mimetype`` the
            presigned URL was requested with, otherwise S3 rejects the PUT
            with ``403 SignatureDoesNotMatch`` when the signature covers the
            content type.

    Returns:
        True if the upload succeeded.

    Raises:
        ErrorUploadingFile: If the upload fails; the message includes the
            HTTP status when one was received.
    """
    if mimetype is None:
        mimetype = mimetypes.guess(file=file)
    with file.open("rb") as data:
        _upload_to_presigned_url(url=url, data=data, mimetype=mimetype)
    return True


class _FileUploadResponse(_ComposioBaseModel):
    id: str
    key: str
    type: str
    new_presigned_url: str


def _request_presigned_upload(
    client: HttpClient,
    *,
    filename: str,
    md5: str,
    mimetype: str,
    tool: str,
    toolkit: str,
) -> _FileUploadResponse:
    """Request a presigned S3 upload URL from the backend.

    Single-sources the presign wire shape so the file and bytes upload paths
    request the same fields they later send.
    """
    return client.post(
        path=_FILE_UPLOAD,
        body={
            "md5": md5,
            "filename": filename,
            "mimetype": mimetype,
            "tool_slug": tool,
            "toolkit_slug": toolkit,
        },
        cast_to=_FileUploadResponse,
    )


def _is_url(va
```

### Core Architecture Module: `python/composio/core/models/_modifiers.py`
```
from __future__ import annotations

import functools
import typing as t

import typing_extensions as te

if t.TYPE_CHECKING:
    from .tools import Tool, ToolExecutionResponse, tool_execute_params


# TODO: Maybe use `te.Unpack` in tools.execute?
class ToolExecuteParams(te.TypedDict):
    allow_tracing: te.NotRequired[t.Optional[bool]]
    arguments: t.Dict[str, t.Optional[t.Any]]
    connected_account_id: te.NotRequired[str]
    custom_auth_params: te.NotRequired["tool_execute_params.CustomAuthParams"]
    custom_connection_data: te.NotRequired["tool_execute_params.CustomConnectionData"]
    entity_id: te.NotRequired[str]
    text: te.NotRequired[str]
    user_id: te.NotRequired[str]
    version: te.NotRequired[str]
    dangerously_skip_version_check: te.NotRequired[t.Optional[bool]]


ModifierInOut = t.Union["ToolExecuteParams", "ToolExecutionResponse", "Tool"]


class BeforeExecute(t.Protocol):
    """
    A modifier that is called before the tool is executed.
    """

    def __call__(
        self,
        tool: str,
        toolkit: str,
        params: ToolExecuteParams,
    ) -> ToolExecuteParams: ...


class AfterExecute(t.Protocol):
    """
    A modifier that is called after the tool is executed.
    """

    def __call__(
        self,
        tool: str,
        toolkit: str,
        response: ToolExecutionResponse,
    ) -> ToolExecutionResponse: ...


class SchemaModifier(t.Protocol):
    """
    A modifier that is called to modify the schema of the tool.
    """

    def __call__(
        self,
        tool: str,
        toolkit: str,
        schema: "Tool",
    ) -> "Tool": ...


class BeforeFileUploadCallable(t.Protocol):
    """Legacy positional form of the ``before_file_upload`` hook.

    ``(path, tool, toolkit) -> str | bool``. Still supported for back-compat,
    but new code should use :class:`BeforeFileUploadContextCallable` so it can
    discriminate local paths from URLs via ``context["source"]``.
    """

    def __call__(
        self,
        path: str,
        tool: str,
        toolkit: str,
    ) -> t.Union[str, bool]: ...


class BeforeFileUploadContext(te.TypedDict):
    """Context passed to the new-form ``before_file_upload`` hook.

    - ``path``: the local filesystem path for ``source="path"``, or the URL
      string for ``source="url"``.
    - ``source``: discriminator — ``"path"`` for local paths, ``"url"`` for
      ``http(s)://...`` inputs. Mirrors the TypeScript SDK's ``source`` field
      (TS additionally emits ``"file"`` for ``File`` objects; Python has no
      equivalent runtime type).
    - ``tool`` / ``toolkit``: slugs of the tool being executed.
    """

    path: str
    source: te.Literal["path", "url"]
    tool: str
    toolkit: str


class BeforeFileUploadContextCallable(t.Protocol):
    """Preferred form of the ``before_file_upload`` hook.

    Takes a single :class:`BeforeFileUploadContext` argument and returns either
    a new path/URL string, or ``False`` to abort the upload.
    """

    def __call__(
        self,
        context: BeforeFileUploadContext,
    ) -> t.Union[str, bool]: ...


BeforeFileUploadLike = t.Union[
    BeforeFileUploadCallable,
    BeforeFileUploadContextCallable,
]
"""Either form of ``before_file_upload``. Adapted internally."""


def _count_positional_params(fn: t.Callable) -> int:
    """Return the number of positional (or positional-or-keyword) params, or
    -1 if the signature can't be introspected (e.g. builtins)."""
    import inspect

    try:
        sig = inspect.signature(fn)
    except (TypeError, ValueError):
        return -1
    return sum(
        1
        for p in sig.parameters.values()
        if p.kind
        in (
            inspect.Parameter.POSITIONAL_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        )
    )


def _adapt_before_file_upload(
    hook: BeforeFileUploadLike,
) -> BeforeFileUploadContextCallable:
    """Normalise a user-supplied hook to the context-object form.

    A hook declared with exactly 3 positional parameters is treated as the
    legacy ``(path, tool, toolkit)`` form; anything else (typically a single
    positional ``context`` parameter) is treated as the new form.
    """
    if _count_positional_params(hook) == 3:
        legacy = t.cast(BeforeFileUploadCallable, hook)

        def wrap(context: BeforeFileUploadContext) -> t.Union[str, bool]:
            return legacy(context["path"], context["tool"], context["toolkit"])

        return wrap
    return t.cast(BeforeFileUploadContextCallable, hook)


ModifierSlug: t.TypeAlias = str
AfterExecuteModifierL: t.TypeAlias = t.Literal["after_execute"]
BeforeExecuteModifierL: t.TypeAlias = t.Literal["before_execute"]
SchemaModifierL: t.TypeAlias = t.Literal["schema"]
BeforeFileUploadModifierL: t.TypeAlias = t.Literal["before_file_upload"]


class Modifier:
    def __init__(
        self,
        modifier: t.Optional[
            AfterExecute
            | BeforeExecute
            | SchemaModifier
            | BeforeExecuteMeta
            | AfterExecuteMeta
            | BeforeFileUploadCallable
            | BeforeFileUploadContextCallable
        ],
        type_: (
            AfterExecuteModifierL
            | BeforeExecuteModifierL
            | SchemaModifierL
            | AfterExecuteMetaModifierL
            | BeforeExecuteMetaModifierL
            | BeforeFileUploadModifierL
        ),
        tools: t.List[str],
        toolkits: t.List[str],
    ) -> None:
        self.modifier = modifier
        self.tools = tools
        self.type = type_
        self.toolkits = toolkits

    def apply(
        self,
        toolkit: str,
        tool: str,
        data: ModifierInOut,
        modifer_type: str,
    ) -> ModifierInOut:
        if self.modifier is None:
            raise ValueError("Modifier is not provided")

        # If no tools or toolkits are provided, apply the modifier to all tools
        if (
            self.type == modifer_type
            and len(self.tools) == 0
            and len(self.toolkits) == 0
        ):
            return self.modifier(tool, toolkit, data)  # type: ignore

        # If the modifier is not the same type, or the slug is not in the tools or
        # toolkits, return the data as is
        if (
            self.type != modifer_type
            or tool not in self.tools
            and toolkit not in self.toolkits
        ):
            return data

        # Apply the modifier to the data
        return self.modifier(tool, toolkit, data)  # type: ignore


@t.overload
def after_execute(
    modifier: t.Optional[AfterExecute],
) -> Modifier: ...


@t.overload
def after_execute(
    *,
    tools: t.Optional[t.List[str]] = None,
    toolkits: t.Optional[t.List[str]] = None,
) -> t.Callable[[AfterExecute], Modifier]: ...


def after_execute(
    modifier: t.Optional[AfterExecute] = None,
    *,
    tools: t.Optional[t.List[str]] = None,
    toolkits: t.Optional[t.List[str]] = None,
) -> Modifier | t.Callable[[AfterExecute], Modifier]:
    if modifier is not None:
        return Modifier(
            modifier=modifier,
            type_="after_execute",
            tools=tools or [],
            toolkits=toolkits or [],
        )

    if tools is not None or toolkits is not None:
        return t.cast(
            t.Callable[[AfterExecute], Modifier],
            functools.partial(
                after_execute,
                tools=tools or [],
                toolkits=toolkits or [],
            ),
        )

    raise ValueError("Either tools or toolkits must be provided")


@t.overload
def before_execute(modifier: t.Optional[BeforeExecute]) -> Modifier: ...


@t.overload
def before_execute(
    *,
    tools: t.Optional[t.List[str]] = None,
    toolkits: t.Optional[t.List[str]] = None,
) -> t.Callable[[BeforeExecute], Modifier]: ...


def before_execute(
    modifier: t.Optional[BeforeExecute] = None,
    *,
    tools: t.Optional[t.List[str]] = None,
    toolkits: t.Optional[t.List[str]] = None,
) -> Modifier | t.Callable[[BeforeExecute], Modifier]:
    if modifier is not None:
        return Modifier(
            modifier=modifier,
            type_="before_execute",
            tools=tools or [],
            toolkits=toolkits or [],
        )

    if tools is not None or toolkits is not None:
        return t.cast(
            t.Callable[[BeforeExecute], Modifier],
            functools.partial(
                before_execute,
                tools=tools or [],
                toolkits=toolkits or [],
            ),
        )

    raise ValueError("Either tools or toolkits must be provided")


@t.overload
def before_file_upload(modifier: t.Optional[BeforeFileUploadLike]) -> Modifier: ...


@t.overload
def before_file_upload(
    *,
    tools: t.Optional[t.List[str]] = None,
    toolkits: t.Optional[t.List[str]] = None,
) -> t.Callable[[BeforeFileUploadLike], Modifier]: ...


def before_file_upload(
    modifier: t.Optional[BeforeFileUploadLike] = None,
    *,
    tools: t.Optional[t.List[str]] = None,
    toolkits: t.Optional[t.List[str]] = None,
) -> Modifier | t.Callable[[BeforeFileUploadLike], Modifier]:
    """
    Build a ``Modifier`` for the file-upload hook (same scoping pattern as
    :func:`before_execute`).

    Your callable may take **either**:

    - a single ``context`` argument (:class:`BeforeFileUploadContext`) — the
      preferred form, exposes ``context["source"]`` (``"path"`` or ``"url"``),
      or
    - three positional arguments ``(path, tool, toolkit)`` — legacy form, kept
      for back-compat.

    Return a new path/URL string to substitute, or ``False`` to abort the
    upload (raises :class:`~composio.exceptions.FileUploadAbortedError`).

    Pass the returned ``Modifier`` in ``modifiers=[...]`` on
    :meth:`composio.core.models.tools.Tools.execute` or ``tools.get``. Multiple
    such modifiers are composed in list order.
    """
    if modifier is not None:
        return Modifier(
            modifier=modifier,
            type_="before
```

### Core Architecture Module: `python/composio/core/models/_telemetry.py`
```
import atexit
import functools
import queue as q
import threading as tr
import time
import typing as t

import httpx
import typing_extensions as te

TELEMETRY_URL = "https://telemetry.composio.dev/v1"
METRIC_ENDPOINT = f"{TELEMETRY_URL}/metrics/invocations"
ERROR_ENDPOINT = f"{TELEMETRY_URL}/errors"


class ErrorData(te.TypedDict):
    name: str
    "The name of the error"

    code: te.NotRequired[str]
    "The code of the error"

    errorId: te.NotRequired[str]
    "The error ID of the error"

    message: te.NotRequired[str]
    "The message of the error"

    stack: te.NotRequired[str]
    "The stack trace of the error"


class SourceData(te.TypedDict):
    host: te.NotRequired[str]
    "The name of the source/host"

    service: te.NotRequired[te.Literal["sdk", "apollo", "hermes", "thermos"]]
    "The service of the source"

    language: te.NotRequired[te.Literal["python", "typescript", "go", "rust"]]
    "The language of the function that was invoked"

    version: te.NotRequired[str]
    "The version of the source"

    platform: te.NotRequired[str]
    "The platform of the source"

    environment: te.NotRequired[
        te.Literal["development", "production", "ci", "staging", "test"]
    ]
    "The environment of the source, eg: development, production, ci etc"


class Metadata(te.TypedDict):
    projectId: te.NotRequired[str]
    "The project ID of the source"

    provider: te.NotRequired[str]
    "The provider used in the source"


class TelemetryData(te.TypedDict):
    functionName: str
    "The name of the function that was invoked"

    durationMs: te.NotRequired[float]
    "The duration of the function invocation in milliseconds"

    timestamp: te.NotRequired[float]
    "The timestamp of the function invocation in epoch seconds"

    props: te.NotRequired[t.Dict]
    "The properties of the function invocation"

    source: te.NotRequired[SourceData]
    """Source of the metric"""

    metadata: te.NotRequired[Metadata]
    """Runtime metadata"""

    error: te.NotRequired[ErrorData]
    """Error data."""


EventType: t.TypeAlias = t.Literal["metric", "error"]
Event = t.Tuple[EventType, TelemetryData]
EventQueue: t.TypeAlias = q.Queue[Event]

_queue: t.Optional[EventQueue] = None
_event: t.Optional[tr.Event] = None
_thread: t.Optional[tr.Thread] = None


def _setup():
    global _queue, _event, _thread
    if _queue is None:
        _queue = q.Queue[Event]()

    if _event is None:
        _event = tr.Event()

    if _thread is None:
        _thread = tr.Thread(
            target=_thread_loop,
            kwargs={
                "queue": _queue,
                "event": _event,
            },
            daemon=True,
        )
        _thread.start()
        atexit.register(
            functools.partial(
                _teardown,
                queue=_queue,
                event=_event,
                thread=_thread,
            )
        )

    return _queue, _event, _thread


def _teardown(queue: EventQueue, event: tr.Event, thread: tr.Thread):
    # Wait max 2 seconds for queue to empty
    deadline = time.time() + 2.0
    while queue.qsize() and time.time() < deadline:
        time.sleep(0.1)

    event.set()
    # Join with timeout to prevent infinite waiting
    thread.join(timeout=3.0)


def _push(event: Event):
    try:
        _ = (
            httpx.post(
                url=METRIC_ENDPOINT,
                json=[event[1]],
                timeout=2.0,  # 2 second timeout to prevent hanging
            )
            if event[0] == "metric"
            else httpx.post(
                url=ERROR_ENDPOINT,
                json=event[1],
                timeout=2.0,  # 2 second timeout to prevent hanging
            )
        )
    except (httpx.TimeoutException, httpx.HTTPError, Exception):
        # Silently fail - telemetry shouldn't break the application
        pass


def _thread_loop(queue: EventQueue, event: tr.Event):
    while not event.is_set():
        try:
            _push(queue.get(timeout=0.1))
        except q.Empty:
            continue


def push_event(event: Event):
    q, _, _ = _setup()
    q.put(event)


def create_event(type: EventType, **payload: te.Unpack[TelemetryData]) -> Event:
    return type, payload

```

### Core Architecture Module: `python/composio/core/models/auth_configs.py`
```
from __future__ import annotations

import typing as t

import typing_extensions as te

from composio.client.types import (
    auth_config_create_params,
    auth_config_create_response,
    auth_config_delete_response,
    auth_config_list_params,
    auth_config_list_response,
    auth_config_retrieve_response,
    auth_config_update_params,
    auth_config_update_response,
    auth_config_update_status_response,
)
from composio.core.models.base import Resource


class AuthConfigs(Resource):
    """
    Manage authentication configurations.
    """

    def list(
        self,
        **query: te.Unpack[auth_config_list_params.AuthConfigListParams],
    ) -> auth_config_list_response.AuthConfigListResponse:
        """
        Lists authentication configurations based on provided filter criteria.
        """
        return self._client.auth_configs.list(**query)

    @t.overload
    def create(
        self, toolkit: str, options: auth_config_create_params.AuthConfigUnionMember1
    ) -> auth_config_create_response.AuthConfig: ...

    @t.overload
    def create(
        self, toolkit: str, options: auth_config_create_params.AuthConfigUnionMember0
    ) -> auth_config_create_response.AuthConfig: ...

    def create(
        self, toolkit: str, options: auth_config_create_params.AuthConfig
    ) -> auth_config_create_response.AuthConfig:
        """
        Create a new auth config

        :param toolkit: The toolkit to create the auth config for.
        :param options: The options to create the auth config with.
        :return: The created auth config.
        """
        return self._client.auth_configs.create(
            toolkit={"slug": toolkit}, auth_config=options
        ).auth_config

    def get(
        self, nanoid: str
    ) -> auth_config_retrieve_response.AuthConfigRetrieveResponse:
        """
        Retrieves a specific authentication configuration by its ID

        :param nanoid: The ID of the auth config to retrieve.
        :return: The retrieved auth config.
        """
        return self._client.auth_configs.retrieve(nanoid)

    @t.overload
    def update(
        self, nanoid: str, *, options: auth_config_update_params.Variant0
    ) -> auth_config_update_response.AuthConfigUpdateResponse: ...

    @t.overload
    def update(
        self, nanoid: str, *, options: auth_config_update_params.Variant1
    ) -> auth_config_update_response.AuthConfigUpdateResponse: ...

    def update(
        self, nanoid: str, *, options: auth_config_update_params.AuthConfigUpdateParams
    ) -> auth_config_update_response.AuthConfigUpdateResponse:
        """
        Updates an existing authentication configuration.

        This method allows you to modify properties of an auth config such as credentials,
        scopes, or tool restrictions. The update type (custom or default) determines which
        fields can be updated.

        :param nanoid: The ID of the auth config to update.
        :param options: The options to update the auth config with.
        :return: The update result with success and message fields.
        """
        return self._client.auth_configs.update(
            nanoid=nanoid,
            type=options["type"],  # type: ignore
            credentials=options.get("credentials", self._client.not_given),
            is_enabled_for_tool_router=options.get(
                "is_enabled_for_tool_router", self._client.not_given
            ),
            tool_access_config=options.get(
                "tool_access_config", self._client.not_given
            ),
        )

    def delete(
        self, nanoid: str
    ) -> auth_config_delete_response.AuthConfigDeleteResponse:
        """
        Deletes an existing authentication configuration.

        :param nanoid: The ID of the auth config to delete.
        :return: The deletion result with success and message fields.
        """
        return self._client.auth_configs.delete(nanoid)

    def __update_status(
        self,
        nanoid: str,
        status: t.Literal["ENABLED", "DISABLED"],
    ) -> auth_config_update_status_response.AuthConfigUpdateStatusResponse:
        return self._client.auth_configs.update_status(status, nanoid=nanoid)

    def enable(
        self, nanoid: str
    ) -> auth_config_update_status_response.AuthConfigUpdateStatusResponse:
        """
        Enables an existing authentication configuration.

        :param nanoid: The ID of the auth config to enable.
        :return: The status update result with success and message fields.
        """
        return self.__update_status(nanoid, "ENABLED")

    def disable(
        self, nanoid: str
    ) -> auth_config_update_status_response.AuthConfigUpdateStatusResponse:
        """
        Disables an existing authentication configuration.

        :param nanoid: The ID of the auth config to disable.
        :return: The status update result with success and message fields.
        """
        return self.__update_status(nanoid, "DISABLED")

```

### Core Architecture Module: `python/composio/core/models/base.py`
```
"""
Base resource class for representing resources in the composio client.
"""

import contextvars
from collections.abc import Mapping
import functools
import os
import time
import traceback
import typing as t

from composio.__version__ import __version__
from composio.client import HttpClient
from composio.utils.redaction import redact_sensitive_text
from composio.utils.logging import WithLogger

from ._telemetry import Event, create_event, push_event

PayloadT = t.TypeVar("PayloadT", bound=dict)

allow_tracking = contextvars.ContextVar[bool]("allow_tracking", default=True)
_environment = os.getenv("ENVIRONMENT", "development")


def trace_method(method: t.Callable, name: str) -> t.Callable:
    """Wrap a method to log the call."""

    # Check if the method is a class method
    if getattr(method, "__self__", None) is not None:
        return method

    @functools.wraps(method)
    def trace_wrapper(self, *args: t.Any, **kwargs: t.Any) -> t.Any:
        if not allow_tracking.get():
            return method(self, *args, **kwargs)

        event: t.Optional[Event] = None
        start_time = time.time()
        event = create_event(
            type="metric",
            functionName=name,
            timestamp=time.time(),
            props={},
            source={
                "environment": _environment,  # type: ignore
                "language": "python",
                "service": "sdk",
                "version": __version__,
            },
            metadata={
                "provider": self._client.provider,
            },
        )
        try:
            return method(self, *args, **kwargs)
        except Exception as e:
            _, payload = event
            payload["error"] = {
                "name": e.__class__.__name__,
                "message": redact_sensitive_text(str(e)),
                "stack": redact_sensitive_text(traceback.format_exc()),
            }
            event = ("error", payload)
            raise e
        finally:
            if event is not None:
                event[1]["durationMs"] = (time.time() - start_time) * 1000
                push_event(event=event)

    trace_wrapper.__name__ = method.__name__
    return trace_wrapper


class ResourceMeta(type):
    """Meta class for resource classes."""

    def __init__(cls, name, bases, attrs):
        for attr in attrs:
            if attr.startswith("_") or not callable(getattr(cls, attr)):
                continue
            setattr(cls, attr, trace_method(getattr(cls, attr), f"{name}.{attr}"))


class Resource(WithLogger, metaclass=ResourceMeta):
    """Base resource class for composio client."""

    def sanitize_payload(self, payload: PayloadT) -> PayloadT:
        return {k: v for k, v in payload.items()}  # type: ignore

    def __init__(self, client: HttpClient):
        super().__init__()
        self._client = client


def header_value(headers: t.Mapping[str, t.Any], name: str) -> t.Optional[str]:
    """The non-empty value of ``name`` in ``headers``, matched case-insensitively."""
    if not isinstance(headers, Mapping):
        return None
    wanted = name.lower()
    for key, value in headers.items():
        if isinstance(key, str) and key.lower() == wanted:
            if isinstance(value, str) and value:
                return value
    return None


def credential_headers(client: HttpClient) -> t.Dict[str, str]:
    """The single credential header the client puts on the wire.

    A non-empty ``x-user-api-key`` default header wins: the client treats a
    caller-placed credential header as the credential and suppresses the
    configured keys. Otherwise the project key travels as ``x-api-key``,
    otherwise the resolved user API key as ``x-user-api-key``. Empty when no
    credential is held. The environment is never consulted here.
    """
    default_headers: t.Mapping[str, t.Any] = client.default_headers
    header_key = header_value(default_headers, "x-user-api-key")
    if header_key:
        return {"x-user-api-key": header_key}
    api_key = client.api_key
    if isinstance(api_key, str) and api_key:
        return {"x-api-key": api_key}
    user_api_key = client.user_api_key
    if isinstance(user_api_key, str) and user_api_key:
        return {"x-user-api-key": user_api_key}
    return {}

```

### Core Architecture Module: `python/composio/core/models/connected_accounts.py`
```
from __future__ import annotations

import functools
import logging
import time
import typing as t
import warnings

import typing_extensions as te
from composio_client import BadRequestError, ConflictError, omit

from composio import exceptions
from composio.client import HttpClient
from composio.client.types import (
    connected_account_complete_auth_response,
    connected_account_create_params,
    connected_account_patch_params,
    connected_account_patch_response,
    connected_account_refresh_params,
    connected_account_refresh_response,
    connected_account_retrieve_response,
    connected_account_revoke_response,
    connected_account_update_status_response,
    link_create_params,
)

from .base import Resource
from .experimental import ACL_ONLY_FOR_SHARED_ERROR_FRAGMENT

logger = logging.getLogger(__name__)

# Mirrors TS `ConnectionRequest.ts:terminalErrorStates`. INACTIVE is excluded
# on purpose — it can recover to ACTIVE.
_TERMINAL_CONNECTION_STATES: t.FrozenSet[str] = frozenset(
    {"FAILED", "EXPIRED", "REVOKED"}
)

# One-time-per-process guard so long-running services don't spam the deprecation
# warning on every initiate() call.
_legacy_initiate_warning_emitted = False

_REFRESH_DEPRECATION = (
    "connected_accounts.refresh() is deprecated: the API marks "
    "POST /connected_accounts/{id}/refresh as deprecated. Re-initiate "
    "auth with connected_accounts.link() or toolkits.authorize() instead."
)

_REFRESH_VALIDATE_CREDENTIALS_IGNORED = (
    "connected_accounts.refresh(): the API no longer accepts "
    "validate_credentials; the argument is ignored."
)


class ConnectionRequest(Resource):
    """
    A connection request.

    This class is used to manage connection requests.
    """

    DEFAULT_WAIT_TIMEOUT = 60.0  # Seconds

    def __init__(
        self,
        id: str,
        status: str,
        redirect_url: t.Optional[str],
        client: HttpClient,
    ):
        """
        Initialize the connection request.

        :param id: The ID of the connection request.
        :param status: The status of the connection request.
        :param redirect_url: The redirect URL of the connection request.
        :param client: The client to use for the connection request.
        """
        super().__init__(client)
        self.id = id
        self.status = status
        self.redirect_url = redirect_url

    def wait_for_connection(
        self,
        timeout: t.Optional[float] = None,
    ) -> connected_account_retrieve_response.ConnectedAccountRetrieveResponse:
        """
        Wait for the connection to be established.

        :param timeout: The timeout to wait for the connection to be established.
        :return: Connected account object.
        """
        timeout = self.DEFAULT_WAIT_TIMEOUT if timeout is None else timeout
        deadline = time.time() + timeout
        while deadline > time.time():
            connection = self._client.connected_accounts.retrieve(nanoid=self.id)
            self.status = connection.status
            if self.status == "ACTIVE":
                return connection
            if self.status in _TERMINAL_CONNECTION_STATES:
                raise exceptions.SDKError(
                    message=(
                        f"Connection {self.id} entered terminal state "
                        f"{self.status!r} before becoming active"
                    ),
                )
            time.sleep(1)

        raise exceptions.ComposioSDKTimeoutError(
            message=f"Timeout while waiting for connection {self.id} to be active",
        )

    @classmethod
    def from_id(cls, id: str, client: HttpClient) -> te.Self:
        return cls(
            id=id,
            status=client.connected_accounts.retrieve(nanoid=id).status,
            redirect_url=None,
            client=client,
        )


class AuthScheme:
    """
    Collection of auth scheme helpers.
    """

    def oauth1(
        self, options: connected_account_create_params.ConnectionStateUnionMember0Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using OAuth 1.0.

        When both ``oauth_token`` and ``oauth_token_secret`` are provided,
        status defaults to ACTIVE (token import). When either is omitted,
        status defaults to INITIALIZING (redirect-based OAuth flow).
        Pass an explicit ``status`` in options to override.
        """
        has_tokens = bool(
            options.get("oauth_token")  # type: ignore[union-attr]
        ) and bool(
            options.get("oauth_token_secret")  # type: ignore[union-attr]
        )
        status = "ACTIVE" if has_tokens else "INITIALIZING"
        return {
            "auth_scheme": "OAUTH1",
            "val": t.cast(
                connected_account_create_params.ConnectionStateUnionMember0Val,
                {
                    "status": status,
                    **options,
                },
            ),
        }

    def oauth2(
        self, options: connected_account_create_params.ConnectionStateUnionMember1Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using OAuth 2.0.

        When ``access_token`` is provided, status defaults to ACTIVE
        (token import). When omitted, status defaults to INITIALIZING
        (redirect-based OAuth flow). Pass an explicit ``status`` in
        options to override.
        """
        has_token = bool(options.get("access_token"))  # type: ignore[union-attr]
        status = "ACTIVE" if has_token else "INITIALIZING"
        return {
            "auth_scheme": "OAUTH2",
            "val": t.cast(
                connected_account_create_params.ConnectionStateUnionMember1Val,
                {
                    "status": status,
                    **options,
                },
            ),
        }

    def composio_link(
        self, options: connected_account_create_params.ConnectionStateUnionMember2Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using Composio Link.
        """
        return t.cast(
            connected_account_create_params.ConnectionState,
            {
                "auth_scheme": "COMPOSIO_LINK",
                "val": t.cast(
                    connected_account_create_params.ConnectionStateUnionMember2Val,
                    {
                        "status": "INITIALIZING",
                        **options,
                    },
                ),
            },
        )

    def api_key(
        self, options: connected_account_create_params.ConnectionStateUnionMember3Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using an API key.
        """
        return t.cast(
            connected_account_create_params.ConnectionState,
            {
                "auth_scheme": "API_KEY",
                "val": t.cast(
                    connected_account_create_params.ConnectionStateUnionMember3Val,
                    {
                        "status": "ACTIVE",
                        **options,
                    },
                ),
            },
        )

    def basic(
        self, options: connected_account_create_params.ConnectionStateUnionMember4Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using basic auth.
        """
        return t.cast(
            connected_account_create_params.ConnectionState,
            {
                "auth_scheme": "BASIC",
                "val": t.cast(
                    connected_account_create_params.ConnectionStateUnionMember4Val,
                    {
                        "status": "ACTIVE",
                        **options,
                    },
                ),
            },
        )

    def bearer_token(
        self, options: connected_account_create_params.ConnectionStateUnionMember5Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using a bearer token.
        """
        return t.cast(
            connected_account_create_params.ConnectionState,
            {
                "auth_scheme": "BEARER_TOKEN",
                "val": t.cast(
                    connected_account_create_params.ConnectionStateUnionMember5Val,
                    {
                        "status": "ACTIVE",
                        **options,
                    },
                ),
            },
        )

    def google_service_account(
        self, options: connected_account_create_params.ConnectionStateUnionMember6Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using a Google service account.
        """
        return t.cast(
            connected_account_create_params.ConnectionState,
            {
                "auth_scheme": "GOOGLE_SERVICE_ACCOUNT",
                "val": t.cast(
                    connected_account_create_params.ConnectionStateUnionMember6Val,
                    {
                        "status": "ACTIVE",
                        **options,
                    },
                ),
            },
        )

    def no_auth(
        self, options: connected_account_create_params.ConnectionStateUnionMember7Val
    ) -> connected_account_create_params.ConnectionState:
        """
        Create a new connected account using no auth.
        """
        return {
            "auth_scheme": "NO_AUTH",
            "val": t.cast(
                connected_account_create_params.ConnectionStateUnionMember7Val,
                {
                    "status": "ACTIVE",
                    **options,
                },
            ),
        }

    def calcom_auth(
        self, options: connected_account_create_params.ConnectionStateUnionMember8Val
    ) -> connected_account_create_params.Connecti
```

### Core Architecture Module: `python/composio/core/models/custom_tool.py`
```
"""Custom tools and toolkits for tool router sessions.

Decorator API for defining custom tools that run in-process alongside
remote Composio tools. Accessed via ``composio.experimental``.

Usage::

    from pydantic import BaseModel, Field
    from composio import Composio

    composio = Composio()

    class GrepInput(BaseModel):
        pattern: str = Field(description="Pattern to search for")

    @composio.experimental.tool()
    def grep(input: GrepInput, ctx):
        \"\"\"Search for a pattern in local files.\"\"\"
        return {"matches": []}

    dev_tools = composio.experimental.Toolkit(
        slug="DEV_TOOLS",
        name="Dev Tools",
        description="Local dev utilities",
    )

    @dev_tools.tool()
    def search_code(input: GrepInput, ctx):
        \"\"\"Search developer resources.\"\"\"
        return {"results": []}

    session = composio.create(
        user_id="default",
        experimental={
            "custom_tools": [grep],
            "custom_toolkits": [dev_tools],
        },
    )
"""

from __future__ import annotations

import asyncio
import inspect
import typing as t

from pydantic import BaseModel

from composio.exceptions import ValidationError

from .custom_tool_types import (
    LOCAL_TOOL_PREFIX,
    MAX_SLUG_LENGTH,
    SLUG_REGEX,
    CustomTool,
    CustomToolExecuteFn,
    CustomToolkitWireDefinition,
    CustomToolsMap,
    CustomToolsMapEntry,
    CustomToolWireDefinition,
)
from .tool_router_constants import PRELOAD_TOOLS_ALL

if t.TYPE_CHECKING:
    from composio_client.types.tool_router.session_attach_response import (
        Experimental as SessionAttachResponseExperimental,
    )
    from composio_client.types.tool_router.session_create_response import (
        Experimental as SessionCreateResponseExperimental,
    )
    from composio_client.types.tool_router.session_retrieve_response import (
        Experimental as SessionRetrieveResponseExperimental,
    )


# ────────────────────────────────────────────────────────────────
# Slug validation helpers
# ────────────────────────────────────────────────────────────────


def _validate_slug(slug: str, context: str) -> str:
    """Validate a custom tool or toolkit slug."""
    if not slug:
        raise ValidationError(f"{context}: slug is required")

    if not SLUG_REGEX.match(slug):
        raise ValidationError(
            f"{context}: slug must only contain alphanumeric characters, "
            f"underscores, and hyphens"
        )

    upper = slug.upper()
    if upper.startswith("LOCAL_"):
        raise ValidationError(
            f'{context}: slug must not start with "LOCAL_" — '
            f"this prefix is reserved for internal routing."
        )
    if upper.startswith("COMPOSIO_"):
        raise ValidationError(
            f'{context}: slug must not start with "COMPOSIO_" — '
            f"this prefix is reserved for Composio meta tools."
        )

    return slug


def _compute_final_slug_length(tool_slug: str, toolkit_slug: t.Optional[str]) -> int:
    """Compute the final slug length: LOCAL_[TOOLKIT_]SLUG."""
    length = len(LOCAL_TOOL_PREFIX) + len(tool_slug)
    if toolkit_slug:
        length += len(toolkit_slug) + 1  # +1 for underscore separator
    return length


def _validate_slug_length(
    tool_slug: str, toolkit_slug: t.Optional[str], context: str
) -> None:
    """Validate that the final slug won't exceed the max length."""
    final_length = _compute_final_slug_length(tool_slug, toolkit_slug)
    if final_length > MAX_SLUG_LENGTH:
        prefix = LOCAL_TOOL_PREFIX + (
            f"{toolkit_slug.upper()}_" if toolkit_slug else ""
        )
        available = MAX_SLUG_LENGTH - len(prefix)
        raise ValidationError(
            f'{context}: slug "{tool_slug}" is too long. '
            f'With prefix "{prefix}", the final slug would be {final_length} '
            f"characters (max {MAX_SLUG_LENGTH}). "
            f"Shorten the slug to at most {available} characters."
        )


def _build_final_slug(tool_slug: str, toolkit_slug: t.Optional[str] = None) -> str:
    """Build the final slug: LOCAL_[TOOLKIT_]SLUG."""
    upper = tool_slug.upper()
    if toolkit_slug:
        return f"{LOCAL_TOOL_PREFIX}{toolkit_slug.upper()}_{upper}"
    return f"{LOCAL_TOOL_PREFIX}{upper}"


def _qualified_original_slug_key(toolkit: t.Optional[str], original_slug: str) -> str:
    return f"{toolkit.upper() if toolkit else ''}::{original_slug.upper()}"


def _can_share_original_slug(
    existing: CustomToolsMapEntry, next_entry: CustomToolsMapEntry
) -> bool:
    return (
        existing.toolkit is not None
        and next_entry.toolkit is not None
        and existing.toolkit.lower() != next_entry.toolkit.lower()
    )


def _add_original_slug_alias(
    *,
    by_original_slug: t.Dict[str, CustomToolsMapEntry],
    ambiguous_original_slugs: t.Set[str],
    original_slug: str,
    entry: CustomToolsMapEntry,
) -> None:
    original_slug_key = original_slug.upper()
    if original_slug_key in ambiguous_original_slugs:
        return

    existing = by_original_slug.get(original_slug_key)
    if existing is None:
        by_original_slug[original_slug_key] = entry
        return

    if existing.final_slug.upper() == entry.final_slug.upper():
        return

    if _can_share_original_slug(existing, entry):
        del by_original_slug[original_slug_key]
        ambiguous_original_slugs.add(original_slug_key)
        return

    raise ValidationError(
        f'Custom tool slug collision: original slug "{original_slug}" '
        f'maps to multiple final slugs. "{existing.final_slug}" and '
        f'"{entry.final_slug}" both resolve from "{original_slug_key}".'
    )


def _get_input_json_schema(model: t.Type[BaseModel]) -> t.Dict[str, t.Any]:
    """Convert a Pydantic model class to a JSON Schema dict suitable for the backend."""
    full_schema = model.model_json_schema()
    schema: t.Dict[str, t.Any] = {"type": "object"}
    if "properties" in full_schema:
        schema["properties"] = full_schema["properties"]
    if "required" in full_schema:
        schema["required"] = full_schema["required"]
    if "$defs" in full_schema:
        schema["$defs"] = full_schema["$defs"]
    return schema


# ────────────────────────────────────────────────────────────────
# Internal tool creation (used by decorator API)
# ────────────────────────────────────────────────────────────────


def _create_tool(
    slug: str,
    *,
    name: str,
    description: str,
    input_params: t.Type[BaseModel],
    execute: CustomToolExecuteFn,
    extends_toolkit: t.Optional[str] = None,
    output_params: t.Optional[t.Type[BaseModel]] = None,
    preload: t.Optional[bool] = None,
) -> CustomTool:
    """Internal: create and validate a CustomTool."""
    context = "experimental.tool"

    _validate_slug(slug, context)

    if not name:
        raise ValidationError(f"{context}: name is required")
    if not description:
        raise ValidationError(f"{context}: description is required")

    if not isinstance(input_params, type) or not issubclass(input_params, BaseModel):
        raise ValidationError(
            f"{context}: input_params must be a Pydantic BaseModel subclass. "
            f"Tool input parameters are always an object with named properties."
        )

    try:
        from pydantic import RootModel

        if issubclass(input_params, RootModel):
            raise ValidationError(
                f"{context}: input_params must be a regular BaseModel with named fields, "
                f"not a RootModel. Tool input parameters are always an object with "
                f"named properties."
            )
    except ImportError:
        pass

    if not callable(execute):
        raise ValidationError(f"{context}: execute must be a callable")

    if asyncio.iscoroutinefunction(execute):
        raise ValidationError(
            f"{context}: execute must be a synchronous function, not async. "
            f"The Composio Python SDK is synchronous — use a regular "
            f"'def fn(input, ctx)' instead of 'async def'."
        )

    _validate_slug_length(slug, extends_toolkit, context)

    input_schema = _get_input_json_schema(input_params)

    output_schema: t.Optional[t.Dict[str, t.Any]] = None
    if output_params is not None:
        if not isinstance(output_params, type) or not issubclass(
            output_params, BaseModel
        ):
            raise ValidationError(
                f"{context}: output_params must be a Pydantic BaseModel subclass"
            )
        output_schema = output_params.model_json_schema()

    return CustomTool(
        slug=slug,
        name=name,
        description=description,
        extends_toolkit=extends_toolkit,
        input_schema=input_schema,
        output_schema=output_schema,
        input_params=input_params,
        execute=execute,
        preload=preload,
    )


def _get_caller_locals(depth: int = 2) -> t.Optional[t.Mapping[str, t.Any]]:
    """Best-effort lookup of a caller frame's locals."""
    frame = inspect.currentframe()
    try:
        caller = frame
        for _ in range(depth):
            caller = caller.f_back if caller is not None else None
        return caller.f_locals if caller is not None else None
    finally:
        del frame


def _resolve_function_annotations(
    fn: t.Callable[..., t.Any],
    *,
    localns: t.Optional[t.Mapping[str, t.Any]] = None,
) -> t.Dict[str, t.Any]:
    """Resolve annotations, including postponed string annotations when possible."""
    try:
        return t.get_type_hints(
            fn,
            globalns=getattr(fn, "__globals__", {}),
            localns=dict(localns) if localns is not None else None,
            include_extras=True,
        )
    except Exception:
        return {}


def _infer_tool_from_function(
    fn: t.Callable[..., t.Any],
    *,
    slug: t.Optional[str] = None,
    name: t.Optional[str] = None,
    description: t.Optional[str] = No
```

### Core Architecture Module: `python/composio/core/models/custom_tool_execution.py`
```
"""Standalone functions for custom tool lookup and execution.

Extracted for reuse in SessionContextImpl (sibling routing).

Security invariant (CWE-639 / SEC-365): on this code path the trusted
``user_id`` arrives via ``SessionContext`` — never via ``arguments``. The
``arguments`` dict is LLM-supplied and is validated through the tool's
Pydantic ``input_params`` model, which discards unknown fields, so an
attempt to smuggle ``user_id`` (or any other identity-bearing key) inside
``arguments`` cannot reach the tool's execute function or auth lookup.
Keep this property when modifying ``execute_custom_tool``.
"""

from __future__ import annotations

import typing as t

from pydantic import ValidationError as PydanticValidationError

from composio.exceptions import ValidationError

from .custom_tool_types import (
    CustomToolsMap,
    CustomToolsMapEntry,
    SessionContext,
)
from .tools import ToolExecutionResponse


def find_custom_tool(
    map_: t.Optional[CustomToolsMap],
    slug: str,
) -> t.Optional[CustomToolsMapEntry]:
    """Find a custom tool entry by slug.

    Checks both the final slug map (LOCAL_X — agent/LLM path)
    and original slug map (X — programmatic path). Case-insensitive.
    """
    if map_ is None:
        return None
    upper = slug.upper()
    final_slug_match = map_.by_final_slug.get(upper)
    if final_slug_match is not None:
        return final_slug_match
    if upper in map_.ambiguous_original_slugs:
        return None
    return map_.by_original_slug.get(upper)


def assert_unambiguous_custom_tool_slug(
    map_: t.Optional[CustomToolsMap], slug: str
) -> None:
    """Reject ambiguous bare original slugs before remote fallback."""
    if map_ is None:
        return

    upper = slug.upper()
    if upper not in map_.ambiguous_original_slugs:
        return

    final_slugs = sorted(
        entry.final_slug
        for entry in map_.by_final_slug.values()
        if entry.handle.slug.upper() == upper
    )
    hint = f" Use one of: {', '.join(final_slugs)}." if final_slugs else ""
    raise ValidationError(
        f'Ambiguous custom tool slug "{slug}". Multiple custom toolkit tools '
        "share this original slug; manual session.execute() by original slug "
        "is only supported when the original slug is unique."
        f"{hint}"
    )


def execute_custom_tool(
    entry: CustomToolsMapEntry,
    arguments: t.Dict[str, t.Any],
    session_context: SessionContext,
) -> ToolExecutionResponse:
    """Execute a custom tool in-process.

    Validates input via the Pydantic model, calls the user's execute function,
    and wraps the result into the standard response format.
    """
    handle = entry.handle

    # Validate and transform input using the Pydantic model.
    # This applies defaults, coercions, and validators.
    try:
        validated = handle.input_params.model_validate(arguments)
    except PydanticValidationError as e:
        return {
            "data": {},
            "error": f"Input validation failed: {e}",
            "successful": False,
        }

    try:
        # User's execute returns data directly — we wrap into {data, error, successful}
        data = handle.execute(validated, session_context)
        return {
            "data": data if data is not None else {},
            "error": None,
            "successful": True,
        }
    except Exception as e:
        return {
            "data": {},
            "error": str(e),
            "successful": False,
        }

```

### Core Architecture Module: `python/composio/core/models/custom_tool_types.py`
```
"""Type definitions for custom tools in tool router sessions.

Mirrors the TypeScript types in ts/packages/core/src/types/customTool.types.ts
"""

from __future__ import annotations

import typing as t
from dataclasses import dataclass, field

import typing_extensions as te
from composio_client.types.tool_router import session_create_params
from pydantic import BaseModel

from composio_client.types.tool_router.session_execute_response import (
    SessionExecuteResponse,
)

from composio.utils.safe_path import SAFE_COMPONENT_REGEX

# ────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────

LOCAL_TOOL_PREFIX = "LOCAL_"
MAX_SLUG_LENGTH = 60


class ProxyExecuteBinaryData(te.TypedDict):
    """Binary payload metadata, present when the proxied API returned a file."""

    content_type: str
    size: int
    url: str
    expires_at: t.Optional[str]


class ToolRouterSessionProxyExecuteResponse(te.TypedDict):
    """SDK-facing shape returned by ``proxy_execute()``.

    Field-for-field equivalent to the TypeScript SDK's
    ``ToolRouterSessionProxyExecuteResponse``, spelled in snake_case: the same
    fields carry the same meaning in both SDKs, each in its own language's
    convention. The generated client's model is deliberately not exposed --
    it is regenerated from the upstream spec, so returning it directly would
    let a regeneration reshape a public SDK return type.

    ``status`` and ``size`` are narrowed to ``int``. The generated model types
    both as ``float`` and pydantic coerces, so a response read straight off it
    renders ``200.0`` where TypeScript renders ``200``.
    """

    status: int
    data: t.Any
    headers: t.Optional[t.Dict[str, str]]
    binary_data: te.NotRequired[ProxyExecuteBinaryData]


SLUG_REGEX = SAFE_COMPONENT_REGEX
"""Alias of the canonical pattern in :mod:`composio.utils.safe_path`.

One definition, not two kept in sync by hand: this pattern is what makes a slug
safe to use as a filesystem path component, so client-created custom tools and
backend-fetched tools must be held to exactly the same rule. Keeping two copies
in sync by hand is how they drift apart.
"""

# ────────────────────────────────────────────────────────────────
# Execute function type
# ────────────────────────────────────────────────────────────────

CustomToolExecuteFn = t.Callable[
    [t.Any, "SessionContext"],
    t.Dict[str, t.Any],
]
"""
Execute function for custom tools.

Signature: (input: BaseModel, ctx: SessionContext) -> dict

Just return the result data, or raise an error. The SDK wraps it internally
into {data, error, successful}.
"""

# ────────────────────────────────────────────────────────────────
# SessionContext protocol
# ────────────────────────────────────────────────────────────────


class SessionContext(te.Protocol):
    """Session context injected into custom tool execute functions at runtime.

    Provides identity context and methods to call other tools or proxy API requests.
    """

    @property
    def user_id(self) -> str: ...

    def execute(
        self,
        tool_slug: str,
        arguments: t.Dict[str, t.Any],
    ) -> SessionExecuteResponse:
        """Execute any Composio tool from within a custom tool.

        Returns the same response model as ``session.execute()``.
        """
        ...

    def proxy_execute(
        self,
        *,
        toolkit: str,
        endpoint: str,
        method: t.Literal["GET", "POST", "PUT", "DELETE", "PATCH"],
        body: t.Any = None,
        parameters: t.Optional[t.List[t.Dict[str, t.Any]]] = None,
    ) -> ToolRouterSessionProxyExecuteResponse:
        """Proxy API calls through Composio's auth layer.

        Returns the same response shape as ``session.proxy_execute()``.
        """
        ...


# ────────────────────────────────────────────────────────────────
# Custom tool / toolkit definitions (returned by factory functions)
# ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CustomTool:
    """Custom tool definition returned from ``@composio.experimental.tool()``.

    Pass to ``composio.create(user_id, experimental={"custom_tools": [...]})``
    to bind to a session.
    """

    slug: str
    name: str
    description: str
    input_schema: t.Dict[str, t.Any]
    input_params: t.Type[BaseModel]
    execute: CustomToolExecuteFn
    extends_toolkit: t.Optional[str] = None
    output_schema: t.Optional[t.Dict[str, t.Any]] = None
    preload: t.Optional[bool] = None


CustomToolWireDefinition = session_create_params.ExperimentalCustomTool
CustomToolkitWireDefinition = session_create_params.ExperimentalCustomToolkit


class InlineCustomToolsWirePayload(te.TypedDict, total=False):
    custom_tools: t.List[CustomToolWireDefinition]
    custom_toolkits: t.List[CustomToolkitWireDefinition]


# ────────────────────────────────────────────────────────────────
# Internal routing map types
# ────────────────────────────────────────────────────────────────


@dataclass
class CustomToolsMapEntry:
    """Entry in the per-session custom tools routing map."""

    handle: CustomTool
    final_slug: str
    toolkit: t.Optional[str] = None


@dataclass
class CustomToolsMap:
    """Lookup maps used by ToolRouterSession for routing custom tools."""

    by_final_slug: t.Dict[str, CustomToolsMapEntry] = field(default_factory=dict)
    # Bare original slugs are only stored here when they resolve uniquely.
    by_original_slug: t.Dict[str, CustomToolsMapEntry] = field(default_factory=dict)
    toolkits: t.Optional[t.List[t.Any]] = None
    tools: t.Optional[t.List["CustomTool"]] = None
    # Toolkit-qualified lookup allows different custom toolkits to reuse a child slug.
    by_toolkit_and_original_slug: t.Dict[str, CustomToolsMapEntry] = field(
        default_factory=dict
    )
    # Bare original slugs in this set must be addressed by their final slug.
    ambiguous_original_slugs: t.Set[str] = field(default_factory=set)


# ────────────────────────────────────────────────────────────────
# Registered types (returned by session.custom_tools() / .custom_toolkits())
# ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class RegisteredCustomTool:
    """A custom tool as registered in a session, with its final resolved slug."""

    slug: str
    name: str
    description: str
    input_schema: t.Dict[str, t.Any]
    toolkit: t.Optional[str] = None
    output_schema: t.Optional[t.Dict[str, t.Any]] = None


@dataclass(frozen=True)
class RegisteredCustomToolkit:
    """A custom toolkit as registered in a session, with final slugs on nested tools."""

    slug: str
    name: str
    description: str
    tools: t.List[RegisteredCustomTool]

```

### Core Architecture Module: `python/composio/core/models/experimental.py`
```
"""The ``composio.experimental`` namespace.

Houses experimental SDK surfaces whose shape may change in future
releases. Two flavours live here today:

- Decorators for in-process custom tools and toolkits
  (``composio.experimental.tool`` / ``composio.experimental.Toolkit``).
  Implementation details for these still live in :mod:`custom_tool`;
  this module just exposes them on the namespace.
- Experimental SDK methods that take a Composio client
  (``composio.experimental.update_acl``).

Anything new on the ``composio.experimental`` namespace should land here,
not on the underlying model modules.
"""

from __future__ import annotations

import typing as t

import typing_extensions as te
from pydantic import BaseModel

from composio.client import HttpClient
from composio.utils.pydantic import none_to_omit
from composio.client.types import (
    connected_account_patch_response,
    custom_delete_toolkit_response,
    custom_sync_response,
    custom_upsert_params,
    custom_upsert_response,
    usage_retrieve_params,
    usage_retrieve_response,
    usage_retrieve_summary_params,
    usage_retrieve_summary_response,
)

from .custom_tool import (
    CustomTool,
    ExperimentalToolkit,
    _get_caller_locals,
    _infer_tool_from_function,
)

# Server-side 400 message the API uses to reject ACL writes against a
# PRIVATE connection. Substring-matched in `update_acl` here and in the
# sibling `link()` / `authorize()` call sites — kept as a single constant
# so a server-side message tweak only requires one edit.
ACL_ONLY_FOR_SHARED_ERROR_FRAGMENT = "acl_config_for_shared is only valid on SHARED"


class UsageSummaryResponse(
    usage_retrieve_summary_response.UsageRetrieveSummaryResponse
):
    """Project usage summary with the exact USD Instant charge for the window."""

    instant_charge: str


class ExperimentalUsage:
    """Project usage metering, accessed via ``composio.experimental.usage``.

    Experimental — the response shape may change in future releases. Scoped
    to the project the API key belongs to.
    """

    def __init__(self, client: t.Optional[HttpClient] = None) -> None:
        self._client = client

    def _require_client(self) -> HttpClient:
        from composio import exceptions

        if self._client is None:
            raise exceptions.ValidationError(
                "experimental.usage requires a Composio client. Access it via "
                "composio.experimental.usage.summary(...)."
            )
        return self._client

    def summary(
        self,
        **params: te.Unpack[usage_retrieve_summary_params.UsageRetrieveSummaryParams],
    ) -> UsageSummaryResponse:
        """
        Fetch a usage summary for the project. Experimental — shape may change.

        :param from_: Start of the window (Unix epoch milliseconds).
        :param to: End of the window (Unix epoch milliseconds).
        :param entity_types: Restrict the summary to these entity types.
        :param filters: Additional server-side filters.
        :return: Usage totals under ``.entities`` and the exact USD amount in
            ``.instant_charge`` (``"0"`` when nothing was charged).

        Example:
            summary = composio.experimental.usage.summary(
                entity_types=["tool_calls"],
            )
        """
        response = self._require_client().project.usage.retrieve_summary(**params)
        # The pinned generated client retains new response fields as Pydantic extras.
        return UsageSummaryResponse.model_validate(response.model_dump())

    def breakdown(
        self,
        entity_type: str,
        **params: te.Unpack[usage_retrieve_params.UsageRetrieveParams],
    ) -> usage_retrieve_response.UsageRetrieveResponse:
        """
        Fetch a grouped usage breakdown for one entity type. Experimental —
        shape may change.

        :param entity_type: The metered entity type, e.g. ``tool_calls`` or ``sessions``.
        :param from_: Start of the window (Unix epoch milliseconds).
        :param to: End of the window (Unix epoch milliseconds).
        :param group_by: Field to group the breakdown by (API default: ``tool_slug``
            for ``tool_calls``, ``user_id`` for ``sessions``).
        :param order_by: Sort key (``key``, ``total_quantity`` or ``event_count``).
        :param order_direction: ``asc`` or ``desc``.
        :param limit: Maximum number of groups to return.
        :param filters: Additional server-side filters.
        :return: The usage totals and per-group breakdown.

        Example:
            breakdown = composio.experimental.usage.breakdown(
                "tool_calls",
                group_by="tool_slug",
            )
        """
        return self._require_client().project.usage.retrieve(entity_type, **params)


class ExperimentalCustomToolkits:
    """Project-owned custom toolkits, accessed via
    ``composio.experimental.custom_toolkits``.

    Experimental — custom toolkits are in pilot and the shape may change.
    These toolkits are registered in your Composio project from your own app
    or MCP server, with their own auth configs and connected accounts. They
    are unrelated to the in-process toolkits built with
    ``composio.experimental.Toolkit``.
    """

    def __init__(self, client: t.Optional[HttpClient] = None) -> None:
        self._client = client

    def _require_client(self) -> HttpClient:
        from composio import exceptions

        if self._client is None:
            raise exceptions.ValidationError(
                "experimental.custom_toolkits requires a Composio client. Access "
                "it via composio.experimental.custom_toolkits.upsert(...)."
            )
        return self._client

    def upsert(
        self,
        **params: te.Unpack[custom_upsert_params.CustomUpsertParams],
    ) -> custom_upsert_response.CustomUpsertResponse:
        """
        Create a custom toolkit, or update its display metadata (name, API key
        field copy) when the project already owns one with this slug.
        Experimental — shape may change.

        ``app_url`` and ``auth_schemes`` cannot change on an existing
        toolkit: re-sending them unchanged is a no-op, and changing them fails
        with a 409. Delete and re-register the toolkit instead, which revokes
        its connections.

        :param slug: Letters, digits, underscores or spaces (max 30). The API
            prefixes it with ``CUSTOM_`` and turns spaces into underscores.
        :param toolkit_config: ``name``, ``app_url`` (the MCP URL for MCP
            apps), ``auth_schemes`` and an optional base64 ``logo_file``.
        :return: The toolkit's ``slug``.

        Example:
            composio.experimental.custom_toolkits.upsert(
                slug="INTERNAL_API",
                toolkit_config={
                    "name": "Internal API",
                    "app_url": "https://mcp.internal.example.com/mcp",
                    "auth_schemes": [
                        {
                            "mode": "API_KEY",
                            "headers": {"Authorization": "Bearer {{generic_api_key}}"},
                        }
                    ],
                },
            )
        """
        return self._require_client().custom.upsert(**params)

    def sync(
        self, slug: str, *, connected_account_id: t.Optional[str] = None
    ) -> custom_sync_response.CustomSyncResponse:
        """
        Re-fetch a custom toolkit's tool definitions from its remote MCP
        server. Call it when automatic sync fails or the remote tools change.
        Experimental — shape may change.

        :param slug: The custom toolkit slug (``CUSTOM_...``).
        :param connected_account_id: Connected account to use when fetching
            the remote tool definitions.
        :return: The toolkit ``version`` and ``synced_count``.

        Example:
            result = composio.experimental.custom_toolkits.sync("CUSTOM_MY_TOOLKIT")
            print(result.synced_count)
        """
        return self._require_client().custom.sync(
            slug=slug, connected_account_id=none_to_omit(connected_account_id)
        )

    def delete(
        self, slug: str
    ) -> custom_delete_toolkit_response.CustomDeleteToolkitResponse:
        """
        Delete a custom toolkit owned by the project, with its tools, auth
        configs and connected accounts. The credentials behind those
        connected accounts are revoked in background jobs
        (``revoke_job_ids``). Composio-managed toolkits cannot be deleted
        (API 403). Experimental — shape may change.

        :param slug: The custom toolkit slug (``CUSTOM_...``).
        :return: What was deleted.

        Example:
            composio.experimental.custom_toolkits.delete("CUSTOM_MY_TOOLKIT")
        """
        return self._require_client().custom.delete_toolkit(slug)


class ExperimentalAPI:
    """Experimental APIs accessed via ``composio.experimental``.

    Provides decorators for creating custom tools and toolkits that run
    in-process alongside remote Composio tools, plus experimental SDK
    methods whose shape may change in future releases.
    """

    Toolkit = ExperimentalToolkit

    usage: ExperimentalUsage
    """Project usage metering. Experimental — shape may change."""

    custom_toolkits: ExperimentalCustomToolkits
    """Project-owned custom toolkits. Experimental — shape may change."""

    def __init__(self, client: t.Optional[HttpClient] = None) -> None:
        self._client = client
        self.usage = ExperimentalUsage(client=client)
        self.custom_toolkits = ExperimentalCustomToolkits(client=client)

    def update_acl(
        self,
        nanoid: str,
        *,
        allow_all_users: t.Optional[bool] = None,
        allowed_user_ids: t.Optional[t.List[str]] = None,
        not_allowed_user_ids: t.Optional[t.List[str]] = None,
    ) -> connected_account_patch_response.ConnectedAccountPatchResponse:
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4703** (2026-10-01): **[Bug]: Quickstart fails hydration: intro block renders nested <p>**
  *Symptoms*: ### Area  Documentation site (`docs/`)  ### Describe the Bug  The intro block on [/docs/quickstart](https://docs.composio.dev/docs/quickstart) renders a `<p>` inside a `<p>`:  ```html <p class="mb-6"><p>Pick your framework below. A Composio session gives your agent…</p></p> ```  In `docs/content/docs/quickstart.mdx`, the intro text sits on its own lines inside `<p className="mb-6">`. MDX parses those lines as a Markdown paragraph and wraps them in a second `<p>`. Browsers don't allow a `<p>` inside a `<p>`, so they split the server HTML apart. React sees a mismatch, throws away the server HTML, and rebuilds the page on the client on every visit. It's live on docs.composio.dev, on the most important onboarding page.  Expected: the page hydrates without errors.  ### Steps to Reproduce  1. `cd docs && bun run dev` 2. Open `http://localhost:3000/docs/quickstart`. 3. Check the browser console.  ### Error Output  ```shell In HTML, <p> cannot be a descendant of <p>. This will cause a hydration error.   <div className="not-prose ...">     <div> >     <p className="mb-6"> >       <p>  Uncaught Error: Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. ```  ### Reproducibility  Always reproducible.  ### Proposed Fix  Change the wrapper to `<div className="mb-6">`, which renders `<div class="mb-6"><p>…</p></div>` with the same spacing. Add a content test that fails when an MDX page has a `<p>` tag alone on a

- **Issue #4663** (2026-09-28): **[Bug]: ConnectionRequest.status stays INITIATED after waitForConnection() resolves (TS SDK)**
  *Symptoms*: ### SDK Language  TypeScript / Node.js SDK (`@composio/core`)  ### SDK Version  @composio/core@0.21.0 (`next` @ 34484551843e575e79cca244d9fca3e4459f59e9)  ### Runtime Environment  Node.js 20 on macOS (also reproduced in the core package's vitest suite)  ### Environment  Local Development  ### Describe the Bug  After `waitForConnection()` resolves, the `ConnectionRequest` object still reports `status: 'INITIATED'`, while its own `toJSON().status` reports `'ACTIVE'`. A failed wait (`REVOKED`, `FAILED`, `EXPIRED`) also leaves `request.status` at `INITIATED`.  Expected: `request.status` reflects the status that `waitForConnection()` observed, as `toJSON()` already does (and as the Python SDK's `ConnectionRequest.wait_for_connection()` does by updating `self.status`).  This affects every `ConnectionRequest` the SDK returns: `connectedAccounts.initiate()`, `connectedAccounts.link()`, `toolkits.authorize()` and `session.authorize()`.  **Root cause:** `createConnectionRequest()` in `ts/packages/core/src/models/ConnectionRequest.ts:144-145` returns `{ ...state, waitForConnection, toJSON, toString }`. The spread copies `status` once, when the request is created. `waitForConnection()` then writes the new status to the internal `state` (`ConnectionRequest.ts:102` and `:128`), which `toJSON()` (`:147`) reads but the returned object never sees. This dates from #1678 (2025-06-23), which turned the `ConnectionRequest` class (which set `this.status`) into this factory function.  ### Steps to 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed report and for tracking the root cause back to #1678. The repro and failing tests made this quick to confirm.  Fixed in https://github.com/ComposioHQ/composio/pull/4678, which is now merged into `next` and will ship in the next `@composio/core` patch release. Instead of getters, it returns the same object that `waitForConnection()` updates, so `id`, `status` and `redirectUrl` stay assignable, as the `ConnectionRequest` type allows. The PR also restores telemetry for `waitForConnection()`, which the same refactor had broken.

- **Issue #4537** (2026-09-21): **[Bug]: Python SDK HTTP failures aren't catchable as `ComposioError`, unlike the TypeScript SDK**
  *Symptoms*: ### SDK Language  Python SDK (`composio` package)  ### SDK Version  composio==0.21.1 (composio-client==1.43.0)  ### Runtime Environment  Python 3.12.5, macOS 26.5  ### Environment  Local Development  ### Describe the Bug  In the Python SDK, HTTP failures such as an invalid API key surface as raw `composio_client` exceptions. Their base, `composio_client.ComposioError`, is unrelated to `composio.exceptions.ComposioError` (whose docstring calls it the "Base composio SDK error"), so `except ComposioError:` doesn't catch them.  This looks at least partly deliberate: `Tools.get_raw_composio_tool_by_slug` documents that client errors such as an invalid API key are "re-raised unchanged". The TypeScript SDK now behaves differently, though. Since #4459, a failed tool fetch such as a 401 raises `ComposioToolFetchError`, which extends `ComposioError`, so the same failure is catchable through the base error class in TypeScript but not in Python. `Composio.create()` raises the raw client error in Python as well.  I noticed this while writing error handling for an integration with a CLI tool. Catching `ComposioError` covered SDK errors such as connection timeouts, but checking the failure paths showed that an invalid API key raises `composio_client.AuthenticationError`, which that handler never sees.  Is the Python behaviour meant to stay as it is? If so, documenting that callers should also catch `composio_client.APIError` would help. If not, I'm happy to send a PR bringing Python in line
  **Post-Mortem & Fix Analysis**:
  > I would make `ComposioError` the public contract and translate generated-client HTTP failures at the SDK boundary.  A separate exported `APIError` leaves callers with two exception roots and bakes the generated client into the public API. Instead, a narrow SDK exception such as `ComposioAPIError(ComposioError)` can retain the actionable fields (`status_code`, response/request ID, and message) and use `raise ... from exc` so the original `composio_client.APIError` remains available as `__cause__` for compatibility and debugging.  The important constraint is to catch only the generated client's HTTP exception at those boundary methods, not broad `Exception`, so validation and user-code failures keep their existing types. I would start with the public methods that directly expose generated-client calls and add contract tests for both `except ComposioError` and preservation of the original cause. That matches the TypeScript SDK's single public exception family without hiding the lower-leve
  > @jkomyno happy to put up a PR for this if it's useful. I'd follow the #4459 approach: wrap `composio_client.APIError` at the Python SDK boundary in a `ComposioError` subclass that keeps the status code and chains the original with `raise ... from exc`. I'd start with `Composio.create()` and the session methods, plus tests for `except ComposioError` and for preserving the original cause. Or I'll leave it with you if you've already started. 
  > The reporter's proposed boundary wrapper and tests are concrete, and the issue is now assigned to @jkomyno. I will stay out of this lane unless the maintainer explicitly asks for a separate reproduction or review; no overlapping PR from me.

- **Issue #4499** (2026-09-23): **CLI 0.4.1: custom_grain --account resolves toolkit as custom; inconsistent discovery and approval settings UX**
  *Symptoms*: ## Environment - Composio CLI 0.4.1 on macOS, used from Codex - `composio upgrade` reports this is the latest version (September 15, 2026) - An existing connected custom Grain toolkit: `custom_grain`  ## Account selection bug `composio search 'Grain meeting transcripts'` correctly discovers CUSTOM_GRAIN_* tools and reports custom_grain connected. Executing those tools without --account succeeds.  However, selecting the existing connected account explicitly fails:  ```sh composio execute CUSTOM_GRAIN_SEARCH_PERSONS --account <existing-grain-account-id> -d '{"search_string":"example"}' ```  Observed error (account ID redacted):  ```text services/ConnectedAccountResolutionError No connected account matched "<existing-grain-account-id>" for toolkit "custom". No active connected accounts were found for that toolkit. ```  `composio link custom_grain` confirms the account already exists. The error suggests toolkit resolution treats CUSTOM as the toolkit instead of custom_grain; this is an inference from the error, not a source-confirmed diagnosis.  ## Discovery inconsistency `composio tools list custom_grain` reports no tools found, while search discovers tools and execute successfully runs them. A cached CUSTOM_GRAIN_LIST_MEETINGS schema also proved usable despite not appearing in the initial semantic search results.  ## Persistent approval UX request Grain reads repeatedly required interactive approval. Session approvals work, but no documented persistent per-toolkit "always allow

- **Issue #4453** (2026-09-24): **RemoteFile.save() (TS) crashes with unhandled EISDIR on malformed mountRelativePath; Python's SEC-316 fix never ported**
  *Symptoms*: ### Bug Description  `RemoteFile.save()` in the TypeScript SDK (`ts/packages/core/src/models/RemoteFile.ts`, lines 167-194) is missing a path-validation fix that the Python SDK already has (tracked there as `SEC-316`), so a malformed `mount_relative_path` value from the API response crashes the save with an unhandled `EISDIR` instead of a clean error.  ```ts get filename(): string {   return platform.basename(this.mountRelativePath); }  async save(path?: string): Promise<string> {   ...   const savePath =     path ?? platform.joinPath(homeDir, COMPOSIO_DIR, TEMP_FILES_DIRECTORY_NAME, this.filename);   const dir =     path != null ? getParentDir(savePath) : platform.joinPath(homeDir, COMPOSIO_DIR, TEMP_FILES_DIRECTORY_NAME);   if (dir && !platform.existsSync(dir)) {     platform.mkdirSync(dir);   }   platform.writeFileSync(savePath, content);   return savePath; } ```  `platform.basename` is a bare `path.basename(filePath)` with no validation, and `mount_relative_path` (`ts/packages/core/src/types/ToolRouterSessionFilesMount.types.ts`) is declared as a plain `z.string()` with no non-empty constraint - a direct passthrough of an untrusted API response field.  The Python SDK's `RemoteFile.save()` (`python/composio/core/models/tool_router_session_files.py`) calls `secure_basename_join()`, whose `safe_basename()` helper (`python/composio/utils/safe_path.py`) explicitly documents and rejects this exact case:  > "Names that leave no usable basename are refused rather than replaced wi
  **Post-Mortem & Fix Analysis**:
  > curl -fsSL https://composio.dev/install | sh

- **Issue #4445** (2026-09-16): **[Bug]: TypeScript realtime subscription errors escape through Pusher callbacks**
  *Symptoms*: ## 🐞 Bug Report  ### SDK Language TypeScript / Node.js SDK (`@composio/core`)  ### SDK Version `@composio/core@0.18.1` on `next` at commit `8174302053ec0e9317ebcc5274e081e9d57c791f`  ### Runtime Environment Node.js 24.x (supported repository toolchain); the dependency-level reproduction was also run with the available Node.js `v12.22.9`.  ### Environment Local Development; the same path is used by production realtime trigger subscriptions.  ### Describe the Bug When the private Pusher channel emits `pusher:subscription_error`, the TypeScript core handler throws `ComposioFailedToSubscribeToPusherChannelError` from an asynchronous event callback. The `try/catch` in `PusherService.subscribe()` has already returned and cannot catch this exception. `pusher-js` dispatches the callback without an exception boundary, so the error reaches the Node.js uncaught-exception path and can terminate or destabilize the process.  Expected: a channel-auth/subscription failure is reported through the SDK's existing typed error or logging boundary without an exception escaping the asynchronous Pusher callback.  ### Steps to Reproduce 1. Create a Pusher private channel using the Node runtime. 2. Bind a `pusher:subscription_error` callback that matches the current `PusherService` behavior. 3. Emit a subscription error after the subscription setup call has returned. 4. Observe the uncaught exception.  ### Minimal Reproducible Example ```javascript const Pusher = require('pusher-js');  const pusher =

- **Issue #4369** (2026-09-08): **Bug : Default OpenAIProvider is a process-wide singleton — last-created Composio() instance hijacks tool execution for all other instances (wrong API key used)**
  *Symptoms*: ### SDK Language  Python SDK (`composio` package)  ### SDK Version  composio==0.20.0  ### Runtime Environment  Python 3.11+ on any platform (bug is platform-independent, in pure Python SDK code)  ### Environment  Local Development  ### Describe the Bug  When `Composio()` is constructed without an explicit provider, the SDK reuses a single module-level `OpenAIProvider` instance for ALL SDK instances in the process (`_DEFAULT_PROVIDER` in `composio/sdk.py`).  Because each `Composio` instance's `Tools` object rebinds `provider.execute_tool` to itself (via `set_execute_tool_fn(functools.partial(self.execute, ...))`), whichever `Composio()` is constructed LAST takes over tool execution for EVERY other instance.  **Consequence:** An earlier `Composio(api_key="KEY_A")` silently executes tools with a later `Composio(api_key="KEY_B")` credentials/project — with no error or warning. Tools run against the wrong account and wrong environment.  This also affects users who deliberately pass the SAME custom provider instance to two Composio clients (the singleton is just the default case).  **Expected:** Each `Composio` instance owns its own provider instance bound to its own HTTP client (matching the TypeScript SDK behavior).  ### Steps to Reproduce  1. Create two Composio instances without passing a provider, with different API keys:    sdk_prod = Composio(api_key="prod-key")    sdk_test = Composio(api_key="test-key") 2. Inspect sdk_prod.provider is sdk_test.provider -> returns True (both
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. We've flagged it for review and will update this issue once we have a verified finding. If you need to share logs or account identifiers, please email support@composio.dev and include a link to this GitHub issue.
  > Hi @jkomyno — I reported this and have opened the fix as #4370 (fresh `OpenAIProvider()` per instance, removal of `_DEFAULT_PROVIDER`, plus a regression suite `test_default_provider_isolation.py` that fails on the pre-fix code and passes after). Happy to address any review feedback or adjust the approach if you had a different fix in mind.

- **Issue #4368** (2026-09-07): **MCP.create()/update() silently drop authConfigId when a toolkit also specifies toolkit (else-if bug)**
  *Symptoms*: ### Bug Description  `MCP.create()` and `MCP.update()` (TypeScript SDK) silently drop a toolkit's `authConfigId` whenever that same toolkit entry also specifies `toolkit`, because the field extraction uses an `if / else if / else if` chain instead of two independent checks.  **File:** `ts/packages/core/src/models/MCP.ts`  `MCP.create()`, lines 104-113: ```ts config.data.toolkits.forEach(toolkit => {   if (typeof toolkit === 'string') {     toolkits.push(toolkit);   } else if (toolkit.toolkit) {     toolkits.push(toolkit.toolkit);   } else if (toolkit.authConfigId) {     auth_config_ids.push(toolkit.authConfigId);   } }); ```  `MCP.update()`, lines 386-394, has the identical pattern.  The schema (`ts/packages/core/src/types/mcp.experimental.types.ts`, lines 17-20) declares both fields as independent and meant to coexist: ```ts export const MCPConfigToolkitsSchema = z.object({   toolkit: z.string().describe('Id of the toolkit').optional(),   authConfigId: z.string().describe('Id of the auth config').optional(), }); ```  This is exactly the shape used in `MCP.create()`'s own JSDoc example (lines 80-85): ```ts const server = await composio.mcpConfig.create("personal-mcp-server", {   toolkits: [{ toolkit: "gmail", authConfigId: "ac_243434343" }],   ... }); ```  But because the extraction is `else if`, when a toolkit entry has both fields set, `toolkit.toolkit` is truthy so that branch runs and `authConfigId` is never even checked. `auth_config_ids` silently ends up missing the ent
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. We've flagged it for review and will update this issue once we have a verified finding. If you need to share logs or account identifiers, please email support@composio.dev and include a link to this GitHub issue.
  > hey, thanks for the detailed report. `mcp.create()` and `mcp.update()` are part of our deprecated MCP APIs. We recommend switching to [sessions](https://docs.composio.dev/reference/api-reference/tool-router) for MCP access going forward.

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

### Incident Patch 1: `857810d0` (2026-10-01)
**Commit Message**: fix(docs): stop quickstart intro from rendering nested <p> (#4704)

## Summary
The Quickstart intro block rendered `<p class="mb-6"><p>…</p></p>`. The
text sat on its own lines inside `<p className="mb-6">`, so MDX wrapped
it in a second paragraph. Browsers don't allow a `<p>` inside a `<p>`,
so they split the server HTML apart. React then failed hydration and
rebuilt the page on the client on every visit. The page now renders
`<div class="mb-6"><p>…</p></div>` with the same 24px spacing, and
hydrates without errors.

Designated PR reviewer: [@jkomyno](mailto:[REDACTED_EMAIL]).

Fixes #4703

## Changes
- `docs/content/docs/quickstart.mdx`: the intro wrapper is a `<div
className="mb-6">` instead of a `<p>`. A `<div>` stays valid if the text
is later rewrapped.
- `docs/tests/static/content.test.ts`: a new content check compiles
every page under `content/` with `@mdx-js/mdx` and fails when the
rendered tree has a `<p>` inside a `<p>`. Code examples aren't flagged,
and tags that span several lines are caught. It flags
`docs/quickstart.mdx:12` without the fix. The Quickstart was the only
affected page.
- `docs/package.json`, `docs/bun.lock`: declare `@mdx-js/mdx@^3.1.1` as
a devDependen

**File**: `docs/bun.lock` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@
         "@llamaindex/workflow": "^1.1.25",
         "@mastra/core": "1.53.0",
         "@mastra/mcp": "1.17.2",
+        "@mdx-js/mdx": "^3.1.1",
         "@openai/agents": "^0.13.5",
         "@shikijs/vitepress-twoslash": "^4.4.3",
         "@tailwindcss/postcss": "^4.3.3",
```

**File**: `docs/content/docs/quickstart.mdx` (modified, +2/-2)
```diff
@@ -8,9 +8,9 @@ Build an agent that chooses Composio tools at runtime. Type a task, connect an a
 
 <div className="not-prose my-6 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
   <div>
-    <p className="mb-6">
+    <div className="mb-6">
       Pick your framework below. A Composio [session](/docs/how-composio-works) gives your agent tool discovery, account connections, and execution across [1000+ apps](/toolkits). It exposes only a small set of meta tools, so app schemas are loaded when the agent needs them.
-    </p>
+    </div>
     <AgentSetupActions />
   </div>
   <Callout className="my-0" type="info" title="Running as an unattended coding agent?">
```

**File**: `docs/package.json` (modified, +1/-0)
```diff
@@ -99,6 +99,7 @@
     "@llamaindex/workflow": "^1.1.25",
     "@mastra/core": "1.53.0",
     "@mastra/mcp": "1.17.2",
+    "@mdx-js/mdx": "^3.1.1",
     "@openai/agents": "^0.13.5",
     "@shikijs/vitepress-twoslash": "^4.4.3",
     "@tailwindcss/postcss": "^4.3.3",
```

**File**: `docs/tests/static/content.test.ts` (modified, +47/-0)
```diff
@@ -5,9 +5,11 @@
  * and changelog entries use valid date formats.
  */
 import { describe, test, expect } from "bun:test";
+import { compile } from "@mdx-js/mdx";
 import { readdir, readFile, stat } from "fs/promises";
 import { join, relative } from "path";
 
+const CONTENT_DIR = join(import.meta.dir, "../../content");
 const DOCS_DIR = join(import.meta.dir, "../../content/docs");
 const EXAMPLES_DIR = join(import.meta.dir, "../../content/examples");
 const CHANGELOG_DIR = join(import.meta.dir, "../../content/changelog");
@@ -101,6 +103,51 @@ describe("Content - no empty pages", () => {
   });
 });
 
+/** A node in the tree MDX renders: markdown elements and JSX elements. */
+type RenderedNode = {
+  type: string;
+  tagName?: string;
+  name?: string | null;
+  children?: RenderedNode[];
+  position?: { start: { line: number } };
+};
+
+function isParagraph(node: RenderedNode): boolean {
+  if (node.type === "element") return node.tagName === "p";
+  return (
+    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "p"
+  );
+}
+
+describe("Content - valid HTML nesting", () => {
+  test("no page renders a <p> inside a <p>", async () => {
+    // MDX wraps the lines inside a block-level <p> in a markdown paragraph,
+    // rendering <p><p>…</p></p>. Browsers split that apart, so React hydration
+    // fails and the page re-renders on the client. Checking the compiled tree
+    // skips code examples and catches tags that span several lines.
+    const files = await findMdxFiles(CONTENT_DIR);
+    const nested: string[] = [];
+
+    for (const file of files) {
+      // Blank out frontmatter so reported line numbers match the file.
+      const source = (await readFile(file, "utf-8")).replace(/^---\n[\s\S]*?\n---\n/, fm =>
+        fm.replace(/[^\n]/g, ""),
+      );
+      const visit = (node: RenderedNode, insideParagraph: boolean) => {
+        if (insideParagraph && isParagraph(node)) {
+          nested.push(`${relative(CONTENT_DIR, file)}:${node.position?.start.line}`);
+        }
+        for (const child of node.children ?? []) {
+          visit(child, insideParagraph || isParagraph(node));
+        }
+      };
+      await compile(source, { rehypePlugins: [() => (tree: RenderedNode) => visit(tree, false)] });
+    }
+
+    expect(nested).toEqual([]);
+  }, 30_000);
+});
+
 describe("Content - provider compatibility", () => {
   test("Gemini Python docs use the google-genai-compatible provider", async () => {
     const content = await readFile(GOOGLE_PROVIDER_DOC, "utf-8");
```

---

### Incident Patch 2: `1afd8be9` (2026-10-01)
**Commit Message**: fix(experimental): never re-send a workbench tool execution (#4727)

This PR:

- builds on top of https://github.com/ComposioHQ/composio/pull/4718 and
continues https://github.com/ComposioHQ/composio/issues/3654
- stops the workbench Python helper `run_composio_tool` from re-sending
`/tool_router/session/{id}/execute` after a network failure. It retried
a timeout or dropped connection up to three more times, so a tool the
backend had already run could repeat its side effect (e.g. send the same
email twice)
- keeps the helper's rate-limit retries (HTTP 429 and a rate-limit
`error` in the response body), where the tool did not run
- regenerates `python-helpers.generated.ts` from the `.py` source
- adds a helper regression test: a timed-out execution reaches the
transport exactly once, while a 429 still retries. It fails without the
fix (4 calls instead of 1)
- adds the missing CLI assertion that `composio execute` passes
`maxRetries: 0` for meta tools (`session.executeMeta`); dropping that
argument previously left every CLI test green
- records the CLI no-retry behavior from #4718 in
`ts/packages/cli/CHANGELOG.md`

## Context

#4718 disabled retries on every SDK-client execution path

**File**: `.changeset/workbench-helper-no-retry.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@composio/experimental': patch
+---
+
+Stop re-sending a workbench tool execution after a network failure. The Python `run_composio_tool` helper retried a timed-out or dropped request up to three more times, so a tool the backend had already run could repeat its side effect, such as sending the same email twice. It now returns the error after the first attempt; rate-limited (429) requests still retry.
```

**File**: `ts/packages/cli/CHANGELOG.md` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@
 
 ### Patch Changes
 
+- `composio execute` (including meta tools) and `composio proxy` are never
+  retried, so a request that timed out or failed after the backend already
+  acted cannot repeat a side effect such as sending the same email twice.
+
 - API requests and command analytics now report CLI product/version, language,
   runtime/version, and the installed API client version separately.
 
```

**File**: `ts/packages/cli/test/src/commands/tools/tools.execute.cmd.test.ts` (modified, +16/-0)
```diff
@@ -347,6 +347,14 @@ describe('CLI: composio execute', () => {
             log_id: 'log_gmail_default',
           };
         },
+        executeMeta: async (_sessionId, params, options) => {
+          recordedExecuteOptions.push(options);
+          return {
+            data: { slug: params.slug, arguments: params.arguments },
+            error: null,
+            log_id: 'log_meta_default',
+          };
+        },
       },
     })
   )('[Given] default alias exists [Then] execute pins the default connected account', it => {
@@ -369,6 +377,14 @@ describe('CLI: composio execute', () => {
       })
     );
 
+    it.effect('never retries a meta tool execution', () =>
+      Effect.gen(function* () {
+        yield* cli(['execute', 'COMPOSIO_SEARCH_TOOLS', '-d', '{"query":"email"}']);
+
+        expect(recordedExecuteOptions).toEqual([{ maxRetries: 0 }]);
+      })
+    );
+
     it.effect('asks for the latest tool version once per execute on a schema cache hit', () =>
       Effect.gen(function* () {
         const latestVersion = vi
```

**File**: `ts/packages/experimental/src/workbench/python-helpers.generated.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 // GENERATED by scripts/build-python-helpers.ts — do not edit; edit the .py source.
 // Source: src/workbench/python-helpers/composio_helper.py
 export const PYTHON_WORKBENCH_HELPER_SOURCE =
-  'import json\nimport os\nimport random\nimport time\nimport urllib.error\nimport urllib.parse\nimport urllib.request\nimport uuid\nfrom typing import Any, Dict, Literal, Optional\n\n\n# Config is injected by the SDK via an `_INTERNAL` dict in a prologue prepended\n# at runtime. When running this file directly (e.g. pytest), default to empty.\ntry:\n    _INTERNAL\nexcept NameError:\n    _INTERNAL = {}\n\n\nDEFAULT_INVOKE_LLM_MODEL = _INTERNAL.get("invoke_llm_model", "openai/gpt-oss-120b")\nRATE_LIMIT_PATTERNS = (\n    "rate limit",\n    "ratelimit",\n    "too many requests",\n    "quota exceeded",\n    "resource exhausted",\n)\n\n\ndef _read_env(name, default=None):\n    value = os.environ.get(name)\n    return default if value is None or value == "" else value\n\n\ndef _require_value(value, label):\n    if value is None or value == "":\n        raise RuntimeError("%s is required" % label)\n    return value\n\n\ndef _request_id():\n    return str(uuid.uuid4())\n\n\ndef _session_execute_url():\n    backend_url = _read_env("BACKEND_URL", "https://backend.composio.dev").rstrip("/")\n    session_id = _require_value(\n        _read_env("COMPOSIO_TOOLROUTER_SESSION_ID"),\n        "COMPOSIO_TOOLROUTER_SESSION_ID",\n    )\n    encoded_session_id = urllib.parse.quote(session_id, safe="")\n    return "%s/api/v3/tool_router/session/%s/execute" % (backend_url, encoded_session_id)\n\n\ndef _session_proxy_execute_url():\n    backend_url = _read_env("BACKEND_URL", "https://backend.composio.dev").rstrip("/")\n    session_id = _require_value(\n        _read_env("COMPOSIO_TOOLROUTER_SESSION_ID"),\n        "COMPOSIO_TOOLROUTER_SESSION_ID",\n    )\n    encoded_session_id = urllib.parse.quote(session_id, safe="")\n    return "%s/api/v3/tool_router/session/%s/proxy_execute" % (\n        backend_url,\n        encoded_session_id,\n    )\n\n\ndef _post_json(url, headers, payload, timeout=120):\n    body = json.dumps(payload).encode("utf-8")\n    request = urllib.request.Request(url, data=body, headers=headers, method="POST")\n    try:\n        with urllib.request.urlopen(request, timeout=timeout) as response:\n            return response.status, dict(response.headers), response.read().decode("utf-8")\n    except urllib.error.HTTPError as error:\n        return error.code, dict(error.headers), error.read().decode("utf-8")\n\n\ndef _parse_json(text):\n    if not text:\n        return {}\n    return json.loads(text)\n\n\ndef _safe_json(text):\n    try:\n        return _parse_json(text)\n    except json.JSONDecodeError:\n        return {"raw": text}\n\n\ndef _contains_rate_limit_error(payload):\n    # Only inspect the API "error" field, not the whole body — otherwise benign\n    # tool output mentioning "rate limit"/"quota" triggers spurious retries.\n    if not isinstance(payload, dict):\n        return False\n    error = payload.get("error")\n    if not error:\n        return False\n    text = json.dumps(error, default=str).lower()\n    return any(pattern in text for pattern in RATE_LIMIT_PATTERNS)\n\n\ndef _retry_delay(attempt, delay_ms):\n    base_delay = max(delay_ms, 0) / 1000.0\n    if base_delay == 0:\n        return\n    # Exponential backoff: double the delay each attempt (parity with Apollo).\n    backoff = base_delay * (2 ** attempt)\n    jitter = random.uniform(0, min(backoff * 0.2, 0.5))\n    time.sleep(backoff + jitter)\n\n\ndef _json_shape(value):\n    if isinstance(value, dict):\n        return {key: _json_shape(item) for key, item in value.items()}\n    if isinstance(value, list):\n        return [_json_shape(value[0])] if value else []\n    if value is None:\n        return "null"\n    return type(value).__name__\n\n\ndef print_json_structure(value):\n    print(json.dumps(_json_shape(value), indent=2, sort_keys=True))\n\n\ndef _track_helper_event(*_args, **_kwargs):\n    return None\n\n\ndef run_composio_tool(\n    tool_slug,\n    arguments=None,\n    retry_params=None,\n    print_schema_for_tool=True,\n    *,\n    account=None,\n):\n    if not tool_slug:\n        return {}, "tool_slug is required"\n\n    api_key = _require_value(_read_env("COMPOSIO_API_KEY"), "COMPOSIO_API_KEY")\n    retry_config = {"max_retries": 3, "delay_ms": 2000}\n    if retry_params:\n        retry_config.update(retry_params)\n\n    payload = {\n        "tool_slug": str(tool_slug).strip().upper(),\n        "arguments": arguments or {},\n    }\n    if account is not None:\n        payload["account"] = account\n\n    headers = {\n        "Content-Type": "application/json",\n        "x-api-key": api_key,\n        "x-request-id": _request_id(),\n    }\n    max_retries = int(retry_config.get("max_retries", 3))\n    delay_ms = int(retry_config.get("delay_ms", 2000))\n\n    for attempt in range(max_retries + 1):\n        try:\n            statu
```

**File**: `ts/packages/experimental/src/workbench/python-helpers/composio_helper.py` (modified, +4/-5)
```diff
@@ -163,11 +163,10 @@ def run_composio_tool(
         try:
             status, _headers, text = _post_json(_session_execute_url(), headers, payload)
         except (urllib.error.URLError, TimeoutError) as error:
-            # Network failure (timeout, connection/DNS error). Retry transient
-            # failures, then surface as the error tuple instead of throwing.
-            if attempt < max_retries:
-                _retry_delay(attempt, delay_ms)
-                continue
+            # Network failure (timeout, connection/DNS error). Never retry it:
+            # the backend may already have run the tool and does not deduplicate
+            # executions, so re-sending can repeat the side effect. Surface it as
+            # the error tuple instead of throwing.
             return {}, "Composio tool request failed: %s" % error
 
         if status == 429 and attempt < max_retries:
```

**File**: `ts/packages/experimental/test/workbench/shim.test.ts` (modified, +68/-0)
```diff
@@ -107,6 +107,74 @@ print(_json.dumps({
     }
   });
 
+  it('never re-sends a tool execution after a network failure', () => {
+    const source = experimental_createPythonWorkbenchHelperSource();
+    const directory = mkdtempSync(join(tmpdir(), 'composio-helper-'));
+    const scriptPath = join(directory, 'helper_retry_test.py');
+    const testScript = `${source}
+
+import json as _json
+
+_timeout_calls = []
+
+def _post_json_timeout(url, headers, payload, timeout=120):
+    # The backend may already have run the tool when the read times out.
+    _timeout_calls.append(payload)
+    raise TimeoutError("timed out")
+
+_post_json = _post_json_timeout
+timeout_data, timeout_error = run_composio_tool(
+    "gmail_send_email", {"to": "a@example.com"}, {"delay_ms": 0}, False
+)
+
+_rate_limit_calls = []
+
+def _post_json_rate_limited(url, headers, payload, timeout=120):
+    # A 429 is rejected before the tool runs, so it stays safe to retry.
+    _rate_limit_calls.append(payload)
+    if len(_rate_limit_calls) == 1:
+        return 429, {}, _json.dumps({"error": "rate limited"})
+    return 200, {}, _json.dumps({"data": {"ok": True}})
+
+_post_json = _post_json_rate_limited
+rate_limit_data, rate_limit_error = run_composio_tool(
+    "gmail_send_email", {"to": "a@example.com"}, {"delay_ms": 0}, False
+)
+
+print(_json.dumps({
+    "timeout_calls": len(_timeout_calls),
+    "timeout_data": timeout_data,
+    "timeout_error": timeout_error,
+    "rate_limit_calls": len(_rate_limit_calls),
+    "rate_limit_data": rate_limit_data,
+    "rate_limit_error": rate_limit_error,
+}))
+`;
+
+    try {
+      writeFileSync(scriptPath, testScript);
+      const output = execFileSync('python3', [scriptPath], {
+        env: {
+          ...process.env,
+          BACKEND_URL: 'https://backend.test/',
+          COMPOSIO_TOOLROUTER_SESSION_ID: 'session_123',
+          COMPOSIO_API_KEY: 'project_key',
+        },
+        encoding: 'utf8',
+      });
+      const parsed = JSON.parse(output);
+
+      expect(parsed.timeout_calls).toBe(1);
+      expect(parsed.timeout_data).toEqual({});
+      expect(parsed.timeout_error).toContain('Composio tool request failed');
+      expect(parsed.rate_limit_calls).toBe(2);
+      expect(parsed.rate_limit_data).toEqual({ data: { ok: true } });
+      expect(parsed.rate_limit_error).toBe('');
+    } finally {
+      rmSync(directory, { recursive: true, force: true });
+    }
+  });
+
   it('round-trips helper calls through the session execute endpoint shape', () => {
     const source = experimental_createPythonWorkbenchHelperSource({
       invokeLlmModel: 'test/model',
```

---

### Incident Patch 3: `48bf5f90` (2026-10-01)
**Commit Message**: docs: update guides for SDK changes (#4726)

## Summary
Automated docs update triggered by SDK source changes on `next`.

- Claude reviewed the SDK diff and updated guides, FAQs, or examples
  that reference changed APIs or features.
- The docs `@composio/*` dependencies were realigned to their latest
  published releases so Twoslash snippets and example apps validate
  against versions users can actually install.

## Review checklist
- [ ] Changes accurately reflect the new SDK behavior
- [ ] No unrelated docs were modified
- [ ] Code examples are correct and complete
- [ ] If a documented feature is not published yet, the Twoslash build
      will fail — wait for the release instead of working around it

Generated by Claude Code via GitHub Actions.

Co-authored-by: jkomyno <[REDACTED_EMAIL]>

**File**: `docs/content/docs/extending-sessions/proxy-execute.mdx` (modified, +2/-0)
```diff
@@ -173,6 +173,8 @@ Don't set the `Authorization` header yourself through `parameters`. Composio inj
 | `403 Forbidden` | The user's OAuth scopes or API key don't cover this endpoint. | Update the [auth config scopes](/docs/auth-configuration/custom-auth-configs) and have the user re-consent. |
 | `429 Too Many Requests` | Upstream rate limit (GitHub, Google, and so on). | Honor the `Retry-After` header and back off. Composio doesn't retry automatically. |
 
+Composio sends a proxied call exactly once. A timeout, a connection error, or a `5xx` surfaces to you rather than being retried, because a retry after the upstream API already acted would repeat the write. Retry only when the endpoint is safe to call again. See [Retry failed executions deliberately](/docs/production-readiness#retry-failed-executions-deliberately).
+
 ## Next
 
 <Card icon={<Blocks />} title="Custom tools and toolkits" href="/docs/extending-sessions/custom-tools-and-toolkits" description="Define in-process tools and toolkits that run alongside Composio tools" />
```

**File**: `docs/content/docs/production-readiness.mdx` (modified, +6/-0)
```diff
@@ -82,6 +82,12 @@ Run at least one safe, read-only call against a real connected account. Confirm
 
 Do not treat a successful Connect Link alone as an end-to-end test. Authentication can succeed while a provider API, scope, or tool input still fails.
 
+### Retry failed executions deliberately
+
+The SDKs retry reads — fetching tools, listing toolkits, reading a session — when a request times out or comes back `408`, `409`, `429`, or `5xx`. They never retry an execution. `tools.execute`, `tools.proxy`, and every session `execute` and `proxyExecute` call is sent exactly once, because the backend doesn't deduplicate executions and a silent retry after a read timeout would repeat the side effect, such as sending the same email twice.
+
+A transient failure on an execution therefore reaches your code instead of being absorbed. Before retrying one, decide whether repeating that specific call is safe: a read is, `GMAIL_SEND_EMAIL` isn't. When it isn't, check [Logs](/reference/api-reference/logs) or the provider's own API to find out whether the first attempt landed.
+
 ### Configure SDK logging
 
 Pass `logger` and `logLevel` to the TypeScript `Composio` constructor to send SDK logs to your logging system. The logger must provide `error`, `warn`, `info`, and `debug` methods. Messages have credential-shaped values redacted before reaching the logger, including owned-client deprecation warnings. Logger configuration is process-wide: the last configured instance controls the SDK logger.
```

---

### Incident Patch 4: `e3999c4e` (2026-10-01)
**Commit Message**: fix(sdk): never retry session tool executions (#4718)

This PR:

- is the SDK-only first step of
https://github.com/ComposioHQ/composio/issues/3654 and supersedes
https://github.com/ComposioHQ/composio/pull/4646, which covered one of
the affected paths
- stops retrying every remaining tool-execution path in both SDKs:
`session.execute`, `session.proxyExecute` / `proxy_execute`,
provider-wrapped session tools, and the `execute` / `proxyExecute`
helpers passed to custom tools. These kept the client's default of two
retries on timeouts, connection errors, and 408/409/429/5xx, so a retry
after the backend already acted could repeat the side effect (e.g. send
the same email twice)
- TypeScript: adds an internal `withoutRetries(requestOptions)` helper
that sets `maxRetries: 0` per request, and replaces the cloned
`clientWithoutRetries` client in `Tools` with it, so `tools.execute` /
`tools.proxyExecute` and the session paths share one mechanism
- Python: routes the session paths through the existing
`client.without_retries`, the same mechanism `tools.execute` /
`tools.proxy` already use
- CLI: `composio execute` (including meta tools) and `composio proxy`
pass `maxRetries: 0`
- adds tran

**File**: `.changeset/no-retry-session-execute.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@composio/core': patch
+---
+
+Stop retrying session tool executions and proxied calls. `session.execute()`, `session.proxyExecute()`, provider-wrapped session tools, and the `execute` / `proxyExecute` helpers passed to custom tools no longer retry after a timeout, connection error, or 408/409/429/5xx response, so a retry can no longer repeat a side effect such as sending the same email twice. This matches `tools.execute()` and `tools.proxyExecute()`.
```

**File**: `python/composio/client/__init__.py` (modified, +8/-6)
```diff
@@ -483,15 +483,17 @@ def without_retries(self) -> te.Self:
         """
         A cached sibling client that never retries requests.
 
-        Used for non-idempotent writes (``tools.execute`` / ``tools.proxy``),
+        Used for tool executions and proxied API calls (``tools.execute``,
+        ``tools.proxy``, and the session ``execute`` / ``proxy_execute`` paths),
         where a silent retry after a read timeout can duplicate a side effect
         (e.g. send an email twice). Reads keep the default retry behaviour.
 
-        Scope: only ``tools.execute`` / ``tools.proxy`` route through this today.
-        Other non-idempotent writes (``auth_configs.create`` / ``update`` /
-        ``delete``, ``mcp.update`` / ``delete``, ``connected_accounts.delete`` /
-        ``refresh``, ``link.create``) keep the default retries — most are
-        naturally idempotent on retry, and the durable fix is backend-honoured
+        Scope: every execution path routes through this, because the backend
+        does not deduplicate executions. Other non-idempotent writes
+        (``auth_configs.create`` / ``update`` / ``delete``, ``mcp.update`` /
+        ``delete``, ``connected_accounts.delete`` / ``refresh``,
+        ``link.create``) keep the default retries — most are naturally
+        idempotent on retry, and the durable fix is backend-honoured
         idempotency keys.
 
         The sibling is cached rather than rebuilt per call so a fresh client is
```

**File**: `python/composio/core/models/session_context.py` (modified, +6/-2)
```diff
@@ -82,7 +82,9 @@ def proxy_execute_impl(
                 )
             )
 
-    response = client.tool_router.session.proxy_execute(
+    # Disable retries: a proxied call is a non-idempotent write, and a silent
+    # retry after a read timeout can duplicate the side effect.
+    response = client.without_retries.tool_router.session.proxy_execute(
         session_id=session_id,
         toolkit_slug=toolkit,
         endpoint=endpoint,
@@ -165,7 +167,9 @@ def execute(
         # Serialize any Pydantic model instances before sending to remote API
         serialized = _serialize_arguments(arguments)
 
-        return self._client.tool_router.session.execute(
+        # Disable retries: a session execution is a non-idempotent write, and a
+        # silent retry after a read timeout can duplicate the side effect.
+        return self._client.without_retries.tool_router.session.execute(
             session_id=self._session_id,
             tool_slug=tool_slug,
             arguments=serialized,
```

**File**: `python/composio/core/models/tool_router_session.py` (modified, +3/-1)
```diff
@@ -984,7 +984,9 @@ def execute(
 
         assert_unambiguous_custom_tool_slug(self._custom_tools_map, tool_slug)
 
-        response = self._client.tool_router.session.execute(
+        # Disable retries: a session execution is a non-idempotent write, and a
+        # silent retry after a read timeout can duplicate the side effect.
+        response = self._client.without_retries.tool_router.session.execute(
             session_id=self.session_id,
             tool_slug=tool_slug,
             arguments=arguments if arguments is not None else omit,
```

**File**: `python/composio/core/models/tools.py` (modified, +3/-1)
```diff
@@ -565,7 +565,9 @@ def execute_tool_fn(slug: str, arguments: t.Dict) -> t.Dict:
             # Serialize any Pydantic model instances before sending to the API
             processed_arguments = _serialize_arguments(processed_arguments)
 
-            response = self._client.tool_router.session.execute(
+            # Disable retries: a session execution is a non-idempotent write, and a
+            # silent retry after a read timeout can duplicate the side effect.
+            response = self._client.without_retries.tool_router.session.execute(
                 session_id=session_id,
                 tool_slug=slug,
                 arguments=processed_arguments,
```

**File**: `python/tests/conftest.py` (modified, +8/-6)
```diff
@@ -6,6 +6,7 @@
 import json
 import os
 from pathlib import Path
+import typing as t
 from unittest.mock import Mock
 
 import pytest
@@ -81,15 +82,16 @@ def load_golden_signatures() -> dict:
         return json.load(f)
 
 
-def mock_http_client() -> Mock:
+def mock_http_client(mock_cls: t.Type[Mock] = Mock) -> Mock:
     """Build a mock ``HttpClient`` for tool-execution tests.
 
-    Production routes non-idempotent writes through ``client.without_retries``
-    (a retry-disabled clone of the client). The mock mirrors that by returning
-    itself for ``without_retries``, so assertions on ``client.tools.execute`` and
-    ``client.tools.proxy`` still observe the call.
+    Production routes tool executions and proxied calls through
+    ``client.without_retries`` (a retry-disabled clone of the client). The mock
+    mirrors that by returning itself for ``without_retries``, so assertions on
+    ``client.tools.execute``, ``client.tools.proxy``, and the
+    ``client.tool_router.session`` execution methods still observe the call.
     """
-    client = Mock()
+    client = mock_cls()
     client.without_retries = client
     return client
 
```

**File**: `python/tests/test_custom_tools.py` (modified, +19/-15)
```diff
@@ -46,6 +46,7 @@
     ToolRouterSessionExecuteResponse,
 )
 from composio.exceptions import ValidationError
+from tests.conftest import mock_http_client
 
 # ────────────────────────────────────────────────────────────────
 # Fixtures
@@ -752,7 +753,10 @@ class TestSessionContextImpl:
     def test_sibling_routing(self, grep_tool):
         m = build_custom_tools_map([grep_tool])
         ctx = SessionContextImpl(
-            client=MagicMock(), user_id="u", session_id="s", custom_tools_map=m
+            client=mock_http_client(MagicMock),
+            user_id="u",
+            session_id="s",
+            custom_tools_map=m,
         )
         result = ctx.execute("GREP", {"pattern": "test"})
         assert isinstance(result, SessionExecuteResponse)
@@ -769,7 +773,7 @@ def test_sibling_routing_rejects_ambiguous_slug(self, duplicate_slug_tools):
         beta = ExperimentalToolkit(slug="BETA", name="Beta", description="Beta tools")
         beta._tools.append(beta_tool)
         m = build_custom_tools_map([], [alpha, beta])
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         ctx = SessionContextImpl(
             client=mock_client, user_id="u", session_id="s", custom_tools_map=m
         )
@@ -783,7 +787,7 @@ def test_sibling_routing_rejects_ambiguous_slug(self, duplicate_slug_tools):
 
     def test_remote_fallback(self, grep_tool):
         m = build_custom_tools_map([grep_tool])
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         mock_client.tool_router.session.execute.return_value = SessionExecuteResponse(
             data={"remote": True}, error=None, log_id="log_123"
         )
@@ -799,7 +803,7 @@ def test_remote_fallback(self, grep_tool):
         )
 
     def test_remote_fallback_passes_inline_custom_tools(self):
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         mock_client.tool_router.session.execute.return_value = SessionExecuteResponse(
             data={"remote": True}, error=None, log_id="log_123"
         )
@@ -828,7 +832,7 @@ def test_remote_fallback_passes_inline_custom_tools(self):
         )
 
     def test_proxy_execute(self):
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         mock_client.tool_router.session.proxy_execute.return_value = (
             SessionProxyExecuteResponse(
                 status=200, data={"ok": True}, headers={}, binary_data=None
@@ -847,7 +851,7 @@ def test_proxy_execute_narrows_status_to_int(self):
         Equality alone cannot catch the leak, because ``200 == 200.0``. Only the
         type assertion distinguishes ``200`` from the ``200.0`` a raw read returns.
         """
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         mock_client.tool_router.session.proxy_execute.return_value = (
             SessionProxyExecuteResponse(
                 status=200, data=None, headers=None, binary_data=None
@@ -861,7 +865,7 @@ def test_proxy_execute_narrows_status_to_int(self):
         assert result == {"status": 200, "data": None, "headers": None}
 
     def test_proxy_execute_projects_binary_data(self):
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         mock_client.tool_router.session.proxy_execute.return_value = (
             SessionProxyExecuteResponse(
                 status=200,
@@ -894,7 +898,7 @@ def test_proxy_execute_projects_binary_data(self):
 
     def test_proxy_execute_binary_data_without_expiry(self):
         """``expires_at`` is optional on the generated model; the key stays present."""
-        mock_client = MagicMock()
+        mock_client = mock_http_client(MagicMock)
         mock_client.tool_router.session.proxy_execute.return_value = (
             SessionProxyExecuteResponse(
                 status=200,
@@ -927,7 +931,7 @@ def test_proxy_execute_binary_data_without_expiry(self):
 @pytest.fixture
 def mock_session_deps(grep_tool, email_tool, role_toolkit):
     return {
-        "client": MagicMock(),
+        "client": mock_http_client(MagicMock),
         "provider": MagicMock(),
         "experimental": MagicMock(),
         "tools_map": build_custom_tools_map([grep_tool, email_tool], [role_toolkit]),
@@ -1109,7 +1113,7 @@ def test_custom_toolkits_list_uses_qualified_slugs(self, duplicate_slug_tools):
         beta._tools.append(beta_tool)
         custom_tools_map = build_custom_tools_map([], [alpha, beta])
         s = ToolRouterSession(
-            client=MagicMock(),
+            client=mock_http_client(MagicMock),
             provider=MagicMock(),
             dangerously_allow_auto_upload_download_files=True,
             session_id="s",
@@ -1148,7 +1152,7 @@ def test_custom_toolkits_list_never_borrows_other_toolkit_slug(
             [], [alpha, beta], mock_exp
         )
         s = ToolRouterSession(
-            client=MagicMock(),
+            client=mock_http_
```

**File**: `python/tests/test_no_retry_writes.py` (modified, +92/-4)
```diff
@@ -1,10 +1,14 @@
-"""Non-idempotent tool writes (``tools.execute`` / ``tools.proxy``) must not retry.
+"""Tool executions and proxied API calls must not retry.
 
 A POST that times out while the backend is still processing it is unsafe to
 retry: the request may already have taken effect, so a silent re-send can
-duplicate the side effect (e.g. send an email twice). ``Tools.execute`` and
-``Tools.proxy`` therefore route through ``client.without_retries`` (a
-retry-disabled clone), while reads keep the default retry behaviour.
+duplicate the side effect (e.g. send an email twice). The backend does not
+deduplicate executions, so every execution path (``tools.execute``,
+``tools.proxy``, and the session ``execute`` / ``proxy_execute`` paths) routes
+through ``client.without_retries`` (a retry-disabled clone), while reads keep
+the default retry behaviour.
+
+See https://github.com/ComposioHQ/composio/issues/3654.
 """
 
 import inspect
@@ -18,6 +22,8 @@
 
 from composio.client import HttpClient
 from composio.core.models.base import allow_tracking
+from composio.core.models.session_context import SessionContextImpl
+from composio.core.models.tool_router_session import ToolRouterSession
 from composio.core.models.tools import Tools
 
 
@@ -169,6 +175,88 @@ def handler(request: httpx.Request) -> httpx.Response:
         assert len(attempts) == 1
 
 
+SESSION_ID = "sess_123"
+
+
+def _session(client: HttpClient) -> ToolRouterSession:
+    return ToolRouterSession(
+        client=client,
+        provider=None,
+        dangerously_allow_auto_upload_download_files=False,
+        session_id=SESSION_ID,
+        mcp=Mock(),
+        experimental=Mock(),
+    )
+
+
+def _provider_wrapped_session_tool(client: HttpClient) -> t.Any:
+    tools = Tools(client=client, provider=Mock())
+    # Avoid the (read) tool-schema lookup hitting the transport.
+    mock_tool = Mock()
+    mock_tool.toolkit.slug = "gmail"
+    mock_tool.input_parameters = {}
+    tools._tool_schemas["GMAIL_SEND_EMAIL"] = mock_tool
+    execute = tools._wrap_execute_tool_for_tool_router(session_id=SESSION_ID)
+    return execute("GMAIL_SEND_EMAIL", {"to": "test@test.com"})
+
+
+PROXY_KWARGS: t.Dict[str, t.Any] = {
+    "toolkit": "github",
+    "endpoint": "https://api.github.com/user/repos",
+    "method": "POST",
+    "body": {"name": "repo"},
+}
+
+SESSION_EXECUTION_PATHS: t.List[t.Tuple[str, t.Callable[[HttpClient], t.Any]]] = [
+    ("provider_wrapped_session_tool", _provider_wrapped_session_tool),
+    (
+        "session_execute",
+        lambda client: _session(client).execute(
+            "GMAIL_SEND_EMAIL", arguments={"to": "test@test.com"}
+        ),
+    ),
+    (
+        "session_proxy_execute",
+        lambda client: _session(client).proxy_execute(**PROXY_KWARGS),
+    ),
+    (
+        "custom_tool_context_execute",
+        lambda client: SessionContextImpl(client, "test-user", SESSION_ID).execute(
+            "GMAIL_SEND_EMAIL", {"to": "test@test.com"}
+        ),
+    ),
+    (
+        "custom_tool_context_proxy_execute",
+        lambda client: SessionContextImpl(
+            client, "test-user", SESSION_ID
+        ).proxy_execute(**PROXY_KWARGS),
+    ),
+]
+
+
+class TestSessionExecutionDoesNotRetry:
+    """Every session execution path must reach the transport exactly once."""
+
+    @pytest.mark.parametrize(
+        "run",
+        [run for _, run in SESSION_EXECUTION_PATHS],
+        ids=[name for name, _ in SESSION_EXECUTION_PATHS],
+    )
+    def test_does_not_retry_on_transient_error(
+        self, run: t.Callable[[HttpClient], t.Any], no_sleep: None
+    ) -> None:
+        attempts: t.List[httpx.Request] = []
+
+        def handler(request: httpx.Request) -> httpx.Response:
+            attempts.append(request)
+            return httpx.Response(500, json={"error": {"message": "boom"}})
+
+        with pytest.raises(APIError):
+            run(_client_with_transport(handler))
+
+        assert len(attempts) == 1
+
+
 class TestReadPathStillRetries:
     """Reads keep the default retry behaviour — only writes are scoped to no-retry."""
 
```

---

### Incident Patch 5: `7150d8d9` (2026-09-30)
**Commit Message**: docs: drop the x-debug ZDR caveat and state that audit logs and telemetry hold no PII (#4706)

## Summary

Two updates to the Zero Data Retention page.

- **The `x-debug` row is gone.** Apollo now skips the debug archive for
requests authenticated to a ZDR project, even when they carry `x-debug:
true` (ComposioHQ/platform#12683). This covers project API keys, session
access keys, and MCP URLs. If Apollo cannot read the project config, it
skips the archive too. The fix is live in production.
- **Always stored now says audit logs and telemetry contain no
personally identifiable information (PII).**

## Testing

- `bun run test` in `docs/`: 608 tests pass.

**File**: `docs/content/docs/security/zero-data-retention.mdx` (modified, +1/-2)
```diff
@@ -53,7 +53,6 @@ ZDR does not cover the following, even in a ZDR project. For how long Composio k
 | Triggers | With ZDR on, trigger logs leave out event payloads, but Composio still stores the events to process and deliver them. | Do not use triggers for data that needs ZDR. |
 | Sandbox | The sandbox includes the Workbench and remote Bash. Sessions also offload large responses to it. Sessions turn on the sandbox by default. | [Disable the sandbox](#disable-the-sandbox-in-sessions) when you create sessions. |
 | Files | Composio stages files that tools upload or download, including Proxy Execute binary responses, and cleans them up after 24 hours. | Do not use tools that upload or download files for data that needs ZDR. |
-| Requests with the `x-debug: true` header | Composio archives these requests for debugging. | Do not send this header from ZDR projects. |
 | Tool search in sessions | Composio can cache search queries to improve results. | Keep sensitive data out of search queries, or use the [direct tools preset](/docs/configuring-sessions#direct-tools-preset) to turn off tool search. |
 | Third parties | The destination apps you connect, your model provider, external MCP servers, and your own logs keep their own data policies. | Review each provider's data policy, and set retention for your own logs. |
 
@@ -91,7 +90,7 @@ See [Disabling the sandbox](/docs/configuring-sessions#disabling-the-sandbox) fo
 
 ## Always stored
 
-Composio stores audit logs and telemetry on every plan, and ZDR does not change them:
+Composio stores audit logs and telemetry on every plan, and ZDR does not change them. Neither contains personally identifiable information (PII).
 
 - **Audit logs** record who did what and when, including the metadata row for each tool call.
 - **Telemetry** is the metrics, traces, application logs, error reports, and usage metering that Composio uses to run and bill the service. Telemetry can include error messages returned by providers.
```

---

### Incident Patch 6: `26e52903` (2026-09-30)
**Commit Message**: docs: update guides for SDK changes (#4709)

## Summary
Automated docs update triggered by SDK source changes on `next`.

- Claude reviewed the SDK diff and updated guides, FAQs, or examples
  that reference changed APIs or features.
- The docs `@composio/*` dependencies were realigned to their latest
  published releases so Twoslash snippets and example apps validate
  against versions users can actually install.

## Review checklist
- [ ] Changes accurately reflect the new SDK behavior
- [ ] No unrelated docs were modified
- [ ] Code examples are correct and complete
- [ ] If a documented feature is not published yet, the Twoslash build
      will fail — wait for the release instead of working around it

Generated by Claude Code via GitHub Actions.

**File**: `docs/bun.lock` (modified, +8/-8)
```diff
@@ -48,14 +48,14 @@
         "@ai-sdk/react": "^4.0.96",
         "@anthropic-ai/claude-agent-sdk": "^0.3.263",
         "@anthropic-ai/sdk": "^0.115.0",
-        "@composio/anthropic": "^0.11.2",
+        "@composio/anthropic": "^0.11.3",
         "@composio/claude-agent-sdk": "^0.12.1",
-        "@composio/core": "^0.21.0",
-        "@composio/google": "^0.11.1",
+        "@composio/core": "^0.22.0",
+        "@composio/google": "^0.12.0",
         "@composio/langchain": "^0.11.1",
         "@composio/llamaindex": "^0.11.1",
         "@composio/mastra": "^0.10.5",
-        "@composio/openai": "^0.12.3",
+        "@composio/openai": "^0.13.0",
         "@composio/openai-agents": "^0.11.1",
         "@composio/typesafe": "^0.1.1",
         "@composio/vercel": "^0.12.1",
@@ -204,15 +204,15 @@
 
     "@chevrotain/types": ["@chevrotain/types@11.1.2", "", {}, "sha512-U+HFai5+zmJCkK86QsaJtoITlboZHBqrVketcO2ROv865xfCMSFpELQoz1GkX5GzME8pTa+3kbKrZHQtI0gdbw=="],
 
-    "@composio/anthropic": ["@composio/anthropic@0.11.2", "", { "peerDependencies": { "@anthropic-ai/sdk": "^0.110.0 || ^0.120.0 || ^0.124.0 || ^0.125.0", "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@mastra/mcp": "^1.13.1" } }, "sha512-IKQy0JpkFWRZ61Yn97JiFgWu1v51rLqISCZGrtdJYlhw8GG8LifQb0nK3mFjZ9X4pQdEtcBtgzlNOJm3pL3Uiw=="],
+    "@composio/anthropic": ["@composio/anthropic@0.11.3", "", { "peerDependencies": { "@anthropic-ai/sdk": "^0.110.0 || ^0.120.0 || ^0.124.0 || ^0.125.0 || ^0.127.0", "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@mastra/mcp": "^1.13.1" } }, "sha512-LcGxFzB0p4SEdnn0cueEXY3tQ6r8xIl2EeI/T7vxJf6rqjn3Ib9WNo7Srx2OpSgDFSqji4qakSU4eS355d65XQ=="],
 
     "@composio/claude-agent-sdk": ["@composio/claude-agent-sdk@0.12.1", "", { "dependencies": { "zod": "^4.5.4" }, "peerDependencies": { "@anthropic-ai/claude-agent-sdk": "^0.3.199", "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0" } }, "sha512-lHKvycugdyXnliURfNovzT0xQVvMpo5ulHsHEYOSRU++KiI9vGQ6bFFcVi+GAkxJy9FEz8TGmt/JkZ/3gs2MXQ=="],
 
     "@composio/client": ["@composio/client@2.0.0-rc.8", "", {}, "sha512-0C0Flmblx0Y3i6iGUY/MvST4aNXn3xEmPEA4wqZd3acm9x6u61/0i1LXCgBzFTTZEveK8YBFRu8Lpo/SMZwAFQ=="],
 
-    "@composio/core": ["@composio/core@0.21.0", "", { "dependencies": { "@composio/client": "2.0.0-rc.8", "@composio/json-schema-to-zod": "0.3.3", "@types/json-schema": "^7.0.15", "is-fs-case-sensitive": "^2.0.0", "openai": "^7.15.0", "picocolors": "^1.1.1", "pusher-js": "^8.6.0", "semver": "^7.8.5", "undici": "^7.29.1", "zod-to-json-schema": "^3.25.2" }, "peerDependencies": { "zod": ">=3.25.76 <5" } }, "sha512-fAgbqBdmYUbhIS/HWUtaUCG+QlPktyHXYbZwJ3xH7et5Pyw4YLQbw4UW+L7v4cQus8ijGgvjtmK7ZJL6tmWMmw=="],
+    "@composio/core": ["@composio/core@0.22.0", "", { "dependencies": { "@composio/client": "2.0.0-rc.8", "@composio/json-schema-to-zod": "0.3.3", "@types/json-schema": "^7.0.15", "is-fs-case-sensitive": "^2.0.0", "openai": "^7.21.0", "picocolors": "^1.1.1", "pusher-js": "^8.6.0", "semver": "^7.8.5", "undici": "^7.29.1", "zod-to-json-schema": "^3.25.2" }, "peerDependencies": { "zod": ">=3.25.76 <5" } }, "sha512-Inc7/yqhRQTfvU3km/VwSpewwJ9O/5mnC2FjSPDp56MfEdUfx61rwoi6+pancTUhHsHic5qe0lB4C2rHd7iioA=="],
 
-    "@composio/google": ["@composio/google@0.11.1", "", { "peerDependencies": { "@composio/core": ">=0.16.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@google/genai": "^1.1.0" } }, "sha512-xNQ5wesTRUXWKxTYfjGRX/Wtdiqno9up4AV+nY0qzt0NHSp7ExRG/0fkgWYUkXp3XeWi8mOZd9spo4RfI4YUJQ=="],
+    "@composio/google": ["@composio/google@0.12.0", "", { "peerDependencies": { "@composio/core": ">=0.16.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@google/genai": "^1.1.0" } }, "sha512-VYVd7F3Nu0b/bxZgQLMb2mR8A2bPNTSKBx3SqJtMOZsJ7Gayu7JE+ZmZtJq8fFXGUmGRoqpwoopwudNpq7GS+w=="],
 
     "@composio/json-schema-to-zod": ["@composio/json-schema-to-zod@0.3.3", "", { "dependencies": { "@cfworker/json-schema": "^4.1.1", "dequal": "^2.0.3" }, "peerDependencies": { "zod": ">=3.25.76 <5" } }, "sha512-QmgYo4IeK5/34Iqo1jSx6fSnLEyL++07FlW5Y6SfGFOhyb5htnY+vZPjs/tL8puJYhiEU7FV7kXdu5EAQoGrSA=="],
 
@@ -222,7 +222,7 @@
 
     "@composio/mastra": ["@composio/mastra@0.10.5", "", { "dependencies": { "@mastra/schema-compat": "^1.3.10" }, "peerDependencies": { "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@mastra/core": "^1.46.0", "zod": "^3.25 || ^4" } }, "sha512-ev8r52HXpO9eOO8m0zeIY6I7DboiYUaBxpbsCzuC9lBaFU9b1r0en2NOAPtBvsHMpVtFl2LaTlhu6gm1lCBe+g=="],
 
-    "@composio/openai": ["@composio/openai@0.12.3", "", { "peerDependencies": { "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "openai": "^6.49.0 || ^7.0.0" } }, "sha512-F8wVZtsS+hrkmVzw3OX8vhMIGy1zMyPk/EXl2O/JbmID1sqka7fuWNjaGOXVjc+HXJd+9sTkk2+kAECio/qXRw=="],
+    "@composio/openai": ["@composio/openai@0.13.0", "", { "peerDependencies": { "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "openai": "^6.49.0 || ^7.0.0" } }, "sha512-uhKBeQ/r+ZIMUB+WPoXdqZdxFI4VeygS7wwSc6waOJceNb/aa0aFzgkHIe9HiiaPi3ie54G52wrCyfBoQgepQ
```

**File**: `docs/content/docs/sandbox/remote.mdx` (modified, +4/-0)
```diff
@@ -121,6 +121,10 @@ The mount exposes four methods:
 
 A `RemoteFile` carries the file's bytes and a presigned `downloadUrl`. Read it with `text()` or `buffer()`, or write it to disk with `save(path)`. Its `expiresAt` is when that download link expires, not a TTL on the file: the mount itself has no expiry you set.
 
+`save(path)` writes exactly where you point it and overwrites whatever is there. Call `save()` with no path and the file goes to `~/.composio/files/` under its name on the mount — and an existing file there survives: the new copy gets a number before its extension, so a second `report.pdf` saves as `report-1.pdf`. The returned path tells you which name was used.
+
+Mount paths come from the sandbox, so the SDK makes that default name safe to write before using it. Characters Windows reserves (`:`, `?`, `*`, and control characters) become `_`, over-long names are truncated with their extension kept, and trailing dots and spaces are dropped. Any name these rules changed also carries a short digest of the original, so `What is this?.png` and `What is this*.png` don't land on the same file. A name that can't be written at all, one containing a NUL byte or with nothing usable left, such as `..`, raises an error instead of saving.
+
 A `RemoteFile` download through `buffer()`, `blob()`, `text()`, or `save()` stops at 100 MiB, even
 when the server omits or misreports `Content-Length`. Connection failures and streamed-body failures
 raise `RemoteFileDownloadError`.
```

**File**: `docs/content/docs/tools-direct/executing-tools.mdx` (modified, +9/-0)
```diff
@@ -534,6 +534,15 @@ console.log(result);
   </Tab>
 </Tabs>
 
+Python names each downloaded file after the name in the tool response, made safe to write first:
+characters Windows reserves become `_`, an over-long name is truncated with its extension kept, and
+trailing dots and spaces are dropped. A name any of those rules changed also carries a short digest
+of the original, so two names that clean up the same way stay distinct. A name that can't be
+written at all, one containing a NUL byte or with nothing usable left, fails the download instead.
+An existing file in the download directory is never replaced — the new download gets a number
+before its extension, so a second `report.pdf` lands as `report-1.pdf`. TypeScript names automatic downloads after the tool
+slug and a timestamp instead, so its names are already unique.
+
 Automatic S3 downloads stop at 100 MiB, even when the server omits or reports an incorrect
 `Content-Length`. Python removes partial files for transport and filesystem failures and raises
 `ErrorDownloadingFile`; oversized responses raise `ResponseTooLargeError`. In TypeScript, failed
```

**File**: `docs/package.json` (modified, +4/-4)
```diff
@@ -80,14 +80,14 @@
     "@ai-sdk/react": "^4.0.96",
     "@anthropic-ai/claude-agent-sdk": "^0.3.263",
     "@anthropic-ai/sdk": "^0.115.0",
-    "@composio/anthropic": "^0.11.2",
+    "@composio/anthropic": "^0.11.3",
     "@composio/claude-agent-sdk": "^0.12.1",
-    "@composio/core": "^0.21.0",
-    "@composio/google": "^0.11.1",
+    "@composio/core": "^0.22.0",
+    "@composio/google": "^0.12.0",
     "@composio/langchain": "^0.11.1",
     "@composio/llamaindex": "^0.11.1",
     "@composio/mastra": "^0.10.5",
-    "@composio/openai": "^0.12.3",
+    "@composio/openai": "^0.13.0",
     "@composio/openai-agents": "^0.11.1",
     "@composio/typesafe": "^0.1.1",
     "@composio/vercel": "^0.12.1",
```

---

### Incident Patch 7: `029e7db2` (2026-09-30)
**Commit Message**: docs: update guides for SDK changes

**File**: `docs/bun.lock` (modified, +8/-8)
```diff
@@ -48,14 +48,14 @@
         "@ai-sdk/react": "^4.0.96",
         "@anthropic-ai/claude-agent-sdk": "^0.3.263",
         "@anthropic-ai/sdk": "^0.115.0",
-        "@composio/anthropic": "^0.11.2",
+        "@composio/anthropic": "^0.11.3",
         "@composio/claude-agent-sdk": "^0.12.1",
-        "@composio/core": "^0.21.0",
-        "@composio/google": "^0.11.1",
+        "@composio/core": "^0.22.0",
+        "@composio/google": "^0.12.0",
         "@composio/langchain": "^0.11.1",
         "@composio/llamaindex": "^0.11.1",
         "@composio/mastra": "^0.10.5",
-        "@composio/openai": "^0.12.3",
+        "@composio/openai": "^0.13.0",
         "@composio/openai-agents": "^0.11.1",
         "@composio/typesafe": "^0.1.1",
         "@composio/vercel": "^0.12.1",
@@ -204,15 +204,15 @@
 
     "@chevrotain/types": ["@chevrotain/types@11.1.2", "", {}, "sha512-U+HFai5+zmJCkK86QsaJtoITlboZHBqrVketcO2ROv865xfCMSFpELQoz1GkX5GzME8pTa+3kbKrZHQtI0gdbw=="],
 
-    "@composio/anthropic": ["@composio/anthropic@0.11.2", "", { "peerDependencies": { "@anthropic-ai/sdk": "^0.110.0 || ^0.120.0 || ^0.124.0 || ^0.125.0", "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@mastra/mcp": "^1.13.1" } }, "sha512-IKQy0JpkFWRZ61Yn97JiFgWu1v51rLqISCZGrtdJYlhw8GG8LifQb0nK3mFjZ9X4pQdEtcBtgzlNOJm3pL3Uiw=="],
+    "@composio/anthropic": ["@composio/anthropic@0.11.3", "", { "peerDependencies": { "@anthropic-ai/sdk": "^0.110.0 || ^0.120.0 || ^0.124.0 || ^0.125.0 || ^0.127.0", "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@mastra/mcp": "^1.13.1" } }, "sha512-LcGxFzB0p4SEdnn0cueEXY3tQ6r8xIl2EeI/T7vxJf6rqjn3Ib9WNo7Srx2OpSgDFSqji4qakSU4eS355d65XQ=="],
 
     "@composio/claude-agent-sdk": ["@composio/claude-agent-sdk@0.12.1", "", { "dependencies": { "zod": "^4.5.4" }, "peerDependencies": { "@anthropic-ai/claude-agent-sdk": "^0.3.199", "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0" } }, "sha512-lHKvycugdyXnliURfNovzT0xQVvMpo5ulHsHEYOSRU++KiI9vGQ6bFFcVi+GAkxJy9FEz8TGmt/JkZ/3gs2MXQ=="],
 
     "@composio/client": ["@composio/client@2.0.0-rc.8", "", {}, "sha512-0C0Flmblx0Y3i6iGUY/MvST4aNXn3xEmPEA4wqZd3acm9x6u61/0i1LXCgBzFTTZEveK8YBFRu8Lpo/SMZwAFQ=="],
 
-    "@composio/core": ["@composio/core@0.21.0", "", { "dependencies": { "@composio/client": "2.0.0-rc.8", "@composio/json-schema-to-zod": "0.3.3", "@types/json-schema": "^7.0.15", "is-fs-case-sensitive": "^2.0.0", "openai": "^7.15.0", "picocolors": "^1.1.1", "pusher-js": "^8.6.0", "semver": "^7.8.5", "undici": "^7.29.1", "zod-to-json-schema": "^3.25.2" }, "peerDependencies": { "zod": ">=3.25.76 <5" } }, "sha512-fAgbqBdmYUbhIS/HWUtaUCG+QlPktyHXYbZwJ3xH7et5Pyw4YLQbw4UW+L7v4cQus8ijGgvjtmK7ZJL6tmWMmw=="],
+    "@composio/core": ["@composio/core@0.22.0", "", { "dependencies": { "@composio/client": "2.0.0-rc.8", "@composio/json-schema-to-zod": "0.3.3", "@types/json-schema": "^7.0.15", "is-fs-case-sensitive": "^2.0.0", "openai": "^7.21.0", "picocolors": "^1.1.1", "pusher-js": "^8.6.0", "semver": "^7.8.5", "undici": "^7.29.1", "zod-to-json-schema": "^3.25.2" }, "peerDependencies": { "zod": ">=3.25.76 <5" } }, "sha512-Inc7/yqhRQTfvU3km/VwSpewwJ9O/5mnC2FjSPDp56MfEdUfx61rwoi6+pancTUhHsHic5qe0lB4C2rHd7iioA=="],
 
-    "@composio/google": ["@composio/google@0.11.1", "", { "peerDependencies": { "@composio/core": ">=0.16.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@google/genai": "^1.1.0" } }, "sha512-xNQ5wesTRUXWKxTYfjGRX/Wtdiqno9up4AV+nY0qzt0NHSp7ExRG/0fkgWYUkXp3XeWi8mOZd9spo4RfI4YUJQ=="],
+    "@composio/google": ["@composio/google@0.12.0", "", { "peerDependencies": { "@composio/core": ">=0.16.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@google/genai": "^1.1.0" } }, "sha512-VYVd7F3Nu0b/bxZgQLMb2mR8A2bPNTSKBx3SqJtMOZsJ7Gayu7JE+ZmZtJq8fFXGUmGRoqpwoopwudNpq7GS+w=="],
 
     "@composio/json-schema-to-zod": ["@composio/json-schema-to-zod@0.3.3", "", { "dependencies": { "@cfworker/json-schema": "^4.1.1", "dequal": "^2.0.3" }, "peerDependencies": { "zod": ">=3.25.76 <5" } }, "sha512-QmgYo4IeK5/34Iqo1jSx6fSnLEyL++07FlW5Y6SfGFOhyb5htnY+vZPjs/tL8puJYhiEU7FV7kXdu5EAQoGrSA=="],
 
@@ -222,7 +222,7 @@
 
     "@composio/mastra": ["@composio/mastra@0.10.5", "", { "dependencies": { "@mastra/schema-compat": "^1.3.10" }, "peerDependencies": { "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "@mastra/core": "^1.46.0", "zod": "^3.25 || ^4" } }, "sha512-ev8r52HXpO9eOO8m0zeIY6I7DboiYUaBxpbsCzuC9lBaFU9b1r0en2NOAPtBvsHMpVtFl2LaTlhu6gm1lCBe+g=="],
 
-    "@composio/openai": ["@composio/openai@0.12.3", "", { "peerDependencies": { "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "openai": "^6.49.0 || ^7.0.0" } }, "sha512-F8wVZtsS+hrkmVzw3OX8vhMIGy1zMyPk/EXl2O/JbmID1sqka7fuWNjaGOXVjc+HXJd+9sTkk2+kAECio/qXRw=="],
+    "@composio/openai": ["@composio/openai@0.13.0", "", { "peerDependencies": { "@composio/core": ">=0.10.0 <1.0.0 || >=1.0.0-beta.0 <1.0.0", "openai": "^6.49.0 || ^7.0.0" } }, "sha512-uhKBeQ/r+ZIMUB+WPoXdqZdxFI4VeygS7wwSc6waOJceNb/aa0aFzgkHIe9HiiaPi3ie54G52wrCyfBoQgepQ
```

**File**: `docs/content/docs/sandbox/remote.mdx` (modified, +4/-0)
```diff
@@ -121,6 +121,10 @@ The mount exposes four methods:
 
 A `RemoteFile` carries the file's bytes and a presigned `downloadUrl`. Read it with `text()` or `buffer()`, or write it to disk with `save(path)`. Its `expiresAt` is when that download link expires, not a TTL on the file: the mount itself has no expiry you set.
 
+`save(path)` writes exactly where you point it and overwrites whatever is there. Call `save()` with no path and the file goes to `~/.composio/files/` under its name on the mount — and an existing file there survives: the new copy gets a number before its extension, so a second `report.pdf` saves as `report-1.pdf`. The returned path tells you which name was used.
+
+Mount paths come from the sandbox, so the SDK makes that default name safe to write before using it. Characters Windows reserves (`:`, `?`, `*`, and control characters) become `_`, over-long names are truncated with their extension kept, and trailing dots and spaces are dropped. Any name these rules changed also carries a short digest of the original, so `What is this?.png` and `What is this*.png` don't land on the same file.
+
 A `RemoteFile` download through `buffer()`, `blob()`, `text()`, or `save()` stops at 100 MiB, even
 when the server omits or misreports `Content-Length`. Connection failures and streamed-body failures
 raise `RemoteFileDownloadError`.
```

**File**: `docs/content/docs/tools-direct/executing-tools.mdx` (modified, +8/-0)
```diff
@@ -534,6 +534,14 @@ console.log(result);
   </Tab>
 </Tabs>
 
+Python names each downloaded file after the name in the tool response, made safe to write first:
+characters Windows reserves become `_`, an over-long name is truncated with its extension kept, and
+trailing dots and spaces are dropped. A name any of those rules changed also carries a short digest
+of the original, so two names that clean up the same way stay distinct. An existing file in the
+download directory is never replaced — the new download gets a number before its extension, so a
+second `report.pdf` lands as `report-1.pdf`. TypeScript names automatic downloads after the tool
+slug and a timestamp instead, so its names are already unique.
+
 Automatic S3 downloads stop at 100 MiB, even when the server omits or reports an incorrect
 `Content-Length`. Python removes partial files for transport and filesystem failures and raises
 `ErrorDownloadingFile`; oversized responses raise `ResponseTooLargeError`. In TypeScript, failed
```

**File**: `docs/package.json` (modified, +4/-4)
```diff
@@ -80,14 +80,14 @@
     "@ai-sdk/react": "^4.0.96",
     "@anthropic-ai/claude-agent-sdk": "^0.3.263",
     "@anthropic-ai/sdk": "^0.115.0",
-    "@composio/anthropic": "^0.11.2",
+    "@composio/anthropic": "^0.11.3",
     "@composio/claude-agent-sdk": "^0.12.1",
-    "@composio/core": "^0.21.0",
-    "@composio/google": "^0.11.1",
+    "@composio/core": "^0.22.0",
+    "@composio/google": "^0.12.0",
     "@composio/langchain": "^0.11.1",
     "@composio/llamaindex": "^0.11.1",
     "@composio/mastra": "^0.10.5",
-    "@composio/openai": "^0.12.3",
+    "@composio/openai": "^0.13.0",
     "@composio/openai-agents": "^0.11.1",
     "@composio/typesafe": "^0.1.1",
     "@composio/vercel": "^0.12.1",
```

---

### Incident Patch 8: `442699ac` (2026-09-30)
**Commit Message**: fix(sdk): write server-provided file names portably instead of rejecting them (#4690)

This PR:
- fixes ordinary file names rejected since
https://github.com/ComposioHQ/composio/pull/4487 (TS `RemoteFile.save()`
with no path) and https://github.com/ComposioHQ/composio/pull/4144
(Python automatic file downloads), e.g.
`report_2026-09-29T10:30:00.csv`, `What is this?.png`, `invoice
"final".pdf`, or a name over 128 bytes
- changes `safeBasename` / `safe_basename` to make unportable names
portable on every platform, with the same rules in the same order in
both SDKs:
  - Windows-reserved and control characters become `_`
  - device names get a `_` prefix (`NUL.txt` → `_NUL.txt`)
- names over 128 bytes are truncated by whole code points, keeping an
extension of up to 32 bytes
  - trailing spaces and dots are dropped, as Windows would
- a name any rule changed is tagged with a 64-bit FNV-1a digest of the
original before its extension (`report?.png` →
`report_-05fcb95aa5b918e9.png`), to distinguish ordinary normalization
collisions; already-portable names are unchanged
- prevents a literal server filename from spoofing a digest-tagged
destination: Python automatic downloads and default se

**File**: `.changeset/remote-file-portable-names.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@composio/core': patch
+---
+
+`RemoteFile.save()` without a path no longer rejects ordinary file names. Names with characters Windows reserves, such as `report_2026-09-29T10:30:00.csv` or `What is this?.png`, are saved with those characters replaced by `_`. Names longer than 128 bytes are truncated with their extension kept, and reserved device names such as `NUL` get a `_` prefix. A name changed this way also gets a short digest of the original before its extension (`What is this_-9c68adf2da8b6e8d.png`). Default saves create a new file exclusively; if the destination exists, a copy number is added before its extension. Repeated default saves therefore return distinct paths and preserve earlier downloads. Names with a NUL byte or no usable basename are still refused.
```

**File**: `python/composio/core/models/_files.py` (modified, +15/-5)
```diff
@@ -27,7 +27,7 @@
 )
 from composio.utils import mimetypes
 from composio.utils.json_schema import dereference_json_schema
-from composio.utils.safe_path import secure_basename_join, secure_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join, secure_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -716,8 +716,11 @@ def download(
             outfile = secure_basename_join(outdir, self.name, root=root)
         except UnsafePathComponentError as e:
             raise ErrorDownloadingFile(str(e)) from e
+        # A presigned storage URL can legitimately answer with a redirect (an S3
+        # region redirect, say), so it is followed, with every hop validated.
         try:
-            response = safe_get(
+            response = safe_request(
+                "GET",
                 self.s3url,
                 stream=True,
                 timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
@@ -745,12 +748,17 @@ def download(
             )
 
         total_bytes = 0
+        created = False
         try:
             # Only once the fetch is validated and connected, so a blocked URL
             # leaves no directory behind — and inside the `try`, so a failure
             # here still closes the response.
             outdir.mkdir(exist_ok=True, parents=True)
-            with outfile.open("wb") as fd:
+            # A literal server name can equal a digest-tagged name. Claim the
+            # path exclusively, then choose a numbered name if it exists.
+            outfile, fd = open_unique_file(outfile)
+            created = True
+            with fd:
                 for chunk in response.iter_content(chunk_size=chunk_size):
                     if chunk:
                         total_bytes += len(chunk)
@@ -763,14 +771,16 @@ def download(
         except ResponseTooLargeError:
             # Propagates uncaught — callers must see the limit hit — but the
             # truncated file must not be left behind as if it were the download.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise
         except OSError as e:
             # `requests.exceptions.RequestException` subclasses `OSError`, so a
             # mid-stream transport failure and a failing `fd.write`/`mkdir`
             # (disk full, permissions) both land here — and both owe the caller
             # the `ErrorDownloadingFile` this method documents.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise ErrorDownloadingFile(
                 "Error downloading file: "
                 f"{_sanitize_url_for_logging(self.s3url)}. Error: {type(e).__name__}"
```

**File**: `python/composio/core/models/tool_router_session_files.py` (modified, +14/-2)
```diff
@@ -28,7 +28,7 @@
     ValidationError,
 )
 from composio.utils.mimetypes import get_extension_from_mime_type
-from composio.utils.safe_path import secure_basename_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -232,6 +232,7 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
 
         Returns the absolute path where the file was saved.
         If path is omitted, saves to ~/.composio/files/ using the filename.
+        An existing default destination gets a copy number before its extension.
         """
         content = self.buffer()
         save_path: Path
@@ -256,7 +257,18 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
                 raise ValidationError(str(e)) from e
 
         save_path.parent.mkdir(parents=True, exist_ok=True)
-        save_path.write_bytes(content)
+        if path is not None:
+            save_path.write_bytes(content)
+        else:
+            save_path, fd = open_unique_file(save_path)
+            try:
+                with fd:
+                    fd.write(content)
+            except BaseException:
+                # The path was claimed for this save, so a failed write must
+                # not leave a partial file that a retry would number around.
+                save_path.unlink(missing_ok=True)
+                raise
         return str(save_path.resolve())
 
     @classmethod
```

**File**: `python/composio/utils/safe_path.py` (modified, +155/-51)
```diff
@@ -58,8 +58,16 @@
     | {f"LPT{i}" for i in "¹²³"}
 )
 """Reserved DOS device names. Writing to one on Windows targets the device
-rather than a file. Rejected on every platform so behaviour does not diverge
-between a POSIX developer machine and a Windows deployment."""
+rather than a file. Rejected as slugs and prefixed in filenames, on every
+platform, so behaviour does not diverge between a POSIX developer machine and a
+Windows deployment."""
+
+MAX_PRESERVED_EXTENSION_BYTES = 32
+"""Longest extension, in bytes and including its dot, that filename truncation
+keeps. Anything longer is not a real extension and is truncated with the rest."""
+
+_WINDOWS_INVALID_FILENAME_CHARS = re.compile(r'[\x00-\x1f<>:"|?*]')
+"""Control characters and characters reserved by Windows."""
 
 
 def is_inside_dir(child: Path, parent: Path) -> bool:
@@ -141,80 +149,176 @@ def assert_safe_path_component(value: str, *, label: str = "path component") ->
     return value
 
 
+def _encoded_length(value: str) -> int:
+    return len(os.fsencode(value))
+
+
+def _truncate_to_bytes(value: str, max_bytes: int) -> str:
+    """The longest prefix of ``value``, by whole code points, that fits in
+    ``max_bytes``."""
+    truncated = []
+    size = 0
+    for char in value:
+        size += _encoded_length(char)
+        if size > max_bytes:
+            break
+        truncated.append(char)
+    return "".join(truncated)
+
+
+def _split_extension(name: str) -> t.Tuple[str, str]:
+    """Split off a short trailing extension (with its dot); a leading dot is
+    not one."""
+    dot = name.rfind(".")
+    extension = name[dot:] if dot > 0 else ""
+    if extension and _encoded_length(extension) <= MAX_PRESERVED_EXTENSION_BYTES:
+        return name[:dot], extension
+    return name, ""
+
+
+def _fit_filename_bytes(name: str, max_bytes: int = MAX_COMPONENT_LENGTH) -> str:
+    """Truncate ``name`` to ``max_bytes``, keeping a short extension so the file
+    still opens with the right application."""
+    if _encoded_length(name) <= max_bytes:
+        return name
+    stem, extension = _split_extension(name)
+    return _truncate_to_bytes(stem, max_bytes - _encoded_length(extension)) + extension
+
+
+def numbered_basename(name: str, copy: int) -> str:
+    """Add a copy number before the extension within the filename byte limit."""
+    suffix = f"-{copy}"
+    stem, extension = _split_extension(name)
+    return (
+        _truncate_to_bytes(
+            stem, MAX_COMPONENT_LENGTH - _encoded_length(extension) - len(suffix)
+        )
+        + suffix
+        + extension
+    )
+
+
+def open_unique_file(path: Path) -> t.Tuple[Path, t.BinaryIO]:
+    """Claim a validated download path without replacing an existing file.
+
+    Numbered alternatives stay in the same directory and preserve a short
+    extension. Exclusive creation also prevents concurrent saves from sharing
+    a destination.
+    """
+    copy = 0
+    while True:
+        candidate = (
+            path if copy == 0 else path.with_name(numbered_basename(path.name, copy))
+        )
+        try:
+            return candidate, candidate.open("xb")
+        except FileExistsError:
+            copy += 1
+
+
+_FNV_OFFSET_BASIS_64 = 0xCBF29CE484222325
+_FNV_PRIME_64 = 0x100000001B3
+_UINT64_MASK = 0xFFFFFFFFFFFFFFFF
+
+
+def _fnv1a64_hex(value: str) -> str:
+    """64-bit FNV-1a of the UTF-8 bytes, as 16 hex digits. ``fnv1a64Hex`` in
+    the TypeScript SDK matches it."""
+    digest = _FNV_OFFSET_BASIS_64
+    for byte in value.encode("utf-8", "surrogatepass"):
+        digest = ((digest ^ byte) * _FNV_PRIME_64) & _UINT64_MASK
+    return f"{digest:016x}"
+
+
+def _tag_with_original(portable: str, original: str) -> str:
+    """Tag a name that portability changed with a digest of the name it came
+    from, before the extension: ``report?.png`` and ``report*.png`` both become
+    ``report_.png``, and two long names can share a truncated prefix, so
+    without the tag one download would overwrite the other in a shared
+    directory."""
+    tag = f"-{_fnv1a64_hex(original)}"
+    stem, extension = _split_extension(
+        _fit_filename_bytes(portable, MAX_COMPONENT_LENGTH - len(tag))
+    )
+    return stem + tag + extension
+
+
 def safe_basename(name: str, *, label: str = "filename") -> str:
-    """Collapse an untrusted filename to a bare, writable basename.
+    """Collapse an untrusted filename to a bare basename that is safe to write
+    on every platform.
 
     Filenames need their own validator: :func:`assert_safe_path_component`
-    forbids ``.``, which nearly every real filename contains. This applies the
-    remaining checks — no separators, no traversal, no NUL, bounded length, no
-    reserved device name — to the one component a server most directly controls.
+    forbids ``.``, which nearly every real filename contains.
 
     ``PureWindowsPath`` treats both ``/`` and ``\\`` as separators, so a name
     crafted for a Windows target (``..\\..\
```

**File**: `python/tests/test_files.py` (modified, +143/-52)
```diff
@@ -2659,7 +2659,7 @@ def _downloadable() -> FileDownloadable:
             s3url="https://example.com/report.bin",
         )
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_rejects_oversized_content_length(self, mock_get, tmp_path):
         """A self-declared oversized body is rejected before any bytes are read."""
         mock_response = MagicMock()
@@ -2673,7 +2673,7 @@ def test_download_rejects_oversized_content_length(self, mock_get, tmp_path):
 
         mock_response.iter_content.assert_not_called()
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_rejects_oversized_during_streaming(self, mock_get, tmp_path):
         """A dishonest (here, absent) Content-Length cannot bypass the cap."""
         mock_response = MagicMock()
@@ -2686,8 +2686,11 @@ def test_download_rejects_oversized_during_streaming(self, mock_get, tmp_path):
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
-    @patch("composio.core.models._files.safe_get")
-    def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
+    @pytest.mark.parametrize("existing", [False, True])
+    @patch("composio.core.models._files.safe_request")
+    def test_download_removes_partial_file_on_failure(
+        self, mock_get, tmp_path, existing
+    ):
         """A truncated download must not be left behind as if it succeeded."""
         mock_response = MagicMock()
         mock_response.status_code = 200
@@ -2696,12 +2699,19 @@ def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
         mock_response.close = MagicMock()
         mock_get.return_value = mock_response
 
+        if existing:
+            (tmp_path / "report.bin").write_bytes(b"original")
+
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
-        assert list(tmp_path.iterdir()) == []
+        if existing:
+            assert list(tmp_path.iterdir()) == [tmp_path / "report.bin"]
+            assert (tmp_path / "report.bin").read_bytes() == b"original"
+        else:
+            assert list(tmp_path.iterdir()) == []
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_accepts_file_within_limit(self, mock_get, tmp_path):
         """A body under the cap is written through unchanged."""
         mock_response = MagicMock()
@@ -2718,7 +2728,7 @@ def test_download_accepts_file_within_limit(self, mock_get, tmp_path):
         assert outfile.exists()
         assert outfile.read_bytes() == b"x" * 256 + b"y" * 256
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_wraps_stream_failure_and_removes_partial_file(
         self, mock_get, tmp_path
     ):
@@ -2740,7 +2750,7 @@ def failing_stream(chunk_size=None):
 
         assert list(tmp_path.iterdir()) == []
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_wraps_write_failure_and_removes_partial_file(
         self, mock_get, tmp_path
     ):
@@ -2942,7 +2952,7 @@ def test_relative_traversal_is_neutralized(self, tmp_path):
             s3url="https://example.com/file",
         )
         with patch(
-            "composio.core.models._files.safe_get",
+            "composio.core.models._files.safe_request",
             return_value=self._mock_response(b"#!/bin/sh\n"),
         ):
             written = f.download(outdir, root=outdir)
@@ -2961,7 +2971,7 @@ def test_absolute_path_is_neutralized(self, tmp_path):
             s3url="https://example.com/file",
         )
         with patch(
-            "composio.core.models._files.safe_get",
+            "composio.core.models._files.safe_request",
             return_value=self._mock_response(b"x"),
         ):
             written = f.download(outdir, root=outdir)
@@ -2982,7 +2992,7 @@ def test_dotdot_only_name_is_rejected(self, tmp_path):
             s3url="https://example.com/file",
         )
         with patch(
-            "composio.core.models._files.safe_get",
+            "composio.core.models._files.safe_request",
             return_value=self._mock_response(),
         ):
             with pytest.raises(ErrorDownloadingFile, match="Path traversal detected"):
@@ -2998,7 +3008,7 @@ def test_safe_filename_passes_through(self, tmp_path):
             s3url="https://example.com/file",
         )
         with patch(
-            "composio.core.models._files.safe_get",
+            "composio.core.models._files.safe_request",
             return_value=self._mock_response(b"%PDF-1.4"),
         ):
             written = f.download(outdir, root=out
```

**File**: `python/tests/test_path_join_guardrail.py` (modified, +8/-3)
```diff
@@ -125,9 +125,14 @@ def _reviewed_path(
         "composio/utils/safe_path.py",
         "PureWindowsPath(name)",
     ): _reviewed_path(
-        "`safe_basename` collapses the value, rejects Windows-invalid forms, checks "
-        "its encoded length, and rejects reserved device names.",
-        "fsencode",
+        "`safe_basename` collapses the value, rejects NUL bytes and invalid "
+        "Unicode, rewrites Windows-invalid forms and reserved device names, fits "
+        "the encoded length, and tags a rewritten name with a digest of the "
+        "original to distinguish ordinary normalization collisions. Download "
+        "writes create files exclusively to preserve existing destinations.",
+        "_encoded_length",
+        "_fit_filename_bytes",
+        "_tag_with_original",
     ),
     (
         "composio/utils/safe_path.py",
```

**File**: `python/tests/test_safe_path.py` (modified, +130/-18)
```diff
@@ -4,13 +4,15 @@
 root rather than on a directory the input helped build.
 """
 
+import re
 import sys
 from pathlib import Path
 
 import pytest
 
 from composio.exceptions import UnsafePathComponentError
 from composio.utils.safe_path import (
+    MAX_COMPONENT_LENGTH,
     SAFE_COMPONENT_REGEX,
     assert_safe_path_component,
     is_inside_dir,
@@ -138,6 +140,16 @@ def test_case_insensitive_on_windows(self):
         assert is_inside_dir(Path("C:\\Foo\\Bar"), Path("c:\\foo"))
 
 
+TAG_BYTES = 17
+"""Bytes a changed name gains: ``-`` and 16 hex digits of the original's
+digest."""
+
+
+def tagged(stem: str, extension: str = "") -> "re.Pattern[str]":
+    """Match ``stem``, the digest tag of a changed name, then ``extension``."""
+    return re.compile(re.escape(stem) + "-[0-9a-f]{16}" + re.escape(extension))
+
+
 class TestSafeBasename:
     @pytest.mark.parametrize(
         ("value", "expected"),
@@ -148,6 +160,8 @@ class TestSafeBasename:
             (".gitignore", ".gitignore"),
             ("..\\..\\evil", "evil"),
             (" report.pdf", "report.pdf"),
+            ("report.pdf ", "report.pdf"),
+            ("\x1creport.txt\x1f", "report.txt"),
             ("café.txt", "café.txt"),
             ("C:report.txt", "report.txt"),
             ("\ufeffreport.txt", "\ufeffreport.txt"),
@@ -172,32 +186,130 @@ def test_rejects_whitespace_wrapped_dot_runs(self, value):
         with pytest.raises(UnsafePathComponentError, match="no usable basename"):
             safe_basename(value)
 
+    @pytest.mark.parametrize("value", [". .", ".. ", " . . "])
+    def test_rejects_dot_runs_once_windows_trims_them(self, value):
+        with pytest.raises(UnsafePathComponentError, match="no usable basename"):
+            safe_basename(value)
+
+    def test_rejects_nul_byte(self):
+        with pytest.raises(UnsafePathComponentError, match="NUL byte"):
+            safe_basename("report\x00.pdf")
+
     @pytest.mark.parametrize(
-        "value",
-        ["NUL.tar.gz", "COM1.log.bak", "COM¹.txt", "LPT³.data"],
+        ("value", "stem", "extension"),
+        [
+            ("report_2026-09-29T10:30:00.csv", "report_2026-09-29T10_30_00", ".csv"),
+            ("What is this?.png", "What is this_", ".png"),
+            ('invoice "final".pdf', "invoice _final_", ".pdf"),
+            ("report.txt:payload", "report", ".txt_payload"),
+            ("report<1>.txt", "report_1_", ".txt"),
+            ("a|b*.txt", "a_b_", ".txt"),
+            ("tab\there.txt", "tab_here", ".txt"),
+            ("output/C:report.txt", "C_report", ".txt"),
+        ],
     )
-    def test_rejects_windows_device_names_with_any_extension(self, value):
-        with pytest.raises(UnsafePathComponentError, match="reserved device name"):
-            safe_basename(value)
+    def test_replaces_windows_reserved_characters(self, value, stem, extension):
+        assert tagged(stem, extension).fullmatch(safe_basename(value))
 
     @pytest.mark.parametrize(
-        "value",
+        ("value", "stem", "extension"),
         [
-            "report?.txt",
-            "report.txt:payload",
-            "report.txt.",
-            "report.txt ",
-            "report.\u00a0",
-            "report.\u0085",
+            ("report.txt.", "report", ".txt"),
+            ("report. .", "report", ""),
+            ("report.\u00a0", "report", ""),
+            ("report.\u0085", "report", ""),
+            ("\ufeff..", "\ufeff", ""),
         ],
     )
-    def test_rejects_windows_invalid_names_on_every_platform(self, value):
-        with pytest.raises(UnsafePathComponentError):
-            safe_basename(value)
+    def test_drops_trailing_spaces_and_dots(self, value, stem, extension):
+        assert tagged(stem, extension).fullmatch(safe_basename(value))
 
-    def test_limits_encoded_filename_bytes(self):
-        with pytest.raises(UnsafePathComponentError, match="longer than"):
-            safe_basename("😀" * 128)
+    @pytest.mark.parametrize(
+        ("value", "stem", "extension"),
+        [
+            ("NUL", "_NUL", ""),
+            ("nul", "_nul", ""),
+            ("NUL.tar.gz", "_NUL.tar", ".gz"),
+            ("COM1.log.bak", "_COM1.log", ".bak"),
+            ("COM¹.txt", "_COM¹", ".txt"),
+            ("LPT³.data", "_LPT³", ".data"),
+            ("aux.txt", "_aux", ".txt"),
+            ("CON .txt", "_CON ", ".txt"),
+            ("COM1:.txt", "COM1_", ".txt"),
+        ],
+    )
+    def test_prefixes_windows_device_names_with_any_extension(
+        self, value, stem, extension
+    ):
+        assert tagged(stem, extension).fullmatch(safe_basename(value))
+
+    def test_prefixes_a_device_name_exposed_by_truncation(self):
+        # Truncation keeps `NUL` plus spaces before `.txt`, and Windows ignores
+        # the spaces, so the checked name must be the fitted one.
+        spaces = " " * (MAX_COMPONENT_LENGTH - TAG_BYTES - 8)
+        assert tagged("_NUL" + spaces, ".txt").fullmatch(
+            safe_basename("NUL" 
```

**File**: `python/tests/test_tool_router_session_files.py` (modified, +64/-6)
```diff
@@ -352,19 +352,77 @@ def test_save_default_location_rejects_unusable_basename(
 
         assert not (tmp_path / ".composio").exists()
 
-    @pytest.mark.parametrize("mount_relative_path", ["report.\u00a0", "report.\u0085"])
-    def test_save_rejects_dot_exposed_by_stripping(self, tmp_path, mount_relative_path):
+    @pytest.mark.parametrize(
+        ("mount_relative_path", "expected"),
+        [
+            ("report.\u00a0", "report-11aada8ba3168adf"),
+            (
+                "out/report_2026-09-29T10:30:00.csv",
+                "report_2026-09-29T10_30_00-d7211bb25cb815fe.csv",
+            ),
+            ("What is this?.png", "What is this_-9c68adf2da8b6e8d.png"),
+        ],
+    )
+    def test_save_makes_unportable_names_portable(
+        self, tmp_path, mount_relative_path, expected
+    ):
         rf = RemoteFile(
             expires_at="2026-01-01",
             mount_relative_path=mount_relative_path,
             sandbox_mount_prefix="/mnt/files",
             download_url="https://example.com/file",
         )
-        with patch.object(rf, "buffer", return_value=b"should not be written"):
+        with patch.object(rf, "buffer", return_value=b"content"):
             with patch("pathlib.Path.home", return_value=tmp_path):
-                with pytest.raises(ValidationError, match="ending in a space or dot"):
-                    rf.save()
-        assert not (tmp_path / ".composio").exists()
+                saved = Path(rf.save())
+        assert saved.name == expected
+        assert saved.read_bytes() == b"content"
+
+    @pytest.mark.parametrize(
+        "names",
+        [
+            ["report?.png", "report_-05fcb95aa5b918e9.png"],
+            ["report_-05fcb95aa5b918e9.png", "report?.png"],
+            ["請" * 41 + ".pdf"] * 3,
+        ],
+    )
+    def test_default_save_preserves_files_with_colliding_names(self, names, tmp_path):
+        paths = []
+        with patch("pathlib.Path.home", return_value=tmp_path):
+            for index, name in enumerate(names):
+                file = RemoteFile(
+                    expires_at="2026-01-01",
+                    mount_relative_path=name,
+                    sandbox_mount_prefix="/mnt/files",
+                    download_url="https://example.com/file",
+                )
+                with patch.object(file, "buffer", return_value=bytes([index])):
+                    paths.append(Path(file.save()))
+
+        assert len(set(paths)) == len(names)
+        assert [path.read_bytes() for path in paths] == [
+            bytes([i]) for i in range(len(names))
+        ]
+        assert all(len(path.name.encode()) <= 128 for path in paths)
+        assert all(path.suffix == Path(names[0]).suffix for path in paths)
+
+    def test_failed_default_save_leaves_no_file_behind(self, tmp_path):
+        file = RemoteFile(
+            expires_at="2026-01-01",
+            mount_relative_path="report.pdf",
+            sandbox_mount_prefix="/mnt/files",
+            download_url="https://example.com/file",
+        )
+        with patch("pathlib.Path.home", return_value=tmp_path):
+            # Writing `str` to the binary file fails after the path is claimed.
+            with patch.object(file, "buffer", return_value="not bytes"):
+                with pytest.raises(TypeError):
+                    file.save()
+            with patch.object(file, "buffer", return_value=b"content"):
+                saved = Path(file.save())
+
+        assert saved.name == "report.pdf"
+        assert [path.name for path in saved.parent.iterdir()] == ["report.pdf"]
 
 
 class TestResponseDerivedUrlsAreGuarded:
```

---

### Incident Patch 9: `3f43cb5b` (2026-09-30)
**Commit Message**: fix(core): remove a claimed download file when closing it fails

**File**: `ts/packages/core/src/platform/node.ts` (modified, +10/-8)
```diff
@@ -111,15 +111,17 @@ export const platform = {
 
   writeFileExclusiveSync(filePath: string, content: Uint8Array): void {
     const fd = fs.openSync(filePath, 'wx');
-    let written = false;
     try {
-      fs.writeFileSync(fd, content);
-      written = true;
-    } finally {
-      fs.closeSync(fd);
-      // The path was created here, so a failed write must not leave a
-      // partial file that a retry would treat as an existing download.
-      if (!written) fs.rmSync(filePath, { force: true });
+      try {
+        fs.writeFileSync(fd, content);
+      } finally {
+        fs.closeSync(fd);
+      }
+    } catch (error) {
+      // The path was created here, so a failed write or close must not leave
+      // a partial file that a retry would treat as an existing download.
+      fs.rmSync(filePath, { force: true });
+      throw error;
     }
   },
 } as Platform;
```

**File**: `ts/packages/core/test/platform/node.test.ts` (modified, +25/-1)
```diff
@@ -7,7 +7,11 @@ import { platform } from '../../src/platform/node';
 
 vi.mock('node:fs', async importOriginal => {
   const actual = await importOriginal<typeof import('node:fs')>();
-  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
+  return {
+    ...actual,
+    closeSync: vi.fn(actual.closeSync),
+    writeFileSync: vi.fn(actual.writeFileSync),
+  };
 });
 
 const invertAsciiCase = (value: string): string =>
@@ -63,6 +67,26 @@ describe('node platform exclusive writes', () => {
     }
   });
 
+  it('removes the file it created when closing it fails', () => {
+    const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
+    try {
+      const filePath = path.join(root, 'report.pdf');
+      const actual = vi.mocked(fs.closeSync).getMockImplementation()!;
+      // Some filesystems report a deferred write error only on close.
+      vi.mocked(fs.closeSync).mockImplementationOnce(fd => {
+        actual(fd);
+        throw Object.assign(new Error('disk quota exceeded'), { code: 'EDQUOT' });
+      });
+
+      expect(() => platform.writeFileExclusiveSync(filePath, new Uint8Array([1, 2]))).toThrow(
+        'disk quota exceeded'
+      );
+      expect(existsSync(filePath)).toBe(false);
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
+
   it('leaves an existing file untouched', () => {
     const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
     try {
```

---

### Incident Patch 10: `4257b990` (2026-09-30)
**Commit Message**: fix(sdk): remove a claimed download file when its write fails

**File**: `python/composio/core/models/tool_router_session_files.py` (modified, +8/-2)
```diff
@@ -261,8 +261,14 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
             save_path.write_bytes(content)
         else:
             save_path, fd = open_unique_file(save_path)
-            with fd:
-                fd.write(content)
+            try:
+                with fd:
+                    fd.write(content)
+            except BaseException:
+                # The path was claimed for this save, so a failed write must
+                # not leave a partial file that a retry would number around.
+                save_path.unlink(missing_ok=True)
+                raise
         return str(save_path.resolve())
 
     @classmethod
```

**File**: `python/tests/test_tool_router_session_files.py` (modified, +18/-0)
```diff
@@ -406,6 +406,24 @@ def test_default_save_preserves_files_with_colliding_names(self, names, tmp_path
         assert all(len(path.name.encode()) <= 128 for path in paths)
         assert all(path.suffix == Path(names[0]).suffix for path in paths)
 
+    def test_failed_default_save_leaves_no_file_behind(self, tmp_path):
+        file = RemoteFile(
+            expires_at="2026-01-01",
+            mount_relative_path="report.pdf",
+            sandbox_mount_prefix="/mnt/files",
+            download_url="https://example.com/file",
+        )
+        with patch("pathlib.Path.home", return_value=tmp_path):
+            # Writing `str` to the binary file fails after the path is claimed.
+            with patch.object(file, "buffer", return_value="not bytes"):
+                with pytest.raises(TypeError):
+                    file.save()
+            with patch.object(file, "buffer", return_value=b"content"):
+                saved = Path(file.save())
+
+        assert saved.name == "report.pdf"
+        assert [path.name for path in saved.parent.iterdir()] == ["report.pdf"]
+
 
 class TestResponseDerivedUrlsAreGuarded:
     """`download_url` and `upload_url` are response fields, so they are guarded.
```

**File**: `ts/packages/core/src/platform/node.ts` (modified, +11/-1)
```diff
@@ -110,6 +110,16 @@ export const platform = {
   },
 
   writeFileExclusiveSync(filePath: string, content: Uint8Array): void {
-    fs.writeFileSync(filePath, content, { flag: 'wx' });
+    const fd = fs.openSync(filePath, 'wx');
+    let written = false;
+    try {
+      fs.writeFileSync(fd, content);
+      written = true;
+    } finally {
+      fs.closeSync(fd);
+      // The path was created here, so a failed write must not leave a
+      // partial file that a retry would treat as an existing download.
+      if (!written) fs.rmSync(filePath, { force: true });
+    }
   },
 } as Platform;
```

**File**: `ts/packages/core/src/platform/types.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export interface Platform {
   writeFileSync(filePath: string, content: Uint8Array, encoding?: never): void;
   writeFileSync(filePath: string, content: string, encoding: Uint8ArrayEncoding): void;
 
-  /** Writes a new file, failing if its path already exists. */
+  /** Writes a new file, failing if its path already exists. A failed write removes the file. */
   writeFileExclusiveSync(filePath: string, content: Uint8Array): void;
 
   /**
```

**File**: `ts/packages/core/test/platform/node.test.ts` (modified, +43/-2)
```diff
@@ -1,9 +1,15 @@
-import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import * as fs from 'node:fs';
+import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
-import { describe, expect, it } from 'vitest';
+import { describe, expect, it, vi } from 'vitest';
 import { platform } from '../../src/platform/node';
 
+vi.mock('node:fs', async importOriginal => {
+  const actual = await importOriginal<typeof import('node:fs')>();
+  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
+});
+
 const invertAsciiCase = (value: string): string =>
   [...value]
     .map(character => {
@@ -35,3 +41,38 @@ describe('node platform filesystem case detection', () => {
     }
   });
 });
+
+describe('node platform exclusive writes', () => {
+  it('removes the file it created when the write fails', () => {
+    const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
+    try {
+      const filePath = path.join(root, 'report.pdf');
+      const actual = vi.mocked(fs.writeFileSync).getMockImplementation()!;
+      // A disk that fills up mid-write: some bytes land, then the write fails.
+      vi.mocked(fs.writeFileSync).mockImplementationOnce((file, data, options) => {
+        actual(file, (data as Uint8Array).subarray(0, 1), options);
+        throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
+      });
+
+      expect(() => platform.writeFileExclusiveSync(filePath, new Uint8Array([1, 2]))).toThrow(
+        'no space left on device'
+      );
+      expect(existsSync(filePath)).toBe(false);
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
+
+  it('leaves an existing file untouched', () => {
+    const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
+    try {
+      const filePath = path.join(root, 'report.pdf');
+      writeFileSync(filePath, 'original');
+
+      expect(() => platform.writeFileExclusiveSync(filePath, new Uint8Array([1]))).toThrow();
+      expect(readFileSync(filePath, 'utf8')).toBe('original');
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
+});
```

---

### Incident Patch 11: `a1e7a6f7` (2026-09-30)
**Commit Message**: fix(json-schema-to-zod): keep guarded tool schemas as objects (#4686)

This PR:
- fixes two regressions from
https://github.com/ComposioHQ/composio/pull/4316 in the whole-schema
guard
- keeps the converted schema's Zod kind: guarded nodes now subclass
their own class instead of `z.any().pipe(...)`, so an object tool schema
stays a `ZodObject` with a `shape`
- LangChain, Vercel, and LlamaIndex emitted
`{"allOf":[{},{"type":"object",...}]}` for any tool with
`anyOf`/`oneOf`/`allOf`/`$ref`/… anywhere; OpenAI returned 400 `schema
must be a JSON Schema of 'type: "object"'` and Anthropic returned 400
`input_schema.type: Field required`
- Claude Agent SDK (MCP `tools/list`) collapsed those tools to empty
parameters
- gives the guard's interpreter Unicode-mode spellings of patterns
(`toUnicodePattern`): `@cfworker/json-schema` compiles with the `u`
flag, so identity escapes like `\_` failed every call with `Invalid
regular expression … Invalid escape`
- keeps the guard validating raw input before defaults, composes nested
guards, and survives `.describe()`
- adds regression tests in `test/semantic-regressions.test.ts` (both
fail on `next`)

## Verification

- live calls through the LangCha

**File**: `.changeset/json-schema-to-zod-object-root.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@composio/json-schema-to-zod': patch
+'@composio/core': patch
+---
+
+Fix tool schemas rejected by OpenAI and Anthropic when a parameter uses `anyOf`, `oneOf`, `allOf`, `$ref`, or similar keywords. The converted schema is a `ZodObject` again, so the LangChain, Vercel, LlamaIndex, and Claude Agent SDK providers send tool parameters with a top-level `type: "object"`. Patterns with escapes such as `\_` or `\:` no longer fail every call to the tool.
```

**File**: `ts/packages/json-schema-to-zod/src/utils/unicode-pattern.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+const compilesAsUnicode = (pattern: string): boolean => {
+  try {
+    new RegExp(pattern, 'u');
+    return true;
+  } catch {
+    return false;
+  }
+};
+
+const REGEX_SYNTAX_CHARACTERS = new Set('^$\\.*+?()[]{}|/');
+const CHARACTER_CLASS_ESCAPES = new Set('dDwWsS');
+const CONTROL_ESCAPES = new Set('fnrtv');
+const HEX_DIGIT = /^[0-9A-Fa-f]$/;
+const QUANTIFIER = /^\{\d+(?:,\d*)?\}/;
+
+const hexEscape = (code: number): string => `\\x${code.toString(16).padStart(2, '0')}`;
+
+/** Capturing group count and whether any is named, as the parser counts them. */
+const scanGroups = (pattern: string): { count: number; named: boolean } => {
+  let count = 0;
+  let named = false;
+  let inClass = false;
+  for (let index = 0; index < pattern.length; index++) {
+    const char = pattern[index];
+    if (char === '\\') {
+      index++;
+    } else if (inClass) {
+      inClass = char !== ']';
+    } else if (char === '[') {
+      inClass = true;
+    } else if (char === '(') {
+      if (pattern[index + 1] !== '?') {
+        count++;
+      } else if (pattern[index + 2] === '<' && !'=!'.includes(pattern[index + 3] ?? '')) {
+        count++;
+        named = true;
+      }
+    }
+  }
+  return { count, named };
+};
+
+/**
+ * A legacy octal escape (a `\` digit sequence that is not a backreference) as
+ * a hex escape. Returns the replacement and how many digits it consumed.
+ */
+const legacyOctalEscape = (pattern: string, index: number): [string, number] => {
+  const first = pattern[index];
+  if (first === '8' || first === '9') {
+    return [first, 1];
+  }
+  const maxDigits = first <= '3' ? 3 : 2;
+  let digits = first;
+  while (digits.length < maxDigits && /^[0-7]$/.test(pattern[index + digits.length] ?? '')) {
+    digits += pattern[index + digits.length];
+  }
+  return [hexEscape(parseInt(digits, 8)), digits.length];
+};
+
+/**
+ * The interpreter compiles every pattern with the `u` flag, while
+ * `compilePattern` and the native parsers deliberately do not. This spells a
+ * pattern written for the legacy (Annex B) grammar in the Unicode grammar with
+ * the same meaning: identity escapes such as `\_`, `\:` or `\k` become the
+ * literal character, incomplete `\x`, `\u` and `\c` escapes and legacy octal
+ * escapes are spelled out, lone `{`, `}` and `]` are escaped, and a hyphen
+ * next to a class escape (`[\w-.]`), which is a literal there, is escaped.
+ *
+ * Returns `undefined` for the few legacy constructs with no Unicode spelling,
+ * such as a quantified lookahead. Matching differs only for astral
+ * characters, which `.` and negated classes treat as one character, not two.
+ */
+export const toUnicodePattern = (pattern: string): string | undefined => {
+  const { count: groupCount, named: hasNamedGroups } = scanGroups(pattern);
+
+  let rewritten = '';
+  let inClass = false;
+  let previousAtomWasClassEscape = false;
+  let index = 0;
+  while (index < pattern.length) {
+    const char = pattern[index];
+
+    if (char !== '\\' && inClass) {
+      if (char === ']') {
+        inClass = false;
+        rewritten += char;
+      } else if (
+        char === '-' &&
+        (previousAtomWasClassEscape ||
+          (pattern[index + 1] === '\\' && CHARACTER_CLASS_ESCAPES.has(pattern[index + 2] ?? '')))
+      ) {
+        rewritten += '\\-';
+      } else {
+        rewritten += char;
+      }
+      previousAtomWasClassEscape = false;
+      index++;
+      continue;
+    }
+
+    if (char !== '\\') {
+      const quantifier = char === '{' ? QUANTIFIER.exec(pattern.slice(index)) : null;
+      if (char === '[') {
+        inClass = true;
+        const opening = pattern[index + 1] === '^' ? '[^' : '[';
+        rewritten += opening;
+        index += opening.length;
+      } else if (quantifier) {
+        rewritten += quantifier[0];
+        index += quantifier[0].length;
+      } else {
+        rewritten += char === '{' || char === '}' || char === ']' ? `\\${char}` : char;
+        index++;
+      }
+      continue;
+    }
+
+    const escaped = pattern[index + 1];
+    if (escaped === undefined) {
+      return undefined;
+    }
+    previousAtomWasClassEscape = false;
+
+    if (CHARACTER_CLASS_ESCAPES.has(escaped)) {
+      previousAtomWasClassEscape = inClass;
+      rewritten += `\\${escaped}`;
+      index += 2;
+    } else if (
+      CONTROL_ESCAPES.has(escaped) ||
+      REGEX_SYNTAX_CHARACTERS.has(escaped) ||
+      escaped === 'b' ||
+      (escaped === 'B' && !inClass) ||
+      (escaped === '-' && inClass) ||
+      (escaped === 'k' && hasNamedGroups && !inClass)
+    ) {
+      rewritten += `\\${escaped}`;
+      index += 2;
+    } else if (escaped === 'c') {
+      const letter = pattern[index + 2] ?? '';
+      if (/^[A-Za-z]$/.test(letter)) {
+        rewritten += `\\c${letter}`;
+        index += 3;
+      } else if (inClass && /^[0-9_]$/.test(letter)) {
+        rewritten += hexEscape(letter.charCodeAt(0) % 32);
+        index += 3;
+      } else
```

**File**: `ts/packages/json-schema-to-zod/src/whole-schema-validation.ts` (modified, +240/-33)
```diff
@@ -1,8 +1,9 @@
-import { encodePointer, Validator } from '@cfworker/json-schema';
+import { encodePointer, format, Validator } from '@cfworker/json-schema';
 import type { Schema as InterpreterSchema } from '@cfworker/json-schema';
 import { z } from 'zod/v3';
 
 import type { JsonSchema, JsonSchemaObject } from './types';
+import { toUnicodePattern } from './utils/unicode-pattern';
 
 const REQUIRES_WHOLE_SCHEMA_VALIDATION = new Set([
   '$ref',
@@ -161,12 +162,149 @@ export const guardSchemaAt = (
       { ...refs.root, $ref: `#/${refs.path.map(part => encodePointer(String(part))).join('/')}` }
     : node;
 
+const patternKeyRenames = new WeakMap<object, ReadonlyMap<string, string>>();
+
+/**
+ * The Unicode spelling of each `patternProperties` key. Two keys that spell
+ * the same way (`^a\_b$` and `^a_b$`) stay separate entries: the later one is
+ * wrapped in a non-capturing group, which matches the same names, so neither
+ * value schema is dropped. A key with no Unicode spelling is kept as is and
+ * surfaces as a guard failure rather than an unenforced constraint.
+ */
+const renamePatternKeys = (patternProperties: object): ReadonlyMap<string, string> => {
+  const cached = patternKeyRenames.get(patternProperties);
+  if (cached) {
+    return cached;
+  }
+
+  const renames = new Map<string, string>();
+  const used = new Set<string>();
+  for (const key of Object.keys(patternProperties)) {
+    let renamed = toUnicodePattern(key) ?? key;
+    while (used.has(renamed)) {
+      renamed = `(?:${renamed})`;
+    }
+    used.add(renamed);
+    renames.set(key, renamed);
+  }
+  patternKeyRenames.set(patternProperties, renames);
+  return renames;
+};
+
+const decodePointerSegment = (segment: string): string => {
+  try {
+    return decodeURI(segment).replace(/~1/g, '/').replace(/~0/g, '~');
+  } catch {
+    return segment;
+  }
+};
+
+/**
+ * What a JSON Pointer segment addresses: a keyword of a schema, a name in a
+ * keyword's map (`properties`, `$defs`, ...), a `patternProperties` key, an
+ * index into a schema array, or something that holds no schemas.
+ */
+type PointerPosition = 'keyword' | 'name' | 'patternKey' | 'index' | 'other';
+
+const positionAfter = (position: PointerPosition, key: string, child: unknown): PointerPosition => {
+  if (position !== 'keyword') {
+    return position === 'other' ? 'other' : 'keyword';
+  }
+  if (key === 'patternProperties') {
+    return 'patternKey';
+  }
+  if (SCHEMA_MAP_KEYWORDS.has(key)) {
+    return 'name';
+  }
+  if (SCHEMA_ARRAY_KEYWORDS.has(key) || (SCHEMA_VALUE_KEYWORDS.has(key) && Array.isArray(child))) {
+    return 'index';
+  }
+  return SCHEMA_VALUE_KEYWORDS.has(key) ? 'keyword' : 'other';
+};
+
+/**
+ * A local `$ref` rewritten to address the renamed `patternProperties` keys of
+ * the interpreter copy. `root` is the unrenamed document it points into. Only
+ * a segment in keyword position is a keyword, so a definition that happens to
+ * be named `patternProperties` is not mistaken for one.
+ */
+const renameRefThroughPatternKeys = (ref: string, root: unknown): string => {
+  if (!ref.startsWith('#/')) {
+    return ref;
+  }
+
+  let node: unknown = root;
+  let position: PointerPosition = 'keyword';
+  let changed = false;
+  const renamed = ref
+    .slice(2)
+    .split('/')
+    .map(segment => {
+      const key = decodePointerSegment(segment);
+      let result = segment;
+      if (position === 'patternKey' && isObject(node)) {
+        const renamedKey = renamePatternKeys(node).get(key);
+        if (renamedKey !== undefined && renamedKey !== key) {
+          result = encodePointer(renamedKey);
+          changed = true;
+        }
+      }
+      const child =
+        isObject(node) || Array.isArray(node) ? (node as Record<string, unknown>)[key] : undefined;
+      position = positionAfter(position, key, child);
+      node = child;
+      return result;
+    });
+
+  return changed ? `#/${renamed.join('/')}` : ref;
+};
+
+const PATTERN_FORMAT_PREFIX = 'composio-pattern:';
+
+/** Pattern formats of one guard, installed on the interpreter only while it validates. */
+type PatternFormats = Map<string, (value: string) => boolean>;
+
+/**
+ * Adds `pattern` to `formats` as an interpreter format that tests it exactly as
+ * the native string parser does, without the `u` flag, and returns the format
+ * name. Returns `undefined` for a pattern that does not compile at all, which
+ * the interpreter then reports as it always has.
+ */
+const patternFormat = (pattern: string, formats: PatternFormats): string | undefined => {
+  const name = `${PATTERN_FORMAT_PREFIX}${pattern}`;
+  if (!formats.has(name)) {
+    let regex: RegExp;
+    try {
+      regex = new RegExp(pattern);
+    } catch {
+      return undefined;
+    }
+    formats.set(name, value => regex.test(value));
+  }
+  return name;
+};
+
 /**
- * OpenAPI 3.0 / Draft 4 spell exclusive bounds as a boolean flag next to
- * `minimum`/`maximum`. The Draft 7 interpreter igno
```

**File**: `ts/packages/json-schema-to-zod/test/semantic-regressions.test.ts` (modified, +103/-0)
```diff
@@ -1,4 +1,5 @@
 import Ajv from 'ajv';
+import { format } from '@cfworker/json-schema';
 import { describe, expect, it } from 'vitest';
 
 import { z } from 'zod/v3';
@@ -323,6 +324,108 @@ describe('whole-schema semantic regressions', () => {
     expect(jsonSchemaToZod(schema).safeParse(value).success).toBe(false);
   });
 
+  it('keeps a guarded object root a ZodObject with its shape', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: {
+        q: { type: 'string' },
+        limit: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
+      },
+      required: ['q'],
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed).toBeInstanceOf(z.ZodObject);
+    expect(Object.keys((parsed as z.AnyZodObject).shape)).toEqual(['q', 'limit']);
+    expect(parsed.safeParse({ q: 'cats', limit: null }).success).toBe(true);
+    expect(parsed.safeParse({ q: 'cats', limit: 'ten' }).success).toBe(false);
+    expect(parsed.describe('Search').safeParse({ q: 'cats', limit: 'ten' }).success).toBe(false);
+  });
+
+  it('accepts patterns with identity escapes that Unicode mode refuses', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: {
+        slug: { type: 'string', pattern: '^[a-z\\_]+$' },
+        ref: { $ref: '#/$defs/handle' },
+        limit: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
+      },
+      $defs: { handle: { type: 'string', pattern: '^\\@[a-z\\-]+$' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ slug: 'a_b', ref: '@a-b' }).success).toBe(true);
+    expect(parsed.safeParse({ slug: 'A' }).success).toBe(false);
+    expect(parsed.safeParse({ ref: 'a-b' }).success).toBe(false);
+  });
+
+  it.each([
+    { name: 'a legacy identity escape', pattern: '^\\k_$', valid: 'k_', invalid: 'wrong' },
+    { name: 'a quantified lookahead', pattern: '^(?=a){2}ab$', valid: 'ab', invalid: 'b' },
+  ])('enforces $name in a pattern only the guard sees', ({ pattern, valid, invalid }) => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: { handle: { $ref: '#/$defs/handle' } },
+      $defs: { handle: { type: 'string', pattern } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ handle: valid }).success).toBe(true);
+    expect(parsed.safeParse({ handle: invalid }).success).toBe(false);
+  });
+
+  it('leaves no pattern formats in the interpreter format table', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: { handle: { $ref: '#/$defs/handle' } },
+      $defs: { handle: { type: 'string', pattern: '^leak-check-\\d+$' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ handle: 'leak-check-1' }).success).toBe(true);
+    expect(parsed.safeParse({ handle: 'wrong' }).success).toBe(false);
+    expect(Object.keys(format).filter(name => name.includes('leak-check'))).toEqual([]);
+  });
+
+  it('enforces every patternProperties key, including keys that differ only in escapes', () => {
+    const schema: JsonSchema = {
+      patternProperties: {
+        '^a\\_b$': { type: 'integer', minimum: 10 },
+        '^a_b$': { type: 'integer' },
+        '^\\k_$': { type: 'string' },
+      },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ a_b: 12, k_: 'ok' }).success).toBe(true);
+    expect(parsed.safeParse({ a_b: 2 }).success).toBe(false);
+    expect(parsed.safeParse({ k_: 1 }).success).toBe(false);
+  });
+
+  it('resolves references nested under a patternProperties key that needs a rewrite', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      patternProperties: { '^x\\_': { $ref: '#/$defs/label' } },
+      $defs: { label: { type: 'string' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ x_1: 'ok' }).success).toBe(true);
+    expect(parsed.safeParse({ x_1: 1 }).success).toBe(false);
+  });
+
+  it('does not mistake a definition named patternProperties for the keyword', () => {
+    const schema = {
+      type: 'object',
+      properties: { v: { $ref: `#/$defs/patternProperties/${encodeURI('^a\\_b$')}` } },
+      $defs: { patternProperties: { '^a\\_b$': { type: 'string', minLength: 2 } } },
+    } as unknown as JsonSchema;
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ v: 'ok' }).success).toBe(true);
+    expect(parsed.safeParse({ v: 'x' }).success).toBe(false);
+  });
+
   it('compares decimal multiples by their JSON number spelling', () => {
     const schema: JsonSchema = { type: 'number', multipleOf: 0.1 };
     expect(jsonSchemaToZod(schema).safeParse(0.3).success).toBe(true);
```

**File**: `ts/packages/json-schema-to-zod/test/unicode-pattern.test.ts` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import fc from 'fast-check';
+import { describe, expect, it } from 'vitest';
+
+import { toUnicodePattern } from '../src/utils/unicode-pattern';
+
+const compiles = (pattern: string, flags?: string): boolean => {
+  try {
+    new RegExp(pattern, flags);
+    return true;
+  } catch {
+    return false;
+  }
+};
+
+const legacyCases: ReadonlyArray<{ pattern: string; matches: string[]; rejects: string[] }> = [
+  { pattern: '^[a-z\\_]+$', matches: ['a_b'], rejects: ['A'] },
+  { pattern: '^\\k_$', matches: ['k_'], rejects: ['wrong', '\\k_'] },
+  { pattern: '^a\\:b\\@c$', matches: ['a:b@c'], rejects: ['ab'] },
+  { pattern: '^a{$', matches: ['a{'], rejects: ['a'] },
+  { pattern: '^}]$', matches: ['}]'], rejects: [']'] },
+  { pattern: '^\\x4$', matches: ['x4'], rejects: ['\x04'] },
+  { pattern: '^\\u12$', matches: ['u12'], rejects: ['\u0012'] },
+  { pattern: '^\\p{L}$', matches: ['p{L}'], rejects: ['a'] },
+  { pattern: '^\\u{2}$', matches: ['uu'], rejects: ['\u0002'] },
+  { pattern: '^\\c$', matches: ['\\c'], rejects: ['c'] },
+  { pattern: '^[\\c1]$', matches: ['\x11'], rejects: ['1'] },
+  { pattern: '^\\1$', matches: ['\x01'], rejects: ['1'] },
+  { pattern: '^(a)\\1\\2$', matches: ['aa\x02'], rejects: ['aa'] },
+  { pattern: '^\\8$', matches: ['8'], rejects: ['\\8'] },
+  { pattern: '^[\\w-.]+$', matches: ['a-b.c'], rejects: ['a b'] },
+  { pattern: '^[.-\\d]$', matches: ['-', '5'], rejects: ['/'] },
+  { pattern: '^[\\B]$', matches: ['B'], rejects: ['b'] },
+];
+
+describe('toUnicodePattern', () => {
+  it.each(legacyCases)('gives $pattern its legacy meaning', ({ pattern, matches, rejects }) => {
+    const unicode = toUnicodePattern(pattern);
+    expect(unicode).toBeDefined();
+
+    for (const value of [...matches, ...rejects]) {
+      expect(new RegExp(unicode!, 'u').test(value), value).toBe(new RegExp(pattern).test(value));
+    }
+    expect(matches.every(value => new RegExp(pattern).test(value))).toBe(true);
+    expect(rejects.some(value => new RegExp(pattern).test(value))).toBe(false);
+  });
+
+  it('keeps patterns that already mean the same in both grammars', () => {
+    expect(toUnicodePattern('^[a-z]+(?:-[a-z]+)*$')).toBe('^[a-z]+(?:-[a-z]+)*$');
+    expect(toUnicodePattern('^(?<year>\\d{4})-\\k<year>$')).toBe('^(?<year>\\d{4})-\\k<year>$');
+  });
+
+  it('returns undefined for a quantified lookahead, which has no Unicode spelling', () => {
+    expect(compiles('^(?=a){2}a$')).toBe(true);
+    expect(toUnicodePattern('^(?=a){2}a$')).toBeUndefined();
+  });
+
+  it('matches exactly what the legacy pattern matches on ASCII input', () => {
+    const pattern = fc
+      .array(
+        fc.constantFrom(
+          ...'ab_:-.^$*+?()[]{}|/\\0189cdkpuxBDSWw,'.split(''),
+          '\\',
+          '\\\\',
+          '{2}',
+          '{1,3}'
+        ),
+        { maxLength: 12 }
+      )
+      .map(parts => parts.join(''))
+      .filter(candidate => compiles(candidate));
+    const input = fc.string({ unit: fc.constantFrom(...'ab_:-.^${}[]\\/ 019cdkpuxBw,'.split('')) });
+
+    fc.assert(
+      fc.property(pattern, fc.array(input, { maxLength: 8 }), (candidate, values) => {
+        const unicode = toUnicodePattern(candidate);
+        if (unicode === undefined) {
+          return;
+        }
+        for (const value of values) {
+          expect(new RegExp(unicode, 'u').test(value)).toBe(new RegExp(candidate).test(value));
+        }
+      }),
+      { numRuns: 2000 }
+    );
+  });
+});
```

**File**: `ts/packages/providers/langchain/test/langchain.test.ts` (modified, +30/-0)
```diff
@@ -2,6 +2,7 @@ import { describe, it, expect, beforeEach, vi } from 'vitest';
 import { LangchainProvider } from '../src';
 import { Tool } from '@composio/core';
 import { DynamicStructuredTool } from '@langchain/core/tools';
+import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
 
 describe('LangchainProvider', () => {
   let provider: LangchainProvider;
@@ -155,6 +156,35 @@ describe('LangchainProvider', () => {
       expect(() => JSON.parse(result as string)).not.toThrow();
     });
 
+    it('should serialize tool parameters with an object root when a parameter uses anyOf', () => {
+      const wrappedTool = provider.wrapTool(
+        {
+          ...sampleTool,
+          inputParameters: {
+            type: 'object',
+            properties: {
+              query: { type: 'string' },
+              limit: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
+            },
+            required: ['query'],
+          },
+        },
+        executeToolFn
+      );
+
+      const parameters = convertToOpenAITool(wrappedTool).function.parameters;
+
+      expect(parameters).toMatchObject({
+        type: 'object',
+        properties: {
+          query: { type: 'string' },
+          limit: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
+        },
+        required: ['query'],
+      });
+      expect(parameters).not.toHaveProperty('allOf');
+    });
+
     it('should normalize a stringified-JSON input to an object before executing (issue #2406)', async () => {
       const wrappedTool = provider.wrapTool(sampleTool, executeToolFn);
 
```

---

### Incident Patch 12: `d336236f` (2026-09-30)
**Commit Message**: Merge branch 'next' into fix/json-schema-to-zod-object-root

**File**: `.changeset/connection-request-live-status.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': patch
----
-
-Keep `ConnectionRequest.status` in sync with `waitForConnection()`. The request now reports `ACTIVE` once the connection completes, or the terminal status (`FAILED`, `EXPIRED`, `REVOKED`) when it fails, matching `toJSON()` and the Python SDK.
```

**File**: `.changeset/connection-request-telemetry.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': patch
----
-
-Restore telemetry for `ConnectionRequest.waitForConnection()`. `telemetry.instrument()` now also instruments async methods defined directly on plain objects, such as the ones returned by `createConnectionRequest()`.
```

**File**: `.changeset/dependabot-september-rollup.md` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
----
-'@composio/core': patch
-'@composio/slim': patch
-'@composio/experimental': patch
-'@composio/ts-builders': patch
-'@composio/anthropic': patch
----
-
-Refresh runtime dependencies and support Anthropic SDK 0.127 in the Anthropic provider.
```

**File**: `.changeset/premium-usage-response-contract.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': minor
----
-
-Expose the exact premium usage charge in project usage summaries and tool log metadata.
```

**File**: `.changeset/remove-openai-assistants-helpers.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': minor
----
-
-Remove the deprecated OpenAI Assistants API helpers from `OpenAIProvider`: `handleAssistantMessage`, `waitAndHandleAssistantToolCalls`, and `waitAndHandleAssistantStreamToolCalls`. OpenAI shut down the Assistants API on August 26, 2026, so these helpers could no longer complete a run. Use `OpenAIResponsesProvider` from `@composio/openai` with the Responses API instead.
```

**File**: `.changeset/session-aware-google-cloudflare-helpers.md` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
----
-'@composio/google': minor
-'@composio/cloudflare': minor
-'@composio/openai': minor
----
-
-Allow the Google and Cloudflare providers' `executeToolCall` and the OpenAI Responses provider's `handleResponse` to execute through a supplied Tool Router session, matching the other provider helpers. Session meta-tools now keep their session context through these helpers. Existing user-ID calls keep using direct execution unchanged, and the Cloudflare `options` argument is now optional. Passing a session requires `@composio/core` 0.17.0 or later. Custom provider subclasses overriding these methods may require updates because they now accept session targets.
```

**File**: `docs/agent-guidance/context/markdown-components.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Audit for DEVREL-35, 2026-09-10. Scope: components registered in `mdx-components
 | Media | `Figure`, `YouTube`, `Video` | Preserve captions and source links. Video links now survive conversion. Transcription of media is outside this audit. |
 | Example source | `FileBuildup`, `RepoBrowser` | Existing converters expose staged source or an explicit repository-availability notice. |
 | Structural wrappers and icons | `Cards`, `ProviderGrid`, `TemplateGrid`, `QuickstartFlow`, `FrameworkSelector`, `ToolTypeFlow`, `ConnectFlow`, `Accordions`, `CapabilityList`, `MediaSplit`, `AppLogo`, registered Lucide icons | Wrappers have no task instructions; their child content survives. Icons are decorative. |
-| Visual explanations | `SessionFlow`, `TriggersFlow`, `SlackBotFlow`, `LocalWorkbenchFlow`, `LocalSandboxBoundary`, `ImessageFlow`, `WorkbenchFlow`, `AuthConfigFlow`, `WhiteLabelFlow`, `ImportConnectionFlow`, `ManageConnectionsVisual`, `ConnectionRefreshVisual`, `InChatAuthTerminal`, `ClaudeMockUI` | Diagrams illustrate the surrounding guide. The authored instructions remain the executable path. Full visual-to-text parity is a follow-up, not claimed by this fix. |
+| Visual explanations | `SessionFlow`, `TriggersFlow`, `SlackBotFlow`, `LocalWorkbenchFlow`, `LocalSandboxBoundary`, `ImessageFlow`, `WorkbenchFlow`, `AuthConfigFlow`, `WhiteLabelFlow`, `ImportConnectionFlow`, `ManageConnectionsVisual`, `ConnectionRefreshVisual`, `InChatAuthTerminal`, `ClaudeMockUI`, `ZdrLogVisual` | Diagrams illustrate the surrounding guide. The authored instructions remain the executable path. Full visual-to-text parity is a follow-up, not claimed by this fix. |
 | Mermaid | `Mermaid` | `getLLMText` preserves processed diagram code. Raw component diagrams in search require separate parity coverage. |
 | Homepage and catalogs | `DocsHero`, `HomeFeatures`, `HomeResources`, `ToolkitsLanding`, `ManagedAuthList` | Dynamic content is not fully serialized by the generic converter. Product selection survives through `HomeSurfaces`; toolkit routes have dedicated Markdown renderers, and managed-auth prose includes the API lookup. Full catalog and homepage parity remains a follow-up. |
 
```

**File**: `docs/app/global.css` (modified, +91/-0)
```diff
@@ -1255,3 +1255,94 @@ html.docs-product-transition .docs-product-shell {
     mask-image: none;
   }
 }
+
+/* ZdrLogVisual: the request and response dissolve to "not stored" as the ZDR switch turns on. */
+.zdr-log-payload,
+.zdr-log-state-off {
+  animation: zdr-log-show-when-off 10s ease-in-out infinite;
+}
+
+.zdr-log-not-stored,
+.zdr-log-state-on {
+  opacity: 0;
+  animation: zdr-log-show-when-on 10s ease-in-out infinite;
+}
+
+.zdr-log-thumb {
+  animation: zdr-log-thumb 10s ease-in-out infinite;
+}
+
+.zdr-log-hatch {
+  background-image: repeating-linear-gradient(
+    135deg,
+    transparent 0 6px,
+    color-mix(in oklab, currentColor 12%, transparent) 6px 7px
+  );
+}
+
+@keyframes zdr-log-show-when-off {
+  0%,
+  38% {
+    opacity: 1;
+    filter: blur(0);
+  }
+  48%,
+  88% {
+    opacity: 0;
+    filter: blur(3px);
+  }
+  98%,
+  100% {
+    opacity: 1;
+    filter: blur(0);
+  }
+}
+
+@keyframes zdr-log-show-when-on {
+  0%,
+  38% {
+    opacity: 0;
+  }
+  48%,
+  88% {
+    opacity: 1;
+  }
+  98%,
+  100% {
+    opacity: 0;
+  }
+}
+
+@keyframes zdr-log-thumb {
+  0%,
+  38% {
+    transform: translateX(0);
+  }
+  48%,
+  88% {
+    transform: translateX(12px);
+  }
+  98%,
+  100% {
+    transform: translateX(0);
+  }
+}
+
+@media (prefers-reduced-motion: reduce) {
+  .zdr-log-payload,
+  .zdr-log-state-off {
+    animation: none;
+    opacity: 0;
+  }
+
+  .zdr-log-not-stored,
+  .zdr-log-state-on {
+    animation: none;
+    opacity: 1;
+  }
+
+  .zdr-log-thumb {
+    animation: none;
+    transform: translateX(12px);
+  }
+}
```

---

### Incident Patch 13: `9a23381d` (2026-09-30)
**Commit Message**: fix(sdk): preserve downloads when destination names collide

**File**: `.changeset/remote-file-portable-names.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 '@composio/core': patch
 ---
 
-`RemoteFile.save()` without a path no longer rejects ordinary file names. Names with characters Windows reserves, such as `report_2026-09-29T10:30:00.csv` or `What is this?.png`, are saved with those characters replaced by `_`. Names longer than 128 bytes are truncated with their extension kept, and reserved device names such as `NUL` get a `_` prefix. A name changed this way also gets a short digest of the original before its extension (`What is this_-9c68adf2da8b6e8d.png`), so two files whose names differ only in those characters never overwrite each other. Names with a NUL byte or no usable basename are still refused.
+`RemoteFile.save()` without a path no longer rejects ordinary file names. Names with characters Windows reserves, such as `report_2026-09-29T10:30:00.csv` or `What is this?.png`, are saved with those characters replaced by `_`. Names longer than 128 bytes are truncated with their extension kept, and reserved device names such as `NUL` get a `_` prefix. A name changed this way also gets a short digest of the original before its extension (`What is this_-9c68adf2da8b6e8d.png`). Default saves create a new file exclusively; if the destination exists, a copy number is added before its extension. Repeated default saves therefore return distinct paths and preserve earlier downloads. Names with a NUL byte or no usable basename are still refused.
```

**File**: `python/composio/core/models/_files.py` (modified, +11/-4)
```diff
@@ -27,7 +27,7 @@
 )
 from composio.utils import mimetypes
 from composio.utils.json_schema import dereference_json_schema
-from composio.utils.safe_path import secure_basename_join, secure_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join, secure_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -748,12 +748,17 @@ def download(
             )
 
         total_bytes = 0
+        created = False
         try:
             # Only once the fetch is validated and connected, so a blocked URL
             # leaves no directory behind — and inside the `try`, so a failure
             # here still closes the response.
             outdir.mkdir(exist_ok=True, parents=True)
-            with outfile.open("wb") as fd:
+            # A literal server name can equal a digest-tagged name. Claim the
+            # path exclusively, then choose a numbered name if it exists.
+            outfile, fd = open_unique_file(outfile)
+            created = True
+            with fd:
                 for chunk in response.iter_content(chunk_size=chunk_size):
                     if chunk:
                         total_bytes += len(chunk)
@@ -766,14 +771,16 @@ def download(
         except ResponseTooLargeError:
             # Propagates uncaught — callers must see the limit hit — but the
             # truncated file must not be left behind as if it were the download.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise
         except OSError as e:
             # `requests.exceptions.RequestException` subclasses `OSError`, so a
             # mid-stream transport failure and a failing `fd.write`/`mkdir`
             # (disk full, permissions) both land here — and both owe the caller
             # the `ErrorDownloadingFile` this method documents.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise ErrorDownloadingFile(
                 "Error downloading file: "
                 f"{_sanitize_url_for_logging(self.s3url)}. Error: {type(e).__name__}"
```

**File**: `python/composio/core/models/tool_router_session_files.py` (modified, +8/-2)
```diff
@@ -28,7 +28,7 @@
     ValidationError,
 )
 from composio.utils.mimetypes import get_extension_from_mime_type
-from composio.utils.safe_path import secure_basename_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -232,6 +232,7 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
 
         Returns the absolute path where the file was saved.
         If path is omitted, saves to ~/.composio/files/ using the filename.
+        An existing default destination gets a copy number before its extension.
         """
         content = self.buffer()
         save_path: Path
@@ -256,7 +257,12 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
                 raise ValidationError(str(e)) from e
 
         save_path.parent.mkdir(parents=True, exist_ok=True)
-        save_path.write_bytes(content)
+        if path is not None:
+            save_path.write_bytes(content)
+        else:
+            save_path, fd = open_unique_file(save_path)
+            with fd:
+                fd.write(content)
         return str(save_path.resolve())
 
     @classmethod
```

**File**: `python/composio/utils/safe_path.py` (modified, +35/-2)
```diff
@@ -185,6 +185,37 @@ def _fit_filename_bytes(name: str, max_bytes: int = MAX_COMPONENT_LENGTH) -> str
     return _truncate_to_bytes(stem, max_bytes - _encoded_length(extension)) + extension
 
 
+def numbered_basename(name: str, copy: int) -> str:
+    """Add a copy number before the extension within the filename byte limit."""
+    suffix = f"-{copy}"
+    stem, extension = _split_extension(name)
+    return (
+        _truncate_to_bytes(
+            stem, MAX_COMPONENT_LENGTH - _encoded_length(extension) - len(suffix)
+        )
+        + suffix
+        + extension
+    )
+
+
+def open_unique_file(path: Path) -> t.Tuple[Path, t.BinaryIO]:
+    """Claim a validated download path without replacing an existing file.
+
+    Numbered alternatives stay in the same directory and preserve a short
+    extension. Exclusive creation also prevents concurrent saves from sharing
+    a destination.
+    """
+    copy = 0
+    while True:
+        candidate = (
+            path if copy == 0 else path.with_name(numbered_basename(path.name, copy))
+        )
+        try:
+            return candidate, candidate.open("xb")
+        except FileExistsError:
+            copy += 1
+
+
 _FNV_OFFSET_BASIS_64 = 0xCBF29CE484222325
 _FNV_PRIME_64 = 0x100000001B3
 _UINT64_MASK = 0xFFFFFFFFFFFFFFFF
@@ -238,8 +269,10 @@ def safe_basename(name: str, *, label: str = "filename") -> str:
     extension kept, trailing spaces and dots are dropped as Windows would, and
     a resulting reserved device name gets a ``_`` prefix. A name any of these
     rules changed is then tagged with a digest of the original before its
-    extension (``report_-<16 hex>.png``), so distinct names never land on the
-    same file; a name that was already portable is returned unchanged.
+    extension (``report_-<16 hex>.png``) to distinguish ordinary normalization
+    collisions; a name that was already portable is returned unchanged. The
+    result can still equal a literal server name, so download writes use
+    :func:`open_unique_file` to preserve existing files.
     ``safeBasename`` in the TypeScript SDK applies the same rules in the same
     order.
 
```

**File**: `python/tests/test_files.py` (modified, +42/-2)
```diff
@@ -2686,8 +2686,11 @@ def test_download_rejects_oversized_during_streaming(self, mock_get, tmp_path):
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
+    @pytest.mark.parametrize("existing", [False, True])
     @patch("composio.core.models._files.safe_request")
-    def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
+    def test_download_removes_partial_file_on_failure(
+        self, mock_get, tmp_path, existing
+    ):
         """A truncated download must not be left behind as if it succeeded."""
         mock_response = MagicMock()
         mock_response.status_code = 200
@@ -2696,10 +2699,17 @@ def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
         mock_response.close = MagicMock()
         mock_get.return_value = mock_response
 
+        if existing:
+            (tmp_path / "report.bin").write_bytes(b"original")
+
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
-        assert list(tmp_path.iterdir()) == []
+        if existing:
+            assert list(tmp_path.iterdir()) == [tmp_path / "report.bin"]
+            assert (tmp_path / "report.bin").read_bytes() == b"original"
+        else:
+            assert list(tmp_path.iterdir()) == []
 
     @patch("composio.core.models._files.safe_request")
     def test_download_accepts_file_within_limit(self, mock_get, tmp_path):
@@ -3215,6 +3225,36 @@ def test_names_that_normalize_alike_do_not_overwrite_each_other(self, tmp_path):
             b"\x02",
         ]
 
+    @pytest.mark.parametrize(
+        "names",
+        [
+            ["report?.png", "report_-05fcb95aa5b918e9.png"],
+            ["report_-05fcb95aa5b918e9.png", "report?.png"],
+            ["請" * 41 + ".pdf"] * 3,
+        ],
+    )
+    def test_literal_tag_name_does_not_overwrite_download(self, names, tmp_path):
+        outdir = tmp_path / "safe"
+        outfiles = []
+        for index, name in enumerate(names):
+            file = FileDownloadable(
+                name=name,
+                mimetype="image/png",
+                s3url="https://example.com/file",
+            )
+            with patch(
+                "composio.core.models._files.safe_request",
+                return_value=self._mock_response(bytes([index])),
+            ):
+                outfiles.append(file.download(outdir, root=outdir))
+
+        assert len(set(outfiles)) == len(names)
+        assert [outfile.read_bytes() for outfile in outfiles] == [
+            bytes([i]) for i in range(len(names))
+        ]
+        assert all(len(outfile.name.encode()) <= 128 for outfile in outfiles)
+        assert all(outfile.suffix == Path(names[0]).suffix for outfile in outfiles)
+
 
 class TestDownloadDirSlugTraversal:
     """Server-controlled tool/toolkit slugs must not relocate the download
```

**File**: `python/tests/test_path_join_guardrail.py` (modified, +2/-1)
```diff
@@ -128,7 +128,8 @@ def _reviewed_path(
         "`safe_basename` collapses the value, rejects NUL bytes and invalid "
         "Unicode, rewrites Windows-invalid forms and reserved device names, fits "
         "the encoded length, and tags a rewritten name with a digest of the "
-        "original so distinct names never share a file.",
+        "original to distinguish ordinary normalization collisions. Download "
+        "writes create files exclusively to preserve existing destinations.",
         "_encoded_length",
         "_fit_filename_bytes",
         "_tag_with_original",
```

**File**: `python/tests/test_tool_router_session_files.py` (modified, +28/-0)
```diff
@@ -378,6 +378,34 @@ def test_save_makes_unportable_names_portable(
         assert saved.name == expected
         assert saved.read_bytes() == b"content"
 
+    @pytest.mark.parametrize(
+        "names",
+        [
+            ["report?.png", "report_-05fcb95aa5b918e9.png"],
+            ["report_-05fcb95aa5b918e9.png", "report?.png"],
+            ["請" * 41 + ".pdf"] * 3,
+        ],
+    )
+    def test_default_save_preserves_files_with_colliding_names(self, names, tmp_path):
+        paths = []
+        with patch("pathlib.Path.home", return_value=tmp_path):
+            for index, name in enumerate(names):
+                file = RemoteFile(
+                    expires_at="2026-01-01",
+                    mount_relative_path=name,
+                    sandbox_mount_prefix="/mnt/files",
+                    download_url="https://example.com/file",
+                )
+                with patch.object(file, "buffer", return_value=bytes([index])):
+                    paths.append(Path(file.save()))
+
+        assert len(set(paths)) == len(names)
+        assert [path.read_bytes() for path in paths] == [
+            bytes([i]) for i in range(len(names))
+        ]
+        assert all(len(path.name.encode()) <= 128 for path in paths)
+        assert all(path.suffix == Path(names[0]).suffix for path in paths)
+
 
 class TestResponseDerivedUrlsAreGuarded:
     """`download_url` and `upload_url` are response fields, so they are guarded.
```

**File**: `ts/packages/core/src/models/RemoteFile.ts` (modified, +24/-5)
```diff
@@ -1,6 +1,9 @@
 import { platform } from '#platform';
 import { ssrfSafeFetchWhereSupported } from '#ssrf_guard';
 import { COMPOSIO_DIR, TEMP_FILES_DIRECTORY_NAME } from '../utils/constants';
+import { z } from 'zod';
+
+const existingFileError = z.object({ code: z.literal('EEXIST') });
 
 function getParentDir(filePath: string): string {
   const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
@@ -14,7 +17,7 @@ import {
   ValidationError,
 } from '../errors';
 import { readResponseBodyWithLimit } from '../utils/readResponseBody';
-import { safeBasename, untrustedBasename } from '../utils/safePath';
+import { numberedBasename, safeBasename, untrustedBasename } from '../utils/safePath';
 
 /**
  * Represents a file stored in a tool router session's file mount.
@@ -173,6 +176,7 @@ export class RemoteFile {
    * Requires a Node.js runtime with file system support (not available in Cloudflare Workers/Edge).
    *
    * @param path - Local path to save the file. If omitted, saves to the Composio temp directory using the filename from the mount path.
+   * An existing default destination gets a copy number before its extension.
    * @returns The absolute path where the file was saved
    * @throws Error if file system is not supported or the save fails
    * @throws ValidationError if `path` is omitted and the mount path yields no usable filename
@@ -196,8 +200,8 @@ export class RemoteFile {
     // `"."` or `"foo/.."` would otherwise make `savePath` its own directory or
     // the parent, and fail with a raw `EISDIR` only after `mkdirSync` had run.
     const defaultDir = platform.joinPath(homeDir, COMPOSIO_DIR, TEMP_FILES_DIRECTORY_NAME);
-    const savePath =
-      path ?? platform.joinPath(defaultDir, safeBasename(this.mountRelativePath, 'mount path'));
+    const defaultName = path == null ? safeBasename(this.mountRelativePath, 'mount path') : '';
+    const savePath = path ?? platform.joinPath(defaultDir, defaultName);
 
     const content = await this.buffer();
 
@@ -206,7 +210,22 @@ export class RemoteFile {
       platform.mkdirSync(dir);
     }
 
-    platform.writeFileSync(savePath, content);
-    return savePath;
+    if (path != null) {
+      platform.writeFileSync(savePath, content);
+      return savePath;
+    }
+
+    // Server names can equal a digest-tagged name literally. Reserve a new
+    // destination atomically so either save order keeps both downloads.
+    for (let copy = 0; ; copy++) {
+      const destination =
+        copy === 0 ? savePath : platform.joinPath(defaultDir, numberedBasename(defaultName, copy));
+      try {
+        platform.writeFileExclusiveSync(destination, content);
+        return destination;
+      } catch (error) {
+        if (!existingFileError.safeParse(error).success) throw error;
+      }
+    }
   }
 }
```

---

### Incident Patch 14: `9cb9b97b` (2026-09-30)
**Commit Message**: fix(json-schema-to-zod): scope pattern formats to each guard's validation

**File**: `ts/packages/json-schema-to-zod/src/whole-schema-validation.ts` (modified, +33/-15)
```diff
@@ -261,23 +261,25 @@ const renameRefThroughPatternKeys = (ref: string, root: unknown): string => {
 
 const PATTERN_FORMAT_PREFIX = 'composio-pattern:';
 
+/** Pattern formats of one guard, installed on the interpreter only while it validates. */
+type PatternFormats = Map<string, (value: string) => boolean>;
+
 /**
- * Registers `pattern` as an interpreter format that tests it exactly as the
- * native string parser does, without the `u` flag, and returns the format
- * name. The name is derived from the pattern, so every schema using the same
- * pattern shares one entry. Returns `undefined` for a pattern that does not
- * compile at all, which the interpreter then reports as it always has.
+ * Adds `pattern` to `formats` as an interpreter format that tests it exactly as
+ * the native string parser does, without the `u` flag, and returns the format
+ * name. Returns `undefined` for a pattern that does not compile at all, which
+ * the interpreter then reports as it always has.
  */
-const patternFormat = (pattern: string): string | undefined => {
+const patternFormat = (pattern: string, formats: PatternFormats): string | undefined => {
   const name = `${PATTERN_FORMAT_PREFIX}${pattern}`;
-  if (!Object.hasOwn(format, name)) {
+  if (!formats.has(name)) {
     let regex: RegExp;
     try {
       regex = new RegExp(pattern);
     } catch {
       return undefined;
     }
-    format[name] = value => regex.test(value);
+    formats.set(name, value => regex.test(value));
   }
   return name;
 };
@@ -295,9 +297,14 @@ const patternFormat = (pattern: string): string | undefined => {
  *   `patternProperties` key cannot leave the interpreter, so it gets its
  *   Unicode spelling (`toUnicodePattern`), and local `$ref`s through a renamed
  *   key follow the rename. `root` is the unmodified document those refs
- *   address.
+ *   address. `formats` collects the pattern formats.
  */
-const prepareInterpreterSchema = (value: unknown, seen: WeakSet<object>, root: unknown): void => {
+const prepareInterpreterSchema = (
+  value: unknown,
+  seen: WeakSet<object>,
+  root: unknown,
+  formats: PatternFormats
+): void => {
   if (!isObject(value) || seen.has(value)) {
     return;
   }
@@ -320,7 +327,7 @@ const prepareInterpreterSchema = (value: unknown, seen: WeakSet<object>, root: u
     value.$ref = renameRefThroughPatternKeys(value.$ref, root);
   }
   const patternFormatName =
-    typeof value.pattern === 'string' ? patternFormat(value.pattern) : undefined;
+    typeof value.pattern === 'string' ? patternFormat(value.pattern, formats) : undefined;
   if (patternFormatName !== undefined) {
     delete value.pattern;
     if (value.format === undefined) {
@@ -342,12 +349,12 @@ const prepareInterpreterSchema = (value: unknown, seen: WeakSet<object>, root: u
 
   for (const [key, child] of Object.entries(value)) {
     if (SCHEMA_MAP_KEYWORDS.has(key) && isObject(child)) {
-      Object.values(child).forEach(nested => prepareInterpreterSchema(nested, seen, root));
+      Object.values(child).forEach(nested => prepareInterpreterSchema(nested, seen, root, formats));
     } else if (SCHEMA_ARRAY_KEYWORDS.has(key) && Array.isArray(child)) {
-      child.forEach(nested => prepareInterpreterSchema(nested, seen, root));
+      child.forEach(nested => prepareInterpreterSchema(nested, seen, root, formats));
     } else if (SCHEMA_VALUE_KEYWORDS.has(key)) {
       (Array.isArray(child) ? child : [child]).forEach(nested =>
-        prepareInterpreterSchema(nested, seen, root)
+        prepareInterpreterSchema(nested, seen, root, formats)
       );
     }
   }
@@ -401,19 +408,30 @@ export const withWholeSchemaValidation = (
   parsedSchema: z.ZodTypeAny
 ): z.ZodTypeAny => {
   const interpreterSchema = structuredClone(jsonSchema);
-  prepareInterpreterSchema(interpreterSchema, new WeakSet(), jsonSchema);
+  const formats: PatternFormats = new Map();
+  prepareInterpreterSchema(interpreterSchema, new WeakSet(), jsonSchema, formats);
   const validator = new Validator(interpreterSchema as InterpreterSchema, '7', false);
 
   // Validate the source value before defaults and other Zod transforms run.
   // Otherwise a missing required field can be synthesized and incorrectly
   // appear valid to the JSON Schema interpreter.
   const innerGuard = (parsedSchema._def as GuardedDef).wholeSchemaGuard;
   const wholeSchemaGuard: WholeSchemaGuard = value => {
+    // The interpreter only reads formats from its process-wide table. This
+    // guard's pattern formats live there only for this synchronous call, so
+    // the table does not grow with every distinct pattern ever converted.
     let result: ReturnType<Validator['validate']>;
     try {
+      formats.forEach((test, name) => {
+        format[name] = test;
+      });
       result = validator.validate(value);
     } catch (cause) {
       return `JSON Schema validation failed: ${String(cause)}`;
+    } finally {
+      formats.forEach((_, name) => {
+        delete format
```

**File**: `ts/packages/json-schema-to-zod/test/semantic-regressions.test.ts` (modified, +14/-0)
```diff
@@ -1,4 +1,5 @@
 import Ajv from 'ajv';
+import { format } from '@cfworker/json-schema';
 import { describe, expect, it } from 'vitest';
 
 import { z } from 'zod/v3';
@@ -373,6 +374,19 @@ describe('whole-schema semantic regressions', () => {
     expect(parsed.safeParse({ handle: invalid }).success).toBe(false);
   });
 
+  it('leaves no pattern formats in the interpreter format table', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: { handle: { $ref: '#/$defs/handle' } },
+      $defs: { handle: { type: 'string', pattern: '^leak-check-\\d+$' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ handle: 'leak-check-1' }).success).toBe(true);
+    expect(parsed.safeParse({ handle: 'wrong' }).success).toBe(false);
+    expect(Object.keys(format).filter(name => name.includes('leak-check'))).toEqual([]);
+  });
+
   it('enforces every patternProperties key, including keys that differ only in escapes', () => {
     const schema: JsonSchema = {
       patternProperties: {
```

---

### Incident Patch 15: `0549faa7` (2026-09-30)
**Commit Message**: docs: correct custom MCP setup guidance (PLEN-3895) (#4692)

Correct Custom MCP auth setup and account-matching guidance, remove
internal deletion terminology, and show how to list custom toolkits,
following the [dogfooding
feedback](https://composioworkspace.slack.com/archives/C09D3UBHA4B/p1788172498998639).

**File**: `docs/content/docs/extending-sessions/custom-mcp.mdx` (modified, +6/-43)
```diff
@@ -21,7 +21,7 @@ A Custom MCP moves through this lifecycle:
 2. **Register** its URL and authentication scheme. Composio creates a project-scoped `CUSTOM_*` toolkit.
 3. **Connect** an account if the server uses an API key or DCR OAuth. No-auth servers skip this step.
 4. **Sync** its tools. The first sync starts automatically; later tool changes require a manual sync.
-5. **Use** the toolkit in a session. For authenticated servers, explicitly select the connected account.
+5. **Use** the toolkit in a session.
 
 <Callout type="warn" title="API-only while Custom MCP is experimental">
 Use the lifecycle endpoints below to register, sync, and delete Custom MCP toolkits. You can also use the experimental SDK methods described below. These contracts may change while Custom MCP is experimental. The API reference has the full request and response schemas for [upsert](/reference/api-reference/toolkits/postCustomToolkitsUpsert), [sync](/reference/api-reference/toolkits/postCustomToolkitsSync), and [delete](/reference/api-reference/toolkits/deleteCustomToolkitsBySlug). Dashboard management is coming soon for customers who prefer a UI.
@@ -167,36 +167,6 @@ Choose the mode that matches your server, then complete any required connection:
 
 For DCR OAuth, the server must support the standard authorization-code flow. Other OAuth grant types aren't supported.
 
-### Create the auth config for automatic account matching
-
-Registering a toolkit does not create an auth config. For API-key and DCR OAuth servers, creating one yourself is a *required* separate step: without an auth config there is nothing for end users to connect to, and the toolkit's tools can't authenticate. Create it right after registration, with `is_enabled_for_tool_router` set to `true` so sessions can match connected accounts by `user_id`:
-
-```bash
-curl --request POST \
-  --url https://backend.composio.dev/api/v3.1/auth_configs \
-  --header "x-api-key: $COMPOSIO_API_KEY" \
-  --header "Content-Type: application/json" \
-  --data '{
-    "toolkit": { "slug": "CUSTOM_ACME" },
-    "auth_config": {
-      "type": "use_custom_auth",
-      "authScheme": "API_KEY",
-      "credentials": {},
-      "is_enabled_for_tool_router": true
-    }
-  }'
-```
-
-This flag is what lets sessions find the toolkit's connected accounts by `user_id` automatically. Without it, session executions fail with `NoActiveConnection` even when an active account exists, and you must [select the account explicitly](#use-an-authenticated-server) in every session. If you already created the config without the flag, patch it:
-
-```bash
-curl --request PATCH \
-  --url https://backend.composio.dev/api/v3.1/auth_configs/ac_xxxxxxxx \
-  --header "x-api-key: $COMPOSIO_API_KEY" \
-  --header "Content-Type: application/json" \
-  --data '{ "type": "custom", "is_enabled_for_tool_router": true }'
-```
-
 ## Sync and resync tools
 
 Call `POST /api/v3.1/custom/toolkits/sync` to fetch the server's current tools:
@@ -257,15 +227,7 @@ curl --request DELETE \
   --header "x-api-key: $COMPOSIO_API_KEY"
 ```
 
-```json
-{
-  "slug": "CUSTOM_ACME",
-  "deleted": true,
-  "revoke_job_ids": ["job_123"],
-  "auth_configs_soft_deleted": 1,
-  "connected_accounts_soft_deleted": 1
-}
-```
+A successful response confirms the deletion with `deleted: true`. See the [delete endpoint reference](/reference/api-reference/toolkits/deleteCustomToolkitsBySlug) for the full response.
 
 <Callout type="warn" title="Deletion also removes connections">
 Deletion removes the custom toolkit and its tools. It also revokes and removes the toolkit's auth configurations and connected accounts. Any replacement starts with new connections.
@@ -275,7 +237,7 @@ Deletion removes the custom toolkit and its tools. It also revokes and removes t
 
 Once the toolkit is synced, add its `CUSTOM_*` slug to a session.
 
-### Use a no-auth server
+### Create a session
 
 Pass the toolkit slug when you create the session:
 
@@ -313,7 +275,7 @@ With the default search-first session, your agent can discover the custom tools
 
 ### Use an authenticated server
 
-Sessions match a connected account by `user_id` automatically when the toolkit's auth config was [created with `is_enabled_for_tool_router: true`](#create-the-auth-config-for-automatic-account-matching). If your auth config doesn't have that flag, explicitly select the connected account in the session config instead:
+Sessions automatically match connected accounts by `user_id`. If you created the auth config yourself, [set `is_enabled_for_tool_router: true`](/reference/api-reference/auth-configs/patchAuthConfigsByNanoid) to enable automatic account matching. To select a specific connected account, pass its ID in the session configuration:
 
 <Tabs groupId="language" items={['Python', 'TypeScript']} persist>
 <Tab value="Python">
@@ -360,6 +322,8 @@ The pinned account must belong to the custom toolkit and be active. Explicit sel
 
 ## Technical behavior
 
+List your custom toolkit
```

#### Recent Merged Pull Requests:
- **PR #4753** (2026-10-05): docs: add TypeScript examples to Instant tools page (@olearycrew)
- **PR #4738** (2026-10-05): docs: update toolkits, API spec, and meta tools data (@sdkrelease[bot])
- **PR #4736** (closed): docs: remove stale Monday install link (@abhishekpatil4)
- **PR #4733** (2026-10-02): docs: use Composio Instant naming (@olearycrew)
- **PR #4727** (2026-10-01): fix(experimental): never re-send a workbench tool execution (@jkomyno)
- **PR #4726** (2026-10-01): docs: update guides for SDK changes (@sdkrelease[bot])
- **PR #4718** (2026-10-01): fix(sdk): never retry session tool executions (@jkomyno)
- **PR #4716** (2026-10-01): docs: drop the support route for deleting pre-ZDR logs (@shubham22)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

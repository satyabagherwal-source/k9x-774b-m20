# Forensic Learning Record (Deep Inspection): taylorwilsdon/google_workspace_mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/taylorwilsdon-google_workspace_mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:03.139Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `taylorwilsdon/google_workspace_mcp`
- **Description**: Control Gmail, Google Calendar, Docs, Sheets, Slides, Chat, Forms, Tasks, Search & Drive with AI - Comprehensive Google Workspace MCP Server & CLI Tool
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3286 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/__init__.py`
```
# Make the core directory a Python package

```

### Core Architecture Module: `core/api_enablement.py`
```
import re
from typing import Dict, Optional, Tuple


API_ENABLEMENT_LINKS: Dict[str, str] = {
    "calendar-json.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=calendar-json.googleapis.com",
    "drive.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com",
    "gmail.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com",
    "docs.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=docs.googleapis.com",
    "sheets.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=sheets.googleapis.com",
    "slides.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=slides.googleapis.com",
    "forms.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=forms.googleapis.com",
    "tasks.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=tasks.googleapis.com",
    "chat.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=chat.googleapis.com",
    "customsearch.googleapis.com": "https://console.cloud.google.com/flows/enableapi?apiid=customsearch.googleapis.com",
}


SERVICE_NAME_TO_API: Dict[str, str] = {
    "Google Calendar": "calendar-json.googleapis.com",
    "Google Drive": "drive.googleapis.com",
    "Gmail": "gmail.googleapis.com",
    "Google Docs": "docs.googleapis.com",
    "Google Sheets": "sheets.googleapis.com",
    "Google Slides": "slides.googleapis.com",
    "Google Forms": "forms.googleapis.com",
    "Google Tasks": "tasks.googleapis.com",
    "Google Chat": "chat.googleapis.com",
    "Google Custom Search": "customsearch.googleapis.com",
}


INTERNAL_SERVICE_TO_API: Dict[str, str] = {
    "calendar": "calendar-json.googleapis.com",
    "drive": "drive.googleapis.com",
    "gmail": "gmail.googleapis.com",
    "docs": "docs.googleapis.com",
    "sheets": "sheets.googleapis.com",
    "slides": "slides.googleapis.com",
    "forms": "forms.googleapis.com",
    "tasks": "tasks.googleapis.com",
    "chat": "chat.googleapis.com",
    "customsearch": "customsearch.googleapis.com",
    "search": "customsearch.googleapis.com",
}


def extract_api_info_from_error(
    error_details: str,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract API service and project ID from error details.

    Returns:
        Tuple of (api_service, project_id) or (None, None) if not found
    """
    api_pattern = r"https://console\.developers\.google\.com/apis/api/([^/]+)/overview"
    project_pattern = r"project[=\s]+([a-zA-Z0-9-]+)"

    api_match = re.search(api_pattern, error_details)
    project_match = re.search(project_pattern, error_details)

    api_service = api_match.group(1) if api_match else None
    project_id = project_match.group(1) if project_match else None

    return api_service, project_id


def get_api_enablement_message(
    error_details: str, service_type: Optional[str] = None
) -> str:
    """
    Generate a helpful error message with direct API enablement link.

    Args:
        error_details: The error details string from the HttpError
        service_type: Optional service type (e.g., "calendar", "gmail", or "Google Calendar")

    Returns:
        Formatted error message with enablement link
    """
    api_service, project_id = extract_api_info_from_error(error_details)

    if not api_service and service_type:
        # Check internal service names first (e.g., "calendar", "gmail")
        api_service = INTERNAL_SERVICE_TO_API.get(service_type)
        if not api_service:
            # Check display names (e.g., "Google Calendar")
            api_service = SERVICE_NAME_TO_API.get(service_type)

    if api_service and api_service in API_ENABLEMENT_LINKS:
        enable_link = API_ENABLEMENT_LINKS[api_service]
        service_display_name = next(
            (name for name, api in SERVICE_NAME_TO_API.items() if api == api_service),
            api_service,
        )

        message = (
            f"{service_display_name} API is not enabled for your project"
            f"{f' ({project_id})' if project_id else ''}.\n\n"
            f"Enable it here: {enable_link}\n\n"
            f"After enabling, wait 1-2 minutes for the change to propagate, then try again."
            f"IMPORTANT - LLM: share the link provided as a clickable hyperlink and instruct the user to enable the required API."
        )

        return message

    return ""

```

### Core Architecture Module: `core/attachment_storage.py`
```
"""
Temporary attachment storage for Gmail attachments.

Stores attachments to local disk and returns file paths for direct access.
Files are automatically cleaned up after expiration (default 1 hour).
"""

import base64
import logging
import os
import re
import shutil
import time
import unicodedata
import uuid
from pathlib import Path
from typing import NamedTuple, Optional, Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Default expiration: 1 hour
DEFAULT_EXPIRATION_SECONDS = 3600

# Storage directory - configurable via WORKSPACE_ATTACHMENT_DIR env var
# Uses absolute path to avoid creating tmp/ in arbitrary working directories (see #327)
_default_dir = str(Path.home() / ".workspace-mcp" / "attachments")
STORAGE_DIR = (
    Path(os.getenv("WORKSPACE_ATTACHMENT_DIR", _default_dir)).expanduser().resolve()
)

# Fallback extensions for attachments that arrive without a filename.
_MIME_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "text/plain": ".txt",
    "text/html": ".html",
}

_WINDOWS_RESERVED_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def _ensure_storage_dir() -> None:
    """Create the storage directory on first use, not at import time."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)


def sanitize_attachment_filename(filename: Optional[str]) -> str:
    """Return a filesystem-safe attachment filename."""
    if not filename:
        return "attachment"

    # Normalize Unicode space separators (category "Zs") to a plain ASCII space.
    filename = "".join(
        " " if unicodedata.category(ch) == "Zs" else ch for ch in filename
    )

    sanitized = _WINDOWS_RESERVED_FILENAME_CHARS.sub("_", filename).rstrip(" .")
    if not sanitized:
        return "attachment"

    stem = sanitized.split(".", 1)[0]
    if stem.upper() in _WINDOWS_RESERVED_NAMES:
        sanitized = f"_{sanitized}"

    return sanitized


def _build_save_name(
    file_id: str, filename: Optional[str], mime_type: Optional[str]
) -> str:
    """Build a collision-free on-disk name, keeping the original stem when given."""
    if filename:
        # The full file_id, not a prefix: a truncated one lets two distinct
        # attachments land on the same path, silently overwriting the first.
        safe_filename = Path(sanitize_attachment_filename(filename))
        return f"{safe_filename.stem}_{file_id}{safe_filename.suffix}"
    return f"{file_id}{_MIME_TO_EXTENSION.get(mime_type or '', '')}"


class SavedAttachment(NamedTuple):
    """Result of saving an attachment: provides both the UUID and the absolute file path."""

    file_id: str
    path: str


class AttachmentStorage:
    """Manages temporary storage of email attachments."""

    def __init__(self, expiration_seconds: int = DEFAULT_EXPIRATION_SECONDS):
        self.expiration_seconds = expiration_seconds
        self._metadata: Dict[str, Dict] = {}

    def save_attachment(
        self,
        base64_data: str,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
    ) -> SavedAttachment:
        """
        Save an attachment to local disk.

        Args:
            base64_data: Base64-encoded attachment data
            filename: Original filename (optional)
            mime_type: MIME type (optional)

        Returns:
            SavedAttachment with file_id (UUID) and path (absolute file path)
        """
        # Decode base64 data
        try:
            file_bytes = base64.urlsafe_b64decode(base64_data)
        except Exception as e:
            logger.error(f"Failed to decode base64 attachment data: {e}")
            raise ValueError(f"Invalid base64 data: {e}")

        return self.save_attachment_bytes(file_bytes, filename, mime_type)

    def save_attachment_bytes(
        self,
        file_bytes: bytes,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
    ) -> SavedAttachment:
        """Save an already-decoded attachment without a base64 round trip."""
        _ensure_storage_dir()

        file_id = str(uuid.uuid4())
        save_name = _build_save_name(file_id, filename, mime_type)

        # Save file with restrictive permissions (sensitive email/drive content)
        file_path = STORAGE_DIR / save_name
        try:
            fd = os.open(
                file_path,
                os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_BINARY", 0),
                0o600,
            )
            try:
                total_written = 0
                data_len = len(file_bytes)
                data_view = memoryview(file_bytes)
                while total_written < data_len:
                    written = os.write(fd, data_view[total_written:])
                    if written == 0:
                        raise OSError(
                            "os.write returned 0 bytes; could not write attachment data"
                        )
                    total_written += written
            finally:
                os.close(fd)
            logger.info(
                f"Saved attachment file_id={file_id} filename={filename or save_name} "
                f"({len(file_bytes)} bytes) to {file_path}"
            )
        except Exception as e:
            logger.error(
                f"Failed to save attachment file_id={file_id} "
                f"filename={filename or save_name} to {file_path}: {e}"
            )
            raise

        return self._record(
            file_id, file_path, save_name, filename, mime_type, len(file_bytes)
        )

    def save_attachment_from_path(
        self,
        src_path: str,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
    ) -> SavedAttachment:
        """
        Adopt an already-downloaded file without loading it into memory.

        The counterpart to save_attachment() for payloads that were streamed
        straight to disk. Nothing here is proportional to the file size, so a
        multi-gigabyte Drive download costs no RAM (see #994).

        Args:
            src_path: Path to the downloaded file. Consumed - it is moved into
                storage, so the caller must not reuse it afterwards.
            filename: Original filename (optional)
            mime_type: MIME type (optional)

        Returns:
            SavedAttachment with file_id (UUID) and path (absolute file path)
        """
        _ensure_storage_dir()

        file_id = str(uuid.uuid4())
        save_name = _build_save_name(file_id, filename, mime_type)
        file_path = STORAGE_DIR / save_name

        try:
            # Publish with a fresh mtime so a concurrent sweep cannot expire it.
            os.utime(src_path, None)
            # shutil.move degrades to a streamed copy across filesystems, so it
            # stays memory-safe when the temp dir is on another mount.
            shutil.move(str(src_path), str(file_path))
            os.chmod(file_path, 0o600)
            size = file_path.stat().st_size
            logger.info(
                f"Saved attachment file_id={file_id} filename={filename or save_name} "
                f"({size} bytes) to {file_path}"
            )
            return self._record(
                file_id, file_path, save_name, filename, mime_type, size
            )
        except Exception as e:
            # The move can land before a later finalization step fails, leaving a file in
            # storage that no metadata entry will ever expire. Drop it rather
            # than orphan it, but never let cleanup mask the original failure.
            try:
                file_path.unlink(missing_ok=True)
            except OSError as cleanup_error:
                logger.warning(
                    f"Failed to remove partially saved attachment {file_path}: "
                    f"{cleanup_error}"
                )
            logger.error(
                f"Failed to save attachment file_id={file_id} "
                f"filename={filename or save_name} to {file_path}: {e}"
            )
            raise

    def _record(
        self,
        file_id: str,
        file_path: Path,
        save_name: str,
        filename: Optional[str],
        mime_type: Optional[str],
        size: int,
    ) -> SavedAttachment:
        """Record a stored file's metadata and return its handle."""
        self._metadata[file_id] = {
            "file_path": str(file_path),
            "filename": save_name,
            "original_filename": filename,
            "mime_type": mime_type or "application/octet-stream",
            "size": size,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(seconds=self.expiration_seconds),
        }
        return SavedAttachment(file_id=file_id, path=str(file_path))

    def get_attachment_path(self, file_id: str) -> Optional[Path]:
        """
        Get the file path for an attachment ID.

        Args:
            file_id: Unique file ID

        Returns:
            Path object if file exists and not expired, None otherwise
        """
        if file_id not in self._metadata:
            logger.warning(f"Attachment {file_id} not found in metadata")
            return None

        metadata = self._metadata[file_id]
        file_path = Path(metadata["file_path"])

        # Check if expired
        if datetime.now() > metadata["expires_at"]:
            logger.info(f"Attachment {file_id} has expired, cleaning up")
            self._cleanup_file(file_id)
            return None

        # Check if file exists
        if not file_path.exists():
            logger.warning(f"Attachment file {file_path} does not exist")
            del self._metadata[file_id]
            return None

        return file_path
```

### Core Architecture Module: `core/camel_case_middleware.py`
```
"""
Middleware that lets callers use camelCase argument names on snake_case tools.
"""

import logging
import re
from typing import Any, Dict, Optional

from fastmcp.server.middleware import CallNext, Middleware, MiddlewareContext

logger = logging.getLogger(__name__)

# Split on lowercase/digit -> uppercase ("timeMin") and on the tail of an
# acronym run followed by a new word ("fooURLValue" -> "foo_URL_Value").
_CAMEL_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


def to_snake_case(name: str) -> str:
    """Convert a camelCase argument name to snake_case (``timeMin`` -> ``time_min``)."""
    return _CAMEL_BOUNDARY.sub("_", name).lower()


class CamelCaseArgumentsMiddleware(Middleware):
    """Translate camelCase tool arguments to their snake_case equivalents.

    Every tool in this server declares snake_case parameters with
    ``additionalProperties: false``, so callers that mirror the Google API
    field names (``calendarId``, ``timeMin``, ``maxResults``, ...) fail schema
    validation before the request ever reaches Google. This middleware renames
    an argument key when all of the following hold:

    * the key is not itself a declared parameter of the tool,
    * its snake_case conversion is a declared parameter, and
    * the caller did not also pass the snake_case key explicitly.

    Everything else passes through untouched, so existing snake_case callers
    (and genuinely invalid arguments) behave exactly as before.
    """

    async def on_call_tool(self, context: MiddlewareContext, call_next: CallNext):
        arguments = context.message.arguments
        if arguments:
            normalized = await self._normalize_arguments(context, arguments)
            if normalized is not None:
                context = context.copy(
                    message=context.message.model_copy(update={"arguments": normalized})
                )
        return await call_next(context)

    async def _normalize_arguments(
        self, context: MiddlewareContext, arguments: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Return arguments with camelCase keys renamed, or None if unchanged."""
        if not context.fastmcp_context:
            return None

        tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
        if tool is None:
            # Unknown tool — let the normal "tool not found" handling run.
            return None

        properties = (tool.parameters or {}).get("properties")
        if not properties:
            return None

        renames = {}
        for key in arguments:
            if key in properties:
                continue
            snake_key = to_snake_case(key)
            if (
                snake_key != key
                and snake_key in properties
                and snake_key not in arguments
            ):
                renames[key] = snake_key

        # If two distinct keys normalize to the same parameter (e.g. "iCalUid"
        # and "iCalUID"), the request is ambiguous — leave those keys untouched
        # so schema validation rejects them instead of silently picking one.
        target_counts: Dict[str, int] = {}
        for snake_key in renames.values():
            target_counts[snake_key] = target_counts.get(snake_key, 0) + 1
        renames = {
            key: snake_key
            for key, snake_key in renames.items()
            if target_counts[snake_key] == 1
        }

        if not renames:
            return None

        logger.debug(
            "[CamelCaseArgumentsMiddleware] Renaming arguments for tool '%s': %s",
            context.message.name,
            renames,
        )
        return {renames.get(key, key): value for key, value in arguments.items()}

```

### Core Architecture Module: `core/cli.py`
```
"""
Persistent CLI wrapper for interacting with a running Workspace MCP server.

Reuses the project's existing FileTreeStore and FernetEncryptionWrapper to
cache OAuth tokens on disk so that ``fastmcp list/call`` does not re-trigger
the full browser-based OAuth flow on every invocation.

Usage::

    uv run workspace-cli list
    uv run workspace-cli call search_gmail_messages query="is:unread" max_results=5
"""

import argparse
import asyncio
import json
import logging
import os
import stat
import sys
from typing import Any

from cryptography.fernet import Fernet
from fastmcp import Client
from fastmcp.client.auth import OAuth
from key_value.aio.wrappers.encryption import FernetEncryptionWrapper

from core.storage import make_sanitized_file_store

logger = logging.getLogger(__name__)

DEFAULT_URL = "http://localhost:8000/mcp"
CLI_HOME = os.path.expanduser("~/.workspace-mcp")
TOKEN_DIR = os.path.join(CLI_HOME, "cli-tokens")
KEY_PATH = os.path.join(CLI_HOME, ".cli-encryption-key")


def _get_token_storage() -> FernetEncryptionWrapper:
    """Return an encrypted, disk-backed token store.

    On first run the directory tree and a random Fernet key are created.
    The key file is restricted to owner-only access (0o600).
    """
    os.makedirs(TOKEN_DIR, exist_ok=True)

    try:
        fd = os.open(KEY_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        with open(KEY_PATH, "rb") as fh:
            key = fh.read()
    else:
        key = Fernet.generate_key()
        try:
            os.write(fd, key)
        finally:
            os.close(fd)
        os.chmod(KEY_PATH, stat.S_IRUSR | stat.S_IWUSR)

    return FernetEncryptionWrapper(
        key_value=make_sanitized_file_store(TOKEN_DIR),
        fernet=Fernet(key),
    )


def _build_oauth() -> OAuth:
    """Build an OAuth helper with persistent encrypted token storage."""
    storage = _get_token_storage()
    return OAuth(token_storage=storage)


def _coerce_cli_value(value: str) -> Any:
    """Parse a CLI value as JSON, but keep the raw text whenever it is a string.

    ``max_results=5`` still becomes ``int(5)``, while a quoted value such as
    ``query='"grow therapy"'`` keeps its quotes instead of being unwrapped into
    ``grow therapy``, which would break Gmail phrase matching.
    """
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return value
    return value if isinstance(parsed, str) else parsed


async def _list_tools(url: str) -> None:
    """Connect, authenticate once, and print available tools."""
    try:
        auth = _build_oauth()
    except Exception as e:
        print(
            f"Error: failed to initialize OAuth ({type(e).__name__})", file=sys.stderr
        )
        sys.exit(1)
    try:
        async with Client(url, auth=auth) as client:
            tools = await client.list_tools()
    except Exception as e:
        print(f"Error: failed to list tools ({type(e).__name__})", file=sys.stderr)
        sys.exit(1)
    for tool in tools:
        desc = (tool.description or "").split("\n")[0]
        print(f"  {tool.name:40s} {desc}")
    print(f"\n{len(tools)} tools available")


async def _call_tool(url: str, tool_name: str, raw_args: list[str]) -> None:
    """Connect, authenticate once, call a single tool, and print the result."""
    kwargs: dict[str, Any] = {}
    for arg in raw_args:
        if "=" not in arg:
            print(f"Error: argument '{arg}' must be in key=value form", file=sys.stderr)
            sys.exit(1)
        k, v = arg.split("=", 1)
        kwargs[k] = _coerce_cli_value(v)

    async with Client(url, auth=_build_oauth()) as client:
        result = await client.call_tool(tool_name, kwargs)
        for block in result.content:
            if hasattr(block, "text"):
                try:
                    parsed = json.loads(block.text)
                    print(json.dumps(parsed, indent=2))
                except (json.JSONDecodeError, TypeError):
                    print(block.text)
            else:
                print(block)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="workspace-cli",
        description="CLI for Workspace MCP with persistent OAuth token caching",
    )
    parser.add_argument(
        "--url",
        default=os.getenv("WORKSPACE_MCP_URL", DEFAULT_URL),
        help=f"MCP server URL (default: {DEFAULT_URL})",
    )

    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list", help="List available tools")

    call_parser = sub.add_parser("call", help="Call a tool")
    call_parser.add_argument("tool", help="Tool name")
    call_parser.add_argument("args", nargs="*", help="key=value arguments")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "list":
        asyncio.run(_list_tools(args.url))
    elif args.command == "call":
        asyncio.run(_call_tool(args.url, args.tool, args.args))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `core/comments.py`
```
"""
Core Comments Module

This module provides reusable comment management functions for Google Workspace applications.
All Google Workspace apps (Docs, Sheets, Slides) use the Drive API for comment operations.
"""

import logging
import asyncio
import os
from typing import Awaitable, Callable, Optional

from mcp.types import ToolAnnotations

from auth.service_decorator import require_google_service, require_multiple_services
from core.server import server
from core.utils import handle_http_errors

logger = logging.getLogger(__name__)


READ_COMMENT_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)

MANAGE_COMMENT_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=True,
)


async def _manage_comment_dispatch(
    service,
    app_name: str,
    file_id: str,
    action: str,
    comment_content: Optional[str] = None,
    comment_id: Optional[str] = None,
    cell: Optional[str] = None,
    sheets_service=None,
    insert_cell_comment: Optional[Callable[..., Awaitable[str]]] = None,
) -> str:
    """Route comment management actions to the appropriate implementation."""
    action_lower = action.lower().strip()
    if cell and action_lower in ("reply", "resolve"):
        raise ValueError("cell is only supported for the create action")
    if action_lower == "create":
        if not comment_content:
            raise ValueError("comment_content is required for create action")
        if cell:
            if insert_cell_comment is None:
                raise ValueError("insert_cell_comment is required for cell comments")
            return await _create_cell_comment_impl(
                insert_cell_comment, sheets_service, file_id, cell, comment_content
            )
        return await _create_comment_impl(service, app_name, file_id, comment_content)
    elif action_lower == "reply":
        if not comment_id or not comment_content:
            raise ValueError(
                "comment_id and comment_content are required for reply action"
            )
        return await _reply_to_comment_impl(
            service, app_name, file_id, comment_id, comment_content
        )
    elif action_lower == "resolve":
        if not comment_id:
            raise ValueError("comment_id is required for resolve action")
        return await _resolve_comment_impl(service, app_name, file_id, comment_id)
    else:
        raise ValueError(
            f"Invalid action '{action_lower}'. Must be 'create', 'reply', or 'resolve'."
        )


def create_comment_tools(
    app_name: str,
    file_id_param: str,
    insert_cell_comment: Optional[Callable[..., Awaitable[str]]] = None,
):
    """
    Factory function to create comment management tools for a specific Google Workspace app.

    Args:
        app_name: Name of the app (e.g., "document", "spreadsheet", "presentation")
        file_id_param: Parameter name for the file ID (e.g., "document_id", "spreadsheet_id", "presentation_id")
        insert_cell_comment: Spreadsheet only; passed in because gsheets imports this module.

    Returns:
        Dict containing the comment management functions with unique names
    """

    # --- Consolidated tools ---
    list_func_name = f"list_{app_name}_comments"
    manage_func_name = f"manage_{app_name}_comment"
    app_title = app_name.replace("_", " ").title()

    if file_id_param == "document_id":

        @require_google_service("drive", "drive_read")
        @handle_http_errors(list_func_name, is_read_only=True, service_type="drive")
        async def list_comments(
            service,
            user_google_email: str,
            document_id: str,
            max_comments: int | None = None,
        ) -> str:
            """List all comments from a Google Document (optional max_comments to limit results)."""
            return await _read_comments_impl(
                service, app_name, document_id, max_comments=max_comments
            )

        # Use full Drive scope so comment operations remain visible to collaborators.
        @require_google_service("drive", "drive")
        @handle_http_errors(manage_func_name, service_type="drive")
        async def manage_comment(
            service,
            user_google_email: str,
            document_id: str,
            action: str,
            comment_content: Optional[str] = None,
            comment_id: Optional[str] = None,
        ) -> str:
            """Manage comments on a Google Document.

            Actions:
              - create: Create a new document-level comment. Requires comment_content.
                Note: The Drive API cannot anchor comments to specific text; only
                the Google Docs UI can do that.
              - reply: Reply to a comment. Requires comment_id and comment_content.
              - resolve: Resolve a comment. Requires comment_id.
            """
            return await _manage_comment_dispatch(
                service, app_name, document_id, action, comment_content, comment_id
            )

    elif file_id_param == "spreadsheet_id":

        @require_google_service("drive", "drive_read")
        @handle_http_errors(list_func_name, is_read_only=True, service_type="drive")
        async def list_comments(
            service,
            user_google_email: str,
            spreadsheet_id: str,
            max_comments: int | None = None,
        ) -> str:
            """List all comments from a Google Spreadsheet (optional max_comments to limit results)."""
            return await _read_comments_impl(
                service, app_name, spreadsheet_id, max_comments=max_comments
            )

        # Use full Drive scope so comment operations remain visible to collaborators.
        # Sheets batchUpdate also accepts it, so cell comments need no extra grant.
        @require_multiple_services(
            [
                {"service_type": "drive", "scopes": "drive", "param_name": "service"},
                {
                    "service_type": "sheets",
                    "scopes": "drive",
                    "param_name": "sheets_service",
                },
            ]
        )
        @handle_http_errors(manage_func_name, service_type="drive")
        async def manage_comment(
            service,
            sheets_service,
            user_google_email: str,
            spreadsheet_id: str,
            action: str,
            comment_content: Optional[str] = None,
            comment_id: Optional[str] = None,
            cell: Optional[str] = None,
        ) -> str:
            """Manage comments on a Google Spreadsheet.

            Actions:
              - create: Create a new comment. Requires comment_content. Pass cell
                (A1 notation, e.g. 'Sheet1!B2'; defaults to the first sheet) to
                anchor it to a cell; otherwise it is a file-level comment.
              - reply: Reply to a comment. Requires comment_id and comment_content.
              - resolve: Resolve a comment. Requires comment_id.
            """
            return await _manage_comment_dispatch(
                service,
                app_name,
                spreadsheet_id,
                action,
                comment_content,
                comment_id,
                cell=cell,
                sheets_service=sheets_service,
                insert_cell_comment=insert_cell_comment,
            )

    elif file_id_param == "presentation_id":

        @require_google_service("drive", "drive_read")
        @handle_http_errors(list_func_name, is_read_only=True, service_type="drive")
        async def list_comments(
            service,
            user_google_email: str,
            presentation_id: str,
            max_comments: int | None = None,
        ) -> str:
            """List all comments from a Google Presentation (optional max_comments to limit results)."""
            return await _read_comments_impl(
                service, app_name, presentation_id, max_comments=max_comments
            )

        # Use full Drive scope so comment operations remain visible to collaborators.
        @require_google_service("drive", "drive")
        @handle_http_errors(manage_func_name, service_type="drive")
        async def manage_comment(
            service,
            user_google_email: str,
            presentation_id: str,
            action: str,
            comment_content: Optional[str] = None,
            comment_id: Optional[str] = None,
        ) -> str:
            """Manage comments on a Google Presentation.

            Actions:
              - create: Create a new comment. Requires comment_content.
                Note: The Drive API cannot anchor comments to arbitrary text;
                Slides comments are element-scoped via the API.
              - reply: Reply to a comment. Requires comment_id and comment_content.
              - resolve: Resolve a comment. Requires comment_id.
            """
            return await _manage_comment_dispatch(
                service, app_name, presentation_id, action, comment_content, comment_id
            )

    list_comments.__name__ = list_func_name
    manage_comment.__name__ = manage_func_name
    server.tool(
        title=f"List {app_title} Comments",
        annotations=READ_COMMENT_ANNOTATIONS,
    )(list_comments)
    server.tool(
        title=f"Manage {app_title} Comment",
        annotations=MANAGE_COMMENT_ANNOTATIONS,
    )(manage_comment)

    return {
        "list_comments": list_comments,
        "manage_comment": manage_comment,
    }


def _format_field(label: str, value: str) -> str:
    """Render a labeled value with continuation lines indented under the value.

    Comment text is free-form and may contain newlines; without the hanging
    indent a line such as "Author: ..." inside a comment body would be
    indistinguishable from a real field.
    """
    return label + ("\n" + " 
```

### Core Architecture Module: `core/config.py`
```
"""
Shared configuration for Google Workspace MCP server.
This module holds configuration values that need to be shared across modules
to avoid circular imports.

NOTE: OAuth configuration has been moved to auth.oauth_config for centralization.
This module now imports from there for backward compatibility.
"""

import os
from typing import TYPE_CHECKING

from auth.oauth_config import (
    get_oauth_base_url,
    get_oauth_redirect_uri,
    set_transport_mode,
    get_transport_mode,
    is_oauth21_enabled,
)

# Server configuration. WORKSPACE_MCP_PORT is resolved lazily via PEP 562
# __getattr__ so that the value reflects the current env at access time.
# main.py mutates WORKSPACE_MCP_PORT in os.environ at startup via the port
# resolver (auth.port_resolver.resolve_port); consumers that do
# `from core.config import WORKSPACE_MCP_PORT` inside a function will see the
# late-bound port instead of a frozen-at-module-import 8000.
WORKSPACE_MCP_BASE_URI = os.getenv("WORKSPACE_MCP_BASE_URI", "http://localhost")
WORKSPACE_EXTERNAL_URL = os.getenv("WORKSPACE_EXTERNAL_URL")

if TYPE_CHECKING:
    WORKSPACE_MCP_PORT: int


def __getattr__(name: str) -> int:
    if name == "WORKSPACE_MCP_PORT":
        if os.getenv("WORKSPACE_MCP_RESOLVED_PORT") == "1":
            return int(os.getenv("WORKSPACE_MCP_PORT", os.getenv("PORT", "8000")))
        return int(os.getenv("PORT", os.getenv("WORKSPACE_MCP_PORT", "8000")))
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# Disable USER_GOOGLE_EMAIL in OAuth 2.1 multi-user mode
USER_GOOGLE_EMAIL = (
    None if is_oauth21_enabled() else os.getenv("USER_GOOGLE_EMAIL", None)
)

# Re-export OAuth functions for backward compatibility
__all__ = [
    "WORKSPACE_MCP_PORT",
    "WORKSPACE_MCP_BASE_URI",
    "WORKSPACE_EXTERNAL_URL",
    "USER_GOOGLE_EMAIL",
    "get_oauth_base_url",
    "get_oauth_redirect_uri",
    "set_transport_mode",
    "get_transport_mode",
]

```

### Core Architecture Module: `core/context.py`
```
# core/context.py
import contextvars
from typing import Optional

# Context variable to hold injected credentials for the life of a single request.
_injected_oauth_credentials = contextvars.ContextVar(
    "injected_oauth_credentials", default=None
)

# Context variable to hold FastMCP session ID for the life of a single request.
_fastmcp_session_id = contextvars.ContextVar("fastmcp_session_id", default=None)


def get_injected_oauth_credentials():
    """
    Retrieve injected OAuth credentials for the current request context.
    This is called by the authentication layer to check for request-scoped credentials.
    """
    return _injected_oauth_credentials.get()


def set_injected_oauth_credentials(credentials: Optional[dict]):
    """
    Set or clear the injected OAuth credentials for the current request context.
    This is called by the service decorator.
    """
    _injected_oauth_credentials.set(credentials)


def get_fastmcp_session_id() -> Optional[str]:
    """
    Retrieve the FastMCP session ID for the current request context.
    This is called by authentication layer to get the current session.
    """
    return _fastmcp_session_id.get()


def set_fastmcp_session_id(session_id: Optional[str]):
    """
    Set or clear the FastMCP session ID for the current request context.
    This is called when a FastMCP request starts.
    """
    _fastmcp_session_id.set(session_id)

```

### Core Architecture Module: `core/file_limits.py`
```
"""Env-gated limits for in-memory Google file / attachment downloads.

``WORKSPACE_MCP_MAX_FILE_BYTES`` caps how many bytes a tool may buffer into
process memory (Drive MediaIo downloads, Gmail attachments, etc.).

Default is disabled (``0`` / unset) so existing deployments keep uncapped
behavior. Set a positive integer (e.g. ``5242880`` for 5 MiB) to enable.

``WORKSPACE_MCP_MAX_OFFICE_XML_BYTES`` independently caps both the XML expanded
from one Office file and the text extracted from it. It is on by default;
``0`` disables it.

``WORKSPACE_MCP_STATELESS_INLINE_MAX_BYTES`` caps the file a stateless-mode
download returns inline. It defaults to 10 MiB and never exceeds
``WORKSPACE_MCP_MAX_FILE_BYTES``.
"""

from __future__ import annotations

import asyncio
import io
import os
from typing import Any, Optional

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

_ENV_NAME = "WORKSPACE_MCP_MAX_FILE_BYTES"
_OFFICE_XML_ENV_NAME = "WORKSPACE_MCP_MAX_OFFICE_XML_BYTES"
_STATELESS_INLINE_ENV_NAME = "WORKSPACE_MCP_STATELESS_INLINE_MAX_BYTES"

# Office files are ZIP archives, so the download cap above bounds only the
# COMPRESSED size, and XML compresses by orders of magnitude. Unlike the
# download cap this one is on by default: the download cap is opt-in to protect
# deployments that need large downloads, and nothing comparable depends on
# unbounded expansion.
#
# This counts expanded XML bytes, not memory. The parsed tree is much larger:
# measured with tracemalloc on 1 MiB of XML, peak allocation was about 14x the
# XML size for paragraphs of short text and about 30x for empty elements. The
# default therefore allows a worst case in the hundreds of MiB per extraction;
# small containers should set it lower.
DEFAULT_MAX_OFFICE_XML_BYTES = 25 * 1024 * 1024  # 25 MiB

# Base64 inflates an inline payload by a third, so this is ~13.4 MiB on the wire.
DEFAULT_STATELESS_INLINE_MAX_BYTES = 10 * 1024 * 1024  # 10 MiB

# Keep the uncapped path from asking httplib2 to materialize its 100 MiB
# default response chunk. This does not impose a total-size limit; it only
# bounds the transient allocation made by each MediaIoBaseDownload request.
_MEDIA_DOWNLOAD_CHUNK_SIZE_BYTES = 256 * 1024  # 256 KiB

# Stream read size when a byte cap is active. Keep small so we can abort
# near the ceiling even when Content-Length is absent.
_STREAM_READ_SIZE_BYTES = 64 * 1024  # 64 KiB

# Error bodies are diagnostic data, not file payloads. They must still be
# bounded or an upstream/proxy error can bypass the configured memory guard.
_MAX_ERROR_BODY_BYTES = 64 * 1024  # 64 KiB


class FileTooLargeError(ValueError):
    """Raised when a download would exceed ``WORKSPACE_MCP_MAX_FILE_BYTES``."""


def get_max_file_bytes() -> Optional[int]:
    """Return the configured max download size in bytes, or ``None`` if uncapped.

    Parsing rules:
    - unset, empty, or ``0`` → uncapped (``None``)
    - positive int → that many bytes
    - invalid or negative value → raise ``ValueError``
    """
    value = _byte_count_from_env(_ENV_NAME)
    return value or None


def get_max_office_xml_bytes() -> Optional[int]:
    """Return the cap on bytes expanded out of one Office file, or ``None``.

    Parsing rules:
    - unset or empty → ``DEFAULT_MAX_OFFICE_XML_BYTES``
    - ``0`` → uncapped (``None``)
    - positive int → that many bytes
    - invalid or negative value → raise ``ValueError``
    """
    value = _byte_count_from_env(_OFFICE_XML_ENV_NAME)
    if value is None:
        return DEFAULT_MAX_OFFICE_XML_BYTES
    return value or None


def get_stateless_inline_max_bytes() -> int:
    """Return the largest file a stateless-mode download may return inline.

    Parsing rules:
    - unset or empty → ``DEFAULT_STATELESS_INLINE_MAX_BYTES``
    - ``0`` → nothing is inlined
    - positive int → that many bytes
    - invalid or negative value → raise ``ValueError``

    Inlining holds the whole file in memory, so ``WORKSPACE_MCP_MAX_FILE_BYTES``
    lowers this when set.
    """
    value = _byte_count_from_env(_STATELESS_INLINE_ENV_NAME)
    if value is None:
        value = DEFAULT_STATELESS_INLINE_MAX_BYTES
    max_file_bytes = get_max_file_bytes()
    return min(value, max_file_bytes) if max_file_bytes else value


def validate_file_limit_settings() -> None:
    """Raise ``ValueError`` if any file-limit environment setting is invalid."""
    get_max_file_bytes()
    get_max_office_xml_bytes()
    get_stateless_inline_max_bytes()


def _byte_count_from_env(name: str) -> Optional[int]:
    """Parse a non-negative byte count from ``name``; ``None`` when unset or empty."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return None
    try:
        value = int(raw.strip())
    except ValueError as exc:
        raise ValueError(
            f"Invalid {name}={raw!r}; expected a non-negative integer byte count."
        ) from exc
    if value < 0:
        raise ValueError(
            f"Invalid {name}={raw!r}; expected a non-negative integer byte count."
        )
    return value


def format_file_too_large_message(
    *,
    size_bytes: int,
    max_bytes: int,
    file_name: Optional[str] = None,
    file_id: Optional[str] = None,
    web_view_link: Optional[str] = None,
    kind: str = "file",
) -> str:
    """Build an agent-friendly error that points at alternatives, not file surgery."""
    label = f'"{file_name}"' if file_name else f"this {kind}"
    id_part = f" (ID: {file_id})" if file_id else ""
    link_part = ""
    if web_view_link and web_view_link != "#":
        link_part = f"\nOpen in Google Drive: {web_view_link}"

    return (
        f"Error: {label}{id_part} is too large to load into this MCP server "
        f"({size_bytes:,} bytes; limit is {max_bytes:,} bytes via {_ENV_NAME}).\n"
        f"Full binary download through this tool is not available for oversized "
        f"{kind}s.{link_part}\n"
        "Alternatives:\n"
        "- Use get_doc_content / get_doc_as_markdown for Google Docs\n"
        "- Use read_sheet_values for Google Sheets\n"
        "- Use get_drive_file_content for text-oriented exports when under the limit\n"
        "- Open the Drive link above for large binaries (video, zip, large PDF, etc.)"
    )


def ensure_within_file_size_limit(
    size_bytes: Optional[int],
    *,
    file_name: Optional[str] = None,
    file_id: Optional[str] = None,
    web_view_link: Optional[str] = None,
    kind: str = "file",
    max_bytes: Optional[int] = None,
) -> None:
    """Raise ``FileTooLargeError`` if a declared size exceeds the configured cap."""
    limit = get_max_file_bytes() if max_bytes is None else max_bytes
    if limit is None or size_bytes is None:
        return
    try:
        declared = int(size_bytes)
    except (TypeError, ValueError):
        return
    if declared > limit:
        raise FileTooLargeError(
            format_file_too_large_message(
                size_bytes=declared,
                max_bytes=limit,
                file_name=file_name,
                file_id=file_id,
                web_view_link=web_view_link,
                kind=kind,
            )
        )


def _raise_too_large(
    *,
    size_bytes: int,
    max_bytes: int,
    file_name: Optional[str],
    file_id: Optional[str],
    web_view_link: Optional[str],
    kind: str,
) -> None:
    raise FileTooLargeError(
        format_file_too_large_message(
            size_bytes=size_bytes,
            max_bytes=max_bytes,
            file_name=file_name,
            file_id=file_id,
            web_view_link=web_view_link,
            kind=kind,
        )
    )


def _authorize_headers(
    request_obj: Any, *, force_refresh: bool = False
) -> dict[str, str]:
    """Copy request headers and authorize them like ``AuthorizedHttp`` does."""
    headers = dict(getattr(request_obj, "headers", None) or {})
    http = getattr(request_obj, "http", None)
    credentials = getattr(http, "credentials", None) if http is not None else None
    if credentials is None:
        return headers

    # Reuse AuthorizedHttp's refresh transport when available. A fallback
    # google-auth Request owns a requests.Session, so close it deterministically.
    auth_request = getattr(http, "_request", None)
    owned_auth_request = auth_request is None
    if owned_auth_request:
        auth_request = GoogleAuthRequest()
    try:
        if force_refresh:
            credentials.refresh(auth_request)
        method = (getattr(request_obj, "method", None) or "GET").upper()
        uri = getattr(request_obj, "uri", None) or ""
        credentials.before_request(auth_request, method, uri, headers)
    finally:
        if owned_auth_request:
            auth_request.session.close()
    return headers


async def _download_media_bytes_uncapped(request_obj: Any) -> bytes:
    """Download via MediaIoBaseDownload (full response may be buffered per chunk)."""
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(
        fh, request_obj, chunksize=_MEDIA_DOWNLOAD_CHUNK_SIZE_BYTES
    )
    done = False
    while not done:
        _status, done = await asyncio.to_thread(downloader.next_chunk)
    return fh.getvalue()


async def _accumulate_capped_stream(
    resp: httpx.Response,
    *,
    limit: int,
    file_name: Optional[str],
    file_id: Optional[str],
    web_view_link: Optional[str],
    kind: str,
) -> bytes:
    """Read an open streamed response, aborting once past ``limit``."""
    content_encoding = resp.headers.get("content-encoding", "").strip().lower()
    content_length = resp.headers.get("content-length")
    # Content-Length describes the encoded wire representation, whereas
    # aiter_bytes() yields decoded bytes. It is only comparable to the file-byte
    # limit for identity responses. Capped requests ask for identity below, but
    # keep this guard for non-compliant intermediarie
```

### Core Architecture Module: `core/http_utils.py`
```
"""
SSRF-safe HTTP fetching utilities.

Provides async HTTP fetch functions with protection against SSRF attacks,
DNS rebinding, and redirect-based bypasses. Extracted from gdrive/drive_tools.py
for reuse across modules (Drive uploads, Gmail URL attachments, etc.).
"""

import ipaddress
import asyncio
import logging
import socket
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

logger = logging.getLogger(__name__)


class SSRFFetchError(RuntimeError):
    """Raised when SSRF-safe fetching fails after validation succeeds."""


def redact_url(url: str) -> str:
    """Return a redacted URL safe for logs and exceptions."""
    parsed_url = urlparse(url)
    if not parsed_url.hostname:
        return "<redacted>"

    path = parsed_url.path or "/"
    return f"{parsed_url.hostname}{path}"


async def resolve_and_validate_host(hostname: str) -> list[str]:
    """
    Resolve a hostname to IP addresses and validate none are private/internal.

    Uses getaddrinfo to handle both IPv4 and IPv6. Fails closed on DNS errors.

    Returns:
        list[str]: Validated resolved IP address strings.

    Raises:
        ValueError: If hostname resolves to private/internal IPs or DNS fails.
    """
    if not hostname:
        raise ValueError("Invalid URL: no hostname")

    # Block localhost variants
    if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        raise ValueError("URLs pointing to localhost are not allowed")

    # Resolve hostname using getaddrinfo (handles both IPv4 and IPv6)
    try:
        loop = asyncio.get_running_loop()
        addr_infos = await loop.run_in_executor(
            None, socket.getaddrinfo, hostname, None
        )
    except socket.gaierror as e:
        raise ValueError(
            f"Cannot resolve hostname '{hostname}': {e}. "
            "Refusing request (fail-closed)."
        )

    if not addr_infos:
        raise ValueError(f"No addresses found for hostname: {hostname}")

    resolved_ips: list[str] = []
    seen_ips: set[str] = set()
    for _family, _type, _proto, _canonname, sockaddr in addr_infos:
        ip_str = sockaddr[0]
        ip = ipaddress.ip_address(ip_str)
        if not ip.is_global:
            raise ValueError(
                f"URLs pointing to private/internal networks are not allowed: "
                f"{hostname} resolves to {ip_str}"
            )
        if ip_str not in seen_ips:
            seen_ips.add(ip_str)
            resolved_ips.append(ip_str)

    return resolved_ips


async def validate_url_not_internal(url: str) -> list[str]:
    """
    Validate that a URL doesn't point to internal/private networks (SSRF protection).

    Returns:
        list[str]: Validated resolved IP addresses for the hostname.

    Raises:
        ValueError: If URL points to localhost or private IP ranges.
    """
    parsed = urlparse(url)
    return await resolve_and_validate_host(parsed.hostname)


def format_host_header(hostname: str, scheme: str, port: Optional[int]) -> str:
    """Format the Host header value for IPv4/IPv6 hostnames."""
    host_value = hostname
    if ":" in host_value and not host_value.startswith("["):
        host_value = f"[{host_value}]"

    is_default_port = (scheme == "http" and (port is None or port == 80)) or (
        scheme == "https" and (port is None or port == 443)
    )
    if not is_default_port and port is not None:
        host_value = f"{host_value}:{port}"
    return host_value


def build_pinned_url(parsed_url, ip_address_str: str) -> str:
    """Build a URL that targets a resolved IP while preserving path/query."""
    pinned_host = ip_address_str
    if ":" in pinned_host and not pinned_host.startswith("["):
        pinned_host = f"[{pinned_host}]"

    userinfo = ""
    if parsed_url.username is not None:
        userinfo = parsed_url.username
        if parsed_url.password is not None:
            userinfo += f":{parsed_url.password}"
        userinfo += "@"

    port_part = f":{parsed_url.port}" if parsed_url.port is not None else ""
    netloc = f"{userinfo}{pinned_host}{port_part}"

    path = parsed_url.path or "/"
    return urlunparse(
        (
            parsed_url.scheme,
            netloc,
            path,
            parsed_url.params,
            parsed_url.query,
            parsed_url.fragment,
        )
    )


async def fetch_url_with_pinned_ip(
    url: str, *, timeout: Optional[httpx.Timeout] = None
) -> httpx.Response:
    """
    Fetch URL content by connecting to a validated, pre-resolved IP address.

    This prevents DNS rebinding between validation and the outbound connection.
    """
    parsed_url = urlparse(url)
    redacted_url = redact_url(url)
    if parsed_url.scheme not in ("http", "https"):
        raise ValueError(f"Only http:// and https:// are supported: {redacted_url}")
    if not parsed_url.hostname:
        raise ValueError(f"Invalid URL: missing hostname ({redacted_url})")

    resolved_ips = await validate_url_not_internal(url)
    host_header = format_host_header(
        parsed_url.hostname, parsed_url.scheme, parsed_url.port
    )

    last_error: Optional[Exception] = None
    for resolved_ip in resolved_ips:
        pinned_url = build_pinned_url(parsed_url, resolved_ip)
        try:
            async with httpx.AsyncClient(
                follow_redirects=False, trust_env=False, timeout=timeout
            ) as client:
                request = client.build_request(
                    "GET",
                    pinned_url,
                    headers={"Host": host_header},
                    extensions={"sni_hostname": parsed_url.hostname},
                )
                return await client.send(request)
        except httpx.HTTPError as exc:
            last_error = exc
            logger.warning(
                f"[ssrf_safe_fetch] Failed request via resolved IP {resolved_ip} for host "
                f"{parsed_url.hostname}: {exc.__class__.__name__}"
            )

    raise SSRFFetchError(
        "Failed to fetch URL after trying "
        f"{len(resolved_ips)} validated IP(s): {redacted_url}"
    ) from last_error


async def ssrf_safe_fetch(
    url: str, *, timeout: Optional[httpx.Timeout] = None
) -> httpx.Response:
    """
    Fetch a URL with SSRF protection that covers redirects and DNS rebinding.

    Validates the initial URL and every redirect target against private/internal
    networks. Disables automatic redirect following and handles redirects manually.

    Args:
        url: The URL to fetch.

    Returns:
        httpx.Response with the final response content.

    Raises:
        ValueError: If any URL in the redirect chain points to a private network.
        SSRFFetchError: If the HTTP request fails.
    """
    max_redirects = 10
    current_url = url

    for _ in range(max_redirects):
        resp = await fetch_url_with_pinned_ip(current_url, timeout=timeout)
        redacted_current_url = redact_url(current_url)

        if resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("location")
            if not location:
                raise SSRFFetchError(
                    f"Redirect with no Location header from {redacted_current_url}"
                )

            # Resolve relative redirects against the current URL
            location = urljoin(current_url, location)

            redirect_parsed = urlparse(location)
            if redirect_parsed.scheme not in ("http", "https"):
                raise ValueError(
                    f"Redirect to disallowed scheme: {redirect_parsed.scheme}"
                )

            current_url = location
            continue

        return resp

    raise SSRFFetchError(
        f"Too many redirects (max {max_redirects}) fetching {redact_url(url)}"
    )


@asynccontextmanager
async def ssrf_safe_stream(
    url: str,
    *,
    timeout: httpx.Timeout = httpx.Timeout(30.0, connect=5.0),
) -> AsyncIterator[httpx.Response]:
    """
    SSRF-safe streaming fetch: validates each redirect target against private
    networks, then streams the final response body without buffering it all
    in memory.

    Usage::

        async with ssrf_safe_stream(file_url) as resp:
            async for chunk in resp.aiter_bytes(chunk_size=256 * 1024):
                ...
    """
    max_redirects = 10
    current_url = url

    # Resolve redirects manually so every hop is SSRF-validated
    for _ in range(max_redirects):
        parsed = urlparse(current_url)
        redacted_url = redact_url(current_url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"Only http:// and https:// are supported: {redacted_url}")
        if not parsed.hostname:
            raise ValueError(f"Invalid URL: missing hostname ({redacted_url})")

        resolved_ips = await validate_url_not_internal(current_url)
        host_header = format_host_header(parsed.hostname, parsed.scheme, parsed.port)

        last_error: Optional[Exception] = None
        resp: Optional[httpx.Response] = None
        for resolved_ip in resolved_ips:
            pinned_url = build_pinned_url(parsed, resolved_ip)
            client = httpx.AsyncClient(
                follow_redirects=False, trust_env=False, timeout=timeout
            )
            try:
                request = client.build_request(
                    "GET",
                    pinned_url,
                    headers={"Host": host_header},
                    extensions={"sni_hostname": parsed.hostname},
                )
                resp = await client.send(request, stream=True)
                break
            except httpx.HTTPError as exc:
                last_error = exc
                await client.aclose()
                logger.warning(
                    f"[ssrf_safe_stream] Failed via IP {resolved_ip} for "
                    f"{parsed.hostname}: {exc.__class__.__name__}"
         
```

### Core Architecture Module: `core/log_formatter.py`
```
"""
Enhanced Log Formatter for Google Workspace MCP

Provides visually appealing log formatting with emojis and consistent styling
to match the safe_print output format.
"""

import logging
import os
import re
import sys


class SuppressStatelessTransportTerminationFilter(logging.Filter):
    """Drop noisy SDK cleanup logs emitted for stateless HTTP transports."""

    def filter(self, record: logging.LogRecord) -> bool:
        return not (
            record.name == "mcp.server.streamable_http"
            and record.levelno == logging.INFO
            and record.getMessage() == "Terminating session: None"
        )


def install_noisy_log_filters() -> None:
    """Install targeted filters for known noisy third-party log lines."""
    target_logger = logging.getLogger("mcp.server.streamable_http")
    if not any(
        isinstance(existing, SuppressStatelessTransportTerminationFilter)
        for existing in target_logger.filters
    ):
        target_logger.addFilter(SuppressStatelessTransportTerminationFilter())


class EnhancedLogFormatter(logging.Formatter):
    """Custom log formatter that adds ASCII prefixes and visual enhancements to log messages."""

    # Color codes for terminals that support ANSI colors
    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
        "RESET": "\033[0m",  # Reset
    }

    def __init__(self, use_colors: bool = True, *args, **kwargs):
        """
        Initialize the emoji log formatter.

        Args:
            use_colors: Whether to use ANSI color codes (default: True)
        """
        super().__init__(*args, **kwargs)
        self.use_colors = use_colors

    def format(self, record: logging.LogRecord) -> str:
        """Format the log record with ASCII prefixes and enhanced styling."""
        # Get the appropriate ASCII prefix for the service
        service_prefix = self._get_ascii_prefix(record.name, record.levelname)

        # Format the message with enhanced styling
        formatted_msg = self._enhance_message(record.getMessage())

        # Build the formatted log entry
        if self.use_colors:
            color = self.COLORS.get(record.levelname, "")
            reset = self.COLORS["RESET"]
            return f"{service_prefix} {color}{formatted_msg}{reset}"
        else:
            return f"{service_prefix} {formatted_msg}"

    def _get_ascii_prefix(self, logger_name: str, level_name: str) -> str:
        """Get ASCII-safe prefix for Windows compatibility."""
        # ASCII-safe prefixes for different services
        ascii_prefixes = {
            "core.tool_tier_loader": "[TOOLS]",
            "core.tool_registry": "[REGISTRY]",
            "auth.scopes": "[AUTH]",
            "core.utils": "[UTILS]",
            "auth.google_auth": "[OAUTH]",
            "auth.credential_store": "[CREDS]",
            "gcalendar.calendar_tools": "[CALENDAR]",
            "gdrive.drive_tools": "[DRIVE]",
            "gmail.gmail_tools": "[GMAIL]",
            "gdocs.docs_tools": "[DOCS]",
            "gsheets.sheets_tools": "[SHEETS]",
            "gchat.chat_tools": "[CHAT]",
            "gforms.forms_tools": "[FORMS]",
            "gslides.slides_tools": "[SLIDES]",
            "gtasks.tasks_tools": "[TASKS]",
            "gsearch.search_tools": "[SEARCH]",
            "auth.service_decorator": "[TOOL]",
            "gcontacts.contacts_tools": "[CONTACTS]",
            "gappsscript.apps_script_tools": "[APPSCRIPT]",
        }

        return ascii_prefixes.get(logger_name, f"[{level_name}]")

    def _enhance_message(self, message: str) -> str:
        """Enhance the log message with better formatting."""
        # Handle common patterns for better visual appeal

        # Tool tier loading messages
        if "resolved to" in message and "tools across" in message:
            # Extract numbers and service names for better formatting
            pattern = (
                r"Tier '(\w+)' resolved to (\d+) tools across (\d+) services: (.+)"
            )
            match = re.search(pattern, message)
            if match:
                tier, tool_count, service_count, services = match.groups()
                return f"Tool tier '{tier}' loaded: {tool_count} tools across {service_count} services [{services}]"

        # Configuration loading messages
        if "Loaded tool tiers configuration from" in message:
            path = message.split("from ")[-1]
            return f"Configuration loaded from {path}"

        # Tool filtering messages
        if "Tool tier filtering" in message:
            pattern = r"removed (\d+) tools, (\d+) enabled"
            match = re.search(pattern, message)
            if match:
                removed, enabled = match.groups()
                return f"Tool filtering complete: {enabled} tools enabled ({removed} filtered out)"

        # Enabled tools messages
        if "Scope management active for" in message:
            return message

        # Credentials directory messages
        if "Credentials directory permissions check passed" in message:
            path = message.split(": ")[-1]
            return f"Credentials directory verified: {path}"

        # If no specific pattern matches, return the original message
        return message


def setup_enhanced_logging(
    log_level: int = logging.INFO, use_colors: bool = True
) -> None:
    """
    Set up enhanced logging with ASCII prefix formatter for the entire application.

    Args:
        log_level: The logging level to use (default: INFO)
        use_colors: Whether to use ANSI colors (default: True)
    """
    # Create the enhanced formatter
    formatter = EnhancedLogFormatter(use_colors=use_colors)

    # Get the root logger
    root_logger = logging.getLogger()

    # Update existing console handlers
    for handler in root_logger.handlers:
        if isinstance(handler, logging.StreamHandler) and handler.stream.name in [
            "<stderr>",
            "<stdout>",
        ]:
            handler.setFormatter(formatter)

    # If no console handler exists, create one
    console_handlers = [
        h
        for h in root_logger.handlers
        if isinstance(h, logging.StreamHandler)
        and h.stream.name in ["<stderr>", "<stdout>"]
    ]

    if not console_handlers:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(log_level)
        root_logger.addHandler(console_handler)


def _resolve_log_dir() -> str:
    """Resolve the directory used for file logging.

    Priority:
    1. ``WORKSPACE_MCP_LOG_DIR`` (preferred)
    2. ``~/.google_workspace_mcp/logs`` (default)

    Tilde expansion is applied to env-var values so paths like ``~/logs`` work.
    """
    env_log_dir = os.getenv("WORKSPACE_MCP_LOG_DIR")
    if env_log_dir:
        return os.path.expanduser(env_log_dir)
    return os.path.join(os.path.expanduser("~"), ".google_workspace_mcp", "logs")


def configure_file_logging(logger_name: str | None = None) -> bool:
    """
    Configure file logging based on stateless mode setting.

    In stateless mode, file logging is completely disabled to avoid filesystem writes.
    In normal mode, sets up detailed file logging to 'mcp_server_debug.log'.

    The log directory defaults to ``~/.google_workspace_mcp/logs`` and may be
    overridden via the ``WORKSPACE_MCP_LOG_DIR`` environment variable.

    Args:
        logger_name: Optional name for the logger (defaults to root logger)

    Returns:
        bool: True if file logging was configured, False if skipped (stateless mode)
    """
    # Check if stateless mode is enabled
    stateless_mode = (
        os.getenv("WORKSPACE_MCP_STATELESS_MODE", "false").lower() == "true"
    )

    if stateless_mode:
        logger = logging.getLogger(logger_name)
        logger.debug("File logging disabled in stateless mode")
        return False

    # Configure file logging for normal mode
    try:
        target_logger = logging.getLogger(logger_name)

        # Write logs to user-specific directory, not the package directory
        log_dir = _resolve_log_dir()
        os.makedirs(log_dir, mode=0o700, exist_ok=True)
        log_file_path = os.path.join(log_dir, "mcp_server_debug.log")

        # Pre-create log file with restrictive permissions to avoid TOCTOU race
        fd = os.open(log_file_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        os.close(fd)

        file_handler = logging.FileHandler(log_file_path, mode="a")
        file_handler.setLevel(logging.DEBUG)

        file_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(process)d - %(threadName)s "
            "[%(module)s.%(funcName)s:%(lineno)d] - %(message)s"
        )
        file_handler.setFormatter(file_formatter)
        target_logger.addHandler(file_handler)

        logger = logging.getLogger(logger_name)
        logger.debug(f"Detailed file logging configured to: {log_file_path}")
        return True

    except Exception as e:
        log_file_path_str = locals().get("log_file_path", "<unknown>")
        sys.stderr.write(
            f"CRITICAL: Failed to set up file logging to '{log_file_path_str}': {e}\n"
        )
        return False

```

### Core Architecture Module: `core/portable_schema_middleware.py`
```
"""
Middleware that advertises tool input schemas every function-calling client accepts.
"""

from typing import Any, Dict, Sequence

from fastmcp.server.middleware import CallNext, Middleware, MiddlewareContext
from fastmcp.tools import Tool

_NULL_SCHEMA = {"type": "null"}
# Keywords whose value is a single subschema, a list of them, or a name -> subschema map.
_SUBSCHEMA_KEYS = ("items", "additionalProperties", "not")
_SUBSCHEMA_LIST_KEYS = ("anyOf", "oneOf", "allOf", "prefixItems")
_SUBSCHEMA_MAP_KEYS = ("properties", "patternProperties", "$defs", "definitions")


def portable_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``schema`` without null unions or ``const``.

    Pydantic renders ``Optional[T] = None`` as ``anyOf: [T, {type: null}]`` and
    ``Literal["x"]`` as ``const: "x"``. Gemini's function-declaration schema
    has neither list-valued ``type`` nor ``const``, so it rejects the whole
    catalog. Optional parameters are already absent from ``required``, and
    arguments are validated against the Python signature rather than this
    schema, so dropping the null branch changes nothing at runtime.
    """
    node = dict(schema)
    for key in _SUBSCHEMA_KEYS:
        if isinstance(node.get(key), dict):
            node[key] = portable_schema(node[key])
    for key in _SUBSCHEMA_LIST_KEYS:
        if key in node:
            node[key] = [portable_schema(sub) for sub in node[key]]
    for key in _SUBSCHEMA_MAP_KEYS:
        if key in node:
            node[key] = {name: portable_schema(sub) for name, sub in node[key].items()}

    if "const" in node:
        node["enum"] = [node.pop("const")]
    if isinstance(node.get("type"), list):
        types = [t for t in node["type"] if t != "null"]
        node["type"] = types[0] if len(types) == 1 else types
    for key in ("anyOf", "oneOf"):
        if _NULL_SCHEMA not in node.get(key, ()):
            continue
        variants = [sub for sub in node.pop(key) if sub != _NULL_SCHEMA]
        if len(variants) == 1:
            node = {**variants[0], **node}
        else:
            node[key] = variants
    return node


class PortableSchemaMiddleware(Middleware):
    """Rewrite each listed tool's input schema with :func:`portable_schema`.

    See https://github.com/taylorwilsdon/google_workspace_mcp/issues/1099
    """

    async def on_list_tools(
        self, context: MiddlewareContext, call_next: CallNext
    ) -> Sequence[Tool]:
        tools = await call_next(context)
        return [
            tool.model_copy(update={"parameters": portable_schema(tool.parameters)})
            for tool in tools
        ]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1218** (2026-10-02): **fix(gdrive): check every permission page before reporting link sharing off**
  *Symptoms*: `set_drive_file_permissions` now reads permissions through `list_all_permissions`, so an `anyone` permission past the first page is found and removed. Before, it reported `Link sharing: already off` while the file stayed public.  `test_link_sharing_off_finds_anyone_permission_on_a_later_page` fails with the source reverted. 2845 passed, ruff 0.15.22 clean.  Closes #1217   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Disabling link sharing now correctly removes “anyone” access even when it appears beyond the first page of permissions.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1218?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `dcabbf1d-3072-487a-b9a8-2b440ee59f13`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 0520b17a562c325f53
  > lgtm thanks!

- **Issue #1216** (2026-10-02): **fix: issues/1205**
  *Symptoms*: Closes #1205   ## Type of Change - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update  ## Testing - [ ] I have added tests that prove my fix is effective or that my feature works - [ ] New and existing unit tests pass locally with my changes - [ ] I have tested this change manually  ## Checklist - [ ] My code follows the style guidelines of this project - [ ] I have performed a self-review of my own code - [ ] I have commented my code, particularly in hard-to-understand areas - [ ] My changes generate no new warnings - [ ] **I have enabled "Allow edits from maintainers" for this pull request**  ## Additional Notes Add any other context about the pull request here.  ---  **⚠️ IMPORTANT:** This repository requires that you enable "Allow edits from maintainers" when creating your pull request. This allows maintainers to make small fixes and improvements directly to your branch, speeding up the review process.  To enable this setting: 1. When creating the PR, check the "Allow edits from maintainers" checkbox 2. If you've already created the PR, you can enable this in the PR sidebar under "Allow edits from maintainers"  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  ## Summary by CodeRabbit  * **Bug F
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1216?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `192c5adb-91c8-48ec-98f3-5f9b13645d85`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 177ad8d56131a5b3f3

- **Issue #1213** (2026-10-01): **_html_to_text strips all line breaks when generating text/plain fallback in draft_gmail_message and send_gmail_message**
  *Symptoms*: ### Summary In `gmail/gmail_tools.py`, when `body_format="html"` is used in `draft_gmail_message` or `send_gmail_message`, `_prepare_gmail_message` creates a `text/plain` fallback part using `_html_to_text(body).strip()`.  However, `_html_to_text` uses `_HTMLTextExtractor(HTMLParser)`, whose `get_text()` method collapses all whitespace runs (including newlines and block elements) into single spaces: ```python def get_text(self) -> str:     return " ".join("".join(self._text).split()) ``` Additionally, `_HTMLTextExtractor.handle_starttag` only handles `<br>` by appending a single space `" "`, and completely ignores block tags (`<p>`, `<div>`, `<tr>`, `<li>`).  ### Impact 1. Every HTML email or draft generated with `body_format="html"` has its `text/plain` alternative part completely flattened into a single run-on sentence with zero line breaks. 2. Email clients that display or sync the plaintext fallback (e.g. Superhuman draft sync, Apple Mail notification previews, terminal/text-only email clients) display the message with all line and paragraph breaks removed. 3. Note that `_HTMLSignatureExtractor` in `gmail/gmail_helpers.py` already solves this for signatures by preserving block-level line breaks; `_HTMLTextExtractor` was left in place for bodies.  ### Suggested Fix Update `_HTMLTextExtractor` to emit newlines on block tags (`<p>`, `<div>`, `<br>`, `<li>`, `<tr>`) and have `get_text()` collapse only horizontal whitespace while preserving newlines (matching the logic in `_HT
  **Post-Mortem & Fix Analysis**:
  > Hey there, appreciate the detailed write-up. This was already fixed some time back, make sure you're running the latest version. Since v1.25.0, _prepare_gmail_message builds the text/plain alternative with html_to_text_preserving_breaks() (the same block-aware converter used for signatures), not _html_to_text(). You can see it in gmail/gmail_tools.py where the HTML branch calls html_to_text_preserving_breaks(body). _html_to_text() is only used on the read side, where single-line output is intended. If you're still seeing flattened plaintext on the latest release, please share the version and a sample HTML body and we'll reopen. Closing as already resolved.

- **Issue #1204** (2026-10-01): **bug: Valkey patch**
  *Symptoms*: ## Description Brief description of the changes in this PR.  ## Type of Change - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update  ## Testing - [ ] I have added tests that prove my fix is effective or that my feature works - [ ] New and existing unit tests pass locally with my changes - [ ] I have tested this change manually  ## Checklist - [ ] My code follows the style guidelines of this project - [ ] I have performed a self-review of my own code - [ ] I have commented my code, particularly in hard-to-understand areas - [ ] My changes generate no new warnings - [ ] **I have enabled "Allow edits from maintainers" for this pull request**  ## Additional Notes Add any other context about the pull request here.  ---  **⚠️ IMPORTANT:** This repository requires that you enable "Allow edits from maintainers" when creating your pull request. This allows maintainers to make small fixes and improvements directly to your branch, speeding up the review process.  To enable this setting: 1. When creating the PR, check the "Allow edits from maintainers" checkbox 2. If you've already created the PR, you can enable this in the PR sidebar under "Allow edits from maintainers"  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by Cod
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1204?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `638d94df-44e3-42e0-85fe-476484f770f2`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6b2d8ca2378c524b5c

- **Issue #1203** (2026-10-04): **fix(drive): normalize v2 title to v3 name in search_drive_files**
  *Symptoms*: search_drive_files passed structured queries as-is, so title contains test reached Drive API v3 as (title contains test) and trashed=false and failed with Invalid Value. Add normalize_drive_query_v2_compat() in gdrive/drive_helpers.py (literal-aware, handles title->name, createdDate->createdTime, modifiedDate->modifiedTime, lastViewedByMeDate->viewedByMeTime) and apply it in search_drive_files before trashed/file_type handling. Preserves trashed=false, page_size, OAuth, readonly, existing filters. Adds 6 tests. 149 passed in tests/gdrive/test_drive_tools.py.  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Bug Fixes**   * Google Drive searches now support legacy query fields for file titles and dates. These fields are translated to current equivalents, including in queries that combine multiple fields, while quoted values and longer identifiers remain unchanged. Legacy-field searches continue to work alongside trash and file-type filters.   * Free-text searches now correctly escape apostrophes and backslashes, helping queries with these characters work as expected. <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1203?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization UI - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `463896a4-efca-4f30-abea-70a5ee5bb9bd`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that
  > Thanks! 

- **Issue #1200** (2026-09-29): **fix(gchat): say how many spaces search_messages searched**
  *Symptoms*: When `max_spaces` or the 100-space listing cut the search short, the result now says `in the first N accessible spaces` instead of `in all accessible spaces`. Nothing else changes.  `test_search_messages_reports_how_many_spaces_it_searched` covers a list longer than `max_spaces`, a list with a `nextPageToken`, and a list that fits. The first two fail with the source reverted.  2833 passed. `ruff check` and `ruff format --check` clean on 0.15.22.  Closes #1199   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Search results now clarify when a search covers only the first two accessible spaces, rather than all accessible spaces.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1200?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `d18f6eb8-5620-47f0-be70-4580acf09e89`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6fdce7a3b8a1a03f5f
  > Clean, thanks

- **Issue #1199** (2026-09-29): **search_messages says "all accessible spaces" after searching only the first 10**
  *Symptoms*: Without `space_id`, `search_messages` lists spaces once (`pageSize=100`, no pagination) and searches only the first `max_spaces` (default 10) (`gchat/chat_tools.py:433-438`). The result still says `in all accessible spaces` (`:488`), including "No messages found", so a user with more than 10 spaces is told a message doesn't exist when it was never searched.  **Expected.** Say how many spaces were searched when the list was cut. 

- **Issue #1196** (2026-10-04): **fix(auth): default an omitted OAuth scope to the registered scopes**
  *Symptoms*: ## Description  Fixes #1195.  In OAuth 2.1 mode, an authorization request without `scope` (RFC 6749 section 3.3 allows this) made FastMCP's OAuth proxy fall back to `required_scopes`. Those hold only the identity scopes (#733), so the client got a token that passes protocol-level auth but that no tool can use.  `WorkspaceGoogleProvider` subclasses `GoogleProvider` and overrides `authorize()`. When the request has no scopes, it fills in:  - the scopes the client registered with, - limited to the server's `valid_scopes`, - plus the identity scopes in `required_scopes`.  Then it calls the normal `authorize()`. Requests that include `scope` are unchanged.  A client that registered without `scope` already has every tool scope, through the DCR `default_scopes` and the CIMD default that `configure_server_for_http()` sets. So an omitted `scope` now behaves as if the client had sent its registered scopes. The limit to `valid_scopes` matters when client registrations persist (disk or Valkey storage) across a change to the enabled tools or to `--read-only`: the default never asks Google for a scope that the server no longer offers.  fastmcp 3.4.7 (in `uv.lock`) and 4.0.10 both fall back to `required_scopes` for an omitted scope, so the override is necessary on both.  ### Relation to #1171  #1171 adds a `WorkspaceGoogleProvider` subclass with the same name, at the same place in `core/server.py`, and makes the same four test monkeypatch changes. The two fixes are independent (#1171: the f
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taylorwilsdon/google_workspace_mcp/pull/1196?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `102fca4c-6dd9-48c7-8ff0-d1b4c1e5f6d8`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6fdce7a3b8a1a03f5f
  > About the CodeRabbit security note (an omitted `scope` now requests every offered tool scope for a client that registered with the default): this is intended.  - The registered scopes are the pre-defined default that RFC 6749 section 3.3 asks for. A client can already request all of them explicitly, because the MCP SDK checks an explicit `scope` only against the registration. - The new default is the intersection of the registration and `valid_scopes`, so it never goes past either. The only additions are the identity scopes, which the old fallback requested anyway. - Consent still applies. FastMCP's consent page now lists these scopes under "Requested Scopes". Before this change it showed "None" for such a request, and Google was then asked for the identity scopes. The user then approves the same scopes on Google's consent screen. 
  > Thanks! I've merged a temporary fix and opened https://github.com/PrefectHQ/fastmcp/issues/5442 - will sort out upstream 

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

### Incident Patch 1: `7c04d661` (2026-10-04)
**Commit Message**: Merge pull request #1214 from fatherlinux/feature/tab-id-for-doc-reads

feat(docs): add tab_id parameter to get_doc_content and get_doc_as_markdown

**File**: `gdocs/docs_markdown.py` (modified, +4/-2)
```diff
@@ -614,12 +614,14 @@ def _format_footnote(num: int, comment: dict[str, Any]) -> str:
     return "\n".join(lines)
 
 
-def format_comments_appendix(comments: list[dict[str, Any]]) -> str:
+def format_comments_appendix(
+    comments: list[dict[str, Any]], title: str = "Comments"
+) -> str:
     """Format comments as an appendix section with blockquoted anchors."""
     if not comments:
         return ""
 
-    lines = ["## Comments", ""]
+    lines = [f"## {title}", ""]
     for comment in comments:
         resolved_tag = " *(Resolved)*" if comment.get("resolved") else ""
         anchor = comment.get("anchor_text", "")
```

**File**: `gdocs/docs_tools.py` (modified, +69/-16)
```diff
@@ -10,6 +10,7 @@
 import inspect
 import re
 from typing import List, Any, Literal, Optional, Union
+from urllib.parse import parse_qs, urlsplit
 
 from typing_extensions import TypedDict
 
@@ -128,6 +129,35 @@ def _tab_title(tab: dict) -> str:
     return tab.get("tabProperties", {}).get("title", "Untitled Tab")
 
 
+def _parse_doc_reference(
+    document_id: str, tab_id: Optional[str]
+) -> tuple[str, Optional[str], bool]:
+    """Split a document ID or URL into (document_id, tab_id, tab_from_url).
+
+    A URL's ?tab= selects that tab unless tab_id was passed explicitly.
+    """
+    url_match = re.search(r"/d/([\w-]+)", document_id)
+    if not url_match:
+        return document_id, tab_id, False
+    url_tabs = parse_qs(urlsplit(document_id).query).get("tab", [])
+    if tab_id is None and url_tabs:
+        return url_match.group(1), url_tabs[0], True
+    return url_match.group(1), tab_id, False
+
+
+def _url_tab_notice(tabs: list, tab: dict, tab_id: str) -> str:
+    """Say when a tab picked from a URL hid other tabs.
+
+    Browsers add ?tab= to every Docs URL, so the caller may not expect it.
+    """
+    if tabs == [tab] and not tab.get("childTabs"):
+        return ""
+    return (
+        f"Showing only tab '{_tab_title(tab)}' ({tab_id}) from the URL; "
+        'pass tab_id="" to read every tab.'
+    )
+
+
 @server.tool(
     title="Search Docs",
     annotations=ToolAnnotations(
@@ -253,7 +283,8 @@ async def get_doc_content(
 
     Args:
         user_google_email: User's Google email address
-        document_id: ID of the Google Doc (or full URL)
+        document_id: ID of the Google Doc or Drive file (or full URL). A Docs
+            URL's ?tab= selects that tab unless tab_id is also specified.
         suggestions_view_mode: How to render suggestions in the returned content:
             - "DEFAULT_FOR_CURRENT_ACCESS": Default based on user's access level
             - "SUGGESTIONS_INLINE": Suggested changes appear inline in the document
@@ -263,6 +294,8 @@ async def get_doc_content(
             When given, only that tab's content is returned with no tab separator,
             so the default output stays index-aligned with that tab. When
             omitted, every tab is returned with "--- TAB: ... ---" markers.
+            Pass "" to read every tab of a URL that carries ?tab=. This
+            filters output only: the whole document is still fetched.
         preserve_context: Include readable semantic annotations for native Docs.
             Defaults to False to retain index alignment. Office extraction is
             unaffected. With tab_id, only the selected tab is rendered.
@@ -273,8 +306,9 @@ async def get_doc_content(
     validation_error = validate_suggestions_view_mode(suggestions_view_mode)
     if validation_error:
         return validation_error
+    document_id, tab_id, tab_from_url = _parse_doc_reference(document_id, tab_id)
     logger.info(
-        f"[get_doc_content] Invoked. Document/File ID: '{document_id}' for user '{user_google_email}'"
+        f"[get_doc_content] Invoked. Document/File ID: '{document_id}', tab: '{tab_id}' for user '{user_google_email}'"
     )
 
     file_metadata = await asyncio.to_thread(
@@ -295,6 +329,7 @@ async def get_doc_content(
     )
 
     body_text = ""
+    notice = ""
 
     if mime_type == "application/vnd.google-apps.document":
         logger.info("[get_doc_content] Processing as native Google Doc.")
@@ -308,11 +343,14 @@ async def get_doc_content(
             .execute
         )
         if tab_id:
-            tab = _find_tab(doc_data.get("tabs", []), tab_id)
+            tabs = doc_data.get("tabs", [])
+            tab = _find_tab(tabs, tab_id)
             if tab is None:
                 return f"Error: Tab {tab_id} not found in document."
             if "documentTab" not in tab:
                 return f"Error: Tab {tab_id} is not a document tab and has no body content."
+            if tab_from_url:
+                notice = _url_tab_notice(tabs, tab, tab_id)
             # No tab separator: the caller named one tab. The default output
             # stays index-aligned; context annotations are opt-in.
             file_name = f"{file_name} [tab: {_tab_title(tab)}]"
@@ -408,9 +446,13 @@ async def get_doc_content(
                     f"{len(file_content_bytes)} bytes]"
                 )
 
+    # The notice stays above the content marker so content offsets keep their
+    # alignment with document indices.
     header = (
         f'File: "{file_name}" (ID: {document_id}, Type: {mime_type})\n'
-        f"Link: {web_view_link}\n\n--- CONTENT ---\n"
+        f"Link: {web_view_link}\n"
+        + (f"{notice}\n" if notice else "")
+        + "\n--- CONTENT ---\n"
     )
     return header + body_text
 
@@ -2673,7 +2715,9 @@ async def get_doc_as_markdown(
 
     Args:
         user_google_email: User's Google email address
-        document_id: ID of the Google Doc (or full URL)
+        document_id: ID of th
```

**File**: `tests/gdocs/test_read_tab_selection.py` (modified, +162/-0)
```diff
@@ -134,6 +134,168 @@ async def test_get_doc_content_finds_a_nested_child_tab():
     assert result.split("--- CONTENT ---\n", 1)[1] == "Child text\n"
 
 
+DOC_URL = "https://docs.google.com/document/d/doc123/edit"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("tab_value", ["t.week2", "t%2Eweek%32"])
+async def test_get_doc_content_extracts_the_id_and_tab_from_a_url(tab_value):
+    drive = _drive_service()
+    docs = _docs_service(TABBED_DOC)
+
+    result = await _unwrap(docs_tools.get_doc_content)(
+        drive_service=drive,
+        docs_service=docs,
+        user_google_email="user@example.com",
+        document_id=f"{DOC_URL}?tab={tab_value}",
+    )
+
+    assert drive.files.return_value.get.call_args.kwargs["fileId"] == "doc123"
+    assert docs.documents.return_value.get.call_args.kwargs["documentId"] == "doc123"
+    header, content = result.split("--- CONTENT ---\n", 1)
+    # The notice sits in the header so the content stays index-aligned.
+    assert content == "Second week notes\n"
+    assert "Showing only tab 'Week 2' (t.week2)" in header
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("suffix", ["", "#?tab=t.week2", "#heading=h.x&tab=t.week2"])
+async def test_get_doc_content_reads_every_tab_of_a_url_without_tab(suffix):
+    drive = _drive_service()
+
+    result = await _unwrap(docs_tools.get_doc_content)(
+        drive_service=drive,
+        docs_service=_docs_service(TABBED_DOC),
+        user_google_email="user@example.com",
+        document_id=f"{DOC_URL}{suffix}",
+    )
+
+    assert drive.files.return_value.get.call_args.kwargs["fileId"] == "doc123"
+    assert "First week notes" in result
+    assert "Second week notes" in result
+    assert "Showing only tab" not in result
+
+
+async def _get_doc_as_markdown(doc, comments=None, **kwargs):
+    drive = Mock()
+    drive.comments.return_value.list.return_value.execute = Mock(
+        return_value={"comments": comments or []}
+    )
+    docs = _docs_service(doc)
+    result = await _unwrap(docs_tools.get_doc_as_markdown)(
+        drive_service=drive,
+        docs_service=docs,
+        user_google_email="user@example.com",
+        **kwargs,
+    )
+    assert docs.documents.return_value.get.call_args.kwargs["documentId"] == "doc123"
+    return result
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("tab_value", ["t.week2", "t%2Eweek%32"])
+async def test_get_doc_as_markdown_reads_the_tab_named_in_the_url(tab_value):
+    result = await _get_doc_as_markdown(
+        TABBED_DOC,
+        document_id=f"{DOC_URL}?usp=sharing&tab={tab_value}#heading=h.x",
+        include_comments=False,
+    )
+
+    assert "Second week notes" in result
+    assert "First week notes" not in result
+    # Browsers add ?tab= to every URL, so the narrowed read must say so.
+    assert "Showing only tab 'Week 2' (t.week2)" in result
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("fragment", ["?tab=t.week2", "heading=h.x&tab=t.week2"])
+async def test_get_doc_as_markdown_ignores_tab_parameters_in_the_fragment(fragment):
+    result = await _get_doc_as_markdown(
+        TABBED_DOC,
+        document_id=f"{DOC_URL}#{fragment}",
+        include_comments=False,
+    )
+
+    assert "First week notes" in result
+    assert "Second week notes" in result
+    assert "Showing only tab" not in result
+
+
+@pytest.mark.asyncio
+async def test_get_doc_as_markdown_explicit_tab_id_overrides_the_url():
+    result = await _get_doc_as_markdown(
+        TABBED_DOC,
+        document_id=f"{DOC_URL}?tab=t.week2",
+        tab_id="t.week1",
+        include_comments=False,
+    )
+
+    assert result == "First week notes\n"
+
+
+@pytest.mark.asyncio
+async def test_get_doc_as_markdown_empty_tab_id_reads_every_tab_of_a_url():
+    result = await _get_doc_as_markdown(
+        TABBED_DOC,
+        document_id=f"{DOC_URL}?tab=t.week2",
+        tab_id="",
+        include_comments=False,
+    )
+
+    assert "First week notes" in result
+    assert "Second week notes" in result
+
+
+@pytest.mark.asyncio
+async def test_get_doc_as_markdown_url_tab_of_a_single_tab_doc_adds_no_notice():
+    result = await _get_doc_as_markdown(
+        {"tabs": [_tab("t.0", "Tab 1", "Only tab\n")]},
+        document_id=f"{DOC_URL}?tab=t.0",
+        include_comments=False,
+    )
+
+    assert result == "Only tab\n"
+
+
+@pytest.mark.asyncio
+async def test_get_doc_as_markdown_selected_parent_excludes_child_tabs():
+    doc = {
+        "tabs": [
+            _tab(
+                "t.parent",
+                "Parent",
+                "Parent text\n",
+                [_tab("t.child", "Child", "Child text\n")],
+            )
+        ]
+    }
+
+    result = await _get_doc_as_markdown(
+        doc, document_id="doc123", tab_id="t.parent", include_comments=False
+    )
+
+    assert result == "Parent text\n"
+
+
+@pytest.mark.asyncio
+async def test_get_doc_as_markdown_keeps_comments_document_wide_for_one_tab():
+    comment = {
+        "content": "Belongs
```

---

### Incident Patch 2: `96d32164` (2026-10-04)
**Commit Message**: Merge pull request #1203 from hungpt99-dev/fix/drive-v2-title-to-name-compat

fix(drive): normalize v2 title to v3 name in search_drive_files

**File**: `gdrive/drive_helpers.py` (modified, +28/-0)
```diff
@@ -264,6 +264,34 @@ def has_explicit_trashed_clause(query: str) -> bool:
     return bool(TRASHED_CLAUSE_PATTERN.search(without_literals))
 
 
+# Drive API v2 query field names and their v3 replacements, see
+# https://developers.google.com/drive/api/guides/v2-to-v3-reference
+DRIVE_V2_TO_V3_QUERY_FIELD_MAP = {
+    "title": "name",
+    "createddate": "createdTime",
+    "modifieddate": "modifiedTime",
+    "lastviewedbymedate": "viewedByMeTime",
+}
+
+# Literals are matched first so field names inside quoted values are left alone.
+_DRIVE_V2_FIELD_OR_LITERAL_PATTERN = re.compile(
+    rf"({QUERY_STRING_LITERAL_PATTERN.pattern})"
+    rf"|\b({'|'.join(DRIVE_V2_TO_V3_QUERY_FIELD_MAP)})\b",
+    re.IGNORECASE,
+)
+
+
+def normalize_drive_query_v2_compat(query: str) -> str:
+    """Rewrite Drive API v2 field names outside string literals to their v3 names.
+
+    ``title contains 'title'`` becomes ``name contains 'title'``.
+    """
+    return _DRIVE_V2_FIELD_OR_LITERAL_PATTERN.sub(
+        lambda m: m.group(1) or DRIVE_V2_TO_V3_QUERY_FIELD_MAP[m.group(2).lower()],
+        query,
+    )
+
+
 # Precompiled regex patterns for Drive query detection
 DRIVE_QUERY_PATTERNS = [
     re.compile(r'\b\w+\s*(=|!=|>|<)\s*[\'"].*?[\'"]', re.IGNORECASE),  # field = 'value'
```

**File**: `gdrive/drive_tools.py` (modified, +8/-5)
```diff
@@ -86,6 +86,7 @@
     has_explicit_trashed_clause,
     initiate_resumable_upload_session,
     native_replace_format_map,
+    normalize_drive_query_v2_compat,
     reject_sources_with_upload_url,
     resolve_drive_item,
     resolve_file_type_mime,
@@ -209,13 +210,15 @@ async def search_drive_files(
     is_structured_query = any(pattern.search(query) for pattern in DRIVE_QUERY_PATTERNS)
 
     if is_structured_query:
-        final_query = query
-        logger.debug(
-            f"[search_drive_files] Using structured query as-is: '{final_query}'"
-        )
+        final_query = normalize_drive_query_v2_compat(query)
+        if final_query != query:
+            logger.info(
+                "[search_drive_files] Normalized v2 query field names to v3 equivalents"
+            )
+        logger.debug(f"[search_drive_files] Using structured query: '{final_query}'")
     else:
         # For free text queries, wrap in fullText contains
-        escaped_query = query.replace("'", "\\'")
+        escaped_query = query.replace("\\", "\\\\").replace("'", "\\'")
         final_query = f"fullText contains '{escaped_query}'"
         logger.debug(
             f"[search_drive_files] Reformatting free text query '{query}' to '{final_query}'"
```

**File**: `tests/gdrive/test_drive_tools.py` (modified, +124/-0)
```diff
@@ -24,6 +24,7 @@
     _create_drive_folder_impl,
     build_drive_list_params,
     has_explicit_trashed_clause,
+    normalize_drive_query_v2_compat,
     resolve_drive_item,
 )
 from gdrive.drive_tools import (
@@ -3356,3 +3357,126 @@ async def test_check_drive_file_public_access_shared_drive(mock_resolve):
 
     assert "PUBLIC ACCESS ENABLED" in result
     assert "Shared: True" in result
+
+
+# ---------------------------------------------------------------------------
+# search_drive_files - Drive API v2 -> v3 query compat (title -> name)
+# ---------------------------------------------------------------------------
+
+
+def test_normalize_drive_query_v2_title_contains():
+    """v2 `title contains` is rewritten to v3 `name contains`."""
+    assert (
+        normalize_drive_query_v2_compat("title contains 'test'")
+        == "name contains 'test'"
+    )
+
+
+def test_normalize_drive_query_v2_preserves_literals():
+    """Quoted values mentioning v2 names are data, not fields."""
+    assert (
+        normalize_drive_query_v2_compat("name contains 'title'")
+        == "name contains 'title'"
+    )
+    assert (
+        normalize_drive_query_v2_compat("name contains \"title contains 'test'\"")
+        == "name contains \"title contains 'test'\""
+    )
+    assert (
+        normalize_drive_query_v2_compat("name contains 'it\\'s title' and title = 'a'")
+        == "name contains 'it\\'s title' and name = 'a'"
+    )
+
+
+def test_normalize_drive_query_v2_whole_words_any_case():
+    """Matching is case-insensitive but never touches longer identifiers."""
+    assert (
+        normalize_drive_query_v2_compat(
+            "TITLE = 'a' or subtitle = 'b' or title_x = 'c'"
+        )
+        == "name = 'a' or subtitle = 'b' or title_x = 'c'"
+    )
+
+
+def test_normalize_drive_query_v2_date_fields():
+    """v2 date fields map to v3 `Time` suffix equivalents."""
+    assert (
+        normalize_drive_query_v2_compat("modifiedDate > '2024-01-01T00:00:00Z'")
+        == "modifiedTime > '2024-01-01T00:00:00Z'"
+    )
+    assert (
+        normalize_drive_query_v2_compat("createdDate > '2024-01-01T00:00:00Z'")
+        == "createdTime > '2024-01-01T00:00:00Z'"
+    )
+    assert (
+        normalize_drive_query_v2_compat("lastViewedByMeDate > '2024-01-01T00:00:00Z'")
+        == "viewedByMeTime > '2024-01-01T00:00:00Z'"
+    )
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_normalizes_title_contains_to_name():
+    """`title contains 'test'` produces v3 `(name contains 'test') and trashed=false`."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="title contains 'test'",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert call_kwargs["q"] == "(name contains 'test') and trashed=false"
+    assert "title contains" not in call_kwargs["q"]
+    assert "name contains 'test'" in call_kwargs["q"]
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_normalizes_title_equals_to_name():
+    """`title = 'report'` is also a v2 field usage and must become v3 `name`."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="title = 'report'",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert call_kwargs["q"] == "(name = 'report') and trashed=false"
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_does_not_rewrite_quoted_title():
+    """A literal filename containing the word title is left untouched."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="name contains 'title'",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert call_kwargs["q"] == "(name contains 'title') and trashed=false"
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_escapes_free_text_literal():
+    """Backslashes and quotes in free text stay inside one literal, never rewritten."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="it's a title\\",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert (
+        call_kwargs["q"] == "(fullText contains 'it\\'s a title\\\\') and trashed=false"
+    )
```

---

### Incident Patch 3: `bffcf465` (2026-10-04)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/drive-v2-title-to-name-compat

**File**: `.github/instructions/general.instructions.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ You are an expert Python engineer with a specific expertise around FastMCP-based
 This repository (`google_workspace_mcp`) is a production‑grade FastMCP server that exposes Google Workspace‑tooling (Gmail, Calendar, Drive, Docs, Sheets, Slides, Chat, Tasks, Forms, Contacts, Search) to LLM clients.
 Key architectural pillars:
 
-* **FastMCP 3.x** for server/runtime, tool registration, validation and transports.
+* **FastMCP 4.x** for server/runtime, tool registration, validation and transports.
 * **Async Google client libraries** with OAuth 2.1 desktop‑flow and multi‑user token caching.
 * Strict typing & *pydantic‑v2* models for request/response schemas.
 * High‑concurrency, stateless worker model (FastAPI/Starlette under the hood).
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -44,4 +44,4 @@ ENV TOOLS=""
 
 # Use entrypoint for the base command and CMD for args
 ENTRYPOINT ["/bin/sh", "-c"]
-CMD ["uv run main.py --transport streamable-http ${TOOL_TIER:+--tool-tier \"$TOOL_TIER\"} ${TOOLS:+--tools $TOOLS}"]
+CMD ["exec /app/.venv/bin/python main.py --transport streamable-http ${TOOL_TIER:+--tool-tier \"$TOOL_TIER\"} ${TOOLS:+--tools $TOOLS}"]
```

**File**: `README.md` (modified, +6/-0)
```diff
@@ -256,10 +256,16 @@ Everything you need to run this in production lives in two places. The [document
 The **[Advanced Deployment guide](https://workspacemcp.com/docs/deployment?utm_source=github.com&utm_medium=referral&utm_campaign=readme&utm_content=deploy-advanced)** covers self-hosting specifics: reverse proxy setup with `WORKSPACE_EXTERNAL_URL` (including the nginx `Origin: null` consent workaround, the `WORKSPACE_MCP_ALLOW_NULL_ORIGIN_CONSENT` escape hatch, and the `Referrer-Policy` pitfall), origin validation and VS Code webview allowlisting, credential store backends (local directory or GCS with CMEK enforcement), and the **[complete environment variable reference](https://workspacemcp.com/docs/deployment?utm_source=github.com&utm_medium=referral&utm_campaign=readme&utm_content=deploy-env-vars#environment-variables)**.
 In external OAuth provider mode every request's `ya29.*` token is checked against Google's userinfo endpoint on a dedicated worker pool, and a request that finds the pool full is rejected with `401` rather than queued. The pool is shared by every caller of the process and defaults to 4 workers, so a gateway fronting many users should raise `WORKSPACE_MCP_TOKEN_VALIDATION_WORKERS` to the number of concurrent tool calls it expects. Invalid or non-positive values fail server startup.
 
+Tools run their blocking Google API requests on asyncio's default thread pool, which Python sizes at `min(32, CPU count + 4)` workers, so one process has at most that many Google requests in flight across all users. The default suits small containers. A busy multi-user deployment can raise `WORKSPACE_MCP_GOOGLE_API_WORKERS` to the number of concurrent tool calls it expects; the threads mostly wait on network I/O, so the count can exceed the CPU count. Unset keeps Python's default; invalid or non-positive values fail server startup.
+
 Set `WORKSPACE_MCP_TOKEN_VALIDATION_CACHE_TTL` to a number of seconds to remember each validated token's identity for that long, so repeat calls with the same token skip the round-trip and do not occupy a validation worker. Only a hash of the token is kept, and failures are never cached. The trade-off is that a token revoked or expired within the TTL still passes this check (Google rejects it on the actual API call), so keep the TTL short; values above 300 are clamped to 300. Unset or `0` disables the cache; invalid or negative values fail server startup.
 
+For orchestrators, `/health` is the liveness probe and never touches external systems. `/health/ready` is the readiness probe: it reads a sentinel key from the OAuth proxy storage backend and returns `200 {"storage": "ok"}`, or `503 {"storage": "unavailable", ...}` when the backend errors or takes longer than `WORKSPACE_MCP_READINESS_TIMEOUT_SECONDS` (default `1`; an invalid value logs a warning and uses the default). The memory backend answers locally, so it always reports ready; the disk backend also answers locally but can still return `503` on filesystem errors (e.g. an unreadable or permission-denied storage directory) or corrupt stored data. Point readiness, not liveness, at `/health/ready`, so an unreachable Valkey takes the instance out of rotation rather than restarting it.
+
 Optional per-download payload ceiling for container deployments: set `WORKSPACE_MCP_MAX_FILE_BYTES` to a positive byte count (e.g. `5242880` for 5 MiB) to reject Drive / Gmail / Chat / Google Docs downloads that would otherwise be fully buffered in-process. Unset or `0` leaves the total size uncapped; uncapped Drive transfers still use 256 KiB transport chunks instead of the Google client's 100 MiB default. This is a file-size limit, not a process-RSS limit: leave headroom for parsing, base64/JSON representation, and concurrent tool calls. Invalid or negative values fail server startup instead of silently disabling the limit. Downloads streamed directly to disk are not subject to this in-memory payload ceiling.
 
+Streamable HTTP sessions with no requests for `WORKSPACE_MCP_SESSION_IDLE_TIMEOUT` seconds (default `3660`, or 61 minutes) are closed and their memory freed, so sessions that clients abandon without sending `DELETE` do not accumulate for the life of the process. The default leaves one minute beyond the usual one-hour Google access-token lifetime. A client that returns after that gets `404 Session not found` and starts a new session, as the MCP spec requires. `0` defers to FastMCP's `FASTMCP_HTTP_SESSION_IDLE_TIMEOUT` setting; when that is also unset, sessions stay open indefinitely. Invalid or negative values fail server startup unless an explicit `session_idle_timeout` argument takes precedence. Stateless mode has no sessions and ignores this setting.
+
 In stateless mode, which has no attachment storage, `get_drive_file_download_url` returns the file itself as an embedded resource. `WORKSPACE_MCP_STATELESS_INLINE_MAX_BYTES` caps that inline file (default 10 MiB; `0` disables inline returns), and it never exceeds `WORKSPACE_MC
```

**File**: `auth/auth_info_middleware.py` (modified, +2/-7)
```diff
@@ -268,13 +268,8 @@ async def _process_request_for_auth(self, context: MiddlewareContext):
                 # This is ONLY safe in stdio mode because it's single-user
                 logger.debug("Checking for stdio mode authentication")
 
-                # Get the requested user from the context if available
-                requested_user = None
-                if hasattr(context, "request") and hasattr(context.request, "params"):
-                    requested_user = context.request.params.get("user_google_email")
-                elif hasattr(context, "arguments"):
-                    # FastMCP may store arguments differently
-                    requested_user = context.arguments.get("user_google_email")
+                arguments = getattr(context.message, "arguments", None) or {}
+                requested_user = arguments.get("user_google_email")
 
                 if requested_user:
                     try:
```

**File**: `auth/google_auth.py` (modified, +58/-10)
```diff
@@ -5,16 +5,20 @@
 import jwt
 import logging
 import os
+import time
 import webbrowser
 
-from typing import List, Optional, Tuple, Dict, Any
+from collections import deque
+from contextlib import contextmanager
+from typing import List, Optional, Tuple, Dict, Any, Iterator
 from urllib.parse import parse_qs, urlparse
 
 from google.oauth2.credentials import Credentials
 from google_auth_oauthlib.flow import Flow
 from google.auth.transport.requests import Request
 from google.auth.exceptions import RefreshError
-from googleapiclient.discovery import build
+import google.auth.credentials
+from googleapiclient.discovery import Resource, build
 from googleapiclient.errors import HttpError
 import httplib2
 import google_auth_httplib2
@@ -91,14 +95,58 @@ def get_default_credentials_dir():
 DEFAULT_CREDENTIALS_DIR = get_default_credentials_dir()
 
 
-def _build_authorized_http(
-    credentials: Credentials, timeout: int = 30
-) -> google_auth_httplib2.AuthorizedHttp:
-    """Return credentialed HTTP with an explicit socket timeout."""
-    http = httplib2.Http(timeout=timeout)
+_HTTP_TIMEOUT_SECONDS = 30
+# httplib2 does not retry a request whose send fails on a connection the server
+# already dropped, so only reuse connections that were active recently.
+_HTTP_MAX_IDLE_SECONDS = 60
+# Raw httplib2.Http objects only: they hold sockets, never credentials, so a
+# pooled connection can safely serve any user's next request.
+_idle_http: deque[tuple[float, httplib2.Http]] = deque(maxlen=32)
+
+
+def _acquire_http() -> httplib2.Http:
+    """Pop the most recently released connection, or create a new one."""
+    try:
+        while True:
+            released_at, http = _idle_http.pop()
+            if time.monotonic() - released_at < _HTTP_MAX_IDLE_SECONDS:
+                return http
+            http.close()
+    except IndexError:
+        pass
+    http = httplib2.Http(timeout=_HTTP_TIMEOUT_SECONDS)
     # Drive uses 308 Resume Incomplete with Range during resumable uploads, not a redirect.
     http.redirect_codes = http.redirect_codes - {308}
-    return google_auth_httplib2.AuthorizedHttp(credentials, http=http)
+    return http
+
+
+def _build_authorized_http(
+    credentials: google.auth.credentials.Credentials,
+) -> google_auth_httplib2.AuthorizedHttp:
+    """Return credentialed HTTP over a pooled, timeout-bounded connection."""
+    return google_auth_httplib2.AuthorizedHttp(credentials, http=_acquire_http())
+
+
+def build_google_service(
+    service_name: str, version: str, credentials: google.auth.credentials.Credentials
+) -> Resource:
+    """Build a discovery client on a pooled, timeout-bounded connection."""
+    return build(service_name, version, http=_build_authorized_http(credentials))
+
+
+@contextmanager
+def recycling(service: Resource) -> Iterator[Resource]:
+    """Like contextlib.closing, but return the connection to the pool on success.
+
+    After an error or cancellation a worker thread may still be mid-request on
+    this connection, so it is closed instead and never shared with another call.
+    """
+    try:
+        yield service
+    except BaseException:
+        service.close()
+        raise
+    _idle_http.append((time.monotonic(), service._http.http))
 
 
 # Session credentials now handled by OAuth21SessionStore - no local cache needed
@@ -1262,7 +1310,7 @@ def get_user_info(
     try:
         # Using googleapiclient discovery to get user info
         # Requires 'google-api-python-client' library
-        service = build("oauth2", "v2", http=_build_authorized_http(credentials))
+        service = build_google_service("oauth2", "v2", credentials)
         user_info = service.userinfo().get().execute()
         logger.info(f"Successfully fetched user info: {user_info.get('email')}")
         return user_info
@@ -1411,7 +1459,7 @@ async def get_authenticated_google_service(
         raise GoogleAuthenticationError(auth_response)
 
     try:
-        service = build(service_name, version, http=_build_authorized_http(credentials))
+        service = build_google_service(service_name, version, credentials)
         log_user_email = user_google_email
 
         # Try to get email from credentials if needed for validation
```

**File**: `auth/google_oauth_provider.py` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+"""Google OAuth defaults independent of protocol-level token requirements."""
+
+from fastmcp.server.auth.providers.google import GoogleProvider as _GoogleProvider
+from mcp.server.auth.provider import AuthorizationParams
+from mcp.shared.auth import OAuthClientInformationFull
+
+
+class GoogleProvider(_GoogleProvider):
+    async def authorize(
+        self, client: OAuthClientInformationFull, params: AuthorizationParams
+    ) -> str:
+        # FastMCP falls back to required_scopes for scope-less authorization,
+        # even when DCR/CIMD defaults advertise the enabled Workspace scopes.
+        # Keep bearer validation minimal while requesting the configured defaults.
+        # An explicit scope selection must remain the client's choice.
+        if not params.scopes:
+            params = params.model_copy(
+                update={"scopes": self._default_scope_str.split()}
+            )
+        return await super().authorize(client, params)
```

**File**: `auth/oauth21_session_store.py` (modified, +5/-3)
```diff
@@ -679,7 +679,9 @@ def store_session(
                 # Create immutable session binding (first binding wins, cannot be changed)
                 if mcp_session_id not in self._session_auth_binding:
                     self._session_auth_binding[mcp_session_id] = user_email
-                    logger.info(
+                    # Debug: sessionless (2026-07-28) clients get a new session ID
+                    # on every request, so this fires per tool call.
+                    logger.debug(
                         f"Created immutable session binding: {mcp_session_id} -> {user_email}"
                     )
                 elif self._session_auth_binding[mcp_session_id] != user_email:
@@ -692,7 +694,7 @@ def store_session(
                     )
 
                 self._mcp_session_mapping[mcp_session_id] = user_email
-                logger.info(
+                logger.debug(
                     f"Stored OAuth 2.1 session for {user_email} (session_id: {session_id}, mcp_session_id: {mcp_session_id})"
                 )
             else:
@@ -1231,7 +1233,7 @@ def get_credentials_from_token(
         # credentials during request authentication by
         # ``ensure_session_from_access_token`` and cached in the session store,
         # which is the ``store.get_credentials`` lookup above. There is no
-        # token-keyed provider cache to consult here on fastmcp 3.x.
+        # token-keyed provider cache to consult here.
 
         # Create minimal credentials with just the access token
         # Assume token is valid for 1 hour (typical for Google tokens)
```

**File**: `auth/service_decorator.py` (modified, +41/-12)
```diff
@@ -11,9 +11,13 @@
 
 from google.auth.exceptions import RefreshError
 from google.oauth2 import service_account as google_service_account
-from googleapiclient.discovery import build
 from fastmcp.server.dependencies import get_access_token, get_context
-from auth.google_auth import get_authenticated_google_service, GoogleAuthenticationError
+from auth.google_auth import (
+    GoogleAuthenticationError,
+    build_google_service,
+    get_authenticated_google_service,
+    recycling,
+)
 from auth.gateway_identity import (
     require_gateway_principal,
     get_verified_gateway_principal,
@@ -77,6 +81,19 @@
 logger = logging.getLogger(__name__)
 
 
+class GoogleScopeError(GoogleAuthenticationError):
+    """The authenticated account has not granted this tool's permissions."""
+
+
+def _missing_scope_message(service_name: str, error: GoogleScopeError) -> str:
+    return (
+        f"Permission required for {service_name}: {error}. "
+        "Reconnect using your MCP client's OAuth flow and grant access to this "
+        "service if it is available for your account. Other services with granted "
+        "permissions remain usable."
+    )
+
+
 def _release_google_service_cycles() -> None:
     """Collect cyclic references retained by googleapiclient Resource objects."""
     gc.collect()
@@ -353,7 +370,7 @@ async def _authenticate_service(
         credentials = _get_service_account_credentials(
             _widen_drive_scope_for_dwd(resolved_scopes, tool_name), target_email
         )
-        service = build(service_name, service_version, credentials=credentials)
+        service = build_google_service(service_name, service_version, credentials)
         logger.info(
             f"[{tool_name}] Authenticated {service_name} for "
             f"{target_email} via service-account"
@@ -434,11 +451,11 @@ async def get_authenticated_google_service_oauth21(
             scopes_available = set(access_token.scopes)
 
         if not has_required_scopes(scopes_available, required_scopes):
-            raise GoogleAuthenticationError(
+            raise GoogleScopeError(
                 f"OAuth credentials lack required scopes. Need: {required_scopes}, Have: {sorted(scopes_available)}"
             )
 
-        service = build(service_name, version, credentials=credentials)
+        service = build_google_service(service_name, version, credentials)
         logger.info(
             f"[{tool_name}] Authenticated {service_name} for "
             f"{resolved_email} via oauth2.1"
@@ -467,11 +484,11 @@ async def get_authenticated_google_service_oauth21(
         scopes_available = set(credentials.scopes)
 
     if not has_required_scopes(scopes_available, required_scopes):
-        raise GoogleAuthenticationError(
+        raise GoogleScopeError(
             f"OAuth 2.1 credentials lack required scopes. Need: {required_scopes}, Have: {sorted(scopes_available)}"
         )
 
-    service = build(service_name, version, credentials=credentials)
+    service = build_google_service(service_name, version, credentials)
     logger.info(
         f"[{tool_name}] Authenticated {service_name} for "
         f"{user_google_email} via oauth2.1"
@@ -863,6 +880,11 @@ async def wrapper(*args, **kwargs):
                     mcp_session_id,
                     authenticated_user,
                 )
+            except GoogleScopeError as e:
+                logger.info(
+                    "[%s] Missing %s permissions: %s", tool_name, service_name, e
+                )
+                return _missing_scope_message(service_name, e)
             except GoogleAuthenticationError as e:
                 logger.error(
                     f"[{tool_name}] Auth failed for {user_google_email} | "
@@ -878,16 +900,15 @@ async def wrapper(*args, **kwargs):
                     kwargs["user_google_email"] = user_google_email
 
                 # Prepend the fetched service object to the original arguments
-                return await func(service, *args, **kwargs)
+                with recycling(service):
+                    return await func(service, *args, **kwargs)
             except RefreshError as e:
                 error_message = _handle_token_refresh_error(
                     e, actual_user_email, service_name
                 )
                 raise GoogleAuthenticationError(error_message)
             finally:
-                if service:
-                    service.close()
-                    _release_google_service_cycles()
+                _release_google_service_cycles()
 
         # Set the wrapper's signature to the one without 'service'
         wrapper.__signature__ = wrapper_sig
@@ -1019,9 +1040,17 @@ async def wrapper(*args, **kwargs):
 
                             # Inject service with specified parameter name
                             kwargs[param_name] = service
-                            stack.callback(service.close)
+                            stack.enter_context(recycling(service))
          
```

---

### Incident Patch 4: `683d13e4` (2026-10-03)
**Commit Message**: fix(sheets): ignore empty cell and fail on missing comment ID

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `core/comments.py` (modified, +2/-2)
```diff
@@ -47,12 +47,12 @@ async def _manage_comment_dispatch(
 ) -> str:
     """Route comment management actions to the appropriate implementation."""
     action_lower = action.lower().strip()
-    if cell is not None and action_lower != "create":
+    if cell and action_lower != "create":
         raise ValueError("cell is only supported for the create action")
     if action_lower == "create":
         if not comment_content:
             raise ValueError("comment_content is required for create action")
-        if cell is not None:
+        if cell:
             return await _create_cell_comment_impl(
                 insert_cell_comment, sheets_service, file_id, cell, comment_content
             )
```

**File**: `gsheets/sheets_helpers.py` (modified, +6/-1)
```diff
@@ -1677,4 +1677,9 @@ async def _insert_cell_comment(
 
     replies = response.get("replies") or [{}]
     thread = replies[0].get("insertComment", {}).get("commentThread", {})
-    return thread.get("commentId", "")
+    comment_id = thread.get("commentId")
+    if not comment_id:
+        raise RuntimeError(
+            f"Sheets API did not return a comment ID for {cell}; the comment may not have been created."
+        )
+    return comment_id
```

**File**: `tests/gsheets/test_cell_comments.py` (modified, +36/-1)
```diff
@@ -29,8 +29,9 @@ def _mock_sheets_service(comment_id="thread-1"):
     service = Mock()
     spreadsheets = service.spreadsheets.return_value
     spreadsheets.get.return_value.execute.return_value = {"sheets": SHEETS}
+    thread = {"commentId": comment_id} if comment_id else {}
     spreadsheets.batchUpdate.return_value.execute.return_value = {
-        "replies": [{"insertComment": {"commentThread": {"commentId": comment_id}}}]
+        "replies": [{"insertComment": {"commentThread": thread}}]
     }
     return service
 
@@ -139,3 +140,37 @@ async def test_cell_requires_content(self, manage_comment):
             await manage_comment(
                 Mock(), Mock(), "user@example.com", "sheet123", "create", cell="A1"
             )
+
+    @pytest.mark.asyncio
+    async def test_empty_cell_falls_back_to_drive(self, manage_comment):
+        drive = Mock()
+        drive.comments.return_value.create.return_value.execute.return_value = {
+            "id": "c1"
+        }
+        sheets = Mock()
+
+        result = await manage_comment(
+            drive,
+            sheets,
+            "user@example.com",
+            "sheet123",
+            "create",
+            comment_content="File-level",
+            cell="",
+        )
+
+        assert "Comment ID: c1" in result
+        sheets.spreadsheets.assert_not_called()
+
+    @pytest.mark.asyncio
+    async def test_missing_comment_id_raises(self, manage_comment):
+        with pytest.raises(RuntimeError, match="did not return a comment ID"):
+            await manage_comment(
+                Mock(),
+                _mock_sheets_service(comment_id=None),
+                "user@example.com",
+                "sheet123",
+                "create",
+                comment_content="x",
+                cell="A1",
+            )
```

---

### Incident Patch 5: `3d303e3e` (2026-10-02)
**Commit Message**: Merge pull request #1218 from ConnorMoss02/fix/link-sharing-off-all-permissions

fix(gdrive): check every permission page before reporting link sharing off

**File**: `gdrive/drive_tools.py` (modified, +2/-12)
```diff
@@ -2826,19 +2826,9 @@ async def set_drive_file_permissions(
     # Handle link sharing via permissions API
     if link_sharing is not None:
         current_permissions = await asyncio.to_thread(
-            service.permissions()
-            .list(
-                fileId=file_id,
-                supportsAllDrives=True,
-                fields="permissions(id, type, role)",
-            )
-            .execute
+            list_all_permissions, service, file_id
         )
-        anyone_perms = [
-            p
-            for p in current_permissions.get("permissions", [])
-            if p.get("type") == "anyone"
-        ]
+        anyone_perms = [p for p in current_permissions if p.get("type") == "anyone"]
 
         if link_sharing == "off":
             if anyone_perms:
```

**File**: `tests/gdrive/test_drive_tools.py` (modified, +46/-0)
```diff
@@ -34,6 +34,7 @@
     import_to_google_slides,
     list_drive_items,
     search_drive_files,
+    set_drive_file_permissions,
     update_drive_file,
 )
 
@@ -441,6 +442,51 @@ async def test_create_drive_file_normalizes_mixed_case_odt_mime_for_zip_validati
     mock_service.files.return_value.create.return_value.execute.assert_not_called()
 
 
+# ---------------------------------------------------------------------------
+# set_drive_file_permissions - link sharing
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+@patch("gdrive.drive_tools.resolve_drive_item", new_callable=AsyncMock)
+async def test_link_sharing_off_finds_anyone_permission_on_a_later_page(
+    mock_resolve_item,
+):
+    """A public link past the first page of permissions is still removed."""
+    mock_resolve_item.return_value = ("file123", {"name": "Budget"})
+    mock_service = Mock()
+    pages = {
+        None: {
+            "permissions": [
+                {"id": f"u{i}", "type": "user", "role": "reader"} for i in range(100)
+            ],
+            "nextPageToken": "page2",
+        },
+        "page2": {
+            "permissions": [{"id": "anyone1", "type": "anyone", "role": "reader"}]
+        },
+    }
+
+    def list_permissions(**kwargs):
+        request = Mock()
+        request.execute.return_value = pages[kwargs.get("pageToken")]
+        return request
+
+    mock_service.permissions().list.side_effect = list_permissions
+
+    result = await _unwrap(set_drive_file_permissions)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        file_id="file123",
+        link_sharing="off",
+    )
+
+    mock_service.permissions().delete.assert_called_once_with(
+        fileId="file123", permissionId="anyone1", supportsAllDrives=True
+    )
+    assert "Link sharing: disabled" in result
+
+
 # ---------------------------------------------------------------------------
 # get_drive_file_permissions - owners
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 6: `c9f0ce59` (2026-10-02)
**Commit Message**: fix(gdrive): check every permission page before reporting link sharing off

**File**: `gdrive/drive_tools.py` (modified, +2/-12)
```diff
@@ -2826,19 +2826,9 @@ async def set_drive_file_permissions(
     # Handle link sharing via permissions API
     if link_sharing is not None:
         current_permissions = await asyncio.to_thread(
-            service.permissions()
-            .list(
-                fileId=file_id,
-                supportsAllDrives=True,
-                fields="permissions(id, type, role)",
-            )
-            .execute
+            list_all_permissions, service, file_id
         )
-        anyone_perms = [
-            p
-            for p in current_permissions.get("permissions", [])
-            if p.get("type") == "anyone"
-        ]
+        anyone_perms = [p for p in current_permissions if p.get("type") == "anyone"]
 
         if link_sharing == "off":
             if anyone_perms:
```

**File**: `tests/gdrive/test_drive_tools.py` (modified, +46/-0)
```diff
@@ -34,6 +34,7 @@
     import_to_google_slides,
     list_drive_items,
     search_drive_files,
+    set_drive_file_permissions,
     update_drive_file,
 )
 
@@ -441,6 +442,51 @@ async def test_create_drive_file_normalizes_mixed_case_odt_mime_for_zip_validati
     mock_service.files.return_value.create.return_value.execute.assert_not_called()
 
 
+# ---------------------------------------------------------------------------
+# set_drive_file_permissions - link sharing
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+@patch("gdrive.drive_tools.resolve_drive_item", new_callable=AsyncMock)
+async def test_link_sharing_off_finds_anyone_permission_on_a_later_page(
+    mock_resolve_item,
+):
+    """A public link past the first page of permissions is still removed."""
+    mock_resolve_item.return_value = ("file123", {"name": "Budget"})
+    mock_service = Mock()
+    pages = {
+        None: {
+            "permissions": [
+                {"id": f"u{i}", "type": "user", "role": "reader"} for i in range(100)
+            ],
+            "nextPageToken": "page2",
+        },
+        "page2": {
+            "permissions": [{"id": "anyone1", "type": "anyone", "role": "reader"}]
+        },
+    }
+
+    def list_permissions(**kwargs):
+        request = Mock()
+        request.execute.return_value = pages[kwargs.get("pageToken")]
+        return request
+
+    mock_service.permissions().list.side_effect = list_permissions
+
+    result = await _unwrap(set_drive_file_permissions)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        file_id="file123",
+        link_sharing="off",
+    )
+
+    mock_service.permissions().delete.assert_called_once_with(
+        fileId="file123", permissionId="anyone1", supportsAllDrives=True
+    )
+    assert "Link sharing: disabled" in result
+
+
 # ---------------------------------------------------------------------------
 # get_drive_file_permissions - owners
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 7: `85791291` (2026-10-02)
**Commit Message**: google workers pool & http timeout for sessions

**File**: `README.md` (modified, +2/-0)
```diff
@@ -256,6 +256,8 @@ Everything you need to run this in production lives in two places. The [document
 The **[Advanced Deployment guide](https://workspacemcp.com/docs/deployment?utm_source=github.com&utm_medium=referral&utm_campaign=readme&utm_content=deploy-advanced)** covers self-hosting specifics: reverse proxy setup with `WORKSPACE_EXTERNAL_URL` (including the nginx `Origin: null` consent workaround, the `WORKSPACE_MCP_ALLOW_NULL_ORIGIN_CONSENT` escape hatch, and the `Referrer-Policy` pitfall), origin validation and VS Code webview allowlisting, credential store backends (local directory or GCS with CMEK enforcement), and the **[complete environment variable reference](https://workspacemcp.com/docs/deployment?utm_source=github.com&utm_medium=referral&utm_campaign=readme&utm_content=deploy-env-vars#environment-variables)**.
 In external OAuth provider mode every request's `ya29.*` token is checked against Google's userinfo endpoint on a dedicated worker pool, and a request that finds the pool full is rejected with `401` rather than queued. The pool is shared by every caller of the process and defaults to 4 workers, so a gateway fronting many users should raise `WORKSPACE_MCP_TOKEN_VALIDATION_WORKERS` to the number of concurrent tool calls it expects. Invalid or non-positive values fail server startup.
 
+Tools run their blocking Google API requests on asyncio's default thread pool, which Python sizes at `min(32, CPU count + 4)` workers, so one process has at most that many Google requests in flight across all users. The default suits small containers. A busy multi-user deployment can raise `WORKSPACE_MCP_GOOGLE_API_WORKERS` to the number of concurrent tool calls it expects; the threads mostly wait on network I/O, so the count can exceed the CPU count. Unset keeps Python's default; invalid or non-positive values fail server startup.
+
 Set `WORKSPACE_MCP_TOKEN_VALIDATION_CACHE_TTL` to a number of seconds to remember each validated token's identity for that long, so repeat calls with the same token skip the round-trip and do not occupy a validation worker. Only a hash of the token is kept, and failures are never cached. The trade-off is that a token revoked or expired within the TTL still passes this check (Google rejects it on the actual API call), so keep the TTL short; values above 300 are clamped to 300. Unset or `0` disables the cache; invalid or negative values fail server startup.
 
 For orchestrators, `/health` is the liveness probe and never touches external systems. `/health/ready` is the readiness probe: it reads a sentinel key from the OAuth proxy storage backend and returns `200 {"storage": "ok"}`, or `503 {"storage": "unavailable", ...}` when the backend errors or takes longer than `WORKSPACE_MCP_READINESS_TIMEOUT_SECONDS` (default `1`; an invalid value logs a warning and uses the default). The memory backend answers locally, so it always reports ready; the disk backend also answers locally but can still return `503` on filesystem errors (e.g. an unreadable or permission-denied storage directory) or corrupt stored data. Point readiness, not liveness, at `/health/ready`, so an unreachable Valkey takes the instance out of rotation rather than restarting it.
```

**File**: `auth/google_auth.py` (modified, +58/-10)
```diff
@@ -5,16 +5,20 @@
 import jwt
 import logging
 import os
+import time
 import webbrowser
 
-from typing import List, Optional, Tuple, Dict, Any
+from collections import deque
+from contextlib import contextmanager
+from typing import List, Optional, Tuple, Dict, Any, Iterator
 from urllib.parse import parse_qs, urlparse
 
 from google.oauth2.credentials import Credentials
 from google_auth_oauthlib.flow import Flow
 from google.auth.transport.requests import Request
 from google.auth.exceptions import RefreshError
-from googleapiclient.discovery import build
+import google.auth.credentials
+from googleapiclient.discovery import Resource, build
 from googleapiclient.errors import HttpError
 import httplib2
 import google_auth_httplib2
@@ -91,14 +95,58 @@ def get_default_credentials_dir():
 DEFAULT_CREDENTIALS_DIR = get_default_credentials_dir()
 
 
-def _build_authorized_http(
-    credentials: Credentials, timeout: int = 30
-) -> google_auth_httplib2.AuthorizedHttp:
-    """Return credentialed HTTP with an explicit socket timeout."""
-    http = httplib2.Http(timeout=timeout)
+_HTTP_TIMEOUT_SECONDS = 30
+# httplib2 does not retry a request whose send fails on a connection the server
+# already dropped, so only reuse connections that were active recently.
+_HTTP_MAX_IDLE_SECONDS = 60
+# Raw httplib2.Http objects only: they hold sockets, never credentials, so a
+# pooled connection can safely serve any user's next request.
+_idle_http: deque[tuple[float, httplib2.Http]] = deque(maxlen=32)
+
+
+def _acquire_http() -> httplib2.Http:
+    """Pop the most recently released connection, or create a new one."""
+    try:
+        while True:
+            released_at, http = _idle_http.pop()
+            if time.monotonic() - released_at < _HTTP_MAX_IDLE_SECONDS:
+                return http
+            http.close()
+    except IndexError:
+        pass
+    http = httplib2.Http(timeout=_HTTP_TIMEOUT_SECONDS)
     # Drive uses 308 Resume Incomplete with Range during resumable uploads, not a redirect.
     http.redirect_codes = http.redirect_codes - {308}
-    return google_auth_httplib2.AuthorizedHttp(credentials, http=http)
+    return http
+
+
+def _build_authorized_http(
+    credentials: google.auth.credentials.Credentials,
+) -> google_auth_httplib2.AuthorizedHttp:
+    """Return credentialed HTTP over a pooled, timeout-bounded connection."""
+    return google_auth_httplib2.AuthorizedHttp(credentials, http=_acquire_http())
+
+
+def build_google_service(
+    service_name: str, version: str, credentials: google.auth.credentials.Credentials
+) -> Resource:
+    """Build a discovery client on a pooled, timeout-bounded connection."""
+    return build(service_name, version, http=_build_authorized_http(credentials))
+
+
+@contextmanager
+def recycling(service: Resource) -> Iterator[Resource]:
+    """Like contextlib.closing, but return the connection to the pool on success.
+
+    After an error or cancellation a worker thread may still be mid-request on
+    this connection, so it is closed instead and never shared with another call.
+    """
+    try:
+        yield service
+    except BaseException:
+        service.close()
+        raise
+    _idle_http.append((time.monotonic(), service._http.http))
 
 
 # Session credentials now handled by OAuth21SessionStore - no local cache needed
@@ -1262,7 +1310,7 @@ def get_user_info(
     try:
         # Using googleapiclient discovery to get user info
         # Requires 'google-api-python-client' library
-        service = build("oauth2", "v2", http=_build_authorized_http(credentials))
+        service = build_google_service("oauth2", "v2", credentials)
         user_info = service.userinfo().get().execute()
         logger.info(f"Successfully fetched user info: {user_info.get('email')}")
         return user_info
@@ -1411,7 +1459,7 @@ async def get_authenticated_google_service(
         raise GoogleAuthenticationError(auth_response)
 
     try:
-        service = build(service_name, version, http=_build_authorized_http(credentials))
+        service = build_google_service(service_name, version, credentials)
         log_user_email = user_google_email
 
         # Try to get email from credentials if needed for validation
```

**File**: `auth/service_decorator.py` (modified, +13/-10)
```diff
@@ -11,9 +11,13 @@
 
 from google.auth.exceptions import RefreshError
 from google.oauth2 import service_account as google_service_account
-from googleapiclient.discovery import build
 from fastmcp.server.dependencies import get_access_token, get_context
-from auth.google_auth import get_authenticated_google_service, GoogleAuthenticationError
+from auth.google_auth import (
+    GoogleAuthenticationError,
+    build_google_service,
+    get_authenticated_google_service,
+    recycling,
+)
 from auth.gateway_identity import (
     require_gateway_principal,
     get_verified_gateway_principal,
@@ -353,7 +357,7 @@ async def _authenticate_service(
         credentials = _get_service_account_credentials(
             _widen_drive_scope_for_dwd(resolved_scopes, tool_name), target_email
         )
-        service = build(service_name, service_version, credentials=credentials)
+        service = build_google_service(service_name, service_version, credentials)
         logger.info(
             f"[{tool_name}] Authenticated {service_name} for "
             f"{target_email} via service-account"
@@ -438,7 +442,7 @@ async def get_authenticated_google_service_oauth21(
                 f"OAuth credentials lack required scopes. Need: {required_scopes}, Have: {sorted(scopes_available)}"
             )
 
-        service = build(service_name, version, credentials=credentials)
+        service = build_google_service(service_name, version, credentials)
         logger.info(
             f"[{tool_name}] Authenticated {service_name} for "
             f"{resolved_email} via oauth2.1"
@@ -471,7 +475,7 @@ async def get_authenticated_google_service_oauth21(
             f"OAuth 2.1 credentials lack required scopes. Need: {required_scopes}, Have: {sorted(scopes_available)}"
         )
 
-    service = build(service_name, version, credentials=credentials)
+    service = build_google_service(service_name, version, credentials)
     logger.info(
         f"[{tool_name}] Authenticated {service_name} for "
         f"{user_google_email} via oauth2.1"
@@ -878,16 +882,15 @@ async def wrapper(*args, **kwargs):
                     kwargs["user_google_email"] = user_google_email
 
                 # Prepend the fetched service object to the original arguments
-                return await func(service, *args, **kwargs)
+                with recycling(service):
+                    return await func(service, *args, **kwargs)
             except RefreshError as e:
                 error_message = _handle_token_refresh_error(
                     e, actual_user_email, service_name
                 )
                 raise GoogleAuthenticationError(error_message)
             finally:
-                if service:
-                    service.close()
-                    _release_google_service_cycles()
+                _release_google_service_cycles()
 
         # Set the wrapper's signature to the one without 'service'
         wrapper.__signature__ = wrapper_sig
@@ -1019,7 +1022,7 @@ async def wrapper(*args, **kwargs):
 
                             # Inject service with specified parameter name
                             kwargs[param_name] = service
-                            stack.callback(service.close)
+                            stack.enter_context(recycling(service))
                             services_created = True
 
                         except GoogleAuthenticationError as e:
```

**File**: `core/server.py` (modified, +53/-0)
```diff
@@ -1,9 +1,11 @@
 # ruff: noqa: E402
 # Startup warning filters must be installed before importing FastMCP/Authlib dependencies.
 import asyncio
+import gc
 import hashlib
 import logging
 import os
+from concurrent.futures import ThreadPoolExecutor
 from typing import List, Optional
 from importlib import metadata
 from urllib.parse import urlparse, ParseResult
@@ -42,6 +44,7 @@
 import fastmcp
 from fastmcp import FastMCP
 from fastmcp.server.auth.providers.google import GoogleProvider
+from fastmcp.server.lifespan import lifespan
 from mcp.types import ToolAnnotations, Icon
 from starlette.applications import Starlette
 from starlette.datastructures import MutableHeaders
@@ -82,6 +85,7 @@
 _SESSION_IDLE_TIMEOUT_ENV = "WORKSPACE_MCP_SESSION_IDLE_TIMEOUT"
 # Leave a minute beyond the usual one-hour Google access-token lifetime.
 _DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS = 60 * 60 + 60
+_GOOGLE_API_WORKERS_ENV = "WORKSPACE_MCP_GOOGLE_API_WORKERS"
 
 
 def _parse_bool_env(value: str) -> bool:
@@ -282,6 +286,54 @@ def _compute_scope_fingerprint() -> str:
     return hashlib.sha256(scopes_str.encode()).hexdigest()[:12]
 
 
+def get_google_api_workers() -> Optional[int]:
+    """Parse WORKSPACE_MCP_GOOGLE_API_WORKERS; unset keeps asyncio's default.
+
+    Invalid values raise instead of falling back, so a misconfigured deployment
+    fails at startup.
+    """
+    raw = os.getenv(_GOOGLE_API_WORKERS_ENV, "").strip()
+    if not raw:
+        return None
+    try:
+        value = int(raw)
+    except ValueError:
+        value = 0
+    if value < 1:
+        raise ValueError(
+            f"{_GOOGLE_API_WORKERS_ENV} must be a positive integer, got {raw!r}"
+        )
+    return value
+
+
+@lifespan
+async def _freeze_startup_heap(server: FastMCP):
+    """Exempt objects loaded at startup from garbage collection.
+
+    Each tool call ends with a full collection to free googleapiclient reference
+    cycles. Freezing the modules and tool registry first keeps that collection
+    under a millisecond instead of scanning the whole startup heap every call.
+    """
+    gc.collect()
+    gc.freeze()
+    yield None
+
+
+@lifespan
+async def _google_api_executor(server: FastMCP):
+    """Size the executor that runs blocking Google API calls, when configured.
+
+    Tools run Google HTTP requests through asyncio.to_thread, so this pool caps
+    how many requests one process has in flight across all users.
+    """
+    workers = get_google_api_workers()
+    if workers:
+        asyncio.get_running_loop().set_default_executor(
+            ThreadPoolExecutor(workers, thread_name_prefix="google-api")
+        )
+    yield None
+
+
 # Custom FastMCP that adds secure middleware stack for OAuth 2.1
 class SecureFastMCP(FastMCP):
     def http_app(self, **kwargs) -> "Starlette":
@@ -405,6 +457,7 @@ async def call_tool(self, name: str, arguments: Optional[dict], *args, **kwargs)
     instructions=_server_instructions,
     website_url=_brand_config.brand_website_url,
     icons=_brand_icons,
+    lifespan=_freeze_startup_heap | _google_api_executor,
 )
 
 # Accept camelCase argument names (calendarId, timeMin, ...) from callers that
```

**File**: `gcalendar/calendar_tools.py` (modified, +2/-2)
```diff
@@ -1094,10 +1094,10 @@ async def _modify_event_impl(
         else:
             # Preserve existing event's useDefault value if not explicitly specified
             try:
-                existing_event = (
+                existing_event = await asyncio.to_thread(
                     service.events()
                     .get(calendarId=calendar_id, eventId=event_id)
-                    .execute()
+                    .execute
                 )
                 reminder_data["useDefault"] = existing_event.get("reminders", {}).get(
                     "useDefault", True
```

**File**: `tests/auth/test_httplib2_timeout.py` (modified, +42/-16)
```diff
@@ -4,9 +4,16 @@
 from unittest.mock import MagicMock, patch
 
 import pytest
+from google.auth.credentials import AnonymousCredentials
 
-from auth.google_auth import _build_authorized_http, get_authenticated_google_service
-from auth.google_auth import get_user_info
+import auth.google_auth as google_auth
+from auth.google_auth import (
+    _build_authorized_http,
+    build_google_service,
+    get_authenticated_google_service,
+    get_user_info,
+    recycling,
+)
 
 
 def test_build_authorized_http_uses_explicit_timeout():
@@ -24,30 +31,49 @@ def test_build_authorized_http_uses_explicit_timeout():
             return_value=mock_authorized,
         ) as mock_auth_http_cls,
     ):
-        result = _build_authorized_http(mock_credentials, timeout=42)
+        result = _build_authorized_http(mock_credentials)
 
-    mock_http_cls.assert_called_once_with(timeout=42)
+    mock_http_cls.assert_called_once_with(timeout=30)
     mock_auth_http_cls.assert_called_once_with(mock_credentials, http=mock_http)
     assert mock_http.redirect_codes == {300, 301, 302, 303, 307}
     assert result is mock_authorized
 
 
-def test_build_authorized_http_default_timeout_is_30():
-    mock_credentials = MagicMock()
+def test_recycled_connection_is_reused():
+    service = build_google_service("gmail", "v1", AnonymousCredentials())
+    pooled_http = service._http.http
 
-    with (
-        patch("auth.google_auth.httplib2.Http") as mock_http_cls,
-        patch(
-            "auth.google_auth.google_auth_httplib2.AuthorizedHttp",
-        ) as mock_auth_http_cls,
-    ):
-        _build_authorized_http(mock_credentials)
+    with recycling(service):
+        pass
 
-    mock_http_cls.assert_called_once_with(timeout=30)
-    mock_auth_http_cls.assert_called_once_with(
-        mock_credentials, http=mock_http_cls.return_value
+    assert _build_authorized_http(AnonymousCredentials()).http is pooled_http
+    assert not google_auth._idle_http
+
+
+def test_stale_connection_is_closed_and_replaced(monkeypatch):
+    stale_http = MagicMock()
+    google_auth._idle_http.append((0.0, stale_http))
+    monkeypatch.setattr(
+        google_auth.time, "monotonic", lambda: google_auth._HTTP_MAX_IDLE_SECONDS
     )
 
+    http = google_auth._acquire_http()
+
+    stale_http.close.assert_called_once_with()
+    assert http is not stale_http
+    assert not google_auth._idle_http
+
+
+def test_failed_block_closes_instead_of_recycling():
+    service = MagicMock()
+
+    with pytest.raises(ValueError):
+        with recycling(service):
+            raise ValueError("boom")
+
+    service.close.assert_called_once_with()
+    assert not google_auth._idle_http
+
 
 def test_get_user_info_builds_service_with_authorized_http(monkeypatch):
     credentials = SimpleNamespace(valid=True)
```

**File**: `tests/conftest.py` (modified, +9/-0)
```diff
@@ -1,5 +1,6 @@
 import pytest
 
+import auth.google_auth as google_auth
 from auth.oauth_config import reload_oauth_config
 
 
@@ -14,3 +15,11 @@ def _reset_oauth_config():
     """
     yield
     reload_oauth_config()
+
+
+@pytest.fixture(autouse=True)
+def _empty_http_pool():
+    """Keep connections recycled by one test, often mocks, out of the next."""
+    google_auth._idle_http.clear()
+    yield
+    google_auth._idle_http.clear()
```

**File**: `tests/core/test_service_decorator_cleanup.py` (modified, +44/-4)
```diff
@@ -1,17 +1,25 @@
+from types import SimpleNamespace
+
 import pytest
 
+import auth.google_auth as google_auth
 import auth.service_decorator as service_decorator
 
 
 class _FakeService:
     def __init__(self, name: str, events: list[str]):
         self.name = name
         self._events = events
+        self._http = SimpleNamespace(http=f"http:{name}")
 
     def close(self) -> None:
         self._events.append(f"close:{self.name}")
 
 
+def _pooled(events: list[str]) -> None:
+    events.extend(f"pool:{http}" for _, http in google_auth._idle_http)
+
+
 def _patch_common_decorator_state(monkeypatch):
     async def fake_get_auth_context(tool_name):
         return (None, None, None)
@@ -37,7 +45,7 @@ async def fake_get_auth_context(tool_name):
 
 
 @pytest.mark.asyncio
-async def test_require_google_service_releases_cycles_after_close(monkeypatch):
+async def test_require_google_service_recycles_connection_on_success(monkeypatch):
     _patch_common_decorator_state(monkeypatch)
     events = []
     fake_service = _FakeService("gmail", events)
@@ -62,13 +70,43 @@ async def sample_tool(service, user_google_email: str):
         return "ok"
 
     result = await sample_tool(user_google_email="user@example.com")
+    _pooled(events)
 
     assert result == "ok"
-    assert events == ["func", "close:gmail", "collect"]
+    assert events == ["func", "collect", "pool:http:gmail"]
+
+
+@pytest.mark.asyncio
+async def test_require_google_service_closes_connection_on_error(monkeypatch):
+    _patch_common_decorator_state(monkeypatch)
+    events = []
+    fake_service = _FakeService("gmail", events)
+
+    async def fake_authenticate_service(*args, **kwargs):
+        return fake_service, "user@example.com"
+
+    monkeypatch.setattr(
+        service_decorator, "_authenticate_service", fake_authenticate_service
+    )
+    monkeypatch.setattr(
+        service_decorator,
+        "_release_google_service_cycles",
+        lambda: events.append("collect"),
+    )
+
+    @service_decorator.require_google_service("gmail", "gmail_read")
+    async def sample_tool(service, user_google_email: str):
+        raise ValueError("boom")
+
+    with pytest.raises(ValueError, match="boom"):
+        await sample_tool(user_google_email="user@example.com")
+    _pooled(events)
+
+    assert events == ["close:gmail", "collect"]
 
 
 @pytest.mark.asyncio
-async def test_require_multiple_services_releases_cycles_after_exit_stack(
+async def test_require_multiple_services_recycles_connections_on_success(
     monkeypatch,
 ):
     _patch_common_decorator_state(monkeypatch)
@@ -121,9 +159,10 @@ async def sample_tool(drive_service, docs_service, user_google_email: str):
         return "ok"
 
     result = await sample_tool(user_google_email="user@example.com")
+    _pooled(events)
 
     assert result == "ok"
-    assert events == ["func", "close:docs", "close:drive", "collect"]
+    assert events == ["func", "collect", "pool:http:docs", "pool:http:drive"]
 
 
 @pytest.mark.asyncio
@@ -178,5 +217,6 @@ async def sample_tool(drive_service, docs_service, user_google_email: str):
         service_decorator.GoogleAuthenticationError, match="docs auth failed"
     ):
         await sample_tool(user_google_email="user@example.com")
+    _pooled(events)
 
     assert events == ["close:drive", "collect"]
```

---

### Incident Patch 8: `9454d2dd` (2026-10-01)
**Commit Message**: security patch

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ dependencies = [
  "cryptography>=50.0.0",
  "defusedxml>=0.7.1",
  "email-validator>=2.0.0",
- "pypdf>=6.15.0",
+ "pypdf>=6.19.0",
  "pytz>=2026.1.post1",
  "tzdata>=2026.1",
  "markdown-it-py>=3.0.0",
```

**File**: `uv.lock` (modified, +4/-4)
```diff
@@ -1603,14 +1603,14 @@ wheels = [
 
 [[package]]
 name = "pypdf"
-version = "6.16.1"
+version = "6.19.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/b6/5a/df92d1c1ef8806ca28f20f978ee059894868d93de797a7e2edebe7fe1a43/pypdf-6.16.1.tar.gz", hash = "sha256:c4d1b43ddae921387321cf63936cd16a7743b91d2da92f165c149a195c972ba9", size = 7003737, upload-time = "2026-08-14T12:24:04.531Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/1f/ac/63d71aaedb59acbcdef491e6ca6469165e3771c9c74358204818fd9bc5a6/pypdf-6.19.0.tar.gz", hash = "sha256:bbc43aca292369ccc6cbc8a921991ecf2538a3587ab5a116eff06c321d647155", size = 7033266, upload-time = "2026-09-16T09:32:05.946Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/33/a1/724b18d6757ab7253a8fecd3a430eb8d980ed26872ba16651e7b5ddfc63f/pypdf-6.16.1-py3-none-any.whl", hash = "sha256:63fec31c4092ae50b6729beedcb469055b60d20c834bde1c402df241f371f644", size = 382924, upload-time = "2026-08-14T12:24:02.854Z" },
+    { url = "https://files.pythonhosted.org/packages/3c/2c/c43c03eaf630435f023f1dc61ec4a4a78951ad5530a62c71cc89bde307b7/pypdf-6.19.0-py3-none-any.whl", hash = "sha256:7e5d6e730e7dae87d560a2cee218b852f6498c8be61966f3cd02ead971e48d14", size = 395480, upload-time = "2026-09-16T09:32:04.087Z" },
 ]
 
 [[package]]
@@ -2577,7 +2577,7 @@ requires-dist = [
     { name = "py-key-value-aio", extras = ["filetree"], marker = "extra == 'disk'", specifier = ">=0.3.0" },
     { name = "py-key-value-aio", extras = ["valkey"], marker = "extra == 'valkey'", specifier = ">=0.3.0" },
     { name = "pyjwt", specifier = ">=2.15.0" },
-    { name = "pypdf", specifier = ">=6.15.0" },
+    { name = "pypdf", specifier = ">=6.19.0" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8.3.0" },
     { name = "pytest", marker = "extra == 'test'", specifier = ">=8.3.0" },
     { name = "pytest-asyncio", marker = "extra == 'dev'", specifier = ">=0.23.0" },
```

---

### Incident Patch 9: `a12a440e` (2026-10-01)
**Commit Message**: security patch

**File**: `pyproject.toml` (modified, +5/-3)
```diff
@@ -17,9 +17,9 @@ dependencies = [
  "google-auth-httplib2>=0.2.0",
  "google-auth-oauthlib>=1.2.2",
  "httpx>=0.28.1",
- "urllib3>=2.7.0",
+ "urllib3>=2.8.0",
  "py-key-value-aio>=0.3.0",
- "pyjwt>=2.12.0",
+ "pyjwt>=2.15.0",
  "python-dotenv>=1.1.0",
  "pyyaml>=6.0.2",
  "cryptography>=50.0.0",
@@ -163,9 +163,11 @@ core = ["tool_tiers.yaml"]
 [tool.uv]
 # Security floors for transitively-pulled deps (not direct dependencies).
 # These are constraints only: they force a patched version *if* the package is
-# pulled in (mcp via fastmcp, pyasn1 via google-auth/pyasn1-modules) without
+# pulled in (mcp via fastmcp, pyasn1 via google-auth/pyasn1-modules,
+# oauthlib via google-auth-oauthlib/requests-oauthlib) without
 # adding it as a direct dependency. Remove once upstream floors cover the CVEs.
 constraint-dependencies = [
     "mcp>=1.28.1",    # GHSA: HTTP principal verification, WS Host/Origin, cross-client tasks
     "pyasn1>=0.6.4",  # GHSA: REAL-decode resource consumption, quadratic OID DoS
+    "oauthlib>=4.0.0", # GHSA-hj66-6f7g-4r5v: revocation endpoint JSONP injection
 ]
```

**File**: `uv.lock` (modified, +9/-8)
```diff
@@ -13,6 +13,7 @@ resolution-markers = [
 [manifest]
 constraints = [
     { name = "mcp", specifier = ">=1.28.1" },
+    { name = "oauthlib", specifier = ">=4.0.0" },
     { name = "pyasn1", specifier = ">=0.6.4" },
 ]
 
@@ -1576,14 +1577,14 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.15.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423", size = 107515, upload-time = "2026-05-21T19:54:36.618Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz", hash = "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8", size = 121252, upload-time = "2026-09-28T18:40:42.598Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728", size = 31274, upload-time = "2026-05-21T19:54:35.362Z" },
+    { url = "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl", hash = "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193", size = 33860, upload-time = "2026-09-28T18:40:41.429Z" },
 ]
 
 [package.optional-dependencies]
@@ -2215,11 +2216,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
@@ -2575,7 +2576,7 @@ requires-dist = [
     { name = "py-key-value-aio", specifier = ">=0.3.0" },
     { name = "py-key-value-aio", extras = ["filetree"], marker = "extra == 'disk'", specifier = ">=0.3.0" },
     { name = "py-key-value-aio", extras = ["valkey"], marker = "extra == 'valkey'", specifier = ">=0.3.0" },
-    { name = "pyjwt", specifier = ">=2.12.0" },
+    { name = "pyjwt", specifier = ">=2.15.0" },
     { name = "pypdf", specifier = ">=6.15.0" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8.3.0" },
     { name = "pytest", marker = "extra == 'test'", specifier = ">=8.3.0" },
@@ -2592,7 +2593,7 @@ requires-dist = [
     { name = "twine", marker = "extra == 'dev'", specifier = ">=5.0.0" },
     { name = "twine", marker = "extra == 'release'", specifier = ">=5.0.0" },
     { name = "tzdata", specifier = ">=2026.1" },
-    { name = "urllib3", specifier = ">=2.7.0" },
+    { name = "urllib3", specifier = ">=2.8.0" },
     { name = "valkey-glide", marker = "extra == 'valkey'", specifier = ">=2.3.0" },
 ]
 provides-extras = ["gcs", "disk", "valkey", "otel", "test", "release", "dev"]
```

---

### Incident Patch 10: `1cb40966` (2026-09-30)
**Commit Message**: memory bound for stateless sessions

**File**: `core/server.py` (modified, +7/-6)
```diff
@@ -24,7 +24,6 @@
     is_external_oauth21_provider,
     get_oauth_config,
     is_trust_gateway_identity,
-    is_stateless_mode,
 )
 from auth.oauth_proxy_config import get_oauth_proxy_expiry_kwargs
 from auth.oauth_responses import (
@@ -40,6 +39,7 @@
     get_oauth_redirect_uri as get_oauth_redirect_uri_for_current_mode,
 )
 from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
+import fastmcp
 from fastmcp import FastMCP
 from fastmcp.server.auth.providers.google import GoogleProvider
 from mcp.types import ToolAnnotations, Icon
@@ -275,11 +275,12 @@ def _compute_scope_fingerprint() -> str:
 class SecureFastMCP(FastMCP):
     def http_app(self, **kwargs) -> "Starlette":
         """Override to add secure middleware stack for OAuth 2.1."""
-        # Bound memory retained by abandoned stateful sessions.
-        if (
-            not kwargs.get("stateless_http", is_stateless_mode())
-            and "session_idle_timeout" not in kwargs
-        ):
+        # Bound memory retained by abandoned stateful sessions. Resolve an omitted
+        # or None stateless_http the same way FastMCP does.
+        stateless_http = kwargs.get("stateless_http")
+        if stateless_http is None:
+            stateless_http = fastmcp.settings.stateless_http
+        if not stateless_http and "session_idle_timeout" not in kwargs:
             kwargs["session_idle_timeout"] = get_session_idle_timeout()
         app = super().http_app(**kwargs)
 
```

**File**: `tests/core/test_session_idle_timeout.py` (modified, +22/-0)
```diff
@@ -2,6 +2,7 @@
 from fastmcp.server.http import StreamableHTTPASGIApp
 import pytest
 
+from auth.oauth_config import is_stateless_mode, reload_oauth_config
 from core.server import SecureFastMCP, get_session_idle_timeout
 
 _ENV = "WORKSPACE_MCP_SESSION_IDLE_TIMEOUT"
@@ -85,3 +86,24 @@ async def test_http_app_skips_stateless_session_manager(monkeypatch):
     monkeypatch.setenv(_ENV, "invalid")
 
     assert await _idle_timeout_after_startup(stateless_http=True) is None
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("http_app_kwargs", [{}, {"stateless_http": None}])
+async def test_http_app_skips_fastmcp_stateless_setting(monkeypatch, http_app_kwargs):
+    monkeypatch.setenv(_ENV, "invalid")
+    monkeypatch.setattr(fastmcp.settings, "stateless_http", True)
+
+    assert await _idle_timeout_after_startup(**http_app_kwargs) is None
+
+
+@pytest.mark.asyncio
+async def test_http_app_applies_timeout_when_fastmcp_settings_stateful(monkeypatch):
+    monkeypatch.setenv(_ENV, "600")
+    monkeypatch.setenv("MCP_ENABLE_OAUTH21", "true")
+    monkeypatch.setenv("WORKSPACE_MCP_STATELESS_MODE", "true")
+    reload_oauth_config()
+    assert is_stateless_mode()
+    monkeypatch.setattr(fastmcp.settings, "stateless_http", False)
+
+    assert await _idle_timeout_after_startup() == 600
```

---

### Incident Patch 11: `698d3fd7` (2026-09-30)
**Commit Message**: fix(drive): drop query values from normalization INFO log

Keep user search text out of INFO per log-hygiene policy; event is still reported, values stay at DEBUG.

**File**: `gdrive/drive_tools.py` (modified, +1/-1)
```diff
@@ -228,7 +228,7 @@ async def search_drive_files(
     normalized_query = normalize_drive_query_v2_compat(final_query)
     if normalized_query != final_query:
         logger.info(
-            f"[search_drive_files] Normalized v2 query fields: '{final_query}' -> '{normalized_query}'"
+            "[search_drive_files] Normalized v2 query field names to v3 equivalents"
         )
         final_query = normalized_query
 
```

---

### Incident Patch 12: `c83db95e` (2026-09-30)
**Commit Message**: fix(drive): normalize v2 title to v3 name in search_drive_files

search_drive_files passed structured queries as-is, so title contains 'test' reached Drive API v3 as (title contains 'test') and trashed=false and failed with Invalid Value.

Add normalize_drive_query_v2_compat() in gdrive/drive_helpers.py (literal-aware, handles title->name, createdDate->createdTime, modifiedDate->modifiedTime, lastViewedByMeDate->viewedByMeTime) and apply it in search_drive_files before trashed/file_type handling.

Preserves trashed=false, page_size, OAuth, readonly, existing filters. Adds 6 tests.

**File**: `gdrive/drive_helpers.py` (modified, +47/-0)
```diff
@@ -264,6 +264,53 @@ def has_explicit_trashed_clause(query: str) -> bool:
     return bool(TRASHED_CLAUSE_PATTERN.search(without_literals))
 
 
+# Drive API v2 -> v3 field-name compatibility for search queries.
+# v2 `title` is `name` in v3; date fields changed `Date` suffix to `Time`.
+# See https://developers.google.com/workspace/drive/api/guides/v2-guide
+# and https://developers.google.com/drive/api/guides/v2-to-v3-reference
+DRIVE_V2_TO_V3_QUERY_FIELD_MAP = {
+    "title": "name",
+    "createddate": "createdTime",
+    "modifieddate": "modifiedTime",
+    "lastviewedbymedate": "viewedByMeTime",
+}
+
+_DRIVE_V2_FIELD_PATTERN = re.compile(
+    r"\b(title|createdDate|modifiedDate|lastViewedByMeDate)\b",
+    re.IGNORECASE,
+)
+
+
+def _replace_drive_v2_field(match: re.Match) -> str:
+    """Map a single v2 field occurrence to its v3 equivalent."""
+    return DRIVE_V2_TO_V3_QUERY_FIELD_MAP[match.group(1).lower()]
+
+
+def normalize_drive_query_v2_compat(query: str) -> str:
+    """Translate Drive API v2 query field names to v3 equivalents.
+
+    Only field positions outside quoted string literals are rewritten, so a
+    filename such as ``name contains 'title'`` keeps its literal untouched
+    while ``title contains 'test'`` becomes ``name contains 'test'``.
+
+    Covered translations:
+    - ``title`` -> ``name``
+    - ``createdDate`` -> ``createdTime``
+    - ``modifiedDate`` -> ``modifiedTime``
+    - ``lastViewedByMeDate`` -> ``viewedByMeTime``
+    """
+    result_parts: list[str] = []
+    last_end = 0
+    for literal in QUERY_STRING_LITERAL_PATTERN.finditer(query):
+        chunk = query[last_end : literal.start()]
+        result_parts.append(_DRIVE_V2_FIELD_PATTERN.sub(_replace_drive_v2_field, chunk))
+        result_parts.append(literal.group(0))
+        last_end = literal.end()
+    tail = query[last_end:]
+    result_parts.append(_DRIVE_V2_FIELD_PATTERN.sub(_replace_drive_v2_field, tail))
+    return "".join(result_parts)
+
+
 # Precompiled regex patterns for Drive query detection
 DRIVE_QUERY_PATTERNS = [
     re.compile(r'\b\w+\s*(=|!=|>|<)\s*[\'"].*?[\'"]', re.IGNORECASE),  # field = 'value'
```

**File**: `gdrive/drive_tools.py` (modified, +11/-0)
```diff
@@ -86,6 +86,7 @@
     has_explicit_trashed_clause,
     initiate_resumable_upload_session,
     native_replace_format_map,
+    normalize_drive_query_v2_compat,
     reject_sources_with_upload_url,
     resolve_drive_item,
     resolve_file_type_mime,
@@ -221,6 +222,16 @@ async def search_drive_files(
             f"[search_drive_files] Reformatting free text query '{query}' to '{final_query}'"
         )
 
+    # Drive API v3 uses `name`, not v2 `title` (and `Time` suffix, not `Date`).
+    # Normalize v2 field names outside quoted literals so
+    # `title contains 'test'` becomes `name contains 'test'`.
+    normalized_query = normalize_drive_query_v2_compat(final_query)
+    if normalized_query != final_query:
+        logger.info(
+            f"[search_drive_files] Normalized v2 query fields: '{final_query}' -> '{normalized_query}'"
+        )
+        final_query = normalized_query
+
     # Drive's files.list returns trashed items unless told otherwise. Hide them by
     # default so search agrees with list_drive_items and the Drive web UI, but never
     # override an explicit trashed clause the caller wrote themselves.
```

**File**: `tests/gdrive/test_drive_tools.py` (modified, +92/-0)
```diff
@@ -24,6 +24,7 @@
     _create_drive_folder_impl,
     build_drive_list_params,
     has_explicit_trashed_clause,
+    normalize_drive_query_v2_compat,
     resolve_drive_item,
 )
 from gdrive.drive_tools import (
@@ -3310,3 +3311,94 @@ async def test_check_drive_file_public_access_shared_drive(mock_resolve):
 
     assert "PUBLIC ACCESS ENABLED" in result
     assert "Shared: True" in result
+
+
+# ---------------------------------------------------------------------------
+# search_drive_files — Drive API v2 -> v3 query compat (title -> name)
+# ---------------------------------------------------------------------------
+
+
+def test_normalize_drive_query_v2_title_contains():
+    """v2 `title contains` is rewritten to v3 `name contains`."""
+    assert (
+        normalize_drive_query_v2_compat("title contains 'test'")
+        == "name contains 'test'"
+    )
+
+
+def test_normalize_drive_query_v2_preserves_literals():
+    """Quoted values mentioning v2 names are data, not fields."""
+    assert (
+        normalize_drive_query_v2_compat("name contains 'title'")
+        == "name contains 'title'"
+    )
+    assert (
+        normalize_drive_query_v2_compat("name contains \"title contains 'test'\"")
+        == "name contains \"title contains 'test'\""
+    )
+
+
+def test_normalize_drive_query_v2_date_fields():
+    """v2 date fields map to v3 `Time` suffix equivalents."""
+    assert (
+        normalize_drive_query_v2_compat("modifiedDate > '2024-01-01T00:00:00Z'")
+        == "modifiedTime > '2024-01-01T00:00:00Z'"
+    )
+    assert (
+        normalize_drive_query_v2_compat("createdDate > '2024-01-01T00:00:00Z'")
+        == "createdTime > '2024-01-01T00:00:00Z'"
+    )
+    assert (
+        normalize_drive_query_v2_compat("lastViewedByMeDate > '2024-01-01T00:00:00Z'")
+        == "viewedByMeTime > '2024-01-01T00:00:00Z'"
+    )
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_normalizes_title_contains_to_name():
+    """`title contains 'test'` produces v3 `(name contains 'test') and trashed=false`."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="title contains 'test'",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert call_kwargs["q"] == "(name contains 'test') and trashed=false"
+    assert "title contains" not in call_kwargs["q"]
+    assert "name contains 'test'" in call_kwargs["q"]
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_normalizes_title_equals_to_name():
+    """`title = 'report'` is also a v2 field usage and must become v3 `name`."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="title = 'report'",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert call_kwargs["q"] == "(name = 'report') and trashed=false"
+
+
+@pytest.mark.asyncio
+async def test_search_drive_files_does_not_rewrite_quoted_title():
+    """A literal filename containing the word title is left untouched."""
+    mock_service = Mock()
+    mock_service.files().list().execute.return_value = {"files": []}
+
+    await _unwrap(search_drive_files)(
+        service=mock_service,
+        user_google_email="user@example.com",
+        query="name contains 'title'",
+    )
+
+    call_kwargs = mock_service.files.return_value.list.call_args.kwargs
+    assert call_kwargs["q"] == "(name contains 'title') and trashed=false"
```

---

### Incident Patch 13: `724ea91f` (2026-09-29)
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

### Incident Patch 14: `a47df7fa` (2026-09-29)
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

### Incident Patch 15: `2511351b` (2026-09-28)
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

#### Recent Merged Pull Requests:
- **PR #1225** (closed): Feat/as 216 tool annotations (@muneerusman25)
- **PR #1222** (2026-10-04): feat(comments): include Drive comment anchor in comment listing (@taylorwilsdon)
- **PR #1219** (2026-10-04): feat(sheets): anchor spreadsheet comments to a cell (@evankland)
- **PR #1218** (2026-10-02): fix(gdrive): check every permission page before reporting link sharing off (@ConnorMoss02)
- **PR #1216** (2026-10-02): fix: issues/1205 (@taylorwilsdon)
- **PR #1214** (2026-10-04): feat(docs): add tab_id parameter to get_doc_content and get_doc_as_markdown (@fatherlinux)
- **PR #1212** (closed): chore(deps): bump pypdf from 6.16.1 to 6.19.0 in the uv group across 1 directory (@dependabot[bot])
- **PR #1211** (closed): feat(comments): include Drive comment anchor in comment listing (@michalprzemek)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

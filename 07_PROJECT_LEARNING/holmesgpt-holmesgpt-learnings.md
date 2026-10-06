# Forensic Learning Record (Deep Inspection): HolmesGPT/holmesgpt

> **Canonical Artifact**: `07_PROJECT_LEARNING/holmesgpt-holmesgpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HolmesGPT/holmesgpt](https://github.com/HolmesGPT/holmesgpt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:24:34.285Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HolmesGPT/holmesgpt`
- **Description**: SRE Agent - CNCF Sandbox Project
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3510 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `holmes/core/azure_token.py`
```
import logging
import os
import threading
import time
from typing import Optional

from azure.identity import DefaultAzureCredential, get_bearer_token_provider

from holmes.common.env_vars import AZURE_COGNITIVE_SERVICES_SCOPE

logger = logging.getLogger(__name__)

TOKEN_EXPIRY_SECONDS = 3600  # 1 hour

_lock = threading.Lock()
_cached_token: Optional[str] = None
_token_timestamp: float = 0.0


def get_azure_ad_token() -> str:
    """Return a cached Azure AD bearer token, refreshing if expired.

    If the ``AZURE_AD_TOKEN`` environment variable is set, its value is
    returned directly.  This allows callers to inject a pre-acquired
    short-lived token into ephemeral pods that have no Azure identity
    of their own.

    Otherwise the token is obtained via ``get_bearer_token_provider(DefaultAzureCredential(), ...)``
    and cached for up to TOKEN_EXPIRY_SECONDS (1 hour).
    """
    global _cached_token, _token_timestamp

    pre_acquired = os.environ.get("AZURE_AD_TOKEN")
    if pre_acquired:
        return pre_acquired

    with _lock:
        now = time.monotonic()
        if _cached_token is not None and (now - _token_timestamp) < TOKEN_EXPIRY_SECONDS:
            return _cached_token

        logger.info("Fetching new Azure AD token for Azure AI Foundry authentication")
        credential = DefaultAzureCredential()
        token_provider = get_bearer_token_provider(credential, AZURE_COGNITIVE_SERVICES_SCOPE)
        _cached_token = token_provider()
        _token_timestamp = now
        return _cached_token

```

### Core Architecture Module: `holmes/core/config.py`
```
import os

config_path_dir: str = os.environ.get(
    "HOLMES_CONFIGPATH_DIR", os.path.expanduser("~/.holmes")
)

```

### Core Architecture Module: `holmes/core/conversation_links.py`
```
from typing import Optional
from urllib.parse import quote, urlparse

from holmes.common.env_vars import ROBUSTA_UI_DOMAIN

# The request_source of an interactive Ask Holmes chat started in the platform
# UI — the only conversation kind with a /holmes/chat page to link back to.
FREEFORM_CHAT_REQUEST_SOURCE = "freeform"


def derive_freeform_chat_link(
    request_source: Optional[str],
    conversation_id: Optional[str],
    account_id: Optional[str],
) -> Optional[str]:
    """Server-derived platform URL of a freeform Ask Holmes chat.

    Built account-less with an ``?account_id=`` hint (the SPA's account guard
    resolves it into the account's route), so it needs nothing beyond what the
    server already knows — no client-supplied value can pick the destination.
    Relay's UI-link builders emit the other canonical shape for the same page,
    ``/<account_name>/holmes/chat/<id>``, because relay can resolve the account
    name; both route to the same chat, so don't "unify" one onto the other.
    """
    if request_source != FREEFORM_CHAT_REQUEST_SOURCE:
        return None
    if not conversation_id or not account_id:
        return None
    base = (ROBUSTA_UI_DOMAIN or "").rstrip("/")
    if not base:
        return None
    return (
        f"{base}/holmes/chat/{quote(str(conversation_id), safe='')}"
        f"?account_id={quote(str(account_id), safe='')}"
    )


def resolve_conversation_link(
    request_source: Optional[str],
    conversation_id: Optional[str],
    account_id: Optional[str],
    supplied_link: Optional[str],
) -> Optional[str]:
    """The conversation_link a chat actually gets.

    Freeform platform chats use only the server-derived link — when derivation
    isn't possible they get none, never the client-suppliable value, so a
    freeform link's destination can't be picked by the client. Every other
    surface (Slack, Teams, triggered workflows, alert triage) passes through
    the link its server built upstream.
    """
    if request_source == FREEFORM_CHAT_REQUEST_SOURCE:
        return derive_freeform_chat_link(request_source, conversation_id, account_id)
    return supplied_link


MAX_CONVERSATION_LINK_LENGTH = 2048


def _is_allowed_conversation_link_origin(scheme: str, host: str) -> bool:
    # The deployment's own UI (covers self-hosted instances, http included).
    ui = urlparse(ROBUSTA_UI_DOMAIN or "")
    if scheme == ui.scheme and host == (ui.hostname or "").lower():
        return True
    if scheme != "https":
        return False
    # Robusta platform in any region, Slack permalinks, Teams deep links —
    # the only surfaces that originate conversations. Slack permalinks always
    # live on a workspace subdomain, so apex slack.com is deliberately absent.
    return (
        host == "robusta.dev"
        or host.endswith(".robusta.dev")
        or host.endswith(".slack.com")
        or host == "teams.microsoft.com"
    )


def sanitize_conversation_link(link: Optional[str]) -> Optional[str]:
    """Drop any conversation_link that isn't a well-formed URL to a surface
    conversations actually originate from.

    The value is client-suppliable (REST body, Conversations metadata) and is
    rendered verbatim into the system prompt with an instruction to copy it
    into PR/issue descriptions — so both the text shape AND the destination
    must be server-controlled: no whitespace/control-character/length games
    (prompt injection), and no arbitrary hosts (a tracking or phishing URL
    laundered into public artifacts). All server-built links (Slack permalinks,
    Teams deep links, platform UI URLs, derive_freeform_chat_link's output)
    pass this check.
    """
    if not link:
        return None
    if len(link) > MAX_CONVERSATION_LINK_LENGTH or any(
        ch.isspace() or not ch.isprintable() for ch in link
    ):
        return None
    parsed = urlparse(link)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    if host.startswith(".") or not _is_allowed_conversation_link_origin(
        parsed.scheme, host
    ):
        return None
    return link

```

### Core Architecture Module: `holmes/core/conversations.py`
```
from typing import Any, Dict, List, Optional, Union

from holmes.config import Config
from holmes.core.prompt import (
    PromptComponent,
    build_prompts,
)
from holmes.core.tool_calling_llm import ToolCallingLLM
from holmes.plugins.skills.skill_loader import SkillCatalog
from holmes.utils.global_instructions import (
    Instructions,
)


def add_or_update_system_prompt(
    conversation_history: List[Dict[str, Any]],
    system_prompt: Optional[str],
):
    """Add or replace the system prompt in conversation history.

    Only replaces an existing system prompt if it's the first message.
    Otherwise inserts at position 0 if no system message exists.
    """
    if system_prompt is None:
        return conversation_history

    if not conversation_history:
        conversation_history.append({"role": "system", "content": system_prompt})
    elif conversation_history[0]["role"] == "system":
        conversation_history[0]["content"] = system_prompt
    else:
        existing_system_prompt = next(
            (
                message
                for message in conversation_history
                if message.get("role") == "system"
            ),
            None,
        )
        if not existing_system_prompt:
            conversation_history.insert(0, {"role": "system", "content": system_prompt})

    return conversation_history


def build_chat_messages(
    ask: str,
    conversation_history: Optional[List[Dict[str, str]]],
    ai: ToolCallingLLM,
    config: Config,
    global_instructions: Optional[Instructions] = None,
    additional_system_prompt: Optional[str] = None,
    skills: Optional[SkillCatalog] = None,
    images: Optional[List[Union[str, Dict[str, Any]]]] = None,
    prompt_component_overrides: Optional[Dict[PromptComponent, bool]] = None,
    conversation_link: Optional[str] = None,
) -> List[dict]:
    """Build messages for general chat conversation.

    Expects conversation_history in OpenAI format (system message first).
    For new conversations, creates system prompt via build_system_prompt.
    For existing conversations, updates the system prompt.

    Context window management (compaction, spill-to-disk) is handled by
    call_stream() -> compact_if_necessary(), not here.
    See docs/reference/context-management.md.
    """

    system_prompt, user_content = build_prompts(
        toolsets=ai.tool_executor.toolsets,
        user_prompt=ask,
        skills=skills,
        global_instructions=global_instructions,
        system_prompt_additions=additional_system_prompt,
        cluster_name=config.cluster_name,
        ask_user_enabled=False,
        file_paths=None,
        include_todowrite_reminder=False,
        images=images,
        prompt_component_overrides=prompt_component_overrides,
        conversation_link=conversation_link,
    )

    if not conversation_history:
        conversation_history = []
    else:
        conversation_history = conversation_history.copy()
    conversation_history = add_or_update_system_prompt(
        conversation_history, system_prompt
    )

    conversation_history.append({"role": "user", "content": user_content})  # type: ignore

    return conversation_history  # type: ignore

```

### Core Architecture Module: `holmes/core/conversations_worker/__init__.py`
```
from holmes.core.conversations_worker.worker import ConversationWorker

__all__ = ["ConversationWorker"]

```

### Core Architecture Module: `holmes/core/conversations_worker/event_publisher.py`
```
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional, TYPE_CHECKING

from holmes.core.conversations_worker.models import ConversationReassignedError
from holmes.utils.stream import StreamEvents, StreamMessage

if TYPE_CHECKING:
    from holmes.core.supabase_dal import SupabaseDal


# Events that end a turn and must be flushed immediately.  The publisher
# reports the last one it saw back to the worker so the conversation status
# can be set appropriately.
_TERMINAL_EVENTS = {
    StreamEvents.ANSWER_END,
    StreamEvents.APPROVAL_REQUIRED,
    StreamEvents.ERROR,
}

# Events that should cause an immediate flush.  Terminal events end a turn;
# CONVERSATION_HISTORY_COMPACTED isn't terminal but carries the same
# "history snapshot + prior events superseded" semantics so it's flushed +
# compacted with the same logic.  TOKEN_COUNT events are flushed eagerly:
# call_stream() emits one right after the LLM response (before tool execution
# starts) and one right after the last TOOL_RESULT of a batch (before the
# next LLM call).  Both boundaries precede a long-running step (>1s tool
# work or LLM call), so flushing here keeps subscribers up to date without
# the per-tool write amplification of flushing on every TOOL_RESULT.
_FLUSH_IMMEDIATELY_EVENTS = _TERMINAL_EVENTS | {
    StreamEvents.CONVERSATION_HISTORY_COMPACTED,
    StreamEvents.TOKEN_COUNT,
}

# Events whose `messages` array carries the full conversation history
# snapshot — all prior events are superseded and should be marked compacted.
_COMPACT_ON_FLUSH_EVENTS = {
    StreamEvents.ANSWER_END,
    StreamEvents.APPROVAL_REQUIRED,
    StreamEvents.CONVERSATION_HISTORY_COMPACTED,
}


class ConversationEventPublisher:
    """
    Consumes StreamMessage events from call_stream() and batches them
    into ConversationEvents rows in Supabase.
    """

    def __init__(
        self,
        dal: "SupabaseDal",
        conversation_id: str,
        assignee: str,
        request_sequence: int,
        batch_interval_seconds: float = 1.0,
    ):
        self.dal = dal
        self.conversation_id = conversation_id
        self.assignee = assignee
        self.request_sequence = request_sequence
        self.batch_interval_seconds = batch_interval_seconds

        self._pending_events: List[Dict[str, Any]] = []
        self._last_flush_time: float = time.monotonic()
        self._last_retry_time: float = 0.0
        # Guards _pending_events, _pending_compact, and _last_*_time.
        self._lock = threading.Lock()

        self._last_terminal_event: Optional[StreamEvents] = None

        # Sticky compact flag: set when a compact flush is attempted but the
        # DAL returns None. Ensures the compact intent is preserved across
        # retries and the final drain.
        self._pending_compact: bool = False

    def consume(
        self,
        stream: Generator[StreamMessage, None, None],
    ) -> Optional[StreamEvents]:
        """
        Drain the stream generator, batching events and writing them to the DB.
        Returns the terminal StreamEvents value observed, or None if the stream ended
        without a terminal event.
        Raises ConversationReassignedError if the conversation was reassigned mid-stream.
        """
        reassigned = False
        try:
            for message in stream:
                self._append_event(message)
                if message.event in _TERMINAL_EVENTS:
                    self._last_terminal_event = message.event
                # Flush on terminal events immediately, or when interval elapses
                if message.event in _FLUSH_IMMEDIATELY_EVENTS:
                    # ai_answer_end / approval_required / compacted carry a
                    # full conversation history snapshot in their messages
                    # array, so all prior events are superseded → compact.
                    if message.event in _COMPACT_ON_FLUSH_EVENTS:
                        with self._lock:
                            self._pending_compact = True
                    self._flush()
                else:
                    with self._lock:
                        due = (
                            time.monotonic() - self._last_flush_time
                            >= self.batch_interval_seconds
                            and time.monotonic() - self._last_retry_time
                            >= self.batch_interval_seconds
                        )
                    if due:
                        self._flush()
        except ConversationReassignedError:
            reassigned = True
            raise
        finally:
            # Final drain of any remaining events — skip if the conversation
            # was reassigned, since our assignee/sequence are stale and writing
            # would either fail or race with the new owner.
            if not reassigned:
                self._flush()

        # If events remain unsaved after the stream is fully consumed, the
        # terminal batch was lost (repeated None returns). Surface this to the
        # caller so the conversation is marked failed rather than completed.
        with self._lock:
            remaining = len(self._pending_events)
        if remaining > 0:
            logging.error(
                "consume() finished with %d unsaved events for conversation %s",
                remaining,
                self.conversation_id,
            )
            return None

        return self._last_terminal_event

    def _append_event(self, message: StreamMessage) -> None:
        with self._lock:
            self._pending_events.append(
                {
                    "event": message.event.value,
                    "data": message.data,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
            )

    def _post_with_retry(
        self, events_to_flush: List[Dict[str, Any]], compact: bool
    ) -> Optional[int]:
        """Post events via the DAL, which already retries transient errors and
        promotes mismatch errors to ConversationReassignedError.

        Reassignment propagates so the worker exits cleanly; any other
        post-retry failure becomes None so ``_flush`` retains the events and
        retries them on the next flush.
        """
        try:
            return self.dal.post_conversation_events(
                conversation_id=self.conversation_id,
                assignee=self.assignee,
                request_sequence=self.request_sequence,
                events=events_to_flush,
                compact=compact,
            )
        except ConversationReassignedError:
            raise
        except Exception as e:
            # Defensive: promote a raw mismatch if one leaks past the DAL.
            if "mismatch" in str(e).lower():
                raise ConversationReassignedError(str(e)) from e
            logging.warning(
                "post_conversation_events failed after retries for conversation %s: %s",
                self.conversation_id,
                e,
            )
            return None

    def _flush(self) -> None:
        with self._lock:
            if not self._pending_events:
                return
            # Snapshot but don't clear yet — only clear after a successful post.
            events_to_flush = list(self._pending_events)
            compact = self._pending_compact

        seq = self._post_with_retry(events_to_flush, compact)

        if seq is None:
            # All retries exhausted (or the DAL is disabled). Keep events and
            # compact flag in memory so the next flush retries. Update
            # _last_retry_time to throttle retries independently of normal
            # flush timing.
            with self._lock:
                self._last_retry_time = time.monotonic()
            logging.warning(
                "post_conversation_events returned None for conversation %s — "
                "events retained for retry (%d events, compact=%s)",
                self.conversation_id,
                len(events_to_flush),
                compact,
            )
            return

        # Success — remove the flushed events and clear the compact flag.
        # New events may have been appended while the RPC was in flight,
        # so we remove only the count we just posted.
        with self._lock:
            del self._pending_events[: len(events_to_flush)]
            self._pending_compact = False
            self._last_flush_time = time.monotonic()
        logging.debug(
            "Posted %d events to conversation %s (seq=%s, compact=%s)",
            len(events_to_flush),
            self.conversation_id,
            seq,
            compact,
        )

```

### Core Architecture Module: `holmes/core/conversations_worker/models.py`
```
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, PrivateAttr


class ConversationStatus(str, Enum):
    PENDING = "pending"
    # DEPRECATED: claims now land directly in RUNNING. Kept (and still accepted
    # everywhere) for backwards compat with in-flight rows / mixed rollout.
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"
    # Written by the pg_cron stale sweep, and by the worker itself for
    # conversations still in flight when Holmes shuts down.
    TIMEOUT = "timeout"

    @classmethod
    def updatable_values(cls) -> tuple:
        """Statuses accepted by ``update_conversation_status`` (QUEUED kept for compat).

        TIMEOUT requires robusta-storage migration 20260817121606, which is
        applied before this ships.
        """
        return (
            cls.QUEUED.value,
            cls.RUNNING.value,
            cls.COMPLETED.value,
            cls.FAILED.value,
            cls.TIMEOUT.value,
        )


class RemoteToolCallStatus(str, Enum):
    """Status lifecycle of a RemoteToolCalls row.

    The executor (ToolCallWorker) only writes the two terminal results:
    ``COMPLETED`` (a tool_response was produced — including tool-level errors)
    and ``FAILED`` (the executor crashed before producing one). ``STOPPED``
    (relay timeout) and ``TIMEOUT`` (stale-row sweep) are written by relay /
    the claim RPC.
    """

    PENDING = "pending"
    # DEPRECATED: claims now land directly in RUNNING. Kept for compat — see
    # ConversationStatus.QUEUED.
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"
    TIMEOUT = "timeout"


class ConversationTask(BaseModel):
    """A claimed conversation ready for processing."""

    conversation_id: str
    account_id: str
    cluster_id: str
    origin: str
    request_sequence: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    title: Optional[str] = None
    # Conversations.user_id (RLS-bound owner). The only identity source for
    # the turn: OAuth tokens, personal skills, relay RBAC, usage attribution.
    user_id: Optional[str] = None

    @property
    def active_key(self) -> tuple:
        """In-flight key (conversation_id, request_sequence) — keyed by sequence
        too so overlapping turns of one conversation count independently for
        capacity."""
        return (self.conversation_id, self.request_sequence)

    # Hydrated post-construction from events; not part of the validated row schema.
    _user_message_data: Dict[str, Any] = PrivateAttr(default_factory=dict)
    _conversation_history: Optional[List[Dict[str, Any]]] = PrivateAttr(default=None)

    @property
    def user_message_data(self) -> Dict[str, Any]:
        """Raw data from the latest ``user_message`` event."""
        return self._user_message_data

    @user_message_data.setter
    def user_message_data(self, value: Dict[str, Any]) -> None:
        self._user_message_data = value

    @property
    def conversation_history(self) -> Optional[List[Dict[str, Any]]]:
        """Reconstructed from prior terminal events (ai_answer_end / approval_required)."""
        return self._conversation_history

    @conversation_history.setter
    def conversation_history(self, value: Optional[List[Dict[str, Any]]]) -> None:
        self._conversation_history = value


class ConversationReassignedError(Exception):
    """Raised when the conversation's assignee/request_sequence no longer matches ours."""


EVENT_USER_MESSAGE = "user_message"

```

### Core Architecture Module: `holmes/core/conversations_worker/realtime_manager.py`
```
"""
Realtime manager for the ConversationWorker.

Runs an asyncio event loop in a background daemon thread. Manages a Supabase
Realtime subscription that notifies the worker when new pending conversations
appear.  Two subscription modes are supported (selected via the
``CONVERSATION_WORKER_USE_REALTIME_BROADCAST`` env var):

 1. **Postgres Changes** — subscribes to INSERT/UPDATE on the
    Conversations table filtered by ``account_id``.
 2. **Broadcast** (default) — subscribes to a per-account-per-cluster Broadcast channel
    ``holmes:submit:{account_id}:{cluster_id}``.  The initiator (Frontend /
    Relay) must send a broadcast after creating the conversation.

Communication with the sync ConversationWorker is via a callback that is
invoked when a pending-conversation notification arrives. The callback MUST
be thread-safe (the worker passes a threading.Event.set).
"""
from __future__ import annotations

import asyncio
import logging
import os
import ssl
import threading
import time
import urllib.parse
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING

import jwt
import realtime._async.client as rt_client
from realtime._async.channel import ChannelStates
from realtime._async.client import AsyncRealtimeClient

from holmes.common.env_vars import (
    CONVERSATION_WORKER_AUTH_REFRESH_INTERVAL_SECONDS,
    CONVERSATION_WORKER_REALTIME_HEALTH_TICK_SECONDS,
    CONVERSATION_WORKER_REALTIME_RECONNECT_MAX_SECONDS,
    CONVERSATION_WORKER_USE_REALTIME_BROADCAST,
)
from holmes.core.supabase_dal import CONVERSATIONS_TABLE

if TYPE_CHECKING:
    from holmes.core.supabase_dal import SupabaseDal


# When a (re)connect keeps failing the loop retries forever; log the full
# traceback on the first attempt and then every 10th attempt, and just the
# attempt number on the rest, so a sustained outage doesn't flood the logs.
_RECONNECT_LOG_FULL_EVERY = 10

# Upper bound on the re-sign-in performed during _full_reconnect (ROB-759).
# Comfortably above the DAL httpx client's 60s request timeout so it only
# fires if that bound is bypassed (misconfig/regression), guaranteeing the
# reconnect loop can never be stalled indefinitely by a hung auth call.
_RECONNECT_SIGN_IN_TIMEOUT_SECONDS = 90

# Must exceed the auth refresh interval so a tick lands inside it.
_AUTH_REFRESH_LEEWAY_SECONDS = 300


def _expires_within(token: str, seconds: float) -> bool:
    # Signature is irrelevant; exp is our own claim.
    exp = jwt.decode(token, options={"verify_signature": False})["exp"]
    return exp - time.time() <= seconds


# ---- channel topic helpers ----


def pg_changes_topic(account_id: str) -> str:
    """Per-account channel for Conversations Postgres Changes."""
    return f"holmes:pgchanges:{account_id}"


def broadcast_submit_topic(account_id: str, cluster_id: str) -> str:
    """Per-account-per-cluster Broadcast channel for conversation submissions.

    No WAL replication overhead — the initiator sends a broadcast message
    after creating the conversation via RPC.
    """
    return f"holmes:submit:{account_id}:{cluster_id}"


def _build_ssl_context() -> ssl.SSLContext:
    """Build the SSL context used for outbound Realtime WebSocket connections.

    The ``CERTIFICATE`` env var (handled by ``holmes.utils.cert_utils``) sets
    ``REQUESTS_CA_BUNDLE`` / ``WEBSOCKET_CLIENT_CA_BUNDLE`` and patches
    ``certifi.where()``, but the ``websockets`` stdlib client ignores all of
    those and falls back to the OS trust store — so a custom CA never makes
    it into the WS handshake. Honor the env vars here so the realtime
    connection trusts the same bundle the rest of the app does.
    """
    cafile = (
        os.environ.get("REQUESTS_CA_BUNDLE")
        or os.environ.get("WEBSOCKET_CLIENT_CA_BUNDLE")
    )
    if cafile:
        if os.path.exists(cafile):
            return ssl.create_default_context(cafile=cafile)
        logging.warning(
            "CA bundle %s does not exist; falling back to OS trust store",
            cafile,
        )
    return ssl.create_default_context()


def _install_ssl_patch_if_needed() -> None:
    """
    Monkey-patch ``realtime._async.client.connect`` to inject an SSL context
    that trusts the custom CA bundle (``CERTIFICATE`` env var) for ``wss://``
    targets. The websockets stdlib client otherwise uses only the OS trust
    store, breaking deployments behind a corporate / private CA.

    HTTP CONNECT proxy support (``https_proxy`` / ``HTTPS_PROXY`` env vars) is
    handled natively by ``websockets`` ≥ 13 via ``python-socks``, so no proxy
    monkey-patching is needed — websockets reads the env var itself when its
    ``connect()`` is called with no explicit ``proxy`` kwarg, and our patch
    leaves all other kwargs untouched.

    Idempotent.
    """
    cafile = (
        os.environ.get("REQUESTS_CA_BUNDLE")
        or os.environ.get("WEBSOCKET_CLIENT_CA_BUNDLE")
    )
    if not cafile:
        return
    if not os.path.exists(cafile):
        logging.warning(
            "CA bundle %s does not exist; falling back to OS trust store",
            cafile,
        )
        return

    if getattr(rt_client, "_holmes_ssl_patched", False):
        return

    ctx = _build_ssl_context()
    original_connect = rt_client.connect

    async def _ssl_connect(url: str, *args: Any, **kwargs: Any) -> Any:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme == "wss" and "ssl" not in kwargs:
            kwargs["ssl"] = ctx
        return await original_connect(url, *args, **kwargs)

    rt_client.connect = _ssl_connect  # type: ignore[attr-defined]
    rt_client._holmes_ssl_patched = True  # type: ignore[attr-defined]
    logging.info(
        "Installed WebSocket SSL patch for realtime client (cafile=%s)", cafile
    )


class _RealtimeConnectivityWarningFilter(logging.Filter):
    """Downgrade transient realtime connectivity ERROR logs to WARNING.

    The realtime library logs at ERROR for events that its own retry
    machinery (rejoin timer, auto-reconnect) or our `_full_reconnect` loop
    will recover from automatically — join push timeouts, WebSocket closes,
    individual connect attempt failures. These are noisy alerts, not real
    errors: if recovery ultimately fails the failure surfaces via raised
    exceptions our code catches and logs at the appropriate level.
    """

    _DOWNGRADE_PATTERNS = (
        "join push timeout",
        "Connection attempt failed",
        "Connection failed permanently",
        "WebSocket connection closed",
    )

    def filter(self, record: logging.LogRecord) -> bool:
        if record.levelno != logging.ERROR:
            return True
        msg = record.getMessage()
        if any(p in msg for p in self._DOWNGRADE_PATTERNS):
            record.levelno = logging.WARNING
            record.levelname = "WARNING"
        return True


def _install_realtime_log_filter_if_needed() -> None:
    """Attach the connectivity-warning filter to the realtime library loggers.

    Idempotent.
    """
    for logger_name in ("realtime._async.channel", "realtime._async.client"):
        lg = logging.getLogger(logger_name)
        if any(
            isinstance(f, _RealtimeConnectivityWarningFilter) for f in lg.filters
        ):
            continue
        lg.addFilter(_RealtimeConnectivityWarningFilter())


class RealtimeWorker:
    """Owns ALL generic Supabase Realtime plumbing for the holmes:submit
    channel — connection, auth refresh, reconnection, subscribe states —
    and routes received broadcasts to the right worker:

      * 'pending_conversations' -> conversation_worker.claim_pending_conversations()
      * 'pending_tool_calls'    -> tool_call_worker.claim_pending_tool_calls()

    Both routing targets MUST be non-blocking (they just wake the worker's
    claim loop). On (re)subscribe both workers are notified so anything
    missed during a disconnect gets drained.
    """

    def __init__(
        self,
        dal: "SupabaseDal",
        holmes_id: str,
        conversation_worker: Optional[Any] = None,
        tool_call_worker: Optional[Any] = None,
        use_broadcast: bool = CONVERSATION_WORKER_USE_REALTIME_BROADCAST,
        on_new_pending: Optional[Callable[[], None]] = None,
        on_new_tool_calls: Optional[Callable[[], None]] = None,
    ) -> None:
        self.dal = dal
        self.holmes_id = holmes_id
        # Routing targets. The worker objects are the primary surface;
        # the raw callables remain as low-level overrides (tests).
        if on_new_pending is None and conversation_worker is not None:
            on_new_pending = conversation_worker.claim_pending_conversations
        if on_new_pending is None:
            raise ValueError(
                "RealtimeWorker needs a conversation_worker or on_new_pending"
            )
        self.on_new_pending = on_new_pending
        if on_new_tool_calls is None and tool_call_worker is not None:
            on_new_tool_calls = tool_call_worker.claim_pending_tool_calls
        self.on_new_tool_calls = on_new_tool_calls
        self._use_broadcast = use_broadcast

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._started = threading.Event()
        self._client = None
        self._channel = None
        # True once the subscription channel is SUBSCRIBED (drives
        # is_connected() and the claim-loop's realtime-vs-poll decision).
        self._connected = False
        # Last JWT we pushed to the realtime client via set_auth.
        self._last_auth_jwt: Optional[str] = None
        # Set from the async loop to wake the sleep in _run() on stop().
        self._async_stop: Optional[asyncio.Event] = None

    def _wake_all(self) -> None:
        """Wake BOTH workers. Used at every (re)subscribe / reconnect / WAL
        notification so missed conversations AND remote tool calls are
        re-drained — the pgchanges path c
```

### Core Architecture Module: `holmes/core/conversations_worker/tool_call_worker.py`
```
"""
Remote tool-call worker — executes cross-cluster tool calls.

A Holmes instance in another cluster (the caller) asked relay's platform-mcp
to run a tool here. platform-mcp created a row in the "RemoteToolCalls" table
and broadcast a 'pending_tool_calls' event on holmes:submit:{account}:{cluster}.
This worker claims such rows (claim_n_pending_tool_calls RPC — only as many as
it has free pool slots), runs exactly one tool per row — no LLM loop — and
writes tool_response + terminal status in one atomic UPDATE
(post_remote_tool_call_result RPC).

Tool calls run in their own thread pool (TOOL_CALLER_MAX_CONCURRENT) so they
never compete with user chats for the conversation worker's pool.

Design: relay repo, docs/design/2026-06-10_remote-tool-execution.md.
"""

import base64
import gzip
import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Any, Dict, Optional

from holmes.common.env_vars import (
    CONVERSATION_WORKER_POLL_INTERVAL_SECONDS_WITH_REALTIME,
    CONVERSATION_WORKER_POLL_INTERVAL_SECONDS_WITHOUT_REALTIME,
    REMOTE_TOOL_RESULT_COMPRESS_THRESHOLD_CHARS,
    REMOTE_TOOL_RESULT_MAX_BYTES,
    TOOL_CALLER_MAX_CONCURRENT,
)
from holmes.core.conversations_worker.models import RemoteToolCallStatus
from holmes.core.tools import (
    PrerequisiteCacheMode,
    StructuredToolResult,
    StructuredToolResultStatus,
    ToolInvokeContext,
    ToolsetTag,
)
from holmes.version import get_version

if TYPE_CHECKING:
    from holmes.config import Config
    from holmes.core.supabase_dal import SupabaseDal


def _error_response(error: str, invocation: Optional[str] = None) -> Dict[str, Any]:
    return {
        "status": StructuredToolResultStatus.ERROR.value,
        "data": None,
        "compressed": False,
        "data_gz_b64": None,
        "error": error,
        "invocation": invocation,
        "executor_holmes_version": get_version(),
    }


def serialize_tool_response(
    result: StructuredToolResult,
    elapsed_seconds: float,
    max_bytes: int = REMOTE_TOOL_RESULT_MAX_BYTES,
    compress_threshold: int = REMOTE_TOOL_RESULT_COMPRESS_THRESHOLD_CHARS,
) -> Dict[str, Any]:
    """Serialize a StructuredToolResult into the tool_response payload.

    - Images are dropped (text results only in v1).
    - Uncompressed data larger than max_bytes (1MB) is rejected with a
      narrow-the-query error.
    - Data over compress_threshold chars is stored gzip+base64 so the DB row,
      WAL and realtime traffic stay small; relay inflates before replying —
      but only when the base64 of the gzip is actually smaller than the
      original text (incompressible data would otherwise grow ~33%).
    """
    data, _is_json = result.stringify_data(compact=False)
    data = data or ""

    payload: Dict[str, Any] = {
        "status": result.status.value
        if hasattr(result.status, "value")
        else str(result.status),
        "data": data,
        "compressed": False,
        "data_gz_b64": None,
        "error": result.error,
        "return_code": result.return_code,
        "invocation": result.invocation,
        "elapsed_seconds": round(elapsed_seconds, 3),
        "executor_holmes_version": get_version(),
    }

    size = len(data.encode("utf-8", errors="replace"))
    if size > max_bytes:
        payload["status"] = StructuredToolResultStatus.ERROR.value
        payload["data"] = None
        payload["error"] = (
            f"result too large ({size} bytes > {max_bytes}); narrow the query "
            "(smaller time range, tighter filters, lower limit)"
        )
        return payload

    if len(data) > compress_threshold:
        gz_b64 = base64.b64encode(
            gzip.compress(data.encode("utf-8", errors="replace"))
        ).decode("ascii")
        if len(gz_b64) < len(data):
            payload["data_gz_b64"] = gz_b64
            payload["compressed"] = True
            payload["data"] = None

    return payload


# Saturation must persist continuously this long before the INFO line fires
# (mirrors worker.py's _SATURATION_LOG_AFTER_SECONDS; kept local to avoid a
# circular import — worker.py imports this module).
_SATURATION_LOG_AFTER_SECONDS = 60.0


class ToolCallWorker:
    """Claims and executes remote tool calls for this cluster.

    Lifecycle mirrors the conversation worker's claim loop, with its own
    notify event (woken by the 'pending_tool_calls' broadcast via
    RealtimeManager) and its own thread pool.
    """

    def __init__(self, dal: "SupabaseDal", config: "Config", holmes_id: str):
        self.dal = dal
        self.config = config
        self.holmes_id = holmes_id

        self._running = False
        self._notify_event = threading.Event()
        self._claim_thread: Optional[threading.Thread] = None
        self._pool: Optional[ThreadPoolExecutor] = None
        self._llm = None  # lazily created; used only for in-tool token counting
        self._realtime_connected = lambda: False

        # Count of tool calls currently submitted to / running in the pool, so
        # we only claim as many new rows as we have free capacity. Surplus
        # rows stay 'pending' for the next poll or another Holmes instance.
        self._active_lock = threading.Lock()
        self._active_count = 0
        # Saturation-transition logging (ROB-759): claiming used to be
        # skipped silently at full capacity, which looks identical to a dead
        # claim loop. Same debounced enter/exit scheme as ConversationWorker
        # (see _note_saturation there): the INFO fires only after 60s of
        # CONTINUOUS saturation, so backlog churn (free→refill per completed
        # call) never flickers.
        self._saturated_since: Optional[float] = None
        self._saturation_logged = False

    # ---- lifecycle ----

    def start(self, realtime_connected_fn=None) -> None:
        if self._running:
            return
        self._running = True
        if realtime_connected_fn is not None:
            self._realtime_connected = realtime_connected_fn
        self._pool = ThreadPoolExecutor(
            max_workers=TOOL_CALLER_MAX_CONCURRENT,
            thread_name_prefix="tool-call-worker",
        )
        self._claim_thread = threading.Thread(
            target=self._claim_loop, daemon=True, name="tool-call-claim-loop"
        )
        self._claim_thread.start()
        logging.info(
            "ToolCallWorker started (holmes_id=%s, max_concurrent=%d)",
            self.holmes_id,
            TOOL_CALLER_MAX_CONCURRENT,
        )

    def stop(self) -> None:
        self._running = False
        self._notify_event.set()
        if self._claim_thread:
            self._claim_thread.join(timeout=5)
            self._claim_thread = None
        if self._pool:
            self._pool.shutdown(wait=False)
            self._pool = None

    def claim_pending_tool_calls(self) -> None:
        """Routing target for RealtimeWorker on 'pending_tool_calls'
        broadcasts. Non-blocking: wakes the claim loop."""
        self._notify_event.set()

    # ---- claim loop ----

    def _claim_loop(self) -> None:
        # Claim once on startup to drain anything pending before we
        # subscribed (or while we were down).
        self._try_claim_and_dispatch()
        while self._running:
            if self._realtime_connected():
                timeout = CONVERSATION_WORKER_POLL_INTERVAL_SECONDS_WITH_REALTIME
            else:
                timeout = CONVERSATION_WORKER_POLL_INTERVAL_SECONDS_WITHOUT_REALTIME
            self._notify_event.wait(timeout=timeout)
            if not self._running:
                break
            self._notify_event.clear()
            try:
                self._try_claim_and_dispatch()
            except Exception:
                logging.exception("Error in ToolCallWorker claim loop", exc_info=True)

    def _try_claim_and_dispatch(self) -> None:
        # Claim only as many tool calls as we have free pool slots. Surplus
        # rows stay 'pending' so another Holmes instance can claim them and so
        # we never hold more than TOOL_CALLER_MAX_CONCURRENT claimed + running.
        # As running tool calls finish, _execute_safe wakes this loop to
        # re-claim.
        with self._active_lock:
            free = TOOL_CALLER_MAX_CONCURRENT - self._active_count
        if free <= 0:
            now = time.monotonic()
            if self._saturated_since is None:
                self._saturated_since = now
            elif (
                not self._saturation_logged
                and now - self._saturated_since >= _SATURATION_LOG_AFTER_SECONDS
            ):
                self._saturation_logged = True
                logging.info(
                    "ToolCallWorker claim capacity saturated for %.0fs: all %d "
                    "slots in use; pending tool calls will not be claimed "
                    "until one finishes.",
                    now - self._saturated_since,
                    TOOL_CALLER_MAX_CONCURRENT,
                )
            return
        if self._saturation_logged:
            logging.info(
                "ToolCallWorker claim capacity available again (free=%d) "
                "after %.0fs saturated",
                free,
                time.monotonic() - (self._saturated_since or 0.0),
            )
        self._saturated_since = None
        self._saturation_logged = False
        # Check pool/running BEFORE claiming so we never claim rows we won't
        # submit; once claimed we dispatch every row (no mid-loop _running
        # check) so a racing stop() can't strand claimed rows until timeout.
        pool = self._pool
        if pool is None or not self._running:
            return
        claimed = self.dal.claim_n_pending_tool_calls(self.holmes_id, free)
        if not claimed:
            return
        logging.info(
            "ToolCallWorker: claimed %d tool call(s) (free slots=%d)",
            len(
```

### Core Architecture Module: `holmes/core/conversations_worker/worker.py`
```
import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING, Union

from starlette.requests import Request

from holmes.common.env_vars import (
    CONVERSATION_WORKER_EVENT_BATCH_INTERVAL_SECONDS,
    CONVERSATION_WORKER_MAX_CONCURRENT,
    CONVERSATION_WORKER_POLL_INTERVAL_SECONDS_WITH_REALTIME,
    CONVERSATION_WORKER_POLL_INTERVAL_SECONDS_WITHOUT_REALTIME,
    CONVERSATION_WORKER_REALTIME_ENABLED,
    CONVERSATION_WORKER_SLOT_STUCK_WARN_SECONDS,
    CONVERSATION_WORKER_REALTIME_VERIFY_INITIAL_BACKOFF_SECONDS,
    CONVERSATION_WORKER_REALTIME_VERIFY_MAX_BACKOFF_SECONDS,
)
from holmes.core.conversations import build_chat_messages
from holmes.core.conversations_worker.event_publisher import (
    ConversationEventPublisher,
)
from holmes.core.conversations_worker.models import (
    EVENT_USER_MESSAGE,
    ConversationReassignedError,
    ConversationStatus,
    ConversationTask,
)
from holmes.core.conversations_worker.realtime_manager import RealtimeWorker
from holmes.core.conversations_worker.tool_call_worker import ToolCallWorker
from holmes.core.models import ChatRequest
from holmes.core.conversation_links import resolve_conversation_link
from holmes.core.supabase_dal import SupabaseDnsException
from postgrest.exceptions import APIError as PGAPIError
from holmes.core.prompt import PromptComponent
from holmes.core.tools import PrerequisiteCacheMode, ToolsetTag
from holmes.core.tools_utils.filesystem_result_storage import (
    tool_result_storage,
)
from holmes.core.tools_utils.frontend_tools import (
    FrontendToolCollisionError,
    inject_frontend_tools,
)
from holmes.core.tracing import TracingFactory, langfuse_trace_attributes
from holmes.core.usage_recorder import (
    build_chat_recorder_state,
    stream_with_usage_recording,
)
from holmes.utils.holmes_status import update_holmes_status_in_db
from holmes.core.relay_refusal import RELAY_REFUSAL_ERROR_CODES, RelayRefusal
from holmes.utils.stream import StreamEvents

if TYPE_CHECKING:
    from fastapi.responses import StreamingResponse
    from holmes.config import Config
    from holmes.core.models import ChatResponse
    from holmes.core.supabase_dal import SupabaseDal

ChatFunction = Callable[
    [ChatRequest, Request], Union["ChatResponse", "StreamingResponse"]
]

# Saturation logging (ROB-759): the claim loop previously skipped claiming
# with zero output when all executor slots were occupied, which looked
# identical to a dead loop. Logging is transition-based, not periodic, so a
# healthy busy worker stays quiet:
#  * Saturation must persist CONTINUOUSLY for this long before the single
#    INFO line is emitted. A worker churning through a backlog frees a slot
#    on every completion (which wakes the claim loop synchronously), so its
#    saturation clock keeps resetting and it never logs — no enter/exit
#    flicker. Only a worker where nothing completes accumulates the full
#    window.
_SATURATION_LOG_AFTER_SECONDS = 60.0
#  * The stuck-slot WARNING (in-flight age above
#    CONVERSATION_WORKER_SLOT_STUCK_WARN_SECONDS while claiming is blocked)
#    repeats at most this often.
_STUCK_WARN_RATE_LIMIT_SECONDS = 300.0

# Shutdown handling. When the pod is asked to stop (SIGTERM from a rollout,
# node drain, scale-down), whatever conversations we are mid-turn on are never
# going to finish: the executor is not drained, the threads are daemons, and
# nothing else picks the row back up (the claim RPCs only take 'pending').
# Before this, the row simply stayed 'running' with our now-dead assignee until
# the pg_cron stale sweep retired it hours later — a spinner in the UI the whole
# time. We now retire them ourselves: an error event carrying the reason below,
# then status 'timeout'.
SHUTDOWN_REASON = "Holmes Restarted"
SHUTDOWN_ERROR_DESCRIPTION = (
    f"{SHUTDOWN_REASON} — this request was interrupted before it finished. "
    "Ask again to retry."
)
# Distinct from the generic 5000 so this is greppable and the FE can special-case
# it later; unmapped codes render `description` as-is today.
SHUTDOWN_ERROR_CODE = 5205
# Wall-clock budget for the whole retirement sweep. It is sequential and each
# row costs up to two DAL calls, each retrying 3 times with backoff, so a slow
# or unreachable Supabase could otherwise eat the container's termination grace
# period and earn us a SIGKILL — leaving the remaining rows 'running', the very
# thing this is here to prevent. Rows we don't reach fall back to the pg_cron
# stale sweep, exactly as they did before.
SHUTDOWN_RETIRE_BUDGET_SECONDS = 10.0


class _ActiveTask:
    """An in-flight conversation: the task itself plus when it took its slot.

    ``started`` is ``time.monotonic()`` and feeds the saturation/stuck-slot
    logging; ``task`` is kept so the shutdown path can address the row (it
    needs conversation_id + request_sequence, which the dict key alone no
    longer suffices for once we have to write to the DB).
    """

    __slots__ = ("task", "started")

    def __init__(self, task: "ConversationTask", started: float):
        self.task = task
        self.started = started


class ConversationWorker:
    """
    Conversation Worker.

    Active participant that picks up pending Conversation rows from Supabase,
    runs them through the existing /api/chat pipeline (via chat_function),
    and writes results back as ConversationEvents in real-time.

    Lifecycle: pending → running (claimed + processing) → completed/failed.
    The claim RPC lands a row directly in 'running' ('queued' is deprecated), so
    a conversation waiting for capacity stays 'pending'.
    """

    def __init__(
        self,
        dal: "SupabaseDal",
        config: "Config",
        chat_function: ChatFunction,
    ):
        self.dal = dal
        self.config = config
        self.chat_function = chat_function
        # Globally-unique process id (presence key + assignee). hostname alone
        # isn't unique across pod restarts/replicas, so add pid + short uuid4.
        hostname = os.environ.get("HOSTNAME") or "local"
        self.holmes_id = f"{hostname}-{os.getpid()}-{uuid.uuid4().hex[:8]}"

        self._running = False
        self._claim_thread: Optional[threading.Thread] = None
        self._notify_event = threading.Event()
        self._executor: Optional[ThreadPoolExecutor] = None

        # In-flight (running) tasks, keyed by (conversation_id, request_sequence)
        # — see ConversationTask.active_key — so overlapping turns of one
        # conversation are counted separately for capacity. The value is the
        # monotonic start time, so the claim loop can report how long each
        # in-flight task has been holding a slot (ROB-759).
        self._active_conversation_ids: Dict[Any, _ActiveTask] = {}
        self._active_lock = threading.Lock()

        # Saturation-transition logging state (ROB-759). _saturated_since is
        # the start of the current CONTINUOUS zero-free-slots stretch (None
        # when a claim attempt found free capacity); _saturation_logged marks
        # that the one INFO line for this stretch was emitted (its matching
        # exit line logs the total duration); _last_stuck_warn rate-limits
        # the stuck-slot WARNING. None means "never warned" — do NOT use 0.0
        # as the sentinel: time.monotonic() is seconds since boot on Linux,
        # so on a freshly booted host `now - 0.0` can be below the rate-limit
        # window and the FIRST warning would be silently suppressed.
        self._saturated_since: Optional[float] = None
        self._saturation_logged: bool = False
        self._last_stuck_warn: Optional[float] = None

        # Guards the _running check + executor.submit against the stop() race.
        self._dispatch_lock = threading.Lock()

        self._realtime_manager: Optional[RealtimeWorker] = None

        # Executes cross-cluster remote tool calls (RemoteToolCalls rows) in
        # its own pool; RealtimeWorker routes 'pending_tool_calls' broadcasts
        # to it (same holmes:submit channel the conversation worker uses).
        self._tool_call_worker = ToolCallWorker(
            dal=self.dal, config=self.config, holmes_id=self.holmes_id
        )

        # Background thread that verifies Supabase Realtime is actually
        # enabled by calling the is_realtime_enabled() RPC.  HolmesStatus
        # advertises supports_realtime_conversations=False on startup and
        # only flips to True once the verifier gets a definitive True from
        # Supabase. On a definitive False the verifier shuts the worker
        # down. Connectivity errors trigger an exponential backoff retry
        # — we keep retrying until Supabase responds.
        self._realtime_verify_thread: Optional[threading.Thread] = None
        # Used by the verifier to wait between retries; setting it during
        # stop() makes the thread exit promptly.
        self._realtime_verify_stop = threading.Event()

    def start(self) -> None:
        if not self.dal.enabled:
            logging.info(
                "ConversationWorker not started - Supabase DAL not enabled"
            )
            return
        if self._running:
            logging.warning("ConversationWorker is already running")
            return

        # We mark the worker as running so stop() / status checks see a
        # consistent state, but defer spinning up the executor, claim loop,
        # and Realtime subscription until the verifier confirms Supabase
        # Realtime is actually enabled.  Until then we don't poll or
        # subscribe — that would be wasted load against a project that
        # doesn't support our use case.
        self._running = True

        self._realtime_verify_stop.clear()
        self._realtime_verify_thread = threading.Thread(
            target=self._realtime_verify_loop,
            daemo
```

### Core Architecture Module: `holmes/core/feedback.py`
```
import os
from abc import ABC, abstractmethod
from typing import Callable, Optional

from .llm import LLM

DEFAULT_PRIVACY_NOTICE_BANNER = "Your feedback will be used to improve Holmesgpt's performance. Please avoid sharing sensitive personal information. By continuing, you consent to this data usage."
PRIVACY_NOTICE_BANNER = os.environ.get(
    "PRIVACY_NOTICE_BANNER", DEFAULT_PRIVACY_NOTICE_BANNER
)


class FeedbackInfoBase(ABC):
    """Abstract base class for all feedback-related classes that must implement to_dict()."""

    @abstractmethod
    def to_dict(self) -> dict:
        """Convert to dictionary representation. Must be implemented by all subclasses."""
        pass


class FeedbackLLM(FeedbackInfoBase):
    """Class to represent a LLM in the feedback."""

    def __init__(self, model: str, max_context_size: int):
        self.model = model
        self.max_context_size = max_context_size

    def update_from_llm(self, llm: LLM):
        self.model = llm.model
        self.max_context_size = llm.get_context_window_size()

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return self.__dict__


# TODO: extend the FeedbackLLMResponse to include each tool call results details used for evaluate the overall response.
# Currenlty tool call details in plan:
# - toolcall parameter and success/failure, toolcall truncation size
# - Holmes plan (todo list)
# - Holmes intermediate output
class FeedbackLLMResponse(FeedbackInfoBase):
    """Class to represent a LLM response in the feedback"""

    def __init__(self, user_ask: str, response: str):
        self.user_ask = user_ask
        self.response = response

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return self.__dict__


class FeedbackMetadata(FeedbackInfoBase):
    """Class to store feedback metadata."""

    def __init__(self):
        # In iteration mode, there can be multiple ask and response pairs.
        self.llm_responses = []
        self.llm = FeedbackLLM("", 0)

    def add_llm_response(self, user_ask: str, response: str) -> None:
        """Add a LLM response to the metadata."""
        llm_response = FeedbackLLMResponse(user_ask, response)
        self.llm_responses.append(llm_response)

    def update_llm(self, llm: LLM) -> None:
        """Update the LLM information in the metadata."""
        self.llm.update_from_llm(llm)

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {
            "llm_responses": [resp.to_dict() for resp in self.llm_responses],
            "llm": self.llm.to_dict(),
        }


class UserFeedback(FeedbackInfoBase):
    """Class to store user rate and comment to the AI response."""

    def __init__(self, is_positive: bool, comment: Optional[str]):
        self.is_positive = is_positive
        self.comment = comment

    @property
    def rating_text(self) -> str:
        """Return human-readable rating text."""
        return "useful" if self.is_positive else "not useful"

    @property
    def rating_emoji(self) -> str:
        """Return emoji representation of the rating."""
        return "👍" if self.is_positive else "👎"

    def __str__(self) -> str:
        """Return string representation of the feedback."""
        if self.comment:
            return f"Rating: {self.rating_text}. Comment: {self.comment}"
        else:
            return f"Rating: {self.rating_text}. No additional comment."

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {
            "is_positive": self.is_positive,
            "comment": self.comment,
        }


class Feedback(FeedbackInfoBase):
    """Class to store overall feedback data used to evaluate the AI response."""

    def __init__(self):
        self.metadata = FeedbackMetadata()
        self.user_feedback: Optional[UserFeedback] = None

    def set_user_feedback(self, user_feedback: UserFeedback) -> None:
        """Set the user feedback."""
        self.user_feedback = user_feedback

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {
            "metadata": self.metadata.to_dict(),
            "user_feedback": self.user_feedback.to_dict()
            if self.user_feedback
            else None,
        }


FeedbackCallback = Callable[[Feedback], None]


def feedback_callback_example(feedback: Feedback) -> None:
    """
    Example implementation of a feedback callback function.

    This function demonstrates how to process feedback data using to_dict() methods
    and could be used for:
    - Logging feedback to files or databases
    - Sending feedback to analytics services
    - Training data collection
    - User satisfaction monitoring

    Args:
        feedback: Feedback object containing user feedback and metadata
    """
    print("\n=== Feedback Received ===")

    # Convert entire feedback to dict first - this is the main data structure
    feedback_dict = feedback.to_dict()
    print(f"Complete feedback dictionary keys: {list(feedback_dict.keys())}")

    # How to check user feedback using to_dict()
    print("\n1. Checking User Feedback:")
    user_feedback_dict = (
        feedback.user_feedback.to_dict() if feedback.user_feedback else None
    )
    if user_feedback_dict:
        print(f"   User feedback dict: {user_feedback_dict}")
        print(f"   Is positive: {user_feedback_dict['is_positive']}")
        print(f"   Comment: {user_feedback_dict['comment'] or 'None'}")
        # You can also access properties through the object:
        print(f"   Rating emoji: {feedback.user_feedback.rating_emoji}")  # type: ignore
        print(f"   Rating text: {feedback.user_feedback.rating_text}")  # type: ignore
    else:
        print("   No user feedback provided (user_feedback is None)")

    # How to check LLM information using to_dict()
    print("\n2. Checking LLM Information:")
    metadata_dict = feedback.metadata.to_dict()
    llm_dict = metadata_dict["llm"]
    print(f"   LLM dict: {llm_dict}")
    print(f"   Model: {llm_dict['model']}")
    print(f"   Max context size: {llm_dict['max_context_size']}")

    # How to check ask and response pairs using to_dict()
    print("\n3. Checking Ask and Response History:")
    llm_responses_dict = metadata_dict["llm_responses"]
    print(f"   Number of exchanges: {len(llm_responses_dict)}")

    for i, response_dict in enumerate(llm_responses_dict, 1):
        print(f"   Exchange {i} dict: {list(response_dict.keys())}")
        user_ask = response_dict["user_ask"]
        ai_response = response_dict["response"]
        print(f"     User ask: {user_ask}")
        print(f"     AI response: {ai_response}")

    print("=== End Feedback ===\n")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1924** (2026-04-19): **toolsets_status.json written with type=null on first run, crashes subsequent runs with ValueError: None is not a valid ToolsetType**
  *Symptoms*: ## Summary  On first run with custom toolsets (MCP, custom database/mongodb toolsets), `toolsets_status.json` is written with `\"type\": null` for those entries. Any subsequent invocation of `holmes ask` then crashes immediately before producing any output:  ``` ValueError: None is not a valid ToolsetType ```  ## Versions  - HolmesGPT: 0.24.3 (installed via `pip install holmesgpt==0.24.3`) - Python: 3.10.12 - OS: Ubuntu 22.04  ## Repro steps  1. Configure a custom MCP toolset (e.g. `mcp/mongodb-deep`) and a custom database toolset in `config.yaml` 2. Run `holmes ask "..."` — succeeds, writes `~/.holmes/toolsets_status.json` with `"type": null` for custom entries 3. Run `holmes ask "..."` again — crashes with `ValueError: None is not a valid ToolsetType`  ## Root cause hypothesis  When `toolsets_status.json` is first written, custom toolsets whose Python-side `ToolsetType` enum wasn't registered in the serializer emit `null` instead of the string value. The deserialization on the next run then tries to construct `ToolsetType(None)` which raises `ValueError`.  ## Affected `toolsets_status.json` sample  ```json [   {"name": "mcp/mongodb-deep", "type": null, "status": "enabled", ...},   {"name": "postgres/zabbix",  "type": null, "status": "enabled", ...} ] ```  ## Workaround we are using in production  We pre-patch the cache file before every `holmes ask` invocation, mapping known names to their correct type strings:  ```python _TOOLSET_TYPE_FIXUPS = {     "postgres/zabbix": "dat
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated issue plan by CodeRabbit --> <details> <summary>🔗 Related PRs</summary>  HolmesGPT/holmesgpt#556 - MCP toolset validation fixes [merged] HolmesGPT/holmesgpt#1121 - mcp exception fix [merged] HolmesGPT/holmesgpt#1501 - fix(mcp): Support nullable types in ToolParameter validation [merged] HolmesGPT/holmesgpt#1546 - Fix ToolsetDBModel crash from model_dump unpacking all Toolset fields [merged] HolmesGPT/holmesgpt#1731 - Add MongoDB toolset for querying and diagnostics [merged] </details>  --- <details> <summary>📝 Issue Planner</summary>  <sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>  - [ ] <!-- {"checkboxId": "8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan </details>   --- <details> <summary> 🧪 Issue enrichment is currently in open beta.</summary>   You can configure auto-planning by selecting labels in the issue_enrichment
  > Hi @apollion69  Thanks for reporting we are on it.
  > Hi @apollion69  We merged fix for it yesterday and release new version can you please confirm the issue was resolved?

- **Issue #1108** (2025-11-10): **Docs mention SSE streaming endpoints but they don't exist**
  *Symptoms*: ### What happened?  Only the investigate endpoint is available.  Is there any plan to add it in the future?  <img width="606" height="448" alt="Image" src="https://github.com/user-attachments/assets/5fbdcdd0-17df-4e8f-8d41-6d61bf0787f2" />  <img width="754" height="48" alt="Image" src="https://github.com/user-attachments/assets/3d3c5237-8baa-4f6c-b2f4-6a278ae08d29" />  <img width="939" height="536" alt="Image" src="https://github.com/user-attachments/assets/d1902452-3eaa-471c-8d65-b411f27db697" />  ### What did you expect to happen?  Chat endpoint will be available through SSE protocol to stream response tokens live and not when the response is finished  ### How can we reproduce it (as minimally and precisely as possible)?  try to access any /api/stream/chat endpoint (not existing in the code as well)  ### Anything else we need to know?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @Danielkiss9, Thanks for the report.  Looks like indeed our docs aren't updated. To support streaming on the chat endpoint (e.g. /api/chat) you can pass in the body `stream = true` and it will stream events.  Can you please check it out and let me know if it worked for you?  We will make sure to update the docs accordingly.
  > Works, @moshemorad. Thanks!

- **Issue #721** (2025-07-29): **TextArea in /show command crashes when Escape and q are clicked simultaneously**
  *Symptoms*: ### What happened?  In the /show command text area, hitting escape exits the text area with a delay. There is no indication of the click being recognized, so if a user quickly hits "q" to exit, Holmes exits with an error.   <img width="1465" height="385" alt="Image" src="https://github.com/user-attachments/assets/30408b3b-e0de-407f-92d6-2a72fb516b47" />  https://github.com/user-attachments/assets/ce123de0-d41c-4558-ba3a-caf36caf281d  ### What did you expect to happen?  Holmes to exit the text area  ### How can we reproduce it (as minimally and precisely as possible)?  Run /show command for a tool call. Click "escape" and then hit "q"  ### Anything else we need to know?  _No response_

- **Issue #668** (2025-07-23): **Docs workflow breaks if a new plugin is added**
  *Symptoms*: ### What happened?  Because `pip install mkdocs-material` is used in the workflow, adding a new plugin to Mkdocs without updating the workflow fails it <img width="1523" height="367" alt="Image" src="https://github.com/user-attachments/assets/812f1593-4e98-4922-83e2-0a0eb9727460" />  ### What did you expect to happen?  Workflow to run and deploy docs  ### How can we reproduce it (as minimally and precisely as possible)?  Add a new Mkdocs plugin and try to deploy it  ### Anything else we need to know?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed with #686 

- **Issue #664** (2025-07-21): **Holmes crashes with KeyError in Internet toolset when URL parameter is missing**
  *Symptoms*: ### What happened?  Sometimes FetchWebpage tool in the internet toolset crashes with a KeyError when the get_parameterized_one_liner method is called with parameters that don't contain the expected "url" key.    ``` Analyzing issue 1/15: TargetDown... No section received from the client. Default sections will be used.                                     Structured output is disabled for this request                                                          No runbooks found for this issue. Using default behaviour. (Add runbooks to guide the investigation.) Tool call to fetch_webpage failed with an Exception                                                     Traceback (most recent call last):                                                                        File "/Users/pavan/Documents/repos/holmesgpt/holmes/core/tool_calling_llm.py", line 415, in           _invoke_tool                                                                                                tool_response = tool.invoke(tool_params, tool_number=tool_number)                                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                                     File "/Users/pavan/Documents/repos/holmesgpt/holmes/core/tools.py", line 147, in invoke                   f"Running tool {tool_number_str}{self.name}: {self.get_parameterized_one_liner(params)}"                                                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   

- **Issue #559** (2025-07-12): **CLI tool output is being printed without a newline**
  *Symptoms*: ### What happened?  When I ran the HolmesGPT ask command, the new line character is being interpreted as a string and printed as is.  ![Image](https://github.com/user-attachments/assets/2d92b709-e88c-42cc-870c-fec275fb59ac)  ### What did you expect to happen?  Output should be printed in a new line  ### How can we reproduce it (as minimally and precisely as possible)?  Run a Holmes ask command like so ``` poetry run python3 holmes_cli.py ask "why is the payment application failing?" ```  ### Anything else we need to know?  _No response_
  **Post-Mortem & Fix Analysis**:
  > @pavangudiwada we changed the output format a little - is this still relevant?
  > No it's not! I tested it and the output looks great  <img width="2360" height="604" alt="Image" src="https://github.com/user-attachments/assets/c9ffcd95-31d4-45a7-99b8-ad91af6c9d2f" />  With /toggle-output <img width="2542" height="1646" alt="Image" src="https://github.com/user-attachments/assets/e01fb00a-a6f4-4f26-a094-da32a4e6a308" />

- **Issue #461** (2025-05-29): **Build's failing due to pre-commit hooks running on SVG files**
  *Symptoms*: ### What happened?  Builds with new SVG files are failing because of `end-of-file-fixer` running on SVG files.   ![Image](https://github.com/user-attachments/assets/f48d53c0-e333-4a65-9d29-37e0fafd6b10)  ### What did you expect to happen?  The builds/pre-commit hooks to not modify SVG files  ### How can we reproduce it (as minimally and precisely as possible)?  Add an SVG file and run pre-commit hooks  ### Anything else we need to know?  _No response_

- **Issue #448** (2025-05-28): **HolmesGPT installs alpha version when using Homebrew**
  *Symptoms*: ### What happened?  When I installed HolmesGPT using Brew, it installed an alpha version. I was expecting the most recent stable release to be installed.   ![Image](https://github.com/user-attachments/assets/a4159268-7c46-4da4-8939-88692ad0497d)  ### What did you expect to happen?  Install the latest stable release of HolmesGPT  ### How can we reproduce it (as minimally and precisely as possible)?  Follow the Holmes Homebrew instructions  ### Anything else we need to know?  _No response_

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

### Incident Patch 1: `2e3742d5` (2026-09-30)
**Commit Message**: docs: one deployment tab shape on the Kubernetes built-in and general data source pages (#2515)

**Base:** HolmesGPT/holmesgpt#2510. Merge this one after it; its diff
against master includes that PR's commits until it lands.

On the ArgoCD, bash, Cilium, Crossplane, Helm, Inspektor Gadget,
kubectl-run and Kubernetes pages, and on the HTTP connector, custom
toolset, header propagation and tool execution safety pages, most
deployment tab groups had a Robusta Helm Chart tab and no Holmes Helm
Chart tab, so their Kubernetes settings (chart RBAC rules, the bash
`extended` allowlist, the custom image) existed only in the Robusta
chart form. Where a Holmes tab existed, it used its own captions and
upgrade commands. This PR puts every deployment tab group on these pages
in the standard shape the model provider pages (#2508) and the fences
(#2510) use: a secret step when the values read one, a values step, the
upgrade command, fixed captions, and a Robusta tab that is the Holmes
Helm values nested under `holmes:`. Output changes on purpose.

Each commit converts one page.

## Where to look hardest

- **Secrets.** Every variable a group's toolset reads from the
environment is now a key of on

**File**: `docs/data-sources/api-toolsets.md` (modified, +71/-11)
```diff
@@ -171,22 +171,76 @@ This example shows how to use an HTTP connector with Atlassian Confluence to sea
     holmes ask "search Confluence for runbooks about database issues" --custom-toolsets=toolsets.yaml
     ```
 
+=== "Holmes Helm Chart"
+
+    Create a Kubernetes secret in the namespace Holmes runs in:
+
+    ```bash
+    kubectl create secret generic holmes-api-toolsets \
+      --from-literal=CONFLUENCE_USER="your-email@example.com" \
+      --from-literal=CONFLUENCE_API_KEY="your-api-token" \
+      --from-literal=CONFLUENCE_BASE_URL="https://yourcompany.atlassian.net" \
+      -n <namespace>
+    ```
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    extraEnvVarsSecrets:
+      - holmes-api-toolsets
+
+    toolsets:
+      confluence-api:
+        type: http
+        enabled: true
+        config:
+          endpoints:
+            - hosts:
+                - "*.atlassian.net"
+              paths: ["*"]
+              methods: ["GET", "PUT", "POST", "DELETE"]
+              auth:
+                type: basic
+                username: "{{ env.CONFLUENCE_USER }}"
+                password: "{{ env.CONFLUENCE_API_KEY }}"
+          verify_ssl: true
+          timeout_seconds: 30
+        llm_instructions: |
+          ### Confluence REST API
+          You can query Confluence using the REST API.
+          The base URL is: {{ env.CONFLUENCE_BASE_URL }}
+          Common endpoints:
+          - GET /wiki/rest/api/content/search?cql={query} - Search using CQL
+          - GET /wiki/rest/api/content/{contentId}?expand=ancestors - Get page with ancestor hierarchy
+
+          To get parent page information, use the expand parameter: `?expand=ancestors`
+          The ancestors array will contain the parent page details.
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
-    **Helm Values:**
+    Create a Kubernetes secret in the namespace Holmes runs in:
+
+    ```bash
+    kubectl create secret generic holmes-api-toolsets \
+      --from-literal=CONFLUENCE_USER="your-email@example.com" \
+      --from-literal=CONFLUENCE_API_KEY="your-api-token" \
+      --from-literal=CONFLUENCE_BASE_URL="https://yourcompany.atlassian.net" \
+      -n <namespace>
+    ```
+
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
 
     ```yaml
     holmes:
-      additionalEnvVars:
-        - name: CONFLUENCE_BASE_URL
-          value: https://yourcompany.atlassian.net
-        - name: CONFLUENCE_USER
-          value: your-email@example.com
-        - name: CONFLUENCE_API_KEY
-          valueFrom:
-            secretKeyRef:
-              name: confluence-credentials
-              key: api-key
+      extraEnvVarsSecrets:
+        - holmes-api-toolsets
 
       toolsets:
         confluence-api:
@@ -216,6 +270,12 @@ This example shows how to use an HTTP connector with Atlassian Confluence to sea
             The ancestors array will contain the parent page details.
     ```
 
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
+
 ## Tool Naming
 
 When you create an HTTP connector with name `my_api`, HolmesGPT automatically creates a tool named `my_api_request` that the LLM can call.
```

**File**: `docs/data-sources/builtin-toolsets/argocd.md` (modified, +103/-29)
```diff
@@ -43,18 +43,18 @@ In addition to setting permissions and generating an auth token, you will need t
 
 This is the recommended approach if your ArgoCD is inside your Kubernetes cluster.
 
-HolmesGPT needs permission to establish a port-forward to ArgoCD. The configuration below includes that authorization.
+In Kubernetes, HolmesGPT needs permission to establish a port-forward to ArgoCD. The configuration below includes that authorization.
 
 === "Holmes CLI"
 
-    Set the following environment variables:
+    Set the environment variables:
 
     ```bash
     export ARGOCD_AUTH_TOKEN="<your-argocd-token>"
     export ARGOCD_OPTS="--port-forward --port-forward-namespace <your_argocd_namespace> --server <your_server_address> --grpc-web"
     ```
 
-    Then add the following to **~/.holmes/config.yaml**:
+    Add the following to **~/.holmes/config.yaml**. Create the file if it doesn't exist:
 
     ```yaml
     toolsets:
@@ -64,22 +64,63 @@ HolmesGPT needs permission to establish a port-forward to ArgoCD. The configurat
 
     --8<-- "snippets/toolset_refresh_warning.md"
 
+=== "Holmes Helm Chart"
+
+    Create a Kubernetes secret in the namespace Holmes runs in:
+
+    ```bash
+    kubectl create secret generic holmes-argocd \
+      --from-literal=ARGOCD_AUTH_TOKEN="<your-argocd-token>" \
+      --from-literal=ARGOCD_OPTS="--port-forward --port-forward-namespace <your_argocd_namespace> --server <your_server_address> --grpc-web" \
+      -n <namespace>
+    ```
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    extraEnvVarsSecrets:
+      - holmes-argocd
+
+    customClusterRoleRules:
+        - apiGroups: [""]
+          resources: ["pods/portforward"]
+          verbs: ["create"]
+    toolsets:
+        argocd/core:
+            enabled: true
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    Create a Kubernetes secret in the namespace Holmes runs in:
+
+    ```bash
+    kubectl create secret generic holmes-argocd \
+      --from-literal=ARGOCD_AUTH_TOKEN="<your-argocd-token>" \
+      --from-literal=ARGOCD_OPTS="--port-forward --port-forward-namespace <your_argocd_namespace> --server <your_server_address> --grpc-web" \
+      -n <namespace>
+    ```
+
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
     ```yaml
     holmes:
-        customClusterRoleRules:
-            - apiGroups: [""]
-              resources: ["pods/portforward"]
-              verbs: ["create"]
-        additionalEnvVars:
-            - name: ARGOCD_AUTH_TOKEN
-              value: "<your-argocd-token>"
-            - name: ARGOCD_OPTS
-              value: "--port-forward --port-forward-namespace <your_argocd_namespace> --server <your_server_address> --grpc-web"
-        toolsets:
-            argocd/core:
-                enabled: true
+      extraEnvVarsSecrets:
+        - holmes-argocd
+
+      customClusterRoleRules:
+          - apiGroups: [""]
+            resources: ["pods/portforward"]
+            verbs: ["create"]
+      toolsets:
+          argocd/core:
+              enabled: true
     ```
 
     Apply the configuration:
@@ -102,14 +143,14 @@ This is the recommended approach if your ArgoCD is reachable through a public DN
 
 === "Holmes CLI"
 
-    Set the following environment variables:
+    Set the environment variables:
 
     ```bash
     export ARGOCD_AUTH_TOKEN="<your-argocd-token>"
     export ARGOCD_SERVER="argocd.example.com"
     ```
 
-    Then add the following to **~/.holmes/config.yaml**:
+    Add the following to **~/.holmes/config.yaml**. Create the file if it doesn't exist:
 
     ```yaml
     toolsets:
@@ -125,18 +166,55 @@ This is the recommended approach if your ArgoCD is reachable through a public DN
     holmes ask "Which ArgoCD applications are failing and why?"
     ```
 
+=== "Holmes Helm Chart"
+
+    Create a Kubernetes secret in the namespace Holmes runs in:
+
+    ```bash
+    kubectl create secret generic holmes-argocd-server-url \
+      --from-literal=ARGOCD_AUTH_TOKEN="<your-argocd-token>" \
+      --from-literal=ARGOCD_SERVER="argocd.example.com" \
+      -n <namespace>
+    ```
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    extraEnvVarsSecrets:
+      - holmes-argocd-server-url
+
+    toolsets:
+        argocd/core:
+            enabled: true
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    Create a Kubernetes secret in the namespace Holmes runs in:
+
+    ```bash
+    kubectl create secret generic holmes-argocd-server-url \
+      --from-literal=ARGOCD_AUTH_TOKEN="<your-argocd-token>" \
+      --from-literal=ARGOCD_SERVER="argocd.example.com" \
+      -n <namespace>
+    ```
+
+    When using the **Robusta Hel
```

**File**: `docs/data-sources/builtin-toolsets/bash.md` (modified, +33/-1)
```diff
@@ -7,6 +7,8 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
 
 ## Configuration
 
+In Kubernetes, `extended` is recommended, since Holmes runs in a container with a minimal filesystem.
+
 === "Holmes CLI"
 
     Add the following to **~/.holmes/config.yaml**. Create the file if it doesn't exist:
@@ -35,8 +37,34 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
     | `--bash-always-deny` | Automatically deny commands not in the allow list |
     | `--bash-always-allow` | Automatically approve all commands (use with caution) |
 
+=== "Holmes Helm Chart"
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    toolsets:
+      bash:
+        enabled: true
+        config:
+          builtin_allowlist: "extended"
+          # allow:
+          #   - "helm list"
+          #   - "kubectl rollout history"
+          #   - "curl https://prometheus.monitoring.svc:9090/api/v1"
+          deny:
+            - "kubectl get secret"
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
     ```yaml
     holmes:
       toolsets:
@@ -52,7 +80,11 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
               - "kubectl get secret"
     ```
 
-    `extended` is recommended for Helm deployments where Holmes runs in a container with a minimal filesystem.
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 ## Builtin Allowlist Levels
 
```

**File**: `docs/data-sources/builtin-toolsets/cilium.md` (modified, +20/-0)
```diff
@@ -38,8 +38,28 @@ By enabling this toolset, HolmesGPT will be able to interact with Cilium CNI and
 
     --8<-- "snippets/toolset_refresh_warning.md"
 
+=== "Holmes Helm Chart"
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    toolsets:
+      cilium/core:
+        enabled: true
+      hubble/observability:
+        enabled: true
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
     ```yaml
     holmes:
       toolsets:
```

**File**: `docs/data-sources/builtin-toolsets/crossplane.md` (modified, +36/-11)
```diff
@@ -27,7 +27,7 @@ HolmesGPT needs read access to Crossplane CRDs. If you use Kubernetes RBAC, ensu
 
 === "Holmes CLI"
 
-    Add the following to **~/.holmes/config.yaml**:
+    Add the following to **~/.holmes/config.yaml**. Create the file if it doesn't exist:
 
     ```yaml
     toolsets:
@@ -43,20 +43,45 @@ HolmesGPT needs read access to Crossplane CRDs. If you use Kubernetes RBAC, ensu
     holmes ask "Which Crossplane managed resources are failing and why?"
     ```
 
+=== "Holmes Helm Chart"
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    customClusterRoleRules:
+        - apiGroups: ["pkg.crossplane.io"]
+          resources: ["providers", "providerrevisions"]
+          verbs: ["get", "list"]
+        - apiGroups: ["apiextensions.crossplane.io"]
+          resources: ["compositeresourcedefinitions", "compositions"]
+          verbs: ["get", "list"]
+    toolsets:
+        crossplane/core:
+            enabled: true
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
     ```yaml
     holmes:
-        customClusterRoleRules:
-            - apiGroups: ["pkg.crossplane.io"]
-              resources: ["providers", "providerrevisions"]
-              verbs: ["get", "list"]
-            - apiGroups: ["apiextensions.crossplane.io"]
-              resources: ["compositeresourcedefinitions", "compositions"]
-              verbs: ["get", "list"]
-        toolsets:
-            crossplane/core:
-                enabled: true
+      customClusterRoleRules:
+          - apiGroups: ["pkg.crossplane.io"]
+            resources: ["providers", "providerrevisions"]
+            verbs: ["get", "list"]
+          - apiGroups: ["apiextensions.crossplane.io"]
+            resources: ["compositeresourcedefinitions", "compositions"]
+            verbs: ["get", "list"]
+      toolsets:
+          crossplane/core:
+              enabled: true
     ```
 
     Apply the configuration:
```

**File**: `docs/data-sources/builtin-toolsets/helm.md` (modified, +53/-19)
```diff
@@ -18,29 +18,63 @@ By enabling this toolset, HolmesGPT will be able to provide read access to a clu
 
     --8<-- "snippets/toolset_refresh_warning.md"
 
+=== "Holmes Helm Chart"
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    toolsets:
+        helm/core:
+            enabled: true
+    customClusterRoleRules:
+        - apiGroups: [""]
+          resources: ["secrets", "pods", "services", "configmaps", "persistentvolumeclaims"]
+          verbs: ["get", "list", "watch"]
+        - apiGroups: [""]
+          resources: ["namespaces"]
+          verbs: ["get"]
+        - apiGroups: ["apps"]
+          resources: ["deployments", "statefulsets", "daemonsets"]
+          verbs: ["get", "list", "watch"]
+        - apiGroups: ["batch"]
+          resources: ["jobs", "cronjobs"]
+          verbs: ["get", "list", "watch"]
+        - apiGroups: ["networking.k8s.io"]
+          resources: ["ingresses"]
+          verbs: ["get", "list", "watch"]
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
     ```yaml
     holmes:
-        toolsets:
-            helm/core:
-                enabled: true
-        customClusterRoleRules:
-            - apiGroups: [""]
-              resources: ["secrets", "pods", "services", "configmaps", "persistentvolumeclaims"]
-              verbs: ["get", "list", "watch"]
-            - apiGroups: [""]
-              resources: ["namespaces"]
-              verbs: ["get"]
-            - apiGroups: ["apps"]
-              resources: ["deployments", "statefulsets", "daemonsets"]
-              verbs: ["get", "list", "watch"]
-            - apiGroups: ["batch"]
-              resources: ["jobs", "cronjobs"]
-              verbs: ["get", "list", "watch"]
-            - apiGroups: ["networking.k8s.io"]
-              resources: ["ingresses"]
-              verbs: ["get", "list", "watch"]
+      toolsets:
+          helm/core:
+              enabled: true
+      customClusterRoleRules:
+          - apiGroups: [""]
+            resources: ["secrets", "pods", "services", "configmaps", "persistentvolumeclaims"]
+            verbs: ["get", "list", "watch"]
+          - apiGroups: [""]
+            resources: ["namespaces"]
+            verbs: ["get"]
+          - apiGroups: ["apps"]
+            resources: ["deployments", "statefulsets", "daemonsets"]
+            verbs: ["get", "list", "watch"]
+          - apiGroups: ["batch"]
+            resources: ["jobs", "cronjobs"]
+            verbs: ["get", "list", "watch"]
+          - apiGroups: ["networking.k8s.io"]
+            resources: ["ingresses"]
+            verbs: ["get", "list", "watch"]
     ```
 
     Apply the configuration:
```

**File**: `docs/data-sources/builtin-toolsets/inspektor-gadget.md` (modified, +24/-2)
```diff
@@ -25,10 +25,11 @@ By enabling this toolset, HolmesGPT will be able to use [Inspektor Gadget](https
 
     --8<-- "snippets/toolset_refresh_warning.md"
 
-=== "Robusta Helm Chart"
+=== "Holmes Helm Chart"
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
 
     ```yaml
-    # values.yaml
     customClusterRoleRules:
       - apiGroups: [""]
         resources: ["pods", "pods/attach"]
@@ -40,6 +41,27 @@ By enabling this toolset, HolmesGPT will be able to use [Inspektor Gadget](https
 
     Apply the configuration:
 
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
+=== "Robusta Helm Chart"
+
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
+    ```yaml
+    holmes:
+      customClusterRoleRules:
+        - apiGroups: [""]
+          resources: ["pods", "pods/attach"]
+          verbs: ["create"]
+      additionalEnvVars:
+        - name: ENABLE_INSPEKTOR_GADGET
+          value: "true"
+    ```
+
+    Apply the configuration:
+
     ```bash
     helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
     ```
```

**File**: `docs/data-sources/builtin-toolsets/kubectl-run.md` (modified, +33/-0)
```diff
@@ -27,8 +27,35 @@ The kubectl-run toolset allows Holmes to run commands in temporary Kubernetes po
                 - "curl .*"
     ```
 
+=== "Holmes Helm Chart"
+
+    When using the **standalone Holmes Helm Chart**, update your `values.yaml`:
+
+    ```yaml
+    toolsets:
+      kubectl-run:
+        enabled: true
+        config:
+          allowed_images:
+            - image: "busybox:1.36"
+              allowed_commands:
+                - "nslookup .*"
+                - "ping -c 3 .*"
+            - image: "curlimages/curl:8.8.0"
+              allowed_commands:
+                - "curl .*"
+    ```
+
+    Apply the configuration:
+
+    ```bash
+    helm upgrade holmes robusta/holmes -f values.yaml
+    ```
+
 === "Robusta Helm Chart"
 
+    When using the **Robusta Helm Chart** (which includes HolmesGPT), update your `generated_values.yaml`:
+
     ```yaml
     holmes:
       toolsets:
@@ -45,6 +72,12 @@ The kubectl-run toolset allows Holmes to run commands in temporary Kubernetes po
                   - "curl .*"
     ```
 
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
+
 ## Security
 
 For security, you must explicitly whitelist:
```

---

### Incident Patch 2: `ac719893` (2026-09-30)
**Commit Message**: docs: render the deployment and multi-instance fences as markdown, and drop the shared upgrade snippet (#2510)

**Base:** the https://github.com/HolmesGPT/holmesgpt/pull/2507
docs-fixes PR. Merge this one after it; its diff against master includes
that PR's commits until it lands.

The data source and model provider pages set up each integration in
deployment tabs (Holmes CLI, Holmes Helm Chart, Robusta Helm Chart).
Some of those tab groups are hand-written and some come from the
`yaml-toolset-config` and `yaml-helm-values` fences, and the two kinds
did not look alike. The fences built their own HTML, with random tab ids
and no syntax highlighting; `yaml-toolset-config` rendered a CLI tab and
both rendered upgrade steps, but they had no secret step, no CLI
exports, no refresh warning, and an upgrade command in the `--values=`
form where the standard uses `-f`. This PR gives the fences the
deployment tab standard's shape and the same rendering path as
hand-written tabs, so later PRs can move every page to that standard.

How the commits fit:

1. **The fences expand to markdown.** A preprocessor in
`docs/custom_fences.py` replaces each fence with the markdown a page
author would writ

**File**: `docs/custom_fences.py` (modified, +351/-199)
```diff
@@ -1,19 +1,66 @@
 """
-Custom fence processors for MkDocs documentation.
+Custom fences for the MkDocs documentation.
 
-Fences available:
-- yaml-toolset-config: Creates 3 tabs (Holmes CLI, Holmes Helm Chart, Robusta Helm Chart) for toolset configurations
-- yaml-helm-values: Creates 2 tabs (Holmes Helm Chart, Robusta Helm Chart) for Helm-only configurations like permissions
+- yaml-toolset-config: a Holmes config body, `toolsets:` and its content. Holmes CLI, Holmes Helm
+  Chart and Robusta Helm Chart tabs. The CLI tab shows the body for ~/.holmes/config.yaml.
 - robusta-region: Creates 3 tabs (US, EU, AP) for any text containing api.robusta.dev, platform.robusta.dev, or
   sp.robusta.dev. Plain URLs render as code blocks; markdown links `[text](url)` render as clickable links.
+- multi-instance: the standard "Multiple Instances" section for a toolset. The body is YAML with
+  `toolset` (the toolset's config key), `name` (its display name) and `config` (a single-instance
+  config example, a block scalar). It links to the Multiple Instances page with a path relative to
+  the page.
+
+robusta-region is a superfences custom fence, registered in mkdocs.yml. The other two expand into
+markdown before any other fence or tab is rendered, so each renders exactly as the same markdown
+written by hand, tab ids included. Each renders from its own body and options and the page's path,
+and reads nothing else on the page.
+
+Supported forms. Write the fence at the start of a line, opened by three backticks and the fence
+name, and closed by the first line of three backticks:
+
+    ```yaml-toolset-config
+    ```yaml-toolset-config {reuse}
+    ```yaml-toolset-config {secret-qualifier=<name>}
+    ```multi-instance
+
+The body of a `yaml-toolset-config` fence is a block mapping whose first key starts at the first
+column, with `toolsets` as its only key. A `multi-instance` body has `toolset`, `name` and `config`.
+Any other form of these two fences fails the build with a message naming the page and the line, and so does a page
+whose rendered HTML shows a fence's markdown instead of its tabs (`on_post_page`).
+
+Each Helm tab of a `yaml-toolset-config` fence shows the values (under `holmes:` in the Robusta tab) and
+the chart's upgrade command.
+
+Secrets. Every `{{ env.X }}` in the body is a key of the group's Kubernetes secret, in the order the
+body first references them. The secret is `holmes-<page file stem>`. The Helm tabs create it with
+`kubectl create secret generic`, one `--from-literal=X=your-x` per key, and list it under
+`extraEnvVarsSecrets`, which mounts each key as an env var; the CLI tab exports the same variables.
+
+`{secret-qualifier=<name>}` names the group's secret `holmes-<stem>-<name>`, for a group on the same
+page that needs a secret with other keys. `<name>` is lowercase letters and digits, joined by `-`.
+
+`{reuse}` is for a group whose secret an earlier group on the page creates: its Helm tabs have no
+secret step, its values still list the secret, and its CLI tab still exports the keys. The note
+naming the section that creates the secret is written by hand above the fence:
+
+    In Kubernetes, this reuses the `<secret>` secret created in the [<section>](#<anchor>) section above.
+
+The page hook. Secrets are named after the page, and the multi-instance link is relative to it; the
+page reaches the extension through this module's `on_page_markdown` MkDocs hook, so mkdocs.yml lists
+this file under `hooks:`. An MkDocs config that sets its own `hooks:`, including one that INHERITs
+mkdocs.yml (the child's list replaces the parent's), must list this file too, or every fence fails
+the build.
 """
 
 import html
+import posixpath
 import re
 import uuid
+from pathlib import PurePosixPath
 
 import yaml  # type: ignore
-from pymdownx.superfences import SuperFencesException
+from markdown.extensions import Extension
+from markdown.preprocessors import Preprocessor
 
 ROBUSTA_REGIONS = (("US", ""), ("EU", "eu"), ("AP", "ap"))
 ROBUSTA_DOMAIN_RE = re.compile(r"\b(api|platform|sp)\.robusta\.dev\b")
@@ -27,118 +74,6 @@ def _rewrite_robusta_domain(text: str, region_infix: str) -> str:
     return ROBUSTA_DOMAIN_RE.sub(rf"\1.{region_infix}.robusta.dev", text)
 
 
-def toolset_config_fence_format(source, language, css_class, options, md, **kwargs):
-    """
-    Format YAML content into Holmes CLI, Holmes Helm Chart, and Robusta Helm Chart tabs for toolset configuration.
-    This fence does NOT process Jinja2, so {{ env.VAR }} stays as-is.
-    """
-    # Generate unique IDs for this tab group to prevent conflicts
-    tab_group_id = str(uuid.uuid4()).replace("-", "_")
-    tab_id_1 = f"__tabbed_{tab_group_id}_1"
-    tab_id_2 = f"__tabbed_{tab_group_id}_2"
-    tab_id_3 = f"__tabbed_{tab_group_id}_3"
-    group_name = f"__tabbed_{tab_group_id}"
-
-    # Escape HTML in the source to prevent XSS
-    escaped_source = html.escape(source)
-
-    # Strip any leading/trailing whitespace
-    yaml_co
```

**File**: `docs/data-sources/builtin-toolsets/aks.md` (modified, +5/-1)
```diff
@@ -49,7 +49,11 @@ By enabling this toolset, HolmesGPT will be able to interact with Azure Kubernet
             cluster_name: "<your AKS cluster name>"
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 ## Advanced Configuration
 
```

**File**: `docs/data-sources/builtin-toolsets/argocd.md` (modified, +10/-2)
```diff
@@ -82,7 +82,11 @@ HolmesGPT needs permission to establish a port-forward to ArgoCD. The configurat
                 enabled: true
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 !!! note
 
@@ -135,7 +139,11 @@ This is the recommended approach if your ArgoCD is reachable through a public DN
                 enabled: true
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 !!! note
 
```

**File**: `docs/data-sources/builtin-toolsets/cilium.md` (modified, +5/-1)
```diff
@@ -49,7 +49,11 @@ By enabling this toolset, HolmesGPT will be able to interact with Cilium CNI and
           enabled: true
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 ## Advanced Configuration
 
```

**File**: `docs/data-sources/builtin-toolsets/confluence.md` (modified, +15/-3)
```diff
@@ -122,7 +122,11 @@ Go to [Atlassian API Tokens](https://id.atlassian.com/manage/api-tokens){:target
             api_key: "{{ env.CONFLUENCE_API_KEY }}"
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 !!! note "Scoped tokens and service accounts"
     Scoped API tokens and service account tokens on Confluence Cloud require routing through the Atlassian API gateway (`api.atlassian.com`). HolmesGPT auto-detects this and switches to the gateway transparently — no extra configuration needed. If auto-detection doesn't work, you can set `cloud_id` explicitly in raw YAML (find it at `https://yourcompany.atlassian.net/_edge/tenant_info`).
@@ -217,7 +221,11 @@ In Confluence Data Center, go to your **Profile** > **Personal Access Tokens** >
             api_key: "{{ env.CONFLUENCE_PAT }}"
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 ### Confluence Data Center - Basic Auth
 
@@ -312,7 +320,11 @@ HolmesGPT authenticates to a self-hosted Confluence Data Center (or Server) inst
             api_key: "{{ env.CONFLUENCE_PASSWORD }}"
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 ## Multiple Instances
 
```

**File**: `docs/data-sources/builtin-toolsets/coralogix-logs.md` (modified, +5/-1)
```diff
@@ -120,7 +120,11 @@ Holmes automatically derives the UI hostname for permalinks from your `domain` 
             prometheus_url: "https://ng-api-http.eu2.coralogix.com/metrics"
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 **Note**: Both toolsets use the same API key. Helm-tab users only need to create one Kubernetes secret — the env var feeds both the `coralogix` toolset's `api_key` field and the Prometheus toolset's `Authorization` header.
 
```

**File**: `docs/data-sources/builtin-toolsets/crossplane.md` (modified, +5/-1)
```diff
@@ -59,7 +59,11 @@ HolmesGPT needs read access to Crossplane CRDs. If you use Kubernetes RBAC, ensu
                 enabled: true
     ```
 
-    --8<-- "snippets/helm_upgrade_command.md"
+    Apply the configuration:
+
+    ```bash
+    helm upgrade robusta robusta/robusta -f generated_values.yaml --set clusterName=<YOUR_CLUSTER_NAME>
+    ```
 
 ## Common Use Cases
 
```

**File**: `docs/data-sources/builtin-toolsets/datadog.md` (modified, +43/-152)
```diff
@@ -22,154 +22,37 @@ You'll need two keys and your site URL from your Datadog account:
 
 ### 2. Configure HolmesGPT
 
-=== "Holmes CLI"
-
-    Set environment variables:
-    ```bash
-    export DATADOG_API_KEY="your-datadog-api-key"
-    export DATADOG_APP_KEY="your-datadog-app-key"
-    ```
-
-    Add to your config file:
-    ```yaml
-    # anchors: is ignored by Holmes — use it to define reusable YAML blocks
-    anchors:
-      dd_config: &dd_config
-        api_key: "{{ env.DATADOG_API_KEY }}"
-        app_key: "{{ env.DATADOG_APP_KEY }}"
-        api_url: https://api.datadoghq.com  # Change for EU/other regions
-
-    toolsets:
-      datadog/general:
-        enabled: true
-        config: *dd_config
-      datadog/logs:
-        enabled: true
-        config: *dd_config
-      datadog/metrics:
-        enabled: true
-        config: *dd_config
-      datadog/traces:
-        enabled: true
-        config: *dd_config
-    ```
-
-=== "Holmes Helm Chart"
-
-    First, create a Kubernetes secret with your API keys:
-    ```bash
-    kubectl create secret generic holmes-datadog-secrets \
-      --from-literal=datadog-api-key=your-datadog-api-key \
-      --from-literal=datadog-app-key=your-datadog-app-key \
-      -n holmes
-    ```
-
-    --8<-- "snippets/secret_namespace_note.md"
-
-    Then add to your Holmes Helm values:
-    ```yaml
-    # Load API keys from secret
-    additionalEnvVars:
-      - name: DATADOG_API_KEY
-        valueFrom:
-          secretKeyRef:
-            name: holmes-datadog-secrets
-            key: datadog-api-key
-      - name: DATADOG_APP_KEY
-        valueFrom:
-          secretKeyRef:
-            name: holmes-datadog-secrets
-            key: datadog-app-key
-
-    toolsets:
-      # Enable all Datadog toolsets
-      datadog/logs:
-        enabled: true
-        config:
-          api_key: "{{ env.DATADOG_API_KEY }}"
-          app_key: "{{ env.DATADOG_APP_KEY }}"
-          api_url: https://api.datadoghq.com  # Change for EU/other regions
-
-      datadog/metrics:
-        enabled: true
-        config:
-          api_key: "{{ env.DATADOG_API_KEY }}"
-          app_key: "{{ env.DATADOG_APP_KEY }}"
-          api_url: https://api.datadoghq.com
-
-      datadog/traces:
-        enabled: true
-        config:
-          api_key: "{{ env.DATADOG_API_KEY }}"
-          app_key: "{{ env.DATADOG_APP_KEY }}"
-          api_url: https://api.datadoghq.com
-
-      datadog/general:
-        enabled: true
-        config:
-          api_key: "{{ env.DATADOG_API_KEY }}"
-          app_key: "{{ env.DATADOG_APP_KEY }}"
-          api_url: https://api.datadoghq.com
-    ```
-
-=== "Robusta Helm Chart"
-
-    First, create a Kubernetes secret with your API keys:
-    ```bash
-    kubectl create secret generic holmes-datadog-secrets \
-      --from-literal=datadog-api-key=your-datadog-api-key \
-      --from-literal=datadog-app-key=your-datadog-app-key \
-      -n default
-    ```
-
-    --8<-- "snippets/secret_namespace_note.md"
-
-    Then add to your Robusta Helm values:
-    ```yaml
-    holmes:
-      # Load API keys from secret
-      additionalEnvVars:
-        - name: DATADOG_API_KEY
-          valueFrom:
-            secretKeyRef:
-              name: holmes-datadog-secrets
-              key: datadog-api-key
-        - name: DATADOG_APP_KEY
-          valueFrom:
-            secretKeyRef:
-              name: holmes-datadog-secrets
-              key: datadog-app-key
-
-      toolsets:
-        # Enable all Datadog toolsets
-        datadog/logs:
-          enabled: true
-          config:
-            api_key: "{{ env.DATADOG_API_KEY }}"
-            app_key: "{{ env.DATADOG_APP_KEY }}"
-            api_url: https://api.datadoghq.com  # Change for EU/other regions
-
-        datadog/metrics:
-          enabled: true
-          config:
-            api_key: "{{ env.DATADOG_API_KEY }}"
-            app_key: "{{ env.DATADOG_APP_KEY }}"
-            api_url: https://api.datadoghq.com
-
-        datadog/traces:
-          enabled: true
-          config:
-            api_key: "{{ env.DATADOG_API_KEY }}"
-            app_key: "{{ env.DATADOG_APP_KEY }}"
-            api_url: https://api.datadoghq.com
-
-        datadog/general:
-          enabled: true
-          config:
-            api_key: "{{ env.DATADOG_API_KEY }}"
-            app_key: "{{ env.DATADOG_APP_KEY }}"
-            api_url: https://api.datadoghq.com
-    ```
+```yaml-toolset-config
+toolsets:
+  # Enable all Datadog toolsets
+  datadog/logs:
+    enabled: true
+    config:
+      api_key: "{{ env.DATADOG_API_KEY }}"
+      app_key: "{{ env.DATADOG_APP_KEY }}"
+      api_url: https://api.datadoghq.com  # Change for EU/other regions
+
+  datadog/metrics:
+    enabled: true
+    config:
+      api_key: "{{ env.DATADOG_API_KEY }}"
+      app_key: "{{ env.DATADOG_APP_KEY }}"
+      api_url: https://api.datadoghq.com  # Change for EU/other regions
+
+  datadog/traces:
+    enabled: true
+    config:
+      api_key: "{{
```

---

### Incident Patch 3: `264cb8a5` (2026-09-30)
**Commit Message**: docs: fix examples that fail when followed as written (#2507)

Each commit fixes one kind of example that fails or misleads a reader
who follows the page as written:

- Helm values keys the Holmes chart never reads (`config.model`,
`podLabels`, `extraVolumes`, `customToolsets`, `image.repository`);
- configs and custom toolsets the CLI or chart rejects, and YAML that
doesn't parse;
- Helm commands and Kubernetes names that don't match what the chart
installs (chart `robusta/holmes`, `<release>-holmes-service-account`);
- two release names for one install: every Holmes chart command and
example uses the release `holmes`, which the data source pages already
used, where the install guide used `holmesgpt`;
- upgrade and uninstall commands with no word on which release name to
use for an install made under another name;
- a model provider whose Helm tab fails in the chart's read-only pod
(GitHub Copilot's OAuth device flow);
- custom toolset credentials written as `{{ }}` placeholders, which
Holmes asks the LLM to fill in, set by `export` lines that never reach
the pod;
- a secret note that misstates what a missing secret does and which
namespace is the default;
- a custom image built f

**File**: `.github/workflows/docker-dev-images.yaml` (modified, +2/-2)
```diff
@@ -141,7 +141,7 @@ jobs:
                 '',
                 '**HolmesGPT chart:**',
                 '```bash',
-                'helm upgrade --install holmesgpt ./helm/holmes \\\\',
+                'helm upgrade --install holmes ./helm/holmes \\\\',
                 '  --set registry=me-west1-docker.pkg.dev/robusta-development/development \\\\',
                 `  --set image=holmes-dev:${prevSha} \\\\`,
                 '  --set operator.registry=me-west1-docker.pkg.dev/robusta-development/development \\\\',
@@ -328,7 +328,7 @@ jobs:
               '',
               '**HolmesGPT chart:**',
               '```bash',
-              'helm upgrade --install holmesgpt ./helm/holmes \\',
+              'helm upgrade --install holmes ./helm/holmes \\',
               '  --set registry=me-west1-docker.pkg.dev/robusta-development/development \\',
               `  --set image=holmes-dev:${shortSha} \\`,
               '  --set operator.registry=me-west1-docker.pkg.dev/robusta-development/development \\',
```

**File**: `docs/ai-providers/anthropic.md` (modified, +6/-8)
```diff
@@ -41,6 +41,9 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
           secretKeyRef:
             name: holmes-secrets
             key: anthropic-api-key
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "claude-sonnet-4"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -56,10 +59,6 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
         api_key: "{{ env.ANTHROPIC_API_KEY }}"
         model: anthropic/claude-opus-4-1-20250805
         temperature: 1
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -81,6 +80,9 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
             secretKeyRef:
               name: robusta-holmes-secret
               key: anthropic-api-key
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "claude-sonnet-4"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -96,10 +98,6 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
           api_key: "{{ env.ANTHROPIC_API_KEY }}"
           model: anthropic/claude-opus-4-1-20250805
           temperature: 1
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 ## Prompt Caching
```

**File**: `docs/ai-providers/aws-bedrock.md` (modified, +15/-33)
```diff
@@ -60,6 +60,9 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
           secretKeyRef:
             name: holmes-secrets
             key: aws-secret-access-key
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -86,10 +89,6 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
           anthropic-beta: context-1m-2025-08-07
         custom_args:
           max_context_size: 1000000
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -117,6 +116,9 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
             secretKeyRef:
               name: robusta-holmes-secret
               key: aws-secret-access-key
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -143,10 +145,6 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
             anthropic-beta: context-1m-2025-08-07
           custom_args:
             max_context_size: 1000000
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 ### Using Claude Sonnet with 1M Context Window
@@ -198,9 +196,10 @@ If you're running HolmesGPT on Kubernetes with IRSA, you can authenticate withou
           budget_tokens: 10000
           type: enabled
 
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "bedrock-claude-sonnet-4"
+    additionalEnvVars:
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "bedrock-claude-sonnet-4"
     ```
 
 === "Robusta Helm Chart"
@@ -223,9 +222,10 @@ If you're running HolmesGPT on Kubernetes with IRSA, you can authenticate withou
             budget_tokens: 10000
             type: enabled
 
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "bedrock-claude-sonnet-4"
+      additionalEnvVars:
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "bedrock-claude-sonnet-4"
     ```
 
 **Note:** With IRSA, you do not need `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. The AWS SDK picks up the injected token automatically.
@@ -281,25 +281,7 @@ For the CLI:
 export EXTRA_HEADERS="{\"anthropic-beta\": \"context-1m-2025-08-07\"}"
 ```
 
-Or, for Helm:
-
-    # values.yaml
-    holmes:
-      ...
-      modelList:
-        ...
-        bedrock-claude-sonnet-4-1M-context:
-          aws_access_key_id: "{{ env.AWS_ACCESS_KEY_ID }}"
-          aws_secret_access_key: "{{ env.AWS_SECRET_ACCESS_KEY }}"
-          aws_region_name: eu-south-2
-          model: bedrock/eu.anthropic.claude-sonnet-4-20250514-v1:0
-          temperature: 1
-          thinking:
-            budget_tokens: 10000
-            type: enabled
-          extra_headers:
-            anthropic-beta: context-1m-2025-08-07
-
+For the Helm charts, set `extra_headers` on the model's `modelList` entry, as the `bedrock-claude-sonnet-4-1M-context` entry in the Holmes Helm Chart and Robusta Helm Chart tabs above does.
 
 ## Additional Resources
 
```

**File**: `docs/ai-providers/azure-ai-foundry.md` (modified, +17/-20)
```diff
@@ -56,6 +56,9 @@ The examples below lead with the Anthropic option and include a GPT deployment a
           secretKeyRef:
             name: holmes-secrets
             key: azure-api-key
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "azure-opus-4-7"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -72,10 +75,6 @@ The examples below lead with the Anthropic option and include a GPT deployment a
         model: azure/my-gpt-5.4-deployment
         api_base: https://YYYY.cognitiveservices.azure.com/
         api_version: "2025-04-01-preview"
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "azure-opus-4-7"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -97,6 +96,9 @@ The examples below lead with the Anthropic option and include a GPT deployment a
             secretKeyRef:
               name: robusta-holmes-secret
               key: azure-api-key
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "azure-opus-4-7"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -113,10 +115,6 @@ The examples below lead with the Anthropic option and include a GPT deployment a
           model: azure/my-gpt-5.4-deployment
           api_base: https://YYYY.cognitiveservices.azure.com/
           api_version: "2025-04-01-preview"
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "azure-opus-4-7"  # This refers to the key name in modelList above
     ```
 
 ## Using CLI Parameters
@@ -217,7 +215,7 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
 
     - AKS cluster with OIDC issuer and workload identity enabled
     - A managed identity with the **Cognitive Services OpenAI User** role on your Azure AI Foundry resource
-    - A federated credential linking the managed identity to the Holmes ServiceAccount
+    - A federated credential linking the managed identity to the Holmes ServiceAccount, which the chart names `<release>-holmes-service-account` by default (`holmes-holmes-service-account` for the install guide's `holmes` release). If you set `customServiceAccountName`, the credential's subject uses that name; with `createServiceAccount: false`, Holmes runs as the namespace's `default` ServiceAccount
 
     **Set up the identity and federation:**
 
@@ -242,7 +240,7 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
       --identity-name holmes-identity \
       --resource-group <rg> \
       --issuer "$OIDC_ISSUER" \
-      --subject "system:serviceaccount:<namespace>:holmes" \
+      --subject "system:serviceaccount:<namespace>:holmes-holmes-service-account" \
       --audiences "api://AzureADTokenExchange"
     ```
 
@@ -257,12 +255,14 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
         value: "<managed-identity-client-id>"
       - name: AZURE_TENANT_ID
         value: "<tenant-id>"
+      - name: MODEL
+        value: "azure-opus-4-7"
 
     serviceAccount:
       annotations:
         azure.workload.identity/client-id: "<managed-identity-client-id>"
 
-    podLabels:
+    commonLabels:
       azure.workload.identity/use: "true"
 
     modelList:
@@ -277,9 +277,6 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
         model: azure/my-gpt-5.4-deployment
         api_base: https://YYYY.cognitiveservices.azure.com/
         api_version: "2025-04-01-preview"
-
-    config:
-      model: "azure-opus-4-7"
     ```
 
     Note that `api_key` is omitted from the `modelList` entries — authentication is handled entirely by the workload identity token.
@@ -298,12 +295,14 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
           value: "<managed-identity-client-id>"
         - name: AZURE_TENANT_ID
           value: "<tenant-id>"
+        - name: MODEL
+          value: "azure-opus-4-7"
 
       serviceAccount:
         annotations:
           azure.workload.identity/client-id: "<managed-identity-client-id>"
 
-      podLabels:
+      commonLabels:
         azure.workload.identity/use: "true"
 
       modelList:
@@ -318,9 +317,6 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
           model: azure/my-gpt-5.4-deployment
           api_base: https://YYYY.cognitiveservices.azure.com/
           api_version: "2025-04-01-preview"
-
-      config:
-        model: "azure-opus-4-7"
     ```
 
 ### Troubleshooting
@@ -329,8 +325,9 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
 # Verify the pod has workload identity labels and env vars injected
 kubectl describe pod -l app=holmes -n <namespace> | grep -A5 "AZ
```

**File**: `docs/ai-providers/baseten.md` (modified, +4/-6)
```diff
@@ -34,6 +34,8 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
           secretKeyRef:
             name: holmes-secrets
             key: baseten-api-key
+      - name: MODEL
+        value: "glm-5-3"  # modelList key name
 
     modelList:
       glm-5-3:
@@ -45,9 +47,6 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
         output_cost_per_token: 0.000015
         custom_args:
           max_context_size: 1048576
-
-    config:
-      model: "glm-5-3"  # modelList key name
     ```
 
 === "Robusta Helm Chart"
@@ -69,6 +68,8 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
             secretKeyRef:
               name: robusta-holmes-secret
               key: baseten-api-key
+        - name: MODEL
+          value: "glm-5-3"  # modelList key name
 
       modelList:
         glm-5-3:
@@ -80,9 +81,6 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
           output_cost_per_token: 0.000015
           custom_args:
             max_context_size: 1048576
-
-      config:
-        model: "glm-5-3"  # modelList key name
     ```
 
 ## Models missing from LiteLLM
```

**File**: `docs/ai-providers/gemini.md` (modified, +6/-8)
```diff
@@ -40,6 +40,9 @@ Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
             key: gemini-api-key
       - name: TOOL_SCHEMA_NO_PARAM_OBJECT_IF_NO_PARAMS
         value: "true"  # Required for Gemini - see Environment Variables Reference
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "gemini-pro"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -57,10 +60,6 @@ Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
         api_key: "{{ env.GEMINI_API_KEY }}"
         model: gemini/gemini-exp-1206
         temperature: 1
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "gemini-pro"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -84,6 +83,9 @@ Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
               key: gemini-api-key
         - name: TOOL_SCHEMA_NO_PARAM_OBJECT_IF_NO_PARAMS
           value: "true"  # Required for Gemini - see Environment Variables Reference
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "gemini-pro"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -101,10 +103,6 @@ Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
           api_key: "{{ env.GEMINI_API_KEY }}"
           model: gemini/gemini-exp-1206
           temperature: 1
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "gemini-pro"  # This refers to the key name in modelList above
     ```
 
 ## Using CLI Parameters
```

**File**: `docs/ai-providers/github-copilot.md` (modified, +60/-4)
```diff
@@ -50,6 +50,16 @@ Configure them via the `extra_headers` field in your model list configuration, o
 
 === "Holmes Helm Chart"
 
+    Holmes can't complete the device authorization from inside a pod. Authorize once with the Holmes CLI (see the Holmes CLI tab), then give Holmes the token file LiteLLM stored at `~/.config/litellm/github_copilot/access-token`.
+
+    **Create Kubernetes Secret:**
+    ```bash
+    kubectl create secret generic holmes-github-copilot \
+      --from-file=access-token=$HOME/.config/litellm/github_copilot/access-token \
+      -n <namespace>
+    ```
+
+    **Configure Helm Values:**
     ```yaml
     # values.yaml
     modelList:
@@ -61,12 +71,40 @@ Configure them via the `extra_headers` field in your model list configuration, o
           Copilot-Integration-Id: "vscode-chat"
           User-Agent: "GithubCopilot/1.155.0"
 
-    config:
-      model: "copilot-claude"
+    additionalEnvVars:
+      - name: MODEL
+        value: "copilot-claude"
+      - name: GITHUB_COPILOT_ACCESS_TOKEN_FILE
+        value: "/etc/github-copilot/access-token"
+      # LiteLLM writes its short-lived Copilot key here; /tmp is writable in the pod
+      - name: GITHUB_COPILOT_TOKEN_DIR
+        value: "/tmp/github-copilot"
+
+    additionalVolumes:
+      - name: github-copilot-token
+        secret:
+          secretName: holmes-github-copilot
+
+    additionalVolumeMounts:
+      - name: github-copilot-token
+        mountPath: /etc/github-copilot
+        readOnly: true
     ```
 
+    To re-authenticate, delete `~/.config/litellm/github_copilot/access-token` and `~/.config/litellm/github_copilot/api-key.json` (LiteLLM reuses an unexpired key without reading the token), run the Holmes CLI again, then delete the secret with `kubectl delete secret holmes-github-copilot -n <namespace>`, create it again with the command above and restart the Holmes pod.
+
 === "Robusta Helm Chart"
 
+    Holmes can't complete the device authorization from inside a pod. Authorize once with the Holmes CLI (see the Holmes CLI tab), then give Holmes the token file LiteLLM stored at `~/.config/litellm/github_copilot/access-token`.
+
+    **Create Kubernetes Secret:**
+    ```bash
+    kubectl create secret generic holmes-github-copilot \
+      --from-file=access-token=$HOME/.config/litellm/github_copilot/access-token \
+      -n <namespace>
+    ```
+
+    **Configure Helm Values:**
     ```yaml
     # values.yaml
     holmes:
@@ -79,10 +117,28 @@ Configure them via the `extra_headers` field in your model list configuration, o
             Copilot-Integration-Id: "vscode-chat"
             User-Agent: "GithubCopilot/1.155.0"
 
-      config:
-        model: "copilot-claude"
+      additionalEnvVars:
+        - name: MODEL
+          value: "copilot-claude"
+        - name: GITHUB_COPILOT_ACCESS_TOKEN_FILE
+          value: "/etc/github-copilot/access-token"
+        # LiteLLM writes its short-lived Copilot key here; /tmp is writable in the pod
+        - name: GITHUB_COPILOT_TOKEN_DIR
+          value: "/tmp/github-copilot"
+
+      additionalVolumes:
+        - name: github-copilot-token
+          secret:
+            secretName: holmes-github-copilot
+
+      additionalVolumeMounts:
+        - name: github-copilot-token
+          mountPath: /etc/github-copilot
+          readOnly: true
     ```
 
+    To re-authenticate, delete `~/.config/litellm/github_copilot/access-token` and `~/.config/litellm/github_copilot/api-key.json` (LiteLLM reuses an unexpired key without reading the token), run the Holmes CLI again, then delete the secret with `kubectl delete secret holmes-github-copilot -n <namespace>`, create it again with the command above and restart the Holmes pod.
+
 ## Additional Resources
 
 - [LiteLLM GitHub Copilot docs](https://docs.litellm.ai/docs/providers/github_copilot){:target="_blank"}
```

**File**: `docs/ai-providers/github.md` (modified, +4/-6)
```diff
@@ -50,15 +50,14 @@ Browse the full list of available models at [github.com/marketplace/models](http
           secretKeyRef:
             name: holmes-secrets
             key: github-api-key
+      - name: MODEL
+        value: "gpt-4-1"
 
     modelList:
       gpt-4-1:
         api_key: "{{ env.GITHUB_API_KEY }}"
         model: github/gpt-4.1
         temperature: 0
-
-    config:
-      model: "gpt-4-1"
     ```
 
 === "Robusta Helm Chart"
@@ -80,15 +79,14 @@ Browse the full list of available models at [github.com/marketplace/models](http
             secretKeyRef:
               name: robusta-holmes-secret
               key: github-api-key
+        - name: MODEL
+          value: "gpt-4o"
 
       modelList:
         gpt-4o:
           api_key: "{{ env.GITHUB_API_KEY }}"
           model: github/gpt-4o
           temperature: 0
-
-      config:
-        model: "gpt-4o"
     ```
 
 ## Additional Resources
```

---

### Incident Patch 4: `a045ec72` (2026-09-28)
**Commit Message**: Fix pytds certificate validation for pyOpenSSL >= 26.2 (#2505)

## Summary

Fixes a compatibility issue where python-tds fails to validate TLS
certificates when using pyOpenSSL >= 26.2 with cryptography >= 50. The
stock pytds `validate_host` function calls the removed
`X509.get_extension()` method, causing `AttributeError` when the
certificate CN differs from the hostname.

## Changes

- **Added `_pytds_validate_host()` function** in
`holmes/plugins/toolsets/database/database.py`:
- Drop-in replacement for `pytds.tls.validate_host` that uses
cryptography library instead of deprecated pyOpenSSL APIs
  - Validates hostnames against certificate CN and SAN DNS names
- Supports wildcard certificates (first label only, matching pytds
semantics)
  - Case-insensitive matching per RFC standards

- **Patched pytds at module load time**:
- Sets `pytds.tls.validate_host = _pytds_validate_host` so the custom
validator is used during TLS handshakes

- **Added comprehensive test coverage** in
`tests/test_database_toolset.py`:
- Helper function `_make_cert()` to generate test certificates with
various CN/SAN configurations
  - `TestPytdsValidateHost` class with 7 test cases covering:
    - CN matc

**File**: `holmes/plugins/toolsets/database/database.py` (modified, +59/-1)
```diff
@@ -1,15 +1,19 @@
+import ipaddress
 import json
 import logging
 import os
 import re
 from abc import ABC
 from dataclasses import dataclass
 from enum import Enum
-from typing import Any, ClassVar, Dict, List, Optional, Tuple, Type
+from typing import Any, ClassVar, Dict, List, Optional, Tuple, Type, Union
 from urllib.parse import quote, unquote, urlparse
 
 import certifi
+import pytds.tls
 import requests
+from cryptography import x509
+from cryptography.x509.oid import NameOID
 from pydantic import ConfigDict, Field, model_validator
 
 from holmes.core.tools import (
@@ -30,6 +34,60 @@
 
 logger = logging.getLogger(__name__)
 
+
+def _dns_name_matches(pattern: str, host: str) -> bool:
+    pattern = pattern.lower()
+    if pattern == host:
+        return True
+    # Wildcard only as the entire first label, matching exactly one label.
+    if pattern.startswith("*.") and "." in host:
+        return pattern[2:] == host.split(".", 1)[1]
+    return False
+
+
+def _pytds_validate_host(cert, name: bytes) -> bool:
+    """Drop-in for pytds.tls.validate_host that reads the certificate via cryptography.
+
+    python-tds (<= 1.17.1) calls X509.get_extension(), which pyOpenSSL removed in
+    26.2.0; our cryptography>=50 floor (CVE fix) requires pyOpenSSL >= 26.3, so the
+    stock function raises AttributeError whenever the certificate CN differs from
+    the host name. Matching follows RFC 6125: an IP host is checked against IP
+    SANs, a DNS host against DNS SANs, and the CN is consulted only when the
+    certificate has no SAN of the host's type.
+    """
+    host = name.decode("ascii").lower()
+    crypto_cert = cert.to_cryptography()
+
+    try:
+        san = crypto_cert.extensions.get_extension_for_class(
+            x509.SubjectAlternativeName
+        ).value
+        san_dns = san.get_values_for_type(x509.DNSName)
+        san_ips = san.get_values_for_type(x509.IPAddress)
+    except x509.ExtensionNotFound:
+        san_dns, san_ips = [], []
+
+    try:
+        host_ip: Optional[Union[ipaddress.IPv4Address, ipaddress.IPv6Address]] = (
+            ipaddress.ip_address(host)
+        )
+    except ValueError:
+        host_ip = None
+
+    if host_ip is not None and san_ips:
+        return host_ip in san_ips
+    if host_ip is None and san_dns:
+        return any(_dns_name_matches(entry, host) for entry in san_dns)
+
+    return any(
+        str(attr.value).lower() == host
+        for attr in crypto_cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
+    )
+
+
+# pytds resolves validate_host as a module global during the TLS handshake.
+pytds.tls.validate_host = _pytds_validate_host
+
 # SQL statements that are safe for read-only access
 _READONLY_PATTERN = re.compile(
     r"^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b",
```

**File**: `tests/test_database_toolset.py` (modified, +76/-0)
```diff
@@ -1,10 +1,18 @@
 """Unit tests for the database toolset."""
 
+import datetime
+import ipaddress
 import os
 import tempfile
 
 import certifi
+import pytds.tls
 import pytest
+from cryptography import x509
+from cryptography.hazmat.primitives import hashes
+from cryptography.hazmat.primitives.asymmetric import ec
+from cryptography.x509.oid import NameOID
+from OpenSSL import crypto
 from pydantic import ValidationError
 
 sqlalchemy = pytest.importorskip("sqlalchemy")
@@ -22,6 +30,7 @@
     _icon_url_for_subtype,
     _lookup_driver_info,
     _normalise_url,
+    _pytds_validate_host,
     _serialize_value,
 )
 
@@ -587,3 +596,70 @@ def test_meta_updated_after_prerequisites(self):
             {"connection_url": "sqlite:///path/to/db"}
         )
         assert toolset.meta == {"type": "database", "subtype": "sqlite"}
+
+
+def _make_cert(cn, dns_names=(), ips=()):
+    key = ec.generate_private_key(ec.SECP256R1())
+    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
+    now = datetime.datetime.now(datetime.timezone.utc)
+    builder = (
+        x509.CertificateBuilder()
+        .subject_name(subject)
+        .issuer_name(subject)
+        .public_key(key.public_key())
+        .serial_number(x509.random_serial_number())
+        .not_valid_before(now)
+        .not_valid_after(now + datetime.timedelta(days=1))
+    )
+    sans = [x509.DNSName(d) for d in dns_names] + [
+        x509.IPAddress(ipaddress.ip_address(i)) for i in ips
+    ]
+    if sans:
+        builder = builder.add_extension(
+            x509.SubjectAlternativeName(sans), critical=False
+        )
+    # pytds hands validate_host a pyOpenSSL X509, so the tests do too.
+    return crypto.X509.from_cryptography(builder.sign(key, hashes.SHA256()))
+
+
+class TestPytdsValidateHost:
+    def test_patch_installed(self):
+        assert pytds.tls.validate_host is _pytds_validate_host
+
+    def test_cn_match(self):
+        assert _pytds_validate_host(_make_cert("sql.example.com"), b"sql.example.com")
+
+    def test_san_match_when_cn_differs(self):
+        # The case that raised AttributeError with stock pytds on pyOpenSSL >= 26.2.
+        cert = _make_cert("other", dns_names=["a.example.com", "sql.example.com"])
+        assert _pytds_validate_host(cert, b"sql.example.com")
+
+    def test_case_insensitive(self):
+        cert = _make_cert("other", dns_names=["SQL.Example.com"])
+        assert _pytds_validate_host(cert, b"sql.example.COM")
+
+    def test_wildcard_first_label_only(self):
+        cert = _make_cert("other", dns_names=["*.example.com"])
+        assert _pytds_validate_host(cert, b"sql.example.com")
+        assert not _pytds_validate_host(cert, b"a.sql.example.com")
+        assert not _pytds_validate_host(cert, b"example.com")
+
+    def test_no_match(self):
+        cert = _make_cert("other", dns_names=["a.example.com"], ips=["10.0.0.1"])
+        assert not _pytds_validate_host(cert, b"sql.example.com")
+
+    def test_ip_san_match(self):
+        cert = _make_cert("other", dns_names=["a.example.com"], ips=["10.0.0.1"])
+        assert _pytds_validate_host(cert, b"10.0.0.1")
+        assert not _pytds_validate_host(cert, b"10.0.0.2")
+
+    def test_cn_ignored_when_dns_san_present(self):
+        cert = _make_cert("sql.example.com", dns_names=["other.example.com"])
+        assert not _pytds_validate_host(cert, b"sql.example.com")
+
+    def test_cn_fallback_for_ip_without_ip_san(self):
+        cert = _make_cert("10.0.0.1", dns_names=["a.example.com"])
+        assert _pytds_validate_host(cert, b"10.0.0.1")
+
+    def test_no_san_extension(self):
+        assert not _pytds_validate_host(_make_cert("other"), b"sql.example.com")
```

---

### Incident Patch 5: `96715d65` (2026-09-22)
**Commit Message**: ROB-1346 Show real allow-list prefixes in the bash toolset docs (#2495)

## Problem

The bash toolset docs showed `allow:` entries as `"my-custom-tool"` /
`"my-custom-command"`. A placeholder tells the reader nothing about the
one thing that is non-obvious here: how narrowly a prefix can be scoped,
and which commands are worth adding (the builtin `core`/`extended` lists
already cover kubectl read verbs, grep, cat, …).

## Change

- Both config examples (CLI + Robusta Helm chart) now use three prefixes
that are deliberately **not** in either builtin list: `helm list`,
`kubectl rollout history`, and a `curl` pinned to a single Prometheus
endpoint.
- Same three as a commented example in `helm/holmes/values.yaml`, next
to `builtin_allowlist`.
- A three-row table under **Prefix Matching** showing, per entry, what
it allows and what still prompts for approval — plus the ordering
gotcha: matching starts at the beginning of the command, so `curl -s
<url>` does **not** match a `curl <url>` prefix (put flags last).

## Verification

Each row was checked against the real validator
(`holmes.plugins.toolsets.bash.validation.validate_command`) with those
three prefixes in `allow` and `builtin_al

**File**: `docs/data-sources/builtin-toolsets/bash.md` (modified, +33/-4)
```diff
@@ -17,8 +17,10 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
         enabled: true
         config:
           builtin_allowlist: "core"  # "none", "core", or "extended"
-          allow:                     # additional prefixes (merged with builtins)
-            - "my-custom-tool"
+          # allow:
+          #   - "helm list"
+          #   - "kubectl rollout history"
+          #   - "curl https://prometheus.monitoring.svc:9090/api/v1"
           deny:
             - "kubectl get secret"
             - "kubectl describe secret"
@@ -42,8 +44,10 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
           enabled: true
           config:
             builtin_allowlist: "extended"
-            allow:
-              - "my-custom-command"
+            # allow:
+            #   - "helm list"
+            #   - "kubectl rollout history"
+            #   - "curl https://prometheus.monitoring.svc:9090/api/v1"
             deny:
               - "kubectl get secret"
     ```
@@ -114,6 +118,31 @@ kubectl get pods | grep error | head -10
 
 This requires `kubectl get`, `grep`, and `head` to all be allowed.
 
+A prefix can be as narrow as you like — it is matched against the start of the
+command and must end on a whitespace or `/` boundary, so it can pin a subcommand
+or the leading part of a URL. It constrains the start of the command and nothing
+else; read the warning under the table before relying on a URL-scoped entry.
+
+| Allow entry | Allows | Still needs approval |
+|-------------|--------|----------------------|
+| `helm list` | `helm list -A`, `helm list -n prod -o json` | `helm upgrade my-release ./chart` |
+| `kubectl rollout history` | `kubectl rollout history deployment/nginx` | `kubectl rollout restart deployment/nginx` |
+| `curl https://prometheus.monitoring.svc:9090/api/v1` | `curl https://prometheus.monitoring.svc:9090/api/v1/targets` | `curl https://example.com` |
+
+!!! warning "A prefix does not restrict where a command goes"
+    It constrains the start of the command and nothing else. With the `curl`
+    entry above, `curl https://prometheus.monitoring.svc:9090/api/v1/targets
+    https://example.com` also matches, and so does the same command with
+    `--next` or `-o`, because each still *starts* with the allowed prefix.
+    `deny` entries are matched the same way, so they don't catch it either.
+    A URL-scoped prefix cuts approval prompts for the endpoint you use most;
+    it is not an egress control. If Holmes must not reach other destinations,
+    leave `curl` out of the allow list and approve each command as it comes up.
+
+Because matching starts at the beginning of the command, put the part you are
+scoping on first and flags last — `curl https://host/api/v1/targets -s` matches
+the prefix above, `curl -s https://host/api/v1/targets` does not.
+
 ## Large Tool Result Storage
 
 When a tool response exceeds the LLM context window limit, Holmes saves the result to disk and gives the LLM a file path. The bash toolset automatically allows read-only commands (`cat`, `head`, `tail`, `wc`, `jq`) on the storage directory so the LLM can access saved results without approval prompts.
```

---

### Incident Patch 6: `a6f2b40b` (2026-09-22)
**Commit Message**: Fix High/Critical CVEs in the Holmes image: bump grpc, x/crypto, Helm 3.22 (#2494)

## Summary

Trivy and Grype scans of the image built from `master` (a84578a72)
flagged six Critical/High advisories, all in Go dependencies compiled
into the `argocd` and `helm` binaries. The Alpine base, Python venv and
kubectl were clean. This PR clears all six; the rebuilt image scans with
**zero Critical/High** in both scanners.

| Severity | CVE | Package | Binaries | Fix |
|---|---|---|---|---|
| High | CVE-2026-84304 | grpc v1.82.1 | argocd, helm | grpc → v1.83.2 |
| High | CVE-2026-84445 | grpc v1.82.1 | argocd, helm | grpc → v1.83.2 |
| High | CVE-2026-56855 | x/crypto v0.55.0 | argocd, helm | x/crypto →
v0.56.0 |
| High | CVE-2026-78662 | x/crypto v0.55.0 | argocd, helm | x/crypto →
v0.56.0 |
| Critical (NVD) | CVE-2026-53492 | containerd v1.7.33 | helm | Helm →
v3.22.0 (drops containerd) |
| Critical (NVD) | CVE-2026-50195 | containerd v1.7.33 | helm | Helm →
v3.22.0 (drops containerd) |

The two containerd findings are in CRI checkpoint code that helm never
linked (only `containerd/remotes` and `containerd/errdefs` were compiled
in), and upstream only lists v2 ranges as affected. There i

**File**: `bin/go-cve-rebuild/amd64/argocd.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-3fdedcc3cadac04f589879d390429b2f05cb207b9f7fd61d1571eb4665836acd  argocd.gz
+039bf1889882455ae7682a3b653a84e9049df79752ce446b250eb7d3d43369e8  argocd.gz
```

**File**: `bin/go-cve-rebuild/amd64/helm.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-69399ee7cd04540e70bc5e6a16ec26339716558605114cd9ebb5dcd74d3ba8c4  helm.gz
+befbc8b2f58044fb8f48df373e4396beeead7760591915b4a867afc1cda764bb  helm.gz
```

**File**: `bin/go-cve-rebuild/arm64/argocd.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-381312fcd9d5aba1f7576faf6c2229dd1d8c85f345fda3633f77d21fc1492adc  argocd.gz
+1189d9a07f0d33521075a63a9e42c558881e62b3f7a92cbdd108cd1307166aa8  argocd.gz
```

**File**: `bin/go-cve-rebuild/arm64/helm.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-d137abc042adedadd405fed5784733cd4e9de6bffe0e292f5077de5e9fefe034  helm.gz
+0d777fca3853b826420f007a5b9c7982412c715eab0cd1b3c5d395590c04efac  helm.gz
```

**File**: `scripts/build_go_binaries.sh` (modified, +31/-22)
```diff
@@ -7,18 +7,22 @@
 #
 # Two x/* replaces are applied to every binary that pulls them in, because the
 # same advisories hit all of them:
-#   golang.org/x/net    -> v0.57.0  CVE-2026-33814 (fixed 0.53.0) plus
+#   golang.org/x/net    -> v0.59.0  CVE-2026-33814 (fixed 0.53.0) plus
 #                                   CVE-2026-25681/27136/39821 (High) and
 #                                   CVE-2026-25680/42502/42506 (Medium, >60d),
 #                                   all fixed in 0.55.0; 0.56.0 adds the
-#                                   CVE-2026-46600 fix.
-#   golang.org/x/crypto -> v0.55.0  CVE-2026-39828/39829/39830/39831/39832/39835/
+#                                   CVE-2026-46600 fix. 0.59.0 is not
+#                                   CVE-driven: grpc v1.83.2 requires x/net
+#                                   >= 0.58.0, so the pin must stay at or
+#                                   above that.
+#   golang.org/x/crypto -> v0.56.0  CVE-2026-39828/39829/39830/39831/39832/39835/
 #                                   42508/46595/46597 (High) and CVE-2026-39827/
 #                                   39833/39834/46598 (Medium, >60d), all fixed
 #                                   in 0.52.0; 0.55.0 adds the CVE-2026-56854
-#                                   fix and stays >= what x/net v0.57.0 requires.
-# Bumping x/net to 0.57.0 also drags x/sys to 0.47.0 and x/text to 0.40.0 through
-# MVS, which clears CVE-2026-39824 (x/sys) and CVE-2026-56852 (x/text).
+#                                   fix; 0.56.0 adds the SSH mux deadlock fixes
+#                                   CVE-2026-56855/78662 (GO-2026-6355/6354, High).
+# Bumping x/net to >= 0.57.0 also drags x/sys to 0.47.0 and x/text to 0.40.0
+# through MVS, which clears CVE-2026-39824 (x/sys) and CVE-2026-56852 (x/text).
 #
 # ArgoCD: rebuilt from v3.3.11 source with go-git replaced to v5.19.2 and
 #   go-billy replaced to v5.9.0. ArgoCD pins go-git v5.14.0 upstream
@@ -29,17 +33,25 @@
 #   CVE-2026-71556 (High) / CVE-2026-71557 (Medium) (both fixed 5.19.2);
 #   go-billy v5.6.2 is vulnerable to CVE-2026-44973 (fixed 5.9.0).
 #   v3.3.11 already ships otel/sdk 1.43.0 so the old otel replace was dropped.
-#   Also replaced: grpc -> v1.82.1 (GHSA-hrxh-6v49-42gf), oras-go -> v2.6.2
-#   (CVE-2026-50151/50163), mongo-driver -> v1.17.7 (CVE-2026-2303, Medium, >60d).
+#   Also replaced: grpc -> v1.83.2 (GHSA-hrxh-6v49-42gf, plus CVE-2026-84304
+#   HTTP/2 DATA-frame heap exhaustion fixed 1.83.1 and CVE-2026-84445 xDS
+#   server panic fixed 1.83.2), oras-go -> v2.6.2 (CVE-2026-50151/50163),
+#   mongo-driver -> v1.17.7 (CVE-2026-2303, Medium, >60d).
 #   Revert to plain upstream binary when ArgoCD ships go-git >= 5.19.2 and
 #   go-billy >= 5.9.0 (blocked on go-git/go-git#1551 upstream).
 #
-# Helm: built from v3.21.0 with containerd replaced to v1.7.33 (CVE-2026-53488
-#   High + CVE-2026-47262; v3.21.0 ships v1.7.30), grpc replaced to v1.82.1
-#   (GHSA-hrxh-6v49-42gf; v3.21.0 ships v1.80.0) and oras-go replaced to v2.6.2
-#   (CVE-2026-50151/50163).
+# Helm: built from v3.22.0 with grpc replaced to v1.83.2 (GHSA-hrxh-6v49-42gf,
+#   CVE-2026-84304/84445; v3.22.0 lists v1.82.1 as an indirect dep, but grpc is
+#   no longer compiled into the helm binary at all since containerd went away,
+#   so this replace is only a floor) and oras-go replaced to v2.6.2
+#   (CVE-2026-50151/50163; v3.22.0 already ships v2.6.2, the replace is kept as
+#   a floor). v3.22.0 dropped the github.com/containerd/containerd dependency
+#   entirely, so the old containerd -> v1.7.33 replace (CVE-2026-53488/47262)
+#   is gone; that also removes the containerd v1 false positives
+#   GO-2026-5064/5338 (CVE-2026-53492/50195, CRI checkpoint code Helm never
+#   linked) that scanners flagged as Critical.
 #   Revert to upstream binary when Helm releases a version built with
-#   Go >= 1.26.6, containerd >= 1.7.33, grpc >= 1.82.1 and oras-go >= 2.6.2.
+#   Go >= 1.26.6, grpc >= 1.83.2, x/crypto >= 0.56.0 and oras-go >= 2.6.2.
 #
 # kubectl is NOT built here — the official dl.k8s.io binary (pinned via
 #   KUBECTL_VERSION in the Dockerfile) is used instead. v1.37.0 is built with
@@ -107,7 +119,7 @@ assert_module_version() {
 # binary we ship, so every tool gets the same two replaces. Run from the module
 # root of the tool being built.
 apply_x_replaces() {
-  echo "==> Pinning x/net to $X_NET_PATCHED_VERSION (CVE-2026-33814/25681/27136/39821) and x/crypto to $X_CRYPTO_PATCHED_VERSION (CVE-2026-39828/39829/39830/39831/39832/39835/42508/46595/46597)..."
+  echo "==> Pinning x/net to $X_NET_PATCHED_VERSION (CVE-2026-33814/25681/27136/39821; >= 0.58.0 required by grpc $GRPC_PATCHED_VERSION) and x/crypto to $X_CRYPTO_PATCHED_VERSION (CVE-2026-39828/39829/39830/39831/39832/39835/42508/46595/46597/56855/78662)..."
   go mod edit -replace="golang.org/x/net=golang.org/x/net@$X_NET_PATCHED_VERSION"
   go mod edit -replace="golang.org/x/crypto=golang.org/x/crypto@$X_CRYPTO_PATCHED_VERSION"
 }
```

---

### Incident Patch 7: `9fbfadd3` (2026-09-16)
**Commit Message**: ROB-1395: Fix Coralogix UI permalinks for US2 and other regions (#2478)

## What

Fixes broken Coralogix UI permalinks
([ROB-1395](https://linear.app/robusta/issue/ROB-1395/support-coralogix-us2-ui-permalinks)).
Permalinks were built as `https://{team_slug}.{domain}`, reusing the
configured **API** domain — but the Coralogix team UI lives on a
**different hostname in most regions** (per the [official Coralogix
domain
table](https://coralogix.com/docs/user-guides/account-management/account-settings/coralogix-domain/)).

## The bug (verified against live Coralogix endpoints)

| Configured `domain` | Old permalink host | Result | Correct UI host |
|---|---|---|---|
| `us2.coralogix.com` (**reported case**) | `<team>.us2.coralogix.com` |
❌ TLS cert mismatch | `<team>.app.cx498.coralogix.com` |
| `us1.coralogix.com` | `<team>.us1.coralogix.com` | ❌ TLS cert mismatch
| `<team>.app.coralogix.us` |
| `coralogix.us` (from Holmes' own config examples) |
`<team>.coralogix.us` | ❌ NXDOMAIN | `<team>.app.coralogix.us` |
| `coralogix.in` (from Holmes' own config examples) |
`<team>.coralogix.in` | ❌ NXDOMAIN | `<team>.app.coralogix.in` |
| `eu2.coralogix.com` | `<team>.eu2.coralogix.com` | ⚠️ wo

**File**: `conftest.py` (modified, +2/-0)
```diff
@@ -275,6 +275,8 @@ def responses():
         rsps.add_passthru(re.compile(r"https://.*\.coralogix\.com"))
         rsps.add_passthru(re.compile(r"https://.*\.coralogix\.us"))
         rsps.add_passthru(re.compile(r"https://.*\.coralogix\.in"))
+        # Coralogix docs site (domain-table drift check in test_domain_map_sync.py)
+        rsps.add_passthru("https://coralogix.com")
 
         # Allow Elasticsearch/OpenSearch Cloud API calls (various hosting regions)
         rsps.add_passthru(re.compile(r"https://.*\.cloud\.es\.io"))  # Elastic Cloud
```

**File**: `docs/data-sources/builtin-toolsets/coralogix-logs.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ You can find your `domain` and `team_slug` from the URL you use to access Coralo
 
 Configure both the Coralogix DataPrime toolset (for logs/traces) and the Prometheus metrics toolset (for metrics) using the same API key. The `team_slug` field is optional — it's only used to generate clickable permalink URLs that open query results in the Coralogix UI.
 
+Holmes automatically derives the UI hostname for permalinks from your `domain` — the Coralogix UI uses a different hostname than the API in most regions. For example, with the US2 domain (`us2.coralogix.com` or `cx498.coralogix.com`) permalinks point to `https://<team_slug>.app.cx498.coralogix.com`. If your team's UI lives at a non-standard address, set the optional `ui_url` field to its full base URL (e.g. `ui_url: "https://my-team.app.cx498.coralogix.com"`) to override the derived hostname.
+
 === "Holmes CLI"
 
     Add the following to **~/.holmes/config.yaml**. Create the file if it doesn't exist:
```

**File**: `holmes/plugins/toolsets/coralogix/toolset_coralogix.py` (modified, +9/-5)
```diff
@@ -19,7 +19,11 @@
     execute_dataprime_query,
     health_check,
 )
-from holmes.plugins.toolsets.coralogix.utils import CoralogixConfig, normalize_datetime
+from holmes.plugins.toolsets.coralogix.utils import (
+    CoralogixConfig,
+    get_ui_base_url,
+    normalize_datetime,
+)
 from holmes.plugins.toolsets.utils import toolset_name_for_one_liner
 
 
@@ -32,10 +36,11 @@ def _build_coralogix_query_url(
 ) -> Optional[str]:
     """Build a clickable Coralogix UI permalink URL.
 
-    Returns None if team_slug is not configured (it's optional).
+    Returns None if neither team_slug nor ui_url is configured (both are optional).
     """
-    # team_slug is optional - without it we can't build UI URLs
-    if not config.team_slug:
+    # without team_slug or ui_url we can't build UI URLs
+    base_url = get_ui_base_url(config)
+    if not base_url:
         return None
 
     try:
@@ -51,7 +56,6 @@ def _build_coralogix_query_url(
 
         encoded_query = quote(query)
         encoded_time = quote(time_range)
-        base_url = f"https://{config.team_slug}.{config.domain}"
 
         url = (
             f"{base_url}/#/query-new/{data_pipeline}"
```

**File**: `holmes/plugins/toolsets/coralogix/utils.py` (modified, +90/-5)
```diff
@@ -42,6 +42,40 @@ class CoralogixLabelsConfig(ToolsetConfig):
     )
 
 
+# Official mapping of Coralogix account domains to the "Team Hostname" suffix used
+# by the web UI, per https://coralogix.com/docs/user-guides/account-management/account-settings/coralogix-domain/
+# The UI permalink hostname is f"{team_slug}.{suffix}" and differs from the API
+# domain in most regions: e.g. the US2 API domain is us2.coralogix.com (legacy:
+# cx498.coralogix.com) but the US2 UI lives at <team>.app.cx498.coralogix.com.
+# Both the current regional domains (us2.coralogix.com) and the legacy ones
+# (cx498.coralogix.com) are accepted as keys since either works for API calls.
+CORALOGIX_TEAM_HOSTNAME_SUFFIXES: Dict[str, str] = {
+    # US1 - AWS us-east-2 (Ohio)
+    "us1.coralogix.com": "app.coralogix.us",
+    "coralogix.us": "app.coralogix.us",
+    # US2 - AWS us-west-2 (Oregon)
+    "us2.coralogix.com": "app.cx498.coralogix.com",
+    "cx498.coralogix.com": "app.cx498.coralogix.com",
+    # US3 - GCP us-central1 (Iowa)
+    "us3.coralogix.com": "app.us3.coralogix.com",
+    # EU1 - AWS eu-west-1 (Ireland); the only region without an 'app.' prefix
+    "eu1.coralogix.com": "coralogix.com",
+    "coralogix.com": "coralogix.com",
+    # EU2 - AWS eu-north-1 (Stockholm)
+    "eu2.coralogix.com": "app.eu2.coralogix.com",
+    # AP1 - AWS ap-south-1 (Mumbai)
+    "ap1.coralogix.com": "app.coralogix.in",
+    "coralogix.in": "app.coralogix.in",
+    # AP2 - AWS ap-southeast-1 (Singapore)
+    "ap2.coralogix.com": "app.coralogixsg.com",
+    "coralogixsg.com": "app.coralogixsg.com",
+    # AP3 - AWS ap-southeast-3 (Jakarta)
+    "ap3.coralogix.com": "app.ap3.coralogix.com",
+    # GOV1 - AWS GovCloud us-gov-west-1 (FedRAMP)
+    "gov1.coralogixgov.us": "app.gov1.coralogixgov.us",
+}
+
+
 class CoralogixConfig(ToolsetConfig):
     """Coralogix toolset configuration.
 
@@ -50,16 +84,18 @@ class CoralogixConfig(ToolsetConfig):
         api_key: API key with DataQuerying permissions
 
     Optional:
-        team_slug: Your team's URL slug (e.g., "my-team" from https://my-team.eu2.coralogix.com).
+        team_slug: Your team's URL slug (e.g., "my-team" from https://my-team.app.eu2.coralogix.com).
                    Only needed to generate clickable UI permalink URLs in tool output.
+        ui_url: Full base URL of your team's Coralogix UI. Only needed when the
+                auto-derived UI hostname is wrong (e.g. custom deployments).
         labels: Label mappings for log fields (for Kubernetes log extraction)
     """
 
     model_config = ConfigDict(extra="allow")
     domain: str = Field(
         title="Domain",
         description="Coralogix domain",
-        examples=["eu2.coralogix.com", "coralogix.us", "coralogix.in"],
+        examples=["eu2.coralogix.com", "us2.coralogix.com", "coralogix.us"],
     )
     api_key: str = Field(
         title="API Key",
@@ -71,6 +107,13 @@ class CoralogixConfig(ToolsetConfig):
         description="Your team's URL slug for generating UI permalinks",
         examples=["my-team"],
     )
+    ui_url: Optional[str] = Field(
+        default=None,
+        title="UI URL",
+        description="Base URL of your team's Coralogix UI, used for generating UI permalinks. "
+        "Overrides the hostname otherwise derived from 'team_slug' and 'domain'.",
+        examples=["https://my-team.app.cx498.coralogix.com"],
+    )
     labels: CoralogixLabelsConfig = Field(
         default_factory=CoralogixLabelsConfig,
         title="Labels",
@@ -84,15 +127,57 @@ def handle_deprecated_fields(self):
         deprecated = []
 
         # team_hostname was renamed to team_slug
-        if "team_hostname" in extra and not self.team_slug:
-            self.team_slug = extra["team_hostname"]
+        if "team_hostname" in extra:
+            if not self.team_slug:
+                self.team_slug = extra["team_hostname"]
+            extra.pop("team_hostname")
             deprecated.append("team_hostname -> team_slug")
 
         if deprecated:
-            logging.warning(f"Coralogix: deprecated config field names: {', '.join(deprecated)}")
+            logging.warning(
+                f"Coralogix: deprecated config field names: {', '.join(deprecated)}"
+            )
         return self
 
 
+def get_ui_base_url(config: CoralogixConfig) -> Optional[str]:
+    """Return the base URL of the Coralogix team web UI, or None if unknown.
+
+    The UI ("Team Hostname") differs from the API domain in most Coralogix
+    regions, so the configured API domain cannot be reused verbatim (ROB-1395).
+
+    Resolution order:
+    1. `ui_url`, when configured (explicit override).
+    2. `team_slug` + the official team hostname suffix for the configured domain.
+    3. `team_slug` + "app." + domain for unrecognized Coralogix domains: every
+       region added since the regional naming scheme (us3, eu2, ap3) serves its
+       team UI at app.<domain>, so assume future regions follow the same
+       convent
```

**File**: `tests/plugins/toolsets/coralogix/test_coralogix.py` (modified, +224/-0)
```diff
@@ -14,6 +14,7 @@
 )
 from holmes.plugins.toolsets.coralogix.utils import (
     CoralogixConfig,
+    get_ui_base_url,
     normalize_datetime,
 )
 
@@ -48,6 +49,229 @@ def test_normalize_datetime(input_date, expected_output):
     assert normalize_datetime(input_date) == expected_output
 
 
+class TestUIPermalinkBaseURL:
+    """Tests for get_ui_base_url (ROB-1395).
+
+    The Coralogix team UI hostname differs from the API domain in most regions
+    (e.g. US2 API domain is us2.coralogix.com / cx498.coralogix.com but the UI
+    lives at <team>.app.cx498.coralogix.com), so permalinks must not reuse the
+    API domain verbatim.
+    """
+
+    @pytest.mark.parametrize(
+        "domain,expected_host",
+        [
+            # US1 (Ohio)
+            ("us1.coralogix.com", "app.coralogix.us"),
+            ("coralogix.us", "app.coralogix.us"),
+            # US2 (Oregon) - the originally reported bug
+            ("us2.coralogix.com", "app.cx498.coralogix.com"),
+            ("cx498.coralogix.com", "app.cx498.coralogix.com"),
+            # US3 (Iowa)
+            ("us3.coralogix.com", "app.us3.coralogix.com"),
+            # EU1 (Ireland) - only region whose team hostname has no 'app.' prefix
+            ("eu1.coralogix.com", "coralogix.com"),
+            ("coralogix.com", "coralogix.com"),
+            # EU2 (Stockholm)
+            ("eu2.coralogix.com", "app.eu2.coralogix.com"),
+            # AP1 (Mumbai)
+            ("ap1.coralogix.com", "app.coralogix.in"),
+            ("coralogix.in", "app.coralogix.in"),
+            # AP2 (Singapore)
+            ("ap2.coralogix.com", "app.coralogixsg.com"),
+            ("coralogixsg.com", "app.coralogixsg.com"),
+            # AP3 (Jakarta)
+            ("ap3.coralogix.com", "app.ap3.coralogix.com"),
+            # GOV1 (AWS GovCloud, FedRAMP)
+            ("gov1.coralogixgov.us", "app.gov1.coralogixgov.us"),
+        ],
+    )
+    def test_maps_api_domain_to_team_ui_hostname(self, domain, expected_host):
+        """Each documented Coralogix domain maps to its official team UI hostname."""
+        config = CoralogixConfig(api_key="k", team_slug="acme", domain=domain)
+        assert get_ui_base_url(config) == f"https://acme.{expected_host}"
+
+    @pytest.mark.parametrize(
+        "domain",
+        [
+            "US2.Coralogix.com",  # case-insensitive
+            " us2.coralogix.com ",  # surrounding whitespace
+            "us2.coralogix.com/",  # trailing slash
+            "us2.coralogix.com.",  # trailing dot (FQDN form)
+            "https://us2.coralogix.com",  # scheme pasted in by mistake
+        ],
+    )
+    def test_domain_is_normalized_before_mapping(self, domain):
+        """Domain casing/whitespace/scheme/trailing chars are normalized before lookup."""
+        config = CoralogixConfig(api_key="k", team_slug="acme", domain=domain)
+        assert get_ui_base_url(config) == "https://acme.app.cx498.coralogix.com"
+
+    def test_unknown_non_coralogix_domain_falls_back_to_domain_itself(self):
+        """Non-Coralogix (custom) domains keep the {team_slug}.{domain} behavior."""
+        config = CoralogixConfig(
+            api_key="k", team_slug="acme", domain="logs.my-company.internal"
+        )
+        assert get_ui_base_url(config) == "https://acme.logs.my-company.internal"
+
+    @pytest.mark.parametrize(
+        "domain,expected_host",
+        [
+            # hypothetical future regions: assume the modern app.<domain> scheme
+            # that us3/eu2/ap3 follow
+            ("us4.coralogix.com", "app.us4.coralogix.com"),
+            ("eu3.coralogix.com", "app.eu3.coralogix.com"),
+            ("me1.coralogix.com", "app.me1.coralogix.com"),
+            ("gov2.coralogixgov.us", "app.gov2.coralogixgov.us"),
+        ],
+    )
+    def test_unknown_coralogix_domain_assumes_app_prefix(self, domain, expected_host):
+        """Unmapped Coralogix regions get the modern app.<domain> UI hostname."""
+        config = CoralogixConfig(api_key="k", team_slug="acme", domain=domain)
+        assert get_ui_base_url(config) == f"https://acme.{expected_host}"
+
+    def test_custom_domain_containing_coralogix_is_not_app_prefixed(self):
+        """A custom domain that merely contains 'coralogix' is used as-is."""
+        config = CoralogixConfig(
+            api_key="k", team_slug="acme", domain="logs.coralogix-proxy.internal"
+        )
+        assert get_ui_base_url(config) == "https://acme.logs.coralogix-proxy.internal"
+
+    def test_domain_already_app_prefixed_is_not_double_prefixed(self):
+        """A domain mistakenly set to the UI hostname doesn't get a second app. prefix."""
+        config = CoralogixConfig(
+            api_key="k", team_slug="acme", domain="app.us4.coralogix.com"
+        )
+        assert get_ui_base_url(config) == "https://acme.app.us4.coralogix.com"
+
+    def test_no_team_slug_and_no_ui_url_returns_none(self):
+        """Without team_slug or ui_url there is no UI base URL."""
+        config = Coral
```

**File**: `tests/plugins/toolsets/coralogix/test_domain_map_sync.py` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+"""Drift check: CORALOGIX_TEAM_HOSTNAME_SUFFIXES vs the official Coralogix docs.
+
+Coralogix has no API for its region/domain table; the source of truth is the
+docs page, which is also served as machine-readable Markdown. The live test
+fetches that table and fails if the docs list a domain the map is missing or
+maps differently, so the permalink mapping can't silently rot when Coralogix
+adds or changes regions. Transient upstream conditions (network errors,
+timeouts, 429/5xx) skip rather than fail, so docs-site hiccups don't break
+unrelated PRs; drift, a moved page (404), or an unparseable table still fail.
+"""
+
+import re
+
+import pytest
+import requests  # type: ignore
+
+from holmes.plugins.toolsets.coralogix.utils import CORALOGIX_TEAM_HOSTNAME_SUFFIXES
+
+DOCS_URL = "https://coralogix.com/docs/user-guides/account-management/account-settings/coralogix-domain.md"
+
+# | us2.coralogix.com | US2 | AWS us-west-2 (Oregon) | `<team>.app.cx498.coralogix.com` |
+ROW_RE = re.compile(
+    r"^\|\s*([a-z0-9.-]+)\s*\|\s*\S+\s*\|[^|]+\|\s*`<team>\.([a-z0-9.-]+)`\s*\|",
+    re.MULTILINE,
+)
+
+
+def parse_docs_domain_table(markdown_text: str) -> dict[str, str]:
+    """Extract {domain: team-hostname-suffix} from the docs Markdown table."""
+    return dict(ROW_RE.findall(markdown_text))
+
+
+def diff_against_map(docs_map: dict[str, str]) -> list[str]:
+    """Return one line per documented domain that the map is missing or maps differently."""
+    drift = []
+    for domain, suffix in sorted(docs_map.items()):
+        mapped = CORALOGIX_TEAM_HOSTNAME_SUFFIXES.get(domain)
+        if mapped is None:
+            drift.append(f"docs list {domain} -> {suffix}, missing from map")
+        elif mapped != suffix:
+            drift.append(f"{domain}: map says {mapped}, docs say {suffix}")
+    return drift
+
+
+SAMPLE_DOCS_TABLE = """\
+| **Coralogix Domain** | **Coralogix Region** | **Region**             | **Team Hostname**                |
+| -------------------- | -------------------- | ---------------------- | -------------------------------- |
+| us2.coralogix.com    | US2                  | AWS us-west-2 (Oregon) | `<team>.app.cx498.coralogix.com` |
+| eu1.coralogix.com    | EU1                  | AWS eu-west-1 (Ireland)| `<team>.coralogix.com`           |
+| xx9.coralogix.com    | XX9                  | Nowhere (Fictional)    | `<team>.app.xx9.coralogix.com`   |
+"""
+
+
+def test_docs_table_parsing_and_drift_detection():
+    """Hermetic check of the table parser and drift comparison (no network)."""
+    docs_map = parse_docs_domain_table(SAMPLE_DOCS_TABLE)
+    assert docs_map == {
+        "us2.coralogix.com": "app.cx498.coralogix.com",
+        "eu1.coralogix.com": "coralogix.com",
+        "xx9.coralogix.com": "app.xx9.coralogix.com",
+    }
+    # us2/eu1 match the real map; the fictional region must be reported as drift
+    assert diff_against_map(docs_map) == [
+        "docs list xx9.coralogix.com -> app.xx9.coralogix.com, missing from map"
+    ]
+
+
+def test_team_hostname_map_matches_coralogix_docs():
+    """Every region in the official docs table must be mapped, with the same hostname."""
+    try:
+        response = requests.get(DOCS_URL, timeout=30)
+    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
+        pytest.skip(f"Coralogix docs site unreachable, cannot check drift: {e}")
+
+    if response.status_code == 429 or response.status_code >= 500:
+        pytest.skip(
+            f"Coralogix docs site returned transient HTTP {response.status_code}, "
+            "cannot check drift"
+        )
+
+    assert response.status_code == 200, (
+        f"Coralogix domain docs page returned HTTP {response.status_code} — "
+        f"the page may have moved; update DOCS_URL and verify the mapping: {DOCS_URL}"
+    )
+
+    docs_map = parse_docs_domain_table(response.text)
+    assert docs_map, (
+        f"Could not parse any domain rows from {DOCS_URL} — "
+        "the table format may have changed; update ROW_RE and verify the mapping"
+    )
+
+    drift = diff_against_map(docs_map)
+    assert not drift, (
+        "CORALOGIX_TEAM_HOSTNAME_SUFFIXES has drifted from the official docs "
+        f"({DOCS_URL}):\n" + "\n".join(drift)
+    )
```

**File**: `tests/plugins/toolsets/test_verify_tool_urls.py` (modified, +2/-1)
```diff
@@ -509,7 +509,8 @@ def test_tool_urls(self, toolset, tool_class, params, url_validator):
 class TestCoralogixURLs:
     TEAM_SLUG = "my-team"
     DOMAIN = "eu2.coralogix.com"
-    BASE_URL = f"https://{TEAM_SLUG}.{DOMAIN}"
+    # the team UI hostname differs from the API domain (ROB-1395)
+    BASE_URL = f"https://{TEAM_SLUG}.app.{DOMAIN}"
 
     @staticmethod
     def extract_query_from_url(url: str) -> str:
```

---

### Incident Patch 8: `ccd28526` (2026-09-16)
**Commit Message**: ROB-1378 - Fix three eval-affecting bugs: litellm token limits, phantom tool param, unscored frontend-tool-turn answers (#2474)

Three bugs surfaced while investigating why sonnet-5 scored 68% on the
2026-09-14 fast-benchmark (vs opus-5 at 94%). Most of that gap turned
out to be measurement artifacts rather than model capability.

## 1. litellm reports `None` token limits for custom-priced models

A model registered with only custom pricing gets normalized by litellm
into a full `ModelInfo` whose `max_input_tokens`/`max_output_tokens` are
`None`. `get_context_window_size` returned that `None` instead of
treating it as a missing entry, breaking token-count formatting. Now a
falsy value falls through to the existing fallbacks.

Affects any custom-priced entry — which is how the OpenRouter models
(kimi-k3, glm-5.3) were configured.

## 2. Phantom `param` argument on three kubernetes tools

`YAMLTool.__infer_parameters` regex-scans a tool's script for `{{
placeholders }}` and auto-declares each one as a tool parameter. It did
not skip comments — so a security note reading *"never interpolate `{{
param }}` inside a quoted context"* published a phantom `param`
parameter on `kubernetes_co

**File**: `.github/workflows/eval-benchmarks.yaml` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ on:
         description: 'Comma-separated list of models to test'
         required: false
         # NOTE: Keep in sync with DEFAULT_BENCHMARK_MODELS env var
-        default: 'opus-4.7,opus-4.6,sonnet-4.6,haiku-4.5,gpt-5.4,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-r1-reasoner,deepseek-v3.2-chat,gpt-5.3-codex,opus-4.8,gpt-5.5'
+        default: 'opus-5,sonnet-5,haiku-4.5,gpt-5.4,gpt-5.5,gpt-5.3-codex,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-flash,deepseek-v4-pro,kimi-k3,glm-5.3'
       test_markers:
         description: 'Custom pytest markers (ONLY use if not using benchmark_type). Cannot be combined with benchmark_type.'
         required: false
@@ -38,7 +38,7 @@ on:
 env:
   # Default models for benchmarks - single source of truth
   # NOTE: Keep workflow_dispatch default in sync with this for UI display
-  DEFAULT_BENCHMARK_MODELS: 'opus-4.7,opus-4.6,sonnet-4.6,haiku-4.5,gpt-5.4,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-r1-reasoner,deepseek-v3.2-chat,gpt-5.3-codex,opus-4.8,gpt-5.5'
+  DEFAULT_BENCHMARK_MODELS: 'opus-5,sonnet-5,haiku-4.5,gpt-5.4,gpt-5.5,gpt-5.3-codex,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-flash,deepseek-v4-pro,kimi-k3,glm-5.3'
 
 jobs:
   run-benchmarks:
```

**File**: `holmes/core/llm.py` (modified, +15/-6)
```diff
@@ -525,12 +525,17 @@ def get_context_window_size(self) -> int:
             )
             return OVERRIDE_MAX_CONTENT_SIZE
 
-        # Try each name variant
+        # Try each name variant. A model registered only with custom pricing
+        # (input/output_cost_per_token from model_list.yaml) gets normalized
+        # by litellm into a full ModelInfo whose max_input_tokens is None -
+        # treat that like a missing entry rather than returning None.
         for name in self._get_model_name_variants_for_lookup():
             try:
-                return litellm.model_cost[name]["max_input_tokens"]
+                max_input_tokens = litellm.model_cost[name]["max_input_tokens"]
             except Exception:
                 continue
+            if max_input_tokens:
+                return max_input_tokens
 
         # Log which lookups we tried (once per model to avoid log spam)
         warn_key = (self.model, "max_input_tokens")
@@ -799,17 +804,21 @@ def get_maximum_output_token(self) -> int:
             )
             return OVERRIDE_MAX_OUTPUT_TOKEN
 
-        # Try each name variant
+        # Try each name variant. As in get_context_window_size, a custom-priced
+        # model can be present in litellm.model_cost with max_output_tokens=None;
+        # skip it and fall through to the computed budget.
         for name in self._get_model_name_variants_for_lookup():
             try:
                 litellm_max_output_tokens = litellm.model_cost[name][
                     "max_output_tokens"
                 ]
-                if litellm_max_output_tokens < max_output_tokens:
-                    max_output_tokens = litellm_max_output_tokens
-                return max_output_tokens
             except Exception:
                 continue
+            if not litellm_max_output_tokens:
+                continue
+            if litellm_max_output_tokens < max_output_tokens:
+                max_output_tokens = litellm_max_output_tokens
+            return max_output_tokens
 
         # Log which lookups we tried (once per model to avoid log spam)
         warn_key = (self.model, "max_output_tokens")
```

**File**: `holmes/core/tools.py` (modified, +5/-1)
```diff
@@ -541,7 +541,11 @@ def __init__(self, **data):
     def __infer_parameters(self):
         # Find parameters that appear inside self.command or self.script but weren't declared in parameters
         template = self.command or self.script
-        inferred_params = re.findall(r"\{\{\s*([\w]+)[\.\|]?.*?\s*\}\}", template)
+        # Shell comments may mention {{ placeholders }} in prose; those are not parameters
+        executable_template = re.sub(r"^\s*#.*$", "", template, flags=re.MULTILINE)
+        inferred_params = re.findall(
+            r"\{\{\s*([\w]+)[\.\|]?.*?\s*\}\}", executable_template
+        )
         # TODO: if filters were used in template, take only the variable name
         # Regular expression to match Jinja2 placeholders with or without filters
         # inferred_params = re.findall(r'\{\{\s*(\w+)(\s*\|\s*[^}]+)?\s*\}\}', self.command)
```

**File**: `tests/core/test_llm_context_window_none_lookup.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+"""Custom-priced models must not break context-window / max-output lookups.
+
+When a model_list.yaml entry carries input_cost_per_token / output_cost_per_token,
+Holmes registers it with litellm.register_model(). Once litellm normalizes that
+entry (e.g. after a get_model_info() call), litellm.model_cost[name] is a full
+ModelInfo dict where max_input_tokens and max_output_tokens are present but None.
+The lookups must treat None like a missing entry and fall back, instead of
+returning None and crashing callers such as Config._get_llm's token formatting.
+"""
+
+from unittest.mock import patch
+
+from holmes.core.llm import FALLBACK_CONTEXT_WINDOW_SIZE, DefaultLLM
+
+
+def _make_llm(model: str) -> DefaultLLM:
+    llm = DefaultLLM.__new__(DefaultLLM)
+    llm.model = model
+    llm.api_key = None
+    llm.api_base = None
+    llm.api_version = None
+    llm.args = {}
+    llm.tracer = None
+    llm.name = None
+    llm.is_robusta_model = False
+    llm.max_context_size = None
+    return llm
+
+
+_NORMALIZED_PRICED_ENTRY = {
+    "input_cost_per_token": 2.34e-06,
+    "output_cost_per_token": 1.17e-05,
+    "litellm_provider": "openai",
+    "mode": "chat",
+    "max_tokens": None,
+    "max_input_tokens": None,
+    "max_output_tokens": None,
+}
+
+
+def test_context_window_falls_back_when_max_input_tokens_is_none():
+    model = "openai/moonshotai/kimi-k3-test"
+    with patch.dict(
+        "litellm.model_cost", {model: dict(_NORMALIZED_PRICED_ENTRY)}, clear=False
+    ):
+        llm = _make_llm(model)
+        assert llm.get_context_window_size() == FALLBACK_CONTEXT_WINDOW_SIZE
+
+
+def test_max_output_tokens_falls_back_when_max_output_tokens_is_none():
+    model = "openai/moonshotai/kimi-k3-test"
+    with patch.dict(
+        "litellm.model_cost", {model: dict(_NORMALIZED_PRICED_ENTRY)}, clear=False
+    ):
+        llm = _make_llm(model)
+        result = llm.get_maximum_output_token()
+        assert isinstance(result, int)
+        assert result == max(64000, FALLBACK_CONTEXT_WINDOW_SIZE * 12 // 100)
+
+
+def test_real_max_tokens_still_honored():
+    model = "openai/priced-with-limits-test"
+    entry = dict(_NORMALIZED_PRICED_ENTRY)
+    entry["max_input_tokens"] = 128000
+    entry["max_output_tokens"] = 16000
+    with patch.dict("litellm.model_cost", {model: entry}, clear=False):
+        llm = _make_llm(model)
+        assert llm.get_context_window_size() == 128000
+        assert llm.get_maximum_output_token() == 16000
```

**File**: `tests/llm/test_ask_holmes.py` (modified, +14/-1)
```diff
@@ -39,6 +39,7 @@
 from tests.llm.utils.skill_suggestions import (
     count_fetch_skill_calls,
     extract_suggested_skills,
+    join_frontend_tool_turn_content,
     write_suggestions_as_skill_files,
 )
 from tests.llm.utils.retry_handler import retry_on_throttle
@@ -147,7 +148,19 @@ def test_ask_holmes(
         )
         raise
 
-    output = result.result
+    # Models may write their final answer as content on the same turn as a
+    # frontend tool call. SuggestSkills replies "continue naturally as if this
+    # tool was never called", so the model then adds only a short trailing
+    # remark - and result.result keeps just that last turn, losing the answer.
+    # The UI renders it correctly (the content ships as an ai_message event,
+    # collected into intermediateMessages), so we rejoin it here instead of
+    # changing product code.
+    frontend_payload = load_frontend_tools(test_case)
+    output = join_frontend_tool_turn_content(
+        result.result,
+        result.messages,
+        {t.name for t in frontend_payload.tools} if frontend_payload else None,
+    )
 
     suggested_memories = extract_suggested_skills(result.tool_calls)
     update_property(request, "suggested_memories", suggested_memories)
```

**File**: `tests/llm/test_frontend_tool_turn_content.py` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+"""Tests for recovering answers emitted alongside a frontend tool call.
+
+See join_frontend_tool_turn_content: models may write their final answer as
+content on the same turn as a frontend tool call, which LLMResult.result drops.
+"""
+
+from tests.llm.utils.skill_suggestions import join_frontend_tool_turn_content
+
+FRONTEND = {"SuggestSkills"}
+
+
+def _assistant(content, *tool_names):
+    return {
+        "role": "assistant",
+        "content": content,
+        "tool_calls": [{"function": {"name": name}} for name in tool_names],
+    }
+
+
+def test_content_beside_frontend_tool_is_recovered():
+    messages = [_assistant("The pod OOMed.", "SuggestSkills")]
+
+    output = join_frontend_tool_turn_content("Let me know if you want more.", messages, FRONTEND)
+
+    assert "The pod OOMed." in output
+    assert "Let me know if you want more." in output
+
+
+def test_content_beside_backend_tool_is_ignored():
+    """Narration beside an ordinary tool call is summarized later - joining it would duplicate."""
+    messages = [_assistant("Checking the pod now.", "kubectl_describe")]
+
+    output = join_frontend_tool_turn_content("The pod OOMed.", messages, FRONTEND)
+
+    assert output == "The pod OOMed."
+
+
+def test_frontend_tool_without_content_leaves_answer_unchanged():
+    messages = [_assistant("", "SuggestSkills")]
+
+    output = join_frontend_tool_turn_content("The pod OOMed.", messages, FRONTEND)
+
+    assert output == "The pod OOMed."
+
+
+def test_turn_mixing_frontend_and_backend_tools_is_ignored():
+    messages = [_assistant("Partial notes.", "SuggestSkills", "kubectl_describe")]
+
+    output = join_frontend_tool_turn_content("The pod OOMed.", messages, FRONTEND)
+
+    assert output == "The pod OOMed."
+
+
+def test_multiple_frontend_turns_keep_their_order():
+    messages = [
+        _assistant("First finding.", "SuggestSkills"),
+        _assistant("Second finding.", "SuggestSkills"),
+    ]
+
+    output = join_frontend_tool_turn_content("Trailing remark.", messages, FRONTEND)
+
+    assert output.index("First finding.") < output.index("Second finding.")
+    assert output.index("Second finding.") < output.index("Trailing remark.")
+
+
+def test_missing_messages_falls_back_to_final_answer():
+    assert join_frontend_tool_turn_content("The pod OOMed.", None, FRONTEND) == "The pod OOMed."
+    assert join_frontend_tool_turn_content("The pod OOMed.", [], FRONTEND) == "The pod OOMed."
+    assert join_frontend_tool_turn_content("The pod OOMed.", [_assistant("x", "SuggestSkills")], None) == "The pod OOMed."
+    assert join_frontend_tool_turn_content(None, None, FRONTEND) == ""
```

**File**: `tests/llm/utils/skill_suggestions.py` (modified, +38/-0)
```diff
@@ -99,6 +99,44 @@ def count_fetch_skill_calls(tool_calls: Optional[List[Any]]) -> int:
     )
 
 
+def join_frontend_tool_turn_content(
+    final_answer: Optional[str],
+    messages: Optional[List[Dict[str, Any]]],
+    frontend_tool_names: Optional[set],
+) -> str:
+    """Recover an answer the model wrote in the same turn as a frontend tool call.
+
+    Frontend tools break the `LLMResult.result` response: Anthropic models may
+    emit their final answer as content *alongside* the tool call, and since
+    SuggestSkills replies "continue naturally as if this tool was never called"
+    the model then adds only a short trailing remark. `LLMResult.result` keeps
+    just that last turn, so the real answer is lost. The UI renders it correctly
+    (the content goes out as an `ai_message` event, which the frontend collects
+    into `intermediateMessages`), so this is reconstructed eval-side rather than
+    changed in product code.
+
+    Only turns whose tool calls are *all* frontend tools qualify. Content beside
+    an ordinary tool call is mid-investigation narration the model summarizes
+    later, so joining it would duplicate text.
+    """
+    stranded: List[str] = []
+    if messages and frontend_tool_names:
+        for message in messages:
+            if message.get("role") != "assistant":
+                continue
+            content = message.get("content")
+            tool_calls = message.get("tool_calls")
+            if not content or not isinstance(content, str) or not tool_calls:
+                continue
+            names = {
+                (tc.get("function") or {}).get("name") for tc in tool_calls
+            }
+            if names and names <= frontend_tool_names:
+                stranded.append(content)
+
+    return "\n\n".join(stranded + [final_answer or ""]).strip()
+
+
 def write_suggestions_as_skill_files(
     suggestions: List[Dict[str, Any]], target_dir: str
 ) -> List[str]:
```

---

### Incident Patch 9: `b39f2115` (2026-09-14)
**Commit Message**: Anonymize project slug in MCP toolset test fixture (#2463)

<!-- ccr-slack-attribution -->
_Requested by **Natan Yellin** · [Slack
thread](https://robustaco.slack.com/archives/C0ALLBP47T5/p1789166769119379?thread_ts=1789166769.119379&cid=C0ALLBP47T5)_

**Before:** The MCP structured-content tests added in #2459 used a real
org slug — a customer identifier — as the sample CircleCI project slug.
It appeared twice in `tests/test_mcp_toolset.py`: once in the `params`
fixture of `test_null_optional_param_is_dropped`, and once in the
`call_tool` assertion that fixture is checked against. Nothing about the
test needed a real name; it was simply the slug that happened to be in
hand while the behaviour was being reproduced, and it ended up in the
repo's permanent history as a searchable reference to a specific
customer.

**After:** Both occurrences read `gh/example-org/example-repo`, an
obviously fictional placeholder. The test is byte-for-byte the same
otherwise: same fixture, same schema, same assertion, same meaning.
Because the fixture and the assertion were renamed together, the test
still verifies exactly what it did before — that a `None`-valued
optional param is dropped from the out

**File**: `tests/test_mcp_toolset.py` (modified, +2/-2)
```diff
@@ -3525,7 +3525,7 @@ def test_null_optional_param_is_dropped(
             "required": ["projectSlug"],
         }
         params = {
-            "projectSlug": "gh/Twingate/devops",
+            "projectSlug": "gh/example-org/example-repo",
             "branch": None,
             "status": None,
         }
@@ -3537,7 +3537,7 @@ def test_null_optional_param_is_dropped(
         )
 
         mock_session.call_tool.assert_awaited_once_with(
-            "list_runs", {"projectSlug": "gh/Twingate/devops"}
+            "list_runs", {"projectSlug": "gh/example-org/example-repo"}
         )
         # The trace still shows what the model actually asked for.
         assert result.params == params
```

---

### Incident Patch 10: `452b94b3` (2026-09-14)
**Commit Message**: Add configurable request timeout for New Relic toolset (#2457)

## Summary
Adds support for configurable request timeouts in the New Relic toolset,
allowing users to override the default 30-second timeout via the
`timeout_seconds` configuration parameter.

## Changes
- **NewrelicConfig**: Added `timeout_seconds` field (default: 30, must
be > 0) to allow users to configure request timeouts
- **NewRelicToolset**: Added `timeout_seconds` instance variable that
gets populated from config during `prerequisites_callable()`
- **NewRelicAPI**: 
  - Added `timeout_seconds` parameter to `__init__()` 
- Modified `_make_request()` to use configured timeout as fallback when
no explicit timeout is provided
  - Updated docstrings to document the new timeout behavior
- **create_api_client()**: Passes `timeout_seconds` when instantiating
NewRelicAPI
- **Documentation**: Updated `newrelic.md` to document the new
`timeout_seconds` configuration option

## Implementation Details
- The timeout is applied to all HTTP requests made by the NewRelicAPI,
including both the prerequisite health check and tool invocations
- Validation ensures `timeout_seconds` must be positive (> 0) using
Pydantic's `gt` valid

**File**: `docs/data-sources/builtin-toolsets/newrelic.md` (modified, +1/-0)
```diff
@@ -125,6 +125,7 @@ config: |
 | `account_id` | (required) | New Relic account ID (numeric, e.g. `1234567`). |
 | `is_eu_datacenter` | `false` | Set `true` for the EU region. Controls both the API endpoint (`api.eu.newrelic.com`) and the URL used in clickable links in Holmes's responses. |
 | `enable_multi_account` | `false` | Enable cross-account queries. When true, Holmes exposes an additional `newrelic_list_organization_accounts` tool and lets individual NRQL queries override the account ID. |
+| `timeout_seconds` | `30` | Request timeout in seconds for New Relic API calls. Increase it if large NRQL queries time out. |
 
 ## Capabilities
 
```

**File**: `holmes/plugins/toolsets/newrelic/new_relic_api.py` (modified, +14/-5)
```diff
@@ -1,7 +1,7 @@
 """NewRelic API wrapper for executing NRQL queries via GraphQL."""
 
 import logging
-from typing import Any, Dict
+from typing import Any, Dict, Optional
 
 import requests  # type: ignore
 
@@ -15,13 +15,20 @@ class NewRelicAPI:
     supporting both US and EU datacenters.
     """
 
-    def __init__(self, api_key: str, account_id: str, is_eu_datacenter: bool = False):
+    def __init__(
+        self,
+        api_key: str,
+        account_id: str,
+        is_eu_datacenter: bool = False,
+        timeout_seconds: int = 30,
+    ):
         """Initialize the NewRelic API wrapper.
 
         Args:
             api_key: NewRelic API key
             account_id: NewRelic account ID
             is_eu_datacenter: If True, use EU datacenter URL. Defaults to False (US).
+            timeout_seconds: Default request timeout in seconds for API calls.
         """
         self.api_key = api_key
         # Validate account_id is numeric to prevent injection
@@ -30,6 +37,7 @@ def __init__(self, api_key: str, account_id: str, is_eu_datacenter: bool = False
         except ValueError:
             raise ValueError(f"Invalid account_id: must be numeric, got '{account_id}'")
         self.is_eu_datacenter = is_eu_datacenter
+        self.timeout_seconds = timeout_seconds
 
     def _get_api_url(self) -> str:
         """Get the appropriate API URL based on datacenter location.
@@ -42,13 +50,14 @@ def _get_api_url(self) -> str:
         return "https://api.newrelic.com/graphql"
 
     def _make_request(
-        self, graphql_query: Dict[str, Any], timeout: int = 30
+        self, graphql_query: Dict[str, Any], timeout: Optional[int] = None
     ) -> Dict[str, Any]:
         """Make HTTP POST request to NewRelic GraphQL API.
 
         Args:
             graphql_query: The GraphQL query as a dictionary
-            timeout: Request timeout in seconds
+            timeout: Request timeout in seconds; falls back to the configured
+                timeout_seconds when not given
 
         Returns:
             JSON response from the API
@@ -67,7 +76,7 @@ def _make_request(
             url,
             headers=headers,
             json=graphql_query,
-            timeout=timeout,
+            timeout=timeout if timeout is not None else self.timeout_seconds,
         )
         response.raise_for_status()
 
```

**File**: `holmes/plugins/toolsets/newrelic/newrelic.py` (modified, +9/-0)
```diff
@@ -254,6 +254,12 @@ class NewrelicConfig(ToolsetConfig):
         title="Multi-Account Mode",
         description="Enable multi-account support for querying across accounts",
     )
+    timeout_seconds: int = Field(
+        default=30,
+        gt=0,
+        title="Request Timeout",
+        description="Request timeout in seconds for New Relic API calls",
+    )
 
 
 class NewRelicToolset(Toolset):
@@ -263,6 +269,7 @@ class NewRelicToolset(Toolset):
     account_id: Optional[str] = None
     is_eu_datacenter: bool = False
     enable_multi_account: bool = False
+    timeout_seconds: int = 30
 
     @property
     def base_url(self) -> str:
@@ -302,6 +309,7 @@ def create_api_client(
             api_key=self.api_key,
             account_id=effective_account_id,
             is_eu_datacenter=self.is_eu_datacenter,
+            timeout_seconds=self.timeout_seconds,
         )
 
     def __init__(self):
@@ -327,6 +335,7 @@ def prerequisites_callable(
             self.api_key = nr_config.api_key
             self.is_eu_datacenter = nr_config.is_eu_datacenter or False
             self.enable_multi_account = nr_config.enable_multi_account or False
+            self.timeout_seconds = nr_config.timeout_seconds
         except Exception as e:
             logging.exception("Failed to parse New Relic configuration")
             return False, f"Invalid New Relic configuration: {e}"
```

**File**: `tests/plugins/toolsets/newrelic/test_newrelic_timeout.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+"""Config-driven request timeout for the New Relic toolset.
+
+`timeout_seconds` on the toolset config must reach the actual `requests.post`
+call made by NewRelicAPI, both for the prerequisite health check and for tool
+invocations.
+"""
+
+import re
+
+import pytest
+import responses
+from pydantic import ValidationError
+
+from holmes.plugins.toolsets.newrelic.newrelic import NewrelicConfig, NewRelicToolset
+from tests.conftest import create_mock_tool_invoke_context
+
+GRAPHQL = "https://api.newrelic.com/graphql"
+_NRQL_OK = {"data": {"actor": {"account": {"nrql": {"results": [{"count": 1}]}}}}}
+
+
+def _mock(rsps):
+    rsps.add(responses.POST, re.compile(re.escape(GRAPHQL)), json=_NRQL_OK, status=200)
+
+
+def test_default_timeout_used_on_requests():
+    ts = NewRelicToolset()
+    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
+        _mock(rsps)
+        ok, _ = ts.prerequisites_callable({"api_key": "NRAK-1", "account_id": "111"})
+        assert ok is True
+        assert ts.timeout_seconds == 30
+        assert rsps.calls[-1].request.req_kwargs["timeout"] == 30
+
+
+def test_configured_timeout_used_on_requests():
+    ts = NewRelicToolset()
+    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
+        _mock(rsps)
+        ok, _ = ts.prerequisites_callable(
+            {"api_key": "NRAK-1", "account_id": "111", "timeout_seconds": 120}
+        )
+        assert ok is True
+        assert ts.timeout_seconds == 120
+        # Prerequisite health-check request already uses the configured timeout
+        assert rsps.calls[-1].request.req_kwargs["timeout"] == 120
+
+        # And so does a routed tool invocation
+        tool = next(t for t in ts.tools if t.name == "newrelic_execute_nrql_query")
+        before = len(rsps.calls)
+        tool.invoke(
+            {
+                "query": "SELECT count(*) FROM Transaction",
+                "description": "count transactions test",
+                "query_type": "Other",
+            },
+            create_mock_tool_invoke_context(),
+        )
+        assert len(rsps.calls) == before + 1
+        assert rsps.calls[-1].request.req_kwargs["timeout"] == 120
+
+
+def test_non_positive_timeout_rejected():
+    with pytest.raises(ValidationError):
+        NewrelicConfig(api_key="NRAK-1", account_id="111", timeout_seconds=0)
```

---

### Incident Patch 11: `459f4d7a` (2026-09-12)
**Commit Message**: Surface MCP structuredContent and drop null optional params (#2459)

<!-- ccr-slack-attribution -->
_Requested by **arik** · [Slack
thread](https://robustaco.slack.com/archives/C0ALLBP47T5/p1789166769119379?thread_ts=1789166769.119379&cid=C0ALLBP47T5)_

**Before:** Configure the official CircleCI MCP server as an MCP toolset
and ask Holmes about a project's pipelines. The model calls `list_runs`
for a project slug, and the entire tool result it receives is the text
`Found 5 run(s)`. Nothing else. The run ids, outcomes, branches and
commits the server returned are gone, so the model cannot take a single
step further: `get_run`, `list_run_workflows`, `list_workflow_jobs`,
`get_job_logs` and `list_job_tests` all need ids it was never shown. The
investigation dead-ends on the first tool call. Separately, when the
model tries to leave an optional param like `branch` or `status` unset,
the call fails schema validation, and the model starts guessing sentinel
values such as the string `"null"`.

**After:** The same `list_runs` call returns the summary *and* the
`runs[]` payload — ids, `attributes.current_outcome`, branch, commit
revision — so the model can pick the failed run and drill dow

**File**: `holmes/plugins/toolsets/mcp/toolset_mcp.py` (modified, +52/-2)
```diff
@@ -560,6 +560,56 @@ def _extract_text_from_content_block(block: Any) -> str:
             return f"[resource_link {label}: {uri}]" if label else f"[resource_link: {uri}]"
         return ""
 
+    def _strip_omitted_optional_params(self, params: Dict) -> Dict:
+        """Drop optional params the model explicitly set to null.
+
+        The tool schema we hand the LLM declares every optional param as
+        anyOf[<type>, null] and (in strict mode) also lists it in "required",
+        so models signal "leave this out" by sending an explicit null.  MCP
+        servers validate against their own inputSchema, where those params are
+        usually plain non-nullable types, so forwarding the null fails
+        validation and the model falls back to guessing sentinels like the
+        string "null".  Omitting the key is what the model actually meant.
+        """
+        if not params:
+            return params
+        return {
+            key: value
+            for key, value in params.items()
+            if value is not None
+            or (key in self.parameters and self.parameters[key].required)
+        }
+
+    @staticmethod
+    def _merge_result_payload(merged_text: str, structured_content: Any) -> str:
+        """Combine content[] text with CallToolResult.structuredContent.
+
+        A server that declares an outputSchema returns the machine-readable
+        payload in structuredContent and is only *recommended* to also
+        serialize it into a text block.  Many servers (e.g. CircleCI's) put a
+        human summary such as "Found 5 run(s)" in content[] instead, so
+        reading content[] alone hides every id the LLM needs to drill down.
+        """
+        # Per the spec the field is a JSON object or absent; ignore anything else
+        # rather than stringifying it into the model's context.
+        if not isinstance(structured_content, dict) or not structured_content:
+            return merged_text
+        structured_text = json.dumps(structured_content, default=str)
+        if not merged_text or merged_text.strip() == structured_text.strip():
+            return structured_text
+        # The spec only *recommends* that a server also serialize the payload
+        # into a text block, but the servers that do (including the reference
+        # Python SDK, which uses indent=2) pick their own separators and key
+        # order, so an exact string compare misses the common well-behaved case
+        # and doubles the whole payload in the model's context.  Compare the
+        # parsed values instead and keep the compact serialization.
+        try:
+            if json.loads(merged_text) == structured_content:
+                return structured_text
+        except (json.JSONDecodeError, ValueError):
+            pass
+        return f"{merged_text}\n{structured_text}"
+
     async def _invoke_async(
         self,
         params: Dict,
@@ -568,7 +618,7 @@ async def _invoke_async(
         session_approved_prefixes: Optional[List[str]] = None,
     ) -> StructuredToolResult:
         is_remote = self.is_remote
-        call_params = params
+        call_params = self._strip_omitted_optional_params(params)
         if is_remote and user_approved:
             call_params = {**call_params, REMOTE_TOOL_APPROVED_PARAM: True}
         if is_remote and session_approved_prefixes:
@@ -626,7 +676,7 @@ async def _invoke_async(
                 if is_error
                 else StructuredToolResultStatus.SUCCESS
             ),
-            data=merged_text,
+            data=self._merge_result_payload(merged_text, tool_result.structuredContent),
             images=images,
             params=params,
             invocation=f"MCPtool {self.name} with params {params}",
```

**File**: `tests/test_mcp_toolset.py` (modified, +265/-0)
```diff
@@ -1,6 +1,7 @@
 import asyncio
 import base64 as _b64
 import copy
+import json
 import logging
 import shutil
 import subprocess
@@ -3296,3 +3297,267 @@ async def mock_call_health_check(tool_name):
 
         ok, _ = toolset.prerequisites_callable(config=toolset.config)
         assert ok is True
+
+
+class TestMCPStructuredContent:
+    """CallToolResult.structuredContent must reach the LLM.
+
+    Reproduces the CircleCI MCP list_runs bug: the server puts a human summary
+    ("Found 5 run(s)") in content[] and the machine-readable runs[] — including
+    the ids every drill-down needs — in structuredContent.  Reading content[]
+    alone left the model with nothing to act on.
+    """
+
+    def _setup_mocks(self, mock_session):
+        mock_read_stream = AsyncMock()
+        mock_write_stream = AsyncMock()
+
+        mock_client_context = AsyncMock()
+        mock_client_context.__aenter__ = AsyncMock(
+            return_value=(mock_read_stream, mock_write_stream, None)
+        )
+        mock_client_context.__aexit__ = AsyncMock(return_value=None)
+
+        mock_session_context = AsyncMock()
+        mock_session_context.__aenter__ = AsyncMock(return_value=mock_session)
+        mock_session_context.__aexit__ = AsyncMock(return_value=None)
+
+        return mock_client_context, mock_session_context
+
+    def _patch_clients(self, mock_client_context, mock_session_context):
+        return patch(
+            "holmes.plugins.toolsets.mcp.toolset_mcp.streamablehttp_client",
+            return_value=mock_client_context,
+        ), patch(
+            "holmes.plugins.toolsets.mcp.toolset_mcp.ClientSession",
+            return_value=mock_session_context,
+        )
+
+    def _make_mcp_tool(self, monkeypatch, input_schema=None):
+        tool = Tool(
+            name="list_runs",
+            inputSchema=input_schema
+            or {"type": "object", "properties": {}, "required": []},
+            description="List pipeline runs",
+        )
+        toolset = RemoteMCPToolset(
+            name="test_toolset",
+            description="Test toolset",
+            config={
+                "url": "http://localhost:1234/mcp/messages",
+                "mode": "streamable-http",
+            },
+        )
+
+        async def mock_get_server_tools():
+            return ListToolsResult(tools=[])
+
+        monkeypatch.setattr(toolset, "_get_server_tools", mock_get_server_tools)
+        toolset.prerequisites_callable(config=toolset.config)
+        return RemoteMCPTool.create(tool, toolset)
+
+    def _run_invoke(
+        self,
+        monkeypatch,
+        content_blocks,
+        structured_content=None,
+        params=None,
+        input_schema=None,
+    ):
+        """Invoke the tool against a mocked session, returning (result, session)."""
+        mcp_tool = self._make_mcp_tool(monkeypatch, input_schema)
+        mock_session = AsyncMock()
+        mock_session.initialize = AsyncMock(return_value=None)
+        mock_session.call_tool = AsyncMock(
+            return_value=CallToolResult(
+                content=content_blocks,
+                structuredContent=structured_content,
+                isError=False,
+            )
+        )
+        mock_client_context, mock_session_context = self._setup_mocks(mock_session)
+        client_patch, session_patch = self._patch_clients(
+            mock_client_context, mock_session_context
+        )
+        with client_patch, session_patch:
+            result = asyncio.run(mcp_tool._invoke_async(params or {}, None))
+        return result, mock_session
+
+    def test_structured_content_reaches_the_llm(
+        self, monkeypatch, suppress_migration_warnings
+    ):
+        """The ids in structuredContent must survive into result.data."""
+        structured = {
+            "runs": [
+                {
+                    "id": "0196f1f0-0000-4000-8000-000000000001",
+                    "attributes": {"current_outcome": "failed"},
+                },
+                {
+                    "id": "0196f1f0-0000-4000-8000-000000000002",
+                    "attributes": {"current_outcome": "success"},
+                },
+            ]
+        }
+        result, _ = self._run_invoke(
+            monkeypatch,
+            [TextContent(type="text", text="Found 5 run(s)")],
+            structured_content=structured,
+        )
+
+        assert result.status == StructuredToolResultStatus.SUCCESS
+        # The human summary is kept, but it is no longer the whole story.
+        assert "Found 5 run(s)" in result.data
+        assert "0196f1f0-0000-4000-8000-000000000001" in result.data
+        assert "current_outcome" in result.data
+
+    def test_no_structured_content_is_unchanged(
+        self, monkeypatch, suppress_migration_warnings
+    ):
+        """Servers that return no structuredContent must behave exactly as before."""
+        result, _ = self._run_invoke(
+            monkeypatch,
+            [TextContent(type="text", te
```

---

### Incident Patch 12: `92e2e4bb` (2026-09-09)
**Commit Message**: Add conversation_link chat field rendered into the system prompt (#2422)

## What

Holmes chats carry a `conversation_link` — the URL of the surface the
chat originated from (Slack thread permalink, Teams message deep link,
platform chat/workflow-run URL). Holmes renders it into its system
prompt with an instruction to include the link in any PR/MR/issue it
creates, so AI-generated artifacts trace back to the originating
conversation.

- `holmes/core/models.py` — `conversation_link` on
`ChatRequestBaseModel`.
- `holmes/plugins/prompts/generic_ask.jinja2` — `CONVERSATION_LINK`
prompt component + "# Originating conversation" block.
- `holmes/core/conversation_links.py` — all link policy in one file:
derivation, sanitization, origin allowlist.
- Plumbed through `server.py` `/api/chat`,
`holmes/core/conversations.py`, and
`holmes/core/conversations_worker/worker.py`. The worker reads it from
Conversations metadata only (where relay stamps workflow/triage links);
per-turn event values are ignored, since nothing legitimately sends the
field per-event. Sibling conversation-level fields resolve through one
shared `from_event_or_conversation` helper.

## Server-side derivation for platform 

**File**: `holmes/core/conversation_links.py` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+from typing import Optional
+from urllib.parse import quote, urlparse
+
+from holmes.common.env_vars import ROBUSTA_UI_DOMAIN
+
+# The request_source of an interactive Ask Holmes chat started in the platform
+# UI — the only conversation kind with a /holmes/chat page to link back to.
+FREEFORM_CHAT_REQUEST_SOURCE = "freeform"
+
+
+def derive_freeform_chat_link(
+    request_source: Optional[str],
+    conversation_id: Optional[str],
+    account_id: Optional[str],
+) -> Optional[str]:
+    """Server-derived platform URL of a freeform Ask Holmes chat.
+
+    Built account-less with an ``?account_id=`` hint (the SPA's account guard
+    resolves it into the account's route), so it needs nothing beyond what the
+    server already knows — no client-supplied value can pick the destination.
+    Relay's UI-link builders emit the other canonical shape for the same page,
+    ``/<account_name>/holmes/chat/<id>``, because relay can resolve the account
+    name; both route to the same chat, so don't "unify" one onto the other.
+    """
+    if request_source != FREEFORM_CHAT_REQUEST_SOURCE:
+        return None
+    if not conversation_id or not account_id:
+        return None
+    base = (ROBUSTA_UI_DOMAIN or "").rstrip("/")
+    if not base:
+        return None
+    return (
+        f"{base}/holmes/chat/{quote(str(conversation_id), safe='')}"
+        f"?account_id={quote(str(account_id), safe='')}"
+    )
+
+
+def resolve_conversation_link(
+    request_source: Optional[str],
+    conversation_id: Optional[str],
+    account_id: Optional[str],
+    supplied_link: Optional[str],
+) -> Optional[str]:
+    """The conversation_link a chat actually gets.
+
+    Freeform platform chats use only the server-derived link — when derivation
+    isn't possible they get none, never the client-suppliable value, so a
+    freeform link's destination can't be picked by the client. Every other
+    surface (Slack, Teams, triggered workflows, alert triage) passes through
+    the link its server built upstream.
+    """
+    if request_source == FREEFORM_CHAT_REQUEST_SOURCE:
+        return derive_freeform_chat_link(request_source, conversation_id, account_id)
+    return supplied_link
+
+
+MAX_CONVERSATION_LINK_LENGTH = 2048
+
+
+def _is_allowed_conversation_link_origin(scheme: str, host: str) -> bool:
+    # The deployment's own UI (covers self-hosted instances, http included).
+    ui = urlparse(ROBUSTA_UI_DOMAIN or "")
+    if scheme == ui.scheme and host == (ui.hostname or "").lower():
+        return True
+    if scheme != "https":
+        return False
+    # Robusta platform in any region, Slack permalinks, Teams deep links —
+    # the only surfaces that originate conversations. Slack permalinks always
+    # live on a workspace subdomain, so apex slack.com is deliberately absent.
+    return (
+        host == "robusta.dev"
+        or host.endswith(".robusta.dev")
+        or host.endswith(".slack.com")
+        or host == "teams.microsoft.com"
+    )
+
+
+def sanitize_conversation_link(link: Optional[str]) -> Optional[str]:
+    """Drop any conversation_link that isn't a well-formed URL to a surface
+    conversations actually originate from.
+
+    The value is client-suppliable (REST body, Conversations metadata) and is
+    rendered verbatim into the system prompt with an instruction to copy it
+    into PR/issue descriptions — so both the text shape AND the destination
+    must be server-controlled: no whitespace/control-character/length games
+    (prompt injection), and no arbitrary hosts (a tracking or phishing URL
+    laundered into public artifacts). All server-built links (Slack permalinks,
+    Teams deep links, platform UI URLs, derive_freeform_chat_link's output)
+    pass this check.
+    """
+    if not link:
+        return None
+    if len(link) > MAX_CONVERSATION_LINK_LENGTH or any(
+        ch.isspace() or not ch.isprintable() for ch in link
+    ):
+        return None
+    parsed = urlparse(link)
+    if parsed.scheme not in ("http", "https") or not parsed.hostname:
+        return None
+    host = parsed.hostname.lower()
+    if host.startswith(".") or not _is_allowed_conversation_link_origin(
+        parsed.scheme, host
+    ):
+        return None
+    return link
```

**File**: `holmes/core/conversations.py` (modified, +2/-0)
```diff
@@ -53,6 +53,7 @@ def build_chat_messages(
     skills: Optional[SkillCatalog] = None,
     images: Optional[List[Union[str, Dict[str, Any]]]] = None,
     prompt_component_overrides: Optional[Dict[PromptComponent, bool]] = None,
+    conversation_link: Optional[str] = None,
 ) -> List[dict]:
     """Build messages for general chat conversation.
 
@@ -77,6 +78,7 @@ def build_chat_messages(
         include_todowrite_reminder=False,
         images=images,
         prompt_component_overrides=prompt_component_overrides,
+        conversation_link=conversation_link,
     )
 
     if not conversation_history:
```

**File**: `holmes/core/conversations_worker/worker.py` (modified, +32/-32)
```diff
@@ -32,6 +32,7 @@
 from holmes.core.conversations_worker.realtime_manager import RealtimeWorker
 from holmes.core.conversations_worker.tool_call_worker import ToolCallWorker
 from holmes.core.models import ChatRequest
+from holmes.core.conversation_links import resolve_conversation_link
 from holmes.core.supabase_dal import SupabaseDnsException
 from postgrest.exceptions import APIError as PGAPIError
 from holmes.core.prompt import PromptComponent
@@ -917,38 +918,35 @@ def _process_conversation(self, task: ConversationTask) -> None:
         )
         if not oauth_enabled:
             resolved_user_id = None
-        # Per-event presence wins, not truthiness — so an explicit empty
-        # value from the FE (e.g. "" to deliberately clear a field) keeps
-        # priority over the row-level metadata fallback and we don't
-        # reintroduce stale Conversation-row values. Only fall back to
-        # task.metadata when the per-turn event omits the key entirely.
-        resolved_user_email = (
-            data["user_email"]
-            if "user_email" in data
-            else (task.metadata.get("user_email") if task.metadata else None)
-        )
-        resolved_request_source = (
-            data["request_source"]
-            if "request_source" in data
-            else (task.metadata.get("request_source") if task.metadata else None)
-        )
-        # source_ref is conversation-level for alert investigations (the
-        # whole chat is about one alert id), so the FE puts it on the
-        # Conversations row's metadata, not in each per-turn event.
-        resolved_source_ref = (
-            data["source_ref"]
-            if "source_ref" in data
-            else (task.metadata.get("source_ref") if task.metadata else None)
-        )
-        # request_type may also live under Conversations.metadata when the
-        # FE classifies a whole chat once at creation time. Same key-presence
-        # semantics — leaving the resolved value None when neither source
-        # supplies it preserves build_chat_recorder_state's auto-detection
-        # (Slack-prefix → 'slack_chat', fallback → 'user_chat').
-        resolved_request_type = (
-            data["request_type"]
-            if "request_type" in data
-            else (task.metadata.get("request_type") if task.metadata else None)
+        def from_event_or_conversation(key: str) -> Any:
+            # Per-event presence wins, not truthiness — so an explicit empty
+            # value from the FE (e.g. "" to deliberately clear a field) keeps
+            # priority over the row-level metadata fallback and we don't
+            # reintroduce stale Conversation-row values. Only fall back to
+            # task.metadata when the per-turn event omits the key entirely.
+            if key in data:
+                return data[key]
+            return task.metadata.get(key) if task.metadata else None
+
+        resolved_user_email = from_event_or_conversation("user_email")
+        resolved_request_source = from_event_or_conversation("request_source")
+        # source_ref, request_type, and conversation_link are conversation-level
+        # (one alert id / one creation-time classification / one originating
+        # surface per chat), so the FE may put them on the Conversations row's
+        # metadata instead of each per-turn event. A resolved None for
+        # request_type still lets build_chat_recorder_state's auto-detection
+        # run (Slack-prefix → 'slack_chat', fallback → 'user_chat').
+        resolved_source_ref = from_event_or_conversation("source_ref")
+        resolved_request_type = from_event_or_conversation("request_type")
+        # Unlike its sibling fields, conversation_link deliberately ignores
+        # per-turn events: nothing legitimately sends it per-event, so honoring
+        # one would only let a client override the link relay stamped onto the
+        # Conversations metadata (triggered workflows, alert triage).
+        resolved_conversation_link = resolve_conversation_link(
+            resolved_request_source,
+            task.conversation_id,
+            task.account_id,
+            task.metadata.get("conversation_link") if task.metadata else None,
         )
 
         chat_request = ChatRequest(
@@ -978,6 +976,7 @@ def _process_conversation(self, task: ConversationTask) -> None:
             source_ref=resolved_source_ref,
             conversation_id=task.conversation_id,
             conversation_source="conversations",
+            conversation_link=resolved_conversation_link,
             meta=data.get("meta"),
             is_internal=data.get("is_internal"),
         )
@@ -1170,6 +1169,7 @@ def _run_chat_and_publish(
                     skills=skills,
                     images=chat_request.images,
                     prompt_component_overrides=prompt_component_overrides,
+                    conversation_link=chat_request.conversation_link,
                 )
 
             # Wri
```

**File**: `holmes/core/models.py` (modified, +11/-0)
```diff
@@ -260,6 +260,17 @@ class ChatRequestBaseModel(BaseModel):
             "conversation_id is non-NULL and not already set."
         ),
     )
+    conversation_link: Optional[str] = Field(
+        default=None,
+        description=(
+            "URL of the surface where this request originated: a Slack thread "
+            "permalink, an MS Teams message link, a platform Ask Holmes chat URL, "
+            "or a triggered-workflow run URL. Unlike the analytics-only fields "
+            "above, this IS rendered into the system prompt so that artifacts "
+            "Holmes creates outside the conversation (pull requests, issues) can "
+            "link back to the request that initiated them."
+        ),
+    )
     meta: Optional[Dict[str, Any]] = Field(
         default=None,
         description=(
```

**File**: `holmes/core/prompt.py` (modified, +8/-0)
```diff
@@ -3,6 +3,7 @@
 from pathlib import Path
 from typing import Any, Dict, List, Optional, Tuple, Union
 
+from holmes.core.conversation_links import sanitize_conversation_link
 from holmes.plugins.prompts import load_and_render_prompt
 from holmes.plugins.skills.skill_loader import SkillCatalog
 from holmes.utils.global_instructions import Instructions, generate_skills_args
@@ -23,6 +24,7 @@ class PromptComponent(str, Enum):
     GENERAL_INSTRUCTIONS = "general_instructions"
     STYLE_GUIDE = "style_guide"
     CLUSTER_NAME = "cluster_name"
+    CONVERSATION_LINK = "conversation_link"
     SYSTEM_PROMPT_ADDITIONS = "system_prompt_additions"
 
 
@@ -180,6 +182,7 @@ def build_system_prompt(
     cluster_name: Optional[str],
     ask_user_enabled: bool,
     prompt_component_overrides: Dict[PromptComponent, bool],
+    conversation_link: Optional[str] = None,
 ) -> Optional[str]:
     """
     Build the system prompt for both CLI and server modes.
@@ -207,6 +210,9 @@ def is_enabled(component: PromptComponent) -> bool:
         "cluster_name": cluster_name
         if is_enabled(PromptComponent.CLUSTER_NAME)
         else None,
+        "conversation_link": sanitize_conversation_link(conversation_link)
+        if is_enabled(PromptComponent.CONVERSATION_LINK)
+        else None,
         "toolsets": toolsets if toolset_instructions_enabled else [],
         "system_prompt_additions": system_prompt_additions
         if is_enabled(PromptComponent.SYSTEM_PROMPT_ADDITIONS)
@@ -268,6 +274,7 @@ def build_prompts(
     include_todowrite_reminder: bool,
     images: Optional[List[Union[str, Dict[str, Any]]]],
     prompt_component_overrides: Optional[Dict[PromptComponent, bool]] = None,
+    conversation_link: Optional[str] = None,
 ) -> Tuple[Optional[str], UserPromptContent]:
     """Build both system and user prompts."""
     if prompt_component_overrides is None:
@@ -280,6 +287,7 @@ def build_prompts(
         cluster_name=cluster_name,
         ask_user_enabled=ask_user_enabled,
         prompt_component_overrides=prompt_component_overrides,
+        conversation_link=conversation_link,
     )
     user_content = build_user_prompt(
         user_prompt=user_prompt,
```

**File**: `holmes/plugins/prompts/generic_ask.jinja2` (modified, +8/-0)
```diff
@@ -103,6 +103,14 @@ Relevant logs:
 Validation error led to an unhandled exception causing a crash.
 {% endif %}
 
+{% if conversation_link %}
+# Originating conversation
+
+This request originated from a conversation at {{ conversation_link }}
+
+Whenever you create an artifact outside this conversation that has a description — a pull request, merge request, issue, or ticket — include that link in its description (for example, end the description with "Requested via {{ conversation_link }}") so readers can trace it back to the original request.
+{% endif %}
+
 {% if system_prompt_additions %}
 {{ system_prompt_additions }}
 {% endif %}
```

**File**: `server.py` (modified, +7/-0)
```diff
@@ -53,6 +53,7 @@
 )
 from holmes.config import DEFAULT_CONFIG_LOCATION, Config
 from holmes.core.llm import MODEL_LIST_FILE_LOCATION
+from holmes.core.conversation_links import resolve_conversation_link
 from holmes.core.conversations import (
     build_chat_messages,
 )
@@ -658,6 +659,12 @@ def chat(chat_request: ChatRequest, http_request: Request):
                 skills=skills,
                 images=chat_request.images,
                 prompt_component_overrides=prompt_component_overrides,
+                conversation_link=resolve_conversation_link(
+                    chat_request.request_source,
+                    chat_request.conversation_id,
+                    dal.account_id,
+                    chat_request.conversation_link,
+                ),
             )
 
         try:
```

**File**: `tests/core/conversations_worker/test_worker_usage_recorder.py` (modified, +82/-0)
```diff
@@ -384,3 +384,85 @@ def test_slack_prefix_in_event_ask_routes_to_slack_chat_via_helper():
     assert cr.ask.startswith("**@user_U0AKMP2CZ97**")
     # And request_type is None so the helper's auto-detect runs.
     assert cr.request_type is None
+
+
+def test_conversation_link_read_from_conversations_metadata():
+    # conversation_link is conversation-level: the surface a chat originated
+    # from (Slack thread, Teams message, workflow run) does not change between
+    # turns, so relay stamps it once on the Conversations row's metadata.
+    task = ConversationTask(
+        conversation_id="c1",
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=1,
+        metadata={"conversation_link": "https://acme.slack.com/archives/C1/p123"},
+    )
+    cr = _capture_chat_request_from_process(task, {"ask": "follow-up?"})
+    assert cr is not None
+    assert cr.conversation_link == "https://acme.slack.com/archives/C1/p123"
+
+
+def test_freeform_chat_conversation_link_is_server_derived(monkeypatch):
+    # For freeform platform chats the worker derives the link itself from the
+    # task's own ids — a client-writable metadata value must not pick the
+    # destination.
+    monkeypatch.setattr(
+        "holmes.core.conversation_links.ROBUSTA_UI_DOMAIN",
+        "https://platform.robusta.dev",
+    )
+    task = ConversationTask(
+        conversation_id="c1",
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=1,
+        metadata={
+            "request_source": "freeform",
+            "conversation_link": "https://evil.example/spoof",
+        },
+    )
+    cr = _capture_chat_request_from_process(task, {"ask": "q"})
+    assert cr is not None
+    assert cr.conversation_link == (
+        "https://platform.robusta.dev/holmes/chat/c1?account_id=a1"
+    )
+
+
+def test_freeform_chat_gets_no_link_when_derivation_fails(monkeypatch):
+    # A freeform chat's link is server-derived or nothing: when derivation
+    # can't run (here: no UI domain configured), the client-writable metadata
+    # value must not slip in as a fallback.
+    monkeypatch.setattr("holmes.core.conversation_links.ROBUSTA_UI_DOMAIN", "")
+    task = ConversationTask(
+        conversation_id="c1",
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=1,
+        metadata={
+            "request_source": "freeform",
+            "conversation_link": "https://acme.slack.com/archives/C1/p123",
+        },
+    )
+    cr = _capture_chat_request_from_process(task, {"ask": "q"})
+    assert cr is not None
+    assert cr.conversation_link is None
+
+
+def test_event_conversation_link_is_ignored():
+    # Only relay legitimately sets this key, and it stamps metadata — a
+    # per-turn event value is a client-side override attempt and is ignored.
+    task = ConversationTask(
+        conversation_id="c1",
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=1,
+        metadata={"conversation_link": "https://acme.slack.com/archives/C1/p123"},
+    )
+    cr = _capture_chat_request_from_process(
+        task, {"ask": "q", "conversation_link": "https://evil.example/override"}
+    )
+    assert cr is not None
+    assert cr.conversation_link == "https://acme.slack.com/archives/C1/p123"
```

---

### Incident Patch 13: `fd8dd5e0` (2026-08-24)
**Commit Message**: ROB-1158 Gracefully retire in-flight conversations on shutdown (#2404)

## Summary

When Holmes receives a SIGTERM signal (during rollouts, node drains, or
scale-downs), conversations that are mid-turn are now properly retired
instead of being left in a 'running' state indefinitely. Previously,
these conversations would remain 'running' with a dead assignee until
the pg_cron stale sweep cleaned them up hours later, causing spinners in
the UI.

## Key Changes

- **New `_ActiveTask` class**: Wraps a `ConversationTask` with its
monotonic start time, replacing the previous simple float values in
`_active_conversation_ids`. This allows the shutdown path to access both
the task details (conversation_id, request_sequence) needed for database
updates and the timing information used for saturation/stuck-slot
logging.

- **Shutdown retirement logic**: Added `_timeout_active_conversations()`
and `_timeout_conversation()` methods to `ConversationWorker` that:
- Post an error event with reason "Holmes Restarted" to inform users the
request was interrupted
- Transition conversations to 'timeout' status (with fallback to
'failed' for un-migrated databases)
- Handle reassignment races gracefully (

**File**: `holmes/core/conversations_worker/models.py` (modified, +15/-2)
```diff
@@ -13,11 +13,24 @@ class ConversationStatus(str, Enum):
     COMPLETED = "completed"
     FAILED = "failed"
     STOPPED = "stopped"
+    # Written by the pg_cron stale sweep, and by the worker itself for
+    # conversations still in flight when Holmes shuts down.
+    TIMEOUT = "timeout"
 
     @classmethod
     def updatable_values(cls) -> tuple:
-        """Statuses accepted by ``update_conversation_status`` (QUEUED kept for compat)."""
-        return (cls.QUEUED.value, cls.RUNNING.value, cls.COMPLETED.value, cls.FAILED.value)
+        """Statuses accepted by ``update_conversation_status`` (QUEUED kept for compat).
+
+        TIMEOUT requires robusta-storage migration 20260817121606, which is
+        applied before this ships.
+        """
+        return (
+            cls.QUEUED.value,
+            cls.RUNNING.value,
+            cls.COMPLETED.value,
+            cls.FAILED.value,
+            cls.TIMEOUT.value,
+        )
 
 
 class RemoteToolCallStatus(str, Enum):
```

**File**: `holmes/core/conversations_worker/worker.py` (modified, +138/-7)
```diff
@@ -77,6 +77,45 @@
 #    repeats at most this often.
 _STUCK_WARN_RATE_LIMIT_SECONDS = 300.0
 
+# Shutdown handling. When the pod is asked to stop (SIGTERM from a rollout,
+# node drain, scale-down), whatever conversations we are mid-turn on are never
+# going to finish: the executor is not drained, the threads are daemons, and
+# nothing else picks the row back up (the claim RPCs only take 'pending').
+# Before this, the row simply stayed 'running' with our now-dead assignee until
+# the pg_cron stale sweep retired it hours later — a spinner in the UI the whole
+# time. We now retire them ourselves: an error event carrying the reason below,
+# then status 'timeout'.
+SHUTDOWN_REASON = "Holmes Restarted"
+SHUTDOWN_ERROR_DESCRIPTION = (
+    f"{SHUTDOWN_REASON} — this request was interrupted before it finished. "
+    "Ask again to retry."
+)
+# Distinct from the generic 5000 so this is greppable and the FE can special-case
+# it later; unmapped codes render `description` as-is today.
+SHUTDOWN_ERROR_CODE = 5205
+# Wall-clock budget for the whole retirement sweep. It is sequential and each
+# row costs up to two DAL calls, each retrying 3 times with backoff, so a slow
+# or unreachable Supabase could otherwise eat the container's termination grace
+# period and earn us a SIGKILL — leaving the remaining rows 'running', the very
+# thing this is here to prevent. Rows we don't reach fall back to the pg_cron
+# stale sweep, exactly as they did before.
+SHUTDOWN_RETIRE_BUDGET_SECONDS = 10.0
+
+
+class _ActiveTask:
+    """An in-flight conversation: the task itself plus when it took its slot.
+
+    ``started`` is ``time.monotonic()`` and feeds the saturation/stuck-slot
+    logging; ``task`` is kept so the shutdown path can address the row (it
+    needs conversation_id + request_sequence, which the dict key alone no
+    longer suffices for once we have to write to the DB).
+    """
+
+    __slots__ = ("task", "started")
+
+    def __init__(self, task: "ConversationTask", started: float):
+        self.task = task
+        self.started = started
 
 
 class ConversationWorker:
@@ -116,7 +155,7 @@ def __init__(
         # conversation are counted separately for capacity. The value is the
         # monotonic start time, so the claim loop can report how long each
         # in-flight task has been holding a slot (ROB-759).
-        self._active_conversation_ids: Dict[Any, float] = {}
+        self._active_conversation_ids: Dict[Any, _ActiveTask] = {}
         self._active_lock = threading.Lock()
 
         # Saturation-transition logging state (ROB-759). _saturated_since is
@@ -249,6 +288,19 @@ def stop(self) -> None:
         self._running = False
         self._notify_event.set()
         self._realtime_verify_stop.set()
+        # Retire whatever we're mid-turn on before tearing the pool down. Must
+        # happen while the rows still carry our assignee and 'running' status —
+        # both RPCs guard on that. Flipping the status also makes any straggler
+        # write from the in-flight thread fail with MISMATCH, which the
+        # publisher already handles as ConversationReassignedError, so the
+        # abandoned turn unwinds quietly instead of racing us.
+        try:
+            self._timeout_active_conversations()
+        except Exception:
+            logging.exception(
+                "Failed to retire in-flight conversations during shutdown",
+                exc_info=True,
+            )
         try:
             self._tool_call_worker.stop()
         except Exception:
@@ -489,8 +541,8 @@ def _note_saturation(self) -> None:
             self._saturation_logged = True
             with self._active_lock:
                 ages = sorted(
-                    (round(now - started, 1), key)
-                    for key, started in self._active_conversation_ids.items()
+                    (round(now - entry.started, 1), key)
+                    for key, entry in self._active_conversation_ids.items()
                 )
             logging.info(
                 "Conversation claim capacity saturated for %.0fs: all %d slots "
@@ -507,9 +559,10 @@ def _note_saturation(self) -> None:
         ):
             with self._active_lock:
                 stuck = sorted(
-                    (round(now - started, 1), key)
-                    for key, started in self._active_conversation_ids.items()
-                    if now - started >= CONVERSATION_WORKER_SLOT_STUCK_WARN_SECONDS
+                    (round(now - entry.started, 1), key)
+                    for key, entry in self._active_conversation_ids.items()
+                    if now - entry.started
+                    >= CONVERSATION_WORKER_SLOT_STUCK_WARN_SECONDS
                 )
             if stuck:
                 self._last_stuck_warn = now
@@ -596,7 +649,9 @@ def _dispatch(self, task: ConversationTask) -> None:
             if not self._running or self._executor is None:
                 return
             with self._active_lock:
- 
```

**File**: `server.py` (modified, +24/-0)
```diff
@@ -802,6 +802,30 @@ def chat(chat_request: ChatRequest, http_request: Request):
     )
 
 
+@app.on_event("shutdown")
+def stop_conversation_worker():
+    """Retire in-flight conversations before the process goes away.
+
+    uvicorn turns SIGTERM (rollout, node drain, scale-down, `docker stop`) into
+    a graceful shutdown, which runs this hook. Without it nothing ever called
+    ConversationWorker.stop(): the worker threads are daemons, so they were
+    simply frozen at interpreter exit and every conversation the pod was
+    mid-turn on stayed 'running' with a dead assignee until the stale-conversation
+    sweep retired it — up to hours of spinner in the UI. stop() now marks those
+    rows 'timeout' with a "Holmes Restarted" error event first.
+
+    Declared as a sync def on purpose: Starlette runs it in a threadpool, and
+    the body is blocking (Supabase writes plus bounded thread joins). SIGKILL /
+    OOM kill still bypass all of this — the pg_cron sweep stays the backstop.
+    """
+    if conversation_worker is None:
+        return
+    try:
+        conversation_worker.stop()
+    except Exception:
+        logging.error("Failed to stop conversation worker", exc_info=True)
+
+
 @app.get("/api/model")
 def get_model():
     return {"model_name": json.dumps(config.get_models_list())}
```

**File**: `tests/core/conversations_worker/test_worker_lifecycle.py` (modified, +191/-7)
```diff
@@ -10,7 +10,12 @@
     ConversationReassignedError,
     ConversationTask,
 )
-from holmes.core.conversations_worker.worker import ConversationWorker
+from holmes.core.conversations_worker.worker import (
+    SHUTDOWN_ERROR_CODE,
+    SHUTDOWN_REASON,
+    ConversationWorker,
+    _ActiveTask,
+)
 
 
 def _bare_worker():
@@ -37,6 +42,18 @@ def _bare_worker():
     return w
 
 
+def _slot(started: float, conversation_id="c-slot", request_sequence=1):
+    """An occupied executor slot, as _dispatch records it."""
+    task = ConversationTask(
+        conversation_id=conversation_id,
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=request_sequence,
+    )
+    return _ActiveTask(task, started)
+
+
 def test_build_task_from_conversation_row_parses_required_fields():
     w = _bare_worker()
     row = {
@@ -130,7 +147,7 @@ def test_try_claim_and_dispatch_passes_remaining_capacity_as_limit(monkeypatch):
     )
     # Two conversations already running -> only 3 free slots remain
     # (free = MAX_CONCURRENT - active; there is no longer a local queue).
-    w._active_conversation_ids = {"existing1": 0.0, "existing2": 0.0}
+    w._active_conversation_ids = {"existing1": _slot(0.0), "existing2": _slot(0.0)}
     w.dal.claim_n_pending_conversations.return_value = []
     w._try_claim_and_dispatch()
     w.dal.claim_n_pending_conversations.assert_called_once_with("h-test", 3)
@@ -145,7 +162,7 @@ def test_try_claim_and_dispatch_skips_claim_when_at_capacity(monkeypatch):
         1,
     )
     # Already have one active conversation -> zero free slots.
-    w._active_conversation_ids = {"existing": 0.0}
+    w._active_conversation_ids = {"existing": _slot(0.0)}
     w._try_claim_and_dispatch()
     # No claim RPC is issued at all when there is no free capacity.
     w.dal.claim_n_pending_conversations.assert_not_called()
@@ -162,7 +179,7 @@ def test_saturation_logs_only_after_continuous_window(monkeypatch, caplog):
         "holmes.core.conversations_worker.worker.CONVERSATION_WORKER_MAX_CONCURRENT",
         1,
     )
-    w._active_conversation_ids = {("conv-busy", 1): time.monotonic()}
+    w._active_conversation_ids = {("conv-busy", 1): _slot(time.monotonic())}
 
     def saturation_lines():
         return [
@@ -215,7 +232,7 @@ def test_brief_free_slot_resets_saturation_clock(monkeypatch, caplog):
 
     with caplog.at_level(logging.INFO):
         # Saturated, clock nearly expired.
-        w._active_conversation_ids = {("conv-a", 1): time.monotonic()}
+        w._active_conversation_ids = {("conv-a", 1): _slot(time.monotonic())}
         w._try_claim_and_dispatch()
         w._saturated_since = time.monotonic() - 59.0
 
@@ -226,7 +243,7 @@ def test_brief_free_slot_resets_saturation_clock(monkeypatch, caplog):
 
         # Saturated again: window starts over, so no log even though the
         # combined saturated time exceeds the threshold.
-        w._active_conversation_ids = {("conv-b", 1): time.monotonic()}
+        w._active_conversation_ids = {("conv-b", 1): _slot(time.monotonic())}
         w._try_claim_and_dispatch()
     assert not [
         r for r in caplog.records if "claim capacity" in r.getMessage()
@@ -245,7 +262,7 @@ def test_stuck_slot_emits_warning(monkeypatch, caplog):
         "holmes.core.conversations_worker.worker.CONVERSATION_WORKER_SLOT_STUCK_WARN_SECONDS",
         100.0,
     )
-    w._active_conversation_ids = {("conv-stuck", 1): time.monotonic() - 150.0}
+    w._active_conversation_ids = {("conv-stuck", 1): _slot(time.monotonic() - 150.0)}
     w._saturated_since = time.monotonic() - 10.0  # saturation ongoing
 
     def stuck_warnings():
@@ -914,3 +931,170 @@ def test_realtime_verify_loop_surfaces_non_transient_exception(caplog):
         if r.levelno == logging.ERROR and "not retrying" in r.getMessage()
     ]
     assert errors, "non-transient defect must be logged at ERROR"
+
+
+# ---------------------------------------------------------------------------
+# Shutdown: retire in-flight conversations ("Holmes Restarted")
+# ---------------------------------------------------------------------------
+
+
+def _active(w, conversation_id="c1", request_sequence=1):
+    """Register an in-flight conversation the way _dispatch does."""
+    task = ConversationTask(
+        conversation_id=conversation_id,
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=request_sequence,
+    )
+    w._active_conversation_ids[task.active_key] = _ActiveTask(task, time.monotonic())
+    return task
+
+
+def test_timeout_active_conversations_posts_reason_then_sets_timeout():
+    w = _bare_worker()
+    _active(w, "c1", 2)
+
+    w._timeout_active_conversations()
+
+    # The error event must carry the reason and be posted while the row is
+    # still 'running' — i.e. before the status flip.
+    w.dal.post_conversation_events.assert_called_once()
+    kwargs = w.dal.post_conversation_events.call
```

---

### Incident Patch 14: `9d3069fd` (2026-08-23)
**Commit Message**: Require an allowlist before tcp_check probes private networks (ROB-1114) (#2402)

## ⚠️ Breaking change — read this first

**Deployments that probe in-cluster services without configuration will
start getting refused.**

`tcp_check` against a private/RFC1918 destination now requires the
operator to name that destination in `connectivity_check.allowed_hosts`.
If you rely on it for internal connectivity checks, add the hosts or
their CIDR:

```yaml
holmes:
    toolsets:
        connectivity_check:
            config:
              allowed_hosts:
                - prometheus.monitoring.svc
                - 10.96.0.0/12
```

Public destinations are unaffected and still work with no configuration.
The refusal message names the setting to change, so the failure mode is
self-explaining rather than mysterious. `block_internal_ips: false`
remains the escape hatch for trusted isolated environments.

This deserves a release note.

## Summary

Fixes ROB-1114. `connectivity_check` is CORE and enabled by default, and
the model chooses both host and port. The guard added for ROB-896
(#2385) blocks cloud metadata, loopback and link-local — but
`block_private_ips` defaults to false, so every RFC19

**File**: `docs/data-sources/builtin-toolsets/connectivity-check.md` (modified, +66/-12)
```diff
@@ -15,28 +15,82 @@ holmes:
         connectivity_check:
             enabled: true
             config: # optional
-              allowed_hosts: []      # if set, only these hosts may be probed
-              block_internal_ips: true  # block metadata/loopback/link-local targets
-              block_private_ips: false  # also block private/RFC1918 (off: cluster IPs stay reachable)
+              # Internal destinations must be named here before they can be probed.
+              # Accepts hostnames (matching subdomains), bare IPs, and CIDRs.
+              allowed_hosts:
+                - prometheus.monitoring.svc
+                - 10.96.0.0/12
+              allow_all_hosts: false     # true = skip the allowlist requirement
+              block_internal_ips: true   # enforce the destination policy
+              block_private_ips: false   # true = refuse private even if allowlisted
+              max_probes: 60             # probes per window (0 disables)
+              probe_window_seconds: 60   # must be > 0
 ```
 
+!!! warning "Probing internal addresses requires configuration"
+    Private/RFC1918 destinations are refused unless you list them in
+    `allowed_hosts`. If you use `tcp_check` against in-cluster services, add
+    them (or their CIDR) to `allowed_hosts` — otherwise the probe is refused
+    with a message naming this setting.
+
+    If you'd rather not maintain an allowlist, set `allow_all_hosts: true` (or
+    the `HOLMES_CONNECTIVITY_CHECK_ALLOW_ALL_HOSTS` environment variable) to
+    probe any internal destination at your own risk. Holmes logs a warning at
+    startup while it is on. It does not unblock cloud-metadata or loopback —
+    see [SSRF protection](#ssrf-protection) for how it interacts with
+    `block_internal_ips` and `block_private_ips`.
+
 ### SSRF protection
 
 The probe target (`host`) is chosen by the LLM, and that choice can be
-influenced by untrusted observability data (indirect prompt injection). Left
-unguarded, `tcp_check` is a blind internal-network scanner. The toolset
-therefore refuses the dangerous targets by default:
+influenced by untrusted observability data (indirect prompt injection).
+`tcp_check` returns distinguishable open / refused / filtered outcomes, which is
+all that is needed to enumerate hosts and ports — so left unguarded it is a
+blind internal-network scanner sitting inside your trust boundary. The toolset
+therefore applies this policy:
 
 - **Cloud metadata / loopback are blocked.** Requests to `169.254.0.0/16`
   (incl. `169.254.169.254`), loopback, link-local, multicast, reserved and
   unspecified addresses are rejected. The connection is made to the validated IP
   so DNS rebinding cannot redirect the probe.
-- **Private/cluster IPs stay reachable by default.** Checking connectivity to
-  internal cluster services (RFC1918) is the tool's main purpose, so those are
-  allowed. Set `block_private_ips: true` to restrict the tool to public hosts.
-- **Optional allowlist.** When `allowed_hosts` is set, only those hosts (and
-  subdomains) may be probed, and they are exempt from the internal-IP block.
-- Set `block_internal_ips: false` only in trusted, isolated environments.
+- **Private/cluster destinations must be named.** RFC1918 and other private
+  addresses are refused unless they match `allowed_hosts`. Probing internal
+  services is the tool's legitimate purpose, so the operator names the ones that
+  matter rather than the whole range being open. Entries may be hostnames
+  (`db.internal` also matches `primary.db.internal`), bare IPs, or CIDRs
+  (`10.96.0.0/12`).
+- **An allowlist is exhaustive.** Once `allowed_hosts` is non-empty, public
+  destinations outside it are refused too, and listed destinations are exempt
+  from the internal-IP block so you can deliberately target a specific endpoint.
+  That exemption applies only while `allow_all_hosts` is off (see below).
+- **Public destinations stay reachable with no configuration**, so ordinary
+  external connectivity checks work out of the box.
+- **Probes are rate limited** to `max_probes` per `probe_window_seconds` so a
+  broad allowlist cannot be swept quickly. The counter is per Holmes process and
+  shared across concurrent investigations, so keep it above normal use; set
+  `max_probes: 0` to disable.
+- **Every probe is logged** — allowed and refused alike — so scanning is visible
+  in the Holmes logs.
+- **`allow_all_hosts: true` waives the allowlist requirement** for deployments
+  that don't want to maintain one: private/internal destinations become
+  probeable again, at your own risk, and a warning is logged at startup. It can
+  also be set with the `HOLMES_CONNECTIVITY_CHECK_ALLOW_ALL_HOSTS` environment
+  variable, so no config change is needed. It never unblocks cloud-metadata,
+  loopback or link-local — only `block_internal_ips: false` does that, and it
+  does so independently of this setting, so a deployment that sets both gets
+  the unrestricted beh
```

**File**: `docs/reference/environment-variables.md` (modified, +27/-0)
```diff
@@ -345,6 +345,33 @@ export HOLMES_PASSTHROUGH_BLOCKED_HEADERS="authorization,cookie,set-cookie,x-int
 
 See [HTTP Header Propagation](../data-sources/header-propagation.md) for details.
 
+### HOLMES_CONNECTIVITY_CHECK_ALLOW_ALL_HOSTS
+**Default:** `false`
+
+When set to `true`, the `connectivity_check` toolset's `tcp_check` tool may probe
+private/internal destinations without them being listed in its `allowed_hosts`
+setting. Use it if you don't want to maintain an allowlist — at your own risk:
+the model picks the host and port, and `tcp_check`'s open/refused/filtered
+outcomes make that a usable network scanner if an investigation reads
+attacker-controlled text. A warning is logged at startup while it is on.
+
+Cloud-metadata (`169.254.169.254`), loopback and link-local targets remain
+blocked — this variable never unblocks them. The one setting that does is
+`block_internal_ips: false`, which removes those checks independently of this
+variable; a deployment that sets both gets the unrestricted behaviour of
+`block_internal_ips: false`. `block_private_ips: true` still overrides this.
+While it is on, any
+configured `allowed_hosts` entries are ignored entirely — they neither restrict
+destinations nor exempt one from the metadata/loopback block. Equivalent to
+setting `allow_all_hosts: true` in the toolset config.
+
+**Example:**
+```bash
+export HOLMES_CONNECTIVITY_CHECK_ALLOW_ALL_HOSTS=true
+```
+
+See [Connectivity Check](../data-sources/builtin-toolsets/connectivity-check.md) for details.
+
 ## Data Source Configuration
 
 ### Prometheus
```

**File**: `holmes/plugins/toolsets/connectivity_check.py` (modified, +282/-31)
```diff
@@ -1,8 +1,13 @@
+import ipaddress
 import logging
+import os
 import socket
-from typing import Any, ClassVar, Dict, List, Literal, Optional, Tuple, Type
+import threading
+import time
+from collections import deque
+from typing import Any, ClassVar, Deque, Dict, List, Literal, Optional, Sequence, Tuple, Type
 
-from pydantic import Field
+from pydantic import Field, PrivateAttr
 
 from holmes.core.tools import (
     CallablePrerequisite,
@@ -16,6 +21,7 @@
 )
 from holmes.plugins.toolsets.internet.ssrf import (
     SSRFValidationError,
+    is_blocked_ip,
     validate_host,
 )
 from holmes.plugins.toolsets.utils import toolset_name_for_one_liner
@@ -29,6 +35,76 @@
 
 UserAgentMode = Literal["none", "browser"]
 
+# Audit marker for every probe the model gets to perform. tcp_check returns
+# distinguishable open / refused / filtered outcomes, which is all that is
+# needed to enumerate a network, so each attempt is recorded whether or not it
+# is allowed — scanning should never be invisible.
+PROBE_AUDIT_PREFIX = "connectivity_check probe"
+
+# Escape hatch for deployments that don't want to build an allowlist: set this
+# to opt back into probing any private/internal destination. Metadata and
+# loopback stay blocked — see ALLOW_ALL_HOSTS_ENV_VAR in the config field below.
+ALLOW_ALL_HOSTS_ENV_VAR = "HOLMES_CONNECTIVITY_CHECK_ALLOW_ALL_HOSTS"
+
+_TRUTHY = frozenset({"1", "true", "yes", "on"})
+
+
+def _allow_all_hosts_from_env() -> bool:
+    """Default for allow_all_hosts, so it can be flipped without editing config.
+
+    Anything other than an explicit truthy value fails safe to False.
+    """
+    return os.environ.get(ALLOW_ALL_HOSTS_ENV_VAR, "").strip().lower() in _TRUTHY
+
+
+def _parse_allowlist(
+    entries: Sequence[str],
+) -> Tuple[List[Any], List[str]]:
+    """Split allowlist entries into IP networks and hostname suffixes.
+
+    An entry is treated as a network if it parses as a CIDR or bare IP
+    (``10.96.0.0/12``, ``10.0.0.5``); otherwise as a hostname suffix
+    (``db.internal`` also matches ``primary.db.internal``).
+    """
+    networks: List[Any] = []
+    hostnames: List[str] = []
+    for raw in entries:
+        entry = (raw or "").strip()
+        if not entry:
+            continue
+        try:
+            networks.append(ipaddress.ip_network(entry, strict=False))
+        except ValueError:
+            hostnames.append(entry.lower().lstrip(".").rstrip("."))
+    return networks, hostnames
+
+
+def _destination_allowed(
+    host: str, resolved_ips: Sequence[str], entries: Sequence[str]
+) -> bool:
+    """True if the operator explicitly named this destination.
+
+    Matches on the hostname the model supplied *and* on every address it
+    resolves to, so a CIDR entry covers a service named by DNS.
+    """
+    if not entries:
+        return False
+    networks, hostnames = _parse_allowlist(entries)
+
+    candidate = host.lower().rstrip(".")
+    for name in hostnames:
+        if candidate == name or candidate.endswith("." + name):
+            return True
+
+    for ip_str in resolved_ips:
+        try:
+            ip = ipaddress.ip_address(ip_str)
+        except ValueError:
+            continue
+        if any(ip in network for network in networks):
+            return True
+    return False
+
 
 def tcp_check(host: str, port: int, timeout: float) -> Dict[str, Any]:
     if not (1 <= port <= 65535):
@@ -101,31 +177,108 @@ def _invoke(self, params: dict, context: ToolInvokeContext) -> StructuredToolRes
                 params=params,
             )
 
-        # SSRF guard: the host is model-controlled, so refuse cloud-metadata /
-        # loopback / link-local targets (a blind port-scan / recon primitive via
-        # prompt injection). Private cluster IPs stay reachable by default since
-        # probing internal services is this tool's legitimate purpose. Connect to
-        # the validated IP so a DNS rebind cannot redirect the probe.
         config = self.toolset.effective_config
-        try:
-            validated_ips = validate_host(
-                host,
-                port_int,
-                allowed_hosts=config.allowed_hosts,
-                block_internal_ips=config.block_internal_ips,
-                allow_private_ips=not config.block_private_ips,
-            )
-        except SSRFValidationError as e:
-            error_message = f"Refusing to connect to {host}:{port_int}: {e}"
-            logging.warning(error_message)
+
+        def refuse(reason: str) -> StructuredToolResult:
+            error_message = f"Refusing to connect to {host}:{port_int}: {reason}"
+            logging.warning("%s REFUSED %s:%s — %s", PROBE_AUDIT_PREFIX, host, port_int, reason)
             return StructuredToolResult(
                 status=StructuredToolResultStatus.ERROR,
                 data={"ok": False, "error": error_message},
                 params=params,
             )
 
+        # Resolve first, without applying policy, so the checks below 
```

**File**: `tests/llm/fixtures/test_ask_holmes/289_tcp_check_private_target_refused/test_case.yaml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# Test: the ROB-1114 guard — tcp_check refuses private/internal destinations
+# that the operator has not named, and Holmes relays a usable explanation.
+#
+# tcp_check returns distinguishable open / refused / filtered outcomes, so while
+# RFC1918 was blanket-reachable the tool was a blind internal port scanner: text
+# the model reads (a log line, an alert annotation, an MCP result) could steer it
+# into mapping the cluster. Probing *named* internal services is the tool's
+# legitimate purpose, so the fix requires an explicit allowlist rather than
+# blocking the range.
+#
+# The deterministic policy matrix lives in
+# tests/plugins/toolsets/test_connectivity_check.py. What this eval adds is the
+# agent-loop behaviour the unit tests cannot check: that the refusal reaches the
+# user as an actionable explanation naming the setting to change, instead of the
+# model retrying, inventing a result, or reporting the service as simply down.
+#
+# Anti-hallucination: include_tool_calls surfaces the tool result to the judge,
+# and the expected answer keys off `allowed_hosts` — a configuration key the
+# model can only learn from the refusal text, not guess from the prompt. A
+# regression that reopened private probing would return a connect/timeout result
+# with no such text and fail here.
+#
+# Hermetic: 10.255.255.1 is an IP literal, so it is refused by policy before any
+# DNS lookup or socket connection. No cluster and no network access required.
+user_prompt: "Our billing service is supposed to be listening on 10.255.255.1 port 8080. Check whether that address is reachable, and if you cannot check it, explain exactly why and what I would need to change to allow it."
+
+include_tool_calls: true
+
+expected_output:
+  - "Must call the tcp_check tool for 10.255.255.1 port 8080"
+  - "The tool must refuse the probe rather than report a connection result: its output must say it is refusing to connect because the address is private/internal, and must NOT report the port as open, closed, filtered, timed out, or otherwise probed"
+  - "Must explain to the user that the destination has to be added to the connectivity_check allowed_hosts configuration before it can be probed"
+
+tags:
+  - question-answer
+  - easy
```

**File**: `tests/llm/fixtures/test_ask_holmes/289_tcp_check_private_target_refused/toolsets.yaml` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# connectivity_check with its DEFAULT configuration — no allowed_hosts. This is
+# what every deployment gets out of the box, and it is the configuration the
+# ROB-1114 fix changes: private/internal destinations are now refused unless the
+# operator names them.
+#
+# Everything else is disabled so the model has to reach for tcp_check rather
+# than answering from bash/curl or a cluster toolset, and so the eval needs no
+# Kubernetes. The refusal happens before any socket is opened, so this eval also
+# needs no network access.
+toolsets:
+  connectivity_check:
+    enabled: true
+  internet:
+    enabled: false
+  kubernetes/core:
+    enabled: false
+  kubernetes/logs:
+    enabled: false
+  helm/core:
+    enabled: false
+  bash:
+    enabled: false
```

**File**: `tests/plugins/toolsets/test_connectivity_check.py` (modified, +507/-6)
```diff
@@ -1,12 +1,15 @@
 import ipaddress
+import logging
 import socket
 import threading
 
 import pytest
 
 from holmes.core.tools import ToolsetStatusEnum
 from holmes.core.tools_utils.tool_executor import ToolExecutor
+from holmes.plugins.toolsets import connectivity_check
 from holmes.plugins.toolsets.connectivity_check import (
+    PROBE_AUDIT_PREFIX,
     ConnectivityCheckToolset,
     tcp_check,
 )
@@ -107,16 +110,514 @@ def test_tcp_check_refuses_metadata_and_local_targets(host):
     assert "Refusing to connect" in result.data["error"]
 
 
-def test_tcp_check_allows_private_cluster_ip_by_default(monkeypatch):
-    """Private/cluster IPs are the tool's legitimate purpose — they must not be
-    refused (they may still fail to connect, but not be blocked by the guard)."""
+def _private_dns(monkeypatch, ip="10.0.0.5"):
+    def fake_getaddrinfo(host, port, *args, **kwargs):
+        return [(2, 1, 6, "", (ip, port))]
+
+    monkeypatch.setattr(ssrf.socket, "getaddrinfo", fake_getaddrinfo)
+
+
+def _stub_probe(monkeypatch):
+    """Replace the socket probe and record what it was asked to connect to.
+
+    Tests that assert a probe was *authorized* must not reach the network: a
+    transport error to an unroutable test address looks identical to a policy
+    refusal if you only assert on the absence of refusal text. Recording the
+    call makes "the policy let this through, and to this address" observable.
+    """
+    calls = []
+
+    def fake_tcp_check(host, port, timeout):
+        calls.append((host, port, timeout))
+        return {"ok": True}
+
+    monkeypatch.setattr(connectivity_check, "tcp_check", fake_tcp_check)
+    return calls
+
+
+# ---------------------------------------------------------------------------
+# ROB-1114: private destinations require an explicit allowlist
+#
+# tcp_check returns distinguishable open / refused / filtered outcomes, so
+# leaving RFC1918 blanket-reachable made it a blind internal port scanner
+# driven by whatever the model reads. Probing named internal services is the
+# tool's purpose, so the fix is to require the operator to name them.
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.parametrize(
+    "host", ["10.255.255.1", "192.168.1.10", "172.16.0.5", "10.0.0.1"]
+)
+def test_tcp_check_refuses_private_target_without_allowlist(host):
+    """With defaults, an arbitrary RFC1918 address is refused."""
+    tool = _build_tool()
+    result = tool.invoke(
+        {"host": host, "port": 9, "timeout": 0.1}, create_mock_tool_invoke_context()
+    )
+    assert result.data["ok"] is False
+    assert "Refusing to connect" in result.data["error"]
+    assert "allowed_hosts" in result.data["error"]
+
+
+def test_private_refusal_is_indistinguishable_across_targets():
+    """The refusal must not leak whether a port is open, closed or filtered —
+    that differentiation is the enumeration oracle."""
+    tool = _build_tool()
+    errors = set()
+    for host, port in [
+        ("10.0.0.1", 22),
+        ("10.0.0.1", 9),
+        ("192.168.50.7", 443),
+    ]:
+        result = tool.invoke(
+            {"host": host, "port": port, "timeout": 0.1},
+            create_mock_tool_invoke_context(),
+        )
+        # Normalise away the host:port echo; what matters is the reason.
+        errors.add(result.data["error"].split(": ", 1)[1].split("'")[0])
+    assert len(errors) == 1, errors
+
+
+def test_refusal_does_not_leak_the_resolved_internal_address(monkeypatch):
+    """The refusal must not answer 'what does this internal name resolve to?'.
+    Echoing the resolved IP would turn a blocked probe into a DNS-mapping
+    oracle; the address belongs in the audit log, not the model's context."""
+    _private_dns(monkeypatch, "10.11.12.13")
+    tool = _build_tool()
+    result = tool.invoke(
+        {"host": "billing.internal", "port": 8080, "timeout": 0.1},
+        create_mock_tool_invoke_context(),
+    )
+    assert result.data["ok"] is False
+    assert "10.11.12.13" not in result.data["error"]
+    assert "allowed_hosts" in result.data["error"]
+
+
+def test_metadata_refusal_does_not_leak_the_resolved_address(monkeypatch):
+    """Same rule on the metadata/loopback path: a hostname that resolves into a
+    blocked range must not have that address handed back."""
+    _private_dns(monkeypatch, "169.254.169.254")
+    tool = _build_tool()
+    result = tool.invoke(
+        {"host": "metadata.internal", "port": 80, "timeout": 0.1},
+        create_mock_tool_invoke_context(),
+    )
+    assert result.data["ok"] is False
+    assert "169.254.169.254" not in result.data["error"]
+    assert "non-routable/internal address" in result.data["error"]
+
+
+def test_tcp_check_allows_private_target_named_by_hostname(monkeypatch):
+    """An allowlisted internal service still succeeds."""
+    server_socket, port, stop_event, thread = start_tcp_server()
+
+    def fake_getaddrinfo(host, p, *args, **kwargs):
+        re
```

---

### Incident Patch 15: `88044307` (2026-08-23)
**Commit Message**: Fix NetworkPolicy selectors to match Holmes pod labels (#2410)

## Summary

Fix a critical bug in GCP and Azure MCP server NetworkPolicies that
silently denied all ingress to the MCP servers by attempting to select
the Holmes pod using labels that are never set on it.

## Problem

The Holmes pod template only carries the `app: holmes` label. The
`holmes.commonLabels` helper explicitly reserves and rejects
`app.kubernetes.io/*` keys to prevent operators from accidentally adding
them. However, the GCP and Azure NetworkPolicies were trying to select
Holmes using `app.kubernetes.io/name` and `app.kubernetes.io/instance`,
which could never match, resulting in all ingress being silently denied.

## Changes

- **GCP NetworkPolicy**
(`helm/holmes/templates/mcp-servers/gcp/networkpolicy.yaml`):
- Changed podSelector from `app.kubernetes.io/instance` +
`app.kubernetes.io/name` to `app: holmes`
- Added `namespaceSelector` to pin to the release namespace (required
when the MCP server can run in a configurable namespace)
  - Updated comments to explain the label selection strategy

- **Azure NetworkPolicy**
(`helm/holmes/templates/mcp-servers/azure/networkpolicy.yaml`):
- Changed podSelector fr

**File**: `helm/holmes/templates/mcp-servers/aws/networkpolicy.yaml` (modified, +6/-1)
```diff
@@ -24,11 +24,16 @@ spec:
   policyTypes:
   - Ingress
   ingress:
-  # Allow traffic only from Holmes pods
+  # Allow traffic only from Holmes pods (app: holmes) in the release namespace.
+  # podSelector + namespaceSelector in the same `from` element are AND-ed, which
+  # keeps this working when the MCP server runs in its own namespace.
   - from:
     - podSelector:
         matchLabels:
           app: holmes
+      namespaceSelector:
+        matchLabels:
+          kubernetes.io/metadata.name: {{ .Release.Namespace }}
     ports:
     - protocol: TCP
       port: 8000
```

**File**: `helm/holmes/templates/mcp-servers/azure/networkpolicy.yaml` (modified, +7/-3)
```diff
@@ -27,11 +27,15 @@ spec:
   - Egress
   ingress:
   - from:
-    # Allow traffic from Holmes pods
+    # Allow traffic from Holmes pods (app: holmes) in the release namespace.
+    # podSelector + namespaceSelector in the same `from` element are AND-ed, which
+    # keeps this working when the MCP server runs in its own namespace.
     - podSelector:
         matchLabels:
-          app.kubernetes.io/name: holmes
-          app.kubernetes.io/instance: {{ .Release.Name }}
+          app: holmes
+      namespaceSelector:
+        matchLabels:
+          kubernetes.io/metadata.name: {{ .Release.Namespace }}
     # Allow traffic from pods with specific label
     - podSelector:
         matchLabels:
```

**File**: `helm/holmes/templates/mcp-servers/gcp/networkpolicy.yaml` (modified, +10/-3)
```diff
@@ -25,12 +25,19 @@ spec:
   - Ingress
   - Egress
   ingress:
-  # Allow traffic from Holmes pods
+  # Allow traffic only from HolmesGPT pods (app: holmes) in the release namespace.
+  # The Holmes pod template carries `app: holmes` and nothing else, and
+  # holmes.commonLabels rejects the app.kubernetes.io/* keys as reserved, so
+  # those labels can never be used to select it.
+  # podSelector + namespaceSelector in the same `from` element are AND-ed, which
+  # keeps this working when the MCP server runs in its own namespace.
   - from:
     - podSelector:
         matchLabels:
-          app.kubernetes.io/instance: {{ .Release.Name }}
-          app.kubernetes.io/name: holmes
+          app: holmes
+      namespaceSelector:
+        matchLabels:
+          kubernetes.io/metadata.name: {{ .Release.Namespace }}
     ports:
     {{- if .Values.mcpAddons.gcp.gcloud.enabled }}
     - protocol: TCP
```

#### Recent Merged Pull Requests:
- **PR #2535** (2026-10-05): ROB-1250 Replace deprecated FastAPI shutdown handler with lifespan (@naomi-robusta)
- **PR #2533** (closed): Feat/tracepilot evidence agent (@mochengqian)
- **PR #2532** (2026-10-04): ROB-1506 Remove the kubectl-run toolset (@Sheeproid)
- **PR #2530** (2026-10-04): ROB-1099: gate /eval and /list on real repo permission (@Avi-Robusta)
- **PR #2528** (closed): Weekly Benchmark Results 2026-10-04_03-00 (@github-actions[bot])
- **PR #2516** (2026-10-01): docs: check the deployment tab shape on every model provider and data source page (@ezra-robusta)
- **PR #2515** (2026-09-30): docs: one deployment tab shape on the Kubernetes built-in and general data source pages (@ezra-robusta)
- **PR #2514** (2026-09-30): docs: one deployment tab shape on the database pages (@ezra-robusta)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): bytedance/deer-flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/bytedance-deer-flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bytedance/deer-flow](https://github.com/bytedance/deer-flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:41:51.664Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bytedance/deer-flow`
- **Description**: An open-source long-horizon SuperAgent harness that researches, codes, and creates. With the help of sandboxes, memories, tools, skill, subagents and message gateway, it handles different levels of tasks that could take minutes to hours.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 83261 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agent/skills/blocking-io-guard/templates/anchor.template.py`
```
"""Template: a tests/blocking_io/ runtime anchor.

Copy into backend/tests/blocking_io/test_<area>.py and adapt. The suite's
conftest already wraps every test here in the strict Blockbuster gate, so you do
NOT import or activate the detector — just drive the real async entry point.

Teeth check before you commit (see references/good-anchor-rules.md):
  1. reintroduce the block  -> `cd backend && make test-blocking-io` must FAIL
  2. restore the fix        -> it must PASS
"""

from __future__ import annotations

from pathlib import Path

import pytest

# from app.<module> import <real_async_entry_point>

pytestmark = pytest.mark.asyncio


async def test_<entry_point>_offloads_blocking_io_on_<branch>(tmp_path: Path) -> None:
    # Arrange: real inputs at the boundary the code blocks on (FS -> tmp_path;
    #   HTTP/subprocess -> stub the external service). Mock ONLY the external
    #   boundary, never the offload under test.

    # Act + Assert: call the REAL production async entry point and drive the
    # specific branch you are guarding (e.g. force a failure to hit the cleanup
    # path). If the entry point performs blocking IO on the loop, the gate fails.
    #   await <real_async_entry_point>(...)
    raise NotImplementedError("Replace with the real async entry point call.")

```

### Core Architecture Module: `backend/app/channels/__init__.py`
```
"""IM Channel integration for DeerFlow.

Provides a pluggable channel system that connects external messaging platforms
(Feishu/Lark, Slack, Telegram) to the DeerFlow agent via the ChannelManager,
which uses ``langgraph-sdk`` to communicate with Gateway's LangGraph-compatible API.
"""

from app.channels.base import Channel
from app.channels.message_bus import InboundMessage, MessageBus, OutboundMessage

__all__ = [
    "Channel",
    "InboundMessage",
    "MessageBus",
    "OutboundMessage",
]

```

### Core Architecture Module: `backend/app/channels/base.py`
```
"""Abstract base class for IM channels."""

from __future__ import annotations

import asyncio
import logging
import threading
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable, Coroutine
from concurrent.futures import CancelledError as FutureCancelledError
from concurrent.futures import Future
from dataclasses import dataclass
from typing import Any, TypeVar

from app.channels.commands import extract_connect_code
from app.channels.message_bus import (
    InboundMessage,
    InboundMessageType,
    InboundQueueClosedError,
    InboundQueueFullError,
    InboundReservation,
    InboundReservationExpiredError,
    MessageBus,
    OutboundMessage,
    ResolvedAttachment,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass(eq=False, slots=True)
class _ThreadsafeSubmission:
    coroutine: Coroutine[Any, Any, Any]
    loop: asyncio.AbstractEventLoop
    name: str
    msg_id: Any
    reservation: InboundReservation | None
    completion: Future[Any]
    task: asyncio.Task[Any] | None = None
    cancel_requested: bool = False


class Channel(ABC):
    """Base class for all IM channel implementations.

    Each channel connects to an external messaging platform and:
    1. Receives messages, wraps them as InboundMessage, publishes to the bus.
    2. Subscribes to outbound messages and sends replies back to the platform.

    Subclasses must implement ``start``, ``stop``, and ``send``.
    """

    def __init__(self, name: str, bus: MessageBus, config: dict[str, Any]) -> None:
        self.name = name
        self.bus = bus
        self.config = config
        self._running = False
        self._connection_repo: Any = config.get("connection_repo")
        # Provider SDK callbacks often run on a dedicated thread and submit
        # preparation work to the Gateway loop. Submission and shutdown share
        # this lock so stop() cannot miss a future created concurrently.
        self._threadsafe_submissions: set[_ThreadsafeSubmission] = set()
        self._threadsafe_submissions_lock = threading.Lock()
        self._threadsafe_submission_intake_open = True

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def supports_streaming(self) -> bool:
        return False

    # -- lifecycle ---------------------------------------------------------

    @abstractmethod
    async def start(self) -> None:
        """Start listening for messages from the external platform."""

    @abstractmethod
    async def stop(self) -> None:
        """Gracefully stop the channel."""

    # -- outbound ----------------------------------------------------------

    @abstractmethod
    async def send(self, msg: OutboundMessage) -> None:
        """Send a message back to the external platform.

        The implementation should use ``msg.chat_id`` and ``msg.thread_ts``
        to route the reply to the correct conversation/thread.
        """

    async def send_file(self, msg: OutboundMessage, attachment: ResolvedAttachment) -> bool:
        """Upload a single file attachment to the platform.

        Returns True if the upload succeeded, False otherwise.
        Default implementation returns False (no file upload support).
        """
        return False

    # -- helpers -----------------------------------------------------------

    async def _send_with_retry(
        self,
        operation: Callable[[], Awaitable[T]],
        *,
        max_retries: int,
        log_prefix: str | None = None,
        operation_name: str = "send",
    ) -> T:
        """Run an outbound send operation with the shared channel retry policy."""
        prefix = log_prefix or f"[{self.name}]"
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
                return await operation()
            except Exception as exc:
                last_exc = exc
                if attempt < max_retries - 1:
                    delay = 2**attempt
                    logger.warning(
                        "%s %s failed (attempt %d/%d), retrying in %ds: %s",
                        prefix,
                        operation_name,
                        attempt + 1,
                        max_retries,
                        delay,
                        exc,
                    )
                    await asyncio.sleep(delay)

        logger.error("%s %s failed after %d attempts: %s", prefix, operation_name, max_retries, last_exc)
        if last_exc is None:
            raise RuntimeError(f"{self.name} {operation_name} failed without an exception from any attempt")
        raise last_exc

    def _log_future_error(self, fut: Any, name: str, msg_id: Any) -> None:
        """Callback for concurrent futures scheduled from channel worker threads."""
        try:
            exc = fut.exception()
        except (asyncio.CancelledError, FutureCancelledError, asyncio.InvalidStateError):
            return
        except Exception:
            logger.exception("[%s] failed to inspect future for %s (msg_id=%s)", self.name, name, msg_id)
            return

        if exc:
            logger.error("[%s] %s failed for msg_id=%s: %s", self.name, name, msg_id, exc)

    def _open_threadsafe_future_intake(self) -> None:
        """Allow a newly started provider to submit work to its main loop."""
        with self._threadsafe_submissions_lock:
            if self._threadsafe_submissions:
                raise RuntimeError(f"cannot restart {self.name} while cross-thread work is still running")
            self._threadsafe_submission_intake_open = True

    def _submit_threadsafe_coroutine(
        self,
        coroutine: Coroutine[Any, Any, T],
        loop: asyncio.AbstractEventLoop | None,
        *,
        name: str,
        msg_id: Any,
        reservation: InboundReservation | None = None,
    ) -> bool:
        """Submit provider-thread work while retaining its real asyncio Task."""

        with self._threadsafe_submissions_lock:
            if not self._threadsafe_submission_intake_open or loop is None or not loop.is_running():
                coroutine.close()
                if reservation is not None:
                    reservation.release()
                return False

            submission = _ThreadsafeSubmission(
                coroutine=coroutine,
                loop=loop,
                name=name,
                msg_id=msg_id,
                reservation=reservation,
                completion=Future(),
            )
            self._threadsafe_submissions.add(submission)
            try:
                loop.call_soon_threadsafe(self._start_threadsafe_submission, submission)
            except RuntimeError:
                self._threadsafe_submissions.discard(submission)
                coroutine.close()
                if reservation is not None:
                    reservation.release()
                return False
        return True

    def _start_threadsafe_submission(self, submission: _ThreadsafeSubmission) -> None:
        """Create the owned Task on its event loop or finish a pre-start cancel."""
        task: asyncio.Task[Any] | None = None
        startup_error: BaseException | None = None
        with self._threadsafe_submissions_lock:
            if submission.cancel_requested:
                self._threadsafe_submissions.discard(submission)
                cancelled_before_start = True
            else:
                cancelled_before_start = False
                try:
                    task = submission.loop.create_task(submission.coroutine)
                except BaseException as exc:
                    self._threadsafe_submissions.discard(submission)
                    startup_error = exc
                else:
                    submission.task = task

        if cancelled_before_start:
            submission.coroutine.close()
            if submission.reservation is not None:
                submission.reservation.release()
 
```

### Core Architecture Module: `backend/app/channels/buzz.py`
```
"""Buzz (Nostr) channel: DeerFlow as a member of a Buzz workspace relay.

One NIP-42-authenticated WebSocket to ``relay_url``. Inbound kind-9 chat events are
gated (pubkey allowlist, then mention/DM/thread-follow) and published to the bus;
outbound replies post one kind-9 message and then stream via kind-40003 in-place edits.

Subscriptions are CHANNEL-SCOPED, which is the shape the relay actually serves:

- ``REQ {"kinds":[9]}`` (global) is accepted and answered with EOSE, but the relay
  never fans a chat event out to it -- a connector subscribed that way authenticates
  successfully and then receives nothing, forever. Proved against a live relay.
- ``REQ {"kinds":[9], "#h":[uuid]}`` works, and a multi-value ``#h`` does NOT, so
  there is exactly one chat subscription per channel (matching Buzz's own agent
  harness, whose ``subscribe_channel_from`` is likewise per channel).

So each connection: authenticate, discover the channels this identity belongs to
with a historical ``kinds:[39000]`` REQ, open one ``#h`` chat subscription per
discovered channel, and keep a live ``kinds:[44100,44101] #p=<us>`` subscription so
channels we are added to (or removed from) later are picked up without a reconnect.

Every one of those subscriptions can be killed by a single relay ``CLOSED`` frame,
and each one dying is a *silent* outage (a dead chat subscription deafens one
channel; a dead ``buzz-membership`` stops us ever learning we were added to or
removed from a channel; a dead ``buzz-discovery`` kills the completeness sweep).
So a ``CLOSED`` is recovered rather than merely forgotten -- bounded by
``MAX_RESUBSCRIBE_ATTEMPTS`` per subscription per connection, and only when the
relay's stated reason suggests re-issuing the same REQ could work at all (see
``_is_transient_close``). Every subscription that goes unlistened is named at
WARNING, because "listening to nothing" must never again be indistinguishable from
"nothing is being said".

KNOWN BOUND (documented, not fixed): the relay caps historical delivery at 2000
events per subscription and serves them NEWEST-FIRST, even with a ``since``. So a
channel that accumulated more than 2000 unread messages across one disconnect
loses the oldest of them: the relay never sends them, and the watermark advances
past them as the newer ones are processed. This is the one bounded skip path that
remains, it needs a disconnect plus >2000 messages in a single channel to trigger,
and closing it would require paging the backlog with descending ``until`` queries.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Any
from urllib.parse import urlparse

from app.channels import buzz_nostr
from app.channels.base import Channel
from app.channels.buzz_seen_events import BuzzSeenEventStore
from app.channels.commands import is_known_channel_command
from app.channels.connection_identity import attach_connection_identity
from app.channels.message_bus import InboundMessage, InboundMessageType, InboundQueueFullError, MessageBus, OutboundMessage

logger = logging.getLogger(__name__)

# Headroom under the relay's 64KB edit-content cap (kind-40003 events).
EDIT_MAX_BYTES = 60_000

# Ceiling for how far ahead of our own clock a peer-supplied ``created_at`` may be
# and still advance the resubscribe watermark (see ``_advance_watermark``).
MAX_FUTURE_SKEW_SECONDS = 60

# Cap on the kind-39000 metadata cache. Any relay member can publish channel
# metadata, so this map is remote-fed and would otherwise grow without bound for
# the process lifetime; evicting the oldest entry only costs us the DM mention
# exemption for that channel until its metadata is seen again (``_is_dm`` fails
# closed on a cache miss).
MAX_CACHED_CHANNELS = 512

# Cap on how many per-channel chat subscriptions one connection may hold. The
# channel list is remote-fed (kind-39000 metadata and kind-44100 membership
# notifications both come off the wire), and each entry is a real REQ on the socket,
# so this is bounded twice over: well under buzz-relay's own per-connection ceiling
# (``MAX_SUBSCRIPTIONS = 1024`` in its REQ handler) and far above any plausible
# workspace. At the cap we REFUSE new subscriptions and log, rather than evicting an
# existing one: eviction would silently deafen a channel that is currently working,
# whereas refusing leaves every established channel intact and names the one that
# did not fit.
MAX_CHANNEL_SUBSCRIPTIONS = 256

# Subscription ids. Deterministic so a subscription can be replaced or closed
# individually (``CLOSE``) without disturbing the others on the same socket.
DISCOVERY_SUB_ID = "buzz-discovery"
MEMBERSHIP_SUB_ID = "buzz-membership"
CHAT_SUB_PREFIX = "buzz-chat-"

# How many times ONE subscription may be re-opened after the relay ``CLOSED`` it,
# per connection and per auth epoch. Re-issuing a closed REQ immediately and
# unconditionally is a tight loop against a relay that keeps closing it (each
# CLOSED provokes a REQ which provokes a CLOSED), so the budget is what makes
# recovery safe rather than the backoff: at the cap we stop, say so loudly, and
# leave it to the next reconnect -- which rebuilds every subscription anyway.
MAX_RESUBSCRIBE_ATTEMPTS = 3

# Backoff between re-subscribe attempts. The FIRST retry is immediate: a one-off
# relay hiccup is the common case and should be repaired without a stall. Later
# retries back off (1s, then 2s), which is what a persistently-closing relay gets.
# The delay is awaited inline in the relay read loop rather than handed to a
# background task -- 3s of worst-case delayed frame processing per subscription
# per connection is cheaper than a task that can outlive its own socket and fire a
# REQ into a connection that no longer exists.
RESUBSCRIBE_BASE_DELAY_SECONDS = 1.0

# How far BEFORE the socket opened the live membership subscription starts.
#
# Without any ``since`` the relay replays its whole stored 44100/44101 history on
# every connection: each historical "you were added" reads as live (re-subscribing
# channels we have since been removed from and re-running discovery once per
# event), and each historical "you were removed" transiently unsubscribes a channel
# we are still in. Anchoring ``since`` at connection time fixes that, but a bare
# ``now`` would open a hole: the relay stamps ``created_at`` with ITS clock, and a
# membership change published during our connect/auth handshake is genuinely live
# yet already in the past by the time the REQ goes out. This slack covers both --
# it can only ever cost the replay of the last minute of membership changes, which
# is idempotent (``_ensure_chat_subscription`` no-ops on a channel already
# subscribed), whereas being one second short costs a channel we never hear from.
MEMBERSHIP_LOOKBACK_SECONDS = 60

# Bound on how long ``stop()`` waits for the cancelled relay loop to finish.
STOP_TIMEOUT_SECONDS = 5.0

# NIP-42's machine-readable ``CLOSED`` prefix for "authenticate first".
#
# BEFORE this connection has completed its NIP-42 handshake this is not a refusal
# at all -- it is the expected bootstrap sequence. ``_session`` deliberately opens
# the control subscriptions immediately, in case the relay serves unauthenticated
# reads; a closed relay answers ``auth-required:`` and an ``AUTH`` challenge, and
# the auth branch then re-opens every subscription. Treating that as a permanent
# refusal produced an operator-facing warning claiming discovery/membership
# tracking was DOWN at the exact moment it was coming up -- observed live, in the
# same run where discovery then completed, every channel was subscribed, and a
# brand-new channel's kind-44100 was picked up one second later.
#
# AFTER the handshake the same reason means the relay stopped accepting our
# authenticated session, which is a genuine outage and stays loud.
#
# "Completed its NIP-42 handshake" means the relay has ACKNOWLEDGED our AUTH
# event (an ``OK ... true`` for it, or -- if the relay never sen
```

### Core Architecture Module: `backend/app/channels/buzz_nostr.py`
```
"""Pure Nostr (NIP-01) helpers for the Buzz channel connector.

No I/O, no wall-clock: callers supply ``created_at``. BIP-340 signing is done via
``coincurve``, which ships in the optional ``buzz`` dependency extra and is imported
lazily so the rest of the app never requires it.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

COINCURVE_INSTALL_HINT = "The Buzz channel requires the 'buzz' extra: run `uv sync --extra buzz` (installs coincurve for BIP-340 signing)."


def _require_coincurve():
    try:
        import coincurve
    except ImportError as exc:  # pragma: no cover - exercised via BuzzChannel.start
        raise RuntimeError(COINCURVE_INSTALL_HINT) from exc
    return coincurve


@dataclass(frozen=True)
class NostrKeys:
    secret: bytes
    pubkey_hex: str


def _bech32_polymod(values: list[int]) -> int:
    gen = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for v in values:
        b = chk >> 25
        chk = (chk & 0x1FFFFFF) << 5 ^ v
        for i in range(5):
            chk ^= gen[i] if ((b >> i) & 1) else 0
    return chk


def _bech32_decode(expected_hrp: str, value: str) -> bytes:
    if "1" not in value:
        raise ValueError(f"not bech32: {value!r}")
    hrp, data_part = value.rsplit("1", 1)
    if hrp != expected_hrp:
        raise ValueError(f"expected {expected_hrp!r} bech32, got {hrp!r}")
    try:
        data = [_BECH32_CHARSET.index(c) for c in data_part]
    except ValueError as exc:
        raise ValueError(f"invalid bech32 character in {value!r}") from exc
    hrp_expanded = [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]
    if _bech32_polymod(hrp_expanded + data) != 1:
        raise ValueError(f"bad bech32 checksum in {value!r}")
    acc = bits = 0
    out = bytearray()
    for v in data[:-6]:
        acc = (acc << 5) | v
        bits += 5
        if bits >= 8:
            bits -= 8
            out.append((acc >> bits) & 0xFF)
    if len(out) != 32:
        raise ValueError(f"expected 32-byte payload in {value!r}")
    return bytes(out)


def _parse_32_bytes(value: str, bech_hrp: str) -> bytes:
    value = value.strip()
    if value.lower().startswith(f"{bech_hrp}1"):
        return _bech32_decode(bech_hrp, value.lower())
    try:
        raw = bytes.fromhex(value)
    except ValueError as exc:
        raise ValueError(f"expected 64-hex or {bech_hrp}1... value") from exc
    if len(raw) != 32:
        raise ValueError("expected exactly 32 bytes")
    return raw


def parse_private_key(value: str) -> NostrKeys:
    secret = _parse_32_bytes(value, "nsec")
    coincurve = _require_coincurve()
    pubkey = coincurve.PrivateKey(secret).public_key.format(compressed=True)[1:]
    return NostrKeys(secret=secret, pubkey_hex=pubkey.hex())


def parse_pubkey(value: str) -> str:
    return _parse_32_bytes(value, "npub").hex()


def event_id(pubkey_hex: str, created_at: int, kind: int, tags: list[list[str]], content: str) -> str:
    payload = json.dumps([0, pubkey_hex, created_at, kind, tags, content], separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def sign_event(keys: NostrKeys, kind: int, tags: list[list[str]], content: str, created_at: int) -> dict:
    coincurve = _require_coincurve()
    eid = event_id(keys.pubkey_hex, created_at, kind, tags, content)
    sig = coincurve.PrivateKey(keys.secret).sign_schnorr(bytes.fromhex(eid))
    return {"id": eid, "pubkey": keys.pubkey_hex, "created_at": created_at, "kind": kind, "tags": tags, "content": content, "sig": sig.hex()}


KIND_CHAT = 9
KIND_EDIT = 40003
KIND_AUTH = 22242
KIND_CHANNEL_META = 39000
# Relay-signed membership notifications (buzz-core's KIND_MEMBER_ADDED_NOTIFICATION /
# KIND_MEMBER_REMOVED_NOTIFICATION). Each carries ``p`` = the affected member's pubkey
# and ``h`` = the channel uuid, which is how a connected client learns it was added to
# (or removed from) a channel without reconnecting.
KIND_MEMBER_ADDED = 44100
KIND_MEMBER_REMOVED = 44101


def build_auth_event(keys: NostrKeys, relay_url: str, challenge: str, created_at: int) -> dict:
    return sign_event(keys, KIND_AUTH, [["relay", relay_url], ["challenge", challenge]], "", created_at)


def build_chat_event(keys: NostrKeys, channel_id: str, content: str, created_at: int, reply_to: str | None = None, mentions: tuple[str, ...] = ()) -> dict:
    tags: list[list[str]] = [["h", channel_id]]
    if reply_to:
        tags.append(["e", reply_to])
    tags.extend(["p", m] for m in mentions)
    return sign_event(keys, KIND_CHAT, tags, content, created_at)


def build_edit_event(keys: NostrKeys, channel_id: str, target_event_id: str, content: str, created_at: int) -> dict:
    return sign_event(keys, KIND_EDIT, [["h", channel_id], ["e", target_event_id]], content, created_at)


def verify_event(event: Any) -> bool:
    """True only when *event* carries a self-consistent id and a valid BIP-340 signature.

    Two independent checks, both required:

    1. The NIP-01 event id is RECOMPUTED from the event's own
       ``pubkey``/``created_at``/``kind``/``tags``/``content`` and must equal the
       ``id`` the sender claims -- so ``id`` cannot be borrowed from a different
       (legitimately signed) event while the payload is swapped.
    2. The Schnorr signature must verify against that id under the claimed
       ``pubkey``, which is what actually binds the payload to its author.

    Relay input is untrusted, so this NEVER raises: any missing, mistyped,
    non-hex, or wrong-length field -- or a payload that is not even a mapping --
    is simply an event that fails to verify, and callers must be able to treat
    "malformed" and "forged" identically without a try/except at every call site.
    A missing ``coincurve`` (the optional ``buzz`` extra) also lands here and
    fails closed; it is unreachable in practice because ``BuzzChannel.start()``
    already parses its private key through ``coincurve`` and would have failed
    with :data:`COINCURVE_INSTALL_HINT` long before any event arrived.
    """
    try:
        if not isinstance(event, dict):
            return False
        pubkey = event.get("pubkey")
        sig = event.get("sig")
        claimed_id = event.get("id")
        content = event.get("content")
        created_at = event.get("created_at")
        kind = event.get("kind")
        tags = event.get("tags")
        # bool is an int subclass; a JSON `true` in either numeric field would
        # otherwise serialize as "true" and silently change the canonical form.
        if not isinstance(pubkey, str) or not isinstance(sig, str) or not isinstance(claimed_id, str) or not isinstance(content, str) or not isinstance(tags, list):
            return False
        if not isinstance(created_at, int) or isinstance(created_at, bool) or not isinstance(kind, int) or isinstance(kind, bool):
            return False
        if event_id(pubkey, created_at, kind, tags, content) != claimed_id:
            return False
        coincurve = _require_coincurve()
        return bool(coincurve.PublicKeyXOnly(bytes.fromhex(pubkey)).verify(bytes.fromhex(sig), bytes.fromhex(claimed_id)))
    except Exception:
        return False


def req_frame(sub_id: str, *filters: dict) -> str:
    return json.dumps(["REQ", sub_id, *filters], separators=(",", ":"))


def event_frame(event: dict) -> str:
    return json.dumps(["EVENT", event], separators=(",", ":"))


def close_frame(sub_id: str) -> str:
    """NIP-01 ``CLOSE``: stop an individual subscription without dropping the socket.

    Needed because chat subscriptions are per channel (the relay only fans kind-9
    events out to ``#h``-scoped subscriptions), so being removed from a channel has
    to unsubscribe exactly that one -- the other channels' subscriptions, the
    discovery subscription, and the membership subscription all ride the same
    c
```

### Core Architecture Module: `backend/app/channels/buzz_run_policy.py`
```
"""Run-policy registration for the Buzz channel (imported for side effect from manager.py)."""

from app.channels.run_policy import CHANNEL_RUN_POLICY, ChannelRunPolicy


def register_policy() -> None:
    # Same-thread follow-ups queue instead of tripping the busy reply (Feishu precedent);
    # the adapter-level pubkey allowlist is the identity gate, so no bound identity needed.
    CHANNEL_RUN_POLICY["buzz"] = ChannelRunPolicy(serialize_thread_runs=True, requires_bound_identity=False)


register_policy()

```

### Core Architecture Module: `backend/app/channels/buzz_seen_events.py`
```
"""Persistent record of Buzz chat events that were fully processed.

Why this exists
---------------
The Buzz connector's resubscribe filter deliberately replays rather than skips:
``since`` is the created_at of the last processed event and NIP-01 ``since`` is
inclusive, so every reconnect redelivers at least that event (see
``BuzzChannel._chat_filter``). The manager's inbound dedupe absorbs those
redeliveries — but its default store is in-process with a 10-minute TTL, so a
reconnect more than 10 minutes after the last message (or any gateway restart)
re-runs the agent on an already-answered message.

This store closes that gap at the connector: the ids of fully processed events
are persisted per channel, and a redelivered id is dropped before it reaches the
bus. Dedupe is by exact event id only — never by timestamp — so a genuinely new
event (which always has a fresh id, whatever its author-chosen created_at) can
never be skipped, preserving the connector's fail-toward-replay invariant.

Failure policy is fail-open in both directions: an unreadable file loads as
empty (costing at most one replayed answer, the pre-existing behavior) and a
failed write is logged and retried on the next flush (costing replay, never a
skip). The id lists are bounded per channel and the channel map is bounded like
the connector's other remote-fed maps. That per-channel bound also bounds the
restart protection itself: after a gateway restart ``_seen_created_at`` is
empty, the resubscribe REQ carries no ``since``, and the relay's default
backlog replays — only the newest ``MAX_IDS_PER_CHANNEL`` processed ids per
channel are dropped, so a relay backlog deeper than that would re-answer the
tail. If a relay ever serves a deeper default backlog, raise
``MAX_IDS_PER_CHANNEL`` here.

Writes are coalesced: ``arecord()`` marks the store dirty and schedules one
flush per ``FLUSH_DELAY_SECONDS`` on the running event loop, so a reconnect
backlog burst pays one O(store) file write instead of one per event. The timer
captures an immutable payload on the event loop and writes it through
``asyncio.to_thread``; a generation counter keeps records that arrive during
that write dirty for the next flush. ``aseen()`` likewise offloads the initial
file load, and ``BuzzChannel.stop()`` awaits ``aflush()`` so clean shutdown is
durable before it returns. That final flush is bounded: it waits for an existing
write and attempts at most one newer snapshot, leaving any still-moving
generation dirty for fail-open replay rather than hanging shutdown. The
in-flight worker write is shielded and retained if Gateway cancellation
interrupts shutdown, so a retried stop awaits it instead of racing it with a
second snapshot; every final attempt also removes its coalescing timer before
returning. ``BuzzChannel`` quiesces automatic scheduling before stop and resumes
it after start, so a timed-out relay task that records after the stop boundary
leaves data dirty for fail-open replay without creating detached file work. The
synchronous ``seen()`` / ``record()`` / ``flush()`` methods remain for tests and
tooling that run outside an event loop.
"""

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
import threading
from collections import OrderedDict, deque
from pathlib import Path

logger = logging.getLogger(__name__)

# Coalescing window for persisting the store. Losing this window's records in a
# crash only costs replay (fail-open), never a skip.
FLUSH_DELAY_SECONDS = 1.0

# Ids retained per channel. Reconnect replay is normally the single watermark
# event; the deep case is a channel whose cursor was evicted, which replays the
# relay's default backlog window. Both are far below this bound.
MAX_IDS_PER_CHANNEL = 512
# Channel-map cap, mirroring the connector's other remote-fed maps
# (channel ids arrive in remote ``h`` tags).
MAX_CHANNELS = 512


class BuzzSeenEventStore:
    """Bounded, JSON-persisted map of channel id -> recently processed event ids.

    Gateway event-loop callers must use ``aseen()``, ``arecord()``, and
    ``aflush()`` so filesystem access stays on a worker thread.
    """

    def __init__(self, path: str | Path | None = None) -> None:
        # ``path=None`` means memory-only: no file is read or written, which is
        # exactly the pre-existing (non-durable) behavior. The channel service
        # wires the persistent path for real deployments; constructing a
        # channel directly (tests, tooling) must not create directories or
        # files as a side effect.
        self._path = Path(path) if path is not None else None
        self._ids: OrderedDict[str, deque[str]] = OrderedDict()
        self._sets: dict[str, set[str]] = {}
        self._loaded = False
        self._load_lock = threading.Lock()
        self._dirty = False
        self._generation = 0
        self._quiesced = False
        self._flush_handle: asyncio.TimerHandle | None = None
        self._flush_task: asyncio.Task[bool] | None = None
        # The loop the pending handle was scheduled on. TimerHandle has no
        # public get_loop(), so it is tracked here to detect a stale handle.
        self._flush_loop: asyncio.AbstractEventLoop | None = None

    # -- persistence ---------------------------------------------------------

    def _ensure_loaded(self) -> None:
        with self._load_lock:
            if self._loaded:
                return
            try:
                if self._path is None:
                    return
                try:
                    if not self._path.exists():
                        return
                    raw = json.loads(self._path.read_text(encoding="utf-8"))
                except Exception:
                    logger.warning("[buzz] unreadable seen-event store, starting fresh (costs at most one replayed reply)", exc_info=True)
                    return
                if not isinstance(raw, dict):
                    return
                for channel_id, ids in raw.items():
                    if not isinstance(ids, list):
                        continue
                    clean = deque((str(i) for i in ids if i), maxlen=MAX_IDS_PER_CHANNEL)
                    self._ids[str(channel_id)] = clean
                    self._sets[str(channel_id)] = set(clean)
                self._enforce_channel_cap()
            finally:
                # Publish only after every loaded entry is visible. Async hot
                # paths may read this flag without taking ``_load_lock``.
                self._loaded = True

    def _snapshot(self) -> dict[str, list[str]]:
        return {channel: list(ids) for channel, ids in self._ids.items()}

    def _write_snapshot(self, payload: dict[str, list[str]]) -> bool:
        if self._path is None:
            return True
        tmp_name: str | None = None
        try:
            path = self._path
            path.parent.mkdir(parents=True, exist_ok=True)
            # Atomic same-directory replace, matching ChannelStore._save: a
            # crash mid-write must never truncate the store (a truncated store
            # would fail open into replay on the next start, which is
            # recoverable — but there is no reason to accept even that).
            with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, suffix=".tmp", delete=False, encoding="utf-8") as fh:
                tmp_name = fh.name
                json.dump(payload, fh)
            Path(tmp_name).replace(path)
            return True
        except Exception:
            # Mirror ChannelStore._save: never leave the temp file behind, or a
            # persistently failing write accumulates one *.tmp per attempt.
            if tmp_name is not None:
                Path(tmp_name).unlink(missing_ok=True)
            logger.warning("[buzz] failed to persist seen-event store (will retry on next flush)", exc_info=True)
            return False

    def _save(self) -> None:
        if self._write_snapshot(self._snapshot())
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #5628** (2026-09-22): **[bug] AioSandbox ignores bash_command_timeout and can stall same-sandbox operations**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  `AioSandbox.execute_command()` ignores `bash_command_timeout`, so long-running or stalled shell commands can exceed the configured command deadline and block subsequent operations on the same sandbox client.  ### Affected area(s)  Backend API (gateway / endpoints / SSE), Sandbox / Docker  ### What happened?  `AioSandbox.execute_command(..., timeout=...)` currently discards the caller-provided timeout:  ```python del timeout ```  As a result, the configured `sandbox.bash_command_timeout` is effective for `LocalSandbox`, but not for `AioSandbox`.  With:  ```yaml sandbox:   bash_command_timeout: 3 ```  I observed:  ```text AioSandbox.execute_command("sleep 25", timeout=3) -> 25.54s  Gateway + AioSandboxProvider bash: sleep 25 -> 29.11s  Gateway + LocalSandboxProvider bash: sleep 25 -> 3.35s ```  There is a second failure mode when the AIO persistent-shell request itself stops making progress.  Against a real `all-in-one-sandbox:1.11.0` container:  ```bash echo x; exit 0 ```  caused the underlying `shell.exec_command()` request to remain blocked. While the request was active:  ```text AioSandbox._lock remained held subsequent list_dir("/") did not return the Gateway run remained active the SSE stream emitted only ": heartbeat" ```  The same sandbox client therefore c

- **Issue #5550** (2026-09-20): **[bug] E2B reconciliation reconnects warm sandboxes and prevents idle timeout expiry**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [ ] I can reproduce this on the latest `main`.  ### Problem summary  Periodic E2B reconciliation reconnects locally parked warm sandboxes, extends their remote timeout, and can keep idle sandboxes alive indefinitely.  ### Affected area(s)  Sandbox / Docker  ### What happened?  With `sandbox.idle_timeout: 600`, an E2B sandbox is correctly released to `_warm_pool` after the agent run finishes. With no further request for that thread, the sandbox should eventually expire.  Instead, the periodic reconciliation pass calls `Sandbox.connect()` for every remote candidate before determining whether it is already tracked locally. A warm entry is not considered local because `already_local` only checks `_sandboxes`, not `_warm_pool`. When local capacity is available, the same sandbox is adopted back into `_sandboxes`; otherwise it is still probed via `connect()`.  In e2b 2.30.0, `Sandbox.connect(timeout=None)` is normalized to the SDK default sandbox timeout of 300 seconds. For a running sandbox, the connect timeout updates the sandbox when it is longer than the remaining lifetime. With the default 60-second reconciliation interval, repeated connects therefore keep pushing the expiry forward.  Observed in the provider dashboard: the sandbox lifetime grew from about 602 seconds to 985 seconds and later 1227 seconds without any new thread acti

- **Issue #5530** (2026-09-18): **[bug] DbRunEventStore deletion bypasses the per-thread mutation fence used by event writers**
  *Symptoms*: ### Before you start  - [x] I searched [existing issues](https://github.com/bytedance/deer-flow/issues?q=is%3Aissue) and this is not a duplicate. - [x] I can reproduce this on the latest `main`.  ### Problem summary  `DbRunEventStore.delete_by_thread()` / `delete_by_run()` mutate `run_events` without entering the per-thread mutation critical section that `put()`, `put_batch()` and `put_if_absent()` use, so a deletion can return while a concurrently admitted writer still commits a row for the deleted thread. The two durable event stores consequently expose different mutation semantics: `JsonlRunEventStore` already serializes deletion through `_run_mutation()`.  ### Affected area(s)  Backend API (gateway / endpoints / SSE), Agents / LangGraph (graph, prompts, langgraph.json)  ### What happened?  Writers serialize per thread twice: in-process via `_get_write_lock(thread_id)`, and cross-process on PostgreSQL via `pg_advisory_xact_lock(hashtext(thread_id))` taken inside `_max_seq_for_thread()` before `SELECT max(seq)`. Deletion takes neither — it runs `COUNT` → `DELETE` → `commit` directly, and additionally retires the write-lock pin.  Interleaving where the writer holds the fence first (PostgreSQL: MVCC, no shared lock to stop it):  ``` writer: acquire thread fence writer: SELECT max(seq) -> N delete: COUNT -> N, DELETE, COMMIT, return N writer: INSERT seq=N+1, COMMIT => the deleted thread has one visible event again ```  The JSONL backend documents the equivalent outcome explici
  **Post-Mortem & Fix Analysis**:
  > I'm going to work on this.  Rather than building on #2803's older branch, I plan to prepare a current-main replacement that preserves the cleanup scope identified there (`runs`, `run_events`, and `feedback`) while also enforcing the event-store mutation-fence prerequisite described in this issue.  I'll keep the concurrency scope here intentionally narrow: deletion/writer serialization only. Durable thread-incarnation fencing remains a separate follow-up.  The replacement PR will reference #2803 and preserve attribution to the original work there. I'll link the PR here once it is ready. 

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

### Incident Patch 1: `5c67d61d` (2026-09-30)
**Commit Message**: fix(frontend): detect artifact types from file basenames (#6091)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1822,7 +1822,7 @@ Image bytes loaded for a vision-model call are transient: DeerFlow removes the h
 
 After each run, DeerFlow records a workspace change summary for the run-owned `workspace` and `outputs` directories. The Web UI shows a compact "files changed" badge on the assistant turn; opening it reveals created, modified, and deleted files with text diffs when safe to display. Uploads are excluded because they are user inputs, not agent-generated changes, and stdio MCP temporary/debug files under the DeerFlow-owned `.mcp/` namespace are excluded because they are process-internal state (like `.git/` and `node_modules/`, any directory named `.mcp` is excluded at any depth). Large, binary, or sensitive-looking files are shown as metadata only.
 
-Files presented through `present_files` remain part of the thread's artifact state, and the Web UI restores the artifact panel and selected document after a page refresh. When a completed response successfully presents between 2 and 50 files, its final file card also offers one ZIP download. Archive membership comes from the terminal delivery receipt rather than browser-supplied paths, and the ZIP contains the current file versions, which may have changed since the response. The currently selected formal artifact is refreshed once when the run finishes so edits become visible without a manual reload. Existing UTF-8 text artifacts under `/mnt/user-data/outputs` can also be edited and explicitly saved from the panel on Unix and Windows while the thread is idle; saves use content revisions to prevent overwriting agent changes.
+Files presented through `present_files` remain part of the thread's artifact state, and the Web UI restores the artifact panel and selected document after a page refresh. When a completed response successfully presents between 2 and 50 files, its final file card also offers one ZIP download. Archive membership comes from the terminal delivery receipt rather than browser-supplied paths, and the ZIP contains the current file versions, which may have changed since the response. The currently selected formal artifact is refreshed once when the run finishes so edits become visible without a manual reload. Existing UTF-8 text artifacts under `/mnt/user-data/outputs` can also be edited and explicitly saved from the panel on Unix and Windows while the thread is idle; saves use content revisions to prevent overwriting agent changes. Source previews also recognize extensionless `Dockerfile` and `Makefile` artifacts by their file names.
 
 CSV and TSV artifacts open as tables in the artifact panel and in a separate window. The preview preserves text values (including leading zeros), supports an optional header row, and pages through up to 200 rows and 50 columns from the initial sample. Long or multiline cells can be opened and copied in full. Switch to source to inspect or edit the file; downloads and separate windows use the saved version.
 
```

**File**: `frontend/src/AGENTS.md` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@ is documented in `docs/skill-usage-ui.md`.
 Artifact URLs encode raw filesystem paths, preserving literal percent sequences.
 Only Markdown destinations decode once; relative images match decoded names
 against raw artifact paths before encoding.
+File-type detection uses the basename so extensionless `Dockerfile` and
+`Makefile` artifacts remain recognizable under nested or dotted directories.
 
 1. Optional composer helpers such as `core/input-polish` can rewrite the local draft before submission, and `core/voice-input` can transcribe browser microphone input into that same local draft; confirmed user input then flows to thread hooks (`core/threads/hooks.ts`) → LangGraph SDK streaming
 2. Stream events update thread state (messages, artifacts, todos, goal). The main thread stream uses the LangGraph SDK's `throttle: true` mode so updates received in the same macrotask coalesce before React is notified; do not replace it with a numeric delay without validating the SDK's trailing-debounce behavior on a continuous stream.
```

**File**: `frontend/src/core/utils/files.tsx` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ export function getFileName(filepath: string) {
 }
 
 export function getFileExtension(filepath: string) {
-  return filepath.split(".").pop()!.toLocaleLowerCase();
+  return getFileName(filepath).split(".").pop()!.toLocaleLowerCase();
 }
 
 export function checkCodeFile(
```

**File**: `frontend/tests/unit/components/workspace/artifacts/artifact-file-detail.dom.test.tsx` (modified, +24/-3)
```diff
@@ -48,10 +48,13 @@ rs.mock("@/core/auth/AuthProvider", () => ({
   useAuth: () => ({ user: null }),
 }));
 
-// The real editor pulls CodeMirror into the worker bundle; these tests only
-// exercise the browser-preview iframe branch, which never mounts it.
+// Inspect the source passed to the editor without bundling CodeMirror.
 rs.mock("@/components/workspace/code-editor", () => ({
-  CodeEditor: () => null,
+  CodeEditor: ({ value, language }: { value: string; language: string }) => (
+    <pre data-testid="artifact-source" data-language={language}>
+      {value}
+    </pre>
+  ),
 }));
 
 rs.mock("@/core/config", () => ({
@@ -88,6 +91,24 @@ function renderDetail(filepath: string) {
 
 beforeEach(() => {
   mocks.artifactContent.content = undefined;
+  mocks.artifactContent.sha256 = undefined;
+});
+
+describe("ArtifactFileDetail extensionless source files", () => {
+  it.each([
+    ["Dockerfile", "dockerfile", "FROM python:3.13\n"],
+    ["Makefile", "makefile", "all:\n\techo hello\n"],
+  ])("opens a stored %s as editable source", (filename, language, content) => {
+    mocks.artifactContent.content = content;
+    mocks.artifactContent.sha256 = "a".repeat(64);
+
+    const view = renderDetail(`/mnt/user-data/outputs/${filename}`);
+    const source = view.getByTestId("artifact-source");
+
+    expect(source.textContent).toBe(content);
+    expect(source.getAttribute("data-language")).toBe(language);
+    expect(view.getByRole("button", { name: "Edit" })).toBeTruthy();
+  });
 });
 
 afterEach(() => {
```

**File**: `frontend/tests/unit/core/utils/files-basename.test.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { describe, expect, it } from "@rstest/core";
+
+import { checkCodeFile, getFileExtension } from "@/core/utils/files";
+
+describe("file type detection from the basename", () => {
+  it.each([
+    ["/mnt/user-data/outputs/Dockerfile", "dockerfile"],
+    ["/mnt/user-data/outputs/Makefile", "makefile"],
+    ["/mnt/user-data/outputs/project.v1/Dockerfile", "dockerfile"],
+    ["/mnt/user-data/outputs/project.v1/Makefile", "makefile"],
+    ["Dockerfile", "dockerfile"],
+    ["Makefile", "makefile"],
+    ["/mnt/user-data/outputs/project.v1/main.PY", "python"],
+    ["/mnt/user-data/outputs/project.v1/.gitignore", "git-commit"],
+    ["/mnt/user-data/outputs/project.v1/.env", "dotenv"],
+    ["/mnt/user-data/outputs/project.v1/report%20final.py", "python"],
+  ])("recognizes %s as %s", (filepath, language) => {
+    expect(checkCodeFile(filepath)).toEqual({ isCodeFile: true, language });
+  });
+
+  it("does not infer a type from a dotted parent directory", () => {
+    const filepath = "/mnt/user-data/outputs/main.py/unknown";
+    expect(getFileExtension(filepath)).toBe("unknown");
+    expect(checkCodeFile(filepath)).toEqual({
+      isCodeFile: false,
+      language: null,
+    });
+  });
+});
```

---

### Incident Patch 2: `8e282c4c` (2026-09-30)
**Commit Message**: fix: preserve existing task notes during parallel additions (#5954)

* fix: preserve task notes during parallel additions

* docs: scope task note guidance to continuity module

* fix: reserve task note slots using resolved execution keys

Signed-off-by: ZJPex <3258236335@qq.com>

* refactor: share task-note argument key and align documentation language

Signed-off-by: ZJPex <3258236335@qq.com>

* fix: ignore malformed sibling arguments in task-note reservations

Signed-off-by: ZJPex <3258236335@qq.com>

* fix: skip structurally invalid task-note reservations

Signed-off-by: ZJPex <3258236335@qq.com>

---------

Signed-off-by: ZJPex <3258236335@qq.com>

**File**: `README.md` (modified, +13/-0)
```diff
@@ -82,6 +82,7 @@ DeerFlow has newly integrated the intelligent search and crawling toolset indepe
     - [Sub-Agents](#sub-agents)
     - [Sandbox \& File System](#sandbox--file-system)
     - [Context Engineering](#context-engineering)
+    - [Current Task Notes](#current-task-notes)
     - [Long-Term Memory](#long-term-memory)
   - [Recommended Models](#recommended-models)
   - [Embedded Python Client](#embedded-python-client)
@@ -1934,6 +1935,18 @@ in the composer and in the transcript. There is no automatic history search. See
 [configuration](backend/docs/CONFIGURATION.md#reading-referenced-conversations)
 and the [request contract](backend/docs/API.md#referencing-a-previous-conversation).
 
+### Current Task Notes
+
+Enable [task notes and history recall](docs/task-continuity.md) with `task_continuity.enabled: true`.
+A task can retain up to eight notes. Parallel additions beyond the remaining slots return
+`note_capacity`, preserving existing notes. When artifact-handle resolution is enabled,
+capacity counts resolved keys; aliases for the same note share one slot.
+Malformed non-dict sibling arguments do not consume slots or disrupt valid note calls.
+Notes with invalid keys, content over 750 characters, more than four sources, or malformed
+source IDs also reserve no slot. Existing keys can still be replaced or deleted. Slots freed
+by sibling deletions or runtime failures (such as unavailable sources or policy denial)
+become available in the next batch, when rejected additions can be retried.
+
 ### Long-Term Memory
 
 The opt-in [DeerMem scope-isolation benchmark](backend/scripts/benchmark/deermem_scope_isolation/README.md)
```

**File**: `README_zh.md` (modified, +10/-0)
```diff
@@ -74,6 +74,7 @@ DeerFlow 新近集成了 BytePlus 自研的智能搜索与抓取工具集——[
     - [Sandbox 与文件系统](#sandbox-与文件系统)
     - [Agentic Browser Control](#agentic-browser-control)
     - [Context Engineering](#context-engineering)
+    - [当前任务笔记](#当前任务笔记)
     - [长期记忆](#长期记忆)
   - [推荐模型](#推荐模型)
   - [内嵌 Python Client](#内嵌-python-client)
@@ -797,6 +798,15 @@ Gateway API 调用方可以启用 `read_conversation`，并在一次 run 中提
 
 无法在请求顶层添加字段的 SDK 客户端可以把同样的列表放在 `context.conversation_references` 中发送，`GET /api/features` 会报告该工具是否启用。启用后，Web UI 输入框会在附件按钮旁边显示一个"引用会话"按钮：最多选择你最近的三个会话，它们只附加到下一条消息上，以 chips 的形式显示在输入框与对话记录里。不会自动搜索历史。参见[配置](backend/docs/CONFIGURATION.md#reading-referenced-conversations)与[请求契约](backend/docs/API.md#referencing-a-previous-conversation)。
 
+### 当前任务笔记
+
+当前任务可通过 `task_continuity.enabled: true` 开启[任务笔记与历史回查](docs/task-continuity.md)。
+任务笔记最多八条；并行新增超出剩余名额时返回 `note_capacity`，保留原有笔记。
+启用资源句柄解析时按解析后的实际 key 计数，指向同一笔记的别名共用名额。
+同批调用中格式异常的非字典参数不会占用名额或影响正常笔记调用。
+无效 key、超过 750 字符的内容、超过四个引用或格式无效的引用 ID 也不会占用名额。
+已有 key 仍可替换或删除；同批删除及运行时失败（如来源不可读或策略拒绝）释放的名额在下一批可用，可届时重试。
+
 ### 长期记忆
 
 大多数 agents 会在对话结束后把一切都忘掉，DeerFlow 不一样。
```

**File**: `backend/packages/harness/deerflow/agents/middlewares/TOOL_ARTIFACTS.md` (modified, +5/-0)
```diff
@@ -4,6 +4,11 @@
 
 *(optional, if `tool_artifacts.enabled && tool_artifacts.resolve_handles_in_args`, default on)* Resolves `art_xxxxxxxx` artifact handles found in tool-call arguments to their real references (`ThreadState.tool_artifacts[].real_ref`) before the tool executes (issue #4676). Runs after the outer receipt layer and before authorization/guardrail, sandbox-audit, read-before-write and progress policies; the same resolved arguments reach policy and execution. Declarative constraints enforce this order even after extension insertion. It mutates only the request args, never the message history. Handles may appear bare, inside backticks, or nested in dict/list args; unknown or expired handles return an error ToolMessage naming the missing handles and up to ten current handles, without executing the tool. This applies even to an empty registry; ordinary concrete arguments and disabled-feature behavior remain unchanged. Both config flags must be on — disabling `tool_artifacts.enabled` stops resolution for threads that still carry registry state.
 
+Task-note batch reservations read the same resolver's argument view from the
+call-local `ToolRuntime.state`, using `RESOLVED_TOOL_CALL_ARGS_KEY` from
+`deerflow.agents.task_continuity.state`. Aliases share a slot by resolved key;
+message history and checkpoints remain unchanged.
+
 ## Capture
 
 *(optional, if `tool_artifacts.enabled`, default on)* Captures lightweight artifact references from tool results into `ThreadState.tool_artifacts` (a reducer channel, so entries survive summarization compaction). `tool_artifacts.enabled` gates the whole middleware (capture and consumption tracking); when off, `before_model` returns nothing regardless of registry state. Runs as a `before_model` hook (never wraps a `ToolMessage` in a `Command`). `ThreadState.tool_artifact_processed` stores deduplicated hashes of processed result and settled consuming-call occurrences through an additive reducer. It records empty results too. The ledger is independent of registry retention and survives checkpoint reload, graph recreation and compaction; it is not trimmed with artifacts and grows by a small identity record per processed occurrence. Never replace it with a process-local memo or infer it from currently retained handles. A missing handle gets one retry before its consuming-call occurrence settles, so permanently unknown or evicted handles are scanned at most twice, including across restarts; same-round consumption resolves against state plus pending captures. Capture and consumption updates concatenate list channels so neither is lost. Position-independent in the tool-execution wrap chain: it is a `before_model` hook reading state messages, so it sees the normalized results stored in state regardless of its wrap position (error results are skipped at extraction via `status == "error"`); it is appended after ToolErrorHandlingMiddleware for readability only. Handles are `art_` + 8 hex chars derived deterministically from (thread_id, durable ToolMessage.id, provider tool_call_id, per-result ordinal). Provider call IDs may repeat across turns; graph-assigned message IDs distinguish occurrences and remain stable after compaction. Standalone ID-less hook callers must supply distinct call indices. These short hashes are identifiers, not ownership credentials. Extraction combines all of: structured-content string values under known keys (`file`/`path`/`url`/`task_id`/...) as concrete refs (unknown or non-reference payloads fall back to complete JSON `data` only when they fit 4096 UTF-8 bytes, 1024 nodes and 32 levels; empty and oversized payloads are skipped before unbounded serialization), `file`/`image` content blocks with HTTP(S), Unix-absolute or drive-absolute references (`data:`/`blob:` URIs are rejected so embedded-resource payloads never enter state or tool args), and conservative free-text scanning of both text blocks and plain-string results such as built-in sandbox tool output (sandbox 
```

**File**: `backend/packages/harness/deerflow/agents/middlewares/artifact_resolution_middleware.py` (modified, +11/-1)
```diff
@@ -12,15 +12,17 @@
 
 import re
 from collections.abc import Awaitable, Callable
+from dataclasses import replace
 from typing import override
 
 from langchain.agents import AgentState
 from langchain.agents.middleware import AgentMiddleware
-from langchain_core.messages import ToolMessage
+from langchain_core.messages import AIMessage, ToolMessage
 from langgraph.prebuilt.tool_node import ToolCallRequest
 from langgraph.types import Command
 
 from deerflow.agents.middlewares.tool_result_meta import normalize_tool_result
+from deerflow.agents.task_continuity.state import RESOLVED_TOOL_CALL_ARGS_KEY
 from deerflow.config.tool_artifact_config import ToolArtifactConfig
 
 _HANDLE_PATTERN = r"(?:`(art_[0-9a-f]{8})`|(?<!\w)(art_[0-9a-f]{8})(?!\w))"
@@ -85,6 +87,14 @@ def _resolve_request(self, request: ToolCallRequest) -> ToolCallRequest | ToolMe
             )
             return normalize_tool_result(message, tool_call_id=message.tool_call_id)
 
+        # Share resolved batch arguments for note admission only in this runtime; preserve message history.
+        if request.tool_call.get("name") == "task_note" and request.runtime is not None:
+            runtime = request.runtime
+            message = next((message for message in reversed(runtime.state.get("messages", [])) if isinstance(message, AIMessage)), None)
+            if message is not None:
+                resolved_calls = {call["id"]: self._resolve_value(call["args"], handle_map) for call in message.tool_calls if call["name"] == "task_note"}
+                request = replace(request, runtime=replace(runtime, state={**runtime.state, RESOLVED_TOOL_CALL_ARGS_KEY: resolved_calls}))
+
         resolved_args = self._resolve_value(args, handle_map)
         if resolved_args == args:
             return request
```

**File**: `backend/packages/harness/deerflow/agents/task_continuity/AGENTS.md` (modified, +15/-0)
```diff
@@ -1,5 +1,20 @@
 # Task continuity
 
+When changing `task_note` capacity or batch receipts, follow the
+[continuity contract](../../../../../../docs/task-continuity.md) and run the real
+graph regressions in `backend/tests/test_task_note_capacity.py`; locking one
+snapshot cannot coordinate parallel Commands. With handle resolution enabled,
+reservations use the same resolver as execution through the call-local argument
+view supplied by `ArtifactResolutionMiddleware`. Both modules import
+`RESOLVED_TOOL_CALL_ARGS_KEY` from `state.py`. This view stays in the current
+`ToolRuntime.state`, outside messages and checkpoints. Disabled resolution and
+direct tool graphs retain raw arguments. Skip non-dict sibling arguments before
+reading note fields so malformed calls cannot break valid sibling receipts.
+Reservation and execution share `_note_shape_error` for key, content and source
+structure checks. Skip structurally invalid calls without source lookups during
+reservation; source availability and policy denial remain runtime outcomes whose
+unused slots are recalculated in the next batch.
+
 `history_search` accepts optional `role=user|assistant|tool`, mapped at the tool
 boundary to stored roles `human|ai|tool`; omission/null keeps all roles. Filter
 archived JSON payloads before SQLite FTS `LIMIT 8`, and active messages before
```

---

### Incident Patch 3: `2000bffa` (2026-09-30)
**Commit Message**: fix(harness): anchor DeerFlowClient agent-name validation with fullmatch (#6104)

**File**: `backend/packages/harness/deerflow/client.py` (modified, +1/-1)
```diff
@@ -254,7 +254,7 @@ def __init__(
         self._checkpoint_channel_mode = freeze_checkpoint_channel_mode(self._app_config.database.checkpoint_channel_mode)
         self._checkpoint_snapshot_frequency = freeze_checkpoint_snapshot_frequency(self._app_config.database.checkpoint_delta.snapshot_frequency)
 
-        if agent_name is not None and not AGENT_NAME_PATTERN.match(agent_name):
+        if agent_name is not None and not AGENT_NAME_PATTERN.fullmatch(agent_name):
             raise ValueError(f"Invalid agent name '{agent_name}'. Must match pattern: {AGENT_NAME_PATTERN.pattern}")
 
         self._checkpointer = checkpointer
```

**File**: `backend/tests/test_client.py` (modified, +7/-0)
```diff
@@ -121,6 +121,13 @@ def test_invalid_agent_name(self, mock_app_config):
             with pytest.raises(ValueError, match="Invalid agent name"):
                 DeerFlowClient(agent_name="../path/traversal")
 
+    def test_agent_name_with_trailing_newline_rejected(self, mock_app_config):
+        with patch("deerflow.client.get_app_config", return_value=mock_app_config):
+            # The client's own guard must reject this at construction; the
+            # memory store's later fullmatch check uses different phrasing.
+            with pytest.raises(ValueError, match="Must match pattern"):
+                DeerFlowClient(agent_name="reviewer\n")
+
     def test_custom_config_path(self, mock_app_config):
         with (
             patch("deerflow.client.reload_app_config") as mock_reload,
```

---

### Incident Patch 4: `25671538` (2026-09-30)
**Commit Message**: fix(cli): exit non-zero when a headless run ends in an LLM error fallback (#6056)

* fix(cli): exit non-zero when a headless run ends in an LLM error fallback

LLMErrorHandlingMiddleware turns provider failures (e.g. an expired
credential returning 401) into an AIMessage flagged
`deerflow_error_fallback` instead of raising. The Gateway run status and
the subagent executor already treat that flag as a failure. #5963 gave
`deerflow --print` / `--json` an error boundary for raised exceptions,
but a flagged fallback never raises, so both modes still printed the
fallback text and exited 0.

Both headless modes now follow #5963's failure contract when the run's
final AI message carries the flag: `--print` keeps the fallback text on
stdout and adds an `Error:` line on stderr; `--json` appends the terminal
`{"type": "error"}` record. Both exit 1.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* refactor(cli): share final-answer accumulation with the embedded client

* docs: scope headless accumulator guidance to TUI

---------

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Co-authored-by: Willem Jiang <willem.jiang@gmail.com>

**File**: `README.md` (modified, +2/-0)
```diff
@@ -2266,6 +2266,8 @@ deerflow --json  "hello"                       # headless newline-delimited Stre
 deerflow --recursion-limit 250 --print "task" # override the headless agent-loop limit
 ```
 
+Headless `--print` and `--json` exit with status `1` when the run fails, including provider errors returned as fallback messages. `--print` still writes the fallback text to stdout; `--json` appends a terminal error record.
+
 A keyboard-driven chat surface with a streaming transcript (Markdown-rendered answers), compact tool-activity cards, a `/` slash-command palette, display-only `/clear`, `/goal` goal management, `/model` and `/threads` pickers, input history, PageUp/PageDown transcript navigation, and `Esc` / `Ctrl+C` interrupt. Transcript refreshes preserve your reading position after you scroll upward and resume following new output when you return to the bottom. `/clear` removes rows from the current terminal display without deleting the thread or its persisted conversation; `/new` and `/clear` ask you to wait during an active run instead of resetting in-flight display state. Sessions opened in the TUI also appear in the Web UI sidebar — it writes the shared thread store under the local default user, so terminal and web stay in sync **without running the Gateway**.
 
 See [backend/docs/TUI.md](backend/docs/TUI.md) for the full guide.
```

**File**: `backend/docs/TUI.md` (modified, +7/-0)
```diff
@@ -36,6 +36,13 @@ Launch modes:
 If no TTY is available and no headless flag is given, `deerflow` prints guidance
 instead of hanging.
 
+Provider failures (for example an expired credential) usually do not raise: the
+LLM error middleware turns them into a final AI message flagged
+`deerflow_error_fallback`. Headless runs treat that as a failure too — `--print`
+still writes the fallback text to stdout, then prints
+`Error: LLM request failed (error_type=…, error_reason=…)` to stderr; `--json`
+appends the same terminal `{"type": "error"}` record. Both exit `1`.
+
 Transparent rendering is opt-in; the solid DeerFlow palette remains the default.
 The transparent mode uses Textual's `ansi_default` background for the main
 screen, header, transcript, status, palette, composer, and modal surfaces while
```

**File**: `backend/packages/harness/deerflow/AGENTS.md` (modified, +2/-2)
```diff
@@ -52,10 +52,10 @@ drift.
 
 ### Embedded Client (`packages/harness/deerflow/client.py`)
 
-`DeerFlowClient` provides in-process access without HTTP/FastAPI, sharing Gateway's `deerflow` modules, config, data directories, and response schemas.
+`DeerFlowClient` embeds the harness without HTTP/FastAPI, sharing Gateway modules, config, data directories, and response schemas.
 
 **Agent Conversation**:
-- `chat(message, thread_id)` — synchronous, accumulates streaming deltas per message-id and returns the final AI text
+- `chat(message, thread_id)` — synchronous; returns final AI text.
 - `stream(message, thread_id)` — subscribes to LangGraph `stream_mode=["values", "messages", "custom"]` and yields `StreamEvent`:
   - `"values"` — state snapshot (title, messages, artifacts, summary_text). Always forward `summary_text` (current summary or `None`), including unchanged values/resets. Never re-emit AI text delivered via `messages`; serialized `ToolMessage` entries retain non-`None` native `artifact`
   - `"messages-tuple"` — current-turn AI text **deltas** by `id` and each tool call/result once; excludes resumed history and preserves result `artifact`
```

**File**: `backend/packages/harness/deerflow/client.py` (modified, +27/-11)
```diff
@@ -146,6 +146,30 @@ class StreamEvent:
     data: dict[str, Any] = field(default_factory=dict)
 
 
+class _AIMessageAccumulator:
+    """Accumulate text for the last content-bearing AI message id.
+
+    Metadata-only updates do not select a new id. Both ``chat()`` and the
+    headless CLI use this rule to choose the final answer.
+    """
+
+    def __init__(self) -> None:
+        # Join once at the end to avoid quadratic copying of long responses.
+        self._chunks: dict[str, list[str]] = {}
+        self.last_id = ""
+
+    def observe(self, event: StreamEvent) -> None:
+        if event.type != "messages-tuple" or event.data.get("type") != "ai":
+            return
+        if delta := event.data.get("content", ""):
+            msg_id = event.data.get("id") or ""
+            self._chunks.setdefault(msg_id, []).append(delta)
+            self.last_id = msg_id
+
+    def answer(self) -> str:
+        return "".join(self._chunks.get(self.last_id, ()))
+
+
 class DeerFlowClient:
     """Embedded Python client for DeerFlow agent system.
 
@@ -1289,18 +1313,10 @@ def chat(self, message: str, *, thread_id: str | None = None, **kwargs) -> str:
             The accumulated text of the last AI message, or empty string
             if no AI text was produced.
         """
-        # Per-id delta lists joined once at the end — avoids the O(n²) cost
-        # of repeated ``str + str`` on a growing buffer for long responses.
-        chunks: dict[str, list[str]] = {}
-        last_id: str = ""
+        answer = _AIMessageAccumulator()
         for event in self.stream(message, thread_id=thread_id, **kwargs):
-            if event.type == "messages-tuple" and event.data.get("type") == "ai":
-                msg_id = event.data.get("id") or ""
-                delta = event.data.get("content", "")
-                if delta:
-                    chunks.setdefault(msg_id, []).append(delta)
-                    last_id = msg_id
-        return "".join(chunks.get(last_id, ()))
+            answer.observe(event)
+        return answer.answer()
 
     # ------------------------------------------------------------------
     # Public API — configuration queries
```

**File**: `backend/packages/harness/deerflow/tui/AGENTS.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 A terminal-native UI over the embedded harness, exposed as the `deerflow` console script (`[project.scripts]` in `packages/harness/pyproject.toml`). It is a UI shell over `DeerFlowClient` and does **not** fork agent behavior. `textual` is an optional dependency (`deerflow-harness[tui]`; also in the backend dev group); the console script degrades to headless help when it is absent. Full guide: [docs/TUI.md](../../../../docs/TUI.md).
 
 **Module layout** (all layers except `app.py` are pure / Textual-free and unit-tested directly):
-- `cli.py` — `plan_launch()` (pure launch-mode decision) + headless `--print` / `--json` + `main()` entry point. TTY → TUI, else headless help. `--tui-transparent` / `DEER_FLOW_TUI_TRANSPARENT` opt into terminal-default backgrounds without changing the solid-theme default. Uses an **absolute** `from deerflow.tui.app import run_tui` so the `app.py` module name doesn't trip `test_harness_boundary.py` (which records relative import module names verbatim).
+- `cli.py` — `plan_launch()` (pure launch-mode decision) + headless `--print` / `--json` + `main()` entry point. Headless modes exit `1` when the final AI message carries `deerflow_error_fallback` (provider failures arrive as flagged messages, not exceptions). `_RunOutcome` and `chat()` share `_AIMessageAccumulator`: deltas accumulate per message id and the last content-bearing AI id supplies the text; metadata-only events preserve that id. Fallback writers must supply text or flag an id whose text was already emitted. Keep the client import lazy so help and launch planning do not load the agent graph. TTY → TUI, else headless help. `--tui-transparent` / `DEER_FLOW_TUI_TRANSPARENT` opt into terminal-default backgrounds without changing the solid-theme default. Uses an **absolute** `from deerflow.tui.app import run_tui` so the `app.py` module name doesn't trip `test_harness_boundary.py` (which records relative import module names verbatim).
 - `view_state.py` — `ViewState` + `reduce(state, action)`, the testable heart. Rows: user / assistant / tool / system. Title captured from `values` events.
 - `runtime.py` — `translate(StreamEvent) -> [Action]` (pure) + `stream_actions()` which brackets a run with `RunStarted`/`RunEnded` and turns model errors into an `AssistantError` row.
 - `message_format.py` / `command_registry.py` / `input_history.py` / `render.py` / `theme.py` — pure helpers (tool summaries, slash registry + `resolve()`, ↑/↓ history, Rich renderers). The command registry must exclude every shared `RESERVED_SLASH_SKILL_NAMES` entry that the agent runtime rejects from both its picker and resolver; the `context` skill is the exception for ordinary task text, while the exact composer-only `/context compact` alias remains unavailable as a skill activation.
```

---

### Incident Patch 5: `8432e4b7` (2026-09-30)
**Commit Message**: fix(gateway): drain agent and user-profile writes across cancellation (#6087)

* fix(gateway): drain agent and user-profile writes across cancellation

A client that disconnects mid-request cancels the handler task. On the four
persistent-write endpoints of /api/agents - create, update, delete, and the
USER.md write - a bare asyncio.to_thread then either cancels a still-queued
worker (the write silently never happens) or detaches from a running one and
drops its failure, because the handler's except never runs.

Route the four writes through await_drained like the managed-subagent (#6023),
managed-model (#6024), and custom-skill (#6078) mutations, logging a lost
worker failure with the exception type only before the drain consumes it.
Expected domain errors (AgentExistsError on create) re-raise unlogged; the
caller still maps them to a 409 while connected. Reads stay bare: abandoning
them loses nothing.

Signed-off-by: yetuge <2219677952@qq.com>

* fix(gateway): address review nits on the agents write drain

Make expected_errors a positional-only parameter before *args so the
ParamSpec signature is checker-clean under PEP 612 (the one call site with
extra worker arguments passes ()

**File**: `backend/app/gateway/routers/agents.py` (modified, +39/-4)
```diff
@@ -3,6 +3,7 @@
 import asyncio
 import logging
 import re
+from collections.abc import Callable
 from pathlib import Path
 from typing import Literal
 
@@ -26,10 +27,44 @@
 from deerflow.knowledge_scope import KnowledgeScope, canonicalize_knowledge_scope
 from deerflow.persistence.agents import AgentDeleteOutcome, AgentExistsError, get_agent_store
 from deerflow.runtime.user_context import get_effective_user_id
+from deerflow.utils.file_io import await_drained
 
 logger = logging.getLogger(__name__)
 router = APIRouter(prefix="/api", tags=["agents"])
 
+
+async def _drained_write[**P, T](
+    action: str,
+    func: Callable[P, T],
+    expected_errors: tuple[type[Exception], ...] = (),
+    /,
+    *args: P.args,
+    **kwargs: P.kwargs,
+) -> T:
+    """Run a persistent write off the event loop and drain it across cancellation.
+
+    A client that disconnects mid-request cancels the handler task: a bare
+    ``asyncio.to_thread`` either cancels a still-queued worker — the write
+    silently never happens — or detaches from a running one, dropping its
+    failure because the handler's ``except`` never runs. ``await_drained``
+    lets the worker finish first; expected domain errors re-raise unlogged
+    (the caller maps them to a 4xx while still connected), anything else is
+    logged with the exception type only — the text can carry user content.
+    """
+
+    def _logged() -> T:
+        try:
+            return func(*args, **kwargs)
+        except expected_errors:
+            raise
+        except Exception as exc:
+            # Non-cancelled failures are logged again by the outer route handler.
+            logger.error("%s failed (%s)", action, type(exc).__name__)
+            raise
+
+    return await await_drained(asyncio.to_thread(_logged))
+
+
 AGENT_NAME_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")
 
 ReasoningEffort = Literal["low", "medium", "high"]
@@ -376,7 +411,7 @@ def _create_agent() -> AgentResponse:
         return _agent_config_to_response(agent_cfg, include_soul=True, user_id=user_id)
 
     try:
-        return await asyncio.to_thread(_create_agent)
+        return await _drained_write("Create agent", _create_agent, (AgentExistsError,))
     except AgentExistsError:
         raise HTTPException(status_code=409, detail=f"Agent '{normalized_name}' already exists")
     except Exception as e:
@@ -501,7 +536,7 @@ def _is_legacy_only_layout() -> bool:
             def _update_agent() -> None:
                 get_agent_store().update(name, updated, body.soul, user_id=user_id)
 
-            await asyncio.to_thread(_update_agent)
+            await _drained_write("Update agent", _update_agent)
 
         logger.info(f"Updated agent '{name}'")
 
@@ -600,7 +635,7 @@ def _write_profile() -> Path:
         return user_md_path
 
     try:
-        user_md_path = await asyncio.to_thread(_write_profile)
+        user_md_path = await _drained_write("Update user profile", _write_profile)
         logger.info(f"Updated USER.md at {user_md_path}")
         return UserProfileResponse(content=body.content or None)
     except Exception as e:
@@ -633,7 +668,7 @@ async def delete_agent(name: str, request: Request) -> None:
     try:
         # Off the event loop: resolve store + cancel → delete → cancel-on-success
         # (get_agent_store / memory manager do blocking config and FS I/O).
-        outcome = await asyncio.to_thread(_delete_agent_with_memory_cancel, name, user_id)
+        outcome = await _drained_write("Delete agent", _delete_agent_with_memory_cancel, (), name, user_id)
     except Exception as e:
         logger.error(f"Failed to delete agent '{name}': {e}", exc_info=True)
         raise HTTPException(status_code=500, detail=f"Failed to delete agent: {str(e)}")
```

**File**: `backend/tests/test_agents_router_write_drain.py` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+"""Agent-router persistent writes drain across handler cancellation.
+
+The gateway convention (managed subagents, managed models, custom skills) is
+that a client disconnect must not cancel a queued persistence worker or
+silently drop its failure. The agent store writes (create / update / delete)
+and the USER.md write route through ``await_drained`` the same way; reads stay
+bare because abandoning them loses nothing.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import concurrent.futures
+import logging
+import threading
+from pathlib import Path
+
+import pytest
+
+from app.gateway.routers.agents import (
+    AgentCreateRequest,
+    AgentUpdateRequest,
+    UserProfileUpdateRequest,
+    create_agent_endpoint,
+    get_agent,
+    update_agent,
+    update_user_profile,
+)
+from deerflow.config.agents_api_config import load_agents_api_config_from_dict
+from deerflow.config.app_config import AppConfig, reset_app_config, set_app_config
+from deerflow.config.model_config import ModelConfig
+from deerflow.config.sandbox_config import SandboxConfig
+
+pytestmark = pytest.mark.asyncio
+
+
+@pytest.fixture
+def _agent_env(tmp_path: Path, monkeypatch):
+    monkeypatch.setenv("DEER_FLOW_HOME", str(tmp_path))
+    monkeypatch.setattr("deerflow.config.paths._paths", None)
+    load_agents_api_config_from_dict({"enabled": True})
+    set_app_config(
+        AppConfig(
+            models=[ModelConfig(name="agent-model", display_name="Agent Model", description=None, use="langchain_openai:ChatOpenAI", model="agent-model")],
+            sandbox=SandboxConfig(use="deerflow.sandbox.local:LocalSandboxProvider"),
+        )
+    )
+    try:
+        yield
+    finally:
+        load_agents_api_config_from_dict({})
+        reset_app_config()
+
+
+async def test_agent_persistent_writes_route_through_write_drain(_agent_env, monkeypatch):
+    from app.gateway.routers import agents as router
+
+    calls: list[str] = []
+
+    async def drained(action, func, expected_errors=(), /, *args, **kwargs):
+        calls.append(action)
+        assert isinstance(expected_errors, tuple)
+        return func(*args, **kwargs)
+
+    monkeypatch.setattr(router, "_drained_write", drained)
+
+    await create_agent_endpoint(AgentCreateRequest(name="planner", model="agent-model"))
+    await update_agent("planner", AgentUpdateRequest(description="later"))
+    await get_agent("planner")
+    await update_user_profile(UserProfileUpdateRequest(content="prefs"))
+    await router.delete_agent("planner")
+
+    assert calls == ["Create agent", "Update agent", "Update user profile", "Delete agent"]
+
+
+async def test_agent_update_drains_started_store_write_across_repeated_cancellation(_agent_env, monkeypatch):
+    from app.gateway.routers import agents as router
+
+    await create_agent_endpoint(AgentCreateRequest(name="planner", model="agent-model"))
+
+    started = threading.Event()
+    release = threading.Event()
+
+    class BlockingStore:
+        def update(self, *_args, **_kwargs):
+            started.set()
+            assert release.wait(timeout=5)
+
+    monkeypatch.setattr(router, "get_agent_store", lambda: BlockingStore())
+
+    task = asyncio.create_task(update_agent("planner", AgentUpdateRequest(description="later")))
+    try:
+        assert await asyncio.to_thread(started.wait, 5)
+        task.cancel()
+        await asyncio.sleep(0.05)
+        task.cancel()
+        await asyncio.sleep(0.05)
+        assert not task.done()
+
+        release.set()
+        with pytest.raises(asyncio.CancelledError):
+            await task
+    finally:
+        release.set()
+        if not task.done():
+            task.cancel()
+            await asyncio.gather(task, return_exceptions=True)
+
+
+async def test_agent_update_logs_lost_worker_failure_after_cancellation(_agent_env, monkeypatch, caplog):
+    from app.gateway.routers import agents as router
+
+    await create_agent_endpoint(AgentCreateRequest(name=
```

---

### Incident Patch 6: `4343ced6` (2026-09-30)
**Commit Message**: fix(mcp): drain personal config mutations on cancellation (#6093)

* fix(mcp): drain personal config mutations on cancellation

* test(mcp): cover cancelled personal config mutation

* test(mcp): remove unused cancellation event

* test: remove unused event loop from personal MCP cancellation regression

---------

Co-authored-by: Willem Jiang <willem.jiang@gmail.com>

**File**: `backend/app/gateway/routers/personal_mcp.py` (modified, +2/-1)
```diff
@@ -12,6 +12,7 @@
 from deerflow.capabilities.runtime import ambiguous_installation_ids
 from deerflow.config.extensions_config import ExtensionsConfig, atomic_write_extensions_config, extensions_config_file_lock, extensions_config_write_lock
 from deerflow.mcp.user_config import read_user_mcp_config, user_mcp_config_path
+from deerflow.utils.file_io import await_drained
 
 router = APIRouter(prefix="/api/mcp/personal/config", tags=["mcp"])
 
@@ -102,7 +103,7 @@ async def get_configuration(request: Request):
 async def _write(request: Request, operation: str, body):
     owner = await _owner(request)
     admin = await is_admin_user(request)
-    raw = await asyncio.to_thread(_mutate, owner, operation, body, admin=admin)
+    raw = await await_drained(asyncio.to_thread(_mutate, owner, operation, body, admin=admin))
     return _response(raw)
 
 
```

**File**: `backend/tests/test_personal_mcp.py` (modified, +35/-0)
```diff
@@ -48,6 +48,41 @@ def create(client, user, *, name="github", token=None, role="admin"):
     )
 
 
+@pytest.mark.asyncio
+async def test_personal_config_write_drains_started_mutation_across_cancellation(monkeypatch):
+    started = asyncio.Event()
+
+    monkeypatch.setattr(personal_mcp, "_owner", AsyncMock(return_value="alice"))
+    monkeypatch.setattr(personal_mcp, "is_admin_user", AsyncMock(return_value=True))
+
+    def mutate(*_args, **_kwargs):
+        started_loop.call_soon_threadsafe(started.set)
+        release_thread.wait(timeout=5)
+        return {"mcpServers": {}}
+
+    import threading
+
+    started_loop = asyncio.get_running_loop()
+    release_thread = threading.Event()
+    monkeypatch.setattr(personal_mcp, "_mutate", mutate)
+
+    task = asyncio.create_task(personal_mcp._write(SimpleNamespace(), "delete", "missing"))
+    try:
+        await asyncio.wait_for(started.wait(), timeout=5)
+        task.cancel()
+        await asyncio.sleep(0)
+        assert not task.done()
+
+        release_thread.set()
+        with pytest.raises(asyncio.CancelledError):
+            await task
+    finally:
+        release_thread.set()
+        if not task.done():
+            task.cancel()
+            await asyncio.gather(task, return_exceptions=True)
+
+
 def test_persistent_same_name_connections_are_owner_only(personal_client):
     client = personal_client
     assert client.get("/api/mcp/personal/config").status_code == 401
```

---

### Incident Patch 7: `f6137276` (2026-09-30)
**Commit Message**: fix(agents): anchor agent-name validation against a trailing newline (#5960)

* fix(agents): anchor agent-name validation against a trailing newline

Two copies of the shared ^[A-Za-z0-9-]+$ grammar still used re.match,
whose $ also matches before a final newline, while every other copy uses
fullmatch. POST /api/agents {"name": "reviewer\n"} therefore passed the
router guard and died inside the strict file store as an HTTP 500, and
DeerMem accepted the same name as an agents/{name}/facts directory.

* test(agents): state which trailing-newline params the regression actually covered

.match only accepted "reviewer\n" on main; "reviewer\n\n" and "reviewer \n"
were already rejected, so the docstrings should not read as if every param in
these parametrizations was broken before the fix.

**File**: `backend/app/gateway/routers/agents.py` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ def _validate_agent_name(name: str) -> None:
     Raises:
         HTTPException: 422 if the name is invalid.
     """
-    if not AGENT_NAME_PATTERN.match(name):
+    if not AGENT_NAME_PATTERN.fullmatch(name):
         raise HTTPException(
             status_code=422,
             detail=f"Invalid agent name '{name}'. Must match ^[A-Za-z0-9-]+$ (letters, digits, and hyphens only).",
```

**File**: `backend/packages/harness/deerflow/agents/memory/backends/deermem/deermem/core/paths.py` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ def validate_agent_name(name: str) -> None:
     """Validate that the agent name is safe to use in filesystem paths."""
     if not name:
         raise ValueError("Agent name must be a non-empty string.")
-    if name != DEFAULT_AGENT_BUCKET and not AGENT_NAME_PATTERN.match(name):
+    if name != DEFAULT_AGENT_BUCKET and not AGENT_NAME_PATTERN.fullmatch(name):
         raise ValueError(f"Invalid agent name {name!r}: names must match {AGENT_NAME_PATTERN.pattern}")
 
 
```

**File**: `backend/tests/test_custom_agent.py` (modified, +31/-1)
```diff
@@ -12,7 +12,7 @@
 
 from app.gateway.routers.agents import AGENT_NAME_PATTERN as GATEWAY_AGENT_NAME_PATTERN
 from deerflow.agents.memory.backends.deermem.deermem.core.paths import AGENT_NAME_PATTERN as DEERMEM_AGENT_NAME_PATTERN
-from deerflow.agents.memory.backends.deermem.deermem.core.paths import DEFAULT_AGENT_BUCKET, validate_agent_name
+from deerflow.agents.memory.backends.deermem.deermem.core.paths import DEFAULT_AGENT_BUCKET, agent_facts_directory, validate_agent_name
 from deerflow.config.agents_api_config import AgentsApiConfig, get_agents_api_config, set_agents_api_config
 
 # ---------------------------------------------------------------------------
@@ -26,6 +26,24 @@ def test_reserved_memory_bucket_stays_outside_both_public_agent_patterns() -> No
     validate_agent_name(DEFAULT_AGENT_BUCKET)  # Internal storage sentinel remains usable.
 
 
+@pytest.mark.parametrize("name", ["reviewer\n", "reviewer \n"])
+def test_agent_name_validation_rejects_trailing_newline(name: str) -> None:
+    """``$`` in ``^[A-Za-z0-9-]+$`` also matches before a final newline.
+
+    Only ``fullmatch`` anchors it, so DeerMem's inlined copy of the host's
+    agent-name grammar accepted ``"reviewer\\n"`` and used it as a directory
+    name — which the host's own strict validator then refuses forever.
+
+    ``"reviewer \\n"`` was already rejected by ``.match`` (the space falls
+    outside the class, so the match never reaches ``$``); it is parametrized
+    here to pin the grammar, not because it regressed.
+    """
+    with pytest.raises(ValueError, match="Invalid agent name"):
+        validate_agent_name(name)
+    with pytest.raises(ValueError, match="Invalid agent name"):
+        agent_facts_directory(Path("memory.json"), name)
+
+
 def _make_paths(base_dir: Path):
     """Return a Paths instance pointing to base_dir."""
     from deerflow.config.paths import Paths
@@ -609,6 +627,18 @@ def test_invalid_display_name_cannot_be_persisted(self, agent_client, display_na
         assert agent_client.put("/api/agents/reviewer", json={"display_name": display_name}).status_code == 422
         assert agent_client.get("/api/agents/reviewer").json()["display_name"] == "🦌" * 100
 
+    @pytest.mark.parametrize("name", ["reviewer\n", "reviewer\n\n"])
+    def test_trailing_newline_in_agent_name_is_rejected(self, agent_client, name):
+        """The router's ``AGENT_NAME_PATTERN.match`` accepted ``"reviewer\\n"`` and the store 500'd.
+
+        ``$`` matches before a single trailing newline, so that one param reached
+        the file store, which validates the same grammar with ``fullmatch``.
+        ``"reviewer\\n\\n"`` was already rejected by ``.match`` on main; it is
+        parametrized to pin the grammar, not because it regressed.
+        """
+        assert agent_client.post("/api/agents", json={"name": name}).status_code == 422
+        assert agent_client.get("/api/agents").json()["agents"] == []
+
     def test_display_name_round_trip_keeps_stable_identity(self, agent_client):
         response = agent_client.post("/api/agents", json={"name": "code-reviewer", "display_name": "  代码审查助手  "})
         assert response.status_code == 201
```

---

### Incident Patch 8: `a83aebe7` (2026-09-30)
**Commit Message**: fix(docs): harness docs document an async client API that does not exist (#5843)

* docs: replace nonexistent async client API in harness docs

DeerFlowClient has no async methods: client.astream() and client.ainvoke()
do not exist, so the "Create Your First Harness" tutorial and the harness
integration guide fail with AttributeError on their first call. Overrides
were also shown as a nested config={"configurable": {...}} dict, which
stream()/chat() swallow via **kwargs and silently ignore.

Switch the examples to the shipping API (sync stream()/chat(), flat kwarg
overrides, agent_name as a constructor arg) in the EN and ZH copies of both
pages. backend/docs/STREAMING.md is left alone: its astream mentions are
design discussion and LangGraph internals, not user-facing examples.

Assisted-by: Claude Code / claude-opus-5
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Signed-off-by: Anton Dziatkovskii <194927794+tonydzi@users.noreply.github.com>

* docs: serialize StreamEvent before StreamingResponse, use real event names

Review follow-up on the two points raised in #5843.

P2 — the streaming examples handed a generator of `StreamEvent` dataclasses
straight to Sta

**File**: `frontend/src/content/en/harness/integration-guide.mdx` (modified, +37/-45)
```diff
@@ -21,36 +21,35 @@ The primary integration point is `DeerFlowClient`. It wraps the LangGraph runtim
 
 ```python
 from deerflow.client import DeerFlowClient
-from deerflow.config import load_config
-
-# Load configuration (reads config.yaml or DEER_FLOW_CONFIG_PATH)
-load_config()
 
+# The client loads configuration on construction (reads config.yaml
+# or DEER_FLOW_CONFIG_PATH)
 client = DeerFlowClient()
 ```
 
 The client is thread-safe and designed to be instantiated once and reused across requests.
 
-## Async streaming
+## Streaming
+
+The recommended integration pattern is streaming. `stream()` is a sync generator, so no asyncio is required — it gives you real-time access to each token and event as the agent produces it:
 
-The recommended integration pattern is async streaming. This gives you real-time access to each token and event as the agent produces it:
+Tool artifacts can contain native Python objects. `default=str` represents objects that are not JSON serializable as strings so these events do not interrupt the stream.
 
 ```python
-import asyncio
+import json
 
-async def run_agent(thread_id: str, user_message: str):
-    async for event in client.astream(
-        thread_id=thread_id,
+def run_agent(thread_id: str, user_message: str):
+    for event in client.stream(
         message=user_message,
-        config={
-            "configurable": {
-                "model_name": "gpt-4o",
-                "subagent_enabled": True,
-            }
-        },
+        thread_id=thread_id,
+        model_name="gpt-4o",
+        subagent_enabled=True,
     ):
-        # Process each streaming event
-        yield event
+        # `stream()` yields `StreamEvent` dataclasses, not strings. Serialise each
+        # one before it goes over the wire: Starlette calls `.encode()` on any
+        # chunk that is not already `str` / `bytes`, so yielding the dataclass
+        # raises `AttributeError` on the very first event.
+        yield f"event: {event.type}\ndata: {json.dumps(event.data, default=str)}\n\n"
 
 # In a FastAPI handler:
 # from fastapi.responses import StreamingResponse
@@ -62,10 +61,10 @@ async def run_agent(thread_id: str, user_message: str):
 For batch processing or when you only need the final result:
 
 ```python
-async def run_agent_sync(thread_id: str, user_message: str) -> dict:
-    result = await client.ainvoke(
-        thread_id=thread_id,
+def run_agent_sync(thread_id: str, user_message: str) -> str:
+    result = client.chat(
         message=user_message,
+        thread_id=thread_id,
     )
     return result
 ```
@@ -82,25 +81,22 @@ thread_id = str(uuid.uuid4())
 
 # Continuing an existing conversation (same thread_id)
 # The agent will see the full history if a checkpointer is configured
-await client.ainvoke(thread_id=existing_thread_id, message="Follow up question")
+client.chat(message="Follow up question", thread_id=existing_thread_id)
 ```
 
 ## Custom per-agent configuration
 
-Build domain-specific agents by creating named agent configs and passing the `agent_name` at runtime:
+Build domain-specific agents by creating named agent configs and passing the `agent_name` when constructing the client:
 
 ```python
 # agents/research-assistant/config.yaml must exist with skills and tool config
 
-result = await client.ainvoke(
-    thread_id=thread_id,
+research_client = DeerFlowClient(agent_name="research-assistant")
+
+result = research_client.chat(
     message=user_message,
-    config={
-        "configurable": {
-            "agent_name": "research-assistant",
-            "model_name": "gpt-4o",
-        }
-    },
+    thread_id=thread_id,
+    model_name="gpt-4o",
 )
 ```
 
@@ -110,9 +106,6 @@ DeerFlow Gateway is itself a FastAPI application. You can mount it as a sub-appl
 
 ```python
 from fastapi import FastAPI
-from deerflow.config import load_config
-
-load_config()
 
 app = FastAPI()
 
@@ -124,6 +117,8 @@ app.mount("/deerflow", gateway_app)
 Or use `DeerFlowClient` directly in
```

**File**: `frontend/src/content/en/tutorials/create-your-first-harness.mdx` (modified, +22/-21)
```diff
@@ -53,31 +53,21 @@ tools:
 Create `my_agent.py` in the `backend/` directory:
 
 ```python
-import asyncio
 import os
 from deerflow.client import DeerFlowClient
-from deerflow.config import load_config
 
 os.environ["OPENAI_API_KEY"] = "sk-..."
 
-# Load config.yaml
-load_config()
-
+# The client loads config.yaml itself. To select a specific file,
+# set DEER_FLOW_CONFIG_PATH before constructing the client.
 client = DeerFlowClient()
 
-async def main():
-    async for event in client.astream(
-        thread_id="my-first-thread",
-        message="Write a Python fibonacci function with a docstring",
-        config={
-            "configurable": {
-                "model_name": "gpt-4o",
-            }
-        },
-    ):
-        print(event)
-
-asyncio.run(main())
+for event in client.stream(
+    message="Write a Python fibonacci function with a docstring",
+    thread_id="my-first-thread",
+    model_name="gpt-4o",
+):
+    print(event)
 ```
 
 ### Run it
@@ -91,11 +81,22 @@ uv run python my_agent.py
 
 ## What the events look like
 
-The stream yields events like:
+`stream()` yields `StreamEvent` dataclasses, not dicts. Read them through
+`event.type` and `event.data`. There are exactly four types —
+`"values"`, `"messages-tuple"`, `"custom"` and `"end"`:
+
+```python
+StreamEvent(type="messages-tuple", data={"type": "ai", "content": "def fibonacci...", "id": "m1"})
+StreamEvent(type="values",         data={"title": "Python Fibonacci Function", "messages": [...], "artifacts": [...], "summary_text": None})
+StreamEvent(type="end",            data={"usage": {"input_tokens": 1180, "output_tokens": 412, "total_tokens": 1592}})
+```
 
 ```python
-{"type": "messages", "data": {"content": "def fibonacci..."}}
-{"type": "thread_state", "data": {"title": "Python Fibonacci Function"}}
+for event in client.stream(message="...", thread_id="my-first-thread"):
+    if event.type == "messages-tuple":
+        print(event.data.get("content", ""), end="")
+    elif event.type == "end":
+        print("\ndone:", event.data.get("usage"))
 ```
 
 ## Next steps
```

**File**: `frontend/src/content/zh/harness/integration-guide.mdx` (modified, +35/-45)
```diff
@@ -20,36 +20,33 @@ DeerFlow Harness 不仅仅是一个独立应用程序——它是一个可以导
 
 ```python
 from deerflow.client import DeerFlowClient
-from deerflow.config import load_config
-
-# 加载配置（读取 config.yaml 或 DEER_FLOW_CONFIG_PATH）
-load_config()
 
+# 客户端在构造时加载配置（读取 config.yaml 或 DEER_FLOW_CONFIG_PATH）
 client = DeerFlowClient()
 ```
 
 客户端是线程安全的，设计为实例化一次并在请求之间复用。
 
-## 异步流式传输
+## 流式传输
+
+推荐的集成模式是流式传输。`stream()` 是同步生成器，无需 asyncio，即可在 Agent 生成响应时实时访问每个 token 和事件：
 
-推荐的集成模式是异步流式传输。这让你可以在 Agent 生成响应时实时访问每个 token 和事件：
+工具产物可能包含原生 Python 对象。`default=str` 将不可 JSON 序列化的对象转换为字符串，避免中断事件流。
 
 ```python
-import asyncio
+import json
 
-async def run_agent(thread_id: str, user_message: str):
-    async for event in client.astream(
-        thread_id=thread_id,
+def run_agent(thread_id: str, user_message: str):
+    for event in client.stream(
         message=user_message,
-        config={
-            "configurable": {
-                "model_name": "gpt-4o",
-                "subagent_enabled": True,
-            }
-        },
+        thread_id=thread_id,
+        model_name="gpt-4o",
+        subagent_enabled=True,
     ):
-        # 处理每个流式事件
-        yield event
+        # `stream()` 产出的是 `StreamEvent` 数据类实例，而不是字符串。发送前必须
+        # 先序列化：Starlette 会对非 `str` / `bytes` 的分块调用 `.encode()`，
+        # 直接产出数据类会在第一个事件上抛出 `AttributeError`。
+        yield f"event: {event.type}\ndata: {json.dumps(event.data, default=str)}\n\n"
 
 # 在 FastAPI 处理器中：
 # from fastapi.responses import StreamingResponse
@@ -61,10 +58,10 @@ async def run_agent(thread_id: str, user_message: str):
 对于批处理或只需要最终结果的场景：
 
 ```python
-async def run_agent_sync(thread_id: str, user_message: str) -> dict:
-    result = await client.ainvoke(
-        thread_id=thread_id,
+def run_agent_sync(thread_id: str, user_message: str) -> str:
+    result = client.chat(
         message=user_message,
+        thread_id=thread_id,
     )
     return result
 ```
@@ -81,25 +78,22 @@ thread_id = str(uuid.uuid4())
 
 # 继续已有对话（相同 thread_id）
 # 如果配置了检查点，Agent 将看到完整历史
-await client.ainvoke(thread_id=existing_thread_id, message="后续问题")
+client.chat(message="后续问题", thread_id=existing_thread_id)
 ```
 
 ## 自定义 Agent 配置
 
-通过创建命名 Agent 配置并在运行时传入 `agent_name` 来构建领域特定 Agent：
+通过创建命名 Agent 配置并在构造客户端时传入 `agent_name` 来构建领域特定 Agent：
 
 ```python
 # agents/research-assistant/config.yaml 必须存在并包含技能和工具配置
 
-result = await client.ainvoke(
-    thread_id=thread_id,
+research_client = DeerFlowClient(agent_name="research-assistant")
+
+result = research_client.chat(
     message=user_message,
-    config={
-        "configurable": {
-            "agent_name": "research-assistant",
-            "model_name": "gpt-4o",
-        }
-    },
+    thread_id=thread_id,
+    model_name="gpt-4o",
 )
 ```
 
@@ -109,9 +103,6 @@ DeerFlow Gateway 本身是一个 FastAPI 应用程序。你可以将其作为子
 
 ```python
 from fastapi import FastAPI
-from deerflow.config import load_config
-
-load_config()
 
 app = FastAPI()
 
@@ -123,6 +114,8 @@ app.mount("/deerflow", gateway_app)
 或者在你自己的 FastAPI 路由中直接使用 `DeerFlowClient` 进行流式传输：
 
 ```python
+import json
+
 from fastapi import FastAPI
 from fastapi.responses import StreamingResponse
 from deerflow.client import DeerFlowClient
@@ -132,9 +125,11 @@ client = DeerFlowClient()
 
 @app.post("/chat/{thread_id}")
 async def chat(thread_id: str, body: dict):
-    async def generate():
-        async for event in client.astream(thread_id=thread_id, message=body["message"]):
-            yield f"data: {event}\n\n"
+    def generate():
+        for event in client.stream(message=body["message"], thread_id=thread_id):
+            # 序列化 `StreamEvent` 数据类；直接对对象做 f-string 会发送它的
+            # `repr()`，SSE 客户端无法解析。
+            yield f"event: {event.type}\ndata: {json.dumps(event.data, default=str)}\n\n"
     return StreamingResponse(generate(), media_type="text/event-stream")
 ```
 
@@ -146,16 +141,11 @@ async def chat(thread_id: str, body: dict):
 import os
 os.environ["DEER_FLOW_CONFIG_PATH"] = "/path/to/my-deerflow-config.yaml"
 
-from deerflow.c
```

**File**: `frontend/src/content/zh/tutorials/create-your-first-harness.mdx` (modified, +28/-18)
```diff
@@ -47,32 +47,22 @@ tools:
 创建 `my_agent.py`：
 
 ```python
-import asyncio
 import os
 from deerflow.client import DeerFlowClient
-from deerflow.config import load_config
 
 # 设置 API Key
 os.environ["OPENAI_API_KEY"] = "sk-..."
 
-# 加载配置
-load_config()
-
+# 客户端自行加载 config.yaml；如需指定文件，
+# 请在创建客户端前设置 DEER_FLOW_CONFIG_PATH。
 client = DeerFlowClient()
 
-async def main():
-    async for event in client.astream(
-        thread_id="my-first-thread",
-        message="用 Python 写一个斐波那契数列函数，包含文档字符串",
-        config={
-            "configurable": {
-                "model_name": "gpt-4o",
-            }
-        },
-    ):
-        print(event)
-
-asyncio.run(main())
+for event in client.stream(
+    message="用 Python 写一个斐波那契数列函数，包含文档字符串",
+    thread_id="my-first-thread",
+    model_name="gpt-4o",
+):
+    print(event)
 ```
 
 ## 运行
@@ -82,6 +72,26 @@ cd backend
 uv run python my_agent.py
 ```
 
+## 事件长什么样
+
+`stream()` 产出的是 `StreamEvent` 数据类实例，而不是字典，需通过
+`event.type` 和 `event.data` 读取。事件类型只有四种：
+`"values"`、`"messages-tuple"`、`"custom"` 和 `"end"`：
+
+```python
+StreamEvent(type="messages-tuple", data={"type": "ai", "content": "def fibonacci...", "id": "m1"})
+StreamEvent(type="values",         data={"title": "Python Fibonacci Function", "messages": [...], "artifacts": [...], "summary_text": None})
+StreamEvent(type="end",            data={"usage": {"input_tokens": 1180, "output_tokens": 412, "total_tokens": 1592}})
+```
+
+```python
+for event in client.stream(message="...", thread_id="my-first-thread"):
+    if event.type == "messages-tuple":
+        print(event.data.get("content", ""), end="")
+    elif event.type == "end":
+        print("\ndone:", event.data.get("usage"))
+```
+
 ## 下一步
 
 - [使用工具和技能](/docs/tutorials/use-tools-and-skills)
```

---

### Incident Patch 9: `0110845f` (2026-09-30)
**Commit Message**: fix(config): guard the recovered stream cleanup delay like its heartbeat sibling (#5850)

**File**: `backend/packages/harness/deerflow/config/stream_bridge_config.py` (modified, +10/-5)
```diff
@@ -2,11 +2,12 @@
 
 from typing import Any, Literal
 
-from pydantic import BaseModel, Field, field_validator
+from pydantic import BaseModel, Field, ValidationInfo, field_validator
 
 StreamBridgeType = Literal["memory", "redis"]
 DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 15.0
 MAX_HEARTBEAT_INTERVAL_SECONDS = 86_400.0
+MAX_RECOVERED_STREAM_CLEANUP_DELAY_SECONDS = 86_400.0
 
 
 class StreamBridgeConfig(BaseModel):
@@ -54,15 +55,19 @@ class StreamBridgeConfig(BaseModel):
     recovered_stream_cleanup_delay_seconds: float = Field(
         default=60.0,
         ge=0,
-        description=("Seconds to wait after publishing an END marker for a recovered orphaned run before deleting the stream key. Gives reconnecting SSE clients time to drain the end signal. Only applies to the redis bridge."),
+        le=MAX_RECOVERED_STREAM_CLEANUP_DELAY_SECONDS,
+        allow_inf_nan=False,
+        description=(
+            "Seconds to wait after publishing an END marker for a recovered orphaned run before deleting the stream key (maximum 86400). Gives reconnecting SSE clients time to drain the end signal. Only applies to the redis bridge."
+        ),
     )
 
-    @field_validator("heartbeat_interval_seconds", mode="before")
+    @field_validator("heartbeat_interval_seconds", "recovered_stream_cleanup_delay_seconds", mode="before")
     @classmethod
-    def reject_boolean_heartbeat_interval(cls, value: Any) -> Any:
+    def reject_boolean_seconds(cls, value: Any, info: ValidationInfo) -> Any:
         """Reject booleans before Pydantic coerces them to floats."""
         if isinstance(value, bool):
-            raise ValueError("heartbeat_interval_seconds must be a number, not a boolean")
+            raise ValueError(f"{info.field_name} must be a number, not a boolean")
         return value
 
 
```

**File**: `backend/tests/test_stream_bridge.py` (modified, +31/-1)
```diff
@@ -10,7 +10,12 @@
 import pytest
 from pydantic import ValidationError
 
-from deerflow.config.stream_bridge_config import MAX_HEARTBEAT_INTERVAL_SECONDS, StreamBridgeConfig, set_stream_bridge_config
+from deerflow.config.stream_bridge_config import (
+    MAX_HEARTBEAT_INTERVAL_SECONDS,
+    MAX_RECOVERED_STREAM_CLEANUP_DELAY_SECONDS,
+    StreamBridgeConfig,
+    set_stream_bridge_config,
+)
 from deerflow.runtime import END_SENTINEL, HEARTBEAT_SENTINEL, MemoryStreamBridge, StreamGap, make_stream_bridge
 
 # RedisStreamBridge is no longer re-exported from deerflow.runtime (redis is an
@@ -984,6 +989,31 @@ def test_stream_bridge_config_accepts_numeric_heartbeat_string():
     assert config.heartbeat_interval_seconds == 2.5
 
 
+@pytest.mark.parametrize(
+    "cleanup_delay",
+    [
+        True,
+        False,
+        -1,
+        float("inf"),
+        float("-inf"),
+        float("nan"),
+        MAX_RECOVERED_STREAM_CLEANUP_DELAY_SECONDS + 1,
+    ],
+)
+def test_stream_bridge_config_rejects_invalid_recovered_stream_cleanup_delay(cleanup_delay):
+    with pytest.raises(ValidationError, match="recovered_stream_cleanup_delay_seconds"):
+        StreamBridgeConfig(recovered_stream_cleanup_delay_seconds=cleanup_delay)
+
+
+@pytest.mark.parametrize("cleanup_delay", [0, 60, MAX_RECOVERED_STREAM_CLEANUP_DELAY_SECONDS])
+def test_stream_bridge_config_accepts_valid_recovered_stream_cleanup_delay(cleanup_delay):
+    """A delay of 0 is a valid 'delete as soon as END is published' setting."""
+    config = StreamBridgeConfig(recovered_stream_cleanup_delay_seconds=cleanup_delay)
+
+    assert config.recovered_stream_cleanup_delay_seconds == float(cleanup_delay)
+
+
 @pytest.mark.parametrize("heartbeat_interval", [True, MAX_HEARTBEAT_INTERVAL_SECONDS + 1])
 def test_memory_bridge_rejects_invalid_default_heartbeat(heartbeat_interval):
     with pytest.raises(ValueError, match="heartbeat_interval"):
```

**File**: `config.example.yaml` (modified, +1/-1)
```diff
@@ -2802,7 +2802,7 @@ run_ownership:
 #                                # to disable. This is not a run timeout.
 #   recovered_stream_cleanup_delay_seconds: 60  # seconds to wait after
 #                                # publishing END for a recovered orphan run
-#                                # before deleting the stream key.
+#                                # before deleting the stream key (max: 86400).
 #   max_connections: 100         # optional pool ceiling. Each live SSE client
 #                                # holds one connection blocked in XREAD ... BLOCK
 #                                # for up to the configured heartbeat interval, so
```

---

### Incident Patch 10: `29543769` (2026-09-30)
**Commit Message**: fix(agent,goal): stop coaching scripts when no bash tool is bound, and show the goal evaluator Human Input Card answers (#6082)

* fix(agent): drop script guidance from the lead prompt when no bash tool is bound

The workspace section told the agent how to write scripts and commands
("prefer relative paths", "avoid hardcoding /mnt/user-data/... inside
generated scripts") even when no tool could run them. With the default
LocalSandboxProvider host bash is off and the bash tool is removed, so
agents wrote helper scripts nothing could execute, then stalled or
computed by hand.

apply_prompt_template() takes bash_available (default True, so other
callers keep today's text). The lead agent (both assembly branches) and
the embedded client pass whether their authorized tools, bound or
deferred, include bash. Without it:
- the two script bullets become one line: no bash tool is bound, work
  out results directly and write them with write_file;
- the subagent section no longer shows direct bash examples, and marks
  the bash subagent unavailable, since it inherits the lead's tool groups;
- the ACP hint no longer suggests `bash cp`.

* fix(goal): show the goal evaluator the user's answer to 

**File**: `backend/packages/harness/deerflow/agents/lead_agent/agent.py` (modified, +3/-1)
```diff
@@ -35,7 +35,7 @@
 from langchain_core.runnables import RunnableConfig
 
 from deerflow.agents.interaction_policy import resolve_run_interaction_policy
-from deerflow.agents.lead_agent.prompt import apply_prompt_template
+from deerflow.agents.lead_agent.prompt import apply_prompt_template, has_bash_tool
 from deerflow.agents.middlewares.clarification_middleware import ClarificationMiddleware
 from deerflow.agents.middlewares.configured_extensions import load_configured_extension_middlewares
 from deerflow.agents.middlewares.loop_detection_middleware import LoopDetectionMiddleware
@@ -1134,6 +1134,7 @@ def _assemble_lead_agent(config: RunnableConfig, *, app_config: AppConfig) -> Le
             subagent_execution_capacity=subagent_execution_capacity,
             interaction_policy=interaction_policy,
             memory_enabled=memory_enabled,
+            bash_available=has_bash_tool(authorized_tools),
         )
         graph = create_agent(
             model=chat_model,
@@ -1267,6 +1268,7 @@ def _assemble_lead_agent(config: RunnableConfig, *, app_config: AppConfig) -> Le
         subagent_execution_capacity=subagent_execution_capacity,
         interaction_policy=interaction_policy,
         memory_enabled=memory_enabled,
+        bash_available=has_bash_tool(authorized_tools),
     )
     graph = create_agent(
         model=chat_model,
```

**File**: `backend/packages/harness/deerflow/agents/lead_agent/prompt.py` (modified, +42/-12)
```diff
@@ -5,9 +5,10 @@
 import logging
 import threading
 from collections import OrderedDict
+from collections.abc import Iterable
 from dataclasses import dataclass, field
 from functools import lru_cache
-from typing import TYPE_CHECKING
+from typing import TYPE_CHECKING, Any
 
 from deerflow.agents.interaction_policy import RunInteractionPolicy
 from deerflow.config.agents_config import load_agent_soul
@@ -314,7 +315,7 @@ def _build_available_subagents_description(available_names: list[str], bash_avai
         "bash": (
             "For bounded shell workflows with clear context-isolation or independent-parallel benefit. Routine git, build, test, or deploy operations are not sufficient reason to delegate."
             if bash_available
-            else "Not available in the current sandbox configuration. Use direct file/web tools or switch to AioSandboxProvider for isolated shell access."
+            else "Not available in this run: no `bash` tool is bound for this agent, and a bash subagent is limited to the same tools. Use the direct file/web tools."
         ),
     }
 
@@ -348,6 +349,7 @@ def _build_subagent_section(
     app_config: AppConfig | None = None,
     allowed_subagents: list[str] | None = None,
     batch_enabled: bool = False,
+    lead_bash_available: bool = True,
 ) -> str:
     """Build the subagent system prompt section with dynamic subagent limits.
 
@@ -366,7 +368,8 @@ def _build_subagent_section(
         available_names = get_available_subagent_names(app_config=app_config, allowed_subagents=allowed_subagents) if app_config is not None else get_available_subagent_names(allowed_subagents=allowed_subagents)
     if not available_names:
         return ""
-    bash_available = "bash" in available_names
+    # A bash subagent inherits the lead's tool groups, so it has bash only when the lead does.
+    bash_available = "bash" in available_names and lead_bash_available
 
     # The verification guidance must follow verification.receipts_enabled: with
     # receipts disabled, subagent reports carry no receipt citations and the
@@ -400,6 +403,13 @@ def _build_subagent_section(
         if bash_available
         else '# User asks: "Read the README"\n# Thinking: Single straightforward file read\n# → Execute directly\n\nread_file("/mnt/user-data/workspace/README.md")  # Direct execution, not task()'
     )
+    # The first sentence follows the lead's own bash tool; the second needs a bash subagent in the list above.
+    if bash_available:
+        routine_work_example = "- Run a routine test, build, or git command directly. Use one Bash subagent only when a bounded shell workflow has material context-isolation benefit."
+    elif lead_bash_available:
+        routine_work_example = "- Run a routine test, build, or git command directly."
+    else:
+        routine_work_example = "- Do a routine file read, search, or edit directly. No `bash` tool is bound, and a subagent has none either."
     if n == 1:
         expected_benefit = "specialist capability + context isolation"
         parallel_dispatch_guidance = ""
@@ -415,10 +425,10 @@ def _build_subagent_section(
 4. If delegation wins clearly, give the single subagent a bounded scope, relevant known context and paths, an expected output, and explicit side-effect ownership. Attach acceptance_criteria for objectively checkable outcomes.
 5. Launch at most 1 call and stay within the remaining run allowance.
 {single_verify_step}"""
-        examples = """- Refactor authentication implementation and its tests directly when analysis, edits, and test feedback share files or depend on one another. Complexity alone does not justify delegation.
+        examples = f"""- Refactor authentication implementation and its tests directly when analysis, edits, and test feedback share files or depend on one another. Complexity alone does not justify delegation.
 - Use one specialized subagent only when its configured capability provides material benefit unavailable on the d
```

**File**: `backend/packages/harness/deerflow/client.py` (modified, +2/-1)
```diff
@@ -34,7 +34,7 @@
 from langchain_core.runnables import RunnableConfig
 
 from deerflow.agents.lead_agent.agent import _authorize_model_name, build_middlewares
-from deerflow.agents.lead_agent.prompt import apply_prompt_template, get_enabled_skills_for_config
+from deerflow.agents.lead_agent.prompt import apply_prompt_template, get_enabled_skills_for_config, has_bash_tool
 from deerflow.agents.thread_state import get_thread_state_schema, normalize_middleware_state_schemas
 from deerflow.authz.principal import build_principal_from_context
 from deerflow.config.agents_config import AGENT_NAME_PATTERN, load_agent_config
@@ -476,6 +476,7 @@ def _ensure_agent(self, config: RunnableConfig, *, context: Mapping[str, Any] |
                 skill_names=skill_setup.skill_names or None,
                 subagent_execution_capacity=subagent_execution_capacity,
                 memory_enabled=memory_enabled,
+                bash_available=has_bash_tool(authorized_tools),
             ),
             "state_schema": get_thread_state_schema(self._checkpoint_channel_mode, self._checkpoint_snapshot_frequency),
         }
```

**File**: `backend/packages/harness/deerflow/runtime/goal.py` (modified, +26/-14)
```diff
@@ -22,6 +22,7 @@
 
 import deerflow.utils.llm_text as llm_text
 from deerflow.agents.goal_state import GoalBlocker, GoalEvaluation, GoalState
+from deerflow.agents.human_input import read_human_input_response
 from deerflow.models import create_chat_model
 from deerflow.runtime.keyed_lock import AsyncKeyedLockTable
 from deerflow.tracing import inject_langfuse_metadata
@@ -41,6 +42,8 @@
 MAX_GOAL_TOOL_VALUE_CHARS = 200
 MAX_GOAL_TOOL_STEP_CHARS = 600
 MAX_GOAL_REQUEST_CHARS = 2000
+# Evidence line for a user's answer to a Human Input Card; unlike "User: " lines it is not a request.
+GOAL_CARD_ANSWER_PREFIX = "User (Human Input Card answer): "
 
 GOAL_BLOCKERS: set[GoalBlocker] = {
     "none",
@@ -275,9 +278,10 @@ def _cap_evidence(lines: list[str]) -> str:
 
     Over the cap, whole lines are kept from the end, where the latest work is. The latest
     user message among the lines left out is kept at the top, because it states the request
-    that work answers; it is shortened only when it and the lines after it do not fit whole.
-    If the next assistant message back does not fit whole, its end fills the room left. A
-    marker says how many lines were left out, so no line starts midway without a label.
+    that work answers, and so is the latest Human Input Card answer left out. Each is shortened
+    only when it and the lines after it do not fit whole. If the next assistant message back
+    does not fit whole, its end fills the room left. A marker says how many lines were left
+    out. No line starts midway without a label.
     """
     conversation = "\n\n".join(lines)
     if len(conversation) <= MAX_GOAL_CONVERSATION_CHARS:
@@ -291,22 +295,25 @@ def tail_start(budget: int, stop: int) -> int:
             used += len(lines[index]) + 2
         return index
 
-    # Reserve room for the request first, then give what it does not use back to the tail.
-    start = tail_start(MAX_GOAL_CONVERSATION_CHARS - MAX_GOAL_REQUEST_CHARS - 128, 0)
-    request = next((index for index in range(start - 1, -1, -1) if lines[index].startswith("User: ")), None)
+    prefixes = ["User: "]
+    if any(line.startswith(GOAL_CARD_ANSWER_PREFIX) for line in lines):
+        prefixes.append(GOAL_CARD_ANSWER_PREFIX)
+    # Reserve room for the lines kept at the top first, then give what they do not use back to the tail.
+    start = tail_start(MAX_GOAL_CONVERSATION_CHARS - (MAX_GOAL_REQUEST_CHARS + 64) * len(prefixes) - 64, 0)
+    latest = (next((index for index in range(start - 1, -1, -1) if lines[index].startswith(prefix)), None) for prefix in prefixes)
+    picks = sorted(index for index in latest if index is not None)
     head: list[str] = []
     room = 0
-    if request is not None and tail_start(MAX_GOAL_CONVERSATION_CHARS - 64, request) == request:
-        start = request
+    if picks and tail_start(MAX_GOAL_CONVERSATION_CHARS - 64, picks[0]) == picks[0]:
+        start = picks[0]
     else:
-        if request is not None:
-            head = [_truncate(lines[request], MAX_GOAL_REQUEST_CHARS)]
-        room = MAX_GOAL_CONVERSATION_CHARS - sum(len(line) for line in head) - 64
-        start = tail_start(room, request + 1 if request is not None else 0)
+        head = [_truncate(lines[index], MAX_GOAL_REQUEST_CHARS) for index in picks]
+        room = MAX_GOAL_CONVERSATION_CHARS - sum(len(line) for line in head) - 2 * max(len(head) - 1, 0) - 64
+        start = tail_start(room, picks[-1] + 1 if picks else 0)
         room -= sum(len(line) + 2 for line in lines[start:])
     kept = lines[start:]
     boundary = start - 1
-    if boundary > (request if request is not None else -1) and lines[boundary].startswith("Assistant: ") and room >= 500:
+    if boundary > (picks[-1] if picks else -1) and lines[boundary].startswith("Assistant: ") and room >= 500:
         text = lines[boundary].removeprefix("Assistant: ")
         keep = room - 64
         kept = [f"Assistant: [{len(text) - keep} earlier chars omitted] {text[-keep:]}", *kept]
```

**File**: `backend/tests/test_client.py` (modified, +18/-0)
```diff
@@ -1453,6 +1453,24 @@ def test_applies_custom_agent_memory_policy(
         assert mock_build_middlewares.call_args.kwargs["memory_enabled"] is expected_memory_enabled
         assert mock_apply_prompt.call_args.kwargs["memory_enabled"] is expected_memory_enabled
 
+    @pytest.mark.parametrize(("tool_names", "expected"), [(["read_file", "write_file", "bash"], True), (["read_file", "write_file"], False)])
+    def test_tells_the_prompt_whether_bash_is_bound(self, client, tool_names, expected):
+        config = client._get_runnable_config("t1")
+        tools = [StructuredTool.from_function(lambda: "", name=name, description=name) for name in tool_names]
+
+        with (
+            patch("deerflow.client.create_chat_model"),
+            patch("deerflow.client.create_agent", return_value=MagicMock()),
+            patch("deerflow.client.build_middlewares", return_value=[]),
+            patch("deerflow.client.apply_prompt_template", return_value="prompt") as mock_apply_prompt,
+            patch("deerflow.client.get_enabled_skills_for_config", return_value=[]),
+            patch.object(client, "_get_tools", return_value=tools),
+            patch("deerflow.runtime.checkpointer.get_checkpointer", return_value=None),
+        ):
+            client._ensure_agent(config, context={"user_id": "owner-1"})
+
+        assert mock_apply_prompt.call_args.kwargs["bash_available"] is expected
+
     def test_reuses_named_agent_config_on_cached_agent_fast_path(self, client):
         client._agent_name = "stateful-agent"
         config = client._get_runnable_config("t1")
```

#### Recent Merged Pull Requests:
- **PR #6104** (2026-09-30): fix(harness): anchor DeerFlowClient agent-name validation with fullmatch (@wxhking)
- **PR #6095** (closed): fix(gateway): drain personal MCP config mutations across cancellation (@yetuge)
- **PR #6093** (2026-09-30): fix(mcp): drain personal config mutations on cancellation (@poijygfdyy)
- **PR #6091** (2026-09-30): fix(frontend): recognize extensionless artifact source files (@DaoyuanLi2816)
- **PR #6089** (2026-09-30): fix(frontend): show media icons for APNG, AVIF, and WebM (@xihongshichaojidan8)
- **PR #6088** (2026-09-30): fix(agents): treat a null max_total_subagents override as unset (@hyeonsang010716)
- **PR #6087** (2026-09-30): fix(gateway): drain agent and user-profile writes across cancellation (@yetuge)
- **PR #6084** (closed): fix(scheduler): fire daily cron once on DST fall-back (Fixes #6052) (@inchang-ing)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

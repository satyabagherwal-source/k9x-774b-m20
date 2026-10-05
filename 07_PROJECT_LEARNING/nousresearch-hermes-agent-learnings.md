# Forensic Learning Record (Deep Inspection): NousResearch/hermes-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/nousresearch-hermes-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:09:41.937Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NousResearch/hermes-agent`
- **Description**: The agent that grows with you
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 251395 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/api_request_hooks.py`
```
"""Lifecycle-hook payloads for ``AIAgent`` API requests.

JSON-safe coercion, secret-key redaction, size caps, and the ``api_request_error`` hook dispatch.
Extracted from ``run_agent.py``; every method resolves through ``AIAgent``'s MRO unchanged.
"""
import json
import os
import time
from contextlib import suppress
from types import SimpleNamespace
from typing import Any, Dict, Optional

from agent.usage_pricing import normalize_usage

_SENSITIVE_HOOK_KEYS = {"api_key", "authorization", "proxy_authorization", "cookie", "set_cookie"}


def _model_dump(value: Any) -> Any:
    """``value.model_dump(mode="json")`` with graceful degradation for older pydantic signatures.

    warnings=False: pydantic UserWarnings on generic-union SDK models would leak to the terminal.
    """
    try:
        return value.model_dump(mode="json", warnings=False)
    except TypeError:
        try:
            return value.model_dump(mode="json")
        except TypeError:
            return value.model_dump()


class ApiRequestHooksMixin:
    """Hook payload sanitising + ``api_request_error`` dispatch (see module docstring)."""

    def _usage_summary_for_api_request_hook(self, response: Any) -> Optional[Dict[str, Any]]:
        """Token buckets for ``post_api_request`` plugins (no raw ``response`` object)."""
        if response is None:
            return None
        raw_usage = getattr(response, "usage", None)
        if not raw_usage:
            return None
        from dataclasses import asdict

        cu = normalize_usage(raw_usage, provider=self.provider, api_mode=self.api_mode)
        summary = asdict(cu)
        summary.pop("raw_usage", None)
        summary["prompt_tokens"] = cu.prompt_tokens
        summary["total_tokens"] = cu.total_tokens
        return summary

    @staticmethod
    def _hook_payload_max_chars() -> int:
        raw = os.getenv("HERMES_PLUGIN_PAYLOAD_MAX_CHARS", "50000")
        try:
            return max(1000, int(raw))
        except (TypeError, ValueError):
            return 50000

    @staticmethod
    def _is_sensitive_hook_key(key: Any) -> bool:
        if not isinstance(key, str):
            return False
        lowered = key.lower().replace("-", "_")
        return lowered in _SENSITIVE_HOOK_KEYS or lowered.endswith("_api_key")

    @classmethod
    def _hook_jsonable(
        cls, value: Any, *, depth: int = 0, max_depth: int = 8, max_string: int = 8000,
        max_sequence: int = 200,
    ) -> Any:
        if depth > max_depth:
            return f"<{type(value).__name__} depth limit>"
        if value is None or isinstance(value, (bool, int, float)):
            return value
        if isinstance(value, str):
            if len(value) > max_string:
                return value[:max_string] + f"...[truncated {len(value) - max_string} chars]"
            return value
        if isinstance(value, (bytes, bytearray)):
            return f"<{len(value)} bytes>"

        def recurse(item):
            return cls._hook_jsonable(
                item, depth=depth + 1, max_depth=max_depth, max_string=max_string,
                max_sequence=max_sequence,
            )

        if isinstance(value, dict):
            out: Dict[str, Any] = {}
            for idx, (key, item) in enumerate(value.items()):
                if idx >= max_sequence:
                    out["_truncated_items"] = len(value) - max_sequence
                    break
                str_key = str(key)
                out[str_key] = "<redacted>" if cls._is_sensitive_hook_key(str_key) else recurse(item)
            return out
        if isinstance(value, (list, tuple, set)):
            seq = list(value)
            out = [recurse(item) for item in seq[:max_sequence]]
            if len(seq) > max_sequence:
                out.append({"_truncated_items": len(seq) - max_sequence})
            return out
        with suppress(Exception):
            if hasattr(value, "model_dump"):
                return recurse(_model_dump(value))
        with suppress(Exception):
            from dataclasses import asdict, is_dataclass
            if is_dataclass(value):
                return recurse(asdict(value))
        if isinstance(value, SimpleNamespace):
            return recurse(vars(value))
        if hasattr(value, "__dict__"):
            with suppress(Exception):
                return recurse({k: v for k, v in vars(value).items() if not str(k).startswith("_")})
        return str(value)[:max_string]

    @classmethod
    def _sanitize_hook_payload(cls, value: Any) -> Any:
        """JSON-able payload under the size cap: full → reduced caps → truncated preview."""
        limit = cls._hook_payload_max_chars()
        encoded = ""
        for caps in ({}, {"max_string": 1000, "max_sequence": 50}):
            payload = cls._hook_jsonable(value, **caps)
            try:
                encoded = json.dumps(payload, ensure_ascii=False, default=str)
            except Exception:
                return str(payload)[:limit]
            if len(encoded) <= limit:
                return payload
        return {
            "_truncated": True, "original_type": type(value).__name__, "preview": encoded[:limit]
        }

    def _api_request_payload_for_hook(self, api_kwargs: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        body = {
            key: value
            for key, value in (api_kwargs or {}).items()
            if key not in {"timeout", "http_client"}
        }
        return self._sanitize_hook_payload({"method": "POST", "body": body})

    def _api_response_payload_for_hook(
        self, response: Any, assistant_message: Any, *, finish_reason: Optional[str]
    ) -> Dict[str, Any]:
        # Raw provider SDK tool_call objects are handed to the sanitizer on purpose; `_hook_jsonable` must
        # keep normalising them (model_dump / __dict__ / dataclass) or subscribers get str() blobs.
        tool_calls = getattr(assistant_message, "tool_calls", None) or []
        return self._sanitize_hook_payload(
            {
                "model": getattr(response, "model", None),
                # Downstream that served the call (relays re-roll it per request; #90216).
                "upstream_provider": getattr(response, "provider", None),
                "finish_reason": finish_reason,
                "assistant_message": {
                    "role": getattr(assistant_message, "role", "assistant"),
                    "content": getattr(assistant_message, "content", None),
                    "tool_calls": tool_calls,
                },
                "usage": self._usage_summary_for_api_request_hook(response),
            }
        )

    def _invoke_api_request_error_hook(
        self, *, task_id: str, turn_id: str, api_request_id: str, api_call_count: int,
        api_start_time: float, api_kwargs: Optional[Dict[str, Any]], error_type: str,
        error_message: str, status_code: Optional[int] = None, retry_count: Optional[int] = None,
        max_retries: Optional[int] = None, retryable: Optional[bool] = None,
        reason: Optional[str] = None,
    ) -> None:
        # Lazy module import (not from-import) so tests can replace lifecycle dispatch at this call site.
        with suppress(Exception):
            from hermes_cli import lifecycle as _lifecycle
            if not _lifecycle.has_hook("api_request_error"):
                return
            ended_at = time.time()
            _lifecycle.invoke_hook(
                "api_request_error",
                task_id=task_id,
                turn_id=turn_id,
                api_request_id=api_request_id,
                session_id=self.session_id or "",
                platform=self.platform or "",
                model=self.model,
                provider=self.provider,
                base_url=self.base_url,
                api_mode=self.api_mode,
                api_call_count=api_call_count,
                api_duration=ended_at - api_start_time,
                started_at=api_start_time,
                ended_at=ended_at,
                status_code=status_code,
                retry_count=retry_count,
                max_retries=max_retries,
                retryable=retryable,
                reason=reason,
                error={"type": error_type, "message": error_message},
                request=self._api_request_payload_for_hook(api_kwargs),
            )

```

### Core Architecture Module: `agent/async_utils.py`
```
"""Async/sync bridging helpers.

``asyncio.run_coroutine_threadsafe`` can raise ``RuntimeError`` (loop closed during a
shutdown race); the coroutine is then never awaited or closed, which triggers a
"coroutine was never awaited" RuntimeWarning and leaks its frame. The helpers here
close the coroutine on scheduling failure. ``future.result()`` failures are deliberately
NOT handled: once the loop accepts the coroutine its lifecycle belongs to the loop.
"""
from __future__ import annotations

import asyncio
import logging
from concurrent.futures import Future
from typing import Any, Coroutine, Optional


_DEFAULT_LOGGER = logging.getLogger(__name__)


def safe_schedule_threadsafe(
    coro: Coroutine[Any, Any, Any], loop: Optional[asyncio.AbstractEventLoop], *,
    logger: Optional[logging.Logger] = None,
    log_message: str = "Failed to schedule coroutine on loop", log_level: int = logging.DEBUG,
) -> Optional[Future]:
    """Schedule ``coro`` on ``loop`` from a sync context, leak-safe.

    Returns the Future on success, or ``None`` if the loop is missing or scheduling
    raised; in every failure path the coroutine is closed. Callers keep full control
    over the returned future (``.result(timeout=...)``, callbacks, fire-and-forget).
    """
    log = logger if logger is not None else _DEFAULT_LOGGER
    try:
        if loop is None:
            raise RuntimeError("loop is None")
        return asyncio.run_coroutine_threadsafe(coro, loop)
    except Exception as exc:
        if asyncio.iscoroutine(coro):
            coro.close()
        log.log(log_level, "%s: %s", log_message, exc)
        return None


def consume_detached_task_result(task: "asyncio.Future[Any]") -> None:
    """``add_done_callback`` for cancelled-and-detached tasks: observe the exception so the
    loop does not log "exception was never retrieved"; cancellation and terminal errors
    are swallowed because the task's owner already gave up on it."""
    try:
        task.exception()
    except (asyncio.CancelledError, Exception):
        pass

```

### Core Architecture Module: `agent/auxiliary_hooks.py`
```
"""Plugin events for auxiliary LLM calls (#79733).

``pre_auxiliary_call`` / ``post_auxiliary_call`` fire once per physical provider attempt at the
relay boundary of ``agent.auxiliary_client`` — the funnel every auxiliary task (titling,
compression, MoA advisors/aggregator, vision, approval, ...) shares, retries and fallbacks
included — carrying the ``pre_api_request`` / ``post_api_request`` payload shape plus
``aux_task``. They are deliberately DISTINCT events: the main-loop ``*_api_request`` events stay
turn-scoped, so observability plugins keyed on turn identity never see auxiliary traffic unless
they subscribe to these. Observer-only (returns ignored) and fail-open: a raising or hung
callback is logged and the auxiliary call proceeds untouched.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)

PRE_AUXILIARY_CALL = "pre_auxiliary_call"
POST_AUXILIARY_CALL = "post_auxiliary_call"


def _parent_turn_identity() -> Dict[str, str]:
    """``session_id`` / ``task_id`` / ``turn_id`` / ``platform`` of the main turn this auxiliary
    call runs under, or empty strings for turn-less callers (cron, gateway idle work)."""
    ident = {"session_id": "", "task_id": "", "turn_id": "", "platform": ""}
    try:
        from agent.relay_runtime import current_turn

        turn = current_turn()
    except Exception:
        return ident
    if turn is None:
        return ident
    lease = getattr(turn, "lease", None)
    ident["session_id"] = str(getattr(lease, "session_id", "") or "")
    ident["platform"] = str(getattr(lease, "platform", "") or "")
    ident["task_id"] = str(getattr(turn, "task_id", "") or "")
    ident["turn_id"] = str(getattr(turn, "turn_id", "") or "")
    return ident


def _system_prompt(messages: Any, kwargs: Dict[str, Any]) -> str:
    if isinstance(kwargs.get("system"), str):  # Anthropic
        return kwargs["system"]
    if isinstance(kwargs.get("instructions"), str):  # Responses
        return kwargs["instructions"]
    if isinstance(messages, list) and messages and isinstance(messages[0], dict):
        first = messages[0]
        if first.get("role") == "system" and isinstance(first.get("content"), str):
            return first["content"]
    return ""


def _usage_summary(response: Any, *, provider: str, api_mode: str) -> Optional[Dict[str, Any]]:
    raw_usage = getattr(response, "usage", None)
    if response is None or not raw_usage:
        return None
    from dataclasses import asdict

    from agent.usage_pricing import normalize_usage

    cu = normalize_usage(raw_usage, provider=provider, api_mode=api_mode)
    summary = asdict(cu)
    summary.pop("raw_usage", None)
    summary["prompt_tokens"] = cu.prompt_tokens
    summary["total_tokens"] = cu.total_tokens
    return summary


def _first_choice_message(response: Any) -> Any:
    choices = getattr(response, "choices", None)
    if isinstance(response, dict):
        choices = response.get("choices")
    if not choices:
        return None, None
    choice = choices[0]
    if isinstance(choice, dict):
        return choice.get("message"), choice.get("finish_reason")
    return getattr(choice, "message", None), getattr(choice, "finish_reason", None)


def _field(obj: Any, name: str) -> Any:
    return obj.get(name) if isinstance(obj, dict) else getattr(obj, name, None)


class _AuxCallHooks:
    """Fires the pre/post pair for one provider attempt; the base payload is built once."""

    def __init__(
        self, *, aux_task: str, metadata: Dict[str, Any], client: Any, kwargs: Dict[str, Any],
        provider: str, model: str, api_mode: str, streaming: bool,
    ) -> None:
        self.provider = provider
        self.api_mode = api_mode
        self.streaming = streaming
        self.kwargs = kwargs
        self.started_at = time.time()
        self.base: Dict[str, Any] = dict(_parent_turn_identity())
        self.base.update(
            aux_task=aux_task,
            api_request_id=str(metadata.get("api_request_id") or ""),
            retry_count=int(metadata.get("retry_count") or 0),
            api_call_count=int(metadata.get("retry_count") or 0) + 1,
            model=model,
            provider=provider,
            base_url=str(getattr(client, "base_url", "") or ""),
            api_mode=api_mode,
            streaming=streaming,
            started_at=self.started_at,
            message_count=len(kwargs.get("messages") or kwargs.get("input") or []),
        )

    def pre(self) -> None:
        if not _has_hook(PRE_AUXILIARY_CALL):
            return
        from agent.api_request_hooks import ApiRequestHooksMixin as _Sanitize

        kwargs = self.kwargs
        messages = kwargs.get("messages")
        if not isinstance(messages, list):
            messages = kwargs.get("input")  # Responses API
        if not isinstance(messages, list):
            messages = []
        body = {k: v for k, v in kwargs.items() if k not in {"timeout", "http_client"}}
        total_chars = sum(len(str(_field(m, "content") or "")) for m in messages)
        _fire(
            PRE_AUXILIARY_CALL, **self.base,
            request_messages=list(messages),
            system_prompt=_system_prompt(messages, kwargs),
            tool_count=len(kwargs.get("tools") or []),
            approx_input_tokens=total_chars // 4,
            request_char_count=total_chars,
            max_tokens=kwargs.get("max_tokens") or kwargs.get("max_completion_tokens"),
            request=_Sanitize._sanitize_hook_payload({"method": "POST", "body": body}),
        )

    def post(self, response: Any = None, error: Optional[BaseException] = None) -> None:
        if not _has_hook(POST_AUXILIARY_CALL):
            return
        from agent.api_request_hooks import ApiRequestHooksMixin as _Sanitize

        ended_at = time.time()
        payload: Dict[str, Any] = dict(
            self.base, ended_at=ended_at, api_duration=max(0.0, ended_at - self.started_at),
            error=None if error is None else f"{type(error).__name__}: {error}"[:2000],
            error_type=None if error is None else type(error).__name__,
        )
        # A streamed response is handed back unconsumed (the MoA facade owns reassembly), so
        # there is no usage/finish_reason to report yet; ``streaming`` tells the observer why.
        if error is not None or self.streaming:
            payload.update(finish_reason=None, response_model=None, usage=None, response=None,
                           assistant_content_chars=0, assistant_tool_call_count=0)
        else:
            message, finish_reason = _first_choice_message(response)
            content = _field(message, "content") if message is not None else None
            tool_calls = (_field(message, "tool_calls") if message is not None else None) or []
            payload.update(
                finish_reason=finish_reason,
                response_model=_field(response, "model"),
                usage=_usage_summary(response, provider=self.provider, api_mode=self.api_mode),
                response=_Sanitize._sanitize_hook_payload({
                    "model": _field(response, "model"),
                    "finish_reason": finish_reason,
                    "assistant_message": {
                        "role": (_field(message, "role") if message is not None else None) or "assistant",
                        "content": content,
                        "tool_calls": tool_calls,
                    },
                    "usage": payload.get("usage"),
                }),
                assistant_content_chars=len(content) if isinstance(content, str) else 0,
                assistant_tool_call_count=len(tool_calls),
            )
        _fire(POST_AUXILIARY_CALL, **payload)


def _has_hook(name: str) -> bool:
    try:
        from hermes_cli.lifecycle import has_hook

        return has_hook(name)
    except Exception:
        return False


def _fire(name: str, **payload: Any) -> None:
    """Dispatch one event; a failing subscriber is logged, never propagated (the aux task's
    result must not depend on an observer)."""
    try:
        from hermes_cli.lifecycle import invoke_hook

        invoke_hook(name, **payload)
    except Exception:
        logger.warning("%s plugin hook failed for aux_task=%s; continuing",
                       name, payload.get("aux_task"), exc_info=True)


def _hooks_or_none(**kw: Any) -> Optional[_AuxCallHooks]:
    if not (_has_hook(PRE_AUXILIARY_CALL) or _has_hook(POST_AUXILIARY_CALL)):
        return None
    try:
        hooks = _AuxCallHooks(**kw)
        hooks.pre()
    except Exception:
        logger.warning("pre_auxiliary_call payload build failed; continuing", exc_info=True)
        return None
    return hooks


def _post_safely(hooks: Optional[_AuxCallHooks], response: Any = None, error: Any = None) -> None:
    if hooks is None:
        return
    try:
        hooks.post(response, error)
    except Exception:
        logger.warning("post_auxiliary_call payload build failed; continuing", exc_info=True)


def run_with_aux_hooks(
    call: Callable[[], Any], *, aux_task: str, metadata: Dict[str, Any], client: Any,
    kwargs: Dict[str, Any], provider: str, model: str, api_mode: str, streaming: bool = False,
) -> Any:
    """Run one synchronous provider attempt between ``pre_auxiliary_call`` and
    ``post_auxiliary_call``; the exception (if any) is reported in ``post`` and re-raised."""
    hooks = _hooks_or_none(aux_task=aux_task, metadata=metadata, client=client, kwargs=kwargs,
                           provider=provider, model=model, api_mode=api_mode, streaming=streaming)
    try:
        response = call()
    except BaseException as exc:
        _post_safely(hooks, error=exc)
        raise
    _post_safely(hooks, response=response)
    return response


async def arun_with_aux_hooks(
    call: Callable[[], Awaitable[Any]], *, aux_task: str, metadata: Dict[str, Any]
```

### Core Architecture Module: `agent/client_lifecycle.py`
```
"""Tool-resource teardown, wire-client lifecycle and credential refresh for ``AIAgent``.

``ClientLifecycleMixin`` owns task cleanup, the shared primary client, per-request client caches
(owner-thread close vs stranger-thread abort), credential rotation and route-derived headers.
"""
import logging
import threading
import time
from contextlib import suppress
from typing import Any, Optional

from agent.lazy_forward import forward as _forward, forward_static as _forward_static, lazy_attr as _lazy_attr
from hermes_cli.timeouts import get_provider_request_timeout
from utils import base_url_host_matches, env_float

logger = logging.getLogger("run_agent")  # origin module's logger name: log records / caplog filters unchanged
_QWEN_CODE_VERSION = "0.14.1"  # Qwen Portal mimics the QwenCode CLI
# Per-request cache slot attribute names (OpenAI-style and Anthropic clients).
_OPENAI_SLOT = "_request_client_cache"
_ANTHROPIC_SLOT = "_request_anthropic_client_cache"
_NO_SOCKETS_SUFFIX = " — no sockets found; in-flight request may keep running until the provider finishes"


def _routermint_headers() -> dict:
    """User-Agent RouterMint needs to avoid Cloudflare 1010 blocks."""
    from hermes_cli.version_info import get_version_info
    return {"User-Agent": f"HermesAgent/{get_version_info().base_version}"}


def _qwen_portal_headers() -> dict:
    import platform as _plat
    _ua = f"QwenCode/{_QWEN_CODE_VERSION} ({_plat.system().lower()}; {_plat.machine()})"
    return {
        "User-Agent": _ua, "X-DashScope-CacheControl": "enable", "X-DashScope-UserAgent": _ua,
        "X-DashScope-AuthType": "qwen-oauth",
    }


# Route-specific default headers; first host match wins (order preserved from the original chain).
# Builders resolve their module lazily so run_agent keeps its import-time cost and avoids cycles.
_ROUTE_DEFAULT_HEADERS = (
    ("openrouter.ai", lambda self, url: _lazy_attr("agent.auxiliary_client", "build_or_headers")()),
    ("ai-gateway.vercel.sh", lambda self, url: dict(_lazy_attr("agent.auxiliary_client", "_AI_GATEWAY_HEADERS"))),
    ("integrate.api.nvidia.com", lambda self, url: _lazy_attr("agent.auxiliary_client", "build_nvidia_nim_headers")(url)),
    ("api.routermint.com", lambda self, url: _routermint_headers()),
    ("githubcopilot.com", lambda self, url: _lazy_attr("hermes_cli.models", "copilot_default_headers")()),
    ("api.kimi.com", lambda self, url: dict(_lazy_attr("agent.auxiliary_client", "_AI_GATEWAY_HEADERS"))),
    ("portal.qwen.ai", lambda self, url: _qwen_portal_headers()),
    ("chatgpt.com", lambda self, url: _lazy_attr("agent.codex_headers", "codex_cloudflare_headers")(
        self._client_kwargs.get("api_key", ""), base_url=url)),
    # Covers provider=xai and provider=xai-oauth (api.x.ai).
    ("x.ai", lambda self, url: _lazy_attr("tools.xai_http", "hermes_xai_default_headers")()),
)


def _reset_slot(cache: dict, *, in_use: bool = False) -> None:
    cache["client"] = None
    cache["key"] = None
    cache["poisoned"] = False
    cache["in_use"] = in_use


def _valid_credential_pair(api_key: Any, base_url: Any) -> bool:
    return bool(isinstance(api_key, str) and api_key.strip() and isinstance(base_url, str) and base_url.strip())


def _swap_fallback_clients(agent, fb_client, fb_provider: str, fb_model: str, fb_base_url: str, fb_api_mode: str) -> None:
    """Install the fallback client(s) in place, honoring request_timeout_seconds (None = SDK default)."""
    timeout = get_provider_request_timeout(fb_provider, fb_model)
    if fb_provider == "bedrock" and fb_api_mode in ("anthropic_messages", "bedrock_converse"):
        # Non-Mantle Bedrock: boto3-chain auth, no OpenAI/Anthropic SDK client to carry over.
        from agent.bedrock_adapter import bind_bedrock_runtime
        bind_bedrock_runtime(agent, fb_base_url, fb_api_mode)
        return
    # The SDK exposes an empty/stale api_key when a rotating source is installed.
    key_provider = vars(fb_client).get("_api_key_provider")
    credential = key_provider if callable(key_provider) else fb_client.api_key
    if fb_api_mode == "anthropic_messages":
        from agent.anthropic_adapter import build_anthropic_client
        from agent.anthropic_credentials import resolve_anthropic_token, anthropic_route_is_oauth
        is_anthropic = fb_provider == "anthropic"
        effective_key = credential or (resolve_anthropic_token(model=getattr(agent, "model", None)) if is_anthropic else None) or ""
        agent.api_key = agent._anthropic_api_key = effective_key
        agent._anthropic_base_url = fb_base_url
        agent._anthropic_client = build_anthropic_client(effective_key, fb_base_url, timeout=timeout)
        agent._is_anthropic_oauth = anthropic_route_is_oauth(fb_base_url, effective_key, provider=fb_provider)
        agent.client, agent._client_kwargs = None, {}
        return
    agent.api_key = credential
    agent.client = fb_client
    # Keep provider headers resolve_provider_client() baked into fb_client (SDK: _custom_headers), else
    # later request-client rebuilds drop them and User-Agent-sentinel providers (Kimi Coding) 403.
    fb_headers = getattr(fb_client, "_custom_headers", None) or getattr(fb_client, "default_headers", None)
    agent._client_kwargs = {"api_key": credential, "base_url": fb_base_url}
    if fb_headers:
        agent._client_kwargs["default_headers"] = dict(fb_headers)
    if timeout is not None:
        agent._client_kwargs["timeout"] = timeout
        # Rebuild now so the timeout applies to the very next request, not only after a rotation rebuild.
        agent._replace_primary_openai_client(reason="fallback_timeout_apply")


class ClientLifecycleMixin:
    def _close_task_resources(self, task_id: str) -> None:
        """Release task resources without treating a shared environment as process ownership."""
        from run_agent import _quietly, cleanup_browser, cleanup_vm

        def kill_processes() -> None:
            from tools.process_registry import process_registry
            # A session can run several task IDs; delegated IDs also differ from session_id.
            # Never match the environment key (e.g. "default"), shared by parent and siblings.
            owners = getattr(self, "_process_owner_task_ids", ())
            for process in process_registry.list_sessions():
                if process["owner_task_id"] in owners and process["status"] == "running":
                    # An explicitly persisted job (terminal persist_on_release=true) survives
                    # agent close — session end, compression, error recovery (#41225). The
                    # user can still stop it on purpose via process_manage kill.
                    if process.get("persist_on_release"):
                        continue
                    process_registry.kill_process(
                        process["session_id"], source="agent_close", consume_output=True,
                    )

        def release_computer_use() -> None:
            from tools.computer_use.tool import release_computer_use_session
            release_computer_use_session(task_id)

        def forget_file_state() -> None:
            # File tools key their read stamps / writer claims by the per-turn task_id (cron:
            # ``cron:<job>:<uuid>``, subagents: ``subagent-N-xxxx``), which differs from session_id;
            # cleanup_vm(session_id) alone leaves a finished run looking like a live sibling (#114446).
            from tools.file_tools import clear_file_ops_cache
            for owner in getattr(self, "_process_owner_task_ids", ()):
                if owner and owner != task_id:
                    clear_file_ops_cache(owner)

        for step in (kill_processes, lambda: cleanup_vm(task_id), lambda: cleanup_browser(task_id),
                     release_computer_use, forget_file_state):
            _quietly(step)

    def _client_log_context(self) -> str:
        thread = threading.current_thread()
        return (
            f"thread={thread.name}:{thread.ident} provider={getattr(self, 'provider', 'unknown')} "
            f"base_url={getattr(self, 'base_url', 'unknown')} model={getattr(self, 'model', 'unknown')}"
        )

    def _anthropic_log_context(self) -> str:
        return f"provider={getattr(self, 'provider', None)} model={getattr(self, 'model', None)}"

    def _openai_client_lock(self) -> threading.RLock:
        if getattr(self, "_client_lock", None) is None:
            self._client_lock = threading.RLock()
        return self._client_lock

    @staticmethod
    def _is_openai_client_closed(client: Any) -> bool:
        """Check if an OpenAI client is closed.

        Handles both property and method forms of is_closed:
        - httpx.Client.is_closed is a bool property
        - openai.OpenAI.is_closed is a method returning bool

        Prior bug: getattr(client, "is_closed", False) returned the bound method,
        which is always truthy, causing unnecessary client recreation on every call.
        """
        from unittest.mock import Mock

        if isinstance(client, Mock):
            return False

        is_closed_attr = getattr(client, "is_closed", None)
        if is_closed_attr is not None:
            # Handle method (openai SDK) vs property (httpx)
            if callable(is_closed_attr):
                if is_closed_attr():
                    return True
            elif bool(is_closed_attr):
                return True

        http_client = getattr(client, "_client", None)
        if http_client is not None:
            return bool(getattr(http_client, "is_closed", False))
        return False

    @staticmethod
    def _build_keepalive_http_client(base_url: str = "", *, verify: Any = True) -> Any:
        """Build the shared OpenAI httpx client used by main and aux paths."""
        from agent.process_bootstrap import build_keepalive_http_client
        return build_keepalive_http_client(base_url, verify=verify)

    _create_openai_client = _forward("agent.agent_run
```

### Core Architecture Module: `agent/context_engine.py`
```
"""Abstract base class for pluggable context engines.

A context engine decides when/how conversation context is compacted near the token
limit, tracks usage, and may expose tools. ContextCompressor is the default;
``context.engine`` selects a plugin (``plugins/context_engine/<name>/``); one is active.
Lifecycle: on_session_start() -> per API response update_from_response() -> per turn
should_compress() / compress() -> on_session_end() at real session boundaries only
(CLI exit, /reset, gateway expiry), never per-turn.
"""

import copy
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from agent.compression_marker import elide_middle
from agent.redact import redact_sensitive_text


MEMORY_CONTEXT_MAX_CHARS = 6_000
_MEMORY_CONTEXT_HEAD_CHARS = 4_000
_MEMORY_CONTEXT_TAIL_CHARS = 1_500


def sanitize_memory_context(memory_context: str) -> str:
    """Prepare provider context for a context-engine/LLM egress boundary."""
    sanitized = redact_sensitive_text(memory_context.strip(), force=True, redact_url_credentials=True)
    if len(sanitized) <= MEMORY_CONTEXT_MAX_CHARS:
        return sanitized
    return elide_middle(sanitized, _MEMORY_CONTEXT_HEAD_CHARS, _MEMORY_CONTEXT_TAIL_CHARS)


def automatic_compaction_status_message(engine: Any, *, phase: str, default_message: str, **context: Any) -> str | None:
    """Host-visible status for an automatic compaction event; ``None`` = emit nothing.

    Engines suppress via ``emit_automatic_compaction_status = False`` or
    customize via ``get_automatic_compaction_status_message(...)``.
    """
    if not getattr(engine, "emit_automatic_compaction_status", True):
        return None
    formatter = getattr(engine, "get_automatic_compaction_status_message", None)
    message = formatter(phase=phase, default_message=default_message, **context) if callable(formatter) else default_message
    if message is None:
        return None
    return str(message).strip() or None


class ContextEngine(ABC):
    """Base class all context engines must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Short identifier (e.g. 'compressor', 'lcm')."""

    # Token state: engines MUST maintain these; run_agent.py reads them directly.
    last_prompt_tokens: int = 0
    last_completion_tokens: int = 0
    last_total_tokens: int = 0
    threshold_tokens: int = 0
    context_length: int = 0
    compression_count: int = 0
    # Compaction parameters (read by run_agent.py for preflight). protect_first_n counts
    # non-system head messages kept verbatim IN ADDITION to the always-protected system
    # prompt (3 keeps the historical head shape).
    # These control the preflight compression check. Subclasses may override via __init__ or property;
    # defaults are sensible for most engines. See #13754.
    threshold_percent: float = 0.75
    protect_first_n: int = 3
    protect_last_n: int = 6
    # False keeps successful automatic compaction passes silent (routine background
    # maintenance); warnings, errors and manual /compress still surface.
    emit_automatic_compaction_status: bool = True

    @abstractmethod
    def update_from_response(self, usage: Dict[str, Any]) -> None:
        """Update tracked token usage after every LLM call.

        ``prompt_tokens``/``completion_tokens``/``total_tokens`` are always present; the
        canonical buckets (``input_tokens``, ``output_tokens``, ``cache_read_tokens``,
        ``cache_write_tokens``, ``reasoning_tokens``) are optional on older hosts.
        """

    @abstractmethod
    def should_compress(self, prompt_tokens: int = None) -> bool:
        """Return True if compaction should fire this turn."""

    def should_compress_info(self, prompt_tokens: int = None) -> "tuple[bool, str | None]":
        """Return ``(should_compress, reason)``.

        Engines with block reasons (summary-LLM cooldown, anti-thrashing guard) override
        this so callers can warn instead of silently skipping; the default keeps plugin
        engines from raising AttributeError.
        """
        return self.should_compress(prompt_tokens), None

    @abstractmethod
    def compress(
        self, messages: List[Dict[str, Any]], current_tokens: Optional[int] = None,
        focus_topic: Optional[str] = None, force: bool = False, memory_context: str = "",
    ) -> List[Dict[str, Any]]:
        """Compact ``messages`` into a valid OpenAI-format list that fits the budget.

        ``focus_topic`` comes from manual ``/compress <focus>`` (prioritise that topic);
        ``force`` asks to bypass an engine-owned cooldown; ``memory_context`` is provider
        text for the handoff prompt. Older engines may omit optional parameters — the
        host filters them by signature.
        """

    def prune_tool_results_only(
        self, messages: List[Dict[str, Any]], current_tokens: int | None = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Deterministically trim old tool-result payloads without an LLM call.

        Runs on a low, cost-oriented trigger independent of ``should_compress`` so
        large-window engines reclaim re-sent tool output long before full compaction.
        Returns ``(messages, n_pruned)``; the default no-op keeps older engines safe.
        """
        return messages, 0

    def select_context(
        self, request_messages: List[Dict[str, Any]], *, conversation_messages: List[Dict[str, Any]] = None,
        incoming_message: Dict[str, Any] = None, budget_tokens: int = 0,
    ) -> List[Dict[str, Any]]:
        """Optionally *select* (replace) the context for THIS request, pre-generation.

        Runs on every provider request (also retries), independent of
        ``should_compress()``: ``compress()`` shrinks over-long context, this swaps in a
        different one (retrieval, topic routing, branch switching). Return ``None`` to
        leave the request unchanged. The returned list is request-only — it MUST NOT be
        treated as persisted transcript state (session DB history is untouched); unlike
        ``pre_llm_call`` it may replace the list. The host runs it before prompt
        cache-control and every request sanitizer, so a malformed replacement never
        reaches the provider and the default no-op keeps the request byte-identical;
        an engine that replaces the list changes its own cache prefix (breakpoints are
        re-derived on the selected list). ``request_messages`` is the assembled request
        (system prompt + history + ephemeral prefill); ``conversation_messages`` is the
        persisted history for reference only (do not mutate); ``budget_tokens`` is the
        model's context length or 0 if unknown.
        """
        return None

    def on_turn_complete(self, messages: List[Dict[str, Any]], usage: Dict[str, Any] = None, **kwargs: Any) -> None:
        """Observe a finished turn (complement of ``select_context()``) to index/update
        routing state for the next request.

        Best-effort, not guaranteed: fires from the normal finalization seam only; some
        abnormal early returns (content-policy block, provider terminal failure) skip it.
        ``messages`` is a read-only shallow copy (return value ignored; never rely on
        transcript mutation). ``usage`` has the ``update_from_response`` shape and is
        ``None`` when no provider response was reached (interrupt). ``kwargs`` may include
        ``turn_id``, ``task_id``, ``api_call_count``, ``interrupted``, ``failed``, ``turn_exit_reason``.
        """
        return None

    def should_compress_preflight(self, messages: List[Dict[str, Any]]) -> bool:
        """Cheap rough check before the API call (no real token count yet); default skips."""
        return False

    def should_defer_preflight_to_real_usage(self, rough_tokens: int) -> bool:
        """True when preflight should trust recent real usage over the noisy rough
        estimate (avoids re-compacting after a compressed request already fit)."""
        return False

    def get_automatic_compaction_status_message(
        self, *, phase: str, default_message: str, **context: Any,
    ) -> str | None:
        """User-visible status for automatic compaction, or ``None`` to suppress it.

        ``phase`` is the host call site (``"preflight"`` / ``"compress"``); ``context``
        carries best-effort ``approx_tokens`` / ``threshold_tokens``. Warnings, errors
        and manual ``/compress`` are not governed by this hook.
        """
        return default_message if self.emit_automatic_compaction_status else None

    def has_content_to_compress(self, messages: List[Dict[str, Any]]) -> bool:
        """Preflight guard for gateway ``/compress``: False reports "nothing to
        compress yet" without an LLM call (e.g. transcript entirely protected)."""
        return True

    def on_session_start(self, session_id: str, **kwargs) -> None:
        """Session begins: load persisted state. kwargs may include hermes_home, platform, model."""

    def on_session_end(self, session_id: str, messages: List[Dict[str, Any]]) -> None:
        """Real session boundary (CLI exit, /reset, gateway expiry) — never per-turn."""

    def on_session_reset(self) -> None:
        """/new or /reset: reset per-session state (default: counters and token tracking)."""
        # Reset cross-call calibration state captured under the PREVIOUS model. These fields encode "the
        # provider proved this prompt fit" / "preflight can be deferred" decisions that are only valid for
        # the model that produced them. Carrying them across a switch to a smaller-context model would let
        # should_defer_preflight_to_real_usage() suppress a preflight compression the new model actually
        # needs — the exact oversized-send-after-switch failure in #23767. The new model's first response
        # repopulates them via update_from_response(). Setting last_prompt_tokens to 0 (NOT -1) is
        # delibe
```

### Core Architecture Module: `agent/conversation_loop.py`
```
"""The agent conversation loop — extracted from ``run_agent.AIAgent``.

``run_conversation(agent, ...)`` drives one user turn (model call, tool dispatch,
retries, fallbacks, compression, post-turn hooks). Symbols that callers patch on
``run_agent`` (``handle_function_call``, ``_set_interrupt``, ``OpenAI``) resolve via
``_ra`` so those patches keep working."""

from __future__ import annotations

import inspect
import json
import logging
import re
import time
from dataclasses import dataclass, field, fields
from typing import Any, Dict, List, Optional

from agent.codex_responses_adapter import _summarize_user_message_for_log
from agent.fast_mode import begin_turn as begin_fast_mode_turn
from agent.message_metadata import append_message, without_persistence_fields
from agent.message_sanitization import _repair_tool_call_arguments, _sanitize_surrogates
from agent.model_metadata import MINIMUM_CONTEXT_LENGTH, _estimate_tools_tokens_rough
from agent.process_bootstrap import _install_safe_stdio
from agent.prompt_builder import RUNTIME_ENVIRONMENT_END, RUNTIME_ENVIRONMENT_HEADING
from agent.prompt_caching import (
    build_prompt_cache_plan,
    effective_cache_ttl,
    strip_anthropic_cache_control,
    strip_anthropic_tool_cache_control,
)
from agent.repetition_guard import REPETITION_LOOP_INTERRUPTED, is_runaway_repetition
from agent.runtime_cwd import resolve_agent_cwd
from agent.surface_switch import (
    identity_line_value, note_inert_pinned_tools, runtime_host_value, stage_surface_switch_note,
)
from agent.turn_context import PreflightCompressionTimedOut, build_turn_context
from hermes_cli.observability.shared_metrics_efficiency import record_cache_break, record_prompt_rebuild
from agent.turn_retry_state import TurnRetryState
# Phase helpers of the turn loop, bound at import so a source-tree swap cannot load a
# skewed phase mid-turn.
from agent.turn_api_call import handle_api_interrupt, nous_rate_limit_guard, perform_api_call
from agent.turn_api_error import handle_api_error
from agent.turn_api_request import build_api_request
from agent.turn_failure_copy import FAILED_TURN_DISPLAY_KIND, failed_turn_notice, site_copy
from agent.turn_final_response import finish_text_response
from agent.turn_finalizer import finalize_turn
from agent.turn_iteration_prep import (
    announce_api_call,
    apply_retry_restarts,
    begin_iteration,
    prepare_iteration,
)
from agent.turn_loop_errors import handle_outer_loop_error
from agent.turn_preflight_gate import run_preflight_gate
from agent.turn_request_assembly import assemble_api_request
from agent.turn_response_check import check_api_response
from agent.turn_response_intake import normalize_model_response
from agent.turn_tool_round import run_tool_round
from hermes_logging import set_session_context
from tools.skill_provenance import set_current_write_origin
from utils import base_url_host_matches

logger = logging.getLogger(__name__)

# Must mirror _STALE_TOOL_CALL_MARKER_RE in hermes_state.py; kept local so importing
# hermes_state (module-level DEFAULT_DB_PATH) is not forced at load time.
_STALE_MARKER_RE = re.compile(r"^\[[A-Za-z_][A-Za-z0-9_.-]*\]$")

# Shared by _apply_active_turn_redirect and the api_messages ghost-row filter so both sites cannot drift.
_INTERRUPT_SCAFFOLD_MARKER = "[This response was interrupted by a user correction.]"


# One-time wrap-up notice appended when a wall-clock run budget (--run-budget) crosses 80%.
RUN_BUDGET_WRAPUP_NOTICE = (
    "[SYSTEM NOTICE — run time budget nearly exhausted] Run time budget nearly exhausted. "
    "Stop new discovery/verification work now. Produce the required final deliverable "
    "(answer/JSON/summary) from the state you already have, completing only mandatory writes."
)


def _midturn_request_pressure_tokens(
    agent: Any, api_messages: List[Dict[str, Any]], effective_system: str, approx_tokens: int
) -> int:
    """Token figure the mid-turn pre-API compression guard compares: the pruned
    native-Responses estimate when native compaction eligibility is proven (the generic
    estimate overstates the wire on compacted sessions, #96995), else messages+tools.
    The system prompt is counted exactly once.

    When the upcoming request is eligible for native Responses compaction the transport will
    checkpoint-prune the payload before sending, so the generic durable-history estimate overstates the wire
    by orders of magnitude on a compacted session and fires a 600s local compression the main request never
    needed (#96995).
    """
    try:
        from agent.codex_responses_adapter import estimate_native_responses_preflight_tokens
        native = estimate_native_responses_preflight_tokens(
            agent, api_messages, system_prompt=effective_system or "",
            tools=getattr(agent, "tools", None) or None,
        )
        if isinstance(native, int) and not isinstance(native, bool) and native >= 0:
            return native
    except Exception:
        logger.debug(
            "native Responses mid-turn estimate unavailable; using generic transcript estimate",
            exc_info=True,
        )
    return approx_tokens + (_estimate_tools_tokens_rough(agent.tools) if agent.tools else 0)


def _review_input_budget_exhausted(agent: Any) -> bool:
    """True when a detached review fork has replayed its aggregate input budget.

    Only forks with an explicit ``_review_input_token_budget`` are gated (#93057). Fires
    at the top of the NEXT iteration, so the budget-crossing request completes first."""
    budget = getattr(agent, "_review_input_token_budget", None)
    if not isinstance(budget, int) or isinstance(budget, bool) or budget <= 0:
        return False
    used = getattr(agent, "session_input_tokens", 0)
    return isinstance(used, int) and not isinstance(used, bool) and used >= budget


def _maybe_inject_run_budget_wrapup(agent: Any, messages: List[Dict[str, Any]]) -> bool:
    """Inject the one-time wall-clock wrap-up notice when past 80% of budget.

    Appends to the NEWEST ``role:"tool"`` message (cache-safe, like /steer); latches
    ``_run_budget_wrapup_injected`` only on a successful append."""
    budget = getattr(agent, "run_budget_seconds", None)
    started = getattr(agent, "_run_budget_started_at", None)
    if not budget or not started or getattr(agent, "_run_budget_wrapup_injected", False) or (
        (time.time() - started) < 0.8 * float(budget)
    ):
        return False
    from agent.context_compressor import _DB_PERSISTED_MARKER
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "tool":
            # Only the current tool-result tail is mutable; an older turn may already be
            # cached (same contract as _maybe_inject_iteration_budget_warning).
            if msg.get(_DB_PERSISTED_MARKER):
                return False
            existing = msg.get("content", "")
            if isinstance(existing, str):
                msg["content"] = existing + f"\n\n{RUN_BUDGET_WRAPUP_NOTICE}"
            else:  # multimodal content blocks — append a text block
                try:
                    msg["content"] = [*(existing or []), {"type": "text", "text": RUN_BUDGET_WRAPUP_NOTICE}]
                except Exception:
                    return False
            agent._run_budget_wrapup_injected = True
            logger.info(
                "Run budget wrap-up notice injected (budget=%.0fs, elapsed=%.0fs)",
                float(budget), time.time() - started,
            )
            return True
    return False


def _restore_user_after_reference_handoff(
    messages: List[Dict[str, Any]], user_message: Any
) -> bool:
    """Re-append this turn's real user ask when compaction left only a handoff (#80622).
    Returns True when a restore append happened."""
    if isinstance(user_message, str):
        restorable = bool(user_message.strip())
    else:
        restorable = isinstance(user_message, list) and bool(user_message)
    if not restorable:
        return False
    last = messages[-1] if messages else None
    if isinstance(last, dict) and last.get("role") == "user" and last.get("content") == user_message:
        return False
    append_message(messages, {"role": "user", "content": user_message})
    return True


def _should_skip_model_call_for_reference_handoff(
    messages: List[Dict[str, Any]], user_message: Any
) -> bool:
    """Guard post-compaction continues against sole-handoff active turns (#80622)."""
    from agent.context_compressor import reference_handoff_would_drive_next_model_call
    # A restored ask is an actionable non-synthetic user row appended after the
    # handoff — by construction the handoff no longer drives.
    return reference_handoff_would_drive_next_model_call(messages) and not (
        _restore_user_after_reference_handoff(messages, user_message)
    )


# Fallback final_response for the sole-handoff skip (#80622); finalize_turn appends it as a
# fresh assistant row, so it must not replay the last assistant text.
# Deliberately NOT a replay of the last assistant text: finalize_turn's non-assistant-tail chokepoint
# (#43849) appends final_response as a fresh assistant row, so recovering the previous turn's prose here
# would duplicate it in the durable transcript AND re-deliver it to the user as if it were this turn's
# answer. A short status is honest and idempotent.
_HANDOFF_SKIP_FINAL_RESPONSE = (
    "Context was compacted. The previous response is complete — awaiting your next message."
)

# Terminal final_response when compression timed out while the request was still oversized (#98722).
# Terminal final_response for a turn ended because context compression hit its host progress-aware timeout
# while the request was still oversized (#98722, salvaged from #98741). Sending the unchanged request would
# only bounce off the provider's overflow error and re-enter compression in the same turn.
_COMPRESSION_TIMEOUT_FINAL_RESPONSE = (
    "Context compression timed 
```

### Core Architecture Module: `agent/learning_graph_render.py`
```
"""Terminal renderer for the learning timeline (learned skills + memories): the desktop starmap's data
(``apps/desktop/src/app/starmap``) drawn as a timeline bar chart (date rows, skill/memory bars colored by dominant
category, cumulative trajectory sparkline) plus per-slice bucket metadata the TUI walks as a tree. Age gradient and
memory ink are ported from the desktop source. Grids are style runs ``[text, style, alpha, hex?]``: consumers map
style + brightness onto their palette; hex overrides the base color (category heatmap). Pure, stdlib-only."""

from __future__ import annotations

import math
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from agent.learning_graph import memory_node_id
from hermes_time import safe_strftime

LEAD_IN = 0.06  # time-axis.ts LEAD_IN: the oldest node sits just off recency 0.
# constants.ts AGE_GRADIENT — old quiet, recent bright.
AGE_OLD_INK, AGE_MID_INK, AGE_NEW_INK, AGE_MID = 0.42, 0.74, 0.95, 0.52
# Style keys consumers map to base colors (brightness = the run alpha).
STYLE_BG, STYLE_SKILL, STYLE_MEMORY, STYLE_LABEL, STYLE_DIM = "bg", "skill", "memory", "label", "dim"
# Legend glyphs mirror NODE_SHAPE (skill = circle, memory = diamond).
SKILL_GLYPH, MEMORY_GLYPH = "●", "◆"
_LABEL_KEYS = tuple("123456789abc")

Row = list  # of runs ``[text, style, alpha, hex?]``; a grid is a list of rows


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _smoothstep(p: float) -> float:
    p = _clamp(p, 0.0, 1.0)
    return p * p * (3 - 2 * p)


def _is_memory(node: dict[str, Any]) -> bool:
    return node.get("kind") == "memory"


def _node_id(node: dict[str, Any]) -> str:
    return str(node.get("id", ""))


def _utc(ts: float) -> datetime:
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def _lead_in(ratio: float) -> float:
    return LEAD_IN + (1 - LEAD_IN) * ratio


def _visible_count(reveal: float, n: int) -> int:
    return int(_clamp(math.ceil(reveal * n), 0, n))


def _node_raw_label(node: dict[str, Any]) -> str:
    return str(node.get("label") or node.get("id") or "unknown").strip()


def _node_ts(node: dict[str, Any]) -> Optional[float]:
    try:
        return None if node.get("timestamp") is None else float(node["timestamp"])
    except (TypeError, ValueError):
        return None


def recency_ink(rec: float) -> float:
    """Port of geometry.ts ``recencyInk`` — smoothstep age → ink alpha."""
    t = _clamp(rec, 0.0, 1.0)
    return _lerp(AGE_OLD_INK, AGE_MID_INK, _smoothstep(t / AGE_MID)) if t <= AGE_MID else _lerp(AGE_MID_INK, AGE_NEW_INK, _smoothstep((t - AGE_MID) / (1 - AGE_MID)))


def format_date(ts: Optional[float]) -> str:
    try:
        dt = _utc(float(ts)) if ts else None
    except (ValueError, OSError, OverflowError):
        dt = None
    return f"{dt.day} {safe_strftime(dt, '%b %Y')}" if dt else "unknown"


def compute_recency(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    """Port of time-axis.ts ``computeRecency`` (id → recency ratio, timed flag).
    Untimed graphs (no spread of timestamps) fall back to ordinal position so
    every node still gets a distinct recency."""
    known = [t for t in (_node_ts(n) for n in nodes) if t is not None]
    min_ts, max_ts = (min(known), max(known)) if known else (None, None)
    timed = bool(known) and max_ts > min_ts
    ordered = sorted(nodes, key=lambda n: (_node_ts(n) if _node_ts(n) is not None else math.inf, _node_id(n)))
    last = max(len(ordered) - 1, 1)
    ord_ratio = {_node_id(n): (i / last if len(ordered) > 1 else 0.0) for i, n in enumerate(ordered)}
    rec = {
        nid: _lead_in(_clamp((ts - min_ts) / (max_ts - min_ts) if timed and ts is not None else ord_ratio.get(nid, 0.0), 0.0, 1.0))
        for nid, ts in ((_node_id(n), _node_ts(n)) for n in nodes)
    }
    return {"rec": rec, "timed": timed, "minTs": min_ts, "maxTs": max_ts}


def _date_at(rec: dict[str, Any], reveal: float) -> Optional[float]:
    lo, hi = rec.get("minTs"), rec.get("maxTs")
    return None if not rec.get("timed") or lo is None or hi is None else round(lo + _clamp(reveal, 0, 1) * (hi - lo))


# ── Color: ported from color.ts so memory ink + age fade match the desktop ──

def hex_to_rgb(s: str) -> tuple[int, int, int]:
    s = s.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    try:
        return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
    except (ValueError, IndexError):
        return 255, 215, 0


def rgb_to_hex(c: tuple) -> str:
    return "#{:02X}{:02X}{:02X}".format(*(int(_clamp(v, 0, 255)) for v in c))


def mix_rgb(a: tuple, b: tuple, t: float) -> tuple[int, int, int]:
    return tuple(round(_lerp(a[i], b[i], _clamp(t, 0.0, 1.0))) for i in range(3))  # type: ignore[return-value]


def _rgb_to_hsl(c: tuple) -> tuple[float, float, float]:
    r, g, b = (x / 255 for x in c)
    mx, mn = max(r, g, b), min(r, g, b)
    light, d = (mx + mn) / 2, mx - mn
    if not d:
        return 0.0, 0.0, light
    s = d / (2 - mx - mn) if light > 0.5 else d / (mx + mn)
    h = (g - b) / d + (6 if g < b else 0) if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    return h * 60, s, light


# Hue sextant → (r, g, b) as a permutation of (c, x, 0).
_HUE_SEXTANTS = (
    lambda c, x: (c, x, 0.0), lambda c, x: (x, c, 0.0), lambda c, x: (0.0, c, x),
    lambda c, x: (0.0, x, c), lambda c, x: (x, 0.0, c), lambda c, x: (c, 0.0, x),
)


def _hsl_to_rgb(h: float, s: float, light: float) -> tuple[int, int, int]:
    hue = ((h % 360) + 360) % 360
    c = (1 - abs(2 * light - 1)) * s
    x, m = c * (1 - abs(((hue / 60) % 2) - 1)), light - c / 2
    return tuple(round((v + m) * 255) for v in _HUE_SEXTANTS[min(int(hue // 60), 5)](c, x))  # type: ignore[return-value]


def derive_palette(primary_hex: str, *, dark: bool = True) -> dict[str, str]:
    """Port of color.ts ``computePalette`` (the bits a terminal needs)."""
    primary = hex_to_rgb(primary_hex)
    base, bg = ((255, 255, 255), (8, 8, 12)) if dark else ((0, 0, 0), (250, 250, 250))
    h, s, light = _rgb_to_hsl(primary)
    return {
        "primary": primary_hex,
        # Memories are drillable → primary "clickable" ink; skills are dead-ends → muted complement.
        "memory": rgb_to_hex(mix_rgb(primary, base, 0.12 if dark else 0.18)),
        "skill": rgb_to_hex(mix_rgb(_hsl_to_rgb(h + 165, max(s, 0.5), _clamp(light, 0.5, 0.7)), bg, 0.45)),
        "label": rgb_to_hex(mix_rgb(base, bg, 0.35)), "dim": rgb_to_hex(mix_rgb(base, bg, 0.7)), "bg": rgb_to_hex(bg),
    }


def _node_score(node: dict[str, Any], rec: float) -> float:
    """Pick which visible objects deserve map markers + label rows."""
    return 3.5 + rec if _is_memory(node) else rec * 2 + math.sqrt(max(0.0, float(node.get("useCount", 0) or 0))) + (2.0 if node.get("pinned") else 0.0)


def _node_card(node: dict[str, Any]) -> dict[str, Any]:
    """Shared glyph/label/meta/style fields for label rows and bucket trees."""
    mem, text, date = _is_memory(node), _node_raw_label(node), format_date(_node_ts(node))
    if mem:
        meta = f"{'profile memory' if node.get('memorySource') == 'profile' else 'memory'} · {date}"
    else:
        count = int(node.get("useCount", 0) or 0)
        meta = " · ".join([str(node.get("category") or "skill"), date] + ([f"x{count}"] if count else []) + (["pinned"] if node.get("pinned") else []))
    return {
        "glyph": MEMORY_GLYPH if mem else SKILL_GLYPH, "label": text if len(text) <= 26 else text[:23].rstrip() + "…",
        "meta": meta, "style": STYLE_MEMORY if mem else STYLE_SKILL,
    }


def _skill_category_counts(nodes: Iterable[dict[str, Any]]) -> Counter:
    return Counter(str(n.get("category") or "skill") for n in nodes if not _is_memory(n))


# ── Timeline chart frame ─────────────────────────────────────────────────────

class _ChartBucket:
    __slots__ = ("label", "ts", "nodes", "rec")

    def __init__(self, label: str, ts: float):
        self.label, self.ts, self.rec = label, ts, 1.0
        self.nodes: list[dict[str, Any]] = []

    memories = property(lambda self: sum(1 for n in self.nodes if _is_memory(n)))
    skills = property(lambda self: len(self.nodes) - self.memories)
    total = property(lambda self: len(self.nodes))

    def category(self) -> Optional[str]:
        return max(counts, key=lambda k: counts[k]) if (counts := _skill_category_counts(self.nodes)) else None


# granularity → (period key, row label) from a UTC datetime.
_PERIODS: dict[str, tuple] = {
    "day": (lambda dt: (dt.year, dt.month, dt.day), lambda dt: f"{dt.day} {safe_strftime(dt, '%b')}"),
    "month": (lambda dt: (dt.year, dt.month), lambda dt: safe_strftime(dt, "%b %Y")),
    "year": (lambda dt: (dt.year,), lambda dt: dt.strftime("%Y")),
}


def _period(ts: float, granularity: str) -> tuple[tuple[int, ...], str]:
    return tuple(fn(_utc(ts)) for fn in _PERIODS.get(granularity, _PERIODS["year"]))  # type: ignore[return-value]


def _fill_even_bins(buckets: list[_ChartBucket], nodes: Iterable[dict[str, Any]], rec: dict[str, Any]) -> None:
    """Drop each node into the bin its recency ratio maps to (order preserved)."""
    for node in nodes:
        buckets[int(_clamp(math.floor(rec["rec"].get(_node_id(node), 0.0) * len(buckets)), 0, len(buckets) - 1))].nodes.append(node)


def _build_chart_buckets(nodes: list[dict[str, Any]], rec: dict[str, Any], max_rows: int) -> list[_ChartBucket]:
    """Timeline rows: finest date granularity that fits, oldest → newest."""
    if not nodes:
        return []
    if not rec["timed"]:
        buckets = [_ChartBucket(f"#{i + 1}", float(i)) for i in range(min(max_rows, len(nodes)))]
        _fill_even_bins(buckets, sorted(nodes, key=lambda n: rec["rec"].get(_node_id(n), 0.0)), rec)
        return buckets

    chosen: Optional[list[_ChartBucket]] = None
    for granularity in ("day", "month"
```

### Core Architecture Module: `agent/moa_loop.py`
```
"""Mixture-of-Agents runtime helpers for /moa turns.

The slash command marks one user turn as MoA-enabled; the normal agent loop still
owns tool calling and turn termination, while this module gathers reference-model
context before each model iteration.
"""

from __future__ import annotations

import contextlib
import functools
import hashlib
import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait as _futures_wait
from dataclasses import KW_ONLY, dataclass, replace
from types import SimpleNamespace
from typing import Any

from agent.auxiliary_client import call_llm
from agent.message_content import flatten_message_text
from agent.moa_alternation import destination_key, is_role_alternation_rejection, merge_same_role_messages
from agent.transports import get_transport
from agent.usage_pricing import CanonicalUsage

logger = logging.getLogger(__name__)

# Privacy filter (moa.privacy_filter: '' | display | full): PII classes agent.redact
# leaves alone. The phone pattern requires explicit delimiters so line numbers,
# dates, times, SHAs, IPs and versions never match.
# Advisor (reference) outputs can echo PII from the conversation — emails, phone numbers, credentials pasted
# by the user — into surfaces the user may not expect: the labelled reference blocks rendered in the UI,
# saved MoA trace files, and (in `full` mode) the guidance block injected into the aggregator prompt (issue
# #59959). Secret/credential shapes (API-key prefixes, JWTs, private keys, DB connection strings, E.164
# phone numbers) are handled by the repo's central redactor, ``agent.redact .redact_sensitive_text`` — the
# MoA filter never re-implements those. The two patterns below cover the PII classes the central redactor
# deliberately leaves alone for log/tool output (emails and formatted phone numbers). Pattern safety:
# advisory text is frequently code-review-shaped — line numbers, timestamps, git SHAs, IDs, IP addresses. A
# bare 10-digit match would mangle all of those, so the phone pattern requires clearly delimited formatting:
# a parenthesized area code and/or explicit `-`/`.` separators between groups ((555) 123-4567, 555-123-4567,
# 555.123.4567, +1 555-123-4567). Undelimited digit runs (5551234567), dates (2026-07-12), times (12:34:56),
# hex IDs, and dotted quads never match. International numbers in E.164 form (+14155551234) are already
# masked by the central redactor.
_MOA_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_MOA_PHONE_RE = re.compile(
    r"(?<![\w.+-])"                    # no leading word char / dot / + / - (kills IPs, IDs, versions)
    r"(?:\+?1[ .-])?"                  # optional NA country code
    r"(?:\(\d{3}\)[ .-]?|\d{3}[.-])"   # delimited area code: (555) or 555- / 555.
    r"\d{3}[.-]\d{4}"                  # exchange-subscriber with explicit separator
    r"(?![\w-])"                       # no trailing word char / hyphen
)


def _redact_reference_text(text: Any) -> Any:
    """Redact secrets (central redactor) then MoA PII patterns.

    force=True: the privacy filter is its own opt-in, independent of the global
    log-redaction toggle. code_file=True: keeps the ENV/JSON assignment heuristics
    (which mangle source snippets) off advisory prose/code.
    """
    if not isinstance(text, str) or not text:
        return text
    from agent.redact import redact_sensitive_text
    text = redact_sensitive_text(text, force=True, code_file=True)
    text = _MOA_EMAIL_RE.sub("[redacted email]", text)
    return _MOA_PHONE_RE.sub("[redacted phone]", text)


def _moa_privacy_mode(moa_raw: Any) -> str:
    """Normalized privacy-filter mode from a raw ``moa`` config."""
    from hermes_cli.moa_config import coerce_privacy_filter
    raw = moa_raw if isinstance(moa_raw, dict) else {}
    return coerce_privacy_filter(raw.get("privacy_filter"))


def _redact_reference_outputs(reference_outputs: list[tuple[str, str, Any]]) -> list[tuple[str, str, Any]]:
    """Redact advisor text in reference-output tuples; accounting slot untouched."""
    return [(label, _redact_reference_text(text), acct) for label, text, acct in reference_outputs]


def _redact_message_content(content: Any) -> Any:
    """Redact a message's content: a string, or the text parts of a content-part list."""
    if isinstance(content, str):
        return _redact_reference_text(content)
    if isinstance(content, list):
        return [
            {**p, "text": _redact_reference_text(p.get("text"))}
            if isinstance(p, dict) and isinstance(p.get("text"), str)
            else p
            for p in content
        ]
    return content


def _redact_trace_messages(messages: Any) -> Any:
    """Redact message copies for trace persistence (string or content-part lists)."""
    if not isinstance(messages, list):
        return messages
    return [
        {**m, "content": _redact_message_content(m.get("content"))} if isinstance(m, dict) else m
        for m in messages
    ]


def _redact_trace_accounting(acct: Any) -> Any:
    """Copy a ``_RefAccounting`` with its trace text (messages/output) redacted."""
    if not isinstance(acct, _RefAccounting):
        return acct
    return replace(acct, messages=_redact_trace_messages(acct.messages), output=_redact_reference_text(acct.output))


# Cold-start caches: preset and per-(provider, model) runtime are immutable for a turn.
# A MoA preset switch used to re-resolve the full config + preset + every slot's provider runtime on EACH
# create() call (once per tool-loop iteration), serially before the parallel fan-out could start — adding
# 5-30s of "frozen" latency on complex presets (#66793).
_preset_cache_lock = threading.Lock()
_preset_cache: dict[tuple, Any] = {}


def _resolve_preset_cached(preset_name: str) -> tuple[dict[str, Any], Any]:
    """``(preset, raw moa config)``; the resolved preset is cached per config file signature
    (skips resolve_moa_preset's full validation of the moa block on every create())."""
    from hermes_cli.config import get_config_path, load_config
    from hermes_cli.moa_config import resolve_moa_preset
    from utils import file_signature
    try:
        cfg_stamp = file_signature(get_config_path().stat())
    except OSError:
        cfg_stamp = None
    moa_raw = load_config().get("moa") or {}
    key = (cfg_stamp, preset_name)
    with _preset_cache_lock:
        preset = _preset_cache.get(key) if cfg_stamp is not None else None
    if preset is None:
        preset = resolve_moa_preset(moa_raw, preset_name)
        if cfg_stamp is not None:
            with _preset_cache_lock:
                _preset_cache.clear()  # one live config stamp at a time
                _preset_cache[key] = preset
    return preset, moa_raw


_runtime_cache_lock = threading.Lock()
_runtime_cache: dict[tuple[str, str, str], tuple[float, dict[str, Any]]] = {}

# Short TTL so rotated keys / base_url edits are picked up within 5 minutes.
_RUNTIME_CACHE_TTL_SECONDS = 300.0

# Cap on concurrent reference calls (guards pathologically large presets).
_MAX_REFERENCE_WORKERS = 8


@dataclass(slots=True)
class _RefAccounting:
    """Per-reference usage, cost and full trace (third slot of a reference-output tuple).

    Cost is priced at the advisor's OWN rate and summed in dollars (advisors may run
    on a different model than the aggregator). Trace fields are only populated when
    tracing is on.
    """

    usage: Any
    cost_usd: Any = None
    cost_status: str | None = None
    cost_source: str | None = None
    _: KW_ONLY
    messages: Any = None
    output: str | None = None
    model: str | None = None
    provider: str | None = None
    temperature: Any = None


# Per-tool-result char budget for the advisory view: tool CALLS are kept in full,
# tool RESULTS are head+tail previewed. The aggregator always gets the full transcript.
_REFERENCE_TOOL_RESULT_BUDGET = 4000

# Reference system prompt: without this framing a reference assumes it is the acting
# agent and refuses ("I can't access repositories") or tries to call tools.
_REFERENCE_SYSTEM_PROMPT = (
    "You are a reference advisor in a Mixture of Agents (MoA) process. You are "
    "NOT the acting agent and you do NOT execute anything: you cannot call "
    "tools, run commands, browse, or access files, repositories, or URLs, and "
    "you should not try to or apologize for being unable to. A separate "
    "aggregator/orchestrator model holds those capabilities and will take the "
    "actual actions.\n\n"
    "CRITICAL: You must NEVER claim or imply that you have executed a command, "
    "downloaded a file, accessed a URL, or performed any action. You can only "
    "analyze and advise based on the conversation context. Examples of what to "
    "avoid:\n"
    "- Bad: \"I ran curl and got 404.\"\n"
    "- Bad: \"I downloaded the file successfully.\"\n"
    "- Bad: \"I checked the repository and found...\"\n"
    "- Good: \"Based on the error pattern, a curl request to that URL would likely return 404.\"\n"
    "- Good: \"The conversation suggests downloading this file may help.\"\n"
    "- Good: \"From the context, checking the repository would reveal...\"\n\n"
    "The conversation below is the current state of a task handled by that "
    "acting agent. Your job is to give your most intelligent analysis of that "
    "state: understand the goal, reason about the problem, and advise on what "
    "to do next. Surface the best approach, concrete next steps and tool-use "
    "strategy, likely pitfalls and risks, and anything the acting agent may "
    "have missed or gotten wrong. Assume any referenced files, URLs, or "
    "systems exist and reason about them from the context given rather than "
    "asking for access.\n\n"
    "Respond with your advice directly — no preamble, no disclaimers about "
    "tools or access. Advise in prose: never emit a tool call or a JSON "
    "tool-call object, because the aggregator replays
```

### Core Architecture Module: `agent/outbound_webhooks.py`
```
"""Outbound webhooks: ``hooks.outbound`` entries (url, events, secret_env|secret, matcher for
pre/post_tool_call, timeout clamped to [1, 60], name) -> notify-only callbacks on the plugin hook
manager, so every ``invoke_hook()`` site can POST lifecycle events (mirror of
``gateway/platforms/webhook.py``).  Fire-and-forget through a bounded queue + one daemon worker,
so a target can never block a tool call or influence agent flow.  HMAC-SHA256 signed
(``X-Hermes-Signature-256: sha256=<hex>`` over the raw body) when a secret is configured;
``HERMES_SAFE_MODE=1`` skips registration; registration is idempotent.
"""

from __future__ import annotations

import atexit
import hashlib
import hmac
import json
import logging
import queue
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib import error as urlerror
from urllib import request as urlrequest

from agent.shell_hooks import (
    _TOOL_EVENTS as _TOOL_SCOPED_EVENTS,
    _ToolMatcherMixin,
    _forget_home_registrations,
    _home_key,
    _payload_fields,
    _utc_now_iso,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 10
MAX_TIMEOUT_SECONDS = 60
MAX_DELIVERY_ATTEMPTS = 2
RETRY_BACKOFF_SECONDS = 1.0
QUEUE_MAX_SIZE = 256

# (home, event, url) triples already wired in this process. Home is part of the key so a
# multiplexed gateway's secondary profiles (own plugin managers) can register identical targets.
_registered: Set[Tuple[str, str, str]] = set()
_registered_lock = threading.Lock()

_delivery_queue: "queue.Queue[Optional[Dict[str, Any]]]" = queue.Queue(maxsize=QUEUE_MAX_SIZE)
_worker_lock = threading.Lock()
_worker: Optional[threading.Thread] = None


@dataclass
class WebhookTarget(_ToolMatcherMixin):
    """Parsed and validated representation of one ``hooks.outbound`` entry."""
    _MATCHER_KIND = "outbound webhook"
    url: str
    events: List[str]
    name: str = ""
    secret: Optional[str] = None
    matcher: Optional[str] = None
    timeout: int = DEFAULT_TIMEOUT_SECONDS
    compiled_matcher: Optional[re.Pattern] = field(default=None, repr=False)

    @property
    def label(self) -> str:
        return self.name or self.url


def register_from_config(cfg: Optional[Dict[str, Any]]) -> List[WebhookTarget]:
    """Register every configured outbound webhook on the plugin manager.  Malformed ``hooks.outbound``
    means zero targets — never raises.  Returns the targets that ended up wired (deduplicated)."""
    if not isinstance(cfg, dict):
        return []
    from utils import env_var_enabled
    if env_var_enabled("HERMES_SAFE_MODE"):
        logger.info("HERMES_SAFE_MODE=1 — outbound webhook registration skipped")
        return []
    targets = iter_configured_targets(cfg)
    if not targets:
        return []
    from hermes_cli.plugins import get_plugin_manager
    manager = get_plugin_manager()
    home_key = _home_key()
    registered: List[WebhookTarget] = []
    with _registered_lock:
        for target in targets:
            wired_any = False
            for event in target.events:
                key = (home_key, event, target.url)
                if key in _registered:
                    continue
                manager._hooks.setdefault(event, []).append(_make_callback(event, target))
                _registered.add(key)
                wired_any = True
                logger.info(
                    "outbound webhook registered: %s -> %s (matcher=%s, timeout=%ds)",
                    event, target.label, target.matcher, target.timeout,
                )
            if wired_any:
                registered.append(target)
    return registered


def iter_configured_targets(cfg: Optional[Dict[str, Any]]) -> List[WebhookTarget]:
    """Parse ``hooks.outbound`` without registering anything (``hermes hooks list``)."""
    if not isinstance(cfg, dict):
        return []
    hooks_cfg = cfg.get("hooks")
    raw = hooks_cfg.get("outbound") if isinstance(hooks_cfg, dict) else None
    if raw is None:
        return []
    if not isinstance(raw, list):
        logger.warning("hooks.outbound must be a list of webhook targets; got %s", type(raw).__name__)
        return []
    return [t for t in (_parse_single_target(i, entry) for i, entry in enumerate(raw)) if t is not None]


def flush(timeout: float = 5.0) -> bool:
    """Block until all queued deliveries are done (or *timeout* elapses); True if drained."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with _delivery_queue.all_tasks_done:
            if _delivery_queue.unfinished_tasks == 0:
                return True
        time.sleep(0.02)
    with _delivery_queue.all_tasks_done:
        return _delivery_queue.unfinished_tasks == 0


def re_register_config_hooks() -> None:
    """Re-register outbound webhooks after a plugin force-reload cleared ``_hooks``.  Only the
    current home's idempotence keys are cleared so a force-reload in one profile cannot
    invalidate another profile's still-live registration.

    Mirrors ``agent.shell_hooks.re_register_config_hooks``: config-owned outbound-webhook callbacks live in
    the same ``_hooks`` dict that ``PluginManager.discover_and_load(force=True)`` clears via ``unload()``,
    so without this the force-reloaded profile's outbound webhooks go silently inert (#92682 review).
    """
    from hermes_cli.config import load_config
    _forget_home_registrations(_registered, _registered_lock)
    register_from_config(load_config())


def reset_for_tests() -> None:
    """Clear the idempotence set and drain the queue.  Test-only helper."""
    with _registered_lock:
        _registered.clear()
    try:
        while True:
            _delivery_queue.get_nowait()
            _delivery_queue.task_done()
    except queue.Empty:
        pass


def _parse_single_target(index: int, raw: Any) -> Optional[WebhookTarget]:
    from hermes_cli.plugins import VALID_HOOKS

    def warn(msg: str, *args: Any) -> None:
        logger.warning("hooks.outbound[%d]" + msg, index, *args)

    if not isinstance(raw, dict):
        warn(" must be a mapping with 'url' and 'events' keys; got %s", type(raw).__name__)
        return None
    url = raw.get("url")
    if not isinstance(url, str) or not url.strip():
        warn(" is missing a non-empty 'url'")
        return None
    url = url.strip()
    if not url.lower().startswith(("http://", "https://")):
        warn(".url must be http(s); got %r — skipped", url)
        return None
    if url.lower().startswith("http://"):
        warn(".url uses plain http:// — payloads (including tool inputs) travel unencrypted. Prefer https.")
    events_raw = raw.get("events")
    valid_list = ", ".join(sorted(VALID_HOOKS))
    if not isinstance(events_raw, list) or not events_raw:
        warn(" needs a non-empty 'events' list (valid: %s)", valid_list)
        return None
    events: List[str] = [ev for ev in events_raw if ev in VALID_HOOKS]
    for ev in events_raw:
        if ev not in VALID_HOOKS:
            warn(": unknown event %r ignored (valid: %s)", ev, valid_list)
    if not events:
        warn(" has no valid events — skipped")
        return None
    matcher = raw.get("matcher")
    if matcher is not None and not isinstance(matcher, str):
        warn(".matcher must be a string regex; ignoring")
        matcher = None
    if matcher is not None and not any(e in _TOOL_SCOPED_EVENTS for e in events):
        warn(".matcher=%r will be ignored — matcher is only honored for pre_tool_call / post_tool_call.", matcher)
        matcher = None
    timeout_raw = raw.get("timeout", DEFAULT_TIMEOUT_SECONDS)
    try:
        timeout = int(timeout_raw)
    except (TypeError, ValueError):
        warn(".timeout must be an int (got %r); using default %ds", timeout_raw, DEFAULT_TIMEOUT_SECONDS)
        timeout = DEFAULT_TIMEOUT_SECONDS
    name = raw.get("name")
    # ``secret_env`` (env var name, preferred) wins over inline ``secret``. Read through the profile
    # secret scope: the gateway registers each multiplexed profile's targets inside that profile's
    # scope, and a raw environ read would sign a secondary's deliveries with the DEFAULT profile's
    # secret (or leave them unsigned when the var lives only in the secondary's .env).
    secret_env = raw.get("secret_env")
    if isinstance(secret_env, str) and secret_env.strip():
        from agent.secret_scope import get_secret
        secret = get_secret(secret_env.strip(), "") or None
        if secret is None:
            warn(".secret_env=%r is not set in the environment — deliveries will be UNSIGNED", secret_env.strip())
    else:
        secret = raw.get("secret")
        secret = secret if isinstance(secret, str) and secret else None
    return WebhookTarget(
        url=url, events=events, name=name.strip() if isinstance(name, str) else "", secret=secret,
        matcher=matcher, timeout=max(1, min(timeout, MAX_TIMEOUT_SECONDS)),
    )


def _make_callback(event: str, target: WebhookTarget):
    """Build the notify-only closure ``invoke_hook()`` calls per firing."""

    def _callback(**kwargs: Any) -> None:
        if event in _TOOL_SCOPED_EVENTS and not target.matches_tool(kwargs.get("tool_name")):
            return
        delivery_id = uuid.uuid4().hex
        try:
            body = _serialize_payload(event, kwargs, delivery_id)
        except Exception:  # a bad payload must not hurt the loop
            logger.warning("outbound webhook payload serialization failed (event=%s target=%s)", event, target.label, exc_info=True)
            return
        _enqueue(_build_delivery(event, target, body, delivery_id))

    _callback.__name__ = f"outbound_webhook[{event}:{target.label}]"
    _callback.__qualname__ = _callback.__name__
    return _callback


def _serialize_payload(event: str, kwargs: Dict[str, Any], delivery_id: str) -> bytes:
    """Render the POST body: shell-hooks stdin shape plus delivery 
```

### Core Architecture Module: `agent/pet/render.py`
```
"""Decode a pet spritesheet and encode frames for a terminal.

Shared by the base CLI (escape bytes to stdout) and the TUI (bytes shipped to
Ink) so decode + capability detection + protocol encoding exist once. Modes in
fidelity order: ``kitty`` (kitty, Ghostty, WezTerm), ``iterm`` (iTerm2, WezTerm),
``sixel`` (xterm -ti vt340, foot, mlterm, …), ``unicode`` (24-bit half-blocks).
Missing Pillow or spritesheet degrades to an empty string rather than raising
(PIL is imported lazily on purpose).
"""

from __future__ import annotations

import base64
import io
import logging
import os
import sys
import zlib
from dataclasses import KW_ONLY, dataclass
from functools import lru_cache
from itertools import groupby, takewhile
from pathlib import Path

from agent.pet.constants import DEFAULT_SCALE, FRAME_H, FRAME_W, FRAMES_PER_STATE, PetState, state_row_index

logger = logging.getLogger(__name__)

# Public render-mode names accepted by ``display.pet.render_mode``.
RENDER_MODES = ("auto", "kitty", "iterm", "sixel", "unicode", "off")


def _is_wezterm() -> bool:
    return os.environ.get("TERM_PROGRAM", "").lower() == "wezterm" or bool(os.environ.get("WEZTERM_PANE"))


def detect_terminal_graphics() -> str:
    """Richest protocol (``kitty``/``iterm``/``sixel``/``unicode``) from env vars only — never a DA1 query that could hang a pipe."""
    term = os.environ.get("TERM", "").lower()
    term_program = os.environ.get("TERM_PROGRAM", "").lower()
    # VS Code/Cursor set TERM_PROGRAM=vscode but don't scrub inherited
    # ITERM_SESSION_ID/KITTY_WINDOW_ID; trusting those emits a protocol xterm.js
    # can't show (blank frame). Inline images there are opt-in, so default to
    # half-blocks; users who enabled them can pin display.pet.render_mode.
    if term_program == "vscode":
        return "unicode"
    if os.environ.get("KITTY_WINDOW_ID") or "kitty" in term or "ghostty" in term or term_program == "ghostty" or _is_wezterm():
        return "kitty"  # WezTerm speaks kitty and iterm; kitty has richer placement
    if term_program == "iterm.app" or os.environ.get("ITERM_SESSION_ID"):
        return "iterm"
    if term_program == "mintty" or "foot" in term or "mlterm" in term or "sixel" in term:
        return "sixel"
    return "unicode"


def supports_kitty_placeholders() -> bool:
    """True when the terminal paints kitty Unicode placeholders; WezTerm speaks kitty APC but renders placeholders as tofu."""
    return detect_terminal_graphics() == "kitty" and not _is_wezterm()


def resolve_mode(configured: str | None, *, stream=None) -> str:
    """Effective render mode from ``display.pet.render_mode`` + env; ``off`` when not a TTY."""
    mode = (configured or "auto").strip().lower()
    mode = mode if mode in RENDER_MODES else "auto"
    stream = stream or sys.stdout
    try:
        if mode == "off" or not (hasattr(stream, "isatty") and stream.isatty()):
            return "off"
    except (ValueError, OSError):
        return "off"
    return detect_terminal_graphics() if mode == "auto" else mode


# Max alpha at/below which a frame is blank padding: petdex sheets are left-packed,
# so short states have transparent trailing cells; animating into one flashes blank.
_BLANK_ALPHA = 8


def _frame_is_blank(frame) -> bool:
    return frame.getchannel("A").getextrema()[1] <= _BLANK_ALPHA


@lru_cache(maxsize=16)
def _raw_frames(sheet_path: str, state_value: str, frame_w: int, frame_h: int, frames_per_state: int) -> tuple:
    """Cropped RGBA frames for one state row, stopping at the first blank column; ``()`` on any decode failure."""
    try:
        from PIL import Image

        sheet = Image.open(Path(sheet_path)).convert("RGBA")
        cols, rows = max(1, sheet.width // frame_w), max(1, sheet.height // frame_h)
        # Clamp to the sheet: some pets ship fewer rows than the taxonomy reserves.
        top = min(state_row_index(state_value, rows) * frame_h, max(0, sheet.height - frame_h))
        crops = (sheet.crop((i * frame_w, top, (i + 1) * frame_w, top + frame_h)) for i in range(min(frames_per_state, cols)))
        return tuple(takewhile(lambda f: not _frame_is_blank(f), crops))
    except Exception as exc:  # noqa: BLE001 - cosmetic feature, never fatal
        logger.debug("pet frame decode failed (%s, %s): %s", sheet_path, state_value, exc)
        return ()


@lru_cache(maxsize=8)
def _frames_for(sheet_path: str, state_value: str, frame_w: int, frame_h: int, frames_per_state: int, scale_w: int, scale_h: int):
    """Scaled :func:`_raw_frames` (both cached, so animation-time requests are free)."""
    raw = _raw_frames(sheet_path, state_value, frame_w, frame_h, frames_per_state)
    if not raw or (scale_w, scale_h) == (frame_w, frame_h):
        return list(raw)
    from PIL import Image

    return [f.resize((scale_w, scale_h), Image.LANCZOS) for f in raw]


def state_frame_counts(
    sheet_path: str | Path, *, frame_w: int = FRAME_W, frame_h: int = FRAME_H, frames_per_state: int = FRAMES_PER_STATE
) -> dict[str, int]:
    """Each driven :class:`PetState` → its real (padding-trimmed) frame count (shipped to the desktop canvas)."""
    return {s.value: len(_raw_frames(str(sheet_path), s.value, frame_w, frame_h, frames_per_state)) for s in PetState}


def _png_b64(frame) -> str:
    buf = io.BytesIO()
    frame.save(buf, format="PNG")
    return base64.standard_b64encode(buf.getvalue()).decode("ascii")


# Nominal terminal cell size in pixels. kitty fits an image to its cell rectangle
# preserving aspect, so a frame that isn't a whole cell multiple rounds up, clipping
# the bottom row ("clipped feet"); snapping to an exact multiple avoids that.
_CELL_W, _CELL_H = 8, 16


def _fit_frames_to_cell_grid(frames):
    """Crop *frames* (non-empty) to their union opaque bbox, then resize so width/height are exact cell-box multiples.

    kitty paints transparent margins too, so an untrimmed pet looks small and adrift.
    """
    from PIL import Image

    boxes = [b for b in (f.getchannel("A").getbbox() for f in frames) if b]
    if boxes:
        union = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        frames = [f.crop(union) for f in frames]
    w, h = frames[0].size
    target = (max(1, round(w / _CELL_W)) * _CELL_W, max(1, round(h / _CELL_H)) * _CELL_H)
    return frames if (w, h) == target else [f.resize(target, Image.LANCZOS) for f in frames]


def _kitty_apc(ctrl: str, data: str) -> str:
    """kitty APC escape for *data*, chunked into ≤4096-byte ``m`` pieces (``m=1`` = more chunks follow)."""
    pieces = [data[i : i + 4096] for i in range(0, len(data), 4096)] or [""]
    last = len(pieces) - 1
    return "".join(f"\x1b_G{ctrl + ',' if i == 0 else ''}m={int(i != last)};{piece}\x1b\\" for i, piece in enumerate(pieces))


def _encode_kitty(frame) -> str:
    """kitty transmit+display at the cursor; ``c``/``r`` pin the cell box so frames overwrite each other."""
    cols, rows = _cell_box(frame)
    return _kitty_apc(f"f=100,a=T,q=2,c={cols},r={rows}", _png_b64(frame))


# kitty Unicode placeholders: Ink owns the screen and measures every cell, so it
# can't host raw kitty image escapes. Transmit once as a virtual placement (U=1),
# then print ordinary-width placeholder cells (U+10EEEE + row diacritic) whose
# foreground color encodes the image id; the terminal paints the image underneath.
#   https://sw.kovidgoyal.net/kitty/graphics-protocol/#unicode-placeholders
_KITTY_PLACEHOLDER = "\U0010eeee"
# Row diacritics by index, verbatim from kitty's gen/rowcolumn-diacritics.txt.
_ROWCOL_DIACRITICS: tuple[int, ...] = (
    0x0305, 0x030D, 0x030E, 0x0310, 0x0312, 0x033D, 0x033E, 0x033F, 0x0346, 0x034A, 0x034B, 0x034C, 0x0350, 0x0351, 0x0352, 0x0357, 0x035B, 0x0363, 0x0364, 0x0365,
    0x0366, 0x0367, 0x0368, 0x0369, 0x036A, 0x036B, 0x036C, 0x036D, 0x036E, 0x036F, 0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0592, 0x0593, 0x0594, 0x0595, 0x0597,
    0x0598, 0x0599, 0x059C, 0x059D, 0x059E, 0x059F, 0x05A0, 0x05A1, 0x05A8, 0x05A9, 0x05AB, 0x05AC, 0x05AF, 0x05C4, 0x0610, 0x0611, 0x0612, 0x0613, 0x0614, 0x0615,
    0x0616, 0x0617, 0x0657, 0x0658, 0x0659, 0x065A, 0x065B, 0x065D, 0x065E, 0x06D6, 0x06D7, 0x06D8, 0x06D9, 0x06DA, 0x06DB, 0x06DC, 0x06DF, 0x06E0, 0x06E1, 0x06E2,
    0x06E4, 0x06E7, 0x06E8, 0x06EB, 0x06EC, 0x0730, 0x0732, 0x0733, 0x0735, 0x0736, 0x073A, 0x073D, 0x073F, 0x0740, 0x0741, 0x0743, 0x0745, 0x0747, 0x0749, 0x074A,
    0x07EB, 0x07EC, 0x07ED, 0x07EE, 0x07EF, 0x07F0, 0x07F1, 0x07F3, 0x0816, 0x0817, 0x0818, 0x0819, 0x081B, 0x081C, 0x081D, 0x081E, 0x081F, 0x0820, 0x0821, 0x0822,
    0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082A, 0x082B, 0x082C, 0x082D, 0x0951, 0x0953, 0x0954, 0x0F82, 0x0F83, 0x0F86, 0x0F87, 0x135D, 0x135E, 0x135F, 0x17DD,
    0x193A, 0x1A17, 0x1A75, 0x1A76, 0x1A77, 0x1A78, 0x1A79, 0x1A7A, 0x1A7B, 0x1A7C, 0x1B6B, 0x1B6D, 0x1B6E, 0x1B6F, 0x1B70, 0x1B71, 0x1B72, 0x1B73, 0x1CD0, 0x1CD1,
    0x1CD2, 0x1CDA, 0x1CDB, 0x1CE0, 0x1DC0, 0x1DC1, 0x1DC3, 0x1DC4, 0x1DC5, 0x1DC6, 0x1DC7, 0x1DC8, 0x1DC9, 0x1DCB, 0x1DCC, 0x1DD1, 0x1DD2, 0x1DD3, 0x1DD4, 0x1DD5,
    0x1DD6, 0x1DD7, 0x1DD8, 0x1DD9, 0x1DDA, 0x1DDB, 0x1DDC, 0x1DDD, 0x1DDE, 0x1DDF, 0x1DE0, 0x1DE1, 0x1DE2, 0x1DE3, 0x1DE4, 0x1DE5, 0x1DE6, 0x1DFE, 0x20D0, 0x20D1,
    0x20D4, 0x20D5, 0x20D6, 0x20D7, 0x20DB, 0x20DC, 0x20E1, 0x20E7, 0x20E9, 0x20F0, 0x2CEF, 0x2CF0, 0x2CF1, 0x2DE0, 0x2DE1, 0x2DE2, 0x2DE3, 0x2DE4, 0x2DE5, 0x2DE6,
    0x2DE7, 0x2DE8, 0x2DE9, 0x2DEA, 0x2DEB, 0x2DEC, 0x2DED, 0x2DEE, 0x2DEF, 0x2DF0, 0x2DF1, 0x2DF2, 0x2DF3, 0x2DF4, 0x2DF5, 0x2DF6, 0x2DF7, 0x2DF8, 0x2DF9, 0x2DFA,
    0x2DFB, 0x2DFC, 0x2DFD, 0x2DFE, 0x2DFF, 0xA66F, 0xA67C, 0xA67D, 0xA6F0, 0xA6F1, 0xA8E0, 0xA8E1, 0xA8E2, 0xA8E3, 0xA8E4, 0xA8E5, 0xA8E6, 0xA8E7, 0xA8E8, 0xA8E9,
    0xA8EA, 0xA8EB, 0xA8EC, 0xA8ED, 0xA8EE, 0xA8EF, 0xA8F0, 0xA8F1, 0xAAB0, 0xAAB2, 0xAAB3, 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1, 0xFE20, 0xFE21, 0xFE22, 0xFE23,
    0xFE24, 0xFE25, 0xFE26, 0x10A0F, 0x10A38, 0x1D185, 0x1D186, 0x1D187, 0x1D188, 0x1D1
```

### Core Architecture Module: `agent/pet/state.py`
```
"""Map agent activity → a :class:`PetState`.

The one place the "what is the agent doing?" → "which row?" decision lives; CLI,
TUI and Desktop (TS mirror of this priority order) feed it the signals they track.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from agent.pet.constants import PetState


def todos_all_done(todos: Iterable[Any] | None) -> bool:
    """True iff ≥1 todo and all completed/cancelled (the ``JUMP`` celebrate beat; mirrors the TUI's ``isTodoDone``)."""
    items = list(todos or [])
    return bool(items) and all(
        (t.get("status") if isinstance(t, dict) else getattr(t, "status", None)) in ("completed", "cancelled") for t in items
    )


def derive_pet_state(
    *,
    busy: bool = False,
    awaiting_input: bool = False,
    error: bool = False,
    celebrate: bool = False,
    just_completed: bool = False,
    tool_running: bool = False,
    reasoning: bool = False,
) -> PetState:
    """Resolve the animation state from coarse activity signals.

    Priority (highest first) — only one row can show at a time, so the most
    salient signal wins:

    1. ``error``          → ``FAILED``  (a tool/turn just failed)
    2. ``celebrate``      → ``JUMP``    (explicit success beat, e.g. todos done)
    3. ``just_completed`` → ``WAVE``    (turn finished cleanly / greeting)
    4. ``awaiting_input`` → ``WAITING`` (blocked on the user — outranks the in-flight
       signals below because the turn is paused on *you*, even mid tool call)
    5. ``tool_running``   → ``RUN``
    6. ``reasoning``      → ``REVIEW``
    7. ``busy``           → ``RUN``     (turn in flight, unspecified work)
    8. otherwise          → ``IDLE``
    """
    ranked = (
        (error, PetState.FAILED),
        (celebrate, PetState.JUMP),
        (just_completed, PetState.WAVE),
        (awaiting_input, PetState.WAITING),
        (tool_running, PetState.RUN),
        (reasoning, PetState.REVIEW),
        (busy, PetState.RUN),
    )
    return next((state for flag, state in ranked if flag), PetState.IDLE)

```

### Core Architecture Module: `agent/plugin_stream_hooks.py`
```
"""Asynchronous per-consumer plugin observers for streaming LLM output.

Each registered hook callback gets its own bounded queue + daemon worker thread
so plugin code never runs inline on the token path. Queues drop the oldest
pending event when full; dispatchers for callbacks that are no longer
registered are stopped lazily on the next lookup.
"""

from __future__ import annotations

import contextvars
import logging
import queue
import threading
from dataclasses import dataclass
from typing import Any, Callable

from hermes_cli.middleware import OBSERVER_SCHEMA_VERSION

logger = logging.getLogger(__name__)

_QUEUE_SIZE = 1024
_STOP = object()


@dataclass
class _ConsumerDispatcher:
    hook_name: str
    callback: Callable[..., Any]
    events: "queue.Queue[tuple[contextvars.Context, dict[str, Any]] | object]"
    thread: threading.Thread | None = None


_dispatcher_lock = threading.Lock()
_dispatchers: dict[tuple[str, int], _ConsumerDispatcher] = {}


def _callback_name(callback: Callable[..., Any]) -> str:
    return getattr(callback, "__name__", repr(callback))


def _put_drop_oldest(events: "queue.Queue[Any]", item: Any) -> bool:
    """put_nowait; on a full queue evict the oldest pending event and retry once."""
    try:
        events.put_nowait(item)
        return True
    except queue.Full:
        try:
            events.get_nowait()
            events.task_done()
        except queue.Empty:
            pass
    try:
        events.put_nowait(item)
        return True
    except queue.Full:
        return False


def _worker(dispatcher: _ConsumerDispatcher) -> None:
    while True:
        item = dispatcher.events.get()
        try:
            if item is _STOP:
                return
            context, payload = item
            payload = dict(payload)
            payload.setdefault("telemetry_schema_version", OBSERVER_SCHEMA_VERSION)
            try:
                # The worker outlives every turn and serves every profile; run the callback in the
                # enqueuing turn's contextvars so it sees that turn's profile scope (home override,
                # secrets), not an unbound context that fail-closed plugin bindings refuse (#118538).
                # ``copy()``: one snapshot fans out to N consumer threads and a Context can only be
                # entered by one thread at a time.
                context.copy().run(dispatcher.callback, **payload)
            except Exception as exc:
                # Fires once per streaming delta: a mis-declared callback fails identically every
                # time, so it goes through the manager's warn-once reporter (#111922).
                from hermes_cli.plugins import get_plugin_manager

                get_plugin_manager()._report_hook_failure(dispatcher.hook_name, dispatcher.callback, payload, exc)
        finally:
            dispatcher.events.task_done()


def _registered_callbacks(hook_name: str) -> tuple[Callable[..., Any], ...]:
    try:
        from hermes_cli import plugins
        return plugins.iter_hook_callbacks(hook_name)
    except Exception:
        logger.debug("plugin stream hook callback lookup failed: %s", hook_name, exc_info=True)
        return ()


def _stop_dispatcher(dispatcher: _ConsumerDispatcher, timeout: float = 1.0) -> None:
    _put_drop_oldest(dispatcher.events, _STOP)
    if dispatcher.thread is not None:
        dispatcher.thread.join(timeout=timeout)


def _start_dispatcher(hook_name: str, callback: Callable[..., Any]) -> _ConsumerDispatcher:
    dispatcher = _ConsumerDispatcher(hook_name=hook_name, callback=callback, events=queue.Queue(maxsize=_QUEUE_SIZE))
    dispatcher.thread = threading.Thread(
        target=_worker, args=(dispatcher,), daemon=True, name=f"plugin-stream-hook:{hook_name}"
    )
    dispatcher.thread.start()
    return dispatcher


def _dispatchers_for(hook_name: str) -> list[_ConsumerDispatcher]:
    """Live dispatcher per registered callback (restarting dead workers); stale
    ones for unregistered callbacks are stopped outside the lock."""
    callbacks = _registered_callbacks(hook_name)
    if not callbacks:
        return []

    callback_ids = {id(callback) for callback in callbacks}
    ready: list[_ConsumerDispatcher] = []
    with _dispatcher_lock:
        stale = [_dispatchers.pop(key) for key in list(_dispatchers) if key[0] == hook_name and key[1] not in callback_ids]
        for callback in callbacks:
            key = (hook_name, id(callback))
            dispatcher = _dispatchers.get(key)
            if dispatcher is None or dispatcher.thread is None or not dispatcher.thread.is_alive():
                dispatcher = _dispatchers[key] = _start_dispatcher(hook_name, callback)
            ready.append(dispatcher)

    for dispatcher in stale:
        _stop_dispatcher(dispatcher, timeout=0.2)
    return ready


def enqueue_plugin_stream_hook(hook_name: str, **payload: Any) -> bool:
    """Queue an observer hook for each consumer without running plugin code inline."""
    queued = False
    item = (contextvars.copy_context(), dict(payload))
    for dispatcher in _dispatchers_for(hook_name):
        if _put_drop_oldest(dispatcher.events, item):
            queued = True
        else:
            logger.debug(
                "plugin stream hook queue full after drop-oldest: %s callback=%s",
                hook_name, _callback_name(dispatcher.callback),
            )
    return queued


def has_stream_observer_hooks() -> bool:
    return any(_registered_callbacks(name) for name in ("on_stream_start", "on_stream_delta", "on_stream_end"))


def has_reasoning_stream_observer_hooks() -> bool:
    return stream_reasoning_deltas_enabled() and bool(_registered_callbacks("on_stream_delta"))


def stream_reasoning_deltas_enabled() -> bool:
    """Return True only when the user opted plugins into reasoning deltas.

    Read-only scalar lookup: skips ``load_config()``'s deepcopy. Callers on the token path
    should still cache the result per stream (``_fire_reasoning_delta`` does)."""
    try:
        from hermes_cli import config as config_mod
        config = config_mod.load_config_readonly()
        return bool(config_mod.cfg_get(config, "plugins", "stream_reasoning_deltas", default=False))
    except Exception:
        logger.debug("failed to read plugins.stream_reasoning_deltas", exc_info=True)
        return False


def shutdown_plugin_stream_hook_dispatcher(timeout: float = 1.0) -> None:
    """Stop background stream hook dispatchers; used by tests and clean shutdown paths."""
    global _dispatchers
    with _dispatcher_lock:
        dispatchers = list(_dispatchers.values())
        _dispatchers = {}
    for dispatcher in dispatchers:
        _stop_dispatcher(dispatcher, timeout=timeout)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #132731** (2026-10-05): **[Bug]: Desktop model picker shows only current model for non-default profiles**
  *Symptoms*: ### Bug Description  ## Description  I am using Hermes Agent in Docker on a remote VPS and Hermes Desktop on macOS.  I have multiple Hermes profiles.  Initially, the model picker in Hermes Desktop showed the full list of available models for all profiles.  After selecting `gpt-5.3-codex-spark` in one of the profiles (`james`), the request failed with:  > The AI service could not complete this request  I then changed the model for that profile from the CLI to a working model (`gpt-6.1`).  Since then, the model picker in Hermes Desktop behaves incorrectly:  - the main/default profile still shows the full list of available models, - all other profiles show only the currently selected model, - there is no way to select another model from the Desktop UI.  The CLI still works correctly and allows me to see and change models for every profile.  For example:  ```bash docker exec -it hermes hermes -p james model ```  This shows the available models correctly and allows me to change the model.  So the backend/model discovery appears to be working correctly. The issue seems limited to the Desktop model picker / per-profile UI state.  ## Additional information  The issue started immediately after selecting `gpt-5.3-codex-spark` in one non-default profile.  After the Spark request failed, I changed the model through the CLI. The model itself changed successfully, but the Desktop model picker remained broken.  The important part is that:  - the backend still knows the available models, - C
  **Post-Mortem & Fix Analysis**:
  > Additional information:  I cleared the Hermes Desktop local storage / LevelDB completely and restarted the app.  The issue still persists.  Current behavior:  - default/main profile: full model list is visible - every non-default profile: only the currently selected model is visible - CLI model picker works correctly for every profile - models selected through CLI work correctly in those profiles  For example, I changed the `james` profile to GPT-5.5 through CLI and the model works normally, but Hermes Desktop still shows only GPT-5.5 in the picker instead of the full available model list.  This suggests the issue is not caused by stale Desktop localStorage and may be related to profile-scoped model discovery in the Desktop API/UI.
  > ## Update  I performed a complete clean reinstall of Hermes Desktop.  Before reinstalling, I removed:  - `~/Library/Application Support/Hermes` - `~/Library/Preferences/com.nousresearch.hermes.plist`  and restarted the macOS preferences daemon.  After reinstalling Hermes Desktop and reconnecting it to the existing Docker backend, the issue is still present.  Current behavior after a clean install:  - default/main profile: full model list is available - all non-default profiles: only the currently selected model is shown - CLI: full model list is available for every profile - changing models through CLI works correctly - models selected through CLI work correctly in Desktop  This strongly suggests a regression in the current Hermes Desktop version rather than stale local state or a backend configuration issue.
  > Resolved.  The issue was caused by an old OpenAI Codex OAuth credential in the profile. Re-authenticating the `default` profile and removing the old per-profile credentials fixed it – all profiles now see the full model list.  Closing.

- **Issue #132607** (2026-10-04): **[Bug]: More 'web' toolset intersections leading to failed web_search**
  *Symptoms*: ### Bug Description  When attempting to do a websearch in hermes-cli, hermes continually fails. Only `hermes chat -t web' is reliable.  Maybe also with 'browser', but it behaves strange.  But no defaults or any other combination of web and something else will permit the web search to actually happen.  Apologies, I've been looking up old bug reports and PRs for the last few hours and it seems to be an ongoing problem with 'web' intersections with other toolsets.  Every report is slightly different, linked to other issues, maybe even a PR, but they are always closed.  Most recent one looks to be a PR from 2 weeks ago, but I'm still having the exact problem that keeps getting described with slightly different triggers.      ### Steps to Reproduce  run `hermes chat`  ->  unable to perform web searches even though 'web' is listed as an active tool.  run `hermes chat -t web` ->  search runs perfectly  ### Expected Behavior  If 'web' is in any toolkit, the web tools should always be available.  I don't understand the intersection determinations, but when a core tool is included by default, and the tools list reports it as working, it just has to work.  If something else is disabling it, so be it i guess, but the tool list can't show it as working when it is not.  ### Actual Behavior  The only way to get the web search tool to actually work is to select the web toolset at chat launch.  Mixing with any other toolset seems to disable it.  I also noticed, if I run it was 'web,browser' i
  **Post-Mortem & Fix Analysis**:
  > <!-- hermes-autotriage --> <!-- action=needs-info issue=132607 at=2026-10-04T06:25Z -->  Thanks for the detailed write-up. To find which code path breaks `web_search` outside `-t web`, it would help to see:  1. **The exact `web_search` tool result** from a failing default `hermes chat` session. Is the tool called and returns an error (please paste the text)? Or does the model never call it? `hermes logs --session <id>` or the tool line in the transcript is enough. 2. **Your `web:` config block** (`backend` / `search_backend` / `extract_backend`) plus which credentials are set (names only, never values), e.g. SearXNG URL, Firecrawl, xAI. 3. **The toolsets list** that `hermes chat` resolves to by default (`hermes tools`), and whether `hermes chat -t web,terminal` fails the same way as a plain `hermes chat`.  Your note that `web,browser` routes the search through Firecrawl instead of SearXNG is a strong clue: something is picking a different search backend depending on which other toolset
  > Your own debug log shows `web_search` executing under the default composite too, not only with `-t web`:  - Sessions on the default toolset list log `tool_search activated (tier 1): 22 core/visible tools kept` and then `tool web_search completed` (e.g. 23:06:01, 00:04:52, 01:01:42). - The failures in the same log are provider-level, not toolset-level: `Web search via firecrawl: 'site:proxmox.com Proxmox VE 9.2'` -> `Firecrawl: found 0 search results` -> those 52-char completions. The same query returns results at other times (the 2548-char completions and `web_result_cache` hits), so firecrawl is intermittently returning 0 results for this `site:` query. - The provider serving the searches is firecrawl (the cache-hit lines say so) even though `web-searxng` is registered — that part is provider selection/priority, not a toolset interaction.  I don't see a toolset-intersection bug in these logs. The closest real gap is provider fallback/selection (fall through to searxng/ddgs when the ch
  > I started running through this again but am having trouble getting consistent results now including that context window issue and empty query responses.   Despite hermes auto-selecting a 262k context window, `ollama ps` is reporting only a 4096 context window.  I am able to manually specify a context length to ollama and ollama respects it, I'm just hunting down how hermes knows 262k is good, but isn't supplying that to ollama so Ollama is ending up with num_ctxit at 4096.  Once I sort that, I'll re-run these tests so we are getting a clean result.

- **Issue #131855** (2026-10-03): **[Bug]: OpenRouter Deepseek became unusable in latest updates.**
  *Symptoms*: ### Bug Description  When trying to use Deepseek after updating today, Thinking blocks are gone, it just outputs thinking as a main response, then the conversation ends after the output, and agent is unable to run tool calls or do anything.  GLM is working fine.  ### Steps to Reproduce  1. Choose OpenRouter Deepseek V4 Pro 2. Try to make it work 3. It outputs thinking as a main response, then stops, nothing else happens.  ### Expected Behavior  It needs to think, run tools calls, keep thinking, etc, like normal.  ### Actual Behavior  It thinks once (maybe twice if lucky) then just stops. The output is presented as main final output as if it is finished, but it actuality it was reasoning/thinking output.  ### Affected Component  Agent Core (conversation loop, context compression, memory)  ### Messaging Platform (if gateway-related)  _No response_  ### Debug Report  ```shell . ```  ### Operating System  macOS 26  ### Python Version  3.13  ### Hermes Version  Version 0.21.5+5871 (0.0.0)  ### Additional Logs / Traceback (optional)  ```shell  ```  ### Root Cause Analysis (optional)  _No response_  ### Proposed Fix (optional)  _No response_  ### Are you willing to submit a PR for this?  - [ ] I'd like to fix this myself and submit a PR
  **Post-Mortem & Fix Analysis**:
  > After switching to GLM, Hermes can keep running for a long time while solving problems. It's only Deepseek (maybe other models) affected, making them behave like single-response chat bots instead of agents.
  > This seems to be intermittent? I tried again later today, and it seems to be working fine now. Maybe it was a model server issue, not Hermes? I'll just close it for now.

- **Issue #131764** (2026-10-03): **Cron external worker never registers config.yaml shell hooks — hooks silently dead for every scheduled job under a systemd gateway**
  *Symptoms*: ### Bug Description  Since cron jobs fired by a systemd-supervised gateway are handed to the restart-safe external worker (`python -m cron.scheduler --external-worker-file …`), shell hooks declared under `hooks:` in the profile's `config.yaml` never run for cron sessions. No warning is logged.  Plugin hooks still fire, because the worker calls `discover_plugins()`, but `agent.shell_hooks.register_from_config()` is never called in that process.  This looks like the same gap as #102504 (`hermes serve`: plugins loaded, config shell hooks silently dead), this time on the cron worker entry point.  ### Steps to Reproduce  1. Linux host, gateway running as a systemd service (one gateway per profile in our case, not yet migrated to multiplex). 2. In a profile's `config.yaml`, declare shell hooks, e.g. `on_session_start` and `on_session_end` running a script that appends a line to a log file; make sure they are in that profile's `shell-hooks-allowlist.json`. 3. Create a cron job in that profile and let it fire (or wait for a scheduled tick). The gateway logs `Cron job '…' handed to restart-safe worker pid=…`. 4. The cron session runs to completion, but the hook scripts never run: no `agent.shell_hooks` lines, no side effects. 5. In the same gateway, a Telegram session (or `hermes chat` in the CLI) runs the very same hooks normally.  ### Expected Behavior  Config shell hooks fire in cron sessions run by the external worker the same way they did when cron ran in-process in the gateway, 
  **Post-Mortem & Fix Analysis**:
  > I'll take this: register the owning profile's config shell hooks and outbound webhooks in the cron external worker.
  > Update: opening the pull request from this account is currently being rejected at the repo level (GraphQL `CreatePullRequest` permission error; REST `POST /pulls` returns 404), so the PR itself isn't up yet.  The fix is committed and pushed: branch `fix/131764-cron-worker-hooks` on `686f6c61/hermes-agent` (commit 15d04df5, based on current main). It registers the owning profile's config shell hooks and outbound webhooks in `_run_external_worker_payload` once the profile's secret scope exists — same non-interactive shape as the gateway's `_register_config_hooks` — and never fails the job on a registration error. Tests are in `tests/cron/test_external_worker_config_hooks.py` (2 passed; the first one fails without the scheduler change; neighboring worker/hook suites: 83 passed, 16 skipped).  I'll open the PR as soon as creation goes through again; if a maintainer wants it sooner, the branch is ready to be pulled from directly.
  > PR #131831 covers this end to end (same registration shape, , never-raise), so I'm standing down: my parked branch `15d04df5` is withdrawn from the race. Nothing further from me here.

- **Issue #131412** (2026-10-03): **[Bug]: [Bug]: Current main cannot compact oversized openai-codex session — middle_window_tokens stays 0 and protected tail consumes all compressible history**
  *Symptoms*: ### Bug Description  A long-running Hermes Desktop session using openai-codex / gpt-6-luna has become permanently uncompressible.  The problem still reproduces on current main after updating Hermes, restarting the macOS backend, and retrying manual /compress.  Environment:  - Hermes Agent v0.21.5+5751.g4097709 (2026.9.24) - upstream: 4097709b - Python: 3.14.7 - OpenAI SDK: 2.24.0 - provider: openai-codex - model: gpt-6-luna - model context limit reported by Hermes: 272000 - backend: macOS, profile `developer`, `hermes serve` - client: Hermes Desktop on Windows - affected session: 878 messages  The session is far above the compression threshold, but every compression attempt immediately aborts because Hermes computes:  middle_window_tokens = 0 protected_tail_tokens ~= 258k failure_class = no_progress split_status = aborted  The current compressor already contains the oversized active-turn handling from #80449, but this session still ends up with an empty compressible middle.  The issue is session-specific: other gpt-6-luna/openai-codex sessions on the same Hermes installation successfully compact with commit_status=committed / split_status=in_place_committed.  This appears to be an uncovered variant of the protected-tail / oversized-turn bug class rather than a provider-wide compression failure.  Related issues: - #80449 - #105663 - #84371  ### Steps to Reproduce  1. Use Hermes Desktop with a remote macOS `hermes serve` backend. 2. Use provider `openai-codex` with model `gpt-6
  **Post-Mortem & Fix Analysis**:
  > Your telemetry reading is right, but `failure_class` in the log is not telling you what happened — and that is the reason this looks like an uncovered variant of the protected-tail class while the compressor actually classified it differently.  ## The log line overwrites the compressor's own class  `middle_window_tokens = 0` with `protected_tail_tokens ~= 258k` is recorded by `_record_compression_regions` (`agent/context_compressor.py:2107-2115`), which is called from two places in `compress()`: the empty-window early exit at :5516-5518, and the normal path at :5530-5532. In the empty-window case it is called with `middle_messages=[]`, so `middle_window_tokens` is a *literal* 0 — it is not an estimate that came out small.  That branch does `self._structural_no_op_result(telemetry, "no_compressible_window", f"compress_start ({compress_start}) >= compress_end ({compress_end}) - transcript fits within tail budget")` (:5519-5522), so the compressor's own verdict is `no_compressible_window`
  > Correction on the test path in my previous message — a doubled prefix, `test_context_context_compressor_...`. The file is `tests/agent/test_context_compressor_structural_backoff.py`, and `test_no_compressible_window_backs_off_without_strike` is at lines 51-72 of that file. Nothing else in the message changes.
  > Thanks — I found the related PRs #131441 and #131445.  My logs appear to match the assistant-tail-anchor case described in #131445: repeated attempts show middle_window_tokens=0, protected_tail_tokens=258521, effective_threshold=231200, and no auxiliary summarization call. The PR’s explanation of a textless active assistant/tool-call turn being retained behind the previous text-bearing assistant anchor seems consistent with this behavior.  PR #131441 also explains the misleading `no_progress` label in my logs; the underlying structural failure was `no_compressible_window`.  Could you confirm whether #131445 is expected to resolve this exact session shape? Is there a way to recover the existing session after applying the fix, or would it still require starting a new session? The earlier oversized request/context estimates and repeated “Repaired 5 message-alternation violation(s)” messages are also present in my logs, in case they are relevant.

- **Issue #131314** (2026-10-03): **[Bug]: Gateway silently crash-loops on boot against a populated home (no traceback / no exit-path tag)**
  *Symptoms*: ### Bug Description  The published image crash-loops on boot when pointed at an existing Hermes data directory. Each attempt writes the startup banner, then dies silently ~16 s later — before any platform-adapter line — with no traceback, no Python exception, and no exit-path tag (the exit ledger tags every iteration `exited UNCLEANLY (no exit Context: this is an upgrade of a long-running deployment from v0.20.5 (~6 weeks old), not a fresh install — the existing data directory carries accumulated state that a fresh home does not, and this silent crash-loop is what blocks the upgrade.path ran)`). The supervisor respawns it forever. Memory is healthy (no OOM), the faulthandler log is empty, and the same image boots cleanly against a fresh home — so the crash is triggered by the populated home, but the image fails silently instead of logging the error.  ### Steps to Reproduce  1. Point the published image at an existing Hermes home (accumulated state) via `docker compose up -d --force-recreate`.2. Watch the gateway log: a startup banner repeats every ~16–20 s with zero content between banners.3. The boot reaches the control-socket line, then dies before any adapter line (around MCP tool discovery).4. The same image against a fresh home boots cleanly and reaches the platform-adapters (`Connected as …`) line.  ### Expected Behavior  Boots through to the platform adapters, or at minimum logs the error that stopped the boot.  ### Actual Behavior  Silent crash-loop: banner → dead ~16
  **Post-Mortem & Fix Analysis**:
  > Correction — root cause found, and it was in our deployment, not in Hermes. Please feel free to close this.  Our Hostinger-managed container used a custom /entrypoint.sh that ends with exec /init /opt/hermes/docker/main-wrapper.sh gateway run. When we pointed compose at the plain nousresearch/hermes-agent image, that entrypoint was gone and our compose file had no command:. With no arguments, main-wrapper.sh runs interactive hermes as the container's main program. With no TTY it exits cleanly within ~26 s ("Input is not a terminal" → "Goodbye!", exit 0). s6 then tears the container down and kills the gateway that s6 had started alongside it, and restart: unless-stopped brings it back. That produced the silent ~16–25 s loop with no traceback.  Verified on a full 22 GB copy of the same populated home:  image with no command → exits after one boot (exit 0, oom=false) same image with gateway run → stable, single banner We have now upgraded to v2026.9.24, and it runs stable on the real home
  > Closing per the reporter's follow-up: the crash-loop came from the compose file running the image with no command, so the container's main program was interactive `hermes`, which exits cleanly without a TTY and takes the container (and gateway) down with it. Use `gateway run` as the container command (see the Docker docs). Thanks for the thorough root-causing, @rsv3e. 

- **Issue #131281** (2026-10-03): **[Bug]: Background review fork patches skills without loading them first — read-before-write guard refusals**
  *Symptoms*: ### Bug Description  The background curator review fork calls `skill_manage(patch/edit/write_file)` for skills it never loaded via `skill_view` in that turn, so `_background_review_read_before_write_guard` refuses every write with: `Refusing background curator patch ... content has not been loaded in this review turn`. This is distinct from #126627 (which targets the protected-skill write guard). Measured: 804 refusals in the current log, still firing (~20/day). Top refused skills: personal-life-management (267), system-inventory-and-ownership (227), exam-study-roadmapping (131).  ### Steps to Reproduce  1. Run Hermes with background curator review enabled (default).2. Let the review fork process a session that yields a lesson for a writable curator-managed skill.3. The fork drafts a `skill_manage(patch)` without first `skill_view`-ing the target.4. The guard refuses: `content has not been loaded in this review turn`.5. The fork retries the same unloaded patch, looping on refusals.  ### Expected Behavior  The review fork loads the target (`skill_view`) before mutating it, so the write succeeds and the lesson is saved.  ### Actual Behavior  Every write is refused. 804 refusals in the current log, still firing (54 on the most recent day). 7 of 35 affected sessions landed zero curator writes (fully-lost lessons).  ### Affected Component  Skills (skill loading, skill hub, skill guard)  ### Messaging Platform (if gateway-related)  _No response_  ### Debug Report  ```shell Debug bu
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed numbers. Your build (v0.20.5, 057dcdf2) kept read marks in a per-context store, so a skill_view in one tool worker never reached the skill_manage worker and every write was refused, even after a real load. Main fixes this with a shared read-marks store seeded before the fork runs (9b003f201f in the curator fork, same seeding in the background-review fork) and with bc471d68b8 (the fork no longer gets a skill_view dedup stub). Please reopen if refusals continue after `hermes update`. 

- **Issue #131278** (2026-10-04): **[Bug]: clarify tool schema `maxLength: 8000` breaks every request on llama.cpp servers ("Failed to initialize samplers: failed to parse grammar")**
  *Symptoms*: ### Bug Description  ## Summary  Since commit a4c31d592b9 ("fix(tools): reject all-blank and over-limit clarify choices…"), the `clarify` tool schema includes `"maxLength": 8000` on `choices.items`. llama.cpp's JSON-schema-to-grammar converter rejects any repetition count ≥ 2000, so **every** chat completion request to a llama.cpp server fails with HTTP 400 — even a plain "hello", because the tool list is always sent.  ## Error  ``` HTTP 400: Failed to initialize samplers: failed to parse grammar layer: provider, code: format_error, retryable: false ```  ## Environment  - Hermes: v0.21.5+5673.g00373b5 (main @ 00373b53761), Windows 11, desktop app - Provider: custom OpenAI-compatible endpoint → llama.cpp server (`owned_by: llamacpp`), GGUF model - Last working build: 5f75ec197b16 (worked), 2fa2f42d412 and later fail  ## Reproduction  1. Point Hermes at a llama.cpp server (custom provider, `api_mode: chat_completions`). 2. Send any message → 400 above.  Isolated by sending each of the 24 tools individually from the request dump (`HERMES_DUMP_REQUESTS=1`) to the server:  | `clarify` → `choices.items.maxLength` | Result | |---|---| | 8000 (current) | ❌ failed to parse grammar | | 2000 | ❌ failed to parse grammar | | 1999 | ✅ OK | | removed | ✅ OK |  All other tools pass individually; the full 24-tool request succeeds once `maxLength` is removed from `clarify`.  ## Cause  `tools/clarify_tool.py`: ```python "items": {"type": "string", "maxLength": MAX_CHOICE_CHARS},  # MAX_CHOICE_C
  **Post-Mortem & Fix Analysis**:
  > Confirming on Ollama 0.32.5 (OpenAI-compatible `/v1/chat/completions`), Windows 11, Hermes v0.21.5+6668 (`4b2c2ae`). Every Telegram gateway turn failed with HTTP 400 `Failed to initialize samplers: failed to parse grammar` right after updating.  Isolated it by replaying the dumped request one tool at a time: only `clarify` fails. Varying just `choices.items` in a minimal single-tool request: - `{"type": "string", "maxLength": 8000}`: 400 - `{"type": "string", "maxLength": 100}`: ok - `{"type": "string"}`: ok  Applying the change from #131286 locally (dropping `maxLength` from the schema; the runtime check in `_normalize_questions` still enforces `MAX_CHOICE_CHARS`) fixes it: the full 25-tool request succeeds and multiple-choice questions are delivered on Telegram again. Disabling the toolset (`agent.disabled_toolsets: [clarify]`) also works as a workaround until this merges. 

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

### Incident Patch 1: `d63cdd32` (2026-10-02)
**Commit Message**: fix(discord): an auto-threaded mention reads the new thread's topic

The first turn of an auto-threaded @mention already points its source at the new thread, but it read chat_topic from the text channel the mention was posted in. The thread's next message reads the thread's own topic (none, outside forums), so the pinned session-context prompt was re-rendered on turn 2 of every auto-threaded conversation in a channel with a topic: a prompt-cache miss, and a Channel Topic line the model saw once and then lost.

(cherry picked from commit d9fedccacd120ca1833269ed0608c3c89c4c1015)

**File**: `plugins/platforms/discord/adapter.py` (modified, +3/-1)
```diff
@@ -6135,7 +6135,9 @@ async def _handle_message(
             if hasattr(message.channel, "guild") and message.channel.guild:
                 chat_name = f"{message.channel.guild.name} / #{chat_name}"
         # Channel topic (TextChannels only); forum-parented threads inherit the parent topic.
-        chat_topic = self._get_effective_topic(message.channel, is_thread=is_thread)
+        # Read from the auto-created thread, not the channel the mention was posted in: this turn pins
+        # the thread session's context prompt, and the thread's next message reads its own topic.
+        chat_topic = self._get_effective_topic(effective_channel, is_thread=is_thread)
         guild = getattr(message, "guild", None)
         source = self.build_source(
             chat_id=str(effective_channel.id),
```

**File**: `tests/gateway/test_discord_auto_thread_prompt_parity.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+"""An auto-threaded @mention opens the thread's session with the prompt inputs its later messages use.
+
+The first turn's source points at the new thread, but its topic and its channel prompt / skill lookups
+were read from the parent text channel the mention was posted in. The next message in the thread read
+them from the thread, so the pinned session-context prompt (``Channel Topic``) was re-rendered on the
+second turn of every auto-threaded conversation in a channel with a topic: a prompt-cache miss.
+"""
+
+from datetime import datetime, timezone
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+
+import gateway.run as gateway_run
+import plugins.platforms.discord.adapter as discord_platform
+from gateway.config import GatewayConfig, Platform, PlatformConfig
+from gateway.session import build_session_context
+from plugins.platforms.discord.adapter import DiscordAdapter
+
+
+class _Text:
+    def __init__(self, channel_id, name="ops", topic="Incident triage"):
+        self.id, self.name, self.topic = channel_id, name, topic
+        self.guild = SimpleNamespace(id=1, name="Hermes Server")
+
+
+class _Thread:
+    def __init__(self, channel_id, parent, name="what-broke"):
+        self.id, self.name, self.parent, self.parent_id = channel_id, name, parent, parent.id
+        self.guild = parent.guild
+
+
+_USER = SimpleNamespace(id=42, display_name="Alice", name="alice")
+
+
+def _message(channel, message_id):
+    return SimpleNamespace(
+        id=message_id, content="what broke?", mentions=[], attachments=[], reference=None,
+        created_at=datetime.now(timezone.utc), channel=channel, author=_USER)
+
+
+@pytest.mark.asyncio
+async def test_auto_thread_first_turn_matches_the_threads_next_message(monkeypatch):
+    monkeypatch.setattr(discord_platform.discord, "Thread", _Thread, raising=False)
+    monkeypatch.setenv("DISCORD_REQUIRE_MENTION", "false")
+    monkeypatch.setenv("DISCORD_AUTO_THREAD", "true")
+    parent = _Text(700)
+    thread = _Thread(800, parent)
+    adapter = DiscordAdapter(PlatformConfig(enabled=True, token="fake", extra={
+        "channel_prompts": {"700": "Answer in haiku."},
+        "channel_skill_bindings": [{"id": "700", "skill": "triage"}]}))
+    adapter._client = SimpleNamespace(user=SimpleNamespace(id=999))
+    adapter._text_batch_delay_seconds = 0
+    adapter._discord_history_backfill = lambda: False
+    adapter._auto_create_thread = AsyncMock(return_value=thread)
+    adapter.handle_message = AsyncMock()
+
+    events = []
+    for channel, message_id in ((parent, 100), (thread, 101)):
+        await adapter._handle_message(_message(channel, message_id))
+        events.append(adapter.handle_message.await_args.args[0])
+    adapter._auto_create_thread.assert_awaited_once()
+    first, follow_up = events
+    assert first.source.chat_id == follow_up.source.chat_id == "800"
+
+    runner = object.__new__(gateway_run.GatewayRunner)
+    config = GatewayConfig(platforms={Platform.DISCORD: PlatformConfig(enabled=True, token="x")})
+    pinned = []
+    for event in (first, follow_up):
+        context = build_session_context(event.source, config)
+        channel_prompt, _ = runner._pinned_channel_inputs("k", event.channel_prompt, event.source, internal=False)
+        pinned.append((runner._pinned_session_context_prompt(context, False, "k"), channel_prompt))
+    assert pinned[0][1] == "Answer in haiku."
+    assert pinned[0] == pinned[1], (pinned[0][0], pinned[1][0])
+    assert first.auto_skill == follow_up.auto_skill == ["triage"]
```

---

### Incident Patch 2: `3729602d` (2026-10-05)
**Commit Message**: fmt(js): `npm run fix` on merge (#133416)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `apps/desktop/src/api/sessions.test.ts` (modified, +1/-3)
```diff
@@ -327,9 +327,7 @@ describe('searchSessions profile scope', () => {
   it('searches the given profile instead of the primary backend', async () => {
     // Unscoped, the primary searched its launch profile while the sidebar showed another.
     hermesApi.mockResolvedValue({ results: [] } as never)
-    vi.mocked(client.profileScoped).mockImplementation(profile =>
-      profile ? { priority: 'foreground', profile } : {}
-    )
+    vi.mocked(client.profileScoped).mockImplementation(profile => (profile ? { priority: 'foreground', profile } : {}))
 
     await searchSessions('zebra', 'research')
 
```

**File**: `apps/desktop/src/components/provider-status-chip.tsx` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ function useChipState(provider: ModelOptionProvider): ChipState | null {
   }
 
   const reset = (ms: null | number) => (ms === null ? null : formatReset(ms))
+
   const lines = [
     copy.usageTip(provider.name),
     ...windows.map(w => copy.usageWindow(w.label, w.remaining, reset(w.resetMs)))
```

---

### Incident Patch 3: `ed4c3507` (2026-10-05)
**Commit Message**: fix(dashboard-auth): cap request bodies on the public auth routes

The pre-auth POST routes under /auth/ buffered the whole JSON body before validation, with no size limit, so anonymous clients could hold large uploads in memory. A pure-ASGI middleware now answers 413 when Content-Length exceeds 64 KiB, and counts the bytes actually received so chunked or understated bodies are cut off at the same limit. Authenticated routes and WebSockets are unchanged.

Reported-by: Tenable Research

**File**: `hermes_cli/dashboard_auth/body_limit.py` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+"""Bound public auth bodies before FastAPI assembles JSON for validation."""
+from __future__ import annotations
+
+from starlette.exceptions import HTTPException
+from starlette.responses import JSONResponse
+from starlette.types import ASGIApp, Message, Receive, Scope, Send
+
+from hermes_cli.dashboard_auth.middleware import _path_is_public
+
+# Auth exchanges contain credentials and tokens, not files. Leave ample room for
+# those small JSON payloads without allowing anonymous, unbounded buffering.
+AUTH_BODY_LIMIT: int = 64 * 1024
+
+
+class _AuthBodyTooLarge(HTTPException):
+    def __init__(self) -> None:
+        super().__init__(status_code=413, detail="Request body too large")
+
+
+class AuthBodyLimitMiddleware:
+    def __init__(self, app: ASGIApp) -> None:
+        self.app = app
+
+    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
+        if (scope["type"] != "http" or scope["method"] != "POST"
+                or not scope["path"].startswith("/auth/")
+                or not _path_is_public(scope["path"])):
+            await self.app(scope, receive, send)
+            return
+
+        response = JSONResponse({"detail": "Request body too large"}, status_code=413)
+        for name, value in scope.get("headers", []):
+            if name == b"content-length":
+                try:
+                    length = int(value)
+                except ValueError:
+                    continue
+                if length > AUTH_BODY_LIMIT:
+                    await response(scope, receive, send)
+                    return
+
+        received = 0
+        started = False
+
+        async def limited_receive() -> Message:
+            nonlocal received
+            message = await receive()
+            if message["type"] == "http.request":
+                received += len(message.get("body", b""))
+                if received > AUTH_BODY_LIMIT:
+                    # HTTPException survives FastAPI's JSON parsing error handler.
+                    raise _AuthBodyTooLarge()
+            return message
+
+        async def tracked_send(message: Message) -> None:
+            nonlocal started
+            if message["type"] == "http.response.start":
+                started = True
+            await send(message)
+
+        try:
+            await self.app(scope, limited_receive, tracked_send)
+        except _AuthBodyTooLarge:
+            if started:
+                raise
+            await response(scope, receive, send)
```

**File**: `hermes_cli/web_server.py` (modified, +5/-0)
```diff
@@ -355,6 +355,11 @@ def _get_pty_active_session_files(app: "FastAPI") -> dict[str, Path]:
 
 app = FastAPI(title="Hermes Agent", version=get_version_info().base_version, lifespan=_lifespan)
 
+from hermes_cli.dashboard_auth.body_limit import AuthBodyLimitMiddleware  # noqa: E402
+
+# Register first (innermost): auth gates run before this, JSON parsing after it.
+app.add_middleware(AuthBodyLimitMiddleware)
+
 
 # Memory-provider OAuth connect routes live in the memory layer, not here.
 from hermes_cli.memory_oauth import router as _memory_oauth_router  # noqa: E402
```

**File**: `tests/hermes_cli/test_dashboard_auth_body_limit.py` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+"""Body budgets apply before parsing public auth requests, not to uploads."""
+from __future__ import annotations
+
+from collections.abc import Iterator
+
+import pytest
+from fastapi import FastAPI
+from starlette.types import Message, Scope
+
+from hermes_cli import web_server
+
+
+@pytest.fixture
+def app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
+    monkeypatch.setattr(web_server.app.state, "bound_host", None, raising=False)
+    application = FastAPI(middleware=web_server.app.user_middleware)
+    application.state.auth_required = True
+    application.state.calls = 0
+
+    async def endpoint(payload: dict[str, str]) -> dict[str, str]:
+        application.state.calls += 1
+        return payload
+
+    for path in ("/auth/password-login", "/auth/native/token", "/auth/native/refresh",
+                 "/api/upload"):
+        application.post(path)(endpoint)
+    yield application
+
+
+async def _request(
+    app: FastAPI, path: str, chunks: list[bytes], headers: list[tuple[bytes, bytes]],
+) -> tuple[list[Message], int]:
+    scope: Scope = {
+        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
+        "method": "POST", "scheme": "http", "path": path, "raw_path": path.encode(),
+        "query_string": b"", "headers": [(b"host", b"testserver"),
+        (b"content-type", b"application/json"), *headers],
+        "client": ("127.0.0.1", 1234), "server": ("testserver", 80),
+    }
+    reads = 0
+    messages: list[Message] = []
+
+    async def receive() -> Message:
+        nonlocal reads
+        if reads == len(chunks):
+            return {"type": "http.disconnect"}
+        body = chunks[reads]
+        reads += 1
+        return {"type": "http.request", "body": body, "more_body": reads < len(chunks)}
+
+    async def send(message: Message) -> None:
+        messages.append(message)
+
+    await app(scope, receive, send)
+    return messages, reads
+
+
+@pytest.mark.asyncio
+async def test_oversized_content_length_rejected_before_handler(app: FastAPI) -> None:
+    messages, reads = await _request(
+        app, "/auth/password-login", [b'{}'], [(b"content-length", b"65537")])
+    assert messages[0]["status"] == 413
+    assert app.state.calls == 0
+    assert reads == 0
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("path", ["/auth/password-login", "/auth/native/token", "/auth/native/refresh"])
+@pytest.mark.parametrize("headers", [[], [(b"content-length", b"2")]], ids=["chunked", "understated"])
+async def test_stream_cut_off_before_remaining_body(
+    app: FastAPI, path: str, headers: list[tuple[bytes, bytes]],
+) -> None:
+    messages, reads = await _request(
+        app, path, [b' ', b' ' * 65536, b'{}'], headers)
+    assert messages[0]["status"] == 413
+    assert app.state.calls == 0
+    assert reads == 2
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("size", [2, 65536], ids=["small", "at-limit"])
+async def test_normal_login_reaches_handler(app: FastAPI, size: int) -> None:
+    messages, _ = await _request(app, "/auth/password-login", [b' ' * (size - 2) + b'{}'], [])
+    assert messages[0]["status"] == 200
+    assert app.state.calls == 1
+
+
+@pytest.mark.asyncio
+async def test_non_auth_upload_is_not_limited(app: FastAPI) -> None:
+    app.state.auth_required = False
+    messages, _ = await _request(
+        app, "/api/upload", [b' ' * 65536 + b'{}'],
+        [(web_server._SESSION_HEADER_NAME.lower().encode(), web_server._SESSION_TOKEN.encode()),
+         (b"content-length", b"65538")])
+    assert messages[0]["status"] == 200
+    assert app.state.calls == 1
+
+
+@pytest.mark.asyncio
+async def test_non_public_path_rejected_without_reading_body(app: FastAPI) -> None:
+    messages, reads = await _request(app, "/api/upload", [b' ' * 65537], [])
+    assert messages[0]["status"] == 401
+    assert reads == 0
+    assert app.state.calls == 0
```

---

### Incident Patch 4: `ea32af93` (2026-10-05)
**Commit Message**: fix(discord): retire the auto-thread title mask from raw rename events

The mask record was installed only after the REST edit returned and was
retired from the cached on_thread_update callback. Gateway updates can land
while the edit is in flight, and discord.py mutates the cached thread before
scheduling callbacks, so batched updates all report the final name. Either
way a moderator's restore of Hermes's title could render the opening name.

Record the guarded attempt before awaiting the edit, advance or retire it
from on_raw_thread_update, and on failure or cancellation drop only the
record that attempt still owns. The record store and _format_thread_chat_name
move into adapter_thread_titles.py so adapter.py does not grow.

Rename-only part of #132758's f67ef417e0; its message-id, slash/voice and
composed-contract changes are left to their own PRs.

Co-authored-by: Andrex Ibiza, MBA <[REDACTED_EMAIL]>

**File**: `plugins/platforms/discord/adapter.py` (modified, +16/-51)
```diff
@@ -25,7 +25,7 @@
 import time
 import traceback
 from collections import defaultdict
-from contextlib import suppress
+from contextlib import nullcontext, suppress
 from typing import Callable, Dict, List, Optional, Any, Tuple
 from urllib.parse import quote, urljoin
 
@@ -79,6 +79,7 @@ class _Snowflake:
     def __init__(self, id: int) -> None:  # noqa: A002 - matches discord API
         self.id = id
 
+
 VALID_THREAD_AUTO_ARCHIVE_MINUTES = {60, 1440, 4320, 10080}
 _DISCORD_COMMAND_SYNC_POLICIES = {"safe", "bulk", "off"}
 _DISCORD_COMMAND_SYNC_STATE_SUBDIR = "gateway"
@@ -89,7 +90,6 @@ def __init__(self, id: int) -> None:  # noqa: A002 - matches discord API
 _DISCORD_COMMAND_SYNC_MAX_RATE_LIMIT_SLEEP_SECONDS = 30.0
 # Discord caps global slash commands at 100/app; exceeding it fails the ENTIRE sync (error 30032).
 _DISCORD_MAX_APP_COMMANDS = 100
-_SEMANTIC_THREAD_RENAMES_MAX = 2000
 # Native slash commands (registered before COMMAND_REGISTRY/plugins so they survive the 100 cap):
 #   (discord name, description, [(arg, type, default-or-_REQUIRED, arg description,
 #   [(choice label, value), ...] or None)], command-text template, follow-up message)
@@ -1049,9 +1049,10 @@ def _read_discord_prompt_timeout() -> int:
 
 
 from plugins.platforms.discord.adapter_media import DiscordMediaMixin
+from plugins.platforms.discord.adapter_thread_titles import DiscordThreadTitlesMixin, SemanticThreadRenames
 
 
-class DiscordAdapter(DiscordMediaMixin, BasePlatformAdapter):
+class DiscordAdapter(DiscordMediaMixin, DiscordThreadTitlesMixin, BasePlatformAdapter):
     """Discord bot adapter: guild/DM messages, threads, slash commands, button approvals, reactions."""
 
     MAX_MESSAGE_LENGTH = 2000
@@ -1114,9 +1115,7 @@ def __init__(self, config: PlatformConfig):
         self._voice_fx_cfg: Dict[str, Any] = self._load_voice_fx_config()
         # Threads the bot participated in (no @mention needed there); persisted across restarts.
         self._threads = ThreadParticipationTracker("discord")
-        # thread id -> (name it replaced, name it set, set name seen yet) for Hermes's own semantic
-        # renames; see _format_thread_chat_name. In memory: after a restart the next turn re-renders once.
-        self._semantic_thread_renames: Dict[str, Tuple[str, str, bool]] = {}
+        self._semantic_thread_renames = SemanticThreadRenames()
         # Persistent typing loops per channel (DMs don't reliably show bot typing events).
         self._typing_tasks: Dict[str, asyncio.Task] = {}
         self._bot_task: Optional[asyncio.Task] = None
@@ -1378,6 +1377,10 @@ async def on_message_delete(message: DiscordMessage):
             async def on_thread_create(thread):
                 await adapter_self._on_platform_thread_create(thread)
 
+            @self._client.event
+            async def on_raw_thread_update(payload: Any) -> None:
+                await adapter_self._on_platform_raw_thread_update(payload)
+
             @self._client.event
             async def on_thread_update(before, after):
                 await adapter_self._on_platform_thread_update(before, after)
@@ -1713,13 +1716,6 @@ def _extra(thread, owner_id):
 
     async def _on_platform_thread_update(self, before, after) -> None:
         """Normalize ``on_thread_update`` renames into ``thread_renamed``; non-rename updates are dropped."""
-        # The event is the only provenance signal: any name other than the one Hermes set came from
-        # someone else, even when its text matches the name Hermes replaced (cache lag looks the same).
-        thread_key = str(getattr(after, "id", ""))
-        renamed = self._semantic_thread_renames.get(thread_key)
-        if renamed and getattr(after, "name", None) != renamed[1]:
-            self._semantic_thread_renames.pop(thread_key, None)
-
         def _build():
             old_name = getattr(before, "name", None)
             new_name = getattr(after, "name", None)
@@ -5461,14 +5457,14 @@ async def rename_thread(
         edit = getattr(thread, "edit", None)
         if edit is None:
             return False
+        # Only the title lane's guarded rename is Hermes's own title (see adapter_thread_titles).
+        attempt = (
+            self._semantic_thread_renames.attempt(str(thread_id_int), only_if_current_name, cleaned)
+            if only_if_current_name is not None else nullcontext()
+        )
         try:
-            await edit(name=cleaned, reason="Hermes semantic session title")
-            if only_if_current_name is not None:
-                renames = self._semantic_thread_renames
-                renames.pop(str(thread_id_int), None)
-                renames[str(thread_id_int)] = (current_name, cleaned, False)
-                while len(renames) > _SEMANTIC_THREAD_RENAMES_MAX:
-                    renames.pop(next(iter(renames)))
+            with attempt:
+                await edit(name=cleaned, reason="Hermes semantic session title")
             logger.info(
                 "[%s
```

**File**: `plugins/platforms/discord/adapter_thread_titles.py` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+"""Keep Hermes's own auto-thread title rename out of the pinned session-context prompt.
+
+``chat_name`` keys the pinned prompt, and the title lane renames a new auto-thread between its
+first and second turns. While the thread carries Hermes's title, its chat name keeps the name the
+title replaced. Any other observed name retires the record: equal text is not edit provenance, so
+a moderator who later restores Hermes's title sees it as itself. Records live in memory; after a
+restart each renamed thread re-renders once.
+"""
+from __future__ import annotations
+
+from collections.abc import Callable, Iterator
+from contextlib import contextmanager
+from dataclasses import dataclass
+from typing import Any
+
+_MAX_RECORDS = 2000
+
+
+@dataclass
+class _TitleRename:
+    replaced: str
+    title: str
+    last_event_name: str
+    title_seen: bool = False
+
+
+class SemanticThreadRenames:
+    """Hermes's latest guarded title rename per thread id."""
+
+    def __init__(self) -> None:
+        self._records: dict[str, _TitleRename] = {}
+
+    @contextmanager
+    def attempt(self, thread_id: str, replaced: str, title: str) -> Iterator[None]:
+        """Record a rename before its REST edit, which gateway events can overtake; drop it if the edit fails."""
+        record = _TitleRename(replaced, title, last_event_name=replaced)
+        self._records.pop(thread_id, None)  # re-insert last: eviction is oldest first
+        self._records[thread_id] = record
+        while len(self._records) > _MAX_RECORDS:
+            del self._records[next(iter(self._records))]
+        try:
+            yield
+        except BaseException:
+            # Cancellation included. A newer attempt owns a different record and keeps it.
+            if self._records.get(thread_id) is record:
+                del self._records[thread_id]
+            raise
+
+    def observe_event(self, thread_id: str, name: str) -> None:
+        """Apply one gateway rename event; only Hermes's own replaced -> title step keeps the record."""
+        record = self._records.get(thread_id)
+        if record is None or name == record.last_event_name:
+            return
+        if (record.last_event_name, name) == (record.replaced, record.title):
+            record.last_event_name = name
+        else:
+            del self._records[thread_id]
+
+    def display_name(self, thread_id: str, name: str) -> str:
+        """The name to render for a thread currently called *name*."""
+        record = self._records.get(thread_id)
+        if record is None:
+            return name
+        if name == record.title:
+            record.title_seen = True
+            return record.replaced
+        # Until the title has been seen, the replaced name may come from a cache that lags the edit.
+        if record.title_seen or name != record.replaced:
+            del self._records[thread_id]
+        return name
+
+
+class DiscordThreadTitlesMixin:
+    _semantic_thread_renames: SemanticThreadRenames
+    _is_forum_parent: Callable[[Any], bool]
+
+    async def _on_platform_raw_thread_update(self, payload: Any) -> None:
+        # discord.py updates the cached thread before cached callbacks run, so batched updates
+        # would all report the final name; each raw payload keeps its own.
+        name = payload.data.get("name")
+        if isinstance(name, str):
+            self._semantic_thread_renames.observe_event(str(payload.thread_id), name)
+
+    def _format_thread_chat_name(self, thread: Any) -> str:
+        """Build a readable chat name for thread-like Discord channels, including forum context when available."""
+        thread_name = getattr(thread, "name", None) or str(getattr(thread, "id", "thread"))
+        thread_name = self._semantic_thread_renames.display_name(str(getattr(thread, "id", "")), thread_name)
+        parent = getattr(thread, "parent", None)
+        guild = getattr(thread, "guild", None) or getattr(parent, "guild", None)
+        guild_name = getattr(guild, "name", None)
+        parent_name = getattr(parent, "name", None)
+        if self._is_forum_parent(parent) and guild_name and parent_name:
+            return f"{guild_name} / {parent_name} / {thread_name}"
+        if parent_name and guild_name:
+            return f"{guild_name} / #{parent_name} / {thread_name}"
+        if parent_name:
+            return f"{parent_name} / {thread_name}"
+        return thread_name
```

**File**: `tests/e2e/core/platforms/test_discord_thread_rename_ordering.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+"""Real SDK dispatch must preserve moderator names before cached callbacks run.
+
+Regression for #131614. The messaging E2E lane owns this SDK contract; gateway
+unit tests exercise the same state machine without the optional Discord extra.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import importlib
+import sys
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import patch
+
+import pytest
+
+import plugins.platforms.discord.adapter as discord_platform
+from gateway.config import PlatformConfig
+
+
+@pytest.mark.asyncio
+async def test_batched_thread_updates_retire_the_alias_through_connected_bot(monkeypatch: pytest.MonkeyPatch) -> None:
+    # The parent E2E conftest installs SDK mocks. Require the real messaging
+    # extra here: an absent dependency must fail the owning CI lane, never skip.
+    with patch.dict(sys.modules):
+        for name in tuple(sys.modules):
+            if name == "discord" or name.startswith("discord."):
+                del sys.modules[name]
+        discord = importlib.import_module("discord")
+        commands = importlib.import_module("discord.ext.commands")
+        state_type = importlib.import_module("discord.state").ConnectionState
+        monkeypatch.setattr(discord_platform, "discord", discord)
+        monkeypatch.setattr(discord_platform, "commands", commands)
+        monkeypatch.setattr(discord_platform, "Intents", discord.Intents)
+        monkeypatch.setattr(discord_platform, "DISCORD_AVAILABLE", True)
+        monkeypatch.setattr(discord_platform, "_load_opus_codec", lambda: None)
+        adapter = discord_platform.DiscordAdapter(PlatformConfig(
+            enabled=True, token="fake", extra={"slash_commands": False}))
+        monkeypatch.setattr(adapter, "_start_liveness_probe", lambda: None)
+
+        async def start(client: Any, token: str, **kwargs: Any) -> None:
+            await client._async_setup_hook()
+            adapter._ready_event.set()
+            await asyncio.Future()  # transport remains open until disconnect
+
+        monkeypatch.setattr(commands.Bot, "start", start)
+        assert await adapter.connect()
+        try:
+            assert not adapter._platform_events_subscribed()
+            parent = SimpleNamespace(id=700, name="ops", guild=SimpleNamespace(name="Hermes Server"))
+
+            class CachedThread:
+                id, parent_id = 800, 700
+                name = "what broke?"
+                guild = parent.guild
+                archived = False
+
+                def _update(self, data: dict[str, Any]) -> None:
+                    self.name = data["name"]
+
+                async def edit(self, *, name: str, reason: str | None = None) -> SimpleNamespace:
+                    return SimpleNamespace(name=name)
+
+            thread = CachedThread()
+            thread.parent = parent
+            monkeypatch.setattr(adapter._client, "get_channel", lambda _id: thread)
+            first = adapter._format_thread_chat_name(thread)
+            assert await adapter.rename_thread("800", "Database outage", only_if_current_name=thread.name)
+            # Do not call the formatter on Hermes's title before the moderator
+            # roundtrip: its cache-lag fallback would otherwise hide this seam.
+            guild = SimpleNamespace(get_thread=lambda _id: thread)
+            state = SimpleNamespace(_get_guild=lambda _id: guild, dispatch=adapter._client.dispatch)
+            scheduled_before = asyncio.all_tasks()
+            state_type.parse_thread_update(state, {
+                "id": "800", "guild_id": "1", "parent_id": "700", "type": 11, "name": "Database outage",
+            })
+            await asyncio.gather(*(asyncio.all_tasks() - scheduled_before))
+            scheduled_before = asyncio.all_tasks()
+            for name in ("what broke?", "Database outage"):
+                state_type.parse_thread_update(state, {
+                    "id": "800", "guild_id": "1", "parent_id": "700", "type": 11, "name": name,
+                })
+            # Both cached callbacks now share the final name. Only raw payloads
+            # retain the intermediate moderator edit, with no hook subscriber.
+            assert thread.name == "Database outage"
+            await asyncio.gather(*(asyncio.all_tasks() - scheduled_before))
+            rendered = adapter._format_thread_chat_name(thread)
+            assert rendered.endswith(" / Database outage")
+            assert rendered != first
+        finally:
+            await adapter.disconnect()
```

**File**: `tests/gateway/test_discord_auto_thread_rename_pin.py` (modified, +93/-65)
```diff
@@ -1,13 +1,12 @@
-"""Hermes's own semantic rename of an auto-created thread keeps the thread's pinned prompt.
-
-``chat_name`` is part of the pinned session-context prompt's key. The title lane renames a new
-auto-thread once the LLM title arrives, normally before the user's second message, so turn 2 read
-the new name and re-rendered the already-sent prompt: a prompt-cache miss on turn 2 of every
-auto-threaded conversation on the default config. A rename by anyone else is a real metadata
-change and still re-renders, including one that later restores Hermes's title: equal text is not
-edit provenance.
+"""Hermes's own auto-thread title rename keeps the pinned session-context prompt.
+
+``chat_name`` keys the pinned prompt, and the title lane renames a new auto-thread between turns 1
+and 2. Any other rename still re-renders, including a later restore of Hermes's title.
 """
+from __future__ import annotations
 
+import asyncio
+from collections.abc import Awaitable, Callable
 from datetime import datetime, timezone
 from types import SimpleNamespace
 from unittest.mock import AsyncMock
@@ -19,94 +18,123 @@
 from gateway.config import GatewayConfig, Platform, PlatformConfig
 from gateway.session import build_session_context
 from plugins.platforms.discord.adapter import DiscordAdapter
+from plugins.platforms.discord.adapter_thread_titles import SemanticThreadRenames
 
-
-class _Text:
-    def __init__(self, channel_id, name="ops"):
-        self.id, self.name, self.topic = channel_id, name, None
-        self.guild = SimpleNamespace(id=1, name="Hermes Server")
+OPENING, TITLE = "what broke?", "Database outage"
 
 
 class _Thread:
-    def __init__(self, channel_id, parent, name):
-        self.id, self.name, self.parent, self.parent_id = channel_id, name, parent, parent.id
-        self.guild = parent.guild
+    def __init__(self, parent: SimpleNamespace) -> None:
+        self.id, self.name, self.parent, self.parent_id = 800, OPENING, parent, parent.id
+        self.guild, self.owner_id, self.archived = parent.guild, 42, False
 
-    async def edit(self, *, name, reason=None):
+    async def edit(self, *, name: str, reason: str | None = None) -> None:
         self.name = name
 
 
-_USER = SimpleNamespace(id=42, display_name="Alice", name="alice")
-
+Turn = Callable[[object, int], Awaitable[str]]
+Conversation = tuple[DiscordAdapter, SimpleNamespace, _Thread, Turn]
 
-def _message(channel, message_id):
-    return SimpleNamespace(
-        id=message_id, content="what broke?", mentions=[], attachments=[], reference=None,
-        created_at=datetime.now(timezone.utc), channel=channel, author=_USER)
 
-
-@pytest.mark.asyncio
-@pytest.mark.parametrize("moderator_name", ["Renamed by a moderator", "what broke?"])
-async def test_hermes_title_rename_keeps_the_pin_and_a_human_rename_does_not(monkeypatch, moderator_name):
+@pytest.fixture
+def conversation(monkeypatch: pytest.MonkeyPatch) -> Conversation:
     monkeypatch.setattr(discord_platform.discord, "Thread", _Thread, raising=False)
     monkeypatch.setattr(discord_platform, "DISCORD_AVAILABLE", True)
     monkeypatch.setenv("DISCORD_REQUIRE_MENTION", "false")
     monkeypatch.setenv("DISCORD_AUTO_THREAD", "true")
-    parent = _Text(700)
-    thread = _Thread(800, parent, name="what broke?")
+    parent = SimpleNamespace(id=700, name="ops", topic=None, guild=SimpleNamespace(id=1, name="Hermes Server"))
+    thread = _Thread(parent)
     adapter = DiscordAdapter(PlatformConfig(enabled=True, token="fake"))
     adapter._client = SimpleNamespace(user=SimpleNamespace(id=999), get_channel=lambda _id: thread)
     adapter._text_batch_delay_seconds = 0
     adapter._discord_history_backfill = lambda: False
     adapter._auto_create_thread = AsyncMock(return_value=thread)
     adapter.handle_message = AsyncMock()
-
     runner = object.__new__(gateway_run.GatewayRunner)
     config = GatewayConfig(platforms={Platform.DISCORD: PlatformConfig(enabled=True, token="x")})
 
-    async def turn(channel, message_id):
-        await adapter._handle_message(_message(channel, message_id))
+    async def turn(channel: object, message_id: int) -> str:
+        await adapter._handle_message(SimpleNamespace(
+            id=message_id, content=OPENING, mentions=[], attachments=[], reference=None,
+            created_at=datetime.now(timezone.utc), channel=channel,
+            author=SimpleNamespace(id=42, display_name="Alice", name="alice")))
         source = adapter.handle_message.await_args.args[0].source
-        assert source.chat_id == "800"
         return runner._pinned_session_context_prompt(build_session_context(source, config), False, "k")
 
+    return adapter, parent, thread, turn
+
+
+async def _raw_rename(adapter: DiscordAdapter, name: str) -> None:
+    await adapter._on_platform_raw_thread_update(SimpleNamespace(thread_id=800, data={"name": name}))
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("moderator_name", ["Renamed by a moderator", OPENING])
+asy
```

**File**: `tests/gateway/test_discord_platform_events.py` (modified, +0/-1)
```diff
@@ -83,7 +83,6 @@ def _adapter() -> DiscordAdapter:
     a.platform = Platform.DISCORD
     a.config = SimpleNamespace(extra={})
     a.gateway_runner = None
-    a._semantic_thread_renames = {}
     return a
 
 
```

---

### Incident Patch 5: `b85e24df` (2026-10-02)
**Commit Message**: fix(discord): a thread rename event retires Hermes's auto-thread title mask

(cherry picked from commit 01435400ed3edc81a72ded8b244aec41502bac30)

**File**: `plugins/platforms/discord/adapter.py` (modified, +7/-0)
```diff
@@ -1713,6 +1713,13 @@ def _extra(thread, owner_id):
 
     async def _on_platform_thread_update(self, before, after) -> None:
         """Normalize ``on_thread_update`` renames into ``thread_renamed``; non-rename updates are dropped."""
+        # The event is the only provenance signal: any name other than the one Hermes set came from
+        # someone else, even when its text matches the name Hermes replaced (cache lag looks the same).
+        thread_key = str(getattr(after, "id", ""))
+        renamed = self._semantic_thread_renames.get(thread_key)
+        if renamed and getattr(after, "name", None) != renamed[1]:
+            self._semantic_thread_renames.pop(thread_key, None)
+
         def _build():
             old_name = getattr(before, "name", None)
             new_name = getattr(after, "name", None)
```

**File**: `tests/gateway/test_discord_auto_thread_rename_pin.py` (modified, +25/-0)
```diff
@@ -85,3 +85,28 @@ async def turn(channel, message_id):
     # The moderator then restores Hermes's title: it shows as itself, not as the opening name.
     thread.name = "Database outage"
     assert "Hermes Server / #ops / Database outage" in await turn(thread, 103)
+
+
+@pytest.mark.asyncio
+async def test_a_restore_before_any_turn_retires_the_mask_through_the_update_event(monkeypatch):
+    # Restoring the opening name before Hermes's title was ever read looks like cache lag to the
+    # formatter; only the THREAD_UPDATE says someone else named it, so that event retires the record.
+    monkeypatch.setattr(discord_platform.discord, "Thread", _Thread, raising=False)
+    monkeypatch.setattr(discord_platform, "DISCORD_AVAILABLE", True)
+    monkeypatch.setenv("DISCORD_REQUIRE_MENTION", "false")
+    parent = _Text(700)
+    thread = _Thread(800, parent, name="what broke?")
+    adapter = DiscordAdapter(PlatformConfig(enabled=True, token="fake"))
+    adapter._client = SimpleNamespace(user=SimpleNamespace(id=999), get_channel=lambda _id: thread)
+
+    async def rename(name):
+        before = SimpleNamespace(id=thread.id, name=thread.name)
+        thread.name = name
+        await adapter._on_platform_thread_update(before, thread)
+
+    assert await adapter.rename_thread("800", "Database outage", only_if_current_name="what broke?")
+    await adapter._on_platform_thread_update(SimpleNamespace(id=800, name="what broke?"), thread)
+    await rename("what broke?")
+    assert adapter._format_thread_chat_name(thread).endswith("what broke?")
+    await rename("Database outage")
+    assert adapter._format_thread_chat_name(thread) == "Hermes Server / #ops / Database outage"
```

**File**: `tests/gateway/test_discord_platform_events.py` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@ def _adapter() -> DiscordAdapter:
     a.platform = Platform.DISCORD
     a.config = SimpleNamespace(extra={})
     a.gateway_runner = None
+    a._semantic_thread_renames = {}
     return a
 
 
```

---

### Incident Patch 6: `019ac2a3` (2026-10-02)
**Commit Message**: fix(discord): retire the auto-thread rename mask once someone else renames the thread

The mask from Hermes's own title rename matched on name text only and was never retired, so a moderator who renamed the thread away and later restored Hermes's title saw the prompt show the thread's opening name instead. Once a name other than Hermes's title has been observed the record is dropped; before Hermes's title is first seen, the replaced name is still tolerated because a cache that has not caught up with the edit reports it.

Fixes #131614

(cherry picked from commit 16e94c1648c7c81c5b69a3bc872e0ca08200aa22)

**File**: `plugins/platforms/discord/adapter.py` (modified, +17/-7)
```diff
@@ -1114,9 +1114,9 @@ def __init__(self, config: PlatformConfig):
         self._voice_fx_cfg: Dict[str, Any] = self._load_voice_fx_config()
         # Threads the bot participated in (no @mention needed there); persisted across restarts.
         self._threads = ThreadParticipationTracker("discord")
-        # thread id -> (name it replaced, name it set) for Hermes's own semantic renames; see
-        # _format_thread_chat_name. In memory: after a restart the next turn re-renders once.
-        self._semantic_thread_renames: Dict[str, Tuple[str, str]] = {}
+        # thread id -> (name it replaced, name it set, set name seen yet) for Hermes's own semantic
+        # renames; see _format_thread_chat_name. In memory: after a restart the next turn re-renders once.
+        self._semantic_thread_renames: Dict[str, Tuple[str, str, bool]] = {}
         # Persistent typing loops per channel (DMs don't reliably show bot typing events).
         self._typing_tasks: Dict[str, asyncio.Task] = {}
         self._bot_task: Optional[asyncio.Task] = None
@@ -5459,7 +5459,7 @@ async def rename_thread(
             if only_if_current_name is not None:
                 renames = self._semantic_thread_renames
                 renames.pop(str(thread_id_int), None)
-                renames[str(thread_id_int)] = (current_name, cleaned)
+                renames[str(thread_id_int)] = (current_name, cleaned, False)
                 while len(renames) > _SEMANTIC_THREAD_RENAMES_MAX:
                     renames.pop(next(iter(renames)))
             logger.info(
@@ -5808,9 +5808,19 @@ def _format_thread_chat_name(self, thread: Any) -> str:
         # chat_name keys the pinned session-context prompt, and Hermes's own title rename lands
         # between a new thread's first and second turns: keep the name the turns were pinned under.
         # A rename by anyone else no longer matches what Hermes set, so it still re-renders.
-        renamed = self._semantic_thread_renames.get(str(getattr(thread, "id", "")))
-        if renamed and renamed[1] == thread_name:
-            thread_name = renamed[0]
+        thread_key = str(getattr(thread, "id", ""))
+        renamed = self._semantic_thread_renames.get(thread_key)
+        if renamed:
+            replaced, set_name, set_seen = renamed
+            if thread_name == set_name:
+                if not set_seen:
+                    self._semantic_thread_renames[thread_key] = (replaced, set_name, True)
+                thread_name = replaced
+            elif set_seen or thread_name != replaced:
+                # Someone else renamed it (the old name before Hermes's title is first seen is only
+                # cache lag). Equal text is not provenance: if they later restore Hermes's title,
+                # that is their choice of name and must show as itself.
+                self._semantic_thread_renames.pop(thread_key, None)
         parent = getattr(thread, "parent", None)
         guild = getattr(thread, "guild", None) or getattr(parent, "guild", None)
         guild_name = getattr(guild, "name", None)
```

**File**: `tests/gateway/test_discord_auto_thread_rename_pin.py` (modified, +13/-6)
```diff
@@ -4,7 +4,8 @@
 auto-thread once the LLM title arrives, normally before the user's second message, so turn 2 read
 the new name and re-rendered the already-sent prompt: a prompt-cache miss on turn 2 of every
 auto-threaded conversation on the default config. A rename by anyone else is a real metadata
-change and still re-renders.
+change and still re-renders, including one that later restores Hermes's title: equal text is not
+edit provenance.
 """
 
 from datetime import datetime, timezone
@@ -45,7 +46,8 @@ def _message(channel, message_id):
 
 
 @pytest.mark.asyncio
-async def test_hermes_title_rename_keeps_the_pin_and_a_human_rename_does_not(monkeypatch):
+@pytest.mark.parametrize("moderator_name", ["Renamed by a moderator", "what broke?"])
+async def test_hermes_title_rename_keeps_the_pin_and_a_human_rename_does_not(monkeypatch, moderator_name):
     monkeypatch.setattr(discord_platform.discord, "Thread", _Thread, raising=False)
     monkeypatch.setattr(discord_platform, "DISCORD_AVAILABLE", True)
     monkeypatch.setenv("DISCORD_REQUIRE_MENTION", "false")
@@ -72,9 +74,14 @@ async def turn(channel, message_id):
     # The title lane's call, as gateway/run_topics.py makes it for a native auto-thread.
     assert await adapter.rename_thread("800", "Database outage", only_if_current_name="what broke?")
     assert thread.name == "Database outage"
+    # A message read through a cache that has not caught up with the edit still sees the old name.
+    thread.name = "what broke?"
+    assert await turn(thread, 104) == first
+    thread.name = "Database outage"
     assert await turn(thread, 101) == first
 
-    thread.name = "Renamed by a moderator"
-    after_human_rename = await turn(thread, 102)
-    assert after_human_rename != first
-    assert "Renamed by a moderator" in after_human_rename
+    thread.name = moderator_name
+    assert f"Hermes Server / #ops / {moderator_name}" in await turn(thread, 102)
+    # The moderator then restores Hermes's title: it shows as itself, not as the opening name.
+    thread.name = "Database outage"
+    assert "Hermes Server / #ops / Database outage" in await turn(thread, 103)
```

---

### Incident Patch 7: `ec991b46` (2026-10-02)
**Commit Message**: fix(discord): Hermes's own auto-thread title rename keeps the pinned prompt

chat_name keys the pinned session-context prompt, and the title lane
renames a new auto-thread once the LLM title arrives, normally before the
user's second message. Turn 2 read the new name and re-rendered the
already-sent prompt, a prompt-cache miss on every auto-threaded
conversation on the default config.

rename_thread now records the name it replaced and the name it set for a
guarded semantic rename, and _format_thread_chat_name keeps the replaced
name while the thread still carries Hermes's title. A rename by anyone
else no longer matches and re-renders as before.

(cherry picked from commit b57858e031b8af5f6fa3fa8d567907c16fafda2b)

**File**: `plugins/platforms/discord/adapter.py` (modified, +16/-0)
```diff
@@ -89,6 +89,7 @@ def __init__(self, id: int) -> None:  # noqa: A002 - matches discord API
 _DISCORD_COMMAND_SYNC_MAX_RATE_LIMIT_SLEEP_SECONDS = 30.0
 # Discord caps global slash commands at 100/app; exceeding it fails the ENTIRE sync (error 30032).
 _DISCORD_MAX_APP_COMMANDS = 100
+_SEMANTIC_THREAD_RENAMES_MAX = 2000
 # Native slash commands (registered before COMMAND_REGISTRY/plugins so they survive the 100 cap):
 #   (discord name, description, [(arg, type, default-or-_REQUIRED, arg description,
 #   [(choice label, value), ...] or None)], command-text template, follow-up message)
@@ -1113,6 +1114,9 @@ def __init__(self, config: PlatformConfig):
         self._voice_fx_cfg: Dict[str, Any] = self._load_voice_fx_config()
         # Threads the bot participated in (no @mention needed there); persisted across restarts.
         self._threads = ThreadParticipationTracker("discord")
+        # thread id -> (name it replaced, name it set) for Hermes's own semantic renames; see
+        # _format_thread_chat_name. In memory: after a restart the next turn re-renders once.
+        self._semantic_thread_renames: Dict[str, Tuple[str, str]] = {}
         # Persistent typing loops per channel (DMs don't reliably show bot typing events).
         self._typing_tasks: Dict[str, asyncio.Task] = {}
         self._bot_task: Optional[asyncio.Task] = None
@@ -5452,6 +5456,12 @@ async def rename_thread(
             return False
         try:
             await edit(name=cleaned, reason="Hermes semantic session title")
+            if only_if_current_name is not None:
+                renames = self._semantic_thread_renames
+                renames.pop(str(thread_id_int), None)
+                renames[str(thread_id_int)] = (current_name, cleaned)
+                while len(renames) > _SEMANTIC_THREAD_RENAMES_MAX:
+                    renames.pop(next(iter(renames)))
             logger.info(
                 "[%s] Renamed Discord thread %s from %r to %r",
                 self.name, thread_id, current_name, cleaned,
@@ -5795,6 +5805,12 @@ def _get_effective_topic(self, channel: Any, is_thread: bool = False) -> Optiona
     def _format_thread_chat_name(self, thread: Any) -> str:
         """Build a readable chat name for thread-like Discord channels, including forum context when available."""
         thread_name = getattr(thread, "name", None) or str(getattr(thread, "id", "thread"))
+        # chat_name keys the pinned session-context prompt, and Hermes's own title rename lands
+        # between a new thread's first and second turns: keep the name the turns were pinned under.
+        # A rename by anyone else no longer matches what Hermes set, so it still re-renders.
+        renamed = self._semantic_thread_renames.get(str(getattr(thread, "id", "")))
+        if renamed and renamed[1] == thread_name:
+            thread_name = renamed[0]
         parent = getattr(thread, "parent", None)
         guild = getattr(thread, "guild", None) or getattr(parent, "guild", None)
         guild_name = getattr(guild, "name", None)
```

**File**: `tests/gateway/test_discord_auto_thread_rename_pin.py` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+"""Hermes's own semantic rename of an auto-created thread keeps the thread's pinned prompt.
+
+``chat_name`` is part of the pinned session-context prompt's key. The title lane renames a new
+auto-thread once the LLM title arrives, normally before the user's second message, so turn 2 read
+the new name and re-rendered the already-sent prompt: a prompt-cache miss on turn 2 of every
+auto-threaded conversation on the default config. A rename by anyone else is a real metadata
+change and still re-renders.
+"""
+
+from datetime import datetime, timezone
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+
+import gateway.run as gateway_run
+import plugins.platforms.discord.adapter as discord_platform
+from gateway.config import GatewayConfig, Platform, PlatformConfig
+from gateway.session import build_session_context
+from plugins.platforms.discord.adapter import DiscordAdapter
+
+
+class _Text:
+    def __init__(self, channel_id, name="ops"):
+        self.id, self.name, self.topic = channel_id, name, None
+        self.guild = SimpleNamespace(id=1, name="Hermes Server")
+
+
+class _Thread:
+    def __init__(self, channel_id, parent, name):
+        self.id, self.name, self.parent, self.parent_id = channel_id, name, parent, parent.id
+        self.guild = parent.guild
+
+    async def edit(self, *, name, reason=None):
+        self.name = name
+
+
+_USER = SimpleNamespace(id=42, display_name="Alice", name="alice")
+
+
+def _message(channel, message_id):
+    return SimpleNamespace(
+        id=message_id, content="what broke?", mentions=[], attachments=[], reference=None,
+        created_at=datetime.now(timezone.utc), channel=channel, author=_USER)
+
+
+@pytest.mark.asyncio
+async def test_hermes_title_rename_keeps_the_pin_and_a_human_rename_does_not(monkeypatch):
+    monkeypatch.setattr(discord_platform.discord, "Thread", _Thread, raising=False)
+    monkeypatch.setattr(discord_platform, "DISCORD_AVAILABLE", True)
+    monkeypatch.setenv("DISCORD_REQUIRE_MENTION", "false")
+    monkeypatch.setenv("DISCORD_AUTO_THREAD", "true")
+    parent = _Text(700)
+    thread = _Thread(800, parent, name="what broke?")
+    adapter = DiscordAdapter(PlatformConfig(enabled=True, token="fake"))
+    adapter._client = SimpleNamespace(user=SimpleNamespace(id=999), get_channel=lambda _id: thread)
+    adapter._text_batch_delay_seconds = 0
+    adapter._discord_history_backfill = lambda: False
+    adapter._auto_create_thread = AsyncMock(return_value=thread)
+    adapter.handle_message = AsyncMock()
+
+    runner = object.__new__(gateway_run.GatewayRunner)
+    config = GatewayConfig(platforms={Platform.DISCORD: PlatformConfig(enabled=True, token="x")})
+
+    async def turn(channel, message_id):
+        await adapter._handle_message(_message(channel, message_id))
+        source = adapter.handle_message.await_args.args[0].source
+        assert source.chat_id == "800"
+        return runner._pinned_session_context_prompt(build_session_context(source, config), False, "k")
+
+    first = await turn(parent, 100)
+    # The title lane's call, as gateway/run_topics.py makes it for a native auto-thread.
+    assert await adapter.rename_thread("800", "Database outage", only_if_current_name="what broke?")
+    assert thread.name == "Database outage"
+    assert await turn(thread, 101) == first
+
+    thread.name = "Renamed by a moderator"
+    after_human_rename = await turn(thread, 102)
+    assert after_human_rename != first
+    assert "Renamed by a moderator" in after_human_rename
```

---

### Incident Patch 8: `66fa864f` (2026-10-05)
**Commit Message**: fix(dashboard-auth): bound the password-login provider and every audit value

An unauthenticated password-login copied the whole provider string into dashboard-auth.log, on the unknown-provider path and on the rate-limited path alike, so one request could write an arbitrarily large entry to disk. provider is now limited to 128 characters (rejected with 422 before the handler runs), and audit_log caps every string value at 256 characters so a future field cannot reintroduce the same write.

Reported-by: Tenable Research

**File**: `hermes_cli/dashboard_auth/audit.py` (modified, +21/-6)
```diff
@@ -14,6 +14,8 @@
 
 _log = logging.getLogger(__name__)
 _write_lock = threading.Lock()
+_MAX_FIELD_LENGTH = 256
+_TRUNCATION_MARKER = "...[truncated]"
 
 # Field names that must never appear in the log raw; matching kwargs are dropped.
 _REDACTED_FIELDS: frozenset = frozenset({
@@ -49,16 +51,29 @@ def _resolve_log_path() -> Path:
     return get_hermes_home() / "logs" / "dashboard-auth.log"
 
 
+def _bounded_value(value: Any) -> Any:
+    """Bound strings, including nested values and non-JSON object representations."""
+    if isinstance(value, dict):
+        return {k: _bounded_value(v) for k, v in value.items()}
+    if isinstance(value, (list, tuple)):
+        return [_bounded_value(v) for v in value]
+    if not isinstance(value, (str, int, float, bool, type(None))):
+        value = repr(value)
+    if isinstance(value, str) and len(value) > _MAX_FIELD_LENGTH:
+        return value[:_MAX_FIELD_LENGTH - len(_TRUNCATION_MARKER)] + _TRUNCATION_MARKER
+    return value
+
+
 def audit_log(event: AuditEvent, **fields: Any) -> None:
     """Append one event; token-like fields dropped, log dir created. Write failures are logged at
     WARNING but never raise — auth must not fail because the audit logger broke."""
-    entry = {
-        "ts": _dt.datetime.now(_dt.timezone.utc).isoformat(),
-        "event": event.value,
-        **{k: v for k, v in fields.items() if k not in _REDACTED_FIELDS}}
-    line = json.dumps(entry, separators=(",", ":")) + "\n"
-    path = _resolve_log_path()
     try:
+        entry = {
+            "ts": _dt.datetime.now(_dt.timezone.utc).isoformat(),
+            "event": event.value,
+            **{k: _bounded_value(v) for k, v in fields.items() if k not in _REDACTED_FIELDS}}
+        line = json.dumps(entry, separators=(",", ":")) + "\n"
+        path = _resolve_log_path()
         path.parent.mkdir(parents=True, exist_ok=True)
         with _write_lock, open(path, "a", encoding="utf-8") as f:
             f.write(line)
```

**File**: `hermes_cli/dashboard_auth/routes.py` (modified, +3/-2)
```diff
@@ -26,7 +26,7 @@
 
 from fastapi import APIRouter, HTTPException, Request
 from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
-from pydantic import BaseModel
+from pydantic import BaseModel, Field
 from starlette.concurrency import run_in_threadpool
 
 from hermes_cli.dashboard_auth import (
@@ -390,7 +390,8 @@ def _reset_password_rate_limit() -> None:
 
 
 class _PasswordLoginBody(BaseModel):
-    provider: str
+    # Providers use short stable IDs, not display names or URLs.
+    provider: str = Field(max_length=128)
     username: str
     password: str
     next: str = ""
```

**File**: `tests/hermes_cli/test_dashboard_auth_audit.py` (modified, +23/-0)
```diff
@@ -7,6 +7,7 @@
 from __future__ import annotations
 
 import json
+from pathlib import Path
 import pytest
 
 from hermes_cli.dashboard_auth.audit import audit_log, AuditEvent
@@ -23,6 +24,28 @@ def profile_home(tmp_path, monkeypatch):
     return home
 
 
+@pytest.mark.parametrize("non_native", [False, True])
+def test_audit_bounds_string_values(profile_home: Path, non_native: bool) -> None:
+    oversized = 'value"\n' * 1000
+    audit_log(
+        AuditEvent.LOGIN_FAILURE, provider=oversized,
+        details={"values": [oversized]}, extra=Path(oversized) if non_native else oversized,
+        reason="invalid_credentials", attempts=3, allowed=False,
+        access_token=oversized,
+    )
+    lines = (profile_home / "logs" / "dashboard-auth.log").read_text().splitlines()
+    assert len(lines) == 1
+    entry = json.loads(lines[0])
+    for value in (entry["provider"], entry["details"]["values"][0], entry["extra"]):
+        assert len(value) <= 256
+        assert value.endswith("...[truncated]")
+    assert oversized.startswith(entry["provider"].removesuffix("...[truncated]"))
+    assert entry["reason"] == "invalid_credentials"
+    assert entry["attempts"] == 3
+    assert entry["allowed"] is False
+    assert "access_token" not in entry
+
+
 def test_audit_writes_jsonlines(profile_home):
     audit_log(AuditEvent.LOGIN_START, provider="nous", ip="1.2.3.4")
     audit_log(
```

**File**: `tests/hermes_cli/test_dashboard_auth_password_login.py` (modified, +27/-0)
```diff
@@ -13,6 +13,7 @@
 from __future__ import annotations
 
 import time
+from pathlib import Path
 from typing import Any, cast
 
 import pytest
@@ -229,6 +230,32 @@ def test_oauth_provider_reports_false(self):
 
 
 class TestPasswordLoginRoute:
+    @pytest.mark.parametrize("rate_limited", [False, True])
+    def test_oversized_provider_rejected_without_audit(
+        self: TestPasswordLoginRoute, gated_app: TestClient,
+        tmp_path: Path, monkeypatch: pytest.MonkeyPatch, rate_limited: bool,
+    ) -> None:
+        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
+        if rate_limited:
+            response = None
+            for _ in range(15):
+                response = gated_app.post(
+                    "/auth/password-login",
+                    json={"provider": "testpw", "username": "admin", "password": "WRONG"},
+                )
+            assert response is not None and response.status_code == 429
+        path = tmp_path / "logs" / "dashboard-auth.log"
+        before = path.read_text() if path.exists() else ""
+        provider = "p" * 129
+        response = gated_app.post(
+            "/auth/password-login",
+            json={"provider": provider, "username": "admin", "password": "WRONG"},
+        )
+        after = path.read_text() if path.exists() else ""
+        assert response.status_code == 422
+        assert provider not in after
+        assert after == before
+
     def test_valid_credentials_set_session_cookies_and_return_next(
         self, gated_app
     ):
```

---

### Incident Patch 9: `13978ae5` (2026-10-04)
**Commit Message**: fix(stt): bundle whisper.cpp CPU for Windows ARM64

**File**: `hermes_platform/resolver/whisper.py` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+"""Passive lookup of the managed whisper.cpp executable; never provisions it."""
+
+from pathlib import Path
+
+
+def whisper_cpp_binary() -> Path | None:
+    from pm import installed_package
+
+    installed = installed_package("whispercpp-cpu")
+    return installed.binary if installed else None
```

**File**: `pm/lock.json` (modified, +9/-0)
```diff
@@ -743,6 +743,15 @@
         }
       },
       "version": "0.12.3"
+    },
+    "whispercpp-cpu": {
+      "artifacts": {
+        "win32-arm64": {
+          "sha256": "799543b926ab5b6c2d60cab269a2092e0ae8d27820e9e15429e59de3699546fc",
+          "url": "https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-win-cpu-arm64.zip"
+        }
+      },
+      "version": "b5130"
     }
   },
   "schema": 1
```

**File**: `pm/packages.py` (modified, +13/-0)
```diff
@@ -1266,3 +1266,16 @@ class LlamaCppCpu(LlamaCpp):
         "darwin-x64": "macos-x64",
         "darwin-arm64": "macos-arm64",
     }
+
+
+@register
+class WhisperCppCpu(BinaryPackage):
+    """Native local STT for Windows ARM64, where faster-whisper has no wheel."""
+
+    name = "whispercpp-cpu"
+    optional = True
+    gaps = {target: "uses the existing faster-whisper provider" for target in ALL_TARGETS
+            if target != "win32-arm64"}
+    binary_rel = {"win32-arm64": "whisper-cli.exe"}
+    probe_args = ["--help"]
+    url = "https://github.com/ggml-org/whisper.cpp/releases/download/{version}/whisper-bin-win-cpu-arm64.zip"
```

**File**: `tests/tools/test_transcription_whisper_cpp.py` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+"""The managed command remains passive until transcription and caches verified models."""
+
+import hashlib
+import threading
+from functools import partial
+from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
+from pathlib import Path
+
+import pytest
+
+
+def test_models_download_once_per_profile_and_reject_bad_bytes(tmp_path, monkeypatch):
+    from pm.downloader import HashError
+    from pm import downloader
+    from tools import transcription_whisper_cpp as cpp
+
+    served = tmp_path / "served"
+    served.mkdir()
+    data = b"model fixture"
+    (served / "model.bin").write_bytes(data)
+    requests = []
+
+    class Handler(SimpleHTTPRequestHandler):
+        def log_message(self, fmt, *args):
+            requests.append(args)
+
+    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(served)))
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    url = f"http://127.0.0.1:{server.server_port}/model.bin"
+    digest = hashlib.sha256(data).hexdigest()
+    monkeypatch.setattr(cpp, "_MODEL_FILES", (("model.bin", url, digest),))
+    hashes = []
+    original_hash = downloader._sha256_file
+    def hash_file(path):
+        hashes.append(path)
+        return original_hash(path)
+    monkeypatch.setattr(downloader, "_sha256_file", hash_file)
+    try:
+        for profile in ("A", "B", "A"):
+            monkeypatch.setenv("HERMES_HOME", str(tmp_path / profile))
+            before = len(requests)
+            hashes_before = len(hashes)
+            cached = cpp._model_dir() / "model.bin"
+            was_cached = cached.exists()
+            cpp.ensure_whisper_cpp_models("base")
+            assert cached.read_bytes() == data
+            assert (len(requests) == before) == was_cached
+            assert (len(hashes) == hashes_before) == was_cached
+        cached.write_bytes(b"corrupt")
+        monkeypatch.setattr(cpp, "_MODEL_FILES", (("model.bin", url, "0" * 64),))
+        with pytest.raises(HashError):
+            cpp.ensure_whisper_cpp_models("base")
+        assert cached.read_bytes() == b"corrupt"  # failed transfer was never published
+        with pytest.raises(ValueError, match="currently supports"):
+            cpp.ensure_whisper_cpp_models("small")
+    finally:
+        server.shutdown()
+        thread.join()
+        server.server_close()
+
+
+def test_local_resolution_is_passive_and_command_override_wins(tmp_path, monkeypatch):
+    from tools import transcription_local as local
+    from tools import transcription_tools as stt
+    from tools import transcription_whisper_cpp as cpp
+    from pm.packages import WhisperCppCpu
+    from pm.store import ALL_TARGETS
+
+    package = WhisperCppCpu()
+    assert [t for t in ALL_TARGETS if package.missing_reason(t) is None] == ["win32-arm64"]
+    monkeypatch.delenv("HERMES_LOCAL_STT_COMMAND", raising=False)
+    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "profile with spaces"))
+    monkeypatch.setattr(cpp, "whisper_cpp_binary", lambda: tmp_path / "program files" / "whisper-cli.exe")
+    monkeypatch.setattr(stt, "_HAS_FASTER_WHISPER", False)
+    calls = []
+    monkeypatch.setattr(cpp, "ensure_whisper_cpp_models", lambda model: calls.append(model))
+    assert stt._detect_local_backend() == "local_command"
+    assert calls == []
+    assert not cpp._model_dir().exists()
+    audio = tmp_path / "voice note.wav"
+    audio.write_bytes(b"RIFF")
+
+    def run(command, **kwargs):
+        assert command[command.index("-f") + 1] == str(audio)
+        assert command[command.index("-l") + 1] == "en"
+        assert "-ng" in command and "--vad" in command
+        Path(command[command.index("-of") + 1] + ".txt").write_text("hello")
+
+    monkeypatch.setattr(local, "_run_quiet", run)
+    result = local._transcribe_local_command(str(audio), "base", language="en")
+    assert result["success"] and result["transcript"] == "hello"
+    assert calls == ["base"]
+    monkeypatch.setenv("HERMES_LOCAL_STT_COMMAND", "custom-command {input_path}")
+    assert local._get_local_command_template() == "custom-command {input_path}"
```

**File**: `tools/transcription_local.py` (modified, +8/-0)
```diff
@@ -32,6 +32,10 @@ def _get_local_command_template() -> Optional[str]:
     configured = os.getenv(LOCAL_STT_COMMAND_ENV, "").strip()
     if configured:
         return configured
+    from tools.transcription_whisper_cpp import whisper_cpp_command
+    managed_command = whisper_cpp_command()
+    if managed_command:
+        return managed_command
     whisper_binary = _find_whisper_binary()
     return (f"{shlex.quote(whisper_binary)} {{input_path}} --model {{model}} --output_format txt "
             "--output_dir {output_dir} --language {language}") if whisper_binary else None
@@ -274,6 +278,10 @@ def _transcribe_local_command(
     language = language or _resolve_stt_language("local") or DEFAULT_LOCAL_STT_LANGUAGE
     normalized_model = _normalize_local_model(model_name)
     try:
+        if not os.getenv(LOCAL_STT_COMMAND_ENV, "").strip():
+            from tools.transcription_whisper_cpp import ensure_whisper_cpp_models, whisper_cpp_command
+            if command_template == whisper_cpp_command():
+                ensure_whisper_cpp_models(normalized_model)
         with tempfile.TemporaryDirectory(prefix="hermes-local-stt-") as output_dir:
             prepared_input, prep_error = _prepare_local_audio(file_path, output_dir)
             if prep_error:
```

**File**: `tools/transcription_whisper_cpp.py` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+"""Managed whisper.cpp command and first-use, verified model acquisition."""
+
+from __future__ import annotations
+
+import logging
+import shlex
+from pathlib import Path
+
+from hermes_constants import get_hermes_home
+from hermes_platform.resolver.whisper import whisper_cpp_binary
+
+logger = logging.getLogger("tools.transcription_tools")
+
+# Keys include the profile's absolute file path; a served profile never inherits
+# another profile's verification. Changed/replaced files must be checked again.
+_verified_files: dict[Path, tuple] = {}
+
+# Model artifacts stay outside PM's bundled tool closure: only first transcription
+# downloads them, into writable profile state even when the program is in WindowsApps.
+_MODEL_FILES = (
+    ("ggml-base.bin",
+     "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin",
+     "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"),
+    ("ggml-silero-v6.2.0.bin",
+     "https://huggingface.co/ggml-org/whisper-vad/resolve/9ffd54a1e1ee413ddf265af9913beaf518d1639b/ggml-silero-v6.2.0.bin",
+     "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987"),
+)
+
+
+def _model_dir() -> Path:
+    return get_hermes_home() / "cache" / "whisper.cpp"
+
+
+def _file_signature(path: Path, digest: str) -> tuple | None:
+    try:
+        stat = path.stat()
+    except FileNotFoundError:
+        return None
+    return (digest, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
+
+
+def whisper_cpp_command() -> str | None:
+    binary = whisper_cpp_binary()
+    if binary is None:
+        return None
+    models = _model_dir()
+    # The existing command adapter tokenizes with shlex, including on Windows.
+    quote = lambda path: shlex.quote(path.as_posix())
+    return (f"{quote(binary)} -m {quote(models / 'ggml-base.bin')} "
+            "-f {input_path} -l {language} -t 4 -bs 5 -bo 5 -ng -nt -otxt "
+            "-of {output_dir}/transcript --vad "
+            f"-vm {quote(models / 'ggml-silero-v6.2.0.bin')} -vsd 500")
+
+
+def ensure_whisper_cpp_models(model_name: str) -> None:
+    if model_name != "base":
+        raise ValueError("Windows ARM64 whisper.cpp currently supports stt.local.model: base; "
+                         f"requested {model_name!r}")
+    from pm.downloader import Download, Source
+
+    destination = _model_dir()
+    sources = [Source(url, destination / name, digest) for name, url, digest in _MODEL_FILES]
+    pending = [source for source in sources
+               if (signature := _file_signature(source.dest, source.sha256)) is None
+               or _verified_files.get(source.dest) != signature]
+    if not pending:
+        return
+    logger.info("Preparing whisper.cpp Base and VAD models (first use downloads about 149 MB)")
+    # PM owns resumable partials, concurrent-download locking, SHA256 verification,
+    # and atomic publication. A complete cache is checked without network access.
+    Download(pending, partials_dir=destination / "partials").run()
+    for source in pending:
+        signature = _file_signature(source.dest, source.sha256)
+        if signature is not None:
+            _verified_files[source.dest] = signature
```

---

### Incident Patch 10: `b4bf19d8` (2026-10-05)
**Commit Message**: fix(desktop): Review scope tabs get their own row and a narrow dropdown

Label, three scope tabs and five icons need ~400px, but the Review pane
runs from 10rem to 20rem, so the tabs overlapped and wrapped in the
28px header at every width. The header keeps the label and icons; the
tabs sit on a full-width row beneath, sized to their labels, and below
their natural width the row collapses to the shared TabDropdown.

Fixes #131653.

Co-authored-by: 08 085 <[REDACTED_EMAIL]>
Co-authored-by: PuschCoding <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/app/right-sidebar/review/index.test.tsx` (modified, +23/-6)
```diff
@@ -1,5 +1,5 @@
 import { cleanup, fireEvent, render, screen } from '@testing-library/react'
-import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
 
 import type { HermesReviewFile } from '@/global'
 import { I18nProvider } from '@/i18n'
@@ -18,6 +18,13 @@ import { ReviewPane } from './index'
 
 const file = (path: string): HermesReviewFile => ({ added: 1, path, removed: 0, staged: false, status: 'M' })
 
+// Radix menus use pointer capture and scrollIntoView; jsdom has neither.
+beforeAll(() => {
+  Element.prototype.hasPointerCapture ??= () => false
+  Element.prototype.releasePointerCapture ??= () => undefined
+  Element.prototype.scrollIntoView ??= () => undefined
+})
+
 function renderPane() {
   return render(
     <I18nProvider configClient={null} initialLocale="en">
@@ -60,15 +67,25 @@ describe('ReviewPane header gating', () => {
     expect((screen.getByLabelText('Revert all') as HTMLButtonElement).disabled).toBe(true)
   })
 
-  it('renders the three scope options and switches scope on selection', () => {
+  it('renders the three scope tabs and switches scope on selection', () => {
     renderPane()
 
-    expect(screen.getByText('Uncommitted')).toBeTruthy()
-    expect(screen.getByText('Branch')).toBeTruthy()
-    expect(screen.getByText('Last turn')).toBeTruthy()
+    expect(screen.getByRole('button', { name: 'Uncommitted', pressed: true })).toBeTruthy()
+    expect(screen.getByRole('button', { name: 'Last turn', pressed: false })).toBeTruthy()
 
-    fireEvent.click(screen.getByText('Branch'))
+    fireEvent.click(screen.getByRole('button', { name: 'Branch', pressed: false }))
 
     expect($reviewScope.get()).toBe('branch')
   })
+
+  it('narrow-pane dropdown names the active scope and switches it', () => {
+    $reviewScope.set('lastTurn')
+    renderPane()
+
+    const trigger = screen.getByRole('button', { name: 'Last turn', expanded: false })
+    fireEvent.keyDown(trigger, { key: 'Enter' })
+    fireEvent.click(screen.getByRole('menuitem', { name: 'Uncommitted' }))
+
+    expect($reviewScope.get()).toBe('uncommitted')
+  })
 })
```

**File**: `apps/desktop/src/app/right-sidebar/review/index.tsx` (modified, +7/-18)
```diff
@@ -6,9 +6,7 @@ import { Button } from '@/components/ui/button'
 import { Codicon } from '@/components/ui/codicon'
 import { ConfirmDialog } from '@/components/ui/confirm-dialog'
 import { DiffCount } from '@/components/ui/diff-count'
-import { SegmentedControl } from '@/components/ui/segmented-control'
 import { Tip } from '@/components/ui/tooltip'
-import type { HermesReviewScope } from '@/global'
 import { useDelayedTrue } from '@/hooks/use-delayed-true'
 import { useI18n } from '@/i18n'
 import { displayPath } from '@/lib/display-path'
@@ -40,6 +38,7 @@ import { SidebarPanelLabel } from '../../shell/sidebar-label'
 import { PaneEmptyState, RightSidebarSectionHeader } from '../index'
 
 import { ReviewFileTree } from './file-tree'
+import { ReviewScopeRow } from './scope-row'
 import { ReviewShipBar } from './ship-bar'
 
 // Compact header/diff action buttons — micro hit targets packed tight, matching
@@ -65,6 +64,8 @@ export function ReviewPane() {
 
   const selectedFile = files.find(file => file.path === selectedPath)
   const hasFiles = files.length > 0
+  // A repo (or a load that may reveal one) gets the header + scope chrome.
+  const showChrome = loading || isRepo
   // `{ path: null }` → revert all; `{ path: '…' }` → revert one file.
   const revertingAll = revertTarget?.path == null
   // Delay the skeletons so fast loads (most project switches) just blank → content
@@ -82,27 +83,13 @@ export function ReviewPane() {
           : 'border-l shadow-[inset_0.0625rem_0_0_color-mix(in_srgb,white_18%,transparent)]'
       )}
     >
-      {(loading || isRepo) && (
+      {showChrome && (
         <RightSidebarSectionHeader data-suppress-pane-reveal-side="">
           <div className="flex min-w-0 flex-1">
             {/* Pure self-naming label — redundant under a zone tab that already
                 says "review", so the zone header hides it (styles.css). */}
             <SidebarPanelLabel data-pane-self-label="">{c.review}</SidebarPanelLabel>
           </div>
-          <SegmentedControl<HermesReviewScope>
-            className="mr-1"
-            onChange={id => {
-              $reviewScope.set(id)
-              clearReviewSelection()
-              void refreshReview()
-            }}
-            options={[
-              { id: 'uncommitted', label: c.scopeUncommitted },
-              { id: 'branch', label: c.scopeBranch },
-              { id: 'lastTurn', label: c.scopeLastTurn }
-            ]}
-            value={scope}
-          />
           <Tip label={treeMode === 'tree' ? c.viewAsList : c.viewAsTree}>
             <Button
               aria-label={treeMode === 'tree' ? c.viewAsList : c.viewAsTree}
@@ -156,7 +143,9 @@ export function ReviewPane() {
         </RightSidebarSectionHeader>
       )}
 
-      {loading || isRepo ? (
+      {showChrome && <ReviewScopeRow />}
+
+      {showChrome ? (
         hasFiles ? (
           <ReviewFileTree />
         ) : showTreeSkeleton ? (
```

**File**: `apps/desktop/src/app/right-sidebar/review/scope-row.tsx` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { useStore } from '@nanostores/react'
+
+import { SegmentedControl } from '@/components/ui/segmented-control'
+import { TabDropdown } from '@/components/ui/tab-dropdown'
+import type { HermesReviewScope } from '@/global'
+import { useI18n } from '@/i18n'
+import { $reviewScope, clearReviewSelection, refreshReview } from '@/store/review'
+
+function selectScope(id: HermesReviewScope) {
+  $reviewScope.set(id)
+  clearReviewSelection()
+  void refreshReview()
+}
+
+/** Scope switcher row under the Review header. Label + tabs + icons can't share
+ *  the 28px header in a pane that narrows to 10rem, so the tabs get their own
+ *  row; below their natural width it collapses to the app's narrow-width tab
+ *  dropdown rather than ellipsizing every option. */
+export function ReviewScopeRow() {
+  const { t } = useI18n()
+  const c = t.statusStack.coding
+  const scope = useStore($reviewScope)
+
+  const options: { id: HermesReviewScope; label: string }[] = [
+    { id: 'uncommitted', label: c.scopeUncommitted },
+    { id: 'branch', label: c.scopeBranch },
+    { id: 'lastTurn', label: c.scopeLastTurn }
+  ]
+
+  return (
+    <div className="@container shrink-0 px-2 pb-1.5" data-suppress-pane-reveal-side="">
+      <SegmentedControl<HermesReviewScope>
+        className="hidden w-full auto-cols-[minmax(0,auto)] @[13.5rem]:grid [&>button]:px-2"
+        onChange={selectScope}
+        options={options}
+        value={scope}
+      />
+      <div className="flex h-[1.5625rem] items-center pl-1.5 @[13.5rem]:hidden">
+        <TabDropdown
+          align="start"
+          items={options.map(option => ({
+            active: option.id === scope,
+            id: option.id,
+            label: option.label,
+            onSelect: () => selectScope(option.id)
+          }))}
+        />
+      </div>
+    </div>
+  )
+}
```

---

### Incident Patch 11: `7717f8ca` (2026-10-05)
**Commit Message**: fix(desktop): segmented control labels never wrap or overlap a neighbour

The track's columns are minmax(0, 1fr), so a squeezed control let a
one-word label paint across the next option and a two-word label wrap.
Labels are now nowrap and ellipsize inside their own cell.

Co-authored-by: 08 085 <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/components/ui/segmented-control.tsx` (modified, +5/-3)
```diff
@@ -43,16 +43,18 @@ export function SegmentedControl<T extends string>({
           <button
             aria-pressed={active}
             className={cn(
-              'flex items-center justify-center gap-1 rounded-[3px] px-2.5 py-0.5 text-[0.6875rem] font-medium transition-colors disabled:cursor-default',
+              'flex min-w-0 items-center justify-center gap-1 rounded-[3px] px-2.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap transition-colors disabled:cursor-default',
               active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
             )}
             disabled={disabled}
             key={id}
             onClick={() => onChange(id)}
             type="button"
           >
-            {Icon && <Icon className="size-3" />}
-            {label}
+            {Icon && <Icon className="size-3 shrink-0" />}
+            {/* A squeezed track ellipsizes a label inside its own cell; it never
+                wraps or paints across the neighbouring option. */}
+            <span className="min-w-0 truncate">{label}</span>
           </button>
         )
       })}
```

---

### Incident Patch 12: `3fd7cc77` (2026-10-05)
**Commit Message**: test(dashboard-auth): type the forwarded-header regression tests

**File**: `tests/hermes_cli/test_dashboard_auth_native_flow.py` (modified, +3/-3)
```diff
@@ -229,8 +229,8 @@ def _native_authorize_params(challenge, **overrides):
 @pytest.mark.parametrize("forwarded_template", ["198.51.100.{i}", ", 198.51.100.{i}"],
                          ids=["rotated-address", "empty-first-hop"])
 def test_native_authorize_spoofed_forwarded_headers_cannot_bypass_pending_cap(
-    gated_client, forwarded_template,
-):
+    gated_client: TestClient, forwarded_template: str,
+) -> None:
     # The public OAuth entry point must limit one peer before allocating the
     # global pending store, even when XFF rotates or has an empty first hop.
     _verifier, challenge = _make_pkce()
@@ -251,7 +251,7 @@ def test_native_authorize_spoofed_forwarded_headers_cannot_bypass_pending_cap(
 
     # Exhausting one peer's allowance must leave room for another real peer.
     other_client = TestClient(
-        web_server.app, base_url=gated_client.base_url,
+        web_server.app, base_url=str(gated_client.base_url),
         client=("203.0.113.10", 50000), follow_redirects=False,
     )
     assert other_client.get("/auth/native/authorize", params=params).status_code == 302
```

**File**: `tests/hermes_cli/test_dashboard_auth_password_login.py` (modified, +5/-5)
```diff
@@ -341,15 +341,15 @@ def test_repeated_failures_eventually_429(self, gated_app):
         ids=["direct", "loopback-proxy", "configured-proxy"],
     )
     def test_spoofed_x_forwarded_for_does_not_reset_rate_limit(
-        self, gated_app, peer, forwarded_suffix,
-    ):
+        self: TestRateLimit, gated_app: TestClient, peer: str, forwarded_suffix: str,
+    ) -> None:
         # X-Forwarded-For is attacker-controlled unless it came from a trusted
         # reverse proxy. Even behind an appending proxy, the client-supplied
         # first hop must not override Uvicorn's resolved client address.
         trusted = _dashboard_forwarded_allow_ips({"trusted_proxies": ["172.18.0.0/16"]})
         # Uvicorn and Starlette expose incompatible static ASGI type aliases.
         app = cast(Any, ProxyHeadersMiddleware(cast(Any, web_server.app), trusted_hosts=trusted))
-        client = TestClient(app, base_url=gated_app.base_url, client=(peer, 50000))
+        client = TestClient(app, base_url=str(gated_app.base_url), client=(peer, 50000))
         for i in range(_PW_RATE_MAX_ATTEMPTS):
             resp = client.post(
                 "/auth/password-login",
@@ -368,7 +368,7 @@ def test_spoofed_x_forwarded_for_does_not_reset_rate_limit(
         # Another real client must retain its own budget, including when both
         # clients reach the dashboard through the same trusted proxy.
         other_peer = peer if forwarded_suffix else "203.0.113.10"
-        other_client = TestClient(app, base_url=gated_app.base_url, client=(other_peer, 50001))
+        other_client = TestClient(app, base_url=str(gated_app.base_url), client=(other_peer, 50001))
         allowed = other_client.post(
             "/auth/password-login",
             headers={"X-Forwarded-For": "203.0.113.10"},
@@ -378,7 +378,7 @@ def test_spoofed_x_forwarded_for_does_not_reset_rate_limit(
 
 
 @pytest.mark.parametrize("peer", [("203.0.113.7", 12345), None])
-def test_client_ip_uses_asgi_peer_not_forwarded_header(peer):
+def test_client_ip_uses_asgi_peer_not_forwarded_header(peer: tuple[str, int] | None) -> None:
     from fastapi import Request
 
     from hermes_cli.dashboard_auth.request_utils import client_ip
```

---

### Incident Patch 13: `fb5bba80` (2026-06-06)
**Commit Message**: fix(security): ignore spoofed XFF for dashboard login limits

Signed-off-by: hinotoi-agent <[REDACTED_EMAIL]>
(cherry picked from commit bf4041e054d41b9705ec29fa7f09a00b68c932d8)

**File**: `hermes_cli/dashboard_auth/request_utils.py` (modified, +7/-3)
```diff
@@ -17,9 +17,13 @@
 
 
 def client_ip(request: Request) -> str:
-    """First ``X-Forwarded-For`` hop, else the peer address."""
-    fwd = request.headers.get("x-forwarded-for", "")
-    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")
+    """ASGI peer address for rate limits, native pending caps, and auth audit.
+
+    Never parse client-supplied ``X-Forwarded-For`` here: direct clients can
+    spoof it. Trusted proxy normalization belongs upstream, where the server
+    may rewrite ``request.client`` only for operator-configured trusted peers.
+    """
+    return request.client.host if request.client else ""
 
 
 def extract_bearer(request: Request) -> str:
```

**File**: `hermes_cli/dashboard_auth/routes.py` (modified, +2/-2)
```diff
@@ -360,8 +360,8 @@ async def auth_callback(
 
 # --- Public: password (non-redirect) login ---------------------------------
 # Brute-force throttle: a process-local sliding window per client IP. Best-effort
-# defence-in-depth on top of the provider's constant-time verify (resets on restart; behind a
-# proxy the IP is the proxy's unless X-Forwarded-For).
+# defence-in-depth on top of the provider's constant-time verify (resets on restart).
+# Uses the ASGI peer; trusted proxy normalization must happen upstream.
 _PW_RATE_MAX_ATTEMPTS = 10
 _PW_RATE_WINDOW_SEC = 60.0
 _pw_attempts: Dict[str, Deque[float]] = defaultdict(deque)
```

**File**: `tests/hermes_cli/test_dashboard_auth_password_login.py` (modified, +34/-0)
```diff
@@ -331,6 +331,40 @@ def test_repeated_failures_eventually_429(self, gated_app):
         )
         assert good.status_code == 429
 
+    def test_spoofed_x_forwarded_for_does_not_reset_rate_limit(self, gated_app):
+        # X-Forwarded-For is attacker-controlled unless it came from a trusted
+        # reverse proxy, so direct dashboard requests must not be able to pick
+        # fresh rate-limit buckets by rotating the header value.
+        for i in range(10):
+            resp = gated_app.post(
+                "/auth/password-login",
+                headers={"X-Forwarded-For": f"198.51.100.{i}"},
+                json={"provider": "testpw", "username": "admin", "password": "WRONG"},
+            )
+            assert resp.status_code == 401
+
+        blocked = gated_app.post(
+            "/auth/password-login",
+            headers={"X-Forwarded-For": "198.51.100.250"},
+            json={"provider": "testpw", "username": "admin", "password": "hunter2"},
+        )
+        assert blocked.status_code == 429
+
+
+@pytest.mark.parametrize("peer", [("203.0.113.7", 12345), None])
+def test_client_ip_uses_asgi_peer_not_forwarded_header(peer):
+    from fastapi import Request
+
+    from hermes_cli.dashboard_auth.request_utils import client_ip
+
+    # Preserve the ASGI address, including one normalized by trusted upstream
+    # middleware; a missing peer must not fall back to an untrusted header.
+    request = Request({
+        "type": "http", "client": peer,
+        "headers": [(b"x-forwarded-for", b"198.51.100.1, 192.0.2.1")],
+    })
+    assert client_ip(request) == (peer[0] if peer else "")
+
 
 # ---------------------------------------------------------------------------
 # Login page rendering
```

---

### Incident Patch 14: `6590f13a` (2026-10-05)
**Commit Message**: fix(picker): a rate-limited credential pool never hides its provider from a picker

The for_picker cooldown rule lived only in the overlay section, so a pooled
models.dev provider (gemini) or canonical provider still vanished while its
pool sat in a 429 cooldown, even from pickers that ask for visibility.
_credential_pool_is_usable now takes for_picker and every picker section
passes it.

model.options keeps cooldown rows visible without shortening the live probe of
the current custom endpoint (fast_custom_probe=False, the full 5s budget).

Tests drive the real payload builder against a real auth.json pool: an
exhausted or per-model-cooldown pool keeps its row (anthropic via the overlay
section, gemini via models.dev; explicit_only on and off), and a slow current
custom endpoint keeps its discovered models.

Co-authored-by: Finn763 <[REDACTED_EMAIL]>

**File**: `hermes_cli/inventory.py` (modified, +3/-2)
```diff
@@ -236,12 +236,13 @@ def build_model_options_payload(
     ``for_picker=True`` keeps providers whose credential pool is entirely rate-limited visible:
     these are human-facing pickers, and hiding a temporarily exhausted pool makes providers vanish
     mid-session even though another model under the same provider may still work (same contract
-    as ``/model`` and the aux pickers, #66584 / #66624)."""
+    as ``/model`` and the aux pickers, #66584 / #66624). Visibility only: ``fast_custom_probe=False``
+    keeps the live probe of the current custom endpoint on its full 5s discovery budget."""
     refresh = bool(refresh)
     payload = build_models_payload(
         ctx, explicit_only=bool(explicit_only), include_unconfigured=bool(include_unconfigured),
         picker_hints=True, canonical_order=True, pricing=True, pricing_cache_only=not refresh,
-        capabilities=True, featured=True, for_picker=True,
+        capabilities=True, featured=True, for_picker=True, fast_custom_probe=False,
         refresh=refresh, probe_custom_providers=refresh, probe_current_custom_provider=not refresh,
         non_blocking_catalogs=not refresh,
     )
```

**File**: `hermes_cli/model_switch_providers.py` (modified, +12/-18)
```diff
@@ -165,17 +165,19 @@ def _probe_native_catalog() -> _NativePickerModelList | None:
 _picker_prewarm_done = _threading.Event()
 
 
-def _credential_pool_is_usable(provider: str, *, raw_pool_present: bool = False) -> bool:
+def _credential_pool_is_usable(provider: str, *, raw_pool_present: bool = False, for_picker: bool = False) -> bool:
     """Whether *provider* has a credential that can be selected now.
 
     Legacy opaque ``auth.json`` pool values that do not deserialize into ``PooledCredential``
     stay visible (``raw_pool_present``); a real pool's availability is authoritative — an
-    all-exhausted/dead pool is not authenticated."""
+    all-exhausted/dead pool is not authenticated. ``for_picker`` (human-facing pickers) also
+    accepts a pool whose entries are all in cooldown: a rate-limited provider is not a signed-out
+    one, and limits are per-model for many providers, so another model may still work."""
     try:
         from agent.credential_pool import load_pool
         pool = load_pool(provider)
         if pool.has_credentials():
-            return pool.has_available()
+            return for_picker or pool.has_available()
     except Exception:
         pass
     return raw_pool_present
@@ -318,21 +320,21 @@ def _auth_store_has_provider(*keys: str) -> bool:
         return False
 
 
-def _raw_pool_usable(hermes_id: str) -> bool:
+def _raw_pool_usable(hermes_id: str, *, for_picker: bool = False) -> bool:
     """Section-1 pool check: only consult the pool when auth.json lists a raw entry."""
     try:
         from hermes_cli.auth import _load_auth_store
         store = _load_auth_store()
         if store and store.get("credential_pool", {}).get(hermes_id):
-            return _credential_pool_is_usable(hermes_id, raw_pool_present=True)
+            return _credential_pool_is_usable(hermes_id, raw_pool_present=True, for_picker=for_picker)
     except Exception:
         pass
     return False
 
 
-def _pool_usable(slug: str) -> bool:
+def _pool_usable(slug: str, *, for_picker: bool = False) -> bool:
     try:
-        return _credential_pool_is_usable(slug)
+        return _credential_pool_is_usable(slug, for_picker=for_picker)
     except Exception as exc:
         logger.debug("Credential pool check failed for %s: %s", slug, exc)
         return False
@@ -837,7 +839,7 @@ def _lap_builtin_rows(b: _PickerBuild, data: dict, user_providers: dict) -> None
     for hermes_id, mdev_id, pconfig, env_vars in _iter_builtin_candidates(data, b.excluded, b.seen_slugs):
         # Per-profile scope, never raw os.environ: a secondary profile's picker otherwise listed the
         # LAUNCH profile's env-keyed providers and hid its own .env-keyed ones.
-        if not (_any_env(env_vars, _scoped_key_env) or _raw_pool_usable(hermes_id)):
+        if not (_any_env(env_vars, _scoped_key_env) or _raw_pool_usable(hermes_id, for_picker=b.for_picker)):
             continue
         model_ids = _live_or_curated_ids(hermes_id, b.curated, non_blocking=b.non_blocking_catalogs)
         # A providers.<built-in>.models block extends the discovered catalog; section 3 cannot
@@ -878,16 +880,8 @@ def _overlay_has_creds(b: _PickerBuild, pid: str, hermes_slug: str, overlay) ->
         # Full auto-seeding pool check catches external stores (Codex CLI ~/.codex/auth.json)
         # not yet in auth.json.
         try:
-            if _credential_pool_is_usable(hermes_slug):
+            if _credential_pool_is_usable(hermes_slug, for_picker=b.for_picker):
                 has_creds = True
-            elif b.for_picker:
-                # Show providers whose pool is entirely in cooldown: limits are per-model for
-                # many providers, so another model may work.
-                try:
-                    from agent.credential_pool import load_pool
-                    has_creds = load_pool(hermes_slug).has_credentials()
-                except Exception:
-                    pass
         except Exception as exc:
             logger.debug("Credential pool check failed for %s: %s", hermes_slug, exc)
     if not has_creds and hermes_slug == "anthropic":
@@ -965,7 +959,7 @@ def _lap_canonical_rows(b: _PickerBuild) -> None:
             sib_vars = set(sib.api_key_env_vars) if sib else set()
             if lit and lit <= sib_vars < set(cp_config.api_key_env_vars) and cp.slug != b.current_provider:
                 continue
-        has_creds = has_creds or _auth_store_has_provider(cp.slug) or _pool_usable(cp.slug) or (
+        has_creds = has_creds or _auth_store_has_provider(cp.slug) or _pool_usable(cp.slug, for_picker=b.for_picker) or (
             _is_aws_sdk(cp_config) and _has_aws_sdk_creds_for_listing(cp.slug, b.current_provider))
         if not has_creds and cp_config is not None and cp_config.auth_type == "external_process":
             # Subprocess-backed providers own their auth; the binary resolving is the credential
```

**File**: `tests/hermes_cli/test_model_options_rate_limited_pool.py` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+"""A rate-limited provider stays in the GUI model picker (#103829, #124510).
+
+Claude Pro/Max and ChatGPT subscriptions hit usage windows constantly. The 429 puts the pooled
+credential in cooldown (credential-wide ``exhausted``, or one model's ``model_cooldowns``), and
+the Desktop / dashboard / TUI ``model.options`` payload treated that as signed out: the whole
+provider vanished from the menu until the window reset, then came back. These tests drive the
+real payload builder against a real ``auth.json`` pool in a temp home.
+"""
+
+import json
+import time
+
+import pytest
+
+from hermes_cli.inventory import build_model_options_payload, load_picker_context
+
+
+def _pool_entry(provider: str, cooldown: str) -> dict:
+    now = time.time()
+    oauth = provider == "anthropic"
+    entry = {
+        "id": "e1", "label": "subscription", "priority": 0, "last_status": "ok",
+        "auth_type": "oauth" if oauth else "api_key",
+        "source": "manual:hermes_pkce" if oauth else "manual",
+        "access_token": "sk-ant-oat01-test" if oauth else "test-key-123",
+        "refresh_token": "refresh" if oauth else None,
+        "expires_at_ms": int((now + 6 * 3600) * 1000),
+    }
+    if cooldown == "exhausted":
+        entry.update(last_status="exhausted", last_status_at=now, last_error_code=429,
+                     last_error_reset_at=now + 3 * 3600)
+    else:
+        entry["model_cooldowns"] = {"some-model": now + 3 * 3600}
+    return entry
+
+
+@pytest.fixture
+def pooled_home(tmp_path, monkeypatch):
+    home = tmp_path / "hermes-home"
+    home.mkdir()
+    monkeypatch.setenv("HERMES_HOME", str(home))
+    # Only the pooled credential under test may authenticate anything.
+    (home / "config.yaml").write_text(
+        "model:\n  provider: nous\n  default: test-model\nauth:\n  adopt_external_logins: false\n")
+
+    def write(provider: str, cooldown: str) -> None:
+        (home / "auth.json").write_text(json.dumps({
+            "version": 1, "providers": {},
+            "credential_pool": {provider: [_pool_entry(provider, cooldown)]}}))
+
+    return write
+
+
+# anthropic reaches the picker through the overlay section, gemini through the models.dev one.
+@pytest.mark.parametrize("provider", ["anthropic", "gemini"])
+@pytest.mark.parametrize("cooldown", ["exhausted", "model_cooldown"])
+@pytest.mark.parametrize("explicit_only", [True, False])
+def test_rate_limited_pool_keeps_its_provider_row(pooled_home, provider, cooldown, explicit_only):
+    pooled_home(provider, cooldown)
+
+    rows = build_model_options_payload(load_picker_context(), explicit_only=explicit_only)["providers"]
+
+    row = next((r for r in rows if r["slug"] == provider), None)
+    assert row is not None, f"a {cooldown} {provider} pool dropped the provider from model.options"
+    assert row["models"], "the kept row must still offer the provider's models"
+
+
+def test_picker_visibility_keeps_the_full_custom_probe_budget(monkeypatch):
+    """Keeping cooldown rows visible must not shorten the current custom endpoint's live probe."""
+    monkeypatch.setattr("hermes_cli.models.cached_provider_model_ids", lambda *_a, **_kw: [])
+    monkeypatch.setattr("hermes_cli.models.provider_model_ids", lambda *_a, **_kw: [])
+    monkeypatch.setattr("hermes_cli.models.fetch_api_models", lambda *_a, **_kw: None)
+    monkeypatch.setattr("hermes_cli.models_local.fetch_ollama_local_models", lambda *_a, **_kw: None)
+
+    def answers_after_1_5s(_api_key, _api_url, _native, _preserve, headers=None, timeout=5.0,
+                           api_mode=None, **_kw):
+        return ["slow-discovered-model"] if timeout >= 5.0 else None
+
+    monkeypatch.setattr("hermes_cli.model_switch_providers._fetch_picker_live_models", answers_after_1_5s)
+    ctx = load_picker_context().with_overrides(
+        current_provider="custom", current_base_url="http://127.0.0.1:9999/v1", current_model="kept-model")
+
+    rows = build_model_options_payload(ctx)["providers"]
+
+    custom = next(r for r in rows if r["slug"] == "custom")
+    assert "slow-discovered-model" in custom["models"]
```

---

### Incident Patch 15: `9e780585` (2026-09-28)
**Commit Message**: fix(cli): decouple the custom-probe budget from for_picker visibility

Review feedback on #103843: forwarding for_picker=True to keep exhausted-pool
providers visible also flipped _discover_endpoint_models' budget for the live
current-custom-endpoint probe from 5s to 1.5s, so an endpoint answering
between the two budgets silently lost its discovered models from /model.

Thread fast_custom_probe (bool | None) through build_models_payload ->
list_authenticated_providers -> _PickerBuild; None resolves to for_picker so
every existing caller keeps its timeout. The CLI main picker passes
fast_custom_probe=False to retain its historical 5s probe budget while
keeping cooldown providers selectable.

Regression tests pin both sides: a slow current endpoint keeps its
discovered-only model with the full budget, and the default coupling plus
an explicit fast probe still cut it off.

**File**: `hermes_cli/cli_model_switch_mixin.py` (modified, +3/-0)
```diff
@@ -300,6 +300,9 @@ def _show_model_picker(cli, ctx, force_refresh: bool) -> None:
             # per-model for many providers, so another model may work (#103829) —
             # same contract as the gateway picker (#66584) and aux pickers (#66624).
             for_picker=True,
+            # Visibility only, not a faster probe: this call live-probes the current custom
+            # endpoint, which historically enjoyed the full 5s discovery budget (#103843).
+            fast_custom_probe=False,
         )["providers"]
     except Exception:
         providers = []
```

**File**: `hermes_cli/inventory.py` (modified, +5/-2)
```diff
@@ -78,13 +78,16 @@ def build_models_payload(
     capabilities: bool = False, featured: bool = False, force_fresh_nous_tier: bool = False,
     refresh: bool = False, probe_custom_providers: bool = True, probe_current_custom_provider: bool = False,
     for_picker: bool = False, max_models: int | None = None, non_blocking_catalogs: bool = False,
+    fast_custom_probe: bool | None = None,
 ) -> dict:
     """Build the ``{providers, model, provider}`` shape every consumer needs. ``explicit_only`` keeps
     only providers the user explicitly configured — hides ambient/auto-seeded credentials from
     desktop chat pickers. ``pricing_cache_only``: with ``pricing``, use only values already resident
     in process caches (normal picker opens, while a background worker warms cold endpoints).
     ``non_blocking_catalogs``: provider catalogs come from the disk cache only — a degraded provider
-    cannot stall the response (GUI picker opens)."""
+    cannot stall the response (GUI picker opens). ``fast_custom_probe`` overrides the
+    custom-endpoint discovery budget ``for_picker`` otherwise implies (1.5s vs 5s) — ``None`` keeps
+    the coupling, ``False`` retains the full 5s budget (#103843)."""
     from hermes_cli.model_switch import list_authenticated_providers
 
     rows = list_authenticated_providers(
@@ -94,7 +97,7 @@ def build_models_payload(
         max_models=max_models, refresh=refresh, probe_custom_providers=probe_custom_providers,
         probe_current_custom_provider=probe_current_custom_provider, for_picker=for_picker,
         excluded_providers=ctx.excluded_providers or [],
-        non_blocking_catalogs=non_blocking_catalogs,
+        non_blocking_catalogs=non_blocking_catalogs, fast_custom_probe=fast_custom_probe,
     )
 
     # Managed local runtime: staged GGUFs are selectable like any provider's models, but
```

**File**: `hermes_cli/model_switch_providers.py` (modified, +25/-8)
```diff
@@ -597,15 +597,20 @@ def _group_display_name(display_name: str) -> str:
 def _discover_endpoint_models(
     api_key: Any, api_url: str, native_catalog_provider: str, has_explicit_models: bool, *,
     headers: dict | None, api_mode: str | None, probe_live: bool, discovery_allowed: bool,
-    for_picker: bool) -> tuple[list | None, bool]:
+    fast_custom_probe: bool) -> tuple[list | None, bool]:
     """Return ``(models, native_catalog_empty)`` for a custom endpoint row.
 
     ``probe_live`` runs the native-aware picker fetch; otherwise, when discovery is allowed, a
     warm same-fingerprint cache entry still serves the full catalog with no round-trip.
     ``has_explicit_models`` gates the *probe* (a network-cost guard for keyless endpoints that
     declare a catalog), never the cache read — applying it to the read re-pins the endpoint to
-    its declared subset. Returns ``(None, False)`` when nothing usable was found."""
-    timeout = 1.5 if for_picker else 5.0
+    its declared subset. Returns ``(None, False)`` when nothing usable was found.
+
+    ``fast_custom_probe`` picks the discovery budget (1.5s fast / 5s full) independently of the
+    caller's exhausted-pool visibility flag: a picker that keeps cooldown providers visible
+    still deserves the full budget when it is the one surface that live-probes the current
+    custom endpoint."""
+    timeout = 1.5 if fast_custom_probe else 5.0
     if probe_live:
         try:
             live_models = _fetch_picker_live_models(
@@ -699,6 +704,10 @@ class _PickerBuild:
     refresh: bool
     excluded: set
     curated: dict
+    # Discovery budget override for custom endpoints (1.5s fast / 5s full). None keeps the
+    # historical coupling to for_picker; callers that only want exhausted-pool visibility set
+    # for_picker=True, fast_custom_probe=False so their probe budget is unchanged (#103843).
+    fast_custom_probe: bool | None = None
     # GUI read path: catalogs are read from cache only; stale/missing ones warm in the background.
     non_blocking_catalogs: bool = False
     results: list = field(default_factory=list)
@@ -716,6 +725,11 @@ def current_provider_norm(self) -> str:
     def current_base_url_norm(self) -> str:
         return self.current_base_url.rstrip("/").lower()
 
+    @property
+    def resolved_fast_custom_probe(self) -> bool:
+        """None defers to for_picker so pre-existing callers keep their timeout."""
+        return self.for_picker if self.fast_custom_probe is None else self.fast_custom_probe
+
     def can_probe_custom(self, *, row_is_current: bool) -> bool:
         return bool(self.probe_custom_providers or (self.probe_current_custom_provider and row_is_current))
 
@@ -789,7 +803,7 @@ def discover_endpoint(
         discovered, native_catalog_empty = _discover_endpoint_models(
             api_key, api_url, native_provider, has_explicit_models,
             headers=headers, api_mode=api_mode, probe_live=probe_live,
-            discovery_allowed=discovery_allowed, for_picker=self.for_picker)
+            discovery_allowed=discovery_allowed, fast_custom_probe=self.resolved_fast_custom_probe)
         return discovered, native_catalog_empty, probe_live
 
 
@@ -1049,7 +1063,7 @@ def _lap_bare_custom_row(b: _PickerBuild, custom_providers: list | None) -> None
         discovered, native_catalog_empty = _discover_endpoint_models(
             "", api_url, "custom", False, headers=None, api_mode=None,
             probe_live=bool(b.refresh or b.probe_current_custom_provider), discovery_allowed=True,
-            for_picker=b.for_picker)
+            fast_custom_probe=b.resolved_fast_custom_probe)
         if discovered is not None:
             models = discovered
     except Exception:
@@ -1189,7 +1203,7 @@ def list_authenticated_providers(
     max_models: int | None = None, current_model: str = "", refresh: bool = False,
     probe_custom_providers: bool = True, probe_current_custom_provider: bool = False,
     for_picker: bool = False, excluded_providers: list | None = None,
-    non_blocking_catalogs: bool = False) -> List[dict]:
+    non_blocking_catalogs: bool = False, fast_custom_probe: bool | None = None) -> List[dict]:
     """Detect which providers have credentials and list their curated (not full models.dev) models.
 
     Returns dicts with ``slug`` (the --provider value), ``name``, ``is_current``,
@@ -1201,7 +1215,10 @@ def list_authenticated_providers(
     true, GUI false); ``probe_current_custom_provider`` probes only the selected custom endpoint.
     ``non_blocking_catalogs`` is the GUI read path (``model.options``): provider catalogs come from
     the disk cache only and stale/missing ones warm in the background, so a degraded provider
-    never stalls the picker (#114215)."""
+    never stalls the picker (#114215). ``fast_custom_probe`` overrides the custom-endpoint
+    discovery budget ``for_picker`` otherwise implies (1.5s vs 5s) — ``None`` keeps the
+    historical coupling, ``False``
```

**File**: `tests/hermes_cli/test_picker_probe_budget_decoupling.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+"""Regression test for the probe-budget decoupling on #103843.
+
+``for_picker`` historically picked the custom-endpoint discovery timeout
+(1.5s fast / 5s full). When the CLI main picker started forwarding
+``for_picker=True`` for exhausted-pool visibility, a slow-but-working
+current custom endpoint lost its models: an endpoint answering between
+the two budgets fell out of ``/model``. ``fast_custom_probe`` now owns
+the budget so visibility no longer shortens discovery.
+"""
+
+import pytest
+
+from hermes_cli.model_switch import list_authenticated_providers
+
+
+@pytest.fixture(autouse=True)
+def _no_builtin_catalog_fetches(monkeypatch):
+    """Keep the row builder independent of provider credentials and network."""
+    monkeypatch.setattr("hermes_cli.models.cached_provider_model_ids", lambda *_a, **_kw: [])
+    monkeypatch.setattr("hermes_cli.models.provider_model_ids", lambda *_a, **_kw: [])
+    monkeypatch.setattr("hermes_cli.models.fetch_api_models", lambda *_a, **_kw: None)
+    monkeypatch.setattr("hermes_cli.models_local.fetch_ollama_local_models", lambda *_a, **_kw: None)
+
+
+def _slow_endpoint_rows(monkeypatch, **extra):
+    """Rows for a current custom endpoint answering after 1.5s but within 5s."""
+
+    def _fake_live(_api_key, _api_url, _native_provider, _preserve, headers=None,
+                   timeout=5.0, api_mode=None, **_kw):
+        return ["slow-discovered-model"] if timeout >= 5.0 else None
+
+    monkeypatch.setattr("hermes_cli.model_switch_providers._fetch_picker_live_models", _fake_live)
+    return list_authenticated_providers(
+        current_provider="custom", current_base_url="http://127.0.0.1:9999/v1",
+        current_model="kept-model", probe_custom_providers=False,
+        probe_current_custom_provider=True, for_picker=True, **extra)
+
+
+def _custom_row(rows):
+    return next(r for r in rows if r["slug"] == "custom")
+
+
+def test_full_budget_keeps_slow_endpoint_models(monkeypatch):
+    """for_picker visibility with fast_custom_probe=False retains the historical 5s budget."""
+    row = _custom_row(_slow_endpoint_rows(monkeypatch, fast_custom_probe=False))
+
+    assert "slow-discovered-model" in row["models"]
+
+
+def test_default_callers_keep_the_fast_budget_coupling(monkeypatch):
+    """fast_custom_probe=None still defers to for_picker: the legacy fast-picker behavior."""
+    row = _custom_row(_slow_endpoint_rows(monkeypatch))
+
+    assert "slow-discovered-model" not in row["models"]
+    assert row["models"] == ["kept-model"]
+
+
+def test_explicit_fast_probe_true_still_cuts_the_budget(monkeypatch):
+    row = _custom_row(_slow_endpoint_rows(monkeypatch, fast_custom_probe=True))
+
+    assert "slow-discovered-model" not in row["models"]
+    assert row["models"] == ["kept-model"]
```

**File**: `tests/hermes_cli/test_show_model_picker_exhausted_pool.py` (modified, +3/-0)
```diff
@@ -43,6 +43,9 @@ def test_show_model_picker_requests_for_picker():
     # The reasoning-effort step depends on the capability map; the rebase onto a main
     # that added ``capabilities=True`` must keep both flags in the same call.
     assert captured.get("capabilities") is True
+    # Visibility only: this call live-probes the current custom endpoint, which must keep
+    # its historical 5s discovery budget instead of the 1.5s fast-picker one (#103843).
+    assert captured.get("fast_custom_probe") is False
     cli._open_model_picker.assert_called_once()
     assert cli._open_model_picker.call_args[0][0] is providers
 
```

#### Recent Merged Pull Requests:
- **PR #133416** (2026-10-05): fmt(js): `npm run fix` auto-fix (@hermes-seaeye[bot])
- **PR #133413** (closed): fmt(js): `npm run fix` auto-fix (@hermes-seaeye[bot])
- **PR #133411** (2026-10-05): fix(discord): an auto-threaded mention reads the new thread's topic (@unsupportedpastels)
- **PR #133408** (2026-10-05): feat(desktop): a progress chip warns before a subscription hits its usage wall (@OutThisLife)
- **PR #133396** (closed): fmt(js): `npm run fix` auto-fix (@hermes-seaeye[bot])
- **PR #133393** (2026-10-05): fix(discord): Hermes's own auto-thread title rename keeps the pinned prompt (@unsupportedpastels)
- **PR #133392** (2026-10-05): feat(desktop): a rate-limited provider says why and until when in the model pickers (@OutThisLife)
- **PR #133377** (2026-10-05): fix(desktop): Review scope tabs no longer overlap in a narrow pane (@OutThisLife)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): Evil0ctal/Douyin_TikTok_Download_API

> **Canonical Artifact**: `07_PROJECT_LEARNING/evil0ctal-douyin_tiktok_download_api-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:30:25.975Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Evil0ctal/Douyin_TikTok_Download_API`
- **Description**: 🚀 抖音、TikTok 数据采集与无水印视频下载 API，自托管，支持 MCP 调用与 Docker 一键部署。| Self-hosted TikTok & Douyin scraper and no-watermark video downloader — async REST API, MCP server, CLI and web console for posts, profiles, comments and playlists. Self-healing identity pool, PostgreSQL archive, one docker compose up. 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 20415 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/browser_rpc/__init__.py`
```
"""browser-rpc: the headless-browser side of dtk, as a small RPC service.

Two capabilities, both off the hot path (docs/design/04-transport-signing.md):

* **mint** - drive a real browser through an identity's own proxy until the
  platform hands out guest cookies, and report the fingerprint that browser
  presented. Cookies and fingerprint have to come from the same session, which
  is why this cannot be faked from Python.
* **sign** - run the platform's own JavaScript to sign a request when the native
  port of the algorithm has drifted. Slow but self-updating.

The service is resident rather than launched per call because starting a browser
costs seconds, and the signing path is already a degraded one.

It listens only on the internal compose network and does no authentication: the
network is the trust boundary there, and a second one would add operational
weight without adding safety. The URL and proxy arguments are still validated -
against this service's own mistakes, not against an attacker.
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "5.1.2"

```

### Core Architecture Module: `docker/browser_rpc/__main__.py`
```
"""Process entry point: `python -m browser_rpc`.

Configuration errors are reported here, before uvicorn binds anything, so a
misconfigured container fails with one readable line instead of a traceback
buried in a worker start-up log.
"""

from __future__ import annotations

import sys

import uvicorn

from browser_rpc.errors import ConfigError
from browser_rpc.main import configure_logging, create_app
from browser_rpc.settings import Settings


def main() -> int:
    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        print(f"browser-rpc: refusing to start: {exc}", file=sys.stderr)
        return 78  # EX_CONFIG

    configure_logging(settings.log_level)

    try:
        app = create_app(settings)
    except ConfigError as exc:
        print(f"browser-rpc: refusing to start: {exc}", file=sys.stderr)
        return 78

    uvicorn.run(
        app,
        host=settings.bind_host,
        port=settings.bind_port,
        log_level=settings.log_level,
        access_log=False,
        server_header=False,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `docker/browser_rpc/backends/__init__.py`
```
"""Backend registry.

Selection is by exact name and there is no fallback between backends. If the
configured one cannot start, the service reports itself unhealthy and the pool
degrades to manually imported cookies - which is a state the operator can see.
Quietly switching to the fake backend would instead fill the pool with
identities no platform accepts, and everything downstream would look fine.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping

from browser_rpc.backends import cloak, fake
from browser_rpc.backends.base import (
    BackendInfo,
    BrowserBackend,
    MintedProfile,
    MintPlan,
    SigningContext,
    SignPlan,
)
from browser_rpc.errors import ConfigError
from browser_rpc.settings import Settings

BACKENDS: Mapping[str, Callable[[Settings], BrowserBackend]] = {
    cloak.BACKEND_NAME: cloak.build,
    fake.BACKEND_NAME: fake.build,
}


def build_backend(settings: Settings) -> BrowserBackend:
    """Instantiate the configured backend, or refuse to start."""
    factory = BACKENDS.get(settings.backend)
    if factory is None:
        known = ", ".join(sorted(BACKENDS))
        raise ConfigError(
            f"unknown browser backend {settings.backend!r}; DTK_BROWSER_BACKEND must be one of: {known}"
        )
    return factory(settings)


__all__ = [
    "BACKENDS",
    "BackendInfo",
    "BrowserBackend",
    "MintPlan",
    "MintedProfile",
    "SignPlan",
    "SigningContext",
    "build_backend",
]

```

### Core Architecture Module: `docker/browser_rpc/backends/base.py`
```
"""The browser backend contract.

Everything in browser-rpc except `backends/cloak.py` is written against this
file. That is the point: CloakBrowser is one decision among several the project
has already had to revisit, and the day it is replaced the change should be one
new module implementing `BrowserBackend`, not a rewrite of the service.

The contract is deliberately narrow. A backend opens contexts and reads pages;
it does not decide policy. Which profile is single-use, how long a warm context
lives, what the geo alignment should be and how long anything may take are all
decided in `service.py`, where they can be tested without a browser.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from browser_rpc.geo import GeoProfile
from browser_rpc.validation import Platform, ProxyEndpoint


@dataclass(frozen=True, slots=True)
class BackendInfo:
    """What the backend is, for /rpc/health and the console's system page.

    ``chromium_major`` is reported next to the wreq emulation profile version in
    the console: the two drifting apart means the TLS fingerprint no longer
    matches the User-Agent, which is self-disclosure
    (docs/design/04-transport-signing.md).
    """

    name: str
    version: str | None = None
    chromium_major: int | None = None
    pin: str | None = None


@dataclass(frozen=True, slots=True)
class MintPlan:
    """One minting session, fully specified. Every field is already validated."""

    platform: Platform
    landing_url: str
    profile_dir: str
    geo: GeoProfile
    proxy: ProxyEndpoint | None = None
    timeout_seconds: float = 60.0


@dataclass(frozen=True, slots=True)
class MintedProfile:
    """What a session produced: cookies plus the fingerprint that earned them.

    The two travel together for a reason. A cookie set collected under one
    fingerprint and replayed under another is a mismatch the platform can see
    (docs/design/02-identity-pool.md).
    """

    cookies: Mapping[str, str]
    user_agent: str | None = None
    browser_family: str = "chrome"
    browser_major: int | None = None
    #: `navigator.platform`, e.g. "Win32".
    navigator_platform: str | None = None
    #: "1920x1080".
    screen: str | None = None
    language: str | None = None
    timezone: str | None = None
    #: `navigator.hardwareConcurrency` and `navigator.deviceMemory` (GiB). Both
    #: are echoed back in the platforms' query strings, so a guess here becomes
    #: a claim the User-Agent cannot support.
    hardware_concurrency: int | None = None
    device_memory: int | None = None
    #: Filled in by the backend only when it measured the exit itself; the
    #: service falls back to its own probe.
    exit_ip: str | None = None
    extra: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class SignPlan:
    """One signature request.

    ``query`` is the exact byte sequence to sign, as built by the caller. The
    parameter map is passed alongside for backends that need it, but the query
    string is authoritative: a signature over almost the right bytes is a wrong
    signature (see `dtk.signing.rpc`).
    """

    platform: Platform
    url: str
    query: str
    params: Mapping[str, str]
    user_agent: str | None = None
    timeout_seconds: float = 8.0


@runtime_checkable
class SigningContext(Protocol):
    """A warm page with the platform's own JavaScript loaded."""

    @property
    def platform(self) -> Platform: ...

    async def sign(self, plan: SignPlan) -> dict[str, str]:
        """Return signature fields, e.g. {"a_bogus": ..., "ms_token": ...}.

        Keys use the wire names of `dtk.signing.rpc.RESPONSE_FIELDS` and
        `PASSTHROUGH_FIELDS`. An empty mapping means the page produced nothing,
        which the service reports as a backend failure.
        """

    async def close(self) -> None:
        """Release the page and its context. Must be safe to call twice."""


@runtime_checkable
class BrowserBackend(Protocol):
    """The whole browser dependency, expressed in five methods."""

    async def start(self) -> None:
        """Bring the backend up. Raises `BackendUnavailable` when it cannot."""

    async def close(self) -> None:
        """Shut everything down. Must be safe to call without a prior start."""

    def info(self) -> BackendInfo:
        """Describe the backend. Cheap and synchronous: /rpc/health calls it."""

    async def mint(self, plan: MintPlan) -> MintedProfile:
        """Run one minting session in a fresh profile directory.

        The service creates and deletes ``plan.profile_dir``; the backend must
        not reuse a directory across calls, because a reused profile carries the
        previous identity's traces.
        """

    async def open_signing_context(
        self,
        platform: Platform,
        geo: GeoProfile,
        proxy: ProxyEndpoint | None = None,
        cookies: Mapping[str, str] | None = None,
    ) -> SigningContext:
        """Open a warm context for a platform's signing page.

        ``cookies`` are installed before the page is navigated, not after: the
        signing SDK reads the cookies that decide a signature once, while the
        document loads. Handing them over afterwards changes the jar without
        changing the signature, which is the incoherence this argument exists
        to prevent.
        """


__all__ = [
    "BackendInfo",
    "BrowserBackend",
    "MintPlan",
    "MintedProfile",
    "SignPlan",
    "SigningContext",
]

```

### Core Architecture Module: `docker/browser_rpc/backends/cloak.py`
```
"""CloakBrowser adapter. This file is the seam.

===========================================================================
SEAM - the only module in browser-rpc that knows a browser library exists
===========================================================================

CloakBrowser (MIT, decision D1) is a Playwright drop-in with source-level
Chromium fingerprint changes. Everything specific to it is in four places here,
and nowhere else in the service:

    1. `_load_driver()`      the import, and the only place the name appears
    2. `_launch_context()`   how a context is opened with proxy, locale and zone
    3. `_read_fingerprint()` how the page reports what it claims to be
    4. `SIGN_SCRIPT`         asks the page's SDK to sign one request

Replacing the backend means writing a module with `start`, `close`, `info`,
`mint` and `open_signing_context` (see `backends/base.py`) and adding it to the
registry. Nothing else in the service changes.

Pinning
-------
At least three GitHub organizations publish repositories called cloakbrowser
with identical descriptions. The image therefore installs one repository at one
commit, passed in as a build argument, and stamps the pin into
`DTK_BROWSER_BACKEND_PIN` so /rpc/health can report exactly what is running
(docs/design/04-transport-signing.md).

Live verification
-----------------
Two things here can only be confirmed against a real page, per
docs/design/16-salvage-and-debug.md: the driver's exact entry point, and the
signing flow in `SIGN_SCRIPT`. Both are one edit each - that is the whole
reason they are isolated in this file. `docker/README.md` records the procedure.
"""

from __future__ import annotations

import asyncio
import contextlib
import importlib
import logging
import re
import shutil
import time
import uuid
from collections.abc import Mapping, Sequence
from types import MappingProxyType
from typing import Any, Final

from browser_rpc.backends.base import (
    BackendInfo,
    MintedProfile,
    MintPlan,
    SignPlan,
)
from browser_rpc.errors import BackendFailure, BackendUnavailable
from browser_rpc.geo import GeoProfile
from browser_rpc.settings import Settings
from browser_rpc.validation import (
    COOKIE_DOMAINS,
    READY_PROBE_URLS,
    SIGNING_PAGE_URLS,
    Platform,
    ProxyEndpoint,
)

logger = logging.getLogger(__name__)

BACKEND_NAME = "cloak"

#: Import candidates, in order: the package, then the submodule that holds the
#: launch coroutines, in case a future build stops re-exporting them.
DRIVER_MODULES: tuple[str, ...] = ("cloakbrowser", "cloakbrowser.browser")

#: The coroutine this backend drives. Checked at startup so an image without the
#: browser says so through /rpc/health instead of failing the first mint.
#:
#: Not `async_playwright`: that is Playwright's entry point, and this adapter was
#: written against its shape before anyone ran it against cloakbrowser, which
#: exposes module-level `launch_*_async` coroutines instead.
LAUNCH_ENTRY_POINT: str = "launch_persistent_context_async"

#: Chromium flags. Kept short on purpose: every flag that changes behaviour is
#: also a flag that changes the fingerprint, and the point of this backend is a
#: browser that looks ordinary.
CHROMIUM_ARGS: tuple[str, ...] = (
    # NOT the place to control --disable-dev-shm-usage. An earlier comment here
    # claimed the flag was "deliberately absent" so that the container's 1GB
    # /dev/shm would be used; reading a real launch line on 2026-09-08 disproved
    # it. The driver passes --disable-dev-shm-usage itself, unconditionally, and
    # arguments appended here cannot remove one it already set. The measured
    # consequence: /dev/shm stays at 0% while every renderer's shared memory
    # lands in /tmp, where two warm contexts hold ~290MB each as deleted-but-open
    # files. Chromium then dies with SIGSEGV or "Target crashed", which reaches
    # the caller looking exactly like a platform block. So /tmp is the budget
    # that matters and it is sized in docker/compose.yml, not here.
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
)

#: Read once per session. `navigator.webdriver` is not asked for on purpose: the
#: backend's job is to make it absent, and reading it back here would only
#: confirm what the platform already checks.
#: `deviceMemory` is Chromium-only and absent elsewhere; `_string_fields` drops
#: an undefined value, so a Firefox mint simply carries no memory and the query
#: keeps its default rather than claiming a machine nobody measured.
FINGERPRINT_SCRIPT = """() => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  screen: `${screen.width}x${screen.height}`,
  language: navigator.language,
  languages: (navigator.languages || []).join(','),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemory: navigator.deviceMemory,
})"""

#: Injected before any page script runs, so it sits BENEATH the platform SDK.
#:
#: Both platforms sign by patching ``window.fetch`` and ``XMLHttpRequest``
#: rather than by exposing a signing function - verified in a live browser on
#: 2026-09-07: on douyin.com and tiktok.com all of fetch, XHR.open, XHR.send and
#: XHR.setRequestHeader are non-native, while ``window.byted_acrawler`` exposes
#: no ``sign`` at all and the SDK bundles contain no ``a_bogus`` string, because
#: the names are built at runtime inside a bytecode VM (``_$webrt_*``).
#:
#: So there is nothing to call. The only reliable way to obtain a signature is
#: to hand the SDK a request and observe what it produces. Capturing the natives
#: first means our recorder runs *under* the SDK's patch: the SDK rewrites the
#: URL, hands it down to what it believes is the browser, and we read it there
#: and abort - so a signature costs no upstream request.
#: NOTE ON POOLING: a signing context cannot be shared between identities.
#: Measured on 2026-09-08, against a live page rather than inferred:
#:
#: * `verifyFp` and `fp` are both the browser's `s_v_web_id` cookie, verbatim.
#: * The SDK reads it once, while the document loads, and caches it. Swapping
#:   the cookie on a warm page changes nothing; only a fresh document does.
#: * Seeding `verifyFp` in the query handed to the SDK does not work either -
#:   it overwrites the value with its own cached one.
#: * `uifid` matches the identity's `UIFID_TEMP` cookie, but it also matched
#:   across two independently minted contexts, so it is device-derived and is
#:   not what separates them. `verifyFp` is.
#:
#: So the only way to obtain a signature coherent with a given jar is to load
#: the page with that jar already installed, and `browser_rpc.service` keys its
#: warm slots on the jar for exactly that reason.
CAPTURE_INIT_SCRIPT = """
(() => {
  const nativeFetch = window.fetch;
  const nativeOpen = XMLHttpRequest.prototype.open;
  const state = { capture: false, url: null };
  window.__dtkSign = state;

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url);
    if (state.capture) {
      state.url = url;
      // Never reaches the network: the SDK has already done its work by now.
      return Promise.reject(new DOMException('dtk-capture', 'AbortError'));
    }
    return nativeFetch.apply(this, arguments);
  };

  XMLHttpRequest.prototype.open = function (method, url) {
    if (state.capture) {
      state.url = url;
      throw new DOMException('dtk-capture', 'AbortError');
    }
    return nativeOpen.apply(this, arguments);
  };
})();
"""

#: How often to ask whether the page can sign yet, and how long to keep asking.
#:
#: A page is navigable long before it can sign: `domcontentloaded` fires and the
#: security bundle arrives afterwards. Signing inside that window fails with
#: "the SDK added nothing", which reads like the platform changed its algorithm
#: and is really just impatience - observed on TikTok, whic
```

### Core Architecture Module: `docker/browser_rpc/backends/fake.py`
```
"""A backend with no browser, for wiring up and testing the service.

What it is for: bringing the stack up on a laptop, exercising the RPC contract
end to end in CI, and reproducing service-level behaviour (single-use profiles,
warm-context refresh, timeouts) without a 500MB Chromium.

What it is not for: minting anything a platform will accept. The cookies are
derived from a hash and carry no session at all. Selecting a backend is
therefore explicit in the compose file - nothing ever falls back to this one,
because a pool quietly filling up with synthetic identities looks healthy right
up to the moment every request comes back risk-controlled.
"""

from __future__ import annotations

import hashlib
import logging
import os
from collections.abc import Mapping

from browser_rpc.backends.base import (
    BackendInfo,
    MintedProfile,
    MintPlan,
    SigningContext,
    SignPlan,
)
from browser_rpc.errors import BackendFailure
from browser_rpc.geo import GeoProfile
from browser_rpc.validation import Platform, ProxyEndpoint

logger = logging.getLogger(__name__)

BACKEND_NAME = "fake"

#: Kept in step with the Chromium the real backend ships, so a deployment that
#: tests with the fake sees the same emulation profile selection it will see in
#: production (docs/design/04-transport-signing.md).
FAKE_CHROMIUM_MAJOR = 149

USER_AGENT_TEMPLATE = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36"
)

#: The cookie names each platform actually sets on a guest session; the pool's
#: import validation looks for these, so the fake has to produce them.
COOKIE_NAMES: Mapping[Platform, tuple[str, ...]] = {
    Platform.DOUYIN: ("ttwid", "odin_tt", "msToken", "s_v_web_id"),
    Platform.TIKTOK: ("ttwid", "msToken", "tt_csrf_token", "tt_chain_token"),
}

#: Which signature parameter each platform expects back.
SIGNATURE_FIELDS: Mapping[Platform, str] = {
    Platform.DOUYIN: "a_bogus",
    Platform.TIKTOK: "x_bogus",
}


def _digest(*parts: str, length: int = 32) -> str:
    """A stable, URL-safe pseudo-token. Deterministic so tests can assert on it."""
    blob = "|".join(parts).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()[:length]


class FakeSigningContext:
    """A warm context that computes a hash instead of running platform code.

    It models one property of the real thing deliberately: the signature it
    returns names the ``s_v_web_id`` of the jar the context was OPENED with, not
    the jar of whoever asks it to sign. That is how the platforms behave -
    measured on 2026-09-08, Douyin's ``verifyFp`` is the cookie the document
    loaded with, cached - and reproducing it here is what lets a test catch a
    context being reused across identities without driving a browser. A fake
    that ignored cookies would pass just as happily with the bug in place.
    """

    def __init__(
        self, platform: Platform, geo: GeoProfile, cookies: Mapping[str, str] | None = None
    ) -> None:
        self._platform = platform
        self._geo = geo
        self._closed = False
        #: Frozen at open time on purpose. See the class docstring.
        self.cookies: Mapping[str, str] = dict(cookies or {})

    @property
    def platform(self) -> Platform:
        return self._platform

    @property
    def closed(self) -> bool:
        return self._closed

    async def sign(self, plan: SignPlan) -> dict[str, str]:
        if self._closed:
            raise BackendFailure("signing context is closed")
        field = SIGNATURE_FIELDS[self._platform]
        signature = _digest("sign", self._platform.value, plan.query, plan.user_agent or "")
        signed = {
            field: signature,
            "ms_token": _digest("mstoken", self._platform.value, plan.url, length=48),
        }
        # Only Douyin sends it, and only when the context holds one - an
        # anonymous context has no visitor to name.
        carried = self.cookies.get("s_v_web_id")
        if carried and self._platform is Platform.DOUYIN:
            signed["verifyFp"] = carried
        return signed

    async def close(self) -> None:
        self._closed = True


class FakeBackend:
    """In-process stand-in implementing `BrowserBackend`."""

    def __init__(self, chromium_major: int = FAKE_CHROMIUM_MAJOR) -> None:
        self._chromium_major = chromium_major
        self._started = False
        #: Every profile directory ever handed to `mint`. The service asserts
        #: single use; this is what makes that assertion observable.
        self.minted_profile_dirs: list[str] = []

    async def start(self) -> None:
        self._started = True
        logger.warning(
            "backend.fake.started: minting synthetic identities; "
            "no platform will accept these cookies"
        )

    async def close(self) -> None:
        self._started = False

    def info(self) -> BackendInfo:
        return BackendInfo(
            name=BACKEND_NAME,
            version=f"fake-{self._chromium_major}",
            chromium_major=self._chromium_major,
            pin=None,
        )

    async def mint(self, plan: MintPlan) -> MintedProfile:
        if not self._started:
            raise BackendFailure("backend is not started")
        if plan.profile_dir in self.minted_profile_dirs:
            raise BackendFailure(f"profile directory reused: {plan.profile_dir}")
        self.minted_profile_dirs.append(plan.profile_dir)
        # The real backend writes a profile here; creating it keeps the
        # service's cleanup path exercised.
        os.makedirs(plan.profile_dir, exist_ok=True)

        seed = plan.proxy.server if plan.proxy else "direct"
        cookies = {
            name: _digest("cookie", plan.platform.value, name, seed, plan.profile_dir)
            for name in COOKIE_NAMES[plan.platform]
        }
        return MintedProfile(
            cookies=cookies,
            user_agent=USER_AGENT_TEMPLATE.format(major=self._chromium_major),
            browser_family="chrome",
            browser_major=self._chromium_major,
            navigator_platform="Win32",
            screen="1920x1080",
            language=plan.geo.locale,
            timezone=plan.geo.timezone,
            # The same shape a Chromium mint reports, so the fake backend
            # exercises the whole field set rather than half of it.
            hardware_concurrency=8,
            device_memory=8,
            exit_ip=None,
        )

    async def open_signing_context(
        self,
        platform: Platform,
        geo: GeoProfile,
        proxy: ProxyEndpoint | None = None,
        cookies: Mapping[str, str] | None = None,
    ) -> SigningContext:
        if not self._started:
            raise BackendFailure("backend is not started")
        return FakeSigningContext(platform, geo, cookies)


def build(settings: object) -> FakeBackend:
    """Factory used by the backend registry. Takes no configuration."""
    return FakeBackend()


__all__ = ["BACKEND_NAME", "FAKE_CHROMIUM_MAJOR", "FakeBackend", "FakeSigningContext", "build"]

```

### Core Architecture Module: `docker/browser_rpc/errors.py`
```
"""Error taxonomy for the RPC surface.

The callers in `dtk.identity.minting.client` and `dtk.signing.rpc` treat any
non-2xx reply as "browser-rpc is unavailable" and degrade: minting stops and the
pool falls back to imported cookies, signing falls back to the native algorithm.
The status code therefore does not change what the caller does - it changes what
the operator reads in the logs, which is why each failure mode gets its own code
instead of a blanket 500.
"""

from __future__ import annotations


class RpcError(Exception):
    """Base for every failure that has a defined HTTP shape."""

    status_code: int = 500
    code: str = "internal"

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail

    def as_body(self) -> dict[str, object]:
        body: dict[str, object] = {"error": {"code": self.code, "message": self.message}}
        if self.detail:
            error = body["error"]
            assert isinstance(error, dict)
            error["detail"] = self.detail
        return body


class InvalidRequest(RpcError):
    """The request did not pass validation: unknown platform, bad URL, bad proxy."""

    status_code = 400
    code = "invalid_request"


class BackendUnavailable(RpcError):
    """The browser backend is not running, or not usable in this image."""

    status_code = 503
    code = "backend_unavailable"


class BackendFailure(RpcError):
    """The browser ran and failed: navigation error, no cookies, no signature."""

    status_code = 502
    code = "backend_failed"


class OperationTimeout(RpcError):
    """The browser did not finish inside the service-side budget.

    Deliberately shorter than the client timeout, so the caller reads a reply
    that says what happened rather than hitting its own deadline.
    """

    status_code = 504
    code = "timeout"


class ConfigError(RuntimeError):
    """The process is misconfigured and must not start."""


__all__ = [
    "BackendFailure",
    "BackendUnavailable",
    "ConfigError",
    "InvalidRequest",
    "OperationTimeout",
    "RpcError",
]

```

### Core Architecture Module: `docker/browser_rpc/geo.py`
```
"""Align the browser's locale and clock with the proxy exit.

A German exit reporting `Asia/Shanghai` is a tell given away for free: the
platform sees the mismatch in one JavaScript call and never has to look at the
request rate. Timezone, locale and `Accept-Language` therefore come from where
the traffic actually leaves, not from the host running the container.

Resolution order, most trustworthy first:

1. explicit fields in the caller's ``geo_hint`` - the pool knows what it bought
2. the country of the exit, measured by asking an echo endpoint *through the
   proxy* before the browser starts
3. the configured default

Step 2 runs before the context is created because timezone and locale have to be
set at context creation; changing them afterwards is visible to the page.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class GeoProfile:
    """Everything the browser needs to look like it belongs at the exit."""

    timezone: str
    locale: str
    languages: str
    country: str | None = None


@dataclass(frozen=True, slots=True)
class ExitInfo:
    """What the echo endpoint saw. Both fields are None when the probe failed."""

    ip: str | None = None
    country: str | None = None


#: One representative zone and locale per country. A country spanning several
#: zones gets the one holding most of its population: being in the right country
#: with the wrong city is ordinary, being on the wrong continent is not.
COUNTRY_PROFILES: Mapping[str, GeoProfile] = {
    "AE": GeoProfile("Asia/Dubai", "ar-AE", "ar-AE,ar;q=0.9,en;q=0.8"),
    "AU": GeoProfile("Australia/Sydney", "en-AU", "en-AU,en;q=0.9"),
    "BR": GeoProfile("America/Sao_Paulo", "pt-BR", "pt-BR,pt;q=0.9,en;q=0.8"),
    "CA": GeoProfile("America/Toronto", "en-CA", "en-CA,en;q=0.9,fr-CA;q=0.8"),
    "CH": GeoProfile("Europe/Zurich", "de-CH", "de-CH,de;q=0.9,en;q=0.8"),
    "CN": GeoProfile("Asia/Shanghai", "zh-CN", "zh-CN,zh;q=0.9"),
    "DE": GeoProfile("Europe/Berlin", "de-DE", "de-DE,de;q=0.9,en;q=0.8"),
    "ES": GeoProfile("Europe/Madrid", "es-ES", "es-ES,es;q=0.9,en;q=0.8"),
    "FR": GeoProfile("Europe/Paris", "fr-FR", "fr-FR,fr;q=0.9,en;q=0.8"),
    "GB": GeoProfile("Europe/London", "en-GB", "en-GB,en;q=0.9"),
    "HK": GeoProfile("Asia/Hong_Kong", "zh-HK", "zh-HK,zh;q=0.9,en;q=0.8"),
    "ID": GeoProfile("Asia/Jakarta", "id-ID", "id-ID,id;q=0.9,en;q=0.8"),
    "IN": GeoProfile("Asia/Kolkata", "en-IN", "en-IN,en;q=0.9,hi;q=0.8"),
    "IT": GeoProfile("Europe/Rome", "it-IT", "it-IT,it;q=0.9,en;q=0.8"),
    "JP": GeoProfile("Asia/Tokyo", "ja-JP", "ja-JP,ja;q=0.9,en;q=0.8"),
    "KR": GeoProfile("Asia/Seoul", "ko-KR", "ko-KR,ko;q=0.9,en;q=0.8"),
    "MX": GeoProfile("America/Mexico_City", "es-MX", "es-MX,es;q=0.9,en;q=0.8"),
    "MY": GeoProfile("Asia/Kuala_Lumpur", "ms-MY", "ms-MY,ms;q=0.9,en;q=0.8"),
    "NL": GeoProfile("Europe/Amsterdam", "nl-NL", "nl-NL,nl;q=0.9,en;q=0.8"),
    "PH": GeoProfile("Asia/Manila", "en-PH", "en-PH,en;q=0.9,fil;q=0.8"),
    "PL": GeoProfile("Europe/Warsaw", "pl-PL", "pl-PL,pl;q=0.9,en;q=0.8"),
    "RU": GeoProfile("Europe/Moscow", "ru-RU", "ru-RU,ru;q=0.9,en;q=0.8"),
    "SE": GeoProfile("Europe/Stockholm", "sv-SE", "sv-SE,sv;q=0.9,en;q=0.8"),
    "SG": GeoProfile("Asia/Singapore", "en-SG", "en-SG,en;q=0.9,zh-CN;q=0.8"),
    "TH": GeoProfile("Asia/Bangkok", "th-TH", "th-TH,th;q=0.9,en;q=0.8"),
    "TR": GeoProfile("Europe/Istanbul", "tr-TR", "tr-TR,tr;q=0.9,en;q=0.8"),
    "TW": GeoProfile("Asia/Taipei", "zh-TW", "zh-TW,zh;q=0.9,en;q=0.8"),
    "US": GeoProfile("America/New_York", "en-US", "en-US,en;q=0.9"),
    "VN": GeoProfile("Asia/Ho_Chi_Minh", "vi-VN", "vi-VN,vi;q=0.9,en;q=0.8"),
}

FALLBACK_PROFILE = GeoProfile(timezone="UTC", locale="en-US", languages="en-US,en;q=0.9")

#: Keys an echo endpoint may use for the country. ipinfo.io says "country",
#: ip-api.com says "countryCode"; accepting both keeps the setting swappable.
_COUNTRY_KEYS = ("country", "country_code", "countryCode")
_IP_KEYS = ("ip", "query", "ip_address")


def profile_for_country(country: str | None) -> GeoProfile | None:
    """The profile for a two-letter country code, or None when unknown."""
    if not country:
        return None
    code = country.strip().upper()
    profile = COUNTRY_PROFILES.get(code)
    if profile is None:
        return None
    return GeoProfile(
        timezone=profile.timezone,
        locale=profile.locale,
        languages=profile.languages,
        country=code,
    )


def resolve(
    geo_hint: Mapping[str, Any] | None,
    exit_country: str | None = None,
    default_country: str = "US",
) -> GeoProfile:
    """Combine caller hint, measured exit and default into one profile.

    Individual fields override individually: a caller that knows only the
    timezone still gets a locale that matches the exit country.
    """
    hint = geo_hint or {}
    hinted_country = _first_str(hint, ("country", "country_code", "countryCode"))

    base = (
        profile_for_country(hinted_country)
        or profile_for_country(exit_country)
        or profile_for_country(default_country)
        or FALLBACK_PROFILE
    )

    timezone = _first_str(hint, ("timezone", "timezone_id", "tz")) or base.timezone
    locale = _first_str(hint, ("locale", "language")) or base.locale
    languages = _first_str(hint, ("languages", "accept_language")) or base.languages
    country = hinted_country or base.country or exit_country

    return GeoProfile(
        timezone=timezone,
        locale=locale,
        languages=languages,
        country=country.upper() if country else None,
    )


async def probe_exit(
    proxy: str | None,
    probe_url: str | None,
    timeout: float,
    client_factory: Callable[..., httpx.AsyncClient] = httpx.AsyncClient,
) -> ExitInfo:
    """Ask an echo endpoint, through the proxy, where the traffic comes out.

    Never raises. A failed probe means the geo hint and the default decide,
    which is a worse identity but still a usable one - refusing to mint because
    an unrelated third-party endpoint is down would be the wrong trade.
    """
    if not probe_url:
        return ExitInfo()

    try:
        kwargs: dict[str, Any] = {"timeout": timeout, "follow_redirects": True}
        if proxy:
            kwargs["proxy"] = proxy
        async with client_factory(**kwargs) as client:
            response = await client.get(probe_url)
            response.raise_for_status()
            payload = response.json()
    # Any failure here - DNS, TLS, a dead endpoint, a proxy that refuses
    # CONNECT - degrades to "unknown exit" rather than failing the mint.
    except Exception as exc:
        logger.warning("geo.probe.failed error=%s", exc)
        return ExitInfo()

    if not isinstance(payload, dict):
        logger.warning("geo.probe.unexpected_body type=%s", type(payload).__name__)
        return ExitInfo()

    ip = _first_str(payload, _IP_KEYS)
    country = _first_str(payload, _COUNTRY_KEYS)
    logger.info("geo.probe.done ip=%s country=%s", ip, country)
    return ExitInfo(ip=ip, country=country.upper() if country else None)


def _first_str(source: Mapping[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


__all__ = [
    "COUNTRY_PROFILES",
    "FALLBACK_PROFILE",
    "ExitInfo",
    "GeoProfile",
    "probe_exit",
    "profile_for_country",
    "resolve",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #739** (2026-09-10): **[BUG] 用户主页视频数据接口报400**
  *Symptoms*: ***发生错误的平台？*** 抖音  ***发生错误的端点？***  Web APP  ***提交的输入值？***  用户主页链接  ***是否有再次尝试？***  如：是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。 {   "detail": {     "code": 400,     "message": "An error occurred.",     "support": "Please contact us on Github: https://github.com/Evil0ctal/Douyin_TikTok_Download_API",     "time": "2026-09-04 12:01:45",     "router": "/api/douyin/web/fetch_user_post_videos",     "params": {       "sec_user_id": "MS4wLjABAAAAW5ALxswnX8MrEjrKHQTU3YmNfhVRTwvCnJtCVxfMBVDaHkYhdKGTFCXEUC7SUmAG",       "max_cursor": "0",       "count": "20"     }   } }
  **Post-Mortem & Fix Analysis**:
  > 我也遇到了，怎么解决呢
  > 应该是旧的v1接口上风控了，现在是一会正常，一会403的，应该只能等作者更新新接口了。
  > 晚点更新一下

- **Issue #736** (2026-09-10): **[BUG] Brief and clear description of the problem**
  *Symptoms*: (HTTP 400): {'code': 400, 'message': 'An error occurred.', 'support': 'Please contact us on Github
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #734** (2026-09-10): **[BUG] 简短明了的描述问题**
  *Symptoms*: ***发生错误的平台？*** 抖音  ***发生错误的端点？*** Web APP  ***提交的输入值？*** 短视频链接  ***是否有再次尝试？*** 是  今天抖音解析视频失效了 
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #729** (2026-09-10): **[Security] Unauthenticated full-read Server-Side Request Forgery in /api/download and /api/hybrid/video_data (url parameter)**
  *Symptoms*: Hi. Is there a place I can disclose a potential security vulnerability please?
  **Post-Mortem & Fix Analysis**:
  > ### Summary The public, unauthenticated parsing endpoints accept a user-supplied `url` query parameter and fetch it server-side with no host or IP restriction. An attacker can make the server issue requests to arbitrary internal addresses (including the cloud metadata endpoint `http://169.254.169.254/`). When the targeted internal service responds with a status code outside a small allowed set, the response body is returned verbatim to the attacker in the API error message, making this a full-read SSRF.  ### Details The endpoints take `url` directly and pass it to the crawler:  `app/api/endpoints/download.py` ```python @router.get("/download") async def download_file_hybrid(request: Request, url: str = Query(...), ...):     ...     if not config["API"]["Download_Switch"]:           # shipped as true         ...     try:         data = await HybridCrawler.hybrid_parsing_single_video(url, minimal=True)     except Exception as e:         return ErrorResponseModel(code=400, message=str(e),
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #724** (2026-09-10): **[BUG] 刚刚docker部署cookie也修改了 GET /api/hybrid/video_data?url=https://v.douyin.com/BeK6SA9T96E/&minimal=false，服务器返回了 400 Bad Request**
  *Symptoms*: ***发生错误的平台？***  如：抖音  ***发生错误的端点？***  如：  ***提交的输入值？***  如：短视频链接  ***是否有再次尝试？***  如：是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。  <img width="935" height="778" alt="Image" src="https://github.com/user-attachments/assets/4067202c-cefe-4f15-ac04-720a040e22f7" /> 
  **Post-Mortem & Fix Analysis**:
  > INFO:     Started reloader process [7] using StatReload ERROR    请求Douyin msToken API时发生错误：Server error '503 Service                      Unavailable' for url 'https://mssdk.bytedance.com/web/report'                    For more information check:                                                      https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503            INFO     将使用本地生成的虚假msToken参数，以继续请求。 
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #720** (2026-09-10): **[BUG]抖音 解析成功后获取回来的视频无法播放，提示403 Forbidden**
  *Symptoms*: ***发生错误的平台？***  如：抖音  ***发生错误的端点？***  如：Web APP  短视频链接：  https://v.douyin.com/LxPGNRIZBiA/    ***是否有再次尝试？***  是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。  问题是：能够正常解析分享链接，获取到返回得短视频信息，其中有返回video_addr里有3个视频链接，第一个url打开会显示403，后面两个是正常的。目前 web app应该取的是第一个；  另外/api/download 接口返回： <html> <body> <!--StartFragment--> Response bodyDownload{   "code": 400,   "message": "'NoneType' object has no attribute 'get'",   "support": "Please contact us on Github: https://github.com/Evil0ctal/Douyin_TikTok_Download_API",   "time": "2026-04-27 11:02:43",   "router": "/api/download",   "params": {     "url": "https://v.douyin.com/e4J8Q7A/ ",     "prefix": "true",     "with_watermark": "false"   } } --   <!--EndFragment--> </body> </html>  <img width="2486" height="1322" alt="Image" src="https://github.com/user-attachments/assets/6df9a138-bb73-4dd0-bd2e-6e755b357148" /> 
  **Post-Mortem & Fix Analysis**:
  > 403都不知道什么原因还是趁早去打游戏吧
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #719** (2026-09-10): **[BUG]抖音 解析成功后获取回来的视频无法播放，提示403 Forbidden**
  *Symptoms*: ***发生错误的平台？***  如：抖音  ***发生错误的端点？***  如：Web APP  短视频链接：  https://v.douyin.com/LxPGNRIZBiA/    ***是否有再次尝试？***  是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。  <img width="2486" height="1322" alt="Image" src="https://github.com/user-attachments/assets/6df9a138-bb73-4dd0-bd2e-6e755b357148" /> 
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #718** (2026-09-10): **[BUG] 简短明了的描述问题**
  *Symptoms*: ***发生错误的平台？***  抖音/  ***发生错误的端点？***  利用你的release的pyton  ***提交的输入值？***  如：短视频链接  ***是否有再次尝试？***  如：是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。   D:\tools\Douyin_TikTok_Download_API-4.1.2>python start.py Traceback (most recent call last):   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\start.py", line 37, in <module>     from app.main import Host_IP, Host_Port   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\app\main.py", line 39, in <module>     from app.api.router import router as api_router   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\app\api\router.py", line 2, in <module>     from app.api.endpoints import (   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\app\api\endpoints\tiktok_web.py", line 7, in <module>     from crawlers.tiktok.web.web_crawler import TikTokWebCrawler  # 导入TikTokWebCrawler类     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\web_crawler.py", line 55, in <module>     from crawlers.tiktok.web.models import (   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\models.py", line 10, in <module>     class BaseRequestModel(BaseModel):   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\models.py", line 44, in BaseRequestModel     msToken: str = TokenManager.gen_real_msToken()                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\utils.py", line 
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

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

### Incident Patch 1: `f4f938b6` (2026-09-28)
**Commit Message**: Merge branch 'fix/issue-766-notice'

**File**: `NOTICE` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+Douyin_TikTok_Download_API
+Copyright 2021-2026 Evil0ctal and contributors
+
+Licensed under the Apache License, Version 2.0. The full text is in the
+LICENSE file next to this one.
+
+https://github.com/Evil0ctal/Douyin_TikTok_Download_API
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -538,7 +538,8 @@ would otherwise have to ask you.
 You may use, modify and distribute this project, **including commercially and inside
 closed-source products**. The grant is irrevocable. In return the licence asks you to:
 
-- Keep the copyright notice and the licence text with any copy you distribute
+- Keep the licence text and the [NOTICE](./NOTICE) file, which carries the copyright
+  notice, with any copy you distribute
 - State what you changed, in files you modified
 - Accept that it comes with no warranty
 
```

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -495,7 +495,7 @@ English documentation: [`documents/README.md`](./documents/README.md)
 你可以使用、修改、分发本项目，**包括商业用途，也包括放进闭源产品**。这项授权不可撤销。
 作为交换，协议要求你：
 
-- 分发副本时保留版权声明和协议全文
+- 分发副本时保留协议全文和 [NOTICE](./NOTICE) 文件（版权声明就在里面）
 - 在你改动过的文件里说明改了什么
 - 接受它不提供任何担保
 
```

---

### Incident Patch 2: `2b74f33b` (2026-09-28)
**Commit Message**: fix(security): resolve and pin a caller-supplied proxy in public mode

GHSA-q3h8-73xx-gwqx. In security.request_proxy=public the proxy host was
judged by its text alone, so any name pointing at an internal address was
accepted - 127-0-0-1.sslip.io as reported, or any domain with such an A
record.

- vet() resolves the host, refuses the proxy if any answer is non-global,
  and hands on the address it checked so nothing downstream resolves the
  name again. https proxies keep their name; certificate verification
  covers them. An unresolvable or slow name is refused (host_unresolvable).
- normalize() refuses an authority with characters outside RFC 3986
  (authority_invalid), so the host checked is the host the client dials.
- is_private_host() also recognises hyphen-spelled non-global addresses,
  giving an early, honest refusal to every caller of it.

**File**: `documents/en/11-api.md` (modified, +2/-2)
```diff
@@ -481,9 +481,9 @@ See [Identities and proxies](./06-identities-and-proxies.md).
 Sends the upstream request through an egress **you** supply, replacing the identity's own exit.
 
 - Refused unless an administrator sets `security.request_proxy` to `public` or `any`. The default is `deny`, and an unrecognised value is treated as `deny` — a typo in configuration must not be the thing that opens a network.
-- `public` accepts only publicly routable destinations; `any` accepts loopback and private ranges too and is only coherent when every API key holder is already trusted with the network the instance runs in.
+- `public` accepts only publicly routable destinations. A proxy given by name is resolved, every address it answers with must be public, and the request is dialled at the address that was checked rather than at the name — so `http://proxy.example.com:8080` is sent on as `http://<its address>:8080`. An `https` proxy keeps its name, because its certificate is verified against it. `any` accepts loopback and private ranges too and is only coherent when every API key holder is already trusted with the network the instance runs in.
 - Schemes: `http`, `https`, `socks5`, `socks5h`. Maximum 512 characters. Give it as a full URL, e.g. `http://host:port`.
-- A refusal is `INVALID_PARAM` with `details.reason` — one of `request_proxy_disabled`, `too_long`, `scheme_missing`, `scheme_not_supported`, `host_missing`, `port_invalid`, `host_not_public`. The value you sent is never echoed back or logged, because a rejected proxy URL is exactly when someone has pasted a real credential.
+- A refusal is `INVALID_PARAM` with `details.reason` — one of `request_proxy_disabled`, `too_long`, `scheme_missing`, `scheme_not_supported`, `authority_invalid`, `host_missing`, `port_invalid`, `host_not_public`, `host_unresolvable`. The value you sent is never echoed back or logged, because a rejected proxy URL is exactly when someone has pasted a real credential.
 - A disabled feature **refuses** rather than ignores. Silently dropping the parameter would send the request from the instance's own address while you believed it went through your proxy.
 
 The cost is real and is not a free option: the identity's cookies were minted behind one address and would now be presented from another, which is an incoherence the platforms can see. Two callers asking for the same post through different proxies are not asking the same question and are never coalesced.
```

**File**: `documents/en/15-security.md` (modified, +10/-1)
```diff
@@ -357,7 +357,7 @@ forgery in its plainest form.
 would already trust with the network the instance runs in. It is the largest
 single widening available in the settings table.
 
-Three details of the implementation are deliberate:
+Four details of the implementation are deliberate:
 
 - **A disabled feature refuses rather than ignores.** Silently dropping the
   parameter would send the request from the instance's own address while the
@@ -368,6 +368,15 @@ Three details of the implementation are deliberate:
 - **The value is never echoed back or logged.** A proxy URL carries
   credentials, and a rejected request is exactly when somebody is most likely to
   have pasted a real one. Only the scheme and the mode are logged.
+- **In `public` mode the name is resolved and the address pinned.** The text of
+  a hostname proves nothing about where it leads: `127-0-0-1.sslip.io`, or any
+  domain whose owner points it at `127.0.0.1`, is a public-looking name for
+  loopback. So every address the name resolves to must be public, and the
+  request is dialled at the address that was checked rather than at the name —
+  a second lookup never happens, so it cannot answer differently. An `https`
+  proxy keeps its name, because its TLS certificate is verified against it and
+  an address the name was rebound to cannot produce one. A name that does not
+  resolve within five seconds is refused with `host_unresolvable`.
 
 Accepted values are at most 512 characters and must use `http`, `https`,
 `socks5` or `socks5h`.
```

**File**: `documents/zh/11-api.md` (modified, +2/-2)
```diff
@@ -480,9 +480,9 @@ curl -sS "$DTK_BASE_URL/api/v1/parse?lang=zh" -X POST \
 让上游请求走**你**提供的出口，替换掉该身份自己的出口。
 
 - 除非管理员把 `security.request_proxy` 设为 `public` 或 `any`，否则一律拒绝。默认是 `deny`，而且无法识别的值也按 `deny` 处理——配置里的一个笔误不该成为打开网络的那件事。
-- `public` 只接受公网可路由的目的地；`any` 连回环和私有网段也接受，只有在每一个持有 API key 的人都已经被信任可以访问该实例所在网络时才说得通。
+- `public` 只接受公网可路由的目的地。以域名给出的代理会先被解析，解析出的每一个地址都必须是公网地址，之后请求拨向的是通过检查的那个地址而不是域名——所以 `http://proxy.example.com:8080` 往下传时会变成 `http://<它的地址>:8080`。`https` 代理保留域名，因为它的证书要按域名校验。`any` 连回环和私有网段也接受，只有在每一个持有 API key 的人都已经被信任可以访问该实例所在网络时才说得通。
 - 协议：`http`、`https`、`socks5`、`socks5h`。最长 512 字符。请写成完整 URL，例如 `http://host:port`。
-- 拒绝时返回 `INVALID_PARAM`，`details.reason` 是 `request_proxy_disabled`、`too_long`、`scheme_missing`、`scheme_not_supported`、`host_missing`、`port_invalid`、`host_not_public` 之一。你发的值永远不会被回显或写日志，因为一个被拒的代理 URL 恰恰是最可能刚粘贴了真实凭据的时刻。
+- 拒绝时返回 `INVALID_PARAM`，`details.reason` 是 `request_proxy_disabled`、`too_long`、`scheme_missing`、`scheme_not_supported`、`authority_invalid`、`host_missing`、`port_invalid`、`host_not_public`、`host_unresolvable` 之一。你发的值永远不会被回显或写日志，因为一个被拒的代理 URL 恰恰是最可能刚粘贴了真实凭据的时刻。
 - 功能被关闭时是**拒绝**而不是忽略。悄悄丢掉这个参数，会让请求从实例自己的地址发出去，而你以为它走了你的代理。
 
 代价是真实存在的，不是白送的选项：这个身份的 cookie 是在某个地址后面签发的，现在却从另一个地址出示，这正是平台看得见的那种自相矛盾。两个通过不同代理请求同一条作品的调用方，问的不是同一个问题，所以永远不会被合并。
```

**File**: `documents/zh/15-security.md` (modified, +2/-1)
```diff
@@ -253,11 +253,12 @@ curl -s -D - -o /dev/null http://127.0.0.1:8000/healthz
 
 只有当实例上的每一把 API 密钥都握在“你本来就愿意让他接触这台机器所在网络”的人手里时，`any` 才是自洽的。它是整张配置表里能做出的最大一次放宽。
 
-实现上有三个细节是刻意的：
+实现上有四个细节是刻意的：
 
 - **被禁用的功能是拒绝，而不是忽略。** 悄悄丢掉这个参数，会让请求从实例自己的地址发出去，而调用方以为它走了自己的代理——这比报错更糟，因为他只能从对端才发现。
 - **无法识别的配置值按 `deny` 处理。** 运维配置里的一个笔误，绝不能成为打开他们内网的那个东西。
 - **这个值从不回显，也从不写日志。** 代理 URL 里带着凭据，而请求被拒的那一刻，恰恰是人最可能刚粘了一个真值的时候。只有 scheme 和当前模式会被记录。
+- **`public` 模式下会解析域名并钉住地址。** 主机名的字面内容说明不了它指向哪里：`127-0-0-1.sslip.io`，或者任何被主人指向 `127.0.0.1` 的域名，都是一个看起来像公网的回环地址。所以域名解析出的每一个地址都必须是公网地址，而请求拨向的是通过检查的那个地址而不是域名——第二次解析根本不会发生，也就不可能得到不同的答案。`https` 代理保留域名，因为它的 TLS 证书按域名校验，被重绑定到的地址拿不出这张证书。五秒内解析不出来的域名以 `host_unresolvable` 拒绝。
 
 被接受的值最长 512 个字符，scheme 必须是 `http`、`https`、`socks5` 或 `socks5h`。
 
```

**File**: `src/dtk/api/request_proxy.py` (modified, +150/-15)
```diff
@@ -18,21 +18,30 @@
 feature opts in with ``security.request_proxy``, and the middle setting - the
 one to actually use - keeps the caller on publicly routable addresses.
 
-What this module does NOT do is resolve DNS. A name that resolves to a private
-address today can resolve elsewhere between this check and the connection, so a
-lookup here would buy a false sense of safety at the cost of a network call in a
-request path; :func:`dtk.urls.is_private_host` takes the same position for the
-same reason. The literal forms that exist only to evade string matching -
-decimal, hex, IPv4-mapped IPv6, trailing dots - are what it does catch, and it
-catches them by refusing anything that is not globally routable rather than by
-listing what is bad.
+In that mode the host is resolved, every answer is checked, and the URL handed
+on names the address that passed rather than the name. This module used to
+refuse to resolve at all, on the grounds that a name can point elsewhere between
+the check and the connection. The conclusion did not follow from the reason:
+checking only the text left every name that simply points inside wide open, and
+GHSA-q3h8-73xx-gwqx walked through with ``127-0-0-1.sslip.io`` - no race, just
+a public DNS service that answers with the address the name spells. The race is
+real, and pinning is what closes it: the worker, the browser service and anything
+else downstream dial the literal that was checked and never look the name up
+again. The literal forms that exist only to evade string matching - decimal,
+hex, IPv4-mapped IPv6, trailing dots - are still refused before any lookup, by
+refusing anything not globally routable rather than by listing what is bad.
 """
 
 from __future__ import annotations
 
+import asyncio
+import ipaddress
+import re
+import socket
+from collections.abc import Awaitable, Callable, Sequence
 from enum import StrEnum
 from typing import Final
-from urllib.parse import urlsplit
+from urllib.parse import SplitResult, urlsplit, urlunsplit
 
 from dtk.core.errors import DtkError, InvalidParam
 from dtk.core.logging import get_logger
@@ -49,6 +58,19 @@
 #: is someone probing the parser.
 MAX_LENGTH: Final = 512
 
+#: What RFC 3986 allows in an authority: unreserved, sub-delims, percent
+#: escapes, and the ":", "@" and brackets that give it structure.
+AUTHORITY_RE: Final = re.compile(r"[A-Za-z0-9\-._~!$&'()*+,;=%:@\[\]]+")
+
+#: How long the proxy's name gets to resolve. The lookup holds an API request
+#: open, and a proxy whose own name does not answer is not going to carry
+#: traffic either, so a slow one is refused rather than waited on.
+RESOLVE_TIMEOUT_SECONDS: Final = 5.0
+
+#: Looks a host up and returns every address it answers with. Injected so the
+#: tests decide what a name resolves to without touching the network.
+Resolver = Callable[[str], Awaitable[Sequence[str]]]
+
 
 class RequestProxyMode(StrEnum):
     """What ``security.request_proxy`` may be set to.
@@ -82,10 +104,12 @@ def _reject(reason: str, detail: str) -> DtkError:
 
 
 def normalize(value: str | None, *, mode: RequestProxyMode) -> str | None:
-    """Validate a caller-supplied proxy, or explain why it cannot be used.
+    """Judge the text of a caller-supplied proxy, or explain why it cannot be used.
 
-    Returns the URL to dial, or None when the caller supplied nothing. Never
-    returns a value the current mode does not permit.
+    Returns the URL as given, or None when the caller supplied nothing. This
+    is the offline half: it cannot tell where a name leads, so in ``public``
+    mode its answer is not yet safe to dial. Routes call :func:`vet`, which
+    finishes the job.
 
     A disabled feature REFUSES rather than ignores. Silently dropping the
     parameter would send the request from the instance's own address while the
@@ -120,6 +144,18 @@ def normalize(value: str | None, *, mode: RequestProxyMode) -> str | None:
             f"proxy scheme must be one of {', '.join(sorted(ALLOWED_SCHE
```

---

### Incident Patch 3: `b62543d9` (2026-09-23)
**Commit Message**: fix(setup): only one request may claim the setup token

setup_init read the token, compared it, and deleted it later, with
awaits in between. Two concurrent requests holding the real token could
both read it before either deleted it, and each went on to create an
administrator. The docstring claimed the opposite.

Deleting the token is now the claim: DEL reports whether it removed the
key, so only one caller proceeds and the other gets SETUP_ALREADY_DONE.

GETDEL on the read (as proposed in #761) would also close the race, but
it consumes the token on a wrong guess too, which lets anyone who can
reach the port stop the owner from ever finishing setup. A test pins
that down, and the race test holds both requests at a barrier after the
read, because left to the event loop they rarely overlap and the test
passed against the racy code.

Exploiting the race needs the token from the container log, so it never
let an outsider in; it let the token holder mint a second admin.

**File**: `src/dtk/api/routes/setup.py` (modified, +13/-4)
```diff
@@ -161,7 +161,8 @@ async def setup_init(request: Request, body: SetupInit) -> Any:
 
     Ordering matters. The account check comes first so an initialized instance
     answers 409 without ever looking at the token; the token is deleted the
-    moment it verifies, so two racing requests cannot both succeed.
+    moment it verifies, and whichever request's DELETE actually removed it is
+    the one that goes on, so two racing requests cannot both succeed.
     """
     session = request.state.db
     users = UserRepository(session)
@@ -187,9 +188,17 @@ async def setup_init(request: Request, body: SetupInit) -> Any:
             details={"attempts_remaining": remaining},
         )
 
-    # Single use: burn it before the account is written, so a second request
-    # holding the same token finds nothing to match against.
-    await redis.delete(SETUP_TOKEN_KEY, SETUP_ATTEMPTS_KEY)
+    # Single use, and deleting it is the claim. Two requests holding the real
+    # token can both get past the read above before either reaches this line,
+    # and both used to go on to create an administrator. DEL reports whether it
+    # removed the key, and only one caller can be the one that did.
+    #
+    # Not GETDEL on the read: that would close the race too, but it burns the
+    # token on a wrong guess as well, which lets anyone who can reach the port
+    # keep the owner from ever finishing setup.
+    if not await redis.delete(SETUP_TOKEN_KEY):
+        raise SetupAlreadyDone("this instance already has an administrator account")
+    await redis.delete(SETUP_ATTEMPTS_KEY)
 
     user = await users.create(
         username=body.username,
```

**File**: `tests/integration/test_api_setup.py` (modified, +77/-0)
```diff
@@ -7,12 +7,15 @@
 
 from __future__ import annotations
 
+import asyncio
 from typing import Any
 
 import pytest
 
 from dtk.api.routes import setup
+from dtk.core.db import session_scope
 from dtk.core.redis import get_redis
+from dtk.db.repositories import UserRepository
 from tests.integration import test_api_support as support
 from tests.integration.test_api_support import (
     envelope,
@@ -91,6 +94,80 @@ async def test_wrong_token_is_rejected_and_leaves_the_instance_open(client: Any)
     assert envelope(status)["data"] == {"initialized": False}
 
 
+class BothReadFirst:
+    """Redis, except that no GET returns until two of them have been issued.
+
+    Left to the event loop the two requests usually do not overlap at all - the
+    first has deleted the token before the second reads it - so a test without
+    this passes against the racy code too. This holds both at the one point
+    where the race lives: after the read, before anything is written.
+    """
+
+    def __init__(self, redis: Any) -> None:
+        self._redis = redis
+        self._barrier = asyncio.Barrier(2)
+
+    async def get(self, key: str) -> Any:
+        value = await self._redis.get(key)
+        await self._barrier.wait()
+        return value
+
+    def __getattr__(self, name: str) -> Any:
+        return getattr(self._redis, name)
+
+
+async def test_racing_requests_with_the_real_token_create_one_administrator(
+    client: Any, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """Only one of two concurrent requests holding the token may win.
+
+    The token used to be read, compared, and only then deleted, with awaits in
+    between, so two requests could both read it before either deleted it and
+    both create an administrator. Deleting it is now the claim: DEL reports
+    whether it removed the key, and only one caller can be the one that did.
+    """
+    token = await issue_token()
+    racing = BothReadFirst(get_redis())
+    monkeypatch.setattr(setup, "get_redis", lambda: racing)
+
+    responses = await asyncio.gather(
+        *(
+            client.post(
+                "/api/setup/init",
+                json={"token": token, "username": name, "password": "a-good-password"},
+            )
+            for name in ("first", "second")
+        )
+    )
+
+    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]
+    loser = next(r for r in responses if r.status_code == 409)
+    assert error_code(loser) == "SETUP_ALREADY_DONE"
+    async with session_scope() as session:
+        assert await UserRepository(session).count() == 1
+
+
+async def test_a_wrong_token_does_not_burn_the_real_one(client: Any) -> None:
+    """A wrong guess costs an attempt, never the token itself.
+
+    Consuming the token on every read (GETDEL) would close the race above too,
+    but it would let anyone who can reach the port stop the owner from ever
+    finishing setup, one bad request per restart.
+    """
+    token = await issue_token()
+    wrong = await client.post(
+        "/api/setup/init",
+        json={"token": "not-the-token", "username": "owner", "password": "a-good-password"},
+    )
+    assert wrong.status_code == 403
+
+    right = await client.post(
+        "/api/setup/init",
+        json={"token": token, "username": "owner", "password": "a-good-password"},
+    )
+    assert right.status_code == 201, right.text
+
+
 async def test_five_failures_invalidate_the_token(client: Any) -> None:
     token = await issue_token()
     for _ in range(setup.MAX_SETUP_ATTEMPTS):
```

---

### Incident Patch 4: `dde93b6d` (2026-09-14)
**Commit Message**: fix(tiktok): refuse a page size TikTok will not serve

Reported by @BennoCrafter while testing #753: collections came back capped
at 35 however large a count he asked for. Chased it and it is neither
his account nor that endpoint - TikTok refuses more than 35 across its
item_list family. Measured with a guest identity, no cookies, on two
different authors:

    author_posts  count=35  ->  a full page, hasMore true
    author_posts  count=36  ->  refused
    author_posts  count=50  ->  refused
    author_likes  count=36  ->  refused
    douyin posts  count=50  ->  served, 43 items

We advertised 50 for both. So `?count=40` on TikTok reached the platform
and came back as NOT_FOUND - and that is the expensive half. The refusal
is not shaped like an error; it classifies as an ordinary absence, so the
caller is told the author has no posts. That is precisely the misreading
tests/unit/test_absence_matrix.py exists to prevent, reached from the
request side rather than the response side, and no amount of care in the
parser can catch it because the mistake was made before the call.

dtk.platforms.paging holds the measured ceiling per platform, the way
media/domains.py holds the CDN allowlis

**File**: `src/dtk/api/routes/content.py` (modified, +53/-8)
```diff
@@ -52,6 +52,7 @@
 from dtk.core.logging import get_logger
 from dtk.core.types import Platform, Scope
 from dtk.i18n.messages import render_error
+from dtk.platforms.paging import max_page_size
 from dtk.urls import ResourceKind, UrlKind, first_url, identify, require_content_id
 from dtk.worker import registry
 
@@ -69,7 +70,21 @@
         "Hold the connection until the task finishes, up to this many seconds - this is how to make the call synchronous. Finished in time gives 200 with the result; not finished gives 202 with the task id and `state: running`, which is not an error and loses nothing. Above the instance ceiling shown as `maximum` it is a 400, rejected rather than shortened. Omitted or 0 returns 202 at once. See the description at the top of this document."
     ),
 )
-COUNT_QUERY = Query(default=None, ge=1, le=MAX_PAGE_SIZE, description="Items per page.")
+COUNT_QUERY = Query(
+    default=None,
+    ge=1,
+    le=MAX_PAGE_SIZE,
+    # `le` is this project's ceiling and the only one OpenAPI can state,
+    # because the platform is a path parameter and the real limit differs
+    # between them. TikTok refuses more than 35 - see dtk.platforms.paging -
+    # so the route checks again and answers 400 rather than letting the call
+    # go upstream to be read back as "this author has nothing".
+    description=(
+        "Items per page. The ceiling depends on the platform: Douyin serves up to 50, "
+        "TikTok refuses more than 35. Above it this is a 400 naming the maximum, "
+        "rejected rather than shortened."
+    ),
+)
 CURSOR_QUERY = Query(
     default=None,
     max_length=512,
@@ -509,7 +524,13 @@ async def comments(
     """
     authorize(principal, platform)
     params = _content_params(platform, url=url, aweme_id=aweme_id)
-    params.update({"cursor": cursor, "count": resolve_count(count), "include_raw": include_raw})
+    params.update(
+        {
+            "cursor": cursor,
+            "count": resolve_count(count, maximum=max_page_size(platform)),
+            "include_raw": include_raw,
+        }
+    )
     return await operations.submit_and_wait(
         request,
         principal,
@@ -582,7 +603,7 @@ async def comment_replies(
         {
             "comment_id": comment_id,
             "cursor": cursor,
-            "count": resolve_count(count),
+            "count": resolve_count(count, maximum=max_page_size(platform)),
             "include_raw": include_raw,
         }
     )
@@ -712,7 +733,13 @@ async def user_posts(
     """
     authorize(principal, platform)
     params = _author_params(platform, url=url, sec_user_id=sec_user_id)
-    params.update({"cursor": cursor, "count": resolve_count(count), "include_raw": include_raw})
+    params.update(
+        {
+            "cursor": cursor,
+            "count": resolve_count(count, maximum=max_page_size(platform)),
+            "include_raw": include_raw,
+        }
+    )
     return await operations.submit_and_wait(
         request,
         principal,
@@ -783,7 +810,13 @@ async def user_likes(
     """
     authorize(principal, platform)
     params = _author_params(platform, url=url, sec_user_id=sec_user_id)
-    params.update({"cursor": cursor, "count": resolve_count(count), "include_raw": include_raw})
+    params.update(
+        {
+            "cursor": cursor,
+            "count": resolve_count(count, maximum=max_page_size(platform)),
+            "include_raw": include_raw,
+        }
+    )
     return await operations.submit_and_wait(
         request,
         principal,
@@ -920,7 +953,7 @@ async def mix_posts(
         params={
             "mix_id": mix_id,
             "cursor": cursor,
-            "count": resolve_count(count),
+            "count": resolve_count(count, maximum=max_page_size(platform)),
             "include_raw": include_raw,
         },
         wait=resolve_wait(request, wait),
@@ -985,7 +1018,13 @@ async def user_followers(
     authorize(principal, platform)
     endpoint = supp
```

**File**: `src/dtk/api/routes/support.py` (modified, +18/-2)
```diff
@@ -282,11 +282,27 @@ def resolve_wait(request: Request, requested: float | None) -> float:
 def resolve_count(
     value: int | None, *, default: int = DEFAULT_PAGE_SIZE, maximum: int = MAX_PAGE_SIZE
 ) -> int:
+    """Vet a caller's page size against the ceiling that actually applies.
+
+    Rejected rather than shortened, which is the same choice `wait` makes and
+    for the same reason: a caller who asked for fifty and silently received
+    thirty-five has no way to tell that from an author who only had
+    thirty-five, and the second page they never ask for is the one with the
+    rest of the data in it.
+
+    `maximum` is the *platform's* limit where one is known - see
+    :mod:`dtk.platforms.paging` - not this project's own.
+    """
     if value is None:
-        return default
+        return min(default, maximum)
     if value < 1:
         raise InvalidParam("count must be at least 1", details={"field": "count"})
-    return min(value, maximum)
+    if value > maximum:
+        raise InvalidParam(
+            f"count must be at most {maximum} for this platform",
+            details={"field": "count", "value": value, "maximum": maximum},
+        )
+    return value
 
 
 def resolve_request_proxy(request: Request, value: str | None) -> str | None:
```

**File**: `src/dtk/i18n/locales/en.json` (modified, +1/-1)
```diff
@@ -587,7 +587,7 @@
       "comment_id": "The parent comment whose replies you want. Ids come from the comments endpoint.",
       "confirm": "Required for settings flagged as disruptive.",
       "content_id": "The post id.",
-      "count": "Items per page.",
+      "count": "Items per page. The ceiling depends on the platform: Douyin serves up to 50, TikTok refuses more than 35. Above it this is a 400 naming the maximum, rejected rather than shortened.",
       "cursor": "Opaque cursor from the previous page; omit for the first page.",
       "download_id": "The download id returned when it was started.",
       "duration_bucket": "Only posts in this length class.",
```

**File**: `src/dtk/i18n/locales/zh.json` (modified, +1/-1)
```diff
@@ -587,7 +587,7 @@
       "comment_id": "要查询回复的父评论 ID，可从评论接口的返回中获得。",
       "confirm": "对标记为「有破坏性」的配置项必须显式确认。",
       "content_id": "作品 ID。",
-      "count": "每页条数。",
+      "count": "每页条数。上限随平台不同：抖音最多 50，TikTok 超过 35 就会拒绝。超出时返回 400 并说明上限——拒绝，而不是悄悄截短。",
       "cursor": "上一页返回的游标，首页请留空。",
       "download_id": "发起下载时返回的下载 ID。",
       "duration_bucket": "仅返回该时长区间的作品。",
```

**File**: `src/dtk/platforms/paging.py` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+"""How large a page each platform will actually serve.
+
+Separate from :data:`dtk.api.routes.support.MAX_PAGE_SIZE`, which is this
+project's own ceiling - "a caller that wants everything at once is a caller to
+slow down". This module records the *platform's* ceiling, which is a measured
+fact about somebody else's service and is not the same number.
+
+Measured 2026-09-13 against the live endpoints with a guest identity, on two
+different authors, through ``tiktok.author_posts`` and ``tiktok.author_likes``:
+
+    count=35  ->  a full page, `hasMore` true
+    count=36  ->  refused
+    count=50  ->  refused
+
+Douyin served 50 from the same harness and was not measured above it, because
+this project refuses more than 50 anyway.
+
+Why this matters more than an off-by-one: TikTok's refusal is not an error
+shaped like one. It classifies as an ordinary absence, so a caller who asks for
+36 is told the author has no posts - which is the misreading
+``tests/unit/test_absence_matrix.py`` exists to prevent, arrived at from the
+request side instead of the response side. Refusing the parameter here means
+the call is never made.
+
+Found by @BennoCrafter while testing #753; the general case - that it is the
+platform's limit rather than one endpoint's - was established afterwards.
+"""
+
+from __future__ import annotations
+
+from collections.abc import Mapping
+from types import MappingProxyType
+from typing import Final
+
+from dtk.core.types import Platform
+
+#: The largest ``count`` each platform answers rather than refuses.
+MAX_PAGE_SIZE: Final[Mapping[Platform, int]] = MappingProxyType(
+    {
+        Platform.DOUYIN: 50,
+        Platform.TIKTOK: 35,
+    }
+)
+
+
+def max_page_size(platform: Platform) -> int:
+    """The page-size ceiling for ``platform``.
+
+    Every platform must appear in the table; a new one that forgets is caught by
+    ``tests/unit/test_paging.py`` rather than silently inheriting a number
+    measured against a different service.
+    """
+    return MAX_PAGE_SIZE[platform]
+
+
+__all__ = ["MAX_PAGE_SIZE", "max_page_size"]
```

---

### Incident Patch 5: `19eb4971` (2026-09-11)
**Commit Message**: fix(tiktok): read the id from what fetch returns, not from what it parsed

Third attempt at the same lookup, and the first two failed for the same
underlying reason: I did not know what `FetchService.fetch` hands back.

It parses the upstream body, serialises the model, caches the serialised
form and returns *that* - on both paths. So the author is a dict with a
`sec_uid` key, and neither of the things I tried was that. Collecting the
model through the `parse` callback worked only on a cache miss, because a
hit returns the stored payload without calling it. Re-parsing
`result.payload` as if it were an upstream body raised UpstreamChanged
every time, which the silent fallback then swallowed into the original
refusal.

Both of those shipped looking correct. The first passed its test and
worked in production for as long as the cache was cold - about a minute.

The test double was the reason. It answered with the raw fixture, which
`fetch` never returns, so it could not fail the way production does.
`_tiktok_profile_payload` now derives its answer the way `fetch` does -
real parser, real `_dump` - and cannot drift from it. Checked that both
tests fail when the source goes back to readi

**File**: `src/dtk/worker/main.py` (modified, +9/-7)
```diff
@@ -645,12 +645,6 @@ async def _resolve_author_handle(
                         is_demo=run.is_demo,
                     ),
                 )
-            # Parsed from what came back, not collected from the `parse`
-            # callback. A cache hit returns the stored payload and never calls
-            # it, so a callback-collected author was present on the first
-            # lookup of a handle and absent on every one after - which is a
-            # failure that gets better when you stop looking at it.
-            author = lookup.parse(result.payload)
         except DtkError as exc:
             log.info(
                 "worker.author_handle.lookup_failed",
@@ -660,7 +654,15 @@ async def _resolve_author_handle(
             )
             return params
 
-        sec_uid = getattr(author, "sec_uid", None)
+        # `FetchResult.payload` is the *dumped* model, not the upstream body -
+        # `fetch` parses, serialises, caches the serialised form and returns
+        # that, on both paths. So the id is a key here, and reading it this way
+        # is the only version that survives a cache hit: the `parse` callback
+        # fires on a miss and never on a hit, and re-parsing the payload as if
+        # it were an upstream response raises UpstreamChanged. Both of those
+        # were tried, in that order, and the first looked like it worked for
+        # exactly as long as the cache was cold.
+        sec_uid = result.payload.get("sec_uid") if isinstance(result.payload, dict) else None
         if not isinstance(sec_uid, str) or not sec_uid:
             log.info("worker.author_handle.no_id", endpoint=endpoint, handle=handle)
             return params
```

**File**: `tests/unit/test_worker.py` (modified, +15/-8)
```diff
@@ -35,7 +35,7 @@
 from dtk.ops import webhooks
 from dtk.platforms import get_adapter
 from dtk.platforms.tiktok.params import DEVICE_ID_DIGITS
-from dtk.services.fetch import Explanation, FetchResult
+from dtk.services.fetch import Explanation, FetchResult, _dump
 from dtk.services.tasks import TaskView
 from dtk.worker import maintenance as maintenance_module
 from dtk.worker import registry
@@ -1757,7 +1757,17 @@ async def never(*_args: Any, **_kwargs: Any) -> Any:  # pragma: no cover
 
 
 def _tiktok_profile_payload() -> dict[str, Any]:
-    return json.loads(_PROFILE_FIXTURE.read_text(encoding="utf-8"))
+    """What `FetchService.fetch` actually hands back for a profile lookup.
+
+    Derived rather than hand-written, and that is the point. `fetch` parses the
+    upstream body, serialises the model, caches the serialised form and returns
+    *that* - on both the fresh and the cached path. A double that answered with
+    the raw upstream body instead is a double that cannot fail the way
+    production does, which is how the first two attempts at this lookup passed
+    their tests and did not work.
+    """
+    upstream = json.loads(_PROFILE_FIXTURE.read_text(encoding="utf-8"))
+    return _dump(get_adapter("tiktok").parse_author(upstream), include_raw=False)
 
 
 async def test_a_tiktok_handle_is_resolved_before_the_call_that_cannot_use_it() -> None:
@@ -1768,10 +1778,7 @@ async def test_a_tiktok_handle_is_resolved_before_the_call_that_cannot_use_it()
     first - advice that led nowhere, because the profile it would have returned
     carried no usable id either. Now the worker does the lookup itself.
     """
-    # Both set: a fresh fetch returns the payload *and* runs the callback. The
-    # cache-hit case, which only returns the payload, is the test below.
-    payload = _tiktok_profile_payload()
-    fetch = FakeFetch(payload=payload, parse_payload=payload)
+    fetch = FakeFetch(payload=_tiktok_profile_payload())
     worker, _ = make_worker(FakeStore(), fetch)
     run = a_run("tiktok.author_posts", sec_user_id="owlcitymusic")
 
@@ -1794,8 +1801,8 @@ async def test_a_cached_profile_still_yields_the_id() -> None:
     shipped in 5.0.2 appeared to work when it was tested and not when it was
     used.
     """
-    # payload set, parse_payload left None: FakeFetch answers without ever
-    # invoking the callback, which is exactly what a cache hit does.
+    # `parse_payload` left None, so the double never invokes the callback -
+    # which is exactly what a cache hit does.
     fetch = FakeFetch(payload=_tiktok_profile_payload())
     worker, _ = make_worker(FakeStore(), fetch)
     run = a_run("tiktok.author_posts", sec_user_id="owlcitymusic")
```

---

### Incident Patch 6: `bbd08152` (2026-09-11)
**Commit Message**: fix(tiktok): the handle lookup gave up whenever its answer was cached

The 5.0.2 fix worked when I tested it and stopped working once I had used
it, which is the shape of a bug that is better at hiding than at
happening.

`FetchService.fetch` answers a cache hit straight from storage and never
calls the `parse` callback. The lookup collected its author through that
callback, so the very first resolution of a handle succeeded - cold cache,
real fetch, callback runs - and every one inside the next fifteen minutes
found an empty list and gave up. Giving up is silent by design there: it
leaves the original refusal standing rather than replacing it with an
error about a call the caller never made. So the failure was a return to
exactly the message it was supposed to remove, with nothing in the log
and no upstream request to notice.

It parses `result.payload` now, which is populated either way.

Two log lines were missing for the same reason I could not see this from
the outside: the no-id branch said nothing at all, and the resolved line
now carries `cached` so the two paths are distinguishable in a log.

The regression test is the cache-hit shape specifically - payload set,
callback n

**File**: `src/dtk/worker/main.py` (modified, +16/-11)
```diff
@@ -626,21 +626,14 @@ async def _resolve_author_handle(
         handle = value.lstrip("@")
         lookup = registry.resolve(profile_endpoint, {registry.UNIQUE_ID: handle}, self._config())
 
-        found: list[Any] = []
-
-        def parse(payload: dict[str, Any]) -> Any:
-            model = lookup.parse(payload)
-            found.append(model)
-            return model
-
         try:
             async with self._session_factory() as session:
-                await self._fetch.fetch(
+                result = await self._fetch.fetch(
                     session,
                     lookup.platform,
                     lookup.endpoint,
                     lookup.params,
-                    parse=parse,
+                    parse=lookup.parse,
                     cache_ttl=lookup.cache_ttl,
                     ctx=FetchContext(
                         task_id=run.id,
@@ -652,6 +645,12 @@ def parse(payload: dict[str, Any]) -> Any:
                         is_demo=run.is_demo,
                     ),
                 )
+            # Parsed from what came back, not collected from the `parse`
+            # callback. A cache hit returns the stored payload and never calls
+            # it, so a callback-collected author was present on the first
+            # lookup of a handle and absent on every one after - which is a
+            # failure that gets better when you stop looking at it.
+            author = lookup.parse(result.payload)
         except DtkError as exc:
             log.info(
                 "worker.author_handle.lookup_failed",
@@ -661,11 +660,17 @@ def parse(payload: dict[str, Any]) -> Any:
             )
             return params
 
-        sec_uid = getattr(found[0], "sec_uid", None) if found else None
+        sec_uid = getattr(author, "sec_uid", None)
         if not isinstance(sec_uid, str) or not sec_uid:
+            log.info("worker.author_handle.no_id", endpoint=endpoint, handle=handle)
             return params
 
-        log.info("worker.author_handle.resolved", endpoint=endpoint, handle=handle)
+        log.info(
+            "worker.author_handle.resolved",
+            endpoint=endpoint,
+            handle=handle,
+            cached=result.cached,
+        )
         resolved = dict(params)
         resolved.pop("sec_user_id", None)
         resolved[registry.AUTHOR_ID] = sec_uid
```

**File**: `tests/unit/test_worker.py` (modified, +27/-1)
```diff
@@ -1768,7 +1768,10 @@ async def test_a_tiktok_handle_is_resolved_before_the_call_that_cannot_use_it()
     first - advice that led nowhere, because the profile it would have returned
     carried no usable id either. Now the worker does the lookup itself.
     """
-    fetch = FakeFetch(parse_payload=_tiktok_profile_payload())
+    # Both set: a fresh fetch returns the payload *and* runs the callback. The
+    # cache-hit case, which only returns the payload, is the test below.
+    payload = _tiktok_profile_payload()
+    fetch = FakeFetch(payload=payload, parse_payload=payload)
     worker, _ = make_worker(FakeStore(), fetch)
     run = a_run("tiktok.author_posts", sec_user_id="owlcitymusic")
 
@@ -1781,6 +1784,29 @@ async def test_a_tiktok_handle_is_resolved_before_the_call_that_cannot_use_it()
     assert "sec_user_id" not in resolved
 
 
+async def test_a_cached_profile_still_yields_the_id() -> None:
+    """The lookup must read what came back, not what the callback collected.
+
+    `FetchService.fetch` returns a cache hit straight from storage and never
+    calls `parse`. Collecting the author through that callback therefore worked
+    on the first lookup of a handle and failed on every one afterwards - a bug
+    that got better when you stopped looking at it, and the reason the fix
+    shipped in 5.0.2 appeared to work when it was tested and not when it was
+    used.
+    """
+    # payload set, parse_payload left None: FakeFetch answers without ever
+    # invoking the callback, which is exactly what a cache hit does.
+    fetch = FakeFetch(payload=_tiktok_profile_payload())
+    worker, _ = make_worker(FakeStore(), fetch)
+    run = a_run("tiktok.author_posts", sec_user_id="owlcitymusic")
+
+    resolved = await worker._resolve_author_handle("tiktok.author_posts", dict(run.params), run)
+
+    assert len(fetch.calls) == 1
+    assert resolved["author_id"].startswith("MS4wLjAB")
+    assert "sec_user_id" not in resolved
+
+
 async def test_an_id_that_is_already_a_sec_uid_costs_no_lookup() -> None:
     """The common case must not pay for a request it does not need."""
     fetch = FakeFetch()
```

---

### Incident Patch 7: `9d213830` (2026-09-11)
**Commit Message**: fix(api): a session's 403 listed scopes that could never have refused it

Spotted the moment 5.0.2 went live: the demo account's refusal reported
`have_scopes` containing `admin`, which reads as "I hold admin and still
cannot read this".

True, and irrelevant, which is the worst combination to print.
`Principal.permits` lets every console session through a scope gate, so
a session can only ever be refused on its role; the scopes on a session
principal are never consulted. They are now shown only for a caller
scopes actually bind - an API key, or the anonymous principal an opened
endpoint runs as.

`via` already said which gate applied. This stops the response
contradicting it.

**File**: `src/dtk/api/deps.py` (modified, +7/-1)
```diff
@@ -110,11 +110,17 @@ def denial(
         if scopes:
             detail["required_scopes"] = sorted(s.value for s in scopes)
         detail["have_role"] = self.role.value
-        detail["have_scopes"] = sorted(s.value for s in self.scopes)
         # Which gate applies at all: an API key is bounded by its scopes, a
         # console session by its role. Saying so stops a reader chasing a
         # requirement that was never going to be checked for them.
         detail["via"] = "api_key" if self.scoped else "session"
+        # Only for a caller scopes actually bind. `permits` lets every console
+        # session through a scope gate, so a session can only ever be refused on
+        # its role - and the demo account nominally carries `admin` among its
+        # scopes, so listing them here read as "I hold admin and still cannot
+        # read this". True, irrelevant, and the worst combination to print.
+        if self.scoped:
+            detail["have_scopes"] = sorted(s.value for s in self.scopes)
         return detail
 
     def require(self, *needed: Scope) -> None:
```

**File**: `tests/unit/test_repo_hygiene.py` (modified, +16/-0)
```diff
@@ -1052,3 +1052,19 @@ def test_the_forbidden_message_does_not_claim_a_credential_it_may_not_have() ->
             f"the {language} FORBIDDEN_SCOPE message names an API key again; a "
             "console session hitting a role gate has none"
         )
+
+
+def test_a_session_refusal_does_not_list_scopes_that_were_never_the_gate() -> None:
+    """`have_scopes` belongs only to a caller that scopes actually bind.
+
+    `Principal.permits` lets every console session through a scope gate, so a
+    session can only ever be refused on its role. Listing its scopes anyway was
+    worse than useless on the demo account, which nominally carries `admin`: the
+    refusal read as "I hold admin and still cannot read this".
+    """
+    source = (SRC / "api" / "deps.py").read_text(encoding="utf-8")
+    guarded = re.search(r"if self\.scoped:\s*\n\s*detail\[\"have_scopes\"\]", source)
+    assert guarded, (
+        "have_scopes is no longer behind `if self.scoped` in Principal.denial; a "
+        "console session would list scopes that could not have refused it"
+    )
```

---

### Incident Patch 8: `5fafdda1` (2026-09-11)
**Commit Message**: fix(console): an author download could only ever go to Douyin

Reported against the live demo: on Downloads, the author-posts mode shows
douyin and the platform menu will not open.

It was disabled for the whole of that mode, on the reasoning that an
author is named by a sec_user_id rather than by digits, so the menu had
nothing to decide. But resolveTarget reads the menu for a bare author id
too, and has to: Douyin's sec_user_id and TikTok's secUid are the same
MS4wLjABAAAA… shape, and nothing in the string says which platform it
came from. The comment on SEC_UID says exactly that, three lines above
the code that assumed otherwise.

So the menu sat greyed out at its default and every author download went
to Douyin. TikTok was unreachable, and the one control that could have
said otherwise could not be opened.

The condition now mirrors resolveTarget rather than paraphrasing it -
enabled precisely when its value is the one that gets used. Empty box
counts as using it, since it is the platform whatever is typed next will
be read as; a link does not, because the link settles the platform and
the API refuses one that disagrees rather than guessing. Post mode
behaves exactly as before.

**File**: `tests/unit/test_repo_hygiene.py` (modified, +27/-0)
```diff
@@ -974,3 +974,30 @@ def test_no_documentation_link_points_at_a_missing_file() -> None:
         if not (page.parent / target).resolve().exists()
     ]
     assert not broken, "documentation links that go nowhere:\n  " + "\n  ".join(broken)
+
+
+def test_the_download_platform_menu_is_not_disabled_where_it_is_needed() -> None:
+    """A control must be enabled exactly where its value is read.
+
+    `resolveTarget` in the downloads page reads the platform menu for a bare
+    author id, because Douyin's `sec_user_id` and TikTok's `secUid` are the same
+    `MS4wLjABAAAA…` shape and the string says nothing about which platform it
+    came from. The menu was nonetheless disabled for the whole of author mode,
+    so it sat at its default and every author download went to Douyin -
+    TikTok was not reachable, and the control that would have changed it could
+    not be opened.
+
+    Pinned by shape rather than by reading the condition: what must not come
+    back is disabling the menu on the mode alone.
+    """
+    page = (WEB / "pages" / "Downloads.tsx").read_text(encoding="utf-8")
+
+    assert "usesPlatformMenu" in page, (
+        "the downloads page no longer decides the platform menu's state from the "
+        "input; if that moved, move this check with it"
+    )
+    assert "disabled={active.wants === 'author'" not in page, (
+        "the platform menu is disabled for all of author mode again. A bare author "
+        "id is ambiguous between the two platforms, so the menu is the only thing "
+        "that can say which one - disabling it makes TikTok unreachable."
+    )
```

**File**: `web/src/pages/Downloads.tsx` (modified, +28/-6)
```diff
@@ -169,6 +169,28 @@ const STORAGE_KEY = ['downloads', 'storage'] as const
 
 const PLATFORMS: readonly Platform[] = ['douyin', 'tiktok']
 
+/**
+ * Whether the platform menu decides this input's platform.
+ *
+ * It mirrors `resolveTarget` exactly, and it has to: the menu should be
+ * enabled precisely when its value is the one that gets used. It used to be
+ * disabled for the whole of author mode on the grounds that an author is named
+ * by a `sec_user_id` rather than by digits - but `resolveTarget` reads the menu
+ * for a bare author id too, because Douyin's `sec_user_id` and TikTok's
+ * `secUid` are the same `MS4wLjABAAAA…` shape and nothing in the string says
+ * which platform it came from. With the menu greyed out at its default, every
+ * author download went to Douyin and TikTok was unreachable.
+ *
+ * An empty box counts as using the menu: it is the platform whatever is typed
+ * next will be read as. A link does not - the link settles it, and the API
+ * refuses a link that disagrees with the menu rather than guessing.
+ */
+function usesPlatformMenu(text: string, wantsAuthor: boolean): boolean {
+  const trimmed = text.trim()
+  if (!trimmed) return true
+  return wantsAuthor ? SEC_UID.test(trimmed) : /^\d+$/.test(trimmed)
+}
+
 interface DownloadFile {
   /** As it sits in the post's directory on the volume: `video.mp4`. */
   name: string
@@ -873,15 +895,15 @@ export default function Downloads() {
             else saveAuthor.mutate()
           }}
         >
-          {/* Only consulted for a bare id, and only a post can be named by
-              one - an author is a sec_user_id, which is not digits. A link
-              says which platform it is, and the API refuses one that disagrees
-              with this rather than guessing, so the menu is disabled while a
-              link is in the box. */}
+          {/* Enabled exactly when `resolveTarget` reads it - see
+              `usesPlatformMenu`. A link says which platform it is and the API
+              refuses one that disagrees with this rather than guessing, so the
+              menu is disabled while a link is in the box; a bare id says
+              nothing, so it is not. */}
           <Field id="download-platform" label={t('downloads.field.platform')}>
             <Select
               value={platform}
-              disabled={active.wants === 'author' || (target.trim().length > 0 && !looksLikeId)}
+              disabled={!usesPlatformMenu(target, active.wants === 'author')}
               onChange={(event) => {
                 setPlatform(event.target.value as Platform)
               }}
```

---

### Incident Patch 9: `3093c72d` (2026-09-11)
**Commit Message**: fix(tiktok): a profile link could not reach the author's posts

Reported against the live demo: /tiktok/user/posts?url=.../@minecraft
answers INVALID_PARAM, and only a secUid works. Two defects behind it.

The parser threw TikTok's secUid away. Author.uid holds the numeric id
on TikTok, and every TikTok author endpoint - author_posts,
author_likes, followers, following - keys on secUid instead, which
nothing in the normalized model carried. So the API returned nothing
that could be fed back into itself: parse a video, get a numeric id and
an @handle, and every author endpoint refuses both. The id was in the
payload the whole time - author.secUid is in the video detail, the
profile and every post list, in all four captured fixtures.

Author gains sec_uid. On Douyin it is the same value as uid and the
duplication is the point: reading sec_uid should work without first
asking which platform you are looking at. On TikTok the two differ, and
that difference is the reason the field exists.

And the handle is now resolved rather than refused. A TikTok profile
link carries only the handle, so every URL-shaped author lookup arrived
holding one. author_posts refused it by name - correctly, s

**File**: `documents/en/17-faq.md` (modified, +2/-2)
```diff
@@ -615,8 +615,8 @@ precise definition elsewhere, the linked page has it.
 | --- | --- |
 | **`aweme_id`** | Douyin's post id, a 19-digit number. Handled as a string everywhere, because it exceeds JavaScript's safe integer range and an int would silently lose precision in the UI. Douyin's comment-replies endpoint spells the same value `item_id`; its comment list still calls it `aweme_id`. |
 | **`content_id`** | This project's neutral name for a post id, on either platform. |
-| **`sec_user_id`** | Douyin's stable author key, and what the normalized model stores as the author's `uid`. Douyin's own mutable `uid` is deliberately not used, and neither is the handle. |
-| **`secUid`** | TikTok's opaque author key, which its own endpoints take alongside or instead of the handle. The normalized model stores TikTok's numeric id as the author's `uid` and preserves `secUid` in `raw`; a URL-shaped profile lookup uses the `@handle` (`uniqueId`), because that is what TikTok's user-detail endpoint accepts without a prior fetch. |
+| **`sec_user_id`** | Douyin's stable author key, stored as both the author's `uid` and its `sec_uid` - the duplication is deliberate, so that reading `sec_uid` works on either platform without first asking which one you are looking at. Douyin's own mutable `uid` is deliberately not used, and neither is the handle. |
+| **`secUid`** | TikTok's opaque author key, and the id every TikTok author endpoint takes. The normalized model stores TikTok's numeric id as the author's `uid` and this value as `sec_uid` - the two differ on TikTok and are the same on Douyin, so `sec_uid` is the field to read when you intend to pass it back. A URL-shaped lookup carries only the `@handle`, which `author_profile` accepts directly; for the post list, the likes list and the follow graph the handle is resolved to a `secUid` first, at the cost of one cached lookup. |
 | **`unique_id`** | The `@handle`. Never used as a key, because users edit it. |
 | **Content kind** | `video`, `image_album` or `live`. Only the detail response settles which — a URL shape is a hint, never authoritative. |
 
```

**File**: `documents/zh/17-faq.md` (modified, +2/-2)
```diff
@@ -530,8 +530,8 @@ Ethereum (ERC20)、BNB Smart Chain (BEP20) 和 Bitcoin 的加密货币地址列
 | --- | --- |
 | **`aweme_id`** | 抖音的作品 ID，19 位数字。全程按字符串处理，因为它超出了 JavaScript 的安全整数范围，用整数会在界面上悄悄丢精度。抖音的评论回复接口把同一个值拼作 `item_id`；评论列表接口仍然叫它 `aweme_id`。 |
 | **`content_id`** | 本项目对作品 ID 的中立命名，两个平台通用。 |
-| **`sec_user_id`** | 抖音稳定的作者主键，也是归一化模型里作者的 `uid`。抖音自己那个会变的 `uid` 被刻意弃用，用户名同样不作为键。 |
-| **`secUid`** | TikTok 的不透明作者键，它自己的接口会用它（有时与用户名二选一）。归一化模型把 TikTok 的数字 id 存为作者的 `uid`，并把 `secUid` 保留在 `raw` 里；从 URL 出发的主页查询用的是 `@handle`（`uniqueId`），因为那是 TikTok 用户详情接口无需先抓一次就能接受的输入。 |
+| **`sec_user_id`** | 抖音稳定的作者主键，在归一化模型里同时存进作者的 `uid` 和 `sec_uid`。这个重复是故意的：读 `sec_uid` 在两个平台上都成立，不必先判断自己面对的是哪一个。抖音自己那个会变的 `uid` 被刻意弃用，用户名同样不作为键。 |
+| **`secUid`** | TikTok 的不透明作者键，也是 TikTok 全部作者接口认的那个 id。归一化模型把 TikTok 的数字 id 存为作者的 `uid`，把这个值存为 `sec_uid` —— 在 TikTok 上两者不同，在抖音上两者同值，所以**打算拿回去再请求的时候读 `sec_uid`**。从 URL 出发只能拿到 `@handle`，`author_profile` 直接收；作品列表、点赞列表和关注关系则会先把 handle 解析成 `secUid`，代价是一次可缓存的查询。 |
 | **`unique_id`** | 就是 `@` 用户名。从不作为键使用，因为用户可以改。 |
 | **内容类型（content kind）** | `video`、`image_album` 或 `live`。只有详情响应才能定下来是哪一种——URL 的形状只是提示，永远不作数。 |
 
```

**File**: `src/dtk/models/content.py` (modified, +15/-0)
```diff
@@ -94,6 +94,21 @@ class Author(_Base):
     #: The platform's stable primary key: Douyin ``sec_user_id`` (not ``uid``,
     #: which rotates), TikTok's numeric id. Never ``unique_id`` - users edit it.
     uid: str
+    #: The id this project's own author endpoints key on.
+    #:
+    #: On Douyin it is the same value as :attr:`uid` and the duplication is the
+    #: point: a caller should not have to know which platform puts its usable id
+    #: in which field. On TikTok they differ, and that difference is why this
+    #: field exists - ``author_posts``, ``author_likes``, ``followers`` and
+    #: ``following`` all key on ``secUid``, and ``uid`` carries the numeric
+    #: ``id``, which none of them accept. Without this the API returned nothing
+    #: that could be fed back into itself: parsing a TikTok video gave you a
+    #: numeric id and an @handle, and every author endpoint refuses both.
+    #:
+    #: Optional because a parser may meet an author node that omits it; a
+    #: response carrying `None` here means "ask the profile endpoint", not
+    #: "this author has no id".
+    sec_uid: str | None = None
     unique_id: str | None = None
     nickname: str
     signature: str | None = None
```

**File**: `src/dtk/platforms/douyin/parser.py` (modified, +4/-0)
```diff
@@ -159,6 +159,10 @@ def author_from_node(node: Node, *, include_raw: bool = False) -> Author:
     return Author(
         platform=_PLATFORM,
         uid=sec_uid,
+        # Same value as `uid` here, deliberately. See `Author.sec_uid`: a caller
+        # reading this field should not have to know which platform it is
+        # looking at to know which field holds a usable id.
+        sec_uid=sec_uid,
         unique_id=optional_str(node.get("unique_id")) or optional_id(node.get("short_id")),
         nickname=node.text("nickname"),
         signature=optional_str(node.get("signature")),
```

**File**: `src/dtk/platforms/tiktok/parser.py` (modified, +8/-0)
```diff
@@ -144,6 +144,11 @@ def author_from_web_node(
     return Author(
         platform=_PLATFORM,
         uid=node.id("id"),
+        # The id every TikTok author endpoint keys on, and a different value
+        # from `uid`. Optional rather than required: it is present in every
+        # author node measured so far, but a missing one should degrade to
+        # "look this author up" rather than fail the whole parse.
+        sec_uid=optional_str(node.get("secUid")),
         unique_id=unique_id,
         nickname=node.text("nickname"),
         signature=optional_str(node.get("signature")),
@@ -167,6 +172,9 @@ def author_from_comment_node(node: Node, *, include_raw: bool = False) -> Author
     return Author(
         platform=_PLATFORM,
         uid=node.id("uid"),
+        # snake_case here: the comment endpoints are the one place TikTok keeps
+        # the aweme spelling, `sec_uid` included.
+        sec_uid=optional_str(node.get("sec_uid")),
         unique_id=unique_id,
         nickname=node.text("nickname"),
         signature=optional_str(node.get("signature")),
```

---

### Incident Patch 10: `bcbbfa17` (2026-09-11)
**Commit Message**: fix(install): upgrade to a release asked Docker Hub for a tag that never existed

Found by running it against the demo server the moment v5.0.1 was published,
which is the first time the release path could fire at all.

It fired correctly - "Upgrade to v5.0.1", release as the default - and then
failed on the pull. A GitHub release is tagged `v5.0.1`; the image it produces
is `5.0.1`, because docker/metadata-action's `{{version}}` strips the v. The
script pinned the release tag verbatim. `image_tag_for` drops a leading v only
when a digit follows, so `latest`, `main`, a `sha-` build and a branch called
`vnext` are all left alone.

The worse half is the order, and the tag mismatch only exposed it. `.env` was
rewritten before the pull, so a pull that fails leaves the deployment pinned to
an image that does not exist: what is already running keeps running, and the
next `up -d` cannot start. The pull now happens first with the tag on the
command line only, and `.env` is not touched until the image is known to be
there. It also pulls the downloader when that profile is on, which `bring_up`
already did and this did not.

The failure was clean in the way it was designed to be - the pull ra

**File**: `install/install.sh` (modified, +26/-3)
```diff
@@ -1053,8 +1053,20 @@ show_status() {
   fi
 }
 
-do_upgrade() {
+# A GitHub release is tagged `v5.0.1`; the image it produces is `5.0.1`.
+# docker/metadata-action's `{{version}}` strips the v, so pinning the release
+# tag verbatim asks Docker Hub for something that was never published.
+image_tag_for() {
   local target="$1"
+  case "$target" in
+    v[0-9]*) printf '%s' "${target#v}" ;;
+    *) printf '%s' "$target" ;;
+  esac
+}
+
+do_upgrade() {
+  local target
+  target="$(image_tag_for "$1")"
   step "Upgrading to $target"
   info "Your data is untouched: the named volumes survive this."
   printf '\n'
@@ -1064,6 +1076,19 @@ do_upgrade() {
   git -C "$INSTALL_DIR" merge --ff-only --quiet origin/main 2>/dev/null \
     || warn "The checkout has local changes; leaving it alone."
 
+  # Pull BEFORE pinning. Writing the tag first and then failing to fetch it
+  # leaves the deployment pointing at an image that does not exist - the stack
+  # keeps running on what is already up, but the next `up -d` cannot start. The
+  # tag goes on the command for this pull only; .env is not touched until the
+  # image is known to be there.
+  info "Pulling."
+  local services=(api worker)
+  [ "$WANT_DOWNLOADER" = 1 ] && services+=(downloader)
+  if ! DTK_IMAGE_TAG="$target" "$CTL" pull "${services[@]}"; then
+    die "Could not pull $target. Nothing was changed and the old version is still running.
+    Check the tag exists: https://hub.docker.com/r/evil0ctal/douyin_tiktok_download_api/tags"
+  fi
+
   # Pin the tag rather than following `latest`: an operator should be able to
   # say which build is running, and to put it back.
   if grep -q '^DTK_IMAGE_TAG=' "$INSTALL_DIR/.env"; then
@@ -1076,8 +1101,6 @@ do_upgrade() {
     ok "Pinned DTK_IMAGE_TAG=$target"
   fi
 
-  info "Pulling."
-  "$CTL" pull api worker 2>&1 | tail -3 || die "Pull failed. The old version is still running."
   info "Migrating."
   "$CTL" run --rm migrate || die "Migrations failed. The old containers are still up; nothing was swapped."
   info "Restarting."
```

**File**: `install/install.zh.sh` (modified, +25/-4)
```diff
@@ -1026,8 +1026,20 @@ show_status() {
   fi
 }
 
-do_upgrade() {
+# GitHub 上的 release tag 是 `v5.0.1`，而它产出的镜像叫 `5.0.1`。
+# docker/metadata-action 的 `{{version}}` 会把 v 去掉，所以原样拿 release tag
+# 去钉，等于向 Docker Hub 要一个从来没发布过的东西。
+image_tag_for() {
   local target="$1"
+  case "$target" in
+    v[0-9]*) printf '%s' "${target#v}" ;;
+    *) printf '%s' "$target" ;;
+  esac
+}
+
+do_upgrade() {
+  local target
+  target="$(image_tag_for "$1")"
   step "升级到 $target"
   info "数据不受影响：命名卷不会随这次操作消失。"
   printf '\n'
@@ -1037,20 +1049,29 @@ do_upgrade() {
   git -C "$INSTALL_DIR" merge --ff-only --quiet origin/main 2>/dev/null \
     || warn "本地有改动，保持原样不动。"
 
+  # 先拉，再钉。反过来的话，一旦拉取失败，部署就指向了一个不存在的镜像 ——
+  # 已经起着的容器照常跑，但下一次 `up -d` 起不来。这次拉取的 tag 只挂在命令上，
+  # 确认镜像确实存在之前不碰 .env。
+  info "正在拉取。"
+  local services=(api worker)
+  [ "$WANT_DOWNLOADER" = 1 ] && services+=(downloader)
+  if ! DTK_IMAGE_TAG="$target" "$CTL" pull "${services[@]}"; then
+    die "拉不到 ${target}。什么都没改，旧版本还在正常运行。
+    去确认这个 tag 是否存在：https://hub.docker.com/r/evil0ctal/douyin_tiktok_download_api/tags"
+  fi
+
   # 钉住具体的 tag，而不是跟着 `latest` 跑：运维应当说得出现在跑的是哪个构建，
   # 也应当能把它换回去。
   if grep -q '^DTK_IMAGE_TAG=' "$INSTALL_DIR/.env"; then
     local tmp
-    tmp="$(mktemp)" || die "Could not create a temporary file."
+    tmp="$(mktemp)" || die "创建临时文件失败。"
     TMP_FILES+=("$tmp")
     sed "s|^DTK_IMAGE_TAG=.*|DTK_IMAGE_TAG=$target|" "$INSTALL_DIR/.env" >"$tmp"
     cat "$tmp" >"$INSTALL_DIR/.env"
     rm -f "$tmp"
     ok "已把 DTK_IMAGE_TAG 钉在 $target"
   fi
 
-  info "正在拉取。"
-  "$CTL" pull api worker 2>&1 | tail -3 || die "拉取失败。旧版本还在正常运行。"
   info "正在迁移。"
   "$CTL" run --rm migrate || die "迁移失败。旧容器还在跑，什么都没有被替换。"
   info "正在重启。"
```

#### Recent Merged Pull Requests:
- **PR #762** (closed): test(setup): verify concurrent setup requests cannot create multiple admins (@failsafesecurity)
- **PR #761** (closed): fix(setup): atomic token consumption to prevent race condition on admin creation (@failsafesecurity)
- **PR #753** (2026-09-14): feat: add TikTok author_collections endpoint (@BennoCrafter)
- **PR #751** (2026-09-10): ci: bump the actions group with 11 updates (@dependabot[bot])
- **PR #750** (2026-09-10): chore: update redis[hiredis] requirement from >=5.2 to >=8.1.0 (@dependabot[bot])
- **PR #749** (2026-09-10): chore: update uvicorn[standard] requirement from >=0.32 to >=0.52.4 (@dependabot[bot])
- **PR #748** (2026-09-10): chore: update sqlalchemy[asyncio] requirement from >=2.0.36 to >=2.0.52 (@dependabot[bot])
- **PR #747** (2026-09-10): chore: bump mcp from 2.1.1 to 2.2.0 in the python group (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

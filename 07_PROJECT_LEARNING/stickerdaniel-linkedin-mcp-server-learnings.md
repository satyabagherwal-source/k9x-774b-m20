# Forensic Learning Record (Deep Inspection): stickerdaniel/linkedin-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/stickerdaniel-linkedin-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:57.379Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stickerdaniel/linkedin-mcp-server`
- **Description**: Open-source MCP server for LinkedIn. Give Claude and any MCP-compatible AI agent access to profiles, companies, jobs, and messages.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3749 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `linkedin_mcp_server/common_utils.py`
```
"""Small shared helpers used across diagnostics and session-state modules."""

from __future__ import annotations

import os
import stat
from datetime import UTC, datetime
from pathlib import Path
import re
import tempfile

_PRIVATE_DIR_MODE = 0o700


def slugify_fragment(value: str) -> str:
    """Return a lowercase URL/file-safe fragment."""
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def utcnow_iso() -> str:
    """Return the current UTC timestamp in a compact ISO-8601 form."""
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def secure_mkdir(path: Path, mode: int = 0o700) -> None:
    """Create a directory tree with restrictive permissions.

    Unlike ``Path.mkdir(parents=True, mode=...)``, this applies *mode* to
    every newly created directory in the chain, not just the leaf.
    """
    if path.exists() and not path.is_dir():
        raise NotADirectoryError(f"Path exists and is not a directory: {path}")

    missing: list[Path] = []
    p = path
    while not p.exists():
        missing.append(p)
        p = p.parent
    for part in reversed(missing):
        part.mkdir(mode=mode, exist_ok=True)


def harden_linkedin_tree(path: Path) -> None:
    """Ensure dirs from *path* up to ``.linkedin-mcp`` are owner-only (``0o700``).

    Complements :func:`secure_mkdir` by hardening pre-existing directories that
    may have been created with default umask permissions. No-op on Windows or
    when *path* is not inside a ``.linkedin-mcp`` directory.
    """
    if os.name == "nt":
        return
    d = path if path.is_dir() else path.parent
    # Bail out early when the path is not inside a .linkedin-mcp tree.
    if not any(p.name == ".linkedin-mcp" for p in (d, *d.parents)):
        return
    for p in (d, *d.parents):
        if p.is_dir() and stat.S_IMODE(p.stat().st_mode) != _PRIVATE_DIR_MODE:
            p.chmod(_PRIVATE_DIR_MODE)
        if p.name == ".linkedin-mcp":
            return


def is_still_at(fd: int, path: Path) -> bool:
    """Whether *fd* is still the file that *path* names.

    Compared by device and inode rather than by counting links. A count catches
    an unlink and misses a rename: the inode keeps its one link while the name
    comes to mean a different file, so the count still reads as one. A path that
    has since vanished counts as changed.

    Only meaningful once whatever the caller wanted to establish is in hand.
    Asked earlier, the answer can stop being true immediately afterwards.
    """
    held = os.fstat(fd)
    try:
        current = path.stat()
    except OSError:
        return False
    return (held.st_dev, held.st_ino) == (current.st_dev, current.st_ino)


def secure_write_text(path: Path, content: str, mode: int = 0o600) -> None:
    """Atomically write *content* to *path* with owner-only permissions.

    Uses a temp file + ``os.replace`` in the same directory so the write is
    atomic on the same filesystem and avoids TOCTOU permission races.
    """
    secure_mkdir(path.parent)
    fd_int, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd_int, "w") as f:
            f.write(content)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise

```

### Core Architecture Module: `linkedin_mcp_server/core/__init__.py`
```
"""Core browser management, authentication, and page-reading utilities."""

from typing import TYPE_CHECKING

from .auth import (
    detect_auth_barrier,
    detect_auth_barrier_quick,
    is_logged_in,
    resolve_remember_me_prompt,
    wait_for_manual_login,
)
from .destination import is_another_site, is_linkedin_landing, raise_if_off_linkedin
from .exceptions import (
    AccountRestrictedError,
    AuthenticationError,
    ElementNotFoundError,
    LinkedInOperationError,
    NetworkError,
    OffLinkedInLandingError,
    PageReadError,
    ProfileNotFoundError,
    ProxyConnectionError,
    RateLimitError,
)
from .proxy_errors import (
    as_proxy_error,
    goto_reporting_proxy_errors,
    is_proxy_error,
    proxy_hint,
    raise_if_proxy_configured,
    raise_if_proxy_error,
    redact_proxy_credentials,
    redacted_copy,
)
from .utils import detect_rate_limit, handle_modal_close, scroll_to_bottom

if TYPE_CHECKING:
    from .browser import BrowserManager, await_deferring_cancels

_LAZY_BROWSER_EXPORTS = frozenset({"BrowserManager", "await_deferring_cancels"})


def __getattr__(name: str) -> object:
    """Resolve browser lifecycle exports without loading them for leaf imports."""
    if name not in _LAZY_BROWSER_EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    from importlib import import_module

    browser = import_module(".browser", __name__)
    value = getattr(browser, name)
    globals()[name] = value
    return value


__all__ = [
    "AccountRestrictedError",
    "AuthenticationError",
    "BrowserManager",
    "await_deferring_cancels",
    "detect_auth_barrier",
    "detect_auth_barrier_quick",
    "ElementNotFoundError",
    "LinkedInOperationError",
    "NetworkError",
    "OffLinkedInLandingError",
    "PageReadError",
    "ProfileNotFoundError",
    "ProxyConnectionError",
    "RateLimitError",
    "as_proxy_error",
    "goto_reporting_proxy_errors",
    "is_proxy_error",
    "proxy_hint",
    "raise_if_proxy_configured",
    "raise_if_proxy_error",
    "redact_proxy_credentials",
    "redacted_copy",
    "detect_rate_limit",
    "handle_modal_close",
    "is_another_site",
    "is_linkedin_landing",
    "is_logged_in",
    "raise_if_off_linkedin",
    "resolve_remember_me_prompt",
    "scroll_to_bottom",
    "wait_for_manual_login",
]

```

### Core Architecture Module: `linkedin_mcp_server/core/auth.py`
```
"""Authentication functions for LinkedIn."""

import asyncio
import logging
import re
from urllib.parse import urlparse

from patchright.async_api import (
    Error as PlaywrightError,
    Page,
    TimeoutError as PlaywrightTimeoutError,
)

from .destination import is_linkedin_landing, linkedin_element
from .exceptions import (
    AccountRestrictedError,
    AuthenticationError,
    OffLinkedInLandingError,
)

logger = logging.getLogger(__name__)

# LinkedIn's account-restriction route. The page is localized, so only the path
# is read, as its final segments so the route without the flagship-web prefix
# counts too. Observations, and any new route, go in
# docs/linkedin-auth-routes.md first; nothing here is guessed.
_ACCOUNT_RESTRICTION_PATH_TAIL = ("login", "login-restriction")
_AUTH_BLOCKER_URL_PATTERNS = (
    "/login",
    "/authwall",
    "/checkpoint",
    "/challenge",
    "/uas/login",
    "/uas/consumer-email-challenge",
)
_LOGIN_TITLE_PATTERNS = (
    "linkedin login",
    "sign in | linkedin",
)
# English only, and knowingly so: these are the words the account picker uses,
# and the words change with the interface language while nothing about the page
# announces which one is in play. The structural check below carries the
# locales this table does not, which is why it runs first.
_AUTH_BARRIER_TEXT_MARKERS = (
    ("welcome back", "sign in using another account"),
    ("welcome back", "join now"),
    ("choose an account", "sign in using another account"),
    ("continue as", "sign in using another account"),
)
_REMEMBER_ME_CONTAINER_SELECTOR = "#rememberme-div"
_REMEMBER_ME_BUTTON_SELECTOR = "#rememberme-div button"
_AUTH_SNAPSHOT_JS = """({ picker, includeBody }) => ({
    href: location.href,
    title: document.title || '',
    picker: document.querySelector(picker) !== null,
    body: includeBody ? (document.body?.innerText || '') : '',
})"""
_MANUAL_LOGIN_STATUS_INTERVAL_SECONDS = 30
_AUTH_COOKIE_URL = "https://www.linkedin.com/feed/"


async def is_logged_in(page: Page) -> bool:
    """Check if currently logged in to LinkedIn.

    Uses a three-tier strategy:
    1. Fail-fast on auth blocker URLs
    2. Check for navigation elements (primary)
    3. URL-based fallback for authenticated-only pages

    Raises:
        AccountRestrictedError: On LinkedIn's account-restriction route.
    """
    _raise_if_account_restricted(page.url)
    try:
        current_url = page.url

        # Step 1: Fail-fast on auth blockers
        if _is_auth_blocker_url(current_url):
            return False

        # Step 2: Selector check (PRIMARY)
        old_selectors = '.global-nav__primary-link, [data-control-name="nav.settings"]'
        old_count = await page.locator(old_selectors).count()

        new_selectors = 'nav a[href*="/feed"], nav button:has-text("Home"), nav a[href*="/mynetwork"]'
        new_count = await page.locator(new_selectors).count()

        has_nav_elements = old_count > 0 or new_count > 0

        # Step 3: URL fallback
        authenticated_only_pages = [
            "/feed",
            "/mynetwork",
            "/messaging",
            "/notifications",
        ]
        is_authenticated_page = any(
            pattern in current_url for pattern in authenticated_only_pages
        )

        if not is_authenticated_page:
            return has_nav_elements

        if has_nav_elements:
            return True

        # Empty authenticated-only pages are a false positive during cookie
        # bridge recovery. Require some real page content before trusting URL.
        body_text = await page.evaluate("() => document.body?.innerText || ''")
        if not isinstance(body_text, str):
            return False

        return bool(body_text.strip())
    except PlaywrightTimeoutError:
        logger.warning(
            "Timeout checking login status on %s — treating as not logged in",
            page.url,
        )
        return False
    except Exception:
        logger.error("Unexpected error checking login status", exc_info=True)
        raise


async def detect_auth_barrier(page: Page) -> str | None:
    """Detect LinkedIn auth/account-picker barriers on the current page."""
    return await _detect_auth_barrier(page, include_body_text=True)


async def _detect_auth_barrier(
    page: Page,
    *,
    include_body_text: bool,
) -> str | None:
    """Detect LinkedIn auth/account-picker barriers on the current page.

    Raises:
        AccountRestrictedError: On LinkedIn's account-restriction route, which
            no login can clear and so is not reported as a barrier.
    """
    # Ahead of every signal below, because none of them names a host: a filter
    # page titled "LinkedIn Login", or one that happens to carry the picker's
    # id, would otherwise be reported as LinkedIn asking for a sign-in, and the
    # recovery for that retires the session. A page LinkedIn did not serve is
    # the caller's to refuse, through `raise_if_off_linkedin`.
    if not is_linkedin_landing(page.url):
        return None
    # Outside any try, which would answer the failure with "no barrier". Ahead
    # of the blocker routes, which the bare /login/login-restriction/ also
    # matches.
    _raise_if_account_restricted(page.url)
    if _is_auth_blocker_url(page.url):
        return f"auth blocker URL: {page.url}"

    # One evaluation, so the title, the picker and the body text are all the
    # document's whose address comes back with them. Read one at a time, a
    # redirect landing between the address check and a later read paired
    # LinkedIn's address with a portal's title.
    try:
        snapshot = await page.evaluate(
            _AUTH_SNAPSHOT_JS,
            {
                "picker": _REMEMBER_ME_CONTAINER_SELECTOR,
                "includeBody": include_body_text,
            },
        )
    except PlaywrightTimeoutError:
        logger.warning(
            "Timeout checking auth barrier on %s — continuing without barrier detection",
            page.url,
        )
        return None
    except Exception:
        # Also a document replaced mid-read, which leaves nothing to judge.
        logger.debug("Could not read the page for auth barriers", exc_info=True)
        return None
    if not isinstance(snapshot, dict):
        return None
    address = snapshot.get("href")
    if not is_linkedin_landing(address):
        return None
    _raise_if_account_restricted(address)
    if _is_auth_blocker_url(address):
        return f"auth blocker URL: {address}"

    title = snapshot.get("title")
    title = title.strip().lower() if isinstance(title, str) else ""
    if any(pattern in title for pattern in _LOGIN_TITLE_PATTERNS):
        return f"login title: {title}"

    # An id, so it says the same thing in every interface language, which
    # the picker's own words do not. The rest of the codebase already reads
    # this container as the picker; here it is the only signal that
    # survives a locale change, because the URL of an in-place picker is
    # the page that was asked for and its title is that page's title.
    #
    # Ahead of the quick check's exit, and not behind it, because the two
    # signals it does read are exactly the two this page defeats. The
    # quick check runs after every navigation, so a picker served in a
    # locale the table below does not cover reached every reading tool
    # as page text. It costs one selector lookup inside the same read,
    # where the body text is what the quick check exists to skip.
    if snapshot.get("picker") is True:
        return f"account picker: {_REMEMBER_ME_CONTAINER_SELECTOR}"

    if not include_body_text:
        return None

    body_text = snapshot.get("body")
    if not isinstance(body_text, str):
        body_text = ""
    normalized = re.sub(r"\s+", " ", body_text).strip().lower()
    for marker_group in _AUTH_BARRIER_TEXT_MARKERS:
        if all(marker in normalized for marker in marker_group):
            return f"auth barrier text: {' + '.join(marker_group)}"

    return None


async def detect_auth_barrier_quick(page: Page) -> str | None:
    """Cheap auth-barrier check for normal navigations.

    Uses URL and title only, avoiding a full body-text fetch on healthy pages.
    """
    return await _detect_auth_barrier(page, include_body_text=False)


async def resolve_remember_me_prompt(page: Page, *, timeout: int | None = None) -> bool:
    """Click through LinkedIn's saved-account chooser when it appears.

    ``timeout`` bounds the whole attempt in milliseconds. ``None`` retains the
    normal per-operation limits.
    """
    deadline = None
    loop = None
    if timeout is not None:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout / 1000

    def _operation_timeout(default: int) -> int | None:
        if deadline is None or loop is None:
            return default
        remaining = int((deadline - loop.time()) * 1000)
        if remaining <= 0:
            return None
        return min(default, remaining)

    try:
        logger.debug("Checking remember-me prompt on %s", page.url)
        try:
            operation_timeout = _operation_timeout(3000)
            if operation_timeout is None:
                return False
            await page.wait_for_selector(
                _REMEMBER_ME_CONTAINER_SELECTOR, timeout=operation_timeout
            )
            logger.debug("Remember-me container appeared")
        except PlaywrightTimeoutError:
            logger.debug("Remember-me container did not appear in time")
            return False

        target = page.locator(_REMEMBER_ME_BUTTON_SELECTOR).first
        try:
            operation_timeout = _operation_timeout(3000)
            if operation_timeout is None:
                return False
            await target.wait_for(state="visible", timeout=operation_timeout)
            logger.debug("Remember-me button became visible")
        except PlaywrightTimeoutError:
            logger.debug(
     
```

### Core Architecture Module: `linkedin_mcp_server/core/browser.py`
```
"""Browser lifecycle management using Patchright with persistent context."""

import asyncio
import contextlib
import json
import logging
import os
import re
from pathlib import Path
from collections.abc import Coroutine, Mapping
from typing import Any, TypeVar

from patchright.async_api import (
    BrowserContext,
    Page,
    Playwright,
    async_playwright,
)

from linkedin_mcp_server.common_utils import (
    harden_linkedin_tree,
    secure_mkdir,
    secure_write_text,
)

from linkedin_mcp_server.browser_downgrade import refuse_a_downgrade
from linkedin_mcp_server.exceptions import (
    BrowserDowngradeError,
    BrowserShutdownUnconfirmedError,
)
from linkedin_mcp_server.hidden_target import (
    attaching_to_other_targets,
    hidden_target_is_supported,
    open_hidden_page,
)
from linkedin_mcp_server.process_tree import (
    WindowsJob,
    contain_browser_launch,
    drain_browser_process_marker,
    forget_browser_process_marker,
    new_browser_process_marker,
    remember_detached_process_groups,
)

from .exceptions import NetworkError, ProxyConnectionError

logger = logging.getLogger(__name__)

T = TypeVar("T")

_DEFAULT_USER_DATA_DIR = Path.home() / ".linkedin-mcp" / "profile"
_PRIVATE_FILE_MODE = 0o600
_CLEANUP_TIMEOUT_SECONDS = 10


async def await_deferring_cancels(coro: Coroutine[Any, Any, T]) -> tuple[T, bool]:
    """Await *coro* to completion, holding back cancels until it finishes.

    Mirrors ``session_state.run_deferring_cancels``. A bare ``shield`` is not
    enough: it re-raises on the *next* cancel, discarding the result. Everywhere
    this is used that result decides whether a browser is provably gone, so
    losing it would let a caller hand the profile on with Chromium possibly
    still running. Overlapping cancels are real -- a tool timeout racing a
    server shutdown -- so the loop keeps waiting however many arrive.

    Returns the result and whether a cancel arrived, so the caller can finish
    settling the profile and then re-raise whatever it was already handling.
    Nothing is swallowed here; the decision belongs to the caller.
    """
    task = asyncio.ensure_future(coro)
    cancelled = False
    while True:
        try:
            return await asyncio.shield(task), cancelled
        except asyncio.CancelledError:
            cancelled = True
            if task.done():
                return task.result(), True


class BrowserManager:
    """Async context manager for Patchright browser with persistent profile.

    Session persistence is handled automatically by the persistent browser
    context -- all cookies, localStorage, and session state are retained in
    the ``user_data_dir`` between runs.
    """

    def __init__(
        self,
        user_data_dir: str | Path = _DEFAULT_USER_DATA_DIR,
        headless: bool = True,
        slow_mo: int = 0,
        viewport: dict[str, int] | None = None,
        **launch_options: Any,
    ):
        # ``launch_options`` is spread straight into the context options, so a
        # stray ``user_agent`` here would reach Patchright and take effect
        # without anything in between noticing. Refused rather than dropped:
        # this is the one funnel every browser in the process goes through, and
        # an override that fails loudly cannot come back by accident. See the
        # browser identity rules in AGENTS.md.
        if "user_agent" in launch_options:
            raise TypeError(
                "BrowserManager does not accept a user_agent. The browser "
                "reports its own identity; an override changes the string but "
                "not the client hints, and never reaches service workers."
            )

        # Same funnel, same hazard. ``_geometry()`` is spread *before*
        # ``launch_options``, so a stray ``no_viewport`` would win: passing
        # ``no_viewport=False`` on a headed launch puts the emulated screen back
        # and restores the window-larger-than-screen contradiction, and passing
        # ``no_viewport=True`` on a headless one sends both keys at once.
        # Nothing produces this today; it is refused so it cannot start.
        if "no_viewport" in launch_options:
            raise TypeError(
                "BrowserManager decides no_viewport from the launch mode. Pass "
                "headless= instead: a headed window must report its real size, "
                "and a headless one needs an explicit viewport."
            )

        self.user_data_dir = str(Path(user_data_dir).expanduser())
        self.headless = headless
        self.slow_mo = slow_mo
        # Kept as passed, including ``None``. The old ``viewport or {...}``
        # meant "no viewport" could not be expressed at all, which is what
        # forced an emulated screen onto a headed window and produced the
        # measured contradiction: an outer window of 805 pixels standing on a
        # screen the same browser reported as 720 tall.
        self.viewport = viewport
        self.launch_options = launch_options
        self._process_marker, self._process_environment = new_browser_process_marker()

        self._playwright: Playwright | None = None
        #: This launch's Windows containment, or None on POSIX and before the
        #: driver exists. On Windows it is the whole of the attribution: there
        #: is no environment marker to scan for, so a close with nothing here
        #: cannot prove anything and says so. See ``contain_browser_launch``.
        self._containment: WindowsJob | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._is_authenticated = False
        #: Set when a headed launch was attempted and refused, which is the only
        #: reliable way to learn that this machine has nowhere to put a window.
        #: Per instance rather than per process, deliberately: a fresh manager
        #: is built for each browser, so this saves a second doomed attempt
        #: within one launch without cacheing a machine-wide answer that could
        #: go stale when somebody logs into a desktop session.
        self._no_window_available = False
        # False until a teardown proves Chromium exited. Pessimistic by default:
        # a launch that is cancelled before close runs must not read as clean.
        # Cleared again by every new launch, so it never speaks for a browser
        # that is currently running. See ``_begin_a_launch``.
        self._close_confirmed = False
        # The same answer, kept across calls rather than per call. ``close()``
        # takes the handles before its first await, so a cancel landing in the
        # middle leaves an object with nothing left to close and a Chromium that
        # may still be running. Answering the retry from that emptiness is what
        # released the lease and deleted the runtime directory under a live
        # browser. These two say which emptiness it is: nothing was ever
        # started, or a teardown began and never finished. Both belong to one
        # launch: ``_begin_a_launch`` decides what the next one may inherit.
        self._close_proven = False
        self._close_interrupted = False

    async def __aenter__(self) -> "BrowserManager":
        await self.start()
        return self

    async def __aexit__(
        self, exc_type: object, exc_val: object, exc_tb: object
    ) -> None:
        # Recorded rather than returned: ``__aexit__`` cannot report it, and a
        # caller that hands the profile on afterwards must be able to tell
        # whether Chromium actually exited. See :attr:`close_confirmed`.
        # Cleared first so a cancellation mid-teardown leaves it false rather
        # than claiming a shutdown that never completed.
        self._close_confirmed = False
        # Deferred rather than abandoned: the login path reads
        # :attr:`close_confirmed` from a ``finally`` and releases the profile on
        # it, so a cancel landing here would drop the one answer that decides
        # whether the profile may go. The cancel is re-raised, not swallowed.
        confirmed, cancelled = await await_deferring_cancels(self.close())
        self._close_confirmed = confirmed
        if cancelled:
            raise asyncio.CancelledError

    @property
    def _windowless(self) -> bool:
        """Whether this launch hides its page in a target rather than a mode.

        Both conditions, and the second is not a preference. Asking for no
        visible window is not enough on a machine that cannot open one: a headed
        launch there fails outright, so the only way to run at all is Chromium's
        headless mode, and the browser then says so on every surface. That is a
        loss worth announcing rather than hiding, which is why it is logged.
        """
        return (
            self.headless
            and hidden_target_is_supported()
            and not self._no_window_available
        )

    def _geometry(self) -> dict[str, Any]:
        """The viewport options, decided by the mode this browser actually runs in.

        This lives here rather than in ``build_launch_options`` because only
        this object knows the answer. The builder is a pure function of the
        configuration, and the configuration says ``headless=True`` by default
        even when the manual login is about to launch headed -- the login passes
        ``headless=False`` directly. A builder reading the configuration would
        get it wrong for exactly the launch that puts a window on screen.

        Headed gets no viewport at all, so the window reports the size it really
        is. Headless keeps an explicit one, because a headless browser with
        ``no_viewport`` collapses its screen to 800x600, which is its own
        oddity.
        """
        if self.headless:
            return {"viewport": self.viewport or {"width": 1280, "height": 720}}
        return {"no_viewport": True}

    def _executable_about_to
```

### Core Architecture Module: `linkedin_mcp_server/core/destination.py`
```
"""Whether the page a navigation ended on is one LinkedIn served."""

import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, NoReturn
from urllib.parse import urlsplit

from .exceptions import OffLinkedInLandingError

logger = logging.getLogger(__name__)

# linkedin.com and every host under it, matched whole so `evil-linkedin.com`
# and `linkedin.com.evil.test` are not. The same shape `identifiers.py` accepts
# a reference on: the root, `www`, and the locale subdomains that serve a
# profile themselves.
_LINKEDIN_HOST = re.compile(r"^(?:[a-z0-9-]+\.)*linkedin\.com$")

# The host pattern above, in the one syntax both Python and JavaScript read the
# same way, so the in-page check below cannot drift from it.
LINKEDIN_HOST_PATTERN = _LINKEDIN_HOST.pattern

# `is_linkedin_landing` for a page script, which has to decide inside its own
# evaluation, before it clicks, whether the document it is about to act on is
# LinkedIn's: the address Python saw belongs to a moment that has passed. Called
# as `(href, hostPattern)` with LINKEDIN_HOST_PATTERN.
#
# The two agree on browser-serialized addresses, which is all a page script is
# ever handed (`location.href`); `tests/test_off_linkedin_landing_dom.py` holds
# them to the same answers there. On raw strings they can differ, because the
# browser's parser normalizes what urllib keeps: IDN, percent-encoded hosts and
# Unicode separators. The `@` rule below is the one difference a raw string
# exposed that was cheap to close.
LINKEDIN_LANDING_JS = r"""(href, hostPattern) => {
    let url;
    try {
        url = new URL(href);
    } catch {
        return false;
    }
    // Any userinfo, even an empty one, as urllib reads it; the parsed URL
    // reports an empty username for `https://@host/`.
    const authority = String(href).replace(/^[^:]*:\/\//, '').split(/[/?#\\]/, 1)[0];
    if (authority.includes('@')) return false;
    const host = url.hostname.replace(/\.$/, '');
    return url.protocol === 'https:'
        && (url.port === '' || url.port === '443')
        && url.username === ''
        && url.password === ''
        && new RegExp(hostPattern).test(host);
}"""

# Reads the address of the document an element lives in, so an action is
# judged by the page holding the element rather than the page the driver last
# reported.
_OWNER_DOCUMENT_ADDRESS_JS = "element => element.ownerDocument.location.href"


def is_linkedin_landing(url: object) -> bool:
    """Return whether *url*, a page's address, is a document LinkedIn served.

    A document without a host is never one. `about:blank`, `data:` and
    `chrome-error://` are what an interrupted navigation and an enterprise
    proxy clearing the page leave behind, and calling them LinkedIn's would let
    an empty page pass as a signed-in feed. Nothing here is asked about a
    relative address: a page's own address is always absolute.
    """
    if not isinstance(url, str):
        return False
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        return False
    # A single trailing dot is the fully qualified spelling of the same host.
    host = (parsed.hostname or "").removesuffix(".")
    return (
        parsed.scheme == "https"
        and port in (None, 443)
        and parsed.username is None
        and parsed.password is None
        and _LINKEDIN_HOST.fullmatch(host) is not None
    )


def is_another_site(url: object) -> bool:
    """Return whether *url* is a web page served by a host other than LinkedIn.

    Narrower than "not a LinkedIn landing": a blank document or the browser's
    own error page is what a failed request leaves behind, and the failure
    that produced it already says more than where it landed.
    """
    if not isinstance(url, str):
        return False
    try:
        scheme = urlsplit(url).scheme
    except ValueError:
        return False
    return scheme in ("http", "https") and not is_linkedin_landing(url)


def describe_landing(url: object) -> str:
    """Name where a page landed, without its path or query.

    The origin is the useful fact, and the rest of a portal's address can carry
    a token or the whole address it intercepted.
    """
    if not isinstance(url, str) or not url:
        return "an unknown page"
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        port = parsed.port
    except ValueError:
        return "an unreadable address"
    if host:
        origin = f"{parsed.scheme}://{host}"
        return origin if port is None else f"{origin}:{port}"
    if parsed.scheme == "about":
        return f"about:{parsed.path}"[:40]
    if parsed.scheme:
        return f"a {parsed.scheme}: document"
    return "an unknown page"


def refuse_landing(url: object) -> NoReturn:
    """Raise for a page that is not LinkedIn's, whoever decided it.

    Raises:
        OffLinkedInLandingError: Always.
    """
    landed_on = describe_landing(url)
    logger.warning("Navigation ended off LinkedIn, on %s", landed_on)
    raise OffLinkedInLandingError(landed_on)


def raise_if_off_linkedin(url: object) -> None:
    """Refuse a page LinkedIn did not serve.

    Raises:
        OffLinkedInLandingError: When *url* is not a LinkedIn document.
    """
    if not is_linkedin_landing(url):
        refuse_landing(url)


@asynccontextmanager
async def linkedin_element(
    locator: Any, *, timeout: float | None = None
) -> AsyncIterator[Any]:
    """Resolve *locator* to one element, yielded only from a LinkedIn document.

    Act through the yielded handle, never through the locator. A locator
    resolves again for every action, so a redirect after this check would aim
    the click at the new page; a handle belongs to one document, and a
    navigation away fails the action instead of retargeting it.

    Raises:
        OffLinkedInLandingError: When the element's own document is not
            LinkedIn's.
    """
    if timeout is None:
        handle = await locator.element_handle()
    else:
        handle = await locator.element_handle(timeout=timeout)
    async with linkedin_handle(handle) as checked:
        yield checked


@asynccontextmanager
async def linkedin_handle(handle: Any) -> AsyncIterator[Any]:
    """Yield an element *handle* already resolved, only if its document is LinkedIn's.

    For an element no locator names, such as the one that has focus. Disposes
    of the handle on the way out, as :func:`linkedin_element` does.

    Raises:
        OffLinkedInLandingError: When the element's own document is not
            LinkedIn's.
    """
    try:
        raise_if_off_linkedin(await handle.evaluate(_OWNER_DOCUMENT_ADDRESS_JS))
        yield handle
    finally:
        try:
            await handle.dispose()
        except Exception:
            logger.debug("Could not release an element handle", exc_info=True)

```

### Core Architecture Module: `linkedin_mcp_server/core/exceptions.py`
```
"""Custom exceptions for LinkedIn operations."""


class LinkedInOperationError(Exception):
    """Base exception for LinkedIn operations."""

    pass


class InvalidReferenceError(LinkedInOperationError):
    """A caller-supplied profile, company, job or thread reference is unusable.

    Separate from the other operation errors because nothing is broken: the
    argument is wrong and the message says how to correct it. `raise_tool_error`
    keeps it free of issue-report diagnostics for that reason.
    """

    pass


class AuthenticationError(LinkedInOperationError):
    """Raised when authentication fails."""

    pass


class AccountRestrictedError(LinkedInOperationError):
    """LinkedIn restricted the account and wants identity verification.

    Deliberately not an ``AuthenticationError``: every tool routes that class
    into ``handle_auth_error``, which retires the session state and opens a
    login window. No login can lift a restriction, so that recovery would
    discard the session and then wait for a sign-in that cannot complete.
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            message
            or (
                "LinkedIn has restricted access to this account and asks for "
                "identity verification. Resolve it on linkedin.com in your own "
                "browser. The server will not open a login window or retry; "
                "once LinkedIn lifts the restriction, run --login."
            )
        )


class RateLimitError(LinkedInOperationError):
    """Raised when rate limiting is detected."""

    def __init__(self, message: str, suggested_wait_time: int = 300):
        super().__init__(message)
        self.suggested_wait_time = suggested_wait_time


class ElementNotFoundError(LinkedInOperationError):
    """Raised when an expected element is not found."""

    pass


class ProfileNotFoundError(LinkedInOperationError):
    """Raised when a profile/page returns 404."""

    pass


class NetworkError(LinkedInOperationError):
    """Raised when network-related issues occur."""

    pass


class ProxyConnectionError(NetworkError):
    """Raised when the configured proxy cannot carry the request.

    A subclass of :class:`NetworkError` on purpose. A proxy outage arrives as a
    failed navigation, which the auth checks would otherwise read as an invalid
    session and answer with "run --login" -- advice that cannot help and that
    retires a perfectly good profile. Keeping it a network error also means any
    handler that has not learned about proxies yet still degrades sensibly.
    """

    pass


class OffLinkedInLandingError(NetworkError):
    """A navigation ended on a page LinkedIn did not serve.

    A captive portal, a proxy interstitial or a web filter answers in
    LinkedIn's place, and its page would otherwise be read as the profile or
    job that was asked for. A network error and not an ``AuthenticationError``
    for the same reason as :class:`ProxyConnectionError`: the stored session
    says nothing about the network in front of it, and the login that recovery
    would open has to go through the very page that is in the way.
    """

    def __init__(self, landed_on: str):
        super().__init__(
            f"The browser landed on {landed_on} instead of LinkedIn, so nothing "
            "was read. A captive portal, proxy or network filter is likely "
            "answering in LinkedIn's place. Open linkedin.com in a normal "
            "browser on this network, clear whatever page it shows, then retry. "
            "The stored LinkedIn session was kept."
        )
        self.landed_on = landed_on


class PageReadError(LinkedInOperationError):
    """Raised when reading a page fails for various reasons."""

    pass

```

### Core Architecture Module: `linkedin_mcp_server/core/proxy_errors.py`
```
"""Recognition and safe reporting of proxy failures.

A misconfigured or unreachable proxy does not fail at browser launch. Chromium
starts normally and the failure lands on the first navigation, where the auth
checks read it as a dead session. These helpers let those call sites tell the
two apart before they draw that conclusion.
"""

import asyncio
import logging
from typing import Any
from urllib.parse import quote

from patchright.async_api import TimeoutError as PlaywrightTimeoutError

from linkedin_mcp_server.config.schema import BrowserConfig

from .exceptions import ProxyConnectionError

logger = logging.getLogger(__name__)


def _browser_config() -> BrowserConfig:
    """Return the active browser config, or defaults if it cannot be read.

    These helpers run on the failure path, so they must never raise on their
    own. Falling back to an unconfigured instance costs only the proxy address
    in the message; it keeps the original error from being replaced by whatever
    went wrong while reporting it.

    """
    try:
        from linkedin_mcp_server.config import get_config

        return get_config().browser
    except Exception:
        return BrowserConfig()


# Chromium network-stack errors that mean the proxy itself is the problem, not
# LinkedIn and not the stored session. Matched case-insensitively as substrings,
# mirroring the marker-list helpers in linkedin_mcp_server.dependencies.
PROXY_ERROR_MARKERS = (
    "err_proxy_connection_failed",
    "err_tunnel_connection_failed",
    "err_proxy_auth_requested",
    "err_proxy_certificate_invalid",
    "err_unexpected_proxy_auth",
    "err_socks_connection_failed",
    "err_socks_connection_host_unreachable",
    "err_no_supported_proxies",
    "err_mandatory_proxy_configuration_failed",
    "err_proxy_unable_to_connect_to_destination",
)

# Rejected credentials. Kept apart because the code does not name the proxy:
# it can equally mean a site's own HTTP auth failed, so it only counts when a
# proxy is actually configured.
AMBIGUOUS_AUTH_MARKERS = ("err_invalid_auth_credentials",)


def is_proxy_error(error: BaseException) -> bool:
    """Return whether *error* reports a failure of the configured proxy."""
    if isinstance(error, ProxyConnectionError):
        return True
    message = str(error).lower()
    if any(marker in message for marker in PROXY_ERROR_MARKERS):
        return True
    return bool(_browser_config().proxy_server) and any(
        marker in message for marker in AMBIGUOUS_AUTH_MARKERS
    )


def redact_proxy_credentials(message: str) -> str:
    """Strip the configured proxy credentials from *message*.

    Error text from the driver can quote the proxy URL, and the top-level
    handlers log exceptions with their full cause chain. The username is masked
    alongside the password because residential providers encode the account,
    zone and session in it. Percent-encoded forms are covered too, since that is
    how credentials appear inside a URL.
    """
    config = _browser_config()
    for secret in (config.proxy_password, config.proxy_username):
        if not secret:
            continue
        for variant in (secret, quote(secret, safe="")):
            message = message.replace(variant, "***")
    return message


def as_proxy_error(error: BaseException) -> ProxyConnectionError:
    """Convert *error* into a credential-free :class:`ProxyConnectionError`.

    The original exception is deliberately not chained: the top-level handlers
    call ``logger.exception``, which prints the whole cause chain and would put
    the raw driver message -- possibly including the proxy URL -- back into the
    log this redaction exists to keep clean.
    """
    if isinstance(error, ProxyConnectionError):
        return error
    server = _browser_config().proxy_server or "the configured proxy"
    detail = redact_proxy_credentials(str(error))
    return ProxyConnectionError(
        f"Could not reach LinkedIn through proxy {server}: {detail}. "
        "Check that the proxy is running and that its address and credentials "
        "are correct. The saved LinkedIn session was not changed."
    )


def raise_if_proxy_error(error: BaseException) -> None:
    """Re-raise *error* as a :class:`ProxyConnectionError` when it is one."""
    if is_proxy_error(error):
        raise as_proxy_error(error) from None


def redacted_copy(error: Exception) -> Exception:
    """Return *error* with the proxy credentials stripped from its message.

    For re-raising across a boundary that logs exceptions. The type is
    preserved so callers branching on it are unaffected; only the message is
    rewritten. Exceptions whose constructor takes more than a message are
    returned unchanged rather than being rebuilt wrongly -- losing the
    redaction is better than losing the error.
    """
    message = str(error)
    redacted = redact_proxy_credentials(message)
    if redacted == message:
        return error
    try:
        return type(error)(redacted)
    except Exception:
        return ProxyConnectionError(redacted)


def raise_if_proxy_configured(error: BaseException) -> None:
    """Re-raise a failed navigation as a proxy fault when a proxy is in use.

    For callers that would otherwise read a navigation failure as a dead
    session. Not every proxy failure identifies itself: wrong credentials
    produce a plain timeout, because Chromium retries the 407 challenge until
    the navigation expires. Attributing an unexplained failure to the proxy is
    the safe reading -- it leaves the stored session alone, where the opposite
    mistake discards a working profile and reruns login through the same broken
    proxy.
    """
    if not _browser_config().proxy_server:
        return
    if is_proxy_error(error):
        raise as_proxy_error(error) from None
    server = _browser_config().proxy_server
    detail = redact_proxy_credentials(str(error))
    raise ProxyConnectionError(
        f"LinkedIn could not be reached through proxy {server}: {detail}. "
        "Wrong proxy credentials look exactly like this, because the browser "
        "retries the challenge until the page times out. Check the proxy "
        "address and credentials. The saved LinkedIn session was not changed."
    ) from None


#: The product's navigation budget, in milliseconds, counted from the moment
#: the browser sends the navigation request. Patchright's own default is the
#: same number but starts at the ``goto`` call. On a Windows runner the first
#: request of a fresh browser is not sent for seconds after that call (1.1s to
#: 2.5s on a green idle leg; a loaded one never sent it inside 30s), so a clock
#: that starts at the call expires before the origin has anything to answer.
#: A held request is inside this budget: the gate's 20s deadline leaves the
#: answer ten seconds, and the relay drops a silent tunnel at 30s.
NAVIGATION_BUDGET_MS = 30_000
#: How long to wait for the browser to send the request at all. A wedged
#: browser never emits one, and the navigation budget cannot start then, so
#: this cap is what ends the call. It is not part of the navigation budget.
STARTUP_BUDGET_MS = 30_000


def _page_reports_requests(page: Any) -> bool:
    """Whether *page* is a real page, not a stand-in whose ``on`` is invented.

    A mock grows ``on`` the moment it is asked for, and treating that as a
    listener would wait for a request the stand-in never emits. A method that
    exists on the class is one the page actually has.
    """
    kind = type(page)
    return callable(getattr(kind, "on", None)) and callable(
        getattr(kind, "remove_listener", None)
    )


def _is_main_frame_navigation(page: Any, request: Any) -> bool:
    """Whether *request* is the navigation ``goto`` is waiting on.

    A subresource, or a frame that is not the page's main one, must not start
    the budget: the answer the gate holds is the main document.
    """
    is_navigation = getattr(request, "is_navigation_request", None)
    if callable(is_navigation) and not is_navigation():
        return False
    frame = getattr(request, "frame", None)
    main = getattr(page, "main_frame", None)
    return frame is None or main is None or frame is main


async def _stop_goto(goto: asyncio.Future[Any]) -> None:
    """Cancel a ``goto`` that is still running, and wait until it has stopped."""
    if goto.done():
        return
    goto.cancel()
    await asyncio.shield(asyncio.gather(goto, return_exceptions=True))


async def _goto_within_budget(page: Any, url: str, **kwargs: Any) -> Any:
    """``page.goto``, with :data:`NAVIGATION_BUDGET_MS` starting at the request.

    A caller that passes ``timeout`` sets that budget. ``0`` keeps Patchright's
    meaning, no limit. A page that cannot report its requests is unchanged:
    the driver's own clock applies, which is the only clock it has.
    """
    caller_set_timeout = "timeout" in kwargs
    timeout = kwargs.pop("timeout", None)
    if not _page_reports_requests(page):
        if caller_set_timeout:
            kwargs["timeout"] = timeout
        return await page.goto(url, **kwargs)
    if timeout is None:
        timeout = NAVIGATION_BUDGET_MS
    if timeout == 0:
        return await page.goto(url, timeout=0, **kwargs)

    sent: asyncio.Future[None] = asyncio.get_running_loop().create_future()

    def on_request(request: Any) -> None:
        if sent.done() or not _is_main_frame_navigation(page, request):
            return
        sent.set_result(None)

    page.on("request", on_request)
    # ``timeout=0`` turns the driver's clock off. It would otherwise include
    # the time before this browser sends anything, which is not the navigation.
    goto = asyncio.ensure_future(page.goto(url, timeout=0, **kwargs))
    try:
        await asyncio.wait(
            {goto, sent},
            timeout=STARTUP_BUDGET_MS / 1000,
            return_when=asyncio.FIRST_COMPLETED,
        )
        if not goto.done() and not sent.done
```

### Core Architecture Module: `linkedin_mcp_server/core/utils.py`
```
"""Utility functions for page-reading operations."""

import asyncio
import logging
import time
from typing import Any

import anyio
from patchright.async_api import (
    JSHandle,
    Page,
    TimeoutError as PlaywrightTimeoutError,
)

from .destination import linkedin_element
from .exceptions import OffLinkedInLandingError, RateLimitError

logger = logging.getLogger(__name__)

# Both card shapes. The classic result is an anchor to the job permalink;
# the redesigned search at `/jobs/search-results` renders cards that carry no
# permalink at all and keep the id only in `componentkey`. A selector matching
# just the anchor finds nothing there, which is what made the search return an
# empty `job_ids` while its text listed real jobs.
_JOB_CARD_SELECTOR = 'a[href*="/jobs/view/"], [componentkey^="job-card-component-ref-"]'

# The rule that decides which container holds the search results. Shared
# verbatim by the scroll and by id extraction, because extraction re-runs it
# rather than trusting a mark the scroll left behind: an attribute dies with
# the node it sits on, a re-render between the scroll returning and the ids
# being read leaves none, and nothing then distinguishes that from a page
# nobody scrolled. Everything outside the rail is not a search result: the
# detail pane carries its own permalink and, once opened, a similar-jobs
# module, and counting those advances the offset past results the rail never
# showed. Expects `selector` in scope.
_RAIL_PICK_JS = r"""
            const idOf = (node) => {
                const href = (node.getAttribute('href') || '').match(
                    /\/jobs\/view\/(?:[^/?#]*-)?(\d+)(?=[/?#]|$)/
                );
                if (href) return href[1];
                // The redesigned card has no permalink, so the attribute is
                // the only place the id exists. Anchored at the start, since
                // the selector already matched that prefix and a bare
                // `includes` would accept an unrelated key holding it.
                const key = (node.getAttribute('componentkey') || '').match(
                    /^job-card-component-ref-(\d+)/
                );
                return key ? key[1] : null;
            };
            const idsIn = (scope) => {
                const ids = new Set();
                for (const node of scope.querySelectorAll(selector)) {
                    const id = idOf(node);
                    if (id) ids.add(id);
                }
                return ids.size;
            };

            // Every scrollable ancestor of every card, collected fresh on
            // each pick because a re-render replaces the nodes. Scrollable by
            // its own overflow style and not by whether it currently
            // overflows: a result set short enough to fit inside the rail
            // left the rail out of the candidates entirely, and the detail
            // pane, which overflows on one job description, won by default.
            // Measured live on a full page: dropping the size test adds one
            // candidate, the pane's own parent at one job id, and nothing
            // that holds the rail and the pane together.
            const collect = () => {
                const found = [];
                for (const card of document.querySelectorAll(selector)) {
                    let node = card.parentElement;
                    while (node && node !== document.body) {
                        const style = window.getComputedStyle(node);
                        const overflowY = style.overflowY;
                        if ((overflowY === 'auto' || overflowY === 'scroll')
                            && !found.includes(node)) {
                            found.push(node);
                        }
                        node = node.parentElement;
                    }
                }
                return found;
            };

            // Most job ids wins, and a tie is not broken but kept: every
            // candidate holding the winning count is scrolled. Picking one
            // loses either way round, because a tie means one candidate
            // contains the other and only the inner one appends cards.
            // Measured on both shapes: a per-card wrapper inside a rail that
            // has rendered a single card leaves the rail unscrolled at one
            // card, and a scrollable container wrapping the rail leaves it
            // unscrolled at five. Live the two candidates are siblings, rail
            // 7 ids and pane 1, so the tie itself has not been observed;
            // scrolling both costs one extra assignment when it happens.
            const railGroup = () => {
                const nodes = collect();
                let best = 0;
                for (const node of nodes) {
                    best = Math.max(best, idsIn(node));
                }
                return best ? nodes.filter(n => idsIn(n) === best) : [];
            };

            // One node still represents the group for measuring growth: the
            // outermost of the tied, so its id count covers every card the
            // inner ones append.
            const pickRail = () => {
                let picked = null;
                for (const node of railGroup()) {
                    if (!picked || node.contains(picked)) picked = node;
                }
                return picked;
            };
"""

# One look at the rail and, when asked, one scroll of it. Synchronous on
# purpose: every wait and every repeat belongs to `scroll_job_sidebar`, so a
# cancelled call has nothing left running in the page. Cancelling the task that
# awaits `page.evaluate()` does not cancel a promise the page is running, and
# the polling loop that used to live here went on scrolling the shared page
# after a tool timeout had handed it to the next call (#763).
#
# The rail a step measured is kept in `holder`, an object only the caller's
# handle reaches, and stays the rail while it is attached and still ties the
# pick. Measuring whichever candidate wins instead compares one container's
# height against another's: a taller tied container appearing mid-wait then
# reads as a batch, which spends one of `maxScrolls` and can end the page with
# the batch still in flight. Only the node itself identifies it. Its position
# does not: wrapping the rail, or inserting a tied sibling before it, puts
# another container where the rail was. A rail a re-render detached is
# replaced by a fresh pick, which is what adopting a replacement always did.
_RAIL_STEP_JS = (
    r"""(opts) => {
            const {selector, scroll, holder} = opts;
"""
    + _RAIL_PICK_JS
    + r"""
            if (!document.querySelectorAll(selector).length) {
                return {status: 'gone'};
            }
            const tied = railGroup();
            let picked = null;
            for (const node of tied) {
                if (!picked || node.contains(picked)) picked = node;
            }
            if (!picked) return {status: 'no-container'};
            // `tied` holds attached nodes only, so a rail a re-render
            // detached falls back to the pick here.
            const kept = holder.rail;
            const rail = kept && tied.includes(kept) ? kept : picked;
            holder.rail = rail;

            // Measured before the scroll, so the batch it asks for reads as
            // growth against this step.
            const measured = {
                status: 'ok',
                cards: idsIn(rail),
                height: rail.scrollHeight,
            };
            if (scroll) {
                // Only the tied candidates nested with the pick. Two tied
                // siblings are the live shape, rail and detail pane, and
                // scrolling the pane loads its similar-jobs module into the
                // document, where the caller reads those ids as search
                // results. Measured on a 6-to-6 tie: the pane reached 31 ids
                // and the search returned 37, of which 31 were not results,
                // while the rail stayed at 6 because growth was then read
                // off the pane instead.
                for (const node of tied) {
                    if (node === picked
                        || node.contains(picked) || picked.contains(node)) {
                        node.scrollTop = node.scrollHeight;
                    }
                }
            }
            return measured;
        }"""
)

# How long a cancelled call waits for a scroll step it has already sent. A
# renderer busy with a long task holds the step in its queue, and a cancel does
# not take it back out: measured behind a 1s task, the rail scrolled about
# 0.9s after the cancel had released the page to the next call. The wait is
# bounded so that a page that never answers cannot hold the page lock forever.
_SENT_SCROLL_GRACE = 5.0


async def _rail_step(page: Page, holder: JSHandle, *, scroll: bool) -> dict[str, Any]:
    """Measure the rail, scrolling it afterwards when ``scroll`` is set.

    A step that only measures writes nothing, so a cancel may abandon it. A
    step that scrolls is waited for: until it has run, the page may still move
    after this call has given it up.
    """
    step = asyncio.ensure_future(
        page.evaluate(
            _RAIL_STEP_JS,
            {"selector": _JOB_CARD_SELECTOR, "scroll": scroll, "holder": holder},
        )
    )
    if not scroll:
        return await step
    try:
        return await asyncio.shield(step)
    except asyncio.CancelledError:
        await _let_the_scroll_land(step)
        raise


async def _let_the_scroll_land(step: asyncio.Future[Any]) -> None:
    """Wait, within the grace period, for a sent scroll step to finish.

    Shielded from AnyIO as well as from asyncio: a tool timeout is an AnyIO
    cancel scope, which cancels the task again on every pass of the event loop
    and would end a plain wait at once. A 
```

### Core Architecture Module: `linkedin_mcp_server/debug_utils.py`
```
"""Shared debug-only helpers for slower, traceable navigation flows."""

from __future__ import annotations

import asyncio
import logging
import os

_NAV_STABILIZE_DELAY_SECONDS = 5.0


def debug_stabilize_navigation_enabled() -> bool:
    """Return whether debug-only navigation stabilization sleeps are enabled."""
    return os.getenv("LINKEDIN_DEBUG_STABILIZE_NAVIGATION", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


async def stabilize_navigation(label: str, logger: logging.Logger) -> None:
    """Pause between navigation steps to help debug timing-sensitive flows."""
    if (
        os.environ.get("PYTEST_CURRENT_TEST")
        or not debug_stabilize_navigation_enabled()
    ):
        return

    logger.debug(
        "Stabilizing navigation for %.1fs after %s",
        _NAV_STABILIZE_DELAY_SECONDS,
        label,
    )
    await asyncio.sleep(_NAV_STABILIZE_DELAY_SECONDS)

```

### Core Architecture Module: `linkedin_mcp_server/installer_worker.py`
```
"""Run Patchright inside the worker group owned by the supervisor."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
from typing import NoReturn

from linkedin_mcp_server.process_protocol import NONCE_LENGTH, valid_nonce

_FINISHED = "finished"


def _supervisor_eof(reached: threading.Event) -> None:
    try:
        os.read(sys.stdin.fileno(), 1)
    finally:
        reached.set()


def _await_nonce() -> str | None:
    """Consume the status token without buffering past the stdin lease frame."""
    frame = bytearray()
    while len(frame) <= NONCE_LENGTH:
        piece = os.read(sys.stdin.fileno(), 1)
        if not piece:
            return None
        if piece == b"\n":
            try:
                nonce = frame.decode("ascii")
            except UnicodeDecodeError:
                return None
            return nonce if valid_nonce(nonce) else None
        frame.extend(piece)
    return None


def _command(argv: list[str]) -> list[str]:
    args = argv[1:]
    if args[:1] == ["--"]:
        args = args[1:]
    if not args:
        raise ValueError("The installer worker was started without a command")
    return args


def _stop_without_supervisor(returncode: int) -> NoReturn:
    """End the installer group when the process owning our lease is gone."""
    if os.name != "nt":
        os.killpg(os.getpgrp(), signal.SIGKILL)
    os._exit(returncode)


def main(argv: list[str] | None = None) -> int:
    """Run Patchright while the supervisor owns our private control pipe."""
    argv = sys.argv if argv is None else argv
    nonce = _await_nonce()
    if nonce is None:
        return 1

    supervisor_gone = threading.Event()
    threading.Thread(
        target=_supervisor_eof,
        args=(supervisor_gone,),
        name="installer-supervisor-lease",
        daemon=True,
    ).start()
    if supervisor_gone.wait(0):
        return 1

    # The supervisor launched this worker as the process-group leader. Keeping
    # Patchright in that group lets the supervisor pin the PGID with this
    # worker's unreaped exit status before sending any numeric group signal.
    try:
        target = subprocess.Popen(
            _command(argv),
            # Never the lease. The thread above holds a blocking read on this
            # process's stdin, and on Windows the parent's stdin is an asyncio
            # named pipe whose child end is a synchronous handle: a target that
            # inherits it queues its own first operation behind that read, which
            # only ends when the parent lets go. Measured on a Windows runner,
            # the target process existed for the whole run and never executed a
            # line, writing no marker and no output. Withholding the handle
            # fixes it, and so does dropping the read; the target has no use for
            # a control channel either way.
            stdin=subprocess.DEVNULL,
            stdout=None,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
            close_fds=True,
        )
    except OSError as exc:
        try:
            print(
                f"Patchright target could not start: {exc}",
                file=sys.stdout,
                flush=True,
            )
        except OSError:
            pass
        return 70
    if supervisor_gone.is_set():
        _stop_without_supervisor(1)

    while True:
        returncode = target.poll()
        if returncode is not None:
            if supervisor_gone.is_set():
                _stop_without_supervisor(returncode)
            try:
                print(
                    f"{_FINISHED} {nonce} {returncode}",
                    file=sys.stderr,
                    flush=True,
                )
            except OSError:
                _stop_without_supervisor(returncode)
            # Stay alive as the process-group identity until the supervisor has
            # killed and reaped the whole group. Its control pipe also closes if
            # it dies between receiving the status and doing that cleanup.
            supervisor_gone.wait()
            _stop_without_supervisor(returncode)
        if supervisor_gone.wait(0.05):
            _stop_without_supervisor(1)


if __name__ == "__main__":  # pragma: no cover - process entry point
    sys.exit(main())

```

### Core Architecture Module: `linkedin_mcp_server/private_state.py`
```
"""Storage that only this user account can read.

The daemon work needs somewhere to keep a bearer token, and a token file that
any local account can read is the same as no token at all. POSIX already has an
answer in ``common_utils``: ``0700`` on the directory, ``0600`` on the file.
Windows does not, because ``os.chmod`` there only toggles the read-only
attribute and leaves the ACL, which is what actually decides access, untouched.

So this module owns one promise, made the same way on both platforms and
checked rather than assumed: after :func:`harden_directory` or
:func:`harden_file` returns, no other account can read the path. If that cannot
be arranged, it raises. Nothing here degrades to a warning, because the caller's
next step is to write a secret.

On Windows a normal user profile is already closed to other non-administrator
accounts, so the ACL work below is defence in depth rather than the only thing
standing in the way. It earns its place when the profile has been redirected,
when a parent directory was created with wider permissions, or when the auth
root lives somewhere outside the profile entirely. Neither platform's mechanism
keeps out root or an administrator, and no file permission ever has.
"""

from __future__ import annotations

import ctypes
import ctypes.util
import errno
import logging
import os
import stat
import sys
import tempfile
import threading
import contextlib
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path

from linkedin_mcp_server.common_utils import is_still_at, secure_mkdir

logger = logging.getLogger(__name__)

_PRIVATE_DIR_MODE = 0o700
_PRIVATE_FILE_MODE = 0o600

_WINDOWS = os.name == "nt"
_MACOS = sys.platform == "darwin"


class PrivateStateError(RuntimeError):
    """Owner-only storage could not be established.

    Always fatal to the operation that asked for it. A caller that catches this
    and carries on is working with a path whose permissions were never
    established, and its next step is usually to write a secret there.
    """


def _refuse_windows_reparse_point(path: Path, entry: os.stat_result) -> None:
    """Reject a Windows entry whose pathname can redirect directory access."""
    attributes = getattr(entry, "st_file_attributes", None)
    if attributes is None:
        raise PrivateStateError(
            f"Windows did not report file attributes for {path}, so it cannot be "
            f"established that this is an ordinary private directory"
        )
    if not attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        return

    tag = getattr(entry, "st_reparse_tag", None)
    tag_detail = "" if tag is None else f" (reparse tag {tag:#x})"
    raise PrivateStateError(
        f"{path} is a Windows reparse point{tag_detail} rather than a private directory"
    )


def _same_entry(first: os.stat_result, second: os.stat_result) -> bool:
    """Whether two metadata reads identify the same filesystem entry."""
    return (first.st_dev, first.st_ino) == (second.st_dev, second.st_ino)


@contextmanager
def _as_private_state_error(path: Path, action: str) -> Iterator[None]:
    """Turn a filesystem failure into this module's own error.

    Every entry point here promises to raise :class:`PrivateStateError` when it
    cannot establish owner-only storage. The operating system does not know
    that, so a file where a directory belongs, an unreadable parent, or a path
    that vanishes mid-flight arrives as NotADirectoryError, PermissionError or
    FileNotFoundError and crosses the boundary as itself. Measured: a file at
    the state root surfaced as NotADirectoryError from inside a lock
    acquisition, several layers from anything that could explain it.
    """
    try:
        yield
    except PrivateStateError:
        raise
    except (OSError, RuntimeError, ValueError) as exc:
        # RuntimeError and ValueError alongside OSError: a home directory that
        # cannot be determined raises the first, an embedded NUL the second,
        # and both arrive from a path a caller was entitled to hand over.
        raise PrivateStateError(f"Could not {action} {path}: {exc}") from exc


def _windows_private_creation_supported() -> bool:
    return not _WINDOWS or sys.version_info >= (3, 12, 4)


def harden_created_directory(path: Path) -> None:
    """Verify and harden a directory just created by this process.

    Python 3.12.4 made ``mode=0o700`` create a restricted Windows DACL. That
    closes the creation-to-hardening window for non-administrator accounts;
    the stricter project DACL is then installed and read back. Older Windows
    patch releases are refused because post-creation repair cannot undo access
    another account may already have obtained.
    """
    with _as_private_state_error(path, "prepare the new private directory"):
        entry = path.lstat()
        if stat.S_ISLNK(entry.st_mode):
            raise PrivateStateError(
                f"{path} is a symbolic link rather than a private directory"
            )
        if not stat.S_ISDIR(entry.st_mode):
            raise PrivateStateError(f"Not a directory: {path}")
        if _WINDOWS:
            if not _windows_private_creation_supported():
                raise PrivateStateError(
                    "Private directory creation on Windows requires Python "
                    "3.12.4 or newer"
                )
            _refuse_windows_reparse_point(path, entry)
            from linkedin_mcp_server.windows_acl import restrict_to_current_user

            restrict_to_current_user(path, directory=True)
            current = path.lstat()
            _refuse_windows_reparse_point(path, current)
            if not _same_entry(entry, current):
                raise PrivateStateError(
                    f"{path} was replaced while it was being hardened"
                )
            return
        _harden_posix(path, _PRIVATE_DIR_MODE)


def harden_directory(path: Path) -> None:
    """Create owner-only storage or verify an existing private directory.

    Existing Windows directories are verified without rewriting their owner or
    DACL. A permissive legacy directory may have outstanding handles whose
    rights survive an ACL change, so normalizing it and continuing would turn a
    path another account can still replace into trusted state.
    """
    with _as_private_state_error(path, "prepare the private directory"):
        if str(path).startswith("~"):
            raise PrivateStateError(
                f"{path} still begins with a tilde, so the home directory it "
                f"names could not be resolved"
            )
        existed = path.exists()
        if existed and not path.is_dir():
            raise PrivateStateError(f"Not a directory: {path}")
        if _WINDOWS and not existed and not _windows_private_creation_supported():
            raise PrivateStateError(
                "Private directory creation on Windows requires Python 3.12.4 or newer"
            )
        secure_mkdir(path, mode=_PRIVATE_DIR_MODE)
        if _WINDOWS:
            if existed:
                from linkedin_mcp_server.windows_acl import verify_owner_only

                verify_owner_only(path, directory=True)
            else:
                # Every missing component was created with Python's restricted
                # 0o700 DACL before this pathname became observable.
                harden_created_directory(path)
            return
        _harden_posix(path, _PRIVATE_DIR_MODE)


def harden_directory_entry(path: Path) -> None:
    """Create and harden *path* without following its final component.

    This is for an application-owned child inside a directory that is already
    private. A symbolic link there is state planted before the parent became
    private, not part of a user-selected layout, so following it would harden and
    trust storage somewhere else. Existing non-directory entries are refused for
    the same reason.
    """
    with _as_private_state_error(path, "prepare the private directory"):
        try:
            entry = path.lstat()
        except FileNotFoundError:
            if _WINDOWS:
                if not _windows_private_creation_supported():
                    raise PrivateStateError(
                        "Private directory creation on Windows requires Python "
                        "3.12.4 or newer"
                    )
                staged = Path(tempfile.mkdtemp(prefix=".private-", dir=path.parent))
                try:
                    harden_created_directory(staged)
                    staged_entry = staged.lstat()
                    try:
                        staged.rename(path)
                    except FileExistsError:
                        entry = path.lstat()
                    else:
                        published = path.lstat()
                        if not _same_entry(staged_entry, published):
                            raise PrivateStateError(
                                f"{path} changed while its private directory was "
                                "being published"
                            )
                        return
                finally:
                    with contextlib.suppress(OSError):
                        staged.rmdir()
            else:
                try:
                    path.mkdir(mode=_PRIVATE_DIR_MODE)
                except FileExistsError:
                    pass
                entry = path.lstat()

        if stat.S_ISLNK(entry.st_mode):
            raise PrivateStateError(
                f"{path} is a symbolic link rather than a private directory"
            )
        if _WINDOWS:
            _refuse_windows_reparse_point(path, entry)
        if not stat.S_ISDIR(entry.st_mode):
            raise PrivateStateError(f"Not a directory: {path}")

        if _WINDOWS:
            from linkedin_mcp_server.windows_acl import verify_owner_only

            verify_owner_only(path, directory=True)
       
```

### Core Architecture Module: `linkedin_mcp_server/session_state.py`
```
"""Runtime-aware authentication state for cross-platform profile reuse."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
import ctypes
from dataclasses import asdict, dataclass, fields
import functools
import json
import logging
import os
import platform
from pathlib import Path
import re
import shutil
import socket
import sys
import time
from collections.abc import Callable, Iterator
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from linkedin_mcp_server.common_utils import (
    secure_mkdir,
    secure_write_text,
    utcnow_iso,
)
from linkedin_mcp_server.config import get_config

if TYPE_CHECKING:
    from linkedin_mcp_server.profile_lease import ProfileLease

logger = logging.getLogger(__name__)

_SOURCE_STATE_FILE = "source-state.json"
_RUNTIME_STATE_FILE = "runtime-state.json"
_RUNTIME_PROFILES_DIR = "runtime-profiles"

# Prefix of the timestamped directories retired auth state is moved into.
QUARANTINE_PREFIX = "invalid-state-"

# Chromium writes a profile it owns three Singleton* links and removes them on a
# clean exit. Only this one encodes the owner as ``<hostname>-<pid>``; the
# siblings hold a socket path and an opaque token, so they cannot be attributed
# and are ignored. A crash leaves the link behind, so presence alone proves
# nothing — see ``profile_in_use_by``.
_CHROMIUM_LOCK_NAME = "SingletonLock"


@dataclass
class SourceState:
    version: int
    source_runtime_id: str
    login_generation: str
    created_at: str
    profile_path: str
    cookies_path: str


@dataclass
class RuntimeState:
    version: int
    runtime_id: str
    source_runtime_id: str
    source_login_generation: str
    created_at: str
    committed_at: str
    profile_path: str
    storage_state_path: str
    commit_method: str


_SOURCE_STATE_FIELDS = frozenset(field.name for field in fields(SourceState))
_RUNTIME_STATE_FIELDS = frozenset(field.name for field in fields(RuntimeState))


def canonical(profile_dir: Path) -> Path:
    """Expand and resolve one profile path, the only way this module spells it.

    Both halves, everywhere, and the pairing is what was missing. Expanding
    without resolving and resolving without expanding used to sit side by side
    here: ``get_source_profile_dir`` did the first, ``auth_root_dir`` the
    second. An ordinary relative path survives that split, because it denotes
    the same object as its ``resolve()`` for as long as the working directory
    holds. **A symlink does not.** ``shutil.move`` relocates the link itself
    while the sidecars are computed from the target's parent, so a rotation
    would move the profile out of one directory and its cookies out of another,
    and afterwards the same name would resolve against its lexical parent
    instead. One session, split across two roots, with no error anywhere.
    """
    return profile_dir.expanduser().resolve()


def get_source_profile_dir() -> Path:
    """Return the configured source profile directory."""
    return canonical(Path(get_config().browser.user_data_dir))


def auth_root_dir(source_profile_dir: Path | None = None) -> Path:
    """Return the root directory containing auth artifacts."""
    profile_dir = source_profile_dir or get_source_profile_dir()
    return canonical(profile_dir).parent


def portable_cookie_path(source_profile_dir: Path | None = None) -> Path:
    """Return the portable cookie export path."""
    return auth_root_dir(source_profile_dir) / "cookies.json"


def source_state_path(source_profile_dir: Path | None = None) -> Path:
    """Return the source session metadata path."""
    return auth_root_dir(source_profile_dir) / _SOURCE_STATE_FILE


def runtime_profiles_root(source_profile_dir: Path | None = None) -> Path:
    """Return the root directory for derived runtime profiles."""
    return auth_root_dir(source_profile_dir) / _RUNTIME_PROFILES_DIR


def runtime_dir(runtime_id: str, source_profile_dir: Path | None = None) -> Path:
    """Return the directory for one runtime's derived session."""
    return runtime_profiles_root(source_profile_dir) / runtime_id


def runtime_profile_dir(
    runtime_id: str, source_profile_dir: Path | None = None
) -> Path:
    """Return the profile directory for one runtime's derived session."""
    return runtime_dir(runtime_id, source_profile_dir) / "profile"


def runtime_state_path(runtime_id: str, source_profile_dir: Path | None = None) -> Path:
    """Return the metadata path for one runtime's derived session."""
    return runtime_dir(runtime_id, source_profile_dir) / _RUNTIME_STATE_FILE


def runtime_storage_state_path(
    runtime_id: str, source_profile_dir: Path | None = None
) -> Path:
    """Return the storage-state snapshot path for one runtime's derived session."""
    return runtime_dir(runtime_id, source_profile_dir) / "storage-state.json"


def profile_exists(profile_dir: Path | None = None) -> bool:
    """Check if a browser profile directory exists and is non-empty."""
    profile_dir = canonical(profile_dir or get_source_profile_dir())
    return profile_dir.is_dir() and any(profile_dir.iterdir())


def get_runtime_id() -> str:
    """Return a deterministic identity for the current browser runtime."""
    system, machine = _platform_names()
    os_name = _normalize_os(system)
    arch = _normalize_arch(machine)
    runtime_kind = "container" if _is_container_runtime() else "host"
    return f"{os_name}-{arch}-{runtime_kind}"


def _platform_names() -> tuple[str, str]:
    """Name the OS and the processor architecture, never over WMI.

    ``platform.system()`` and ``platform.machine()`` are both
    ``platform.uname()``, which on Windows runs two WMI queries, and a WMI
    query can take a CPython 3.12 process down with it (#838). Windows is
    therefore decided from ``sys.platform``: asking in order to decide whether
    to avoid asking would defeat it.

    See ``docs/decisions/2026-09-19-windows-runtime-identity.md``.
    """
    if sys.platform != "win32":
        return platform.system(), platform.machine()
    return "Windows", (
        _native_machine_win32()
        or os.environ.get("PROCESSOR_ARCHITEW6432", "")
        or os.environ.get("PROCESSOR_ARCHITECTURE", "")
    )


# IMAGE_FILE_MACHINE values returned by IsWow64Process2. The spellings are the
# ones CPython 3.12 produced from Win32_Processor.Architecture, so a stripped
# environment keeps the runtime directory it used before the WMI removal.
_WINDOWS_MACHINE_TYPES = {
    0x014C: "x86",
    0x0162: "MIPS",
    0x0166: "MIPS",
    0x0168: "MIPS",
    0x0169: "MIPS",
    0x0184: "Alpha",
    0x01C0: "ARM",
    0x01C2: "ARM",
    0x01C4: "ARM",
    0x01F0: "PowerPC",
    0x0200: "ia64",
    0x8664: "AMD64",
    0xAA64: "ARM64",
}

# GetNativeSystemInfo uses the Win32_Processor.Architecture enumeration rather
# than IMAGE_FILE_MACHINE. It is only a fallback on Windows versions older than
# IsWow64Process2, which predate Windows on ARM64.
_WINDOWS_ARCHITECTURES = (
    "x86",
    "MIPS",
    "Alpha",
    "PowerPC",
    "",
    "ARM",
    "ia64",
    "",
    "",
    "AMD64",
    "",
    "",
    "ARM64",
)


def _native_machine_win32() -> str:
    """Ask the kernel for the native machine architecture, rather than WMI.

    Asked before the architecture variables because the WMI query this
    replaces was authoritative before them. Under x64 emulation on ARM64, the
    variables can describe AMD64 while the native machine remains ARM64.

    Every failure returns the empty string so the caller can consult the
    architecture variables and report unknown only when they are absent too.
    """
    try:
        # WinDLL exists only on Windows, and a type checker running elsewhere
        # resolves the attribute against its own platform.
        kernel32 = getattr(ctypes, "WinDLL")("kernel32", use_last_error=True)
        get_current_process = kernel32.GetCurrentProcess
        get_current_process.argtypes = []
        get_current_process.restype = ctypes.c_void_p

        try:
            is_wow64_process2 = kernel32.IsWow64Process2
        except AttributeError:
            return _native_machine_legacy_win32(kernel32, ctypes)

        is_wow64_process2.argtypes = (
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ushort),
            ctypes.POINTER(ctypes.c_ushort),
        )
        is_wow64_process2.restype = ctypes.c_int
        process_machine = ctypes.c_ushort()
        native_machine = ctypes.c_ushort()
        if not is_wow64_process2(
            get_current_process(),
            ctypes.byref(process_machine),
            ctypes.byref(native_machine),
        ):
            logger.debug("IsWow64Process2 did not name the native machine")
            return ""
        machine = _WINDOWS_MACHINE_TYPES.get(native_machine.value, "")
        if not machine:
            logger.debug(
                "IsWow64Process2 returned unknown native machine %#x",
                native_machine.value,
            )
        return machine
    except (
        AttributeError,
        ctypes.ArgumentError,
        OSError,
        TypeError,
        ValueError,
    ):
        logger.debug("the kernel did not name the architecture", exc_info=True)
        return ""


def _native_machine_legacy_win32(kernel32: Any, ctypes: Any) -> str:
    """Read x86/AMD64 on Windows versions older than IsWow64Process2."""

    class _SystemInfo(ctypes.Structure):
        _fields_ = (
            ("wProcessorArchitecture", ctypes.c_ushort),
            ("wReserved", ctypes.c_ushort),
            ("dwPageSize", ctypes.c_ulong),
            ("lpMinimumApplicationAddress", ctypes.c_void_p),
            ("lpMaximumApplicationAddress", ctypes.c_void_p),
            ("dwActiveProcessorMask", ctypes.c_void_p),
            ("dwNumberOfProcessors", ctypes.c_ulong),
            ("dwProcessorType", ctypes.c_ulong),
            ("dwAllocationGranularity", ctypes.c_ulong),
            ("wProcessorLevel", ctypes.c_ushort),
          
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1245** (2026-10-06): **fix(navigation): Time a goto from its request**
  *Symptoms*: ## Problem  Cookie-import validation opens `/feed/` on a 30 second clock that starts when `goto` is called. On a Windows runner the browser sends that request seconds later, so the clock runs out before the origin answers. A browser that never sends must still fail.  ## Solution  The 30 second budget starts when the main-frame request is sent. Waiting for that request has its own 30 second cap, so a browser that never sends still ends.  ## Verification  Proxy-error tests cover a late request, an answer that overruns the budget, and a request that is never sent. Removing the startup cap makes the last test succeed.  ## Synthetic prompt  > Start the feed navigation budget when the browser sends the request, and keep a separate cap so a browser that never sends still fails.  Generated with Claude Opus 5.5 for investigation, implementation in Claude Code via T3 Code. 
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74988146"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[High risk]** Changes how page navigation timing works in the browser automation layer\.  The PR appears safe to merge; no new actionable issue was identified.  <h3>Summary</h3>  The PR starts the feed navigation budget when the main-frame request is sent and separately caps the wait for a request that never arrives. - The latest changes use Patchright’s timeout type and add main-frame matching tests.  <h3>Diagram</h3>  ```mermaid %%{init: {'theme': 'neutral'}}%% flowchart TD  

- **Issue #1240** (2026-10-05): **fix(browser): Restart a browser that stopped**
  *Symptoms*: ## Problem  When Chromium exits while the Node driver keeps running, the server keeps handing out the dead browser. Every later tool call fails with a closed page until the server restarts. Seen in Windows CI runs.  ## Solution  - Before a tool starts, check whether the cached browser's page is closed or its browser disconnected. - If it is, shut it down through the existing close. A proven drain answers with an ordinary error, and the next call starts a fresh browser. An unproven drain refuses as before. - New browsers are now also refused while a lease from an unconfirmed close is still held, even after the profile path is retargeted.  ## Verification  Unit tests cover the verdicts, cancellation, and the retargeted profile. Native tests kill only Chromium, or close the active page. Ten planted faults fail. Full suite green. The H-R7 close slice is unchanged.  ## Synthetic prompt  > Recover from a cached browser whose Chromium has exited: detect it in get_ready_extractor, close it through a driver helper that reports the drain from the driver's own lease, and refuse creation while an unconfirmed lease is retained.  Generated with Claude Opus 5.5 for implementation and GPT-6 Pro for plan review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / 
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74864930"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Adds browser restart logic when a cached browser stops\.  The PR appears safe to merge; no outstanding findings remain.  <h3>Summary</h3>  The PR detects a closed page or disconnected Chromium before a tool starts, closes the cached browser, and lets the next call create a replacement after confirmed shutdown. - An unconfirmed shutdown retains the profile lease and blocks another launch, including after a profile retarget. - Tests cover shutdown verdicts, cancel

- **Issue #1235** (2026-10-05): **fix(navigation): Refuse a landing off LinkedIn**
  *Symptoms*: ## Problem  A navigation that ended off LinkedIn, at a captive portal, a proxy interstitial or a delayed redirect, was read and returned as the requested LinkedIn page. A foreign page titled "LinkedIn Login" counted as an expired session, which retires the stored one. Clicks could land on whatever document had replaced the LinkedIn page.  ## Solution  One classifier decides whether a page is LinkedIn's: `https` on `linkedin.com` or a subdomain, matched on a label boundary. Every page read and every action now checks its own document in the same browser step. Clicks, fills and key presses go through an element handle checked in that document. Off LinkedIn, tools raise a new network error that names the host, survives error masking and never retires the session. The feed check refuses foreign landings before and after its waits. It keeps today's verdict on LinkedIn's own pages.  ## Verification  Browser DOM tests on intercepted pages cover delayed redirects during reads, auth checks, the remember-me chooser, connection actions and the conversation scan. A JS/Python parity test keeps the host rule in sync. Planted faults fail them. Full suite and browser DOM suite pass.  Closes #786  ## Synthetic prompt  > Refuse any LinkedIn read or page action whose document is not LinkedIn's, checked in the same browser step, raising a network error that never retires the session, and keep the feed auth verdict unchanged on LinkedIn's own pages.  Generated with Claude Opus 5.5 for implementat
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74528914"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[High risk]** Adds navigation validation to detect when the browser lands off LinkedIn\.  The PR appears safe to merge; no outstanding finding or new blocking failure was established.  <h3>Summary</h3>  The PR refuses LinkedIn reads and actions when their document has landed on another site, preserving the stored session and reporting the landing as a network error. Changes since the previous review also add safeguards for logout, sidebar scrolling, message-send deadlines, shar

- **Issue #1234** (2026-10-05): **fix(jobs): Stop the sidebar scroll on cancel**
  *Symptoms*: ## Problem  `scroll_job_sidebar` ran as one long `page.evaluate()` whose in-page timers kept scrolling the job rail after the tool call was cancelled. That covered a FastMCP timeout and a task cancel alike. The next tool got a page that was still loading the cancelled search's results.  ## Solution  Python now owns every wait and repeat. Each browser step measures the rail and scrolls only when asked. A cancel stops sending steps. A scroll already sent is waited for, up to 5 seconds, before the page is released. The measured rail is held by its DOM node, so a container that wraps or ties with it no longer counts as growth. Container choice, settling, the deadline, the scroll cap and the return value are unchanged.  ## Verification  New browser DOM tests cancel through `Task.cancel`, an AnyIO timeout and the real sequential middleware while a scroll is queued behind a busy renderer. Others cover tied containers appearing mid-wait. Planted faults fail them. The browser DOM suite passed three times.  Closes #763  ## Synthetic prompt  > Make the job sidebar scroll stop when its tool call is cancelled: move waits and repetition from the in-page loop into Python, wait for a scroll already sent, and track the measured rail by its node.  Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the mark
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74506635"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Fixes job sidebar scroll behavior on cancellation\.  The PR appears safe to merge; the previously reported disposal-deadline issue is fixed and no new actionable findings remain.  <h3>Summary</h3>  The PR moves job-sidebar scrolling from a long-running browser evaluation into Python-controlled steps, retains the measured rail by DOM node, and waits briefly for an already-sent scroll when cancelled. It adds cancellation, page-handoff, and rail-selection tests.  <

- **Issue #1233** (2026-10-05): **fix(messaging): Answer before the tool deadline**
  *Symptoms*: ## Problem  FastMCP ends a tool at its timeout. If `send_message` reached that deadline after the message may have been submitted, the client got only "Error calling tool 'send_message'". It had no way to tell whether the message went out or whether retrying was safe, which invites a duplicate send.  ## Solution  `send_message` reads the deadline it runs under. Dispatch and confirmation get an earlier deadline that keeps a short reserve. If that runs out after a possible submission, the tool returns the existing `send_unconfirmed` result with `retry_safe=false`. Cleanup and the final progress notification can no longer use up the reserve. With too little time left, it does not click, and the caller gets the usual timeout with nothing sent. External cancellation still propagates. Without a deadline, nothing changes.  ## Verification  New tests go through the in-memory MCP client. They stall dispatch, confirmation, cleanup and the final notification, and check that there is exactly one dispatch. Ten repeated runs passed. Planted faults fail them.  Closes #889  ## Synthetic prompt  > Make send_message answer before FastMCP's tool deadline: run dispatch and confirmation under an earlier internal deadline and return send_unconfirmed with retry_safe false when it expires after a possible submission.  Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will o
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74457922"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Adjusts message send timing to answer before tool deadline\.  The PR appears safe to merge; no actionable issue was established.  <h3>Summary</h3>  The PR gives `send_message` an internal dispatch-and-confirmation deadline ahead of the tool deadline, so an attempted send can return an unconfirmed, retry-unsafe result rather than a bare timeout. It also bounds cleanup and the final progress notification, and adds in-memory MCP deadline tests.  <h3>Diagram</h3>  `

- **Issue #1232** (2026-10-05): **fix(daemon): Name a lost owner instead of masking it**
  *Symptoms*: ## Problem  When the shared browser owner died and recovery found no replacement, clients on the 2026-07-28 protocol saw only "Internal server error". MCP SDK 2.2.0 masks every exception except `MCPError`. Clients on the older handshake saw raw connection text. Neither said what to do.  ## Solution  Once recovery ends without an owner, listings raise an `MCPError` and tool calls raise a `ToolError`. Both carry one fixed message: this server lost the shared browser process, and the user should reconnect or restart the MCP client. A call that may have acted still reports `outcome_unknown` first. Failures not recognised as owner loss are masked as before.  ## Verification  New server tests cover both protocol eras for listings and calls, with the owner lost before and after the heartbeat check. They also cover a failed repeated listing and an unrelated error that stays masked. Planting the old re-raise fails them.  Closes #1145  ## Synthetic prompt  > When daemon owner recovery ends without a replacement, give listings and tool calls in both MCP protocol eras a fixed, actionable error instead of a masked internal error, keeping outcome_unknown for calls that may have acted.  Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered m
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74447023"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Changes error handling for lost daemon owner connections\.  The PR appears safe to merge; no actionable regression was established.  <h3>Summary</h3>  The proxy now gives clients a fixed reconnect instruction when owner recovery cannot provide an answer. - Listings return a readable protocol error; tool calls return a readable tool error. - Calls that may have changed LinkedIn state retain their unknown-outcome result. - Tests cover both protocol eras, a failed 

- **Issue #1231** (2026-10-05): **fix(cli): Keep a session made after logout confirms**
  *Symptoms*: ## Problem  `--logout` asks for confirmation, then deletes whatever session is there when it finally holds the profile. The prompt can stay open indefinitely, and after it retires a shared browser it waits up to 60 seconds for the profile. Another client that signed in or imported a session in between had that new session deleted, and logout reported success.  ## Solution  Logout records which session it showed the user before asking. Under the profile lease and before deleting anything, it checks that session is still there. If the session changed, or its metadata became unreadable, nothing is deleted and logout exits 1 saying so. This applies to both Direct and shared-browser logout. A browser re-exporting cookies for the same login does not count as a change.  ## Verification  New CLI and session-state tests cover a sign-in during the prompt, a sign-in at the handover, a cookie re-export, and unreadable metadata. Planting a skipped comparison fails them.  Closes #1143  ## Synthetic prompt  > Make --logout delete only the session the user confirmed: snapshot its identity before the prompt and compare it under the profile lease before deleting, refusing on any change.  Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered mar
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74440311"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Logout now checks the session hasn\'t changed before deleting it\.  The PR appears safe to merge; no outstanding findings remain.  <h3>Summary</h3>  The PR prevents logout from deleting a session that changed after confirmation. The latest revision also handles errors while reading the session before prompting and adds a test for that refusal.  <!-- greptile_confidence_score:5 -->  <sub>Reviews (2) · Last reviewed commit: ["fix(cli): Refuse a logout it cannot re

- **Issue #1230** (2026-10-05): **fix(setup): Say Ctrl+Z does not pause the download**
  *Symptoms*: ## Problem  The managed browser installer runs outside the terminal's process group, so it can clean up after its parent dies (#789). That also keeps the terminal's stop signal from reaching it. Ctrl+Z stopped the CLI command while the download went on in the background.  ## Solution  The issue accepts saying so instead of forwarding the signal, which would have to keep that containment intact. When the CLI installs the browser at an interactive POSIX terminal, it now prints that suspending the command does not pause the download.  ## Verification  New tests show the line at a terminal and not otherwise. It never appears when the browser is already installed. Planting a fault that suppresses it fails the terminal case.  Closes #792  ## Synthetic prompt  > When the CLI installs the managed browser at an interactive POSIX terminal, tell the user that Ctrl+Z does not pause the download, because the installer is detached from the terminal's process group.  Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / end markers from your PR's description, Macroscope will append its summary at the bottom of the description. --> > [!NOTE] > ### Warn foreground terminal users that Ctrl+
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=74442658"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Updates setup messaging and print routing for terminal detection\.  The PR appears safe to merge; no outstanding finding or new actionable issue was identified.  <h3>Summary</h3>  The PR tells foreground POSIX terminal users that Ctrl+Z does not pause a managed-browser download. - Routes the notice to stdout or stderr only when that output is the foreground terminal, keeping it out of redirected output. - Adds coverage for terminal, redirected-output, background

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

### Incident Patch 1: `71c5eb1b` (2026-10-06)
**Commit Message**: fix(navigation): Time a goto from its request (#1245)

## Problem

Cookie-import validation opens `/feed/` on a 30 second clock that starts
when `goto` is called. On a Windows runner the browser sends that
request seconds later, so the clock runs out before the origin answers.
A browser that never sends must still fail.

## Solution

The 30 second budget starts when the main-frame request is sent. Waiting
for that request has its own 30 second cap, so a browser that never
sends still ends.

## Verification

Proxy-error tests cover a late request, an answer that overruns the
budget, and a request that is never sent. Removing the startup cap makes
the last test succeed.

## Synthetic prompt

> Start the feed navigation budget when the browser sends the request,
and keep a separate cap so a browser that never sends still fails.

Generated with Claude Opus 5.5 for investigation, implementation in
Claude Code via T3 Code.

**File**: `changelog.d/1245.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A feed navigation is timed from the request, and one that is never sent still ends.
```

**File**: `linkedin_mcp_server/core/proxy_errors.py` (modified, +112/-1)
```diff
@@ -6,10 +6,13 @@
 two apart before they draw that conclusion.
 """
 
+import asyncio
 import logging
 from typing import Any
 from urllib.parse import quote
 
+from patchright.async_api import TimeoutError as PlaywrightTimeoutError
+
 from linkedin_mcp_server.config.schema import BrowserConfig
 
 from .exceptions import ProxyConnectionError
@@ -155,16 +158,124 @@ def raise_if_proxy_configured(error: BaseException) -> None:
     ) from None
 
 
+#: The product's navigation budget, in milliseconds, counted from the moment
+#: the browser sends the navigation request. Patchright's own default is the
+#: same number but starts at the ``goto`` call. On a Windows runner the first
+#: request of a fresh browser is not sent for seconds after that call (1.1s to
+#: 2.5s on a green idle leg; a loaded one never sent it inside 30s), so a clock
+#: that starts at the call expires before the origin has anything to answer.
+#: A held request is inside this budget: the gate's 20s deadline leaves the
+#: answer ten seconds, and the relay drops a silent tunnel at 30s.
+NAVIGATION_BUDGET_MS = 30_000
+#: How long to wait for the browser to send the request at all. A wedged
+#: browser never emits one, and the navigation budget cannot start then, so
+#: this cap is what ends the call. It is not part of the navigation budget.
+STARTUP_BUDGET_MS = 30_000
+
+
+def _page_reports_requests(page: Any) -> bool:
+    """Whether *page* is a real page, not a stand-in whose ``on`` is invented.
+
+    A mock grows ``on`` the moment it is asked for, and treating that as a
+    listener would wait for a request the stand-in never emits. A method that
+    exists on the class is one the page actually has.
+    """
+    kind = type(page)
+    return callable(getattr(kind, "on", None)) and callable(
+        getattr(kind, "remove_listener", None)
+    )
+
+
+def _is_main_frame_navigation(page: Any, request: Any) -> bool:
+    """Whether *request* is the navigation ``goto`` is waiting on.
+
+    A subresource, or a frame that is not the page's main one, must not start
+    the budget: the answer the gate holds is the main document.
+    """
+    is_navigation = getattr(request, "is_navigation_request", None)
+    if callable(is_navigation) and not is_navigation():
+        return False
+    frame = getattr(request, "frame", None)
+    main = getattr(page, "main_frame", None)
+    return frame is None or main is None or frame is main
+
+
+async def _stop_goto(goto: asyncio.Future[Any]) -> None:
+    """Cancel a ``goto`` that is still running, and wait until it has stopped."""
+    if goto.done():
+        return
+    goto.cancel()
+    await asyncio.shield(asyncio.gather(goto, return_exceptions=True))
+
+
+async def _goto_within_budget(page: Any, url: str, **kwargs: Any) -> Any:
+    """``page.goto``, with :data:`NAVIGATION_BUDGET_MS` starting at the request.
+
+    A caller that passes ``timeout`` sets that budget. ``0`` keeps Patchright's
+    meaning, no limit. A page that cannot report its requests is unchanged:
+    the driver's own clock applies, which is the only clock it has.
+    """
+    caller_set_timeout = "timeout" in kwargs
+    timeout = kwargs.pop("timeout", None)
+    if not _page_reports_requests(page):
+        if caller_set_timeout:
+            kwargs["timeout"] = timeout
+        return await page.goto(url, **kwargs)
+    if timeout is None:
+        timeout = NAVIGATION_BUDGET_MS
+    if timeout == 0:
+        return await page.goto(url, timeout=0, **kwargs)
+
+    sent: asyncio.Future[None] = asyncio.get_running_loop().create_future()
+
+    def on_request(request: Any) -> None:
+        if sent.done() or not _is_main_frame_navigation(page, request):
+            return
+        sent.set_result(None)
+
+    page.on("request", on_request)
+    # ``timeout=0`` turns the driver's clock off. It would otherwise include
+    # the time before this browser sends anything, which is not the navigation.
+    goto = asyncio.ensure_future(page.goto(url, timeout=0, **kwargs))
+    try:
+        await asyncio.wait(
+            {goto, sent},
+            timeout=STARTUP_BUDGET_MS / 1000,
+            return_when=asyncio.FIRST_COMPLETED,
+        )
+        if not goto.done() and not sent.done():
+            await _stop_goto(goto)
+            raise PlaywrightTimeoutError(
+                f"Page.goto: Timeout {STARTUP_BUDGET_MS:g}ms exceeded before "
+                "the request was sent."
+            )
+        if goto.done():
+            return await goto
+        try:
+            return await asyncio.wait_for(asyncio.shield(goto), timeout / 1000)
+        except TimeoutError:
+            await _stop_goto(goto)
+            raise PlaywrightTimeoutError(
+                f"Page.goto: Timeout {timeout:g}ms exceeded after the request was sent."
+            ) from None
+    finally:
+        page.remove_listener("request", on_request)
+        await _stop_goto(goto)
+
+
 async def goto_reporting_proxy_errors(page: Any, url: str, **
```

**File**: `linkedin_mcp_server/linkedin/navigation.py` (modified, +18/-1)
```diff
@@ -20,6 +20,8 @@
 )
 from linkedin_mcp_server.core.exceptions import AuthenticationError
 from linkedin_mcp_server.core.proxy_errors import (
+    NAVIGATION_BUDGET_MS,
+    goto_reporting_proxy_errors,
     raise_if_proxy_error,
     redact_proxy_credentials,
     redacted_copy,
@@ -178,7 +180,22 @@ def unregister_navigation_listener() -> None:
                 extra={"target_url": url, "wait_until": wait_until},
             )
             try:
-                await page.goto(url, wait_until=wait_until, timeout=30000)
+                # A scripted page records the timeout it was given and does not
+                # enforce it. Only Patchright's clock starts at the call, which
+                # is the clock that expires before a cold browser sends.
+                if type(page).__module__.startswith("patchright."):
+                    await goto_reporting_proxy_errors(
+                        page,
+                        url,
+                        wait_until=wait_until,
+                        timeout=NAVIGATION_BUDGET_MS,
+                    )
+                else:
+                    await page.goto(
+                        url,
+                        wait_until=wait_until,
+                        timeout=NAVIGATION_BUDGET_MS,
+                    )
                 await stabilize_navigation(f"goto {url}", logger)
                 await record_page_trace(
                     page,
```

**File**: `tests/differential/synthetic_origin.py` (modified, +8/-6)
```diff
@@ -379,12 +379,14 @@ def _issued_cookie(value: str) -> str:
 # --- Holding one request -------------------------------------------------------
 
 #: How long a held request may wait, counted from its entry into the gate.
-#: Below both limits a held request meets: the product's navigation timeout
-#: (``page.goto(..., timeout=30000)`` in ``linkedin.navigation``) and this
-#: module's proxy relay, which ends a tunnel idle for ``_RELAY_IDLE_SECONDS``
-#: (30). A held request sends nothing through its tunnel, so a hold of 30 s
-#: would be cut by the relay rather than ended by the gate; 20 leaves the
-#: answer ten seconds to arrive.
+#: Below both limits a held request meets, both counted from that request and
+#: not from the ``goto`` call: the product's navigation budget
+#: (``NAVIGATION_BUDGET_MS``, 30s, in ``core.proxy_errors``) and this module's
+#: proxy relay, which ends a tunnel idle for ``_RELAY_IDLE_SECONDS`` (30). A
+#: held request sends nothing through its tunnel, so a hold of 30 s would be
+#: cut by the relay rather than ended by the gate; 20 leaves the answer ten
+#: seconds to arrive. The time a fresh browser spends before it sends the
+#: request is not part of either limit.
 GATE_DEADLINE_SECONDS = 20.0
 #: How often a held request looks for its peer having gone.
 _PEER_POLL_SECONDS = 0.05
```

**File**: `tests/test_proxy_errors.py` (modified, +159/-0)
```diff
@@ -1,7 +1,13 @@
 """Tests for recognizing and safely reporting proxy failures."""
 
+import asyncio
+from collections.abc import Callable
+from typing import Any
+
 import pytest
 
+from patchright.async_api import TimeoutError as PlaywrightTimeoutError
+
 from linkedin_mcp_server.config.schema import AppConfig
 from linkedin_mcp_server.core.exceptions import NetworkError, ProxyConnectionError
 from linkedin_mcp_server.core.proxy_errors import (
@@ -171,6 +177,159 @@ async def goto(self, url, **kwargs):
         return "ok"
 
 
+class _Request:
+    def __init__(self, *, navigation=True, frame=None):
+        self.frame = frame
+        self._navigation = navigation
+
+    def is_navigation_request(self):
+        return self._navigation
+
+
+class _ClockPage:
+    """A page whose driver times the whole ``goto``, the way Patchright does.
+
+    *events* are ``(delay_seconds, request)`` from the call. The driver timeout,
+    when one is set, covers those delays and *finish_after*. ``timeout=0`` is
+    the driver's "no limit".
+    """
+
+    def __init__(self, events, *, finish_after, main_frame=None, error=None):
+        self._events = events
+        self._finish_after = finish_after
+        self.main_frame = main_frame
+        self._error = error
+        self._listeners: list[tuple[str, Callable[..., Any]]] = []
+
+    def on(self, event, handler):
+        self._listeners.append((event, handler))
+
+    def remove_listener(self, event, handler):
+        self._listeners = [
+            (found, callback)
+            for found, callback in self._listeners
+            if not (found == event and callback == handler)
+        ]
+
+    async def goto(self, url, **kwargs):
+        timeout = kwargs.get("timeout", 30_000)
+
+        async def body():
+            if self._error is not None:
+                raise self._error
+            elapsed = 0.0
+            for delay, request in self._events:
+                await asyncio.sleep(delay - elapsed)
+                elapsed = delay
+                for event, handler in list(self._listeners):
+                    if event == "request":
+                        handler(request)
+            await asyncio.sleep(self._finish_after)
+            return "ok"
+
+        if not timeout:
+            return await body()
+        return await asyncio.wait_for(body(), timeout / 1000)
+
+
+class TestNavigationBudget:
+    """The 30s budget starts when the request is sent, not when ``goto`` is called.
+
+    A fresh browser on a loaded Windows runner spends the driver's whole 30s
+    before it sends the first feed request. That time is not the navigation,
+    and it is not the ten seconds a held answer has inside the same budget.
+    """
+
+    async def test_a_request_sent_after_the_old_clock_still_completes(self):
+        page = _ClockPage(
+            [(0.25, _Request())],
+            finish_after=0.02,
+        )
+        assert (
+            await goto_reporting_proxy_errors(
+                page, "https://www.linkedin.com/feed/", timeout=100
+            )
+            == "ok"
+        )
+
+    async def test_the_budget_still_bounds_the_answer(self):
+        page = _ClockPage([(0.01, _Request())], finish_after=0.25)
+        with pytest.raises(PlaywrightTimeoutError, match="after the request was sent"):
+            await goto_reporting_proxy_errors(
+                page, "https://www.linkedin.com/feed/", timeout=100
+            )
+
+    async def test_a_request_that_is_never_sent_fails(self, monkeypatch):
+        """A browser that never sends does not wait forever.
+
+        The navigation budget cannot start until the request exists, so the
+        wait for that request has its own cap.
+        """
+        monkeypatch.setattr(
+            "linkedin_mcp_server.core.proxy_errors.STARTUP_BUDGET_MS", 50
+        )
+        page = _ClockPage([(2.0, _Request())], finish_after=0.01)
+        with pytest.raises(PlaywrightTimeoutError, match="before the request was sent"):
+            await goto_reporting_proxy_errors(
+                page, "https://www.linkedin.com/feed/", timeout=100
+            )
+
+    async def test_a_subresource_does_not_start_the_budget(self):
+        page = _ClockPage(
+            [
+                (0.01, _Request(navigation=False)),
+                (0.2, _Request()),
+            ],
+            finish_after=0.02,
+        )
+        assert (
+            await goto_reporting_proxy_errors(
+                page, "https://www.linkedin.com/feed/", timeout=150
+            )
+            == "ok"
+        )
+
+    async def test_an_iframe_navigation_does_not_start_the_budget(self):
+        main = object()
+        page = _ClockPage(
+            [
+                (0.01, _Request(frame=object())),
+                (0.30, _Request(frame=main)),
+            ],
+            finish_after=0.02,
+            main_frame=main,
+        )
+        assert (
+            await goto_reporting_proxy_errors(
+                pag
```

---

### Incident Patch 2: `33c79cfd` (2026-10-05)
**Commit Message**: fix(browser): Restart a browser that stopped (#1240)

## Problem

When Chromium exits while the Node driver keeps running, the server
keeps handing out the dead browser. Every later tool call fails with a
closed page until the server restarts. Seen in Windows CI runs.

## Solution

- Before a tool starts, check whether the cached browser's page is
closed or its browser disconnected.
- If it is, shut it down through the existing close. A proven drain
answers with an ordinary error, and the next call starts a fresh
browser. An unproven drain refuses as before.
- New browsers are now also refused while a lease from an unconfirmed
close is still held, even after the profile path is retargeted.

## Verification

Unit tests cover the verdicts, cancellation, and the retargeted profile.
Native tests kill only Chromium, or close the active page. Ten planted
faults fail. Full suite green. The H-R7 close slice is unchanged.

## Synthetic prompt

> Recover from a cached browser whose Chromium has exited: detect it in
get_ready_extractor, close it through a driver helper that reports the
drain from the driver's own lease, and refuse creation while an
unconfirmed lease is retained.

Generated wi

**File**: `changelog.d/1240.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A browser that stopped is shut down, and the next tool call starts a new one.
```

**File**: `linkedin_mcp_server/dependencies.py` (modified, +59/-0)
```diff
@@ -14,9 +14,11 @@
     invalidate_auth_and_trigger_relogin,
     invalidate_browser_setup,
 )
+from linkedin_mcp_server.core import BrowserManager
 from linkedin_mcp_server.core.exceptions import AuthenticationError, NetworkError
 from linkedin_mcp_server.drivers.browser import (
     close_browser,
+    close_unusable_browser,
     ensure_authenticated,
     get_or_create_browser,
 )
@@ -25,6 +27,7 @@
     AuthStaleOnOwnerError,
     BrowserBinaryMissingError,
     BrowserShutdownUnconfirmedError,
+    BrowserUnavailableError,
     DockerHostLoginRequiredError,
     LinuxBrowserDependencyError,
 )
@@ -159,6 +162,56 @@ async def handle_auth_error(
     )  # always raises
 
 
+def _browser_is_unusable(browser: BrowserManager) -> bool:
+    """Whether the cached browser is known to be dead, from local state alone.
+
+    Two signals, both already delivered by the driver: the active page closed, or
+    the browser it belongs to disconnected (Chromium exited while the Node driver
+    lived on). Neither costs a round trip. They miss a driver that died itself
+    and a renderer crash that leaves the page open; those still fail inside the
+    tool, as before. An event that has not arrived yet is caught by a later call.
+
+    Only positive evidence counts. A missing browser handle or a property that
+    raises says nothing about whether Chromium is gone, and closing a browser
+    on a guess would end a working one.
+    """
+    try:
+        # The page first: a closed page is enough, and the context read below
+        # can raise once the manager has started tearing down.
+        if browser.page.is_closed():
+            return True
+        handle = browser.context.browser
+        return handle is not None and not handle.is_connected()
+    except Exception:
+        logger.debug("Could not read the browser's state", exc_info=True)
+        return False
+
+
+async def _shut_down_unusable_browser(browser: BrowserManager) -> BrowserManager:
+    """Close a dead browser and raise how that ended.
+
+    Returns only when another close retired *browser* first, so this call closed
+    nothing, with whatever the getter hands out now. That is one reacquisition,
+    not a loop, and its own errors (a busy profile, a login) take the normal
+    path.
+    """
+    logger.warning("The browser stopped unexpectedly; shutting it down")
+    failure: Exception | None = None
+    try:
+        outcome = await close_unusable_browser(browser)
+    except Exception as exc:
+        # Settlement has already run unconfirmed and kept the lease.
+        logger.warning("Shutting down the stopped browser failed: %s", exc)
+        failure, outcome = exc, False
+    # Outside the try, so a confirmed close can never be caught there as a
+    # failed one and reported as unconfirmed.
+    if outcome is None:
+        return await get_or_create_browser()
+    if outcome:
+        raise BrowserUnavailableError()
+    raise BrowserShutdownUnconfirmedError() from failure
+
+
 async def get_ready_extractor(
     ctx: Context | None,
     *,
@@ -168,6 +221,12 @@ async def get_ready_extractor(
     try:
         await ensure_tool_ready_or_raise(tool_name, ctx)
         browser = await get_or_create_browser()
+        # Before the auth check, which reads only a flag the dead browser still
+        # has set, and before any tool work, so the failure is an ordinary one
+        # and starts no login. A browser this call shut down is not replaced
+        # inside it; the error asks the caller to run the tool again.
+        if _browser_is_unusable(browser):
+            browser = await _shut_down_unusable_browser(browser)
         await ensure_authenticated()
         return LinkedInExtractor(browser.page)
     except AuthenticationError as e:
```

**File**: `linkedin_mcp_server/drivers/browser.py` (modified, +37/-1)
```diff
@@ -661,7 +661,16 @@ async def _create_browser() -> BrowserManager:
     # A previous close could not confirm Chromium had exited, so it may still be
     # running on this profile. Launching a second one now is exactly the
     # corruption this module exists to prevent, and the operator has to clear it.
-    if lease.browser_open:
+    #
+    # Both halves, because they answer about different profiles. The marker is
+    # read from the lease the path resolves to *now*; a lease this module kept
+    # from an unconfirmed close belongs to the path it resolved to *then*. After
+    # the profile root is retargeted, the first says B is free while the second
+    # still holds A with a Chromium that may be running on it, and creating on B
+    # would leave two marked leases and a later confirmed close on B clearing A
+    # without ever draining it. `close_unusable_browser` reads its verdict from
+    # `_browser_lease` and depends on that never happening.
+    if lease.browser_open or _browser_lease is not None:
         raise BrowserBusyError(
             "A previous browser on this profile did not shut down cleanly and "
             "may still be running. Restart the server to recover."
@@ -971,6 +980,33 @@ async def _close_browser_locked() -> None:
     logger.info("Browser closed")
 
 
+async def close_unusable_browser(manager: BrowserManager) -> bool | None:
+    """Close *manager* if it is still the cached browser, and say how it ended.
+
+    For a tool call that found its browser dead. The identity is checked under
+    the lifecycle lock, so a manager another closer already retired, or one
+    created since, is never closed from here.
+
+    * ``None``: *manager* is no longer cached, so nothing was closed. This does
+      not say how the other close ended.
+    * ``True``: closed and Chromium proven gone. The browser's reference to the
+      profile is released; a reference the caller's middleware holds can still
+      keep the lease until that call unwinds.
+    * ``False``: closed but not proven gone. The lease is kept, as any close
+      keeps it, and settlement has asked a shared owner to stand down.
+
+    The verdict is ``_browser_lease`` read before the lock is released, not a
+    lookup by path: settlement clears it only on a proven drain, and a lookup
+    answers for whatever the profile root resolves to by then. Cancellation and
+    an exception escaping the teardown behave exactly as in ``close_browser``.
+    """
+    async with _browser_lifecycle_lock:
+        if _browser is not manager:
+            return None
+        await _run_deferring_cancels(_close_browser_locked())
+        return _browser_lease is None
+
+
 def get_profile_dir() -> Path:
     """Get the resolved profile directory from config."""
     return get_source_profile_dir()
```

**File**: `linkedin_mcp_server/exceptions.py` (modified, +21/-0)
```diff
@@ -265,6 +265,27 @@ def __init__(self, message: str | None = None):
         a_held_profile_means_this_owner_must_go()
 
 
+class BrowserUnavailableError(LinkedInMCPError):
+    """The cached browser had stopped, and it was shut down and the profile freed.
+
+    Raised by a tool call that found its browser dead before doing any work, once
+    the close proved Chromium gone. The next call starts a new browser; this one
+    reports an ordinary failure rather than launching inside the same call.
+
+    Deliberately not an ``AuthenticationError``: the session is not the problem,
+    and that class is routed into a login, which retires the profile.
+    """
+
+    def __init__(self, message: str | None = None):
+        super().__init__(
+            message
+            or (
+                "The browser stopped unexpectedly and was shut down. Run the "
+                "tool again to start a new browser."
+            )
+        )
+
+
 class BrowserBusyError(LinkedInMCPError):
     """Another server process holds the shared browser profile.
 
```

**File**: `tests/test_browser_containment.py` (modified, +237/-0)
```diff
@@ -411,3 +411,240 @@ async def test_a_close_that_cannot_prove_itself_is_closed_again(self) -> None:
         with pytest.raises(AssertionError, match="could not prove"):
             await launch.prove()
         assert launch.close_calls == 2
+
+
+# --- A browser that stopped under a tool call -------------------------------------
+#
+# Self-contained on purpose: the helpers above belong to the containment gate and
+# change with it, and these tests ask a different question of the same launch.
+
+
+def _alive(process: Any) -> bool:
+    import psutil
+
+    try:
+        return process.is_running() and process.status() != psutil.STATUS_ZOMBIE
+    except psutil.NoSuchProcess:
+        return False
+
+
+def _the_chromium_root(profile: Path) -> tuple[Any, Any]:
+    """This launch's Chromium root and the Node driver that started it.
+
+    Looked for among this test process's own descendants, by the profile it was
+    handed, so a browser another test or the developer runs is never picked.
+    """
+    import psutil
+
+    roots = []
+    for process in psutil.Process().children(recursive=True):
+        try:
+            args = process.cmdline()
+        except psutil.Error:
+            continue
+        if any(arg.startswith("--type=") for arg in args):
+            continue
+        for arg in args:
+            if not arg.startswith("--user-data-dir="):
+                continue
+            try:
+                if os.path.samefile(arg.partition("=")[2], profile):
+                    roots.append(process)
+            except OSError:
+                pass
+    assert len(roots) == 1, f"expected one Chromium root on {profile}: {roots}"
+    root = roots[0]
+    # The process that started Chromium. Node, where the browser runs out of
+    # process, and this test process itself where Patchright runs Chromium
+    # in-process (Linux arm64). A parent outside this test would be another
+    # launch.
+    driver = root.parent()
+    assert driver is not None and (
+        driver.pid == os.getpid() or _is_this_tests_descendant(driver)
+    ), driver
+    return root, driver
+
+
+def _is_this_tests_descendant(process: Any) -> bool:
+    me = os.getpid()
+    seen: set[int] = set()
+    while process is not None and process.pid not in seen:
+        if process.pid == me:
+            return True
+        seen.add(process.pid)
+        try:
+            process = process.parent()
+        except process.Error:
+            return False
+    return False
+
+
+def _reports_stopped(manager: BrowserManager) -> bool:
+    try:
+        browser = manager.context.browser
+        return manager.page.is_closed() or (
+            browser is not None and not browser.is_connected()
+        )
+    except Exception:
+        return False
+
+
+def _assert_nothing_of_it_runs(manager: BrowserManager) -> None:
+    """Every process of the launch has gone, by the platform's own attribution."""
+    if os.name == "nt":
+        # The handle is already released after a proved close, so the proof is
+        # what the Job recorded before letting go, not a query on it.
+        job = manager._containment
+        assert job is not None and job.closed and job.drained
+    else:
+        # One `ps` on macOS can time out and come back inconclusive. The same
+        # bounded retry the gate uses asks again; a scan that stays unreadable
+        # still fails, and a survivor still fails at once.
+        processes = _conclusive_marker_scan(manager._process_marker, "after the close")
+        assert not processes, f"still running: {processes}"
+
+
+@pytest.mark.parametrize("fault", ["chromium-killed", "page-closed"])
+async def test_a_browser_that_stopped_is_drained_and_started_again(
+    tmp_path, isolate_profile_dir, monkeypatch, fault
+):
+    """The call that finds it dead drains it; only the next call launches.
+
+    Two faults, because they leave different things behind. Killing Chromium
+    leaves the Node driver reporting a disconnected browser. Closing the active
+    page leaves Chromium itself running, on a second page kept open, so the
+    drain has a live root to end rather than one already gone.
+
+    Everything the driver does to launch is real except signing in, which would
+    visit LinkedIn: the shipped options, the lease, the guardian and the
+    containment, on this test's own claimed profile.
+    """
+    import asyncio
+    import contextlib
+    from types import SimpleNamespace
+    from unittest.mock import AsyncMock
+
+    import psutil
+    from fastmcp.exceptions import ToolError
+
+    from linkedin_mcp_server import dependencies
+    from linkedin_mcp_server.dependencies import get_ready_extractor
+    from linkedin_mcp_server.drivers import browser as drv
+    from linkedin_mcp_server.exceptions import BrowserUnavailableError
+    from linkedin_mcp_server.profile_lease import get_profile_lease
+    from linkedin_mcp_server.sequential_tool_middleware import (
+        SequentialToolExecution
```

**File**: `tests/test_dependencies.py` (modified, +767/-2)
```diff
@@ -1,8 +1,12 @@
 """Tests for dependencies.py — bootstrap gating and auto-relogin."""
 
+from pathlib import Path
+from types import SimpleNamespace
+from typing import Any
 from unittest.mock import AsyncMock, MagicMock, patch
 
 import asyncio
+import threading
 
 import pytest
 from fastmcp import Client, FastMCP
@@ -17,9 +21,19 @@
 from linkedin_mcp_server.exceptions import (
     AuthenticationStartedError,
     AuthStaleOnOwnerError,
+    BrowserBusyError,
+    BrowserShutdownUnconfirmedError,
+    BrowserUnavailableError,
     DockerHostLoginRequiredError,
 )
 
+# Bound at import, before the autouse isolation replaces it with a fixed path.
+# The tests that retarget the profile root need the real resolution, which reads
+# USER_DATA_DIR through a symlink, and restore it deliberately.
+from linkedin_mcp_server.session_state import (
+    get_source_profile_dir as _resolve_the_configured_profile,
+)
+
 
 class TestHandleAuthError:
     async def test_managed_triggers_relogin(self):
@@ -73,13 +87,24 @@ async def test_docker_raises_host_error(self):
                 )
 
 
+def _a_live_browser() -> MagicMock:
+    """A browser double the dead-browser check reads as live.
+
+    A bare mock answers ``is_closed()`` with something truthy, which reads as a
+    closed page and sends the call down the shutdown path instead.
+    """
+    browser = MagicMock()
+    browser.page.is_closed.return_value = False
+    browser.context.browser.is_connected.return_value = True
+    return browser
+
+
 class TestGetReadyExtractor:
     async def test_ready_resumes_to_read_path(self):
         """When gating returns (login resolved in-budget), control falls through
         to get_or_create_browser + ensure_authenticated and returns an extractor.
         """
-        browser = MagicMock()
-        browser.page = MagicMock()
+        browser = _a_live_browser()
         with (
             patch(
                 "linkedin_mcp_server.dependencies.ensure_tool_ready_or_raise",
@@ -113,6 +138,7 @@ async def test_auth_error_triggers_relogin(self):
             patch(
                 "linkedin_mcp_server.dependencies.get_or_create_browser",
                 new_callable=AsyncMock,
+                return_value=_a_live_browser(),
             ),
             patch(
                 "linkedin_mcp_server.dependencies.ensure_authenticated",
@@ -1239,3 +1265,742 @@ async def teardown_that_could_not_be_confirmed():
         assert stand_down_reason() is not None, (
             "the owner holds the profile and nobody asked for a replacement"
         )
+
+
+# --- A browser that stopped ------------------------------------------------------
+
+
+def _answer(value: object) -> Any:
+    """Return *value*, or raise it when it is an exception."""
+    if isinstance(value, BaseException):
+        raise value
+    return value
+
+
+class _Browser:
+    """A cached browser whose liveness and close verdict the test decides.
+
+    Only what the dependency gate, the driver's close and the auth check read.
+    ``page_closed``, ``connected`` and ``verdict`` may be exceptions, raised when
+    read; ``connected=None`` is a context without a browser handle.
+    """
+
+    def __init__(self) -> None:
+        self.page_closed: object = False
+        self.connected: object = True
+        self.context_error: Exception | None = None
+        self.verdict: object = True
+        self.closes = 0
+        self.during_close: Any = None
+        self.is_authenticated = True
+        self.page = SimpleNamespace(is_closed=lambda: _answer(self.page_closed))
+
+    @property
+    def context(self) -> SimpleNamespace:
+        if self.context_error is not None:
+            raise self.context_error
+        if self.connected is None:
+            return SimpleNamespace(browser=None)
+        return SimpleNamespace(
+            browser=SimpleNamespace(is_connected=lambda: _answer(self.connected))
+        )
+
+    async def close(self) -> bool:
+        self.closes += 1
+        await asyncio.sleep(0)
+        if self.during_close is not None:
+            self.during_close()
+        return bool(_answer(self.verdict))
+
+
+@pytest.fixture
+def driver(monkeypatch):
+    """The real driver singleton, creation fence and close, with launch doubled.
+
+    Browsers are created through ``get_or_create_browser`` and
+    ``_create_browser``, so the cached one holds the lease the driver took for
+    it, as in production. A browser placed in ``_browser`` without that lease
+    is not a state the gate can meet, and would say nothing about its verdict.
+    Each launch publishes the next of ``upcoming``, or a live ``_Browser``.
+    """
+    from linkedin_mcp_server import dependencies
+    from linkedin_mcp_server.drivers import browser as drv
+
+    # Fresh, because an earlier test's loop may have bound the module's own.
+    monkeypatch.setattr(drv, "_browser_lifecycle_lock", asyncio.Lock())
+    monkeypatch.setattr(drv, "_browser_create_lock", asyncio.Lock
```

**File**: `tests/test_tools.py` (modified, +10/-2)
```diff
@@ -521,8 +521,12 @@ async def test_get_person_profile_auth_error(self, monkeypatch):
         from linkedin_mcp_server.core.exceptions import AuthenticationError
         from linkedin_mcp_server.exceptions import AuthenticationStartedError
 
+        # Live on purpose: a bare mock's ``is_closed()`` is truthy, which reads
+        # as a closed page and sends the call down the shutdown path instead of
+        # the auth failure this test is about.
         mock_browser = MagicMock()
-        mock_browser.page = MagicMock()
+        mock_browser.page.is_closed.return_value = False
+        mock_browser.context.browser.is_connected.return_value = True
         monkeypatch.setattr(
             "linkedin_mcp_server.dependencies.ensure_tool_ready_or_raise",
             AsyncMock(return_value=None),
@@ -809,8 +813,12 @@ async def test_connect_with_person_auth_error(self, monkeypatch):
         from linkedin_mcp_server.core.exceptions import AuthenticationError
         from linkedin_mcp_server.exceptions import AuthenticationStartedError
 
+        # Live on purpose: a bare mock's ``is_closed()`` is truthy, which reads
+        # as a closed page and sends the call down the shutdown path instead of
+        # the auth failure this test is about.
         mock_browser = MagicMock()
-        mock_browser.page = MagicMock()
+        mock_browser.page.is_closed.return_value = False
+        mock_browser.context.browser.is_connected.return_value = True
         monkeypatch.setattr(
             "linkedin_mcp_server.dependencies.ensure_tool_ready_or_raise",
             AsyncMock(return_value=None),
```

---

### Incident Patch 3: `271c8e9a` (2026-10-05)
**Commit Message**: fix(navigation): Refuse a landing off LinkedIn (#1235)

## Problem

A navigation that ended off LinkedIn, at a captive portal, a proxy
interstitial or a delayed redirect, was read and returned as the
requested LinkedIn page. A foreign page titled "LinkedIn Login" counted
as an expired session, which retires the stored one. Clicks could land
on whatever document had replaced the LinkedIn page.

## Solution

One classifier decides whether a page is LinkedIn's: `https` on
`linkedin.com` or a subdomain, matched on a label boundary. Every page
read and every action now checks its own document in the same browser
step. Clicks, fills and key presses go through an element handle checked
in that document. Off LinkedIn, tools raise a new network error that
names the host, survives error masking and never retires the session.
The feed check refuses foreign landings before and after its waits. It
keeps today's verdict on LinkedIn's own pages.

## Verification

Browser DOM tests on intercepted pages cover delayed redirects during
reads, auth checks, the remember-me chooser, connection actions and the
conversation scan. A JS/Python parity test keeps the host rule in sync.
Planted faults fail the

**File**: `changelog.d/1235.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Tools now refuse a page that ended up off LinkedIn instead of reading it as LinkedIn's.
```

**File**: `docs/linkedin-architecture.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ a page-owning collaborator.
 | `navigation` | `PageNavigator`, `WaitUntil` | `page-owning` |
 | `person` | `PersonReader` | `page-owning` |
 | `posts` | `PostSearch` | `browser-free` |
-| `profile_page` | `MessageTarget`, `MessageTargetResolution`, `ProfilePageReader`, `ReadMessageTarget` | `page-owning` |
+| `profile_page` | `MessageTarget`, `MessageTargetResolution`, `ProfilePageReader`, `ReadMessageTarget` | `browser-free` |
 | `search_urls` | `CONTENT_DATE_POSTED_MAP`, `EXPERIENCE_LEVEL_MAP`, `JOB_DATE_POSTED_MAP`, `JOB_TYPE_MAP`, `NETWORK_TOKENS`, `SORT_BY_MAP`, `WORK_TYPE_MAP`, `build_company_search_url()`, `build_content_search_url()`, `build_job_search_url()`, `build_people_search_url()` | `browser-free` |
 | `session` | `NAV_DELAY`, `PageSession` | `page-owning` |
 | `text` | `DETAIL_CAPTURE_EN_US`, `DetailCaptureTextTable`, `JOB_APPLY_EN_US`, `JOB_POSTING_EN_US`, `JOB_SEARCH_EN_US`, `JobApplyTextTable`, `JobPostingTextTable`, `JobSearchTextTable`, `SIDEBAR_CHROME_EN`, `SidebarChromeTable`, `filter_linkedin_noise_lines()`, `strip_conversation_chrome()`, `strip_linkedin_noise()`, `truncate_linkedin_noise()` | `browser-free` |
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +11/-8)
```diff
@@ -4138,6 +4138,7 @@ async def _try_auto_import_session(ctx: Context | None = None) -> bool:
     from linkedin_mcp_server.core.exceptions import (
         AuthenticationError,
         NetworkError,
+        OffLinkedInLandingError,
         ProxyConnectionError,
     )
     from linkedin_mcp_server.exceptions import (
@@ -4188,10 +4189,11 @@ async def _try_auto_import_session(ctx: Context | None = None) -> bool:
     except TimeoutError:
         logger.info("Auto-import timed out after 60s; falling back to manual login")
         return False
-    except ProxyConnectionError:
-        # Ahead of NetworkError, which it subclasses. A dead proxy is not a
-        # missing browser session: swallowing it here would hide the real cause
-        # and fall back to a manual login that has to fail the same way.
+    except (ProxyConnectionError, OffLinkedInLandingError):
+        # Ahead of NetworkError, which both subclass. A dead proxy, or a portal
+        # answering in LinkedIn's place, is not a missing browser session:
+        # swallowing it here would hide the real cause and fall back to a
+        # manual login that has to go through the same network.
         raise
     except (
         NoLinkedInSessionFoundError,
@@ -4229,6 +4231,7 @@ async def _start_login_if_needed(
     # bootstrap out of the config -> core import cycle.
     from linkedin_mcp_server.core.exceptions import (
         AccountRestrictedError,
+        OffLinkedInLandingError,
         ProxyConnectionError,
     )
 
@@ -4282,10 +4285,10 @@ async def _start_login_if_needed(
             await import_task
         except asyncio.CancelledError:
             raise
-        except ProxyConnectionError:
-            # The import itself re-raises this rather than reporting "no
-            # session"; swallowing it here would undo that and send the user
-            # into a manual login that has to fail through the same proxy.
+        except (ProxyConnectionError, OffLinkedInLandingError):
+            # The import itself re-raises these rather than reporting "no
+            # session"; swallowing them here would undo that and send the user
+            # into a manual login that has to go through the same network.
             raise
         except AccountRestrictedError:
             # For the same reason: the manual login would land on the page the
```

**File**: `linkedin_mcp_server/core/__init__.py` (modified, +6/-0)
```diff
@@ -9,12 +9,14 @@
     resolve_remember_me_prompt,
     wait_for_manual_login,
 )
+from .destination import is_another_site, is_linkedin_landing, raise_if_off_linkedin
 from .exceptions import (
     AccountRestrictedError,
     AuthenticationError,
     ElementNotFoundError,
     LinkedInOperationError,
     NetworkError,
+    OffLinkedInLandingError,
     PageReadError,
     ProfileNotFoundError,
     ProxyConnectionError,
@@ -61,6 +63,7 @@ def __getattr__(name: str) -> object:
     "ElementNotFoundError",
     "LinkedInOperationError",
     "NetworkError",
+    "OffLinkedInLandingError",
     "PageReadError",
     "ProfileNotFoundError",
     "ProxyConnectionError",
@@ -75,7 +78,10 @@ def __getattr__(name: str) -> object:
     "redacted_copy",
     "detect_rate_limit",
     "handle_modal_close",
+    "is_another_site",
+    "is_linkedin_landing",
     "is_logged_in",
+    "raise_if_off_linkedin",
     "resolve_remember_me_prompt",
     "scroll_to_bottom",
     "wait_for_manual_login",
```

**File**: `linkedin_mcp_server/core/auth.py` (modified, +118/-71)
```diff
@@ -11,7 +11,12 @@
     TimeoutError as PlaywrightTimeoutError,
 )
 
-from .exceptions import AccountRestrictedError, AuthenticationError
+from .destination import is_linkedin_landing, linkedin_element
+from .exceptions import (
+    AccountRestrictedError,
+    AuthenticationError,
+    OffLinkedInLandingError,
+)
 
 logger = logging.getLogger(__name__)
 
@@ -44,6 +49,12 @@
 )
 _REMEMBER_ME_CONTAINER_SELECTOR = "#rememberme-div"
 _REMEMBER_ME_BUTTON_SELECTOR = "#rememberme-div button"
+_AUTH_SNAPSHOT_JS = """({ picker, includeBody }) => ({
+    href: location.href,
+    title: document.title || '',
+    picker: document.querySelector(picker) !== null,
+    body: includeBody ? (document.body?.innerText || '') : '',
+})"""
 _MANUAL_LOGIN_STATUS_INTERVAL_SECONDS = 30
 _AUTH_COOKIE_URL = "https://www.linkedin.com/feed/"
 
@@ -127,64 +138,83 @@ async def _detect_auth_barrier(
         AccountRestrictedError: On LinkedIn's account-restriction route, which
             no login can clear and so is not reported as a barrier.
     """
-    # Outside the try, which answers every failure with "no barrier". Ahead of
-    # the blocker routes, which the bare /login/login-restriction/ also matches.
+    # Ahead of every signal below, because none of them names a host: a filter
+    # page titled "LinkedIn Login", or one that happens to carry the picker's
+    # id, would otherwise be reported as LinkedIn asking for a sign-in, and the
+    # recovery for that retires the session. A page LinkedIn did not serve is
+    # the caller's to refuse, through `raise_if_off_linkedin`.
+    if not is_linkedin_landing(page.url):
+        return None
+    # Outside any try, which would answer the failure with "no barrier". Ahead
+    # of the blocker routes, which the bare /login/login-restriction/ also
+    # matches.
     _raise_if_account_restricted(page.url)
-    try:
-        current_url = page.url
-        if _is_auth_blocker_url(current_url):
-            return f"auth blocker URL: {current_url}"
-
-        try:
-            title = (await page.title()).strip().lower()
-        except Exception:
-            title = ""
-        if any(pattern in title for pattern in _LOGIN_TITLE_PATTERNS):
-            return f"login title: {title}"
-
-        # An id, so it says the same thing in every interface language, which
-        # the picker's own words do not. The rest of the codebase already reads
-        # this container as the picker; here it is the only signal that
-        # survives a locale change, because the URL of an in-place picker is
-        # the page that was asked for and its title is that page's title.
-        #
-        # Ahead of the quick check's exit, and not behind it, because the two
-        # signals it does read are exactly the two this page defeats. The
-        # quick check runs after every navigation, so a picker served in a
-        # locale the table below does not cover reached every reading tool
-        # as page text. It costs one selector count, where the body read
-        # below is what the quick check exists to skip.
-        try:
-            if await page.locator(_REMEMBER_ME_CONTAINER_SELECTOR).count() > 0:
-                return f"account picker: {_REMEMBER_ME_CONTAINER_SELECTOR}"
-        except Exception:
-            logger.debug("Could not count remember-me containers", exc_info=True)
-
-        if not include_body_text:
-            return None
+    if _is_auth_blocker_url(page.url):
+        return f"auth blocker URL: {page.url}"
 
-        try:
-            body_text = await page.evaluate("() => document.body?.innerText || ''")
-        except Exception:
-            body_text = ""
-        if not isinstance(body_text, str):
-            body_text = ""
-
-        normalized = re.sub(r"\s+", " ", body_text).strip().lower()
-        for marker_group in _AUTH_BARRIER_TEXT_MARKERS:
-            if all(marker in normalized for marker in marker_group):
-                return f"auth barrier text: {' + '.join(marker_group)}"
-
-        return None
+    # One evaluation, so the title, the picker and the body text are all the
+    # document's whose address comes back with them. Read one at a time, a
+    # redirect landing between the address check and a later read paired
+    # LinkedIn's address with a portal's title.
+    try:
+        snapshot = await page.evaluate(
+            _AUTH_SNAPSHOT_JS,
+            {
+                "picker": _REMEMBER_ME_CONTAINER_SELECTOR,
+                "includeBody": include_body_text,
+            },
+        )
     except PlaywrightTimeoutError:
         logger.warning(
             "Timeout checking auth barrier on %s — continuing without barrier detection",
             page.url,
         )
         return None
     except Exception:
-        logger.error("Unexpected error checking auth barrier", exc_info=True)
+        # Also a document replaced mid-read, which leaves nothing to judge.
+        logger.debug("Could not read the page for auth ba
```

**File**: `linkedin_mcp_server/core/destination.py` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+"""Whether the page a navigation ended on is one LinkedIn served."""
+
+import logging
+import re
+from collections.abc import AsyncIterator
+from contextlib import asynccontextmanager
+from typing import Any, NoReturn
+from urllib.parse import urlsplit
+
+from .exceptions import OffLinkedInLandingError
+
+logger = logging.getLogger(__name__)
+
+# linkedin.com and every host under it, matched whole so `evil-linkedin.com`
+# and `linkedin.com.evil.test` are not. The same shape `identifiers.py` accepts
+# a reference on: the root, `www`, and the locale subdomains that serve a
+# profile themselves.
+_LINKEDIN_HOST = re.compile(r"^(?:[a-z0-9-]+\.)*linkedin\.com$")
+
+# The host pattern above, in the one syntax both Python and JavaScript read the
+# same way, so the in-page check below cannot drift from it.
+LINKEDIN_HOST_PATTERN = _LINKEDIN_HOST.pattern
+
+# `is_linkedin_landing` for a page script, which has to decide inside its own
+# evaluation, before it clicks, whether the document it is about to act on is
+# LinkedIn's: the address Python saw belongs to a moment that has passed. Called
+# as `(href, hostPattern)` with LINKEDIN_HOST_PATTERN.
+#
+# The two agree on browser-serialized addresses, which is all a page script is
+# ever handed (`location.href`); `tests/test_off_linkedin_landing_dom.py` holds
+# them to the same answers there. On raw strings they can differ, because the
+# browser's parser normalizes what urllib keeps: IDN, percent-encoded hosts and
+# Unicode separators. The `@` rule below is the one difference a raw string
+# exposed that was cheap to close.
+LINKEDIN_LANDING_JS = r"""(href, hostPattern) => {
+    let url;
+    try {
+        url = new URL(href);
+    } catch {
+        return false;
+    }
+    // Any userinfo, even an empty one, as urllib reads it; the parsed URL
+    // reports an empty username for `https://@host/`.
+    const authority = String(href).replace(/^[^:]*:\/\//, '').split(/[/?#\\]/, 1)[0];
+    if (authority.includes('@')) return false;
+    const host = url.hostname.replace(/\.$/, '');
+    return url.protocol === 'https:'
+        && (url.port === '' || url.port === '443')
+        && url.username === ''
+        && url.password === ''
+        && new RegExp(hostPattern).test(host);
+}"""
+
+# Reads the address of the document an element lives in, so an action is
+# judged by the page holding the element rather than the page the driver last
+# reported.
+_OWNER_DOCUMENT_ADDRESS_JS = "element => element.ownerDocument.location.href"
+
+
+def is_linkedin_landing(url: object) -> bool:
+    """Return whether *url*, a page's address, is a document LinkedIn served.
+
+    A document without a host is never one. `about:blank`, `data:` and
+    `chrome-error://` are what an interrupted navigation and an enterprise
+    proxy clearing the page leave behind, and calling them LinkedIn's would let
+    an empty page pass as a signed-in feed. Nothing here is asked about a
+    relative address: a page's own address is always absolute.
+    """
+    if not isinstance(url, str):
+        return False
+    try:
+        parsed = urlsplit(url)
+        port = parsed.port
+    except ValueError:
+        return False
+    # A single trailing dot is the fully qualified spelling of the same host.
+    host = (parsed.hostname or "").removesuffix(".")
+    return (
+        parsed.scheme == "https"
+        and port in (None, 443)
+        and parsed.username is None
+        and parsed.password is None
+        and _LINKEDIN_HOST.fullmatch(host) is not None
+    )
+
+
+def is_another_site(url: object) -> bool:
+    """Return whether *url* is a web page served by a host other than LinkedIn.
+
+    Narrower than "not a LinkedIn landing": a blank document or the browser's
+    own error page is what a failed request leaves behind, and the failure
+    that produced it already says more than where it landed.
+    """
+    if not isinstance(url, str):
+        return False
+    try:
+        scheme = urlsplit(url).scheme
+    except ValueError:
+        return False
+    return scheme in ("http", "https") and not is_linkedin_landing(url)
+
+
+def describe_landing(url: object) -> str:
+    """Name where a page landed, without its path or query.
+
+    The origin is the useful fact, and the rest of a portal's address can carry
+    a token or the whole address it intercepted.
+    """
+    if not isinstance(url, str) or not url:
+        return "an unknown page"
+    try:
+        parsed = urlsplit(url)
+        host = parsed.hostname
+        port = parsed.port
+    except ValueError:
+        return "an unreadable address"
+    if host:
+        origin = f"{parsed.scheme}://{host}"
+        return origin if port is None else f"{origin}:{port}"
+    if parsed.scheme == "about":
+        return f"about:{parsed.path}"[:40]
+    if parsed.scheme:
+        return f"a {parsed.scheme}: document"
+    return "an unknown page"
+
+
+def refuse_landing(url: object) -> NoReturn:

```

**File**: `linkedin_mcp_server/core/exceptions.py` (modified, +22/-0)
```diff
@@ -84,6 +84,28 @@ class ProxyConnectionError(NetworkError):
     pass
 
 
+class OffLinkedInLandingError(NetworkError):
+    """A navigation ended on a page LinkedIn did not serve.
+
+    A captive portal, a proxy interstitial or a web filter answers in
+    LinkedIn's place, and its page would otherwise be read as the profile or
+    job that was asked for. A network error and not an ``AuthenticationError``
+    for the same reason as :class:`ProxyConnectionError`: the stored session
+    says nothing about the network in front of it, and the login that recovery
+    would open has to go through the very page that is in the way.
+    """
+
+    def __init__(self, landed_on: str):
+        super().__init__(
+            f"The browser landed on {landed_on} instead of LinkedIn, so nothing "
+            "was read. A captive portal, proxy or network filter is likely "
+            "answering in LinkedIn's place. Open linkedin.com in a normal "
+            "browser on this network, clear whatever page it shows, then retry. "
+            "The stored LinkedIn session was kept."
+        )
+        self.landed_on = landed_on
+
+
 class PageReadError(LinkedInOperationError):
     """Raised when reading a page fails for various reasons."""
 
```

**File**: `linkedin_mcp_server/core/utils.py` (modified, +6/-2)
```diff
@@ -12,7 +12,8 @@
     TimeoutError as PlaywrightTimeoutError,
 )
 
-from .exceptions import RateLimitError
+from .destination import linkedin_element
+from .exceptions import OffLinkedInLandingError, RateLimitError
 
 logger = logging.getLogger(__name__)
 
@@ -548,12 +549,15 @@ async def handle_modal_close(page: Page) -> bool:
         ).first
 
         if await close_button.is_visible(timeout=1000):
-            await close_button.click()
+            async with linkedin_element(close_button, timeout=1000) as button:
+                await button.click()
             await asyncio.sleep(0.5)
             logger.debug("Closed modal")
             return True
     except PlaywrightTimeoutError:
         pass
+    except OffLinkedInLandingError:
+        raise
     except Exception as e:
         logger.debug("Error closing modal: %s", e)
 
```

---

### Incident Patch 4: `bf1591c2` (2026-10-05)
**Commit Message**: fix(jobs): Stop the sidebar scroll on cancel (#1234)

## Problem

`scroll_job_sidebar` ran as one long `page.evaluate()` whose in-page
timers kept scrolling the job rail after the tool call was cancelled.
That covered a FastMCP timeout and a task cancel alike. The next tool
got a page that was still loading the cancelled search's results.

## Solution

Python now owns every wait and repeat. Each browser step measures the
rail and scrolls only when asked. A cancel stops sending steps. A scroll
already sent is waited for, up to 5 seconds, before the page is
released. The measured rail is held by its DOM node, so a container that
wraps or ties with it no longer counts as growth. Container choice,
settling, the deadline, the scroll cap and the return value are
unchanged.

## Verification

New browser DOM tests cancel through `Task.cancel`, an AnyIO timeout and
the real sequential middleware while a scroll is queued behind a busy
renderer. Others cover tied containers appearing mid-wait. Planted
faults fail them. The browser DOM suite passed three times.

Closes #763

## Synthetic prompt

> Make the job sidebar scroll stop when its tool call is cancelled: move
waits and repetition from 

**File**: `changelog.d/1234.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A cancelled job search no longer keeps scrolling its results in the shared page.
```

**File**: `linkedin_mcp_server/core/utils.py` (modified, +255/-158)
```diff
@@ -3,8 +3,14 @@
 import asyncio
 import logging
 import time
+from typing import Any
 
-from patchright.async_api import Page, TimeoutError as PlaywrightTimeoutError
+import anyio
+from patchright.async_api import (
+    JSHandle,
+    Page,
+    TimeoutError as PlaywrightTimeoutError,
+)
 
 from .exceptions import RateLimitError
 
@@ -107,6 +113,163 @@
             };
 """
 
+# One look at the rail and, when asked, one scroll of it. Synchronous on
+# purpose: every wait and every repeat belongs to `scroll_job_sidebar`, so a
+# cancelled call has nothing left running in the page. Cancelling the task that
+# awaits `page.evaluate()` does not cancel a promise the page is running, and
+# the polling loop that used to live here went on scrolling the shared page
+# after a tool timeout had handed it to the next call (#763).
+#
+# The rail a step measured is kept in `holder`, an object only the caller's
+# handle reaches, and stays the rail while it is attached and still ties the
+# pick. Measuring whichever candidate wins instead compares one container's
+# height against another's: a taller tied container appearing mid-wait then
+# reads as a batch, which spends one of `maxScrolls` and can end the page with
+# the batch still in flight. Only the node itself identifies it. Its position
+# does not: wrapping the rail, or inserting a tied sibling before it, puts
+# another container where the rail was. A rail a re-render detached is
+# replaced by a fresh pick, which is what adopting a replacement always did.
+_RAIL_STEP_JS = (
+    r"""(opts) => {
+            const {selector, scroll, holder} = opts;
+"""
+    + _RAIL_PICK_JS
+    + r"""
+            if (!document.querySelectorAll(selector).length) {
+                return {status: 'gone'};
+            }
+            const tied = railGroup();
+            let picked = null;
+            for (const node of tied) {
+                if (!picked || node.contains(picked)) picked = node;
+            }
+            if (!picked) return {status: 'no-container'};
+            // `tied` holds attached nodes only, so a rail a re-render
+            // detached falls back to the pick here.
+            const kept = holder.rail;
+            const rail = kept && tied.includes(kept) ? kept : picked;
+            holder.rail = rail;
+
+            // Measured before the scroll, so the batch it asks for reads as
+            // growth against this step.
+            const measured = {
+                status: 'ok',
+                cards: idsIn(rail),
+                height: rail.scrollHeight,
+            };
+            if (scroll) {
+                // Only the tied candidates nested with the pick. Two tied
+                // siblings are the live shape, rail and detail pane, and
+                // scrolling the pane loads its similar-jobs module into the
+                // document, where the caller reads those ids as search
+                // results. Measured on a 6-to-6 tie: the pane reached 31 ids
+                // and the search returned 37, of which 31 were not results,
+                // while the rail stayed at 6 because growth was then read
+                // off the pane instead.
+                for (const node of tied) {
+                    if (node === picked
+                        || node.contains(picked) || picked.contains(node)) {
+                        node.scrollTop = node.scrollHeight;
+                    }
+                }
+            }
+            return measured;
+        }"""
+)
+
+# How long a cancelled call waits for a scroll step it has already sent. A
+# renderer busy with a long task holds the step in its queue, and a cancel does
+# not take it back out: measured behind a 1s task, the rail scrolled about
+# 0.9s after the cancel had released the page to the next call. The wait is
+# bounded so that a page that never answers cannot hold the page lock forever.
+_SENT_SCROLL_GRACE = 5.0
+
+
+async def _rail_step(page: Page, holder: JSHandle, *, scroll: bool) -> dict[str, Any]:
+    """Measure the rail, scrolling it afterwards when ``scroll`` is set.
+
+    A step that only measures writes nothing, so a cancel may abandon it. A
+    step that scrolls is waited for: until it has run, the page may still move
+    after this call has given it up.
+    """
+    step = asyncio.ensure_future(
+        page.evaluate(
+            _RAIL_STEP_JS,
+            {"selector": _JOB_CARD_SELECTOR, "scroll": scroll, "holder": holder},
+        )
+    )
+    if not scroll:
+        return await step
+    try:
+        return await asyncio.shield(step)
+    except asyncio.CancelledError:
+        await _let_the_scroll_land(step)
+        raise
+
+
+async def _let_the_scroll_land(step: asyncio.Future[Any]) -> None:
+    """Wait, within the grace period, for a sent scroll step to finish.
+
+    Shielded from AnyIO as well as from asyncio: a tool timeout is an AnyIO
+    cancel scope, which cancels the task again on every pass of the event loop
+    
```

**File**: `tests/test_core_utils.py` (modified, +23/-0)
```diff
@@ -141,3 +141,26 @@ async def test_a_sliver_of_budget_is_still_a_timeout(self):
         await scroll_job_sidebar(page, deadline=0.0004)
 
         assert page.wait_for_selector.await_args.kwargs["timeout"] == 1
+
+    async def test_a_deadline_spent_releasing_the_rail_still_ends_the_call(self):
+        """Releasing the rail handle is shielded, so a tool deadline that falls
+        inside it would otherwise be swallowed and the scroll return normally
+        after the caller's time was up."""
+        import asyncio
+
+        import anyio
+
+        page = self._page()
+        holder = MagicMock()
+
+        async def slow_dispose() -> None:
+            await asyncio.sleep(0.3)
+
+        holder.dispose = AsyncMock(side_effect=slow_dispose)
+        page.evaluate_handle = AsyncMock(return_value=holder)
+
+        with pytest.raises(TimeoutError):
+            with anyio.fail_after(0.1):
+                await scroll_job_sidebar(page)
+
+        holder.dispose.assert_awaited_once()
```

**File**: `tests/test_job_sidebar_scroll_dom.py` (modified, +378/-1)
```diff
@@ -11,14 +11,22 @@
 
 from __future__ import annotations
 
+import asyncio
 import logging
 import time
+from collections.abc import Callable
+from typing import cast
 
+import anyio
 import pytest
-from patchright.async_api import async_playwright
+from fastmcp import FastMCP
+from patchright.async_api import Page, async_playwright
 
 from linkedin_mcp_server.core.utils import _JOB_CARD_SELECTOR, scroll_job_sidebar
 from linkedin_mcp_server.linkedin.job_pages import JOB_IDS_JS
+from linkedin_mcp_server.sequential_tool_middleware import (
+    SequentialToolExecutionMiddleware,
+)
 
 
 async def job_ids(page, *, scoped: bool = False) -> list[str]:
@@ -713,6 +721,375 @@ async def test_the_deadline_covers_the_wait_for_the_first_card(self, dom_page):
         assert elapsed >= 0.9
         assert await rail_cards(dom_page) == 1
 
+    async def test_a_tied_ancestor_turning_scrollable_is_not_growth(self, dom_page):
+        """The rail held so far stays the rail while it still ties.
+
+        An ancestor that starts scrolling mid-wait holds every id the rail
+        holds, so it ties and, being outermost, wins the pick. It is also far
+        taller than the rail. Measuring it against the rail's height reads as
+        a batch while the real one is still in flight, which spends the last
+        scroll here and returns ten cards instead of fifteen.
+        """
+        await dom_page.set_content(
+            rail_with_a_late_tie(
+                """
+                document.getElementById('outer').style.cssText =
+                    'height:200px;overflow-y:auto';
+                """
+            )
+        )
+
+        await scroll_job_sidebar(dom_page, max_scrolls=2)
+
+        assert await rail_cards(dom_page) == 15
+
+    async def test_a_new_wrapper_around_the_rail_is_not_the_rail(self, dom_page):
+        """A tied scroller wrapped around the rail takes the rail's place.
+
+        It sits where the rail sat and holds every id the rail holds, so
+        anything that finds the rail by its position finds the wrapper, and
+        the wrapper's height reads as a batch.
+        """
+        await dom_page.set_content(
+            rail_with_a_late_tie(
+                """
+                const wrap = document.createElement('div');
+                wrap.style.cssText = 'height:200px;overflow-y:auto';
+                rail.replaceWith(wrap);
+                wrap.appendChild(rail);
+                const room = document.createElement('div');
+                room.style.height = '3000px';
+                wrap.appendChild(room);
+                """
+            )
+        )
+
+        await scroll_job_sidebar(dom_page, max_scrolls=2)
+
+        assert await rail_cards(dom_page) == 15
+
+    async def test_a_tied_sibling_inserted_before_the_rail_is_not_the_rail(
+        self, dom_page
+    ):
+        """A tied container inserted ahead of the rail takes its position.
+
+        It holds as many ids as the rail, all of them other jobs, and is far
+        taller, so a rail found by position becomes this container and its
+        height reads as a batch.
+        """
+        await dom_page.set_content(
+            rail_with_a_late_tie(
+                """
+                const pane = document.createElement('div');
+                pane.style.cssText = 'height:120px;overflow-y:scroll';
+                for (let i = 1; i <= n; i++) {
+                  const a = document.createElement('a');
+                  a.href = '/jobs/view/' + (999000 + i) + '/';
+                  a.style.cssText = 'display:block;height:40px';
+                  pane.appendChild(a);
+                }
+                const room = document.createElement('div');
+                room.style.height = '3000px';
+                pane.appendChild(room);
+                rail.before(pane);
+                """
+            )
+        )
+
+        await scroll_job_sidebar(dom_page, max_scrolls=2)
+
+        assert await rail_cards(dom_page) == 15
+
+
+def rail_with_a_late_tie(tie: str) -> str:
+    """A rail whose last batch is slow, with a tie made while it is in flight.
+
+    Five cards, a fast batch, then a 1.5s one. ``tie`` runs 300ms after the
+    scroll that asked for the slow batch, with ``rail`` and the card count
+    ``n`` in scope, and makes another container tie the rail. With
+    ``max_scrolls=2`` the call has no scroll to spare: reading the tie as a
+    batch returns before the real one lands, at ten cards.
+    """
+    return f"""
+    <body style="margin:0">
+      <div id="outer">
+        <div id="rail"
+             style="height:120px;overflow-y:scroll;overflow-anchor:none">
+          <div id="list"></div><div style="height:600px"></div>
+        </div>
+        <div style="height:3000px"></div>
+      </div>
+      <script>
+        const list = document.getElementById('list');
+        const rail = document.getElementById('rail');
+        let n = 0;
+        const add = (count) => {{
+          for 
```

---

### Incident Patch 5: `46d365b2` (2026-10-05)
**Commit Message**: fix(cli): Keep a session made after logout confirms (#1231)

## Problem

`--logout` asks for confirmation, then deletes whatever session is there
when it finally holds the profile. The prompt can stay open
indefinitely, and after it retires a shared browser it waits up to 60
seconds for the profile. Another client that signed in or imported a
session in between had that new session deleted, and logout reported
success.

## Solution

Logout records which session it showed the user before asking. Under the
profile lease and before deleting anything, it checks that session is
still there. If the session changed, or its metadata became unreadable,
nothing is deleted and logout exits 1 saying so. This applies to both
Direct and shared-browser logout. A browser re-exporting cookies for the
same login does not count as a change.

## Verification

New CLI and session-state tests cover a sign-in during the prompt, a
sign-in at the handover, a cookie re-export, and unreadable metadata.
Planting a skipped comparison fails them.

Closes #1143

## Synthetic prompt

> Make --logout delete only the session the user confirmed: snapshot its
identity before the prompt and compare it under the profil

**File**: `changelog.d/1231.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Logout no longer deletes a session another client signed in with while it waited.
```

**File**: `linkedin_mcp_server/authentication.py` (modified, +7/-2)
```diff
@@ -8,6 +8,7 @@
 from pathlib import Path
 
 from linkedin_mcp_server.session_state import (
+    AuthStateIdentity,
     clear_auth_state as clear_all_auth_state,
     get_source_profile_dir,
     portable_cookie_path,
@@ -57,6 +58,10 @@ def get_authentication_source() -> bool:
     )
 
 
-def clear_auth_state(profile_dir: Path | None = None) -> bool:
+def clear_auth_state(
+    profile_dir: Path | None = None, *, confirmed: AuthStateIdentity | None = None
+) -> bool:
     """Clear source session artifacts and all derived runtime sessions."""
-    return clear_all_auth_state(profile_dir or get_source_profile_dir())
+    return clear_all_auth_state(
+        profile_dir or get_source_profile_dir(), confirmed=confirmed
+    )
```

**File**: `linkedin_mcp_server/cli_main.py` (modified, +22/-4)
```diff
@@ -382,6 +382,17 @@ def clear_profile_and_exit() -> None:
         print("Nothing to clear.")
         sys.exit(0)
 
+    # Before asking: what the user agrees to delete is the session there now,
+    # and the deletion checks it is still that one once the profile is held.
+    try:
+        confirmed = session_state.auth_state_identity(get_profile_dir())
+    except OSError as e:
+        print(
+            "❌ The stored LinkedIn session could not be read to tell what would "
+            f"be cleared ({type(e).__name__}). Nothing was deleted."
+        )
+        sys.exit(1)
+
     print(f"🔑 Clear LinkedIn authentication state from {auth_root}?")
 
     try:
@@ -401,16 +412,23 @@ def clear_profile_and_exit() -> None:
         if _retire_a_shared_browser(config, retirement):
             try:
                 cleared = session_state.clear_auth_state(
-                    get_profile_dir(), wait_seconds=PROFILE_HANDOVER_WAIT_SECONDS
+                    get_profile_dir(),
+                    wait_seconds=PROFILE_HANDOVER_WAIT_SECONDS,
+                    confirmed=confirmed,
                 )
             except RuntimeError as e:
                 # The profile did not come free in time: a successor may have
-                # taken it, or the retiring browser is slow to close. Nothing
-                # was deleted.
+                # taken it, or the retiring browser is slow to close. Or it did,
+                # and another client had signed in while this one waited.
+                # Nothing was deleted.
                 print(f"❌ {e}")
                 sys.exit(1)
         else:
-            cleared = clear_auth_state(get_profile_dir())
+            try:
+                cleared = clear_auth_state(get_profile_dir(), confirmed=confirmed)
+            except session_state.SessionChangedError as e:
+                print(f"❌ {e}")
+                sys.exit(1)
 
     if cleared:
         print("✅ LinkedIn authentication state cleared successfully!")
```

**File**: `linkedin_mcp_server/session_state.py` (modified, +101/-1)
```diff
@@ -1229,8 +1229,82 @@ def _retire(backup_dir: Path, targets: list[Path]) -> None:
             logger.warning("Could not re-retire %s: %s", target, exc)
 
 
+@dataclass(frozen=True)
+class AuthStateIdentity:
+    """Which stored session a logout was confirmed for, without its contents.
+
+    Read from metadata only, never from the cookies themselves: the login
+    generation or, without one, the cookie file's inode, size and modification
+    time, whether the profile has anything in it, and the metadata file's own
+    identity when it is there but could not be read.
+    """
+
+    login_generation: str | None
+    cookies: tuple[int, int, int] | None
+    profile: bool
+    unreadable_state: tuple[int, int, int] | None = None
+
+
+class SessionChangedError(RuntimeError):
+    """The stored session is no longer the one the logout was confirmed for.
+
+    A ``RuntimeError`` like the busy-profile refusal beside it, because a caller
+    reads both the same way: nothing was deleted, and saying why is enough.
+    """
+
+
+def _file_identity(path: Path) -> tuple[int, int, int] | None:
+    """*path*'s inode, size and modification time, or ``None`` when absent.
+
+    Any other failure to stat it is raised: a file that is there but cannot be
+    read is not the same as one that is not there.
+    """
+    try:
+        stat = path.stat()
+    except FileNotFoundError:
+        return None
+    return (stat.st_ino, stat.st_size, stat.st_mtime_ns)
+
+
+def auth_state_identity(source_profile_dir: Path | None = None) -> AuthStateIdentity:
+    """Identify the stored session, to compare against later under the lease.
+
+    Every login and import writes a fresh generation once its cookies are
+    exported, so where there is one it alone says which session this is. The
+    cookie file is deliberately left out then: a browser closing on the source
+    profile re-exports its cookies (``_close_browser_locked``), and the shared
+    browser a logout has just asked to retire does exactly that during the
+    handover, so its stat moves while the session stays the same. Without a
+    generation no server runs on the profile, which is what makes the cookie
+    file's stat a usable stand-in for state written before generations existed.
+
+    Raises:
+        OSError: The cookie file or the profile is there but cannot be read.
+    """
+    profile_dir = canonical(source_profile_dir or get_source_profile_dir())
+    state = load_source_state(profile_dir)
+    profile = profile_exists(profile_dir)
+    if state is not None:
+        return AuthStateIdentity(state.login_generation, None, profile)
+    # The loader reads a file it cannot parse as no file at all, which is
+    # right for a server deciding whether to log in and wrong here: a
+    # generation that became unreadable, or a login half-written over older
+    # state, would compare equal to what the user confirmed. Its own identity
+    # tells them apart, while a file that was already unreadable when the user
+    # was asked still compares equal and can be cleared.
+    return AuthStateIdentity(
+        None,
+        _file_identity(portable_cookie_path(profile_dir)),
+        profile,
+        _file_identity(source_state_path(profile_dir)),
+    )
+
+
 def clear_auth_state(
-    source_profile_dir: Path | None = None, *, wait_seconds: float = 0.0
+    source_profile_dir: Path | None = None,
+    *,
+    wait_seconds: float = 0.0,
+    confirmed: AuthStateIdentity | None = None,
 ) -> bool:
     """Remove source auth artifacts, derived runtime profiles and quarantines.
 
@@ -1241,8 +1315,16 @@ def clear_auth_state(
     *wait_seconds* bounds a wait for another holder of the profile to let go,
     and only a logout that has asked a shared browser to retire passes one.
 
+    *confirmed* is the session the user agreed to delete, read before they were
+    asked. Given one, this deletes nothing unless the session on disk is still
+    that one once the profile is held. A prompt can stay open indefinitely and
+    the handover wait is long too, and another client that signs in or imports
+    in between leaves a session nobody agreed to delete.
+
     Raises:
         ProfileRootRefusedError: The root is not one this server owns.
+        SessionChangedError: The session on disk is no longer *confirmed*, or
+            could not be read to tell. Nothing was deleted.
         RuntimeError: Another process is using the profile. Deleting it out from
             under a live browser corrupts that session and, with several clients,
             destroys everyone's rather than just this caller's.
@@ -1251,6 +1333,24 @@ def clear_auth_state(
     with _exclusive_profile(
         profile_dir, action="clearing the stored session", wait_seconds=wait_seconds
     ):
+        # Under the lease and before the first deletion: read any earlier, and
+        # a login completing in between would still be deleted.
+        if confirmed is not None:
+            try:
+ 
```

**File**: `tests/test_cli_main.py` (modified, +165/-1)
```diff
@@ -3,6 +3,7 @@
 import importlib.metadata
 import json
 import logging
+import threading
 from typing import Literal
 from unittest.mock import AsyncMock, MagicMock
 
@@ -895,7 +896,7 @@ def test_clear_profile_and_exit_clears_all_auth_state(
 
     cleared = {}
 
-    def fake_clear(profile):
+    def fake_clear(profile, **_kwargs):
         cleared["profile"] = profile
         return True
 
@@ -2098,6 +2099,169 @@ def test_a_profile_the_retiring_owner_lets_go_of_is_cleared(self):
 
         assert not self._session_intact()
 
+    # -- the session the user confirmed ------------------------------------- #
+
+    def _sign_in_elsewhere(self) -> str:
+        """Leave what another client's login leaves; return its generation.
+
+        Written directly rather than through a rotation, which would need the
+        profile lease the handover test is holding on that client's behalf.
+        """
+        import shutil
+
+        from linkedin_mcp_server.session_state import (
+            portable_cookie_path,
+            write_source_state,
+        )
+
+        shutil.rmtree(self.profile)
+        (self.profile / "Default").mkdir(parents=True)
+        (self.profile / "Default" / "Cookies").write_text("theirs")
+        portable_cookie_path(self.profile).write_text('[{"name": "li_at"}]')
+        return write_source_state(self.profile).login_generation
+
+    def _signed_in_as(self, generation: str) -> bool:
+        from linkedin_mcp_server.session_state import (
+            load_source_state,
+            portable_cookie_path,
+        )
+
+        state = load_source_state(self.profile)
+        return (
+            state is not None
+            and state.login_generation == generation
+            and portable_cookie_path(self.profile).exists()
+            and (self.profile / "Default" / "Cookies").read_text() == "theirs"
+        )
+
+    def _after_the_first_prompt(self, timer: threading.Timer) -> threading.Timer:
+        """Answer yes to every prompt, starting *timer* at the first one.
+
+        Not before the logout runs: it reads the session before it asks, and a
+        change landing ahead of that read is the session the user confirms.
+        """
+        started: list[bool] = []
+
+        def ask(_prompt: str = "") -> str:
+            if not started:
+                started.append(True)
+                timer.start()
+            return "y"
+
+        self.monkeypatch.setattr("builtins.input", ask)
+        return timer
+
+    def test_a_session_signed_in_during_the_prompt_survives(self, capsys):
+        # Direct: nothing shared to retire, and the prompt can stay open for as
+        # long as the user leaves it.
+        self.config.server.daemon_enabled = False
+        self._seed_session()
+        generation: list[str] = []
+
+        def ask(_prompt: str = "") -> str:
+            generation.append(self._sign_in_elsewhere())
+            return "y"
+
+        self.monkeypatch.setattr("builtins.input", ask)
+
+        assert self._logout() == 1
+
+        assert self._signed_in_as(generation[0])
+        out = capsys.readouterr().out
+        assert "changed after you confirmed" in out
+        assert "cleared successfully" not in out
+
+    def test_a_session_it_cannot_read_before_asking_is_left_alone(self, capsys):
+        # State from before login generations, so the cookie file's own stat is
+        # what identifies it, and that stat fails.
+        from pathlib import Path
+
+        from linkedin_mcp_server.session_state import (
+            portable_cookie_path,
+            source_state_path,
+        )
+
+        self.config.server.daemon_enabled = False
+        self._seed_session()
+        source_state_path(self.profile).unlink(missing_ok=True)
+        cookies = portable_cookie_path(self.profile)
+        cookies.write_text("[]")
+        real_stat = Path.stat
+
+        def refuse(path: Path, *args, **kwargs):
+            if path.name == cookies.name:
+                raise PermissionError(13, "Permission denied", str(path))
+            return real_stat(path, *args, **kwargs)
+
+        self.monkeypatch.setattr(Path, "stat", refuse)
+        self.monkeypatch.setattr(
+            "builtins.input", lambda _prompt="": pytest.fail("asked anyway")
+        )
+
+        assert self._logout() == 1
+
+        self.monkeypatch.setattr(Path, "stat", real_stat)
+        assert cookies.exists()
+        assert (self.profile / "Default" / "Cookies").exists()
+        out = capsys.readouterr().out
+        assert "could not be read" in out
+        assert "Nothing was deleted" in out
+
+    def test_a_session_signed_in_during_the_handover_survives(self, capsys):
+        # The retiring browser lets go, and another client gets in first.
+        import threading
+
+        self._seed_session()
+        owner = self._owner()
+        release = self._hold_the_profile()
+        generation: list[str] = []
+
+        def sign_in_then_let_go() -> None:
+            generation
```

**File**: `tests/test_session_state.py` (modified, +110/-0)
```diff
@@ -8,7 +8,9 @@
 
 from linkedin_mcp_server.profile_claim import ensure_profile_claim
 from linkedin_mcp_server.session_state import (
+    SessionChangedError,
     _native_machine_win32,
+    auth_state_identity,
     clear_auth_state,
     get_runtime_id,
     load_runtime_state,
@@ -768,6 +770,114 @@ def listen() -> None:
         assert heard == [True]
 
 
+class TestClearingOnlyTheConfirmedSession:
+    """A logout deletes the session the user agreed to, and no later one."""
+
+    def test_an_unchanged_session_is_cleared(self, isolate_profile_dir):
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        confirmed = auth_state_identity(profile_dir)
+
+        assert clear_auth_state(profile_dir, confirmed=confirmed) is True
+
+        assert not profile_dir.exists()
+        assert not portable_cookie_path(profile_dir).exists()
+
+    def test_a_login_after_confirmation_is_left_in_place(self, isolate_profile_dir):
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        confirmed = auth_state_identity(profile_dir)
+        rotate_source_profile(profile_dir)
+        _seed_session(profile_dir, machine_id="9999")
+        generation = write_source_state(profile_dir).login_generation
+
+        with pytest.raises(SessionChangedError, match="changed after you confirmed"):
+            clear_auth_state(profile_dir, confirmed=confirmed)
+
+        state = load_source_state(profile_dir)
+        assert state is not None and state.login_generation == generation
+        assert portable_cookie_path(profile_dir).exists()
+        assert "9999" in (profile_dir / "Local State").read_text()
+        assert len(quarantine_dirs(profile_dir)) == 1
+
+    def test_a_re_export_under_the_same_login_is_still_cleared(
+        self, isolate_profile_dir
+    ):
+        # What a browser closing on the source profile does to the cookie file.
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        confirmed = auth_state_identity(profile_dir)
+        cookies = portable_cookie_path(profile_dir)
+        cookies.unlink()
+        cookies.write_text('[{"name": "li_at"}, {"name": "JSESSIONID"}]')
+
+        assert clear_auth_state(profile_dir, confirmed=confirmed) is True
+
+        assert not cookies.exists()
+
+    def test_without_metadata_the_cookie_file_decides(self, isolate_profile_dir):
+        # State from before generations existed: only the cookie file and the
+        # profile can say whether it is still the one confirmed.
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        source_state_path(profile_dir).unlink()
+        confirmed = auth_state_identity(profile_dir)
+        cookies = portable_cookie_path(profile_dir)
+        cookies.unlink()
+        cookies.write_text('[{"name": "li_at"}, {"name": "JSESSIONID"}]')
+
+        with pytest.raises(SessionChangedError):
+            clear_auth_state(profile_dir, confirmed=confirmed)
+
+        assert cookies.exists()
+        assert (profile_dir / "Local State").exists()
+
+    def test_metadata_that_became_unreadable_is_not_cleared(self, isolate_profile_dir):
+        # The loader reads an unparsable file as no file, so without its own
+        # identity this compared equal to whatever the cookie file said.
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        confirmed = auth_state_identity(profile_dir)
+        source_state_path(profile_dir).write_text("{")
+
+        with pytest.raises(SessionChangedError):
+            clear_auth_state(profile_dir, confirmed=confirmed)
+
+        assert portable_cookie_path(profile_dir).exists()
+        assert (profile_dir / "Local State").exists()
+
+    def test_metadata_written_after_confirmation_is_not_cleared(
+        self, isolate_profile_dir
+    ):
+        # Older state without a generation, and a login that has begun writing
+        # one over it.
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        source_state_path(profile_dir).unlink()
+        confirmed = auth_state_identity(profile_dir)
+        source_state_path(profile_dir).write_text('{"version"')
+
+        with pytest.raises(SessionChangedError):
+            clear_auth_state(profile_dir, confirmed=confirmed)
+
+        assert portable_cookie_path(profile_dir).exists()
+
+    def test_metadata_already_unreadable_when_confirmed_is_cleared(
+        self, isolate_profile_dir
+    ):
+        # What the user was shown and agreed to delete. A logout is the way out
+        # of a broken session, so it must not refuse one.
+        profile_dir = isolate_profile_dir
+        _seed_session(profile_dir)
+        source_state_path(profile_dir).write_text("{")
+        confirmed = auth_state_identity(profile_dir)
+
+        assert clear_auth_state(profile_dir, confirmed=confirmed) is True
+
+        assert not portable_cookie_path(profile_dir).exists()
+        assert n
```

---

### Incident Patch 6: `7609a668` (2026-10-05)
**Commit Message**: fix(setup): Say Ctrl+Z does not pause the download (#1230)

## Problem

The managed browser installer runs outside the terminal's process group,
so it can clean up after its parent dies (#789). That also keeps the
terminal's stop signal from reaching it. Ctrl+Z stopped the CLI command
while the download went on in the background.

## Solution

The issue accepts saying so instead of forwarding the signal, which
would have to keep that containment intact. When the CLI installs the
browser at an interactive POSIX terminal, it now prints that suspending
the command does not pause the download.

## Verification

New tests show the line at a terminal and not otherwise. It never
appears when the browser is already installed. Planting a fault that
suppresses it fails the terminal case.

Closes #792

## Synthetic prompt

> When the CLI installs the managed browser at an interactive POSIX
terminal, tell the user that Ctrl+Z does not pause the download, because
the installer is detached from the terminal's process group.

Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for
review in Claude Code via T3 Code.


<!-- Macroscope's pull request summary starts here -->
<!-- Macros

**File**: `changelog.d/1230.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+The CLI now says that Ctrl+Z does not pause a browser download.
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +48/-6)
```diff
@@ -26,7 +26,7 @@
 import tempfile
 import threading
 import time
-from typing import Any, NoReturn, TypeVar
+from typing import Any, NoReturn, TextIO, TypeVar
 from urllib.parse import urlsplit
 
 from fastmcp import Context
@@ -2769,14 +2769,24 @@ def _log_handlers_follow_the_live_region(
                 handler.setStream(stream)
 
 
-def _print_whatever_the_stream_takes(line: str) -> None:
-    """Print a line, replacing anything the stream cannot encode."""
-    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
+def _print_whatever_the_stream_takes(
+    line: str, *, stream: TextIO | None = None
+) -> None:
+    """Print a line, replacing anything the stream cannot encode.
+
+    *stream* defaults to stdout as it is when called, not as it was at import.
+    """
+    target = sys.stdout if stream is None else stream
+    encoding = getattr(target, "encoding", None) or "utf-8"
     try:
         try:
-            print(line, flush=True)
+            print(line, file=target, flush=True)
         except UnicodeEncodeError:
-            print(line.encode(encoding, "replace").decode(encoding), flush=True)
+            print(
+                line.encode(encoding, "replace").decode(encoding),
+                file=target,
+                flush=True,
+            )
     except (OSError, ValueError):
         # A closed or broken stdout is not a reason to fail an install, and the
         # replacement attempt can meet the same closed pipe as the first.
@@ -3761,6 +3771,33 @@ async def _ensure_browser_installed(
     await _run_browser_setup(line_callback=line_callback)
 
 
+def _suspend_notice_stream() -> TextIO | None:
+    """Where to tell a terminal user that Ctrl+Z will not pause setup, if anywhere.
+
+    The installer runs outside the terminal's process group, so it survives
+    this process long enough to clean up after itself (#789). The same
+    detachment keeps the terminal's stop signal from reaching it: Ctrl+Z stops
+    the command and the download carries on. Forwarding the signal would have
+    to keep that containment intact, so the user is told instead (#792).
+
+    Only POSIX has job control, and only the foreground job of a terminal
+    receives Ctrl+Z, whichever standard descriptor names it: ``--status
+    </dev/null`` still stops on Ctrl+Z, measured on macOS. The notice goes to
+    an output that is that terminal, so ``--status > status.log`` says it on
+    stderr rather than into the file. With neither output on it, nobody would
+    read the line.
+    """
+    if os.name == "nt":
+        return None
+    for descriptor, stream in ((1, sys.stdout), (2, sys.stderr)):
+        try:
+            if os.isatty(descriptor) and os.tcgetpgrp(descriptor) == os.getpgrp():
+                return stream
+        except OSError:
+            continue
+    return None
+
+
 def ensure_browser_installed() -> None:
     """Install the Patchright Chromium browser for a CLI mode, if absent.
 
@@ -3790,6 +3827,11 @@ def ensure_browser_installed() -> None:
     # carries the encoding fallback, which the cross mark below needs on an
     # ascii terminal for the same reason.
     _print_whatever_the_stream_takes("   Installing Patchright Chromium browser...")
+    if (terminal := _suspend_notice_stream()) is not None:
+        _print_whatever_the_stream_takes(
+            "   Suspending this command (Ctrl+Z) does not pause the download.",
+            stream=terminal,
+        )
     try:
         with _cli_progress() as report:
             asyncio.run(_ensure_browser_installed(line_callback=report))
```

**File**: `tests/test_bootstrap.py` (modified, +63/-0)
```diff
@@ -8060,6 +8060,69 @@ def test_noop_when_present(self, isolate_profile_dir, monkeypatch):
 
         assert calls["value"] == 0
 
+    @staticmethod
+    def _terminal(monkeypatch, *, on: tuple[int, ...], foreground: bool) -> None:
+        """Put descriptors *on* a terminal, with this job in its foreground or not."""
+        group = os.getpgrp()
+        monkeypatch.setattr(os, "isatty", lambda fd: fd in on)
+        monkeypatch.setattr(
+            os, "tcgetpgrp", lambda _fd: group if foreground else group + 1
+        )
+
+    @pytest.mark.parametrize(
+        ("on", "foreground", "told_on"),
+        [
+            pytest.param((0, 1, 2), True, "out", id="at-a-terminal"),
+            # ``--status </dev/null`` from a shell: still stopped by Ctrl+Z.
+            pytest.param((1, 2), True, "out", id="stdin-redirected"),
+            # ``--status > status.log``: said where the user is, not in the file.
+            pytest.param((0, 2), True, "err", id="stdout-redirected"),
+            pytest.param((0,), True, None, id="both-outputs-redirected"),
+            pytest.param((0, 1, 2), False, None, id="background-job"),
+            pytest.param((), True, None, id="no-terminal"),
+        ],
+    )
+    def test_a_terminal_user_hears_that_suspending_does_not_pause(
+        self, isolate_profile_dir, monkeypatch, capsys, on, foreground, told_on
+    ):
+        """The installer runs outside the terminal's process group (#792).
+
+        So Ctrl+Z stops the command and the download goes on. Only the
+        foreground job of a terminal receives it, so only that job says so,
+        and on an output that is the terminal.
+        """
+        if os.name == "nt":
+            pytest.skip("Windows has no job control")
+        _patch_targets_and_version(monkeypatch)
+        monkeypatch.setattr(
+            "linkedin_mcp_server.bootstrap.browser_ready", lambda: False
+        )
+        self._stub(monkeypatch)
+        self._terminal(monkeypatch, on=on, foreground=foreground)
+
+        ensure_browser_installed()
+
+        captured = capsys.readouterr()
+        said = {
+            name
+            for name, text in (("out", captured.out), ("err", captured.err))
+            if "does not pause the download" in text
+        }
+        assert said == ({told_on} if told_on else set())
+
+    def test_a_ready_browser_says_nothing_about_suspending(
+        self, isolate_profile_dir, monkeypatch, capsys
+    ):
+        if os.name == "nt":
+            pytest.skip("Windows has no job control")
+        monkeypatch.setattr("linkedin_mcp_server.bootstrap.browser_ready", lambda: True)
+        self._stub(monkeypatch)
+        self._terminal(monkeypatch, on=(0, 1, 2), foreground=True)
+
+        ensure_browser_installed()
+
+        assert "pause" not in capsys.readouterr().out
+
     def test_shell_only_is_not_enough(self, isolate_profile_dir, monkeypatch):
         """A pre-existing shell-only install must still trigger the download.
 
```

---

### Incident Patch 7: `4c0da72a` (2026-10-05)
**Commit Message**: fix(messaging): Answer before the tool deadline (#1233)

## Problem

FastMCP ends a tool at its timeout. If `send_message` reached that
deadline after the message may have been submitted, the client got only
"Error calling tool 'send_message'". It had no way to tell whether the
message went out or whether retrying was safe, which invites a duplicate
send.

## Solution

`send_message` reads the deadline it runs under. Dispatch and
confirmation get an earlier deadline that keeps a short reserve. If that
runs out after a possible submission, the tool returns the existing
`send_unconfirmed` result with `retry_safe=false`. Cleanup and the final
progress notification can no longer use up the reserve. With too little
time left, it does not click, and the caller gets the usual timeout with
nothing sent. External cancellation still propagates. Without a
deadline, nothing changes.

## Verification

New tests go through the in-memory MCP client. They stall dispatch,
confirmation, cleanup and the final notification, and check that there
is exactly one dispatch. Ten repeated runs passed. Planted faults fail
them.

Closes #889

## Synthetic prompt

> Make send_message answer before FastMCP's too

**File**: `changelog.d/1233.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+send_message now reports an unconfirmed send instead of a bare timeout error.
```

**File**: `docs/linkedin-architecture.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ a page-owning collaborator.
 | `connection` | `ActionSignals`, `ConnectionState`, `detect_connection_state()` | `browser-free` |
 | `connection_actions` | `ACTION_SIGNALS_JS`, `CLICK_INCOMING_ACCEPT_JS`, `ConnectionActions`, `OPEN_MORE_BUTTON_JS`, `ReadMainProfile` | `page-owning` |
 | `content` | `PageContentReader` | `page-owning` |
-| `contracts` | `ExtractedSection`, `FilterValidationError`, `RATE_LIMITED_SECTION_TEXT`, `SEND_INTERRUPTED_WARNING`, `message_action_result()`, `rate_limited_section_error()`, `refuse_an_invalid_message()` | `browser-free` |
+| `contracts` | `ExtractedSection`, `FilterValidationError`, `RATE_LIMITED_SECTION_TEXT`, `SEND_INTERRUPTED_WARNING`, `before_the_reply_deadline()`, `message_action_result()`, `rate_limited_section_error()`, `refuse_an_invalid_message()` | `browser-free` |
 | `conversations` | `ConversationReader`, `strip_select_conversation_prefix()` | `page-owning` |
 | `extractor` | `LinkedInExtractor` | `page-owning` |
 | `feed` | `FeedReader` | `page-owning` |
```

**File**: `linkedin_mcp_server/linkedin/contracts.py` (modified, +31/-7)
```diff
@@ -3,8 +3,11 @@
 from __future__ import annotations
 
 from dataclasses import dataclass
+import math
 from typing import Any
 
+import anyio
+
 from linkedin_mcp_server.linkedin.identifiers import (
     normalize_person_identifier,
     person_profile_url,
@@ -30,20 +33,41 @@
 RATE_LIMITED_SECTION_TEXT = "[Rate limited] LinkedIn blocked this section. Try again later or request fewer sections."
 
 # A submission is in flight from the moment the send is dispatched until the
-# whole path has produced a result, cleanup included, and an interruption in
-# that window cannot be reported. FastMCP runs every tool inside
-# `anyio.fail_after()`, so the deadline raises `CancelledError` past
-# `except Exception` and discards any result returned from the cancelled
-# scope. The caller gets a timeout that carries no `retry_safe`, and this line
-# is then the only record that a message may already have left. Answering the
-# caller instead needs the tool to know its own deadline, which is issue #889.
+# whole path has produced a result, cleanup included, and a cancellation in
+# that window cannot be reported: it raises `CancelledError` past
+# `except Exception`, and a cancelled scope discards whatever is returned from
+# inside it. The tool's own deadline no longer lands there, because the send
+# stops ahead of it and answers `send_unconfirmed` (#889). What is left is
+# cancellation the server does not own, a client that cancels or goes away,
+# and for that this line is the only record that a message may already have
+# left.
 SEND_INTERRUPTED_WARNING = (
     "Message submission was interrupted while in flight. The send outcome is "
     "unknown; check the conversation before retrying, as a retry may deliver "
     "the message twice."
 )
 
 
+def before_the_reply_deadline(
+    limit: float = math.inf, *, shield: bool = False
+) -> anyio.CancelScope:
+    """Bound work that runs while a send's answer waits to leave.
+
+    The scope ends after ``limit`` seconds and never later than halfway to the
+    deadline the call runs under, so what follows keeps the other half to hand
+    the answer back before that deadline discards it (#889). A shielded scope
+    ignores that deadline, so without this bound a slow cleanup outlasts it.
+    Without a deadline, or once the call is already cancelled and its answer
+    gone, only ``limit`` applies.
+    """
+    now = anyio.current_time()
+    end = now + limit
+    deadline = anyio.current_effective_deadline()
+    if now < deadline < math.inf:
+        end = min(end, now + (deadline - now) / 2)
+    return anyio.CancelScope(deadline=end, shield=shield)
+
+
 def rate_limited_section_error() -> dict[str, str]:
     """The ``section_errors`` entry for a section that came back empty.
 
```

**File**: `linkedin_mcp_server/linkedin/message_sender.py` (modified, +101/-48)
```diff
@@ -5,6 +5,7 @@
 import asyncio
 from dataclasses import dataclass
 import logging
+import math
 import re
 import time
 from typing import Any, Literal
@@ -138,6 +139,15 @@
 _SEND_PROFILE_MESSAGE_TARGET_TIMEOUT_MS = 10_000
 _MESSAGE_SUBMIT_READY_TIMEOUT_MS = 1_000
 _MESSAGE_CLEANUP_TIMEOUT_SECONDS = 1.0
+# A send that may already have left has to answer (#889). FastMCP runs a tool
+# inside `anyio.fail_after()`, and a deadline landing after the click discards
+# whatever the send would have returned, so the work after dispatch stops this
+# far ahead of the deadline the call runs under and answers `send_unconfirmed`
+# itself. A sixth of the time left, the share AUTH_REPAIR_LOGIN_WAIT_FRACTION
+# keeps for its reply, capped so a long TOOL_TIMEOUT does not cut confirmation
+# short for nothing.
+_SEND_REPLY_RESERVE_FRACTION = 1 / 6
+_SEND_REPLY_RESERVE_SECONDS = 5.0
 
 # Narrow exception to the generic-selector rule for #1107: enterToSend uses
 # the send-toggle class only when the verified composer has no Send button.
@@ -1141,6 +1151,17 @@ def _profile_urn_from_compose_url(value: str, *, base: str | None = None) -> str
     return identifiers.pop()
 
 
+def _send_budget_deadline() -> float:
+    """When the work after dispatch has to stop, on the event loop's clock."""
+    deadline = anyio.current_effective_deadline()
+    if math.isinf(deadline):
+        return deadline
+    remaining = max(0.0, deadline - anyio.current_time())
+    return deadline - min(
+        _SEND_REPLY_RESERVE_SECONDS, remaining * _SEND_REPLY_RESERVE_FRACTION
+    )
+
+
 def _enter_to_send_result(url: str) -> dict[str, Any]:
     """Report LinkedIn's "Press Enter to Send" preference as a user fix."""
     return contracts.message_action_result(
@@ -1370,7 +1391,7 @@ async def _submit_verified_message(
     @staticmethod
     async def _cleanup_owned_message(message: str, owner: Any) -> None:
         """Best-effort removal of text proven to belong to this tool call."""
-        with anyio.move_on_after(
+        with contracts.before_the_reply_deadline(
             _MESSAGE_CLEANUP_TIMEOUT_SECONDS, shield=True
         ) as scope:
             try:
@@ -1404,7 +1425,7 @@ async def _resolve_message_owner(
     async def _dispose_message_owner(owner: Any) -> None:
         """Release all owner-scoped observers, pins, markers and handles."""
         try:
-            with anyio.move_on_after(
+            with contracts.before_the_reply_deadline(
                 _MESSAGE_CLEANUP_TIMEOUT_SECONDS, shield=True
             ) as dom_scope:
                 try:
@@ -1414,7 +1435,7 @@ async def _dispose_message_owner(owner: Any) -> None:
             if dom_scope.cancel_called:
                 logger.warning("Timed out clearing pinned message nodes")
         finally:
-            with anyio.move_on_after(
+            with contracts.before_the_reply_deadline(
                 _MESSAGE_CLEANUP_TIMEOUT_SECONDS, shield=True
             ) as handle_scope:
                 try:
@@ -1493,7 +1514,7 @@ async def _dispose_message_confirmation(
         self, owner: Any, confirmation: str
     ) -> None:
         """Disconnect a request-local confirmation observer."""
-        with anyio.move_on_after(
+        with contracts.before_the_reply_deadline(
             _MESSAGE_CLEANUP_TIMEOUT_SECONDS, shield=True
         ) as scope:
             try:
@@ -1538,6 +1559,9 @@ async def send_message(
         if profile_urn is not None:
             profile_urn = normalize_profile_urn(profile_urn)
         profile_url = person_profile_url(linkedin_username, "/")
+        # Read while the whole call is still ahead, so the reserve is a share
+        # of the tool's time rather than of whatever navigation left over.
+        budget_deadline = _send_budget_deadline()
 
         await self._navigator._navigate_to_page(profile_url)
         await self._session.check_rate_limit()
@@ -1765,63 +1789,92 @@ async def send_message(
                         recipient_selected=recipient_selected,
                     )
 
+                if anyio.current_time() >= budget_deadline:
+                    # Too little time is left to confirm a send, and nothing
+                    # has been submitted. Wait for the deadline instead of
+                    # clicking, so this ends like every other timeout before
+                    # dispatch: an error the caller can safely retry on.
+                    await anyio.sleep_forever()
+
+                # The deadline the call runs under discards anything returned
+                # after it, so the work after dispatch ends at this earlier
+                # one and still answers. Only the tool's own deadline is
+                # covered: a client that cancels gets no answer either way.
+                budget = anyio.CancelScope(deadline=budget_deadline)
                 try:
-                    try:
-                        # A click can dispatch before the evaluate call reports an
-                        # error
```

**File**: `linkedin_mcp_server/tools/messaging.py` (modified, +12/-6)
```diff
@@ -19,6 +19,7 @@
 from linkedin_mcp_server.error_handler import raise_tool_error
 from linkedin_mcp_server.linkedin.contracts import (
     SEND_INTERRUPTED_WARNING,
+    before_the_reply_deadline,
     refuse_an_invalid_message,
 )
 from linkedin_mcp_server.linkedin.identifiers import (
@@ -337,14 +338,19 @@ async def send_message(
             )
 
             try:
-                await ctx.report_progress(progress=100, total=100, message="Complete")
-            except BaseException:
                 # The send has already answered, and this notification is the
                 # last await inside FastMCP's `anyio.fail_after()`. A deadline
-                # landing here discards a result that may say the send was
-                # confirmed, and nothing can hand it back afterwards, so the
-                # log line is all that is left. Quiet where the result says a
-                # retry is safe, because then there is nothing to warn about.
+                # landing here would discard a result that may say the send was
+                # confirmed, so a notification that stalls gives up first.
+                with before_the_reply_deadline():
+                    await ctx.report_progress(
+                        progress=100, total=100, message="Complete"
+                    )
+            except BaseException:
+                # Cancellation from outside, such as a client that cancels,
+                # which nothing can answer, so the log line is all that is
+                # left. Quiet where the result says a retry is safe, because
+                # then there is nothing to warn about.
                 if result.get("retry_safe") is False:
                     logger.warning(SEND_INTERRUPTED_WARNING)
                 raise
```

**File**: `tests/linkedin/test_message_sender.py` (modified, +166/-0)
```diff
@@ -1,11 +1,13 @@
 """Tests for the browser-UI message sender."""
 
 from contextlib import ExitStack
+from types import SimpleNamespace
 from unittest.mock import AsyncMock, MagicMock, patch
 
 import asyncio
 import logging
 
+import anyio
 from patchright.async_api import Error as PatchrightError
 from patchright.async_api import TimeoutError as PlaywrightTimeoutError
 
@@ -1223,6 +1225,170 @@ async def test_send_unconfirmed_when_click_adds_nothing(self, mock_page):
         )
 
 
+async def _stall(*_args, **_kwargs):
+    await anyio.sleep_forever()
+
+
+class TestSendMessageDeadline:
+    """The tool's own deadline never takes the answer of a started send (#889).
+
+    Driven through the in-memory MCP client, because the deadline is FastMCP's
+    `anyio.fail_after()` around the tool, and what matters is what reaches the
+    caller once it fires.
+    """
+
+    _TOOL_TIMEOUT = 0.5
+
+    @staticmethod
+    async def _call(sender, monkeypatch):
+        from fastmcp import Client, FastMCP
+
+        from linkedin_mcp_server.tools.messaging import register_messaging_tools
+
+        monkeypatch.setattr(
+            "linkedin_mcp_server.tools.messaging.get_ready_extractor",
+            AsyncMock(return_value=SimpleNamespace(send_message=sender.send_message)),
+        )
+        mcp = FastMCP("test")
+        register_messaging_tools(
+            mcp, tool_timeout=TestSendMessageDeadline._TOOL_TIMEOUT
+        )
+        async with Client(mcp) as client:
+            return await client.call_tool(
+                "send_message",
+                {
+                    "linkedin_username": "testuser",
+                    "message": "Hello!",
+                    "confirm_send": True,
+                },
+                raise_on_error=False,
+            )
+
+    @staticmethod
+    def _composer(stack, sender, mock_page):
+        patches = TestSendMessage._patch_to_composer(sender, mock_page)
+        # Index 8 replaces `asyncio.sleep` for the whole process, the MCP
+        # session included; the submit wait it exists for answers at once here.
+        for index in range(1, 6):
+            stack.enter_context(patches[index])
+        return SimpleNamespace(
+            write=stack.enter_context(patches[6]),
+            submit=stack.enter_context(patches[7]),
+            prepare=stack.enter_context(patches[9]),
+            confirmed=stack.enter_context(patches[10]),
+        )
+
+    @pytest.mark.parametrize("stage", ["dispatch", "confirmation"])
+    async def test_a_stalled_send_answers_unconfirmed(
+        self, mock_page, monkeypatch, stage
+    ):
+        sender = _sender(mock_page)
+        with ExitStack() as stack:
+            mocks = self._composer(stack, sender, mock_page)
+            if stage == "dispatch":
+                mocks.submit.side_effect = _stall
+            else:
+                mocks.confirmed.side_effect = _stall
+            result = await self._call(sender, monkeypatch)
+
+        assert result.is_error is False, result.content
+        assert result.structured_content is not None
+        assert result.structured_content["status"] == "send_unconfirmed"
+        assert result.structured_content["sent"] is False
+        assert result.structured_content["retry_safe"] is False
+        assert mocks.submit.call_count == 1
+
+    @pytest.mark.parametrize("stage", ["cleanup", "notification"])
+    async def test_a_stalled_ending_keeps_the_answer(
+        self, mock_page, monkeypatch, stage
+    ):
+        from fastmcp import Context
+
+        async def report_progress(self, progress, total=None, message=None):
+            if progress == 100:
+                await anyio.sleep_forever()
+
+        sender = _sender(mock_page)
+        with ExitStack() as stack:
+            mocks = self._composer(stack, sender, mock_page)
+            if stage == "cleanup":
+                mock_page.evaluate_handle.return_value.dispose = AsyncMock(
+                    side_effect=_stall
+                )
+            else:
+                stack.enter_context(
+                    patch.object(Context, "report_progress", report_progress)
+                )
+            result = await self._call(sender, monkeypatch)
+
+        assert result.is_error is False, result.content
+        assert result.structured_content is not None
+        assert result.structured_content["status"] == "sent"
+        assert result.structured_content["sent"] is True
+        assert mocks.submit.call_count == 1
+
+    @pytest.mark.parametrize("stage", ["writing", "budget-spent"])
+    async def test_a_deadline_before_dispatch_sends_nothing(
+        self, mock_page, monkeypatch, stage
+    ):
+        """Nothing left the composer, so the timeout error is the answer.
+
+        `budget-spent` ends preparation inside the reserve the send keeps for
+        its answer: there is still time before the deadline, but not enough
+        to confirm a click, so there is no click.
+        """
+
+        asyn
```

**File**: `tests/test_tools.py` (modified, +5/-5)
```diff
@@ -1782,11 +1782,11 @@ async def test_cancelled_completion_notification_warns(
     ):
         """The last await can discard an answer that says a message went out.
 
-        `ctx.report_progress` is the final await inside FastMCP's
-        `anyio.fail_after()`, so a deadline landing there raises
-        `CancelledError` past `except Exception` and throws away the result
-        the send already produced. Nothing can hand it back afterwards, and
-        the log line is then the only record.
+        `ctx.report_progress` is the final await of the tool. The tool's own
+        deadline no longer reaches it (#889), but a cancellation from outside
+        still raises `CancelledError` past `except Exception` and throws away
+        the result the send already produced. Nothing can hand it back
+        afterwards, and the log line is then the only record.
 
         Silent where the result says a retry is safe: nothing was submitted,
         so there is no duplicate delivery to warn about. That is `retry_safe`
```

---

### Incident Patch 8: `3da596de` (2026-10-05)
**Commit Message**: fix(daemon): Name a lost owner instead of masking it (#1232)

## Problem

When the shared browser owner died and recovery found no replacement,
clients on the 2026-07-28 protocol saw only "Internal server error". MCP
SDK 2.2.0 masks every exception except `MCPError`. Clients on the older
handshake saw raw connection text. Neither said what to do.

## Solution

Once recovery ends without an owner, listings raise an `MCPError` and
tool calls raise a `ToolError`. Both carry one fixed message: this
server lost the shared browser process, and the user should reconnect or
restart the MCP client. A call that may have acted still reports
`outcome_unknown` first. Failures not recognised as owner loss are
masked as before.

## Verification

New server tests cover both protocol eras for listings and calls, with
the owner lost before and after the heartbeat check. They also cover a
failed repeated listing and an unrelated error that stays masked.
Planting the old re-raise fails them.

Closes #1145

## Synthetic prompt

> When daemon owner recovery ends without a replacement, give listings
and tool calls in both MCP protocol eras a fixed, actionable error
instead of a masked internal error, kee

**File**: `changelog.d/1232.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A lost shared browser now tells clients to reconnect instead of an internal error.
```

**File**: `linkedin_mcp_server/daemon_proxy.py` (modified, +62/-6)
```diff
@@ -49,11 +49,12 @@
 import mcp.types as mt
 from fastmcp.client.progress import ProgressHandler
 from fastmcp.client.telemetry import client_span
+from fastmcp.exceptions import ToolError
 from fastmcp.server.middleware import CallNext, Middleware, MiddlewareContext
 from fastmcp.telemetry import inject_trace_context
 from fastmcp.tools import ToolResult
 from fastmcp.utilities.timeout import normalize_timeout_to_seconds
-from mcp import ClientSession
+from mcp import ClientSession, MCPError
 from opentelemetry.trace import Status, StatusCode
 
 from linkedin_mcp_server import daemon_owner
@@ -1199,6 +1200,42 @@ def create_proxy_provider(
     )
 
 
+#: What a client is told once recovery has ended without an owner to forward to.
+#: Fixed text and never the failure's own: that names the loopback address, and
+#: through the transport's message it can carry whatever the owner's port said.
+_OWNER_LOST = (
+    "This server lost the shared browser process and could not reach a new one. "
+    "Reconnect or restart your MCP client to start a new one."
+)
+
+
+def _owner_lost_from_a_listing() -> MCPError:
+    """The listing failure a client of either protocol era can read.
+
+    An ``MCPError`` because that is the one exception the SDK carries to the
+    wire as it is. On a 2026-07-28 connection anything else becomes ``Internal
+    server error`` (``mcp/server/runner.py``, ``modern_error_data``, SDK 2.2.0),
+    and on a handshake-era one it arrives as the failure's own text, which says
+    "connect" and not what to do about it. A ``ToolError`` would not help here:
+    no listing handler converts one, so it is just another exception to the SDK.
+    """
+    return MCPError(code=mt.INTERNAL_ERROR, message=_OWNER_LOST)
+
+
+def _owner_lost_from_a_call() -> ToolError:
+    """The tool call failure a client of either protocol era can read.
+
+    A ``ToolError`` rather than the ``MCPError`` a listing gets, because a call
+    has an error result and a listing does not. FastMCP's ``tools/call`` handler
+    turns a ``FastMCPError`` into a result carrying its text, in both eras,
+    which is the shape a model reads; an ``MCPError`` would leave the handler
+    as a protocol error instead. What it replaces is either the masked ``Error
+    calling tool '<name>'`` or, when the heartbeat preflight found nobody, a
+    plain exception the SDK masks in its turn.
+    """
+    return ToolError(_OWNER_LOST)
+
+
 class FrontendOwnerRecoveryMiddleware(Middleware):
     """Find a replacement owner when this one is gone, and repeat what is safe.
 
@@ -1243,6 +1280,14 @@ def __init__(self, backend: DaemonProxyBackend) -> None:
     async def _repeat_the_listing(
         self, context: MiddlewareContext[Any], call_next: CallNext[Any, Any]
     ) -> Any:
+        """List once, and once more against a replacement if the owner was lost.
+
+        When no owner is left, either because recovery found none or because
+        the replacement failed the repeat as well, the client is told so in
+        words it can act on (:func:`_owner_lost_from_a_listing`). Only a
+        failure recognised as the owner's is put that way; anything else leaves
+        as it arrived, and the SDK masks it as it would on any server.
+        """
         try:
             return await call_next(context)
         except Exception as exc:
@@ -1254,10 +1299,15 @@ async def _repeat_the_listing(
                 failure.instance_id, classification=failure.classification
             )
             if replacement is None:
-                raise
-            # Unconditional, because listing changes nothing on LinkedIn. There is
-            # no effect a second one could repeat.
+                raise _owner_lost_from_a_listing() from exc
+        # Unconditional, because listing changes nothing on LinkedIn. There is
+        # no effect a second one could repeat.
+        try:
             return await call_next(context)
+        except Exception as again:
+            if unreachable_owner_in(again) is None:
+                raise
+            raise _owner_lost_from_a_listing() from again
 
     async def on_list_tools(
         self, context: MiddlewareContext[Any], call_next: CallNext[Any, Any]
@@ -1380,7 +1430,11 @@ async def on_call_tool(
                     return self._report_an_unknown_outcome(context, failure)
 
             if replacement is None:
-                raise
+                # Only now, after the unknown outcome above had its chance: a
+                # call that may have acted keeps that answer, and this one is
+                # for a call that was never sent or could not have changed
+                # anything.
+                raise _owner_lost_from_a_call() from exc
 
             logger.info("Attached to a replacement owner; running the call again")
             try:
@@ -1433,7 +1487,9 @@ async def on_call_tool(
                         )
                     if could_change_something:
                         return 
```

**File**: `tests/test_daemon_election.py` (modified, +24/-5)
```diff
@@ -6032,7 +6032,7 @@ async def call_it():
             _stop(result.get("pid"))
 
     def test_a_proxy_refuses_an_owner_it_has_the_wrong_token_for(
-        self, real_state_root: Path
+        self, real_state_root: Path, monkeypatch: pytest.MonkeyPatch
     ):
         """The credential is load-bearing, not decoration.
 
@@ -6045,10 +6045,27 @@ def test_a_proxy_refuses_an_owner_it_has_the_wrong_token_for(
         import dataclasses
 
         from fastmcp import Client
+        from mcp import MCPError
 
+        from linkedin_mcp_server import daemon_proxy
         from linkedin_mcp_server.daemon import look_up_owner
         from linkedin_mcp_server.server import ServerRole, create_mcp_server
 
+        # What the proxy's recovery was handed, because the client no longer
+        # reads it: a failure recognised as the owner's reaches the client as a
+        # fixed sentence about a lost owner, whatever the owner answered.
+        seen: list[BaseException] = []
+        recognise = daemon_proxy.unreachable_owner_in
+
+        def recording(exc: BaseException) -> Any:
+            current: BaseException | None = exc
+            while current is not None:
+                seen.append(current)
+                current = current.__cause__
+            return recognise(exc)
+
+        monkeypatch.setattr(daemon_proxy, "unreachable_owner_in", recording)
+
         profile = real_state_root
         result = _run_frontend(profile)
         try:
@@ -6063,9 +6080,6 @@ def test_a_proxy_refuses_an_owner_it_has_the_wrong_token_for(
             )
 
             async def served() -> None:
-                # The handshake era, because only there does the proxy's own
-                # error text reach its client; the 2026-07-28 era answers any
-                # failure that is not an `MCPError` with "Internal server error".
                 async with Client(proxy, mode="legacy") as client:
                     await client.list_tools()
 
@@ -6088,8 +6102,13 @@ async def asked_directly() -> int:
             # becomes "Server returned an error response", which is written only
             # once a response of 400 or more has arrived. Which status it was is
             # asked of the owner directly, with the same token.
-            with pytest.raises(Exception, match="Server returned an error response"):
+            with pytest.raises(Exception, match="could not reach a new one"):
                 asyncio.run(served())
+            assert any(
+                isinstance(exc, MCPError)
+                and exc.message == "Server returned an error response"
+                for exc in seen
+            ), seen
             assert asyncio.run(asked_directly()) == 401
         finally:
             _stop(result.get("pid"))
```

**File**: `tests/test_daemon_proxy.py` (modified, +6/-5)
```diff
@@ -1561,7 +1561,8 @@ async def test_a_safe_call_with_no_replacement_still_raises(self, _alone):
         A read that could be repeated has no unknown outcome to describe, so
         turning this into a result would dress a plain transport failure up as a
         LinkedIn answer and hand a client a `retry_safe` flag about a call that
-        never acted.
+        never acted. It is raised as a `ToolError` saying the owner is gone, so
+        the masking below and the SDK above leave the reason readable.
         """
         from linkedin_mcp_server.daemon_proxy import (
             FrontendOwnerRecoveryMiddleware,
@@ -1581,7 +1582,7 @@ async def call_next(_context: Any) -> Any:
             )
 
         middleware = FrontendOwnerRecoveryMiddleware(backend)
-        with pytest.raises(OwnerUnreachableError, match="did not answer"):
+        with pytest.raises(ToolError, match="could not reach a new one"):
             await middleware.on_call_tool(
                 self._context(read_only=True),
                 call_next,  # ty: ignore
@@ -2878,7 +2879,7 @@ async def call_next(_context: Any) -> Any:
                 classification=OwnerFailure.RETIRING,
             )
 
-        with pytest.raises(OwnerUnreachableError):
+        with pytest.raises(ToolError, match="could not reach a new one"):
             await FrontendOwnerRecoveryMiddleware(backend).on_call_tool(
                 MagicMock(),
                 call_next,  # ty: ignore
@@ -3045,7 +3046,7 @@ async def through_recovery(context: Any) -> Any:
         context.message.name = "get_person_profile"
         context.fastmcp_context.fastmcp.get_tool = AsyncMock(return_value=tool)
 
-        with pytest.raises(OwnerUnreachableError):
+        with pytest.raises(ToolError, match="could not reach a new one"):
             await FrontendAuthRepairMiddleware(tool_timeout=30.0).on_call_tool(
                 context,
                 through_recovery,
@@ -3164,7 +3165,7 @@ async def through_recovery(context: Any) -> Any:
         context.message.name = "get_person_profile"
         context.fastmcp_context.fastmcp.get_tool = AsyncMock(return_value=tool)
 
-        with pytest.raises(OwnerUnreachableError):
+        with pytest.raises(ToolError, match="could not reach a new one"):
             await FrontendAuthRepairMiddleware(tool_timeout=30.0).on_call_tool(
                 context,
                 through_recovery,
```

**File**: `tests/test_server.py` (modified, +188/-17)
```diff
@@ -54,17 +54,58 @@ def _a_backend() -> DaemonProxyBackend:
     real one needs a published descriptor; the real URL, token, timeout and
     proxy-environment wiring are covered in ``tests/test_daemon_proxy.py``.
     """
+    return DaemonProxyBackend(
+        attachment=_a_dead_attachment(port=1),
+        auth_root=Path("/nonexistent"),
+        profile=Path("/nonexistent/profile"),
+        config=AppConfig(),
+    )
+
+
+def _a_dead_attachment(*, port: int) -> Any:
+    """An attachment to an owner whose loopback port nothing listens on."""
     attachment = MagicMock(name="attachment")
-    attachment.descriptor.url = "http://127.0.0.1:1/mcp"
+    attachment.descriptor.url = f"http://127.0.0.1:{port}/mcp"
     attachment.token = "a-token"
     # A mock answers every attribute with something truthy, and a truthy
     # `control_only` is the one attachment a backend must refuse.
     attachment.control_only = False
-    return DaemonProxyBackend(
-        attachment=attachment,
-        auth_root=Path("/nonexistent"),
-        profile=Path("/nonexistent/profile"),
-        config=AppConfig(),
+    return attachment
+
+
+#: What a client of either era reads once no owner is left to forward to.
+#: Written out rather than imported, because the text is what a user sees.
+_THE_OWNER_IS_GONE = (
+    "This server lost the shared browser process and could not reach a new one. "
+    "Reconnect or restart your MCP client to start a new one."
+)
+
+
+def _no_replacement_to_find(
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+    *,
+    elect: Any = None,
+) -> None:
+    """Make every election a proxy runs answer at once, by default with nobody.
+
+    The real one would spend its whole budget looking for an owner and could
+    start one, so it is stood in, and the account home is redirected in case
+    anything still reaches for daemon state there.
+    """
+    from linkedin_mcp_server import daemon_descriptor
+    from linkedin_mcp_server.daemon import OwnerLookup, OwnerState
+    from linkedin_mcp_server.daemon_election import ElectionOutcome
+
+    def nobody(*_args: object, **_kwargs: object) -> ElectionOutcome:
+        return ElectionOutcome(
+            OwnerLookup(state=OwnerState.ABSENT, reason="nobody answered"),
+            started_owner=False,
+        )
+
+    monkeypatch.setattr(daemon_descriptor, "_account_home", lambda: tmp_path)
+    monkeypatch.setattr(
+        "linkedin_mcp_server.daemon_election.obtain_owner", elect or nobody
     )
 
 
@@ -615,29 +656,159 @@ async def test_a_browser_driving_role_does_run_it(
         bootstrap.assert_called_once()
         close.assert_awaited_once()
 
-    @pytest.mark.parametrize(
-        ("mode", "says"),
-        [("legacy", "connect"), ("auto", "Internal server error")],
-        ids=["handshake era", "2026-07-28 era"],
-    )
+    @_BOTH_ERAS
     async def test_a_dead_owner_is_an_error_rather_than_an_empty_tool_list(
-        self, mode: str, says: str
+        self,
+        mode: str,
+        protocol: str,
+        monkeypatch: pytest.MonkeyPatch,
+        tmp_path: Path,
     ):
         # FastMCP logs a failing provider and carries on by default. For a proxy
         # the provider *is* the server, so that default turns an unreachable
         # owner into a client that sees no tools and no reason why. Measured on
         # 3.4.4: `tools/list` returned `[]`.
         #
-        # Both eras a client may speak to this proxy. Only the handshake era
-        # carries the reason: in 2026-07-28 the SDK answers a failure that is
-        # not an `MCPError` with a generic one (`mcp/server/runner.py`,
-        # `modern_error_data`), so there it is an error and no more.
+        # Both eras a client may speak to this proxy, and both are told what
+        # happened. In 2026-07-28 the SDK answers a failure that is not an
+        # `MCPError` with `Internal server error` and nothing else
+        # (`mcp/server/runner.py`, `modern_error_data`), which is #1145.
+        _no_replacement_to_find(monkeypatch, tmp_path)
         proxy = create_mcp_server(role=ServerRole.PROXY, proxy_backend=_a_backend())
 
         async with Client(proxy, mode=mode) as client:
-            with pytest.raises(Exception, match=says):
+            assert client.protocol_version == protocol
+            with pytest.raises(Exception) as failed:
                 await client.list_tools()
 
+        assert str(failed.value) == _THE_OWNER_IS_GONE
+
+    @_BOTH_ERAS
+    async def test_a_replacement_that_fails_the_repeated_listing_says_so_too(
+        self,
+        mode: str,
+        protocol: str,
+        monkeypatch: pytest.MonkeyPatch,
+        tmp_path: Path,
+    ):
+        # Recovery found an owner and the listing was repeated against it, which
+        # is the one repeat a listing gets. That one failing as well is the same
+        # news for the client: nobody is left to answer.
+        from linkedin_mcp_server.daemon import OwnerLookup, Own
```

---

### Incident Patch 9: `53ff87ad` (2026-10-04)
**Commit Message**: fix(session): Name a foreign-host lock and its fix (#1228)

## Problem

A Chromium `SingletonLock` whose `<host>-<pid>` target names another
host is refused, because that pid cannot be checked here. When macOS
changed the host name it reports, a lock this same machine had left
behind was refused forever. The error said only `(found SingletonLock)`,
so nothing told the user which file to remove or why.

## Solution

The refusal itself is unchanged, since a container's lock on a mounted
profile looks the same. The message now names the lock's full path, the
recorded host and this host, and the three files to delete once no
server, browser or container uses the profile. A lock held on this host
keeps the old wording plus the path, with no deletion advice.

## Verification

New tests check both messages and that the lock survives the refusal.
Planting the old message fails them.

Closes #1144

## Synthetic prompt

> When a profile is refused because its SingletonLock names another
host, keep refusing but say which lock, which hosts, and which files to
delete once nothing uses the profile.

Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for
review in Claude Code via T

**File**: `changelog.d/1228.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A profile locked under another host name now says which lock files to remove, and when.
```

**File**: `linkedin_mcp_server/session_state.py` (modified, +31/-4)
```diff
@@ -836,6 +836,36 @@ def profile_in_use_by(profile_dir: Path) -> Path | None:
     return candidate
 
 
+def _held_lock_refusal(lock: Path, action: str) -> str:
+    """Why *lock* blocks *action*, naming the file and what would free it.
+
+    A lock from another host is refused without knowing whether its writer is
+    alive, and the most common writer that is not is this machine itself under
+    an earlier host name: macOS changes the name it reports when the network
+    does. Chromium never removes that lock, so the message has to say which
+    files to delete and on what condition, or nothing short of guessing frees
+    the profile.
+    """
+    try:
+        owner = os.readlink(lock).rpartition("-")[0]
+    except OSError:
+        owner = ""
+    this_host = socket.gethostname()
+    if not owner or owner == this_host:
+        return (
+            f"The browser profile is in use by another process ({lock}). "
+            f"Stop the running server or container before {action}."
+        )
+    return (
+        f"The browser profile is locked by host {owner!r} ({lock}), and this "
+        f"machine is {this_host!r}, so whether that process still runs cannot "
+        f"be checked. Stop any server, browser or container using the profile "
+        f"before {action}. If none is, the lock is left over, often from this "
+        f"machine under an earlier host name: delete {_CHROMIUM_LOCK_NAME}, "
+        f"SingletonCookie and SingletonSocket in {lock.parent} and try again."
+    )
+
+
 #: How often a synchronous wait asks for the lease again: the async wait's pace.
 _LEASE_POLL_SECONDS = 0.1
 
@@ -920,10 +950,7 @@ def _exclusive_profile(
             None,
         )
         if lock is not None:
-            raise RuntimeError(
-                f"The browser profile is in use by another process (found {lock.name}). "
-                f"Stop the running server or container before {action}."
-            )
+            raise RuntimeError(_held_lock_refusal(lock, action))
         yield
     finally:
         lease.release()
```

**File**: `tests/test_session_state.py` (modified, +40/-1)
```diff
@@ -875,12 +875,51 @@ def test_lock_from_another_host_counts_as_held(isolate_profile_dir):
     _seed_session(profile_dir)
     (profile_dir / "SingletonLock").symlink_to("some-container-1")
 
-    with pytest.raises(RuntimeError, match="in use by another process"):
+    with pytest.raises(RuntimeError, match="locked by host 'some-container'"):
+        rotate_source_profile(profile_dir)
+
+    assert profile_dir.exists()
+
+
+def test_a_foreign_host_lock_names_what_would_free_the_profile(isolate_profile_dir):
+    """Measured on macOS: the host name changed after a crash, so the lock this
+    machine left behind read as another host's and refused every login for good.
+    The refusal stands, since a container's lock looks the same, but it has to
+    name the files and the condition under which deleting them is safe."""
+    profile_dir = isolate_profile_dir
+    _seed_session(profile_dir)
+    lock = profile_dir / "SingletonLock"
+    lock.symlink_to("old-name.local-4242")
+
+    with pytest.raises(RuntimeError) as refused:
         rotate_source_profile(profile_dir)
 
+    message = str(refused.value)
+    assert str(lock) in message
+    assert "'old-name.local'" in message
+    assert repr(socket.gethostname()) in message
+    assert "SingletonCookie and SingletonSocket" in message
+    # Deleting a live container's lock corrupts its session, so the advice has
+    # to stay conditional on nothing using the profile.
+    stop = message.index("Stop any server, browser or container")
+    assert stop < message.index("If none is") < message.index("delete")
+    assert lock.is_symlink(), "the refusal must not remove the lock itself"
     assert profile_dir.exists()
 
 
+def test_a_live_lock_on_this_host_does_not_suggest_deleting_it(isolate_profile_dir):
+    profile_dir = isolate_profile_dir
+    _seed_session(profile_dir)
+    lock = profile_dir / "SingletonLock"
+    lock.symlink_to(f"{socket.gethostname()}-{os.getpid()}")
+
+    with pytest.raises(RuntimeError, match="in use by another process") as refused:
+        rotate_source_profile(profile_dir)
+
+    assert str(lock) in str(refused.value)
+    assert "delete" not in str(refused.value)
+
+
 def test_uncommitted_debris_is_parked_not_deleted(isolate_profile_dir):
     """An uncommitted profile may still hold a Chromium login worth inspecting,
     and deleting it leaves no way back if a later move fails."""
```

---

### Incident Patch 10: `d38bdae6` (2026-10-04)
**Commit Message**: fix(setup): Refuse an install the watcher saw breach (#1229)

## Problem

The browser installer's supervision loop stops reading the activity
watcher once the installer process is done. If the watcher reported a
byte-ceiling breach in that same turn, the breach was only logged.
Patchright deletes its archive on the way out, so the final scan fit and
the install was kept. The same breach one turn earlier refused it.

## Solution

After the final scan, an observed watcher breach decides the install. A
nonzero exit still raises its own message first. Peaks no poll ever sees
stay bounded only by the final scan (#815).

## Verification

The test that pinned the old outcome now expects a refusal. A new test
checks that a nonzero exit keeps its message over a concurrent breach.
Removing the new check fails the refusal test.

Closes #837

## Synthetic prompt

> In the browser installer supervision, refuse an install whose activity
watcher reported a byte-ceiling breach in the same turn the installer
exited 0, while letting a nonzero exit keep its own message.

Generated with Claude Opus 5.5 for implementation and GPT-6.1 Sol for
review in Claude Code via T3 Code.


<!-- Macroscope's pull r

**File**: `changelog.d/1229.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A browser install whose size limit was exceeded is now refused even if it exits cleanly.
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +10/-1)
```diff
@@ -2541,7 +2541,7 @@ async def wait_for_process() -> int:
         # message, which says what went wrong, and it is read before the scan
         # below so an unreadable tree cannot answer in its place. A breach then
         # beats success, because accepting returncode 0 is what records an
-        # oversized tree as ready.
+        # oversized tree as ready: one the scan finds, and one the watcher saw.
         if returncode != 0:
             raise BrowserSetupFailedError(
                 "\n".join(lines) or "Patchright Chromium browser setup failed."
@@ -2560,6 +2560,15 @@ async def wait_for_process() -> int:
             # breach into the cleanup below is not a missed one to warn about.
             bound_raised = True
             raise
+        # After the scan, so a breach the watcher reported while it ran counts
+        # too. The loop above stops reading the watcher once the process task
+        # is done, and the installer deleting its archive on the way out is
+        # exactly what makes the final tree fit again. A breach the watcher
+        # observed is not undone by that, and whether it landed a turn before
+        # the exit or in the same one must not decide the install.
+        if _installer_bound_breached(activity):
+            bound_raised = True
+            await activity
     finally:
         try:
             if activity is not None:
```

**File**: `tests/test_bootstrap.py` (modified, +31/-13)
```diff
@@ -3134,16 +3134,14 @@ def answer(path, **rest):
             with pytest.raises(BrowserSetupFailedError, match="could not be measured"):
                 bootstrap._installer_download_snapshot(tmp_path, (target,))
 
-    async def test_a_vanished_peak_leaves_the_install_its_result(
-        self, monkeypatch, caplog
-    ):
-        """The ceiling bounds the footprint that stays, not the peak (#815).
-
-        A breach the watcher reports in the same turn the installer exits is
-        never consumed by the supervision loop, so what decides is the final
-        accounting. It runs on every success, which is why an install whose
-        archive is gone and whose tree fits is kept, and said out loud rather
-        than dropped.
+    async def test_an_observed_peak_refuses_a_successful_exit(self, monkeypatch):
+        """A breach the watcher saw decides, even when the archive is gone (#837).
+
+        The watcher reports it in the same turn the installer exits, and the
+        installer has deleted its archive, so the final tree fits. Before, the
+        supervision loop never read that report and the install was kept with
+        a warning, while the same breach a turn earlier refused it. A peak no
+        poll ever saw is still bounded only by the final accounting (#815).
         """
         from linkedin_mcp_server import bootstrap
         from linkedin_mcp_server.exceptions import BrowserSetupFailedError
@@ -3163,11 +3161,31 @@ async def breach(*_args: object) -> None:
             asyncio, "create_subprocess_exec", AsyncMock(return_value=proc)
         )
 
-        with caplog.at_level(logging.WARNING, logger="linkedin_mcp_server.bootstrap"):
+        with pytest.raises(BrowserSetupFailedError, match="exceeded its size limit"):
             await asyncio.wait_for(bootstrap._run_patchright_install("--no-shell"), 5)
 
-        assert proc.returncode == 0, "the install kept its own result"
-        assert "exceeded a setup bound" in caplog.text
+    async def test_a_failed_install_keeps_its_message_over_a_breach(self, monkeypatch):
+        """The installer's own failure still outranks the watcher's report."""
+        from linkedin_mcp_server import bootstrap
+        from linkedin_mcp_server.exceptions import BrowserSetupFailedError
+
+        proc = _FakeProc([b"ERROR: the mirror refused the archive\n"], 1)
+
+        async def breach(*_args: object) -> None:
+            raise BrowserSetupFailedError("Browser setup exceeded its size limit")
+
+        monkeypatch.setattr(bootstrap, "_watch_installer_activity", breach)
+        monkeypatch.setattr(
+            bootstrap,
+            "_installer_download_snapshot",
+            lambda *_args: (("kept", 1024, 1),),
+        )
+        monkeypatch.setattr(
+            asyncio, "create_subprocess_exec", AsyncMock(return_value=proc)
+        )
+
+        with pytest.raises(BrowserSetupFailedError, match="mirror refused"):
+            await asyncio.wait_for(bootstrap._run_patchright_install("--no-shell"), 5)
 
     async def test_a_failed_install_keeps_its_message_over_the_scan(self, monkeypatch):
         """The installer named the cause, so the accounting may not answer for it.
```

---

### Incident Patch 11: `8fe09404` (2026-10-04)
**Commit Message**: fix(process-tree): Settle a group that ended late (#1220)

## Problem

Under load, a browser install could fail although its helper processes
had exited. `_reap_and_wait_for_group` returned "not drained" as soon as
its deadline passed, without looking whether the process group had gone
while a slow snapshot ran, so `terminate_process_group` reported an
unsettled group and the installer exited with status 70.

## Solution

At the deadline it looks once more and settles only when the group no
longer exists. A snapshot of zombies is not trusted there, since it may
have missed a member it could not read. No extra signal and no longer
deadline.

## Verification

A slow snapshot that outlasts the budget returns False on main and True
now. A group that still exists, even with only zombies, returns False.
Returning True, trusting zombies, an extra kill or a longer deadline
fails the tests. `tests/test_process_tree.py` passes 3 runs quiet and 3
under 24 CPU burners.

## Synthetic prompt

> In process_tree._reap_and_wait_for_group, decide from a last
observation at the deadline instead of returning False, using the
existing settled rule, and add deterministic tests for a group that ends
duri

**File**: `changelog.d/1220.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A browser install no longer fails when its helper processes end late under load.
```

**File**: `linkedin_mcp_server/process_tree.py` (modified, +6/-1)
```diff
@@ -1490,7 +1490,12 @@ def _reap_and_wait_for_group(
             except ProcessLookupError:
                 pass
         if time.monotonic() >= deadline:
-            return False
+            # A slow snapshot under load can spend the rest of the budget after
+            # the group already ended, so the clock alone is no verdict: one
+            # last look at whether the group still exists decides. Only its
+            # absence counts here; a snapshot of zombies may have missed a
+            # member it could not read.
+            return not process_group_exists(pgid)
         time.sleep(0.01)
     return True
 
```

**File**: `tests/test_process_tree.py` (modified, +106/-0)
```diff
@@ -1041,6 +1041,112 @@ def refuse() -> dict[int, tuple[int, int, str | None, str | None]]:
 
         assert process_tree.process_group_has_live_member(12345)
 
+    @staticmethod
+    def _settle_past_deadline(
+        monkeypatch: pytest.MonkeyPatch,
+        *,
+        exists: Iterator[bool],
+        live: Iterator[bool],
+    ) -> tuple[bool, list[int], int, float]:
+        """Run one group settlement whose first run-state poll outlasts the budget.
+
+        The clock is the module's own, so the poll's two seconds are the whole
+        delay and the deadline passes during it and nowhere else. Returns the
+        verdict, every signal sent, how many run-state polls ran and the clock
+        at the end, so neither a verdict bought with another group kill nor
+        one bought by waiting past the deadline passes unseen.
+        """
+        clock = SimpleNamespace(now=0.0)
+        signals: list[int] = []
+        polls: list[float] = []
+        observations = iter([None, object()])
+
+        def slow_poll(pgid: int) -> bool:
+            polls.append(clock.now)
+            clock.now += 2.0
+            return next(live)
+
+        monkeypatch.setattr(
+            process_tree,
+            "time",
+            SimpleNamespace(
+                monotonic=lambda: clock.now,
+                sleep=lambda seconds: setattr(clock, "now", clock.now + seconds),
+            ),
+        )
+        monkeypatch.setattr(
+            process_tree.os,
+            "waitid",
+            lambda *a, **k: next(observations),
+            raising=False,
+        )
+        monkeypatch.setattr(
+            process_tree.os, "killpg", lambda pgid, sent: signals.append(sent)
+        )
+        monkeypatch.setattr(
+            process_tree, "process_group_exists", lambda pgid: next(exists)
+        )
+        monkeypatch.setattr(process_tree, "process_group_has_live_member", slow_poll)
+        monkeypatch.setattr(process_tree, "_kernel_start_identity", lambda pid: None)
+
+        class _Child:
+            pid = 12345
+            returncode: int | None = None
+
+            def wait(self, timeout: float | None = None) -> int:
+                self.returncode = -signal.SIGKILL
+                return self.returncode
+
+        settled = process_tree.terminate_process_group(
+            12345, timeout=1.0, child=cast(Any, _Child())
+        )
+        return settled, signals, len(polls), clock.now
+
+    @_POSIX_ONLY
+    def test_a_group_that_ended_during_a_slow_snapshot_is_settled(
+        self, monkeypatch: pytest.MonkeyPatch
+    ):
+        """The flake under load: the budget ran out, the group did not outlive it.
+
+        The run-state poll answers from a snapshot taken while the group was
+        still there and returns after the deadline. The group is gone by then,
+        and reporting it as undrained turns a finished browser install into a
+        failed one. The verdict comes from one last look, not from waiting on.
+        """
+        settled, signals, polls, ended = self._settle_past_deadline(
+            monkeypatch, exists=iter([True, False]), live=iter([True])
+        )
+
+        assert settled
+        assert signals == [signal.SIGKILL, signal.SIGKILL]
+        assert (polls, ended) == (1, 2.0), "the deadline was waited past"
+
+    @_POSIX_ONLY
+    def test_a_group_still_live_at_the_deadline_is_not_settled(
+        self, monkeypatch: pytest.MonkeyPatch
+    ):
+        settled, signals, polls, ended = self._settle_past_deadline(
+            monkeypatch, exists=repeat(True), live=repeat(True)
+        )
+
+        assert not settled
+        assert signals == [signal.SIGKILL, signal.SIGKILL]
+        assert (polls, ended) == (1, 2.0), "the deadline was waited past"
+
+    @_POSIX_ONLY
+    def test_a_group_that_still_exists_at_the_deadline_is_not_settled_by_zombies(
+        self, monkeypatch: pytest.MonkeyPatch
+    ):
+        """Past the deadline a snapshot showing only zombies is not trusted: a
+        member it could not read may still run. Only the group's absence is."""
+        settled, signals, polls, ended = self._settle_past_deadline(
+            monkeypatch, exists=repeat(True), live=iter([True, False])
+        )
+
+        assert not settled
+        assert signals == [signal.SIGKILL, signal.SIGKILL]
+        assert (polls, ended) == (1, 2.0), "the deadline was waited past"
+
     @_LINUX_ONLY
     def test_a_zombie_only_group_settles_under_a_reaper_that_never_waits(
         self, tmp_path: Path
```

---

### Incident Patch 12: `f0c1469e` (2026-10-03)
**Commit Message**: fix(messaging): Accept LinkedIn's flagged profile URL (#1214)

LinkedIn now lands /in/<name>/ on /in/<name>/?isSelfProfile=false, and the
profile URL check refused any query, so send_message returned
recipient_resolution_failed for every recipient and get_person_profile
lost profile_urn. Accept exactly that flag, and give sends a ten-second
top-card wait while profile reads keep one second.

Closes #1181

**File**: `changelog.d/1214.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Send messages and return `profile_urn` again on LinkedIn's redesigned profile page.
```

**File**: `linkedin_mcp_server/linkedin/message_sender.py` (modified, +24/-5)
```diff
@@ -130,6 +130,12 @@
     f"() => ({_PROFILE_MESSAGE_TARGET_JS})().status === 'resolved'"
 )
 _PROFILE_MESSAGE_TARGET_TIMEOUT_MS = 1_000
+# The redesigned profile page (2026) renders its top card a few seconds after
+# navigation, so a send, which asks right after `main` appears, waits up to
+# ten. A profile read keeps the short wait: it asks only after the section text
+# is in, and the wait ends early only on a resolved action, so every profile
+# without one would hold the browser for the full ten seconds.
+_SEND_PROFILE_MESSAGE_TARGET_TIMEOUT_MS = 10_000
 _MESSAGE_SUBMIT_READY_TIMEOUT_MS = 1_000
 _MESSAGE_CLEANUP_TIMEOUT_SECONDS = 1.0
 
@@ -1097,12 +1103,21 @@ def _normalize_profile_urn(value: str | None) -> str | None:
     return candidate.removeprefix(_PROFILE_URN_PREFIX)
 
 
+# The 2026 profile page lands on /in/<name>/?isSelfProfile=false. That flag is
+# the only query a profile route may carry; any other still refuses.
+_BENIGN_PROFILE_QUERIES = {"", "isSelfProfile=false"}
+
+
 def _profile_path_from_url(value: str) -> str | None:
     parsed = _safe_linkedin_url(value)
-    if parsed is None or parsed.query or not _PROFILE_PATH_RE.fullmatch(parsed.path):
+    if (
+        parsed is None
+        or parsed.query not in _BENIGN_PROFILE_QUERIES
+        or not _PROFILE_PATH_RE.fullmatch(parsed.path)
+    ):
         return None
     try:
-        username = normalize_person_identifier(value)
+        username = normalize_person_identifier(parsed._replace(query="").geturl())
     except LinkedInOperationError:
         return None
     canonical_path = urlparse(person_profile_url(username, "/")).path
@@ -1163,12 +1178,14 @@ def __init__(self, session: PageSession, navigator: PageNavigator):
         self._navigator = navigator
         self._page = session.page
 
-    async def _read_profile_message_target(self) -> _ProfileMessageTargetResolution:
+    async def _read_profile_message_target(
+        self, *, timeout_ms: int = _PROFILE_MESSAGE_TARGET_TIMEOUT_MS
+    ) -> _ProfileMessageTargetResolution:
         """Resolve one recipient-specific top-card compose action after settling."""
         try:
             await self._page.wait_for_function(
                 _PROFILE_MESSAGE_TARGET_READY_JS,
-                timeout=_PROFILE_MESSAGE_TARGET_TIMEOUT_MS,
+                timeout=timeout_ms,
             )
         except PlaywrightTimeoutError:
             pass
@@ -1530,7 +1547,9 @@ async def send_message(
         except PlaywrightTimeoutError:
             logger.debug("Profile page did not load for %s", linkedin_username)
 
-        resolution = await self._read_profile_message_target()
+        resolution = await self._read_profile_message_target(
+            timeout_ms=_SEND_PROFILE_MESSAGE_TARGET_TIMEOUT_MS
+        )
         if resolution.status == "unavailable":
             return contracts.message_action_result(
                 profile_url,
```

**File**: `tests/fixtures/policy-traces/v1/message-cancelled.json` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@
       "operation": "profile_message_target_ready",
       "program_digest": "d156e406f6bb",
       "section": "message",
-      "timeout_ms": 1000
+      "timeout_ms": 10000
     },
     {
       "call": "send_message",
```

**File**: `tests/fixtures/policy-traces/v1/message-composer-occupied.json` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@
       "operation": "profile_message_target_ready",
       "program_digest": "d156e406f6bb",
       "section": "message",
-      "timeout_ms": 1000
+      "timeout_ms": 10000
     },
     {
       "call": "send_message",
```

**File**: `tests/fixtures/policy-traces/v1/message-composer-restored.json` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@
       "operation": "profile_message_target_ready",
       "program_digest": "d156e406f6bb",
       "section": "message",
-      "timeout_ms": 1000
+      "timeout_ms": 10000
     },
     {
       "call": "send_message",
```

**File**: `tests/fixtures/policy-traces/v1/message-dry-run.json` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@
       "operation": "profile_message_target_ready",
       "program_digest": "d156e406f6bb",
       "section": "message",
-      "timeout_ms": 1000
+      "timeout_ms": 10000
     },
     {
       "call": "send_message",
```

**File**: `tests/fixtures/policy-traces/v1/message-pre-submit-cleanup.json` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@
       "operation": "profile_message_target_ready",
       "program_digest": "d156e406f6bb",
       "section": "message",
-      "timeout_ms": 1000
+      "timeout_ms": 10000
     },
     {
       "call": "send_message",
```

**File**: `tests/fixtures/policy-traces/v1/message-sent.json` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@
       "operation": "profile_message_target_ready",
       "program_digest": "d156e406f6bb",
       "section": "message",
-      "timeout_ms": 1000
+      "timeout_ms": 10000
     },
     {
       "call": "send_message",
```

---

### Incident Patch 13: `59c3737f` (2026-10-02)
**Commit Message**: test(watcher): Keep the sampling loop off the disk (#1202)

**File**: `tests/differential/harness.py` (modified, +150/-8)
```diff
@@ -853,13 +853,150 @@ def stop(self) -> dict[str, Any] | None:
         return summaries[-1] if summaries else None
 
 
+#: How a gap diagnostic names each part the watcher timed: the steps outside
+#: sampling (``watcher.BETWEEN_STEPS``) and the phases of the sample that
+#: closed the gap (``watcher.SAMPLE_PHASES``), with read kinds named apart.
+_GAP_STEP_NAMES = {
+    "tracker": "turning the previous sample into events",
+    "enqueue": "handing events to the writer thread",
+    # The loop's own writing, zero since the writer thread does it; named for
+    # a summary written before that.
+    "write": "serializing and writing events",
+    "flush": "flushing the event file",
+    "sleep": "the sleep asked for",
+    "wakeup_delay": "waking late from sleep",
+    "stop_check": "checking for a stop request",
+}
+#: The file-system calls the watcher makes off the sampling path
+#: (``watcher.FILE_IO_CALLS``), which overlap a gap without being part of it.
+_GAP_FILE_IO_NAMES = {
+    "write": "the event writer's writes",
+    "flush": "its flushes",
+    "stop_check": "the stop-file checks",
+}
+_GAP_PHASE_NAMES = {
+    "last_pid": "reading the kernel's last pid",
+    "enumeration": "enumerating pids",
+    "canonicalization": "canonicalizing paths",
+    "bookkeeping": "classification and bookkeeping",
+}
+
+
+def _seconds(value: object) -> float:
+    return float(value) if isinstance(value, (int, float)) else 0.0
+
+
+def _largest_gap_cause(largest: dict[str, Any], priority: object) -> str:
+    """Name the largest part of the gap the watcher broke down, and the
+    slowest process read of the sample that closed it."""
+    outside = largest.get("outside_sampling") or {}
+    inside = largest.get("in_sample") or {}
+    sample = largest.get("sample") or {}
+    steps = outside.get("steps") or {}
+    details = {
+        "wakeup_delay": (
+            f", after asking for {_seconds(outside.get('sleep_requested')):.4f}s"
+        ),
+        "enqueue": ", which waits only while the writer's queue is full",
+    }
+    # (seconds, name, what else the record says about it)
+    parts: list[tuple[float, str, str]] = [
+        (
+            _seconds(steps.get(step)),
+            f"{name} outside sampling",
+            details.get(step, ""),
+        )
+        for step, name in _GAP_STEP_NAMES.items()
+    ]
+    parts.append(
+        (_seconds(outside.get("unaccounted")), "untimed time outside sampling", "")
+    )
+    phases = sample.get("phases") or {}
+    parts += [
+        (_seconds(phases.get(phase)), f"{name} in the sample", "")
+        for phase, name in _GAP_PHASE_NAMES.items()
+    ]
+    # Reads compete as one phase, whatever kinds they were split across; the
+    # kind that took most of them explains it.
+    kinds = [
+        (_seconds(stats.get("seconds")), kind, stats)
+        for kind, stats in (sample.get("read_kinds") or {}).items()
+        if isinstance(stats, dict)
+    ]
+    reads_detail = ""
+    if kinds:
+        kind_seconds, kind, stats = max(kinds, key=lambda entry: entry[0])
+        reads_detail = (
+            f", most of it {kind} reads: {kind_seconds:.4f}s over "
+            f"{stats.get('count')} reads, the longest "
+            f"{_seconds(stats.get('max_seconds')):.4f}s of pid {stats.get('max_pid')}"
+        )
+    parts.append(
+        (_seconds(phases.get("reads")), "process reads in the sample", reads_detail)
+    )
+    parts.append(
+        (_seconds(inside.get("unaccounted")), "untimed time in the sample", "")
+    )
+    seconds, name, detail = max(parts, key=lambda part: part[0])
+    slowest = sample.get("slowest")
+    operation = (
+        f"{slowest.get('kind')} of pid {slowest.get('pid')} ({slowest.get('exe')}) "
+        f"at {_seconds(slowest.get('seconds')):.4f}s"
+        if isinstance(slowest, dict)
+        else "none"
+    )
+    return (
+        f"{_seconds(outside.get('seconds')):.4f}s of it passed between two "
+        f"samples, outside sampling, and {_seconds(inside.get('seconds')):.4f}s "
+        f"in the sample that closed it (watcher priority {priority!r}); its "
+        f"largest part was {name} at {seconds:.4f}s{detail}; the watcher used "
+        f"{_seconds(outside.get('cpu_seconds')):.4f}s of CPU outside sampling "
+        f"and {_seconds(sample.get('cpu_seconds')):.4f}s in the sample; the "
+        f"slowest process read in that sample was {operation}"
+        f"{_file_io_clause(largest.get('file_io'))}"
+    )
+
+
+def _file_io_clause(file_io: object) -> str:
+    """What the watcher's off-path file-system calls that ended in the gap
+    took, each its whole duration, so a slow file system shows even though
+    sampling did not wait on it. A call that began before the gap counts in
+    full, so this can exceed the gap's own share."""
+    if not isinstance(file_io, dict):
+        return ""
+    parts = []
+    for call, name in _GAP_FILE_IO_NAMES.items():
+        calls = file_io.get(call)
+        if
```

**File**: `tests/differential/test_watcher.py` (modified, +772/-9)
```diff
@@ -15,18 +15,24 @@
 
 from __future__ import annotations
 
+import errno
+import io
+import json
 import os
+import re
 import subprocess
 import sys
+import threading
 import time
+from collections.abc import Callable
 from pathlib import Path
-from typing import Any
+from typing import IO, Any, cast
 
 import pytest
 
 import psutil
 
-from differential import harness
+from differential import harness, watcher
 from differential.events import EventLog, read_jsonl
 from differential.harness import watcher_failures
 from differential.watcher import (
@@ -374,6 +380,31 @@ def test_a_watcher_stopped_on_request_after_the_actors_is_healthy(tmp_path):
     assert all(r["t"] in ends for r in records if r["kind"].startswith("process."))
     (ready,) = [r for r in records if r["kind"] == "watcher.ready"]
     assert ready["baseline_pgids"] or os.name == "nt"
+    # The largest gap comes with what it went to, on either side of a sample.
+    largest = summary["largest_gap"]
+    assert largest["seconds"] == summary["max_gap_seconds"]
+    # Named here, not from the watcher's own lists: a phase or step dropped
+    # from both the record and its list must still fail.
+    assert set(largest["outside_sampling"]["steps"]) == {
+        "tracker",
+        "enqueue",
+        "write",
+        "flush",
+        "sleep",
+        "wakeup_delay",
+        "stop_check",
+    }
+    # The file-system calls made off the sampling path, for the gap and the run.
+    assert set(largest["file_io"]) == {"write", "flush", "stop_check"}
+    assert set(summary["file_io"]) == {"write", "flush", "stop_check", "queue"}
+    assert summary["file_io"]["stop_check"]["count"] >= 1
+    assert set(largest["sample"]["phases"]) == {
+        "last_pid",
+        "enumeration",
+        "reads",
+        "canonicalization",
+        "bookkeeping",
+    }
     if sys.platform.startswith("linux"):
         assert all(isinstance(last, int) for _, _, last in log)
 
@@ -440,14 +471,20 @@ def _sampler(
     user_of=_user_of,
     timer=time.perf_counter,
     last_pid_of=lambda: None,
+    pids=None,
+    clock=time.time,
+    cpu=time.process_time,
+    pgid_of=None,
 ):
     return Sampler(
         root,
         own_pid=999,
-        pids=lambda: list(table),
+        pids=pids or (lambda: list(table)),
         open_process=lambda pid: _FakeProcess(table, pid),
         user_of=user_of,
         timer=timer,
+        clock=clock,
+        cpu=cpu,
         last_pid_of=last_pid_of,
         user=HARNESS,
         browser_exe=browser_exe,
@@ -456,9 +493,8 @@ def _sampler(
         # every host the suite runs on.
         no_exec=no_exec,
         # The modelled group, never the real one of a real pid.
-        pgid_of=lambda pid: _field(
-            {"pgid": (table.get(pid) or {}).get("pgid")}, "pgid"
-        ),
+        pgid_of=pgid_of
+        or (lambda pid: _field({"pgid": (table.get(pid) or {}).get("pgid")}, "pgid")),
         # Markers are read wherever a guardian drains by them: POSIX.
         read_markers=not no_exec,
     )
@@ -1589,7 +1625,7 @@ def user_of(process):
     assert sampler.relevant_read_failures
 
 
-def test_a_slow_sample_names_the_read_it_waited_on():
+def test_a_slow_sample_names_its_largest_timed_read():
     clock = {"now": 0.0}
     table = _baseline_table()
     sampler = _sampler(table, root=10, timer=lambda: clock["now"])
@@ -1612,7 +1648,8 @@ def test_a_slow_sample_names_the_read_it_waited_on():
     assert stats["slowest_read"]["kind"] == "cmdline"
 
 
-def test_a_gap_over_budget_names_what_the_slowest_samples_waited_on():
+def test_a_summary_without_a_gap_breakdown_names_the_slowest_samples():
+    # Written before the watcher kept ``largest_gap``.
     slow = {
         "seconds": 1.3,
         "reads": 55,
@@ -1633,9 +1670,10 @@ def test_a_gap_over_budget_names_what_the_slowest_samples_waited_on():
     )
     (failure,) = failures
     assert "1.38s" in failure and "'cmdline'" in failure and "x.exe" in failure
+    assert "the run's slowest samples" in failure
 
 
-def test_a_gap_spent_waiting_to_run_names_no_read():
+def test_a_summary_without_a_gap_breakdown_names_time_outside_sampling():
     # Run 36327966208, K0 on windows-latest: the only slow sample was the
     # baseline, which no gap is measured across, and the widest gap was the
     # watcher not running between two samples of 4ms.
@@ -1674,6 +1712,731 @@ def test_a_gap_spent_waiting_to_run_names_no_read():
     assert "svchost" not in failure
 
 
+# --- What a gap went to -----------------------------------------------------------
+
+#: The modelled stall: over the gap budget on its own.
+_STALL = 1.2
+_INTERVAL = 0.05
+
+
+def _timed_run(
+    monkeypatch, stalls: dict[int, dict[str, float]], *, samples: int = 8
+) -> tuple[dict[str, Any], Sampler]:
+    """Run the watcher's loop on a modelled table and clock, where sample *n*
+    begins by arming ``stalls[n]``: each named site takes the clock forward by
+    its seconds the next time it 
```

**File**: `tests/differential/watcher.py` (modified, +761/-124)
```diff
@@ -38,8 +38,22 @@
 **What a lifetime is cannot change, so it is asked once.** Its owning user is
 read once per pid and create time, and a lifetime a full read found gone
 (``NoSuchProcess``) is not read again, however long its pid stays listed.
-Every read is timed: the summary names the slowest, and every sample of at
-least ``SLOW_SAMPLE_SECONDS`` with the read it waited on longest.
+The paths it names, its executable and its profile, are resolved once per
+lifetime and spelling, and forgotten when the lifetime ends
+(``Sampler._resolve``). Every read is timed, and each sample's time is charged to its phases
+(``SAMPLE_PHASES``). The summary names the slowest read, keeps every sample of
+at least ``SLOW_SAMPLE_SECONDS`` with its phases, and keeps the largest gap
+between two samples with what the time outside sampling went to
+(``BETWEEN_STEPS``) and the phases of the sample that closed it.
+
+**The loop between samples makes no file-system call.** On a Windows runner
+a stop-file check has blocked for 1.23s at no CPU while sampling waited for
+it. So the stop file is polled by a thread of its own (``StopWatch``), and
+events are serialized, written and flushed by another (``EventWriter``), in
+the order the samples produced them; the loop reads an event and hands each
+sample's events to a bounded queue. What those threads' calls took is in the
+summary's ``file_io``, and what of it fell inside the largest gap is in that
+gap's record, so a slow file system still shows without holding sampling.
 
 **When each sample was taken is part of the evidence.** The summary's
 ``sample_log`` gives every sample's start, its end (the time its events
@@ -138,15 +152,18 @@
 from __future__ import annotations
 
 import argparse
+import contextlib
 import hashlib
 import json
 import os
+import queue
 import sys
+import threading
 import time
 from collections.abc import Callable, Iterable, Mapping, Sequence
 from dataclasses import dataclass, replace
 from pathlib import Path
-from typing import Any
+from typing import IO, Any
 
 import psutil
 
@@ -176,10 +193,47 @@
 #: passed on to the interpreter it starts.
 SCHEDULING_CLASS: int | None = getattr(psutil, "HIGH_PRIORITY_CLASS", None)
 
-#: A sample at least this long is recorded with its slowest single read, so a
-#: stall names the call and the process it waited on. A quarter of the gap
-#: budget the rows accept (``harness.MAX_WATCHER_GAP_SECONDS``).
+#: A sample at least this long is recorded with its phases and its largest
+#: timed read. A quarter of the gap budget the rows accept
+#: (``harness.MAX_WATCHER_GAP_SECONDS``).
 SLOW_SAMPLE_SECONDS = 0.25
+#: What a sample's time is charged to. Every instant of a sample belongs to
+#: the phase current then, so the phases add up to the sample's duration:
+#: ``last_pid`` and ``enumeration`` open it, ``reads`` is every timed read of
+#: one process (by kind in ``read_kinds``), ``canonicalization`` every path
+#: resolved to name a profile or compare an executable (a lifetime's own paths
+#: once, ``Sampler._resolve``), and ``bookkeeping``
+#: everything else: the loop around the reads, classification and judgement.
+SAMPLE_PHASES = ("last_pid", "enumeration", "reads", "canonicalization", "bookkeeping")
+#: What the time between one sample's end and the next one's start is
+#: charged to, in the order it passes: turning the sample into events,
+#: handing them to the writer thread (``enqueue``, which waits only when the
+#: writer's queue is full), the sleep asked for, how much later than asked it
+#: returned, and reading whether a stop was requested (``stop_check``, an
+#: event the stop-file thread sets). ``write`` and ``flush`` stay zero: the
+#: loop no longer does either, and the record keeps every step it had. The
+#: writer's and the stop-file thread's own calls are in ``file_io``. Whatever
+#: none of the steps took is the record's ``unaccounted``.
+BETWEEN_STEPS = (
+    "tracker",
+    "enqueue",
+    "write",
+    "flush",
+    "sleep",
+    "wakeup_delay",
+    "stop_check",
+)
+#: The file-system calls made off the sampling path, each timed by the thread
+#: that makes it: the writer's writes (serialization included) and flushes,
+#: and the stop-file checks.
+FILE_IO_CALLS = ("write", "flush", "stop_check")
+#: How many samples' events may wait for the writer thread: ten seconds at
+#: ``SAMPLE_SECONDS``. A writer that far behind holds the loop rather than
+#: lose an event (``EventWriter``).
+WRITE_QUEUE_BATCHES = 200
+#: How often a loop held by a full queue looks again whether the writer
+#: failed, so a dead writer cannot hold it for good.
+_FULL_WAIT_POLL = 0.05
 #: At most this many slow samples are kept, the first ones.
 _SLOW_SAMPLES_KEPT = 100
 #: At most this many failed group reads are kept, the first ones.
@@ -196,29 +250,40 @@
 READ_MARKERS = os.name != "nt"
 
 
+def _real(path: str) -> str:
+    """One spelling per path. On Windows ``realpath`` opens the file, and can
+    wait as long as
```

---

### Incident Patch 14: `71553e7c` (2026-10-02)
**Commit Message**: fix(daemon): Spare the owner's Job infrastructure (#1201)

**File**: `changelog.d/1201.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+On Windows, closing the shared daemon's browser no longer breaks its next browser start.
```

**File**: `linkedin_mcp_server/process_tree.py` (modified, +67/-23)
```diff
@@ -23,13 +23,19 @@
 
 _IS_WINDOWS = os.name == "nt"
 _adopted_windows_job: int | None = None
-#: The gate that launched this owner, which is a member of the same Job and must
-#: survive every drain below. It spawns the owner and waits, so it is the process
-#: the frontend reads an exit status from, and a drain that ends it replaces that
-#: status with the termination code. Recorded while it is provably the parent and
-#: provably alive, which is what makes the id safe to hold: Windows cannot reuse
-#: it while the gate is still waiting on this process.
-_adopted_windows_gate: int | None = None
+#: Every process the adopted Job held when this owner adopted it, by id and
+#: creation time, all of which must survive every drain below. A frontend
+#: assigns the Job before the owner exists, so the gate that spawns this owner
+#: and waits on it is a member, and so is what Windows started on the way: a
+#: venv launcher in front of each interpreter, which runs the real one as its
+#: child, and the gate's console host. Ending the gate costs the frontend this
+#: owner's exit status, and each time a drain ended this chain on Windows CI the
+#: owner's next browser start failed. Not the parent alone: under a venv that
+#: is the owner's own launcher, and the gate above it went. Nothing in the Job
+#: is a browser's yet when this is recorded (see
+#: ``WindowsJob.adopt_current_process``), and the creation time keeps an id
+#: reused after one of these exited from being spared in its place.
+_adopted_windows_infrastructure: dict[int, Any] = {}
 _retained_windows_jobs: list[WindowsJob] = []
 _BROWSER_PROCESS_MARKER = "LINKEDIN_MCP_BROWSER_PROCESS_MARKER"
 
@@ -698,18 +704,25 @@ def _drain_marked_posix_groups(marker: str, deadline: float) -> bool:
 
 
 def _drain_exclusions() -> frozenset[int]:
-    """Process ids no adopted-Job drain may end.
+    """Process ids no adopted-Job drain may open, let alone end.
 
-    This owner, which has to survive its own browser, and the gate that launched
-    it, which is in the same Job because that is how a frontend assigns the Job
-    before the owner exists. The gate then waits and mirrors the owner's exit
-    status, so ending it costs the frontend that status and says nothing about
-    the browser the drain was aimed at.
+    The idle id and this owner, which has to survive its own browser. The rest
+    of the owner's infrastructure is not here: an id alone does not say it is
+    still the same process, so the drain opens it and compares its creation
+    time against ``_adopted_windows_infrastructure`` instead.
     """
-    spared = {0, os.getpid()}
-    if _adopted_windows_gate is not None:
-        spared.add(_adopted_windows_gate)
-    return frozenset(spared)
+    return frozenset({0, os.getpid()})
+
+
+def _windows_process_created(handle: Any) -> Any:
+    """When the process behind *handle* was created, from ``GetProcessTimes``.
+
+    pywin32 converts the FILETIME through a SYSTEMTIME, so this is to the
+    millisecond. That still tells two holders of one id apart: the second can
+    only start once the first has exited.
+    """
+    win32process = importlib.import_module("win32process")
+    return win32process.GetProcessTimes(handle)["CreationTime"]
 
 
 def _patchright_driver_process(playwright: Any) -> Any:
@@ -828,8 +841,10 @@ def _drain_adopted_windows_job_members(deadline: float) -> bool:
     Windows has no marker to scan for: an environment block belongs to its own
     process, and reading another one's takes the debugger APIs. The Job is the
     whole of the attribution there, so this drains what the Job still holds,
-    minus the exclusions that keep it from being a tree kill. The owner and the
-    gate that launched it, both in :func:`_drain_exclusions`. And every member of
+    minus the exclusions that keep it from being a tree kill. The owner, in
+    :func:`_drain_exclusions`. The gate chain that launched it, every process
+    the Job held at adoption that is still the same process
+    (``_adopted_windows_infrastructure``). And every member of
     another Job this owner still holds: the installer supervisor and its worker sit in one of those
     (``WindowsJob.anonymous`` in ``bootstrap``), and so now does every *other*
     live browser launch (:func:`contain_browser_launch`).
@@ -870,6 +885,10 @@ def _drain_adopted_windows_job_members(deadline: float) -> bool:
                     # The id left the Job between the query and here, so it
                     # names somebody else's process now.
                     continue
+                created = _adopted_windows_infrastructure.get(process)
+                if created is not None and _windows_process_created(handle) == created:
+                    # In the Job before any browser was, and still that process.
+                    continue
                 elsewhere = _in_another_owned_job(win32job, handle)
                 if elsewhere:
                     continue
@@ -1213,20 +
```

**File**: `tests/differential/job_query_model.py` (modified, +42/-11)
```diff
@@ -7,11 +7,12 @@
 revisions keep the same positive controls: a member a held Job claims is
 spared, a later positive answer outweighs an earlier failure, a member known
 to be in no held Job is still ended, an unanswered inventory, open or
-membership query is never read as empty, the exclusions are never opened and
-every handle opened is closed.
+membership query is never read as empty, the owner and the idle id are never
+opened, the gate is never ended and every handle opened is closed.
 
 **Evidence.** ``source-model``. The definitions of ``_drain_exclusions``,
-``_in_another_owned_job`` and ``_drain_adopted_windows_job_members`` are taken
+``_in_another_owned_job`` and ``_drain_adopted_windows_job_members``, and of
+``_windows_process_created`` where a revision has it, are taken
 from each revision's source text and run, unchanged, against Win32 doubles
 whose answers each case scripts per iteration of the drain. What the model
 shows is the branch each revision's code selects in a modelled state. It
@@ -45,15 +46,21 @@
     "_in_another_owned_job",
     "_drain_adopted_windows_job_members",
 )
+#: Called by the routine in revisions that spare the owner's infrastructure by
+#: creation time, and absent from the ones before.
+_OPTIONAL = ("_windows_process_created",)
 _CONSTANTS = ("_JOB_POLL_SECONDS",)
 
 SOURCE_MODEL = "source-model"
 BASELINE = "baseline"
 CANDIDATE = "candidate"
 
-#: The adopted Job's handle, and the gate the drain must never end.
+#: The adopted Job's handle, and the gate the drain must never end: the
+#: baseline spares it by id, a revision that records the Job's members at
+#: adoption by id and this creation time.
 ADOPTED_JOB = 123
 GATE = 3572
+GATE_CREATED = 2.0
 #: The installer's Job, held by the owner, and a second held Job.
 INSTALLER_JOB = 55
 BROWSER_JOB = 56
@@ -92,7 +99,10 @@ def load(cls, revision: str, source: str) -> Routine:
         chosen: list[ast.stmt] = []
         names: list[str] = []
         for node in ast.parse(source).body:
-            if isinstance(node, ast.FunctionDef) and node.name in ROUTINE:
+            if isinstance(node, ast.FunctionDef) and node.name in (
+                *ROUTINE,
+                *_OPTIONAL,
+            ):
                 chosen.append(node)
                 names.append(node.name)
             elif isinstance(node, ast.Assign):
@@ -106,6 +116,12 @@ def load(cls, revision: str, source: str) -> Routine:
                     f"{revision}: {name} is defined {names.count(name)} times in "
                     f"the source"
                 )
+        for name in _OPTIONAL:
+            if names.count(name) > 1:
+                raise ModelRefused(
+                    f"{revision}: {name} is defined {names.count(name)} times in "
+                    f"the source"
+                )
         code = compile(
             ast.Module(body=chosen, type_ignores=[]),
             f"<{revision} {MODULE}>",
@@ -176,9 +192,9 @@ class World:
     """The Win32 the routine drain sees: its adopted Job, the Jobs the owner
     holds, the members, and a clock that only its ``sleep`` moves.
 
-    One object stands for ``win32api``, ``win32job`` and ``time``: their names
-    do not overlap. A process the drain ended leaves the inventory, as a
-    terminated process leaves its Job.
+    One object stands for ``win32api``, ``win32job``, ``win32process`` and
+    ``time``: their names do not overlap. A process the drain ended leaves the
+    inventory, as a terminated process leaves its Job.
     """
 
     JobObjectBasicProcessIdList = _BASIC_PROCESS_ID_LIST
@@ -252,6 +268,18 @@ def TerminateProcess(self, handle: _Handle, status: int) -> None:
             raise Win32Error(5, "TerminateProcess", "Access is denied.")
         self.dead.add(handle.pid)
 
+    # --- win32process -----------------------------------------------------------
+
+    def GetProcessTimes(self, handle: _Handle) -> dict[str, float]:
+        self.calls += 1
+        return {"CreationTime": self.members[handle.pid].created}
+
+    def import_module(self, name: str) -> World:
+        """``importlib.import_module``, which reaches ``win32process`` only."""
+        if name != "win32process":
+            raise ModuleNotFoundError(name)
+        return self
+
     # --- time -------------------------------------------------------------------
 
     def monotonic(self) -> float:
@@ -320,8 +348,10 @@ def run(self, routine: Routine) -> Outcome:
         namespace.update(
             _adopted_windows_job=ADOPTED_JOB if self.adopted else None,
             _adopted_windows_gate=GATE,
+            _adopted_windows_infrastructure={GATE: GATE_CREATED},
             _live_windows_jobs=[SimpleNamespace(job_handle=h) for h in world.held],
             _windows_modules=world.modules,
+            importlib=world,
             time=world,
         )
         witnessed: tuple[Any, ...] = ()
@@ -361,7 +391,7 @@ def run(self, routine: Routine) -> Outcome:
             opened_spared=tu
```

**File**: `tests/test_daemon_regression_witnesses.py` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ def IsProcessInJob(handle: ProcessHandle, job: Any) -> bool:
 
         monkeypatch.setattr(process_tree, "_IS_WINDOWS", True)
         monkeypatch.setattr(process_tree, "_adopted_windows_job", 123)
-        monkeypatch.setattr(process_tree, "_adopted_windows_gate", None)
+        monkeypatch.setattr(process_tree, "_adopted_windows_infrastructure", {})
         monkeypatch.setattr(
             process_tree, "_windows_modules", lambda: (Api(), Con(), Job(), object())
         )
@@ -307,7 +307,7 @@ def sleep(seconds: float) -> None:
 
     monkeypatch.setattr(process_tree, "_IS_WINDOWS", True)
     monkeypatch.setattr(process_tree, "_adopted_windows_job", 123)
-    monkeypatch.setattr(process_tree, "_adopted_windows_gate", None)
+    monkeypatch.setattr(process_tree, "_adopted_windows_infrastructure", {})
     monkeypatch.setattr(
         process_tree,
         "_live_windows_jobs",
```

**File**: `tests/test_process_tree.py` (modified, +177/-59)
```diff
@@ -330,6 +330,7 @@ def _modules(
         handle: _JobHandle,
         *,
         active: Iterator[object] | None = None,
+        members: tuple[int | None, ...] = (909, 4242),
     ) -> dict[str, object]:
         accounting = active or iter([0])
 
@@ -346,15 +347,30 @@ def GetCurrentProcess() -> int:
             def GetLastError() -> int:
                 return 0
 
+            @staticmethod
+            def OpenProcess(access: int, _inherit: bool, process: int) -> _JobHandle:
+                opened = _JobHandle(process)
+                events.append(("open-process", (access, opened)))
+                return opened
+
         class _Win32Con:
             HANDLE_FLAG_INHERIT = 1
+            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
 
         class _WinError:
             ERROR_ALREADY_EXISTS = 183
 
+        class _Win32Process:
+            @staticmethod
+            def GetProcessTimes(process: _JobHandle) -> dict[str, Any]:
+                # A time of its own per id, so a record pairing an id with
+                # another member's creation time would show.
+                return {"CreationTime": f"created-{process.value}"}
+
         class _Win32Job:
             JobObjectExtendedLimitInformation = 1
             JobObjectBasicAccountingInformation = 2
+            JobObjectBasicProcessIdList = 3
             JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 4
             JOB_OBJECT_QUERY = 8
 
@@ -369,11 +385,12 @@ def OpenJobObject(*args: object) -> _JobHandle:
                 return handle
 
             @staticmethod
-            def QueryInformationJobObject(
-                _handle: object, info_class: int
-            ) -> dict[str, Any]:
+            def QueryInformationJobObject(_handle: object, info_class: int) -> Any:
                 if info_class == _Win32Job.JobObjectExtendedLimitInformation:
                     return {"BasicLimitInformation": {"LimitFlags": 16}}
+                if info_class == _Win32Job.JobObjectBasicProcessIdList:
+                    events.append(("members", _handle))
+                    return members
                 events.append(("accounting", (_handle, info_class)))
                 value = next(accounting)
                 if isinstance(value, BaseException):
@@ -402,19 +419,18 @@ def TerminateJobObject(*args: object) -> None:
             "win32con": _Win32Con,
             "win32job": _Win32Job,
             "winerror": _WinError,
+            "win32process": _Win32Process,
         }
 
     def _patch_modules(
         self,
         monkeypatch: pytest.MonkeyPatch,
         modules: dict[str, object],
     ) -> None:
-        # getppid alongside name: adoption records the gate it was launched
-        # by, and a namespace without it reports the whole adoption as failed.
+        # getpid alongside name: adoption refuses a member list without this
+        # owner in it, and a namespace without getpid fails the adoption.
         monkeypatch.setattr(
-            process_tree,
-            "os",
-            SimpleNamespace(name="nt", getpid=lambda: 4242, getppid=lambda: 909),
+            process_tree, "os", SimpleNamespace(name="nt", getpid=lambda: 4242)
         )
         monkeypatch.setattr(
             process_tree.importlib, "import_module", modules.__getitem__
@@ -507,7 +523,7 @@ def test_owner_verification_closes_and_adoption_detaches_the_named_handle(
         job_api = cast(Any, modules["win32job"])
         monkeypatch.setattr(job_api, "OpenJobObject", lambda *_args: next(handles))
         monkeypatch.setattr(process_tree, "_adopted_windows_job", None)
-        monkeypatch.setattr(process_tree, "_adopted_windows_gate", None)
+        monkeypatch.setattr(process_tree, "_adopted_windows_infrastructure", {})
         self._patch_modules(monkeypatch, modules)
 
         process_tree.WindowsJob.verify_current_process("named-owner")
@@ -518,9 +534,59 @@ def test_owner_verification_closes_and_adoption_detaches_the_named_handle(
         assert adopted.detached
         assert not adopted.closed
         assert process_tree._adopted_windows_job == 2
-        assert process_tree._adopted_windows_gate == 909, (
-            "the gate that waits on this owner was recorded while it was alive"
-        )
+        assert ("members", adopted) in events, "listed through the adopted handle"
+        assert process_tree._adopted_windows_infrastructure == {
+            909: "created-909",
+            4242: "created-4242",
+        }, "every member then, each with its own creation time"
+        members = [event[1] for event in events if event[0] == "open-process"]
+        assert [access for access, _ in members] == [0x1000, 0x1000]
+        assert all(member.closed for _, member in members)
+
+    @pytest.mark.parametrize(
+        ("members", "failure", "message"),
+        [
+            pytest.param((909, None, 4242), None, "in part", id="unnamed-member"),
+            pytest.param((909,), None, "without the owner", id="owner-missing"),
+         
```

---

### Incident Patch 15: `2b1cb6c8` (2026-10-02)
**Commit Message**: test(daemon): Race idle retirement and turnover (#1193)

**File**: `.github/workflows/ci.yml` (modified, +102/-18)
```diff
@@ -811,36 +811,41 @@ jobs:
 
       - run: uv cache prune --ci
 
-  # Calls that lose their caller (tests/differential/call_loss.py), in a job of
-  # their own rather than more steps in `platform-behaviour`, whose budget the
-  # rows before them already fill. Four legs: the Ubuntu x64 job's platform
-  # and the three `platform-behaviour` runs on, each with its own browser
-  # build. The setup is the one the differential steps above need, copied
-  # step for step: the browser for the candidate and the frozen baseline, the
-  # run's certificates, the trust and the fence behind the disposable-runner
-  # guard, a display on Linux, and on Linux the signal oracle H-R5 kills
-  # under. Serial, like every native row, and its evidence uploaded whatever
-  # happened, under names of its own.
+  # Calls that lose their caller (tests/differential/call_loss.py), and calls
+  # that race the owner's retirement (tests/differential/retirement_race.py),
+  # in a job of their own rather than more steps in `platform-behaviour`,
+  # whose budget the rows before them already fill. Four legs: the Ubuntu x64
+  # job's platform and the three `platform-behaviour` runs on, each with its
+  # own browser build. The setup is the one the differential steps above
+  # need, copied step for step: the browser for the candidate and the frozen
+  # baseline, the run's certificates, the trust and the fence behind the
+  # disposable-runner guard, a display on Linux, and on Linux the signal
+  # oracle H-R5 kills under. Serial, like every native row, and its evidence
+  # uploaded whatever happened, under names of its own.
   differential-calls:
     name: Differential calls (${{ matrix.os }}, ${{ matrix.rows }})
     runs-on: ${{ matrix.os }}
     # The camelCase read shims off, for the reason given at `windows-daemon`.
     env:
       FASTMCP_MCP_CAMELCASE_COMPAT: "false"
-    # Two groups of rows per leg, so neither job's bound comes near the
-    # hosted runner's six hours. The sum of a group's step bounds: 45 for a
-    # cold browser download for each runtime and the frozen baseline (bound
-    # 15), with room for Windows, the slowest leg, to sync and install twice;
-    # then `pipes` 30 for H-CAL and 45 for each of its two loss steps (165),
-    # `processes` 5 for the oracle and 45 for each of its three (185).
-    timeout-minutes: ${{ matrix.rows == 'pipes' && 165 || 185 }}
+    # Three groups of rows per leg, so no job's bound comes near the hosted
+    # runner's six hours. The sum of a group's step bounds: 45 for a cold
+    # browser download for each runtime and the frozen baseline (bound 15),
+    # with room for Windows, the slowest leg, to sync and install twice; then
+    # `pipes` 30 for H-CAL and 45 for each of its two loss steps (165),
+    # `processes` 5 for the oracle and 45 for each of its three (185), and
+    # `idle` 50 for each of the two H-R13 steps and 35 for each of the four
+    # turnover lanes (285).
+    timeout-minutes: ${{ matrix.rows == 'pipes' && 165 || matrix.rows == 'processes' && 185 || 285 }}
     strategy:
       fail-fast: false
       matrix:
         os: [ubuntu-latest, ubuntu-24.04-arm, macos-latest, windows-latest]
         # `pipes`: H-CAL and the two losses through the host's own pipes.
         # `processes`: the losses that end a process, which the oracle traces.
-        rows: [pipes, processes]
+        # `idle`: the reads that race the owner's retirement, idle or asked
+        # for (tests/differential/retirement_race.py); nothing is killed.
+        rows: [pipes, processes, idle]
         include:
           - os: ubuntu-latest
             browsers: ~/.cache/ms-playwright
@@ -1065,6 +1070,85 @@ jobs:
         timeout-minutes: 45
         run: uv run pytest -v -s -o faulthandler_timeout=300 tests/differential/test_call_loss_rows.py -k killed_mid_read
 
+      # Row H-R13: the read raced against the owner's idle exit, with its own
+      # 8s idle timeout (retirement_race.IDLE_RACE_TIMEOUT_SECONDS), in K1
+      # frozen, K3 and K0 (K2 recorded not applicable), one step per lane.
+      # Each cell is the calibration's seven minutes with an idle timeout of
+      # 8s instead of 60s, plus its own waits. Admission wins: the hold (at
+      # most 18s), the owner's or Direct's idle exit after the read (8 + 60s)
+      # and the browser after it (60s). Retirement wins: the idle line (8 +
+      # 60s), the owner's exit or the browser (60s), and the call through an
+      # election (bound 180s). Then the owner's or successor's own idle exit
+      # (8 + 90s) and the residual browser wait (60s). Three cells come to at
+      # most 45 minutes: 50 each.
+      - name: Race an admitted read against the idle exit
+        if: matrix.rows == 'idle'
+        env:
+          LINKEDIN_MCP_DIFFERENTIAL_CI: "1"
+          LINKEDIN_MCP_DIFFERENTIAL_CA_DIR: ${{ runner.temp }}/synthetic-origin
+          LINKEDIN_MCP_DIFFERENTIAL_OUT: ${{ runner.temp }}/differential-calls-evidence
+  
```

**File**: `tests/differential/call_loss.py` (modified, +68/-2)
```diff
@@ -792,7 +792,63 @@ def _owner_kept(record: Mapping[str, Any]) -> bool:
             and seen.get("instance_id") == identified[2]
         ):
             return False
-    return _other_launches(record, identified[:2]) == []
+    return _unexcused_launches(record, identified[:2]) == []
+
+
+def _members(entry: Sequence[Any], record: Mapping[str, Any]) -> list[Sequence[Any]]:
+    """Every recorded lifetime of the launch *entry* names, an owner launch
+    ``[pid, start]`` or ``["release gate", pid, start]``: the launch itself
+    and, on Windows, the interpreter its venv launcher started."""
+    if not entry:
+        return []
+    if entry[0] == "release gate":
+        lifetimes, launch = _sequence(record.get("gate_processes")), entry[1:]
+    elif type(entry[0]) is int:
+        lifetimes, launch = _sequence(record.get("owner_processes")), entry
+    else:
+        return []
+    return [
+        _sequence(p)
+        for p in lifetimes
+        if same_lifetime(_sequence(p)[:2], launch[:2])
+        or _of_launch(_sequence(p)[:2], launch, lifetimes)
+    ]
+
+
+def _browsers_of(
+    members: Sequence[Sequence[Any]], record: Mapping[str, Any]
+) -> list[Sequence[Any]] | None:
+    """The browser roots (``harness.browser_lineage``) one of *members*
+    launched, or None when the roots were not recorded or one of them names
+    no launcher, so whose it was cannot be said."""
+    roots = record.get("browser_roots")
+    if not isinstance(roots, list):
+        return None
+    found = []
+    for root in map(_sequence, roots):
+        if len(root) < 5 or root[3] is None or root[4] is None:
+            return None
+        if any(same_lifetime([root[3], root[4]], member[:2]) for member in members):
+            found.append(root)
+    return found
+
+
+def _read_nothing(entry: Sequence[Any], record: Mapping[str, Any]) -> bool:
+    """Whether the launch *entry* names is shown to have read nothing: every
+    process of it seen gone, and no browser launched by any of them. A launch
+    that read a page had a browser of its own, so this holds whether or not
+    it ever took the lock; how its process timing fell says nothing either
+    way, since an owner releases the lock before it exits. An unrecorded or
+    unattributable browser leaves it not shown."""
+    members = _members(entry, record)
+    if not members or not all(
+        len(member) > 4 and member[4] is not None for member in members
+    ):
+        return False
+    if entry[0] == "release gate":
+        # A gate runs no browser; the owner it started is a launch of its own.
+        return True
+    return _browsers_of(members, record) == []
 
 
 def _other_launches(record: Mapping[str, Any], owner: Sequence[Any]) -> list | None:
@@ -820,6 +876,16 @@ def _other_launches(record: Mapping[str, Any], owner: Sequence[Any]) -> list | N
     return others
 
 
+def _unexcused_launches(record: Mapping[str, Any], owner: Sequence[Any]) -> list | None:
+    """``_other_launches`` without those shown to have read nothing
+    (``_read_nothing``): an election candidate that lost the lock, before or
+    after the owner the row identified, is the election doing its job."""
+    others = _other_launches(record, owner)
+    if others is None:
+        return None
+    return [entry for entry in others if not _read_nothing(entry, record)]
+
+
 def loss_reading(record: Mapping[str, Any]) -> dict[str, Any]:
     """What a losing row's record shows, classified: no time, pid or path.
 
@@ -1089,7 +1155,7 @@ def _hot_reuse_findings(record: Mapping[str, Any]) -> list[str]:
                 f"instance {seen.get('instance_id')!r}, not the identified "
                 f"{list(identified)}; hot reuse of the same owner is not shown"
             )
-    successors = _other_launches(record, identified[:2])
+    successors = _unexcused_launches(record, identified[:2])
     if successors is None:
         found.append("the row's owner and release gate lifetimes were not recorded")
     elif successors:
```

**File**: `tests/differential/harness.py` (modified, +389/-15)
```diff
@@ -77,7 +77,10 @@
 read through a held, then released, section page. **Rows H-R4 and H-R5**
 lose that read once its held page entered, each by a termination of its own
 (``RowLifecycle.termination``), through ``LossSeams``; a host killed whole
-is a process of its own (``StubHost``).
+is a process of its own (``StubHost``). **Row H-R13** and the **turnover
+lanes** (``retirement_race``) race the read against the owner's retirement,
+idle or asked for, through ``RaceSeams``; a row whose call a successor may
+serve settles that successor in the identified owner's place.
 """
 
 from __future__ import annotations
@@ -122,7 +125,13 @@
 from mcp.shared.message import SessionMessage
 from typing_extensions import Unpack
 
-from differential import call_loss, host_comparison, lease_probe, r7_fault
+from differential import (
+    call_loss,
+    host_comparison,
+    lease_probe,
+    r7_fault,
+    retirement_race,
+)
 from differential.baseline import (
     BaselineRefused,
     Runtime,
@@ -2809,6 +2818,73 @@ def owner_gates(observed: Iterable[dict[str, Any]], gates: Sequence[Path]) -> li
     )
 
 
+def browser_lineage(observed: Iterable[dict[str, Any]]) -> list[list[Any]]:
+    """Every browser root the watcher saw this row's actors start, with the
+    process that launched it: ``[pid, start, gone, owner pid, owner start]``.
+
+    A root is a browser process whose parent is not itself a browser (the
+    watcher's own tree rule, ``watcher.browser_roots``); its parent is the
+    driver, and the driver's parent the process that drove it, which in a
+    daemon row is an owner. A parent is the latest lifetime of that pid
+    started no later than its child, with no tolerance: a child is never born
+    before its parent, on any clock the watcher reads. *gone* is when the
+    watcher saw the root exit, or None; the launcher's fields are None where
+    the watcher never saw that ancestor. A launch that read a page had a
+    browser of its own, so this names which launch could have read what,
+    whatever its process timing.
+
+    A lifetime is a browser if any record of it says so: a child sampled
+    between fork and exec is first seen with its parent's command line and
+    only later as the browser it became. Its parent is the one its first
+    record names, before any reparenting.
+    """
+    first: dict[tuple[int, float], dict[str, Any]] = {}
+    browsers: set[tuple[int, float]] = set()
+    gone: dict[tuple[int, float], float] = {}
+    for record in observed:
+        pid, start = record.get("pid"), record.get("start_identity")
+        if type(pid) is not int or not isinstance(start, (int, float)):
+            continue
+        key = (pid, float(start))
+        if record.get("kind") not in (
+            "process.start",
+            "process.update",
+            "process.exit",
+        ):
+            continue
+        first.setdefault(key, record)
+        if record.get("actor") == "browser":
+            browsers.add(key)
+        if record.get("kind") == "process.exit" and isinstance(
+            record.get("t"), (int, float)
+        ):
+            gone.setdefault(key, float(record["t"]))
+
+    def parent_of(
+        child: tuple[int, float],
+    ) -> tuple[int, float] | None:
+        ppid = first[child].get("ppid")
+        found = [key for key in first if key[0] == ppid and key[1] <= child[1]]
+        return max(found, key=lambda key: key[1]) if found else None
+
+    roots = []
+    for key in sorted(browsers, key=lambda key: key[1]):
+        parent = parent_of(key)
+        if parent is not None and parent in browsers:
+            continue
+        launcher = parent_of(parent) if parent is not None else None
+        roots.append(
+            [
+                key[0],
+                key[1],
+                gone.get(key),
+                launcher[0] if launcher is not None else None,
+                launcher[1] if launcher is not None else None,
+            ]
+        )
+    return roots
+
+
 def launch_lifetimes(
     observed: Iterable[dict[str, Any]],
     gates: Sequence[Path],
@@ -4679,6 +4755,124 @@ def observe_owner(
     return seen
 
 
+def observe_roots(
+    label: str,
+    account: ActorAccount,
+    *,
+    browser_exe: str | None = None,
+    browser_dir: str | Path | None = None,
+    process_iter: Callable[..., Iterable[Any]] | None = None,
+) -> dict[str, Any]:
+    """The browser roots on the row's profile now, each ``[pid, start]``, by
+    the watcher's own predicate (``host_comparison.census_roots``); None
+    when the census could not say. Stamped on both clocks as it began, and
+    on the monotonic clock as its census was done (``done_ns``): a reading
+    lies between the two, never at the first alone."""
+    point: dict[str, Any] = {
+        "label": label,
+        "seen": time.time(),
+        "seen_ns": time.monotonic_ns(),
+    }
+    census = profile_census(
+        account,
+        browser_exe=browser_exe,
+        browser_
```

**File**: `tests/differential/retirement_race.py` (added, +1673/-0)
```diff
@@ -0,0 +1,1673 @@
+"""Calls racing the owner's retirement: its idle exit (H-R13) and a turnover.
+
+Both read ``get_person_profile`` with ``sections="experience,education"``,
+the calibrated read (``call_loss``), for a username of the row's own, and hold
+its pages at the synthetic origin (``SyntheticOrigin.hold``), never longer
+than ``HOLD_CAP_SECONDS`` each, below the gate's deadline.
+
+**H-R13** declares an idle timeout of its own, ``IDLE_RACE_TIMEOUT_SECONDS``,
+the same in K1 frozen, K3 and K0. It has to exceed the time from the owner's
+publication to the first call it admits, or the owner retires before the row
+began: then the row's owner was replaced before the race, which is invalid
+evidence, never a finding. The margin is derived from the packet
+(``idle_margins``): the descriptor's write time against the warm-up's send,
+and the warm-up's end against the read's.
+
+* **Admission wins** (``H-R13-admission``): the read is sent at once after
+  the warm-up and its profile page is held from before the idle threshold
+  until after it and the owner's connection grace (``OWNER_GRACE_SECONDS``),
+  so an idle decision that ignored the call in flight would have cut it. The
+  read must complete on the original owner, the browser's lifetime unchanged
+  across the hold, with no refusal in between; only afterwards does the
+  owner idle out, shown by its idle-exit line and its exit. K1: Direct's
+  conditional idle close must not close the browser under the held call, and
+  closes it only afterwards.
+* **Retirement wins** (``H-R13-retirement``): the row waits for positive
+  retirement, the owner's idle-exit line (and its exit, where seen), and
+  only then calls through the still-live frontend. The call either recovers
+  to a verified successor that this call started and that read the row's own
+  pages, or fails explicitly; both are safe and kept apart as branches
+  (``DELIVERED``, ``FAILED``). How the frontend classified the retired owner,
+  ``retiring`` or unanswered, is recorded from its own output when it says.
+  K1: the browser idled closed and the next call reopens it.
+
+**Turnover** (daemon only): the row sends the owner the authenticated
+stand-down with no body, the legacy unconditional form a newer build uses,
+reading the token from the row's own auth root and never recording it. Its
+30 s drain and unknown-outcome answer are the contract's policy, so K1 is
+recorded not applicable (``K1_NOT_APPLICABLE``). These lanes turn over an
+owner of this build and do not discharge W6, the upgrade of an
+older-protocol owner (``W6_NOT_DISCHARGED``).
+
+* **Drain** (``H-TURNOVER-drain``): admitted held work, released well inside
+  the drain, completes normally; the owner then stands down, cutting nothing.
+* **Refused** (``H-TURNOVER-refused``): with the drain still running, a new
+  read is refused and recovered to a successor, or fails explicitly, and
+  never runs on the retiring owner: none of its pages before that owner is
+  seen gone.
+* **Cut** (``H-TURNOVER-cut``): two held pages, each below the gate's
+  deadline, carry the read past the drain. The owner cuts it, and the caller
+  gets ``outcome_unknown`` with ``retry_safe`` false; nothing of the read goes
+  on after the cut, and it is never replayed.
+* **Queued** (``H-TURNOVER-queued``): as cut, with a second read sent before
+  the stand-down and queued behind the held one. Cut before its body began,
+  it gets the owner's signed not-run refusal and is recovered to a successor
+  (or fails explicitly), told apart from the begun read's unknown outcome.
+
+Every attempt the frontend reports in its own output becomes an ``attempt``
+event; nothing is counted from browser navigations. A deadline at a gate, a
+retirement never seen, a stand-down never answered, a cut never made or a
+reading taken out of its window is invalid evidence (``INVALID``), apart
+from a finding. K2 is recorded not applicable for every row here.
+
+The scripts run on a ``harness.RowContext`` with its ``race`` seams; nothing
+here reads a process, and the verdicts read the raw record alone, so each can
+be replayed from the published packet.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import re
+import time
+from collections.abc import Callable, Mapping, Sequence
+from dataclasses import dataclass
+from typing import TYPE_CHECKING, Any
+
+from differential.call_loss import (
+    CALIBRATION_IDLE_TIMEOUT_SECONDS,
+    ENTRY_SECONDS,
+    EXPECTED_SECTIONS,
+    GATE_END_SECONDS,
+    INVALID,
+    PERSON_TOOL,
+    _browsers_of,
+    _entered_or_ended,
+    _members,
+    _phase,
+    _read_nothing,
+    _read_of,
+    _release_at,
+    _sleep_until,
+)
+from differential.host_comparison import (
+    _of_launch,
+    host_problems,
+    owner_launches,
+    same_lifetime,
+)
+from differential.synthetic_origin import (
+    DEADLINE,
+    GATE_DEADLINE_SECONDS,
+    PEER_GONE,
+    RELEASED_BY_ROW,
+    SERVED,
+    Gate,
+    person_path,
```

**File**: `tests/differential/test_host_loss.py` (modified, +20/-0)
```diff
@@ -1052,6 +1052,26 @@ def test_windows_counts_a_venv_launcher_and_its_gate_as_the_owners_one_start():
     assert any("recorded apart as a successor" in p for p in problems), problems
 
 
+def test_an_election_candidate_that_read_nothing_is_no_successor():
+    """Measured on windows-latest: the warm-up's first owner launch, through
+    its own release gate, exited without a browser and a second launch became
+    the owner. That candidate read nothing; one that ran a browser could have,
+    and is a successor."""
+    record = _valid(ROW_H_R5)
+    candidate = _owner_lifetime(4956, 990.0)
+    candidate[4] = 994.3
+    gate = _owner_lifetime(8428, 989.5, digest="gate")
+    gate[4] = 994.3
+    record["owner_processes"].append(candidate)
+    record["gate_processes"] = [gate, _owner_lifetime(772, 994.5, digest="gate2")]
+    record["gate_processes"][1][4] = 1100.0
+    record["browser_roots"] = [[7676, 1000.6, None, _OWNER_PID, _OWNER_START]]
+    assert loss_problems(record, daemon=True) == []
+    record["browser_roots"].append([7600, 990.5, 994.0, 4956, 990.0])
+    problems = loss_problems(record, daemon=True)
+    assert any("recorded apart as a successor" in p for p in problems), problems
+
+
 def test_an_identified_owner_the_row_never_launched_is_no_hot_reuse():
     record = _valid(ROW_H_R4_EOF)
     record["owner_processes"] = []
```

**File**: `tests/differential/test_idle_race_rows.py` (added, +381/-0)
```diff
@@ -0,0 +1,381 @@
+"""H-R13 and the turnover lanes, native: a read racing the owner's retirement.
+
+**H-R13** (``retirement_race``), with its own idle timeout
+(``retirement_race.IDLE_RACE_TIMEOUT_SECONDS``), the same in every column:
+
+* **Admission wins**: the read is admitted and its profile page held past
+  the idle threshold and the owner's connection grace, then released; it
+  completes on the original owner and browser, which retire only afterwards.
+* **Retirement wins**: the owner's idle exit is seen first, then a call
+  through the still-live frontend reaches a verified successor and reads, or
+  fails explicitly. K1: Direct's browser idled closed and the call reopens it.
+
+Each in K1 frozen (the pinned baseline, Direct), K3 (this checkout through
+the shared owner) and K0 (K3 again, valid on its own and reading as K3 did,
+with both safe branches of retirement-wins projected alike). K3 is held to
+K1 on O1 to O4 (``compare_to_direct``) from two valid records
+(``retirement_race.comparison_refusals``). K2 is not applicable
+(``retirement_race.K2_NOT_APPLICABLE``). The margins the idle timeout left
+are printed from each record (``retirement_race.idle_margins``).
+
+**Turnover lanes**, daemon only: the row asks the identified owner to stand
+down with the product's bodyless request, then judges the drain, new work
+refused, a read cut past the drain and a queued read cut before it began
+(``retirement_race.turnover_problems``). K3 and K0 run; K1 is a counted skip
+with the contract's reason, a policy and not parity
+(``retirement_race.K1_NOT_APPLICABLE``), and K2 is not applicable. These
+lanes do not discharge W6.
+
+Native, like ``test_call_loss_rows``: only where CI opted in after trusting
+the CA, never under xdist, in file order, with only passing results recorded
+for the comparisons. CI runs each row in a step of its own, chosen by
+keyword: ``admitted``, ``idled_out``, and ``turns_over and <lane>``.
+"""
+
+from __future__ import annotations
+
+import os
+from collections.abc import Iterator
+from pathlib import Path
+from typing import Any
+
+import pytest
+
+from differential.baseline import (
+    BASELINE_DIR_ENV,
+    Runtime,
+    prepare_baseline,
+    remove_baseline,
+)
+from differential.events import EventLog
+from differential.harness import (
+    RowResult,
+    RowVector,
+    compare_to_direct,
+    default_browsers_path,
+    measure_host_quit_row,
+    repeat_verdict,
+)
+from differential.retirement_race import (
+    K1_NOT_APPLICABLE,
+    K2_NOT_APPLICABLE,
+    ROW_ADMISSION,
+    ROW_CUT,
+    ROW_DRAIN,
+    ROW_QUEUED,
+    ROW_REFUSED,
+    ROW_RETIREMENT,
+    comparison_refusals,
+    idle_margins,
+    semantic_differences,
+)
+from differential.synthetic_origin import (
+    OPT_IN_ENV,
+    EgressProxy,
+    SyntheticOrigin,
+    fence_breaches,
+)
+from linkedin_mcp_server.config import reset_config
+
+pytestmark = [
+    pytest.mark.differential_browser,
+    pytest.mark.xdist_group("browser_runtime"),
+    pytest.mark.skipif(
+        os.environ.get(OPT_IN_ENV) != "1",
+        reason=(
+            f"native differential row: needs a per-run test CA that only a "
+            f"disposable CI runner trusts, so it runs only where the CI step "
+            f"sets {OPT_IN_ENV}=1 after installing that CA. Do not set it "
+            f"locally."
+        ),
+    ),
+]
+
+#: Valid results measured so far in this process, by row and column.
+_VECTORS: dict[str, RowVector] = {}
+_RECORDS: dict[str, dict[str, Any]] = {}
+
+
+@pytest.fixture(scope="module")
+def baseline_runtime(tmp_path_factory) -> Iterator[Runtime]:
+    configured = os.environ.get(BASELINE_DIR_ENV)
+    directory = Path(configured) if configured else tmp_path_factory.mktemp("baseline")
+    yield prepare_baseline(directory)
+    if not configured:
+        remove_baseline(directory)
+
+
+async def _run(
+    row: str,
+    experiment: str,
+    *,
+    daemon: bool,
+    profile: Path,
+    egress: tuple[SyntheticOrigin, EgressProxy],
+    log: EventLog,
+    monkeypatch: pytest.MonkeyPatch,
+    runtime: Runtime | None = None,
+) -> RowResult:
+    if os.environ.get("PYTEST_XDIST_WORKER"):
+        pytest.fail("the native rows run without xdist; one process owns a packet")
+    breaches = fence_breaches()
+    if breaches:
+        pytest.fail(
+            f"the hosts file does not send these names to loopback only: "
+            f"{breaches}; stopping before a browser starts"
+        )
+    _, proxy = egress
+    # A candidate row stages in this process through the product's import
+    # path; a frozen one stages in the baseline's interpreter instead.
+    monkeypatch.setenv("PLAYWRIGHT_BROWSERS_PATH", str(default_browsers_path()))
+    monkeypatch.setenv("PROXY_SERVER", proxy.url)
+    reset_config()
+    key = "K1-frozen" if runtime is not None else experiment
+    result = await measure_host_quit_row(
+        profile=profile,
+        experiment=experiment,
+        daemon=daemon
```

**File**: `tests/differential/test_retirement_race.py` (added, +2342/-0)
```diff
@@ -0,0 +1,2342 @@
+"""Calls racing the owner's retirement: the lines read, the stand-down, the
+verdicts and the rows' wiring.
+
+No browser. The **lines** the rows look for are produced by the product's
+own code, the frontend's middleware and the owner's serving loop, and read
+back through the rows' parsers. The **stand-down** goes through the harness's
+sender against a recording transport. The **verdicts** start from an explicit
+valid record of each row and change one observation at a time. The
+**wiring** runs the real row entry on modelled actors with a host double
+whose reads are real requests to a real origin, so each script arms, waits
+for and releases a real gate, and in daemon mode asks a modelled owner to
+stand down.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import logging
+import threading
+import time
+from collections.abc import Callable
+from pathlib import Path
+from types import SimpleNamespace
+from typing import Any, cast
+from unittest.mock import MagicMock
+
+import httpx2
+import psutil
+import pytest
+
+from differential import harness, retirement_race
+from differential.call_loss import EXPECTED_SECTIONS, INVALID, PERSON_TOOL
+from differential.harness import RETURNED, measure_host_quit_row
+from differential.retirement_race import (
+    AFTER,
+    DELIVERED,
+    FAILED,
+    IDLE_RACE_TIMEOUT_SECONDS,
+    K1_NOT_APPLICABLE,
+    K2_NOT_APPLICABLE,
+    NO_SILENT_CUT,
+    OWNER_GRACE_SECONDS,
+    QUEUED,
+    ROW_ADMISSION,
+    ROW_CUT,
+    ROW_DRAIN,
+    ROW_QUEUED,
+    ROW_REFUSED,
+    ROW_RETIREMENT,
+    SECOND_USERNAMES,
+    SILENT,
+    TURNOVER_CASES,
+    TURNOVER_DRAIN_SECONDS,
+    TURNOVER_IDLE_TIMEOUT_SECONDS,
+    UNANSWERED,
+    USERNAMES,
+    W6_NOT_DISCHARGED,
+    attempts_in,
+    branch,
+    call_classification,
+    comparison_refusals,
+    idle_margins,
+    idle_problems,
+    invalid_evidence,
+    owner_log_reading,
+    semantic_differences,
+    semantics,
+    turnover_problems,
+)
+from differential.synthetic_origin import (
+    DEADLINE,
+    GATE_DEADLINE_SECONDS,
+    PEER_GONE,
+    RELEASED_BY_ROW,
+    RELEASED_BY_TEARDOWN,
+    SERVED,
+    person_path,
+)
+from differential.test_call_loss import (  # noqa: F401 - fixtures
+    _CalibrationScene,
+    certificates,
+    origin,
+    owned,
+)
+from differential.test_preservation_gate import (  # noqa: F401 - fixtures
+    _Watcher,
+    profile,
+)
+
+MS = 1_000_000
+
+
+def _messages(caplog) -> list[str]:
+    return [record.getMessage() for record in caplog.records]
+
+
+# --- The lines the rows read, as the product writes them ----------------------------
+
+
+def _attachment(tmp_path: Path, port: int = 51234) -> Any:
+    from linkedin_mcp_server.config.schema import AppConfig
+    from linkedin_mcp_server.daemon import Attachment
+    from linkedin_mcp_server.daemon_descriptor import build, new_instance_id, new_token
+
+    directory = tmp_path / "profile"
+    directory.mkdir(exist_ok=True)
+    config = AppConfig()
+    config.browser.user_data_dir = str(directory)
+    token = new_token()
+    descriptor = build(
+        instance_id=new_instance_id(),
+        package_version="4.20.1",
+        runtime_id="test-runtime",
+        profile=directory,
+        host="127.0.0.1",
+        port=port,
+        path="/mcp",
+        token=token,
+        config=config,
+        log_path=tmp_path / "owner.log",
+    )
+    return Attachment(descriptor=descriptor, token=token)
+
+
+def _beating(monkeypatch, answer: Callable[[], Any]) -> None:
+    from linkedin_mcp_server.daemon_proxy import FrontendCallHeartbeatMiddleware
+
+    async def beat(_attachment: Any, _call_id: str) -> Any:
+        return answer()
+
+    monkeypatch.setattr(FrontendCallHeartbeatMiddleware, "_beat", staticmethod(beat))
+
+
+async def _preflight_lines(monkeypatch, caplog, tmp_path, answer) -> list[str]:
+    from linkedin_mcp_server.daemon_proxy import FrontendCallHeartbeatMiddleware
+
+    _beating(monkeypatch, answer)
+    attachment = _attachment(tmp_path)
+    with caplog.at_level(logging.INFO, logger="linkedin_mcp_server.daemon_proxy"):
+        await FrontendCallHeartbeatMiddleware(MagicMock())._preflight(
+            attachment, "v1." + "0" * 32
+        )
+    return _messages(caplog)
+
+
+async def test_a_retiring_owners_preflight_refusal_reads_as_retiring(
+    monkeypatch, caplog, tmp_path
+):
+    from linkedin_mcp_server.daemon_descriptor import PROTOCOL_VERSION
+
+    attachment = _attachment(tmp_path)
+    instance = attachment.descriptor.instance_id
+
+    def refused() -> Any:
+        return httpx2.Response(
+            409,
+            json={
+                "daemon": "retiring",
+                "protocol": PROTOCOL_VERSION,
+                "instance": instance,
+            },
+        )
+
+    from linkedin_mcp_server.daemon_proxy import FrontendCallHeartbeatMiddleware
+
+    _beating(monkeypatch, refused)
+    with caplog.at_level(logging.I
```

#### Recent Merged Pull Requests:
- **PR #1245** (2026-10-06): fix(navigation): Time a goto from its request (@stickerdaniel)
- **PR #1241** (2026-10-05): test(differential): Record why a first navigation stalls (@stickerdaniel)
- **PR #1240** (2026-10-05): fix(browser): Restart a browser that stopped (@stickerdaniel)
- **PR #1239** (2026-10-05): test(guardian): Observe the guardian exit before the lease (@stickerdaniel)
- **PR #1238** (2026-10-05): docs(readme): Name the limits in the Cadenza banner (@stickerdaniel)
- **PR #1237** (2026-10-05): test(differential): Compare only the close path (@stickerdaniel)
- **PR #1235** (2026-10-05): fix(navigation): Refuse a landing off LinkedIn (@stickerdaniel)
- **PR #1234** (2026-10-05): fix(jobs): Stop the sidebar scroll on cancel (@stickerdaniel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

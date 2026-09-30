# Forensic Learning Record (Deep Inspection): stickerdaniel/linkedin-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/stickerdaniel-linkedin-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:33:41.145Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stickerdaniel/linkedin-mcp-server`
- **Description**: Open-source MCP server for LinkedIn. Give Claude and any MCP-compatible AI agent access to profiles, companies, jobs, and messages.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3681 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `linkedin_mcp_server/__init__.py`
```
# src/linkedin_mcp_server/__init__.py
"""
LinkedIn MCP Server package.

A Model Context Protocol (MCP) server that provides LinkedIn integration capabilities
for AI assistants. This package enables secure LinkedIn profile, company, and job
data scraping through a standardized MCP interface.

Key Features:
- Secure LinkedIn authentication via session files
- LinkedIn profile, company, and job data scraping
- MCP-compliant server implementation using FastMCP
- Playwright browser automation with session persistence
- Layered configuration system with secure credential storage
- Docker containerization for easy deployment
- Claude Desktop MCP Bundle (MCPB, formerly DXT) support

Architecture:
- Clean separation between authentication, driver management, and MCP server
- Singleton pattern for browser session management
- Comprehensive error handling and logging
- Cross-platform compatibility (macOS, Windows, Linux)
"""

from importlib.metadata import PackageNotFoundError, version

from linkedin_mcp_server.greenlet_runtime import explain_a_missing_runtime

# Before anything reaches patchright, where the failure would otherwise surface
# as a bare DLL error with nothing pointing at its cause. Both entry paths, the
# console script and ``python -m``, import this module first.
explain_a_missing_runtime()

try:
    __version__ = version("mcp-server-linkedin")
except PackageNotFoundError:
    try:
        # Fallback for environments installed under the pre-rename name
        __version__ = version("linkedin-scraper-mcp")
    except PackageNotFoundError:
        __version__ = "0.0.0.dev"  # Running from source without install

```

### Core Architecture Module: `linkedin_mcp_server/__main__.py`
```
#!/usr/bin/env python3
"""Entry point for linkedin-mcp-server command."""

from linkedin_mcp_server.cli_main import main

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `linkedin_mcp_server/authentication.py`
```
"""
Authentication logic for LinkedIn MCP Server.

Handles LinkedIn session management with persistent browser profile.
"""

import logging
from pathlib import Path

from linkedin_mcp_server.session_state import (
    clear_auth_state as clear_all_auth_state,
    get_source_profile_dir,
    portable_cookie_path,
    profile_exists,
    source_state_path,
    load_source_state,
)
from linkedin_mcp_server.exceptions import CredentialsNotFoundError

logger = logging.getLogger(__name__)


def get_authentication_source() -> bool:
    """
    Check if authentication is available via persistent profile.

    Returns:
        True if profile exists

    Raises:
        CredentialsNotFoundError: If no authentication method available
    """
    profile_dir = get_source_profile_dir()
    cookies_path = portable_cookie_path(profile_dir)
    source_state = load_source_state(profile_dir)
    if profile_exists(profile_dir) and cookies_path.exists() and source_state:
        logger.info("Using source profile from %s", profile_dir)
        return True

    if profile_exists(profile_dir) or cookies_path.exists():
        raise CredentialsNotFoundError(
            "LinkedIn source session metadata is missing or incomplete.\n\n"
            f"Expected source metadata: {source_state_path(profile_dir)}\n"
            f"Expected portable cookies: {cookies_path}\n\n"
            "Run with --login to create a fresh source session generation."
        )

    raise CredentialsNotFoundError(
        "No LinkedIn source session found.\n\n"
        "Options:\n"
        "  1. Run with --login to create a source browser profile (recommended)\n"
        "  2. Run with --no-headless to login interactively\n\n"
        "For Docker users:\n"
        "  Create the mounted profile with --login --login-viewer, or create it "
        "on the host with --login.\n"
        "  Mount it into Docker: -v ~/.linkedin-mcp:/home/pwuser/.linkedin-mcp"
    )


def clear_auth_state(profile_dir: Path | None = None) -> bool:
    """Clear source session artifacts and all derived runtime sessions."""
    return clear_all_auth_state(profile_dir or get_source_profile_dir())

```

### Core Architecture Module: `linkedin_mcp_server/bootstrap.py`
```
"""Managed runtime bootstrap for browser setup and LinkedIn login."""

from __future__ import annotations

import asyncio
import atexit
import codecs
from collections import deque
from collections.abc import AsyncIterator, Callable, Iterator, Mapping
import contextlib
import errno
from contextvars import ContextVar
from dataclasses import dataclass
from enum import Enum
import functools
import importlib.metadata
import json
import logging
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any, NoReturn, TypeVar
from urllib.parse import urlsplit

from fastmcp import Context
from rich.console import Console
from rich.markup import escape
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskID,
    TaskProgressColumn,
    TextColumn,
    TimeRemainingColumn,
    TransferSpeedColumn,
)
from rich.spinner import Spinner
from rich.theme import Theme

from linkedin_mcp_server.common_utils import secure_mkdir, secure_write_text, utcnow_iso
from linkedin_mcp_server.config import get_config
from linkedin_mcp_server.config.schema import is_loopback_host
from linkedin_mcp_server.drivers.browser import (
    close_browser,
    current_headless,
    get_profile_dir,
    set_headless,
)
from linkedin_mcp_server.exceptions import (
    AuthenticationBootstrapFailedError,
    AuthenticationInProgressError,
    AuthenticationStartedError,
    AuthMissingOnOwnerError,
    AuthStaleOnOwnerError,
    BrowserSetupFailedError,
    BrowserSetupInProgressError,
    DockerHostLoginRequiredError,
    LinkedInMCPError,
    OwnerStandingDownError,
    ProfileRootRefusedError,
)
from linkedin_mcp_server.private_state import (
    PrivateStateError,
    harden_created_directory,
    verify_no_extended_acl,
)
from linkedin_mcp_server.process_protocol import new_nonce
from linkedin_mcp_server.process_tree import (
    ProcessTreeError,
    WindowsJob,
    release_nonce,
    release_windows_gate,
    windows_gate_command,
)
from linkedin_mcp_server.profile_lease import (
    ProfileLeaseUnavailableError,
    _release_locked_fd,
    acquire_locked_fd,
)
from linkedin_mcp_server.server_role import (
    ServerRole,
    ask_this_process_to_stand_down,
    process_role,
    stand_down_reason,
)
from linkedin_mcp_server.session_state import (
    PeerSessionInPlaceError,
    _owned,
    auth_root_dir,
    get_runtime_id,
    load_source_state,
    portable_cookie_path,
    profile_exists,
    rotate_source_profile,
    source_state_path,
)
from linkedin_mcp_server.setup import UNGUARDED, interactive_login

logger = logging.getLogger(__name__)

_BROWSER_DIR = "patchright-browsers"
_BROWSER_INSTALL_METADATA = "browser-install.json"
_INVALID_STATE_PREFIX = "invalid-state-"
_INSTALL_METADATA_SCHEMA = 3

# Registry browser names mapped to on-disk dir prefixes for the binaries this
# server actually launches. ffmpeg/firefox/webkit are excluded — ffmpeg is only
# used for video recording (we don't), and chromium / chromium-headless-shell
# entries have no revisionOverrides, so we avoid patchright's per-platform
# special-prefix logic entirely.
_REGISTRY_NAME_TO_DIR_PREFIX = {
    "chromium": "chromium-",
    "chromium-headless-shell": "chromium_headless_shell-",
}

# Targets `patchright install chromium` writes beside the browser and never
# launches: ffmpeg for any argument resolving to a browser, winldd on win32
# only. Both land in this cache under the same byte ceiling (`resolveBrowsers`).
_FFMPEG_REGISTRY_NAME = "ffmpeg"
_WINDOWS_TOOL_REGISTRY_NAME = "winldd"

# On-disk dir prefix of the headless shell. Nothing launches it any more —
# every launch names ``channel="chromium"`` — but the prefix is still needed to
# recognise one in an install written before that change.
_SHELL_DIR_PREFIX = "chromium_headless_shell-"
# On-disk dir prefix of full Chrome for Testing: the browser this server runs,
# in either mode.
_FULL_DIR_PREFIX = "chromium-"

# Sidecar recording the cache state the retained-revision warning last named. It
# lives inside the configured browsers path so it travels with the cache it
# describes, and its name starts with a dot so patchright's own collector passes
# over it: that collector deletes directories whose name begins with a browser
# name, and link files under `.links`, and nothing else.
_CACHE_REPORT_MARKER = ".linkedin-mcp-cache-report.json"
_CACHE_REPORT_LOCK = ".linkedin-mcp-cache-report.lock"
_CACHE_REPORT_SCHEMA = 1

#: How much of the installer's output a failure message may quote. Patchright
#: embeds a whole non-200 response body in one error, and retries five times, so
#: an authenticated mirror answering with a page rather than a browser can emit
#: arbitrarily much. The tail is what says why it failed. Bounded by characters
#: as well as by count, because a fragment can itself be 64 KiB: two hundred of
#: those would put 12 MiB into an exception message and into ``last_error``.
_MAX_RETAINED_LINES = 200
_MAX_RETAINED_CHARS = 64 * 1024
#: Read size for the installer's pipe.
_READ_CHUNK = 64 * 1024
#: How much of a supervisor's startup diagnostics reaches its failure message.
#: Counted in characters and kept by ``_RedactedTail``, so the trim happens on
#: redacted text: on raw bytes it cut through whatever had arrived, and a cut
#: inside a long URL left a scheme-less remainder that no pattern here matches
#: and that ``BrowserSetupFailedError`` then carried to an MCP client.
_MAX_START_ERROR_CHARS = 8192
#: A run of output this long with no newline in it is emitted as one line rather
#: than buffered further. Bounds memory for output that never terminates a line.
_MAX_LINE_CHARS = 64 * 1024
#: Any userinfo in a URL, not only the ``user:password`` form. Patchright prints
#: the download URL it resolved, and ``PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`` may
#: carry credentials for an internal mirror. A bare ``//TOKEN@host`` is as much
#: a secret as a pair, and so are ``//TOKEN:@host`` and ``//:TOKEN@host``, which
#: a pattern requiring both halves lets through. Greedy to the *last* ``@``: a
#: password may contain one, and stopping at the first leaves the rest of it in
#: the line. Backslashes too, which Node normalises to slashes before
#: authenticating, so ``https:\\user:pw@host`` is a working credential.
_CREDENTIALS_IN_URL = re.compile(r"[/\\]{2}[^/\\\s]*@")
#: Any absolute HTTP(S) URL, from its scheme to the first whitespace.
#: Everything the origin does not name is replaced, because nothing here can
#: tell a public build path from a capability.
#:
#: The configured mirror is not the only URL that reaches this output.
#: Patchright's download client follows redirects and interpolates the location
#: it *ended* on into its timeout and its error, so a mirror answering 302 with
#: ``https://cdn.example/another-bearer-token/chromium.zip`` puts a path
#: credential nobody configured into the debug log, into the retained failure
#: that becomes ``BrowserSetupFailedError``, and from there into whatever an MCP
#: client shows. Redacting the configured prefix cannot reach that URL, and no
#: parameter or path-segment list ever will either: ``?token=``, ``?api_key=``,
#: ``?X-Amz-Signature=`` and bare path tokens are all in use. So the whole URL
#: below the origin goes, and the part that says which mirror answered stays.
#:
#: Whitespace is the only boundary. An apostrophe used to end the run as well,
#: to protect the ``'. URL: `` that closes a response body, and it cost the rest
#: of every URL holding one: Node keeps an apostrophe in a path and in userinfo
#: alike, and a redirect to ``https://cdn.example/browser's.zip?X-Amz-Signature=
#: SECRET`` therefore printed everything from the quote onwards. What the closing
#: marker actually needs is held back in ``_held_back_closer`` instead, which is
#: two characters rather than the whole tail.
_URL_IN_TEXT = re.compile(r"(?i)\b(https?):[/\\]{2}(\S*)")
#: Where an authority e
```

### Core Architecture Module: `linkedin_mcp_server/browser_downgrade.py`
```
"""Refuse to open a profile with a browser older than the one that wrote it.

Chromium records its own version in ``<user-data-dir>/Last Version`` on every
run and treats a later launch by an older binary as a downgrade
(``downgrade_manager.cc``). It does not stop there on macOS or Linux -- it
carries on and lets each store decide for itself. That is the failure mode this
module exists to prevent: a store whose *compatible* version has been raised
past what the older binary accepts is rejected with ``INIT_TOO_NEW`` and the
browser simply runs without it. Cookies are such a store, so the visible symptom
is a session that was never invalid disappearing, followed by a login nobody
asked for.

Measured, and worth keeping because it explains why the check is stricter than
Chromium's own: bundled Chromium 148 opened a profile last written by Chrome 150
with cookies, Local Storage, IndexedDB and Cache Storage all intact, because
Chrome 150 marks its Web Data schema as compatible back that far. It also
*rewrote* the version markers on the way out. So the compatibility is real, and
it is a snapshot -- it holds until one store raises its floor, and nothing warns
when that happens.

Every answer here fails open. Being unable to read a marker, name the binary or
parse a version is not evidence of a downgrade, and refusing to start a browser
on the strength of a missing file would turn a guard into an outage.

That choice costs more than it looks like it does, and the cost belongs here
rather than in a reviewer's head. Failing open once is not "we will catch it
next time": the older browser runs, and on its way out it rewrites `Last
Version` down to its own number (measured -- a launch on a profile marked
`1.0.0.0` left it reading `148.0.7778.96`). The evidence is gone, so every later
launch sees no downgrade even after whatever made the version unreadable is
fixed. It is still the right trade, because the alternative refuses working
setups on the strength of not knowing, but the guard is one-shot per profile
and nothing downstream can recover it.
"""

import logging
import os
import re
import subprocess
from pathlib import Path
from typing import NamedTuple

from linkedin_mcp_server.exceptions import BrowserDowngradeError

logger = logging.getLogger(__name__)

#: Written by Chromium itself, directly inside the profile directory, with a
#: space in the name and no extension. Not one of ours, so it is never created
#: or removed here -- only read.
LAST_VERSION_FILE = "Last Version"

#: A binary that will not answer ``--version`` must not hold up the launch.
#: Generous rather than tight: the measured cost is ~35 ms warm, and the only
#: thing a low bound would buy is a false "unknown" on a loaded machine.
_VERSION_TIMEOUT_SECONDS = 15.0

#: Three components at minimum, so a two-part build suffix ("built on Debian
#: 10.9") cannot be mistaken for a version. Real values have four:
#: ``148.0.7778.96``.
#:
#: Anchored to whitespace or the start of the line, which is the part that stops
#: the guard failing *closed*. A `CHROME_PATH` launcher script announcing itself
#: as `Chromium launcher v1.2.3` before it execs a browser would otherwise be
#: read as version `1.2.3` of a product called `Chromium launcher v` -- older
#: than every profile, and named plausibly enough to be compared. The user is
#: then told to run a newer browser, which is exactly what they were doing.
#: A version glued to a preceding word is not a version, so it is not one here.
_VERSION = re.compile(r"(?:^|(?<=\s))\d+(?:\.\d+){2,}")

#: Product names whose version numbers track Chromium milestones, and which are
#: therefore comparable against a `Last Version` that carries no product of its
#: own.
#:
#: Matched whole, not as a prefix, and that is the second half of the wrapper
#: defence rather than a stylistic choice. A `CHROME_PATH` launcher announcing
#: itself as `Chromium launcher 1.2.3` parses cleanly -- the version is
#: space-separated and the name starts with a word we know -- so a prefix scan
#: accepted it, compared `1.2.3` against the profile, and refused a browser
#: that was in fact newer. Measured. A name we have not seen costs the guard;
#: a name we half-recognise cost a launch nobody could recover.
#:
#: Chromium forks number themselves their own way: Vivaldi is on 7.x, and Edge
#: puts a build number an order of magnitude below Chrome's under the same
#: major. Pointing `CHROME_PATH` at either, against a profile the bundled
#: browser wrote, reads as a downgrade of hundreds of versions. It is not one,
#: and the message it would produce asks for something no build of that
#: browser will ever satisfy.
#:
#: This identifies the *running* binary, which is all `--version` can tell us,
#: and that bounds the rule: a profile written by a fork and then opened by the
#: bundled browser is still refused, because `Last Version` names no product.
#: That case is not repairable from here. Mixing two products over one profile
#: directory is outside what this server supports, and the error says to run
#: whichever browser produced that number again, which is the way out.
#:
#: An unrecognised name costs the guard, never a false refusal, which is the
#: right direction to be wrong in.
#:
#: **Both managed names are needed, because the supported range spans both.**
#: The two binaries name themselves differently, and which one a user runs
#: depends on the patchright they resolved and on their platform. From the
#: driver's own `DOWNLOAD_PATHS`:
#:
#: * at the lock (patchright 1.63.0, revision 1243) every target, Linux arm64
#:   included, is `cftUrl(...)`, which unpacks to `chrome-linux64/`,
#:   `chrome-linux-arm64/` or `Google Chrome for Testing.app` and reports
#:   `Google Chrome for Testing`
#: * through patchright 1.61.2, every supported `ubuntu*-arm64` and
#:   `debian*-arm64` was `chromium-linux-arm64.zip`, which unpacks to
#:   `chrome-linux/` and reports `Chromium`
#: * at the declared floor (patchright 1.55.0) every platform reports
#:   `Chromium`
#:
#: (`void 0` entries in that table name platforms patchright will not install
#: on at all; at the lock that includes `ubuntu20.04-*`, so they name nothing.)
#:
#: `uvx` and `pip` resolve the declared range fresh, so both names are in the
#: field on any given release even though the published images now agree.
#: Dropping either entry as redundant would silently turn the guard off for a
#: supported install, which is the mistake this paragraph exists to prevent.
#:
#: The version history behind those bullets.
#: Revision 1200 (patchright 1.57.0) moved macOS *and* Linux x64 to Chrome for
#: Testing together; only Linux arm64 stayed on Playwright's own build, and
#: that split lasted through patchright 1.61.2. Read it off `EXECUTABLE_PATHS`
#: rather than the download table: at 1.57.0 `linux-x64` is
#: `["chrome-linux64", "chrome"]` while `linux-arm64` is still
#: `["chrome-linux", "chrome"]`, carrying the driver's own `// non-cft build`
#: comment. At 1.63.0 `linux-arm64` is `["chrome-linux-arm64", "chrome"]` and
#: the comment is gone.
#:
#: Two separate events are easy to conflate here, and conflating them is how
#: the first version of this paragraph got the story wrong: *what* is packaged
#: changed at revision 1200, while *where it is fetched from* changed at
#: patchright 1.58.0, when `cftUrl(...)` first appears. That second move is not
#: a move to Google: `cftUrl` points at Playwright's own CDN in both eras,
#: `cdn.playwright.dev/chrome-for-testing-public/<version>/...` at 1.58.0 and
#: `cdn.playwright.dev/builds/cft/<version>/...` from 1.61.2 on. Nothing here ever
#: fetches from `storage.googleapis.com`.
#:
#: For anyone allowlisting egress, one host is not the whole answer. Every
#: plain `builds/...` entry goes through `PLAYWRIGHT_CDN_MIRRORS`, three hosts
#: tried in order: `cdn.playwright.dev/dbazure/download/playwright`,
#: `playwright.download.prss.microsoft.com/dbazure/download/playwright`, then
#: `cdn.playwrigh
```

### Core Architecture Module: `linkedin_mcp_server/browser_import/__init__.py`
```
"""Import a LinkedIn session from a locally logged-in Chromium-family browser.

The package exposes the discovery and extraction primitives eagerly. The
orchestrator entry point is imported lazily inside ``import_session_from_browser``
so that importing this package never pulls in ``drivers.browser`` (which imports
``config``). That avoids a config -> browser_import -> drivers.browser -> config
import cycle when ``config/schema.py`` references ``SUPPORTED_BROWSERS``.
"""

from __future__ import annotations

from collections.abc import Coroutine
from pathlib import Path
from typing import Any

from .discovery import SUPPORTED_BROWSERS, BrowserProfile, discover_profiles
from .extract import LinkedInCookie, extract_linkedin_cookies

__all__ = [
    "SUPPORTED_BROWSERS",
    "BrowserProfile",
    "LinkedInCookie",
    "discover_profiles",
    "extract_linkedin_cookies",
    "import_session_from_browser",
]


def import_session_from_browser(
    browser: str | None,
    *,
    user_data_dir: Path,
) -> Coroutine[Any, Any, bool]:
    """Lazy entry point; avoids importing drivers.browser at package import time."""
    from .orchestrate import import_session_from_browser as _impl

    return _impl(browser, user_data_dir=user_data_dir)

```

### Core Architecture Module: `linkedin_mcp_server/browser_import/discovery.py`
```
"""Locate Chromium-family browsers and their profiles (pure file I/O).

No cryptography and no Playwright here: this module only finds where a
browser's user-data root lives, which profiles it holds, and where each
profile's Cookies database is. Classification is locale-independent --
it keys off directory names (``Default`` / ``Profile N`` are never localized)
and ``Local State`` JSON structure, never display strings.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import cast

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BrowserProfile:
    """One discoverable browser profile with a resolvable Cookies database."""

    browser: str  # canonical registry key, see SUPPORTED_BROWSERS
    browser_label: str  # human label for TTY prompts: "Google Chrome"
    safe_storage_label: str  # macOS keychain service token: "Chrome", "Brave", ...
    profile_dir_name: str  # "Default" | "Profile 1" | ...
    display_name: str  # Local State info_cache "name" (TTY only, never logged)
    user_data_root: Path  # the dir containing "Local State"
    profile_path: Path  # user_data_root / profile_dir_name
    cookies_db: Path  # resolved Cookies path (Network/Cookies preferred, else Cookies)
    local_state_path: Path  # user_data_root / "Local State"
    # Full macOS keychain service name. Empty -> the default "<safe_storage>
    # Safe Storage" pattern. Set for forks that rename it (e.g. Helium uses
    # "Helium Storage Key", not the "... Safe Storage" suffix).
    mac_keychain_service: str = ""
    # macOS keychain ACCOUNT (-a). Stays the bare product name even when a fork
    # renames the SERVICE (e.g. Helium account "Helium" but service
    # "Helium Storage Key"). Empty -> defaults to safe_storage_label. The
    # account-first lookup is the primary key; mac_keychain_service is the
    # fallback.
    mac_keychain_account: str = ""
    # On-disk profile layout. "profiles" = standard Default/Profile N subdirs;
    # "flat" = cookies at the user-data root with no Default/ subdir (Opera and
    # Opera GX, see docs/browser-import-support.md).
    layout: str = "profiles"


# canonical_key -> per-OS layout. ``safe_storage`` is the macOS keychain service
# token (``<safe_storage> Safe Storage``); it is a distinct token from both the
# canonical key and the human label. Subpaths are relative to the per-OS base
# directory resolved in ``_os_base_dirs``.
SUPPORTED_BROWSERS: dict[str, dict[str, object]] = {
    "chrome": {
        "label": "Google Chrome",
        "safe_storage": "Chrome",
        "mac_subpath": "Google/Chrome",
        "linux_subpaths": ("google-chrome",),
        "linux_app_token": "chrome",
        "win_subpath": "Google/Chrome/User Data",
    },
    "chromium": {
        "label": "Chromium",
        "safe_storage": "Chromium",
        "mac_subpath": "Chromium",
        "linux_subpaths": ("chromium",),
        "linux_app_token": "chromium",
        "win_subpath": "Chromium/User Data",
    },
    "brave": {
        "label": "Brave",
        "safe_storage": "Brave",
        "mac_subpath": "BraveSoftware/Brave-Browser",
        "linux_subpaths": ("BraveSoftware/Brave-Browser",),
        "linux_app_token": "brave",
        "win_subpath": "BraveSoftware/Brave-Browser/User Data",
    },
    "edge": {
        "label": "Microsoft Edge",
        "safe_storage": "Microsoft Edge",
        "mac_subpath": "Microsoft Edge",
        "linux_subpaths": ("microsoft-edge",),
        "linux_app_token": "microsoft-edge",
        "win_subpath": "Microsoft/Edge/User Data",
    },
    "arc": {
        "label": "Arc",
        "safe_storage": "Arc",
        "mac_subpath": "Arc/User Data",
        # Arc has no stable Linux build; omit on Linux.
        "linux_subpaths": (),
        "win_subpath": "Arc/User Data",
    },
    "vivaldi": {
        "label": "Vivaldi",
        "safe_storage": "Vivaldi",
        "mac_subpath": "Vivaldi",
        "linux_subpaths": ("vivaldi",),
        "linux_app_token": "vivaldi",
        "win_subpath": "Vivaldi/User Data",
    },
    # Helium (imput.net): standard Chromium layout verified on macOS
    # (~/Library/Application Support/net.imput.helium, flat Default/Cookies,
    # multiple profiles). The keychain token is created on first cookie
    # encryption; "Helium" is the product name. No Linux build today.
    "helium": {
        "label": "Helium",
        "safe_storage": "Helium",
        # Helium renames the keychain item via change-keychain-name.patch:
        # service "Helium Storage Key" (NOT "Helium Safe Storage"), account
        # "Helium". Verified against imputnet/helium-macos.
        "mac_keychain_service": "Helium Storage Key",
        "mac_subpath": "net.imput.helium",
        "linux_subpaths": (),
        "win_subpath": "net.imput.helium/User Data",
    },
    # Standard-Chromium browsers. Paths and keychain labels cross-checked against
    # yt-dlp (yt_dlp/cookies.py) and HackBrowserData (browser/browser_darwin.go):
    # both use the standard "<label> Safe Storage" service. A wrong token still
    # fails closed (KeystoreUnavailableError -> "undecryptable"), and a root
    # without a Local State file is never treated as installed.
    # See docs/browser-import-support.md.
    "yandex": {
        "label": "Yandex",
        "safe_storage": "Yandex",
        "mac_subpath": "Yandex/YandexBrowser",
        "linux_subpaths": ("yandex-browser",),
        "linux_app_token": "yandex-browser",
        "win_subpath": "Yandex/YandexBrowser/User Data",
    },
    "whale": {
        "label": "Naver Whale",
        "safe_storage": "Whale",
        "mac_subpath": "Naver/Whale",
        "linux_subpaths": ("naver-whale",),
        "linux_app_token": "naver-whale",
        "win_subpath": "Naver/Naver Whale/User Data",
    },
    "coccoc": {
        "label": "Cốc Cốc",
        "safe_storage": "CocCoc",  # macOS keychain service is "CocCoc Safe Storage"
        # dir leaf "Coccoc" (lowercase c's) vs keychain label "CocCoc" (camel) is
        # intentional; cross-checked against HackBrowserData browser_darwin.go.
        "mac_subpath": "Coccoc",
        "linux_subpaths": (),  # no verified Linux build in the sources
        "linux_app_token": "",  # unused (no Linux build)
        "win_subpath": "CocCoc/Browser/User Data",
    },
    # Opera / Opera GX: flat layout (cookies at the user-data ROOT, no Default/
    # subdir). Local State still sits at the root, so the install gate is
    # unchanged. macOS keychain account "Opera" for BOTH (cross-checked:
    # HackBrowserData browser_darwin.go KeychainLabel "Opera", yt-dlp
    # cookies.py keyring_name "Opera"). Windows path is under %APPDATA%
    # (Roaming), which _os_base_dirs already searches. No Opera GX Linux build.
    "opera": {
        "label": "Opera",
        "safe_storage": "Opera",
        "mac_subpath": "com.operasoftware.Opera",
        "linux_subpaths": ("opera",),
        "linux_app_token": "opera",
        "win_subpath": "Opera Software/Opera Stable",
        "layout": "flat",
    },
    "opera_gx": {
        "label": "Opera GX",
        "safe_storage": "Opera",  # GX shares the "Opera" keychain account/label
        "mac_subpath": "com.operasoftware.OperaGX",
        "linux_subpaths": (),  # no Opera GX build on Linux
        "linux_app_token": "",
        "win_subpath": "Opera Software/Opera GX Stable",
        "layout": "flat",
    },
}


def _os_base_dirs() -> tuple[str, list[Path]]:
    """Return the current OS key and the base directories browsers live under."""
    if sys.platform == "darwin":
        return "mac", [Path.home() / "Library" / "Application Support"]
    if os.name == "nt":
        bases: list[Path] = []
        for env_var in ("LOCALAPPDATA", "APPDATA"):
            value = os.environ.get(env_var)
            if value:
                bases.append(Path(value))
        return "win", bases
    # Default to Linux/XDG layou
```

### Core Architecture Module: `linkedin_mcp_server/browser_import/extract.py`
```
"""Copy a browser's Cookies database and decrypt its LinkedIn cookies.

Owns the locked-DB copy (with WAL/SHM sidecars), the SQLite read with column
drift, the version branch, OS keystore access (one injectable accessor per OS),
the PBKDF2 iteration count, and the platform-aware v20 app-bound skip.

Cryptographic constants are fixed by Chromium's cookie format:
- salt ``saltysalt``; AES-128-CBC for macOS/Linux; IV = 16 space bytes.
- PBKDF2-HMAC-SHA1, 1003 iterations on macOS, 1 iteration on Linux, dklen 16.
- v10/v11 prefixes are 3 bytes. Store version >= 24 prepends a 32-byte
  ``SHA256(host_key)`` digest inside the plaintext on every platform (decrypt
  -> unpad -> strip-32 for CBC; decrypt -> strip-32 for Windows GCM).
- Windows v10 cookies are AES-256-GCM under a DPAPI-protected master key.
- v20 is Chrome 127+ app-bound encryption and needs OS elevation; we skip it.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from linkedin_mcp_server.browser_import.discovery import (
    SUPPORTED_BROWSERS,
    BrowserProfile,
)
from linkedin_mcp_server.exceptions import (
    KeystoreUnavailableError,
    V20EncryptedError,
)

logger = logging.getLogger(__name__)

_SALT = b"saltysalt"
_CBC_IV = b" " * 16
_KEY_LENGTH = 16
_MACOS_ITERATIONS = 1003
_LINUX_ITERATIONS = 1
_HOST_KEY_PREFIX_LEN = 32  # SHA256(host_key) prepended for store version >= 24
_HOST_KEY_PREFIX_MIN_VERSION = 24
_LINUX_FALLBACK_PASSWORD = b"peanuts"

# SQLite samesite int -> Playwright string. -1 (UNSPECIFIED) maps to Chromium's
# default of Lax. Documented and unit-tested.
_SAMESITE_MAP = {-1: "Lax", 0: "None", 1: "Lax", 2: "Strict"}

# Windows epoch offset: Chromium stores expires_utc as microseconds since
# 1601-01-01; subtract this many seconds to reach the unix epoch.
_WINDOWS_EPOCH_OFFSET_SECONDS = 11_644_473_600


@dataclass(frozen=True)
class LinkedInCookie:
    """A single decrypted LinkedIn cookie ready for Playwright injection."""

    name: str
    value: str  # decrypted plaintext (NEVER logged)
    domain: str
    path: str
    expires: float  # unix seconds; -1 for session cookies (Playwright sentinel)
    secure: bool
    http_only: bool
    same_site: str  # "Strict" | "Lax" | "None"

    def to_playwright(self) -> dict[str, object]:
        """Return the Playwright ``add_cookies`` shape.

        Domain is normalized so the existing ``_normalize_cookie_domain`` pass is
        a no-op. ``sameSite`` is always one of {"Strict", "Lax", "None"};
        ``expires`` is a float (or the -1 session sentinel).
        """
        return {
            "name": self.name,
            "value": self.value,
            "domain": self.domain,
            "path": self.path,
            "expires": self.expires,
            "secure": self.secure,
            "httpOnly": self.http_only,
            "sameSite": self.same_site,
        }


def _derive_cbc_key(password: bytes, *, iterations: int) -> bytes:
    """PBKDF2-HMAC-SHA1(password, salt='saltysalt', iterations, dklen=16).

    macOS callers pass ``iterations=1003``; Linux callers pass ``iterations=1``.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA1(),
        length=_KEY_LENGTH,
        salt=_SALT,
        iterations=iterations,
    )
    return kdf.derive(password)


def _macos_safe_storage_password(account: str, service: str) -> bytes:
    """Read the macOS Safe Storage password from the login keychain.

    Queries by ACCOUNT first (``-a <account>``): the account stays the bare
    product name even when a Chromium fork renames the keychain SERVICE (Helium's
    account is "Helium" but its service is "Helium Storage Key"). Falls back to
    the precise account+service pair when the account-only match is absent. The
    returned base64-looking string is used VERBATIM as the PBKDF2 password (it is
    NOT base64-decoded). Raises :class:`KeystoreUnavailableError` only when both
    queries fail. Logs only the tokens, never the password.
    """
    queries = (
        ["security", "find-generic-password", "-a", account, "-w"],
        ["security", "find-generic-password", "-a", account, "-s", service, "-w"],
    )
    last_returncode: int | None = None
    for argv in queries:
        try:
            result = subprocess.run(
                argv, capture_output=True, check=False, timeout=10.0
            )
        except subprocess.TimeoutExpired as exc:
            # macOS Tahoe can hang the keychain CLI indefinitely when the process
            # lost SecurityAgent context; check=False guards a non-zero exit, not
            # a hang. Bound it so the server never stalls on the first tool call.
            raise KeystoreUnavailableError(
                f"macOS keychain read for account {account!r} timed out"
            ) from exc
        except OSError as exc:
            raise KeystoreUnavailableError(
                f"Could not run the macOS security tool for {account!r}: {exc}"
            ) from exc
        if result.returncode == 0:
            # The keychain value is the base64 string itself, used as-is.
            return result.stdout.rstrip(b"\n")
        last_returncode = result.returncode
    raise KeystoreUnavailableError(
        f"macOS keychain has no Safe Storage key for account {account!r} / "
        f"service {service!r} (exit {last_returncode}; the browser may not have "
        "created it yet)."
    )


def _linux_safe_storage_password(app_token: str) -> bytes:
    """Read the Linux Secret Service password for ``app_token``, else ``peanuts``.

    ``app_token`` is the registry ``linux_app_token`` (e.g. "chrome", "chromium",
    "microsoft-edge"). A real keyring value yields v11 blobs; the ``peanuts``
    fallback yields v10.
    """
    try:
        result = subprocess.run(
            ["secret-tool", "lookup", "application", app_token],
            capture_output=True,
            check=False,
            timeout=10.0,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout
    except subprocess.TimeoutExpired:
        # An absent gnome-keyring or an unresponsive D-Bus session can hang
        # secret-tool forever; bound it like the macOS keychain read so the
        # import never stalls the server, then fall back to peanuts.
        logger.debug("secret-tool timed out; using peanuts fallback")
    except OSError:
        logger.debug("secret-tool unavailable; using peanuts fallback")
    return _LINUX_FALLBACK_PASSWORD


def _windows_master_key(local_state_path: Path) -> bytes:  # pragma: no cover
    """Decrypt the Windows DPAPI-protected AES-256 master key from Local State.

    Reads ``os_crypt.encrypted_key`` (base64), strips the 5-byte ``DPAPI``
    prefix, then ``CryptUnprotectData`` via ctypes. Untested on CI (the dev/CI
    host is macOS); see the module docstring. Exercised only via mocked unit
    tests (constraint 6).
    """
    import ctypes
    import ctypes.wintypes
    import json

    payload = json.loads(local_state_path.read_text())
    encrypted_key = base64.b64decode(payload["os_crypt"]["encrypted_key"])
    if encrypted_key[:5] != b"DPAPI":
        raise KeystoreUnavailableError("Local State key lacks the DPAPI prefix")
    blob_in = encrypted_key[5:]

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", ctypes.wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_char)),
        ]

    buffer_in = ctypes.create_string_buffer(blob_in, len(blob_in))
    blob_in_struct = DATA_BLOB(len(blob_in), buffer_in)
    blob_out = DATA_BLOB()
    crypt32 = ctypes.win
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1163** (2026-09-28): **fix(bootstrap): Recover from Windows temp ACLs**
  *Symptoms*: ## Problem  Windows AppContainer grants on `AppData` can block browser setup through the default temporary directory. Closes #908.  ## Solution  I retry under the user's home with the same ownership, ACL and pinning checks. Explicit directories remain authoritative. Failures explain `INSTALLER_TEMP_DIR`; existing permissions stay intact.  ## Verification  5,815 local tests, native Windows ACL cases, five killed mutations and pre-commit pass. The exact Codex sandbox was unavailable.  | README section | Before | After | | --- | --- | --- | | Installation, 920px | ![Before](https://github.com/user-attachments/assets/d2d83007-fc3e-4106-9304-d3918797143e) | ![After](https://github.com/user-attachments/assets/9e82950f-730a-46e7-8dbf-4ecc4046cfec) | | Options, 920px | ![Before](https://github.com/user-attachments/assets/7706ed5b-a8a2-4240-ac51-1ed46b6a7042) | ![After](https://github.com/user-attachments/assets/3244b96c-6eeb-42ae-b5ad-3a6eecdc3312) |  ## Synthetic prompt  > Recover from rejected Windows default installer temp permissions using a checked home fallback; preserve explicit overrides and security checks, add regression tests and recovery guidance.  Generated with GPT 6.0 Astra for implementation, review in Codex via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the s
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=70809150"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Adds fallback logic for Windows temp directory permissions\.  The PR appears safe to merge; the previously identified default-temp resolution failure is addressed.  <h3>Summary</h3>  The PR adds a Windows home-directory fallback when the default installer temp directory is refused, while retaining explicit-directory precedence and the existing ownership and ACL checks. - Adds fallback and failure-path tests, including native Windows ACL coverage. - Documents rec
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `2a153a7`  Macroscope's review found this PR approvable — This is a narrowly scoped Windows browser-installer recovery fix. It preserves the existing ACL and ancestry checks, leaves normal and explicitly configured paths unchanged, and adds targeted regression coverage plus troubleshooting documentation.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1162** (2026-09-28): **fix(bootstrap): Accept peer install metadata**
  *Symptoms*: ## Problem  Different Patchright versions sharing an auth root overwrite the same install metadata. The next tool call can fail with `BrowserSetupInProgressError` despite its required browser already being installed.  ## Solution  I use the running process's Chromium revision and completion marker for readiness, retaining metadata, path and ownership checks.  ## Verification  - Simulated peer metadata: unnecessary installer calls drop from one to zero. - Final non-browser suite: 5,500 passed, 119 skipped; initial timing failure passed reruns. - Focused regressions, fault injections, Ruff, ty and pre-commit passed.  Closes #1161.  ## Synthetic prompt  > Accept peer-written Patchright metadata when the current Chromium revision is complete, preserving readiness guards and adding regressions.  Generated with GPT-6 Astra for implementation and Claude Fable 5.1 for planning and GPT-6 Sol for research/review and GPT-6 Pro for review in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / end markers from your PR's description, Macroscope will append its summary at the bottom of the description. --> > [!NOTE] > ### Accept peer Patchright metadata in bootstrap readiness check > `_metadata_shape_ok()` in [bootstrap.py](https://github.com/stickerdaniel/linkedi
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=70817958"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Relaxes version check in browser setup metadata validation\.  The PR appears safe to merge; the required browser revision must still be complete before setup is skipped.  <h3>Summary</h3>  The PR allows browser setup to accept install metadata written by another Patchright version while retaining schema, path, and current-revision completion checks. - Adds regressions for peer metadata, missing markers, and setup not restarting when the required browser is prese
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `d0526e3`  Macroscope's review found this PR approvable — This is a narrowly scoped bootstrap bug fix that prevents needless browser setup when valid shared-cache metadata was written by another Patchright version. Current revision and completion-marker checks remain intact, and focused regressions cover peer metadata and setup non-restarts.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1147** (2026-09-27): **fix(auth): Stop on a restricted account**
  *Symptoms*: ## Problem  When LinkedIn restricts an account, it shows `/flagship-web/login/login-restriction/` after sign-in and asks for a government ID. I checked: the server read this as an ordinary missing session. `--login` kept waiting for a cookie that never comes, forever with a login timeout of 0, and tool calls would retire the session and open login windows again.  ## Solution  - **Detection:** the restriction route is detected by its path alone, so it works in any UI language, and raises a new `AccountRestrictedError`. It is not an `AuthenticationError`, so it never triggers re-login or session retirement. - **What the user sees:** tool calls, `--login`, `--status` and `--import-from-browser` report the restriction and how to get back in. After a restriction, no retry path opens another login window, the daemon frontend's repair included.  ## Verification  - I checked it live: on a restricted account, `--login` stopped as soon as the restriction page loaded, printed the restriction message and exited with 1. - Tests for each guard; each fails when its guard is removed. - `uv run pytest -n 4`: 5534 passed.  ## Synthetic prompt  > Detect LinkedIn's account-restriction route by path, report it as its own error without re-login or session retirement, and keep every login retry path from reopening a login window after it.  Generated with Claude Opus 5.5 for implementation in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only 
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=70173295"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Adds detection and handling for LinkedIn account restrictions\.  The PR appears safe to merge based on this review.  <h3>Summary</h3>  The PR detects LinkedIn’s account-restriction route and reports it without treating it as an expired session. - Login, tool, CLI, and daemon repair paths stop rather than retrying sign-in. - Tests cover restriction detection and the paths that would otherwise reopen a login window.  <h3>Diagram</h3>  ```mermaid %%{init: {'theme':
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — This changes the production authentication state machine: restricted-account detection now changes session handling, login-window creation, retry behavior, and tool replay across multiple paths. The added tests and focused scope reduce uncertainty, but authentication-sensitive runtime changes warrant human review.  <!-- approvability-rebase-note --> No code changes detected at `6179e2d`. Prior analysis still applies.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1137** (2026-09-26): **fix(connect): Recheck a sent invite before failing**
  *Symptoms*: ## Problem  `connect_with_person` could return `send_failed` for an invitation LinkedIn had recorded. It re-reads the profile right after Send, and that read can still render Connect. I checked: a call without a note returned `send_failed` ("the profile still exposes Connect"), and the same profile showed Pending half an hour later. The accept path already waits once for this.  ## Solution  After Send, re-read the profile once more after 3 seconds when the first read still exposes Connect, the same settle retry the accept path uses. Only a retry that shows the invitation pending, or already accepted, replaces the first read. `AGENTS.md` now counts up to seven actions for the call.  ## Verification  - New tests: a retry that shows the invitation pending returns `connected`; an unreadable or follow-only retry keeps `send_failed`. Each fails when its half is removed. - `ruff`, `ty` and the connection tests pass.  ## Synthetic prompt  > In `connect_with_person`, retry the post-send profile read once after 3 seconds before returning `send_failed`, like the accept path, and test it.  Generated with Claude Opus 5.5 for implementation in Claude Code via T3 Code.   <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / end markers from your PR's description, Macroscope will append its su
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=69922409"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Adds a retry loop to the connection invite flow\.  The PR appears safe to merge; no new actionable issue or outstanding previous finding remains.  <h3>Summary</h3>  The PR adds one delayed profile recheck before `connect_with_person` reports that a submitted invitation failed. - A retry showing Pending or an accepted connection can confirm the send; other retry states retain the initial result. - Tests cover confirmed and inconclusive retries, and the documented
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `8abdb10`  Macroscope's review found this PR approvable — This is a narrowly scoped connection-flow bug fix that adds a conditional settle retry and accepts only explicit pending or already-connected evidence. The added browser work is bounded to the ambiguous post-send case and is covered by focused tests.  <!-- approvability-rebase-note --> No code changes detected at `e17f6b4`. Prior analysis still applies.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1136** (2026-09-26): **fix(connect): Keep a failed note fill off the quota**
  *Symptoms*: ## Problem  `connect_with_person` with a note could return `custom_note_limit_reached` while note quota remained. After a failed fill, any Premium link in the dialog counted as a quota block, but LinkedIn shows that banner on this step regardless of quota. I checked: the dialog said three personalized invitations remained, the call returned `custom_note_limit_reached` without sending, and a second call sent the note.  ## Solution  After a failed fill, report the quota only when the textarea is gone, as the reveal step already does. Otherwise nothing is sent and the call returns `connect_unavailable`. The fill exception is now logged.  ## Verification  - Two tests, one per side of the gate; each fails when its half is removed. - `uv run pytest`: 4920 passed.  ## Synthetic prompt  > In `_submit_invite_dialog`, report `custom_note_limit_reached` after a failed note fill only when no textarea is mounted, log the fill exception, and test both cases.  <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / end markers from your PR's description, Macroscope will append its summary at the bottom of the description. --> > [!NOTE] > ### Fix `ConnectionActions._submit_invite_dialog` to not report note quota on failed fill > - After a failed invite-note fill, `_submit_invite_dialog` now chec
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=69890324"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 4/5</h2>  **[Medium risk]** Changes how the connection invite flow handles failed note fills\.  The PR is not ready to merge because a failed textarea recount can still hide a genuine quota block.  <h3>Summary</h3>  The PR changes failed invite-note fills so a visible note field prevents a Premium banner from being reported as a quota limit, and adds regression tests for the resulting paths. - Failed fills now leave the invitation unsent and return a generic failure when the note field rem
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — This is a narrowly scoped and well-tested correction to failed invite-note handling, with no schema or infrastructure changes. It nevertheless changes the externally visible interpretation of LinkedIn’s personalized-note quota and Premium entitlement state, so the entitlement-related behavior warrants human review.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1125** (2026-09-26): **fix(daemon): Keep custom browsers on Direct**
  *Symptoms*: ## Problem  The default-on contract keeps the shared browser to the bundled Chromium: a server started with `CHROME_PATH` must keep today's Direct behaviour. `daemon_would_be_used` accepted a custom executable, so an enabled daemon would have elected an owner for it.  ## Solution  `daemon_would_be_used` now returns False, with one info line, when `config.browser.chrome_path` is set by configuration, environment or CLI. The W-CHROME-PATH witness from #1115 becomes a guard with a bundled-browser control, and a CLI test checks that no profile lookup or election happens for a custom browser.  ## Verification  Disabling the gate fails the custom-browser witness and the CLI test while the bundled control passes. Daemon and CLI suites, ruff and ty pass.  Refs #606  ## Synthetic prompt  > Make `daemon_would_be_used` refuse the daemon when a custom browser executable is configured, per decision D in `docs/decisions/2026-09-26-daemon-default-on-contract.md`, and turn the W-CHROME-PATH witness into a guard with a bundled-browser control.  <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / end markers from your PR's description, Macroscope will append its summary at the bottom of the description. --> > [!NOTE] > ### Keep custom browsers (`CHROME_PATH` / `--chrome-path`) on direct server
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=69793959"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[Medium risk]** Fixes browser daemon sharing logic for custom executables\.  The PR appears safe to merge; no actionable new issue was established.  <h3>Summary</h3>  The PR keeps servers configured with a custom Chrome executable on the Direct browser path while leaving the bundled browser eligible for daemon sharing. - Adds a gate before profile lookup or owner election, with CLI and regression tests for both paths. - Adds a changelog fragment.  <h3>Diagram</h3>  ```mermaid %
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `f52de05`  Macroscope's review found this PR approvable — The change is a localized daemon eligibility fix that keeps explicitly configured custom browsers on the direct path while preserving bundled-browser sharing. Runtime impact is limited and directly covered by regression tests.  <!-- approvability-rebase-note --> No code changes detected at `17f8896`. Prior analysis still applies.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1122** (2026-09-26): **fix(daemon): Match Direct signals on owner exit**
  *Symptoms*: ## Problem  The default-on contract requires a daemon owner to send no signal that a Direct server would not send. Today an owner hands its guardian its own process group, sweeps registered groups by number when a browser will not close, and terminates a Windows Job member whose membership it could not determine.  ## Solution  - The guardian of an owner gets no owner group, like a Direct server that does not lead its group. - `_exit_hard` releases the election quietly and calls `os._exit`; the owner-only sweep is deleted. - An unanswered Job membership query leaves the process running and the drain unproven.  Three witness tests from #1115 now pass as guards.  ## Verification  Mutations reverting each change fail their witnesses. A real lock with a blocking or raising log handler still exits. Full suite passed (4564) before review fixes; daemon suites pass after.  Refs #606, #809  ## Synthetic prompt  > Make the daemon owner's exit paths send no signal a Direct server would not send, per `docs/decisions/2026-09-26-daemon-default-on-contract.md`, and turn the P1 witnesses in `tests/test_daemon_regression_witnesses.py` into passing guards.  <!-- Macroscope's pull request summary starts here --> <!-- Macroscope will only edit the content between these invisible markers, and the markers themselves will not be visible in the GitHub rendered markdown. --> <!-- If you delete either of the start / end markers from your PR's description, Macroscope will append its summary at the botto
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=69784557"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  **[High risk]** Changes process cleanup and daemon exit behavior\.  The PR appears safe to merge; no new actionable issue was identified.  <h3>Summary</h3>  The PR changes daemon-owner exit behavior to match Direct-server signaling. - Releases the election lock quietly before immediate exit, without an owner-side process sweep. - Prevents termination of Windows Job members when membership cannot be determined. - Updates regression witnesses and exit-path tests. The previous guard
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — The PR substantially changes daemon failure cleanup by removing owner-side process-tree termination and relying on guardians and Windows Jobs to clean up browsers. An unresolved concrete scenario may leave Chromium running after the guardian dies while a successor can reclaim the profile, so the shutdown design needs human review.  <!-- approvability-rebase-note --> No code changes detected at `d111e94`. Prior analysis still applies.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #1120** (2026-09-26): **[BUG] Renovate bumps ruff without its pre-commit hook**
  *Symptoms*: ### Packet Summary  Tool or installer: Renovate configuration (`renovate.json`), no server tool UI language and region: Not applicable What failed: #557 bumps `ruff==0.16.7` to `0.16.9` in `pyproject.toml` only; `.pre-commit-config.yaml` keeps `rev: v0.16.7`, so `tests/test_ruff_toolchain.py` fails. Related issues: #557 Verdict: Renovate's `pre-commit` manager is disabled by default, so the hook pin never moves.  ### Related Issues  Searched open and closed issues for `ruff pre-commit renovate`: none match.  ### Runtime  `main` at 3b0a659d, Renovate app. Not applicable: MCP client, browser mode.  ### LinkedIn Variant  Not applicable: repository configuration, LinkedIn is never loaded.  ### Evidence  `test_ruff_versions_match_across_the_toolchain` asserts the `pyproject.toml` pin, `uv.lock` and the pre-commit hook `rev` agree. #557 changes only the first two.  ### Reproduction  Check out #557's branch and run `uv run pytest tests/test_ruff_toolchain.py`. 

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

### Incident Patch 1: `bf021f11` (2026-09-28)
**Commit Message**: fix(bootstrap): Recover from Windows temp ACLs (#1163)

Recover Windows browser setup from refused default temporary directories using a checked home fallback. Preserve explicit overrides and existing ACL protections.

Closes #908.

**File**: `README.md` (modified, +2/-1)
```diff
@@ -238,6 +238,7 @@ while a container is running.
 - Check uv version: `uv --version` (should be 0.4.0 or higher)
 - On first run, `uvx` downloads all Python dependencies. On slow connections, uv's default 30s HTTP timeout may be too short. The recommended config above already sets `UV_HTTP_TIMEOUT=300` (seconds) to avoid this.
 - *Windows, `DLL load failed while importing _greenlet`*: move to greenlet 3.5.5 or newer, whose published Windows wheels carry the C++ runtime inside the extension again. A fresh `uvx` run resolves that on its own; an environment that pins its dependencies needs `uv lock --upgrade-package greenlet`. Only greenlet 3.3.1 through 3.5.4 need `MSVCP140.dll`, which neither the python.org installer nor the `uv`-managed builds carry, and a greenlet built from source can need it at any version. Where the version cannot be moved, the [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) supplies that DLL. Reported as [greenlet#525](https://github.com/python-greenlet/greenlet/issues/525), fixed in [greenlet#526](https://github.com/python-greenlet/greenlet/pull/526).
+- *Windows, browser setup reports an AppContainer or other permission grant under `AppData`*: the installer retries in a private directory under your home, with the same ownership and permission checks. If both locations are refused, create a dedicated directory outside the shared ancestry and set `INSTALLER_TEMP_DIR` or `--installer-temp-dir PATH` in the MCP server configuration. The configured directory must already exist and pass those checks; it is used without fallback. Keep existing AppContainer and shared-folder permissions intact.
 
 </details>
 
@@ -780,7 +781,7 @@ uv run -m linkedin_mcp_server
 - `--slow-mo MS` - Delay between browser actions (default: 0, useful for debugging)
 - `--viewport WxH` - Viewport size (default: 1280x720). Applies to windowless mode only; a headed launch uses the real window size.
 - `--chrome-path PATH` - Path to a Chrome/Chromium executable
-- `--installer-temp-dir PATH` - Parent directory for temporary files created during browser installation bootstrap (default: system temporary directory). Useful when system %TEMP% ancestry has non-standard ACLs or permissions.
+- `--installer-temp-dir PATH` - Existing parent directory for browser installer temporary files (environment: `INSTALLER_TEMP_DIR`). Defaults to the system temporary directory; on Windows, a permission refusal retries under your home. An explicit path disables fallback. Every location must pass the same ownership and permission checks.
 - `--proxy-server URL` - Route browser traffic through a proxy, as `scheme://host:port`. Set it up **before** `--login`; see [Using a proxy](#using-a-proxy).
 
 **Other:**
```

**File**: `changelog.d/1163.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Recover browser setup when Windows AppContainer grants block the default temp directory.
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +43/-9)
```diff
@@ -2003,6 +2003,15 @@ class _InstallerTemporaryRoot:
     pin: Any | None
 
 
+def _configured_installer_temp_dir() -> str | None:
+    configured_parent: str | None = None
+    with contextlib.suppress(Exception):
+        configured_parent = get_config().browser.installer_temp_dir
+    if configured_parent is None:
+        configured_parent = os.environ.get("INSTALLER_TEMP_DIR")
+    return configured_parent
+
+
 def _installer_temporary_parent() -> Path:
     """Return a temp parent whose pathname other local accounts cannot replace.
 
@@ -2012,11 +2021,7 @@ def _installer_temporary_parent() -> Path:
     is pinned, and the pins have to be held across the creation that happens
     after this function has already returned.
     """
-    configured_parent: str | None = None
-    with contextlib.suppress(Exception):
-        configured_parent = get_config().browser.installer_temp_dir
-    if configured_parent is None:
-        configured_parent = os.environ.get("INSTALLER_TEMP_DIR")
+    configured_parent = _configured_installer_temp_dir()
 
     if configured_parent:
         parent = Path(configured_parent).resolve(strict=True)
@@ -2069,7 +2074,6 @@ def _installer_temporary_parent() -> Path:
 
 
 def _create_installer_temporary_root() -> _InstallerTemporaryRoot:
-    parent = _installer_temporary_parent()
     pin: Any | None = None
     if os.name == "nt":
         # Not ``tempfile.mkdtemp``, which is why no Python version floor applies
@@ -2079,10 +2083,40 @@ def _create_installer_temporary_root() -> _InstallerTemporaryRoot:
         # 3.12.4 change to ``mkdtemp`` decides nothing on this path.
         from linkedin_mcp_server.windows_acl import create_owner_only_directory
 
-        path, pin = create_owner_only_directory(
-            parent, prefix="linkedin-mcp-installer-"
-        )
+        try:
+            parent = _installer_temporary_parent()
+            path, pin = create_owner_only_directory(
+                parent, prefix="linkedin-mcp-installer-"
+            )
+        except (OSError, PrivateStateError) as default_error:
+            remedy = (
+                "Set INSTALLER_TEMP_DIR or --installer-temp-dir to an existing "
+                "directory whose ancestry is controlled only by your account "
+                "or Windows system accounts. Keep existing AppContainer and "
+                "shared-folder permissions intact."
+            )
+            if _configured_installer_temp_dir():
+                raise PrivateStateError(f"{default_error}. {remedy}") from default_error
+            # AppData can carry sandbox grants even when the home itself is
+            # private. The fallback must pass the same pinned ancestry checks.
+            try:
+                fallback = Path.home().resolve(strict=True)
+                path, pin = create_owner_only_directory(
+                    fallback, prefix="linkedin-mcp-installer-"
+                )
+            except (OSError, RuntimeError) as fallback_error:
+                raise PrivateStateError(
+                    f"Browser installer temporary directory was refused: "
+                    f"{default_error}. Home fallback failed: {fallback_error}. {remedy}"
+                ) from fallback_error
+            logger.info(
+                "Using a private browser installer directory under %s because "
+                "the system temporary directory was refused: %s",
+                fallback,
+                default_error,
+            )
     else:
+        parent = _installer_temporary_parent()
         path = Path(tempfile.mkdtemp(prefix="linkedin-mcp-installer-", dir=parent))
     try:
         if os.name == "nt":
```

**File**: `tests/test_bootstrap.py` (modified, +170/-0)
```diff
@@ -5366,6 +5366,176 @@ def wait_until_empty(self, *, timeout: float) -> None:
         assert managed.assigned
 
 
+class TestWindowsInstallerTempFallback:
+    @pytest.fixture
+    def windows_temp(self, tmp_path, monkeypatch):
+        from linkedin_mcp_server import bootstrap, windows_acl
+
+        home = tmp_path / "home"
+        temporary = home / "AppData" / "Local" / "Temp"
+        temporary.mkdir(parents=True)
+        monkeypatch.setattr(bootstrap, "os", SimpleNamespace(name="nt", environ={}))
+        monkeypatch.setattr(bootstrap, "get_config", lambda: AppConfig())
+        monkeypatch.setattr(bootstrap.tempfile, "gettempdir", lambda: str(temporary))
+        monkeypatch.setattr(bootstrap.Path, "home", lambda: home)
+        real_lstat = Path.lstat
+
+        def windows_lstat(path):
+            details = real_lstat(path)
+            return SimpleNamespace(
+                st_mode=details.st_mode,
+                st_dev=details.st_dev,
+                st_ino=details.st_ino,
+                st_file_attributes=0,
+            )
+
+        monkeypatch.setattr(Path, "lstat", windows_lstat)
+        monkeypatch.setattr(windows_acl, "close_directory_pin", lambda _pin: None)
+        return home, temporary
+
+    @pytest.mark.parametrize("os_error", [False, True])
+    def test_rejected_default_temp_falls_back_to_home(
+        self, windows_temp, monkeypatch, caplog, os_error
+    ):
+        from linkedin_mcp_server import bootstrap, windows_acl
+        from linkedin_mcp_server.private_state import PrivateStateError
+
+        home, temporary = windows_temp
+        refusal = f"{home / 'AppData'} grants S-1-15-2-1 permission to remove or re-permission the installer path below it"
+
+        def create(parent, *, prefix):
+            if parent == temporary:
+                raise (
+                    PermissionError(refusal) if os_error else PrivateStateError(refusal)
+                )
+            target = parent / f"{prefix}example"
+            target.mkdir()
+            return target, object()
+
+        monkeypatch.setattr(windows_acl, "create_owner_only_directory", create)
+        with caplog.at_level(logging.INFO):
+            root = bootstrap._create_installer_temporary_root()
+
+        assert root.path.parent == home
+        assert root.path.is_dir()
+        assert root.pin is not None
+        assert list(temporary.iterdir()) == []
+        assert refusal in caplog.text
+
+    @pytest.mark.parametrize(
+        "error", [PermissionError("temp denied"), FileNotFoundError("temp removed")]
+    )
+    def test_default_parent_resolution_failure_falls_back(
+        self, windows_temp, monkeypatch, error
+    ):
+        from linkedin_mcp_server import bootstrap, windows_acl
+
+        home, _temporary = windows_temp
+
+        def unavailable_parent():
+            raise error
+
+        def create(parent, *, prefix):
+            target = parent / f"{prefix}example"
+            target.mkdir()
+            return target, object()
+
+        monkeypatch.setattr(
+            bootstrap, "_installer_temporary_parent", unavailable_parent
+        )
+        monkeypatch.setattr(windows_acl, "create_owner_only_directory", create)
+
+        root = bootstrap._create_installer_temporary_root()
+        assert root.path.parent == home
+        assert root.path.is_dir()
+
+    def test_safe_default_keeps_system_temp(self, windows_temp, monkeypatch):
+        from linkedin_mcp_server import bootstrap, windows_acl
+
+        _home, temporary = windows_temp
+
+        def create(parent, *, prefix):
+            target = parent / f"{prefix}example"
+            target.mkdir()
+            return target, object()
+
+        monkeypatch.setattr(windows_acl, "create_owner_only_directory", create)
+        root = bootstrap._create_installer_temporary_root()
+
+        assert root.path.parent == temporary
+        assert root.path.is_dir()
+
+    @pytest.mark.parametrize("configured", ["config", "environment"])
+
```

**File**: `tests/test_private_state.py` (modified, +50/-0)
```diff
@@ -867,6 +867,56 @@ def test_an_ordinary_inheriting_temp_layout_is_still_accepted(self, tmp_path: Pa
             close_directory_pin(pin)
             target.rmdir()
 
+    @windows_only
+    @pytest.mark.parametrize("home_is_shared", [False, True])
+    def test_installer_recovers_from_appcontainer_temp_ancestry(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, home_is_shared: bool
+    ):
+        """Reproduce #908 with real Windows ACLs, without changing the host's AppData."""
+        from linkedin_mcp_server import bootstrap, windows_acl
+        from linkedin_mcp_server.config.schema import AppConfig
+
+        home = tmp_path / "profile"
+        appdata = home / "AppData"
+        temporary = appdata / "Local" / "Temp"
+        temporary.mkdir(parents=True)
+        # ALL APPLICATION PACKAGES is a real AppContainer group. The report
+        # provides no SID or mask; Modify plus delete-child reproduces the
+        # reported ancestry refusal without claiming its exact desktop token.
+        granted = home if home_is_shared else appdata
+        subprocess.run(
+            ["icacls", str(granted), "/grant", "*S-1-15-2-1:(OI)(CI)(M,DC)"],
+            check=True,
+            capture_output=True,
+        )
+        before = {
+            path: windows_acl.describe_dacl(path) for path in (home, appdata, temporary)
+        }
+        with pytest.raises(PrivateStateError, match="S-1-15-2-1"):
+            windows_acl.create_owner_only_directory(temporary, prefix="installer-")
+
+        monkeypatch.setattr(bootstrap, "get_config", lambda: AppConfig())
+        monkeypatch.setattr(bootstrap.tempfile, "gettempdir", lambda: str(temporary))
+        monkeypatch.setattr(bootstrap.Path, "home", lambda: home)
+        if home_is_shared:
+            with pytest.raises(PrivateStateError, match="INSTALLER_TEMP_DIR"):
+                bootstrap._create_installer_temporary_root()
+        else:
+            root = bootstrap._create_installer_temporary_root()
+            try:
+                assert root.path.parent == home
+                windows_acl.verify_owner_only(root.path, directory=True)
+                payload = root.path / "download.zip"
+                payload.write_bytes(b"installer payload")
+                assert payload.read_bytes() == b"installer payload"
+            finally:
+                bootstrap._remove_installer_temporary_root(root)
+            assert not root.path.exists()
+
+        assert {path: windows_acl.describe_dacl(path) for path in before} == before
+        assert list(temporary.iterdir()) == []
+        assert list(home.iterdir()) == [appdata]
+
     @windows_only
     def test_owner_rights_in_the_chain_is_still_accepted(self, tmp_path: Path):
         """The entry CPython puts on every directory it creates for us.
```

---

### Incident Patch 2: `cee6ec2e` (2026-09-28)
**Commit Message**: fix(bootstrap): Accept peer install metadata (#1162)

## Problem

Different Patchright versions sharing an auth root overwrite the same
install metadata. The next tool call can fail with
`BrowserSetupInProgressError` despite its required browser already being
installed.

## Solution

I use the running process's Chromium revision and completion marker for
readiness, retaining metadata, path and ownership checks.

## Verification

- Simulated peer metadata: unnecessary installer calls drop from one to
zero.
- Final non-browser suite: 5,500 passed, 119 skipped; initial timing
failure passed reruns.
- Focused regressions, fault injections, Ruff, ty and pre-commit passed.

Closes #1161.

## Synthetic prompt

> Accept peer-written Patchright metadata when the current Chromium
revision is complete, preserving readiness guards and adding
regressions.

Generated with GPT-6 Astra for implementation and Claude Fable 5.1 for
planning and GPT-6 Sol for research/review and GPT-6 Pro for review in
Claude Code via T3 Code.


<!-- Macroscope's pull request summary starts here -->
<!-- Macroscope will only edit the content between these invisible
markers, and the markers themselves will not be visib

**File**: `changelog.d/1162.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Avoid needless browser setup when Patchright versions share the cache.
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +3/-2)
```diff
@@ -969,8 +969,9 @@ def _metadata_shape_ok() -> Path | None:
         return None
     if payload.get("browsers_path") != str(configured_browsers_path):
         return None
-    if payload.get("patchright_version") != _patchright_pkg_version():
-        return None
+    # A peer on another Patchright version can write this shared metadata.
+    # Readiness depends on this process's revision and completion marker,
+    # checked by browser_ready(), not on which package last ran the installer.
     return configured_browsers_path
 
 
```

**File**: `tests/test_bootstrap.py` (modified, +65/-9)
```diff
@@ -454,6 +454,7 @@ def _headless_config(self, monkeypatch):
 
     def test_false_when_metadata_absent(self, isolate_profile_dir, monkeypatch):
         _patch_targets_and_version(monkeypatch)
+        _materialize_install(browsers_path(), ["chromium-1217"])
         assert browser_setup_ready() is False
 
     def test_false_when_browsers_dir_missing(self, isolate_profile_dir, monkeypatch):
@@ -469,31 +470,86 @@ def test_true_with_complete_install(self, isolate_profile_dir, monkeypatch):
         _write_metadata(install_metadata_path(), bdir)
         assert browser_setup_ready() is True
 
-    def test_false_when_marker_missing(self, isolate_profile_dir, monkeypatch):
+    @pytest.mark.parametrize("metadata_version", [_PATCHRIGHT_VERSION, "1.42.0"])
+    def test_false_when_marker_missing(
+        self, isolate_profile_dir, monkeypatch, metadata_version
+    ):
         _patch_targets_and_version(monkeypatch)
         bdir = browsers_path()
         bdir.mkdir(parents=True, exist_ok=True)
         (bdir / "chromium-1217").mkdir()
         (bdir / "chromium_headless_shell-1217").mkdir()
         # No INSTALLATION_COMPLETE files
-        _write_metadata(install_metadata_path(), bdir)
+        _write_metadata(
+            install_metadata_path(), bdir, patchright_version=metadata_version
+        )
         assert browser_setup_ready() is False
 
+    @pytest.mark.parametrize("metadata_version", [_PATCHRIGHT_VERSION, "1.42.0"])
     def test_false_when_required_revision_missing(
-        self, isolate_profile_dir, monkeypatch
+        self, isolate_profile_dir, monkeypatch, metadata_version
     ):
         _patch_targets_and_version(monkeypatch)
         bdir = browsers_path()
         _materialize_install(bdir, ["chromium-1208", "chromium_headless_shell-1208"])
-        _write_metadata(install_metadata_path(), bdir)
+        _write_metadata(
+            install_metadata_path(), bdir, patchright_version=metadata_version
+        )
         assert browser_setup_ready() is False
 
-    def test_false_on_pkg_version_mismatch(self, isolate_profile_dir, monkeypatch):
-        _patch_targets_and_version(monkeypatch, version="1.42.0")
+    @pytest.mark.parametrize("metadata_version", ["1.40.0", "1.42.0"])
+    def test_ready_with_peer_metadata_and_own_revision(
+        self, isolate_profile_dir, monkeypatch, metadata_version
+    ):
+        _patch_targets_and_version(monkeypatch)
         bdir = browsers_path()
-        _materialize_install(bdir, ["chromium-1217", "chromium_headless_shell-1217"])
-        _write_metadata(install_metadata_path(), bdir, patchright_version="1.41.0")
-        assert browser_setup_ready() is False
+        _materialize_install(bdir, ["chromium-1217"])
+        _write_metadata(
+            install_metadata_path(), bdir, patchright_version=metadata_version
+        )
+        assert browser_setup_ready() is True
+
+    @pytest.mark.parametrize(
+        "version,revision,peer_version",
+        [("1.62.3", "1234", "1.63.0"), ("1.63.0", "1243", "1.62.3")],
+    )
+    async def test_peer_metadata_does_not_restart_setup(
+        self, isolate_profile_dir, monkeypatch, version, revision, peer_version
+    ):
+        from linkedin_mcp_server import bootstrap
+
+        _patch_inline_wait(monkeypatch, 0)
+        _patch_targets_and_version(
+            monkeypatch, targets={"chromium-": revision}, version=version
+        )
+        _make_auth_ready(isolate_profile_dir)
+        bdir = browsers_path()
+        _materialize_install(bdir, ["chromium-1234", "chromium-1243"])
+        installer = AsyncMock()
+        monkeypatch.setattr(bootstrap, "_run_browser_setup", installer)
+        monkeypatch.setattr(
+            bootstrap, "_schedule_retained_browser_revision_report", lambda: None
+        )
+        initialize_bootstrap("managed")
+
+        try:
+            async with asyncio.timeout(5):
+                for writer_version in (version, peer_version, version, peer_version):
+                   
```

---

### Incident Patch 3: `411b68f3` (2026-09-28)
**Commit Message**: fix(connection): Keep chat overlays out of the invite dialog (#1110)

## Summary

Exclude dialogs containing a contenteditable messaging composer from invite selection. Clarify that `connected` means the invitation was submitted and the re-read no longer exposes Connect; it does not mean the recipient accepted.

## Verification

The invite-dialog DOM tests, changelog tests, and required PR checks pass. No live check was run for the maintainer edits.

Closes #432.

Generated with Claude Opus 5.5 for the original fix in Claude Code and GPT-6 Sol for maintainer edits and review in Claude Code via T3 Code.

**File**: `changelog.d/1110.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Keep an open chat overlay from blocking connect_with_person invitations.
```

**File**: `linkedin_mcp_server/scraping/connection_actions.py` (modified, +6/-1)
```diff
@@ -43,7 +43,12 @@
 
 logger = logging.getLogger(__name__)
 
-_DIALOG_SELECTOR = 'dialog[open], [role="dialog"]'
+# A messaging overlay (a minimised chat bubble LinkedIn keeps open across
+# pages) is also a dialog. Its composer never belongs to an invite, and its
+# buttons would otherwise join the positional picks below: measured live in
+# September 2026, the last one was the chat's "Open send options" toggle.
+_NOT_MESSAGING = ':not(:has([contenteditable="true"]))'
+_DIALOG_SELECTOR = f'dialog[open]{_NOT_MESSAGING}, [role="dialog"]{_NOT_MESSAGING}'
 _DIALOG_PREMIUM_LINK_SELECTOR = (
     'dialog[open] a[href*="/premium/"], [role="dialog"] a[href*="/premium/"]'
 )
```

**File**: `linkedin_mcp_server/tools/person.py` (modified, +7/-0)
```diff
@@ -260,6 +260,13 @@ async def connect_with_person(
             note_not_supported, custom_note_limit_reached,
             connected, or accepted.
 
+            ``connected`` means this call submitted the invitation and the
+            re-read profile no longer exposes Connect; it does not mean a
+            1st-degree connection. The ``message`` names the state read after
+            the send, normally pending. ``pending`` means an invitation was
+            already outstanding before the call, and ``accepted`` means an
+            incoming invitation was accepted.
+
             When status is ``custom_note_limit_reached`` LinkedIn rejected
             personalized invite notes because the free note quota for the
             account is exhausted. The ``message`` is the raw Premium dialog
```

**File**: `tests/test_invite_dialog_dom.py` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+"""Invite-dialog submission against a real DOM with a chat overlay open.
+
+Measured on LinkedIn in September 2026: after a message send, LinkedIn keeps
+the conversation open as an overlay dialog on later pages, including the
+custom-invite deeplink, so two dialogs are open when the invite renders.
+"""
+
+from __future__ import annotations
+
+from typing import Any, cast
+
+import pytest
+from patchright.async_api import Page, async_playwright
+
+from linkedin_mcp_server.scraping.connection_actions import ConnectionActions
+from linkedin_mcp_server.scraping.navigation import PageNavigator
+from linkedin_mcp_server.scraping.session import ScrapingSession
+
+pytestmark = [
+    pytest.mark.browser_dom,
+    pytest.mark.xdist_group("browser_runtime"),
+]
+
+INVITE_DIALOG = """
+  <div role="dialog" id="invite">
+    <h2>Add a note to your invitation?</h2>
+    <button onclick="document.body.dataset.invite = 'note';
+      const note = document.createElement('textarea');
+      note.style.display = 'block';
+      document.getElementById('invite').insertBefore(note, this);
+      this.nextElementSibling.textContent = 'Send'">Add a note</button>
+    <button onclick="document.body.dataset.invite = 'sent';
+      const note = document.querySelector('#invite textarea');
+      document.body.dataset.note = note ? note.value : '';
+      document.getElementById('invite').remove()">Send without a note</button>
+  </div>
+"""
+
+CHAT_OVERLAY = """
+  <div role="dialog" id="chat">
+    <form class="msg-form">
+      <div role="textbox" contenteditable="true"
+           style="display:block;width:200px;height:30px"></div>
+      <button type="submit" disabled>Send</button>
+      <button type="button" class="msg-form__send-toggle"
+        onclick="document.body.dataset.chat = 'clicked'">Open send options</button>
+    </form>
+  </div>
+"""
+
+
+@pytest.fixture
+async def dom_page():
+    async with async_playwright() as p:
+        try:
+            browser = await p.chromium.launch(channel="chromium", headless=True)
+            page = await browser.new_page()
+        except Exception as exc:  # browser binary missing
+            pytest.skip(f"chromium unavailable: {exc}")
+        try:
+            yield page
+        finally:
+            await browser.close()
+
+
+def _actions(page) -> ConnectionActions:
+    async def unreachable(_username: str) -> dict[str, Any]:
+        raise AssertionError("the dialog cases never read a profile")
+
+    session = ScrapingSession(cast(Page, page))
+    return ConnectionActions(session, PageNavigator(session), unreachable)
+
+
+@pytest.mark.parametrize(
+    "body", [INVITE_DIALOG + CHAT_OVERLAY, CHAT_OVERLAY + INVITE_DIALOG]
+)
+async def test_invite_is_sent_past_an_open_chat_overlay(dom_page, body):
+    await dom_page.set_content(f"<!DOCTYPE html><html><body>{body}</body></html>")
+
+    submitted, note_sent, note_limit = await _actions(dom_page)._submit_invite_dialog(
+        None
+    )
+
+    assert (submitted, note_sent, note_limit) == (True, False, None)
+    assert await dom_page.evaluate("document.body.dataset.invite") == "sent"
+    assert await dom_page.evaluate("document.body.dataset.chat") is None
+
+
+async def test_chat_overlay_alone_is_not_an_invite_dialog(dom_page):
+    await dom_page.set_content(
+        f"<!DOCTYPE html><html><body>{CHAT_OVERLAY}</body></html>"
+    )
+
+    submitted, _, _ = await _actions(dom_page)._submit_invite_dialog(None)
+
+    assert submitted is False
+    assert await dom_page.evaluate("document.body.dataset.chat") is None
+
+
+async def test_invite_note_is_sent_past_an_open_chat_overlay(dom_page):
+    await dom_page.set_content(
+        f"<!DOCTYPE html><html><body>{INVITE_DIALOG}{CHAT_OVERLAY}</body></html>"
+    )
+
+    submitted, note_sent, note_limit = await _actions(dom_page)._submit_invite_dialog(
+        "Hello"
+    )
+
+    assert (submitted, note_sent, note_limit) == (True, True, None)
+    assert await dom_pa
```

---

### Incident Patch 4: `e6fea6b3` (2026-09-28)
**Commit Message**: fix(messaging): Report LinkedIn's Press Enter to Send preference (#1109)

## Summary

- With "Press Enter to Send" on, the composer renders no Send button,
only `msg-form__send-toggle`, and `send_message` returned a generic
`send_unavailable` (#C).
- The composer state reports that layout; the dry run and the send
return `enter_to_send_enabled` with the steps to switch to "Click Send
to send". Nothing is typed or clicked, so the result stays retry-safe.

## Verification

- Live: the composer probe on an account with the preference on found no
submit button and the toggle; after switching the preference the send
went through.
- New DOM test for both `confirm_send` values asserts the status,
`retry_safe`, an untouched editor and an unclicked toggle.
- Messaging and policy-trace suites green; ruff, ty and trace check
clean.

## Synthetic prompt

> send_message says the submit path is missing when the LinkedIn account
uses Press Enter to Send. Detect that layout and tell the caller how to
switch it, without typing or clicking anything.

Closes #1107.

Generated with Claude Opus 5.5 for a LinkedIn messaging fix in Claude
Code.


<!-- Macroscope's pull request summary starts here -->
<!-

**File**: `changelog.d/1109.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+send_message reports "Press Enter to Send" and explains how to switch that setting.
```

**File**: `linkedin_mcp_server/scraping/message_sender.py` (modified, +27/-0)
```diff
@@ -133,6 +133,9 @@
 _MESSAGE_SUBMIT_READY_TIMEOUT_MS = 1_000
 _MESSAGE_CLEANUP_TIMEOUT_SECONDS = 1.0
 
+# Narrow exception to the generic-selector rule for #1107: enterToSend uses
+# the send-toggle class only when the verified composer has no Send button.
+# If the class changes, confirmed sends remain unavailable.
 _MESSAGE_COMPOSER_INSPECT_JS = r"""
     const visible = element => {
         const visibility = element && getComputedStyle(element).visibility;
@@ -264,13 +267,19 @@
         const localScope = localScopes.find(scope => submitButtons(scope).length > 0)
             || localScopes[0];
         const buttons = submitButtons(localScope);
+        // With LinkedIn's "Press Enter to Send" preference the composer
+        // renders no Send button, only the send-options toggle.
+        const enterToSend = buttons.length === 0 && localScopes.some(scope =>
+            Array.from(scope.querySelectorAll('.msg-form__send-toggle')).some(visible)
+        );
         return {
             status: 'valid',
             editor,
             ancestorChain: localScopes,
             localScope,
             owner,
             buttons,
+            enterToSend,
             active: document.activeElement === editor,
             empty: !(editor.innerText || '').replace(/\s+/g, ' ').trim(),
             messageRoute: messageRoute(target),
@@ -721,6 +730,7 @@
             active: state.active === true,
             empty: state.empty === true,
             submitCount: state.buttons ? state.buttons.length : 0,
+            enterToSend: state.enterToSend === true,
             submitUsable: state.buttons?.length === 1 &&
                 !state.buttons[0].disabled &&
                 (state.buttons[0].getAttribute('aria-disabled') || '').toLowerCase()
@@ -1116,6 +1126,19 @@ def _profile_urn_from_compose_url(value: str, *, base: str | None = None) -> str
     return identifiers.pop()
 
 
+def _enter_to_send_result(url: str) -> dict[str, Any]:
+    """Report LinkedIn's "Press Enter to Send" preference as a user fix."""
+    return contracts.message_action_result(
+        url,
+        "enter_to_send_enabled",
+        "LinkedIn is set to 'Press Enter to Send', which hides the Send "
+        "button this tool clicks. In LinkedIn Messaging, open the '...' menu "
+        "next to 'Press Enter to Send', choose 'Click Send to send', then "
+        "retry. Nothing was sent.",
+        recipient_selected=True,
+    )
+
+
 def _message_page_url_is_safe(value: str, profile_urn: str) -> bool:
     parsed = _safe_linkedin_url(value)
     if parsed is None:
@@ -1602,6 +1625,8 @@ async def send_message(
                 "The local composer did not identify exactly the requested profile.",
             )
         recipient_selected = True
+        if state.get("enterToSend") is True:
+            return _enter_to_send_result(self._page.url)
 
         if not confirm_send:
             return contracts.message_action_result(
@@ -1643,6 +1668,8 @@ async def send_message(
                 "The verified message composer changed before text entry.",
                 recipient_selected=recipient_selected,
             )
+        if state.get("enterToSend") is True:
+            return _enter_to_send_result(self._page.url)
         if state.get("submitCount") != 1:
             return contracts.message_action_result(
                 self._page.url,
```

**File**: `linkedin_mcp_server/tools/messaging.py` (modified, +5/-1)
```diff
@@ -267,7 +267,11 @@ async def send_message(
         The recipient must be directly messageable from the profile page. If
         LinkedIn does not expose a normal Message action, use connect_with_person
         first, then retry send_message only after the connection request is
-        accepted. Recipient authorization comes from validating one
+        accepted. A ``status`` of ``enter_to_send_enabled`` means the account
+        has LinkedIn's "Press Enter to Send" preference on, which hides the Send
+        button; relay the returned instructions to the user, who switches it to
+        "Click Send to send" before retrying. The dry run (confirm_send False)
+        reports it too. Recipient authorization comes from validating one
         recipient-specific Message action carrying the target URN, then following
         its browser navigation and pinning the exact final route. Visible profile
         links or recipient URNs in the composer are optional corroboration; any
```

**File**: `tests/fixtures/scraping-policy/v1/message-cancelled.json` (modified, +6/-6)
```diff
@@ -171,7 +171,7 @@
       "call": "send_message",
       "kind": "wait_for_function",
       "operation": "message_composer_ready",
-      "program_digest": "1e738a03c39b",
+      "program_digest": "c92fc7560352",
       "section": "message",
       "timeout_ms": null
     },
@@ -183,7 +183,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "51178a7a46af",
+      "program_digest": "28f2c6ded1bf",
       "section": "message"
     },
     {
@@ -194,7 +194,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "51178a7a46af",
+      "program_digest": "28f2c6ded1bf",
       "section": "message"
     },
     {
@@ -208,7 +208,7 @@
       "call": "send_message",
       "kind": "evaluate_handle",
       "operation": "message_composer_owner",
-      "program_digest": "438ca7ee906d",
+      "program_digest": "57fa5bf0b247",
       "section": "message"
     },
     {
@@ -256,7 +256,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_confirmation_prepare",
-      "program_digest": "ef16538e4760",
+      "program_digest": "3d961c4e5130",
       "section": "message"
     },
     {
@@ -285,7 +285,7 @@
       "call": "send_message",
       "kind": "wait_for_function",
       "operation": "message_confirmation_ready",
-      "program_digest": "892d6d750f3f",
+      "program_digest": "e872ebcf24e1",
       "section": "message",
       "timeout_ms": null
     },
```

**File**: `tests/fixtures/scraping-policy/v1/message-composer-occupied.json` (modified, +3/-3)
```diff
@@ -171,7 +171,7 @@
       "call": "send_message",
       "kind": "wait_for_function",
       "operation": "message_composer_ready",
-      "program_digest": "1e738a03c39b",
+      "program_digest": "c92fc7560352",
       "section": "message",
       "timeout_ms": null
     },
@@ -183,7 +183,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "51178a7a46af",
+      "program_digest": "28f2c6ded1bf",
       "section": "message"
     },
     {
@@ -194,7 +194,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "51178a7a46af",
+      "program_digest": "28f2c6ded1bf",
       "section": "message"
     }
   ],
```

---

### Incident Patch 5: `a996e9fb` (2026-09-27)
**Commit Message**: fix(auth): Stop on a restricted account (#1147)

## Problem

When LinkedIn restricts an account, it shows
`/flagship-web/login/login-restriction/` after sign-in and asks for a
government ID. I checked: the server read this as an ordinary missing
session. `--login` kept waiting for a cookie that never comes, forever
with a login timeout of 0, and tool calls would retire the session and
open login windows again.

## Solution

- **Detection:** the restriction route is detected by its path alone, so
it works in any UI language, and raises a new `AccountRestrictedError`.
It is not an `AuthenticationError`, so it never triggers re-login or
session retirement.
- **What the user sees:** tool calls, `--login`, `--status` and
`--import-from-browser` report the restriction and how to get back in.
After a restriction, no retry path opens another login window, the
daemon frontend's repair included.

## Verification

- I checked it live: on a restricted account, `--login` stopped as soon
as the restriction page loaded, printed the restriction message and
exited with 1.
- Tests for each guard; each fails when its guard is removed.
- `uv run pytest -n 4`: 5534 passed.

## Synthetic prompt

> Detec

**File**: `changelog.d/1147.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A LinkedIn account restriction is now reported as such, with how to get back in, instead of as an expired session; the server no longer waits for a login that cannot complete or reopens login windows.
```

**File**: `docs/linkedin-auth-routes.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# LinkedIn auth and restriction routes
+
+The account-restriction route the server recognizes, and the observation
+behind it. The matching code lives in `core/auth.py`, which also lists the
+older not-signed-in routes (`/login`, `/checkpoint` and others) without a
+recorded observation here. A new restriction route is added here first, with
+its source and date.
+
+Only the path is compared. The pages are localized, so their text says nothing
+reliable about which one is showing.
+
+## Account restriction
+
+| Route | Seen | Source |
+|---|---|---|
+| `/flagship-web/login/login-restriction/` | 2026-09-27 | Live `--login` on a restricted account, in the Bengali UI ([#1147](https://github.com/stickerdaniel/linkedin-mcp-server/pull/1147)) |
+
+The page appeared right after the credentials were accepted, in place of the
+feed. It said the account's access was temporarily restricted and asked for a
+government-issued ID. It sets no `li_at` cookie, so a login that waits for one
+never ends. The server matches the route by its final path segments,
+`login/login-restriction`, which also covers it without the `flagship-web`
+prefix. That prefixless form has not been seen.
+
+A restricted account without a session is redirected to the ordinary `/login`
+route first. The restriction shows only after signing in, so a tool call with no
+session cannot detect it.
+
+No other restriction route has been observed.
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +52/-4)
```diff
@@ -374,6 +374,10 @@ class BootstrapState:
     #: and stubbed in as many tests, and threading an argument through all of
     #: them would change far more than the one thing that matters.
     login_supersedes: str | None | object = UNGUARDED
+    #: A login or import in this process ended on LinkedIn's restriction page.
+    #: No login can lift that, so none is started until a session reappears on
+    #: disk or a stale one is retired for a fresh login.
+    account_restricted: bool = False
 
 
 _state = BootstrapState()
@@ -3786,13 +3790,27 @@ async def _refresh_background_task_state() -> None:
             _state.last_error = "LinkedIn login bootstrap task was cancelled"
             logger.warning("LinkedIn login bootstrap task cancelled")
         except Exception as exc:
+            from linkedin_mcp_server.core.exceptions import AccountRestrictedError
+
             _state.auth_state = AuthState.FAILED
             _state.last_error = str(exc)
+            _state.account_restricted = isinstance(exc, AccountRestrictedError)
             logger.warning("LinkedIn login bootstrap failed: %s", exc)
         else:
             _state.auth_state = AuthState.READY
             _state.auth_completed_at = utcnow_iso()
 
+    # Read from the finished import itself, not only from whichever caller
+    # awaited it: a poller that sees the import done, or runs after that caller
+    # was cancelled, would otherwise take the manual-login branch. Left in place
+    # for its awaiters; a fresh no-session episode clears the task first.
+    import_task = _state.import_task
+    if import_task is not None and import_task.done() and not import_task.cancelled():
+        from linkedin_mcp_server.core.exceptions import AccountRestrictedError
+
+        if isinstance(import_task.exception(), AccountRestrictedError):
+            _state.account_restricted = True
+
 
 def _consume_background_setup_failure() -> str | None:
     if _state.setup_state is not SetupState.FAILED:
@@ -4121,6 +4139,13 @@ async def _start_login_if_needed(
             nothing_ran_yet=True,
         )
 
+    # Imported here, like the other core exceptions in this module, to keep
+    # bootstrap out of the config -> core import cycle.
+    from linkedin_mcp_server.core.exceptions import (
+        AccountRestrictedError,
+        ProxyConnectionError,
+    )
+
     # Cheap check-and-claim under the lock; the slow work (auto-import browser
     # launch, then the bounded inline wait) runs AFTER the lock is released so
     # concurrent pollers never serialize on it.
@@ -4131,6 +4156,12 @@ async def _start_login_if_needed(
             _state.auth_state = AuthState.READY
             return
 
+        # Ahead of every branch below, each of which ends in an import or a login
+        # window: LinkedIn has refused this account, and signing in again only
+        # lands on the same page.
+        if _state.account_restricted:
+            raise AccountRestrictedError()
+
         login_task: asyncio.Task[None] | None = None
         import_task: asyncio.Task[bool] | None = None
         prior_error: str | None = None
@@ -4161,10 +4192,6 @@ async def _start_login_if_needed(
     # Await an import (ours or a peer's). On success the caller falls through to
     # the scrape; on failure we re-enter to take the manual-login path.
     if import_task is not None:
-        # Imported here, like the other core exceptions in this module, to keep
-        # bootstrap out of the config -> core import cycle.
-        from linkedin_mcp_server.core.exceptions import ProxyConnectionError
-
         try:
             await import_task
         except asyncio.CancelledError:
@@ -4174,6 +4201,12 @@ async def _start_login_if_needed(
             # session"; swallowing it here would undo that and send the user
             # into a manual login that has to fail through the same proxy.
             raise
+        except AccountRestrictedError:
+            # For the same reason: the manual
```

**File**: `linkedin_mcp_server/cli_main.py` (modified, +11/-7)
```diff
@@ -15,7 +15,7 @@
     configure_browser_environment,
     ensure_browser_installed,
 )
-from linkedin_mcp_server.core import AuthenticationError
+from linkedin_mcp_server.core import AccountRestrictedError, AuthenticationError
 from linkedin_mcp_server.exceptions import (
     BrowserBusyError,
     BrowserDowngradeError,
@@ -459,7 +459,11 @@ def import_from_browser_and_exit() -> None:
             print(f"❌ {e}")
             print("   Log into LinkedIn in your browser first, or run with --login.")
             sys.exit(1)
-        except (CookieDecryptionError, AuthenticationError) as e:
+        except (
+            CookieDecryptionError,
+            AuthenticationError,
+            AccountRestrictedError,
+        ) as e:
             print(f"❌ Could not import session: {e}")
             sys.exit(1)
 
@@ -542,11 +546,11 @@ async def check_session() -> bool:
             return browser.is_authenticated
         except AuthenticationError:
             return False
-        except BrowserDowngradeError:
+        except (BrowserDowngradeError, AccountRestrictedError):
             # Not "unexpected", and no traceback. This is the guard doing its
-            # job, the message already says which two versions and what to do,
-            # and `--status` is the first thing a puzzled user runs. The tool
-            # path treats it the same way, in `error_handler`.
+            # job, the message already says what happened and what to do, and
+            # `--status` is the first thing a puzzled user runs. The tool path
+            # treats both the same way, in `error_handler`.
             raise
         except Exception as e:
             logger.exception(f"Unexpected error checking session: {e}")
@@ -570,7 +574,7 @@ async def check_session() -> bool:
 
     try:
         valid = asyncio.run(check_session())
-    except BrowserDowngradeError as e:
+    except (BrowserDowngradeError, AccountRestrictedError) as e:
         # Ahead of the generic handler, which would add "Check logs and browser
         # configuration" to a message that already names the fix exactly.
         print(f"\n❌ {e}")
```

**File**: `linkedin_mcp_server/core/__init__.py` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@
     wait_for_manual_login,
 )
 from .exceptions import (
+    AccountRestrictedError,
     AuthenticationError,
     ElementNotFoundError,
     LinkedInScraperException,
@@ -51,6 +52,7 @@ def __getattr__(name: str) -> object:
 
 
 __all__ = [
+    "AccountRestrictedError",
     "AuthenticationError",
     "BrowserManager",
     "await_deferring_cancels",
```

---

### Incident Patch 6: `87fb87c4` (2026-09-27)
**Commit Message**: fix(messaging): Confirm sends from LinkedIn's server acknowledgement (#1108)

## Summary

- Every delivered message returned `send_unconfirmed` (#B). Measured
live: the owner `<form>` does not contain the message list; an open
thread replaces its client placeholder with a separate server-URN node;
a new thread moves to `/messaging/thread/<id>/` and remounts the
conversation pane.
- The observer watches the thread scope (the owner when it is a dialog,
else the nearest ancestor below `<main>` with a message list and exactly
one editor).
- Confirmation also accepts exactly one visible exact-text node whose
`data-event-urn` is a `urn:li:msg_message:` absent before submission, in
the pane of the one composer on a message route. The placeholder alone,
a re-rendered earlier message, two such nodes, or a route off messaging
stay unconfirmed. The pre-submit URNs ride on the confirmation marker as
an attribute, since the readiness check runs in an isolated world.
- The opaque-ID transition path and its tests are unchanged.

## Verification

- Live, on a build that also carries a top-card fix equivalent to #1105:
a send in an open thread and the first message of a new thread both
returned `se

**File**: `changelog.d/1108.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+send_message now reports sent when LinkedIn shows the message under its server ID, in an open thread and in the first message of a new thread, instead of returning send_unconfirmed for every delivered message.
```

**File**: `linkedin_mcp_server/scraping/message_sender.py` (modified, +165/-31)
```diff
@@ -276,6 +276,26 @@
             messageRoute: messageRoute(target),
         };
     };
+    // The element whose subtree holds this conversation's messages. An
+    // overlay dialog holds both the messages and the composer. On the full
+    // messaging page the owner is the composer <form> and the messages are
+    // in its sibling, so climb to the nearest ancestor that holds a message
+    // item, one visible editor, and stays below <main>. Otherwise keep the
+    // owner, which leaves the send unconfirmed rather than widening the scope.
+    const threadScope = owner => {
+        if (!owner || owner.matches('dialog, [role="dialog"]')) return owner;
+        const lists = '[data-view-name="message-list-item"]';
+        let ancestor = owner.parentElement;
+        while (ancestor && !ancestor.matches('main, body')) {
+            const editors = Array.from(ancestor.querySelectorAll(
+                '[role="textbox"][contenteditable="true"]'
+            )).filter(visible);
+            if (editors.length !== 1) return owner;
+            if (ancestor.querySelector(lists)) return ancestor;
+            ancestor = ancestor.parentElement;
+        }
+        return owner;
+    };
 """
 
 _MESSAGE_COMPOSER_OWNER_JS = (
@@ -359,6 +379,7 @@
         pinned.editor.setAttribute('data-linkedin-mcp-editor', token);
         const state = {
             owner: arg.owner,
+            scope: threadScope(arg.owner),
             editor: pinned.editor,
             expected: arg.expected,
             baseline: new Set(),
@@ -403,7 +424,7 @@
             for (const [node, candidate] of state.candidates) {
                 if (
                     node.isConnected &&
-                    state.owner.contains(node) &&
+                    state.scope.contains(node) &&
                     exactUnit(node, true)
                 ) {
                     candidate.matched = true;
@@ -469,7 +490,15 @@
         state.baseline = new Set(
             document.querySelectorAll('[data-view-name="message-list-item"]')
         );
-        state.observer.observe(state.owner, {
+        // Kept as an attribute: the readiness check runs in another world,
+        // where properties set on elements here are not visible.
+        marker.setAttribute('data-linkedin-mcp-route', window.location.pathname);
+        marker.setAttribute('data-linkedin-mcp-baseline', JSON.stringify(
+            Array.from(state.baseline)
+                .map(node => (node.getAttribute('data-event-urn') || '').trim())
+                .filter(Boolean)
+        ));
+        state.observer.observe(state.scope, {
             attributes: true,
             attributeFilter: ['data-event-urn'],
             attributeOldValue: true,
@@ -488,7 +517,114 @@
     "(arg) => {"
     + _MESSAGE_COMPOSER_INSPECT_JS
     + r"""
-        if (!arg.owner?.isConnected) return false;
+        const exactVisibleUnit = node => {
+            if (!visible(node)) return false;
+            const elements = [node, ...node.querySelectorAll('*')].filter(visible);
+            const matches = elements.filter(
+                element => (element.innerText || '') === arg.expected
+            );
+            return matches.filter(
+                element => !matches.some(
+                    other => other !== element && element.contains(other)
+                )
+            ).length === 1;
+        };
+        const itemSelector = '[data-view-name="message-list-item"]';
+        const linksRecipient = anchor => {
+            let path;
+            try {
+                path = new URL(
+                    anchor.getAttribute('href') || '', window.location.href
+                ).pathname;
+            } catch {
+                return false;
+            }
+            const identifier = /^\/in\/([^/]+)/.exec(path)?.[1];
+            return !!identifier && (
+                identifier === arg.profileUrn || `/in/${identifier}/` === arg.profilePath
+            );
+        };
+        // L
```

**File**: `linkedin_mcp_server/tools/messaging.py` (modified, +4/-3)
```diff
@@ -288,9 +288,10 @@ async def send_message(
 
         Returns:
             Dict with url, status, message, recipient_selected, sent, and
-            retry_safe. ``sent`` is true only after the submitted message's DOM
-            node gains a different opaque event ID; this does not claim delivery
-            or read status. It is false both where nothing was submitted and
+            retry_safe. ``sent`` is true only after the thread shows the submitted
+            text under a new server message ID (or its DOM node gains a
+            different event ID); this does not claim delivery or read status.
+            It is false both where nothing was submitted and
             where the outcome is unknown. ``retry_safe`` separates the two: it
             is false from the moment a submission is attempted, and calling
             again while it is
```

**File**: `tests/fixtures/scraping-policy/v1/message-cancelled.json` (modified, +8/-8)
```diff
@@ -171,7 +171,7 @@
       "call": "send_message",
       "kind": "wait_for_function",
       "operation": "message_composer_ready",
-      "program_digest": "55fbb455644d",
+      "program_digest": "1e738a03c39b",
       "section": "message",
       "timeout_ms": null
     },
@@ -183,7 +183,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "5b716974716a",
+      "program_digest": "51178a7a46af",
       "section": "message"
     },
     {
@@ -194,7 +194,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "5b716974716a",
+      "program_digest": "51178a7a46af",
       "section": "message"
     },
     {
@@ -208,7 +208,7 @@
       "call": "send_message",
       "kind": "evaluate_handle",
       "operation": "message_composer_owner",
-      "program_digest": "d311cb797c03",
+      "program_digest": "438ca7ee906d",
       "section": "message"
     },
     {
@@ -256,7 +256,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_confirmation_prepare",
-      "program_digest": "93a3ae384427",
+      "program_digest": "ef16538e4760",
       "section": "message"
     },
     {
@@ -285,7 +285,7 @@
       "call": "send_message",
       "kind": "wait_for_function",
       "operation": "message_confirmation_ready",
-      "program_digest": "c5f34ff3f519",
+      "program_digest": "892d6d750f3f",
       "section": "message",
       "timeout_ms": null
     },
@@ -299,15 +299,15 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_confirmation_dispose",
-      "program_digest": "6b3c7d577da9",
+      "program_digest": "bd92ef816e24",
       "section": "message"
     },
     {
       "call": "send_message",
       "handle": "handle-1",
       "kind": "handle.evaluate",
       "operation": "message_composer_dispose",
-      "program_digest": "ec7c454e506b",
+      "program_digest": "195abada1200",
       "section": "message"
     },
     {
```

**File**: `tests/fixtures/scraping-policy/v1/message-composer-occupied.json` (modified, +3/-3)
```diff
@@ -171,7 +171,7 @@
       "call": "send_message",
       "kind": "wait_for_function",
       "operation": "message_composer_ready",
-      "program_digest": "55fbb455644d",
+      "program_digest": "1e738a03c39b",
       "section": "message",
       "timeout_ms": null
     },
@@ -183,7 +183,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "5b716974716a",
+      "program_digest": "51178a7a46af",
       "section": "message"
     },
     {
@@ -194,7 +194,7 @@
       "call": "send_message",
       "kind": "evaluate",
       "operation": "message_composer_state",
-      "program_digest": "5b716974716a",
+      "program_digest": "51178a7a46af",
       "section": "message"
     }
   ],
```

---

### Incident Patch 7: `a454fa2c` (2026-09-26)
**Commit Message**: fix(connect): Recheck a sent invite before failing (#1137)

## Problem

`connect_with_person` could return `send_failed` for an invitation
LinkedIn had recorded. It re-reads the profile right after Send, and
that read can still render Connect. I checked: a call without a note
returned `send_failed` ("the profile still exposes Connect"), and the
same profile showed Pending half an hour later. The accept path already
waits once for this.

## Solution

After Send, re-read the profile once more after 3 seconds when the first
read still exposes Connect, the same settle retry the accept path uses.
Only a retry that shows the invitation pending, or already accepted,
replaces the first read. `AGENTS.md` now counts up to seven actions for
the call.

## Verification

- New tests: a retry that shows the invitation pending returns
`connected`; an unreadable or follow-only retry keeps `send_failed`.
Each fails when its half is removed.
- `ruff`, `ty` and the connection tests pass.

## Synthetic prompt

> In `connect_with_person`, retry the post-send profile read once after
3 seconds before returning `send_failed`, like the accept path, and test
it.

Generated with Claude Opus 5.5 for implementa

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ Live checks share one LinkedIn account, so every session counts toward the
 same limits. One tool call can cost several browser actions:
 `get_person_profile` loads one page per section and a second one for a
 section LinkedIn rate-limits, `send_message` takes three, and
-`connect_with_person` up to six.
+`connect_with_person` up to seven.
 
 - Per tool: at most 10 calls a minute and 100 a day.
 - Profiles: at most one page load a second for `get_person_profile` and
```

**File**: `changelog.d/1137.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+`connect_with_person` now re-reads the profile once more before reporting `send_failed`, so an invitation LinkedIn already recorded no longer comes back as failed.
```

**File**: `linkedin_mcp_server/scraping/connection_actions.py` (modified, +15/-1)
```diff
@@ -888,8 +888,22 @@ async def connect_with_person(
             )
 
         verified = await self._read_main_profile(username)
-        verified_text = verified.get("sections", {}).get("main_profile", "")
         verified_signals = await self._read_action_signals(username)
+        if verified_signals.has_invite_anchor:
+            # The same settle retry as the accept path: an immediate re-read
+            # can still render Connect for an invitation LinkedIn already
+            # recorded (observed live 2026-09-26: send_failed, then Pending).
+            # Only a pending or already accepted invitation is evidence it
+            # landed.
+            await asyncio.sleep(3.0)
+            retry = await self._read_main_profile(username)
+            retry_signals = await self._read_action_signals(username)
+            if connection.detect_connection_state(retry_signals) in (
+                "pending",
+                "already_connected",
+            ):
+                verified, verified_signals = retry, retry_signals
+        verified_text = verified.get("sections", {}).get("main_profile", "")
         verified_state = connection.detect_connection_state(verified_signals)
 
         if verified_signals.has_invite_anchor:
```

**File**: `tests/scraping/test_connection_actions.py` (modified, +103/-3)
```diff
@@ -129,16 +129,20 @@ async def test_connectable_navigates_deeplink_and_verifies(self, mock_page):
         assert "preload/custom-invite" in await_args.args[0]
 
     async def test_connectable_send_failed_when_anchor_persists(self, mock_page):
-        """Dialog submitted but profile still exposes Connect → send_failed."""
+        """Profile still exposes Connect after the settle retry → send_failed."""
         text = "Jane\n\n· 3rd\n\nEngineer\n\nConnect\nMore\nAbout\n"
-        actions = _actions(mock_page, _reads(text, text))
+        actions = _actions(mock_page, _reads(text, text, text))
 
         with (
             patch.object(
                 actions,
                 "_read_action_signals",
                 new_callable=AsyncMock,
-                side_effect=[_signals(invite=True), _signals(invite=True)],
+                side_effect=[
+                    _signals(invite=True),
+                    _signals(invite=True),
+                    _signals(invite=True),
+                ],
             ),
             patch.object(PageNavigator, "_navigate_to_page", new_callable=AsyncMock),
             patch.object(
@@ -150,6 +154,102 @@ async def test_connectable_send_failed_when_anchor_persists(self, mock_page):
                 new_callable=AsyncMock,
                 return_value=True,
             ),
+            patch(
+                "linkedin_mcp_server.scraping.connection_actions.asyncio.sleep",
+                new_callable=AsyncMock,
+            ),
+        ):
+            result = await actions.connect_with_person("testuser")
+
+        assert result["status"] == "send_failed"
+
+    @pytest.mark.parametrize(
+        ("retry_signals", "state"),
+        [
+            (_signals(labeled_anchor=True), "pending"),
+            (_signals(compose=True), "already_connected"),
+        ],
+        ids=["pending", "accepted-meanwhile"],
+    )
+    async def test_connectable_connected_on_settle_retry(
+        self, mock_page, retry_signals, state
+    ):
+        """The first post-send read still renders Connect; the settle retry
+        sees the invitation pending (or already accepted) and reports
+        connected."""
+        text = "Jane\n\n· 2nd\n\nEngineer\n\nConnect\nMore\nAbout\n"
+        post = "Jane\n\n· 2nd\n\nEngineer\n\nMessage\nPending\nMore\nAbout\n"
+        actions = _actions(mock_page, _reads(text, text, post))
+
+        with (
+            patch.object(
+                actions,
+                "_read_action_signals",
+                new_callable=AsyncMock,
+                side_effect=[
+                    _signals(invite=True),
+                    _signals(invite=True),
+                    retry_signals,
+                ],
+            ),
+            patch.object(PageNavigator, "_navigate_to_page", new_callable=AsyncMock),
+            patch.object(
+                actions, "_dialog_is_open", new_callable=AsyncMock, return_value=True
+            ),
+            patch.object(
+                actions,
+                "_click_dialog_primary_button",
+                new_callable=AsyncMock,
+                return_value=True,
+            ),
+            patch(
+                "linkedin_mcp_server.scraping.connection_actions.asyncio.sleep",
+                new_callable=AsyncMock,
+            ) as mock_sleep,
+        ):
+            result = await actions.connect_with_person("testuser")
+
+        assert result["status"] == "connected"
+        assert state in result["message"]
+        mock_sleep.assert_awaited_once()
+
+    @pytest.mark.parametrize(
+        "retry_signals",
+        [_signals(), _signals(compose=True, labeled_action=True)],
+        ids=["unreadable", "follow-only"],
+    )
+    async def test_settle_retry_without_pending_keeps_send_failed(
+        self, mock_page, retry_signals
+    ):
+        """Only a pending invitation on the retry is evidence it landed."""
+        text = "Jane\n\n· 2nd\n\nEngineer\n\nConnect\nMore\nAbout\n"
+        actions = _
```

---

### Incident Patch 8: `ccf29cbc` (2026-09-26)
**Commit Message**: fix(connect): Keep a failed note fill off the quota (#1136)

## Problem

`connect_with_person` with a note could return
`custom_note_limit_reached` while note quota remained. After a failed
fill, any Premium link in the dialog counted as a quota block, but
LinkedIn shows that banner on this step regardless of quota. I checked:
the dialog said three personalized invitations remained, the call
returned `custom_note_limit_reached` without sending, and a second call
sent the note.

## Solution

After a failed fill, report the quota only when the textarea is gone, as
the reveal step already does. Otherwise nothing is sent and the call
returns `connect_unavailable`. The fill exception is now logged.

## Verification

- Two tests, one per side of the gate; each fails when its half is
removed.
- `uv run pytest`: 4920 passed.

## Synthetic prompt

> In `_submit_invite_dialog`, report `custom_note_limit_reached` after a
failed note fill only when no textarea is mounted, log the fill
exception, and test both cases.

<!-- Macroscope's pull request summary starts here -->
<!-- Macroscope will only edit the content between these invisible
markers, and the markers themselves will not be visible i

**File**: `changelog.d/1136.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+`connect_with_person` no longer reports `custom_note_limit_reached` when filling the note fails while LinkedIn still shows the note field; it sends nothing and returns `connect_unavailable`.
```

**File**: `linkedin_mcp_server/scraping/connection_actions.py` (modified, +21/-0)
```diff
@@ -351,6 +351,7 @@ async def _fill_dialog_textarea(self, value: str, *, timeout: int = 5000) -> boo
             await locator.fill(value, timeout=timeout)
             return True
         except Exception:
+            logger.debug("Invite note fill failed", exc_info=True)
             return False
 
     async def _dismiss_dialog(self) -> None:
@@ -563,6 +564,26 @@ async def _submit_invite_dialog(
 
             note_filled = await self._fill_dialog_textarea(note)
             if not note_filled:
+                # Same gate as the reveal step: the Premium nudge banner sits
+                # beside a live textarea, so a failed fill is a quota block
+                # only once no visible textarea is left. A count that fails
+                # proves no absence, so it claims no block either: a false
+                # block invites the caller to resend without the note.
+                try:
+                    textarea_visible = (
+                        await self._session.page.locator(
+                            f"{_DIALOG_TEXTAREA_SELECTOR} >> visible=true"
+                        ).count()
+                        > 0
+                    )
+                except Exception:
+                    textarea_visible = True
+                if textarea_visible:
+                    logger.info(
+                        "Invite note fill failed without evidence of a quota block"
+                    )
+                    await self._dismiss_dialog()
+                    return False, False, None
                 note_limit_message = await self._get_premium_upsell_message()
                 if note_limit_message is not None:
                     logger.info("Premium upsell blocked filling invite note")
```

**File**: `tests/scraping/test_connection_actions.py` (modified, +121/-0)
```diff
@@ -16,6 +16,7 @@
 from typing import Any
 from unittest.mock import AsyncMock, MagicMock, patch
 
+import pytest
 from patchright.async_api import TimeoutError as PlaywrightTimeoutError
 
 from linkedin_mcp_server.scraping.connection import ActionSignals
@@ -768,6 +769,126 @@ def locator_for(selector: str):
         # blocked result instead of (True, True, None) above.
         mock_message.assert_not_called()
 
+    @pytest.mark.parametrize(
+        "recount",
+        [1, RuntimeError("count failed")],
+        ids=["textarea-mounted", "recount-failed"],
+    )
+    async def test_failed_fill_beside_a_mounted_textarea_is_not_a_note_limit(
+        self, mock_page, recount
+    ):
+        """A fill that fails while the textarea may still be there sends nothing.
+
+        The Premium nudge banner is detectable throughout, so reading it
+        after any failed fill reported ``custom_note_limit_reached`` for an
+        account with quota left (observed live: the dialog said three
+        personalized invitations remained). A recount that fails proves no
+        absence, so it reports no quota either.
+        """
+        actions = _actions(mock_page)
+        textarea = MagicMock()
+        textarea.count = AsyncMock(side_effect=[1, recount])
+        mock_page.locator.return_value = textarea
+
+        with (
+            patch.object(
+                actions, "_dialog_is_open", new_callable=AsyncMock, return_value=True
+            ),
+            patch.object(
+                actions,
+                "_fill_dialog_textarea",
+                new_callable=AsyncMock,
+                return_value=False,
+            ),
+            patch.object(
+                actions,
+                "_get_premium_upsell_message",
+                new_callable=AsyncMock,
+                return_value=PREMIUM_MESSAGE,
+            ),
+            patch.object(
+                actions, "_click_dialog_primary_button", new_callable=AsyncMock
+            ) as mock_send,
+            patch.object(
+                actions, "_dismiss_dialog", new_callable=AsyncMock
+            ) as mock_dismiss,
+        ):
+            result = await actions._submit_invite_dialog("Hello")
+
+        assert result == (False, False, None)
+        mock_send.assert_not_called()
+        mock_dismiss.assert_awaited_once()
+
+    async def test_failed_fill_after_the_upsell_replaced_the_textarea(self, mock_page):
+        """The upsell taking the textarea's place is still a note limit."""
+        actions = _actions(mock_page)
+        textarea = MagicMock()
+        # Mounted when the dialog opens, gone once the fill has failed.
+        textarea.count = AsyncMock(side_effect=[1, 0])
+        mock_page.locator.return_value = textarea
+
+        with (
+            patch.object(
+                actions, "_dialog_is_open", new_callable=AsyncMock, return_value=True
+            ),
+            patch.object(
+                actions,
+                "_fill_dialog_textarea",
+                new_callable=AsyncMock,
+                return_value=False,
+            ),
+            patch.object(
+                actions,
+                "_get_premium_upsell_message",
+                new_callable=AsyncMock,
+                return_value=PREMIUM_MESSAGE,
+            ),
+            patch.object(
+                actions, "_dismiss_dialog", new_callable=AsyncMock
+            ) as mock_dismiss,
+        ):
+            result = await actions._submit_invite_dialog("Hello")
+
+        assert result == (False, False, PREMIUM_MESSAGE)
+        mock_dismiss.assert_awaited_once()
+
+    async def test_failed_fill_beside_a_hidden_textarea_is_a_note_limit(
+        self, mock_page
+    ):
+        """A textarea the upsell left mounted but hidden is no note field."""
+        actions = _actions(mock_page)
+        mounted = MagicMock()
+        mounted.count = AsyncMock(return_value=1)
+        shown = MagicMock()
+        shown.count = AsyncMock(return_value=0)
+
+
```

---

### Incident Patch 9: `750309c4` (2026-09-26)
**Commit Message**: fix(daemon): Keep custom browsers on Direct (#1125)

## Problem

The default-on contract keeps the shared browser to the bundled
Chromium: a server started with `CHROME_PATH` must keep today's Direct
behaviour. `daemon_would_be_used` accepted a custom executable, so an
enabled daemon would have elected an owner for it.

## Solution

`daemon_would_be_used` now returns False, with one info line, when
`config.browser.chrome_path` is set by configuration, environment or
CLI. The W-CHROME-PATH witness from #1115 becomes a guard with a
bundled-browser control, and a CLI test checks that no profile lookup or
election happens for a custom browser.

## Verification

Disabling the gate fails the custom-browser witness and the CLI test
while the bundled control passes. Daemon and CLI suites, ruff and ty
pass.

Refs #606

## Synthetic prompt

> Make `daemon_would_be_used` refuse the daemon when a custom browser
executable is configured, per decision D in
`docs/decisions/2026-09-26-daemon-default-on-contract.md`, and turn the
W-CHROME-PATH witness into a guard with a bundled-browser control.

<!-- Macroscope's pull request summary starts here -->
<!-- Macroscope will only edit the content betwe

**File**: `changelog.d/1125.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+A server started with CHROME_PATH or --chrome-path no longer joins the opt-in shared browser and keeps driving its own browser.
```

**File**: `linkedin_mcp_server/daemon.py` (modified, +8/-0)
```diff
@@ -421,4 +421,12 @@ def daemon_would_be_used(config: AppConfig) -> bool:
             "daemon cannot outlive the virtual display owned by this server"
         )
         return False
+    if config.browser.chrome_path:
+        # Only the bundled browser is shared. A custom executable keeps the
+        # Direct server this configuration had before the daemon existed.
+        logger.info(
+            "CHROME_PATH is set, so this server drives its own browser instead "
+            "of sharing one"
+        )
+        return False
     return True
```

**File**: `tests/test_cli_main.py` (modified, +16/-0)
```diff
@@ -899,6 +899,22 @@ def test_no_owner_is_sought_for_an_http_server(
         assert cli_main._obtain_shared_owner(config) is None
         asked.assert_not_called()
 
+    def test_no_owner_is_sought_for_a_custom_browser(
+        self, monkeypatch: pytest.MonkeyPatch
+    ):
+        # Only the bundled browser is shared; CHROME_PATH keeps the Direct server
+        # it had before. Nothing about the profile or an owner may be looked up.
+        asked = MagicMock()
+        looked_up = MagicMock()
+        monkeypatch.setattr("linkedin_mcp_server.daemon_election.obtain_owner", asked)
+        monkeypatch.setattr("linkedin_mcp_server.cli_main.get_profile_dir", looked_up)
+        config = self._config(daemon_enabled=True)
+        config.browser.chrome_path = "/opt/custom/chrome"
+
+        assert cli_main._obtain_shared_owner(config) is None
+        asked.assert_not_called()
+        looked_up.assert_not_called()
+
     def test_the_elected_owner_is_handed_back_rather_than_discarded(
         self, monkeypatch: pytest.MonkeyPatch, tmp_path
     ):
```

**File**: `tests/test_daemon_regression_witnesses.py` (modified, +9/-10)
```diff
@@ -342,30 +342,29 @@ def sleep(seconds: float) -> None:
     assert proved is False
 
 
-@pytest.mark.xfail(
-    strict=True,
-    raises=AssertionError,
-    reason="W-CHROME-PATH: a custom browser executable is still a daemon "
-    "candidate; fixed in P3",
+@pytest.mark.parametrize(
+    ("chrome_path", "shared"), [("/opt/custom/chrome", False), (None, True)]
 )
-def test_a_custom_browser_keeps_the_direct_server(monkeypatch: pytest.MonkeyPatch):
+def test_a_custom_browser_keeps_the_direct_server(
+    monkeypatch: pytest.MonkeyPatch, chrome_path: str | None, shared: bool
+):
     """W-CHROME-PATH (P3), source-model witness, not a native measurement.
 
     Guards the scope decision "Custom browsers": only the bundled browser runs
     in default daemon mode, and ``CHROME_PATH`` keeps today's Direct behaviour.
-    Every other gate is open here, so the custom executable is the only reason
-    left to refuse.
+    Every other gate is open here, and the bundled-browser case is the control:
+    it must still be shared, so another refusal cannot pass for this one.
     """
     monkeypatch.setattr(
         "linkedin_mcp_server.daemon.get_runtime_id", lambda: "linux-amd64-host"
     )
     config = AppConfig()
     config.server.daemon_enabled = True
-    config.browser.chrome_path = "/opt/custom/chrome"
+    config.browser.chrome_path = chrome_path
     if config.server.transport != "stdio":
         pytest.fail("the default transport is no longer stdio")
 
-    assert daemon_would_be_used(config) is False
+    assert daemon_would_be_used(config) is shared
 
 
 @pytest.mark.xfail(
```

---

### Incident Patch 10: `639016b0` (2026-09-26)
**Commit Message**: fix(deps): Move the lock to patchright 1.63.0 (#1123)

## Problem

Renovate's lock maintenance (#964) failed: patchright 1.63.0 moves
Chromium 149 to 153 and brings ty 0.0.84, which reports 11 new
diagnostics. Patchright 1.63.0 also switches Linux arm64 to Chrome for
Testing, so the arm64 image reports a new product name.

## Solution

- Regenerate `uv.lock` on current `main`. It has the same versions as
#964.
- Fix the ty diagnostics. The only behaviour-neutral code change is a
dead condition in the connection message.
- Re-verify every patchright internal the code cites against 1.63.0,
then update the pinned stack tests.
- Rewrite the product-name notes in `browser_downgrade.py` and
`AGENTS.md`.
- Add the 153 measurements to `docs/browser-fingerprint.md`.

## Verification

- 4562 tests pass, and pre-commit is clean.
- On macOS, the identity suite passes 35/35. CreepJS scores are
identical to 149.
- In the arm64 and amd64 images, identity checks and WebGL (10/10) match
the 149 image.
- The downgrade guard works in both directions.

| Section | Before | After |
| --- | --- | --- |
| Fingerprint doc | ![Before: 149
section](https://github.com/user-attachments/assets/12d214f8-869b-4e

**File**: `.github/workflows/ci.yml` (modified, +9/-9)
```diff
@@ -286,11 +286,12 @@ jobs:
             browsers: ~/Library/Caches/ms-playwright
           - os: windows-latest
             browsers: ~\AppData\Local\ms-playwright
-          # Here for the browser rather than for the operating system.
-          # Patchright ships Chrome for Testing everywhere except Linux arm64,
-          # which gets Playwright's own Chromium build, and the release
-          # publishes an arm64 image. Without this leg an identity regression
-          # in that build reaches the container with both other jobs green.
+          # Here for the browser rather than for the operating system. The
+          # release publishes an arm64 image, and its browser is a separate
+          # build from every other leg's: Chrome for Testing for linux-arm64
+          # at the lock, Playwright's own Chromium through patchright 1.61.2.
+          # Without this leg an identity regression in that build reaches the
+          # container with both other jobs green.
           - os: ubuntu-24.04-arm
             browsers: ~/.cache/ms-playwright
     steps:
@@ -322,10 +323,9 @@ jobs:
       # The identity gate runs on every leg, because every leg's browser is a
       # different one from the Ubuntu job's. macOS is the only platform with a
       # hidden target, which is the whole reason the default mode can run
-      # without announcing itself as headless. Linux arm64 is the only platform
-      # whose bundle is Playwright's own Chromium rather than Chrome for
-      # Testing. Windows has its own binary, its own window manager and its own
-      # DPI handling, and the gate measures a headed window against the screen
+      # without announcing itself as headless. Linux arm64 runs the browser
+      # build the arm64 image ships. Windows has its own binary, its own window
+      # manager and its own DPI handling, and the gate measures a headed window against the screen
       # it stands on -- which is exactly where those differ. An earlier version
       # of this file left Windows out on the grounds that it falls back to
       # headless mode like Linux does; that is true of one case in that file
```

**File**: `AGENTS.md` (modified, +9/-11)
```diff
@@ -96,17 +96,15 @@ This file provides guidance to Claude Code (claude.ai/code) when working with co
   written by a fork is therefore still refused; that one is not repairable from
   `Last Version`, and the error says so by naming the number to go back to
   rather than a browser.
-- **Never trim `_COMPARABLE_PRODUCTS` to one name.** At the current lock two
-  are live at once, on the same release: Playwright downloads its own Chromium
-  build for Linux arm64 and Chrome for Testing everywhere else, so the
-  published arm64 container reports `Chromium` while the amd64 one and macOS
-  report `Google Chrome for Testing`, at the same revision. Dropping either
-  entry turns the guard off for a shipped platform. That is the split *at the
-  lock* and it does not hold across the whole supported range: at the declared
-  floor every platform reports `Chromium`, and revision 1200 moved macOS and
-  Linux x64 together, leaving only Linux arm64 behind. Which is the point:
-  both managed names occur, and which one where depends on when and where, so
-  neither is redundant. The third entry, `google chrome`, is not a managed
+- **Never trim `_COMPARABLE_PRODUCTS` to one name.** `uvx` and `pip` resolve
+  the declared patchright range fresh, and the two managed names split across
+  it: at the declared floor every platform reports `Chromium`, revision 1200
+  moved macOS and Linux x64 to `Google Chrome for Testing`, and Linux arm64
+  followed only at patchright 1.63.0. So both names are in the field on any
+  release, even when every published image reports the same one, and dropping
+  either turns the guard off for a supported install. Which name a platform
+  reports at a given revision is a measurement, never an inference from the
+  version number. The third entry, `google chrome`, is not a managed
   browser at all but what an operator's own binary reports under `CHROME_PATH`,
   and it earns its place only when *that* Chrome is the older one: the guard
   reads the running binary, never the profile's writer. `browsers.json` is not
```

**File**: `changelog.d/1123.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+The Docker image now runs Chrome for Testing 153 on both architectures, and a profile it opens can no longer be reopened by an older image, which refuses it with a message instead of losing the session.
```

**File**: `docs/browser-fingerprint.md` (modified, +62/-0)
```diff
@@ -271,6 +271,68 @@ either, because it is implied rather than skipped: the windowless path fails
 closed, so a run that produced these values had a hidden target and no window.
 That is an inference, not a CoreGraphics poll like the 148 row was.
 
+### Re-measured on Chrome for Testing 153
+
+Patchright 1.63.0 moves the lock to revision 1243, Chrome for Testing
+153.0.8010.12, and it is the first release that downloads Chrome for Testing
+for Linux arm64 as well. So the arm64 image changed product and not only
+version: `--version` there read `Chromium 149.0.7827.0` at 1.61.2 and reads
+`Google Chrome for Testing 153.0.8010.12` now, the same string as the amd64
+image and macOS. Each row below was measured against the same probe on the
+149 build, on the same machine, as a control. Measured 2026-09-26 on macOS
+26.6.2 arm64 with Docker 29.4.0.
+
+macOS, through `BrowserManager` against a loopback origin, both launch modes.
+`tests/test_browser_identity.py` passes all 35 cases on 153.
+
+| | Value on 153 |
+|---|---|
+| User agent | `…Chrome/153.0.0.0…`, no `HeadlessChrome` |
+| `sec-ch-ua` brands | `Chromium/153`, `Not_A Brand/8`, major agreeing with the UA |
+| High-entropy hints | `arm`, `64`, two `fullVersionList` entries |
+| `navigator.webdriver` | `false` |
+| `document.visibilityState` / `hasFocus()` | `visible` / `true` |
+| Outer window vs screen | default 1280x720 on 1280x720; headed 1200x926 on 1920x1080 |
+| `navigator.plugins.length` / `window.chrome` | 5 / `object` |
+| `Notification.permission` | `default` |
+| `requestAnimationFrame` | 61/s in the default mode and 61/s headed |
+| CreepJS headless / like headless / stealth | default 0% / 44% / 0%; headed 0% / 31% / 0% |
+
+The frame rate is the display's, not the browser's: 149 measured 61/s in both
+modes on the same 60 Hz screen, where the 148 and 149 rows above read 122/s.
+What the row has to show is that the hidden target runs at the rate of an
+ordinary window, and it does. The CreepJS scores and their hashes are identical
+on 149 and 153 in both modes.
+
+The published images, headed under Xvfb as they run, with the harness from
+`tests/browser_identity_harness.py` inside the container. The arm64 image was
+measured natively, the amd64 one under emulation; the 149 control is the
+published `latest` image.
+
+| | arm64 | amd64 |
+|---|---|---|
+| Product | `Google Chrome for Testing 153.0.8010.12` | same |
+| Page, workers and cross-origin frame agree, headers included | yes | yes |
+| `sec-ch-ua` / `sec-ch-ua-arch` | `"Chromium";v="153", "Not_A Brand";v="8"` / `arm` | same / `x86` |
+| `navigator.webdriver` / automation globals | `false` / none | `false` / none |
+| `outer <= screen` | 945x1060 on 1920x1080 | same |
+| WebGL1 / WebGL2, ten launches | 10/10 / 10/10 | 10/10 / 10/10 |
+| Unmasked renderer | `ANGLE (Mesa/X.org, llvmpipe (LLVM 15.0.6 128 bits), OpenGL 4.5)` | same, byte-identical |
+| SwiftShader | absent | absent |
+
+Every arm64 value matches the 149 image except the version and the GREASE
+brand. `requestAnimationFrame` under Xvfb was noisy on both: 153 read 43, 44,
+56 and 54 across four launches, 149 read 54, 54, 55 and 54. Two slow launches
+out of four is not a trend, and it is recorded rather than explained.
+
+The downgrade guard asks the running binary for its product, so the arm64
+rename reaches it directly. Inside the new arm64 image it parsed `Google Chrome
+for Testing` as comparable, opened a profile marked `149.0.7827.0` and refused
+one marked `160.0.1.0`.
+
+Not re-measured on 153: fpscanner, rebrowser-bot-detector, the JA4 and HTTP/2
+fingerprints, the startup-flash timing, and the cookie-across-restart check.
+
 ## Things that look like fixes and are not
 
 - **`--user-agent` as a browser switch.** Reaches every target including
```

**File**: `linkedin_mcp_server/bootstrap.py` (modified, +8/-6)
```diff
@@ -309,9 +309,9 @@ def _prefixes_of(literal: str) -> str:
 #: and hit Python's 4300-digit integer limit on a long percentage. Bounded here,
 #: neither can be constructed.
 _PATCHRIGHT_PERCENT = re.compile(r"\|\s*(\d{1,3})%\s+of\s+([\d.]{1,15})\s*([KMG]i?B)")
-#: ``Downloading Chrome for Testing 149.0.7827.55 (…) from https://…``
+#: ``Downloading Chrome for Testing 153.0.8010.12 (…) from https://…``
 _PATCHRIGHT_DOWNLOAD = re.compile(r"^Downloading (.+?) from ")
-#: ``Chrome for Testing 149.0.7827.55 (…) downloaded to /…/chromium-1228``. The
+#: ``Chrome for Testing 153.0.8010.12 (…) downloaded to /…/chromium-1243``. The
 #: only completion signal there is when no percentage was ever reported.
 _PATCHRIGHT_DONE = re.compile(r" downloaded to ")
 _BINARY_UNITS = {"KiB": 1024, "MiB": 1024**2, "GiB": 1024**3}
@@ -761,7 +761,9 @@ def succeed(answer: _ThreadResult = value) -> None:
 
             complete = succeed
         try:
-            loop.call_soon_threadsafe(complete)
+            # A lambda, because ty cannot solve call_soon_threadsafe's *args
+            # against a union of callbacks whose parameters have defaults.
+            loop.call_soon_threadsafe(lambda: complete())
         except RuntimeError:
             if "value" in locals():
                 discard_safely(value)
@@ -3664,9 +3666,9 @@ async def _run_browser_setup(
 
     Those three figures are one revision's *and one platform's*, not a
     constant. The bundled browser moves with the lockfile and is past 148 now,
-    and the sizes differ by platform as well: the arm64 container does not get
-    Chrome for Testing at all, it gets Playwright's own Chromium build. What
-    the argument needs is only that the full browser is substantially larger
+    and the sizes differ by platform as well: through patchright 1.61.2 the
+    arm64 container did not get Chrome for Testing at all, it got Playwright's
+    own Chromium build. What the argument needs is only that the full browser is substantially larger
     than the shell everywhere, which holds; quoting these particular numbers
     anywhere user-facing means re-measuring them for the platform in question.
     """
```

#### Recent Merged Pull Requests:
- **PR #1187** (2026-09-30): docs(tools): Describe tools as reading LinkedIn (@stickerdaniel)
- **PR #1186** (2026-09-30): docs(readme): Describe tools as reading LinkedIn (@stickerdaniel)
- **PR #1185** (2026-09-30): chore(agents): Drop CLAUDE.md alias (@stickerdaniel)
- **PR #1184** (2026-09-30): docs(readme): Add contributors wall (@stickerdaniel)
- **PR #1183** (2026-09-30): docs(readme): Add setup note to Codex plugin (@stickerdaniel)
- **PR #1182** (2026-09-30): docs(contributing): Rewrite the contributing guide (@stickerdaniel)
- **PR #1180** (2026-09-30): test(daemon): Compare host quit and a second host (@stickerdaniel)
- **PR #1179** (2026-09-30): docs(readme): Sharpen the Cadenza sponsor line (@stickerdaniel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

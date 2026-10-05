# Forensic Learning Record (Deep Inspection): CloakHQ/CloakBrowser

> **Canonical Artifact**: `07_PROJECT_LEARNING/cloakhq-cloakbrowser-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CloakHQ/CloakBrowser](https://github.com/CloakHQ/CloakBrowser))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:48.677Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CloakHQ/CloakBrowser`
- **Description**: Stealth Chromium that passes every bot detection test. Drop-in Playwright replacement with source-level fingerprint patches. 30/30 tests passed.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 31909 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/recaptcha_score.py`
```
"""Check reCAPTCHA v3 score with stealth browser.

Visits Google's reCAPTCHA demo page and extracts the score.
Expected: 0.9 (human-level) with cloakbrowser.
Default Playwright typically scores 0.1-0.3.
"""

import re

from cloakbrowser import launch

print("Launching stealth browser...", flush=True)
browser = launch(headless=True)
page = browser.new_page()

# Google's official reCAPTCHA v3 demo — scores automatically on page load.
page.goto("https://recaptcha-demo.appspot.com/recaptcha-v3-request-scores.php")

# The score renders only after an async token + backend-verify round-trip,
# which can finish *after* "networkidle". Wait for the actual result text
# instead of a proxy signal, or the screenshot races the scoring.
page.wait_for_function(
    "() => document.body.innerText.includes('Received response from our backend')",
    timeout=20000,
)

# Extract score from the rendered response
match = re.search(r'"score":\s*([0-9.]+)', page.inner_text("body"))
print(f"reCAPTCHA v3 score: {match.group(1) if match else 'not found'}")
print(f"URL: {page.url}")

# Take screenshot as proof
page.screenshot(path="recaptcha_score.png")
print("Screenshot saved: recaptcha_score.png")

browser.close()

```

### Core Architecture Module: `bin/fetch-widevine.py`
```
#!/usr/bin/env python3
"""Fetch the Widevine CDM from Google's component-update server (Linux).

The CloakBrowser binary is built with Widevine support, but the CDM itself is a
proprietary Google component we don't redistribute. This pulls it at runtime from
the same component server Chrome uses, then drops it where the wrapper's
``CLOAKBROWSER_WIDEVINE_CDM`` resolution (cloakbrowser/widevine.py) expects it:

    <out>/manifest.json
    <out>/_platform_specific/linux_<arch>/libwidevinecdm.so

No curl/jq/unzip needed. Linux x86-64 only (Google doesn't publish the CDM for
linux arm64). The Docker entrypoint runs this when CLOAKBROWSER_FETCH_WIDEVINE is
set; bare-metal Linux users can run it directly.

Integrity: the download is checked against the server-provided SHA-256 (over TLS).
When `cryptography` is importable (it is in any pip/Docker install of cloakbrowser),
the CRX3 publisher signature is additionally verified and bound to the expected
Widevine app id — same trust root Chrome's component updater uses. Standalone runs
without `cryptography` fall back to TLS + SHA-256.
"""

import argparse
import hashlib
import io
import json
import os
import platform
import shutil
import struct
import sys
import tempfile
import urllib.request
import zipfile

# Widevine CDM component id in Chromium's component updater.
APP_ID = "oimompecagnajdejgnnjijobebaeigek"
UPDATE_URL = "https://update.googleapis.com/service/update2/json"
# Deliberately-low installed version so the server always reports an update.
INSTALLED_VERSION = "1.4.9.1088"
XSSI_PREFIX = ")]}'"


def _arch():
    """Map the host machine to the Widevine platform suffix (x86-64 only).

    Google's component server publishes the Linux Widevine CDM for x86-64 only —
    arm64/aarch64 return no update (verified: the server either reports noupdate
    or hands back the x86-64 binary), so reject them with a clear message rather
    than letting the request reach the misleading "no update available" path.
    """
    m = platform.machine().lower()
    if m in ("x86_64", "amd64", "x64"):
        return "x64"
    if m in ("aarch64", "arm64", "arm"):
        raise SystemExit("the Widevine CDM is not published for linux arm64 (x86-64 only)")
    raise SystemExit(f"unsupported architecture for Widevine: {platform.machine()!r}")


def _read_varint(b, i):
    shift = result = 0
    while True:
        if i >= len(b):
            raise ValueError("truncated varint")
        byte = b[i]; i += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, i
        shift += 7
        if shift > 63:
            raise ValueError("varint too long")


def _parse_pb(b):
    """Minimal protobuf reader → {field_num: [length-delimited bytes, ...]}."""
    out, i, n = {}, 0, len(b)
    while i < n:
        tag, i = _read_varint(b, i)
        field, wire = tag >> 3, tag & 7
        if wire == 2:
            ln, i = _read_varint(b, i)
            out.setdefault(field, []).append(b[i:i + ln]); i += ln
        elif wire == 0:
            _, i = _read_varint(b, i)
        elif wire == 1:
            i += 8
        elif wire == 5:
            i += 4
        else:
            raise ValueError(f"unsupported protobuf wire type {wire}")
    return out


def _crx_appid(pubkey_der):
    """CRX app id = first 16 bytes of SHA-256(pubkey), each nibble mapped a–p."""
    digest = hashlib.sha256(pubkey_der).digest()[:16]
    return "".join(chr(0x61 + (byte >> 4)) + chr(0x61 + (byte & 0xF)) for byte in digest), digest


def _verify_crx3(crx_bytes):
    """Verify the CRX3 RSA publisher signature and bind it to APP_ID.

    Returns True if verified, False if `cryptography` is unavailable (caller then
    relies on TLS + the server SHA-256). Raises SystemExit on a real failure.
    We verify the RSASSA-PKCS1-v1_5 / SHA-256 proof (CRX3 field 2), which is what
    Google signs the Widevine component with; ECDSA proofs (field 3) are not
    relied on. The app id is derived from the signing key — the same trust root
    Chrome verifies — so a non-Widevine publisher key can't satisfy the check.
    """
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.exceptions import InvalidSignature
    except ImportError:
        return False

    if len(crx_bytes) < 12:
        raise SystemExit("not a CRX3 file (too short)")
    if crx_bytes[:4] != b"Cr24":
        raise SystemExit("not a CRX3 file (bad magic)")
    version = struct.unpack("<I", crx_bytes[4:8])[0]
    if version != 3:
        raise SystemExit(f"unexpected CRX version {version}")
    header_len = struct.unpack("<I", crx_bytes[8:12])[0]
    header = crx_bytes[12:12 + header_len]
    archive = crx_bytes[12 + header_len:]

    fields = _parse_pb(header)
    signed_header = fields.get(10000, [b""])[0]
    # Signed payload: "CRX3 SignedData\x00" + uint32LE(len) + signed_header + archive
    payload = b"CRX3 SignedData\x00" + struct.pack("<I", len(signed_header)) + signed_header + archive
    declared_id = _parse_pb(signed_header).get(1, [b""])[0]  # SignedData.crx_id

    for proof in fields.get(2, []):  # sha256_with_rsa proofs
        p = _parse_pb(proof)
        pub_der, sig = p.get(1, [None])[0], p.get(2, [None])[0]
        if not pub_der or not sig:
            continue
        appid, digest16 = _crx_appid(pub_der)
        if appid != APP_ID:
            continue  # not the Widevine publisher key — ignore
        if declared_id and declared_id != digest16:
            raise SystemExit("CRX signed-header crx_id does not match the signing key")
        try:
            serialization.load_der_public_key(pub_der).verify(
                sig, payload, padding.PKCS1v15(), hashes.SHA256())
        except InvalidSignature:
            raise SystemExit("CRX3 publisher signature is INVALID")
        return True
    raise SystemExit("no CRX3 RSA proof from the expected Widevine publisher key")


def _post_json(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8", "replace")
    if body.startswith(XSSI_PREFIX):
        body = body[len(XSSI_PREFIX):]
    return json.loads(body)


def _resolve_crx(arch):
    """Query the component server; return (version, crx_url, sha256_hex)."""
    payload = {"request": {
        "@os": "", "@updater": "",
        "acceptformat": "crx3,download,puff,run,xz,zucc",
        "apps": [{"appid": APP_ID, "installsource": "ondemand",
                  "updatecheck": {}, "version": INSTALLED_VERSION}],
        "dedup": "cr", "ismachine": False, "arch": arch,
        "os": {"arch": arch, "platform": "linux"},
        "protocol": "4.0", "updaterversion": "142.0.7444.175",
    }}
    resp = _post_json(UPDATE_URL, payload)
    uc = resp["response"]["apps"][0]["updatecheck"]
    status = uc.get("status")
    if status and status != "ok":
        raise SystemExit(f"component server returned status={status!r} (no update available)")
    version = uc.get("nextversion", "?")
    # Find the first operation that carries download URLs + its sha256.
    for pipeline in uc.get("pipelines", []):
        for op in pipeline.get("operations", []):
            urls = [u["url"] for u in op.get("urls", []) if u.get("url", "").startswith("https")]
            if urls:
                sha = (op.get("out") or {}).get("sha256")
                return version, urls[0], sha
    raise SystemExit("no CRX download URL in component server response")


def _download(url, sha256_hex):
    with urllib.request.urlopen(url, timeout=120) as resp:
        blob = resp.read()
    # Integrity: server-provided SHA-256 over TLS (always). The CRX3 publisher
    # signature is additionally verified in main() when `cryptography` is present.
    if sha256_hex:
        got = hashlib.sha256(blob).hexdigest()
        if got.lower() != sha256_hex.lower():
            raise SystemExit(f"sha256 mismatch: expected {sha256_hex}, got {got}")
    return blob


def _extract(crx_bytes, arch, out_dir):
    """Extract manifest.json + the .so into out_dir, replacing any prior copy.

    Staged in a temp dir then renamed into place — the rename is atomic, but the
    rmtree of an existing out_dir that precedes it is not, so this is not safe
    against another process writing the same out_dir concurrently.
    """
    so_member = f"_platform_specific/linux_{arch}/libwidevinecdm.so"
    # zipfile locates the central directory from the end, so a CRX3 (header+zip)
    # opens directly without stripping the prefix.
    with zipfile.ZipFile(io.BytesIO(crx_bytes)) as zf:
        names = set(zf.namelist())
        if "manifest.json" not in names or so_member not in names:
            raise SystemExit(f"CRX missing expected members (manifest.json / {so_member})")
        parent = os.path.dirname(os.path.abspath(out_dir)) or "."
        os.makedirs(parent, exist_ok=True)
        tmp = tempfile.mkdtemp(prefix=".widevine.tmp.", dir=parent)
        try:
            zf.extract("manifest.json", tmp)
            zf.extract(so_member, tmp)
            os.chmod(os.path.join(tmp, so_member), 0o644)
            # Swap into place. The rename is atomic; the preceding rmtree is not.
            if os.path.exists(out_dir):
                shutil.rmtree(out_dir)
            os.rename(tmp, out_dir)
        except BaseException:
            shutil.rmtree(tmp, ignore_errors=True)
            raise


def _default_out():
    cache = os.environ.get("CLOAKBROWSER_CACHE_DIR") or os.path.join(os.path.expanduser("~"), ".cloakbrowser")
    return os.path.join(cache, "WidevineCdm")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Fetch the Widevine CDM for CloakBrowser (Linux).")
    ap.add_argument("--out", default=_
```

### Core Architecture Module: `cloakbrowser/__init__.py`
```
"""cloakbrowser — Stealth Chromium that passes every bot detection test.

Drop-in Playwright replacement with source-level fingerprint patches.

Usage:
    from cloakbrowser import launch

    browser = launch()
    page = browser.new_page()
    page.goto("https://protected-site.com")
    browser.close()
"""

from .browser import launch, launch_async, launch_context, launch_context_async, launch_persistent_context, launch_persistent_context_async, ProxySettings, build_args, maybe_resolve_geoip
from .config import CHROMIUM_VERSION, get_default_stealth_args
from .download import binary_info, check_for_update, clear_cache, ensure_binary
from .license import CloakBrowserLicenseError, LicenseInfo, validate_license
from ._version import __version__

# Human-like behavioral layer (optional)
def __getattr__(name):
    if name == "HumanConfig":
        from .human.config import HumanConfig
        globals()["HumanConfig"] = HumanConfig
        return HumanConfig
    if name == "resolve_human_config":
        from .human.config import resolve_config
        globals()["resolve_human_config"] = resolve_config
        return resolve_config
    raise AttributeError(f"module 'cloakbrowser' has no attribute {name}")

__all__ = [
    "launch",
    "launch_async",
    "launch_context",
    "launch_context_async",
    "launch_persistent_context",
    "launch_persistent_context_async",
    "ensure_binary",
    "clear_cache",
    "binary_info",
    "check_for_update",
    "CHROMIUM_VERSION",
    "get_default_stealth_args",
    "build_args",
    "maybe_resolve_geoip",
    "ProxySettings",
    "validate_license",
    "LicenseInfo",
    "CloakBrowserLicenseError",
    "HumanConfig",
    "resolve_human_config",
    "__version__",
]


```

### Core Architecture Module: `cloakbrowser/__main__.py`
```
"""CLI for cloakbrowser — download and manage the stealth Chromium binary.

Usage:
    python -m cloakbrowser install      # Download binary (with progress)
    python -m cloakbrowser info         # Environment + binary diagnostics
    python -m cloakbrowser doctor       # Alias for `info`
    python -m cloakbrowser update       # Check for and download newer binary
    python -m cloakbrowser clear-cache  # Remove cached binaries
"""

from __future__ import annotations

import argparse
import importlib.util
import logging
import os
import platform
import subprocess
import sys


def _console_glyph(glyph: str, fallback: str) -> str:
    """Return an ASCII stand-in when the console can't encode `glyph`.

    Windows consoles default to cp850/cp1252, which carry none of the marks
    below — printing one there raises UnicodeEncodeError and aborts the report
    partway through. UTF-8 consoles keep the glyph.
    """
    encoding = getattr(sys.stdout, "encoding", None) or "ascii"
    try:
        glyph.encode(encoding)
    except (UnicodeEncodeError, LookupError):
        return fallback
    return glyph


MARK_OK = _console_glyph("✓", "OK")
MARK_FAIL = _console_glyph("✗", "x")
ARROW = _console_glyph("→", "->")
DASH = _console_glyph("—", "-")

UPGRADE_HINT = f"For more than one concurrent session {ARROW} https://cloakbrowser.dev"
FREE_LATEST_HINT = (
    f"Get the latest binary free {ARROW} run 'cloakbrowser login' "
    "or https://cloakbrowser.dev/free"
)


def _setup_logging() -> None:
    """Route cloakbrowser logger to stderr with clean output."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        stream=sys.stderr,
        force=True,
    )
    # Suppress noisy HTTP request logs from httpx
    logging.getLogger("httpx").setLevel(logging.WARNING)


def cmd_install(args: argparse.Namespace) -> None:
    from .download import ensure_binary

    path = ensure_binary()
    print(path)


def _module_available(module: str) -> bool:
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError):
        return False


def _binary_version(binary_path: str) -> tuple[bool, str, str]:
    """Launch `<binary> --version` to prove it runs. Returns (ok, version, err).

    Chromium only handles --version on POSIX, so on Windows the switch is ignored
    and a browser starts instead of printing — the probe then times out and a
    healthy install looks broken. --no-startup-window makes it exit right away
    without putting a window on screen; a broken binary still exits non-zero, so
    the check keeps its meaning. It just reports no version there, as nothing is
    printed.
    """
    argv = [binary_path, "--version"]
    if platform.system() == "Windows":
        argv.append("--no-startup-window")
    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, "", str(exc)
    if result.returncode != 0:
        return False, "", (result.stderr or result.stdout).strip()
    return True, result.stdout.strip(), ""


def _missing_shared_libs(binary_path: str) -> list[str]:
    """Linux-only: ldd the binary and return missing .so names (empty otherwise)."""
    if platform.system() != "Linux":
        return []
    try:
        result = subprocess.run(
            ["ldd", "--", binary_path],  # -- so a path starting with - isn't read as a flag
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    missing = []
    for line in result.stdout.splitlines():
        if "=> not found" in line:
            missing.append(line.split("=>")[0].strip())
    return missing


def _resolve_license() -> tuple[dict, bool]:
    """Resolve + validate the license the way ensure_binary does.

    Returns (license_section, entitled_to_pro). Network call (validate) only
    happens when a key is actually present.
    """
    from .license import resolve_license_key, validate_license

    key = resolve_license_key(None)
    # ensure_binary disables Pro routing when a custom download URL is set, so the
    # diagnostic must report free too (matches download.py).
    if os.environ.get("CLOAKBROWSER_DOWNLOAD_URL"):
        key = None
    if not key:
        return {"tier": "free"}, False
    try:
        lic = validate_license(key)
    except Exception as exc:
        return {"tier": "unknown", "error": str(exc)}, False
    if lic is None:
        return {"tier": "unknown", "error": "could not validate"}, False
    if lic.valid:
        return {"tier": lic.plan, "valid": True, "expires": lic.expires}, True
    return {"tier": "invalid", "valid": False}, False


def _effective_binary(entitled_pro: bool, quick: bool = False) -> dict:
    """Describe the binary ensure_binary would actually launch (no download).

    Mirrors ensure_binary's resolution (override > version pin > license tier).
    Unlike binary_info(), a Pro binary on disk is only reported when the license
    entitles Pro — so a keyless run correctly shows the free binary even if a
    Pro binary is cached.
    """
    from .config import (
        CHROMIUM_VERSION,
        _version_newer,
        get_binary_dir,
        get_binary_path,
        get_effective_version,
        get_local_binary_override,
        normalize_release_channel,
        normalize_requested_version,
    )

    override = get_local_binary_override()
    if override:
        return {
            "version": None,
            "latest_version": None,
            "pinned": False,
            "tier": "override",
            "bundled_version": CHROMIUM_VERSION,
            "path": override,
            "installed": os.path.isfile(override),
            "cache_dir": None,
            "override": override,
        }

    requested = normalize_requested_version(None)
    requested_channel = normalize_release_channel(None)

    # For a Pro license, surface the server's latest separately from the version
    # that will actually launch, so `info` can never silently diverge from launch
    # (the divergence a customer hit: info showed latest, launch ran a stale cache).
    # --quick keeps `info` fully network-free (skip the server latest lookup).
    latest_version = None
    resolved_channel = None
    channel_fallback = False
    if entitled_pro and not quick:
        from .license import get_pro_latest_release

        latest_release = get_pro_latest_release(requested_channel)
        if latest_release:
            latest_version = latest_release.version
            resolved_channel = latest_release.resolved_channel
            channel_fallback = latest_release.fallback

    installed_version = None
    if requested:
        version = requested
    elif entitled_pro:
        # Mirror ensure_binary: Preview/Stable resolution picks what the next
        # launch will run, while AUTO_UPDATE=false keeps an installed channel build.
        installed_version = get_effective_version(
            pro=True, release_channel=requested_channel
        )
        auto_update = os.environ.get("CLOAKBROWSER_AUTO_UPDATE", "true").lower()
        updates_enabled = auto_update != "false"
        if installed_version and not updates_enabled:
            version = installed_version
        elif latest_version and (
            not installed_version or _version_newer(latest_version, installed_version)
        ):
            version = latest_version
        else:
            version = installed_version or latest_version
    else:
        version = get_effective_version()
        installed_version = version

    path = get_binary_path(version, pro=entitled_pro) if version else None
    return {
        "version": version,
        "latest_version": latest_version,
        "requested_channel": requested_channel,
        "resolved_channel": resolved_channel,
        "channel_fallback": channel_fallback,
        "installed_version": installed_version,
        "pinned": bool(requested),
        "tier": "pro" if entitled_pro else "free",
        "bundled_version": CHROMIUM_VERSION,
        "path": str(path) if path else None,
        "installed": bool(path) and path.exists(),
        "cache_dir": str(get_binary_dir(version, pro=entitled_pro)) if version else None,
        "override": None,
    }


def _collect_diagnostics(quick: bool, proxy: str | None = None) -> dict:
    """Gather environment + binary diagnostics.

    Does not trigger a download unless ``proxy`` is given: with a proxy, the
    exit IP + timezone + locale a launch would apply are resolved (which caches
    the GeoIP DB if absent, exactly like a real launch).
    """
    diag: dict = {}

    from ._version import __version__

    diag["environment"] = {
        "wrapper": __version__,
        "python": sys.version.split()[0],
        "os": platform.system(),
        "arch": platform.machine(),
    }

    # Resolve the license up front — it decides which binary actually launches
    # (ensure_binary only uses the Pro binary when a key validates). Computed
    # before the binary section, displayed after it.
    license_info, entitled_pro = _resolve_license()

    # Live seat count — a Pro-only extra lookup, so gated exactly like the server
    # latest-version check below: --quick keeps `info` network-free, and a free
    # tier holds no seats. Never cached (a cached count is a wrong count).
    if entitled_pro and not quick:
        from .license import get_session_seats, resolve_license_key

        key = resolve_license_key(None)
        if key:
            seats = get_session_seats(key)
            license_info["sessions"] = {
                "active": seats.active,
                "limit": seats.limit,
                "state": seats.state,
                "reason": seats.reason,
            }

    from .config import get_platform_tag

 
```

### Core Architecture Module: `cloakbrowser/_version.py`
```
__version__ = "0.5.12"

```

### Core Architecture Module: `cloakbrowser/browser.py`
```
"""Core browser launch functions for cloakbrowser.

Provides launch() and launch_async() — thin wrappers around Playwright
that use our patched stealth Chromium binary instead of stock Chromium.

Usage:
    from cloakbrowser import launch

    browser = launch()
    page = browser.new_page()
    page.goto("https://protected-site.com")
    browser.close()
"""

from __future__ import annotations

import inspect
import logging
import os
import sys
from typing import Any, Literal, TypedDict
from urllib.parse import quote, unquote, urlparse, urlunparse

from .config import (
    DEFAULT_VIEWPORT,
    IGNORE_DEFAULT_ARGS,
    binary_supports_headless_no_viewport,
    binary_supports_http_proxy_inline_auth,
    binary_supports_maximized_window,
    get_default_stealth_args,
)
from .download import ensure_binary
from .license import (
    CloakBrowserLicenseError,
    build_launch_env,
    license_error_for_code,
    license_error_message,
    mint_denial_file,
    read_denial_file,
    resolve_license_key,
)
from .human.config import HumanConfigOverrides, HumanPreset
from .widevine import seed_widevine_hint

logger = logging.getLogger("cloakbrowser")


def _license_error(exc: BaseException) -> CloakBrowserLicenseError | None:
    """Return a CloakBrowserLicenseError if a launch failure was a license deny.

    The Pro binary exits with a distinct code (76-79) on a license problem;
    Playwright embeds that code in the launch-failure text. Returns None for any
    other failure so a genuine crash propagates unchanged.
    """
    msg = license_error_message(str(exc))
    return CloakBrowserLicenseError(msg) if msg is not None else None


# Factory methods whose return value is itself a handle the user drives (a page
# or context handed back after launch). Guarding these *deeply* — guarding the
# object they return — is what lets a denial that lands AFTER the handshake
# surface on the returned page's first call, not only on a second new_page().
_GUARD_FACTORY_METHODS = ("new_page", "new_context")

# Never wrap these. ``close`` already carries teardown logic and must not be
# turned into a license error mid-cleanup; the event-listener surface is called
# internally by Playwright (event dispatch), so throwing a license error from
# inside it would crash the driver rather than surface cleanly to the user.
_GUARD_SKIP_METHODS = frozenset({
    "close", "on", "once", "remove_listener",
})


class _Guarded:
    """A non-descriptor callable that wraps the guard closure.

    The guard is stored back on the target as a plain attribute, and humanize
    copies it into a ``type("Originals", ...)()`` holder and reads it off that
    *instance*. Anything with ``__get__`` (a bare function, or ``functools.partial``
    on Python 3.14+, where partial became a method descriptor) would re-bind to the
    holder and inject a spurious first positional arg. This class has no ``__get__``,
    so it stays inert wherever it is stored — on any Python version. Works for both
    the sync guard and the async guard: for the async case ``__call__`` returns the
    coroutine the closure produces, which the caller awaits. (issue #488)
    """

    __slots__ = ("_fn",)

    def __init__(self, fn: Any) -> None:
        self._fn = fn

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self._fn(*args, **kwargs)


def _denial_license_error(denial_path: str) -> CloakBrowserLicenseError | None:
    """Read the denial file and map it to a license error, or None."""
    code = read_denial_file(denial_path)
    return license_error_for_code(code) if code is not None else None


def _guardable_method_names(target: Any) -> list[str]:
    """Public, non-property callables on *target* — the methods that can raise a
    TargetClosedError once the browser dies. Properties are skipped by name so
    their getters are never triggered here; this covers every real method
    without enumerating them by hand.
    """
    names = []
    for name in dir(target):
        if name.startswith("_") or name in _GUARD_SKIP_METHODS:
            continue
        if isinstance(getattr(type(target), name, None), property):
            continue
        try:
            attr = getattr(target, name)
        except Exception:
            continue
        if callable(attr) and not isinstance(attr, type):
            names.append(name)
    return names


def _install_license_guard(target: Any, denial_path: str) -> None:
    """Guard every public method of *target* (a browser, context, or page) so a
    post-handshake license denial surfaces as CloakBrowserLicenseError on the
    user's first failing call — whichever method that is.

    A denial that lands after Playwright connected kills the browser without a
    launch failure; the user's next call would otherwise raise a bare
    TargetClosedError. Each wrapped method, on any exception, checks the denial
    file the binary wrote and re-raises as CloakBrowserLicenseError when a
    license code is present — otherwise the original error propagates unchanged,
    so a genuine crash is never mislabelled. Factory methods (new_page/
    new_context) additionally guard the object they return, so a page or context
    obtained after launch is covered too.
    """
    for name in _guardable_method_names(target):
        original = getattr(target, name)
        deep = name in _GUARD_FACTORY_METHODS

        def make(original: Any, deep: bool) -> Any:
            def guarded(*args: Any, **kwargs: Any) -> Any:
                try:
                    result = original(*args, **kwargs)
                except Exception as exc:
                    lic = _denial_license_error(denial_path)
                    if lic is not None:
                        raise lic from exc
                    raise
                # Even on success the browser may already be denied: the binary
                # writes the denial file the instant it's over cap but keeps
                # serving (blank) responses for ~1s before it exits. Check after
                # every call so the denial surfaces on the first call that runs
                # once the file exists, not only after the process has died.
                lic = _denial_license_error(denial_path)
                if lic is not None:
                    raise lic
                if deep and result is not None:
                    _install_license_guard(result, denial_path)
                return result
            return guarded

        # Wrap so the guard is NOT a descriptor. Playwright's real methods are
        # bound methods; humanize copies them into a class attribute
        # (type("Originals", ...)) and reads them back off an instance. A bare
        # function — or a functools.partial on Python 3.14+, where partial became
        # a method descriptor — would re-bind there and inject a spurious first
        # positional arg. _Guarded has no __get__, so it stays inert. (issue #488)
        setattr(target, name, _Guarded(make(original, deep)))


def _install_license_guard_async(target: Any, denial_path: str) -> None:
    """Async variant of :func:`_install_license_guard`. Only coroutine methods
    are wrapped — sync helpers (``is_closed``, ``on`` …) never do a CDP round
    trip and can't raise the disconnect error, and awaiting them would break.
    """
    for name in _guardable_method_names(target):
        original = getattr(target, name)
        if not inspect.iscoroutinefunction(original):
            continue
        deep = name in _GUARD_FACTORY_METHODS

        def make(original: Any, deep: bool) -> Any:
            async def guarded(*args: Any, **kwargs: Any) -> Any:
                try:
                    result = await original(*args, **kwargs)
                except Exception as exc:
                    lic = _denial_license_error(denial_path)
                    if lic is not None:
                        raise lic from exc
                    raise
                # See the sync variant: a denial can land while calls still
                # succeed, so check the file after every call, not just on error.
                lic = _denial_license_error(denial_path)
                if lic is not None:
                    raise lic
                if deep and result is not None:
                    _install_license_guard_async(result, denial_path)
                return result
            return guarded

        # Wrap so the guard is not a descriptor (see sync variant, issue #488).
        setattr(target, name, _Guarded(make(original, deep)))


# Sentinel to distinguish "viewport not provided" from "viewport=None" (disable emulation)
_VIEWPORT_UNSET = object()


def _default_no_viewport(browser: Any) -> None:
    """Default ``new_page()``/``new_context()`` to ``no_viewport=True``.

    ``launch()`` returns a raw Playwright ``Browser``; a bare ``browser.new_page()``
    would otherwise inherit Playwright's emulated 1280x720 viewport, producing
    ``outerWidth < innerWidth`` — a physically impossible window (bot tell). We wrap
    the two factory methods so pages track the real OS window instead. ``setdefault``
    only: an explicit ``viewport`` or ``no_viewport`` from the caller is never
    overridden (Playwright rejects passing both). Applied for headed launches only.
    Composes under humanize's ``patch_browser`` (apply this first).
    """
    orig_new_context = browser.new_context
    orig_new_page = browser.new_page

    def _patched_new_context(**kwargs: Any) -> Any:
        if "viewport" not in kwargs:
            kwargs.setdefault("no_viewport", True)
        return orig_new_context(**kwargs)

    def _patched_new_page(**kwargs: Any) -> Any:
        if "viewport" not in kwargs:
            kwargs.setdefault("no_viewport", True)
        return orig_new_page(**kwargs)

    browser.new_context = _patched_new_context
    browser.new_page = _patched_new_page


def _default_no_viewport_async(browser: Any) -> None:
    """Async variant of :func:`_default_no_view
```

### Core Architecture Module: `cloakbrowser/config.py`
```
"""Stealth configuration and platform detection for cloakbrowser."""

from __future__ import annotations

import os
import platform
import random
import re
from pathlib import Path


# ---------------------------------------------------------------------------
# Chromium version shipped with this release.
# Different platforms may ship different versions during transition periods.
# CHROMIUM_VERSION is the latest across all platforms (for display/reference).
# Use get_chromium_version() for the current platform's actual version.
# ---------------------------------------------------------------------------
CHROMIUM_VERSION = "146.0.7680.177.5"

PLATFORM_CHROMIUM_VERSIONS: dict[str, str] = {
    "linux-x64": "146.0.7680.177.5",
    "linux-arm64": "146.0.7680.177.3",
    "darwin-arm64": "145.0.7632.109.2",
    "darwin-x64": "145.0.7632.109.2",
    "windows-x64": "146.0.7680.177.5",
}

# ---------------------------------------------------------------------------
# Ed25519 public keys for verifying downloaded binaries.
#
# Each release publishes SHA256SUMS and a detached signature SHA256SUMS.sig.
# The wrapper verifies that signature against the keys below before trusting
# any hash in the manifest, so the download origin alone cannot certify a
# tampered binary. Values are base64 of the 32-byte raw public key. Multiple
# entries are accepted to allow key rotation.
# ---------------------------------------------------------------------------
BINARY_SIGNING_PUBKEYS: list[str] = [
    "MKFKwIhUcKWq5xTuNA0Ovg99njcDEcEJvmWYYhApvaU=",
]

# ---------------------------------------------------------------------------
# Playwright default args to suppress — these leak automation signals.
# --enable-automation: exposes navigator.webdriver = true
# --enable-unsafe-swiftshader: forces software WebGL rendering via SwiftShader,
#   producing a distinctive renderer string that no real user browser has
# ---------------------------------------------------------------------------
IGNORE_DEFAULT_ARGS = ["--enable-automation", "--enable-unsafe-swiftshader"]


# ---------------------------------------------------------------------------
# Default stealth arguments passed to the patched Chromium binary.
# These activate source-level fingerprint patches compiled into the binary.
# ---------------------------------------------------------------------------
def get_default_stealth_args() -> list[str]:
    """Build stealth args with a random fingerprint seed per launch.

    On macOS, skips platform/GPU spoofing — runs as a native Mac browser.
    Spoofing Windows on Mac creates detectable mismatches (fonts, GPU, etc.).
    """
    seed = random.randint(10000, 99999)
    system = platform.system()

    base = [
        "--no-sandbox",
        f"--fingerprint={seed}",
    ]

    if system == "Darwin":
        # Tell the fingerprint patches we're on macOS so GPU/UA match natively
        return base + ["--fingerprint-platform=macos"]

    # Linux/Windows: Windows fingerprint profile.
    # Screen and window size come from the real display, not this flag (verified:
    # identical across seeds), so the wrapper must not emulate a viewport on top in
    # headed mode — that would break outerWidth >= innerWidth coherence.
    return base + ["--fingerprint-platform=windows"]


# ---------------------------------------------------------------------------
# Default viewport — used for HEADLESS only (headed launches use no_viewport so
# the page tracks the real window). Headless has no window chrome, so a fixed
# viewport stays coherent (outer == inner) and gives deterministic dimensions.
# Models a maximized Chrome on 1080p Windows: screen=1920x1080,
# innerHeight=947 (minus ~85px Chrome UI: tabs + address bar + bookmarks).
# ---------------------------------------------------------------------------
DEFAULT_VIEWPORT = {"width": 1920, "height": 947}

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
SUPPORTED_PLATFORMS: dict[tuple[str, str], str] = {
    ("Linux", "x86_64"): "linux-x64",
    ("Linux", "aarch64"): "linux-arm64",
    ("Darwin", "arm64"): "darwin-arm64",
    ("Darwin", "x86_64"): "darwin-x64",
    ("Windows", "AMD64"): "windows-x64",
    ("Windows", "x86_64"): "windows-x64",
}

# Platforms with pre-built binaries available for download (derived from version map).
AVAILABLE_PLATFORMS: set[str] = set(PLATFORM_CHROMIUM_VERSIONS.keys())


_VERSION_PIN_RE = re.compile(r"^[0-9]+(?:\.[0-9]+){3,4}$")


def normalize_release_channel(release_channel: str | None = None) -> str:
    """Return the requested release channel, defaulting to Stable."""
    raw = (
        release_channel
        if release_channel is not None
        else os.environ.get("CLOAKBROWSER_RELEASE_CHANNEL", "stable")
    )
    return "preview" if raw.strip().lower() == "preview" else "stable"


def normalize_requested_version(version: str | None = None) -> str | None:
    """Return an explicit Chromium version pin from arg/env, or None.

    The explicit argument wins over CLOAKBROWSER_VERSION. Only numeric dotted
    versions are accepted because the value is interpolated into cache paths and
    download URLs.
    """
    raw = version if version is not None else os.environ.get("CLOAKBROWSER_VERSION")
    if raw is None:
        return None
    normalized = raw.strip()
    if not normalized:
        return None
    if not _VERSION_PIN_RE.fullmatch(normalized):
        raise ValueError(
            "Invalid browser version pin. Use a full numeric Chromium version, "
            "e.g. '148.0.7778.215.2'."
        )
    return normalized


def get_chromium_version() -> str:
    """Return the Chromium version for the current platform."""
    tag = get_platform_tag()
    return PLATFORM_CHROMIUM_VERSIONS.get(tag, CHROMIUM_VERSION)


def get_platform_tag() -> str:
    """Return the platform tag for binary download (e.g. 'linux-x64', 'darwin-arm64')."""
    system = platform.system()
    machine = platform.machine()
    tag = SUPPORTED_PLATFORMS.get((system, machine))
    if tag is None:
        raise RuntimeError(
            f"Unsupported platform: {system} {machine}. "
            f"Supported: {', '.join(f'{s}-{m}' for (s, m) in SUPPORTED_PLATFORMS)}"
        )
    return tag


# ---------------------------------------------------------------------------
# Binary cache paths
# ---------------------------------------------------------------------------
def get_cache_dir() -> Path:
    """Return the cache directory for downloaded binaries.

    Override with CLOAKBROWSER_CACHE_DIR env var.
    Default: ~/.cloakbrowser/
    """
    custom = os.environ.get("CLOAKBROWSER_CACHE_DIR")
    if custom:
        return Path(custom)
    return Path.home() / ".cloakbrowser"


def get_binary_dir(version: str | None = None, pro: bool = False) -> Path:
    """Return the directory for a Chromium version binary."""
    v = version or get_chromium_version()
    suffix = "-pro" if pro else ""
    return get_cache_dir() / f"chromium-{v}{suffix}"


def get_binary_path(version: str | None = None, pro: bool = False) -> Path:
    """Return the expected path to the chrome executable."""
    binary_dir = get_binary_dir(version, pro=pro)

    if platform.system() == "Darwin":
        # macOS: Chromium.app bundle
        return binary_dir / "Chromium.app" / "Contents" / "MacOS" / "Chromium"
    elif platform.system() == "Windows":
        return binary_dir / "chrome.exe"
    else:
        # Linux: flat binary
        return binary_dir / "chrome"


def check_platform_available() -> None:
    """Raise a clear error if no pre-built binary exists for this platform.

    Skipped when CLOAKBROWSER_BINARY_PATH is set (user has their own build).
    """
    if get_local_binary_override():
        return

    tag = get_platform_tag()  # raises if platform unsupported entirely
    if tag not in AVAILABLE_PLATFORMS:
        available = ", ".join(sorted(AVAILABLE_PLATFORMS))
        import sys

        sys.exit(
            f"\n\033[1mCloakBrowser\033[0m — Pre-built binaries are currently only available for: {available}.\n\n"
            f"To use CloakBrowser now, set CLOAKBROWSER_BINARY_PATH to a local Chromium binary."
        )


def get_effective_version(
    pro: bool = False, release_channel: str | None = None
) -> str | None:
    """Return the best available version: auto-updated if available, else platform default.

    Reads a platform-scoped marker file from the cache directory.
    Returns the platform's hardcoded version if no update has been downloaded.

    When ``pro=True``, reads from the Pro-specific marker and returns ``None`` when
    no cached Pro binary matches it. A valid Pro license must NEVER fall back to the
    free binary, so there is deliberately no free-version fallback here — callers
    treat ``None`` as "resolve the latest Pro version from the server" instead.
    """
    base = get_chromium_version()
    cache = get_cache_dir()

    if pro:
        channel = normalize_release_channel(release_channel)
        marker_prefix = (
            "latest_pro_version_preview"
            if channel == "preview"
            else "latest_pro_version"
        )
        marker = cache / f"{marker_prefix}_{get_platform_tag()}"
        if marker.exists():
            try:
                version = marker.read_text().strip()
                if version:
                    binary = get_binary_path(version, pro=True)
                    # Match launch's _pro_binary_ready (exists AND executable) so
                    # `info` never reports a build that launch would reject.
                    if binary.exists() and os.access(binary, os.X_OK):
                        return version
            except (ValueError, OSError):
                pass
        return None

    # Free tier: try platform-scoped marker first, fall back to legacy marker
    for name in (f"latest_version_{get
```

### Core Architecture Module: `cloakbrowser/download.py`
```
"""Binary download and cache management for cloakbrowser.

Downloads the patched Chromium binary on first use, caches it locally.
Similar to how Playwright downloads its own bundled Chromium.
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import platform
import stat
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from pathlib import Path

import httpx

from ._version import __version__ as _wrapper_version
from .config import (
    BINARY_SIGNING_PUBKEYS,
    CHROMIUM_VERSION,
    DOWNLOAD_BASE_URL,
    GITHUB_API_URL,
    GITHUB_DOWNLOAD_BASE_URL,
    _version_newer,
    check_platform_available,
    get_archive_ext,
    get_archive_name,
    get_binary_dir,
    get_binary_path,
    get_cache_dir,
    get_chromium_version,
    get_download_url,
    get_effective_version,
    get_fallback_download_url,
    get_local_binary_override,
    get_platform_tag,
    normalize_release_channel,
    normalize_requested_version,
)

logger = logging.getLogger("cloakbrowser")


class BinaryVerificationError(RuntimeError):
    """A downloaded binary could not be authenticated (bad/missing signature,
    version mismatch, or checksum failure).

    Distinct from transient download/network errors: a verification failure is
    a tampering signal and MUST surface, never silently fall back to another
    binary. The Pro routing in ensure_binary re-raises this rather than
    downgrading to the free tier.
    """


# Timeout for download (large binary, allow 10 min)
DOWNLOAD_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)

# Auto-update check interval (1 hour)
UPDATE_CHECK_INTERVAL = 3600

# Free-tier welcome banner re-show interval (1 day). Free users see the
# "get the latest free" invite again after this gap; Pro users see it only once
# (see _show_welcome).
WELCOME_FREE_INTERVAL = 24 * 3600

# Pro Chromium major shown in the free-tier welcome banner. Bump at each Pro
# major release (there is no local constant to derive it from — the live Pro
# version comes from the network, which we don't call just to print a banner).
PRO_MAJOR = "152"


def _welcome_due(marker: Path, pro: bool) -> bool:
    """Whether the welcome banner should be shown now.

    Pro: once ever (only when the marker is absent). Free: re-show when the
    marker is absent or its timestamp is older than WELCOME_FREE_INTERVAL.
    Unreadable or legacy empty markers count as stale (due).
    """
    if not marker.exists():
        return True
    if pro:
        return False
    try:
        last = int(marker.read_text().strip())
    except (OSError, ValueError):
        return True
    return (time.time() - last) >= WELCOME_FREE_INTERVAL


_preview_fallback_warned = False


def _warn_preview_fallback() -> None:
    """Tell the user, once per process, that a requested Preview build does not
    exist for this platform and the Stable build is being used instead."""
    global _preview_fallback_warned
    if _preview_fallback_warned:
        return
    _preview_fallback_warned = True
    # Write straight to stderr (like the welcome banner) so an app's logging
    # config can't silence it.
    sys.stderr.write(
        "[cloakbrowser] Preview channel requested, but no preview build is "
        f"available for {get_platform_tag()}; using the stable build.\n"
    )


def _emit(text: str) -> None:
    """Write a cosmetic line to stderr, swallowing any error.

    On a legacy Windows console sys.stderr is cp1252/strict; an unencodable
    glyph raises UnicodeEncodeError. Because the welcome banner runs on the
    binary-download path, that would abort the whole launch (ticket 2354).
    A banner is decoration - never let it propagate.
    """
    try:
        sys.stderr.write(text)
    except Exception:
        pass


def _show_welcome(tier: str = "keyless") -> None:
    """Show welcome message on launch. A marker file gates the cadence: a paid
    (Pro) key shows once ever; free (keyless or a free GitHub key) re-shows every
    WELCOME_FREE_INTERVAL.

    tier:
      "pro"     — a paid license key (Pro banner + support address)
      "free"    — a free GitHub key (latest binary, one concurrent session)
      "keyless" — no key, running the older free binary (invite the free login)
    """
    marker = get_cache_dir() / ".welcome_shown"
    if not _welcome_due(marker, pro=(tier == "pro")):
        return
    # ASCII-only banner + a swallow-everything writer: on a legacy Windows
    # console sys.stderr is cp1252/strict, so a non-ASCII glyph (or any IO
    # error) here would raise and abort the whole binary-download path. A
    # cosmetic banner must never be able to kill a launch.
    _emit("\n")
    _emit("  CloakBrowser - stealth Chromium for automation\n")
    _emit("  https://github.com/CloakHQ/CloakBrowser\n")
    _emit("\n")
    if tier == "pro":
        _emit(
            f"  CloakBrowser Pro active (v{PRO_MAJOR}) - latest binary, newest patches.\n"
        )
        _emit("  Pro support -> support@cloakbrowser.dev\n")
    elif tier == "free":
        _emit(
            f"  CloakBrowser free (v{PRO_MAJOR}): the latest binary, 1 concurrent session.\n"
        )
        _emit(
            "  For more than one concurrent session -> https://cloakbrowser.dev\n"
        )
    else:
        free_major = CHROMIUM_VERSION.split(".")[0]
        _emit(
            f"  Running the free binary (v{free_major}). "
            f"The latest binary (v{PRO_MAJOR}) is free too, with 1 concurrent session.\n"
        )
        _emit(
            "  Get your key: run  cloakbrowser login  or visit https://cloakbrowser.dev/free\n"
        )
        _emit(
            "  For more than one concurrent session -> https://cloakbrowser.dev\n"
        )
    _emit("  Star us if CloakBrowser helps your project!\n")
    _emit("\n")
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(str(int(time.time())))
    except OSError:
        pass


def ensure_binary(
    license_key: str | None = None,
    browser_version: str | None = None,
    release_channel: str | None = None,
) -> str:
    """Ensure the stealth Chromium binary is available. Download if needed.

    Returns the path to the chrome executable as a string.

    Args:
        license_key: Pro license key. Also reads from CLOAKBROWSER_LICENSE_KEY env var.
        browser_version: Exact Chromium version pin. Also reads from CLOAKBROWSER_VERSION.
        release_channel: Stable (default) or Preview binary channel.

    Set CLOAKBROWSER_BINARY_PATH to skip download and use a local build.
    """
    # Check for local override first
    local_override = get_local_binary_override()
    if local_override:
        path = Path(local_override)
        if not path.exists():
            raise FileNotFoundError(
                f"CLOAKBROWSER_BINARY_PATH set to '{local_override}' but file does not exist"
            )
        logger.info("Using local binary override: %s", local_override)
        return str(path)

    requested_version = normalize_requested_version(browser_version)

    # Pro license key check (custom download URL overrides Pro path)
    from .license import (
        CloakBrowserLicenseError,
        resolve_license_key,
        validate_license,
    )

    key = resolve_license_key(license_key)
    if os.environ.get("CLOAKBROWSER_DOWNLOAD_URL"):
        key = None

    if key:
        info = validate_license(key)
        if info and info.valid:
            # Free tier always gets the latest build. Drop any version pin: the
            # server force-serves latest to free keys, so fetching a pinned
            # version's signed manifest would mismatch the served bytes and fail
            # checksum verification. Paid keys keep pinning/rollback.
            if info.plan == "free":
                requested_version = None
            # A valid license is entitled to Pro, so Pro failures surface loudly
            # rather than silently substituting the older free binary. (A blip
            # during a routine update never reaches here: _ensure_pro_binary
            # returns the cached Pro binary and updates in the background.)
            try:
                return _ensure_pro_binary(
                    key,
                    requested_version=requested_version,
                    plan=info.plan,
                    release_channel=release_channel,
                )
            except BinaryVerificationError:
                # Authenticity could not be confirmed — surface verbatim.
                raise
            except Exception as e:
                # Transient failure with no cached Pro binary to use — surface a
                # clear error rather than silently downloading the free binary.
                raise RuntimeError(
                    f"Pro binary unavailable: {e}. Your license is valid but the "
                    f"Pro binary could not be downloaded right now. Retry in a "
                    f"moment. To use the free binary instead, unset "
                    f"CLOAKBROWSER_LICENSE_KEY."
                ) from e
        elif info:
            # Key supplied but rejected — abort, never downgrade to free.
            raise CloakBrowserLicenseError(
                f"CloakBrowser Pro: license key is invalid or expired "
                f"(plan={info.plan}). Check CLOAKBROWSER_LICENSE_KEY, or unset it "
                f"to use the free binary."
            )
        else:
            # Key supplied but unvalidatable (server down, no cache) — abort.
            raise CloakBrowserLicenseError(
                "CloakBrowser Pro: license could not be validated (server "
                "unreachable and no cached validation). Retry in a moment, or "
                "unset CLOAKBROWSER_LICENSE_KEY to use the free binary."
            )

    # Fail fast if no binary available for this platform
    check_platform_available()

    if requested_version:
        bina
```

### Core Architecture Module: `cloakbrowser/geoip.py`
```
"""GeoIP-based timezone and locale detection from proxy IP.

Optional feature — requires ``geoip2`` package::

    pip install cloakbrowser[geoip]

Downloads GeoLite2-City.mmdb (~70 MB) on first use, caches in
``~/.cloakbrowser/geoip/``.  Background re-download after 30 days.
"""

from __future__ import annotations

import ipaddress
import logging
import math
import os
import socket
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger("cloakbrowser")

# P3TERX mirror of MaxMind GeoLite2-City — no license key needed
GEOIP_DB_URL = (
    "https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb"
)
GEOIP_DB_FILENAME = "GeoLite2-City.mmdb"
GEOIP_UPDATE_INTERVAL = 30 * 86_400  # 30 days
DEFAULT_GEOIP_TIMEOUT_SECONDS = 20.0
GEOIP_TIMEOUT_ENV = "CLOAKBROWSER_GEOIP_TIMEOUT_SECONDS"

# Serializes GeoIP DB downloads within a process so N concurrent launches
# don't each fetch the same ~70 MB file (issue #458). Per-process only.
_GEOIP_DOWNLOAD_LOCK = threading.Lock()

# Country ISO code → BCP 47 locale (covers ~90 % of proxy traffic)
COUNTRY_LOCALE_MAP: dict[str, str] = {
    "US": "en-US", "GB": "en-GB", "AU": "en-AU", "CA": "en-CA", "NZ": "en-NZ",
    "IE": "en-IE", "ZA": "en-ZA", "SG": "en-SG",
    "DE": "de-DE", "AT": "de-AT", "CH": "de-CH",
    "FR": "fr-FR", "BE": "fr-BE",
    "ES": "es-ES", "MX": "es-MX", "AR": "es-AR", "CO": "es-CO", "CL": "es-CL",
    "BR": "pt-BR", "PT": "pt-PT",
    "IT": "it-IT", "NL": "nl-NL",
    "JP": "ja-JP", "KR": "ko-KR", "CN": "zh-CN", "TW": "zh-TW", "HK": "zh-HK",
    "RU": "ru-RU", "UA": "uk-UA", "PL": "pl-PL", "CZ": "cs-CZ", "RO": "ro-RO",
    "IL": "he-IL", "TR": "tr-TR", "SA": "ar-SA", "AE": "ar-AE", "EG": "ar-EG",
    "IN": "hi-IN", "ID": "id-ID", "PH": "en-PH",
    "TH": "th-TH", "VN": "vi-VN", "MY": "ms-MY",
    "SE": "sv-SE", "NO": "nb-NO", "DK": "da-DK", "FI": "fi-FI",
    "GR": "el-GR", "HU": "hu-HU", "BG": "bg-BG",
    # Extended coverage — common residential/mobile proxy exits
    "SI": "sl-SI", "SK": "sk-SK", "HR": "hr-HR", "RS": "sr-RS", "LT": "lt-LT",
    "LV": "lv-LV", "EE": "et-EE", "IS": "is-IS", "LU": "fr-LU", "MT": "en-MT",
    "CY": "el-CY", "MD": "ro-MD", "BY": "ru-BY", "GE": "ka-GE", "AL": "sq-AL",
    "MK": "mk-MK", "BA": "bs-BA",
    "PE": "es-PE", "VE": "es-VE", "EC": "es-EC", "UY": "es-UY", "CR": "es-CR",
    "DO": "es-DO", "GT": "es-GT", "BO": "es-BO", "PY": "es-PY",
    "PK": "en-PK", "BD": "bn-BD", "LK": "si-LK", "KZ": "ru-KZ", "IR": "fa-IR",
    "IQ": "ar-IQ", "JO": "ar-JO", "LB": "ar-LB", "KW": "ar-KW", "QA": "ar-QA",
    "OM": "ar-OM", "BH": "ar-BH",
    "NG": "en-NG", "KE": "en-KE", "MA": "fr-MA", "DZ": "ar-DZ", "TN": "ar-TN",
    "GH": "en-GH",
    "AM": "hy-AM", "AZ": "az-AZ", "UZ": "uz-UZ", "KG": "ky-KG", "TJ": "tg-TJ",
    "TM": "tk-TM",
    "ME": "sr-ME", "XK": "sq-XK", "LI": "de-LI", "MC": "fr-MC", "AD": "ca-AD",
    "MM": "my-MM", "KH": "km-KH", "LA": "lo-LA", "MN": "mn-MN", "BN": "ms-BN",
    "MO": "zh-MO",
    "YE": "ar-YE", "SY": "ar-SY", "PS": "ar-PS", "LY": "ar-LY",
    "ET": "am-ET", "TZ": "sw-TZ", "UG": "en-UG", "SN": "fr-SN", "CI": "fr-CI",
    "CM": "fr-CM", "AO": "pt-AO", "MZ": "pt-MZ", "ZM": "en-ZM", "ZW": "en-ZW",
    "HN": "es-HN", "NI": "es-NI", "SV": "es-SV", "PA": "es-PA", "JM": "en-JM",
    "TT": "en-TT", "PR": "es-PR",
}


def resolve_proxy_geo(proxy_url: str | None) -> tuple[str | None, str | None]:
    """Resolve timezone and locale from a proxy's IP address.

    Returns ``(timezone, locale)``. Raises when the exit IP, database, or
    database lookup cannot be resolved.

    When *proxy_url* is falsy, the machine's own public IP is used instead
    (direct HTTP to the echo services, no proxy).
    """
    tz, locale, _ip = resolve_proxy_geo_with_ip(proxy_url)
    return tz, locale


def resolve_proxy_geo_with_ip(
    proxy_url: str | None,
) -> tuple[str | None, str | None, str | None]:
    """Resolve timezone, locale, and exit IP from a proxy.

    Returns ``(timezone, locale, exit_ip)``.  The exit IP is a free bonus
    from the lookup — reused for WebRTC spoofing without an extra HTTP call.

    When *proxy_url* is falsy, the egress IP is the machine's own public IP
    (echo services queried directly, no proxy), so geoip works proxy-free.
    """
    try:
        import geoip2.database  # noqa: F811
    except ImportError:
        raise ImportError(
            "geoip2 is required for geoip=True. Install it with:\n"
            "  pip install 'cloakbrowser[geoip]'"
        ) from None

    # Ensure the DB first — the download must NOT be bounded by the resolution
    # timeout (a first-use ~70MB fetch legitimately outlasts it).
    db_path = _ensure_geoip_db()

    timeout = _get_geoip_timeout_seconds()
    deadline = _deadline_from_timeout(timeout)

    # Exit IP (through proxy, or the machine's own public IP when proxy_url is
    # falsy) is most accurate — gateway DNS may differ from exit. Resolved even
    # when the DB is unavailable: the IP does not need the DB, and dropping it on
    # a DB hiccup would let WebRTC fall back to the real IP behind a proxy while
    # the connection shows the proxy IP — a real deanonymization.
    ip = _resolve_exit_ip(proxy_url, timeout=_remaining_seconds(deadline))
    # Hostname fallback only applies to a proxy; no proxy → echo services only
    if ip is None and proxy_url and not _deadline_expired(deadline):
        ip = _resolve_proxy_ip(proxy_url)
    if ip is None or _deadline_expired(deadline):
        if deadline is not None and _deadline_expired(deadline):
            raise RuntimeError(f"GeoIP resolution timed out after {timeout:.1f}s")
        raise RuntimeError("GeoIP resolution failed: could not discover the egress IP")

    if db_path is None:
        raise RuntimeError("GeoIP resolution failed: GeoIP database is unavailable")

    try:
        with geoip2.database.Reader(str(db_path)) as reader:
            resp = reader.city(ip)
            timezone = resp.location.time_zone
            country = resp.country.iso_code
            locale = COUNTRY_LOCALE_MAP.get(country) if country else None
            logger.debug(
                "GeoIP: %s → tz=%s, country=%s, locale=%s",
                ip, timezone, country, locale,
            )
            return timezone, locale, ip
    except Exception as exc:
        raise RuntimeError(f"GeoIP lookup failed for {ip}: {exc}") from exc


# ---------------------------------------------------------------------------
# Proxy IP resolution
# ---------------------------------------------------------------------------


def _resolve_proxy_ip(proxy_url: str) -> str | None:
    """Extract proxy hostname from URL and resolve to an IP address."""
    try:
        hostname = urlparse(proxy_url).hostname
        if not hostname:
            return None

        # Already a literal IP?
        try:
            socket.inet_pton(socket.AF_INET, hostname)
            return hostname
        except OSError:
            pass
        try:
            socket.inet_pton(socket.AF_INET6, hostname)
            return hostname
        except OSError:
            pass

        # DNS resolve (returns first result, handles both v4/v6)
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        if results:
            ip = results[0][4][0]
            logger.debug("Resolved proxy %s → %s", hostname, ip)
            return ip
        return None
    except Exception as exc:
        logger.warning("Failed to resolve proxy hostname: %s", exc)
        return None


def _is_private_ip(ip: str) -> bool:
    """Check if an IP address is private/internal (not routable on the internet)."""
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


# IP echo services — fast, no auth, return just the IP
_IP_ECHO_URLS = [
    "https://api.ipify.org",
    "https://checkip.amazonaws.com",
    "https://ifconfig.me/ip",
]


def _get_geoip_timeout_seconds() -> float:
    raw = os.getenv(GEOIP_TIMEOUT_ENV)
    if not raw:
        return DEFAULT_GEOIP_TIMEOUT_SECONDS
    try:
        timeout = float(raw)
    except ValueError:
        timeout = float("nan")
    if not math.isfinite(timeout):
        logger.warning(
            "Invalid %s=%r; using %.1fs",
            GEOIP_TIMEOUT_ENV,
            raw,
            DEFAULT_GEOIP_TIMEOUT_SECONDS,
        )
        return DEFAULT_GEOIP_TIMEOUT_SECONDS
    return max(timeout, 0.0)


def _deadline_from_timeout(timeout: float) -> float | None:
    if timeout <= 0:
        return None
    return time.monotonic() + timeout


def _remaining_seconds(deadline: float | None) -> float | None:
    if deadline is None:
        return None
    return max(deadline - time.monotonic(), 0.0)


def _deadline_expired(deadline: float | None) -> bool:
    return deadline is not None and time.monotonic() >= deadline


def resolve_proxy_exit_ip(proxy_url: str | None) -> str | None:
    """Resolve the egress IP, bounded by the GeoIP timeout.

    With a proxy this is the proxy's exit IP; with no proxy it is the
    machine's own public IP (echo services queried directly).
    """
    timeout = _get_geoip_timeout_seconds()
    deadline = _deadline_from_timeout(timeout)
    ip = _resolve_exit_ip(proxy_url, timeout=timeout)
    if ip is None and _deadline_expired(deadline):
        logger.warning("Proxy exit-IP resolution timed out after %.1fs", timeout)
    return ip


def _resolve_exit_ip(proxy_url: str | None, timeout: float | None = None) -> str | None:
    """Discover the egress IP via the echo services.

    Through *proxy_url* when given (the proxy's exit IP); directly (no proxy)
    when *proxy_url* is falsy — that returns the machine's own public IP.
    """
    import httpx

    deadline = _deadline_from_timeout(timeout or 0)

    for url in _IP_ECHO_URLS:
        try:
            remaining = _remaining_seconds(deadline)
            if remaining is not None and 
```

### Core Architecture Module: `cloakbrowser/human/__init__.py`
```
"""Human-like behavioral layer for cloakbrowser.

Activated via humanize=True in launch() / launch_async().
Patches page methods to use Bezier mouse curves, realistic typing, and smooth scrolling.

Stealth-aware (fixes #110):
  - Selector state, geometry, and hit-testing stay in a CDP isolated world
  - Shift symbol typing uses CDP Input.dispatchKeyEvent for isTrusted=true events
  - Unsupported/unavailable isolated reads fail explicitly without DOM-read fallback

Supports both sync and async Playwright APIs.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any, Optional

from .config import HumanConfig, HumanPreset, resolve_config, merge_config
from .config import rand, rand_range, sleep_ms, async_sleep_ms
from .mouse import RawMouse, human_move, human_click, click_target, human_idle
from .keyboard import RawKeyboard, human_type
from .scroll import scroll_to_element, human_scroll_into_view
from .mouse_async import AsyncRawMouse, async_human_move, async_human_click, async_human_idle
from .keyboard_async import AsyncRawKeyboard, async_human_type
from .scroll_async import async_scroll_to_element, async_human_scroll_into_view
from .actionability import (
    ensure_actionable, ensure_stable, check_pointer_events,
    ensure_actionable_handle, check_pointer_events_handle,
    ActionabilityError, ElementNotAttachedError, ElementNotVisibleError,
    ElementNotStableError, ElementNotEnabledError, ElementNotEditableError,
    ElementNotReceivingEventsError,
    CHECKS_CLICK, CHECKS_HOVER, CHECKS_INPUT, CHECKS_FOCUS, CHECKS_CHECK,
)
from .actionability_async import (
    async_ensure_actionable, async_ensure_stable, async_check_pointer_events,
    async_ensure_actionable_handle, async_check_pointer_events_handle,
)
from .stealth_dom import (
    async_eval_parsed, build_snapshot_js, eval_parsed,
    NOT_FOUND, OK, UNSUPPORTED,
    StealthEvaluationError, StealthWorldUnavailableError,
    UnsupportedHumanizeSelectorError,
)

_SELECT_ALL = "Meta+a" if sys.platform == "darwin" else "Control+a"


def _keyboard_press_kwargs(kwargs: dict[str, Any], default_delay: Optional[float] = None) -> dict[str, Any]:
    """Return only options accepted by Playwright's Keyboard.press()."""
    if "delay" in kwargs:
        return {"delay": kwargs["delay"]}
    if default_delay is not None:
        return {"delay": default_delay}
    return {}


__all__ = [
    "patch_browser", "patch_context", "patch_page",
    "patch_browser_async", "patch_context_async", "patch_page_async",
    "HumanConfig", "resolve_config", "merge_config",
    "human_move", "human_click", "click_target", "human_idle",
    "human_type", "scroll_to_element", "human_scroll_into_view",
]

logger = logging.getLogger("cloakbrowser.human")


# ============================================================================
# CDP Isolated World — stealth DOM evaluation
# ============================================================================

class _SyncIsolatedWorld:
    """Manages a CDP isolated execution context for DOM reads (sync).

    Produces clean Error.stack traces (no 'eval at evaluate :302:')
    and is invisible to querySelector monkey-patches in the main world.
    Context ID is invalidated on navigation and auto-recreated on next call.
    """

    __slots__ = ("_page", "_cdp", "_context_id")

    def __init__(self, page: Any):
        self._page = page
        self._cdp: Any = None
        self._context_id: Optional[int] = None

    def _ensure_cdp(self) -> Any:
        if self._cdp is None:
            self._cdp = self._page.context.new_cdp_session(self._page)
        return self._cdp

    def _create_world(self) -> int:
        cdp = self._ensure_cdp()
        tree = cdp.send("Page.getFrameTree")
        frame_id = tree["frameTree"]["frame"]["id"]
        result = cdp.send("Page.createIsolatedWorld", {
            "frameId": frame_id,
            "worldName": "",
            "grantUniveralAccess": True,
        })
        self._context_id = result["executionContextId"]
        return self._context_id

    def evaluate(self, expression: str) -> Any:
        """Evaluate JS in isolated world. Auto-recreates on stale context."""
        if self._context_id is None:
            self._create_world()

        for attempt in range(2):
            try:
                result = self._cdp.send("Runtime.evaluate", {
                    "expression": expression,
                    "contextId": self._context_id,
                    "returnByValue": True,
                })
                if "exceptionDetails" in result:
                    if attempt == 0:
                        self._create_world()
                        continue
                    return None
                return result.get("result", {}).get("value")
            except Exception:
                if attempt == 0:
                    self._context_id = None
                    try:
                        self._create_world()
                    except Exception:
                        return None
                    continue
                return None
        return None

    def invalidate(self) -> None:
        """Mark context as stale — call after navigation."""
        self._context_id = None

    def get_cdp_session(self) -> Any:
        """Get the underlying CDP session (reused for Input.dispatchKeyEvent)."""
        return self._ensure_cdp()


class _AsyncIsolatedWorld:
    """Manages a CDP isolated execution context for DOM reads (async).

    Same as _SyncIsolatedWorld but uses await for all CDP calls.
    """

    __slots__ = ("_page", "_cdp", "_context_id")

    def __init__(self, page: Any):
        self._page = page
        self._cdp: Any = None
        self._context_id: Optional[int] = None

    async def _ensure_cdp(self) -> Any:
        if self._cdp is None:
            self._cdp = await self._page.context.new_cdp_session(self._page)
        return self._cdp

    async def _create_world(self) -> int:
        cdp = await self._ensure_cdp()
        tree = await cdp.send("Page.getFrameTree")
        frame_id = tree["frameTree"]["frame"]["id"]
        result = await cdp.send("Page.createIsolatedWorld", {
            "frameId": frame_id,
            "worldName": "",
            "grantUniveralAccess": True,
        })
        self._context_id = result["executionContextId"]
        return self._context_id

    async def evaluate(self, expression: str) -> Any:
        """Evaluate JS in isolated world. Auto-recreates on stale context."""
        if self._context_id is None:
            await self._create_world()

        for attempt in range(2):
            try:
                result = await self._cdp.send("Runtime.evaluate", {
                    "expression": expression,
                    "contextId": self._context_id,
                    "returnByValue": True,
                })
                if "exceptionDetails" in result:
                    if attempt == 0:
                        await self._create_world()
                        continue
                    return None
                return result.get("result", {}).get("value")
            except Exception:
                if attempt == 0:
                    self._context_id = None
                    try:
                        await self._create_world()
                    except Exception:
                        return None
                    continue
                return None
        return None

    def invalidate(self) -> None:
        """Mark context as stale — call after navigation."""
        self._context_id = None

    async def get_cdp_session(self) -> Any:
        """Get the underlying CDP session (reused for Input.dispatchKeyEvent)."""
        return await self._ensure_cdp()


# ============================================================================
# Cursor state
# ============================================================================

class _CursorState:
    __slots__ = ("x", "y", "initialized")

    def __init__(self) -> None:
        self.x: float = 0
        self.y: float = 0
        self.initialized: bool = False


# ============================================================================
# Stealth DOM queries — canonical isolated-world snapshot only
# ============================================================================

def _selector_snapshot(page: Any, selector: str) -> dict:
    world = getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    status, data = eval_parsed(world, build_snapshot_js(selector))
    if status == OK:
        return data
    if status == NOT_FOUND:
        raise ElementNotAttachedError(selector)
    if status == UNSUPPORTED:
        raise UnsupportedHumanizeSelectorError(selector)
    raise StealthEvaluationError(selector)


async def _async_selector_snapshot(page: Any, selector: str) -> dict:
    world = getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    status, data = await async_eval_parsed(world, build_snapshot_js(selector))
    if status == OK:
        return data
    if status == NOT_FOUND:
        raise ElementNotAttachedError(selector)
    if status == UNSUPPORTED:
        raise UnsupportedHumanizeSelectorError(selector)
    raise StealthEvaluationError(selector)


def _is_input_element(page: Any, selector: str) -> bool:
    return bool(_selector_snapshot(page, selector)["isInput"])


async def _async_is_input_element(page: Any, selector: str) -> bool:
    return bool((await _async_selector_snapshot(page, selector))["isInput"])


def _is_selector_focused(page: Any, selector: str) -> bool:
    return bool(_selector_snapshot(page, selector)["focused"])


async def _async_is_selector_focused(page: Any, selector: str) -> bool:
    return bool((await _async_selector_snapshot(page, selector))["focused"])


# ====================================================================
```

### Core Architecture Module: `cloakbrowser/human/actionability.py`
```
"""Playwright-style actionability checks for the humanize layer (sync).

Checks: attached, visible, stable, enabled, editable, receives pointer events.
Retry loop with backoff matching Playwright internals: [100, 250, 500, 1000]ms.
"""

from __future__ import annotations

import time
from typing import Any, FrozenSet, Optional

from .stealth_dom import (
    build_actionable_js, build_box_js, build_validate_js, eval_parsed,
    EVALUATION_FAILED, NOT_FOUND, OK, STALE, UNSUPPORTED,
    StealthEvaluationError, StealthWorldUnavailableError,
    UnsupportedHumanizeSelectorError,
)

# ---------------------------------------------------------------------------
# Error hierarchy — all subclass RuntimeError for backward compat
# ---------------------------------------------------------------------------

class ActionabilityError(RuntimeError):
    """Base for all actionability failures."""

    def __init__(self, selector: str, check: str, message: str):
        self.selector = selector
        self.check = check
        super().__init__(f"Element {selector!r} failed {check} check: {message}")


class ElementNotAttachedError(ActionabilityError):
    def __init__(self, selector: str):
        super().__init__(selector, "attached", "element not found in DOM")


class ElementNotVisibleError(ActionabilityError):
    def __init__(self, selector: str):
        super().__init__(selector, "visible", "element is not visible")


class ElementNotStableError(ActionabilityError):
    def __init__(self, selector: str):
        super().__init__(selector, "stable", "element position is still changing")


class ElementNotEnabledError(ActionabilityError):
    def __init__(self, selector: str):
        super().__init__(selector, "enabled", "element is disabled")


class ElementNotEditableError(ActionabilityError):
    def __init__(self, selector: str):
        super().__init__(selector, "editable", "element is not editable")


class ElementNotReceivingEventsError(ActionabilityError):
    def __init__(self, selector: str, covering_tag: str = "unknown"):
        super().__init__(
            selector,
            "pointer_events",
            f"element is covered by <{covering_tag}>",
        )


class ElementTargetChangedError(ActionabilityError):
    def __init__(self, selector: str):
        super().__init__(
            selector,
            "target_identity",
            "resolved element changed before pointer dispatch",
        )


# ---------------------------------------------------------------------------
# Check-set constants
# ---------------------------------------------------------------------------

CHECKS_CLICK: FrozenSet[str] = frozenset({"attached", "visible", "enabled", "pointer_events"})
CHECKS_HOVER: FrozenSet[str] = frozenset({"attached", "visible", "pointer_events"})
CHECKS_INPUT: FrozenSet[str] = frozenset({"attached", "visible", "enabled", "editable", "pointer_events"})
CHECKS_FOCUS: FrozenSet[str] = frozenset({"attached", "visible", "enabled"})
CHECKS_CHECK: FrozenSet[str] = frozenset({"attached", "visible", "enabled", "pointer_events"})

_BACKOFF_MS = [100, 250, 500, 1000]


def _backoff_sleep(attempt: int) -> None:
    idx = min(attempt, len(_BACKOFF_MS) - 1)
    time.sleep(_BACKOFF_MS[idx] / 1000.0)


# ---------------------------------------------------------------------------
# Pre-scroll actionability: attached, visible, enabled, editable
# ---------------------------------------------------------------------------

def _stealth_actionable(page: Any, selector: str, checks: FrozenSet[str]) -> None:
    """Run actionability checks exclusively through the isolated world."""
    world = getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    status, data = eval_parsed(world, build_actionable_js(selector))
    if status == UNSUPPORTED:
        raise UnsupportedHumanizeSelectorError(selector)
    if status == EVALUATION_FAILED:
        raise StealthEvaluationError(selector)
    if status == NOT_FOUND:
        # Every check-set includes 'attached'; not present yet -> raise so the
        # retry loop backs off and re-reads in-world (mirrors wait_for(attached)).
        raise ElementNotAttachedError(selector)
    if "visible" in checks and not data.get("visible"):
        raise ElementNotVisibleError(selector)
    if "enabled" in checks and not data.get("enabled"):
        raise ElementNotEnabledError(selector)
    if "editable" in checks and not data.get("editable"):
        raise ElementNotEditableError(selector)


def _read_box(page: Any, selector: str, remaining_ms: float) -> Optional[dict]:
    """Read geometry exclusively through the isolated world."""
    world = getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    status, data = eval_parsed(world, build_box_js(selector))
    if status == OK:
        return data["box"]
    if status == NOT_FOUND:
        return None
    if status == UNSUPPORTED:
        raise UnsupportedHumanizeSelectorError(selector)
    raise StealthEvaluationError(selector)


def ensure_actionable(
    page: Any,
    selector: str,
    checks: FrozenSet[str],
    timeout: float = 30000,
    force: bool = False,
) -> None:
    """Wait for element to pass actionability checks (pre-scroll).

    Retries with backoff until *timeout* ms elapsed.
    Raises a specific ``ActionabilityError`` subclass on failure.
    If *force* is True, returns immediately.
    """
    if force:
        return

    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0
    last_error: Optional[ActionabilityError] = None

    while True:
        remaining_ms = max(0, (deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            if last_error is not None:
                raise last_error
            raise ActionabilityError(selector, "timeout", "timeout expired before first check")

        try:
            _stealth_actionable(page, selector, checks)
            return

        except (ActionabilityError, StealthEvaluationError) as e:
            last_error = e
            if time.monotonic() >= deadline:
                raise last_error
            _backoff_sleep(attempt)
            attempt += 1


# ---------------------------------------------------------------------------
# Post-scroll stability check
# ---------------------------------------------------------------------------

def _boxes_differ(a: dict, b: dict) -> bool:
    return (
        abs(a["x"] - b["x"]) > 1
        or abs(a["y"] - b["y"]) > 1
        or abs(a["width"] - b["width"]) > 1
        or abs(a["height"] - b["height"]) > 1
    )


def ensure_stable(
    page: Any,
    selector: str,
    timeout: float = 5000,
) -> None:
    """Wait for element position to stabilize (two samples 100ms apart).

    Only call after scroll — skip if element was already in viewport.
    """
    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0

    while True:
        remaining_ms = max(0, (deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            raise ElementNotStableError(selector)

        try:
            box1 = _read_box(page, selector, remaining_ms)
            if box1 is None:
                raise ElementNotAttachedError(selector)

            time.sleep(0.1)

            box2 = _read_box(page, selector, remaining_ms)
            if box2 is None:
                raise ElementNotAttachedError(selector)
        except StealthEvaluationError:
            if time.monotonic() >= deadline:
                raise
            _backoff_sleep(attempt)
            attempt += 1
            continue

        if not _boxes_differ(box1, box2):
            return

        if time.monotonic() >= deadline:
            raise ElementNotStableError(selector)

        _backoff_sleep(attempt)
        attempt += 1


# ---------------------------------------------------------------------------
# Pointer-events check (post-scroll, at actual click coordinates)
# ---------------------------------------------------------------------------

# Legacy ElementHandle paths cannot use selector-based isolated-world identity.
_POINTER_EVENTS_HANDLE_JS = """(expected, data) => {
    const rect = expected.getBoundingClientRect();
    const frameOffsetX = data.box ? data.box.x - rect.x : 0;
    const frameOffsetY = data.box ? data.box.y - rect.y : 0;
    const target = document.elementFromPoint(data.x - frameOffsetX, data.y - frameOffsetY);
    if (!target) return { hit: false, reason: 'no_element_at_point', covering: 'none' };
    let node = target;
    while (node) { if (node === expected) return { hit: true }; node = node.parentNode; }
    if (expected.contains(target)) return { hit: true };
    return { hit: false, reason: 'covered', covering: target.tagName || 'unknown' };
}"""


def check_pointer_events(
    page: Any,
    selector: str,
    target_id: int,
    gen: int,
    x: float,
    y: float,
    stealth: Any = None,
    timeout: float = 5000,
) -> None:
    """Revalidate that the click point still hits the same resolved element.

    Callers skip this entirely when ``force=True`` (matching Playwright, where
    ``force`` bypasses all actionability checks).
    """
    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0
    last_miss: Optional[str] = None
    world = stealth if stealth is not None else getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    if not isinstance(target_id, int) or not isinstance(gen, int):
        raise StealthEvaluationError(selector)

    while True:
        status, data = eval_parsed(
            world, build_validate_js(selector, target_id, gen, x, y)
        )
        if status == UNSUPPORTED:
            raise UnsupportedHumanizeSelectorError(selector)
        if status == STALE:
            raise ElementTargetChangedError(selector)
        if status == NOT_FOUND:
            raise ElementNotAttachedError(selector)
   
```

### Core Architecture Module: `cloakbrowser/human/actionability_async.py`
```
"""Playwright-style actionability checks for the humanize layer (async).

Async mirror of actionability.py — same logic, uses asyncio.sleep and await.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, FrozenSet, Optional

from .actionability import (
    ActionabilityError,
    ElementNotAttachedError,
    ElementNotVisibleError,
    ElementNotStableError,
    ElementNotEnabledError,
    ElementNotEditableError,
    ElementNotReceivingEventsError,
    ElementTargetChangedError,
    _BACKOFF_MS,
    _boxes_differ,
    _POINTER_EVENTS_HANDLE_JS,
)
from .stealth_dom import (
    build_actionable_js, build_box_js, build_validate_js, async_eval_parsed,
    EVALUATION_FAILED, NOT_FOUND, OK, STALE, UNSUPPORTED,
    StealthEvaluationError, StealthWorldUnavailableError,
    UnsupportedHumanizeSelectorError,
)


async def _async_backoff_sleep(attempt: int) -> None:
    idx = min(attempt, len(_BACKOFF_MS) - 1)
    await asyncio.sleep(_BACKOFF_MS[idx] / 1000.0)


# ---------------------------------------------------------------------------
# Pre-scroll actionability
# ---------------------------------------------------------------------------

async def _async_stealth_actionable(page: Any, selector: str, checks: FrozenSet[str]) -> None:
    """Async isolated-world actionability read with no Playwright fallback."""
    world = getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    status, data = await async_eval_parsed(world, build_actionable_js(selector))
    if status == UNSUPPORTED:
        raise UnsupportedHumanizeSelectorError(selector)
    if status == EVALUATION_FAILED:
        raise StealthEvaluationError(selector)
    if status == NOT_FOUND:
        raise ElementNotAttachedError(selector)
    if "visible" in checks and not data.get("visible"):
        raise ElementNotVisibleError(selector)
    if "enabled" in checks and not data.get("enabled"):
        raise ElementNotEnabledError(selector)
    if "editable" in checks and not data.get("editable"):
        raise ElementNotEditableError(selector)


async def _async_read_box(page: Any, selector: str, remaining_ms: float) -> Optional[dict]:
    """Async isolated-world geometry read with no Playwright fallback."""
    world = getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    status, data = await async_eval_parsed(world, build_box_js(selector))
    if status == OK:
        return data["box"]
    if status == NOT_FOUND:
        return None
    if status == UNSUPPORTED:
        raise UnsupportedHumanizeSelectorError(selector)
    raise StealthEvaluationError(selector)


async def async_ensure_actionable(
    page: Any,
    selector: str,
    checks: FrozenSet[str],
    timeout: float = 30000,
    force: bool = False,
) -> None:
    if force:
        return

    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0
    last_error: Optional[ActionabilityError] = None

    while True:
        remaining_ms = max(0, (deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            if last_error is not None:
                raise last_error
            raise ActionabilityError(selector, "timeout", "timeout expired before first check")

        try:
            await _async_stealth_actionable(page, selector, checks)
            return

        except (ActionabilityError, StealthEvaluationError) as e:
            last_error = e
            if time.monotonic() >= deadline:
                raise last_error
            await _async_backoff_sleep(attempt)
            attempt += 1


# ---------------------------------------------------------------------------
# Post-scroll stability check
# ---------------------------------------------------------------------------

async def async_ensure_stable(
    page: Any,
    selector: str,
    timeout: float = 5000,
) -> None:
    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0

    while True:
        remaining_ms = max(0, (deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            raise ElementNotStableError(selector)

        try:
            box1 = await _async_read_box(page, selector, remaining_ms)
            if box1 is None:
                raise ElementNotAttachedError(selector)

            await asyncio.sleep(0.1)

            box2 = await _async_read_box(page, selector, remaining_ms)
            if box2 is None:
                raise ElementNotAttachedError(selector)
        except StealthEvaluationError:
            if time.monotonic() >= deadline:
                raise
            await _async_backoff_sleep(attempt)
            attempt += 1
            continue

        if not _boxes_differ(box1, box2):
            return

        if time.monotonic() >= deadline:
            raise ElementNotStableError(selector)

        await _async_backoff_sleep(attempt)
        attempt += 1


# ---------------------------------------------------------------------------
# Pointer-events check
# ---------------------------------------------------------------------------

async def async_check_pointer_events(
    page: Any,
    selector: str,
    target_id: int,
    gen: int,
    x: float,
    y: float,
    stealth: Any = None,
    timeout: float = 5000,
) -> None:
    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0
    last_miss: Optional[str] = None
    world = stealth if stealth is not None else getattr(page, "_stealth_world", None)
    if world is None:
        raise StealthWorldUnavailableError()
    if not isinstance(target_id, int) or not isinstance(gen, int):
        raise StealthEvaluationError(selector)

    while True:
        status, data = await async_eval_parsed(
            world, build_validate_js(selector, target_id, gen, x, y)
        )
        if status == UNSUPPORTED:
            raise UnsupportedHumanizeSelectorError(selector)
        if status == STALE:
            raise ElementTargetChangedError(selector)
        if status == NOT_FOUND:
            raise ElementNotAttachedError(selector)
        if status == EVALUATION_FAILED:
            if time.monotonic() >= deadline:
                raise StealthEvaluationError(selector)
        elif data.get("hit", False):
            return
        else:
            last_miss = data.get("covering", "unknown")
            if time.monotonic() >= deadline:
                raise ElementNotReceivingEventsError(selector, last_miss)

        await _async_backoff_sleep(attempt)
        attempt += 1


# ---------------------------------------------------------------------------
# ElementHandle variant
# ---------------------------------------------------------------------------

async def async_ensure_actionable_handle(
    page: Any,
    el: Any,
    checks: FrozenSet[str],
    timeout: float = 30000,
    force: bool = False,
) -> None:
    if force:
        return

    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0
    last_error: Optional[ActionabilityError] = None
    label = "<ElementHandle>"

    while True:
        remaining_ms = max(0, (deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            if last_error is not None:
                raise last_error
            raise ActionabilityError(label, "timeout", "timeout expired before first check")

        try:
            if "visible" in checks:
                try:
                    await el.wait_for_element_state("visible", timeout=max(1, min(remaining_ms, 2000)))
                except Exception:
                    raise ElementNotVisibleError(label)

            if "enabled" in checks:
                try:
                    await el.wait_for_element_state("enabled", timeout=max(1, min(remaining_ms, 2000)))
                except Exception:
                    raise ElementNotEnabledError(label)

            if "editable" in checks:
                try:
                    await el.wait_for_element_state("editable", timeout=max(1, min(remaining_ms, 2000)))
                except Exception:
                    raise ElementNotEditableError(label)

            return

        except ActionabilityError as e:
            last_error = e
            if time.monotonic() >= deadline:
                raise last_error
            await _async_backoff_sleep(attempt)
            attempt += 1


async def async_check_pointer_events_handle(
    page: Any,
    el: Any,
    x: float,
    y: float,
    timeout: float = 5000,
) -> None:
    deadline = time.monotonic() + timeout / 1000.0
    attempt = 0

    while True:
        try:
            box = await el.bounding_box()
            result = await el.evaluate(_POINTER_EVENTS_HANDLE_JS, {"x": x, "y": y, "box": box})
        except Exception:
            result = None

        # Proceed if the check confirms a hit, or if it could not be determined
        # (None) — failing closed would block legitimate clicks.
        if result is None or result.get("hit", False):
            return

        covering = (result or {}).get("covering", "unknown")

        if time.monotonic() >= deadline:
            raise ElementNotReceivingEventsError("<ElementHandle>", covering)

        await _async_backoff_sleep(attempt)
        attempt += 1

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #570** (2026-10-03): **CloakBrowser Pro v0.5.11 cannot bypass cloudflare in AWS Lambda on .NET**
  *Symptoms*: I have a Cloakbrowser pro installed locally on ubuntu 26.04, version 152.0.7977.82.1.  I hooked it up to my playwright locally and it bypasses the required websites cloudflare turnstiles, even in headless mode.  When I hook it up to a simple AWS Lambda, no funky networking or VPCs with 2GB Ram detailed below, it fails cloudflare turnstile. Could you offer any pointers?  **Details** CloakBrowser version: v0.5.11 / 152.0.7977.82.1 Wrapper: .NET Environment: Docker Image cloakhq/cloakbrowser:0.5.11 ```docker FROM cloakhq/cloakbrowser:0.5.11  ARG CLOAKBROWSER_LICENSE_KEY ARG DOTNET_VERSION=10.0.12 ARG CHROME_VERSION=152.0.7977.82.1  COPY entrypoint.sh /entrypoint.sh RUN chmod +x /entrypoint.sh  # Install .NET 10 runtime RUN apt-get update \     && apt-get install -y --no-install-recommends \         curl \         ca-certificates \         tar \         xvfb \         x11-utils \         xz-utils \         gzip \         libicu76 \     && curl -fSL \         "https://builds.dotnet.microsoft.com/dotnet/Runtime/${DOTNET_VERSION}/dotnet-runtime-${DOTNET_VERSION}-linux-x64.tar.gz" \         -o /tmp/dotnet.tar.gz \     && mkdir -p /usr/share/dotnet \     && tar -xzf /tmp/dotnet.tar.gz -C /usr/share/dotnet \     && ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet \     && rm -f /tmp/dotnet.tar.gz \     && rm -rf /var/lib/apt/lists/*  # Install fonts COPY windows-fonts.tar.xz /tmp/fonts/windows-fonts.tar.xz RUN mkdir -p /usr/local/share/fonts/windows \     && tar -xJf /tmp/fonts/windows-
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report.  We reproduced cardmarket.com on our side with the .NET wrapper 0.5.11 in Docker (headed under Xvfb) through a residential proxy. The Cloudflare challenge cleared within a few seconds and the homepage loaded.  The main difference we see in your Lambda setup is `Proxy = null`. Without a proxy, the site sees your Lambda's own AWS datacenter IP (your log shows `13.41.76.50`, registered to Amazon). Cloudflare scores IP reputation before it evaluates the browser, and datacenter ranges start with a low score. Your local runs went out through a residential connection, so that comparison doesn't carry over to Lambda.  Please run this exact snippet inside your Lambda. Replace only the key and the proxy, and add nothing else: no extra args, no custom flags, no viewport, no seed.  ```csharp using CloakBrowser; using CloakBrowser.Human;  await using var handle = await CloakLauncher.LaunchPersistentContextAsync("/tmp/cloak-profile", new LaunchContextOptions {     Lic
  > Thanks for the help, using your arguments and bringing back in  the proxy resolved the issue.

- **Issue #527** (2026-08-31): **macOS v148+ OfflineAudioContext output remains identical across --fingerprint seeds**
  *Symptoms*: Description:  This appears to be related to #181. The maintainer response on #181 explained that the v145 macOS binary predates the seed-based audio noise system. Issue #318 later stated that macOS binaries shipped again starting with v148, but the current macOS builds still produce identical `OfflineAudioContext` output for different fingerprint seeds.  With fingerprint noise enabled, the macOS build does not vary the rendered `OfflineAudioContext` samples when the fingerprint seed changes. Canvas, WebGL, screen, and hardware values do vary as expected, so the fingerprint seed is reaching the browser and other noise paths are active.  Expected: the same seed should produce a stable audio fingerprint, while different seeds should produce different rendered audio values on supported macOS builds. If audio noise is not yet supported on macOS, the release notes should state that explicitly and identify the first supported build.  CloakBrowser version: `0.5.9` (Python wrapper); tested macOS Pro Chromium builds: `148.0.7778.215.5`, `150.0.7871.114.3`, and `151.0.7922.108.3`  Wrapper: Python  Environment: macOS 26.5.2 (Darwin 25.5.0), Apple M4, arm64, not using Docker  Launch options:  The only values changed between runs were the fingerprint seed and, in one control, the platform value. Noise was enabled and `--fingerprint-noise=false` was not passed.  ```text --fingerprint=31415 --fingerprint-platform=macos --fingerprint-noise=true ```  ```text --fingerprint=27182 --fingerprint-p
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and controlled reproduction.  This behavior is expected in current builds. `OfflineAudioContext` output is intentionally seed-independent and follows normal platform behavior, while other fingerprint surfaces may vary by seed.  Our earlier response in #181 was outdated and incorrectly implied that newer macOS builds would add seeded audio variation. Sorry for the confusion.

- **Issue #485** (2026-08-14): **storage quota behaviour diverges from Chrome**
  *Symptoms*: Description:  - Given the following:      ```js     storage = await navigator.storage.estimate()     ```  - On Chrome:     - Chrome (when not in incognito mode) sets `storage.quota` to be exaclty `storage.usage + 10GiB`.     - When the amount of data used increases (e.g. adding data to `IndexedDB`), the `storage.quota` increases by the same corresponding amount, such that the difference between the two remains exaclty `10GiB` (`10737418240 bytes`).     - After deleting all the data from `indexedDB` on chrome, `storage.usage` usually still reports some usage (up to about 50kb) as overhead, but the difference between `storage.quota` and `storage.usage` remains exactly `10GiB`. - On CloakBrowser:     - CloakBrowser does not quite behave the same way.     - The `150` binary simply sets the `storage.quota` to `10GiB`, but does not take into account the amount of data in `storage.usage`.     - As such, the difference between `storage.quota` and `storage.usage` will be something smaller than the expected `10GiB` if there is data being stored in storage.  CloakBrowser version: `0.5.3` using binary `150.0.7871.114.3`  Wrapper: `Javascript`  Environment: `Windows 11 (natively, no docker)`  Launch options:  ```js context = await launchPersistentContext({   userDataDir: tempDir,   headless: false,   licenseKey: licenseKey, }); ```  Tested with a different IP or proxy? `No`  Works outside Docker / on host machine? `Not using Docker`  Steps to reproduce:  1. Run this code to get output for
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed writeup, nice probe.  The reported quota already matches stock Chrome on a normal read (the fixed 10 GiB baseline is exactly what regular Chrome reports). What you've caught is the read-after-write case: real Chrome lets the quota grow with usage so the quota-minus-usage gap stays constant, and our current build holds the baseline flat instead. We've confirmed the behavior and lined up the change so the quota tracks usage the same way.  On variant B, the value you passed to `--fingerprint-storage-quota` is 10 GiB, the same as the default, so it produced the same result as variant A. The flag is working, it just feeds the same baseline.  This ships in the next binary release. 
  > Very nice!  This is resolved in binary version `150.0.7871.114.6`

- **Issue #480** (2026-08-04): **Incomplete font set despite installing as described in the documentation**
  *Symptoms*: Description:  ``` [cloakbrowser] Incomplete Windows font set — installing the full set is strongly advised for best results when spoofing Windows on Linux. https://github.com/CloakHQ/cloakbrowser#font-setup-on-linux (silence: CLOAKBROWSER_SUPPRESS_FONT_WARNING=1) ```  Incomplete font set despite installing as described in the documentation:  ``` FROM python:3.12-slim  WORKDIR /app  RUN apt-get update && apt-get install -y \     xvfb \     libgtk-3-0 \     libnss3 \     libx11-6 \     libxcomposite1 \     libxdamage1 \     libxrandr2 \     libgbm1 \     libasound2  # Windows core fonts (Arial, Times New Roman, Verdana, etc.) RUN apt-get install -y fonts-liberation fonts-noto-color-emoji fonts-freefont-ttf fonts-unifont \     fonts-ipafont-gothic fonts-wqy-zenhei fonts-tlwg-loma-otf  RUN apt-get clean && rm -rf /var/lib/apt/lists/*  ...rest ```  CloakBrowser version: 0.5.3  Wrapper: Python  Environment: Container with python 3.12.0 running on Fedora Linux 53  Launch options:  ``` browser = launch_persistent_context(         user_data_dir=profile_dir,         human_preset="careful",         headless=False,         humanize=True,         args=[             "--fingerprint-noise=false",             "--fingerprint-windows-font-metrics",         ],         timezone=TIMEZONE,         proxy=proxy_settings,         license_key=LICENSE_KEY     ) ```  Tested with a different IP or proxy? N/A  Works outside Docker / on host machine? Yes  Steps to reproduce:  Install the above packages into
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, and for the detailed Dockerfile.  This is working as intended, but our README wording is misleading you here, which is on us. We're fixing it.  The packages you installed (`fonts-liberation`, `fonts-noto-color-emoji`, `fonts-freefont-ttf`, etc.) are the correct **baseline** set. They fix the emoji/canvas hashing that aggressive anti-bot systems check. They are not the Windows fonts the warning is asking about.  On Linux, CloakBrowser spoofs the Windows platform by default, so it looks for the real Windows OS fonts: Segoe UI, Segoe UI Light, Calibri, Marlett, MS UI Gothic, Franklin Gothic, Consolas, Courier New. None of those ship in any apt package. They are Microsoft-proprietary, so we can't bundle them and `ttf-mscorefonts-installer` doesn't include them either. That's why the warning still fires even though your font install succeeded.  The check reads the system font registry (`fc-list`) only. To clear it, copy the real fonts into a fontconfig directory and r
  > Hi @Cloak-HQ , I've gotten the fonts from a Windows machine, added them to the container, and loaded them into the browser as per your specification. However, I am still getting to same error message. Any ideas?  ``` browser = launch_persistent_context(         user_data_dir=profile_dir,         human_preset="careful",         headless=False,         humanize=True,         args=[             "--fingerprint-noise=false",             "--fingerprint-windows-font-metrics",             "--fingerprint-fonts-dir=./shared/Fonts" if os.path.exists("./shared/Fonts") else "--fingerprint-fonts-dir=./Fonts",         ],         timezone=TIMEZONE,         proxy=proxy_settings,         license_key=LICENSE_KEY     ) ```
  > The `--fingerprint-fonts-dir` arg is the catch here. That flag isn't part of CloakBrowser and doesn't register fonts with the system font registry (`fc-list`), which is the only thing this warning reads. So pointing it at `./Fonts` loads nothing as far as the check is concerned, and `./Fonts` isn't a path fontconfig scans anyway.  First, see what fontconfig actually sees inside the container:  ```bash fc-list | grep -iE "segoe|calibri|consolas|courier new|marlett|ms ui gothic|franklin" ```  If that's empty or partial, the fonts aren't registered yet. Install them into a fontconfig directory and rebuild the cache (copy the whole `Fonts` folder — MS UI Gothic ships only as `msgothic.ttc`, so a `*.ttf` copy would miss it):  ```bash mkdir -p /usr/share/fonts/windows cp -r /path/to/windows/Fonts/. /usr/share/fonts/windows/ fc-cache -f ```  Then drop `--fingerprint-fonts-dir` from your `args` entirely and re-run the `fc-list` command above. Once all eight names show up there, the warning sto

- **Issue #434** (2026-07-10): **launch_persistent_context() fails with HTTP authenticated proxy (ERR_PROXY_AUTH_UNSUPPORTED), while launch_context() works**
  *Symptoms*: ## Environment  - CloakBrowser: 0.4.8 - License: Free - Chromium: 145.0.7632.109.2 - macOS: Apple Silicon - Python: 3.13.1  Output of:  ```bash python3 -m cloakbrowser info ```  ``` Version:   145.0.7632.109.2 (free) Launch:    ✓ Chromium 145 License:   Free ```  ---  ## Proxy  Authenticated HTTP proxy.  Format:  ``` proxy.soax.com:1337:USERNAME:PASSWORD ```  Converted to:  ```python proxy = {     "server": "http://proxy.soax.com:1337",     "username": "...",     "password": "...", } ```  ---  ## Expected behavior  According to the README:  > launch_persistent_context() supports all the same options as launch_context(), including proxy.  I expect both APIs to behave the same.  ---  ## Actual behavior  ### launch_context()  Works correctly.  ```python from cloakbrowser import launch_context  ctx = launch_context(     headless=False,     proxy=proxy, )  page = ctx.new_page() page.goto("https://api.ipify.org") print(page.text_content("body")) ```  Result:  ``` <public ip> ```  ---  ### launch_persistent_context()  Fails immediately.  ```python from cloakbrowser import launch_persistent_context  ctx = launch_persistent_context(     "./profile_test",     headless=False,     proxy=proxy, )  page = ctx.new_page() page.goto("https://api.ipify.org") ```  Result:  ``` playwright._impl._errors.Error:  Page.goto: net::ERR_PROXY_AUTH_UNSUPPORTED ```  Full message:  ``` Page.goto: net::ERR_PROXY_AUTH_UNSUPPORTED at https://api.ipify.org/ ```  ---  ## Additional information  The exact same 
  **Post-Mortem & Fix Analysis**:
  > ``` from cloakbrowser import launch_persistent_context  ctx = launch_persistent_context(     "./profile_test",     headless=False,     proxy=proxy, )  page = ctx.new_page() page.goto("https://api.ipify.org") ```  Change to:  ``` from cloakbrowser import launch_persistent_context  ctx = launch_persistent_context(     userDataDir="./profile_test",     headless=False,     proxy=proxy, )  page = ctx.new_page() page.goto("https://api.ipify.org") ```
  > Thanks for the detailed report.  Quick correction on the follow-up comment: `userDataDir=` isn't valid for the Python API — that's the JS/npm package's camelCase convention. The Python signature takes `user_data_dir` as a positional argument, so your original code was correct there:  ```python ctx = launch_persistent_context("./profile_test", headless=False, proxy=proxy) ```  On the actual bug: we tried to reproduce on the same binary/platform (macOS x64, free 145.0.7632.109.2), headed and headless, with a different credentialed HTTP residential proxy, and both `launch_context()` and `launch_persistent_context()` succeeded. So we can't reproduce it yet with a different provider — wanted to flag that before assuming it's SOAX-specific.  Could you help us narrow it down: 1. Does the same failure happen with a different proxy provider, or only SOAX? 2. Does `launch_context()` (non-persistent) work with the exact same SOAX credentials, and `launch_persistent_context()` fail, every time — n
  > Thanks for looking into this.  Here are my answers:  1. Yes. this also happens with smartproxy providers.  2. Yes. With the exact same SOAX proxy credentials:  - launch() works. - launch_context() works. - launch_persistent_context() consistently fails with:  ``` Page.goto: net::ERR_PROXY_AUTH_UNSUPPORTED ```  I can reproduce this 100% of the time. There is no flakiness.  3. The proxy format is the standard SOAX format:  ``` proxy.soax.com:1337:USERNAME:PASSWORD ```  The username contains SOAX parameters, for example:  ``` country-jp-network-res_mob ```  (or similar combinations depending on the proxy configuration)  In Python I convert it to:  ```python proxy = {     "server": "http://proxy.soax.com:1337",     "username": "country-jp-network-res_mob",     "password": "********", } ```  The same proxy dictionary works correctly with launch_context(), but fails only with launch_persistent_context().  If it would help, I'm happy to test a debug build or try additional experiments.  If yo

- **Issue #343** (2026-06-03): **Cloak Browser Not Bypassing Cloudflare Turnstyle Challenge**
  *Symptoms*: Description: <!-- What happened? What did you expect? --> I am running cloack through javascript. i am using a proxy and I am following the best practices for launch options. I am trying to visit a page that uses the Cloudflare turnstyle Challenge, but to no success. I think cloudflare might have updated their turnstyle challenge within the past week, but that is just a hunch  CloakBrowser version: <!-- pip show cloakbrowser / npm list cloakbrowser --> 0.3.31  Wrapper: <!-- Python or JavaScript --> javascript  Environment: <!-- OS, Docker y/n, base image, architecture --> Mac OS  Launch options: browser = await cloak.launch({ headless: false, proxy: browser_info.proxy, geoip: true, humanize: true });  Tested with a different IP or proxy? <!-- Yes (same result) / Yes (works with different IP) / No --> yes. I have am usng a shared pool of 10k isp proxies and I am having this issue  Works outside Docker / on host machine? <!-- Yes / No / Not using Docker --> I am not using docker  Steps to reproduce: ` browser = await cloak.launch({ headless: false, proxy: browser_info.proxy, geoip: true, humanize: true });       if (!browser) {         browser_info.error = true;         browser_info.cause = 'Browser would not connect';         throw new Error(browser_info.cause);       }        //step 1. visit the sign up page.       const page = await browser.newPage();        const sign_up_page = await page.goto('https://platform.tavus.io/auth/sign-up?is_developer=true');`  Error output / scr
  **Post-Mortem & Fix Analysis**:
  > It still bypasses it if you write code that presses Tab once and then hits Space once. Do those actions *after* the first attempt at solving the captcha fails and the page waits for a user to press the button  I made my browser wait 60 seconds if it detected any "security verification" text on the page and then perform that action
  > > It still bypasses it if you write code that presses Tab once and then hits Space once. Do those actions _after_ the first attempt at solving the captcha fails and the page waits for a user to press the button >  > I made my browser wait 60 seconds if it detected any "security verification" text on the page and then perform that action  This worked! thank you, I'm going to close this ticket. Hopefully if anyone else comes across the same isssue this will be of service.

- **Issue #334** (2026-06-17): **Recaptcha v3 get 0.9 in reCAPTCHA demo, but solve failed**
  *Symptoms*: The site is https://www.bizfile.gov.sg/buy-info/search/results <img width="1885" height="1046" alt="Image" src="https://github.com/user-attachments/assets/ae101940-9263-4bdd-82e8-d150e6d21da2" />  <img width="1868" height="1100" alt="Image" src="https://github.com/user-attachments/assets/f13cdaa7-0d04-4635-8ece-a93da04b6067" />
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, and for the screenshots.  Short version: this isn't a CloakBrowser bug. The "Suspicious attempt detected" message is the site's own **reCAPTCHA v3** verdict, not something the browser binary controls.  Two things worth knowing about reCAPTCHA v3:  - **The demo score doesn't transfer.** The reCAPTCHA v3 demo page uses Google's own public site key, which is lenient and returns ~0.9 for almost any visitor (bots included). A real site uses its own site key with its own threshold and scores your browser independently. A 0.9 on the demo tells you nothing about how you'll score elsewhere. - **reCAPTCHA v3 scores the session, not just the fingerprint.** The score leans heavily on Google cookie reputation and browsing history tied to the profile. A fresh, throwaway session scores low no matter how clean the fingerprint is.  You can confirm this without CloakBrowser: open the same page in a **regular Chrome incognito window** and run the search. You'll most likely get the 
  > The demo score is a red herring — Google's reCAPTCHA demo runs no backend assessment, so 0.9 there tells you nothing about a real site. bizfile is almost certainly on Enterprise v3: their server calls the assessment API and applies its own threshold plus checks the action name, hostname binding, and extra risk signals. A 0.9 token with the wrong action (or one not bound to the page they expect) gets rejected every time — so the fix isn't a higher score, it's generating the token for the exact action the site expects and delivering it in the right context. (I work on CaptchaAI; we deal with v3 Enterprise token generation if you want to test against the real endpoint instead of the demo.) On the proxy question — residential helps the IP-reputation signal but won't fix an action/threshold mismatch.
  > yes true in demo always got 0.9 but in reality site always got low score. lmao

- **Issue #331** (2026-07-04): **When using launchPersistentContext google detect suspicious activity**
  *Symptoms*: When I run a profile using  launchPersistentContext  and do a google search if flags for suspicious activity and requires to complete a captcha.  ``` import {launchPersistentContext } from 'cloakbrowser';   const ctx = await launchPersistentContext({   userDataDir: './chrome-profile3',   headless: false,   args:["--fingerprint-storage-quota=100000",'--fingerprint=4444'],  });  const page = await ctx.newPage(); await page.goto('https:/google.com');  ```  <img width="599" height="338" alt="Image" src="https://github.com/user-attachments/assets/937e7efd-ede8-4202-8f83-207c163441a1" />  But if I run with just "launchContext" and do a google search everything is fine. Why is this happening? I'm I doing something wrong or something leaks? ```  import { launchContext } from 'cloakbrowser';  const context = await launchContext({    headless: false,   });   const page = await context.newPage(); await page.goto('https://google.com'); ```   I tested with multiple fingerpints and proxies I get same results.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, and for the clean side-by-side with `launchContext`.  We reproduced this on our side and the short version is: the problem is not your flags, and not `launchPersistentContext` itself.  What we tested (headed, residential proxy, `geoip: true`):  - `launchPersistentContext` with your exact flags (`--fingerprint-storage-quota=100000`, `--fingerprint=4444`): Google search passed every run. - Same with the recommended args, and with no extra args: also passed every run.  We also compared how the two paths actually launch the browser. `launchPersistentContext` and `launchContext` start with the same stealth configuration. The persistent path does not add any extra automation signal.  So the difference you are seeing comes from two things in the persistent setup, not the code path:  1. No proxy in your snippet. `geoip` only does something when there is a proxy, because it resolves the proxy exit IP to set a matching timezone and locale. With no proxy it is a no-op, and 
  > I tested on windows desktop with my high trust ip rezidential from my internet provider and also  with 4g ip's and I get that issue, I don't think ip is the issue in my case.  When I run with "launchPersistentContext" I use fresh profiles and still get flagged on google search.  Thanks
  > Using same ip in both cases and fresh profile on "launchPersistentContext ": Test1:  ``` from cloakbrowser import launch  browser = launch(         headless=False,     )  page = browser.new_page()  page.goto("https://google.com")  input("Press Enter to close...")  ``` When doing manually a google search works fine. ---------------------------------------------------------------------------  Test 2:  ``` import {launchPersistentContext } from 'cloakbrowser';   const ctx = await launchPersistentContext({   userDataDir: './fresh-profile5',   headless: false, });  const page = await ctx.newPage(); await page.goto('https:/google.com');  ``` In test 2 google flags as suspicious.

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

### Incident Patch 1: `faffd76f` (2026-10-04)
**Commit Message**: test(js): zero random delays in the SecurePass humanType test to stop CI timeouts

**File**: `js/tests/stealth.test.ts` (modified, +9/-1)
```diff
@@ -447,7 +447,15 @@ describe("humanType mixed text with CDP", () => {
   });
 
   it("password-like text 'SecurePass!123' uses CDP for '!'", async () => {
-    const cfg = resolveConfig("default", { mistype_chance: 0, typing_delay: 0 });
+    // Zero every random sleep: thinking pauses alone can push 14 chars past the 5s test timeout on CI
+    const cfg = resolveConfig("default", {
+      mistype_chance: 0,
+      typing_delay: 0,
+      typing_pause_chance: 0,
+      shift_down_delay: [0, 0],
+      shift_up_delay: [0, 0],
+      key_hold: [0, 0],
+    });
     const { raw } = buildRawKeyboard();
     const page = buildMockPage();
     const cdpCalls: Array<[string, any]> = [];
```

---

### Incident Patch 2: `0739ca53` (2026-10-04)
**Commit Message**: fix(humanize): keep digit mistypes on digits (#573)

A letter typo on a digit is rejected by <input type=number>, so the
correcting Backspace deleted the previous real digit (1999 -> 999).
Digit neighbors are now digit-only in the Python, JS (Playwright +
Puppeteer) and .NET wrappers.

**File**: `cloakbrowser/human/keyboard.py` (modified, +4/-2)
```diff
@@ -29,8 +29,10 @@ def insert_text(self, text: str) -> None: ...
     'p': 'ol', 'q': 'wa', 'r': 'edft', 's': 'awedxz', 't': 'rfgy',
     'u': 'yhji', 'v': 'cfgb', 'w': 'qase', 'x': 'zsdc', 'y': 'tghu',
     'z': 'asx',
-    '1': '2q', '2': '13qw', '3': '24we', '4': '35er', '5': '46rt',
-    '6': '57ty', '7': '68yu', '8': '79ui', '9': '80io', '0': '9p',
+    # Digits stay digits: a letter typo is rejected by <input type=number>,
+    # so the correcting Backspace would delete the previous real digit (#573).
+    '1': '2', '2': '13', '3': '24', '4': '35', '5': '46',
+    '6': '57', '7': '68', '8': '79', '9': '80', '0': '9',
 }
 
 # CDP key code for each shift symbol's physical key.
```

**File**: `dotnet/src/CloakBrowser/Human/HumanKeyboard.cs` (modified, +4/-2)
```diff
@@ -61,8 +61,10 @@ internal static Task PressAsync(IKeyboard keyboard, string key, float? delay = n
         ['p'] = "ol", ['q'] = "wa", ['r'] = "edft", ['s'] = "awedxz", ['t'] = "rfgy",
         ['u'] = "yhji", ['v'] = "cfgb", ['w'] = "qase", ['x'] = "zsdc", ['y'] = "tghu",
         ['z'] = "asx",
-        ['1'] = "2q", ['2'] = "13qw", ['3'] = "24we", ['4'] = "35er", ['5'] = "46rt",
-        ['6'] = "57ty", ['7'] = "68yu", ['8'] = "79ui", ['9'] = "80io", ['0'] = "9p",
+        // Digits stay digits: a letter typo is rejected by <input type=number>,
+        // so the correcting Backspace would delete the previous real digit (#573).
+        ['1'] = "2", ['2'] = "13", ['3'] = "24", ['4'] = "35", ['5'] = "46",
+        ['6'] = "57", ['7'] = "68", ['8'] = "79", ['9'] = "80", ['0'] = "9",
     };
 
     /// <summary>CDP key <c>code</c> for each shift symbol's physical key.</summary>
```

**File**: `dotnet/tests/CloakBrowser.Tests/MiscTests.cs` (modified, +9/-0)
```diff
@@ -164,6 +164,15 @@ public void NearbyKeys_HasQwertyNeighbors()
         Assert.Equal("sqwz", HumanKeyboard.NearbyKeys['a']);
         Assert.Equal("ol", HumanKeyboard.NearbyKeys['p']);
     }
+
+    [Fact]
+    public void NearbyKeys_DigitNeighborsAreDigits()
+    {
+        // #573: a letter typo is rejected by <input type=number>, so the
+        // correcting Backspace would delete the previous real digit.
+        foreach (char d in "0123456789")
+            Assert.True(HumanKeyboard.NearbyKeys[d].All(char.IsDigit), $"'{d}' -> {HumanKeyboard.NearbyKeys[d]}");
+    }
 }
 
 public class ActionabilityTests
```

**File**: `js/src/human-puppeteer/keyboard.ts` (modified, +4/-2)
```diff
@@ -27,8 +27,10 @@ const NEARBY_KEYS: Record<string, string> = {
   p: 'ol', q: 'wa', r: 'edft', s: 'awedxz', t: 'rfgy',
   u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu',
   z: 'asx',
-  '1': '2q', '2': '13qw', '3': '24we', '4': '35er', '5': '46rt',
-  '6': '57ty', '7': '68yu', '8': '79ui', '9': '80io', '0': '9p',
+  // Digits stay digits: a letter typo is rejected by <input type=number>,
+  // so the correcting Backspace would delete the previous real digit (#573).
+  '1': '2', '2': '13', '3': '24', '4': '35', '5': '46',
+  '6': '57', '7': '68', '8': '79', '9': '80', '0': '9',
 };
 
 const SHIFT_SYMBOL_CODES: Record<string, string> = {
```

**File**: `js/src/human/keyboard.ts` (modified, +4/-2)
```diff
@@ -36,8 +36,10 @@ const NEARBY_KEYS: Record<string, string> = {
   p: 'ol', q: 'wa', r: 'edft', s: 'awedxz', t: 'rfgy',
   u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu',
   z: 'asx',
-  '1': '2q', '2': '13qw', '3': '24we', '4': '35er', '5': '46rt',
-  '6': '57ty', '7': '68yu', '8': '79ui', '9': '80io', '0': '9p',
+  // Digits stay digits: a letter typo is rejected by <input type=number>,
+  // so the correcting Backspace would delete the previous real digit (#573).
+  '1': '2', '2': '13', '3': '24', '4': '35', '5': '46',
+  '6': '57', '7': '68', '8': '79', '9': '80', '0': '9',
 };
 
 /**
```

**File**: `js/tests/stealth.test.ts` (modified, +23/-0)
```diff
@@ -16,6 +16,7 @@
 import { describe, it, expect, vi, beforeEach } from "vitest";
 import { resolveConfig, rand, randRange, sleep } from "../src/human/config.js";
 import { humanType } from "../src/human/keyboard.js";
+import { humanType as puppeteerHumanType } from "../src/human-puppeteer/keyboard.js";
 import { humanMove, humanClick, clickTarget, humanIdle } from "../src/human/mouse.js";
 
 // =========================================================================
@@ -140,6 +141,28 @@ function buildRawKeyboard() {
 }
 
 
+// =========================================================================
+// Mistype on digits (#573): a letter typo is rejected by <input type=number>,
+// so the correcting Backspace would eat the previous real digit.
+// =========================================================================
+describe("digit mistypes stay digits", () => {
+  it.each([
+    ["playwright", humanType],
+    ["puppeteer", puppeteerHumanType],
+  ])("%s humanType only types digits for numeric text", async (_name, typeFn) => {
+    const cfg = resolveConfig("default", {
+      mistype_chance: 1, typing_delay: 0, typing_delay_spread: 0, typing_pause_chance: 0,
+      key_hold: [0, 0], mistype_delay_notice: [0, 0], mistype_delay_correct: [0, 0],
+    });
+    for (let i = 0; i < 20; i++) {
+      const { raw, downKeys } = buildRawKeyboard();
+      await (typeFn as any)(buildMockPage(), raw, "0123456789", cfg, null);
+      expect(downKeys.filter((k) => k !== "Backspace").every((k) => /^[0-9]$/.test(k))).toBe(true);
+    }
+  });
+});
+
+
 // =========================================================================
 // SHIFT_SYMBOL_CODES / SHIFT_SYMBOL_KEYCODES completeness
 // =========================================================================
```

**File**: `tests/test_humanize_unit.py` (modified, +7/-0)
```diff
@@ -887,6 +887,13 @@ def test_careful_mistype_higher(self):
         careful = resolve_config("careful")
         assert careful.mistype_chance >= default.mistype_chance
 
+    def test_digit_neighbors_are_digits(self):
+        # #573: a letter typo is rejected by <input type=number>, so the
+        # correcting Backspace would delete the previous real digit.
+        from cloakbrowser.human.keyboard import NEARBY_KEYS
+        for d in "0123456789":
+            assert NEARBY_KEYS[d].isdigit(), (d, NEARBY_KEYS[d])
+
 
 # =========================================================================
 # 10. Select-all platform detection
```

---

### Incident Patch 3: `f44864b6` (2026-09-29)
**Commit Message**: ci: run JS tests on Node 22 (vitest 5 engine requirement)

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
       - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
         with:
-          node-version: 20
+          node-version: 22
       - name: Install and build
         run: cd js && npm install && npm run build
       - name: Typecheck
```

---

### Incident Patch 4: `0e43a341` (2026-09-29)
**Commit Message**: fix(humanize): tolerate sub-pixel box edges in the scroll-into-view pinned check

Layout can report a top edge of -1/64 px on an unscrolled page, which skipped
the pinned-at-top check and sent a pointless upward scroll burst before the
click. Allow 1px slack in Python, JS and .NET, with regression tests.

Also credit @Shub3am in README contributors (#554).

**File**: `README.md` (modified, +1/-0)
```diff
@@ -1479,6 +1479,7 @@ Issues and PRs welcome. If something isn't working, [open an issue](https://gith
 - [@Kumario1](https://github.com/Kumario1) — cloakserve idle cleanup for seeded profiles
 - [@0xlally](https://github.com/0xlally) — security reports (cloakserve path traversal, WebSocket origin bypass)
 - [@ishiko732](https://github.com/ishiko732) — HTTP proxy credentials in GeoIP resolution
+- [@Shub3am](https://github.com/Shub3am) — horizontal scroll-into-view for humanized clicks
 
 ## Star History
 
```

**File**: `cloakbrowser/human/scroll.py` (modified, +2/-1)
```diff
@@ -155,7 +155,8 @@ def _scroll_y_into_view(
 
     # Already fully visible but off-center, with the page pinned at the boundary
     # in the needed direction: scrolling can't help, so don't waste the budget.
-    fully_visible = box["y"] >= 0 and box["y"] + box["height"] <= viewport_height
+    # 1px slack: layout can report a top edge of -1/64 px on an unscrolled page.
+    fully_visible = box["y"] >= -1 and box["y"] + box["height"] <= viewport_height + 1
     if fully_visible:
         zone_mid = viewport_height * (cfg.scroll_target_zone[0] + cfg.scroll_target_zone[1]) / 2
         need_up = box["y"] + box["height"] / 2 < zone_mid
```

**File**: `cloakbrowser/human/scroll_async.py` (modified, +2/-1)
```diff
@@ -141,7 +141,8 @@ async def _async_scroll_y_into_view(
 
     # Already fully visible but off-center, with the page pinned at the boundary
     # in the needed direction: scrolling can't help, so don't waste the budget.
-    fully_visible = box["y"] >= 0 and box["y"] + box["height"] <= viewport_height
+    # 1px slack: layout can report a top edge of -1/64 px on an unscrolled page.
+    fully_visible = box["y"] >= -1 and box["y"] + box["height"] <= viewport_height + 1
     if fully_visible:
         zone_mid = viewport_height * (cfg.scroll_target_zone[0] + cfg.scroll_target_zone[1]) / 2
         need_up = box["y"] + box["height"] / 2 < zone_mid
```

**File**: `dotnet/src/CloakBrowser/Human/HumanScroll.cs` (modified, +2/-1)
```diff
@@ -143,7 +143,8 @@ private static async Task<ScrollResult> ScrollYIntoViewAsync(
 
         // Already fully visible but off-center, with the page pinned at the boundary
         // in the needed direction: scrolling can't help, so don't waste the budget.
-        bool fullyVisible = box.Value.Y >= 0 && box.Value.Y + box.Value.Height <= viewportHeight;
+        // 1px slack: layout can report a top edge of -1/64 px on an unscrolled page.
+        bool fullyVisible = box.Value.Y >= -1 && box.Value.Y + box.Value.Height <= viewportHeight + 1;
         if (fullyVisible)
         {
             double zoneMid = viewportHeight * (cfg.ScrollTargetZone.Min + cfg.ScrollTargetZone.Max) / 2;
```

**File**: `dotnet/tests/CloakBrowser.Tests/ScrollFallbackTests.cs` (modified, +14/-0)
```diff
@@ -138,6 +138,20 @@ public async Task Fully_visible_above_zone_at_top_bails_without_scrolling()
         Assert.Equal(0, mouse.WheelCalls);
     }
 
+    [Fact]
+    public async Task Subpixel_negative_top_at_page_top_bails_without_scrolling()
+    {
+        // Layout reports top=-1/64 px on an unscrolled page; still fully visible.
+        var page = new ViewportPage((1000, 700), scroll: (0, 0, 0, 0));
+        var mouse = new CountingMouse();
+        Func<Task<BoundingBox?>> getBox = () => Task.FromResult<BoundingBox?>(new BoundingBox(200, -0.015625, 200, 21.5));
+
+        var result = await HumanScroll.HumanScrollIntoViewAsync(page, mouse, getBox, 0, 0, FastConfig());
+
+        Assert.False(result.DidScroll);
+        Assert.Equal(0, mouse.WheelCalls);
+    }
+
     [Fact]
     public async Task Fully_visible_above_zone_with_room_still_scrolls()
     {
```

**File**: `js/src/human/scroll.ts` (modified, +2/-1)
```diff
@@ -141,7 +141,8 @@ async function scrollYIntoView<T extends ElementBounds>(
     return { box, cursorX, cursorY, didScroll: false };
   }
 
-  const fullyVisible = box.y >= 0 && box.y + box.height <= viewport.height;
+  // 1px slack: layout can report a top edge of -1/64 px on an unscrolled page.
+  const fullyVisible = box.y >= -1 && box.y + box.height <= viewport.height + 1;
   if (fullyVisible) {
     const zoneMid = viewport.height * (cfg.scroll_target_zone[0] + cfg.scroll_target_zone[1]) / 2;
     const needUp = box.y + box.height / 2 < zoneMid;
```

**File**: `js/tests/humanize.test.ts` (modified, +21/-0)
```diff
@@ -1634,6 +1634,27 @@ describe("humanScrollIntoView", () => {
     expect(page.evaluate).not.toHaveBeenCalled();
   });
 
+  it("bails when layout reports a sub-pixel negative top on an unscrolled page", async () => {
+    const { humanScrollIntoView } = await import("../src/human/scroll.js");
+    const cfg = resolveConfig("default");
+
+    const page: any = {
+      viewportSize: () => ({ width: 1000, height: 700 }),
+      evaluate: vi.fn(),
+      _stealth: { evaluate: vi.fn(async () => ({ y: 0, maxY: 0, x: 0, minX: 0, maxX: 0 })) },
+    };
+    const raw = {
+      move: vi.fn(async () => { }), down: vi.fn(async () => { }),
+      up: vi.fn(async () => { }), wheel: vi.fn(async () => { }),
+    };
+    const topBox = { x: 200, y: -0.015625, width: 200, height: 21.5 };
+
+    const result = await humanScrollIntoView(page, raw, async () => topBox, 0, 0, cfg);
+
+    expect(result.didScroll).toBe(false);
+    expect(raw.wheel).not.toHaveBeenCalled();
+  });
+
   it("still scrolls a fully-visible above-zone element when the page CAN scroll up (no over-bail)", async () => {
     const { humanScrollIntoView } = await import("../src/human/scroll.js");
     const cfg = resolveConfig("default", {
```

**File**: `tests/test_humanize_unit.py` (modified, +20/-0)
```diff
@@ -2377,6 +2377,26 @@ def test_human_scroll_into_view_skips_x_when_pinned_right(self):
         assert box == clipped_box
         assert not raw.wheel.called
 
+    def test_human_scroll_into_view_subpixel_negative_top_at_page_top_bails(self):
+        """Layout reports top=-1/64 px on an unscrolled page. Still fully visible,
+        so the pinned-at-top check must stop a pointless upward scroll."""
+        from cloakbrowser.human.scroll import human_scroll_into_view
+        from cloakbrowser.human.config import resolve_config
+        from unittest.mock import MagicMock
+
+        cfg = resolve_config("default", None)
+        page = MagicMock()
+        page.viewport_size = {"width": 1000, "height": 700}
+        page._stealth_world.evaluate.return_value = {"y": 0, "maxY": 0, "x": 0, "minX": 0, "maxX": 0}
+        raw = MagicMock()
+        top_box = {"x": 200, "y": -0.015625, "width": 200, "height": 21.5}
+
+        _, _, _, did_scroll = human_scroll_into_view(
+            page, raw, lambda: top_box, 0, 0, cfg,
+        )
+        assert not did_scroll
+        assert not raw.wheel.called
+
     def test_human_scroll_into_view_scrolls_x_left_on_rtl_page(self):
         """RTL page at its start (scrollX 0, range -600..0): a box in the left
         overflow gets negative horizontal wheel events."""
```

---

### Incident Patch 5: `65b23cac` (2026-09-29)
**Commit Message**: fix(humanize): scroll the x axis in scroll-into-view (#521) (#554)

* fix(humanize): scroll the x axis in scroll-into-view (#521)

humanScrollIntoView only measured and scrolled the y axis. A target past
the right edge of a horizontally overflowing page counted as in view, so
no wheel events were sent, the click point landed offscreen and the
pointer check failed with "element is covered by <none>" after the full
timeout.

After the vertical pass, a horizontal pass now checks that the box fits
inside the viewport width and, if not, centres it with the same
humanized wheel burst on the x axis. It skips the scroll when the page
is already pinned at the needed horizontal boundary, mirroring the y
pinned check. Applied to Python (sync and async), JS Playwright,
Puppeteer and .NET.

.NET: IRawScrollPage.GetScrollStateAsync now also returns X and MaxX.

Fixes #521

* fix(humanize): handle RTL scrollX in the horizontal pinned check (#521)

In right-to-left documents Chrome's window.scrollX runs from 0 down to
-(scrollWidth - clientWidth). The x pass treated "scrollX <= 0" as pinned
at the left edge, so on an RTL page at its start a target in the left
overflow was never scrolled into view 

**File**: `cloakbrowser/human/scroll.py` (modified, +79/-4)
```diff
@@ -24,6 +24,10 @@ def _is_in_viewport(bounds: dict, viewport_height: int, cfg: HumanConfig) -> boo
     return top_edge >= zone_top and bottom_edge <= zone_bottom
 
 
+def _is_in_viewport_x(bounds: dict, viewport_width: int) -> bool:
+    return bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= viewport_width
+
+
 def _get_element_box(page: Any, selector: str, timeout: float = 30000) -> Optional[dict]:
     """Locate ``selector`` and read geometry only in the isolated world."""
     world = getattr(page, "_stealth_world", None)
@@ -46,14 +50,19 @@ def _get_element_box(page: Any, selector: str, timeout: float = 30000) -> Option
     raise StealthEvaluationError(selector)
 
 
+# In RTL documents Chrome's scrollX runs from 0 down to -range, and the
+# viewport takes its direction from <body> when there is one.
 _SCROLL_JS = (
     "(() => { const e = document.scrollingElement || document.documentElement;"
-    " return { y: window.scrollY, maxY: Math.max(0, e.scrollHeight - e.clientHeight) }; })()"
+    " const rangeX = Math.max(0, e.scrollWidth - e.clientWidth);"
+    " const rtl = getComputedStyle(document.body || e).direction === 'rtl';"
+    " return { y: window.scrollY, maxY: Math.max(0, e.scrollHeight - e.clientHeight),"
+    " x: window.scrollX, minX: rtl ? -rangeX : 0, maxX: rtl ? 0 : rangeX }; })()"
 )
 
 
 def _read_scroll_state(page: Any) -> dict:
-    """Read vertical scroll state only through the isolated world."""
+    """Read scroll state only through the isolated world."""
     world = getattr(page, "_stealth_world", None)
     if world is None:
         raise StealthWorldUnavailableError()
@@ -66,15 +75,19 @@ def _read_scroll_state(page: Any) -> dict:
     return state
 
 
-def _smooth_wheel(raw: RawMouse, delta: int, cfg: HumanConfig) -> None:
+def _smooth_wheel(raw: RawMouse, delta: int, cfg: HumanConfig, axis: str = "y") -> None:
     """Send one logical scroll as a burst of small wheel events (like real inertia)."""
     abs_d = abs(delta)
     sign = 1 if delta > 0 else -1
     sent = 0
     while sent < abs_d:
         step_size = rand(20, 40)
         chunk = min(step_size, abs_d - sent)
-        raw.wheel(0, round(chunk) * sign)
+        step = round(chunk) * sign
+        if axis == "x":
+            raw.wheel(step, 0)
+        else:
+            raw.wheel(0, step)
         sent += chunk
         sleep_ms(rand(8, 20))
 
@@ -115,6 +128,24 @@ def human_scroll_into_view(
     viewport_height = viewport["height"]
     viewport_width = viewport["width"]
 
+    box, cursor_x, cursor_y, did_scroll_y = _scroll_y_into_view(
+        page, raw, get_box, viewport_width, viewport_height, cursor_x, cursor_y, cfg,
+    )
+    box, cursor_x, cursor_y, did_scroll_x = _scroll_x_into_view(
+        page, raw, get_box, box, viewport_width, viewport_height, cursor_x, cursor_y, cfg,
+    )
+    return box, cursor_x, cursor_y, did_scroll_y or did_scroll_x
+
+
+def _scroll_y_into_view(
+    page: Any,
+    raw: RawMouse,
+    get_box: Callable[[], Optional[dict]],
+    viewport_width: int, viewport_height: int,
+    cursor_x: float, cursor_y: float,
+    cfg: HumanConfig,
+) -> Tuple[dict, float, float, bool]:
+    """Vertical pass: bring the box into ``scroll_target_zone``."""
     box = get_box()
     if box is None:
         raise RuntimeError("Element not found while scrolling into view")
@@ -201,6 +232,50 @@ def human_scroll_into_view(
     return box, cursor_x, cursor_y, True
 
 
+def _scroll_x_into_view(
+    page: Any,
+    raw: RawMouse,
+    get_box: Callable[[], Optional[dict]],
+    box: dict,
+    viewport_width: int, viewport_height: int,
+    cursor_x: float, cursor_y: float,
+    cfg: HumanConfig,
+) -> Tuple[dict, float, float, bool]:
+    """Horizontal pass: bring the box inside the viewport width (#521).
+
+    Only containment is checked here, not ``scroll_target_zone``: the zone is
+    a vertical reading position, and horizontal overflow is the exception.
+    """
+    if _is_in_viewport_x(box, viewport_width):
+        return box, cursor_x, cursor_y, False
+
+    distance_to_scroll = box["x"] + box["width"] / 2 - viewport_width / 2
+    # A box wider than the viewport is never contained; once centred, skip the near-zero wheel.
+    if abs(distance_to_scroll) < 1:
+        return box, cursor_x, cursor_y, False
+
+    # Page pinned at the boundary in the needed direction: scrolling can't help.
+    scroll = _read_scroll_state(page)
+    if (scroll["x"] <= scroll["minX"]) if distance_to_scroll < 0 else (scroll["x"] >= scroll["maxX"]):
+        return box, cursor_x, cursor_y, False
+
+    scroll_area_x = round(viewport_width * rand(0.3, 0.7))
+    scroll_area_y = round(viewport_height * rand(0.3, 0.7))
+    human_move(raw, cursor_x, cursor_y, scroll_area_x, scroll_area_y, cfg)
+    cursor_x = scroll_area_x
+    cursor_y = scroll_area_y
+    sleep_ms(rand_range(cfg.scroll_pre_move_delay))
+
+    _smooth_wheel(raw, round(distance_to_scroll), cfg, axis="x")
+    sleep_ms(rand_range(cfg.
```

**File**: `cloakbrowser/human/scroll_async.py` (modified, +72/-4)
```diff
@@ -14,7 +14,7 @@
 
 from .config import HumanConfig, rand, rand_range, rand_int_range, async_sleep_ms
 from .mouse_async import AsyncRawMouse, async_human_move
-from .scroll import _is_in_viewport, _SCROLL_JS
+from .scroll import _is_in_viewport, _is_in_viewport_x, _SCROLL_JS
 from .stealth_dom import (
     build_box_js, async_eval_parsed, EVALUATION_FAILED, NOT_FOUND, OK, UNSUPPORTED,
     StealthEvaluationError, StealthWorldUnavailableError,
@@ -47,7 +47,7 @@ async def _get_element_box_async(
 
 
 async def _async_read_scroll_state(page: Any) -> dict:
-    """Read vertical scroll state only through the isolated world."""
+    """Read scroll state only through the isolated world."""
     world = getattr(page, "_stealth_world", None)
     if world is None:
         raise StealthWorldUnavailableError()
@@ -60,15 +60,21 @@ async def _async_read_scroll_state(page: Any) -> dict:
     return state
 
 
-async def _async_smooth_wheel(raw: AsyncRawMouse, delta: int, cfg: HumanConfig) -> None:
+async def _async_smooth_wheel(
+    raw: AsyncRawMouse, delta: int, cfg: HumanConfig, axis: str = "y",
+) -> None:
     """Send one logical scroll as a burst of small wheel events (like real inertia)."""
     abs_d = abs(delta)
     sign = 1 if delta > 0 else -1
     sent = 0
     while sent < abs_d:
         step_size = rand(20, 40)
         chunk = min(step_size, abs_d - sent)
-        await raw.wheel(0, round(chunk) * sign)
+        step = round(chunk) * sign
+        if axis == "x":
+            await raw.wheel(step, 0)
+        else:
+            await raw.wheel(0, step)
         sent += chunk
         await async_sleep_ms(rand(8, 20))
 
@@ -108,6 +114,24 @@ async def async_human_scroll_into_view(
     viewport_height = viewport["height"]
     viewport_width = viewport["width"]
 
+    box, cursor_x, cursor_y, did_scroll_y = await _async_scroll_y_into_view(
+        page, raw, get_box, viewport_width, viewport_height, cursor_x, cursor_y, cfg,
+    )
+    box, cursor_x, cursor_y, did_scroll_x = await _async_scroll_x_into_view(
+        page, raw, get_box, box, viewport_width, viewport_height, cursor_x, cursor_y, cfg,
+    )
+    return box, cursor_x, cursor_y, did_scroll_y or did_scroll_x
+
+
+async def _async_scroll_y_into_view(
+    page: Any,
+    raw: AsyncRawMouse,
+    get_box: Callable[[], Awaitable[Optional[dict]]],
+    viewport_width: int, viewport_height: int,
+    cursor_x: float, cursor_y: float,
+    cfg: HumanConfig,
+) -> Tuple[dict, float, float, bool]:
+    """Vertical pass: bring the box into ``scroll_target_zone``."""
     box = await get_box()
     if box is None:
         raise RuntimeError("Element not found while scrolling into view")
@@ -194,6 +218,50 @@ async def async_human_scroll_into_view(
     return box, cursor_x, cursor_y, True
 
 
+async def _async_scroll_x_into_view(
+    page: Any,
+    raw: AsyncRawMouse,
+    get_box: Callable[[], Awaitable[Optional[dict]]],
+    box: dict,
+    viewport_width: int, viewport_height: int,
+    cursor_x: float, cursor_y: float,
+    cfg: HumanConfig,
+) -> Tuple[dict, float, float, bool]:
+    """Horizontal pass: bring the box inside the viewport width (#521).
+
+    Only containment is checked here, not ``scroll_target_zone``: the zone is
+    a vertical reading position, and horizontal overflow is the exception.
+    """
+    if _is_in_viewport_x(box, viewport_width):
+        return box, cursor_x, cursor_y, False
+
+    distance_to_scroll = box["x"] + box["width"] / 2 - viewport_width / 2
+    # A box wider than the viewport is never contained; once centred, skip the near-zero wheel.
+    if abs(distance_to_scroll) < 1:
+        return box, cursor_x, cursor_y, False
+
+    # Page pinned at the boundary in the needed direction: scrolling can't help.
+    scroll = await _async_read_scroll_state(page)
+    if (scroll["x"] <= scroll["minX"]) if distance_to_scroll < 0 else (scroll["x"] >= scroll["maxX"]):
+        return box, cursor_x, cursor_y, False
+
+    scroll_area_x = round(viewport_width * rand(0.3, 0.7))
+    scroll_area_y = round(viewport_height * rand(0.3, 0.7))
+    await async_human_move(raw, cursor_x, cursor_y, scroll_area_x, scroll_area_y, cfg)
+    cursor_x = scroll_area_x
+    cursor_y = scroll_area_y
+    await async_sleep_ms(rand_range(cfg.scroll_pre_move_delay))
+
+    await _async_smooth_wheel(raw, round(distance_to_scroll), cfg, axis="x")
+    await async_sleep_ms(rand_range(cfg.scroll_settle_delay))
+
+    box = await get_box()
+    if box is None:
+        raise RuntimeError("Element lost after scrolling into view")
+
+    return box, cursor_x, cursor_y, True
+
+
 async def async_scroll_to_element(
     page: Any,
     raw: AsyncRawMouse,
```

**File**: `dotnet/src/CloakBrowser/Human/HumanScroll.cs` (modified, +76/-7)
```diff
@@ -19,12 +19,14 @@ public interface IRawScrollPage
     Task<(int Width, int Height)?> GetLiveWindowSizeAsync();
 
     /// <summary>
-    /// Current vertical scroll offset (<c>window.scrollY</c>) and the maximum
-    /// scrollable offset (<c>scrollHeight - clientHeight</c>). Used to detect when
-    /// the page is pinned at a boundary and further scrolling can't help. Returns
-    /// null if the values can't be read.
+    /// Current scroll offsets (<c>window.scrollY</c>, <c>window.scrollX</c>) and the
+    /// maximum scrollable offsets (<c>scrollHeight - clientHeight</c>,
+    /// <c>scrollWidth - clientWidth</c>). X is measured from the leftmost scroll
+    /// position, so it runs 0..MaxX in RTL documents too. Used to detect when the
+    /// page is pinned at a boundary and further scrolling can't help. Returns null
+    /// if the values can't be read.
     /// </summary>
-    Task<(double Y, double MaxY)?> GetScrollStateAsync();
+    Task<(double Y, double MaxY, double X, double MaxX)?> GetScrollStateAsync();
 }
 
 /// <summary>Result of a humanized scroll-into-view operation.</summary>
@@ -49,8 +51,13 @@ private static bool IsInViewport(BoundingBox bounds, int viewportHeight, HumanCo
         return topEdge >= zoneTop && bottomEdge <= zoneBottom;
     }
 
+    private static bool IsInViewportX(BoundingBox bounds, int viewportWidth)
+    {
+        return bounds.X >= 0 && bounds.X + bounds.Width <= viewportWidth;
+    }
+
     /// <summary>Send one logical scroll as a burst of small wheel events (like real inertia).</summary>
-    private static async Task SmoothWheelAsync(IRawMouse raw, int delta, HumanConfig cfg)
+    private static async Task SmoothWheelAsync(IRawMouse raw, int delta, HumanConfig cfg, bool horizontal = false)
     {
         double absD = Math.Abs(delta);
         int sign = delta > 0 ? 1 : -1;
@@ -59,7 +66,11 @@ private static async Task SmoothWheelAsync(IRawMouse raw, int delta, HumanConfig
         {
             double stepSize = HumanRandom.Rand(20, 40);
             double chunk = Math.Min(stepSize, absD - sent);
-            await raw.WheelAsync(0, Math.Round(chunk) * sign).ConfigureAwait(false);
+            double step = Math.Round(chunk) * sign;
+            if (horizontal)
+                await raw.WheelAsync(step, 0).ConfigureAwait(false);
+            else
+                await raw.WheelAsync(0, step).ConfigureAwait(false);
             sent += chunk;
             await HumanRandom.SleepMsAsync(HumanRandom.Rand(8, 20)).ConfigureAwait(false);
         }
@@ -109,6 +120,20 @@ public static async Task<ScrollResult> HumanScrollIntoViewAsync(
         int viewportHeight = viewport.Value.Height;
         int viewportWidth = viewport.Value.Width;
 
+        var yPass = await ScrollYIntoViewAsync(page, raw, getBox, viewportWidth, viewportHeight, cursorX, cursorY, cfg).ConfigureAwait(false);
+        var xPass = await ScrollXIntoViewAsync(page, raw, getBox, yPass.Box, viewportWidth, viewportHeight, yPass.CursorX, yPass.CursorY, cfg).ConfigureAwait(false);
+        return xPass with { DidScroll = yPass.DidScroll || xPass.DidScroll };
+    }
+
+    /// <summary>Vertical pass: bring the box into <c>ScrollTargetZone</c>.</summary>
+    private static async Task<ScrollResult> ScrollYIntoViewAsync(
+        IRawScrollPage page,
+        IRawMouse raw,
+        Func<Task<BoundingBox?>> getBox,
+        int viewportWidth, int viewportHeight,
+        double cursorX, double cursorY,
+        HumanConfig cfg)
+    {
         var box = await getBox().ConfigureAwait(false);
         if (box == null)
             throw new InvalidOperationException("Element not found while scrolling into view");
@@ -211,4 +236,48 @@ public static async Task<ScrollResult> HumanScrollIntoViewAsync(
 
         return new ScrollResult(box.Value, cursorX, cursorY, true);
     }
+
+    /// <summary>
+    /// Horizontal pass: bring the box inside the viewport width (#521). Only
+    /// containment is checked here, not <c>ScrollTargetZone</c>: the zone is a
+    /// vertical reading position, and horizontal overflow is the exception.
+    /// </summary>
+    private static async Task<ScrollResult> ScrollXIntoViewAsync(
+        IRawScrollPage page,
+        IRawMouse raw,
+        Func<Task<BoundingBox?>> getBox,
+        BoundingBox box,
+        int viewportWidth, int viewportHeight,
+        double cursorX, double cursorY,
+        HumanConfig cfg)
+    {
+        if (IsInViewportX(box, viewportWidth))
+            return new ScrollResult(box, cursorX, cursorY, false);
+
+        double distanceToScroll = box.X + box.Width / 2 - viewportWidth / 2.0;
+        // A box wider than the viewport is never contained; once centred, skip the near-zero wheel.
+        if (Math.Abs(distanceToScroll) < 1)
+            return new ScrollResult(box, cursorX, cursorY, false);
+
+        // Page pinned at the boundary in the needed direction: scrolling can't help.
+        var scroll = await page.GetScrollStateAsync().C
```

**File**: `dotnet/src/CloakBrowser/Human/PlaywrightAdapters.cs` (modified, +18/-4)
```diff
@@ -108,17 +108,31 @@ public PlaywrightScrollPage(IPage page, Func<Task<IsolatedWorld>> getStealthAsyn
         return (resolvedWidth, resolvedHeight);
     }
 
-    public async Task<(double Y, double MaxY)?> GetScrollStateAsync()
+    public async Task<(double Y, double MaxY, double X, double MaxX)?> GetScrollStateAsync()
     {
         var world = await _getStealthAsync().ConfigureAwait(false);
+        // In RTL documents Chrome's scrollX runs from 0 down to -range, and the
+        // viewport takes its direction from <body> when there is one.
         var value = await world.EvaluateAsync(
             "(() => { const e = document.scrollingElement || document.documentElement;" +
-            " return { y: window.scrollY, maxY: Math.max(0, e.scrollHeight - e.clientHeight) }; })()")
+            " const rangeX = Math.max(0, e.scrollWidth - e.clientWidth);" +
+            " const rtl = getComputedStyle(document.body || e).direction === 'rtl';" +
+            " return { y: window.scrollY, maxY: Math.max(0, e.scrollHeight - e.clientHeight)," +
+            " x: window.scrollX, minX: rtl ? -rangeX : 0, maxX: rtl ? 0 : rangeX }; })()")
             .ConfigureAwait(false);
+        return ParseScrollState(value);
+    }
+
+    /// <summary>Shifts X and MaxX by minX so X runs from 0 at the leftmost position in LTR and RTL alike.</summary>
+    internal static (double Y, double MaxY, double X, double MaxX) ParseScrollState(System.Text.Json.JsonElement? value)
+    {
         if (value == null || value.Value.ValueKind != System.Text.Json.JsonValueKind.Object
             || !value.Value.TryGetProperty("y", out var y)
-            || !value.Value.TryGetProperty("maxY", out var maxY))
+            || !value.Value.TryGetProperty("maxY", out var maxY)
+            || !value.Value.TryGetProperty("x", out var x)
+            || !value.Value.TryGetProperty("minX", out var minX)
+            || !value.Value.TryGetProperty("maxX", out var maxX))
             throw new StealthEvaluationError("<scroll-state>");
-        return (y.GetDouble(), maxY.GetDouble());
+        return (y.GetDouble(), maxY.GetDouble(), x.GetDouble() - minX.GetDouble(), maxX.GetDouble() - minX.GetDouble());
     }
 }
```

**File**: `dotnet/tests/CloakBrowser.Tests/ScrollFallbackTests.cs` (modified, +77/-9)
```diff
@@ -37,16 +37,16 @@ private sealed class NoViewportPage : IRawScrollPage
             return Task.FromResult(_live);
         }
 
-        public Task<(double Y, double MaxY)?> GetScrollStateAsync() =>
-            Task.FromResult<(double, double)?>((0, 0));
+        public Task<(double Y, double MaxY, double X, double MaxX)?> GetScrollStateAsync() =>
+            Task.FromResult<(double, double, double, double)?>((0, 0, 0, 0));
     }
 
     /// <summary>Scroll page with a fixed viewport and configurable scroll position.</summary>
     private sealed class ViewportPage : IRawScrollPage
     {
         private readonly (int, int) _size;
-        private readonly (double, double)? _scroll;
-        public ViewportPage((int, int) size, (double, double)? scroll)
+        private readonly (double, double, double, double)? _scroll;
+        public ViewportPage((int, int) size, (double, double, double, double)? scroll)
         {
             _size = size;
             _scroll = scroll;
@@ -55,17 +55,18 @@ public ViewportPage((int, int) size, (double, double)? scroll)
         public (int Width, int Height)? ViewportSize => _size;
         public Task<(int Width, int Height)?> GetLiveWindowSizeAsync() =>
             Task.FromResult<(int, int)?>(_size);
-        public Task<(double Y, double MaxY)?> GetScrollStateAsync() =>
+        public Task<(double Y, double MaxY, double X, double MaxX)?> GetScrollStateAsync() =>
             Task.FromResult(_scroll);
     }
 
     private sealed class CountingMouse : IRawMouse
     {
-        public int WheelCalls { get; private set; }
+        public List<(double Dx, double Dy)> Wheels { get; } = new();
+        public int WheelCalls => Wheels.Count;
         public Task MoveAsync(double x, double y) => Task.CompletedTask;
         public Task DownAsync() => Task.CompletedTask;
         public Task UpAsync() => Task.CompletedTask;
-        public Task WheelAsync(double dx, double dy) { WheelCalls++; return Task.CompletedTask; }
+        public Task WheelAsync(double dx, double dy) { Wheels.Add((dx, dy)); return Task.CompletedTask; }
     }
 
     // Zero out the timing ranges so the scroll loop runs instantly in tests.
@@ -127,7 +128,7 @@ public async Task Fully_visible_above_zone_at_top_bails_without_scrolling()
     {
         // viewport 720 -> zone [144, 576]; element top=50 is above the zone but
         // fully visible, and the page is pinned at the top (y=0). Must not scroll.
-        var page = new ViewportPage((1280, 720), scroll: (0, 2000));
+        var page = new ViewportPage((1280, 720), scroll: (0, 2000, 0, 0));
         var mouse = new CountingMouse();
         Func<Task<BoundingBox?>> getBox = () => Task.FromResult<BoundingBox?>(new BoundingBox(200, 50, 50, 30));
 
@@ -141,12 +142,79 @@ public async Task Fully_visible_above_zone_at_top_bails_without_scrolling()
     public async Task Fully_visible_above_zone_with_room_still_scrolls()
     {
         // Same element, but the page is scrolled down (y=500) so it CAN scroll up.
-        var page = new ViewportPage((1280, 720), scroll: (500, 2000));
+        var page = new ViewportPage((1280, 720), scroll: (500, 2000, 0, 0));
         var mouse = new CountingMouse();
         Func<Task<BoundingBox?>> getBox = () => Task.FromResult<BoundingBox?>(new BoundingBox(200, 50, 50, 30));
 
         await HumanScroll.HumanScrollIntoViewAsync(page, mouse, getBox, 0, 0, FastConfig());
 
         Assert.True(mouse.WheelCalls > 0);
     }
+
+    [Fact]
+    public async Task Box_past_right_edge_scrolls_x_axis_only()
+    {
+        // #521: viewport 1000 wide, element spans x 800..1600 on a page that can
+        // scroll 600px right. The y axis is already in the zone.
+        var page = new ViewportPage((1000, 700), scroll: (0, 0, 0, 600));
+        var mouse = new CountingMouse();
+        var boxes = new Queue<BoundingBox?>(new BoundingBox?[]
+        {
+            new BoundingBox(800, 300, 800, 30),
+            new BoundingBox(200, 300, 800, 30),
+        });
+        Func<Task<BoundingBox?>> getBox = () => Task.FromResult(boxes.Dequeue());
+
+        var result = await HumanScroll.HumanScrollIntoViewAsync(page, mouse, getBox, 0, 0, FastConfig());
+
+        Assert.True(result.DidScroll);
+        Assert.Equal(200, result.Box.X);
+        Assert.NotEmpty(mouse.Wheels);
+        Assert.All(mouse.Wheels, w =>
+        {
+            Assert.True(w.Dx > 0);
+            Assert.Equal(0, w.Dy);
+        });
+    }
+
+    [Fact]
+    public async Task Box_past_right_edge_with_page_pinned_right_bails_without_scrolling()
+    {
+        var page = new ViewportPage((1000, 700), scroll: (0, 0, 600, 600));
+        var mouse = new CountingMouse();
+        Func<Task<BoundingBox?>> getBox = () => Task.FromResult<BoundingBox?>(new BoundingBox(900, 300, 200, 30));
+
+        var result = await HumanScroll.HumanScrollIntoViewAsync(page, mouse, getBox, 0, 0, FastConfig());
+
+        Assert.False(result.DidScroll);
+        Assert.Equ
```

**File**: `js/src/human-puppeteer/scroll.ts` (modified, +57/-0)
```diff
@@ -32,6 +32,10 @@ function isInViewport(
   return topEdge >= zoneTop && bottomEdge <= zoneBottom;
 }
 
+function isInViewportX(bounds: ElementBounds, viewportWidth: number): boolean {
+  return bounds.x >= 0 && bounds.x + bounds.width <= viewportWidth;
+}
+
 export async function smoothWheel(
   raw: RawMouse,
   delta: number,
@@ -104,6 +108,19 @@ export async function humanScrollIntoView(
   }
   if (!viewport || !viewport.height) throw new Error('Viewport size not available');
 
+  const yPass = await scrollYIntoView(raw, getBox, viewport, cursorX, cursorY, cfg);
+  return scrollXIntoView(raw, getBox, yPass.box, viewport, yPass.cursorX, yPass.cursorY, cfg);
+}
+
+/** Vertical pass: bring the box into ``scroll_target_zone``. */
+async function scrollYIntoView(
+  raw: RawMouse,
+  getBox: () => Promise<ElementBounds | null>,
+  viewport: { width: number; height: number },
+  cursorX: number,
+  cursorY: number,
+  cfg: HumanConfig,
+): Promise<{ box: ElementBounds; cursorX: number; cursorY: number }> {
   let box = await getBox();
   if (!box) throw new Error('Element not found while scrolling into view');
 
@@ -187,6 +204,46 @@ export async function humanScrollIntoView(
   return { box, cursorX, cursorY };
 }
 
+/**
+ * Horizontal pass: bring the box inside the viewport width (#521).
+ *
+ * Only containment is checked here, not ``scroll_target_zone``: the zone is a
+ * vertical reading position, and horizontal overflow is the exception.
+ */
+async function scrollXIntoView(
+  raw: RawMouse,
+  getBox: () => Promise<ElementBounds | null>,
+  box: ElementBounds,
+  viewport: { width: number; height: number },
+  cursorX: number,
+  cursorY: number,
+  cfg: HumanConfig,
+): Promise<{ box: ElementBounds; cursorX: number; cursorY: number }> {
+  if (isInViewportX(box, viewport.width)) {
+    return { box, cursorX, cursorY };
+  }
+
+  const distanceToScroll = box.x + box.width / 2 - viewport.width / 2;
+  // A box wider than the viewport is never contained; once centred, skip the near-zero wheel.
+  if (Math.abs(distanceToScroll) < 1) {
+    return { box, cursorX, cursorY };
+  }
+
+  const scrollAreaX = Math.round(viewport.width * rand(0.3, 0.7));
+  const scrollAreaY = Math.round(viewport.height * rand(0.3, 0.7));
+  await humanMove(raw, cursorX, cursorY, scrollAreaX, scrollAreaY, cfg);
+  cursorX = scrollAreaX;
+  cursorY = scrollAreaY;
+  await sleep(randRange(cfg.scroll_pre_move_delay));
+
+  await smoothWheel(raw, Math.round(distanceToScroll), cfg, 'x');
+  await sleep(randRange(cfg.scroll_settle_delay));
+
+  const finalBox = await getBox();
+  if (!finalBox) throw new Error('Element lost after scrolling into view');
+  return { box: finalBox, cursorX, cursorY };
+}
+
 /**
  * Selector-based humanized scroll (Puppeteer).
  *
```

**File**: `js/src/human/scroll.ts` (modified, +92/-5)
```diff
@@ -39,18 +39,31 @@ function isInViewport(
   return topEdge >= zoneTop && bottomEdge <= zoneBottom;
 }
 
+function isInViewportX(bounds: ElementBounds, viewportWidth: number): boolean {
+  return bounds.x >= 0 && bounds.x + bounds.width <= viewportWidth;
+}
+
+// In RTL documents Chrome's scrollX runs from 0 down to -range, and the
+// viewport takes its direction from <body> when there is one.
 const SCROLL_JS =
   '(() => { const e = document.scrollingElement || document.documentElement;' +
-  ' return { y: window.scrollY, maxY: Math.max(0, e.scrollHeight - e.clientHeight) }; })()';
+  ' const rangeX = Math.max(0, e.scrollWidth - e.clientWidth);' +
+  " const rtl = getComputedStyle(document.body || e).direction === 'rtl';" +
+  ' return { y: window.scrollY, maxY: Math.max(0, e.scrollHeight - e.clientHeight),' +
+  ' x: window.scrollX, minX: rtl ? -rangeX : 0, maxX: rtl ? 0 : rangeX }; })()';
 
-async function readScrollState(page: Page): Promise<{ y: number; maxY: number }> {
+async function readScrollState(
+  page: Page,
+): Promise<{ y: number; maxY: number; x: number; minX: number; maxX: number }> {
   const world = getWorld(page);
   if (!world) throw new StealthWorldUnavailableError();
   try {
     const state = await world.evaluate(SCROLL_JS);
     if (
       !state || typeof state !== 'object' ||
-      typeof state.y !== 'number' || typeof state.maxY !== 'number'
+      typeof state.y !== 'number' || typeof state.maxY !== 'number' ||
+      typeof state.x !== 'number' || typeof state.minX !== 'number' ||
+      typeof state.maxX !== 'number'
     ) {
       throw new StealthEvaluationError('<scroll-state>');
     }
@@ -61,14 +74,24 @@ async function readScrollState(page: Page): Promise<{ y: number; maxY: number }>
   }
 }
 
-async function smoothWheel(raw: RawMouse, delta: number, cfg: HumanConfig): Promise<void> {
+async function smoothWheel(
+  raw: RawMouse,
+  delta: number,
+  cfg: HumanConfig,
+  axis: 'x' | 'y' = 'y',
+): Promise<void> {
   const absD = Math.abs(delta);
   const sign = delta > 0 ? 1 : -1;
   let sent = 0;
   while (sent < absD) {
     const stepSize = rand(20, 40);
     const chunk = Math.min(stepSize, absD - sent);
-    await raw.wheel(0, Math.round(chunk) * sign);
+    const d = Math.round(chunk) * sign;
+    if (axis === 'x') {
+      await raw.wheel(d, 0);
+    } else {
+      await raw.wheel(0, d);
+    }
     sent += chunk;
     await sleep(rand(8, 20));
   }
@@ -94,6 +117,23 @@ export async function humanScrollIntoView<T extends ElementBounds>(
   }
   if (!viewport || !viewport.height) throw new Error('Viewport size not available');
 
+  const yPass = await scrollYIntoView(page, raw, getBox, viewport, cursorX, cursorY, cfg);
+  const xPass = await scrollXIntoView(
+    page, raw, getBox, yPass.box, viewport, yPass.cursorX, yPass.cursorY, cfg,
+  );
+  return { ...xPass, didScroll: yPass.didScroll || xPass.didScroll };
+}
+
+/** Vertical pass: bring the box into ``scroll_target_zone``. */
+async function scrollYIntoView<T extends ElementBounds>(
+  page: Page,
+  raw: RawMouse,
+  getBox: () => Promise<T | null>,
+  viewport: { width: number; height: number },
+  cursorX: number,
+  cursorY: number,
+  cfg: HumanConfig,
+): Promise<{ box: T; cursorX: number; cursorY: number; didScroll: boolean }> {
   let box = await getBox();
   if (!box) throw new Error('Element not found while scrolling into view');
 
@@ -180,6 +220,53 @@ export async function humanScrollIntoView<T extends ElementBounds>(
   return { box: finalBox, cursorX, cursorY, didScroll: true };
 }
 
+/**
+ * Horizontal pass: bring the box inside the viewport width (#521).
+ *
+ * Only containment is checked here, not ``scroll_target_zone``: the zone is a
+ * vertical reading position, and horizontal overflow is the exception.
+ */
+async function scrollXIntoView<T extends ElementBounds>(
+  page: Page,
+  raw: RawMouse,
+  getBox: () => Promise<T | null>,
+  box: T,
+  viewport: { width: number; height: number },
+  cursorX: number,
+  cursorY: number,
+  cfg: HumanConfig,
+): Promise<{ box: T; cursorX: number; cursorY: number; didScroll: boolean }> {
+  if (isInViewportX(box, viewport.width)) {
+    return { box, cursorX, cursorY, didScroll: false };
+  }
+
+  const distanceToScroll = box.x + box.width / 2 - viewport.width / 2;
+  // A box wider than the viewport is never contained; once centred, skip the near-zero wheel.
+  if (Math.abs(distanceToScroll) < 1) {
+    return { box, cursorX, cursorY, didScroll: false };
+  }
+
+  // Page pinned at the boundary in the needed direction: scrolling can't help.
+  const { x, minX, maxX } = await readScrollState(page);
+  if (distanceToScroll < 0 ? x <= minX : x >= maxX) {
+    return { box, cursorX, cursorY, didScroll: false };
+  }
+
+  const scrollAreaX = Math.round(viewport.width * rand(0.3, 0.7));
+  const scrollAreaY = Math.round(viewport.height * rand(0.3, 0.7));
+  await humanMove(raw, cursorX, cursorY, scrollAreaX, scrollAreaY, cfg);
+  cursorX = scro
```

**File**: `js/tests/humanize.test.ts` (modified, +92/-2)
```diff
@@ -1619,7 +1619,7 @@ describe("humanScrollIntoView", () => {
     const page: any = {
       viewportSize: () => ({ width: 1280, height: 720 }),
       evaluate: vi.fn(),
-      _stealth: { evaluate: vi.fn(async () => ({ y: 0, maxY: 2000 })) },
+      _stealth: { evaluate: vi.fn(async () => ({ y: 0, maxY: 2000, x: 0, minX: 0, maxX: 0 })) },
     };
     const raw = {
       move: vi.fn(async () => { }), down: vi.fn(async () => { }),
@@ -1645,7 +1645,7 @@ describe("humanScrollIntoView", () => {
     const page: any = {
       viewportSize: () => ({ width: 1280, height: 720 }),
       evaluate: vi.fn(),
-      _stealth: { evaluate: vi.fn(async () => ({ y: 500, maxY: 2000 })) },
+      _stealth: { evaluate: vi.fn(async () => ({ y: 500, maxY: 2000, x: 0, minX: 0, maxX: 0 })) },
     };
     const raw = {
       move: vi.fn(async () => { }), down: vi.fn(async () => { }),
@@ -1658,6 +1658,96 @@ describe("humanScrollIntoView", () => {
     expect(raw.wheel).toHaveBeenCalled();
     expect(page.evaluate).not.toHaveBeenCalled();
   }, 15000);
+
+  it("scrolls the x axis for an element past the right edge (#521)", async () => {
+    const { humanScrollIntoView } = await import("../src/human/scroll.js");
+    const cfg = resolveConfig("default", {
+      scroll_pre_move_delay: [0, 1], scroll_settle_delay: [0, 1],
+    });
+
+    const page: any = {
+      viewportSize: () => ({ width: 1000, height: 700 }),
+      evaluate: vi.fn(),
+      _stealth: { evaluate: vi.fn(async () => ({ y: 0, maxY: 0, x: 0, minX: 0, maxX: 600 })) },
+    };
+    const raw = {
+      move: vi.fn(async () => { }), down: vi.fn(async () => { }),
+      up: vi.fn(async () => { }), wheel: vi.fn(async (_dx: number, _dy: number) => { }),
+    };
+    const boxes = [
+      { x: 800, y: 300, width: 800, height: 30 },
+      { x: 200, y: 300, width: 800, height: 30 },
+    ];
+    let i = 0;
+    const getBox = async () => boxes[i++];
+
+    const result = await humanScrollIntoView(page, raw, getBox, 0, 0, cfg);
+
+    expect(result.didScroll).toBe(true);
+    expect(result.box.x).toBe(200);
+    expect(raw.wheel).toHaveBeenCalled();
+    for (const [dx, dy] of raw.wheel.mock.calls) {
+      expect(dx).toBeGreaterThan(0);
+      expect(dy).toBe(0);
+    }
+    expect(page.evaluate).not.toHaveBeenCalled();
+  }, 15000);
+
+  it("skips the x axis when the page is already scrolled fully right", async () => {
+    const { humanScrollIntoView } = await import("../src/human/scroll.js");
+    const cfg = resolveConfig("default");
+
+    const page: any = {
+      viewportSize: () => ({ width: 1000, height: 700 }),
+      evaluate: vi.fn(),
+      _stealth: { evaluate: vi.fn(async () => ({ y: 0, maxY: 0, x: 600, minX: 0, maxX: 600 })) },
+    };
+    const raw = {
+      move: vi.fn(async () => { }), down: vi.fn(async () => { }),
+      up: vi.fn(async () => { }), wheel: vi.fn(async () => { }),
+    };
+    const clippedBox = { x: 900, y: 300, width: 200, height: 30 };
+
+    const result = await humanScrollIntoView(page, raw, async () => clippedBox, 0, 0, cfg);
+
+    expect(result.didScroll).toBe(false);
+    expect(raw.wheel).not.toHaveBeenCalled();
+  });
+
+  it("scrolls the x axis left on an RTL page at its start", async () => {
+    const { humanScrollIntoView } = await import("../src/human/scroll.js");
+    const cfg = resolveConfig("default", {
+      scroll_pre_move_delay: [0, 1], scroll_settle_delay: [0, 1],
+    });
+
+    const page: any = {
+      viewportSize: () => ({ width: 1000, height: 700 }),
+      evaluate: vi.fn(),
+      _stealth: {
+        evaluate: vi.fn(async () => ({ y: 0, maxY: 0, x: 0, minX: -600, maxX: 0 })),
+      },
+    };
+    const raw = {
+      move: vi.fn(async () => { }), down: vi.fn(async () => { }),
+      up: vi.fn(async () => { }), wheel: vi.fn(async (_dx: number, _dy: number) => { }),
+    };
+    const boxes = [
+      { x: -600, y: 300, width: 200, height: 30 },
+      { x: 400, y: 300, width: 200, height: 30 },
+    ];
+    let i = 0;
+    const getBox = async () => boxes[i++];
+
+    const result = await humanScrollIntoView(page, raw, getBox, 0, 0, cfg);
+
+    expect(result.didScroll).toBe(true);
+    expect(result.box.x).toBe(400);
+    expect(raw.wheel).toHaveBeenCalled();
+    for (const [dx, dy] of raw.wheel.mock.calls) {
+      expect(dx).toBeLessThan(0);
+      expect(dy).toBe(0);
+    }
+  }, 15000);
 });
 
 describe("el.scrollIntoViewIfNeeded humanization", () => {
```

---

### Incident Patch 6: `9bc5e374` (2026-09-24)
**Commit Message**: release: v0.5.11 — Pro banner v152, macOS font check in info, direct archive unpack, .NET #549 fix

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -6,6 +6,15 @@ Changes are tagged: **[wrapper]** for Python/JS wrapper, **[binary]** for Chromi
 
 ---
 
+## [0.5.11] — 2026-09-24
+
+- **[wrapper]** The first-launch Pro banner now names the current Pro major (v152) instead of v151. Python, JavaScript, and .NET.
+- **[wrapper]** `cloakbrowser info` now reports macOS persona font completeness (a `Mac fonts:` line with the count found) next to the existing Windows font check, with a hint when the set is incomplete. Python, JavaScript, and .NET.
+- **[wrapper]** Downloaded binary archives are unpacked directly once their signature and checksum verify, dropping a redundant per-entry pass. Python, JavaScript, and .NET.
+- **[wrapper]** .NET: fix a `NullReferenceException` under `humanize` when a humanized locator (e.g. from `GetByText`) is passed to `AddLocatorHandlerAsync`, `RemoveLocatorHandlerAsync`, `Locator.Filter` (`Has`/`HasNot`), or `ScreenshotAsync` (`Mask`) (#549). Adds a public `Humanize.Unwrap(ILocator)` helper.
+
+---
+
 ## [0.5.10] — 2026-08-30
 
 - **[wrapper]** The first-launch welcome banner no longer aborts a launch on a legacy Windows console. On a non-UTF-8 (cp1252) console its arrow and dash characters raised `UnicodeEncodeError` on the binary-download path, which blocked license apply and profile launch (notably in CloakBrowser Manager). The banner is now ASCII and every write is guarded, so a cosmetic message can never stop a launch. Python, JavaScript, and .NET.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ page.goto("https://example.com")
 
 ---
 
-## Latest: v0.5.10 — 87 source-level stealth patches (Chromium 152.0.7977.82.1)
+## Latest: v0.5.11 — 87 source-level stealth patches (Chromium 152.0.7977.82.1)
 
 - **CloakBrowser Pro Stable** — Chromium `152.0.7977.82.1` on Linux x64, Linux ARM64, and Windows x64; macOS on `151.0.7922.108.3`. Set a `license_key` (`licenseKey` in JS) or the `CLOAKBROWSER_LICENSE_KEY` env var and the wrapper fetches the latest Stable build for your platform automatically. See [CloakBrowser Pro](#cloakbrowser-pro)
 - **.NET 8 / C# client** — CloakBrowser now ships as a NuGet package (`CloakBrowser`), mirroring the Python and JS wrappers.
```

**File**: `cloakbrowser/_version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-__version__ = "0.5.10"
+__version__ = "0.5.11"
```

**File**: `dotnet/src/CloakBrowser/CloakBrowser.csproj` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 
     <!-- NuGet packaging metadata -->
     <PackageId>CloakBrowser</PackageId>
-    <Version>0.5.10</Version>
+    <Version>0.5.11</Version>
     <Authors>CloakHQ</Authors>
     <Description>Stealth Chromium that passes every bot detection test. Drop-in Playwright (.NET) replacement with source-level fingerprint patches.</Description>
     <PackageLicenseExpression>MIT</PackageLicenseExpression>
```

**File**: `dotnet/src/CloakBrowser/CloakVersion.cs` (modified, +1/-1)
```diff
@@ -4,5 +4,5 @@ namespace CloakBrowser;
 public static class CloakVersion
 {
     /// <summary>The CloakBrowser .NET wrapper version.</summary>
-    public const string Version = "0.5.10";
+    public const string Version = "0.5.11";
 }
```

**File**: `js/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "cloakbrowser",
-  "version": "0.5.10",
+  "version": "0.5.11",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "cloakbrowser",
-      "version": "0.5.10",
+      "version": "0.5.11",
       "license": "MIT",
       "dependencies": {
         "tar": "^7.0.0"
```

**File**: `js/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "cloakbrowser",
-  "version": "0.5.10",
+  "version": "0.5.11",
   "description": "Stealth Chromium that passes every bot detection test. Drop-in Playwright/Puppeteer replacement with source-level fingerprint patches.",
   "type": "module",
   "main": "dist/index.js",
```

---

### Incident Patch 7: `9639bba2` (2026-09-23)
**Commit Message**: docs(readme): Chromium 152.0.7977.82.1 stable on Linux and Windows; bump Pro major banner to 152

**File**: `README.md` (modified, +6/-6)
```diff
@@ -150,11 +150,11 @@ page.goto("https://example.com")
 
 ---
 
-## Latest: v0.5.10 — 87 source-level stealth patches (Chromium 151.0.7922.108.6)
+## Latest: v0.5.10 — 87 source-level stealth patches (Chromium 152.0.7977.82.1)
 
-- **CloakBrowser Pro Stable** — Chromium `151.0.7922.108.6` on Linux x64, Linux ARM64, and Windows x64; macOS on `151.0.7922.108.3`. Set a `license_key` (`licenseKey` in JS) or the `CLOAKBROWSER_LICENSE_KEY` env var and the wrapper fetches the latest Stable build for your platform automatically. See [CloakBrowser Pro](#cloakbrowser-pro)
+- **CloakBrowser Pro Stable** — Chromium `152.0.7977.82.1` on Linux x64, Linux ARM64, and Windows x64; macOS on `151.0.7922.108.3`. Set a `license_key` (`licenseKey` in JS) or the `CLOAKBROWSER_LICENSE_KEY` env var and the wrapper fetches the latest Stable build for your platform automatically. See [CloakBrowser Pro](#cloakbrowser-pro)
 - **.NET 8 / C# client** — CloakBrowser now ships as a NuGet package (`CloakBrowser`), mirroring the Python and JS wrappers.
-- **Chromium 151 upgrade** — rebased the full patch set onto Chromium 151 (Linux, Windows, and macOS), re-validated against reference data
+- **Chromium 152 upgrade** — rebased the full patch set onto Chromium 152 for Linux and Windows; macOS stays on Chromium 151
 - **87 fingerprint patches** — rendering consistency improvements across Linux and Windows, corrected GPU/display/graphics parameters to match stock Chrome profiles
 - **Windows native GPU passthrough** — real hardware values pass through directly instead of being spoofed, matching real browser behavior
 - **HTTP proxy inline credentials** — new network-layer support for proxies with inline authentication
@@ -890,11 +890,11 @@ browser = await launch_async(args=["--remote-debugging-port=9242"])
 
 | Platform | Free | Pro | Status |
 |---|---|---|---|
-| Linux x86_64 | Chromium 146 (58 patches) | Chromium 151 (87 patches) | ✅ |
-| Linux arm64 (RPi, Graviton) | Chromium 146 (58 patches) | Chromium 151 (87 patches) | ✅ |
+| Linux x86_64 | Chromium 146 (58 patches) | Chromium 152 (87 patches) | ✅ |
+| Linux arm64 (RPi, Graviton) | Chromium 146 (58 patches) | Chromium 152 (87 patches) | ✅ |
 | macOS arm64 (Apple Silicon) | Chromium 145 (26 patches) | Chromium 151 (87 patches) | ✅ |
 | macOS x86_64 (Intel) | Chromium 145 (26 patches) | Chromium 151 (87 patches) | ✅ |
-| Windows x86_64 | Chromium 146 (58 patches) | Chromium 151 (87 patches) | ✅ |
+| Windows x86_64 | Chromium 146 (58 patches) | Chromium 152 (87 patches) | ✅ |
 
 The wrapper auto-downloads the correct binary for your platform.
 
```

**File**: `cloakbrowser/download.py` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ class BinaryVerificationError(RuntimeError):
 # Pro Chromium major shown in the free-tier welcome banner. Bump at each Pro
 # major release (there is no local constant to derive it from — the live Pro
 # version comes from the network, which we don't call just to print a banner).
-PRO_MAJOR = "151"
+PRO_MAJOR = "152"
 
 
 def _welcome_due(marker: Path, pro: bool) -> bool:
```

**File**: `dotnet/src/CloakBrowser/Download.cs` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ private static HttpClient CreateHttpClient()
     // Pro Chromium major shown in the free-tier welcome banner. Bump at each Pro
     // major release (there is no local constant to derive it from - the live Pro
     // version comes from the network, which we don't call just to print a banner).
-    private const string ProMajor = "151";
+    private const string ProMajor = "152";
 
     /// <summary>
     /// Whether the welcome banner should be shown now. Pro: once ever (only when
```

**File**: `js/src/download.ts` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ export const WELCOME_FREE_INTERVAL_SEC = 1 * 24 * 60 * 60;
 // Pro Chromium major shown in the welcome banner. Bump at each Pro major release
 // (no local constant to derive it from — the live Pro version comes from the
 // network, which we don't call just to print a banner). Mirrors download.py.
-const PRO_MAJOR = "151";
+const PRO_MAJOR = "152";
 
 /**
  * A downloaded binary could not be authenticated (bad/missing signature,
```

---

### Incident Patch 8: `11c76ebe` (2026-09-18)
**Commit Message**: fix(dotnet): unwrap HumanizedLocator for Playwright APIs that down-cast ILocator (#549)

Under humanize, page.GetByText(...) returns our HumanizedLocator decorator. Playwright
APIs that internally down-cast an ILocator arg to the concrete Locator (as Locator)
threw NullReferenceException on it. Unwrap to the raw locator before delegating, matching
the existing DragTo/Or/And/SelectOption pattern.

Covers AddLocatorHandlerAsync (both overloads, callback re-wrapped), RemoveLocatorHandlerAsync,
Locator.Filter (Has/HasNot), and Page/ElementHandle ScreenshotAsync (Mask). Also adds
HumanizedLocator to LicenseGuard.Unwrap and a public Humanize.Unwrap(ILocator) escape hatch.
Python/JS unaffected (they monkey-patch in place, no wrapper type).

**File**: `dotnet/examples/CloakBrowser.Examples/Program.cs` (modified, +46/-0)
```diff
@@ -27,6 +27,7 @@
     case "webrtctest": await WebRtcTest(); break;
     case "trusted": await TrustedTest(); break;
     case "timeout": await TimeoutTest(); break;
+    case "repro549": await Repro549(); break;
     default:
         Console.Error.WriteLine($"Unknown example: {which}");
         Console.Error.WriteLine("Available: basic, humanize, context, persistent, proxy-geoip, bottest, behavioral, visual");
@@ -568,3 +569,48 @@ await page.ClickAsync("#this-element-does-not-exist",
         ? ">>> PASS - timeout budget is shared, not multiplied"
         : ">>> FAIL - timeout multiplied (each step took the full budget)");
 }
+
+// ---------------------------------------------------------------------------
+// Repro for GitHub #549 - AddLocatorHandlerAsync throws under Humanize=true.
+// HumanizedLocator (from page.GetByText) is not Playwright's concrete Locator,
+// so Playwright's internal `(locator as Locator)._frame` -> null -> NRE.
+// Runs the reporter's exact flow with Humanize=true (expected: throw) and a
+// Humanize=false control (expected: pass).  dotnet run -- repro549
+// ---------------------------------------------------------------------------
+static async Task Repro549()
+{
+    await RunAddLocatorHandler(humanize: true);
+    await RunAddLocatorHandler(humanize: false);
+}
+
+static async Task RunAddLocatorHandler(bool humanize)
+{
+    Console.WriteLine($"\n=== AddLocatorHandlerAsync with Humanize={humanize} ===");
+    await using var browser = await CloakLauncher.LaunchAsync(new LaunchOptions
+    {
+        Headless = true,
+        Humanize = humanize,
+    });
+    var page = await browser.NewPageAsync();
+    await page.GotoAsync("https://example.com/");
+
+    var locator = page.GetByText("Test");
+    Console.WriteLine($"page:    {page.GetType().FullName}");
+    Console.WriteLine($"locator: {locator.GetType().FullName}");
+
+    try
+    {
+        // Reporter's exact snippet (Func<Task> overload + NoWaitAfter).
+        await page.AddLocatorHandlerAsync(page.GetByText("Test"), () =>
+        {
+            Console.WriteLine("test");
+            return Task.CompletedTask;
+        }, new PageAddLocatorHandlerOptions() { NoWaitAfter = true });
+        Console.WriteLine(">>> OK - handler registered, no exception");
+    }
+    catch (Exception ex)
+    {
+        Console.WriteLine($">>> THREW: {ex.GetType().FullName}: {ex.Message}");
+        Console.WriteLine(ex.StackTrace?.Split('\n').FirstOrDefault()?.Trim());
+    }
+}
```

**File**: `dotnet/src/CloakBrowser/Handles.cs` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ public static object Unwrap(object handle)
                 case IGuardedProxy g: current = g.GuardTarget; break;
                 case HumanizedPage p: current = p.Original; break;
                 case HumanizedFrame f: current = f.Original; break;
+                case HumanizedLocator l: current = l.Original; break;
                 case HumanizedElementHandle e: current = e.Original; break;
                 case HumanizedBrowserContext c: current = c.Original; break;
                 case HumanizedBrowser b: current = b.Original; break;
```

**File**: `dotnet/src/CloakBrowser/Wrappers/Humanize.cs` (modified, +4/-0)
```diff
@@ -76,6 +76,10 @@ public static IBrowser Browser(
     /// <summary>Recover the raw Playwright <see cref="IElementHandle"/> behind any CloakBrowser wrapper.</summary>
     public static IElementHandle Unwrap(IElementHandle handle) => (IElementHandle)LicenseGuard.Unwrap(handle);
 
+    /// <summary>Recover the raw Playwright <see cref="ILocator"/> behind a CloakBrowser wrapper
+    /// (for APIs that down-cast their locator arg, e.g. <c>page.AddLocatorHandlerAsync</c>).</summary>
+    public static ILocator Unwrap(ILocator locator) => (ILocator)LicenseGuard.Unwrap(locator);
+
     // -----------------------------------------------------------------------
     // Internal re-wrap helpers (shared by the wrappers).
     // -----------------------------------------------------------------------
```

**File**: `dotnet/src/CloakBrowser/Wrappers/HumanizedElementHandle.cs` (modified, +9/-0)
```diff
@@ -141,6 +141,15 @@ public async Task SetCheckedAsync(bool checkedState, ElementHandleSetCheckedOpti
     // -----------------------------------------------------------------------
 
     private static IElementHandle Unwrap(IElementHandle h) => h is HumanizedElementHandle w ? w.Original : h;
+    private static ILocator Unwrap(ILocator l) => l is HumanizedLocator w ? w.Original : l;
+
+    // #549: unwrap masked locators in place (rebuilding options would drop future fields).
+    public Task<byte[]> ScreenshotAsync(ElementHandleScreenshotOptions? options = null)
+    {
+        if (options?.Mask != null)
+            options.Mask = options.Mask.Select(Unwrap).ToList();
+        return _inner.ScreenshotAsync(options);
+    }
 
     private async Task SelectPrologueAsync(ElementHandleSelectOptionOptions? options)
     {
```

**File**: `dotnet/src/CloakBrowser/Wrappers/HumanizedLocator.cs` (modified, +8/-0)
```diff
@@ -222,6 +222,14 @@ public ILocator Or(ILocator locator) =>
     public ILocator And(ILocator locator) =>
         Wrap(_inner.And(locator is HumanizedLocator h ? h.Original : locator));
 
+    // #549: unwrap Has/HasNot in place (rebuilding options would drop future fields).
+    public ILocator Filter(LocatorFilterOptions? options = null)
+    {
+        if (options?.Has is HumanizedLocator has) options.Has = has.Original;
+        if (options?.HasNot is HumanizedLocator hasNot) options.HasNot = hasNot.Original;
+        return Wrap(_inner.Filter(options));
+    }
+
     public ILocator Locator(string selectorOrLocator, LocatorLocatorOptions? options = null) =>
         Wrap(_inner.Locator(selectorOrLocator, options));
     public ILocator Locator(ILocator selectorOrLocator, LocatorLocatorOptions? options = null) =>
```

**File**: `dotnet/src/CloakBrowser/Wrappers/HumanizedPage.cs` (modified, +20/-0)
```diff
@@ -181,6 +181,26 @@ public async Task<IReadOnlyList<string>> SelectOptionAsync(string selector, IEnu
     }
 
     private static IElementHandle Unwrap(IElementHandle h) => h is HumanizedElementHandle hh ? hh.Original : h;
+    private static ILocator Unwrap(ILocator l) => l is HumanizedLocator hl ? hl.Original : l;
+
+    // #549: Playwright down-casts ILocator args to concrete Locator; unwrap ours first.
+    public Task AddLocatorHandlerAsync(ILocator locator, Func<Task> handler, PageAddLocatorHandlerOptions? options = null) =>
+        _inner.AddLocatorHandlerAsync(Unwrap(locator), handler, options);
+
+    // Re-wrap the callback locator so the user's handler stays humanized.
+    public Task AddLocatorHandlerAsync(ILocator locator, Func<ILocator, Task> handler, PageAddLocatorHandlerOptions? options = null) =>
+        _inner.AddLocatorHandlerAsync(Unwrap(locator), l => handler(Wrap(l)), options);
+
+    public Task RemoveLocatorHandlerAsync(ILocator locator) =>
+        _inner.RemoveLocatorHandlerAsync(Unwrap(locator));
+
+    // #549: unwrap masked locators in place (rebuilding options would drop future fields).
+    public Task<byte[]> ScreenshotAsync(PageScreenshotOptions? options = null)
+    {
+        if (options?.Mask != null)
+            options.Mask = options.Mask.Select(Unwrap).ToList();
+        return _inner.ScreenshotAsync(options);
+    }
 
     // -----------------------------------------------------------------------
     // Locator-returning members - re-wrap.
```

**File**: `dotnet/tests/CloakBrowser.Tests/Wrappers/LocatorWrapperTests.cs` (modified, +26/-0)
```diff
@@ -392,4 +392,30 @@ public async Task Cancellation_propagates_as_OperationCanceled()
 
         await Assert.ThrowsAsync<OperationCanceledException>(() => human.ClickAsync());
     }
+
+    // #549: Filter's Has/HasNot must reach Playwright unwrapped.
+    [Fact]
+    public void Filter_unwraps_Has_and_HasNot_and_rewraps_result()
+    {
+        var (page, _, _) = BuildPage();
+        var (inner, innerRec) = Fake.Of<ILocator>();
+        var (resultLoc, _) = Fake.Of<ILocator>();
+        innerRec.On("Filter", resultLoc);
+
+        var cursor = new HumanCursor(page);
+        var (rawHas, _) = Fake.Of<ILocator>();
+        var (rawHasNot, _) = Fake.Of<ILocator>();
+        var human = new HumanizedLocator(inner, cursor, FastConfig());
+
+        var result = human.Filter(new LocatorFilterOptions
+        {
+            Has = new HumanizedLocator(rawHas, cursor, FastConfig()),
+            HasNot = new HumanizedLocator(rawHasNot, cursor, FastConfig()),
+        });
+
+        var opts = (LocatorFilterOptions)innerRec.Last("Filter")!.Args[0]!;
+        Assert.Same(rawHas, opts.Has);            // raw locator reached Playwright
+        Assert.Same(rawHasNot, opts.HasNot);
+        Assert.IsType<HumanizedLocator>(result);  // returned locator stays humanized
+    }
 }
```

**File**: `dotnet/tests/CloakBrowser.Tests/Wrappers/PageWrapperTests.cs` (modified, +65/-0)
```diff
@@ -333,4 +333,69 @@ public async Task Delegated_member_exception_propagates()
 
         await Assert.ThrowsAsync<PlaywrightException>(() => human.ContentAsync());
     }
+
+    // #549: locator-arg APIs must hand Playwright the raw locator, not our decorator.
+    private static (HumanizedPage human, FakeProxy pageRec) BuildBarePage()
+    {
+        var (mouse, _) = Fake.Of<IMouse>();
+        var (keyboard, _) = Fake.Of<IKeyboard>();
+        var (page, pageRec) = Fake.Of<IPage>();
+        pageRec.On("Mouse", mouse);
+        pageRec.On("Keyboard", keyboard);
+        return (new HumanizedPage(page, new HumanCursor(page), FastConfig()), pageRec);
+    }
+
+    private static HumanizedLocator WrapRaw(ILocator raw)
+    {
+        var (page, _) = Fake.Of<IPage>();
+        return new HumanizedLocator(raw, new HumanCursor(page), FastConfig());
+    }
+
+    [Fact]
+    public async Task AddAndRemoveLocatorHandler_unwrap_locator_arg()
+    {
+        var (human, pageRec) = BuildBarePage();
+        var (rawLoc, _) = Fake.Of<ILocator>();
+        var arg = WrapRaw(rawLoc);
+
+        await human.AddLocatorHandlerAsync(arg, () => Task.CompletedTask);
+        Assert.Same(rawLoc, pageRec.Last("AddLocatorHandlerAsync")!.Args[0]);
+
+        await human.RemoveLocatorHandlerAsync(arg);
+        Assert.Same(rawLoc, pageRec.Last("RemoveLocatorHandlerAsync")!.Args[0]);
+    }
+
+    [Fact]
+    public async Task AddLocatorHandler_rewraps_callback_locator()
+    {
+        var (mouse, _) = Fake.Of<IMouse>();
+        var (keyboard, _) = Fake.Of<IKeyboard>();
+        var (page, pageRec) = Fake.Of<IPage>();
+        pageRec.On("Mouse", mouse);
+        pageRec.On("Keyboard", keyboard);
+        var (rawCallbackLoc, _) = Fake.Of<ILocator>();
+        // Fake Playwright fires the registered handler with a raw matched locator.
+        pageRec.On("AddLocatorHandlerAsync", args => ((Func<ILocator, Task>)args[1]!)(rawCallbackLoc));
+        var human = new HumanizedPage(page, new HumanCursor(page), FastConfig());
+
+        var (rawLoc, _) = Fake.Of<ILocator>();
+        ILocator? received = null;
+        await human.AddLocatorHandlerAsync(WrapRaw(rawLoc), loc => { received = loc; return Task.CompletedTask; });
+
+        Assert.Same(rawLoc, pageRec.Last("AddLocatorHandlerAsync")!.Args[0]); // input unwrapped
+        Assert.IsType<HumanizedLocator>(received);                            // callback re-wrapped
+    }
+
+    [Fact]
+    public async Task Screenshot_unwraps_masked_locators()
+    {
+        var (human, pageRec) = BuildBarePage();
+        pageRec.On("ScreenshotAsync", Task.FromResult(System.Array.Empty<byte>()));
+        var (rawLoc, _) = Fake.Of<ILocator>();
+
+        await human.ScreenshotAsync(new PageScreenshotOptions { Mask = new[] { WrapRaw(rawLoc) } });
+
+        var opts = (PageScreenshotOptions)pageRec.Last("ScreenshotAsync")!.Args[0]!;
+        Assert.Same(rawLoc, opts.Mask!.First());
+    }
 }
```

---

### Incident Patch 9: `f04c23da` (2026-08-30)
**Commit Message**: release: v0.5.10 — Windows console banner + geoip/license launch-abort fixes

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -6,8 +6,10 @@ Changes are tagged: **[wrapper]** for Python/JS wrapper, **[binary]** for Chromi
 
 ---
 
-## [Unreleased]
+## [0.5.10] — 2026-08-30
 
+- **[wrapper]** The first-launch welcome banner no longer aborts a launch on a legacy Windows console. On a non-UTF-8 (cp1252) console its arrow and dash characters raised `UnicodeEncodeError` on the binary-download path, which blocked license apply and profile launch (notably in CloakBrowser Manager). The banner is now ASCII and every write is guarded, so a cosmetic message can never stop a launch. Python, JavaScript, and .NET.
+- **[wrapper]** A requested GeoIP resolution that fails now aborts the launch instead of silently continuing on the container clock. Failure means the lookup times out, the database cannot be loaded, the lookup cannot complete, or timezone or locale stay unresolved; the default resolution timeout is raised from 5 to 20 seconds. Explicit timezone and locale overrides remain valid without an egress-IP result. Python, JavaScript, and .NET.
 - **[wrapper]** A license key the server rejects (invalid or expired), or one that cannot be validated at all (license server unreachable with no cached result), now raises a clear error instead of silently downloading the older free binary. Passing no key still uses the free binary as before. Python, JavaScript, and .NET.
 
 ---
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -150,10 +150,10 @@ page.goto("https://example.com")
 
 ---
 
-## Latest: v0.5.9 — 73 source-level stealth patches (Chromium 151.0.7922.108.2 — Linux + Windows)
+## Latest: v0.5.10 — 73 source-level stealth patches (Chromium 151.0.7922.108.3)
 
-- **CloakBrowser Pro Stable** — Chromium `151.0.7922.108.2` on Linux x64, Linux ARM64, and Windows x64; macOS remains on `150.0.7871.114.3`. Set a `license_key` (`licenseKey` in JS) or the `CLOAKBROWSER_LICENSE_KEY` env var and the wrapper fetches the latest Stable build for your platform automatically. See [CloakBrowser Pro](#cloakbrowser-pro)
-- **CloakBrowser Pro Preview** — Chromium `151.0.7922.108.3` on Linux x64, Linux ARM64, Windows x64, and macOS. Opt in with `release_channel="preview"` or `CLOAKBROWSER_RELEASE_CHANNEL=preview`.
+- **CloakBrowser Pro Stable** — Chromium `151.0.7922.108.3` on Linux x64, Linux ARM64, Windows x64, and macOS. Set a `license_key` (`licenseKey` in JS) or the `CLOAKBROWSER_LICENSE_KEY` env var and the wrapper fetches the latest Stable build for your platform automatically. See [CloakBrowser Pro](#cloakbrowser-pro)
+- **CloakBrowser Pro Preview** — Chromium `151.0.7922.108.4` on Linux x64 and Linux ARM64; Windows x64 and macOS track `151.0.7922.108.3`. Opt in with `release_channel="preview"` or `CLOAKBROWSER_RELEASE_CHANNEL=preview`.
 - **.NET 8 / C# client** — CloakBrowser now ships as a NuGet package (`CloakBrowser`), mirroring the Python and JS wrappers.
 - **Chromium 151 upgrade** — rebased the full patch set onto Chromium 151 (Linux + Windows), re-validated against reference data; macOS remains on the Chromium 150 Stable line
 - **73 fingerprint patches** — rendering consistency improvements across Linux and Windows, corrected GPU/display/graphics parameters to match stock Chrome profiles
```

**File**: `cloakbrowser/_version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-__version__ = "0.5.9"
+__version__ = "0.5.10"
```

**File**: `dotnet/src/CloakBrowser/CloakBrowser.csproj` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 
     <!-- NuGet packaging metadata -->
     <PackageId>CloakBrowser</PackageId>
-    <Version>0.5.9</Version>
+    <Version>0.5.10</Version>
     <Authors>CloakHQ</Authors>
     <Description>Stealth Chromium that passes every bot detection test. Drop-in Playwright (.NET) replacement with source-level fingerprint patches.</Description>
     <PackageLicenseExpression>MIT</PackageLicenseExpression>
```

**File**: `dotnet/src/CloakBrowser/CloakVersion.cs` (modified, +1/-1)
```diff
@@ -4,5 +4,5 @@ namespace CloakBrowser;
 public static class CloakVersion
 {
     /// <summary>The CloakBrowser .NET wrapper version.</summary>
-    public const string Version = "0.5.9";
+    public const string Version = "0.5.10";
 }
```

**File**: `js/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "cloakbrowser",
-  "version": "0.5.9",
+  "version": "0.5.10",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "cloakbrowser",
-      "version": "0.5.9",
+      "version": "0.5.10",
       "license": "MIT",
       "dependencies": {
         "tar": "^7.0.0"
```

**File**: `js/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "cloakbrowser",
-  "version": "0.5.9",
+  "version": "0.5.10",
   "description": "Stealth Chromium that passes every bot detection test. Drop-in Playwright/Puppeteer replacement with source-level fingerprint patches.",
   "type": "module",
   "main": "dist/index.js",
```

---

### Incident Patch 10: `bb6f2f00` (2026-08-28)
**Commit Message**: fix(wrapper): ASCII-safe welcome banner for legacy Windows consoles

The banner wrote '->' and em dashes straight to stderr. On a cp1252/strict
console (UK/EU-locale Windows) that raised UnicodeEncodeError and aborted the
binary-download path, blocking license apply and profile launch in the Manager.

Swap the banner glyphs to ASCII and route the writes through a swallow-all
helper so a cosmetic banner can never abort a launch. Same treatment in the JS
and .NET wrappers plus the Windows-font warning. Regression tests added across
all three (ASCII-only + cp1252-no-crash).

**File**: `cloakbrowser/browser.py` (modified, +12/-7)
```diff
@@ -1586,13 +1586,18 @@ def _maybe_warn_windows_fonts(chrome_args: list[str]) -> None:
         if present is None or present:
             return  # full set present, or can't determine — don't warn
         # Write straight to stderr (like the welcome banner and the JS/.NET
-        # wrappers) so an app's logging config can't silence it.
-        sys.stderr.write(
-            "[cloakbrowser] Incomplete Windows font set — installing the full "
-            "set is strongly advised for best results when spoofing Windows on "
-            "Linux. https://github.com/CloakHQ/cloakbrowser#font-setup-on-linux "
-            "(silence: CLOAKBROWSER_SUPPRESS_FONT_WARNING=1)\n"
-        )
+        # wrappers) so an app's logging config can't silence it. ASCII-only and
+        # swallow-everything: on a legacy Windows console stderr is cp1252/strict
+        # and this write is on the launch path (ticket 2354).
+        try:
+            sys.stderr.write(
+                "[cloakbrowser] Incomplete Windows font set - installing the full "
+                "set is strongly advised for best results when spoofing Windows on "
+                "Linux. https://github.com/CloakHQ/cloakbrowser#font-setup-on-linux "
+                "(silence: CLOAKBROWSER_SUPPRESS_FONT_WARNING=1)\n"
+            )
+        except Exception:
+            pass
         try:
             marker.parent.mkdir(parents=True, exist_ok=True)
             marker.write_text("")
```

**File**: `cloakbrowser/download.py` (modified, +35/-17)
```diff
@@ -113,6 +113,20 @@ def _warn_preview_fallback() -> None:
     )
 
 
+def _emit(text: str) -> None:
+    """Write a cosmetic line to stderr, swallowing any error.
+
+    On a legacy Windows console sys.stderr is cp1252/strict; an unencodable
+    glyph raises UnicodeEncodeError. Because the welcome banner runs on the
+    binary-download path, that would abort the whole launch (ticket 2354).
+    A banner is decoration - never let it propagate.
+    """
+    try:
+        sys.stderr.write(text)
+    except Exception:
+        pass
+
+
 def _show_welcome(tier: str = "keyless") -> None:
     """Show welcome message on launch. A marker file gates the cadence: a paid
     (Pro) key shows once ever; free (keyless or a free GitHub key) re-shows every
@@ -126,36 +140,40 @@ def _show_welcome(tier: str = "keyless") -> None:
     marker = get_cache_dir() / ".welcome_shown"
     if not _welcome_due(marker, pro=(tier == "pro")):
         return
-    sys.stderr.write("\n")
-    sys.stderr.write("  CloakBrowser — stealth Chromium for automation\n")
-    sys.stderr.write("  https://github.com/CloakHQ/CloakBrowser\n")
-    sys.stderr.write("\n")
+    # ASCII-only banner + a swallow-everything writer: on a legacy Windows
+    # console sys.stderr is cp1252/strict, so a non-ASCII glyph (or any IO
+    # error) here would raise and abort the whole binary-download path. A
+    # cosmetic banner must never be able to kill a launch.
+    _emit("\n")
+    _emit("  CloakBrowser - stealth Chromium for automation\n")
+    _emit("  https://github.com/CloakHQ/CloakBrowser\n")
+    _emit("\n")
     if tier == "pro":
-        sys.stderr.write(
-            f"  CloakBrowser Pro active (v{PRO_MAJOR}) — latest binary, newest patches.\n"
+        _emit(
+            f"  CloakBrowser Pro active (v{PRO_MAJOR}) - latest binary, newest patches.\n"
         )
-        sys.stderr.write("  Pro support → support@cloakbrowser.dev\n")
+        _emit("  Pro support -> support@cloakbrowser.dev\n")
     elif tier == "free":
-        sys.stderr.write(
+        _emit(
             f"  CloakBrowser free (v{PRO_MAJOR}): the latest binary, 1 concurrent session.\n"
         )
-        sys.stderr.write(
-            "  For more than one concurrent session → https://cloakbrowser.dev\n"
+        _emit(
+            "  For more than one concurrent session -> https://cloakbrowser.dev\n"
         )
     else:
         free_major = CHROMIUM_VERSION.split(".")[0]
-        sys.stderr.write(
+        _emit(
             f"  Running the free binary (v{free_major}). "
             f"The latest binary (v{PRO_MAJOR}) is free too, with 1 concurrent session.\n"
         )
-        sys.stderr.write(
+        _emit(
             "  Get your key: run  cloakbrowser login  or visit https://cloakbrowser.dev/free\n"
         )
-        sys.stderr.write(
-            "  For more than one concurrent session → https://cloakbrowser.dev\n"
+        _emit(
+            "  For more than one concurrent session -> https://cloakbrowser.dev\n"
         )
-    sys.stderr.write("  Star us if CloakBrowser helps your project!\n")
-    sys.stderr.write("\n")
+    _emit("  Star us if CloakBrowser helps your project!\n")
+    _emit("\n")
     try:
         marker.parent.mkdir(parents=True, exist_ok=True)
         marker.write_text(str(int(time.time())))
@@ -1222,7 +1240,7 @@ def _check_wrapper_update() -> None:
         latest = resp.json()["info"]["version"]
         if _version_newer(latest, _wrapper_version):
             logger.warning(
-                "Update available: cloakbrowser %s → %s. "
+                "Update available: cloakbrowser %s -> %s. "
                 "Run: pip install --upgrade cloakbrowser",
                 _wrapper_version,
                 latest,
```

**File**: `dotnet/src/CloakBrowser/CloakLauncher.cs` (modified, +1/-1)
```diff
@@ -568,7 +568,7 @@ internal static void MaybeWarnWindowsFonts(IReadOnlyList<string> chromeArgs)
             var present = WindowsFontsPresent();
             if (present != false) return; // true (full set) or null (undeterminable)
             CloakLog.Warning(
-                "[cloakbrowser] Incomplete Windows font set — installing the full " +
+                "[cloakbrowser] Incomplete Windows font set - installing the full " +
                 "set is strongly advised for best results when spoofing Windows on " +
                 "Linux. https://github.com/CloakHQ/cloakbrowser#font-setup-on-linux " +
                 "(silence: CLOAKBROWSER_SUPPRESS_FONT_WARNING=1)");
```

**File**: `dotnet/src/CloakBrowser/Download.cs` (modified, +9/-6)
```diff
@@ -134,33 +134,36 @@ private static void WarnPreviewFallback()
     ///   "free"    — a free GitHub key (latest binary, one concurrent session)
     ///   "keyless" — no key, running the older free binary (invite the free login)
     /// </summary>
-    private static void ShowWelcome(string tier = "keyless")
+    internal static void ShowWelcome(string tier = "keyless")
     {
         var marker = Path.Combine(Config.GetCacheDir(), ".welcome_shown");
         if (!WelcomeDue(marker, tier == "pro")) return;
 
+        // ASCII-only banner: on a legacy Windows console a non-ASCII glyph can
+        // crash or mojibake the write, and this runs on the binary-download
+        // path (ticket 2354). Keep the three wrappers byte-parallel.
         var sb = new System.Text.StringBuilder();
         sb.Append('\n');
-        sb.Append("  CloakBrowser — stealth Chromium for automation\n");
+        sb.Append("  CloakBrowser - stealth Chromium for automation\n");
         sb.Append("  https://github.com/CloakHQ/CloakBrowser\n");
         sb.Append('\n');
         if (tier == "pro")
         {
-            sb.Append($"  CloakBrowser Pro active (v{ProMajor}) — latest binary, newest patches.\n");
-            sb.Append("  Pro support → support@cloakbrowser.dev\n");
+            sb.Append($"  CloakBrowser Pro active (v{ProMajor}) - latest binary, newest patches.\n");
+            sb.Append("  Pro support -> support@cloakbrowser.dev\n");
         }
         else if (tier == "free")
         {
             sb.Append($"  CloakBrowser free (v{ProMajor}): the latest binary, 1 concurrent session.\n");
-            sb.Append("  For more than one concurrent session → https://cloakbrowser.dev\n");
+            sb.Append("  For more than one concurrent session -> https://cloakbrowser.dev\n");
         }
         else
         {
             var freeMajor = Config.GetChromiumVersion().Split('.')[0];
             sb.Append($"  Running the free binary (v{freeMajor}). " +
                       $"The latest binary (v{ProMajor}) is free too, with 1 concurrent session.\n");
             sb.Append("  Get your key: run  cloakbrowser login  or visit https://cloakbrowser.dev/free\n");
-            sb.Append("  For more than one concurrent session → https://cloakbrowser.dev\n");
+            sb.Append("  For more than one concurrent session -> https://cloakbrowser.dev\n");
         }
         sb.Append("  Star us if CloakBrowser helps your project!\n");
         sb.Append('\n');
```

**File**: `dotnet/tests/CloakBrowser.Tests/FontWarningTests.cs` (modified, +39/-0)
```diff
@@ -58,6 +58,45 @@ public void Legacy_empty_marker_free_reshows_pro_silent()
     }
 }
 
+/// <summary>
+/// The welcome banner runs on the binary-download path. On a legacy Windows
+/// console a non-ASCII glyph can crash or mojibake the write (ticket 2354), so
+/// the banner must be pure ASCII. Mirrors the Python/JS welcome tests.
+/// Serialized: mutates CLOAKBROWSER_CACHE_DIR and Console.Error.
+/// </summary>
+[Collection("env-serial")]
+public class WelcomeBannerAsciiTests
+{
+    [Theory]
+    [InlineData("keyless")]
+    [InlineData("free")]
+    [InlineData("pro")]
+    public void Banner_is_ascii_only(string tier)
+    {
+        var prev = Environment.GetEnvironmentVariable("CLOAKBROWSER_CACHE_DIR");
+        var tmp = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
+        Directory.CreateDirectory(tmp);
+        var origErr = Console.Error;
+        var buf = new StringWriter();
+        try
+        {
+            Environment.SetEnvironmentVariable("CLOAKBROWSER_CACHE_DIR", tmp);
+            Console.SetError(buf);
+            Download.ShowWelcome(tier); // marker absent -> shows
+            var outText = buf.ToString();
+            Assert.NotEqual("", outText);
+            foreach (var c in outText)
+                Assert.True(c <= 0x7F, $"non-ASCII U+{(int)c:X4} in {tier} banner");
+        }
+        finally
+        {
+            Console.SetError(origErr);
+            Environment.SetEnvironmentVariable("CLOAKBROWSER_CACHE_DIR", prev);
+            try { Directory.Delete(tmp, recursive: true); } catch { /* best-effort */ }
+        }
+    }
+}
+
 /// <summary>
 /// Linux Windows-font mismatch warning. Platform detection and fc-list aren't
 /// mockable without a DI refactor, so these cover the deterministic paths: the
```

**File**: `js/src/download.ts` (modified, +11/-7)
```diff
@@ -355,24 +355,28 @@ function warnPreviewFallback(): void {
   );
 }
 
-function showWelcome(tier = "keyless"): void {
+// Exported for tests only; not re-exported from the package index.
+export function showWelcome(tier = "keyless"): void {
   const marker = path.join(getCacheDir(), ".welcome_shown");
   if (!welcomeDue(marker, tier === "pro")) return;
+  // ASCII-only banner: on a legacy Windows console a non-ASCII glyph can
+  // crash or mojibake the write, and this runs on the binary-download path
+  // (ticket 2354). Keep the three wrappers byte-parallel.
   console.error();
-  console.error("  CloakBrowser — stealth Chromium for automation");
+  console.error("  CloakBrowser - stealth Chromium for automation");
   console.error("  https://github.com/CloakHQ/CloakBrowser");
   console.error();
   if (tier === "pro") {
     console.error(
-      `  CloakBrowser Pro active (v${PRO_MAJOR}) — latest binary, newest patches.`,
+      `  CloakBrowser Pro active (v${PRO_MAJOR}) - latest binary, newest patches.`,
     );
-    console.error("  Pro support → support@cloakbrowser.dev");
+    console.error("  Pro support -> support@cloakbrowser.dev");
   } else if (tier === "free") {
     console.error(
       `  CloakBrowser free (v${PRO_MAJOR}): the latest binary, 1 concurrent session.`,
     );
     console.error(
-      "  For more than one concurrent session → https://cloakbrowser.dev",
+      "  For more than one concurrent session -> https://cloakbrowser.dev",
     );
   } else {
     const freeMajor = CHROMIUM_VERSION.split(".")[0];
@@ -384,7 +388,7 @@ function showWelcome(tier = "keyless"): void {
       "  Get your key: run  cloakbrowser login  or visit https://cloakbrowser.dev/free",
     );
     console.error(
-      "  For more than one concurrent session → https://cloakbrowser.dev",
+      "  For more than one concurrent session -> https://cloakbrowser.dev",
     );
   }
   console.error("  Star us if CloakBrowser helps your project!");
@@ -1218,7 +1222,7 @@ export async function checkWrapperUpdate(): Promise<void> {
     const data = (await resp.json()) as { version: string };
     if (data.version && versionNewer(data.version, WRAPPER_VERSION)) {
       console.warn(
-        `[cloakbrowser] Update available: ${WRAPPER_VERSION} → ${data.version}. ` +
+        `[cloakbrowser] Update available: ${WRAPPER_VERSION} -> ${data.version}. ` +
         `Run: npm install cloakbrowser@latest`
       );
     }
```

**File**: `js/src/geoip.ts` (modified, +1/-1)
```diff
@@ -221,7 +221,7 @@ async function resolveExitIp(proxyUrl: string | null | undefined, timeoutMs?: nu
     try {
       ({ SocksProxyAgent } = await import("socks-proxy-agent"));
     } catch {
-      console.warn("[cloakbrowser] socks-proxy-agent not installed — cannot resolve exit IP through SOCKS5 proxy. Install it: npm install socks-proxy-agent");
+      console.warn("[cloakbrowser] socks-proxy-agent not installed - cannot resolve exit IP through SOCKS5 proxy. Install it: npm install socks-proxy-agent");
       return null;
     }
     const { default: https } = await import("node:https");
```

**File**: `js/tests/welcome.test.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
+import * as fs from "node:fs";
+import * as os from "node:os";
+import * as path from "node:path";
+import { showWelcome } from "../src/download.js";
+
+// The welcome banner runs on the binary-download path. On a legacy Windows
+// console a non-ASCII glyph can crash or mojibake the write (ticket 2354), so
+// the banner must be pure ASCII. Mirrors the Python test_welcome_banner suite.
+describe("welcome banner", () => {
+  let cacheDir: string;
+  let prevCache: string | undefined;
+  let errSpy: ReturnType<typeof vi.spyOn>;
+
+  beforeEach(() => {
+    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cb-welcome-"));
+    prevCache = process.env.CLOAKBROWSER_CACHE_DIR;
+    process.env.CLOAKBROWSER_CACHE_DIR = cacheDir;
+    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
+  });
+
+  afterEach(() => {
+    errSpy.mockRestore();
+    if (prevCache === undefined) delete process.env.CLOAKBROWSER_CACHE_DIR;
+    else process.env.CLOAKBROWSER_CACHE_DIR = prevCache;
+    fs.rmSync(cacheDir, { recursive: true, force: true });
+  });
+
+  for (const tier of ["keyless", "free", "pro"]) {
+    it(`${tier} banner is ASCII-only`, () => {
+      showWelcome(tier);
+      const out = errSpy.mock.calls.map((c) => String(c[0] ?? "")).join("\n");
+      expect(out).not.toBe("");
+      // eslint-disable-next-line no-control-regex
+      expect(out).toMatch(/^[\x00-\x7F]*$/);
+    });
+  }
+});
```

---

### Incident Patch 11: `d6bad5de` (2026-08-28)
**Commit Message**: fix(geoip): abort launch when resolution fails

Increase the default GeoIP resolution timeout from 5 to 20 seconds across the Python, JavaScript, and .NET wrappers.

Fail the launch when requested GeoIP resolution times out, cannot load its database, cannot complete a lookup, or leaves timezone or locale unresolved. Explicit timezone and locale overrides remain valid without an egress-IP result.

Add parity coverage for the new timeout and failure behavior.

**File**: `cloakbrowser/browser.py` (modified, +5/-0)
```diff
@@ -1327,6 +1327,11 @@ def maybe_resolve_geoip(
         timezone = geo_tz
     if locale is None:
         locale = geo_locale
+    missing = [name for name, value in (("timezone", timezone), ("locale", locale)) if value is None]
+    if missing:
+        raise RuntimeError(
+            "GeoIP resolution failed: could not determine " + " and ".join(missing)
+        )
     return timezone, locale, exit_ip
 
 
```

**File**: `cloakbrowser/geoip.py` (modified, +8/-10)
```diff
@@ -29,7 +29,7 @@
 )
 GEOIP_DB_FILENAME = "GeoLite2-City.mmdb"
 GEOIP_UPDATE_INTERVAL = 30 * 86_400  # 30 days
-DEFAULT_GEOIP_TIMEOUT_SECONDS = 5.0
+DEFAULT_GEOIP_TIMEOUT_SECONDS = 20.0
 GEOIP_TIMEOUT_ENV = "CLOAKBROWSER_GEOIP_TIMEOUT_SECONDS"
 
 # Serializes GeoIP DB downloads within a process so N concurrent launches
@@ -80,8 +80,8 @@
 def resolve_proxy_geo(proxy_url: str | None) -> tuple[str | None, str | None]:
     """Resolve timezone and locale from a proxy's IP address.
 
-    Returns ``(timezone, locale)`` — either or both may be ``None`` on
-    failure (missing dep, DB download error, lookup miss).  Never raises.
+    Returns ``(timezone, locale)``. Raises when the exit IP, database, or
+    database lookup cannot be resolved.
 
     When *proxy_url* is falsy, the machine's own public IP is used instead
     (direct HTTP to the echo services, no proxy).
@@ -127,12 +127,11 @@ def resolve_proxy_geo_with_ip(
         ip = _resolve_proxy_ip(proxy_url)
     if ip is None or _deadline_expired(deadline):
         if deadline is not None and _deadline_expired(deadline):
-            logger.warning("GeoIP resolution timed out after %.1fs; continuing without GeoIP", timeout)
-        return None, None, None
+            raise RuntimeError(f"GeoIP resolution timed out after {timeout:.1f}s")
+        raise RuntimeError("GeoIP resolution failed: could not discover the egress IP")
 
-    # DB only drives tz/locale; a missing/failed DB still returns the exit IP.
     if db_path is None:
-        return None, None, ip
+        raise RuntimeError("GeoIP resolution failed: GeoIP database is unavailable")
 
     try:
         with geoip2.database.Reader(str(db_path)) as reader:
@@ -146,8 +145,7 @@ def resolve_proxy_geo_with_ip(
             )
             return timezone, locale, ip
     except Exception as exc:
-        logger.warning("GeoIP lookup failed for %s: %s", ip, exc)
-        return None, None, ip
+        raise RuntimeError(f"GeoIP lookup failed for {ip}: {exc}") from exc
 
 
 # ---------------------------------------------------------------------------
@@ -247,7 +245,7 @@ def resolve_proxy_exit_ip(proxy_url: str | None) -> str | None:
     deadline = _deadline_from_timeout(timeout)
     ip = _resolve_exit_ip(proxy_url, timeout=timeout)
     if ip is None and _deadline_expired(deadline):
-        logger.warning("GeoIP resolution timed out after %.1fs; continuing without GeoIP", timeout)
+        logger.warning("Proxy exit-IP resolution timed out after %.1fs", timeout)
     return ip
 
 
```

**File**: `dotnet/src/CloakBrowser/CloakLauncher.cs` (modified, +9/-1)
```diff
@@ -287,7 +287,15 @@ public static async Task<CloakContextHandle> LaunchPersistentContextAsync(
         }
 
         var (geoTz, geoLocale, exitIp) = await GeoIp.ResolveProxyGeoWithIpAsync(proxyUrl).ConfigureAwait(false);
-        return (timezone ?? geoTz, locale ?? geoLocale, exitIp);
+        timezone ??= geoTz;
+        locale ??= geoLocale;
+        var missing = new List<string>();
+        if (timezone == null) missing.Add("timezone");
+        if (locale == null) missing.Add("locale");
+        if (missing.Count > 0)
+            throw new InvalidOperationException(
+                $"GeoIP resolution failed: could not determine {string.Join(" and ", missing)}");
+        return (timezone, locale, exitIp);
     }
 
     // -----------------------------------------------------------------------
```

**File**: `dotnet/src/CloakBrowser/GeoIp.cs` (modified, +7/-9)
```diff
@@ -23,7 +23,7 @@ public static class GeoIp
     // Serializes GeoIP DB downloads within the process so N concurrent launches
     // don't each fetch the same ~70 MB file (issue #458). Per-process only.
     private static readonly SemaphoreSlim GeoIpDownloadGate = new(1, 1);
-    private const double DefaultGeoIpTimeoutSeconds = 5.0;
+    private const double DefaultGeoIpTimeoutSeconds = 20.0;
     private const string GeoIpTimeoutEnv = "CLOAKBROWSER_GEOIP_TIMEOUT_SECONDS";
 
     // IP echo services - fast, no auth, return just the IP.
@@ -78,7 +78,7 @@ public static class GeoIp
 
     /// <summary>
     /// Resolve timezone and locale from a proxy's IP address.
-    /// Returns (timezone, locale) - either or both may be null on failure. Never throws.
+    /// Throws when the exit IP, database, or database lookup cannot be resolved.
     /// </summary>
     public static async Task<(string? Timezone, string? Locale)> ResolveProxyGeoAsync(
         string? proxyUrl, CancellationToken ct = default)
@@ -116,13 +116,12 @@ public static class GeoIp
         if (ip == null || DeadlineExpired(deadline))
         {
             if (deadline != null && DeadlineExpired(deadline))
-                CloakLog.Warning("GeoIP resolution timed out after {0:0.0}s; continuing without GeoIP", timeout);
-            return (null, null, null);
+                throw new InvalidOperationException($"GeoIP resolution timed out after {timeout:0.0}s");
+            throw new InvalidOperationException("GeoIP resolution failed: could not discover the egress IP");
         }
 
-        // DB only drives tz/locale; a missing/failed DB still returns the exit IP.
         if (dbPath == null)
-            return (null, null, ip);
+            throw new InvalidOperationException("GeoIP resolution failed: GeoIP database is unavailable");
 
         try
         {
@@ -136,8 +135,7 @@ public static class GeoIp
         }
         catch (Exception exc)
         {
-            CloakLog.Warning("GeoIP lookup failed for {0}: {1}", ip, exc.Message);
-            return (null, null, ip);
+            throw new InvalidOperationException($"GeoIP lookup failed for {ip}: {exc.Message}", exc);
         }
     }
 
@@ -228,7 +226,7 @@ private static double Now() =>
         var deadline = DeadlineFromTimeout(timeout);
         var ip = await ResolveExitIpAsync(proxyUrl, timeout, ct).ConfigureAwait(false);
         if (ip == null && DeadlineExpired(deadline))
-            CloakLog.Warning("GeoIP resolution timed out after {0:0.0}s; continuing without GeoIP", timeout);
+            CloakLog.Warning("Proxy exit-IP resolution timed out after {0:0.0}s", timeout);
         return ip;
     }
 
```

**File**: `dotnet/tests/CloakBrowser.Tests/MiscTests.cs` (modified, +10/-0)
```diff
@@ -29,6 +29,16 @@ public void CountryLocaleMap_HasCommonCountries()
         Assert.Equal("es-PE", GeoIp.CountryLocaleMap["PE"]);
     }
 
+    [Fact]
+    public void DefaultGeoIpTimeout_IsTwentySeconds()
+    {
+        var field = typeof(GeoIp).GetField(
+            "DefaultGeoIpTimeoutSeconds",
+            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
+        Assert.NotNull(field);
+        Assert.Equal(20.0, field.GetRawConstantValue());
+    }
+
     [Fact]
     public async Task MaybeResolveGeoIp_Disabled_ReturnsInputWithoutResolving()
     {
```

**File**: `js/src/geoip.ts` (modified, +24/-13)
```diff
@@ -22,7 +22,8 @@ const GEOIP_DB_URL =
   "https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb";
 const GEOIP_DB_FILENAME = "GeoLite2-City.mmdb";
 const GEOIP_UPDATE_INTERVAL_MS = 30 * 86_400_000; // 30 days
-const DEFAULT_GEOIP_TIMEOUT_MS = 5_000;
+/** @internal Exported for parity testing. */
+export const DEFAULT_GEOIP_TIMEOUT_MS = 20_000;
 
 /** Country ISO code → BCP 47 locale (covers ~90% of proxy traffic). */
 export const COUNTRY_LOCALE_MAP: Record<string, string> = {
@@ -72,8 +73,8 @@ export interface GeoResult {
 
 /**
  * Resolve timezone and locale from a proxy's IP address.
- * Returns `{ timezone, locale }` — either may be null on failure.
- * Never throws.
+ * Returns `{ timezone, locale }`. Throws when the exit IP, database, or
+ * database lookup cannot be resolved.
  *
  * When `proxyUrl` is falsy, the machine's own public IP is used instead
  * (echo services queried directly, no proxy), so geoip works proxy-free.
@@ -108,13 +109,14 @@ export async function resolveProxyGeo(
   if (!ip && proxyUrl && !deadlineExpired(deadline)) ip = await resolveProxyIp(proxyUrl);
   if (!ip || deadlineExpired(deadline)) {
     if (deadlineExpired(deadline)) {
-      console.warn(`[cloakbrowser] GeoIP resolution timed out after ${timeoutMs}ms; continuing without GeoIP`);
+      throw new Error(`GeoIP resolution timed out after ${timeoutMs / 1000}s`);
     }
-    return { timezone: null, locale: null, exitIp: null };
+    throw new Error("GeoIP resolution failed: could not discover the egress IP");
   }
 
-  // DB only drives tz/locale; a missing/failed DB still returns the exit IP.
-  if (!dbPath) return { timezone: null, locale: null, exitIp: ip };
+  if (!dbPath) {
+    throw new Error("GeoIP resolution failed: GeoIP database is unavailable");
+  }
 
   try {
     const buf = fs.readFileSync(dbPath);
@@ -125,8 +127,9 @@ export async function resolveProxyGeo(
     const locale =
       countryCode ? (COUNTRY_LOCALE_MAP[countryCode] ?? null) : null;
     return { timezone, locale, exitIp: ip };
-  } catch {
-    return { timezone: null, locale: null, exitIp: ip };
+  } catch (error) {
+    const detail = error instanceof Error ? error.message : String(error);
+    throw new Error(`GeoIP lookup failed for ${ip}: ${detail}`, { cause: error });
   }
 }
 
@@ -471,11 +474,19 @@ export async function maybeResolveGeoip(
   }
 
   const { timezone: geoTz, locale: geoLocale, exitIp: geoExitIp } = await resolveProxyGeo(proxyUrl);
-  const exitIp = geoExitIp ?? undefined;
+  const resolvedTimezone = timezone ?? geoTz ?? undefined;
+  const resolvedLocale = locale ?? geoLocale ?? undefined;
+  const missing = [
+    resolvedTimezone ? null : "timezone",
+    resolvedLocale ? null : "locale",
+  ].filter((value): value is string => value !== null);
+  if (missing.length > 0) {
+    throw new Error(`GeoIP resolution failed: could not determine ${missing.join(" and ")}`);
+  }
   return {
-    timezone: timezone ?? geoTz ?? undefined,
-    locale: locale ?? geoLocale ?? undefined,
-    exitIp,
+    timezone: resolvedTimezone,
+    locale: resolvedLocale,
+    exitIp: geoExitIp ?? undefined,
   };
 }
 
```

**File**: `js/tests/geoip.test.ts` (modified, +44/-4)
```diff
@@ -3,7 +3,13 @@ import fs from "node:fs";
 import http from "node:http";
 import os from "node:os";
 import path from "node:path";
-import { COUNTRY_LOCALE_MAP, maybeResolveGeoip, resolveProxyGeo, resolveProxyIp } from "../src/geoip.js";
+import {
+  COUNTRY_LOCALE_MAP,
+  DEFAULT_GEOIP_TIMEOUT_MS,
+  maybeResolveGeoip,
+  resolveProxyGeo,
+  resolveProxyIp,
+} from "../src/geoip.js";
 import Stream from "node:stream";
 
 const tempDirs: string[] = [];
@@ -53,6 +59,10 @@ describe("resolveProxyIp", () => {
 });
 
 describe("maybeResolveGeoip", () => {
+  it("uses a 20-second default timeout", () => {
+    expect(DEFAULT_GEOIP_TIMEOUT_MS).toBe(20_000);
+  });
+
   it("forwards separate HTTP proxy credentials to CONNECT requests", async () => {
     const authorizationHeaders: Array<string | undefined> = [];
     const sockets = new Set<Stream.Duplex>();
@@ -109,13 +119,42 @@ describe("maybeResolveGeoip", () => {
       }),
     } as Response);
 
-    const result = await resolveProxyGeo("http://203.0.113.10:8080");
+    await expect(resolveProxyGeo("http://203.0.113.10:8080")).rejects.toThrow(
+      "GeoIP resolution",
+    );
 
-    expect(result).toEqual({ timezone: null, locale: null, exitIp: null });
     expect(fetchSpy).toHaveBeenCalledOnce();
     expect(fetchSpy.mock.calls[0][1]).toEqual({ redirect: "follow" });
   });
 
+  it("throws when the GeoIP database is unavailable", async () => {
+    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-geoip-db-failure-"));
+    tempDirs.push(cacheDir);
+    process.env.CLOAKBROWSER_CACHE_DIR = cacheDir;
+
+    vi.spyOn(globalThis, "fetch")
+      .mockRejectedValueOnce(new Error("database unavailable"))
+      .mockResolvedValue({ ok: true, text: async () => "5.6.7.8" } as Response);
+
+    await expect(resolveProxyGeo(null)).rejects.toThrow("database is unavailable");
+  });
+
+  it("throws when the GeoIP database lookup fails", async () => {
+    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-geoip-lookup-failure-"));
+    tempDirs.push(cacheDir);
+    const geoipDir = path.join(cacheDir, "geoip");
+    fs.mkdirSync(geoipDir, { recursive: true });
+    fs.writeFileSync(path.join(geoipDir, "GeoLite2-City.mmdb"), "invalid database");
+    process.env.CLOAKBROWSER_CACHE_DIR = cacheDir;
+
+    vi.spyOn(globalThis, "fetch").mockResolvedValue({
+      ok: true,
+      text: async () => "5.6.7.8",
+    } as Response);
+
+    await expect(resolveProxyGeo(null)).rejects.toThrow("GeoIP lookup failed");
+  });
+
   it("downloads the database once under concurrent first-use launches (#458)", async () => {
     const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-geoip-concurrent-"));
     tempDirs.push(cacheDir);
@@ -144,10 +183,11 @@ describe("maybeResolveGeoip", () => {
         ),
     );
 
-    await Promise.all(
+    const results = await Promise.allSettled(
       Array.from({ length: 5 }, () => resolveProxyGeo("http://203.0.113.10:8080")),
     );
 
+    expect(results.every(result => result.status === "rejected")).toBe(true);
     // Only one launch actually fetched the shared ~70 MB file.
     expect(fetchSpy).toHaveBeenCalledOnce();
   });
```

**File**: `tests/test_geoip.py` (modified, +40/-16)
```diff
@@ -9,6 +9,7 @@
 from cloakbrowser.browser import maybe_resolve_geoip
 from cloakbrowser.geoip import (
     COUNTRY_LOCALE_MAP,
+    DEFAULT_GEOIP_TIMEOUT_SECONDS,
     _is_private_ip,
     _resolve_exit_ip,
     _resolve_proxy_ip,
@@ -72,6 +73,10 @@ def test_locale_map_values_are_bcp47():
 # ---------------------------------------------------------------------------
 
 
+def test_default_geoip_timeout_is_twenty_seconds():
+    assert DEFAULT_GEOIP_TIMEOUT_SECONDS == 20.0
+
+
 def test_resolve_geo_raises_when_geoip2_missing():
     """Should raise ImportError with install instructions when geoip2 not installed."""
     with patch.dict("sys.modules", {"geoip2": None, "geoip2.database": None}):
@@ -84,29 +89,38 @@ def test_resolve_geo_raises_when_geoip2_missing():
         reload(geoip_mod)
 
 
-def test_resolve_geo_returns_none_when_db_missing():
-    """Should return (None, None) when DB file doesn't exist."""
+def test_resolve_geo_raises_when_exit_ip_missing():
+    """Requested GeoIP must fail instead of launching without resolved values."""
     mock_geoip2 = type("module", (), {"database": type("db", (), {"Reader": None})})()
     with patch.dict("sys.modules", {"geoip2": mock_geoip2, "geoip2.database": mock_geoip2.database}):
-        with patch("cloakbrowser.geoip._ensure_geoip_db", return_value=None):
+        with patch("cloakbrowser.geoip._ensure_geoip_db", return_value=object()):
             with patch("cloakbrowser.geoip._resolve_exit_ip", return_value=None):
                 from cloakbrowser.geoip import resolve_proxy_geo
-                assert resolve_proxy_geo("http://10.50.96.5:8888") == (None, None)
-
+                with pytest.raises(RuntimeError, match="could not discover the egress IP"):
+                    resolve_proxy_geo(None)
 
-def test_resolve_geo_keeps_exit_ip_when_db_missing():
-    """DB missing but IP resolvable → still return the exit IP for WebRTC spoofing.
 
-    Resolving the egress IP does not need the GeoIP DB, so a DB download failure
-    must not drop it — otherwise WebRTC could fall back to the real IP behind a
-    proxy while the connection shows the proxy IP (a deanonymization).
-    """
+def test_resolve_geo_raises_when_db_missing():
+    """A database failure must abort requested GeoIP resolution."""
     mock_geoip2 = type("module", (), {"database": type("db", (), {"Reader": None})})()
     with patch.dict("sys.modules", {"geoip2": mock_geoip2, "geoip2.database": mock_geoip2.database}):
         with patch("cloakbrowser.geoip._ensure_geoip_db", return_value=None):
             with patch("cloakbrowser.geoip._resolve_exit_ip", return_value="9.8.7.6"):
                 from cloakbrowser.geoip import resolve_proxy_geo_with_ip
-                assert resolve_proxy_geo_with_ip("http://10.50.96.5:8888") == (None, None, "9.8.7.6")
+                with pytest.raises(RuntimeError, match="database is unavailable"):
+                    resolve_proxy_geo_with_ip("http://10.50.96.5:8888")
+
+
+def test_resolve_geo_raises_when_lookup_fails():
+    """A corrupt or unreadable database must abort requested GeoIP resolution."""
+    reader = MagicMock(side_effect=ValueError("corrupt database"))
+    mock_geoip2 = type("module", (), {"database": type("db", (), {"Reader": reader})})()
+    with patch.dict("sys.modules", {"geoip2": mock_geoip2, "geoip2.database": mock_geoip2.database}):
+        with patch("cloakbrowser.geoip._ensure_geoip_db", return_value=object()):
+            with patch("cloakbrowser.geoip._resolve_exit_ip", return_value="9.8.7.6"):
+                from cloakbrowser.geoip import resolve_proxy_geo_with_ip
+                with pytest.raises(RuntimeError, match="corrupt database"):
+                    resolve_proxy_geo_with_ip("http://10.50.96.5:8888")
 
 
 # ---------------------------------------------------------------------------
@@ -259,20 +273,30 @@ def test_maybe_resolve_param_beats_raw_flag():
     assert loc == "de-DE"
 
 
-def test_maybe_resolve_geoip_timeout_returns_existing_values(monkeypatch):
-    """A stalled proxy lookup should not block launch indefinitely."""
+def test_maybe_resolve_geoip_timeout_aborts_launch(monkeypatch):
+    """A stalled requested GeoIP lookup should fail within its timeout budget."""
     mock_geoip2 = type("module", (), {"database": type("db", (), {"Reader": None})})()
     monkeypatch.setenv("CLOAKBROWSER_GEOIP_TIMEOUT_SECONDS", "0.05")
     with patch.dict("sys.modules", {"geoip2": mock_geoip2, "geoip2.database": mock_geoip2.database}):
         with patch("cloakbrowser.geoip._ensure_geoip_db", return_value=object()):
             start = time.monotonic()
-            tz, loc, ip = maybe_resolve_geoip(True, "http://203.0.113.10:8080", None, "fr-FR")
+            with pytest.raises(RuntimeError, match="GeoIP resolution"):
+                maybe_resolve_geoip(True, "http://203.0.113.10:8080", None, "fr-FR")
             elapsed = time.monotonic() - start
 
-    assert (tz, loc, ip) == (None, "fr-FR", None)
     
```

---

### Incident Patch 12: `8fb3350d` (2026-08-26)
**Commit Message**: fix(license): abort on invalid or unvalidatable key instead of silent free fallback

A supplied license key the server rejects, or one that cannot be validated
(server unreachable, no cache), now raises instead of silently downloading the
free binary. No-key (keyless) and valid-key (Pro) paths unchanged. Python, JS,
and .NET, with mirror tests in each.

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -6,6 +6,12 @@ Changes are tagged: **[wrapper]** for Python/JS wrapper, **[binary]** for Chromi
 
 ---
 
+## [Unreleased]
+
+- **[wrapper]** A license key the server rejects (invalid or expired), or one that cannot be validated at all (license server unreachable with no cached result), now raises a clear error instead of silently downloading the older free binary. Passing no key still uses the free binary as before. Python, JavaScript, and .NET.
+
+---
+
 ## [0.5.9] — 2026-08-25
 
 - **[wrapper]** Fix `humanize=True` selecting the wrong element, so humanized actions now resolve the same visible target Playwright would (#512). Text matching ignores non-rendered document content, open Shadow DOM matches are ordered exactly as Playwright orders them for broad `first`/`nth` selectors, and elements with no box of their own (`display: contents`) get actionable geometry derived from their rendered text and visible descendants. Python, JavaScript Playwright/Puppeteer, and .NET.
```

**File**: `cloakbrowser/download.py` (modified, +16/-4)
```diff
@@ -193,7 +193,11 @@ def ensure_binary(
     requested_version = normalize_requested_version(browser_version)
 
     # Pro license key check (custom download URL overrides Pro path)
-    from .license import resolve_license_key, validate_license
+    from .license import (
+        CloakBrowserLicenseError,
+        resolve_license_key,
+        validate_license,
+    )
 
     key = resolve_license_key(license_key)
     if os.environ.get("CLOAKBROWSER_DOWNLOAD_URL"):
@@ -232,11 +236,19 @@ def ensure_binary(
                     f"CLOAKBROWSER_LICENSE_KEY."
                 ) from e
         elif info:
-            logger.warning(
-                "License validation failed (plan=%s), using free tier", info.plan
+            # Key supplied but rejected — abort, never downgrade to free.
+            raise CloakBrowserLicenseError(
+                f"CloakBrowser Pro: license key is invalid or expired "
+                f"(plan={info.plan}). Check CLOAKBROWSER_LICENSE_KEY, or unset it "
+                f"to use the free binary."
             )
         else:
-            logger.warning("License validation unavailable, using free tier")
+            # Key supplied but unvalidatable (server down, no cache) — abort.
+            raise CloakBrowserLicenseError(
+                "CloakBrowser Pro: license could not be validated (server "
+                "unreachable and no cached validation). Retry in a moment, or "
+                "unset CLOAKBROWSER_LICENSE_KEY to use the free binary."
+            )
 
     # Fail fast if no binary available for this platform
     check_platform_available()
```

**File**: `dotnet/src/CloakBrowser/Download.cs` (modified, +9/-2)
```diff
@@ -251,11 +251,18 @@ public static async Task<string> EnsureBinaryAsync(
             }
             else if (info != null)
             {
-                CloakLog.Warning("License validation failed (plan={0}), using free tier", info.Plan);
+                // Key supplied but rejected - abort, never downgrade to free.
+                throw new InvalidOperationException(
+                    $"CloakBrowser Pro: license key is invalid or expired (plan={info.Plan}). " +
+                    "Check CLOAKBROWSER_LICENSE_KEY, or unset it to use the free binary.");
             }
             else
             {
-                CloakLog.Warning("License validation unavailable, using free tier");
+                // Key supplied but unvalidatable (server down, no cache) - abort.
+                throw new InvalidOperationException(
+                    "CloakBrowser Pro: license could not be validated (server unreachable " +
+                    "and no cached validation). Retry in a moment, or unset " +
+                    "CLOAKBROWSER_LICENSE_KEY to use the free binary.");
             }
         }
 
```

**File**: `dotnet/tests/CloakBrowser.Tests/LicenseTests.cs` (modified, +24/-0)
```diff
@@ -208,6 +208,30 @@ public void CorruptedValidatedAt_does_not_crash()
         Assert.Equal("team", info!.Plan);
     }
 
+    // =======================================================================
+    // EnsureBinary Pro routing - a supplied key that isn't valid aborts,
+    // never silently downgrades to the free binary.
+    // =======================================================================
+
+    [Fact]
+    public async Task InvalidKey_aborts_not_free()
+    {
+        License.ValidateLicenseOverride = key => new LicenseInfo(false, "solo", null);
+        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
+            () => Download.EnsureBinaryAsync("cb_bad"));
+        Assert.Contains("invalid or expired", ex.Message);
+    }
+
+    [Fact]
+    public async Task UnvalidatableKey_aborts_not_free()
+    {
+        // validate returns null (server unreachable, no cache) -> abort.
+        License.ValidateLicenseOverride = key => null;
+        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
+            () => Download.EnsureBinaryAsync("cb_x"));
+        Assert.Contains("could not be validated", ex.Message);
+    }
+
     // =======================================================================
     // GetProLatestVersion - rate limiting + marker
     // =======================================================================
```

**File**: `js/src/download.ts` (modified, +11/-2)
```diff
@@ -127,9 +127,18 @@ export async function ensureBinary(
         );
       }
     } else if (info) {
-      console.log(`[cloakbrowser] License validation failed (plan=${info.plan}), using free tier`);
+      // Key supplied but rejected — abort, never downgrade to free.
+      throw new Error(
+        `CloakBrowser Pro: license key is invalid or expired (plan=${info.plan}). ` +
+          `Check CLOAKBROWSER_LICENSE_KEY, or unset it to use the free binary.`,
+      );
     } else {
-      console.log("[cloakbrowser] License validation unavailable, using free tier");
+      // Key supplied but unvalidatable (server down, no cache) — abort.
+      throw new Error(
+        "CloakBrowser Pro: license could not be validated (server unreachable " +
+          "and no cached validation). Retry in a moment, or unset " +
+          "CLOAKBROWSER_LICENSE_KEY to use the free binary.",
+      );
     }
   }
 
```

**File**: `js/tests/update.test.ts` (modified, +17/-0)
```diff
@@ -547,6 +547,23 @@ describe("preview Pro selection", () => {
       errSpy.mock.calls.some((c) => String(c[0]).includes("no preview build is available")),
     ).toBe(false);
   });
+
+  it("aborts (never free) when the server rejects the key", async () => {
+    delete process.env.CLOAKBROWSER_DOWNLOAD_URL;
+    vi.spyOn(globalThis, "fetch").mockResolvedValue({
+      ok: true,
+      json: async () => ({ valid: false, plan: "solo", expires: null }),
+    } as Response);
+
+    await expect(ensureBinary("cb_bad")).rejects.toThrow(/invalid or expired/);
+  });
+
+  it("aborts (never free) when the key cannot be validated (server down, no cache)", async () => {
+    delete process.env.CLOAKBROWSER_DOWNLOAD_URL;
+    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
+
+    await expect(ensureBinary("cb_test")).rejects.toThrow(/could not be validated/);
+  });
 });
 
 describe("ensureBinary", () => {
```

**File**: `tests/test_license.py` (modified, +30/-0)
```diff
@@ -11,6 +11,7 @@
 
 from cloakbrowser.download import BinaryVerificationError, ensure_binary
 from cloakbrowser.license import (
+    CloakBrowserLicenseError,
     LicenseInfo,
     build_launch_env,
     get_active_session_count,
@@ -839,6 +840,35 @@ def test_macos_pro_404_hard_errors_not_free(self):
             with pytest.raises(RuntimeError, match="Pro binary unavailable"):
                 ensure_binary("cb_x")
 
+    def test_invalid_key_aborts_not_free(self):
+        """A supplied key the server rejects (valid=False) must abort with a clear
+        license error — NOT silently downgrade to the free binary."""
+        with patch.dict(os.environ, {"CLOAKBROWSER_DOWNLOAD_URL": ""}, clear=False), \
+             patch("cloakbrowser.download.get_local_binary_override", return_value=None), \
+             patch("cloakbrowser.license.resolve_license_key", return_value="cb_bad"), \
+             patch("cloakbrowser.license.validate_license",
+                   return_value=LicenseInfo(valid=False, plan="solo", expires=None)), \
+             patch("cloakbrowser.download._ensure_pro_binary",
+                   side_effect=AssertionError("MUST NOT reach the Pro path")), \
+             patch("cloakbrowser.download.check_platform_available",
+                   side_effect=AssertionError("MUST NOT reach the free-tier path")):
+            with pytest.raises(CloakBrowserLicenseError, match="invalid or expired"):
+                ensure_binary("cb_bad")
+
+    def test_unvalidatable_key_aborts_not_free(self):
+        """A supplied key that can't be validated (server unreachable, no cache →
+        validate_license returns None) must abort — NOT silently downgrade."""
+        with patch.dict(os.environ, {"CLOAKBROWSER_DOWNLOAD_URL": ""}, clear=False), \
+             patch("cloakbrowser.download.get_local_binary_override", return_value=None), \
+             patch("cloakbrowser.license.resolve_license_key", return_value="cb_x"), \
+             patch("cloakbrowser.license.validate_license", return_value=None), \
+             patch("cloakbrowser.download._ensure_pro_binary",
+                   side_effect=AssertionError("MUST NOT reach the Pro path")), \
+             patch("cloakbrowser.download.check_platform_available",
+                   side_effect=AssertionError("MUST NOT reach the free-tier path")):
+            with pytest.raises(CloakBrowserLicenseError, match="could not be validated"):
+                ensure_binary("cb_x")
+
 
 # ── build_launch_env ──────────────────────────────────
 
```

---

### Incident Patch 13: `0811704e` (2026-08-25)
**Commit Message**: release: v0.5.9 — humanize selector fixes + info seat reporting

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -6,6 +6,17 @@ Changes are tagged: **[wrapper]** for Python/JS wrapper, **[binary]** for Chromi
 
 ---
 
+## [0.5.9] — 2026-08-25
+
+- **[wrapper]** Fix `humanize=True` selecting the wrong element, so humanized actions now resolve the same visible target Playwright would (#512). Text matching ignores non-rendered document content, open Shadow DOM matches are ordered exactly as Playwright orders them for broad `first`/`nth` selectors, and elements with no box of their own (`display: contents`) get actionable geometry derived from their rendered text and visible descendants. Python, JavaScript Playwright/Puppeteer, and .NET.
+- **[wrapper]** Restore `get_by_*` locators (test id, placeholder/alt/title, text, label) under `humanize=True`. They had stopped resolving after an earlier internal read path was closed off; the engines are reimplemented in the isolated world so the locators work again without reopening that path. `get_by_role` and `>>` chaining remain unsupported, and the error now names what is supported. Python, JavaScript, and .NET.
+- **[wrapper]** Preserve the exact target element across a delayed humanized interaction, and skip the pointer check entirely under `force=True` to match Playwright. Pointer events are no longer dispatched if the original target is detached or replaced while the cursor is moving. Python, JavaScript, and .NET.
+- **[wrapper]** `cloakbrowser info` now reports concurrent session seats as used out of the plan limit instead of a bare count, so you can tell whether you are at capacity, and names the real reason when the count is unavailable (server unreachable, timeout, invalid key, inactive license, rate limited, or reported unknown while degraded) (#513). Adds `SessionSeats` / `getSessionSeats`; `get_active_session_count` keeps its signature. Python, JavaScript, and .NET.
+- **[wrapper]** Fix the license session guard on `launch_persistent_context_async` not having its denial path available after installation. Python.
+- **[wrapper]** Declare the URW base35 fonts explicitly in the published Docker image so the Latin fallback for Verdana, Georgia, Trebuchet MS and Tahoma cannot be silently dropped by a future window-manager change. No runtime change.
+
+---
+
 ## [0.5.8] — 2026-08-18
 
 - **[wrapper]** Fix `humanize=True` actions (`fill`, `click`, `type`) failing with an element-not-attached error after a navigation driven by a click or form submission instead of `goto`. The pre-action element checks could stay bound to the previous document and never recover; they now refresh on every navigation. Regression from 0.5.6. Python, JavaScript Playwright/Puppeteer, and .NET.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ page.goto("https://example.com")
 
 ---
 
-## Latest: v0.5.8 — 73 source-level stealth patches (Chromium 151.0.7922.108.2 — Linux + Windows)
+## Latest: v0.5.9 — 73 source-level stealth patches (Chromium 151.0.7922.108.2 — Linux + Windows)
 
 - **CloakBrowser Pro Stable** — Chromium `151.0.7922.108.2` on Linux x64, Linux ARM64, and Windows x64; macOS remains on `150.0.7871.114.3`. Set a `license_key` (`licenseKey` in JS) or the `CLOAKBROWSER_LICENSE_KEY` env var and the wrapper fetches the latest Stable build for your platform automatically. See [CloakBrowser Pro](#cloakbrowser-pro)
 - **CloakBrowser Pro Preview** — Chromium `151.0.7922.108.3` on Linux x64, Linux ARM64, Windows x64, and macOS. Opt in with `release_channel="preview"` or `CLOAKBROWSER_RELEASE_CHANNEL=preview`.
```

**File**: `cloakbrowser/_version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-__version__ = "0.5.8"
+__version__ = "0.5.9"
```

**File**: `dotnet/src/CloakBrowser/CloakBrowser.csproj` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 
     <!-- NuGet packaging metadata -->
     <PackageId>CloakBrowser</PackageId>
-    <Version>0.5.8</Version>
+    <Version>0.5.9</Version>
     <Authors>CloakHQ</Authors>
     <Description>Stealth Chromium that passes every bot detection test. Drop-in Playwright (.NET) replacement with source-level fingerprint patches.</Description>
     <PackageLicenseExpression>MIT</PackageLicenseExpression>
```

**File**: `dotnet/src/CloakBrowser/CloakVersion.cs` (modified, +1/-1)
```diff
@@ -4,5 +4,5 @@ namespace CloakBrowser;
 public static class CloakVersion
 {
     /// <summary>The CloakBrowser .NET wrapper version.</summary>
-    public const string Version = "0.5.8";
+    public const string Version = "0.5.9";
 }
```

**File**: `js/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "cloakbrowser",
-  "version": "0.5.8",
+  "version": "0.5.9",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "cloakbrowser",
-      "version": "0.5.8",
+      "version": "0.5.9",
       "license": "MIT",
       "dependencies": {
         "tar": "^7.0.0"
```

**File**: `js/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "cloakbrowser",
-  "version": "0.5.8",
+  "version": "0.5.9",
   "description": "Stealth Chromium that passes every bot detection test. Drop-in Playwright/Puppeteer replacement with source-level fingerprint patches.",
   "type": "module",
   "main": "dist/index.js",
```

---

### Incident Patch 14: `a853517e` (2026-08-22)
**Commit Message**: fix(test): run the .NET resolver check from a script file

The test inlines the resolver once per builder call, so adding the selector
engines took the script past 110 KB. Linux caps a single argv entry at
MAX_ARG_STRLEN (128 KB), so "node -e <script>" failed with E2BIG on CI while
passing on macOS, which allows a larger argument.

Write the script to a temp file and pass the path instead, which has no size
ceiling.

**File**: `dotnet/tests/CloakBrowser.Tests/Human/StealthDomTests.cs` (modified, +26/-14)
```diff
@@ -1,5 +1,6 @@
 using System;
 using System.Diagnostics;
+using System.IO;
 using System.Text.Json;
 using CloakBrowser.Human;
 using Xunit;
@@ -177,20 +178,31 @@ function el(tag,text,box,display,visibility){
 
     private static string RunNode(string node, string script)
     {
-        var psi = new ProcessStartInfo(node)
+        // The script inlines the resolver once per builder call, so it is well over
+        // 100 KB. Linux caps a single argv entry at MAX_ARG_STRLEN (128 KB) and
+        // "node -e <script>" hits E2BIG there, so hand node a file instead.
+        string scriptPath = Path.Combine(Path.GetTempPath(),
+            "cloakbrowser-resolver-" + Guid.NewGuid().ToString("N") + ".js");
+        File.WriteAllText(scriptPath, script);
+        try
         {
-            RedirectStandardOutput = true,
-            RedirectStandardError = true,
-            UseShellExecute = false,
-        };
-        // ArgumentList passes each arg verbatim (no shell/quote parsing to corrupt the script).
-        psi.ArgumentList.Add("-e");
-        psi.ArgumentList.Add(script);
-        using var proc = Process.Start(psi)!;
-        string outp = proc.StandardOutput.ReadToEnd();
-        string err = proc.StandardError.ReadToEnd();
-        proc.WaitForExit(30000);
-        Assert.True(proc.ExitCode == 0, $"node failed:\n{outp}\n{err}");
-        return outp;
+            var psi = new ProcessStartInfo(node)
+            {
+                RedirectStandardOutput = true,
+                RedirectStandardError = true,
+                UseShellExecute = false,
+            };
+            psi.ArgumentList.Add(scriptPath);
+            using var proc = Process.Start(psi)!;
+            string outp = proc.StandardOutput.ReadToEnd();
+            string err = proc.StandardError.ReadToEnd();
+            proc.WaitForExit(30000);
+            Assert.True(proc.ExitCode == 0, $"node failed:\n{outp}\n{err}");
+            return outp;
+        }
+        finally
+        {
+            try { File.Delete(scriptPath); } catch (IOException) { }
+        }
     }
 }
```

---

### Incident Patch 15: `1164eca3` (2026-08-22)
**Commit Message**: fix(humanize): restore get_by_* selectors and harden isolated-world reads

Removing the Playwright fallback closed a main-world read leak but left every
get_by_* locator raising UnsupportedHumanizeSelectorError. Reimplement the four
cheap engines in the isolated-world resolver so those locators work again.

Selector engines (shared resolver, byte-identical in all three wrappers):
- internal:testid and internal:attr (placeholder/alt/title). The i flag is a
  case-insensitive substring on the raw attribute value; test ids stay strict.
- internal:text. Exact compares the full normalized subtree text, unlike the
  public text= engine which compares immediate fragments.
- internal:label, resolving aria-labelledby, then aria-label, then .labels.
- internal:role and >> chaining stay unsupported; the error now names what is
  supported and the workaround.

Text parity fixes in __elementText, checked against playwright-core:
- drop a <br> to newline branch Playwright does not have
- concatenate shadow-root text into the host, which Playwright does
- give the public text= engine Playwright's self/selfAndChildren rule, since
  contains() cannot see into a shadow root and kept the host as a ma

**File**: `cloakbrowser/human/__init__.py` (modified, +30/-24)
```diff
@@ -1030,10 +1030,11 @@ def _remaining_ms():
         human_move(raw_mouse, cursor.x, cursor.y, target.x, target.y, call_cfg)
         cursor.x = target.x
         cursor.y = target.y
-        check_pointer_events(
-            page, selector, box.get("targetId"), target.x, target.y,
-            stealth, timeout=_remaining_ms(), force=force,
-        )
+        if not force:
+            check_pointer_events(
+                page, selector, box.get("targetId"), box.get("gen"),
+                target.x, target.y, stealth, timeout=_remaining_ms(),
+            )
         human_click(raw_mouse, is_input, call_cfg)
 
     def _human_dblclick(selector: str, **kwargs: Any) -> None:
@@ -1070,10 +1071,11 @@ def _remaining_ms():
         human_move(raw_mouse, cursor.x, cursor.y, target.x, target.y, call_cfg)
         cursor.x = target.x
         cursor.y = target.y
-        check_pointer_events(
-            page, selector, box.get("targetId"), target.x, target.y,
-            stealth, timeout=_remaining_ms(), force=force,
-        )
+        if not force:
+            check_pointer_events(
+                page, selector, box.get("targetId"), box.get("gen"),
+                target.x, target.y, stealth, timeout=_remaining_ms(),
+            )
         raw_mouse.down(click_count=2)
         sleep_ms(rand(30, 60))
         raw_mouse.up(click_count=2)
@@ -1112,10 +1114,11 @@ def _remaining_ms():
         human_move(raw_mouse, cursor.x, cursor.y, target.x, target.y, call_cfg)
         cursor.x = target.x
         cursor.y = target.y
-        check_pointer_events(
-            page, selector, box.get("targetId"), target.x, target.y,
-            stealth, timeout=_remaining_ms(), force=force,
-        )
+        if not force:
+            check_pointer_events(
+                page, selector, box.get("targetId"), box.get("gen"),
+                target.x, target.y, stealth, timeout=_remaining_ms(),
+            )
 
     def _human_type(selector: str, text: str, **kwargs: Any) -> None:
         call_cfg = merge_config(cfg, kwargs.get("human_config"))
@@ -2116,10 +2119,11 @@ def _remaining_ms():
         await async_human_move(raw_mouse, cursor.x, cursor.y, target.x, target.y, call_cfg)
         cursor.x = target.x
         cursor.y = target.y
-        await async_check_pointer_events(
-            page, selector, box.get("targetId"), target.x, target.y,
-            stealth, timeout=_remaining_ms(), force=force,
-        )
+        if not force:
+            await async_check_pointer_events(
+                page, selector, box.get("targetId"), box.get("gen"),
+                target.x, target.y, stealth, timeout=_remaining_ms(),
+            )
         await async_human_click(raw_mouse, is_input, call_cfg)
 
     async def _human_dblclick(selector: str, **kwargs: Any) -> None:
@@ -2155,10 +2159,11 @@ def _remaining_ms():
         await async_human_move(raw_mouse, cursor.x, cursor.y, target.x, target.y, call_cfg)
         cursor.x = target.x
         cursor.y = target.y
-        await async_check_pointer_events(
-            page, selector, box.get("targetId"), target.x, target.y,
-            stealth, timeout=_remaining_ms(), force=force,
-        )
+        if not force:
+            await async_check_pointer_events(
+                page, selector, box.get("targetId"), box.get("gen"),
+                target.x, target.y, stealth, timeout=_remaining_ms(),
+            )
         await raw_mouse.down(click_count=2)
         await async_sleep_ms(rand(30, 60))
         await raw_mouse.up(click_count=2)
@@ -2196,10 +2201,11 @@ def _remaining_ms():
         await async_human_move(raw_mouse, cursor.x, cursor.y, target.x, target.y, call_cfg)
         cursor.x = target.x
         cursor.y = target.y
-        await async_check_pointer_events(
-            page, selector, box.get("targetId"), target.x, target.y,
-            stealth, timeout=_remaining_ms(), force=force,
-        )
+        if not force:
+            await async_check_pointer_events(
+                page, selector, box.get("targetId"), box.get("gen"),
+                target.x, target.y, stealth, timeout=_remaining_ms(),
+            )
 
     async def _human_type(selector: str, text: str, **kwargs: Any) -> None:
         call_cfg = merge_config(cfg, kwargs.get("human_config"))
```

**File**: `cloakbrowser/human/actionability.py` (modified, +9/-5)
```diff
@@ -249,25 +249,29 @@ def check_pointer_events(
     page: Any,
     selector: str,
     target_id: int,
+    gen: int,
     x: float,
     y: float,
     stealth: Any = None,
     timeout: float = 5000,
-    force: bool = False,
 ) -> None:
-    """Revalidate exact identity; force skips only receives-events rejection."""
+    """Revalidate that the click point still hits the same resolved element.
+
+    Callers skip this entirely when ``force=True`` (matching Playwright, where
+    ``force`` bypasses all actionability checks).
+    """
     deadline = time.monotonic() + timeout / 1000.0
     attempt = 0
     last_miss: Optional[str] = None
     world = stealth if stealth is not None else getattr(page, "_stealth_world", None)
     if world is None:
         raise StealthWorldUnavailableError()
-    if not isinstance(target_id, int):
+    if not isinstance(target_id, int) or not isinstance(gen, int):
         raise StealthEvaluationError(selector)
 
     while True:
         status, data = eval_parsed(
-            world, build_validate_js(selector, target_id, x, y)
+            world, build_validate_js(selector, target_id, gen, x, y)
         )
         if status == UNSUPPORTED:
             raise UnsupportedHumanizeSelectorError(selector)
@@ -278,7 +282,7 @@ def check_pointer_events(
         if status == EVALUATION_FAILED:
             if time.monotonic() >= deadline:
                 raise StealthEvaluationError(selector)
-        elif force or data.get("hit", False):
+        elif data.get("hit", False):
             return
         else:
             last_miss = data.get("covering", "unknown")
```

**File**: `cloakbrowser/human/actionability_async.py` (modified, +4/-4)
```diff
@@ -159,24 +159,24 @@ async def async_check_pointer_events(
     page: Any,
     selector: str,
     target_id: int,
+    gen: int,
     x: float,
     y: float,
     stealth: Any = None,
     timeout: float = 5000,
-    force: bool = False,
 ) -> None:
     deadline = time.monotonic() + timeout / 1000.0
     attempt = 0
     last_miss: Optional[str] = None
     world = stealth if stealth is not None else getattr(page, "_stealth_world", None)
     if world is None:
         raise StealthWorldUnavailableError()
-    if not isinstance(target_id, int):
+    if not isinstance(target_id, int) or not isinstance(gen, int):
         raise StealthEvaluationError(selector)
 
     while True:
         status, data = await async_eval_parsed(
-            world, build_validate_js(selector, target_id, x, y)
+            world, build_validate_js(selector, target_id, gen, x, y)
         )
         if status == UNSUPPORTED:
             raise UnsupportedHumanizeSelectorError(selector)
@@ -187,7 +187,7 @@ async def async_check_pointer_events(
         if status == EVALUATION_FAILED:
             if time.monotonic() >= deadline:
                 raise StealthEvaluationError(selector)
-        elif force or data.get("hit", False):
+        elif data.get("hit", False):
             return
         else:
             last_miss = data.get("covering", "unknown")
```

**File**: `cloakbrowser/human/scroll.py` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ def _get_element_box(page: Any, selector: str, timeout: float = 30000) -> Option
     if status == OK:
         box = dict(data["box"])
         box["targetId"] = data["targetId"]
+        box["gen"] = data["gen"]
         return box
     if status == NOT_FOUND:
         return None
```

**File**: `cloakbrowser/human/scroll_async.py` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ async def _get_element_box_async(
     if status == OK:
         box = dict(data["box"])
         box["targetId"] = data["targetId"]
+        box["gen"] = data["gen"]
         return box
     if status == NOT_FOUND:
         return None
```

**File**: `cloakbrowser/human/stealth_dom.py` (modified, +280/-40)
```diff
@@ -13,12 +13,19 @@
   * plain CSS / ``css=`` — including the ``:has-text("...")`` pseudo
   * ``text=`` engine (quoted = exact, unquoted = case-insensitive substring)
   * ``xpath=`` / leading ``//``
+  * ``internal:testid=`` / ``internal:attr=`` (``get_by_test_id``,
+    ``get_by_placeholder``, ``get_by_alt_text``, ``get_by_title``)
+  * ``internal:text=`` / ``internal:label=`` (``get_by_text``, ``get_by_label``)
   * a trailing ``>> nth=N`` (what ``.first`` / ``.nth(k)`` / ``.last`` append)
 
-Anything richer (``>>`` chaining, ``internal:*`` engines from ``get_by_*``,
-``:visible``, ``:nth-match``, layout pseudos, …) returns ``unsupported`` and the
-caller raises a typed error. Correctness and stealth win on ties: uncertain grammar
-never falls back to Playwright DOM reads.
+Anything richer returns ``unsupported`` and the caller raises a typed error:
+``>>`` chaining (so ``.filter()``, ``.and_()``, ``.or_()`` and chained locators),
+``internal:role=`` (``get_by_role`` — a faithful port needs Playwright's whole
+accessible-name algorithm), ``internal:has*``, ``internal:control=``
+(``frame_locator``), ``:visible``, ``:nth-match``, and layout pseudos.
+Correctness and stealth win on ties: uncertain grammar never falls back to
+Playwright DOM reads, because a mis-resolved element means clicking the wrong
+coordinates.
 
 The JS builders and :func:`parse_result` are pure and shared by the sync and
 async call sites; only the ``world.evaluate`` await differs.
@@ -30,7 +37,7 @@
 from typing import Any, Optional, Tuple
 
 # Versioned protocol returned by the isolated-world DOM helper.
-PROTOCOL_VERSION = 1
+PROTOCOL_VERSION = 2
 
 # Status returned to callers.
 OK = "ok"
@@ -45,9 +52,23 @@ class StealthDomError(RuntimeError):
 
 
 class UnsupportedHumanizeSelectorError(StealthDomError):
+    """Raised for selector grammar the isolated-world resolver cannot resolve.
+
+    The humanize layer resolves selectors inside the isolated world so page
+    scripts cannot observe the read. Grammar it cannot resolve is refused rather
+    than handed back to Playwright, whose locator predicates run in the page's
+    main world and are observable.
+    """
+
     def __init__(self, selector: str):
         super().__init__(
-            f"Humanized selector {selector!r} is not supported by the isolated-world resolver"
+            f"Humanized selector {selector!r} is not supported by the isolated-world "
+            f"resolver. Supported: CSS, text=, xpath=, get_by_test_id, "
+            f"get_by_placeholder, get_by_alt_text, get_by_title, get_by_text, "
+            f"get_by_label, and a trailing .first/.nth()/.last. Not supported: "
+            f"get_by_role, chained locators (a >> b, .filter(), .and_(), .or_()), "
+            f"frame_locator, :visible and :nth-match. Use a CSS or text= selector "
+            f"for this action, or humanize=False to fall back to Playwright."
         )
 
 
@@ -69,16 +90,23 @@ def __init__(self, selector: str):
 
 _RESOLVER_BODY = r"""
 const __UNS = 'UNSUPPORTED';
-const __V = 1;
+const __V = 2;
 const __STATE_KEY = '__cloakHumanDomV1';
 function __state(){
   let s = globalThis[__STATE_KEY];
   if (!s) {
-    s = { ids: new WeakMap(), nextId: 1 };
+    // Element ids restart at 1 in every new world, and the world is recreated on
+    // navigation (#507), so an id alone can name a different element after a nav.
+    // The generation makes that cross-world reuse detectable as 'stale'.
+    // 11 bits of wall clock + 20 bits of randomness. The maximum is exactly
+    // Int32.MaxValue, because the .NET wrapper carries the value as an Int32.
+    s = { ids: new WeakMap(), nextId: 1,
+          gen: (Date.now() & 2047) * 1048576 + Math.floor(Math.random() * 1048576) };
     Object.defineProperty(globalThis, __STATE_KEY, { value: s, configurable: false, enumerable: false });
   }
   return s;
 }
+function __gen(){ return __state().gen; }
 function __targetId(el){
   const s = __state();
   let id = s.ids.get(el);
@@ -244,13 +272,11 @@ def __init__(self, selector: str):
       continue;
     } else {
       if (immediate) { fragments.push(immediate); immediate = ''; }
-      if (child.nodeType === 1) {
-        full += __elementText(child, cache).full;
-        if (child.tagName && child.tagName.toLowerCase() === 'br') full += '\n';
-      }
+      if (child.nodeType === 1) full += __elementText(child, cache).full;
     }
   }
   if (immediate) fragments.push(immediate);
+  if (el.shadowRoot) full += __elementText(el.shadowRoot, cache).full;
   out = { full: full, normalized: __normWS(full), immediate: fragments };
   cache.set(el, out);
   return out;
@@ -288,21 +314,224 @@ def __init__(self, selector: str):
   }
   return { kind: 'lax', value: __normWS(arg).toLowerCase() };
 }
-function __matchText(el, matcher, cache){
-  const text = __elementText(el, cache);
+function __matchTextValue(text, matcher){
   if (matcher.kind === 'regex') { matcher.regex.lastIndex = 0; return matcher.rege
```

**File**: `dotnet/src/CloakBrowser/Human/Actionability.cs` (modified, +11/-11)
```diff
@@ -306,37 +306,37 @@ public static async Task CheckPointerEventsAsync(
         double x,
         double y,
         double timeoutMs = 5000,
-        IsolatedWorld? stealth = null,
-        bool force = false)
+        IsolatedWorld? stealth = null)
     {
         if (stealth == null)
             throw new StealthWorldUnavailableError();
 
         var (status, snapshot) = await StealthDom.SnapshotAsync(stealth, selector).ConfigureAwait(false);
-        int targetId = status switch
+        var resolved = status switch
         {
-            StealthStatus.Ok when snapshot != null => snapshot.Value.TargetId,
+            StealthStatus.Ok when snapshot != null => snapshot.Value,
             StealthStatus.NotFound => throw new ElementNotAttachedError(selector),
             StealthStatus.Unsupported => throw new UnsupportedHumanizeSelectorError(selector),
             _ => throw new StealthEvaluationError(selector),
         };
         await CheckPointerEventsAsync(
-            page, selector, targetId, x, y, timeoutMs, stealth, force).ConfigureAwait(false);
+            page, selector, resolved.TargetId, resolved.Gen, x, y, timeoutMs, stealth).ConfigureAwait(false);
     }
 
     /// <summary>
-    /// Revalidate exact selector identity and pointer coverage after mouse movement.
-    /// Force skips only coverage rejection; identity is always enforced.
+    /// Revalidate that the click point still hits the same resolved element.
+    /// Callers skip this entirely when force is set (matching Playwright, where
+    /// force bypasses all actionability checks).
     /// </summary>
     public static async Task CheckPointerEventsAsync(
         IPage page,
         string selector,
         int targetId,
+        int gen,
         double x,
         double y,
         double timeoutMs = 5000,
-        IsolatedWorld? stealth = null,
-        bool force = false)
+        IsolatedWorld? stealth = null)
     {
         if (stealth == null)
             throw new StealthWorldUnavailableError();
@@ -347,7 +347,7 @@ public static async Task CheckPointerEventsAsync(
         while (true)
         {
             var (status, hit, covering, _) = await StealthDom.ValidateAsync(
-                stealth, selector, targetId, x, y).ConfigureAwait(false);
+                stealth, selector, targetId, gen, x, y).ConfigureAwait(false);
 
             if (status == StealthStatus.Unsupported)
                 throw new UnsupportedHumanizeSelectorError(selector);
@@ -360,7 +360,7 @@ public static async Task CheckPointerEventsAsync(
                 if (NowMs() >= deadline)
                     throw new StealthEvaluationError(selector);
             }
-            else if (status == StealthStatus.Ok && (force || hit))
+            else if (status == StealthStatus.Ok && hit)
             {
                 return;
             }
```

**File**: `dotnet/src/CloakBrowser/Human/HumanPage.cs` (modified, +7/-7)
```diff
@@ -197,11 +197,13 @@ private async Task EnsureStableWorldAsync(string selector, double timeoutMs)
     }
 
     private async Task CheckPointerEventsWorldAsync(
-        string selector, int targetId, double x, double y, double timeoutMs, bool force)
+        string selector, int targetId, int gen, double x, double y, double timeoutMs, bool force)
     {
+        if (force)
+            return;
         var world = await GetStealthRequiredAsync().ConfigureAwait(false);
         await Actionability.CheckPointerEventsAsync(
-            _page, selector, targetId, x, y, timeoutMs, world, force).ConfigureAwait(false);
+            _page, selector, targetId, gen, x, y, timeoutMs, world).ConfigureAwait(false);
     }
 
     // -----------------------------------------------------------------------
@@ -263,10 +265,8 @@ await HumanMouse.HumanMoveAsync(
             _rawMouse, _cursor.X, _cursor.Y, target.X, target.Y, callCfg).ConfigureAwait(false);
         _cursor.X = target.X;
         _cursor.Y = target.Y;
-        // Identity is always revalidated after movement and before mouse-down.
-        // force skips only coverage rejection, never exact-target validation.
         await CheckPointerEventsWorldAsync(
-            selector, snapshot.TargetId, target.X, target.Y,
+            selector, snapshot.TargetId, snapshot.Gen, target.X, target.Y,
             RemainingMs(deadline), force).ConfigureAwait(false);
         await HumanMouse.HumanClickAsync(_rawMouse, snapshot.IsInput, callCfg).ConfigureAwait(false);
     }
@@ -316,7 +316,7 @@ await HumanMouse.HumanMoveAsync(
         _cursor.X = target.X;
         _cursor.Y = target.Y;
         await CheckPointerEventsWorldAsync(
-            selector, snapshot.TargetId, target.X, target.Y,
+            selector, snapshot.TargetId, snapshot.Gen, target.X, target.Y,
             RemainingMs(deadline), force).ConfigureAwait(false);
         // Two presses for a double-click via Playwright IMouse click count.
         await _page.Mouse.DownAsync(new MouseDownOptions { ClickCount = 2 }).ConfigureAwait(false);
@@ -372,7 +372,7 @@ await HumanMouse.HumanMoveAsync(
         _cursor.X = target.X;
         _cursor.Y = target.Y;
         await CheckPointerEventsWorldAsync(
-            selector, snapshot.TargetId, target.X, target.Y,
+            selector, snapshot.TargetId, snapshot.Gen, target.X, target.Y,
             RemainingMs(deadline), force).ConfigureAwait(false);
     }
 
```

#### Recent Merged Pull Requests:
- **PR #574** (2026-10-04): chore(deps-dev): bump the javascript group in /js with 2 updates (@dependabot[bot])
- **PR #554** (2026-09-29): fix(humanize): scroll the x axis in scroll-into-view (#521) (@Shub3am)
- **PR #551** (2026-09-29): chore(deps): bump the actions group across 1 directory with 3 updates (@dependabot[bot])
- **PR #542** (2026-09-29): chore(deps-dev): bump the javascript group across 1 directory with 4 updates (@dependabot[bot])
- **PR #535** (closed): chore(deps): bump the actions group across 1 directory with 2 updates (@dependabot[bot])
- **PR #534** (closed): chore(deps-dev): bump the javascript group across 1 directory with 3 updates (@dependabot[bot])
- **PR #531** (closed): chore(deps-dev): bump the javascript group across 1 directory with 2 updates (@dependabot[bot])
- **PR #519** (closed): chore(deps): bump docker/setup-buildx-action from 4.2.0 to 4.3.0 in the actions group across 1 directory (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

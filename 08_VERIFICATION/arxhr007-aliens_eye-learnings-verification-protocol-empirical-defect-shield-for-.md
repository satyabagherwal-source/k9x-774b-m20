# Verification Protocol: Verification Protocol: Empirical Defect Shield for arxhr007-aliens_eye-learnings

<!-- PROVENANCE_START
{
  "source_repository": "arxhr007-aliens_eye-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T21:17:47.365Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-arxhr007-aliens_eye-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arxhr007-aliens_eye-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T21:17:47.365Z`  
> **Learning ID**: `LEARN-EVO-arxhr007-aliens_eye-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `arxhr007-aliens_eye-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/arxhr007-aliens_eye-learnings.md`  
> **Source**: github ([https://github.com/arxhr007/Aliens_eye](https://github.com/arxhr007/Aliens_eye))  
> **Source Version**: `da0f12ef`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T21:17:19.950Z  
> **Learning ID**: `learn-github-arxhr007-aliens_eye`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): arxhr007/Aliens_eye

> **Canonical Artifact**: `07_PROJECT_LEARNING/arxhr007-aliens_eye-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arxhr007/Aliens_eye](https://github.com/arxhr007/Aliens_eye))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T21:17:19.838Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arxhr007/Aliens_eye`
- **Description**: AI powered OSINT engine to discover and map  7,700+ social media identities across the web
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4900 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/aliens_eye/core/__init__.py`
```
"""Core modules for Aliens Eye."""

```

### Core Architecture Module: `src/aliens_eye/core/analyzer.py`
```
import json
import re
from dataclasses import dataclass
from importlib import resources
from typing import Any
from urllib.parse import urljoin, urlparse

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from .config import (
    AUTH_PATTERNS,
    ERROR_CLASS_HINTS,
    ERROR_KEYWORDS,
    META_KEYWORDS,
    POSITIVE_KEYWORDS,
    PROFILE_CLASS_HINTS,
)

_JSON_LD_PERSON_RE = re.compile(r'"@type"\s*:\s*"Person"', re.IGNORECASE)
_JSON_LD_STR_FIELD_RE = {
    "name": re.compile(r'"name"\s*:\s*"([^"]+)"'),
    "image": re.compile(r'"image"\s*:\s*"([^"]+)"'),
}

_site_profiles_cache: dict[str, Any] | None = None


def _load_site_profiles() -> dict[str, Any]:
    """Optional per-site CSS-selector overrides for profile fields.

    Maps a site name to ``{"name": sel, "bio": sel, "avatar": sel}``. Missing or
    invalid file yields an empty map (generic extraction is used instead).
    """
    global _site_profiles_cache
    if _site_profiles_cache is None:
        try:
            text = (resources.files("aliens_eye.data") / "site_profiles.json").read_text("utf-8")
            data = json.loads(text)
            _site_profiles_cache = data if isinstance(data, dict) else {}
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            _site_profiles_cache = {}
    return _site_profiles_cache


@dataclass
class FeatureBundle:
    features: dict[str, float]
    signals: dict[str, Any]
    fingerprint: dict[str, Any]


class FeatureExtractor:
    """Extract structured signals from HTML content."""

    def __init__(
        self,
        error_keywords: list[str] | None = None,
        positive_keywords: list[str] | None = None,
        meta_keywords: list[str] | None = None,
        auth_patterns: list[str] | None = None,
    ) -> None:
        self.error_keywords = error_keywords or ERROR_KEYWORDS
        self.positive_keywords = positive_keywords or POSITIVE_KEYWORDS
        self.meta_keywords = meta_keywords or META_KEYWORDS
        self.auth_patterns = auth_patterns or AUTH_PATTERNS

    def extract(
        self,
        content: str,
        url: str,
        username: str,
        site_name: str,
        http_code: int,
        response_time: float,
        headers: dict[str, str] | None,
        redirect_count: int,
    ) -> FeatureBundle:
        content = content or ""
        content_lower = content.lower()

        error_keyword_count = sum(
            1 for keyword in self.error_keywords if keyword in content_lower
        )
        positive_keyword_count = sum(
            1 for keyword in self.positive_keywords if keyword in content_lower
        )

        parsed_url = urlparse(url)
        path = parsed_url.path or ""
        has_username_in_path = username.lower() in path.lower()
        has_auth_pattern = any(auth in path.lower() for auth in self.auth_patterns)
        is_homepage = path in ("", "/")

        tree = HTMLParser(content)
        title_node = tree.css_first("title")
        title_text = title_node.text().strip() if title_node else ""

        meta_contents: list[str] = []
        for node in tree.css("meta"):
            content_value = node.attributes.get("content")
            if content_value:
                meta_contents.append(content_value)

        meta_text = " ".join(meta_contents).lower()
        meta_error_keyword_count = sum(
            1 for keyword in self.error_keywords if keyword in meta_text
        )
        meta_positive_keyword_count = sum(
            1 for keyword in (self.positive_keywords + self.meta_keywords)
            if keyword in meta_text
        )

        class_nodes = tree.css("[class]")
        profile_section_count = 0
        error_section_count = 0
        for node in class_nodes:
            class_attr = node.attributes.get("class", "")
            class_value = str(class_attr).lower() if class_attr is not None else ""
            if not class_value:
                continue
            if any(hint in class_value for hint in PROFILE_CLASS_HINTS):
                profile_section_count += 1
            if any(hint in class_value for hint in ERROR_CLASS_HINTS):
                error_section_count += 1

        img_count = len(tree.css("img"))
        input_count = len(tree.css("input"))
        form_count = len(tree.css("form"))
        link_count = len(tree.css("a[href]"))

        # og:type = "profile" is a strong indicator of a real profile page
        og_type_profile = 0.0
        for node in tree.css('meta[property="og:type"]'):
            if (node.attributes.get("content") or "").lower() == "profile":
                og_type_profile = 1.0
                break

        # JSON-LD Person schema appears on profile pages
        has_json_ld_person = 0.0
        for node in tree.css('script[type="application/ld+json"]'):
            script_text = node.text()
            if script_text and _JSON_LD_PERSON_RE.search(script_text):
                has_json_ld_person = 1.0
                break

        # Canonical URL containing the username is a reliable profile signal
        username_in_canonical = 0.0
        canonical_node = tree.css_first('link[rel="canonical"]')
        if canonical_node:
            canonical_href = (canonical_node.attributes.get("href") or "").lower()
            if username.lower() in canonical_href:
                username_in_canonical = 1.0

        body_node = tree.css_first("body")
        text_length = float(len(body_node.text(deep=True))) if body_node else 0.0

        profile = self._extract_profile(tree, url, site_name, title_text)

        features = {
            "http_200": 1.0 if http_code == 200 else 0.0,
            "http_3xx": 1.0 if 300 <= http_code < 400 else 0.0,
            "http_404": 1.0 if http_code == 404 else 0.0,
            "http_4xx": 1.0 if 400 <= http_code < 500 else 0.0,
            "http_5xx": 1.0 if http_code >= 500 else 0.0,
            "has_username_in_path": 1.0 if has_username_in_path else 0.0,
            "is_homepage": 1.0 if is_homepage else 0.0,
            "has_auth_pattern": 1.0 if has_auth_pattern else 0.0,
            "error_keyword_count": float(error_keyword_count),
            "positive_keyword_count": float(positive_keyword_count),
            "meta_error_keyword_count": float(meta_error_keyword_count),
            "meta_positive_keyword_count": float(meta_positive_keyword_count),
            "profile_section_count": float(profile_section_count),
            "error_section_count": float(error_section_count),
            "img_count": float(img_count),
            "input_count": float(input_count),
            "form_count": float(form_count),
            "title_has_username": 1.0
            if username.lower() in title_text.lower()
            else 0.0,
            "meta_has_username": 1.0
            if username.lower() in meta_text
            else 0.0,
            "response_time": float(response_time),
            "content_length": float(len(content)),
            "redirect_count": float(redirect_count),
            "og_type_profile": og_type_profile,
            "has_json_ld_person": has_json_ld_person,
            "username_in_canonical": username_in_canonical,
            "link_count": float(link_count),
            "text_length": text_length,
        }

        signals = {
            "site": site_name,
            "title": title_text,
            "profile": profile,
            "meta_samples": meta_contents[:5],
            "url_analysis": {
                "domain": parsed_url.netloc,
                "path": path,
                "has_username_in_path": has_username_in_path,
                "has_auth_pattern": has_auth_pattern,
                "is_homepage": is_homepage,
            },
            "dom": {
                "img_count": img_count,
                "input_count": input_count,
                "form_count": form_count,
                "profile_section_count": profile_section_count,
                "error_section_count": error_section_count,
            },
            "headers": {
                "server": (headers or {}).get("Server", ""),
                "content_type": (headers or {}).get("Content-Type", ""),
            },
        }

        fingerprint = {
            "title": title_text,
            "meta_text": meta_text,
            "dom_signature": f"img:{img_count}|form:{form_count}|profile:{profile_section_count}|error:{error_section_count}",
            "server": (headers or {}).get("Server", ""),
        }

        return FeatureBundle(features=features, signals=signals, fingerprint=fingerprint)

    def _extract_profile(
        self, tree: HTMLParser, url: str, site_name: str, title_text: str
    ) -> dict[str, Any]:
        """Best-effort display name / bio / avatar for a profile page.

        Generic and provider-agnostic: OpenGraph tags, then JSON-LD Person,
        then plain <title>/<meta>. Per-site CSS overrides in
        data/site_profiles.json take precedence when present.
        """
        # A "structured" name comes from a real profile field (OpenGraph title,
        # JSON-LD Person, or a per-site CSS override). Only those are trustworthy
        # as an identity signal; the bare <title> fallback is page chrome (bot
        # walls, error pages, brand titles) and must not drive correlation.
        name = self._meta_content(tree, 'meta[property="og:title"]')
        bio = self._meta_content(tree, 'meta[property="og:description"]')
        avatar = self._meta_content(tree, 'meta[property="og:image"]')
        sources = {
            "name": "opengraph" if name else "missing",
            "bio": "opengraph" if bio else "missing",
            "avatar": "opengraph" if avatar else "missing",
        }

        if not (name and avatar):
            ld_name, ld_image = self._json_ld_person_fields(tree)
            if not name and ld_name:
                sources["name"] = "json_ld"
            if not avatar and ld_image:
                sources["avatar"] = "json_ld"
            name = name or ld_name
   
```

### Core Architecture Module: `src/aliens_eye/core/browser.py`
```
import asyncio

# A browser holds on to memory for every page it has ever rendered, closed or not.
# Replacing its context now and then hands that memory back to the system.
RECYCLE_AFTER_PAGES = 40
CLOSE_TIMEOUT = 5.0


async def _stop_starter(starter) -> None:
    """Stop a Playwright whose ``start()`` never returned it.

    ``async_playwright().start()`` spawns the driver before it returns, so a
    start that fails or is cancelled part-way through leaves that driver
    running. The context manager's own exit is the only handle on it. What it
    raises does not matter here: the exception being propagated is already on
    its way out, and a Playwright that never got far enough to stop simply
    had nothing running.
    """
    try:
        await starter.__aexit__()
    except Exception:  # noqa: BLE001 - best effort cleanup on the way out
        pass


class BrowserFallback:
    """Playwright-based fallback for hard pages.

    Starts one browser, on first use, and shows it one page at a time.
    """

    def __init__(self, timeout: float, user_agent: str) -> None:
        self.timeout = timeout
        self.user_agent = user_agent
        self._playwright = None
        self._browser = None
        self._context = None
        self._pages_in_context = 0
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise RuntimeError("Playwright is not installed") from exc

        starter = async_playwright()
        try:
            # Every await of the start is inside the guard, including the
            # first: the scan's per-site deadline cancels a check wherever it
            # happens to be, and a Playwright whose start() never returned
            # keeps its driver process and pipes open with nothing holding
            # them. Each orphan is file descriptors the scan never gets back.
            self._playwright = await starter.start()
            self._browser = await self._playwright.chromium.launch(headless=True)
            self._context = await self._browser.new_context(user_agent=self.user_agent)
        except BaseException:
            await self.close()      # never leave a half-started browser running
            await _stop_starter(starter)
            raise
        self._pages_in_context = 0

    async def close(self) -> None:
        context, browser, playwright = self._context, self._browser, self._playwright
        self._context = self._browser = self._playwright = None
        self._pages_in_context = 0
        for closer in (context and context.close, browser and browser.close,
                       playwright and playwright.stop):
            if closer is None:
                continue
            try:
                await asyncio.wait_for(closer(), CLOSE_TIMEOUT)
            except Exception:  # noqa: BLE001 - shutting down; there is nothing left to save
                pass

    async def _fresh_context(self):
        """The context to open the next page in, replaced every so many pages."""
        if self._context is None:
            await self.start()
        elif self._pages_in_context >= RECYCLE_AFTER_PAGES:
            old = self._context
            self._context = await self._browser.new_context(user_agent=self.user_agent)
            self._pages_in_context = 0
            try:
                await asyncio.wait_for(old.close(), CLOSE_TIMEOUT)
            except Exception:  # noqa: BLE001
                pass
        return self._context

    async def fetch(self, url: str) -> tuple[str, str]:
        # Starting the browser is inside the lock: with 50 scan workers asking at
        # once, checking first and starting outside it launched one Chromium each.
        async with self._lock:
            context = await self._fresh_context()
            page = await context.new_page()
            self._pages_in_context += 1
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=int(self.timeout * 1000))
                content = await page.content()
                final_url = page.url
            finally:
                # Also on a timeout, an error, or a cancelled scan: an open page
                # stays in the browser, and a scan has hundreds of these to load.
                try:
                    await asyncio.wait_for(page.close(), CLOSE_TIMEOUT)
                except Exception:  # noqa: BLE001
                    pass
            return content, final_url

```

### Core Architecture Module: `src/aliens_eye/core/checkpoint.py`
```
"""Resumable scan checkpoints.

Each completed ``(variation, site)`` result is appended as one JSON line to a
checkpoint file. On resume, previously completed sites are skipped and their
results are reused, so a scan interrupted by Ctrl-C or a crash continues where it
left off instead of re-hitting every site.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any


class Checkpoint:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._lock = asyncio.Lock()
        # (variation, site) -> stored result dict
        self._done: dict[tuple[str, str], dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            for line in self.path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                self._done[(entry["variation"], entry["site"])] = entry["result"]
        except (OSError, json.JSONDecodeError, KeyError):
            # A corrupt/partial checkpoint is treated as empty rather than fatal.
            self._done = {}

    def is_done(self, variation: str, site: str) -> bool:
        return (variation, site) in self._done

    def results_for(self, variation: str) -> dict[str, dict[str, Any]]:
        """site -> result for every completed site of this variation."""
        return {
            site: result
            for (var, site), result in self._done.items()
            if var == variation
        }

    async def record(self, variation: str, site: str, result: dict[str, Any]) -> None:
        key = (variation, site)
        async with self._lock:
            if self._done.get(key) == result:
                return
            self._done[key] = result
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps({"variation": variation, "site": site, "result": result}) + "\n")

    def finalize(self) -> None:
        """Remove the checkpoint file once the scan has completed successfully."""
        try:
            self.path.unlink(missing_ok=True)
        except OSError:
            pass

```

### Core Architecture Module: `src/aliens_eye/core/config.py`
```
import json
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path

from platformdirs import user_cache_dir

from .sites import SiteRequest

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36"
)

def _supported_encodings() -> str:
    """Advertise only what this install can actually decode.

    Claiming ``br`` without a Brotli decoder present is not a degraded response,
    it is a hard failure: any server that honours it returns a body aiohttp
    raises on ("can not decode content-encoding: brotli"), so the site is scanned
    as an error rather than checked. Brotli is a declared dependency, but an
    existing environment may predate that, so the header is built from what is
    importable rather than assumed.
    """
    encodings = ["gzip", "deflate"]
    try:  # pragma: no cover - exercised by whichever branch the env provides
        import brotli  # noqa: F401
    except ImportError:
        try:
            import brotlicffi  # noqa: F401
        except ImportError:
            return ", ".join(encodings)
    encodings.append("br")
    return ", ".join(encodings)


# aiohttp defaults to 8190 bytes per header line. Real sites exceed that -- trakt
# ships a very large Link header of asset preloads -- and the request then fails
# with "Got more than 8190 bytes when reading" rather than returning a page.
MAX_HEADER_SIZE = 65536

DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": _supported_encodings(),
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}

_EN_ERROR_KEYWORDS = [
    "not found",
    "doesn't exist",
    "didn't find",
    "does not exist",
    "something went wrong",
    "no such user",
    "user not found",
    "cannot find",
    "can't find",
    "not exist",
    "profile not found",
    "account does not exist",
    "username not found",
    "no user found",
    "no results found",
    "no such username",
    "isn't available",
    "that content is unavailable",
    "page not found",
    "404",
    "404 error",
    "404 not found",
    "error",
    "sorry",
    "oops",
    "unavailable",
    "account suspended",
    "invalid username",
    "account not found",
    "account terminated",
    "account disabled",
    "user doesn't have an account",
    "this account doesn't exist",
    "page was not found",
]

_EN_POSITIVE_KEYWORDS = [
    "follow",
    "subscribe",
    "like",
    "share",
    "following",
    "followers",
    "profile",
    "user",
    "posts",
    "photos",
    "bio",
    "status",
    "tweets",
    "joined",
    "member since",
    "online",
    "verified",
    "active",
    "comments",
    "uploads",
    "reviews",
    "friends",
    "connections",
    "activity",
    "timeline",
]

_EN_META_KEYWORDS = [
    "profile picture",
    "profile image",
    "avatar",
    "user page",
    "username",
    "user profile",
    "account info",
    "account information",
    "user information",
]

def _merge_keywords(group: str, base: list[str]) -> list[str]:
    """Union the packaged multilingual keywords with the English base list.

    Falls back to the base list if data/keywords.json is missing or invalid.
    Matching is substring-on-lowercased-content, so keywords are lowercased and
    deduplicated while preserving order (English first).
    """
    merged: list[str] = []
    seen: set[str] = set()

    def _add(words) -> None:
        for word in words:
            key = str(word).strip().lower()
            if key and key not in seen:
                seen.add(key)
                merged.append(key)

    _add(base)
    try:
        text = (resources.files("aliens_eye.data") / "keywords.json").read_text("utf-8")
        data = json.loads(text)
        for lang_words in (data.get(group) or {}).values():
            _add(lang_words)
    except (FileNotFoundError, json.JSONDecodeError, OSError, AttributeError):
        pass
    return merged


ERROR_KEYWORDS = _merge_keywords("error", _EN_ERROR_KEYWORDS)
POSITIVE_KEYWORDS = _merge_keywords("positive", _EN_POSITIVE_KEYWORDS)
META_KEYWORDS = _merge_keywords("meta", _EN_META_KEYWORDS)

AUTH_PATTERNS = [
    "/login",
    "/signin",
    "/register",
    "/join",
    "auth",
    "oauth",
    "authenticate",
    "account/login",
    "session/new",
    "user/login",
    "members/login",
]

PROFILE_CLASS_HINTS = ["profile", "user", "account"]
ERROR_CLASS_HINTS = ["error", "not-found", "missing", "unavailable"]


DEFAULT_CATALOG = "extended"


def default_fingerprints_path() -> Path:
    return Path(user_cache_dir("aliens_eye")) / "fingerprints.json"


@dataclass
class ScannerConfig:
    concurrent: int = 50
    timeout: float = 10.0
    max_content_bytes: int = 100_000
    retries: int = 2
    backoff_base: float = 0.5
    backoff_cap: float = 8.0
    jitter: float = 0.2
    rate_limit_delay: float = 0.2
    fingerprints_path: Path = field(default_factory=default_fingerprints_path)
    output_dir: Path = Path("results")
    use_playwright: bool = False
    # For every Found, also ask the site for a username that cannot exist, and
    # downgrade to Maybe when both answers are the same page. One extra request
    # per site that reports Found.
    control_check: bool = True
    max_fingerprints_per_label: int = 50
    proxy: str | None = None
    include_sites: list[str] | None = None
    exclude_sites: list[str] | None = None
    exclude_nsfw: bool = False
    sites_path: Path | None = None
    model_path: Path | None = None
    use_ml: bool = True
    plain_output: bool = False
    only_found: bool = False
    json_stdout: bool = False
    explain: bool = False
    # Scans use the full verified catalog unless told otherwise; "standard"
    # is the smaller original list (also what evaluation and training read).
    catalog: str = DEFAULT_CATALOG
    include_tags: list[str] | None = None
    include_sources: list[str] | None = None
    request: SiteRequest | None = None

```

### Core Architecture Module: `src/aliens_eye/core/control.py`
```
"""Is this the page a site shows for a user who does not exist?

Many sites answer every profile address with HTTP 200: a JavaScript shell that
fills itself in later, a "no such user" page, a redirect to search. Such a page
names the username and carries profile-shaped markup, so scored on its own it
can look like a hit.

The scanner therefore asks the site a second question: what do you show for a
username that certainly does not exist? If the page for the searched username is
essentially that same page, the site has not told the two apart, and neither
can the scanner. This module is the comparison; the scanner decides what to do
with the answer.
"""

from __future__ import annotations

import re
import secrets
from collections import Counter
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from selectolax.lexbor import LexborHTMLParser

# A page counts as "the same page" at or above these. On the 286 training sites
# the pages wrongly reported as Found sit almost entirely at a similarity of
# 1.0 (45 of 52), so any threshold from 0.85 to 0.995 removes the same ones;
# 0.95 leaves room for a timestamp or a rotating recommendation. The length
# test is a guard for pages whose text matches while one carries far more data.
SAME_TEXT = 0.95
SAME_LENGTH = 0.85

# The server saying outright that there is no such page.
GONE_CODES = (404, 410)

# The server declining to answer: authentication walls, blocks, rate limits
# (419/420/429 and the like) and server failures. The body is an error page, so
# it can no more show that an account is missing than that it exists. Other 4xx
# codes stay out: a 400 or 422 is often a site's answer to an impossible name.
UNAVAILABLE_CODES = frozenset({401, 403, 407, 408, 419, 420, 425, 429, 451, 499, 999})


def http_unavailable(status_code: int) -> bool:
    """True when ``status_code`` means the site did not answer the question."""
    return status_code in UNAVAILABLE_CODES or 500 <= status_code < 600

_PLACEHOLDER = "\x00user\x00"
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)
_META_NAMES = ("description", "og:title", "og:description", "og:image", "og:url",
               "twitter:title", "twitter:description", "twitter:image", "profile:username")
_MAX_TOKENS = 6000


def control_username() -> str:
    """A handle that will not exist anywhere: 16 random lowercase characters."""
    return "zq" + secrets.token_hex(7)


@dataclass(frozen=True)
class PageShape:
    """What is compared between two pages of one site."""

    tokens: Counter
    length: int
    final_path: str     # where the request ended up, with the username masked


def _mask(text: str, username: str) -> str:
    """``text`` lowercased, with the username replaced by a fixed marker."""
    text = text.lower()
    name = username.lower()
    return text.replace(name, _PLACEHOLDER) if name else text


def page_shape(html: str, final_url: str, username: str) -> PageShape:
    """Reduce a page to what should differ between a real and a missing user."""
    parts: list[str] = []
    if html:
        tree = LexborHTMLParser(html)
        title = tree.css_first("title")
        if title is not None:
            parts.append(title.text() or "")
        for node in tree.css("meta[content]"):
            name = (node.attributes.get("property") or node.attributes.get("name") or "").lower()
            if name in _META_NAMES:
                parts.append(node.attributes.get("content") or "")
        for tag in ("script", "style", "noscript", "template", "svg"):
            for node in tree.css(tag):
                node.decompose()
        body = tree.body
        if body is not None:
            parts.append(body.text(separator=" "))
    tokens = _TOKEN_RE.findall(_mask(" ".join(parts), username))[:_MAX_TOKENS]
    try:
        parsed = urlparse(final_url)
        final_path = _mask(unquote(f"{parsed.netloc}{parsed.path}").rstrip("/"), username)
    except ValueError:
        final_path = ""
    return PageShape(Counter(tokens), len(html or ""), final_path)


def text_similarity(a: PageShape, b: PageShape) -> float:
    """Share of words the two pages have in common, 0 to 1. Two empty pages are equal."""
    total = sum(a.tokens.values()) + sum(b.tokens.values())
    if total == 0:
        return 1.0
    return 2 * sum((a.tokens & b.tokens).values()) / total


def length_ratio(a: PageShape, b: PageShape) -> float:
    longest = max(a.length, b.length)
    return 1.0 if longest == 0 else min(a.length, b.length) / longest


def http_overrule(status_code: int) -> tuple[str, str] | None:
    """What an HTTP error code makes of a page scored as Found: ``(status, reason)``.

    A 404 or 410 is the site's own answer and settles it. Any other error (a
    403 block page, a 500) is not a profile either, but says nothing about
    whether the account exists.
    """
    if status_code in GONE_CODES:
        return "Not Found", "http-gone"
    if status_code >= 400:
        return "Maybe", "http-error"
    return None


def same_page(page: PageShape, control: PageShape) -> bool:
    """True when ``page`` is, in effect, the page shown for a user who doesn't exist."""
    return text_similarity(page, control) >= SAME_TEXT and length_ratio(page, control) >= SAME_LENGTH

```

### Core Architecture Module: `src/aliens_eye/core/correlate.py`
```
"""Cross-site correlation: cluster Found/Maybe profiles that look like the same person.

Signals used per profile: avatar perceptual hash (dhash, requires Pillow via the
``[correlate]`` extra), normalized display name, tokenized bio, and external links
found in the bio. Profiles are linked by a union-find over pairwise similarity and
grouped into clusters ("likely the same person").

Avatar hashing is best-effort: if Pillow is missing or an image fails to download,
correlation still runs on name/bio/link signals alone.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from typing import Any

import aiohttp

from . import netguard
from .config import DEFAULT_HEADERS, ScannerConfig
from .scanner import build_connector

_URL_RE = re.compile(r"https?://[^\s\"'<>)]+", re.IGNORECASE)
_HANDLE_RE = re.compile(r"@([A-Za-z0-9_.]{2,30})")
_WORD_RE = re.compile(r"[a-z0-9]+")

# Similarity thresholds.
AVATAR_MAX_HAMMING = 8      # <= this many differing bits => same image
BIO_MIN_JACCARD = 0.5       # token overlap ratio to link on bio alone
LINK_MATCH_WEIGHT = True    # a shared external link links two profiles


@dataclass
class Profile:
    variation: str
    site: str
    name: str
    bio: str
    avatar: str
    url: str
    status: str
    avatar_hash: int | None = None
    links: set[str] = field(default_factory=set)
    handles: set[str] = field(default_factory=set)

    def __post_init__(self) -> None:
        # Derive links/handles from the bio when not supplied explicitly.
        if not self.links:
            self.links = set(_URL_RE.findall(self.bio or ""))
        if not self.handles:
            self.handles = {h.lower() for h in _HANDLE_RE.findall(self.bio or "")}

    @property
    def key(self) -> str:
        return f"{self.variation}:{self.site}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "variation": self.variation,
            "site": self.site,
            "name": self.name,
            "bio": self.bio,
            "avatar": self.avatar,
            "url": self.url,
            "status": self.status,
            "avatar_hash": format(self.avatar_hash, "016x") if self.avatar_hash is not None else None,
        }


def _norm_name(name: str) -> str:
    return " ".join(_WORD_RE.findall((name or "").lower()))


def _tokens(text: str) -> set[str]:
    return {w for w in _WORD_RE.findall((text or "").lower()) if len(w) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def profiles_from_report(
    report: dict[str, Any], statuses: frozenset[str] = frozenset({"Found"}),
) -> list[Profile]:
    """Extract profiles (with profile signals) from a report dict.

    Defaults to Found-only: the Maybe band is dominated by 403/404 bot-walls whose
    boilerplate would pollute correlation. Only a *structured* display name (see
    ``name_from_profile``) is used as an identity signal — a bare ``<title>``
    fallback is dropped so page chrome cannot cluster unrelated sites.
    """
    profiles: list[Profile] = []
    for variation, block in report.get("variations", {}).items():
        for site, info in (block.get("sites", {}) or {}).items():
            if info.get("status") not in statuses:
                continue
            prof = info.get("ai_analysis", {}).get("signals", {}).get("profile", {}) or {}
            bio = prof.get("bio", "") or ""
            identity_name = (prof.get("name", "") or "") if prof.get("name_from_profile") else ""
            p = Profile(
                variation=variation,
                site=site,
                name=identity_name,
                bio=bio,
                avatar=prof.get("avatar", "") or "",
                url=info.get("url", "") or "",
                status=info.get("status", ""),
                links=set(_URL_RE.findall(bio)),
                handles={h.lower() for h in _HANDLE_RE.findall(bio)},
            )
            profiles.append(p)
    return profiles


# --- avatar hashing -------------------------------------------------------

def _dhash(image_bytes: bytes) -> int | None:
    """8x8 difference hash of an image -> 64-bit int. None if Pillow/decoding fails."""
    try:
        import io

        from PIL import Image
    except ImportError:
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("L").resize((9, 8))
    except Exception:
        return None
    bits = 0
    for row in range(8):
        for col in range(8):
            left = img.getpixel((col, row))
            right = img.getpixel((col + 1, row))
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def _hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def pillow_available() -> bool:
    try:
        import PIL  # noqa: F401

        return True
    except ImportError:
        return False


async def is_fetchable_avatar(url: str, allow_private: bool = False) -> bool:
    """Whether an avatar URL is safe for this process to fetch.

    Avatar URLs are scraped from the target page (og:image, JSON-LD, a favicon
    link, or a per-site CSS selector), so they are chosen by whoever controls
    that page. See ``core.netguard`` for what is checked and why; note that this
    answers for the URL itself, and a fetch must still validate every redirect
    hop, which :func:`_download_and_hash` does through ``guarded_get``.
    """
    return await netguard.is_public_url(url, allow_private)


def avatar_url_allowed(url: str, allow_private: bool = False) -> bool:
    """Blocking twin of :func:`is_fetchable_avatar`, for synchronous callers."""
    return netguard.is_public_url_sync(url, allow_private)


async def _download_and_hash(
    session: aiohttp.ClientSession,
    profile: Profile,
    timeout: float,
    allow_private: bool = False,
) -> None:
    if not profile.avatar:
        return
    try:
        # guarded_get validates the URL and every redirect hop: a public avatar
        # URL that answers 302 to an internal address must not be followed.
        response = await netguard.guarded_get(
            session, profile.avatar, timeout=timeout, max_bytes=2_000_000,
            allow_private=allow_private,
        )
    except Exception:  # noqa: BLE001 - avatar hashing is best-effort
        return
    if response.status != 200:
        return
    profile.avatar_hash = _dhash(response.body)


async def hash_avatars(
    profiles: list[Profile],
    proxy: str | None = None,
    timeout: float = 10.0,
    allow_private: bool = False,
) -> None:
    """Download and dhash every profile avatar in place. No-op without Pillow."""
    if not pillow_available():
        return
    targets = [p for p in profiles if p.avatar]
    if not targets:
        return

    limit = min(20, len(targets))
    # The resolver pins the check to the address actually connected to.
    resolver = None if allow_private else netguard.PublicOnlyResolver()
    connector = build_connector(ScannerConfig(proxy=proxy), limit, resolver)
    sem = asyncio.Semaphore(limit)
    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS, connector=connector) as session:

        async def worker(p: Profile) -> None:
            async with sem:
                await _download_and_hash(session, p, timeout, allow_private)

        await asyncio.gather(*(worker(p) for p in targets))


# --- clustering -----------------------------------------------------------

class _UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _handle_link(a: Profile, b: Profile) -> bool:
    """Whether @-mentions tie two profiles together.

    Mentions of a handle that was *searched* carry no signal. Every profile in a
    scan of one handle was found under it, and many sites echo it in page chrome
    -- Twitter's description is "The latest posts from @handle". Counting that
    let a single such page link itself to every other profile in the scan: a
    live scan produced one 228-profile cluster, 227 of whose links ran through
    Twitter alone.

    So only two things count: both bios mentioning the same *third* handle, or a
    bio mentioning the handle the *other* profile was found under when the two
    were found under different handles.
    """
    own_a, own_b = a.variation.lower(), b.variation.lower()
    searched = {own_a, own_b} - {""}
    if (a.handles - searched) & (b.handles - searched):
        return True
    if own_a and own_b and own_a != own_b:
        return own_a in b.handles or own_b in a.handles
    return False


def _is_brand(norm_name: str, site: str) -> bool:
    """Whether a display name is just the site's own brand.

    A page with no real profile often carries the service's name as og:title
    ("Flickr" on flickr.albums), which is structured metadata but not an
    identity. Matching two of those linked sibling pages of the same service.
    """
    name = norm_name.replace(" ", "")
    site_key = "".join(_WORD_RE.findall((site or "").lower()))
    return bool(name) and bool(site_key) and (site_key.startswith(name) or name.startswith(site_key))


def _pair_reason(
    a: Profile, b: Profile, common_names: frozenset[str] = frozenset()
) -> str | None:
    """Return the reason two profiles are the same person, or None.

    ``common_names`` holds normalized names that are too frequent across the scan
    to be identifying (boilerplate / generic brand titles); a name in that set
    never links a pair.
    """
    if (
        a.avatar_hash is not None
        and b.avatar_ha
```

### Core Architecture Module: `src/aliens_eye/core/detector.py`
```
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class DetectionResult:
    status: str
    confidence: int
    score: float
    method: str
    probability: float | None
    diagnostics: dict[str, Any] = field(default_factory=dict)


# FALLBACK blend weight and probability thresholds, used only when no model is
# loaded or when a model file omits these fields. A loaded model overrides all
# three (see Detector.predict and MLModel.from_dict) -- the shipped
# data/model.json carries its own out-of-fold grid-searched values, so these
# constants do NOT describe the default runtime behaviour of the packaged tool.
# tests/test_detector.py pins the shipped model's values against the docs.
ML_WEIGHT = 0.4
HEURISTIC_WEIGHT = 0.6
HEURISTIC_SIGMOID_SCALE = 6.0
FOUND_THRESHOLD = 0.6
NOT_FOUND_THRESHOLD = 0.35


def _sigmoid(z: float) -> float:
    z = max(-50.0, min(50.0, z))
    return 1.0 / (1.0 + math.exp(-z))


class Detector:
    """Detection combining a trained ML model with heuristic scoring.

    Falls back to heuristics alone when no model is available.
    """

    def __init__(self) -> None:
        self.model = None

    def load_model(self, logger, model_path: Path | None = None) -> None:
        from aliens_eye.ml.inference import MLModel, ModelError

        try:
            self.model = MLModel.load(model_path)
            logger.debug("Loaded ML model (version %s)", self.model.version)
        except (FileNotFoundError, ModelError, OSError) as exc:
            self.model = None
            logger.debug("ML model unavailable, using heuristics only: %s", exc)

    def judges(self, features: dict[str, float]) -> tuple[float, float, float | None]:
        """Both judges, unblended: (heuristic_score, heuristic_prob, ml_prob).

        ml_prob is None when no model is loaded. Exposed so an ablation can
        weigh the two judges differently without reimplementing either -- see
        aliens_eye.eval.ablate. Mutates features["heuristic_score"], which
        the ML model consumes as an input feature.
        """
        heuristic_score = self._heuristic_score(features)
        heuristic_prob = _sigmoid(heuristic_score / HEURISTIC_SIGMOID_SCALE)
        features["heuristic_score"] = heuristic_score
        ml_prob = self.model.predict_proba(features) if self.model is not None else None
        return heuristic_score, heuristic_prob, ml_prob

    def predict(self, features: dict[str, float]) -> DetectionResult:
        heuristic_score, heuristic_prob, ml_prob = self.judges(features)

        if ml_prob is not None:
            ml_w = getattr(self.model, "ml_weight", ML_WEIGHT)
            probability = ml_w * ml_prob + (1.0 - ml_w) * heuristic_prob
            method = "ml+heuristic"
        else:
            probability = heuristic_prob
            method = "heuristic"

        found_thr = getattr(self.model, "found_threshold", FOUND_THRESHOLD) if self.model else FOUND_THRESHOLD
        not_found_thr = getattr(self.model, "not_found_threshold", NOT_FOUND_THRESHOLD) if self.model else NOT_FOUND_THRESHOLD
        status, confidence = self._status_from_probability(probability, found_thr, not_found_thr)
        return DetectionResult(
            status=status,
            confidence=confidence,
            score=heuristic_score,
            method=method,
            probability=round(probability, 4),
            diagnostics={
                "heuristic_probability": heuristic_prob,
                "ml_probability": ml_prob,
                "ml_weight": ml_w if ml_prob is not None else 0.0,
                "found_threshold": found_thr,
                "not_found_threshold": not_found_thr,
                "model_version": getattr(self.model, "version", None),
            },
        )

    def _heuristic_score(self, features: dict[str, float]) -> float:
        score = 0.0
        score -= features.get("error_keyword_count", 0.0) * 2
        score += features.get("positive_keyword_count", 0.0) * 1.5

        if features.get("http_200", 0.0) > 0:
            score += 5
        if features.get("http_404", 0.0) > 0:
            score -= 10
        if features.get("http_5xx", 0.0) > 0:
            score -= 3
        if features.get("http_3xx", 0.0) > 0:
            if features.get("has_auth_pattern", 0.0) > 0:
                score -= 3
            if features.get("has_username_in_path", 0.0) > 0:
                score += 2

        if features.get("has_username_in_path", 0.0) > 0 and features.get("is_homepage", 0.0) == 0:
            score += 3
        if features.get("is_homepage", 0.0) > 0 and features.get("http_200", 0.0) > 0:
            score -= 5

        # Redirected off a username-bearing URL to one that no longer has it: the
        # structural signature of a visitor/login/geo/bot-wall interstitial, not a
        # profile — regardless of language or the specific wording used.
        if features.get("redirect_count", 0.0) > 0 and features.get("has_username_in_path", 0.0) == 0:
            score -= 4

        score -= features.get("error_section_count", 0.0) * 3
        score += features.get("profile_section_count", 0.0) * 4

        if features.get("img_count", 0.0) > 5:
            score += 2
        if features.get("form_count", 0.0) > 0 and features.get("input_count", 0.0) > 2:
            score -= 2

        if features.get("meta_has_username", 0.0) > 0:
            score += 5
        score -= features.get("meta_error_keyword_count", 0.0) * 3
        score += features.get("meta_positive_keyword_count", 0.0) * 2

        score += features.get("fingerprint_match_found", 0.0) * 2
        score -= features.get("fingerprint_match_not_found", 0.0) * 2

        # Structured-data signals
        score += features.get("og_type_profile", 0.0) * 6
        score += features.get("has_json_ld_person", 0.0) * 5
        score += features.get("username_in_canonical", 0.0) * 4

        return score

    @staticmethod
    def _status_from_probability(
        probability: float,
        found_threshold: float = FOUND_THRESHOLD,
        not_found_threshold: float = NOT_FOUND_THRESHOLD,
    ) -> tuple[str, int]:
        if probability > found_threshold:
            status = "Found"
            distance = (probability - found_threshold) / (1.0 - found_threshold)
        elif probability < not_found_threshold:
            status = "Not Found"
            distance = (not_found_threshold - probability) / not_found_threshold
        else:
            status = "Maybe"
            center = (found_threshold + not_found_threshold) / 2
            half_band = (found_threshold - not_found_threshold) / 2
            distance = 1.0 - abs(probability - center) / half_band
            return status, int(50 + 20 * max(0.0, min(1.0, distance)))

        confidence = int(60 + 39 * max(0.0, min(1.0, distance)))
        return status, confidence

```

### Core Architecture Module: `src/aliens_eye/core/domains.py`
```
"""Domain availability check for a username.

For a username, test ``<username>.<tld>`` across a handful of common TLDs:
DNS resolution says whether the domain is registered/points somewhere, and an
HTTP request says whether it serves a live site. No third-party whois service or
API key is used — just DNS + HTTP.
"""

from __future__ import annotations

import asyncio
import re
import socket
from typing import Any

import aiohttp

from .config import DEFAULT_HEADERS, ScannerConfig
from .scanner import build_connector

DEFAULT_TLDS = ["com", "io", "net", "org", "dev", "me", "co", "app"]

_LABEL_RE = re.compile(r"[^a-z0-9-]")


def domain_label(username: str) -> str:
    """Reduce a username to a valid DNS label (lowercase alnum + hyphen)."""
    label = _LABEL_RE.sub("", username.lower().replace("_", "-").replace(".", "-"))
    return label.strip("-")


async def _resolves(host: str) -> bool:
    loop = asyncio.get_event_loop()
    try:
        await loop.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        return True
    except (socket.gaierror, OSError):
        return False


async def _is_live(session: aiohttp.ClientSession, host: str, timeout: float) -> bool:
    for scheme in ("https", "http"):
        try:
            async with session.get(
                f"{scheme}://{host}",
                timeout=aiohttp.ClientTimeout(total=timeout),
                allow_redirects=True,
            ) as resp:
                if resp.status < 500:
                    return True
        except Exception:
            continue
    return False


async def check_domains(
    username: str,
    tlds: list[str] | None = None,
    proxy: str | None = None,
    timeout: float = 8.0,
) -> dict[str, Any]:
    """Check ``<username>.<tld>`` registration + liveness for each TLD."""
    label = domain_label(username)
    tlds = tlds or DEFAULT_TLDS
    results: list[dict[str, Any]] = []
    if not label:
        return {"username": username, "label": label, "results": results}

    hosts = [f"{label}.{tld}" for tld in tlds]
    resolved = dict(zip(hosts, await asyncio.gather(*(_resolves(h) for h in hosts)), strict=False))

    connector = build_connector(ScannerConfig(proxy=proxy), len(hosts))
    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS, connector=connector) as session:
        live_flags = await asyncio.gather(
            *(
                _is_live(session, host, timeout) if resolved[host] else _false()
                for host in hosts
            )
        )

    for host, live in zip(hosts, live_flags, strict=False):
        results.append(
            {"domain": host, "registered": resolved[host], "live": bool(live)}
        )
    return {"username": username, "label": label, "results": results}


async def _false() -> bool:
    return False

```

### Core Architecture Module: `src/aliens_eye/core/expand.py`
```
"""Recursive expansion: mine linked usernames out of found profiles.

Given scan results, pull candidate usernames from each Found/Maybe profile's bio
(``@handle`` mentions) and external links that are profile URLs on any site in
the catalogue. These feed another scan hop.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

_HANDLE_RE = re.compile(r"@([A-Za-z0-9_.]{2,30})")
_URL_RE = re.compile(r"https?://[^\s\"'<>)]+", re.IGNORECASE)

@lru_cache(maxsize=1)
def _catalogue() -> tuple[tuple[str, str], ...]:
    from .config import DEFAULT_CATALOG
    from .scanner import load_sites_data

    return tuple(sorted(load_sites_data(catalog=DEFAULT_CATALOG).items()))


def _username_from_url(url: str) -> str | None:
    """The username a profile link points at, for any site in the catalogue.

    This used to recognise 19 hard-coded domains by taking the first path
    segment. It now reverse-matches the link against every catalogue template
    (see ``core.urlmatch``), so ``linkedin.com/in/<user>`` or
    ``<user>.tumblr.com`` are understood and ``github.com/<user>/<repo>`` is
    correctly not taken for a profile.
    """
    from .urlmatch import matcher_for

    matches = matcher_for(dict(_catalogue())).match(url)
    return matches[0].username if matches else None


def candidate_usernames_from_results(
    all_results: dict[str, list[dict[str, Any]]],
    exclude: set[str] | None = None,
    limit: int = 25,
) -> list[str]:
    """Collect deduped candidate usernames linked from Found/Maybe profiles."""
    exclude = {e.lower() for e in (exclude or set())}
    found: list[str] = []
    seen: set[str] = set()

    def _add(name: str) -> None:
        name = name.strip()
        low = name.lower()
        if len(name) < 2 or low in exclude or low in seen:
            return
        seen.add(low)
        found.append(name)

    for results in all_results.values():
        for item in results:
            if item.get("status") not in {"Found", "Maybe"}:
                continue
            profile = item.get("ai_analysis", {}).get("signals", {}).get("profile", {}) or {}
            bio = profile.get("bio", "") or ""
            for handle in _HANDLE_RE.findall(bio):
                _add(handle)
            for url in _URL_RE.findall(bio):
                uname = _username_from_url(url)
                if uname:
                    _add(uname)

    return found[:limit]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #28** (2026-11-02): **Stupa Borobudur like ufo**
  *Symptoms*: 

- **Issue #27** (2026-10-26): **Rename project from AI-OSINT to AI-MMA**
  *Symptoms*: 

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

### Incident Patch 1: `7d8b79c2` (2026-10-19)
**Commit Message**: fix: the browser fallback launched many Chromiums and leaked pages (#26); release 2.7.2

fetch() checked whether the browser was started before taking its lock, so with
50 scan workers asking at once each launched its own Chromium and only the last
was closed. A page that timed out, failed to load or was cancelled by the
per-site deadline was never closed.

Start inside the lock, close every page in a finally, replace the context every
40 pages, and shut down a browser that fails halfway through starting.

Real Chromium: 20 simultaneous fetches, half to a page that never finishes
loading, use one browser (4 processes) and 341 MB, and leave nothing open.
The old code passed 1.5 GB with 8 simultaneous fetches.

**File**: `CHANGELOG.md` (modified, +22/-0)
```diff
@@ -1,5 +1,27 @@
 # Changelog
 
+## 2.7.2 (2026-10-19)
+
+### Fixed
+- **The browser fallback could start dozens of Chromium processes and keep pages open
+  forever** (#26, a Mac that ran out of memory with the fallback switched on). The fallback
+  (`--playwright`, or "fallback" in the interactive settings) re-checks every "Maybe" result
+  in a real browser. Two bugs in it:
+  - The browser was started on first use, and the check for "already started" ran before the
+    lock that guards it. With 50 scan workers asking at once, each one launched its own
+    Chromium, and only the last was ever closed.
+  - A page that timed out, failed to load, or was cancelled by the scan's deadline was never
+    closed, so a scan accumulated hundreds of open pages.
+
+  The browser now starts once, every page is closed whatever happens, the browser context is
+  replaced every 40 pages so its memory is returned, and a browser that fails halfway through
+  starting is shut down. Checked against a real Chromium: 20 simultaneous fetches, half to a
+  page that never finishes loading, now use one browser (4 processes), 341 MB at most, and
+  leave no page open and no process running after the scan. The old code, given only 8
+  simultaneous fetches, passed 1.5 GB in seconds.
+
+  Scans without the fallback were never affected.
+
 ## 2.7.1 (2026-10-19)
 
 ### Added
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "aliens-eye"
-version = "2.7.1"
+version = "2.7.2"
 description = "AI-powered OSINT username scanner across 800+ social media and web platforms"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `src/aliens_eye/__init__.py` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 """Aliens Eye - AI-powered OSINT username scanner."""
 
-__version__ = "2.7.1"
+__version__ = "2.7.2"
```

**File**: `src/aliens_eye/core/browser.py` (modified, +57/-16)
```diff
@@ -1,15 +1,24 @@
 import asyncio
 
+# A browser holds on to memory for every page it has ever rendered, closed or not.
+# Replacing its context now and then hands that memory back to the system.
+RECYCLE_AFTER_PAGES = 40
+CLOSE_TIMEOUT = 5.0
+
 
 class BrowserFallback:
-    """Playwright-based fallback for hard pages."""
+    """Playwright-based fallback for hard pages.
+
+    Starts one browser, on first use, and shows it one page at a time.
+    """
 
     def __init__(self, timeout: float, user_agent: str) -> None:
         self.timeout = timeout
         self.user_agent = user_agent
         self._playwright = None
         self._browser = None
         self._context = None
+        self._pages_in_context = 0
         self._lock = asyncio.Lock()
 
     async def start(self) -> None:
@@ -19,25 +28,57 @@ async def start(self) -> None:
             raise RuntimeError("Playwright is not installed") from exc
 
         self._playwright = await async_playwright().start()
-        self._browser = await self._playwright.chromium.launch(headless=True)
-        self._context = await self._browser.new_context(user_agent=self.user_agent)
+        try:
+            self._browser = await self._playwright.chromium.launch(headless=True)
+            self._context = await self._browser.new_context(user_agent=self.user_agent)
+        except BaseException:
+            await self.close()      # never leave a half-started browser running
+            raise
+        self._pages_in_context = 0
 
     async def close(self) -> None:
-        if self._context:
-            await self._context.close()
-        if self._browser:
-            await self._browser.close()
-        if self._playwright:
-            await self._playwright.stop()
+        context, browser, playwright = self._context, self._browser, self._playwright
+        self._context = self._browser = self._playwright = None
+        self._pages_in_context = 0
+        for closer in (context and context.close, browser and browser.close,
+                       playwright and playwright.stop):
+            if closer is None:
+                continue
+            try:
+                await asyncio.wait_for(closer(), CLOSE_TIMEOUT)
+            except Exception:  # noqa: BLE001 - shutting down; there is nothing left to save
+                pass
 
-    async def fetch(self, url: str) -> tuple[str, str]:
-        if not self._context:
+    async def _fresh_context(self):
+        """The context to open the next page in, replaced every so many pages."""
+        if self._context is None:
             await self.start()
+        elif self._pages_in_context >= RECYCLE_AFTER_PAGES:
+            old = self._context
+            self._context = await self._browser.new_context(user_agent=self.user_agent)
+            self._pages_in_context = 0
+            try:
+                await asyncio.wait_for(old.close(), CLOSE_TIMEOUT)
+            except Exception:  # noqa: BLE001
+                pass
+        return self._context
 
+    async def fetch(self, url: str) -> tuple[str, str]:
+        # Starting the browser is inside the lock: with 50 scan workers asking at
+        # once, checking first and starting outside it launched one Chromium each.
         async with self._lock:
-            page = await self._context.new_page()
-            await page.goto(url, wait_until="domcontentloaded", timeout=int(self.timeout * 1000))
-            content = await page.content()
-            final_url = page.url
-            await page.close()
+            context = await self._fresh_context()
+            page = await context.new_page()
+            self._pages_in_context += 1
+            try:
+                await page.goto(url, wait_until="domcontentloaded", timeout=int(self.timeout * 1000))
+                content = await page.content()
+                final_url = page.url
+            finally:
+                # Also on a timeout, an error, or a cancelled scan: an open page
+                # stays in the browser, and a scan has hundreds of these to load.
+                try:
+                    await asyncio.wait_for(page.close(), CLOSE_TIMEOUT)
+                except Exception:  # noqa: BLE001
+                    pass
             return content, final_url
```

**File**: `tests/test_browser.py` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+"""The Playwright fallback must not leak browsers or pages (#26).
+
+A scan that reported 40+ GB of memory on a laptop had the fallback switched on.
+Chromium is the likely holder: every "Maybe" result opens a page, and a scan has
+hundreds. These tests use a fake Playwright, so they need no browser.
+"""
+
+import asyncio
+import sys
+import types
+
+import pytest
+
+from aliens_eye.core.browser import BrowserFallback
+
+
+class FakePage:
+    def __init__(self, world, fail=None, hang=False):
+        self.world, self.fail, self.hang = world, fail, hang
+        self.url = "https://example.test/final"
+        self.closed = False
+
+    async def goto(self, url, **kwargs):
+        self.world.open_pages.add(self)
+        self.world.peak_open = max(self.world.peak_open, len(self.world.open_pages))
+        if self.hang:
+            await asyncio.sleep(3600)
+        if self.fail:
+            raise self.fail
+        await asyncio.sleep(0.01)
+
+    async def content(self):
+        return "<html>ok</html>"
+
+    async def close(self):
+        self.closed = True
+        self.world.open_pages.discard(self)
+
+
+class FakeContext:
+    def __init__(self, world):
+        self.world, self.closed = world, False
+
+    async def new_page(self):
+        self.world.pages_created += 1
+        mode = self.world.next_page_mode()
+        page = FakePage(self.world, **mode)
+        self.world.all_pages.append(page)
+        return page
+
+    async def close(self):
+        self.closed = True
+        # Closing a context closes its pages.
+        for page in list(self.world.open_pages):
+            page.closed = True
+            self.world.open_pages.discard(page)
+
+
+class FakeBrowser:
+    def __init__(self, world):
+        self.world, self.closed = world, False
+
+    async def new_context(self, **kwargs):
+        context = FakeContext(self.world)
+        self.world.contexts.append(context)
+        return context
+
+    async def close(self):
+        self.closed = True
+
+
+class FakeChromium:
+    def __init__(self, world):
+        self.world = world
+
+    async def launch(self, **kwargs):
+        await asyncio.sleep(0.05)       # starting a real browser takes a while
+        browser = FakeBrowser(self.world)
+        self.world.browsers.append(browser)
+        return browser
+
+
+class FakePlaywright:
+    def __init__(self, world):
+        self.chromium = FakeChromium(world)
+
+    async def stop(self):
+        pass
+
+
+class World:
+    def __init__(self):
+        self.browsers, self.contexts, self.all_pages = [], [], []
+        self.open_pages, self.peak_open, self.pages_created = set(), 0, 0
+        self.modes = []
+
+    def next_page_mode(self):
+        return self.modes.pop(0) if self.modes else {}
+
+
+@pytest.fixture
+def world(monkeypatch):
+    world = World()
+
+    class Starter:
+        async def start(self):
+            await asyncio.sleep(0.05)
+            return FakePlaywright(world)
+
+    module = types.ModuleType("playwright.async_api")
+    module.async_playwright = lambda: Starter()
+    package = types.ModuleType("playwright")
+    package.async_api = module
+    monkeypatch.setitem(sys.modules, "playwright", package)
+    monkeypatch.setitem(sys.modules, "playwright.async_api", module)
+    return world
+
+
+async def test_concurrent_first_fetches_start_one_browser(world):
+    """Regression: 50 workers hitting a Maybe together each launched a Chromium."""
+    fallback = BrowserFallback(timeout=5, user_agent="test")
+    await asyncio.gather(*(fallback.fetch(f"https://example.test/{i}") for i in range(30)))
+    assert len(world.browsers) == 1
+    assert len(world.contexts) == 1
+    await fallback.close()
+    assert world.browsers[0].closed
+
+
+async def test_a_page_that_fails_to_load_is_still_closed(world):
+    world.modes = [{"fail": RuntimeError("net::ERR_TIMED_OUT")}]
+    fallback = BrowserFallback(timeout=5, user_agent="test")
+    with pytest.raises(RuntimeError):
+        await fallback.fetch("https://example.test/a")
+    assert world.all_pages[0].closed
+    assert world.open_pages == set()
+
+
+async def test_a_cancelled_fetch_closes_its_page(world):
+    """The scan gives each site a deadline and cancels it; the page must not outlive that."""
+    world.modes = [{"hang": True}]
+    fallback = BrowserFallback(timeout=5, user_agent="test")
+    task = asyncio.create_task(fallback.fetch("https://example.test/slow"))
+    await asyncio.sleep(0.3)
+    task.cancel()
+    with pytest.raises(asyncio.CancelledError):
+        await task
+    assert world.all_pages[0].closed
+    assert world.open_pages == set()
+
+
+async def test_one_page_is_open_at_a_time(world):
+    fallback = BrowserFallback(timeout=5, user_agent="test")
+    await asyncio.gather(*(fallback.fetch(f"https://example.test/{i}") for i in range(20)))
+    assert world.peak_open == 1
+
+
+async def test_the_context_is_recycled_so_browser_memory_stays_bounded(worl
```

---

### Incident Patch 2: `7c1c1d08` (2026-11-07)
**Commit Message**: fix: error pages cannot report an account missing (2.9.1)

A site answering with a block, rate limit or server error (401, 403,
407, 408, 419, 420, 425, 429, 451, 499, 999, 5xx) serves an error page,
not its "no such user" page, but the detector could still score it Not
Found. Hacker News answered HTTP 419 for every username, so a real
account was reported missing. Those responses are now Maybe
(http_unavailable) in scans, site-rule checks and the self-check, and
are no longer stored as "not found" fingerprints. 404/410 still mean
Not Found.

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -1,5 +1,15 @@
 # Changelog
 
+## 2.9.1 (2026-11-07)
+
+### Fixed
+- **A rate-limit or block page no longer reports an account as missing.** A site answering
+  401, 403, 407, 408, 419, 420, 425, 429, 451, 499, 999 or 5xx serves an error page, not its
+  "no such user" page, yet the detector could still score it Not Found: Hacker News answered
+  HTTP 419 for every username and a real account was reported missing. Those responses are
+  now Maybe (`http_unavailable`) in scans, site-rule checks and the self-check; 404/410 still
+  mean Not Found. Such pages are also no longer stored as "not found" fingerprints.
+
 ## 2.9.0 (2026-11-07)
 
 ### Changed
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "aliens-eye"
-version = "2.9.0"
+version = "2.9.1"
 description = "AI-powered OSINT username scanner across 7,700+ social media and web platforms"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `src/aliens_eye/__init__.py` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 """Aliens Eye - AI-powered OSINT username scanner."""
 
-__version__ = "2.9.0"
+__version__ = "2.9.1"
```

**File**: `src/aliens_eye/core/control.py` (modified, +11/-0)
```diff
@@ -33,6 +33,17 @@
 # The server saying outright that there is no such page.
 GONE_CODES = (404, 410)
 
+# The server declining to answer: authentication walls, blocks, rate limits
+# (419/420/429 and the like) and server failures. The body is an error page, so
+# it can no more show that an account is missing than that it exists. Other 4xx
+# codes stay out: a 400 or 422 is often a site's answer to an impossible name.
+UNAVAILABLE_CODES = frozenset({401, 403, 407, 408, 419, 420, 425, 429, 451, 499, 999})
+
+
+def http_unavailable(status_code: int) -> bool:
+    """True when ``status_code`` means the site did not answer the question."""
+    return status_code in UNAVAILABLE_CODES or 500 <= status_code < 600
+
 _PLACEHOLDER = "\x00user\x00"
 _TOKEN_RE = re.compile(r"\w+", re.UNICODE)
 _META_NAMES = ("description", "og:title", "og:description", "og:image", "og:url",
```

**File**: `src/aliens_eye/core/scanner.py` (modified, +7/-1)
```diff
@@ -14,7 +14,7 @@
 from .analyzer import FeatureExtractor
 from .browser import BrowserFallback
 from .config import DEFAULT_HEADERS, MAX_HEADER_SIZE, ScannerConfig
-from .control import PageShape, control_username, http_overrule, page_shape, same_page
+from .control import PageShape, control_username, http_overrule, http_unavailable, page_shape, same_page
 from .detector import Detector
 from .explain import build_explanation, detector_evidence
 from .fingerprints import FingerprintStore, build_fingerprint
@@ -671,6 +671,12 @@ async def _scan_site(
                 if checks["browser"]["outcome"] == "selected":
                     details = checks["browser"]["detector"]
 
+            # The mirror image: a block, rate limit or server error page is not
+            # the site's "no such user" page, so it cannot carry "Not Found".
+            if status_text == "Not Found" and http_unavailable(fetch.status):
+                status_text, confidence, reason = "Maybe", min(confidence, 50), "http_unavailable"
+                ai_analysis["method"] = f"{ai_analysis['method']}-http-unavailable"
+
             # "Found" claims an account exists, and the score alone cannot carry
             # that: a page is scored on how profile-like it looks, and error
             # pages, challenge pages and empty JavaScript shells can look the part.
```

**File**: `src/aliens_eye/core/site_rules.py` (modified, +4/-2)
```diff
@@ -6,7 +6,7 @@
 from dataclasses import replace
 from urllib.parse import urljoin
 
-from .control import page_shape, same_page
+from .control import http_unavailable, page_shape, same_page
 from .explain import build_explanation, detector_evidence
 from .sites import SiteDefinition
 
@@ -15,7 +15,7 @@ def rule_evidence(site: SiteDefinition, response) -> dict:
     verdict, reason, strength = None, "no_rule_evidence", "none"
     presence = [s for s in site.presence if s in response.content]
     absence = [s for s in site.absence if s in response.content]
-    if response.error or response.status in (401, 403, 408, 429) or response.status >= 500:
+    if response.error or http_unavailable(response.status):
         reason = "http_unavailable"
     elif response.status in (404, 410):
         verdict, reason, strength = "Not Found", "http_gone", "explicit"
@@ -160,6 +160,8 @@ async def scan_defined_site(scanner, site: SiteDefinition, username, session, ra
                 reason = "http_gone" if response.status in (404, 410) else "rule_absence"
             elif evidence["verdict"] is None and site.check_type is not None:
                 status, confidence, reason = "Maybe", 50, evidence["reason"]
+            elif status == "Not Found" and http_unavailable(response.status):
+                status, confidence, reason = "Maybe", min(confidence, 50), "http_unavailable"
 
             if status == "Found" and scanner.config.control_check:
                 key = site.fingerprint
```

**File**: `src/aliens_eye/selfcheck.py` (modified, +3/-1)
```diff
@@ -25,7 +25,7 @@
 
 from aliens_eye.core.analyzer import FeatureExtractor
 from aliens_eye.core.config import ScannerConfig
-from aliens_eye.core.control import PageShape, control_username, page_shape, same_page
+from aliens_eye.core.control import PageShape, control_username, http_unavailable, page_shape, same_page
 from aliens_eye.core.detector import Detector
 from aliens_eye.core.http import fetch_url
 from aliens_eye.core.rate_limit import DomainRateLimiter
@@ -192,6 +192,8 @@ async def check(site: str, url: str, username: str, label: int) -> None:
             bundle.features["fingerprint_match_not_found"] = 0.0
             detection = detector.predict(bundle.features)
             status, note = detection.status, detection.method
+            if status == "Not Found" and not detector_only and http_unavailable(fetch.status):
+                status, note = "Maybe", f"{note}-http-unavailable"
             if status == "Found" and not detector_only:
                 async def same_as_missing_user() -> bool:
                     if site not in controls:     # one fetch per site, shared by its rows
```

**File**: `tests/test_scanner.py` (modified, +46/-0)
```diff
@@ -316,3 +316,49 @@ async def fetch(session, url, config, rate_limiter, log):
     by_site = {r["site"]: r for r in results}
     assert by_site["alpha"]["status"] == "Found"
     assert by_site["beta"]["status"] == "Timeout" and by_site["beta"]["code"] == 408
+
+
+@pytest.mark.parametrize("code", [401, 403, 419, 429, 503])
+async def test_an_error_page_cannot_report_an_account_missing(code, not_found_html, tmp_path, logger):
+    """A rate-limit or block page is not the site's "no such user" page.
+
+    Seen live: Hacker News answered HTTP 419 for every username, and a real
+    account was reported as Not Found.
+    """
+    from aliens_eye.core.sites import SiteCatalog, SiteDefinition
+
+    app = web.Application()
+
+    async def page(request):
+        return web.Response(text=not_found_html, status=code, content_type="text/html")
+
+    app.router.add_get("/u/{username}", page)
+    server = TestServer(app)
+    await server.start_server()
+    template = f"http://{server.host}:{server.port}/u/{{}}"
+    try:
+        [legacy] = await make_scanner({"limited": template}, tmp_path, logger).scan_all_sites("torvalds")
+    finally:
+        await server.close()
+
+    # Site definitions refuse private addresses, so the rule path gets a fake fetch.
+    from aliens_eye.core.http import FetchResult
+    from aliens_eye.core.site_rules import scan_defined_site
+
+    async def fetch(session, url, config, limiter, log):
+        return FetchResult(url, url, code, not_found_html, 0.1, {"Content-Type": "text/html"}, None, 0)
+
+    site = SiteDefinition.from_dict("limited", {"url": "https://limited.example/u/{}"})
+    scanner = make_scanner(SiteCatalog({"limited": site}), tmp_path, logger)
+    scanner.fetch = fetch
+    structured = await scan_defined_site(scanner, site, "torvalds", None, None)
+
+    for result in (legacy, structured):
+        assert result["status"] == "Maybe", result["ai_analysis"].get("method")
+        assert result["code"] == code
+        assert "http_unavailable" in result["ai_analysis"]["explanation"]["reason_codes"]
+
+
+async def test_a_404_is_still_the_sites_own_answer(site_server, tmp_path, logger):
+    [result] = await make_scanner({"beta": server_sites(site_server)["beta"]}, tmp_path, logger).scan_all_sites("x")
+    assert result["status"] == "Not Found"
```

---

### Incident Patch 3: `a1fc7bb8` (2026-10-08)
**Commit Message**: fix: give every site's check an overall deadline

Each attempt has a timeout and each wait is capped, but a scan still waits for
its slowest site, and one check that never returns holds it open. A check that
runs past the deadline is reported as Timeout.

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@
   for an hour (and the wait was applied twice). The header is the server's to set, so it is
   now honoured only up to the retry backoff cap (8 seconds); a site asking for longer is
   reported as an error and not asked again.
+- Every site's check now has an overall deadline (about 80 seconds with default settings),
+  after which it is reported as `Timeout`. A scan is only as fast as its slowest site, and
+  a check that never returned kept the whole scan open.
 - Cancelling a scan from code that uses the API (for example with a timeout) left its
   worker tasks running.
 
```

**File**: `src/aliens_eye/core/scanner.py` (modified, +31/-2)
```diff
@@ -329,10 +329,25 @@ async def _worker(
             except asyncio.CancelledError:
                 break
             try:
-                result = await self._scan_site(
-                    site, tmpl, username, session, rate_limiter
+                result = await asyncio.wait_for(
+                    self._scan_site(site, tmpl, username, session, rate_limiter),
+                    self._site_deadline(),
                 )
                 results.append(result)
+            except asyncio.TimeoutError:
+                url = self._format_url(site, tmpl, username)
+                self.logger.debug("Gave up on %s after %.0fs", site, self._site_deadline())
+                result = {
+                    "site": site,
+                    "url": url,
+                    "final_url": url,
+                    "status": "Timeout",
+                    "code": 408,
+                    "response_time": 0.0,
+                    "confidence": 0,
+                    "ai_analysis": {"error": "no answer within the per-site deadline"},
+                }
+                results.append(result)
             except Exception as exc:
                 url = self._format_url(site, tmpl, username)
                 self.logger.debug("Worker failed for %s: %s", site, exc)
@@ -363,6 +378,20 @@ async def _worker(
             view.advance(found)
             queue.task_done()
 
+    def _site_deadline(self) -> float:
+        """Longest one site's check may take, whatever goes wrong inside it.
+
+        Every attempt has its own timeout and every wait between attempts is
+        capped, so a healthy check ends well inside this. It exists for the
+        cases those bounds miss: a scan is only as fast as its slowest site, and
+        one that never returns holds the whole scan open.
+        """
+        config = self.config
+        budget = (config.retries + 1) * (config.timeout + config.backoff_cap + config.jitter)
+        if config.use_playwright and self.browser_fallback is not None:
+            budget += 60.0
+        return budget * 1.5 + 1.0
+
     async def _scan_site(
         self,
         site_name: str,
```

**File**: `tests/test_scanner.py` (modified, +23/-0)
```diff
@@ -230,3 +230,26 @@ async def stall(request):
         assert left == []
     finally:
         await server.close()
+
+
+async def test_one_site_that_never_answers_cannot_hold_up_the_scan(site_server, tmp_path, logger):
+    """A real scan sat on its last request for half an hour. Whatever the cause
+    inside one site's check, the scan moves on after a bounded wait."""
+    import asyncio
+
+    from aliens_eye.core.http import fetch_url
+
+    scanner = make_scanner(server_sites(site_server), tmp_path, logger)
+    scanner.config.timeout = 0.2
+    scanner.config.backoff_cap = 0.0
+
+    async def fetch(session, url, config, rate_limiter, log):
+        if "/beta/" in url:
+            await asyncio.sleep(3600)      # ignores every timeout the HTTP layer has
+        return await fetch_url(session, url, config, rate_limiter, log)
+
+    scanner.fetch = fetch
+    results = await asyncio.wait_for(scanner.scan_all_sites("torvalds"), 10)
+    by_site = {r["site"]: r for r in results}
+    assert by_site["alpha"]["status"] == "Found"
+    assert by_site["beta"]["status"] == "Timeout" and by_site["beta"]["code"] == 408
```

#### Recent Merged Pull Requests:
- **PR #27** (closed): Rename project from AI-OSINT to AI-MMA (@ox5qmuteb-dotcom)
- **PR #24** (closed): docs: add OTinstaller as an install option (@Sushant-69x)
- **PR #23** (2026-10-07): Use the Lexbor parser of selectolax (fix ImportError with selectolax 1.0) (@cristianchiriac)
- **PR #20** (closed): feat: add site-specific detection profiles (@kenuseszaza-maker)
- **PR #19** (2026-10-07): feat: add name-based Chinese platforms and downgrade bot-wall false positives (@BBmmo-code)
- **PR #16** (2026-07-01): V2 upgrade (@arxhr007)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. the browser fallback launched many Chromiums and leaked pages; release 2.7.2

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in arxhr007/Aliens_eye. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7d8b79c2`: the browser fallback launched many Chromiums and leaked pages; release 2.7.2. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
## 2.7.2 (2026-10-19)

### Fixed
- **The browser fallback could start dozens of Chromium processes and keep pages open
  forever** (#26, a Mac that ran out of memory with the fallback switched on). The fallback
  (`--playwright`, or "fallback" in the interactive settings) re-checks every "Maybe" result
  in a real browser. Two bugs in it:
  - The browser was started on first use, and the check for "already started" ran before the
    lock that guards it. With 50 scan workers asking at once, each one launched its own
    Chromium, and only the last was ever closed.
  - A page that timed out, failed to load, or was cancelled by the scan's deadline was never
    closed, so a scan accumulated hundreds of open pages.

  The browser now starts once, every page is closed whatever happens, the browser context is
  replaced every 40 pages so its memory is returned, and a browser that fails halfway through
  starting is shut down. Checked against a real Chromium: 20 simultaneous fetches, half to a
  page that never finishes loading, now use one browser (4 processes), 341 MB at most, and
  leave no page open and no process running after the scan. The old code, given only 8
  simultaneous fetc
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7d8b79c2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

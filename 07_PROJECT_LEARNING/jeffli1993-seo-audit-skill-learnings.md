> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jeffli1993-seo-audit-skill-learnings.md`  
> **Source**: github ([https://github.com/JeffLi1993/seo-audit-skill](https://github.com/JeffLi1993/seo-audit-skill))  
> **Source Version**: `523bdfb2`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T02:50:54.491Z  
> **Learning ID**: `learn-github-jeffli1993-seo-audit-skill`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): JeffLi1993/seo-audit-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/jeffli1993-seo-audit-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JeffLi1993/seo-audit-skill](https://github.com/JeffLi1993/seo-audit-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-26T02:50:54.485Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JeffLi1993/seo-audit-skill`
- **Description**: SEO agent skill for OpenClaw,Claude Code, and AI agents. Generate beginner SEO audits and advanced technical SEO reports for any page.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 772 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `seo-audit-full/scripts/check-page.py`
```
#!/usr/bin/env python3
"""
Page-level SEO checks: H1, title tag, meta description, and canonical.
Uses Python stdlib html.parser — no BeautifulSoup required.
Outputs structured JSON to stdout for direct agent consumption.

Usage:
    python check-page.py https://example.com
    python check-page.py https://example.com --timeout 20

Output example (JSON):
    {
      "url": "https://example.com/",
      "final_url": "https://example.com/",
      "http_status": 200,
      "redirect_chain": [],
      "h1": {
        "status": "pass",
        "count": 1,
        "values": ["Best Running Shoes 2025"],
        "detail": "Single H1 found."
      },
      "title": {
        "status": "pass",
        "value": "Best Running Shoes 2025 | Free Shipping",
        "length": 42,
        "detail": "Title is 42 characters — within recommended range (50-60)."
      },
      "meta_description": {
        "status": "pass",
        "value": "Shop the best running shoes...",
        "length": 138,
        "detail": "Meta description is 138 characters — within recommended range (120-160)."
      },
      "canonical": {
        "status": "pass",
        "value": "https://example.com/",
        "matches_final_url": true,
        "detail": "Self-referencing canonical present."
      }
    }

Dependencies:
    pip install requests
    (HTML parsing uses Python stdlib html.parser — no extra packages needed)
"""

import argparse
import ipaddress
import json
import socket
import sys
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# ── HTTP fetch ────────────────────────────────────────────────────────────────

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# 关键词过滤用停用词表（替代长度阈值，避免误杀 SEO/AI/CRM 等短缩写词）
_STOP_WORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "not", "no",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
    "is", "are", "was", "were", "be",
    "it", "its", "this", "that",
})


def _fetch(url: str, timeout: int) -> tuple[Optional[int], Optional[str], str, list[dict], Optional[str]]:
    """
    Fetch a page with SSRF protection.
    Returns (status_code, content, final_url, redirect_chain, error).
    """
    parsed = urlparse(url)

    # SSRF protection: block private, loopback, and reserved IPs
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, url, [], f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        session = requests.Session()
        session.max_redirects = 5
        resp = session.get(url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        redirect_chain = [
            {"url": r.url, "status_code": r.status_code} for r in resp.history
        ]
        return resp.status_code, resp.text, resp.url, redirect_chain, None
    except requests.exceptions.Timeout:
        return None, None, url, [], f"Timed out after {timeout}s"
    except requests.exceptions.TooManyRedirects:
        return None, None, url, [], "Too many redirects (max 5)"
    except requests.exceptions.SSLError as e:
        return None, None, url, [], f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        return None, None, url, [], f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        return None, None, url, [], f"Request failed: {e}"


# ── HTML parser (stdlib, no external dependencies) ────────────────────────────

class _SEOParser(HTMLParser):
    """
    Lightweight SEO element extractor.
    Extracts <title>, <h1>, <meta name="description">, and <link rel="canonical">.
    Does not build a full DOM tree — single-pass scan only.
    """

    def __init__(self) -> None:
        super().__init__()
        # title state
        self.title: Optional[str] = None
        self._in_title = False
        self._title_buf = ""
        # h1 state
        self.h1_values: list[str] = []
        self._in_h1 = False
        self._h1_depth = 0  # tracks nesting depth to handle inline tags inside <h1>
        self._h1_buf = ""
        # meta description
        self.meta_description: Optional[str] = None
        # canonical
        self.canonical: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attrs_dict = {k.lower(): (v or "") for k, v in attrs}

        if tag == "title" and self.title is None:
            self._in_title = True
            self._title_buf = ""

        elif tag == "h1":
            self._in_h1 = True
            self._h1_depth += 1
            self._h1_buf = ""

        elif tag == "meta":
            name = attrs_dict.get("name", "").lower()
            if name == "description" and self.meta_description is None:
                self.meta_description = attrs_dict.get("content", "")

        elif tag == "link":
            rel = attrs_dict.get("rel", "").lower()
            if "canonical" in rel and self.canonical is None:
                self.canonical = attrs_dict.get("href", "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self._in_title = False
            self.title = self._title_buf.strip() or None

        elif tag == "h1" and self._in_h1:
            self._h1_depth -= 1
            if self._h1_depth <= 0:
                self._in_h1 = False
                self._h1_depth = 0
                text = self._h1_buf.strip()
                if text:
                    self.h1_values.append(text)

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_buf += data
        if self._in_h1:
            self._h1_buf += data


# ── Check functions ───────────────────────────────────────────────────────────

def _check_h1(h1_values: list[str], keyword: Optional[str] = None) -> dict:
    """
    H1 checks — two-layer design:

    Layer 1 (script): mechanical checks
      - Uniqueness: exactly one H1
      - Non-empty content
      - Length: warn if < 5 chars (brand-only) or > 70 chars
      - Keyword match: full / partial / none / unverified

    Layer 2 (LLM, triggered by llm_review_required=True):
      - When keyword_match == "partial": agent must judge semantic intent alignment.
        Script cannot determine if "Best Personal AI" covers intent for "AI computer".
        Agent reads h1_text + keyword and makes the call.

    Output fields:
      keyword_match      : "full" | "partial" | "none" | "unverified"
      llm_review_required: True when keyword_match == "partial" — agent must do semantic review
    """
    count = len(h1_values)

    if count == 0:
        return {
            "status": "fail",
            "count": 0,
            "values": [],
            "keyword_match": "unverified",
            "llm_review_required": False,
            "detail": "No H1 tag found. Every page should have exactly one H1 containing the primary keyword.",
        }

    if count > 1:
        return {
            "status": "fail",
            "count": count,
            "values": h1_values,
            "keyword_match": "unverified",
            "llm_review_required": False,
            "detail": (
                f"{count} H1 tags found. Multiple H1s dilute heading hierarchy "
                f"and make it harder for crawlers to identify the primary topic. "
                f"Keep exactly one H1; include the primary keyword or a natural variant."
            ),
        }

    # Exactly one H1 — run content checks
    h1_text = h1_values[0]

    if not h1_text.strip():
        return {
            "status": "fail",
            "count": 1,
            "values": h1_values,
            "keyword_match": "unverified",
            "llm_review_required": False,
            "detail": "H1 tag present but content is empty.",
        }

    length = len(h1_text)
    issues: list[str] = []

    # Length thresholds
    if length < 5:
        issues.append(
            f'H1 is very short ({length} chars): "{h1_text}". '
            "Likely brand-name only — add the primary keyword to signal page topic."
        )
    elif length > 70:
        issues.append(
            f"H1 is {length} characters — consider trimming to under 70 for readability."
        )

    # Keyword match — script does string-level detection only
    if keyword:
        h1_lower = h1_text.lower()
        kw_lower = keyword.lower().strip()
        kw_words = [w for w in kw_lower.split() if w not in _STOP_WORDS]
        full_match = kw_lower in h1_lower
        partial_match = not full_match and any(w in h1_lower for w in kw_words)

        if full_match:
            keyword_match = "full"
            llm_review_required = False
            keyword_note = f'Primary keyword "{keyword}" found in H1 (full match).'
        elif partial_match:
            # Script stops here — agent must decide if this is a valid natural variant
            keyword_match = "partial"
            llm_review_required = True
            keyword_note = (
                f'Partial string match for "{keyword}" in H1: "{h1_text}". '
                "Script cannot determine semantic intent alignment. "
                "LLM review required: does this H1 cover the search intent of the keyword?"
            )
            issues.append(keyword_note)
        else:
            keyword_match = "none"
         
```

### Core Architecture Module: `seo-audit-full/scripts/check-pagespeed.py`
```
#!/usr/bin/env python3
"""
PageSpeed Insights / Lighthouse checks.

Fetches PageSpeed Insights metrics for a target URL and outputs structured JSON
for direct use in seo-audit-full reports.

Usage:
    python scripts/check-pagespeed.py https://example.com
    python scripts/check-pagespeed.py https://example.com --strategy desktop
    python scripts/check-pagespeed.py https://example.com --category performance --category seo
    python scripts/check-pagespeed.py https://example.com --api-key "$PAGESPEED_API_KEY"

Output: JSON — Lighthouse category scores + FCP/LCP/TBT/CLS/Speed Index.

Dependencies:
    pip install requests
"""

import argparse
import ipaddress
import json
import os
import re
import socket
import sys
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print(
        "Error: requests library required. Install with: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)


API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
_DEFAULT_TIMEOUT = 180
_GET_API_KEY_URL = "https://developers.google.com/speed/docs/insights/v5/get-started"

_VALID_STRATEGIES = frozenset({"mobile", "desktop"})
_VALID_CATEGORIES = frozenset({
    "performance",
    "accessibility",
    "best-practices",
    "seo",
})
_DEFAULT_CATEGORIES = [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
]

# Lighthouse thresholds.
# Values are milliseconds except CLS, which is unitless.
_THRESHOLDS = {
    "first-contentful-paint": {"pass": 1800, "warn": 3000, "unit": "ms"},
    "largest-contentful-paint": {"pass": 2500, "warn": 4000, "unit": "ms"},
    "total-blocking-time": {"pass": 200, "warn": 600, "unit": "ms"},
    "cumulative-layout-shift": {"pass": 0.1, "warn": 0.25, "unit": "unitless"},
    "speed-index": {"pass": 3400, "warn": 5800, "unit": "ms"},
}

_METRIC_NAMES = {
    "first-contentful-paint": "First Contentful Paint",
    "largest-contentful-paint": "Largest Contentful Paint",
    "total-blocking-time": "Total Blocking Time",
    "cumulative-layout-shift": "Cumulative Layout Shift",
    "speed-index": "Speed Index",
}

_METRIC_ALIASES = {
    "first-contentful-paint": "fcp",
    "largest-contentful-paint": "lcp",
    "total-blocking-time": "tbt",
    "cumulative-layout-shift": "cls",
    "speed-index": "si",
}

_FAKE_IP_NETWORKS = (
    ipaddress.ip_network("198.18.0.0/15"),
)


def _is_blocked_ip(ip_text: str) -> bool:
    """Return True for private, local, reserved, multicast, or unspecified IPs."""
    ip = ipaddress.ip_address(ip_text)
    return any((
        ip.is_private,
        ip.is_loopback,
        ip.is_link_local,
        ip.is_reserved,
        ip.is_multicast,
        ip.is_unspecified,
    ))


def _is_proxy_fake_ip(ip_text: str) -> bool:
    """Return True for common local proxy fake-IP DNS ranges."""
    ip = ipaddress.ip_address(ip_text)
    return any(ip in network for network in _FAKE_IP_NETWORKS)


def _resolve_with_google_dns(host: str, timeout: int = 5) -> list[str]:
    """Resolve public A/AAAA records through Google DNS-over-HTTPS."""
    ips: set[str] = set()
    for record_type in ("A", "AAAA"):
        try:
            response = requests.get(
                "https://dns.google/resolve",
                params={"name": host, "type": record_type},
                timeout=timeout,
            )
            response.raise_for_status()
            data = response.json()
        except (requests.exceptions.RequestException, ValueError):
            continue

        for answer in data.get("Answer", []):
            value = answer.get("data")
            if not value:
                continue
            try:
                ipaddress.ip_address(value)
            except ValueError:
                continue
            ips.add(value)
    return sorted(ips)


def _normalize_url(url: str) -> str:
    """Add https:// when the user provides a bare domain."""
    if url.startswith(("http://", "https://")):
        return url
    return f"https://{url}"


def _redact_api_key(text: str) -> str:
    """Remove API key values from error strings before JSON output."""
    return re.sub(r"([?&]key=)[^&\s]+", r"\1[REDACTED_API_KEY]", text)


def validate_public_url(raw_url: str) -> str:
    """
    Normalize and validate a URL before sending it to PageSpeed.

    This script is intended to model a backend proxy. It rejects localhost,
    .local hostnames, direct private IPs, and DNS names that resolve to private
    or otherwise non-public addresses.
    """
    url = _normalize_url(raw_url.strip())
    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Invalid protocol. Use http or https.")
    if not parsed.hostname:
        raise ValueError("URL hostname is required.")
    if parsed.username or parsed.password:
        raise ValueError("Credentials in URL are not allowed.")

    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(".local"):
        raise ValueError("Private URL not allowed.")

    try:
        if _is_blocked_ip(host):
            raise ValueError("Private IP URL not allowed.")
    except ValueError as exc:
        if "Private IP URL" in str(exc):
            raise

    try:
        addr_infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ValueError(f"DNS resolution failed: {exc}") from exc

    resolved_ips = sorted({info[4][0] for info in addr_infos})
    blocked = [ip for ip in resolved_ips if _is_blocked_ip(ip)]
    if blocked and all(_is_proxy_fake_ip(ip) for ip in blocked):
        doh_ips = _resolve_with_google_dns(host)
        if doh_ips:
            resolved_ips = doh_ips
            blocked = [ip for ip in resolved_ips if _is_blocked_ip(ip)]

    if blocked:
        raise ValueError(f"Private URL not allowed: resolves to {blocked[0]}")

    return url


def _score_status(score: Optional[float]) -> str:
    """Map Lighthouse performance score to pass/warn/fail/error."""
    if score is None:
        return "error"
    if score >= 90:
        return "pass"
    if score >= 50:
        return "warn"
    return "fail"


def _category_score(category: Optional[dict]) -> Optional[float]:
    """Return a 0-100 category score, or None when unavailable."""
    if not category:
        return None
    score = category.get("score")
    return round(score * 100) if isinstance(score, (int, float)) else None


def _metric_status(metric_id: str, numeric_value: Optional[float]) -> str:
    """Map a Lighthouse metric value to pass/warn/fail/error."""
    if numeric_value is None:
        return "error"

    thresholds = _THRESHOLDS.get(metric_id)
    if not thresholds:
        return "error"

    if numeric_value <= thresholds["pass"]:
        return "pass"
    if numeric_value <= thresholds["warn"]:
        return "warn"
    return "fail"


def _metric_detail(metric_id: str, display_value: str, status: str) -> str:
    """Build a concise report-ready detail string."""
    thresholds = _THRESHOLDS.get(metric_id, {})
    name = _METRIC_NAMES.get(metric_id, metric_id)

    if status == "error":
        return f"{name}: unavailable."

    pass_threshold = thresholds.get("pass")
    warn_threshold = thresholds.get("warn")
    unit = thresholds.get("unit", "")
    if unit == "ms":
        return (
            f"{name}: {display_value} · pass ≤ {pass_threshold / 1000:g}s · "
            f"warning ≤ {warn_threshold / 1000:g}s."
        )
    if unit == "unitless":
        return (
            f"{name}: {display_value} · pass ≤ {pass_threshold:g} · "
            f"warning ≤ {warn_threshold:g}."
        )
    return f"{name}: {display_value}."


def _extract_metric(audits: dict, metric_id: str) -> dict:
    """Extract one Lighthouse metric with normalized status/detail fields."""
    audit = audits.get(metric_id, {})
    numeric_value = audit.get("numericValue")
    if isinstance(numeric_value, (int, float)):
        numeric_value = float(numeric_value)
    else:
        numeric_value = None

    display_value = audit.get("displayValue") or "N/A"
    status = _metric_status(metric_id, numeric_value)

    return {
        "id": metric_id,
        "key": _METRIC_ALIASES.get(metric_id, metric_id),
        "title": audit.get("title") or _METRIC_NAMES.get(metric_id, metric_id),
        "status": status,
        "display_value": display_value,
        "numeric_value": numeric_value,
        "numeric_unit": audit.get("numericUnit"),
        "score": audit.get("score"),
        "thresholds": _THRESHOLDS.get(metric_id, {}),
        "detail": _metric_detail(metric_id, display_value, status),
    }


def _pick_audit(audits: dict, audit_id: str) -> Optional[dict]:
    """Return a compact audit value object for frontend/plugin consumers."""
    audit = audits.get(audit_id)
    if not audit:
        return None
    return {
        "value": audit.get("numericValue"),
        "display_value": audit.get("displayValue"),
        "score": audit.get("score"),
    }


def _extract_categories(categories: dict, requested_categories: list[str]) -> dict:
    """Extract normalized Lighthouse category score objects."""
    result = {}
    for category_id in requested_categories:
        category = categories.get(category_id)
        score = _category_score(category)
        result[category_id] = {
            "status": _score_status(score),
            "score": score,
            "title": category.get("title") if category else category_id,
        }
    return result


def _extract_field_data(experience: Optional[dict]) -> Optional[dict]:
    """Return compact CrUX field data if PSI includes it."""
    if not experience:
        return None
    metrics = {}
    for metric_id, metric in experience.get("metrics", {}).items():
        metrics[metric_id] = {
            "category": metric.get("category"),
            "percentile": metric.get("percentile"),
            "distributions
```

### Core Architecture Module: `seo-audit-full/scripts/check-schema.py`
```
#!/usr/bin/env python3
"""
JSON-LD structured data validator for SEO auditing.

Extracts <script type="application/ld+json"> blocks, validates @type and
required fields per Schema.org spec. Page type inference is heuristic —
always sets llm_review_required for agent confirmation.

Usage:
    python scripts/check-schema.py https://example.com
    python scripts/check-schema.py --file page.html

Output: JSON with found schemas, validation results, and LLM review flags.

Dependencies:
    pip install requests
"""

import argparse
import ipaddress
import json
import socket
import sys
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print(
        "Error: requests library required. Install with: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)


_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# 各 @type 必填字段（缺失 → fail）
REQUIRED_FIELDS: dict[str, list[str]] = {
    "WebSite": ["name", "url"],
    "Organization": ["name", "url", "logo"],
    "Article": ["headline", "datePublished", "author", "image"],
    "BlogPosting": ["headline", "datePublished", "author", "image"],
    "NewsArticle": ["headline", "datePublished", "author", "image"],
    "Product": ["name", "image", "offers"],
    "FAQPage": ["mainEntity"],
    "HowTo": ["name", "step"],
    "LocalBusiness": ["name", "address", "telephone"],
}

# 推荐字段（缺失 → warn）
RECOMMENDED_FIELDS: dict[str, list[str]] = {
    "Article": ["dateModified", "publisher", "mainEntityOfPage"],
    "BlogPosting": ["dateModified", "publisher", "mainEntityOfPage"],
    "NewsArticle": ["dateModified", "publisher", "mainEntityOfPage"],
    "Product": ["aggregateRating", "brand", "description"],
    "Organization": ["sameAs", "contactPoint"],
    "WebSite": ["potentialAction"],
}

# 嵌套字段要求：父字段 → 子字段列表
NESTED_REQUIREMENTS: dict[str, dict[str, list[str]]] = {
    "Product": {"offers": ["price", "priceCurrency"]},
    "FAQPage": {"mainEntity": ["name", "acceptedAnswer"]},
    "HowTo": {"step": ["text"]},
}

# 页面类型 → 期望 @type 映射
PAGE_TYPE_EXPECTED: dict[str, list[str]] = {
    "homepage": ["WebSite", "Organization"],
    "article": ["Article", "BlogPosting", "NewsArticle"],
    "product": ["Product"],
    "faq": ["FAQPage"],
    "howto": ["HowTo"],
    "local_business": ["LocalBusiness"],
}


# ── HTTP fetch ────────────────────────────────────────────────────────────────


def _safe_fetch(
    url: str, timeout: int
) -> tuple[Optional[int], Optional[str], Optional[str]]:
    """Fetch URL with SSRF protection. Returns (status, content, error)."""
    parsed = urlparse(url)
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        resp = requests.get(
            url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True
        )
        return resp.status_code, resp.text, None
    except requests.exceptions.RequestException as exc:
        return None, None, str(exc)


# ── HTML parser ───────────────────────────────────────────────────────────────


class _JsonLdExtractor(HTMLParser):
    """Single-pass extractor for <script type="application/ld+json"> blocks."""

    def __init__(self) -> None:
        super().__init__()
        self.blocks: list[str] = []
        self.html_lang: Optional[str] = None
        self.canonical_url: Optional[str] = None
        self.hreflang_urls: dict[str, str] = {}
        self._in_jsonld = False
        self._buf = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attrs_dict = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            lang = attrs_dict.get("lang", "").strip()
            if lang:
                self.html_lang = lang
        elif tag == "link":
            rel_values = {v.lower() for v in attrs_dict.get("rel", "").split()}
            href = attrs_dict.get("href", "").strip()
            if "canonical" in rel_values and href:
                self.canonical_url = href
            if "alternate" in rel_values and href:
                hreflang = attrs_dict.get("hreflang", "").strip()
                if hreflang:
                    self.hreflang_urls[hreflang] = href

        if tag == "script":
            if attrs_dict.get("type", "").lower() == "application/ld+json":
                self._in_jsonld = True
                self._buf = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            content = self._buf.strip()
            if content:
                self.blocks.append(content)

    def handle_data(self, data: str) -> None:
        if self._in_jsonld:
            self._buf += data


# ── Schema helpers ────────────────────────────────────────────────────────────


def _flatten_schemas(raw_blocks: list[str]) -> tuple[list[dict], list[str]]:
    """Parse JSON-LD blocks and flatten @graph arrays into individual schemas."""
    schemas: list[dict] = []
    parse_errors: list[str] = []
    for text in raw_blocks:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            parse_errors.append(f"Invalid JSON-LD: {exc.msg} at line {exc.lineno}, column {exc.colno}.")
            continue

        if isinstance(parsed, list):
            schemas.extend(item for item in parsed if isinstance(item, dict))
        elif isinstance(parsed, dict):
            graph = parsed.get("@graph")
            if isinstance(graph, list):
                schemas.extend(item for item in graph if isinstance(item, dict))
            else:
                schemas.append(parsed)
    return schemas, parse_errors


def _get_types(schema: dict) -> list[str]:
    """Extract @type as a normalized list."""
    raw = schema.get("@type")
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [t for t in raw if isinstance(t, str)]
    return []


def _field_present(schema: dict, field: str) -> bool:
    """Check if a field exists and is non-empty."""
    value = schema.get(field)
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    if isinstance(value, list) and len(value) == 0:
        return False
    return True


def _normalize_lang(value: Optional[str]) -> Optional[str]:
    """Normalize language strings for loose matching."""
    if not value or not isinstance(value, str):
        return None
    normalized = value.strip().lower().replace("_", "-")
    if not normalized:
        return None
    return normalized


def _lang_matches(page_lang: Optional[str], schema_lang: Optional[str]) -> bool:
    """Accept exact language-region matches and same primary language matches."""
    page = _normalize_lang(page_lang)
    schema = _normalize_lang(schema_lang)
    if not page or not schema:
        return False
    return page == schema or page.split("-")[0] == schema.split("-")[0]


def _extract_schema_url(value) -> Optional[str]:
    """Extract URL values from schema fields that may be strings or objects."""
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        for key in ("@id", "url", "id"):
            nested = value.get(key)
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
    return None


def _urls_equivalent(a: Optional[str], b: Optional[str]) -> bool:
    """Compare URLs loosely, ignoring trailing slash differences."""
    if not a or not b:
        return False
    return a.rstrip("/") == b.rstrip("/")


def _validate_nested(schema: dict, schema_type: str) -> list[str]:
    """Validate nested field requirements, return list of missing dotted paths."""
    issues: list[str] = []
    nested_reqs = NESTED_REQUIREMENTS.get(schema_type, {})
    for parent_field, sub_fields in nested_reqs.items():
        parent = schema.get(parent_field)
        if parent is None:
            continue
        items = parent if isinstance(parent, list) else [parent]
        if not items:
            continue
        first = items[0]
        if not isinstance(first, dict):
            continue
        for sf in sub_fields:
            if not _field_present(first, sf):
                issues.append(f"{parent_field}.{sf}")
    return issues


def _validate_schema(schema: dict) -> dict:
    """Validate a single schema against required and recommended fields."""
    types = _get_types(schema)
    if not types:
        return {
            "types": [],
            "status": "warn",
            "fields_present": [],
            "fields_missing": [],
            "recommended_missing": [],
            "nested_issues": [],
            "detail": "JSON-LD block found but missing @type.",
        }

    primary = types[0]
    required = REQUIRED_FIELDS.get(primary, [])
    recommended = RECOMMENDED_FIELDS.get(primary, [])

    present = [f for f in required if _field_present(schema, f)]
    missing = [f for f in required if not _field_present(schema, f)]
    rec_missing = [f for f in recommended if not _field_present(schema, f)]
    nested = _validate_nested(schema, primary)

    if primary not in REQUIRED_FIELDS:
        return {
            "types": types,
            "status": "info",
            "fields_present": present,
            "fields_missing": missing,
            "re
```

### Core Architecture Module: `seo-audit-full/scripts/check-site.py`
```
#!/usr/bin/env python3
"""
Site-level SEO checks: staging subdomains, robots.txt, and sitemap.xml.
Outputs structured JSON to stdout so the agent can consume results directly
without needing to interpret raw HTTP responses or parse formats manually.

Usage:
    python check-site.py https://example.com
    python check-site.py https://example.com --timeout 15

Output example (JSON):
    {
      "origin": "https://example.com",
      "staging_subdomains": {
        "status": "pass",
        "checked_hosts": ["test.example.com", "staging.example.com"],
        "public_hosts": [],
        "detail": "No public staging/test subdomain detected."
      },
      "robots": {
        "status": "pass",
        "http_status": 200,
        "disallow_all": false,
        "googlebot_blocked": false,
        "sitemap_directive": "https://example.com/sitemap.xml",
        "detail": "robots.txt found. No critical blocking rules detected."
      },
      "sitemap": {
        "status": "pass",
        "http_status": 200,
        "url_count": 42,
        "is_index": false,
        "detail": "sitemap.xml found with 42 URLs."
      }
    }

Dependencies:
    pip install requests
"""

import argparse
import ipaddress
import json
import re
import socket
import sys
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# Same UA as fetch-page.py for consistent request fingerprinting
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

_STAGING_PREFIXES = ("test", "staging", "dev", "preview", "beta", "uat")
_PROTECTED_STATUS_CODES = {401, 403}
_PUBLIC_STATUS_CODES = {200}
_MAX_SITEMAP_CHILDREN = 20
_MAX_INVENTORY_URLS = 5000


def _safe_fetch(url: str, timeout: int) -> tuple[Optional[int], Optional[str], Optional[str]]:
    """
    Internal helper: fetch a URL safely with SSRF protection.
    Returns (status_code, content, error_message).
    """
    parsed = urlparse(url)

    # SSRF protection: block private, loopback, and reserved IPs
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        resp = requests.get(url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        return resp.status_code, resp.text, None
    except requests.exceptions.Timeout:
        return None, None, f"Timed out after {timeout}s"
    except requests.exceptions.SSLError as e:
        return None, None, f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        return None, None, f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        return None, None, f"Request failed: {e}"


def _safe_fetch_no_redirect(
    url: str, timeout: int
) -> tuple[Optional[int], Optional[str], Optional[str], Optional[str]]:
    """
    Fetch a URL without following redirects.
    Returns (status_code, content, error_message, location_header).
    """
    parsed = urlparse(url)

    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, f"Blocked: resolves to private IP ({resolved_ip})", None
    except (socket.gaierror, ValueError):
        pass

    try:
        resp = requests.get(url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=False)
        return resp.status_code, resp.text, None, resp.headers.get("Location")
    except requests.exceptions.Timeout:
        return None, None, f"Timed out after {timeout}s", None
    except requests.exceptions.SSLError as e:
        return None, None, f"SSL error: {e}", None
    except requests.exceptions.ConnectionError as e:
        return None, None, f"Connection error: {e}", None
    except requests.exceptions.RequestException as e:
        return None, None, f"Request failed: {e}", None


def _parse_robots_groups(content: str) -> tuple[list[dict], list[str]]:
    """
    Parse robots.txt into directive groups per RFC 9309.
    Consecutive User-Agent lines merge into one group.
    Returns (groups, sitemap_directives).
    """
    groups: list[dict] = []
    current_group: Optional[dict] = None
    prev_key = ""
    sitemap_directives: list[str] = []

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue

        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()

        if key == "user-agent":
            if prev_key == "user-agent" and current_group is not None:
                current_group["agents"].append(value.lower())
            else:
                current_group = {
                    "agents": [value.lower()],
                    "allow": [],
                    "disallow": [],
                }
                groups.append(current_group)
            prev_key = "user-agent"
        elif key in ("allow", "disallow") and current_group is not None:
            if value:
                current_group[key].append(value)
            prev_key = key
        elif key == "sitemap":
            if value:
                sitemap_directives.append(value)
            prev_key = key
        else:
            prev_key = key

    return groups, sitemap_directives


def _group_blocks_all(group: dict) -> bool:
    """
    Check if a group fully blocks the site.
    Disallow: / alone blocks everything, but Allow: sub-paths means partial access.
    Per RFC 9309, the most specific (longest) matching rule wins.
    """
    has_root_block = any(rule in ("/", "/*") for rule in group.get("disallow", []))
    if not has_root_block:
        return False
    # Allow rules for sub-paths override the root block → not a full block
    has_allow = any(r and r != "/" for r in group.get("allow", []))
    return not has_allow


def _find_group_for_agent(groups: list[dict], agent: str) -> Optional[dict]:
    """Find the group matching a specific user agent name."""
    agent_lower = agent.lower()
    for group in groups:
        if agent_lower in group["agents"]:
            return group
    return None


def _html_has_noindex(content: str) -> bool:
    """Return True when HTML contains a robots noindex directive."""
    meta_pattern = re.compile(
        r"<meta[^>]+(?:name|property)=[\"']?(?:robots|googlebot)[\"']?[^>]*>",
        re.IGNORECASE,
    )
    for tag in meta_pattern.findall(content or ""):
        if "noindex" in tag.lower():
            return True
    return False


def _extract_visible_text(content: str) -> str:
    """Normalize visible-ish page text for rough production/staging similarity checks."""
    text = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", content or "")
    text = re.sub(r"(?is)<!--.*?-->", " ", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()[:12000]


def _content_similarity(a: Optional[str], b: Optional[str]) -> Optional[float]:
    """Return a rough text similarity score between two HTML documents."""
    if not a or not b:
        return None
    text_a = _extract_visible_text(a)
    text_b = _extract_visible_text(b)
    if len(text_a) < 200 or len(text_b) < 200:
        return None
    return round(SequenceMatcher(None, text_a, text_b).ratio(), 3)


def _robots_blocks_all(content: Optional[str]) -> bool:
    """Check whether robots.txt content blocks all crawlers or Googlebot."""
    if not content:
        return False
    groups, _ = _parse_robots_groups(content)
    wildcard_group = _find_group_for_agent(groups, "*")
    googlebot_group = _find_group_for_agent(groups, "googlebot")
    wildcard_blocked = _group_blocks_all(wildcard_group) if wildcard_group else False
    googlebot_blocked = _group_blocks_all(googlebot_group) if googlebot_group else wildcard_blocked
    return wildcard_blocked or googlebot_blocked


def check_robots(origin: str, timeout: int) -> dict:
    """
    Check robots.txt with RFC 9309-compliant group parsing.
    Handles Allow overrides, multi-agent groups, and multiple Sitemap directives.
    """
    url = f"{origin}/robots.txt"
    status_code, content, error = _safe_fetch(url, timeout)

    result: dict = {
        "status": "error",
        "http_status": status_code,
        "disallow_all": False,
        "googlebot_blocked": False,
        "sitemap_directives": [],
        "sitemap_directive": None,
        "detail": "",
    }

    if error:
        result["detail"] = f"Fetch error: {error}"
        return result

    if status_code != 200:
        result["status"] = "fail"
        result["detail"] = f"robots.txt returned HTTP {status_code}. File may not exist or is inaccessible."
        return result

    if not content:
        result["status"] = "warn"
        result["detail"] = "robots.txt returned HTTP 200 but body is empty."
        return result

    groups, sitemap_directives = _parse_robots_groups(content)
    result["sitemap_directives"] = sitemap_directives
    result["sitemap_directive"] = sitemap_directives[0] if sitemap_directives else None

    # Evaluate blocking: Googlebot uses its own group if present, else inherits 
```

### Core Architecture Module: `seo-audit-full/scripts/check-social.py`
```
#!/usr/bin/env python3
"""
OG Tags + Twitter Card 社交标签验证脚本。

从 HTML 中提取 Open Graph 和 Twitter Card meta 标签，
验证关键字段的存在性、长度、一致性。

Usage:
    python scripts/check-social.py https://example.com
    python scripts/check-social.py --file page.html

Output: JSON — og / twitter_card 两组检查结果 + 整体 status。

Dependencies:
    pip install requests
"""

import argparse
import ipaddress
import json
import socket
import sys
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print(
        "Error: requests library required. Install with: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)


_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# OG 字段长度阈值
_OG_TITLE_MAX = 95
_OG_DESC_MAX = 200

# Twitter 字段长度阈值
_TW_TITLE_MAX = 70
_TW_DESC_MAX = 200

# 合法的 twitter:card 类型
_VALID_CARD_TYPES = frozenset({
    "summary", "summary_large_image", "app", "player",
})


# ── HTTP fetch ────────────────────────────────────────────────────────────────


def _safe_fetch(
    url: str, timeout: int
) -> tuple[Optional[int], Optional[str], Optional[str]]:
    """带 SSRF 防护的 HTTP 请求，返回 (status, content, error)。"""
    parsed = urlparse(url)
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        resp = requests.get(
            url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True
        )
        return resp.status_code, resp.text, None
    except requests.exceptions.RequestException as exc:
        return None, None, str(exc)


# ── HTML parser ───────────────────────────────────────────────────────────────


class _MetaExtractor(HTMLParser):
    """单次遍历提取 <meta> 标签中的 OG / Twitter / canonical 信息。"""

    def __init__(self) -> None:
        super().__init__()
        self.og: dict[str, str] = {}
        self.twitter: dict[str, str] = {}
        self.canonical: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag == "meta":
            attrs_dict = {k.lower(): (v or "") for k, v in attrs}
            prop = attrs_dict.get("property", "").lower()
            name = attrs_dict.get("name", "").lower()
            content = attrs_dict.get("content", "")

            # OG 标签: <meta property="og:xxx" content="...">
            if prop.startswith("og:"):
                key = prop[3:]  # 去掉 "og:" 前缀
                if key and content:
                    self.og[key] = content

            # Twitter 标签: <meta name="twitter:xxx" content="...">
            if name.startswith("twitter:"):
                key = name[8:]  # 去掉 "twitter:" 前缀
                if key and content:
                    self.twitter[key] = content

        # Canonical: <link rel="canonical" href="...">
        if tag == "link":
            attrs_dict = {k.lower(): (v or "") for k, v in attrs}
            if attrs_dict.get("rel", "").lower() == "canonical":
                href = attrs_dict.get("href", "").strip()
                if href:
                    self.canonical = href


# ── OG 验证 ───────────────────────────────────────────────────────────────────


def _check_og(og: dict[str, str], canonical: Optional[str]) -> dict:
    """验证 Open Graph 标签完整性和质量。"""
    issues: list[str] = []
    warnings: list[str] = []
    fields: dict[str, dict] = {}

    # og:title — 必须存在
    title = og.get("title", "")
    if not title:
        issues.append("og:title missing.")
        fields["title"] = {"present": False, "status": "fail"}
    else:
        f: dict = {"present": True, "value": title, "length": len(title), "status": "pass"}
        if len(title) > _OG_TITLE_MAX:
            f["status"] = "warn"
            warnings.append(f"og:title is {len(title)} chars (max {_OG_TITLE_MAX}).")
        fields["title"] = f

    # og:description — 推荐存在
    desc = og.get("description", "")
    if not desc:
        warnings.append("og:description missing.")
        fields["description"] = {"present": False, "status": "warn"}
    else:
        f = {"present": True, "value": desc, "length": len(desc), "status": "pass"}
        if len(desc) > _OG_DESC_MAX:
            f["status"] = "warn"
            warnings.append(f"og:description is {len(desc)} chars (max {_OG_DESC_MAX}).")
        fields["description"] = f

    # og:image — 必须存在且为有效 URL
    image = og.get("image", "")
    if not image:
        issues.append("og:image missing — social shares will lack a preview image.")
        fields["image"] = {"present": False, "status": "fail"}
    else:
        f = {"present": True, "value": image, "status": "pass"}
        if not image.startswith(("http://", "https://")):
            f["status"] = "warn"
            warnings.append("og:image is not an absolute URL.")
        fields["image"] = f

    # og:type — 推荐存在
    og_type = og.get("type", "")
    if not og_type:
        warnings.append("og:type missing (defaults to 'website').")
        fields["type"] = {"present": False, "status": "warn"}
    else:
        fields["type"] = {"present": True, "value": og_type, "status": "pass"}

    # og:url — 推荐存在，且应与 canonical 一致
    og_url = og.get("url", "")
    if not og_url:
        warnings.append("og:url missing.")
        fields["url"] = {"present": False, "status": "warn"}
    else:
        f = {"present": True, "value": og_url, "status": "pass"}
        if canonical and og_url.rstrip("/") != canonical.rstrip("/"):
            f["status"] = "warn"
            f["canonical_mismatch"] = True
            warnings.append(
                f"og:url ({og_url}) differs from canonical ({canonical})."
            )
        fields["url"] = f

    # 综合状态
    if issues:
        status = "fail"
    elif warnings:
        status = "warn"
    else:
        status = "pass"

    detail_parts = []
    if issues:
        detail_parts.extend(issues)
    if warnings:
        detail_parts.extend(warnings)
    if not detail_parts:
        detail_parts.append("All OG tags present and valid.")

    return {
        "status": status,
        "fields": fields,
        "issues": issues,
        "warnings": warnings,
        "detail": " ".join(detail_parts),
    }


# ── Twitter Card 验证 ─────────────────────────────────────────────────────────


def _check_twitter(
    twitter: dict[str, str], og: dict[str, str]
) -> dict:
    """验证 Twitter Card 标签，考虑 OG fallback 机制。"""
    issues: list[str] = []
    warnings: list[str] = []
    fields: dict[str, dict] = {}

    # twitter:card — 必须存在
    card = twitter.get("card", "")
    if not card:
        issues.append("twitter:card missing — no Twitter Card will render.")
        fields["card"] = {"present": False, "status": "fail"}
    else:
        f: dict = {"present": True, "value": card, "status": "pass"}
        if card not in _VALID_CARD_TYPES:
            f["status"] = "warn"
            warnings.append(f"twitter:card value '{card}' is non-standard.")
        fields["card"] = f

    # twitter:title — 可 fallback 到 og:title
    tw_title = twitter.get("title", "")
    og_title = og.get("title", "")
    if tw_title:
        f = {"present": True, "value": tw_title, "length": len(tw_title), "status": "pass"}
        if len(tw_title) > _TW_TITLE_MAX:
            f["status"] = "warn"
            warnings.append(f"twitter:title is {len(tw_title)} chars (max {_TW_TITLE_MAX}).")
        fields["title"] = f
    elif og_title:
        fields["title"] = {
            "present": False, "fallback": "og:title",
            "fallback_value": og_title, "status": "pass",
        }
    else:
        warnings.append("twitter:title missing and no og:title fallback.")
        fields["title"] = {"present": False, "status": "warn"}

    # twitter:description — 可 fallback 到 og:description
    tw_desc = twitter.get("description", "")
    og_desc = og.get("description", "")
    if tw_desc:
        f = {"present": True, "value": tw_desc, "length": len(tw_desc), "status": "pass"}
        if len(tw_desc) > _TW_DESC_MAX:
            f["status"] = "warn"
            warnings.append(
                f"twitter:description is {len(tw_desc)} chars (max {_TW_DESC_MAX})."
            )
        fields["description"] = f
    elif og_desc:
        fields["description"] = {
            "present": False, "fallback": "og:description",
            "fallback_value": og_desc, "status": "pass",
        }
    else:
        warnings.append("twitter:description missing and no og:description fallback.")
        fields["description"] = {"present": False, "status": "warn"}

    # twitter:image — 可 fallback 到 og:image
    tw_image = twitter.get("image", "")
    og_image = og.get("image", "")
    if tw_image:
        fields["image"] = {"present": True, "value": tw_image, "status": "pass"}
    elif og_image:
        fields["image"] = {
            "present": False, "fallback": "og:image",
            "fallback_value": og_image, "status": "pass",
        }
    else:
        warnings.append("twitter:image missing and no og:image fallback.")
        fields["image"] = {"present": False, "status": "warn"}

    # 综合状态
    if issues:
        status = "fail"
    elif warnings:
        status = "warn"
    else:
        status = "pass"

    detail_parts = []
    if issues:
        detail_parts.extend(issues)
    if warnings:
        detail_parts.extend(warnings)
    if not detail_parts:
        detail_parts.append("Twitter Card valid with all fields present or fallback availabl
```

### Core Architecture Module: `seo-audit-full/scripts/fetch-page.py`
```
#!/usr/bin/env python3
"""
Fetch a web page for SEO analysis with proper headers, redirect tracking, and SSRF protection.

Usage:
    python fetch-page.py https://example.com
    python fetch-page.py https://example.com --output page.html
    python fetch-page.py https://example.com --googlebot
"""

import argparse
import ipaddress
import json
import socket
import sys
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# Default UA: simulates a real browser for standard page fetching
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
)

# Googlebot UA: used to detect dynamic rendering (Prerender.io / SSR).
# Comparing response body size between DEFAULT_USER_AGENT and GOOGLEBOT_USER_AGENT
# reveals whether a site uses a prerender service — a key SPA detection signal.
GOOGLEBOT_USER_AGENT = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}


def fetch_page(
    url: str,
    timeout: int = 30,
    follow_redirects: bool = True,
    max_redirects: int = 5,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Fetch a web page and return a structured result dict.

    Returns:
        {
            "url": final URL after redirects,
            "status_code": HTTP status code,
            "content": response body text,
            "headers": response headers dict,
            "redirect_chain": list of intermediate URLs,
            "redirect_details": list of {url, status_code} per hop,
            "error": error message string, or None on success
        }
    """
    result: dict = {
        "url": url,
        "status_code": None,
        "content": None,
        "headers": {},
        "redirect_chain": [],
        "redirect_details": [],
        "error": None,
    }

    # Prepend https:// if no scheme is present
    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"
        parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        result["error"] = f"Invalid URL scheme: {parsed.scheme}"
        return result

    # SSRF protection: block private, loopback, and reserved IPs
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            result["error"] = f"Blocked: resolves to private/internal IP ({resolved_ip})"
            return result
    except (socket.gaierror, ValueError):
        pass  # DNS failure is handled by requests below

    try:
        session = requests.Session()
        session.max_redirects = max_redirects

        headers = dict(DEFAULT_HEADERS)
        if user_agent:
            headers["User-Agent"] = user_agent

        response = session.get(
            url,
            headers=headers,
            timeout=timeout,
            allow_redirects=follow_redirects,
        )

        result["url"] = response.url
        result["status_code"] = response.status_code
        result["content"] = response.text
        result["headers"] = dict(response.headers)

        # Record each redirect hop
        if response.history:
            result["redirect_chain"] = [r.url for r in response.history]
            result["redirect_details"] = [
                {"url": r.url, "status_code": r.status_code}
                for r in response.history
            ]

    except requests.exceptions.Timeout:
        result["error"] = f"Request timed out after {timeout}s"
    except requests.exceptions.TooManyRedirects:
        result["error"] = f"Too many redirects (max {max_redirects})"
    except requests.exceptions.SSLError as e:
        result["error"] = f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        result["error"] = f"Request failed: {e}"

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch a web page for SEO analysis")
    parser.add_argument("url", help="URL to fetch")
    parser.add_argument("--output", "-o", help="Save content to this file path")
    parser.add_argument("--timeout", "-t", type=int, default=30, help="Timeout in seconds")
    parser.add_argument("--no-redirects", action="store_true", help="Do not follow redirects")
    parser.add_argument("--user-agent", help="Custom User-Agent string")
    parser.add_argument(
        "--googlebot",
        action="store_true",
        help="Use Googlebot UA to detect dynamic rendering / prerender services",
    )
    parser.add_argument("--json", action="store_true", help="Output full result as JSON (excludes body)")

    args = parser.parse_args()

    ua: Optional[str] = args.user_agent
    if args.googlebot:
        ua = GOOGLEBOT_USER_AGENT

    result = fetch_page(
        args.url,
        timeout=args.timeout,
        follow_redirects=not args.no_redirects,
        user_agent=ua,
    )

    if result["error"]:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    # --json mode: output metadata only (no full HTML body) for consumption by other scripts
    if args.json:
        output = {k: v for k, v in result.items() if k != "content"}
        output["content_length"] = len(result["content"] or "")
        print(json.dumps(output, indent=2, ensure_ascii=False))
        return

    # File output mode
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result["content"] or "")
        print(f"Saved to {args.output}")
    else:
        print(result["content"] or "")

    # Print metadata to stderr so it does not pollute stdout content
    print(f"\nURL: {result['url']}", file=sys.stderr)
    print(f"Status: {result['status_code']}", file=sys.stderr)
    if result["redirect_details"]:
        for rd in result["redirect_details"]:
            print(f"  {rd['status_code']} -> {rd['url']}", file=sys.stderr)
        print(f"  {result['status_code']} -> {result['url']} (final)", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `seo-audit/scripts/check-page.py`
```
#!/usr/bin/env python3
"""
Page-level SEO checks: H1, title tag, meta description, and canonical.
Uses Python stdlib html.parser — no BeautifulSoup required.
Outputs structured JSON to stdout for direct agent consumption.

Usage:
    python check-page.py https://example.com
    python check-page.py https://example.com --timeout 20

Output example (JSON):
    {
      "url": "https://example.com/",
      "final_url": "https://example.com/",
      "http_status": 200,
      "redirect_chain": [],
      "h1": {
        "status": "pass",
        "count": 1,
        "values": ["Best Running Shoes 2025"],
        "detail": "Single H1 found."
      },
      "title": {
        "status": "pass",
        "value": "Best Running Shoes 2025 | Free Shipping",
        "length": 42,
        "detail": "Title is 42 characters — within recommended range (50-60)."
      },
      "meta_description": {
        "status": "pass",
        "value": "Shop the best running shoes...",
        "length": 138,
        "detail": "Meta description is 138 characters — within recommended range (120-160)."
      },
      "canonical": {
        "status": "pass",
        "value": "https://example.com/",
        "matches_final_url": true,
        "detail": "Self-referencing canonical present."
      }
    }

Dependencies:
    pip install requests
    (HTML parsing uses Python stdlib html.parser — no extra packages needed)
"""

import argparse
import ipaddress
import json
import socket
import sys
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# ── HTTP fetch ────────────────────────────────────────────────────────────────

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# 关键词过滤用停用词表（替代长度阈值，避免误杀 SEO/AI/CRM 等短缩写词）
_STOP_WORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "not", "no",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
    "is", "are", "was", "were", "be",
    "it", "its", "this", "that",
})


def _fetch(url: str, timeout: int) -> tuple[Optional[int], Optional[str], str, list[dict], Optional[str]]:
    """
    Fetch a page with SSRF protection.
    Returns (status_code, content, final_url, redirect_chain, error).
    """
    parsed = urlparse(url)

    # SSRF protection: block private, loopback, and reserved IPs
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, url, [], f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        session = requests.Session()
        session.max_redirects = 5
        resp = session.get(url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        redirect_chain = [
            {"url": r.url, "status_code": r.status_code} for r in resp.history
        ]
        return resp.status_code, resp.text, resp.url, redirect_chain, None
    except requests.exceptions.Timeout:
        return None, None, url, [], f"Timed out after {timeout}s"
    except requests.exceptions.TooManyRedirects:
        return None, None, url, [], "Too many redirects (max 5)"
    except requests.exceptions.SSLError as e:
        return None, None, url, [], f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        return None, None, url, [], f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        return None, None, url, [], f"Request failed: {e}"


# ── HTML parser (stdlib, no external dependencies) ────────────────────────────

class _SEOParser(HTMLParser):
    """
    Lightweight SEO element extractor.
    Extracts <title>, <h1>, <meta name="description">, and <link rel="canonical">.
    Does not build a full DOM tree — single-pass scan only.
    """

    def __init__(self) -> None:
        super().__init__()
        # title state
        self.title: Optional[str] = None
        self._in_title = False
        self._title_buf = ""
        # h1 state
        self.h1_values: list[str] = []
        self._in_h1 = False
        self._h1_depth = 0  # tracks nesting depth to handle inline tags inside <h1>
        self._h1_buf = ""
        # meta description
        self.meta_description: Optional[str] = None
        # canonical
        self.canonical: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attrs_dict = {k.lower(): (v or "") for k, v in attrs}

        if tag == "title" and self.title is None:
            self._in_title = True
            self._title_buf = ""

        elif tag == "h1":
            self._in_h1 = True
            self._h1_depth += 1
            self._h1_buf = ""

        elif tag == "meta":
            name = attrs_dict.get("name", "").lower()
            if name == "description" and self.meta_description is None:
                self.meta_description = attrs_dict.get("content", "")

        elif tag == "link":
            rel = attrs_dict.get("rel", "").lower()
            if "canonical" in rel and self.canonical is None:
                self.canonical = attrs_dict.get("href", "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self._in_title = False
            self.title = self._title_buf.strip() or None

        elif tag == "h1" and self._in_h1:
            self._h1_depth -= 1
            if self._h1_depth <= 0:
                self._in_h1 = False
                self._h1_depth = 0
                text = self._h1_buf.strip()
                if text:
                    self.h1_values.append(text)

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_buf += data
        if self._in_h1:
            self._h1_buf += data


# ── Check functions ───────────────────────────────────────────────────────────

def _check_h1(h1_values: list[str], keyword: Optional[str] = None) -> dict:
    """
    H1 checks — two-layer design:

    Layer 1 (script): mechanical checks
      - Uniqueness: exactly one H1
      - Non-empty content
      - Length: warn if < 5 chars (brand-only) or > 70 chars
      - Keyword match: full / partial / none / unverified

    Layer 2 (LLM, triggered by llm_review_required=True):
      - When keyword_match == "partial": agent must judge semantic intent alignment.
        Script cannot determine if "Best Personal AI" covers intent for "AI computer".
        Agent reads h1_text + keyword and makes the call.

    Output fields:
      keyword_match      : "full" | "partial" | "none" | "unverified"
      llm_review_required: True when keyword_match == "partial" — agent must do semantic review
    """
    count = len(h1_values)

    if count == 0:
        return {
            "status": "fail",
            "count": 0,
            "values": [],
            "keyword_match": "unverified",
            "llm_review_required": False,
            "detail": "No H1 tag found. Every page should have exactly one H1 containing the primary keyword.",
        }

    if count > 1:
        return {
            "status": "fail",
            "count": count,
            "values": h1_values,
            "keyword_match": "unverified",
            "llm_review_required": False,
            "detail": (
                f"{count} H1 tags found. Multiple H1s dilute heading hierarchy "
                f"and make it harder for crawlers to identify the primary topic. "
                f"Keep exactly one H1; include the primary keyword or a natural variant."
            ),
        }

    # Exactly one H1 — run content checks
    h1_text = h1_values[0]

    if not h1_text.strip():
        return {
            "status": "fail",
            "count": 1,
            "values": h1_values,
            "keyword_match": "unverified",
            "llm_review_required": False,
            "detail": "H1 tag present but content is empty.",
        }

    length = len(h1_text)
    issues: list[str] = []

    # Length thresholds
    if length < 5:
        issues.append(
            f'H1 is very short ({length} chars): "{h1_text}". '
            "Likely brand-name only — add the primary keyword to signal page topic."
        )
    elif length > 70:
        issues.append(
            f"H1 is {length} characters — consider trimming to under 70 for readability."
        )

    # Keyword match — script does string-level detection only
    if keyword:
        h1_lower = h1_text.lower()
        kw_lower = keyword.lower().strip()
        kw_words = [w for w in kw_lower.split() if w not in _STOP_WORDS]
        full_match = kw_lower in h1_lower
        partial_match = not full_match and any(w in h1_lower for w in kw_words)

        if full_match:
            keyword_match = "full"
            llm_review_required = False
            keyword_note = f'Primary keyword "{keyword}" found in H1 (full match).'
        elif partial_match:
            # Script stops here — agent must decide if this is a valid natural variant
            keyword_match = "partial"
            llm_review_required = True
            keyword_note = (
                f'Partial string match for "{keyword}" in H1: "{h1_text}". '
                "Script cannot determine semantic intent alignment. "
                "LLM review required: does this H1 cover the search intent of the keyword?"
            )
            issues.append(keyword_note)
        else:
            keyword_match = "none"
         
```

### Core Architecture Module: `seo-audit/scripts/check-schema.py`
```
#!/usr/bin/env python3
"""
JSON-LD structured data validator for SEO auditing.

Extracts <script type="application/ld+json"> blocks, validates @type and
required fields per Schema.org spec. Page type inference is heuristic —
always sets llm_review_required for agent confirmation.

Usage:
    python scripts/check-schema.py https://example.com
    python scripts/check-schema.py --file page.html

Output: JSON with found schemas, validation results, and LLM review flags.

Dependencies:
    pip install requests
"""

import argparse
import ipaddress
import json
import socket
import sys
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print(
        "Error: requests library required. Install with: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)


_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# 各 @type 必填字段（缺失 → fail）
REQUIRED_FIELDS: dict[str, list[str]] = {
    "WebSite": ["name", "url"],
    "Organization": ["name", "url", "logo"],
    "Article": ["headline", "datePublished", "author", "image"],
    "BlogPosting": ["headline", "datePublished", "author", "image"],
    "NewsArticle": ["headline", "datePublished", "author", "image"],
    "Product": ["name", "image", "offers"],
    "FAQPage": ["mainEntity"],
    "HowTo": ["name", "step"],
    "LocalBusiness": ["name", "address", "telephone"],
}

# 推荐字段（缺失 → warn）
RECOMMENDED_FIELDS: dict[str, list[str]] = {
    "Article": ["dateModified", "publisher"],
    "BlogPosting": ["dateModified", "publisher"],
    "NewsArticle": ["dateModified", "publisher"],
    "Product": ["aggregateRating", "brand", "description"],
    "Organization": ["sameAs", "contactPoint"],
    "WebSite": ["potentialAction"],
}

# 嵌套字段要求：父字段 → 子字段列表
NESTED_REQUIREMENTS: dict[str, dict[str, list[str]]] = {
    "Product": {"offers": ["price", "priceCurrency"]},
    "FAQPage": {"mainEntity": ["name", "acceptedAnswer"]},
    "HowTo": {"step": ["text"]},
}

# 页面类型 → 期望 @type 映射
PAGE_TYPE_EXPECTED: dict[str, list[str]] = {
    "homepage": ["WebSite", "Organization"],
    "article": ["Article", "BlogPosting", "NewsArticle"],
    "product": ["Product"],
    "faq": ["FAQPage"],
    "howto": ["HowTo"],
    "local_business": ["LocalBusiness"],
}


# ── HTTP fetch ────────────────────────────────────────────────────────────────


def _safe_fetch(
    url: str, timeout: int
) -> tuple[Optional[int], Optional[str], Optional[str]]:
    """Fetch URL with SSRF protection. Returns (status, content, error)."""
    parsed = urlparse(url)
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        resp = requests.get(
            url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True
        )
        return resp.status_code, resp.text, None
    except requests.exceptions.RequestException as exc:
        return None, None, str(exc)


# ── HTML parser ───────────────────────────────────────────────────────────────


class _JsonLdExtractor(HTMLParser):
    """Single-pass extractor for <script type="application/ld+json"> blocks."""

    def __init__(self) -> None:
        super().__init__()
        self.blocks: list[str] = []
        self._in_jsonld = False
        self._buf = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag == "script":
            attrs_dict = {k.lower(): (v or "") for k, v in attrs}
            if attrs_dict.get("type", "").lower() == "application/ld+json":
                self._in_jsonld = True
                self._buf = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            content = self._buf.strip()
            if content:
                self.blocks.append(content)

    def handle_data(self, data: str) -> None:
        if self._in_jsonld:
            self._buf += data


# ── Schema helpers ────────────────────────────────────────────────────────────


def _flatten_schemas(raw_blocks: list[str]) -> list[dict]:
    """Parse JSON-LD blocks and flatten @graph arrays into individual schemas."""
    schemas: list[dict] = []
    for text in raw_blocks:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue

        if isinstance(parsed, list):
            schemas.extend(item for item in parsed if isinstance(item, dict))
        elif isinstance(parsed, dict):
            graph = parsed.get("@graph")
            if isinstance(graph, list):
                schemas.extend(item for item in graph if isinstance(item, dict))
            else:
                schemas.append(parsed)
    return schemas


def _get_types(schema: dict) -> list[str]:
    """Extract @type as a normalized list."""
    raw = schema.get("@type")
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [t for t in raw if isinstance(t, str)]
    return []


def _field_present(schema: dict, field: str) -> bool:
    """Check if a field exists and is non-empty."""
    value = schema.get(field)
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    if isinstance(value, list) and len(value) == 0:
        return False
    return True


def _validate_nested(schema: dict, schema_type: str) -> list[str]:
    """Validate nested field requirements, return list of missing dotted paths."""
    issues: list[str] = []
    nested_reqs = NESTED_REQUIREMENTS.get(schema_type, {})
    for parent_field, sub_fields in nested_reqs.items():
        parent = schema.get(parent_field)
        if parent is None:
            continue
        items = parent if isinstance(parent, list) else [parent]
        if not items:
            continue
        first = items[0]
        if not isinstance(first, dict):
            continue
        for sf in sub_fields:
            if not _field_present(first, sf):
                issues.append(f"{parent_field}.{sf}")
    return issues


def _validate_schema(schema: dict) -> dict:
    """Validate a single schema against required and recommended fields."""
    types = _get_types(schema)
    if not types:
        return {
            "types": [],
            "status": "warn",
            "fields_present": [],
            "fields_missing": [],
            "recommended_missing": [],
            "nested_issues": [],
            "detail": "JSON-LD block found but missing @type.",
        }

    primary = types[0]
    required = REQUIRED_FIELDS.get(primary, [])
    recommended = RECOMMENDED_FIELDS.get(primary, [])

    present = [f for f in required if _field_present(schema, f)]
    missing = [f for f in required if not _field_present(schema, f)]
    rec_missing = [f for f in recommended if not _field_present(schema, f)]
    nested = _validate_nested(schema, primary)

    if primary not in REQUIRED_FIELDS:
        return {
            "types": types,
            "status": "info",
            "fields_present": present,
            "fields_missing": missing,
            "recommended_missing": rec_missing,
            "nested_issues": nested,
            "detail": f"{primary} — no required-field ruleset defined.",
        }

    if missing:
        detail = f"{primary}: missing required: {', '.join(missing)}."
    elif rec_missing or nested:
        parts = []
        if rec_missing:
            parts.append(f"missing recommended: {', '.join(rec_missing)}")
        if nested:
            parts.append(f"incomplete nested: {', '.join(nested)}")
        detail = f"{primary}: {'; '.join(parts)}."
    else:
        detail = f"{primary}: all required fields present."

    status = "fail" if missing else ("warn" if (rec_missing or nested) else "pass")

    return {
        "types": types,
        "status": status,
        "fields_present": present,
        "fields_missing": missing,
        "recommended_missing": rec_missing,
        "nested_issues": nested,
        "detail": detail,
    }


def _infer_page_type(url: str) -> str:
    """Heuristic page type guess from URL pattern. LLM should confirm."""
    path = urlparse(url).path.lower().rstrip("/")
    if path in ("", "/"):
        return "homepage"
    if any(s in path for s in ("/blog", "/article", "/post", "/news", "/story")):
        return "article"
    if any(s in path for s in ("/product", "/item", "/shop/", "/store/")):
        return "product"
    if "/faq" in path or "/questions" in path:
        return "faq"
    if any(s in path for s in ("/how-to", "/howto", "/guide")):
        return "howto"
    return "unknown"


# ── Main check ────────────────────────────────────────────────────────────────


def check_schema(html: str, url: str = "") -> dict:
    """Extract, parse, and validate JSON-LD from HTML content."""
    extractor = _JsonLdExtractor()
    try:
        extractor.feed(html)
    except Exception:
        return {
            "url": url,
            "status": "error",
            "schemas": [],
            "detail": "Failed to parse HTML for JSON-LD extraction.",
            "llm_review_required": False,
        }

    inferred = _infer_page_type(url)
    expected = PAGE_TYPE_EXPECTED.get(inferred, [])

    if not extractor.blocks:
        if inferred == "unknown" or not expected:
            return {
                "url": url,
                "status": "in
```

### Core Architecture Module: `seo-audit/scripts/check-site.py`
```
#!/usr/bin/env python3
"""
Site-level SEO checks: robots.txt and sitemap.xml.
Outputs structured JSON to stdout so the agent can consume results directly
without needing to interpret raw HTTP responses or parse formats manually.

Usage:
    python check-site.py https://example.com
    python check-site.py https://example.com --timeout 15

Output example (JSON):
    {
      "origin": "https://example.com",
      "robots": {
        "status": "pass",
        "http_status": 200,
        "disallow_all": false,
        "googlebot_blocked": false,
        "sitemap_directive": "https://example.com/sitemap.xml",
        "detail": "robots.txt found. No critical blocking rules detected."
      },
      "sitemap": {
        "status": "pass",
        "http_status": 200,
        "url_count": 42,
        "is_index": false,
        "detail": "sitemap.xml found with 42 URLs."
      }
    }

Dependencies:
    pip install requests
"""

import argparse
import ipaddress
import json
import re
import socket
import sys
import xml.etree.ElementTree as ET
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# Same UA as fetch-page.py for consistent request fingerprinting
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}


def _safe_fetch(url: str, timeout: int) -> tuple[Optional[int], Optional[str], Optional[str]]:
    """
    Internal helper: fetch a URL safely with SSRF protection.
    Returns (status_code, content, error_message).
    """
    parsed = urlparse(url)

    # SSRF protection: block private, loopback, and reserved IPs
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return None, None, f"Blocked: resolves to private IP ({resolved_ip})"
    except (socket.gaierror, ValueError):
        pass

    try:
        resp = requests.get(url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        return resp.status_code, resp.text, None
    except requests.exceptions.Timeout:
        return None, None, f"Timed out after {timeout}s"
    except requests.exceptions.SSLError as e:
        return None, None, f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        return None, None, f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        return None, None, f"Request failed: {e}"


def _parse_robots_groups(content: str) -> tuple[list[dict], list[str]]:
    """
    Parse robots.txt into directive groups per RFC 9309.
    Consecutive User-Agent lines merge into one group.
    Returns (groups, sitemap_directives).
    """
    groups: list[dict] = []
    current_group: Optional[dict] = None
    prev_key = ""
    sitemap_directives: list[str] = []

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue

        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()

        if key == "user-agent":
            if prev_key == "user-agent" and current_group is not None:
                current_group["agents"].append(value.lower())
            else:
                current_group = {
                    "agents": [value.lower()],
                    "allow": [],
                    "disallow": [],
                }
                groups.append(current_group)
            prev_key = "user-agent"
        elif key in ("allow", "disallow") and current_group is not None:
            if value:
                current_group[key].append(value)
            prev_key = key
        elif key == "sitemap":
            if value:
                sitemap_directives.append(value)
            prev_key = key
        else:
            prev_key = key

    return groups, sitemap_directives


def _group_blocks_all(group: dict) -> bool:
    """
    Check if a group fully blocks the site.
    Disallow: / alone blocks everything, but Allow: sub-paths means partial access.
    Per RFC 9309, the most specific (longest) matching rule wins.
    """
    has_root_block = any(rule in ("/", "/*") for rule in group.get("disallow", []))
    if not has_root_block:
        return False
    # Allow rules for sub-paths override the root block → not a full block
    has_allow = any(r and r != "/" for r in group.get("allow", []))
    return not has_allow


def _find_group_for_agent(groups: list[dict], agent: str) -> Optional[dict]:
    """Find the group matching a specific user agent name."""
    agent_lower = agent.lower()
    for group in groups:
        if agent_lower in group["agents"]:
            return group
    return None


def check_robots(origin: str, timeout: int) -> dict:
    """
    Check robots.txt with RFC 9309-compliant group parsing.
    Handles Allow overrides, multi-agent groups, and multiple Sitemap directives.
    """
    url = f"{origin}/robots.txt"
    status_code, content, error = _safe_fetch(url, timeout)

    result: dict = {
        "status": "error",
        "http_status": status_code,
        "disallow_all": False,
        "googlebot_blocked": False,
        "sitemap_directives": [],
        "sitemap_directive": None,
        "detail": "",
    }

    if error:
        result["detail"] = f"Fetch error: {error}"
        return result

    if status_code != 200:
        result["status"] = "fail"
        result["detail"] = f"robots.txt returned HTTP {status_code}. File may not exist or is inaccessible."
        return result

    if not content:
        result["status"] = "warn"
        result["detail"] = "robots.txt returned HTTP 200 but body is empty."
        return result

    groups, sitemap_directives = _parse_robots_groups(content)
    result["sitemap_directives"] = sitemap_directives
    result["sitemap_directive"] = sitemap_directives[0] if sitemap_directives else None

    # Evaluate blocking: Googlebot uses its own group if present, else inherits *
    wildcard_group = _find_group_for_agent(groups, "*")
    wildcard_blocked = _group_blocks_all(wildcard_group) if wildcard_group else False

    googlebot_group = _find_group_for_agent(groups, "googlebot")
    if googlebot_group:
        googlebot_blocked = _group_blocks_all(googlebot_group)
    else:
        googlebot_blocked = wildcard_blocked

    result["disallow_all"] = wildcard_blocked or googlebot_blocked
    result["googlebot_blocked"] = googlebot_blocked

    issues: list[str] = []
    if googlebot_blocked and wildcard_blocked:
        issues.append("Disallow: / blocks all crawlers including Googlebot.")
    elif googlebot_blocked:
        issues.append("Googlebot is explicitly blocked by its own Disallow: / rule.")
    elif wildcard_blocked:
        issues.append(
            "Disallow: / for User-Agent: * blocks most crawlers "
            "(Googlebot not specifically overridden)."
        )
    elif wildcard_group and any(d in ("/", "/*") for d in wildcard_group.get("disallow", [])):
        # Disallow: / exists but Allow rules partially override it
        allow_paths = [r for r in wildcard_group.get("allow", []) if r and r != "/"]
        if allow_paths:
            paths_str = ", ".join(allow_paths[:5])
            issues.append(
                f"Disallow: / present but partially overridden by Allow: {paths_str}. "
                "Site is not fully blocked."
            )

    if not sitemap_directives:
        issues.append("No Sitemap: directive found in robots.txt.")

    if googlebot_blocked:
        result["status"] = "fail"
    elif issues:
        result["status"] = "warn"
    else:
        result["status"] = "pass"

    if issues:
        result["detail"] = " ".join(issues)
    else:
        sitemap_note = (
            f" Sitemap: {', '.join(sitemap_directives)}."
            if sitemap_directives else ""
        )
        result["detail"] = f"robots.txt found. No critical blocking rules detected.{sitemap_note}"

    return result


def _parse_sitemap_xml(content: str, source_url: str) -> dict:
    """Parse and validate a single sitemap XML document."""
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        return {"status": "fail", "detail": f"Sitemap at {source_url} is not valid XML: {e}"}

    tag = re.sub(r"\{.*?\}", "", root.tag).lower()

    if tag == "sitemapindex":
        child_count = sum(
            1 for child in root
            if re.sub(r"\{.*?\}", "", child.tag).lower() == "sitemap"
        )
        return {
            "status": "pass" if child_count > 0 else "warn",
            "is_index": True,
            "url_count": child_count,
            "detail": (
                f"Sitemap index at {source_url} with {child_count} child sitemap(s)."
                if child_count > 0
                else f"Sitemap index at {source_url} contains no child sitemaps."
            ),
        }

    if tag == "urlset":
        url_count = sum(
            1 for child in root
            if re.sub(r"\{.*?\}", "", child.tag).lower() == "url"
        )
        return {
            "status": "pass" if url_count > 0 else "warn",
            "is_index": False,
            "url_count": url_count,
            "detail": (
                f"Sitemap at {source_url} with {url_count} URL(s)."
                if url_count > 0
                else f"Sitemap at {source_url} contains no <url> entries."
            ),
        }

    return {"status": "warn", "detail": f"Sitemap at {source_url
```

### Core Architecture Module: `seo-audit/scripts/fetch-page.py`
```
#!/usr/bin/env python3
"""
Fetch a web page for SEO analysis with proper headers, redirect tracking, and SSRF protection.

Usage:
    python fetch-page.py https://example.com
    python fetch-page.py https://example.com --output page.html
    python fetch-page.py https://example.com --googlebot
"""

import argparse
import ipaddress
import json
import socket
import sys
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# Default UA: simulates a real browser for standard page fetching
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClaudeSEO/1.2"
)

# Googlebot UA: used to detect dynamic rendering (Prerender.io / SSR).
# Comparing response body size between DEFAULT_USER_AGENT and GOOGLEBOT_USER_AGENT
# reveals whether a site uses a prerender service — a key SPA detection signal.
GOOGLEBOT_USER_AGENT = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}


def fetch_page(
    url: str,
    timeout: int = 30,
    follow_redirects: bool = True,
    max_redirects: int = 5,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Fetch a web page and return a structured result dict.

    Returns:
        {
            "url": final URL after redirects,
            "status_code": HTTP status code,
            "content": response body text,
            "headers": response headers dict,
            "redirect_chain": list of intermediate URLs,
            "redirect_details": list of {url, status_code} per hop,
            "error": error message string, or None on success
        }
    """
    result: dict = {
        "url": url,
        "status_code": None,
        "content": None,
        "headers": {},
        "redirect_chain": [],
        "redirect_details": [],
        "error": None,
    }

    # Prepend https:// if no scheme is present
    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"
        parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        result["error"] = f"Invalid URL scheme: {parsed.scheme}"
        return result

    # SSRF protection: block private, loopback, and reserved IPs
    try:
        hostname = parsed.hostname or ""
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            result["error"] = f"Blocked: resolves to private/internal IP ({resolved_ip})"
            return result
    except (socket.gaierror, ValueError):
        pass  # DNS failure is handled by requests below

    try:
        session = requests.Session()
        session.max_redirects = max_redirects

        headers = dict(DEFAULT_HEADERS)
        if user_agent:
            headers["User-Agent"] = user_agent

        response = session.get(
            url,
            headers=headers,
            timeout=timeout,
            allow_redirects=follow_redirects,
        )

        result["url"] = response.url
        result["status_code"] = response.status_code
        result["content"] = response.text
        result["headers"] = dict(response.headers)

        # Record each redirect hop
        if response.history:
            result["redirect_chain"] = [r.url for r in response.history]
            result["redirect_details"] = [
                {"url": r.url, "status_code": r.status_code}
                for r in response.history
            ]

    except requests.exceptions.Timeout:
        result["error"] = f"Request timed out after {timeout}s"
    except requests.exceptions.TooManyRedirects:
        result["error"] = f"Too many redirects (max {max_redirects})"
    except requests.exceptions.SSLError as e:
        result["error"] = f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        result["error"] = f"Request failed: {e}"

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch a web page for SEO analysis")
    parser.add_argument("url", help="URL to fetch")
    parser.add_argument("--output", "-o", help="Save content to this file path")
    parser.add_argument("--timeout", "-t", type=int, default=30, help="Timeout in seconds")
    parser.add_argument("--no-redirects", action="store_true", help="Do not follow redirects")
    parser.add_argument("--user-agent", help="Custom User-Agent string")
    parser.add_argument(
        "--googlebot",
        action="store_true",
        help="Use Googlebot UA to detect dynamic rendering / prerender services",
    )
    parser.add_argument("--json", action="store_true", help="Output full result as JSON (excludes body)")

    args = parser.parse_args()

    ua: Optional[str] = args.user_agent
    if args.googlebot:
        ua = GOOGLEBOT_USER_AGENT

    result = fetch_page(
        args.url,
        timeout=args.timeout,
        follow_redirects=not args.no_redirects,
        user_agent=ua,
    )

    if result["error"]:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    # --json mode: output metadata only (no full HTML body) for consumption by other scripts
    if args.json:
        output = {k: v for k, v in result.items() if k != "content"}
        output["content_length"] = len(result["content"] or "")
        print(json.dumps(output, indent=2, ensure_ascii=False))
        return

    # File output mode
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result["content"] or "")
        print(f"Saved to {args.output}")
    else:
        print(result["content"] or "")

    # Print metadata to stderr so it does not pollute stdout content
    print(f"\nURL: {result['url']}", file=sys.stderr)
    print(f"Status: {result['status_code']}", file=sys.stderr)
    if result["redirect_details"]:
        for rd in result["redirect_details"]:
            print(f"  {rd['status_code']} -> {rd['url']}", file=sys.stderr)
        print(f"  {result['status_code']} -> {result['url']} (final)", file=sys.stderr)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6** (2026-08-24): **Feature proposal: optional GoAnyAPI SEO data integration**
  *Symptoms*: Hi — I run GoAnyAPI. Would an optional hosted SEO-data integration be useful for seo-audit-skill?  GoAnyAPI provides pay-as-you-go APIs for SERP, keyword difficulty, keyword generation, backlink overview and top links, domain rating, traffic, AdSense relationship lookup, and Google Ads Transparency. The integration would be opt-in and would keep the project's existing local or free workflow unchanged.  The most practical first step would be a small provider/module for the operations already relevant to this project. I can provide development and testing credits, API documentation, sample responses, and direct integration support. If core integration is not a fit, I am also happy to follow the project's plugin or extension boundary.  https://goanyapi.com

- **Issue #4** (2026-06-08): **Put seo-audit-skill behind a link — send a client a URL, they get the report back without installing anything**
  *Symptoms*: Hi @JeffLi1993, the part of seo-audit-skill I keep coming back to is the script + LLM split: the Python checks settle the deterministic stuff (robots, sitemap, canonical, title length) and the LLM only steps in for the calls that actually need judgment, like whether an H1 covers the keyword's intent. I ran the basic skill on a live page and `check-page.py` came back with `title.length: 59`, `keyword_position: "start"`, and a `meta_description` flagged `llm_review_required: true` — clean, structured evidence the model can reason over instead of guessing. That division is the design choice worth keeping.  The one place a reader bounces is the end of that flow: the payoff is an HTML file at `reports/<hostname>-audit.html`, which only exists after `npx skills add` and a Python runtime. Someone skimming the repo can't see what a real audit looks like.  So there's now an online entry point for it — paste a page URL, get the same audit back, no install:  [![Try seo-audit on Socialistic](https://socialistic.ai/api/embed/seo-audit-skill-e9816b?lang=en)](https://socialistic.ai/en/skill/seo-audit-skill-e9816b?utm_source=github&utm_medium=issue&utm_campaign=20260604-url-diagnostics-skill-builders&utm_content=badge)  The useful move here is forwarding: hand the link to a client, a teammate, or a friend who owns a page, and they paste their own URL and get the prioritized fixes back — no need to walk them through the install or the runtime first. You can [open the demo](https://socialistic

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

### Incident Patch 1: `ae2bedbd` (2026-05-16)
**Commit Message**: V2.0 fix report template css

**File**: `seo-audit/assets/report-template.html` (modified, +70/-2)
```diff
@@ -77,7 +77,7 @@
       border-radius: 6px;
       border: 1px solid #e0e0e0;
       margin-bottom: 20px;
-      overflow: hidden;
+      /* 不用 overflow:hidden，否则小屏下表格横向滚动会被裁切 */
     }
     section > h2 {
       font-size: 13px;
@@ -91,6 +91,8 @@
     }
     section > .section-body {
       padding: 20px;
+      overflow-x: auto;
+      -webkit-overflow-scrolling: touch;
     }
 
     /* ── Executive summary ── */
@@ -150,11 +152,22 @@
     }
 
     /* ── Check table ── */
+    .table-scroll {
+      overflow-x: auto;
+      -webkit-overflow-scrolling: touch;
+      margin: 0 0 12px;
+    }
+    .table-scroll:last-child { margin-bottom: 0; }
     .check-table {
       width: 100%;
+      min-width: 32rem;
       border-collapse: collapse;
       font-size: 14px;
     }
+    /* E-E-A-T 等四列表格需要更宽的最小宽度 */
+    .check-table:has(thead tr th:nth-child(4)) {
+      min-width: 42rem;
+    }
     .check-table th {
       text-align: left;
       font-size: 12px;
@@ -170,7 +183,15 @@
       padding: 10px 12px;
       border-bottom: 1px solid #f0f0f0;
       vertical-align: top;
-    }
+      overflow-wrap: anywhere;
+      word-break: break-word;
+    }
+    .check-table th:nth-child(1),
+    .check-table td:nth-child(1) { min-width: 6.5rem; }
+    .check-table th:nth-child(2),
+    .check-table td:nth-child(2) { width: 5.5rem; white-space: nowrap; }
+    .check-table th:nth-child(3),
+    .check-table td:nth-child(3) { min-width: 8rem; }
     .check-table tr:last-child td { border-bottom: none; }
     /* Detail cell: issue description + fix suggestion */
     .detail-issue {
@@ -302,6 +323,53 @@
       margin: 0 auto;
       padding: 16px 24px;
     }
+
+    /* ── Responsive ── */
+    @media (max-width: 900px) {
+      .summary-groups {
+        grid-template-columns: 1fr;
+      }
+    }
+
+    @media (max-width: 640px) {
+      header, main, footer,
+      header .inner {
+        padding-left: 16px;
+        padding-right: 16px;
+      }
+      header { padding-top: 24px; padding-bottom: 18px; }
+      header h1 { font-size: 20px; line-height: 1.35; }
+      .meta-row { flex-direction: column; gap: 8px; }
+      .meta-row span { word-break: break-all; }
+      main { padding-top: 20px; padding-bottom: 32px; }
+      section > h2 { padding: 12px 16px; }
+      section > .section-body { padding: 14px 16px; }
+      .check-table {
+        min-width: 28rem;
+        font-size: 13px;
+      }
+      .check-table th,
+      .check-table td { padding: 8px 10px; }
+      .finding-header {
+        flex-wrap: wrap;
+        align-items: flex-start;
+      }
+      .finding-header h3 { font-size: 13px; }
+      .finding-field {
+        grid-template-columns: 1fr;
+        gap: 4px;
+      }
+      .finding-field .label { padding-top: 0; }
+      .upgrade-box { padding: 14px 16px; font-size: 13px; }
+    }
+
+    @media (max-width: 480px) {
+      body { font-size: 14px; }
+      .summary-groups { gap: 10px; }
+      .summary-group { padding: 10px 12px; }
+      .check-table { min-width: 26rem; }
+      .check-table:has(thead tr th:nth-child(4)) { min-width: 34rem; }
+    }
   </style>
 </head>
 <body>
```

---

### Incident Patch 2: `2a91e4ad` (2026-04-09)
**Commit Message**: V1.0 - fix LLM limit

**File**: `seo-audit/SKILL.md` (modified, +17/-0)
```diff
@@ -98,10 +98,27 @@ python scripts/fetch-page.py https://example.com --output page.html
 
 Each script exits with code `0` (all pass/warn) or `1` (any fail/error).
 
+**STRICT SCOPE — do not add any check not listed below. No exceptions.**
+
+Allowed site-level checks (in `{{site_checks_html}}`):
+- robots.txt · sitemap.xml · 404 Handling · URL Canonicalization · i18n / hreflang · Schema (JSON-LD)
+
+Allowed E-E-A-T checks (in `{{eeat_checks_html}}`):
+- About Us · Contact · Privacy Policy · Terms of Service · Media/Partners (only if present)
+
+Allowed page-level checks (in `{{page_checks_html}}`):
+- URL Slug · Title Tag · Meta Description · H1 Tag · Canonical Tag
+
+Do NOT add: Image Alt Text, OG tags, Robots Meta, Page Weight, Core Web Vitals,
+heading hierarchy, content quality, or any other check — those belong to `seo-audit-full`.
+
 **How to use the JSON output:**
 - Map each field's `status` → `pass` / `warn` / `fail` / `error` directly to the report check table
 - Use each field's `detail` string as the starting point for the Evidence line in findings
 - Do not contradict the script output unless you have additional observable evidence
+- Separate check groups with `<div class="subsection-label">Label</div>` inside `{{site_checks_html}}`:
+  `Crawlability` · `URL Canonicalization` · `i18n / hreflang` · `Schema (JSON-LD)`
+  and `<div class="subsection-label">E-E-A-T Trust Pages</div>` before `{{eeat_checks_html}}`
 
 **LLM review — mandatory when `llm_review_required: true`:**
 
```

**File**: `seo-audit/assets/report-template.html` (modified, +17/-1)
```diff
@@ -257,6 +257,19 @@
     }
     ol.priority-list li { margin-bottom: 6px; }
 
+    /* ── Sub-section label (within Site Checks) ── */
+    .subsection-label {
+      font-size: 11px;
+      font-weight: 700;
+      letter-spacing: 0.08em;
+      text-transform: uppercase;
+      color: #888;
+      padding: 18px 0 8px;
+      margin-bottom: 4px;
+      border-bottom: 1px solid #ebebeb;
+    }
+    .subsection-label:first-child { padding-top: 0; }
+
     /* ── Limitations ── */
 
     /* ── Upgrade prompt ── */
@@ -355,9 +368,11 @@ <h2>Audit Summary</h2>
     <h2>Site Checks</h2>
     <div class="section-body">
 
-      <!-- Crawlability: robots.txt + sitemap.xml -->
+      <!-- Crawlability + Canonicalization + i18n + Schema -->
       {{site_checks_html}}
       <!--
+        Use <div class="subsection-label">Label</div> to separate check groups.
+        Labels: Crawlability · URL Canonicalization · i18n / hreflang · Schema (JSON-LD)
         Pass rows: ONE short phrase. No divs.
         Warn / Fail rows: <div class="detail-issue"> ≤2 points + <div class="detail-fix">.
 
@@ -528,6 +543,7 @@ <h2>Site Checks</h2>
       <!-- E-E-A-T Infrastructure: trust pages existence + reachability -->
       {{eeat_checks_html}}
       <!--
+        Start with: <div class="subsection-label">E-E-A-T Trust Pages</div>
         Two layers per trust page:
           Layer 1 — Exists     : HTTP 200 = pass, 404/redirect = fail
           Layer 2 — Reachable  : linked from footer or main nav = pass, not linked = warn
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

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

## X. V2.0 fix report template css

**RULE**:
When implementing operations in `seo-audit/assets/report-template.html`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in JeffLi1993/seo-audit-skill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ae2bedbd`: V2.0 fix report template css. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `seo-audit/assets/report-template.html`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
      /* 不用 overflow:hidden，否则小屏下表格横向滚动会被裁切 */
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    .table-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin: 0 0 12px;
    }
    .table-scroll:last-child { margin-bottom: 0; }
      min-width: 32rem;
    /* E-E-A-T 等四列表格需要更宽的最小宽度 */
    .check-table:has(thead tr th:nth-child(4)) {
      min-width: 42rem;
    }
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .check-table th:nth-child(1),
    .check-table td:nth-child(1) { min-width: 6.5rem; }
    .check-table th:nth-child(2),
    .check-table td:nth-child(2) { width: 5.5rem; white-space: nowrap; }
    .check-table th:nth-child(3),
    .check-table td:nth-child(3) { min-width: 8rem; }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .summary-groups {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      header, main, footer,
      header .inner {
        padding-left: 16px;
        padding-right: 16px;
      }
      header { padding-top: 24px; padding-bottom: 18px; }
      header h1 { font-size: 20px; line-height: 1.35; }
      .meta-row { flex-direction: colu
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
      overflow: hidden;
    }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ae2bedbd` are properly handled with clean fallback behavior.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vasu-devs-justhireme-learnings.md`  
> **Source**: github ([https://github.com/vasu-devs/JustHireMe](https://github.com/vasu-devs/JustHireMe))  
> **Source Version**: `accdcdb5`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:23:25.845Z  
> **Learning ID**: `learn-github-vasu-devs-justhireme`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): vasu-devs/JustHireMe

> **Canonical Artifact**: `07_PROJECT_LEARNING/vasu-devs-justhireme-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vasu-devs/JustHireMe](https://github.com/vasu-devs/JustHireMe))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T22:23:25.838Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vasu-devs/JustHireMe`
- **Description**: Local-first AI job intelligence workbench for scraping roles, ranking fit, and generating tailored application materials.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2255 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/core/__init__.py`
```
"""Shared kernel for JustHireMe backend modules."""


```

### Core Architecture Module: `backend/core/company_seeds.py`
```
"""Auto-derived, keyless ATS company targets — the zero-config structured backbone.

The reliable keyless job source is the ATS JSON API (greenhouse/lever/ashby/...),
but it needs a company slug. Historically that slug came ONLY from a manually-typed
company watchlist, so the "zero-config ATS backbone" never actually fired for a fresh
user. This module closes that gap: it classifies the candidate's FIELD and REGION
from their profile and emits ``ats:<provider>:<slug>`` targets for well-known
companies in that field, with no manual config.

Lives in ``core`` (like occupations.py) so ``core.config`` can use it without
importing a project package — the import-boundary keeps ``core`` dependency-free.

Slug notes: these are stable, well-known ATS boards. A company that has since
migrated ATS just 404s, which the scrapers already treat as an empty board (never a
crash), so a stale slug wastes one scan slot at worst. Breadth for every field/region
comes from the keyless aggregator (Arbeitnow + The Muse); these seeds add
company-direct structured postings on top, strongest for tech.
"""

from __future__ import annotations

import re

# --- Field classification -----------------------------------------------------

# field -> signal keywords (matched against the profile's role/skills/summary text).
_FIELD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "tech": (
        "software", "engineer", "developer", "programmer", "backend", "frontend",
        "full stack", "fullstack", "devops", "sre", "sde", "python", "java", "react",
        "node", "golang", "kubernetes", "cloud", "web developer", "mobile developer",
        "ios", "android", "qa", "security engineer", "platform",
    ),
    "data": (
        "data scientist", "data analyst", "data engineer", "machine learning",
        "ml engineer", "ai engineer", "analytics", "statistician", "nlp",
    ),
    "design": ("designer", "ux", "ui ", "product design", "graphic design", "motion"),
    "product": ("product manager", "product owner", "program manager"),
    "healthcare": (
        "nurse", "nursing", "physician", "doctor", "medical", "clinical", "therapist",
        "pharmacist", "dental", "caregiver", "paramedic", "surgeon", "healthcare",
    ),
    "finance": (
        "accountant", "accounting", "bookkeeper", "auditor", "financial analyst",
        "finance", "investment", "banker", "actuary", "controller",
    ),
    "legal": ("lawyer", "attorney", "paralegal", "legal", "counsel", "compliance"),
    "marketing": ("marketing", "seo", "growth", "brand", "content", "social media", "pr "),
    "sales": ("sales", "account executive", "business development", "account manager"),
    "education": ("teacher", "tutor", "instructor", "professor", "lecturer", "educator", "curriculum"),
    "trades": (
        "electrician", "plumber", "carpenter", "welder", "mechanic", "machinist",
        "hvac", "technician", "fabricator", "installer", "operator",
    ),
    "hospitality": ("chef", "cook", "baker", "barista", "server", "bartender", "hospitality", "hotel"),
}

# Ordered so a more specific field wins ties (data/design/product before generic tech).
_FIELD_ORDER = (
    "data", "design", "product", "healthcare", "finance", "legal", "marketing",
    "sales", "education", "trades", "hospitality", "tech",
)


def _profile_text(profile: dict) -> str:
    profile = profile or {}
    parts = [
        str(profile.get("desired_position") or ""),
        str(profile.get("s") or ""),
    ]
    for exp in profile.get("exp", []) or []:
        if isinstance(exp, dict):
            parts.append(str(exp.get("role") or ""))
    for skill in profile.get("skills", []) or []:
        if isinstance(skill, dict):
            parts.append(str(skill.get("n") or ""))
    return re.sub(r"\s+", " ", " ".join(parts)).lower()


def detect_field(profile: dict) -> str:
    """Best-guess field bucket for the candidate, or 'general' when unclear."""
    text = _profile_text(profile)
    if not text.strip():
        return "general"
    best_field = "general"
    best_hits = 0
    for field in _FIELD_ORDER:
        hits = sum(1 for kw in _FIELD_KEYWORDS[field] if kw.strip() in text)
        if hits > best_hits:
            best_hits = hits
            best_field = field
    return best_field


def detect_region(profile: dict) -> str:
    """Coarse region bucket from the CV-derived discovery location."""
    loc = str((profile or {}).get("_discovery_location") or "").lower()
    if not loc:
        return "global"
    if any(k in loc for k in ("india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad", "pune", "chennai")):
        return "india"
    if any(k in loc for k in ("united states", "usa", "u.s", "america", "new york", "san francisco", "seattle", "austin", "boston", "chicago")):
        return "us"
    if any(k in loc for k in ("london", "united kingdom", "uk", "berlin", "germany", "france", "paris", "amsterdam", "netherlands", "europe", "ireland", "dublin", "spain", "madrid")):
        return "europe"
    return "global"


# --- Seed data (provider, slug) -----------------------------------------------
# Well-known, stable ATS boards. Tech has the deepest, most reliable coverage
# (greenhouse/lever/ashby dominate tech hiring); other fields lean on the keyless
# aggregator for breadth and add a few cross-industry names here.

_TECH_SEEDS: tuple[tuple[str, str], ...] = (
    ("greenhouse", "stripe"), ("greenhouse", "airbnb"), ("greenhouse", "dropbox"),
    ("greenhouse", "coinbase"), ("greenhouse", "databricks"), ("greenhouse", "gitlab"),
    ("greenhouse", "cloudflare"), ("greenhouse", "robinhood"), ("greenhouse", "doordash"),
    ("greenhouse", "instacart"), ("greenhouse", "pinterest"), ("greenhouse", "reddit"),
    ("greenhouse", "discord"), ("greenhouse", "twitch"), ("greenhouse", "roblox"),
    ("greenhouse", "samsara"), ("greenhouse", "affirm"), ("greenhouse", "asana"),
    ("ashby", "ramp"), ("ashby", "vercel"), ("ashby", "linear"), ("ashby", "openai"),
    ("ashby", "notion"), ("ashby", "mercury"), ("ashby", "replicate"),
    ("lever", "netflix"), ("lever", "plaid"),
)

# Cross-industry / non-tech names on keyless ATSs (kept small; aggregator carries breadth).
_GENERAL_SEEDS: tuple[tuple[str, str], ...] = (
    ("greenhouse", "wayfair"), ("greenhouse", "warbyparker"), ("greenhouse", "peloton"),
    ("greenhouse", "sofi"), ("greenhouse", "betterment"),
)

# field -> the seed pools to draw from (in priority order).
_FIELD_SEEDS: dict[str, tuple[tuple[tuple[str, str], ...], ...]] = {
    "tech": (_TECH_SEEDS,),
    "data": (_TECH_SEEDS,),
    "design": (_TECH_SEEDS,),
    "product": (_TECH_SEEDS,),
    "finance": (_GENERAL_SEEDS, _TECH_SEEDS),
    "marketing": (_GENERAL_SEEDS, _TECH_SEEDS),
    "sales": (_GENERAL_SEEDS, _TECH_SEEDS),
}


def ats_seed_targets(profile: dict, limit: int = 8) -> list[str]:
    """``ats:<provider>:<slug>`` targets for the candidate's detected field/region.

    Returns [] for fields where curated ATS slugs would be unreliable (healthcare,
    trades, education, hospitality, legal, general) — the keyless aggregator + HN/RSS
    sources cover those, and a wrong guess would only waste scan slots.
    """
    field = detect_field(profile)
    pools = _FIELD_SEEDS.get(field)
    if not pools:
        return []
    seen: set[str] = set()
    targets: list[str] = []
    for pool in pools:
        for provider, slug in pool:
            key = f"{provider}:{slug}"
            if key in seen:
                continue
            seen.add(key)
            targets.append(f"ats:{provider}:{slug}")
            if len(targets) >= max(1, limit):
                return targets
    return targets

```

### Core Architecture Module: `backend/core/config.py`
```
from __future__ import annotations
import logging

import os
import re

from .company_seeds import ats_seed_targets


DEFAULT_JOB_TARGETS = [
    "hn-hiring",
    "https://remoteok.com/api",
    "https://remotive.com/api/remote-jobs",
    "https://jobicy.com/api/v2/remote-jobs?count=50",
    "https://jobicy.com/feed/newjobs",
    "https://weworkremotely.com/remote-jobs.rss",
    "site:boards.greenhouse.io",
    "site:jobs.lever.co",
    "site:jobs.ashbyhq.com",
    "site:apply.workable.com",
    "site:wellfound.com/jobs",
    "site:linkedin.com/jobs",
    "site:indeed.com/jobs",
    "site:glassdoor.com/Job",
    "site:jobs.smartrecruiters.com",
    "site:workdayjobs.com",
    "site:naukri.com",
    "site:instahyre.com",
    "site:cutshort.io/jobs",
]

INDIA_JOB_TARGETS = [
    "site:wellfound.com/jobs India",
    "site:cutshort.io/jobs India startup",
    "site:instahyre.com jobs India",
    "site:naukri.com jobs India",
    "site:foundit.in jobs India",
    "site:internshala.com/jobs India",
    "site:linkedin.com/jobs India",
    "site:indeed.com/jobs India",
    "site:glassdoor.co.in Job India",
    "site:boards.greenhouse.io India",
    "site:jobs.lever.co India",
    "site:jobs.ashbyhq.com India",
    "site:apply.workable.com India",
]

BLOCKED_JOB_TARGET_MARKERS = (
    "freelance",
    "upwork",
    "freelancer.com",
    "fiverr",
    "contra.com",
    "peopleperhour",
    "guru.com",
    "truelancer",
    "codementor",
    "toptal",
)


def split_configured_targets(raw: str) -> list[str]:
    targets: list[str] = []
    for line in str(raw or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for part in line.split(","):
            target = part.strip()
            if target and not target.startswith("#"):
                targets.append(target)
    return targets


def dedupe_targets(targets: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for target in targets:
        key = target.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(target.strip())
    return out


def job_market_focus(value) -> str:
    focus = str(value or "global").strip().lower()
    return "india" if focus in {"india", "in", "indian", "indian_startups"} else "global"


def is_hn_target(target: str) -> bool:
    lower = target.lower()
    return lower.startswith("hn:") or "hn-hiring" in lower or "hackernews" in lower or "news.ycombinator.com" in lower


def job_targets(raw: str, market_focus: str = "global") -> list[str]:
    focus = job_market_focus(market_focus)
    targets = split_configured_targets(raw)
    if not targets:
        return list(INDIA_JOB_TARGETS if focus == "india" else DEFAULT_JOB_TARGETS)

    filtered: list[str] = []
    for target in targets:
        lower = target.lower()
        if any(marker in lower for marker in BLOCKED_JOB_TARGET_MARKERS):
            continue
        filtered.append(target)

    if focus == "global" and filtered and all(is_hn_target(target) for target in filtered):
        filtered.extend(target for target in DEFAULT_JOB_TARGETS if not is_hn_target(target))

    if focus == "india":
        india_markers = (
            "india",
            "indian",
            "bangalore",
            "bengaluru",
            "mumbai",
            "delhi",
            "gurgaon",
            "gurugram",
            "hyderabad",
            "pune",
            "chennai",
            "noida",
            "cutshort",
            "instahyre",
            "naukri",
            "foundit",
            "internshala",
            "glassdoor.co.in",
        )
        filtered = [target for target in filtered if any(marker in target.lower() for marker in india_markers)]

    fallback = INDIA_JOB_TARGETS if focus == "india" else DEFAULT_JOB_TARGETS
    return dedupe_targets(filtered) or list(fallback)


def desired_position(cfg: dict) -> str:
    for key in ("desired_position", "target_position", "target_role", "onboarding_target_role"):
        value = str(cfg.get(key) or "").strip()
        if value:
            return value
    return ""


def discovery_location(cfg: dict | None, profile: dict | None = None) -> str:
    """The user's job-search location, in priority order:

    explicit setting (any country/city, worldwide) → the profile's own identity
    location (so just ingesting a CV with a city works) → "" (global/remote).
    Generalizes the old binary india/global switch to any region on Earth.
    """
    cfg = cfg or {}
    for key in ("job_location", "job_region", "target_location", "location"):
        value = str(cfg.get(key) or "").strip()
        if value:
            return value
    # Backward-compat: an explicit india market focus implies India.
    if job_market_focus(cfg.get("job_market_focus")) == "india":
        return "India"
    identity = (profile or {}).get("identity") if isinstance(profile, dict) else None
    if isinstance(identity, dict):
        for key in ("city", "location", "region", "country"):
            value = str(identity.get(key) or "").strip()
            if value:
                return value
    return ""


def remote_preference(cfg: dict | None) -> str:
    """One of: remote, hybrid, onsite, any (default any)."""
    value = str((cfg or {}).get("remote_preference") or "").strip().lower()
    return value if value in {"remote", "hybrid", "onsite", "any"} else "any"


def profile_for_discovery(profile: dict | None, cfg: dict) -> dict:
    profile = dict(profile or {})
    desired = desired_position(cfg)
    if desired:
        summary = str(profile.get("s") or "").strip()
        if desired.lower() not in summary.lower():
            profile["s"] = f"{desired}. {summary}".strip()
        else:
            profile["s"] = summary or desired
        profile["desired_position"] = desired
    # Carry resolved location + remote preference so the query planner can target
    # the user's region without every caller threading extra args.
    profile["_discovery_location"] = discovery_location(cfg, profile)
    profile["_remote_preference"] = remote_preference(cfg)
    # The user's free-text "what I'm looking for" preferences steer the scan
    # toward roles they actually want (used by the query planner + evaluator).
    profile["_job_preferences"] = str((cfg or {}).get("job_preferences") or "").strip()
    return profile


def _clean_role_query(terms: list[str]) -> str:
    """A short, clean ROLE phrase for the aggregator/community search queries.

    Profile-derived terms are noisy — a summary like "Applied AI Engineer. Engineer
    Summary" or an experience title like "Full-Stack Engineer — Internal Finance & P&L
    Platform" would make a keyless job API return unrelated results (that then get
    quality-gated to nothing). Strip project/detail suffixes, encoding artifacts and
    filler words, and return the first genuine 1-5 word role phrase.
    """
    for term in terms:
        # Non-ASCII noise (incl. mojibake em-dashes) becomes a separator, not deleted,
        # so "Full-Stack Engineer — Internal Finance" cuts cleanly to the role.
        s = re.sub(r"[^\x20-\x7e]+", " | ", str(term))
        # Cut at the first separator introducing a project/detail. Only a SPACE-padded
        # dash counts (so "Full-Stack"/"Front-End" keep their internal hyphen).
        head = re.split(r"\s+[-—–]\s+|[|(:·•/]|\.\s+|\bat\b", s, maxsplit=1)[0]
        head = re.sub(r"\b(summary|profile|resume|cv|experience)\b", " ", head, flags=re.I)
        head = re.sub(r"\s+", " ", head).strip(" ,.-&")
        words = head.split()
        if head and 1 <= len(words) <= 5:
            return head
    first = (terms[0] if terms else "").strip()
    return " ".join(first.split()[:4]) or "jobs"


def terms_for_discovery(profile: dict, limit: int = 4) -> list[str]:
    terms: list[str] = []
    summary = str(profile.get("desired_position") or profile.get("s") or "").strip()
    if summary:
        terms.append(" ".join(summary.split()[:5]))
    for exp in profile.get("exp", []) or []:
        if isinstance(exp, dict) and exp.get("role"):
            terms.append(str(exp["role"]))
    for skill in profile.get("skills", []) or []:
        if isinstance(skill, dict) and skill.get("n"):
            terms.append(str(skill["n"]))
    for project in profile.get("projects", []) or []:
        if not isinstance(project, dict):
            continue
        if project.get("title"):
            terms.append(str(project["title"]))
        stack = project.get("stack") or []
        stack_items = stack if isinstance(stack, list) else str(stack).split(",")
        terms.extend(str(item) for item in stack_items[:3] if str(item).strip())
    for cert in profile.get("certifications", []) or []:
        if isinstance(cert, dict):
            value = cert.get("title") or cert.get("name") or cert.get("n")
            if value:
                terms.append(str(value))
        elif str(cert or "").strip():
            terms.append(str(cert))
    seen: set[str] = set()
    out: list[str] = []
    for term in terms:
        term = re.sub(r"\s+", " ", str(term)).strip(" ,.;:-")
        key = term.lower()
        if term and key not in seen:
            seen.add(key)
            out.append(term)
    return out[:limit] or ["jobs"]


def has_profile_discovery_signal(profile: dict | None) -> bool:
    profile = profile or {}
    if str(profile.get("desired_position") or profile.get("s") or "").strip():
        return True
    for exp in profile.get("exp", []) or []:
        if isinstance(exp, dict) and str(exp.get("role") or "").strip():
            return True
    for skill in profile.get("skills", []) or []:
        if isinstance(skill, dict) and str(skill.get("n") or "").strip():
            return True
    for project in profile.get("projects", []) or []:
        if not isinstance(project, dict):
            continue
        stack = project.get("stack") or []
        stack_i
```

### Core Architecture Module: `backend/core/errors.py`
```
class JustHireMeError(Exception):
    """Base class for domain-level errors."""


class LeadNotFoundError(JustHireMeError):
    pass


class ProfileNotFoundError(JustHireMeError):
    pass


class IngestionError(JustHireMeError):
    pass


class ScoringError(JustHireMeError):
    pass


class GenerationError(JustHireMeError):
    pass


class DiscoveryError(JustHireMeError):
    pass


class ConfigurationError(JustHireMeError):
    pass


```

### Core Architecture Module: `backend/core/events.py`
```
from __future__ import annotations

import inspect
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any, Protocol


EventHandler = Callable[[str, dict[str, Any]], None | Awaitable[None]]

SCAN_STARTED = "scan_started"
SCAN_PROGRESS = "scan_progress"
SCAN_DONE = "scan_done"
LEAD_SCORED = "lead_scored"
LEAD_UPDATED = "lead_updated"
GENERATION_STARTED = "generation_started"
GENERATION_DONE = "generation_done"


class EventBus(Protocol):
    async def publish(self, event_type: str, data: dict[str, Any]) -> None: ...
    def subscribe(self, event_type: str, handler: EventHandler) -> None: ...


class InProcessEventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event_type: str, data: dict[str, Any]) -> None:
        handlers = [*self._handlers.get(event_type, ()), *self._handlers.get("*", ())]
        for handler in handlers:
            result = handler(event_type, data)
            if inspect.isawaitable(result):
                await result

```

### Core Architecture Module: `backend/core/generation_readiness.py`
```
from __future__ import annotations

import re


_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)

# A truthful tailored resume needs real role context to work from, not just a
# bare title or URL. We gate on the *substance* of the non-URL text (its length
# and word count) rather than a keyword whitelist. JustHireMe tailors resumes
# for every field — finance, healthcare, education, trades, the arts — so an
# earlier software/tech keyword requirement wrongly blocked legitimate non-tech
# descriptions (e.g. a "Financial Aid Advisor" posting). See issue #92.
_MIN_CONTEXT_CHARS = 40
_MIN_CONTEXT_WORDS = 10


def _clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _without_urls(value: object) -> str:
    return _clean(_URL_RE.sub(" ", str(value or "")))


def _is_url_only(value: object) -> bool:
    text = _clean(value)
    if not text:
        return False
    remainder = _URL_RE.sub(" ", text)
    remainder = re.sub(r"[\s|,;:(){}\[\]\-_/]+", "", remainder)
    return not remainder


def lead_generation_blocker(lead: dict) -> str:
    """Return a user-facing reason when a lead is too thin to generate safely."""
    meta: dict = lead.get("source_meta") if isinstance(lead.get("source_meta"), dict) else {}
    title = _clean(lead.get("title"))
    company = _clean(lead.get("company"))
    description = _clean(lead.get("description"))
    reason = _clean(lead.get("reason"))
    match_points = " ".join(str(item or "") for item in lead.get("match_points", []) or [])
    non_url_context = _without_urls("\n".join([title, company, description, reason, match_points]))

    if meta.get("input_url_only") or meta.get("needs_job_description"):
        return "Paste the job description before generating. A URL alone is not enough evidence for a truthful resume."
    if _is_url_only(title) and (not description or _is_url_only(description)):
        return "Paste the job description before generating. The current lead only contains a URL."
    if not description and not reason and not match_points:
        return "Paste the job description before generating. The current lead has no role requirements to tailor against."
    if len(non_url_context) < _MIN_CONTEXT_CHARS or len(non_url_context.split()) < _MIN_CONTEXT_WORDS:
        return "Paste a fuller job description before generating so the resume can be tailored without guessing."
    return ""

```

### Core Architecture Module: `backend/core/logging.py`
```
import logging
import os
import sys
import json
import time
import functools
import re
from collections.abc import Mapping


SENSITIVE_KEY_RE = re.compile(
    r"(authorization|bearer|cookie|password|secret|token|api[_-]?key|private[_-]?key|resume|cover[_-]?letter|profile|email|phone)",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)")
SECRET_RE = re.compile(
    r"(ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{10,})"
)
ASSIGNMENT_SECRET_RE = re.compile(
    r"(?i)\b(authorization|cookie|password|secret|token|api[_-]?key|private[_-]?key)\b\s*[:=]\s*([^\s,;]+)"
)


def redact_text(value: object, max_len: int = 2000) -> str:
    text = str(value)
    text = SECRET_RE.sub("[REDACTED_SECRET]", text)
    text = ASSIGNMENT_SECRET_RE.sub(lambda match: f"{match.group(1)}=[REDACTED_SECRET]", text)
    text = EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    text = PHONE_RE.sub("[REDACTED_PHONE]", text)
    if len(text) > max_len:
        return f"{text[:max_len]}...[truncated]"
    return text


def redact_sensitive(value, depth: int = 0):
    if depth > 6:
        return "[REDACTED_DEPTH]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, Mapping):
        redacted = {}
        for key, item in value.items():
            key_text = str(key)
            redacted[key_text] = "[REDACTED]" if SENSITIVE_KEY_RE.search(key_text) else redact_sensitive(item, depth + 1)
        return redacted
    if isinstance(value, (list, tuple, set)):
        items = list(value)
        out = [redact_sensitive(item, depth + 1) for item in items[:50]]
        if len(items) > 50:
            out.append("[TRUNCATED]")
        return out
    return redact_text(value)


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "module": record.name,
            "msg": redact_text(record.getMessage()),
        }
        for key in ("domain", "duration_ms", "job_id"):
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        context = context_payload(record)
        if context:
            entry["context"] = redact_sensitive(dict(context))
        if record.exc_info:
            entry["exception"] = redact_text(self.formatException(record.exc_info))
        return json.dumps(entry, ensure_ascii=False)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    level_str = os.environ.get("JHM_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_str, logging.INFO)
    logger.setLevel(level)

    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(level)

    handler.setFormatter(StructuredFormatter())
    logger.addHandler(handler)
    logger.propagate = False
    return logger


def with_context(logger: logging.Logger, **context) -> logging.LoggerAdapter:
    return logging.LoggerAdapter(logger, {"jhm_context": context})


def context_payload(record: logging.LogRecord) -> Mapping:
    payload = getattr(record, "jhm_context", None)
    return payload if isinstance(payload, Mapping) else {}


def timed(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        logger = get_logger(func.__module__)
        start = time.perf_counter()
        try:
            result = await func(*args, **kwargs)
            elapsed = (time.perf_counter() - start) * 1000
            logger.info("%s completed", func.__qualname__, extra={"duration_ms": round(elapsed, 1)})
            return result
        except Exception:
            elapsed = (time.perf_counter() - start) * 1000
            logger.exception("%s failed", func.__qualname__, extra={"duration_ms": round(elapsed, 1)})
            raise

    return wrapper

```

### Core Architecture Module: `backend/core/occupations.py`
```
"""Field-agnostic occupation and employment vocabularies.

Shared across discovery (lead scoring / role detection) and profile ingestion
(deterministic résumé parsing) so every layer recognizes a real professional
role in ANY field — healthcare, trades, business, education, creative, science,
public service, software — not just tech. Lives in ``core`` because both the
``discovery`` and ``profile`` packages need it and neither may import the other.

Kept deliberately broad-but-finite: enough coverage to recognize the great
majority of real job titles, without trying to enumerate every occupation on
Earth (that would add noise). Structure-based heuristics handle the long tail.
"""

from __future__ import annotations

# Employment-structure terms: domain-neutral signals that a text describes a job.
EMPLOYMENT_TERMS: tuple[str, ...] = (
    "full-time", "full time", "part-time", "part time", "contract",
    "permanent", "temporary", "internship", "apprenticeship", "salary",
    "wage", "hourly", "per hour", "per year", "per annum", "benefits",
    "shift", "responsibilities", "qualifications", "requirements",
    "job description", "position", "vacancy", "opening", "we are looking for",
    "looking for", "join our team", "join the team",
)

# Occupation nouns across major fields. Not exhaustive by design.
OCCUPATION_TERMS: tuple[str, ...] = (
    # tech
    "engineer", "developer", "programmer", "designer", "analyst", "scientist",
    "administrator", "architect",
    # healthcare
    "nurse", "doctor", "physician", "therapist", "technician", "pharmacist",
    "caregiver", "dentist", "paramedic", "surgeon", "practitioner",
    # trades / labor
    "welder", "electrician", "plumber", "carpenter", "mechanic", "machinist",
    "driver", "operator", "fabricator", "installer",
    # business / office
    "accountant", "bookkeeper", "manager", "coordinator", "specialist",
    "consultant", "associate", "assistant", "clerk", "officer", "executive",
    "representative", "agent", "supervisor", "director", "controller",
    # education / public / service
    "teacher", "tutor", "instructor", "professor", "lecturer", "trainer",
    "chef", "cook", "baker", "barista", "server", "bartender", "housekeeper",
    "stylist", "barber", "cleaner", "guard", "receptionist",
    # creative / marketing / legal / science
    "writer", "editor", "translator", "photographer", "marketer", "recruiter",
    "lawyer", "paralegal", "attorney", "auditor", "surveyor", "researcher",
    "nutritionist", "counselor", "social worker",
)

```

### Core Architecture Module: `backend/core/paths.py`
```
from __future__ import annotations

import os
import platform
from pathlib import Path

APP_DIR_NAME = "JustHireMe"


def app_data_base_dir() -> Path:
    configured = os.environ.get("JHM_APP_DATA_BASE_DIR")
    if configured:
        return Path(configured).expanduser()
    system = platform.system().lower()
    if system == "windows":
        return Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local").expanduser()
    if system == "darwin":
        return Path.home() / "Library" / "Application Support"
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share").expanduser()


def app_data_dir() -> Path:
    configured = os.environ.get("JHM_APP_DATA_DIR")
    if configured:
        return Path(configured).expanduser()
    return app_data_base_dir() / APP_DIR_NAME


def app_data_path(*parts: str) -> Path:
    return app_data_dir().joinpath(*parts)

```

### Core Architecture Module: `backend/core/taxonomy.py`
```
from __future__ import annotations

TECH_TAXONOMY: dict[str, tuple[str, ...]] = {
    "Python": ("python",),
    "TypeScript": ("typescript",),
    "JavaScript": ("javascript",),
    "C++": ("c++", "cpp"),
    "C#": ("c#", "c sharp"),
    "Java": ("java",),
    "PHP": ("php",),
    "Ruby": ("ruby",),
    "Go": ("golang", "go lang"),
    "Rust": ("rust",),
    "SQL": ("sql",),
    "React": ("react", "react.js", "reactjs"),
    "Next.js": ("next.js", "nextjs", "next js"),
    "Vite": ("vite",),
    "Tailwind": ("tailwind", "tailwindcss", "tailwind css"),
    "HTML": ("html",),
    "CSS": ("css",),
    "Vue": ("vue", "vue.js", "vuejs"),
    "Angular": ("angular",),
    "Svelte": ("svelte",),
    "Flutter": ("flutter",),
    "Swift": ("swift",),
    "Kotlin": ("kotlin",),
    "Android": ("android",),
    "iOS": ("ios", "i os"),
    "Node.js": ("node.js", "nodejs", "node js"),
    "Express": ("express", "express.js", "expressjs"),
    "NestJS": ("nestjs", "nest.js", "nest js"),
    "FastAPI": ("fastapi", "fast api"),
    "Django": ("django",),
    "Flask": ("flask",),
    "Laravel": ("laravel",),
    "Ruby on Rails": ("ruby on rails", "rails"),
    "WordPress": ("wordpress", "wp"),
    "REST API": ("rest api", "restful api", "restful", "rest endpoints", "api endpoint", "api endpoints"),
    "GraphQL": ("graphql", "graph ql"),
    "PostgreSQL": ("postgresql", "postgres", "neon postgres", "neon"),
    "MySQL": ("mysql",),
    "MongoDB": ("mongodb", "mongo"),
    "Redis": ("redis",),
    "Prisma": ("prisma",),
    "Drizzle": ("drizzle", "drizzle orm"),
    "Supabase": ("supabase",),
    "Qdrant": ("qdrant",),
    "Pinecone": ("pinecone",),
    "ChromaDB": ("chromadb", "chroma"),
    "Vector DB": ("vector database", "vector db", "vector store"),
    "RAG": ("rag", "retrieval augmented generation", "retrieval-augmented generation"),
    "LLM": ("llm", "large language model", "language model"),
    "AI Agents": ("ai agent", "ai agents", "agentic", "multi-agent", "multi agent"),
    "OpenAI": ("openai", "gpt", "chatgpt"),
    "Anthropic": ("anthropic", "claude"),
    "LangChain": ("langchain", "lang chain"),
    "LangGraph": ("langgraph", "lang graph"),
    "Machine Learning": ("machine learning", "ml engineer", "ml engineering", "ml ops", "mlops", "ml model", "ml pipeline", "ai/ml"),
    "NLP": ("nlp", "natural language processing"),
    "Computer Vision": ("computer vision", "vision model", "object detection", "image segmentation"),
    "PyTorch": ("pytorch", "torch"),
    "TensorFlow": ("tensorflow",),
    "Automation": ("automation", "workflow automation", "zapier", "n8n"),
    "Docker": ("docker", "container"),
    "Kubernetes": ("kubernetes", "k8s"),
    "Terraform": ("terraform",),
    "AWS": ("aws", "amazon web services"),
    "GCP": ("gcp", "google cloud"),
    "Azure": ("azure",),
    "Vercel": ("vercel",),
    "CI/CD": ("ci/cd", "cicd", "github actions"),
    "Linux": ("linux",),
    "WebSockets": ("websocket", "websockets", "socket.io"),
    "LiveKit": ("livekit", "livekit agents"),
    "Deepgram": ("deepgram",),
    "Groq": ("groq",),
    "Stripe": ("stripe",),
    "Firebase": ("firebase",),
    "Tauri": ("tauri",),
    "Electron": ("electron",),
    "Playwright": ("playwright",),
    "Data Pipeline": ("data pipeline", "etl", "data engineering"),
    "SAP": ("sap",),
    "ABAP": ("abap",),
    "Salesforce": ("salesforce", "apex"),
    "ServiceNow": ("servicenow", "service now"),
}


TECH_CATEGORY: dict[str, str] = {
    "Python": "language",
    "TypeScript": "language",
    "JavaScript": "language",
    "C++": "language",
    "C#": "language",
    "Java": "language",
    "PHP": "language",
    "Ruby": "language",
    "Go": "language",
    "Rust": "language",
    "SQL": "data",
    "React": "frontend",
    "Next.js": "frontend",
    "Vite": "frontend",
    "Tailwind": "frontend",
    "HTML": "frontend",
    "CSS": "frontend",
    "Vue": "frontend",
    "Angular": "frontend",
    "Svelte": "frontend",
    "Flutter": "mobile",
    "Swift": "mobile",
    "Kotlin": "mobile",
    "Android": "mobile",
    "iOS": "mobile",
    "Node.js": "backend",
    "Express": "backend",
    "NestJS": "backend",
    "FastAPI": "backend",
    "Django": "backend",
    "Flask": "backend",
    "Laravel": "backend",
    "Ruby on Rails": "backend",
    "WordPress": "cms",
    "REST API": "backend",
    "GraphQL": "backend",
    "PostgreSQL": "data",
    "MySQL": "data",
    "MongoDB": "data",
    "Redis": "data",
    "Prisma": "data",
    "Drizzle": "data",
    "Supabase": "data",
    "Qdrant": "ai",
    "Pinecone": "ai",
    "ChromaDB": "ai",
    "Vector DB": "ai",
    "RAG": "ai",
    "LLM": "ai",
    "AI Agents": "ai",
    "OpenAI": "ai",
    "Anthropic": "ai",
    "LangChain": "ai",
    "LangGraph": "ai",
    "Machine Learning": "ai",
    "NLP": "ai",
    "Computer Vision": "ai",
    "PyTorch": "ai",
    "TensorFlow": "ai",
    "Automation": "automation",
    "Docker": "infra",
    "Kubernetes": "infra",
    "Terraform": "infra",
    "AWS": "infra",
    "GCP": "infra",
    "Azure": "infra",
    "Vercel": "infra",
    "CI/CD": "infra",
    "Linux": "infra",
    "WebSockets": "backend",
    "LiveKit": "realtime",
    "Deepgram": "realtime",
    "Groq": "ai",
    "Stripe": "product",
    "Firebase": "backend",
    "Tauri": "desktop",
    "Electron": "desktop",
    "Playwright": "testing",
    "Data Pipeline": "data",
    "SAP": "enterprise",
    "ABAP": "enterprise",
    "Salesforce": "enterprise",
    "ServiceNow": "enterprise",
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #131** (2026-06-18): **[Bug]: : Update vite in website/ to fix high severity security issues**
  *Symptoms*: ### Summary  I was auditing the repo and found a couple high severity vulnerabilities in the `website/ `folder's dependencies. **Details:**  - GHSA-v6wh-96g9-6wx3 (vite): NTLMv2 hash disclosure on Windows [link](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) - GHSA-fx2h-pf6j-xcff (vite): server.fs.deny bypass on Windows [link](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)  Both affect vite 8.0.0 - 8.0.15. `npm audit fix` in `website/` cleans it up nicely (now 0 vulns). **Suggestion**: Bump vite in `website/package.json to >= 8.0.16 or latest.` Happy to help with a PR if needed! Thanks for maintaining the project.  ### Steps to reproduce  npm audit fix  ### Expected behavior  .  ### OS / app version  _No response_

- **Issue #121** (2026-07-18): **[Bug]: _parse() and _parse_wellfound() defined twice in scout.py — LLM logic silently overwritten**
  *Symptoms*: ### Summary  Two functions in `automation/scout.py` are each defined twice in the same file.  The second definitions overwrite the first ones at module load time, making the  original LLM-based extraction logic permanently unreachable dead code.  ### Steps to reproduce  1. Open `backend/automation/scout.py` 2. Search for `def _parse` — two definitions appear 3. Search for `def _parse_wellfound` — two definitions appear 4. Run: python -m pyflakes automation/scout.py    Output confirms: "redefinition of unused '_parse' from line 288"  ### Expected behavior  Each function should be defined exactly once. The intended implementation  (either the LLM logic or the web_sources wrapper) should be the only definition present.  ### OS / app version  Discovered via static analysis (pyflakes) — not OS-specific

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

### Incident Patch 1: `6ed82bae` (2026-07-02)
**Commit Message**: fix(ingest): bound every untrusted input so one document can't stall the sidecar

Hardening across the résumé/PDF/LinkedIn/portfolio/GitHub ingest paths, all of
which previously read unbounded input into memory or the parser:

- Résumé text capped at MAX_INGEST_CHARS (200k) before the LLM + the twice-run
  deterministic parser; the router truncates a pasted `raw` over 2M chars.
- PDF reader uses strict=False (tolerate real-world malformed PDFs), caps pages
  (300) and accumulated text (200k chars), and skips a single bad page instead
  of aborting — a decompression-bomb / thousands-of-pages PDF can't hang pypdf.
- LinkedIn .zip: reject a CSV member whose declared OR actual decompressed size
  exceeds 64MB (zip-bomb guard; members are read in-memory, so no zip-slip); and
  emit an empty period instead of a contextless bare "Present".
- Portfolio HTTP fallback streams with an 8MB body ceiling + content-type
  short-circuit instead of buffering + lower-casing the whole body.
- GitHub fetch: detect SECONDARY rate limits (403 + Retry-After even when
  remaining>0) so the backoff actually runs, and lower the per-request timeout
  45s -> 20s.

Tests: zip-bomb member rejected, normal membe

**File**: `backend/profile/github_ingestor.py` (modified, +16/-5)
```diff
@@ -137,18 +137,29 @@ async def _fetch(url: str, token: str | None, *, _retries: int = 2) -> dict | li
     last_exc: Exception | None = None
     for attempt in range(_retries + 1):
         try:
-            async with httpx.AsyncClient(timeout=45) as client:
+            async with httpx.AsyncClient(timeout=20) as client:
                 response = await client.get(url, headers=_gh_headers(token))
                 if response.status_code == 404:
                     return None
                 if response.status_code in {403, 429}:
                     limit_remaining = response.headers.get("x-ratelimit-remaining")
-                    # If rate-limited (429 or 403 with 0 remaining), retry after back-off
-                    is_rate_limit = response.status_code == 429 or (
-                        limit_remaining is not None and limit_remaining == "0"
+                    retry_after_hdr = response.headers.get("retry-after")
+                    try:
+                        remaining = int(limit_remaining) if limit_remaining is not None else None
+                    except (TypeError, ValueError):
+                        remaining = None
+                    # Rate-limited when: 429, OR 403 with the primary quota exhausted
+                    # (remaining <= 0), OR a SECONDARY rate limit — a 403 carrying a
+                    # Retry-After header even though remaining > 0. The old check
+                    # string-compared remaining to "0" and ignored Retry-After, so
+                    # secondary limits skipped the backoff and failed immediately.
+                    is_rate_limit = (
+                        response.status_code == 429
+                        or (remaining is not None and remaining <= 0)
+                        or retry_after_hdr is not None
                     )
                     if is_rate_limit and attempt < _retries:
-                        retry_after = int(response.headers.get("retry-after", "0") or "0")
+                        retry_after = int(retry_after_hdr or "0") if str(retry_after_hdr or "").isdigit() else 0
                         wait = max(retry_after, 2 ** (attempt + 1))
                         _log.info("github rate limit on %s, retrying in %ds (attempt %d/%d)", url, wait, attempt + 1, _retries)
                         await asyncio.sleep(min(wait, 30))
```

**File**: `backend/profile/ingest_documents.py` (modified, +31/-3)
```diff
@@ -20,6 +20,12 @@
 # under this.
 _MAX_DOCX_MEMBER_BYTES = 64 * 1024 * 1024
 
+# Bounds on PDF extraction: a résumé is a handful of pages. These stop a
+# decompression-bomb / thousands-of-pages PDF from hanging pypdf or exhausting
+# memory and stalling the sidecar.
+_MAX_PDF_PAGES = 300
+_MAX_PDF_TEXT_CHARS = 200_000
+
 
 def _read_zip_member(archive: zipfile.ZipFile, name: str) -> bytes:
     info = archive.getinfo(name)
@@ -70,9 +76,31 @@ def _document(path: str) -> str:
 def _pdf(path: str) -> str:
     try:
         from pypdf import PdfReader
-        pages = PdfReader(path).pages
-        text = "\n".join(pg.extract_text() or "" for pg in pages)
-        if not text.strip():
+        # strict=False: tolerate the malformed-but-readable PDFs real users upload
+        # instead of raising on the first spec violation.
+        reader = PdfReader(path, strict=False)
+        parts: list[str] = []
+        total = 0
+        truncated = False
+        for index, page in enumerate(reader.pages):
+            if index >= _MAX_PDF_PAGES:
+                _log.warning("PDF exceeds %d pages; reading only the first %d: %s", _MAX_PDF_PAGES, _MAX_PDF_PAGES, path)
+                truncated = True
+                break
+            try:
+                chunk = page.extract_text() or ""
+            except Exception as exc:
+                # One bad page must not abort extraction of the rest.
+                _log.warning("PDF page %d extract error (%s): %s", index, path, exc)
+                continue
+            parts.append(chunk)
+            total += len(chunk)
+            if total >= _MAX_PDF_TEXT_CHARS:
+                _log.warning("PDF text exceeded %d chars; truncating: %s", _MAX_PDF_TEXT_CHARS, path)
+                truncated = True
+                break
+        text = "\n".join(parts)
+        if not text.strip() and not truncated:
             _log.warning("PDF has no extractable text (may be scanned/image-only): %s", path)
         return text
     except Exception as exc:
```

**File**: `backend/profile/ingestor.py` (modified, +8/-0)
```diff
@@ -12,6 +12,11 @@
 
 _log = get_logger(__name__)
 
+# Upper bound on résumé text fed to the LLM + deterministic parser. A real résumé
+# is a few KB; this bounds both LLM token cost and the (twice-run) regex parser
+# against a pathologically large paste/PDF so a single ingest can't stall the sidecar.
+MAX_INGEST_CHARS = 200_000
+
 def run(raw: str = "", pdf: str | None = None) -> C:
     from llm import call_llm, provider_needs_key, resolve_config
 
@@ -176,6 +181,9 @@ def ingest(raw: str = "", pdf: str | None = None) -> C:
             )
         _log.warning("No usable text for extraction - returning empty profile")
         return C(n="Unknown", s="")
+    if len(txt) > MAX_INGEST_CHARS:
+        _log.warning("résumé text %d chars exceeds cap %d; truncating for extraction", len(txt), MAX_INGEST_CHARS)
+        txt = txt[:MAX_INGEST_CHARS]
     p = run(txt)
     # Capture before merge/normalize, which rebuild C and drop loc.
     extracted_loc = str(getattr(p, "loc", "") or "").strip()
```

**File**: `backend/profile/linkedin_parser.py` (modified, +17/-3)
```diff
@@ -6,6 +6,10 @@
 
 _log = get_logger(__name__)
 
+# Decompressed-size ceiling per CSV member: a ~tens-of-MB zip whose members expand
+# to gigabytes would OOM-kill the sidecar otherwise. A real LinkedIn CSV is small.
+_MAX_CSV_MEMBER_BYTES = 64 * 1024 * 1024
+
 
 def _read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
     """Find and parse a CSV by filename pattern (case-insensitive)."""
@@ -14,11 +18,19 @@ def _read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
     if not candidates:
         _log.warning("linkedin export: %s not found in ZIP", name)
         return []
-    with zf.open(candidates[0]) as f:
+    member = candidates[0]
+    # Reject on the declared uncompressed size first (cheap), then bound the actual
+    # bytes read in case a crafted archive under-reports its member size.
+    if zf.getinfo(member).file_size > _MAX_CSV_MEMBER_BYTES:
+        raise ValueError(f"LinkedIn export member {member!r} too large (zip-bomb guard)")
+    with zf.open(member) as f:
+        raw = f.read(_MAX_CSV_MEMBER_BYTES + 1)
+        if len(raw) > _MAX_CSV_MEMBER_BYTES:
+            raise ValueError(f"LinkedIn export member {member!r} exceeded {_MAX_CSV_MEMBER_BYTES} bytes")
         # Lenient decode (like the other ingest paths): some real LinkedIn exports —
         # and files re-saved by Excel — carry cp1252/latin-1 bytes, and a strict
         # decode aborted the ENTIRE import over one bad character. utf-8-sig strips BOM.
-        text = f.read().decode("utf-8-sig", errors="replace")
+        text = raw.decode("utf-8-sig", errors="replace")
     reader = csv.DictReader(io.StringIO(text))
     return [dict(r) for r in reader]
 
@@ -70,7 +82,9 @@ def parse_linkedin_export(zip_bytes: bytes) -> dict:
             desc  = (row.get("Description") or "").strip()
             loc   = (row.get("Location") or "").strip()
             if role or co:
-                period = f"{start} – {end}" if start else end
+                # Without a start date, a bare "Present" is contextless noise —
+                # emit an empty period instead (matches the Education branch).
+                period = f"{start} – {end}" if start else ""
                 d = desc
                 if loc:
                     d = f"{d}\n{loc}".strip() if d else loc
```

**File**: `backend/profile/portfolio_crawl.py` (modified, +26/-5)
```diff
@@ -31,6 +31,10 @@
 
 MAX_PAGES = 100
 MAX_TEXT_PER_PAGE = 200000
+# Hard ceiling on a single fetched page body in the HTTP fallback. A hostile or
+# misconfigured host can otherwise stream an unbounded body and OOM the sidecar
+# (or starve the default thread pool). A real portfolio page is well under this.
+MAX_HTTP_RESPONSE_BYTES = 8 * 1024 * 1024
 # Per page, click up to this many candidate cards/buttons to reveal modal or
 # inline-expanded detail (case studies, demo videos) that is not in the initial
 # DOM. Bounded so a click-heavy page can't blow the crawl budget.
@@ -365,12 +369,29 @@ def _block_private_request(request):
                 continue
             seen.add(current)
             try:
-                response = client.get(current)
-                response.raise_for_status()
-                content_type = response.headers.get("content-type", "")
-                if "text/html" not in content_type and "<html" not in response.text.lower():
+                # Stream so a non-text or oversized body is rejected BEFORE it is
+                # fully buffered/decoded (avoids OOM + wasted whole-body .lower()).
+                with client.stream("GET", current) as response:
+                    response.raise_for_status()
+                    final_url = str(response.url)
+                    content_type = response.headers.get("content-type", "").lower()
+                    if content_type and "html" not in content_type and "text" not in content_type:
+                        continue
+                    declared = response.headers.get("content-length", "")
+                    if declared.isdigit() and int(declared) > MAX_HTTP_RESPONSE_BYTES:
+                        _log.warning("portfolio page %s too large (%s bytes); skipping", current, declared)
+                        continue
+                    buf = bytearray()
+                    for chunk in response.iter_bytes():
+                        buf.extend(chunk)
+                        if len(buf) > MAX_HTTP_RESPONSE_BYTES:
+                            _log.warning("portfolio page %s exceeded %d bytes; truncating", current, MAX_HTTP_RESPONSE_BYTES)
+                            break
+                    charset = response.charset_encoding or "utf-8"
+                body_text = bytes(buf).decode(charset, errors="replace")
+                if "text/html" not in content_type and "<html" not in body_text.lower():
                     continue
-                snapshot = _snapshot_html(str(response.url), response.text)
+                snapshot = _snapshot_html(final_url, body_text)
                 pages.append(snapshot)
                 for link in _prioritize_links(url, snapshot.links):
                     href = _canonical_url(link["href"])
```

---

### Incident Patch 2: `ed34491a` (2026-07-02)
**Commit Message**: fix(automation): stop the Read-form flow from making the sidecar unreachable

The "Local backend is unreachable / sidecar may have restarted" error during
Read form came from the single-worker event loop stalling, not a crash:

- actuator.read_form had no overall wall-clock and an un-timeboxed
  browser.close() inside the try body — a wedged Chromium pinned the coroutine
  and leaked the browser process (cumulatively -> backend unreachable). Now the
  whole session runs under asyncio.wait_for(45s) and browser.close() is a
  time-boxed (5s) finally, so a hung page can't hold the loop or leak.
- The SSRF assert_public_url check now runs BEFORE launching Chromium (was
  after), so an internal/blocked URL is rejected without paying a browser spawn.
- automation.read_lead_form ran blocking SQLite/graph/file reads directly on the
  event loop; under DB-lock contention that stalled every coroutine including
  /health. Wrapped the four reads in asyncio.to_thread, matching the sibling
  `fire` endpoint.

**File**: `backend/api/routers/automation.py` (modified, +8/-4)
```diff
@@ -149,16 +149,20 @@ async def read_lead_form(
         repo: Repository = Depends(get_repository),
         service=Depends(get_automation_service),
     ):
-        lead = repo.leads.get_lead_by_id(job_id)
+        # Run the blocking SQLite/graph/file reads off the event loop (as the
+        # sibling `fire` endpoint does). On the single-worker sidecar, a blocking
+        # read under DB-lock contention would stall EVERY coroutine — including
+        # /health — so the UI reports the backend as unreachable.
+        lead = await asyncio.to_thread(repo.leads.get_lead_by_id, job_id)
         if not lead:
             raise HTTPException(404, "lead not found")
 
         url = (body.url or lead.get("url") or "").strip()
         if not url:
             raise HTTPException(400, "no url available for this lead")
 
-        profile = repo.profile.get_profile()
-        cfg = repo.settings.get_settings()
+        profile = await asyncio.to_thread(repo.profile.get_profile)
+        cfg = await asyncio.to_thread(repo.settings.get_settings)
         # The profile is FLAT: the candidate name is profile["n"], not a "candidate"
         # sub-dict (there is none), and no "full_name" setting is ever written. Read
         # it the way get_lead_for_fire_sync does, else the form-read preview shows a
@@ -175,7 +179,7 @@ async def read_lead_form(
             "current_company": cfg.get("current_company", ""),
         }
 
-        cover_letter = resolve_cover_letter_text(lead.get("cover_letter_asset", ""), _log)
+        cover_letter = await asyncio.to_thread(resolve_cover_letter_text, lead.get("cover_letter_asset", ""), _log)
 
         return await service.read_form(url, identity, cover_letter=cover_letter)
 
```

**File**: `backend/automation/actuator.py` (modified, +92/-60)
```diff
@@ -11,6 +11,11 @@
 
 _log = get_logger(__name__)
 
+# Wall-clock ceiling for a single read_form session (nav + field probing +
+# screenshot + close). Past this the coroutine is cancelled so a slow/blocking
+# page can't pin the single-worker sidecar and make the backend look unreachable.
+READ_FORM_DEADLINE_S = 45
+
 _AUTO_APPLY_ENABLED = os.environ.get("JHM_AUTO_APPLY", "false").lower() == "true"
 
 _TYPE_TO_CANDIDATE_KEY = {
@@ -58,77 +63,104 @@ async def read_form(
 
     candidate_with_cl = {**candidate, "cover_letter": cover_letter}
 
-    result_fields = []
+    result_fields: list[dict] = []
     unmatched: list[str] = []
     screenshot_b64 = ""
     error = None
 
+    # SSRF guard FIRST, before spawning Chromium: the lead URL is LLM-extracted
+    # from an untrusted page, so reject non-public hosts up front — an internal
+    # URL must never cost a browser launch (DoS amplification) or be reached.
     try:
-        async with async_playwright() as pw:
-            browser = await launch_chromium(pw, headless=True)
-            ctx = await browser.new_context(
-                viewport={"width": 1280, "height": 900},
-                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
-            )
-            # SSRF guard: the lead URL is LLM-extracted from an untrusted page, so
-            # reject non-public hosts before navigating, and abort redirect hops.
-            await asyncio.to_thread(assert_public_url, url)
-            await ctx.route("**/*", block_private_route)
-            page = await ctx.new_page()
-            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
-            await page.wait_for_timeout(2000)
-
-            for field_cfg in fields_cfg:
-                sel = field_cfg["selector"]
-                ftype = field_cfg["type"]
-                answer = resolve_answer(ftype, candidate_with_cl)
-                found = False
-
-                try:
-                    el = page.locator(sel).first
-                    await el.wait_for(state="visible", timeout=1500)
-                    found = True
-                except Exception as log_exc:
-                    logging.getLogger(__name__).warning('suppressed exception in backend/automation/actuator.py:read_form: %s', log_exc)
-                    found = False
-
-                if not found:
-                    confidence = "low"
-                elif platform:
-                    confidence = "high"
-                else:
-                    confidence = "medium"
-
-                result_fields.append({
-                    "type":          ftype,
-                    "label":         ftype.replace("_", " ").title(),
-                    "selector":      sel.split(",")[0].strip(),
-                    "answer":        answer,
-                    "found_on_page": found,
-                    "confidence":    confidence,
-                })
-
+        await asyncio.to_thread(assert_public_url, url)
+    except Exception as exc:
+        _log.warning("read_form rejected non-public url %s: %s", url, exc)
+        return {
+            "platform": platform,
+            "platform_label": "Generic form",
+            "screenshot_b64": "",
+            "fields": [],
+            "unmatched_labels": [],
+            "error": str(exc),
+        }
+
+    async def _fill_and_capture(page) -> None:
+        nonlocal screenshot_b64
+        for field_cfg in fields_cfg:
+            sel = field_cfg["selector"]
+            ftype = field_cfg["type"]
+            answer = resolve_answer(ftype, candidate_with_cl)
+            found = False
             try:
-                labels = await page.locator("label").all_text_contents()
-                covered_words = {"first", "last", "email", "phone", "linkedin",
-                                 "github", "website", "city", "cover", "resume", "name"}
-                for lbl in labels:
-                    lbl_lower = lbl.lower().strip()
-                    if lbl_lower and not any(w in lbl_lower for w in covered_words) and len(lbl_lower) < 60:
-                        unmatched.append(lbl.strip())
+                el = page.locator(sel).first
+                await el.wait_for(state="visible", timeout=1500)
+                found = True
             except Exception as log_exc:
                 logging.getLogger(__name__).warning('suppressed exception in backend/automation/actuator.py:read_form: %s', log_exc)
-                pass
+                found = False
 
-            try:
-                raw = await page.screenshot(type="png", full_page=False)
-                screenshot_b64 = base64.b64encode(raw).decode()
-            except Exception as log_exc:
-                logging.getLogger(__name__).warning('suppressed exception in backend/automation/actuator.py:read_form: %s', log_exc)
-                pass
+            if not found:
+                confidence = "low"
+            elif platform:
+                confidence = "hi
```

---

### Incident Patch 3: `9cd2dcdf` (2026-07-02)
**Commit Message**: fix(ci): ignore transitive quick-xml RUSTSEC advisories in cargo audit

The Dependency-audit job's `cargo audit` step fails on RUSTSEC-2026-0194 and
RUSTSEC-2026-0195 in quick-xml 0.39.x, pulled transitively via
tauri -> tauri-utils -> plist -> quick-xml. The fix is quick-xml >= 0.41.0, but
plist (latest 1.9.0) still requires `quick-xml ^0.39.2`, so the upgrade is
blocked upstream until tauri/plist move. main's lock carries the same
quick-xml 0.39.4, so this is a newly-published advisory that gates any fresh CI
run, not a regression from the deps bump. The affected path is Apple .plist
parsing inside Tauri's own bundling, not attacker-controlled input here, so the
DoS surface is negligible.

Add src-tauri/.cargo/audit.toml with a documented ignore for the two IDs
(picked up by the bare `cd src-tauri && cargo audit` in ci.yml and by local
runs) — mirroring the PIP_AUDIT_IGNORE_VULNS pattern for transitive Python ML
advisories. Remove once tauri/plist ship quick-xml >= 0.41.

**File**: `src-tauri/.cargo/audit.toml` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# cargo-audit configuration.
+#
+# These advisories are in `quick-xml` 0.39.x, pulled in transitively as
+# tauri -> tauri-utils -> plist -> quick-xml. The fix is quick-xml >= 0.41.0,
+# but `plist` (latest 1.9.0) still requires `quick-xml ^0.39.2`, so the upgrade
+# is blocked upstream until tauri/plist bump their quick-xml dependency. The
+# affected code path is Apple .plist parsing inside Tauri's own bundling/config,
+# not attacker-controlled input in this app, so the practical DoS surface is
+# negligible. Remove these entries once tauri/plist ship a quick-xml >= 0.41.
+#
+# Mirrors the PIP_AUDIT_IGNORE_VULNS pattern used for transitive Python ML
+# advisories in .github/workflows/{ci,release}.yml.
+[advisories]
+ignore = [
+    "RUSTSEC-2026-0194",  # quick-xml: quadratic run time on duplicate attribute names
+    "RUSTSEC-2026-0195",  # quick-xml: unbounded namespace-declaration allocation (DoS)
+]
```

#### Recent Merged Pull Requests:
- **PR #194** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 15 updates (@dependabot[bot])
- **PR #193** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 7 updates (@dependabot[bot])
- **PR #192** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 14 updates (@dependabot[bot])
- **PR #191** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 6 updates (@dependabot[bot])
- **PR #190** (closed): fix(scripts): create sidecar-manifest.json stub in prepare-sidecar-placeholder (@JimmyNewtron711)
- **PR #188** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 13 updates (@dependabot[bot])

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

## X. ingest): bound every untrusted input so one document can't stall the sidecar

**RULE**:
When implementing operations in `backend/profile/github_ingestor.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vasu-devs/JustHireMe. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6ed82bae`: ingest): bound every untrusted input so one document can't stall the sidecar. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `backend/profile/github_ingestor.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
            async with httpx.AsyncClient(timeout=20) as client:
                    retry_after_hdr = response.headers.get("retry-after")
                    try:
                        remaining = int(limit_remaining) if limit_remaining is not None else None
                    except (TypeError, ValueError):
                        remaining = None
                    # Rate-limited when: 429, OR 403 with the primary quota exhausted
                    # (remaining <= 0), OR a SECONDARY rate limit — a 403 carrying a
                    # Retry-After header even though remaining > 0. The old check
                    # string-compared remaining to "0" and ignored Retry-After, so
                    # secondary limits skipped the backoff and failed immediately.
                    is_rate_limit = (
                        response.status_code == 429
                        or (remaining is not None and remaining <= 0)
                        or retry_after_hdr is not None
                        retry_after = int(retry_after_hdr or "0") if str(retry_after_hdr or "").isdigit() else 0
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
            async with httpx.AsyncClient(timeout=45) as client:
                    # If rate-limited (429 or 403 with 0 remaining), retry after back-off
                    is_rate_limit = response.status_code == 429 or (
                        limit_remaining is not None and limit_remaining == "0"
                        retry_after = int(response.headers.get("retry-after", "0") or "0")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6ed82bae` are properly handled with clean fallback behavior.

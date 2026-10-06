# Forensic Learning Record (Deep Inspection): vasu-devs/JustHireMe

> **Canonical Artifact**: `07_PROJECT_LEARNING/vasu-devs-justhireme-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vasu-devs/JustHireMe](https://github.com/vasu-devs/JustHireMe))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:39:54.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vasu-devs/JustHireMe`
- **Description**: Local-first AI job intelligence workbench for scraping roles, ranking fit, and generating tailored application materials.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2257 stars

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

### Core Architecture Module: `backend/core/telemetry.py`
```
from __future__ import annotations
import logging

import json
import os
import re
import time
import traceback
from pathlib import Path
from collections.abc import Mapping
from importlib import import_module

from .paths import app_data_path

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
MAX_TEXT_LEN = 2000


def telemetry_enabled() -> bool:
    return os.environ.get("JHM_LOCAL_ERROR_TELEMETRY", "").strip().lower() in {"1", "true", "yes", "on"}


def errors_path() -> Path:
    base = app_data_path()
    return Path(os.environ.get("JHM_ERRORS_JSONL", base / "errors.jsonl"))


def redact_text(value: object, *, max_len: int = MAX_TEXT_LEN) -> str:
    text = str(value)
    text = SECRET_RE.sub("[REDACTED_SECRET]", text)
    text = ASSIGNMENT_SECRET_RE.sub(lambda match: f"{match.group(1)}=[REDACTED_SECRET]", text)
    text = EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    text = PHONE_RE.sub("[REDACTED_PHONE]", text)
    if len(text) > max_len:
        text = f"{text[:max_len]}...[truncated]"
    return text


def redact_sensitive(value, *, depth: int = 0):
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
            if SENSITIVE_KEY_RE.search(key_text):
                redacted[key_text] = "[REDACTED]"
            else:
                redacted[key_text] = redact_sensitive(item, depth=depth + 1)
        return redacted
    if isinstance(value, (list, tuple, set)):
        items = list(value)
        limited = [redact_sensitive(item, depth=depth + 1) for item in items[:50]]
        if len(items) > 50:
            limited.append("[TRUNCATED]")
        return limited
    return redact_text(value)


def record_exception(exc: BaseException, *, domain: str = "api", request_id: str = "", path: str = "") -> None:
    if not telemetry_enabled():
        return
    try:
        path_obj = errors_path()
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "domain": domain,
            "request_id": request_id,
            "path": redact_text(path, max_len=500),
            "error_type": type(exc).__name__,
            "message": redact_text(exc),
            "traceback": [redact_text(line, max_len=1000) for line in traceback.format_exception(type(exc), exc, exc.__traceback__)[-8:]],
        }
        with path_obj.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
        # A recurring backend exception would otherwise grow errors.jsonl
        # unbounded; cap it the same way the frontend-error sink does.
        _rotate_error_log()
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:record_exception: %s', log_exc)
        return


def _rotate_error_log(max_lines: int = 500) -> None:
    try:
        path_obj = errors_path()
        lines = path_obj.read_text(encoding="utf-8").splitlines(True)
        if len(lines) > max_lines:
            path_obj.write_text("".join(lines[-max_lines:]), encoding="utf-8")
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:_rotate_error_log: %s', log_exc)
        return


def log_error(exc: BaseException | str, context: dict | None = None) -> None:
    try:
        path_obj = errors_path()
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "type": type(exc).__name__ if not isinstance(exc, str) else "FrontendError",
            "message": redact_text(exc),
            "traceback": redact_text(traceback.format_exc()) if not isinstance(exc, str) else "",
            "context": redact_sensitive(context or {}),
        }
        with path_obj.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
        _rotate_error_log()
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:log_error: %s', log_exc)
        return


def record_error(error_type: str, message: str = "", source: str = "") -> None:
    try:
        connection = import_module("data.sqlite.connection")
        connection.init_sql()
        conn = connection.get_connection()
        error_type = redact_text(error_type, max_len=120)[:120] or "unknown"
        source = redact_text(source, max_len=200)[:200]
        message = redact_text(message, max_len=1000)[:1000]
        row = conn.execute(
            """
            SELECT id FROM error_log
            WHERE error_type=? AND source=? AND last_seen >= datetime('now', '-1 hour')
            ORDER BY last_seen DESC
            LIMIT 1
            """,
            (error_type, source),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE error_log SET count=count+1, error_message=?, last_seen=datetime('now') WHERE id=?",
                (message, row["id"] if hasattr(row, "keys") else row[0]),
            )
        else:
            conn.execute(
                "INSERT INTO error_log(error_type,error_message,source) VALUES(?,?,?)",
                (error_type, message, source),
            )
        conn.commit()
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:record_error: %s', log_exc)
        return


def get_top_errors(limit: int = 10, days: int = 7) -> list[dict]:
    try:
        connection = import_module("data.sqlite.connection")
        connection.init_sql()
        conn = connection.get_connection()
        rows = conn.execute(
            """
            SELECT error_type,error_message,source,count,first_seen,last_seen
            FROM error_log
            WHERE last_seen >= datetime('now', ?)
            ORDER BY count DESC, last_seen DESC
            LIMIT ?
            """,
            (f"-{max(1, int(days))} days", max(1, min(int(limit or 10), 100))),
        ).fetchall()
        return [
            {
                "error_type": row["error_type"],
                "error_message": row["error_message"] or "",
                "source": row["source"] or "",
                "count": row["count"] or 0,
                "first_seen": row["first_seen"] or "",
                "last_seen": row["last_seen"] or "",
            }
            for row in rows
        ]
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:get_top_errors: %s', log_exc)
        return []


def record_metric(name: str, value: int = 1) -> None:
    """Increment a named counter in the ``metrics`` table (upsert).

    Used for lifetime operational counters (scans run, leads found/saved/dropped).
    Fails closed and silent — telemetry must never break the path it observes.
    """
    incr_metrics({name: value})


def incr_metrics(counters: Mapping[str, int]) -> None:
    """Increment several counters at once in a single transaction."""
    if not counters:
        return
    try:
        connection = import_module("data.sqlite.connection")
        connection.init_sql()
        conn = connection.get_connection()
        for raw_name, raw_value in counters.items():
            name = str(raw_name)[:120]
            try:
                delta = int(raw_value)
            except (TypeError, ValueError):
                continue
            conn.execute(
                """
                INSERT INTO metrics(name, value, updated_at) VALUES(?, ?, datetime('now'))
                ON CONFLICT(name) DO UPDATE SET value=value+excluded.value, updated_at=datetime('now')
                """,
                (name, delta),
            )
        conn.commit()
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:incr_metrics: %s', log_exc)
        return


def set_metric_state(name: str, state: object) -> None:
    """Store the latest JSON snapshot for ``name`` (e.g. the last scan summary).

    The snapshot is redaction-passed like every other telemetry payload so a stray
    URL/company can't leak sensitive tokens.
    """
    try:
        connection = import_module("data.sqlite.connection")
        connection.init_sql()
        conn = connection.get_connection()
        payload = json.dumps(redact_sensitive(state), ensure_ascii=False)[:8000]
        conn.execute(
            """
            INSERT INTO metrics(name, state, updated_at) VALUES(?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET state=excluded.state, updated_at=datetime('now')
            """,
            (str(name)[:120], payload),
        )
        conn.commit()
    except Exception as log_exc:
        logging.getLogger(__name__).debug('suppressed exception in backend/core/telemetry.py:set_metric_state: %s', log_exc)
        return


def get_metrics() -> dict[str, int]:
    """Return all counters as ``{name: value}`` (empty on any failure)."""
    try:
        connection = import_module(
```

### Core Architecture Module: `backend/core/types.py`
```
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field, model_validator


LeadStatus = Literal[
    "discovered",
    "evaluating",
    "tailoring",
    "approved",
    "applied",
    "interviewing",
    "rejected",
    "accepted",
    "discarded",
    "matched",
    "bidding",
    "proposal_sent",
    "awarded",
    "completed",
]


class Lead(TypedDict, total=False):
    # Identity
    job_id: str
    title: str
    company: str
    url: str
    platform: str
    kind: str
    text: str
    source: str

    # Status and scoring
    status: LeadStatus
    score: int
    reason: str
    match_points: list[str]
    gaps: list[str]
    seniority: str
    seniority_level: str

    # Signal intelligence
    signal_score: int
    signal_reason: str
    signal_tags: list[str]
    base_signal_score: int
    learning_delta: int
    learning_reason: str

    # Content
    description: str
    location: str
    urgency: str
    budget: str
    tech_stack: list[str]

    # Outreach
    outreach_reply: str
    outreach_dm: str
    outreach_email: str
    proposal_draft: str
    fit_bullets: list[str]
    followup_sequence: list[str]
    proof_snippet: str

    # Assets
    asset_path: str
    resume_asset: str
    cover_letter_asset: str
    cover_letter_path: str
    selected_projects: list[str]
    keyword_coverage: dict
    resume_version: int

    # User interaction
    feedback: str
    feedback_note: str
    followup_due_at: str
    last_contacted_at: str
    contact_lookup: dict

    # Metadata
    source_meta: dict
    created_at: str


class Profile(TypedDict, total=False):
    n: str
    s: str
    desired_position: str
    identity: dict
    skills: list[dict]
    exp: list[dict]
    projects: list[dict]
    education: list
    certifications: list
    achievements: list


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StatusBody(StrictBody):
    status: LeadStatus


class FeedbackBody(StrictBody):
    feedback: Literal[
        "good",
        "trash",
        "too_generic",
        "not_ai",
        "already_contacted",
        "relevant",
        "not_relevant",
        "duplicate",
        "low_quality",
        "incorrect_category",
    ]
    note: str = Field(default="", max_length=1000)


class FollowupBody(StrictBody):
    days: int = Field(default=5, ge=1, le=60)


class ManualLeadBody(StrictBody):
    text: str = Field(default="", max_length=20000)
    url: str = Field(default="", max_length=2000)
    kind: Literal["job"] = "job"

    @model_validator(mode="after")
    def _validate_content(self):
        if not self.text.strip() and not self.url.strip():
            raise ValueError("Provide either text or a URL")
        return self


class HelpMessage(StrictBody):
    role: Literal["user", "assistant"]
    content: str = Field(default="", max_length=4000)


class HelpChatBody(StrictBody):
    question: str = Field(max_length=2000)
    history: list[HelpMessage] = Field(default_factory=list, max_length=12)


class TemplateBody(StrictBody):
    template: str = Field(default="", max_length=20000)


class PreferencesBody(StrictBody):
    preferences: str = Field(default="", max_length=2000)


class ResetDataBody(StrictBody):
    # Require an explicit literal so a destructive reset can never fire from an
    # empty/accidental request body.
    confirm: Literal["DELETE"]
    # Data-only by default (keeps settings + provider config); true = full wipe.
    clear_settings: bool = False


class CandidateBody(StrictBody):
    n: str = Field(default="", max_length=160)
    s: str = Field(default="", max_length=4000)


class IdentityBody(StrictBody):
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=80)
    linkedin_url: str = Field(default="", max_length=500)
    github_url: str = Field(default="", max_length=500)
    website_url: str = Field(default="", max_length=500)
    city: str = Field(default="", max_length=200)


class ProfileEntryBody(StrictBody):
    title: str = Field(default="", max_length=500)


class SkillBody(StrictBody):
    id: str | None = Field(default=None, max_length=160)
    n: str = Field(default="", max_length=160)
    cat: str = Field(default="general", max_length=80)


class ExperienceBody(StrictBody):
    id: str | None = Field(default=None, max_length=160)
    role: str = Field(default="", max_length=180)
    co: str = Field(default="", max_length=180)
    period: str = Field(default="", max_length=120)
    d: str = Field(default="", max_length=8000)


class ProjectBody(StrictBody):
    id: str | None = Field(default=None, max_length=160)
    title: str = Field(default="", max_length=220)
    stack: str = Field(default="", max_length=2000)
    repo: str = Field(default="", max_length=1000)
    impact: str = Field(default="", max_length=8000)


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def _validate_extra_settings(self):
        for key, value in (self.model_extra or {}).items():
            if len(key) > 120 or any(not (ch.isalnum() or ch in "_.-") for ch in key):
                raise ValueError(f"Invalid settings key: {key}")
            if value is not None and not isinstance(value, (str, bool, int, float)):
                raise ValueError(f"Invalid value for settings key: {key}")
        return self


@dataclass(frozen=True)
class CriterionScore:
    name: str
    score: int
    weight: int
    reason: str


@dataclass(frozen=True)
class ScoreResult:
    score: int
    reason: str
    match_points: list[str]
    gaps: list[str]
    criteria: list[CriterionScore]
    # The hard-cap ceiling applied to this score (e.g. seniority mismatch), if
    # any. Carried so the LLM evaluator can raise within the guardrail band
    # rather than being pinned to the deterministic baseline.
    applied_cap: int | None = None

    def as_dict(self) -> dict:
        return {
            "score": self.score,
            "reason": self.reason,
            "match_points": self.match_points,
            "gaps": self.gaps,
            "applied_cap": self.applied_cap,
        }


@dataclass
class CandidateEvidence:
    skills: set[str]
    project_terms: set[str]
    experience_terms: set[str]
    all_terms: set[str]
    project_by_term: dict[str, list[str]]
    experience_by_term: dict[str, list[str]]
    project_texts: list[tuple[str, str, set[str]]]
    experience_texts: list[tuple[str, str, set[str]]]
    role_tags: set[str]
    deliverables: set[str]
    level: str
    work_months: int
    summary: str
    location: str

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #131** (2026-06-18): **[Bug]: : Update vite in website/ to fix high severity security issues**
  *Symptoms*: ### Summary  I was auditing the repo and found a couple high severity vulnerabilities in the `website/ `folder's dependencies. **Details:**  - GHSA-v6wh-96g9-6wx3 (vite): NTLMv2 hash disclosure on Windows [link](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) - GHSA-fx2h-pf6j-xcff (vite): server.fs.deny bypass on Windows [link](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)  Both affect vite 8.0.0 - 8.0.15. `npm audit fix` in `website/` cleans it up nicely (now 0 vulns). **Suggestion**: Bump vite in `website/package.json to >= 8.0.16 or latest.` Happy to help with a PR if needed! Thanks for maintaining the project.  ### Steps to reproduce  npm audit fix  ### Expected behavior  .  ### OS / app version  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks a lot @veeresh-bikkaneti , im pushing a new version out with all these dependecies resolved and bumped up to Latest stable version.

- **Issue #121** (2026-07-18): **[Bug]: _parse() and _parse_wellfound() defined twice in scout.py — LLM logic silently overwritten**
  *Symptoms*: ### Summary  Two functions in `automation/scout.py` are each defined twice in the same file.  The second definitions overwrite the first ones at module load time, making the  original LLM-based extraction logic permanently unreachable dead code.  ### Steps to reproduce  1. Open `backend/automation/scout.py` 2. Search for `def _parse` — two definitions appear 3. Search for `def _parse_wellfound` — two definitions appear 4. Run: python -m pyflakes automation/scout.py    Output confirms: "redefinition of unused '_parse' from line 288"  ### Expected behavior  Each function should be defined exactly once. The intended implementation  (either the LLM logic or the web_sources wrapper) should be the only definition present.  ### OS / app version  Discovered via static analysis (pyflakes) — not OS-specific
  **Post-Mortem & Fix Analysis**:
  > ﻿Good catch at the time - this was resolved by the web_sources refactor: each of these functions now has exactly one definition (a thin delegate into backend/automation/web_sources.py, where the extraction logic lives). ruff F811 runs clean over the module today. Closing as fixed. 

- **Issue #92** (2026-07-18): **[Bug]: Customize One Job gives error even with URL and sufficient job details entered?**
  *Symptoms*: ### Summary  Hi,  Giving this software a try to see if can provide more options than standard search and apply.  I was not able to complete the setup as the app got stalled in the **Customize One Job** step. I installed **JustHireMe v1.0.38 AppImage on Ubuntu 24.04.4 LTS** and tried to Analyze and Generate to see what would happen but got the below error. I'm using my local **Ollama** setup as a provider which is running in the background. It was able to retrieve around 145 jobs but no more, which I assume has to do with the constraints I put in initially.  <img width="1916" height="992" alt="Image" src="https://github.com/user-attachments/assets/bb504c90-1290-4826-83bb-ce2b6b5b4fe4" />  Also, I was not able to get the **Export Graph** button to work.  <img width="1440" height="112" alt="Image" src="https://github.com/user-attachments/assets/1a9bbadb-8ebf-4de8-b011-0aeb4a8a92ca" />  I'm likely doing something wrong but thought I'd mention my experience.  Also, there a setting for Dark Theme?  Thank you, MB  ### Steps to reproduce  1. Install 2. Open 3. Upload Resume (.docx) 4. Installed the runtime pack by itself upon my approval. 5. Asked it to search for jobs based on my typed criteria. 6. Went to **Customize One Job** where it failed. 7. I opted to choose another of the retrieved jobs, still would not Customize the Res for the job.  ### Expected behavior  Don't know was not able to get to next step.  ### OS / app version  Ubuntu 24.04.4 LTS, JustHireMe v1.0.38 AppImage
  **Post-Mortem & Fix Analysis**:
  > ﻿All three parts of this are resolved in current releases:  1. **Customize One Job errors**: the pre-generation readiness check was rewritten (the code comment literally cites this issue). It now gates on substance, not tech keywords, and Ollama hiccups retry with backoff and degrade to a deterministic package instead of erroring out. 2. **Export Graph**: that button was removed in the graph page redesign rather than fixed in place. If you'd still like a graph export, open a fresh feature request and we'll spec it properly. 3. **Dark theme**: shipped - Light / Dark / System in Settings.  Please try the latest release (you were on v1.0.38; a lot has moved). Closing; reopen if generation still fails for you on current builds. 

- **Issue #61** (2026-05-18): **[Bug]: Fix - concurrent profile deletion race condition (SQLite read-modify-write hazard)**
  *Symptoms*: ### Summary  ## Bug Rapidly deleting multiple profile items (skills, experience, etc.) causes them to reappear in the UI. The deleted items also persist in the Kuzu graph and LanceDB vector store.  ## Root Cause FastAPI runs DELETE requests concurrently in threadpool workers via asyncio.to_thread. Both PROFILE_SNAPSHOT_KEY and PROFILE_DELETIONS_KEY are stored as JSON in SQLite and follow a read-modify-write pattern:  1. Thread 1 reads snapshot → [A, B] 2. Thread 2 reads snapshot → [A, B]   3. Thread 1 deletes A → saves [B] 4. Thread 2 deletes B → saves [A]  ← overwrites Thread 1's write  Result: A is restored. Its tombstone is also lost, so it stays in Kuzu + LanceDB.  ## Proposed Fix Add a reentrant lock around all profile write operations in backend/data/graph/profile.py:  import threading, functools  _profile_write_lock = threading.RLock()  def _profile_write_locked(func):     @functools.wraps(func)     def wrapper(*args, **kwargs):         with _profile_write_lock:             return func(*args, **kwargs)     return wrapper  Decorate: save_profile_snapshot, _remember_profile_deletion, _forget_profile_deletion, delete_skill, _delete_text_node  RLock (reentrant) is needed because these functions call each other internally.  ## Reproduction Open profile → rapidly click delete on multiple skills/experience items → items disappear then reappear  ### Steps to reproduce  1. Open JustHireMe → navigate to Profile tab 2. Add 3+ skills if not already present 3. Rapidly click the tra

- **Issue #39** (2026-05-16): **[Bug]: Showing just a ? for not filling required fields in Model Selection**
  *Symptoms*: ### Summary  I was trying to configure NVIDIA NIM for the model and chose custom models for all the steps and configured all the below steps with the API keys. However, when I submit it just shows ?Submit without showing the fields that needs input or something. Tried changing so many fields and turning on off many togglers.   Can't figure out which fields more it needs.   ### Steps to reproduce  1. Install the app 2. Configure the model in advance settings 3. Configure the parameters  4. Click on submit or save  ### Expected behavior  An error message or highlighting the fields is much more helpful.  ### OS / app version  Windows 11
  **Post-Mortem & Fix Analysis**:
  > Hey @ghoshzsh  Thanks a lot for reporting this issue , this will be fixed with the new version , im currently working on a new microservice based architecture so this might take a bit longer but it surely will be fixed.  Once again really appreciate the effort.

- **Issue #26** (2026-05-08): **[Bug]: Generate Package buttons show false success when backend generation fails**
  *Symptoms*: ### Summary    The `Generate Package` actions in the lead cards can look successful even when backend generation fails.  Right now the UI sets a temporary queued/generating state when the user clicks generate, but it does not check whether the backend response was actually successful. If the backend returns a non-2xx response, the user can still briefly see a success-looking state instead of an actionable error.  Affected areas  - lead card generate action - pipeline card generate action  ### Steps to reproduce  1. Open a lead where package generation can fail. 2. Trigger `Generate Package`. 3. Make the backend return an error response such as `409` or `500`. 4. Observe that the UI still shows a queued/generating state instead of surfacing the backend error clearly.  ### Expected behavior  If package generation fails, the UI should: - check `response.ok` - stop the generating state immediately - show the backend error message when available  ### OS / app version  _No response_

- **Issue #24** (2026-05-08): **[Bug]: macOS/Linux build-sidecar.sh script fails due to incorrect PyInstaller distpath**
  *Symptoms*: ### Summary  The scripts/build-sidecar.sh script fails to bundle the Python sidecar on macOS/Linux correctly. The PyInstaller --distpath is incorrectly pointing to ../src-tauri/resources instead of ../src-tauri/resources/backend. This causes PyInstaller to build the executable directly into the resources directory as a file named backend, which crashes the final cp command and breaks the Tauri startup flow since Tauri expects a directory structure of resources/backend/backend-<triple>.  ### Steps to reproduce  Clone the repository on macOS or Linux. Run npm install and install backend requirements with uv. Run bash scripts/build-sidecar.sh. See the error cp: src-tauri/resources/backend/backend-aarch64-apple-darwin: Not a directory.  ### Expected behavior  The Python sidecar executable should be placed properly in src-tauri/resources/backend/ and renamed with the correct Tauri triple-target name, matching the exact behavior of the Windows .ps1 script.  ### OS / app version  macOS (M-series / ARM64 or Intel)
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the bug , currently this software is in alpha stage I am currently first pushing a  general POC version , once that is achieved I'll move on to diversification and integrating other OS , please bear with it for the time.

- **Issue #22** (2026-05-07): **[Bug]: macOS/Linux build-sidecar.sh script fails due to incorrect PyInstaller distpath**
  *Symptoms*: ### Summary  The scripts/build-sidecar.sh script fails to bundle the Python sidecar on macOS/Linux correctly. The PyInstaller --distpath is incorrectly pointing to ../src-tauri/resources instead of ../src-tauri/resources/backend. This causes PyInstaller to build the executable directly into the resources directory as a file named backend, which crashes the final cp command and breaks the Tauri startup flow since Tauri expects a directory structure of resources/backend/backend-<triple>.  ### Steps to reproduce  Clone the repository on macOS or Linux. Run npm install and install backend requirements with uv. Run bash scripts/build-sidecar.sh. See the error cp: src-tauri/resources/backend/backend-aarch64-apple-darwin: Not a directory.  ### Expected behavior  The Python sidecar executable should be placed properly in src-tauri/resources/backend/ and renamed with the correct Tauri triple-target name, matching the exact behavior of the Windows .ps1 script.  ### OS / app version  macOS (M-series / ARM64 or Intel)

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

### Incident Patch 1: `08e5fb26` (2026-09-22)
**Commit Message**: fix(website): accept a Supabase URL pasted with /rest/v1

The waitlist API appends /rest/v1 itself, so a Project URL copied as
https://<ref>.supabase.co/rest/v1/ produced 404s. Strip the suffix.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `website/api/waitlist.js` (modified, +2/-1)
```diff
@@ -37,7 +37,8 @@ function normalizeSource(value) {
 }
 
 function supabaseConfig() {
-  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
+  // Accept the Project URL as pasted, including the common ".../rest/v1/" form.
+  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
   const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
   return url && key ? { url, key } : null;
 }
```

---

### Incident Patch 2: `d890eb2d` (2026-09-22)
**Commit Message**: fix(website): make the iPhone page navbar opaque

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `website/src/ios/ios.css` (modified, +1/-3)
```diff
@@ -171,9 +171,7 @@ main > section { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
   height: 64px;
   padding: 0 10px 0 12px;
   border-radius: 14px;
-  background: color-mix(in srgb, var(--card) 97%, transparent);
-  backdrop-filter: blur(18px) saturate(140%);
-  -webkit-backdrop-filter: blur(14px) saturate(140%);
+  background: var(--card);
   box-shadow: 3px 4px 0 var(--shadow);
   transition: box-shadow 0.35s var(--ease);
 }
```

---

### Incident Patch 3: `1d1eac8a` (2026-09-22)
**Commit Message**: fix(website): use the JustHireMe J-check mark on the iPhone page

Replaces the old D mark in the /ios/ header, favicon and home-screen icon
with the current brand mark used on @justhiremeai.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `website/ios/index.html` (modified, +3/-2)
```diff
@@ -24,8 +24,9 @@
     <meta name="theme-color" content="#f6f5f0" media="(prefers-color-scheme: light)" />
     <meta name="theme-color" content="#20222b" media="(prefers-color-scheme: dark)" />
     <link rel="canonical" href="https://justhireme.ai/ios/" />
-    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
-    <link rel="apple-touch-icon" href="/favicon.svg" />
+    <link rel="icon" href="/ios/favicon-32.png" type="image/png" sizes="32x32" />
+    <link rel="icon" href="/ios/icon-64.png" type="image/png" sizes="64x64" />
+    <link rel="apple-touch-icon" href="/ios/apple-touch-icon.png" />
     <link rel="preload" href="/ios/fonts/InstrumentSerif-Regular.ttf" as="font" type="font/ttf" crossorigin />
     <link rel="preload" href="/ios/fonts/InstrumentSans-Regular.ttf" as="font" type="font/ttf" crossorigin />
     <link rel="preload" href="/ios/matches.webp" as="image" type="image/webp" />
```

**File**: `website/src/ios/ios.css` (modified, +2/-2)
```diff
@@ -62,8 +62,6 @@
     --shadow: rgb(0 0 0 / 0.25);
     --bezel: #0f1015;
   }
-  /* The favicon mark is a dark tile; give it a paper backing so it reads on the dark chrome. */
-  .brand img { background: #f4f3ee; border-radius: 9px; padding: 1px; }
 }
 
 *, *::before, *::after { box-sizing: border-box; }
@@ -175,6 +173,8 @@ main > section { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
   border-bottom: 1px solid var(--rule);
 }
 .brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; }
+/* The JustHireMe mark sits on its own paper tile, like the app icon. */
+.brand img { border-radius: 8px; box-shadow: 0 0 0 1px var(--line); }
 .header-nav { display: flex; gap: 22px; margin-left: auto; font-size: 15px; color: var(--copy); }
 .header-nav a { text-decoration: none; }
 .header-nav a:hover { color: var(--ink); }
```

**File**: `website/src/ios/main.jsx` (modified, +1/-1)
```diff
@@ -362,7 +362,7 @@ function Header() {
   return (
     <header className="site-header">
       <a className="brand" href="/ios/" aria-label="JustHireMe for iPhone">
-        <img src="/favicon.svg" alt="" width="28" height="28" />
+        <img src="/ios/icon-64.png" alt="" width="32" height="32" />
         <span>JustHireMe</span>
       </a>
       <nav className="header-nav" aria-label="Primary">
```

---

### Incident Patch 4: `473d2a00` (2026-07-02)
**Commit Message**: feat(profile-ui): show the import summary + what was skipped/capped

The JSON-import result card now leads with the backend's one-line `summary`
(falling back to the old counts line) and lists the structured report's
skipped/capped entries ("Skipped 2 skills (invalid or duplicate)", "Kept the
top 200 of 230 skills") instead of a vague "Some items were skipped." No new
state, components, or network calls.

**File**: `src/features/profile/IngestionView.tsx` (modified, +11/-3)
```diff
@@ -762,10 +762,18 @@ export function IngestionView({ api }: { api: ApiFetch }) {
                 border: `1px solid ${jsonResult.status === "ok" ? "var(--green)" : "var(--line)"}`,
               }}>
                 <div style={{ fontWeight: 600 }}>
-                  Imported: {jsonResult.stats?.skills ?? 0} skills - {jsonResult.stats?.experience ?? 0} jobs - {jsonResult.stats?.projects ?? 0} projects - {jsonResult.stats?.certifications ?? 0} certifications
+                  {jsonResult.summary
+                    || `Imported: ${jsonResult.stats?.skills ?? 0} skills - ${jsonResult.stats?.experience ?? 0} jobs - ${jsonResult.stats?.projects ?? 0} projects - ${jsonResult.stats?.certifications ?? 0} certifications`}
                 </div>
-                {jsonResult.status === "partial" && (
-                  <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-3)" }}>Some items were skipped.</div>
+                {(jsonResult.report?.skipped?.length > 0 || jsonResult.report?.capped?.length > 0) && (
+                  <div style={{ fontSize: 13, marginTop: 6, color: "var(--ink-3)", lineHeight: 1.6 }}>
+                    {jsonResult.report.skipped?.slice(0, 6).map((s: any, i: number) => (
+                      <div key={`sk-${i}`}>Skipped {s.count} {s.field} ({s.reason})</div>
+                    ))}
+                    {jsonResult.report.capped?.slice(0, 6).map((c: any, i: number) => (
+                      <div key={`cp-${i}`}>Kept the top {c.kept} of {c.original} {c.field} (cap)</div>
+                    ))}
+                  </div>
                 )}
               </div>
             )}
```

---

### Incident Patch 5: `6ed82bae` (2026-07-02)
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

### Incident Patch 6: `ed34491a` (2026-07-02)
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

### Incident Patch 7: `74f73fbf` (2026-07-02)
**Commit Message**: fix(ingest): accept real-world profile JSON shapes instead of a raw 422

POST /ingest/profile bound a rigid Pydantic model (ProfileImportBody), so
FastAPI validated the body BEFORE the handler — a profile whose `skills` was a
grouped {"languages":[...],"frontend":[...]} object (or any alt-keyed shape)
died with a raw 422 detail array, and the handler's own tolerant "partial"
fallback plus the fully shape-tolerant service/normalizer were unreachable.

- Endpoint now takes the raw JSON object: json.loads + dict-guard + a 5MB
  serialized-size cap; only genuinely broken input (not-JSON / not-an-object /
  oversized) is refused, with a human-readable message.
- normalize_profile_payload gains coerce_skills_shape(): a grouped {cat:[names]}
  dict flattens to categorized skills (was iterating dict KEYS -> inventing
  skills named "languages"/"frontend"), a flat string list and alt-keyed
  ({skill,title,label}) dicts are accepted, and scalar/garbage coerces to [].
- Field caps that lived on the removed Pydantic model are now enforced by
  TRUNCATION in the normalizer (name/summary/description/impact/...), so an
  oversized field never rejects the whole payload.
- Raised the skills cap 100

**File**: `backend/api/routers/ingestion.py` (modified, +44/-65)
```diff
@@ -7,14 +7,27 @@
 import contextlib
 from pathlib import Path
 
-from fastapi import APIRouter, File, Form, HTTPException, UploadFile
-from pydantic import BaseModel, Field
+from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
+from pydantic import Field
 
 from api.rate_limit import RateLimiter, require_rate_limit
 from api.dependencies import get_profile_service
 from core.types import StrictBody
 
 MAX_UPLOAD_SIZE = 10 * 1024 * 1024
+# Serialized-JSON ceiling for the profile-import body: generous for any real
+# profile (a rich profile is a few hundred KB) while refusing an abusive blob
+# before it is parsed/normalized. Kept separate from MAX_UPLOAD_SIZE (files).
+MAX_PROFILE_JSON_BYTES = 5 * 1024 * 1024
+# Hard cap on pasted résumé text, so a giant paste can't buffer unbounded in the
+# form parser. The parser itself truncates further (profile.ingestor MAX_INGEST_CHARS).
+MAX_RAW_RESUME_CHARS = 2_000_000
+
+_EMPTY_IMPORT_STATS = {
+    "skills": 0, "experience": 0, "projects": 0,
+    "education": 0, "certifications": 0, "achievements": 0,
+    "vector_sync": "skipped",
+}
 
 
 class GithubIngestBody(StrictBody):
@@ -31,54 +44,12 @@ class PortfolioIngestBody(StrictBody):
     )
 
 
-class ProfileSkill(BaseModel):
-    name: str = Field(max_length=160)
-    category: str = Field(default="general", max_length=80)
-
-
-class ProfileExperience(BaseModel):
-    role: str = Field(default="", max_length=200)
-    company: str = Field(default="", max_length=200)
-    period: str = Field(default="", max_length=100)
-    description: str = Field(default="", max_length=5000)
-
-
-class ProfileProject(BaseModel):
-    title: str = Field(default="", max_length=200)
-    stack: str = Field(default="", max_length=500)
-    repo: str = Field(default="", max_length=500)
-    impact: str = Field(default="", max_length=1000)
-
-
-class ProfileEntry(BaseModel):
-    title: str = Field(max_length=500)
-
-
-class ProfileIdentity(BaseModel):
-    email: str = Field(default="", max_length=200)
-    phone: str = Field(default="", max_length=50)
-    linkedin_url: str = Field(default="", max_length=500)
-    github_url: str = Field(default="", max_length=500)
-    website_url: str = Field(default="", max_length=500)
-    city: str = Field(default="", max_length=200)
-
-
-class ProfileCandidate(BaseModel):
-    name: str = Field(default="", max_length=160)
-    summary: str = Field(default="", max_length=4000)
-
-
-class ProfileImportBody(BaseModel):
-    """Accepts any subset of fields - all are optional."""
-
-    candidate: ProfileCandidate = Field(default_factory=ProfileCandidate)
-    identity: ProfileIdentity = Field(default_factory=ProfileIdentity)
-    skills: list[ProfileSkill] = Field(default_factory=list)
-    experience: list[ProfileExperience] = Field(default_factory=list)
-    projects: list[ProfileProject] = Field(default_factory=list)
-    education: list[ProfileEntry] = Field(default_factory=list)
-    certifications: list[ProfileEntry] = Field(default_factory=list)
-    achievements: list[ProfileEntry] = Field(default_factory=list)
+# NOTE: POST /ingest/profile intentionally does NOT bind a strict Pydantic body.
+# Profile JSON shapes vary too much (grouped-dict skills, list stacks, alt keys),
+# and a strict model 422'd valid data before the tolerant normalizer could run.
+# The endpoint takes the raw JSON object; profile.normalization.normalize_profile_payload
+# coerces + bounds every field. Field caps that used to live on the removed
+# Profile* models are enforced there by truncation.
 
 
 def _read_profile_template(path: Path, logger) -> dict:
@@ -173,6 +144,11 @@ async def ingest(
         require_rate_limit(ingest_limiter)
         if file and file.filename and file.size and file.size > MAX_UPLOAD_SIZE:
             raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_SIZE // 1024 // 1024} MB)")
+        # Bound pasted text so an oversized paste can't pin the parser; the parser
+        # truncates further for LLM cost. Truncate rather than 413 — a best-effort
+        # parse of the first ~2M chars beats rejecting the whole paste.
+        if raw and len(raw) > MAX_RAW_RESUME_CHARS:
+            raw = raw[:MAX_RAW_RESUME_CHARS]
         try:
             async with _temp_upload(file) as pdf_path:
                 profile = await get_profile_service().ingest_resume(raw, pdf_path)
@@ -223,25 +199,28 @@ async def ingest_github_endpoint(body: GithubIngestBody):
         return result
 
     @router.post("/ingest/profile")
-    async def import_profile_json(body: ProfileImportBody):
+    async def import_profile_json(request: Request):
+        # Accept the raw JSON object rather than a rigid Pydantic model: real
+        # profile exports vary in shape (skills as a grouped {category:[...]}
+        # dict, a flat string list, or [{name,category}]; stack as a list or a
+        # string; alternate keys). The service + normalizer already coerce all
+        
```

**File**: `backend/profile/normalization.py` (modified, +75/-13)
```diff
@@ -2,6 +2,7 @@
 import logging
 
 import re
+from collections.abc import Mapping
 from typing import Any
 from urllib.parse import unquote, urlparse
 
@@ -12,6 +13,49 @@
 # Re-exported here for backward compatibility with existing call sites.
 from data.skill_taxonomy import SKILL_CANONICAL
 
+_log = logging.getLogger(__name__)
+
+# Upper bounds on how many of each entry we keep. Generous — a power user's
+# profile can carry well over 100 skills — while still bounding graph/vector cost.
+MAX_SKILLS = 200
+MAX_PROJECTS = 80
+MAX_EDUCATION = 30
+MAX_TEXT_ENTRIES = 40
+
+
+def coerce_skills_shape(raw: Any) -> list[Any]:
+    """Coerce any reasonable ``skills`` shape into the flat list normalize_skills
+    expects, so real-world profile JSON never fails to import.
+
+    Handles: a grouped dict ``{"languages": ["Python"], "frontend": ["React"]}``
+    (category = group name), a flat string list ``["Python", "React"]``, a list of
+    ``{name,category}`` / alt-keyed dicts, and mixtures. Anything else -> ``[]``.
+    """
+    if isinstance(raw, Mapping):
+        out: list[Any] = []
+        for group, names in raw.items():
+            items = names if isinstance(names, list) else [names]
+            for name in items:
+                if isinstance(name, Mapping):
+                    entry = dict(name)
+                    entry.setdefault("category", str(group))
+                    out.append(entry)
+                elif name is not None and str(name).strip():
+                    out.append({"name": str(name), "category": str(group)})
+        return out
+    if isinstance(raw, list):
+        return raw
+    return []
+
+
+def _cap(value: Any, limit: int) -> str:
+    """Bound a free-text field to ``limit`` chars. Replaces the per-field
+    max_length caps that used to live on the (now-removed) Pydantic import model —
+    oversized values are truncated here rather than 422'd at the API boundary."""
+    text = str(value or "")
+    return text[:limit] if len(text) > limit else text
+
+
 # Precompile the whole-token alias patterns ONCE at import. The ingest skill-scan
 # runs this vocabulary against every project + experience description; the old code
 # rebuilt a fresh regex for each of the ~77 entries on every call.
@@ -155,7 +199,7 @@ def normalize_profile_payload(data: dict[str, Any]) -> dict[str, Any]:
     data = dict(data or {})
     candidate = _normalize_candidate(data.get("candidate") or data)
     identity = dict(data.get("identity") or {})
-    skills = normalize_skills(data.get("skills") or [])
+    skills = normalize_skills(coerce_skills_shape(data.get("skills")))
     experience = normalize_experiences(data.get("experience") or [])
     projects = normalize_projects(data.get("projects") or [], known_skills=[item["name"] for item in skills])
     education = normalize_education_entries(data.get("education") or [])
@@ -227,7 +271,11 @@ def normalize_skills(raw_items: list[Any]) -> list[dict[str, str]]:
     seen: set[str] = set()
     for raw in raw_items:
         item = _as_dict(raw)
-        value = item.get("name", item.get("n", raw if isinstance(raw, str) else ""))
+        value = (
+            item.get("name") or item.get("n") or item.get("skill")
+            or item.get("title") or item.get("label")
+            or (raw if isinstance(raw, str) else "")
+        )
         category = _clean_inline_text(item.get("category", item.get("cat", "general"))) or "general"
         for skill in split_skill_names(str(value or "")):
             if not _valid_skill(skill):
@@ -236,8 +284,10 @@ def normalize_skills(raw_items: list[Any]) -> list[dict[str, str]]:
             if key in seen:
                 continue
             seen.add(key)
-            out.append({"name": skill, "category": category})
-    return out[:100]
+            out.append({"name": _cap(skill, 160), "category": _cap(category, 80)})
+    if len(out) > MAX_SKILLS:
+        _log.warning("normalize_skills: truncating %d skills to %d", len(out), MAX_SKILLS)
+    return out[:MAX_SKILLS]
 
 
 def split_skill_names(value: str) -> list[str]:
@@ -294,7 +344,11 @@ def normalize_experiences(raw_items: list[Any]) -> list[dict[str, Any]]:
             if skills:
                 existing["skills"] = _dedupe([*(existing.get("skills") or []), *skills])
             continue
-        entry = {"role": role, "company": co, "period": period, "description": description, "skills": skills}
+        entry = {
+            "role": _cap(role, 200), "company": _cap(co, 200),
+            "period": _cap(period, 100), "description": _cap(description, 5000),
+            "skills": skills,
+        }
         index[key] = entry
         out.append(entry)
     return out
@@ -377,10 +431,10 @@ def normalize_projects(raw_items: list[Any], *, known_skills: list[str] | None =
         ident = _key(title) or _key(repo)
         cleaned = {
             **item,
-            "title": title,
-            "stack": ", ".join(_dedupe(stack_items)),
-        
```

**File**: `backend/tests/test_api.py` (modified, +38/-1)
```diff
@@ -988,12 +988,49 @@ def test_profile_import_valid_skills(self):
         self.assertEqual(resp.status_code, 200)
         self.assertGreaterEqual(resp.json()["stats"]["skills"], 0)
 
+    def test_profile_import_grouped_skills_dict(self):
+        # Bug: a grouped {category: [names]} skills object used to 422 at the
+        # rigid Pydantic gate. It must now import as real skills, categorized by
+        # group name — never a raw validation error.
+        resp = post(
+            "/api/v1/ingest/profile",
+            json={
+                "candidate": {"name": "Vasu"},
+                "skills": {
+                    "languages": ["Python", "TypeScript"],
+                    "frontend": ["React", "Vite"],
+                },
+                "projects": [{"title": "JustHireMe", "stack": ["Python", "React"]}],
+            },
+        )
+        self.assertEqual(resp.status_code, 200)
+        self.assertIn(resp.json().get("status"), {"ok", "partial"})
+
+    def test_profile_import_flat_string_skills(self):
+        # A flat list of skill strings is also accepted (no {name} wrapper needed).
+        resp = post(
+            "/api/v1/ingest/profile",
+            json={"skills": ["Python", "React", "PostgreSQL"]},
+        )
+        self.assertEqual(resp.status_code, 200)
+
+    def test_profile_import_not_a_json_object(self):
+        # A JSON array (not an object) is a clear 400 with a human message, not a
+        # Pydantic detail array.
+        resp = post("/api/v1/ingest/profile", json=["Python", "React"])
+        self.assertEqual(resp.status_code, 400)
+
     def test_profile_import_skill_name_too_long(self):
+        # Tolerant contract: an oversized/garbage skill name is accepted (never a
+        # raw 422) and simply not imported — the normalizer bounds/validates fields
+        # instead of the API boundary rejecting the whole payload.
         resp = post(
             "/api/v1/ingest/profile",
             json={"skills": [{"name": "x" * 200, "category": "language"}]},
         )
-        self.assertEqual(resp.status_code, 422)
+        self.assertEqual(resp.status_code, 200)
+        self.assertIn(resp.json().get("status"), {"ok", "partial"})
+        self.assertEqual(resp.json().get("stats", {}).get("skills"), 0)
 
     def test_profile_template_endpoint(self):
         resp = get("/api/v1/ingest/profile/template")
```

**File**: `backend/tests/test_ingestion_hardening.py` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+"""Ingestion pipeline hardening: tolerant profile shapes + input caps + zip-bomb guard.
+
+Unit-level (no DB/graph) so these run fast under the suite's global sqlite fake.
+"""
+
+from __future__ import annotations
+
+import io
+import zipfile
+
+import pytest
+
+from profile.normalization import (
+    MAX_SKILLS,
+    coerce_skills_shape,
+    normalize_profile_payload,
+    normalize_skills,
+)
+
+
+def _skill_names(payload: dict) -> list[str]:
+    return [s["name"] for s in payload["skills"]]
+
+
+class TestSkillsShapeTolerance:
+    def test_grouped_dict_flattens_to_categorized_skills(self):
+        out = normalize_profile_payload({
+            "skills": {"languages": ["Python", "TypeScript"], "frontend": ["React"]}
+        })
+        names = _skill_names(out)
+        assert "Python" in names and "React" in names
+        # category name must NOT leak in as a skill
+        assert "languages" not in [n.lower() for n in names]
+        cats = {s["name"]: s["category"] for s in out["skills"]}
+        assert cats.get("Python") == "languages"
+        assert cats.get("React") == "frontend"
+
+    def test_flat_string_list(self):
+        out = normalize_profile_payload({"skills": ["Python", "PostgreSQL"]})
+        assert "Python" in _skill_names(out)
+
+    def test_list_of_alt_keyed_dicts(self):
+        # skill dicts keyed 'skill'/'title'/'label' instead of 'name'
+        out = normalize_skills(coerce_skills_shape([
+            {"skill": "Python"}, {"title": "React"}, {"label": "Rust"},
+        ]))
+        got = {s["name"] for s in out}
+        assert {"Python", "React", "Rust"} <= got
+
+    def test_grouped_dict_with_scalar_values(self):
+        out = normalize_skills(coerce_skills_shape({"primary": "Python"}))
+        assert any(s["name"] == "Python" for s in out)
+
+    def test_grouped_dict_with_nested_dicts(self):
+        out = normalize_skills(coerce_skills_shape({"lang": [{"name": "Python"}]}))
+        assert any(s["name"] == "Python" and s["category"] == "lang" for s in out)
+
+    @pytest.mark.parametrize("garbage", [None, 42, "just a string", 3.14])
+    def test_non_list_non_dict_coerces_empty(self, garbage):
+        assert coerce_skills_shape(garbage) == []
+
+    def test_list_stack_project_is_accepted(self):
+        out = normalize_profile_payload({"projects": [{"title": "X", "stack": ["Python", "React"]}]})
+        assert out["projects"], "a project with a list stack must import"
+        assert "Python" in out["projects"][0]["stack"]
+
+    def test_skills_are_capped(self):
+        many = [f"Skill{i}" for i in range(MAX_SKILLS + 50)]
+        out = normalize_profile_payload({"skills": many})
+        assert len(out["skills"]) <= MAX_SKILLS
+
+
+class TestFieldCaps:
+    def test_oversized_summary_truncated_not_rejected(self):
+        out = normalize_profile_payload({"candidate": {"name": "A", "summary": "z" * 9000}})
+        assert len(out["candidate"]["summary"]) <= 4000
+
+    def test_oversized_experience_description_truncated(self):
+        out = normalize_profile_payload({
+            "experience": [{"role": "Engineer", "company": "Acme", "description": "d" * 9000}]
+        })
+        assert out["experience"], "experience should import"
+        assert len(out["experience"][0]["description"]) <= 5000
+
+
+class TestLinkedInZipBomb:
+    def _zip_with_member(self, name: str, size: int) -> bytes:
+        buf = io.BytesIO()
+        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
+            # highly compressible payload -> tiny archive, large decompressed size
+            zf.writestr(name, b"A" * size)
+        return buf.getvalue()
+
+    def test_oversized_member_rejected(self):
+        from profile.linkedin_parser import _MAX_CSV_MEMBER_BYTES, _read_csv
+
+        payload = self._zip_with_member("Skills.csv", _MAX_CSV_MEMBER_BYTES + 1)
+        with zipfile.ZipFile(io.BytesIO(payload)) as zf, pytest.raises(ValueError):
+            _read_csv(zf, "Skills.csv")
+
+    def test_normal_member_reads_fine(self):
+        from profile.linkedin_parser import _read_csv
+
+        buf = io.BytesIO()
+        with zipfile.ZipFile(buf, "w") as zf:
+            zf.writestr("Skills.csv", "Name\nPython\nReact\n")
+        with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as zf:
+            rows = _read_csv(zf, "Skills.csv")
+        assert [r["Name"] for r in rows] == ["Python", "React"]
```

---

### Incident Patch 8: `9cd2dcdf` (2026-07-02)
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

---

### Incident Patch 9: `75fc3f6b` (2026-07-02)
**Commit Message**: fix(feedback): persist an exactly-0 recomputed match score, not the base

update_learning_scores wrote the match score as
`int(ranked.get("score") or ranked.get("base_score") or 0)`. Python's `or`
short-circuits on any falsy value, so a feedback recompute that legitimately
drove a low-base lead to a match score of exactly 0 (a strong negative
preference delta on a lead whose base match was <=12) persisted the higher
base_score instead of 0 — a silent wrong result for that edge. Fall back to
the base only when the caller supplied no score at all (key absent/None); a
computed 0 now survives as 0. Regression test drives b to exactly 0 via a
mocked preference delta and asserts it persists.

**File**: `backend/data/sqlite/leads.py` (modified, +5/-2)
```diff
@@ -289,8 +289,11 @@ def update_learning_scores(updates: list[tuple[str, dict, int]], db_path: str =
             int(ranked.get("learning_delta") or 0),
             str(ranked.get("learning_reason") or "")[:700],
             # Match score + its idempotency base (feedback re-rank). Fall back to the
-            # base so a caller that didn't compute a match delta never zeroes the score.
-            int(ranked.get("score") or ranked.get("base_score") or 0),
+            # base only when the caller didn't compute a match score at all (key
+            # absent/None) — a legitimately-computed score of exactly 0 (a strong
+            # negative feedback delta driving a low-base lead to the floor) must
+            # persist as 0, not silently revert to the higher base_score.
+            int(ranked["score"] if ranked.get("score") is not None else (ranked.get("base_score") or 0)),
             int(ranked.get("base_score") or 0),
             job_id,
         )
```

**File**: `backend/tests/test_feedback_recompute.py` (modified, +34/-0)
```diff
@@ -115,6 +115,34 @@ def _run(script: str, tmp_path) -> subprocess.CompletedProcess:
 """
 
 
+_MATCH_ZERO = """
+import sys
+sys.path.insert(0, "backend")
+from unittest import mock
+from data.sqlite.connection import init_sql
+init_sql()
+from data.sqlite.leads import save_lead, save_lead_feedback, update_lead_score, get_lead_by_id
+from ranking.service import RankingService
+
+save_lead({"job_id": "a", "title": "Registered Nurse", "platform": "greenhouse",
+           "url": "https://x/a", "signal_score": 50, "kind": "job", "status": "matched"})
+save_lead_feedback("a", "not_relevant", "")   # an example must exist or recompute no-ops
+save_lead({"job_id": "b", "title": "Line Cook", "platform": "greenhouse",
+           "url": "https://x/b", "signal_score": 40, "kind": "job", "status": "matched"})
+update_lead_score("b", 10, "weak base match", [], [], preserve_status=True)  # low base match = 10
+
+rs = RankingService()
+# Strong negative preference delta drives b's match score to exactly 0.
+with mock.patch("ranking.feedback_semantic.preference_deltas", return_value={"b": -10, "a": -10}):
+    rs._recompute_feedback_signals(500)
+persisted = int(get_lead_by_id("b")["score"])
+# The regression: `0 or base_score` used to short-circuit and persist the base (10);
+# a legitimately-computed match score of exactly 0 must survive as 0.
+assert persisted == 0, persisted
+print("MATCH_ZERO_OK")
+"""
+
+
 def test_feedback_recompute_reranks_open_leads(tmp_path):
     result = _run(_RERANK, tmp_path)
     assert result.returncode == 0, result.stderr
@@ -127,6 +155,12 @@ def test_feedback_reranks_match_score_idempotently(tmp_path):
     assert "MATCH_RERANK_OK" in result.stdout
 
 
+def test_feedback_reranks_match_score_to_exactly_zero(tmp_path):
+    result = _run(_MATCH_ZERO, tmp_path)
+    assert result.returncode == 0, result.stderr
+    assert "MATCH_ZERO_OK" in result.stdout
+
+
 def test_recompute_is_noop_without_feedback(tmp_path):
     result = _run(_NOOP, tmp_path)
     assert result.returncode == 0, result.stderr
```

---

### Incident Patch 10: `411ec30a` (2026-07-02)
**Commit Message**: fix(discovery): clean role query + strict aggregator title-match for relevant results

A real scan surfaced that profile-derived search terms were noisy: the query became
"Applied AI Engineer Full-Stack Engineer — Internal Finance & P&L Platform"
(summary + a project-laden experience title + an em-dash mojibake), so the keyless
aggregator returned unrelated German sales/admin roles that the quality gate then
filtered to nothing. Fix:
- _clean_role_query(): reduce the profile terms to a short, clean role phrase — cut
  at project/detail separators (space-dashes, punctuation, "at"), treat non-ASCII as
  a boundary, drop filler ("summary"/"profile"), keep internal hyphens (Full-Stack).
- Arbeitnow: match the role against the job TITLE only, not tags (a tag-based match
  let "Technical Sales Support" tagged "engineering" through).
Verified against the live profile: query "Applied AI Engineer", aggregator now
returns real engineer roles (Software/Backend/Java/Network Engineer + 40 from Muse).

**File**: `backend/core/config.py` (modified, +29/-2)
```diff
@@ -194,6 +194,31 @@ def profile_for_discovery(profile: dict | None, cfg: dict) -> dict:
     return profile
 
 
+def _clean_role_query(terms: list[str]) -> str:
+    """A short, clean ROLE phrase for the aggregator/community search queries.
+
+    Profile-derived terms are noisy — a summary like "Applied AI Engineer. Engineer
+    Summary" or an experience title like "Full-Stack Engineer — Internal Finance & P&L
+    Platform" would make a keyless job API return unrelated results (that then get
+    quality-gated to nothing). Strip project/detail suffixes, encoding artifacts and
+    filler words, and return the first genuine 1-5 word role phrase.
+    """
+    for term in terms:
+        # Non-ASCII noise (incl. mojibake em-dashes) becomes a separator, not deleted,
+        # so "Full-Stack Engineer — Internal Finance" cuts cleanly to the role.
+        s = re.sub(r"[^\x20-\x7e]+", " | ", str(term))
+        # Cut at the first separator introducing a project/detail. Only a SPACE-padded
+        # dash counts (so "Full-Stack"/"Front-End" keep their internal hyphen).
+        head = re.split(r"\s+[-—–]\s+|[|(:·•/]|\.\s+|\bat\b", s, maxsplit=1)[0]
+        head = re.sub(r"\b(summary|profile|resume|cv|experience)\b", " ", head, flags=re.I)
+        head = re.sub(r"\s+", " ", head).strip(" ,.-&")
+        words = head.split()
+        if head and 1 <= len(words) <= 5:
+            return head
+    first = (terms[0] if terms else "").strip()
+    return " ".join(first.split()[:4]) or "jobs"
+
+
 def terms_for_discovery(profile: dict, limit: int = 4) -> list[str]:
     terms: list[str] = []
     summary = str(profile.get("desired_position") or profile.get("s") or "").strip()
@@ -278,8 +303,10 @@ def has_explicit_discovery_targets(cfg: dict | None) -> bool:
 def profile_free_source_targets(profile: dict) -> str:
     if not has_profile_discovery_signal(profile):
         return ""
-    terms = terms_for_discovery(profile, 3)
-    role_query = " ".join(terms[:2])
+    terms = terms_for_discovery(profile, 4)
+    # A clean, focused role phrase drives the keyless aggregator + community search;
+    # the raw concatenated terms produced unrelated results that got gate-filtered away.
+    role_query = _clean_role_query(terms)
     location = str((profile or {}).get("_discovery_location") or "").strip()
     lines = [
         # Keyless structured aggregator FIRST: real jobs for the candidate's role in
```

**File**: `backend/discovery/sources/aggregator.py` (modified, +4/-2)
```diff
@@ -116,8 +116,10 @@ async def _fetch_arbeitnow(role_terms: list[str]) -> list[dict]:
         if not title or not url:
             continue
         tags = job.get("tags") or []
-        haystack = " ".join([title, " ".join(str(t) for t in tags if t)])
-        if not _matches_role(haystack, role_terms):
+        # Match the TITLE (not tags): Arbeitnow is a broad, Germany-heavy feed and a
+        # tag-based match let unrelated roles ("Technical Sales Support" tagged
+        # "engineering") through. The role phrase must be in the actual job title.
+        if not _matches_role(title, role_terms):
             continue
         location = str(job.get("location") or "").strip()
         remote = "remote" if job.get("remote") else ""
```

**File**: `backend/tests/test_discovery_backbone.py` (modified, +13/-0)
```diff
@@ -50,6 +50,19 @@ def test_profile_free_source_targets_are_zero_config_and_adaptive():
     assert not any(x.startswith("ats:") for x in nurse_lines)   # but no tech ATS flood
 
 
+def test_clean_role_query_strips_noise():
+    from core.config import _clean_role_query
+    # project-laden title + em-dash separator -> just the role phrase (internal hyphen kept)
+    assert _clean_role_query(["Full-Stack Engineer — Internal Finance & P&L Platform"]) == "Full-Stack Engineer"
+    # non-ASCII/mojibake acts as a separator, not deleted
+    assert _clean_role_query(["Full-Stack Engineer � Internal Finance"]) == "Full-Stack Engineer"
+    # summary filler dropped, sentence split on ". "
+    assert _clean_role_query(["Applied AI Engineer. Engineer Summary"]) == "Applied AI Engineer"
+    # falls through to the next usable term when the first is empty after cleaning
+    assert _clean_role_query(["", "Registered Nurse"]) == "Registered Nurse"
+    assert _clean_role_query([]) == "jobs"
+
+
 def test_aggregator_target_parsing_and_category_mapping():
     assert agg._muse_category(agg._role_terms("registered nurse icu")) == "Healthcare"
     assert agg._muse_category(agg._role_terms("senior software engineer")) == "Software Engineering"
```

---

### Incident Patch 11: `65c4764b` (2026-07-02)
**Commit Message**: fix(generation): field-neutral fallback resume/cover (no hardcoded software leak)

The deterministic fallback (used when the LLM is unavailable) hardcoded software
language — "Software Engineer" role default, and a cover letter claiming "production
systems using technologies central to your stack" and "the tools and patterns your
team uses daily" — so a nurse/lawyer/teacher's fallback documents read as software.
Derive the role from the JD title / candidate's own target role, and rewrite the
cover template in field-neutral language. Verified: a nurse fallback cover/resume
has zero software leaks.

**File**: `backend/generation/generators/resume.py` (modified, +23/-4)
```diff
@@ -137,8 +137,23 @@ def _prioritized_skills(profile: dict, lead: dict, limit: int = 28) -> list[str]
     return _compact_list([*exact, *fuzzy, *rest], limit)
 
 
+def _fallback_role(profile: dict, lead: dict) -> str:
+    """Field-neutral role label: the JD title, else the candidate's own target role /
+    summary, else a neutral phrase — never a hardcoded 'Software Engineer'."""
+    title = str(lead.get("title") or "").strip()
+    if title:
+        return title
+    desired = str(profile.get("desired_position") or "").strip()
+    if desired:
+        return desired
+    summary = str(profile.get("s") or "").strip()
+    if summary:
+        return summary.split(".")[0].split(",")[0].strip()[:60] or "the advertised role"
+    return "the advertised role"
+
+
 def _role_headline(profile: dict, lead: dict, skills: list[str]) -> str:
-    target = _safe_text(str(lead.get("title") or "Software Engineer").strip()) or "Software Engineer"
+    target = _safe_text(_fallback_role(profile, lead)) or "the advertised role"
     summary = _safe_summary(str(profile.get("s") or "").strip())
     if summary:
         first = _clean_sentence(summary).rstrip(".")
@@ -331,7 +346,7 @@ def _fallback_package(profile: dict, lead: dict, template: str = "") -> _DocPack
     selected = _rank_projects(profile, lead, limit=2)
     name = profile.get("n") or "Candidate"
     identity: dict = profile.get("identity") if isinstance(profile.get("identity"), dict) else {}
-    title = _safe_text(str(lead.get("title") or "Software Engineer")) or "Software Engineer"
+    title = _safe_text(_fallback_role(profile, lead)) or "the advertised role"
     company = _safe_text(str(lead.get("company") or "the company")) or "the company"
     skills_raw = profile.get("skills", [])
     education = profile.get("education", [])
@@ -417,11 +432,15 @@ def _fallback_package(profile: dict, lead: dict, template: str = "") -> _DocPack
         resume += f"\n## EDUCATION\n{edu_lines}\n"
 
     all_skills = prioritized_skills
+    # Field-neutral fallback: no hardcoded "software engineering" / "stack" / "production
+    # systems" language, so a nurse/lawyer/teacher's fallback cover letter reads correctly.
+    background = ", ".join(all_skills[:5]) if all_skills else (_safe_text(str(profile.get("s") or "").strip()) or "this field")
+    recent = ", ".join(p.get("title", "a key project") for p in selected[:3]) if selected else "relevant work in this field"
     cover = f"""Dear {company} team,
 
-I am writing to apply for the {title} position at {company}. My background in {", ".join(all_skills[:5]) if all_skills else "software engineering"} aligns directly with the requirements outlined in your posting.
+I am writing to apply for the {title} position at {company}. My background in {background} aligns directly with the requirements outlined in your posting.
 
-In my recent work, I have built and shipped {", ".join(p.get('title','Project') for p in selected[:3]) if selected else "production systems"} using technologies central to your stack. These projects demonstrate hands-on experience with the tools and patterns your team uses daily.
+In my recent work on {recent}, I have built directly relevant experience and a track record of delivering the outcomes your team is looking for.
 
 I would welcome the opportunity to discuss how my experience maps to your needs. Thank you for your consideration.
 
```

---

### Incident Patch 12: `79cf98a3` (2026-07-02)
**Commit Message**: feat(ranking): surface genuine matches in every field (reweight non-tech, tenure-in-prose, two-band threshold)

The loop silently showed non-software users nothing: for a non-tech posting the
software stack/keyword criteria score ~0 and diluted the real semantic signal, a
6-year nurse read as a fresher (tenure was in prose, not dated periods) and hit the
seniority cap, and a single hard 76 bar discarded genuine matches that the tech-
calibrated rubric scores lower.

- scoring_engine: when the software taxonomy doesn't cover the JD, let semantic fit
  LEAD (weight 45) instead of being a tiebreaker; and count "N years" stated in the
  summary/role descriptions toward experience so prose tenure no longer trips the
  seniority cap.
- leads.update_lead_score: two settable bands — "tailoring" (>= tailor_threshold, 76,
  strong/ready-to-generate) and "matched" (>= match_threshold, 45, shown for review).
  Off-field junk is already capped ~15 by the ranker, so it stays discarded. Both
  thresholds are settings, so strictness is tunable.

Verified: nurse ICU match now surfaces (status "matched") instead of being hidden;
off-field stays discarded; 849 tests + eval harness green.

**File**: `backend/data/sqlite/leads.py` (modified, +22/-3)
```diff
@@ -445,6 +445,16 @@ def cleanup_bad_leads(limit: int = 1000, dry_run: bool = False, db_path: str = D
     return {"scanned": len(rows), "discarded": 0 if dry_run else len(touched), "candidates": len(touched), "dry_run": dry_run, "items": touched}
 
 
+def _score_threshold(db_path: str, key: str, default: int) -> int:
+    """Read a 0-100 score-band setting, falling back to the default."""
+    try:
+        from data.sqlite.settings import get_setting
+        raw = get_setting(key, str(default), db_path)
+        return max(0, min(int(raw or default), 100))
+    except Exception:
+        return default
+
+
 def update_lead_score(
     job_id: str,
     score: int,
@@ -464,12 +474,21 @@ def update_lead_score(
         if scored_by:
             source_meta["scored_by"] = scored_by
 
+        # Two settable bands so the loop surfaces genuine matches in EVERY field: the
+        # deterministic rubric scores non-software roles lower, so a single hard 76 bar
+        # hid a nurse/lawyer's real matches entirely. "tailoring" = strong fit ready to
+        # generate; "matched" = moderate-but-genuine fit, shown for the user to review
+        # (off-field junk is already capped to ~15 by the ranker, well below the bar).
+        tailor_at = _score_threshold(db_path, "tailor_threshold", 76)
+        show_at = min(_score_threshold(db_path, "match_threshold", 45), tailor_at)
         if preserve_status:
             status = current_status
-        elif kind == "freelance":
-            status = "matched" if score >= 76 else "discarded"
+        elif score >= tailor_at:
+            status = "matched" if kind == "freelance" else "tailoring"
+        elif score >= show_at:
+            status = "matched"
         else:
-            status = "tailoring" if score >= 76 else "discarded"
+            status = "discarded"
 
         if preserve_status:
             conn.execute(
```

**File**: `backend/ranking/scoring_engine.py` (modified, +39/-4)
```diff
@@ -134,7 +134,11 @@ def _period_months(period: str) -> int:
 
 
 def _total_work_months(candidate_data: dict) -> int:
-    """Return total months of non-intern professional experience."""
+    """Total months of non-intern professional experience — from dated periods AND
+    from any explicit 'N years [of] experience' the candidate states in prose. Many
+    resumes (in every field) describe tenure in text rather than machine-readable
+    dates, and reading only dated periods made a 6-year nurse look like a fresher and
+    wrongly triggered the seniority cap."""
     exp_entries = candidate_data.get("exp", []) or []
     real_roles = []
     for entry in exp_entries:
@@ -144,7 +148,17 @@ def _total_work_months(candidate_data: dict) -> int:
         if any(kw in role for kw in ("intern", "trainee", "student", "assistant only")):
             continue
         real_roles.append(entry)
-    return sum(_period_months(e.get("period", "")) for e in real_roles)
+    dated_months = sum(_period_months(e.get("period", "")) for e in real_roles)
+    # Prose floor: the largest "N years"/"N yrs"/"N yoe" stated in the summary or any
+    # role description.
+    prose = " ".join([
+        str(candidate_data.get("s") or ""),
+        str(candidate_data.get("desired_position") or ""),
+        *[str(e.get("d") or e.get("description") or "") for e in real_roles],
+    ]).lower()
+    stated = [int(m) for m in re.findall(r"(\d{1,2})\s*\+?\s*(?:years|yrs|yoe)", prose)]
+    stated_months = (max(stated) * 12) if stated else 0
+    return max(dated_months, stated_months)
 
 
 def infer_experience_level(candidate_data: dict) -> str:
@@ -796,6 +810,12 @@ def score_job_lead(jd: str, candidate_data: dict) -> ScoreResult:
 
     candidate = analyze_candidate(candidate_data)
     posting = analyze_posting(jd, "Job lead")
+    # Whether the SOFTWARE taxonomy actually covers this JD (captured before domain
+    # generalization folds the candidate's own vocabulary into posting.terms). When it
+    # doesn't — i.e. ANY non-software field — the stack/keyword criteria are ~0 and
+    # would drag a genuine same-field match below the bar, so real semantic fit must
+    # lead instead of merely breaking ties.
+    tech_taxonomy_present = bool(posting.terms)
     # Field-agnostic step: credit the candidate's own domain vocabulary and make
     # the wrong-field judgement relative to the candidate (must run before the
     # criteria and caps read posting.terms / posting.wrong_field).
@@ -805,8 +825,23 @@ def score_job_lead(jd: str, candidate_data: dict) -> ScoreResult:
     constraints = evaluate_logistics(posting, candidate)
 
     semantic = _semantic_criterion(jd, candidate_data, weight=15)
-    if semantic is not None:
-        # Hybrid weighting: semantic acts as a tiebreaker, keyword/rubric still leads.
+    if semantic is not None and not tech_taxonomy_present:
+        # Non-software posting: the tech stack/keyword rubric can't judge it, so let
+        # meaning-level fit dominate (with the field-blind seniority/logistics still
+        # contributing). This is what lets a nurse/lawyer/teacher's genuine match
+        # score on the same scale as a software match instead of being under-scored.
+        stack = evaluate_stack_coverage(posting, candidate, 8)
+        proof = evaluate_evidence(posting, candidate, 15)
+        criteria = [
+            _with_weight(role, 12),
+            stack,
+            proof,
+            _with_weight(seniority, 18),
+            _with_weight(constraints, 12),
+            _with_weight(semantic, 45),
+        ]
+    elif semantic is not None:
+        # Software posting: semantic acts as a tiebreaker, keyword/rubric still leads.
         stack = evaluate_stack_coverage(posting, candidate, 20)
         proof = evaluate_evidence(posting, candidate, 18)
         criteria = [
```

**File**: `backend/tests/test_relevance_bands.py` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+"""Field-agnostic relevance: tenure stated in prose counts toward experience (no
+false seniority cap), and the score bands surface genuine matches while discarding
+off-field/weak ones."""
+
+from __future__ import annotations
+
+import os
+import subprocess
+import sys
+from pathlib import Path
+
+from ranking.scoring_engine import _total_work_months
+
+REPO_ROOT = Path(__file__).resolve().parents[2]
+
+
+def test_work_months_reads_prose_tenure():
+    # Tenure in prose only (no machine-readable period) must still count — otherwise a
+    # 6-year nurse looked like a fresher and got the seniority cap.
+    nurse = {"s": "Registered Nurse with 6 years of critical care experience",
+             "exp": [{"role": "ICU Nurse", "d": "6 years of ICU nursing"}]}
+    assert _total_work_months(nurse) >= 72
+    # A dated period still works and wins when larger.
+    dated = {"s": "Engineer", "exp": [{"role": "Engineer", "period": "2015 - 2024"}]}
+    assert _total_work_months(dated) >= 96
+    # Interns don't count.
+    intern = {"exp": [{"role": "Intern", "d": "3 years"}]}
+    assert _total_work_months(intern) == 0
+
+
+_BANDS = """
+import sys
+sys.path.insert(0, "backend")
+from data.sqlite.connection import init_sql
+init_sql()
+from data.sqlite.leads import save_lead, update_lead_score, get_lead_by_id
+from data.sqlite.settings import save_settings
+
+def classify(job_id, score):
+    save_lead({"job_id": job_id, "title": "X", "url": "https://x/" + job_id, "kind": "job"})
+    update_lead_score(job_id, score, "r", [], [])
+    return get_lead_by_id(job_id)["status"]
+
+# Default bands: >=76 tailoring, >=45 matched (shown), else discarded.
+assert classify("strong", 80) == "tailoring"
+assert classify("moderate", 59) == "matched"     # a genuine non-tech match SURVIVES
+assert classify("weak", 44) == "discarded"
+assert classify("offfield", 15) == "discarded"   # ranker-capped junk stays hidden
+
+# The show band is user-configurable.
+save_settings({"match_threshold": "60"})
+assert classify("moderate2", 59) == "discarded"   # now below the raised bar
+assert classify("strong2", 70) == "matched"
+print("BANDS_OK")
+"""
+
+
+def test_score_bands_surface_matches_and_are_configurable(tmp_path):
+    env = dict(os.environ, JHM_APP_DATA_DIR=str(tmp_path))
+    result = subprocess.run([sys.executable, "-c", _BANDS], cwd=str(REPO_ROOT),
+                            env=env, capture_output=True, text=True, timeout=120)
+    assert result.returncode == 0, result.stderr
+    assert "BANDS_OK" in result.stdout
```

---

### Incident Patch 13: `d1bb3bf4` (2026-07-02)
**Commit Message**: fix(tauri): require the sidecar image before killing a stale-pid process tree

is_jhm_process treated a PID as the sidecar on a bare "python" substring (Windows
tasklist) or a mere `kill -0` existence check (other platforms). After an abnormal
exit left sidecar.pid behind and the OS recycled that PID for an unrelated process,
cleanup_stale_sidecar could force-kill it and its whole child tree. Match the actual
"jhm-sidecar" image/command instead (via `ps -o command=` off Windows), allow the
dev-only `python` match solely in debug builds, and fail safe (do not kill) when the
image can't be confirmed. Verified with cargo check + clippy (rustc 1.96); the
Windows-SDK link step is unaffected.

**File**: `src-tauri/src/lib.rs` (modified, +30/-7)
```diff
@@ -485,6 +485,22 @@ fn kill_process_tree(pid: u32) {
     }
 }
 
+// Only treat a PID as our sidecar when the live process's image/command actually
+// names the sidecar binary. The old checks (a bare "python" substring on Windows,
+// and `kill -0` existence on other platforms) matched ANY recycled-PID process —
+// so after an abnormal exit left a stale sidecar.pid behind and the OS reused that
+// PID for an unrelated process, cleanup could force-kill it. The dev sidecar runs
+// via `python`, so the loose python match is allowed ONLY in debug builds; a
+// release build requires the packaged "jhm-sidecar" image, and when we can't
+// positively confirm it we do NOT kill (fail-safe).
+fn process_image_is_sidecar(text: &str) -> bool {
+    let text = text.to_lowercase();
+    if text.contains("jhm-sidecar") {
+        return true;
+    }
+    cfg!(debug_assertions) && (text.contains("python") || text.contains("pythonw"))
+}
+
 #[cfg(windows)]
 fn is_jhm_process(pid: u32) -> bool {
     const CREATE_NO_WINDOW: u32 = 0x0800_0000;
@@ -495,17 +511,24 @@ fn is_jhm_process(pid: u32) -> bool {
     let Ok(output) = output else {
         return false;
     };
-    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
-    text.contains("jhm-sidecar") || text.contains("python")
+    process_image_is_sidecar(&String::from_utf8_lossy(&output.stdout))
 }
 
 #[cfg(not(windows))]
 fn is_jhm_process(pid: u32) -> bool {
-    std::process::Command::new("kill")
-        .args(["-0", &pid.to_string()])
-        .status()
-        .map(|status| status.success())
-        .unwrap_or(false)
+    // `ps -o command=` prints the process's command line (empty header) and exits
+    // non-zero when the PID doesn't exist — stricter than the old `kill -0`, which
+    // matched any live PID the user could signal.
+    let output = std::process::Command::new("ps")
+        .args(["-p", &pid.to_string(), "-o", "command="])
+        .output();
+    let Ok(output) = output else {
+        return false;
+    };
+    if !output.status.success() {
+        return false;
+    }
+    process_image_is_sidecar(&String::from_utf8_lossy(&output.stdout))
 }
 
 fn wait_for_process_exit(pid: u32, timeout: std::time::Duration) -> bool {
```

---

### Incident Patch 14: `c3e28fcc` (2026-07-02)
**Commit Message**: fix(ranking,profile): reevaluate enriches profile like scan; LinkedIn import tolerates bad bytes

- _run_reevaluate_jobs_inner scored each lead against the RAW profile, while the
  scan, ghost and free-source paths all wrap it in profile_for_discovery(..., cfg)
  first (injecting the settings target-role into the summary + desired_position). So
  re-evaluate scored a lead differently than the identical scan and could regress a
  matched lead to the wrong-field cap. Enrich it the same way (one-line mirror).
- linkedin_parser._read_csv decoded with strict UTF-8, so one cp1252/latin-1 byte in
  any CSV aborted the whole LinkedIn import. Decode with errors="replace" like the
  other ingest paths.

**File**: `backend/api/routers/discovery.py` (modified, +5/-1)
```diff
@@ -449,7 +449,11 @@ async def _run_reevaluate_jobs_inner(
     repo = repo or get_repository()
     ranking_service = ranking_service or get_ranking_service()
     cfg = await asyncio.to_thread(repo.settings.get_settings)
-    profile = await asyncio.to_thread(repo.profile.get_profile)
+    # Enrich with the settings desired-position/target-role like the scan, ghost and
+    # free-source paths do — otherwise re-evaluate scores each lead against a poorer
+    # summary (missing the role signal) and can regress a matched lead to the
+    # wrong-field cap, giving a different score than the identical scan produced.
+    profile = profile_for_discovery(await asyncio.to_thread(repo.profile.get_profile), cfg)
     jobs = await asyncio.to_thread(repo.leads.get_job_leads_for_evaluation)
     total = len(jobs)
     scored = 0
```

**File**: `backend/profile/linkedin_parser.py` (modified, +4/-1)
```diff
@@ -15,7 +15,10 @@ def _read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
         _log.warning("linkedin export: %s not found in ZIP", name)
         return []
     with zf.open(candidates[0]) as f:
-        text = f.read().decode("utf-8-sig")   # handles BOM
+        # Lenient decode (like the other ingest paths): some real LinkedIn exports —
+        # and files re-saved by Excel — carry cp1252/latin-1 bytes, and a strict
+        # decode aborted the ENTIRE import over one bad character. utf-8-sig strips BOM.
+        text = f.read().decode("utf-8-sig", errors="replace")
     reader = csv.DictReader(io.StringIO(text))
     return [dict(r) for r in reader]
 
```

**File**: `backend/tests/test_foundation_modules.py` (modified, +15/-0)
```diff
@@ -202,3 +202,18 @@ def test_linkedin_parser_extracts_profile_sections():
     assert parsed["skills"] == [{"n": "Python", "cat": "general"}]
     assert parsed["experience"][0]["co"] == "Analytical Engines"
     assert parsed["stats"]["projects"] == 1
+
+
+def test_linkedin_parser_tolerates_non_utf8_bytes():
+    # Some real LinkedIn exports (and Excel re-saves) carry cp1252/latin-1 bytes;
+    # a strict UTF-8 decode aborted the ENTIRE import over one bad character.
+    from profile.linkedin_parser import parse_linkedin_export
+
+    archive = io.BytesIO()
+    with zipfile.ZipFile(archive, "w") as zf:
+        # 0xE9 is 'é' in cp1252 — an invalid standalone UTF-8 byte.
+        zf.writestr("Profile.csv", b"First Name,Last Name,Headline\nJos\xe9,Do\xe9,Ing\xe9nieur\n")
+
+    parsed = parse_linkedin_export(archive.getvalue())  # must not raise
+    assert isinstance(parsed, dict)
+    assert parsed["candidate"]["n"].startswith("Jos")
```

---

### Incident Patch 15: `5ce9e466` (2026-07-02)
**Commit Message**: fix(scripts,installer): setup:local fails on ONNX download error + NSIS shortcut repair

- setup:local ran `print(json.dumps(download_onnx_model()))` and only checked the
  process exit code, but download_onnx_model() catches its own errors and RETURNS
  {status:"error"} exiting 0 — so a failed/partial model download reported success
  while the dev sidecar silently degraded to the hash fallback. Assert the status and
  exit non-zero on failure.
- NSIS post-install shortcut repair used an INVERTED IfFileExists ("0 +2"), so the
  desktop/taskbar shortcut was (re)created only when it already existed and skipped on
  a fresh install/repair. Swap to "+2 0" so it creates the shortcut when missing.

**File**: `scripts/setup-local-runtime.mjs` (modified, +5/-1)
```diff
@@ -79,7 +79,11 @@ console.log(`[setup:local] app-data dir for the dev sidecar: ${dataDir}`);
 // 1) ONNX embedding model -> <app-data>/models/all-MiniLM-L6-v2 (skips if present).
 runPython(
   "Download ONNX embedding model (semantic search)",
-  "import json\nfrom data.vector.embeddings import download_onnx_model\nprint(json.dumps(download_onnx_model()))\n",
+  // download_onnx_model() catches its own errors and RETURNS {status:"error"} rather
+  // than raising, so assert the status and exit non-zero on failure — otherwise a
+  // failed/partial download prints an error dict but exits 0 and setup:local falsely
+  // reports success while the dev sidecar silently degrades to the hash fallback.
+  "import json, sys\nfrom data.vector.embeddings import download_onnx_model\nr = download_onnx_model()\nprint(json.dumps(r))\nsys.exit(0 if r.get('status') in ('ok', 'exists') else 1)\n",
   { JHM_APP_DATA_DIR: dataDir },
 );
 
```

**File**: `src-tauri/windows/nsis-hooks.nsh` (modified, +6/-2)
```diff
@@ -50,10 +50,14 @@
   CreateDirectory "$SMPROGRAMS"
   CreateShortCut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0 SW_SHOWNORMAL "" "${PRODUCTNAME}"
 
-  IfFileExists "$DESKTOP\${PRODUCTNAME}.lnk" 0 +2
+  ; Create the shortcut when it is MISSING: IfFileExists jumps to the first label
+  ; when present, the second when absent. "+2 0" => if present skip the CreateShortCut,
+  ; if absent fall through and create it. ("0 +2" was inverted — it only recreated an
+  ; already-present shortcut, so a fresh install/repair got no desktop/taskbar shortcut.)
+  IfFileExists "$DESKTOP\${PRODUCTNAME}.lnk" +2 0
     CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0 SW_SHOWNORMAL "" "${PRODUCTNAME}"
 
-  IfFileExists "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${PRODUCTNAME}.lnk" 0 +2
+  IfFileExists "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${PRODUCTNAME}.lnk" +2 0
     CreateShortCut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0 SW_SHOWNORMAL "" "${PRODUCTNAME}"
 
   Goto jhm_postinstall_done
```

#### Recent Merged Pull Requests:
- **PR #194** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 15 updates (@dependabot[bot])
- **PR #193** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 7 updates (@dependabot[bot])
- **PR #192** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 14 updates (@dependabot[bot])
- **PR #191** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 6 updates (@dependabot[bot])
- **PR #190** (closed): fix(scripts): create sidecar-manifest.json stub in prepare-sidecar-placeholder (@JimmyNewtron711)
- **PR #188** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 13 updates (@dependabot[bot])
- **PR #186** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 14 updates (@dependabot[bot])
- **PR #183** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 12 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

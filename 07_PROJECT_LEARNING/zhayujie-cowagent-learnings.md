# Forensic Learning Record (Deep Inspection): zhayujie/CowAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhayujie-cowagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhayujie/CowAgent](https://github.com/zhayujie/CowAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:00:56.564Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zhayujie/CowAgent`
- **Description**: Open-source personal AI assistant & Agent Harness. Plans tasks, runs tools and skills, self-evolves with memory and knowledge. Multi-agent, multi-model, multi-channel. Lightweight, extensible, one-line install.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 47228 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/memory/embedding/state.py`
```
"""
Embedding-related index utilities.

We don't keep a sidecar state file — the SQLite index is the source of truth
and config.json is the source of intent. The two functions below are the
only things needing on-disk awareness:

  detect_index_dim         : read the dim of stored vectors (display-only)
  detect_chunker_version   : read the chunker version that produced the index
  cleanup_legacy_state_file: remove old embedding_state.json from earlier
                             versions; safe no-op when absent.
"""

from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Optional, Union

PathLike = Union[str, os.PathLike]


def detect_index_dim(storage) -> Optional[int]:
    """Return the dim of the first stored embedding, or None if the index
    has no embeddings. Used by /memory status."""
    try:
        row = storage.conn.execute(
            "SELECT embedding FROM chunks WHERE embedding IS NOT NULL LIMIT 1"
        ).fetchone()
    except Exception:
        return None
    if not row or not row["embedding"]:
        return None
    try:
        raw = row["embedding"]
        if isinstance(raw, (bytes, bytearray)):
            # New BLOB format: 4 bytes per float32
            return len(raw) // 4
        emb = json.loads(raw)
        return len(emb) if isinstance(emb, list) else None
    except (json.JSONDecodeError, TypeError, Exception):
        return None


def detect_chunker_version(storage) -> Optional[int]:
    """Return the chunker version recorded for the index, or None when the
    index carries no record at all.

    `None` means the index predates chunker-version tracking (or was built by
    an unknown strategy), i.e. its chunk boundaries may not match the current
    algorithm — /memory status uses this to suggest a rebuild. Chunked files
    are only re-split when their content hash changes, so a chunker change
    alone would otherwise never refresh existing boundaries.
    """
    try:
        raw = storage.get_meta("chunker_version")
    except Exception:
        return None
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def cleanup_legacy_state_file(db_path: PathLike) -> None:
    """Remove old embedding_state.json files from earlier versions.
    Safe to call repeatedly; no-op if the file is absent."""
    legacy = Path(db_path).parent / "embedding_state.json"
    try:
        legacy.unlink(missing_ok=True)
    except Exception:
        pass

```

### Core Architecture Module: `agent/protocol/message_utils.py`
```
"""
Message sanitizer — fix broken tool_use / tool_result pairs.

Provides two public helpers that can be reused across agent_stream.py
and any bot that converts messages to OpenAI format:

1. sanitize_claude_messages(messages)
   Operates on the internal Claude-format message list (in-place).

2. drop_orphaned_tool_results_openai(messages)
   Operates on an already-converted OpenAI-format message list,
   returning a cleaned copy.
"""

from __future__ import annotations

from typing import Dict, List, Set

from common.log import logger

_SYNTH_TOOL_ERR = (
    "Error: Missing tool_result adjacent to tool_use (session repair). "
    "The conversation history was inconsistent; continue from here."
)


def _repair_tool_use_adjacency(messages: List[Dict]) -> int:
    """
    Anthropic requires: after assistant content with tool_use, the next message
    must be user content listing tool_result for every tool_use id (same user msg).

    Valid histories satisfy this at every such assistant; the loop only mutates
    when that condition fails (broken persistence, bad trims, etc.).
    """

    def _synth_block(tid: str) -> Dict:
        return {
            "type": "tool_result",
            "tool_use_id": tid,
            "content": _SYNTH_TOOL_ERR,
            "is_error": True,
        }

    repairs = 0
    i = 0
    while i < len(messages):
        msg = messages[i]
        if msg.get("role") != "assistant":
            i += 1
            continue

        content = msg.get("content", [])
        if not isinstance(content, list):
            i += 1
            continue

        required = [
            b.get("id")
            for b in content
            if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("id")
        ]
        if not required:
            i += 1
            continue

        req_set = set(required)
        if i + 1 >= len(messages):
            messages.append({
                "role": "user",
                "content": [_synth_block(tid) for tid in required],
            })
            logger.warning(
                "⚠️ Appended synthetic tool_result after trailing assistant tool_use"
            )
            repairs += 1
            break

        nxt = messages[i + 1]
        if nxt.get("role") != "user":
            messages.insert(
                i + 1,
                {"role": "user", "content": [_synth_block(tid) for tid in required]},
            )
            logger.warning(
                "⚠️ Inserted synthetic tool_result user after tool_use "
                f"(next role={nxt.get('role')!r})"
            )
            repairs += 1
            i += 2
            continue

        nc = nxt.get("content", [])
        if not isinstance(nc, list):
            messages.insert(
                i + 1,
                {"role": "user", "content": [_synth_block(tid) for tid in required]},
            )
            repairs += 1
            i += 2
            continue

        present = {
            b.get("tool_use_id")
            for b in nc
            if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("tool_use_id")
        }
        if req_set <= present:
            i += 1
            continue

        missing = [tid for tid in required if tid not in present]
        nxt["content"] = [_synth_block(tid) for tid in missing] + nc
        logger.warning(
            "⚠️ Prepended synthetic tool_result for Anthropic adjacency "
            f"(missing_ids={missing})"
        )
        repairs += len(missing)
        i += 1

    return repairs


# ------------------------------------------------------------------ #
# Claude-format sanitizer (used by agent_stream)
# ------------------------------------------------------------------ #

def sanitize_claude_messages(messages: List[Dict]) -> int:
    """
    Validate and fix a Claude-format message list **in-place**.

    Fixes handled:
    - Anthropic adjacency: assistant tool_use must be immediately followed by
      user message(s) containing matching tool_result blocks
    - Leading orphaned tool_result user messages
    - Mid-list tool_result blocks whose tool_use_id has no matching
      tool_use in any preceding assistant message

    Returns: number of removals plus adjacency repair operations (inserts/prepends).
    """
    if not messages:
        return 0

    removed = 0

    # 1. Adjacency repair (Anthropic: tool_result must be in the next user message)
    adj_repairs = _repair_tool_use_adjacency(messages)

    # 2. Remove leading orphaned tool_result user messages
    while messages:
        first = messages[0]
        if first.get("role") != "user":
            break
        content = first.get("content", [])
        if isinstance(content, list) and _has_block_type(content, "tool_result") \
                and not _has_block_type(content, "text"):
            logger.warning("⚠️ Removing leading orphaned tool_result user message")
            messages.pop(0)
            removed += 1
        else:
            break

    # 3. Iteratively remove unmatched tool_use / tool_result until stable.
    #    Removing one broken message can orphan others (e.g. an assistant msg
    #    with both matched and unmatched tool_use — deleting it orphans the
    #    previously-matched tool_result).  Loop until clean.
    for _ in range(5):
        use_ids: Set[str] = set()
        result_ids: Set[str] = set()
        for msg in messages:
            for block in (msg.get("content") or []):
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "tool_use" and block.get("id"):
                    use_ids.add(block["id"])
                elif block.get("type") == "tool_result" and block.get("tool_use_id"):
                    result_ids.add(block["tool_use_id"])

        bad_use = use_ids - result_ids
        bad_result = result_ids - use_ids
        if not bad_use and not bad_result:
            break

        pass_removed = 0
        i = 0
        while i < len(messages):
            msg = messages[i]
            role = msg.get("role")
            content = msg.get("content", [])
            if not isinstance(content, list):
                i += 1
                continue

            if role == "assistant" and bad_use and any(
                isinstance(b, dict) and b.get("type") == "tool_use"
                and b.get("id") in bad_use for b in content
            ):
                logger.warning(f"⚠️ Removing assistant msg with unmatched tool_use")
                messages.pop(i)
                pass_removed += 1
                continue

            if role == "user" and bad_result and _has_block_type(content, "tool_result"):
                has_bad = any(
                    isinstance(b, dict) and b.get("type") == "tool_result"
                    and b.get("tool_use_id") in bad_result for b in content
                )
                if has_bad:
                    if not _has_block_type(content, "text"):
                        logger.warning(f"⚠️ Removing user msg with unmatched tool_result")
                        messages.pop(i)
                        pass_removed += 1
                        continue
                    else:
                        before = len(content)
                        msg["content"] = [
                            b for b in content
                            if not (isinstance(b, dict) and b.get("type") == "tool_result"
                                    and b.get("tool_use_id") in bad_result)
                        ]
                        pass_removed += before - len(msg["content"])

            i += 1

        removed += pass_removed
        if pass_removed == 0:
            break

    # 4. Removals above can break adjacency; re-run repair only if something was removed.
    if removed:
        adj_repairs += _repair_tool_use_adjacency(messages)

    if removed:
        logger.info(f"🔧 Message validation: removed {removed} broken message(s)")
    if adj_repairs:
        logger.info(f"🔧 Message validation: adjacency repairs={adj_repairs}")
    return removed + adj_repairs


# ------------------------------------------------------------------ #
# OpenAI-format sanitizer (used by minimax_bot, openai_compatible_bot)
# ------------------------------------------------------------------ #

def drop_orphaned_tool_results_openai(messages: List[Dict]) -> List[Dict]:
    """
    Return a copy of *messages* (OpenAI format) with any ``role=tool``
    messages removed if their ``tool_call_id`` does not match a
    ``tool_calls[].id`` in a preceding assistant message.
    """
    known_ids: Set[str] = set()
    cleaned: List[Dict] = []
    for msg in messages:
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                tc_id = tc.get("id", "")
                if tc_id:
                    known_ids.add(tc_id)

        if msg.get("role") == "tool":
            ref_id = msg.get("tool_call_id", "")
            if ref_id and ref_id not in known_ids:
                logger.warning(
                    f"[MessageSanitizer] Dropping orphaned tool result "
                    f"(tool_call_id={ref_id} not in known ids)"
                )
                continue
        cleaned.append(msg)
    return cleaned


# ------------------------------------------------------------------ #
# Internal helpers
# ------------------------------------------------------------------ #

def _has_block_type(content: list, block_type: str) -> bool:
    return any(
        isinstance(b, dict) and b.get("type") == block_type
        for b in content
    )


def _extract_text_from_content(content) -> str:
    """Extract plain text from a message content field (str or list of blocks)."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [
            b.get("text", "")
            for b in content
            if isinstance(b, d
```

### Core Architecture Module: `agent/tools/scheduler/time_utils.py`
```
"""Time helpers for scheduler persistence and recurrence.

Tasks that explicitly declare an IANA timezone use timezone-aware UTC
timestamps, and their cron recurrences are evaluated with full DST rules.
Tasks without a declared timezone intentionally keep the scheduler's legacy
naive local-time behaviour so existing stored tasks are not reinterpreted.
"""
from croniter import croniter
from datetime import datetime, timedelta, timezone

# zoneinfo joined the standard library in Python 3.9. Without it, only named
# IANA timezones are unavailable; legacy naive-local tasks keep working.
try:
    from zoneinfo import ZoneInfo
except ImportError:
    try:
        from backports.zoneinfo import ZoneInfo
    except ImportError:
        ZoneInfo = None

UTC = timezone.utc

# Fields whose persisted values are scheduling instants. Other metadata such
# as created_at/updated_at is not needed by the comparison path and is left
# alone for compatibility with external editors.
SCHEDULE_TIMESTAMP_FIELDS = (
    "next_run_at",
    "last_run_at",
    "last_error_at",
    "last_manual_run_at",
)


def utc_now() -> datetime:
    """Return the current instant in UTC."""
    return datetime.now(UTC)


def resolve_timezone(name=None):
    """Resolve an optional IANA name, defaulting to the server-local zone.

    Prefer :func:`task_timezone` for scheduler tasks.  Scheduler tasks use a
    ``None`` return value as an explicit signal that they must stay on the
    legacy naive-local code path.
    """
    if name is None:
        return datetime.now().astimezone().tzinfo
    if not isinstance(name, str) or not name.strip():
        raise ValueError("timezone must be a non-empty IANA name")
    if ZoneInfo is None:
        raise ValueError(
            "IANA timezones require Python 3.9+ or the backports.zoneinfo package"
        )
    return ZoneInfo(name.strip())


def task_timezone(task: dict):
    """Return the IANA zone declared by a task, or ``None`` for legacy mode.

    A stored schedule that is not a mapping (null, a string) declares no zone.
    """
    schedule = task.get("schedule")
    if not isinstance(schedule, dict):
        return None
    name = schedule.get("timezone")
    return resolve_timezone(name) if name else None


def _parse_iso(value: str) -> datetime:
    """Parse an ISO timestamp and normalize a trailing ``Z`` suffix."""
    if not isinstance(value, str):
        raise TypeError("timestamp must be an ISO string")

    # datetime.fromisoformat accepts "Z" from Python 3.11; normalize it here
    # so the scheduler keeps working on the versions supported by the project.
    if value.endswith(("Z", "z")):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def parse_utc(value: str, default_zone=None) -> datetime:
    """Parse a timestamp used by an IANA-timezone task as aware UTC."""
    dt = _parse_iso(value)
    if dt.tzinfo is None:
        if default_zone is None:
            raise ValueError("a timezone is required for a naive timestamp")
        dt = dt.replace(tzinfo=default_zone)
    return dt.astimezone(UTC)


def parse_scheduled_time(value: str, zone=None) -> datetime:
    """Parse a task timestamp in either UTC-aware or legacy-naive mode.

    With an explicit IANA zone, naive values are interpreted in that zone and
    the result is normalized to UTC.  Without one, naive values remain naive;
    an already-aware value is compared as the equivalent local wall clock.
    """
    dt = _parse_iso(value)
    if zone is not None:
        return parse_utc(value, zone)
    if dt.tzinfo is not None:
        return dt.astimezone().replace(tzinfo=None)
    return dt


def format_scheduled_time(value: datetime) -> str:
    """Serialize a UTC-aware instant or a legacy naive local timestamp."""
    if value.tzinfo is None:
        return value.isoformat()
    return value.astimezone(UTC).isoformat()


def format_utc(value: datetime) -> str:
    """Format an aware datetime as an aware UTC ISO string."""
    return value.astimezone(UTC).isoformat()


def normalize_task_timestamps(task: dict) -> dict:
    """Normalize scheduling fields in a task copy for scheduler reads.

    Explicit-IANA-zone tasks use aware UTC strings.  Legacy tasks are returned
    unchanged on upgrade: interpreting their naive timestamps with a fixed
    local offset would change their meaning across DST transitions.
    """
    zone = task_timezone(task)
    if zone is None:
        return dict(task)

    normalized = dict(task)
    for field in SCHEDULE_TIMESTAMP_FIELDS:
        value = normalized.get(field)
        if isinstance(value, str):
            normalized[field] = format_utc(parse_utc(value, zone))
    return normalized


def scheduled_reference_time(task: dict, value: datetime) -> datetime:
    """Coerce a current/reference time to the task's comparison mode."""
    if task_timezone(task) is not None:
        # A naive server-local reference is sufficient for computing "now";
        # astimezone() attaches the local offset before converting to UTC.
        return value.astimezone(UTC)
    if value.tzinfo is not None:
        return value.astimezone().replace(tzinfo=None)
    return value


def _localize_wall_time(naive_dt: datetime, zone) -> datetime:
    """Attach a zone to a local wall clock with explicit DST policies.

    Fall-back times use the first occurrence (``fold=0``), so a daily task does
    not run twice. Spring-forward gaps advance minute by minute to the next
    real local time. Aware croniter input can otherwise manufacture an offset
    for a wall time that never exists.
    """
    candidate = naive_dt.replace(tzinfo=zone)
    instant = candidate.astimezone(UTC)
    if instant.astimezone(zone).replace(tzinfo=None) == naive_dt:
        return instant

    for _ in range(120):  # enough for the largest civil-time gap
        naive_dt += timedelta(minutes=1)
        candidate = naive_dt.replace(tzinfo=zone)
        instant = candidate.astimezone(UTC)
        if instant.astimezone(zone).replace(tzinfo=None) == naive_dt:
            return instant
    raise ValueError("could not resolve local time across a DST transition")


def next_cron_occurrence(expression: str, after: datetime, zone=None) -> datetime:
    """Evaluate cron wall-clock recurrence in the task's scheduling mode."""
    if zone is None:
        if after.tzinfo is not None:
            after = after.astimezone().replace(tzinfo=None)
        return croniter(expression, after).get_next(datetime)

    after_utc = after.astimezone(UTC) if after.tzinfo is not None else after
    local_after = after_utc.astimezone(zone).replace(tzinfo=None)
    occurrences = croniter(expression, local_after)
    while True:
        local_next = occurrences.get_next(datetime)
        instant = _localize_wall_time(local_next, zone).astimezone(UTC)
        if instant > after_utc:
            return instant
        # First-fold occurrences may already be past while the local clock
        # is repeating. Advance the iterator rather than restarting it: a
        # single retry can return the same daily occurrence or another past
        # minute, leaving the task immediately due again.


def display_local(value: str, zone=None) -> datetime:
    """Convert a persisted scheduling timestamp for display.

    Explicit-IANA-zone tasks are displayed in that zone.  Legacy tasks show
    their stored wall clock directly; an aware legacy value is displayed in the
    viewer's local zone because it already identifies a concrete instant.
    """
    dt = parse_scheduled_time(value, zone)
    if dt.tzinfo is None:
        return dt
    if zone is not None:
        return dt.astimezone(zone)
    return dt.astimezone()

```

### Core Architecture Module: `agent/tools/utils/__init__.py`
```
from .truncate import (
    truncate_head,
    truncate_tail,
    truncate_line,
    format_size,
    TruncationResult,
    DEFAULT_MAX_LINES,
    DEFAULT_MAX_BYTES,
    GREP_MAX_LINE_LENGTH
)

from .diff import (
    strip_bom,
    detect_line_ending,
    normalize_to_lf,
    restore_line_endings,
    normalize_for_fuzzy_match,
    count_matches,
    find_match_spans,
    fuzzy_find_text,
    generate_diff_string,
    looks_like_line_numbered_block,
    reindent_replacement,
    strip_line_number_prefixes,
    FuzzyMatchResult
)

from .url_safety import (
    validate_url_safe,
    assert_public_ip
)

__all__ = [
    'truncate_head',
    'truncate_tail',
    'truncate_line',
    'format_size',
    'TruncationResult',
    'DEFAULT_MAX_LINES',
    'DEFAULT_MAX_BYTES',
    'GREP_MAX_LINE_LENGTH',
    'strip_bom',
    'detect_line_ending',
    'normalize_to_lf',
    'restore_line_endings',
    'normalize_for_fuzzy_match',
    'count_matches',
    'find_match_spans',
    'fuzzy_find_text',
    'generate_diff_string',
    'looks_like_line_numbered_block',
    'reindent_replacement',
    'strip_line_number_prefixes',
    'FuzzyMatchResult',
    'validate_url_safe',
    'assert_public_ip'
]

```

### Core Architecture Module: `agent/tools/utils/credentials.py`
```
"""
Shared credential-path guard for file tools.

The agent's API keys live in ~/.cow/.env and must only ever be reached through
the env_config tool. Every tool that can surface file contents to the model has
to apply the same check - guarding only the read tool leaves the others as
bypasses (a successful edit, for example, returns a diff containing the
surrounding lines).

Scope is deliberately narrow (the credential file and its process-environment
aliases) so this does not re-broaden the block that issue #2863 intentionally
narrowed to ~/.cow/.env. See also issue #2913 for the bypasses handled here.
"""

import os
import re

from common.utils import expand_path

# Paths whose CONTENT mirrors the process environment (and thus any secrets
# loaded from ~/.cow/.env). Reading them bypasses the env_config boundary.
# Matches /proc/self/environ, /proc/thread-self/environ and /proc/<pid>/environ.
_PROC_ENVIRON_RE = re.compile(r"^/proc/(\d+|self|thread-self)/environ$")

DENIED_MESSAGE = (
    "Error: Access denied. API keys and credentials must be accessed "
    "through the env_config tool only."
)


def is_credential_path(absolute_path: str) -> bool:
    """Return True if *absolute_path* points at protected credential data.

    Beyond the literal ~/.cow/.env file, this also blocks two real bypass
    surfaces reported in issue #2913:
      1. /proc/<pid|self|thread-self>/environ - a second view of the
         process environment that leaks secrets loaded from ~/.cow/.env.
      2. Symlinks resolving to ~/.cow/.env; an exact abspath match keeps the
         link target and can be bypassed.
    """
    # Compare on both the normalized path and the symlink-resolved path,
    # in POSIX form so the /proc regex matches regardless of os.sep.
    candidates = set()
    try:
        candidates.add(os.path.normpath(absolute_path).replace(os.sep, "/"))
        candidates.add(os.path.realpath(absolute_path).replace(os.sep, "/"))
    except OSError:
        candidates.add(absolute_path.replace(os.sep, "/"))

    # 1. /proc environ aliases (checked on raw and symlink-resolved forms).
    for candidate in candidates:
        if _PROC_ENVIRON_RE.match(candidate):
            return True

    # 2. The credential file itself, following symlinks on both sides.
    env_real = os.path.realpath(expand_path("~/.cow/.env")).replace(os.sep, "/")
    return env_real in candidates

```

### Core Architecture Module: `agent/tools/utils/diff.py`
```
"""
Diff tools for file editing
Provides fuzzy matching and diff generation functionality
"""

import difflib
import re
from typing import Optional, Tuple


def strip_bom(text: str) -> Tuple[str, str]:
    """
    Remove BOM (Byte Order Mark)
    
    :param text: Original text
    :return: (BOM, text after removing BOM)
    """
    if text.startswith('\ufeff'):
        return '\ufeff', text[1:]
    return '', text


def detect_line_ending(text: str) -> str:
    """
    Detect line ending type
    
    :param text: Text content
    :return: Line ending type ('\r\n' or '\n')
    """
    if '\r\n' in text:
        return '\r\n'
    return '\n'


def normalize_to_lf(text: str) -> str:
    """
    Normalize all line endings to LF (\n)
    
    :param text: Original text
    :return: Normalized text
    """
    return text.replace('\r\n', '\n').replace('\r', '\n')


def restore_line_endings(text: str, original_ending: str) -> str:
    """
    Restore original line endings
    
    :param text: LF normalized text
    :param original_ending: Original line ending
    :return: Text with restored line endings
    """
    if original_ending == '\r\n':
        return text.replace('\n', '\r\n')
    return text


def normalize_for_fuzzy_match(text: str) -> str:
    """
    Normalize text for fuzzy matching
    Remove excess whitespace but preserve basic structure
    
    :param text: Original text
    :return: Normalized text
    """
    # Compress multiple spaces to one
    text = re.sub(r'[ \t]+', ' ', text)
    # Remove trailing spaces
    text = re.sub(r' +\n', '\n', text)
    # Remove leading spaces (but preserve indentation structure, only remove excess)
    lines = text.split('\n')
    normalized_lines = []
    for line in lines:
        # Preserve indentation but normalize to multiples of single spaces
        stripped = line.lstrip()
        if stripped:
            indent_count = len(line) - len(stripped)
            # Normalize indentation (convert tabs to spaces)
            normalized_indent = ' ' * indent_count
            normalized_lines.append(normalized_indent + stripped)
        else:
            normalized_lines.append('')
    return '\n'.join(normalized_lines)


class FuzzyMatchResult:
    """Fuzzy match result"""

    def __init__(self, found: bool, index: int = -1, match_length: int = 0,
                 content_for_replacement: str = "", exact: bool = False):
        self.found = found
        self.index = index
        self.match_length = match_length
        self.content_for_replacement = content_for_replacement
        # False when the whitespace-flexible pattern was needed. The caller must
        # then re-anchor the replacement's indentation (see reindent_replacement).
        self.exact = exact


def _build_fuzzy_pattern(old_text: str) -> Optional[str]:
    """
    Build the whitespace-flexible regex used to locate ``old_text`` fuzzily.

    Returns ``None`` when ``old_text`` has no non-whitespace content to match.
    This is the single source of truth for fuzzy matching, so that *finding* a
    match (:func:`fuzzy_find_text`) and *counting* occurrences
    (:func:`count_matches`) always use the exact same rules.
    """
    stripped = old_text.strip('\n')
    if not stripped.strip():
        return None

    source_lines = stripped.split('\n')
    line_patterns = []
    for i, line in enumerate(source_lines):
        tokens = line.split()
        if not tokens:
            line_patterns.append(r'[ \t]*')
            continue
        # Tolerate any run of blanks between tokens.
        core = r'[ \t]+'.join(re.escape(tok) for tok in tokens)
        # First-line leading whitespace is folded into the match only when
        # old_text itself was indented here; otherwise it stays OUTSIDE the
        # match so a no-indent old_text preserves (does not swallow and drop)
        # the file's existing indentation -- mirroring an exact substring
        # match. Inner lines always tolerate indentation: it sits inside the
        # matched region and is re-supplied by new_text.
        if i > 0 or line[:1] in (' ', '\t'):
            core = r'[ \t]*' + core
        line_patterns.append(core + r'[ \t]*')
    return '\n'.join(line_patterns)


def find_match_spans(content: str, old_text: str) -> Tuple[list, bool]:
    """
    Locate every non-overlapping occurrence of ``old_text`` in ``content``.

    Exact substring matching is preferred; only when it finds nothing do we fall
    back to the whitespace-flexible pattern. Finding, counting and replacing all
    go through this one function so the uniqueness guard can never disagree with
    what actually gets replaced.

    :return: (list of (start, end) offsets into ``content``, whether exact)
    """
    if not old_text:
        return [], True

    if content.find(old_text) != -1:
        spans = []
        start = 0
        while True:
            index = content.find(old_text, start)
            if index == -1:
                break
            spans.append((index, index + len(old_text)))
            start = index + len(old_text)
        return spans, True

    # The exact substring was not found, most likely because the whitespace
    # differs (indentation, spaces around operators, trailing spaces). Locate
    # the region in the ORIGINAL content using a whitespace-flexible pattern
    # and return offsets into that original content.
    #
    # This must NOT replace inside a whitespace-normalized copy of the file:
    # doing so previously returned the normalized copy as the replacement base,
    # which rewrote the whole file with collapsed indentation.
    pattern = _build_fuzzy_pattern(old_text)
    if pattern is None:
        return [], False
    return [(m.start(), m.end()) for m in re.finditer(pattern, content)], False


def fuzzy_find_text(content: str, old_text: str) -> FuzzyMatchResult:
    """Find the first occurrence of ``old_text``; exact match preferred."""
    spans, exact = find_match_spans(content, old_text)
    if not spans:
        return FuzzyMatchResult(found=False)
    start, end = spans[0]
    return FuzzyMatchResult(
        found=True,
        index=start,
        match_length=end - start,
        content_for_replacement=content,
        exact=exact,
    )


def count_matches(content: str, old_text: str) -> int:
    """Count occurrences using the same strategy as :func:`find_match_spans`."""
    return len(find_match_spans(content, old_text)[0])


def reindent_replacement(matched_text: str, old_text: str, new_text: str) -> str:
    """
    Re-anchor ``new_text``'s indentation to the indentation actually in the file.

    The fuzzy pattern tolerates differing indentation, and when ``old_text`` is
    indented that leading whitespace sits *inside* the matched region. Writing
    ``new_text`` back verbatim would therefore silently reindent the line to
    whatever the model happened to send - in Python or YAML that changes the
    meaning of the code, or breaks it outright, while the tool reports success.

    Only the first line's indentation is compared; the delta is applied to every
    line so the block's internal structure is preserved.
    """
    old_first = old_text.split('\n', 1)[0]
    old_indent = old_first[:len(old_first) - len(old_first.lstrip())]
    if not old_indent:
        # An unindented old_text never swallows the file's indentation, so
        # there is nothing to restore.
        return new_text

    file_first = matched_text.split('\n', 1)[0]
    file_indent = file_first[:len(file_first) - len(file_first.lstrip())]
    if file_indent == old_indent:
        return new_text

    out = []
    for line in new_text.split('\n'):
        if line.strip() and line.startswith(old_indent):
            out.append(file_indent + line[len(old_indent):])
        else:
            out.append(line)
    return '\n'.join(out)


# A `12|` gutter, as emitted by the read tool.
_LINE_NUMBER_PREFIX_RE = re.compile(r'^[ \t]*\d+\|')


def looks_like_line_numbered_block(text: str) -> bool:
    """
    Detect read-tool display text (``12|content``) being written back as file content.

    Since read numbers its output, a model that echoes that output into write -
    or into edit's newText - would silently prepend a gutter to every line of a
    real file. Rejecting is only safe if legitimate content is never mistaken
    for a gutter, so this demands three things at once: at least two lines, a
    clear majority carrying a numeric prefix, and those numbers running
    consecutively. A lone ``1|value`` line, a markdown table row or an ordinary
    numbered list therefore all pass through untouched.
    """
    if not isinstance(text, str):
        return False

    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        return False

    numbered = []
    for line in lines:
        prefix, sep, _rest = line.lstrip().partition('|')
        if sep and prefix.isdigit():
            numbered.append(int(prefix))

    if len(numbered) < 2 or len(numbered) / len(lines) < 0.6:
        return False
    return all(b == a + 1 for a, b in zip(numbered, numbered[1:]))


def strip_line_number_prefixes(text: str) -> Optional[str]:
    """
    Remove ``12|`` gutters the model may have copied out of read output.

    Returns None when the text does not look like numbered output, so callers
    only use this as a fallback after normal matching failed - that way content
    which genuinely contains ``12|`` is never corrupted.
    """
    lines = text.split('\n')
    numbered = [line for line in lines if line.strip()]
    if not numbered or not all(_LINE_NUMBER_PREFIX_RE.match(l) for l in numbered):
        return None
    stripped = '\n'.join(
        _LINE_NUMBER_PREFIX_RE.sub('', line, count=1) if line.strip() else line
        for line in lines
    )
    return stripped if stripped != text else None


def generate_diff_string(old_content: str, new_content: str) -> dict:
    """
    Generate unified diff string
```

### Core Architecture Module: `agent/tools/utils/file_state.py`
```
"""
Cross-tool record of when the agent last read each file.

The tool manager builds a fresh tool instance per call, so this state has to
live at module level to be shared between read, edit and write.

It powers a staleness warning: if a file changed on disk after the agent read
it, the agent is probably about to overwrite someone else's change (the user
editing by hand, a scheduled task, or a concurrent agent). We warn rather than
block - unlike a single-user coding CLI, this agent runs across channels where
legitimate outside edits are common, and hard-failing would strand the model
with no way forward.
"""

import os
import threading
from collections import OrderedDict
from typing import Optional

# Plenty for one conversation; bounded so a long-running process can't grow
# without limit.
_MAX_TRACKED = 512

_lock = threading.Lock()
_read_mtimes = OrderedDict()  # realpath -> mtime at the time we read it


def _key(path: str) -> Optional[str]:
    try:
        return os.path.realpath(path)
    except OSError:
        return None


def _current_mtime(path: str) -> Optional[float]:
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


def note_read(path: str) -> None:
    """Record that the agent has just seen the current contents of *path*."""
    key = _key(path)
    if not key:
        return
    mtime = _current_mtime(key)
    if mtime is None:
        return
    with _lock:
        _read_mtimes[key] = mtime
        _read_mtimes.move_to_end(key)
        while len(_read_mtimes) > _MAX_TRACKED:
            _read_mtimes.popitem(last=False)


# A write is also a point where our view of the file becomes current, so the
# next edit must not be flagged as stale.
note_write = note_read


def staleness_warning(path: str) -> Optional[str]:
    """Warn if *path* changed since the agent last read it.

    Returns None when the file is unchanged, or when the agent never read it -
    an unread file carries no expectation to violate, and warning there would
    fire on every legitimate first write.
    """
    key = _key(path)
    if not key:
        return None
    with _lock:
        seen = _read_mtimes.get(key)
    if seen is None:
        return None
    current = _current_mtime(key)
    if current is None or current <= seen:
        return None
    return (
        f"{os.path.basename(key)} was modified after you last read it "
        "(by the user, a scheduled task, or another agent). Your change was "
        "applied on top of the older content - read the file again to confirm "
        "the result is what you intended."
    )


def reset() -> None:
    """Clear all tracked state. For tests."""
    with _lock:
        _read_mtimes.clear()

```

### Core Architecture Module: `agent/tools/utils/memory_path.py`
```
"""
Which written files feed the memory index.

`MemoryManager.sync()` only re-runs when the manager is dirty, so a write the
tools fail to report here stays invisible to retrieval until the next restart.
Over-reporting costs one hash-based re-scan; under-reporting costs the agent
knowledge it just wrote down, so the checks below err towards reporting.
"""

import os

# Trees and files MemoryManager.sync() scans, relative to the workspace root.
INDEXED_DIRS = ("memory", "knowledge")
INDEXED_FILES = ("MEMORY.md",)


def _real(path: str) -> str:
    return os.path.normpath(os.path.realpath(os.path.expanduser(str(path))))


def _relative(target: str, base: str) -> str:
    """``target`` as a path relative to ``base``, or "" if it sits outside."""
    try:
        rel = os.path.relpath(target, _real(base))
    except ValueError:
        return ""  # different drive on Windows
    if rel == os.pardir or rel.startswith(os.pardir + os.sep):
        return ""
    return rel


def _workspace_root(memory_manager) -> str:
    config = getattr(memory_manager, "config", None)
    return getattr(config, "workspace_root", None) or ""


def _shared_knowledge_dir(workspace_root: str) -> str:
    """Where knowledge writes land for an Agent without a ``knowledge/`` of its
    own: outside its workspace, so the segment check cannot see them."""
    if not workspace_root:
        return ""
    try:
        from common import state_dir

        return str(state_dir.knowledge_dir(base=workspace_root))
    except Exception:
        # No resolvable shared root (registry not ready). The workspace still
        # covers every file that is not a shared fallback.
        return ""


def indexes_rel_path(rel_path: str) -> bool:
    """Whether a path relative to a scanned root feeds the index.

    The relative form of :func:`feeds_memory_index`, for callers that already
    hold a path relative to the root it was resolved against -- the console's
    file editor, which saves workspace-relative paths. Both forms read the same
    ``INDEXED_DIRS`` / ``INDEXED_FILES``, so an indexed tree is declared once.

    They were separate, and drifted: the console kept matching ``memory/`` and
    ``MEMORY.md`` while this module added ``knowledge/``, so a knowledge page
    saved from the console stopped re-embedding while the same write through a
    tool still did (#3176). A backslash separator is normalized where it is one
    (Windows); elsewhere it is an ordinary character in a file name.
    """
    text = str(rel_path or "")
    if os.sep == "\\":
        text = text.replace("\\", "/")
    parts = [part for part in text.split("/") if part not in ("", ".")]
    if not parts or parts[0] == os.pardir:
        return False
    if len(parts) == 1 and parts[0] in INDEXED_FILES:
        return True
    return parts[0] in INDEXED_DIRS


def feeds_memory_index(absolute_path: str, memory_manager, cwd: str = "") -> bool:
    """Whether writing ``absolute_path`` should mark the memory index dirty.

    Decided by resolving the path and comparing segments against the workspace,
    rather than testing the raw argument for ``"memory/"``. That test missed
    ``knowledge/`` entirely, so knowledge writes left the index stale (#3176);
    missed Windows separators (``memory\\note.md``); and matched any path merely
    containing the fragment, such as ``src/memory/cache.py``.

    The tool's ``cwd`` is checked besides the memory workspace because a session
    bound to a project retargets cwd there while memory stays in the workspace.
    """
    target = _real(absolute_path)
    workspace_root = _workspace_root(memory_manager)

    for base in (workspace_root, cwd):
        if not base:
            continue
        rel = _relative(target, base)
        if rel and indexes_rel_path(rel):
            return True

    shared_knowledge = _shared_knowledge_dir(workspace_root)
    return bool(shared_knowledge and _relative(target, shared_knowledge))

```

### Core Architecture Module: `agent/tools/utils/syntax_check.py`
```
"""
Cheap, in-process syntax validation for files the agent writes.

The agent has no compiler, test runner or language server to tell it that an
edit broke a file, so a mistake can sit unnoticed until something tries to load
the file much later. Parsing what we are about to write costs a millisecond and
catches the most common self-inflicted damage: truncated generation, mashed
quotes, a replacement pasted at the wrong indentation.

Two tiers, split by whether "does not parse" is ever a legitimate state:

* Structured data (JSON/YAML/TOML) is an atomic blob - half a JSON document is
  never something anyone meant to write, so a parse failure blocks the write.
* Source code can legitimately be mid-construction, so it only ever produces a
  warning, and only when the edit *introduced* the breakage (a file that was
  already unparseable stays quiet).
"""

import ast
import json
import os
from typing import Optional, Tuple

# Extensions whose content is an atomic structured blob: refuse to write when
# it does not parse.
BLOCKING_EXTS = frozenset({'.json', '.yaml', '.yml', '.toml'})


def _check_json(text: str) -> Optional[str]:
    try:
        json.loads(text)
    except ValueError as e:
        return str(e)
    return None


def _check_yaml(text: str) -> Optional[str]:
    try:
        import yaml
    except ImportError:
        return None
    try:
        # parse(), not safe_load(): we want a syntax verdict, and safe_load
        # additionally rejects perfectly well-formed YAML that uses tags the
        # loader does not know about.
        for _ in yaml.parse(text):
            pass
    except Exception as e:
        return str(e).replace('\n', ' ')
    return None


def _check_toml(text: str) -> Optional[str]:
    try:
        import tomllib
    except ImportError:
        return None
    try:
        tomllib.loads(text)
    except Exception as e:
        return str(e)
    return None


def _check_python(text: str) -> Optional[str]:
    try:
        ast.parse(text)
    except SyntaxError as e:
        where = f" (line {e.lineno})" if e.lineno else ""
        return f"{e.msg}{where}"
    except ValueError as e:
        # e.g. source containing null bytes
        return str(e)
    return None


_CHECKERS = {
    '.json': _check_json,
    '.yaml': _check_yaml,
    '.yml': _check_yaml,
    '.toml': _check_toml,
    '.py': _check_python,
}


def check(path: str, text: str) -> Optional[str]:
    """Return a syntax error message for *text*, or None if it is fine.

    None is also returned for file types we cannot check, so callers can treat
    "no error" and "not checked" the same way.
    """
    checker = _CHECKERS.get(os.path.splitext(path)[1].lower())
    if checker is None:
        return None
    try:
        return checker(text)
    except Exception:
        # A checker blowing up must never stop the agent from writing a file.
        return None


def is_blocking(path: str) -> bool:
    """Whether a parse failure for this path should refuse the write."""
    return os.path.splitext(path)[1].lower() in BLOCKING_EXTS


def review(path: str, old_text: Optional[str], new_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Judge a pending write of *new_text* over *old_text*.

    :return: (blocking_error, warning) - at most one is set.
    """
    error = check(path, new_text)
    if error is None:
        return None, None

    if is_blocking(path):
        return (
            f"Refusing to write {os.path.basename(path)}: the content is not valid "
            f"{os.path.splitext(path)[1].lstrip('.').upper()} ({error}). "
            f"The file was left unchanged - fix the content and retry."
        ), None

    # Source code: stay quiet unless this change is what broke it. A file that
    # was already unparseable is either mid-construction or not really source,
    # and warning there would fire on every routine step.
    if old_text is not None and check(path, old_text) is not None:
        return None, None

    return None, (
        f"This edit leaves {os.path.basename(path)} with a syntax error: {error}. "
        f"The write was applied - re-read the file and fix it if that was not intended."
    )

```

### Core Architecture Module: `agent/tools/utils/truncate.py`
```
"""
Shared truncation utilities for tool outputs.

Truncation is based on two independent limits - whichever is hit first wins:
- Line limit (default: 2000 lines)
- Byte limit (default: 50KB)

Never returns partial lines (except bash tail truncation edge case).
"""

from __future__ import annotations
from typing import Dict, Any, Optional, Tuple, TYPE_CHECKING
if TYPE_CHECKING:
    from typing import Literal


DEFAULT_MAX_LINES = 2000
DEFAULT_MAX_BYTES = 50 * 1024  # 50KB
GREP_MAX_LINE_LENGTH = 500  # Max chars per grep match line


class TruncationResult:
    """Truncation result"""
    
    def __init__(
        self,
        content: str,
        truncated: bool,
        truncated_by: Optional[Literal["lines", "bytes"]],
        total_lines: int,
        total_bytes: int,
        output_lines: int,
        output_bytes: int,
        last_line_partial: bool = False,
        first_line_exceeds_limit: bool = False,
        max_lines: int = DEFAULT_MAX_LINES,
        max_bytes: int = DEFAULT_MAX_BYTES
    ):
        self.content = content
        self.truncated = truncated
        self.truncated_by = truncated_by
        self.total_lines = total_lines
        self.total_bytes = total_bytes
        self.output_lines = output_lines
        self.output_bytes = output_bytes
        self.last_line_partial = last_line_partial
        self.first_line_exceeds_limit = first_line_exceeds_limit
        self.max_lines = max_lines
        self.max_bytes = max_bytes
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "content": self.content,
            "truncated": self.truncated,
            "truncated_by": self.truncated_by,
            "total_lines": self.total_lines,
            "total_bytes": self.total_bytes,
            "output_lines": self.output_lines,
            "output_bytes": self.output_bytes,
            "last_line_partial": self.last_line_partial,
            "first_line_exceeds_limit": self.first_line_exceeds_limit,
            "max_lines": self.max_lines,
            "max_bytes": self.max_bytes
        }


def format_size(bytes_count: int) -> str:
    """Format bytes as human-readable size"""
    if bytes_count < 1024:
        return f"{bytes_count}B"
    elif bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.1f}KB"
    else:
        return f"{bytes_count / (1024 * 1024):.1f}MB"


def truncate_head(content: str, max_lines: Optional[int] = None, max_bytes: Optional[int] = None) -> TruncationResult:
    """
    Truncate content from the head (keep first N lines/bytes).
    Suitable for file reads where you want to see the beginning.
    
    Never returns partial lines. If first line exceeds byte limit,
    returns empty content with first_line_exceeds_limit=True.
    
    :param content: Content to truncate
    :param max_lines: Maximum number of lines (default: 2000)
    :param max_bytes: Maximum number of bytes (default: 50KB)
    :return: Truncation result
    """
    if max_lines is None:
        max_lines = DEFAULT_MAX_LINES
    if max_bytes is None:
        max_bytes = DEFAULT_MAX_BYTES
    
    total_bytes = len(content.encode('utf-8'))
    lines = content.split('\n')
    total_lines = len(lines)
    
    # Check if no truncation is needed
    if total_lines <= max_lines and total_bytes <= max_bytes:
        return TruncationResult(
            content=content,
            truncated=False,
            truncated_by=None,
            total_lines=total_lines,
            total_bytes=total_bytes,
            output_lines=total_lines,
            output_bytes=total_bytes,
            last_line_partial=False,
            first_line_exceeds_limit=False,
            max_lines=max_lines,
            max_bytes=max_bytes
        )
    
    # Check if first line alone exceeds byte limit
    first_line_bytes = len(lines[0].encode('utf-8'))
    if first_line_bytes > max_bytes:
        return TruncationResult(
            content="",
            truncated=True,
            truncated_by="bytes",
            total_lines=total_lines,
            total_bytes=total_bytes,
            output_lines=0,
            output_bytes=0,
            last_line_partial=False,
            first_line_exceeds_limit=True,
            max_lines=max_lines,
            max_bytes=max_bytes
        )
    
    # Collect complete lines that fit
    output_lines_arr = []
    output_bytes_count = 0
    truncated_by = "lines"
    
    for i, line in enumerate(lines):
        if i >= max_lines:
            break
        
        # Calculate line bytes (add 1 for newline if not first line)
        line_bytes = len(line.encode('utf-8')) + (1 if i > 0 else 0)
        
        if output_bytes_count + line_bytes > max_bytes:
            truncated_by = "bytes"
            break
        
        output_lines_arr.append(line)
        output_bytes_count += line_bytes
    
    # If exited due to line limit
    if len(output_lines_arr) >= max_lines and output_bytes_count <= max_bytes:
        truncated_by = "lines"
    
    output_content = '\n'.join(output_lines_arr)
    final_output_bytes = len(output_content.encode('utf-8'))
    
    return TruncationResult(
        content=output_content,
        truncated=True,
        truncated_by=truncated_by,
        total_lines=total_lines,
        total_bytes=total_bytes,
        output_lines=len(output_lines_arr),
        output_bytes=final_output_bytes,
        last_line_partial=False,
        first_line_exceeds_limit=False,
        max_lines=max_lines,
        max_bytes=max_bytes
    )


def truncate_tail(content: str, max_lines: Optional[int] = None, max_bytes: Optional[int] = None) -> TruncationResult:
    """
    Truncate content from tail (keep last N lines/bytes).
    Suitable for bash output where you want to see the ending content (errors, final results).
    
    If the last line of original content exceeds byte limit, may return partial first line.
    
    :param content: Content to truncate
    :param max_lines: Maximum lines (default: 2000)
    :param max_bytes: Maximum bytes (default: 50KB)
    :return: Truncation result
    """
    if max_lines is None:
        max_lines = DEFAULT_MAX_LINES
    if max_bytes is None:
        max_bytes = DEFAULT_MAX_BYTES
    
    total_bytes = len(content.encode('utf-8'))
    lines = content.split('\n')
    total_lines = len(lines)
    
    # Check if no truncation is needed
    if total_lines <= max_lines and total_bytes <= max_bytes:
        return TruncationResult(
            content=content,
            truncated=False,
            truncated_by=None,
            total_lines=total_lines,
            total_bytes=total_bytes,
            output_lines=total_lines,
            output_bytes=total_bytes,
            last_line_partial=False,
            first_line_exceeds_limit=False,
            max_lines=max_lines,
            max_bytes=max_bytes
        )
    
    # Work backwards from the end
    output_lines_arr = []
    output_bytes_count = 0
    truncated_by = "lines"
    last_line_partial = False
    
    for i in range(len(lines) - 1, -1, -1):
        if len(output_lines_arr) >= max_lines:
            break
        
        line = lines[i]
        # Calculate line bytes (add newline if not the first added line)
        line_bytes = len(line.encode('utf-8')) + (1 if len(output_lines_arr) > 0 else 0)
        
        if output_bytes_count + line_bytes > max_bytes:
            truncated_by = "bytes"
            # Edge case: if we haven't added any lines yet and this line exceeds maxBytes,
            # take the end portion of this line
            if len(output_lines_arr) == 0:
                truncated_line = _truncate_string_to_bytes_from_end(line, max_bytes)
                output_lines_arr.insert(0, truncated_line)
                output_bytes_count = len(truncated_line.encode('utf-8'))
                last_line_partial = True
            break
        
        output_lines_arr.insert(0, line)
        output_bytes_count += line_bytes
    
    # If exited due to line limit. A partially kept line means the byte limit
    # was what actually cut the output, even when it also fills max_lines, so
    # leave truncated_by as "bytes" in that case.
    if not last_line_partial and len(output_lines_arr) >= max_lines and output_bytes_count <= max_bytes:
        truncated_by = "lines"
    
    output_content = '\n'.join(output_lines_arr)
    final_output_bytes = len(output_content.encode('utf-8'))
    
    return TruncationResult(
        content=output_content,
        truncated=True,
        truncated_by=truncated_by,
        total_lines=total_lines,
        total_bytes=total_bytes,
        output_lines=len(output_lines_arr),
        output_bytes=final_output_bytes,
        last_line_partial=last_line_partial,
        first_line_exceeds_limit=False,
        max_lines=max_lines,
        max_bytes=max_bytes
    )


def _truncate_string_to_bytes_from_end(text: str, max_bytes: int) -> str:
    """
    Truncate string to fit byte limit (from end).
    Properly handles multi-byte UTF-8 characters.
    
    :param text: String to truncate
    :param max_bytes: Maximum bytes
    :return: Truncated string
    """
    encoded = text.encode('utf-8')
    if len(encoded) <= max_bytes:
        return text
    
    # Start from end, skip back maxBytes
    start = len(encoded) - max_bytes
    
    # Find valid UTF-8 boundary (character start)
    while start < len(encoded) and (encoded[start] & 0xC0) == 0x80:
        start += 1
    
    return encoded[start:].decode('utf-8', errors='ignore')


def truncate_line(line: str, max_chars: int = GREP_MAX_LINE_LENGTH) -> Tuple[str, bool]:
    """
    Truncate single line to max characters, add [truncated] suffix.
    Used for grep match lines.
    
    :param line: Line to truncate
    :param max_chars: Maximum characters
    :return: (truncated text, whether truncated)
    """
    if len(line) <= max_chars:
        return line, False
    return f"{line[:max_chars]}..
```

### Core Architecture Module: `agent/tools/utils/url_safety.py`
```
"""
Shared SSRF guard utilities for tools that fetch model-supplied URLs.

SSRF protection is OPT-IN and disabled by default, because legitimate use
cases (local dev servers, LAN services, proxy fake-ip resolution) need to
reach non-public addresses. Enable it by setting the config option
``web_security_ssrf_protection: true`` (or env ``WEB_SECURITY_SSRF_PROTECTION``).

When enabled, a URL is only considered safe when it uses an http/https
scheme, has a hostname, that hostname resolves, and every resolved address
is a public (internet-routable) address. Loopback, private (RFC1918 / ULA),
link-local (incl. the 169.254.169.254 cloud-metadata endpoint) and otherwise
reserved addresses are rejected, for both IPv4 and IPv6.
"""

import ipaddress
import os
import socket
from urllib.parse import urlparse

import requests


def _ssrf_protection_enabled() -> bool:
    """Return True only when SSRF protection is explicitly turned on.

    Disabled by default. Reads the env var first, then falls back to the
    global config; any failure to read config is treated as "disabled" so
    the guard never breaks normal fetching.
    """
    env = os.getenv("WEB_SECURITY_SSRF_PROTECTION")
    if env is not None:
        return env.strip().lower() in ("1", "true", "yes", "on")
    try:
        from config import conf
        return bool(conf().get("web_security_ssrf_protection", False))
    except Exception:
        return False


def _is_blocked_ip(ip: "ipaddress._BaseAddress") -> bool:
    """Return True if the address is not safe to connect to (non-public)."""
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def assert_public_ip(ip_str: str) -> None:
    """Raise ValueError if the given literal IP is a non-public address.

    No-op when SSRF protection is disabled (the default). Used to re-validate
    the concrete address a redirect resolved to.
    """
    if not _ssrf_protection_enabled():
        return
    ip = ipaddress.ip_address(ip_str)
    if _is_blocked_ip(ip):
        raise ValueError(
            f"URL resolves to a non-public address ({ip_str}), "
            f"request blocked for security"
        )


def validate_url_safe(url: str) -> None:
    """Reject URLs that target private/loopback/link-local addresses (SSRF guard).

    No-op when SSRF protection is disabled (the default). When enabled,
    resolves the hostname to its IP address(es) and blocks any that fall
    into non-public ranges. Also rejects URLs with no host, non-HTTP(S)
    schemes, or hosts that fail DNS resolution.

    Raises:
        ValueError: if the URL targets a disallowed address.
    """
    if not _ssrf_protection_enabled():
        return

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname")

    try:
        # Resolve all addresses for the hostname.
        addr_infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        raise ValueError(f"Cannot resolve hostname: {hostname}")

    for family, _, _, _, sockaddr in addr_infos:
        assert_public_ip(sockaddr[0])


# Cap on how many redirects we follow; every hop's target is re-validated
# against the SSRF guard so a public URL cannot bounce us into an internal one.
MAX_REDIRECTS = 10


def safe_get(url: str, timeout: float = 30, headers: dict = None,
             max_redirects: int = MAX_REDIRECTS, **kwargs) -> "requests.Response":
    """Issue a GET request while re-validating every redirect hop (SSRF guard).

    Auto-redirect is disabled and each hop is followed manually, so the target
    of every redirect is re-resolved and checked against the SSRF guard before
    it is requested. This prevents a public URL from 3xx-bouncing into a
    private, loopback, link-local or cloud-metadata address. Extra ``kwargs``
    are passed through to ``requests.get`` (e.g. ``stream``).

    Any tool that fetches a model-supplied URL must go through this helper:
    validating only the original URL leaves the redirect hop unguarded.

    Raises:
        ValueError: if any hop resolves to a non-public address.
    """
    kwargs.pop("allow_redirects", None)
    current = url
    for _ in range(max_redirects + 1):
        response = requests.get(
            current,
            headers=headers,
            timeout=timeout,
            allow_redirects=False,
            **kwargs,
        )
        if not response.is_redirect and not response.is_permanent_redirect:
            return response

        location = response.headers.get("Location")
        if not location:
            return response

        # Resolve the redirect target relative to the current URL, then
        # re-validate it before following.
        try:
            current = requests.compat.urljoin(current, location)
            validate_url_safe(current)
        finally:
            # A rejected redirect is never returned to the caller, so it must
            # release its connection here even when resolution/validation fails.
            response.close()

    raise ValueError(f"Too many redirects (>{max_redirects})")

```

### Core Architecture Module: `channel/web/core/_common.py`
```
"""Shared plumbing behind the web console.

What both sides of the channel need: the request-scoped helpers (auth, the
agent a request is addressed to, upload and workspace paths), the small value
types, and the module-level state that has to be one object per process.

It lives here because ``WebChannel`` and the request handlers both reach for
it. Nothing in this module knows about a handler or about the channel, so it
can be imported from either without a cycle -- which is the whole point:
before, the handlers and the channel had to share a module to share a helper.
"""

import base64
import errno
import hashlib
import hmac
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from urllib.parse import quote

import web

from bridge.context import ContextType
from channel.chat_message import ChatMessage
from common.channel_registry import get_channel_manager
from common.log import logger
from common.utils import constant_time_equals
from config import conf, get_data_root, read_config_template


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".avi", ".mov", ".mkv"}

# Cap for a file the desktop client asks us to import by path. Matches the
# multipart body cap on the HTTP server so both upload routes agree.
MAX_LOCAL_IMPORT_BYTES = 512 * 1024 * 1024


def _is_loopback_request() -> bool:
    """True when the current request came straight from this machine.

    A request that went through a reverse proxy carries forwarding headers even
    if the proxy itself sits on localhost, so those disqualify it.
    """
    env = getattr(web.ctx, "env", {}) or {}
    if env.get("HTTP_X_FORWARDED_FOR") or env.get("HTTP_X_REAL_IP"):
        return False
    addr = (env.get("REMOTE_ADDR") or "").strip()
    return addr in ("::1", "::ffff:127.0.0.1") or addr.startswith("127.")


def _can_reveal_in_file_manager() -> bool:
    """Whether opening a folder here lands in front of the person asking.

    Only when the browser is on this very machine and the machine has a
    desktop: for a remote or proxied console, or a headless server, the file
    manager would open somewhere nobody is looking, if at all.
    """
    if not _is_loopback_request():
        return False
    if sys.platform in ("darwin", "win32"):
        return True
    has_display = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
    return bool(has_display and shutil.which("xdg-open"))


def _desktop_token_matches() -> bool:
    """Whether the request carries the secret the desktop shell handed us.

    The shell generates a random token per launch and passes it in via
    COW_DESKTOP_TOKEN when it spawns the backend, then sends it back on its own
    requests. A browser tab talking to the same port never sees the env of the
    process, so it can't forge this; a source run without the shell has no
    token, and the check simply fails closed.
    """
    expected = os.environ.get("COW_DESKTOP_TOKEN", "")
    if not expected:
        return False
    env = getattr(web.ctx, "env", {}) or {}
    provided = env.get("HTTP_X_COW_DESKTOP_TOKEN", "")
    return bool(provided) and constant_time_equals(provided, expected)


@dataclass
class SSEStreamState:
    """Bounded, replayable event log for one web request."""

    condition: threading.Condition = field(default_factory=threading.Condition)
    events: deque = field(default_factory=deque)
    next_seq: int = 1
    total_bytes: int = 0
    last_active: float = field(default_factory=time.time)
    main_done: bool = False
    main_done_at: Optional[float] = None
    stream_complete: bool = False
    completed_at: Optional[float] = None
    closed: bool = False
    # Where the stored transcript and this log last lined up: messages up to
    # ``stored_seq`` hold exactly what events up to ``stored_event_seq`` showed.
    stored_seq: Optional[int] = None
    stored_event_seq: int = 0


def _read_config_file_for_write() -> dict:
    """Baseline dict for a partial write to config.json.

    When the file does not exist yet (fresh install), seed from
    config-template.json — the very config the running process loaded. Starting
    from an empty dict would persist a file missing every template default
    (model, agent limits, ...), silently changing behavior after a restart.
    """
    config_path = os.path.join(get_data_root(), "config.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    return read_config_template()


def _write_config_file_for_write(config_path: str, data: dict) -> None:
    """Write ``data`` to ``config_path`` without truncating the old file first.

    Every console save reads config.json, changes a few keys and writes the whole
    dict back. Writing straight into ``config_path`` truncates it before the new
    bytes are there, so anything that fails while serialising -- a value json
    cannot encode, a full disk, the process being killed -- leaves a half-written
    file. That is worse here than for a cache: ``load_config`` treats an
    unparseable user config as corruption, and on the desktop client the self-heal
    path quarantines the file and replaces it with config-template.json, so every
    API key, channel credential and custom provider goes with it. A source
    deployment instead raises and never starts. Building the result beside the
    file and replacing it means a failed save leaves whatever was there before.
    """
    # Write through a symlinked config.json rather than replacing the link.
    config_path = os.path.realpath(config_path)
    # A unique temp name per save: the console handlers run on a thread pool
    # without a lock, and a shared name would let two overlapping saves truncate
    # and rename each other's file.
    try:
        fd, tmp_path = tempfile.mkstemp(
            prefix=".config.", suffix=".tmp", dir=os.path.dirname(config_path) or "."
        )
    except PermissionError as e:
        # A writable config.json in a directory that is not: nothing to rename
        # beside it, so serialise fully first and write in place.
        if not os.path.isfile(config_path):
            raise
        text = json.dumps(data, indent=4, ensure_ascii=False)
        logger.warning(f"[WebChannel] Cannot create a temp file beside config.json ({e}), writing in place")
        with open(config_path, "w", encoding="utf-8") as dst:
            dst.write(text)
            dst.flush()
            os.fsync(dst.fileno())
        return
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        # mkstemp creates the file 0600 and os.replace swaps the inode, so carry
        # over the mode config.json already had (e.g. a user-tightened 0600).
        try:
            os.chmod(tmp_path, os.stat(config_path).st_mode & 0o7777)
        except OSError:
            pass
        try:
            os.replace(tmp_path, config_path)
        except OSError as e:
            # Some targets cannot be renamed over even though they can be
            # written: a single-file bind mount (EBUSY / EXDEV), or on Windows a
            # file another handle still has open (PermissionError). The document
            # is already fully serialised, so writing it in place can no longer
            # leave a half-encoded file behind.
            if not (isinstance(e, PermissionError) or e.errno in (errno.EBUSY, errno.EXDEV)):
                raise
            logger.warning(f"[WebChannel] Atomic replace of config.json failed ({e}), writing in place")
            with open(tmp_path, "r", encoding="utf-8") as src:
                text = src.read()
            with open(config_path, "w", encoding="utf-8") as dst:
                dst.write(text)
                dst.flush()
                os.fsync(dst.fileno())
            os.remove(tmp_path)
    except Exception:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise


def _get_web_password() -> str:
    # Coerce to str so non-string values in config.json (e.g. numeric password) won't break comparisons
    pwd = conf().get("web_password", "")
    if pwd is None:
        return ""
    return str(pwd)


def _is_password_enabled():
    return bool(_get_web_password())


# Set once the console owns its socket. The desktop watchdog waits on this to
# tell "still starting" apart from "wedged and never going to answer".
SERVING = threading.Event()

_BIND_ERROR_CODE_RE = re.compile(r"\[(WinError|Errno) (\d+)\]")


def _bind_error_codes(err: OSError):
    """Return ``(winerror, errno)`` for a bind failure.

    cheroot swallows the original exception: it re-raises a bare
    ``socket.error(msg)`` with neither errno nor ``__cause__`` set, so on the
    path we actually care about the code only survives inside the message text.
    """
    winerror = getattr(err, "winerror", None)
    err_no = err.errno
    if winerror is None and err_no is None:
        for kind, code in _BIND_ERROR_CODE_RE.findall(str(err)):
            if kind == "WinError":
                winerror = int(code)
            else:
                err_no = int(code)
    return winerror, err_no


def _log_bind_failure(host: str, port: int, err: OSError):
    """Explain a failed bind in terms the user can act on.

    Windows needs its own branch: a port can be permanently unbindable because
    Hyper-V/WSL2/Docker reserved the range it falls in (WinError 10013), and
    nothing is listening on it, so the usual "kill the stale process" advice
    sends people looking for a process that doesn't exist.
    """
    winerror, err_no = _bind_error_codes(err)
    if winerror == 10013:
        logger.er
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3168** (2026-09-17): **[Bug] [Feishu] Bot is triggered by group messages that mention other users (not the bot)**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  Version: v2.1.9 OS: CentOS Linux 7 (Core), kernel 3.10.0-1160.92.1.el7.x86_64 Python: 3.9.4 Install: source Model & channel: deepseek-v4-flash, feishu   ### What happened?  ## Summary  In Feishu group chats, the bot is sometimes triggered by messages that **do not @-mention the bot at all** — for example, a message that mentions two other human users in the group. This appears to be intermittent ("sometimes", not always).  ## Environment  - CowAgent commit: `7236846` (`fix: dedupe self-evolution bubble on web console history reload`) - Channel: Feishu (`channel_type: feishu`) - Reconnection mode: WebSocket (`lark.ws.Client`) - `feishu_bot_name`: **not configured** - Python: 3.9  ## Steps to Reproduce  1. Configure the Feishu channel and join the bot to a group chat. 2. Do **not** set `feishu_bot_name` in `config.json`. 3. Have another user in the group send a plain text message that @-mentions    other **human** users instead of the bot, e.g.:  @Alice @Bob please update the data for ugc_plstar 4. Observe that the bot processes the message and starts executing tools — even though it was never mentioned. This is intermittent: it works correctly (no trigger) after some restarts, and misbehaves after others. ## Root Cause Analysis The group-chat gate itself is correct. In `channel/feishu/feishu_channel.py`, `_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed and well-researched report — your root-cause analysis was spot on.  You're right: the `_is_mention_bot()` fallback returned `True` whenever the bot identity couldn't be determined. Since an app holding the broad `im:message` scope receives **every** group message (not just ones that @-mention the bot), any message mentioning other people would satisfy the non-empty `mentions` check and get treated as if the bot was called — hence the bot running tools on messages addressed to your colleagues. The intermittency was exactly as you diagnosed: it only happened in the window where `_bot_open_id` hadn't been populated.  This is now fixed in `408e9844`. What we changed:  - **Fail closed.** When neither `_bot_open_id` nor `feishu_bot_name` is available, `_is_mention_bot()` now returns `False` and logs a warning, instead of assuming the bot was mentioned. - **Retry the identity lookup.** The `_bot_open_id` lookup is now retried lazily (rate-limited to once a minute) when

- **Issue #3120** (2026-09-08): **[Bug] 多智能体模式下：微信定时任务被就绪检查误判 not ready，channel_instance 与裸单例不一致，永不投递**
  *Symptoms*: # [Bug] 多智能体模式下：微信定时任务被就绪检查误判 "not ready"，channel_instance 与裸单例不一致，永不投递  ## 摘要  在多智能体团队模式（`agents/team.json` 定义了 `channel_instances`，并把微信绑定到 `agent_id='default'`）下，**所有需要推送到微信的定时任务都无法在重启后自动投递**。  调度器在每次执行前会调用新增的就绪检查 `_is_channel_ready()`（`agent/tools/scheduler/integration.py`），它持续返回 `channel 'weixin' not ready for receiver=<用户>`，任务被无限 `deferring`，从不真正发送。  **触发规律**：只要微信以 channel_instance 形态（带 instance_id/bound_agent_id）运行，就绪检查读取的裸单例就永远拿不到 context_token，因此相关定时任务**持续** not ready、永不投递（即使有入站消息、即使重启，均无法解锁）。  ## 影响  - 所有走微信的定时任务在 channel_instance 多实例形态下**持续静默失效**（非仅重启后第一波），推送无限期挂起，只刷 WARNING 日志，且无法通过发消息解锁。 - 对无人值守的准点推送（日报、巡检、周报等）影响严重：重启后若用户不在线，推送将无限期挂起，只刷 WARNING 日志。 - 此就绪检查逻辑引入前，同样的任务可直接发送，无此问题——疑似近期调度器改动引入的回归。  ## 环境  - 多智能体团队模式：`team.json` 的 `channel_instances` 含   ```json   {"instance_id": "weixin", "channel_type": "weixin", "agent_id": "default", "credentials": {}}   ``` - `config.json`：`channel_type = "web,weixin"` - 微信通道走 ilink 协议，登录正常 - 涉及文件：`agent/tools/scheduler/integration.py`、`channel/weixin/weixin_channel.py`、`config.py`、`channel/channel_factory.py`  ## 复现步骤  1. 以多智能体团队模式启动，微信由 `channel_instances` 管理（启动日志见证据 A）。 2. 创建一条 `channel_type=weixin`、`receiver=<某微信用户ID>` 的定时任务（cron 或一次性均可）。 3. **在进程刚启动、用户尚未给机器人发任何消息时**等待调度器触发。 4. 观察到任务被 `not ready ... deferring` 卡住，并每 ~30s 无限重试。 5. 现在用户主动给机器人发多条消息（刷新该用户 context_token 到实际接收实例），任务**仍然** not ready、持续 deferring，直至一次性任务过期被删除。 6. 多次验证均不恢复，与任务配置、接收者、入站消息均无关。  ## 期望行为  启动时已从凭据文件成功恢复的 context_token（启动日志 `Restored N context_tokens`）应足以让就绪
  **Post-Mortem & Fix Analysis**:
  > 谢谢反馈，最新master代码已修复，可以拉取测试一下
  > > 谢谢反馈，最新master代码已修复，可以拉取测试一下  感谢，已验证正常👍

- **Issue #3108** (2026-09-12): **[Bug] qq和微信通道断开不会自动重连？**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  最新docker  ### What happened?  FO][2026-09-04 11:15:50][web_channel.py:5487] - [WebChannel] Channel instance 'qq' disconnected [INFO][2026-09-04 11:15:52][web_channel.py:5463] - [WebChannel] Channel instance 'qq' saved, restart=no  webui上面状态显示正常，日志显示错误，而且qq也收不到发不出去消息  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 你好，这个断开是怎么触发的，webui上手动断开还是怎么操作的
  > > 你好，这个断开是怎么触发的，webui上手动断开还是怎么操作的  我也不清楚，就启动容器之后没管，发现收不到消息才去排查
  > 已为 qq channel 增加自动重连机制，谢谢反馈  https://github.com/zhayujie/CowAgent/commit/c407bf61704d360664b381f20ace356e85947f93

- **Issue #3106** (2026-09-04): **[Feature] 增加自部署的符合openai标准的模型provider**
  *Symptoms*: ### Self check  - [x] I searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### What's the problem?  当前只看到内置的一些厂商，没看到哪里可以配置自部署的或者其他第三方的服务商选项  ### What would you like?  _No response_  ### Contribution  - [ ] I'd be interested in helping implement this.
  **Post-Mortem & Fix Analysis**:
  > 谢谢反馈，这是最近迭代引入的一个兼容问题，导致增加厂商的按钮不显示了。 已经修复，等待镜像构建完就可以拉取使用了。入口在 「配置 - 模型配置 - 厂商凭据」：  <img width="1329" height="695" alt="Image" src="https://github.com/user-attachments/assets/15fe79bf-645d-4fca-b65b-78e0e1a09b29" />  
  > > 谢谢反馈，这是最近迭代引入的一个兼容问题，导致增加厂商的按钮不显示了。 已经修复，等待镜像构建完就可以拉取使用了。入口在 「配置 - 模型配置 - 厂商凭据」： >  > <img alt="Image" width="1329" height="695" src="https://private-user-images.githubusercontent.com/26161723/646095834-15fe79bf-645d-4fca-b65b-78e0e1a09b29.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3ODg0OTQzNDQsIm5iZiI6MTc4ODQ5NDA0NCwicGF0aCI6Ii8yNjE2MTcyMy82NDYwOTU4MzQtMTVmZTc5YmYtNjQ1ZC00ZmNhLWI2NWItNzhlMGUxYTA5YjI5LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA5MDQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwOTA0VDAzNTQwNFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI0Y2E5NTgyNDRhY2Y0YzU0Nzg0MjkyNzk0ZmQzZGM0YTAzMDViOWI3ZTAwZGM5MjA0OGU4ODAwMjk3NzNhNjkmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.rEoekdzbWAbX987bjsusHPljdtKXzbBgc28TPQ5mWoU">  更新之后有了，但是apikey没写必填，也能保存，选择模型的时候会弹出输入
  > @mengluo04  已优化，现在自定义模型不需要填写 apikey

- **Issue #3104** (2026-09-04): **[Bug] 配置里面，选择主模型的时候，无法记录自定义的**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  最新docker版本  ### What happened?  配置页面，设置主模型，选择自定义，保存之后，切换刀其他模型，再换回来，自定义的模型没了。 希望能记住自定义模型，并且提供按钮通关api的/models接口获取当前key拥有的全部模型，内置的太少了，去平台复制太麻烦了  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，最新代码已修复  https://github.com/zhayujie/CowAgent/commit/7e4d634c43438b5c662a066cf8eab5d33b10a039

- **Issue #2883** (2026-06-12): **[Bug] 微信端的部分内置命令的多行文本推送场景实际未换行**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  Version: v2.1.1 OS: Windows 通道：个人微信bot通道  ### What happened?  以输入 cow help 和 cow status 为例：  <img width="1002" height="722" alt="Image" src="https://github.com/user-attachments/assets/46e5e1e0-9383-476d-bd02-be08a8e133aa" />  大量未换行的情况（尤其是cow help）。实际在电脑本地cmd里运行是正常的。  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 已解决，wechat PC端对非markdown格式的文本换行渲染有问题，把 CLI 在 weixin 通道的输出进行了优化 https://github.com/zhayujie/CowAgent/commit/7fd30b608c77e51826bd187c0255f08026d35f2d
  > 大佬牛逼，爱你~

- **Issue #2821** (2026-05-20): **Bug: 历史对话重载后，工具执行失败状态丢失，全部显示为成功 ✅**
  *Symptoms*: ### 前置确认  - [x] 我确认我运行的是最新版本的代码，并且安装了所需的依赖，在[FAQS](https://github.com/zhayujie/chatgpt-on-wechat/wiki/FAQs)中也未找到类似问题。  ### ⚠️ 搜索issues中是否已存在类似问题  - [x] 我已经搜索过issues和disscussions，没有跟我遇到的问题相关的issue  ### 操作系统类型?  Windows  ### 运行的python版本是?  python 3.8  ### 使用的chatgpt-on-wechat版本是?  Latest Release  ### 运行的`channel`类型是?  other  ### 复现步骤 🕹  1. 在 Web 控制台中发起一个对话，触发一个会执行失败的工具调用（如访问不存在的文件、执行错误命令等） 2. 观察到该工具在对话中显示 ❌ 红色叉号 3. 离开该对话（切换到其他对话或刷新页面） 4. 重新进入该对话，查看历史消息  **期望行为**：重新加载后，失败的工具调用仍应显示 ❌ 红色叉号 **实际行为**：重新加载后，所有工具调用（包括失败的）都显示 ✅ 绿色勾号  ### 问题描述 😯  ## 问题描述  在 Web 控制台中，对话进行时工具执行失败会正确显示 ❌（红色叉号），但退出对话后重新加载，所有工具调用都显示为 ✅（绿色勾号），失败状态丢失。  ## 根因分析  Web 控制台存在两条渲染路径，实时路径正确处理了错误状态，但历史重载路径在 **3 个环节**丢失了 `is_error` 信息：  ### 1️⃣ `_extract_tool_results()` 丢弃了 `is_error` 字段  📄 文件：`agent/memory/conversation_store.py` 第 ~119 行  ```python # 当前代码：只提取了结果文本，丢弃了 is_error results[tool_id] = str(result_content) ```  Claude API 的 tool_result 消息格式中包含 `is_error` 字段： ```json {"type": "tool_result", "tool_use_id": "...", "content": "...", "is_error": true} ```  ### 2️⃣ `_group_into_display_turns()` 不传递错误状态  📄 文件：`agent/memory/conversation_store.py` 第 ~244 行  ```python # 当前代码：只赋值 result，没有 is_error step["result"] = tool_results.get(step.get("id", ""), "") ```  ### 3️⃣ `renderStepsHtml()` 硬编码了成功图标  📄 文件：`channel/web/static/js/console.js` 第 ~1732 行  ```html <!-- 当前代码：永远显示绿色勾 --> <i class="fas fa-check text-primary-400 flex-shrink-0 tool-icon"></i> ```  > 对比 SSE 实时渲染路径（✅ 正确处理）： > ```javascript > const isError = item.s
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，分析的没问题，是否有兴趣提交一个PR来修复这个问题呢~
  > 谢谢 PR https://github.com/zhayujie/CowAgent/pull/2822

- **Issue #2820** (2026-05-18): **Scheduler工具执行任务时似乎会重复运行，存在一些调度bug？**
  *Symptoms*: ### 前置确认  - [x] 我确认我运行的是最新版本的代码，并且安装了所需的依赖，在[FAQS](https://github.com/zhayujie/chatgpt-on-wechat/wiki/FAQs)中也未找到类似问题。  ### ⚠️ 搜索issues中是否已存在类似问题  - [x] 我已经搜索过issues和disscussions，没有跟我遇到的问题相关的issue  ### 操作系统类型?  Windows  ### 运行的python版本是?  python 3.9  ### 使用的chatgpt-on-wechat版本是?  Latest Release  ### 运行的`channel`类型是?  terminal  ### 复现步骤 🕹  ### 情况1： 给予ai一个长任务，如：“2点43分，从git仓库检查issue，并且思考要进行什么操作...” **现象：** 会自己重复运行大概2-4次？  ### 情况2： 给予ai一个中短任务，如：“早晨8点，查询北京今天的天气，直接输出给我。” **现象：** 重复运行2-3次或偶发不重复运行？  ### 情况3： 给予ai一个不需要思考几乎可以瞬间完成的任务，如：“待会儿输出一句hello,world.不要思考，直接输出。” **现象：** 正常运行，且绝大多数情况下只运行1次。   ### 问题描述 😯  问题就是，**当ai运行需要长时间思考的定时任务时，似乎总是会反复运行**，如果是只思考的任务倒是可以接受，也就是多一点token消耗，但是如果定时任务涉及到对外部系统操作或文件读写操作，这时候很容易出现冲突和文件损坏，影响正常使用。  ### 可能的原因？  _本人不太了解python，尤其是多线程或者阻塞之类的处理过程，所以只能根据自己的猜测来提供思路。_  通过阅读scheduler部分的源码，我感觉原本的任务处理意图似乎是，一个while循环，每30s遍历一次任务列表，来判断是否需要执行任务？  但是似乎，循环并没有按照意图每30s进行一次循环，而是好像在持续不断地循环？（从日志上看，三次触发的``[Scheduler] Task *****:``几乎在同一秒内被连续触发）  任务删除或者修改的时机是在任务完成时进行修改，并在日志里打印：``[Scheduler] One-time task completed and removed:``信息。  但是实际上从日志上看，``[Scheduler] Task ****** executed successfully``同样也被触发了三次，说明执行成功了三次，而且后面两次并没有触发任务删除或修改，而是触发了``[Scheduler] Error processing task a7fa6196: Task 'a7fa6196' not found``，我怀疑是第一次完成时已经被删除了，所以后续尝试操作的时候会报错？  我不太了解python的多线程和同步异步阻塞，但是我猜测，会不会是Scheduler的循环没有被阻塞，或者其实被重复多次运行了，而对任务进行更新或删除的操作被任务执行过程阻塞住了，导致没办法及时修改或删除，所以导致被重复运行？  如果是这样的话，那把对任务的执行放在对任务进行更新或删除的操作之后会不会缓解这个问题？或者说，在任务执行前给任务加一个正在执行的标志，甚至在任务执行前直接把相关任务禁用掉，或许可以解决这个问题？  不知道这个思路对不对，还请麻烦开发者复现debug一下了。  ##
  **Post-Mortem & Fix Analysis**:
  > Hi @CNXudiandian，原因可能是 scheduler 在多 session 并发首次初始化时会重复启动多个扫描线程，导致同一个任务被并发触发多次。  我们尝试进行了修复（让 init 真正幂等，全局只保留一个扫描线程），麻烦拉最新代码重启服务再试一下，看看还会不会重复执行～
  > 在测试环境里拉取了最新代码后测试没问题，定时任务只会触发一次，不论长短。 已经部署到服务器上啦，目前看起来修复成功，感谢您的工作~

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

### Incident Patch 1: `e350c711` (2026-10-05)
**Commit Message**: Merge pull request #3537 from c020627/fix-session-settings-model-source

fix(sessions): do not report a model pin a team conversation ignores

**File**: `channel/web/api/sessions.py` (modified, +16/-1)
```diff
@@ -601,6 +601,12 @@ def _session_settings_state(session_id: str, agent_id: Optional[str]) -> dict:
     global config. ``source`` is ``session`` / ``agent`` / ``global`` accordingly,
     and ``agent`` carries the Agent's default when it has one, so a fresh chat
     with a specialist Agent shows the model it will really answer with.
+
+    A pin the runtime ignores must not be reported as one in effect, or the
+    console offers a setting that does nothing. ``AgentBridge.apply_session_prefs``
+    drops the override for a conversation with members -- in a team each Agent
+    answers on its own model, the owner included -- so ``source`` falls back the
+    same way here and ``pin_ignored`` says why.
     """
     from agent.workspace import session_prefs
 
@@ -628,7 +634,13 @@ def _session_settings_state(session_id: str, agent_id: Optional[str]) -> dict:
     except Exception as e:
         logger.debug(f"[WebChannel] agent default model unavailable: {e}")
 
-    if prefs.get("model"):
+    # A conversation with members is a team: every Agent answers on its own
+    # model, so apply_session_prefs passes set_session_override(None, None) and
+    # the stored pin never reaches a request. Reporting it as "session" would
+    # have the console show a check mark on a model nothing answers with.
+    is_group = bool(prefs.get("members"))
+
+    if prefs.get("model") and not is_group:
         effective_model, effective_provider, source = prefs["model"], prefs.get("provider"), "session"
     elif agent_default:
         effective_model, effective_provider, source = agent_default["model"], agent_default["provider"], "agent"
@@ -640,6 +652,9 @@ def _session_settings_state(session_id: str, agent_id: Optional[str]) -> dict:
             "model": effective_model,
             "provider": effective_provider or global_provider,
             "source": source,
+            # A stored pin that this conversation cannot use, and why. The
+            # console shows it as a hint rather than pretending the pin is live.
+            "pin_ignored": bool(prefs.get("model")) and is_group,
             "global": {"model": global_model, "provider": global_provider},
             "agent": agent_default,
             "providers": _session_model_catalog(),
```

**File**: `tests/test_session_settings_model_source.py` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+"""The settings API must not report a model pin the runtime ignores.
+
+`AgentBridge.apply_session_prefs` drops the session override for a conversation
+with members -- in a team every Agent answers on its own model, the owner
+included -- while `_session_settings_state` reported `source="session"` for the
+same conversation. The console reads that as a live pin
+(`session-settings.js:221`), so the user is shown a check mark on a model
+nothing answers with.
+
+The contract these tests pin is agreement between the two, not a particular
+resolution order.
+"""
+import tempfile
+import unittest
+from pathlib import Path
+from unittest.mock import patch
+
+from agent.registry import AgentProfile, get_agent_registry
+from channel.web.api.sessions import _session_settings_state
+
+
+AGENT = "agent-writer"
+
+
+def _runtime_override(prefs, owns_conversation=True):
+    """agent_bridge.py:1373-1378, transcribed."""
+    is_group = bool(prefs.get("members"))
+    if owns_conversation and not is_group:
+        return prefs.get("model")
+    return None
+
+
+class SessionModelSourceTest(unittest.TestCase):
+    """Drives the real _session_settings_state against a stubbed config."""
+
+    def setUp(self):
+        # A real profile, because _session_settings_state also resolves the
+        # owning Agent (for its own default and for the team section). conftest
+        # resets the registry between tests.
+        self.root = tempfile.mkdtemp(prefix="session-source-")
+        get_agent_registry().upsert(AgentProfile(
+            id=AGENT, name="Writer", workspace=str(Path(self.root).resolve()),
+        ))
+
+    def _state(self, prefs, global_model="gpt-4o", global_bot_type="openai"):
+        with patch("channel.web.api.sessions.conf", return_value={
+            "model": global_model, "bot_type": global_bot_type,
+        }), patch("agent.workspace.session_prefs.get_prefs", return_value=prefs), patch(
+            "channel.web.api.sessions.permission_global_mode", return_value="full-access"
+        ), patch(
+            "channel.web.api.sessions._session_model_catalog", return_value=[]
+        ):
+            return _session_settings_state("s1", AGENT)
+
+    def test_a_solo_pin_is_reported_as_a_pin(self):
+        state = self._state({"model": "claude-opus-5", "provider": "claudeAPI"})
+
+        self.assertEqual(state["model"]["source"], "session")
+        self.assertEqual(state["model"]["model"], "claude-opus-5")
+
+    def test_a_team_pin_is_not_reported_as_a_pin(self):
+        # members => the runtime passes set_session_override(None, None).
+        state = self._state({
+            "model": "claude-opus-5",
+            "provider": "claudeAPI",
+            "members": ["agent-writer", "agent-editor"],
+        })
+
+        self.assertNotEqual(
+            state["model"]["source"], "session",
+            "the console will show a check mark on a model no Agent answers with",
+        )
+        self.assertTrue(state["model"]["pin_ignored"])
+
+    def test_the_reported_model_is_the_one_that_actually_answers(self):
+        # The point of the fix: state.model has to name the model a request will
+        # use, which is what the runtime resolves.
+        for prefs in (
+            {"model": "claude-opus-5", "provider": "claudeAPI"},
+            {"model": "claude-opus-5", "provider": "claudeAPI", "members": ["a", "b"]},
+        ):
+            with self.subTest(members=bool(prefs.get("members"))):
+                state = self._state(prefs, global_model="gpt-4o")
+                applied = _runtime_override(prefs)
+                reported = state["model"]["model"]
+
+                if applied is None:
+                    self.assertNotEqual(
+                        reported, "claude-opus-5",
+                        "reported the pinned model, but the runtime drops it",
+                    )
+                else:
+                    self.assertEqual(reported, applied)
+
+    def test_a_team_without_a_pin_is_untouched(self):
+        state = self._state({"members": ["agent-writer"]}, global_model="gpt-4o")
+
+        self.assertEqual(state["model"]["source"], "global")
+        self.assertEqual(state["model"]["model"], "gpt-4o")
+
+    def test_an_empty_member_list_is_not_a_team(self):
+        # `members: []` is falsy, so the runtime treats it as a solo
+        # conversation and the pin applies. The report has to agree.
+        state = self._state({
+            "model": "claude-opus-5", "provider": "claudeAPI", "members": [],
+        })
+
+        self.assertEqual(state["model"]["source"], "session")
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 2: `f069da04` (2026-10-05)
**Commit Message**: fix: trim batch comments and tests, drop the unused think-tag flag

Reuse providers.mask_key for channel secrets and compact the new tests.

Co-authored-by: cowagent <[REDACTED_EMAIL]>

**File**: `agent/protocol/agent_stream.py` (modified, +30/-100)
```diff
@@ -595,27 +595,16 @@ def _should_render_thinking_inline(self) -> bool:
         channel_type = getattr(self.model, 'channel_type', '') or ''
         return conf().get("enable_thinking", False) and channel_type == 'web'
 
-    def _filter_think_tags(self, text: str, streaming: bool = False) -> str:
+    def _filter_think_tags(self, text: str) -> str:
         """
         Handle <think>...</think> blocks in content returned by some LLM providers
         (e.g., MiniMax).
 
         - When inline thinking rendering is allowed (Web + thinking enabled):
           remove only the tags, keep the content inside.
-        - Otherwise (IM channels, or thinking disabled globally): remove both
-          the tags and the content entirely.
-
-        An unclosed literal ``<think>`` must never swallow the reply.
-        ``streaming`` picks between the two call sites:
-
-        - ``streaming=True`` (streaming deltas): an unclosed tag keeps being
-          swallowed to the end, so a half-written reasoning block never leaks.
-        - ``streaming=False`` (final text): only paired blocks are stripped; an
-          unclosed literal tag is rewritten to its full-width form (``＜think＞``)
-          and kept, so the reply is never truncated.
-
-        The final-text path is the one users hit: a reply that merely mentions
-        the tag used to lose everything from the tag onwards.
+        - Otherwise (IM channels, or thinking disabled globally): remove paired
+          blocks entirely. A tag without a partner is literal text, so it is kept
+          in full-width form (``＜think＞``) instead of swallowing the reply.
         """
         if not text:
             return text
@@ -625,94 +614,56 @@ def _filter_think_tags(self, text: str, streaming: bool = False) -> str:
             text = re.sub(r'</think>', '', text)
         else:
             text = re.sub(r'<think>[\s\S]*?</think>', '', text)
-            # Orphan closing tags. Paired blocks were removed above, so whatever
-            # closing tag is left has no opening counterpart. Rewrite it to
-            # full-width instead of deleting it: a literal ``</think>`` in the
-            # visible text is content, not markup, and deleting it would eat the
-            # user's own words.
-            text = re.sub(r'</think>', '＜/think＞', text)
-            if streaming:
-                # Streaming: an unclosed opening tag means the rest is very
-                # likely reasoning, so keep swallowing it.
-                text = re.sub(r'<think>[\s\S]*$', '', text)
-            elif re.search(r'<think>[\s\S]*$', text):
-                # Final text: an unclosed literal tag is content (typically the
-                # user quoting the tag), so keep it in full-width form and leave
-                # a log line instead of silently truncating the reply.
-                logger.warning(
-                    "[Agent] unclosed literal <think> tag in final text; kept as full-width"
-                )
-                text = re.sub(r'<think>', '＜think＞', text)
+            text = text.replace('</think>', '＜/think＞')
+            if '<think>' in text:
+                logger.warning("[Agent] unclosed literal <think> tag in final text; kept as full-width")
+                text = text.replace('<think>', '＜think＞')
         return text
 
-    # Streaming think-tag filtering has to be stateful. A per-delta regex misses
-    # tags split across chunks: a half opening tag (``<thi``) is emitted as-is,
-    # and a closing tag arriving on its own leaks as an orphan ``</think>``.
-    # Channels that accumulate deltas as the final text (wecom_bot, terminal)
-    # have no final-text pass to clean that up, so it must be caught before the
-    # delta is emitted. Design: a small tail buffer + a two-state machine.
+    # Streaming needs state: a per-delta regex leaks tags split across chunks,
+    # and channels that use the accumulated deltas as the final text (wecom_bot,
+    # terminal) never get a final-text pass to clean them up.
     _THINK_OPEN = "<think>"
     _THINK_CLOSE = "</think>"
 
     @staticmethod
     def _partial_tag_suffix_len(text: str, tag: str) -> int:
-        """Length of the suffix of ``text`` that is a proper prefix of ``tag``.
-
-        0 when it is not a prefix at all. Only prefixes starting at ``<`` count,
-        and a complete tag is excluded (the state machine consumes it directly),
-        so ordinary trailing characters (e.g. ``b``) are never held back.
-        """
+        """Length of the suffix of ``text`` that is a proper prefix of ``tag``."""
         for k in range(min(len(text), len(tag) - 1), 0, -1):
             if text.endswith(tag[:k]):
                 return k
         return 0
 
     def _reset_think_stream(self) -> None:
-        """Reset before each LLM stream.
-
-        One turn may run several tool calls, hence several LLM streams.
-        """
+        """Reset before each LLM stream; one turn may run several."""
         se
```

**File**: `agent/skills/frontmatter.py` (modified, +1/-7)
```diff
@@ -159,13 +159,7 @@ def _unwrap_metadata_namespace(metadata_raw: Dict[str, Any]) -> Dict[str, Any]:
 
 
 def _normalize_kind(value: Any) -> str:
-    """Normalize a value to a lower-cased kind string.
-
-    A skill file is hand-written YAML, so ``kind:`` with nothing after it
-    arrives as None and ``kind: 1`` as an int. Calling ``.lower()`` on either
-    raises before the caller's empty check can skip the entry, which takes the
-    whole skill library down with it.
-    """
+    """Lower-cased kind string; "" for a missing or non-string YAML value."""
     if not isinstance(value, str):
         return ""
     return value.strip().lower()
```

**File**: `agent/tools/browser/browser_service.py` (modified, +2/-8)
```diff
@@ -571,14 +571,8 @@ def _run_loop(self):
         except Exception as e:
             logger.error(f"[Browser] Failed to launch browser: {e}")
             self._alive = False
-            # A launch that throws can already have started the Playwright
-            # driver and spawned a Chrome for it, and this path returns before
-            # the _shutdown_browser() below. Leaving them alone would keep both
-            # resident for the life of the process -- invisible to the user,
-            # who only sees "Browser is not available" -- and the Chrome holds
-            # the profile's lock, so the next launch walks into the same failure.
-            # close() cannot reclaim them either: it returns on `not _alive`,
-            # which was just set above.
+            # The driver and Chrome may already be running; a leftover Chrome
+            # holds the profile lock and makes the next launch fail too.
             try:
                 self._shutdown_browser()
             except Exception as cleanup_error:
```

**File**: `agent/tools/tool_manager.py` (modified, +2/-8)
```diff
@@ -332,14 +332,8 @@ def _load_mcp_configs(self) -> list:
             try:
                 with open(mcp_json_path, "r", encoding="utf-8") as f:
                     data = _json.load(f)
-                # Same resolution the console uses in service.load_servers,
-                # and it has to match: `or` would treat an empty server map as
-                # absent and fall through to `data`, so a file saved with no
-                # servers at all ({"mcpServers": {}}, what the editor writes when
-                # the last one is removed) would be read as one server named
-                # "mcpServers" -- which then fails to boot and sticks in
-                # _mcp_status as "failed" for good. Test for the key being
-                # absent, not for the map being truthy.
+                # Must match service.load_servers: an empty {"mcpServers": {}}
+                # means no servers, not a server named "mcpServers".
                 raw = data.get("mcpServers")
                 if raw is None:
                     raw = data.get("mcp_servers", data)
```

**File**: `channel/web/api/channels.py` (modified, +7/-17)
```diff
@@ -20,6 +20,7 @@
     _require_auth,
     _write_config_file_for_write,
 )
+from channel.web.core.providers import mask_key
 from common.log import logger
 from config import conf, get_data_root, get_weixin_credentials_path
 
@@ -174,30 +175,19 @@ def _get_weixin_login_status(instance_id: str = "weixin") -> str:
 
     @staticmethod
     def _mask_secret(value: str) -> str:
-        if not value or len(value) <= 8:
-            return value
-        return value[:4] + "*" * (len(value) - 8) + value[-4:]
+        return mask_key(value)
 
     @staticmethod
     def _is_masked_secret(value) -> bool:
-        """True for an empty value or one this handler already masked.
-
-        The console renders a masked credential and posts it straight back, so
-        every save path has to recognise its own mask and leave the stored
-        secret alone. The shape is decided by ``_mask_secret`` rather than by a
-        star count of its own: that mask emits one star per hidden character,
-        so a 9-character credential comes back as a single star and a guard
-        that insists on four would store that mask over the real secret.
-
-        A masked value is four characters, then nothing but stars, then four
-        characters - which is what makes "every save path" one shared predicate
-        instead of three copies of a star count.
+        """True for an empty value or one shaped like ``_mask_secret`` output.
+
+        The console posts a masked credential back unchanged; one star per
+        hidden character means a 9-character secret has just one.
         """
         if value is None or value == "":
             return True
         text = str(value)
-        middle = text[4:-4]
-        return len(text) > 8 and middle and set(middle) == {"*"}
+        return len(text) > 8 and set(text[4:-4]) == {"*"}
 
     @staticmethod
     def _parse_channel_list(raw) -> list:
```

**File**: `channel/wechatmp/wechatmp_channel.py` (modified, +3/-14)
```diff
@@ -410,12 +410,7 @@ def _success_callback(self, session_id, context, **kwargs):  # 线程异常结
             self.running.discard(self._passive_reply_key(session_id, context))
 
     def _discard_cached_reply(self, key):
-        """Release everything cached for one user and drop the entry.
-
-        Mirrors what passive_reply does with a segment it cannot render, so
-        a permanent media item is deleted rather than left in the material
-        store. Safe to call when the entry is already gone.
-        """
+        """Drop one user's cached reply and delete any media it uploaded."""
         for reply_type, content in self.cache_dict.pop(key, []):
             if reply_type != "text" and content:
                 asyncio.run_coroutine_threadsafe(
@@ -427,14 +422,8 @@ def _fail_callback(self, session_id, exception, context, **kwargs):  # 线程异
         if self.passive_reply:
             key = self._passive_reply_key(session_id, context)
             if key in self.cache_dict:
-                # Actually drop it. The entry gate in passive_reply only
-                # starts a task when the cache is empty *and* the user is not
-                # running, so a segment left here after `running` is discarded
-                # closes the gate: the user's next message skips the agent and
-                # drains this stale text instead, answering the question that
-                # just failed and dropping the new one. The wait loop breaks
-                # out early on an empty `running`, so the timeout branch that
-                # would have papered over it is skipped as well.
+                # A leftover entry would make the user's next message drain this
+                # stale reply instead of starting a new task.
                 logger.warning("[wechatmp] Undrained reply cached for {}, dropping".format(key))
                 self._discard_cached_reply(key)
             self.running.discard(key)
```

**File**: `channel/wecom_bot/wecom_bot_channel.py` (modified, +1/-5)
```diff
@@ -1203,11 +1203,7 @@ def _ensure_image_format(file_path: str) -> str:
             logger.info(f"[WecomBot] Image converted from {fmt} -> {out_path}")
             return out_path
         except Exception as e:
-            # Nothing was converted, so the caller must not treat the original as
-            # ready to send -- WeCom only accepts JPG/PNG here. Returning
-            # file_path looked like success and left both callers' `if not
-            # formatted` guards unreachable, so an image the agent produced was
-            # uploaded or embedded as-is and rejected platform-side.
+            # WeCom only accepts JPG/PNG, so the unconverted original is unusable.
             logger.error(f"[WecomBot] Image format check failed: {e}")
             return ""
 
```

**File**: `common/time_check.py` (modified, +1/-3)
```diff
@@ -38,9 +38,7 @@ def _to_minutes(value):
             elif chat_start_time < chat_stop_time and chat_start_time <= now_time <= chat_stop_time:
                 f(self, *args, **kwargs)
             else:
-                # 定义匹配规则，如果以 #reconf 或者 #更新配置 结尾，非服务时间可以修改开始/结束时间并重载配置。
-                # 重载配置是 godcmd 认的中文别名（ADMIN_COMMANDS["reconf"]["alias"]），
-                # 和 #reconf 指的是同一件事，不该只认英文那一个。
+                # Config reload commands still work off hours
                 pattern = re.compile(r"^.*#(?:reconf|重载配置|更新配置)$")
                 if args and pattern.match(args[0].content):
                     f(self, *args, **kwargs)
```

---

### Incident Patch 3: `207be809` (2026-10-05)
**Commit Message**: Merge pull request #3527 from rudycelekli/fix/cow-atomic-private-staging-20261004

fix(storage): keep atomic staging files private while writing

**File**: `common/atomic_write.py` (modified, +10/-1)
```diff
@@ -41,7 +41,16 @@ def _replace(path, write, encoding: str = "utf-8", newline=None) -> None:
     directory, name = os.path.split(target)
     tmp_path = os.path.join(directory, f".{name}.{uuid.uuid4().hex[:12]}.tmp")
     try:
-        f = open(tmp_path, "w", encoding=encoding, newline=newline)
+        # Stage with the target's own mode, so a private file is never readable
+        # mid-write while a new file keeps the umask default.
+        try:
+            mode = stat.S_IMODE(os.stat(target).st_mode)
+        except OSError:
+            mode = 0o666
+        f = open(
+            tmp_path, "w", encoding=encoding, newline=newline,
+            opener=lambda name, flags: os.open(name, flags | os.O_EXCL, mode),
+        )
     except OSError as e:
         if not _can_write_in_place(e, target):
             raise
```

**File**: `tests/test_atomic_private_staging.py` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import os
+import stat
+
+import pytest
+
+from common import atomic_write
+
+pytestmark = pytest.mark.skipif(os.name == "nt", reason="POSIX permissions")
+
+
+def _staged_mode(tmp_path, target):
+    modes = []
+
+    def write(handle):
+        handle.write("content")
+        handle.flush()
+        modes.extend(stat.S_IMODE(p.stat().st_mode) for p in tmp_path.glob(".*.tmp"))
+
+    previous = os.umask(0o022)
+    try:
+        atomic_write._replace(target, write)
+    finally:
+        os.umask(previous)
+    assert target.read_text() == "content"
+    assert not list(tmp_path.glob(".*.tmp"))
+    return modes
+
+
+def test_a_private_target_is_staged_privately(tmp_path):
+    target = tmp_path / "credentials.json"
+    target.write_text("old", encoding="utf-8")
+    target.chmod(0o600)
+    assert _staged_mode(tmp_path, target) == [0o600]
+    assert stat.S_IMODE(target.stat().st_mode) == 0o600
+
+
+def test_a_new_file_keeps_the_umask_default(tmp_path):
+    target = tmp_path / "notes.md"
+    assert _staged_mode(tmp_path, target) == [0o644]
+    assert stat.S_IMODE(target.stat().st_mode) == 0o644
```

---

### Incident Patch 4: `dd24c281` (2026-10-05)
**Commit Message**: Merge pull request #3517 from c020627/fix-dingtalk-image-caption-once

fix(dingtalk): send the image caption once, not twice

**File**: `channel/chat_channel.py` (modified, +5/-1)
```diff
@@ -1,3 +1,4 @@
+import copy
 import os
 import re
 import threading
@@ -341,7 +342,10 @@ def _send_reply(self, context: Context, reply: Reply):
                     self._send(text_reply, context)
                     # 短暂延迟后发送图片
                     time.sleep(0.3)
-                    self._send(reply, context)
+                    # The caption is already out; DingTalk and QQ would send it again.
+                    image_reply = copy.copy(reply)
+                    image_reply.text_content = None
+                    self._send(image_reply, context)
                 # Send text bubble before voice, unless channel already streamed
                 # the text (feishu) or natively renders STT under the voice (wechatcom).
                 elif reply.type == ReplyType.VOICE and context.get("voice_reply_text") \
```

**File**: `tests/test_dingtalk_image_caption_once.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+"""An image reply's caption is sent once: as its own text, not again with the image."""
+
+import os
+import sys
+from unittest.mock import patch
+
+sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
+
+from bridge.context import Context
+from bridge.reply import Reply, ReplyType
+from channel.chat_channel import ChatChannel
+
+
+def test_image_is_sent_without_its_caption_after_the_caption_bubble():
+    channel = ChatChannel.__new__(ChatChannel)
+    sent = []
+    channel._send = lambda reply, context, retry_cnt=0: sent.append((reply.type, reply.content, getattr(reply, "text_content", None)))
+    reply = Reply(ReplyType.IMAGE_URL, "https://example.invalid/a.png")
+    reply.text_content = "Here is the chart"
+    context = Context()
+    context["channel_type"] = "dingtalk"
+
+    with patch("channel.chat_channel.time.sleep"):
+        channel._send_reply(context, reply)
+
+    assert sent == [
+        (ReplyType.TEXT, "Here is the chart", None),
+        (ReplyType.IMAGE_URL, "https://example.invalid/a.png", None),
+    ]
+    assert reply.text_content == "Here is the chart"
```

---

### Incident Patch 5: `73e5291c` (2026-10-05)
**Commit Message**: Merge pull request #3538 from fly0sheep-1734/fix/think-tag-unclosed-swallow

fix(agent_stream): don't let unclosed think tags swallow replies

**File**: `agent/protocol/agent_stream.py` (modified, +178/-6)
```diff
@@ -595,7 +595,7 @@ def _should_render_thinking_inline(self) -> bool:
         channel_type = getattr(self.model, 'channel_type', '') or ''
         return conf().get("enable_thinking", False) and channel_type == 'web'
 
-    def _filter_think_tags(self, text: str) -> str:
+    def _filter_think_tags(self, text: str, streaming: bool = False) -> str:
         """
         Handle <think>...</think> blocks in content returned by some LLM providers
         (e.g., MiniMax).
@@ -604,6 +604,18 @@ def _filter_think_tags(self, text: str) -> str:
           remove only the tags, keep the content inside.
         - Otherwise (IM channels, or thinking disabled globally): remove both
           the tags and the content entirely.
+
+        An unclosed literal ``<think>`` must never swallow the reply.
+        ``streaming`` picks between the two call sites:
+
+        - ``streaming=True`` (streaming deltas): an unclosed tag keeps being
+          swallowed to the end, so a half-written reasoning block never leaks.
+        - ``streaming=False`` (final text): only paired blocks are stripped; an
+          unclosed literal tag is rewritten to its full-width form (``＜think＞``)
+          and kept, so the reply is never truncated.
+
+        The final-text path is the one users hit: a reply that merely mentions
+        the tag used to lose everything from the tag onwards.
         """
         if not text:
             return text
@@ -613,10 +625,156 @@ def _filter_think_tags(self, text: str) -> str:
             text = re.sub(r'</think>', '', text)
         else:
             text = re.sub(r'<think>[\s\S]*?</think>', '', text)
-            # Also strip unclosed <think> tag at the end (streaming partial)
-            text = re.sub(r'<think>[\s\S]*$', '', text)
+            # Orphan closing tags. Paired blocks were removed above, so whatever
+            # closing tag is left has no opening counterpart. Rewrite it to
+            # full-width instead of deleting it: a literal ``</think>`` in the
+            # visible text is content, not markup, and deleting it would eat the
+            # user's own words.
+            text = re.sub(r'</think>', '＜/think＞', text)
+            if streaming:
+                # Streaming: an unclosed opening tag means the rest is very
+                # likely reasoning, so keep swallowing it.
+                text = re.sub(r'<think>[\s\S]*$', '', text)
+            elif re.search(r'<think>[\s\S]*$', text):
+                # Final text: an unclosed literal tag is content (typically the
+                # user quoting the tag), so keep it in full-width form and leave
+                # a log line instead of silently truncating the reply.
+                logger.warning(
+                    "[Agent] unclosed literal <think> tag in final text; kept as full-width"
+                )
+                text = re.sub(r'<think>', '＜think＞', text)
         return text
 
+    # Streaming think-tag filtering has to be stateful. A per-delta regex misses
+    # tags split across chunks: a half opening tag (``<thi``) is emitted as-is,
+    # and a closing tag arriving on its own leaks as an orphan ``</think>``.
+    # Channels that accumulate deltas as the final text (wecom_bot, terminal)
+    # have no final-text pass to clean that up, so it must be caught before the
+    # delta is emitted. Design: a small tail buffer + a two-state machine.
+    _THINK_OPEN = "<think>"
+    _THINK_CLOSE = "</think>"
+
+    @staticmethod
+    def _partial_tag_suffix_len(text: str, tag: str) -> int:
+        """Length of the suffix of ``text`` that is a proper prefix of ``tag``.
+
+        0 when it is not a prefix at all. Only prefixes starting at ``<`` count,
+        and a complete tag is excluded (the state machine consumes it directly),
+        so ordinary trailing characters (e.g. ``b``) are never held back.
+        """
+        for k in range(min(len(text), len(tag) - 1), 0, -1):
+            if text.endswith(tag[:k]):
+                return k
+        return 0
+
+    def _reset_think_stream(self) -> None:
+        """Reset before each LLM stream.
+
+        One turn may run several tool calls, hence several LLM streams.
+        """
+        self._think_stream_state = "normal"
+        self._think_stream_tail = ""
+        self._think_buf = ""  # reasoning buffer, handed back on flush if unclosed
+        # Inline mode (web + thinking enabled) removes only the tags and keeps the
+        # reasoning text for the collapsible panel, so the swallow-inside-thinking
+        # path must not apply. Resolved once per stream instead of per delta.
+        self._think_inline = self._should_render_thinking_inline()
+
+    def _filter_think_stream(self, delta: str) -> str:
+        """Stateful streaming filter: the part of this delta that is safe to emit.
+
+        State = ``_think_stream_state`` (normal / in_think) plus
+        ``_think_stream_tail`` (tail buffer). When the end of ``tail + delta``
+        could be th
```

**File**: `tests/test_think_tag_filter.py` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+"""Regression tests for the ``<think>`` tag filter in streaming replies.
+
+Some providers (e.g. MiniMax) wrap reasoning in ``<think>...</think>`` blocks.
+Two failure modes are covered here:
+
+1. **Final text**: an *unclosed* literal tag used to swallow everything after
+   it, so a reply that merely mentioned the tag was truncated for the user.
+   The final-text pass now keeps the tag in full-width form instead.
+2. **Streaming**: a tag split across two deltas used to leak in half — a partial
+   opening tag (``<thi``) was emitted as-is, and a standalone closing tag leaked
+   as an orphan ``</think>``. Filtering is now stateful, holding back a
+   suspicious trailing prefix until the next delta.
+"""
+
+import types
+
+from agent.protocol.agent_stream import AgentStreamExecutor
+
+
+# ---------------------------------------------------------------------------
+# Final text: _filter_think_tags
+# ---------------------------------------------------------------------------
+
+
+def _run(text, streaming=False, render_inline=False):
+    obj = AgentStreamExecutor.__new__(AgentStreamExecutor)  # bypass __init__
+    obj._should_render_thinking_inline = lambda: render_inline
+    return obj._filter_think_tags(text, streaming=streaming)
+
+
+def test_paired_block_is_stripped():
+    """A complete block loses both tags and content (unchanged behaviour)."""
+    assert _run("a<think>secret</think>b") == "ab"
+
+
+def test_unclosed_streaming_still_swallows():
+    """Streaming: an unclosed tag keeps swallowing, so no half reasoning leaks."""
+    assert _run("abc <think>partial reasoning", streaming=True) == "abc "
+
+
+def test_unclosed_final_keeps_content_and_fullwidth_tag():
+    """Final text: an unclosed tag must not swallow the rest of the reply."""
+    out = _run("abc <think>partial reasoning")
+    assert out == "abc ＜think＞partial reasoning"
+    assert "partial reasoning" in out, "content must not be dropped"
+
+
+def test_plain_text_passthrough():
+    assert _run("just a normal reply") == "just a normal reply"
+
+
+def test_render_inline_keeps_content_without_tags():
+    """Inline thinking rendering strips the tags but keeps the content."""
+    assert _run("a<think>b</think>c", render_inline=True) == "abc"
+
+
+def test_multiple_paired_blocks():
+    assert _run("x<think>1</think>y<think>2</think>z") == "xyz"
+
+
+def test_final_orphan_close_tag_kept_fullwidth():
+    """A closing tag without an opening counterpart is text, not markup.
+
+    Paired blocks are removed first, so any closing tag left is an orphan; it is
+    kept in full-width form rather than deleted, matching the unclosed-tag case.
+    """
+    obj = AgentStreamExecutor.__new__(AgentStreamExecutor)
+    obj._should_render_thinking_inline = lambda: False
+    assert obj._filter_think_tags("text</think>more") == "text＜/think＞more"
+    assert obj._filter_think_tags("a<think>x</think>b</think>c") == "ab＜/think＞c"
+
+
+# ---------------------------------------------------------------------------
+# Streaming: stateful cross-delta filtering
+# ---------------------------------------------------------------------------
+
+
+def _make_streamer():
+    obj = AgentStreamExecutor.__new__(AgentStreamExecutor)
+    obj.model = types.SimpleNamespace(channel_type="telegram")  # non-inline path
+    obj._reset_think_stream()
+    return obj
+
+
+def _stream(chunks):
+    """Replay chunks the way production does; return (emitted, joined)."""
+    obj = _make_streamer()
+    emitted = []
+    for c in chunks:
+        d = obj._filter_think_stream(c)
+        if d:
+            emitted.append(d)
+    tail = obj._flush_think_stream()
+    if tail:
+        emitted.append(tail)
+    return emitted, "".join(emitted)
+
+
+def test_open_tag_split_across_deltas():
+    """A partial opening tag must never reach the channel."""
+    emitted, full = _stream(["hello", " world", " <thi", "nk>reasoning", ", hidden"])
+    assert "<thi" not in full and "<" not in "".join(emitted)
+    assert full.startswith("hello world")
+
+
+def test_close_tag_split_across_deltas():
+    """A closing tag split across deltas must not leak, and its content is dropped."""
+    emitted, full = _stream(["a<think>sec", "ret</think>b"])
+    assert full == "ab"
+    assert "</think>" not in full
+
+
+def test_orphan_close_tag_alone():
+    """A standalone closing tag is an orphan ⇒ kept full-width, not dropped."""
+    emitted, full = _stream(["a", "</think>", "b"])
+    assert full == "a＜/think＞b"
+
+
+def test_normal_reply_unaffected():
+    """A reply without tags must stream through unchanged."""
+    emitted, full = _stream(["hello", " world", ", all good"])
+    assert full == "hello world, all good"
+
+
+def test_flush_does_not_drop_tail():
+    """The flush must return buffered text, or the reply loses its ending."""
+    emitted, full = _stream(["abc<"])
+    assert full == "abc<"
+
+
+def test_paired_block_split_across_deltas():
+    """A complete block 
```

---

### Incident Patch 6: `3e037f88` (2026-10-05)
**Commit Message**: Merge pull request #3536 from c020627/fix-wechatmp-fail-callback-drains

fix(wechatmp): drop the undrained reply when a task fails

**File**: `channel/wechatmp/wechatmp_channel.py` (modified, +22/-0)
```diff
@@ -409,10 +409,32 @@ def _success_callback(self, session_id, context, **kwargs):  # 线程异常结
         if self.passive_reply:
             self.running.discard(self._passive_reply_key(session_id, context))
 
+    def _discard_cached_reply(self, key):
+        """Release everything cached for one user and drop the entry.
+
+        Mirrors what passive_reply does with a segment it cannot render, so
+        a permanent media item is deleted rather than left in the material
+        store. Safe to call when the entry is already gone.
+        """
+        for reply_type, content in self.cache_dict.pop(key, []):
+            if reply_type != "text" and content:
+                asyncio.run_coroutine_threadsafe(
+                    self.delete_media(content), self.delete_media_loop
+                )
+
     def _fail_callback(self, session_id, exception, context, **kwargs):  # 线程异常结束时的回调函数
         logger.exception("[wechatmp] Fail to generate reply to user, msgId={}, exception={}".format(context["msg"].msg_id, exception))
         if self.passive_reply:
             key = self._passive_reply_key(session_id, context)
             if key in self.cache_dict:
+                # Actually drop it. The entry gate in passive_reply only
+                # starts a task when the cache is empty *and* the user is not
+                # running, so a segment left here after `running` is discarded
+                # closes the gate: the user's next message skips the agent and
+                # drains this stale text instead, answering the question that
+                # just failed and dropping the new one. The wait loop breaks
+                # out early on an empty `running`, so the timeout branch that
+                # would have papered over it is skipped as well.
                 logger.warning("[wechatmp] Undrained reply cached for {}, dropping".format(key))
+                self._discard_cached_reply(key)
             self.running.discard(key)
```

**File**: `tests/test_wechatmp_fail_callback_drains.py` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+"""A failed task must not leave the user stuck.
+
+_fail_callback logs "dropping" for an undrained cache entry and then discards
+only `running`. passive_reply's entry gate starts a task only when the cache is
+empty *and* the user is not running, so a leftover entry plus a cleared
+`running` closes the gate: the next message skips the agent and drains the
+stale text, answering the question that just failed.
+"""
+import asyncio
+import unittest
+from collections import defaultdict
+from unittest.mock import patch
+
+from channel.wechatmp import wechatmp_channel as wm
+
+# @singleton rebinds the name to get_instance(); the class is on __wrapped__.
+W = wm.WechatMPChannel.__wrapped__
+
+KEY = "oUser123"
+
+
+class Msg:
+    msg_id = "m1"
+    from_user_id = KEY
+
+
+def _context():
+    return {"msg": Msg()}
+
+
+def _channel():
+    ch = W.__new__(W)
+    ch.passive_reply = True
+    ch.cache_dict = defaultdict(list)
+    ch.running = set()
+    ch.request_cnt = {}
+    return ch
+
+
+def _entry_gate(channel, from_user=KEY, content="hello", message_id="m2"):
+    """passive_reply.py:51-54, transcribed.
+
+    A new agent task starts only when the cache is empty and the user is not
+    already running.
+    """
+    return (
+        channel.cache_dict.get(from_user) is None
+        and from_user not in channel.running
+        or content.startswith("#")
+        and message_id not in channel.request_cnt
+    )
+
+
+class FailCallbackDrainsTest(unittest.TestCase):
+    def _fail(self, channel, exc=RuntimeError("stream died")):
+        W._fail_callback(channel, "s1", exc, _context())
+
+    def test_a_failed_task_leaves_the_next_message_free_to_start(self):
+        channel = _channel()
+        channel.running.add(KEY)
+        channel.cache_dict[KEY].append(("text", "first chunk"))
+
+        self._fail(channel)
+
+        self.assertNotIn(
+            KEY, channel.cache_dict,
+            "the stale segment survived, so it is drained as the answer to the "
+            "next message",
+        )
+        self.assertNotIn(KEY, channel.running)
+        self.assertTrue(
+            _entry_gate(channel),
+            "the user's next message will not reach the agent",
+        )
+
+    def test_the_entry_is_gone_rather_than_left_empty(self):
+        # Not just empty: absent. cache_dict is a defaultdict, so an entry that
+        # merely held an empty list would still be created again on the next
+        # lookup and the gate would read the same way.
+        channel = _channel()
+        channel.running.add(KEY)
+        channel.cache_dict[KEY].append(("text", "first chunk"))
+
+        self._fail(channel)
+
+        self.assertNotIn(KEY, channel.cache_dict)
+        self.assertIsNone(channel.cache_dict.get(KEY))
+
+    def test_a_permanent_media_item_is_released(self):
+        # 5 of the 6 cache sites hold a media_id uploaded to the permanent
+        # material store, so a leftover entry leaks it. passive_reply releases
+        # these with delete_media; the discard has to do the same.
+        channel = _channel()
+        channel.running.add(KEY)
+        channel.delete_media_loop = asyncio.new_event_loop()
+        channel.cache_dict[KEY].extend(
+            [("image", "MEDIA_IMAGE"), ("video", "MEDIA_VIDEO")]
+        )
+
+        # Record what delete_media was asked to release. It has to be a real
+        # coroutine function, since the production code hands its result
+        # straight to run_coroutine_threadsafe.
+        released = []
+
+        async def _delete(media_id):
+            released.append(media_id)
+
+        channel.delete_media = _delete
+
+        loop = asyncio.new_event_loop()
+        try:
+            def _run(coro, target_loop):
+                loop.run_until_complete(coro)
+
+            with patch.object(wm.asyncio, "run_coroutine_threadsafe", side_effect=_run):
+                self._fail(channel)
+        finally:
+            loop.close()
+
+        self.assertEqual(
+            released, ["MEDIA_IMAGE", "MEDIA_VIDEO"],
+            "a cached media item was left in the permanent material store",
+        )
+
+    def test_a_failure_with_nothing_cached_is_unaffected(self):
+        channel = _channel()
+        channel.running.add(KEY)
+
+        self._fail(channel)
+
+        self.assertNotIn(KEY, channel.running)
+        self.assertTrue(_entry_gate(channel))
+
+    def test_the_callback_never_raises_on_an_already_drained_entry(self):
+        # The success callback runs first on some paths, and passive_reply
+        # deletes the entry as it drains; the discard has to tolerate both.
+        channel = _channel()
+        channel.running.add(KEY)
+        channel.cache_dict[KEY].append(("text", "only chunk"))
+
+        # Nothing cached the second time round, so the discard sees an absent
+        # entry. It has to be a no-op rather than a KeyError.
+        self._fail(channel)
+        self._fail(channel)
+
+        self.assertNotIn(
```

---

### Incident Patch 7: `e8f84604` (2026-10-05)
**Commit Message**: Merge pull request #3534 from rudycelekli/fix/cow-filename-single-path-20261004

fix(search): respect an explicit file path in filename searches

**File**: `agent/tools/search_files/search_files.py` (modified, +3/-1)
```diff
@@ -222,7 +222,9 @@ def _find_by_name(self, pattern: str, root: str, ignore_case: bool,
                 if self._is_credential_path(os.path.join(dirpath, d)):
                     continue
                 kept.append(d)
-            dirnames[:] = sorted(kept)
+            # An explicit file path scopes this search to that one file, not
+            # nested files that happen to have the same basename.
+            dirnames[:] = [] if only else sorted(kept)
 
             for filename in filenames:
                 if only and filename != only:
```

**File**: `tests/test_filename_single_path_native.py` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+from agent.tools.search_files.search_files import SearchFiles
+
+
+def test_explicit_file_search_never_includes_nested_namesakes(tmp_path):
+    target = tmp_path / "notes.md"
+    target.write_text("main")
+    folder = tmp_path / "unrelated"
+    folder.mkdir()
+    (folder / "notes.md").write_text("other")
+    tool = SearchFiles({"cwd": str(tmp_path)})
+    result = tool.execute({"pattern": "*.md", "target": "files", "path": str(target)})
+    assert result.status == "success"
+    assert result.result["files"] == ["notes.md"]
+    assert result.result["match_count"] == 1
+
+
+def test_directory_search_still_includes_nested_namesakes(tmp_path):
+    (tmp_path / "notes.md").write_text("main")
+    folder = tmp_path / "unrelated"
+    folder.mkdir()
+    (folder / "notes.md").write_text("other")
+    result = SearchFiles({"cwd": str(tmp_path)}).execute({"pattern": "*.md", "target": "files"})
+    assert set(result.result["files"]) == {"notes.md", "unrelated/notes.md"}
```

---

### Incident Patch 8: `1c343b06` (2026-10-05)
**Commit Message**: Merge pull request #3533 from rudycelekli/fix/cow-filename-ignore-case-20261004

fix(search): honor filename ignore_case on every platform

**File**: `agent/tools/search_files/search_files.py` (modified, +6/-2)
```diff
@@ -192,7 +192,10 @@ def _find_by_name(self, pattern: str, root: str, ignore_case: bool,
         Results are ordered most-recently-modified first - when several files
         match, the one just worked on is almost always the one wanted.
         """
-        matcher = fnmatch.fnmatch if ignore_case else fnmatch.fnmatchcase
+        # fnmatch.fnmatch normalizes case only on Windows. Honor the explicit
+        # option on every platform while keeping the default case-sensitive.
+        if ignore_case:
+            pattern = pattern.casefold()
         # A bare "report" is far more likely to mean "name contains report"
         # than an exact filename; a pattern with no wildcard would otherwise
         # match nothing and look like the file does not exist.
@@ -224,7 +227,8 @@ def _find_by_name(self, pattern: str, root: str, ignore_case: bool,
             for filename in filenames:
                 if only and filename != only:
                     continue
-                if not matcher(filename, pattern):
+                candidate = filename.casefold() if ignore_case else filename
+                if not fnmatch.fnmatchcase(candidate, pattern):
                     continue
                 full = os.path.join(dirpath, filename)
                 if self._is_credential_path(full):
```

**File**: `tests/test_filename_ignore_case_native.py` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import pytest
+
+from agent.tools.search_files.search_files import SearchFiles
+
+
+@pytest.mark.parametrize("pattern", ["report", "*.md", "r[ae]port.*"])
+def test_ignore_case_finds_mixed_case_real_filenames(tmp_path, pattern):
+    folder = tmp_path / "nested"
+    folder.mkdir()
+    (folder / "REPORT.MD").write_text("notes")
+    tool = SearchFiles({"cwd": str(tmp_path)})
+    result = tool.execute({"pattern": pattern, "target": "files", "ignore_case": True})
+    assert result.status == "success"
+    assert result.result["files"] == ["nested/REPORT.MD"]
+
+
+def test_case_sensitive_filename_search_stays_exact(tmp_path):
+    (tmp_path / "REPORT.MD").write_text("notes")
+    tool = SearchFiles({"cwd": str(tmp_path)})
+    result = tool.execute({"pattern": "report", "target": "files", "ignore_case": False})
+    assert result.result["files"] == []
```

---

### Incident Patch 9: `48805bad` (2026-10-05)
**Commit Message**: Merge pull request #3532 from rudycelekli/fix/cow-recipient-key-collision-20261004

fix(scheduler): prevent recipient identity key collisions

**File**: `agent/tools/scheduler/recipient_store.py` (modified, +22/-6)
```diff
@@ -40,11 +40,13 @@ def __init__(self, store_path: str) -> None:
 
     @staticmethod
     def _key(instance_id: str, receiver: str) -> str:
-        # ``:`` reads cleanly in the on-disk JSON. Both an instance_id and a
-        # receiver id can themselves carry a colon (feishu group ids do), so the
-        # key is only ever a joined form; downstream code uses the structured
-        # fields, never a split of this key.
-        return f"{instance_id}:{receiver}"
+        # Escape the delimiter and the escape marker in each component. Plain
+        # identities retain their existing readable keys; embedded colons cannot
+        # make two different instance/receiver pairs alias the same contact.
+        def escape(component: str) -> str:
+            return component.replace("%", "%25").replace(":", "%3A")
+
+        return f"{escape(instance_id)}:{escape(receiver)}"
 
     def _load_unlocked(self) -> Dict[str, dict]:
         if not self.store_path.exists():
@@ -53,7 +55,21 @@ def _load_unlocked(self) -> Dict[str, dict]:
             with self.store_path.open("r", encoding="utf-8") as handle:
                 value = json.load(handle)
             recipients = value.get("recipients", {})
-            return recipients if isinstance(recipients, dict) else {}
+            if not isinstance(recipients, dict):
+                return {}
+            # Legacy keys joined unescaped components. Rebuild from the stored
+            # structured identity, so an ambiguous old key never routes a lookup
+            # to another instance. Persist the normalized keys on the next save.
+            normalized = {}
+            for key, entry in recipients.items():
+                if isinstance(entry, dict):
+                    identity = self._normalize(entry)
+                    instance_id = identity.get("instance_id")
+                    receiver = identity.get("receiver")
+                    if isinstance(instance_id, str) and isinstance(receiver, str):
+                        key = self._key(instance_id, receiver)
+                normalized[key] = entry
+            return normalized
         except (OSError, ValueError, TypeError):
             return {}
 
```

**File**: `tests/test_recipient_key_collision.py` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import json
+
+from agent.tools.scheduler.recipient_store import RecipientStore
+
+
+def test_colon_components_do_not_alias_another_contact(tmp_path):
+    path = tmp_path / "recipients.json"
+    store = RecipientStore(str(path))
+    store.remember("weixin", "user", name="Ada", instance_id="bot:west")
+    store.remember("weixin", "west:user", name="Bob", instance_id="bot")
+    reopened = RecipientStore(str(path))
+    assert reopened.get("bot:west", "user")["name"] == "Ada"
+    assert reopened.get("bot", "west:user")["name"] == "Bob"
+    assert len(reopened.list()) == 2
+
+
+def test_legacy_colon_entry_is_not_returned_for_another_pair(tmp_path):
+    path = tmp_path / "recipients.json"
+    entry = {
+        "channel_type": "weixin",
+        "instance_id": "bot:west",
+        "receiver": "user",
+        "name": "Ada",
+        "is_group": False,
+        "session_id": "user",
+        "last_seen_at": "2026-09-07T03:01:28+00:00",
+    }
+    path.write_text(json.dumps({"version": 1, "recipients": {"bot:west:user": entry}}))
+    store = RecipientStore(str(path))
+    assert store.get("bot:west", "user")["name"] == "Ada"
+    assert store.get("bot", "west:user") is None
+    store.remember("weixin", "west:user", name="Bob", instance_id="bot")
+    assert store.get("bot:west", "user")["name"] == "Ada"
+    assert len(store.list()) == 2
+
+
+def test_percent_escape_is_itself_escaped(tmp_path):
+    store = RecipientStore(str(tmp_path / "recipients.json"))
+    store.remember("weixin", "user", name="Ada", instance_id="bot:west")
+    store.remember("weixin", "user", name="Bob", instance_id="bot%3Awest")
+    assert store.get("bot:west", "user")["name"] == "Ada"
+    assert store.get("bot%3Awest", "user")["name"] == "Bob"
```

---

### Incident Patch 10: `82ef045a` (2026-10-05)
**Commit Message**: Merge pull request #3531 from rudycelekli/fix/cow-edit-concurrency-20261004

fix(edit): preserve updates from parallel in-process edits

**File**: `agent/tools/edit/edit.py` (modified, +14/-0)
```diff
@@ -4,6 +4,7 @@
 """
 
 import os
+import threading
 from typing import Dict, Any
 
 from agent.tools.base_tool import BaseTool, ToolResult
@@ -26,6 +27,9 @@
 from agent.tools.utils.syntax_check import review as syntax_review
 
 
+_EDIT_LOCKS = tuple(threading.RLock() for _ in range(256))
+
+
 class Edit(BaseTool):
     """Tool for precise file editing"""
     
@@ -61,6 +65,16 @@ def __init__(self, config: dict = None):
         self.memory_manager = self.config.get("memory_manager", None)
     
     def execute(self, args: Dict[str, Any]) -> ToolResult:
+        path = args.get("path", "").strip()
+        if not path:
+            return ToolResult.fail("Error: path parameter is required")
+        key = os.path.normcase(os.path.realpath(self._resolve_path(path)))
+        # Atomic replacement protects file integrity but not two edits made
+        # from the same snapshot. Serialize this process's whole edit cycle.
+        with _EDIT_LOCKS[hash(key) % len(_EDIT_LOCKS)]:
+            return self._execute_locked(args)
+
+    def _execute_locked(self, args: Dict[str, Any]) -> ToolResult:
         """
         Execute file edit operation
         
```

**File**: `tests/test_edit_concurrent_native.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import threading
+import importlib
+
+from agent.tools.edit.edit import Edit
+
+
+def test_native_concurrent_edits_preserve_both_replacements(tmp_path, monkeypatch):
+    target = tmp_path / "notes.md"
+    target.write_bytes(b"alpha\nbeta\n")
+    ready = threading.Event()
+    release = threading.Event()
+    second_done = threading.Event()
+    module = importlib.import_module("agent.tools.edit.edit")
+    original_write = module.write_text_atomic
+
+    def controlled_write(path, content, **kwargs):
+        if threading.current_thread().name == "first":
+            ready.set()
+            assert release.wait(3)
+        return original_write(path, content, **kwargs)
+
+    monkeypatch.setattr(module, "write_text_atomic", controlled_write)
+    outcomes = []
+
+    def edit(old, new, completed=None):
+        result = Edit({"cwd": str(tmp_path)}).execute({"path": "notes.md", "oldText": old, "newText": new})
+        outcomes.append(result.status == "success")
+        if completed:
+            completed.set()
+
+    first = threading.Thread(target=edit, args=("alpha", "ALPHA"), name="first")
+    second = threading.Thread(target=edit, args=("beta", "BETA", second_done))
+    try:
+        first.start()
+        assert ready.wait(3)
+        second.start()
+        # In the old implementation the second edit publishes while the first
+        # still holds a stale snapshot. With locking it waits for admission.
+        second_done.wait(0.5)
+    finally:
+        release.set()
+        first.join(3)
+        if second.ident:
+            second.join(3)
+    assert not first.is_alive() and not second.is_alive()
+    assert outcomes == [True, True]
+    assert target.read_bytes() == b"ALPHA\nBETA\n"
```

---

### Incident Patch 11: `0aeff05e` (2026-10-05)
**Commit Message**: Merge pull request #3530 from rudycelekli/fix/cow-background-utf8-split-20261004

fix(bash): retain incomplete UTF-8 characters between background polls

**File**: `agent/tools/bash/background.py` (modified, +15/-3)
```diff
@@ -60,11 +60,23 @@ def append(self, chunk: bytes) -> None:
                 self.cursor = max(0, self.cursor - overflow)
                 self.dropped += overflow
 
-    def take_new_output(self) -> Tuple[str, int]:
+    def take_new_output(self, final: bool = False) -> Tuple[str, int]:
         """Return output printed since the last call, and bytes lost to the cap."""
         with self.lock:
             chunk = bytes(self.buffer[self.cursor:])
-            self.cursor = len(self.buffer)
+            if not final:
+                # A pipe read or UI poll can bisect a UTF-8 character. Retain
+                # only an incomplete trailing sequence for the next poll.
+                start = len(chunk) - 1
+                while start >= 0 and len(chunk) - start <= 4 and chunk[start] & 0xC0 == 0x80:
+                    start -= 1
+                if start >= 0 and chunk[start] >= 0xC2:
+                    try:
+                        chunk[start:].decode("utf-8")
+                    except UnicodeDecodeError as exc:
+                        if exc.reason == "unexpected end of data":
+                            chunk = chunk[:start]
+            self.cursor += len(chunk)
             dropped, self.dropped = self.dropped, 0
         return decode_output(chunk), dropped
 
@@ -149,7 +161,7 @@ def read(job_id: str) -> Optional[dict]:
         # Give the reader a moment to flush whatever was buffered at exit.
         for reader in job.readers:
             reader.join(timeout=1)
-        tail, more_dropped = job.take_new_output()
+        tail, more_dropped = job.take_new_output(final=True)
         output += tail
         dropped += more_dropped
         _cleanup(job)
```

**File**: `tests/test_background_utf8_split.py` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import subprocess
+import sys
+import threading
+import time
+
+from agent.tools.bash import background
+
+
+def test_native_pipe_split_utf8_is_retained_until_the_character_is_complete():
+    process = subprocess.Popen(
+        [
+            sys.executable,
+            "-c",
+            "import sys; sys.stdout.buffer.write(b'\\xe4'); sys.stdout.buffer.flush(); sys.stdin.buffer.read(1); sys.stdout.buffer.write(b'\\xb8\\xad'); sys.stdout.buffer.flush()",
+        ],
+        stdin=subprocess.PIPE,
+        stdout=subprocess.PIPE,
+    )
+    job = background._Job("native", "fixture", process)
+    reader = threading.Thread(target=background._drain, args=(job, process.stdout), daemon=True)
+    job.readers.append(reader)
+    reader.start()
+    try:
+        deadline = time.monotonic() + 5
+        while len(job.buffer) < 1 and time.monotonic() < deadline:
+            time.sleep(0.001)
+        assert bytes(job.buffer) == b"\xe4"
+        partial, dropped = job.take_new_output()
+        assert partial == ""
+        assert dropped == 0
+        process.stdin.write(b"x")
+        process.stdin.flush()
+        process.wait(timeout=5)
+        reader.join(5)
+        final, dropped = job.take_new_output()
+        assert final == "中"
+        assert dropped == 0
+    finally:
+        if process.poll() is None:
+            process.kill()
+        process.wait(timeout=5)
+        reader.join(5)
+        process.stdin.close()
+        process.stdout.close()
+
+
+def test_finished_native_pipe_flushes_an_incomplete_final_byte():
+    process = subprocess.Popen(
+        [sys.executable, "-c", "import sys; sys.stdout.buffer.write(b'\\xe4')"], stdout=subprocess.PIPE
+    )
+    job = background._Job("native-final", "fixture", process)
+    reader = threading.Thread(target=background._drain, args=(job, process.stdout), daemon=True)
+    job.readers.append(reader)
+    reader.start()
+    process.wait(timeout=5)
+    reader.join(5)
+    with background._lock:
+        background._jobs[job.id] = job
+    try:
+        result = background.read(job.id)
+        assert result["running"] is False
+        assert result["output"] == "�"
+    finally:
+        with background._lock:
+            background._jobs.pop(job.id, None)
+        process.stdout.close()
```

---

### Incident Patch 12: `bed99cbb` (2026-10-05)
**Commit Message**: Merge pull request #3529 from c020627/fix-wecom-image-format-failure

fix(wecom): report an image that could not be converted instead of sending it

**File**: `channel/wecom_bot/wecom_bot_channel.py` (modified, +6/-1)
```diff
@@ -1203,8 +1203,13 @@ def _ensure_image_format(file_path: str) -> str:
             logger.info(f"[WecomBot] Image converted from {fmt} -> {out_path}")
             return out_path
         except Exception as e:
+            # Nothing was converted, so the caller must not treat the original as
+            # ready to send -- WeCom only accepts JPG/PNG here. Returning
+            # file_path looked like success and left both callers' `if not
+            # formatted` guards unreachable, so an image the agent produced was
+            # uploaded or embedded as-is and rejected platform-side.
             logger.error(f"[WecomBot] Image format check failed: {e}")
-            return file_path
+            return ""
 
     @staticmethod
     def _compress_image(file_path: str, max_bytes: int) -> str:
```

**File**: `tests/test_wecom_image_format_guard.py` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+"""An image that cannot be converted must not be sent on as if it had been.
+
+``_ensure_image_format`` promises "Ensure image is JPG or PNG (the only formats
+wecom supports). Convert if needed" -- and its except path returned the
+*original* path, which is the one value that promise rules out. Both callers
+guard on an empty return:
+
+    callback  :991   if not formatted: return None
+    websocket :1136  if not local_path:
+                          self._send_text("[Image format conversion failed]", ...)
+
+so neither guard could fire, and the failure notice the author wrote for the
+websocket path was unreachable. An image PIL cannot open -- a truncated
+download, a corrupt or exotic format -- was uploaded or base64'd into the
+callback packet unchanged, and WeCom rejects it platform-side: the image never
+appears and nothing says why.
+
+Measured with the real helper:
+
+    a real PNG                        -> returned unchanged  (correct)
+    a truncated .webp                 -> returned unchanged  (the bug)
+    an undecodable .heic              -> returned unchanged  (the bug)
+    guard `if not formatted: ...`     -> never taken
+"""
+
+import os
+import sys
+import tempfile
+import unittest
+
+ROOT = "/".join(__file__.replace("\\", "/").split("/")[:-2])
+if ROOT not in sys.path:
+    sys.path.insert(0, ROOT)
+
+from channel.wecom_bot import wecom_bot_channel as mod  # noqa: E402
+
+# @singleton rebinds the name to get_instance(); the class is on __wrapped__.
+_ensure_image_format = mod.WecomBotChannel.__wrapped__._ensure_image_format
+
+# A 1x1 PNG, byte-for-byte, so the control needs no Pillow round-trip.
+PNG_BYTES = bytes.fromhex(
+    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
+    "01f15c4890000000d4944415478da63f8cfc0000003010100"
+    "18dd8db00000000049454e44ae426082"
+)
+
+
+def _write(directory, name, payload):
+    path = os.path.join(directory, name)
+    with open(path, "wb") as handle:
+        handle.write(payload)
+    return path
+
+
+class EnsureImageFormatTest(unittest.TestCase):
+    """The contract is "JPG or PNG, or nothing"."""
+
+    def setUp(self):
+        self.tmp = tempfile.mkdtemp(prefix="wecom-format-")
+
+    def test_a_supported_image_is_returned_unchanged(self):
+        path = _write(self.tmp, "ok.png", PNG_BYTES)
+        self.assertEqual(_ensure_image_format(path), path)
+
+    def test_an_image_pillow_cannot_open_reports_failure(self):
+        # A truncated WebP: the header parses, the body does not.
+        path = _write(self.tmp, "broken.webp",
+                      b"RIFF\x00\x00\x00\x00WEBPVP8 not-a-real-image-body")
+        self.assertEqual(
+            _ensure_image_format(path), "",
+            "an unconvertible image was handed back as if it were ready to send",
+        )
+
+    def test_an_undecodable_format_reports_failure(self):
+        path = _write(self.tmp, "x.heic",
+                      b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00" + b"\x00" * 64)
+        self.assertEqual(_ensure_image_format(path), "")
+
+    def test_the_callers_guards_can_now_fire(self):
+        # The point of returning "": both call sites already branch on it, and
+        # the websocket one has a user-facing notice that was unreachable.
+        import inspect
+
+        source = inspect.getsource(mod)
+        self.assertIn("if not formatted:", source,
+                      "the callback path's guard disappeared")
+        self.assertIn("[Image format conversion failed]", source,
+                      "the websocket path's failure notice disappeared")
+
+    def test_a_missing_file_reports_failure(self):
+        self.assertEqual(
+            _ensure_image_format(os.path.join(self.tmp, "absent.png")), "")
+
+
+if __name__ == "__main__":
+    unittest.main()
\ No newline at end of file
```

---

### Incident Patch 13: `1dd498f9` (2026-10-05)
**Commit Message**: Merge pull request #3528 from rudycelekli/fix/cow-memory-credential-guard-20261004

fix(memory): apply the shared credential guard to memory reads

**File**: `agent/tools/memory/memory_get.py` (modified, +5/-1)
```diff
@@ -7,6 +7,7 @@
 import os
 
 from agent.tools.base_tool import BaseTool
+from agent.tools.utils.credentials import DENIED_MESSAGE, is_credential_path
 
 
 class MemoryGetTool(BaseTool):
@@ -114,8 +115,11 @@ def _contained(real_path: str, root) -> bool:
 
             real_file = os.path.realpath(str(file_path))
             if not any(_contained(real_file, root) for root in allowed_roots):
-                return ToolResult.fail(f"Error: Access denied: path outside workspace")
+                return ToolResult.fail("Error: Access denied: path outside workspace")
             
+            if is_credential_path(str(file_path)):
+                return ToolResult.fail(DENIED_MESSAGE)
+
             if not file_path.exists():
                 return ToolResult.fail(f"Error: File not found: {path}")
             
```

**File**: `tests/test_memory_get_credentials.py` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+from types import SimpleNamespace
+from agent.tools.memory.memory_get import MemoryGetTool
+from agent.tools.read.read import Read
+
+
+def test_memory_get_uses_the_shared_credential_guard_when_workspace_is_home(tmp_path, monkeypatch):
+    monkeypatch.setenv("HOME", str(tmp_path))
+    monkeypatch.setenv("USERPROFILE", str(tmp_path))
+    credential = tmp_path / ".cow" / ".env"
+    credential.parent.mkdir()
+    credential.write_text("SYNTHETIC_PRIVATE_VALUE", encoding="utf-8")
+    manager = SimpleNamespace(config=SimpleNamespace(get_workspace=lambda: tmp_path))
+    assert Read({"cwd": str(tmp_path)}).execute({"path": str(credential)}).status == "error"
+    result = MemoryGetTool(manager).execute({"path": str(credential)})
+    assert result.status == "error"
+    assert "SYNTHETIC_PRIVATE_VALUE" not in str(result.result)
+
+
+def test_real_memory_content_remains_readable(tmp_path):
+    page = tmp_path / "memory" / "note.md"
+    page.parent.mkdir()
+    page.write_text("safe memory", encoding="utf-8")
+    manager = SimpleNamespace(config=SimpleNamespace(get_workspace=lambda: tmp_path))
+    result = MemoryGetTool(manager).execute({"path": "note.md"})
+    assert result.status == "success"
+    assert "safe memory" in result.result
```

---

### Incident Patch 14: `bbcd3185` (2026-10-05)
**Commit Message**: Merge pull request #3526 from rudycelekli/fix/cow-scheduler-missing-primary-20261004

fix(scheduler): recover a missing primary from the retained backup

**File**: `agent/tools/scheduler/task_store.py` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ def load_tasks(self) -> Dict[str, dict]:
             Dictionary of task_id -> task_data
         """
         with self.lock:
-            if not os.path.exists(self.store_path):
+            if not os.path.exists(self.store_path) and not os.path.exists(f"{self.store_path}.bak"):
                 return {}
             
             try:
```

**File**: `tests/test_scheduler_missing_primary.py` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import json
+from agent.tools.scheduler.task_store import TaskStore
+
+
+def test_missing_primary_recovers_existing_backup_before_mutation(tmp_path):
+    primary = tmp_path / "tasks.json"
+    backup = tmp_path / "tasks.json.bak"
+    backup.write_text(
+        json.dumps({"version": 1, "tasks": {"old": {"id": "old", "name": "retained schedule"}}}), encoding="utf-8"
+    )
+    store = TaskStore(str(primary))
+    assert "old" in store.load_tasks()
+    store.add_task({"id": "new"})
+    assert set(store.load_tasks()) == {"old", "new"}
+    assert "old" in json.loads(backup.read_text())["tasks"]
+
+
+def test_new_store_without_backup_is_empty(tmp_path):
+    store = TaskStore(str(tmp_path / "tasks.json"))
+    assert store.load_tasks() == {}
+    store.add_task({"id": "first"})
+    assert set(store.load_tasks()) == {"first"}
```

---

### Incident Patch 15: `4dd11997` (2026-10-05)
**Commit Message**: Merge pull request #3525 from rudycelekli/fix/cow-read-special-files-20261004

fix(read): reject FIFOs before opening their contents

**File**: `agent/tools/read/read.py` (modified, +10/-0)
```diff
@@ -4,6 +4,7 @@
 """
 
 import os
+import stat
 from typing import Dict, Any, Optional
 from pathlib import Path
 
@@ -184,6 +185,15 @@ def execute(self, args: Dict[str, Any]) -> ToolResult:
                 f"Use the ls tool to list what is inside it."
             )
         
+        # A FIFO has size zero yet open/read waits indefinitely for a writer.
+        # Inspect the resolved target before dispatching to any content parser.
+        try:
+            mode = os.stat(absolute_path).st_mode
+        except OSError as exc:
+            return ToolResult.fail(f"Error inspecting file: {exc}")
+        if not stat.S_ISREG(mode):
+            return ToolResult.fail(f"Error: {path} is not a regular file")
+
         # Check if readable
         if not os.access(absolute_path, os.R_OK):
             return ToolResult.fail(f"Error: File is not readable: {path}")
```

**File**: `tests/test_read_special_files.py` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import json
+import os
+import subprocess
+import sys
+import pytest
+from agent.tools.read.read import Read
+
+
+@pytest.mark.skipif(not hasattr(os, "mkfifo"), reason="POSIX FIFO fixture")
+@pytest.mark.parametrize("alias", [False, True])
+def test_read_fifo_returns_error_without_waiting_for_writer(tmp_path, alias):
+    fifo = tmp_path / "pipe.txt"
+    os.mkfifo(fifo)
+    path = fifo
+    if alias:
+        path = tmp_path / "alias.txt"
+        path.symlink_to(fifo)
+    code = "from agent.tools.read.read import Read; import json,sys; print('ready', flush=True); r=Read({'cwd':sys.argv[1]}).execute({'path':sys.argv[2]}); print(json.dumps({'status':r.status,'error':r.result}))"
+    process = subprocess.Popen(
+        [sys.executable, "-c", code, str(tmp_path), str(path)],
+        stdout=subprocess.PIPE,
+        stderr=subprocess.PIPE,
+        text=True,
+    )
+    try:
+        for line in process.stdout:
+            if line.strip() == "ready":
+                break
+        else:
+            pytest.fail("child exited before the FIFO read")
+        output, error = process.communicate(timeout=2)
+        assert process.returncode == 0, error
+        assert json.loads(output)["status"] == "error"
+    finally:
+        if process.poll() is None:
+            process.kill()
+            process.communicate()
+
+
+def test_regular_text_and_symlink_remain_readable(tmp_path):
+    source = tmp_path / "text.txt"
+    source.write_text("hello", encoding="utf-8")
+    link = tmp_path / "alias.txt"
+    link.symlink_to(source)
+    assert Read({"cwd": str(tmp_path)}).execute({"path": str(link)}).status == "success"
```

#### Recent Merged Pull Requests:
- **PR #3538** (2026-10-05): fix(agent_stream): don't let unclosed think tags swallow replies (@fly0sheep-1734)
- **PR #3537** (2026-10-05): fix(sessions): do not report a model pin a team conversation ignores (@c020627)
- **PR #3536** (2026-10-05): fix(wechatmp): drop the undrained reply when a task fails (@c020627)
- **PR #3535** (closed): fix(wechatmp): answer "success" when a callback fails (@c020627)
- **PR #3534** (2026-10-05): fix(search): respect an explicit file path in filename searches (@rudycelekli)
- **PR #3533** (2026-10-05): fix(search): honor filename ignore_case on every platform (@rudycelekli)
- **PR #3532** (2026-10-05): fix(scheduler): prevent recipient identity key collisions (@rudycelekli)
- **PR #3531** (2026-10-05): fix(edit): preserve updates from parallel in-process edits (@rudycelekli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

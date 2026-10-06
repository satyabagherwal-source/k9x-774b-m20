# Forensic Learning Record (Deep Inspection): jordan-gibbs/hyperresearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/jordan-gibbs-hyperresearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jordan-gibbs/hyperresearch](https://github.com/jordan-gibbs/hyperresearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:56:44.882Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jordan-gibbs/hyperresearch`
- **Description**: Convert Claude Code or Codex into the most intelligent Deep Research Agent. Collect, search, and synthesize web research into a persistent, searchable wiki that builds on itself. Hosted API + MCP: hyperresearch.ai
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3784 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/hyperresearch/core/__init__.py`
```
"""Core vault operations."""

```

### Core Architecture Module: `src/hyperresearch/core/citecheck.py`
```
"""Cite-check — does each citation actually support its sentence?

The FACT half of research quality, self-measured before ship instead of by
an external benchmark. Three layers:

1. `extract_pairs(report_text, conn)` — pure parsing. Splits the report into
   sentences and binds each citation marker to its sentence, for BOTH
   citation styles: numbered `[N]` (resolved through the `## Sources`
   section) and `[[note-id]]` wikilinks.

2. `triage_pairs(pairs, conn)` — mechanical tier. A pair auto-passes when
   the sentence's numbers or a long word-overlap window appear in the cited
   note's claims (`quoted_support` / `numbers`) — no LLM needed for the
   bulk. The remainder is marked `needs-llm` for the cite-checker agent.

3. The `hyperresearch-cite-checker` agent (step 14.5) verifies the
   needs-llm tail against the actual note bodies and emits findings the
   patcher applies. Verdicts: supported | partially-supported |
   unsupported | wrong-source.
"""

from __future__ import annotations

import json
import re

from hyperresearch.core.patterns import WIKI_LINK_RE

# Sentence split: period/question/exclamation followed by space+capital, or newline.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z一-鿿])|\n+")
_NUMBERED_CITE_RE = re.compile(r"\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]")
_SOURCES_ENTRY_RE = re.compile(r"^\s*\[(\d{1,3})\]\s+(.+)$")
_NUMBER_RE = re.compile(r"\d[\d,]*\.?\d*%?")

# Sentences carrying these are checked at 100% regardless of sampling.
_STRONG_MARKERS = ("%", "$", "billion", "million", "increase", "decrease", "grew", "fell")


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]


def parse_sources_section(report_text: str, conn) -> dict[str, str | None]:
    """Map `[N]` -> note_id by matching Sources-section URLs/titles to the vault."""
    mapping: dict[str, str | None] = {}
    in_sources = False
    for line in report_text.splitlines():
        if re.match(r"^##\s+(Sources|References)\b", line, re.IGNORECASE):
            in_sources = True
            continue
        if in_sources and line.startswith("## "):
            break
        if not in_sources:
            continue
        m = _SOURCES_ENTRY_RE.match(line)
        if not m:
            continue
        num, rest = m.group(1), m.group(2)
        note_id = None
        url_m = re.search(r"https?://\S+", rest)
        if url_m:
            url = url_m.group(0).rstrip(".,)")
            row = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
            if row:
                note_id = row["note_id"]
        if note_id is None:
            title = rest.split("http")[0].strip(" .–-")
            if title:
                row = conn.execute(
                    "SELECT id FROM notes WHERE title = ? COLLATE NOCASE", (title,)
                ).fetchone()
                if row:
                    note_id = row["id"]
        mapping[num] = note_id
    return mapping


def extract_pairs(report_text: str, conn) -> list[dict]:
    """All (sentence, note_id) citation bindings in the report.

    Pairs whose citation can't be resolved to a vault note get
    note_id=None — those are findings in themselves (dangling citation).
    """
    numbered_map = parse_sources_section(report_text, conn)
    known_ids = {row["id"] for row in conn.execute("SELECT id FROM notes")}

    # Strip the Sources section from the checked body
    body = re.split(r"^##\s+(?:Sources|References)\b", report_text, maxsplit=1, flags=re.M | re.I)[0]

    pairs: list[dict] = []
    for sentence in _split_sentences(body):
        cited: list[str | None] = []
        for m in _NUMBERED_CITE_RE.finditer(sentence):
            for num in re.split(r"\s*,\s*", m.group(1)):
                if num in numbered_map:
                    cited.append(numbered_map[num])
        for m in WIKI_LINK_RE.finditer(sentence):
            target = m.group(1).strip()
            cited.append(target if target in known_ids else None)
        for note_id in cited:
            pairs.append({
                "sentence": sentence,
                "note_id": note_id,
                "numbers": _NUMBER_RE.findall(sentence),
                "strong": any(k in sentence.lower() for k in _STRONG_MARKERS) or bool(_NUMBER_RE.search(sentence)),
            })
    return pairs


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def triage_pairs(pairs: list[dict], conn) -> dict:
    """Mechanical verification tier.

    Verdicts per pair:
      dangling            — citation resolves to no vault note (finding)
      supported-mechanical — sentence numbers / long overlap found in the
                            cited note's claims (auto-pass)
      needs-llm           — the cite-checker agent must judge it
    """
    claims_by_note: dict[str, list[dict]] = {}

    def _claims(note_id: str) -> list[dict]:
        if note_id not in claims_by_note:
            rows = conn.execute(
                "SELECT claim, quoted_support, numbers FROM claims WHERE note_id = ?",
                (note_id,),
            ).fetchall()
            claims_by_note[note_id] = [dict(r) for r in rows]
        return claims_by_note[note_id]

    supported = 0
    dangling = 0
    needs_llm = []
    for pair in pairs:
        if pair["note_id"] is None:
            pair["verdict"] = "dangling"
            dangling += 1
            continue
        matched = False
        note_claims = _claims(pair["note_id"])
        blob = _norm(" ".join(
            (c["claim"] or "") + " " + (c["quoted_support"] or "") + " " + (c["numbers"] or "")
            for c in note_claims
        ))
        if blob:
            nums = [n for n in pair["numbers"] if len(n.replace(",", "")) >= 2]
            if nums and all(n.replace(",", "") in blob.replace(",", "") for n in nums):
                matched = True
            elif not nums:
                # Long word-overlap window: any 6-consecutive-word shingle of the
                # sentence found in the claims blob
                words = _norm(pair["sentence"]).split()
                for i in range(len(words) - 5):
                    if " ".join(words[i : i + 6]) in blob:
                        matched = True
                        break
        if matched:
            pair["verdict"] = "supported-mechanical"
            supported += 1
        else:
            pair["verdict"] = "needs-llm"
            needs_llm.append(pair)

    return {
        "total": len(pairs),
        "supported_mechanical": supported,
        "dangling": dangling,
        "needs_llm": len(needs_llm),
        "pairs": pairs,
    }


def sample_needs_llm(pairs: list[dict], sample_rate: float = 0.6) -> list[dict]:
    """Deterministic sampling of the LLM tier: 100% of strong (number-bearing)
    sentences, `sample_rate` of the rest. No RNG — reproducible across resumes.

    A weak pair is kept whenever floor(seen * rate) steps up, which spreads the
    kept pairs evenly and hits the rate exactly. The old every-k-th rule
    rounded 1/rate, so 0.6 became every 2nd and sampled 50%.
    """
    out = []
    weak_seen = 0
    rate = min(max(sample_rate, 0.0), 1.0)
    for pair in pairs:
        if pair.get("verdict") != "needs-llm":
            continue
        if pair["strong"]:
            out.append(pair)
            continue
        weak_seen += 1
        if int(weak_seen * rate) > int((weak_seen - 1) * rate):
            out.append(pair)
    return out


def write_pairs_file(vault, vault_tag: str, report_path, sample_rate: float = 0.6) -> dict:
    """Extract + triage + sample; write cite-check-pairs.json into the run dir."""
    report_text = report_path.read_text(encoding="utf-8-sig")
    pairs = extract_pairs(report_text, vault.db)
    triaged = triage_pairs(pairs, vault.db)
    to_check = sample_needs_llm(triaged["pairs"], sample_rate)

    run_dir = vault.run_dir(vault_tag)
    run_dir.mkdir(parents=True, exist_ok=True)
    out = {
        "report": str(report_path),
        "summary": {k: v for k, v in triaged.items() if k != "pairs"},
        "sampled_for_llm": to_check,
        "dangling": [p for p in triaged["pairs"] if p["verdict"] == "dangling"],
    }
    (run_dir / "cite-check-pairs.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return out

```

### Core Architecture Module: `src/hyperresearch/core/claims.py`
```
"""Claims persistence — fetcher-extracted claims as queryable DB rows.

Fetchers write `research/runs/<vault_tag>/temp/claims-<note-id>.json` files
during step 2 (and step 13's gap fetch); the legacy flat location
`research/temp/claims-*.json` is still honoured. This module ingests them
into the `claims` (+ `claims_fts`) tables, keyed to their source notes, so
downstream consumers can ask "which source best supports X" as a query
instead of re-parsing JSON files. This is the substrate for phase-5
cite-checking and numeric-consistency lints.

Ingest is idempotent: rows are keyed by (note_id, sha256(claim)[:16]), so
re-running over the same files is a no-op.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

# Claims files are written by agents from fetched (hostile) page content.
# Bound what one file can cost: a size cap before it is read into memory,
# and a per-field cap so one claim cannot bloat a row or the FTS index.
MAX_CLAIMS_FILE_BYTES = 8 * 1024 * 1024
MAX_CLAIM_FIELD_CHARS = 20_000


def _claim_hash(claim: str) -> str:
    return hashlib.sha256(claim.strip().encode("utf-8")).hexdigest()[:16]


def _text_field(value) -> str:
    """Coerce an untrusted claim field to bounded text ('' when absent).

    A claim JSON is agent-written from hostile page content, so a field
    can be any JSON type; sqlite3 refuses to bind lists/dicts and `.strip()`
    on a non-string would abort the whole ingest. Only strings count as
    text — a number, list or dict where prose belongs is dropped.
    """
    if not isinstance(value, str):
        return ""
    return value.strip()[:MAX_CLAIM_FIELD_CHARS]


def _scalar_field(value):
    """Numbers and short strings pass; anything else becomes None."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        return value[:MAX_CLAIM_FIELD_CHARS]
    return None


def _under(path: Path, root: Path) -> bool:
    """True if `path` resolves to `root` or somewhere below it."""
    try:
        path.resolve().relative_to(root.resolve())
    except (ValueError, OSError):
        return False
    return True


def _note_id_from_filename(path: Path) -> str | None:
    """claims-<note-id>.json -> <note-id>."""
    stem = path.stem
    if stem.startswith("claims-"):
        return stem[len("claims-"):]
    return None


def _iter_claim_dicts(data) -> list[dict]:
    """Accept both bare-list files and {claims: [...]} wrappers."""
    if isinstance(data, list):
        return [c for c in data if isinstance(c, dict)]
    if isinstance(data, dict):
        inner = data.get("claims", [])
        if isinstance(inner, list):
            return [c for c in inner if isinstance(c, dict)]
    return []


def ingest_claims_file(conn, path: Path, vault_tag: str | None = None) -> dict:
    """Ingest one claims JSON file. Returns {ingested, skipped, errors}."""
    note_id = _note_id_from_filename(path)
    result = {"file": str(path), "note_id": note_id, "ingested": 0, "skipped": 0, "errors": []}
    if note_id is None:
        result["errors"].append("filename does not match claims-<note-id>.json")
        return result

    note_row = conn.execute("SELECT id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if note_row is None:
        result["errors"].append(f"note '{note_id}' not in vault (sync first?)")
        return result

    try:
        size = path.stat().st_size
    except OSError as e:
        result["errors"].append(f"unreadable JSON: {e}")
        return result
    if size > MAX_CLAIMS_FILE_BYTES:
        result["errors"].append(
            f"claims file is {size} bytes (limit {MAX_CLAIMS_FILE_BYTES}); skipped"
        )
        return result
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError, RecursionError) as e:
        result["errors"].append(f"unreadable JSON: {e}")
        return result

    now = datetime.now(UTC).isoformat()
    for c in _iter_claim_dicts(data):
        claim_text = _text_field(c.get("claim")) or _text_field(c.get("text"))
        if not claim_text:
            result["skipped"] += 1
            continue
        h = _claim_hash(claim_text)
        numbers = c.get("numbers")
        try:
            cur = conn.execute(
                """INSERT OR IGNORE INTO claims
                   (note_id, claim, claim_hash, quoted_support, numbers, confidence,
                    evidence_type, stance_target, stance, vault_tag, ingested_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    note_id,
                    claim_text,
                    h,
                    _text_field(c.get("quoted_support")) or None,
                    json.dumps(numbers)[:MAX_CLAIM_FIELD_CHARS] if numbers else None,
                    _scalar_field(c.get("confidence")),
                    _text_field(c.get("evidence_type")) or None,
                    _text_field(c.get("stance_target")) or None,
                    _text_field(c.get("stance")) or None,
                    vault_tag,
                    now,
                ),
            )
            if cur.rowcount:
                claim_id = cur.lastrowid
                conn.execute(
                    "INSERT INTO claims_fts (claim_id, claim, quoted_support) VALUES (?, ?, ?)",
                    (claim_id, claim_text, _text_field(c.get("quoted_support"))),
                )
                result["ingested"] += 1
            else:
                result["skipped"] += 1
        except sqlite3.Error as e:
            # One malformed claim (agent-written from fetched, hostile page
            # content) must not abort the whole ingest.
            result["errors"].append(f"claim {h} not stored: {e}")
            result["skipped"] += 1
    return result


def _glob_claims(directory: Path) -> list[Path]:
    return sorted(directory.glob("claims-*.json")) if directory.is_dir() else []


def default_claims_dirs(vault, vault_tag: str | None = None) -> list[Path]:
    """Directories a default (no explicit `temp_dir`) ingest scans.

    With a `vault_tag` whose run workspace exists, exactly that run's
    `research/runs/<vault_tag>/temp/`. Otherwise the union of the legacy
    flat `research/temp/` and every `research/runs/*/temp/` — the fetcher
    contract writes claims into the run workspace, so a scan limited to
    the flat directory sees nothing in a real run.
    """
    research = vault.root / "research"
    runs = research / "runs"
    if vault_tag:
        # `vault_tag` is a CLI argument (an agent may have been talked into
        # it): a tag like `../../..` or an absolute path must not point the
        # scan outside research/runs/. Only a tag that resolves under the
        # runs directory narrows the scan; anything else falls through to
        # the default union.
        run_temp = runs / vault_tag / "temp"
        if _under(run_temp, runs) and run_temp.is_dir():
            return [run_temp]
    dirs = [research / "temp"]
    if runs.is_dir():
        dirs.extend(sorted(d / "temp" for d in runs.iterdir() if d.is_dir()))
    return dirs


def discover_claims_files(vault, vault_tag: str | None = None) -> list[Path]:
    """Every claims-*.json a default ingest would read, deduplicated by
    resolved path and sorted. Files that resolve outside the vault (a
    symlink planted in a run workspace) are skipped."""
    seen: set[Path] = set()
    files: list[Path] = []
    for d in default_claims_dirs(vault, vault_tag):
        for f in _glob_claims(d):
            if not _under(f, vault.root):
                continue
            key = f.resolve()
            if key in seen:
                continue
            seen.add(key)
            files.append(f)
    return sorted(files)


def ingest_claims_dir(vault, temp_dir: Path | None = None, vault_tag: str | None = None) -> dict:
    """Ingest claims-*.json files. Returns a summary.

    `temp_dir` given: scan exactly that directory (no recursion). Otherwise
    scan `default_claims_dirs(vault, vault_tag)` — the run workspace for
    `vault_tag` when it exists, else legacy `research/temp/` plus every
    `research/runs/*/temp/`. `vault_tag` is also stamped on every row.
    """
    conn = vault.db
    if temp_dir is None:
        scanned = default_claims_dirs(vault, vault_tag)
        files = discover_claims_files(vault, vault_tag)
    else:
        scanned = [temp_dir]
        files = _glob_claims(temp_dir)
    summary = {
        "files": len(files),
        "ingested": 0,
        "skipped": 0,
        "errors": [],
        "scanned": [str(d) for d in scanned],
    }
    if not files:
        summary["hint"] = (
            "no claims-*.json found under "
            + ", ".join(summary["scanned"])
            + "; fetchers write research/runs/<vault_tag>/temp/claims-<note-id>.json "
            "-- pass --tag <vault_tag> or the files explicitly"
        )
    for f in files:
        r = ingest_claims_file(conn, f, vault_tag)
        summary["ingested"] += r["ingested"]
        summary["skipped"] += r["skipped"]
        for e in r["errors"]:
            summary["errors"].append(f"{f.name}: {e}")
    conn.commit()
    return summary


def search_claims(conn, query: str, limit: int = 20) -> list[dict]:
    """FTS search over claims + quoted support."""
    rows = conn.execute(
        """SELECT c.id, c.note_id, c.claim, c.quoted_support, c.numbers,
                  c.confidence, c.evidence_type, c.stance_target, c.stance, c.vault_tag
           FROM claims_fts f JOIN claims c ON c.id = f.claim_id
           WHERE claims_fts MATCH ?
           ORDER BY rank LIMIT ?""",
        (query, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def list_claims(
    conn,
    note_id: str | None = None,
    vault_tag: str | None = None,
```

### Core Architecture Module: `src/hyperresearch/core/codex.py`
```
"""OpenAI Codex translation layer — agent TOML, skill metadata, Stop hook, stop gate.

The pipeline's subagent prompts are written once, as Claude Code markdown
agents (YAML frontmatter + body) in core/hooks.py. Codex wants custom agents
as TOML (`.codex/agents/<name>.toml`) with `name`, `description`, and
`developer_instructions`, and has no per-agent tool allowlist, no Task tool,
and no Read/Write/Edit tools. This module converts one to the other:

    frontmatter name / description  -> TOML name / description (one line)
    frontmatter model               -> model_reasoning_effort ("high" for
                                       opus-class roles, else "medium"); a
                                       `model` key only when the profile sets
                                       a `codex_models` override for the role
    frontmatter tools               -> a preamble prepended to the body that
                                       maps the tool vocabulary and turns the
                                       tool lock into instruction discipline
    body                            -> developer_instructions

It also owns the Codex Stop hook (`.codex/hooks.json`) and the decision
logic behind `hyperresearch run stop-gate`, which keeps a Codex session from
ending while the newest run is mid-pipeline — Codex's documented failure mode
on this pipeline is answering the question inline and skipping the steps.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

import yaml

# ---------------------------------------------------------------------------
# TOML string encoding. No TOML writer is a dependency, and every value we
# emit is a string — short scalars plus one long prompt body.
# ---------------------------------------------------------------------------

_BASIC_ESCAPES = {
    "\\": "\\\\",
    '"': '\\"',
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
}

# Control characters a TOML literal string may not contain (tab is allowed;
# newlines are allowed only inside multi-line strings, handled separately).
_LITERAL_FORBIDDEN = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


def toml_basic_string(value: str) -> str:
    """Encode `value` as a single-line TOML basic string ("...")."""
    out: list[str] = []
    for ch in value:
        if ch in _BASIC_ESCAPES:
            out.append(_BASIC_ESCAPES[ch])
        elif ord(ch) < 0x20 or ord(ch) == 0x7F:
            out.append(f"\\u{ord(ch):04X}")
        else:
            out.append(ch)
    return '"' + "".join(out) + '"'


def toml_text_block(value: str) -> str:
    """Encode a long body as a TOML string that round-trips exactly.

    Prefers a multi-line literal string (`'''` + newline + body + `'''`) —
    readable, no escaping, and the newline right after the opening delimiter
    is trimmed by the parser. Falls back to an escaped basic string when the
    body contains `'''`, ends in a quote (which would merge into the closing
    delimiter), or carries a control character a literal string cannot hold.
    """
    # Carriage returns force the basic string too: parsers normalize CRLF
    # inside multi-line strings, which would break the exact round trip.
    literal_ok = (
        "'''" not in value
        and not value.endswith("'")
        and not _LITERAL_FORBIDDEN.search(value)
    )
    if literal_ok:
        return "'''\n" + value + "'''"
    return toml_basic_string(value)


# ---------------------------------------------------------------------------
# Markdown agent -> Codex TOML
# ---------------------------------------------------------------------------


def split_frontmatter(text: str) -> tuple[dict, str]:
    """Split a markdown agent file into (frontmatter dict, body)."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    meta = yaml.safe_load(text[3:end]) or {}
    rest = text[end + 4 :]
    # Drop the remainder of the closing-delimiter line.
    newline = rest.find("\n")
    body = rest[newline + 1 :] if newline != -1 else ""
    return (meta if isinstance(meta, dict) else {}), body


def parse_tools(value) -> list[str]:
    """Frontmatter `tools:` (comma string or YAML list) -> tool names."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(t).strip() for t in value if str(t).strip()]
    return [t.strip() for t in str(value).split(",") if t.strip()]


def reasoning_effort_for(claude_model: str | None) -> str:
    """Roles Claude runs on an opus-class model get high effort on Codex."""
    return "high" if claude_model and "opus" in claude_model.lower() else "medium"


# Codex renderings of the Claude tool vocabulary. Every agent gets these.
_TOOL_MAP = """\
## Codex runtime notes (read first — these override conflicting tool wording below)

You are running as an OpenAI Codex custom agent. The instructions below were
written for Claude Code; translate their tool vocabulary as follows:

- **Read** a file -> read it with the shell (`cat`, `sed -n '1,200p' <file>`,
  or `Get-Content` on Windows). Read long files in chunks; do not skip parts
  you were told to read in full.
- **Write** a new file / **Edit** an existing file -> use `apply_patch`.
- **Bash** -> the shell tool.
- **Task** / **Skill** tools do not exist here. You cannot spawn subagents.
- Never use a browsing tool for source pages; fetch them with the
  hyperresearch CLI (`... fetch "<url>" -j`), exactly as spelled below.
"""

def _tool_discipline(tools: list[str]) -> list[str]:
    """Instruction-level rules that stand in for the Claude tool allowlist.

    Codex has no per-agent tool allowlist, so the lock a Claude agent gets
    from its `tools:` line becomes discipline stated in the prompt.
    """
    have = set(tools)
    rules: list[str] = []
    if tools:
        rules.append(
            f"- Your role is limited to these capabilities: {', '.join(tools)}. "
            "Codex cannot enforce that list, so you must."
        )
    if "Bash" not in have:
        rules.append(
            "- You have no general shell access in this role. The ONLY shell "
            "commands you may run are read-only file reads (`cat`, `sed -n`, "
            "`Get-Content`). Do not run the hyperresearch CLI, scripts, or any "
            "command that changes state."
        )
    if "Edit" in have and "Write" not in have:
        rules.append(
            "- You may ONLY make surgical `apply_patch` update hunks to the files "
            "your task names (the report and its pre-stubbed log). Never create, "
            "delete, rename, or wholesale rewrite a file — replacing a whole "
            "file is regeneration, which this role forbids."
        )
    if "Write" in have and "Edit" not in have:
        rules.append(
            "- You may create or overwrite only the output files your task "
            "names (plus whatever the hyperresearch CLI writes for you). Never "
            "hand-edit a file another stage owns — in particular, never patch a "
            "report or draft you were given as input."
        )
    if "Task" in have:
        rules.append(
            "- Wherever the instructions below tell you to delegate fetching to "
            "`hyperresearch-fetcher` subagents via the Task tool, or tell you NOT "
            "to call `fetch` yourself: that does not apply on Codex. Subagent "
            "spawning is unavailable to you. Run the hyperresearch CLI's `fetch` "
            "(one URL) or `fetch-batch` (many URLs) yourself, with the same tags "
            "and run tag the spawn would have passed, then do the fetcher's job "
            "on each new note: read it, fill in its summary and tags, and chase "
            "primary sources within your source budget."
        )
    if "WebSearch" in have:
        rules.append(
            "- **WebSearch** -> Codex's built-in web search tool when it is "
            "enabled; if it is not, use the hyperresearch CLI's `scholar search` "
            "and fetch candidate URLs directly."
        )
    if "ToolSearch" in have:
        rules.append("- ToolSearch has no Codex equivalent; ignore steps that depend on it.")
    return rules


# Per-agent additions beyond what the `tools:` line implies.
CODEX_AGENT_NOTES: dict[str, str] = {
    "hyperresearch-patcher": (
        "- The patch log was pre-stubbed by the orchestrator because this role "
        "cannot create files. Append to it with `apply_patch`; do not recreate it."
    ),
    "hyperresearch-polish-auditor": (
        "- The polish log was pre-stubbed by the orchestrator because this role "
        "cannot create files. Append to it with `apply_patch`; do not recreate it."
    ),
    "hyperresearch-synthesizer": (
        "- Write the final report as a fresh file with `apply_patch` (an "
        "`*** Add File` or full replacement hunk). Do not graft sections from "
        "the drafts by editing them in place."
    ),
    "hyperresearch-readability-recommender": (
        "- Your only output is the recommendations JSON file. The orchestrator "
        "applies recommendations; you never touch the report."
    ),
    "hyperresearch-depth-investigator": (
        "- You are a leaf agent on Codex: finish your locus with your own "
        "fetches and reads, then write the interim note."
    ),
}


def codex_agent_preamble(name: str, tools: list[str]) -> str:
    """Build the Codex preamble prepended to one agent's developer_instructions."""
    rules = _tool_discipline(tools)
    note = CODEX_AGENT_NOTES.get(name)
    if note:
        rules.append(note)
    parts = [_TOOL_MAP.rstrip("\n")]
    if rules:
        parts.append("\n### Discipline for this role\n\n" + "\n".join(rules))
    return "\n".join(parts) + "\n\n---\n\n"


def agent_markdown_to_toml(
    rendered: str,
    *,
    header_comment: str,
    codex_model: str | None = None,
) -> str:
    """Translate
```

### Core Architecture Module: `src/hyperresearch/core/config.py`
```
"""Vault configuration management (.hyperresearch/config.toml)."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field, fields
from pathlib import Path


@dataclass(frozen=True)
class FetchSettings:
    """Network/browser behavior for web fetching ([fetch] section)."""

    page_timeout_ms: int = 30000
    pdf_timeout_s: int = 30
    # NOTE: default True is a deliberate 2.0 change — the pre-2.0 code silently
    # disabled TLS verification for PDF downloads. Set to false only for
    # cert-broken mirrors you explicitly trust.
    pdf_verify_tls: bool = True
    # TLS verification for the crawl4ai headless browser lane (#137). Default
    # on; set false only for cert-broken sites you explicitly trust. The
    # visible-window lane (profile + visible browser) still ignores
    # certificate errors regardless of this setting.
    browser_verify_tls: bool = True
    min_pdf_bytes: int = 100
    # Response-size caps enforced by the SSRF gate (web/safe_http.py).
    # Defaults mirror the MAX_BYTES_* constants there.
    max_html_bytes: int = 10 * 1024 * 1024
    max_pdf_bytes: int = 25 * 1024 * 1024
    max_image_bytes: int = 2 * 1024 * 1024
    # SSRF-gate escape hatch: hostnames (exact, case-insensitive) or IP
    # networks in CIDR form ("10.8.0.0/16", "192.168.1.20") that may be
    # fetched even though they resolve to private/reserved addresses —
    # for self-hosted mirrors and intranet sources. Empty by default:
    # adding an entry is an explicit act by someone who controls the
    # address space.
    allow_private_hosts: tuple[str, ...] = ()
    # Smart-wait DOM-stability loop (shared by headless and visible paths)
    wait_initial_ms: int = 2000
    poll_interval_ms: int = 500
    stable_checks: int = 2
    max_checks: int = 16
    image_timeout_s: int = 15
    # Sites that kill headless sessions on first contact → auto-visible browser
    visible_browser_domains: tuple[str, ...] = (
        "linkedin.com", "twitter.com", "x.com", "facebook.com",
        "instagram.com", "tiktok.com",
    )


@dataclass(frozen=True)
class JunkGates:
    """Thresholds for the junk/login-wall content gates ([junk] section)."""

    min_content_chars: int = 300
    login_wall_max_chars: int = 1000
    cookie_wall_max_chars: int = 1500
    binary_garbage_ratio: float = 0.05
    sample_window: int = 2000
    login_sample_chars: int = 500
    # Appended to the built-in signal lists — never replacing them
    extra_login_signals: tuple[str, ...] = ()
    extra_junk_signals: tuple[str, ...] = ()


@dataclass(frozen=True)
class AssetSettings:
    """Screenshot/image saving behavior ([assets] section)."""

    max_images: int = 5
    min_image_bytes: int = 50_000


@dataclass(frozen=True)
class DedupSettings:
    """Near-duplicate detection parameters ([dedup] section)."""

    shingle_size: int = 3
    minhash_perm: int = 128
    lsh_bands: int = 16
    lsh_switchover: int = 200
    default_threshold: float = 0.6


@dataclass(frozen=True)
class ChromeSettings:
    """Browser-lane escalation behavior ([chrome] section).

    The Chrome lane drives the user's real browser (via Claude-in-Chrome)
    for sources headless crawling can't reach. `enabled` gates ENQUEUEING
    of blocked fetches; draining requires the Claude-in-Chrome extension.
    Hard scope boundary: CAPTCHAs/2FA/logins are ALWAYS handed to the human
    (`needs_human`) — never solved automatically.
    """

    enabled: bool = True
    # Blocked URLs below this utility score are abandoned, not escalated —
    # the lane is serial and precious. None-scored URLs are escalated.
    escalation_utility_threshold: float = 8.0
    max_items_per_run: int = 25
    drain_batch_size: int = 10
    scholar_enabled: bool = True


@dataclass(frozen=True)
class RankingSettings:
    """Composite source-quality scoring weights ([ranking] section).

    quality = renormalized weighted sum of the available components
    (tier weight, utility/18, authority percentile, vault centrality).
    Missing components renormalize rather than zeroing. Retracted sources
    are floored at `retraction_floor` regardless of other components.
    """

    w_tier: float = 0.35
    w_utility: float = 0.20
    w_authority: float = 0.25
    w_centrality: float = 0.20
    tier_ground_truth: float = 1.0
    tier_institutional: float = 0.85
    tier_practitioner: float = 0.7
    tier_commentary: float = 0.4
    tier_unknown: float = 0.6
    retraction_floor: float = 0.05
    api_cache_ttl_days: int = 30

    def tier_weight(self, tier: str | None) -> float | None:
        if tier is None:
            return None
        return {
            "ground_truth": self.tier_ground_truth,
            "institutional": self.tier_institutional,
            "practitioner": self.tier_practitioner,
            "commentary": self.tier_commentary,
            "unknown": self.tier_unknown,
        }.get(tier)


@dataclass(frozen=True)
class EmbeddingSettings:
    """Semantic-search embedding provider ([embeddings] section).

    provider "none" (default) disables semantic search entirely — no API key
    needed for any core functionality. "voyage" and "openai" call the
    respective APIs (VOYAGE_API_KEY / OPENAI_API_KEY env vars).
    """

    provider: str = "none"  # none | voyage | openai
    model: str = ""  # provider default when empty
    # How much of each note to embed: title + summary + first N body chars
    body_chars: int = 1500


@dataclass(frozen=True)
class LintSettings:
    """Lint rule thresholds ([lint] section)."""

    extract_min_words: int = 150
    extract_coverage_divisor: int = 3
    stale_review_days: int = 90


@dataclass(frozen=True)
class ScholarSettings:
    """Open-access full-text recovery ([scholar] section).

    When a fetch lands a thin page that carries a DOI — a publisher abstract or
    paywall interstitial — `core/oa.py` asks Unpaywall, Europe PMC and CORE, in
    that order, for a legal open-access copy and stores THAT text in the note
    body instead. The swap is always disclosed: a banner at the top of the
    body, four `oa_*` frontmatter fields, and a line in the fetch output.

    `contact_email` is required by Unpaywall's terms of use. Leave it empty and
    Unpaywall is skipped entirely; Europe PMC needs no key, so biomedical
    recovery still works out of the box. CORE is the broad net that catches
    everything outside biomedicine — it hosts full text directly rather than
    linking to it — and activates when the `CORE_API_KEY` environment variable
    is set. The key lives in the environment rather than here so it can never
    be committed with a vault.
    """

    oa_recovery: bool = True
    contact_email: str = ""
    # A real paper body runs 20-80k chars; an abstract landing page runs 1-3k.
    oa_min_full_text_chars: int = 6000
    # Prefer the version of record over accepted manuscripts and preprints.
    oa_prefer_published: bool = True
    # Publishers 403 their own open-access PDFs often enough that one attempt
    # loses papers sitting in a repository two candidates down.
    oa_max_attempts: int = 3
    # Also try when the source cannot be read AT ALL (403, login wall, bot
    # wall). Separately switchable because such a note is made entirely of the
    # open-access copy — nothing in it came from the URL that was asked for.
    oa_rescue_blocked: bool = True


def _build_section(section_cls, data: dict):
    """Build a frozen settings dataclass from a TOML section dict.

    Unknown keys are ignored (forward compatibility); TOML arrays are converted
    to tuples for tuple-typed fields.
    """
    kwargs = {}
    for f in fields(section_cls):
        if f.name not in data:
            continue
        value = data[f.name]
        if isinstance(value, list):
            value = tuple(value)
        kwargs[f.name] = value
    return section_cls(**kwargs)


@dataclass
class VaultConfig:
    name: str = "Research Base"
    default_status: str = "draft"
    research_dir: str = "research"

    # Search ranking
    search_title_weight: float = 10.0
    search_body_weight: float = 1.0
    search_tags_weight: float = 5.0
    search_aliases_weight: float = 3.0
    search_boost_evergreen: float = 1.5
    search_penalize_deprecated: float = 0.3
    search_penalize_stale: float = 0.7
    # Search output defaults
    search_default_limit: int = 20
    search_chars_per_token: int = 4
    search_snippet_len: int = 200

    # Sync
    auto_sync: bool = True
    exclude_patterns: list[str] = field(
        default_factory=lambda: [
            ".hyperresearch/*", "exports/*", ".git/*", ".venv/*", "node_modules/*", "templates/*",
            "CLAUDE.md", "AGENTS.md", "agents.md", "GEMINI.md", "README.md", "CHANGELOG.md",
        ]
    )

    # Web provider
    web_provider: str = "builtin"
    web_profile: str = ""  # crawl4ai browser profile name (created via `crwl profiles`)
    web_magic: bool = False  # crawl4ai magic mode (anti-bot stealth)

    # Pipeline scale gear ([pipeline] section) — the profile whose numbers are
    # rendered into installed skills/agents. Set via `hpr profile use <name>`.
    pipeline_profile: str = "full"
    # Raw [profile.<name>] overlay tables, round-tripped verbatim on save()
    # so that saving config never destroys user-defined profiles.
    profile_overlays: dict = field(default_factory=dict)

    # Behavior settings sections
    fetch: FetchSettings = field(default_factory=FetchSettings)
    junk: JunkGates = field(default_factory=JunkGates)
    assets: AssetSettings = field(default_factory=AssetSettings)
    dedup: DedupSettings = field(default_factory=DedupSettings)
    lint: LintSettings = field(default_factory=LintSettings)
    ranking: RankingSettings = field(default_factory=RankingSettings)
    embeddings: EmbeddingSettings = field(default_factory=EmbeddingSettings)
    chrome: ChromeSettings = field(default_factory=ChromeSettings)
    scholar: ScholarSettings = field(default_facto
```

### Core Architecture Module: `src/hyperresearch/core/db.py`
```
"""SQLite database management — schema, connection, migrations."""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 13

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS _meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    path         TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','review','evergreen','stale','deprecated','archive')),
    type         TEXT NOT NULL DEFAULT 'note'
                     CHECK (type IN ('note','raw','index','moc','interim','source-analysis')),
    tier         TEXT
                     CHECK (tier IS NULL OR tier IN ('ground_truth','institutional','practitioner','commentary','unknown')),
    content_type TEXT
                     CHECK (content_type IS NULL OR content_type IN ('paper','docs','article','blog','forum','dataset','policy','code','book','transcript','review','unknown')),
    source       TEXT,
    parent       TEXT,
    deprecated   INTEGER NOT NULL DEFAULT 0,
    reviewed     TEXT,
    expires      TEXT,
    word_count   INTEGER NOT NULL DEFAULT 0,
    summary      TEXT,
    created      TEXT NOT NULL,
    updated      TEXT,
    file_mtime   REAL NOT NULL,
    content_hash TEXT NOT NULL,
    synced_at    TEXT NOT NULL,
    -- Source-ranking columns (v9). Frontmatter-mirrored: doi, utility_score,
    -- citation_count, venue, is_retracted. Derived (DB-cache only, recomputed):
    -- authority_score, centrality_score, independence, quality_score.
    doi              TEXT,
    utility_score    REAL,
    authority_score  REAL,
    centrality_score REAL,
    independence     REAL,
    citation_count   INTEGER,
    venue            TEXT,
    is_retracted     INTEGER,
    quality_score    REAL,
    -- Open-access recovery (v11). When oa_url is set, the note BODY came from
    -- there and NOT from `source` — see core/oa.py. Frontmatter-mirrored.
    oa_url           TEXT,
    oa_source        TEXT,
    oa_version       TEXT,
    oa_license       TEXT,
    -- v12. substituted = a thin page was replaced; rescued = the source was
    -- never read at all and the whole note is the open-access copy.
    oa_recovery_kind TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated);
CREATE INDEX IF NOT EXISTS idx_notes_word_count ON notes(word_count);
CREATE INDEX IF NOT EXISTS idx_notes_status_type ON notes(status, type);
CREATE INDEX IF NOT EXISTS idx_notes_parent_status ON notes(parent, status);

CREATE TABLE IF NOT EXISTS note_content (
    note_id    TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    body_plain TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag     TEXT NOT NULL,
    PRIMARY KEY (note_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

CREATE TABLE IF NOT EXISTS aliases (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    alias   TEXT NOT NULL,
    PRIMARY KEY (note_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_aliases_alias ON aliases(alias COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS links (
    source_id   TEXT NOT NULL,
    target_ref  TEXT NOT NULL,
    target_id   TEXT,
    line_number INTEGER NOT NULL DEFAULT 0,
    context     TEXT,
    PRIMARY KEY (source_id, target_ref, line_number)
);

CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);

CREATE TABLE IF NOT EXISTS embeddings (
    note_id    TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
    model      TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    vector     BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id        TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    claim          TEXT NOT NULL,
    claim_hash     TEXT NOT NULL,
    quoted_support TEXT,
    numbers        TEXT,
    confidence     TEXT,
    evidence_type  TEXT,
    stance_target  TEXT,
    stance         TEXT,
    vault_tag      TEXT,
    ingested_at    TEXT NOT NULL,
    UNIQUE (note_id, claim_hash)
);

CREATE INDEX IF NOT EXISTS idx_claims_note ON claims(note_id);
CREATE INDEX IF NOT EXISTS idx_claims_vault_tag ON claims(vault_tag);
CREATE INDEX IF NOT EXISTS idx_claims_stance_target ON claims(stance_target);

CREATE TABLE IF NOT EXISTS api_cache (
    url        TEXT PRIMARY KEY,
    body       TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escalations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    url           TEXT NOT NULL,
    reason        TEXT NOT NULL
                      CHECK (reason IN ('login_wall','bot_block','captcha','fetch_failed','interactive_needed','scholar_search')),
    requested_by  TEXT,
    suggested_by  TEXT,
    utility_score REAL,
    vault_tag     TEXT,
    status        TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','in_progress','fetched','needs_human','abandoned')),
    attempts      INTEGER NOT NULL DEFAULT 0,
    note_id       TEXT,
    claimed_by    TEXT,
    detail        TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE (url, vault_tag)
);

CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_tag ON escalations(vault_tag);

CREATE TABLE IF NOT EXISTS tag_aliases (
    alias     TEXT PRIMARY KEY,
    canonical TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
    url          TEXT PRIMARY KEY,
    note_id      TEXT REFERENCES notes(id) ON DELETE SET NULL,
    domain       TEXT,
    fetched_at   TEXT,
    provider     TEXT,
    content_hash TEXT,
    status       TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'dead', 'redirected'))
);

CREATE INDEX IF NOT EXISTS idx_sources_domain ON sources(domain);
CREATE INDEX IF NOT EXISTS idx_sources_note ON sources(note_id);

CREATE TABLE IF NOT EXISTS assets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id      TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN ('image', 'screenshot', 'pdf', 'other')),
    filename     TEXT NOT NULL,
    url          TEXT,
    alt_text     TEXT,
    content_type TEXT,
    size_bytes   INTEGER,
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_note ON assets(note_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);

"""

FTS_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    body_plain,
    tags,
    aliases,
    tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS claims_fts USING fts5(
    claim_id UNINDEXED,
    claim,
    quoted_support,
    tokenize='porter unicode61'
);
"""

# Indexes on columns added by migrations — must run AFTER migrate() so that
# existing DBs have had the columns added by ALTER TABLE before we index them.
POST_MIGRATE_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_notes_tier ON notes(tier);
CREATE INDEX IF NOT EXISTS idx_notes_content_type ON notes(content_type);
CREATE INDEX IF NOT EXISTS idx_notes_doi ON notes(doi);
CREATE INDEX IF NOT EXISTS idx_notes_quality ON notes(quality_score);
"""


def get_connection(db_path: Path) -> sqlite3.Connection:
    """Open a SQLite connection with WAL mode and FK enforcement."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    """Create all tables if they don't exist, then run pending migrations."""
    conn.executescript(SCHEMA_SQL)
    conn.executescript(FTS_SQL)
    conn.execute(
        "INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', ?)",
        (str(SCHEMA_VERSION),),
    )
    conn.commit()

    # Run any pending migrations (may ALTER TABLE to add new columns)
    from hyperresearch.core.migrations import migrate
    migrate(conn, SCHEMA_VERSION)

    # Indexes that depend on migration-added columns run last
    conn.executescript(POST_MIGRATE_INDEXES_SQL)
    conn.commit()

```

### Core Architecture Module: `src/hyperresearch/core/embed.py`
```
"""Semantic search — embeddings over vault notes (revives the dormant table).

Provider-pluggable via `[embeddings] provider`:

    none    (default) semantic search disabled; zero API keys required
    voyage  Voyage AI  (VOYAGE_API_KEY, default model voyage-3-lite)
    openai  OpenAI     (OPENAI_API_KEY, default model text-embedding-3-small)

Each note is embedded from title + summary + the first `body_chars` of body.
Vectors are float32 BLOBs in the `embeddings` table; query time is brute-force
cosine (fine to ~50k notes — no vector-DB dependency).

All HTTP goes through `_http_embed`, monkeypatched in tests — the suite never
calls a paid API.
"""

from __future__ import annotations

import struct
from datetime import UTC, datetime

from hyperresearch.search.filters import SearchFilters

DEFAULT_MODELS = {
    "voyage": "voyage-3-lite",
    "openai": "text-embedding-3-small",
}


class EmbeddingError(Exception):
    pass


def _pack(vector: list[float]) -> bytes:
    return struct.pack(f"<{len(vector)}f", *vector)


def _unpack(blob: bytes) -> list[float]:
    n = len(blob) // 4
    return list(struct.unpack(f"<{n}f", blob))


def cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _http_embed(provider: str, model: str, texts: list[str]) -> list[list[float]]:
    """Call the provider's embedding API for a batch of texts.

    Isolated for test monkeypatching. Raises EmbeddingError on failure.
    """
    import os

    import httpx

    try:
        if provider == "voyage":
            key = os.environ.get("VOYAGE_API_KEY")
            if not key:
                raise EmbeddingError("VOYAGE_API_KEY not set")
            resp = httpx.post(
                "https://api.voyageai.com/v1/embeddings",
                json={"input": texts, "model": model},
                headers={"Authorization": f"Bearer {key}"},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            return [d["embedding"] for d in data]
        if provider == "openai":
            key = os.environ.get("OPENAI_API_KEY")
            if not key:
                raise EmbeddingError("OPENAI_API_KEY not set")
            resp = httpx.post(
                "https://api.openai.com/v1/embeddings",
                json={"input": texts, "model": model},
                headers={"Authorization": f"Bearer {key}"},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            return [d["embedding"] for d in data]
    except EmbeddingError:
        raise
    except Exception as e:
        raise EmbeddingError(f"embedding request failed: {e}") from e
    raise EmbeddingError(f"unknown embeddings provider '{provider}'")


def _note_text(row, body_chars: int) -> str:
    parts = [row["title"] or ""]
    if row["summary"]:
        parts.append(row["summary"])
    body = row["body_plain"] or ""
    if body:
        parts.append(body[:body_chars])
    return "\n".join(parts)


def embed_sync(vault, batch_size: int = 32) -> dict:
    """Embed new/changed notes. Returns {embedded, skipped, provider, model}.

    A note needs (re)embedding when it has no vector or its content_hash
    changed since the vector was written (tracked via embeddings.created_at
    vs notes.synced_at is unreliable — we store the content_hash in the
    `model` field suffix instead: "<model>@<hash>").
    """
    cfg = vault.config.embeddings
    if cfg.provider == "none":
        raise EmbeddingError(
            "embeddings disabled: set [embeddings] provider = \"voyage\" or "
            "\"openai\" in .hyperresearch/config.toml"
        )
    model = cfg.model or DEFAULT_MODELS.get(cfg.provider, "")
    conn = vault.db

    rows = conn.execute(
        """SELECT n.id, n.title, n.summary, n.content_hash, nc.body_plain,
                  e.model AS embedded_model
           FROM notes n
           JOIN note_content nc ON nc.note_id = n.id
           LEFT JOIN embeddings e ON e.note_id = n.id
           WHERE n.type NOT IN ('index')"""
    ).fetchall()

    todo = []
    for row in rows:
        stamp = f"{model}@{row['content_hash']}"
        if row["embedded_model"] != stamp:
            todo.append((row, stamp))

    embedded = 0
    now = datetime.now(UTC).isoformat()
    for i in range(0, len(todo), batch_size):
        batch = todo[i : i + batch_size]
        texts = [_note_text(row, cfg.body_chars) for row, _ in batch]
        vectors = _http_embed(cfg.provider, model, texts)
        if len(vectors) != len(batch):
            raise EmbeddingError("provider returned wrong number of vectors")
        for (row, stamp), vec in zip(batch, vectors, strict=True):
            conn.execute(
                """INSERT OR REPLACE INTO embeddings
                   (note_id, model, dimensions, vector, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (row["id"], stamp, len(vec), _pack(vec), now),
            )
            embedded += 1
        conn.commit()

    return {
        "embedded": embedded,
        "skipped": len(rows) - len(todo),
        "provider": cfg.provider,
        "model": model,
    }


def semantic_search(
    vault, query: str, limit: int = 20, *, filters: SearchFilters | None = None,
) -> list[dict]:
    """Brute-force cosine search. Returns [{id, score}] best-first."""
    cfg = vault.config.embeddings
    if cfg.provider == "none":
        raise EmbeddingError(
            "embeddings disabled: set [embeddings] provider in config.toml"
        )
    model = cfg.model or DEFAULT_MODELS.get(cfg.provider, "")
    [query_vec] = _http_embed(cfg.provider, model, [query])

    conn = vault.db
    results = []
    where, params = filters.to_sql("n") if filters else ("1=1", [])
    rows = conn.execute(
        f"SELECT e.note_id, e.vector FROM embeddings e JOIN notes n ON n.id = e.note_id "
        f"WHERE n.type != 'index' AND {where}", params,
    ).fetchall()
    for row in rows:
        score = cosine(query_vec, _unpack(row["vector"]))
        results.append({"id": row["note_id"], "score": score})
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]],
    k: int = 60,
) -> list[tuple[str, float]]:
    """RRF-combine multiple ranked id lists (hybrid FTS + semantic search)."""
    scores: dict[str, float] = {}
    for lst in ranked_lists:
        for rank, note_id in enumerate(lst):
            scores[note_id] = scores.get(note_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)

```

### Core Architecture Module: `src/hyperresearch/core/enrich.py`
```
"""Auto-enrichment: keyword-based tagging, summary extraction, and note enrichment."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path


def auto_tag(body_plain: str, existing_tags: list[dict]) -> list[str]:
    """Suggest tags for a note based on keyword matching against existing tag vocabulary.

    Args:
        body_plain: Stripped plain text of the note body.
        existing_tags: List of {"tag": str, "count": int} from the vault.

    Returns:
        List of suggested tag strings (max 5).
    """
    if not body_plain or not existing_tags:
        return []

    body_lower = body_plain.lower()
    words = set(body_lower.split())

    scored = []
    for entry in existing_tags:
        tag = entry["tag"]
        count = entry["count"]
        # Check if tag (or hyphenated parts) appear in body
        tag_words = set(tag.replace("-", " ").split())
        matches = tag_words & words
        if matches:
            # Score: fraction of tag words found * log popularity
            import math
            frac = len(matches) / len(tag_words)
            score = frac * (1 + math.log(max(count, 1)))
            scored.append((tag, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [tag for tag, _ in scored[:5]]


def auto_summary(body: str) -> str | None:
    """Extract a summary from the first meaningful line of the body.

    Skips headings, blank lines, and very short lines. Truncates to 120 chars.
    """
    for line in body.split("\n"):
        stripped = line.strip()
        # Skip headings, blank lines, short lines, frontmatter markers
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith("---"):
            continue
        if stripped.startswith("*Stub"):
            continue
        if len(stripped) < 25:
            continue
        # Strip markdown formatting
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", stripped)
        clean = re.sub(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", r"\1", clean)
        clean = re.sub(r"[*_`]", "", clean)
        clean = clean.strip()
        if len(clean) < 25:
            continue
        if len(clean) > 120:
            return clean[:117] + "..."
        return clean
    return None


def enrich_note_file(note_path: Path, conn: sqlite3.Connection, user_tags: list[str]) -> bool:
    """Auto-enrich a note file with tags and summary. Rewrites frontmatter in place.

    Called after write_note() but before sync. Returns True if the file was modified.
    """
    from hyperresearch.core.frontmatter import parse_frontmatter, serialize_frontmatter

    content = note_path.read_text(encoding="utf-8-sig")
    meta, body = parse_frontmatter(content)

    changed = False

    # Auto-tag: merge user tags with auto-suggested tags (cap at 8 total)
    tag_vocab = [
        {"tag": row["tag"], "count": row["c"]}
        for row in conn.execute("SELECT tag, COUNT(*) as c FROM tags GROUP BY tag ORDER BY c DESC")
    ]
    body_plain = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)  # strip markdown links
    body_plain = re.sub(r"[*_`#]", "", body_plain)
    suggested = auto_tag(body_plain, tag_vocab)
    merged = list(dict.fromkeys(user_tags + suggested))[:8]
    if set(merged) != set(meta.tags):
        meta.tags = merged
        changed = True

    # Auto-summary: only if not already set
    if not meta.summary:
        summary = auto_summary(body)
        if summary:
            meta.summary = summary
            changed = True

    if changed:
        note_path.write_text(serialize_frontmatter(meta) + "\n" + body, encoding="utf-8")

    return changed

```

### Core Architecture Module: `src/hyperresearch/core/escalation.py`
```
"""Escalation queue — blocked fetches become browser-lane work, not losses.

Pre-4.0, a URL that hit a login wall, bot block, or junk gate was discarded;
at dissertation scale that's dozens of silently lost sources per run. Now the
fetch engine ENQUEUES the blocked URL here, and the `hyperresearch-
browser-fetcher` agent drains the queue by driving the user's real Chrome
browser (via Claude-in-Chrome) — one tab at a time, serial, precious.

The queue lives in the vault DB (`escalations` table) rather than a JSON
file: parallel fetcher waves enqueue concurrently, and SQLite gives atomic
claim semantics for free.

Lifecycle:  queued → in_progress → fetched | needs_human | abandoned
`needs_human` is the HARD scope boundary: CAPTCHAs, 2FA, and logins are
consolidated into one prompt for the human — never solved automatically.
"""

from __future__ import annotations

from datetime import UTC, datetime

REASONS = ("login_wall", "bot_block", "captcha", "fetch_failed", "interactive_needed", "scholar_search")
STATUSES = ("queued", "in_progress", "fetched", "needs_human", "abandoned")


class EscalationError(Exception):
    pass


def _now() -> str:
    return datetime.now(UTC).isoformat()


def enqueue(
    conn,
    url: str,
    reason: str,
    vault_tag: str | None = None,
    requested_by: str | None = None,
    suggested_by: str | None = None,
    utility_score: float | None = None,
    detail: str | None = None,
) -> int | None:
    """Add a blocked URL to the queue. Returns the row id, or None when the
    (url, vault_tag) pair is already queued (idempotent re-enqueue)."""
    if reason not in REASONS:
        raise EscalationError(f"invalid reason '{reason}' (one of {REASONS})")
    now = _now()
    cur = conn.execute(
        """INSERT OR IGNORE INTO escalations
           (url, reason, requested_by, suggested_by, utility_score, vault_tag,
            detail, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (url, reason, requested_by, suggested_by, utility_score, vault_tag, detail, now, now),
    )
    conn.commit()
    return cur.lastrowid if cur.rowcount else None


def maybe_enqueue_blocked_fetch(
    vault,
    url: str,
    reason: str,
    vault_tag: str | None = None,
    suggested_by: str | None = None,
    utility_score: float | None = None,
    detail: str | None = None,
) -> int | None:
    """Fetch-gate hook: enqueue a blocked fetch if the chrome lane accepts it.

    Applies [chrome] policy: lane enabled, utility threshold (None-scored
    URLs pass — no evidence they're low-value), and the per-run cap.
    Returns the row id or None when policy declined.
    """
    cfg = vault.config.chrome
    if not cfg.enabled:
        return None
    if utility_score is not None and utility_score < cfg.escalation_utility_threshold:
        return None
    if vault_tag:
        count = vault.db.execute(
            "SELECT COUNT(*) AS c FROM escalations WHERE vault_tag = ?", (vault_tag,)
        ).fetchone()["c"]
        if count >= cfg.max_items_per_run:
            return None
    return enqueue(
        vault.db, url, reason,
        vault_tag=vault_tag, requested_by="fetch-gate",
        suggested_by=suggested_by, utility_score=utility_score, detail=detail,
    )


def claim_next(conn, claimed_by: str, vault_tag: str | None = None) -> dict | None:
    """Atomically claim the highest-utility queued item. None when queue empty.

    Single UPDATE with a scalar subquery — safe under concurrent claimers
    (SQLite serializes writers; the subquery re-evaluates inside the write
    lock, so two claimers can never take the same row).
    """
    now = _now()
    tag_clause = "AND vault_tag = ?" if vault_tag else ""
    params: list = [claimed_by, now]
    if vault_tag:
        params.append(vault_tag)
    cur = conn.execute(
        f"""UPDATE escalations
            SET status = 'in_progress', claimed_by = ?, updated_at = ?,
                attempts = attempts + 1
            WHERE id = (
                SELECT id FROM escalations
                WHERE status = 'queued' {tag_clause}
                ORDER BY utility_score IS NULL, utility_score DESC, id
                LIMIT 1
            )
            RETURNING *""",
        params,
    )
    row = cur.fetchone()
    conn.commit()
    return dict(row) if row else None


def resolve(
    conn,
    item_id: int,
    status: str,
    note_id: str | None = None,
    detail: str | None = None,
) -> dict:
    """Move an item to a terminal (or needs_human) state."""
    if status not in ("fetched", "needs_human", "abandoned", "queued"):
        raise EscalationError(f"invalid resolution '{status}'")
    cur = conn.execute(
        """UPDATE escalations
           SET status = ?, note_id = COALESCE(?, note_id),
               detail = COALESCE(?, detail), updated_at = ?
           WHERE id = ? RETURNING *""",
        (status, note_id, detail, _now(), item_id),
    )
    row = cur.fetchone()
    conn.commit()
    if row is None:
        raise EscalationError(f"no escalation item #{item_id}")
    return dict(row)


def list_items(
    conn,
    status: str | None = None,
    vault_tag: str | None = None,
    limit: int = 100,
) -> list[dict]:
    query = "SELECT * FROM escalations"
    conds, params = [], []
    if status:
        conds.append("status = ?")
        params.append(status)
    if vault_tag:
        conds.append("vault_tag = ?")
        params.append(vault_tag)
    if conds:
        query += " WHERE " + " AND ".join(conds)
    query += " ORDER BY utility_score IS NULL, utility_score DESC, id LIMIT ?"
    params.append(limit)
    return [dict(r) for r in conn.execute(query, params).fetchall()]


def queue_stats(conn, vault_tag: str | None = None) -> dict:
    """Counts by status — surfaced in `hpr run status`."""
    query = "SELECT status, COUNT(*) AS c FROM escalations"
    params: list = []
    if vault_tag:
        query += " WHERE vault_tag = ?"
        params.append(vault_tag)
    query += " GROUP BY status"
    stats = dict.fromkeys(STATUSES, 0)
    for row in conn.execute(query, params):
        stats[row["status"]] = row["c"]
    return stats

```

### Core Architecture Module: `src/hyperresearch/core/fetcher.py`
```
"""Core fetch logic — reusable by CLI and MCP server."""

from __future__ import annotations

import hashlib
import sqlite3
from urllib.parse import urlparse


def existing_live_note_for_url(conn: sqlite3.Connection, url: str) -> sqlite3.Row | None:
    """Return the ``sources`` row for ``url`` only if it still points at a live note.

    ``sources.note_id`` is ``ON DELETE SET NULL``, so deleting a note leaves its
    row behind with ``note_id = NULL``. That orphan is not a duplicate — the url
    may be fetched again — so this returns None both when the row is absent and
    when it is orphaned. Every duplicate-url check must go through here rather
    than testing row truthiness.
    """
    row = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
    if row is None or row["note_id"] is None:
        return None
    return row


def reclaim_orphaned_source_row(
    conn: sqlite3.Connection,
    url: str,
    note_id: str,
    domain: str,
    fetched_at: str,
    provider: str,
    content_hash: str,
) -> None:
    """Point an orphaned ``sources`` row (``note_id IS NULL``) for ``url`` at ``note_id``.

    The CLI fetch paths record a source with ``INSERT OR IGNORE`` so that a
    duplicate-url race is a silent no-op instead of an IntegrityError. An
    orphaned row makes that INSERT a no-op too, which would leave the freshly
    written note with no source record (and, in ``fetch``, trip the race
    detector into deleting it). Call this right after the INSERT: the
    ``note_id IS NULL`` guard means it claims only an orphan and stays a no-op
    when another fetch already owns the row, so the race semantics are unchanged.
    """
    conn.execute(
        """UPDATE sources
           SET note_id = ?, domain = ?, fetched_at = ?, provider = ?,
               content_hash = ?, status = 'active'
           WHERE url = ? AND note_id IS NULL""",
        (note_id, domain, fetched_at, provider, content_hash, url),
    )


def fetch_and_save(
    vault,
    url: str,
    tags: list[str] | None = None,
    title: str | None = None,
    parent: str | None = None,
    provider_name: str | None = None,
    save_assets: bool = False,
    visible: bool = False,
) -> dict:
    """Fetch a URL and save as a research note. Returns result dict.

    Raises:
        ValueError: If URL is already fetched.
        RuntimeError: If fetch fails.
    """
    from hyperresearch.core.note import write_note
    from hyperresearch.core.sync import compute_sync_plan, execute_sync
    from hyperresearch.web.base import get_provider

    tags = tags or []
    conn = vault.db

    # Check if URL already fetched (an orphaned row — note deleted — is not a duplicate)
    existing = existing_live_note_for_url(conn, url)
    if existing:
        raise ValueError(f"URL already fetched as note '{existing['note_id']}'")

    # Auto-visible for sites that kill headless sessions on first contact
    if not visible and vault.config.web_profile:
        from urllib.parse import urlparse as _urlparse

        domain = _urlparse(url).netloc.lower()
        if any(d in domain for d in vault.config.fetch.visible_browser_domains):
            visible = True

    # Fetch content
    prov = get_provider(
        provider_name or vault.config.web_provider,
        profile=vault.config.web_profile,
        magic=vault.config.web_magic,
        headless=not visible,
        settings=vault.config.fetch,
        gates=vault.config.junk,
    )

    result = prov.fetch(url)

    # Detect login redirects — abort, but escalate to the browser lane
    if result.looks_like_login_wall(url, vault.config.junk):
        from hyperresearch.core.escalation import maybe_enqueue_blocked_fetch

        item_id = maybe_enqueue_blocked_fetch(
            vault, url, "login_wall",
            vault_tag=tags[0] if tags else None,
            detail=f"login wall: {result.title}",
        )
        escalated = f" Queued for browser-lane escalation (#{item_id})." if item_id else ""
        raise RuntimeError(
            f"Redirected to login page ({result.title}). "
            "Your browser profile session may have expired. "
            f"Run 'hyperresearch setup' and create a new login profile.{escalated}"
        )

    # Detect junk pages — captcha, error pages, binary garbage, empty content
    junk_reason = result.looks_like_junk(vault.config.junk)
    if junk_reason:
        escalated = ""
        if junk_reason.startswith("Bot detection"):
            from hyperresearch.core.escalation import maybe_enqueue_blocked_fetch

            reason = "captcha" if "captcha" in junk_reason.lower() else "bot_block"
            item_id = maybe_enqueue_blocked_fetch(
                vault, url, reason,
                vault_tag=tags[0] if tags else None,
                detail=junk_reason,
            )
            if item_id:
                escalated = f" Queued for browser-lane escalation (#{item_id})."
        raise RuntimeError(f"Skipped junk content: {junk_reason}.{escalated}")

    # Write note
    note_title = title or result.title or urlparse(url).path.split("/")[-1] or "Untitled"
    domain = result.domain

    extra_meta = {
        "source": url,
        "source_domain": domain,
        "fetched_at": result.fetched_at.isoformat(),
        "fetch_provider": prov.name,
    }
    if result.metadata.get("author"):
        extra_meta["author"] = result.metadata["author"]

    from hyperresearch.core.scholar import extract_doi

    detected_doi = extract_doi(url, result.raw_html, result.content)
    if detected_doi:
        extra_meta["doi"] = detected_doi

    note_path = write_note(
        vault.notes_dir,
        title=note_title,
        body=result.content,
        tags=tags,
        status="draft",
        source=url,
        parent=parent,
        extra_frontmatter=extra_meta,
    )

    # Save raw file (PDF, etc.) if present
    raw_file_path = None
    if result.raw_bytes and result.raw_content_type:
        ext_map = {
            "application/pdf": ".pdf",
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/gif": ".gif",
            "image/webp": ".webp",
        }
        ext = ext_map.get(result.raw_content_type, "")
        if ext:
            raw_dir = vault.root / "research" / "raw"
            raw_dir.mkdir(parents=True, exist_ok=True)
            raw_filename = note_path.stem + ext
            raw_file = raw_dir / raw_filename
            raw_file.write_bytes(result.raw_bytes)
            raw_file_path = f"raw/{raw_filename}"

    # Note: tagging and summarization is the agent's job, not an automatic process.

    # Add raw_file reference to frontmatter AFTER enrich (enrich rewrites frontmatter)
    if raw_file_path:
        note_text = note_path.read_text(encoding="utf-8")
        if note_text.startswith("---") and "raw_file:" not in note_text:
            end = note_text.find("---", 3)
            if end != -1:
                note_text = (
                    note_text[:end]
                    + f"raw_file: {raw_file_path}\n"
                    + note_text[end:]
                )
                note_path.write_text(note_text, encoding="utf-8")

    # Sync
    note_id = note_path.stem
    plan = compute_sync_plan(vault)
    if plan.to_add or plan.to_update:
        execute_sync(vault, plan)

    # Record source (upsert: an orphaned row for this url may already exist)
    content_hash = hashlib.sha256(result.content.encode("utf-8")).hexdigest()[:16]
    conn.execute(
        """INSERT INTO sources (url, note_id, domain, fetched_at, provider, content_hash)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET
               note_id = excluded.note_id,
               domain = excluded.domain,
               fetched_at = excluded.fetched_at,
               provider = excluded.provider,
               content_hash = excluded.content_hash,
               status = 'active'""",
        (url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash),
    )
    conn.commit()

    # Save assets if requested
    saved_assets: list[dict] = []
    if save_assets:
        from hyperresearch.cli.fetch import _save_assets

        assets_dir = vault.root / "research" / "assets" / note_id
        saved_assets = _save_assets(
            conn, result, note_id, assets_dir,
            settings=vault.config.assets, image_timeout_s=vault.config.fetch.image_timeout_s,
            max_image_bytes=vault.config.fetch.max_image_bytes,
            allow_private_hosts=vault.config.fetch.allow_private_hosts,
        )

    return {
        "note_id": note_id,
        "title": note_title,
        "url": url,
        "domain": domain,
        "provider": prov.name,
        "path": str(note_path.relative_to(vault.root)),
        "word_count": len(result.content.split()),
        "assets": saved_assets,
        "raw_file": raw_file_path,
    }

```

### Core Architecture Module: `src/hyperresearch/core/frontmatter.py`
```
"""YAML frontmatter parsing and serialization."""

from __future__ import annotations

import re

import yaml

from hyperresearch.models.note import NoteMeta

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def parse_frontmatter(content: str) -> tuple[NoteMeta, str]:
    """Parse YAML frontmatter from markdown content.

    Returns (metadata, body) where body is the content after frontmatter.
    """
    match = FRONTMATTER_RE.match(content)
    if not match:
        return NoteMeta(title="Untitled"), content

    yaml_str = match.group(1)
    body = content[match.end():]

    data = yaml.safe_load(yaml_str) or {}
    if not isinstance(data, dict):
        return NoteMeta(title="Untitled"), content

    # Handle missing title gracefully
    if "title" not in data:
        data["title"] = "Untitled"

    meta = NoteMeta.model_validate(data)
    return meta, body


def serialize_frontmatter(meta: NoteMeta) -> str:
    """Serialize NoteMeta to YAML frontmatter string."""
    data = meta.model_dump(mode="json", exclude_none=True, exclude_defaults=False)
    # Remove empty lists
    for key in ("tags", "aliases"):
        if key in data and not data[key]:
            del data[key]
    # Remove empty id
    if "id" in data and not data["id"]:
        del data["id"]

    yaml_str = yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)
    return f"---\n{yaml_str}---\n"


def render_note(meta: NoteMeta, body: str) -> str:
    """Render a full markdown note with frontmatter + body."""
    return serialize_frontmatter(meta) + "\n" + body

```

### Core Architecture Module: `src/hyperresearch/core/graphrank.py`
```
"""Vault centrality — PageRank over the note link graph.

The graph is the `links` table: wiki-links plus the `--suggested-by`
provenance breadcrumbs (which land in `links` because breadcrumbs are body
wiki-links). Centrality in THIS graph means "many independent research
chains converged on this source" — a strong load-bearing signal precisely
because fetcher chasing is citation-driven.

Pure-Python power iteration; vaults are thousands of nodes, not millions.
Scores are normalized by the maximum (top note = 1.0) and stored to
`notes.centrality_score` (DB-cache only, recomputable).
"""

from __future__ import annotations

DAMPING = 0.85
MAX_ITERATIONS = 50
CONVERGENCE = 1e-6


def pagerank(
    nodes: list[str],
    edges: list[tuple[str, str]],
    damping: float = DAMPING,
    max_iterations: int = MAX_ITERATIONS,
    convergence: float = CONVERGENCE,
) -> dict[str, float]:
    """Standard PageRank with dangling-node handling. Returns raw scores."""
    if not nodes:
        return {}
    n = len(nodes)
    node_set = set(nodes)

    # Deduplicate edges; drop self-loops and edges to unknown nodes
    out: dict[str, set[str]] = {node: set() for node in nodes}
    for src, dst in edges:
        if src in node_set and dst in node_set and src != dst:
            out[src].add(dst)

    incoming: dict[str, list[str]] = {node: [] for node in nodes}
    for src, targets in out.items():
        for dst in targets:
            incoming[dst].append(src)

    rank = dict.fromkeys(nodes, 1.0 / n)
    base = (1.0 - damping) / n

    for _ in range(max_iterations):
        dangling_mass = sum(rank[node] for node in nodes if not out[node])
        new_rank = {}
        for node in nodes:
            incoming_sum = sum(rank[src] / len(out[src]) for src in incoming[node])
            new_rank[node] = base + damping * (incoming_sum + dangling_mass / n)
        delta = sum(abs(new_rank[node] - rank[node]) for node in nodes)
        rank = new_rank
        if delta < convergence:
            break
    return rank


def compute_centrality(conn) -> int:
    """Compute and store normalized centrality for all notes. Returns count.

    Resolver-minted stub notes (`repair --stub`, `graph stub`) are left out
    of the node set — and therefore out of the edge set, since `pagerank`
    drops edges to unknown nodes. A stub is a placeholder that exists only
    because something linked to it; letting it soak up rank rewards parse
    artifacts over real sources (#93). Their stored score is reset to 0 so
    vaults ranked before this exclusion do not keep stale weight.
    """
    from hyperresearch.core.note import STUB_SUMMARY_PREFIX

    stub_pattern = STUB_SUMMARY_PREFIX + "%"
    nodes = [
        row["id"]
        for row in conn.execute(
            "SELECT id FROM notes WHERE COALESCE(summary, '') NOT LIKE ?",
            (stub_pattern,),
        ).fetchall()
    ]
    conn.execute(
        "UPDATE notes SET centrality_score = 0 WHERE COALESCE(summary, '') LIKE ?",
        (stub_pattern,),
    )
    if not nodes:
        conn.commit()
        return 0
    edges = [
        (row["source_id"], row["target_id"])
        for row in conn.execute(
            "SELECT source_id, target_id FROM links WHERE target_id IS NOT NULL"
        ).fetchall()
    ]
    scores = pagerank(nodes, edges)
    max_score = max(scores.values()) if scores else 0.0
    if max_score <= 0:
        conn.commit()
        return 0
    for note_id, score in scores.items():
        conn.execute(
            "UPDATE notes SET centrality_score = ? WHERE id = ?",
            (score / max_score, note_id),
        )
    conn.commit()
    return len(scores)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #140** (2026-09-23): **CODE_BLOCK_RE ignores fence length, so code with an odd number of ``` leaks wiki-links**
  *Symptoms*: `CODE_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)` (`core/patterns.py:27`) ends a fenced block at the first triple-backtick run, whatever length the opening fence was. #129 now emits fences longer than any backtick run inside the code, which is correct markdown, but the strip that runs before wiki-link parsing doesn't honor it. So code that contains an odd number of ``` still leaks `[[ ... ]]` into the link parser:  ``` <pre>``` [[ -n y ]]</pre> ```  comes out as a link to ` -n y `. Pages that show markdown examples hit this all the time. Same for inline code that starts with a backtick (`<code>`[[ -n q ]]</code>`) through `INLINE_CODE_RE`.  This already leaked before #129, so it's not a regression. The fix is to match the closing fence to the opening one, something like `(`{3,})[\s\S]*?\1`, with the same treatment for inline spans. It's worth checking the pattern stays linear on backtick floods, since this runs on every fetched body. 
  **Post-Mortem & Fix Analysis**:
  > One extra acceptance/perf boundary: I would not use the sketched ``(`{3,})[\s\S]*?\1`` literally for fenced blocks.  CommonMark gives block fences and inline spans different delimiter rules: a fenced block closes with the same fence character and **at least** as many delimiters as the opener, while an inline code span closes with an **equal-length** backtick string. So an exact backreference is appropriate to the inline-span rule but would miss a valid block such as a 4-backtick opener closed by 5 backticks, allowing any `[[...]]` inside to leak again. Tilde fences are the other block-fence form if this stripper is meant to follow Markdown rather than only the built-in provider's generated output.  There is also a concrete complexity problem with that variable-length backreference. On CPython 3.13.5, applying the sketch to one unmatched backtick run was strongly superlinear on my machine: ~11 ms at 800 ticks, 85 ms at 1,600, 0.62 s at 3,200, and 4.7 s at 6,400. That matters here becaus

- **Issue #138** (2026-09-22): **check_oa_url should use the SSRF gate; it still passes mapped CGNAT on 3.11**
  *Symptoms*: `check_oa_url` (`core/oa.py:134`) gates resolver-supplied URLs with its own `is_global` check instead of `web.safe_http.check_url`, and its docstring already says to collapse it once the SSRF gate landed. It did land, in 0.11.0.  It matters now because of #127. On Python 3.11, `ipaddress` reports mapped CGNAT and 6to4-wrapped CGNAT as global:  ``` >>> ipaddress.ip_address("::ffff:100.64.0.1").is_global True >>> ipaddress.ip_address("2002:6440:1::").is_global True ```  `check_url` blocks both after #127. A poisoned Unpaywall / Europe PMC / CORE record pointing at a host that resolves to one of those would pass `check_oa_url` on 3.11. The URL comes out of a third-party API response, so it's the same threat model `check_url` was built for. It should also pick up the redirect revalidation `check_url` does and this can't.  Small related nit from the #127 review: `check_url` compares the still-mapped address against `allow_private_hosts`, so `[::ffff:10.0.0.5]` with `10.0.0.0/8` allowlisted is refused. Fails closed, but it should unmap once in `check_url` and use that for both decisions. 

- **Issue #137** (2026-09-23): **crawl4ai browser lanes fetch with TLS verification off**
  *Symptoms*: The builtin provider and every PDF lane refuse a bad certificate (#130 made the builtin one say so clearly). The crawl4ai browser lanes don't:  - headless: `BrowserConfig(**browser_kwargs)` at `web/crawl4ai_provider.py:172` never sets `ignore_https_errors`, and Crawl4AI defaults it to `True` - visible window: `launch_persistent_context(..., ignore_https_errors=True)` at `web/crawl4ai_provider.py:258`  crawl4ai is the provider `hpr install` switches a vault to, so in practice most HTML gets fetched with verification off. The SSRF gate still checks the landed URL, so this isn't a private-network hole, but a MITM'd or expired-cert page lands in the vault as a normal source.  I haven't decided whether the visible-window lane should keep it. That lane exists for login-walled and bot-walled sites, and some of those do have broken chains. The headless lane I think should verify by default, with a `[fetch]` escape hatch if someone needs it. 
  **Post-Mortem & Fix Analysis**:
  > Hi @jordan-gibbs, I’d like to work on this!  My plan is to:  Set ignore_https_errors=False by default in web/crawl4ai_provider.py for the headless lane so TLS verification is enforced.  Add a [fetch] configuration option (e.g., ignore_https_errors / verify_ssl) to allow an escape hatch when needed.  Keep the visible window lane as-is (or match the new config default) and add unit tests to cover both verified and bypassed fetch states.  Could you please assign this issue to me? Thanks!

- **Issue #120** (2026-09-12): **`quote-integrity` lint rule mis-pairs quoted spans shorter than 20 characters**
  *Symptoms*: ### hyperresearch version   hyperresearch: v0.10.0  ### OS and Python version   Python: 3.13.11, Windows 11, build 10.0.26200 (Windows-11-10.0.26200-SP0)  ### What you ran  ```shell ### Root cause  The quote-span extraction regex is:   _QUOTE_SPAN_RE = re.compile(r"[\"“]([^\"“”]{20,600})[\"”]")   The `{20,600}` length bound is applied to the *first* candidate match at each opening-quote position. `re.finditer` does non-overlapping, left-to-right matching with no backtracking across a failed length constraint to try the *next* closing quote — so when a genuinely quoted phrase is shorter than 20 characters (e.g. `"TVL"`, `"Low Security"`, `"reasonable use"`, `"6x Exits"`), the regex simply fails to match that pair at all. The scan then resumes and treats that quote's own closing mark as a fresh *opening* mark, pairs it with whatever quote character appears next in the document (often hundreds of characters and several sentences later), and reports everything in between as one giant "hallucinated" quoted span. ```  ### What happened  ```shell **Component:** `hyperresearch/cli/lint.py`, function `_check_quote_integrity`  **Severity:** High — produces a flood of false-positive gate failures that block `run finish` on reports that are actually clean, and the false positives actively mislead the fix effort (each one names *unrelated* body prose as the "hallucinated quote"). ```  ### What you expected instead  ### Impact  - `run finish` blocks with `"blocked_on": "verify"` on reports

- **Issue #116** (2026-09-12): **`run init` does not validate the vault tag; `../../x` scaffolds outside the vault**
  *Symptoms*: Found during the security review of #114 and deferred because it touches every run command rather than one.  `Vault.run_dir()` (`core/vault.py:~87`) and `init_run` apply no validation to `vault_tag`. The tag is joined onto `research/runs/`, so `hpr run init ../../x` — or an absolute path, since pathlib replaces the base on an absolute segment — scaffolds a run workspace outside the vault, and every subsequent `run` subcommand that resolves the tag follows it there.  Same bug class as the `claims ingest --tag` traversal fixed in #114; the fix shape is the same: resolve the joined path and require it to sit under `research/runs/`, rejecting the tag with a clear error otherwise. A tag is a slug — restricting it to `[A-Za-z0-9_.-]+` at the CLI boundary would be simpler still and matches what step 1 actually generates.  Exposure is low (the tag comes from the operator or the orchestrating agent, not from fetched content), which is why it was deferred rather than fixed inline.

- **Issue #104** (2026-09-11): **test_serve/test_server.py flakes on Windows in full-suite runs (WinError 10048)**
  *Symptoms*: `tests/test_serve/test_server.py`, added in #96, fails intermittently on Windows during full-suite runs. CI is ubuntu-only, so the checks stay green and this only shows up locally.  ### Observed  Three consecutive `pytest tests/` runs on Windows 11 / Python 3.11.9:  | run | result | |---|---| | 1 | `FAILED test_idle_connection_is_closed_after_read_timeout` — `OSError: [WinError 10048] Only one usage of each socket address is normally permitted` | | 2 | `FAILED test_concurrent_pages_and_searches_render_from_vault` | | 3 | pass |  A different test each time, which points at the shared setup rather than any one test.  The same file passes reliably in isolation — `pytest tests/test_serve/test_server.py` passed on both attempts, and the individual failing test passes on its own. It only fails as part of the full suite.  ### Likely cause  The tests bind with `port=0` and learn the assigned port by monkeypatching `TCPServer.server_activate`. `HTTPServer` sets `allow_reuse_address = 1`, and `SO_REUSEADDR` on Windows has different semantics than POSIX — it permits binding an address already in use rather than just reclaiming `TIME_WAIT` sockets. Under full-suite load, with the spawn-context subprocesses these tests start, that turns into WinError 10048 instead of a clean assignment.  ### Notes for a fix  - `run_server` never reports the port it actually bound. With `port=0` it prints `http://127.0.0.1:0`, which is why the tests have to monkeypatch `server_activate` at all. Having `run

- **Issue #101** (2026-09-11): **Pipeline constants are authored twice: profile fields vs hardcoded values**
  *Symptoms*: Split out of #88 (contract audit by @darlingm). This is the root cause behind a large share of that audit, and it's worth fixing as a class rather than case by case.  The pattern: a tunable is declared on the profile **and** hardcoded somewhere that actually runs. The profile field then drifts, or is dead on arrival, and two halves of the same run disagree.  ### Confirmed instances  **`citation_density_min` is dead config.** Declared at `core/profiles.py:140`, set to `2.0` at `:229`, and read **nowhere** — grep returns only the declaration and the assignment. Both real gates hardcode a different number: `core/runs.py:413` (`floor = 1.5`) and `core/hooks.py:1220`. This overlaps #76, which should be fixed in the same pass.  **Draft orchestrator and synthesizer get different word targets.** `core/hooks.py:2030-2032` hardcodes `argumentative: 5000-10000 words`, while `core/hooks.py:2261-2263` templates `<< p.word_targets[...] >>`. On the `premier` gear (`core/profiles.py:295` = 8000–16000) the two halves of the same run are handed targets 60% apart.  **`char_targets_no_word_boundary` is defined only on `_FULL`** (`core/profiles.py:238`). `premier` and `dissertation` build from `**_FULL` while overriding `word_targets`, so they inherit full-gear character targets that no longer correspond to their own word targets. Same bug class, introduced recently in #64.  **Step 4 hardcodes what it templates.** `skills/hyperresearch-4-loci-analysis.md:33` templates `<< p.loci_analysts >>` but 

- **Issue #100** (2026-09-11): **Silent failures: run resume skill names, chapter registration, step-8 gap artifact**
  *Symptoms*: Split out of #88 (contract audit by @darlingm). Three defects that share a shape: a producer and a consumer disagree, nothing raises, and the run reports success.  ### 1. `run resume` prints a skill name that cannot be invoked  `cli/run_cmd.py:186` builds the suggestion by string substitution:  ```python "skill_to_invoke": f"hyperresearch-{position['next_step'].replace('.', '-')}" ```  That yields `hyperresearch-2` and `hyperresearch-1-5`. The installed skills are `hyperresearch-2-width-sweep` and `hyperresearch-1-5-chapter-partition`. Every `run resume` emits an un-invokable `Skill(...)` line, and CLAUDE.md advertises `run resume` as *the* recovery path.  Fix: map step id → skill slug from the same table the installer renders from, rather than reconstructing the name.  ### 2. Chapter registration never reaches the manifest  `core/runs.py:159` defines `set_chapter()`. It has **zero callers** in `src/` and `tests/` — confirmed by grep.  `skills/hyperresearch-1-5-chapter-partition.md:56-63` says to register chapters in the manifest, but only emits a `run event`, so `manifest["chapters"]` stays empty. `resume_position` (`core/runs.py:243-256`) reads that dict, so a dissertation resumed after step 1.5 reports `chapters_pending: []` — i.e. nothing left to do.  Fix: call `set_chapter()` from the partition step, or delete it and have resume derive chapters from the events log. Either is fine; both being half-present is the bug.  ### 3. Step 8 overwrites its own preflight artifact  `

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

### Incident Patch 1: `750a51ba` (2026-09-23)
**Commit Message**: fix: an unknown retraction result never erases a known retraction (#146)

When OpenAlex errors, lookup_metadata falls through to Semantic Scholar,
which has no retraction data. A --fresh sweep then overwrote a stored
is_retracted = 1 with unknown and the retracted citation passed the gate.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 - Add scholarly metadata filters and metadata-only browsing to CLI and MCP search, including semantic filtering and a cache upgrade that preserves unchecked retraction status.
 - **BEHAVIOR CHANGE — crawl4ai's headless browser verifies TLS certificates (#137).** crawl4ai defaults `BrowserConfig.ignore_https_errors` to True and launches Chromium with `--ignore-certificate-errors` on every start, so the provider `hpr install` switches a vault to fetched most HTML with verification off. Setting `ignore_https_errors = False` alone changes nothing (checked against a self-signed server on crawl4ai 0.8.6); the provider now also drops those launch flags, on both the plain launch and the login-profile (managed browser) launch, and refuses to start if a crawl4ai release moves the code it overrides. A refused certificate raises `CertVerificationError` naming the code (`ERR_CERT_AUTHORITY_INVALID`, ...) and the new opt-out, `[fetch] browser_verify_tls = false`. Before, it came back as an empty page and was reported as junk. As on the builtin and PDF lanes, the failure is final: no unverified retry, no escalation. In a batch it is a logged skip. The visible-window lane (`--visible` with a login profile) still ignores certificate errors, since some of the walled sites it serves have broken chains. Batch fetches also stopped mislabelling results: `arun_many` returns them in completion order, and they were paired with the requested URLs by position.
+- **An OpenAlex outage no longer erases a known retraction.** Only OpenAlex reports retractions; when it errors, `lookup_metadata` falls through to Semantic Scholar, which answers "unknown". `sources score --fresh` (and the ship-time `sources retractions` sweep) wrote that unknown over a stored `is_retracted = 1`, so a retracted citation passed the gate. Unknown now keeps a stored retraction. A stored false is still replaced, since older versions wrote an unchecked false for every S2 result.
 - **A run tag is a slug (#116).** `Vault.run_dir()` joined the tag onto `research/runs/` unchecked, and pathlib replaces the base on an absolute segment, so `hpr run init ../../x` or `hpr run init C:/anything` scaffolded a run workspace outside the vault and every later `run` subcommand followed it there. Tags are now validated at that one seam: letters, digits, `-`, `_` and `.`, starting with a letter or digit, which is what `hpr vault-tag` mints. `run`, `levers` and `citecheck` report a bad tag as a clean error instead of a traceback. Same bug class as the `claims ingest --tag` traversal fixed in 0.11.1; exposure is low because the tag comes from the operator or the orchestrating agent, not from fetched content.
 - **The builtin provider fetches PDFs (#82, reported by @earldodd).** The PDF lane (`_is_pdf_url` / `_fetch_pdf`) lived inside the crawl4ai provider only, so a vault still on `provider = "builtin"` (the default until `hpr install` switches it) had no PDF handling at all: a direct `.pdf` link was decoded as HTML text and rejected by the junk gate as "Binary PDF garbage in content", identically for every mirror of the same document, and an arXiv `/abs/` link saved the 900-word abstract page instead of the paper. The lane now lives in `web/pdf.py` and both providers use it; the crawl4ai module keeps the old names. The builtin provider also detects a PDF from its bytes when the URL does not look like one. When the PDF lane declines a URL and the HTML fallback turns out to be junk, `hpr fetch -j` now says why the lane declined it (`PDF lane: HTTP 403`, `no extractable text layer`, ...) instead of the generic junk verdict, and the pymupdf document handle is closed on the exception path instead of leaking one per encrypted PDF.
 - **`serply` web provider.** Google organic results with page fetch through the same `SERPLY_API_KEY`; opt-in via `[web] provider = "serply"`, no new dependency.
```

**File**: `src/hyperresearch/core/scholar.py` (modified, +14/-4)
```diff
@@ -423,7 +423,7 @@ def score_sources(
     conn = vault.db
     ttl = vault.config.ranking.api_cache_ttl_days
 
-    query = "SELECT n.id, n.path, n.doi FROM notes n WHERE n.doi IS NOT NULL"
+    query = "SELECT n.id, n.path, n.doi, n.is_retracted FROM notes n WHERE n.doi IS NOT NULL"
     params: tuple = ()
     if tag:
         query += " AND n.id IN (SELECT note_id FROM tags WHERE tag = ?)"
@@ -449,13 +449,23 @@ def score_sources(
             missing.append(row["id"])
             continue
 
+        # Only OpenAlex reports retractions. When it errors (5xx, timeout) the
+        # lookup falls through to Semantic Scholar, which answers "unknown".
+        # Unknown must never erase a retraction OpenAlex already reported, or
+        # a --fresh sweep during an outage would wave a retracted citation
+        # through the ship gate. A stored false is not kept: it may be the
+        # unchecked false older versions wrote for S2 results.
+        is_retracted = meta_result["is_retracted"]
+        if is_retracted is None and row["is_retracted"] == 1:
+            is_retracted = True
+
         # DB update
         conn.execute(
             "UPDATE notes SET citation_count = ?, venue = ?, is_retracted = ? WHERE id = ?",
             (
                 meta_result["citation_count"],
                 meta_result["venue"],
-                None if meta_result["is_retracted"] is None else int(meta_result["is_retracted"]),
+                None if is_retracted is None else int(is_retracted),
                 row["id"],
             ),
         )
@@ -467,11 +477,11 @@ def score_sources(
             fm, body = parse_frontmatter(text)
             fm.citation_count = meta_result["citation_count"]
             fm.venue = meta_result["venue"]
-            fm.is_retracted = meta_result["is_retracted"]
+            fm.is_retracted = is_retracted
             note_path.write_text(render_note(fm, body), encoding="utf-8")
 
         scored += 1
-        if meta_result["is_retracted"]:
+        if is_retracted:
             retracted.append(row["id"])
 
     conn.commit()
```

**File**: `tests/test_core/test_scholar_enrichment.py` (modified, +30/-0)
```diff
@@ -179,6 +179,36 @@ def test_semantic_scholar_retraction_stays_unchecked(
                 tmp_vault.db, "", filters=SearchFilters(retraction="not-retracted"),
             ) == []
 
+    def test_openalex_outage_keeps_a_known_retraction(self, doi_vault, monkeypatch, no_sleep):
+        from hyperresearch.core.frontmatter import parse_frontmatter
+        from hyperresearch.core.sync import compute_sync_plan, execute_sync
+
+        _stub_openalex(monkeypatch, {"10.1%2Fretracted": OPENALEX_RETRACTED})
+        scholar.score_sources(doi_vault)
+
+        # OpenAlex down on the fresh sweep: the lookup falls through to S2,
+        # which has no retraction data.
+        calls = _stub_openalex(monkeypatch, {
+            "semanticscholar": {"citationCount": 31, "venue": "BadJournal"},
+        })
+        result = scholar.score_sources(doi_vault, fresh=True)
+        assert any("semanticscholar.org" in c for c in calls)
+        assert "retracted-paper" in result["retracted"]
+
+        row = doi_vault.db.execute(
+            "SELECT citation_count, is_retracted FROM notes WHERE id = 'retracted-paper'"
+        ).fetchone()
+        assert row["citation_count"] == 31
+        assert row["is_retracted"] == 1
+        text = (doi_vault.notes_dir / "retracted-paper.md").read_text(encoding="utf-8")
+        assert parse_frontmatter(text)[0].is_retracted is True
+
+        execute_sync(doi_vault, compute_sync_plan(doi_vault, force=True))
+        row = doi_vault.db.execute(
+            "SELECT is_retracted FROM notes WHERE id = 'retracted-paper'"
+        ).fetchone()
+        assert row["is_retracted"] == 1
+
     def test_authority_is_vault_relative_percentile(self, doi_vault, monkeypatch):
         _stub_openalex(monkeypatch, {
             "10.1%2Fcited": OPENALEX_CITED,        # 512 citations
```

---

### Incident Patch 2: `6f05dbf9` (2026-09-23)
**Commit Message**: fix: crawl4ai headless lane verifies TLS certificates (#137) (#145)

crawl4ai defaults BrowserConfig.ignore_https_errors to True and launches
Chromium with --ignore-certificate-errors on every start, so the provider
`hpr install` switches a vault to fetched most HTML unverified. Setting
ignore_https_errors=False alone changes nothing (checked against a
self-signed server on crawl4ai 0.8.6); the provider now also strips those
launch flags on this crawler's browser manager, for both the plain launch
and the login-profile (managed browser) launch, and fails closed if a
crawl4ai release moves the flag builders.

A refused certificate raises CertVerificationError naming the Chromium
code and the new opt-out, [fetch] browser_verify_tls = false, instead of
coming back as an empty page reported as junk. Final, as on the builtin
and PDF lanes: no unverified retry, no escalation; a logged skip in a
batch. The visible-window lane keeps ignoring certificate errors.

Batch results are now paired with their requested URL by result.url:
arun_many returns them in completion order, not input order.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -3,12 +3,13 @@
 ## [Unreleased]
 
 - Add scholarly metadata filters and metadata-only browsing to CLI and MCP search, including semantic filtering and a cache upgrade that preserves unchecked retraction status.
+- **BEHAVIOR CHANGE — crawl4ai's headless browser verifies TLS certificates (#137).** crawl4ai defaults `BrowserConfig.ignore_https_errors` to True and launches Chromium with `--ignore-certificate-errors` on every start, so the provider `hpr install` switches a vault to fetched most HTML with verification off. Setting `ignore_https_errors = False` alone changes nothing (checked against a self-signed server on crawl4ai 0.8.6); the provider now also drops those launch flags, on both the plain launch and the login-profile (managed browser) launch, and refuses to start if a crawl4ai release moves the code it overrides. A refused certificate raises `CertVerificationError` naming the code (`ERR_CERT_AUTHORITY_INVALID`, ...) and the new opt-out, `[fetch] browser_verify_tls = false`. Before, it came back as an empty page and was reported as junk. As on the builtin and PDF lanes, the failure is final: no unverified retry, no escalation. In a batch it is a logged skip. The visible-window lane (`--visible` with a login profile) still ignores certificate errors, since some of the walled sites it serves have broken chains. Batch fetches also stopped mislabelling results: `arun_many` returns them in completion order, and they were paired with the requested URLs by position.
 - **A run tag is a slug (#116).** `Vault.run_dir()` joined the tag onto `research/runs/` unchecked, and pathlib replaces the base on an absolute segment, so `hpr run init ../../x` or `hpr run init C:/anything` scaffolded a run workspace outside the vault and every later `run` subcommand followed it there. Tags are now validated at that one seam: letters, digits, `-`, `_` and `.`, starting with a letter or digit, which is what `hpr vault-tag` mints. `run`, `levers` and `citecheck` report a bad tag as a clean error instead of a traceback. Same bug class as the `claims ingest --tag` traversal fixed in 0.11.1; exposure is low because the tag comes from the operator or the orchestrating agent, not from fetched content.
 - **The builtin provider fetches PDFs (#82, reported by @earldodd).** The PDF lane (`_is_pdf_url` / `_fetch_pdf`) lived inside the crawl4ai provider only, so a vault still on `provider = "builtin"` (the default until `hpr install` switches it) had no PDF handling at all: a direct `.pdf` link was decoded as HTML text and rejected by the junk gate as "Binary PDF garbage in content", identically for every mirror of the same document, and an arXiv `/abs/` link saved the 900-word abstract page instead of the paper. The lane now lives in `web/pdf.py` and both providers use it; the crawl4ai module keeps the old names. The builtin provider also detects a PDF from its bytes when the URL does not look like one. When the PDF lane declines a URL and the HTML fallback turns out to be junk, `hpr fetch -j` now says why the lane declined it (`PDF lane: HTTP 403`, `no extractable text layer`, ...) instead of the generic junk verdict, and the pymupdf document handle is closed on the exception path instead of leaking one per encrypted PDF.
 - **`serply` web provider.** Google organic results with page fetch through the same `SERPLY_API_KEY`; opt-in via `[web] provider = "serply"`, no new dependency.
 - **Quote integrity pairs short quoted spans (#120 reported by @earldodd, #122 from @akshaypal912).** `_QUOTE_SPAN_RE` required 20+ characters between quote marks, so a short quoted term ("TVL") failed to match at its opening mark; the scan then treated its closing mark as a new opening mark and reported the unquoted prose up to the next quote character as a hallucinated quote. One real report turned 38 legitimate short quotes into 42 false errors. The regex now matches any span up to 600 characters, and the existing fewer-than-5-words skip decides what gets verified.
 - **The SSRF gate classifies IPv4-mapped IPv6 by its embedded IPv4 (#127, from @fduple).** On Python 3.12+ the stdlib `is_*` properties see through `::ffff:a.b.c.d` to ranges they don't flag, and the CGNAT check only looked at IPv4 objects, so `::ffff:100.64.0.1` was fetchable. On 3.11 the opposite held: `::ffff:8.8.8.8` was refused. Mapped addresses are unmapped before classification on every version. An `allow_private_hosts` entry of the form `host:port` or `[v6]:port` now raises a clear error; it never matched anything, but note that it surfaces on every fetch while it is in the config. Bracketed IPv6 entries (`[::1]`) now parse.
-- **A bad TLS certificate on the builtin provider raises `CertVerificationError` (#130, from @fduple).** It surfaced as a bare `httpx.ConnectError`. The failure is still final: nothing retries without verification, and the fetch is not queued as an escalation. The crawl4ai provider raises the same error on its PDF lane; its browser lanes still accept bad ce
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -273,6 +273,8 @@ The `[web] provider` setting in `.hyperresearch/config.toml` picks how pages are
 provider = "crawl4ai"
 ```
 
+Every fetch lane verifies TLS certificates by default: `builtin`, the PDF downloads, and crawl4ai's headless browser. A bad certificate fails the fetch with `CertVerificationError`; nothing retries it unverified. For a cert-broken site you trust, set the opt-out for the lane that refused it under `[fetch]`: `browser_verify_tls = false` for crawl4ai's headless browser, `pdf_verify_tls = false` for PDFs. The builtin provider has no opt-out. The visible-window browser used with a login profile (`--visible`, and the LinkedIn / Twitter-style domains) still accepts bad certificates, because some of the walled sites it exists for serve broken chains.
+
 ---
 
 ## Authenticated crawling + the browser lane
```

**File**: `src/hyperresearch/core/config.py` (modified, +5/-0)
```diff
@@ -17,6 +17,11 @@ class FetchSettings:
     # disabled TLS verification for PDF downloads. Set to false only for
     # cert-broken mirrors you explicitly trust.
     pdf_verify_tls: bool = True
+    # TLS verification for the crawl4ai headless browser lane (#137). Default
+    # on; set false only for cert-broken sites you explicitly trust. The
+    # visible-window lane (profile + visible browser) still ignores
+    # certificate errors regardless of this setting.
+    browser_verify_tls: bool = True
     min_pdf_bytes: int = 100
     # Response-size caps enforced by the SSRF gate (web/safe_http.py).
     # Defaults mirror the MAX_BYTES_* constants there.
```

**File**: `src/hyperresearch/web/builtin.py` (modified, +2/-1)
```diff
@@ -218,7 +218,8 @@ def _get(self, url: str):
             # Raise a certificate failure as its own type, the way the PDF lane
             # and the crawl4ai provider do, instead of letting the raw
             # httpx.ConnectError through looking like any other failed fetch.
-            # This lane always verifies TLS; pdf_verify_tls covers PDFs only.
+            # This lane always verifies TLS; pdf_verify_tls covers PDFs only,
+            # and browser_verify_tls the crawl4ai headless browser only.
             if _is_cert_error(exc):
                 raise CertVerificationError(
                     f"certificate verification failed for {url!r}: {exc}"
```

**File**: `src/hyperresearch/web/crawl4ai_provider.py` (modified, +118/-2)
```diff
@@ -12,6 +12,7 @@
 import logging
 import os
 import pathlib
+import re
 import sys
 import threading
 from datetime import UTC, datetime
@@ -110,6 +111,90 @@ def _smart_wait_js(settings: FetchSettings) -> str:
     )
 
 
+# Chromium switches crawl4ai adds to EVERY launch, unconditionally
+# (browser_manager.py: BrowserManager._build_browser_args for the plain launch,
+# ManagedBrowser.build_browser_flags for the profile / managed-browser launch).
+# They make the browser process accept any certificate, so
+# BrowserConfig(ignore_https_errors=False) alone verifies nothing: checked
+# against a self-signed server on crawl4ai 0.8.6, the page loads either way
+# until these are removed as well.
+_CERT_IGNORE_FLAGS = frozenset({
+    "--ignore-certificate-errors",
+    "--ignore-certificate-errors-spki-list",
+})
+
+# Chromium's certificate failures: net::ERR_CERT_* (authority, name, date,
+# revoked, weak key, ...), ERR_CERTIFICATE_TRANSPARENCY_REQUIRED, and pinning.
+_CERT_ERROR_RE = re.compile(
+    r"net::(ERR_CERT[A-Z_]*|ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN)\b"
+)
+
+BROWSER_TLS_HINT = (
+    "If this host is a known cert-broken site you trust, set "
+    "browser_verify_tls = false under [fetch] in config.toml."
+)
+
+
+def _cert_error_code(error_message: str | None) -> str | None:
+    """The Chromium cert error code in a failed crawl4ai result, or None.
+
+    crawl4ai does not raise on a navigation failure: ``arun`` returns
+    ``success=False`` with the Playwright error text (``Page.goto:
+    net::ERR_CERT_AUTHORITY_INVALID at https://...``) in ``error_message``.
+    """
+    if not error_message:
+        return None
+    m = _CERT_ERROR_RE.search(error_message)
+    return m.group(1) if m else None
+
+
+def _browser_cert_refusal(url: str, code: str):
+    from hyperresearch.web.safe_http import CertVerificationError
+
+    return CertVerificationError(
+        f"certificate verification failed for {url!r}: {code} (browser lane). "
+        + BROWSER_TLS_HINT
+    )
+
+
+def _strip_cert_ignore_flags(strategy: AsyncPlaywrightCrawlerStrategy) -> None:
+    """Keep crawl4ai from launching Chromium with certificate errors ignored.
+
+    Overrides the two flag builders on THIS strategy's browser manager only
+    (instance attributes, not a patch of the crawl4ai classes). If a crawl4ai
+    upgrade moves either builder, this raises instead of fetching with
+    verification silently off.
+    """
+    bm = strategy.browser_manager
+    build_args = getattr(bm, "_build_browser_args", None)
+    if not callable(build_args):
+        raise RuntimeError(
+            "crawl4ai's BrowserManager._build_browser_args is missing; cannot "
+            "turn off its --ignore-certificate-errors launch flag. "
+            + BROWSER_TLS_HINT
+        )
+
+    def _verified_args() -> dict:
+        args = build_args()
+        args["args"] = [a for a in args.get("args", []) if a not in _CERT_IGNORE_FLAGS]
+        return args
+
+    bm._build_browser_args = _verified_args
+
+    managed = getattr(bm, "managed_browser", None)
+    if managed is not None:
+        build_flags = getattr(type(managed), "build_browser_flags", None)
+        if not callable(build_flags):
+            raise RuntimeError(
+                "crawl4ai's ManagedBrowser.build_browser_flags is missing; cannot "
+                "turn off its --ignore-certificate-errors launch flag. "
+                + BROWSER_TLS_HINT
+            )
+        managed.build_browser_flags = lambda config: [
+            f for f in build_flags(config) if f not in _CERT_IGNORE_FLAGS
+        ]
+
+
 def _check_final_url(entry_url: str, final_url: str | None, settings: FetchSettings) -> None:
     """Re-validate the URL the browser actually ended up on.
 
@@ -168,6 +253,10 @@ def __init__(
             browser_kwargs["user_data_dir"] = data_dir
         if cookies:
             browser_kwargs["cookies"] = cookies
+        # crawl4ai defaults ignore_https_errors to True; verify unless the
+        # operator opted out (#137). _make_crawler also strips the launch
+        # flags that would otherwise override this.
+        browser_kwargs["ignore_https_errors"] = not self._settings.browser_verify_tls
 
         self._browser_config = BrowserConfig(**browser_kwargs)
 
@@ -201,6 +290,8 @@ def _make_crawler(self) -> AsyncWebCrawler:
             browser_config=self._browser_config,
             browser_adapter=UndetectedAdapter(),
         )
+        if self._settings.browser_verify_tls:
+            _strip_cert_ignore_flags(strategy)
         return AsyncWebCrawler(crawler_strategy=strategy, config=self._browser_config)
 
     def fetch(self, url: str) -> WebResult:
@@ -251,6 +342,10 @@ async def _fetch_visible(self, url: str) -> WebResult:
         from playwright.async_api import async_playwright
 
         async with async_playwright() as pw:
+            # Certificate errors stay ignored here, whatever browser_verify_tls
+            # says (#137): this lane exists 
```

**File**: `src/hyperresearch/web/pdf.py` (modified, +5/-4)
```diff
@@ -118,9 +118,10 @@ def safe_get_pdf(url: str, settings: FetchSettings):
     except Exception as exc:
         if settings.pdf_verify_tls and _is_cert_error(exc):
             # Refuse, but say how to opt out for a trusted cert-broken mirror.
-            # Raised as its own type: the browser lane runs with TLS errors
-            # ignored, so treating this like any failed PDF would hand the
-            # URL to a lane that amounts to an automatic unverified retry.
+            # Raised as its own type: the browser lane can run with TLS errors
+            # ignored (browser_verify_tls = false, or the visible lane), so
+            # treating this like any failed PDF would hand the URL to a lane
+            # that amounts to an automatic unverified retry.
             raise CertVerificationError(
                 f"certificate verification failed for {url!r}: {exc}. "
                 "If this host is a known cert-broken mirror you trust, set "
@@ -235,7 +236,7 @@ def fetch_pdf_ex(
 
     A certificate refusal propagates as ``CertVerificationError``: callers
     must not fold it into the generic failure, whose fallback is the
-    TLS-ignoring browser lane.
+    browser lane, which may be configured to ignore TLS errors.
     """
     from hyperresearch.web.safe_http import CertVerificationError, SafeHTTPError
 
```

**File**: `src/hyperresearch/web/safe_http.py` (modified, +2/-1)
```diff
@@ -57,7 +57,8 @@ class CertVerificationError(SafeHTTPError):
     """TLS certificate verification failed and verification is required.
 
     Raised distinctly so callers can surface the refusal (and its
-    ``pdf_verify_tls = false`` opt-out) instead of treating it like any
+    ``pdf_verify_tls = false`` or ``browser_verify_tls = false`` opt-out,
+    depending on the lane) instead of treating it like any
     other failed fetch — in particular, a cert-refused URL must never be
     retried through a lane that ignores TLS errors.
     """
```

**File**: `tests/test_web/test_crawl4ai_tls.py` (added, +259/-0)
```diff
@@ -0,0 +1,259 @@
+"""The crawl4ai headless lane verifies TLS certificates by default (#137).
+
+crawl4ai defaults ``BrowserConfig.ignore_https_errors`` to True AND launches
+Chromium with ``--ignore-certificate-errors`` unconditionally, so verifying
+takes both a config value and stripping those launch flags. These tests pin
+both halves, the ``[fetch] browser_verify_tls = false`` opt-out, and the
+refusal message. All offline: object construction and fake crawlers only,
+no browser launch, no network.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import logging
+import threading
+from pathlib import Path
+
+import pytest
+
+from hyperresearch.core.config import FetchSettings, VaultConfig
+from hyperresearch.web.safe_http import CertVerificationError
+
+provider = pytest.importorskip(
+    "hyperresearch.web.crawl4ai_provider",
+    reason="crawl4ai extra not installed",
+)
+
+CERT_FLAGS = {"--ignore-certificate-errors", "--ignore-certificate-errors-spki-list"}
+
+# What crawl4ai 0.8.6 put in result.error_message against a self-signed server.
+REAL_CERT_ERROR = (
+    "Unexpected error in _crawl_web at line 500 in wrap_api_call (...):\n"
+    "Error: Page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://self-signed.example/\n"
+    "Call log:\n  - navigating to \"https://self-signed.example/\", waiting until "
+    "\"domcontentloaded\"\n"
+)
+
+
+def _run(coro):
+    box: dict = {}
+
+    def target() -> None:
+        try:
+            box["result"] = asyncio.run(coro)
+        except Exception as exc:
+            box["error"] = exc
+
+    thread = threading.Thread(target=target)
+    thread.start()
+    thread.join()
+    if "error" in box:
+        raise box["error"]
+    return box["result"]
+
+
+# ---------------------------------------------------------------------------
+# Config
+# ---------------------------------------------------------------------------
+
+
+def test_browser_verify_tls_defaults_true():
+    assert FetchSettings().browser_verify_tls is True
+
+
+def test_browser_verify_tls_loads_and_round_trips(tmp_path: Path):
+    p = tmp_path / "config.toml"
+    p.write_text("[fetch]\nbrowser_verify_tls = false\n", encoding="utf-8")
+    cfg = VaultConfig.load(p)
+    assert cfg.fetch.browser_verify_tls is False
+    assert cfg.fetch.pdf_verify_tls is True  # independent knobs
+
+    out = tmp_path / "saved.toml"
+    cfg.save(out)
+    assert "browser_verify_tls = false" in out.read_text(encoding="utf-8")
+    assert VaultConfig.load(out).fetch.browser_verify_tls is False
+
+
+# ---------------------------------------------------------------------------
+# BrowserConfig + launch flags
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.parametrize("profile_dir", [None, "/tmp/does-not-matter"])
+def test_browser_config_verifies_by_default(profile_dir):
+    inst = provider.Crawl4AIProvider(headless=True, user_data_dir=profile_dir)
+    assert inst._browser_config.ignore_https_errors is False
+
+
+@pytest.mark.parametrize("profile_dir", [None, "/tmp/does-not-matter"])
+def test_browser_config_opt_out_ignores_errors(profile_dir):
+    inst = provider.Crawl4AIProvider(
+        headless=True,
+        user_data_dir=profile_dir,
+        settings=FetchSettings(browser_verify_tls=False),
+    )
+    assert inst._browser_config.ignore_https_errors is True
+
+
+def test_default_launch_drops_cert_ignore_flags():
+    """ignore_https_errors=False alone is not enough: crawl4ai's own launch
+    args carry --ignore-certificate-errors, which Chromium obeys over the
+    context setting. This runs against the installed crawl4ai, so a release
+    that moves the flag builder fails here rather than in the field."""
+    bm = provider.Crawl4AIProvider(headless=True)._make_crawler().crawler_strategy.browser_manager
+    args = bm._build_browser_args()["args"]
+    assert not CERT_FLAGS & set(args)
+    assert "--disable-blink-features=AutomationControlled" in args  # rest intact
+
+
+def test_managed_browser_launch_drops_cert_ignore_flags():
+    """The profile path launches Chromium as a subprocess and attaches over
+    CDP; its flags come from ManagedBrowser.build_browser_flags."""
+    inst = provider.Crawl4AIProvider(headless=True, user_data_dir="/tmp/does-not-matter")
+    bm = inst._make_crawler().crawler_strategy.browser_manager
+    assert bm.managed_browser is not None
+    flags = bm.managed_browser.build_browser_flags(inst._browser_config)
+    assert not CERT_FLAGS & set(flags)
+    assert "--no-sandbox" in flags
+
+
+def test_stripping_is_per_instance_not_global():
+    """The override must not leak into crawl4ai's classes or other crawlers."""
+    from crawl4ai.browser_manager import ManagedBrowser
+
+    inst = provider.Crawl4AIProvider(headless=True, user_data_dir="/tmp/does-not-matter")
+    inst._make_crawler()
+    assert set(ManagedBrowser.build_browser_flags(inst._browser_config)) >= CERT_FLAGS
+
+
+def test_opt_out_keeps_cr
```

---

### Incident Patch 3: `54af04b0` (2026-09-23)
**Commit Message**: fix: code strip honours fence length before wiki-link parsing (#140) (#144)

* fix: code strip honours fence length before wiki-link parsing (#140)

CODE_BLOCK_RE (```.*?```) closed a fenced block at the first triple
backtick run whatever the opening fence length, and INLINE_CODE_RE closed
an inline span at the first backtick. The #129 builtin provider fences
code with a run longer than any inside it, so a <pre> holding an odd
number of ``` leaked its [[ ]] into the link parser.

Replace both regexes with strip_code(), a linear scanner following
CommonMark: fences open on a line starting with 3+ backticks (no backtick
in the info string) and close on a line holding only a run of at least
that length; an unclosed fence runs to end of text; an inline span of N
backticks closes only at the next run of exactly N, and an unmatched run
is literal. A regex with a backreference re-scans to EOF for each
unclosed run and is superlinear on backtick floods, hence the scanner.
Stripped code leaves its newlines (or a space), keeping sync's link line
numbers accurate and preventing text on either side fusing into [[.

The builtin provider's inline <code> delimiter now outgrows the backtick
runs i

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
 - **Note ids are fixed points of the slugifier, and the link validator rejects shell fragments and traversal (#126, from @fduple).** `write_note` built the filename from the raw id while the frontmatter id was slugified, and `repair` / `graph stub` pass broken-link text through as the id, so fetched content chose the path: `[[../../outside]]` wrote outside the vault, and `[[-n "$kernel"]]` crashed on Windows. Stub files now get slug filenames. `is_valid_wiki_link_target` also refuses targets containing `$ " \` = \ < > ;`, a leading `-` or `!`, or a `.`/`..` segment. Slug ids never contain those, but a title or alias link such as `[[E=mc2]]` that used to resolve by title will drop out of the links table on the next sync.
 - **`note mv` keeps notes where sync can see them (#128, from @fduple).** The destination was joined onto the vault root verbatim, so a bare name landed at the root with no `.md` and left the index, `../x.md` wrote outside the vault, and an existing file was overwritten (POSIX) or crashed the command (Windows). A bare name now lands in `research/notes/` with `.md` added; destinations outside `research/notes/` and `research/temp/` are refused with `OUTSIDE_SYNCED_TREE`, and an existing file with `DESTINATION_EXISTS`. `research/index/` is refused too, since `repair` regenerates it and deletes every `.md` there. Case-only renames work on case-insensitive filesystems. The docstring no longer claims `mv` updates references; the id lives in frontmatter, so it never needed to.
 - **The builtin provider keeps fetched code as markdown code (#129, from @fduple).** `<pre>` blocks and inline `<code>` were flattened to prose, so bash test syntax (`[[ -n "$k" ]]`) reached the wiki-link parser and `repair` minted stub notes named after shell fragments. `<pre>` now becomes a fenced block whose fence outruns any backtick run inside it, inline `<code>` becomes a backtick span, and indentation survives in the stdlib fallback. Because `strip_markdown` drops code before indexing, code on builtin-fetched pages is no longer in full-text search, embeddings, or the quote-integrity comparison, which is how crawl4ai-fetched pages already behaved. A report that quotes a sentence containing an inline identifier can now fail quote integrity where it passed before.
+- **Code stripping honours fence length (#140).** The strip that runs before wiki-link parsing closed a fenced block at the first ```` ``` ```` whatever the opening fence was, and an inline span at the first backtick. #129 fences fetched code with a run longer than any inside it, so a `<pre>` holding an odd number of ```` ``` ```` leaked its `[[ ]]` into the link parser. `CODE_BLOCK_RE` and `INLINE_CODE_RE` are replaced by `strip_code()`, a linear scanner that follows CommonMark: a fence opens on a line starting with 3+ backticks and closes on a line holding only at least as many; an opener nothing later can close is literal text (CommonMark would run it to the end of the note, which let a prose line starting with ```` ``` ```` drop the rest from links and search); an inline span of N backticks closes only at the next run of exactly N, and an unmatched run is literal. Stripped code now leaves its newlines behind, so the `links` table's line numbers match the note. The builtin provider's inline `<code>` delimiter also outgrows the backtick runs inside it, which the fixed ```` `` ```` did not.
 - **Skills name the CLI by its resolved path (#133, reported by @blrain3).** 14 of the 19 installed skills spelled the CLI `$HPR`, which nothing defined, so `$HPR run finish <tag>` (the ship gate) ran as `run finish` and the shell answered `command not found`. Skills now carry the `{hpr_path}` placeholder the agent prompts already used, and `install` (including `install --steps-only`, the entry skill's bootstrap) fills it with the same absolute path CLAUDE.md shows. The corpus-critic step had one literal `{hpr_path}` that was never substituted; it resolves now too. Re-run `hyperresearch install` to pick this up.
 - **The open-access URL gate uses the SSRF gate's address rules (#138).** `check_oa_url` classified resolved addresses with `is_global`, which on Python 3.11 passes IPv4-mapped and 6to4-wrapped CGNAT (`::ffff:100.64.0.1`, `2002:6440:1::`) — the addresses #127 closed on the fetch path. It now calls `safe_http.check_url` after its own credential and bare-hostname checks, and ignores `allow_private_hosts`. Europe PMC JATS downloads now go through `safe_get`, so a redirect to a private host is refused instead of followed.
 - **Cite-check samples at the configured rate.** `sample_needs_llm` kept every `round(1 / rate)`-th weak pair, so the default 0.6 sampled 50% and 0.3 sampled 33%. It now keeps exactly `rate` of them, spread evenly, still without an RNG.
```

**File**: `src/hyperresearch/core/note.py` (modified, +3/-6)
```diff
@@ -9,10 +9,9 @@
 
 from hyperresearch.core.frontmatter import parse_frontmatter, render_note
 from hyperresearch.core.patterns import (
-    CODE_BLOCK_RE,
-    INLINE_CODE_RE,
     WIKI_LINK_RE,
     is_valid_wiki_link_target,
+    strip_code,
 )
 from hyperresearch.models.note import Note, NoteMeta, slugify
 
@@ -46,8 +45,7 @@ def read_note(file_path: Path, vault_root: Path) -> Note:
         meta.id = slugify(file_path.stem)
 
     # Extract outgoing wiki links, filtering citation footnotes and URLs
-    cleaned = CODE_BLOCK_RE.sub("", body)
-    cleaned = INLINE_CODE_RE.sub("", cleaned)
+    cleaned = strip_code(body)
     raw_links = (m.group(1).strip().rstrip("\\") for m in WIKI_LINK_RE.finditer(cleaned))
     outgoing = list(dict.fromkeys(
         ref for ref in raw_links if is_valid_wiki_link_target(ref)
@@ -157,8 +155,7 @@ def write_note(
 
 def strip_markdown(text: str) -> str:
     """Strip markdown formatting to plain text for FTS indexing."""
-    text = CODE_BLOCK_RE.sub("", text)
-    text = INLINE_CODE_RE.sub("", text)
+    text = strip_code(text)
     text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
     text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
     text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)
```

**File**: `src/hyperresearch/core/patterns.py` (modified, +118/-3)
```diff
@@ -23,9 +23,124 @@
 # is_valid_wiki_link_target's bracket-balance check; now it never matches.
 WIKI_LINK_RE = re.compile(r"\[\[([^\]\[|]+)(?:\|[^\]\[]+)?\]\](?!\()")
 
-# Code block patterns for stripping before link extraction
-CODE_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)
-INLINE_CODE_RE = re.compile(r"`[^`]+`")
+# --- Code stripping before link extraction and indexing ---------------------
+#
+# Code must be removed before WIKI_LINK_RE runs: bash test syntax
+# (`[[ -n "$k" ]]`) is lexically a wiki-link. This used to be two regexes,
+# ```.*?``` and `[^`]+`, which closed every span at the first backtick run
+# of any length. The builtin provider (#129) fences code with a run longer
+# than any inside it, as CommonMark requires, so code holding an odd number
+# of ``` ended the block early and leaked its [[ ]] into the parser (#140).
+#
+# The rules follow CommonMark where it matters here:
+#
+# - A fenced block opens on a line whose first non-blank characters are 3+
+#   backticks with no backtick after them, and closes on a line holding
+#   only a run of AT LEAST that many backticks. An opener with no such line
+#   after it is literal text, not a block to the end of the note: CommonMark
+#   would run it to the end, but a prose line that happens to start with ```
+#   would then drop the rest of the note from links and search. The builtin
+#   provider always closes its fences, so #140 does not depend on the
+#   unclosed case. Any indentation is accepted (fences inside list items).
+#   Tilde fences are not recognised, as before.
+# - An inline span opened by N backticks closes at the next run of EXACTLY
+#   N backticks; an unmatched run is literal text. Spans may cross lines,
+#   as the old regex allowed. Backtick runs that are not fences (mid-line
+#   ```x```, a line-start run followed by more backticks) are inline runs.
+#
+# Fetched bodies are attacker-controlled and this runs on every sync, so
+# it is a scanner, not a regex: a backreference regex re-scans to the end
+# of the text for every unclosed run and goes superlinear on backtick
+# floods. Both passes below are linear.
+#
+# Stripped code is replaced by the newlines it held (a space for a span
+# on one line), so sync's per-line link numbers stay true and text on
+# either side of a span cannot fuse into a new `[[`.
+
+_BACKTICK_RUN_RE = re.compile(r"`+")
+
+
+def _strip_fenced_blocks(text: str) -> str:
+    lines = text.split("\n")
+    runs: list[int] = []
+    closers: list[int] = []  # run length if the line could close a fence, else 0
+    for line in lines:
+        s = line.lstrip(" \t")
+        run = len(s) - len(s.lstrip("`"))
+        runs.append(run)
+        closers.append(run if run >= 3 and not s[run:].strip(" \t\r") else 0)
+    # longest_after[i]: the longest closer on any line after line i. An opener
+    # whose run nothing after it can match stays literal text, so each check
+    # is O(1) and the pass stays linear.
+    longest_after = [0] * len(lines)
+    best = 0
+    for i in range(len(lines) - 1, -1, -1):
+        longest_after[i] = best
+        best = max(best, closers[i])
+
+    out: list[str] = []
+    fence = 0  # length of the open fence's backtick run; 0 = not in a block
+    for i, line in enumerate(lines):
+        run = runs[i]
+        if fence:
+            if closers[i] >= fence:
+                fence = 0
+            out.append("")
+        elif (
+            run >= 3
+            and "`" not in line.lstrip(" \t")[run:]
+            and longest_after[i] >= run
+        ):
+            fence = run
+            out.append("")
+        else:
+            out.append(line)
+    return "\n".join(out)
+
+
+def _strip_inline_code(text: str) -> str:
+    runs = [m.span() for m in _BACKTICK_RUN_RE.finditer(text)]
+    if len(runs) < 2:
+        return text
+    # Run indices grouped by length; each group's cursor only moves forward,
+    # so finding every closer costs O(runs) in total.
+    by_len: dict[int, list[int]] = {}
+    for i, (a, b) in enumerate(runs):
+        by_len.setdefault(b - a, []).append(i)
+    cursor = dict.fromkeys(by_len, 0)
+
+    out: list[str] = []
+    pos = 0
+    i = 0
+    while i < len(runs):
+        a, b = runs[i]
+        n = b - a
+        group = by_len[n]
+        k = cursor[n]
+        while k < len(group) and group[k] <= i:
+            k += 1
+        cursor[n] = k
+        if k == len(group):
+            i += 1  # no closer: the run is literal text
+            continue
+        j = group[k]
+        end = runs[j][1]
+        newlines = text.count("\n", a, end)
+        out.append(text[pos:a])
+        out.append("\n" * newlines if newlines else " ")
+        pos = end
+        i = j + 1
+    out.append(text[pos:])
+    return "".join(out)
+
+
+def strip_code(text: str) -> str:
+    """Remove fenced code blocks, then inline code spans, from markdown.
+
+    Run this before WIKI_LINK_RE so code is never parsed as links. Linear in
+    the length of the t
```

**File**: `src/hyperresearch/core/sync.py` (modified, +2/-4)
```diff
@@ -12,10 +12,9 @@
 
 from hyperresearch.core.note import read_note, strip_markdown
 from hyperresearch.core.patterns import (
-    CODE_BLOCK_RE,
-    INLINE_CODE_RE,
     WIKI_LINK_RE,
     is_valid_wiki_link_target,
+    strip_code,
 )
 
 
@@ -316,8 +315,7 @@ def _upsert_note_to_db(conn, note, synced_at: str, file_mtime: float = 0) -> Non
     # Update links — extract from original body (not stripped)
     # Uses the shared filter so this path stays in sync with core.note.read_note
     conn.execute("DELETE FROM links WHERE source_id = ?", (meta.id,))
-    cleaned = CODE_BLOCK_RE.sub("", note.body)
-    cleaned = INLINE_CODE_RE.sub("", cleaned)
+    cleaned = strip_code(note.body)
     for line_num, line in enumerate(cleaned.split("\n"), 1):
         for m in WIKI_LINK_RE.finditer(line):
             target_ref = m.group(1).strip().rstrip("\\")  # Strip trailing backslash (shell escaping artifact)
```

**File**: `src/hyperresearch/web/builtin.py` (modified, +13/-4)
```diff
@@ -29,10 +29,13 @@
 # Both extraction branches below share these helpers.
 
 
+def _longest_backtick_run(text: str) -> int:
+    return max((len(m.group(0)) for m in re.finditer(r"`+", text)), default=0)
+
+
 def _fence_for(code: str) -> str:
     """Return a backtick fence longer than any backtick run inside the code."""
-    longest = max((len(m.group(0)) for m in re.finditer(r"`+", code)), default=0)
-    return "`" * max(3, longest + 1)
+    return "`" * max(3, _longest_backtick_run(code) + 1)
 
 
 def _fenced(code: str) -> str:
@@ -43,9 +46,15 @@ def _fenced(code: str) -> str:
 
 
 def _inline_code(text: str) -> str:
-    """Wrap inline code in backticks (doubled when the text contains one)."""
+    """Wrap inline code in a backtick run no run inside the text can close.
+
+    A span of N backticks closes at the next run of exactly N, so the
+    delimiter must outrun every run inside; a fixed ```` `` ```` let text
+    holding ```` `` ```` end the span early and leak what followed (#140).
+    """
     if "`" in text:
-        return f"`` {text} ``"
+        ticks = "`" * (_longest_backtick_run(text) + 1)
+        return f"{ticks} {text} {ticks}"
     return f"`{text}`"
 
 
```

**File**: `tests/test_core/test_patterns.py` (modified, +25/-1)
```diff
@@ -1,6 +1,6 @@
 """Tests for wiki-link target validation — citation-footnote edge cases."""
 
-from hyperresearch.core.patterns import is_valid_wiki_link_target
+from hyperresearch.core.patterns import is_valid_wiki_link_target, strip_code
 
 
 def test_empty_and_whitespace_rejected():
@@ -224,6 +224,30 @@ def test_template_placeholder_check_is_linear():
         assert time.perf_counter() - started < 1.0
 
 
+def test_code_strip_is_linear_on_backtick_floods():
+    # Runs on every fetched body before link extraction (#140). A
+    # backreference regex matching closing fences to opening ones re-scans
+    # to the end of the text for every unclosed run: the staircase of
+    # distinct, never-closed run lengths is the worst case for that shape.
+    import time
+
+    floods = {
+        "`": "`" * 300_000,
+        "```\\n": "```\n" * 75_000,
+        "`a": "`a" * 150_000,
+        "``` ": "``` " * 75_000,
+        "unclosed ````": "````\n" + "```\n" * 75_000,
+        "never-closed openers": "```x\n" * 75_000,
+        "descending openers": "".join("`" * n + "\n" for n in range(1500, 2, -1)),
+        "staircase": "".join("`" * n + "a" for n in range(1500, 0, -1)),
+    }
+    for name, flood in floods.items():
+        started = time.perf_counter()
+        strip_code(flood)
+        elapsed = time.perf_counter() - started
+        assert elapsed < 1.0, f"{name!r} flood took {elapsed:.2f}s"
+
+
 def test_interior_open_bracket_never_matches():
     # Previously matched as target `t.IO[t.Any` and was rejected downstream
     # by the bracket-balance check; now the pattern itself refuses it.
```

**File**: `tests/test_graph/test_links.py` (modified, +91/-3)
```diff
@@ -1,6 +1,6 @@
 """Tests for link parsing and graph operations."""
 
-from hyperresearch.core.note import CODE_BLOCK_RE, INLINE_CODE_RE, WIKI_LINK_RE
+from hyperresearch.core.patterns import WIKI_LINK_RE, strip_code
 
 
 def test_wiki_link_regex_simple():
@@ -25,20 +25,108 @@ def test_wiki_link_regex_multiple():
 
 def test_wiki_link_not_in_code_block():
     text = "```python\n[[not-a-link]]\n```\n\n[[real-link]]"
-    cleaned = CODE_BLOCK_RE.sub("", text)
+    cleaned = strip_code(text)
     matches = WIKI_LINK_RE.findall(cleaned)
     assert len(matches) == 1
     assert "real-link" in matches[0]
 
 
 def test_wiki_link_not_in_inline_code():
     text = "Use `[[not-a-link]]` but also [[real-link]]"
-    cleaned = INLINE_CODE_RE.sub("", text)
+    cleaned = strip_code(text)
     matches = WIKI_LINK_RE.findall(cleaned)
     assert len(matches) == 1
     assert "real-link" in matches[0]
 
 
+def _links(text: str) -> list[str]:
+    return WIKI_LINK_RE.findall(strip_code(text))
+
+
+# --- Fence length is honoured (#140) ------------------------------------------
+
+
+def test_issue_140_odd_inner_fence_does_not_leak():
+    # The #129 builtin provider fences a <pre> holding ``` with ````.
+    text = "````\n```\n[[ -n y ]]\n````\n\n[[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_longer_outer_fence_holds_inner_fenced_block():
+    text = (
+        "`````markdown\n"
+        "```bash\n[[ -f x ]]\n```\n"
+        "````\n[[inside-too]]\n"
+        "`````\n"
+        "after [[real-link]]"
+    )
+    assert _links(text) == ["real-link"]
+
+
+def test_closing_fence_may_be_longer_than_opening():
+    text = "```\n[[code]]\n`````\n[[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_fence_line_with_trailing_text_does_not_close():
+    text = "```\n``` not a closer [[code]]\n```\n[[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_indented_fence_in_list_item():
+    text = "- step:\n    ```bash\n    [[ -n y ]]\n    ```\n- see [[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_unclosed_fence_is_literal_text():
+    # An opener nothing later can close is text, not a block to the end of
+    # the note: a prose line starting with ``` must not drop what follows.
+    text = "[[before]]\n```\n[[kept]]\n[[also-kept]]"
+    assert _links(text) == ["before", "kept", "also-kept"]
+
+
+def test_prose_line_starting_with_backticks_keeps_the_rest():
+    text = "Use\n``` to open a fence\nand then [[real-link]] later"
+    assert _links(text) == ["real-link"]
+
+
+def test_unclosed_long_fence_does_not_hide_a_later_block():
+    text = "`````\n[[shown]]\n```\n[[hidden]]\n```\n[[after]]"
+    assert _links(text) == ["shown", "after"]
+
+
+def test_double_backtick_span_holding_single_backtick():
+    text = "Run `` echo `x` [[x]] `` then read [[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_inline_span_closes_only_on_equal_length_run():
+    text = "`a``[[x]]` and ``b`[[y]]`` and [[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_mid_line_triple_backticks_are_an_inline_span():
+    # Not a fence (not at line start), so it is an inline span of length 3,
+    # stripped as the old regex did.
+    text = "Use ```[[x]]``` or [[real-link]]"
+    assert _links(text) == ["real-link"]
+
+
+def test_unmatched_backtick_run_is_literal():
+    text = "a stray ` backtick, then [[real-link]] and ``` more [[other]]"
+    assert _links(text) == ["real-link", "other"]
+
+
+def test_stripped_span_cannot_fuse_brackets():
+    assert _links("[`x`[y]]") == []
+
+
+def test_strip_keeps_line_numbers():
+    text = "a\n```\none\ntwo\n```\n`multi\nline`\n[[real-link]]"
+    cleaned = strip_code(text)
+    assert cleaned.count("\n") == text.count("\n")
+    assert cleaned.split("\n")[7] == "[[real-link]]"
+
 def test_backlinks_populated(seeded_vault):
     """Concurrency links to python-async-patterns, so python-async-patterns should have a backlink."""
     rows = seeded_vault.db.execute(
```

**File**: `tests/test_web/test_builtin_fences.py` (modified, +17/-4)
```diff
@@ -11,10 +11,9 @@
 import pytest
 
 from hyperresearch.core.patterns import (
-    CODE_BLOCK_RE,
-    INLINE_CODE_RE,
     WIKI_LINK_RE,
     is_valid_wiki_link_target,
+    strip_code,
 )
 from hyperresearch.web.builtin import BuiltinProvider, _TextExtractor
 from hyperresearch.web.pdf import PDF_FAILURE_KEY
@@ -39,8 +38,7 @@
 
 def _surviving_links(text: str) -> list[str]:
     """The exact strip-then-extract sequence core/note.py runs on a note body."""
-    cleaned = CODE_BLOCK_RE.sub("", text)
-    cleaned = INLINE_CODE_RE.sub("", cleaned)
+    cleaned = strip_code(text)
     raw = (m.group(1).strip().rstrip("\\") for m in WIKI_LINK_RE.finditer(cleaned))
     return [ref for ref in raw if is_valid_wiki_link_target(ref)]
 
@@ -77,6 +75,21 @@ def test_fence_outgrows_backticks_inside_code(self):
         assert "````" in text
         assert _surviving_links(text) == []
 
+    def test_odd_backtick_fence_inside_pre_does_not_leak(self):
+        # #140: the fence outgrows the ``` inside, and the strip must honour
+        # that length instead of closing at the inner ```. The second target
+        # passes the link validator, so only the strip stands in its way.
+        html = "<html><body><pre>```\n[[ -n y ]]\n[[looks-like-a-note]]</pre></body></html>"
+        _, text = self.extract(html)
+        assert "````" in text
+        assert WIKI_LINK_RE.findall(strip_code(text)) == []
+
+    def test_inline_code_holding_double_backticks_does_not_leak(self):
+        html = "<html><body><p>Try <code>a``b [[looks-like-a-note]]</code> now.</p></body></html>"
+        _, text = self.extract(html)
+        assert "``` a``b [[looks-like-a-note]] ```" in text
+        assert WIKI_LINK_RE.findall(strip_code(text)) == []
+
     def test_title_and_noise_removal_unchanged(self):
         html = (
             "<html><head><title>T</title></head><body>"
```

---

### Incident Patch 4: `d329565d` (2026-09-22)
**Commit Message**: fix: resolve $HPR in skills, route OA URLs through the SSRF gate, Python 3.14 (#141)

- #133: skills spelled the CLI `$HPR`, which nothing defined. They now carry
  `{hpr_path}`, filled at install with the resolved executable path, the
  same way agent prompts get it. `install --steps-only` resolves it too.
- #138: `check_oa_url` delegates address classification to
  `safe_http.check_url`, so mapped / 6to4-wrapped private ranges are
  refused on 3.11. JATS downloads go through `safe_get`, which revalidates
  every redirect hop.
- cite-check sampling hits the configured rate (0.6 sampled 50%).
- #81: allow Python 3.14 and add it to the CI matrix.
- #103: label the dissertation tier experimental in README and the router.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
       fail-fast: false
       matrix:
         os: [ubuntu-latest]
-        python-version: ["3.11", "3.12", "3.13"]
+        python-version: ["3.11", "3.12", "3.13", "3.14"]
         include:
           # The maintainer develops on Windows; socket, path and signal
           # semantics differ enough (#104) that ubuntu-only checks cannot
```

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -11,6 +11,11 @@
 - **Note ids are fixed points of the slugifier, and the link validator rejects shell fragments and traversal (#126, from @fduple).** `write_note` built the filename from the raw id while the frontmatter id was slugified, and `repair` / `graph stub` pass broken-link text through as the id, so fetched content chose the path: `[[../../outside]]` wrote outside the vault, and `[[-n "$kernel"]]` crashed on Windows. Stub files now get slug filenames. `is_valid_wiki_link_target` also refuses targets containing `$ " \` = \ < > ;`, a leading `-` or `!`, or a `.`/`..` segment. Slug ids never contain those, but a title or alias link such as `[[E=mc2]]` that used to resolve by title will drop out of the links table on the next sync.
 - **`note mv` keeps notes where sync can see them (#128, from @fduple).** The destination was joined onto the vault root verbatim, so a bare name landed at the root with no `.md` and left the index, `../x.md` wrote outside the vault, and an existing file was overwritten (POSIX) or crashed the command (Windows). A bare name now lands in `research/notes/` with `.md` added; destinations outside `research/notes/` and `research/temp/` are refused with `OUTSIDE_SYNCED_TREE`, and an existing file with `DESTINATION_EXISTS`. `research/index/` is refused too, since `repair` regenerates it and deletes every `.md` there. Case-only renames work on case-insensitive filesystems. The docstring no longer claims `mv` updates references; the id lives in frontmatter, so it never needed to.
 - **The builtin provider keeps fetched code as markdown code (#129, from @fduple).** `<pre>` blocks and inline `<code>` were flattened to prose, so bash test syntax (`[[ -n "$k" ]]`) reached the wiki-link parser and `repair` minted stub notes named after shell fragments. `<pre>` now becomes a fenced block whose fence outruns any backtick run inside it, inline `<code>` becomes a backtick span, and indentation survives in the stdlib fallback. Because `strip_markdown` drops code before indexing, code on builtin-fetched pages is no longer in full-text search, embeddings, or the quote-integrity comparison, which is how crawl4ai-fetched pages already behaved. A report that quotes a sentence containing an inline identifier can now fail quote integrity where it passed before.
+- **Skills name the CLI by its resolved path (#133, reported by @blrain3).** 14 of the 19 installed skills spelled the CLI `$HPR`, which nothing defined, so `$HPR run finish <tag>` (the ship gate) ran as `run finish` and the shell answered `command not found`. Skills now carry the `{hpr_path}` placeholder the agent prompts already used, and `install` (including `install --steps-only`, the entry skill's bootstrap) fills it with the same absolute path CLAUDE.md shows. The corpus-critic step had one literal `{hpr_path}` that was never substituted; it resolves now too. Re-run `hyperresearch install` to pick this up.
+- **The open-access URL gate uses the SSRF gate's address rules (#138).** `check_oa_url` classified resolved addresses with `is_global`, which on Python 3.11 passes IPv4-mapped and 6to4-wrapped CGNAT (`::ffff:100.64.0.1`, `2002:6440:1::`) — the addresses #127 closed on the fetch path. It now calls `safe_http.check_url` after its own credential and bare-hostname checks, and ignores `allow_private_hosts`. Europe PMC JATS downloads now go through `safe_get`, so a redirect to a private host is refused instead of followed.
+- **Cite-check samples at the configured rate.** `sample_needs_llm` kept every `round(1 / rate)`-th weak pair, so the default 0.6 sampled 50% and 0.3 sampled 33%. It now keeps exactly `rate` of them, spread evenly, still without an RNG.
+- **Python 3.14 (#81, requested by @cjangrist).** `requires-python` is now `<3.15`, and CI runs 3.14. No code changes were needed; the full suite passes on 3.14.2.
+- **The dissertation tier is labelled experimental (#103).** Its word, read-budget and citation targets are defined in the profile but no prompt or check reads them. README and the router now say so, and the router tells the orchestrator to warn the user before starting one.
 
 ## [0.11.1] - 2026-09-11
 
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -29,7 +29,7 @@
 - **Paywalled papers get read, not skimmed.** A closed paper normally enters a vault as a 1,500-character abstract that the report then cites as though it had been read. Hyperresearch asks Unpaywall, Europe PMC and CORE for a legal open-access copy and stores the full text instead, even when the publisher blocks the fetch outright. Every substitution is disclosed in the note, the frontmatter, and the CLI output.
 - **Nothing is thrown away.** Every source lands in a searchable markdown-plus-SQLite vault that your next session reuses before it fetches anything new.
 - **Crashed runs resume.** Each run keeps a manifest; `run resume` picks up at the exact step where it died.
-- **Scales from 30 minutes to a dissertation.** Bounded queries auto-route to a 5-step fast path. Opt-in dissertation runs write 25K–80K words across chapters, from 300–450 sources.
+- **Scales from 30 minutes to a dissertation.** Bounded queries auto-route to a 5-step fast path. Opt-in dissertation runs (experimental) write 25K–80K words across chapters, from 300–450 sources.
 
 ## Install
 
@@ -40,7 +40,7 @@ pip install hyperresearch && hyperresearch install
 
 Then `/hyperresearch <anything>` in Claude Code.
 
-> Python 3.11–3.13. (3.14 not yet supported. Use `pyenv install 3.13`, `uv venv -p 3.13`, or `py -3.13 -m venv .venv`.)
+> Python 3.11–3.14.
 >
 > Power users: `hyperresearch install --global` makes `/hyperresearch` reachable from every Claude Code session anywhere, at the cost of ~15 lines in every session's system reminder. Per-project install (above) keeps unrelated CC sessions clean.
 
@@ -73,13 +73,13 @@ The entry skill is a thin router. It pins down the canonical research query, the
 
 ### Tiers and gears: the two scale levers
 
-**Tiers** route per query. Step 1 auto-classifies `light` vs `full`. `dissertation` is opt-in only; ask for it in your prompt.
+**Tiers** route per query. Step 1 auto-classifies `light` vs `full`. `dissertation` is opt-in only; ask for it in your prompt. It is experimental: its length, read-budget and citation targets are configured but not yet wired in ([#103](https://github.com/jordan-gibbs/hyperresearch/issues/103)).
 
 | Tier | What runs | Typical time |
 |---|---|---|
 | `light` | bounded factual queries, surveys, comparisons: 1 → 2 → 10 → 15 → 16 | ~30–40 min |
 | `full` (default) | deep argumentative analysis with adversarial review: all 16 steps + cite-check | ~1.5–2.5 h at `full` gear |
-| `dissertation` | chaptered mega-runs: 300–450 sources across 4–10 chapters, 25K–80K words | ~4–8 hours |
+| `dissertation` (experimental) | chaptered mega-runs: 300–450 sources across 4–10 chapters, 25K–80K words | ~4–8 hours |
 
 **Gears** set the scale of the standard pipeline: the source targets, depth budgets, and word targets rendered into the step skills.
 
```

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -8,7 +8,7 @@ version = "0.11.1"
 description = "Claude Code harness for disciplined, adversarially-audited deep research with full provenance."
 readme = "README.md"
 license = "MIT"
-requires-python = ">=3.11,<3.14"
+requires-python = ">=3.11,<3.15"
 authors = [{name = "Jordan Gibbs", email = "jordan@jordangibbs.xyz"}]
 keywords = ["research", "knowledge-base", "wiki", "llm", "markdown", "cli", "agent", "zettelkasten"]
 classifiers = [
@@ -19,6 +19,7 @@ classifiers = [
     "Programming Language :: Python :: 3.11",
     "Programming Language :: Python :: 3.12",
     "Programming Language :: Python :: 3.13",
+    "Programming Language :: Python :: 3.14",
     "Topic :: Text Processing :: Markup :: Markdown",
 ]
 dependencies = [
```

**File**: `src/hyperresearch/cli/install.py` (modified, +3/-1)
```diff
@@ -78,7 +78,9 @@ def _check_profile(resolved: str, config_path: Path | None) -> None:
         steps_profile = _default_profile(steps_config_path)
         _check_profile(steps_profile, steps_config_path)
         _set_render_state(steps_profile, steps_config_path)
-        result = _install_hyperresearch_step_skills(target)
+        from hyperresearch.core.agent_docs import _resolve_executable
+
+        result = _install_hyperresearch_step_skills(target, _resolve_executable())
         if json_output:
             output(
                 success({"steps_installed": result, "target": str(target)}, vault=None),
```

**File**: `src/hyperresearch/cli/lint.py` (modified, +2/-2)
```diff
@@ -973,7 +973,7 @@ def _extract_prompt_text(body_lines: list[str], header_line_idx: int) -> str:
                         f"Vault has {len(source_rows)} fetched source notes but ZERO "
                         f"`*Suggested by [[...]]` breadcrumbs. The bouncing reading loop never "
                         f"fired — every fetch was a flat batch with no link back to the source "
-                        f"that proposed it. Use `$HPR fetch ... --suggested-by <source-note-id> "
+                        f"that proposed it. Use `hyperresearch fetch ... --suggested-by <source-note-id> "
                         f"--suggested-by-reason \"<why>\"` for every follow-up fetch."
                     ),
                 })
@@ -1801,7 +1801,7 @@ def _count_by_tag(tag: str) -> int:
                         f"The finding was '{guard['description']}'. The draft's `fixed_at` "
                         f"marker does not match the vault's actual state — you must fix the "
                         f"underlying issue (not just the bookkeeping). Run "
-                        f"`$HPR lint --rule {guard['rule']} -j` to see what's still broken."
+                        f"`hyperresearch lint --rule {guard['rule']} -j` to see what's still broken."
                     ),
                 })
 
```

**File**: `src/hyperresearch/core/citecheck.py` (modified, +11/-8)
```diff
@@ -175,21 +175,24 @@ def _claims(note_id: str) -> list[dict]:
 
 def sample_needs_llm(pairs: list[dict], sample_rate: float = 0.6) -> list[dict]:
     """Deterministic sampling of the LLM tier: 100% of strong (number-bearing)
-    sentences, every k-th of the rest. No RNG — reproducible across resumes."""
+    sentences, `sample_rate` of the rest. No RNG — reproducible across resumes.
+
+    A weak pair is kept whenever floor(seen * rate) steps up, which spreads the
+    kept pairs evenly and hits the rate exactly. The old every-k-th rule
+    rounded 1/rate, so 0.6 became every 2nd and sampled 50%.
+    """
     out = []
-    weak_kept = 0
     weak_seen = 0
-    keep_every = max(1, round(1 / sample_rate)) if sample_rate > 0 else 0
+    rate = min(max(sample_rate, 0.0), 1.0)
     for pair in pairs:
         if pair.get("verdict") != "needs-llm":
             continue
         if pair["strong"]:
             out.append(pair)
-        elif keep_every:
-            weak_seen += 1
-            if weak_seen % keep_every == 0:
-                out.append(pair)
-                weak_kept += 1
+            continue
+        weak_seen += 1
+        if int(weak_seen * rate) > int((weak_seen - 1) * rate):
+            out.append(pair)
     return out
 
 
```

**File**: `src/hyperresearch/core/hooks.py` (modified, +17/-9)
```diff
@@ -39,13 +39,19 @@ def _get_render_state() -> dict:
     return _RENDER_STATE
 
 
-def _render_installed(content: str) -> str:
-    """Render a prompt template and stamp the provenance header."""
+def _render_installed(content: str, hpr_path: str = "hyperresearch") -> str:
+    """Render a prompt template, resolve `{hpr_path}`, and stamp the provenance header.
+
+    Skills spell the CLI `{hpr_path}`, the placeholder the agent prompts fill
+    with `.format()`. Skills carry literal braces elsewhere, so this is a plain
+    replace rather than a format call.
+    """
     from hyperresearch import __version__
     from hyperresearch.core.render import insert_after_frontmatter, render_header, render_prompt
 
     state = _get_render_state()
     rendered = render_prompt(content, state["context"])
+    rendered = rendered.replace("{hpr_path}", hpr_path.replace("\\", "/"))
     header = render_header(state["profile_name"], __version__)
     return insert_after_frontmatter(rendered, header)
 
@@ -3587,8 +3593,8 @@ def install_hooks(
 
     for installer in (
         lambda: _install_claude_hook(vault_root, hpr_path),
-        lambda: _install_hyperresearch_skill(vault_root),
-        lambda: _install_hyperresearch_step_skills(vault_root),
+        lambda: _install_hyperresearch_skill(vault_root, hpr_path),
+        lambda: _install_hyperresearch_step_skills(vault_root, hpr_path),
         lambda: _install_researcher_agent(vault_root, hpr_path),
         lambda: _install_loci_analyst_agent(vault_root, hpr_path),
         lambda: _install_depth_investigator_agent(vault_root, hpr_path),
@@ -3649,7 +3655,7 @@ def install_global_hooks(
     actions = []
 
     for installer in (
-        lambda: _install_hyperresearch_skill(home),
+        lambda: _install_hyperresearch_skill(home, hpr_path),
         lambda: _install_researcher_agent(home, hpr_path),
         lambda: _install_loci_analyst_agent(home, hpr_path),
         lambda: _install_depth_investigator_agent(home, hpr_path),
@@ -4096,7 +4102,7 @@ def _read_skill_source(src_name: str) -> str | None:
         return None
 
 
-def _install_hyperresearch_skill(vault_root: Path) -> str | None:
+def _install_hyperresearch_skill(vault_root: Path, hpr_path: str = "hyperresearch") -> str | None:
     """Install the entry skill at .claude/skills/hyperresearch/SKILL.md.
 
     Claude Code registers `/hyperresearch` as the slash-command trigger via
@@ -4106,7 +4112,7 @@ def _install_hyperresearch_skill(vault_root: Path) -> str | None:
     content = _read_skill_source("hyperresearch.md")
     if content is None:
         return None
-    content = _render_installed(content)
+    content = _render_installed(content, hpr_path)
 
     skill_dir = vault_root / ".claude" / "skills" / "hyperresearch"
     skill_dir.mkdir(parents=True, exist_ok=True)
@@ -4169,7 +4175,9 @@ def step_skill_slug(step: str | None) -> str | None:
     return STEP_SKILL_BY_ID.get(str(step))
 
 
-def _install_hyperresearch_step_skills(vault_root: Path) -> str | None:
+def _install_hyperresearch_step_skills(
+    vault_root: Path, hpr_path: str = "hyperresearch"
+) -> str | None:
     """Install the 16 V8 step skills, each as its own Claude Code skill directory.
 
     Each step skill lives at `.claude/skills/hyperresearch-N-name/SKILL.md` and is
@@ -4194,7 +4202,7 @@ def _install_hyperresearch_step_skills(vault_root: Path) -> str | None:
         content = _read_skill_source(src_name)
         if content is None:
             continue
-        content = _render_installed(content)
+        content = _render_installed(content, hpr_path)
 
         skill_dir = skills_root / skill_name
         skill_dir.mkdir(parents=True, exist_ok=True)
```

---

### Incident Patch 5: `6240eac0` (2026-09-22)
**Commit Message**: fix: builtin provider flattens fetched code to prose (#129)

* fix: builtin provider flattens fetched code to prose

Every page the builtin web provider returns as HTML goes through
BuiltinProvider._extract(), whether fetch() reached it directly or after
the PDF lane declined a PDF-shaped URL and fell through to the landing
page. Both extraction branches (bs4 and the stdlib fallback) emit bare
get_text() output, so every `<pre>` block and inline `<code>` span in the
page reaches the vault as plain lines.

That matters beyond readability. The note parser strips fenced and inline
code before extracting [[wiki-links]], and bash test syntax is lexically
a wiki-link, so a flattened shell script turns every conditional into a
broken link that graph stub / repair then materialise as junk notes. One
Arch wiki page produced 40 stub notes named after shell fragments in a
real vault this way:

    ! -f "$KERNELDESTINATION".md
    "${HOSTID}" != "00000000".md

Minimal reproduction on main:

    BuiltinProvider()._extract(
        "<pre>[[ -n \"$kernel\" ]] || exit 0</pre>")[1]
    # -> '[[ -n "$kernel" ]] || exit 0'   (no fence; one wiki-link)

The fix, in _extract() and the stdlib _TextExtrac

**File**: `src/hyperresearch/core/scholar.py` (modified, +3/-1)
```diff
@@ -44,7 +44,9 @@
     r"content=[\"']\s*(?:doi:)?\s*(10\.[^\"']+)[\"']",
     re.IGNORECASE,
 )
-BODY_DOI_RE = re.compile(r"\bDOI:?\s*(10\.\d{4,9}/[^\s\"'<>\])}]+)", re.IGNORECASE)
+# Fetched bodies carry markdown code spans (`DOI: 10.x/y`, DOI: `10.x/y`), so a
+# backtick may open the DOI and never belongs to it.
+BODY_DOI_RE = re.compile(r"\bDOI:?\s*`?(10\.\d{4,9}/[^\s\"'<>\])}`]+)", re.IGNORECASE)
 
 # Per-host courtesy delay between UNCACHED requests, seconds.
 _HOST_DELAY = {
```

**File**: `src/hyperresearch/web/builtin.py` (modified, +109/-10)
```diff
@@ -21,43 +21,126 @@
     is_pdf_url,
 )
 
+# Code in fetched pages must reach the vault as markdown code, not prose.
+# Flattened <pre> content passes the extractor's code-strip untouched and
+# hits WIKI_LINK_RE, where bash test syntax ([[ -n "$kernel" ]]) is lexically
+# a wiki-link; repair/graph then materialise junk stub notes named after
+# shell fragments (40 such notes in one real vault from one Arch wiki page).
+# Both extraction branches below share these helpers.
+
+
+def _fence_for(code: str) -> str:
+    """Return a backtick fence longer than any backtick run inside the code."""
+    longest = max((len(m.group(0)) for m in re.finditer(r"`+", code)), default=0)
+    return "`" * max(3, longest + 1)
+
+
+def _fenced(code: str) -> str:
+    """Wrap a code block in a fence it cannot break out of."""
+    fence = _fence_for(code)
+    body = code.strip("\n")
+    return f"\n{fence}\n{body}\n{fence}\n"
+
+
+def _inline_code(text: str) -> str:
+    """Wrap inline code in backticks (doubled when the text contains one)."""
+    if "`" in text:
+        return f"`` {text} ``"
+    return f"`{text}`"
+
 
 class _TextExtractor(HTMLParser):
-    """Minimal HTML-to-text extractor (no external deps)."""
+    """Minimal HTML-to-text extractor (no external deps).
+
+    Emits <pre> blocks as fenced code and inline <code> as backtick spans;
+    see the module comment for why that is load-bearing, not cosmetic.
+    """
 
     def __init__(self):
         super().__init__()
-        self._pieces: list[str] = []
+        # (kind, text) where kind is "text" or "code"; code segments skip the
+        # per-line strip in get_text() so indentation survives.
+        self._segments: list[tuple[str, str]] = []
         self._skip = False
         self._skip_tags = {"script", "style", "nav", "footer", "header"}
         self._title = ""
         self._in_title = False
+        self._in_pre = False
+        self._pre_buf: list[str] = []
+        self._in_inline_code = False
 
     def handle_starttag(self, tag, attrs):
         if tag in self._skip_tags:
             self._skip = True
+            return
+        if self._in_pre:
+            if tag == "br":
+                self._pre_buf.append("\n")
+            return
         if tag == "title":
             self._in_title = True
+            return
+        if tag == "pre":
+            self._in_pre = True
+            self._pre_buf = []
+            return
+        if tag == "code":
+            self._in_inline_code = True
+            return
         if tag in ("p", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
-            self._pieces.append("\n")
+            self._segments.append(("text", "\n"))
 
     def handle_endtag(self, tag):
         if tag in self._skip_tags:
             self._skip = False
+            return
+        if tag == "pre" and self._in_pre:
+            self._in_pre = False
+            code = "".join(self._pre_buf)
+            self._pre_buf = []
+            if code.strip():
+                self._segments.append(("code", code))
+            return
         if tag == "title":
             self._in_title = False
+            return
+        if tag == "code":
+            self._in_inline_code = False
 
     def handle_data(self, data):
         if self._in_title:
             self._title = data.strip()
-        if not self._skip:
-            self._pieces.append(data)
+        if self._skip:
+            return
+        if self._in_pre:
+            self._pre_buf.append(data)
+            return
+        if self._in_inline_code:
+            if data.strip():
+                self._segments.append(("text", _inline_code(data)))
+            return
+        self._segments.append(("text", data))
 
     def get_text(self) -> str:
-        raw = "".join(self._pieces)
-        # Collapse whitespace
-        lines = [line.strip() for line in raw.splitlines()]
-        return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
+        out: list[str] = []
+        buf: list[str] = []
+
+        def flush() -> None:
+            raw = "".join(buf)
+            lines = [line.strip() for line in raw.splitlines()]
+            cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
+            if cleaned:
+                out.append(cleaned)
+            buf.clear()
+
+        for kind, text in self._segments:
+            if kind == "text":
+                buf.append(text)
+            else:
+                flush()
+                out.append(_fenced(text).strip("\n"))
+        flush()
+        return "\n\n".join(out)
 
 
 class BuiltinProvider:
@@ -144,13 +227,29 @@ def _download(self, url: str) -> tuple[str, str]:
     def _extract(self, html: str) -> tuple[str, str]:
         """Extract title and clean text from HTML. Tries bs4 first, falls back to stdlib."""
         try:
-            from bs4 import BeautifulSoup
+            from bs4 import BeautifulSoup, NavigableString
 
             soup = BeautifulSoup(html, "html.parser")
 
```

**File**: `tests/test_core/test_source_ranking.py` (modified, +6/-0)
```diff
@@ -104,6 +104,12 @@ def test_no_doi(self):
     def test_trailing_punctuation_stripped(self):
         assert extract_doi("https://x.com", content="see DOI: 10.1000/xyz123.") == "10.1000/xyz123"
 
+    def test_body_doi_inside_code_span(self):
+        # Extracted page text renders <code> as a backtick span; the backtick
+        # must not end up in the DOI, and must not hide it either.
+        assert extract_doi("https://x.com", content="cite `DOI: 10.1000/xyz123` here") == "10.1000/xyz123"
+        assert extract_doi("https://x.com", content="DOI: `10.1000/xyz123`") == "10.1000/xyz123"
+
 
 class TestPageRank:
     def test_hub_ranks_highest(self):
```

**File**: `tests/test_web/test_builtin_fences.py` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+"""The builtin provider must not flatten fetched code to prose.
+
+Flattened <pre>/<code> content passes the note parser's code-strip untouched
+and reaches WIKI_LINK_RE, where bash test syntax is lexically a wiki-link;
+repair/graph then materialise junk stub notes named after shell fragments
+(40 such notes in one real vault, all fetched via this provider). These
+tests pin markdown-shaped code handling in BOTH extraction branches: bs4
+and the stdlib fallback.
+"""
+
+import pytest
+
+from hyperresearch.core.patterns import (
+    CODE_BLOCK_RE,
+    INLINE_CODE_RE,
+    WIKI_LINK_RE,
+    is_valid_wiki_link_target,
+)
+from hyperresearch.web.builtin import BuiltinProvider, _TextExtractor
+from hyperresearch.web.pdf import PDF_FAILURE_KEY
+from hyperresearch.web.safe_http import SafeResponse
+
+# Shaped like the real defect page (a wiki page whose body carries a shell
+# script in <pre> plus a conditional in inline <code>, both with [[ ]] test
+# syntax).
+ARCH_WIKI_SHAPED = """<html><head><title>Secure Boot - ArchWiki</title></head>
+<body><main>
+<p>Create the following file and make it executable:</p>
+<pre>#!/usr/bin/env bash
+
+kernel="$1"
+[[ -n "$kernel" ]] || exit 0
+
+# use already installed kernel if it exists
+[[ ! -f "$KERNELDESTINATION" ]] || kernel="$KERNELDESTINATION"</pre>
+<p>Then check <code>[[ -f /boot/vmlinuz ]]</code> before rebooting.</p>
+</main></body></html>"""
+
+
+def _surviving_links(text: str) -> list[str]:
+    """The exact strip-then-extract sequence core/note.py runs on a note body."""
+    cleaned = CODE_BLOCK_RE.sub("", text)
+    cleaned = INLINE_CODE_RE.sub("", cleaned)
+    raw = (m.group(1).strip().rstrip("\\") for m in WIKI_LINK_RE.finditer(cleaned))
+    return [ref for ref in raw if is_valid_wiki_link_target(ref)]
+
+
+class _BranchContract:
+    """Shared assertions; subclasses supply the extraction branch."""
+
+    def extract(self, html: str) -> tuple[str, str]:
+        raise NotImplementedError
+
+    def test_pre_becomes_fenced_block(self):
+        _, text = self.extract(ARCH_WIKI_SHAPED)
+        assert "```" in text
+        assert '[[ -n "$kernel" ]] || exit 0' in text
+
+    def test_inline_code_becomes_backtick_span(self):
+        _, text = self.extract(ARCH_WIKI_SHAPED)
+        assert "`[[ -f /boot/vmlinuz ]]`" in text
+
+    def test_no_wiki_links_survive_the_note_strip(self):
+        # The end-to-end guarantee the fix exists for: after the exact
+        # code-strip the link extractor applies, no [[ ]] fragment remains.
+        _, text = self.extract(ARCH_WIKI_SHAPED)
+        assert _surviving_links(text) == []
+
+    def test_code_indentation_survives(self):
+        html = "<html><body><p>x</p><pre>if x:\n    do_thing()</pre></body></html>"
+        _, text = self.extract(html)
+        assert "    do_thing()" in text
+
+    def test_fence_outgrows_backticks_inside_code(self):
+        html = "<html><body><pre>echo ```already fenced```</pre></body></html>"
+        _, text = self.extract(html)
+        assert "````" in text
+        assert _surviving_links(text) == []
+
+    def test_title_and_noise_removal_unchanged(self):
+        html = (
+            "<html><head><title>T</title></head><body>"
+            "<nav>menu here</nav><p>body text</p><footer>foot here</footer>"
+            "</body></html>"
+        )
+        title, text = self.extract(html)
+        assert title == "T"
+        assert "menu here" not in text
+        assert "foot here" not in text
+        assert "body text" in text
+
+
+class TestBs4Branch(_BranchContract):
+    def extract(self, html: str) -> tuple[str, str]:
+        pytest.importorskip("bs4")
+        return BuiltinProvider()._extract(html)
+
+
+class TestStdlibBranch(_BranchContract):
+    def extract(self, html: str) -> tuple[str, str]:
+        parser = _TextExtractor()
+        parser.feed(html)
+        return parser._title, parser.get_text()
+
+
+# fetch() is the only way content leaves the provider: HTML fetched directly,
+# and HTML reached after the PDF lane declines a PDF-shaped URL. Both must go
+# through the code-preserving extraction, and the decline reason must still
+# travel with the result. The SSRF-gated download is stubbed at its source.
+
+
+@pytest.fixture
+def served(monkeypatch):
+    table: dict[str, SafeResponse] = {}
+
+    def fake_safe_get(url, *, max_bytes, timeout=None, headers=None, verify=True,
+                      allow_private_hosts=()):
+        return table[url]
+
+    monkeypatch.setattr("hyperresearch.web.safe_http.safe_get", fake_safe_get)
+    monkeypatch.setattr("hyperresearch.web.safe_http.check_url", lambda url, allow=(): None)
+    return table
+
+
+def _html(url: str, body: str, status: int = 200) -> SafeResponse:
+    return SafeResponse(url=url, status_code=status, headers={"content-type": "text/html"},
+                        content=body.encode())
+
+
+def test_fetch_html_lane_preserves_code(served):
+    url = "https://wiki.example.o
```

---

### Incident Patch 6: `847de424` (2026-09-22)
**Commit Message**: fix: note mv resolves the destination into the synced tree, and refuses outside-tree and overwrite (#128)

* fix: note mv resolves the destination into the synced tree, and refuses outside-tree and overwrite

`hpr note mv` joined its destination argument onto the vault root verbatim
and renamed the file. Three things followed from that.

A bare name, which is what an agent naturally passes, moved the file to
the vault root with no .md suffix. Sync scans only *.md files below
research/, so the note silently dropped out of the index while its file
sat next to the vault's own files. `hpr note mv beta-note beta-renamed`
reproduces it: the command reports success and new_path "beta-renamed".

Any other destination outside the synced tree was accepted the same way,
for example `notes/moved/beta-note.md` (the path the existing test used)
or `../x`.

Moving onto an existing file overwrote it. In a fresh vault with notes
alpha-note and beta-note, `hpr note mv beta-note
research/notes/alpha-note.md` reports success; alpha-note.md now holds
Beta's content, Alpha's content is gone, and the index row for alpha-note
points at Beta's file.

The fix resolves the destination before touching anythin

**File**: `src/hyperresearch/cli/note.py` (modified, +54/-5)
```diff
@@ -545,10 +545,24 @@ def note_update(
 @app.command("mv")
 def note_mv(
     note_id: str = typer.Argument(..., help="Note ID to move"),
-    new_path: str = typer.Argument(..., help="New relative path (e.g. notes/python/renamed.md)"),
+    new_path: str = typer.Argument(
+        ...,
+        help=(
+            "Destination relative to the vault root, e.g. research/notes/renamed.md. "
+            "A bare name lands in research/notes/ and a missing .md is added. The note "
+            "keeps its id (it lives in frontmatter, not the filename), so wiki-links to "
+            "it stay valid and nothing else is rewritten."
+        ),
+    ),
     json_output: bool = typer.Option(False, "--json", "-j", help="JSON output"),
 ) -> None:
-    """Move/rename a note, updating all references."""
+    """Move a note file within the tree sync scans (research/notes or research/temp).
+
+    The id is unchanged: `mv` moves the file, it does not rename the note.
+    """
+    from pathlib import Path
+
+    from hyperresearch.core.claims import _under
     from hyperresearch.core.sync import compute_sync_plan, execute_sync
     from hyperresearch.core.vault import Vault
 
@@ -564,7 +578,42 @@ def note_mv(
         raise typer.Exit(1)
 
     old_file = vault.root / row["path"]
-    new_file = vault.root / new_path
+
+    # Resolve the destination into something sync will see. Joined verbatim, a
+    # bare name landed at the vault root with no suffix, where sync never
+    # looks, so the note silently left the index; and rename() replaced an
+    # existing note file without a word. research/index/ is synced but not a
+    # destination: IndexGenerator.build_all() deletes every .md there on the
+    # next repair, so a note moved in would be lost.
+    dest = Path(new_path)
+    if dest.name and dest.suffix.lower() != ".md":
+        dest = dest.with_name(dest.name + ".md")
+    if dest.parent == Path("."):
+        dest = vault.notes_dir.relative_to(vault.root) / dest
+    new_file = vault.root / dest
+    synced_roots = (vault.notes_dir, vault.temp_dir)
+    if not any(_under(new_file, r) and new_file.resolve() != r.resolve() for r in synced_roots):
+        allowed = ", ".join(r.relative_to(vault.root).as_posix() + "/" for r in synced_roots)
+        msg = f"Destination {dest.as_posix()} is outside the synced tree ({allowed})"
+        if json_output:
+            output(error(msg, "OUTSIDE_SYNCED_TREE"), json_mode=True)
+        else:
+            console.print(f"[red]{msg}[/]")
+        raise typer.Exit(1)
+    # samefile: on a case-insensitive filesystem a case-only rename
+    # (n-f -> N-F.md) "exists" because it is the note's own file.
+    if new_file.exists() and not new_file.samefile(old_file):
+        msg = f"Destination already exists: {dest.as_posix()}"
+        if json_output:
+            output(error(msg, "DESTINATION_EXISTS"), json_mode=True)
+        else:
+            console.print(f"[red]{msg}[/]")
+        raise typer.Exit(1)
+    # Resolve the parent only: on a case-insensitive filesystem resolve() on the
+    # file itself returns the old spelling during a case-only rename.
+    rel_new = (
+        (new_file.parent.resolve() / new_file.name).relative_to(vault.root.resolve()).as_posix()
+    )
 
     new_file.parent.mkdir(parents=True, exist_ok=True)
     old_file.rename(new_file)
@@ -574,9 +623,9 @@ def note_mv(
     execute_sync(vault, plan)
 
     if json_output:
-        output(success({"old_path": row["path"], "new_path": new_path}, vault=str(vault.root)), json_mode=True)
+        output(success({"old_path": row["path"], "new_path": rel_new}, vault=str(vault.root)), json_mode=True)
     else:
-        console.print(f"[green]Moved:[/] {row['path']} → {new_path}")
+        console.print(f"[green]Moved:[/] {row['path']} → {rel_new}")
 
 
 @app.command("rm")
```

**File**: `tests/test_cli/test_note_ops.py` (modified, +85/-3)
```diff
@@ -88,15 +88,97 @@ def test_note_rm_cleans_raw_file_and_assets(vault_with_notes):
 
 
 def test_note_mv(vault_with_notes):
+    result = runner.invoke(
+        app, ["note", "mv", "beta-note", "research/notes/moved/beta-note.md", "--json"]
+    )
+    assert result.exit_code == 0, result.output
+    data = json.loads(result.output)
+    assert data["data"]["new_path"] == "research/notes/moved/beta-note.md"
+    assert (vault_with_notes / "research" / "notes" / "moved" / "beta-note.md").exists()
+
+
+# ---------------------------------------------------------------------------
+# `note mv` destinations must stay where sync can see them. The destination
+# used to be joined onto the vault root verbatim: a bare name landed at the
+# vault root with no .md suffix, outside everything sync scans, so the note
+# silently left the index; and an existing file was overwritten.
+# ---------------------------------------------------------------------------
+
+
+def _indexed_path(note_id: str) -> str | None:
+    from hyperresearch.core.vault import Vault
+
+    row = Vault.discover().db.execute(
+        "SELECT path FROM notes WHERE id = ?", (note_id,)
+    ).fetchone()
+    return row["path"] if row else None
+
+
+def test_note_mv_bare_name_lands_in_notes_dir_with_md_suffix(vault_with_notes):
+    result = runner.invoke(app, ["note", "mv", "beta-note", "beta-renamed", "--json"])
+    assert result.exit_code == 0, result.output
+    data = json.loads(result.output)
+    assert data["data"]["new_path"] == "research/notes/beta-renamed.md"
+    assert (vault_with_notes / "research" / "notes" / "beta-renamed.md").exists()
+    assert not (vault_with_notes / "beta-renamed").exists()
+    # The id lives in frontmatter, so the note stays indexed under it, at the new path.
+    assert _indexed_path("beta-note") == "research/notes/beta-renamed.md"
+
+
+def test_note_mv_refuses_a_destination_outside_the_synced_tree(vault_with_notes):
     result = runner.invoke(
         app, ["note", "mv", "beta-note", "notes/moved/beta-note.md", "--json"]
     )
-    assert result.exit_code == 0
+    assert result.exit_code == 1, result.output
     data = json.loads(result.output)
-    assert data["data"]["new_path"] == "notes/moved/beta-note.md"
-    assert (vault_with_notes / "notes" / "moved" / "beta-note.md").exists()
+    assert data["ok"] is False
+    assert data["error_code"] == "OUTSIDE_SYNCED_TREE"
+    assert (vault_with_notes / "research" / "notes" / "beta-note.md").exists()
+    assert not (vault_with_notes / "notes").exists()
+    assert _indexed_path("beta-note") == "research/notes/beta-note.md"
+
+
+@pytest.mark.parametrize("dest", ["research/notes/alpha-note.md", "alpha-note"])
+def test_note_mv_refuses_to_overwrite_an_existing_file(vault_with_notes, dest):
+    result = runner.invoke(app, ["note", "mv", "beta-note", dest, "--json"])
+    assert result.exit_code == 1, result.output
+    data = json.loads(result.output)
+    assert data["error_code"] == "DESTINATION_EXISTS"
+    alpha = (vault_with_notes / "research" / "notes" / "alpha-note.md").read_text(encoding="utf-8")
+    assert "id: alpha-note" in alpha
+    assert _indexed_path("alpha-note") == "research/notes/alpha-note.md"
+    assert _indexed_path("beta-note") == "research/notes/beta-note.md"
+
+
+
+def test_note_mv_refuses_the_index_dir(vault_with_notes):
+    # build_all() wipes research/index/*.md on every repair, so a note moved
+    # there would be deleted the next time the index regenerates.
+    result = runner.invoke(
+        app, ["note", "mv", "beta-note", "research/index/beta-note.md", "--json"]
+    )
+    assert result.exit_code == 1, result.output
+    assert json.loads(result.output)["error_code"] == "OUTSIDE_SYNCED_TREE"
+    assert _indexed_path("beta-note") == "research/notes/beta-note.md"
+
+
+def test_note_mv_allows_a_case_only_rename(vault_with_notes):
+    result = runner.invoke(
+        app, ["note", "mv", "beta-note", "research/notes/Beta-Note.md", "--json"]
+    )
+    assert result.exit_code == 0, result.output
+    assert json.loads(result.output)["data"]["new_path"] == "research/notes/Beta-Note.md"
+    names = [f.name for f in (vault_with_notes / "research" / "notes").iterdir()]
+    assert "Beta-Note.md" in names
+    assert "beta-note.md" not in names
+    assert _indexed_path("beta-note") == "research/notes/Beta-Note.md"
 
 
+def test_note_mv_does_not_double_an_uppercase_suffix(vault_with_notes):
+    result = runner.invoke(app, ["note", "mv", "beta-note", "Renamed.MD", "--json"])
+    assert result.exit_code == 0, result.output
+    assert json.loads(result.output)["data"]["new_path"] == "research/notes/Renamed.MD"
+
 def test_note_show_raw(vault_with_notes):
     result = runner.invoke(app, ["note", "show", "alpha-note", "--raw"])
     assert result.exit_code == 0
```

---

### Incident Patch 7: `a2623559` (2026-09-22)
**Commit Message**: fix: note ids are fixed points of the slugifier; link validator rejects shell fragments and traversal (#126)

write_note slugifies only the frontmatter id (NoteMeta.ensure_slug runs
on the id field) while building the filename from the raw note_id, so
the two diverge for any caller that passes unslugified text. `repair`
and `graph stub` pass broken-link text verbatim, and broken-link text is
arbitrary fetched content: when a fetcher flattens <pre> blocks to
prose, bash test syntax like [[ -n "$kernel" ]] parses as a wiki-link
and the stub loop writes literal filenames such as

    research/temp/-n "$kernel".md
    research/temp/! -f "$KERNELDESTINATION".md

(40 of these landed in one real vault from one Arch wiki page). A
../-shaped ref goes further: a note body containing [[../../outside]]
makes `hyperresearch repair` write outside.md at the vault root, and
one more ../ puts it outside the vault. The write is bounded (.md is
always appended, the collision loop never overwrites, the body is a
fixed stub) but it is still an attacker-influenced path from untrusted
web content.

This is the same traversal class #125 closed for the run tag and #114
closed for `claims ingest --tag`, rea

**File**: `src/hyperresearch/cli/repair.py` (modified, +5/-2)
```diff
@@ -69,8 +69,11 @@ def repair(
                     summary=stub_summary(target),
                 )
                 stubs_created += 1
-            except Exception:
-                pass
+            except Exception as exc:
+                # A visible skip, not a silent one: a bare pass here hides
+                # exactly the malformed-target failures this loop can hit.
+                if not json_output:
+                    console.print(f"  [yellow]stub skipped[/] {target!r}: {exc}")
         if stubs_created:
             plan = compute_sync_plan(vault)
             execute_sync(vault, plan)
```

**File**: `src/hyperresearch/core/note.py` (modified, +9/-1)
```diff
@@ -108,7 +108,15 @@ def write_note(
         content_type: Artifact kind — paper|docs|article|blog|forum|dataset|policy|code|book|transcript|review|unknown.
         extra_frontmatter: Additional fields to set on NoteMeta (e.g. source_domain, fetched_at).
     """
-    nid = note_id or slugify(title)
+    # The id must be a fixed point of the slugifier. NoteMeta.ensure_slug
+    # already slugifies the FRONTMATTER id, so an unslugified note_id here
+    # made the filename diverge from the note's own frontmatter: callers that
+    # pass broken-link text verbatim (cli/graph.py stub, cli/repair.py) wrote
+    # literal filenames like `! -f "$KERNELDESTINATION".md`, and a `../`
+    # shaped ref resolved to a path outside the vault. slugify strips path
+    # separators and shell metacharacters and never returns an empty string,
+    # so the filename below is always safe.
+    nid = slugify(note_id) if note_id else slugify(title)
     kwargs: dict = dict(
         title=title,
         id=nid,
```

**File**: `src/hyperresearch/core/patterns.py` (modified, +22/-0)
```diff
@@ -76,6 +76,15 @@
 # into a note body it must not become a link target (issue #93).
 _TEMPLATE_PLACEHOLDER_RE = re.compile(r"\{[^{}]*\}")
 
+# Shell/code fragments: characters that code in fetched pages carries but no
+# legitimate note id or title does. Bash test syntax ([[ -n "$kernel" ]]) is
+# lexically a wiki-link, so when a fetcher flattens <pre> content to prose,
+# every shell conditional becomes a broken link that `repair` / `graph stub`
+# then materialise as a junk note. Braces are left to the placeholder check
+# above, which already rejects `${VAR}`. This is a PARTIAL net by design:
+# refs shaped like real ids (`1-d`, `hostid-00000000`) pass.
+_SHELL_FRAGMENT_CHARS_RE = re.compile(r'[$"`=\\<>;]')
+
 
 def is_valid_wiki_link_target(ref: str) -> bool:
     """Return True if a ``[[ref]]`` should be treated as a note reference.
@@ -97,6 +106,10 @@ def is_valid_wiki_link_target(ref: str) -> bool:
     - Unsubstituted template placeholders: ``[[{note_id}]]``, ``[[run-{tag}]]``
     - Unbalanced square brackets: ``[[t.IO[t.Any]]`` (a type annotation whose
       closing ``]`` was eaten by the ``]]`` delimiter)
+    - Shell fragments: ``[[-n "$kernel"]]``, ``[[! -f x]]``, ``[[a=b]]`` (bash
+      test syntax from flattened code blocks: a leading ``-`` or ``!``, or a
+      shell metacharacter no note id or title carries)
+    - Path traversal: ``[[../../x]]``, ``[[a/../b]]``, ``[[..]]``
 
     Valid note references starting with digits (e.g. ``[[10-rules-for-X]]``)
     are preserved because they contain non-digit characters.
@@ -118,6 +131,15 @@ def is_valid_wiki_link_target(ref: str) -> bool:
         return False
     if _TEMPLATE_PLACEHOLDER_RE.search(ref):
         return False
+    if _SHELL_FRAGMENT_CHARS_RE.search(ref):
+        return False
+    # Leading '-' or '!' is option/negation syntax (`-n "$kernel"`,
+    # `! -f x`), not a reference. Mid-string they stay legal (titles).
+    if ref.startswith(("-", "!")):
+        return False
+    # Path traversal: never a note reference, whatever writes the file.
+    if any(part in ("..", ".") for part in ref.split("/")):
+        return False
     if ref.count("[") != ref.count("]"):
         return False
     return not _DOC_REF_PREFIX_RE.match(ref)
```

**File**: `tests/test_core/test_note.py` (modified, +27/-0)
```diff
@@ -240,3 +240,30 @@ def test_read_empty_body(tmp_vault):
     note = read_note(path, tmp_vault.root)
     assert note.meta.title == "Empty"
     assert note.body.strip() == ""
+
+
+def test_write_note_id_is_fixed_point_of_slugify(tmp_vault):
+    # A raw note_id (broken-link text, cli/graph stub + cli/repair pass it
+    # verbatim) must not become a literal filename. Before the fix the
+    # frontmatter id (slugified by NoteMeta.ensure_slug) and the filename
+    # (built from the raw nid) DIVERGED: shell fragments became names like
+    # `! -f "$KERNELDESTINATION".md`.
+    from hyperresearch.models.note import slugify
+
+    path = write_note(
+        tmp_vault.notes_dir, "Kernel Check", note_id='! -f "$KERNELDESTINATION"'
+    )
+    assert path.parent == tmp_vault.notes_dir
+    assert slugify(path.stem) == path.stem  # fixed point on disk
+    note = read_note(path, tmp_vault.root)
+    assert note.meta.id == path.stem  # filename and frontmatter agree
+
+
+def test_write_note_traversal_id_stays_in_the_vault(tmp_vault):
+    path = write_note(tmp_vault.notes_dir, "Evil", note_id="../../../outside")
+    assert path.resolve().is_relative_to(tmp_vault.notes_dir.resolve())
+
+
+def test_write_note_clean_id_passes_through_unchanged(tmp_vault):
+    path = write_note(tmp_vault.notes_dir, "Whatever Title", note_id="my-note-id")
+    assert path.stem == "my-note-id"
```

**File**: `tests/test_core/test_patterns.py` (modified, +35/-0)
```diff
@@ -233,3 +233,38 @@ def test_interior_open_bracket_never_matches():
     assert _targets("[[[x]]") == ["x"]
     # Ordinary links and aliases are untouched.
     assert _targets("[[note-id]] and [[other|Shown]]") == ["note-id", "other"]
+
+
+def test_shell_fragments_rejected():
+    # When a fetcher flattens <pre> content to prose, bash test syntax
+    # reaches this extractor and is lexically a wiki-link; `repair` then
+    # materialises junk notes named after shell fragments. Every shape below
+    # passed the validator before this check. (`"${HOSTID}"`-style refs are
+    # already rejected by the template-placeholder check.)
+    assert not is_valid_wiki_link_target('-n "$kernel"')
+    assert not is_valid_wiki_link_target('! -f "$KERNELDESTINATION"')
+    assert not is_valid_wiki_link_target("$# -lt 1")
+    assert not is_valid_wiki_link_target("-z foo")
+    assert not is_valid_wiki_link_target("a=b")
+    assert not is_valid_wiki_link_target("back`tick")
+    assert not is_valid_wiki_link_target("x < y; rm")
+
+
+def test_path_traversal_rejected():
+    # Never a note reference, whatever downstream writes the file.
+    assert not is_valid_wiki_link_target("../../../tmp/pwned")
+    assert not is_valid_wiki_link_target("a/../../b")
+    assert not is_valid_wiki_link_target("a/..")
+    assert not is_valid_wiki_link_target("..")
+    assert not is_valid_wiki_link_target(".")
+
+
+def test_shell_shaped_but_legitimate_refs_still_accepted():
+    # The net is partial BY DESIGN: shapes indistinguishable from real ids
+    # pass, and titles with mid-string slashes or punctuation stay legal.
+    assert is_valid_wiki_link_target("1-d")
+    assert is_valid_wiki_link_target("hostid-00000000")
+    assert is_valid_wiki_link_target("UEFI/Secure Boot")  # real wiki title shape
+    assert is_valid_wiki_link_target("C. elegans")
+    assert is_valid_wiki_link_target("yahoo! finance")  # '!' mid-string stays legal
+    assert is_valid_wiki_link_target("e.g. v1.2")
```

---

### Incident Patch 8: `d72267fa` (2026-09-22)
**Commit Message**: fix: the builtin provider raises CertVerificationError on a bad TLS certificate (#130)

The PDF lane (web/pdf.py safe_get_pdf) and the crawl4ai provider raise
CertVerificationError when TLS certificate verification fails, so a
certificate refusal can be told apart from any other failed fetch. The
builtin provider's HTML lane did not: BuiltinProvider._get let the raw
httpx.ConnectError from safe_get escape, so the same refusal surfaced as
an opaque ssl string, indistinguishable by type from a refused
connection or a DNS failure.

Reproduction, with a loopback HTTPS server on a self-signed certificate
and 127.0.0.1 in allow_private_hosts:

    BuiltinProvider(FetchSettings(allow_private_hosts=("127.0.0.1",))) \
        .fetch("https://127.0.0.1:<port>/page")
    # httpx.ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate
    # verify failed: self-signed certificate

Is this a security bug? No. I traced a builtin-provider certificate
failure end to end through `hpr fetch` and `hpr fetch-batch` on current
main, against a real self-signed server that counts connections and
completed handshakes, with the open-access rescue forced to run and to
hand back the refused host itself as 

**File**: `src/hyperresearch/web/builtin.py` (modified, +18/-6)
```diff
@@ -113,13 +113,25 @@ def search(self, query: str, max_results: int = 5) -> list[WebResult]:
 
     def _get(self, url: str):
         """Download URL through the SSRF gate in :mod:`hyperresearch.web.safe_http`."""
-        from hyperresearch.web.safe_http import safe_get
+        from hyperresearch.web.pdf import _is_cert_error
+        from hyperresearch.web.safe_http import CertVerificationError, safe_get
 
-        resp = safe_get(
-            url,
-            max_bytes=self._settings.max_html_bytes,
-            allow_private_hosts=self._settings.allow_private_hosts,
-        )
+        try:
+            resp = safe_get(
+                url,
+                max_bytes=self._settings.max_html_bytes,
+                allow_private_hosts=self._settings.allow_private_hosts,
+            )
+        except Exception as exc:
+            # Raise a certificate failure as its own type, the way the PDF lane
+            # and the crawl4ai provider do, instead of letting the raw
+            # httpx.ConnectError through looking like any other failed fetch.
+            # This lane always verifies TLS; pdf_verify_tls covers PDFs only.
+            if _is_cert_error(exc):
+                raise CertVerificationError(
+                    f"certificate verification failed for {url!r}: {exc}"
+                ) from exc
+            raise
         if resp.status_code >= 400:
             raise RuntimeError(f"HTTP {resp.status_code} fetching {url}")
         return resp
```

**File**: `tests/test_web/test_builtin_cert_refusal.py` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+"""The builtin provider refuses a bad TLS certificate as CertVerificationError.
+
+The PDF lane (`web.pdf.safe_get_pdf`) and the crawl4ai provider already raise
+`CertVerificationError` on a certificate failure. The builtin provider's HTML
+lane did not: `safe_get` let the raw `httpx.ConnectError` escape, so the same
+refusal surfaced as an opaque ssl string and callers could not tell it apart
+from a refused connection or a DNS failure.
+
+Two layers here. The unit tests fake the httpx error chain at `safe_get`. The
+end-to-end tests run a real TLS server on loopback with a self-signed
+certificate, which also checks the error-chain walk against the nesting httpx
+produces today, and count completed handshakes: a client that verifies never
+completes one, so a nonzero count means some lane retried without
+verification.
+"""
+
+from __future__ import annotations
+
+import datetime
+import ipaddress
+import json
+import socket
+import ssl
+import threading
+
+import httpx
+import pytest
+from typer.testing import CliRunner
+
+from hyperresearch.cli import app
+from hyperresearch.core.config import FetchSettings
+from hyperresearch.web.builtin import BuiltinProvider
+from hyperresearch.web.safe_http import CertVerificationError
+
+runner = CliRunner()
+
+
+def _cert_error() -> Exception:
+    err = httpx.ConnectError("TLS handshake failed")
+    err.__cause__ = ssl.SSLCertVerificationError("CERTIFICATE_VERIFY_FAILED")
+    return err
+
+
+def test_cert_failure_raises_cert_verification_error(monkeypatch):
+    calls: list[bool | str] = []
+
+    def fake_safe_get(url, *, max_bytes, timeout=None, headers=None, verify=True,
+                      allow_private_hosts=()):
+        calls.append(verify)
+        raise _cert_error()
+
+    monkeypatch.setattr("hyperresearch.web.safe_http.safe_get", fake_safe_get)
+
+    with pytest.raises(CertVerificationError, match="certificate verification failed"):
+        BuiltinProvider().fetch("https://broken-cert.example.edu/page")
+
+    assert calls == [True], "exactly one verified attempt, no unverified retry"
+
+
+def test_non_cert_connect_error_propagates_untranslated(monkeypatch):
+    def fake_safe_get(url, *, max_bytes, timeout=None, headers=None, verify=True,
+                      allow_private_hosts=()):
+        raise httpx.ConnectError("connection refused")
+
+    monkeypatch.setattr("hyperresearch.web.safe_http.safe_get", fake_safe_get)
+
+    with pytest.raises(httpx.ConnectError, match="connection refused"):
+        BuiltinProvider().fetch("https://down.example.com/page")
+
+
+# ---------------------------------------------------------------------------
+# End to end: a real self-signed TLS server on loopback
+# ---------------------------------------------------------------------------
+
+
+@pytest.fixture
+def self_signed_server(tmp_path):
+    """HTTPS server on 127.0.0.1 with a self-signed cert. Yields (base_url, stats)."""
+    pytest.importorskip("cryptography")
+    from cryptography import x509
+    from cryptography.hazmat.primitives import hashes, serialization
+    from cryptography.hazmat.primitives.asymmetric import ec
+    from cryptography.x509.oid import NameOID
+
+    key = ec.generate_private_key(ec.SECP256R1())
+    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "127.0.0.1")])
+    now = datetime.datetime.now(datetime.UTC)
+    cert = (
+        x509.CertificateBuilder()
+        .subject_name(name)
+        .issuer_name(name)
+        .public_key(key.public_key())
+        .serial_number(x509.random_serial_number())
+        .not_valid_before(now - datetime.timedelta(days=1))
+        .not_valid_after(now + datetime.timedelta(days=1))
+        .add_extension(
+            x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]),
+            critical=False,
+        )
+        .sign(key, hashes.SHA256())
+    )
+    cert_path = tmp_path / "cert.pem"
+    key_path = tmp_path / "key.pem"
+    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
+    key_path.write_bytes(
+        key.private_bytes(
+            serialization.Encoding.PEM,
+            serialization.PrivateFormat.PKCS8,
+            serialization.NoEncryption(),
+        )
+    )
+    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
+    ctx.load_cert_chain(cert_path, key_path)
+
+    stats = {"connections": 0, "handshakes_completed": 0}
+    body = b"<html><title>served</title><body>" + b"page text " * 200 + b"</body></html>"
+    listener = socket.socket()
+    listener.bind(("127.0.0.1", 0))
+    listener.listen(8)
+    listener.settimeout(0.05)  # so the accept loop notices `stop` promptly
+    stop = threading.Event()
+
+    def serve() -> None:
+        while not stop.is_set():
+            try:
+                conn, _ = listener.accept()
+            except TimeoutError:
+                continue
+            except OSError:
+                return
+            conn.settimeout(5)
+            stats[
```

---

### Incident Patch 9: `0e897463` (2026-09-22)
**Commit Message**: security: classify IPv4-mapped IPv6 by its embedded IPv4; reject host:port allowlist entries (#127)

Two gaps in the SSRF gate from #53.

IPv4-mapped IPv6. _is_blocked_ip trusted the ipaddress is_* properties
to see through ::ffff:a.b.c.d, but interpreters disagree on what those
properties report for a mapped address:

- On Python 3.11 (measured on 3.11.15, and 3.13.14 behaves the same),
  ::ffff:100.64.0.1 reports is_private, is_reserved and every other
  property False, and the explicit CGNAT check only looks at version-4
  addresses. check_url("http://[::ffff:100.64.0.1]/") returns None:
  a mapped carrier-grade NAT address passes the gate, and the OS
  connects to 100.64.0.1.
- On Python 3.12 (measured on 3.12.3) every mapped address reports
  is_reserved, so check_url("http://[::ffff:8.8.8.8]/") refuses a
  public destination.

The fix unmaps first (ip.ipv4_mapped) and classifies the embedded IPv4,
which gives the same, correct verdict on every interpreter. The comment
next to _6TO4_NET that said mapped addresses were already covered is
removed.

Allowlist entries. allow_private_hosts accepted "192.168.1.20:8443" and
"mirror.internal:8443" as hostname entries. URL hostnames ne

**File**: `src/hyperresearch/web/safe_http.py` (modified, +20/-3)
```diff
@@ -90,12 +90,19 @@ def text(self) -> str:
 # 6to4 (RFC 3056): a 2002:AABB:CCDD::/48 prefix embeds the IPv4 address
 # A.B.C.D, so 2002:7f00:1:: is loopback wearing an IPv6 coat. The transport
 # is deprecated and rarely routed, but the ipaddress module does not flag it
-# and the embedded address is what matters. IPv4-mapped (::ffff:a.b.c.d) is
-# already caught because ipaddress unwraps it for the is_* properties.
+# and the embedded address is what matters.
 _6TO4_NET = ipaddress.ip_network("2002::/16")
 
 
 def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
+    # Classify IPv4-mapped IPv6 (::ffff:a.b.c.d) by its embedded IPv4, which
+    # is where the OS sends the connection. The ipaddress is_* properties do
+    # not agree on mapped addresses across interpreters: on 3.11 and 3.13 a
+    # mapped CGNAT address passes every property, and the CGNAT check below
+    # only looks at version-4 addresses, so it was allowed; on 3.12 every
+    # mapped address reports is_reserved, so even a mapped public address
+    # was refused. Unmapping first gives the same answer everywhere.
+    ip = getattr(ip, "ipv4_mapped", None) or ip
     if ip.version == 6 and ip in _6TO4_NET:
         packed = int(ip) >> 80 & 0xFFFFFFFF
         return _is_blocked_ip(ipaddress.IPv4Address(packed))
@@ -146,12 +153,22 @@ def _parse_allowlist(
         if not entry:
             continue
         try:
-            networks.append(ipaddress.ip_network(entry, strict=False))
+            # Brackets are URL notation for an IPv6 literal ("[::1]"); the
+            # network types reject them, so parse the address inside.
+            networks.append(ipaddress.ip_network(entry.strip("[]"), strict=False))
         except ValueError:
             if "/" in entry:  # meant as a CIDR, but malformed
                 raise SafeHTTPError(
                     f"invalid allow_private_hosts entry {entry!r}: not a valid CIDR"
                 ) from None
+            if ":" in entry:
+                # host:port. URL hostnames never carry the port, so the entry
+                # would become a hostname that can never match: a silent dead
+                # entry that looks like an SSRF refusal of the user's mirror.
+                raise SafeHTTPError(
+                    f"invalid allow_private_hosts entry {entry!r}: entries are "
+                    "hostnames or CIDRs; drop the port"
+                )
             hostnames.add(entry.lower())
     return frozenset(hostnames), networks
 
```

**File**: `tests/test_web/test_safe_http.py` (modified, +47/-0)
```diff
@@ -315,6 +315,33 @@ def test_check_url_allows_6to4_wrapping_public_ipv4():
     check_url("http://[2002:808:808::]/")
 
 
+# ---------------------------------------------------------------------------
+# IPv4-mapped IPv6 (::ffff:a.b.c.d) is classified by the embedded IPv4. The
+# ipaddress properties disagree across interpreters: 3.11 and 3.13 report a
+# mapped CGNAT address as public, 3.12 reports even a mapped public address
+# as reserved.
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.parametrize(
+    "url",
+    [
+        "http://[::ffff:10.0.0.1]/",
+        "http://[::ffff:169.254.169.254]/",  # mapped cloud metadata
+        "http://[::ffff:100.64.0.1]/",  # mapped CGNAT: allowed on 3.11 and 3.13
+    ],
+)
+def test_check_url_rejects_ipv4_mapped_private_forms(url):
+    with pytest.raises(SafeHTTPError, match="non-public address"):
+        check_url(url)
+
+
+def test_check_url_allows_ipv4_mapped_public():
+    """A mapped PUBLIC address stays fetchable: the verdict follows the
+    embedded address, where 3.12's is_reserved refused it wholesale."""
+    check_url("http://[::ffff:8.8.8.8]/")
+
+
 # ---------------------------------------------------------------------------
 # allow_private_hosts — the [fetch] escape hatch for intranet mirrors
 # ---------------------------------------------------------------------------
@@ -382,3 +409,23 @@ def test_safe_get_redirect_to_allowlisted_private_host_is_followed():
         allow_private_hosts=("192.168.1.20",),
     )
     assert resp.content == b"mirror content"
+
+
+# ---------------------------------------------------------------------------
+# allow_private_hosts entry hygiene
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.parametrize("entry", ["192.168.1.20:8443", "mirror.internal:8443"])
+def test_allowlist_entry_with_port_is_a_loud_error(entry):
+    """A host:port entry would otherwise become a hostname that can never
+    match (URL hostnames carry no port): a silent dead entry presenting as
+    an SSRF refusal of the user's own mirror."""
+    with pytest.raises(SafeHTTPError, match="drop the port"):
+        check_url("http://8.8.8.8/", allow_private_hosts=(entry,))
+
+
+def test_allowlist_bracketed_ipv6_entry_admits_the_literal():
+    """A bracketed IPv6 entry (URL notation) parses as the address itself
+    instead of becoming a hostname that never matches."""
+    check_url("http://[::1]/", allow_private_hosts=("[::1]",))
```

---

### Incident Patch 10: `75b1ecfb` (2026-09-12)
**Commit Message**: fix: validate the run tag so it can only name a child of research/runs/ (#125)

Vault.run_dir() joined the tag straight onto research/runs/, and pathlib
replaces the base on an absolute segment, so `run init ../../x` or an
absolute path scaffolded a run workspace outside the vault and every
later run subcommand followed it there. Same class as the
`claims ingest --tag` traversal fixed in #114.

The tag is validated at that one seam: [A-Za-z0-9][A-Za-z0-9_.-]{0,99},
which is what `hpr vault-tag` mints plus underscore and dot. The run,
levers and citecheck commands report a bad tag as a clean error.

Fixes #116

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01JyJz2SsnEZYWpyt55E7K3A

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 ## [Unreleased]
 
+- **A run tag is a slug (#116).** `Vault.run_dir()` joined the tag onto `research/runs/` unchecked, and pathlib replaces the base on an absolute segment, so `hpr run init ../../x` or `hpr run init C:/anything` scaffolded a run workspace outside the vault and every later `run` subcommand followed it there. Tags are now validated at that one seam: letters, digits, `-`, `_` and `.`, starting with a letter or digit, which is what `hpr vault-tag` mints. `run`, `levers` and `citecheck` report a bad tag as a clean error instead of a traceback. Same bug class as the `claims ingest --tag` traversal fixed in 0.11.1; exposure is low because the tag comes from the operator or the orchestrating agent, not from fetched content.
 - **The builtin provider fetches PDFs (#82, reported by @earldodd).** The PDF lane (`_is_pdf_url` / `_fetch_pdf`) lived inside the crawl4ai provider only, so a vault still on `provider = "builtin"` (the default until `hpr install` switches it) had no PDF handling at all: a direct `.pdf` link was decoded as HTML text and rejected by the junk gate as "Binary PDF garbage in content", identically for every mirror of the same document, and an arXiv `/abs/` link saved the 900-word abstract page instead of the paper. The lane now lives in `web/pdf.py` and both providers use it; the crawl4ai module keeps the old names. The builtin provider also detects a PDF from its bytes when the URL does not look like one. When the PDF lane declines a URL and the HTML fallback turns out to be junk, `hpr fetch -j` now says why the lane declined it (`PDF lane: HTTP 403`, `no extractable text layer`, ...) instead of the generic junk verdict, and the pymupdf document handle is closed on the exception path instead of leaking one per encrypted PDF.
 - **`serply` web provider.** Google organic results with page fetch through the same `SERPLY_API_KEY`; opt-in via `[web] provider = "serply"`, no new dependency.
 
```

**File**: `src/hyperresearch/cli/citecheck_cmd.py` (modified, +10/-1)
```diff
@@ -26,7 +26,7 @@ def citecheck_extract(
     runs/<tag>/cite-check-pairs.json for the cite-checker agent.
     """
     from hyperresearch.core.citecheck import write_pairs_file
-    from hyperresearch.core.vault import Vault, VaultError
+    from hyperresearch.core.vault import InvalidRunTagError, Vault, VaultError, validate_run_tag
 
     try:
         vault = Vault.discover()
@@ -37,6 +37,15 @@ def citecheck_extract(
             console.print(f"[red]Error:[/] {e}")
         raise typer.Exit(1)
 
+    try:
+        validate_run_tag(vault_tag)
+    except InvalidRunTagError as e:
+        if json_output:
+            output(error(str(e), "INVALID_TAG"), json_mode=True)
+        else:
+            console.print(f"[red]Error:[/] {e}")
+        raise typer.Exit(1)
+
     vault.auto_sync()
     report_path = Path(report) if report else (
         vault.root / "research" / "notes" / f"final_report_{vault_tag}.md"
```

**File**: `src/hyperresearch/cli/levers_cmd.py` (modified, +4/-3)
```diff
@@ -5,13 +5,14 @@
 import typer
 
 from hyperresearch.cli._output import console, output
+from hyperresearch.core.vault import VaultError
 from hyperresearch.models.output import error, success
 
 app = typer.Typer()
 
 
 def _discover(json_output: bool):
-    from hyperresearch.core.vault import Vault, VaultError
+    from hyperresearch.core.vault import Vault
 
     try:
         return Vault.discover()
@@ -49,7 +50,7 @@ def levers_render(
     vault.auto_sync()
     try:
         result = render_shims(vault, vault_tag)
-    except LeverError as e:
+    except (LeverError, VaultError) as e:
         _fail(str(e), "LEVER_ERROR", json_output)
         return
     levers = result["levers"]
@@ -91,7 +92,7 @@ def levers_set(
         result = {"levers": levers, "rerendered": rerender}
         if rerender:
             result = {**render_shims(vault, vault_tag), "rerendered": True}
-    except LeverError as e:
+    except (LeverError, VaultError) as e:
         _fail(str(e), "LEVER_ERROR", json_output)
         return
     if json_output:
```

**File**: `src/hyperresearch/cli/run_cmd.py` (modified, +14/-13)
```diff
@@ -7,13 +7,14 @@
 import typer
 
 from hyperresearch.cli._output import console, output
+from hyperresearch.core.vault import VaultError
 from hyperresearch.models.output import error, success
 
 app = typer.Typer()
 
 
 def _vault_or_exit(json_output: bool):
-    from hyperresearch.core.vault import Vault, VaultError
+    from hyperresearch.core.vault import Vault
 
     try:
         return Vault.discover()
@@ -59,7 +60,7 @@ def run_init(
         query = Path(query_file).read_text(encoding="utf-8-sig")
     try:
         manifest = init_run(vault, vault_tag, profile=profile, budget_usd=budget, query=query)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -86,7 +87,7 @@ def run_status(
     tag = _resolve_tag(vault, vault_tag, json_output)
     try:
         summary = status_summary(vault, tag)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -168,7 +169,7 @@ def run_resume(
     tag = _resolve_tag(vault, vault_tag, json_output)
     try:
         manifest = load_manifest(vault, tag)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -210,7 +211,7 @@ def run_abort(
     vault = _vault_or_exit(json_output)
     try:
         manifest = set_status(vault, vault_tag, "aborted")
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -236,7 +237,7 @@ def run_step(
     vault = _vault_or_exit(json_output)
     try:
         manifest = set_step(vault, vault_tag, step, status, chapter=chapter)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -267,7 +268,7 @@ def run_spend(
             estimated_usd=usd, sources_fetched=sources,
             notes_written=notes, agents_spawned=agents,
         )
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -303,7 +304,7 @@ def run_event(
             raise typer.Exit(1)
     try:
         record_event(vault, vault_tag, payload)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -327,7 +328,7 @@ def run_block(
     vault = _vault_or_exit(json_output)
     try:
         manifest = set_status(vault, vault_tag, "blocked", blocked_on=on)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -362,7 +363,7 @@ def run_report(
                 continue
             try:
                 reports.append(run_report_data(vault, tag))
-            except RunError:
+            except (RunError, VaultError):
                 continue
         agg = {
             "runs": len(reports),
@@ -385,7 +386,7 @@ def run_report(
     try:
         load_manifest(vault, tag)
         report = run_report_data(vault, tag)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -424,7 +425,7 @@ def run_verify(
     tag = _resolve_tag(vault, vault_tag, json_output)
     try:
         result = verify_run(vault, tag)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
@@ -460,7 +461,7 @@ def run_finish(
     tag = _resolve_tag(vault, vault_tag, json_output)
     try:
         result = finish_run(vault, tag)
-    except RunError as e:
+    except (RunError, VaultError) as e:
         if json_output:
             output(error(str(e), "RUN_ERROR"), json_mode=True)
         else:
```

**File**: `src/hyperresearch/core/vault.py` (modified, +29/-1)
```diff
@@ -2,6 +2,7 @@
 
 from __future__ import annotations
 
+import re
 import sqlite3
 from pathlib import Path
 
@@ -17,6 +18,33 @@ class VaultError(Exception):
     pass
 
 
+class InvalidRunTagError(VaultError):
+    """A run tag that is not a plain slug (path separators, `..`, absolute paths)."""
+
+
+# A run tag is a slug: what `hpr vault-tag` mints, plus underscore and dot so
+# hand-written tags survive. No separators, so it can only ever name a child
+# of research/runs/; the leading character rule rejects `.` and `..`.
+RUN_TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$")
+
+
+def validate_run_tag(vault_tag: str) -> str:
+    """Return the tag unchanged, or raise InvalidRunTagError.
+
+    Every run command joins the tag onto research/runs/, and pathlib replaces
+    the base on an absolute segment, so without this `run init ../../x` or
+    `run init C:/anything` scaffolds a workspace outside the vault and every
+    later subcommand follows it there (#116).
+    """
+    if not isinstance(vault_tag, str) or not RUN_TAG_RE.fullmatch(vault_tag):
+        raise InvalidRunTagError(
+            f"invalid run tag {vault_tag!r}: a tag is a slug of letters, digits, "
+            "'-', '_' and '.', starting with a letter or digit (mint one with "
+            "`hyperresearch vault-tag <slug>`)"
+        )
+    return vault_tag
+
+
 class Vault:
     """Represents a hyperresearch research base vault."""
 
@@ -85,7 +113,7 @@ def runs_dir(self) -> Path:
         return self.research_dir / "runs"
 
     def run_dir(self, vault_tag: str) -> Path:
-        return self.runs_dir / vault_tag
+        return self.runs_dir / validate_run_tag(vault_tag)
 
     @property
     def templates_dir(self) -> Path:
```

**File**: `tests/test_core/test_run_tag_validation.py` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+"""A run tag is a slug; it can only ever name a child of research/runs/ (#116).
+
+`Vault.run_dir()` joins the tag onto research/runs/ and pathlib replaces the
+base on an absolute segment, so before this `run init ../../x` (or an
+absolute path) scaffolded a run workspace outside the vault and every later
+`run` subcommand followed it there. Same bug class as the `claims ingest
+--tag` traversal fixed in #114; this one is closed at the single seam every
+run command goes through.
+"""
+
+from __future__ import annotations
+
+import json
+
+import pytest
+from typer.testing import CliRunner
+
+from hyperresearch.cli import app
+from hyperresearch.core.vault import InvalidRunTagError, validate_run_tag
+
+runner = CliRunner()
+
+
+@pytest.mark.parametrize(
+    "tag",
+    [
+        "efield-dft-sac-3f9a1c",
+        "non-ai-web-design-trends-2026-b0dbbe",
+        "Run_2026.09.12",
+        "a",
+        "x" * 100,
+    ],
+)
+def test_slugs_pass(tag):
+    assert validate_run_tag(tag) == tag
+
+
+@pytest.mark.parametrize(
+    "tag",
+    [
+        "../../x",
+        "..",
+        ".",
+        ".hidden",
+        "-leading-dash",
+        "a/b",
+        "a\b",
+        "C:/anything",
+        "/etc/passwd",
+        "has space",
+        "",
+        "x" * 101,
+        "tag\n",
+    ],
+)
+def test_paths_and_junk_are_refused(tag):
+    with pytest.raises(InvalidRunTagError):
+        validate_run_tag(tag)
+
+
+def test_run_dir_refuses_before_touching_the_filesystem(tmp_vault):
+    with pytest.raises(InvalidRunTagError):
+        tmp_vault.run_dir("../../escape")
+    assert not (tmp_vault.root.parent / "escape").exists()
+
+
+def test_run_init_with_a_traversal_tag_is_a_clean_error(tmp_vault, monkeypatch):
+    monkeypatch.chdir(tmp_vault.root)
+    outside = tmp_vault.root.parent / "outside"
+
+    result = runner.invoke(app, ["run", "init", "../../outside", "-j"])
+
+    payload = json.loads(result.stdout)
+    assert result.exit_code == 1
+    assert payload["ok"] is False
+    assert "invalid run tag" in payload["error"]
+    assert not outside.exists()
+    assert not (tmp_vault.root / "research" / "runs").exists() or not any(
+        (tmp_vault.root / "research" / "runs").iterdir()
+    )
+
+
+def test_run_init_with_an_absolute_tag_is_a_clean_error(tmp_vault, tmp_path, monkeypatch):
+    monkeypatch.chdir(tmp_vault.root)
+    target = tmp_path / "elsewhere"
+
+    result = runner.invoke(app, ["run", "init", str(target), "-j"])
+
+    assert result.exit_code == 1
+    assert json.loads(result.stdout)["ok"] is False
+    assert not target.exists()
+
+
+def test_other_run_commands_report_the_bad_tag_too(tmp_vault, monkeypatch):
+    monkeypatch.chdir(tmp_vault.root)
+    for argv in (
+        ["run", "status", "../../x", "-j"],
+        ["run", "step", "../../x", "1", "--status", "done", "-j"],
+        ["run", "verify", "../../x", "-j"],
+        ["citecheck", "extract", "../../x", "-j"],
+        ["levers", "render", "../../x", "-j"],
+    ):
+        result = runner.invoke(app, argv)
+        assert result.exit_code == 1, argv
+        assert json.loads(result.stdout)["ok"] is False, argv
+        assert "invalid run tag" in json.loads(result.stdout)["error"], argv
+
+
+def test_a_good_tag_still_scaffolds_inside_the_vault(tmp_vault, monkeypatch):
+    monkeypatch.chdir(tmp_vault.root)
+
+    result = runner.invoke(app, ["run", "init", "good-tag-0a1b2c", "-j"])
+
+    assert result.exit_code == 0, result.stdout
+    assert (tmp_vault.root / "research" / "runs" / "good-tag-0a1b2c" / "run.json").exists()
```

---

### Incident Patch 11: `9ed3232d` (2026-09-12)
**Commit Message**: fix: give the builtin provider a PDF lane, and say why a PDF was declined (#124)

The PDF lane (_is_pdf_url / _fetch_pdf) lived inside the crawl4ai
provider only. A vault on provider = "builtin", the default until
`hpr install` switches it over, had no PDF handling at all: a direct
.pdf link was decoded as HTML text and rejected as "Binary PDF garbage
in content", identically for every mirror of the same document, and an
arXiv /abs/ link saved the abstract page instead of the paper.

The lane moves to web/pdf.py and both providers use it; the crawl4ai
module re-exports the old names. When the lane declines a URL and the
HTML fallback is junk, `hpr fetch -j` reports the lane's reason
("PDF lane: HTTP 403", "no extractable text layer"). The pymupdf handle
is closed in a finally block. The builtin provider also detects a PDF
from its bytes when the URL does not look like one.

Fixes #82, reported by @earldodd.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01JyJz2SsnEZYWpyt55E7K3A

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 ## [Unreleased]
 
+- **The builtin provider fetches PDFs (#82, reported by @earldodd).** The PDF lane (`_is_pdf_url` / `_fetch_pdf`) lived inside the crawl4ai provider only, so a vault still on `provider = "builtin"` (the default until `hpr install` switches it) had no PDF handling at all: a direct `.pdf` link was decoded as HTML text and rejected by the junk gate as "Binary PDF garbage in content", identically for every mirror of the same document, and an arXiv `/abs/` link saved the 900-word abstract page instead of the paper. The lane now lives in `web/pdf.py` and both providers use it; the crawl4ai module keeps the old names. The builtin provider also detects a PDF from its bytes when the URL does not look like one. When the PDF lane declines a URL and the HTML fallback turns out to be junk, `hpr fetch -j` now says why the lane declined it (`PDF lane: HTTP 403`, `no extractable text layer`, ...) instead of the generic junk verdict, and the pymupdf document handle is closed on the exception path instead of leaking one per encrypted PDF.
 - **`serply` web provider.** Google organic results with page fetch through the same `SERPLY_API_KEY`; opt-in via `[web] provider = "serply"`, no new dependency.
 
 ## [0.11.1] - 2026-09-11
```

**File**: `src/hyperresearch/cli/fetch.py` (modified, +6/-1)
```diff
@@ -230,6 +230,7 @@ def fetch(
     from hyperresearch.core.sync import compute_sync_plan, execute_sync
     from hyperresearch.core.vault import Vault, VaultError
     from hyperresearch.web.base import get_provider
+    from hyperresearch.web.pdf import PDF_FAILURE_KEY
 
     try:
         vault = Vault.discover()
@@ -391,7 +392,11 @@ def _rescue(reason: str, raw_html: str | None):
                 item_id = _escalate_blocked(vault, url, reason, tags, suggested_by, utility_score,
                                             detail=junk_reason)
             escalated = f" Queued for browser-lane escalation (#{item_id})." if item_id else ""
-            msg = f"Skipped junk content from {url}: {junk_reason}.{escalated}"
+            # A PDF that failed its own lane lands here as "binary garbage";
+            # say why the PDF lane declined it, or the message is useless (#82).
+            pdf_failure = result.metadata.get(PDF_FAILURE_KEY)
+            pdf_note = f" PDF lane: {pdf_failure}." if pdf_failure else ""
+            msg = f"Skipped junk content from {url}: {junk_reason}.{pdf_note}{escalated}"
             if json_output:
                 output(error(msg, "JUNK_ESCALATED" if item_id else "JUNK_CONTENT"), json_mode=True)
             else:
```

**File**: `src/hyperresearch/core/oa.py` (modified, +2/-2)
```diff
@@ -796,9 +796,9 @@ def _try_candidates(vault, prov, doi: str, settings, *, fallback_title, beat_cha
         attempts += 1
         try:
             if loc.kind == "pdf":
-                from hyperresearch.web.crawl4ai_provider import _fetch_pdf
+                from hyperresearch.web.pdf import fetch_pdf
 
-                recovered = _fetch_pdf(loc.url, vault.config.fetch)
+                recovered = fetch_pdf(loc.url, vault.config.fetch)
             elif loc.kind == "jats":
                 recovered = _fetch_jats(loc.url, fallback_title)
             elif loc.kind == "coretext":
```

**File**: `src/hyperresearch/web/builtin.py` (modified, +48/-7)
```diff
@@ -1,4 +1,10 @@
-"""Builtin web provider — SSRF-gated fetching via safe_http, beautifulsoup4 extraction if available."""
+"""Builtin web provider — SSRF-gated fetching via safe_http, beautifulsoup4 extraction if available.
+
+PDFs go through the shared lane in :mod:`hyperresearch.web.pdf`, the same one
+the crawl4ai provider uses. Before that, a vault on this provider had no PDF
+handling at all: the bytes were decoded as HTML and every PDF on every host
+was rejected by the junk gate with the same generic message (#82).
+"""
 
 from __future__ import annotations
 
@@ -7,6 +13,13 @@
 from html.parser import HTMLParser
 
 from hyperresearch.web.base import WebResult
+from hyperresearch.web.pdf import (
+    PDF_FAILURE_KEY,
+    extract_pdf,
+    failure_reason,
+    fetch_pdf,
+    is_pdf_url,
+)
 
 
 class _TextExtractor(HTMLParser):
@@ -58,25 +71,48 @@ def __init__(self, settings=None):
         self._settings = settings or FetchSettings()
 
     def fetch(self, url: str) -> WebResult:
-        html, final_url = self._download(url)
+        # PDF detection by URL shape: download directly, extract with pymupdf.
+        # A miss falls through to the HTML lane (the URL may be a landing page)
+        # and the reason travels with the result for the junk gate to report.
+        pdf_failure: str | None = None
+        if is_pdf_url(url):
+            result = fetch_pdf(url, self._settings)
+            if result is not None:
+                return result
+            pdf_failure = failure_reason(url)
+
+        resp = self._get(url)
+        # Post-download PDF detection: a PDF behind a URL that does not look
+        # like one (download?id=…, a redirect) is decoded here as text and
+        # would otherwise be reported as binary garbage.
+        if resp.content.startswith(b"%PDF-") or "application/pdf" in resp.headers.get("content-type", "").lower():
+            result, pdf_failure = extract_pdf(
+                resp.url, resp.content, self._settings, resp.headers.get("content-type", "")
+            )
+            if result is not None:
+                return result
+
+        html = resp.text
         title, content = self._extract(html)
-        return WebResult(
-            url=final_url,
+        result = WebResult(
+            url=resp.url,
             title=title,
             content=content,
             raw_html=html,
             fetched_at=datetime.now(UTC),
         )
+        if pdf_failure:
+            result.metadata[PDF_FAILURE_KEY] = pdf_failure
+        return result
 
     def search(self, query: str, max_results: int = 5) -> list[WebResult]:
         raise NotImplementedError(
             "Builtin provider does not support web search. "
             "Use your agent's built-in search, then pipe URLs into 'hyperresearch fetch'."
         )
 
-    def _download(self, url: str) -> tuple[str, str]:
-        """Download URL, return (html, final_url). All requests go through the
-        SSRF gate in :mod:`hyperresearch.web.safe_http`."""
+    def _get(self, url: str):
+        """Download URL through the SSRF gate in :mod:`hyperresearch.web.safe_http`."""
         from hyperresearch.web.safe_http import safe_get
 
         resp = safe_get(
@@ -86,6 +122,11 @@ def _download(self, url: str) -> tuple[str, str]:
         )
         if resp.status_code >= 400:
             raise RuntimeError(f"HTTP {resp.status_code} fetching {url}")
+        return resp
+
+    def _download(self, url: str) -> tuple[str, str]:
+        """Download URL, return (html, final_url)."""
+        resp = self._get(url)
         return resp.text, resp.url
 
     def _extract(self, html: str) -> tuple[str, str]:
```

**File**: `src/hyperresearch/web/crawl4ai_provider.py` (modified, +24/-216)
```diff
@@ -23,6 +23,13 @@
 
 from hyperresearch.core.config import FetchSettings, JunkGates
 from hyperresearch.web.base import WebResult, is_binary_garbage
+from hyperresearch.web.pdf import PDF_FAILURE_KEY
+from hyperresearch.web.pdf import failure_reason as _pdf_failure_reason
+from hyperresearch.web.pdf import fetch_pdf as _fetch_pdf
+from hyperresearch.web.pdf import is_pdf_url as _is_pdf_url
+from hyperresearch.web.pdf import (
+    safe_get_pdf as _safe_get_pdf,  # noqa: F401  # kept for callers that import it here
+)
 
 # Fix Windows encoding before crawl4ai's managed browser tries to log Unicode
 if sys.platform == "win32":
@@ -63,22 +70,6 @@ def _target() -> None:
     return box["result"]
 
 
-def _is_pdf_url(url: str) -> bool:
-    """Check if URL likely points to a PDF."""
-    from urllib.parse import urlparse
-
-    parsed = urlparse(url.lower())
-    path = parsed.path
-    # Direct .pdf links
-    if path.endswith(".pdf"):
-        return True
-    # Common academic PDF patterns
-    if "/pdf/" in path or "/pdfs/" in path:
-        return True
-    # arXiv PDF links
-    return "arxiv.org" in parsed.netloc and ("/pdf/" in path or "/abs/" in path)
-
-
 def _looks_like_binary(text: str, gates: JunkGates | None = None) -> bool:
     """Check if extracted 'content' is actually binary garbage from a PDF."""
     if not text:
@@ -119,196 +110,6 @@ def _smart_wait_js(settings: FetchSettings) -> str:
     )
 
 
-_PYMUPDF_MISSING_LOGGED = False
-
-
-def _pdf_log() -> logging.Logger:
-    return logging.getLogger("hyperresearch.pdf")
-
-
-def _import_pymupdf():
-    """Import pymupdf, warning loudly (once) if it is unavailable.
-
-    Without this warning a missing/broken pymupdf is invisible: every PDF falls
-    through to the browser lane, arrives as binary, and is discarded as junk —
-    across every domain at once, with nothing explaining why.
-    """
-    global _PYMUPDF_MISSING_LOGGED
-    try:
-        import pymupdf
-
-        return pymupdf
-    except ImportError as exc:
-        if not _PYMUPDF_MISSING_LOGGED:
-            _PYMUPDF_MISSING_LOGGED = True
-            _pdf_log().error(
-                "pymupdf could not be imported (%s) — PDF text extraction is disabled, "
-                "so every PDF will be discarded as junk content. Reinstall it with "
-                "`pip install --force-reinstall pymupdf`.",
-                exc,
-            )
-        return None
-
-
-_PDF_FETCH_HEADERS = {
-    "User-Agent": (
-        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
-        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
-    ),
-    "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
-}
-
-
-def _is_cert_error(exc: Exception) -> bool:
-    import ssl
-
-    # httpx nests the ssl error two causes deep (httpx.ConnectError ->
-    # httpcore.ConnectError -> SSLCertVerificationError), so walk the chain
-    # rather than checking only the direct cause. String match as fallback.
-    cause: BaseException | None = exc
-    for _ in range(5):
-        if cause is None:
-            break
-        if isinstance(cause, ssl.SSLCertVerificationError):
-            return True
-        cause = cause.__cause__
-    return "CERTIFICATE_VERIFY_FAILED" in str(exc)
-
-
-def _safe_get_pdf(url: str, settings: FetchSettings):
-    """SSRF-gated, size-capped PDF download.
-
-    TLS verification follows ``pdf_verify_tls`` (default on) with NO
-    automatic unverified retry: a MITM can serve a bad certificate
-    precisely to force such a retry, which would turn verify-by-default
-    into something the attacker controls. Mirrors with known-broken
-    certificates are handled by the explicit, user-declared
-    ``pdf_verify_tls = false`` opt-out.
-    """
-    from hyperresearch.web.safe_http import CertVerificationError, safe_get
-
-    try:
-        return safe_get(url, max_bytes=settings.max_pdf_bytes,
-                        timeout=settings.pdf_timeout_s,
-                        headers=_PDF_FETCH_HEADERS,
-                        verify=settings.pdf_verify_tls,
-                        allow_private_hosts=settings.allow_private_hosts)
-    except Exception as exc:
-        if settings.pdf_verify_tls and _is_cert_error(exc):
-            # Refuse, but say how to opt out for a trusted cert-broken mirror.
-            # Raised as its own type: the browser lane runs with TLS errors
-            # ignored, so treating this like any failed PDF would hand the
-            # URL to a lane that amounts to an automatic unverified retry.
-            raise CertVerificationError(
-                f"certificate verification failed for {url!r}: {exc}. "
-                "If this host is a known cert-broken mirror you trust, set "
-                "pdf_verify_tls = false under [fetch] in config.toml."
-            ) from exc
-        raise
-
-
-def _fetch_pdf(url: str, settings: FetchSettings | None = None) -> WebResult | None:
-    """Download a PDF and extract text 
```

**File**: `src/hyperresearch/web/pdf.py` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
+"""PDF lane shared by every web provider.
+
+Detects PDF URLs, downloads them through the SSRF gate, and extracts text
+with pymupdf. This used to live inside the crawl4ai provider only, so a
+vault on the builtin provider had no PDF handling at all: a direct .pdf
+link was decoded as HTML text and rejected by the junk gate as "Binary PDF
+garbage in content", identically for every mirror of the same document,
+and an arXiv /abs/ link saved the abstract page instead of the paper (#82).
+
+Every failure path here produces a reason string. Providers carry that
+reason on the fallback result's ``metadata["pdf_failure"]`` so the CLI can
+print it next to the junk verdict instead of a bare generic message.
+"""
+
+from __future__ import annotations
+
+import logging
+from datetime import UTC, datetime
+
+from hyperresearch.core.config import FetchSettings
+from hyperresearch.web.base import WebResult
+
+# Key under which a provider records why the PDF lane declined a URL when it
+# then falls back to the HTML lane. Read by `hpr fetch` when the fallback
+# result turns out to be junk.
+PDF_FAILURE_KEY = "pdf_failure"
+
+_PYMUPDF_MISSING_LOGGED = False
+
+
+def pdf_log() -> logging.Logger:
+    return logging.getLogger("hyperresearch.pdf")
+
+
+def is_pdf_url(url: str) -> bool:
+    """Check if URL likely points to a PDF."""
+    from urllib.parse import urlparse
+
+    parsed = urlparse(url.lower())
+    path = parsed.path
+    # Direct .pdf links
+    if path.endswith(".pdf"):
+        return True
+    # Common academic PDF patterns
+    if "/pdf/" in path or "/pdfs/" in path:
+        return True
+    # arXiv PDF links
+    return "arxiv.org" in parsed.netloc and ("/pdf/" in path or "/abs/" in path)
+
+
+def import_pymupdf():
+    """Import pymupdf, warning loudly (once) if it is unavailable.
+
+    Without this warning a missing/broken pymupdf is invisible: every PDF falls
+    through to the HTML lane, arrives as binary, and is discarded as junk —
+    across every domain at once, with nothing explaining why.
+    """
+    global _PYMUPDF_MISSING_LOGGED
+    try:
+        import pymupdf
+
+        return pymupdf
+    except ImportError as exc:
+        if not _PYMUPDF_MISSING_LOGGED:
+            _PYMUPDF_MISSING_LOGGED = True
+            pdf_log().error(
+                "pymupdf could not be imported (%s) — PDF text extraction is disabled, "
+                "so every PDF will be discarded as junk content. Reinstall it with "
+                "`pip install --force-reinstall pymupdf`.",
+                exc,
+            )
+        return None
+
+
+PDF_FETCH_HEADERS = {
+    "User-Agent": (
+        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
+        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
+    ),
+    "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
+}
+
+
+def _is_cert_error(exc: Exception) -> bool:
+    import ssl
+
+    # httpx nests the ssl error two causes deep (httpx.ConnectError ->
+    # httpcore.ConnectError -> SSLCertVerificationError), so walk the chain
+    # rather than checking only the direct cause. String match as fallback.
+    cause: BaseException | None = exc
+    for _ in range(5):
+        if cause is None:
+            break
+        if isinstance(cause, ssl.SSLCertVerificationError):
+            return True
+        cause = cause.__cause__
+    return "CERTIFICATE_VERIFY_FAILED" in str(exc)
+
+
+def safe_get_pdf(url: str, settings: FetchSettings):
+    """SSRF-gated, size-capped PDF download.
+
+    TLS verification follows ``pdf_verify_tls`` (default on) with NO
+    automatic unverified retry: a MITM can serve a bad certificate
+    precisely to force such a retry, which would turn verify-by-default
+    into something the attacker controls. Mirrors with known-broken
+    certificates are handled by the explicit, user-declared
+    ``pdf_verify_tls = false`` opt-out.
+    """
+    from hyperresearch.web.safe_http import CertVerificationError, safe_get
+
+    try:
+        return safe_get(url, max_bytes=settings.max_pdf_bytes,
+                        timeout=settings.pdf_timeout_s,
+                        headers=PDF_FETCH_HEADERS,
+                        verify=settings.pdf_verify_tls,
+                        allow_private_hosts=settings.allow_private_hosts)
+    except Exception as exc:
+        if settings.pdf_verify_tls and _is_cert_error(exc):
+            # Refuse, but say how to opt out for a trusted cert-broken mirror.
+            # Raised as its own type: the browser lane runs with TLS errors
+            # ignored, so treating this like any failed PDF would hand the
+            # URL to a lane that amounts to an automatic unverified retry.
+            raise CertVerificationError(
+                f"certificate verification failed for {url!r}: {exc}. "
+                "If this host is a known cert-broken mirror you trust, set "
+                "pdf_verify_tls = false under [fetch] in config.
```

**File**: `tests/test_cli/test_oa_fetch.py` (modified, +3/-3)
```diff
@@ -86,16 +86,16 @@ def vault_dir(tmp_path: Path, monkeypatch) -> Path:
     )
 
     from hyperresearch.core import oa, scholar
-    from hyperresearch.web import crawl4ai_provider
+    from hyperresearch.web import pdf as pdf_lane
 
     monkeypatch.setattr("hyperresearch.web.base.get_provider", lambda *a, **k: _AbstractOnlyProvider())
     monkeypatch.setattr(
         scholar, "_http_get_json", lambda url: UNPAYWALL if "unpaywall" in url else None
     )
     monkeypatch.setattr(oa.socket, "getaddrinfo", lambda h, p: [(2, 1, 6, "", ("93.184.216.34", 0))])
     monkeypatch.setattr(
-        crawl4ai_provider,
-        "_fetch_pdf",
+        pdf_lane,
+        "fetch_pdf",
         lambda url, settings: WebResult(url=url, title="Widget Paper", content=FULL_TEXT),
     )
     return root
```

**File**: `tests/test_core/test_oa_core_resolver.py` (modified, +2/-2)
```diff
@@ -132,15 +132,15 @@ def fake_get(url: str, headers: dict[str, str] | None = None) -> str | None:
 
 
 def _stub_pdf(monkeypatch, returned):
-    from hyperresearch.web import crawl4ai_provider
+    from hyperresearch.web import pdf as pdf_lane
 
     tried: list[str] = []
 
     def fake(url, settings):
         tried.append(url)
         return returned(url) if callable(returned) else returned
 
-    monkeypatch.setattr(crawl4ai_provider, "_fetch_pdf", fake)
+    monkeypatch.setattr(pdf_lane, "fetch_pdf", fake)
     return tried
 
 
```

---

### Incident Patch 12: `a84aa8a5` (2026-09-12)
**Commit Message**: fix: quote-integrity pairs short quoted spans instead of desyncing on them (#122)

_QUOTE_SPAN_RE required 20+ characters between quote marks, so a short
quoted term ("TVL", "Low Security") failed to match at its opening mark.
The scan then treated that term's closing mark as a new opening mark and
paired it with the next quote character in the document, reporting the
unquoted prose in between as a hallucinated quote. One real report turned
38 legitimate short quotes into 42 false quote-integrity errors.

The regex now matches any span up to 600 characters; the existing
"fewer than 5 words" skip in _check_quote_integrity decides what gets
verified, which is the job the length floor was wrongly doing.

Fixes #120, reported by @earldodd.

Co-authored-by: akshaypal912 <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01JyJz2SsnEZYWpyt55E7K3A

**File**: `src/hyperresearch/cli/lint.py` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ def _latest_report(vault):
         return None, None
 
 
-_QUOTE_SPAN_RE = re.compile(r"[\"“]([^\"“”]{20,600})[\"”]")
+_QUOTE_SPAN_RE = re.compile(r'[\"“]([^\"“”]{1,600}?)[\"”]')
 _REPORT_NUMBER_RE = re.compile(r"\d[\d,]*\.\d+%?|\d[\d,]{3,}%?|\d[\d,]*%")
 
 
```

**File**: `tests/test_core/test_verification.py` (modified, +89/-0)
```diff
@@ -126,6 +126,64 @@ def test_citecheck_cli(self, cited_vault, monkeypatch):
         assert (cited_vault.run_dir("cc-run") / "cite-check-pairs.json").exists()
 
 
+class TestQuoteSpanExtraction:
+    """Regression tests for quote span pairing (no min-length in the regex)."""
+
+    def _extract_spans(self, text: str) -> list[str]:
+        from hyperresearch.cli.lint import _QUOTE_SPAN_RE, _report_body_only
+
+        body = _report_body_only(text)
+        return [m.group(1) for m in _QUOTE_SPAN_RE.finditer(body)]
+
+    def test_short_quotes_extracted_individually(self):
+        text = (
+            'Metrics include "TVL", "Low Security", "reasonable use", '
+            '"6x Exits", and "registered entity" in the analysis.'
+        )
+        assert self._extract_spans(text) == [
+            "TVL",
+            "Low Security",
+            "reasonable use",
+            "6x Exits",
+            "registered entity",
+        ]
+
+    def test_short_quote_before_long_quote_does_not_desync(self):
+        text = (
+            'The report discusses "Low Security" instruments.\n'
+            'The source states "this is a sufficiently long quoted passage from the source".'
+        )
+        spans = self._extract_spans(text)
+        assert spans == [
+            "Low Security",
+            "this is a sufficiently long quoted passage from the source",
+        ]
+        assert len(spans) == 2
+        giant = "Low Security" + text.split('"Low Security"', 1)[1].split('"', 1)[0]
+        assert giant not in spans[0]
+        assert " instruments" not in spans[0]
+
+    def test_curly_quotes_and_straight_quotes(self):
+        text = 'Curly “quoted phrase” and straight "another phrase" here.'
+        assert self._extract_spans(text) == ["quoted phrase", "another phrase"]
+
+    def test_adjacent_quoted_phrases(self):
+        text = 'Terms "TVL" "Low Security" appear back to back.'
+        assert self._extract_spans(text) == ["TVL", "Low Security"]
+
+    def test_punctuation_after_closing_quote(self):
+        text = 'The label "Low Security", is used throughout.'
+        assert self._extract_spans(text) == ["Low Security"]
+
+    def test_apostrophe_inside_quote(self):
+        text = 'As noted, "Python\'s async/await syntax enables concurrent I/O" today.'
+        assert self._extract_spans(text) == ["Python's async/await syntax enables concurrent I/O"]
+
+    def test_citation_markers_stripped_before_extraction(self):
+        text = 'Evidence shows "Low Security" risk [[rust-ownership]].'
+        assert self._extract_spans(text) == ["Low Security"]
+
+
 class TestVerificationLints:
     def _lint(self, vault, rule, monkeypatch):
         from typer.testing import CliRunner
@@ -158,6 +216,37 @@ def test_quote_integrity_passes_real_quote(self, seeded_vault, monkeypatch):
         issues = [i for i in payload["data"]["issues"] if i["rule"] == "quote-integrity"]
         assert issues == []
 
+    def test_quote_integrity_skips_short_quotes_without_false_positive(
+        self, seeded_vault, monkeypatch
+    ):
+        report = seeded_vault.root / "research" / "notes" / "final_report_q.md"
+        report.write_text(
+            'The analysis covers "TVL", "Low Security", "reasonable use", '
+            '"6x Exits", and "registered entity" throughout the report body. '
+            "Intervening prose that would be swallowed by a desynchronized matcher "
+            "when it crosses twenty characters of unquoted text in the document.",
+            encoding="utf-8",
+        )
+        payload = self._lint(seeded_vault, "quote-integrity", monkeypatch)
+        issues = [i for i in payload["data"]["issues"] if i["rule"] == "quote-integrity"]
+        assert issues == []
+
+    def test_quote_integrity_short_quote_before_long_fabrication(
+        self, seeded_vault, monkeypatch
+    ):
+        report = seeded_vault.root / "research" / "notes" / "final_report_q.md"
+        report.write_text(
+            'The report discusses "Low Security" instruments with intervening prose '
+            "that must not be treated as part of a quoted span.\n"
+            'The paper concludes that "quantum entanglement reverses causality in every measurable frame of reference".',
+            encoding="utf-8",
+        )
+        payload = self._lint(seeded_vault, "quote-integrity", monkeypatch)
+        issues = [i for i in payload["data"]["issues"] if i["rule"] == "quote-integrity"]
+        assert len(issues) == 1
+        assert "quantum entanglement" in issues[0]["message"]
+        assert "Low Security" not in issues[0]["message"]
+
     def test_numeric_consistency_flags_untraceable(self, cited_vault, monkeypatch):
         report = cited_vault.root / "research" / "notes" / "final_report_n.md"
         report.write_text("Revenue grew 47.3% while costs fell 1,234,567 dollars.", encoding="utf-8")
```

---

### Incident Patch 13: `91fda5a7` (2026-09-11)
**Commit Message**: fix: backlog sweep — seven issues in one PR (#114)

* fix: [[Label]](url) is a markdown link, not a wikilink (#93)

Crawled markdown from GitHub READMEs, awesome-lists and Wikipedia-style
pages carries `[[Label]](https://url)` — a markdown link whose label is
bracketed. WIKI_LINK_RE matched the `[[Label]]` prefix, sync wrote a row
to `links`, and `repair --stub` (default, mandated after every session)
minted a real stub note for every such label. The stubs then topped both
rankers: `_most-linked.md` led with `[[100]]` and `t.IO[t.Any`.

Three parts:

1. Core guard — WIKI_LINK_RE gains a `(?!\()` negative lookahead so a
   `]]` immediately followed by `(` is not a wikilink. A real wikilink is
   never directly followed by `(`; `[[note]] (2024)` still matches. Fixes
   all four extraction sites (core/sync, core/note, cli/repair, cli/graph)
   at once.

2. Content guards — is_valid_wiki_link_target() now also rejects refs
   containing an unsubstituted `{placeholder}` and refs with unbalanced
   `[`/`]` (the `t.IO[t.Any` shape). Existing rules kept.

3. Ranker exclusion — resolver-minted stubs are excluded from
   IndexGenerator._build_most_linked and from compute_centrality's node
  

**File**: `.github/workflows/ci.yml` (modified, +17/-2)
```diff
@@ -8,10 +8,25 @@ on:
 
 jobs:
   test:
-    runs-on: ubuntu-latest
+    # Branch protection requires checks named exactly `test (3.11)` etc.
+    # Without an explicit name the os dimension would rename them to
+    # `test (ubuntu-latest, 3.11)` and every PR would wait on a status
+    # that never reports. Ubuntu keeps the bare name; Windows is suffixed.
+    name: test (${{ matrix.python-version }}${{ matrix.os == 'windows-latest' && ', windows' || '' }})
+    runs-on: ${{ matrix.os }}
     strategy:
+      fail-fast: false
       matrix:
+        os: [ubuntu-latest]
         python-version: ["3.11", "3.12", "3.13"]
+        include:
+          # The maintainer develops on Windows; socket, path and signal
+          # semantics differ enough (#104) that ubuntu-only checks cannot
+          # catch a class of bug that shows up locally every day. One
+          # Windows job on the version used locally keeps that coverage
+          # without tripling the matrix.
+          - os: windows-latest
+            python-version: "3.11"
 
     steps:
       - uses: actions/checkout@v7
@@ -21,4 +36,4 @@ jobs:
       - run: pip install -e ".[dev]" build
       - run: ruff check src/ tests/
       - run: pytest tests/ -v
-      - run: python -m build --outdir /tmp/hyperresearch-dist
+      - run: python -m build --outdir ${{ runner.temp }}/hyperresearch-dist
```

**File**: `CHANGELOG.md` (modified, +23/-0)
```diff
@@ -2,6 +2,29 @@
 
 ## [Unreleased]
 
+### Seven fixes from the backlog sweep
+
+- **Markdown links no longer mint stub notes (#93, reported by @ThiagoMafra-Integrare).** `[[Label]](https://…)` — everywhere on GitHub READMEs, awesome-lists and Wikipedia-shaped pages — parsed as a wikilink, and `repair --stub` (default on, and mandated after every session) turned each one into a real note that then topped `_most-linked` and inflated PageRank. `WIKI_LINK_RE` now refuses a `]]` immediately followed by `(`; the hygiene filter also rejects unsubstituted `{…}` placeholders and unbalanced brackets. Resolver-minted stubs are excluded from both rankers and have their stale centrality zeroed, so vaults polluted before this fix recover on the next `graph rank`. The stub marker is centralized so the minting sites and the filter cannot drift.
+- **`claims ingest` finds the claims (#69, reported by @fduple).** The default scan read only the legacy `research/temp/`, while every producer and consumer had moved to `research/runs/<tag>/temp/` — so the claims table was empty in every real run and `claims matrix` / `targets` were dead on arrival. The default now scans both; `--tag` narrows to the run. A zero-file default scan prints a hint instead of a bare zero.
+- **A Semantic Scholar rate limit is reported as a rate limit (#70, reported by @fduple).** A 429 was folded into "No metadata found" — an affirmatively wrong diagnosis. 429s now retry three times with backoff (honouring `Retry-After`), and an exhausted budget surfaces as `rate_limited` in `sources score` output rather than `missing`. Nothing is cached for a throttle, so the next run retries. Optional `S2_API_KEY` support, scoped to `semanticscholar.org` hosts only — the fetch helper is shared with Unpaywall and Europe PMC, and an unscoped header would have shipped the key to them.
+- **`run resume` names a skill that exists, chapters reach the manifest, step 8 keeps its preflight gaps (#100, from @darlingm's contract audit in #88).** `resume` printed `hyperresearch-2` for a skill named `hyperresearch-2-width-sweep`, and CLAUDE.md advertises `resume` as the recovery path — the slug now comes from the installer's own step table. `set_chapter()` had zero callers; it is gone, and the `chapter-plan` event the partition skill already emits now registers the chapter, so a resumed dissertation reports what is actually pending. Step 8's subagent wrote to the same file the preflight had just written; it gets its own output and a merge step, and gap records carry the `id` the dispatch already referenced.
+- **Every pipeline constant is authored once (#101, from @darlingm's contract audit in #88).** `citation_density_min` sat unread on the profile while two gates hardcoded their own number; the draft orchestrator hardcoded word targets the synthesizer templated, so on `premier` the two halves of a run were 60% apart; step 4 templated `loci_analysts` and then said "both" and wrote `loci-a.json` / `loci-b.json`. A new test asserts every `Profile` field is read somewhere outside `profiles.py` — and it found **eight more** dead fields (`comparisons_tensions`, `source_tensions`, `tension_survey`, `tension_full_reads`, `corpus_critic_fetchers`, `citation_totals`, `utility_scoring`, `vault_check_interval_s`), all now wired into the prose that had been hardcoding them. `char_targets_no_word_boundary` is authored per gear at the 3:1 ratio the profile already used, which moved full's argumentative range from 20000–25000 to 15000–30000 — the old span was 1.25× against a 2× word span.
+- **Citation density is per 1000 effective words, not per 1000 characters (#76).** The floor meant something roughly 3× stricter for CJK than for English. The denominator reuses #64's boundary detection: whitespace tokens where they exist, characters ÷ `chars_per_word_no_word_boundary` (3.0) where they don't. The floor is re-derived as `citation_density_min = 9.0` per 1000 words, which is what 1.5 per 1000 characters worked out to for English prose — English verdicts are unchanged at the boundary; CJK reports are now held to the same standard per unit of content rather than a looser one.
+- **`hpr serve` binds its port exclusively on Windows and reports the port it bound (#104).** `SO_REUSEADDR` means "reclaim TIME_WAIT" on POSIX and "share a live port" on Winsock; a second bind on a running server's port succeeded on Windows. The server class now leaves it off there. `run_server` returns and prints the actually-bound port instead of `http://127.0.0.1:0`, so the tests stopped monkeypatching `server_activate`. CI gains a single `windows-latest` job on 3.11 — the platform this project is developed on — with the required-check names held stable.
+
+### Security review of the sweep
+
+A review pass over the seven fixes above found six medium-severity problems — two of them pre-existing on `main` — and fixed each with a regression test.
+
+- **A hostile page could hang `hpr sync`.** `WIKI_LINK_RE` was quadratic o
```

**File**: `src/hyperresearch/cli/claims_cmd.py` (modified, +18/-3)
```diff
@@ -27,11 +27,24 @@ def _vault_or_exit(json_output: bool):
 
 @app.command("ingest")
 def claims_ingest(
-    paths: list[str] = typer.Argument(None, help="claims-*.json files (default: all under research/temp/)"),
-    vault_tag: str | None = typer.Option(None, "--tag", "-t", help="vault_tag to stamp on ingested claims"),
+    paths: list[str] = typer.Argument(
+        None,
+        help=(
+            "claims-*.json files (default: research/runs/<tag>/temp/ when --tag names an "
+            "existing run, else research/temp/ plus every research/runs/*/temp/)"
+        ),
+    ),
+    vault_tag: str | None = typer.Option(
+        None, "--tag", "-t",
+        help="vault_tag to stamp on ingested claims; also narrows the default scan to that run's temp/",
+    ),
     json_output: bool = typer.Option(False, "--json", "-j", help="JSON output"),
 ) -> None:
-    """Ingest claims JSON files into the claims table (idempotent)."""
+    """Ingest claims JSON files into the claims table (idempotent).
+
+    Fetchers write `research/runs/<vault_tag>/temp/claims-<note-id>.json`;
+    the no-argument form finds those (and the legacy flat `research/temp/`).
+    """
     from hyperresearch.core.claims import ingest_claims_dir, ingest_claims_file
 
     vault = _vault_or_exit(json_output)
@@ -55,6 +68,8 @@ def claims_ingest(
             f"[green]Ingested:[/] {summary['ingested']} claims "
             f"({summary['skipped']} already present) from {summary['files']} file(s)"
         )
+        if summary.get("hint"):
+            console.print(f"  [yellow]{summary['hint']}[/]")
         for e in summary["errors"]:
             console.print(f"  [yellow]{e}[/]")
 
```

**File**: `src/hyperresearch/cli/graph.py` (modified, +2/-2)
```diff
@@ -191,7 +191,7 @@ def graph_stub(
     json_output: bool = typer.Option(False, "--json", "-j", help="JSON output"),
 ) -> None:
     """Create stub notes for all broken [[links]]."""
-    from hyperresearch.core.note import write_note
+    from hyperresearch.core.note import stub_summary, write_note
     from hyperresearch.core.vault import Vault
 
     vault = Vault.discover()
@@ -231,7 +231,7 @@ def graph_stub(
             body=f"# {title}\n\n*Stub — created to resolve a broken link. Expand this note.*\n",
             note_id=target,
             status="draft",
-            summary=f"Stub for [[{target}]]",
+            summary=stub_summary(target),
         )
         created.append({"id": target, "title": title, "path": path.relative_to(vault.root).as_posix()})
 
```

**File**: `src/hyperresearch/cli/repair.py` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@ def repair(
     if stub_broken:
         if not json_output:
             console.print("[bold]2/6 Stubbing broken links...[/]")
-        from hyperresearch.core.note import write_note
+        from hyperresearch.core.note import stub_summary, write_note
         rows = vault.db.execute(
             "SELECT DISTINCT target_ref FROM links WHERE target_id IS NULL"
         ).fetchall()
@@ -66,7 +66,7 @@ def repair(
                     vault.temp_dir, title,
                     body=f"# {title}\n\n*Stub — created to resolve a broken link. Expand this note.*\n",
                     note_id=target, status="draft",
-                    summary=f"Stub for [[{target}]]",
+                    summary=stub_summary(target),
                 )
                 stubs_created += 1
             except Exception:
```

**File**: `src/hyperresearch/cli/run_cmd.py` (modified, +5/-5)
```diff
@@ -161,6 +161,7 @@ def run_resume(
     json_output: bool = typer.Option(False, "--json", "-j", help="JSON output"),
 ) -> None:
     """Print the exact position a recovering orchestrator should continue from."""
+    from hyperresearch.core.hooks import step_skill_slug
     from hyperresearch.core.runs import RunError, load_manifest, resume_position, set_status
 
     vault = _vault_or_exit(json_output)
@@ -183,11 +184,10 @@ def run_resume(
         "run_dir": str(vault.run_dir(tag)),
         "profile": manifest["profile"],
         **position,
-        "skill_to_invoke": (
-            f"hyperresearch-{position['next_step'].replace('.', '-')}"
-            if position["next_step"]
-            else None
-        ),
+        # Looked up from the installer's step-skill roster, not rebuilt by
+        # string substitution — "2" must come back as the invokable
+        # `hyperresearch-2-width-sweep`, never a bare `hyperresearch-2`.
+        "skill_to_invoke": step_skill_slug(position["next_step"]),
     }
     if json_output:
         output(success(data, vault=str(vault.root)), json_mode=True)
```

**File**: `src/hyperresearch/cli/sources.py` (modified, +16/-1)
```diff
@@ -134,6 +134,11 @@ def sources_score(
             console.print(f"  [red]RETRACTED:[/] {', '.join(result['retracted'])}")
         if result["missing"]:
             console.print(f"  [yellow]No metadata found:[/] {len(result['missing'])} notes")
+        if result.get("rate_limited"):
+            console.print(
+                f"  [red]Rate-limited (not enriched, will retry next run):[/] "
+                f"{len(result['rate_limited'])} notes — set S2_API_KEY or re-run later"
+            )
 
 
 @app.command("backfill-doi")
@@ -189,7 +194,12 @@ def sources_retractions(
     vault.auto_sync()
     result = score_sources(vault, tag=tag, fresh=True)
 
-    data = {"checked": result["scored"], "retracted": result["retracted"], "unresolved": len(result["missing"])}
+    data = {
+        "checked": result["scored"],
+        "retracted": result["retracted"],
+        "unresolved": len(result["missing"]),
+        "rate_limited": len(result.get("rate_limited", [])),
+    }
     if json_output:
         output(success(data, vault=str(vault.root)), json_mode=True)
     else:
@@ -198,6 +208,11 @@ def sources_retractions(
             console.print(f"  [red]RETRACTED:[/] {', '.join(data['retracted'])}")
         else:
             console.print("  no retractions found")
+        if data["rate_limited"]:
+            console.print(
+                f"  [red]Rate-limited:[/] {data['rate_limited']} notes could not be "
+                "re-checked — the sweep is incomplete; re-run later or set S2_API_KEY"
+            )
 
 
 @app.command("independence")
```

**File**: `src/hyperresearch/core/claims.py` (modified, +165/-37)
```diff
@@ -1,10 +1,12 @@
 """Claims persistence — fetcher-extracted claims as queryable DB rows.
 
-Fetchers write `research/temp/claims-<note-id>.json` files during step 2.
-This module ingests them into the `claims` (+ `claims_fts`) tables, keyed to
-their source notes, so downstream consumers can ask "which source best
-supports X" as a query instead of re-parsing JSON files. This is the
-substrate for phase-5 cite-checking and numeric-consistency lints.
+Fetchers write `research/runs/<vault_tag>/temp/claims-<note-id>.json` files
+during step 2 (and step 13's gap fetch); the legacy flat location
+`research/temp/claims-*.json` is still honoured. This module ingests them
+into the `claims` (+ `claims_fts`) tables, keyed to their source notes, so
+downstream consumers can ask "which source best supports X" as a query
+instead of re-parsing JSON files. This is the substrate for phase-5
+cite-checking and numeric-consistency lints.
 
 Ingest is idempotent: rows are keyed by (note_id, sha256(claim)[:16]), so
 re-running over the same files is a no-op.
@@ -14,14 +16,54 @@
 
 import hashlib
 import json
+import sqlite3
 from datetime import UTC, datetime
 from pathlib import Path
 
+# Claims files are written by agents from fetched (hostile) page content.
+# Bound what one file can cost: a size cap before it is read into memory,
+# and a per-field cap so one claim cannot bloat a row or the FTS index.
+MAX_CLAIMS_FILE_BYTES = 8 * 1024 * 1024
+MAX_CLAIM_FIELD_CHARS = 20_000
+
 
 def _claim_hash(claim: str) -> str:
     return hashlib.sha256(claim.strip().encode("utf-8")).hexdigest()[:16]
 
 
+def _text_field(value) -> str:
+    """Coerce an untrusted claim field to bounded text ('' when absent).
+
+    A claim JSON is agent-written from hostile page content, so a field
+    can be any JSON type; sqlite3 refuses to bind lists/dicts and `.strip()`
+    on a non-string would abort the whole ingest. Only strings count as
+    text — a number, list or dict where prose belongs is dropped.
+    """
+    if not isinstance(value, str):
+        return ""
+    return value.strip()[:MAX_CLAIM_FIELD_CHARS]
+
+
+def _scalar_field(value):
+    """Numbers and short strings pass; anything else becomes None."""
+    if isinstance(value, bool) or value is None:
+        return None
+    if isinstance(value, (int, float)):
+        return value
+    if isinstance(value, str):
+        return value[:MAX_CLAIM_FIELD_CHARS]
+    return None
+
+
+def _under(path: Path, root: Path) -> bool:
+    """True if `path` resolves to `root` or somewhere below it."""
+    try:
+        path.resolve().relative_to(root.resolve())
+    except (ValueError, OSError):
+        return False
+    return True
+
+
 def _note_id_from_filename(path: Path) -> str | None:
     """claims-<note-id>.json -> <note-id>."""
     stem = path.stem
@@ -54,58 +96,144 @@ def ingest_claims_file(conn, path: Path, vault_tag: str | None = None) -> dict:
         result["errors"].append(f"note '{note_id}' not in vault (sync first?)")
         return result
 
+    try:
+        size = path.stat().st_size
+    except OSError as e:
+        result["errors"].append(f"unreadable JSON: {e}")
+        return result
+    if size > MAX_CLAIMS_FILE_BYTES:
+        result["errors"].append(
+            f"claims file is {size} bytes (limit {MAX_CLAIMS_FILE_BYTES}); skipped"
+        )
+        return result
     try:
         data = json.loads(path.read_text(encoding="utf-8-sig"))
-    except (json.JSONDecodeError, OSError) as e:
+    except (json.JSONDecodeError, OSError, UnicodeDecodeError, RecursionError) as e:
         result["errors"].append(f"unreadable JSON: {e}")
         return result
 
     now = datetime.now(UTC).isoformat()
     for c in _iter_claim_dicts(data):
-        claim_text = (c.get("claim") or c.get("text") or "").strip()
+        claim_text = _text_field(c.get("claim")) or _text_field(c.get("text"))
         if not claim_text:
             result["skipped"] += 1
             continue
         h = _claim_hash(claim_text)
         numbers = c.get("numbers")
-        cur = conn.execute(
-            """INSERT OR IGNORE INTO claims
-               (note_id, claim, claim_hash, quoted_support, numbers, confidence,
-                evidence_type, stance_target, stance, vault_tag, ingested_at)
-               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
-            (
-                note_id,
-                claim_text,
-                h,
-                c.get("quoted_support"),
-                json.dumps(numbers) if numbers else None,
-                c.get("confidence"),
-                c.get("evidence_type"),
-                c.get("stance_target"),
-                c.get("stance"),
-                vault_tag,
-                now,
-            ),
-        )
-        if cur.rowcount:
-            claim_id = cur.lastrowid
-            conn.execute(
-                "INSERT INTO claims_fts (claim_id, claim, quoted_support) VALUES (?, ?, ?)",
-                (claim_id, claim
```

---

### Incident Patch 14: `20188cad` (2026-09-11)
**Commit Message**: fix: run fetch_url off the running event loop, and drop the false DUPLICATE_URL on a re-fetched, deleted note (#86)

* fix: run fetch_url off the running event loop, and drop the false DUPLICATE_URL on a re-fetched, deleted note

* fix: apply orphan-dedup check and event-loop-safe wrapper to remaining call sites

Per maintainer review on #86: the same note_id-truthiness bug existed in
three more places (cli/fetch.py, cli/fetch_batch.py, cli/research.py x2),
and fetch_many still called asyncio.run directly instead of _run_coro.

Signed-off-by: Amir Fathi <[REDACTED_EMAIL]>

* fix: apply orphan-aware dedup to the three CLI fetch sites and wrap fetch_many

Factor the duplicate-URL check into one helper, existing_live_note_for_url,
in core/fetcher.py and use it at all four sites (fetch_and_save, hpr fetch,
hpr fetch-batch, hpr research). A NULL note_id is an orphaned row left by
ON DELETE SET NULL, not a live duplicate.

The read-side check alone was not enough at the three CLI sites: they record
the source with INSERT OR IGNORE, which is a no-op on the orphaned row too.
fetch-batch and research left the new note with no source record; hpr fetch's
duplicate-race detector then read the 

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ The "Academic APIs before web search" section of the injected agent instructions
 ### Contributed fixes
 
 - **`run finish` no longer blocks every light-classified run started on the installed gear (@maximilliangrand in #95).** `verify_run()` took its required-artifact step set from the manifest's `profile_steps`, so a run initialized with `--profile full` whose step-1 decomposition classified it `light` was asked for `critic-findings-*.json` and `patch-log.json` — artifacts the light tier correctly never writes, because steps 12 and 14 are skipped by the tier gate. The run did all its light-tier work and then sat at `blocked (verify)` with no legitimate way to pass. The gate now resolves the tier declared in `prompt-decomposition.json` when it disagrees with the manifest profile, which is what the router already documents ("the manifest's profile field is informational — the decomposition's tier rules"). A missing, unreadable or unknown tier still falls back to `profile_steps`.
+- **The MCP `fetch_url` tool works again, and a deleted note's URL can be fetched again (#84, fixed by @AmirF194 in #86).** Two bugs on the same path. `Crawl4AIProvider.fetch()` and `fetch_many()` called `asyncio.run()`, which raises before the coroutine runs when the caller already has a loop — and the MCP server dispatches sync tools on its own loop thread, so the tool failed on every call while the CLI never noticed. Both now go through a wrapper that runs the coroutine on a dedicated thread when a loop is present. Separately, `sources.note_id` is `ON DELETE SET NULL`, so deleting a note leaves its row behind with a NULL id; every duplicate-URL check tested row truthiness, so that URL was `DUPLICATE_URL` ("already fetched as note 'None'") forever. All four fetch paths (`fetch_and_save`, `hpr fetch`, `hpr fetch-batch`, `hpr research`) now share one orphan-aware check. The three CLI paths also record the source with `INSERT OR IGNORE`, which was a no-op on the orphaned row too — so the new note was left with no source record, and `hpr fetch`'s duplicate-race detector then deleted the note it had just written and reported `note_id: null`. Those paths now reclaim the orphaned row after the insert; the guard on `note_id IS NULL` leaves a genuine race winner untouched.
 
 ## [0.10.1] - 2026-09-11
 
```

**File**: `src/hyperresearch/cli/fetch.py` (modified, +10/-2)
```diff
@@ -12,6 +12,7 @@
 
 from hyperresearch.cli._output import console, err_console, output
 from hyperresearch.core.config import AssetSettings, FetchSettings
+from hyperresearch.core.fetcher import existing_live_note_for_url, reclaim_orphaned_source_row
 from hyperresearch.models.output import error, success
 
 app = typer.Typer()
@@ -242,8 +243,9 @@ def fetch(
     vault.auto_sync()
     conn = vault.db
 
-    # Check if URL already fetched
-    existing = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
+    # Check if URL already fetched (an orphaned row — note deleted — is not a duplicate,
+    # so --suggested-by never tries to append a breadcrumb to a note_id of None)
+    existing = existing_live_note_for_url(conn, url)
     if existing:
         note_id = existing["note_id"]
         # Graceful duplicate handling for the guided reading loop:
@@ -540,6 +542,12 @@ def _rescue(reason: str, raw_html: str | None):
            VALUES (?, ?, ?, ?, ?, ?)""",
         (url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash),
     )
+    # An orphaned row (note deleted → ON DELETE SET NULL) also makes that INSERT
+    # a no-op, but nobody owns the url, so claim it. Guarded on note_id IS NULL,
+    # so a genuine race winner is left alone and the check below still fires.
+    reclaim_orphaned_source_row(
+        conn, url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash
+    )
     conn.commit()
 
     # Detect the race: if the committed row's note_id != ours, another
```

**File**: `src/hyperresearch/cli/fetch_batch.py` (modified, +7/-1)
```diff
@@ -9,6 +9,7 @@
 import typer
 
 from hyperresearch.cli._output import console, output
+from hyperresearch.core.fetcher import existing_live_note_for_url, reclaim_orphaned_source_row
 from hyperresearch.models.output import error, success
 
 
@@ -79,7 +80,8 @@ def _needs_visible(fetch_url: str) -> bool:
     # Filter out already-fetched URLs
     new_urls = []
     for url in all_urls:
-        existing = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
+        # An orphaned row (note deleted) is not a duplicate; only a live note skips
+        existing = existing_live_note_for_url(conn, url)
         if existing:
             if not json_output:
                 console.print(f"  [dim]Skip:[/] {url} (already fetched as {existing['note_id']})")
@@ -275,6 +277,10 @@ def _fetch_one(provider, url: str, kind: str) -> None:
                VALUES (?, ?, ?, ?, ?, ?)""",
             (url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash),
         )
+        # The INSERT is also a no-op on an orphaned row (note deleted); claim it
+        reclaim_orphaned_source_row(
+            conn, url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash
+        )
 
         # Save assets if requested
         if save_assets:
```

**File**: `src/hyperresearch/cli/research.py` (modified, +9/-8)
```diff
@@ -10,6 +10,7 @@
 import typer
 
 from hyperresearch.cli._output import console, output
+from hyperresearch.core.fetcher import existing_live_note_for_url, reclaim_orphaned_source_row
 from hyperresearch.models.output import error, success
 
 
@@ -109,11 +110,8 @@ def research(
                     break
                 if link_url in fetched_urls:
                     continue
-                # Check if already in DB
-                existing = conn.execute(
-                    "SELECT note_id FROM sources WHERE url = ?", (link_url,)
-                ).fetchone()
-                if existing:
+                # Check if already in DB (an orphaned row — note deleted — is not a duplicate)
+                if existing_live_note_for_url(conn, link_url):
                     fetched_urls.add(link_url)
                     continue
 
@@ -238,9 +236,8 @@ def _save_result(vault, conn, prov, result, tags, parent) -> dict | None:
     if result.looks_like_login_wall(url):
         return None
 
-    # Skip if already fetched
-    existing = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
-    if existing:
+    # Skip if already fetched (an orphaned row — note deleted — is not a duplicate)
+    if existing_live_note_for_url(conn, url):
         return None
 
     title = result.title or urlparse(url).path.split("/")[-1] or "Untitled"
@@ -283,6 +280,10 @@ def _save_result(vault, conn, prov, result, tags, parent) -> dict | None:
            VALUES (?, ?, ?, ?, ?, ?)""",
         (url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash),
     )
+    # The INSERT is also a no-op on an orphaned row (note deleted); claim it
+    reclaim_orphaned_source_row(
+        conn, url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash
+    )
     conn.commit()
 
     return {
```

**File**: `src/hyperresearch/core/fetcher.py` (modified, +55/-4)
```diff
@@ -3,9 +3,53 @@
 from __future__ import annotations
 
 import hashlib
+import sqlite3
 from urllib.parse import urlparse
 
 
+def existing_live_note_for_url(conn: sqlite3.Connection, url: str) -> sqlite3.Row | None:
+    """Return the ``sources`` row for ``url`` only if it still points at a live note.
+
+    ``sources.note_id`` is ``ON DELETE SET NULL``, so deleting a note leaves its
+    row behind with ``note_id = NULL``. That orphan is not a duplicate — the url
+    may be fetched again — so this returns None both when the row is absent and
+    when it is orphaned. Every duplicate-url check must go through here rather
+    than testing row truthiness.
+    """
+    row = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
+    if row is None or row["note_id"] is None:
+        return None
+    return row
+
+
+def reclaim_orphaned_source_row(
+    conn: sqlite3.Connection,
+    url: str,
+    note_id: str,
+    domain: str,
+    fetched_at: str,
+    provider: str,
+    content_hash: str,
+) -> None:
+    """Point an orphaned ``sources`` row (``note_id IS NULL``) for ``url`` at ``note_id``.
+
+    The CLI fetch paths record a source with ``INSERT OR IGNORE`` so that a
+    duplicate-url race is a silent no-op instead of an IntegrityError. An
+    orphaned row makes that INSERT a no-op too, which would leave the freshly
+    written note with no source record (and, in ``fetch``, trip the race
+    detector into deleting it). Call this right after the INSERT: the
+    ``note_id IS NULL`` guard means it claims only an orphan and stays a no-op
+    when another fetch already owns the row, so the race semantics are unchanged.
+    """
+    conn.execute(
+        """UPDATE sources
+           SET note_id = ?, domain = ?, fetched_at = ?, provider = ?,
+               content_hash = ?, status = 'active'
+           WHERE url = ? AND note_id IS NULL""",
+        (note_id, domain, fetched_at, provider, content_hash, url),
+    )
+
+
 def fetch_and_save(
     vault,
     url: str,
@@ -29,8 +73,8 @@ def fetch_and_save(
     tags = tags or []
     conn = vault.db
 
-    # Check if URL already fetched
-    existing = conn.execute("SELECT note_id FROM sources WHERE url = ?", (url,)).fetchone()
+    # Check if URL already fetched (an orphaned row — note deleted — is not a duplicate)
+    existing = existing_live_note_for_url(conn, url)
     if existing:
         raise ValueError(f"URL already fetched as note '{existing['note_id']}'")
 
@@ -157,11 +201,18 @@ def fetch_and_save(
     if plan.to_add or plan.to_update:
         execute_sync(vault, plan)
 
-    # Record source
+    # Record source (upsert: an orphaned row for this url may already exist)
     content_hash = hashlib.sha256(result.content.encode("utf-8")).hexdigest()[:16]
     conn.execute(
         """INSERT INTO sources (url, note_id, domain, fetched_at, provider, content_hash)
-           VALUES (?, ?, ?, ?, ?, ?)""",
+           VALUES (?, ?, ?, ?, ?, ?)
+           ON CONFLICT(url) DO UPDATE SET
+               note_id = excluded.note_id,
+               domain = excluded.domain,
+               fetched_at = excluded.fetched_at,
+               provider = excluded.provider,
+               content_hash = excluded.content_hash,
+               status = 'active'""",
         (url, note_id, domain, result.fetched_at.isoformat(), prov.name, content_hash),
     )
     conn.commit()
```

**File**: `src/hyperresearch/web/crawl4ai_provider.py` (modified, +31/-3)
```diff
@@ -13,6 +13,7 @@
 import os
 import pathlib
 import sys
+import threading
 from datetime import UTC, datetime
 
 from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, DefaultMarkdownGenerator
@@ -35,6 +36,33 @@
                 pass
 
 
+def _run_coro(coro):
+    """Run ``coro`` to completion, whether or not this thread already has a running
+    event loop (the MCP server dispatches sync tools on its own loop's thread; the
+    CLI does not). A plain ``asyncio.run(coro)`` only works in the second case, so
+    fall back to a dedicated thread, which has no running loop of its own.
+    """
+    try:
+        asyncio.get_running_loop()
+    except RuntimeError:
+        return asyncio.run(coro)
+
+    box: dict = {}
+
+    def _target() -> None:
+        try:
+            box["result"] = asyncio.run(coro)
+        except BaseException as exc:  # re-raised on the caller's thread below
+            box["error"] = exc
+
+    thread = threading.Thread(target=_target)
+    thread.start()
+    thread.join()
+    if "error" in box:
+        raise box["error"]
+    return box["result"]
+
+
 def _is_pdf_url(url: str) -> bool:
     """Check if URL likely points to a PDF."""
     from urllib.parse import urlparse
@@ -393,9 +421,9 @@ def fetch(self, url: str) -> WebResult:
 
         # When visible + profile: use Playwright directly (crawl4ai managed browser ignores headless=False)
         if not self._headless and self._data_dir:
-            return asyncio.run(self._fetch_visible(url))
+            return _run_coro(self._fetch_visible(url))
 
-        result = asyncio.run(self._fetch_async(url))
+        result = _run_coro(self._fetch_async(url))
 
         # Post-fetch PDF detection: if the browser got binary garbage (PDF served
         # inline without proper content-type handling), re-fetch as a direct PDF download.
@@ -520,7 +548,7 @@ async def _fetch_async(self, url: str) -> WebResult:
 
     def fetch_many(self, urls: list[str]) -> list[WebResult]:
         """Fetch multiple URLs concurrently using crawl4ai's arun_many."""
-        return asyncio.run(self._fetch_many_async(urls))
+        return _run_coro(self._fetch_many_async(urls))
 
     async def _fetch_many_async(self, urls: list[str]) -> list[WebResult]:
         # SSRF gate: same entry-point check as fetch(). Refused URLs are
```

**File**: `tests/test_cli/test_orphan_dedup_call_sites.py` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+"""The three CLI-side duplicate-url call sites: `fetch`, `fetch-batch`, and
+research's `_save_result`. All three read `sources.note_id`, which is NULL
+(not row-absent) once the note is deleted (ON DELETE SET NULL), so a bare
+`if existing:` treated that as a live duplicate forever.
+
+All three also record the source with `INSERT OR IGNORE`, which is a no-op on
+the orphaned row too — so passing the read-side check alone left the new note
+with no source record, and in `fetch` tripped the duplicate-url race detector
+into deleting the note it had just written. Every test here drives the real
+deletion path (the note is actually removed and the vault re-synced) rather
+than faking a NULL, and asserts that the row ends up pointing at the new note.
+Mirrors tests/test_core/test_fetcher_orphan_dedup.py for fetch_and_save.
+"""
+
+from __future__ import annotations
+
+import json
+import os
+from pathlib import Path
+
+import pytest
+from typer.testing import CliRunner
+
+from hyperresearch.cli import app
+from hyperresearch.web.base import WebResult
+
+runner = CliRunner()
+
+
+class _FakeProvider:
+    name = "fake"
+
+    def fetch(self, url: str) -> WebResult:
+        return WebResult(url=url, title="Fake Title", content="enough content to clear the junk gate. " * 10)
+
+
+@pytest.fixture
+def vault_dir(tmp_path: Path) -> Path:
+    result = runner.invoke(app, ["init", str(tmp_path / "kb"), "--name", "Orphan Dedup Test"])
+    assert result.exit_code == 0
+    return tmp_path / "kb"
+
+
+def _source_row(vault_dir: Path, url: str):
+    from hyperresearch.core.vault import Vault
+
+    return Vault.discover(vault_dir).db.execute(
+        "SELECT note_id FROM sources WHERE url = ?", (url,)
+    ).fetchone()
+
+
+def _delete_note_for_real(vault_dir: Path, note_id: str, url: str) -> None:
+    """`note rm` — the real path: the notes row goes, and ON DELETE SET NULL
+    leaves the sources row behind with note_id = NULL."""
+    result = runner.invoke(app, ["note", "rm", note_id, "--force", "--json"])
+    assert result.exit_code == 0, result.output
+    row = _source_row(vault_dir, url)
+    assert row is not None and row["note_id"] is None  # orphaned, not deleted
+
+
+def test_fetch_refetches_after_note_is_deleted(vault_dir: Path, monkeypatch):
+    os.chdir(vault_dir)
+    monkeypatch.setattr("hyperresearch.web.base.get_provider", lambda *a, **k: _FakeProvider())
+    url = "https://example.com/cli-fetch-refetch"
+
+    first = runner.invoke(app, ["fetch", url, "--json"])
+    assert first.exit_code == 0
+    note_id = json.loads(first.output)["data"]["note_id"]
+
+    _delete_note_for_real(vault_dir, note_id, url)
+
+    second = runner.invoke(app, ["fetch", url, "--json"])
+    assert second.exit_code == 0, second.output  # must not report DUPLICATE_URL
+    data = json.loads(second.output)["data"]
+    # A None here means the race detector mistook the orphan for a lost race
+    # and deleted the note it had just written.
+    assert data["note_id"] is not None
+    assert (vault_dir / data["path"]).exists()
+    assert _source_row(vault_dir, url)["note_id"] == data["note_id"]
+
+
+def test_fetch_with_suggested_by_refetches_rather_than_breadcrumbing_none(
+    vault_dir: Path, monkeypatch
+):
+    """--suggested-by on a live duplicate appends a breadcrumb to the existing
+    note; on an orphan there is no note to breadcrumb, so it must re-fetch."""
+    os.chdir(vault_dir)
+    monkeypatch.setattr("hyperresearch.web.base.get_provider", lambda *a, **k: _FakeProvider())
+    url = "https://example.com/cli-fetch-suggested"
+
+    first = runner.invoke(app, ["fetch", url, "--json"])
+    assert first.exit_code == 0
+    note_id = json.loads(first.output)["data"]["note_id"]
+
+    live = runner.invoke(app, ["fetch", url, "--suggested-by", "some-note", "--json"])
+    assert live.exit_code == 0, live.output
+    assert json.loads(live.output)["data"]["duplicate"] is True
+
+    _delete_note_for_real(vault_dir, note_id, url)
+
+    second = runner.invoke(app, ["fetch", url, "--suggested-by", "some-note", "--json"])
+    assert second.exit_code == 0, second.output
+    data = json.loads(second.output)["data"]
+    assert "duplicate" not in data
+    assert data["note_id"] is not None
+    assert _source_row(vault_dir, url)["note_id"] == data["note_id"]
+
+
+def test_fetch_batch_does_not_skip_a_deleted_note_url(vault_dir: Path, monkeypatch):
+    os.chdir(vault_dir)
+    monkeypatch.setattr("hyperresearch.web.base.get_provider", lambda *a, **k: _FakeProvider())
+    url = "https://example.com/cli-batch-refetch"
+
+    first = runner.invoke(app, ["fetch", url, "--json"])
+    assert first.exit_code == 0
+    note_id = json.loads(first.output)["data"]["note_id"]
+    _delete_note_for_real(vault_dir, note_id, url)
+
+    batch = runner.invoke(app, ["fetch-batch", url, "--json"])
+    assert batch.exit_code == 0, batch.output
+    data = json.loads(batch.output)["data"]
+    assert data["skipped
```

**File**: `tests/test_core/test_fetcher_orphan_dedup.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""A sources row survives note deletion (ON DELETE SET NULL); fetch_and_save's
+duplicate-URL check and its own INSERT must both handle that orphaned row rather
+than treat it as a live duplicate forever."""
+
+from __future__ import annotations
+
+from hyperresearch.core.fetcher import fetch_and_save
+from hyperresearch.core.sync import compute_sync_plan, execute_sync
+from hyperresearch.web.base import WebResult
+
+
+class _FakeProvider:
+    name = "fake"
+
+    def fetch(self, url: str) -> WebResult:
+        return WebResult(url=url, title="Fake Title", content="enough content to clear the junk gate. " * 10)
+
+
+def test_refetch_succeeds_after_the_note_is_deleted(tmp_vault, monkeypatch):
+    monkeypatch.setattr(
+        "hyperresearch.web.base.get_provider", lambda *a, **k: _FakeProvider()
+    )
+    url = "https://example.com/refetch-me"
+
+    first = fetch_and_save(tmp_vault, url)
+    note_path = tmp_vault.root / first["path"]
+    assert note_path.exists()
+
+    note_path.unlink()
+    plan = compute_sync_plan(tmp_vault)
+    execute_sync(tmp_vault, plan)
+
+    row = tmp_vault.db.execute(
+        "SELECT note_id FROM sources WHERE url = ?", (url,)
+    ).fetchone()
+    assert row is not None and row["note_id"] is None  # orphaned, not deleted
+
+    second = fetch_and_save(tmp_vault, url)  # must not raise ValueError
+    assert (tmp_vault.root / second["path"]).exists()
+    row = tmp_vault.db.execute(
+        "SELECT note_id FROM sources WHERE url = ?", (url,)
+    ).fetchone()
+    assert row["note_id"] == second["note_id"]  # the upsert re-linked the row
+
+
+def test_live_duplicate_is_still_rejected(tmp_vault, monkeypatch):
+    monkeypatch.setattr(
+        "hyperresearch.web.base.get_provider", lambda *a, **k: _FakeProvider()
+    )
+    url = "https://example.com/still-a-duplicate"
+
+    fetch_and_save(tmp_vault, url)
+
+    try:
+        fetch_and_save(tmp_vault, url)
+        raise AssertionError("expected ValueError for a URL with a live note")
+    except ValueError as exc:
+        assert "already fetched" in str(exc)
```

---

### Incident Patch 15: `bb7c407d` (2026-09-11)
**Commit Message**: fix: verify keys tier artifacts on the classified tier, not the manifest profile (#95)

The router tells the orchestrator to initialize a run with the installed
gear and then lets step 1 reclassify it: "if step 1 classifies differently,
the manifest's profile field is informational — the decomposition's tier
rules" (skills/hyperresearch.md, bootstrap step 2.5).

`verify_run` was the one place not honoring that. It derived its
required-artifact set from `manifest["profile_steps"]`, so a run started
with `--profile full` whose `prompt-decomposition.json` says
`"pipeline_tier": "light"` was asked for `critic-findings-*.json` and
`patch-log.json`. Light tier never writes those: steps 12 and 14 are
skipped by the tier gate. The run finished all its light-tier work and then
sat at `blocked (verify)` with no legitimate way to pass, since the gate's
own rules forbid re-interpreting failures and stubbing fake critic findings
would defeat the point of the gate.

Fix: `_required_step_ids` resolves the declared tier's profile when the
decomposition disagrees with the manifest, and takes the step set from
there. A decomposition with no tier, an unreadable one, or a tier that
resolves to no prof

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -37,6 +37,10 @@ Recovery used to ask Unpaywall, then Europe PMC. But `contact_email` is empty by
 
 The "Academic APIs before web search" section of the injected agent instructions tells agents to run `hpr scholar search` and not to hand-assemble API URLs, and explains what each source is for.
 
+### Contributed fixes
+
+- **`run finish` no longer blocks every light-classified run started on the installed gear (@maximilliangrand in #95).** `verify_run()` took its required-artifact step set from the manifest's `profile_steps`, so a run initialized with `--profile full` whose step-1 decomposition classified it `light` was asked for `critic-findings-*.json` and `patch-log.json` — artifacts the light tier correctly never writes, because steps 12 and 14 are skipped by the tier gate. The run did all its light-tier work and then sat at `blocked (verify)` with no legitimate way to pass. The gate now resolves the tier declared in `prompt-decomposition.json` when it disagrees with the manifest profile, which is what the router already documents ("the manifest's profile field is informational — the decomposition's tier rules"). A missing, unreadable or unknown tier still falls back to `profile_steps`.
+
 ## [0.10.1] - 2026-09-11
 
 A maintenance release. Everything here is a contributed fix, and two of them unblock users who could not ship a run at all.
```

**File**: `src/hyperresearch/core/runs.py` (modified, +43/-2)
```diff
@@ -344,6 +344,46 @@ def run_report_data(vault, vault_tag: str) -> dict:
     }
 
 
+def _declared_tier(run_dir: Path) -> str | None:
+    """The `pipeline_tier` step 1 wrote into prompt-decomposition.json.
+
+    Tolerant on purpose: a missing or unreadable decomposition just means
+    "no declared tier", and verify_run reports the unreadable case through
+    its own `decomposition-readable` check.
+    """
+    decomp_path = run_dir / "prompt-decomposition.json"
+    if not decomp_path.exists():
+        return None
+    try:
+        decomp = json.loads(decomp_path.read_text(encoding="utf-8-sig"))
+    except (OSError, json.JSONDecodeError):
+        return None
+    tier = decomp.get("pipeline_tier") if isinstance(decomp, dict) else None
+    return tier if isinstance(tier, str) and tier.strip() else None
+
+
+def _required_step_ids(manifest: dict, run_dir: Path, config_path: Path | None) -> set[str]:
+    """Step ids whose artifacts the ship gate demands.
+
+    The router initializes a run with the installed gear and lets step 1
+    reclassify it: "the manifest's profile field is informational — the
+    decomposition's tier rules". So when the decomposition declares a tier
+    that disagrees with the manifest profile, that tier's step set wins;
+    otherwise (no tier, same tier, or a tier that resolves to nothing) the
+    manifest's own `profile_steps` stand.
+    """
+    from hyperresearch.core.profiles import ProfileError, resolve_profile
+
+    steps = {str(s) for s in manifest.get("profile_steps", [])}
+    tier = _declared_tier(run_dir)
+    if tier is None or tier == manifest.get("profile"):
+        return steps
+    try:
+        return {str(s) for s in resolve_profile(tier, config_path).steps}
+    except ProfileError:
+        return steps
+
+
 def verify_run(vault, vault_tag: str) -> dict:
     """Structural verification battery for a completed run.
 
@@ -485,8 +525,9 @@ def check(name: str, ok: bool, detail: str) -> None:
         except Exception as exc:
             check("content-lints", False, f"content lint rules failed to run: {exc}")
 
-    # Tier-mandated artifacts
-    steps = set(manifest.get("profile_steps", []))
+    # Tier-mandated artifacts, keyed on the tier the run actually ran (see
+    # _required_step_ids) rather than the profile it was initialized with.
+    steps = _required_step_ids(manifest, run_dir, vault.config_path)
     if {"12", "14"} <= steps:
         for name in (
             "critic-findings-dialectic.json", "critic-findings-depth.json",
```

**File**: `tests/test_core/test_verification.py` (modified, +55/-0)
```diff
@@ -356,6 +356,61 @@ def test_verify_respects_profile_override_for_non_cjk_script(self, tmp_vault):
         assert "300-900" in by_name["length-in-range"]["detail"]
 
 
+class TestClassifiedTierArtifacts:
+    """The router lets step 1 reclassify a run's tier after `run init`:
+    "the manifest's profile field is informational — the decomposition's
+    tier rules". The ship gate has to read the same rule, or a
+    light-classified run started on the installed gear is asked for critic
+    findings that light tier never produces."""
+
+    def _light_classified_gear_run(self, tmp_vault, tag: str, tier: str | None):
+        init_run(tmp_vault, tag, profile="full")
+        run_dir = tmp_vault.run_dir(tag)
+        decomp = {
+            "response_format": "short",
+            "required_section_headings": ["## Findings"],
+        }
+        if tier is not None:
+            decomp["pipeline_tier"] = tier
+        (run_dir / "prompt-decomposition.json").write_text(
+            json.dumps(decomp), encoding="utf-8"
+        )
+        (run_dir / "polish-log.json").write_text('{"applied": []}', encoding="utf-8")
+        report = tmp_vault.root / "research" / "notes" / f"final_report_{tag}.md"
+        report.write_text(
+            "## Findings\n\n"
+            + ("Substantive sentence with real evidence attached [[src-note]]. " * 80),
+            encoding="utf-8",
+        )
+        return run_dir
+
+    def test_light_classified_gear_run_passes_without_critic_artifacts(self, tmp_vault):
+        self._light_classified_gear_run(tmp_vault, "tier-01", "light")
+
+        result = verify_run(tmp_vault, "tier-01")
+        names = {c["name"] for c in result["checks"]}
+        assert not [n for n in names if n.startswith("artifact:critic-findings")]
+        assert "artifact:patch-log.json" not in names
+        assert "artifact:polish-log.json" in names
+        assert result["passed"] is True
+
+    def test_gear_run_without_declared_tier_still_needs_critic_artifacts(self, tmp_vault):
+        self._light_classified_gear_run(tmp_vault, "tier-02", None)
+
+        result = verify_run(tmp_vault, "tier-02")
+        by_name = {c["name"]: c for c in result["checks"]}
+        assert by_name["artifact:critic-findings-dialectic.json"]["ok"] is False
+        assert result["passed"] is False
+
+    def test_unknown_declared_tier_falls_back_to_manifest_profile(self, tmp_vault):
+        self._light_classified_gear_run(tmp_vault, "tier-03", "bogus")
+
+        result = verify_run(tmp_vault, "tier-03")
+        by_name = {c["name"]: c for c in result["checks"]}
+        assert by_name["artifact:critic-findings-dialectic.json"]["ok"] is False
+        assert result["passed"] is False
+
+
 class TestTelemetryAndVerify:
     def test_run_report_rollup(self, tmp_vault):
         init_run(tmp_vault, "tel-01", profile="light")
```

#### Recent Merged Pull Requests:
- **PR #152** (2026-09-30): docs: tag the README links to hyperresearch.ai with UTM params (@jordan-gibbs)
- **PR #151** (2026-09-29): docs: link the hosted version from the README (@jordan-gibbs)
- **PR #149** (2026-09-25): feat: run the research pipeline on OpenAI Codex (@jordan-gibbs)
- **PR #148** (2026-09-24): release: v0.12.0 (@jordan-gibbs)
- **PR #147** (2026-09-24): Ship the repo as a Claude Code plugin with a deep-research skill (@jordan-gibbs)
- **PR #146** (2026-09-23): fix: an unknown retraction result never erases a known retraction (@jordan-gibbs)
- **PR #145** (2026-09-23): fix: crawl4ai headless lane verifies TLS certificates (#137) (@jordan-gibbs)
- **PR #144** (2026-09-23): fix: code strip honours fence length before wiki-link parsing (#140) (@jordan-gibbs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

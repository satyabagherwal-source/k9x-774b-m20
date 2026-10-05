# Forensic Learning Record (Deep Inspection): SamurAIGPT/llm-wiki-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/samuraigpt-llm-wiki-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SamurAIGPT/llm-wiki-agent](https://github.com/SamurAIGPT/llm-wiki-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:05:03.378Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SamurAIGPT/llm-wiki-agent`
- **Description**: A personal knowledge base that builds and maintains itself. Drop in sources — Claude (or Codex/Gemini) reads them, extracts knowledge, and maintains a persistent interlinked wiki. Works with Claude Code, Codex, OpenCode, Gemini CLI. No API key needed.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3591 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tools/_utils.py`
```
"""
Shared utilities for LLM Wiki tools.

Centralizes functions that were previously copy-pasted across tool files:
read_file, write_file, call_llm, sha256, extract_wikilinks, all_wiki_pages, append_log.
"""

from __future__ import annotations

import hashlib
import os
import re
import sys
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
RAW_DIR = REPO_ROOT / "raw"
INDEX_FILE = WIKI_DIR / "index.md"
LOG_FILE = WIKI_DIR / "log.md"
OVERVIEW_FILE = WIKI_DIR / "overview.md"
GRAPH_DIR = REPO_ROOT / "graph"
SCHEMA_FILE = REPO_ROOT / "CLAUDE.md"

# Default metadata files to exclude from wiki page listings.
_META_EXCLUDE = {"index.md", "log.md", "lint-report.md"}


# ── File I/O ───────────────────────────────────────────────────────────

def read_file(path: Path) -> str:
    """Read file contents as UTF-8. Returns empty string if file doesn't exist."""
    return path.read_text(encoding="utf-8") if path.exists() else ""


def write_file(path: Path, content: str):
    """Write UTF-8 content to file, creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  wrote: {path.relative_to(REPO_ROOT)}")


# ── LLM ────────────────────────────────────────────────────────────────

def call_llm(
    prompt: str,
    model_env: str = "LLM_MODEL",
    default_model: str = "claude-3-5-sonnet-latest",
    max_tokens: int = 4096,
) -> str:
    """Call an LLM via litellm.

    Args:
        prompt: The user prompt.
        model_env: Environment variable name for model selection.
        default_model: Fallback model if env var is unset.
        max_tokens: Maximum response tokens.  0 or None to omit the limit.
    """
    try:
        from litellm import completion
    except ImportError:
        print("Error: litellm not installed. Run: pip install litellm")
        sys.exit(1)

    model = os.getenv(model_env, default_model)

    kwargs: dict = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }
    if max_tokens:
        kwargs["max_tokens"] = max_tokens

    response = completion(**kwargs)
    return response.choices[0].message.content


# ── Hashing ────────────────────────────────────────────────────────────

def sha256(text: str, truncate: int = 0) -> str:
    """SHA-256 hex digest of *text*, optionally truncated to *truncate* chars.

    Default is the full 64-char hash.  Pass truncate=16 for the short form
    used by ingest.py and refresh.py.
    """
    h = hashlib.sha256(text.encode()).hexdigest()
    return h[:truncate] if truncate else h


# ── Wiki helpers ───────────────────────────────────────────────────────

def extract_wikilinks(content: str, unique: bool = False) -> list[str]:
    """Extract all [[WikiLink]] targets from page content.

    Args:
        unique: Deduplicate results (used by build_graph.py).
    """
    links = re.findall(r"\[\[([^\]]+)\]\]", content)
    return list(set(links)) if unique else links


def all_wiki_pages(extra_exclude: set[str] | None = None) -> list[Path]:
    """Return all .md files in wiki/, excluding metadata files.

    Args:
        extra_exclude: Additional filenames to skip (e.g. {"health-report.md"}).
    """
    exclude = _META_EXCLUDE | (extra_exclude or set())
    return [p for p in WIKI_DIR.rglob("*.md") if p.name not in exclude]


def append_log(entry: str):
    """Prepend a log entry to wiki/log.md (newest-first).

    Creates the file with a standard header if it doesn't exist.
    Preserves the prepend semantics used by ingest.py, query.py, and lint.py.
    """
    entry_text = entry.strip()

    if not LOG_FILE.exists():
        LOG_FILE.write_text(
            "# Wiki Log\n\n"
            "> Records important additions, revisions, and clarifications in the "
            "project knowledge layer. Maintained in append-only mode for agent and "
            "human traceability.\n\n"
            f"{entry_text}\n",
            encoding="utf-8",
        )
        return

    existing = read_file(LOG_FILE).rstrip()
    if not existing:
        existing = (
            "# Wiki Log\n\n"
            "> Records important additions, revisions, and clarifications in the "
            "project knowledge layer. Maintained in append-only mode for agent and "
            "human traceability."
        )
    LOG_FILE.write_text(existing + "\n\n" + entry_text + "\n", encoding="utf-8")

```

### Core Architecture Module: `tools/file_to_md.py`
```
import argparse
from tqdm import tqdm
from pathlib import Path
from markitdown import MarkItDown


def convert_directory_to_md(input_dir: Path, delete_source: bool = False, overwrite: bool = False):
    """
    Converts all non-Markdown files in a directory tree to Markdown.

    Safety: an output path is never silently overwritten. If a sibling ``.md``
    with the same stem already exists the file is skipped (unless ``overwrite``
    is set), the source is never deleted on a skip, and the run reports the
    skip explicitly so data loss cannot pass unnoticed.

    :param input_dir: Path
        The Path object pointing to the directory to process.
    :param delete_source: bool = False
        Whether to delete the original source files after a successful
        conversion. Defaults to False.
    :param overwrite: bool = False
        Whether to overwrite an already-existing ``<stem>.md`` output.
        Defaults to False.
    """

    md = MarkItDown(enable_plugins=False)

    # get list of files to convert
    files_to_process = [f for f in input_dir.rglob('*') if f.is_file()]

    if not files_to_process:
        print(f"No files found in {input_dir}!")
        return

    skipped_collision = 0
    converted = 0

    for file_path in tqdm(files_to_process, desc="Converting Files"):
        # skip hidden files and existing markdown files (as conversion sources)
        if file_path.name.startswith('.') or file_path.suffix.lower() == '.md':
            print(f"Skipping conversion of {file_path.name}")
            continue

        # derive the output path from the source stem
        output_path = file_path.with_suffix(".md")

        # guard the output side: never silently overwrite a sibling .md.
        # The source is NOT deleted on a collision, so both the pre-existing
        # markdown and the original file survive.
        if output_path.exists() and not overwrite:
            tqdm.write(
                f"SKIPPED: '{output_path.name}' already exists; "
                f"not overwriting '{file_path.name}'."
            )
            skipped_collision += 1
            continue

        try:
            # convert
            result = md.convert(str(file_path))
            # save to .md
            output_path.write_text(result.text_content, encoding="utf-8")
            # optional remove original file (only after a successful write)
            if delete_source:
                file_path.unlink()
            tqdm.write(f"Converted: {file_path.name}")
            converted += 1
        except Exception as e:
            tqdm.write(f"FAILED: Could not convert '{file_path.name}'. Reason: {e}")

    # summary so skipped collisions are visible at the end of the run
    print("-" * 40)
    print(f"Converted: {converted}")
    print(f"Skipped (output exists): {skipped_collision}")
    print("-" * 40)


def main(args):
    # set Paths
    input_path = Path(args.input_dir).resolve()
    print("-" * 40)
    print(f"Input Directory: {input_path}")
    print(f"Overwrite existing .md: {args.overwrite}")
    print("-" * 40)

    # execute
    try:
        convert_directory_to_md(input_path, args.delete_source, args.overwrite)
        print("\nConversion process complete.")
    except FileNotFoundError:
        print(f"\nError: Input directory not found at {input_path}")
    except Exception as e:
        print(f"\nAn unexpected error occurred during execution: {e}")


if __name__ == "__main__":
    """Command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Convert all non-Markdown files in a directory to Markdown."
    )
    parser.add_argument(
        "--input_dir",
        type=str,
        help="The path to the directory containing files to convert."
    )
    parser.add_argument(
        "--delete_source",
        action="store_true",
        help="Whether to delete the original source files after conversion."
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite an already-existing <stem>.md output. "
             "Without this flag, collisions are skipped and logged."
    )
    args = parser.parse_args()

    main(args)

```

### Core Architecture Module: `tools/heal.py`
```
#!/usr/bin/env python3
"""
Graph Self-Healing Tool

Automatically retrieves "Missing Entity Pages" from the wiki and generates
comprehensive definition pages for them using the LLM.
It resolves broken entity links by scanning existing contexts where the entity is referenced.

Usage:
    python tools/heal.py
"""

import re
import sys
from pathlib import Path

# Bootstrap shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools._utils import REPO_ROOT, WIKI_DIR, call_llm, all_wiki_pages
from tools.lint import find_missing_entities

ENTITIES_DIR = WIKI_DIR / "entities"



def sanitize_filename(name: str) -> str:
    """Strip characters that are unsafe in filenames.

    Removes path separators, null bytes, and leading dots to prevent
    directory traversal when using LLM-derived entity names as filenames.
    """
    original = name
    name = re.sub(r"[/\\:\0]", "", name)
    name = name.lstrip(".")
    name = "_".join(name.split())
    if not name:
        raise ValueError(f"Entity name became empty after sanitization: {original!r}")
    return name


def search_sources(entity: str, pages: list[Path]) -> list[Path]:
    """Find up to 15 pages where this entity is mentioned natively."""
    sources = []
    for p in pages:
        if "entities" not in str(p.parent) and "concepts" not in str(p.parent):
            content = p.read_text(encoding="utf-8")
            if entity.lower() in content.lower():
                sources.append(p)
    return sources[:15]

def heal_missing_entities():
    pages = all_wiki_pages()
    missing_entities = find_missing_entities(pages)
    
    if not missing_entities:
        print("Graph is fully connected. No missing entities found!")
        return

    ENTITIES_DIR.mkdir(exist_ok=True, parents=True)
    print(f"Found {len(missing_entities)} missing entity nodes. Commencing auto-heal...")
    
    for entity in missing_entities:
        print(f"Healing entity page for: {entity}")
        sources = search_sources(entity, pages)
        
        context = ""
        for s in sources:
            context += f"\n\n### {s.name}\n{s.read_text(encoding='utf-8')[:800]}"
        
        prompt = f"""You are filling a data gap in the Personal LLM Wiki. 
Create an Entity definition page for "{entity}".

Here is how the entity appears in the current sources:
{context}

Format:
---
title: "{entity}"
type: entity
tags: []
sources: {[s.name for s in sources]}
---

# {entity}

Write a comprehensive paragraph defining what `{entity}` means in the context of this wiki, its main significance, and any actions or associations related to it.
"""
        try:
            result = call_llm(prompt, default_model="claude-3-5-haiku-latest", max_tokens=1500)
            safe_name = sanitize_filename(entity)
            out_path = ENTITIES_DIR / f"{safe_name}.md"
            # Safety: ensure resolved path stays within entities directory
            if not str(out_path.resolve()).startswith(str(ENTITIES_DIR.resolve())):
                print(f" [!] Skipping unsafe path for entity: {entity}")
                continue
            out_path.write_text(result, encoding="utf-8")
            print(f" -> Saved to {out_path.relative_to(REPO_ROOT)}")
        except Exception as e:
            print(f" [!] Failed to generate {entity}: {e}")

if __name__ == "__main__":
    heal_missing_entities()

```

### Core Architecture Module: `tools/health.py`
```
#!/usr/bin/env python3
from __future__ import annotations

"""
Structural health checks for the LLM Wiki.

Unlike lint.py (which includes expensive LLM-powered semantic analysis),
health.py is purely deterministic — zero API calls, fast enough to run
every session.

Usage:
    python tools/health.py              # print report to stdout
    python tools/health.py --save       # also save to wiki/health-report.md
    python tools/health.py --json       # machine-readable output

Checks:
  - Empty / stub files (pages with no real content beyond frontmatter)
  - Index sync (wiki/index.md entries vs actual files on disk)
  - Log coverage (source pages without a corresponding log entry)

Design boundary (see AGENTS.md):
  health.py = structural integrity, deterministic, run every session
  lint.py   = content quality, semantic (LLM), run every 10-15 ingests
"""

import re
import sys
import json
import argparse
from pathlib import Path
from datetime import date

# Bootstrap shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools._utils import REPO_ROOT, WIKI_DIR, INDEX_FILE, LOG_FILE, read_file, all_wiki_pages

# Minimum content length (excluding frontmatter) to not be considered a stub
STUB_THRESHOLD_CHARS = 100


def strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter (--- ... ---) from content."""
    # Strip UTF-8 BOM and leading whitespace before checking for frontmatter
    cleaned = content.lstrip("\ufeff").lstrip()
    if cleaned.startswith("---"):
        end = cleaned.find("---", 3)
        if end != -1:
            return cleaned[end + 3:].strip()
    return cleaned.strip()


# ── Check: Empty / Stub files ───────────────────────────────────────

def check_empty_files(pages: list[Path], threshold: int = STUB_THRESHOLD_CHARS) -> list[dict]:
    """Find wiki pages that are empty or contain only frontmatter / minimal content."""
    results = []
    for p in pages:
        raw = read_file(p)
        body = strip_frontmatter(raw)
        if len(body) < threshold:
            results.append({
                "path": str(p.relative_to(REPO_ROOT)),
                "total_bytes": len(raw),
                "body_bytes": len(body),
                "status": "empty" if len(body) == 0 else "stub",
            })
    results.sort(key=lambda x: x["body_bytes"])
    return results


# ── Check: Index sync ───────────────────────────────────────────────

def _parse_index_links(index_content: str) -> set[str]:
    """Extract markdown link targets from index.md.

    Matches patterns like: [Title](sources/slug.md)
    Returns set of relative paths (e.g. 'sources/slug.md').
    """
    return set(re.findall(r'\[.*?\]\(([^)]+\.md)\)', index_content))


def check_index_sync(pages: list[Path]) -> dict:
    """Compare wiki/index.md entries against actual files on disk.

    Returns:
        {
            "in_index_not_on_disk": [...],   # stale index entries
            "on_disk_not_in_index": [...],   # missing from index
        }
    """
    index_content = read_file(INDEX_FILE)
    index_links = _parse_index_links(index_content)

    # Normalize index links to absolute paths for comparison
    # overview.md is listed under ## Overview, not in the per-type sections.
    # Exclude it from both sides to avoid false positives.
    meta_pages = {"overview.md"}

    index_paths = set()
    for link in index_links:
        resolved = (WIKI_DIR / link).resolve()
        if Path(link).name not in meta_pages:
            index_paths.add(resolved)

    disk_paths = set()
    for p in pages:
        if p.name not in meta_pages:
            disk_paths.add(p.resolve())

    in_index_not_on_disk = [
        str(p.relative_to(REPO_ROOT)) for p in sorted(index_paths - disk_paths)
        if REPO_ROOT in p.parents or p == REPO_ROOT
    ]
    on_disk_not_in_index = [
        str(p.relative_to(REPO_ROOT)) for p in sorted(disk_paths - index_paths)
    ]

    return {
        "in_index_not_on_disk": in_index_not_on_disk,
        "on_disk_not_in_index": on_disk_not_in_index,
    }


# ── Check: Log coverage ────────────────────────────────────────────

def _parse_log_entries(log_content: str) -> set[str]:
    """Extract page titles/slugs from log.md entries.

    Log format: ## [YYYY-MM-DD] ingest | Title Here
    Returns set of lowercase title strings.
    """
    return set(
        m.group(1).strip().lower()
        for m in re.finditer(r'^## \[\d{4}-\d{2}-\d{2}\] ingest \| (.+)$', log_content, re.MULTILINE)
    )


def _parse_frontmatter_title(content: str) -> str:
    """Extract and lightly unescape a frontmatter title scalar.

    Handles YAML-escaped quotes (e.g. title: "few \"people\" laptop")
    so that log coverage matching doesn't false-positive on escaped strings.
    """
    match = re.search(r'^title:\s*(.+?)\s*$', content, re.MULTILINE)
    if not match:
        return ""
    raw = match.group(1).strip()
    # Strip surrounding quotes and unescape inner ones
    if len(raw) >= 2 and raw[0] == raw[-1] == '"':
        raw = raw[1:-1]
        raw = raw.replace(r'\"', '"').replace(r"\'", "'").replace(r"\\", "\\")
    elif len(raw) >= 2 and raw[0] == raw[-1] == "'":
        raw = raw[1:-1].replace("''", "'")
    return raw.strip().lower()


def check_log_coverage(pages: list[Path]) -> list[dict]:
    """Find source pages that have no corresponding ingest entry in log.md.

    Only checks wiki/sources/*.md — entity/concept pages are created as
    side-effects of ingest and don't need their own log entry.
    """
    log_content = read_file(LOG_FILE)
    logged_titles = _parse_log_entries(log_content)

    source_dir = WIKI_DIR / "sources"
    if not source_dir.exists():
        return []

    missing = []
    for p in sorted(source_dir.glob("*.md")):
        # Try matching by slug (filename without .md) or by frontmatter title
        slug = p.stem.lower().replace("-", " ").replace("_", " ")

        content = read_file(p)
        fm_title = _parse_frontmatter_title(content)

        if slug not in logged_titles and fm_title not in logged_titles:
            missing.append({
                "path": str(p.relative_to(REPO_ROOT)),
                "slug": p.stem,
                "title": fm_title or p.stem,
            })

    return missing


# ── Report Generation ───────────────────────────────────────────────

def run_health() -> dict:
    """Run all health checks, return structured results."""
    pages = all_wiki_pages(extra_exclude={"health-report.md"})

    return {
        "date": date.today().isoformat(),
        "total_pages": len(pages),
        "empty_files": check_empty_files(pages),
        "index_sync": check_index_sync(pages),
        "log_coverage": check_log_coverage(pages),
    }


def format_report(results: dict) -> str:
    """Format health check results as markdown."""
    lines = [
        f"# Wiki Health Report — {results['date']}",
        "",
        f"Scanned {results['total_pages']} wiki pages. "
        "Checks are purely structural (no LLM calls).",
        "",
    ]

    # ── Empty / Stub Files
    empty = results["empty_files"]
    lines.append(f"## Empty / Stub Files ({len(empty)} found)")
    lines.append("")
    if empty:
        lines.append("| Page | Total Bytes | Body Bytes | Status |")
        lines.append("|---|---|---|---|")
        for ef in empty:
            emoji = "🔴" if ef["status"] == "empty" else "🟡"
            lines.append(f"| `{ef['path']}` | {ef['total_bytes']} | {ef['body_bytes']} | {emoji} {ef['status']} |")
    else:
        lines.append("All pages have content beyond frontmatter. ✅")
    lines.append("")

    # ── Index Sync
    isync = results["index_sync"]
    stale = isync["in_index_not_on_disk"]
    missing = isync["on_disk_not_in_index"]
    total_issues = len(stale) + len(missing)
    lines.append(f"## Index Sync ({total_issues} issues)")
    lines.append("")

    if stale:
        lines.append("### Stale Index Entries (in index.md but no file on disk)")
        for s
```

### Core Architecture Module: `tools/ingest.py`
```
#!/usr/bin/env python3
"""
Ingest a source document into the LLM Wiki.

Usage:
    python tools/ingest.py <path-to-source>
    python tools/ingest.py raw/articles/my-article.md
    python tools/ingest.py report.pdf                  # auto-converts to .md
    python tools/ingest.py slides.pptx notes.docx       # batch, mixed formats
    python tools/ingest.py raw/mixed/ --no-convert      # skip auto-conversion
    python tools/ingest.py --validate-only              # run validation only

Supported formats (auto-converted via markitdown):
    .pdf .docx .pptx .xlsx .html .htm .txt .csv .json .xml
    .rst .rtf .epub .ipynb .yaml .yml .tsv .wav .mp3

The LLM reads the source, extracts knowledge, and updates the wiki:
  - Creates wiki/sources/<slug>.md
  - Updates wiki/index.md
  - Updates wiki/overview.md (if warranted)
  - Creates/updates entity and concept pages
  - Appends to wiki/log.md
  - Flags contradictions
  - Runs post-ingest validation (broken links, index coverage)
"""

import sys
import json
import re
import shutil
import tempfile
from pathlib import Path
from collections import defaultdict
from datetime import date

# Bootstrap shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools._utils import (
    REPO_ROOT, WIKI_DIR, INDEX_FILE, OVERVIEW_FILE, LOG_FILE, SCHEMA_FILE,
    read_file, write_file, call_llm, sha256, extract_wikilinks, all_wiki_pages, append_log,
)

# File extensions that can be auto-converted to markdown via markitdown.
# .md files are ingested directly without conversion.
CONVERTIBLE_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".xls",
    ".html", ".htm", ".txt", ".csv", ".json", ".xml",
    ".rst", ".rtf", ".epub", ".ipynb",
    ".yaml", ".yml", ".tsv",
    ".wav", ".mp3",  # audio transcription via markitdown
}
ALL_SUPPORTED_EXTENSIONS = {".md"} | CONVERTIBLE_EXTENSIONS


def clip(text: str, limit: int = 260) -> str:
    """Truncate text at word boundary instead of mid-word."""
    if len(text) <= limit:
        return text
    clipped = text[: limit - 3].rsplit(" ", 1)[0].rstrip()
    return clipped + "..."


def build_wiki_context() -> str:
    parts = []
    if INDEX_FILE.exists():
        parts.append(f"## wiki/index.md\n{read_file(INDEX_FILE)}")
    if OVERVIEW_FILE.exists():
        parts.append(f"## wiki/overview.md\n{read_file(OVERVIEW_FILE)}")
    # Include a few recent source pages for contradiction checking
    sources_dir = WIKI_DIR / "sources"
    if sources_dir.exists():
        recent = sorted(sources_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)[:5]
        for p in recent:
            parts.append(f"## {p.relative_to(REPO_ROOT)}\n{p.read_text()}")
    return "\n\n---\n\n".join(parts)


def parse_json_from_response(text: str) -> dict:
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    # Find the outermost JSON object
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in response")
    return json.loads(match.group())


def update_index(new_entry: str, section: str = "Sources"):
    content = read_file(INDEX_FILE)
    if not content:
        content = "# Wiki Index\n\n## Overview\n- [Overview](overview.md) — living synthesis\n\n## Sources\n\n## Entities\n\n## Concepts\n\n## Syntheses\n"
    section_header = f"## {section}"
    if section_header in content:
        content = content.replace(section_header + "\n", section_header + "\n" + new_entry + "\n")
    else:
        content += f"\n{section_header}\n{new_entry}\n"
    write_file(INDEX_FILE, content)


def validate_ingest(changed_pages: list[str] | None = None) -> dict:
    """Validate wiki integrity after an ingest.

    Checks:
      1. Broken wikilinks in changed pages (or all pages if none specified)
      2. Pages not registered in index.md

    Returns dict with 'broken_links' and 'unindexed' lists.
    """
    existing_pages = {p.stem.lower() for p in all_wiki_pages()}
    index_content = read_file(INDEX_FILE).lower()

    # Determine which pages to scan for broken links
    if changed_pages:
        scan_paths = [WIKI_DIR / p for p in changed_pages if (WIKI_DIR / p).exists()]
    else:
        scan_paths = [p for p in WIKI_DIR.rglob("*.md")
                      if p.name not in ("index.md", "log.md", "lint-report.md")]

    # Check 1: Broken wikilinks
    broken_links = []
    for page_path in scan_paths:
        content = read_file(page_path)
        rel = str(page_path.relative_to(WIKI_DIR))
        for link in extract_wikilinks(content):
            # Normalize: strip paths, check stem only
            link_stem = Path(link).stem.lower() if '/' in link else link.lower()
            if link_stem not in existing_pages:
                broken_links.append((rel, link))

    # Check 2: Unindexed pages (only check changed pages)
    unindexed = []
    for p in (changed_pages or []):
        page_path = WIKI_DIR / p
        if page_path.exists():
            # Check if the page filename appears in index.md
            stem = page_path.stem.lower()
            if stem not in index_content and p not in ("log.md", "overview.md"):
                unindexed.append(p)

    return {"broken_links": broken_links, "unindexed": unindexed}


def convert_to_md(source: Path) -> Path:
    """Convert a non-markdown file to .md using markitdown.

    Returns the path to the converted .md file (placed next to the original
    with a .md extension, or in a temp location if the source dir is read-only).
    """
    try:
        from markitdown import MarkItDown
    except ImportError:
        print("Error: markitdown not installed (needed to convert non-.md files).")
        print("  Install with: pip install markitdown")
        sys.exit(1)

    md = MarkItDown(enable_plugins=False)
    try:
        result = md.convert(str(source))
    except Exception as e:
        print(f"Error: failed to convert '{source.name}': {e}")
        sys.exit(1)

    # Write converted output next to source as <name>.md
    output = source.with_suffix(".md")
    try:
        output.write_text(result.text_content, encoding="utf-8")
    except OSError:
        # Fallback: source directory may be read-only
        tmp = Path(tempfile.mkdtemp()) / f"{source.stem}.md"
        tmp.write_text(result.text_content, encoding="utf-8")
        output = tmp

    print(f"  ✓ Converted {source.name} → {output.name}")
    return output


def ingest(source_path: str, auto_convert: bool = True):
    source = Path(source_path)
    if not source.exists():
        print(f"Error: file not found: {source_path}")
        sys.exit(1)

    # Auto-convert non-markdown files
    converted_path = None
    if source.suffix.lower() != ".md":
        if not auto_convert:
            print(f"  Skipping non-.md file (--no-convert): {source.name}")
            return
        if source.suffix.lower() not in CONVERTIBLE_EXTENSIONS:
            print(f"  ⚠️  Unsupported format: {source.suffix} — skipping {source.name}")
            print(f"       Supported: {', '.join(sorted(ALL_SUPPORTED_EXTENSIONS))}")
            return
        print(f"  Converting {source.name} to markdown...")
        converted_path = convert_to_md(source)
        source = converted_path

    source_content = source.read_text(encoding="utf-8")
    source_hash = sha256(source_content, truncate=16)
    today = date.today().isoformat()

    print(f"\nIngesting: {source.name}  (hash: {source_hash})")

    wiki_context = build_wiki_context()
    schema = read_file(SCHEMA_FILE)

    prompt = f"""You are maintaining an LLM Wiki. Process this source document and integrate its knowledge into the wiki.

Schema and conventions:
{schema}

Current wiki state (index + recent pages):
{wiki_context if wiki_context else "(wiki is empty — this is the first source)"}

New source to ingest (file: {source.relative_to(REPO_ROOT) if source.is_relative_to(REPO_ROOT
```

### Core Architecture Module: `tools/lint.py`
```
#!/usr/bin/env python3
from __future__ import annotations

"""
Lint the LLM Wiki for health issues.

Usage:
    python tools/lint.py
    python tools/lint.py --save          # save lint report to wiki/lint-report.md

Checks:
  - Orphan pages (no inbound wikilinks from other pages)
  - Broken wikilinks (pointing to pages that don't exist)
  - Missing entity pages (entities mentioned in 3+ pages but no page)
  - Contradictions between pages
  - Data gaps and suggested new sources
"""

import re
import sys
import json
import argparse
import statistics
from pathlib import Path
from collections import defaultdict
from datetime import date

# Bootstrap shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools._utils import (
    REPO_ROOT, WIKI_DIR, GRAPH_DIR, LOG_FILE, SCHEMA_FILE,
    read_file, call_llm, all_wiki_pages, extract_wikilinks, append_log,
)

GRAPH_JSON = GRAPH_DIR / "graph.json"


def page_name_to_path(name: str) -> list[Path]:
    """Try to resolve a [[WikiLink]] to a file path."""
    candidates = []
    for p in all_wiki_pages():
        if p.stem.lower() == name.lower() or p.stem == name:
            candidates.append(p)
    return candidates


def find_orphans(pages: list[Path]) -> list[Path]:
    inbound = defaultdict(int)
    for p in pages:
        content = read_file(p)
        for link in extract_wikilinks(content):
            resolved = page_name_to_path(link)
            for r in resolved:
                inbound[r] += 1
    return [p for p in pages if inbound[p] == 0 and p != WIKI_DIR / "overview.md"]


def find_broken_links(pages: list[Path]) -> list[tuple[Path, str]]:
    broken = []
    for p in pages:
        content = read_file(p)
        for link in extract_wikilinks(content):
            if not page_name_to_path(link):
                broken.append((p, link))
    return broken


def find_missing_entities(pages: list[Path]) -> list[str]:
    """Find entity-like names mentioned in 3+ pages but lacking their own page."""
    mention_counts: dict[str, int] = defaultdict(int)
    existing_pages = {p.stem.lower() for p in pages}
    for p in pages:
        content = read_file(p)
        links = extract_wikilinks(content)
        for link in links:
            if link.lower() not in existing_pages:
                mention_counts[link] += 1
    return [name for name, count in mention_counts.items() if count >= 3]


def check_link_density(pages: list[Path], min_outbound: int = 2) -> list[dict]:
    """Find pages with fewer than min_outbound outgoing wikilinks.

    Pages without enough outgoing connections contribute to wiki fragmentation.
    Excludes overview.md (which is a synthesis page with different linking patterns).
    """
    results = []
    for p in pages:
        if p.name == "overview.md":
            continue
        content = read_file(p)
        links = extract_wikilinks(content)
        # Deduplicate links per page
        unique_links = set(link.lower() for link in links)
        if len(unique_links) < min_outbound:
            results.append({
                "path": str(p.relative_to(REPO_ROOT)),
                "outbound_links": len(unique_links),
                "links": sorted(unique_links),
            })
    results.sort(key=lambda x: x["outbound_links"])
    return results


# ── Graph-aware checks ──────────────────────────────────────────────

def load_graph_data() -> dict | None:
    """Load graph.json if it exists. Returns None if missing (graceful degradation)."""
    if not GRAPH_JSON.exists():
        return None
    try:
        return json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, IOError):
        print("  [warn] graph.json is corrupted — skipping graph-aware checks")
        return None


def _build_degree_map(graph_data: dict) -> dict[str, int]:
    """Build node_id -> degree mapping from graph edges."""
    degrees: dict[str, int] = {}
    for node in graph_data.get("nodes", []):
        degrees[node["id"]] = 0
    for edge in graph_data.get("edges", []):
        degrees[edge["from"]] = degrees.get(edge["from"], 0) + 1
        degrees[edge["to"]] = degrees.get(edge["to"], 0) + 1
    return degrees


def _build_community_map(graph_data: dict) -> dict[str, int]:
    """Build node_id -> community_id mapping from graph nodes."""
    return {
        node["id"]: node.get("group", -1)
        for node in graph_data.get("nodes", [])
    }


def check_hub_stubs(graph_data: dict, pages: list[Path], min_content_chars: int = 500) -> list[dict]:
    """Find god nodes (degree > μ+2σ) with suspiciously short content."""
    degrees = _build_degree_map(graph_data)
    deg_values = list(degrees.values())
    if len(deg_values) < 2:
        return []

    mean_deg = statistics.mean(deg_values)
    std_deg = statistics.stdev(deg_values)
    threshold = mean_deg + 2 * std_deg

    # Map node_id -> page path
    node_to_path: dict[str, Path] = {}
    for p in pages:
        nid = p.relative_to(WIKI_DIR).as_posix().replace(".md", "")
        node_to_path[nid] = p

    results = []
    for node_id, deg in degrees.items():
        if deg <= threshold:
            continue
        path = node_to_path.get(node_id)
        if not path:
            continue
        content_len = len(read_file(path))
        if content_len < min_content_chars:
            results.append({
                "node_id": node_id,
                "degree": deg,
                "content_len": content_len,
                "path": str(path.relative_to(REPO_ROOT)),
            })
    return sorted(results, key=lambda x: x["degree"], reverse=True)


def check_fragile_bridges(graph_data: dict) -> list[dict]:
    """Find community pairs connected by only 1 edge."""
    comm_map = _build_community_map(graph_data)
    cross_comm: dict[tuple[int, int], list[dict]] = {}

    for edge in graph_data.get("edges", []):
        ca = comm_map.get(edge["from"], -1)
        cb = comm_map.get(edge["to"], -1)
        if ca < 0 or cb < 0 or ca == cb:
            continue
        key = (min(ca, cb), max(ca, cb))
        cross_comm.setdefault(key, []).append(edge)

    return [
        {
            "comm_a": pair[0],
            "comm_b": pair[1],
            "bridge_from": edges[0]["from"],
            "bridge_to": edges[0]["to"],
        }
        for pair, edges in sorted(cross_comm.items())
        if len(edges) == 1
    ]


def check_isolated_communities(graph_data: dict) -> list[dict]:
    """Find communities with zero external edges (knowledge silos)."""
    comm_map = _build_community_map(graph_data)

    # Build community -> members
    comm_members: dict[int, list[str]] = {}
    for node_id, comm_id in comm_map.items():
        if comm_id < 0:
            continue
        comm_members.setdefault(comm_id, []).append(node_id)

    # Track which communities have external edges
    has_external = set()
    for edge in graph_data.get("edges", []):
        ca = comm_map.get(edge["from"], -1)
        cb = comm_map.get(edge["to"], -1)
        if ca >= 0 and cb >= 0 and ca != cb:
            has_external.add(ca)
            has_external.add(cb)

    results = []
    for comm_id, members in sorted(comm_members.items()):
        if len(members) < 2:  # skip single-node "communities"
            continue
        if comm_id not in has_external:
            results.append({
                "community_id": comm_id,
                "node_count": len(members),
                "members": members[:10],  # cap display
            })
    return results


def run_lint():
    pages = all_wiki_pages()
    today = date.today().isoformat()

    if not pages:
        print("Wiki is empty. Nothing to lint.")
        return ""

    print(f"Linting {len(pages)} wiki pages...")

    # Deterministic checks
    orphans = find_orphans(pages)
    broken = find_broken_links(pages)
    missing_entities = find_missing_entities(pages)

    print(f"  orphans: {len(orphans)}")
    print(f"  broken links: {len(broken)}")
    print(f
```

### Core Architecture Module: `tools/pdf2md.py`
```
#!/usr/bin/env python3
"""
Convert PDF or arXiv sources to Markdown for the raw/ directory.

Usage:
    python tools/pdf2md.py <input> [--output raw/papers/output.md] [--backend auto]

Inputs:
    arXiv ID      →  2401.12345
    arXiv URL     →  https://arxiv.org/abs/2401.12345
    Local PDF     →  /path/to/paper.pdf

Backends:
    auto          →  arXiv inputs use arxiv2md; PDFs use marker (fallback: pymupdf4llm)
    arxiv2md      →  Best for arXiv papers (uses structured source, not PDF)
    marker        →  Best for complex multi-column academic PDFs
    pymupdf4llm   →  Fast, lightweight, no GPU — good for native-text PDFs

Examples:
    python tools/pdf2md.py 2401.12345
    python tools/pdf2md.py https://arxiv.org/abs/2401.12345
    python tools/pdf2md.py paper.pdf --backend marker
    python tools/pdf2md.py paper.pdf -o raw/papers/my-paper.md
"""

import argparse
import importlib
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "raw" / "papers"

ARXIV_PATTERNS = [
    re.compile(r"^(\d{4}\.\d{4,5})(v\d+)?$"),                          # 2401.12345
    re.compile(r"arxiv\.org/abs/(\d{4}\.\d{4,5})(v\d+)?"),              # URL form
    re.compile(r"arxiv\.org/pdf/(\d{4}\.\d{4,5})(v\d+)?"),              # PDF URL
]


def extract_arxiv_id(source: str) -> str | None:
    """Return arXiv ID if input looks like an arXiv reference, else None."""
    for pattern in ARXIV_PATTERNS:
        m = pattern.search(source)
        if m:
            return m.group(1)
    return None


def check_dependency(package: str, pip_name: str | None = None) -> bool:
    """Check if a Python package is importable."""
    try:
        importlib.import_module(package)
        return True
    except ImportError:
        return False


def install_hint(pip_name: str) -> str:
    return f"  Install with: pip install {pip_name}"


# ─── Backend: arxiv2md ──────────────────────────────────────────────

def convert_arxiv(arxiv_id: str, output: Path) -> Path:
    """Convert arXiv paper using arxiv2md (structured source, not PDF)."""
    pip_name = "arxiv2markdown"
    if not check_dependency("arxiv2md", pip_name):
        print(f"Error: arxiv2md not installed.\n{install_hint(pip_name)}")
        sys.exit(1)

    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["arxiv2md", arxiv_id, "-o", str(output)]
    print(f"  Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Error: arxiv2md failed:\n{result.stderr}")
        sys.exit(1)

    print(f"  ✓ Converted arXiv {arxiv_id} → {output.relative_to(REPO_ROOT)}")
    return output


# ─── Backend: marker ────────────────────────────────────────────────

def convert_marker(pdf_path: Path, output: Path) -> Path:
    """Convert PDF using marker (high-fidelity, handles complex layouts)."""
    pip_name = "marker-pdf"
    if not check_dependency("marker", pip_name):
        print(f"Error: marker not installed.\n{install_hint(pip_name)}")
        sys.exit(1)

    output.parent.mkdir(parents=True, exist_ok=True)
    # marker outputs to a directory; we move the result to the target path
    tmp_dir = output.parent / f".marker_tmp_{output.stem}"
    cmd = ["marker_single", str(pdf_path), "--output_dir", str(tmp_dir)]
    print(f"  Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Error: marker failed:\n{result.stderr}")
        sys.exit(1)

    # marker creates <pdf_name>/<pdf_name>.md inside output_dir
    md_files = list(tmp_dir.rglob("*.md"))
    if not md_files:
        print("Error: marker produced no markdown output.")
        sys.exit(1)

    # Move first .md to target, clean up
    md_files[0].rename(output)
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)

    print(f"  ✓ Converted {pdf_path.name} → {output.relative_to(REPO_ROOT)}")
    return output


# ─── Backend: pymupdf4llm ───────────────────────────────────────────

def convert_pymupdf(pdf_path: Path, output: Path) -> Path:
    """Convert PDF using pymupdf4llm (fast, lightweight, native-text PDFs)."""
    pip_name = "pymupdf4llm"
    if not check_dependency("pymupdf4llm", pip_name):
        print(f"Error: pymupdf4llm not installed.\n{install_hint(pip_name)}")
        sys.exit(1)

    import pymupdf4llm

    output.parent.mkdir(parents=True, exist_ok=True)
    md_text = pymupdf4llm.to_markdown(str(pdf_path))
    output.write_text(md_text, encoding="utf-8")

    print(f"  ✓ Converted {pdf_path.name} → {output.relative_to(REPO_ROOT)}")
    return output


# ─── Auto-detect & dispatch ─────────────────────────────────────────

BACKENDS = {
    "arxiv2md": convert_arxiv,
    "marker": convert_marker,
    "pymupdf4llm": convert_pymupdf,
}


def slugify(name: str) -> str:
    """Turn a filename or arXiv ID into a safe kebab-case slug."""
    name = Path(name).stem if "." in name else name
    name = re.sub(r"[^\w\s-]", "", name.lower())
    return re.sub(r"[\s_]+", "-", name).strip("-")


def resolve_output(source: str, arxiv_id: str | None, output_arg: str | None) -> Path:
    """Determine the output path."""
    if output_arg:
        p = Path(output_arg)
        return p if p.is_absolute() else REPO_ROOT / p

    if arxiv_id:
        slug = slugify(arxiv_id)
    else:
        slug = slugify(Path(source).stem)

    return DEFAULT_OUTPUT_DIR / f"{slug}.md"


def main():
    parser = argparse.ArgumentParser(
        description="Convert PDF/arXiv to Markdown for raw/",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("input", help="arXiv ID, arXiv URL, or path to a PDF file")
    parser.add_argument("-o", "--output", help="Output .md path (default: raw/papers/<slug>.md)")
    parser.add_argument(
        "-b", "--backend",
        choices=["auto", "arxiv2md", "marker", "pymupdf4llm"],
        default="auto",
        help="Conversion backend (default: auto-detect)",
    )
    args = parser.parse_args()

    arxiv_id = extract_arxiv_id(args.input)
    output = resolve_output(args.input, arxiv_id, args.output)
    backend = args.backend

    print(f"\npdf2md — LLM Wiki Agent")
    print(f"  Input:   {args.input}")
    print(f"  Output:  {output.relative_to(REPO_ROOT)}")

    # ── Auto-select backend ──
    if backend == "auto":
        if arxiv_id:
            backend = "arxiv2md"
        elif check_dependency("marker"):
            backend = "marker"
        elif check_dependency("pymupdf4llm"):
            backend = "pymupdf4llm"
        else:
            print("\nError: No conversion backend found.")
            print("Install one of:")
            print("  pip install arxiv2markdown   # for arXiv papers")
            print("  pip install marker-pdf       # for complex PDFs")
            print("  pip install pymupdf4llm      # for simple/fast PDF conversion")
            sys.exit(1)

    print(f"  Backend: {backend}")
    print()

    # ── Dispatch ──
    if backend == "arxiv2md":
        if not arxiv_id:
            print("Error: arxiv2md backend requires an arXiv ID or URL.")
            sys.exit(1)
        convert_arxiv(arxiv_id, output)
    else:
        pdf_path = Path(args.input)
        if not pdf_path.exists():
            print(f"Error: file not found: {args.input}")
            sys.exit(1)
        BACKENDS[backend](pdf_path, output)

    print(f"\nDone. Now ingest with:")
    print(f"  python tools/ingest.py {output.relative_to(REPO_ROOT)}")
    print(f"  — or in your agent: ingest {output.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #74** (2026-07-30): **fix(tools): guard file_to_md output against silent overwrite**
  *Symptoms*: ## Summary  Fixes the silent data-loss bug reported in #73.  `tools/file_to_md.py` derived its output path from the source stem (`file_path.with_suffix(".md")`) and wrote to it without an existence check. If a Markdown file with that stem already existed in the directory, it was truncated and replaced. With `--delete_source` the original source was then unlinked, so **both the pre-existing Markdown and the source were gone**, while the CLI printed `Converted: <name>` and exited 0 — no signal that anything was replaced.  The input-side guard already skipped `.md` files as conversion *sources* (preventing a file being converted onto itself), but nothing guarded the *output* side, so a `.md` could be destroyed as the target of a same-stem sibling.  ## Failure scenarios (from #73)  1. `raw/imports/{paper.pdf, paper.md}` (hand-written notes) + `--delete_source` → `paper.md` overwritten by the markitdown conversion of `paper.pdf`; `paper.pdf` deleted; log reads `Converted: paper.pdf`. 2. Two non-Markdown sources sharing a stem (`paper.pdf` + `paper.docx`) both target `paper.md`; whichever converts second wins and the other's output is lost, both reported as converted. 3. Pipeline-level: collides with `tools/pdf2md.py`, which writes `<stem>.md` next to a retained PDF — a later `file_to_md.py` run replaces that output with the markitdown conversion.  ## Changes  - **Output existence guard.** Before writing, check whether `output_path` already exists; if so (and `--overwrite` is not s

- **Issue #73** (2026-07-30): **file_to_md.py overwrites an existing sibling .md and deletes the source, then reports success**
  *Symptoms*: ## What is wrong  `tools/file_to_md.py` derives its output path from the source stem and writes it with no existence check. If a Markdown file with that stem already exists in the directory, it is truncated and replaced. With `--delete_source` the original source is then unlinked, so both the pre existing Markdown and the source are gone. The CLI prints `Converted: <name>` and exits 0, so the run looks clean.  ## Where  https://github.com/SamurAIGPT/llm-wiki-agent/blob/124932e958272f7c3c665930a49ec3fe6109bfbe/tools/file_to_md.py#L32-L40  ```python output_path = file_path.with_suffix(".md") try:     result = md.convert(str(file_path))     output_path.write_text(result.text_content, encoding="utf-8")     if delete_source:         file_path.unlink() ```  The loop already skips `.md` files as conversion *sources* (line 27), which prevents a Markdown file being converted onto itself. Nothing guards the *output* side, so a `.md` file can still be destroyed as the target of a same stem sibling.  ## How it manifests  ``` raw/imports/   paper.pdf   paper.md      <- hand written notes ```  ``` python tools/file_to_md.py --input_dir raw/imports/ --delete_source ```  `paper.md` is replaced by the markitdown conversion of `paper.pdf`, `paper.pdf` is deleted, and the output reads `Converted: paper.pdf`. The overwrite happens without `--delete_source` too; the flag only adds loss of the source.  The same collision fires between two non Markdown sources that share a stem. `paper.pdf` and `pa
  **Post-Mortem & Fix Analysis**:
  > @watsonctl Glad this was helpful! If the team is interested for Ito as a free tool (we give it to open source for free as a way to support the community) it'd run in about <30 minutes on every PR pre merge and can be addressed prior or after. No pressure :)

- **Issue #72** (2026-07-30): **Add Atlas Cloud LLM aliases**
  *Symptoms*: ## Summary - add Atlas Cloud model aliases for the shared LiteLLM helper used by the standalone wiki tools - support `atlascloud`, `atlas-cloud`, and `atlas` prefixes with `:` or `/` model selectors - resolve `ATLASCLOUD_API_KEY` / `ATLAS_CLOUD_API_KEY` and Atlas base URL aliases, defaulting to `https://api.atlascloud.ai/v1` and `qwen/qwen3.5-flash`  ## Validation - `python3 -m pytest tests/test_utils_atlas_cloud.py -q` - `python3 -m compileall tools tests` - `git diff --check` - live Atlas model catalog returned `qwen/qwen3.5-flash` and `deepseek-ai/deepseek-v4-pro`  No README, docs, logo, sponsor, credits, or partner content changes. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! I have reviewed the implementation and analyzed how it fits with the project architecture. Sharing my assessment below.  ## Implementation quality: ✅ Clean  The code is well-written, opt-in (does not affect default behavior), and comes with tests. No issues with the implementation itself.  ## Architectural alignment: ⚠️ Recommend against merging as-is  The project has a deliberate design principle: **vendor-neutral LLM access via litellm**. Before this PR, there are zero vendor-specific shims in the codebase — `tools/_utils.py` delegates all provider routing to litellm, and the README documents Claude as the primary model with `LLM_MODEL` as the single switch for alternative models.  This PR introduces a per-vendor alias layer for one specific commercial provider (Atlas Cloud). Here is why I would recommend a different approach:  ### 1. Zero net new capability — litellm already handles this  Atlas Cloud is an OpenAI-compatible endpoint. litellm supports it 
  > Thanks for the contribution. After reviewing, we have decided not to merge this — the project is intentionally vendor-agnostic and delegates all provider routing to litellm. Adding a vendor-specific alias layer for one provider duplicates functionality litellm already covers natively (via `OPENAI_API_BASE` + `OPENAI_API_KEY` + `LLM_MODEL=openai/<model>`), and would set a precedent for per-vendor shims that the architecture is designed to avoid.  Closing this PR to keep things clear. Appreciate the effort and the clean implementation!

- **Issue #71** (2026-09-08): **fix: handle BOM/whitespace in frontmatter parsing and missing Syntheses section in index**
  *Symptoms*: ## Description  Two small bug fixes in the health check and query tools:  ### 1. `strip_frontmatter` fails on files with UTF-8 BOM or leading whitespace  The `strip_frontmatter` function in `tools/health.py` used `content.startswith("---")` which fails when a file has a UTF-8 BOM (\ufeff) or leading whitespace before the YAML delimiter. This causes false positive stub/empty file detections in the health report for any file created with a BOM (common on Windows or from copied web content).  **Fix:** Strip BOM and leading whitespace before checking for `---` delimiter.  ### 2. `query.py` silently skips index update when `## Syntheses` section is missing  When saving a synthesis with `--save`, if the `## Syntheses` section doesn't exist in `index.md`, the code silently did nothing - the synthesis page was written to disk but never indexed.  **Fix:** Append the `## Syntheses` section to the end of `index.md` if it doesn't exist.  ## Testing - Verified Python syntax for both files - Unit-tested the `strip_frontmatter` fix with 5 scenarios: normal frontmatter, BOM prefix, leading whitespace, no frontmatter, BOM+whitespace combined - all pass
  **Post-Mortem & Fix Analysis**:
  > ## ✅ Thank you for the thorough review — all points addressed  Thanks @watsonctl for the fast and detailed review. Both fixes you flagged as correct are untouched; the blocking and minor items are now resolved.  ### 🛑 Blocking: `.pyc` artifacts — **fixed** All three compiled bytecode files have been removed from version control: - `tools/__pycache__/__init__.cpython-313.pyc` → deleted - `tools/__pycache__/_utils.cpython-313.pyc` → deleted - `tools/__pycache__/health.cpython-313.pyc` → deleted  Verified with `git ls-files` — no `__pycache__/` or `*.pyc` files remain tracked.  ### 🆕 `.gitignore` — **added** ```gitignore # Byte-compiled / optimized / DLL files __pycache__/ *.py[cod] *$py.class  # Virtual environments .venv/ venv/ env/ ```  ### ✨ Bonus: the `## Syntheses` edge case — **also fixed** (from your non-blocking note) You were right — `replace("## Syntheses\n", ...)` silently failed when `index.md` ended with `## Syntheses` and no trailing newline. Replaced it with a multiline 
  > Hi @watsonctl, gentle ping: all review points from Jul 30 were addressed in the Aug 4 update (BOM/whitespace frontmatter parsing, Syntheses indexing, removed committed .pyc artifacts, .gitignore added) and the branch is still clean against main. Whenever you get a chance, a re-review would be much appreciated. Thanks!
  > Thanks for merging, @watsonctl! Really glad the BOM/whitespace fix and the Syntheses indexing landed. Let me know if anything comes up.

- **Issue #70** (2026-07-27): **fix: use PAT for star-history stargazer API**
  *Symptoms*: ## Summary - GitHub restricted the stargazer timeline API to repo owner/collaborator tokens since 2026-06-30 - The default `GITHUB_TOKEN` in Actions no longer has access, causing 403 failures - Pass a collaborator PAT via `STAR_HISTORY_TOKEN` secret to restore the workflow  ## Test plan - [ ] Merge this PR - [ ] Trigger workflow manually (`workflow_dispatch`) to verify the chart renders successfully - [ ] Confirm next scheduled run (Monday 03:17 UTC) passes

- **Issue #69** (2026-07-11): **fix: switch star history x-axis to yearly labels**
  *Symptoms*: ## What  Switches the star history x-axis from monthly to yearly labels.  ## Why  Even after thinning to every-other-month, labels are still crowded for repos with long histories. Yearly labels give maximum spacing.  ## How  - Remove all month labels except January - Replace "January" with the year (derived from repo creation date via GitHub API) - Result: only "2025", "2026", etc. on the x-axis 

- **Issue #68** (2026-07-11): **fix: switch star history x-axis to yearly labels**
  *Symptoms*: ## What  Switches the star history x-axis from monthly to yearly labels.  ## Why  Even after thinning to every-other-month, labels are still crowded for repos with long histories. Yearly labels give maximum spacing.  ## How  - Remove all month labels except January - Replace "January" with the year (derived from repo creation date via GitHub API) - Result: only "2025", "2026", etc. on the x-axis 

- **Issue #67** (2026-07-11): **fix: thin x-axis month labels to prevent overlap**
  *Symptoms*: ## What  Adds a post-processing step to the star history workflow that removes every other month label from the x-axis.  ## Why  The SVG chart shows every month, causing labels to crowd together when the repo has a long star history. With 26+ months of data in 800px wide SVG, labels are only ~26px apart.  ## Change  After the chart is rendered, a Python script removes odd-indexed month labels (keeps 1st, 3rd, 5th...), doubling the spacing between visible labels. 

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

### Incident Patch 1: `5c5e0564` (2026-09-08)
**Commit Message**: fix: handle BOM/whitespace in frontmatter parsing and missing Syntheses section in index (#71)

- strip_frontmatter: strip UTF-8 BOM and leading whitespace before checking the --- delimiter (fixes false stub/empty detections on Windows-created files)
- query.py: append the ## Syntheses section to index.md when missing instead of silently skipping the index update; header matched via regex so it works at EOF without a trailing newline
- use lambda replacement in re.sub to keep backslash input in questions literal (avoids PatternError on e.g. \\1)
- add .gitignore, remove committed .pyc artifacts

**File**: `.gitignore` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Byte-compiled / optimized / DLL files
+__pycache__/
+*.py[cod]
+*$py.class
+
+# Virtual environments
+.venv/
+venv/
+env/
```

**File**: `tools/health.py` (modified, +6/-4)
```diff
@@ -40,11 +40,13 @@
 
 def strip_frontmatter(content: str) -> str:
     """Remove YAML frontmatter (--- ... ---) from content."""
-    if content.startswith("---"):
-        end = content.find("---", 3)
+    # Strip UTF-8 BOM and leading whitespace before checking for frontmatter
+    cleaned = content.lstrip("\ufeff").lstrip()
+    if cleaned.startswith("---"):
+        end = cleaned.find("---", 3)
         if end != -1:
-            return content[end + 3:].strip()
-    return content.strip()
+            return cleaned[end + 3:].strip()
+    return cleaned.strip()
 
 
 # ── Check: Empty / Stub files ───────────────────────────────────────
```

**File**: `tools/query.py` (modified, +8/-3)
```diff
@@ -162,9 +162,14 @@ def query(question: str, save_path: str | None = None):
         # Update index
         index_content = read_file(INDEX_FILE)
         entry = f"- [{question[:60]}]({save_path}) — synthesis"
-        if "## Syntheses" in index_content:
-            index_content = index_content.replace("## Syntheses\n", f"## Syntheses\n{entry}\n")
-            INDEX_FILE.write_text(index_content, encoding="utf-8")
+        # Match the Syntheses header with or without a trailing newline (e.g. when
+        # the section sits at the very end of index.md with no final newline).
+        syntheses_pattern = re.compile(r"^## Syntheses[^\n]*(?:\n|$)", re.MULTILINE)
+        if syntheses_pattern.search(index_content):
+            index_content = syntheses_pattern.sub(lambda m: f"## Syntheses\n{entry}\n", index_content, count=1)
+        else:
+            index_content += f"\n\n## Syntheses\n{entry}\n"
+        INDEX_FILE.write_text(index_content, encoding="utf-8")
         print(f"  indexed: {save_path}")
 
     # Append to log
```

---

### Incident Patch 2: `66f81f8c` (2026-07-30)
**Commit Message**: fix(tools): guard file_to_md output against silent overwrite (#74)

file_to_md.py derived its output path from the source stem and wrote
without an existence check. A sibling .md with the same stem was
truncated, and with --delete_source the source was then unlinked, while
the CLI reported "Converted" and exited 0 — silent data loss.

- Check output_path before writing; skip + log SKIPPED on collision
- Never unlink the source on a skip
- Add --overwrite flag for explicit opt-in replacement
- Add run-summary counters (converted / skipped collisions)

Closes #73

**File**: `tools/file_to_md.py` (modified, +51/-10)
```diff
@@ -4,13 +4,23 @@
 from markitdown import MarkItDown
 
 
-def convert_directory_to_md(input_dir: Path, delete_source: bool = False):
+def convert_directory_to_md(input_dir: Path, delete_source: bool = False, overwrite: bool = False):
     """
-    Converts all files in a dictory to a Markdown format. Original files in the folder will be deleted.
-    :param input_dir: str
+    Converts all non-Markdown files in a directory tree to Markdown.
+
+    Safety: an output path is never silently overwritten. If a sibling ``.md``
+    with the same stem already exists the file is skipped (unless ``overwrite``
+    is set), the source is never deleted on a skip, and the run reports the
+    skip explicitly so data loss cannot pass unnoticed.
+
+    :param input_dir: Path
         The Path object pointing to the directory to process.
     :param delete_source: bool = False
-        Whether to delete the original source files. Defaults to False.
+        Whether to delete the original source files after a successful
+        conversion. Defaults to False.
+    :param overwrite: bool = False
+        Whether to overwrite an already-existing ``<stem>.md`` output.
+        Defaults to False.
     """
 
     md = MarkItDown(enable_plugins=False)
@@ -22,37 +32,60 @@ def convert_directory_to_md(input_dir: Path, delete_source: bool = False):
         print(f"No files found in {input_dir}!")
         return
 
+    skipped_collision = 0
+    converted = 0
+
     for file_path in tqdm(files_to_process, desc="Converting Files"):
-        # skip hidden files and existing markdown files
+        # skip hidden files and existing markdown files (as conversion sources)
         if file_path.name.startswith('.') or file_path.suffix.lower() == '.md':
             print(f"Skipping conversion of {file_path.name}")
             continue
 
-        # convert filepath to md
+        # derive the output path from the source stem
         output_path = file_path.with_suffix(".md")
+
+        # guard the output side: never silently overwrite a sibling .md.
+        # The source is NOT deleted on a collision, so both the pre-existing
+        # markdown and the original file survive.
+        if output_path.exists() and not overwrite:
+            tqdm.write(
+                f"SKIPPED: '{output_path.name}' already exists; "
+                f"not overwriting '{file_path.name}'."
+            )
+            skipped_collision += 1
+            continue
+
         try:
             # convert
             result = md.convert(str(file_path))
             # save to .md
             output_path.write_text(result.text_content, encoding="utf-8")
-            # optional remove original file
+            # optional remove original file (only after a successful write)
             if delete_source:
                 file_path.unlink()
             tqdm.write(f"Converted: {file_path.name}")
+            converted += 1
         except Exception as e:
             tqdm.write(f"FAILED: Could not convert '{file_path.name}'. Reason: {e}")
 
+    # summary so skipped collisions are visible at the end of the run
+    print("-" * 40)
+    print(f"Converted: {converted}")
+    print(f"Skipped (output exists): {skipped_collision}")
+    print("-" * 40)
+
 
 def main(args):
     # set Paths
     input_path = Path(args.input_dir).resolve()
     print("-" * 40)
     print(f"Input Directory: {input_path}")
+    print(f"Overwrite existing .md: {args.overwrite}")
     print("-" * 40)
 
     # execute
     try:
-        convert_directory_to_md(input_path, args.delete_source)
+        convert_directory_to_md(input_path, args.delete_source, args.overwrite)
         print("\nConversion process complete.")
     except FileNotFoundError:
         print(f"\nError: Input directory not found at {input_path}")
@@ -62,7 +95,9 @@ def main(args):
 
 if __name__ == "__main__":
     """Command-line arguments."""
-    parser = argparse.ArgumentParser(description="Convert all files in a directory to Markdown a
```

---

### Incident Patch 3: `28c04e75` (2026-07-11)
**Commit Message**: fix: show yearly labels instead of monthly on star history chart (#69)

The monthly labels are still too crowded even after thinning. Switch to
yearly labels: remove all month labels except January, then replace
January with the year (derived from repo creation date).

**File**: `.github/workflows/star-history.yml` (modified, +20/-6)
```diff
@@ -23,15 +23,29 @@ jobs:
         with:
           output: assets/star-history.svg
 
-      - name: Thin x-axis labels (keep every other month)
+      - name: Thin x-axis labels (yearly only)
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: |
           python3 << 'PYEOF'
-          import re
+          import re, json, subprocess
           svg = open("assets/star-history.svg").read()
-          labels = list(re.finditer(r'<text [^>]*y="394\.0"[^>]*>.*?</text>\n?', svg))
-          # remove odd-indexed labels (keep 1st, 3rd, 5th ...)
-          for m in reversed(labels[1::2]):
-              svg = svg[:m.start()] + svg[m.end():]
+          labels = list(re.finditer(r'<text ([^>]*)>(.*?)</text>\n?', svg))
+          non_year = {"January","February","March","April","May","June",
+                      "July","August","September","October","November","December"}
+          # Remove all non-January month labels
+          for m in reversed(labels):
+              if m.group(2) in non_year and m.group(2) != "January":
+                  svg = svg[:m.start()] + svg[m.end():]
+          # Get repo creation year for correct year labels
+          r = subprocess.check_output(
+              ["gh", "api", "repos/SamurAIGPT/llm-wiki-agent", "--jq", ".created_at"],
+              text=True).strip()
+          first_jan = int(r[:4]) + 1  # first January is the year after creation
+          year = first_jan
+          while ">January<" in svg:
+              svg = svg.replace(">January<", f">{year}<", 1)
+              year += 1
           open("assets/star-history.svg", "w").write(svg)
           PYEOF
 
```

---

### Incident Patch 4: `1d3c4460` (2026-07-11)
**Commit Message**: fix: thin x-axis month labels to prevent overlap (#67)

The SVG chart shows every month on the x-axis, causing labels to crowd
together for repos with long star histories. Add a post-processing step
that removes every other month label, doubling the spacing.

**File**: `.github/workflows/star-history.yml` (modified, +12/-0)
```diff
@@ -23,6 +23,18 @@ jobs:
         with:
           output: assets/star-history.svg
 
+      - name: Thin x-axis labels (keep every other month)
+        run: |
+          python3 << 'PYEOF'
+          import re
+          svg = open("assets/star-history.svg").read()
+          labels = list(re.finditer(r'<text [^>]*y="394\.0"[^>]*>.*?</text>\n?', svg))
+          # remove odd-indexed labels (keep 1st, 3rd, 5th ...)
+          for m in reversed(labels[1::2]):
+              svg = svg[:m.start()] + svg[m.end():]
+          open("assets/star-history.svg", "w").write(svg)
+          PYEOF
+
       - name: Commit if changed
         run: |
           git config user.name  "github-actions[bot]"
```

---

### Incident Patch 5: `8d902a42` (2026-07-11)
**Commit Message**: fix: ensure assets/ directory exists before rendering star history chart (#66)

The xingkongliang/star-history-svg action fails with FileNotFoundError
when assets/ does not exist. Add mkdir -p step before the render step.

**File**: `.github/workflows/star-history.yml` (modified, +3/-0)
```diff
@@ -15,6 +15,9 @@ jobs:
     steps:
       - uses: actions/checkout@v4
 
+      - name: Ensure assets directory exists
+        run: mkdir -p assets
+
       - name: Render star-history chart
         uses: xingkongliang/star-history-svg@v1
         with:
```

---

### Incident Patch 6: `f22d7235` (2026-07-11)
**Commit Message**: fix: use xingkongliang/star-history-svg action (works with 2026 API restriction) (#64)

The star-history/star-history-embed-image action no longer exists.
Switch to xingkongliang/star-history-svg which is specifically designed
to work after GitHub's 2026 stargazer API restriction.

- Uses the repo owner's built-in GITHUB_TOKEN to read stargazer data
- Generates a hand-drawn style SVG committed to assets/star-history.svg
- Refreshes weekly via cron, zero external dependency at render time

**File**: `.github/workflows/star-history.yml` (modified, +15/-21)
```diff
@@ -1,35 +1,29 @@
-name: Update Star History Chart
+# Regenerates assets/star-history.svg weekly and commits it when it changes.
+name: Refresh Star History
 
 on:
   schedule:
-    - cron: '0 8 * * *'  # Daily at 08:00 UTC
-  workflow_dispatch:       # Allow manual trigger
+    - cron: '17 3 * * 1'   # every Monday 03:17 UTC
+  workflow_dispatch:        # allow manual runs
 
 permissions:
-  contents: write
+  contents: write           # needed to commit the refreshed chart
 
 jobs:
-  update-star-history:
+  refresh:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
 
-      - name: Generate star history chart
-        uses: star-history/star-history-embed-image@master
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+      - name: Render star-history chart
+        uses: xingkongliang/star-history-svg@v1
         with:
-          repos: SamurAIGPT/llm-wiki-agent
-          type: Date
+          output: assets/star-history.svg
 
-      - name: Commit chart
+      - name: Commit if changed
         run: |
-          if [ -f star-history-SamurAIGPT-llm-wiki-agent.svg ]; then
-            git config user.name "github-actions[bot]"
-            git config user.email "github-actions[bot]@users.noreply.github.com"
-            git add star-history-SamurAIGPT-llm-wiki-agent.svg
-            git diff --cached --quiet || git commit -m "chore: update star history chart"
-            git push
-          else
-            echo "No chart generated, skipping commit"
-          fi
+          git config user.name  "github-actions[bot]"
+          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
+          git add assets/star-history.svg
+          git diff --cached --quiet || git commit -m "chore: refresh star history"
+          git push
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -305,7 +305,7 @@ NetworkX + Louvain + Claude + vis.js. No server, no database, runs entirely loca
 
 ## Star History
 
-[![Star History Chart](./star-history-SamurAIGPT-llm-wiki-agent.svg)](https://github.com/SamurAIGPT/llm-wiki-agent/stargazers)
+[![Star History Chart](assets/star-history.svg)](https://github.com/SamurAIGPT/llm-wiki-agent/stargazers)
 
 ## License
 
```

---

### Incident Patch 7: `dbc3adf9` (2026-07-10)
**Commit Message**: fix: replace broken star-history.com SVG with shields.io badge (#60)

The api.star-history.com SVG endpoint is timing out, breaking the
Star History chart in the README. Replace with a shields.io star badge
which is a first-party GitHub badge service with high availability.

Closes #58

**File**: `README.md` (modified, +1/-1)
```diff
@@ -305,7 +305,7 @@ NetworkX + Louvain + Claude + vis.js. No server, no database, runs entirely loca
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=SamurAIGPT/llm-wiki-agent&type=Date)](https://star-history.com/#SamurAIGPT/llm-wiki-agent&Date)
+[![Stars](https://img.shields.io/github/stars/SamurAIGPT/llm-wiki-agent?style=social)](https://github.com/SamurAIGPT/llm-wiki-agent/stargazers)
 
 ## License
 
```

---

### Incident Patch 8: `f837f5bd` (2026-06-13)
**Commit Message**: fix: sanitize entity filenames in heal.py to prevent path traversal

* fix: sanitize entity filenames in heal.py to prevent path traversal

Entity names derived from LLM-generated wikilinks were used directly as
filenames without sanitization. A hallucinated entity like
[[../../etc/cron.d/backdoor]] could cause heal.py to write outside the
wiki/entities/ directory.

Changes:
- Add sanitize_filename() to strip path separators, null bytes, and
  leading dots from entity names
- Add resolved-path safety check to ensure output stays within
  wiki/entities/
- Skip entities with names that become empty after sanitization

Closes #54

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

* fix: include original entity name in sanitize_filename error message

Reviewer feedback on #56: the ValueError was printing the already-empty
sanitized string, making debugging impossible. Now preserves the original
name for the error message.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `tools/heal.py` (modified, +22/-1)
```diff
@@ -11,6 +11,7 @@
 """
 
 import os
+import re
 import sys
 from pathlib import Path
 
@@ -29,6 +30,21 @@
 WIKI_DIR = REPO_ROOT / "wiki"
 ENTITIES_DIR = WIKI_DIR / "entities"
 
+
+def sanitize_filename(name: str) -> str:
+    """Strip characters that are unsafe in filenames.
+
+    Removes path separators, null bytes, and leading dots to prevent
+    directory traversal when using LLM-derived entity names as filenames.
+    """
+    original = name
+    name = re.sub(r"[/\\:\0]", "", name)
+    name = name.lstrip(".")
+    name = "_".join(name.split())
+    if not name:
+        raise ValueError(f"Entity name became empty after sanitization: {original!r}")
+    return name
+
 def call_llm(prompt: str, max_tokens: int = 1500) -> str:
     # Use litellm standard environment variables
     # e.g., GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
@@ -90,7 +106,12 @@ def heal_missing_entities():
 """
         try:
             result = call_llm(prompt)
-            out_path = ENTITIES_DIR / f"{entity}.md"
+            safe_name = sanitize_filename(entity)
+            out_path = ENTITIES_DIR / f"{safe_name}.md"
+            # Safety: ensure resolved path stays within entities directory
+            if not str(out_path.resolve()).startswith(str(ENTITIES_DIR.resolve())):
+                print(f" [!] Skipping unsafe path for entity: {entity}")
+                continue
             out_path.write_text(result, encoding="utf-8")
             print(f" -> Saved to {out_path.relative_to(REPO_ROOT)}")
         except Exception as e:
```

---

### Incident Patch 9: `ab71cbaa` (2026-06-13)
**Commit Message**: fix: correct script reference in lint.py missing entity action hint

The lint report instructed users to run 'python3 generate_missing_entities.py'
which does not exist. Changed to the correct script 'python3 tools/heal.py'.

Closes #53

Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `tools/lint.py` (modified, +1/-1)
```diff
@@ -350,7 +350,7 @@ def run_lint():
 
     if missing_entities:
         report_lines.append("### Missing Entity Pages (mentioned 3+ times but no page)")
-        report_lines.append("> [!warning] Action Required\n> Run `python3 generate_missing_entities.py` to automatically materialize these missing hubs.")
+        report_lines.append("> [!warning] Action Required\n> Run `python3 tools/heal.py` to automatically materialize these missing entity pages.")
         for name in missing_entities:
             report_lines.append(f"- `[[{name}]]`")
         report_lines.append("")
```

---

### Incident Patch 10: `23491f21` (2026-06-02)
**Commit Message**: Merge pull request #50 from watsonctl/fix/health-yaml-title-parsing

fix: YAML-aware title parsing in health.py, add word-boundary clip()

**File**: `tools/health.py` (modified, +20/-3)
```diff
@@ -144,6 +144,25 @@ def _parse_log_entries(log_content: str) -> set[str]:
     )
 
 
+def _parse_frontmatter_title(content: str) -> str:
+    """Extract and lightly unescape a frontmatter title scalar.
+
+    Handles YAML-escaped quotes (e.g. title: "few \"people\" laptop")
+    so that log coverage matching doesn't false-positive on escaped strings.
+    """
+    match = re.search(r'^title:\s*(.+?)\s*$', content, re.MULTILINE)
+    if not match:
+        return ""
+    raw = match.group(1).strip()
+    # Strip surrounding quotes and unescape inner ones
+    if len(raw) >= 2 and raw[0] == raw[-1] == '"':
+        raw = raw[1:-1]
+        raw = raw.replace(r'\"', '"').replace(r"\'", "'").replace(r"\\", "\\")
+    elif len(raw) >= 2 and raw[0] == raw[-1] == "'":
+        raw = raw[1:-1].replace("''", "'")
+    return raw.strip().lower()
+
+
 def check_log_coverage(pages: list[Path]) -> list[dict]:
     """Find source pages that have no corresponding ingest entry in log.md.
 
@@ -162,10 +181,8 @@ def check_log_coverage(pages: list[Path]) -> list[dict]:
         # Try matching by slug (filename without .md) or by frontmatter title
         slug = p.stem.lower().replace("-", " ").replace("_", " ")
 
-        # Also try extracting title from frontmatter
         content = read_file(p)
-        title_match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
-        fm_title = title_match.group(1).strip().lower() if title_match else ""
+        fm_title = _parse_frontmatter_title(content)
 
         if slug not in logged_titles and fm_title not in logged_titles:
             missing.append({
```

**File**: `tools/ingest.py` (modified, +8/-0)
```diff
@@ -58,6 +58,14 @@ def sha256(text: str) -> str:
     return hashlib.sha256(text.encode()).hexdigest()[:16]
 
 
+def clip(text: str, limit: int = 260) -> str:
+    """Truncate text at word boundary instead of mid-word."""
+    if len(text) <= limit:
+        return text
+    clipped = text[: limit - 3].rsplit(" ", 1)[0].rstrip()
+    return clipped + "..."
+
+
 def read_file(path: Path) -> str:
     return path.read_text(encoding="utf-8") if path.exists() else ""
 
```

#### Recent Merged Pull Requests:
- **PR #74** (2026-07-30): fix(tools): guard file_to_md output against silent overwrite (@watsonctl)
- **PR #72** (closed): Add Atlas Cloud LLM aliases (@binyangzhu000-sudo)
- **PR #71** (2026-09-08): fix: handle BOM/whitespace in frontmatter parsing and missing Syntheses section in index (@bunnysayzz)
- **PR #70** (closed): fix: use PAT for star-history stargazer API (@watsonctl)
- **PR #69** (2026-07-11): fix: switch star history x-axis to yearly labels (@watsonctl)
- **PR #68** (closed): fix: switch star history x-axis to yearly labels (@watsonctl)
- **PR #67** (2026-07-11): fix: thin x-axis month labels to prevent overlap (@watsonctl)
- **PR #66** (2026-07-11): fix: create assets/ dir before star history render (@watsonctl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): 54yyyu/zotero-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/54yyyu-zotero-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T02:24:17.547Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `54yyyu/zotero-mcp`
- **Description**: Zotero MCP: Connects your Zotero research library with Claude and other AI assistants via the Model Context Protocol to discuss papers, get summaries, analyze citations, and more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5264 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/zotero_mcp/epub_utils.py`
```
"""
EPUB utility functions for Zotero annotation creation.

This module provides text search capabilities for EPUBs to extract position data
needed for creating Zotero highlight annotations. It generates EPUB CFI
(Canonical Fragment Identifiers) for text locations.

EPUB annotations in Zotero use the WADM (Web Annotation Data Model) format
with FragmentSelector containing EPUB CFI values.

The CFI generation logic was ported from foliate-js:
https://github.com/johnfactotum/foliate-js
(MIT License)
"""

from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import TYPE_CHECKING, Literal
from xml.etree import ElementTree as ET

from zotero_mcp.utils import install_hint

if TYPE_CHECKING:
    from typing import Any


# =============================================================================
# EPUB CFI Data Structures
# =============================================================================


@dataclass
class EPUBCFIStep:
    """
    Represents a single step in a CFI path.

    In CFI notation:
    - Elements are even numbers: (index + 1) * 2
    - Text nodes are odd numbers: 1 + (2 * index)
    """

    type: Literal["element", "text"]
    index: int
    id: str | None = None

    def to_cfi(self) -> str:
        """Convert this step to CFI notation."""
        if self.type == "element":
            num = (self.index + 1) * 2
        else:  # text
            num = 1 + (2 * self.index)

        if self.id:
            return f"{num}[{self.id}]"
        return str(num)


@dataclass
class EPUBCFISegment:
    """
    A segment of a CFI path, consisting of steps and an optional terminal offset.
    """

    steps: list[EPUBCFIStep] = field(default_factory=list)
    terminal_offset: int | None = None

    def to_cfi(self) -> str:
        """Convert this segment to CFI notation."""
        if not self.steps:
            return ""

        path = "/" + "/".join(step.to_cfi() for step in self.steps)

        if self.terminal_offset is not None:
            path += f":{self.terminal_offset}"

        return path


@dataclass
class EPUBCFI:
    """
    Complete EPUB CFI representation.

    Format: epubcfi(/6/<spine>!<path>,<start>,<end>)

    For ranges:
    - base: /6/<spine_index> (spine reference)
    - path: common path to divergence point
    - start: path from divergence to start + offset
    - end: path from divergence to end + offset
    """

    base: EPUBCFISegment = field(default_factory=EPUBCFISegment)
    path: EPUBCFISegment = field(default_factory=EPUBCFISegment)
    start: EPUBCFISegment | None = None
    end: EPUBCFISegment | None = None
    is_range: bool = False

    def to_string(self) -> str:
        """Convert to epubcfi(...) string format."""
        cfi = "epubcfi("
        cfi += self.base.to_cfi()
        cfi += "!"
        cfi += self.path.to_cfi()

        if self.is_range and self.start and self.end:
            cfi += ","
            cfi += self.start.to_cfi()
            cfi += ","
            cfi += self.end.to_cfi()

        cfi += ")"
        return cfi


@dataclass
class TextNodeInfo:
    """
    Information about a text node in the parsed HTML document.

    This simulates DOM text nodes for CFI generation without requiring
    an actual DOM implementation.
    """

    # Normalized text content of this node (used for searching)
    text: str
    # Original text content (used for offset calculations)
    original_text: str
    # Position in accumulated document text (normalized)
    doc_start: int
    doc_end: int
    # Path of element indices from body to parent element (0-indexed)
    element_path: list[int]
    # Element ID if parent has one
    element_id: str | None = None
    # Index of this text node among text node siblings
    text_node_index: int = 0


@dataclass
class TextSearchResult:
    """Result of a text search in a document."""

    # Start position in accumulated text
    start_pos: int
    # End position in accumulated text
    end_pos: int
    # The text node containing the start
    start_node: TextNodeInfo
    # Offset within start node's text
    start_offset: int
    # The text node containing the end
    end_node: TextNodeInfo
    # Offset within end node's text
    end_offset: int
    # Matched text
    matched_text: str



# =============================================================================
# Text Normalization
# =============================================================================

# HTML entities that need to be replaced before parsing
HTML_ENTITY_REPLACEMENTS = {
    "&nbsp;": "\u00A0",    # Non-breaking space
    "&mdash;": "\u2014",   # Em dash
    "&ndash;": "\u2013",   # En dash
    "&lsquo;": "\u2018",   # Left single quote
    "&rsquo;": "\u2019",   # Right single quote
    "&ldquo;": "\u201C",   # Left double quote
    "&rdquo;": "\u201D",   # Right double quote
    "&hellip;": "\u2026",  # Ellipsis
}

def replace_html_entities(html: str) -> str:
    """Replace HTML entities with their Unicode equivalents before parsing."""
    for entity, char in HTML_ENTITY_REPLACEMENTS.items():
        html = html.replace(entity, char)
    return html


def normalize_text_for_search(text: str) -> str:
    """
    Normalize text for searching.

    - Collapse all whitespace to single spaces
    - Normalize smart quotes to ASCII equivalents
    - Trim leading/trailing whitespace
    """
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text)
    # Normalize smart single quotes
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    # Normalize smart double quotes
    text = text.replace('\u201C', '"').replace('\u201D', '"')
    return text.strip()


# =============================================================================
# CFI Text Parser
# =============================================================================


class CFITextParser(HTMLParser):
    """
    HTML parser that extracts text while tracking precise positions for CFI generation.

    This parser:
    - Tracks element indices among element siblings only
    - Tracks text node indices among text node siblings only
    - Builds accumulated text with space separators between text nodes
    - Maintains proper position mappings for CFI path generation

    Important: The root element (html) is NOT included in the CFI path.
    The path starts from body's children (matching Zotero's internal format).
    """

    def __init__(self):
        super().__init__()
        # Accumulated text (normalized with space separators)
        self.accumulated_text = ""
        # List of TextNodeInfo objects
        self.text_nodes: list[TextNodeInfo] = []

        # Parsing state
        # Stack of (tag, element_index, element_id, text_child_count)
        # element_index is index among element siblings at parent level
        self.element_stack: list[tuple[str, int, str | None, int]] = []
        # Current element path (0-indexed element indices) - excludes root html
        self.element_path: list[int] = []
        # Element child counts at each nesting level (for calculating sibling index)
        self.element_child_counts: list[int] = [0]
        # Text node counts at each nesting level
        self.text_child_counts: list[int] = [0]

        # Elements to skip entirely (their content is skipped)
        self.skip_elements = {'script', 'style', 'head', 'meta', 'link'}
        self.skip_depth = 0

        # Track nesting depth to know if we're at the root level
        # The root element (html) should not be added to the path
        self.root_elements = {'html'}
        self.at_root = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        tag = tag.lower()

        # If we're already inside a skipped element, don't count children
        if self.skip_depth > 0:
            if tag in self.skip_elements:
                self.skip_depth += 1
            return

        if tag in self.skip_elements:
            self.skip_depth += 1
            # Still increment element child count so sibling indices are correct
            if self.element_child_counts and not self.at_root:
                self.element_child_counts[-1] += 1
            return

        # Always increment element child count at current level
        # (this tracks siblings correctly even for skipped elements)
        if self.element_child_counts:
            self.element_child_counts[-1] += 1

        # Element index among element siblings (0-indexed)
        element_index = self.element_child_counts[-1] - 1

        # Get element id if present
        element_id = None
        for name, value in attrs:
            if name.lower() == 'id' and value:
                element_id = value
                break

        # Track text child count at this level
        text_child_count = 0

        self.element_stack.append((tag, element_index, element_id, text_child_count))

        # Don't add root element (html) to the path
        # The CFI path starts from children of the document, not including html
        if tag not in self.root_elements:
            self.element_path.append(element_index)
        else:
            # We're leaving root level
            self.at_root = False

        # New level for children
        self.element_child_counts.append(0)
        self.text_child_counts.append(0)

    def handle_endtag(self, tag: str):
        tag = tag.lower()

        if tag in self.skip_elements:
            self.skip_depth = max(0, self.skip_depth - 1)
            return

        if self.skip_depth > 0:
            return

        if self.element_stack and self.element_stack[-1][0] == tag:
            popped_tag, _, _, _ = self.element_stack.pop()

            # Only pop from element_path if we added to it
            if popped_tag not in self.root_elements and self.element_path:
                self.element_path.pop()

            if self.element_child_counts:
    
```

### Core Architecture Module: `src/zotero_mcp/pdf_utils.py`
```
"""
PDF utility functions for Zotero annotation creation.

This module provides text search capabilities for PDFs to extract position data
needed for creating Zotero highlight annotations. It handles common PDF text
extraction issues like:
- Hyphenation at line breaks
- Special characters (em-dashes, curly quotes, ligatures)
- Missing word spacing in extracted text
- Page number mismatches

Search Strategy (in order):
1. For long text (>100 chars): Anchor-based matching (find start/end, highlight between)
2. Exact match using PyMuPDF's search
3. Fuzzy matching with normalized text comparison
"""

from __future__ import annotations

import json
import os
import re
from contextlib import contextmanager
from difflib import SequenceMatcher
from typing import TYPE_CHECKING

from zotero_mcp.utils import install_hint

if TYPE_CHECKING:
    from typing import Any

# =============================================================================
# Configuration Constants
# =============================================================================

# Anchor-based matching settings
ANCHOR_MIN_TEXT_LENGTH = 100  # Use anchor matching for text longer than this
ANCHOR_TARGET_LENGTH = 40     # Target length for start/end anchors
ANCHOR_WORD_BOUNDARY_TOLERANCE = 15  # How far to extend to find word boundary
ANCHOR_MATCH_THRESHOLD = 0.75  # Minimum similarity for anchor fuzzy matching

# Fuzzy matching thresholds (by text length)
FUZZY_THRESHOLD_SHORT = 0.85   # For text < 50 chars
FUZZY_THRESHOLD_MEDIUM = 0.75  # For text 50-150 chars
FUZZY_THRESHOLD_LONG = 0.65    # For text > 150 chars

# Search behavior
DEFAULT_NEIGHBOR_PAGES = 2  # How many pages to search on either side

# Performance optimization
SLIDING_WINDOW_STEP_THRESHOLD = 10000  # Use stepping for texts longer than this


# =============================================================================
# Text Normalization
# =============================================================================

# Character replacement maps for normalization
DASH_REPLACEMENTS = {
    '\u2014': '-',  # em-dash
    '\u2013': '-',  # en-dash
    '\u2012': '-',  # figure dash
    '\u2011': '-',  # non-breaking hyphen
    '\u2010': '-',  # hyphen
}

QUOTE_REPLACEMENTS = {
    '\u2018': "'",  # left single quote
    '\u2019': "'",  # right single quote
    '\u201c': '"',  # left double quote
    '\u201d': '"',  # right double quote
}

LIGATURE_REPLACEMENTS = {
    '\ufb01': 'fi',   # fi ligature
    '\ufb02': 'fl',   # fl ligature
    '\ufb00': 'ff',   # ff ligature
    '\ufb03': 'ffi',  # ffi ligature
    '\ufb04': 'ffl',  # ffl ligature
}


def normalize_text(text: str) -> str:
    """
    Normalize text for matching, handling common PDF extraction issues.

    Transformations applied:
    - Remove hyphenation at line breaks ("regard-\\nless" -> "regardless")
    - Normalize dashes (em-dash, en-dash, etc.) to simple hyphen
    - Normalize curly quotes to straight quotes
    - Expand common ligatures (fi, fl, ff, etc.)
    - Collapse whitespace to single spaces

    Args:
        text: Raw text to normalize

    Returns:
        Normalized text suitable for comparison
    """
    # Remove hyphenation at line breaks
    text = re.sub(r'[\u00ad\u2010\u2011-]\s*\n\s*', '', text)

    # Apply character replacements
    for old, new in DASH_REPLACEMENTS.items():
        text = text.replace(old, new)
    for old, new in QUOTE_REPLACEMENTS.items():
        text = text.replace(old, new)
    for old, new in LIGATURE_REPLACEMENTS.items():
        text = text.replace(old, new)

    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def normalize_for_matching(text: str) -> str:
    """
    Aggressively normalize text for fuzzy matching.

    This removes ALL spaces and lowercases the text to handle PDFs where
    words are stored without proper spacing between spans.

    Args:
        text: Text to normalize

    Returns:
        Text with all spaces removed, lowercased
    """
    text = normalize_text(text)
    text = re.sub(r'\s+', '', text)
    return text.lower()


# =============================================================================
# Page Text Extraction
# =============================================================================

def _extract_page_spans(page) -> list[dict[str, Any]]:
    """
    Extract all text spans from a PDF page with their bounding boxes.

    Args:
        page: PyMuPDF page object

    Each span also carries its characters with their own boxes, and the line
    it sits on. A match rarely starts or ends on a span boundary -- a span is
    usually most of a line -- so without the characters a highlight covers
    every word the matched text shares a span with.

    Returns:
        List of dicts with 'text', 'bbox', 'chars' and 'line' keys
    """
    blocks = page.get_text("rawdict", flags=11)["blocks"]
    spans = []

    for block_no, block in enumerate(blocks):
        if "lines" not in block:
            continue
        for line_no, line in enumerate(block["lines"]):
            for span in line["spans"]:
                chars = span.get("chars") or []
                spans.append({
                    "text": "".join(c["c"] for c in chars) if chars else span.get("text", ""),
                    "bbox": span["bbox"],
                    "chars": chars,
                    "line": (block_no, line_no),
                })

    return spans


def _build_normalized_text_index(spans: list[dict]) -> tuple[str, list[tuple[int, int, int]]]:
    """
    Build a normalized cumulative text string and index mapping.

    This concatenates all span text (normalized) and tracks where each span's
    text appears in the cumulative string, enabling position-to-span lookups.

    Args:
        spans: List of span dicts with 'text' keys

    Returns:
        Tuple of:
        - Cumulative normalized text string
        - List of (norm_start, norm_end, span_index) tuples
    """
    cumulative = ""
    positions = []

    for i, span in enumerate(spans):
        start = len(cumulative)
        normalized = normalize_for_matching(span["text"])
        cumulative += normalized
        end = len(cumulative)
        positions.append((start, end, i))

    return cumulative, positions


def _get_spans_in_range(
    start_pos: int,
    end_pos: int,
    span_positions: list[tuple[int, int, int]],
    spans: list[dict],
) -> tuple[list, list[str]]:
    """
    Get all spans that overlap with a position range in normalized text.

    Args:
        start_pos: Start position in normalized text
        end_pos: End position in normalized text
        span_positions: Index from _build_normalized_text_index
        spans: Original span list

    Spans cut by either end of the range are clipped to the characters inside
    it, and pieces on the same line are joined into one box, so the highlight
    covers the matched text and nothing else.

    Returns:
        Tuple of (list of bboxes, list of original text strings)
    """
    pieces = []  # (line, bbox, text)

    for norm_start, norm_end, span_idx in span_positions:
        if not (norm_start < end_pos and norm_end > start_pos):
            continue
        span = spans[span_idx]
        bbox, text = span["bbox"], span["text"]
        if norm_start < start_pos or norm_end > end_pos:
            clipped = _clip_span(span, start_pos - norm_start, end_pos - norm_start)
            if clipped is not None:
                bbox, text = clipped
        pieces.append((span.get("line"), tuple(bbox), text))

    bboxes: list = []
    texts: list[str] = []
    previous_line = object()
    for line, bbox, text in pieces:
        if line is not None and line == previous_line:
            x0, y0, x1, y1 = bboxes[-1]
            bboxes[-1] = (min(x0, bbox[0]), min(y0, bbox[1]), max(x1, bbox[2]), max(y1, bbox[3]))
            texts[-1] += text
        else:
            bboxes.append(bbox)
            texts.append(text)
        previous_line = line

    return bboxes, texts


def _clip_span(span: dict, lo: int, hi: int) -> tuple[tuple, str] | None:
    """
    Box and text of the characters of a span inside [lo, hi).

    ``lo`` and ``hi`` are offsets into the span's *normalized* text. Each
    character is normalized on its own to find where it lands there; that
    reproduces the span-level normalization exactly, because every rule in
    normalize_for_matching either maps one character (dashes, quotes,
    ligatures, case) or deletes whitespace.

    Returns None when the span has no character data, so the caller keeps the
    whole-span box rather than dropping the piece.
    """
    chars = span.get("chars") or []
    offset = 0
    first = last = None
    box = None
    for idx, char in enumerate(chars):
        width = len(normalize_for_matching(char["c"]))
        if width and offset < hi and offset + width > lo:
            x0, y0, x1, y1 = char["bbox"]
            box = (x0, y0, x1, y1) if box is None else (
                min(box[0], x0), min(box[1], y0), max(box[2], x1), max(box[3], y1)
            )
            first = idx if first is None else first
            last = idx
        offset += width
    if box is None:
        return None
    return box, "".join(c["c"] for c in chars[first:last + 1])


# =============================================================================
# Coordinate Conversion
# =============================================================================

def _page_to_pdf_transform(page) -> tuple[float, float, float, float, float, float]:
    """
    Inverse of page.transformation_matrix as (a, b, c, d, e, f).

    Maps PyMuPDF page space (top-left origin, normalized to the CropBox so
    page.rect is (0, 0, w, h)) back to native PDF user space (MediaBox
    lower-left origin), which is where Zotero positions annotations. Besides
    flipping the y-axis, this restores any non-zero page box origin and
    accounts for page rotation.
    """
    a, b, c, d, e, f = pa
```

### Core Architecture Module: `src/zotero_mcp/utils.py`
```
import logging
import os
import re
import sys
import threading
from contextlib import contextmanager

from unidecode import unidecode

html_re = re.compile(r"<.*?>")

#: How this client identifies itself to third-party services.
#:
#: Deliberately not "Mozilla/5.0 (compatible; ...)". SpringerLink's WAF
#: challenges a Mozilla-prefixed UA when the connection behind it is not a
#: browser's, and served a short challenge page instead of the article --
#: measured 2026-09-03 on link.springer.com/article/10.1006/bulm.1999.0141,
#: where the honest form below was served the full page and its citation_*
#: tags while every Mozilla-prefixed form, including a verbatim Chrome UA,
#: was not. Whether other publishers behave the same way is untested.
#:
#: Lives here rather than in the tools layer so that every module can reach
#: it without an import cycle. Several outbound clients still send no UA at
#: all (OpenAlex, Unpaywall, Semantic Scholar, PMC, arXiv, scite, GitHub);
#: converting those is worth doing and is not done here.
USER_AGENT = "zotero-mcp/1.0 (+https://github.com/54yyyu/zotero-mcp)"

# Distribution name on PyPI, used to build install/upgrade hints.
PACKAGE_NAME = "zotero-mcp-server"


_logger = logging.getLogger(__name__)
_warned_open_dirs: set[str] = set()


def ensure_private_dir(path) -> None:
    """Create *path* owner-only, and say so if an existing one is not.

    ``~/.config/zotero-mcp`` holds ``config.json`` (API keys) and ``chroma_db``
    (the indexed metadata and full text of the library). ``mkdir`` inherits the
    umask, which commonly makes it ``0755``, so any local account could read the
    index (#401). A directory created here is ``0700``, which also shuts other
    users out of everything inside it whatever mode those files get.

    An existing directory is left alone: its mode may be deliberate, and
    tightening it silently on every run would be a surprise. If other users
    can read it, a warning says how to fix it, once per process. No-op for
    permissions on platforms without POSIX modes.
    """
    from pathlib import Path

    path = Path(path)
    existed = path.is_dir()
    path.mkdir(parents=True, exist_ok=True)
    if os.name != "posix":
        return
    try:
        if not existed:
            os.chmod(path, 0o700)
        elif path.stat().st_mode & 0o077 and str(path) not in _warned_open_dirs:
            _warned_open_dirs.add(str(path))
            _logger.warning(
                "%s is readable by other users on this machine and holds your "
                "Zotero index and credentials; run `chmod 700 %s` to restrict it.",
                path, path,
            )
    except OSError:
        pass


def detect_install_flavor() -> str | None:
    """Best-effort detection of how this package was installed.

    ``uv tool install`` places the package under ``.../uv/tools/<name>/lib/...``
    and pipx under ``.../pipx/venvs/<name>/lib/...``. Anything else (venv,
    conda, system site-packages) is most likely pip-managed, but we cannot
    prove it, so it is reported as unknown (``None``).

    Both installers also leave a marker at the root of the environment they
    create: ``uv-receipt.toml`` for uv, ``pipx_metadata.json`` for pipx. That
    root is ``sys.prefix``, so the markers still identify the installer when
    the environment lives somewhere else (``UV_TOOL_DIR``, ``PIPX_HOME``, a
    relocated data directory), where the path test above would fall through
    and the user would be shown ``pip`` first (#534).

    Returns:
        ``"uv"``, ``"pipx"``, or ``None`` when the flavor is undetermined.
    """
    path = os.path.abspath(__file__).replace("\\", "/")
    if "/uv/tools/" in path:
        return "uv"
    if "/pipx/venvs/" in path:
        return "pipx"
    prefix = sys.prefix
    if os.path.isfile(os.path.join(prefix, "uv-receipt.toml")):
        return "uv"
    if os.path.isfile(os.path.join(prefix, "pipx_metadata.json")):
        return "pipx"
    return None


def install_command(extra: str | None = None, flavor: str | None = None) -> str:
    """Return the command that installs/upgrades the package with *extra*.

    Args:
        extra: Optional extras name (e.g. ``"semantic"``, ``"pdf"``).
        flavor: Override for the detected installer ("uv", "pipx", "pip").
    """
    target = f"{PACKAGE_NAME}[{extra}]" if extra else PACKAGE_NAME
    flavor = flavor or detect_install_flavor()
    if flavor == "uv":
        return f"uv tool install --upgrade '{target}'"
    if flavor == "pipx":
        return f"pipx install --force '{target}'"
    return f"pip install '{target}'"


def install_hint(extra: str | None = None) -> str:
    """Install instruction matching how zotero-mcp was actually installed.

    A hardcoded ``pip install`` line is wrong — and silently does nothing
    useful — for ``uv tool``/pipx installs (issue #388). When the flavor is
    unambiguous we print only the command that works there; otherwise we print
    the pip command together with the uv and pipx equivalents so no user is
    left with a command that cannot work for them.
    """
    flavor = detect_install_flavor()
    if flavor:
        return f"Install it with: {install_command(extra, flavor)}"
    return (
        f"Install it with: {install_command(extra, 'pip')} "
        f"(uv: {install_command(extra, 'uv')}; "
        f"pipx: {install_command(extra, 'pipx')})"
    )


# State for suppress_stdout. It swaps the process-global sys.stdout, so
# concurrent users have to be counted rather than each saving and restoring
# their own idea of "the real stdout" (#431).
_stdout_lock = threading.Lock()
_stdout_depth = 0
_stdout_devnull = None
_stdout_original = None


@contextmanager
def suppress_stdout():
    """Context manager to suppress stdout temporarily.

    Reference-counted under a lock. Two MCP tool threads running a semantic
    search at the same time used to interleave their save/restore of the
    global ``sys.stdout``: the one that exited last restored a value it had
    captured while stdout was already redirected, leaving the global pointing
    at a closed devnull. Every later write to stdout then failed, which on the
    stdio transport reads as the server dropping the connection (#431). Only
    the first entrant redirects and only the last one restores; the lock is
    held for the bookkeeping alone, never for the body.
    """
    global _stdout_depth, _stdout_devnull, _stdout_original

    with _stdout_lock:
        if _stdout_depth == 0:
            _stdout_original = sys.stdout
            _stdout_devnull = open(os.devnull, "w")
            sys.stdout = _stdout_devnull
        _stdout_depth += 1
    try:
        yield
    finally:
        with _stdout_lock:
            _stdout_depth -= 1
            if _stdout_depth == 0:
                sys.stdout = _stdout_original
                devnull, _stdout_devnull = _stdout_devnull, None
                _stdout_original = None
                if devnull is not None:
                    try:
                        devnull.close()
                    except Exception:
                        pass

def format_creators(creators: list[dict[str, str] | str]) -> str:
    """
    Format creator names into a string.

    Args:
        creators: List of creator objects from Zotero.  Each element is
            typically a dict with firstName/lastName or name keys, but may
            also be a plain string (e.g. from BetterBibTeX results).

    Returns:
        Formatted string with creator names.
    """
    names = []
    for creator in creators:
        if isinstance(creator, str):
            name = creator
        else:
            parts = [creator.get("lastName"), creator.get("firstName")]
            name = ", ".join(part for part in parts if part) or creator.get("name", "")
        if name:
            names.append(name)
    return "; ".join(names) if names else "No authors listed"


def is_local_mode() -> bool:
    """Return True if running in local mode.

    Local mode is enabled when environment variable `ZOTERO_LOCAL` is set to a
    truthy value ("true", "yes", or "1", case-insensitive).
    """
    value = os.getenv("ZOTERO_LOCAL", "")
    return value.lower() in {"true", "yes", "1"}


# ---------------------------------------------------------------------------
# Pagination helper
# ---------------------------------------------------------------------------

def _paginate(zot_method, *args, max_items=None, keep=None, **kwargs):
    """Fetch all results from a pyzotero method using manual pagination.

    Avoids zot.everything() which can cause RLock pickling in MCP contexts.
    Accepts the same positional and keyword arguments as the wrapped method,
    plus an optional max_items to cap the total results, and an optional
    ``keep`` predicate: only items passing it are returned and counted
    toward max_items. That is for callers whose own filter would drop a
    pageful of fetched items (child notes in a titleCreatorYear search,
    #542) — a full page of filtered-out items is not exhaustion, so paging
    continues and the cap is not spent on results nobody will see.
    """
    items = []
    start = 0
    page_size = 100
    while True:
        batch = zot_method(*args, start=start, limit=page_size, **kwargs)
        if not batch:
            break
        # Short-page test on the raw count: a full page that keep filters
        # down to nothing must not read as "the server ran out".
        fetched = len(batch)
        if keep is not None:
            batch = [item for item in batch if keep(item)]
        items.extend(batch)
        if fetched < page_size:
            break
        start += page_size
        if max_items and len(items) >= max_items:
            break
    # Trimmed on the way out rather than only on the early-exit path. The cap
    # used to be applied inside the loop, which the last page skips: a run
    # that ended on a short batch returned everything it had fetched, howe
```

### Core Architecture Module: `scripts/check_openai_ratelimits.py`
```
#!/usr/bin/env python3
"""Developer utility to inspect OpenAI Embeddings API rate limits and throughput capacity.

Reads configuration directly from ~/.config/zotero-mcp/config.json or environment variables.
Useful for developers to check remaining capacity (RPM/TPM quotas and window reset times)
in real-time while a real embeddings generation run (`zotero-mcp update-db`) is active.

Mainly, this is how you find the value for
``semantic_search.embedding_config.tokens_per_minute``. Indexing paces on a
token budget rather than a request rate, because tokens are what bind: at a
64 x ~500-token payload each request costs ~32K tokens, so a 1,000,000 TPM
ceiling caps throughput near 31 requests/minute against a 3,000 RPM
allowance. Read ``x-ratelimit-limit-tokens`` from the output and set the
config key a little under it.

The limiter is seeded from that config value rather than from the headers
themselves, even though OpenAI does send them: headers arrive with a
response, so the first requests of a run would be unpaced, and a provider
that omits them would leave the limiter with no target at all.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

DEFAULT_CONFIG_PATH = Path.home() / ".config" / "zotero-mcp" / "config.json"


def load_config(config_path: Path | str | None = None) -> tuple[str | None, str, str]:
    """Load OpenAI API key, model name, and base URL from config file and environment variables."""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    else:
        config_path = Path(config_path)

    config_data = {}
    if config_path.exists():
        try:
            with open(config_path, encoding="utf-8") as f:
                config_data = json.load(f) or {}
        except Exception as e:
            print(f"Warning: Could not read config file at {config_path}: {e}", file=sys.stderr)

    embedding_config = (
        config_data.get("semantic_search", {}).get("embedding_config", {})
        if isinstance(config_data.get("semantic_search"), dict)
        else {}
    )

    api_key = embedding_config.get("api_key") or os.getenv("OPENAI_API_KEY")
    model_name = (
        embedding_config.get("model_name")
        or os.getenv("OPENAI_EMBEDDING_MODEL")
        or os.getenv("ZOTERO_EMBEDDING_MODEL")
        or "text-embedding-3-small"
    )
    if model_name == "default":
        model_name = "text-embedding-3-small"

    base_url = (
        embedding_config.get("base_url")
        or os.getenv("OPENAI_BASE_URL")
        or "https://api.openai.com/v1"
    )

    return api_key, model_name, base_url


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Developer script to analyze OpenAI Embeddings API rate limits and throughput. "
            "Useful for checking remaining RPM/TPM capacity in real time while an active embedding generation run is in progress."
        )
    )
    parser.add_argument(
        "--config-path",
        help="Path to config file (default: ~/.config/zotero-mcp/config.json)",
    )
    parser.add_argument(
        "--model",
        help="Override embedding model name (e.g. text-embedding-3-small, text-embedding-3-large)",
    )
    parser.add_argument(
        "--api-key",
        help="Override OpenAI API key",
    )

    args = parser.parse_args()

    api_key, model_name, base_url = load_config(args.config_path)
    if args.api_key:
        api_key = args.api_key
    if args.model:
        model_name = args.model

    if not api_key:
        print("❌ Error: OpenAI API key not found.", file=sys.stderr)
        print("Set 'api_key' in ~/.config/zotero-mcp/config.json or export OPENAI_API_KEY.", file=sys.stderr)
        sys.exit(1)

    endpoint_url = base_url.rstrip("/")
    if not endpoint_url.endswith("/embeddings"):
        endpoint_url += "/embeddings"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "input": "Developer throughput test string for OpenAI rate limits.",
        "model": model_name,
    }

    print("=" * 65)
    print("OPENAI EMBEDDINGS API RATE LIMIT & THROUGHPUT ANALYZER")
    print("Note: Useful for inspecting remaining capacity while an active embedding")
    print("      generation run (e.g. zotero-mcp update-db) is in progress.")
    print("=" * 65)
    print(f"Target Endpoint: {endpoint_url}")
    print(f"Embedding Model: {model_name}")
    print("Sending probe request...")

    start_time = time.perf_counter()
    try:
        response = requests.post(endpoint_url, headers=headers, json=payload, timeout=10)
    except Exception as e:
        print(f"❌ Connection Error: {e}", file=sys.stderr)
        sys.exit(1)
    latency_ms = (time.perf_counter() - start_time) * 1000.0

    print(f"HTTP Status:     {response.status_code}")
    print(f"Latency:         {latency_ms:.1f} ms")

    if not response.ok:
        print(f"❌ API Error Response: {response.text}", file=sys.stderr)
        sys.exit(1)

    rate_limit_headers = {
        k.lower(): v for k, v in response.headers.items() if k.lower().startswith("x-ratelimit-")
    }

    print("\n" + "-" * 65)
    print("RATE LIMIT HEADERS RETURNED BY OPENAI:")
    print("-" * 65)
    if not rate_limit_headers:
        print("No x-ratelimit-* headers found in response.")
    else:
        for k, v in sorted(rate_limit_headers.items()):
            print(f"{k:<32}: {v}")

    if "x-ratelimit-limit-tokens" not in rate_limit_headers:
        print(
            "\nNote: no x-ratelimit-limit-tokens header came back, so the token\n"
            "ceiling cannot be read from the API. Look up your tier's published\n"
            "limit and set semantic_search.embedding_config.tokens_per_minute\n"
            "a little under it (the default assumes the lowest tier)."
        )

    # Theoretical throughput calculations
    limit_req = rate_limit_headers.get("x-ratelimit-limit-requests")
    limit_tok = rate_limit_headers.get("x-ratelimit-limit-tokens")

    if limit_req or limit_tok:
        print("\n" + "-" * 65)
        print("THEORETICAL THROUGHPUT CAPACITY:")
        print("-" * 65)
        if limit_req:
            try:
                rpm = int(limit_req)
                rps = rpm / 60.0
                print(f"• Requests Per Minute (RPM): {rpm:,} ({rps:.1f} req/sec)")
            except ValueError:
                pass
        if limit_tok:
            try:
                tpm = int(limit_tok)
                tps = tpm / 60.0
                print(f"• Tokens Per Minute (TPM):   {tpm:,} ({tps:,.1f} tokens/sec)")
            except ValueError:
                pass
    print("=" * 65)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/gen_basefield_map.py`
```
#!/usr/bin/env python3
"""Regenerate the vendored Zotero base-field map shipped with the package.

The map is a trimmed slice of Zotero's global schema
(https://api.zotero.org/schema) carrying, per item type, the mapping from each
type-specific field key to its Zotero *base* field. It lets ``zotero_mcp``
resolve generic parameters (``title``, ``date``, ``publisher``, ...) to the
actual field a given item type uses (a statute's ``title`` is ``nameOfAct``)
and validate a field against the type's declared field set rather than against
the presence of that key on a fetched item.

Run this whenever Zotero bumps the schema version:

    python scripts/gen_basefield_map.py            # fetch live schema
    python scripts/gen_basefield_map.py PATH.json  # use a local schema copy

Output is written to ``src/zotero_mcp/data/zotero_basefields.json``. The weekly
CI job diffs that file and opens a PR when the version changes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCHEMA_URL = "https://api.zotero.org/schema"
OUT_PATH = (
    Path(__file__).resolve().parent.parent
    / "src" / "zotero_mcp" / "data" / "zotero_basefields.json"
)


def _load_schema(source: str | None) -> dict:
    if source:
        return json.loads(Path(source).read_text(encoding="utf-8"))
    import requests

    resp = requests.get(SCHEMA_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def build_map(schema: dict) -> dict:
    """Reduce the full schema to ``{version, itemTypes: {type: {field: base}}}``.

    ``base`` defaults to the field's own name when the field is not a rename,
    so ``itemTypes[type]`` doubles as the type's full valid-field set (its keys)
    and its base->actual inverse (invert the mapping).
    """
    item_types: dict[str, dict[str, str]] = {}
    for it in schema["itemTypes"]:
        fields = {
            f["field"]: f.get("baseField", f["field"])
            for f in it.get("fields", [])
        }
        item_types[it["itemType"]] = fields
    return {
        "version": schema["version"],
        "itemTypes": dict(sorted(item_types.items())),
    }


def main(argv: list[str]) -> int:
    schema = _load_schema(argv[1] if len(argv) > 1 else None)
    table = build_map(schema)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(table, indent=1, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        f"Wrote {OUT_PATH.relative_to(Path.cwd())} "
        f"(schema version {table['version']}, {len(table['itemTypes'])} types)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

```

### Core Architecture Module: `scripts/gen_contributors.py`
```
#!/usr/bin/env python3
"""Regenerate the contributor avatar grid in README.md from GitHub.

Rewrites the block between the ``contributors:start`` and
``contributors:end`` markers with one linked avatar per contributor, most
contributions first. The images are GitHub's own avatar URLs, so the grid
renders on GitHub and on PyPI without a third-party image service.

    python scripts/gen_contributors.py

Needs the GitHub CLI (``gh``) authenticated, or ``GITHUB_TOKEN`` set.
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO = "54yyyu/zotero-mcp"
README = Path(__file__).resolve().parent.parent / "README.md"
START = "<!-- contributors:start -->"
END = "<!-- contributors:end -->"
AVATAR_SIZE = 64   # pixels requested from GitHub (2x the displayed size)
DISPLAY_SIZE = 32


def fetch_contributors() -> list[dict]:
    """All human contributors, most contributions first."""
    people: list[dict] = []
    page = 1
    while True:
        path = f"repos/{REPO}/contributors?per_page=100&page={page}"
        try:
            raw = subprocess.run(["gh", "api", path], check=True, capture_output=True, text=True).stdout
        except (OSError, subprocess.CalledProcessError):
            request = urllib.request.Request(f"https://api.github.com/{path}")
            if token := os.environ.get("GITHUB_TOKEN"):
                request.add_header("Authorization", f"Bearer {token}")
            with urllib.request.urlopen(request) as response:
                raw = response.read().decode()
        batch = json.loads(raw)
        if not batch:
            return people
        people.extend(p for p in batch if p.get("type") == "User")
        page += 1


def render(people: list[dict]) -> str:
    cells = [
        f'<a href="{p["html_url"]}" title="{p["login"]}">'
        f'<img src="{p["avatar_url"]}&s={AVATAR_SIZE}" width="{DISPLAY_SIZE}" height="{DISPLAY_SIZE}" alt="{p["login"]}"></a>'
        for p in people
    ]
    return "\n".join([START, '<p align="center">', *cells, "</p>", END])


def main() -> int:
    text = README.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    if not pattern.search(text):
        print(f"README.md has no {START} ... {END} block", file=sys.stderr)
        return 1
    people = fetch_contributors()
    README.write_text(pattern.sub(lambda _m: render(people), text), encoding="utf-8")
    print(f"wrote {len(people)} contributors to {README.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `scripts/gen_skill_reference.py`
```
#!/usr/bin/env python3
"""Regenerate the zotero-cli skill's command reference from the real parser.

Hand-written CLI documentation drifts the moment a flag is added, and a skill
that names a flag which no longer exists is worse than one that omits it: the
agent will confidently run the wrong command. Deriving the reference from
`build_parser()` means it cannot say anything the CLI does not accept.

Run after changing the CLI surface:

    python scripts/gen_skill_reference.py

`tests/test_skill_reference_current.py` fails if the checked-in file is stale.
"""

import argparse
import io
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "src"))

OUT = REPO / "src" / "zotero_mcp" / "skills" / "zotero-cli" / "reference.md"

HEADER = """# zotero-cli command reference

Generated from the CLI's own argument parser by
`scripts/gen_skill_reference.py` -- do not edit by hand.

Every command also accepts `--json` (machine-readable envelope on stdout) and
`-v` (diagnostics on stderr). Both are defined on the top-level parser and on
each first-level command, so they may precede the command name or follow it,
but not follow a sub-command: `get --json metadata KEY` parses and
`get metadata --json KEY` does not. Run
`zotero-cli --json-schema` for the output contract.

"""


def _format_action(action) -> str | None:
    if action.dest in ("help", "json_out", "verbose"):
        return None
    if isinstance(action, argparse._SubParsersAction):
        return None
    if action.option_strings:
        names = ", ".join(action.option_strings)
    else:
        names = f"<{action.dest}>"
    bits = [f"`{names}`"]
    if action.choices:
        bits.append("one of " + ", ".join(f"`{c}`" for c in action.choices))
    if action.required and action.option_strings:
        bits.append("**required**")
    if action.default not in (None, False, argparse.SUPPRESS) and action.option_strings:
        bits.append(f"default `{action.default}`")
    help_text = (action.help or "").strip()
    if help_text and help_text != argparse.SUPPRESS:
        bits.append(help_text)
    return " - " + " -- ".join(bits)


def _render(name: str, parser, out: io.StringIO, depth: int = 2,
            child_prefix: str | None = None) -> None:
    """Render one parser. *child_prefix* is what subcommands are named under --
    the canonical command, so a subheading reads `get metadata` rather than
    repeating the alias list from the parent heading."""
    heading = "#" * depth
    desc = (parser.description or "").strip()
    out.write(f"\n{heading} `{name}`\n")
    if desc:
        out.write(f"\n{desc}\n")

    # Options in a mutually exclusive group are rendered as one entry. Listing them
    # flatly reads as "pass either, or both", which argparse rejects at parse time.
    exclusive = {}
    for group in getattr(parser, "_mutually_exclusive_groups", []):
        members = [a for a in group._group_actions if _format_action(a)]
        if len(members) > 1:
            for a in members:
                exclusive[id(a)] = members
    lines, rendered = [], set()
    for action in parser._actions:
        members = exclusive.get(id(action))
        if members is None:
            line = _format_action(action)
            if line:
                lines.append(line)
            continue
        if id(members[0]) in rendered:
            continue
        rendered.add(id(members[0]))
        names = " / ".join(f"`{m.option_strings[0]}`" for m in members)
        lines.append(f" - {names} -- mutually exclusive")
    if lines:
        out.write("\n")
        out.write("\n".join(lines))
        out.write("\n")

    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            for sub_name, sub in action.choices.items():
                # argparse registers aliases as separate entries pointing at
                # the same parser object; render each parser once.
                if getattr(sub, "_rendered", False):
                    continue
                sub._rendered = True
                _render(f"{child_prefix or name} {sub_name}", sub, out, depth + 1)


def build() -> str:
    from zotero_mcp.cli_standalone import build_parser

    parser = build_parser()
    out = io.StringIO()
    out.write(HEADER)

    subparsers = [
        a for a in parser._actions if isinstance(a, argparse._SubParsersAction)
    ][0]

    # Aliases share a parser object; list them with their canonical command.
    aliases: dict[int, list[str]] = {}
    for name, sub in subparsers.choices.items():
        aliases.setdefault(id(sub), []).append(name)

    seen: set[int] = set()
    for name, sub in subparsers.choices.items():
        if id(sub) in seen:
            continue
        seen.add(id(sub))
        names = aliases[id(sub)]
        title = names[0]
        if len(names) > 1:
            title = f"{names[0]} (alias: {', '.join(names[1:])})"
        _render(title, sub, out, child_prefix=names[0])

    return out.getvalue()


if __name__ == "__main__":
    # An explicit destination lets a caller (the test suite, most of all)
    # generate without writing over the checked-in copy.
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    text = build()
    out.parent.mkdir(parents=True, exist_ok=True)
    # newline="\n" is load-bearing on Windows: write_text's default
    # translates every "\n" to "\r\n", so a run of this script rewrote the
    # tracked file in CRLF. The repo is LF throughout, and read_text()
    # normalizes on the way back in, so nothing downstream reported the drift.
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    shown = out.relative_to(REPO) if out.is_relative_to(REPO) else out
    print(f"wrote {shown} ({len(text)} chars)")

```

### Core Architecture Module: `scripts/measure_context_cost.py`
```
#!/usr/bin/env python3
"""Measure the fixed context cost of each way to reach a Zotero library.

Two routes exist, and they charge for context differently:

* **MCP server.** Every registered tool's name, description and JSON parameter
  schema is sent to the model on *every* request, before the user has typed
  anything. The cost is paid whether or not a single tool is called.

* **CLI + agent skill.** Only the skill's frontmatter (name + description)
  sits in context until the model decides the skill is relevant; the body is
  read on demand, and `reference.md` only if the body sends it there. Command
  output costs what it costs either way, and is not what this measures.

This measures the *fixed* cost -- the tax before any work happens. It does
not measure task success, output size, or number of round trips: those need a
live task benchmark against a real library, which this script deliberately is
not. Reporting the fixed cost as though it settled the question would be the
easy mistake here, so the output says what it covers.

    python scripts/measure_context_cost.py            # table
    python scripts/measure_context_cost.py --json     # machine-readable
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "src"))

SKILL_DIR = REPO / "src" / "zotero_mcp" / "skills" / "zotero-cli"

#: cl100k_base is not any Claude model's exact tokenizer, but it tracks them
#: closely enough for a ratio between two bodies of English + JSON, which is
#: all this reports. The same encoder is used for both sides, so any bias
#: applies equally and cancels in the comparison.
ENCODING = "cl100k_base"


def _encoder():
    try:
        import tiktoken
    except ImportError:
        print("tiktoken is required: pip install tiktoken", file=sys.stderr)
        raise SystemExit(2)
    return tiktoken.get_encoding(ENCODING)


def _serialize_tool(tool) -> str:
    """The tool as the client actually receives it.

    Counting only the description would flatter MCP considerably: parameter
    schemas are most of a tool's wire size. This mirrors an MCP `tools/list`
    entry -- name, description, inputSchema -- so the number is what a session
    really pays.
    """
    payload = {
        "name": tool.name,
        "description": tool.description or "",
        "inputSchema": tool.parameters or {},
    }
    if getattr(tool, "output_schema", None):
        payload["outputSchema"] = tool.output_schema
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def measure_mcp_surface(toolsets: str | None) -> dict:
    """Token cost of the MCP tool surface under one ZOTERO_MCP_TOOLSETS value.

    Imported fresh per profile: the registry is built at import time from the
    environment, so measuring several profiles in one process would report the
    first one three times.
    """
    env_backup = dict(os.environ)
    # Re-importing under a different profile means evicting the package from
    # sys.modules -- but other code in this process may hold references to the
    # old module objects, and leaving the eviction in place would make its
    # monkeypatches apply to modules nobody uses any more. Snapshot and put
    # everything back on the way out, so calling this is invisible from
    # outside.
    module_backup = {
        name: module for name, module in sys.modules.items()
        if name.startswith("zotero_mcp")
    }
    for name in module_backup:
        del sys.modules[name]
    try:
        os.environ["ZOTERO_LOCAL"] = "true"
        if toolsets is None:
            os.environ.pop("ZOTERO_MCP_TOOLSETS", None)
        else:
            os.environ["ZOTERO_MCP_TOOLSETS"] = toolsets

        from zotero_mcp import server  # noqa: F401  (registers the tools)
        from zotero_mcp._app import mcp

        # The public list_tools() is the one that honours the toolset
        # profile. The internal _list_tools() returns every *registered* tool,
        # disabled ones included, which would report an identical surface for
        # every profile and quietly make this whole measurement meaningless.
        tools = asyncio.run(mcp.list_tools())
        enc = _encoder()
        per_tool = {t.name: len(enc.encode(_serialize_tool(t))) for t in tools}
        return {
            "profile": toolsets if toolsets is not None else "(unset - default)",
            "tools": len(tools),
            "tokens": sum(per_tool.values()),
            "per_tool": dict(sorted(per_tool.items(), key=lambda kv: -kv[1])),
        }
    finally:
        os.environ.clear()
        os.environ.update(env_backup)
        for name in [n for n in sys.modules if n.startswith("zotero_mcp")]:
            del sys.modules[name]
        sys.modules.update(module_backup)


def measure_skill() -> dict:
    """Token cost of the CLI route, split by when each part is paid for."""
    enc = _encoder()
    skill_md = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    reference = (SKILL_DIR / "reference.md").read_text(encoding="utf-8")

    # Everything before the closing --- is what sits in context unconditionally.
    parts = skill_md.split("---", 2)
    frontmatter = parts[1] if len(parts) > 2 else ""
    body = parts[2] if len(parts) > 2 else skill_md

    return {
        "frontmatter": len(enc.encode(frontmatter)),
        "body": len(enc.encode(body)),
        "skill_total": len(enc.encode(skill_md)),
        "reference": len(enc.encode(reference)),
    }


def build_report() -> dict:
    profiles = [None, "none", "all"]
    mcp_results = [measure_mcp_surface(p) for p in profiles]
    skill = measure_skill()

    default = next(r for r in mcp_results if r["profile"].startswith("(unset"))
    return {
        "encoding": ENCODING,
        "mcp": mcp_results,
        "skill": skill,
        "comparison": {
            "mcp_default_always_loaded": default["tokens"],
            "cli_always_loaded": skill["frontmatter"],
            "cli_after_skill_fires": skill["skill_total"],
            "cli_worst_case_with_reference": skill["skill_total"] + skill["reference"],
        },
    }


def print_table(report: dict) -> None:
    c = report["comparison"]
    print("Fixed context cost: MCP tool surface vs CLI + skill")
    print(f"(tokens, {report['encoding']}; measured, not estimated)\n")

    print("MCP server -- sent on every request, before any tool is called")
    print(f"  {'profile':<24} {'tools':>6} {'tokens':>8}")
    for row in report["mcp"]:
        print(f"  {row['profile']:<24} {row['tools']:>6} {row['tokens']:>8,}")

    s = report["skill"]
    print("\nCLI + skill -- paid in stages")
    print(f"  {'frontmatter (always in context)':<40} {s['frontmatter']:>8,}")
    print(f"  {'+ SKILL.md body (when it fires)':<40} {s['skill_total']:>8,}")
    print(f"  {'+ reference.md (only if needed)':<40} "
          f"{s['skill_total'] + s['reference']:>8,}")

    always = c["mcp_default_always_loaded"] / max(c["cli_always_loaded"], 1)
    fired = c["mcp_default_always_loaded"] / max(c["cli_after_skill_fires"], 1)
    print("\nRatio, MCP default profile vs CLI")
    print(f"  before either is used:        {always:>6.1f}x")
    print(f"  once the skill has fired:     {fired:>6.1f}x")

    print("\nWhat this does and does not show")
    print("  Measured: the fixed tax each route puts in context before work starts.")
    print("  Not measured: task success, output size, or round trips. A cheaper")
    print("  surface that gets the answer wrong is not cheaper. Those need a live")
    print("  benchmark against a real library.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Machine-readable output")
    parser.add_argument("--per-tool", action="store_true",
                        help="Also list each tool's cost in the default profile")
    args = parser.parse_args()

    report = build_report()
    if args.json:
        print(json.dumps(report, indent=2))
        return

    print_table(report)
    if args.per_tool:
        default = next(r for r in report["mcp"] if r["profile"].startswith("(unset"))
        print("\nPer-tool cost, default profile (most expensive first)")
        for name, tokens in default["per_tool"].items():
            print(f"  {tokens:>6,}  {name}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/measure_read_backend.py`
```
#!/usr/bin/env python3
"""Measure what each read backend costs to answer the same question.

`zotero_mcp.library` serves every read operation through one of two
implementations: `SqliteBackend`, which queries `zotero.sqlite` directly, and
`ApiBackend`, which makes the pyzotero calls the tools used to make. They
return the same records; what differs is the work.

This counts that work rather than estimating it. SQL statements are counted by
proxying the reader's sqlite3 connection; HTTP requests by wrapping
`httpx.Client.send`. Both counts are observed at the point of execution, so a
retry, a redirect or a pagination loop shows up as what it is.

The number that matters here is not per-call latency -- it is how each column
*scales*. The SQLite column is flat: an operation costs the same handful of
queries whether it is asked for one key or a hundred. The API column tracks
either the batch size (one request per parent for children) or the size of the
library (one request per 100 rows for tags). That shape is what the port
exists to remove, and it is why the ratios below grow with the library rather
than staying constant.

What this deliberately does NOT measure: correctness or agreement between the
backends -- that is `tests/live/test_read_backend_parity.py`, which compares
their actual results. A fast backend that returns the wrong rows would look
excellent here, so the two are kept separate on purpose.

Both routes are measured when both are available. With Zotero desktop closed
the API column is reported as unavailable rather than skipped silently: those
reads working at all is the point of the exercise.

    python scripts/measure_read_backend.py              # table
    python scripts/measure_read_backend.py --json       # machine-readable
    python scripts/measure_read_backend.py --keys 100   # bigger batch

Needs ZOTERO_LOCAL=true and a readable zotero.sqlite. Reads only; it never
writes to the database or to Zotero.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "src"))

#: Batch size for the plural operations, unless --keys says otherwise. Large
#: enough that an N+1 shape is unmistakable, small enough to stay polite to a
#: live API.
DEFAULT_KEYS = 25


class _CountingConnection:
    """Proxy that counts `execute` calls on a sqlite3 connection.

    sqlite3.Connection.execute is read-only, so it cannot be patched in
    place; wrapping is the only way to observe the statement count without
    changing the reader.
    """

    def __init__(self, inner, counter):
        object.__setattr__(self, "_inner", inner)
        object.__setattr__(self, "_counter", counter)

    def execute(self, *args, **kwargs):
        self._counter["sql"] += 1
        return self._inner.execute(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._inner, name)


def _install_counters(reader, counter):
    """Count SQL statements and HTTP requests for the rest of the process."""
    import httpx

    reader._connection = _CountingConnection(reader._get_connection(), counter)

    original_send = httpx.Client.send

    def counting_send(self, request, *args, **kwargs):
        counter["http"] += 1
        return original_send(self, request, *args, **kwargs)

    httpx.Client.send = counting_send


def _operations(keys):
    """(label, callable) pairs, each taking a backend.

    Chosen to cover the three shapes that behave differently: a point lookup,
    a batch keyed on N, and a listing keyed on library size.
    """
    return [
        ("get_item(1 key)", lambda b: b.get_item(keys[0])),
        (f"get_items({len(keys)} keys)", lambda b: b.get_items(keys)),
        (f"get_children({len(keys)} keys)", lambda b: b.get_children(keys)),
        ("list_collections()", lambda b: b.list_collections()),
        ("list_tags()", lambda b: b.list_tags()),
        (f"recent_items({len(keys)})", lambda b: b.recent_items(limit=len(keys))),
    ]


def _measure(backend, operation, counter, kind):
    """Run one operation, returning its cost or the reason it could not run."""
    counter["sql"] = counter["http"] = 0
    started = time.perf_counter()
    try:
        operation(backend)
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"[:110]}
    elapsed_ms = (time.perf_counter() - started) * 1000
    return {"calls": counter[kind], "ms": round(elapsed_ms, 1)}


def collect(key_count):
    """Measure every operation on whichever backends are usable here."""
    os.environ.setdefault("ZOTERO_LOCAL", "true")
    os.environ["ZOTERO_BACKEND"] = "sqlite"

    from zotero_mcp.client import get_local_zotero_client
    from zotero_mcp.library import ApiBackend, SqliteBackend
    from zotero_mcp.local_db import get_local_zotero_reader

    reader = get_local_zotero_reader()
    if reader is None:
        raise SystemExit(
            "No readable zotero.sqlite. Set ZOTERO_LOCAL=true, and ZOTERO_DB_PATH "
            "if your Zotero data directory is in a custom location."
        )

    counter = {"sql": 0, "http": 0}
    _install_counters(reader, counter)

    sqlite_backend = SqliteBackend(reader, 0)
    keys = [item["key"] for item in sqlite_backend.recent_items(limit=key_count)]
    if not keys:
        raise SystemExit("The personal library has no items to measure against.")

    zot = get_local_zotero_client()
    api_backend = ApiBackend(zot) if zot is not None else None

    rows = []
    for label, operation in _operations(keys):
        row = {
            "operation": label,
            "sqlite": _measure(sqlite_backend, operation, counter, "sql"),
        }
        row["api"] = (
            _measure(api_backend, operation, counter, "http")
            if api_backend is not None
            else {"unavailable": "Zotero API not reachable"}
        )
        rows.append(row)

    result = {
        "library_items": reader.get_item_count(),
        "keys_measured": len(keys),
        "api_available": api_backend is not None,
        "operations": rows,
    }
    reader.close()
    return result


def _cell(measurement, unit):
    if "error" in measurement:
        return "error", "—"
    if "unavailable" in measurement:
        return "—", "—"
    return f"{measurement['calls']} {unit}", f"{measurement['ms']:,.1f} ms"


def render(result):
    lines = []
    add = lines.append

    add(f"Library: {result['library_items']:,} items · "
        f"batch size: {result['keys_measured']} keys")
    if not result["api_available"]:
        add("")
        add("Zotero API not reachable — SQLite column only. Every operation below")
        add("is answered with no network access at all, which is the point: these")
        add("reads used to be impossible with Zotero desktop closed.")
    add("")

    header = f"{'operation':<26}{'sqlite':>10}{'':>13}{'api':>12}{'':>15}"
    add(header)
    add(f"{'':<26}{'queries':>10}{'time':>13}{'requests':>12}{'time':>15}")
    add("-" * len(header))

    for row in result["operations"]:
        s_calls, s_ms = _cell(row["sqlite"], "")
        a_calls, a_ms = _cell(row["api"], "")
        add(f"{row['operation']:<26}{s_calls:>10}{s_ms:>13}{a_calls:>12}{a_ms:>15}")

    if result["api_available"]:
        add("")
        add("The sqlite column is flat in batch size; the api column is not.")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--json", action="store_true",
                        help="emit machine-readable JSON instead of a table")
    parser.add_argument("--keys", type=int, default=DEFAULT_KEYS,
                        help=f"how many item keys to batch (default {DEFAULT_KEYS})")
    args = parser.parse_args()

    result = collect(max(1, args.keys))
    print(json.dumps(result, indent=2) if args.json else render(result))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/profile_recent_items.py`
```
#!/usr/bin/env python3
"""Profile where `recent_items` spends its time on the SQLite backend.

`measure_read_backend.py` counts how much each read costs. This shows where the
time in one of them goes, which is the question to answer when `recent_items`
is slow on a large library: the SQL, the Python that builds the page, or a WAL
snapshot refresh.

For `SqliteBackend.recent_items(limit)` it reports:

1. first-call and warm timings, and each SQL statement's share of them;
2. EXPLAIN QUERY PLAN for every statement;
3. for the slowest statement, its time with and without ORDER BY ... LIMIT,
   which separates the sort from the scan that feeds it;
4. the same call through `get_library_backend()`, the path the tools use,
   including its per-call staleness check;
5. what a snapshot refresh costs here: copying zotero.sqlite, then the first
   call against the copy (skipped when the temp directory lacks room);
6. cProfile of the first call and of the warm calls.

    python scripts/profile_recent_items.py                    # personal library
    python scripts/profile_recent_items.py --group-id 123456  # one group library
    python scripts/profile_recent_items.py --all-libraries    # global scope
    python scripts/profile_recent_items.py --dump-dir out/    # also write .prof files

Needs a readable zotero.sqlite; set ZOTERO_DB_PATH if Zotero's data directory
is somewhere custom. Zotero does not need to be running. Reads only: the
snapshot test copies the database into a temporary directory and deletes the
copy afterwards.
"""

from __future__ import annotations

import argparse
import cProfile
import io
import os
import platform
import pstats
import re
import shutil
import sqlite3
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "src"))

#: Page size, the same as measure_read_backend.py's batch.
DEFAULT_LIMIT = 25

#: Calls per timing. Enough for a stable median, few enough to finish in
#: seconds on a large library.
DEFAULT_RUNS = 20


def _ms(seconds: float) -> str:
    return f"{seconds * 1000:,.1f} ms"


def _one_line(sql: str, width: int = 90) -> str:
    text = " ".join(sql.split())
    return text if len(text) <= width else text[: width - 1] + "…"


class _TimedCursor:
    def __init__(self, cursor, record):
        self._cursor = cursor
        self._record = record

    def _timed(self, fetch, *args):
        started = time.perf_counter()
        result = fetch(*args)
        self._record["fetch"] += time.perf_counter() - started
        return result

    def fetchall(self):
        rows = self._timed(self._cursor.fetchall)
        self._record["rows"] += len(rows)
        return rows

    def fetchone(self):
        row = self._timed(self._cursor.fetchone)
        self._record["rows"] += row is not None
        return row

    def fetchmany(self, *args):
        rows = self._timed(self._cursor.fetchmany, *args)
        self._record["rows"] += len(rows)
        return rows

    def __iter__(self):
        while (row := self.fetchone()) is not None:
            yield row

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class _TimedConnection:
    """Proxy that records each statement's execute time, fetch time and rows.

    Like measure_read_backend.py's counter, it wraps the reader's connection
    rather than patching sqlite3, so the reader itself runs unchanged.
    """

    def __init__(self, inner):
        object.__setattr__(self, "_inner", inner)
        object.__setattr__(self, "log", [])

    def execute(self, sql, params=()):
        record = {"sql": sql, "params": params, "exec": 0.0, "fetch": 0.0, "rows": 0}
        started = time.perf_counter()
        cursor = self._inner.execute(sql, params)
        record["exec"] = time.perf_counter() - started
        self.log.append(record)
        return _TimedCursor(cursor, record)

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def __setattr__(self, name, value):
        setattr(self._inner, name, value)


def _plan(conn, sql, params) -> list[str]:
    return [row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + sql, params).fetchall()]


def _git_revision() -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(REPO), "log", "-1", "--format=%h %s"],
            capture_output=True, text=True, timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return "unknown (git not available)"
    return out.stdout.strip() or "unknown (not a git checkout)"


def _wal_bytes(db_path: str) -> int:
    wal = os.path.realpath(db_path) + "-wal"
    return os.path.getsize(wal) if os.path.exists(wal) else 0


def _print_environment(group_id: int | None, collection: str | None) -> None:
    import zotero_mcp
    from zotero_mcp.local_db import get_local_zotero_reader

    reader = get_local_zotero_reader()
    if reader is None:
        raise SystemExit(
            "No readable zotero.sqlite. Set ZOTERO_DB_PATH if your Zotero data "
            "directory is in a custom location."
        )
    try:
        conn = reader._get_connection()
        lib_ids = reader._resolve_scope_library_ids(group_id)
        if not lib_ids:
            raise SystemExit(f"No library for group_id={group_id} in this database.")
        placeholders = ",".join("?" * len(lib_ids))
        in_scope = conn.execute(
            f"SELECT COUNT(*) FROM items WHERE libraryID IN ({placeholders})", lib_ids
        ).fetchone()[0]
        total = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        target = getattr(reader, "_connection_target", ("unknown",))[0]
        db_path = os.path.realpath(reader.db_path)
    finally:
        reader.close()

    scope = "all libraries" if group_id is None else (
        "personal library" if group_id == 0 else f"group {group_id}"
    )
    narrowed = f", narrowed to collection {collection}" if collection else ""
    print("== Environment")
    print(f"code:      {_git_revision()} (zotero_mcp {getattr(zotero_mcp, '__version__', 'unknown')})")
    print(f"runtime:   Python {platform.python_version()}, SQLite {sqlite3.sqlite_version}, {platform.platform()}")
    print(f"database:  {os.path.getsize(db_path) / 1e6:,.0f} MB, WAL {_wal_bytes(db_path):,} bytes, "
          f"read {'from a snapshot copy' if target == 'snapshot' else 'in place'}")
    print(f"scope:     {scope}: {in_scope:,} of {total:,} items rows ({in_scope / total if total else 0:.0%}){narrowed}")


def _time_calls(backend, kwargs, runs, timed=None):
    totals, logs = [], []
    for _ in range(runs):
        if timed is not None:
            timed.log.clear()
        started = time.perf_counter()
        backend.recent_items(**kwargs)
        totals.append(time.perf_counter() - started)
        if timed is not None:
            logs.append(list(timed.log))
    return totals, logs


def _by_statement(log) -> dict[str, list]:
    """{normalized SQL: [seconds, rows, first record]} for one call."""
    out: dict[str, list] = {}
    for record in log:
        key = " ".join(record["sql"].split())
        entry = out.setdefault(key, [0.0, 0, record])
        entry[0] += record["exec"] + record["fetch"]
        entry[1] += record["rows"]
    return out


def _print_statements(cold_log, warm_logs, warm_totals, runs):
    """Per-statement timings, matched by SQL text rather than position.

    Some statements run only on a connection's first call (library labels are
    cached after it), so a statement's position is not a stable identity.
    Returns [(record, warm median)] in first-seen order.
    """
    cold = _by_statement(cold_log)
    warm = [_by_statement(log) for log in warm_logs]
    keys = list(cold)
    for call in warm:
        keys.extend(k for k in call if k not in keys)

    median_total = statistics.median(warm_totals)
    print(f"\n{'#':>2} {'rows':>6} {'first call':>11} {'warm median':>12} {'warm calls':>10} {'share':>6}  statement")
    statements = []
    for n, key in enumerate(keys, 1):
        samples = [call[key][0] for call in warm if key in call]
        warm_median = statistics.median(samples) if samples else 0.0
        record = cold[key][2] if key in cold else next(call[key][2] for call in warm if key in call)
        first = _ms(cold[key][0]) if key in cold else "—"
        rows = cold[key][1] if key in cold else "—"
        share = warm_median / median_total if median_total else 0.0
        print(f"{n:>2} {rows:>6} {first:>11} {_ms(warm_median):>12} {f'{len(samples)}/{runs}':>10} "
              f"{share:>6.0%}  {_one_line(record['sql'])}")
        statements.append((record, warm_median))

    sql_median = statistics.median(sum(entry[0] for entry in call.values()) for call in warm)
    print(f"   all SQL, warm median {_ms(sql_median)}; everything else {_ms(median_total - sql_median)}")
    return statements


def _sort_versus_scan(conn, record, runs) -> None:
    """Time a statement with and without its ORDER BY ... LIMIT.

    Without the sort, the statement is wrapped in COUNT(*) so SQLite still has
    to visit every row that passes the filters. The two only measure the same
    scan if their plans agree once the sort's temp B-tree is set aside, so that
    is checked and reported.
    """
    sql, params = record["sql"], record["params"]
    match = re.search(r"\bORDER BY\b[\s\S]*?\bLIMIT \?", sql)
    if not isinstance(params, (list, tuple)) or match is None or "?" in sql[match.end():]:
        print("the slowest statement has no trailing ORDER BY ... LIMIT ?, so there is no sort to separate")
        return
    params = list(params)
    count_sql = f"SELECT COUNT(*) FROM ({sql[:match.start()]}{sql[match.end():]})"
    count_params = params[:-1]

    def without_sort_step(plan):
        return [step for step in plan if "TEMP B-TREE" not in step]

    same_scan = without_sort_step(_plan(conn, sql, params)) == without_sort_step(
```

### Core Architecture Module: `src/zotero_mcp/__init__.py`
```
"""
Zotero MCP - Model Context Protocol server for Zotero

This module provides tools for AI assistants to interact with Zotero libraries.
"""

from typing import TYPE_CHECKING

from ._version import __version__ as __version__

if TYPE_CHECKING:  # pragma: no cover - type checkers only
    from .server import mcp as mcp

__all__ = ["__version__", "mcp"]


def __getattr__(name: str):
    """Import ``mcp`` lazily (PEP 562).

    ``from .server import mcp`` at module scope made *every* import of any
    submodule pay for the whole server: FastMCP, the MCP SDK, pydantic,
    pyzotero, bibtexparser and unidecode all get pulled in before the
    submodule's own code runs. Measured on 0.9.1, ``from
    zotero_mcp.schema import valid_fields`` cost ~1.45 s and ~1480 modules,
    of which ``schema`` itself was 8 microseconds -- it is a stdlib-only
    module whose whole point is offline field resolution.

    That matters for consumers that use this package as a library rather
    than as a server: schema lookups, DOI normalisation and the CLI's
    lighter subcommands should not require the server's dependency tree to
    be importable, let alone imported.

    ``from zotero_mcp import mcp`` keeps working unchanged, and still
    degrades to AttributeError rather than raising when the server's
    optional dependencies are missing -- matching the previous
    ``try/except ImportError`` behaviour.
    """
    if name == "mcp":
        try:
            from .server import mcp
        except ImportError as exc:  # optional server deps absent
            raise AttributeError(
                "zotero_mcp.mcp is unavailable: the MCP server dependencies "
                f"are not installed ({exc})."
            ) from exc
        return mcp
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(__all__)


# These modules are not imported by default but are available
# pdfannots_helper and pdfannots_downloader

```

### Core Architecture Module: `src/zotero_mcp/_app.py`
```
"""FastMCP application instance and server lifecycle."""

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastmcp import FastMCP

from zotero_mcp._context import sync_context
from zotero_mcp._version import __version__
from zotero_mcp.utils import is_local_mode

# Configure logging from environment variable
# Set ZOTERO_MCP_LOG_LEVEL=DEBUG in Claude Desktop config to enable debug logs
_log_level = os.environ.get("ZOTERO_MCP_LOG_LEVEL", "WARNING").upper()
logging.basicConfig(
    level=getattr(logging, _log_level, logging.WARNING),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    stream=sys.stderr,
)


def _sync_semantic_update() -> None:
    """Check for and run semantic search auto-update (called in a worker thread).

    Every early return below happens *before* ``zotero_mcp.semantic_search`` is
    imported. That module pulls in ChromaDB and numpy, which costs roughly a
    second even when warm, and on Windows the import — running here, in the
    lifespan's worker thread — wedged the process for the length of the first
    tool call (#485). ``config_light`` answers "is an update due?" from the
    config file alone, with no third-party imports at all, so only a server
    that is actually about to index anything pays for ChromaDB.
    """
    from zotero_mcp.config_light import should_update

    config_path = Path.home() / ".config" / "zotero-mcp" / "config.json"
    if not config_path.exists():
        return

    # Avoid initializing ChromaDB on every server startup when no semantic
    # auto-update is due. This also avoids racing a foreground
    # zotero_semantic_search call for the same persisted ChromaDB directory.
    try:
        with open(config_path) as f:
            cfg = json.load(f)
        update_cfg = cfg.get("semantic_search", {}).get("update_config", {})
    except Exception:
        # An unreadable config cannot say an update is due, and guessing "yes"
        # here is what would drag the heavy import back in on every startup.
        return

    if not should_update(update_cfg):
        return

    from zotero_mcp.semantic_search import create_semantic_search

    search = create_semantic_search(str(config_path))
    if not search.should_update_database():
        return

    sys.stderr.write("Auto-updating semantic search database...\n")
    stats = search.update_database(extract_fulltext=is_local_mode())
    sys.stderr.write(
        f"Database update completed: {stats.get('processed_items', 0)} items processed\n"
    )


@asynccontextmanager
async def server_lifespan(server: FastMCP):
    """Manage server startup and shutdown lifecycle.

    Semantic search initialization (ChromaDB + embedding model) is
    offloaded to a worker thread so it cannot block the event loop.
    The previous synchronous call prevented FastMCP from responding
    to the MCP ``initialize`` request within the 60-second client
    timeout.

    On shutdown the worker thread is left to finish on its own —
    ``asyncio.to_thread`` threads cannot be interrupted, and
    ChromaDB (SQLite WAL) is crash-safe, so an unfinished update
    simply resumes on the next startup.
    """
    sys.stderr.write("Starting Zotero MCP server...\n")

    async def _background_update():
        try:
            await asyncio.to_thread(_sync_semantic_update)
        except Exception as e:
            sys.stderr.write(f"Warning: Could not check semantic search auto-update: {e}\n")

    async def _refresh_schema():
        # TTL-gated conditional GET; degrades to the vendored floor on failure.
        try:
            from zotero_mcp import schema
            if await asyncio.to_thread(schema.refresh) == "offline":
                sys.stderr.write(
                    "Warning: could not refresh the Zotero schema; using the "
                    "cached or vendored copy.\n"
                )
        except Exception as e:
            sys.stderr.write(f"Warning: Zotero schema refresh task failed: {e}\n")

    asyncio.create_task(_background_update())
    asyncio.create_task(_refresh_schema())

    yield {}

    sys.stderr.write("Shutting down Zotero MCP server...\n")


class _ZoteroMCP(FastMCP):
    """FastMCP whose tools get a context they can log to synchronously."""

    def tool(self, name_or_fn=None, **kwargs):
        if callable(name_or_fn):
            return super().tool(sync_context(name_or_fn), **kwargs)
        register = super().tool(name_or_fn, **kwargs)
        return lambda fn: register(sync_context(fn))


# Create an MCP server (fastmcp 2.14+ no longer accepts `dependencies`)
mcp = _ZoteroMCP("Zotero", version=__version__, lifespan=server_lifespan)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #668** (2026-10-06): **Feature/readme fork note**
  *Symptoms*: 

- **Issue #647** (2026-10-04): **release: 0.13.2**
  *Symptoms*: Release 0.13.2.  Merges ten fix PRs from @falcon1-1-code on top of main (which already carries #586 and #592):  - #623 SQLite reader keeps the automatic tag type (fixes #620) - #625 exported bibliographies are numbered 1..N (fixes #619) - #629 PDFs with a scanner OCR text layer fall back to the text layer (fixes #611) - #630 percent-encoded doi.org URLs are decoded - #634 merging duplicates no longer trashes distinct linked-file attachments (fixes #633) - #622 automatic tags stay automatic on tag edits and merges (fixes #618) - #624 a read right after our own write sees it, one fresh snapshot copy per write (fixes #228) - #627 switch_library accepts the listed personal library id (fixes #603) - #628 chunked re-index writes new passages before pruning, holds the watermark on failures (fixes #610) - #637 changing item_type carries base-mapped fields over (fixes #636)  Plus a small tidy commit (docstring wrap, CHANGELOG wording for #630, one em dash) and the version bump.  Each PR's regression test fails on main and passes here. The last five were updated after review. Full suite locally: 3699 passed, 91 skipped.  Closes #622, #623, #624, #625, #627, #628, #629, #630, #634, #637. Fixes #228, #603, #610, #611, #618, #619, #620, #633, #636.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #637** (2026-10-04): **fix(update): keep base-mapped fields when changing item_type (#636)**
  *Symptoms*: Fixes #636.  ## The bug  When `zotero_update_item` migrates `item_type`, it keeps only fields that exist under the same name in the new type's template. Zotero stores several fields under type-specific names that share one base field (`publicationTitle` / `proceedingsTitle` / `bookTitle`, `websiteTitle` / `blogTitle`, `publisher` / `institution`, …), so those values were silently dropped. The success report gave no hint of it.  ## What changed  After the reshape, each non-empty old field that wasn't kept is mapped through the existing schema helpers, `_schema.base_field_of(old_type, k)` then `_schema.resolve_field(new_type, base)`. It's copied over when the target is a valid field of the new type and still empty. This matches desktop Zotero's behaviour on a type change.  ## Testing  - **Regression test** `tests/test_update_item.py::TestUpdateItemType::test_migrate_carries_base_mapped_fields`: fails on `main` (`proceedingsTitle` is `None`), passes here. - **Full suite:** 3646 passed, 1 skipped. - **Live**, local Zotero on macOS: a journal article with `publicationTitle = "Proc. of FooConf"` changed to `conferencePaper`. On `main` the value was gone; with this branch `proceedingsTitle` is `"Proc. of FooConf"`. Test items were trashed afterwards.  This is a data-loss fix, which is why I'm opening it while my other PRs are still waiting for review. Sorry for the queue.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > Thanks! Reusing `base_field_of` / `resolve_field` for this is good.  Two comments are out of date after the change: - the comment above the reshape in `write.py` still says type-specific fields not in the new template are dropped - `base_field_of`'s docstring in `_schema` still says it isn't used and is kept for a future read-side migration  Optional: `set(new_template) | _schema.valid_fields(item_type)` looks redundant, one of them should be enough. Listing the carried-over fields in the change report would also be nice, but not required. 
  > Thanks, follow-up in b2ac0fc. Both stale comments now describe the base-field carry-over, and `update_item` lists the carried fields in a separate "Carried over to the new type" line, so the existing report lines are unchanged. I kept the `set(new_template) | valid_fields(item_type)` union: the template (live API or local fallback) and the schema table are independent sources and neither contains the other, so a type missing from a stale table would otherwise get no carry-over. 
  > Thanks, this looks good now! Merged into the 0.13.2 release branch (#647), it'll close when that lands.

- **Issue #636** (2026-10-04): **update_item: changing item_type silently drops base-mapped fields (publicationTitle → proceedingsTitle, websiteTitle → blogTitle, …)**
  *Symptoms*: `zotero_update_item(fields={"item_type": ...})` silently drops field values that the new type stores under a different, base-mapped name. Desktop Zotero carries these across when you change an item's type.  ## Repro (live, local Zotero, current `main`) 1. Add a journal article with `publicationTitle = "Proc. of FooConf"`. 2. `zotero_update_item(item_key=K, fields={"item_type": "conferencePaper"})` → `Successfully updated ... item_type: 'journalArticle' -> 'conferencePaper'` 3. `zotero_get_item_metadata(K, format="json")`: no `proceedingsTitle`, and the value is gone.  Other affected pairs: `websiteTitle` → `blogTitle` (webpage → blogPost), `publisher`/`number` → `institution`/`reportNumber` (→ report), `publicationTitle` → `bookTitle` (→ bookSection), and so on. Reclassifying a misfiled item is a common repair, and the success message doesn't mention the loss.  ## Cause `tools/write.py`, in the item-type migration: the reshape keeps only keys that exist under the same name in the new type's template, so base-mapped fields are dropped.  ## Fix I'll open a PR right after this. After the reshape, each non-empty old field that wasn't kept is mapped through `_schema.base_field_of(old_type, k)` → `_schema.resolve_field(new_type, base)` and copied if the target exists and is empty. 

- **Issue #634** (2026-10-04): **fix(merge): don't trash a duplicate's linked-file attachments as "already on the keeper"**
  *Symptoms*: Fixes #633.  ## The bug  `zotero_merge_duplicates` moves each duplicate's children to the keeper, but skips an attachment when the keeper "already has" it, then trashes the duplicate. "Already has" was decided by `_attachment_sig`, which compared only `contentType`, `filename`, `md5` and `url`. Linked-file attachments (`linkMode: "linked_file"`, used by ZotFile/Attanger setups and anyone who links rather than stores PDFs) carry none of the last three, so every linked PDF has the same signature `("application/pdf", "", "", "")`. If the keeper had any linked PDF, every linked PDF on the duplicate was skipped and went to the Trash with the duplicate, along with its annotations, while the result reported it as "duplicate attachments skipped".  ## What changed  `_attachment_sig` now includes `linkMode` and `path`, and returns `None` for an attachment with no md5, path or url, so an attachment with nothing to identify its content is never treated as a duplicate. `None` is dropped from the keeper's signature set. Identical linked files (same path) and identical stored files (same md5) are still skipped as before.  ## Testing  - **Regression tests**, committed first and failing on `main`, in `tests/test_duplicates.py`:   - `test_different_linked_pdf_is_moved_not_trashed`: keeper and duplicate each link a different PDF; the duplicate's is re-parented.   - `test_same_linked_pdf_is_still_skipped`: same path is still treated as a duplicate. - **Full suite:** 3647 passed, 1 skipped. - **`

- **Issue #633** (2026-10-04): **merge_duplicates trashes a duplicate's linked-file PDFs, reporting them as "duplicate attachments skipped"**
  *Symptoms*: ## Summary  When `zotero_merge_duplicates` (or `zotero-cli duplicates merge`) merges items that use linked-file attachments, any linked PDF on a duplicate is treated as already present on the keeper as long as the keeper has some linked PDF. It is not moved, and it goes to the Trash with the duplicate, together with any annotations on it. The tool reports it as a skipped duplicate attachment, so nothing signals that a distinct file was lost from the merged item.  ## Reproduce  1. Two duplicate items, KEEP and DUP. On KEEP, "Attach Link to File…" `preprint.pdf`; on DUP, link a different file, `published.pdf`. 2. Preview the merge: `zotero_merge_duplicates(keeper_key="KEEP", duplicate_keys=["DUP"])` (or `zotero-cli duplicates merge --keeper-key KEEP --duplicate-keys DUP --dry-run`) on `main` (1ac692e).  Result, checked live against Zotero 10: "Child items to re-parent: 0 (1 duplicate attachment(s) will be skipped)". Confirming the merge would therefore send DUP to the Trash with `published.pdf` still attached, leaving KEEP with only `preprint.pdf`. Expected: both linked PDFs end up on KEEP.  ## Cause  `_attachment_sig` in `src/zotero_mcp/tools/write.py` identifies an attachment by `(contentType, filename, md5, url)`. Linked-file attachments have a `path` but no `filename`, `md5` or `url`, so all linked PDFs share the signature `("application/pdf", "", "", "")`.  ## Workaround  Before merging, move linked attachments from the duplicates to the keeper by hand (drag in Zotero), or
  **Post-Mortem & Fix Analysis**:
  > I've opened the fix as #634 right away instead of waiting for my other PRs to be reviewed, since this one silently loses attachments (and their annotations) from the merged item. 

- **Issue #630** (2026-10-04): **fix(identifiers): percent-decode the DOI in a doi.org URL**
  *Symptoms*: `normalize_doi("https://doi.org/10.1002/%28SICI%291097-4636%28199709%2936%3A3%3C287%3A%3AAID-JBM2%3E3.0.CO%3B2-E")` returns `10.1002/%28SICI%291097-4636...` with the escapes still in it. I expected `10.1002/(SICI)1097-4636(199709)36:3<287::AID-JBM2>3.0.CO;2-E`, the DOI the URL actually names. Browsers percent-encode the brackets and angle brackets of Wiley's SICI DOIs in the address bar, so a URL like this is what you get by copying one. `doi_match_key` for the encoded URL and for the plain URL don't match, and `https://doi.org/10.1000%2Fabc` isn't recognised as a DOI at all.  ## The bug  `_DOI_IN_URL_RE` took the URL path as-is and needed a literal `/` after the prefix. Nothing decoded the path, so every caller (`zotero_add_item`'s DOI path, duplicate detection, Scite, discovery) got the encoded string. For a SICI DOI the metadata still resolved, but the item was saved with the encoded string in its DOI field, so it never matches the same paper added by plain DOI, and `if_exists` can't find it. (An encoded `%2F` URL failed to parse as a DOI and fell back to fetching the page, which happened to work but skipped the DOI path.)  ## What changed  In the URL branch of `normalize_doi`, the matched path is now passed through `urllib.parse.unquote`, and the regex also accepts `%2F` as the prefix/suffix separator. A bare or `doi:` DOI isn't decoded, because a `%` there is literal.  ## Testing  - **Regression tests**, committed first and failing on `main`, in `tests/test_identifiers.p

- **Issue #629** (2026-10-04): **fix(extract): fall back to the PDF text layer when markdown extraction is empty (#611)**
  *Symptoms*: Fixes #611.  ## The bug  `extract_pdf` only called `pdf_inspector.extract_pages_markdown`. PDFs from scanners that add their own OCR layer (Xerox, ABBYY) put the text in an invisible layer over a page image, and for those files the markdown pass returns empty markdown with `needs_ocr=True` on every page. Some Ghostscript and PDFCreator files make it raise `invalid content stream` instead. Nothing in the chain recovered the text, so these items were indexed metadata-only, even though `pdf_inspector.extract_text` returns the text layer for the same files.  ## What changed  When the markdown pass raises, or returns no non-whitespace text on any page, `extract_pdf` now falls back to `pdf_inspector.extract_text`. If that also has no text, the result is the same as before (or the original exception is raised again).  `extract_text` covers the whole document and has no page argument. I also tried `extract_text_with_positions` and `extract_text_in_regions` to keep per-page output, but both skip invisible (render mode 3) text and return only the image placeholder. So the fallback is one page attributed to the first page requested, with `needs_ocr` cleared. Under a `max_pages` cap (which the indexer always sets) the text is cut to the same share of the document, so the cap still limits what gets embedded. An explicit page subset such as `zotero_read_pdf_pages` with a range is unchanged, because the whole-document text can't be attributed to those pages. A document with even one page of

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

### Incident Patch 1: `e1316cde` (2026-10-04)
**Commit Message**: fix(local-db): make the post-write snapshot refresh one-shot (#228)

Replace the 120 s throttle bypass with a write generation. Our own write
marks the current database copy stale, so the next read takes exactly one
fresh copy and the ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL throttle applies
again afterwards. A burst of writes still costs one copy per read.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
-- **A read right after a write sees the write** (#228). In local mode the database copy that reads use is refreshed at most every `ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL` seconds, and a write tool's own read just before writing usually used up that window, so `zotero_get_item_metadata` after `zotero_set_item_collections`, or `zotero_get_annotations` after `zotero_create_annotation`, still showed the old state. For two minutes after zotero-mcp writes, the copy is refreshed whenever the database has changed.
+- **A read right after a write sees the write** (#228). In local mode the database copy that reads use is refreshed at most every `ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL` seconds, and a write tool's own read just before writing usually used up that window, so `zotero_get_item_metadata` after `zotero_set_item_collections`, or `zotero_get_annotations` after `zotero_create_annotation`, still showed the old state. After zotero-mcp writes, the next read takes one fresh copy regardless of that interval, then the interval applies again.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `docs/configuration.md` (modified, +4/-3)
```diff
@@ -129,9 +129,10 @@ narrower than the API's. Writes always go through Zotero.
 - `ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL`: Zotero keeps recent changes in a WAL file
   next to `zotero.sqlite`, so reads use a private copy of the database plus that
   file. The copy is refreshed when Zotero writes, at most once per this many
-  seconds (default `5`). For two minutes after zotero-mcp itself writes, that
-  limit is lifted so a read right after a write sees it. `ZOTERO_MCP_DB_SNAPSHOT=0` reads the database in place
-  instead, which never copies but misses changes until Zotero checkpoints.
+  seconds (default `5`). The first read after zotero-mcp itself writes always
+  takes a fresh copy, so it sees that write, and the limit then applies again.
+  `ZOTERO_MCP_DB_SNAPSHOT=0` reads the database in place instead, which never
+  copies but misses changes until Zotero checkpoints.
 
 **Global search across libraries:**
 
```

**File**: `src/zotero_mcp/local_db.py` (modified, +21/-19)
```diff
@@ -682,34 +682,31 @@ def _snapshot_min_interval() -> float:
         return _DEFAULT_SNAPSHOT_MIN_INTERVAL
 
 
-#: Seconds after this process starts a write during which the copy throttle is
-#: bypassed, so a read that follows our own write sees it instead of a copy
-#: taken just before the write landed. A copy is still made only when the
-#: database or WAL has changed, so outside a burst of writes this costs nothing.
-_WRITE_BYPASS_WINDOW = 120.0
-_last_write_at: float | None = None
+# Bumped each time this process is about to write to Zotero. A snapshot copied
+# under an older value is stale: the next read takes one fresh copy regardless of
+# the throttle, then the throttle applies again. Kept apart from _snapshot_lock
+# so a write never waits for a copy in progress.
+_write_gen = 0
+_write_gen_lock = threading.Lock()
 
 
 def note_local_write() -> None:
-    """Record that this process is writing to Zotero; see _wal_snapshot_path."""
-    global _last_write_at
-    _last_write_at = time.monotonic()
-
-
-def _recently_wrote() -> bool:
-    return _last_write_at is not None and time.monotonic() - _last_write_at < _WRITE_BYPASS_WINDOW
+    """Mark the current database copy stale; see _wal_snapshot_path."""
+    global _write_gen
+    with _write_gen_lock:
+        _write_gen += 1
 
 
 # One snapshot per database for the whole process, because readers are opened
 # per tool call: a copy per reader would copy the database on every call.
 _snapshot_lock = threading.Lock()
-_snapshots: dict[str, tuple[tuple, str, float]] = {}
+_snapshots: dict[str, tuple[tuple, str, float, int]] = {}
 
 
 @atexit.register
 def _remove_snapshots() -> None:
     """Delete this process's database copies; they hold the whole library."""
-    for _sig, snap, _made_at in list(_snapshots.values()):
+    for _sig, snap, _made_at, _gen in list(_snapshots.values()):
         shutil.rmtree(os.path.dirname(snap), ignore_errors=True)
     _snapshots.clear()
 
@@ -736,7 +733,10 @@ def _wal_snapshot_path(db_path: str) -> str | None:
     is already current), when snapshots are disabled, or when a copy could not
     be made consistently; callers then read in place as before.
 
-    The copy is reused until either file's size or mtime changes. A file that
+    The copy is reused until either file's size or mtime changes (and, within
+    ``ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL`` of the last copy, even then). A write
+    made by this process (``note_local_write``) marks the copy stale, so the
+    next read copies once whatever the interval says. A file that
     changes while it is being copied is retried, since a checkpoint running
     mid-copy could pair a new main file with an old WAL. SQLite checks WAL
     frame checksums on open, so a WAL copied while Zotero appended to it
@@ -752,14 +752,16 @@ def _wal_snapshot_path(db_path: str) -> str | None:
 
     with _snapshot_lock:
         for _attempt in range(3):
+            gen = _write_gen
             before = (_file_signature(source), _file_signature(wal))
             cached = _snapshots.get(source)
             if cached and os.path.exists(cached[1]):
                 if cached[0] == before:
                     return cached[1]
-                if time.monotonic() - cached[2] < _snapshot_min_interval() and not _recently_wrote():
+                if cached[3] == gen and time.monotonic() - cached[2] < _snapshot_min_interval():
                     # Changed, but copied too recently to copy again; the
-                    # next read after the interval picks the change up.
+                    # next read after the interval picks the change up. A copy
+                    # made before our own latest write skips this, once.
                     return cached[1]
             snap_dir = tempfile.mkdtemp(prefix="zotero_mcp_db_")
             snap = os.path.join(snap_dir, "zotero.sqlite")
@@ -780,7 +782,7 @@ def _wal_snapshot_path(db_path: str) -> str | None:
                 # Best effort: an open connection elsewhere keeps its files
                 # alive on POSIX, and on Windows the directory is left behind.
                 shutil.rmtree(os.path.dirname(cached[1]), ignore_errors=True)
-            _snapshots[source] = (before, snap, time.monotonic())
+            _snapshots[source] = (before, snap, time.monotonic(), gen)
             return snap
     logger.warning(
         "%s kept changing while it was being copied; reading it in place.", source
```

**File**: `tests/test_local_db_wal_snapshot.py` (modified, +95/-4)
```diff
@@ -19,7 +19,6 @@
 @pytest.fixture(autouse=True)
 def _fresh_snapshot_cache(monkeypatch):
     monkeypatch.setattr(local_db, "_snapshots", {})
-    monkeypatch.setattr(local_db, "_last_write_at", None, raising=False)
     monkeypatch.delenv(local_db.DB_SNAPSHOT_ENV_VAR, raising=False)
     monkeypatch.setenv(local_db.DB_SNAPSHOT_MIN_INTERVAL_ENV_VAR, "0")
 
@@ -144,20 +143,112 @@ def test_snapshot_is_not_recopied_inside_the_min_interval(zotero_like_db, monkey
     assert local_db._wal_snapshot_path(str(path)) != first
 
 
-def test_own_write_bypasses_the_min_interval(zotero_like_db, monkeypatch):
-    """A read right after this process writes must not get the pre-write copy."""
+def _count_copies(monkeypatch):
+    copies = [0]
+    real = local_db.shutil.copyfile
+
+    def counting(src, dst, *a, **k):
+        if str(dst).endswith("zotero.sqlite"):
+            copies[0] += 1
+        return real(src, dst, *a, **k)
+
+    monkeypatch.setattr(local_db.shutil, "copyfile", counting)
+    return copies
+
+
+def _snapshot_keys(snap):
+    conn = sqlite3.connect(snap)
+    try:
+        return {row[0] for row in conn.execute("SELECT key FROM items")}
+    finally:
+        conn.close()
+
+
+def test_read_after_own_write_sees_it_then_throttle_applies_again(zotero_like_db, monkeypatch):
     path, writer = zotero_like_db
     monkeypatch.setenv(local_db.DB_SNAPSHOT_MIN_INTERVAL_ENV_VAR, "30")
     clock = [1000.0]
     monkeypatch.setattr(local_db.time, "monotonic", lambda: clock[0])
+    copies = _count_copies(monkeypatch)
 
     first = local_db._wal_snapshot_path(str(path))
+    assert copies[0] == 1
+
+    # Our own write lands inside the throttle window.
     local_db.note_local_write()
     writer.execute("INSERT INTO items (key) VALUES ('OWNWRITE')")
     writer.commit()
 
     clock[0] += 1
-    assert local_db._wal_snapshot_path(str(path)) != first
+    second = local_db._wal_snapshot_path(str(path))
+    assert second != first
+    assert "OWNWRITE" in _snapshot_keys(second)
+    assert copies[0] == 2
+
+    # (b) one-shot: another change right after, with no new write of ours,
+    # is throttled again instead of copying a second time.
+    writer.execute("INSERT INTO items (key) VALUES ('ZOTEROEDIT')")
+    writer.commit()
+    clock[0] += 1
+    assert local_db._wal_snapshot_path(str(path)) == second
+    assert copies[0] == 2
+
+
+def test_several_writes_before_a_read_cost_one_copy(zotero_like_db, monkeypatch):
+    path, writer = zotero_like_db
+    monkeypatch.setenv(local_db.DB_SNAPSHOT_MIN_INTERVAL_ENV_VAR, "30")
+    clock = [1000.0]
+    monkeypatch.setattr(local_db.time, "monotonic", lambda: clock[0])
+    copies = _count_copies(monkeypatch)
+    local_db._wal_snapshot_path(str(path))
+
+    for n in range(5):
+        local_db.note_local_write()
+        writer.execute("INSERT INTO items (key) VALUES (?)", (f"W{n}",))
+        writer.commit()
+    clock[0] += 1
+    snap = local_db._wal_snapshot_path(str(path))
+    assert {f"W{n}" for n in range(5)} <= _snapshot_keys(snap)
+    assert copies[0] == 2
+    clock[0] += 1
+    assert local_db._wal_snapshot_path(str(path)) == snap
+    assert copies[0] == 2
+
+
+def test_write_with_no_snapshot_yet_costs_nothing_extra(zotero_like_db, monkeypatch):
+    path, _writer = zotero_like_db
+    monkeypatch.setenv(local_db.DB_SNAPSHOT_MIN_INTERVAL_ENV_VAR, "30")
+    copies = _count_copies(monkeypatch)
+    local_db.note_local_write()
+    local_db._wal_snapshot_path(str(path))
+    local_db._wal_snapshot_path(str(path))
+    assert copies[0] == 1
+
+
+def test_stale_mark_survives_a_read_that_sees_no_change(zotero_like_db, monkeypatch):
+    """A read before our write lands finds the files unchanged and keeps the
+    copy; the stale mark must still be there for the read after the write."""
+    path, writer = zotero_like_db
+    monkeypatch.setenv(local_db.DB_SNAPSHOT_MIN_INTERVAL_ENV_VAR, "30")
+    clock = [1000.0]
+    monkeypatch.setattr(local_db.time, "monotonic", lambda: clock[0])
+    first = local_db._wal_snapshot_path(str(path))
+
+    local_db.note_local_write()
+    assert local_db._wal_snapshot_path(str(path)) == first  # nothing changed yet
+    writer.execute("INSERT INTO items (key) VALUES ('LANDED')")
+    writer.commit()
+    clock[0] += 1
+    assert "LANDED" in _snapshot_keys(local_db._wal_snapshot_path(str(path)))
+
+
+def test_burst_of_reads_without_writes_copies_at_most_once(zotero_like_db, monkeypatch):
+    path, _writer = zotero_like_db
+    monkeypatch.setenv(local_db.DB_SNAPSHOT_MIN_INTERVAL_ENV_VAR, "30")
+    copies = _count_copies(monkeypatch)
+    for _ in range(20):
+        local_db._wal_snapshot_path(str(path))
+    assert copies[0] == 1
 
 
 def test_backend_reader_is_refreshed_when_reused(monkeypatch):
```

**File**: `tests/test_write_client_resolution.py` (modified, +2/-2)
```diff
@@ -186,8 +186,8 @@ def test_resolving_a_write_client_lifts_the_snapshot_throttle(web_mode, monkeypa
     from zotero_mcp import local_db
 
     monkeypatch.setattr(_client, "get_zotero_client", lambda: fake_zot)
-    monkeypatch.setattr(local_db, "_last_write_at", None, raising=False)
+    before = local_db._write_gen
 
     _helpers.resolve_write_client()
 
-    assert local_db._recently_wrote()
+    assert local_db._write_gen == before + 1
```

---

### Incident Patch 2: `ebf68393` (2026-10-04)
**Commit Message**: refactor(tags): drop typed tag input, keep only the #618 bug fix

Remove _normalize_tag_write_input and the list[str | dict] schema and
description changes on zotero_update_item, along with their tests and
the CHANGELOG wording. tags/add_tags go back to plain names; existing
tags still keep their type via _apply_tag_changes and the merge path.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
-- **Automatic tags stay automatic when tags are edited or items merged** (#618). `add_tags`/`remove_tags` on `zotero_update_item` and `zotero_update_annotation`, and the keeper's tags in `zotero_merge_duplicates`, were rebuilt from tag names alone, so automatic tags (e.g. MeSH headings from PubMed) became manual and "Delete Automatic Tags in This Library…" no longer reached them. Existing tags now keep their type, and tags copied from a duplicate keep the duplicate's. `tags=` and `add_tags=` also accept `{tag, type}` objects. Reported by @rizakardas.
+- **Automatic tags stay automatic when tags are edited or items merged** (#618). `add_tags`/`remove_tags` on `zotero_update_item` and `zotero_update_annotation`, and the keeper's tags in `zotero_merge_duplicates`, were rebuilt from tag names alone, so automatic tags (e.g. MeSH headings from PubMed) became manual and "Delete Automatic Tags in This Library…" no longer reached them. Existing tags now keep their type, and tags copied from a duplicate keep the duplicate's. Reported by @rizakardas.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `src/zotero_mcp/tools/_helpers.py` (modified, +2/-49)
```diff
@@ -872,59 +872,12 @@ def _normalize_str_list_input(value, field_name="value"):
     raise ValueError(f"{field_name} must be a list of strings or a string")
 
 
-def _normalize_tag_write_input(value, field_name="tags"):
-    """Normalize a tag argument for a write into Zotero tag dicts.
-
-    Accepts bare names (``"x"``), Zotero tag dicts (``{"tag": "x", "type":
-    1}``), lists mixing both, or the same as a JSON string. ``type`` is kept
-    when given and omitted otherwise (Zotero then stores a manual tag).
-    """
-    if value is None:
-        return []
-    if isinstance(value, dict):
-        value = [value]
-    elif isinstance(value, str):
-        raw = value.strip()
-        if raw[:1] in ("[", "{"):
-            try:
-                parsed = json.loads(raw)
-            except json.JSONDecodeError:
-                parsed = None
-            if isinstance(parsed, list | dict):
-                return _normalize_tag_write_input(parsed, field_name)
-        return [{"tag": t} for t in _normalize_str_list_input(value, field_name)]
-    if not isinstance(value, list | tuple):
-        raise ValueError(f"{field_name} must be a list of strings/tag objects or a string")
-    out: list[dict] = []
-    seen: set[str] = set()
-    for entry in value:
-        if isinstance(entry, dict):
-            name = str(entry.get("tag") or entry.get("name") or "").strip()
-            if not name:
-                continue
-            tag = {"tag": name}
-            if entry.get("type") is not None:
-                if entry["type"] not in (0, 1) or isinstance(entry["type"], bool):
-                    raise ValueError(f"{field_name}: tag type must be 0 or 1, got {entry['type']!r}")
-                tag["type"] = int(entry["type"])
-        else:
-            name = str(entry).strip()
-            if not name:
-                continue
-            tag = {"tag": name}
-        if name in seen:
-            continue
-        seen.add(name)
-        out.append(tag)
-    return out
-
-
 def _apply_tag_changes(existing, add=None, remove=None):
     """Return a new tag list: *existing* kept verbatim (incl. ``type``),
     names in *remove* dropped, and *add* tags not already present appended.
 
-    *add* is a list of tag dicts (see _normalize_tag_write_input); *remove*
-    an iterable of names. Never rebuilds existing tags from their names,
+    *add* is a list of tag dicts (``{"tag": name}``, optionally with
+    ``type``); *remove* an iterable of names. Never rebuilds existing tags from their names,
     which would silently turn automatic (type 1) tags into manual ones.
     """
     remove_set = set(remove or ())
```

**File**: `src/zotero_mcp/tools/annotations.py` (modified, +8/-6)
```diff
@@ -2295,15 +2295,17 @@ def update_annotation(
             changes.append(f"- **color**: {color}")
 
         if tags is not None:
-            new_tags = _helpers._normalize_tag_write_input(tags, "tags")
-            data["tags"] = new_tags
-            changes.append(f"- **tags**: replaced with {[t['tag'] for t in new_tags]}")
+            tag_list = _helpers._normalize_str_list_input(tags, "tags")
+            data["tags"] = [{"tag": t} for t in tag_list]
+            changes.append(f"- **tags**: replaced with {tag_list}")
         elif add_tags is not None or remove_tags is not None:
-            to_add = _helpers._normalize_tag_write_input(add_tags, "add_tags")
+            to_add = _helpers._normalize_str_list_input(add_tags, "add_tags")
             to_remove = set(_helpers._normalize_str_list_input(remove_tags, "remove_tags"))
-            data["tags"] = _helpers._apply_tag_changes(data.get("tags", []), to_add, to_remove)
+            data["tags"] = _helpers._apply_tag_changes(
+                data.get("tags", []), [{"tag": t} for t in to_add], to_remove
+            )
             if add_tags is not None:
-                changes.append(f"- **tags**: added {[t['tag'] for t in to_add]}")
+                changes.append(f"- **tags**: added {to_add}")
             if remove_tags is not None:
                 changes.append(f"- **tags**: removed {list(to_remove)}")
 
```

**File**: `src/zotero_mcp/tools/write.py` (modified, +12/-14)
```diff
@@ -3069,9 +3069,7 @@ def _unknown_fields_error(unknown: list[str], item_type: str) -> str:
         "(overlapping fields kept, type-specific ones dropped). "
         "TAG SEMANTICS (easy to get wrong): tags REPLACES the whole tag "
         "list; add_tags/remove_tags are incremental and preferred. They "
-        "are mutually exclusive with tags. Existing tags keep their type "
-        "(automatic tags stay automatic); tags/add_tags entries may also be "
-        "{tag, type} objects, type 1 = automatic. "
+        "are mutually exclusive with tags. "
         "collections (keys) and collection_names likewise REPLACE "
         "membership — pass collections=[] to clear it; for incremental "
         "moves use zotero_set_item_collections. "
@@ -3088,8 +3086,8 @@ def update_item(
     item_key: str,
     fields: dict | str | None = None,
     creators: list[dict] | str | None = None,
-    tags: list[str | dict] | str | None = None,
-    add_tags: list[str | dict] | str | None = None,
+    tags: list[str] | str | None = None,
+    add_tags: list[str] | str | None = None,
     remove_tags: list[str] | str | None = None,
     collections: list[str] | str | None = None,
     collection_names: list[str] | str | None = None,
@@ -3123,9 +3121,7 @@ def update_item(
             ``fields['creators']``).
         tags / add_tags / remove_tags: mutually exclusive; ``tags``
         REPLACES the full tag list, ``add_tags`` / ``remove_tags`` are
-        incremental. Prefer the incremental forms. ``tags`` / ``add_tags``
-        entries may be names or ``{"tag": name, "type": 0|1}`` objects
-        (type 1 = automatic). Existing tags keep their type.
+        incremental. Prefer the incremental forms.
         collections / collection_names: REPLACE collection memberships;
         for incremental moves use zotero_set_item_collections instead.
         ctx: MCP context.
@@ -3239,17 +3235,19 @@ def update_item(
 
         # Tags
         if tags is not None:
-            new_tags = _helpers._normalize_tag_write_input(tags, "tags")
-            data["tags"] = new_tags
-            changes.append(f"- **tags**: replaced with {[t['tag'] for t in new_tags]}")
+            tag_list = _helpers._normalize_str_list_input(tags, "tags")
+            data["tags"] = [{"tag": t} for t in tag_list]
+            changes.append(f"- **tags**: replaced with {tag_list}")
         elif add_tags is not None or remove_tags is not None:
-            to_add = _helpers._normalize_tag_write_input(add_tags, "add_tags")
+            to_add = _helpers._normalize_str_list_input(add_tags, "add_tags")
             to_remove = set(_helpers._normalize_str_list_input(remove_tags, "remove_tags"))
             # Existing tag dicts are kept verbatim so automatic (type 1)
             # tags stay automatic.
-            data["tags"] = _helpers._apply_tag_changes(data.get("tags", []), to_add, to_remove)
+            data["tags"] = _helpers._apply_tag_changes(
+                data.get("tags", []), [{"tag": t} for t in to_add], to_remove
+            )
             if add_tags is not None:
-                changes.append(f"- **tags**: added {[t['tag'] for t in to_add]}")
+                changes.append(f"- **tags**: added {to_add}")
             if remove_tags is not None:
                 changes.append(f"- **tags**: removed {list(to_remove)}")
 
```

**File**: `tests/test_tag_type_preservation.py` (modified, +1/-19)
```diff
@@ -1,13 +1,11 @@
 """Tag writes must keep existing tag dicts (incl. automatic type 1) verbatim."""
 
-import pytest
-
 from zotero_mcp.tools import _helpers
 
 
 def test_add_keeps_automatic_tags():
     existing = [{"tag": "auto", "type": 1}, {"tag": "manual"}]
-    out = _helpers._apply_tag_changes(existing, _helpers._normalize_tag_write_input(["x"], "add_tags"))
+    out = _helpers._apply_tag_changes(existing, [{"tag": "x"}])
     assert out == [{"tag": "auto", "type": 1}, {"tag": "manual"}, {"tag": "x"}]
 
 
@@ -21,19 +19,3 @@ def test_add_existing_name_does_not_duplicate_or_retype():
     existing = [{"tag": "auto", "type": 1}]
     out = _helpers._apply_tag_changes(existing, [{"tag": "auto"}])
     assert out == [{"tag": "auto", "type": 1}]
-
-
-def test_typed_tag_input_shapes():
-    assert _helpers._normalize_tag_write_input([{"tag": "a", "type": 1}, "b"]) == [
-        {"tag": "a", "type": 1},
-        {"tag": "b"},
-    ]
-    assert _helpers._normalize_tag_write_input('[{"tag": "a", "type": 1}]') == [{"tag": "a", "type": 1}]
-    assert _helpers._normalize_tag_write_input("a, b") == [{"tag": "a"}, {"tag": "b"}]
-    assert _helpers._normalize_tag_write_input(None) == []
-
-
-@pytest.mark.parametrize("bad", [2, -1, 1.5, "1", True])
-def test_tag_type_must_be_0_or_1(bad):
-    with pytest.raises(ValueError, match="tag type must be 0 or 1"):
-        _helpers._normalize_tag_write_input([{"tag": "a", "type": bad}])
```

**File**: `tests/test_update_item.py` (modified, +0/-4)
```diff
@@ -531,10 +531,6 @@ def test_adding_an_existing_name_does_not_retype_it(self, monkeypatch):
         assert {"tag": "MeSH heading", "type": 1} in tags
         assert len(tags) == 2
 
-    def test_add_tags_accepts_tag_objects_with_a_type(self, monkeypatch):
-        tags = self._update_with_typed_tags(monkeypatch, add_tags=[{"tag": "imported", "type": 1}])
-        assert {"tag": "imported", "type": 1} in tags
-
     def test_tags_and_add_tags_mutually_exclusive(self, monkeypatch):
         """Providing both tags= and add_tags= should produce an error."""
         item = _make_item(tags=["x"])
```

---

### Incident Patch 3: `95f593d0` (2026-10-03)
**Commit Message**: fix: keep base-mapped fields when update_item changes item type

Changing journalArticle -> conferencePaper (or webpage -> blogPost, etc.)
dropped publicationTitle/websiteTitle instead of carrying them to the
new type's field for the same Zotero base field.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Changing an item's type keeps type-specific fields**. `zotero_update_item(fields={"item_type": ...})` dropped every field the new type names differently, so turning a journal article into a conference paper lost its `publicationTitle` instead of moving it to `proceedingsTitle`, and the success report did not mention it. Values now carry over through their shared Zotero base field, as in the desktop client.
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
 
```

**File**: `src/zotero_mcp/tools/write.py` (modified, +12/-0)
```diff
@@ -3181,6 +3181,18 @@ def update_item(
                 for k, v in data.items():
                     if k in preserved or k in new_template:
                         reshaped[k] = v
+                # Carry type-specific fields across through their shared base
+                # field (publicationTitle -> proceedingsTitle, websiteTitle ->
+                # blogTitle, ...) the way Zotero desktop does on a type change,
+                # instead of dropping the value.
+                new_fields = set(new_template) | _schema.valid_fields(item_type)
+                for k, v in data.items():
+                    if k in reshaped or v in ("", None):
+                        continue
+                    base = _schema.base_field_of(old_item_type, k)
+                    target = _schema.resolve_field(item_type, base)
+                    if target in new_fields and not reshaped.get(target):
+                        reshaped[target] = v
                 reshaped["itemType"] = item_type
                 data = reshaped
                 item["data"] = data
```

**File**: `tests/test_update_item.py` (modified, +20/-0)
```diff
@@ -1592,6 +1592,26 @@ def test_migrate_journal_article_to_book(self, monkeypatch):
         assert "item_type" in result
         assert "book" in result
 
+    def test_migrate_carries_base_mapped_fields(self, monkeypatch):
+        """journalArticle -> conferencePaper: publicationTitle must land in
+        proceedingsTitle (same base field), as Zotero desktop does, not be
+        silently dropped."""
+        item = _make_item(publication_title="Proc. of FooConf")
+        fake = FakeZoteroForUpdate(items=[item])
+        monkeypatch.setattr("zotero_mcp.tools._helpers._get_write_client",
+                            lambda ctx: (fake, fake))
+
+        server.update_item(
+            item_key="ABCD1234",
+            fields={"item_type": "conferencePaper"},
+            ctx=DummyContext(),
+        )
+
+        d = fake.update_calls[0]["data"]
+        assert d["itemType"] == "conferencePaper"
+        assert d.get("proceedingsTitle") == "Proc. of FooConf"
+        assert "publicationTitle" not in d
+
     def test_migrate_preserves_tags_and_collections(self, monkeypatch):
         item = _make_item(
             tags=["keep-me", "also-me"],
```

---

### Incident Patch 4: `f3266798` (2026-10-03)
**Commit Message**: fix(merge): compare linked-file attachments by path before skipping them

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **Merging duplicates no longer trashes distinct linked-file attachments.** `zotero_merge_duplicates` skips a duplicate's attachment when the keeper "already has" it, but the check compared only content type, filename, md5 and URL. Linked-file PDFs carry none of the last three, so any linked PDF on a duplicate matched any linked PDF on the keeper, stayed behind, and went to the Trash with the duplicate. Attachments are now compared by link mode and path as well, and one with no md5, path or URL is never treated as a duplicate.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `src/zotero_mcp/tools/write.py` (modified, +13/-2)
```diff
@@ -3618,12 +3618,22 @@ def _render_skipped(skipped: list[tuple], heading: str) -> list[str]:
     return lines
 
 
-def _attachment_sig(data: dict) -> tuple:
-    """Identity of an attachment for "the keeper already has this one" checks."""
+def _attachment_sig(data: dict) -> tuple | None:
+    """Identity of an attachment for "the keeper already has this one" checks.
+
+    Returns None when the attachment carries nothing that identifies its
+    content (no md5, path or url) — e.g. linked-file PDFs, which have no
+    filename or md5. Such attachments must never be treated as duplicates,
+    or a distinct file is left on the duplicate and trashed with it.
+    """
+    if not (data.get("md5") or data.get("path") or data.get("url")):
+        return None
     return (
+        data.get("linkMode", ""),
         data.get("contentType", ""),
         data.get("filename", ""),
         data.get("md5", ""),
+        data.get("path", ""),
         data.get("url", ""),
     )
 
@@ -3694,6 +3704,7 @@ def _merge_plan(write_zot, keeper_key: str, dup_keys: list[str]) -> dict:
         for kc in keeper_children
         if kc.get("data", {}).get("itemType") == "attachment"
     }
+    keeper_attachment_sigs.discard(None)
     skipped_attachment_count = sum(
         1
         for dup in duplicates
```

---

### Incident Patch 5: `216ce931` (2026-10-03)
**Commit Message**: fix(identifiers): percent-decode the DOI in a doi.org URL

normalize_doi kept a URL's %28/%3C/%2F escapes, so a DOI copied from a
browser address bar never matched or resolved as the bare DOI.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **Percent-encoded doi.org URLs are read as the DOI they name.** A DOI URL copied from a browser's address bar, such as `https://doi.org/10.1002/%28SICI%291097-4636...`, kept its `%28`/`%3C` escapes through `normalize_doi`, so the add tools looked up a DOI that does not exist and duplicate detection treated it as different from the same DOI written plainly. The URL path is now percent-decoded; a bare DOI is left as written.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `src/zotero_mcp/identifiers.py` (modified, +7/-3)
```diff
@@ -22,6 +22,7 @@
 import html
 import re
 import unicodedata
+from urllib.parse import unquote
 
 __all__ = [
     "normalize_doi",
@@ -38,8 +39,10 @@
 #: A well-formed DOI: the ``10.NNNN`` registrant prefix plus a suffix.
 DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")
 
+#: The DOI in a doi.org URL path, still percent-encoded: browsers encode
+#: the brackets of SICI DOIs, and some tools encode the prefix's slash.
 _DOI_IN_URL_RE = re.compile(
-    r"doi\.org/(10\.\d{4,9}/[^\s?#]+)", flags=re.IGNORECASE
+    r"doi\.org/(10\.\d{4,9}(?:/|%2F)[^\s?#]+)", flags=re.IGNORECASE
 )
 
 #: Punctuation that trails a DOI copied out of prose or a reference list.
@@ -70,7 +73,7 @@ def normalize_doi(raw):
     """Normalize a DOI string from various input formats.
 
     Accepts a bare DOI, a ``doi:`` prefixed form, or a ``doi.org`` /
-    ``dx.doi.org`` URL, and strips trailing punctuation picked up from
+    ``dx.doi.org`` URL (percent-decoding its path), and strips trailing punctuation picked up from
     surrounding prose (brackets the DOI itself opened are kept). Returns
     the canonical bare DOI, or ``None`` when the input is not a DOI.
 
@@ -86,7 +89,8 @@ def normalize_doi(raw):
         m = _DOI_IN_URL_RE.search(s)
         if not m:
             return None
-        s = m.group(1)
+        # Decoded only here: a URL path is percent-encoded, a bare DOI is not.
+        s = unquote(m.group(1))
     s = _strip_trailing_punct(s)
     if DOI_RE.match(s):
         return s
```

---

### Incident Patch 6: `71318897` (2026-10-03)
**Commit Message**: fix(extract): fall back to the PDF text layer when markdown extraction is empty (#611)

Scanner OCR layers (Xerox/ABBYY) come back from extract_pages_markdown as
empty pages flagged needs_ocr, and some Ghostscript/PDFCreator files make it
raise, although pdf_inspector.extract_text returns the text. Use that as a
whole-document fallback when the request covers the document.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **PDFs with a scanner OCR text layer are no longer indexed metadata-only** (#611). Files from Xerox or ABBYY scanners carry their text as an invisible layer over a page image, and pdf-inspector's markdown pass returned nothing for every page; Ghostscript and PDFCreator output could make it fail outright. Extraction now falls back to pdf-inspector's plain-text pass when the markdown pass yields no text or raises. That pass cannot be split by page, so the text is attributed to the first page and a `max_pages` cap is applied as the same share of the text; an explicit page subset (as in `zotero_read_pdf_pages`) is unchanged. Reported by @timmyfaraday.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `src/zotero_mcp/extract.py` (modified, +68/-1)
```diff
@@ -171,10 +171,43 @@ def extract_pdf(
         wanted = None
         total = None
 
-    result = pdf_inspector.extract_pages_markdown(path, pages=wanted)
+    # The text-layer fallback is whole-document, so it can't stand in for an
+    # explicit subset of pages; a max_pages head is capped proportionally.
+    can_fall_back = pages is None or len(set(wanted)) == total
+
+    try:
+        result = pdf_inspector.extract_pages_markdown(path, pages=wanted)
+    except Exception as exc:
+        # Some producers (Ghostscript / PDFCreator) emit content streams the
+        # markdown pass rejects while the plain-text pass reads them (#611).
+        fallback = can_fall_back and _text_layer_fallback(
+            pdf_inspector, path, wanted=wanted, total=total, truncated=truncated,
+        )
+        if not fallback:
+            raise
+        logger.info(
+            "pdf-inspector markdown failed for %s (%s); used the text layer",
+            path, exc,
+        )
+        return fallback
+
     if total is None:
         total = len(result.pages)
 
+    # Scanner OCR layers (invisible text over a page image, as written by
+    # Xerox/ABBYY devices) come back as empty markdown with needs_ocr on every
+    # page, although the plain-text pass returns that layer (#611).
+    if (
+        can_fall_back
+        and result.pages
+        and not any((page.markdown or "").strip() for page in result.pages)
+    ):
+        fallback = _text_layer_fallback(
+            pdf_inspector, path, wanted=wanted, total=total, truncated=truncated,
+        )
+        if fallback is not None:
+            return fallback
+
     return _doc_from_pages(
         [page.markdown or "" for page in result.pages],
         page_count=total,
@@ -188,6 +221,40 @@ def extract_pdf(
     )
 
 
+def _text_layer_fallback(
+    pdf_inspector, path: str, *, wanted: list[int] | None,
+    total: int | None, truncated: bool,
+) -> ExtractedDoc | None:
+    """Recover a PDF's text layer when the markdown pass yields nothing.
+
+    pdf-inspector's ``extract_text`` is whole-document only (its per-page and
+    positional APIs skip invisible text), so the result is one page attributed
+    to the first page requested. Under a ``max_pages`` cap the text is cut to
+    the same share of the document, so the indexer's limit still holds.
+    Returns ``None`` when there is no text layer either.
+    """
+    try:
+        text = pdf_inspector.extract_text(path) or ""
+    except Exception:
+        return None
+    if not text.strip():
+        return None
+    # The separator must only ever mark page boundaries.
+    text = text.replace(PAGE_SEPARATOR, "\n")
+    if total is None:
+        try:
+            total = pdf_page_count(path)
+        except Exception:
+            total = 1
+    if truncated and wanted and total:
+        text = text[: len(text) * len(wanted) // total]
+    first = wanted[0] if wanted else 0
+    return _doc_from_pages(
+        [text], page_count=total, source="pdf",
+        page_numbers=(first,), truncated=truncated,
+    )
+
+
 def _read_text(file_path: str | Path) -> str:
     """Decode an attachment to text with uniform newlines.
 
```

---

### Incident Patch 7: `5f46e820` (2026-10-03)
**Commit Message**: fix(semantic): write chunked passages before pruning stale ones; hold watermark on failed items (#610)

Upsert an item's new passages first, then delete only chunk_index >= n
plus any legacy bare-KEY doc, so a failed embed leaves the old passages
searchable. Do not promote the sync watermark when items still failed
after the end-of-run retry. Open the update lock with "a" so a losing
process no longer truncates the holder's PID.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **A failed re-embed no longer deletes an item's passages** (#610). With passage chunking on, an item's old passages were deleted before its new ones were embedded, so an embedding error (provider down, timeout, the MCP client closing mid-run) left the item unsearchable. New passages are now written first and only the stale tail is pruned afterwards. A run where items still failed after the end-of-run retry also no longer advances the sync watermark, so incremental updates pick those items up again instead of skipping them until they next change in Zotero. The update lock file is no longer truncated by a process that fails to acquire it, so the holder's PID stays readable.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `src/zotero_mcp/chroma_client.py` (modified, +15/-0)
```diff
@@ -349,6 +349,21 @@ def delete_item_chunks(self, item_key: str, group_id: int | None = None) -> None
         except Exception as e:
             logger.warning(f"delete_item_chunks({item_key}) failed: {e}")
 
+    def prune_item_chunks(self, item_key: str, keep: int) -> None:
+        """Delete an item's passages from ``chunk_index >= keep`` onward.
+
+        Called after an item's new passages ``<item_key>#0..keep-1`` have been
+        upserted, so a document that shrank leaves no orphaned tail, while a
+        failed re-embed leaves the old passages searchable instead of none.
+        Also drops a bare ``<item_key>`` document left by a pre-chunking index.
+        """
+        where = {"$and": [{"parent_item_key": item_key}, {"chunk_index": {"$gte": int(keep)}}]}
+        try:
+            self.collection.delete(where=where)
+            self.collection.delete(ids=[item_key])
+        except Exception as e:
+            logger.warning(f"prune_item_chunks({item_key}) failed: {e}")
+
     def get_collection_info(self) -> dict[str, Any]:
         """Get information about the collection."""
         try:
```

**File**: `src/zotero_mcp/semantic_search.py` (modified, +32/-13)
```diff
@@ -280,7 +280,9 @@ def _acquire_update_lock(lock_path: Path):
     ensure_private_dir(lock_path.parent)
     fd = None
     try:
-        fd = open(lock_path, "w")
+        # "a" not "w": a process that loses the race must not truncate the
+        # holder's pid before flock fails. We truncate after acquiring.
+        fd = open(lock_path, "a")
         try:
             fcntl.flock(fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
         except BlockingIOError:
@@ -379,7 +381,7 @@ def _split_prepared_into_requests(prepared: dict[str, Any], request_batch_size:
     ``request_batch_size`` when a single item contributed more chunks than
     that, which is deliberate: an item whose chunks were spread across two
     independently committed requests could end up half-indexed if one of them
-    failed, and ``delete_item_chunks`` runs once per item at preparation time.
+    failed, and stale passages are pruned per item after each successful write.
     """
     documents = prepared["documents"]
     metadatas = prepared["metadatas"]
@@ -2942,6 +2944,7 @@ def _report_item_progress(item: dict[str, Any]) -> None:
                     )
 
             # Retry any documents that failed during the main run
+            retry_fail = 0
             if _failed_docs:
                 try:
                     sys.stderr.write(f"\r{' ' * _term_width(120)}\r")
@@ -2954,10 +2957,10 @@ def _report_item_progress(item: dict[str, Any]) -> None:
                 _retry_time.sleep(1)  # Brief pause before retry
 
                 retry_ok = 0
-                retry_fail = 0
                 for doc, meta, doc_id in _failed_docs:
                     try:
                         self.chroma_client.upsert_documents([doc], [meta], [doc_id])
+                        self._prune_stale_chunks([meta])
                         retry_ok += 1
                         stats["errors"] -= 1  # Remove from error count
                         # Don't classify as added vs updated — when the
@@ -2993,8 +2996,11 @@ def _report_item_progress(item: dict[str, Any]) -> None:
             # run would take the unchanged-version early return and never
             # re-enter deletion detection, so the documented rerun with
             # --allow-mass-deletion would silently do nothing.
+            # Likewise when items still failed after the retry (#610): in
+            # incremental mode they would never appear in a later
+            # item_versions(since=...) result, so they would stay unindexed.
             self.update_config["last_update"] = datetime.now().isoformat()
-            if stats.get("deletion_skipped_reason"):
+            if stats.get("deletion_skipped_reason") or retry_fail:
                 self._save_update_config()
             else:
                 self._save_update_config(
@@ -3121,22 +3127,16 @@ def _prepare_and_classify_slice(
                 logger.error(f"Error processing item {item.get('key', 'unknown')}: {e}")
                 stats["errors"] += 1
 
-        # Which items already existed (drives added-vs-updated). When chunking,
-        # also clear an item's stale passages before re-adding so a shrinking
-        # document never leaves orphaned chunks behind.
+        # Which items already existed (drives added-vs-updated). Stale
+        # passages are pruned only after the new ones are written
+        # (_prune_stale_chunks), so a failed embed never loses an item (#610).
         existing_item_keys: set[str] = set()
         if documents and not force_rebuild:
             with self._chroma_call_lock:
                 if chunking:
                     probe_ids = [f"{k}#0" for k in item_keys_order]
                     existing_chunk0 = self.chroma_client.get_existing_ids(probe_ids)
                     existing_item_keys = {cid.split("#", 1)[0] for cid in existing_chunk0}
-                    if hasattr(self.chroma_client, "delete_item_chunks"):
-                        for k in dict.fromkeys(item_keys_order):
-                            try:
-                                self.chroma_client.delete_item_chunks(k)
-                            except Exception as e:
-                                logger.debug(f"delete_item_chunks({k}) failed: {e}")
                 else:
                     existing_item_keys = self.chroma_client.get_existing_ids(ids)
 
@@ -3282,6 +3282,7 @@ def flush() -> None:
                     self.chroma_client.upsert_embeddings(
                         write_docs, write_metas, write_ids, write_vectors
                     )
+                    self._prune_stale_chunks(write_metas)
             except Exception as exc:
                 logger.warning(f"Batch upsert failed ({exc}), saving for retry")
                 record_failures(write_docs, write_metas, write_ids)
@@ -3385,6 +3386,23 @@ def _drain_stream_queues(queues, threads, timeout: float = 5.0) -> None:
                     pass
             time.sleep(0.05)
 
+    def _prune_stale_chunks(self, metadatas: list[dict[str, Any]]
```

**File**: `tests/test_streaming_indexing.py` (modified, +4/-0)
```diff
@@ -86,6 +86,9 @@ def get_existing_ids(self, ids):
     def delete_item_chunks(self, item_key, group_id=None):
         self.deleted_item_keys.append(item_key)
 
+    def prune_item_chunks(self, item_key, keep):
+        self.deleted_item_keys.append(item_key)
+
     def upsert_documents(self, documents, metadatas, ids):
         self.document_batches.append((list(documents), list(metadatas), list(ids)))
 
@@ -447,6 +450,7 @@ def test_chunked_streaming_keeps_accounting_per_item(monkeypatch):
     assert chroma.embedding_batches, "streaming path did not run"
     assert stats["updated_items"] == 1
     assert stats["added_items"] == 5
+    # Stale tail pruned after the write (#610).
     assert "ITEM0000" in chroma.deleted_item_keys
 
     committed = committed_ids(chroma)
```

---

### Incident Patch 8: `ca1853cf` (2026-10-03)
**Commit Message**: fix(libraries): accept the listed personal library id in switch_library (#603)

zotero_list_libraries shows the personal library by its SQLite libraryID
in local mode, but zotero_switch_library only accepted "0". Accept "0",
"user", or the user library's libraryID there and store it as "0"; in
web mode map "user"/"0" to ZOTERO_LIBRARY_ID. Fix the description that
called the id "libraryID=1 conventionally".

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **Switching to the personal library by the id `zotero_list_libraries` shows now works** (#603). In local mode the listing showed the personal library as `libraryID=1`, but `zotero_switch_library` only accepted `0` for `library_type='user'`, so the list-then-switch workflow the tool descriptions recommend always failed. Local mode now accepts `0`, `user`, or the personal library's listed libraryID (other ids are still rejected), and web mode maps `user`/`0` to the configured `ZOTERO_LIBRARY_ID`. Reported by @mronkko.
 
 ## [0.13.1] - 2026-09-23
 
```

**File**: `src/zotero_mcp/tools/retrieval.py` (modified, +22/-6)
```diff
@@ -1019,7 +1019,7 @@ def get_tags(
     name="zotero_list_libraries",
     description=(
         "List every Zotero library this MCP can address: the user's "
-        "personal library (libraryID=1 conventionally), all group "
+        "personal library (switch to it with library_type='user'), all group "
         "libraries the user is a member of (with groupID), and (in "
         "local mode) RSS feed libraries. Each entry shows the "
         "library/group ID, display name, and item count. "
@@ -1079,7 +1079,8 @@ def list_libraries(*, ctx: Context) -> str:
                     for lib in user_libs:
                         output.append(
                             f"- **My Library** — {lib['itemCount']} items "
-                            f"(libraryID={lib['libraryID']})"
+                            f"(libraryID={lib['libraryID']}; switch with "
+                            f"library_type='user')"
                         )
                     output.append("")
 
@@ -1155,7 +1156,7 @@ def list_libraries(*, ctx: Context) -> str:
         "first; don't guess. "
         "library_id: library ID string as returned by "
         "zotero_list_libraries (numeric for user/group, numeric for "
-        "feeds). "
+        "feeds); for the personal library 'user' or '0' also work. "
         "library_type: 'user' — the personal library; 'group' (default) "
         "— a group library; 'feeds' — a local RSS feed library; "
         "'default' — RESET to whatever the ZOTERO_LIBRARY_ID / "
@@ -1180,7 +1181,8 @@ def switch_library(
 
     Args:
         library_id: The library/group ID to switch to.
-            For user library: "0" (local mode) or your user ID (web mode).
+            For user library: "0" or "user"; in local mode also the
+            libraryID zotero_list_libraries shows; in web mode your user ID.
             For group libraries: the groupID (e.g. "6069773").
         library_type: "user", "group", or "default" to reset to env var defaults.
         ctx: MCP context
@@ -1203,6 +1205,15 @@ def switch_library(
         if error:
             return error
 
+        if library_type == "user":
+            # #603: "user", "0" and (local mode) the SQLite libraryID that
+            # zotero_list_libraries shows all name the one personal library.
+            local = os.getenv("ZOTERO_LOCAL", "").lower() in ["true", "yes", "1"]
+            if local:
+                library_id = "0"
+            elif library_id in ("user", "0", "") and os.getenv("ZOTERO_LIBRARY_ID"):
+                library_id = os.getenv("ZOTERO_LIBRARY_ID")
+
         _client.set_active_library(library_id, library_type)
         ctx.info(f"Switched to library {library_id} (type={library_type})")
 
@@ -1272,10 +1283,15 @@ def validate_library_switch(library_id: str, library_type: str) -> str | None:
                     # serving reads, so the check has to live here instead.
                     # A local database holds exactly one personal library,
                     # addressed as "0" by convention (see get_zotero_client).
-                    if library_id not in ("0", "", None):
+                    # zotero_list_libraries shows its SQLite libraryID, so
+                    # accept that too (#603).
+                    valid_ids = {"0", "", "user"} | {
+                        str(library["libraryID"]) for library in libraries if library["type"] == "user"
+                    }
+                    if library_id not in valid_ids and library_id is not None:
                         return (
                             f"Personal library id '{library_id}' is not addressable "
-                            f"in local mode. Use '0', or switch to a group with "
+                            f"in local mode. Use '0' or 'user', or switch to a group with "
                             f"library_type='group'."
                         )
                 elif library_type == "feed":
```

**File**: `tests/test_switch_library_personal_id.py` (modified, +1/-1)
```diff
@@ -8,8 +8,8 @@
 import types
 
 import pytest
-
 from conftest import DummyContext
+
 from zotero_mcp import client as _client
 from zotero_mcp.tools import retrieval
 
```

---

### Incident Patch 9: `54b3b477` (2026-10-03)
**Commit Message**: docs(changelog): SQLite tag type fix (#620)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **Automatic tags read as automatic in local mode** (#620). Items read from `zotero.sqlite` listed every tag without its type, so `zotero_get_item_metadata(format="json")` and other reads showed automatic tags as manual, unlike the Zotero API. They now carry `"type": 1`.
 
 ## [0.13.1] - 2026-09-23
 
```

---

### Incident Patch 10: `a0cf426f` (2026-10-03)
**Commit Message**: fix(sqlite): report automatic tags as automatic on read (#620)

_fetch_tags selected only the tag name, so every item read through the
SQLite backend (the default in local mode) listed its automatic tags as
manual. Select itemTags.type and mark automatic tags with "type": 1, as
Zotero's API does; manual tags keep no type key.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/zotero_mcp/local_db.py` (modified, +7/-2)
```diff
@@ -2332,7 +2332,7 @@ def _fetch_tags(self, conn: sqlite3.Connection, item_ids: list[int]) -> dict[int
         placeholders = ",".join("?" * len(item_ids))
         rows = conn.execute(
             f"""
-            SELECT itg.itemID, t.name
+            SELECT itg.itemID, t.name, itg.type
             FROM itemTags itg
             JOIN tags t ON itg.tagID = t.tagID
             WHERE itg.itemID IN ({placeholders})
@@ -2341,7 +2341,12 @@ def _fetch_tags(self, conn: sqlite3.Connection, item_ids: list[int]) -> dict[int
         ).fetchall()
         result: dict[int, list[dict]] = {}
         for row in rows:
-            result.setdefault(row["itemID"], []).append({"tag": row["name"]})
+            # As Zotero's API does: "type": 1 marks an automatic tag, and the
+            # key is left out for a manual one.
+            tag = {"tag": row["name"]}
+            if row["type"]:
+                tag["type"] = row["type"]
+            result.setdefault(row["itemID"], []).append(tag)
         return result
 
     def _hydrate_rows(self, conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[dict]:
```

---

### Incident Patch 11: `ce473c94` (2026-10-03)
**Commit Message**: docs(changelog): tag type fix (#618)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **Automatic tags stay automatic when tags are edited or items merged** (#618). `add_tags`/`remove_tags` on `zotero_update_item` and `zotero_update_annotation`, and the keeper's tags in `zotero_merge_duplicates`, were rebuilt from tag names alone, so automatic tags (e.g. MeSH headings from PubMed) became manual and "Delete Automatic Tags in This Library…" no longer reached them. Existing tags now keep their type, and tags copied from a duplicate keep the duplicate's. `tags=` and `add_tags=` also accept `{tag, type}` objects. Reported by @rizakardas.
 
 ## [0.13.1] - 2026-09-23
 
```

---

### Incident Patch 12: `0a1b0d62` (2026-10-03)
**Commit Message**: fix(tags): keep each tag's type on incremental edits and merges (#618)

update_item and update_annotation rebuilt the tag list from tag names
alone on add_tags/remove_tags, and _execute_merge did the same for the
keeper, so every automatic tag (type 1) came back as a manual one.

Existing tag objects are now kept as they are; only removed names are
dropped and only new names appended (_helpers._apply_tag_changes, the
pattern batch_update_tags already used). A merge copies each duplicate's
tag object, so its type comes along; when duplicates disagree, the tag is
merged as manual, which 'Delete Automatic Tags' never removes.

tags= and add_tags= on update_item also accept {tag, type} objects, so a
caller can write an automatic tag or round-trip a tag list. tags= still
replaces the whole list.

Reported by @rizakardas.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/zotero_mcp/tools/_helpers.py` (modified, +68/-0)
```diff
@@ -872,6 +872,74 @@ def _normalize_str_list_input(value, field_name="value"):
     raise ValueError(f"{field_name} must be a list of strings or a string")
 
 
+def _normalize_tag_write_input(value, field_name="tags"):
+    """Normalize a tag argument for a write into Zotero tag dicts.
+
+    Accepts bare names (``"x"``), Zotero tag dicts (``{"tag": "x", "type":
+    1}``), lists mixing both, or the same as a JSON string. ``type`` is kept
+    when given and omitted otherwise (Zotero then stores a manual tag).
+    """
+    if value is None:
+        return []
+    if isinstance(value, dict):
+        value = [value]
+    elif isinstance(value, str):
+        raw = value.strip()
+        if raw[:1] in ("[", "{"):
+            try:
+                parsed = json.loads(raw)
+            except json.JSONDecodeError:
+                parsed = None
+            if isinstance(parsed, list | dict):
+                return _normalize_tag_write_input(parsed, field_name)
+        return [{"tag": t} for t in _normalize_str_list_input(value, field_name)]
+    if not isinstance(value, list | tuple):
+        raise ValueError(f"{field_name} must be a list of strings/tag objects or a string")
+    out: list[dict] = []
+    seen: set[str] = set()
+    for entry in value:
+        if isinstance(entry, dict):
+            name = str(entry.get("tag") or entry.get("name") or "").strip()
+            if not name:
+                continue
+            tag = {"tag": name}
+            if entry.get("type") is not None:
+                if entry["type"] not in (0, 1) or isinstance(entry["type"], bool):
+                    raise ValueError(f"{field_name}: tag type must be 0 or 1, got {entry['type']!r}")
+                tag["type"] = int(entry["type"])
+        else:
+            name = str(entry).strip()
+            if not name:
+                continue
+            tag = {"tag": name}
+        if name in seen:
+            continue
+        seen.add(name)
+        out.append(tag)
+    return out
+
+
+def _apply_tag_changes(existing, add=None, remove=None):
+    """Return a new tag list: *existing* kept verbatim (incl. ``type``),
+    names in *remove* dropped, and *add* tags not already present appended.
+
+    *add* is a list of tag dicts (see _normalize_tag_write_input); *remove*
+    an iterable of names. Never rebuilds existing tags from their names,
+    which would silently turn automatic (type 1) tags into manual ones.
+    """
+    remove_set = set(remove or ())
+    result = [
+        dict(t) for t in (existing or [])
+        if isinstance(t, dict) and t.get("tag") not in remove_set
+    ]
+    present = {t.get("tag") for t in result}
+    for t in add or ():
+        if t["tag"] not in present and t["tag"] not in remove_set:
+            result.append(dict(t))
+            present.add(t["tag"])
+    return result
+
+
 def _normalize_tag_filter(value):
     """Normalize a tag-filter argument into a list[str] for pyzotero.
 
```

**File**: `src/zotero_mcp/tools/annotations.py` (modified, +7/-12)
```diff
@@ -2295,22 +2295,17 @@ def update_annotation(
             changes.append(f"- **color**: {color}")
 
         if tags is not None:
-            tag_list = _helpers._normalize_str_list_input(tags, "tags")
-            data["tags"] = [{"tag": t} for t in tag_list]
-            changes.append(f"- **tags**: replaced with {tag_list}")
+            new_tags = _helpers._normalize_tag_write_input(tags, "tags")
+            data["tags"] = new_tags
+            changes.append(f"- **tags**: replaced with {[t['tag'] for t in new_tags]}")
         elif add_tags is not None or remove_tags is not None:
-            existing = {t["tag"] for t in data.get("tags", [])}
+            to_add = _helpers._normalize_tag_write_input(add_tags, "add_tags")
+            to_remove = set(_helpers._normalize_str_list_input(remove_tags, "remove_tags"))
+            data["tags"] = _helpers._apply_tag_changes(data.get("tags", []), to_add, to_remove)
             if add_tags is not None:
-                to_add = _helpers._normalize_str_list_input(add_tags, "add_tags")
-                existing.update(to_add)
-                changes.append(f"- **tags**: added {to_add}")
+                changes.append(f"- **tags**: added {[t['tag'] for t in to_add]}")
             if remove_tags is not None:
-                to_remove = set(
-                    _helpers._normalize_str_list_input(remove_tags, "remove_tags")
-                )
-                existing -= to_remove
                 changes.append(f"- **tags**: removed {list(to_remove)}")
-            data["tags"] = [{"tag": t} for t in sorted(existing)]
 
         if not changes:
             return "No changes to apply."
```

**File**: `src/zotero_mcp/tools/write.py` (modified, +34/-17)
```diff
@@ -3069,7 +3069,9 @@ def _unknown_fields_error(unknown: list[str], item_type: str) -> str:
         "(overlapping fields kept, type-specific ones dropped). "
         "TAG SEMANTICS (easy to get wrong): tags REPLACES the whole tag "
         "list; add_tags/remove_tags are incremental and preferred. They "
-        "are mutually exclusive with tags. "
+        "are mutually exclusive with tags. Existing tags keep their type "
+        "(automatic tags stay automatic); tags/add_tags entries may also be "
+        "{tag, type} objects, type 1 = automatic. "
         "collections (keys) and collection_names likewise REPLACE "
         "membership — pass collections=[] to clear it; for incremental "
         "moves use zotero_set_item_collections. "
@@ -3086,8 +3088,8 @@ def update_item(
     item_key: str,
     fields: dict | str | None = None,
     creators: list[dict] | str | None = None,
-    tags: list[str] | str | None = None,
-    add_tags: list[str] | str | None = None,
+    tags: list[str | dict] | str | None = None,
+    add_tags: list[str | dict] | str | None = None,
     remove_tags: list[str] | str | None = None,
     collections: list[str] | str | None = None,
     collection_names: list[str] | str | None = None,
@@ -3121,7 +3123,9 @@ def update_item(
             ``fields['creators']``).
         tags / add_tags / remove_tags: mutually exclusive; ``tags``
         REPLACES the full tag list, ``add_tags`` / ``remove_tags`` are
-        incremental. Prefer the incremental forms.
+        incremental. Prefer the incremental forms. ``tags`` / ``add_tags``
+        entries may be names or ``{"tag": name, "type": 0|1}`` objects
+        (type 1 = automatic). Existing tags keep their type.
         collections / collection_names: REPLACE collection memberships;
         for incremental moves use zotero_set_item_collections instead.
         ctx: MCP context.
@@ -3235,20 +3239,19 @@ def update_item(
 
         # Tags
         if tags is not None:
-            tag_list = _helpers._normalize_str_list_input(tags, "tags")
-            data["tags"] = [{"tag": t} for t in tag_list]
-            changes.append(f"- **tags**: replaced with {tag_list}")
+            new_tags = _helpers._normalize_tag_write_input(tags, "tags")
+            data["tags"] = new_tags
+            changes.append(f"- **tags**: replaced with {[t['tag'] for t in new_tags]}")
         elif add_tags is not None or remove_tags is not None:
-            existing = {t["tag"] for t in data.get("tags", [])}
+            to_add = _helpers._normalize_tag_write_input(add_tags, "add_tags")
+            to_remove = set(_helpers._normalize_str_list_input(remove_tags, "remove_tags"))
+            # Existing tag dicts are kept verbatim so automatic (type 1)
+            # tags stay automatic.
+            data["tags"] = _helpers._apply_tag_changes(data.get("tags", []), to_add, to_remove)
             if add_tags is not None:
-                to_add = _helpers._normalize_str_list_input(add_tags, "add_tags")
-                existing.update(to_add)
-                changes.append(f"- **tags**: added {to_add}")
+                changes.append(f"- **tags**: added {[t['tag'] for t in to_add]}")
             if remove_tags is not None:
-                to_remove = set(_helpers._normalize_str_list_input(remove_tags, "remove_tags"))
-                existing -= to_remove
                 changes.append(f"- **tags**: removed {list(to_remove)}")
-            data["tags"] = [{"tag": t} for t in sorted(existing)]
 
         # Collections — REPLACE membership (matches tags semantics and the
         # docstring contract). For incremental moves use
@@ -3681,9 +3684,19 @@ def _merge_plan(write_zot, keeper_key: str, dup_keys: list[str]) -> dict:
     all_collections = set(keeper_data.get("collections", []))
     total_children_to_move = 0
 
+    # One tag object per name from the duplicates, so a tag copied to the
+    # keeper keeps its type. If the duplicates disagree, manual (type 0) wins:
+    # "Delete Automatic Tags" never removes a manual tag.
+    dup_tag_objects: dict[str, dict] = {}
     for dup in duplicates:
         dup_data = dup["item"].get("data", {})
-        all_tags.update(t.get("tag", "") for t in dup_data.get("tags", []))
+        for t in dup_data.get("tags", []):
+            name = t.get("tag", "")
+            all_tags.add(name)
+            if t.get("type"):
+                dup_tag_objects.setdefault(name, {"tag": name, "type": t["type"]})
+            else:
+                dup_tag_objects[name] = {"tag": name}
         all_collections.update(dup_data.get("collections", []))
         total_children_to_move += len(dup["children"])
 
@@ -3710,6 +3723,7 @@ def _merge_plan(write_zot, keeper_key: str, dup_keys: list[str]) -> dict:
         "dup_keys": list(dup_keys),
         "all_tags": all_tags,
         "new_tags": all_tags - keeper_tags,
+        "dup_tag_objects": dup_tag_objects,
         "new_collections": all_collections - set(keeper_data
```

**File**: `tests/test_tag_type_preservation.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+"""Tag writes must keep existing tag dicts (incl. automatic type 1) verbatim."""
+
+import pytest
+
+from zotero_mcp.tools import _helpers
+
+
+def test_add_keeps_automatic_tags():
+    existing = [{"tag": "auto", "type": 1}, {"tag": "manual"}]
+    out = _helpers._apply_tag_changes(existing, _helpers._normalize_tag_write_input(["x"], "add_tags"))
+    assert out == [{"tag": "auto", "type": 1}, {"tag": "manual"}, {"tag": "x"}]
+
+
+def test_remove_keeps_other_types():
+    existing = [{"tag": "auto", "type": 1}, {"tag": "gone", "type": 1}]
+    out = _helpers._apply_tag_changes(existing, [], {"gone"})
+    assert out == [{"tag": "auto", "type": 1}]
+
+
+def test_add_existing_name_does_not_duplicate_or_retype():
+    existing = [{"tag": "auto", "type": 1}]
+    out = _helpers._apply_tag_changes(existing, [{"tag": "auto"}])
+    assert out == [{"tag": "auto", "type": 1}]
+
+
+def test_typed_tag_input_shapes():
+    assert _helpers._normalize_tag_write_input([{"tag": "a", "type": 1}, "b"]) == [
+        {"tag": "a", "type": 1},
+        {"tag": "b"},
+    ]
+    assert _helpers._normalize_tag_write_input('[{"tag": "a", "type": 1}]') == [{"tag": "a", "type": 1}]
+    assert _helpers._normalize_tag_write_input("a, b") == [{"tag": "a"}, {"tag": "b"}]
+    assert _helpers._normalize_tag_write_input(None) == []
+
+
+@pytest.mark.parametrize("bad", [2, -1, 1.5, "1", True])
+def test_tag_type_must_be_0_or_1(bad):
+    with pytest.raises(ValueError, match="tag type must be 0 or 1"):
+        _helpers._normalize_tag_write_input([{"tag": "a", "type": bad}])
```

---

### Incident Patch 13: `a9315d54` (2026-10-03)
**Commit Message**: docs(changelog): read-after-write fix (#228)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **A read right after a write sees the write** (#228). In local mode the database copy that reads use is refreshed at most every `ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL` seconds, and a write tool's own read just before writing usually used up that window, so `zotero_get_item_metadata` after `zotero_set_item_collections`, or `zotero_get_annotations` after `zotero_create_annotation`, still showed the old state. For two minutes after zotero-mcp writes, the copy is refreshed whenever the database has changed.
 
 ## [0.13.1] - 2026-09-23
 
```

---

### Incident Patch 14: `3c8844c7` (2026-10-03)
**Commit Message**: fix(local-db): a read right after our own write sees it (#228)

The WAL snapshot is recopied at most once per
ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL (5 s). A write tool usually reads the
item just before writing, which refreshes the copy; the read that follows
the write then falls inside the interval and is served the pre-write copy.
get_item_metadata after set_item_collections, or get_annotations after
create_annotation, did not show the change.

resolve_write_client, which every write path calls first, now records the
write, and the min-interval is skipped for two minutes afterwards. A copy
is still made only when the database or WAL has changed.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/configuration.md` (modified, +2/-1)
```diff
@@ -129,7 +129,8 @@ narrower than the API's. Writes always go through Zotero.
 - `ZOTERO_MCP_DB_SNAPSHOT_MIN_INTERVAL`: Zotero keeps recent changes in a WAL file
   next to `zotero.sqlite`, so reads use a private copy of the database plus that
   file. The copy is refreshed when Zotero writes, at most once per this many
-  seconds (default `5`). `ZOTERO_MCP_DB_SNAPSHOT=0` reads the database in place
+  seconds (default `5`). For two minutes after zotero-mcp itself writes, that
+  limit is lifted so a read right after a write sees it. `ZOTERO_MCP_DB_SNAPSHOT=0` reads the database in place
   instead, which never copies but misses changes until Zotero checkpoints.
 
 **Global search across libraries:**
```

**File**: `src/zotero_mcp/local_db.py` (modified, +20/-1)
```diff
@@ -681,6 +681,25 @@ def _snapshot_min_interval() -> float:
     except ValueError:
         return _DEFAULT_SNAPSHOT_MIN_INTERVAL
 
+
+#: Seconds after this process starts a write during which the copy throttle is
+#: bypassed, so a read that follows our own write sees it instead of a copy
+#: taken just before the write landed. A copy is still made only when the
+#: database or WAL has changed, so outside a burst of writes this costs nothing.
+_WRITE_BYPASS_WINDOW = 120.0
+_last_write_at: float | None = None
+
+
+def note_local_write() -> None:
+    """Record that this process is writing to Zotero; see _wal_snapshot_path."""
+    global _last_write_at
+    _last_write_at = time.monotonic()
+
+
+def _recently_wrote() -> bool:
+    return _last_write_at is not None and time.monotonic() - _last_write_at < _WRITE_BYPASS_WINDOW
+
+
 # One snapshot per database for the whole process, because readers are opened
 # per tool call: a copy per reader would copy the database on every call.
 _snapshot_lock = threading.Lock()
@@ -738,7 +757,7 @@ def _wal_snapshot_path(db_path: str) -> str | None:
             if cached and os.path.exists(cached[1]):
                 if cached[0] == before:
                     return cached[1]
-                if time.monotonic() - cached[2] < _snapshot_min_interval():
+                if time.monotonic() - cached[2] < _snapshot_min_interval() and not _recently_wrote():
                     # Changed, but copied too recently to copy again; the
                     # next read after the interval picks the change up.
                     return cached[1]
```

**File**: `src/zotero_mcp/tools/_helpers.py` (modified, +5/-1)
```diff
@@ -42,7 +42,7 @@
     normalize_doi,
     normalize_isbn,
 )
-from zotero_mcp.local_db import get_local_zotero_reader
+from zotero_mcp.local_db import get_local_zotero_reader, note_local_write
 from zotero_mcp.utils import _paginate
 
 
@@ -204,6 +204,10 @@ def resolve_write_client(ctx=None, *, op_description: str = "write operations"):
     writing to the other is precisely the mismatch that forces hybrid mode to
     re-fetch every item before touching it.
     """
+    # Every write resolves its client here first. Lift the WAL-snapshot copy
+    # throttle so the next local read sees this write instead of a copy taken
+    # just before it landed (local_db._wal_snapshot_path).
+    note_local_write()
     if not _utils.is_local_mode():
         zot = _client.get_zotero_client()
         return zot, zot, "web"
```

---

### Incident Patch 15: `a74fa79f` (2026-10-03)
**Commit Message**: docs(changelog): bibliography numbering fix (#619)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Duplicate detection agrees with itself** (#496). Duplicate grouping, the auto-merge DOI-conflict guard, the pre-add existence check and the semantic index's preprint filter now take their keys from `zotero_mcp.identifiers`, so DOIs match in canonical form (`10.1000/ABC`, `https://doi.org/10.1000/abc`) and titles fold the way Zotero's own duplicate finder folds them. A DOI field holding a placeholder such as `article` no longer groups every item that carries it, and re-adding a paper whose stored DOI differs only in case no longer creates a second copy.
 - **File uploads into a group library no longer go to your personal WebDAV** (#591). Group libraries always store files in Zotero Storage, but with `ZOTERO_WEBDAV_*` configured and writes going through the Web API, `zotero_add_item` and `zotero_attach_file` sent the file only to WebDAV and left the group attachment without one. Other attach paths PUT a second copy to WebDAV, and if that failed they deleted the group attachment even though its file was already in Zotero Storage. The WebDAV steps now skip group libraries.
+- **Exported bibliographies are numbered 1..N** (#619). `zotero_export_bibliography` numbered entries before dropping the ones that are empty once their HTML is stripped, so each dropped row used up a number and a 12-item collection came out as 4, 5, 7, 9, … Entries are now filtered first, then numbered.
 
 ## [0.13.1] - 2026-09-23
 
```

#### Recent Merged Pull Requests:
- **PR #668** (closed): Feature/readme fork note (@zhaw-marc)
- **PR #647** (2026-10-04): release: 0.13.2 (@54yyyu)
- **PR #637** (2026-10-04): fix(update): keep base-mapped fields when changing item_type (#636) (@falcon1-1-code)
- **PR #634** (2026-10-04): fix(merge): don't trash a duplicate's linked-file attachments as "already on the keeper" (@falcon1-1-code)
- **PR #630** (2026-10-04): fix(identifiers): percent-decode the DOI in a doi.org URL (@falcon1-1-code)
- **PR #629** (2026-10-04): fix(extract): fall back to the PDF text layer when markdown extraction is empty (#611) (@falcon1-1-code)
- **PR #628** (2026-10-04): fix(semantic): write chunked passages before pruning stale ones; hold watermark on failed items (#610) (@falcon1-1-code)
- **PR #627** (2026-10-04): fix(libraries): accept the listed personal library id in switch_library (#603) (@falcon1-1-code)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

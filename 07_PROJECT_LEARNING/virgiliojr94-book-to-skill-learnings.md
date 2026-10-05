# Forensic Learning Record (Deep Inspection): virgiliojr94/book-to-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/virgiliojr94-book-to-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:12.696Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `virgiliojr94/book-to-skill`
- **Description**: Turn any technical book PDF into a Claude Code skill — ready to study, reference, and use while you work.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 33834 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `book_to_skill/utils.py`
```
from __future__ import annotations

import glob
import hashlib
import json
import os
import re
import statistics
import sys

import shutil
import zipfile
from pathlib import Path

from book_to_skill.exceptions import ExtractionError

from book_to_skill.config import (
    OUTPUT_DIR,
    OUTPUT_TEXT,
    OUTPUT_META,
    WORDS_PER_TOKEN,
    CJK_CHARS_PER_TOKEN,
    SUPPORTED_EXTENSIONS,
    TEXT_EXTENSIONS,
    HTML_EXTENSIONS,
    CALIBRE_EBOOK_EXTENSIONS,
    supported_formats_message,
)
from book_to_skill.dependencies import (
    normalize_install_mode,
    prepare_dependencies,
    run_dependency_check,
)
from book_to_skill.parsers.text import read_text_file
from book_to_skill.parsers.html import extract_html_file
from book_to_skill.parsers.docx import extract_docx
from book_to_skill.parsers.rtf import extract_rtf
from book_to_skill.parsers.calibre import extract_with_ebook_convert
from book_to_skill.parsers.pdf import (
    extract_with_docling,
    extract_with_pdftotext,
    extract_with_pypdf,
    extract_with_pdfminer,
    looks_image_only,
    count_pages,
)
from book_to_skill.parsers.epub import (
    extract_with_ebooklib,
    extract_with_zipfile,
    count_epub_chapters,
    count_epub_images,
)
from book_to_skill.sanitize import sanitize_extracted_text


# Covers and decorative assets are common in prose EPUBs, so only surface the
# omission when the archive contains more than five images.
_EPUB_IMAGE_NOTICE_THRESHOLD = 5


# CJK codepoints: ideographs + extensions, kana, hangul, CJK punctuation, and
# fullwidth forms. These are not whitespace-delimited, so counting "words" on a
# Chinese/Japanese book collapses it to a handful of tokens; count them directly.
#
# The last range is Planes 2 and 3 (U+20000-U+3FFFF), the ideographic
# supplementary planes, taken end to end rather than enumerated block by block
# so a future extension does not silently fall through the way Extension H
# (U+31350-U+323AF) did. Nothing non-ideographic lives up here: emoji,
# mathematical alphanumerics and regional indicators are all in Plane 1, which
# this range does not touch. Classical Chinese, Cantonese, Hong Kong and
# Taiwan place/personal names, and Japanese 人名用漢字 all draw on it. Without it
# those characters fell through to the whitespace-word branch, where a
# space-less run of them counts as a single "word": the same ~1000x undercount
# #103 fixed for the BMP, one plane up.
# The Kangxi-radical range (U+2F00-U+2FDF) is included because some Chinese
# ebooks render ordinary Han characters — 网 as ⽹ (U+2F79), 大 as ⼤
# (U+2F24), 一 as ⼀ (U+2F00) — as radical forms throughout the whole text;
# without it such a book still falls through to the whitespace-word branch.
_CJK_RE = re.compile(
    r"[⼀-⿟　-〿぀-ヿ㐀-䶿一-鿿"
    r"가-힣豈-﫿＀-￯"
    r"\U00020000-\U0003FFFF]"
)


def estimate_tokens(text: str) -> int:
    """Estimate the token count of ``text`` with a deterministic heuristic.

    Latin / whitespace-delimited text is counted by words (``words /
    WORDS_PER_TOKEN`` — the project's long-standing ratio). CJK characters are
    counted directly against ``CJK_CHARS_PER_TOKEN`` because they carry little
    or no whitespace; without this a space-less Chinese/Japanese book estimates
    at a few tokens and the cost pre-flight under-reports by ~1000x. Kept
    dependency-free on purpose so the same book always yields the same number.
    """
    if not text:
        return 0
    cjk = len(_CJK_RE.findall(text))
    if not cjk:
        return int(len(text.split()) / WORDS_PER_TOKEN)
    latin_words = len(_CJK_RE.sub(" ", text).split())
    return int(latin_words / WORDS_PER_TOKEN + cjk / CJK_CHARS_PER_TOKEN)


# Explicit chapter heading: "Chapter 5", "Capítulo 5: ...", "Chapter 1. Intro".
# Also French/German/Italian/Dutch/Vietnamese chapter words (chapitre/kapitel/
# capitolo/hoofdstuk/chương), matching the ToC languages added alongside. "ch.?"
# stays last so the longer words match in full. Captures the number (bounded to
# 1..99 — drops years like "2025.") and whatever follows it on the line, so we
# can reject prose.
_EXPLICIT_CHAPTER = re.compile(
    r"^\s*(?:chapter|unit|lesson|module|lecture|part|chapitre|kapitel|cap[ií]tulo|capitolo|hoofdstuk|chương|ch\.?)\s*(?:(\d{1,2})|(?P<roman>[IVXLCDMivxlcdm]{1,7}))\b(?P<rest>.*)$",
    re.IGNORECASE,
)
# A heading's number is followed by end-of-line, punctuation (“. : - —“), or a
# Capitalized title word. A lowercase continuation (“Chapter 6 explores...”,
# “Chapter 8 are relevant...”) is prose / a cross-reference, not a heading.
# The uppercase class is À-Þ so titles starting with Ü/Û (common in German, e.g. “Überblick”) are recognized.
_HEADING_TAIL = re.compile(r"^\s*$|^\s*[.:\-—–]|^\s+(?![a-z])")
# A tail that opens with a sentence period — "Chapter 4. References are
# indicated by the `&` symbol…", "Chapter 17.) We have seen…" — is prose wrapped
# at the column limit, unless it reads like a title. Two shapes, measured on the
# Rust Book sources (rust-lang/book, MIT OR Apache-2.0, 112 files) where the
# numeric scan accepted 13 lines and every one of them was prose or code:
#   * a clause of 10-14 words ("Chapter 4. References are indicated by the `&`
#     symbol and borrow the value they"), and
#   * a bare "Chapter 6." ending a sentence that began on the line above.
# The longest period-tail heading in this repository's fixtures and tests is 5
# words ("Chapter 1. Introduction to Building AI"). (Issue #237)
_PERIOD_TAIL = re.compile(r"^\s*\.[)\"'”’\]]*(\s|$)")
_TAIL_WORD = re.compile(r"[^\s]*[0-9A-Za-z][^\s]*")
_TITLE_TAIL_MAX_WORDS = 8
# A line that ends a sentence / paragraph. When the line above does NOT end like
# this, the next line continues it instead of starting a heading.
_SENTENCE_END = re.compile(r"[.!?…:;\"'”’)\]]\s*$")


# Roman-numeral chapter heading: "I: Loomings", "II. The Carpet-Bag".
# Uppercase alone at line start is safe — no common English word is a valid
# uppercase Roman numeral.  Lowercase ("i: Loomings") is only accepted inside
# a markdown heading ("## i. introduction") to avoid false positives from
# words that happen to be valid Roman numerals ("vi: the editor" → 6).
_ROMAN_HEAD = re.compile(r"^\s*([IVXLCDM]+)\s*[:.]\s+[A-ZÀ-Þ0-9\"“(]")
_LC_MD_ROMAN = re.compile(r"^\s*#{1,6}\s+([ivxlcdm]+)\s*[:.]\s+[A-Za-zÀ-Þ\"“(]")
_ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}

# Optional Markdown / AsciiDoc heading prefix ("## Chapter 1", "== Section").
# Stripped in _chapter_number() as a second pass so the CJK/Thai/Korean
# matchers (which already tolerate the prefix inline) are untouched. (Issue #91)
_MD_HEADING_PREFIX = re.compile(r"^(#{1,6}|={1,6})\s+")

# Chinese chapter headings. Two common styles:
#   1. explicit "第N章" / "第 3 回" / "第十二节" / "第一讲" — 第 + numeral + a
#      chapter classifier (章回卷节篇讲);
#   2. a Markdown heading led by a CJK ordinal and a separator, e.g.
#      "## 一 · 缘起" or "## 第一讲" — common in CJK ebooks and lecture notes.
# Scoped to CJK numerals, so Latin/Roman detection above is completely unaffected
# (e.g. "## 5 Setup" is still not treated as a heading here). detect_structure()
# dedupes by number, so a "##" heading and a repeated "###" sub-ordinal collapse
# to a single chapter.
_CN_NUM_VALUES = {
    "〇": 0, "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9,
}
_CN_NUM_UNITS = {"十": 10, "百": 100, "千": 1000}
_CN_NUM_CLASS = "〇零一二两三四五六七八九十百千"

# Kangxi-radical numerals → CJK ideograph numerals. Some Chinese ebooks
# (e.g. certain e-reader platforms) encode numerals as Kangxi radicals from
# the U+2F00 block instead of CJK unified ideographs — "第⼀章" with
# U+2F00 (⼀) rather than U+4E00 (一). NFKC does not map these, so normalize
# them explicitly before chapter detection. Only numerals that exist as
# Kangxi radicals are listed (三/四/五/六/七/九 have no radical form).
_KANGXI_NUMERAL_TRANS = {
    0x2F00: ord("一"),  # ⼀ KANGXI RADICAL ONE
    0x2F06: ord("二"),  # ⼆ KANGXI RADICAL TWO
    0x2F0B: ord("八"),  # ⼋ KANGXI RADICAL EIGHT
    0x2F17: ord("十"),  # ⼗ KANGXI RADICAL TEN
}
# Full-width Arabic digits (U+FF10–U+FF19) are common in Japanese typesetting,
# e.g. "第１章". int() already parses them (str.isdigit() is True), so only the
# regex character classes need to accept them.
_FW_DIGITS = "０-９"
_CN_CHAPTER = re.compile(rf"^\s*第\s*([0-9{_FW_DIGITS}{_CN_NUM_CLASS}]+)\s*[章回卷节篇讲]")
_MD_CN_HEADING = re.compile(rf"^#{{1,6}}\s+第?\s*([{_FW_DIGITS}{_CN_NUM_CLASS}]+)\s*[·、.:：章回卷节篇讲]")

# Thai chapter headings: "บทที่ 3", "บทที่ ๑๒", "ตอนที่ ๘๗", "ภาคที่ 2".
# Thai digits (U+0E50-U+0E59) are positional like Arabic — unlike the Chinese
# numerals above they need no unit composition, only a digit remap. Optional
# Markdown "#" prefix so "## บทที่ ๑" is recognized in converted ebooks.
_TH_DIGITS = "๐-๙"
_TH_DIGIT_MAP = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
_TH_CHAPTER = re.compile(
    rf"^\s*(?:#{{1,6}}\s+)?(?:บทที่|ตอนที่|ภาคที่|บท|ตอน|ภาค)\s*([0-9{_TH_DIGITS}]+)\b"
)

# Hindi (Devanagari) chapter headings: "अध्याय 1", "अध्याय १", "## अध्याय 2".
# अध्याय ("chapter") + a number. Devanagari digits (U+0966-U+096F) are positional
# like Arabic, so — as with Thai — only a digit remap is needed, no composition.
# Optional Markdown "#" prefix so "## अध्याय १" is recognized in converted ebooks.
# Scoped to the digit form (not word ordinals like "पहला अध्याय") and requiring a
# number keeps prose that merely uses the word अध्याय from matching.
_HI_DIGITS = "०-९"
_HI_DIGIT_MAP = str.maketrans("०१२३४५६७८९", "0123456789")
_HI_CHAPTER = re.compile(
    rf"^\s*(?:#{{1,6}}\s+)?अध्याय\s*([0-9{_HI_DIGITS}]+)\b"
)

# Bengali chapter headings: "অধ্যায় 1", "অধ্যায় ১", "## অধ্যায় 2".
# অধ্যায় ("chapter") + a number. Bengali digits (U+09E6-U+09EF) are positional
# like the Hindi block above, so only a digit remap is needed. Optional Markdown
# "#" prefix so "## অধ্যায় ১" is recognized in converted ebooks. Requiring a
# number keeps prose that merely uses the word অধ্যায় from mat
```

### Core Architecture Module: `tools/evals/score.py`
```
#!/usr/bin/env python3
"""Pure scoring and accounting for synthetic evaluation trajectories."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List

UNKNOWN = "unknown"


def _state(value: Any) -> Any:
    """Keep only explicit boolean observations; absence remains unknown."""
    return value if isinstance(value, bool) else UNKNOWN


def _count(value: Any) -> Any:
    """Keep only explicit integer counts; absence remains unknown.

    ``bool`` is a subclass of ``int``, so a JSON ``true`` would otherwise pass an
    ``isinstance(value, int)`` test and then be summed as 1 -- inventing a usage
    number this module promises never to estimate.
    """
    return value if isinstance(value, int) and not isinstance(value, bool) else UNKNOWN


def score_trajectory(trajectory: Dict[str, Any]) -> Dict[str, Any]:
    """Score one trajectory without loading files or deriving missing observations."""
    expected = trajectory.get("expected", {})
    observed = trajectory.get("observed", {})
    target = expected.get("target")
    opens = observed.get("opens")
    opened_target = (
        any(opened == target for opened in opens)
        if isinstance(opens, list) and target is not None
        else UNKNOWN
    )
    # Where the target appears among the opens, or None when it does not appear
    # at all. `opens.index(target)` was called unguarded further down, so a
    # harness that recorded route_correct itself -- while `opens` did not contain
    # the target verbatim (an empty list, a "./" prefix, any path normalisation
    # difference) -- raised ValueError and killed the whole scoring run.
    target_position = (
        opens.index(target)
        if isinstance(opens, list) and target is not None and target in opens
        else None
    )
    answer_correct = _state(observed.get("answer_correct"))
    route_correct = _state(observed.get("route_correct"))
    evidence_reached = _state(observed.get("evidence_reached"))
    if "route_correct" not in observed and opened_target is not UNKNOWN:
        route_correct = opened_target
    if "evidence_reached" not in observed and opened_target is not UNKNOWN:
        evidence_reached = opened_target

    if UNKNOWN in (route_correct, evidence_reached, answer_correct):
        classification = UNKNOWN
    elif not route_correct:
        classification = "wrong_routing"
    elif not answer_correct:
        classification = "wrong_answer"
    elif target_position is not None and target_position > 0:
        classification = "irrelevant_opens_before_target"
    else:
        classification = "correct"

    usage = observed.get("usage")
    usage = usage if isinstance(usage, dict) else {}
    return {
        "question_id": trajectory["question_id"],
        "classification": classification,
        "routing_correct": route_correct,
        "evidence_reached": evidence_reached,
        "answer_correct": answer_correct,
        "usage": {key: _count(usage.get(key))
                  for key in ("input_tokens", "output_tokens", "calls")},
    }


def aggregate(results: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate recorded usage and classifications; never estimate missing usage."""
    items = list(results)
    counts: Dict[str, int] = {}
    totals = {"input_tokens": 0, "output_tokens": 0, "calls": 0}
    recorded = {key: 0 for key in totals}
    for result in items:
        label = result["classification"]
        counts[label] = counts.get(label, 0) + 1
        for key in totals:
            value = result["usage"][key]
            if value != UNKNOWN:
                totals[key] += value
                recorded[key] += 1
    return {
        "questions": len(items),
        "classifications": counts,
        "recorded_usage": totals,
        "usage_observations": recorded,
    }


def score(trajectories: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Return deterministic per-question and aggregate replay results."""
    questions: List[Dict[str, Any]] = [score_trajectory(item) for item in trajectories]
    questions.sort(key=lambda item: item["question_id"])
    return {"questions": questions, "aggregate": aggregate(questions)}

```

### Core Architecture Module: `book_to_skill/__init__.py`
```
from book_to_skill.utils import resolve_input_files, extract_single_file, main
from book_to_skill.exceptions import ExtractionError

__all__ = ["resolve_input_files", "extract_single_file", "main", "ExtractionError"]

```

### Core Architecture Module: `book_to_skill/__main__.py`
```
from book_to_skill.cli import main

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `book_to_skill/cli.py`
```
import sys

# Keep a deployed skill directory clean: importing the package below would
# otherwise write __pycache__/*.pyc beside the sources, leaving build artifacts
# inside the skill. `__name__` is bound before the module body runs, so this
# holds for a direct invocation and never mutates an embedding process that
# merely imports this module. Must be set BEFORE `book_to_skill` is imported.
if __name__ == "__main__":
    sys.dont_write_bytecode = True
from book_to_skill.utils import main as utils_main
from book_to_skill.pdf_inspector_integration import (
    enrich_pdf_inspector_metadata,
    install_pdf_inspector_hook,
)


def main():
    # Force UTF-8 stdout/stderr to avoid UnicodeEncodeError on Windows console
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            # Ignore if the stream does not support reconfigure (e.g. mock streams during testing)
            pass

    # pdf-inspector is an optional accelerator/trust layer. When unavailable,
    # this hook is a no-op and the legacy extraction chain behaves unchanged.
    install_pdf_inspector_hook()
    utils_main()
    enrich_pdf_inspector_metadata()


# Expose main for packaging console scripts entry points
if __name__ == "__main__":
    main()

```

### Core Architecture Module: `book_to_skill/config.py`
```
import os
import tempfile
from pathlib import Path

def default_output_dir() -> Path:
    """Per-run work directory, unique to this process.

    The PID is part of the name so two extractions running at the same time
    cannot overwrite each other. Every run previously shared one fixed path
    ($TMPDIR/book_skill_work), so whichever run finished second silently
    replaced the first run's full_text.txt and metadata.json — and an agent
    polling for metadata.json could pick up a *different document's*
    extraction without any error, then build a skill from the wrong source.

    The name is deliberately a sibling of the old fixed path rather than a
    child of it. An older cleanup routine that removes "book_skill_work"
    then simply finds nothing, instead of deleting a live concurrent run.

    BOOK_SKILL_WORKDIR still overrides this completely.
    """
    return Path(tempfile.gettempdir()) / f"book_skill_work-{os.getpid()}"


# `or` rather than a get() default: BOOK_SKILL_WORKDIR set to an empty string
# would otherwise become Path(""), i.e. the current directory — which the run
# would then populate and chmod to 0700.
OUTPUT_DIR = Path(os.environ.get("BOOK_SKILL_WORKDIR") or default_output_dir())
OUTPUT_TEXT = OUTPUT_DIR / "full_text.txt"
OUTPUT_META = OUTPUT_DIR / "metadata.json"

WORDS_PER_TOKEN = 0.75  # approximate (Latin / whitespace-delimited text)
# CJK scripts carry little or no whitespace, so word-splitting under-counts them
# by orders of magnitude. Count CJK codepoints directly against this
# chars-per-token ratio instead (see estimate_tokens in utils.py).
CJK_CHARS_PER_TOKEN = 1.5  # approximate for cl100k-style tokenizers

TEXT_EXTENSIONS = {".txt", ".text", ".md", ".markdown", ".rst", ".adoc", ".asciidoc"}
HTML_EXTENSIONS = {".html", ".htm", ".xhtml"}
CALIBRE_EBOOK_EXTENSIONS = {".mobi", ".azw", ".azw3"}
SUPPORTED_EXTENSIONS = {
    ".pdf", ".epub", ".docx", ".rtf",
    *TEXT_EXTENSIONS,
    *HTML_EXTENSIONS,
    *CALIBRE_EBOOK_EXTENSIONS,
}

PYTHON_DEPENDENCIES = {
    "pdf_inspector": "pdf-inspector>=1.15,<2",
    "docling": "docling",
    "pypdf": "pypdf",
    "pdfminer": "pdfminer.six",
    "ebooklib": "ebooklib",
    "bs4": "beautifulsoup4",
    "docx": "python-docx",
    "striprtf": "striprtf",
    "trafilatura": "trafilatura",
}


def supported_formats_message() -> str:
    return ", ".join(sorted(SUPPORTED_EXTENSIONS))

```

### Core Architecture Module: `book_to_skill/dependencies.py`
```
from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

from book_to_skill.config import PYTHON_DEPENDENCIES, HTML_EXTENSIONS


# Ordered groups for the --check preflight report. Each entry describes one
# format and what it needs. `modules` are optional Python packages (any one is
# enough unless noted); `system` are external commands resolved via PATH.
DEPENDENCY_GROUPS = [
    {
        "label": "PDF (smart inspection / native Markdown)",
        "modules": ["pdf_inspector"],
        "any_of_modules": True,
        "system": [],
        "note": "optional fast classifier/provenance layer; falls back to the existing PDF chain",
    },
    {
        "label": "PDF (text-heavy)",
        "modules": ["pypdf", "pdfminer"],
        "any_of_modules": True,
        "any_tool_suffices": True,
        "system": [("pdftotext", "poppler-utils", "sudo apt install poppler-utils")],
        "note": "any one of pdftotext / pypdf / pdfminer is enough",
    },
    {
        "label": "PDF (technical: tables, code, formulas)",
        "modules": ["docling"],
        "any_of_modules": True,
        "system": [],
        "note": "needed only for --mode technical; otherwise falls back to the text chain",
    },
    {
        "label": "EPUB",
        "modules": ["ebooklib", "bs4"],
        "any_of_modules": False,
        "system": [],
        "note": "falls back to a stdlib zipfile parser if missing",
    },
    {
        "label": "DOCX",
        "modules": ["docx"],
        "any_of_modules": True,
        "system": [],
        "note": "falls back to a stdlib ZIP/XML parser if missing",
    },
    {
        "label": "HTML",
        "modules": ["trafilatura", "bs4"],
        "any_of_modules": True,
        "system": [],
        "note": "trafilatura does real boilerplate detection; falls back to bs4, then the stdlib html.parser, if missing",
    },
    {
        "label": "RTF",
        "modules": ["striprtf"],
        "any_of_modules": True,
        "system": [],
        "note": "falls back to a basic regex cleanup if missing",
    },
    {
        "label": "MOBI / AZW / AZW3",
        "modules": [],
        "any_of_modules": True,
        "required": True,
        "system": [
            ("ebook-convert", "Calibre", "install Calibre: https://calibre-ebook.com/download"),
        ],
        "note": "no fallback — Calibre is required for these formats",
    },
]


def python_module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def isolated_install_hint(module_name: str) -> str | None:
    """Explain a module that is installed as a tool but not importable here.

    pipx — the way Docling's own docs suggest installing it — puts the package
    in its own virtualenv and only the executable on PATH. The module is then
    genuinely not importable from this interpreter, so "✗ python: docling" is
    correct and useless: the user installed it, and we say it is missing.

    Returns a line naming the executable and the interpreter that can import
    it, or None when there is no such executable. Never claims the module is
    available — the parsers import it, so a binary on PATH does not make the
    import work; it only tells us where a working environment is.
    """
    executable = shutil.which(module_name)
    if not executable:
        return None
    # pipx layout: <venv>/bin/<tool> — its sibling `python` can import the module.
    venv_python = Path(executable).resolve().parent / "python"
    where = f"\n        {venv_python} scripts/extract.py …" if venv_python.exists() else ""
    return (
        f"a `{module_name}` command exists at {executable}, so it is installed in an "
        f"isolated environment (pipx?).\n        Run the extractor with that "
        f"environment's Python, or install it into this one:{where}"
    )


def missing_python_packages(module_names: list[str]) -> list[str]:
    missing = []
    for module_name in module_names:
        if not python_module_available(module_name):
            missing.append(PYTHON_DEPENDENCIES[module_name])
    return missing


def install_python_packages(packages: list[str]) -> bool:
    if not packages:
        return True

    print(f"Installing missing Python package(s): {', '.join(packages)}")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", *packages],
            text=True,
            timeout=600,
        )
    except Exception as exc:
        print(f"Package installation failed: {exc}", file=sys.stderr)
        return False

    importlib.invalidate_caches()
    return result.returncode == 0


def normalize_install_mode(argv: list[str]) -> str:
    mode = os.environ.get("BOOK_SKILL_INSTALL_MISSING", "ask").lower()
    if "--no-install-missing" in argv:
        return "no"
    if "--install-missing" in argv:
        idx = argv.index("--install-missing")
        if idx + 1 < len(argv) and not argv[idx + 1].startswith("--"):
            mode = argv[idx + 1].lower()
        else:
            mode = "yes"
    if mode in {"1", "true", "y", "yes", "install"}:
        return "yes"
    if mode in {"0", "false", "n", "no", "fallback", "skip"}:
        return "no"
    return "ask"


def offer_dependency_install(
    *,
    feature: str,
    module_names: list[str],
    fallback: str | None,
    install_mode: str,
    any_of_modules: bool = False,
) -> None:
    missing_packages = missing_python_packages(module_names)
    if not missing_packages or (
        any_of_modules and len(missing_packages) < len(module_names)
    ):
        return

    package_choices = [PYTHON_DEPENDENCIES[name] for name in module_names]
    if any_of_modules:
        message = f"{feature} uses one of {', '.join(package_choices)} if installed"
        packages = missing_packages[:1]
    else:
        message = f"{feature} uses {', '.join(missing_packages)} if installed"
        packages = missing_packages
    if fallback:
        message += f", otherwise {fallback}"
    message += "."
    print(message)

    should_install = False
    if install_mode == "yes":
        should_install = True
    elif install_mode == "ask" and sys.stdin.isatty():
        answer = input("Missing package(s) detected. Do you want to install? y=install, n=fallback: ").strip().lower()
        should_install = answer in {"y", "yes", "install"}
    else:
        if fallback:
            print("Non-interactive mode or install disabled; using fallback.")
        else:
            print("Non-interactive mode or install disabled; installation skipped.")

    if not should_install:
        if fallback:
            print(f"Using fallback: {fallback}.")
        return

    if install_python_packages(packages):
        still_missing = missing_python_packages(module_names)
        dependencies_satisfied = (
            len(still_missing) < len(module_names)
            if any_of_modules
            else not still_missing
        )
        if dependencies_satisfied:
            print("Package installation complete.")
            return
        print(f"Package installation incomplete; still missing: {', '.join(still_missing)}", file=sys.stderr)
    else:
        print("Package installation failed.", file=sys.stderr)

    if fallback:
        print(f"Using fallback: {fallback}.")


def prepare_dependencies(ext: str, extraction_mode: str, install_mode: str) -> None:
    if ext == ".pdf" and extraction_mode == "technical":
        offer_dependency_install(
            feature="Technical PDF extraction",
            module_names=["docling"],
            fallback="the PDF text fallback chain",
            install_mode=install_mode,
        )

    if ext == ".pdf" and not shutil.which("pdftotext"):
        offer_dependency_install(
            feature="PDF text extraction",
            module_names=["pypdf", "pdfminer"],
            fallback="any installed Python PDF parser; extraction fails if none are available",
            install_mode=install_mode,
            any_of_modules=True,
        )

    if ext == ".epub":
        offer_dependency_install(
            feature="EPUB extraction",
            module_names=["ebooklib", "bs4"],
            fallback="a stdlib ZIP/HTML parser",
            install_mode=install_mode,
        )

    if ext in HTML_EXTENSIONS:
        offer_dependency_install(
            feature="HTML extraction",
            module_names=["trafilatura", "bs4"],
            fallback="a stdlib HTML parser",
            install_mode=install_mode,
            any_of_modules=True,
        )

    if ext == ".docx":
        offer_dependency_install(
            feature="DOCX extraction",
            module_names=["docx"],
            fallback="a stdlib ZIP/XML parser",
            install_mode=install_mode,
        )

    if ext == ".rtf":
        offer_dependency_install(
            feature="RTF extraction",
            module_names=["striprtf"],
            fallback="a basic regex cleanup fallback",
            install_mode=install_mode,
        )


def run_dependency_check() -> int:
    """Scan every optional dependency across all formats and print a status
    report plus the exact command to install whatever is missing.

    Returns a process exit code: 0 always (a missing optional dep is not an
    error — most formats degrade to a fallback). Intended for `extract.py --check`.
    """
    print("book-to-skill — dependency check\n")

    missing_pip_packages: list[str] = []
    missing_system: list[tuple[str, str]] = []  # (name, install hint)

    for group in DEPENDENCY_GROUPS:
        print(f"  {group['label']}")

        present_modules = [m for m in group["modules"] if python_module_available(m)]
        absent_modules = [m for m in group["modules"] if not python_module_available(m)]
        system_present = [c for c, _, _ in group["system"] if shutil.which(c)]
        system_absent = [c for c, _, _ in group["system"] if not shutil.which(c)]

 
```

### Core Architecture Module: `book_to_skill/exceptions.py`
```
class ExtractionError(Exception):
    """Raised when a single file cannot be extracted (non-fatal in batch mode)."""

```

### Core Architecture Module: `book_to_skill/parsers/__init__.py`
```
# Parsers package

```

### Core Architecture Module: `book_to_skill/parsers/calibre.py`
```
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from book_to_skill.config import OUTPUT_DIR
from book_to_skill.exceptions import ExtractionError


def extract_with_ebook_convert(input_path: str) -> str | None:
    if not shutil.which("ebook-convert"):
        return None

    # Each call converts into its own temporary directory under OUTPUT_DIR. The
    # work directory is shared by every source in a batch — and by separate runs
    # whenever BOOK_SKILL_WORKDIR is set explicitly — so any output reachable by
    # a predictable name can be satisfied by an earlier run's leftover: a
    # conversion that reports success without writing anything would return that
    # earlier file's text and record it under the current source's name. A
    # per-pid counter is not enough, because a reused pid across two interpreters
    # collapses back to the same name; a fresh TemporaryDirectory is
    # unaddressable from outside this call. Cleanup on exit also stops one full
    # intermediate text per source from piling up in the work directory.
    #
    # A directory that cannot be created is raised, not swallowed: returning None
    # here would be indistinguishable from "converted fine, wrote nothing", which
    # is exactly the silent-failure shape this function is meant to refuse.
    try:
        tmp_ctx = tempfile.TemporaryDirectory(dir=OUTPUT_DIR, prefix="ebook-convert-")
    except OSError as e:
        raise ExtractionError(
            f"cannot create a conversion directory under {OUTPUT_DIR}: {e}"
        ) from e

    with tmp_ctx as tmp_name:
        output_path = Path(tmp_name) / "ebook-convert-output.txt"
        try:
            input_path = os.path.abspath(input_path)
            result = subprocess.run(
                ["ebook-convert", input_path, str(output_path)],
                capture_output=True, text=True, timeout=300
            )
            # Read before the with-block exits: cleanup deletes the directory.
            if result.returncode == 0 and output_path.exists():
                text = output_path.read_text(encoding="utf-8", errors="replace")
                if text.strip():
                    return text
        except Exception as e:
            print(f"  [warn] extract_with_ebook_convert failed: {type(e).__name__}: {e}", file=sys.stderr)
    return None

```

### Core Architecture Module: `book_to_skill/parsers/docx.py`
```
from __future__ import annotations

import zipfile
import sys
from book_to_skill.exceptions import ExtractionError


def extract_docx_with_python_docx(docx_path: str) -> str | None:
    # Called unconditionally (not just via extract_docx()) so this function is
    # self-defending when invoked directly WITH python-docx installed:
    # raises ExtractionError on DOCTYPE/ENTITY declarations before
    # python-docx ever opens the archive. If python-docx is NOT installed,
    # this returns None without validating at all -- a parser that isn't
    # installed parses nothing, so skipping the scan gives up no safety
    # (nothing gets extracted, malicious or not), and it avoids paying the
    # full archive scan on every extract_docx() call in the (default,
    # stdlib-only) case where this parser never even runs. A caller that
    # invokes this function directly and needs a validation guarantee
    # regardless of python-docx's availability should use
    # extract_docx_with_zipfile() or call validate_docx_xml_safety() itself.
    try:
        import docx
        validate_docx_xml_safety(docx_path)
        document = docx.Document(docx_path)
        parts = [paragraph.text for paragraph in document.paragraphs if paragraph.text]
        for table in document.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                if any(cells):
                    parts.append("\t".join(cells))
        return "\n".join(parts)
    except ImportError:
        return None
    except ExtractionError:
        # Without this, the broad `except Exception` below would catch an
        # XXE rejection from validate_docx_xml_safety() too, turning a
        # security refusal into a swallowed [warn] + None.
        raise
    except Exception as e:
        print(f"  [warn] extract_docx_with_python_docx failed: {type(e).__name__}: {e}", file=sys.stderr)
        return None


def extract_docx_with_zipfile(docx_path: str) -> str | None:
    # Called unconditionally (not just via extract_docx()) so this function is
    # self-defending even when invoked directly: raises ExtractionError on
    # DOCTYPE/ENTITY declarations before the XML ever reaches the parser.
    validate_docx_xml_safety(docx_path)
    try:
        import xml.etree.ElementTree as ET

        with zipfile.ZipFile(docx_path) as zf:
            xml_bytes = zf.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        parts: list[str] = []

        def inline_text(elem) -> str:
            """Rebuild text runs without dropping explicit DOCX separators."""
            text_parts: list[str] = []
            for node in elem.iter():
                if node.tag == f"{ns}t" and node.text:
                    text_parts.append(node.text)
                elif node.tag == f"{ns}tab":
                    text_parts.append("\t")
                elif node.tag in {f"{ns}br", f"{ns}cr"}:
                    text_parts.append("\n")
            return "".join(text_parts)

        def emit_block(elem) -> None:
            # Walk block content in document order. Paragraphs join their runs;
            # tables emit one tab-joined line per row (same row format as the
            # python-docx path, but order-preserving — python-docx appends all
            # tables last). Unknown wrappers (e.g. <w:sdt> content controls) are
            # recursed into so their paragraphs/tables are not lost; <w:p> and
            # <w:tbl> are NOT recursed into, so table-cell paragraphs are not
            # double-counted. Cell text concatenates the cell's runs; nested
            # tables fold into the parent cell and are also emitted standalone
            # (rare; best-effort).
            for child in elem:
                tag = child.tag
                if tag == f"{ns}p":
                    paragraph = inline_text(child)
                    if paragraph:
                        parts.append(paragraph)
                elif tag == f"{ns}tbl":
                    for row in child.iter(f"{ns}tr"):
                        cells = []
                        for cell in row.iter(f"{ns}tc"):
                            cells.append(inline_text(cell).strip())
                        if any(cells):
                            parts.append("\t".join(cells))
                else:
                    emit_block(child)

        body = root.find(f"{ns}body")
        emit_block(body if body is not None else root)
        return "\n".join(parts) if parts else None
    except Exception as e:
        print(f"  [warn] extract_docx_with_zipfile failed: {type(e).__name__}: {e}", file=sys.stderr)
        return None


def validate_docx_xml_safety(docx_path: str) -> None:
    """Scan all XML files in the DOCX zip archive to prevent XML Entity Expansion (Billion Laughs) and XXE injections."""
    try:
        with zipfile.ZipFile(docx_path) as zf:
            for name in zf.namelist():
                if name.endswith(".xml") or name.endswith(".rels"):
                    xml_bytes = zf.read(name)
                    for encoding in ("utf-8", "utf-16", "utf-16le", "utf-16be", "utf-32"):
                        try:
                            content = xml_bytes.decode(encoding, errors="ignore").upper()
                        except LookupError:
                            continue
                        if "<!DOCTYPE" in content or "<!ENTITY" in content:
                            raise ExtractionError(
                                f"Security validation failed: XML file '{name}' in DOCX archive contains forbidden DTD or entity declarations."
                            )
    except zipfile.BadZipFile as e:
        raise ExtractionError(f"Invalid DOCX file: {e}")
    except ExtractionError:
        raise
    except Exception as e:
        raise ExtractionError(f"Error during security validation of DOCX archive: {e}")


def extract_docx(docx_path: str) -> tuple[str, str]:
    # Validation lives in each leaf parser (extract_docx_with_python_docx,
    # extract_docx_with_zipfile) so it runs exactly once regardless of which
    # parser actually handles the file, instead of once here plus again in
    # whichever parser this falls through to.
    print("Trying python-docx...", end=" ", flush=True)
    text = extract_docx_with_python_docx(docx_path)
    if text and text.strip():
        print("OK")
        return text, "python-docx"

    print("not available")
    print("Trying stdlib DOCX parser...", end=" ", flush=True)
    text = extract_docx_with_zipfile(docx_path)
    if text and text.strip():
        print("OK")
        return text, "zipfile-docx"

    print("FAILED")
    raise ExtractionError(
        "Could not extract text from DOCX.\n"
        "Install python-docx for best results:\n"
        "  pip3 install python-docx"
    )

```

### Core Architecture Module: `book_to_skill/parsers/epub.py`
```
from __future__ import annotations

import html
import posixpath
import re
import sys
import zipfile
from urllib.parse import unquote, urlsplit

from book_to_skill.parsers.html import _HTMLTextExtractor


_IMAGE_EXTENSIONS = (
    ".avif",
    ".bmp",
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".tif",
    ".tiff",
    ".webp",
)

# OPF package elements normally use the default OPF namespace, but XML also
# permits an explicit namespace prefix (for example ``<opf:item>``). Keep the
# existing tolerant, regex-based fallback while accepting that equivalent form.
_OPF_ELEMENT_PREFIX = r"(?:[A-Za-z_][\w.-]*:)?"


def _opf_opening_tags(opf_text: str, local_name: str) -> list[str]:
    """Return opening tags for an OPF element, with or without a prefix."""
    return re.findall(
        rf"<{_OPF_ELEMENT_PREFIX}{re.escape(local_name)}\b[^>]*?/?>",
        opf_text,
    )


def extract_with_ebooklib(epub_path: str) -> str | None:
    try:
        import ebooklib
        from ebooklib import epub
        from bs4 import BeautifulSoup

        book = epub.read_epub(epub_path)
        parts = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            parts.append(soup.get_text(separator="\n"))
        return "\n\n".join(parts)
    except ImportError:
        return None
    except Exception as e:
        print(f"  [warn] extract_with_ebooklib failed: {type(e).__name__}: {e}", file=sys.stderr)
        return None


def _find_opf_path(zf: zipfile.ZipFile) -> str | None:
    """Locate the OPF package document inside an EPUB archive.

    First tries ``META-INF/container.xml`` (the spec-defined entry point),
    then falls back to scanning the archive for any ``.opf`` file.
    """
    # Spec-defined: read container.xml for the rootfile path
    try:
        container = zf.read("META-INF/container.xml").decode("utf-8", errors="replace")
        match = re.search(r'full-path=["\']([^"\']+\.opf)["\']', container)
        if match:
            return match.group(1)
    except (KeyError, Exception):
        pass

    # Fallback: glob for any .opf file
    opf_files = [n for n in zf.namelist() if n.endswith(".opf")]
    return opf_files[0] if opf_files else None


def _resolve_manifest_href(href: str, opf_dir: str) -> str:
    """Map an OPF manifest IRI to its ZIP member name."""
    # Manifest hrefs are IRIs, not literal archive names.  XML entities have
    # already been decoded by a real XML parser; mirror that here before
    # discarding query/fragment components and decoding percent escapes.
    archive_path = unquote(urlsplit(html.unescape(href)).path)
    if opf_dir:
        archive_path = posixpath.join(opf_dir, archive_path)
    return posixpath.normpath(archive_path)


def extract_with_zipfile(epub_path: str) -> str | None:
    """stdlib-only EPUB extractor: unzip → parse HTML files."""
    try:
        with zipfile.ZipFile(epub_path) as zf:
            names = zf.namelist()

            # Locate OPF and determine its directory for resolving relative hrefs
            opf_path = _find_opf_path(zf)
            opf_dir = posixpath.dirname(opf_path) if opf_path else ""

            # Build reading order from the OPF spine (not the manifest's href
            # order), then append any remaining content docs as a safety net.
            spine_order: list[str] = []
            seen: set[str] = set()
            if opf_path:
                opf_text = zf.read(opf_path).decode("utf-8", errors="replace")

                # Manifest: item id -> resolved href. Parse each <item> opening
                # tag so attribute order (id before/after href) does not matter;
                # both self-closing <item .../> and <item ...></item> forms work
                # because all attributes live in the opening tag.
                manifest: dict[str, str] = {}
                for item_tag in _opf_opening_tags(opf_text, "item"):
                    id_m = re.search(r'\bid=["\']([^"\']+)["\']', item_tag)
                    href_m = re.search(r'\bhref=["\']([^"\']+)["\']', item_tag)
                    if id_m and href_m:
                        resolved = _resolve_manifest_href(href_m.group(1), opf_dir)
                        manifest[id_m.group(1)] = resolved

                # Spine: ordered idrefs -> hrefs (true reading order).
                for itemref_tag in _opf_opening_tags(opf_text, "itemref"):
                    idref_m = re.search(
                        r'\bidref=["\']([^"\']+)["\']', itemref_tag
                    )
                    if not idref_m:
                        continue
                    href = manifest.get(idref_m.group(1))
                    if href and href not in seen:
                        spine_order.append(href)
                        seen.add(href)

                # Safety net: append remaining manifest content documents (e.g. a
                # nav doc not in the spine) in manifest order, so nothing is lost.
                for href in manifest.values():
                    if href.endswith((".html", ".xhtml")) and href not in seen:
                        spine_order.append(href)
                        seen.add(href)

            html_files = spine_order or sorted(
                n for n in names if n.endswith((".html", ".xhtml"))
            )
            if not html_files:
                return None

            parts = []
            for name in html_files:
                try:
                    raw = zf.read(name).decode("utf-8", errors="replace")
                    parser = _HTMLTextExtractor()
                    parser.feed(raw)
                    parts.append(parser.get_text())
                except Exception:
                    continue
            return "\n\n".join(parts) if parts else None
    except Exception as e:
        print(f"  [warn] extract_with_zipfile failed: {type(e).__name__}: {e}", file=sys.stderr)
        return None


def count_epub_chapters(epub_path: str) -> int:
    """Count spine items (approximate chapter count) without dependencies."""
    try:
        with zipfile.ZipFile(epub_path) as zf:
            opf_path = _find_opf_path(zf)
            if not opf_path:
                return 0
            opf_text = zf.read(opf_path).decode("utf-8", errors="replace")
            return len(_opf_opening_tags(opf_text, "itemref"))
    except Exception:
        return 0


def count_epub_images(epub_path: str) -> int:
    """Count image members whose content the text-only EPUB parsers omit."""
    try:
        with zipfile.ZipFile(epub_path) as zf:
            return sum(
                not info.is_dir() and info.filename.lower().endswith(_IMAGE_EXTENSIONS)
                for info in zf.infolist()
            )
    except (OSError, zipfile.BadZipFile):
        return 0


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #248** (2026-09-29): **[bug] Stdlib EPUB fallback ignores namespace-prefixed OPF spine elements**
  *Symptoms*: ## What happened  The stdlib EPUB fallback only recognizes unprefixed `<item>` and `<itemref>` opening tags in the OPF package document. If an otherwise equivalent package uses namespace-qualified tags such as `<opf:item>` and `<opf:itemref>`, the manifest and spine are missed.  The extractor then falls back to sorting XHTML member names, which can reorder the book, and `count_epub_chapters()` reports zero spine items.  ## What you expected  Namespace-prefixed OPF elements should produce the same reading order and spine count as elements using the default OPF namespace.  ## Source document - Format: EPUB (synthetic two-document fixture) - Pages / size: 2 XHTML documents / under 2 KB - Language: English - Does `python3 scripts/extract.py --check` show the relevant extractor installed? stdlib fallback; no optional extractor required  ## Repro  Use a package document whose file names sort opposite to its spine:  ```xml <opf:package xmlns:opf="http://www.idpf.org/2007/opf">   <opf:manifest>     <opf:item id="c1" href="z-first.xhtml"/>     <opf:item id="c2" href="a-second.xhtml"/>   </opf:manifest>   <opf:spine>     <opf:itemref idref="c1"/>     <opf:itemref idref="c2"/>   </opf:spine> </opf:package> ```  Put `FIRST` in `z-first.xhtml` and `SECOND` in `a-second.xhtml`, then call `extract_with_zipfile()` and `count_epub_chapters()` on the archive.  Observed on master:  ```text text='SECOND\n\nFIRST' chapter_count=0 ```  The expected result is `FIRST` before `SECOND` and `chapter_co
  **Post-Mortem & Fix Analysis**:
  > Tracked by PR #249 (approved, `2e6ee40d9263`). Closes on merge.

- **Issue #244** (2026-09-29): **[bug] metadata.json drops per-source chapter heading samples**
  *Symptoms*: ## What happened  `extract_single_file()` returns `chapter_headings_sample`, but the CLI omits that field from every entry in `metadata.json.sources`. Only the consolidated top-level sample survives. With two sources containing 12 numbered chapters each, that top-level sample contains the first source's first 10 headings; the second source's headings cannot be audited from the metadata.  @wgm66 identified this separate omission in [the discussion of #236](https://github.com/virgiliojr94/book-to-skill/issues/236#issuecomment-5748201919). This issue isolates that serialization defect; it does not propose a chapter-selection algorithm change.  ## What you expected  Each `sources[i].chapter_headings_sample` should preserve the list already returned by extraction, including an empty list when that is the existing result. This makes source-level chapter reports inspectable without changing detection or generation behavior.  ## Source document - Format: synthetic Markdown, no copyrighted material. - Pages / size: no pages; 12 short numbered chapters per file. - Language: English, with a separate CJK-heading regression. - Extractor: built-in plain-text parser; no optional package needed.  ## Repro  Create `alpha.md` and `beta.md`, each with numbered headings from 1 to 12, using different titles:  ```markdown # Chapter 1: Alpha 1 Body for this chapter.  # Chapter 2: Alpha 2 Body for this chapter. ```  Continue through Chapter 12, and use `Beta` for the second file. Run:  ```sh BOOK_SK
  **Post-Mortem & Fix Analysis**:
  > Tracked by PR #245 (approved, `b27360ccfc2f`). Closes on merge.

- **Issue #241** (2026-09-29): **[bug] Stdlib RTF fallback drops hex-escaped text**
  *Symptoms*: ## What happened  When the optional `striprtf` package is unavailable, the dependency-free RTF fallback replaces every standalone hex-escaped byte (`\'hh`) with a space. These escapes are how many legacy RTF files encode visible non-ASCII text, so content is silently lost:  - `caf\'e9` becomes `caf ` instead of `café`; - cp1251-escaped Cyrillic becomes whitespace; and - multibyte code pages such as cp932 lose the encoded characters entirely.  The same syntax can also appear immediately after an RTF `\uN` Unicode escape as a one-character compatibility fallback. That byte should still be consumed rather than emitted; the bug concerns the standalone escapes that remain afterward.  ## What you expected  After consuming `\uN` compatibility fallbacks, the stdlib parser should decode remaining hex byte runs using the document's declared `\ansicpgN` code page, defaulting to Windows-1252 when none is declared.  ## Source document - Format: RTF (synthetic strings; no copyrighted text) - Pages / size: one line / under 1 KB - Language: French sample, Russian, and Japanese - Does `python3 scripts/extract.py --check` show the relevant extractor installed? no (`striprtf` absent; dependency-free fallback is the path under test)  ## Repro  Call `strip_rtf_fallback()` with these minimal payloads:  ```rtf {\rtf1\ansi caf\'e9 and \'93quoted\'94.} {\rtf1\ansi\ansicpg1251 \'cf\'f0\'e8\'e2\'e5\'f2} ```  Current output:  ```text 'caf  and  quoted .' '      ' ```  Expected output:  ```text 'café and
  **Post-Mortem & Fix Analysis**:
  > Tracked by PR #242 (approved, `e51ce5504f28`). Closes on merge.

- **Issue #238** (2026-09-22): **[bug] Stdlib DOCX fallback drops inline tabs and breaks**
  *Symptoms*: ## What happened  When `python-docx` is unavailable and extraction falls back to the stdlib ZIP/XML parser, inline DOCX controls are discarded. A paragraph containing `Term<w:tab/>Definition` becomes `TermDefinition`, while `<w:br/>` and `<w:cr/>` similarly join separate lines together.  The fallback currently collects only `<w:t>` nodes, so the separators disappear before the extracted text reaches structure detection or skill generation.  ## What you expected  The stdlib fallback should preserve explicit inline tabs as `\t` and line/carriage breaks as `\n`, matching the visible document structure and the behavior of `python-docx`.  ## Source document - Format: DOCX (synthetic minimal ZIP/XML fixture; no copyrighted text) - Pages / size: one paragraph / under 1 KB - Language: English - Does `python3 scripts/extract.py --check` show the relevant extractor installed? no (`python-docx` absent; stdlib fallback is the path under test)  ## Repro  Create a minimal `word/document.xml` paragraph containing:  ```xml <w:r>   <w:t>Term</w:t><w:tab/><w:t>Definition</w:t>   <w:br/><w:t>Next line</w:t> </w:r> ```  Then call `extract_docx_with_zipfile()` for that DOCX.  Current output:  ```text TermDefinitionNext line ```  The actual separators are absent, so the visible text is concatenated.  Expected output preserves a tab and newline:  ```text Term\tDefinition\nNext line ```  Two focused regressions against current `master` (`526f362`) fail as follows:  ```text FAILED test_inline_tabs_ar

- **Issue #237** (2026-09-29): **[bug] Chapter detection counts prose cross-references and diff lines as chapters**
  *Symptoms*: ## Problem  `detect_structure()`'s docstring states it counts *"explicit \"Chapter N\"/\"Capítulo N\" headings, **rejecting prose cross-references and numbered list items**"* (`utils.py:670`), and PR #161's body repeats the claim — *"Prose cross-references like `Chapter 6 explores...` are still rejected."* That rejection is incomplete in two ways, both reachable without any exotic input.  ### 1. A wrapped sentence that ends in `Chapter N.` is counted  When the extractor wraps prose, a cross-reference can start a line. `_HEADING_TAIL` (`utils.py:117`) accepts a punctuation tail that is immediately followed by end-of-line:  ```python _HEADING_TAIL = re.compile(r"^\s*$|^\s*[.:\-—–]|^\s+(?![a-z])") ```  so `Chapter 6.` — a sentence ending — reads as a heading. Minimal cases, each a single short string:  | input line | `_chapter_number()` | counted as a chapter? | |---|---|---| | `# Chapter 6` | 6 | yes (correct) | | `Chapter 6` | 6 | yes (correct) | | `# Chapter 6: Enums` | 6 | yes (correct) | | `Chapter 6.` (prose wraps here) | **6** | **yes — wrong** | | `Chapter 13. Closures and iterators create types that only the` | **13** | **yes — wrong** | | `Chapter 4. References are indicated by the & symbol and borrow the` | **4** | **yes — wrong** |  The second and third are ordinary wrapped sentences: `...we cover in\nChapter 13. Closures and iterators...`. The capitalized word after the period defeats the lowercase guard at `utils.py:117`, and the lowercase guard was the only prose 
  **Post-Mortem & Fix Analysis**:
  > Reproduced the prose and bare-diff matches, and a fenced two-line diff selecting the numeric path. Please retain bare/Markdown and multilingual heading controls, cover both fenced and unfenced diff lines, and evaluate punctuation-only and long legitimate headings before adopting a word cap. Chapter 6. alone is ambiguous without context; a global eight-word cutoff is not yet justified. Keep this focused on numeric false positives; #236 tracks structural selection.

- **Issue #230** (2026-09-22): **[bug] Stdlib EPUB fallback skips encoded manifest hrefs**
  *Symptoms*: ## What happened  The stdlib EPUB fallback reads each OPF manifest `href` as though it were the literal ZIP member name. OPF hrefs are references, so a fragment such as `chapter.xhtml#section-2` is not part of the archive filename, and percent escapes such as `Chapter%201.xhtml` represent characters in that filename.  Both valid forms currently make `ZipFile.read()` look for a non-existent member. The per-document exception handler then silently skips the chapter; if every spine item uses one of these forms, extraction returns no text at all.  ## What you expected  The dependency-free EPUB fallback should resolve manifest references to their ZIP member names before reading them: decode XML entities and percent escapes, discard query/fragment components, and still resolve the resulting path relative to the OPF directory.  ## Source document - Format: EPUB (synthetic minimal fixtures) - Pages / size: one spine item per fixture - Language: English - Does `python3 scripts/extract.py --check` show the relevant extractor installed? not applicable; this is the stdlib fallback used without ebooklib  ## Repro  Create a minimal EPUB whose manifest contains either:  ```xml <item id="c1" href="chapter.xhtml#section-2" media-type="application/xhtml+xml"/> ```  or an OPF in `OEBPS/content.opf` with:  ```xml <item id="c1" href="Text/Chapter%201.xhtml" media-type="application/xhtml+xml"/> ```  while the corresponding ZIP members are `chapter.xhtml` and `OEBPS/Text/Chapter 1.xhtml`. On `maste

- **Issue #227** (2026-09-17): **[bug] Post-extraction file-size errors can still abort a batch**
  *Symptoms*: ## What happened  `extract_single_file()` documents an important batch contract: every per-source failure must surface as `ExtractionError`, because `main()` catches only that exception before continuing with the remaining sources. PR #120 enforced this contract for the initial magic-byte read, but the later file-size lookup still calls `os.path.getsize()` without translating `OSError`.  If a source is removed, replaced, or becomes inaccessible after its content was read but before metadata is assembled, `PermissionError`/`OSError` escapes with a traceback and aborts the entire batch. The trusted pdf-inspector Markdown path has the same unprotected metadata lookup.  ## What you expected  A post-extraction file-size failure should be reported as `ExtractionError` for that source. The batch runner should warn, skip it, and continue processing the remaining inputs, consistently across the legacy and pdf-inspector paths.  ## Source document - Format: Markdown and PDF (synthetic fixtures) - Pages / size: minimal fixtures; content is not relevant - Language: English - Does `python3 scripts/extract.py --check` show the relevant extractor installed? the PDF regression stubs the optional inspector result  ## Repro  Run `extract_single_file()` on a readable Markdown file while making `os.path.getsize()` raise `PermissionError("file became unavailable")`. This deterministically models a file that changes between content extraction and the final metadata lookup.  On `master` (`abc666b`),

- **Issue #219** (2026-09-16): **[bug] Failed pdf-inspector reinspection can reuse stale metadata**
  *Symptoms*: ## What happened  The pdf-inspector integration keeps successful inspection results in the process-level `_INSPECTIONS` mapping so they can later be added to `metadata.json`. An entry is overwritten when a later inspection succeeds, but it is not invalidated before a new attempt.  When the same input path is processed again in the same Python process and the new pdf-inspector preflight returns no metadata (for example, it is unavailable or fails), the previous result remains cached. The next metadata enrichment can therefore report stale pdf-inspector provenance for a run in which that inspection did not succeed.  This affects repeated programmatic/embedded CLI use; separate command-line processes do not share the mapping.  ## What you expected  Each extraction attempt should replace the cached state for its own input path. If the current preflight produces no inspection metadata, enrichment for that path should contain no `pdf_inspector` entry. Results for other files in the same batch should remain intact.  ## Source document - Format: PDF (synthetic `%PDF-1.7` fixture) - Pages / size: minimal fixture; document content is not relevant - Language: N/A - Does `python3 scripts/extract.py --check` show the relevant extractor installed? the deterministic reproduction stubs the optional preflight result  ## Repro  1. Install the pdf-inspector hook once in a Python process. 2. Process a PDF path with an inspection result containing `confidence: 0.5`. 3. Process the same path again

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

### Incident Patch 1: `c108d25b` (2026-09-29)
**Commit Message**: fix(epub): preserve spine order with prefixed OPF elements (#249)

**File**: `book_to_skill/parsers/epub.py` (modified, +22/-4)
```diff
@@ -23,6 +23,19 @@
     ".webp",
 )
 
+# OPF package elements normally use the default OPF namespace, but XML also
+# permits an explicit namespace prefix (for example ``<opf:item>``). Keep the
+# existing tolerant, regex-based fallback while accepting that equivalent form.
+_OPF_ELEMENT_PREFIX = r"(?:[A-Za-z_][\w.-]*:)?"
+
+
+def _opf_opening_tags(opf_text: str, local_name: str) -> list[str]:
+    """Return opening tags for an OPF element, with or without a prefix."""
+    return re.findall(
+        rf"<{_OPF_ELEMENT_PREFIX}{re.escape(local_name)}\b[^>]*?/?>",
+        opf_text,
+    )
+
 
 def extract_with_ebooklib(epub_path: str) -> str | None:
     try:
@@ -96,16 +109,21 @@ def extract_with_zipfile(epub_path: str) -> str | None:
                 # both self-closing <item .../> and <item ...></item> forms work
                 # because all attributes live in the opening tag.
                 manifest: dict[str, str] = {}
-                for item_tag in re.findall(r"<item\b[^>]*?/?>", opf_text):
+                for item_tag in _opf_opening_tags(opf_text, "item"):
                     id_m = re.search(r'\bid=["\']([^"\']+)["\']', item_tag)
                     href_m = re.search(r'\bhref=["\']([^"\']+)["\']', item_tag)
                     if id_m and href_m:
                         resolved = _resolve_manifest_href(href_m.group(1), opf_dir)
                         manifest[id_m.group(1)] = resolved
 
                 # Spine: ordered idrefs -> hrefs (true reading order).
-                for idref in re.findall(r'<itemref\b[^>]*?\bidref=["\']([^"\']+)["\']', opf_text):
-                    href = manifest.get(idref)
+                for itemref_tag in _opf_opening_tags(opf_text, "itemref"):
+                    idref_m = re.search(
+                        r'\bidref=["\']([^"\']+)["\']', itemref_tag
+                    )
+                    if not idref_m:
+                        continue
+                    href = manifest.get(idref_m.group(1))
                     if href and href not in seen:
                         spine_order.append(href)
                         seen.add(href)
@@ -146,7 +164,7 @@ def count_epub_chapters(epub_path: str) -> int:
             if not opf_path:
                 return 0
             opf_text = zf.read(opf_path).decode("utf-8", errors="replace")
-            return len(re.findall(r'<itemref\b', opf_text))
+            return len(_opf_opening_tags(opf_text, "itemref"))
     except Exception:
         return 0
 
```

**File**: `tests/test_book_to_skill.py` (modified, +27/-1)
```diff
@@ -38,7 +38,7 @@
 from book_to_skill.parsers.text import read_text_file
 from book_to_skill.parsers.docx import extract_docx_with_zipfile
 from book_to_skill.parsers.rtf import strip_rtf_fallback
-from book_to_skill.parsers.epub import extract_with_zipfile
+from book_to_skill.parsers.epub import count_epub_chapters, extract_with_zipfile
 
 
 # ═══════════════════════════════════════════════════════════════════════════
@@ -1910,6 +1910,32 @@ def test_spine_order_overrides_manifest_order(self, tmp_path):
         out = extract_with_zipfile(self._make_epub(tmp_path, opf, files))
         assert out.index("FIRST") < out.index("SECOND")
 
+    def test_prefixed_opf_elements_preserve_spine_order_and_count(self, tmp_path):
+        # XML namespace prefixes are semantically equivalent to the default OPF
+        # namespace. File names deliberately sort opposite to the spine so a
+        # missed prefixed manifest/spine cannot pass through the sorted fallback.
+        opf = (
+            '<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="3.0">'
+            '<opf:manifest>'
+            '<opf:item id="c1" href="z-first.xhtml" '
+            'media-type="application/xhtml+xml"/>'
+            '<opf:item id="c2" href="a-second.xhtml" '
+            'media-type="application/xhtml+xml"/>'
+            '</opf:manifest><opf:spine>'
+            '<opf:itemref idref="c1"/><opf:itemref idref="c2"/>'
+            '</opf:spine></opf:package>'
+        )
+        files = {
+            "z-first.xhtml": self._doc("FIRST"),
+            "a-second.xhtml": self._doc("SECOND"),
+        }
+        epub_path = self._make_epub(tmp_path, opf, files)
+
+        out = extract_with_zipfile(epub_path)
+
+        assert out.index("FIRST") < out.index("SECOND")
+        assert count_epub_chapters(epub_path) == 2
+
     def test_non_spine_doc_kept_as_safety_net_after_spine(self, tmp_path):
         opf = (
             '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest>'
```

---

### Incident Patch 2: `bfed408b` (2026-09-29)
**Commit Message**: fix(extractor): stop counting wrapped prose and code lines as chapters (#246)

detect_structure() counts distinct numbers from explicit "Chapter N" headings and
that count wins over the structural (Markdown) count as soon as two numbers
match. Two shapes of ordinary input were counted as chapters:

* a sentence wrapped at the column limit whose continuation line starts with a
  cross-reference ("...as we cover in / Chapter 6. Closures create types that
  only the compiler knows or"), where the capital after the period defeats the
  lowercase-only prose guard;
* a code sample holding a unified diff, where "1  + use crate::trpl::StreamExt;"
  satisfies the plain numbered-heading pattern.

A period tail is now judged by its shape - a title-sized tail stays a heading,
a clause of more than eight words is prose - and a bare "Chapter 6." is judged
against the line above it, because alone it carries no context. Lines inside
closed fences are skipped, matching _structural_chapter_count(), and the plain
pattern rejects the diff markers "+" and "-". Marked headings ("## Chapter 4.
...") are trusted as written.

Refs #237

**File**: `book_to_skill/utils.py` (modified, +85/-9)
```diff
@@ -117,6 +117,23 @@ def estimate_tokens(text: str) -> int:
 # “Chapter 8 are relevant...”) is prose / a cross-reference, not a heading.
 # The uppercase class is À-Þ so titles starting with Ü/Û (common in German, e.g. “Überblick”) are recognized.
 _HEADING_TAIL = re.compile(r"^\s*$|^\s*[.:\-—–]|^\s+(?![a-z])")
+# A tail that opens with a sentence period — "Chapter 4. References are
+# indicated by the `&` symbol…", "Chapter 17.) We have seen…" — is prose wrapped
+# at the column limit, unless it reads like a title. Two shapes, measured on the
+# Rust Book sources (rust-lang/book, MIT OR Apache-2.0, 112 files) where the
+# numeric scan accepted 13 lines and every one of them was prose or code:
+#   * a clause of 10-14 words ("Chapter 4. References are indicated by the `&`
+#     symbol and borrow the value they"), and
+#   * a bare "Chapter 6." ending a sentence that began on the line above.
+# The longest period-tail heading in this repository's fixtures and tests is 5
+# words ("Chapter 1. Introduction to Building AI"). (Issue #237)
+_PERIOD_TAIL = re.compile(r"^\s*\.[)\"'”’\]]*(\s|$)")
+_TAIL_WORD = re.compile(r"[^\s]*[0-9A-Za-z][^\s]*")
+_TITLE_TAIL_MAX_WORDS = 8
+# A line that ends a sentence / paragraph. When the line above does NOT end like
+# this, the next line continues it instead of starting a heading.
+_SENTENCE_END = re.compile(r"[.!?…:;\"'”’)\]]\s*$")
+
 
 # Roman-numeral chapter heading: "I: Loomings", "II. The Carpet-Bag".
 # Uppercase alone at line start is safe — no common English word is a valid
@@ -586,9 +603,34 @@ def _roman_to_int(s: str) -> int | None:
     return total if _int_to_roman(total) == s else None
 
 
-def _match_chapter_number(line: str) -> int | None:
+def _is_prose_period_tail(tail: str, prev_line: str | None) -> bool:
+    """True when a period tail is a wrapped sentence, not a title.
+
+    The context decides first: a line that stands on its own (nothing above it,
+    or the line above ends a sentence) keeps its heading. When the paragraph
+    continues into the line, the tail must read like a title — a bare
+    "Chapter 6." and a clause of more than `_TITLE_TAIL_MAX_WORDS` words are the
+    sentence that wrapped. (Issue #237)
+    """
+    if not _PERIOD_TAIL.match(tail):
+        return False
+    if not prev_line or _SENTENCE_END.search(prev_line):
+        return False
+    words = _TAIL_WORD.findall(tail)
+    return not words or len(words) > _TITLE_TAIL_MAX_WORDS
+
+
+def _match_chapter_number(
+    line: str, prev_line: str | None = None, heading_marked: bool = False
+) -> int | None:
     """Return the chapter number if the line is a genuine chapter heading,
     with no Markdown/AsciiDoc heading prefix (the caller strips it first).
+
+    `prev_line` is the line directly above (None when it is blank or inside a
+    fenced block); it is consulted only for a bare period tail. `heading_marked`
+    says the line carried an explicit "#"/"==" prefix before it was stripped —
+    an explicit heading is trusted as it stands, so "## Chapter 4. References
+    are indicated by the `&` symbol…" keeps counting. (Issue #237)
     """
     # Normalize Kangxi-radical numerals (⼀⼆⼋⼗) to ideographs so Chinese
     # ebooks that encode chapter numbers in the U+2F00 block are detected.
@@ -602,12 +644,20 @@ def _match_chapter_number(line: str) -> int | None:
     #
     # Require at least two spaces after the chapter number. This avoids
     # treating ordinary numbered list items such as "1. Item" as chapters.
-    plain = re.match(r"^([1-9]\d{0,2})\s{2,}\S", s)
-    if plain:
+    #
+    # A unified-diff hunk line starts with exactly that shape
+    # ("1  + use crate::trpl::StreamExt;", "12  - use std::io::prelude::*;").
+    # Its first non-space character is the diff marker, which no chapter title
+    # starts with, so the marker decides. Fenced blocks are skipped by the
+    # caller; this covers code that arrives without fences. (Issue #237)
+    plain = re.match(r"^([1-9]\d{0,2})\s{2,}(\S)", s)
+    if plain and plain.group(2) not in "+-":
         return int(plain.group(1))
 
     m = _EXPLICIT_CHAPTER.match(s)
     if m and _HEADING_TAIL.match(m.group("rest")):
+        if not heading_marked and _is_prose_period_tail(m.group("rest"), prev_line):
+            return None
         if m.group(1):
             return int(m.group(1))
         return _roman_to_int(m.group("roman").upper())
@@ -661,9 +711,12 @@ def _match_chapter_number(line: str) -> int | None:
     return None
 
 
-def _chapter_number(line: str) -> int | None:
+def _chapter_number(line: str, prev_line: str | None = None) -> int | None:
     """Return the chapter number if the line is a genuine chapter heading.
 
+    `prev_line` is the line directly above (None when it is blank or inside a
+    fenced block); see `_match_chapter_number` for how it is used.
+
     Handles Arabic ("Chapter 5", "Capítulo 5: ..."), Roman-numeral
     ("I: Loomings", "## i. introduction", "II. The Carpet-Bag"),
     Chin
```

**File**: `tests/test_chapter_numeric_false_positives.py` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+"""Prose and code lines must not turn into chapters in the numeric scan.
+
+`detect_structure()` counts distinct numbers from explicit "Chapter N" headings,
+and that count wins over the structural (Markdown) count as soon as two numbers
+match. Two shapes of ordinary input produced numbers that were not headings
+(issue #237):
+
+* a sentence wrapped at the column limit, where the continuation line starts
+  with a cross-reference —
+  ``...as we cover in\\nChapter 6. Closures create types that only the compiler...``
+  — and the capital letter after the period defeats the lowercase-only prose
+  guard in ``_HEADING_TAIL``;
+* a code sample holding a unified diff, where ``1  + use crate::trpl::StreamExt;``
+  satisfies the plain numbered-heading pattern.
+
+The tail of a heading is judged from the line above it: a period tail is prose
+when the paragraph continues into it and the tail reads as a sentence rather
+than a title. A line that stands on its own keeps its heading, including a bare
+"Chapter 6.".
+"""
+
+import sys
+from pathlib import Path
+
+ROOT_DIR = Path(__file__).resolve().parent.parent
+sys.path.insert(0, str(ROOT_DIR))
+
+from book_to_skill.utils import _chapter_number, detect_structure
+
+CHAPTER_BODY = "prose carrying the section's actual content. " * 40
+
+# A sentence wrapped at the column limit: the continuation line opens with the
+# cross-reference and the previous line does not end a sentence.
+WRAP_PREV = "The borrow checker rules are explained in more detail as we cover in"
+WRAP_LINE = "Chapter 4. References are indicated by the & symbol and borrow the value they"
+
+FENCED_DIFF = "```diff\n1  + use crate::trpl::StreamExt;\n2  - use std::io::prelude::*;\n```\n"
+
+
+class TestWrappedProseIsNotAChapter:
+    def test_capitalized_continuation_line_is_not_a_heading(self):
+        assert _chapter_number(WRAP_LINE, prev_line=WRAP_PREV) is None
+
+    def test_parenthetical_continuation_line_is_not_a_heading(self):
+        line = "Chapter 17.) We have seen a solution to this problem a few times now: We can"
+        assert _chapter_number(line, prev_line=WRAP_PREV) is None
+
+    def test_standalone_period_heading_is_kept(self):
+        # "Chapter 6." on a line of its own carries no context that makes it
+        # prose, so it stays a heading (see the maintainer note on #237).
+        assert _chapter_number("Chapter 6.") == 6
+
+    def test_bare_tail_inside_a_wrapped_sentence_is_not_a_heading(self):
+        # "... that we discussed in / Chapter 6." is one sentence (Rust Book,
+        # ch09-02).
+        assert _chapter_number("Chapter 6.", prev_line="`Result` using a basic tool, the `match` expression that we discussed in") is None
+
+    def test_title_sized_tail_after_an_unfinished_line_is_kept(self):
+        # The plain-text fixture layout: heading lines separated by a body line
+        # that is not a sentence.
+        assert _chapter_number("Chapter 2. Understanding Models", prev_line="body") == 2
+
+    def test_long_tail_on_a_marked_heading_is_trusted(self):
+        assert (
+            _chapter_number(
+                "## Chapter 4. References are indicated by the `&` symbol and borrow the value they"
+            )
+            == 4
+        )
+
+    def test_long_tail_on_a_standalone_line_is_kept(self):
+        # Conservative on purpose: without the enclosing paragraph there is no
+        # evidence that a sentence wrapped, so the line keeps its heading — the
+        # shape a PDF extractor produces once it has lost the wrap.
+        assert (
+            _chapter_number(
+                "Chapter 13. Closures and iterators create types that only the compiler knows or"
+            )
+            == 13
+        )
+
+    def test_heading_after_a_finished_sentence_is_kept(self):
+        assert _chapter_number("Chapter 6. Enums", prev_line="Section one ends here.") == 6
+
+    def test_colon_tail_after_prose_is_kept(self):
+        # A colon introduces a title, not a sentence: "see Chapter 6: Enums".
+        assert _chapter_number("Chapter 6: Enums", prev_line=WRAP_PREV) == 6
+
+    def test_heading_controls_are_retained(self):
+        kept = (
+            "Chapter 6",
+            "# Chapter 6",
+            "## Chapter 6: Enums",
+            "Chapter 1. Intro",
+            "Capítulo 5",
+            "Unit 1 — How to Write an Introduction",
+            "## i. introduction",
+        )
+        for line in kept:
+            assert _chapter_number(line) is not None, line
+
+
+class TestCodeLinesAreNotChapters:
+    def test_bare_diff_lines_are_not_chapters(self):
+        assert _chapter_number("1  + use crate::trpl::StreamExt;") is None
+        assert _chapter_number("12  - use std::io::prelude::*;") is None
+
+    def test_plain_numbered_heading_is_kept(self):
+        assert _chapter_number("1  Introduction") == 1
+
+    def test_fenced_diff_does_not_count(self):
+        text = (
+            "## Real One\n" + CHAPTER_BODY + "\n
```

---

### Incident Patch 3: `5cd16274` (2026-09-29)
**Commit Message**: fix(extractor): retain per-source chapter heading samples (#245)

* fix(extractor): retain per-source chapter heading samples

* test(extractor): resolve extraction helpers through their module

---------

Co-authored-by: Bryan Nathan <[REDACTED_EMAIL]>

**File**: `book_to_skill/utils.py` (modified, +1/-0)
```diff
@@ -1336,6 +1336,7 @@ def main():
                 "images_dropped": src["images_dropped"],
                 "chapters_detected": src["chapters_detected"],
                 "chapters_method": src["chapters_method"],
+                "chapter_headings_sample": src["chapter_headings_sample"],
                 "has_toc": src["has_toc"]
             }
             for src in extracted_sources
```

**File**: `tests/test_source_chapter_samples.py` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+"""The CLI must retain the heading samples it already extracted per source."""
+
+import json
+import os
+import subprocess
+import sys
+from pathlib import Path
+
+import pytest
+
+ROOT_DIR = Path(__file__).resolve().parent.parent
+sys.path.insert(0, str(ROOT_DIR))
+
+from book_to_skill import utils
+
+
+def _numbered_book(title):
+    return "\n\n".join(
+        f"# Chapter {number}: {title} {number}\nBody for this chapter."
+        for number in range(1, 13)
+    )
+
+
+ALPHA = _numbered_book("Alpha")
+BETA = _numbered_book("Beta")
+PLAIN = "Ordinary prose without any chapter headings.\n"
+STRUCTURAL = "# Book\n\n## First topic\nBody one.\n\n## Second topic\nBody two.\n"
+UNICODE = "第一章 緒論\n\nBody one.\n\n第二章 架構\n\nBody two.\n"
+
+
+@pytest.mark.parametrize(
+    "texts,expected_samples",
+    [
+        ([ALPHA], [[f"# Chapter {n}: Alpha {n}" for n in range(1, 11)]]),
+        (
+            [ALPHA, BETA],
+            [[f"# Chapter {n}: {title} {n}" for n in range(1, 11)]
+             for title in ("Alpha", "Beta")],
+        ),
+        (
+            [BETA, ALPHA],
+            [[f"# Chapter {n}: {title} {n}" for n in range(1, 11)]
+             for title in ("Beta", "Alpha")],
+        ),
+        ([PLAIN, STRUCTURAL], [[], []]),
+        ([UNICODE], [["第一章 緒論", "第二章 架構"]]),
+    ],
+    ids=["single", "multi", "reversed", "empty-samples", "unicode"],
+)
+def test_cli_preserves_source_chapter_samples(tmp_path, texts, expected_samples):
+    paths = []
+    for index, text in enumerate(texts):
+        path = tmp_path / f"source{index}.md"
+        path.write_text(text, encoding="utf-8")
+        paths.append(path)
+
+    extracted = [utils.extract_single_file(path, "text", "no") for path in paths]
+    # Establish the input-side contract independently of the JSON projection.
+    assert [src["chapter_headings_sample"] for src in extracted] == expected_samples
+
+    workdir = tmp_path / "output"
+    env = dict(os.environ, BOOK_SKILL_WORKDIR=str(workdir))
+    proc = subprocess.run(
+        [sys.executable, str(ROOT_DIR / "scripts" / "extract.py"),
+         *map(str, paths), "--mode", "text", "--install-missing", "no"],
+        env=env, capture_output=True, text=True, timeout=30,
+    )
+    assert proc.returncode == 0, proc.stdout + proc.stderr
+    metadata = json.loads((workdir / "metadata.json").read_text(encoding="utf-8"))
+    assert metadata["total_sources"] == len(paths)
+    assert [src["chapter_headings_sample"] for src in metadata["sources"]] == expected_samples
+
+    # The added field must not change source counts or consolidated detection.
+    for saved, original in zip(metadata["sources"], extracted):
+        for key in ("source_file", "chapters_detected", "chapters_method", "has_toc"):
+            assert saved[key] == original[key]
+    consolidated = utils.detect_structure("\n\n".join(src["text"] for src in extracted))
+    for key in ("chapters_detected", "chapters_method", "chapter_headings_sample"):
+        assert metadata[key] == consolidated[key]
+    output_text = (workdir / "full_text.txt").read_text(encoding="utf-8")
+    for src in extracted:
+        assert src["text"].strip() in output_text
```

---

### Incident Patch 4: `8610aa5e` (2026-09-29)
**Commit Message**: fix(skill): stop and ask before re-converting an existing skill (re-run guard) (#224)

* fix(skill): stop and ask before re-converting an existing skill (re-run guard)

A Full Conversion of a source whose target skill already exists re-runs the
entire extraction before Step 5 derives the slug and notices the collision.
Mode 4 (Update/Fold-in) cannot catch a naive re-run: its trigger requires the
user to request an update, and Step 0's own check only fires when the input
path is a skill dir or the slug was given as an argument.

Guard: derive the prospective slug under both Step 5 naming forms
(author-concept and by-title) plus any SKILL_NAME, check SKILLS_HOME, and on
a match STOP and let the user choose fold-in / verify / force regeneration.
Recovery after an interrupted run resumes the existing work directory.

Tests: tests/test_rerun_guard.py (3 assertions incl. both naming forms).

* fix(skill): gate workdir reuse on a matching manifest and resolve the destination before the existing-skill check

* fix(skill): gate re-run reuse on a per-source content fingerprint

**File**: `SKILL.md` (modified, +3/-1)
```diff
@@ -92,10 +92,12 @@ If no arguments are provided, stop and respond:
 > "book-to-skill requires a supported document path, folder, or glob pattern. Usage: `book-to-skill <path-to-document-folder-or-glob>... [skill-name-slug]`"
 
 Throughout the workflow:
+- **Resolve the destination root first.** Before any existing-skill lookup, determine where this run would write: the personal or project-local root for the user's host, per the Step 5 table and selection rules — a project-local request uses its project-local root, never the personal root. Below, "the resolved root" means that destination.
 - Identify the input paths and the optional skill slug.
 - If the last argument is not a file, folder, or glob that exists or matches any files, and it looks like a skill slug (e.g. lowercase hyphens, alphanumeric), treat it as `SKILL_NAME`.
 - Treat all other arguments as the list of `INPUT_PATHS`.
-- If any input path is an existing skill directory (contains `SKILL.md` and a `chapters/` sub-folder), or if `SKILL_NAME` matches an existing skill slug in `SKILLS_HOME`, flag this run as an **Update/Fold-in** operation (Mode 4).
+- If any input path is an existing skill directory (contains `SKILL.md` and a `chapters/` sub-folder), or if `SKILL_NAME` matches an existing skill slug in the resolved root, flag this run as an **Update/Fold-in** operation (Mode 4).
+- **Re-run guard.** Before starting extraction for a Full Conversion, derive the prospective skill slug under Step 5's naming options — the author-concept form, the by-title form, and any `SKILL_NAME` given — and check the resolved root for an existing match. On a match, STOP and ask the user: "`<skill-name>` already exists. Choose: (1) Update/Fold-in (Mode 4), (2) verify the existing skill is complete and stop, or (3) force full regeneration." Do not re-extract until the user chooses. On context recovery after an interrupted run (network cut-off, replayed or continued conversation), reuse the extraction work directory that run reported (`Workdir ->` in its output, or the path you set in `BOOK_SKILL_WORKDIR`) **only if it is still intact and still matches the current inputs and options** — the directory exists, its `metadata.json` is readable, the `sources` it lists match the files being converted now one-to-one on filename **and content fingerprint** (the extractor records a per-source `sha256` in `metadata.json`; recompute the fingerprint from each file as it exists now and require an exact match — `reuse_is_safe()` in `book_to_skill/utils.py` is the executable form of this check), and its recorded `extraction_mode` is the mode this run is using (Step 2's "confirm the extraction is the document you asked for" rule). If it is missing (temp cleanup), its `metadata.json` is gone, the sources no longer match (a different filename, or a changed content fingerprint), the recorded metadata has no `sha256` for a source (recorded before fingerprints existed, so freshness cannot be established), or the mode differs, say so and start a fresh extraction instead of resuming. When in doubt, ask the user before discarding or resuming.
 
 ---
 
```

**File**: `book_to_skill/pdf_inspector_integration.py` (modified, +8/-0)
```diff
@@ -147,6 +147,12 @@ def _result_from_inspector(
     tokens = utils_module.estimate_tokens(text)
     try:
         file_size_mb = os.path.getsize(input_path) / (1024 * 1024)
+        # Import lazily rather than reaching into the (possibly fake) utils
+        # namespace: existing tests pass a minimal SimpleNamespace as
+        # utils_module, and hashing is a pure function of the file on disk —
+        # it must not depend on which utils object the hook was installed with.
+        from book_to_skill.utils import _sha256_file
+        file_sha256 = _sha256_file(str(input_path))
     except OSError as exc:
         raise ExtractionError(
             f"Could not read file size for {input_path.name}: {exc}"
@@ -158,6 +164,7 @@ def _result_from_inspector(
         "format": "pdf",
         "extraction_method": "pdf-inspector",
         "file_size_mb": round(file_size_mb, 2),
+        "sha256": file_sha256,
         "pages": pages,
         "pages_label": "pages",
         "chars": len(text),
@@ -272,3 +279,4 @@ def enrich_pdf_inspector_metadata(metadata_path: str | Path | None = None) -> No
 
 def _reset_state_for_tests() -> None:
     _INSPECTIONS.clear()
+
```

**File**: `book_to_skill/utils.py` (modified, +78/-3)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import glob
+import hashlib
 import json
 import os
 import re
@@ -845,13 +846,84 @@ def resolve_input_files(paths: list[str]) -> list[Path]:
     return unique_paths
 
 
+def _sha256_file(path: str) -> str:
+    """Streaming sha256 — constant memory for multi-GB sources."""
+    h = hashlib.sha256()
+    with open(path, "rb") as f:
+        for chunk in iter(lambda: f.read(1 << 20), b""):
+            h.update(chunk)
+    return h.hexdigest()
+
+
+def reuse_is_safe(current_inputs, metadata, current_mode):
+    """Decide whether an interrupted run's extraction workdir is safe to resume.
+
+    current_inputs: list of (path, fingerprint) — fingerprint is the sha256
+    hexdigest of each file as it exists NOW, recomputed by the caller
+    (hashlib.sha256(path.read_bytes()).hexdigest(); _sha256_file is available
+    for streaming on large files). Size is deliberately NOT part of matching:
+    metadata.json only records file_size_mb rounded to 2 decimals, so an
+    exact-size comparison is unimplementable — the fingerprint subsumes size
+    entirely.
+
+    metadata: the recorded run's metadata dict (parsed metadata.json).
+    current_mode: the extraction mode THIS run intends ("technical" or "text").
+
+    Returns (ok, reason). ok=True only when ALL hold:
+      - metadata["workdir"] exists and is a directory
+      - metadata["extraction_mode"] == current_mode
+      - the recorded sources match the current inputs one-to-one on
+        filename AND sha256 — the recomputed fingerprints vs the recorded ones
+    Anything else: (False, reason) — the caller must start a fresh
+    extraction (or ask the user when unsure), never resume.
+    """
+    if not isinstance(metadata, dict):
+        return False, "metadata.json unreadable or not an object"
+
+    workdir = metadata.get("workdir")
+    if not workdir or not os.path.isdir(workdir):
+        return False, "workdir missing or unreadable"
+
+    if metadata.get("extraction_mode") != current_mode:
+        return False, (
+            f"mode changed (recorded {metadata.get('extraction_mode')!r}, "
+            f"current is {current_mode!r})"
+        )
+
+    recorded = metadata.get("sources") or []
+    if len(recorded) != len(current_inputs):
+        return False, "sources changed"
+
+    current = {}
+    for path, fingerprint in current_inputs:
+        current[Path(path).name] = fingerprint
+    if len(current) != len(recorded):
+        # Duplicate filenames cannot be matched one-to-one.
+        return False, "sources changed"
+
+    for src in recorded:
+        filename = src.get("filename")
+        if filename not in current:
+            return False, f"sources changed (recorded {filename!r} is not in this run)"
+        recorded_hash = src.get("sha256")
+        if not recorded_hash:
+            return False, (
+                f"no recorded fingerprint for {filename} — legacy metadata "
+                "(recorded before fingerprints existed)"
+            )
+        if recorded_hash != current[filename]:
+            return False, f"content changed for {filename}"
+
+    return True, "workdir intact and all sources match the current inputs"
+
+
 def extract_single_file(input_path: Path, extraction_mode: str, install_mode: str) -> dict:
     """Extract text and metadata from a single file path."""
     input_str = str(input_path)
-    
+
     if not input_path.exists():
         raise ExtractionError(f"File not found: {input_str}")
-        
+
     ext = input_path.suffix.lower()
     document_format = ext.lstrip(".")
     
@@ -1050,17 +1122,18 @@ def extract_single_file(input_path: Path, extraction_mode: str, install_mode: st
     )
     try:
         file_size_mb = os.path.getsize(input_str) / (1024 * 1024)
+        file_sha256 = _sha256_file(input_str)
     except OSError as exc:
         raise ExtractionError(
             f"Could not read file size for {input_path.name}: {exc}"
         ) from exc
-    
     return {
         "source_file": str(input_path.resolve()),
         "filename": input_path.name,
         "format": document_format,
         "extraction_method": method,
         "file_size_mb": round(file_size_mb, 2),
+        "sha256": file_sha256,
         pages_label: pages,
         "pages_label": pages_label,
         "pages": pages,
@@ -1254,6 +1327,7 @@ def main():
                 "format": src["format"],
                 "extraction_method": src["extraction_method"],
                 "file_size_mb": src["file_size_mb"],
+                "sha256": src["sha256"],
                 "pages": src["pages"],
                 "pages_label": src["pages_label"],
                 "chars": src["chars"],
@@ -1315,3 +1389,4 @@ def main():
             print(f"     - {path.name}: {err}")
     else:
         print_support_note()
+
```

**File**: `tests/test_fingerprint.py` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+"""Per-source content fingerprint recorded by the extractor (round-2 ask)."""
+import hashlib
+import json
+from pathlib import Path
+
+from book_to_skill.utils import _sha256_file, extract_single_file, reuse_is_safe
+
+
+def _write(tmp_path: Path, name: str, content: str) -> Path:
+    p = tmp_path / name
+    p.write_text(content, encoding="utf-8")
+    return p
+
+
+def test_metadata_records_sha256_per_source(tmp_path):
+    src = _write(tmp_path, "doc.txt", "chapter one\n" + "body text.\n" * 500)
+    res = extract_single_file(src, "auto", "ask")
+    expected = hashlib.sha256(src.read_bytes()).hexdigest()
+    assert res["sha256"] == expected
+
+
+def test_same_size_different_content_gives_different_fingerprint(tmp_path):
+    # The maintainer's exact scenario: same filename, same byte size,
+    # changed content. Round-1 gate (name+size) passes both; fingerprint must not.
+    a = _write(tmp_path, "doc_a.txt", "Allow sharing.\n" + "x" * 1000)
+    b = _write(tmp_path, "doc_b.txt", "Avoid sharing.\n" + "x" * 1000)
+    assert len(a.read_bytes()) == len(b.read_bytes())   # sanity: same size
+    ra = extract_single_file(a, "auto", "ask")
+    rb = extract_single_file(b, "auto", "ask")
+    assert ra["sha256"] != rb["sha256"]
+
+
+def test_metadata_sources_list_carries_sha256(tmp_path, monkeypatch):
+    # The guard reads metadata.json, so the per-source fingerprint must survive
+    # consolidation. Follows test_metadata_encoding.py's pattern: run main()
+    # end-to-end with OUTPUT_META pointed at a tmp path, then parse the JSON.
+    from book_to_skill.utils import main
+
+    src = _write(tmp_path, "doc.txt", "content\n" * 100)
+    expected = hashlib.sha256(src.read_bytes()).hexdigest()
+
+    out_dir = tmp_path / "output"
+    out_meta = out_dir / "metadata.json"
+    monkeypatch.setenv("BOOK_SKILL_WORKDIR", str(out_dir))
+    monkeypatch.setattr("book_to_skill.utils.OUTPUT_DIR", out_dir)
+    monkeypatch.setattr("book_to_skill.utils.OUTPUT_TEXT", out_dir / "full_text.txt")
+    monkeypatch.setattr("book_to_skill.utils.OUTPUT_META", out_meta)
+    monkeypatch.setattr("book_to_skill.utils.prepare_dependencies", lambda *a: None)
+    monkeypatch.setattr(
+        "sys.argv", ["extract.py", str(src), "--install-missing", "no"]
+    )
+
+    main()
+    meta = json.loads(out_meta.read_text(encoding="utf-8"))
+    assert meta["sources"][0]["sha256"] == expected
+
+
+def test_hook_path_result_carries_sha256(tmp_path, monkeypatch):
+    # Text-mode PDFs take the pdf-inspector fast path, which returns its own
+    # per-source dict. That dict must carry the fingerprint too (review F3).
+    from types import SimpleNamespace
+
+    import book_to_skill.pdf_inspector_integration as pii
+
+    src = _write(tmp_path, "doc.pdf", "%PDF-1.4 fake minimal payload\n" * 50)
+    expected = hashlib.sha256(src.read_bytes()).hexdigest()
+
+    fake_utils = SimpleNamespace(
+        extract_single_file=lambda *a: {"extraction_method": "legacy"},
+        sanitize_extracted_text=lambda text: (text, 0),
+        detect_structure=lambda t: {
+            "chapters_detected": 0,
+            "chapters_method": "none",
+            "has_toc": False,
+        },
+        count_pages=lambda p: 1,
+        estimate_tokens=lambda t: len(t) // 4,
+    )
+    inspection = {
+        "confidence": 0.99,
+        "page_count": 1,
+        "pdf_type": "text_based",
+        "native_markdown_trusted": True,
+        "pages_needing_ocr": [],
+        "has_encoding_issues": False,
+    }
+
+    pii._reset_state_for_tests()
+    # monkeypatch, NOT bare assignment — a bare `pii.inspect_pdf = ...` leaks
+    # across the whole suite (later pdf-inspector tests then see the stub).
+    monkeypatch.setattr(
+        pii, "inspect_pdf", lambda _path: ("# Native Markdown\nBody", inspection)
+    )
+    pii.install_pdf_inspector_hook(fake_utils)
+    res = fake_utils.extract_single_file(src, "text", "ask")
+    assert res["sha256"] == expected
+
+
+# ---------------------------------------------------------------------------
+# Phase 2 — the executable reuse decision (round-2 ask d)
+# ---------------------------------------------------------------------------
+
+
+def _make_metadata(tmp_path, src: Path, mode="text"):
+    res = extract_single_file(src, mode, "ask")
+    workdir = tmp_path / "work"
+    workdir.mkdir(exist_ok=True)   # the happy path needs an EXISTING workdir
+    return {
+        "workdir": str(workdir),
+        # extract_single_file's return dict has extraction_METHOD, not
+        # extraction_MODE — the mode key only exists at metadata.json top level.
+        # Take it from the mode parameter.
+        "extraction_mode": mode,
+        "sources": [
+            {k: res[k] for k in ("filename", "file_size_mb", "sha256")}
+        ],
+    }, res
+
+
+def test_scenario_reuse_same_content(tmp_path):
+    src = _write(tmp_path, "doc.txt", "chapter one\n" + "body.\n" * 500)
+    meta, res = _make_metadata(tm
```

**File**: `tests/test_rerun_guard.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+"""Re-run guard contract in the converter spec (Step 0)."""
+
+from pathlib import Path
+
+ROOT = Path(__file__).resolve().parent.parent
+SKILL = (ROOT / "SKILL.md").read_text(encoding="utf-8")
+
+
+def test_step0_contains_rerun_guard():
+    step0 = SKILL[SKILL.index("## Step 0"):SKILL.index("## Step 1 ")]
+    assert "Re-run guard" in step0
+    assert "STOP" in step0
+    assert "Update/Fold-in (Mode 4)" in step0  # points the user at the escape hatch
+
+
+def test_guard_covers_both_step5_naming_forms():
+    # Step 5 can name a generated skill either by author-concept or by title.
+    # The guard must check both, or an existing author-concept skill
+    # (e.g. chilukuri-agenticops) is missed when the title differs.
+    step0 = SKILL[SKILL.index("## Step 0"):SKILL.index("## Step 1 ")]
+    assert "author-concept" in step0
+    assert "by-title" in step0
+
+
+def test_guard_runs_before_extraction():
+    # The guard must live in Step 0, i.e. before the extraction step in file order.
+    assert SKILL.index("Re-run guard") < SKILL.index("## Step 2 ")
+
+def _step0():
+    return SKILL[SKILL.index("## Step 0"):SKILL.index("## Step 1 ")]
+
+
+def test_reuse_requires_an_intact_matching_workdir():
+    # Reviewer ask 1: reuse must be gated, not unconditional.
+    guard = _step0()
+    guard = guard[guard.index("Re-run guard"):]
+    assert "only if it is still intact and still matches the current inputs and options" in guard
+    assert "metadata.json" in guard
+    assert "never restart extraction from scratch" not in guard
+
+
+def test_reuse_match_covers_source_and_config():
+    # Reviewer ask 1 said "matching the current source/config" — filenames alone
+    # would let an in-place edit pass; the mode check covers the config half.
+    # Round 2: the content half is a recorded fingerprint, not a size.
+    guard = _step0()
+    guard = guard[guard.index("Re-run guard"):]
+    assert "and content fingerprint" in guard
+    assert "sha256" in guard
+    assert "extraction_mode" in guard
+
+
+def test_missing_or_stale_workdir_falls_back_to_fresh_extraction():
+    # Reviewer ask 1: deleted/cleaned workdir or changed input -> fresh extraction.
+    guard = _step0()
+    guard = guard[guard.index("Re-run guard"):]
+    assert "start a fresh extraction instead of resuming" in guard
+    assert "missing (temp cleanup)" in guard
+    assert "the sources no longer match" in guard
+    assert "ask the user before discarding or resuming" in guard
+
+
+def test_destination_resolved_before_the_step0_lookup():
+    # Reviewer ask 2: resolution must precede the Mode 4 lookup, not follow it.
+    step0 = _step0()
+    assert "Resolve the destination root first" in step0
+    assert step0.index("Resolve the destination root first") < step0.index(
+        "flag this run as an **Update/Fold-in** operation"
+    )
+
+
+def test_step0_lookups_never_use_raw_skills_home():
+    # Reviewer ask 2: SKILLS_HOME is only selected in Step 5, so Step 0 must not
+    # consult it — a project-local request would hit the personal root by accident.
+    assert "SKILLS_HOME" not in _step0()
+
+
+def test_guard_names_the_legacy_metadata_fallback():
+    # Round-2 ask: metadata recorded before fingerprints existed cannot establish
+    # freshness, so the guard must name that fallback rather than let a
+    # sha256-less source be treated as matching.
+    guard = _step0()
+    guard = guard[guard.index("Re-run guard"):]
+    assert "no `sha256` for a source" in guard
+    assert "recorded before fingerprints existed" in guard
```

---

### Incident Patch 5: `10112e81` (2026-09-29)
**Commit Message**: fix(extractor): stop the Calibre path reusing a previous source's output (#229)

* fix(extractor): stop the Calibre path reusing a previous source's output

extract_with_ebook_convert() wrote to a fixed filename in the run's work
directory and treated "exit code 0 and the file exists" as success. The work
directory is per-process and shared by every source in a batch, so a
conversion that reports success without writing anything was satisfied by a
file an earlier source had left behind: one book's text returned for another
source, and recorded under that source's name in metadata.json.

Each call now gets its own output filename, so the existence check can only
be true for a file this call wrote.

* fix(extractor): convert into a per-call TemporaryDirectory under OUTPUT_DIR

Review feedback on the pid+counter name: a reused pid in a second
interpreter sharing BOOK_SKILL_WORKDIR collapses back to the first run's
name, so the second conversion exits 0 without writing and still returns
the first process's text.

Each call now allocates a fresh TemporaryDirectory inside OUTPUT_DIR —
unaddressable from outside the call — and reads the text before cleanup.
Removes the per-source intermed

**File**: `book_to_skill/parsers/calibre.py` (modified, +40/-12)
```diff
@@ -4,23 +4,51 @@
 import shutil
 import subprocess
 import sys
+import tempfile
+from pathlib import Path
+
 from book_to_skill.config import OUTPUT_DIR
+from book_to_skill.exceptions import ExtractionError
 
 
 def extract_with_ebook_convert(input_path: str) -> str | None:
     if not shutil.which("ebook-convert"):
         return None
-    output_path = OUTPUT_DIR / "ebook-convert-output.txt"
+
+    # Each call converts into its own temporary directory under OUTPUT_DIR. The
+    # work directory is shared by every source in a batch — and by separate runs
+    # whenever BOOK_SKILL_WORKDIR is set explicitly — so any output reachable by
+    # a predictable name can be satisfied by an earlier run's leftover: a
+    # conversion that reports success without writing anything would return that
+    # earlier file's text and record it under the current source's name. A
+    # per-pid counter is not enough, because a reused pid across two interpreters
+    # collapses back to the same name; a fresh TemporaryDirectory is
+    # unaddressable from outside this call. Cleanup on exit also stops one full
+    # intermediate text per source from piling up in the work directory.
+    #
+    # A directory that cannot be created is raised, not swallowed: returning None
+    # here would be indistinguishable from "converted fine, wrote nothing", which
+    # is exactly the silent-failure shape this function is meant to refuse.
     try:
-        input_path = os.path.abspath(input_path)
-        result = subprocess.run(
-            ["ebook-convert", input_path, str(output_path)],
-            capture_output=True, text=True, timeout=300
-        )
-        if result.returncode == 0 and output_path.exists():
-            text = output_path.read_text(encoding="utf-8", errors="replace")
-            if text.strip():
-                return text
-    except Exception as e:
-        print(f"  [warn] extract_with_ebook_convert failed: {type(e).__name__}: {e}", file=sys.stderr)
+        tmp_ctx = tempfile.TemporaryDirectory(dir=OUTPUT_DIR, prefix="ebook-convert-")
+    except OSError as e:
+        raise ExtractionError(
+            f"cannot create a conversion directory under {OUTPUT_DIR}: {e}"
+        ) from e
+
+    with tmp_ctx as tmp_name:
+        output_path = Path(tmp_name) / "ebook-convert-output.txt"
+        try:
+            input_path = os.path.abspath(input_path)
+            result = subprocess.run(
+                ["ebook-convert", input_path, str(output_path)],
+                capture_output=True, text=True, timeout=300
+            )
+            # Read before the with-block exits: cleanup deletes the directory.
+            if result.returncode == 0 and output_path.exists():
+                text = output_path.read_text(encoding="utf-8", errors="replace")
+                if text.strip():
+                    return text
+        except Exception as e:
+            print(f"  [warn] extract_with_ebook_convert failed: {type(e).__name__}: {e}", file=sys.stderr)
     return None
```

**File**: `tests/test_calibre_stale_output.py` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+"""Regression tests: the Calibre path must not reuse an earlier source's output.
+
+`extract_with_ebook_convert()` treats "exit code 0 and the output file exists"
+as success. The work directory is shared by every source in one batch, and by
+separate runs whenever BOOK_SKILL_WORKDIR is set explicitly, so when a
+conversion reports success without writing anything, output left by an earlier
+source or an earlier *run* satisfies that check: one book's text is returned for
+another source and recorded under *its* name in metadata.json. Nothing
+downstream can tell, which is the same failure mode as the shared
+work-directory bug (see test_per_run_workdir.py).
+
+The fix converts into a fresh TemporaryDirectory per call, so "the file
+exists" can only be true for a file this call wrote — regardless of what
+earlier runs left behind, even with the same pid.
+
+No Calibre install is required — `shutil.which` and `subprocess.run` are patched.
+"""
+
+import importlib
+import sys
+from pathlib import Path
+from unittest import mock
+
+import pytest
+
+ROOT_DIR = Path(__file__).resolve().parent.parent
+sys.path.insert(0, str(ROOT_DIR))
+
+from book_to_skill.exceptions import ExtractionError  # noqa: E402
+
+BOOK_A_TEXT = "TEXT OF BOOK A\n"
+
+
+@pytest.fixture
+def calibre_module(monkeypatch, tmp_path):
+    """Import the parser against an isolated work directory.
+
+    config reads BOOK_SKILL_WORKDIR at import time, so it is imported after the
+    env var is set — and reloaded so a previously imported config cannot leave
+    the real temp work directory in place.
+    """
+    monkeypatch.setenv("BOOK_SKILL_WORKDIR", str(tmp_path))
+    import book_to_skill.config as config
+
+    importlib.reload(config)
+    import book_to_skill.parsers.calibre as calibre
+
+    importlib.reload(calibre)
+    yield calibre, tmp_path
+    # Leave the module-level OUTPUT_DIR pointing somewhere harmless for later tests.
+    monkeypatch.delenv("BOOK_SKILL_WORKDIR", raising=False)
+    importlib.reload(config)
+    importlib.reload(calibre)
+
+
+def _convert_without_writing(calibre, source_name="bookB.mobi"):
+    """Model ebook-convert reporting success while writing nothing."""
+    with mock.patch.object(calibre.shutil, "which", return_value="/usr/bin/ebook-convert"), \
+         mock.patch.object(calibre.subprocess, "run", return_value=mock.Mock(returncode=0)):
+        return calibre.extract_with_ebook_convert(source_name)
+
+
+def test_output_name_is_unique_per_call(calibre_module):
+    """Two conversions must not share one output file."""
+    calibre, workdir = calibre_module
+    seen = []
+
+    def record_output_path(argv, **_kwargs):
+        seen.append(Path(argv[2]))
+        Path(argv[2]).write_text(f"text {len(seen)}\n", encoding="utf-8")
+        return mock.Mock(returncode=0)
+
+    with mock.patch.object(calibre.shutil, "which", return_value="/usr/bin/ebook-convert"), \
+         mock.patch.object(calibre.subprocess, "run", side_effect=record_output_path):
+        first = calibre.extract_with_ebook_convert("bookA.mobi")
+        second = calibre.extract_with_ebook_convert("bookB.mobi")
+
+    assert first == "text 1\n"
+    assert second == "text 2\n", "the second conversion read the first one's file"
+    assert seen[0] != seen[1]
+    # Both live inside the shared work directory (in per-call subdirectories)...
+    assert seen[0].parent.parent == workdir and seen[1].parent.parent == workdir
+    # ...but in different per-call directories, and neither survives the call.
+    assert seen[0].parent != seen[1].parent
+    leftovers = [p for p in workdir.iterdir()]
+    assert leftovers == [], "per-call directories must be cleaned up on exit"
+
+
+def test_success_without_output_does_not_reuse_an_earlier_result(calibre_module):
+    """A previous source's output must not satisfy a later, empty conversion."""
+    calibre, workdir = calibre_module
+
+    def run_writes_output(argv, **_kwargs):
+        Path(argv[2]).write_text(BOOK_A_TEXT, encoding="utf-8")
+        return mock.Mock(returncode=0)
+
+    with mock.patch.object(calibre.shutil, "which", return_value="/usr/bin/ebook-convert"), \
+         mock.patch.object(calibre.subprocess, "run", side_effect=run_writes_output):
+        text_a = calibre.extract_with_ebook_convert("bookA.mobi")
+    assert text_a == BOOK_A_TEXT
+
+    # Same run, next source: success reported, nothing written.
+    assert _convert_without_writing(calibre) is None
+
+    # And nothing from either conversion is left in the work directory.
+    leftovers = [p for p in workdir.iterdir()]
+    assert leftovers == [], "per-call directories must be cleaned up on exit"
+
+
+def test_reused_workdir_with_same_pid_across_interpreters(calibre_module):
+    """Two fresh interpreters sharing a workdir, same mocked pid: no reuse.
+
+    This is the shape the reviewer demonstrated: a per-process unique name
+    (pid + counter) is not unique *across runs*, because a reused pid i
```

---

### Incident Patch 6: `03891b1a` (2026-09-29)
**Commit Message**: fix(rtf): decode hex-escaped text (#242)

**File**: `book_to_skill/parsers/rtf.py` (modified, +29/-1)
```diff
@@ -1,3 +1,4 @@
+import codecs
 import html
 import re
 import sys
@@ -10,6 +11,8 @@
 # or a literal "?". Assumes the default \uc1 (one fallback char); \ucN directives
 # and multi-char/group fallbacks are not parsed (best-effort fallback only).
 _RTF_UNICODE = re.compile(r"\\u(-?\d+)[ ]?(?:\\'[0-9a-fA-F]{2}|\?)?")
+_RTF_HEX_RUN = re.compile(r"(?:\\'[0-9a-fA-F]{2})+")
+_RTF_ANSI_CODEPAGE = re.compile(r"\\ansicpg(\d+)")
 
 
 def _rtf_unicode_repl(match: re.Match) -> str:
@@ -19,6 +22,25 @@ def _rtf_unicode_repl(match: re.Match) -> str:
     return chr(cp)
 
 
+def _rtf_ansi_encoding(raw: str) -> str:
+    """Return the declared ANSI code page, defaulting to Windows-1252."""
+    match = _RTF_ANSI_CODEPAGE.search(raw)
+    encoding = f"cp{match.group(1)}" if match else "cp1252"
+    try:
+        codecs.lookup(encoding)
+    except LookupError:
+        return "cp1252"
+    return encoding
+
+
+def _decode_hex_run(match: re.Match, encoding: str) -> str:
+    payload = bytes(
+        int(value, 16)
+        for value in re.findall(r"[0-9a-fA-F]{2}", match.group(0))
+    )
+    return payload.decode(encoding, errors="replace")
+
+
 # RTF groups whose contents are metadata or formatting tables rather than
 # document text. Stripping only the control words inside them (what the cleanup
 # below does) leaves the residue behind: font and style *names*, the generator
@@ -109,8 +131,14 @@ def strip_rtf_fallback(raw: str) -> str:
     # the control-word cleanup that would otherwise strip the markup and leave
     # the names behind as if they were prose.
     raw = _strip_destination_groups(raw)
+    ansi_encoding = _rtf_ansi_encoding(raw)
     raw = _RTF_UNICODE.sub(_rtf_unicode_repl, raw)   # decode \uN escapes first
-    raw = re.sub(r"\\'[0-9a-fA-F]{2}", " ", raw)
+    # A hex byte immediately following \uN is its compatibility fallback and
+    # was consumed by _RTF_UNICODE above. Any remaining \'hh escapes are actual
+    # document text. Decode adjacent bytes as a run so multibyte code pages work.
+    raw = _RTF_HEX_RUN.sub(
+        lambda match: _decode_hex_run(match, ansi_encoding), raw
+    )
     raw = re.sub(r"\\par[d]?", "\n", raw)
     raw = re.sub(r"\\tab", "\t", raw)
     # Park the three escaped literals ("\\", "\{", "\}") on placeholders before
```

**File**: `tests/test_rtf_destination_groups.py` (modified, +18/-0)
```diff
@@ -136,6 +136,24 @@ def test_par_and_tab_still_convert(self):
         assert "\t" in out
 
 
+class TestHexEscapedText:
+    """Standalone RTF hex bytes are text, not Unicode fallback bytes."""
+
+    def test_default_ansi_hex_escape_decodes_cp1252(self):
+        out = strip_rtf_fallback(r"{\rtf1\ansi caf\'e9 and \'93quoted\'94.}")
+        assert out == "café and “quoted”."
+
+    def test_declared_code_page_decodes_consecutive_bytes(self):
+        escaped = "".join(f"\\'{byte:02x}" for byte in "Привет".encode("cp1251"))
+        out = strip_rtf_fallback(r"{\rtf1\ansi\ansicpg1251 " + escaped + "}")
+        assert out == "Привет"
+
+    def test_declared_multibyte_code_page_decodes_each_run_together(self):
+        escaped = "".join(f"\\'{byte:02x}" for byte in "日本".encode("cp932"))
+        out = strip_rtf_fallback(r"{\rtf1\ansi\ansicpg932 " + escaped + "}")
+        assert out == "日本"
+
+
 class TestMalformedInputIsNotTruncated:
     def test_unterminated_skipped_group_falls_back(self):
         """Losing the whole body would be worse than leaking table residue."""
```

---

### Incident Patch 7: `80ae0877` (2026-09-22)
**Commit Message**: fix(docx): preserve inline tabs and breaks (#239)

**File**: `book_to_skill/parsers/docx.py` (modified, +16/-5)
```diff
@@ -55,6 +55,18 @@ def extract_docx_with_zipfile(docx_path: str) -> str | None:
         ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
         parts: list[str] = []
 
+        def inline_text(elem) -> str:
+            """Rebuild text runs without dropping explicit DOCX separators."""
+            text_parts: list[str] = []
+            for node in elem.iter():
+                if node.tag == f"{ns}t" and node.text:
+                    text_parts.append(node.text)
+                elif node.tag == f"{ns}tab":
+                    text_parts.append("\t")
+                elif node.tag in {f"{ns}br", f"{ns}cr"}:
+                    text_parts.append("\n")
+            return "".join(text_parts)
+
         def emit_block(elem) -> None:
             # Walk block content in document order. Paragraphs join their runs;
             # tables emit one tab-joined line per row (same row format as the
@@ -68,15 +80,14 @@ def emit_block(elem) -> None:
             for child in elem:
                 tag = child.tag
                 if tag == f"{ns}p":
-                    texts = [t.text for t in child.iter(f"{ns}t") if t.text]
-                    if texts:
-                        parts.append("".join(texts))
+                    paragraph = inline_text(child)
+                    if paragraph:
+                        parts.append(paragraph)
                 elif tag == f"{ns}tbl":
                     for row in child.iter(f"{ns}tr"):
                         cells = []
                         for cell in row.iter(f"{ns}tc"):
-                            cell_texts = [t.text for t in cell.iter(f"{ns}t") if t.text]
-                            cells.append("".join(cell_texts).strip())
+                            cells.append(inline_text(cell).strip())
                         if any(cells):
                             parts.append("\t".join(cells))
                 else:
```

**File**: `tests/test_book_to_skill.py` (modified, +16/-0)
```diff
@@ -1819,6 +1819,22 @@ def test_paragraph_only_document_unchanged(self, tmp_path):
         out = extract_docx_with_zipfile(self._make_docx(tmp_path, body))
         assert out == "Just a paragraph\nAnd another"
 
+    def test_inline_tabs_are_preserved(self, tmp_path):
+        body = (
+            "<w:p><w:r><w:t>Term</w:t><w:tab/><w:t>Definition</w:t>"
+            "</w:r></w:p>"
+        )
+        out = extract_docx_with_zipfile(self._make_docx(tmp_path, body))
+        assert out == "Term\tDefinition"
+
+    def test_inline_breaks_are_preserved(self, tmp_path):
+        body = (
+            "<w:p><w:r><w:t>First line</w:t><w:br/><w:t>Second line</w:t>"
+            "<w:cr/><w:t>Third line</w:t></w:r></w:p>"
+        )
+        out = extract_docx_with_zipfile(self._make_docx(tmp_path, body))
+        assert out == "First line\nSecond line\nThird line"
+
     def test_empty_cell_still_tab_joined(self, tmp_path):
         body = (
             "<w:tbl><w:tr>" + self._cell("A")
```

---

### Incident Patch 8: `6d2c5397` (2026-09-22)
**Commit Message**: fix(epub): resolve encoded manifest hrefs (#231)

**File**: `book_to_skill/parsers/epub.py` (modified, +16/-3)
```diff
@@ -1,9 +1,12 @@
 from __future__ import annotations
 
+import html
 import posixpath
 import re
-import zipfile
 import sys
+import zipfile
+from urllib.parse import unquote, urlsplit
+
 from book_to_skill.parsers.html import _HTMLTextExtractor
 
 
@@ -60,6 +63,17 @@ def _find_opf_path(zf: zipfile.ZipFile) -> str | None:
     return opf_files[0] if opf_files else None
 
 
+def _resolve_manifest_href(href: str, opf_dir: str) -> str:
+    """Map an OPF manifest IRI to its ZIP member name."""
+    # Manifest hrefs are IRIs, not literal archive names.  XML entities have
+    # already been decoded by a real XML parser; mirror that here before
+    # discarding query/fragment components and decoding percent escapes.
+    archive_path = unquote(urlsplit(html.unescape(href)).path)
+    if opf_dir:
+        archive_path = posixpath.join(opf_dir, archive_path)
+    return posixpath.normpath(archive_path)
+
+
 def extract_with_zipfile(epub_path: str) -> str | None:
     """stdlib-only EPUB extractor: unzip → parse HTML files."""
     try:
@@ -86,8 +100,7 @@ def extract_with_zipfile(epub_path: str) -> str | None:
                     id_m = re.search(r'\bid=["\']([^"\']+)["\']', item_tag)
                     href_m = re.search(r'\bhref=["\']([^"\']+)["\']', item_tag)
                     if id_m and href_m:
-                        href = href_m.group(1)
-                        resolved = posixpath.normpath(posixpath.join(opf_dir, href)) if opf_dir else href
+                        resolved = _resolve_manifest_href(href_m.group(1), opf_dir)
                         manifest[id_m.group(1)] = resolved
 
                 # Spine: ordered idrefs -> hrefs (true reading order).
```

**File**: `tests/test_book_to_skill.py` (modified, +24/-0)
```diff
@@ -1899,6 +1899,30 @@ def test_opf_in_subdir_resolves_hrefs(self, tmp_path):
         )
         assert "SUBDIR" in out
 
+    def test_manifest_href_fragment_is_not_part_of_archive_name(self, tmp_path):
+        opf = (
+            '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest>'
+            '<item id="c1" href="chapter.xhtml#section-2" '
+            'media-type="application/xhtml+xml"/>'
+            '</manifest><spine><itemref idref="c1"/></spine></package>'
+        )
+        files = {"chapter.xhtml": self._doc("FRAGMENT")}
+        out = extract_with_zipfile(self._make_epub(tmp_path, opf, files))
+        assert "FRAGMENT" in out
+
+    def test_manifest_href_percent_encoding_maps_to_archive_name(self, tmp_path):
+        opf = (
+            '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest>'
+            '<item id="c1" href="Text/Chapter%201.xhtml" '
+            'media-type="application/xhtml+xml"/>'
+            '</manifest><spine><itemref idref="c1"/></spine></package>'
+        )
+        files = {"OEBPS/Text/Chapter 1.xhtml": self._doc("ENCODED")}
+        out = extract_with_zipfile(
+            self._make_epub(tmp_path, opf, files, opf_name="OEBPS/content.opf")
+        )
+        assert "ENCODED" in out
+
     def test_non_self_closing_item_tag(self, tmp_path):
         # <item ...></item> (non-self-closing) is parsed via its opening tag.
         opf = (
```

---

### Incident Patch 9: `f08d343d` (2026-09-17)
**Commit Message**: fix(extractor): translate post-extraction stat errors (#228)

* fix(extractor): translate post-extraction stat errors

* test: use one utils import style

**File**: `book_to_skill/pdf_inspector_integration.py` (modified, +8/-1)
```diff
@@ -7,6 +7,8 @@
 from pathlib import Path
 from typing import Any
 
+from book_to_skill.exceptions import ExtractionError
+
 _MIN_NATIVE_CONFIDENCE = 0.90
 _INSPECTIONS: dict[str, dict[str, Any]] = {}
 
@@ -143,7 +145,12 @@ def _result_from_inspector(
 
     pages = inspection.get("page_count") or utils_module.count_pages(str(input_path))
     tokens = utils_module.estimate_tokens(text)
-    file_size_mb = os.path.getsize(input_path) / (1024 * 1024)
+    try:
+        file_size_mb = os.path.getsize(input_path) / (1024 * 1024)
+    except OSError as exc:
+        raise ExtractionError(
+            f"Could not read file size for {input_path.name}: {exc}"
+        ) from exc
 
     return {
         "source_file": str(input_path.resolve()),
```

**File**: `book_to_skill/utils.py` (modified, +6/-1)
```diff
@@ -1015,7 +1015,12 @@ def extract_single_file(input_path: Path, extraction_mode: str, install_mode: st
         f"  chapters: {structure['chapters_detected']} "
         f"({structure['chapters_method']})"
     )
-    file_size_mb = os.path.getsize(input_str) / (1024 * 1024)
+    try:
+        file_size_mb = os.path.getsize(input_str) / (1024 * 1024)
+    except OSError as exc:
+        raise ExtractionError(
+            f"Could not read file size for {input_path.name}: {exc}"
+        ) from exc
     
     return {
         "source_file": str(input_path.resolve()),
```

**File**: `tests/test_batch_resilience_unreadable.py` (modified, +52/-7)
```diff
@@ -20,8 +20,8 @@
 ROOT_DIR = Path(__file__).resolve().parent.parent
 sys.path.insert(0, str(ROOT_DIR))
 
+import book_to_skill.utils as utils  # noqa: E402
 from book_to_skill.exceptions import ExtractionError  # noqa: E402
-from book_to_skill.utils import extract_single_file, main  # noqa: E402
 
 
 def _make_unreadable(path: Path) -> Path:
@@ -43,7 +43,7 @@ def test_unreadable_unknown_suffix_raises_extraction_error(tmp_path):
     bad = _make_unreadable(tmp_path / "mystery.dat")
     try:
         with pytest.raises(ExtractionError) as excinfo:
-            extract_single_file(bad, "text", "no")
+            utils.extract_single_file(bad, "text", "no")
         assert "mystery.dat" in str(excinfo.value)
     finally:
         bad.chmod(stat.S_IRUSR | stat.S_IWUSR)
@@ -61,8 +61,6 @@ def test_batch_survives_unreadable_source(tmp_path, monkeypatch, capsys):
     # config caches OUTPUT_* at import time; point the module constants at the
     # temp workdir so the run does not touch the shared default.
     import book_to_skill.config as config
-    import book_to_skill.utils as utils
-
     for module in (config, utils):
         monkeypatch.setattr(module, "OUTPUT_DIR", workdir, raising=False)
         monkeypatch.setattr(module, "OUTPUT_TEXT", workdir / "full_text.txt", raising=False)
@@ -73,7 +71,7 @@ def test_batch_survives_unreadable_source(tmp_path, monkeypatch, capsys):
     )
 
     try:
-        main()
+        utils.main()
     finally:
         bad.chmod(stat.S_IRUSR | stat.S_IWUSR)
 
@@ -89,7 +87,7 @@ def test_batch_survives_unreadable_source(tmp_path, monkeypatch, capsys):
 def test_missing_file_still_reports_not_found(tmp_path):
     """The pre-existing not-found path is unchanged."""
     with pytest.raises(ExtractionError) as excinfo:
-        extract_single_file(tmp_path / "nope.dat", "text", "no")
+        utils.extract_single_file(tmp_path / "nope.dat", "text", "no")
     assert "File not found" in str(excinfo.value)
 
 
@@ -99,5 +97,52 @@ def test_readable_unknown_suffix_still_rejected_by_format(tmp_path):
     odd.write_bytes(b"not a pdf or a zip")
 
     with pytest.raises(ExtractionError) as excinfo:
-        extract_single_file(odd, "text", "no")
+        utils.extract_single_file(odd, "text", "no")
     assert "Unsupported format" in str(excinfo.value)
+
+
+def test_post_extraction_stat_failure_raises_extraction_error(tmp_path, monkeypatch):
+    source = tmp_path / "book.md"
+    source.write_text("Chapter 1\nContent", encoding="utf-8")
+
+    def fail_getsize(_path):
+        raise PermissionError("file became unavailable")
+
+    monkeypatch.setattr(os.path, "getsize", fail_getsize)
+
+    with pytest.raises(ExtractionError, match="Could not read file size"):
+        utils.extract_single_file(source, "text", "no")
+
+
+def test_batch_survives_post_extraction_stat_failure(tmp_path, monkeypatch):
+    bad = tmp_path / "a.md"
+    good = tmp_path / "b.md"
+    bad.write_text("Chapter 1\nFirst source", encoding="utf-8")
+    good.write_text("Chapter 2\nSecond source", encoding="utf-8")
+
+    real_getsize = os.path.getsize
+
+    def flaky_getsize(path):
+        if Path(path) == bad:
+            raise PermissionError("file became unavailable")
+        return real_getsize(path)
+
+    monkeypatch.setattr(os.path, "getsize", flaky_getsize)
+
+    workdir = tmp_path / "work"
+    import book_to_skill.config as config
+    for module in (config, utils):
+        monkeypatch.setattr(module, "OUTPUT_DIR", workdir, raising=False)
+        monkeypatch.setattr(module, "OUTPUT_TEXT", workdir / "full_text.txt", raising=False)
+        monkeypatch.setattr(module, "OUTPUT_META", workdir / "metadata.json", raising=False)
+    monkeypatch.setattr(
+        sys,
+        "argv",
+        ["extract.py", str(bad), str(good), "--install-missing", "no"],
+    )
+
+    utils.main()
+
+    text = (workdir / "full_text.txt").read_text(encoding="utf-8")
+    assert "Second source" in text
+    assert "First source" not in text
```

**File**: `tests/test_pdf_inspector_integration.py` (modified, +43/-0)
```diff
@@ -5,6 +5,7 @@
 import pytest
 
 import book_to_skill.pdf_inspector_integration as integration
+from book_to_skill.exceptions import ExtractionError
 
 
 def _fake_result(**overrides):
@@ -185,6 +186,48 @@ def original(*args):
     assert integration._INSPECTIONS[str(pdf.resolve())] == inspection
 
 
+def test_hook_translates_post_extraction_stat_failure(tmp_path, monkeypatch):
+    integration._reset_state_for_tests()
+    pdf = tmp_path / "book.pdf"
+    pdf.write_bytes(b"%PDF-1.7\nfixture")
+
+    fake_utils = SimpleNamespace(
+        extract_single_file=lambda *_args: {"extraction_method": "legacy"},
+        sanitize_extracted_text=lambda text: (text, 0),
+        detect_structure=lambda _text: {
+            "chapters_detected": 1,
+            "chapters_method": "numeric",
+            "chapter_headings_sample": ["Chapter 1"],
+            "has_toc": False,
+        },
+        count_pages=lambda _path: 12,
+        estimate_tokens=lambda _text: 42,
+    )
+    inspection = {
+        "confidence": 0.99,
+        "page_count": 12,
+        "pdf_type": "text_based",
+        "native_markdown_trusted": True,
+        "pages_needing_ocr": [],
+        "has_encoding_issues": False,
+    }
+    monkeypatch.setattr(
+        integration,
+        "inspect_pdf",
+        lambda _path: ("Chapter 1\nBody", inspection),
+    )
+
+    def fail_getsize(_path):
+        raise PermissionError("unavailable")
+
+    monkeypatch.setattr(integration.os.path, "getsize", fail_getsize)
+
+    integration.install_pdf_inspector_hook(fake_utils)
+
+    with pytest.raises(ExtractionError, match="Could not read file size"):
+        fake_utils.extract_single_file(pdf, "text", "no")
+
+
 def test_hook_keeps_technical_mode_on_existing_pipeline(tmp_path, monkeypatch):
     integration._reset_state_for_tests()
     pdf = tmp_path / "book.pdf"
```

---

### Incident Patch 10: `abc666bb` (2026-09-16)
**Commit Message**: fix(evals): stop scoring crashing on, and inventing counts from, recorded data (#225)

tools/evals/score.py documents itself as scoring "without loading files or
deriving missing observations", and aggregate() promises to "never estimate
missing usage". Two things broke that contract.

1. opens.index(target) was called unguarded. It is only reached when
   route_correct and answer_correct are both true -- but route_correct is
   only DERIVED from opens when the harness did not record it. A harness that
   records route_correct itself, while opens does not contain the target
   verbatim, hit ValueError:

       opens=["chapters/ch01.md"]   target="chapters/ch02.md"  -> ValueError
       opens=[]                     target="a.md"              -> ValueError
       opens=["./chapters/ch02.md"] target="chapters/ch02.md"  -> ValueError

   score() maps over every trajectory, so one such row aborted the whole
   scoring run rather than one question. The position is now computed once,
   guarded by membership, and absence simply means there is no evidence of
   irrelevant opens before the target.

2. isinstance(value, int) accepted True, because bool subclasses int in
   Python. A JSON `tr

**File**: `tests/evals/test_score_robustness.py` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+"""Scoring must consume whatever a harness recorded, without crashing or inventing.
+
+`tools/evals/score.py` documents itself as scoring "without loading files or
+deriving missing observations", and `aggregate` promises to "never estimate
+missing usage". Two things broke that contract.
+
+1. `opens.index(target)` was called unguarded. It is only reached when
+   `route_correct` and `answer_correct` are both true — but `route_correct` is
+   only *derived* from `opens` when the harness did not record it. A harness that
+   records `route_correct` itself, while `opens` does not contain the target
+   verbatim, raised `ValueError` and killed the entire scoring run rather than
+   one question.
+
+2. `isinstance(value, int)` accepted `True`, because `bool` subclasses `int` in
+   Python. A JSON `true` in a usage field was therefore treated as a recorded
+   count and summed as 1 — precisely the estimate the module promises not to make.
+"""
+
+import sys
+from pathlib import Path
+
+import pytest
+
+ROOT_DIR = Path(__file__).resolve().parent.parent.parent
+sys.path.insert(0, str(ROOT_DIR / "tools"))
+
+from evals.score import UNKNOWN, aggregate, score, score_trajectory
+
+RECORDED = {"route_correct": True, "evidence_reached": True, "answer_correct": True}
+
+
+def _trajectory(question_id, target, opens, **observed):
+    return {
+        "question_id": question_id,
+        "expected": {"target": target},
+        "observed": dict(observed, opens=opens),
+    }
+
+
+class TestTargetMissingFromOpens:
+    """Recorded booleans must be trusted, not cross-checked into a crash."""
+
+    @pytest.mark.parametrize(
+        "opens, label",
+        [
+            (["chapters/ch01.md"], "a different file was opened"),
+            ([], "nothing was opened"),
+            (["./chapters/ch02.md"], "path normalisation differs"),
+            (["chapters/CH02.MD"], "case differs"),
+        ],
+    )
+    def test_does_not_crash(self, opens, label):
+        result = score_trajectory(
+            _trajectory("q", "chapters/ch02.md", opens, **RECORDED)
+        )
+
+        assert result["classification"] == "correct", label
+
+    def test_recorded_flags_are_passed_through_unchanged(self):
+        result = score_trajectory(
+            _trajectory("q", "b.md", ["a.md"], **RECORDED)
+        )
+
+        assert result["routing_correct"] is True
+        assert result["evidence_reached"] is True
+        assert result["answer_correct"] is True
+
+    def test_a_single_bad_row_does_not_kill_the_run(self):
+        """One unscoreable question used to abort every other question."""
+        trajectories = [
+            _trajectory("q1", "a.md", ["a.md"], **RECORDED),
+            _trajectory("q2", "b.md", ["a.md"], **RECORDED),
+            _trajectory("q3", "c.md", ["c.md"], **RECORDED),
+        ]
+
+        report = score(trajectories)
+
+        assert [item["question_id"] for item in report["questions"]] == ["q1", "q2", "q3"]
+        assert report["aggregate"]["questions"] == 3
+
+
+class TestDerivedRoutingUnchanged:
+    """When the harness did NOT record routing, it is still derived from opens."""
+
+    def test_target_absent_is_wrong_routing(self):
+        result = score_trajectory(
+            _trajectory("q", "a.md", ["b.md"], answer_correct=True)
+        )
+
+        assert result["classification"] == "wrong_routing"
+        assert result["routing_correct"] is False
+
+    def test_target_first_is_correct(self):
+        result = score_trajectory(
+            _trajectory("q", "a.md", ["a.md", "b.md"], answer_correct=True)
+        )
+
+        assert result["classification"] == "correct"
+
+    def test_target_after_others_is_flagged(self):
+        result = score_trajectory(
+            _trajectory("q", "b.md", ["a.md", "b.md"], answer_correct=True)
+        )
+
+        assert result["classification"] == "irrelevant_opens_before_target"
+
+    def test_duplicate_opens_use_the_first_position(self):
+        result = score_trajectory(
+            _trajectory("q", "b.md", ["b.md", "a.md", "b.md"], answer_correct=True)
+        )
+
+        assert result["classification"] == "correct"
+
+    def test_missing_answer_is_unknown(self):
+        result = score_trajectory(_trajectory("q", "a.md", ["a.md"]))
+
+        assert result["classification"] == UNKNOWN
+
+    def test_wrong_answer_still_reported(self):
+        result = score_trajectory(
+            _trajectory("q", "a.md", ["a.md"], answer_correct=False)
+        )
+
+        assert result["classification"] == "wrong_answer"
+
+
+class TestUsageCountsRejectBooleans:
+    """`bool` is an `int`; a recorded `true` is not a count."""
+
+    @pytest.mark.parametrize("field", ["input_tokens", "output_tokens", "calls"])
+    def test_true_is_not_a_count(self, field):
+        usage = {"input_tokens": 5, "output_tokens": 1, "calls": 2}
+        usage[field] = True
+
+        result = score_trajectory(
+            _trajectory("q", "a", 
```

**File**: `tools/evals/score.py` (modified, +22/-2)
```diff
@@ -12,6 +12,16 @@ def _state(value: Any) -> Any:
     return value if isinstance(value, bool) else UNKNOWN
 
 
+def _count(value: Any) -> Any:
+    """Keep only explicit integer counts; absence remains unknown.
+
+    ``bool`` is a subclass of ``int``, so a JSON ``true`` would otherwise pass an
+    ``isinstance(value, int)`` test and then be summed as 1 -- inventing a usage
+    number this module promises never to estimate.
+    """
+    return value if isinstance(value, int) and not isinstance(value, bool) else UNKNOWN
+
+
 def score_trajectory(trajectory: Dict[str, Any]) -> Dict[str, Any]:
     """Score one trajectory without loading files or deriving missing observations."""
     expected = trajectory.get("expected", {})
@@ -23,6 +33,16 @@ def score_trajectory(trajectory: Dict[str, Any]) -> Dict[str, Any]:
         if isinstance(opens, list) and target is not None
         else UNKNOWN
     )
+    # Where the target appears among the opens, or None when it does not appear
+    # at all. `opens.index(target)` was called unguarded further down, so a
+    # harness that recorded route_correct itself -- while `opens` did not contain
+    # the target verbatim (an empty list, a "./" prefix, any path normalisation
+    # difference) -- raised ValueError and killed the whole scoring run.
+    target_position = (
+        opens.index(target)
+        if isinstance(opens, list) and target is not None and target in opens
+        else None
+    )
     answer_correct = _state(observed.get("answer_correct"))
     route_correct = _state(observed.get("route_correct"))
     evidence_reached = _state(observed.get("evidence_reached"))
@@ -37,7 +57,7 @@ def score_trajectory(trajectory: Dict[str, Any]) -> Dict[str, Any]:
         classification = "wrong_routing"
     elif not answer_correct:
         classification = "wrong_answer"
-    elif isinstance(opens, list) and target is not None and opens.index(target) > 0:
+    elif target_position is not None and target_position > 0:
         classification = "irrelevant_opens_before_target"
     else:
         classification = "correct"
@@ -50,7 +70,7 @@ def score_trajectory(trajectory: Dict[str, Any]) -> Dict[str, Any]:
         "routing_correct": route_correct,
         "evidence_reached": evidence_reached,
         "answer_correct": answer_correct,
-        "usage": {key: usage.get(key) if isinstance(usage.get(key), int) else UNKNOWN
+        "usage": {key: _count(usage.get(key))
                   for key in ("input_tokens", "output_tokens", "calls")},
     }
 
```

---

### Incident Patch 11: `0d538c85` (2026-09-16)
**Commit Message**: fix(pdf): discard stale inspection metadata (#220)

**File**: `book_to_skill/pdf_inspector_integration.py` (modified, +4/-1)
```diff
@@ -191,12 +191,15 @@ def install_pdf_inspector_hook(utils_module: Any | None = None) -> None:
         return
 
     def wrapped(input_path: Path, extraction_mode: str, install_mode: str) -> dict[str, Any]:
+        inspection_key = str(input_path.resolve())
+        _INSPECTIONS.pop(inspection_key, None)
+
         if not _looks_like_pdf(input_path):
             return original(input_path, extraction_mode, install_mode)
 
         markdown, inspection = inspect_pdf(input_path)
         if inspection is not None:
-            _INSPECTIONS[str(input_path.resolve())] = inspection
+            _INSPECTIONS[inspection_key] = inspection
 
         if extraction_mode == "text" and markdown and inspection:
             result = _result_from_inspector(utils_module, input_path, markdown, inspection)
```

**File**: `tests/test_pdf_inspector_integration.py` (modified, +37/-0)
```diff
@@ -102,6 +102,43 @@ def original(*args):
     assert integration._INSPECTIONS == {}
 
 
+def test_failed_reinspection_does_not_reuse_stale_metadata(tmp_path, monkeypatch):
+    integration._reset_state_for_tests()
+    pdf = tmp_path / "book.pdf"
+    pdf.write_bytes(b"%PDF-1.7\nfixture")
+    inspections = iter(
+        [
+            (None, {"engine": "pdf-inspector", "confidence": 0.5}),
+            (None, None),
+        ]
+    )
+    monkeypatch.setattr(integration, "inspect_pdf", lambda _path: next(inspections))
+
+    fake_utils = SimpleNamespace(
+        extract_single_file=lambda *_args: {"extraction_method": "legacy"}
+    )
+    integration.install_pdf_inspector_hook(fake_utils)
+
+    fake_utils.extract_single_file(pdf, "text", "no")
+    fake_utils.extract_single_file(pdf, "text", "no")
+
+    metadata_path = tmp_path / "metadata.json"
+    metadata_path.write_text(
+        json.dumps(
+            {
+                "total_sources": 1,
+                "sources": [{"source_file": str(pdf.resolve())}],
+            }
+        ),
+        encoding="utf-8",
+    )
+    integration.enrich_pdf_inspector_metadata(metadata_path)
+    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
+
+    assert "pdf_inspector" not in metadata
+    assert "pdf_inspector" not in metadata["sources"][0]
+
+
 def test_hook_uses_inspector_for_clean_text_pdf(tmp_path, monkeypatch):
     integration._reset_state_for_tests()
     pdf = tmp_path / "book.pdf"
```

---

### Incident Patch 12: `01f8a742` (2026-09-12)
**Commit Message**: fix(pdf): fall back on invalid inspector metadata (#218)

**File**: `book_to_skill/pdf_inspector_integration.py` (modified, +35/-31)
```diff
@@ -58,44 +58,48 @@ def inspect_pdf(path: str | Path) -> tuple[str | None, dict[str, Any] | None]:
 
     try:
         result = pdf_inspector.process_pdf(str(path))
+        pdf_type = _normalise_pdf_type(getattr(result, "pdf_type", None))
+        confidence = float(getattr(result, "confidence", 0.0) or 0.0)
+        pages_needing_ocr = list(getattr(result, "pages_needing_ocr", None) or [])
+        has_encoding_issues = bool(getattr(result, "has_encoding_issues", False))
+        markdown = getattr(result, "markdown", None)
+
+        native_markdown_trusted = bool(
+            isinstance(markdown, str)
+            and markdown.strip()
+            and pdf_type == "text_based"
+            and confidence >= _MIN_NATIVE_CONFIDENCE
+            and not pages_needing_ocr
+            and not has_encoding_issues
+        )
+
+        metadata: dict[str, Any] = {
+            "engine": "pdf-inspector",
+            "version": _package_version(),
+            "pdf_type": pdf_type,
+            "confidence": round(confidence, 4),
+            "native_markdown_trusted": native_markdown_trusted,
+            "pages_needing_ocr": pages_needing_ocr,
+            "ocr_reasons_by_page": _ocr_reasons(
+                getattr(result, "ocr_reasons_by_page", None)
+            ),
+            "pages_with_tables": list(
+                getattr(result, "pages_with_tables", None) or []
+            ),
+            "pages_with_columns": list(
+                getattr(result, "pages_with_columns", None) or []
+            ),
+            "has_encoding_issues": has_encoding_issues,
+            "is_complex_layout": bool(getattr(result, "is_complex_layout", False)),
+            "page_count": int(getattr(result, "page_count", 0) or 0),
+        }
     except Exception as exc:
         print(
             f"  [warn] pdf-inspector preflight failed: {type(exc).__name__}: {exc}",
             file=sys.stderr,
         )
         return None, None
 
-    pdf_type = _normalise_pdf_type(getattr(result, "pdf_type", None))
-    confidence = float(getattr(result, "confidence", 0.0) or 0.0)
-    pages_needing_ocr = list(getattr(result, "pages_needing_ocr", None) or [])
-    has_encoding_issues = bool(getattr(result, "has_encoding_issues", False))
-    markdown = getattr(result, "markdown", None)
-
-    native_markdown_trusted = bool(
-        isinstance(markdown, str)
-        and markdown.strip()
-        and pdf_type == "text_based"
-        and confidence >= _MIN_NATIVE_CONFIDENCE
-        and not pages_needing_ocr
-        and not has_encoding_issues
-    )
-
-    metadata: dict[str, Any] = {
-        "engine": "pdf-inspector",
-        "version": _package_version(),
-        "pdf_type": pdf_type,
-        "confidence": round(confidence, 4),
-        "native_markdown_trusted": native_markdown_trusted,
-        "pages_needing_ocr": pages_needing_ocr,
-        "ocr_reasons_by_page": _ocr_reasons(
-            getattr(result, "ocr_reasons_by_page", None)
-        ),
-        "pages_with_tables": list(getattr(result, "pages_with_tables", None) or []),
-        "pages_with_columns": list(getattr(result, "pages_with_columns", None) or []),
-        "has_encoding_issues": has_encoding_issues,
-        "is_complex_layout": bool(getattr(result, "is_complex_layout", False)),
-        "page_count": int(getattr(result, "page_count", 0) or 0),
-    }
     return (markdown if native_markdown_trusted else None), metadata
 
 
```

**File**: `tests/test_pdf_inspector_integration.py` (modified, +47/-0)
```diff
@@ -2,6 +2,8 @@
 import sys
 from types import SimpleNamespace
 
+import pytest
+
 import book_to_skill.pdf_inspector_integration as integration
 
 
@@ -55,6 +57,51 @@ def test_inspect_pdf_rejects_native_markdown_when_ocr_is_recommended(monkeypatch
     ]
 
 
+@pytest.mark.parametrize(
+    "overrides",
+    [
+        {"confidence": "not-a-number"},
+        {"page_count": "not-an-integer"},
+        {"pages_needing_ocr": object()},
+    ],
+)
+def test_inspect_pdf_falls_back_on_invalid_metadata(monkeypatch, capsys, overrides):
+    fake_module = SimpleNamespace(
+        process_pdf=lambda _path: _fake_result(**overrides)
+    )
+    monkeypatch.setitem(sys.modules, "pdf_inspector", fake_module)
+
+    assert integration.inspect_pdf("book.pdf") == (None, None)
+    assert "pdf-inspector preflight failed" in capsys.readouterr().err
+
+
+def test_hook_uses_existing_pipeline_when_inspector_metadata_is_invalid(
+    tmp_path, monkeypatch
+):
+    integration._reset_state_for_tests()
+    pdf = tmp_path / "book.pdf"
+    pdf.write_bytes(b"%PDF-1.7\nfixture")
+    fake_module = SimpleNamespace(
+        process_pdf=lambda _path: _fake_result(confidence="not-a-number")
+    )
+    monkeypatch.setitem(sys.modules, "pdf_inspector", fake_module)
+
+    original_calls = []
+
+    def original(*args):
+        original_calls.append(args)
+        return {"extraction_method": "legacy"}
+
+    fake_utils = SimpleNamespace(extract_single_file=original)
+
+    integration.install_pdf_inspector_hook(fake_utils)
+    result = fake_utils.extract_single_file(pdf, "text", "no")
+
+    assert result == {"extraction_method": "legacy"}
+    assert original_calls == [(pdf, "text", "no")]
+    assert integration._INSPECTIONS == {}
+
+
 def test_hook_uses_inspector_for_clean_text_pdf(tmp_path, monkeypatch):
     integration._reset_state_for_tests()
     pdf = tmp_path / "book.pdf"
```

---

### Incident Patch 13: `ecf99ee3` (2026-09-12)
**Commit Message**: fix(deps): honor alternative parser availability (#208)

**File**: `book_to_skill/dependencies.py` (modified, +21/-5)
```diff
@@ -157,12 +157,21 @@ def offer_dependency_install(
     module_names: list[str],
     fallback: str | None,
     install_mode: str,
+    any_of_modules: bool = False,
 ) -> None:
-    packages = missing_python_packages(module_names)
-    if not packages:
+    missing_packages = missing_python_packages(module_names)
+    if not missing_packages or (
+        any_of_modules and len(missing_packages) < len(module_names)
+    ):
         return
 
-    message = f"{feature} uses {', '.join(packages)} if installed"
+    package_choices = [PYTHON_DEPENDENCIES[name] for name in module_names]
+    if any_of_modules:
+        message = f"{feature} uses one of {', '.join(package_choices)} if installed"
+        packages = missing_packages[:1]
+    else:
+        message = f"{feature} uses {', '.join(missing_packages)} if installed"
+        packages = missing_packages
     if fallback:
         message += f", otherwise {fallback}"
     message += "."
@@ -187,7 +196,12 @@ def offer_dependency_install(
 
     if install_python_packages(packages):
         still_missing = missing_python_packages(module_names)
-        if not still_missing:
+        dependencies_satisfied = (
+            len(still_missing) < len(module_names)
+            if any_of_modules
+            else not still_missing
+        )
+        if dependencies_satisfied:
             print("Package installation complete.")
             return
         print(f"Package installation incomplete; still missing: {', '.join(still_missing)}", file=sys.stderr)
@@ -213,6 +227,7 @@ def prepare_dependencies(ext: str, extraction_mode: str, install_mode: str) -> N
             module_names=["pypdf", "pdfminer"],
             fallback="any installed Python PDF parser; extraction fails if none are available",
             install_mode=install_mode,
+            any_of_modules=True,
         )
 
     if ext == ".epub":
@@ -226,9 +241,10 @@ def prepare_dependencies(ext: str, extraction_mode: str, install_mode: str) -> N
     if ext in HTML_EXTENSIONS:
         offer_dependency_install(
             feature="HTML extraction",
-            module_names=["bs4"],
+            module_names=["trafilatura", "bs4"],
             fallback="a stdlib HTML parser",
             install_mode=install_mode,
+            any_of_modules=True,
         )
 
     if ext == ".docx":
```

**File**: `tests/test_dependency_install_semantics.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+"""Runtime dependency prompts should match the extractor fallback semantics."""
+
+from book_to_skill import dependencies
+
+
+def _fail_install(packages):
+    raise AssertionError(f"unexpected dependency installation: {packages}")
+
+
+def test_pdf_preflight_accepts_one_available_python_parser(monkeypatch):
+    monkeypatch.setattr(dependencies.shutil, "which", lambda _command: None)
+    monkeypatch.setattr(
+        dependencies,
+        "python_module_available",
+        lambda module: module == "pypdf",
+    )
+    monkeypatch.setattr(dependencies, "install_python_packages", _fail_install)
+
+    dependencies.prepare_dependencies(".pdf", "text", "yes")
+
+
+def test_html_preflight_accepts_available_trafilatura(monkeypatch):
+    monkeypatch.setattr(
+        dependencies,
+        "python_module_available",
+        lambda module: module == "trafilatura",
+    )
+    monkeypatch.setattr(dependencies, "install_python_packages", _fail_install)
+
+    dependencies.prepare_dependencies(".html", "text", "yes")
+
+
+def test_any_of_group_installs_only_the_preferred_parser(monkeypatch):
+    installed = []
+    monkeypatch.setattr(dependencies, "python_module_available", lambda _module: False)
+    monkeypatch.setattr(
+        dependencies,
+        "install_python_packages",
+        lambda packages: installed.append(packages) or False,
+    )
+
+    dependencies.offer_dependency_install(
+        feature="HTML extraction",
+        module_names=["trafilatura", "bs4"],
+        fallback="the stdlib HTML parser",
+        install_mode="yes",
+        any_of_modules=True,
+    )
+
+    assert installed == [["trafilatura"]]
+
+
+def test_all_required_group_still_installs_every_missing_package(monkeypatch):
+    installed = []
+    monkeypatch.setattr(dependencies, "python_module_available", lambda _module: False)
+    monkeypatch.setattr(
+        dependencies,
+        "install_python_packages",
+        lambda packages: installed.append(packages) or False,
+    )
+
+    dependencies.offer_dependency_install(
+        feature="EPUB extraction",
+        module_names=["ebooklib", "bs4"],
+        fallback="a stdlib ZIP/HTML parser",
+        install_mode="yes",
+    )
+
+    assert installed == [["ebooklib", "beautifulsoup4"]]
```

---

### Incident Patch 14: `ffc56e73` (2026-08-28)
**Commit Message**: fix(pdf): force UTF-8 output encoding for pdftotext on Windows (#117, #192)

**File**: `book_to_skill/parsers/pdf.py` (modified, +2/-2)
```diff
@@ -79,7 +79,7 @@ def extract_with_pdftotext(pdf_path: str) -> str | None:
     try:
         pdf_path = os.path.abspath(pdf_path)
         result = subprocess.run(
-            ["pdftotext", "-layout", pdf_path, "-"],
+            ["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
             capture_output=True, text=True, timeout=120,
             encoding="utf-8", errors="replace",
         )
@@ -100,7 +100,7 @@ def looks_image_only(pdf_path: str, pages: int = 5) -> bool:
         return False
     try:
         result = subprocess.run(
-            ["pdftotext", "-f", "1", "-l", str(pages), os.path.abspath(pdf_path), "-"],
+            ["pdftotext", "-f", "1", "-l", str(pages), "-enc", "UTF-8", os.path.abspath(pdf_path), "-"],
             capture_output=True, text=True, timeout=30,
             encoding="utf-8", errors="replace",
         )
```

**File**: `tests/test_book_to_skill.py` (modified, +4/-1)
```diff
@@ -1891,7 +1891,7 @@ def test_empty_file_returns_empty_string(self, tmp_path):
 class TestPdftotextEncoding:
     """pdftotext output (UTF-8) is decoded as UTF-8, not the locale encoding."""
 
-    def test_pdftotext_decodes_as_utf8(self, monkeypatch):
+    def test_pdftotext_requests_utf8_output(self, monkeypatch):
         captured = {}
 
         class _Result:
@@ -1901,6 +1901,7 @@ class _Result:
         monkeypatch.setattr(pdf_parser.shutil, "which", lambda name: "/usr/bin/pdftotext")
 
         def fake_run(cmd, **kwargs):
+            captured["cmd"] = cmd
             captured.update(kwargs)
             return _Result()
 
@@ -1909,6 +1910,8 @@ def fake_run(cmd, **kwargs):
         assert pdf_parser.extract_with_pdftotext("x.pdf") == "Café — naïve"
         assert captured.get("encoding") == "utf-8"
         assert captured.get("errors") == "replace"
+        cmd = captured.get("cmd") or []
+        assert "-enc" in cmd and cmd[cmd.index("-enc") + 1] == "UTF-8"
 
 
 class TestPdfPageCount:
```

---

### Incident Patch 15: `da6aad05` (2026-08-28)
**Commit Message**: fix: detect Markdown ToC headings, Unit-style chapters, stray-Roman suppression (#161, #126)

**File**: `book_to_skill/utils.py` (modified, +15/-6)
```diff
@@ -107,14 +107,14 @@ def estimate_tokens(text: str) -> int:
 # 1..99 — drops years like "2025.") and whatever follows it on the line, so we
 # can reject prose.
 _EXPLICIT_CHAPTER = re.compile(
-    r"^\s*(?:chapter|chapitre|kapitel|cap[ií]tulo|capitolo|hoofdstuk|chương|ch\.?)\s*(?:(\d{1,2})|(?P<roman>[IVXLCDMivxlcdm]{1,7}))\b(?P<rest>.*)$",
+    r"^\s*(?:chapter|unit|lesson|module|lecture|part|chapitre|kapitel|cap[ií]tulo|capitolo|hoofdstuk|chương|ch\.?)\s*(?:(\d{1,2})|(?P<roman>[IVXLCDMivxlcdm]{1,7}))\b(?P<rest>.*)$",
     re.IGNORECASE,
 )
 # A heading's number is followed by end-of-line, punctuation (“. : - —“), or a
 # Capitalized title word. A lowercase continuation (“Chapter 6 explores...”,
 # “Chapter 8 are relevant...”) is prose / a cross-reference, not a heading.
 # The uppercase class is À-Þ so titles starting with Ü/Û (common in German, e.g. “Überblick”) are recognized.
-_HEADING_TAIL = re.compile(r"^\s*$|^\s*[.:\-—–]|^\s+[A-ZÀ-Þ0-9\"“(]")
+_HEADING_TAIL = re.compile(r"^\s*$|^\s*[.:\-—–]|^\s+(?![a-z])")
 
 # Roman-numeral chapter heading: "I: Loomings", "II. The Carpet-Bag".
 # Uppercase alone at line start is safe — no common English word is a valid
@@ -308,7 +308,7 @@ def _fa_chapter_number(s: str) -> int | None:
 )
 _TOC_CJK_PATTERN = r"目[ \t\u3000]*(?:录|錄|次)"
 _TOC_PATTERN = re.compile(
-    r"^\s*(?:"
+    r"^\s*(?:#{1,6}\s*)?(?:"
     + "|".join([*(re.escape(h) for h in _TOC_HEADERS), _TOC_CJK_PATTERN])
     + r")\s*$",
     re.IGNORECASE | re.MULTILINE,
@@ -632,12 +632,21 @@ def detect_structure(text: str) -> dict:
     # Every parser in this project already announces which method it used
     # ("Trying python-docx... OK"); this decision had the same shape and was
     # the only silent one.
-    if numeric_count > 0:
+    if numeric_count >= 2:
         chapters_detected = numeric_count
         chapters_method = "numeric"
     else:
-        chapters_detected = _structural_chapter_count(text)
-        chapters_method = "structural" if chapters_detected else "none"
+        # A single stray number (e.g. a Roman numeral inside an example paper
+        # reproduced in the book, or a lone "Part 1") is not enough to suppress
+        # the structural (Markdown/AsciiDoc) heading count, so course-style
+        # books with "### Unit N" headings still get counted via max().
+        structural_count = _structural_chapter_count(text)
+        chapters_detected = max(numeric_count, structural_count)
+        chapters_method = (
+            "structural" if structural_count > numeric_count
+            else "numeric" if numeric_count
+            else "none"
+        )
 
     # Look for ToC indicators in the first ~30k chars (multilingual; see _TOC_PATTERN)
     has_toc = bool(_TOC_PATTERN.search(text[:30000]))
```

**File**: `tests/test_book_to_skill.py` (modified, +46/-0)
```diff
@@ -911,6 +911,52 @@ def test_toc_inline_word_is_not_toc(self):
         text = "The contents of this chapter are varied and the index is long.\n"
         assert detect_structure(text)["has_toc"] is False
 
+    def test_toc_markdown_atx_heading(self):
+        # issue #126: a Markdown export writes the ToC as "## Table of Contents"
+        text = """## Table of Contents
+1. Intro
+2. Body
+"""
+        assert detect_structure(text)["has_toc"] is True
+
+    def test_toc_markdown_headers_other_languages(self):
+        text = """## 目录
+第一章 开始
+第二章 进阶
+"""
+        assert detect_structure(text)["has_toc"] is True
+
+    def test_unit_style_chapter_headings(self):
+        # course-style books: "### Unit 1 ✏ ..." must be detected as chapters
+        text = """### Unit 1 ✏ How to Write an Introduction
+body
+### Unit 2 ✏ Writing about Methodology
+body
+"""
+        assert detect_structure(text)["chapters_detected"] >= 2
+
+    def test_stray_roman_numeral_does_not_suppress_structural_count(self):
+        # a single Roman numeral inside a reproduced example paper must not
+        # outvote the structural heading count of the surrounding book
+        text = """### Introduction
+VIII. CONCLUSIONS
+### Methodology
+"""
+        result = detect_structure(text)
+        assert result["chapters_detected"] >= 2
+        assert result["chapters_method"] == "structural"
+
+    def test_unit_style_headings_count_as_numeric(self):
+        # "Unit N" headings are explicit chapters once the markdown prefix is
+        # stripped, so they take the numeric branch
+        text = """### Unit 1 ✏ How to Write an Introduction
+VIII. CONCLUSIONS
+### Unit 2 ✏ Writing about Methodology
+"""
+        result = detect_structure(text)
+        assert result["chapters_detected"] >= 2
+        assert result["chapters_method"] == "numeric" 
+
     def test_numbered_list_items_are_not_chapters(self):
         # The AI-Engineering failure: numbered list items were counted as chapters.
         text = (
```

#### Recent Merged Pull Requests:
- **PR #249** (2026-09-29): fix(epub): preserve spine order with prefixed OPF elements (@Stamina9)
- **PR #247** (2026-09-28): ci: bump the github-actions group with 2 updates (@dependabot[bot])
- **PR #246** (2026-09-29): fix(extractor): stop counting wrapped prose and code lines as chapters (@william-xue)
- **PR #245** (2026-09-29): fix(extractor): retain per-source chapter heading samples (@hydraxman)
- **PR #243** (2026-09-29): feat(extractor): detect Malayalam (അധ്യായം) chapter headings (@dex0shubham)
- **PR #242** (2026-09-29): fix(rtf): decode hex-escaped text (@Stamina9)
- **PR #239** (2026-09-22): fix(docx): preserve inline tabs and breaks (@Stamina9)
- **PR #232** (2026-09-22): feat(extractor): detect Kannada (ಅಧ್ಯಾಯ) chapter headings (@dex0shubham)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

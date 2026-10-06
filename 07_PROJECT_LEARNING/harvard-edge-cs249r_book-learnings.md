# Forensic Learning Record (Deep Inspection): harvard-edge/cs249r_book

> **Canonical Artifact**: `07_PROJECT_LEARNING/harvard-edge-cs249r_book-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/harvard-edge/cs249r_book](https://github.com/harvard-edge/cs249r_book))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:13.592Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `harvard-edge/cs249r_book`
- **Description**: Machine Learning Systems: Foundations, Scaling, Agentic AI, and Physical AI (Vols I–IV) • Harvard CS249r | https://mlsysbook.ai
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 28814 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `binder/cli/checks/rendered_doubled_words.py`
```
#!/usr/bin/env python3
"""Flag doubled back-to-back words in SUBSTITUTED prose.

Why this cannot be a source-level check
---------------------------------------
The defect is invisible in the ``.qmd`` source. Given::

    (`{python} MobileNetTradeoffCalc.fps_fp32_str` FPS)

the source contains exactly one "FPS". The closed export renders ``8.3 FPS``,
so the reader sees ``(8.3 FPS FPS)``. ``prose --scope duplicate-words`` reads
source and therefore cannot see it; this checker substitutes values first.

Relationship to ``lego_prose_units.py``
---------------------------------------
That checker classifies exports as open/closed by *formatter name* and owns
domain-unit duplication. This one is formatter-agnostic: it reads the rendered
value, so it also catches label duplication from ``fmt_count(label=...)``
(``1,024 GPUs GPUs``), parameter/shard/lookup counts, and any future closed
export whose trailing token prose happens to repeat. On the 2026-08 corpus it
found 16 sites where the unit-specific checker found 10.

Cost: this executes LEGO cells, so it is slower than a source scan, but it does
NOT require a Quarto/HTML build -- it reuses the prose-preview machinery.

Added 2026-08-16 after a "surgical clarity" pass shipped 16 doubled tokens that
every source-level gate passed.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CONTENTS = REPO_ROOT  / "books"

sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "mlsysim"))

# Repeats that are legitimate English or table/markup artefacts.
ALLOW = {"had", "that", "no", "very", "long", "many", "s", "d", "t", "the"}

DOUBLE = re.compile(r"\b([A-Za-z][A-Za-z/%$.\-]{0,18})\s+\1\b")


def check_file(path: Path) -> list[tuple[int, str, str]]:
    """Return (lineno, doubled_token, rendered_context) for each hit."""
    from binder.tools.audit.fmt.audit_prose import audit_prose_previews

    try:
        previews = audit_prose_previews(path)
    except Exception as exc:  # noqa: BLE001 - a broken cell is another check's job
        print(f"  (skipped {path.name}: cell exec failed: {exc})", file=sys.stderr)
        return []

    issues: list[tuple[int, str, str]] = []
    for p in previews:
        text = p.preview or ""
        stripped = text.lstrip()
        if not stripped or stripped.startswith(("|", ":--", "---")):
            continue
        for m in DOUBLE.finditer(text):
            token = m.group(1)
            if token.lower() in ALLOW or token.isdigit():
                continue
            start = max(0, m.start() - 50)
            issues.append((p.line, token, text[start : m.end() + 25].strip()))
    return issues


def main() -> int:
    """Scan QMD files for doubled words after inline substitution.

    Positional paths may be files or directories (relative paths resolve
    against the repository root); with none, every ``.qmd`` under ``books/``
    is scanned. Files without a ``{python}`` cell are skipped. Hits are
    printed per file.

    Returns:
        1 if any file has a doubled word, otherwise 0.
    """
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="*", help="QMD file(s) or directories")
    args = ap.parse_args()

    if args.paths:
        expanded: list[Path] = []
        for raw in args.paths:
            p = Path(raw)
            if not p.is_absolute():
                p = REPO_ROOT / p
            if p.is_dir():
                expanded.extend(sorted(p.rglob("*.qmd")))
            elif p.suffix == ".qmd":
                expanded.append(p)
        paths = expanded
    else:
        paths = sorted(CONTENTS.rglob("*.qmd"))

    failures = 0
    total = 0
    for path in paths:
        p = path if path.is_absolute() else REPO_ROOT / path
        if not p.exists() or p.suffix != ".qmd":
            continue
        if "```{python}" not in p.read_text(encoding="utf-8"):
            continue  # no substitution can occur
        total += 1
        issues = check_file(p)
        if not issues:
            continue
        failures += 1
        print(f"\n{p.relative_to(REPO_ROOT)}")
        for lineno, token, context in issues:
            print(f"  L{lineno}: doubled '{token}' after substitution")
            print(f"    ...{context}...")

    if failures:
        print(f"\n{failures} file(s) with doubled words in rendered prose")
        return 1
    print(f"OK rendered prose has no doubled words ({total} QMD files with LEGO cells)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `binder/cli/commands/render.py`
```
"""
``binder render`` — Render generated figures to a browsable gallery.

Subcommands:
    plots    — Render all matplotlib/Python figures from QMD files to PNG.
               Outputs to ``_output/plots/<chapter>/<fig-label>.png``.

Future subcommands:
    diagrams — Render TikZ diagrams (requires lualatex)
    all      — Render everything
"""

import argparse
import os
import platform
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional  # noqa: UP035

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

_CODE_BLOCK = re.compile(r"```\{python\}\s*\n(.*?)```", re.DOTALL)
_FIG_LABEL = re.compile(r"#\|\s*label:\s*(fig-[\w-]+)")


def _extract_python_figures(qmd_path: Path) -> List[Dict]:
    """Extract Python code blocks that have a ``fig-*`` label."""
    content = qmd_path.read_text(encoding="utf-8")
    figures: List[Dict] = []

    for match in _CODE_BLOCK.finditer(content):
        block = match.group(1)
        label_match = _FIG_LABEL.search(block)
        if not label_match:
            continue

        label = label_match.group(1)

        # Strip #| directives to get executable Python
        lines = block.split("\n")
        code_lines = [ln for ln in lines if not ln.strip().startswith("#|")]
        code = "\n".join(code_lines).strip()

        figures.append({"label": label, "code": code})

    return figures


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def _render_one(code: str, output_path: str) -> Optional[str]:
    """Execute a figure's Python code and save to PNG.

    Returns None on success, or an error message string on failure.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Replace any direct show call with a save-and-close sequence.
    modified = re.sub(
        r"plt\.show\(\)",
        f"plt.savefig('{output_path}', dpi=150, bbox_inches='tight')\nplt.close('all')",
        code,
    )

    # If code never calls plt.show(), append savefig
    if "plt.show()" not in code and "savefig" not in code:
        modified += (
            f"\nplt.savefig('{output_path}', dpi=150, bbox_inches='tight')"
            f"\nplt.close('all')"
        )

    try:
        exec(modified, {"__name__": "__main__"})  # noqa: S102
        return None
    except Exception as e:
        return str(e)
    finally:
        plt.close("all")


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------


class RenderCommand:
    """Handles ``binder render`` operations."""

    def __init__(self, config_manager, chapter_discovery):
        """Store shared managers and the book directory used for scanning and output."""
        self.config_manager = config_manager
        self.chapter_discovery = chapter_discovery
        self.book_dir = config_manager.book_dir

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def run(self, args: List[str]) -> bool:
        """Parse ``binder render`` arguments and dispatch; only ``plots`` is implemented.

        With no subcommand (or ``help``) prints help and returns True. Returns
        False on an argparse error (True for ``-h``/``--help``).
        """
        if args == ["help"]:
            self._print_help()
            return True

        parser = argparse.ArgumentParser(
            prog="binder render",
            description="Render generated figures to a browsable gallery",
        )
        parser.add_argument(
            "subcommand",
            nargs="?",
            choices=["plots", "figures", "diagrams"],
            help="What to render (plots, figures, diagrams)",
        )
        parser.add_argument("chapters", nargs="?", default=None,
                            help="Chapter name(s), comma-separated")
        parser.add_argument("--vol1", action="store_true", help="Volume I only")
        parser.add_argument("--vol2", action="store_true", help="Volume II only")
        parser.add_argument("--vol3", action="store_true", help="Volume III only")
        parser.add_argument("--vol4", action="store_true", help="Volume IV only")
        parser.add_argument("--chapter", type=str, default="", help="Filter chapter slug(s)")
        parser.add_argument("--type", type=str, default="all", choices=["all", "tikz", "margin", "images", "cover"], help="Filter figure type")
        parser.add_argument("--limit", type=int, default=0, help="Limit number of figures (0 = all)")
        parser.add_argument("--no-render", action="store_true", help="Skip Quarto compile")
        parser.add_argument("--no-contact-sheets", action="store_true", help="Skip contact sheets")
        parser.add_argument("--contact-cols", type=int, default=3, help="Grid columns (default: 3)")
        parser.add_argument("--contact-rows", type=int, default=4, help="Grid rows (default: 4)")
        parser.add_argument("--dpi", type=int, default=110, help="Rasterization DPI (default: 110)")

        try:
            ns, unknown = parser.parse_known_args(args)
        except SystemExit:
            return ("-h" in args) or ("--help" in args)

        if not ns.subcommand:
            self._print_help()
            return True

        if ns.subcommand == "plots":
            return self._render_plots(ns)

        if ns.subcommand in ("figures", "diagrams"):
            return self._render_figures(ns, unknown)

        return False

    # ------------------------------------------------------------------
    # Help
    # ------------------------------------------------------------------

    def _print_help(self) -> None:
        """Print the subcommand table and usage examples."""
        table = Table(show_header=True, header_style="bold cyan", box=None)
        table.add_column("Subcommand", style="cyan", width=14)
        table.add_column("Description", style="white", width=55)
        table.add_row("plots", "Render matplotlib/Python figures to PNG gallery")
        table.add_row("figures", "Render figure-only PDF and PNG contact sheets")
        console.print(Panel(table, title="binder render <subcommand>", border_style="cyan"))
        console.print("[dim]Examples:[/dim]")
        console.print("  [cyan]./binder/binder render plots[/cyan]                    [dim]# all chapters, both volumes[/dim]")
        console.print("  [cyan]./binder/binder render plots --vol1[/cyan]             [dim]# Volume I only[/dim]")
        console.print("  [cyan]./binder/binder render figures --vol2[/cyan]           [dim]# Volume II figures PDF + contact sheets[/dim]")
        console.print("  [cyan]./binder/binder render figures --vol2 --type tikz[/cyan] [dim]# Volume II TikZ figures only[/dim]")
        console.print()

    def _render_figures(self, ns: argparse.Namespace, unknown: List[str]) -> bool:
        """Render figure contact sheets (TikZ, margin, images)."""
        import sys
        repo_root = Path(__file__).resolve().parents[3]
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        from scripts.generate_figure_contact_sheet import FigureContactSheetBuilder

        vol = "vol2" if ns.vol2 else ("vol1" if ns.vol1 else ("vol3" if ns.vol3 else ("vol4" if ns.vol4 else None)))
        if not vol:
            console.print("[red]Please specify a volume: --vol1, --vol2, --vol3, or --vol4[/red]")
            return False

        # Parse chapter filter
        chapter_filter = []
        if ns.chapter:
            chapter_filter = [c.strip() for c in ns.chapter.split(",") if c.strip()]
        elif ns.chapters:
            chapter_filter = [c.strip() for c in ns.chapters.split(",") if c.strip()]

        fig_type = "tikz" if ns.subcommand == "diagrams" else ns.type

        builder = FigureContactSheetBuilder(
            volume=vol,
            chapter_filter=chapter_filter,
            figure_type=fig_type,
            limit=ns.limit,
            dpi=max(36, ns.dpi),
            cols=max(1, ns.contact_cols),
            rows=max(1, ns.contact_rows),
        )
        entries = builder.extract_figures()
        if not entries:
            console.print(f"[yellow]No matching figures found for {vol}.[/yellow]")
            return False
        builder.export_metadata(entries)
        qmd_path = builder.generate_qmd(entries)
        console.print(f"[bold blue]Extracted[/bold blue] {len(entries)} figure{'s' if len(entries) != 1 else ''}.")
        console.print(f"[dim]Audit source:[/dim] {qmd_path}")
        if not ns.no_render:
            pdf_path = builder.render_pdf(qmd_path)
            if pdf_path and not ns.no_contact_sheets:
                sheets = builder.make_contact_sheets(pdf_path)
                if sheets:
                    console.print("[dim]Contact sheets:[/dim]")
                    for sheet in sheets:
                        console.print(f"  {sheet}")
        return True

    # ------------------------------------------------------------------
    # Resolve QMD files
    # ------------------------------------------------------------------

    def _resolve_qmd_files(self, ns: argparse.Namespace) -> List[Path]:
        """Resolve which QMD files to scan based on CLI arguments."""
        contents_dir = self.book_dir

        # Specific chapters requested
        if ns.chapters:
            chapter_names = [c.strip() for c in ns.chapters.split(",")]
            files: List[Path] = []
            for name in chapter_names:
                found = self.chapter_discovery.find_chapter_
```

### Core Architecture Module: `binder/cli/core/__init__.py`
```
"""
Core functionality for the MLSysBook CLI.

This module contains shared components used across different commands:
- Configuration management
- File and chapter discovery
- Output directory handling
"""

```

### Core Architecture Module: `binder/cli/core/artifacts.py`
```
"""Shared build-artifact cleanup primitives for Binder."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from rich.console import Console


@dataclass(frozen=True)
class ArtifactCleanupResult:
    """Counts of removed artifacts and restored config backups (dry runs count them too)."""

    cleaned_count: int
    restored_count: int


def clean_build_artifacts(
    book_dir: Path,
    *,
    dry_run: bool = False,
    console: Console | None = None,
) -> ArtifactCleanupResult:
    """Clean Quarto build artifacts and restore fast-build config backups."""
    out = console or Console()
    book_dir = Path(book_dir)

    out.print("[bold blue]Build Artifact Cleanup[/bold blue]")

    restored_count = 0
    for config_ext in ["_quarto-html.yml", "_quarto-pdf.yml"]:
        config_file = book_dir / "config" / config_ext
        backup_file = config_file.with_suffix(f"{config_file.suffix}.fast-build-backup")

        if backup_file.exists():
            if not dry_run:
                shutil.copy(backup_file, config_file)
                backup_file.unlink()
            restored_count += 1
            out.print(f"[green]  Restored: {config_file.name}[/green]")
        else:
            out.print(f"[dim]  Already clean: {config_file.name}[/dim]")

    artifacts_to_clean = [
        (book_dir / "_build", "Build directory (all formats)"),
        (book_dir / "index_files", "Book index files"),
        (book_dir / ".quarto", "Quarto cache (book)"),
    ]

    contents_core = book_dir / "core"
    if contents_core.exists():
        for chapter_dir in contents_core.glob("*/"):
            if not chapter_dir.is_dir():
                continue
            for files_dir in chapter_dir.glob("*_files"):
                if not files_dir.is_dir():
                    continue
                figure_html_dir = files_dir / "figure-html"
                if figure_html_dir.exists():
                    artifacts_to_clean.append(
                        (
                            figure_html_dir,
                            f"Quarto figure artifacts ({chapter_dir.name})",
                        )
                    )

            figure_html_direct = chapter_dir / "figure-html"
            if figure_html_direct.exists():
                artifacts_to_clean.append(
                    (
                        figure_html_direct,
                        f"Quarto figure artifacts ({chapter_dir.name})",
                    )
                )

    cleaned_count = 0
    for artifact_path, description in artifacts_to_clean:
        if not artifact_path.exists():
            continue
        out.print(f"[yellow]  Removing: {artifact_path.name} ({description})[/yellow]")
        if not dry_run:
            if artifact_path.is_dir():
                shutil.rmtree(artifact_path)
            else:
                artifact_path.unlink()
        cleaned_count += 1

    if cleaned_count:
        out.print(f"[green]  Cleaned {cleaned_count} item(s)[/green]")
    else:
        out.print("[green]  No artifacts to clean[/green]")

    return ArtifactCleanupResult(
        cleaned_count=cleaned_count,
        restored_count=restored_count,
    )

```

### Core Architecture Module: `binder/cli/core/bib_mechanical.py`
```
"""Mechanical bibliography fixes used by Binder and related book tools."""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence, TextIO

BOOK_DIR = Path(__file__).resolve().parents[2]
if str(BOOK_DIR) not in sys.path:
    sys.path.insert(0, str(BOOK_DIR))

from cli.checks.bib_lint import (  # noqa: E402
    JOURNAL_ABBREV_PATTERNS,
    Field,
    format_entry,
    parse_bib,
)


@dataclass(frozen=True)
class MechanicalFileResult:
    """Outcome for one .bib file; ``error`` is set when the file could not be read."""

    path: Path
    changed: bool
    error: str | None = None


def _project_root(start: Path) -> Path:
    """Resolve the repository root from the repository, the toolchain, or books/."""
    path = Path(start).resolve()
    if (path / "binder" / "binder").is_file():
        return path
    if (path / "binder").is_file() and path.name == "binder":
        return path.parent
    if (path / "config").is_dir() and path.name == "books":
        return path.parent
    try:
        raw = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=path,
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return Path(raw.strip()).resolve()
    except (OSError, subprocess.CalledProcessError):
        return path


def _abbrev_pairs() -> list[tuple[re.Pattern[str], str]]:
    """Compile the lint's journal-abbreviation patterns, except ``Phys`` ones using ``[A-Z]``."""
    out: list[tuple[re.Pattern[str], str]] = []
    for pattern, replacement in JOURNAL_ABBREV_PATTERNS:
        if "Phys" in pattern and r"[A-Z]" in pattern:
            continue
        out.append((re.compile(pattern), replacement))
    return out


_ABBREV = _abbrev_pairs()

_TITLE_TRAIL_ABBREV = re.compile(
    r"(?i)(?:^|\s)(inc|ltd|corp|co|etc|jr|sr|e\.g|i\.e|u\.s\.a?|u\.k|al|st|ave|"
    r"fig|vol|no|ed|ph\.?d|dr|m\.d|b\.?v|n\.?v|s\.a)\s*\.\s*$"
)
_TITLE_U_S = re.compile(r"\.[A-Z]\.$")


def fix_doi(value: str) -> str:
    """Strip whitespace and a leading ``doi.org`` or ``dx.doi.org`` URL prefix from a DOI."""
    text = (value or "").strip()
    for prefix in (
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
    ):
        if text[: len(prefix)].lower() == prefix.lower():
            text = text[len(prefix) :]
            break
    return text


def fix_title(value: str) -> str:
    """Drop one trailing period from a title.

    Returns the original value unchanged when there is no trailing period, the
    title ends in an ellipsis, or the period belongs to a known abbreviation
    (``Inc.``, ``e.g.``, ``U.S.``, and similar).
    """
    title = (value or "").rstrip()
    if not title.endswith(".") or title.endswith("..."):
        return value
    if _TITLE_TRAIL_ABBREV.search(title) or _TITLE_U_S.search(title):
        return value
    return title[:-1]


def fix_pages(value: str) -> str:
    """Remove a ``p.``/``pp.`` prefix and turn a single-hyphen range into a ``--`` range."""
    text = (value or "").strip()
    text = re.sub(r"^(?:p|pp)\.\s*", "", text, flags=re.IGNORECASE)
    if (
        "--" not in text
        and "-" in text
        and text.count("-") == 1
        and not text.startswith("-")
    ):
        text = text.replace("-", "--", 1)
    return text


def fix_journal(value: str) -> str:
    """Apply every matching journal-abbreviation replacement to a journal name."""
    text = value or ""
    for pattern, replacement in _ABBREV:
        if pattern.search(text):
            text = pattern.sub(replacement, text)
    return text


def _fix_year_field(field: Field) -> None:
    """Strip a four-digit ``year`` value in place and switch its quote style to braces."""
    if field.name.lower() != "year":
        return
    text = field.value.strip()
    if re.match(r"^\d{4}\s*$", text):
        field.value = text
        field.quote_style = "{"


def _apply_to_entry_fields(entry) -> int:
    """Apply the DOI, title, pages, journal, and year fixes in place.

    Returns the number of fields whose value changed; a year quote-style change
    alone is not counted.
    """
    changed = 0
    for field in entry.fields:
        name = field.name.lower()
        old_value = field.value
        if name == "doi":
            field.value = fix_doi(field.value)
        elif name == "title":
            field.value = fix_title(field.value)
        elif name == "pages":
            field.value = fix_pages(field.value)
        elif name == "journal":
            field.value = fix_journal(field.value)
        if name == "year":
            _fix_year_field(field)
        if field.value != old_value:
            changed += 1
    return changed


def apply_mechanical_fixes_to_text(text: str) -> str:
    """Return bibliography text with deterministic section 5 fixes applied."""
    entries, preamble = parse_bib(text)
    for entry in entries:
        _apply_to_entry_fields(entry)

    out: list[str] = []
    if preamble and preamble[0].strip():
        # One newline, not two: bibtex-tidy strips a blank line between a
        # leading comment block and the first entry, so emitting one here made
        # the two bib hooks undo each other on every run and no commit touching
        # a bibliography with a header could ever pass.
        out.append(preamble[0].rstrip() + "\n")
    for entry in entries:
        out.append(format_entry(entry, align_col=0))
        out.append("\n\n")
    return "".join(out).rstrip() + "\n"


def apply_mechanical_fixes_to_file(
    path: Path,
    *,
    dry_run: bool = False,
) -> MechanicalFileResult:
    """Apply mechanical bibliography fixes to one file."""
    try:
        old = path.read_text(encoding="utf-8")
    except OSError as exc:
        return MechanicalFileResult(path=path, changed=False, error=str(exc))

    new = apply_mechanical_fixes_to_text(old)
    if new == old:
        return MechanicalFileResult(path=path, changed=False)

    if not dry_run:
        path.write_text(new, encoding="utf-8")
    return MechanicalFileResult(path=path, changed=True)


def _resolve_explicit_file(path: Path, repo: Path) -> Path:
    """Resolve a user-supplied path: absolute as-is, else cwd if it exists, else repo-relative."""
    if path.is_absolute():
        return path.resolve()
    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists():
        return cwd_candidate
    return (repo / path).resolve()


def find_bib_files(repo: Path, explicit: Sequence[str | Path] | None = None) -> list[Path]:
    """Return explicit .bib files or every git-tracked .bib in the repo."""
    repo = _project_root(repo)
    if explicit:
        return [
            _resolve_explicit_file(Path(path), repo)
            for path in explicit
            if Path(path).suffix == ".bib"
        ]

    try:
        raw = subprocess.check_output(
            ["git", "ls-files", "-z", "*.bib"],
            cwd=repo,
            text=False,
        )
    except (OSError, subprocess.CalledProcessError):
        return sorted(path for path in repo.rglob("*.bib") if path.is_file())

    paths: list[Path] = []
    for chunk in raw.split(b"\0"):
        if chunk:
            paths.append(repo / chunk.decode("utf-8", errors="replace"))
    return sorted({path for path in paths if path.is_file()})


def run_mechanical_fixes(
    repo: Path,
    files: Sequence[str | Path] | None = None,
    *,
    dry_run: bool = False,
    pre_commit: bool = False,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    """Run the Binder bibliography mechanical-fix workflow."""
    if pre_commit and not files:
        return 0

    repo = _project_root(repo)
    targets = find_bib_files(repo, files)
    if not targets:
        print("No .bib files to process", file=stderr)
        return 1

    changed = 0
    for target in targets:
        result = apply_mechanical_fixes_to_file(target, dry_run=dry_run)
        try:
            label = result.path.relative_to(repo)
        except ValueError:
            label = result.path
        if result.error:
            print(f"SKIP {label}: {result.error}", file=stderr)
            continue
        if result.changed:
            prefix = "(dry-run) " if dry_run else ""
            print(f"{prefix}{label}  (updated)", file=stdout)
            changed += 1
        else:
            print(f"{label}  (no changes)", file=stdout)

    print(f"Done: {changed} / {len(targets)} files with edits", file=stdout)
    if pre_commit and changed:
        return 1
    return 0

```

### Core Architecture Module: `binder/cli/core/config.py`
```
"""
Configuration management for MLSysBook CLI.

Handles Quarto configuration files, the generated _quarto.yml, and format-specific settings.
"""

import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from rich.console import Console
from .volume_index import volume_index_source, write_volume_index

console = Console()

ACTIVE_CONFIG_MARKER = "# binder: generated copy of "


def write_active_config(active_config: Path, source: Path, book_dir: Path) -> None:
    """Write *source* to the project's ``_quarto.yml`` with a provenance header.

    Quarto only reads ``_quarto.yml``, so every build copies the chosen
    configuration there. The first line records the source file so status
    output and post-render scripts can tell which configuration is active.

    Args:
        active_config: Destination path (usually ``book_dir / "_quarto.yml"``).
        source: Source configuration file to copy.
        book_dir: Project books root directory for relative provenance path.
    """
    header = (
        f"{ACTIVE_CONFIG_MARKER}{source.relative_to(book_dir).as_posix()}\n"
        "# Regenerated on every build; edit the source file, not this copy.\n"
    )
    # Earlier binder versions left a symlink here. Writing through it would
    # overwrite the source configuration, so remove it first.
    if active_config.is_symlink():
        active_config.unlink()
    active_config.write_text(header + source.read_text(encoding="utf-8"), encoding="utf-8")


def active_config_source(active_config: Path) -> Optional[str]:
    """Return the source file recorded in a generated ``_quarto.yml``, or None.

    Args:
        active_config: Path to the active ``_quarto.yml`` file.

    Returns:
        Relative path string recorded in the header marker, or None if invalid or missing.
    """
    if not active_config.is_file():
        return None
    with active_config.open(encoding="utf-8") as fh:
        first_line = fh.readline()
    if not first_line.startswith(ACTIVE_CONFIG_MARKER):
        return None
    return first_line[len(ACTIVE_CONFIG_MARKER):].strip()


def get_output_file(output_dir: Path, format_type: str) -> Optional[Path]:
    """Return the primary output file for a build: any .pdf, any .epub, or index.html.

    Used by build (open output) and the parallel runner (success check) so all
    commands use the same rule: PDF = first .pdf in dir, EPUB = first .epub in
    dir, HTML = index.html.

    Args:
        output_dir: Directory where build output was emitted.
        format_type: Output format ("html", "pdf", or "epub").

    Returns:
        Path to primary output file if found, otherwise None.
    """
    if not output_dir.exists():
        return None
    if format_type == "pdf":
        for p in sorted(output_dir.iterdir()):
            if p.is_file() and p.suffix.lower() == ".pdf":
                return p
        return None
    if format_type == "epub":
        for p in sorted(output_dir.iterdir()):
            if p.is_file() and p.suffix.lower() == ".epub":
                return p
        return None
    if format_type == "html":
        index = output_dir / "index.html"
        return index if index.exists() else None
    return None


class ConfigManager:
    """Manages Quarto configuration files and format switching."""

    def __init__(self, root_dir: Path):
        """Initialize configuration manager.

        Args:
            root_dir: Root directory of the MLSysBook project
        """
        self.root_dir = Path(root_dir)

        # Determine the book directory, which is the Quarto project root.
        #
        # Book sources live in books/ at the repository root: one directory per
        # volume, plus shared/ for anything cross-volume, plus the config/ and
        # _extensions/ that Quarto needs at its project root. Before 2026-09
        # this lived at books/ with the volumes under contents/,
        # and books/ held a second, drifting copy that fed nothing. See
        # docs/REPO_LAYOUT.md.
        if (self.root_dir / "books" / "config").exists():
            # Running from the repository root
            self.book_dir = self.root_dir / "books"
        elif (self.root_dir / "config").exists() and (self.root_dir / "vol1").exists():
            # Already inside books/
            self.book_dir = self.root_dir
        elif (self.root_dir.parent / "books" / "config").exists():
            # Running from a sibling directory such as binder/
            self.book_dir = self.root_dir.parent / "books"
        else:
            # Fallback
            self.book_dir = self.root_dir

        # Configuration file paths (default to vol1 configs since combined configs don't exist)
        self.html_config = self.book_dir / "config" / "_quarto-html-vol1.yml"
        self.pdf_config = self.book_dir / "config" / "_quarto-pdf-vol1.yml"
        self.epub_config = self.book_dir / "config" / "_quarto-epub-vol1.yml"

        # Volume-specific configuration file paths
        self.html_vol1_config = self.book_dir / "config" / "_quarto-html-vol1.yml"
        self.html_vol2_config = self.book_dir / "config" / "_quarto-html-vol2.yml"
        self.html_vol3_config = self.book_dir / "config" / "_quarto-html-vol3.yml"
        self.html_vol4_config = self.book_dir / "config" / "_quarto-html-vol4.yml"
        self.pdf_vol1_config = self.book_dir / "config" / "_quarto-pdf-vol1.yml"
        self.pdf_vol2_config = self.book_dir / "config" / "_quarto-pdf-vol2.yml"
        self.pdf_vol3_config = self.book_dir / "config" / "_quarto-pdf-vol3.yml"
        self.pdf_vol4_config = self.book_dir / "config" / "_quarto-pdf-vol4.yml"
        self.epub_vol1_config = self.book_dir / "config" / "_quarto-epub-vol1.yml"
        self.epub_vol2_config = self.book_dir / "config" / "_quarto-epub-vol2.yml"
        self.epub_vol3_config = self.book_dir / "config" / "_quarto-epub-vol3.yml"
        self.epub_vol4_config = self.book_dir / "config" / "_quarto-epub-vol4.yml"

        self.active_config = self.book_dir / "_quarto.yml"
        self.active_index = self.book_dir / "index.qmd"

        # Canonical sources shared with the Linux and Windows CI builds.
        self.index_vol1 = self.book_dir / "index-vol1.qmd"
        self.index_vol2 = self.book_dir / "index-vol2.qmd"
        self.index_vol3 = self.book_dir / "index-vol3.qmd"
        self.index_vol4 = volume_index_source(self.book_dir, "vol4", "pdf")
        self.html_index_vol4 = volume_index_source(self.book_dir, "vol4", "html")

    def get_config_file(self, format_type: str, volume: Optional[str] = None) -> Path:
        """Get the configuration file for a specific format and optional volume.

        Args:
            format_type: Format type ('html', 'pdf', 'epub')
            volume: Optional volume (e.g. 'vol1', 'vol2', 'vol3', 'vol4', 'vol5')

        Returns:
            Path to the configuration file

        Raises:
            ValueError: If format_type is not supported
        """
        if format_type not in ("html", "pdf", "epub"):
            raise ValueError(f"Unsupported format type: {format_type}")

        if volume:
            config_file = self.book_dir / "config" / f"_quarto-{format_type}-{volume}.yml"
            if config_file.exists():
                return config_file
            console.print(f"[yellow]⚠️ Volume config not found: {config_file}, falling back to default config[/yellow]")

        default_config = self.book_dir / "config" / f"_quarto-{format_type}-vol1.yml"
        if default_config.exists():
            return default_config
        return self.book_dir / "config" / f"_quarto-{format_type}.yml"

    def activate_config(self, format_type: str, volume: Optional[str] = None) -> str:
        """Copy the config for a format and optional volume to ``_quarto.yml``.

        Args:
            format_type: Format type ('html', 'pdf', 'epub')
            volume: Optional volume (e.g., 'vol1', 'vol2', 'vol4', 'tinytorch') for volume-specific builds

        Returns:
            Name of the config file that was copied

        Raises:
            ValueError: If format_type is not supported
            FileNotFoundError: If the config file does not exist
        """
        config_file = self.get_config_file(format_type, volume)

        if not config_file.exists():
            raise FileNotFoundError(f"Config file not found: {config_file}")

        self.activate_config_file(config_file)

        # Volume builds need a root entry point for the selected format.
        if volume:
            self._activate_index(volume, format_type)

        return config_file.name

    def activate_config_file(self, source: Path) -> None:
        """Write *source* as the active ``_quarto.yml``."""
        write_active_config(self.active_config, source, self.book_dir)

    def active_config_source(self) -> Optional[str]:
        """Return the config file the active ``_quarto.yml`` was copied from."""
        return active_config_source(self.active_config)

    def _activate_index(self, volume: str, format_type: str = "pdf") -> None:
        """Generate ``index.qmd`` from the canonical volume/format source."""
        source = write_volume_index(self.book_dir, volume, format_type)
        console.print(f"[dim]📄 Copied {source.relative_to(self.book_dir).as_posix()} → index.qmd[/dim]")

    def active_index_source(self) -> Optional[str]:
        """Return the volume index whose content ``index.qmd`` holds, or None."""
        if not self.active_index.is_file():
            return None
        content = self.active_index.read_bytes()
        for index_candidate in sorted(self.book_dir.glob("index-*.qmd")):
            if index_candidate.is_file() and index_candidate.read_bytes() == content:
                return index_candidate.relative_to(self.book_dir).as_posix()
        for vol_dir in self.book_dir.iterdir():
            if vol_dir.is_dir() and (vol_dir.name.startswith("vol") or vol_dir.name == "tinytorch"):
                for rel in ("index.qmd
```

### Core Architecture Module: `binder/cli/core/discovery.py`
```
"""
File and chapter discovery for MLSysBook CLI.

Handles finding chapter files, validating paths, and managing file operations.
Supports volume-aware discovery for vol1 through vol4.

Single source of truth for chapter ordering: `get_chapters_from_config()` reads
the PDF YAML config for a volume and returns the ordered list of testable chapter
stems. All commands (debug, build, validate, etc.) should call this method rather
than maintaining their own exclusion lists or filesystem scans.
"""

import re
import fnmatch
from pathlib import Path
from typing import List, Optional, Dict, Any
from rich.console import Console

console = Console()

def discover_volumes(book_dir: Path) -> List[str]:
    """Dynamically discover all volume directories under book_dir.

    Scans the given directory for subdirectories matching the pattern ``vol\\d+``
    as well as standalone named volumes like ``tinytorch``. Sorts volume names
    numerically (e.g., vol1, vol2, vol3, vol4), followed by non-numeric volumes.
    If the directory does not exist or yields no volume folders, returns the
    canonical default list (``["vol1", "vol2", "vol3", "vol4"]``).

    Args:
        book_dir: Path to the books root directory containing volume folders.

    Returns:
        Sorted list of volume directory names.
    """
    if not book_dir.exists():
        return ["vol1", "vol2", "vol3", "vol4"]
    vols = [
        d.name for d in book_dir.iterdir()
        if d.is_dir() and re.match(r"^vol\d+$", d.name)
    ]
    if (book_dir / "tinytorch").is_dir():
        vols.append("tinytorch")
    if not vols:
        return ["vol1", "vol2", "vol3", "vol4"]
    return sorted(
        vols,
        key=lambda v: (0, int(v[3:])) if v.startswith("vol") and v[3:].isdigit() else (1, v)
    )


def format_volume_display_name(volume: str) -> str:
    """Format volume identifier into human-friendly display name.

    Converts identifiers like ``"vol1"`` to ``"Volume I"``, ``"vol4"`` to
    ``"Volume IV"``, and ``"tinytorch"`` to ``"TinyTorch"``. Any other volume
    identifier is capitalized.

    Args:
        volume: Volume directory identifier (e.g., ``"vol1"``, ``"tinytorch"``).

    Returns:
        Formatted human-readable display string.
    """
    roman_map = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X"}
    if volume.startswith("vol") and volume[3:].isdigit():
        num = int(volume[3:])
        return f"Volume {roman_map.get(num, str(num))}"
    if volume == "tinytorch":
        return "TinyTorch"
    return volume.capitalize()


# Default volume directories; dynamic discovery should be preferred via ChapterDiscovery or discover_volumes()
VOLUME_DIRS = ["vol1", "vol2", "vol3", "vol4"]

# Shared content directory (sibling to vol1/, vol2/ under contents/)
SHARED_DIR = "shared"

# Chapter stems that cannot be rendered standalone and are always excluded from
# per-chapter build/debug operations.
SKIP_STEMS = frozenset({"index", "references"})



def _chapters_from_html_sidebar(book_dir: Path, volume: str) -> List[str]:
    """Extract buildable chapter stems from the HTML config sidebar (href entries).

    Parses ``binder/config/_quarto-html-{volume}.yml`` for sidebar hrefs matching
    the volume, excluding stems in ``SKIP_STEMS`` (e.g. index, references).

    Args:
        book_dir: Path to the books root directory.
        volume: Target volume identifier (e.g., ``"vol1"``, ``"vol4"``).

    Returns:
        Ordered list of buildable chapter file stems from the sidebar.
    """
    html_config = book_dir / "config" / f"_quarto-html-{volume}.yml"
    if not html_config.is_file():
        return []
    content = html_config.read_text(encoding="utf-8")
    chapters: List[str] = []
    seen: set = set()
    for m in re.finditer(r'href:\s*(?:contents/)?([^\s#]+\.qmd)', content):
        path_str = m.group(1)
        if f"/{volume}/" not in path_str and not path_str.startswith(f"{volume}/"):
            continue
        stem = Path(path_str).stem
        if stem in SKIP_STEMS or stem in seen:
            continue
        seen.add(stem)
        chapters.append(stem)
    return chapters

def get_chapters_from_config(book_dir: Path, volume: str) -> List[str]:
    """Return the ordered list of buildable file stems from the PDF config.

    Reads ``binder/config/_quarto-pdf-{volume}.yml`` and extracts every entry
    under ``book.chapters`` — including frontmatter, parts pages, and shared
    files.  Appendices are excluded.  Only ``index.qmd`` and ``references.qmd``
    are skipped, as they cannot be rendered standalone.

    Args:
        book_dir: Path to the ``books/`` directory.
        volume: Volume identifier (e.g., ``"vol1"``, ``"vol2"``, ``"vol4"``).

    Returns:
        Ordered list of file stems in YAML order (e.g. ``["dedication",
        "introduction", "distributed_training", ...]``).  Empty list if the
        config is missing or cannot be parsed.
    """
    config_file = book_dir / "config" / f"_quarto-pdf-{volume}.yml"
    if not config_file.exists():
        sidebar = _chapters_from_html_sidebar(book_dir, volume)
        if sidebar:
            return sidebar
        vol_dir = book_dir / volume
        if vol_dir.is_dir():
            return sorted([
                p.stem for p in vol_dir.rglob("*.qmd")
                if p.stem not in SKIP_STEMS and not p.name.startswith("_")
            ])
        return []

    def _is_testable(path_str: str) -> bool:
        """Return True unless the path's stem is in ``SKIP_STEMS``."""
        return Path(path_str).stem not in SKIP_STEMS

    # --- YAML-aware path (preferred) ---
    try:
        import yaml  # type: ignore

        raw = yaml.safe_load(config_file.read_text())
        chapter_entries = raw.get("book", {}).get("chapters", [])

        chapters: List[str] = []
        seen: set = set()
        for entry in chapter_entries:
            if isinstance(entry, str):
                path = entry
            elif isinstance(entry, dict):
                path = entry.get("file", "")
            else:
                continue
            if not path or not _is_testable(path):
                continue
            stem = Path(path).stem
            if stem and stem not in seen:
                seen.add(stem)
                chapters.append(stem)
    except Exception:
        pass

    if len(chapters) < 5:
        content = config_file.read_text()
        chapters_block_match = re.search(
            r'^\s{2}chapters:\s*\n(.*?)(?=^\s{2}\w|\Z)',
            content,
            re.MULTILINE | re.DOTALL,
        )
        block = chapters_block_match.group(1) if chapters_block_match else content
        for line in block.splitlines():
            if line.lstrip().startswith("#"):
                continue
            m = re.search(r'-\s*(?:contents/)?([^\s#]+\.qmd)', line)
            if not m:
                continue
            path_str = m.group(1)
            if not _is_testable(path_str):
                continue
            stem = Path(path_str).stem
            if stem not in seen:
                seen.add(stem)
                chapters.append(stem)

    if len(chapters) < 5:
        sidebar = _chapters_from_html_sidebar(book_dir, volume)
        if len(sidebar) > len(chapters):
            return sidebar

    return chapters


class AmbiguousChapterError(Exception):
    """Raised when a query identifies more than one chapter."""

    def __init__(self, chapter_name: str, locations: List[str]):
        """Record the query and its candidate locations and build the error message."""
        self.chapter_name = chapter_name
        self.locations = locations
        super().__init__(
            f"'{chapter_name}' matches multiple chapters: {', '.join(locations)}"
        )


class ChapterDiscovery:
    """Discovers and manages chapter files in the MLSysBook project."""

    def __init__(self, book_dir: Path):
        """Initialize chapter discovery.

        Args:
            book_dir: Path to the book directory (``books/``)
        """
        self.book_dir = Path(book_dir)
        self.contents_dir = self.book_dir

    def get_available_volumes(self) -> List[str]:
        """Return list of dynamically discovered volume names."""
        return discover_volumes(self.contents_dir)

    def get_chapters_from_config(self, volume: str) -> List[str]:
        """Return the ordered list of testable chapter stems for a volume.

        Delegates to the module-level ``get_chapters_from_config`` function so
        that all CLI commands share a single implementation. Use it whenever
        the canonical build order matters.

        Args:
            volume: Volume name (e.g. ``"vol1"``, ``"vol2"``, etc.).

        Returns:
            Ordered list of chapter stems from the PDF config (e.g.
            ``["introduction", "distributed_training", ...]``).
        """
        return get_chapters_from_config(self.book_dir, volume)

    def _get_volume_from_path(self, path: Path) -> Optional[str]:
        """Extract volume from a file path.

        Args:
            path: Path to check

        Returns:
            Volume string (e.g. 'vol1'), or None if not in a volume directory
        """
        try:
            rel_path = path.relative_to(self.contents_dir)
            parts = rel_path.parts
            if parts and (parts[0] in self.get_available_volumes() or re.match(r"^vol\d+$", parts[0])):
                return parts[0]
        except ValueError:
            pass
        return None

    def _parse_chapter_spec(self, chapter_spec: str) -> tuple[Optional[str], str]:
        """Parse a chapter specification that may include volume prefix.

        Args:
            chapter_spec: Chapter name, optionally with volume prefix (e.g., 'vol1/intro')

        Returns:
            Tuple of (volume, chapter_name) where volume may be None
        """
        if "/" in chapter_spec:
            parts = chapter_spec.split("/", 1)
            if parts[0] 
```

### Core Architecture Module: `binder/cli/core/parallel.py`
```
"""Run binder builds side by side, each in its own git worktree.

``binder build ... --parallel N`` and ``binder debug ... --parallel N`` turn a
request into :class:`BuildJob` objects and hand them to :func:`run_jobs`. The
runner uses N worker threads; each worker owns one :class:`BuildSession`, a
workspace (see :mod:`workspace`) that it reuses for every job it picks up. A
job runs ``binder build`` inside the workspace, and its log and output
directory are moved into the invoking checkout under the run directory, so
results outlive the workspace.

``binder debug`` also drives a :class:`BuildSession` directly for its section
bisection, which needs a single workspace and chooses each build from the
previous result.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from .config import ConfigManager, get_output_file
from .discovery import VOLUME_DIRS
from .process import start_process_group, stop_process_group
from .workspace import (
    Snapshot,
    Workspace,
    create_workspace,
    remove_workspace,
    take_snapshot,
    workspace_path,
)

FORMATS = ("html", "pdf", "epub")

#: Default worker count: a quarter of the cores, clamped to 1-4. Each worker
#: renders a whole Quarto project, which is CPU- and memory-heavy.
DEFAULT_WORKERS = max(1, min(4, (os.cpu_count() or 4) // 4))

#: Seconds a stopped build gets after SIGTERM to clean up before it is killed.
STOP_GRACE_SECONDS = 15

#: Per-job time limit, matching the renderer timeout inside ``binder build``.
DEFAULT_TIMEOUT_SECONDS = 1800


@dataclass(frozen=True)
class BuildJob:
    """One ``binder build`` invocation to run in a workspace.

    Attributes:
        format_type: ``html``, ``pdf``, or ``epub``.
        volume: Volume directory name such as ``vol1``.
        chapter: Canonical chapter file stem; ``None`` builds the whole volume.
        extra_args: Additional ``binder build`` flags, such as ``--skip-validate``.
        label: Name that distinguishes jobs with identical arguments, such as
            the steps of a section bisection.
    """

    format_type: str
    volume: str
    chapter: Optional[str] = None
    extra_args: Tuple[str, ...] = ()
    label: str = ""

    @property
    def name(self) -> str:
        """Identifier for the job's log and output directory."""
        if self.label:
            return self.label
        return "-".join(part for part in (self.volume, self.format_type, self.chapter) if part)

    def binder_args(self) -> List[str]:
        """Arguments for ``binder`` that perform this job."""
        args = ["build", self.format_type]
        if self.chapter:
            args.append(self.chapter)
        return [*args, f"--{self.volume}", *self.extra_args]

    def output_dir(self, workspace_root: Path) -> Path:
        """Directory this job's build writes to inside the checkout at *workspace_root*.

        Mirrors ``BuildCommand``: a volume build uses the configured
        ``project.output-dir`` and a chapter build writes to
        ``chapters/<stem>`` beneath it.
        """
        base = ConfigManager(workspace_root).get_output_dir(self.format_type, self.volume)
        return base / "chapters" / self.chapter if self.chapter else base


@dataclass
class JobResult:
    """Outcome of one :class:`BuildJob`.

    Attributes:
        job: The job that ran.
        ok: True when ``binder build`` exited 0 and produced its artifact.
        returncode: Exit status, or ``None`` if the build never ran or was stopped.
        seconds: Wall-clock duration, including workspace preparation.
        log_path: Combined standard output and error of the build.
        output_dir: Collected output in the invoking checkout, if any was written.
        artifact: Primary artifact inside ``output_dir`` (PDF, EPUB, or ``index.html``).
        note: Short explanation when the job did not succeed normally.
    """

    job: BuildJob
    ok: bool
    returncode: Optional[int]
    seconds: float
    log_path: Path
    output_dir: Optional[Path] = None
    artifact: Optional[Path] = None
    note: str = ""

    def log_text(self) -> str:
        """Return the build log, or an empty string when none was written."""
        try:
            return self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def to_dict(self) -> dict:
        """JSON-serializable summary used for ``summary.json`` and ``--json`` output."""
        return {
            "job": self.job.name,
            "format": self.job.format_type,
            "volume": self.job.volume,
            "chapter": self.job.chapter,
            "ok": self.ok,
            "returncode": self.returncode,
            "seconds": round(self.seconds, 1),
            "log": str(self.log_path),
            "output_dir": str(self.output_dir) if self.output_dir else None,
            "artifact": str(self.artifact) if self.artifact else None,
            "note": self.note,
        }


def new_run_id() -> str:
    """Return a timestamped identifier that is unique to this process."""
    return f"{datetime.now():%Y%m%d-%H%M%S}-{os.getpid()}"


class BuildSession:
    """A workspace that runs build jobs one at a time.

    Use it as a context manager: the workspace is created on the first job and
    removed on exit unless ``keep`` is set.

    Args:
        snapshot: Content the workspace is created from.
        run_dir: Directory in the invoking checkout that receives job logs and output.
        name: Workspace directory name, unique within the run.
        run_id: Groups this run's workspaces under the workspace root.
        isolate_cache: Give builds a private ``XDG_CACHE_HOME``. The Pandoc
            diagram filter writes cache files non-atomically, so builds that
            run at the same time must not share its cache.
        keep: Leave the workspace on disk for inspection.
        timeout_seconds: Per-job limit before the build is stopped.
    """

    def __init__(
        self,
        snapshot: Snapshot,
        run_dir: Path,
        *,
        name: str,
        run_id: str,
        isolate_cache: bool = False,
        keep: bool = False,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ):
        """Store the session settings; the workspace is created lazily by ``path``."""
        self.snapshot = snapshot
        self.run_dir = Path(run_dir)
        self.name = name
        self.run_id = run_id
        self.isolate_cache = isolate_cache
        self.keep = keep
        self.timeout_seconds = timeout_seconds
        self.workspace: Optional[Workspace] = None
        self._process: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()

    def __enter__(self) -> "BuildSession":
        """Return the session itself."""
        return self

    def __exit__(self, *exc_info) -> bool:
        """Close the session and let any exception propagate."""
        self.close()
        return False

    @property
    def path(self) -> Path:
        """Workspace root, created on first use."""
        if self.workspace is None:
            self.workspace = create_workspace(self.snapshot, workspace_path(self.run_id, self.name))
        return self.workspace.path

    def run(self, job: BuildJob, prepare: Optional[Callable[[Path], None]] = None) -> JobResult:
        """Run *job* in the workspace and collect its log and output.

        Args:
            job: The build to run.
            prepare: Called with the workspace root before the build starts,
                for callers that edit sources inside the workspace.

        Returns:
            The job's result; setup errors are reported as a failed result.

        Raises:
            KeyboardInterrupt: Re-raised after the running build is stopped.
        """
        job_dir = self.run_dir / job.name
        if job_dir.exists():
            shutil.rmtree(job_dir)
        job_dir.mkdir(parents=True)
        log_path = job_dir / "build.log"
        start = time.monotonic()

        try:
            root = self.path
            if prepare is not None:
                prepare(root)
            stale = job.output_dir(root)
            if stale.exists():
                shutil.rmtree(stale)
        except Exception as error:
            log_path.write_text(f"{type(error).__name__}: {error}\n", encoding="utf-8")
            return JobResult(job, False, None, time.monotonic() - start, log_path,
                             note=f"setup failed: {error}")

        env = dict(os.environ, PYTHONUNBUFFERED="1")
        if self.isolate_cache:
            env["XDG_CACHE_HOME"] = str(root / ".binder-cache")
        cmd = [sys.executable, str(root / "binder" / "binder"), "-v", *job.binder_args()]
        returncode: Optional[int] = None
        note = ""
        with log_path.open("w", encoding="utf-8") as log:
            log.write(f"$ ./binder/binder {' '.join(cmd[3:])}\n# workspace: {root}\n\n")
            log.flush()
            process = start_process_group(cmd, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
            with self._lock:
                self._process = process
            try:
                returncode = process.wait(timeout=self.timeout_seconds)
            except subprocess.TimeoutExpired:
                stop_process_group(process, STOP_GRACE_SECONDS)
                note = f"timed out after {self.timeout_seconds}s"
            except KeyboardInterrupt:
                stop_process_group(process, STOP_GRACE_SECONDS)
                raise
            finally:
                with self._lock:
                    self._process = None

        output_dir = artifact = None
        built = job.output_dir(root)
        if built.is_dir():
            
```

### Core Architecture Module: `binder/cli/core/process.py`
```
"""Process-group helpers shared by the build, debug, and parallel runners.

Quarto renders through a tree of child processes (Pandoc, LaTeX, Python
kernels). Binder starts each renderer in its own session so the whole tree
can be stopped at once, and gives the renderer a ``PYTHONPATH`` that imports
this checkout's sources ahead of any installed copy.
"""

from __future__ import annotations

import contextlib
import os
import signal
import subprocess
import threading
from pathlib import Path
from typing import Iterator, Mapping, Optional, Sequence


def local_render_env(root_dir: Path, base: Optional[Mapping[str, str]] = None) -> dict[str, str]:
    """Return an environment whose ``PYTHONPATH`` imports *root_dir*'s sources first.

    The repository root and its nested ``mlsysim`` package directory lead the
    path, so a globally installed or stale editable checkout never shadows the
    worktree being rendered. An existing ``PYTHONPATH`` is kept after them.

    Args:
        root_dir: Repository root of the checkout being rendered.
        base: Environment to start from; defaults to ``os.environ``.

    Returns:
        A new environment dictionary.
    """
    env = dict(os.environ if base is None else base)
    root = Path(root_dir).resolve()
    paths = [str(root), str((root / "mlsysim").resolve())]
    if env.get("PYTHONPATH"):
        paths.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(paths)
    return env


def start_process_group(cmd: Sequence[str], **popen_kwargs) -> subprocess.Popen:
    """Start *cmd* as the leader of a new session.

    Every process the command spawns joins that session's process group, so
    :func:`stop_process_group` can stop the whole tree. Keyword arguments are
    passed to :class:`subprocess.Popen`.
    """
    return subprocess.Popen(list(cmd), start_new_session=True, **popen_kwargs)


def stop_process_group(process: Optional[subprocess.Popen], grace_seconds: float = 0.0) -> None:
    """Stop a process started with :func:`start_process_group` and wait for it.

    With a grace period the group first receives SIGTERM, which lets a child
    ``binder`` stop its own renderer and restore generated files; anything
    still running when the grace period ends is killed. Without a grace period
    the group is killed immediately. Where process groups are unavailable
    (Windows), the process itself is terminated or killed instead.

    Args:
        process: Process to stop; ``None`` or an already exited process is a no-op.
        grace_seconds: Seconds to wait after SIGTERM before killing.
    """
    if process is None or process.poll() is not None:
        return
    if grace_seconds > 0:
        _signal_group(process, terminate=True)
        try:
            process.wait(timeout=grace_seconds)
            return
        except subprocess.TimeoutExpired:
            pass
    _signal_group(process, terminate=False)
    process.wait()


def _signal_group(process: subprocess.Popen, terminate: bool) -> None:
    """Send SIGTERM (when *terminate*) or SIGKILL to *process*'s group, ignoring exit races."""
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGTERM if terminate else signal.SIGKILL)
        elif terminate:
            process.terminate()
        else:
            process.kill()
    except ProcessLookupError:
        pass  # The group exited between poll() and the signal.


@contextlib.contextmanager
def interrupts_as_keyboard_interrupt() -> Iterator[None]:
    """Raise ``KeyboardInterrupt`` for SIGINT and SIGTERM inside the block.

    Build code then unwinds through its own ``finally`` blocks, which stop the
    renderer and restore generated files, instead of exiting mid-cleanup. The
    previous handlers are reinstated on exit. Python only allows signal
    handlers on the main thread, so on other threads the block runs unchanged.
    """
    if threading.current_thread() is not threading.main_thread():
        yield
        return

    def _raise(signum, frame):
        """Signal handler that raises ``KeyboardInterrupt`` naming the signal."""
        raise KeyboardInterrupt(f"Interrupted by signal {signum}")

    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
    for sig in previous:
        signal.signal(sig, _raise)
    try:
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)

```

### Core Architecture Module: `binder/cli/core/volume_index.py`
```
"""Generate Quarto's root entry point from the volume's canonical source.

This standard-library-only module is also the Linux/Windows CI entry point.
"""

import argparse
from pathlib import Path
import shutil


def volume_index_source(book_dir: Path, volume: str, format_type: str) -> Path:
    """Resolve the canonical entry point file for a volume and build format.

    Selects the homepage for HTML and the preface or landing file for PDF/EPUB.
    Checks for legacy root-level ``index-{volume}.qmd`` first; if absent,
    resolves dynamically from within the volume directory:
    - HTML: ``{volume}/index.qmd`` (falling back to ``{volume}/frontmatter/about.qmd``).
    - PDF/EPUB: ``{volume}/frontmatter/about.qmd`` (falling back to ``{volume}/index.qmd``).

    Args:
        book_dir: Path to the books root directory.
        volume: Volume identifier (e.g., "vol1", "vol4", "tinytorch").
        format_type: Build format ("html", "pdf", or "epub").

    Returns:
        Path to the resolved canonical source file.

    Raises:
        ValueError: If format_type is not one of {"html", "pdf", "epub"}.
    """
    if format_type not in {"html", "pdf", "epub"}:
        raise ValueError(f"Unsupported format: {format_type}")
    book_dir = Path(book_dir)

    # If root-level index-{volume}.qmd exists (canonical for legacy vol1-vol3)
    root_index = book_dir / f"index-{volume}.qmd"
    if root_index.is_file():
        return root_index

    # Otherwise resolve from volume directory (e.g. vol4, volN, tinytorch)
    if format_type == "html":
        html_idx = book_dir / volume / "index.qmd"
        if html_idx.is_file():
            return html_idx
        about_idx = book_dir / volume / "frontmatter" / "about.qmd"
        if about_idx.is_file():
            return about_idx
        return html_idx
    else:
        about_idx = book_dir / volume / "frontmatter" / "about.qmd"
        if about_idx.is_file():
            return about_idx
        idx = book_dir / volume / "index.qmd"
        if idx.is_file():
            return idx
        return about_idx


def write_volume_index(book_dir: Path, volume: str, format_type: str) -> Path:
    """Refresh the root ``index.qmd`` copy without writing through an existing symlink.

    Finds the canonical index source via ``volume_index_source``, ensures any
    stale symlink at ``book_dir / "index.qmd"`` is removed, and copies the source
    file to ``book_dir / "index.qmd"``.

    Args:
        book_dir: Path to the books root directory.
        volume: Volume identifier (e.g., "vol1", "vol4", "tinytorch").
        format_type: Build format ("html", "pdf", or "epub").

    Returns:
        Path to the source file that was copied into ``index.qmd``.

    Raises:
        FileNotFoundError: If the resolved source file does not exist on disk.
    """
    source = volume_index_source(book_dir, volume, format_type)
    if not source.is_file():
        raise FileNotFoundError(f"Volume entry point not found: {source}")
    active = Path(book_dir) / "index.qmd"
    if active.is_symlink():
        active.unlink()
    shutil.copyfile(source, active)
    return source


def main() -> None:
    """CLI entry point for standalone index synchronization."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--book-dir", type=Path, default=Path.cwd())
    parser.add_argument("--volume", required=True, help="Volume name (e.g. vol1, vol2, vol4, etc.)")
    parser.add_argument("--format", dest="format_type", type=str.lower,
                        required=True, choices=("html", "pdf", "epub"))
    args = parser.parse_args()
    source = write_volume_index(args.book_dir, args.volume, args.format_type)
    print(f"Copied {source.relative_to(args.book_dir).as_posix()} -> index.qmd")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `binder/cli/core/workspace.py`
```
"""Disposable git worktrees that keep concurrent binder builds apart.

A build writes at the Quarto project root (``_quarto.yml``, ``index.qmd``,
LaTeX intermediates, the ``.quarto`` cache), so two builds in one checkout
collide. A workspace is a detached ``git worktree`` of a snapshot of the
invoking checkout, created under the system temporary directory and removed
when the run ends. The snapshot carries staged and unstaged edits, and
untracked, non-ignored files are copied in, so a workspace builds what is on
disk rather than only what is committed.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

#: Parent directory of every workspace binder creates. Workspaces are deleted
#: recursively, so :func:`create_workspace` and :func:`remove_workspace`
#: refuse paths outside it.
WORKSPACE_ROOT = Path(tempfile.gettempdir()) / "binder-workspaces"

#: Empty hooks directory, shared by a run's workspaces, that ``git worktree add``
#: is pointed at so repository hooks do not run in a throwaway checkout.
_NO_HOOKS = ".no-hooks"


def workspace_path(run_id: str, name: str) -> Path:
    """Return the directory for workspace *name* of run *run_id* under :data:`WORKSPACE_ROOT`."""
    return WORKSPACE_ROOT / run_id / name


def _git(repo_root: Path, *args: str, check: bool = True) -> str:
    """Run ``git -C repo_root <args>`` and return its standard output.

    Raises:
        RuntimeError: If *check* is set and git exits non-zero.
    """
    result = subprocess.run(["git", "-C", str(repo_root), *args], capture_output=True, text=True)
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"git {' '.join(args)} failed: {detail}")
    return result.stdout


@dataclass(frozen=True)
class Snapshot:
    """Content that every workspace of one run is created from.

    Attributes:
        repo_root: Checkout the snapshot was taken from.
        commit: Commit holding the tracked content, uncommitted edits included.
        untracked: Repository-relative paths of untracked, non-ignored files.
    """

    repo_root: Path
    commit: str
    untracked: Tuple[str, ...] = ()


def take_snapshot(repo_root: Path) -> Snapshot:
    """Capture *repo_root*'s working tree for workspace creation.

    ``git stash create`` records staged and unstaged edits as an unreferenced
    commit without touching the shared stash list; a clean tree falls back to
    ``HEAD``. Untracked files are listed, not committed, and copied into each
    workspace by :func:`create_workspace`.
    """
    repo_root = Path(repo_root).resolve()
    commit = _git(repo_root, "stash", "create").strip() or _git(repo_root, "rev-parse", "HEAD").strip()
    listed = _git(repo_root, "ls-files", "--others", "--exclude-standard", "-z")
    return Snapshot(repo_root, commit, tuple(path for path in listed.split("\0") if path))


@dataclass
class Workspace:
    """A worktree created by :func:`create_workspace`."""

    path: Path
    snapshot: Snapshot


def create_workspace(snapshot: Snapshot, path: Path) -> Workspace:
    """Check out *snapshot* as a detached worktree at *path*.

    Repository hooks are disabled for the checkout; they set up developer
    tooling that a throwaway build tree does not need. Untracked files from the
    snapshot are copied in afterwards.

    Raises:
        ValueError: If *path* is not inside :data:`WORKSPACE_ROOT`.
        RuntimeError: If ``git worktree add`` fails.
    """
    path = _checked_path(path)
    no_hooks = path.parent / _NO_HOOKS
    no_hooks.mkdir(parents=True, exist_ok=True)
    try:
        _git(snapshot.repo_root, "-c", f"core.hooksPath={no_hooks}",
             "worktree", "add", "--detach", "--force", str(path), snapshot.commit)
    except RuntimeError:
        _remove_empty_run_dir(path.parent)
        raise
    for relative in snapshot.untracked:
        source = snapshot.repo_root / relative
        if source.is_file():
            target = path / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    return Workspace(path, snapshot)


def remove_workspace(workspace: Workspace) -> None:
    """Delete a workspace directory and its worktree registration.

    Anything left inside the workspace, including build output, is discarded;
    callers collect what they need first. The run directory holding the
    workspace goes too once its last workspace is removed.

    Raises:
        ValueError: If the workspace path is not inside :data:`WORKSPACE_ROOT`.
    """
    path = _checked_path(workspace.path)
    repo_root = workspace.snapshot.repo_root
    _git(repo_root, "worktree", "remove", "--force", str(path), check=False)
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    _git(repo_root, "worktree", "prune", check=False)
    _remove_empty_run_dir(path.parent)


def _remove_empty_run_dir(run_dir: Path) -> None:
    """Delete *run_dir* once it holds nothing but the shared hooks directory.

    Every workspace of a run shares the hooks directory, so it is removed with
    the last one. The workspace root itself stays, since other runs may be
    creating directories in it.
    """
    if run_dir == WORKSPACE_ROOT.resolve() or not run_dir.is_dir():
        return
    if any(entry.name != _NO_HOOKS for entry in run_dir.iterdir()):
        return
    for directory in (run_dir / _NO_HOOKS, run_dir):
        try:
            directory.rmdir()
        except OSError:
            pass


def _checked_path(path: Path) -> Path:
    """Return *path* resolved, refusing anything outside :data:`WORKSPACE_ROOT`.

    Workspaces are deleted recursively; confining them to one directory keeps
    a bad argument from ever pointing that deletion at a real checkout.
    """
    resolved = Path(path).resolve()
    root = WORKSPACE_ROOT.resolve()
    if root not in resolved.parents:
        raise ValueError(f"Workspace path must be inside {root}: {resolved}")
    return resolved

```

### Core Architecture Module: `binder/cli/utils/__init__.py`
```
"""
Utility functions and helpers for the MLSysBook CLI.

Contains shared utilities for console output, validation, and other
common functionality.
"""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2138** (2026-09-20): **build(deps): bump soupsieve from 2.8.4 to 2.9**
  *Symptoms*: Bumps [soupsieve](https://github.com/facelessuser/soupsieve) from 2.8.4 to 2.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/facelessuser/soupsieve/releases">soupsieve's releases</a>.</em></p> <blockquote> <h2>2.9</h2> <ul> <li><strong>NEW</strong>: Drop Python 3.9 support.</li> <li><strong>NEW</strong>: Lazy compile selector patterns to improve initial import speed.</li> <li><strong>FIX</strong>: Correct <code>:nth-child</code>/<code>:nth-of-type</code> (and <code>-last-</code> variants) for <code>An+B</code> values whose sequence steps onto index 0 or onto the last child (e.g. <code>:nth-child(2n-2)</code>, <code>:nth-child(n-1)</code>, <code>:nth-child(n+5)</code>), which previously matched the wrong elements or nothing at all (<a href="https://github.com/gaoflow"><code>@​gaoflow</code></a>).</li> <li><strong>FIX</strong>: More efficient CSS ID matching (<a href="https://github.com/kaimandalic"><code>@​kaimandalic</code></a>).</li> <li><strong>FIX</strong>: Fix inefficient trimming of comments and white space (<a href="https://github.com/kaimandalic"><code>@​kaimandalic</code></a>).</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/facelessuser/soupsieve/commit/8763f914472fc83652babda708bed5c8ef287004"><code>8763f91</code></a> Format changelog message</li> <li><a href="https://github.com/facelessuser/soupsieve/commit/cf198fcddc9230f06ed39f974eba0ce076b85cda"><code>cf19

- **Issue #2133** (2026-09-14): **build(deps): bump brace-expansion in /staffml/app**
  *Symptoms*: Bumps  and [brace-expansion](https://github.com/juliangruber/brace-expansion). These dependencies needed to be updated together. Updates `brace-expansion` from 1.1.15 to 1.1.18 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/juliangruber/brace-expansion/commit/758fcd6d188a95c2342818519c77b8c06794552b"><code>758fcd6</code></a> 1.1.18</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/27fbeed22b4fdf2c5f732f66bcf84d43f4a26c6e"><code>27fbeed</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/5c57cc2519dfb067e188b7cb0733fffbd02946bf"><code>5c57cc2</code></a> 1.1.17</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/d757f1dde7808bcbcd7a4628ab913e5185ed3d57"><code>d757f1d</code></a> npm ignore <code>.claude</code></li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/cb4b9e47cc2ec777c14b2b4492fb431a56f6a031"><code>cb4b9e4</code></a> fix: backport GHSA-mh99-v99m-4gvg (<a href="https://redirect.github.com/juliangruber/brace-expansion/issues/129">#129</a>)</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/447763a91a613cfa67ac73096cbc1de9a2304f97"><code>447763a</code></a> 1.1.16</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/d74e63030c012e3b7ae81657b8d665619cd51b95"><code>d74e630</code></a> fix: v1 backport for CVE-2026-13149 (<a href="https://redirect.github.com/juliangruber/brace-expansion/issu
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*

- **Issue #2127** (2026-09-14): **build(deps-dev): bump js-yaml from 4.3.1 to 4.3.2 in /staffml/app**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.1 to 4.3.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.2 - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>[backport] Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>[backport] Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a> 4.3.2 released</li> <li><a href="https://github.com/nodeca/js-yaml/commit/d90b6612a5a84385bdcb556c44578eac76dc0f6b"><code>d90b661</code></a> Backport merge limits from v5.4.1</li> <li>See full diff in <a href="https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2">compare view</a></li> </ul> </details> <br /> 
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > @dependabot rebase

- **Issue #2115** (2026-09-12): **chore(deps-dev): bump js-yaml from 4.3.1 to 4.3.2 in /interviews/staffml**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.1 to 4.3.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.2 - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>[backport] Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>[backport] Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a> 4.3.2 released</li> <li><a href="https://github.com/nodeca/js-yaml/commit/d90b6612a5a84385bdcb556c44578eac76dc0f6b"><code>d90b661</code></a> Backport merge limits from v5.4.1</li> <li>See full diff in <a href="https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=js-yaml&package-manager=npm_and_yarn&previous-version=4.3.1&new-version=4.3.2)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yours
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > Looks like js-yaml is no longer a dependency, so this is no longer needed.

- **Issue #2112** (2026-09-14): **chore(deps): bump js-yaml from 4.2.0 to 4.3.2**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.2.0 to 4.3.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.2 - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>[backport] Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>[backport] Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> <h2>4.3.1 - 2026-07-31</h2> <h3>Security</h3> <ul> <li>[backport] Remove quadratic complexity from <code>!!omap</code> duplicate key detection.</li> </ul> <h2>4.3.0 - 2026-06-27</h2> <h3>Added</h3> <ul> <li>[backport] Added <code>maxTotalMergeKeys</code> (10000) loader option to limit the total number of keys processed by YAML merge (<code>&lt;&lt;</code>) across one <code>load()</code> / <code>loadAll()</code> call.</li> </ul> <h3>Fixed</h3> <ul> <li>Restore umd builds back to es5.</li> </ul> <h3>Removed</h3> <ul> <li>[backport] <code>maxMergeSeqLength</code> replaced with <code>maxTotalMergeKeys</code> for limiting YAML merge processing.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a> 4.3.2 released</li> <li><a href="https://github.com/nodeca/js-yaml/comm

- **Issue #2108** (2026-09-12): **chore(deps): bump baseline-browser-mapping from 2.10.29 to 2.11.21 in /interviews/staffml**
  *Symptoms*: Bumps [baseline-browser-mapping](https://github.com/web-platform-dx/baseline-browser-mapping) from 2.10.29 to 2.11.21. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/web-platform-dx/baseline-browser-mapping/releases">baseline-browser-mapping's releases</a>.</em></p> <blockquote> <h2>v2.11.0</h2> <h2>What's Changed in 2.11.0</h2> <ul> <li>feat: Adds a new <code>getTimeline()</code> method for getting the series of minimum browser changes, either grouped by date or by browser.</li> <li>refactor: Substantial refactoring of the data compression process that replaces the full list of browsers from <code>@mdn/browser-compat-data</code> and <code>downstream-browsers.json</code> and features from <code>web-features</code> (in their very pared down form) with a change-list timeline that reflects which versions supported Baseline (newly available) on a given date.  Thanks to <a href="https://github.com/swwind"><code>@​swwind</code></a> for the idea!</li> <li>refactor: Some common functions have been moved to a <code>util.ts</code> module for use in other scripts.</li> <li>fix: Removes <code>process.exit()</code> calls when unsupported option combinations are passed to getCompatibleVersions() and <code>getAllVersions()</code> in favour of throwing an <code>Error</code>.  There is a small security risk with <code>process.exit()</code> calls that sites accepting unsanitised inputs could be the subject of attacks.  Unsupported config options now 
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > Looks like baseline-browser-mapping is no longer a dependency, so this is no longer needed.

- **Issue #2105** (2026-09-12): **chore(deps-dev): bump browserslist from 4.28.2 to 4.28.8 in /interviews/staffml**
  *Symptoms*: Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.28.2 to 4.28.8. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/browserslist/browserslist/releases">browserslist's releases</a>.</em></p> <blockquote> <h2>4.28.8</h2> <ul> <li>Fixed <code>including kaios</code> in baseline queries (by <a href="https://github.com/Jaybhade"><code>@​Jaybhade</code></a>).</li> </ul> <h2>4.28.7</h2> <ul> <li>Improved parsing performance.</li> <li>Fixed unbounded memory growth (by <a href="https://github.com/alanturing881"><code>@​alanturing881</code></a>).</li> <li>Fixed prototype write issue (by <a href="https://github.com/alanturing881"><code>@​alanturing881</code></a>).</li> </ul> <h2>4.28.6</h2> <ul> <li>Fixed Electron version queries (by <a href="https://github.com/spokodev"><code>@​spokodev</code></a>).</li> </ul> <h2>4.28.5</h2> <ul> <li>Fixed <code>&gt;</code> and <code>&gt;=</code> queries (by <a href="https://github.com/spokodev"><code>@​spokodev</code></a>).</li> </ul> <h2>4.28.4</h2> <ul> <li>Fixed <code>SyntaxError</code> regression of 4.28.3.</li> </ul> <h2>4.28.3</h2> <ul> <li>Fixed baseline query case-insensitivity (by <a href="https://github.com/swwind"><code>@​swwind</code></a>).</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/browserslist/browserslist/blob/main/CHANGELOG.md">browserslist's changelog</a>.</em></p> <blockquote> <h2>4.28.8</h2
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > Looks like browserslist is no longer a dependency, so this is no longer needed.

- **Issue #2091** (2026-08-31): **Fix dead-code and numerical-instability bugs across autograd's tracked forward implementations**
  *Symptoms*: ## What  Combines 5 previously-separate PRs (#2048, #2051, #2081, #2040, #2060), all of which touch `tinytorch/src/06_autograd/06_autograd.py`'s `enable_autograd()` monkeypatch. Combining them avoids five separate PRs churning the same function.  ## The shared bug class  `enable_autograd()` replaces several `Tensor`/`Sigmoid`/loss-class methods with "tracked" versions that add gradient bookkeeping. Some of these tracked versions **reimplemented** the original operation's math from scratch instead of delegating to the module's own already-correct implementation. This meant:  - The original implementation (what a student actually reads and is graded on) became **dead code** the moment autograd loads, which is always, since `enable_autograd()` runs unconditionally on package import. - Any fix or improvement made to the original silently never shipped, since the live code path was the separate reimplementation. - One of these reimplementations (`tracked_sigmoid_forward`) had actually drifted: it used the naive `1/(1+exp(-x))` formula instead of the original's numerically-stable, sign-branching version, causing spurious overflow warnings (and eventually NaN) at large-magnitude inputs common right after gradients explode during training.  ## Changes (one per original commit)  1. **#2048** — `tracked_sigmoid_forward` used an unstable formula; fixed to delegate to the original numerically-stable `Sigmoid.forward`. 2. **#2051** (2 commits) — `__radd__`/`__rsub__`/`__rmul__`/`__rtruedi
  **Post-Mortem & Fix Analysis**:
  > Thanks @Shashank-Tripathi-07. Integrated into dev, and this one paid for itself.  It fixed a test that was already red on dev before your PR: test_deep_network_gradient_chain in tests/integration/test_training_flow.py. The tracked_* wrappers shadowing the modules' real forward passes is exactly what that test was catching, so delegating to the captured originals closed it. That suite went from 774 passed / 1 failed to 790 passed / 0 failed.  I also added the target-index validation to the CrossEntropyLoss APPROACH and HINTS, same reason as #2036. 

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

### Incident Patch 1: `c534841f` (2026-10-01)
**Commit Message**: fix(vol3): repair corrupted LaTeX escape sequences in RLVR chapter

**File**: `books/vol3/15_rlvr/15_rlvr.qmd` (modified, +6/-6)
```diff
@@ -441,16 +441,16 @@ Group relative policy optimization (GRPO) [@shao2024deepseekmath] removes the cr
 
 Classical Proximal Policy Optimization (PPO) maintains four separate neural network models in GPU memory during training:
 
-1. **Actor Network ($\pi_	heta$):** The policy model being optimized.
+1. **Actor Network ($\pi_\theta$):** The policy model being optimized.
 2. **Critic Network ($V_\phi$):** A value model estimating expected trajectory returns.
-3. **Reference Policy ($\pi_{	ext{ref}}$):** A frozen snapshot of the pretrained model enforcing KL-divergence constraints.
+3. **Reference Policy ($\pi_{\text{ref}}$):** A frozen snapshot of the pretrained model enforcing KL-divergence constraints.
 4. **Reward Model ($R_\psi$):** A neural network predicting proxy human preference scores.
 
 For large foundation models (such as 70B parameter models in FP16), storing weights, optimizer states, and activations for four concurrent models demands upwards of 560 GB of GPU VRAM per pipeline stage, severely constraining maximum context length and batch size.
 
-Group Relative Policy Optimization (GRPO) [@shao2024deepseekmath] breaks this memory wall by discarding the parameterized Critic network ($V_\phi$) entirely. Instead of training a separate value network, GRPO evaluates policy advantages by sampling a cohort of $G$ independent rollouts $\{y_1, y_2, \dots, y_G\}$ from the current policy $\pi_	heta$ for each task prompt $x$. The baseline is computed directly from the empirical mean and standard deviation of rewards within the cohort:
+Group Relative Policy Optimization (GRPO) [@shao2024deepseekmath] breaks this memory wall by discarding the parameterized Critic network ($V_\phi$) entirely. Instead of training a separate value network, GRPO evaluates policy advantages by sampling a cohort of $G$ independent rollouts $\{y_1, y_2, \dots, y_G\}$ from the current policy $\pi_\theta$ for each task prompt $x$. The baseline is computed directly from the empirical mean and standard deviation of rewards within the cohort:
 $$
-\hat{A}_i = rac{r_i - \mu_{	ext{group}}}{\sigma_{	ext{group}} + \epsilon}, \quad \mu_{	ext{group}} = rac{1}{G}\sum_{j=1}^G r_j, \quad \sigma_{	ext{group}} = \sqrt{rac{1}{G}\sum_{j=1}^G (r_j - \mu_{	ext{group}})^2}
+\hat{A}_i = \frac{r_i - \mu_{\text{group}}}{\sigma_{\text{group}} + \epsilon}, \quad \mu_{\text{group}} = \frac{1}{G}\sum_{j=1}^G r_j, \quad \sigma_{\text{group}} = \sqrt{\frac{1}{G}\sum_{j=1}^G (r_j - \mu_{\text{group}})^2}
 $$
 
 The architectural contrast between PPO and GRPO is diagrammed in @fig-vol3-ppo-vs-grpo.
@@ -948,9 +948,9 @@ The synchronization trade-offs between synchronous step-locked loops and asynchr
 
 ### Cohort straggler latency disparity
 
-In group-relative algorithms such as GRPO, gradient updates for a prompt require all $G$ rollouts in the cohort to complete before cohort mean $\mu_{	ext{group}}$ and standard deviation $\sigma_{	ext{group}}$ can be computed. In multi-turn coding environments where trajectory execution times vary by orders of magnitude (from simple 1-turn syntactic checks to 30-turn test suites), cohort execution time is governed by extreme stragglers:
+In group-relative algorithms such as GRPO, gradient updates for a prompt require all $G$ rollouts in the cohort to complete before cohort mean $\mu_{\text{group}}$ and standard deviation $\sigma_{\text{group}}$ can be computed. In multi-turn coding environments where trajectory execution times vary by orders of magnitude (from simple 1-turn syntactic checks to 30-turn test suites), cohort execution time is governed by extreme stragglers:
 $$
-T_{	ext{cohort}} = \max_{j \in \{1, \dots, G\}} T_j
+T_{\text{cohort}} = \max_{j \in \{1, \dots, G\}} T_j
 $$
 The empirical latency disparity across cohort sizes is detailed in @tbl-vol3-cohort-latency-disparity.
 
```

---

### Incident Patch 2: `221f8e28` (2026-10-01)
**Commit Message**: fix(vol3): replace double quotes with single quotes in math display blocks

LuaLaTeX with fontspec/unicode-math parses double quotes inside \text{}
and \texttt{} as the umlaut accent command ", causing compilation failure
(Argument of \TU" has an extra }). Replaces double quotes with single
quotes in 06_long_term_memory, 07_tool_calling, 08_sandboxes, and
11_failure_recovery.

**File**: `books/vol3/06_long_term_memory/06_long_term_memory.qmd` (modified, +1/-1)
```diff
@@ -503,7 +503,7 @@ The parameter $b \in [0, 1]$ controls the severity of *document length normaliza
 ::: {#exmp-06-quantitative-bm25-score-dynamics-on .callout-example title="Quantitative BM25 score dynamics on heterogeneous code files"}
 Consider a repository containing $N = 100{,}000$ source files with an average document length $\text{avgdl} = 400$ tokens. An agent searches for the error handling routine associated with an explicit identifier:
 
-$$\mathcal{Q} = \{\text{"ERR\_CIPHER\_ALLOC\_FAIL"}\}$$
+$$\mathcal{Q} = \{\text{'ERR\_CIPHER\_ALLOC\_FAIL'}\}$$
 
 This identifier is rare, appearing in only $n(q_1) = 5$ files across the entire corpus. Its inverse document frequency is computed as:
 
```

**File**: `books/vol3/07_tool_calling/07_tool_calling.qmd` (modified, +1/-1)
```diff
@@ -1305,7 +1305,7 @@ Certain command-line utilities halt execution to solicit interactive input over
 
 An asynchronous runtime resolves this impasse by monitoring child process state transitions via `/proc/[pid]/stat` or pseudo-terminal ($\text{pty}$) master descriptors. When a process enters an interruptible sleep state awaiting terminal input, the runtime flags $\sigma_{\text{state}} \leftarrow \texttt{SUSPENDED}$ and raises an input-requested event to the supervisor. The model responds by issuing a dedicated mediation tool call:
 
-$$\text{send\_input}(\text{job\_id}, \text{data}=\text{"yes}\backslash\text{n"})$$
+$$\text{send\_input}(\text{job\_id}, \text{data}=\text{'yes}\backslash\text{n'})$$
 
 The runtime validates that $\text{job\_id}$ is in an active input-receptive state, verifies that `data` conforms to character whitelists (stripping raw control characters such as `\x03` or terminal escape sequences), writes the byte payload directly into the process's standard input pipe, and flushes the buffer.
 
```

**File**: `books/vol3/08_sandboxes/08_sandboxes.qmd` (modified, +5/-5)
```diff
@@ -233,9 +233,9 @@ $$\text{Verdict}(a, C, t) = \begin{cases} \text{APPROVE} & \text{if } \text{Veri
 @Fig-vol3-capability-attenuation shows the check on the left. A rejected proposal changes nothing, returns a structured observation that the model can act on, as the error-shaping discipline of @sec-vol3-tool-calling-schemas requires, and leaves an entry in the trajectory log. The check itself is cheap. Verifying a message authentication code takes microseconds, while the model call that produced the proposal takes seconds, so mediating every access adds nothing a user could measure.
 
 Under classical access control, the operating system evaluates ambient credentials:
-$$\text{Process } (\text{euid}=1000) \xrightarrow{\texttt{open(\"/etc/shadow\")}} [\text{Kernel ACL Check}: \text{euid} \stackrel{?}{=} 0] \implies \textbf{DENIED}$$
+$$\text{Process } (\text{euid}=1000) \xrightarrow{\texttt{open('/etc/shadow')}} [\text{Kernel ACL Check}: \text{euid} \stackrel{?}{=} 0] \implies \textbf{DENIED}$$
 In an unmediated agentic runtime, however, the supervisor becomes a confused deputy:
-$$\text{Untrusted Injected Context} \xrightarrow{\text{\"Read API Key\"}} [\text{Supervisor } (\text{euid}=1000)] \xrightarrow{\texttt{open(\"~/.aws/credentials\")}} \textbf{ALLOWED}$$
+$$\text{Untrusted Injected Context} \xrightarrow{\text{'Read API Key'}} [\text{Supervisor } (\text{euid}=1000)] \xrightarrow{\texttt{open('~/.aws/credentials')}} \textbf{ALLOWED}$$
 
 ### Formal capability verification and monotonic attenuation
 
@@ -272,9 +272,9 @@ $$C_j \sqsubseteq C_i \iff (R_j \subseteq R_i) \land (O_j \subseteq O_i) \land (
 The rights and objects can only shrink, the predicate can only add constraints, and the expiry can only move earlier. Consider a trajectory that holds read and write access to its repository for five minutes:
 
 $$\begin{aligned}
-C_{\text{edit}} &= \big(R=\{\text{read}, \text{write}\},\ O=\text{"/workspace/repo"},\ E=T_0 + 300\text{ s}\big) \\
-C_{\text{test}} &= \big(R=\{\text{read}, \text{execute}\},\ O=\text{"/workspace/repo"},\ E=T_0 + 120\text{ s}\big) && [\text{rejected: execute} \notin R_{\text{edit}}] \\
-C_{\text{scan}} &= \big(R=\{\text{read}\},\ O=\text{"/workspace/repo/src"},\ E=T_0 + 120\text{ s}\big) && [\text{valid: } C_{\text{scan}} \sqsubseteq C_{\text{edit}}]
+C_{\text{edit}} &= \big(R=\{\text{read}, \text{write}\},\ O=\text{'/workspace/repo'},\ E=T_0 + 300\text{ s}\big) \\
+C_{\text{test}} &= \big(R=\{\text{read}, \text{execute}\},\ O=\text{'/workspace/repo'},\ E=T_0 + 120\text{ s}\big) && [\text{rejected: execute} \notin R_{\text{edit}}] \\
+C_{\text{scan}} &= \big(R=\{\text{read}\},\ O=\text{'/workspace/repo/src'},\ E=T_0 + 120\text{ s}\big) && [\text{valid: } C_{\text{scan}} \sqsubseteq C_{\text{edit}}]
 \end{aligned}$$
 
 The second line is rejected even though it looks narrower, because it asks for a right the parent never held. A runtime that wants the test phase must include execute in the grant it issues at the start and then drop write when testing begins. Dropping write during tests matters for evaluation as well as safety. It keeps the trajectory from editing the tests it is being judged by, one of the conditions for the sealed-test evidence level of @sec-vol3-intro-closure-evidence. The same relation governs authority passed between agents, as the subagent tree on the right of @fig-vol3-capability-attenuation shows, and @sec-vol3-multiagent-authority develops that case.
```

**File**: `books/vol3/11_failure_recovery/11_failure_recovery.qmd` (modified, +1/-1)
```diff
@@ -1010,7 +1010,7 @@ Bulkhead isolation is enforced through three concrete mechanisms:
 2. **Domain-Specific Timeout Budgets:** Local tools run under tight, non-negotiable timeouts (e.g., $T_{\text{timeout}} \le 500\text{ ms}$). If a local tool deadlocks, it is killed swiftly. External network tools receive longer initial timeouts (e.g., $5000\text{ ms}$), but are backed by their own circuit breakers to ensure that persistent timeouts trigger the Open state and shed load.
 3. **Autonomous Execution Shedding:** When a specific bulkhead queue reaches capacity, the gateway rejects excess work without contacting the external network. The rejection generates an immediate observation back to the agent:
 
-$$o_t = \left\langle \texttt{ERR\_RESOURCE\_EXHAUSTED}, \, \text{"External tool queue saturated; defer execution"} \right\rangle$$
+$$o_t = \left\langle \texttt{ERR\_RESOURCE\_EXHAUSTED}, \, \text{'External tool queue saturated; defer execution'} \right\rangle$$
 
 This deterministic backpressure forces the agent to either yield execution, proceed with alternative reasoning branches, or wait out the congestion using client-side jittered sleep (@tbl-vol3-bulkhead-fault-isolation).
 
```

---

### Incident Patch 3: `35120a6b` (2026-10-01)
**Commit Message**: fix(vol3): close display math block in 05_kv_cache.qmd

Adds missing closing $$ to the expected tail-block fragmentation
equation on line 689, which previously caused LaTeX compilation failure
when rendering Volume III PDF. Also updates books/.gitignore to allow
checked-in LaTeX configuration in vol*/tex and shared/tex.

**File**: `books/.gitignore` (modified, +2/-0)
```diff
@@ -12,3 +12,5 @@
 
 # Allow checked-in LaTeX configuration files in tex/ directory.
 !tex/*.tex
+!vol*/tex/*.tex
+!shared/tex/*.tex
```

**File**: `books/vol3/05_kv_cache/05_kv_cache.qmd` (modified, +1/-1)
```diff
@@ -686,7 +686,7 @@ $$\Delta_{\text{tail}} = (B - (S \pmod B)) \pmod B$$
 
 Assuming that sequence completion lengths modulo $B$ are uniformly distributed across $\{0, 1, \dots, B-1\}$, the expected number of wasted token slots per active sequence is exactly:
 
-$$\mathbb{E}[\Delta_{\text{tail}}] = \frac{B - 1}{2}
+$$\mathbb{E}[\Delta_{\text{tail}}] = \frac{B - 1}{2}$$
 
 ```{python}
 #| echo: false
```

---

### Incident Patch 4: `459d2b88` (2026-10-01)
**Commit Message**: fix(mlsysim): regenerate paper values and add plotly to paper/Makefile UV_RUN

Updates paper values and system-anatomy diagram to match the expanded
hardware and model registries. Adds plotly to paper/Makefile UV_RUN so
pytest collection succeeds during generate_paper_values.

**File**: `books/vol3/tex/before-body-includes.tex` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+% before-body-includes.tex
+%
+% This file is loaded via Quarto's `include-before-body` for vol3 builds.
+% Currently this file is intentionally empty.
```

**File**: `books/vol4/tex/before-body-includes.tex` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+% before-body-includes.tex
+%
+% This file is loaded via Quarto's `include-before-body` for vol4 builds.
+% Currently this file is intentionally empty.
```

**File**: `mlsysim/paper/Makefile` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ MLSYSIM_ROOT = ..
 UV_RUN = uv run --no-project --python 3.11 \
 	--with "pint>=0.24.4" --with "pydantic>=2.10.5" --with "numpy>=2.0" \
 	--with typer --with rich --with pyyaml --with matplotlib \
-	--with pytest --with marimo --with scipy --with ortools
+	--with pytest --with marimo --with scipy --with ortools --with plotly
 GENERATOR = paper/scripts/generate_paper_values.py
 
 values:
```

**File**: `mlsysim/paper/figures/system-anatomy.svg` (modified, +3/-3)
```diff
@@ -22,11 +22,11 @@
   <!-- ================================================================ -->
 
   <!-- ===== Registries ===== -->
-  <text x="12" y="40" font-size="8" font-weight="700" fill="#888" letter-spacing="1.2" data-template="MLSys ZOO ({CountRegistriesCurated} REGISTRIES, 6 SHOWN)">MLSys ZOO (13 REGISTRIES, 6 SHOWN)</text>
+  <text x="12" y="40" font-size="8" font-weight="700" fill="#888" letter-spacing="1.2" data-template="MLSys ZOO ({CountRegistriesCurated} REGISTRIES, 6 SHOWN)">MLSys ZOO (18 REGISTRIES, 6 SHOWN)</text>
 
   <rect x="12" y="50" width="143" height="38" fill="#f5f3ff" stroke="#7c3aed" stroke-width="0.8"/>
   <text x="83" y="66" text-anchor="middle" font-size="8.5" font-weight="700" fill="#222">Hardware</text>
-  <text x="83" y="78" text-anchor="middle" font-size="7" fill="#666" data-template="{CountHardwareDevices} devices + Tech classes">44 devices + Tech classes</text>
+  <text x="83" y="78" text-anchor="middle" font-size="7" fill="#666" data-template="{CountHardwareDevices} devices + Tech classes">45 devices + Tech classes</text>
 
   <rect x="163" y="50" width="143" height="38" fill="#fff7ed" stroke="#d97706" stroke-width="0.8"/>
   <text x="234" y="66" text-anchor="middle" font-size="8.5" font-weight="700" fill="#222">Models</text>
@@ -83,7 +83,7 @@
   <rect x="12" y="260" width="95" height="26" fill="#fafafa" stroke="#999" stroke-width="0.7"/>
   <text x="59.5" y="277" text-anchor="middle" font-size="7.5" font-weight="600" fill="#444">units.py</text>
   <rect x="115" y="260" width="130" height="26" fill="#fafafa" stroke="#999" stroke-width="0.7"/>
-  <text x="180" y="277" text-anchor="middle" font-size="7.5" font-weight="600" fill="#444" data-template="provenance catalog ({CountProvenanceRecords})">provenance catalog (164)</text>
+  <text x="180" y="277" text-anchor="middle" font-size="7.5" font-weight="600" fill="#444" data-template="provenance catalog ({CountProvenanceRecords})">provenance catalog (175)</text>
   <rect x="253" y="260" width="55" height="26" fill="#fafafa" stroke="#999" stroke-width="0.7"/>
   <text x="280.5" y="277" text-anchor="middle" font-size="7.5" font-weight="600" fill="#444">fmt.py</text>
 
```

**File**: `mlsysim/paper/generated/hw_catalog.tex` (modified, +1/-0)
```diff
@@ -55,4 +55,5 @@
  & Oura Ring 4 (wearable reference profile) & 0.0001 & 0.00195 & 0.00008 & 0.02 & --- \\
  & Himax WE-I Plus & 0.0002 & 0.00195 & 0.0001 & 0.005 & --- \\
  & ESP32-S3 (AI) & 0.0005 & 0.00391 & 0.00008 & 0.4 & --- \\
+ & Lockstep safety MCU (reference class) & 0.0008 & 0.00391 & 0.0016 & 1 & --- \\
 }
```

**File**: `mlsysim/paper/generated/values.json` (modified, +40/-35)
```diff
@@ -387,9 +387,9 @@
     },
     "CountHardwareDevices": {
       "section": "Counts computed from code",
-      "raw": 44.0,
-      "printed": "44",
-      "tex": "44",
+      "raw": 45.0,
+      "printed": "45",
+      "tex": "45",
       "source": "len(Hardware.list()) (Tech classes excluded)",
       "volatile": false
     },
@@ -427,9 +427,9 @@
     },
     "CountHardwareTiny": {
       "section": "Counts computed from code",
-      "raw": 4.0,
-      "printed": "4",
-      "tex": "4",
+      "raw": 5.0,
+      "printed": "5",
+      "tex": "5",
       "source": "len(Hardware.Tiny.list())",
       "volatile": false
     },
@@ -451,25 +451,25 @@
     },
     "CountProvenanceRecords": {
       "section": "Counts computed from code",
-      "raw": 164.0,
-      "printed": "164",
-      "tex": "164",
+      "raw": 175.0,
+      "printed": "175",
+      "tex": "175",
       "source": "distinct Provenance ids defined in mlsysim.core.provenance_catalog",
       "volatile": false
     },
     "CountRegistriesTotal": {
       "section": "Counts computed from code",
-      "raw": 15.0,
-      "printed": "15",
-      "tex": "15",
+      "raw": 20.0,
+      "printed": "20",
+      "tex": "20",
       "source": "top-level Registry subclasses on mlsysim, plus Scenarios",
       "volatile": false
     },
     "CountRegistriesCurated": {
       "section": "Counts computed from code",
-      "raw": 13.0,
-      "printed": "13",
-      "tex": "13",
+      "raw": 18.0,
+      "printed": "18",
+      "tex": "18",
       "source": "CountRegistriesTotal minus auxiliary Literature and ReferenceStats",
       "volatile": false
     },
@@ -483,9 +483,9 @@
     },
     "ListRegistriesCurated": {
       "section": "Counts computed from code",
-      "raw": "Actuators, AgentPlatforms, Agents, Datasets, Embodied, Hardware, Infrastructure, Models, Ops, Platforms, Sensors, Systems, Scenarios",
-      "printed": "Actuators, AgentPlatforms, Agents, Datasets, Embodied, Hardware, Infrastructure, Models, Ops, Platforms, Sensors, Systems, Scenarios",
-      "tex": "Actuators{,} AgentPlatforms{,} Agents{,} Datasets{,} Embodied{,} Hardware{,} Infrastructure{,} Models{,} Ops{,} Platforms{,} Sensors{,} Systems{,} Scenarios",
+      "raw": "Actuators, AgentPlatforms, Agents, CodingAgents, Datasets, DeliberationAgents, Embodied, Hardware, Infrastructure, InteractiveAgents, Models, MultiAgents, Ops, PhysicalAINumbers, Platforms, Sensors, Systems, Scenarios",
+      "printed": "Actuators, AgentPlatforms, Agents, CodingAgents, Datasets, DeliberationAgents, Embodied, Hardware, Infrastructure, InteractiveAgents, Models, MultiAgents, Ops, PhysicalAINumbers, Platforms, Sensors, Systems, Scenarios",
+      "tex": "Actuators{,} AgentPlatforms{,} Agents{,} CodingAgents{,} Datasets{,} DeliberationAgents{,} Embodied{,} Hardware{,} Infrastructure{,} InteractiveAgents{,} Models{,} MultiAgents{,} Ops{,} PhysicalAINumbers{,} Platforms{,} Sensors{,} Systems{,} Scenarios",
       "source": "curated registry names",
       "volatile": false
     },
@@ -523,9 +523,9 @@
     },
     "CountTests": {
       "section": "Counts computed from code",
-      "raw": 2182.0,
-      "printed": "2,182",
-      "tex": "2{,}182",
+      "raw": 2261.0,
+      "printed": "2,261",
+      "tex": "2{,}261",
       "source": "python -m pytest --collect-only -q over tests/ with marimo, scipy, ortools installed",
       "volatile": true
     },
@@ -1875,9 +1875,9 @@
     },
     "CaseIOneSweepMs": {
       "section": "Case I1: Roofline batch sweep (ResNet-50 on H100)",
-      "raw": 1.8845000013243407,
-      "printed": "1.88",
-      "tex": "1.88",
+      "raw": 2.412165980786085,
+      "printed": "2.41",
+      "tex": "2.41",
       "source": "median of 5 warm runs of the 5-point sweep (ms)",
       "volatile": true
     },
@@ -2659,7 +2659,7 @@
     },
     "CaseRThreeChainSeconds": {
       "section": "Case R3, Wall 14, fallacy, and architecture-stack figure: Llama-3 70B on Training_512_H100",
-      "raw": 0.001001583004835993,
+      "raw": 0.0012483340105973184,
       "printed": "0.001",
       "tex": "0.001",
       "source": "median of 5 warm runs of Distributed+Reliability+Economics+Sustainability (s)",
@@ -2899,7 +2899,7 @@
     },
     "OverviewDSolveSeconds": {
       "section": "Overview figure panel (d): Llama-3 70B",
-      "raw": 0.002657583012478426,
+      "raw": 0.0033450420014560223,
       "printed": "0.003",
       "tex": "0.003",
       "source": "wall time of the six panel-(d) solves (s)",
@@ -3547,17 +3547,17 @@
     },
     "SweepTimingMedianMs": {
       "section": "Sweep timing and machine (volatile: describes the machine that ran this)",
-      "raw": 382.92554099461995,
-      "printed": "383",
-      "tex": "383",
+      "raw": 517.0367079554126,
+      "printed": "517",
+      "tex": "517",
       "source": "median of 5 warm runs of the 1,000-config SingleNodeModel sweep (ms)",
       "volatile": true
     },
     "SweepTimingPerConfigUs": {
       "s
```

**File**: `mlsysim/paper/generated/values.tex` (modified, +11/-11)
```diff
@@ -53,24 +53,24 @@
 \newcommand{\CountResolverSolvers}{2}% source: subclasses of BaseSolver in mlsysim.engine.solvers.__all__
 \newcommand{\CountResolverOptimizers}{3}% source: subclasses of BaseOptimizer in mlsysim.engine.solvers.__all__
 \newcommand{\CountWallResolvers}{21}% source: distinct Wall.resolver_name over ALL_WALLS
-\newcommand{\CountHardwareDevices}{44}% source: len(Hardware.list()) (Tech classes excluded)
+\newcommand{\CountHardwareDevices}{45}% source: len(Hardware.list()) (Tech classes excluded)
 \newcommand{\CountHardwareCloud}{26}% source: len(Hardware.Cloud.list())
 \newcommand{\CountHardwareWorkstation}{2}% source: len(Hardware.Workstation.list())
 \newcommand{\CountHardwareEdge}{8}% source: len(Hardware.Edge.list())
 \newcommand{\CountHardwareMobile}{4}% source: len(Hardware.Mobile.list())
-\newcommand{\CountHardwareTiny}{4}% source: len(Hardware.Tiny.list())
+\newcommand{\CountHardwareTiny}{5}% source: len(Hardware.Tiny.list())
 \newcommand{\CountModels}{33}% source: len(Models.list())
 \newcommand{\CountModelFamilies}{7}% source: Registry subclasses on Models
-\newcommand{\CountProvenanceRecords}{164}% source: distinct Provenance ids defined in mlsysim.core.provenance_catalog
-\newcommand{\CountRegistriesTotal}{15}% source: top-level Registry subclasses on mlsysim, plus Scenarios
-\newcommand{\CountRegistriesCurated}{13}% source: CountRegistriesTotal minus auxiliary Literature and ReferenceStats
+\newcommand{\CountProvenanceRecords}{175}% source: distinct Provenance ids defined in mlsysim.core.provenance_catalog
+\newcommand{\CountRegistriesTotal}{20}% source: top-level Registry subclasses on mlsysim, plus Scenarios
+\newcommand{\CountRegistriesCurated}{18}% source: CountRegistriesTotal minus auxiliary Literature and ReferenceStats
 \newcommand{\CountRegistriesAuxiliary}{2}% source: Literature and ReferenceStats
-\newcommand{\ListRegistriesCurated}{Actuators{,} AgentPlatforms{,} Agents{,} Datasets{,} Embodied{,} Hardware{,} Infrastructure{,} Models{,} Ops{,} Platforms{,} Sensors{,} Systems{,} Scenarios}% source: curated registry names
+\newcommand{\ListRegistriesCurated}{Actuators{,} AgentPlatforms{,} Agents{,} CodingAgents{,} Datasets{,} DeliberationAgents{,} Embodied{,} Hardware{,} Infrastructure{,} InteractiveAgents{,} Models{,} MultiAgents{,} Ops{,} PhysicalAINumbers{,} Platforms{,} Sensors{,} Systems{,} Scenarios}% source: curated registry names
 \newcommand{\CountPhysicsModules}{13}% source: public modules in mlsysim.physics
 \newcommand{\CountPhysicsDomainModules}{11}% source: public mlsysim.physics modules minus constants and quantities
 \newcommand{\CountPhysicsSupportingModules}{2}% source: mlsysim.physics.constants and quantities
 \newcommand{\ListPhysicsDomainModules}{agents{,} communication{,} economics{,} memory{,} networking{,} performance{,} reliability{,} robotics{,} serving{,} statistics{,} transformer}% source: domain physics module names
-\newcommand{\CountTests}{2{,}182}% source: python -m pytest --collect-only -q over tests/ with marimo, scipy, ortools installed
+\newcommand{\CountTests}{2{,}261}% source: python -m pytest --collect-only -q over tests/ with marimo, scipy, ortools installed
 
 % ===== Validation anchors (configurations in paper_scenarios.py) =====
 \newcommand{\AnchorOneEta}{0.19}% source: paper_scenarios.A1_CONFIG
@@ -245,7 +245,7 @@
 \newcommand{\CaseIOneEffectiveRidge}{148}% source: efficiency x H100 FP16 peak / memory.bandwidth
 \newcommand{\CaseIOneCrossoverLowBatch}{1}% source: largest memory-bound batch in the sweep
 \newcommand{\CaseIOneCrossoverHighBatch}{8}% source: smallest compute-bound batch in the sweep
-\newcommand{\CaseIOneSweepMs}{1.88}% source: median of 5 warm runs of the 5-point sweep (ms)
+\newcommand{\CaseIOneSweepMs}{2.41}% source: median of 5 warm runs of the 5-point sweep (ms)
 \newcommand{\CaseIOneContrastAiMax}{9.6}% source: max arithmetic_intensity of SingleNodeModel(Llama2_7B, H100, eta=0.5) over batches 1..256
 \newcommand{\CaseIOneContrastBottleneck}{Memory}% source: bottleneck of every Llama2_7B point in the contrast sweep
 
@@ -476,9 +476,9 @@
 
 % ===== Sweep timing and machine (volatile: describes the machine that ran this) =====
 \newcommand{\SweepTimingConfigs}{1{,}000}% source: 10 Cloud accelerators x 10 models x 10 batch sizes, SingleNodeModel().solve
-\newcommand{\SweepTimingMedianMs}{383}% source: median of 5 warm runs of the 1,000-config SingleNodeModel sweep (ms)
-\newcommand{\SweepTimingPerConfigUs}{383}% source: SweepTimingMedianMs / 1,000 configs (microseconds)
+\newcommand{\SweepTimingMedianMs}{517}% source: median of 5 warm runs of the 1,000-config SingleNodeModel sweep (ms)
+\newcommand{\SweepTimingPerConfigUs}{517}% source: SweepTimingMedianMs / 1,000 configs (microseconds)
 \newcommand{\MachineCpu}{Apple M5 Max}% source: sysctl machdep.cpu.brand_string or /proc/cpuinfo
 \newcommand{\MachineCores}{18}% source: os.cpu_count()
 \newcommand{\MachineOs}{macOS 26.4}% source: platform
-\newcommand{\Machi
```

---

### Incident Patch 5: `913c9dfa` (2026-09-28)
**Commit Message**: Fix chapter sequence: Ch 13 moves from Lab 5 to Lab 6

Chapters now flow strictly 1-2 | 3-4 | 5-6 | 7-8-9 | 10-11 | 12-13-14-15-16 | 17
with zero skips or reordering.

**File**: `labs/vol4/README.md` (modified, +2/-2)
```diff
@@ -73,8 +73,8 @@ Six labs follow the textbook's four parts in order, building from pen-and-paper
 | 2 | **[From Simulation to Real Hardware](labs/lab-02-teleoperation-and-datasets.md)** | 3–4 | Part I — Ch 3 *Cognitive Brain*, Ch 4 *Nervous System* | Discover what simulation gets wrong. Wire the physical bench, port your IK to the microcontroller, control the real robot via CLI, and measure the gap between sim and reality. |
 | 3 | **[Learned Control with Vision-Language-Action Models](labs/lab-03-baseline-and-training.md)** | 5–6 | Part II — Ch 5 *Physical Data*, Ch 6 *Policy Training* | Replace hand-coded equations with a neural policy that learns from data. Run a pre-trained VLA in simulation, then deploy it to the real robot and measure the sim2real performance drop. |
 | 4 | **[Real-World Data Collection & Fine-Tuning](labs/lab-04-autonomous-reach.md)** | 7–8 | Part II–III — Ch 7 *Evaluation*, Ch 8 *Perception*, Ch 9 *Spatial Memory* | Bridge the sim2real gap with real data. Teleoperate the robot to collect demonstrations, fine-tune the sim-trained model, and deploy it untethered for fully autonomous operation. |
-| 5 | **[Stress-Testing: Prediction, Language & Recovery](labs/lab-05-horizons-and-disturbances.md)** | 9 | Part III — Ch 10 *Grounded Intent*, Ch 11 *Trajectory Planning*, Ch 13 *Silicon Placement* | Push the system until it breaks. Test how far ahead the model can predict, whether language changes its behavior, and what happens when you move the target mid-reach. |
-| 6 | **[Safety Governor — Build It, Then Break It](labs/lab-06-safety-governor.md)** | 10–11 | Part III–IV — Ch 12 *Safety Enforcement*, Ch 14 *Intervention*, Ch 15 *Verification*, Ch 16 *Release* | Prove the robot is trustworthy. Program safety barriers on the microcontroller, then try to defeat them by freezing the brain, corrupting packets, and cutting power. |
+| 5 | **[Stress-Testing: Prediction, Language & Recovery](labs/lab-05-horizons-and-disturbances.md)** | 9 | Part III — Ch 10 *Grounded Intent*, Ch 11 *Trajectory Planning* | Push the system until it breaks. Test how far ahead the model can predict, whether language changes its behavior, and what happens when you move the target mid-reach. |
+| 6 | **[Safety Governor — Build It, Then Break It](labs/lab-06-safety-governor.md)** | 10–11 | Part III–IV — Ch 12 *Safety Enforcement*, Ch 13 *Silicon Placement*, Ch 14 *Intervention*, Ch 15 *Verification*, Ch 16 *Release* | Prove the robot is trustworthy. Program safety barriers on the microcontroller, then try to defeat them by freezing the brain, corrupting packets, and cutting power. |
 | | **[Capstone: Physical Release Defense](labs/lab-capstone-studio.md)** | 12–14 | Synthesis — Ch 17 *Epistemic Frontier* | Put it all together. Design your own task, survive a peer team's adversarial attacks, defend your Physical Release Dossier, and generalize the pipeline to a new robot. |
 
 ---
```

**File**: `labs/vol4/labs/lab-05-horizons-and-disturbances.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # Lab 5: Stress-Testing — Prediction, Language & Recovery
 
 **Schedule:** Week 9 · Milestone 3 due end of week
-**Required Textbook Reading:** [Chapter 10: Grounded Intent](../../../books/vol4/10_intent/10_intent.qmd), [Chapter 11: Trajectory Planning](../../../books/vol4/11_planning/11_planning.qmd), [Chapter 13: Silicon Placement](../../../books/vol4/13_placement/13_placement.qmd)
+**Required Textbook Reading:** [Chapter 10: Grounded Intent](../../../books/vol4/10_intent/10_intent.qmd), [Chapter 11: Trajectory Planning](../../../books/vol4/11_planning/11_planning.qmd)
 **Target Competencies:** `[ ] C2 Temporal Horizons & Action Dynamics`, `[ ] C3 Disturbance Recovery & Replanning`
 ---
 
```

**File**: `labs/vol4/labs/lab-06-safety-governor.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # Lab 6: Safety Governor — Build It, Then Break It
 
 **Schedule:** Weeks 10–11 · Milestone 4 due end of Week 11
-**Required Textbook Reading:** [Chapter 12: Safety Enforcement](../../../books/vol4/12_safety/12_safety.qmd), [Chapter 14: Supervisory Intervention](../../../books/vol4/14_supervisory/14_supervisory.qmd), [Chapter 15: Adversarial Verification](../../../books/vol4/15_adversarial/15_adversarial.qmd), [Chapter 16: Safe Release](../../../books/vol4/16_release/16_release.qmd)
+**Required Textbook Reading:** [Chapter 12: Safety Enforcement](../../../books/vol4/12_safety/12_safety.qmd), [Chapter 13: Silicon Placement](../../../books/vol4/13_placement/13_placement.qmd), [Chapter 14: Supervisory Intervention](../../../books/vol4/14_supervisory/14_supervisory.qmd), [Chapter 15: Adversarial Verification](../../../books/vol4/15_adversarial/15_adversarial.qmd), [Chapter 16: Safe Release](../../../books/vol4/16_release/16_release.qmd)
 **Target Competencies:** `[ ] D1 Hardware Authority Routing`, `[ ] D2 Deterministic Safety Enforcement`
 **Milestone Alignment:** Concludes [Milestone 4](../curriculum/syllabus.md#sec-milestones) (End of Week 11)
 
```

---

### Incident Patch 6: `4f3b0dfc` (2026-09-30)
**Commit Message**: docs(guide): demos page counts seven demos; re-record demo 02 with spaced test names

The page said five demos and claimed 44/44 unit tests, a count the video never
shows. Demo 02 predated the test-name fix and showed AutogradCore and
Module 06Completion.

**File**: `tinytorch/guide/demos.html` (modified, +2/-2)
```diff
@@ -108,7 +108,7 @@
 <body>
   <header>
     <h1>Tiny<span>🔥</span>Torch Showcase Tapes</h1>
-    <p class="subtitle">All 5 authentic terminal executions recorded with VHS at Retina resolution with Terminalizer window framing.</p>
+    <p class="subtitle">All 7 recorded from real terminal sessions running the current code. Long training stretches play at 5×, marked in the title bar.</p>
     <a href="/index.html#terminal-showcase" class="back-btn">← Back to Interactive Carousel on Landing Page</a>
   </header>
 
@@ -134,7 +134,7 @@ <h1>Tiny<span>🔥</span>Torch Showcase Tapes</h1>
         <div class="card-title">2. Module Mastery &amp; Historical Milestones Grid</div>
         <div class="card-tag">02_modules_mastery.tape</div>
       </div>
-      <div class="card-desc">Completing Module 06 (Autograd Engine) with 44/44 unit tests passing, followed by full 20/20 curriculum status and historical milestone progression.</div>
+      <div class="card-desc">Completing Module 06 (Autograd Engine) with its unit and integration tests passing, then the full 20/20 module status and all seven historical milestones.</div>
       <div class="card-img-wrapper">
         <video autoplay loop muted playsinline poster="assets/images/demos/tinytorch-02-modules-mastery.gif">
           <source src="assets/images/demos/tinytorch-02-modules-mastery.mp4" type="video/mp4">
```

---

### Incident Patch 7: `201f2532` (2026-09-30)
**Commit Message**: fix(tito): record the exported notebook path in POSIX form on every OS

Windows CI recorded modules\02_activations\activations.ipynb in
.tito/exports.json, so the record differed by platform.

**File**: `tinytorch/tito/commands/module/workflow.py` (modified, +3/-1)
```diff
@@ -127,7 +127,9 @@ def record_module_export(project_root: Path, module_name: str) -> None:
     records = load_export_records(project_root)
     records[number] = {
         "module": module_name,
-        "notebook": str(notebook.relative_to(project_root)),
+        # POSIX form, so the record reads the same on every OS (Windows CI
+        # caught backslashes, 2026-09-30).
+        "notebook": notebook.relative_to(project_root).as_posix(),
         "sha256": fingerprint,
         "exported_at": datetime.now().isoformat(),
     }
```

---

### Incident Patch 8: `d14f14ea` (2026-09-23)
**Commit Message**: docs(book): sync evaluate.qmd listing with axis=-1 Trainer.evaluate fix

**File**: `tinytorch/book/_listings/08_training/evaluate.qmd` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ def trainer_evaluate(self, dataloader: Iterable[Tuple[Tensor, Tensor]]) -> Tuple
 
         # The loss defines the task: multiple outputs can also be regression.
         if isinstance(self.loss_fn, CrossEntropyLoss):
-            predictions = np.argmax(outputs.data, axis=1)
+            predictions = np.argmax(outputs.data, axis=-1)
             correct += np.sum(predictions == targets.data)
             total += predictions.size
         elif isinstance(self.loss_fn, BinaryCrossEntropyLoss):
```

---

### Incident Patch 9: `57ee704a` (2026-09-23)
**Commit Message**: fix(tinytorch): handle sequence reduction, scalar compile tracing, and CLI imports

- Trainer.evaluate: reduce along axis=-1 for proper sequence/vocab class prediction
- TracedNode: add scalar handling for __add__, __radd__, __mul__, and __rmul__
- benchmark CLI: hoist BaseCommand and TinyTorchCLIError imports before lazy _get_rng
- Add comprehensive unit tests covering 3D evaluate, scalar tracing, RNG import errors, and LogSoftmax

**File**: `tinytorch/src/08_training/08_training.py` (modified, +2/-2)
```diff
@@ -1110,7 +1110,7 @@ def trainer_evaluate(self, dataloader: Iterable[Tuple[Tensor, Tensor]]) -> Tuple
     >>> print(f"Eval loss: {eval_loss:.4f}, Accuracy: {accuracy:.2%}")
 
     HINTS:
-    - For multi-class: predictions = np.argmax(outputs.data, axis=1)
+    - For multi-class: predictions = np.argmax(outputs.data, axis=-1)
     - CrossEntropyLoss expects integer targets; BCE compares each binary label
     - accuracy = correct / total if total > 0 else 0.0
     """
@@ -1135,7 +1135,7 @@ def trainer_evaluate(self, dataloader: Iterable[Tuple[Tensor, Tensor]]) -> Tuple
 
         # The loss defines the task: multiple outputs can also be regression.
         if isinstance(self.loss_fn, CrossEntropyLoss):
-            predictions = np.argmax(outputs.data, axis=1)
+            predictions = np.argmax(outputs.data, axis=-1)
             correct += np.sum(predictions == targets.data)
             total += predictions.size
         elif isinstance(self.loss_fn, BinaryCrossEntropyLoss):
```

**File**: `tinytorch/tests/04_losses/test_losses_core.py` (modified, +33/-1)
```diff
@@ -22,7 +22,7 @@
 sys.path.insert(0, str(Path(__file__).parent.parent.parent))
 
 from tinytorch.core.tensor import Tensor
-from tinytorch.core.losses import MSELoss, CrossEntropyLoss, BinaryCrossEntropyLoss
+from tinytorch.core.losses import MSELoss, CrossEntropyLoss, BinaryCrossEntropyLoss, LogSoftmax, log_softmax
 
 
 class TestMSELoss:
@@ -190,3 +190,35 @@ def test_loss_means_count_every_output_and_accept_soft_binary_targets():
     assert np.isclose(MSELoss()(pred, target).data, (0.04 + 0.01 + 0.09 + 0.01) / 4)
     expected = -(np.log(0.8) + 0.5 * np.log(0.6 * 0.4) + np.log(0.7) + np.log(0.9)) / 4
     assert np.isclose(BinaryCrossEntropyLoss()(pred, target).data, expected)
+
+
+class TestLogSoftmax:
+    """Test numerically stable log-softmax computation."""
+
+    def test_log_softmax_numerical_stability_large_values(self):
+        """
+        WHAT: Verify log-softmax does not overflow with large inputs (log-sum-exp trick).
+        WHY: Exponentiating numbers > 709 overflows float64. Log-sum-exp prevents this.
+        """
+        x = Tensor([[1000.0, 1001.0, 1002.0]])
+        out = log_softmax(x, dim=-1)
+
+        assert not np.isnan(out.data).any(), "log_softmax produced NaN on large inputs"
+        assert not np.isinf(out.data).any(), "log_softmax produced Inf on large inputs"
+
+        # Exponentiating log_softmax must give a valid probability distribution summing to 1.0
+        probs = np.exp(out.data)
+        assert np.isclose(probs.sum(axis=-1)[0], 1.0, atol=1e-5)
+
+    def test_log_softmax_properties(self):
+        """Verify basic log_softmax mathematical properties across 2D batch."""
+        x = Tensor([[1.0, 2.0, 3.0], [0.1, 0.2, 0.9]])
+        out = log_softmax(x, dim=-1)
+
+        # log(P) <= 0 since P <= 1
+        assert (out.data <= 0.0).all()
+
+        # exp(log(P)) sum across classes == 1
+        probs = np.exp(out.data)
+        assert np.allclose(probs.sum(axis=-1), [1.0, 1.0], atol=1e-5)
+
```

**File**: `tinytorch/tests/08_training/test_training_coverage.py` (modified, +38/-0)
```diff
@@ -678,6 +678,44 @@ def parameters(self):
         _, accuracy = trainer.evaluate(data)
         assert accuracy == 0.0, f"Wrong classifier should have accuracy=0.0, got {accuracy}"
 
+    def test_evaluate_3d_sequence_predictions(self):
+        """
+        WHAT: Trainer.evaluate computes correct accuracy for 3D sequence predictions (Batch, Seq, Vocab).
+
+        WHY: For autoregressive models (like GPT) and token classification, logits have shape
+        (Batch, Seq_Len, Vocab_Size). Argmax must reduce the last dimension (axis=-1) to find
+        the predicted class token. Using axis=1 incorrectly reduces across sequence length,
+        causing a broadcast shape mismatch error.
+        """
+        class SequenceModel:
+            training = True
+
+            def forward(self, x):
+                # x shape: (2, 3)
+                # Output logits shape: (2, 3, 4)
+                logits = np.zeros((2, 3, 4))
+                targets = np.array([[1, 2, 0], [3, 1, 2]])
+                for b in range(2):
+                    for s in range(3):
+                        logits[b, s, targets[b, s]] = 10.0
+                return Tensor(logits)
+
+            def parameters(self):
+                return []
+
+        loss_fn = CrossEntropyLoss()
+        opt = SGD([], lr=0.01)
+        trainer = Trainer(SequenceModel(), opt, loss_fn)
+
+        targets = np.array([[1, 2, 0], [3, 1, 2]])
+        inputs = np.zeros((2, 3))
+        data = [(Tensor(inputs), Tensor(targets))]
+
+        eval_loss, accuracy = trainer.evaluate(data)
+
+        assert accuracy == 1.0, f"Expected accuracy 1.0 for perfect sequence predictions, got {accuracy}"
+        assert eval_loss < 0.01, f"Expected small loss for confident predictions, got {eval_loss}"
+
 
 # ─────────────────────────────────────────────
 # Scheduler integration
```

**File**: `tinytorch/tests/cli/test_cli_execution.py` (modified, +31/-0)
```diff
@@ -198,5 +198,36 @@ def test_missing_subcommand_shows_help(self):
         assert len(combined_output) > 0, "No output from command without subcommand"
 
 
+class TestBenchmarkRngErrorHandling:
+    """Test lazy dependency handling in benchmark commands."""
+
+    def test_get_rng_success(self):
+        """Test _get_rng succeeds when numpy is present."""
+        from tito.commands.benchmark import _get_rng
+        np_mod, rng = _get_rng()
+        assert np_mod is not None
+        assert rng is not None
+
+    def test_get_rng_missing_numpy_raises_tinytorch_cli_error(self, monkeypatch):
+        """Test _get_rng raises TinyTorchCLIError (and not NameError) when numpy is missing."""
+        import builtins
+        from tito.commands.benchmark import _get_rng
+        from tito.core.exceptions import TinyTorchCLIError
+
+        orig_import = builtins.__import__
+
+        def failing_import(name, *args, **kwargs):
+            if name == "numpy":
+                raise ImportError("No module named 'numpy'")
+            return orig_import(name, *args, **kwargs)
+
+        monkeypatch.setattr(builtins, "__import__", failing_import)
+
+        with pytest.raises(TinyTorchCLIError) as exc_info:
+            _get_rng()
+
+        assert "NumPy is required to run benchmarks" in str(exc_info.value)
+
+
 if __name__ == '__main__':
     pytest.main([__file__, '-v'])
```

**File**: `tinytorch/tests/extensions/test_compile.py` (modified, +17/-2)
```diff
@@ -3,8 +3,23 @@
 def test_graph_compilation_trace():
     def simple_net(x, w, b):
         return (x * w) + b
-        
+
     code = compile_graph(simple_net, "x", "w", "b")
-    
+
     assert "def fused_kernel(x, w, b):" in code
     assert "(x * w) + b" in code or "((x * w) + b)" in code
+
+
+def test_graph_compilation_with_scalars():
+    """Verify tracing handles scalar literals without crashing on missing .name attribute."""
+    def scaled_offset_net(x):
+        # Forward and reverse scalar operations
+        return (2.0 * x + 1.0) * 3
+
+    code = compile_graph(scaled_offset_net, "x")
+
+    assert "def fused_kernel(x):" in code
+    assert "2.0" in code
+    assert "1.0" in code
+    assert "3" in code
+
```

**File**: `tinytorch/tinytorch/extensions/compile.py` (modified, +12/-2)
```diff
@@ -3,10 +3,20 @@ def __init__(self, name):
         self.name = name
 
     def __add__(self, other):
-        return TracedNode(f"({self.name} + {other.name})")
+        other_name = other.name if isinstance(other, TracedNode) else str(other)
+        return TracedNode(f"({self.name} + {other_name})")
+
+    def __radd__(self, other):
+        other_name = other.name if isinstance(other, TracedNode) else str(other)
+        return TracedNode(f"({other_name} + {self.name})")
 
     def __mul__(self, other):
-        return TracedNode(f"({self.name} * {other.name})")
+        other_name = other.name if isinstance(other, TracedNode) else str(other)
+        return TracedNode(f"({self.name} * {other_name})")
+
+    def __rmul__(self, other):
+        other_name = other.name if isinstance(other, TracedNode) else str(other)
+        return TracedNode(f"({other_name} * {self.name})")
 
 def compile_graph(func, *input_names):
     """
```

**File**: `tinytorch/tito/commands/benchmark.py` (modified, +4/-2)
```diff
@@ -11,6 +11,10 @@
 from datetime import datetime
 from pathlib import Path
 from typing import Dict, List, Optional, Any, Tuple
+
+from .base import BaseCommand
+from ..core.exceptions import TinyTorchCLIError
+
 def _get_rng():
     """Lazily import numpy and get standard random generator."""
     try:
@@ -29,8 +33,6 @@ def _get_rng():
 from rich.prompt import Prompt, Confirm
 from rich.console import Console
 
-from .base import BaseCommand
-from ..core.exceptions import TinyTorchCLIError
 
 
 class BenchmarkCommand(BaseCommand):
```

---

### Incident Patch 10: `e9e26e71` (2026-09-23)
**Commit Message**: Enhance Vol 4 core concepts: state estimation, MPC, AOT compilation, SOTIF, security, and regulations

**File**: `books/vol4/09_memory/09_memory.qmd` (modified, +2/-0)
```diff
@@ -79,6 +79,8 @@ Specifying the quantity and units remains incomplete without binding the value t
 
 Geometry and identity describe the physical state at a single moment, but memory must also capture the temporal anchor of that state. The record carries the evidence epoch $t_0$ of the physical interaction or optical exposure that last constrained the estimate. In distributed architectures, intermediate nodes often republish data, execute Kalman filter prediction steps, or run forward kinematic propagations to maintain high-rate control streams, and none of these adds physical evidence. The field must therefore pass unchanged through every republish, filter, and prediction stage, so that consumers measure the age of the information against the physical world rather than against the scheduling frequency of the local computer.
 
+Generating this anchored belief relies on **multi-sensor state estimation**\index{State estimation!contract boundary}\index{Sensor fusion!informational contract}—whether implemented through recursive Extended Kalman Filters (EKF), Unscented Kalman Filters (UKF) [@kalman1960new], or nonlinear factor-graph optimization (Smoothing and Mapping, SAM)—an established mathematical discipline whose operational role is to map asynchronous, heterogeneous sensor observations (such as high-rate IMU accelerations, wheel encoder ticks, and low-rate vision claims) into a minimal sufficient statistic of the plant's latent physical state. The physical AI architecture abstracts the internal numerical mechanics of this fusion pipeline behind the spatial belief contract. Downstream trajectory planning and safety enforcement do not recompute sensor innovation covariances or re-solve factor graphs; they require only that the state estimator provide an unbiased state vector $\hat{\mathbf{x}}$, a physically honest uncertainty bound $\mathbf{\Sigma}$, and the true evidence epoch $t_0$ of the measurements that constrained it. The foundational systems requirement is not the choice of filtering algorithm, but the obligation that the estimator model process noise expansion honestly across blind intervals (@sec-appendix-control-covariance derives continuous error covariance propagation) and revoke its validity status whenever physical observability rank collapses (@sec-memory-state-estimation-bounds).
+
 Knowing the evidence epoch $t_0$ establishes elapsed time $\Delta t = t - t_0$, but elapsed time alone cannot determine whether a belief is valid for a given action. Two estimates of identical age diverge at different rates depending on physical constraints. The rack end itself is bolted to the floor, so its remembered position stays within the machine's localization error however long the camera is blind, whereas a person hidden behind it can move at walking speed and spend the same clearance in a few tens of milliseconds.
 
 The minimum record fields necessary for a consumer to evaluate a stored state can be derived directly from the requirement to bound current error. Let $E(\Delta t)$ represent the upper bound of the discrepancy between the stored value and true physical state after an elapsed time $\Delta t = t - t_0$. If an estimator establishes a state at time $t_0$ with an initial uncertainty bound\index{Uncertainty bound} $E_0$, and external disturbances or unmodeled velocities cause the true state to diverge at a maximum rate $r$, the upper bound on error at current time $t$ obeys the linear expansion\index{Error expansion} $E(\Delta t) = E_0 + r\,\Delta t$. At the rack end, $E_0$ is the machine's localization error and $r$ is the walking speed of the person the rack may hide; @sec-memory-belief-through-occlusion evaluates that law. Omitting either term leaves the consumer unable to compute $E(\Delta t)$, so an initial bound and an expansion rate are both structurally required fields of the record.
```

**File**: `books/vol4/11_planning/11_planning.qmd` (modified, +2/-0)
```diff
@@ -234,6 +234,8 @@ Classical sampling-based planners answer the geometric half of this problem. A p
 
 Learned proposers bridge slow inference and fast actuator control by receding-horizon action chunking (@sec-brain-cognitive-pipeline), predicting a multi-step sequence, executing a prefix, and replanning on fresh observations. Three kinds of proposer fill this role, and each matters here through the latency and continuity of what it emits. ACT [@zhao2023learning] predicts $N$ future joint setpoints at once and blends overlapping chunks by the temporal ensembling of @sec-brain-cognitive-pipeline, which averages setpoints but leaves derivative continuity at the chunk seam to this chapter. Diffusion Policy [@chi2024diffusionpolicy] denoises a chunk of horizon $T_p$ (16 steps in the real Push-T setup), executes a subset $T_a$ (six there), and replans on the next observation; its iterative denoising adds workload-dependent latency and variance. A learned warm-start for a constrained trajectory optimizer can cut solver iterations when it lands near a feasible basin, but it can also choose the wrong side of an obstacle or miss the deadline. None of these outputs is a feasibility certificate, and only a candidate whose full path, seam, torque, and stop checks pass is admitted.
 
+This receding-horizon structure mirrors classical **Model Predictive Control (MPC)**\index{Model Predictive Control!receding horizon}\index{Trajectory optimization!collocation and MPC} and trajectory optimization, where an optimizer plans a trajectory over a finite horizon $T$, executes an initial prefix, and resolves the problem from the updated state on the next cycle. Classical MPC formulates trajectory synthesis as an explicit constrained numerical optimization problem, minimizing a cost function subject to analytical system dynamics ($\dot{\mathbf{x}} = f(\mathbf{x}, \mathbf{u})$) and hard inequality constraints on physical boundaries ($\mathbf{x} \in \mathcal{X}_{\text{safe}}$) and actuator torques ($\mathbf{u} \in \mathcal{U}_{\text{adm}}$). Where analytical models accurately capture the physical plant and state dimensions remain compact, MPC provides rigorous guarantees of constraint satisfaction and closed-loop stability. Yet classical trajectory optimization hits the "Classical Wall" of @sec-brain-classical-wall when applied to unstructured open-world manipulation: numerical solvers cannot ingest high-dimensional semantic tokens (such as raw camera pixels or natural-language instructions) directly, and non-smooth contact mechanics or deformable objects introduce combinatorial local minima that render online numerical optimization intractable within real-time control periods. Generative action chunking resolves the semantic ingestion problem by learning continuous multimodal trajectory distributions directly from visual demonstrations, but sacrifices analytical guarantees. The physical AI architecture therefore treats learned chunking policies as unprivileged semantic proposers across multi-second task horizons, relying on the kinodynamic feasibility checks and seam contracts developed in this chapter to guarantee physical admissibility before actuation. Executing these feasibility checks and seamlessly replacing the active trajectory introduces computational and transport delays that must be strictly bounded across replacement cycles.
+
 ```{python}
 #| label: calc-planning-replacement-ledger
 #| echo: false
```

**File**: `books/vol4/12_enforcement/12_enforcement.qmd` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ A tracking bound never checked at runtime is an assumption, not a contract. The
 Every spatial and dynamic safety boundary evaluated by an enforcer must be inset by the underlying tracking loop's verified worst-case tracking error, and the stopping envelope of @eq-enforce-stopping-envelope carries that inset, together with the travel during transport lag\index{Transport lag}, into every admission check. An enforcer that evaluates barrier certificates\index{Barrier certificates} against nominal geometric boundaries without insetting will permit trajectories that physically collide with obstacles whenever tracking error reaches its certified bound.
 :::
 
-The synthesis of tracking controllers, observers, and disturbance rejection belongs to the control literature [@slotine1991applied; @astrom2021feedback]. The tracker has no semantic awareness of obstacles, task goals, or hazards, and it will drive the base into a rack upright with the same fidelity it brings to free space, so before any proposal reaches it, the system must decide whether that proposal may become force at all.
+The synthesis of tracking controllers, observers, and disturbance rejection belongs to the control literature [@slotine1991applied; @astrom2021feedback]. In modern physical AI implementations, the "tracker" is rarely an elementary single-input single-output feedback loop; it is typically structured as a **cascaded control hierarchy**\index{Cascaded control!tracking architecture} (translating Cartesian path targets into joint velocity references, and velocity into field-oriented phase currents at $10\text{--}25\text{ kHz}$) or as a high-rate **tracking Model Predictive Controller (MPC)**\index{Model Predictive Control!tracking layer} running at $100\text{--}500\text{ Hz}$ on bare-metal firmware to solve a localized quadratic program for dynamic disturbance rejection. Yet regardless of its internal mathematical sophistication, an optimal tracker remains semantically blind: it possesses no internal model of obstacle clearances, task intent, or human proximity, and it will execute a collision path into a steel upright with the same dynamic fidelity it brings to unobstructed free space. Furthermore, when unmodeled physical disturbances occur—such as surface oil causing gross tire slip or sudden thermal current derating—even an optimal tracking controller can guarantee tracking only within its qualified error tube $\epsilon_{\text{track}}$. The enforcer therefore treats the tracker strictly as a contract boundary: it encapsulates the entire feedback control stack inside the certified bound $\epsilon_{\text{track}}$, evaluating candidate proposals against forward-invariant barrier certificates before any command reaches the tracking layer.
 
 ## The Authority to Refuse {#sec-enforcement-authority-refuse}
 
```

**File**: `books/vol4/13_placement/13_placement.qmd` (modified, +7/-2)
```diff
@@ -265,9 +265,12 @@ plt.tight_layout()
 plt.show()
 plt.close()
 ```
-
 :::
 
+Bridging high-capacity neural deliberation to edge silicon requires fundamentally different compilation principles than general-purpose cloud computing. Cloud inference engines optimize for average throughput (tokens per second) through dynamic batching, runtime graph tracing, and heap memory allocation (`malloc`). In an embodied physical AI system, these practices are hazardous. Dynamic memory allocation introduces heap fragmentation and allocator lock contention, while just-in-time compilation and paging faults inject multi-millisecond tail jitter ($P_{99.9}$) that directly steals stopping clearance (@sec-enforcement-stopping-envelopes). Edge compilers for physical AI therefore enforce **ahead-of-time (AOT) static graph compilation**\index{Ahead-of-time compilation!real-time inference}\index{Static memory allocation!real-time inference}: the execution graph's topology is permanently frozen, tensor dimensions are fixed, and every intermediate activation buffer is mapped to a static, pre-allocated physical memory offset before actuation begins, guaranteeing zero runtime dynamic allocations.
+
+Beyond eliminating tail jitter, compilation on edge SoCs is governed by thermodynamics and the memory wall. As established in @sec-brain-cognitive-pipeline, moving data across an off-chip dynamic RAM (DRAM) bus consumes roughly $10\text{--}20\times$ more energy per bit than performing arithmetic operations inside on-chip registers or static RAM (SRAM). On an untethered mobile robot operating within a $15\text{--}60\,\text{W}$ payload thermal budget, passing intermediate activation tensors back and forth across the DDR bus rapidly exhausts the thermal dissipation capacity of the chassis. **Operator fusion**\index{Operator fusion!thermodynamic efficiency} compiles multi-layer subgraphs (such as Convolution + Bias + Activation, or Attention Projection + LayerNorm) into unified fused kernels that execute entirely within on-chip register files and local SRAM caches, eliminating off-chip memory traffic. In parallel, **numerical precision reduction**\index{Quantization!bus bandwidth multiplier} (quantizing weights and activations from FP32/FP16 down to INT8 or FP4) acts as a direct multiplier on memory bus capacity. Halving the operand bitwidth doubles the effective transfer throughput of the memory crossbar, directly reducing memory bus occupancy and preserving bus bandwidth for concurrent real-time safety monitoring.
+
 ## Two Paths on One Die {#sec-placement-two-paths-one-die}
 
 ```{python}
@@ -414,6 +417,8 @@ Assigning tasks to separate processor cores does not create independent failure
 - *Shared power rails:* A single Power Distribution Network (PDN) delivers current to both domains, where switching surges from the neural accelerator drop the internal voltage rail, risking logic state corruption or brownout resets.
 - *Shared reset domains:* A kernel panic on the application processor that triggers a hardware watchdog\index{Watchdog timer!hardware} reset can pull down the shared peripheral bus or system interconnect, disabling the drive outputs and leaving the base without a permitted command.
 
+Shared hardware contention across these domains is not merely a passive scheduling inefficiency; it establishes an active **cyber-physical attack vector**\index{Cyber-physical security!shared-die attack surface}\index{Hardware security!side channels and DoS}. In a heterogeneous SoC where third-party neural workloads or network-exposed software containers share silicon with the permission path, a compromised application process can execute deliberate denial-of-service (DoS) attacks against physical safety. By generating pathological unaligned memory traffic or triggering cache-line thrashing (exploiting cache side-channel mechanisms or Rowhammer-style disturbances), an attacker on the unprivileged proposal path can deliberately saturate memory controller queues, delaying the safety microcontroller's memory access and forcing deadline misses. Similarly, an adversarial workload can trigger high-frequency tensor core switching patterns designed to maximize $L \cdot dI/dt$ inductive voltage droop, driving the shared power distribution network into brownout and inducing common-mode hardware resets. In physical AI architectures, software process isolation cannot defend against electrical and microarchitectural coupling; hardware-enforced quality-of-service partitions (such as ARM MPAM) and physical silicon separation are fundamental cyber-physical security controls.
+
 [^fn-std-cast-32a]: **Avionic Multicore Certification**\index{Multicore interference!FAA AC 20-193 / CAST-32A}\index{Worst-case execution time!multicore certification}: FAA Advisory Circular AC 20-193 and CAST-32A formalize multicore interference analysis for safety-critical avionics. The guidance requires bounding worst-case execution times by demonstrating that shared caches, interconne
```

**File**: `books/vol4/15_verification/15_verification.qmd` (modified, +4/-0)
```diff
@@ -373,6 +373,8 @@ A boundary stays honest only if every parameter carries its unit, its provenance
 
 Testing the envelope means attacking its boundary surface. Interior points, where the base crawls unloaded across a dry floor on fresh camera frames, show only that the machine works under ideal conditions. The test framework places points on, just inside, and just outside each consequential boundary. Points just inside check that the policy keeps closed-loop stability\index{Closed-loop stability} under the largest permitted stress; points on the boundary check that margins survive nominal sensor noise; points just outside check that the enforcer takes authority from the policy predictably and halts the base within the survival envelope before the clear distance is gone.
 
+Probing this boundary surface formalizes the critical distinction between classical **Functional Safety** (governed by ISO 26262 and IEC 61508) and the **Safety of the Intended Functionality (SOTIF)**\index{Safety of the Intended Functionality!ISO 21448}\index{SOTIF!ISO 21448}\index{Functional safety!versus SOTIF} (governed by ISO 21448). Classical functional safety frameworks assume that operational hazards arise from *system faults*: broken wiring harnesses, electrical shorts, bit flips in memory, or software syntax bugs. If every hardware and software component operates strictly according to its engineering specification, classical functional safety considers the system non-hazardous. In physical AI systems, this premise fails. A vision transformer or learned depth estimator can execute with zero memory faults, zero numerical exceptions, and bit-exact instruction execution, yet fail to detect an obstacle due to unmodeled sunlight glare, retroreflective surfaces, or novel semantic objects outside its training distribution. This hazard arises from **functional insufficiency**—a fundamental performance limitation of learned perception in open environments, occurring in the total absence of an electrical or software fault. Verification of the operating envelope under SOTIF requires systematically identifying these unknown-unsafe conditions through adversarial boundary search, mapping the envelope within which perception is statistically valid, and demonstrating that the deterministic enforcer catches functional insufficiencies before physical clearance is breached. Yet while SOTIF verifies that the system responds safely to sensory ambiguity in the world, the enforcer's ultimate ability to arrest physical momentum still rests on the deterministic integrity of the underlying hardware under electrical and mechanical stress.
+
 ::: {#psp-verification-hardware-falsification .callout-perspective title="The hardware falsification principle"}
 If a safety property cannot be deterministically falsified by injecting a physical or electrical fault\index{Fault injection!hardware} on target hardware, the property is an unverified assumption rather than an engineering invariant.
 :::
@@ -411,6 +413,8 @@ The physical source extends to operator error and foreseeable misuse (@sec-inter
 
 Working forward from the physical machine adds one representative mechanical class, the actuator jam, to the record-derived list in @tbl-15-fault-classification. Completeness still requires a separate hazard-analysis argument for the specified plant and operating envelope.
 
+Working forward from physical transducers also requires testing against **transduction-layer cyber-physical attacks**\index{Cyber-physical security!transduction attacks}\index{Sensor spoofing!physical injection}\index{Cybersecurity engineering!ISO/SAE 21434}. In connected autonomous systems, physical AI introduces attack surfaces that bypass traditional network firewall abstractions by exploiting the physics of sensory transduction. Resonant acoustic injection (targeting the micro-mechanical proof masses of MEMS gyroscopes with ultrasonic frequencies) can induce false angular rates in inertial navigation without corrupting a single bus packet. Similarly, optical laser injection and rolling-shutter illumination strobes can saturate camera photodiodes to blind range estimators, while adversarial physical patches (high-contrast geometric patterns placed on warehouse walls or floor surfaces) can exploit the gradient landscape of neural perception backbones to cause false negative obstacle detections. Under **ISO/SAE 21434 (Road vehicles — Cybersecurity engineering)**, these threats are co-engineered alongside functional safety faults: a cyber-physical intrusion is evaluated by its ability to cross the causal boundary into hazardous actuation. The verification suite must confirm that the enforcer's cross-sensor plausibility checks (such as comparing wheel odometry against optical flow, or checking camera evidence epochs against IMU integration bounds) detect transduction anomalies and engage the fallback ladder before false perceptual claims can command torque.
+
 Besides inverted claims and forward h
```

**File**: `books/vol4/16_release/16_release.qmd` (modified, +6/-0)
```diff
@@ -330,6 +330,12 @@ This tension between inductive fleet evidence and safety-critical assurance is i
 
 The fundamental systems lesson of @fig-release-decade-california-dmv-disengagements is that an inductive warrant derived solely from aggregate fleet mileage cannot establish a catastrophic hazard claim. A high MPI indicates operational maturity under nominal conditions, but it does not bound the severity or probability of tail-event failures under unmodeled physical interactions. Safety cases for physical AI must combine empirical exposure with deterministic architectural enforcers that remain valid when learned policies encounter novel distributional shifts.
 
+An engineering safety case does not exist in an institutional vacuum. Inside the development team, the claim-argument-evidence tree establishes technical confidence that physical risks are bounded; outside the team, it forms the evidential substrate for statutory regulatory authorization and legal accountability. When an autonomous system moves from the laboratory into commercial deployment, its safety claims intersect three primary governance pillars:
+
+1. **The European Union AI Act (High-Risk Classification):** Under the EU Artificial Intelligence Act\index{EU AI Act!high-risk physical AI}\index{Regulatory compliance!EU AI Act}, AI systems deployed as safety components in physical machinery, collaborative robots, or autonomous transport are classified as *High-Risk AI Systems*. Statutory compliance mandates an auditable risk management system that spans the operational lifecycle, verified data governance documenting training and evaluation distributions (@sec-data-schema), human oversight interfaces capable of real-time intervention (@sec-intervention-human-authority), and tamper-evident event logging (@sec-intervention-trustworthy-logs) to ensure forensic reconstructibility after any anomalous contact.
+2. **Domain-Specific Statutory Certification:** Beyond horizontal AI regulations, embodied systems must satisfy sector-specific safety mandates: the U.S. Food and Drug Administration (FDA)\index{FDA!surgical robotics regulation} pre-market pathways (510(k) and De Novo) for autonomous surgical robotics, requiring human-factors validation under ANSI/AAMI HE75 and software lifecycle controls under IEC 62304; Federal Aviation Administration (FAA)\index{FAA!drone airworthiness} airworthiness certifications (Part 107/135) for autonomous aerial logistics; and UNECE/NHTSA standards (such as UN R157 for automated vehicle steering) governing automated driving systems.
+3. **The Redistribution of Legal Liability:** In classical factory automation where robots operate within interlocked cages (@fig-industrial-welding), physical accidents are adjudicated primarily under the legal doctrine of *operator negligence*—evaluating whether floor personnel violated safety protocols or bypassed interlocks. When an autonomous machine operates without physical fencing in shared human spaces, legal responsibility shifts fundamentally toward *strict manufacturer product liability*\index{Product liability!strict liability in physical AI}\index{Legal liability!operator negligence versus strict liability}. An unmodeled perceptual failure or tracking overshoot is no longer an operator error; it is an alleged defect in design, manufacturing, or failure to instruct. In this legal regime, a cryptographically signed safety case and release manifest is not merely good engineering practice—it is the definitive evidentiary record establishing that the engineering team bounded residual risk to state-of-the-art standards prior to public release.
+
 ::: {#fig-release-decade-california-dmv-disengagements fig-env="figure" fig-pos="htb" fig-cap="**A decade of autonomous vehicle disengagement trends reported to the California DMV (2015–2025)**: Annual Miles Between Disengagements (MPI, log scale) across major autonomous vehicle developers (Waymo, Cruise, Zoox, Apple Project Titan, and Aurora) spanning three historical operating eras. The horizontal dotted line marks the human driver baseline of approximately 40,000 miles between police-reported crashes (NHTSA). Milestones highlight Waymo's 2021 dense urban transition dip, Cruise's October 2023 permit revocation following a high-severity collision, Zoox's consistent urban robotaxi regime, Apple's program cancellation, and Waymo reaching 63,415 miles per disengagement in 2025. (Data source: California DMV Annual Autonomous Vehicle Disengagement Reports, 2015–2025)." fig-alt="Log-scale line plot showing miles between disengagements from 2015 to 2025 across five autonomous vehicle developers. Background shows three shaded eras from early highway testing to commercial driverless scale. Waymo and Cruise show multi-order-of-magnitude improvements above the 40,000-mile human driver baseline, alongside key badges marking regulatory revocations, urban transitions, and company program pivots."}
 
 ```{python}
```

---

### Incident Patch 11: `7a35b8d3` (2026-09-23)
**Commit Message**: fix(badge): drop event=push filter from TinyTorch CI badge

The publish workflow's version-bump commit is pushed by github-actions[bot]
using GITHUB_TOKEN, which by design does not trigger other workflows.
This left the badge red after every release because shields.io saw no
push-event run on the new HEAD.  Removing the event filter lets the badge
pick up workflow_dispatch and workflow_call runs as well.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
 
 <!-- Build Status: Companion Ecosystem & Tools -->
 <p align="center">
-  <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/tinytorch-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/tinytorch-validate-dev.yml?branch=dev&event=push&label=TinyTorch&logo=python&cacheSeconds=300" alt="TinyTorch"></a>
+  <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/tinytorch-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/tinytorch-validate-dev.yml?branch=dev&label=TinyTorch&logo=python&cacheSeconds=300" alt="TinyTorch"></a>
   <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/mlsysim-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/mlsysim-validate-dev.yml?branch=dev&event=push&label=MLSys%C2%B7im&logo=python&cacheSeconds=300" alt="MLSys·im"></a>
   <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/labs-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/labs-validate-dev.yml?branch=dev&event=push&label=Labs&logo=jupyter&cacheSeconds=300" alt="Labs"></a>
   <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/kits-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/kits-validate-dev.yml?branch=dev&event=push&label=Kits&logo=arduino&cacheSeconds=300" alt="Kits"></a>
```

---

### Incident Patch 12: `87a953e0` (2026-09-22)
**Commit Message**: fix(validator): handle SystemExit in code_exec check and enforce byte unit in Ch 09

**File**: `binder/cli/checks/code_exec.py` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ def check_code_exec(path: Path, text: str | None = None) -> List[CodeExecIssue]:
                     warnings.simplefilter("ignore")
                     with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                         exec(code, scope)
-            except Exception as exc:
+            except (Exception, SystemExit) as exc:
                 first_code_line = next((l.strip() for l in clean_lines if l.strip()), "")
                 issues.append(
                     CodeExecIssue(
```

**File**: `books/vol3/09_checkpointing/09_checkpointing.qmd` (modified, +1/-1)
```diff
@@ -689,7 +689,7 @@ class TurnBoundarySignalBounds:
     delta_t_worst = ((t_max - 1) / r_decode_val) * second
     delta_t_bounded = (k_tokens * (1000.0 / r_decode_val)) * millisecond
 
-    m_token = calc_kv_cache_bytes_per_token(n_layers=l_layers, n_kv_heads=n_kv, head_dim=d_head, bytes_per_elem=1)
+    m_token = calc_kv_cache_bytes_per_token(n_layers=l_layers, n_kv_heads=n_kv, head_dim=d_head, bytes_per_elem=1 * byte)
     m_kv_bytes = (n_ctx * m_token).to(byte)
     m_kv_gib = m_kv_bytes.to(GiB)
     m_kv_gb = m_kv_bytes.to(GB)
```

---

### Incident Patch 13: `83baf60e` (2026-09-22)
**Commit Message**: Fix cover label overlap with circuit bus

**File**: `tinytorch/book/assets/images/cover.svg` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@
 <rect x="800" y="2370" width="450" height="124" rx="8" fill="#B7352D"/>
 <text x="1025.0" y="2450.0" text-anchor="middle" xml:space="preserve"><tspan font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="42" font-weight="bold" fill="#FFFFFF">20  </tspan><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="56" font-weight="bold" fill="#FFFFFF">TinyGPT</tspan></text>
 <text x="800" y="2538" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="25" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="0">Full TinyGPT Architecture · MLPerf Benchmark Olympics</text>
-<text x="1530" y="2312.0" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="22" fill="#111827" text-anchor="middle" font-weight="bold" font-style="normal" letter-spacing="2">COMMUNITY LABS &amp; EXTENSIONS</text>
+<text x="1480" y="2538" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="22" fill="#111827" text-anchor="middle" font-weight="bold" font-style="normal" letter-spacing="2">COMMUNITY LABS &amp; EXTENSIONS</text>
 <path d="M 1250 2432.0 L 1350 2432.0" fill="none" stroke="#B7352D" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>
 <text x="1380" y="2440.0" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="26" fill="#B7352D" text-anchor="start" font-weight="bold" font-style="normal" letter-spacing="0">LoRA / PEFT</text>
 <path d="M 1250 2432.0 L 1290 2432.0 Q 1310 2432.0 1310 2402.0 L 1310 2382.0 Q 1310 2362.0 1330 2362.0 L 1350 2362.0" fill="none" stroke="#B7352D" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>
```

**File**: `tinytorch/book/tools/build_cover.py` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ def build():
     node_out_y = ly + n/2
     
     # Label for the branches
-    p.append(_t(node_out_x + 280, node_out_y - 120, "COMMUNITY LABS &amp; EXTENSIONS", SANS, 22, TITLE_C, weight="bold", anchor="middle", ls=2))
+    p.append(_t(node_out_x + 230, ly + n + 44, "COMMUNITY LABS &amp; EXTENSIONS", SANS, 22, TITLE_C, weight="bold", anchor="middle", ls=2))
     
     # 1. Straight right
     p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 100} {node_out_y}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
```

---

### Incident Patch 14: `1a459d6b` (2026-09-22)
**Commit Message**: vol3: adhere to CMOS guidelines across figures and streamline harness sensitivity

- Remove all top titles, headers, and Panel A/B labels inside figure canvases
- Set sentence-case capitalization on all figure axis labels
- Update prose and captions in chapters 1 and 5 to reference left and right panels
- Streamline chapter 9 Harness Sensitivity figure into a focused single-panel solve-rate comparison, resolving confusion around raw evaluation dollar expenditure
- Verify all embedded Python figure blocks execute cleanly with book style

**File**: `books/vol3/01_introduction/01_introduction.qmd` (modified, +18/-29)
```diff
@@ -375,38 +375,29 @@ from binder.tools.figures import style as book_style
 
 book_style.set_book_style()
 
-fig = plt.figure(figsize=(10.0, 3.4))
+fig = plt.figure(figsize=(10.0, 2.6))
 ax = fig.add_subplot(1, 1, 1)
 ax.axis("off")
 
 ax.set_xlim(-10, 610)
-ax.set_ylim(-0.4, 3.2)
+ax.set_ylim(-0.4, 2.6)
 
-ax.text(
-    0,
-    3.05,
-    "Autonomous Agent Loop Execution Timeline (SWE-bench Verified Trajectory)",
-    fontsize=10.5,
-    fontweight="bold",
-    ha="left",
-)
-
-ax.text(0, 2.50, "Traditional Model Serving (Stateless Inference)", fontsize=8.8, fontweight="bold")
-rect_llm = patches.Rectangle((0, 1.85), 510, 0.48, linewidth=1.0, edgecolor="#166534", facecolor="#16A34A")
+ax.text(0, 2.30, "Traditional Model Serving (Stateless Inference)", fontsize=8.8, fontweight="bold")
+rect_llm = patches.Rectangle((0, 1.65), 510, 0.48, linewidth=1.0, edgecolor="#166534", facecolor="#16A34A")
 ax.add_patch(rect_llm)
 ax.text(
     255,
-    2.09,
+    1.89,
     "Continuous Token Generation (GPU Tensor Cores Active, ~100% Accelerator Utilization)",
     ha="center",
     va="center",
     color="#FFFFFF",
     fontsize=8.0,
     fontweight="bold",
 )
-ax.text(520, 2.09, "100% Neural Compute\nZero Tool Wait", ha="left", va="center", color="#166534", fontsize=7.8, fontweight="bold")
+ax.text(520, 1.89, "100% Neural Compute\nZero Tool Wait", ha="left", va="center", color="#166534", fontsize=7.8, fontweight="bold")
 
-ax.text(0, 1.35, "Autonomous Agent Loop (SWE-bench Verified 8.5-Minute Trajectory)", fontsize=8.8, fontweight="bold")
+ax.text(0, 1.15, "Autonomous Agent Loop (SWE-bench Verified 8.5-Minute Trajectory)", fontsize=8.8, fontweight="bold")
 
 phases = [
     (0, 45, "Docker Boot\n& Setup", "#E2E8F0", "#334155", "Host OS"),
@@ -418,11 +409,11 @@ phases = [
 ]
 
 for x_start, width, label, fc, tc, sub in phases:
-    rect = patches.Rectangle((x_start, 0.65), width, 0.52, linewidth=1.0, edgecolor="#0F172A" if sub == "GPU" else "#94A3B8", facecolor=fc)
+    rect = patches.Rectangle((x_start, 0.45), width, 0.52, linewidth=1.0, edgecolor="#0F172A" if sub == "GPU" else "#94A3B8", facecolor=fc)
     ax.add_patch(rect)
     ax.text(
         x_start + width / 2.0,
-        0.91,
+        0.71,
         label,
         ha="center",
         va="center",
@@ -431,12 +422,12 @@ for x_start, width, label, fc, tc, sub in phases:
         fontweight="bold",
     )
 
-ax.plot([0, 510], [0.38, 0.38], color="#DC2626", linestyle="--", linewidth=1.3)
-ax.plot([0, 0], [0.30, 0.46], color="#DC2626", linewidth=1.3)
-ax.plot([510, 510], [0.30, 0.46], color="#DC2626", linewidth=1.3)
+ax.plot([0, 510], [0.22, 0.22], color="#DC2626", linestyle="--", linewidth=1.3)
+ax.plot([0, 0], [0.14, 0.30], color="#DC2626", linewidth=1.3)
+ax.plot([510, 510], [0.14, 0.30], color="#DC2626", linewidth=1.3)
 ax.text(
     255,
-    0.05,
+    -0.10,
     "Synchronous Tool Wait & Memory Stranding: 420s of non-neural host operations strand GPU HBM (KV cache pinned) while server idles",
     ha="center",
     va="center",
@@ -454,9 +445,9 @@ plt.close()
 
 Software 3.0 is therefore defined not by the elimination of traditional systems engineering, but by its intensification. The presence of an unprivileged, stochastic policy at the core of the execution loop mandates rigorous, deterministic supervision. The runtime supervisor must arbitrate access to hardware accelerators, virtualize memory across volatile HBM and persistent host storage, enforce security boundaries around untrusted tool outputs, and verify system invariants before declaring a task complete.
 
-The empirical consequence of this physical boundary is mapped in @fig-vol3-agent-systems-tax. Profiling an autonomous coding agent executing a benchmark task on SWE-bench Verified reveals the striking magnitude of the **Agent Systems Tax**: across an 8.5-minute repair trajectory, non-neural host operations—isolated Docker workspace setup (8.1 kJ, 6.9 percent), file indexing and ripgrep queries (16.8 kJ, 14.4 percent), and pytest suite compilation and verification (56.1 kJ, 48.0 percent)—account for fully **69.3 percent** of total AC mains electrical energy consumption (81.0 kJ) and **82.4 percent** of wall-clock makespan. Pure neural token generation on accelerator tensor cores consumes only **30.7 percent** of energy (35.9 kJ) and **17.6 percent** of runtime. This empirical profile mathematically confirms the central thesis: autonomous agent performance, reliability, and operating costs are dominated by host operating system orchestration, virtualization sandboxes, and verification harnesses, rather than neural model scaling alone.
+The empirical consequence of this physical boundary is mapped in @fig-vol3-agent-systems-tax. Profiling an autonomous coding agent executing a benchmark task on SWE-bench Verified reveals the striking magnitude of the **Agent Systems Tax**. In the left panel of @fig-vol3-agent-systems-tax, non-neural host operations—isolated Docker workspace setup (8.1 kJ, 6.9 
```

**File**: `books/vol3/05_kv_cache/05_kv_cache.qmd` (modified, +23/-24)
```diff
@@ -166,9 +166,9 @@ When agent sequences are short ($S = 8,192$), the cluster comfortably hosts $B_{
 
 Tool waits make the bottleneck worse. @Sec-vol3-intro-memory-stranding priced this pressure, the tool-wait memory tax, for one paused session on the same node. While a tool runs, the trajectory's attention state sits idle in accelerator memory, and the serving system must choose between holding tens of gigabytes that other trajectories need and moving or discarding them at the price of a reload or a full prefill when the observation returns. The model cannot make that choice. Memory is a resource bound, and the invariant closure principle (\ref{pri-invariant-closure}) places resource bounds in the runtime below the model, so the serving system owns the decision. It returns in @sec-vol3-kvcache-swapping once paging is in place.
 
-The physical scale of this dilemma is visualized in @fig-vol3-kv-cache-memory-wall. Between 2018 and 2026, frontier language model context windows exploded by over 4,000×, expanding from GPT-1's 512 tokens to Gemini 1.5 and 2.0's 2,097,152 tokens (left). While this expansion enables agents to ingest entire codebases and retain extensive tool interactions, it crashes directly into the physical memory ceilings of hardware accelerators (right). At a 16-bit footprint of $320\text{ KiB}$ per token, a single 70B model trajectory ($B=1$) at 128,000 tokens pins 40 GB of High-Bandwidth Memory (half an NVIDIA H100 accelerator). At 1,000,000 tokens, that single trajectory commands 320 GB of KV cache—exceeding the 80 GB capacity of an entire H100 GPU by 4.0× and exceeding even next-generation 192 GB B200 accelerators by 1.7×. When four concurrent agents run at this horizon ($B=4$), aggregate KV memory demands surge past 1.28 TB, overwhelming entire multi-GPU clusters. This **KV cache memory wall** transforms memory allocation from a background implementation detail into the primary governor of agent scalability, necessitating virtual memory abstractions, dynamic block paging, and hierarchical offloading.
+The physical scale of this dilemma is visualized in @fig-vol3-kv-cache-memory-wall. As plotted in the left panel of @fig-vol3-kv-cache-memory-wall, frontier language model context windows expanded over 4,000-fold between 2018 and 2026, growing from GPT-1's 512 tokens to Gemini 1.5 and 2.0's 2,097,152 tokens. While this expansion enables agents to ingest entire codebases and retain extensive tool interactions, it crashes directly into the physical memory ceilings of hardware accelerators shown in the right panel. At a 16-bit footprint of $320\text{ KiB}$ per token, a single 70B model trajectory ($B=1$) at 128,000 tokens pins 40 GB of High-Bandwidth Memory (half an NVIDIA H100 accelerator). At 1,000,000 tokens, that single trajectory commands 320 GB of KV cache—exceeding the 80 GB capacity of an entire H100 GPU by 4.0× and exceeding even next-generation 192 GB B200 accelerators by 1.7×. When four concurrent agents run at this horizon ($B=4$), aggregate KV memory demands surge past 1.28 TB, overwhelming entire multi-GPU clusters. This **KV cache memory wall** transforms memory allocation from a background implementation detail into the primary governor of agent scalability, necessitating virtual memory abstractions, dynamic block paging, and hierarchical offloading.
 
-::: {#fig-vol3-kv-cache-memory-wall fig-env="figure" fig-pos="htb" fig-cap="**The KV Cache Memory Wall**: Context window expansion across frontier language models (2018–2026) and the resulting physical memory wall versus accelerator hardware ceilings. (Left) Historical context window capacity showing a 4,000× explosion from GPT-1 (512 tokens) to Gemini 1.5 and 2.0 (2,097,152 tokens). (Right) Key-value cache memory scaling for 70B grouped-query and 8B dense architectures across context horizons, contrasted against hardware memory limits (V100 32 GB, A100/H100 80 GB, H200 141 GB, B200 192 GB, and an eight-accelerator H100 node with a 480 GB dynamic pool). At one million tokens, a single 70B trajectory requires 320 GB of KV state, surpassing single-device capacities and necessitating PagedAttention and hierarchical offloading." fig-alt="Two-panel visualization of the KV cache memory wall. The left panel plots maximum context window length on a logarithmic scale from 2018 to 2026, showing an upward frontier envelope from GPT-1 at 512 tokens through GPT-3, GPT-4, Claude 2, Claude 3, up to Gemini 1.5 and 2.0 at 2,097,152 tokens. The right panel plots KV cache memory in gigabytes on a log-log scale against context length from 1,000 to two million tokens for 70B and 8B models, intersected by horizontal dashed lines representing physical memory limits of V100, H100, H200, B200, and an 8-GPU H100 cluster. A shaded red zone highlights the physical memory wall above 80 GB, with callouts indicating 40 GB at 128,000 tokens and 320 GB at one million tokens for a single 70B sequence."}
+::: {#fig-vol3-kv-cache-memory-wall fig-env="figure" fig-p
```

**File**: `books/vol3/09_agent_harness/09_agent_harness.qmd` (modified, +27/-61)
```diff
@@ -107,9 +107,9 @@ def run_turn(rec: TrajectoryRecord) -> None:
 
 Every line of the listing reads or writes `rec`, and the rest of the chapter follows those reads and writes in order. The record itself comes first, because the harness cannot enforce anything about a trajectory it cannot describe. The states and the guarded `transition` function come next, then the control actions and stop reasons that drive them, the waits on tools and on people, the scheduler that chooses which ready trajectory runs, and finally the budgets behind `charge` and `budget_exhausted`.
 
-The profound performance divergence between an unadorned string-concatenating while loop and an architected agent harness is not merely theoretical; it is empirically measurable at the frontier of artificial intelligence. As demonstrated in @fig-vol3-harness-sensitivity, benchmarking the exact same foundation model policy across an interactive video-game reasoning benchmark (ARC-AGI) reveals the **Harness Sensitivity Law**. Under a standard while-loop ReAct scaffold passing textual frames and unmanaged notes, the model solves only 35.2 percent to 62.7 percent of tasks at a severe evaluation expenditure of 26.1 thousand to 49.8 thousand dollars (left). In contrast, wrapping the identical neural weights in a stateful Provider Adapter Harness—which maintains native key-value cache prefix trees, enforces schema-validated state frames, and decouples tool execution from memory stranding—catapults task accuracy to **99.95 percent** while reducing overall dollar cost by **28 percent** (18.8 thousand dollars, right). This 37.24 percentage-point capability leap proves that an agent's real-world competence and economic viability are bounded by the architectural fidelity of its harness state machine, rather than neural parameter scaling alone.
+The profound performance divergence between an unadorned string-concatenating while loop and an architected agent harness is not merely theoretical; it is empirically measurable at the frontier of artificial intelligence. As demonstrated in @fig-vol3-harness-sensitivity, benchmarking the exact same foundation model policy across an interactive reasoning benchmark (ARC-AGI) reveals the **Harness Sensitivity Law**. Under a standard while-loop ReAct scaffold passing textual frames and unmanaged notes, the model solves only 35.2 percent to 62.7 percent of tasks across search budgets. In contrast, wrapping the identical neural weights in a stateful Provider Adapter Harness—which maintains native key-value cache prefix trees, enforces schema-validated state frames, and decouples tool execution from memory stranding—catapults task accuracy to **99.95 percent**. This 37.24 percentage-point capability leap proves that an agent's real-world competence and economic viability are bounded by the architectural fidelity of its harness state machine, rather than neural parameter scaling alone.
 
-::: {#fig-vol3-harness-sensitivity fig-env="figure" fig-pos="htb" fig-cap="**The Harness Sensitivity Frontier**: Empirical solve rate and evaluation cost for identical foundation model weights across harness architectures on the ARC-AGI interactive reasoning benchmark. (Left) Benchmark accuracy showing a 37.24 percentage-point capability gain (from 62.7 percent to 99.95 percent) when transitioning from an ephemeral while-loop ReAct scaffold to a native stateful adapter harness. (Right) Total evaluation expenditure showing a 28 percent cost reduction (from 26.1 thousand to 18.8 thousand dollars) enabled by native key-value cache prefix reuse and structured state compaction." fig-alt="Two-panel bar chart visualizing the Harness Sensitivity Frontier. The left panel plots ARC-AGI benchmark solve rates across six configurations, rising from 35.2 percent, 54.8 percent, and 62.7 percent under while-loop scaffolds to 98.4 percent, 98.5 percent, and 99.95 percent under stateful adapter harnesses, highlighted by a red arrow marking a 37.24 percentage-point leap. The right panel plots total evaluation dollar cost across the same configurations, dropping from 49.8 thousand, 40.7 thousand, and 26.1 thousand dollars down to 19.3 thousand, 17.3 thousand, and 18.8 thousand dollars, highlighted by a green arrow marking 28 percent cost savings."}
+::: {#fig-vol3-harness-sensitivity fig-env="figure" fig-pos="htb" fig-cap="**The Harness Sensitivity Frontier**: Empirical solve rate for identical foundation model weights across harness architectures on the ARC-AGI interactive reasoning benchmark. Transitioning from an ephemeral while-loop ReAct scaffold to a native stateful adapter harness yields a 37.24 percentage-point capability gain (from 62.7 percent to 99.95 percent), demonstrating that runtime harness state machines dominate raw parameter scaling." fig-alt="Bar chart visualizing the Harness Sensitivity Frontier. The graph plots ARC-AGI benchmark solve rates across six configurations, rising from 35.2 percent, 54.8 percent, and 62.7 percent under while-
```

---

### Incident Patch 15: `f5122110` (2026-09-22)
**Commit Message**: Revert cover to 20 modules and add expansion ports to Capstone

**File**: `tinytorch/book/assets/images/cover.svg` (modified, +9/-9)
```diff
@@ -32,9 +32,9 @@
 <svg x="891" y="680" width="195" height="195" viewBox="0 0 128 128"><g><path fill="url(#FLAME_BG)" d="M35.56,40.73c-0.57,6.08-0.97,16.84,2.62,21.42c0,0-1.69-11.82,13.46-26.65 c6.1-5.97,7.51-14.09,5.38-20.18c-1.21-3.45-3.42-6.3-5.34-8.29C50.56,5.86,51.42,3.93,53.05,4c9.86,0.44,25.84,3.18,32.63,20.22 c2.98,7.48,3.2,15.21,1.78,23.07c-0.9,5.02-4.1,16.18,3.2,17.55c5.21,0.98,7.73-3.16,8.86-6.14c0.47-1.24,2.1-1.55,2.98-0.56 c8.8,10.01,9.55,21.8,7.73,31.95c-3.52,19.62-23.39,33.9-43.13,33.9c-24.66,0-44.29-14.11-49.38-39.65 c-2.05-10.31-1.01-30.71,14.89-45.11C33.79,38.15,35.72,39.11,35.56,40.73z"/><path fill="url(#FLAME_CORE)" d="M76.11,77.42c-9.09-11.7-5.02-25.05-2.79-30.37c0.3-0.7-0.5-1.36-1.13-0.93 c-3.91,2.66-11.92,8.92-15.65,17.73c-5.05,11.91-4.69,17.74-1.7,24.86c1.8,4.29-0.29,5.2-1.34,5.36 c-1.02,0.16-1.96-0.52-2.71-1.23c-2.15-2.05-3.7-4.72-4.44-7.6c-0.16-0.62-0.97-0.79-1.34-0.28c-2.8,3.87-4.25,10.08-4.32,14.47 C40.47,113,51.68,124,65.24,124c17.09,0,29.54-18.9,19.72-34.7C82.11,84.7,79.43,81.69,76.11,77.42z"/></g></svg>
 <text x="1081" y="880" font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="280" fill="#111827" text-anchor="start" font-weight="bold" font-style="normal" letter-spacing="0">Torch</text>
 <text x="300" y="1045" xml:space="preserve"><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="82" font-style="italic" fill="#374151">Don't just </tspan><tspan font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="70" font-weight="bold" fill="#111827">import torch</tspan><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="82" font-style="italic" fill="#374151">. Build it.</tspan></text>
-<text x="300" y="1135" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="38" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="1">From Tensors to Hardware-Accelerated Transformers and Systems Extensions</text>
+<text x="300" y="1135" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="42" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="1">From Tensors to Hardware-Accelerated Transformers—and Beyond.</text>
 <text x="300" y="1330" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="28" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="6">THE FULL RUNTIME STACK</text>
-<text x="2250" y="1330" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="28" fill="#B7352D" text-anchor="end" font-weight="normal" font-style="normal" letter-spacing="6">21 MODULES / 5 TIERS</text>
+<text x="2250" y="1330" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="28" fill="#B7352D" text-anchor="end" font-weight="normal" font-style="normal" letter-spacing="6">20 MODULES / 4 TIERS</text>
 <line x1="300" y1="1360" x2="2250" y2="1360" stroke="#C2CBD4" stroke-width="2"/>
 <line x1="862.0" y1="1502.0" x2="2017.0" y2="1502.0" stroke="#B7352D" stroke-width="4"/>
 <path d="M 2017.0 1502.0 L 2077.0 1502.0 Q 2107.0 1502.0 2107.0 1532.0 L 2107.0 1657.0 Q 2107.0 1687.0 2077.0 1687.0 L 802.0 1687.0 Q 772.0 1687.0 772.0 1717.0 L 772.0 1782.0 Q 772.0 1812.0 802.0 1812.0 L 862.0 1812.0" fill="none" stroke="#B7352D" stroke-width="3.5" stroke-dasharray="8,5"/>
@@ -98,13 +98,13 @@
 <rect x="800" y="2370" width="450" height="124" rx="8" fill="#B7352D"/>
 <text x="1025.0" y="2450.0" text-anchor="middle" xml:space="preserve"><tspan font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="42" font-weight="bold" fill="#FFFFFF">20  </tspan><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="56" font-weight="bold" fill="#FFFFFF">TinyGPT</tspan></text>
 <text x="800" y="2538" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="25" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="0">Full TinyGPT Architecture · MLPerf Benchmark Olympics</text>
-<text x="1370" y="2428" font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="72" fill="#B7352D" text-anchor="start" font-weight="bold" font-style="normal" letter-spacing="0">V</text>
-<text x="1370" y="2476" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="32" fill="#111827" text-anchor="start" font-weight="bold" font-style="normal" letter-spacing="4">EXTENSIONS</text>
-<text x="1370" y="2514" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="24" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="2">M
```

**File**: `tinytorch/book/tools/build_cover.py` (modified, +20/-19)
```diff
@@ -118,11 +118,11 @@ def build():
         f'<tspan font-family="{SERIF}" font-size="82" font-style="italic" fill="{SUB_C}">. Build it.</tspan>'
         f'</text>'
     )
-    p.append(_t(L, 1135, "From Tensors to Hardware-Accelerated Transformers and Systems Extensions", SANS, 38, TEXT_C, ls=1))
+    p.append(_t(L, 1135, "From Tensors to Hardware-Accelerated Transformers—and Beyond.", SANS, 42, TEXT_C, ls=1))
 
     # --- header divider bar -------------------------------------------------
     p.append(_t(L, 1330, "THE FULL RUNTIME STACK", MONO, 28, TEXT_C, ls=6))
-    p.append(_t(R, 1330, "21 MODULES / 5 TIERS", MONO, 28, ACCENT, anchor="end", ls=6))
+    p.append(_t(R, 1330, "20 MODULES / 4 TIERS", MONO, 28, ACCENT, anchor="end", ls=6))
     p.append(f'<line x1="{L}" y1="1360" x2="{R}" y2="1360" stroke="{DOTS}" stroke-width="2"/>')
 
     # --- hero: 20-module continuous circuit snaking flow --------------------
@@ -202,23 +202,24 @@ def build():
     )
     p.append(_t(cap_x, ly + n + 44, "Full TinyGPT Architecture · MLPerf Benchmark Olympics", SANS, 25, TEXT_C))
 
-    # Tier V: Extensions
-    ext_label_x = cap_x + cap_w + 120
-    p.append(_t(ext_label_x, ly + 58, "V", SERIF, 72, ACCENT, weight="bold"))
-    p.append(_t(ext_label_x, ly + 106, "EXTENSIONS", SANS, 32, TITLE_C, weight="bold", ls=4))
-    p.append(_t(ext_label_x, ly + 144, "MODULE 21", MONO, 24, TEXT_C, ls=2))
-
-    ext_x, ext_w = ext_label_x + 300, 420
-    p.append(f'<rect x="{ext_x}" y="{ly}" width="{ext_w}" height="{n}" rx="8" fill="{BOX_BG}" stroke="{BOX_BORDER}" stroke-width="2.5"/>')
-    p.append(
-        f'<text x="{ext_x + ext_w/2}" y="{ly + n/2 + 18}" text-anchor="middle" xml:space="preserve">'
-        f'<tspan font-family="{MONO}" font-size="42" font-weight="bold" fill="{BOX_TEXT}">21  </tspan>'
-        f'<tspan font-family="{SERIF}" font-size="56" font-weight="bold" fill="{BOX_TEXT}">Contrib</tspan>'
-        f'</text>'
-    )
-    p.append(_t(ext_x, ly + n + 44, "Native Hardware &amp; Systems Ecosystem Labs", SANS, 25, TEXT_C))
-
-    p.append(f'<line x1="{cap_x + cap_w}" y1="{ly + n/2}" x2="{ext_x - 12}" y2="{ly + n/2}" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    # Community Expansion Ports (Branching out from Capstone)
+    node_out_x = cap_x + cap_w
+    node_out_y = ly + n/2
+    
+    # Label for the branches
+    p.append(_t(node_out_x + 280, node_out_y - 120, "COMMUNITY LABS &amp; EXTENSIONS", SANS, 22, TITLE_C, weight="bold", anchor="middle", ls=2))
+    
+    # 1. Straight right
+    p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 100} {node_out_y}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    p.append(_t(node_out_x + 130, node_out_y + 8, "LoRA / PEFT", MONO, 26, ACCENT, weight="bold"))
+
+    # 2. Up and right
+    p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 40} {node_out_y} Q {node_out_x + 60} {node_out_y} {node_out_x + 60} {node_out_y - 30} L {node_out_x + 60} {node_out_y - 50} Q {node_out_x + 60} {node_out_y - 70} {node_out_x + 80} {node_out_y - 70} L {node_out_x + 100} {node_out_y - 70}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    p.append(_t(node_out_x + 130, node_out_y - 70 + 8, "Torch.Compile", MONO, 26, ACCENT, weight="bold"))
+
+    # 3. Down and right
+    p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 40} {node_out_y} Q {node_out_x + 60} {node_out_y} {node_out_x + 60} {node_out_y + 30} L {node_out_x + 60} {node_out_y + 50} Q {node_out_x + 60} {node_out_y + 70} {node_out_x + 80} {node_out_y + 70} L {node_out_x + 100} {node_out_y + 70}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    p.append(_t(node_out_x + 130, node_out_y + 70 + 8, "Distributed", MONO, 26, ACCENT, weight="bold"))
 
     # --- author -------------------------------------------------------------
     p.append(f'<rect x="{L}" y="2780" width="120" height="4" fill="{ACCENT}"/>')
```

#### Recent Merged Pull Requests:
- **PR #2140** (2026-09-22): Finalize milestone intros and educational philosophy (@profvjreddi)
- **PR #2139** (2026-09-21): build(deps): bump anyio from 4.14.1 to 4.14.2 in /mlperf-edu (@dependabot[bot])
- **PR #2138** (2026-09-20): build(deps): bump soupsieve from 2.8.4 to 2.9 (@dependabot[bot])
- **PR #2137** (2026-09-20): build(deps): bump sharp and wrangler in /staffml/app/worker (@dependabot[bot])
- **PR #2136** (2026-09-15): Fix invalid escape sequences in book tooling scripts (@MBK-fr)
- **PR #2135** (2026-09-15): fix(mlsysim): redesign §5 Paged Attention demo in KV-Cache tutorial (@kjlintong)
- **PR #2133** (2026-09-14): build(deps): bump brace-expansion in /staffml/app (@dependabot[bot])
- **PR #2132** (closed): build(deps): bump baseline-browser-mapping from 2.10.29 to 2.11.23 in /staffml/app (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

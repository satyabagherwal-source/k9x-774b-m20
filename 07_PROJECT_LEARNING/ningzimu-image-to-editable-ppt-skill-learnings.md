# Forensic Learning Record (Deep Inspection): ningzimu/image-to-editable-ppt-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/ningzimu-image-to-editable-ppt-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ningzimu/image-to-editable-ppt-skill](https://github.com/ningzimu/image-to-editable-ppt-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:07:18.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ningzimu/image-to-editable-ppt-skill`
- **Description**: Codex skill for converting slide images, PDFs, and image-based PPTX files into editable PowerPoint decks.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2779 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/deck_run_state.py`
```
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ACTIVE_PAGE_STATUSES = {"dispatched"}
DISPATCHABLE_PAGE_STATUSES = {"pending"}
DEFAULT_MAX_CONCURRENT_PAGES = 6


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_json(path, default=None):
    path = Path(path)
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value):
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def run_dir_from_target(target):
    path = Path(target).expanduser().resolve()
    if path.is_dir():
        return path
    if path.name == "deck_manifest.json":
        return path.parent
    raise ValueError(f"Expected run directory or deck_manifest.json: {target}")


def deck_manifest_path(run_dir):
    return Path(run_dir) / "deck_manifest.json"


def page_jobs_path(run_dir):
    return Path(run_dir) / "page_jobs.json"


def run_state_path(run_dir):
    return Path(run_dir) / "run_state.json"


def load_deck(run_dir):
    return read_json(deck_manifest_path(run_dir))


def save_deck(run_dir, deck):
    write_json(deck_manifest_path(run_dir), deck)


def load_jobs(run_dir):
    return read_json(page_jobs_path(run_dir))


def save_jobs(run_dir, jobs):
    write_json(page_jobs_path(run_dir), jobs)


def load_run_state(run_dir):
    return read_json(run_state_path(run_dir), default={"status": "created", "history": []})


def save_run_state(run_dir, state):
    write_json(run_state_path(run_dir), state)


def set_run_status(run_dir, status, note=None):
    state = load_run_state(run_dir)
    if state.get("status") != status:
        state.setdefault("history", []).append(
            {"from": state.get("status"), "to": status, "at": now_iso(), "note": note}
        )
    state["status"] = status
    state["updated_at"] = now_iso()
    save_run_state(run_dir, state)
    return state


def normalize_page_id(value):
    text = str(value).strip()
    if text.startswith("page_"):
        return text
    if text.isdigit():
        return f"page_{int(text):03d}"
    raise ValueError(f"Invalid page id: {value}")


def find_page(jobs, page):
    page_id = normalize_page_id(page)
    for entry in jobs.get("pages", []):
        if entry.get("page_id") == page_id or entry.get("id") == page_id:
            return entry
    raise KeyError(f"Page not found in page_jobs.json: {page_id}")


def resolve_run_path(run_dir, value):
    path = Path(value)
    if path.is_absolute():
        return path.resolve()
    return (Path(run_dir) / path).resolve()


def rel_to_run(run_dir, value):
    path = Path(value).resolve()
    return path.relative_to(Path(run_dir).resolve()).as_posix()


def resolve_inside(base_dir, value):
    base = Path(base_dir).resolve()
    path = Path(value)
    if not path.is_absolute():
        path = base / path
    path = path.resolve()
    try:
        path.relative_to(base)
    except ValueError as exc:
        raise ValueError(f"Path is outside allowed directory: {path}") from exc
    return path


def all_pages_have_status(jobs, statuses):
    allowed = set(statuses)
    return all(page.get("status") in allowed for page in jobs.get("pages", []))


def max_concurrent_pages(jobs):
    value = jobs.get("max_concurrent_pages", DEFAULT_MAX_CONCURRENT_PAGES)
    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid max_concurrent_pages: {value}") from exc
    if value < 1:
        raise ValueError("max_concurrent_pages must be >= 1")
    return value


def active_pages(jobs):
    return [page for page in jobs.get("pages", []) if page.get("status") in ACTIVE_PAGE_STATUSES]


def dispatchable_pages(jobs):
    return [
        page
        for page in jobs.get("pages", [])
        if page.get("status") in DISPATCHABLE_PAGE_STATUSES
    ]


def dispatch_slots_available(jobs):
    return max(0, max_concurrent_pages(jobs) - len(active_pages(jobs)))


def update_jobs_run_status(jobs):
    pages = jobs.get("pages", [])
    if pages and all(page.get("status") in {"dispatched", "recorded", "accepted"} for page in pages):
        jobs["run_status"] = "pages_dispatched"
    if pages and all(page.get("status") in {"recorded", "accepted"} for page in pages):
        jobs["run_status"] = "pages_recorded"
    if pages and all(page.get("status") == "accepted" for page in pages):
        jobs["run_status"] = "complete"
    jobs["updated_at"] = now_iso()


def inside_or_missing(page_dir, value):
    path = resolve_inside(page_dir, value)
    if not path.exists():
        raise FileNotFoundError(path)
    return path


def safe_agent_label(agent_id, nickname=None):
    label = str(agent_id).strip()
    if nickname:
        label += f" ({nickname})"
    return label


def page_dir_for(run_dir, page):
    return resolve_run_path(run_dir, page["page_dir"])


def ensure_file(path, label):
    path = Path(path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Missing {label}: {path}")
    return path


def ensure_dir(path, label):
    path = Path(path)
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"Missing {label}: {path}")
    return path

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/formula_renderer.py`
```
#!/usr/bin/env python3
"""Render LaTeX formulas into image assets for page manifests."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


DEFAULT_ENGINE_CANDIDATES = ("xelatex", "lualatex", "pdflatex")
DEFAULT_TIMEOUT = 120
DEFAULT_DPI = 300
SUPPORTED_FORMATS = {"svg", "png", "pdf"}


class FormulaRenderError(RuntimeError):
    pass


def select_latex_engine(engine: str | None = None) -> str:
    if engine and engine != "auto":
        resolved = shutil.which(engine)
        if not resolved:
            raise FormulaRenderError(f"LaTeX engine not found: {engine}")
        return resolved
    for candidate in DEFAULT_ENGINE_CANDIDATES:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FormulaRenderError(
        "No LaTeX engine found. Install a TeX distribution that provides xelatex, lualatex, or pdflatex."
    )


def render_latex_asset(
    *,
    tex: str,
    out: str | Path,
    page_dir: str | Path | None = None,
    output_format: str | None = None,
    engine: str | None = None,
    preamble: str = "",
    full_document: bool = False,
    display: bool = True,
    dpi: int = DEFAULT_DPI,
    timeout: int = DEFAULT_TIMEOUT,
    shell_escape: bool = False,
    keep_workdir: str | Path | None = None,
) -> dict[str, Any]:
    if not tex.strip():
        raise FormulaRenderError("LaTeX input is empty.")
    out_path = resolve_output_path(out, page_dir)
    fmt = normalise_format(output_format, out_path)
    source_tex = out_path.with_suffix(".tex")
    source_tex.parent.mkdir(parents=True, exist_ok=True)
    document = build_latex_document(tex, preamble=preamble, full_document=full_document, display=display)
    source_tex.write_text(document, encoding="utf-8")

    resolved_engine = select_latex_engine(engine)
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        work_tex = workdir / "formula.tex"
        work_tex.write_text(document, encoding="utf-8")
        command = [
            resolved_engine,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
        ]
        if shell_escape:
            command.append("-shell-escape")
        command.append(work_tex.name)
        result = subprocess.run(
            command,
            cwd=workdir,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            _maybe_keep_workdir(workdir, keep_workdir)
            raise FormulaRenderError(_latex_error_message(result))
        pdf = workdir / "formula.pdf"
        if not pdf.exists():
            _maybe_keep_workdir(workdir, keep_workdir)
            raise FormulaRenderError("LaTeX completed but formula.pdf was not produced.")
        converter = convert_pdf(pdf, out_path, fmt, dpi=dpi, timeout=timeout)
        _maybe_keep_workdir(workdir, keep_workdir)
    return {
        "out": str(out_path),
        "format": fmt,
        "tex_source": str(source_tex),
        "engine": Path(resolved_engine).name,
        "converter": converter,
    }


def build_latex_document(tex: str, *, preamble: str = "", full_document: bool = False, display: bool = True) -> str:
    if full_document:
        return tex if tex.endswith("\n") else tex + "\n"
    body = tex.strip()
    if display:
        body = "\\[\n" + body + "\n\\]"
    else:
        body = "$" + body + "$"
    return (
        "\\documentclass[border=2pt]{standalone}\n"
        "\\usepackage{amsmath,amssymb,mathtools,bm}\n"
        "\\usepackage{xcolor}\n"
        f"{preamble.strip()}\n"
        "\\begin{document}\n"
        f"{body}\n"
        "\\end{document}\n"
    )


def convert_pdf(pdf: Path, out_path: Path, fmt: str, *, dpi: int, timeout: int) -> str:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "pdf":
        shutil.copy2(pdf, out_path)
        return "copy-pdf"
    if fmt == "svg":
        dvisvgm = shutil.which("dvisvgm")
        if dvisvgm:
            command = [dvisvgm, "--pdf", "--no-fonts", "--exact", "--output", str(out_path), str(pdf)]
            _run_converter(command, timeout)
            return "dvisvgm"
        pdf2svg = shutil.which("pdf2svg")
        if pdf2svg:
            command = [pdf2svg, str(pdf), str(out_path)]
            _run_converter(command, timeout)
            return "pdf2svg"
        raise FormulaRenderError("SVG output requires dvisvgm or pdf2svg.")
    if fmt == "png":
        magick = shutil.which("magick") or shutil.which("convert")
        if not magick:
            raise FormulaRenderError("PNG output requires ImageMagick (`magick` or `convert`).")
        command = [magick, "-density", str(dpi), str(pdf), "-trim", "+repage", str(out_path)]
        _run_converter(command, timeout)
        return Path(magick).name
    raise FormulaRenderError(f"Unsupported formula output format: {fmt}")


def formula_image_fragment(
    *,
    formula_id: str,
    image_path: str | Path,
    tex_source: str | Path,
    box_px: str | list[Any],
    page_dir: str | Path | None = None,
    z_index: int = 220,
    alt: str | None = None,
) -> dict[str, Any]:
    path_for_manifest = manifest_path(image_path, page_dir)
    tex_for_manifest = manifest_path(tex_source, page_dir)
    return {
        "schema_version": 1,
        "type": "latex-formula-image-fragment",
        "images": [
            {
                "id": formula_id,
                "path": path_for_manifest,
                "box_px": parse_box_px(box_px),
                "alt": alt or f"LaTeX rendered formula {formula_id}",
                "z_index": z_index,
            }
        ],
        "asset_provenance": [
            {
                "path": path_for_manifest,
                "source": tex_for_manifest,
                "source_type": "latex-rendered-formula",
                "provenance_note": "Rendered from LaTeX by editppt formula render-latex; visual fidelity is prioritized over formula editability.",
            }
        ],
        "formula_inventory": [
            {
                "id": formula_id,
                "decision": "latex-rendered-image",
                "editable": False,
                "image": path_for_manifest,
                "tex_source": tex_for_manifest,
            }
        ],
    }


def write_json(payload: dict[str, Any], path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_output_path(out: str | Path, page_dir: str | Path | None = None) -> Path:
    path = Path(out)
    if not path.is_absolute() and page_dir:
        path = Path(page_dir) / path
    return path.resolve()


def normalise_format(output_format: str | None, out_path: Path) -> str:
    fmt = (output_format or out_path.suffix.lstrip(".") or "svg").lower()
    if fmt == "jpg":
        fmt = "jpeg"
    if fmt not in SUPPORTED_FORMATS:
        raise FormulaRenderError(f"Unsupported formula output format: {fmt}. Use svg, png, or pdf.")
    return fmt


def parse_box_px(value: str | list[Any]) -> list[float]:
    parts = [part.strip() for part in value.split(",")] if isinstance(value, str) else list(value)
    if len(parts) != 4:
        raise FormulaRenderError("box_px must be x,y,width,height")
    return [float(part) for part in parts]


def manifest_path(path: str | Path, page_dir: str | Path | None = None) -> str:
    resolved = Path(path).resolve()
    if page_dir:
        root = Path(page_dir).resolve()
        try:
            return resolved.relative_to(root).as_posix()
        except ValueError:
            pass
    return resolved.as_posix()


def _run_converter(command: list[str], timeout: int) -> None:
    result = subprocess.run(command, text=True, capture_output=True, timeout=timeout)
    if result.returncode != 0:
        raise FormulaRenderError(
            "Formula conversion failed: "
            + " ".join(command)
            + "\n"
            + "\n".join((result.stderr or result.stdout or "").splitlines()[-20:])
        )


def _latex_error_message(result: subprocess.CompletedProcess[str]) -> str:
    log = result.stdout or result.stderr or ""
    tail = "\n".join(log.splitlines()[-30:])
    return f"LaTeX render failed with exit code {result.returncode}.\n{tail}"


def _maybe_keep_workdir(workdir: Path, keep_workdir: str | Path | None) -> None:
    if not keep_workdir:
        return
    target = Path(keep_workdir)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(workdir, target)

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/__init__.py`
```
__version__ = "0.1.0"


```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/cli.py`
```
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


def main() -> None:
    command_name = Path(sys.argv[0]).name or "editppt"
    if command_name in {"cli.py", "__main__.py"}:
        command_name = "editppt"
    runtime_dir = Path(__file__).resolve().parent / "runtime"
    script = runtime_dir / "main.py"
    if not script.exists():
        raise RuntimeError(f"runtime entrypoint not found: {script}")

    os.environ.setdefault("IMAGE_TO_EDITABLE_PPT_CLI_PROG", command_name)
    sys.path.insert(0, str(runtime_dir))
    sys.argv = [command_name, *sys.argv[1:]]
    runpy.run_path(str(script), run_name="__main__")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/__init__.py`
```
"""Deterministic runtime modules behind the public editppt CLI."""

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/_input_normalization.py`
```
import hashlib
import io
import json
import posixpath
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image


IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}
PPT_EXTS = {".ppt", ".pptx"}
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": REL_NS,
}


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def collect_paragraph_text(root):
    paragraphs = []
    for paragraph in root.findall(".//a:p", NS):
        text = "".join(node.text or "" for node in paragraph.findall(".//a:t", NS))
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def copy_input(src, input_dir):
    src = Path(src).resolve()
    dest = input_dir / src.name
    counter = 2
    while dest.exists() and dest.resolve() != src:
        dest = input_dir / f"{src.stem}-{counter}{src.suffix}"
        counter += 1
    if src != dest:
        shutil.copy2(src, dest)
    return dest


def save_image_page(src, page_dir):
    page_dir.mkdir(parents=True, exist_ok=True)
    out = page_dir / "source.png"
    with Image.open(src) as image:
        image.convert("RGB").save(out)
    return out


def render_pdf_pages(pdf_path, pages_dir, dpi):
    import fitz

    doc = fitz.open(pdf_path)
    outputs = []
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    for index, page in enumerate(doc, start=1):
        page_dir = pages_dir / f"page_{index:03d}"
        page_dir.mkdir(parents=True, exist_ok=True)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out = page_dir / "source.png"
        pix.save(out)
        outputs.append(out)
    return outputs


def rel_source_part(rels_name):
    directory = posixpath.dirname(rels_name)
    if directory.endswith("/_rels"):
        directory = posixpath.dirname(directory)
    source = posixpath.basename(rels_name)[:-5]
    return posixpath.normpath(posixpath.join(directory, source))


def resolve_target(rels_name, target):
    source = rel_source_part(rels_name)
    return posixpath.normpath(posixpath.join(posixpath.dirname(source), target))


def collect_notes_from_pptx(pptx_path, notes_dir=None):
    notes = []
    if notes_dir:
        notes_dir = Path(notes_dir)
    with zipfile.ZipFile(pptx_path) as z:
        names = set(z.namelist())
        if "ppt/presentation.xml" not in names or "ppt/_rels/presentation.xml.rels" not in names:
            return notes
        pres = ET.fromstring(z.read("ppt/presentation.xml"))
        pres_rels = ET.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
        rels_by_id = {rel.attrib.get("Id"): rel.attrib.get("Target") for rel in pres_rels.findall("rel:Relationship", NS)}
        slide_parts = []
        for sld_id in pres.findall(".//p:sldId", NS):
            rel_id = sld_id.attrib.get(f"{{{NS['r']}}}id")
            target = rels_by_id.get(rel_id)
            if target:
                slide_parts.append(posixpath.normpath(posixpath.join("ppt", target)))
        for page_index, slide_part in enumerate(slide_parts, start=1):
            rels_name = f"{posixpath.dirname(slide_part)}/_rels/{posixpath.basename(slide_part)}.rels"
            note = {"page_index": page_index, "text": "", "text_sha256": sha256_text(""), "source_slide": slide_part}
            if rels_name in names:
                root = ET.fromstring(z.read(rels_name))
                for rel in root.findall("rel:Relationship", NS):
                    if rel.attrib.get("Type", "").endswith("/notesSlide"):
                        notes_part = resolve_target(rels_name, rel.attrib.get("Target", ""))
                        if notes_part in names:
                            notes_bytes = z.read(notes_part)
                            notes_root = ET.fromstring(notes_bytes)
                            text = collect_paragraph_text(notes_root)
                            update = {
                                "text": text,
                                "text_sha256": sha256_text(text),
                                "source_notes_part": notes_part,
                            }
                            if notes_dir:
                                out_dir = notes_dir / f"page_{page_index:03d}"
                                out_dir.mkdir(parents=True, exist_ok=True)
                                notes_xml = out_dir / "notesSlide.xml"
                                notes_xml.write_bytes(notes_bytes)
                                update["notes_xml"] = str(notes_xml)
                            note.update(update)
            if note["text"]:
                notes.append(note)
    return notes


def slide_parts_from_pptx(zip_file):
    names = set(zip_file.namelist())
    if "ppt/presentation.xml" not in names or "ppt/_rels/presentation.xml.rels" not in names:
        raise ValueError("PPTX is missing presentation relationships.")
    pres = ET.fromstring(zip_file.read("ppt/presentation.xml"))
    pres_rels = ET.fromstring(zip_file.read("ppt/_rels/presentation.xml.rels"))
    rels_by_id = {rel.attrib.get("Id"): rel.attrib.get("Target") for rel in pres_rels.findall("rel:Relationship", NS)}
    slide_parts = []
    for sld_id in pres.findall(".//p:sldId", NS):
        rel_id = sld_id.attrib.get(f"{{{NS['r']}}}id")
        target = rels_by_id.get(rel_id)
        if target:
            slide_parts.append(posixpath.normpath(posixpath.join("ppt", target)))
    if not slide_parts:
        raise ValueError("PPTX has no slides.")
    return slide_parts


def slide_size_from_pptx(zip_file):
    pres = ET.fromstring(zip_file.read("ppt/presentation.xml"))
    size = pres.find(".//p:sldSz", NS)
    if size is None:
        raise ValueError("PPTX is missing slide size.")
    return int(size.attrib["cx"]), int(size.attrib["cy"])


def slide_relationships(zip_file, slide_part):
    rels_name = f"{posixpath.dirname(slide_part)}/_rels/{posixpath.basename(slide_part)}.rels"
    if rels_name not in zip_file.namelist():
        return {}
    root = ET.fromstring(zip_file.read(rels_name))
    return {rel.attrib.get("Id"): rel for rel in root.findall("rel:Relationship", NS)}


def full_slide_picture_target(zip_file, slide_part, slide_cx, slide_cy):
    slide_root = ET.fromstring(zip_file.read(slide_part))
    if collect_paragraph_text(slide_root):
        raise ValueError(f"{slide_part} contains native text and is not an image-based slide.")
    pictures = slide_root.findall(".//p:pic", NS)
    if len(pictures) != 1:
        raise ValueError(f"{slide_part} must contain exactly one full-slide picture; found {len(pictures)}.")
    picture = pictures[0]
    blip = picture.find(".//a:blip", NS)
    if blip is None:
        raise ValueError(f"{slide_part} picture has no embedded image.")
    rel_id = blip.attrib.get(f"{{{NS['r']}}}embed")
    relationships = slide_relationships(zip_file, slide_part)
    rel = relationships.get(rel_id)
    if rel is None or not rel.attrib.get("Type", "").endswith("/image"):
        raise ValueError(f"{slide_part} picture relationship is not an embedded image.")

    off = picture.find(".//a:xfrm/a:off", NS)
    ext = picture.find(".//a:xfrm/a:ext", NS)
    if off is None or ext is None:
        raise ValueError(f"{slide_part} picture has no placement transform.")
    x, y = int(off.attrib.get("x", 0)), int(off.attrib.get("y", 0))
    cx, cy = int(ext.attrib.get("cx", 0)), int(ext.attrib.get("cy", 0))
    tolerance = 2
    if abs(x) > tolerance or abs(y) > tolerance or abs(cx - slide_cx) > tolerance or abs(cy - slide_cy) > tolerance:
        raise ValueError(f"{slide_part} picture is not full-slide.")

    return resolve_target(f"{posixpath.dirname(slide_part)}/_rels/{posixpath.basename(slide_part)}.rels", rel.attrib["Target"])


def extract_image_based_pptx_pages(pptx_path, pages_dir):
    outputs = []
    with zipfile.ZipFile(pptx_path) as z:
        names = set(z.namelist())
        slide_cx, slide_cy = slide_size_from_pptx(z)
        for index, slide_part in enumerate(slide_parts_from_pptx(z), start=1):
            image_part = full_slide_picture_target(z, slide_part, slide_cx, slide_cy)
            if image_part not in names:
                raise ValueError(f"{slide_part} references missing image part: {image_part}")
            page_dir = pages_dir / f"page_{index:03d}"
            page_dir.mkdir(parents=True, exist_ok=True)
            out = page_dir / "source.png"
            with Image.open(io.BytesIO(z.read(image_part))) as image:
                image.convert("RGB").save(out)
            outputs.append(out)
    return outputs


def find_soffice():
    return shutil.which("soffice") or shutil.which("libreoffice")


def convert_office_to_pdf(input_path, out_dir):
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError("No local Office converter is available for this input.")
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(input_path)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    pdfs = sorted(out_dir.glob("*.pdf"))
    if not pdfs:
        raise RuntimeError(f"Office conversion did not produce a PDF in {out_dir}")
    return pdfs[0]


def convert_ppt_to_pptx(input_path, out_dir):
    if input_path.suffix.lower() == ".pptx":
        return input_path
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError("No local Office converter is available to normalize .ppt input.")
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [soffice, "--headless", "--convert-to", "pptx", 
```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/_page_artifacts.py`
```
import json
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def run(command):
    print("+ " + " ".join(str(part) for part in command), flush=True)
    subprocess.run([str(part) for part in command], check=True)


def resolve_under_page(page_dir, value):
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return page_dir / path


def imagegen_chroma_helper():
    helper = SCRIPT_DIR / "remove_chroma_key.py"
    if not helper.exists():
        raise SystemExit(f"Missing chroma helper: {helper}")
    return helper


def process_asset_sheet(args, page_dir):
    chroma = resolve_under_page(page_dir, args.chroma)
    alpha = resolve_under_page(page_dir, args.alpha)
    if not args.asset_sheet_source and not chroma.exists() and not alpha.exists():
        return

    from PIL import Image

    source = resolve_under_page(page_dir, args.asset_sheet_source) if args.asset_sheet_source else (
        alpha if args.skip_chroma else chroma
    )
    if not source.exists():
        raise SystemExit(f"Asset sheet source does not exist: {source}")
    with Image.open(source) as image:
        extrema = image.convert("RGBA").getchannel("A").getextrema()
    has_alpha = extrema[0] == 0 and extrema[1] > 0
    if extrema[1] == 0:
        raise SystemExit("Asset sheet is fully transparent and contains no foreground")
    if args.skip_chroma and not has_alpha:
        raise SystemExit("--skip-chroma requires real transparent background and nonempty foreground")

    same_alpha = source.resolve() == alpha.resolve()
    if alpha.exists() and not args.force_chroma and not (same_alpha and args.skip_chroma):
        raise SystemExit(f"Output already exists: {alpha} (use --force-chroma to overwrite)")

    if has_alpha:
        alpha.parent.mkdir(parents=True, exist_ok=True)
        if not same_alpha:
            shutil.copy2(source, alpha)
        print(f"Using original alpha: {alpha}")
    else:
        if source.resolve() != chroma.resolve():
            chroma.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, chroma)
        command = [
            sys.executable, imagegen_chroma_helper(), "--input", chroma,
            "--out", alpha, "--auto-key", "border", "--soft-matte",
            "--transparent-threshold", args.transparent_threshold,
            "--opaque-threshold", args.opaque_threshold,
        ]
        if args.despill:
            command.append("--despill")
        if args.force_chroma:
            command.append("--force")
        run(command)

    if args.skip_split:
        return
    if not alpha.exists():
        raise SystemExit(f"Alpha sheet does not exist: {alpha}")

    command = [
        sys.executable,
        SCRIPT_DIR / "split_alpha_components.py",
        "--input",
        alpha,
        "--out-dir",
        resolve_under_page(page_dir, args.assets_dir),
        "--sort",
        args.split_sort,
        "--min-area",
        args.split_min_area,
        "--merge-gap",
        args.split_merge_gap,
        "--merge-union-growth",
        args.split_merge_union_growth,
        "--manifest",
        resolve_under_page(page_dir, args.split_manifest),
    ]
    if getattr(args, "regions", None):
        command.extend(["--regions", resolve_under_page(page_dir, args.regions)])
    if args.square_assets:
        command.append("--square")
    if args.asset_names:
        command.extend(["--names", args.asset_names])
    run(command)


def fit_image(image, size):
    if image.size == size:
        return image
    return image.resize(size)


def write_pair(source_path, preview_path, out_path):
    from PIL import Image, ImageDraw

    source = Image.open(source_path).convert("RGB")
    rebuilt = Image.open(preview_path).convert("RGB")
    source = fit_image(source, rebuilt.size)

    label_h = 32
    gap = 18
    width, height = rebuilt.size
    canvas = Image.new("RGB", (width * 2 + gap, height + label_h), "#f5f7fb")
    canvas.paste(source, (0, label_h))
    canvas.paste(rebuilt, (width + gap, label_h))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 9), "origin", fill="black")
    draw.text((width + gap + 10, 9), "preview", fill="black")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)
    print(f"Wrote {out_path}")

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/configure_image_backend.py`
```
#!/usr/bin/env python3
import argparse
import json

from deck_run_state import load_deck, load_jobs, read_json, run_dir_from_target, save_deck, write_json


def backend_contract(args):
    is_builtin = args.backend_id == "builtin-imagegen"
    requires_api_key = args.backend_id == "openai-compatible-api"
    contract = {
        "backend_id": args.backend_id,
        "tool_name": args.tool_name,
        "tool_call": args.tool_call,
        "fallback_command": args.fallback_command,
        "runtime_home": args.runtime_home,
        "model": None if is_builtin else args.model,
        "requires_openai_api_key": requires_api_key,
        "mode_policy": "generate-or-edit-per-asset",
        "chroma_key_helper": "editppt image process-sheet",
        "input_context_policy": args.input_context_policy,
        "save_path_policy": (
            "accept only an explicit output_hint or local path returned by image_gen.imagegen, verify it exists, "
            "import the selected output, and never scan for the newest file"
            if is_builtin
            else "write outputs directly to page dir or copy selected outputs before manifest references them"
        ),
        "handoff_rule": (
            "call image_gen.imagegen serially, then import the selected local output; "
            "use editppt image generate/edit only when the built-in tool fallback policy applies"
            if is_builtin
            else "call editppt image generate/edit serially; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second"
        ),
    }
    if is_builtin:
        contract.update(
            {
                "fallback_order": ["codex-oauth", "openai-compatible-api"],
                "required_parameters": {
                    "generate": ["prompt"],
                    "edit": ["prompt", "referenced_image_paths"],
                },
                "fallback_policy": {
                    "on": [
                        "tool-unavailable",
                        "tool-error",
                        "input-unreadable",
                        "no-valid-local-output",
                    ],
                    "missing_optional_parameters": False,
                },
            }
        )
    return contract


def main():
    parser = argparse.ArgumentParser(description="Record the run-level image backend contract.")
    parser.add_argument("run")
    parser.add_argument(
        "--backend-id",
        default="editppt-image-cli",
        choices=["builtin-imagegen", "editppt-image-cli", "openai-compatible-api"],
    )
    parser.add_argument("--tool-name")
    parser.add_argument("--tool-call")
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--fallback-command")
    parser.add_argument("--runtime-home", default="~/.editppt")
    parser.add_argument("--input-context-policy")
    args = parser.parse_args()

    if args.backend_id == "builtin-imagegen":
        fixed_field_overrides = [
            flag
            for flag, value in (
                ("--tool-name", args.tool_name),
                ("--tool-call", args.tool_call),
                ("--fallback-command", args.fallback_command),
                ("--input-context-policy", args.input_context_policy),
            )
            if value is not None
        ]
        if fixed_field_overrides:
            parser.error(
                f"{', '.join(fixed_field_overrides)} cannot override the fixed builtin-imagegen contract"
            )
        args.tool_name = "image_gen.imagegen"
        args.tool_call = "image_gen.imagegen"
        args.fallback_command = "editppt image generate/edit"
        args.input_context_policy = (
            "generation needs prompt; for editing inspect every local input with view_image first, then pass "
            "prompt plus absolute local paths in referenced_image_paths"
        )
    else:
        if args.tool_name is None:
            args.tool_name = "editppt image"
        if args.tool_call is None:
            args.tool_call = "editppt image generate/edit"
        if args.fallback_command is None:
            args.fallback_command = "editppt image"
        if args.input_context_policy is None:
            args.input_context_policy = "pass edit targets and strict visual references via editppt image edit --image"

    run_dir = run_dir_from_target(args.run)
    deck = load_deck(run_dir)
    contract = backend_contract(args)
    deck["image_backend"] = contract
    save_deck(run_dir, deck)

    jobs = load_jobs(run_dir)
    for page in jobs.get("pages", []):
        request_path = run_dir / page["page_request"]
        request = read_json(request_path)
        request["image_backend"] = contract
        write_json(request_path, request)
    print(json.dumps({"image_backend": contract}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/deck_text_hints.py`
```
#!/usr/bin/env python3
"""Generate text hints for every page of a prepared run.

Runs as part of `editppt prepare`, after page directories exist: each
`pages/page_NNN/` receives canonical `text_hints.json` and `text_hints.png`
files so page workers find their text measurements already in place.

Backend selection per run:
- With a PaddleOCR token (PADDLE_OCR_TOKEN env var, or PADDLE_OCR_TOKEN in
  ~/.editppt/config.yaml): PDF inputs are submitted to the OCR service as ONE
  job covering all pages; image/PPTX inputs submit each page's source.png.
  OCR coordinates are rescaled to each page's actual source.png resolution
  and re-measured locally with the ink metrics.
- Without a token, or when the service fails: the built-in offline detector
  (`text_hints.py`) runs per page, so every page still gets hints.

Hint generation is best-effort: a page that fails is reported and skipped,
and the page worker can regenerate with `editppt page hints <page_dir>`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image

from deck_run_state import load_deck, load_jobs, page_dir_for, run_dir_from_target
from text_hints import draw_overlay, page_text_hints

HINTS_JSON = "text_hints.json"
HINTS_PNG = "text_hints.png"


def paddle_token() -> str:
    token = os.environ.get("PADDLE_OCR_TOKEN", "").strip()
    if token:
        return token
    try:
        from runtime_env import config_path, read_config_file

        return str(read_config_file(config_path()).get("PADDLE_OCR_TOKEN", "")).strip()
    except Exception:
        return ""


def write_hints(page_dir: Path, hints: dict, overlay: bool) -> None:
    (page_dir / HINTS_JSON).write_text(json.dumps(hints, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if overlay:
        draw_overlay(Image.open(page_dir / "source.png"), hints["lines"], page_dir / HINTS_PNG)


def builtin_page(page_dir: Path) -> dict:
    hints = page_text_hints(page_dir)
    hints["backend"] = "builtin-ink"
    return hints


def synthesize_pdf(page_dirs: list[Path], out_path: Path) -> None:
    """Bundle the per-page source images into one PDF (one page per image).

    Lets every input type — single image, multiple images, image-based PPTX —
    reach the OCR service as a single batch job instead of one job per page.
    Page size is the image's pixel size in points; build_page_hints rescales
    the OCR coordinates back to each source.png regardless of the resolution
    the service rendered at.
    """
    import fitz

    document = fitz.open()
    for page_dir in page_dirs:
        with Image.open(page_dir / "source.png") as image:
            width, height = image.size
        page = document.new_page(width=width, height=height)
        page.insert_image(fitz.Rect(0, 0, width, height), filename=str(page_dir / "source.png"))
    document.save(out_path)
    document.close()


def paddle_pages(run_dir: Path, deck: dict, page_dirs: list[Path], token: str, timeout: int) -> dict[Path, dict]:
    """Fetch OCR results for all pages in ONE job; returns {page_dir: hints}."""
    import tempfile

    from paddle_text_hints import DEFAULT_MODEL, build_page_hints, submit_and_fetch

    original = None
    if str(deck.get("input_type", "")) == "pdf":
        input_dir = run_dir / "input"
        candidates = sorted(input_dir.glob("*.pdf")) if input_dir.exists() else []
        original = candidates[0] if candidates else None

    synthesized = None
    try:
        if original is None:
            handle = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
            handle.close()
            synthesized = Path(handle.name)
            synthesize_pdf(page_dirs, synthesized)
            original = synthesized
        pages = submit_and_fetch(original, token, DEFAULT_MODEL, timeout)
    finally:
        if synthesized is not None:
            synthesized.unlink(missing_ok=True)
    if len(pages) != len(page_dirs):
        raise RuntimeError(f"OCR returned {len(pages)} pages for {len(page_dirs)} page dirs")
    return {page_dir: build_page_hints(page_dir, pruned) for page_dir, pruned in zip(page_dirs, pages)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate per-page text hints for a prepared run.")
    parser.add_argument("run", help="Run directory or deck_manifest.json path.")
    parser.add_argument("--timeout", type=int, default=300, help="OCR job timeout in seconds.")
    parser.add_argument("--no-overlay", action="store_true", help="Skip the labeled overlay images.")
    args = parser.parse_args()

    run_dir = run_dir_from_target(args.run)
    deck = load_deck(run_dir)
    jobs = load_jobs(run_dir)
    page_dirs = [page_dir_for(run_dir, page) for page in jobs.get("pages", [])]
    page_dirs = [d for d in page_dirs if (d / "source.png").exists()]
    if not page_dirs:
        print("text-hints: no pages with source.png; skipped", file=sys.stderr)
        return 0

    token = paddle_token()
    results: dict[Path, dict] = {}
    backend = "builtin-ink"
    if not token:
        print(
            "text-hints: no PaddleOCR token configured; falling back to the built-in offline "
            "detector (geometry only — it measures where text is and how large, but cannot read "
            "it). A free PaddleOCR-VL token adds recognized text content and cleaner block "
            "boundaries, noticeably improving text fidelity in the final PPT. The free personal quota "
            "is currently more than enough for this skill, so applying is risk-free with no extra "
            "cost. ASK THE USER once "
            "before reconstructing pages: configure a token now (apply at "
            "https://aistudio.baidu.com/account/accessToken, then `editppt config "
            "--paddle-ocr-token <token>` and `editppt run hints <run>` to regenerate this run's "
            "hints), or continue with the offline result. Respect their choice and do not ask again.",
            file=sys.stderr,
        )
    if token:
        try:
            results = paddle_pages(run_dir, deck, page_dirs, token, args.timeout)
            backend = "paddleocr-vl"
        except Exception as exc:
            print(f"text-hints: PaddleOCR failed ({exc}); falling back to built-in detector", file=sys.stderr)
            results = {}

    written = 0
    for page_dir in page_dirs:
        try:
            hints = results.get(page_dir) or builtin_page(page_dir)
            # Dense diagrams can defeat the OCR layout model entirely (the
            # whole figure is classified as an image and only a headline
            # survives). When OCR found almost nothing but the offline
            # detector finds plenty, the geometric hints are more useful.
            if hints.get("backend") == "paddleocr-vl" and len(hints["lines"]) <= 2:
                offline = builtin_page(page_dir)
                if len(offline["lines"]) >= 6:
                    print(
                        f"text-hints: {page_dir.name}: OCR found {len(hints['lines'])} text lines but the "
                        f"offline detector found {len(offline['lines'])}; using the offline result for this page",
                        file=sys.stderr,
                    )
                    hints = offline
            write_hints(page_dir, hints, overlay=not args.no_overlay)
            written += 1
        except Exception as exc:
            print(f"text-hints: {page_dir.name} failed ({exc}); worker can run `editppt page hints` itself", file=sys.stderr)
    print(f"text-hints: wrote {written}/{len(page_dirs)} pages (backend={backend})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/finalize_deck_run.py`
```
#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path

from deck_run_state import load_deck, load_jobs, now_iso, run_dir_from_target, save_deck, save_jobs, set_run_status, sha256_file, write_json


SCRIPT_DIR = Path(__file__).resolve().parent


def run(command):
    print("+ " + " ".join(str(part) for part in command), flush=True)
    subprocess.run([str(part) for part in command], check=True)


def final_output_path(run_dir, deck):
    output = Path(deck.get("output", "final/deck_edited.pptx"))
    if output.is_absolute():
        return output
    return run_dir / output


def assert_pages_ready(run_dir, jobs):
    problems = []
    for page in jobs.get("pages", []):
        if page.get("status") not in {"recorded", "accepted"}:
            problems.append(f"{page['page_id']} status={page.get('status')}")
            continue
        result = page.get("result") or {}
        if result.get("validation_passed") is not True:
            problems.append(f"{page['page_id']} validation_passed={result.get('validation_passed')}")
        outputs = result.get("outputs") or {}
        hashes = result.get("hashes") or {}
        if not outputs or set(outputs) != set(hashes):
            problems.append(f"{page['page_id']} missing recorded output hashes; validate and record the page again")
            continue
        files = [(outputs[key], digest) for key, digest in hashes.items()]
        files.extend((result.get("asset_hashes") or {}).items())
        for relative_path, expected_hash in files:
            path = Path(run_dir) / relative_path
            if not path.is_file() or sha256_file(path) != expected_hash:
                problems.append(
                    f"{page['page_id']} recorded artifact changed or missing: {relative_path}; "
                    "repair affected outputs, validate and record the page again"
                )
    if problems:
        raise SystemExit("Pages are not ready for finalize:\n" + "\n".join(problems))


def main():
    parser = argparse.ArgumentParser(description="Build and validate the final editable PPTX from recorded pages.")
    parser.add_argument("run", help="Run directory or deck_manifest.json")
    args = parser.parse_args()

    run_dir = run_dir_from_target(args.run)
    deck = load_deck(run_dir)
    jobs = load_jobs(run_dir)
    assert_pages_ready(run_dir, jobs)

    out = final_output_path(run_dir, deck)
    out.parent.mkdir(parents=True, exist_ok=True)
    run([sys.executable, SCRIPT_DIR / "build_pptx_from_manifest.py", "--deck-manifest", run_dir / "deck_manifest.json", "--out", out])
    set_run_status(run_dir, "deck_built", "final pptx built")

    validation = out.parent / "validation.json"
    run([sys.executable, SCRIPT_DIR / "validate_pptx.py", out, "--deck-manifest", run_dir / "deck_manifest.json", "--report", validation])
    set_run_status(run_dir, "deck_validated", "final pptx validation passed")

    for page in jobs.get("pages", []):
        page["status"] = "accepted"
        page["accepted"] = True
        page["accepted_at"] = now_iso()
    jobs["run_status"] = "complete"
    jobs["updated_at"] = now_iso()
    save_jobs(run_dir, jobs)
    deck["completed_at"] = now_iso()
    save_deck(run_dir, deck)
    summary = {
        "schema_version": 1,
        "run_id": deck.get("run_id"),
        "status": "complete",
        "page_count": len(jobs.get("pages", [])),
        "output": str(out),
        "validation": str(validation),
        "completed_at": now_iso(),
    }
    write_json(out.parent / "run_summary.json", summary)
    set_run_status(run_dir, "complete", "final deck complete")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/image_gen.py`
```
#!/usr/bin/env python3
"""Unified CLI for image-to-editable-ppt image generation or editing.

The CLI prefers local Codex OAuth auth when ~/.codex/auth.json is available.
If Codex auth is missing, it falls back to OpenAI-compatible API credentials
from the environment or ~/.editppt/config.yaml.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
from pathlib import Path
import random
import re
import socket
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib import error, request

DEFAULT_MODEL = "gpt-image-2.5-sunburst"
DEFAULT_SIZE = "auto"
DEFAULT_QUALITY = "auto"
DEFAULT_BACKGROUND = "auto"
DEFAULT_OUTPUT_EXTENSION = "png"
DEFAULT_OUTPUT_PATH = "output/imagegen/output.png"
DEFAULT_TIMEOUT = 600
DEFAULT_CODEX_MAX_RETRIES = 4
DEFAULT_CODEX_RETRY_BASE_DELAY_SECONDS = 0.2
GPT_IMAGE_MODEL_PREFIX = "gpt-image-"

ALLOWED_LEGACY_SIZES = {"1024x1024", "1536x1024", "1024x1536", "auto"}
ALLOWED_QUALITIES = {"low", "medium", "high", "xhigh", "max", "auto"}

GPT_IMAGE_2_MIN_PIXELS = 655_360
GPT_IMAGE_2_MAX_PIXELS = 8_294_400
GPT_IMAGE_2_MAX_EDGE = 3840
GPT_IMAGE_2_MAX_RATIO = 3.0

MAX_IMAGE_BYTES = 50 * 1024 * 1024
DEFAULT_CONFIG_HOME = "~/.editppt"
DEFAULT_CODEX_AUTH_FILE = "~/.codex/auth.json"
DEFAULT_CODEX_IMAGES_BASE_URL = "https://chatgpt.com/backend-api/codex"
ENV_FIELDS = ("OPENAI_API_KEY", "OPENAI_BASE_URL", "IMAGE_TO_EDITABLE_PPT_IMAGE_MODEL")
MAX_CODEX_RESPONSE_BYTES = 64 * 1024 * 1024
MAX_CODEX_BASE64_CHARS = 64 * 1024 * 1024
CHATGPT_AUTH_CLAIM = "https://api.openai.com/auth"
CHATGPT_ACCOUNT_ID_CLAIM = "chatgpt_account_id"

IMAGE_HELP_EPILOG = """\
Backend selection:
  Codex OAuth: uses ~/.codex/auth.json or CODEX_AUTH_FILE.
  API fallback: uses OPENAI_API_KEY, OPENAI_BASE_URL, and
  IMAGE_TO_EDITABLE_PPT_IMAGE_MODEL from the environment or ~/.editppt/config.yaml.

Setup:
  codex login
  editppt config --api-key "your-api-key" --model gpt-image-2.5-sunburst
  editppt config --api-key "your-api-key" --base-url https://example.test/v1 --model openai/gpt-image-2.5-sunburst

Input image rules:
  generate creates a new image from prompt only.
  edit passes each --image as an edit target, visual reference, or supporting input.

Parameter surface:
  Public image parameters are model, prompt, size, and quality. Codex OAuth
  requests also set background=auto to match Codex built-in image generation.
  Edit requests also pass the input images and optional mask. Local controls
  such as --out, --force, --dry-run, and --timeout are not image API parameters.

Slide reconstruction patterns:
  Clean base: use edit --image <source.png>; preserve source composition,
  perspective, object positions, colors, lighting, material, and background identity.
  Asset sheet: use edit --image <source.png>; separate exact existing foreground
  bitmap objects on a flat chroma-key background with generous spacing. Choose
  a key color absent from the assets and far from their main fills, strokes,
  highlights, and shadows; cyan, green, magenta, red, or orange are examples,
  not fixed defaults.
  Formula assets: use editppt formula render-latex, not editppt image.

Output:
  Write outputs under the page directory when used in a deck run. Record selected
  images with editppt image import, then use process-sheet when asset-sheet splitting is needed.
"""

GENERATE_HELP_EPILOG = """\
Backend:
  Uses Codex OAuth when available, otherwise API fallback from ~/.editppt/config.yaml
  or environment variables.

Use for:
  New supporting images that do not need to preserve an existing slide object.

Examples:
  editppt image generate --prompt "flat blue cloud icon, no text" --out pages/page_001/assets/cloud.png
  editppt image generate --prompt-file prompt.txt --size 1536x1024 --quality high --out output.png
"""

EDIT_HELP_EPILOG = """\
Backend:
  Uses Codex OAuth when available, otherwise API fallback from ~/.editppt/config.yaml
  or environment variables.

Use for:
  Background cleanup, clean base creation, foreground icon extraction, and
  source-faithful asset sheets. Pass the original slide through --image so the
  model receives it as the edit target and strict visual reference.

Prompt patterns:
  Clean base: preserve source canvas ratio, composition, perspective, object
  positions, colors, lighting, texture, and background identity; remove the
  foreground text/objects that will be rebuilt.
  Asset sheet: extract exact existing non-text foreground objects from the
  source into a sparse chroma-key sheet; preserve shape, stroke geometry, color,
  proportions, internal cutouts, and visual identity. Choose a key color absent
  from the target objects and far from their main fills, strokes, highlights,
  and shadows; cyan, green, magenta, red, or orange are examples, not fixed
  defaults.

Examples:
  editppt image edit --image pages/page_001/source.png --prompt-file clean-base.prompt.txt --out pages/page_001/assets/clean-base.png
  editppt image edit --image pages/page_001/source.png --prompt-file asset-sheet.prompt.txt --out pages/page_001/assets/asset-sheet.png
  editppt image edit --image source.png --image style.png --prompt "Use source as target and style as supporting reference" --out out.png
"""


def _die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def _warn(message: str) -> None:
    print(f"Warning: {message}", file=sys.stderr)


def _runtime_home() -> Path:
    return Path(os.getenv("EDITPPT_CONFIG_HOME", DEFAULT_CONFIG_HOME)).expanduser()


def _runtime_env_path() -> Path:
    return _runtime_home() / "config.yaml"


def _load_runtime_env() -> None:
    path = _runtime_env_path()
    if not path.exists():
        return
    try:
        import yaml
    except ImportError as exc:
        _die(
            "PyYAML is required to read ~/.editppt/config.yaml. "
            "Reinstall editppt with pipx so package dependencies are installed."
        )
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        _die(f"Invalid config file: {path}")
    for key, value in data.items():
        if key not in ENV_FIELDS or os.getenv(key):
            continue
        os.environ[key] = str(value)


def _default_model() -> str:
    return os.getenv("IMAGE_TO_EDITABLE_PPT_IMAGE_MODEL", DEFAULT_MODEL)


def _api_base_url() -> Optional[str]:
    return os.getenv("OPENAI_BASE_URL") or None


def _api_target_label() -> str:
    base_url = _api_base_url()
    if base_url:
        return f"OpenAI-compatible proxy (OPENAI_BASE_URL={base_url})"
    return "official OpenAI API (OPENAI_BASE_URL unset)"


def _codex_auth_file() -> Path:
    return Path(os.getenv("CODEX_AUTH_FILE", DEFAULT_CODEX_AUTH_FILE)).expanduser()


def _decode_jwt_payload(token: str) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload.encode("ascii"))
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _infer_codex_account_id(tokens: Dict[str, Any]) -> Optional[str]:
    account_id = tokens.get("account_id")
    if isinstance(account_id, str) and account_id.strip():
        return account_id.strip()

    id_token = tokens.get("id_token")
    if not isinstance(id_token, str) or not id_token.strip():
        return None
    auth_claim = _decode_jwt_payload(id_token).get(CHATGPT_AUTH_CLAIM)
    if not isinstance(auth_claim, dict):
        return None
    chatgpt_account_id = auth_claim.get(CHATGPT_ACCOUNT_ID_CLAIM)
    if isinstance(chatgpt_account_id, str) and chatgpt_account_id.strip():
        return chatgpt_account_id.strip()
    return None


def _load_codex_auth() -> Optional[Tuple[str, Optional[str]]]:
    path = _codex_auth_file()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    tokens = data.get("tokens")
    if not isinstance(tokens, dict):
        return None
    token = tokens.get("access_token")
    if isinstance(token, str) and token.strip():
        return token.strip(), _infer_codex_account_id(tokens)
    return None


def _load_codex_access_token() -> Optional[str]:
    auth = _load_codex_auth()
    return auth[0] if auth else None


def _codex_available() -> bool:
    return _load_codex_access_token() is not None


def _codex_base_url() -> str:
    raw = (
        os.getenv("CODEX_IMAGES_BASE_URL")
        or DEFAULT_CODEX_IMAGES_BASE_URL
    ).strip()
    if not raw:
        return DEFAULT_CODEX_IMAGES_BASE_URL
    if re.fullmatch(r"https?://chatgpt\.com/backend-api(?:/codex)?(?:/v1)?/?", raw, re.I):
        return DEFAULT_CODEX_IMAGES_BASE_URL
    return raw.rstrip("/")


def _codex_image_url(operation: str) -> str:
    endpoint = "images/edits" if operation == "edit" else "images/generations"
    return f"{_codex_base_url()}/{endpoint}"


def _guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if mime and mime.startswith("image/"):
        return mime
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".webp":
        return "image/webp"
    return "image/png"


def _image_to_data_url(path: Path) -> str:
    data = path.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{_guess_mime(path)};base64,{encoded}"


def _codex_image_reference(path: Path) -> Dict[str, str]:
    return {"image_url": _image_to_data_url(path)}


def _codex_image_body(
    *,
    prompt: str,
    image_paths: List[Path],
    mask_path: Optional[Path],
    model: str,
    size: str,
    quality: str,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "prompt": prompt,
        "model": model,
        "s
```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py`
```
#!/usr/bin/env python3
"""Unified CLI for the image-to-editable-ppt skill."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from deck_run_state import (
    dispatch_slots_available,
    dispatchable_pages,
    find_page,
    load_deck,
    load_jobs,
    load_run_state,
    page_dir_for,
    run_dir_from_target,
)
from formula_renderer import (
    FormulaRenderError,
    formula_image_fragment,
    render_latex_asset,
    write_json,
)


RUNTIME_DIR = Path(__file__).resolve().parent
HELP_FORMATTER = argparse.RawDescriptionHelpFormatter


def run_script(script_name: str, argv: list[str]) -> int:
    command = [sys.executable, str(RUNTIME_DIR / script_name), *[str(item) for item in argv]]
    return subprocess.run(command).returncode


def cli_prog() -> str:
    return os.environ.get("IMAGE_TO_EDITABLE_PPT_CLI_PROG", "editppt")


def print_json(payload: dict) -> int:
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    argv = ["doctor"]
    if args.check_api:
        argv.append("--check-api")
    if args.json:
        argv.append("--json")
    if args.timeout is not None:
        argv.extend(["--timeout", str(args.timeout)])
    return run_script("runtime_env.py", argv)


def cmd_config(args: argparse.Namespace) -> int:
    argv = ["config"]
    if args.api_key:
        argv.extend(["--api-key", args.api_key])
    if args.base_url:
        argv.extend(["--base-url", args.base_url])
    if args.clear_base_url:
        argv.append("--clear-base-url")
    if args.model:
        argv.extend(["--model", args.model])
    if args.import_codex_ppt:
        argv.append("--import-codex-ppt")
    if getattr(args, "paddle_ocr_token", None):
        argv.extend(["--paddle-ocr-token", args.paddle_ocr_token])
    return run_script("runtime_env.py", argv)


def cmd_setup(args: argparse.Namespace) -> int:
    config = subprocess.run(
        [sys.executable, str(RUNTIME_DIR / "runtime_env.py"), "config"],
        text=True,
        capture_output=True,
    )
    doctor_args = ["doctor", "--json"]
    if args.check_api:
        doctor_args.append("--check-api")
    doctor = subprocess.run(
        [sys.executable, str(RUNTIME_DIR / "runtime_env.py"), *doctor_args],
        text=True,
        capture_output=True,
    )
    try:
        doctor_payload = json.loads(doctor.stdout)
    except json.JSONDecodeError:
        doctor_payload = {
            "ok": False,
            "stdout": doctor.stdout,
            "stderr": doctor.stderr,
        }
    payload = {
        "setup": "ok" if config.returncode == 0 and doctor.returncode == 0 else "needs_attention",
        "config": {
            "ok": config.returncode == 0,
            "stdout": config.stdout,
            "stderr": config.stderr,
        },
        "doctor": doctor_payload,
    }
    return print_json(payload)


def cmd_prepare(args: argparse.Namespace) -> int:
    argv = []
    if args.out_root:
        argv.extend(["--out-root", args.out_root])
    if args.job_dir:
        argv.extend(["--job-dir", args.job_dir])
    if args.dpi:
        argv.extend(["--dpi", str(args.dpi)])
    if args.max_concurrent_pages:
        argv.extend(["--max-concurrent-pages", str(args.max_concurrent_pages)])
    argv.extend(args.inputs)
    command = [sys.executable, str(RUNTIME_DIR / "prepare_deck_run.py"), *[str(item) for item in argv]]
    prepared = subprocess.run(command, text=True, capture_output=True)
    if prepared.stdout:
        print(prepared.stdout, end="")
    if prepared.stderr:
        print(prepared.stderr, end="", file=sys.stderr)
    if prepared.returncode != 0:
        return prepared.returncode
    lines = [line.strip() for line in prepared.stdout.splitlines() if line.strip()]
    if not lines:
        print("prepare did not report a deck_manifest.json path", file=sys.stderr)
        return 1
    deck_path = Path(lines[0])
    if not deck_path.exists():
        print(f"prepare reported a missing deck_manifest.json path: {deck_path}", file=sys.stderr)
        return 1
    if not getattr(args, "no_text_hints", False):
        # Best-effort: distribute per-page text measurements alongside the
        # page sources so workers start with hints already in place.
        if run_script("deck_text_hints.py", [str(deck_path.parent)]) != 0:
            print("warning: text hints generation failed; workers can run `editppt page hints` per page", file=sys.stderr)
    return cmd_backend(
        argparse.Namespace(
            run=str(deck_path.parent),
            mode=args.image_backend,
            tool_name=None,
            tool_call=None,
            model=None,
            fallback_command=None,
            runtime_home=None,
            input_context_policy=None,
        )
    )


def cmd_backend(args: argparse.Namespace) -> int:
    argv = [args.run]
    if args.mode:
        argv.extend(["--backend-id", args.mode])
    if args.tool_name:
        argv.extend(["--tool-name", args.tool_name])
    if args.tool_call:
        argv.extend(["--tool-call", args.tool_call])
    if args.model:
        argv.extend(["--model", args.model])
    if args.fallback_command:
        argv.extend(["--fallback-command", args.fallback_command])
    if args.runtime_home:
        argv.extend(["--runtime-home", args.runtime_home])
    if args.input_context_policy:
        argv.extend(["--input-context-policy", args.input_context_policy])
    return run_script("configure_image_backend.py", argv)


def cmd_image_api(args: argparse.Namespace) -> int:
    return run_script("image_gen.py", [args.image_command, *args.image_args])


def cmd_process_asset_sheet(args: argparse.Namespace) -> int:
    return run_script("process_asset_sheet.py", args.process_args)


def cmd_record_image(args: argparse.Namespace) -> int:
    return run_script("record_imagegen_result.py", args.record_image_args)


def cmd_status(args: argparse.Namespace) -> int:
    argv = [args.run]
    if args.json:
        argv.append("--json")
    return run_script("page_job_status.py", argv)


def cmd_next(args: argparse.Namespace) -> int:
    run_dir = run_dir_from_target(args.run)
    deck = load_deck(run_dir)
    jobs = load_jobs(run_dir)
    state = load_run_state(run_dir)
    backend = deck.get("image_backend")
    dispatchable = [page.get("page_id") for page in dispatchable_pages(jobs)]
    slots = dispatch_slots_available(jobs)
    pages = jobs.get("pages", [])

    if not backend:
        payload = {
            "run_dir": str(run_dir),
            "stage": "configure_backend",
            "next_command": f"{cli_prog()} run backend {run_dir}",
            "reason": "deck_manifest.json.image_backend is missing",
            "agent_focus": "No page reconstruction yet. Confirm the image backend first.",
        }
        return print_json(payload) if args.json else _print_next_text(payload)

    if dispatchable and slots > 0:
        selected = dispatchable[:slots]
        first_page = find_page(jobs, selected[0])
        prompt_out = page_dir_for(run_dir, first_page) / "worker-prompt.md"
        if len(pages) == 1 and selected == [first_page.get("page_id")]:
            payload = {
                "run_dir": str(run_dir),
                "stage": "rebuild_page_locally",
                "dispatch_slots_available": slots,
                "dispatchable_pages": dispatchable,
                "suggested_pages": selected,
                "prompt_file": str(prompt_out),
                "next_command": f"{cli_prog()} run dispatch {run_dir} --page {selected[0]} --agent-id main --prompt-file {prompt_out} --local",
                "agent_focus": "Build the page prompt, claim local execution with dispatch --local, rebuild the page yourself using that prompt, then record the result.",
            }
            return print_json(payload) if args.json else _print_next_text(payload)
        payload = {
            "run_dir": str(run_dir),
            "stage": "dispatch_pages",
            "dispatch_slots_available": slots,
            "dispatchable_pages": dispatchable,
            "suggested_pages": selected,
            "prompt_file": str(prompt_out),
            "next_command": f"{cli_prog()} run dispatch {run_dir} --page {selected[0]} --agent-id <worker-id> --prompt-file {prompt_out}",
            "agent_focus": "Build the page prompt, spawn the worker, then record dispatch.",
        }
        return print_json(payload) if args.json else _print_next_text(payload)

    unfinished = [
        f"{page.get('page_id')}:{page.get('status')}"
        for page in pages
        if page.get("status") not in {"recorded", "accepted"}
    ]
    if unfinished:
        payload = {
            "run_dir": str(run_dir),
            "stage": "wait",
            "active_or_unfinished_pages": unfinished,
            "next_command": f"{cli_prog()} run status {run_dir}",
            "agent_focus": "Wait for dispatched workers, then record completed page results. Do not reset slow active workers; use `run reset` only after failure, terminal state, cancellation, or lost-worker verification.",
        }
        return print_json(payload) if args.json else _print_next_text(payload)

    payload = {
        "run_dir": str(run_dir),
        "stage": "finalize",
        "run_status": state.get("status"),
        "next_command": f"{cli_prog()} run finalize {run_dir}",
        "agent_focus": "All pages are recorded. Build and validate the final PPTX.",
    }
    return print_json(payload) if args.json else _print_next_text(payload)


def _print_next_text(payload: dict) -> int:
    print(f"stage={payload.get('stage')}")
    print(f"run_dir={payload.get('run_dir')}")
    if payload.get("reason"):
        print(f"reason={payload['reason']}")
    if payload.get("dispatchable_pages"):
        print(f"dispatchable_pages={', '.join(payload['dispatchable_pages'])}")
    if payload.get("suggested_pages"):
        print(f"sugg
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #46** (2026-09-16): **docs: use official e-iceblue sponsor logo**
  *Symptoms*: ## Summary  Replace the orange Spire.Presentation icon with the official e-iceblue logo supplied by the sponsor. All six multilingual README and documentation placements share this asset, so they update together.  ## User-visible changes  - Show the official blue e-iceblue logo in the existing sponsor card. - Preserve the card text, dimensions, placement, and product affiliate links.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - Verified the replacement PNG matches the sponsor's attachment byte for byte. - Verified all six pages reference this asset and retain the product URL with affiliate ID 420. - `git diff --check` passed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-16T06:42:36.351830Z">2026-09-16T06:42:36.351830Z</relative-time> | `5a3ba82` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #45** (2026-09-16): **docs: use product page for Spire affiliate links**
  *Symptoms*: ## Summary  Spire.Presentation sponsor links currently land on the e-iceblue homepage. Point all six calls to action to the product page requested by e-iceblue, preserving affiliate ID 420.  ## User-visible changes  - Update the Chinese, English, and Korean READMEs and documentation homepages to use https://www.e-iceblue.com/Introduce/presentation-for-python.html?aff_id=420.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - Verified each of the six files contains exactly one new product affiliate URL and no previous homepage affiliate URL. - `git diff --check` passed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-16T06:06:40.514513Z">2026-09-16T06:06:40.514513Z</relative-time> | `1a62a2b` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #44** (2026-09-16): **docs: add Spire.Presentation sponsor cards**
  *Symptoms*: ## Summary  Add Spire.Presentation for Python to the sponsor section below Codia NoteSlide, using the supplied logo and copy.  ## User-visible changes  - Add matching sponsor cards to the Chinese, English, and Korean READMEs and documentation homepages. - Link each call to action to the e-iceblue affiliate URL with `aff_id=420`.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - `git diff --check` passed. - Verified all six sponsor tables preserve existing content and contain one correctly placed Spire.Presentation row and the expected affiliate link. - Verified the supplied logo is present and all image references use the existing README/docs conventions. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-16T04:37:46.182615Z">2026-09-16T04:37:46.182615Z</relative-time> | `a771e22` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #43** (2026-10-03): **生成的 .pptx 在 PowerPoint 中提示文件损坏（主题 fillStyleLst 不满足 schema）**
  *Symptoms*: ## 现象  通过 `image-to-editable-ppt-skill`（及其后续编辑流程）生成的 .pptx 在 Microsoft PowerPoint 双击打开时，提示「文件可能已损坏」并拒绝打开。  但 macOS `file` 命令、LibreOffice、WPS 等都能正常识别并打开，所以**不是磁盘损坏**。  用 OOXML 校验工具检查，会报 3 处 schema 错误（三个主题文件各 1 处），全部指向同一个问题：`a:fmtScheme/a:fillStyleLst` 不完整。  ## 根因  OOXML 的 `CT_FillStyleList` 规定 `<a:fillStyleLst>` 必须**恰好**包含 3 个填充元素（`minOccurs = maxOccurs = 3`，可选类型 `solidFill` / `gradFill` / `pattFill` / `noFill` / `blipFill` / `grpFill`）。  解压 .pptx 后看到，三个主题文件的 `fillStyleLst` 都只有 **1 个** `solidFill`：  ``` ppt/theme/theme1.xml ppt/slideMasters/theme/theme2.xml ppt/notesMasters/theme/theme3.xml ```  内容都是：  ```xml <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst> ```  PowerPoint 严格 schema 校验失败 → 拒绝打开。  ## 复现步骤  1. 走完整 `image-to-editable-ppt-skill` 编辑流程产出一个 deck 2. unzip 看 `ppt/theme/theme1.xml`，搜 `fillStyleLst` 3. 用 [officecli](https://github.com/) `validate` 跑一遍，会报：    ```    [Schema] The element has incomplete content. List of possible elements expected:    <...drawingml/2006/main:blipFill>, <.../gradFill>, <.../grpFill>,    <.../noFill>, <.../pattFill>, <.../solidFill>.      Path: /a:theme[1]/a:themeElements[1]/a:fmtScheme[1]/a:fillStyleLst[1]      Part: /ppt/theme/theme1.xml    ```  ## 临时修复（用户侧）  把每个 theme 的 `fillStyleLst` 里那一个 `solidFill` 复制到 3 份即可：  ```xml <a:fillStyleLst>   <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>   <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>   <a:solidFill><a:schemeClr val="phClr"/></a:solidFill> <
  **Post-Mortem & Fix Analysis**:
  > 主要还是我生成了多份的问题吧，让 claude 自己提了个 issue，大佬看心情评估下吧。
  > 感谢反馈！我们核对了最新 main 和当前发布版 v0.4.0，并实际生成了单页及带备注的双页样本，均通过 officecli 的 OpenXML schema 校验，未复现 fillStyleLst 元素不足的问题。  旧版 v0.3.2 确实存在主题样式列表不完整的问题，该问题已在 v0.3.3 修复，最新 v0.4.0 已包含修复。建议先将 Skill 和 editppt CLI 都更新到 v0.4.0，再重新生成文件；更新不会自动修复之前生成的 PPTX。  另外，报告中的 Walnut Exporter 标记、额外主题文件与当前代码直接生成的结果不一致，可能涉及后续工具处理。但仅凭这些信息，还不能确定是旧版本产物还是后续处理引入的问题。  如果更新后仍能复现，麻烦补充实际使用的 Skill / CLI 版本、具体操作步骤，以及二次处理前后的 PPTX（可提供脱敏的最小复现文件），方便进一步定位。感谢！

- **Issue #42** (2026-09-15): **docs: embed demo video across multilingual documentation**
  *Symptoms*: ## Summary  Embed the project demo video immediately below the title, language navigation, and badges in all three READMEs, matching the Codex Celebrate layout. Add the same playable video to the Chinese, English, and Korean documentation home pages.  ## User-visible changes  - GitHub-hosted MP4 uploaded through the README editor, named `image-to-editable-ppt-promo.mp4`. - Native GitHub video playback in the READMEs and a controlled, non-autoplay player with a poster in Docsify. - Existing overview images and documentation remain intact.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - `git diff --check`. - Reviewed all six language pages for matching placement and video URL. - GitHub README preview renders the video below the badge row. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-15T16:33:50.736725Z">2026-09-15T16:33:50.736725Z</relative-time> | `a92b83f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #41** (2026-09-16): **额度平衡**
  *Symptoms*: 我有一个30页ppt，单张转换token消耗低还是整体交进去消耗低？
  **Post-Mortem & Fix Analysis**:
  > 整体低，但是30页还是需要不少token的，建议pro 20x用，plus肯定不够

- **Issue #40** (2026-09-13): **docs: revert WeChat community QR restoration**
  *Symptoms*: ## Summary  - revert PR #39 - remove the restored WeChat community QR code from all README language versions - remove the matching unreleased changelog entry and QR asset  ## Verification  - `git diff --cached --check` - verified the revert touches only the five files introduced by PR #39  ## Notes  - This preserves the Telegram and issue support links.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ⚠️ **Failed** <relative-time datetime="2026-09-13T05:24:27.606082Z">2026-09-13T05:24:27.606082Z</relative-time> | `a8d4aa1` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #39** (2026-09-13): **docs: restore WeChat community QR code**
  *Symptoms*: ## Summary  - restore the WeChat community QR code in the existing support section - keep Chinese, English, and Korean READMEs synchronized - document the restoration in the unreleased changelog  ## Verification  - `git diff --check` - verified the restored PNG matches the historical Git blob  ## Notes  - The QR image is restored byte-for-byte from commit `a62dc8e`; its current WeChat invitation validity requires an actual scan.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-13T04:31:19.693357Z">2026-09-13T04:31:19.693357Z</relative-time> | `03c144f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

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

### Incident Patch 1: `66066030` (2026-09-13)
**Commit Message**: Merge pull request #40 from ningzimu/feature/revert-community-qr

docs: revert WeChat community QR restoration

**File**: `CHANGELOG.md` (modified, +0/-4)
```diff
@@ -4,10 +4,6 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
-### Documentation
-
-- Restore the WeChat community QR code to the support section across all README language versions. (#39)
-
 ## 0.4.0
 
 ### Features
```

**File**: `README.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 
 遇到问题？请查看[使用文档](https://ningzimu.github.io/image-to-editable-ppt-skill/#/)，加入 [CodexPPT](https://t.me/CodexPPT)，或[提交 Issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new)。
 
-扫描二维码加入微信交流群，分享使用经验、反馈问题，并获取更新通知。
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT 微信交流群二维码" width="220">
-
 ## 许可证
 
 MIT
```

**File**: `README_en.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
 
 Having trouble? Check the [usage documentation](https://ningzimu.github.io/image-to-editable-ppt-skill/#/en/), join [CodexPPT](https://t.me/CodexPPT), or [open an issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-Scan the QR code to join the WeChat community group, share your experience, report issues, and receive update notifications.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat community group QR code" width="220">
-
 ## License
 
 MIT
```

**File**: `README_ko.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 
 문제가 있나요? [사용 설명서](https://ningzimu.github.io/image-to-editable-ppt-skill/#/ko/)를 확인하고, [CodexPPT](https://t.me/CodexPPT)에 참여하거나, [Issue를 등록하세요](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-QR 코드를 스캔하여 WeChat 커뮤니티 그룹에 참여하고, 사용 경험을 공유하고, 문제를 제보하고, 업데이트 알림을 받아보세요.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat 커뮤니티 그룹 QR 코드" width="220">
-
 ## 라이선스
 
 MIT
```

---

### Incident Patch 2: `a8d4aa18` (2026-09-13)
**Commit Message**: docs: revert WeChat community QR restoration

**File**: `CHANGELOG.md` (modified, +0/-4)
```diff
@@ -4,10 +4,6 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
-### Documentation
-
-- Restore the WeChat community QR code to the support section across all README language versions. (#39)
-
 ## 0.4.0
 
 ### Features
```

**File**: `README.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 
 遇到问题？请查看[使用文档](https://ningzimu.github.io/image-to-editable-ppt-skill/#/)，加入 [CodexPPT](https://t.me/CodexPPT)，或[提交 Issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new)。
 
-扫描二维码加入微信交流群，分享使用经验、反馈问题，并获取更新通知。
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT 微信交流群二维码" width="220">
-
 ## 许可证
 
 MIT
```

**File**: `README_en.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
 
 Having trouble? Check the [usage documentation](https://ningzimu.github.io/image-to-editable-ppt-skill/#/en/), join [CodexPPT](https://t.me/CodexPPT), or [open an issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-Scan the QR code to join the WeChat community group, share your experience, report issues, and receive update notifications.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat community group QR code" width="220">
-
 ## License
 
 MIT
```

**File**: `README_ko.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 
 문제가 있나요? [사용 설명서](https://ningzimu.github.io/image-to-editable-ppt-skill/#/ko/)를 확인하고, [CodexPPT](https://t.me/CodexPPT)에 참여하거나, [Issue를 등록하세요](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-QR 코드를 스캔하여 WeChat 커뮤니티 그룹에 참여하고, 사용 경험을 공유하고, 문제를 제보하고, 업데이트 알림을 받아보세요.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat 커뮤니티 그룹 QR 코드" width="220">
-
 ## 라이선스
 
 MIT
```

---

### Incident Patch 3: `7e86fb34` (2026-09-12)
**Commit Message**: fix: streamline page recovery and validation

**File**: `AGENTS.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@ The skill documentation under `skills/image-to-editable-ppt/` follows a strict o
 
 - **One authoritative home per rule.** Every requirement lives in exactly one file. Other files may carry at most a one-line pointer ("see `page-decision-tree.md` section 3.1") — never a restated list, enumeration, or procedure. Duplicated statements drift apart and inflate the token cost of every run.
 - **Reader-role split.** `SKILL.md` is read by the parent/orchestrator agent; the references and the worker prompt are read by page workers. Parent-level rules (orchestration, dispatch, state machine, user interaction) belong in `SKILL.md`; page-level rules (object decisions, field contracts, QA) belong in the references. Do not let worker-level detail leak back into `SKILL.md`.
-- **Every rule is a recorded failure.** Each requirement in these documents encodes a real past failure mode. Never delete a requirement during refactoring; when condensing or moving text, map every criterion to its new home first and verify nothing is lost. Tightening wording is welcome; dropping constraints is not.
+- **Every rule is a recorded failure.** Each requirement in these documents encodes a real past failure mode. When condensing or moving text, map every criterion to its authoritative home and verify the failure protection remains. Retire a redundant or counterproductive requirement only with evidence and an equivalent regression check that preserves the intended protection.
 - **Explain why, not bare musts.** Where a rule has a rationale (over-rounding is a common visible failure; nativizing text first locks in wrong object-source choices), state it briefly. Agents follow rules better when the failure they prevent is named.
 - **Reminders, not replacements.** The worker prompt may carry a short hard-rules block (about five lines) restating the highest-risk red lines, each ending with a pointer to its authoritative home. This is the only sanctioned form of duplication.
 - **Docs and CLI move together.** All run/page state transitions go through `editppt` commands. If a documented flow changes (for example: every page, including single-page input, is dispatched to a worker), the CLI behavior in `cli/` and the tests in `tests/` must change in the same PR. Docs must never describe a flow the CLI does not enforce.
@@ -36,7 +36,7 @@ The skill documentation under `skills/image-to-editable-ppt/` follows a strict o
 | Path | Owns | Must not contain |
 | --- | --- | --- |
 | `SKILL.md` | Trigger description; parent-level Entry Contract; the four-phase workflow (prepare → dispatch → record → finalize); state principles; delivery principles; deck-level structural QA; PaddleOCR token user-interaction policy | Worker-level decision rules, field definitions, hints usage details, command syntax beyond the phase commands |
-| `prompts/page-worker.md` | The worker execution template: page ownership boundary, mandatory-read enforcement for the three references, the short hard-rules block, execution order, required output list, return format | Restated decision-tree content, field contracts, or QA criteria — point to the references instead |
+| `prompts/page-worker.md` | The worker execution template: page ownership boundary, contextual reference-reading route, the short hard-rules block, execution order, required output list, return format | Restated decision-tree content, field contracts, or QA criteria — point to the references instead |
 | `references/page-decision-tree.md` | Single source of truth for object-source decisions: the three-step process (background → foreground assets → native elements), all object classification lists, text-hints usage, the Final Self-Check, and the Fix versus Warning split | JSON field contracts, command syntax |
 | `references/manifest-schema.md` | Single home for JSON field contracts of every run/page artifact: `deck_manifest.json`, `page_jobs.json`, `page_request.json`, `page_result.json`, `validation.json`, `manifest.json`, `imagegen-jobs.json`, `notes_manifest.json`; coordinate layouts; text-fitting fields | Decision rules about *when* to choose an object source |
 | `references/cli-helper.md` | Pure command manual: install check, command tree, syntax and one-line purpose per command | Workflow narration, decision rules, user-interaction policy — those live in `SKILL.md` and the decision tree |
```

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -10,10 +10,17 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ### Improvements
 
+- Reuse verified page assets during local recovery and load worker references by task instead of requiring every reference in full. Preserve OCR setup and blocked-OCR user interaction.
+
 - Add whole-object region splitting that retains disconnected details after chroma-key removal; keep flat-color asset generation as the default and fix processing of already-transparent supplied sheets.
 
 - Default CLI image requests to GPT Image 2.5 Sunburst, support Flare and model-specific `xhigh`/`max` quality, and retain `auto` quality and built-in-first routing.
 
+### Fixes
+
+- Validate structured foreground provenance without treating incidental words or negated descriptions as forbidden sources.
+- Reject changed recorded outputs and image assets before finalization, and report bounded faint isolated region residue as a warning while retaining boundary-cut failures.
+
 ### Documentation
 
 - Add Codia NoteSlide sponsor cards and links across Chinese, English, and Korean READMEs and documentation homepages. (#37)
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@
 > ![Codex 完全访问权限设置示意](assets/codex-full-access-permission.png)
 
 > [!WARNING]
-> 目前该skill 采用了多智能体协作复原流程，有着复杂的流程控制，不是轻量转换器。AI 会执行“**重建 → 自我检查 → 页面内修正**”的循环，并可能进行多轮迭代，直到它认为结果足够接近原图。在这个过程中，page worker 可能会对页面做很**多轮尝试**，因此整体上比较费 token。
+> 页面验证失败时优先局部修复并复用已核验的素材；当前输出通过检查后即完成，不因可接受的小毛边重复生成。常规步骤自主执行；缺少 OCR Token 或 OCR 受阻时仍会询问用户。复杂页面仍可能消耗较多 token。
 >
 > **推荐 ChatGPT Pro 用户使用；Plus 用户请谨慎使用。**
 >
@@ -221,7 +221,7 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 - 单页/单图输入可由主 agent 本地重建；多页输入通过 page worker/subagent 并行重建。
 - 复杂视觉资产需要可用的内置图片工具或 CLI fallback；如果两者都无法生成合规资产，对应页面会校验失败，不会用近似图形替代。
 - 对照片、插画、纹理、手绘装饰等复杂视觉元素，通常只能作为独立图片资产移动，不能保证内部对象可编辑。
-- 原生表格暂不支持斜线表头和单元格内嵌图片；文字、行列或合并关系不清楚时需确认，不猜测内容或结构。图表、流程图仍按可编辑结构重建。
+- 原生表格暂不支持斜线表头和单元格内嵌图片；文字、行列或合并关系不清楚时先复查源图与 OCR，仍无法辨认则报告具体缺失，不猜测内容或结构。图表、流程图仍按可编辑结构重建。
 - 视觉相似不等于可编辑。最终判断应同时看 PPTX 结构、文本覆盖、资产来源和预览/diff。
 
 ## 仓库结构
```

**File**: `README_en.md` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 > ![Codex Full Access permission setting](assets/codex-full-access-permission.png)
 
 > [!WARNING]
-> This skill currently uses a multi-agent collaborative reconstruction workflow with complex flow control. It is not a lightweight converter. The AI runs a "**rebuild -> self-check -> page-local correction**" loop and may iterate multiple times until it judges the result close enough to the source. During this process, page workers may make **many attempts** per page, so the workflow can consume a large number of tokens.
+> Failed page validation leads to local repairs that reuse verified assets. Work stops when the current outputs pass checks; acceptable minor fringes do not trigger regeneration. Routine steps run autonomously; missing OCR tokens or blocked OCR still require user input. Complex pages can still consume substantial tokens.
 >
 > **GPT Pro is recommended. Plus users should use this skill cautiously.**
 >
@@ -221,7 +221,7 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
 - Single-page or single-image input can be rebuilt locally by the main agent; multi-page input is rebuilt in parallel through page workers/subagents.
 - Complex visual assets need either the built-in image tool or the CLI fallback. If neither can produce a compliant asset, the page fails validation instead of substituting approximate shapes.
 - Complex photos, illustrations, textures, and hand-drawn decorations are usually movable image assets, not internally editable PowerPoint objects.
-- Native tables do not yet support diagonal headers or images embedded in cells. Unclear text, rows, columns, or merges require clarification rather than guessed content or structure. Charts and flowcharts continue to use editable structural objects.
+- Native tables do not yet support diagonal headers or images embedded in cells. Unclear text, rows, columns, or merges are checked against the source and OCR first; unresolved details are reported without guessing content or structure. Charts and flowcharts continue to use editable structural objects.
 - Visual similarity is not enough. Acceptance should check package structure, editable text coverage, asset provenance, preview, and diff.
 
 ## Repository Layout
```

**File**: `README_ko.md` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@
 > ![Codex 전체 액세스 권한 설정 예시](assets/codex-full-access-permission.png)
 
 > [!WARNING]
-> 현재 이 skill은 멀티 agent 협업 복원 흐름과 복잡한 프로세스 제어를 사용하므로 가벼운 변환기가 아닙니다. AI는 “**재구성 → 자체 점검 → 페이지 내부 수정**” 사이클을 수행하며, 결과가 원본에 충분히 가깝다고 판단할 때까지 여러 번 반복할 수 있습니다. 이 과정에서 page worker가 한 페이지를 **여러 차례 시도**할 수 있어 전체 token 사용량이 큽니다.
+> 페이지 검증 실패 시 검증된 소재를 재사용하며 필요한 부분을 수정합니다. 현재 출력이 검사를 통과하면 완료하며, 허용 가능한 작은 가장자리 흔적만으로 다시 생성하지 않습니다. 일반 단계는 자율적으로 실행하지만 OCR Token이 없거나 OCR이 차단되면 사용자에게 문의합니다. 복잡한 페이지는 여전히 많은 token을 사용할 수 있습니다.
 >
 > **ChatGPT Pro 사용자에게 권장하며, Plus 사용자는 신중하게 사용하세요.**
 >
@@ -221,7 +221,7 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 - 단일 페이지/이미지 입력은 메인 agent가 로컬에서 재구성할 수 있고, 다중 페이지 입력은 page worker/subagent가 병렬로 재구성합니다.
 - 복잡한 시각 에셋에는 사용할 수 있는 내장 이미지 도구 또는 CLI 폴백이 필요합니다. 둘 다 규격에 맞는 에셋을 생성할 수 없으면 해당 페이지는 검증에 실패하며 근사 도형으로 대체하지 않습니다.
 - 사진, 일러스트, 질감, 손그림 장식 등의 복잡한 시각 요소는 일반적으로 독립 이미지 에셋으로 이동할 수 있을 뿐, 내부 객체의 편집 가능성을 보장하지 않습니다.
-- 네이티브 표는 아직 대각선 머리글과 셀 내부 이미지를 지원하지 않습니다. 텍스트, 행·열 또는 병합 관계가 불분명하면 확인이 필요하며 내용이나 구조를 추측하지 않습니다. 차트와 순서도는 계속 편집 가능한 구조 객체로 재구성합니다.
+- 네이티브 표는 아직 대각선 머리글과 셀 내부 이미지를 지원하지 않습니다. 텍스트, 행·열 또는 병합 관계가 불분명하면 원본과 OCR을 먼저 다시 확인하고, 해결되지 않은 내용을 구체적으로 보고하며 내용이나 구조를 추측하지 않습니다. 차트와 순서도는 계속 편집 가능한 구조 객체로 재구성합니다.
 - 시각적으로 비슷하다는 것이 편집 가능하다는 뜻은 아닙니다. 최종 판단 시 PPTX 구조, 텍스트 커버리지, 에셋 출처, 미리보기/diff를 함께 확인해야 합니다.
 
 ## 저장소 구조
```

**File**: `docs/en/workflow.md` (modified, +4/-2)
```diff
@@ -2,12 +2,14 @@
 
 This page describes the complete conversion process from input to final `.pptx`, so you can understand what the AI is doing and what each stage produces.
 
+> Failed page validation leads to local repairs that reuse verified assets. Work stops when the current outputs pass checks; acceptable minor fringes do not trigger regeneration. Routine steps run autonomously; missing OCR tokens or blocked OCR still require user input. Complex pages can still consume substantial tokens.
+
 ## End-to-End Process
 
 1. **Create a task directory and normalize the input**: create an isolated task directory, normalize the input (images, PDF, or image-based PowerPoint) into `pages/page_NNN/source.png`, detect whether built-in `image_gen.imagegen` is available, and record the image backend selected for the run.
 2. **Create OCR text annotations (when a Token is configured)**: submit the entire input to OCR as a batch task. OCR produces page-level text annotations—bounding boxes, measured font sizes, font-size groups, and recognized text—which guide measurement-based text reconstruction.
 3. **Dispatch pages**: for a one-page input, the main agent claims the page with `editppt run dispatch --local` and reconstructs it locally. For multi-page input, pages are dispatched in batches of up to `max_concurrent_pages` to page workers for parallel reconstruction.
-4. **Reconstruct and self-check each page**: each reconstructor owns its page directory and performs reconstruction, source comparison, and page-local corrections, potentially over multiple iterations. It creates a manifest and rebuilds editable text, simple shapes, and image assets. When needed, it uses the image backend to separate foreground and background elements or extract assets.
+4. **Reconstruct and self-check each page**: each reconstructor owns its page directory and performs reconstruction, source comparison, and page-local corrections, rechecking only affected objects and layout after changes and stopping once checks pass. It creates a manifest and rebuilds editable text, simple shapes, and image assets. When needed, it uses the image backend to separate foreground and background elements or extract assets.
 5. **Record state**: `editppt` commands record dispatch state, page results, and acceptance state, so progress can be inspected at any time.
 6. **Assemble and validate the final deck**: the main agent runs `editppt run finalize`, reads each accepted `manifest.json` in page order, rebuilds the final `.pptx`, copies speaker notes from `.pptx` inputs, and runs deck validation.
 
@@ -64,7 +66,7 @@ output/image-to-editable-ppt/{job-id}/        # Conversion task directory
 
 - This skill reconstructs an input page as editable objects; it does not generate a new presentation from scratch. That is the responsibility of [codex-ppt-skill](https://github.com/ningzimu/codex-ppt-skill).
 - Complex visual elements such as photos, illustrations, textures, and hand-drawn decoration can usually be moved only as separate image assets; their internal objects are not guaranteed to be editable.
-- Native tables do not yet support diagonal headers or images embedded in cells. Unclear text, rows, columns, or merges require clarification rather than guessed content or structure. Charts and flowcharts continue to use editable structural objects.
+- Native tables do not yet support diagonal headers or images embedded in cells. Unclear text, rows, columns, or merges are checked against the source and OCR first; unresolved details are reported without guessing content or structure. Charts and flowcharts continue to use editable structural objects.
 - Some image elements and text positions may be slightly offset. A 100% match to the source page is not guaranteed.
 - If the defined image generation or editing path cannot produce a compliant asset, the page fails or remains blocked. The skill does not downgrade the missing asset to a warning, nor does it record, finalize, or deliver an incomplete substitute.
 - Visual similarity does not guarantee editability. Final evaluation should consider the PPTX structure, text coverage, asset provenance, and preview/diff together.
```

**File**: `docs/ko/workflow.md` (modified, +4/-2)
```diff
@@ -2,12 +2,14 @@
 
 이 페이지는 한 번의 변환이 입력에서 최종 `.pptx`까지 진행되는 전체 과정을 설명합니다. AI가 무엇을 하고 각 단계에서 어떤 산출물이 생기는지 이해하는 데 도움이 됩니다.
 
+> 페이지 검증 실패 시 검증된 소재를 재사용하며 필요한 부분을 수정합니다. 현재 출력이 검사를 통과하면 완료하며, 허용 가능한 작은 가장자리 흔적만으로 다시 생성하지 않습니다. 일반 단계는 자율적으로 실행하지만 OCR Token이 없거나 OCR이 차단되면 사용자에게 문의합니다. 복잡한 페이지는 여전히 많은 token을 사용할 수 있습니다.
+
 ## 전체 흐름
 
 1. **작업 디렉터리 생성 및 입력 정규화**: 독립 작업 디렉터리를 만들고 입력(이미지/PDF/이미지 기반 PPT)을 `pages/page_NNN/source.png`로 정규화한 뒤 내장 `image_gen.imagegen`의 사용 가능 여부를 확인하고 이번 실행에서 선택한 이미지 backend를 기록합니다.
 2. **OCR 텍스트 주석(Token이 구성된 경우)**: 전체 입력을 하나의 일괄 작업으로 OCR에 제출해 각 페이지의 텍스트 주석(상자 좌표, 측정된 글자 크기, 크기 그룹, 텍스트 내용)을 생성합니다. 재구성 시 이 측정값에 따라 텍스트를 복원합니다.
 3. **페이지 분배**: 페이지가 하나뿐이면 메인 agent가 `editppt run dispatch --local`로 페이지를 맡아 로컬에서 재구성합니다. 페이지가 여러 개면 `max_concurrent_pages`에 따라 묶어 page worker에게 병렬로 분배합니다.
-4. **페이지별 재구성 및 자체 점검**: 페이지 재구성 담당자는 자신의 페이지 디렉터리에서 페이지를 재구성하고, 원본과 비교해 자체 점검한 뒤 page-local 수정을 수행합니다. 여러 번 반복할 수 있습니다. 각 페이지에 manifest를 만들고 편집 가능한 텍스트, 단순 도형, 이미지 에셋을 재구성하며, 필요한 경우 image backend로 전경과 배경을 분리하고 소재를 추출합니다.
+4. **페이지별 재구성 및 자체 점검**: 페이지 재구성 담당자는 자신의 페이지 디렉터리에서 페이지를 재구성하고, 원본과 비교해 자체 점검한 뒤 page-local 수정을 수행합니다. 수정된 객체와 관련 레이아웃만 다시 검사하고 통과하면 완료합니다. 각 페이지에 manifest를 만들고 편집 가능한 텍스트, 단순 도형, 이미지 에셋을 재구성하며, 필요한 경우 image backend로 전경과 배경을 분리하고 소재를 추출합니다.
 5. **상태 기록**: `editppt` 명령으로 dispatch, page result, accepted 상태를 기록하므로 언제든 작업 진행 상황을 확인할 수 있습니다.
 6. **최종 조립 및 검증**: 메인 agent가 `editppt run finalize`로 기록된 `manifest.json`을 페이지 순서대로 읽어 최종 `.pptx`를 재구성하고, `.pptx` 페이지 노트를 복사한 뒤 deck validation을 실행합니다.
 
@@ -64,7 +66,7 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 
 - 이 skill은 입력 페이지를 편집 가능하게 재구성하는 용도이며, 처음부터 전체 PPT 콘텐츠를 생성하지 않습니다. 그 역할은 [codex-ppt-skill](https://github.com/ningzimu/codex-ppt-skill)이 담당합니다.
 - 사진, 일러스트, 질감, 손그림 장식 등의 복잡한 시각 요소는 일반적으로 독립 이미지 에셋으로 이동할 수 있을 뿐, 내부 객체의 편집 가능성을 보장하지 않습니다.
-- 네이티브 표는 아직 대각선 머리글과 셀 내부 이미지를 지원하지 않습니다. 텍스트, 행·열 또는 병합 관계가 불분명하면 확인이 필요하며 내용이나 구조를 추측하지 않습니다. 차트와 순서도는 계속 편집 가능한 구조 객체로 재구성합니다.
+- 네이티브 표는 아직 대각선 머리글과 셀 내부 이미지를 지원하지 않습니다. 텍스트, 행·열 또는 병합 관계가 불분명하면 원본과 OCR을 먼저 다시 확인하고, 해결되지 않은 내용을 구체적으로 보고하며 내용이나 구조를 추측하지 않습니다. 차트와 순서도는 계속 편집 가능한 구조 객체로 재구성합니다.
 - 일부 이미지 요소와 텍스트 위치에 약간의 오차가 생길 수 있으며 원본 페이지를 100% 재현한다고 보장하지 않습니다.
 - 정해진 이미지 생성/편집 경로가 규격에 맞는 에셋을 만들지 못하면 해당 페이지는 실패하거나 차단 상태로 유지됩니다. 누락된 에셋을 warning으로 낮추거나 불완전한 대체 결과를 record, finalize 또는 전달하지 않습니다.
 - 시각적으로 비슷하다는 것이 편집 가능하다는 뜻은 아닙니다. 최종 판단 시 PPTX 구조, 텍스트 커버리지, 에셋 출처, 미리보기/diff를 함께 확인해야 합니다.
```

**File**: `docs/workflow.md` (modified, +4/-2)
```diff
@@ -2,12 +2,14 @@
 
 这页描述一次转换从输入到最终 `.pptx` 的完整过程，帮助你理解 AI 在做什么、每个阶段的产物是什么。
 
+> 页面验证失败时优先局部修复并复用已核验的素材；当前输出通过检查后即完成，不因可接受的小毛边重复生成。常规步骤自主执行；缺少 OCR Token 或 OCR 受阻时仍会询问用户。复杂页面仍可能消耗较多 token。
+
 ## 整体流程
 
 1. **创建任务目录并归一化输入**：创建独立任务目录，把输入（图片/PDF/图片版 PPT）归一化为 `pages/page_NNN/source.png`，同时检测内置 `image_gen.imagegen` 是否可用并记录本次运行选择的图片 backend。
 2. **OCR 文字标注（如已配置 Token）**：把整个输入作为一个批量任务提交 OCR，为每页生成文字标注（框坐标、实测字号、字号分组、文字内容），供重建时按测量值还原文字。
 3. **页面分派**：如果只有 1 页，主 agent 用 `editppt run dispatch --local` 认领页面并本地重建；如果有多页，按 `max_concurrent_pages` 分批分派给 page worker 并行重建。
-4. **逐页重建与自检**：页面重建者负责自己的页面目录，完成页面重建、对照源图自检和 page-local 修正，可能进行多轮迭代。每页创建 manifest，重建可编辑文本、简单形状和图片资产；需要时通过 image backend 做前背景分离和素材抽取。
+4. **逐页重建与自检**：页面重建者负责自己的页面目录，完成页面重建、对照源图自检和 page-local 修正，只复验改动涉及的对象及布局，通过后即停止。每页创建 manifest，重建可编辑文本、简单形状和图片资产；需要时通过 image backend 做前背景分离和素材抽取。
 5. **状态记录**：用 `editppt` 命令记录 dispatch、page result 和 accepted 状态，任务进度随时可查。
 6. **最终组装与校验**：主 agent 用 `editppt run finalize` 按页顺序读取已记录的 `manifest.json` 重建最终 `.pptx`，复制 `.pptx` 页面备注，并运行 deck validation。
 
@@ -64,7 +66,7 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 
 - 这个 skill 面向输入页面的可编辑重建，不是从零生成整套 PPT 内容——那是 [codex-ppt-skill](https://github.com/ningzimu/codex-ppt-skill) 的职责。
 - 对照片、插画、纹理、手绘装饰等复杂视觉元素，通常只能作为独立图片资产移动，不能保证内部对象可编辑。
-- 原生表格暂不支持斜线表头和单元格内嵌图片；文字、行列或合并关系不清楚时需确认，不猜测内容或结构。图表、流程图仍按可编辑结构重建。
+- 原生表格暂不支持斜线表头和单元格内嵌图片；文字、行列或合并关系不清楚时先复查源图与 OCR，仍无法辨认则报告具体缺失，不猜测内容或结构。图表、流程图仍按可编辑结构重建。
 - 部分图片元素和文字位置可能会有轻微偏移，不能保证 100% 复刻原始页面。
 - 如果约定的图片生成/编辑路径无法产出合规资产，对应页面会失败或保持阻塞；skill 不会把缺失资产降级为 warning，也不会 record、finalize 或交付不完整的替代结果。
 - 视觉相似不等于可编辑。最终判断应同时看 PPTX 结构、文本覆盖、资产来源和预览/diff。
```

---

### Incident Patch 4: `9e55ef77` (2026-09-10)
**Commit Message**: fix: preserve editable curves and PowerPoint compatibility

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -4,8 +4,18 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Features
+
+- Build native editable Bézier paths with dash styles and endpoint arrows, keeping each continuous curve in one PowerPoint object.
+
+### Fixes
+
+- Emit valid slide-size metadata and complete theme style lists to avoid PowerPoint repair prompts.
+- Render diagonal and curved dashed strokes in previews and validate path contracts, stroke styles, and declared logical-line uniqueness.
+
 ### Documentation
 
+- Specify structural curve granularity, document curve editing, and distinguish editable paths from data-linked charts.
 - Add complete Korean README and English and Korean versions of the Docsify usage documentation, with synchronized language navigation, search, and pagination. (#26)
 - Align all usage guides with the built-in-first image backend policy and block delivery when compliant image assets cannot be produced. (#26)
 - Add compact documentation, Telegram, and issue support links to all README language versions, and remove the obsolete community QR code. (#28, #29)
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@
 - `.pptx` 输入的页面备注会复制到输出对应页，备注内容不改动。
 - 根据具体页面情况决定是否通过已确认 image backend 做图片分层抽取；需要时用稀疏 asset sheet 合并前景素材，优先把图标放在一个素材板上，并保留充足间隙便于后续分离。
 - 支持复杂视觉页的混合策略：可编辑文字 + 简单形状 + 独立图片资产。
+- 支持完整的原生曲线路径、虚线样式和端点箭头，可整体调整线条形状与样式；曲线路径不等同于数据驱动图表。 在 PowerPoint 中，右键曲线选择“编辑顶点”，再点端点或顶点，拖动出现的白色控制手柄即可调整曲度。
 
 ## 适用场景
 
```

**File**: `README_en.md` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 - Preserve `.pptx` speaker notes on matching output slides without modifying note text.
 - Decides page by page whether to use the confirmed image backend for visual-layer extraction; when needed, sparse asset sheets group foreground assets, prefer placing icons on one sheet, and keep generous gaps for later splitting.
 - Supports hybrid reconstruction: editable text, simple native shapes, and independent image assets.
+- Supports complete native curve paths, dash styles, and endpoint arrows for editing a whole line’s shape and style; curve paths are not data-linked charts. In PowerPoint, right-click a curve, choose **Edit Points**, select an endpoint or vertex, and drag its white control handle to adjust curvature.
 
 ## Use Cases
 
```

**File**: `README_ko.md` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@
 - `.pptx` 입력의 페이지 노트는 내용 변경 없이 출력의 해당 페이지로 복사됩니다.
 - 페이지 상황에 따라 확인된 image backend로 이미지 레이어를 분리할지 결정합니다. 필요한 경우 희소 asset sheet로 전경 소재를 모으며, 아이콘은 충분한 간격을 둔 하나의 소재 보드에 우선 배치해 후속 분리를 쉽게 합니다.
 - 편집 가능한 텍스트 + 단순 도형 + 독립 이미지 에셋을 결합하는 복잡한 시각 페이지용 혼합 전략을 지원합니다.
+- 완전한 네이티브 곡선 경로, 점선 스타일, 끝점 화살표를 지원해 선 전체의 모양과 스타일을 조정할 수 있습니다. 곡선 경로는 데이터 연동 차트와 다릅니다. PowerPoint에서 곡선을 마우스 오른쪽 버튼으로 클릭해 **점 편집**을 선택한 뒤, 끝점이나 꼭짓점을 클릭하고 흰색 조절 핸들을 드래그하면 곡률을 바꿀 수 있습니다.
 
 ## 사용 사례
 
```

**File**: `docs/README.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ Image to Editable PPT 是一个把图片、PDF、图片版 PPT 转成**对象级
 
 - 支持多种输入：单张图片、多张图片、多页 PDF、图片版 PPT，统一输出可编辑 `.pptx`。
 - 对象级重建：文字恢复为原生文本框，简单几何恢复为 PowerPoint 形状，复杂视觉元素保留为独立图片资产，三类对象可以分开调整。
+- 支持完整的原生曲线路径、虚线样式和端点箭头，可整体调整线条形状与样式；曲线路径不等同于数据驱动图表。 在 PowerPoint 中，右键曲线选择“编辑顶点”，再点端点或顶点，拖动出现的白色控制手柄即可调整曲度。
 - 测量驱动的文字还原：通过 OCR 为每页生成文字标注（框坐标 + 字号 + 字号分组），模型按测量值还原文字，同级文字字号自动保持一致，参见[安装与配置](installation.md)的 OCR Token 一节。
 - 多页并行重建：多页输入由主 agent 分派给 page worker/subagent 并行处理；单页输入由主 agent 本地执行同一重建流程。
 - 图片生成和编辑优先调用当前 agent 的内置 `image_gen.imagegen`；只有满足约定的降级条件时才调用 `editppt image`，由 CLI 在 Codex OAuth 和 OpenAI-compatible API 之间选择后端。
```

**File**: `docs/en/README.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ If you are already using the skill and run into problems, see [FAQ](/en/faq.md).
 
 - Multiple input formats: convert a single image, multiple images, a multi-page PDF, or an image-based PowerPoint file into an editable `.pptx`.
 - Object-level reconstruction: text becomes native text boxes, simple geometry becomes PowerPoint shapes, and complex visual elements remain separate image assets, so all three object types can be adjusted independently.
+- Supports complete native curve paths, dash styles, and endpoint arrows for editing a whole line’s shape and style; curve paths are not data-linked charts. In PowerPoint, right-click a curve, choose **Edit Points**, select an endpoint or vertex, and drag its white control handle to adjust curvature.
 - Measurement-driven text restoration: OCR generates text annotations for every page, including bounding boxes, font sizes, font-size groups, and recognized text. The model reconstructs text from these measurements and automatically keeps same-level text at consistent sizes. See the OCR Token section in [Installation and Configuration](/en/installation.md).
 - Parallel multi-page reconstruction: the main agent dispatches multi-page inputs to page workers/subagents in parallel; single-page inputs use the same reconstruction flow locally in the main agent.
 - Image generation and editing prefer the current agent's built-in `image_gen.imagegen` tool. Only defined fallback conditions invoke `editppt image`, whose CLI selects between Codex OAuth and an OpenAI-compatible API.
```

**File**: `docs/ko/README.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ Image to Editable PPT는 이미지, PDF, 이미지 기반 PPT를 **객체 단위
 
 - 단일 이미지, 여러 이미지, 다중 페이지 PDF, 이미지 기반 PPT 등 다양한 입력을 지원하며 모두 편집 가능한 `.pptx`로 출력합니다.
 - 객체 단위 재구성: 텍스트는 네이티브 텍스트 상자, 단순한 도형은 PowerPoint 도형, 복잡한 시각 요소는 독립 이미지 에셋으로 복원해 세 종류를 따로 조정할 수 있습니다.
+- 완전한 네이티브 곡선 경로, 점선 스타일, 끝점 화살표를 지원해 선 전체의 모양과 스타일을 조정할 수 있습니다. 곡선 경로는 데이터 연동 차트와 다릅니다. PowerPoint에서 곡선을 마우스 오른쪽 버튼으로 클릭해 **점 편집**을 선택한 뒤, 끝점이나 꼭짓점을 클릭하고 흰색 조절 핸들을 드래그하면 곡률을 바꿀 수 있습니다.
 - 측정 기반 텍스트 복원: OCR로 각 페이지의 텍스트 주석(상자 좌표 + 글자 크기 + 크기 그룹)을 생성하고, 모델은 측정값에 따라 텍스트를 복원하며 같은 계층의 글자 크기를 자동으로 일관되게 유지합니다. 자세한 내용은 [설치 및 구성](/ko/installation.md)의 OCR Token 절을 참고하세요.
 - 다중 페이지 병렬 재구성: 다중 페이지 입력은 메인 agent가 page worker/subagent에게 병렬로 분배하고, 단일 페이지 입력은 메인 agent가 같은 재구성 흐름으로 로컬에서 처리합니다.
 - 이미지 생성과 편집은 현재 agent의 내장 `image_gen.imagegen` 도구를 우선 사용합니다. 정해진 폴백 조건을 충족할 때만 `editppt image`를 호출하며, CLI가 Codex OAuth와 OpenAI-compatible API 중 backend를 선택합니다.
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/build_pptx_from_manifest.py` (modified, +38/-37)
```diff
@@ -11,6 +11,8 @@
 from copy import deepcopy
 from pathlib import Path
 
+from path_geometry import custom_path_geometry_xml, draw_styled_path, preview_path_points, validate_shape
+
 
 EMU_PER_INCH = 914400
 REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
@@ -292,6 +294,16 @@ def fit_text_item(item, manifest):
 def normalize_manifest(manifest):
     """Return a manifest copy with pixel authoring fields resolved to inches."""
     normalized = deepcopy(manifest)
+    line_ids = set()
+    for item in normalized.get("shapes", []):
+        validate_shape(item)
+        line_id = item.get("semantic_line_id")
+        if line_id is not None:
+            if not isinstance(line_id, str) or not line_id.strip():
+                raise ValueError("semantic_line_id must be a non-empty string")
+            if line_id in line_ids:
+                raise ValueError(f"Logical line {line_id!r} is split across multiple shapes")
+            line_ids.add(line_id)
     normalized["text_boxes"] = [
         fit_text_item(normalize_position_item(normalized, item), normalized) for item in normalized.get("text_boxes", [])
     ]
@@ -317,15 +329,17 @@ def shape_fill(fill):
     return f'<a:solidFill><a:srgbClr val="{hex_color(fill)}"/></a:solidFill>'
 
 
-def shape_line_xml(stroke, width, dash=None):
+def shape_line_xml(stroke, width, dash=None, start_arrow=None, end_arrow=None):
     if not stroke or stroke == "none":
         return '<a:ln><a:noFill/></a:ln>'
     dash_xml = f'<a:prstDash val="{xml_text(dash)}"/>' if dash else ""
     return (
         f'<a:ln w="{int(float(width or 1) * 12700)}">'
         f'<a:solidFill><a:srgbClr val="{hex_color(stroke)}"/></a:solidFill>'
         f"{dash_xml}"
-        "</a:ln>"
+        + (f'<a:headEnd type="{xml_text(start_arrow)}"/>' if start_arrow else "")
+        + (f'<a:tailEnd type="{xml_text(end_arrow)}"/>' if end_arrow else "")
+        + "</a:ln>"
     )
 
 
@@ -416,6 +430,7 @@ def image_xml(idx, rel_id, item):
 
 
 def shape_xml(idx, item):
+    validate_shape(item)
     kind = item.get("type", "rect")
     left = emu(item.get("left", 0))
     top = emu(item.get("top", 0))
@@ -425,9 +440,11 @@ def shape_xml(idx, item):
     flip_h = ' flipH="1"' if item.get("flip_h") else ""
     flip_v = ' flipV="1"' if item.get("flip_v") else ""
     fill = shape_fill(item.get("fill"))
-    line = shape_line_xml(item.get("stroke", "#000000"), stroke_width, item.get("dash"))
+    line = shape_line_xml(item.get("stroke", "#000000"), stroke_width, item.get("dash"), item.get("start_arrow"), item.get("end_arrow"))
     preset = item.get("preset")
-    if item.get("polygon_px"):
+    if kind == "path":
+        geometry = custom_path_geometry_xml(item)
+    elif item.get("polygon_px"):
         geometry = custom_polygon_geometry_xml(item)
     else:
         if not preset:
@@ -625,7 +642,7 @@ def is_wide_slide(width, height):
 
 
 def slide_size_type(width, height):
-    return "wide" if is_wide_slide(width, height) else "custom"
+    return "screen16x9" if is_wide_slide(width, height) else "custom"
 
 
 def presentation_xml(slide_count, width, height):
@@ -648,7 +665,7 @@ def presentation_rels_xml(slide_count):
 
 
 def write_common_parts(z, slide_count, width, height, notes_count):
-    presentation_format = "Widescreen" if slide_size_type(width, height) == "wide" else "Custom"
+    presentation_format = "Widescreen" if is_wide_slide(width, height) else "Custom"
     z.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>""")
     z.writestr("docProps/core.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Image to editable PPT</dc:title></cp:coreProperties>""")
     z.writestr("docProps/app.xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Codex</Application><PresentationFormat>{presentation_format}</PresentationFormat><Slides>{slide_count}</Slides></Properties>""")
@@ -658,7 +675,11 @@ def write_common_parts(z, slide_count, width, height, notes_count):
     z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/pac
```

---

### Incident Patch 5: `2e3208b0` (2026-07-15)
**Commit Message**: feat: prefer built-in image generation backend (#22)

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ temp/
 !assets/**
 
 # Tool caches
+/.claude/
 .pytest_cache/
 .mypy_cache/
 .coverage
```

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Features
+
+- Prefer the agent built-in `image_gen.imagegen` tool for image generation and editing, with explicit fallback to Codex OAuth and then an OpenAI-compatible API only for defined failure conditions, while recording the actual producing backend.
+
+### Fixes
+
+- Scope `editppt image process-sheet` intermediate images and split reports by job id, and reject an existing alpha output before copying a new source sheet.
+
 ### Documentation
 
 - Add a docsify-based documentation site under `docs/` (home, quickstart, design, installation, workflow, FAQ, prompts) served via GitHub Pages, and link it from both READMEs. (#18)
```

**File**: `README.md` (modified, +10/-8)
```diff
@@ -15,7 +15,7 @@
 >
 > “替我审批”模式已知仍可能在 OCR 阶段、ChatGPT 图片生成/编辑阶段或第三方 API 调用阶段拦截请求，要求你手动审批；如果你不在电脑旁，转换流程会停住。
 >
-> 本 skill 会在转换过程中自动调用百度 PaddleOCR-VL 接口（如果已配置 Token）来校正页面文字框、字体大小和字号分组，也会调用 ChatGPT 的 gpt-image-2 图像生成/编辑接口来做前背景分离、图标/视觉素材抽取和局部图片修复。这些调用是把图片式页面重建成可编辑 PPT 的必要步骤。
+> 本 skill 会在转换过程中自动调用百度 PaddleOCR-VL 接口（如果已配置 Token）来校正页面文字框、字体大小和字号分组。图片生成/编辑会优先调用 Codex 内置 `image_gen.imagegen`；只有内置工具不可用、调用报错、编辑输入不可读或没有返回有效本地图片时，才降级到 `editppt image`（Codex OAuth → OpenAI-compatible API）。这些调用是把图片式页面重建成可编辑 PPT 的必要步骤。
 >
 > ![Codex 完全访问权限设置示意](assets/codex-full-access-permission.png)
 
@@ -62,7 +62,7 @@
 
 - 适用场景广泛，支持多种输入：单张图片、多张图片、多页 PDF、图片版PPT 到可编辑 `.pptx`。
 - 单页/单图输入可由主 agent 本地执行同一页面重建流程；多页输入由主 agent 分派给 page worker/subagent，并按 `max_concurrent_pages` 并行处理。
-- 图片生成和编辑统一通过 `editppt image` CLI 完成；CLI 会优先使用本机 Codex OAuth，缺失时再使用 OpenAI-compatible API 配置。
+- 图片生成和编辑优先使用 Codex 内置 `image_gen.imagegen`；满足明确降级条件时才进入 `editppt image` CLI，由 CLI 依次选择本机 Codex OAuth 和 OpenAI-compatible API。
 - 第三方 API fallback 配置保存在 `~/.editppt/config.yaml`；Windows 下对应 `%USERPROFILE%\.editppt\config.yaml`。
 - 文字大小与位置由测量驱动：prepare 阶段为每页生成文字标注（框坐标 + 字号 + 字号分组），模型按测量值还原文字，同级文字字号自动保持一致。
 - 多张图片按提供顺序生成页面；PDF 和 `.pptx` 保留原页码顺序。
@@ -81,16 +81,18 @@
 ## 运行要求
 
 - 单页/单图输入不需要创建 page worker，但仍必须走同一页面 prompt、产物和 `editppt run record` 校验流程。多页输入需要 agent 能分派 page worker/subagent；如果不能创建 page worker，应换到支持 page worker 的环境执行。
-- 复杂背景补全、前景图标提取、透明 asset sheet 和局部图片编辑统一走串行 `editppt image edit/generate` 调用。
-- 如果本机有 Codex OAuth（`~/.codex/auth.json`），CLI 会直接使用；否则使用 API fallback。
+- 复杂背景补全、前景图标提取、透明 asset sheet 和局部图片编辑按页面串行执行，并优先使用内置 `image_gen.imagegen`。
+- 内置工具满足降级条件时才进入 CLI fallback；如果本机有 Codex OAuth（`~/.codex/auth.json`），CLI 会直接使用，否则使用 API fallback。
 - API fallback 配置保存在 `~/.editppt/config.yaml`；Windows 下对应 `%USERPROFILE%\.editppt\config.yaml`。
 - 文字大小与位置的校正需要一个第三方 OCR Token（百度 AI Studio，免费），详见下文「文字校正与 OCR Token」；未配置时退化为内置离线检测，文字还原质量会打折扣。
 
 ## 图片 Backend 与第三方 API 配置
 
-`editppt image` 会自动选择图片后端：优先使用本机 Codex OAuth；如果不可用，再读取 `~/.editppt/config.yaml` 或环境变量里的 OpenAI-compatible API 配置。
+完整后端优先级是：Codex 内置 `image_gen.imagegen` → Codex OAuth → OpenAI-compatible API。内置工具由 agent 直接调用，Python/`editppt` CLI 不能调用或探测它；只有内置工具不可用/不可调用、调用报错、编辑输入不可读或没有返回有效本地图片时，才进入 `editppt image` CLI fallback。CLI 内部优先使用本机 Codex OAuth；如果不可用，再读取 `~/.editppt/config.yaml` 或环境变量里的 OpenAI-compatible API 配置。
 
-`editppt image generate/edit` 的公开参数面保持精简：请求输入只需要 `--prompt` 或 `--prompt-file`，编辑图还需要 `--image`；页面重建时应显式传 `--out`。实用控制只保留 `--model`、`--size`、`--quality`、`--force`、`--dry-run`、`--timeout`，以及编辑图专用的 `--mask`。CLI 不会透传其它 image API 选项。
+内置生图只需要 `prompt`；内置编辑图只需要 `prompt` 和本地绝对路径 `referenced_image_paths`，并且编辑前必须先查看输入图。内置工具没有 `mask`、`model`、`size`、`quality`、`out` 等参数，缺少这些参数绝不触发 fallback。成功后只接收工具明确返回的本地路径（包括 `output_hint`），验证文件有效再导入；不会扫描目录猜测“最新文件”。
+
+CLI fallback 的 `editppt image generate/edit` 参数面保持精简：请求输入只需要 `--prompt` 或 `--prompt-file`，编辑图还需要 `--image`；页面重建时应显式传 `--out`。实用控制只保留 `--model`、`--size`、`--quality`、`--force`、`--dry-run`、`--timeout`，以及编辑图专用的 `--mask`。CLI 不会透传其它 image API 选项。
 
 通常不需要你自己配置。只有这些情况才需要让 AI 帮你配置 API fallback：
 
@@ -113,7 +115,7 @@
 ## 已知问题
 
 - 其他 agent 需要支持 skill 加载、文件读写和 CLI 执行；多页任务还需要 page worker/subagent 分派机制。
-- Codex OAuth 路径依赖本机 Codex auth 和订阅侧图片额度；API fallback 依赖所选 OpenAI-compatible 服务的图片生成/编辑能力。
+- 内置图片工具依赖当前 agent runtime 是否提供 `image_gen.imagegen`；Codex OAuth 路径依赖本机 Codex auth 和订阅侧图片额度；API fallback 依赖所选 OpenAI-compatible 服务的图片生成/编辑能力。
 - 本 skill有着相对复杂的流程控制，Token花费比较高。将一个图片PPT转换成可编辑PPT的成本，**可能是生成图片PPT成本的2-3倍**。
 - 受限于模型基础理解能力和对 skill 的遵循能力，**不保证 gpt-5.5 以下模型的使用效果**。
 - 部分图片元素和文字位置可能会有轻微偏移，**不能保证 100% 复刻原始页面**。
@@ -199,7 +201,7 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 
 - 这个 skill 面向输入页面的可编辑重建，不是从零生成整套 PPT 内容。
 - 单页/单图输入可由主 agent 本地重建；多页输入通过 page worker/subagent 并行重建。
-- 复杂视觉资产需要可用 `editppt image` backend；如果缺少图片生成/编辑能力，仍应先交付当前可打开、结构有效的 PPT，并在验证结果里说明缺失资产。
+- 复杂视觉资产需要可用的内置图片工具或 CLI fallback；如果两者都无法生成合规资产，对应页面会校验失败，不会用近似图形替代。
 - 对照片、插画、纹理、手绘装饰等复杂视觉元素，通常只能作为独立图片资产移动，不能保证内部对象可编辑。
 - 对表格、图表、流程图等结构化区域，会优先保留可编辑语义，但低置信度时应保留为资产并在验证报告里说明。
 - 视觉相似不等于可编辑。最终判断应同时看 PPTX 结构、文本覆盖、资产来源和预览/diff。
```

**File**: `README_en.md` (modified, +10/-8)
```diff
@@ -15,7 +15,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 >
 > "Approve for me" mode is also known to still block some OCR requests, ChatGPT image generation/editing requests, or third-party API calls until you manually approve them. If you are away from the computer, the conversion may stall.
 >
-> During conversion, this skill automatically calls Baidu PaddleOCR-VL (when a token is configured) to correct text boxes, font sizes, and size groups. It also calls ChatGPT gpt-image-2 image generation/editing for foreground/background separation, icon or visual-asset extraction, and local image repair. These calls are required for reconstructing image-based pages into editable PPT files.
+> During conversion, this skill automatically calls Baidu PaddleOCR-VL (when a token is configured) to correct text boxes, font sizes, and size groups. Image generation/editing prefers Codex's built-in `image_gen.imagegen`; it falls back to `editppt image` (Codex OAuth -> OpenAI-compatible API) only when the built-in tool is unavailable, errors, cannot read an edit input, or returns no valid local image. These calls are required for reconstructing image-based pages into editable PPT files.
 >
 > ![Codex Full Access permission setting](assets/codex-full-access-permission.png)
 
@@ -62,7 +62,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 
 - Broad input coverage for many slide-reconstruction scenarios: one image, multiple images, multi-page PDFs, and image-based PPT files into editable `.pptx`.
 - Single-page or single-image input can be rebuilt locally by the main agent through the same page workflow; multi-page input is dispatched by the main agent to page workers/subagents, in parallel according to `max_concurrent_pages`.
-- Image generation and editing are unified through the `editppt image` CLI. The CLI uses local Codex OAuth first, then OpenAI-compatible API fallback when Codex auth is unavailable.
+- Image generation and editing prefer Codex's built-in `image_gen.imagegen`. Only defined fallback conditions enter the `editppt image` CLI, which then selects local Codex OAuth before an OpenAI-compatible API.
 - Third-party API fallback configuration lives in `~/.editppt/config.yaml`; on Windows this is `%USERPROFILE%\.editppt\config.yaml`.
 - Text sizes and positions are measurement-driven: prepare generates per-page text annotations (box coordinates + font sizes + size groups), and same-level text keeps one consistent size automatically.
 - Keep multiple images in the provided order; preserve PDF and `.pptx` page order.
@@ -81,16 +81,18 @@ It is useful when screenshot-like or image-based slides need to become easier to
 ## Runtime Requirements
 
 - Single-page or single-image input does not require creating a page worker, but it still must use the same page prompt, artifacts, and `editppt run record` validation flow. Multi-page input requires the agent to dispatch page workers/subagents; if page workers cannot be created, run the skill in an environment that supports page workers.
-- Complex background cleanup, foreground icon extraction, transparent asset sheets, and local image edits use serial `editppt image edit/generate` calls.
-- If local Codex OAuth exists (`~/.codex/auth.json`), the CLI uses it directly; otherwise it uses API fallback.
+- Complex background cleanup, foreground icon extraction, transparent asset sheets, and local image edits run serially per page and prefer the built-in `image_gen.imagegen` tool.
+- The CLI fallback is entered only for a defined built-in failure. If local Codex OAuth exists (`~/.codex/auth.json`), the CLI uses it directly; otherwise it uses API fallback.
 - API fallback configuration lives in `~/.editppt/config.yaml`; on Windows this is `%USERPROFILE%\.editppt\config.yaml`.
 - Correcting text sizes and positions relies on a third-party OCR token (Baidu AI Studio, free) — see "Text Correction And OCR Token" below. Without it the skill falls back to the built-in offline detector with reduced text fidelity.
 
 ## Image Backend And Third-Party API Configuration
 
-`editppt image` selects the image backend automatically: it uses local Codex OAuth first, then falls back to OpenAI-compatible API settings from `~/.editppt/config.yaml` or environment variables.
+The complete backend order is Codex's built-in `image_gen.imagegen` -> Codex OAuth -> OpenAI-compatible API. The agent calls the built-in tool directly; Python and the `editppt` CLI cannot call or detect it. The workflow enters the `editppt image` CLI fallback only when the built-in tool is unavailable/not callable, its call errors, an edit input is unreadable, or it returns no valid local image. Inside the CLI fallback, local Codex OAuth is selected first, followed by OpenAI-compatible API settings from `~/.editppt/config.yaml` or environment variables.
 
-The public `editppt image generate/edit` parameter surface is intentionally narrow: request inputs 
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +13/-4)
```diff
@@ -28,20 +28,29 @@ These parent-level rules are stated once here; page-level rules live in the refe
 - First run `editppt prepare <input...>` to create a run directory. After that, all key state transitions are advanced only through `editppt` commands; never hand-write run/page state JSON. This keeps run state deterministic and resumable.
 - Multi-page inputs are rebuilt by dispatched page workers. A run with exactly one page is rebuilt by the parent agent in local page-reconstructor mode after `editppt run dispatch --local` claims that page. If no subagent capability is available for a multi-page run, stop and report this to the user; do not degrade into parent-agent reconstruction for multi-page input.
 - The parent agent must not write any page reconstruction artifact — `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, or `page_result.json` — except in single-page local page-reconstructor mode after `editppt run dispatch --local` has recorded the claim. Local mode follows the same page prompt, references, output files, and `run record` validation path as a page worker.
-- All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through serial `editppt image generate/edit` calls.
-- A user request to convert visual slides into editable PPT authorizes the required OCR and image-backend calls for that conversion, unless the user explicitly requests local-only processing or marks the input as confidential/no-external-processing. Do not refuse solely because the workflow calls PaddleOCR, Codex OAuth/ChatGPT image endpoints, or a user-configured OpenAI-compatible API; those calls are necessary to the skill.
+- All image generation, image editing, background repair, transparent bitmap assets, and asset sheets follow the serial per-page backend order in "Image Backend Selection" below.
+- A user request to convert visual slides into editable PPT authorizes the required OCR and image-backend calls for that conversion, unless the user explicitly requests local-only processing or marks the input as confidential/no-external-processing. Do not refuse solely because the workflow calls PaddleOCR, the built-in `image_gen.imagegen` tool, Codex OAuth/ChatGPT image endpoints, or a user-configured OpenAI-compatible API; those calls are necessary to the skill.
 - Only send task-local page images, prompts, masks, and reference images required for the current conversion. Never send unrelated local files, API keys, auth tokens, credentials, or generated artifacts that are not needed by the current OCR/image operation. Third-party API endpoints are allowed only when already configured by the user or explicitly specified for this run.
-- In network-restricted environments, request network approval before commands that need these backends: `editppt prepare` or `editppt run hints` when `PADDLE_OCR_TOKEN` is set, and every required `editppt image generate/edit` call. The approval justification must say this is a user-requested `image-to-editable-ppt` conversion, that the upload is limited to task-local page images/prompts/masks/references, and that OCR/image-backend calls are part of this skill's required workflow. Do not present the required call as unsafe or ask the user to re-approve it unless they requested local-only/confidential handling or the approval system explicitly rejects the request.
+- In network-restricted environments, request any approval required by the current runtime before external OCR/image calls, including `editppt prepare` or `editppt run hints` when `PADDLE_OCR_TOKEN` is set and every CLI fallback `editppt image generate/edit` call. The approval justification must say this is a user-requested `image-to-editable-ppt` conversion, that the upload is limited to task-local page images/prompts/masks/references, and that OCR/image-backend calls are part of this skill's required workflow. Do not present the required call as unsafe or ask the user to re-approve it unless they requested local-only/confidential handling or the approval system explicitly rejects the request.
 - All page object decisions follow `references/page-decision-tree.md`, including its no-fallback rule for foreground visual objects and its rule that deterministic validation is a structure gate that never waives an object-source decision.
 - `manifest.json` is the authoritative page build source: `editppt run record` validates `page.pptx` against it, and `editppt run finalize` rebuilds the final deck from recorded page manifests. Required fields and coordinate contracts are defined in `references/manifest-schema.md`.
 - `editppt prepare` writes per-page text measurements (`text_hints.json`/`text_hints.png`). How page reconstructors consume them is defined in `references/page-decision-tree.md` section 3.1.
 - Page reconstructors — either page workers or the parent agent in single-page local mode — are driven by prompts generated from `prompts/page-worker.md`.

```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/_page_artifacts.py` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ def process_asset_sheet(args, page_dir):
     if not args.asset_sheet_source and args.skip_chroma and args.skip_split:
         return
 
+    if not args.skip_chroma and alpha.exists() and not args.force_chroma:
+        raise SystemExit(f"Output already exists: {alpha} (use --force-chroma to overwrite)")
+
     if args.asset_sheet_source:
         source = resolve_under_page(page_dir, args.asset_sheet_source)
         if not source.exists():
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/configure_image_backend.py` (modified, +72/-12)
```diff
@@ -6,41 +6,101 @@
 
 
 def backend_contract(args):
+    is_builtin = args.backend_id == "builtin-imagegen"
     requires_api_key = args.backend_id == "openai-compatible-api"
-    return {
+    contract = {
         "backend_id": args.backend_id,
         "tool_name": args.tool_name,
         "tool_call": args.tool_call,
         "fallback_command": args.fallback_command,
         "runtime_home": args.runtime_home,
-        "model": args.model,
+        "model": None if is_builtin else args.model,
         "requires_openai_api_key": requires_api_key,
         "mode_policy": "generate-or-edit-per-asset",
         "chroma_key_helper": "editppt image process-sheet",
         "input_context_policy": args.input_context_policy,
-        "save_path_policy": "write outputs directly to page dir or copy selected outputs before manifest references them",
-        "handoff_rule": "call editppt image generate/edit serially; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second",
+        "save_path_policy": (
+            "accept only an explicit output_hint or local path returned by image_gen.imagegen, verify it exists, "
+            "import the selected output, and never scan for the newest file"
+            if is_builtin
+            else "write outputs directly to page dir or copy selected outputs before manifest references them"
+        ),
+        "handoff_rule": (
+            "call image_gen.imagegen serially, then import the selected local output; "
+            "use editppt image generate/edit only when the built-in tool fallback policy applies"
+            if is_builtin
+            else "call editppt image generate/edit serially; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second"
+        ),
     }
+    if is_builtin:
+        contract.update(
+            {
+                "fallback_order": ["codex-oauth", "openai-compatible-api"],
+                "required_parameters": {
+                    "generate": ["prompt"],
+                    "edit": ["prompt", "referenced_image_paths"],
+                },
+                "fallback_policy": {
+                    "on": [
+                        "tool-unavailable",
+                        "tool-error",
+                        "input-unreadable",
+                        "no-valid-local-output",
+                    ],
+                    "missing_optional_parameters": False,
+                },
+            }
+        )
+    return contract
 
 
 def main():
     parser = argparse.ArgumentParser(description="Record the run-level image backend contract.")
     parser.add_argument("run")
-    parser.add_argument("--backend-id", default="editppt-image-cli", choices=["editppt-image-cli", "openai-compatible-api"])
+    parser.add_argument(
+        "--backend-id",
+        default="editppt-image-cli",
+        choices=["builtin-imagegen", "editppt-image-cli", "openai-compatible-api"],
+    )
     parser.add_argument("--tool-name")
     parser.add_argument("--tool-call")
     parser.add_argument("--model", default="gpt-image-2")
     parser.add_argument("--fallback-command")
     parser.add_argument("--runtime-home", default="~/.editppt")
-    parser.add_argument("--input-context-policy", default="pass edit targets and strict visual references via editppt image edit --image")
+    parser.add_argument("--input-context-policy")
     args = parser.parse_args()
 
-    if args.tool_name is None:
-        args.tool_name = "editppt image"
-    if args.tool_call is None:
-        args.tool_call = "editppt image generate/edit"
-    if args.fallback_command is None:
-        args.fallback_command = "editppt image"
+    if args.backend_id == "builtin-imagegen":
+        fixed_field_overrides = [
+            flag
+            for flag, value in (
+                ("--tool-name", args.tool_name),
+                ("--tool-call", args.tool_call),
+                ("--fallback-command", args.fallback_command),
+                ("--input-context-policy", args.input_context_policy),
+            )
+            if value is not None
+        ]
+        if fixed_field_overrides:
+            parser.error(
+                f"{', '.join(fixed_field_overrides)} cannot override the fixed builtin-imagegen contract"
+            )
+        args.tool_name = "image_gen.imagegen"
+        args.tool_call = "image_gen.imagegen"
+        args.fallback_command = "editppt image generate/edit"
+        args.input_context_policy = (
+            "generation needs prompt; for editing inspect every local input with view_image first, then pass "
+            "prompt plus absolute local paths in referenced_image_paths"
+        )
+    else:
+        if args.tool_name is None:
+            args.tool_name = "editppt image"
+        if args.tool_call is None:
+            args.tool_call = "editppt image generate/edit"
+        if args.fallback_command is None:
+            args.fallback_command = "editppt image"
+        if args.input_context_policy is 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py` (modified, +28/-15)
```diff
@@ -143,7 +143,7 @@ def cmd_prepare(args: argparse.Namespace) -> int:
     return cmd_backend(
         argparse.Namespace(
             run=str(deck_path.parent),
-            mode="editppt-image-cli",
+            mode=args.image_backend,
             tool_name=None,
             tool_call=None,
             model=None,
@@ -391,10 +391,10 @@ def build_parser() -> argparse.ArgumentParser:
         formatter_class=HELP_FORMATTER,
         epilog="""Command groups:
   - setup/doctor/config manage the local editppt environment and API fallback config.
-  - prepare creates a run directory and writes the unified editppt image backend.
+  - prepare creates a run directory and writes the selected image backend contract.
   - run manages deterministic workflow state, dispatch records, result records, and finalization.
   - page measures text geometry: hints reports text line boxes and font sizes from source ink.
-  - image generates/edits through Codex OAuth first, then API fallback, and processes image files.
+  - image is the Codex OAuth/OpenAI-compatible CLI fallback and processes image files.
   - formula renders LaTeX formulas into PPT image assets and manifest fragments.
 
 Examples:
@@ -429,7 +429,7 @@ def build_parser() -> argparse.ArgumentParser:
   editppt setup --check-api
 """,
     )
-    setup.add_argument("--check-api", action="store_true", help="Require API fallback credentials in doctor.")
+    setup.add_argument("--check-api", action="store_true", help="Require CLI fallback credentials in doctor.")
     setup.set_defaults(func=cmd_setup)
 
     doctor = sub.add_parser(
@@ -438,8 +438,8 @@ def build_parser() -> argparse.ArgumentParser:
         description="""Check the local editppt environment.
 
 Doctor reports the CLI Python path, importable dependencies, config home/file,
-and API fallback readiness when --check-api is passed. It does not
-perform a network API probe by default.
+and CLI fallback readiness when --check-api is passed. It cannot detect the
+Agent-only image_gen.imagegen tool and does not perform a network API probe.
 """,
         formatter_class=HELP_FORMATTER,
         epilog="""Examples:
@@ -448,7 +448,7 @@ def build_parser() -> argparse.ArgumentParser:
   editppt doctor --check-api
 """,
     )
-    doctor.add_argument("--check-api", action="store_true", help="Require API fallback credentials to be configured.")
+    doctor.add_argument("--check-api", action="store_true", help="Require Codex OAuth or OpenAI-compatible API credentials for the CLI fallback.")
     doctor.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
     doctor.add_argument("--timeout", type=int, help="Reserved timeout value for future network probes.")
     doctor.set_defaults(func=cmd_doctor)
@@ -482,12 +482,13 @@ def build_parser() -> argparse.ArgumentParser:
         description="""Normalize input into an editable-PPT reconstruction run.
 
 This command creates the run directory, copies inputs, writes deck/page manifests,
-extracts note metadata when applicable, and records the default editppt image
-CLI backend. The normal path does not require a separate backend command.
+extracts note metadata when applicable, and records the selected image backend
+contract. The standalone CLI default is editppt-image-cli.
 """,
         formatter_class=HELP_FORMATTER,
         epilog="""Examples:
   editppt prepare slide.png
+  editppt prepare slide.png --image-backend builtin-imagegen
   editppt prepare deck.pdf --max-concurrent-pages 3
   editppt prepare a.png b.png --out-root output/image-to-editable-ppt
 """,
@@ -497,6 +498,12 @@ def build_parser() -> argparse.ArgumentParser:
     prepare.add_argument("--job-dir", metavar="DIR", help="Use an explicit run directory instead of auto-generating one.")
     prepare.add_argument("--dpi", type=int, metavar="N", help="Rasterization DPI for PDF/PPT inputs.")
     prepare.add_argument("--max-concurrent-pages", type=int, metavar="N", help="Maximum concurrent page dispatch slots. Default: 6.")
+    prepare.add_argument(
+        "--image-backend",
+        choices=["builtin-imagegen", "editppt-image-cli"],
+        default="editppt-image-cli",
+        help="Run-level image backend contract. Defaults to editppt-image-cli; parent agents can select builtin-imagegen.",
+    )
     prepare.add_argument("--no-text-hints", action="store_true", help="Skip per-page text hint generation after preparing pages.")
     prepare.set_defaults(func=cmd_prepare)
 
@@ -538,22 +545,28 @@ def build_parser() -> argparse.ArgumentParser:
         description="""Configure deck_manifest.json.image_backend and copy it into page requests.
 
 Normally editppt prepare records the unified editppt image CLI backend automatically.
-Use this only when forcing OpenAI-compatible API metadata or a custom image backend.
+Use this when a parent Agent selects image_gen.imagegen or when forcing other backend metadata.
 """,
         formatter_class=HELP_FORMATTER,
         epilog=
```

---

### Incident Patch 6: `35df4561` (2026-07-11)
**Commit Message**: fix: correct PowerPoint text alignment (#17)

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Fixes
+
+- Translate manifest text alignment values to valid DrawingML enums, center preview text within its box, and reject unsupported alignment values during page validation. (#17)
+
 ## 0.3.1
 
 ### Improvements
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/build_pptx_from_manifest.py` (modified, +86/-18)
```diff
@@ -19,6 +19,23 @@
 DEFAULT_TEXT_FIT_SAFETY = 0.9
 DEFAULT_TEXT_LINE_HEIGHT = 1.22
 DEFAULT_MIN_FONT_SIZE = 4.0
+TEXT_ALIGNMENTS = {
+    "left": ("l", "left"),
+    "center": ("ctr", "center"),
+    "right": ("r", "right"),
+    "l": ("l", "left"),
+    "ctr": ("ctr", "center"),
+    "r": ("r", "right"),
+}
+TEXT_VERTICAL_ALIGNMENTS = {
+    "top": ("t", "top"),
+    "middle": ("ctr", "middle"),
+    "center": ("ctr", "middle"),
+    "bottom": ("b", "bottom"),
+    "t": ("t", "top"),
+    "ctr": ("ctr", "middle"),
+    "b": ("b", "bottom"),
+}
 
 
 def emu(value):
@@ -53,6 +70,20 @@ def xml_text(value):
     return html.escape(str(value), quote=True)
 
 
+def text_alignment(value="left"):
+    key = str(value or "left").strip().lower()
+    if key not in TEXT_ALIGNMENTS:
+        raise ValueError(f"Unsupported text align value: {value}")
+    return TEXT_ALIGNMENTS[key]
+
+
+def text_vertical_alignment(value="top"):
+    key = str(value or "top").strip().lower()
+    if key not in TEXT_VERTICAL_ALIGNMENTS:
+        raise ValueError(f"Unsupported text valign value: {value}")
+    return TEXT_VERTICAL_ALIGNMENTS[key]
+
+
 def source_size_px(manifest):
     source = manifest.get("source", {})
     width = source.get("width_px")
@@ -318,8 +349,8 @@ def text_box_xml(idx, item):
     rotation_attr = f' rot="{int(float(rotation) * 60000)}"' if rotation not in (None, "") else ""
     font_size = int(float(item.get("font_size", 18)) * 100)
     font = xml_text(item.get("font", "PingFang SC"))
-    align = item.get("align", "left")
-    anchor = item.get("valign", "top")
+    align = text_alignment(item.get("align", "left"))[0]
+    anchor = text_vertical_alignment(item.get("valign", "top"))[0]
     wrap = item.get("wrap", "none")
     autofit = item.get("autofit", "none")
     autofit_xml = "<a:spAutoFit/>" if autofit == "shape" else "<a:noAutofit/>"
@@ -823,12 +854,34 @@ def render_text(item):
         else:
             preview_text = item.get("text", "")
         fill = preview_color(item.get("color", "#111111"))
-        align = item.get("align", "left") if item.get("align", "left") in ("left", "center", "right") else "left"
-        x = int(item.get("left", 0) * scale)
-        y = int(item.get("top", 0) * scale)
+        align = text_alignment(item.get("align", "left"))[1]
+        valign = text_vertical_alignment(item.get("valign", "top"))[1]
+        box_x = int(item.get("left", 0) * scale)
+        box_y = int(item.get("top", 0) * scale)
+        box_width = max(1, int(item.get("width", 1) * scale))
+        box_height = max(1, int(item.get("height", 0.4) * scale))
         rotation = float(item.get("rotation", 0) or 0)
-        if item.get("runs") and not rotation:
-            cursor_x = x
+
+        def aligned_origin(bounds, origin_x, origin_y):
+            text_width = bounds[2] - bounds[0]
+            text_height = bounds[3] - bounds[1]
+            if align == "center":
+                text_x = origin_x + (box_width - text_width) // 2 - bounds[0]
+            elif align == "right":
+                text_x = origin_x + box_width - text_width - bounds[0]
+            else:
+                text_x = origin_x
+            if valign == "middle":
+                text_y = origin_y + (box_height - text_height) // 2 - bounds[1]
+            elif valign == "bottom":
+                text_y = origin_y + box_height - text_height - bounds[1]
+            else:
+                text_y = origin_y
+            return text_x, text_y
+
+        run_specs = []
+        if item.get("runs"):
+            cursor_x = 0
             base_size = size
             for run in item["runs"]:
                 run_size = max(1, int(float(run.get("font_size", item.get("font_size", 18))) * scale / 72 * preview_font_scale))
@@ -839,21 +892,36 @@ def render_text(item):
                     run_font = font
                 run_fill = preview_color(run.get("color", item.get("color", "#111111")))
                 baseline = float(run.get("baseline", 0) or 0)
-                run_y = y + int(-baseline / 100000 * base_size)
+                run_y = int(-baseline / 100000 * base_size)
                 run_text = str(run.get("text", ""))
-                draw.text((cursor_x, run_y), run_text, fill=run_fill, font=run_font)
-                cursor_x += int(draw.textlength(run_text, font=run_font))
-            return
+                run_specs.append((cursor_x, run_y, run_text, run_fill, run_font, run_font.getbbox(run_text)))
+                cursor_x += int(round(draw.textlength(run_text, font=run_font)))
+
+        def draw_content(target_draw, origin_x, origin_y):
+            if run_specs:
+                bounds = (
+                    min(spec[0] + spec[5][0] for spec in run_specs),
+                    min(spec[1] + spec[5][1] for spec in run_specs),
+                    max(spec[0] + spec[5][2] for spec in run_specs),
+                    max(spec[1] + spec[5][3] for spec in run_specs),
+                )
+                text_x,
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/validate_pptx.py` (modified, +19/-1)
```diff
@@ -8,7 +8,7 @@
 from pathlib import Path
 from xml.etree import ElementTree as ET
 
-from build_pptx_from_manifest import normalize_manifest
+from build_pptx_from_manifest import TEXT_ALIGNMENTS, TEXT_VERTICAL_ALIGNMENTS, normalize_manifest
 
 
 NS = {
@@ -322,6 +322,24 @@ def quality_contract_violations(manifest):
                     }
                 )
 
+    for index, text_box in enumerate(manifest.get("text_boxes", [])):
+        align = str(text_box.get("align", "left") or "left").strip().lower()
+        if align not in TEXT_ALIGNMENTS:
+            violations.append(
+                {
+                    "field": f"text_boxes[{index}].align",
+                    "reason": "text align must be left, center, right, or the equivalent DrawingML token l, ctr, r",
+                }
+            )
+        valign = str(text_box.get("valign", "top") or "top").strip().lower()
+        if valign not in TEXT_VERTICAL_ALIGNMENTS:
+            violations.append(
+                {
+                    "field": f"text_boxes[{index}].valign",
+                    "reason": "text valign must be top, middle, bottom, or the equivalent DrawingML token t, ctr, b",
+                }
+            )
+
     violations.extend(foreground_asset_contract_violations(manifest))
     return violations
 
```

**File**: `skills/image-to-editable-ppt/references/manifest-schema.md` (modified, +17/-0)
```diff
@@ -2,6 +2,17 @@
 
 This document describes the responsibilities, owners, and current field contracts for `editppt` run/page JSON files. All key state is advanced by `editppt` commands; page reconstructors write only page-local files.
 
+## Contents
+
+- `deck_manifest.json`
+- `page_jobs.json`
+- `page_request.json`
+- `page_result.json`
+- `pages/page_NNN/validation.json`
+- `pages/page_NNN/manifest.json`
+- `pages/page_NNN/imagegen-jobs.json`
+- `notes_manifest.json`
+
 ## `deck_manifest.json`
 
 Owner: created by `editppt prepare`; `editppt run backend` may update the image backend; `editppt run finalize` reads it and writes completion time.
@@ -187,6 +198,12 @@ Text-size fitting:
 - `text_boxes[].box_px` should describe the source text bounds plus modest padding. Do not use an entire card, chart, table cell group, or unrelated container as the text box, because the fitter can only infer size from the box it receives.
 - Optional tuning fields are `min_font_size`, `max_font_size`, `text_fit_safety`, and `line_height`.
 
+Text alignment:
+
+- `text_boxes[].align` accepts `left`, `center`, or `right` (default `left`). The equivalent DrawingML tokens `l`, `ctr`, and `r` are also accepted.
+- `text_boxes[].valign` accepts `top`, `middle`, or `bottom` (default `top`); `center` is an alias for `middle`. The equivalent DrawingML tokens `t`, `ctr`, and `b` are also accepted.
+- The deterministic builder translates these manifest values to valid DrawingML enum tokens. Unsupported values are page-contract violations instead of silently falling back to an application default.
+
 `text_inventory` may be a list of strings or a list of structured objects. In structured objects, the fields used for exact text validation are `text`, `required_text`, `items`, or `texts`; fields such as `id`, `decision`, `description`, and `note` are only records and are not used for exact text matching. Example:
 
 ```json
```

**File**: `skills/image-to-editable-ppt/references/page-decision-tree.md` (modified, +3/-0)
```diff
@@ -223,6 +223,8 @@ A readable character stroke belongs only to its native text box — never draw t
 
 Preserve grouping relationships (icon + circular base, badge + number, speech bubble + text, hand-drawn arrow + annotation, card background + title + chart + labels).
 
+For native text centered inside a badge or circular base, reuse the base shape's exact `box_px` for the text box and use the centered horizontal and vertical alignment defined in `manifest-schema.md` under "Text alignment." A separate tight ink box drifts as font metrics change and is not a stable grouping relationship.
+
 Recommended z-index:
 
 - clean background/base: 0
@@ -267,6 +269,7 @@ Shapes and layers:
 - Corners follow 3.4; large container corners, table borders, and card borders align with the source. Corner misclassification is a current-page fix, not a low-risk warning.
 - No text stroke is redrawn as a decorative shape (3.5).
 - Dashboards, tables, cards, and charts are decomposed per 1.4, never screenshotted wholesale.
+- Badge and circular-number groups follow the shared-box centering rule in 3.6.
 - z-index follows 3.6; no text or key object is covered.
 
 ## Fix versus Warning
```

**File**: `tests/test_quality_contracts.py` (modified, +17/-0)
```diff
@@ -144,6 +144,23 @@ def test_structured_text_inventory_flattens_to_required_strings(self):
         )
         self.assertEqual(["市场概览", "4280 万", "扩张", "续约"], required)
 
+    def test_invalid_text_alignment_is_a_contract_violation(self):
+        manifest = base_manifest()
+        manifest["text_boxes"] = [
+            {
+                "text": "1",
+                "box_px": [0, 0, 40, 40],
+                "align": "sideways",
+                "valign": "floating",
+            }
+        ]
+
+        violations = quality_contract_violations(manifest)
+        fields = {item["field"] for item in violations}
+
+        self.assertIn("text_boxes[0].align", fields)
+        self.assertIn("text_boxes[0].valign", fields)
+
 
 if __name__ == "__main__":
     unittest.main()
```

**File**: `tests/test_slide_layout.py` (modified, +144/-1)
```diff
@@ -1,16 +1,55 @@
 import sys
+import tempfile
 import unittest
 from pathlib import Path
 
+from PIL import Image
+
 
 ROOT = Path(__file__).resolve().parents[1]
 RUNTIME_DIR = ROOT / "skills/image-to-editable-ppt/cli/editppt/runtime"
 sys.path.insert(0, str(RUNTIME_DIR))
 
-from build_pptx_from_manifest import content_box_for_manifest, emu, normalize_manifest, px_to_inches, slide_size_type  # noqa: E402
+from build_pptx_from_manifest import (  # noqa: E402
+    content_box_for_manifest,
+    emu,
+    normalize_manifest,
+    px_to_inches,
+    render_preview,
+    slide_size_type,
+    text_box_xml,
+)
 from prepare_deck_run import fit_content_box, slide_for_source  # noqa: E402
 
 
+def scalable_test_font():
+    candidates = (
+        "/System/Library/Fonts/Supplemental/Arial.ttf",
+        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
+    )
+    return next((path for path in candidates if Path(path).exists()), None)
+
+
+def preview_ink_center(manifest):
+    with tempfile.TemporaryDirectory() as tmp:
+        preview_path = Path(tmp) / "preview.png"
+        render_preview(manifest, Path(tmp) / "manifest.json", preview_path)
+        image = Image.open(preview_path).convert("RGB")
+
+    dark_pixels = [
+        (x, y)
+        for y in range(image.height)
+        for x in range(image.width)
+        if max(image.getpixel((x, y))) < 128
+    ]
+    if not dark_pixels:
+        return None
+    xs = [point[0] for point in dark_pixels]
+    ys = [point[1] for point in dark_pixels]
+    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
+
+
 class SlideLayoutTest(unittest.TestCase):
     def test_non_wide_source_uses_source_pixel_size(self):
         slide = slide_for_source(1536, 1024)
@@ -118,6 +157,110 @@ def test_wrapped_text_fit_does_not_force_single_line_width(self):
         self.assertGreater(normalized["text_boxes"][0]["font_size"], 10)
         self.assertLessEqual(normalized["text_boxes"][0]["font_size"], 18)
 
+    def test_text_box_alignment_uses_drawingml_enum_values(self):
+        xml = text_box_xml(
+            2,
+            {
+                "text": "1",
+                "left": 0,
+                "top": 0,
+                "width": 1,
+                "height": 1,
+                "align": "center",
+                "valign": "middle",
+            },
+        )
+
+        self.assertIn('algn="ctr"', xml)
+        self.assertIn('anchor="ctr"', xml)
+        self.assertNotIn('algn="center"', xml)
+        self.assertNotIn('anchor="middle"', xml)
+
+    def test_preview_centers_text_inside_its_box(self):
+        manifest = {
+            "source": {"width_px": 200, "height_px": 200},
+            "slide": {"width": 2, "height": 2, "background": "#ffffff"},
+            "content_box": {"left": 0, "top": 0, "width": 2, "height": 2},
+            "preview_scale": 100,
+            "text_boxes": [
+                {
+                    "text": "1",
+                    "box_px": [50, 50, 100, 100],
+                    "font_size": 48,
+                    "fit_text": False,
+                    "color": "#000000",
+                    "align": "center",
+                    "valign": "middle",
+                }
+            ],
+        }
+
+        ink_center = preview_ink_center(manifest)
+        self.assertIsNotNone(ink_center)
+        ink_center_x, ink_center_y = ink_center
+
+        self.assertAlmostEqual(100, ink_center_x, delta=5)
+        self.assertAlmostEqual(100, ink_center_y, delta=5)
+
+    def test_preview_centers_mixed_size_runs_inside_their_box(self):
+        preview_font = scalable_test_font()
+        self.assertIsNotNone(preview_font)
+        manifest = {
+            "source": {"width_px": 200, "height_px": 200},
+            "slide": {"width": 2, "height": 2, "background": "#ffffff"},
+            "content_box": {"left": 0, "top": 0, "width": 2, "height": 2},
+            "preview_scale": 100,
+            "text_boxes": [
+                {
+                    "runs": [
+                        {"text": "1", "font_size": 72},
+                        {"text": "A", "font_size": 12},
+                    ],
+                    "box_px": [50, 50, 100, 100],
+                    "font_size": 18,
+                    "fit_text": False,
+                    "preview_font": preview_font,
+                    "color": "#000000",
+                    "align": "center",
+                    "valign": "middle",
+                }
+            ],
+        }
+
+        ink_center = preview_ink_center(manifest)
+        self.assertIsNotNone(ink_center)
+        ink_center_x, ink_center_y = ink_center
+
+        self.assertAlmostEqual(100, ink_center_x, delta=8)
+        self.assertAlmostEqual(100, ink_center_y, delta=8)
+
+    def test_preview_rotates_centered_text_around_the_box_center(self):
+        manifest = {
+            "source": {"width_px": 200, "height_px": 200},
+     
```

---

### Incident Patch 7: `7fb4f30b` (2026-06-26)
**Commit Message**: fix: align Codex OAuth image requests

**File**: `CHANGELOG.md` (modified, +7/-1)
```diff
@@ -4,9 +4,15 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+## 0.3.1
+
+### Improvements
+
+- Align Codex OAuth image requests with Codex built-in image generation by setting `background=auto` and retrying transport or 5xx failures with Codex-style backoff while leaving rate limits non-retried. (#15)
+
 ### Documentation
 
-- Fix README rendering for the Codex Full Access recommendation callout.
+- Fix README rendering for the Codex Full Access recommendation callout. (#15)
 
 ## 0.3.0
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/image_gen.py` (modified, +62/-17)
```diff
@@ -14,7 +14,9 @@
 import mimetypes
 import os
 from pathlib import Path
+import random
 import re
+import socket
 import sys
 import time
 from typing import Any, Dict, Iterable, List, Optional, Tuple
@@ -23,9 +25,12 @@
 DEFAULT_MODEL = "gpt-image-2"
 DEFAULT_SIZE = "auto"
 DEFAULT_QUALITY = "auto"
+DEFAULT_BACKGROUND = "auto"
 DEFAULT_OUTPUT_EXTENSION = "png"
 DEFAULT_OUTPUT_PATH = "output/imagegen/output.png"
 DEFAULT_TIMEOUT = 600
+DEFAULT_CODEX_MAX_RETRIES = 4
+DEFAULT_CODEX_RETRY_BASE_DELAY_SECONDS = 0.2
 GPT_IMAGE_MODEL_PREFIX = "gpt-image-"
 
 ALLOWED_LEGACY_SIZES = {"1024x1024", "1536x1024", "1024x1536", "auto"}
@@ -63,9 +68,10 @@
   edit passes each --image as an edit target, visual reference, or supporting input.
 
 Parameter surface:
-  Backend requests pass only model, prompt, size, and quality. Edit requests
-  also pass the input images and optional mask. Local controls such as --out,
-  --force, --dry-run, and --timeout are not image API parameters.
+  Public image parameters are model, prompt, size, and quality. Codex OAuth
+  requests also set background=auto to match Codex built-in image generation.
+  Edit requests also pass the input images and optional mask. Local controls
+  such as --out, --force, --dry-run, and --timeout are not image API parameters.
 
 Slide reconstruction patterns:
   Clean base: use edit --image <source.png>; preserve source composition,
@@ -288,6 +294,7 @@ def _codex_image_body(
         "model": model,
         "size": size,
         "quality": quality,
+        "background": DEFAULT_BACKGROUND,
     }
     if image_paths:
         body["images"] = [_codex_image_reference(path) for path in image_paths]
@@ -296,6 +303,22 @@ def _codex_image_body(
     return body
 
 
+def _codex_retry_delay(attempt: int) -> float:
+    exp = 2 ** max(attempt - 1, 0)
+    jitter = random.uniform(0.9, 1.1)
+    return DEFAULT_CODEX_RETRY_BASE_DELAY_SECONDS * exp * jitter
+
+
+def _should_retry_codex_http(status: int) -> bool:
+    return 500 <= status <= 599
+
+
+def _format_attempts(attempts: int) -> str:
+    if attempts <= 1:
+        return ""
+    return f" after {attempts} attempts"
+
+
 def _post_codex_image_json(url: str, body: Dict[str, Any], timeout: int) -> Dict[str, Any]:
     auth = _load_codex_auth()
     if not auth:
@@ -310,20 +333,41 @@ def _post_codex_image_json(url: str, body: Dict[str, Any], timeout: int) -> Dict
     }
     if account_id:
         headers["ChatGPT-Account-ID"] = account_id
-    req = request.Request(
-        url,
-        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
-        method="POST",
-        headers=headers,
-    )
-    try:
-        with request.urlopen(req, timeout=timeout) as resp:
-            text = resp.read(MAX_CODEX_RESPONSE_BYTES).decode("utf-8", errors="replace")
-    except error.HTTPError as exc:
-        detail = exc.read(4096).decode("utf-8", errors="replace")
-        raise RuntimeError(f"Codex Images request failed (HTTP {exc.code}): {detail}") from exc
-    except error.URLError as exc:
-        raise RuntimeError(f"Codex Images request failed: {exc.reason}") from exc
+    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
+
+    for attempt in range(DEFAULT_CODEX_MAX_RETRIES + 1):
+        req = request.Request(
+            url,
+            data=data,
+            method="POST",
+            headers=headers,
+        )
+        try:
+            with request.urlopen(req, timeout=timeout) as resp:
+                text = resp.read(MAX_CODEX_RESPONSE_BYTES).decode("utf-8", errors="replace")
+            break
+        except error.HTTPError as exc:
+            detail = exc.read(4096).decode("utf-8", errors="replace")
+            if attempt < DEFAULT_CODEX_MAX_RETRIES and _should_retry_codex_http(exc.code):
+                time.sleep(_codex_retry_delay(attempt + 1))
+                continue
+            attempts = attempt + 1
+            raise RuntimeError(
+                f"Codex Images request failed{_format_attempts(attempts)} "
+                f"(HTTP {exc.code}): {detail}"
+            ) from exc
+        except (error.URLError, TimeoutError, socket.timeout) as exc:
+            if attempt < DEFAULT_CODEX_MAX_RETRIES:
+                time.sleep(_codex_retry_delay(attempt + 1))
+                continue
+            attempts = attempt + 1
+            reason = getattr(exc, "reason", exc)
+            raise RuntimeError(
+                f"Codex Images request failed{_format_attempts(attempts)}: {reason}"
+            ) from exc
+    else:
+        raise RuntimeError("Codex Images request failed after retry limit.")
+
     try:
         response = json.loads(text)
     except json.JSONDecodeError as exc:
@@ -547,6 +591,7 @@ def _run_codex_image(
                 "mask": str(mask_path) if mask_path else None,
                 "size": args.size,
                 "quality": args.quality,
+                "background": body["background"],
             }
         )
         return True
```

**File**: `tests/test_multi_agent_backend.py` (modified, +83/-2)
```diff
@@ -1,9 +1,12 @@
+import io
 import json
 import os
 import subprocess
 import sys
 import tempfile
 import unittest
+from unittest import mock
+from urllib import error
 import zipfile
 from pathlib import Path
 
@@ -24,6 +27,9 @@
 )
 os.environ["PYTHONPATH"] = CLI_ENV["PYTHONPATH"]
 
+from editppt.runtime import image_gen
+
+
 def write_json(path, data):
     path.parent.mkdir(parents=True, exist_ok=True)
     path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
@@ -420,7 +426,8 @@ def test_image_edit_dry_run_prefers_codex_oauth_when_auth_exists(self):
             self.assertEqual([str(source)], payload["input_images"])
             self.assertEqual("auto", payload["size"])
             self.assertEqual("auto", payload["quality"])
-            for removed in ("background", "moderation", "output_format", "output_compression", "n"):
+            self.assertEqual("auto", payload["background"])
+            for removed in ("moderation", "output_format", "output_compression", "n"):
                 self.assertNotIn(removed, payload)
 
     def test_image_generate_dry_run_prefers_codex_images_endpoint_when_auth_exists(self):
@@ -456,9 +463,83 @@ def test_image_generate_dry_run_prefers_codex_images_endpoint_when_auth_exists(s
             self.assertEqual([], payload["input_images"])
             self.assertEqual("auto", payload["size"])
             self.assertEqual("auto", payload["quality"])
-            for removed in ("background", "moderation", "output_format", "output_compression", "n"):
+            self.assertEqual("auto", payload["background"])
+            for removed in ("moderation", "output_format", "output_compression", "n"):
                 self.assertNotIn(removed, payload)
 
+    def test_codex_oauth_retries_transport_and_5xx_only(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            auth = Path(tmp) / "auth.json"
+            write_json(auth, {"tokens": {"access_token": "test-token"}})
+
+            class FakeResponse:
+                def __enter__(self):
+                    return self
+
+                def __exit__(self, exc_type, exc, tb):
+                    return False
+
+                def read(self, _limit):
+                    return b'{"data":[{"b64_json":"aW1hZ2U="}]}'
+
+            http_500 = error.HTTPError(
+                "https://example.test",
+                500,
+                "server error",
+                hdrs=None,
+                fp=io.BytesIO(b"temporary"),
+            )
+            env = os.environ.copy()
+            env["CODEX_AUTH_FILE"] = str(auth)
+            with mock.patch.dict(os.environ, env, clear=False), mock.patch(
+                "editppt.runtime.image_gen.request.urlopen",
+                side_effect=[http_500, FakeResponse()],
+            ) as urlopen, mock.patch("editppt.runtime.image_gen.time.sleep") as sleep:
+                response = image_gen._post_codex_image_json(
+                    "https://example.test/images/generations",
+                    {"model": "gpt-image-2", "prompt": "test"},
+                    10,
+                )
+
+            self.assertEqual(["aW1hZ2U="], [item["b64_json"] for item in response["data"]])
+            self.assertEqual(2, urlopen.call_count)
+            sleep.assert_called_once()
+
+            with mock.patch.dict(os.environ, env, clear=False), mock.patch(
+                "editppt.runtime.image_gen.request.urlopen",
+                side_effect=[error.URLError("temporary network failure"), FakeResponse()],
+            ) as urlopen, mock.patch("editppt.runtime.image_gen.time.sleep") as sleep:
+                response = image_gen._post_codex_image_json(
+                    "https://example.test/images/generations",
+                    {"model": "gpt-image-2", "prompt": "test"},
+                    10,
+                )
+
+            self.assertEqual(["aW1hZ2U="], [item["b64_json"] for item in response["data"]])
+            self.assertEqual(2, urlopen.call_count)
+            sleep.assert_called_once()
+
+            http_429 = error.HTTPError(
+                "https://example.test",
+                429,
+                "rate limited",
+                hdrs=None,
+                fp=io.BytesIO(b"rate limit"),
+            )
+            with mock.patch.dict(os.environ, env, clear=False), mock.patch(
+                "editppt.runtime.image_gen.request.urlopen",
+                side_effect=http_429,
+            ) as urlopen, mock.patch("editppt.runtime.image_gen.time.sleep") as sleep:
+                with self.assertRaisesRegex(RuntimeError, r"HTTP 429"):
+                    image_gen._post_codex_image_json(
+                        "https://example.test/images/generations",
+                        {"model": "gpt-image-2", "prompt": "test"},
+                        10,
+                    )
+
+            self.assertEqual(1, urlopen.call_count)
+            sleep.assert_not_called()
+
     def test_runtime_config_wri
```

---

### Incident Patch 8: `083d6828` (2026-06-22)
**Commit Message**: docs: fix full access callout rendering

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Documentation
+
+- Fix README rendering for the Codex Full Access recommendation callout.
+
 ## 0.3.0
 
 ### Features
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@
 它适合把截图式或图片式幻灯片变成更容易二次编辑的 PPT，让文字、简单形状和视觉素材尽量分开调整。
 
 > [!IMPORTANT]
-> **建议在 Codex 中使用“完全访问权限”执行本 skill。**本 skill 运行时间较长，并且会自动执行 OCR、图片生成/编辑、文件读写、子 agent 分派和长时间轮询等步骤。“请求批准”模式会频繁打断执行，可能阻塞部分步骤，尤其是在子 agent 环境里。
+> **建议在 Codex 中使用“完全访问权限”执行本 skill。**
+>
+> 本 skill 运行时间较长，并且会自动执行 OCR、图片生成/编辑、文件读写、子 agent 分派和长时间轮询等步骤。“请求批准”模式会频繁打断执行，可能阻塞部分步骤，尤其是在子 agent 环境里。
 >
 > “替我审批”模式已知仍可能在 OCR 阶段、ChatGPT 图片生成/编辑阶段或第三方 API 调用阶段拦截请求，要求你手动审批；如果你不在电脑旁，转换流程会停住。
 >
```

**File**: `README_en.md` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@ A skill for converting images, PDFs, and image-based PPT files into editable Pow
 It is useful when screenshot-like or image-based slides need to become easier to edit again, with text, simple shapes, and visual assets separated where practical.
 
 > [!IMPORTANT]
-> **Run this skill in Codex with Full Access whenever possible.** This skill can run for a long time and automatically performs OCR, image generation/editing, file writes, subagent dispatch, and long polling. "Request approval" mode can interrupt the workflow repeatedly and may block required steps, especially inside subagent execution.
+> **Run this skill in Codex with Full Access whenever possible.**
+>
+> This skill can run for a long time and automatically performs OCR, image generation/editing, file writes, subagent dispatch, and long polling. "Request approval" mode can interrupt the workflow repeatedly and may block required steps, especially inside subagent execution.
 >
 > "Approve for me" mode is also known to still block some OCR requests, ChatGPT image generation/editing requests, or third-party API calls until you manually approve them. If you are away from the computer, the conversion may stall.
 >
```

---

### Incident Patch 9: `b0724592` (2026-06-21)
**Commit Message**: fix: document network approval for image backends

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ Release notes are generated from this file. Keep changelog entries in English.
 - Align `editppt image` with the Codex GPT Image workflow: default model, automatic size and quality, a longer Codex OAuth timeout, and a narrow backend request payload that passes only the retained image parameters.
 - Remove the `editppt image batch` interface so page-local image jobs run serially, and document that foreground icons should be grouped into one sparse asset sheet with generous gaps unless one sheet cannot fit them.
 - Clarify that user-requested conversions authorize necessary OCR and image-backend calls while limiting uploads to task-local page images, prompts, masks, and references.
+- Document upfront network approval handling for PaddleOCR, Codex OAuth image calls, and configured OpenAI-compatible image APIs in restricted agent environments.
 - Guard `editppt run reset` for dispatched pages with `--confirm-lost` and a matching `--agent-id`, and document that slow active page workers must not be reset or replaced.
 - Support single-page local reconstruction by returning `rebuild_page_locally`, recording `editppt run dispatch --local`, and keeping the same page artifact and record/finalize path as worker-dispatched pages.
 
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +3/-0)
```diff
@@ -31,6 +31,7 @@ These parent-level rules are stated once here; page-level rules live in the refe
 - All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through serial `editppt image generate/edit` calls.
 - A user request to convert visual slides into editable PPT authorizes the required OCR and image-backend calls for that conversion, unless the user explicitly requests local-only processing or marks the input as confidential/no-external-processing. Do not refuse solely because the workflow calls PaddleOCR, Codex OAuth/ChatGPT image endpoints, or a user-configured OpenAI-compatible API; those calls are necessary to the skill.
 - Only send task-local page images, prompts, masks, and reference images required for the current conversion. Never send unrelated local files, API keys, auth tokens, credentials, or generated artifacts that are not needed by the current OCR/image operation. Third-party API endpoints are allowed only when already configured by the user or explicitly specified for this run.
+- In network-restricted environments, request network approval before commands that need these backends: `editppt prepare` or `editppt run hints` when `PADDLE_OCR_TOKEN` is set, and every required `editppt image generate/edit` call. The approval justification must say this is a user-requested `image-to-editable-ppt` conversion, that the upload is limited to task-local page images/prompts/masks/references, and that OCR/image-backend calls are part of this skill's required workflow. Do not present the required call as unsafe or ask the user to re-approve it unless they requested local-only/confidential handling or the approval system explicitly rejects the request.
 - All page object decisions follow `references/page-decision-tree.md`, including its no-fallback rule for foreground visual objects and its rule that deterministic validation is a structure gate that never waives an object-source decision.
 - `manifest.json` is the authoritative page build source: `editppt run record` validates `page.pptx` against it, and `editppt run finalize` rebuilds the final deck from recorded page manifests. Required fields and coordinate contracts are defined in `references/manifest-schema.md`.
 - `editppt prepare` writes per-page text measurements (`text_hints.json`/`text_hints.png`). How page reconstructors consume them is defined in `references/page-decision-tree.md` section 3.1.
@@ -61,6 +62,8 @@ After this completes, there must be a run directory, `deck_manifest.json`, `page
 
 Prepare also writes per-page text hints. Whenever `editppt doctor` or prepare reports that no PaddleOCR token is configured (offline fallback), ask the user once before dispatching any page: a free token from https://aistudio.baidu.com/account/accessToken stored via `editppt config --paddle-ocr-token <token>` makes the hints content-aware and noticeably improves text fidelity, and `editppt run hints <run>` regenerates the current run's hints in place. Tell the user the free personal quota is currently more than enough for this skill — applying is risk-free with no extra cost. Wait for their choice; if they decline or want to proceed, continue with the offline hints and do not ask again.
 
+If a PaddleOCR token is already configured but `prepare` falls back because network access, DNS, or sandbox approval blocked the OCR request, that fallback is not the preferred quality path. Request network approval with the justification described in the Entry Contract and rerun `editppt run hints <run>` before page reconstruction. If the approval system rejects the OCR request, ask the user for explicit authorization before continuing: explain that PaddleOCR is used to correct text boxes, font sizes, and size groups, and that using it makes reconstructed PPT text sizing much more stable. Continue with `builtin-ink` only after the user declines OCR, after an approved OCR attempt fails for a real service/tool reason, or when the user asked for local-only/confidential handling.
+
 ### Phase 2: Rebuild Or Dispatch Pages
 
 Read the run/dispatch examples in `references/cli-helper.md` and call repeatedly:
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/runtime_env.py` (modified, +24/-0)
```diff
@@ -217,6 +217,21 @@ def collect_status(check_api=False):
             "apply_url": PADDLE_TOKEN_APPLY_URL,
             "configure_command": "editppt config --paddle-ocr-token <token>",
         },
+        "network_approval": {
+            "commands": [
+                "editppt prepare / editppt run hints when PADDLE_OCR_TOKEN is set",
+                "editppt image generate/edit",
+            ],
+            "justification": (
+                "User-requested image-to-editable-ppt conversion; uploads are limited to "
+                "task-local page images, prompts, masks, and references required by OCR/image backends."
+            ),
+            "paddle_rejection_guidance": (
+                "If PaddleOCR approval is rejected, ask the user to authorize OCR explicitly; "
+                "explain that OCR corrects text boxes, font sizes, and size groups so reconstructed "
+                "PPT text sizing stays stable."
+            ),
+        },
         "next": "no action needed" if ok else (
             "run `codex login` or `editppt config --api-key <key>`" if check_api and not image_backend_ready
             else cli_reinstall_hint().strip("`")
@@ -243,6 +258,15 @@ def doctor(args):
     print(f"image backend={image_backend['selection']}")
     hints = status["text_hints"]
     print(f"text hints={hints['selection']} (PADDLE_OCR_TOKEN {hints['paddle_token']})")
+    print(
+        "network approval: in restricted agents, request approval up front for OCR/image backend "
+        "commands; conversion uploads are limited to task-local page images, prompts, masks, "
+        "and references."
+    )
+    print(
+        "paddle approval rejection: ask the user to authorize OCR and explain that it corrects "
+        "text boxes, font sizes, and size groups so reconstructed PPT text sizing stays stable."
+    )
     if hints["paddle_token"] == "unset":
         print(
             "text hints: ASK THE USER once — a free PaddleOCR token makes text hints content-aware "
```

**File**: `skills/image-to-editable-ppt/prompts/page-worker.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Hard rules (reminders only; the details and rationale live in the references abo
 4. All box_px / points_px / polygon_px values are source.png pixels. Reuse page_request.json.slide and page_request.json.content_box unchanged — do not convert the page to 16:9 or recalculate the canvas; the runtime maps source-pixel coordinates into content_box. Positioned objects without coordinates are page failures.
 5. validation.json must contain a top-level boolean `passed`. Deterministic validation passing never waives an object-source rule.
 
-Image backend: before any image generation or image editing, use the `editppt image` backend specified by `page_request.json.image_backend`. If `editppt image` is unavailable, first follow the CLI error guidance and try `codex login` or `editppt config`; if it is still unavailable, stop the current page and write `validation.json` with `"passed": false`. Do not complete the page using approximate editable structure when required foreground asset separation cannot run. When you need parameter details for the image backend, input images, clean bases, or asset sheets, read `editppt image --help` and the relevant subcommand help.
+Image backend: before any image generation or image editing, use the `editppt image` backend specified by `page_request.json.image_backend`. In a network-restricted runtime, request approval before required `editppt image generate/edit` calls with this reason: the user requested an `image-to-editable-ppt` conversion, and the upload is limited to task-local prompts plus required page images, masks, and references for this page. If `editppt image` is unavailable, first follow the CLI error guidance and try `codex login` or `editppt config`; if it is still unavailable, stop the current page and write `validation.json` with `"passed": false`. Do not complete the page using approximate editable structure when required foreground asset separation cannot run. When you need parameter details for the image backend, input images, clean bases, or asset sheets, read `editppt image --help` and the relevant subcommand help.
 
 Goal: rebuild the source page as object-level editable PowerPoint. Do not invent an object-source strategy outside `page-decision-tree.md`.
 
```

**File**: `skills/image-to-editable-ppt/references/cli-helper.md` (modified, +7/-0)
```diff
@@ -6,6 +6,7 @@ Usage principles:
 
 - If a deterministic action can be completed with `editppt`, call the CLI directly instead of rewriting it as a temporary Python script.
 - When full parameters are needed, read `editppt <command> --help` or `editppt image <command> --help` first.
+- In network-restricted agents, `editppt prepare`/`editppt run hints` with a PaddleOCR token and `editppt image generate/edit` need network approval. The approval and user-interaction policy lives in `SKILL.md` Entry Contract and Phase 1.
 
 ## Command Tree
 
@@ -113,6 +114,8 @@ editppt prepare input.pdf
 
 Purpose: normalize a single image, multiple images, a PDF, or an image-based PPTX into a run directory and generate `deck_manifest.json`, `page_jobs.json`, `notes_manifest.json`, plus per-page `pages/page_NNN/source.png`, `page_request.json`, and text hints.
 
+When a PaddleOCR token is configured, `prepare` may submit the input pages to PaddleOCR for content-aware text hints. In a sandboxed or approval-gated environment, request network approval up front for this command instead of accepting a DNS/sandbox failure followed by lower-quality `builtin-ink` fallback; see `SKILL.md` Phase 1 for the approval-rejection policy.
+
 ```bash
 editppt run next <run> --json
 ```
@@ -185,6 +188,8 @@ editppt run hints <run>
 
 Purpose: regenerate `text_hints.json`/`text_hints.png` for every page of a prepared run — for example right after configuring a PaddleOCR token, so the current run gets content-aware hints without re-running prepare.
 
+When used with a configured PaddleOCR token, this command calls the external OCR service. If the runtime requires approval for network access, request it with the task-local conversion-data justification from `SKILL.md`; see `SKILL.md` Phase 1 for the approval-rejection policy.
+
 ```bash
 editppt page hints pages/page_001
 ```
@@ -217,6 +222,8 @@ editppt image edit \
 
 When multiple image outputs are required, run `editppt image generate` or `editppt image edit` calls serially. For foreground icons and small visual objects, prefer one sparse asset sheet with generous spacing; create a second sheet only when one sheet cannot fit the required objects cleanly.
 
+These commands call the selected image backend: Codex OAuth first, then a configured OpenAI-compatible API fallback. In a network-restricted runtime, request approval before the call and state that only task-local prompts plus required page images/masks/references are uploaded for the current conversion.
+
 ## Asset Processing Commands
 
 Record a selected image output:
```

**File**: `tests/test_multi_agent_backend.py` (modified, +20/-0)
```diff
@@ -203,10 +203,30 @@ def test_runtime_doctor_direct_entrypoint_is_cli_scoped(self):
         )
         self.assertEqual(0, result.returncode, result.stderr)
         payload = json.loads(result.stdout)
+        self.assertIn("network_approval", payload)
+        self.assertIn("paddle_rejection_guidance", payload["network_approval"])
         self.assertNotIn("skill_root", payload)
         self.assertNotIn("<repo-path>", json.dumps(payload, ensure_ascii=False))
         self.assertNotIn("pipx upgrade image-to-editable-ppt", json.dumps(payload, ensure_ascii=False))
 
+    def test_runtime_doctor_text_mentions_network_approval(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            env = os.environ.copy()
+            env["EDITPPT_CONFIG_HOME"] = tmp
+            result = subprocess.run(
+                [sys.executable, "-m", "editppt.cli", "doctor"],
+                cwd=ROOT,
+                env=env,
+                text=True,
+                capture_output=True,
+            )
+            self.assertEqual(0, result.returncode, result.stderr)
+            self.assertIn("network approval:", result.stdout)
+            self.assertIn("OCR/image backend", result.stdout)
+            self.assertIn("task-local page images", result.stdout)
+            self.assertIn("paddle approval rejection:", result.stdout)
+            self.assertIn("text sizing stays stable", result.stdout)
+
     def test_image_batch_command_is_removed(self):
         result = subprocess.run(
             [sys.executable, "-m", "editppt.cli", "image", "batch", "--help"],
```

---

### Incident Patch 10: `e105a590` (2026-06-21)
**Commit Message**: fix: guard active page worker resets

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ Release notes are generated from this file. Keep changelog entries in English.
 - Align `editppt image` with the Codex GPT Image workflow: default model, automatic size and quality, a longer Codex OAuth timeout, and a narrow backend request payload that passes only the retained image parameters.
 - Remove the `editppt image batch` interface so page-local image jobs run serially, and document that foreground icons should be grouped into one sparse asset sheet with generous gaps unless one sheet cannot fit them.
 - Clarify that user-requested conversions authorize necessary OCR and image-backend calls while limiting uploads to task-local page images, prompts, masks, and references.
+- Guard `editppt run reset` for dispatched pages with `--confirm-lost` and a matching `--agent-id`, and document that slow active page workers must not be reset or replaced.
 
 ## 0.2.0
 
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +6/-4)
```diff
@@ -79,6 +79,8 @@ When the dispatch stage is returned, the following steps are mandatory for each
 
 Concurrency slots come from `page_jobs.json.max_concurrent_pages` (default 6). In the normal flow prefer `editppt run next`; `editppt run status` is only for debugging or manual inspection.
 
+Dispatched workers are active leases, not idle slots. When `editppt run next` returns `stage=wait`, wait for dispatched workers or inspect status without modifying state. Do not terminate, archive, reset, or replace a page worker because it is slow, has not sent recent messages, or still occupies a concurrency slot; complex pages may legitimately run for a long time.
+
 ### Phase 3: Record
 
 Read the record examples in `references/cli-helper.md` and the `page_result.json` description in `references/manifest-schema.md`.
@@ -91,13 +93,13 @@ editppt run record <run> --page <page_id> --agent-id <id>
 
 This command validates `page.pptx` against `manifest.json` before recording. It fails if positioned objects are missing source-pixel coordinates, if the manifest cannot independently rebuild the page, or if `validation.json` does not contain top-level `passed: true` — a failed page is never recorded.
 
-Handling a failed page: when a worker returns a failure (`passed: false`), when `run record` rejects the outputs, or when a dispatched worker is lost and will not return, do not hand-edit state files and do not rebuild the page yourself. Read the page's `validation.json` for the failure reason, fix the root cause (for example a missing image-backend login reported by the worker), then run:
+Handling a failed page: when a worker returns a failure (`passed: false`), when `run record` rejects the outputs, when the runtime reports a terminal worker state (`terminated`, `failed`, `archived`, or `not found`), or when the user explicitly cancels that page worker, do not hand-edit state files and do not rebuild the page yourself. A long-running worker is not lost. Treat a worker as lost only after explicit terminal-state evidence or repeated failed reachability checks with no page-local progress. Read the page's `validation.json` when present, fix the root cause (for example a missing image-backend login reported by the worker), then run:
 
 ```bash
-editppt run reset <run> --page <page_id>
+editppt run reset <run> --page <page_id> --agent-id <id> --confirm-lost
 ```
 
-This returns the page to `pending`. Then rebuild the worker prompt and dispatch a new worker through the normal Phase 2 steps. Never re-dispatch without changing something first: a worker re-run under identical conditions fails identically. When the same page fails twice on the same root cause, the diagnosis is yours, not the user's — read the failed attempt's `validation.json` and artifacts, reproduce the failing command yourself if needed, and fix the underlying cause (backend login, missing tools, broken assets) before resetting again. Only surface a problem to the user when it genuinely requires something only the user has (credentials, a paid account decision, the original file); phrase it as the concrete action needed, never as a debugging question.
+For recorded pages, `editppt run reset <run> --page <page_id>` is allowed. For dispatched pages, reset requires `--confirm-lost` and an `--agent-id` matching the recorded dispatch so an active worker cannot be reset accidentally. This returns the page to `pending`. Then rebuild the worker prompt and dispatch a new worker through the normal Phase 2 steps. Never re-dispatch without changing something first: a worker re-run under identical conditions fails identically. When the same page fails twice on the same root cause, the diagnosis is yours, not the user's — read the failed attempt's `validation.json` and artifacts, reproduce the failing command yourself if needed, and fix the underlying cause (backend login, missing tools, broken assets) before resetting again. Only surface a problem to the user when it genuinely requires something only the user has (credentials, a paid account decision, the original file); phrase it as the concrete action needed, never as a debugging question.
 
 ### Phase 4: Finalize
 
@@ -129,7 +131,7 @@ The final reply must report the final PPTX path and validation result.
 Agents continue only from file facts and `editppt run next`. Required states:
 
 - `pending`: created by `editppt prepare`; restored by `editppt run reset` when a page must be re-dispatched.
-- `dispatched`: `editppt run dispatch` records a real spawned worker.
+- `dispatched`: `editppt run dispatch` records a real spawned worker. This status is an active lease and must not be reset or replaced just because the worker is slow.
 - `recorded`: `editppt run record` validates required outputs and writes the result; only deliverable pages (`validation.json` top-level `passed: true`) reach this state.
 - `accepted` / `complete`: written by `editppt run finalize`.
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py` (modified, +11/-4)
```diff
@@ -239,7 +239,7 @@ def cmd_next(args: argparse.Namespace) -> int:
             "stage": "wait",
             "active_or_unfinished_pages": unfinished,
             "next_command": f"{cli_prog()} run status {run_dir}",
-            "agent_focus": "Wait for dispatched workers, then record completed page results. If a worker returned a failure, fix the root cause and `run reset` that page for re-dispatch.",
+            "agent_focus": "Wait for dispatched workers, then record completed page results. Do not reset slow active workers; use `run reset` only after failure, terminal state, cancellation, or lost-worker verification.",
         }
         return print_json(payload) if args.json else _print_next_text(payload)
 
@@ -288,7 +288,12 @@ def cmd_record(args: argparse.Namespace) -> int:
 
 
 def cmd_reset(args: argparse.Namespace) -> int:
-    return run_script("reset_page_job.py", [args.run, "--page", args.page])
+    argv = [args.run, "--page", args.page]
+    if args.agent_id:
+        argv.extend(["--agent-id", args.agent_id])
+    if args.confirm_lost:
+        argv.append("--confirm-lost")
+    return run_script("reset_page_job.py", argv)
 
 
 def cmd_page_build(args: argparse.Namespace) -> int:
@@ -564,12 +569,14 @@ def build_parser() -> argparse.ArgumentParser:
 
     reset = run_sub.add_parser(
         "reset",
-        help="Reset a failed or stuck page back to pending for re-dispatch.",
-        description="Return a dispatched or recorded page to pending, clearing its dispatch and result records, so a new worker can be dispatched. Use it when a worker returned a failed page, record validation failed, or a dispatched worker is lost.",
+        help="Reset a failed or inactive page back to pending for re-dispatch.",
+        description="Return a recorded page, or an explicitly inactive/lost dispatched page, to pending. Dispatched pages require --confirm-lost and a matching --agent-id so active long-running workers are not reset accidentally.",
         formatter_class=HELP_FORMATTER,
     )
     reset.add_argument("run", metavar="RUN", help="Run directory or deck_manifest.json path.")
     reset.add_argument("--page", required=True, metavar="PAGE", help="Page id such as page_001, or page number such as 1.")
+    reset.add_argument("--agent-id", metavar="ID", help="Required for dispatched pages; must match the recorded worker/thread id.")
+    reset.add_argument("--confirm-lost", action="store_true", help="Required for dispatched pages. Confirms the original worker is no longer active or must be abandoned.")
     reset.set_defaults(func=cmd_reset)
 
     run_hints = run_sub.add_parser(
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/record_page_result.py` (modified, +2/-1)
```diff
@@ -96,7 +96,8 @@ def main():
             f"{page['page_id']} validation.json does not contain top-level \"passed\": true; "
             "the page is not deliverable and was not recorded. Inspect the worker's "
             "validation.json for the failure reason, fix the root cause, then run "
-            f"`editppt run reset {run_dir} --page {page['page_id']}` and dispatch a new worker."
+            f"`editppt run reset {run_dir} --page {page['page_id']} "
+            f"--agent-id {args.agent_id} --confirm-lost` and dispatch a new worker."
         )
     paths = {key: output_path(page_dir, result, key, default) for key, default in REQUIRED_OUTPUTS.items()}
     validate_page_contract(paths)
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/reset_page_job.py` (modified, +23/-1)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env python3
-"""Reset a failed or stuck page back to pending so it can be re-dispatched."""
+"""Reset a failed or inactive page back to pending so it can be re-dispatched."""
 import argparse
 import json
 
@@ -19,6 +19,12 @@ def main():
     )
     parser.add_argument("run", help="Run directory or deck_manifest.json")
     parser.add_argument("--page", required=True, help="page_001 or 1")
+    parser.add_argument("--agent-id", help="Required for dispatched pages; must match the recorded worker id.")
+    parser.add_argument(
+        "--confirm-lost",
+        action="store_true",
+        help="Required for dispatched pages. Confirms the original worker is no longer active or must be abandoned.",
+    )
     args = parser.parse_args()
 
     run_dir = run_dir_from_target(args.run)
@@ -30,6 +36,22 @@ def main():
             f"{page['page_id']} cannot be reset from status {status}; "
             "reset only applies to dispatched or recorded pages"
         )
+    if status == "dispatched":
+        dispatch = page.get("dispatch") or {}
+        expected_agent_id = dispatch.get("agent_id")
+        if not args.confirm_lost:
+            raise SystemExit(
+                f"{page['page_id']} is still dispatched. Do not reset active workers because they are slow. "
+                "Use --confirm-lost with --agent-id only after explicit worker failure, terminal state, "
+                "user cancellation, or lost-worker verification."
+            )
+        if not args.agent_id:
+            raise SystemExit(f"{page['page_id']} dispatched reset requires --agent-id.")
+        if expected_agent_id and args.agent_id != expected_agent_id:
+            raise SystemExit(
+                f"Agent id mismatch for {page['page_id']}: "
+                f"dispatch={expected_agent_id} reset={args.agent_id}"
+            )
     page["status"] = "pending"
     page["dispatch"] = None
     page["result"] = None
```

**File**: `skills/image-to-editable-ppt/references/cli-helper.md` (modified, +3/-3)
```diff
@@ -117,7 +117,7 @@ Purpose: normalize a single image, multiple images, a PDF, or an image-based PPT
 editppt run next <run> --json
 ```
 
-Purpose: read current run state and return the next stage. `stage=dispatch_pages` lists `suggested_pages` that must each be dispatched to a page worker — single-page inputs dispatch their one page the same way. `stage=wait` means wait for dispatched pages to complete. `stage=finalize` means proceed to final assembly. `stage=configure_backend` appears only when `deck_manifest.json.image_backend` is missing; follow the returned `next_command`.
+Purpose: read current run state and return the next stage. `stage=dispatch_pages` lists `suggested_pages` that must each be dispatched to a page worker — single-page inputs dispatch their one page the same way. `stage=wait` means wait for dispatched pages to complete; slow dispatched workers remain active and must not be reset or replaced because they occupy a slot. `stage=finalize` means proceed to final assembly. `stage=configure_backend` appears only when `deck_manifest.json.image_backend` is missing; follow the returned `next_command`.
 
 Generate the page-worker prompt with the skill script before spawning a worker:
 
@@ -138,10 +138,10 @@ editppt run record <run> --page page_001 --agent-id <worker-id>
 Purpose: after the page worker writes its required outputs (see `manifest-schema.md`), validate `page.pptx` against `manifest.json` and record the page result. Missing `box_px` / `points_px` on positioned objects is a page failure. The command also fails when `validation.json` does not contain top-level `passed: true` — a failed page is never recorded; fix the root cause, `run reset` the page, and dispatch a new worker.
 
 ```bash
-editppt run reset <run> --page page_001
+editppt run reset <run> --page page_001 --agent-id <worker-id> --confirm-lost
 ```
 
-Purpose: return a dispatched or recorded page to `pending`, clearing its dispatch and result records, so a new worker can be dispatched. Use it when a worker returned a failed page, `run record` rejected the outputs, or a dispatched worker is lost. The failure-handling policy is in `SKILL.md` Phase 3.
+Purpose: return a dispatched or recorded page to `pending`, clearing its dispatch and result records, so a new worker can be dispatched. Recorded pages can be reset with only `--page`. Dispatched pages require `--agent-id` plus `--confirm-lost`, and the id must match the recorded dispatch. Use this only when a worker returned a failed page, `run record` rejected the outputs, the runtime reports a terminal worker state, the user cancels that worker, or repeated reachability checks prove the worker is lost. The failure-handling policy is in `SKILL.md` Phase 3.
 
 ```bash
 editppt run finalize <run>
```

**File**: `skills/image-to-editable-ppt/references/manifest-schema.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ Structure:
 }
 ```
 
-`dispatch` is written by `editppt run dispatch`. `result` is written by `editppt run record`. `accepted` is written by `editppt run finalize`.
+`dispatch` is written by `editppt run dispatch`. A page with status `dispatched` is an active worker lease until explicit completion, failure, cancellation, or lost-worker verification; elapsed time alone does not make it lost. `result` is written by `editppt run record`. `accepted` is written by `editppt run finalize`.
 
 ## `page_request.json`
 
```

**File**: `tests/test_multi_agent_backend.py` (modified, +42/-0)
```diff
@@ -937,6 +937,45 @@ def test_run_reset_returns_page_to_pending_for_redispatch(self):
             page_2["dispatch"] = {"agent_id": "worker-1"}
             write_json(run_dir / "page_jobs.json", jobs)
 
+            reset_active = subprocess.run(
+                [
+                    sys.executable,
+                    "-m",
+                    "editppt.cli",
+                    "run",
+                    "reset",
+                    run_dir,
+                    "--page",
+                    "page_002",
+                ],
+                cwd=ROOT,
+                text=True,
+                capture_output=True,
+            )
+            self.assertNotEqual(0, reset_active.returncode)
+            self.assertIn("Do not reset active workers", reset_active.stdout + reset_active.stderr)
+
+            reset_wrong_agent = subprocess.run(
+                [
+                    sys.executable,
+                    "-m",
+                    "editppt.cli",
+                    "run",
+                    "reset",
+                    run_dir,
+                    "--page",
+                    "page_002",
+                    "--agent-id",
+                    "worker-2",
+                    "--confirm-lost",
+                ],
+                cwd=ROOT,
+                text=True,
+                capture_output=True,
+            )
+            self.assertNotEqual(0, reset_wrong_agent.returncode)
+            self.assertIn("Agent id mismatch", reset_wrong_agent.stdout + reset_wrong_agent.stderr)
+
             reset = subprocess.run(
                 [
                     sys.executable,
@@ -947,6 +986,9 @@ def test_run_reset_returns_page_to_pending_for_redispatch(self):
                     run_dir,
                     "--page",
                     "page_002",
+                    "--agent-id",
+                    "worker-1",
+                    "--confirm-lost",
                 ],
                 cwd=ROOT,
                 text=True,
```

---

### Incident Patch 11: `d12a992e` (2026-06-21)
**Commit Message**: fix: align editppt image backend contract

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -4,6 +4,12 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Fixes
+
+- Route the Codex OAuth image backend through the Codex Images generation and edit endpoints instead of the Responses image-generation tool.
+- Align `editppt image` with the Codex GPT Image workflow: default model, automatic size and quality, a longer Codex OAuth timeout, and a narrow backend request payload that passes only the retained image parameters.
+- Remove the `editppt image batch` interface so page-local image jobs run serially, and document that foreground icons should be grouped into one sparse asset sheet with generous gaps unless one sheet cannot fit them.
+
 ## 0.2.0
 
 ### Features
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -56,7 +56,7 @@
 - 文字大小与位置由测量驱动：prepare 阶段为每页生成文字标注（框坐标 + 字号 + 字号分组），模型按测量值还原文字，同级文字字号自动保持一致。
 - 多张图片按提供顺序生成页面；PDF 和 `.pptx` 保留原页码顺序。
 - `.pptx` 输入的页面备注会复制到输出对应页，备注内容不改动。
-- 根据具体页面情况决定是否通过已确认 image backend 做图片分层抽取；需要时用稀疏 asset sheet 合并前景素材，尽可能降低图片生成调用次数。
+- 根据具体页面情况决定是否通过已确认 image backend 做图片分层抽取；需要时用稀疏 asset sheet 合并前景素材，优先把图标放在一个素材板上，并保留充足间隙便于后续分离。
 - 支持复杂视觉页的混合策略：可编辑文字 + 简单形状 + 独立图片资产。
 
 ## 适用场景
@@ -70,7 +70,7 @@
 ## 运行要求
 
 - 多页输入需要 agent 能分派 page worker/subagent；如果不能创建 page worker，应换到支持 page worker 的环境执行。
-- 复杂背景补全、前景图标提取、透明 asset sheet 和局部图片编辑统一走 `editppt image edit/generate/batch`。
+- 复杂背景补全、前景图标提取、透明 asset sheet 和局部图片编辑统一走串行 `editppt image edit/generate` 调用。
 - 如果本机有 Codex OAuth（`~/.codex/auth.json`），CLI 会直接使用；否则使用 API fallback。
 - API fallback 配置保存在 `~/.editppt/config.yaml`；Windows 下对应 `%USERPROFILE%\.editppt\config.yaml`。
 - 文字大小与位置的校正需要一个第三方 OCR Token（百度 AI Studio，免费），详见下文「文字校正与 OCR Token」；未配置时退化为内置离线检测，文字还原质量会打折扣。
@@ -79,6 +79,8 @@
 
 `editppt image` 会自动选择图片后端：优先使用本机 Codex OAuth；如果不可用，再读取 `~/.editppt/config.yaml` 或环境变量里的 OpenAI-compatible API 配置。
 
+`editppt image generate/edit` 的公开参数面保持精简：请求输入只需要 `--prompt` 或 `--prompt-file`，编辑图还需要 `--image`；页面重建时应显式传 `--out`。实用控制只保留 `--model`、`--size`、`--quality`、`--force`、`--dry-run`、`--timeout`，以及编辑图专用的 `--mask`。CLI 不会透传其它 image API 选项。
+
 通常不需要你自己配置。只有这些情况才需要让 AI 帮你配置 API fallback：
 
 - 用户明确要求使用第三方 API 或 OpenAI 兼容中转站。
```

**File**: `README_en.md` (modified, +4/-2)
```diff
@@ -56,7 +56,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 - Text sizes and positions are measurement-driven: prepare generates per-page text annotations (box coordinates + font sizes + size groups), and same-level text keeps one consistent size automatically.
 - Keep multiple images in the provided order; preserve PDF and `.pptx` page order.
 - Preserve `.pptx` speaker notes on matching output slides without modifying note text.
-- Decides page by page whether to use the confirmed image backend for visual-layer extraction; when needed, sparse asset sheets group foreground assets to reduce image generation calls.
+- Decides page by page whether to use the confirmed image backend for visual-layer extraction; when needed, sparse asset sheets group foreground assets, prefer placing icons on one sheet, and keep generous gaps for later splitting.
 - Supports hybrid reconstruction: editable text, simple native shapes, and independent image assets.
 
 ## Use Cases
@@ -70,7 +70,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 ## Runtime Requirements
 
 - Multi-page input requires the agent to dispatch page workers/subagents; if page workers cannot be created, run the skill in an environment that supports page workers.
-- Complex background cleanup, foreground icon extraction, transparent asset sheets, and local image edits use `editppt image edit/generate/batch`.
+- Complex background cleanup, foreground icon extraction, transparent asset sheets, and local image edits use serial `editppt image edit/generate` calls.
 - If local Codex OAuth exists (`~/.codex/auth.json`), the CLI uses it directly; otherwise it uses API fallback.
 - API fallback configuration lives in `~/.editppt/config.yaml`; on Windows this is `%USERPROFILE%\.editppt\config.yaml`.
 - Correcting text sizes and positions relies on a third-party OCR token (Baidu AI Studio, free) — see "Text Correction And OCR Token" below. Without it the skill falls back to the built-in offline detector with reduced text fidelity.
@@ -79,6 +79,8 @@ It is useful when screenshot-like or image-based slides need to become easier to
 
 `editppt image` selects the image backend automatically: it uses local Codex OAuth first, then falls back to OpenAI-compatible API settings from `~/.editppt/config.yaml` or environment variables.
 
+The public `editppt image generate/edit` parameter surface is intentionally narrow: request inputs need `--prompt` or `--prompt-file`, and edits also need `--image`; page reconstruction should pass an explicit `--out`. The retained practical controls are `--model`, `--size`, `--quality`, `--force`, `--dry-run`, `--timeout`, and edit-only `--mask`. The CLI does not pass any other image API options.
+
 You usually do not need to configure this yourself. Ask the AI to configure API fallback only when:
 
 - The user explicitly asks to use a third-party API or OpenAI-compatible proxy.
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ These parent-level rules are stated once here; page-level rules live in the refe
 - First run `editppt prepare <input...>` to create a run directory. After that, all key state transitions are advanced only through `editppt` commands; never hand-write run/page state JSON. This keeps run state deterministic and resumable.
 - Every page — including the only page of a single-page input — is rebuilt by a dispatched page worker. The parent agent only orchestrates and never rebuilds pages itself. If no subagent capability is available, stop and report this to the user; do not degrade into parent-agent page reconstruction.
 - The parent agent must not write any page reconstruction artifact — `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, or `page_result.json`. These files may only be produced by the page worker that owns the page directory.
-- All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through `editppt image generate/edit/batch`.
+- All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through serial `editppt image generate/edit` calls.
 - All page object decisions follow `references/page-decision-tree.md`, including its no-fallback rule for foreground visual objects and its rule that deterministic validation is a structure gate that never waives an object-source decision.
 - `manifest.json` is the authoritative page build source: `editppt run record` validates `page.pptx` against it, and `editppt run finalize` rebuilds the final deck from recorded page manifests. Required fields and coordinate contracts are defined in `references/manifest-schema.md`.
 - `editppt prepare` writes per-page text measurements (`text_hints.json`/`text_hints.png`). How page workers consume them is defined in `references/page-decision-tree.md` section 3.1.
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/configure_image_backend.py` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ def backend_contract(args):
         "chroma_key_helper": "editppt image process-sheet",
         "input_context_policy": args.input_context_policy,
         "save_path_policy": "write outputs directly to page dir or copy selected outputs before manifest references them",
-        "handoff_rule": "call editppt image generate/edit/batch; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second",
+        "handoff_rule": "call editppt image generate/edit serially; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second",
     }
 
 
@@ -38,7 +38,7 @@ def main():
     if args.tool_name is None:
         args.tool_name = "editppt image"
     if args.tool_call is None:
-        args.tool_call = "editppt image generate/edit/batch"
+        args.tool_call = "editppt image generate/edit"
     if args.fallback_command is None:
         args.fallback_command = "editppt image"
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/image_gen.py` (modified, +139/-1090)
```diff
@@ -9,9 +9,7 @@
 from __future__ import annotations
 
 import argparse
-import asyncio
 import base64
-import concurrent.futures
 import json
 import mimetypes
 import os
@@ -22,20 +20,16 @@
 from typing import Any, Dict, Iterable, List, Optional, Tuple
 from urllib import error, request
 
-from io import BytesIO
-
 DEFAULT_MODEL = "gpt-image-2"
-DEFAULT_SIZE = "2560x1440"
-DEFAULT_QUALITY = "medium"
-DEFAULT_OUTPUT_FORMAT = "png"
-DEFAULT_CONCURRENCY = 5
-DEFAULT_DOWNSCALE_SUFFIX = "-web"
+DEFAULT_SIZE = "auto"
+DEFAULT_QUALITY = "auto"
+DEFAULT_OUTPUT_EXTENSION = "png"
 DEFAULT_OUTPUT_PATH = "output/imagegen/output.png"
+DEFAULT_TIMEOUT = 600
 GPT_IMAGE_MODEL_PREFIX = "gpt-image-"
 
 ALLOWED_LEGACY_SIZES = {"1024x1024", "1536x1024", "1024x1536", "auto"}
 ALLOWED_QUALITIES = {"low", "medium", "high", "auto"}
-ALLOWED_BACKGROUNDS = {"transparent", "opaque", "auto", None}
 
 GPT_IMAGE_2_MODEL = "gpt-image-2"
 GPT_IMAGE_2_MIN_PIXELS = 655_360
@@ -44,52 +38,14 @@
 GPT_IMAGE_2_MAX_RATIO = 3.0
 
 MAX_IMAGE_BYTES = 50 * 1024 * 1024
-MAX_BATCH_JOBS = 500
 DEFAULT_CONFIG_HOME = "~/.editppt"
 DEFAULT_CODEX_AUTH_FILE = "~/.codex/auth.json"
-DEFAULT_CODEX_RESPONSES_BASE_URL = "https://chatgpt.com/backend-api/codex"
-DEFAULT_CODEX_RESPONSES_MODEL = "gpt-5.5"
+DEFAULT_CODEX_IMAGES_BASE_URL = "https://chatgpt.com/backend-api/codex"
 ENV_FIELDS = ("OPENAI_API_KEY", "OPENAI_BASE_URL", "IMAGE_TO_EDITABLE_PPT_IMAGE_MODEL")
 MAX_CODEX_RESPONSE_BYTES = 64 * 1024 * 1024
 MAX_CODEX_BASE64_CHARS = 64 * 1024 * 1024
-
-BATCH_HELP_EPILOG = """\
-Backend:
-  editppt image chooses Codex OAuth first when ~/.codex/auth.json or
-  CODEX_AUTH_FILE is available. Otherwise it uses OPENAI_API_KEY,
-  OPENAI_BASE_URL, and IMAGE_TO_EDITABLE_PPT_IMAGE_MODEL from the environment
-  or ~/.editppt/config.yaml.
-
-JSONL input:
-  Each non-empty line is one job. Comment lines starting with # are ignored.
-  A plain text line is treated as {"prompt": "<line>"}.
-  A JSON object must include "prompt".
-
-Job routing:
-  No image/images field -> generate job (/v1/images/generations).
-  image: "source.png" -> edit job with one input image (/v1/images/edits).
-  images: ["source.png", "style.png"] -> edit job with multiple input images.
-  mask: "mask.png" is supported for API edit jobs only.
-
-Per-job fields:
-  prompt, image, images, mask, out, n, size, quality, background,
-  output_format, output_compression, moderation, fields.
-
-Prompt fields:
-  Use either a nested fields object or flat keys:
-  use_case, scene, subject, style, composition, lighting, palette,
-  materials, text, constraints, negative.
-
-Output:
-  --out-dir is required. If a job has "out", that filename is written under
-  --out-dir. Otherwise the CLI creates a stable numbered slug from the prompt.
-  Duplicate output paths fail before requests are sent.
-
-Examples:
-  {"prompt":"Create a clean blue cloud icon","out":"cloud.png","text":"no text"}
-  {"prompt":"Extract the foreground icon exactly; do not redraw","image":"slide.png","out":"icon.png","constraints":"preserve source shape, color, stroke geometry"}
-  {"prompt":"Use source as target and style as reference","images":["source.png","style.png"],"out":"asset.png"}
-"""
+CHATGPT_AUTH_CLAIM = "https://api.openai.com/auth"
+CHATGPT_ACCOUNT_ID_CLAIM = "chatgpt_account_id"
 
 IMAGE_HELP_EPILOG = """\
 Backend selection:
@@ -105,7 +61,11 @@
 Input image rules:
   generate creates a new image from prompt only.
   edit passes each --image as an edit target, visual reference, or supporting input.
-  batch reads JSONL; jobs with image/images are edit jobs, jobs without them are generate jobs.
+
+Parameter surface:
+  Backend requests pass only model, prompt, size, and quality. Edit requests
+  also pass the input images and optional mask. Local controls such as --out,
+  --force, --dry-run, and --timeout are not image API parameters.
 
 Slide reconstruction patterns:
   Clean base: use edit --image <source.png>; preserve source composition,
@@ -130,13 +90,8 @@
 Use for:
   New supporting images that do not need to preserve an existing slide object.
 
-Prompt fields:
-  --use-case, --scene, --subject, --style, --composition, --lighting, --palette,
-  --materials, --text, --constraints, and --negative are appended when
-  --augment is enabled.
-
 Examples:
-  editppt image generate --prompt "flat blue cloud icon" --text "no text" --out pages/page_001/assets/cloud.png
+  editppt image generate --prompt "flat blue cloud icon, no text" --out pages/page_001/assets/cloud.png
   editppt image generate --prompt-file prompt.txt --size 1536x1024 --quality high --out output.png
 """
 
@@ -224,7 +179,37 @@ def _codex_auth_file() -> Path:
     return Path(os.getenv("CODEX_AUTH_FILE", DEFAULT_CODEX_AUTH_FILE)).expanduser()
 
 
-def _load_codex_access_token() -> Optional[str]:
+def _decode_jwt_payload(token: str) -> Dict[str, Any]:
+    parts = token.split(".")
+    if len(parts) < 2:
+        return {}
+    payload = parts[1] + "=" * (-len(par
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py` (modified, +7/-4)
```diff
@@ -708,7 +708,7 @@ def build_parser() -> argparse.ArgumentParser:
         help="Generate/edit images and process image assets.",
         description="""Unified image generation/editing and deterministic image-file handling.
 
-Use generate/edit/batch for Codex OAuth first, with OpenAI-compatible API fallback
+Use generate/edit for Codex OAuth first, with OpenAI-compatible API fallback
 when local Codex auth is unavailable. Use process-sheet for deterministic
 asset-sheet splitting inside page directories.
 """,
@@ -723,18 +723,21 @@ def build_parser() -> argparse.ArgumentParser:
   editppt config --api-key "your-api-key" --model gpt-image-2
   editppt config --api-key "your-api-key" --base-url https://example.test/v1 --model openai/gpt-image-2
 
+Parameter surface:
+  generate/edit backend requests pass only model, prompt, size, and quality.
+  edit also passes input images and an optional mask. Local controls such as
+  --out, --force, --dry-run, and --timeout are not image API parameters.
+
 Patterns:
   editppt image edit --image pages/page_001/source.png --prompt-file clean-base.prompt.txt --out pages/page_001/assets/clean-base.png
   editppt image edit --image pages/page_001/source.png --prompt-file asset-sheet.prompt.txt --out pages/page_001/assets/asset-sheet.png
-  editppt image batch --input jobs.jsonl --out-dir pages/page_001/assets --concurrency 6
 """,
     )
     image_sub = image.add_subparsers(dest="image_command", metavar="image-command", required=True)
 
     for name, help_text in (
         ("generate", "Create a new image through the unified image backend."),
         ("edit", "Edit one or more images through the unified image backend."),
-        ("batch", "Generate multiple images from JSONL input."),
     ):
         image_api = image_sub.add_parser(name, help=help_text, add_help=False)
         image_api.add_argument("image_args", nargs=argparse.REMAINDER)
@@ -761,7 +764,7 @@ def build_parser() -> argparse.ArgumentParser:
 
 def main() -> int:
     raw_argv = sys.argv[1:]
-    if len(raw_argv) >= 2 and raw_argv[0] == "image" and raw_argv[1] in {"generate", "edit", "batch"}:
+    if len(raw_argv) >= 2 and raw_argv[0] == "image" and raw_argv[1] in {"generate", "edit"}:
         return run_script("image_gen.py", [raw_argv[1], *raw_argv[2:]])
 
     parser = build_parser()
```

**File**: `skills/image-to-editable-ppt/prompts/page-worker.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@ Hard rules (reminders only; the details and rationale live in the references abo
 4. All box_px / points_px / polygon_px values are source.png pixels. Reuse page_request.json.slide and page_request.json.content_box unchanged — do not convert the page to 16:9 or recalculate the canvas; the runtime maps source-pixel coordinates into content_box. Positioned objects without coordinates are page failures.
 5. validation.json must contain a top-level boolean `passed`. Deterministic validation passing never waives an object-source rule.
 
-Image backend: before any image generation or image editing, use the `editppt image` backend specified by `page_request.json.image_backend`. If `editppt image` is unavailable, first follow the CLI error guidance and try `codex login` or `editppt config`; if it is still unavailable, stop the current page and write `validation.json` with `"passed": false`. Do not complete the page using approximate editable structure when required foreground asset separation cannot run. When you need parameter details for the image backend, input images, batch JSONL, clean bases, or asset sheets, read `editppt image --help` and the relevant subcommand help.
+Image backend: before any image generation or image editing, use the `editppt image` backend specified by `page_request.json.image_backend`. If `editppt image` is unavailable, first follow the CLI error guidance and try `codex login` or `editppt config`; if it is still unavailable, stop the current page and write `validation.json` with `"passed": false`. Do not complete the page using approximate editable structure when required foreground asset separation cannot run. When you need parameter details for the image backend, input images, clean bases, or asset sheets, read `editppt image --help` and the relevant subcommand help.
 
 Goal: rebuild the source page as object-level editable PowerPoint. Do not invent an object-source strategy outside `page-decision-tree.md`.
 
@@ -33,7 +33,7 @@ If the page dir already contains artifacts (manifest.json, page.pptx, validation
 Work through the page in this order:
 1. Build the page inventory (Pre-Decision Checklist in page-decision-tree.md).
 2. Decide the background (page-decision-tree.md section 1) and record `background_strategy`.
-3. Decide and separate foreground assets (section 2). Submit all step-1/2 image jobs (clean bases and asset sheets) as one `editppt image batch` call, then record and process the results with `editppt image import` and `editppt image process-sheet`.
+3. Decide and separate foreground assets (section 2). Run step-1/2 image jobs serially with `editppt image generate` or `editppt image edit`; do not use a batch interface. Put icons/foreground objects onto one sparse asset sheet when they fit, with generous gaps between objects for clean splitting; create multiple sheets only when one sheet cannot fit them. After each selected output, record and process it with `editppt image import` and `editppt image process-sheet`.
 4. Rebuild native text, shapes, and tables (section 3). Fill `text_boxes` from the measured text hints per section 3.1; render formulas with `editppt formula render-latex` per section 3.2.
 5. Write manifest.json following the field contracts in manifest-schema.md, including `text_inventory`, `visual_inventory`, `background_strategy`, `quality_checks`, and positioned `text_boxes`/`images`/`shapes`.
 6. Build the artifacts with the deterministic runtime: `editppt page build {{PAGE_DIR}}` (writes page.pptx and preview.png from manifest.json), then `editppt page contact-sheet {{PAGE_DIR}}`, then `editppt page validate {{PAGE_DIR}}` — it runs the same manifest-contract checks `editppt run record` will run, so fix every reported issue here, inside the page.
```

---

### Incident Patch 12: `2ab04297` (2026-06-09)
**Commit Message**: fix: enforce manifest-based page records

**File**: `CHANGELOG.md` (modified, +26/-26)
```diff
@@ -4,45 +4,45 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Features
+
+- Add the installable skill-local `editppt` CLI package with setup, doctor, config, prepare, run, image, and formula command groups.
+- Add a unified image backend through `editppt image`, using Codex OAuth when available and OpenAI-compatible API fallback credentials from `~/.editppt/config.yaml`.
+- Add concurrent `editppt image batch` support for generate/edit jobs, including reference-image edit inputs.
+- Add `editppt formula render-latex` for rendering LaTeX formulas into PPT image assets and manifest fragments.
+- Add source-aspect-preserving slide preparation with automatic custom slide canvases and content boxes for non-widescreen inputs.
+
 ### Improvements
 
-- Remove the public `editppt image crop` path and route foreground image assets through source-faithful asset sheets.
-- Add the skill-local `editppt` CLI package and move deterministic runtime code into the installable skill resources.
-- Add a cross-agent image backend contract centered on the unified `editppt image` CLI.
-- Prefer Codex OAuth inside `editppt image` and fall back to OpenAI-compatible API credentials only when local Codex auth is unavailable.
-- Dispatch multi-page inputs directly to page workers according to concurrency slots.
-- Move API fallback configuration to `~/.editppt/config.yaml`.
-- Refine the public `editppt` command tree into setup/config, run workflow, formula, and image handling groups with agent-friendly help text.
+- Move deterministic runtime code from loose skill scripts into the self-contained `editppt` CLI package and remove legacy script entrypoints from the installable skill root.
+- Rework the workflow around CLI-managed run state: `editppt prepare`, `editppt run next`, `prompt`, `dispatch`, `record`, and `finalize`.
+- Dispatch multi-page inputs directly to page workers according to runtime concurrency slots, with a default concurrency of 6.
+- Rebuild the final PPTX from recorded page manifests during `editppt run finalize`, making `manifest.json` the authoritative final assembly source.
+- Validate each page PPTX against its page manifest during `editppt run record` so page-local outputs cannot bypass the manifest contract.
+- Require source-pixel coordinates for positioned manifest objects and reject manifests that omit required `box_px`, `points_px`, or `polygon_px` fields.
+- Add deterministic text fitting in the manifest builder to clamp oversized first-draft text boxes before preview and PPTX output.
+- Route foreground bitmap assets through source-faithful asset sheets and remove the public source-crop image workflow.
 - Store only page artifacts, hashes, and validation outputs in page result records.
-- Automatically preserve non-widescreen source aspect ratios by preparing custom slide canvases and content boxes.
-- Support concurrent `editppt image batch` edit jobs with `image`/`images` inputs across Codex OAuth and OpenAI-compatible API backends.
-- Increase the default multi-page worker concurrency to 6.
-- Expose image backend integration guidance through `editppt image` help.
-- Use page-local correction before record in run orchestration.
-- Rebuild the final PPTX from recorded page manifests during `editppt run finalize`.
+- Simplify page correction flow so page reconstructors fix page-local issues before record instead of creating repair queues.
+- Expose image backend usage, asset-sheet processing, formula rendering, and run orchestration guidance through agent-friendly CLI help.
 
 ### Fixes
 
 - Resolve `editppt image process-sheet --asset-sheet-source` relative paths from the page directory.
 - Accept structured `text_inventory` entries during PPTX validation.
 - Align single-page direct recording, page-worker prompt paths, and asset-sheet helper examples with the actual `editppt` runtime state machine.
+- Reject recorded or final page manifests whose positioned objects would otherwise fall back to default top-left locations.
+- Preserve custom deck size metadata when finalizing decks from manifests instead of forcing all outputs into widescreen mode.
 
 ### Documentation
 
 - Translate installable skill documentation and agent metadata to English.
-- Require absolute worker prompt paths and top-level `passed` in page validation outputs.
-- Require real page-worker dispatch for multi-page skill runs and forbid parent-agent page reconstruction in that path.
-- Clarify chroma-key color selection for source-faithful asset sheets.
-- Update Chinese and English README files for multi-agent usage, backend configuration, and direct page-worker dispatch.
-- Document third-party image API fallback guidance and keep API keys in the user-level `~/.editppt/config.yaml`.
-- Align installable Skill prompts and references with the unified CLI and image backend terminology.
-- Consolidate installable Skill workflow references into a shorter CLI-first flow contrac
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +6/-0)
```diff
@@ -39,6 +39,9 @@ skills/image-to-editable-ppt/
 - All image generation, image editing, background repair, transparent bitmap assets, and asset sheets must use `editppt image generate/edit/batch`.
 - Page-level reconstruction strategy must follow the References.
 - Foreground visual objects, including foreground photos, screenshots, illustrations, icons, pictograms, symbols, logo-like marks, semantic badges, and trend/status icons, must use image-backend source-faithful asset-sheet separation unless the page-decision tree explicitly classifies them as native structural shapes.
+- `manifest.json` is the authoritative page build source for both page-level validation and final deck assembly. `page.pptx` must be generated from that manifest; a visually acceptable page PPTX produced by separate page-local code is not enough.
+- Positioned manifest objects must carry source-pixel coordinates: `text_boxes[]` and `images[]` require `box_px`, non-line `shapes[]` require `box_px`, and line shapes require `points_px`. Missing coordinates are record/finalize failures.
+- Text boxes should start with deterministic runtime fitting enabled. `text_boxes[].box_px` must track the source text bounds plus modest padding so the builder can clamp oversized first-draft fonts before preview.
 - Page workers use `prompts/page-worker.md`.
 - A full-slide `source.png` with editable text overlaid on top is not an acceptable fallback. The final output must be a currently openable, structurally valid `.pptx`.
 
@@ -68,6 +71,7 @@ Each page worker owns one `pages/page_NNN/` directory:
 - Use `editppt formula render-latex` to render formula image assets.
 - Use `editppt image import` and `editppt image process-sheet` to record and process generated asset sheets.
 - Write `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, and `page_result.json`.
+- Build `page.pptx` and `preview.png` from `manifest.json`; do not use a separate page-local PPTX script that bypasses the manifest.
 - As the page reconstructor, self-check `preview.png`, `split_assets_contact.png`, and `validation.json`; if a page-local issue is found, fix it inside the current page before returning.
 
 Page workers must not edit `deck_manifest.json`, `page_jobs.json`, `notes_manifest.json`, the final PPTX, the original input, or any other page directory.
@@ -120,6 +124,8 @@ After a worker returns, run:
 editppt run record <run> --page <page_id> --agent-id <id>
 ```
 
+This command validates `page.pptx` against `manifest.json` before recording. It must fail if positioned text, image, or shape objects are missing source-pixel coordinates or if the manifest cannot independently rebuild the page.
+
 For a directly rebuilt single-page input, use:
 
 ```bash
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/build_pptx_from_manifest.py` (modified, +106/-1)
```diff
@@ -2,6 +2,8 @@
 import argparse
 import html
 import json
+import math
+import re
 import subprocess
 import sys
 import tempfile
@@ -14,6 +16,9 @@
 REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
 ASPECT_16_9 = 16 / 9
 ASPECT_TOLERANCE = 0.03
+DEFAULT_TEXT_FIT_SAFETY = 0.9
+DEFAULT_TEXT_LINE_HEIGHT = 1.22
+DEFAULT_MIN_FONT_SIZE = 4.0
 
 
 def emu(value):
@@ -144,10 +149,110 @@ def normalize_position_item(manifest, item):
     return item
 
 
+def iter_text_lines(item):
+    if item.get("paragraphs"):
+        lines = []
+        for paragraph in item["paragraphs"]:
+            if isinstance(paragraph, str):
+                lines.append(paragraph)
+            else:
+                runs = paragraph.get("runs")
+                if runs:
+                    lines.append("".join(str(run.get("text", "")) for run in runs))
+                else:
+                    lines.append(str(paragraph.get("text", "")))
+        return lines or [""]
+    if item.get("runs"):
+        return ["".join(str(run.get("text", "")) for run in item["runs"])]
+    return str(item.get("text", "")).splitlines() or [""]
+
+
+def text_width_units(text):
+    units = 0.0
+    for char in str(text):
+        codepoint = ord(char)
+        if char.isspace():
+            units += 0.32
+        elif codepoint <= 0x7F:
+            units += 0.55
+        elif 0xFF00 <= codepoint <= 0xFFEF:
+            units += 1.0
+        elif 0x4E00 <= codepoint <= 0x9FFF:
+            units += 1.0
+        else:
+            units += 0.85
+    return max(units, 1.0)
+
+
+def longest_unbreakable_units(text):
+    tokens = [token for token in re.split(r"\s+", str(text)) if token]
+    if not tokens:
+        return text_width_units(text)
+    return max(text_width_units(token) for token in tokens)
+
+
+def fitted_font_size(item, manifest):
+    if item.get("fit_text") is False or manifest.get("fit_text") is False:
+        return None
+    if "width" not in item or "height" not in item:
+        return None
+    lines = iter_text_lines(item)
+    requested = float(item.get("font_size", 18))
+    width_pt = max(1.0, float(item.get("width", 1)) * 72)
+    height_pt = max(1.0, float(item.get("height", 0.4)) * 72)
+    safety = float(item.get("text_fit_safety", manifest.get("text_fit_safety", DEFAULT_TEXT_FIT_SAFETY)))
+    line_height = float(item.get("line_height", manifest.get("text_line_height", DEFAULT_TEXT_LINE_HEIGHT)))
+    wrap_enabled = item.get("wrap") not in (None, "", "none")
+    if wrap_enabled:
+        line_count = sum(max(1, math.ceil(text_width_units(line) * requested / width_pt)) for line in lines)
+        width_limit = width_pt / max(longest_unbreakable_units(line) for line in lines)
+    else:
+        line_count = max(1, len(lines))
+        width_limit = width_pt / max(text_width_units(line) for line in lines)
+    height_limit = height_pt / (line_count * max(line_height, 1.0))
+    max_font_size = min(width_limit, height_limit) * safety
+    explicit_max = item.get("max_font_size")
+    if explicit_max not in (None, ""):
+        max_font_size = min(max_font_size, float(explicit_max))
+    min_font_size = float(item.get("min_font_size", manifest.get("min_font_size", DEFAULT_MIN_FONT_SIZE)))
+    return max(min_font_size, max_font_size)
+
+
+def scale_run_font_sizes(item, ratio):
+    def scale_run(run):
+        if run.get("font_size") not in (None, ""):
+            run["font_size"] = round(float(run["font_size"]) * ratio, 1)
+
+    for run in item.get("runs", []):
+        scale_run(run)
+    for paragraph in item.get("paragraphs", []):
+        if isinstance(paragraph, dict):
+            for run in paragraph.get("runs", []):
+                scale_run(run)
+
+
+def fit_text_item(item, manifest):
+    fitted = fitted_font_size(item, manifest)
+    if fitted is None:
+        return item
+    requested = float(item.get("font_size", fitted))
+    effective = min(requested, fitted)
+    if effective < requested:
+        item["_requested_font_size"] = requested
+        item["font_size"] = round(effective, 1)
+        scale_run_font_sizes(item, effective / requested)
+    elif "font_size" not in item:
+        item["font_size"] = round(effective, 1)
+    return item
+
+
 def normalize_manifest(manifest):
     """Return a manifest copy with pixel authoring fields resolved to inches."""
     normalized = deepcopy(manifest)
-    for key in ("text_boxes", "images", "shapes"):
+    normalized["text_boxes"] = [
+        fit_text_item(normalize_position_item(normalized, item), normalized) for item in normalized.get("text_boxes", [])
+    ]
+    for key in ("images", "shapes"):
         normalized[key] = [normalize_position_item(normalized, item) for item in normalized.get(key, [])]
     return normalized
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/record_page_result.py` (modified, +24/-0)
```diff
@@ -1,6 +1,9 @@
 #!/usr/bin/env python3
 import argparse
 import json
+import subprocess
+import sys
+from pathlib import Path
 
 from deck_run_state import (
     find_page,
@@ -29,11 +32,31 @@
 }
 
 
+SCRIPT_DIR = Path(__file__).resolve().parent
+
+
 def output_path(page_dir, result, key, default):
     value = result.get(key) or default
     return inside_or_missing(page_dir, value)
 
 
+def validate_page_contract(paths):
+    command = [
+        sys.executable,
+        SCRIPT_DIR / "validate_pptx.py",
+        paths["page_pptx"],
+        "--manifest",
+        paths["page_manifest"],
+    ]
+    result = subprocess.run([str(part) for part in command], text=True, capture_output=True)
+    if result.returncode != 0:
+        raise SystemExit(
+            "Page manifest contract validation failed before recording:\n"
+            + result.stdout
+            + result.stderr
+        )
+
+
 def main():
     parser = argparse.ArgumentParser(description="Record and verify a page worker result.")
     parser.add_argument("run", help="Run directory or deck_manifest.json")
@@ -70,6 +93,7 @@ def main():
     result = read_json(page_result_path)
     paths = {key: output_path(page_dir, result, key, default) for key, default in REQUIRED_OUTPUTS.items()}
 
+    validate_page_contract(paths)
     validation = read_json(paths["validation"])
     validation_passed = validation.get("passed") is True
     hashes = {key: sha256_file(path) for key, path in paths.items()}
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/validate_pptx.py` (modified, +25/-0)
```diff
@@ -301,6 +301,31 @@ def validate_deck(args):
             validation_path = root / validation_path
         if not manifest_path.exists():
             report["page_manifests_missing"].append(str(manifest_path))
+        else:
+            try:
+                raw_manifest = read_manifest(manifest_path)
+                normalized_manifest, authoring_violations = normalize_for_validation(raw_manifest)
+                violations = (
+                    authoring_violations
+                    + page_contract_violations(normalized_manifest)
+                    + quality_contract_violations(raw_manifest)
+                )
+                if violations:
+                    report["page_contract_violations"].append(
+                        {
+                            "page_id": page.get("page_id"),
+                            "manifest": str(manifest_path),
+                            "violations": violations,
+                        }
+                    )
+            except Exception as exc:
+                report["page_contract_violations"].append(
+                    {
+                        "page_id": page.get("page_id"),
+                        "manifest": str(manifest_path),
+                        "violations": [{"field": "manifest", "reason": str(exc)}],
+                    }
+                )
         if not validation_path.exists():
             report["page_validation_missing"].append(str(validation_path))
         else:
```

**File**: `skills/image-to-editable-ppt/prompts/page-worker.md` (modified, +16/-2)
```diff
@@ -22,6 +22,8 @@ When you need parameter details for the image backend, input images, batch JSONL
 
 The manifest must reuse `page_request.json.slide` and `page_request.json.content_box`. Do not convert the page to 16:9 yourself and do not recalculate the canvas. All `box_px`, `points_px`, and `polygon_px` values are in `source.png` pixels; the runtime maps them into `content_box` so the source image is not stretched.
 
+`manifest.json` is the authoritative page source used by final deck assembly. It must be sufficient to rebuild the page without reading any custom page script. `text_inventory` and `visual_inventory` are only inventories; they do not substitute for positioned `text_boxes`, `images`, and `shapes`.
+
 Goal:
 Rebuild the source page as object-level editable PowerPoint. All page object categories, native shape boundaries, and separable asset boundaries must follow `references/page-decision-tree.md`. Do not invent an object-source strategy outside this prompt.
 
@@ -62,14 +64,26 @@ Use `editppt image generate/edit/batch` to generate clean bases, background repa
 - `visual_inventory`: inventory of non-text visual objects, at least recording id, description, decision, and corresponding asset/background.
 - `background_strategy`: background handling mode, source-consistency constraints, whether local repair is used, whether a full imagegen clean base is used, and why.
 - `quality_checks`: `font_size_calibrated`, `visual_inventory_matched`, `background_strategy_checked`, and `shape_corner_geometry_checked` must all be true.
+- Positioned build objects:
+  - every `text_boxes[]` item must include `box_px` and calibrated text styling such as `font_size`;
+  - every `images[]` item must include `box_px`;
+  - every non-line `shapes[]` item must include `box_px`;
+  - every line shape must include `points_px`.
+  Missing object coordinates are a current-page failure, even if a separately generated `page.pptx` looks correct.
+- Text sizing:
+  - make each text `box_px` track the source text bounds plus modest padding, not the entire surrounding card or panel;
+  - start from the deterministic builder's default text fitting instead of an oversized default font;
+  - keep `fit_text` enabled unless a text box has been manually calibrated and must preserve an exact font size;
+  - if the first preview still looks larger than the source, reduce the recorded `font_size` before setting `font_size_calibrated: true`.
 
 Before returning:
 
-- Build page.pptx from manifest.json.
-- Render preview.png.
+- Build page.pptx from manifest.json with the deterministic runtime, not from a separate hand-written PowerPoint script that bypasses the manifest.
+- Render preview.png from the same manifest.json.
 - Create split_assets_contact.png.
 - Run page validation.
 - Confirm validation.json contains top-level `passed: true`.
+- Confirm `editppt run record` can validate `page.pptx` against `manifest.json`; if manifest rebuild validation would fail, set `passed: false` and fix the manifest before returning.
 - Check that all required outputs exist.
 - As the page reconstructor, self-check preview/contact sheet: font sizes are not too large, no visual objects are missing, complex backgrounds have not been replaced wholesale, and rectangles/corners match the source.
 - If a page-local issue is found, fix it inside the current page before returning.
```

**File**: `skills/image-to-editable-ppt/references/cli-helper.md` (modified, +2/-2)
```diff
@@ -84,7 +84,7 @@ Purpose: normalize a single image into a run directory and generate `deck_manife
 editppt run record <run> --page page_001 --agent-id main
 ```
 
-Purpose: after the parent agent directly completes the current single page, self-checks it, and writes all page-local outputs, record that page result.
+Purpose: after the parent agent directly completes the current single page, self-checks it, and writes all page-local outputs, validate `page.pptx` against `manifest.json` and record that page result.
 
 ```bash
 editppt run finalize <run>
@@ -124,7 +124,7 @@ Purpose: record that a page has been dispatched to a worker. This command only r
 editppt run record <run> --page page_001 --agent-id <worker-id>
 ```
 
-Purpose: after the page worker writes `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, and `page_result.json`, validate and record that page result.
+Purpose: after the page worker writes `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, and `page_result.json`, validate `page.pptx` against `manifest.json` and record that page result. Missing `box_px` / `points_px` on positioned objects is a page failure.
 
 ```bash
 editppt run finalize <run>
```

**File**: `skills/image-to-editable-ppt/references/manifest-schema.md` (modified, +18/-0)
```diff
@@ -133,6 +133,8 @@ Owner: page worker.
 
 Purpose: source of truth for page-level PPTX construction.
 
+The manifest is not a summary of a separately authored `page.pptx`. It is the build contract for both page-level validation and final deck assembly. A page may not pass validation if the page PPTX can only be reproduced by custom page-local code while the manifest lacks object positions.
+
 Must contain:
 
 - `slide`
@@ -150,6 +152,22 @@ Must contain:
 
 `slide`, `content_box`, and `source.width_px/source.height_px` must come from `page_request.json`. All `box_px`, `points_px`, and `polygon_px` values use `source.png` pixel coordinates; the runtime maps these coordinates into `content_box` instead of stretching them to the whole slide.
 
+Positioned build object requirements:
+
+- Every `text_boxes[]` item must have `box_px`. Text in `text_inventory` does not create a positioned text box.
+- Every `images[]` item must have `box_px`.
+- Every non-line `shapes[]` item must have `box_px`.
+- Every line shape must have `points_px`.
+
+Missing coordinates are page-contract violations. The runtime must reject them during `editppt run record` and deck validation because otherwise missing values fall back to default positions such as the top-left corner.
+
+Text-size fitting:
+
+- `text_boxes[].font_size` is treated as the requested font size. The deterministic builder may clamp it downward during normalization when the requested size is too large for the resolved source-pixel box.
+- Keep default fitting enabled for first drafts. Set `fit_text: false` only when the page author has manually calibrated the box and font size.
+- `text_boxes[].box_px` should describe the source text bounds plus modest padding. Do not use an entire card, chart, table cell group, or unrelated container as the text box, because the fitter can only infer size from the box it receives.
+- Optional tuning fields are `min_font_size`, `max_font_size`, `text_fit_safety`, and `line_height`.
+
 `text_inventory` may be a list of strings or a list of structured objects. In structured objects, the fields used for exact text validation are `text`, `required_text`, `items`, or `texts`; fields such as `id`, `decision`, `description`, and `note` are only records and are not used for exact text matching. Example:
 
 ```json
```

---

### Incident Patch 13: `464273d0` (2026-06-09)
**Commit Message**: fix: rebuild final deck from manifests

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ Release notes are generated from this file. Keep changelog entries in English.
 - Increase the default multi-page worker concurrency to 6.
 - Expose image backend integration guidance through `editppt image` help.
 - Use page-local correction before record in run orchestration.
+- Rebuild the final PPTX from recorded page manifests during `editppt run finalize`.
 
 ### Fixes
 
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +2/-2)
```diff
@@ -52,7 +52,7 @@ The parent agent owns orchestration and user interaction:
 - For a multi-page input, do not write any page reconstruction artifacts inside `pages/page_NNN/`; use only `editppt run next` to obtain pages that need dispatch.
 - Generate prompts for pages that need work, spawn page workers, and record dispatches with `editppt run dispatch`.
 - Record page worker results with `editppt run record`.
-- Assemble and validate the final PPTX with `editppt run finalize`. Final assembly concatenates the recorded page-level `page.pptx` files in page order; it does not rebuild the final deck from page manifests.
+- Assemble and validate the final PPTX with `editppt run finalize`. Final assembly reads the recorded page manifests in page order and rebuilds the final deck from those manifests.
 - Report progress, final path, and validation result to the user.
 
 The parent agent must not create or modify page-local reconstruction outputs in multi-page runs, must not repeat page-level visual QA already completed by page workers, and must not hand-write key state JSON.
@@ -130,7 +130,7 @@ editppt run record <run> --page page_001 --agent-id main
 
 Read the finalize examples in `references/cli-helper.md` and the deck-level QA points in `references/qa-rubric.md`.
 
-`editppt run finalize` treats each recorded `pages/page_NNN/page.pptx` as the authoritative page output. It assembles the final deck by copying the first slide from each page PPTX in page order, preserving that page worker's self-checked slide output. Do not use manifest-based whole-deck reconstruction as a fallback.
+`editppt run finalize` treats each recorded `pages/page_NNN/manifest.json` as the authoritative source for final assembly. It rebuilds the final deck from page manifests in page order, then validates the resulting PPTX. `page.pptx` remains a page-level deliverability artifact for record-time checks.
 
 When `editppt run next <run>` returns the finalize stage:
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/assemble_pptx_from_pages.py` (removed, +0/-381)
```diff
@@ -1,381 +0,0 @@
-#!/usr/bin/env python3
-import argparse
-import json
-import posixpath
-import re
-import zipfile
-from pathlib import Path
-from xml.etree import ElementTree as ET
-
-
-REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
-PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
-OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
-CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
-ASPECT_16_9 = 16 / 9
-ASPECT_TOLERANCE = 0.03
-EMU_PER_INCH = 914400
-
-RELATIONSHIP = f"{{{REL_NS}}}Relationship"
-OVERRIDE = f"{{{CONTENT_TYPES_NS}}}Override"
-DEFAULT = f"{{{CONTENT_TYPES_NS}}}Default"
-
-
-IMAGE_REL = f"{OFFICE_REL_NS}/image"
-NOTES_MASTER_REL = f"{OFFICE_REL_NS}/notesMaster"
-NOTES_SLIDE_REL = f"{OFFICE_REL_NS}/notesSlide"
-SLIDE_REL = f"{OFFICE_REL_NS}/slide"
-SLIDE_LAYOUT_REL = f"{OFFICE_REL_NS}/slideLayout"
-SLIDE_MASTER_REL = f"{OFFICE_REL_NS}/slideMaster"
-THEME_REL = f"{OFFICE_REL_NS}/theme"
-
-
-CONTENT_TYPES = {
-    ".bin": "application/vnd.openxmlformats-officedocument.presentationml.printerSettings",
-    ".gif": "image/gif",
-    ".jpeg": "image/jpeg",
-    ".jpg": "image/jpeg",
-    ".png": "image/png",
-    ".svg": "image/svg+xml",
-    ".xml": "application/xml",
-    ".rels": "application/vnd.openxmlformats-package.relationships+xml",
-}
-
-
-def emu(value):
-    return int(round(float(value) * EMU_PER_INCH))
-
-
-def is_wide_slide(width, height):
-    return abs((float(width) / float(height)) / ASPECT_16_9 - 1) <= ASPECT_TOLERANCE
-
-
-def slide_size_type(width, height):
-    return "wide" if is_wide_slide(width, height) else "custom"
-
-
-def rels_xml(relationships):
-    body = "".join(
-        f'<Relationship Id="{rel["id"]}" Type="{rel["type"]}" Target="{rel["target"]}"'
-        + (f' TargetMode="{rel["target_mode"]}"' if rel.get("target_mode") else "")
-        + "/>"
-        for rel in relationships
-    )
-    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{REL_NS}">{body}</Relationships>'
-
-
-def rel_source_part(rels_name):
-    directory = posixpath.dirname(rels_name)
-    if directory.endswith("/_rels"):
-        directory = posixpath.dirname(directory)
-    source = posixpath.basename(rels_name)[:-5]
-    return posixpath.normpath(posixpath.join(directory, source))
-
-
-def resolve_target(rels_name, target):
-    if not target or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
-        return None
-    source = rel_source_part(rels_name)
-    return posixpath.normpath(posixpath.join(posixpath.dirname(source), target))
-
-
-def relative_target(from_part, to_part):
-    source_dir = posixpath.dirname(from_part)
-    return posixpath.relpath(to_part, source_dir)
-
-
-def parse_relationships(z, rels_name):
-    if rels_name not in z.namelist():
-        return []
-    root = ET.fromstring(z.read(rels_name))
-    relationships = []
-    for rel in root.findall(RELATIONSHIP):
-        relationships.append(
-            {
-                "id": rel.attrib["Id"],
-                "type": rel.attrib["Type"],
-                "target": rel.attrib.get("Target", ""),
-                "target_mode": rel.attrib.get("TargetMode"),
-            }
-        )
-    return relationships
-
-
-def presentation_slide_parts(z):
-    rels = parse_relationships(z, "ppt/_rels/presentation.xml.rels")
-    slide_parts = []
-    for rel in rels:
-        if rel["type"] == SLIDE_REL and rel.get("target_mode") != "External":
-            slide_parts.append(posixpath.normpath(posixpath.join("ppt", rel["target"])))
-    if slide_parts:
-        return slide_parts
-    return sorted(name for name in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name))
-
-
-def slide_size_from_deck(deck):
-    slide = deck.get("slide", {})
-    return emu(slide.get("width", 13.333)), emu(slide.get("height", 7.5))
-
-
-def content_type_for_part(z, part_name):
-    suffix = Path(part_name).suffix.lower()
-    fallback = CONTENT_TYPES.get(suffix)
-    try:
-        root = ET.fromstring(z.read("[Content_Types].xml"))
-    except Exception:
-        return fallback
-    for override in root.findall(OVERRIDE):
-        if override.attrib.get("PartName") == "/" + part_name:
-            return override.attrib.get("ContentType", fallback)
-    for default in root.findall(DEFAULT):
-        if default.attrib.get("Extension", "").lower() == suffix.lstrip("."):
-            return default.attrib.get("ContentType", fallback)
-    return fallback
-
-
-def next_part_name(prefix, source_part, used_names):
-    suffix = Path(source_part).suffix.lower()
-    counter = 1
-    while True:
-        candidate = f"{prefix}{counter}{suffix}"
-        if candidate not in used_names:
-            used_names.add(candidate)
-            return candidate
-        counter += 1
-
-
-def common_content_types(slide_count, copied_parts, notes_indices=None):
-    notes_indices = notes_indices or []
-
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/build_pptx_from_manifest.py` (modified, +91/-2)
```diff
@@ -537,6 +537,88 @@ def write_pptx(manifest, out_path, manifest_path):
             media_index += 1
 
 
+def deck_slide_size(deck, page_entries):
+    slide = deck.get("slide") or {}
+    if not slide and page_entries:
+        slide = page_entries[0]["manifest"].get("slide", {})
+    return emu(slide.get("width", 13.333)), emu(slide.get("height", 7.5))
+
+
+def write_deck(deck, page_entries, out_path, notes_entries):
+    if not page_entries:
+        raise ValueError("Deck has no pages")
+    width, height = deck_slide_size(deck, page_entries)
+    out = Path(out_path)
+    out.parent.mkdir(parents=True, exist_ok=True)
+    notes_by_page = {int(entry.get("page_index", 0)): entry for entry in notes_entries if entry.get("text")}
+    notes_indices = sorted(notes_by_page)
+    normalized_entries = [{**entry, "manifest": normalize_manifest(entry["manifest"])} for entry in page_entries]
+    manifests = [entry["manifest"] for entry in normalized_entries]
+    media_index = 1
+    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
+        z.writestr("[Content_Types].xml", content_types_xml(manifests, notes_indices))
+        write_common_parts(z, len(page_entries), width, height, len(notes_by_page))
+        for slide_index, entry in enumerate(normalized_entries, start=1):
+            manifest = entry["manifest"]
+            notes_index = slide_index if slide_index in notes_by_page else None
+            z.writestr(f"ppt/slides/slide{slide_index}.xml", slide_xml(manifest))
+            z.writestr(f"ppt/slides/_rels/slide{slide_index}.xml.rels", rels_xml(manifest, media_index, notes_index))
+            base = Path(entry["manifest_path"]).resolve().parent
+            for item in manifest.get("images", []):
+                src = Path(item["path"])
+                if not src.is_absolute():
+                    src = base / src
+                z.write(src, f"ppt/media/image{media_index}{image_ext(src)}")
+                media_index += 1
+            if notes_index is not None:
+                note = notes_by_page[slide_index]
+                notes_xml = note.get("notes_xml")
+                if notes_xml and Path(notes_xml).exists():
+                    z.writestr(f"ppt/notesSlides/notesSlide{notes_index}.xml", Path(notes_xml).read_bytes())
+                else:
+                    z.writestr(f"ppt/notesSlides/notesSlide{notes_index}.xml", notes_slide_xml(note.get("text", "")))
+                z.writestr(f"ppt/notesSlides/_rels/notesSlide{notes_index}.xml.rels", notes_rels_xml(slide_index))
+
+
+def page_entries_from_deck_manifest(deck_manifest_path):
+    deck_path = Path(deck_manifest_path).resolve()
+    deck = json.loads(deck_path.read_text(encoding="utf-8"))
+    root = Path(deck.get("job_dir", deck_path.parent)).resolve()
+    entries = []
+    for page in deck.get("pages", []):
+        manifest_path = Path(page.get("manifest", ""))
+        if not manifest_path.is_absolute():
+            manifest_path = root / manifest_path
+        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
+        entries.append({"manifest": manifest, "manifest_path": manifest_path})
+    notes_path = deck.get("notes_manifest")
+    notes_entries = []
+    if notes_path:
+        notes_file = Path(notes_path)
+        if not notes_file.is_absolute():
+            notes_file = root / notes_file
+        if notes_file.exists():
+            notes_entries = json.loads(notes_file.read_text(encoding="utf-8")).get("notes", [])
+            for note in notes_entries:
+                notes_xml = note.get("notes_xml")
+                if notes_xml:
+                    notes_xml_path = Path(notes_xml)
+                    if not notes_xml_path.is_absolute():
+                        notes_xml_path = root / notes_xml_path
+                    note["notes_xml"] = str(notes_xml_path)
+    return deck, entries, notes_entries
+
+
+def output_path_from_deck_manifest(deck_manifest_path):
+    deck_path = Path(deck_manifest_path).resolve()
+    deck = json.loads(deck_path.read_text(encoding="utf-8"))
+    root = Path(deck.get("job_dir", deck_path.parent)).resolve()
+    output = Path(deck.get("output", "final/deck_edited.pptx"))
+    if not output.is_absolute():
+        output = root / output
+    return output
+
+
 def render_preview(manifest, manifest_path, out_path):
     from PIL import Image, ImageColor, ImageDraw, ImageFont
 
@@ -708,13 +790,20 @@ def draw_dashed_line(draw, box, fill, width):
 def main():
     parser = argparse.ArgumentParser()
     parser.add_argument("manifest", nargs="?")
+    parser.add_argument("--deck-manifest")
     parser.add_argument("--out")
     parser.add_argument("--preview")
     args = parser.parse_args()
+    if args.deck_manifest:
+        deck, entries, notes_entries = page_entries_from_deck_manifest(args.deck_manifest)
+        out = Path(args.out) if args.out else output_path_from_deck_manifest(args.deck_manifest)
+        write_deck(deck, entries, out, notes_entr
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/finalize_deck_run.py` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ def main():
 
     out = final_output_path(run_dir, deck)
     out.parent.mkdir(parents=True, exist_ok=True)
-    run([sys.executable, SCRIPT_DIR / "assemble_pptx_from_pages.py", run_dir, "--out", out])
+    run([sys.executable, SCRIPT_DIR / "build_pptx_from_manifest.py", "--deck-manifest", run_dir / "deck_manifest.json", "--out", out])
     set_run_status(run_dir, "deck_built", "final pptx built")
 
     validation = out.parent / "validation.json"
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py` (modified, +1/-1)
```diff
@@ -631,7 +631,7 @@ def build_parser() -> argparse.ArgumentParser:
     finalize = run_sub.add_parser(
         "finalize",
         help="Build and validate the final deck.",
-        description="Assemble recorded pages into final/<origin>_edited.pptx and write validation outputs.",
+        description="Build final/<origin>_edited.pptx from recorded page manifests and write validation outputs.",
         formatter_class=HELP_FORMATTER,
     )
     finalize.add_argument("run", metavar="RUN", help="Run directory or deck_manifest.json path.")
```

**File**: `skills/image-to-editable-ppt/references/cli-helper.md` (modified, +3/-3)
```diff
@@ -22,7 +22,7 @@ editppt                         - top-level CLI for setup, run orchestration, im
 |   |-- prompt                  - generate an absolute page-worker prompt for one page
 |   |-- dispatch                - record that a real page worker/subagent was spawned
 |   |-- record                  - validate required page outputs and record page result hashes
-|   `-- finalize                - assemble recorded pages and validate the final PPTX
+|   `-- finalize                - rebuild the final PPTX from recorded page manifests and validate it
 |-- image                       - generate, edit, import, and process bitmap assets
 |   |-- generate                - create a new image from a text prompt
 |   |-- edit                    - edit a source image for clean bases or source-faithful asset sheets
@@ -90,7 +90,7 @@ Purpose: after the parent agent directly completes the current single page, self
 editppt run finalize <run>
 ```
 
-Purpose: after recording is complete, assemble and validate the final PPTX by concatenating recorded page-level `page.pptx` files in page order. The final deck is not rebuilt from page manifests.
+Purpose: after recording is complete, rebuild and validate the final PPTX from the recorded page manifests in page order.
 
 ## Common Multi-Page Commands
 
@@ -130,7 +130,7 @@ Purpose: after the page worker writes `manifest.json`, `page.pptx`, `preview.png
 editppt run finalize <run>
 ```
 
-Purpose: after all pages are recorded, assemble, validate, and output the final PPTX. Final assembly copies the first slide from each recorded `pages/page_NNN/page.pptx` into the final deck, preserving the page worker's validated output instead of reinterpreting `manifest.json` to rebuild the slide.
+Purpose: after all pages are recorded, rebuild, validate, and output the final PPTX. Final assembly reads each recorded `pages/page_NNN/manifest.json` in page order and generates the final deck from those manifests. `page.pptx` remains a page-local deliverability artifact, not the final assembly input.
 
 Concurrency slots come from `page_jobs.json.max_concurrent_pages`; the default is 6. In normal flow, prefer `editppt run next` to determine the next action. `editppt run status` is only for debugging or manual inspection.
 
```

**File**: `skills/image-to-editable-ppt/references/manifest-schema.md` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ Includes:
 - validation path
 - page-local output hashes, which may be supplemented by `editppt run record`
 
-The `page_pptx` artifact is the authoritative slide package for final assembly. `editppt run finalize` concatenates recorded page-level `page.pptx` files in page order; it does not rebuild the final deck from page manifests.
+The `manifest` artifact is the authoritative page source for final assembly. `editppt run finalize` rebuilds the final deck from recorded page manifests in page order. The `page_pptx` artifact remains a page-level deliverability artifact and is validated by `editppt run record`, but it is not the final assembly input.
 
 ## `pages/page_NNN/validation.json`
 
```

---

### Incident Patch 14: `4cd7493c` (2026-06-09)
**Commit Message**: fix: remove source crop workflow

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ### Improvements
 
+- Remove the public `editppt image crop` path and route foreground image assets through source-faithful asset sheets.
 - Add the skill-local `editppt` CLI package and move deterministic runtime code into the installable skill resources.
 - Add a cross-agent image backend contract centered on the unified `editppt image` CLI.
 - Prefer Codex OAuth inside `editppt image` and fall back to OpenAI-compatible API credentials only when local Codex auth is unavailable.
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +5/-4)
```diff
@@ -38,6 +38,7 @@ skills/image-to-editable-ppt/
 - Multi-page inputs must be truly dispatched to subagents/page workers. If no subagent capability is available, stop and report this to the user; do not degrade into serial parent-agent page reconstruction.
 - All image generation, image editing, background repair, transparent bitmap assets, and asset sheets must use `editppt image generate/edit/batch`.
 - Page-level reconstruction strategy must follow the References.
+- Foreground visual objects, including foreground photos, screenshots, illustrations, icons, pictograms, symbols, logo-like marks, semantic badges, and trend/status icons, must use image-backend source-faithful asset-sheet separation unless the page-decision tree explicitly classifies them as native structural shapes.
 - Page workers use `prompts/page-worker.md`.
 - A full-slide `source.png` with editable text overlaid on top is not an acceptable fallback. The final output must be a currently openable, structurally valid `.pptx`.
 
@@ -62,10 +63,10 @@ Each page worker owns one `pages/page_NNN/` directory:
 - Write only its own page directory.
 - Use `page_request.json.image_backend`.
 - Analyze text, structure, background, and foreground visual objects.
-- Use the page decision tree to choose native text, native shapes, LaTeX-rendered formula assets, clean bases, asset sheets, or source-derived assets.
+- Use the page decision tree to choose native text, native shapes, LaTeX-rendered formula assets, clean bases, and asset sheets.
 - Use `editppt image generate/edit/batch` to generate or edit required bitmaps.
 - Use `editppt formula render-latex` to render formula image assets.
-- Use `editppt image import`, `editppt image process-sheet`, and `editppt image crop` to record and process generated assets.
+- Use `editppt image import` and `editppt image process-sheet` to record and process generated asset sheets.
 - Write `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, and `page_result.json`.
 - As the page reconstructor, self-check `preview.png`, `split_assets_contact.png`, and `validation.json`; if a page-local issue is found, fix it inside the current page before returning.
 
@@ -153,15 +154,15 @@ Required states:
 `imagegen-jobs.json` is the page-local provenance/job record. Only these forced file states are kept:
 
 - `recorded`: `editppt image import` has copied the selected output and written hash/metadata.
-- `processed`: `editppt image process-sheet` or `editppt image crop` has completed background removal, splitting, or cropping.
+- `processed`: `editppt image process-sheet` has completed background removal and splitting.
 
 ## Delivery Principles
 
 - Each page is self-checked once by the page reconstructor; the evidence is written into structured fields in `manifest.json` and into `validation.json`.
 - If a page-local issue is found, the current page author fixes it directly.
 - The final output must be a currently openable, structurally valid `.pptx`.
 - A full-slide `source.png` with editable text overlaid on top is not an acceptable fallback.
-- Minor drift in icons, bitmap assets, fonts, positions, shapes, and similar details may be delivered as warnings with the PPT.
+- Minor drift in icons, bitmap assets, fonts, positions, shapes, and similar details may be delivered as warnings only after the object-source decision follows the page decision tree. Missing asset edges, forbidden source types for foreground assets, or replacing required asset-sheet separation with a direct source-image snippet are current-page failures, not warnings.
 
 ## Update Skill
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/_page_artifacts.py` (modified, +0/-138)
```diff
@@ -1,4 +1,3 @@
-import argparse
 import json
 import shutil
 import subprocess
@@ -98,143 +97,6 @@ def process_asset_sheet(args, page_dir):
     run(command)
 
 
-def parse_box(value):
-    parts = [int(round(float(part.strip()))) for part in value.split(",")]
-    if len(parts) != 4:
-        raise argparse.ArgumentTypeError("crop box must contain four comma-separated numbers")
-    left, top, right, bottom = parts
-    if right <= left or bottom <= top:
-        raise argparse.ArgumentTypeError("crop box must be left,top,right,bottom")
-    return left, top, right, bottom
-
-
-def append_provenance(
-    manifest_path,
-    asset_path,
-    source_path,
-    source_type,
-    provenance_note,
-    approval_note,
-    source_region_px=None,
-):
-    manifest_file = Path(manifest_path)
-    manifest = json.loads(manifest_file.read_text(encoding="utf-8")) if manifest_file.exists() else {}
-    entries = manifest.setdefault("asset_provenance", [])
-    asset_key = Path(asset_path).as_posix()
-    entries[:] = [entry for entry in entries if Path(entry.get("path", "")).as_posix() != asset_key]
-    entry = {
-        "path": asset_key,
-        "source": str(source_path),
-        "source_type": source_type,
-        "provenance_note": provenance_note,
-    }
-    if approval_note:
-        entry["approval_note"] = approval_note
-    if source_region_px:
-        entry["source_region_px"] = list(source_region_px)
-    entries.append(entry)
-    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
-
-
-def padded_box(box, padding, image_size):
-    left, top, right, bottom = box
-    width, height = image_size
-    return (
-        max(0, left - padding),
-        max(0, top - padding),
-        min(width, right + padding),
-        min(height, bottom + padding),
-    )
-
-
-def remove_border_background(image, threshold=52, soften=0.45):
-    from PIL import ImageFilter
-
-    crop = image.convert("RGBA")
-    pixels = crop.load()
-    width, height = crop.size
-    if width <= 0 or height <= 0:
-        return crop
-
-    border_samples = []
-    for px in range(width):
-        border_samples.append(crop.getpixel((px, 0))[:3])
-        border_samples.append(crop.getpixel((px, height - 1))[:3])
-    for py in range(height):
-        border_samples.append(crop.getpixel((0, py))[:3])
-        border_samples.append(crop.getpixel((width - 1, py))[:3])
-    bg = tuple(sorted(channel)[len(channel) // 2] for channel in zip(*border_samples))
-
-    for py in range(height):
-        for px in range(width):
-            r, g, b, _a = pixels[px, py]
-            dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
-            brightness = (r + g + b) / 3
-            alpha = 0 if dist < threshold and brightness > 140 else 255
-            if alpha and dist < threshold + 18 and brightness > 165:
-                alpha = int(max(0, min(255, (dist - threshold) / 18 * 255)))
-            pixels[px, py] = (r, g, b, alpha)
-
-    if soften:
-        alpha = crop.getchannel("A").filter(ImageFilter.GaussianBlur(soften))
-        crop.putalpha(alpha)
-    return crop
-
-
-def crop_asset(
-    page_dir,
-    source,
-    out,
-    box,
-    manifest=None,
-    source_type="imagegen",
-    provenance_note=None,
-    approval_note=None,
-    crop_padding=0,
-    remove_border_bg=False,
-    matte_threshold=52,
-    matte_soften=0.45,
-):
-    from PIL import Image
-
-    source_path = resolve_under_page(page_dir, source)
-    out_path = resolve_under_page(page_dir, out)
-    if not source_path.exists():
-        raise SystemExit(f"Crop source does not exist: {source_path}")
-    out_path.parent.mkdir(parents=True, exist_ok=True)
-    source_image = Image.open(source_path)
-    crop_box = padded_box(box, int(crop_padding or 0), source_image.size)
-    cropped = source_image.crop(crop_box)
-    if remove_border_bg:
-        cropped = remove_border_background(cropped, threshold=float(matte_threshold), soften=float(matte_soften))
-    cropped.save(out_path)
-
-    if manifest:
-        manifest_path = resolve_under_page(page_dir, manifest)
-        manifest_base = manifest_path.resolve().parent
-        asset_ref = out_path
-        source_ref = source_path
-        try:
-            asset_ref = out_path.resolve().relative_to(manifest_base)
-        except ValueError:
-            pass
-        try:
-            source_ref = source_path.resolve().relative_to(manifest_base)
-        except ValueError:
-            pass
-        append_provenance(
-            manifest_path,
-            asset_ref,
-            source_ref,
-            source_type,
-            provenance_note or "Cropped asset visually inspected.",
-            approval_note,
-            source_region_px=(crop_box[0], crop_box[1], crop_box[2] - crop_box[0], crop_box[3] - crop_box[1]),
-        )
-    print(f"Wrote {out_path}")
-    return out_path
-
-
 def fit_image(image, size):
     if image.size == 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/image_gen.py` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@
 
 Output:
   Write outputs under the page directory when used in a deck run. Record selected
-  images with editppt image import, then use process-sheet or crop when needed.
+  images with editppt image import, then use process-sheet when asset-sheet splitting is needed.
 """
 
 GENERATE_HELP_EPILOG = """\
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py` (modified, +2/-55)
```diff
@@ -202,35 +202,6 @@ def cmd_record_image(args: argparse.Namespace) -> int:
     return run_script("record_imagegen_result.py", args.record_image_args)
 
 
-def cmd_crop_image(args: argparse.Namespace) -> int:
-    argv = [
-        args.page_dir,
-        "--skip-chroma",
-        "--skip-split",
-        "--crop-source",
-        args.source,
-        "--crop-box",
-        args.box,
-        "--crop-out",
-        args.out,
-    ]
-    if args.job_id:
-        argv.extend(["--job-id", args.job_id])
-    if args.padding:
-        argv.extend(["--crop-padding", str(args.padding)])
-    if args.remove_border_bg:
-        argv.append("--crop-remove-border-bg")
-    if args.manifest:
-        argv.extend(["--manifest", args.manifest])
-    if args.source_type:
-        argv.extend(["--source-type", args.source_type])
-    if args.provenance_note:
-        argv.extend(["--provenance-note", args.provenance_note])
-    if args.approval_note:
-        argv.extend(["--approval-note", args.approval_note])
-    return run_script("process_asset_sheet.py", argv)
-
-
 def cmd_status(args: argparse.Namespace) -> int:
     argv = [args.run]
     if args.json:
@@ -723,8 +694,8 @@ def build_parser() -> argparse.ArgumentParser:
         description="""Unified image generation/editing and deterministic image-file handling.
 
 Use generate/edit/batch for Codex OAuth first, with OpenAI-compatible API fallback
-when local Codex auth is unavailable. Use process-sheet and crop for deterministic
-asset extraction inside page directories.
+when local Codex auth is unavailable. Use process-sheet for deterministic
+asset-sheet splitting inside page directories.
 """,
         formatter_class=HELP_FORMATTER,
         epilog="""Backend selection:
@@ -770,30 +741,6 @@ def build_parser() -> argparse.ArgumentParser:
     process_sheet.add_argument("process_args", nargs=argparse.REMAINDER)
     process_sheet.set_defaults(func=cmd_process_asset_sheet)
 
-    crop = image_sub.add_parser(
-        "crop",
-        help="Crop a source or generated image into a page asset.",
-        description="Crop a region, optionally remove border background, and update manifest provenance.",
-        formatter_class=HELP_FORMATTER,
-    )
-    crop.add_argument("page_dir", metavar="PAGE_DIR", help="Page directory that owns the output asset.")
-    crop.add_argument("--source", required=True, metavar="FILE", help="Source image path, relative to page dir unless absolute.")
-    crop.add_argument("--box", required=True, metavar="L,T,R,B", help="Crop box in source pixels: left,top,right,bottom.")
-    crop.add_argument("--out", required=True, metavar="FILE", help="Output asset path, relative to page dir unless absolute.")
-    crop.add_argument("--job-id", metavar="ID", help="Optional imagegen job id to mark processed.")
-    crop.add_argument("--padding", type=int, default=0, metavar="PX", help="Optional crop padding in pixels.")
-    crop.add_argument("--remove-border-bg", action="store_true", help="Remove plain border background from the cropped asset.")
-    crop.add_argument("--manifest", default="manifest.json", metavar="FILE", help="Manifest to update with provenance.")
-    crop.add_argument(
-        "--source-type",
-        default="source-derived-rasterization",
-        choices=["imagegen", "user-provided", "user-approved-rasterization", "source-derived-rasterization"],
-        help="Provenance source type recorded in the manifest.",
-    )
-    crop.add_argument("--provenance-note", metavar="TEXT", help="Provenance note written to manifest.")
-    crop.add_argument("--approval-note", metavar="TEXT", help="Optional approval note written to manifest.")
-    crop.set_defaults(func=cmd_crop_image)
-
     return parser
 
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/process_asset_sheet.py` (modified, +8/-47)
```diff
@@ -3,10 +3,10 @@
 from pathlib import Path
 
 from deck_run_state import now_iso, read_json, write_json
-from _page_artifacts import crop_asset, parse_box, process_asset_sheet as process_sheet
+from _page_artifacts import process_asset_sheet as process_sheet
 
 
-def mark_processed(page_dir, args, crop_output=None):
+def mark_processed(page_dir, args):
     if not args.job_id:
         return
     jobs_path = page_dir / "imagegen-jobs.json"
@@ -20,7 +20,6 @@ def mark_processed(page_dir, args, crop_output=None):
                     "alpha": args.alpha,
                     "assets_dir": args.assets_dir,
                     "split_manifest": args.split_manifest,
-                    "crop_output": crop_output,
                 }
             )
             break
@@ -34,7 +33,6 @@ def mark_processed(page_dir, args, crop_output=None):
                 "alpha": args.alpha,
                 "assets_dir": args.assets_dir,
                 "split_manifest": args.split_manifest,
-                "crop_output": crop_output,
             }
         )
     jobs["updated_at"] = now_iso()
@@ -44,75 +42,38 @@ def mark_processed(page_dir, args, crop_output=None):
 def main():
     parser = argparse.ArgumentParser(
         prog="editppt image process-sheet",
-        description="Remove chroma key, split, and optionally crop an imagegen asset sheet.",
+        description="Remove chroma key and split an imagegen asset sheet.",
         formatter_class=argparse.RawDescriptionHelpFormatter,
         epilog="""Examples:
   editppt image process-sheet <page_dir> --job-id icon-sheet-1 --asset-sheet-source assets/sheet.png --asset-names icon-a,icon-b
-  editppt image process-sheet <page_dir> --skip-chroma --crop-source source.png --crop-box 120,80,240,180 --crop-out assets/icon.png --source-type source-derived-rasterization
 """,
     )
     parser.add_argument("page_dir", help="Page directory that owns imagegen-jobs.json, manifest.json, and the assets folder.")
-    parser.add_argument("--job-id", help="Image generation job id to mark as processed after splitting or cropping.")
+    parser.add_argument("--job-id", help="Image generation job id to mark as processed after splitting.")
     parser.add_argument("--asset-sheet-source", help="Generated sheet image to process. Relative paths are resolved under page_dir unless absolute. Defaults to the imported asset sheet recorded for --job-id when available.")
     parser.add_argument("--chroma", default="imagegen_asset_sheet_chroma.png", help="Intermediate chroma-key output path relative to page_dir.")
     parser.add_argument("--alpha", default="imagegen_asset_sheet_alpha.png", help="Transparent sheet output path relative to page_dir.")
-    parser.add_argument("--skip-chroma", action="store_true", help="Skip chroma-key removal; useful when only cropping source.png or an already-transparent image.")
+    parser.add_argument("--skip-chroma", action="store_true", help="Skip chroma-key removal when processing an already-transparent sheet.")
     parser.add_argument("--force-chroma", action="store_true", help="Run chroma-key removal even if the alpha output already exists.")
     parser.add_argument("--despill", action="store_true", help="Reduce remaining chroma color around extracted asset edges.")
-    parser.add_argument("--skip-split", action="store_true", help="Do not auto-split connected alpha components; useful for manual crop-only calls.")
+    parser.add_argument("--skip-split", action="store_true", help="Do not auto-split connected alpha components.")
     parser.add_argument("--transparent-threshold", default="12", help="RGB distance threshold treated as fully transparent during chroma removal.")
     parser.add_argument("--opaque-threshold", default="220", help="RGB distance threshold treated as fully opaque during chroma removal.")
-    parser.add_argument("--assets-dir", default="assets", help="Output directory for split or cropped assets, relative to page_dir.")
+    parser.add_argument("--assets-dir", default="assets", help="Output directory for split assets, relative to page_dir.")
     parser.add_argument("--asset-names", help="Comma-separated names assigned to split assets in visual order.")
     parser.add_argument("--split-sort", choices=["x", "y", "area"], default="x", help="Sort extracted alpha components by x position, y position, or area.")
     parser.add_argument("--split-min-area", default="1000", help="Minimum connected-component pixel area to keep as an extracted asset.")
     parser.add_argument("--split-merge-gap", default="18", help="Merge nearby components separated by at most this many pixels.")
     parser.add_argument("--split-merge-union-growth", default="2.4", help="Maximum bounding-box growth ratio allowed when merging nearby components.")
     parser.add_argument("--square-assets", action="store_true", help="Pad split assets to square canvases.")
     parser.add_argument("--split-manifest", default="split_assets.json", help="JSON file that re
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/split_alpha_components.py` (modified, +14/-11)
```diff
@@ -129,20 +129,23 @@ def sort_components(components, mode):
     return sorted(components, key=lambda item: (item["box"][0], item["box"][1]))
 
 
-def crop_component(image, box, pad, square):
+def extract_component_asset(image, box, pad, square):
     width, height = image.size
     left, top, right, bottom = box
     left = max(0, left - pad)
     top = max(0, top - pad)
     right = min(width, right + pad)
     bottom = min(height, bottom + pad)
-    crop = image.crop((left, top, right, bottom))
+    component_image = image.crop((left, top, right, bottom))
     if not square:
-        return crop, [left, top, right, bottom]
+        return component_image, [left, top, right, bottom]
 
-    side = max(crop.size)
+    side = max(component_image.size)
     canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
-    canvas.alpha_composite(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2))
+    canvas.alpha_composite(
+        component_image,
+        ((side - component_image.size[0]) // 2, (side - component_image.size[1]) // 2),
+    )
     return canvas, [left, top, right, bottom]
 
 
@@ -182,7 +185,7 @@ def main():
     parser.add_argument("--merge-union-growth", type=float, default=2.4, help="Maximum union-box growth allowed when merging fragments")
     parser.add_argument("--pad", type=int, default=24)
     parser.add_argument("--limit", type=int, help="Maximum number of components to write")
-    parser.add_argument("--square", action="store_true", help="Place each crop on a transparent square canvas")
+    parser.add_argument("--square", action="store_true", help="Place each extracted asset on a transparent square canvas")
     parser.add_argument("--manifest", help="Optional JSON report path for component boxes and outputs")
     parser.add_argument("--contact-sheet", help="Optional contact sheet image for visual QA")
     args = parser.parse_args()
@@ -209,21 +212,21 @@ def main():
         name = names[index - 1] if names else f"asset_{index:02d}.png"
         if not name.lower().endswith(".png"):
             name += ".png"
-        crop, padded_box = crop_component(image, component["box"], args.pad, args.square)
+        component_image, padded_box = extract_component_asset(image, component["box"], args.pad, args.square)
         out_path = out_dir / name
-        crop.save(out_path)
+        component_image.save(out_path)
         entry = {
             "path": str(out_path),
             "source": str(src),
             "box": component["box"],
             "padded_box": padded_box,
             "area": component["area"],
             "merged_count": component.get("merged_count", 1),
-            "size": list(crop.size),
+            "size": list(component_image.size),
         }
         outputs.append(entry)
-        contact_items.append({"name": name, "image": crop})
-        print(f"{name}: box={component['box']} area={component['area']} size={crop.size}")
+        contact_items.append({"name": name, "image": component_image})
+        print(f"{name}: box={component['box']} area={component['area']} size={component_image.size}")
 
     if args.manifest:
         Path(args.manifest).write_text(json.dumps({"source": str(src), "assets": outputs}, ensure_ascii=False, indent=2))
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/validate_pptx.py` (modified, +1/-63)
```diff
@@ -22,7 +22,6 @@
     "latex-rendered-formula",
     "user-provided",
     "user-approved-rasterization",
-    "source-derived-rasterization",
 }
 REQUIRED_QUALITY_CHECKS = {
     "font_size_calibrated",
@@ -77,7 +76,7 @@ def page_contract_violations(manifest):
             )
         if (
             is_full_slide_image(image, slide)
-            and source_type in {"user-provided", "user-approved-rasterization", "source-derived-rasterization"}
+            and source_type in {"user-provided", "user-approved-rasterization"}
             and text_boxes
         ):
             violations.append(
@@ -91,16 +90,6 @@ def page_contract_violations(manifest):
     return violations
 
 
-def source_region_size(entry):
-    region = entry.get("source_region_px")
-    if isinstance(region, list) and len(region) == 4:
-        return float(region[2]), float(region[3])
-    bbox = entry.get("source_bbox_px")
-    if isinstance(bbox, list) and len(bbox) == 4:
-        return abs(float(bbox[2]) - float(bbox[0])), abs(float(bbox[3]) - float(bbox[1]))
-    return None
-
-
 def quality_contract_violations(manifest):
     violations = []
 
@@ -160,34 +149,6 @@ def quality_contract_violations(manifest):
     return violations
 
 
-def alpha_edge_violations(image_path, edge_padding=3):
-    try:
-        from PIL import Image
-    except Exception as exc:
-        return [{"field": "asset_alpha", "reason": f"unable to import Pillow for asset edge check: {exc}"}]
-
-    try:
-        image = Image.open(image_path).convert("RGBA")
-    except Exception as exc:
-        return [{"field": "asset_alpha", "reason": f"unable to open asset for edge check: {exc}"}]
-
-    alpha = image.getchannel("A")
-    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
-    if not bbox:
-        return [{"field": "asset_alpha", "reason": "asset has no visible opaque pixels"}]
-    left, top, right, bottom = bbox
-    width, height = image.size
-    problems = []
-    if left < edge_padding or top < edge_padding or width - right < edge_padding or height - bottom < edge_padding:
-        problems.append(
-            {
-                "field": "asset_alpha",
-                "reason": "visible pixels touch the asset edge; inspect source/contact sheet or add safe padding when this asset requires edge-safe alpha",
-            }
-        )
-    return problems
-
-
 def pixel_authoring_violations(manifest):
     violations = []
     source = manifest.get("source", {})
@@ -586,22 +547,6 @@ def main():
             report["invalid_asset_provenance"].append(
                 {"path": key, "field": "approval_note", "value": entry.get("approval_note")}
             )
-        if source_type in {"user-approved-rasterization", "source-derived-rasterization"} and not (
-            entry.get("source_region_px") or entry.get("source_bbox_px")
-        ):
-            report["invalid_asset_provenance"].append(
-                {
-                    "path": key,
-                    "field": "source_region_px/source_bbox_px",
-                    "value": entry.get("source_region_px") or entry.get("source_bbox_px"),
-                }
-            )
-        if source_type == "source-derived-rasterization":
-            region_size = source_region_size(entry)
-            if region_size and (region_size[0] <= 0 or region_size[1] <= 0):
-                report["invalid_asset_provenance"].append(
-                    {"path": key, "field": "source_region_px/source_bbox_px", "value": entry.get("source_region_px") or entry.get("source_bbox_px")}
-                )
         source = entry.get("source")
         if not source:
             report["missing_provenance_sources"].append({"path": key, "source": source})
@@ -611,13 +556,6 @@ def main():
             source_path = manifest_base / source_path
         if not source_path.exists():
             report["missing_provenance_sources"].append({"path": key, "source": str(source)})
-        if source_type == "source-derived-rasterization" and entry.get("require_edge_safe_alpha") is True:
-            asset_file = Path(key)
-            if not asset_file.is_absolute():
-                asset_file = manifest_base / asset_file
-            for problem in alpha_edge_violations(asset_file):
-                report["invalid_asset_provenance"].append({"path": key, **problem})
-
     report["page_contract_violations"] = (
         authoring_violations + page_contract_violations(manifest) + quality_contract_violations(raw_manifest)
     )
```

---

### Incident Patch 15: `dad1c5d1` (2026-06-09)
**Commit Message**: fix: assemble final deck from page pptx

**File**: `README.md` (modified, +2/-2)
```diff
@@ -134,7 +134,7 @@ skill 通常会完成这些步骤：
 3. 每个 page worker 负责自己的页面目录，完成页面重建、自检和 page-local 修正。
 4. 每页创建 manifest，重建可编辑文本、简单形状和图片资产。
 5. 用 `editppt` 命令记录 dispatch、page result 和 accepted 状态。
-6. 主 agent 组装最终 `.pptx`，复制 `.pptx` 页面备注，并运行 deck validation。
+6. 主 agent 按页顺序拼接各 `pages/page_NNN/page.pptx` 生成最终 `.pptx`，复制 `.pptx` 页面备注，并运行 deck validation。
 
 ## 输出结构
 
@@ -168,7 +168,7 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
     │   ├── page_request.json                 # 页面请求和 image backend
     │   ├── imagegen-jobs.json                # 本页图片生成/编辑调用和结果记录
     │   ├── assets/                           # 本页拆出的独立图片资产
-    │   ├── page.pptx                         # 本页单页 PPTX
+    │   ├── page.pptx                         # 本页单页 PPTX；finalize 会按页序拼接这些文件
     │   ├── preview.png                       # 本页重建预览图
     │   ├── split_assets_contact.png          # 本页资产切分检查图
     │   ├── manifest.json                     # 本页文本、形状和资产描述
```

**File**: `README_en.md` (modified, +2/-2)
```diff
@@ -134,7 +134,7 @@ The normal workflow is:
 3. Each page worker owns one page directory and completes reconstruction, self-check, and page-local correction there.
 4. Build one page manifest per page with editable text, simple shapes, and positioned image assets.
 5. Use `editppt` commands to record dispatches, page results, and accepted status.
-6. Assemble the final `.pptx`, copy `.pptx` speaker notes when present, and run deck validation.
+6. Assemble the final `.pptx` by concatenating `pages/page_NNN/page.pptx` files in page order, copy `.pptx` speaker notes when present, and run deck validation.
 
 ## Output Layout
 
@@ -168,7 +168,7 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
     │   ├── page_request.json                 # Page request and image backend
     │   ├── imagegen-jobs.json                # Image generation/editing calls and result records for this page
     │   ├── assets/                           # Independent image assets for this page
-    │   ├── page.pptx                         # Single-page PPTX
+    │   ├── page.pptx                         # Single-page PPTX; finalize concatenates these files in page order
     │   ├── preview.png                       # Reconstructed page preview
     │   ├── split_assets_contact.png          # Asset-splitting inspection image
     │   ├── manifest.json                     # Text, shape, and asset description for this page
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +3/-1)
```diff
@@ -51,7 +51,7 @@ The parent agent owns orchestration and user interaction:
 - For a multi-page input, do not write any page reconstruction artifacts inside `pages/page_NNN/`; use only `editppt run next` to obtain pages that need dispatch.
 - Generate prompts for pages that need work, spawn page workers, and record dispatches with `editppt run dispatch`.
 - Record page worker results with `editppt run record`.
-- Assemble and validate the final PPTX with `editppt run finalize`.
+- Assemble and validate the final PPTX with `editppt run finalize`. Final assembly concatenates the recorded page-level `page.pptx` files in page order; it does not rebuild the final deck from page manifests.
 - Report progress, final path, and validation result to the user.
 
 The parent agent must not create or modify page-local reconstruction outputs in multi-page runs, must not repeat page-level visual QA already completed by page workers, and must not hand-write key state JSON.
@@ -129,6 +129,8 @@ editppt run record <run> --page page_001 --agent-id main
 
 Read the finalize examples in `references/cli-helper.md` and the deck-level QA points in `references/qa-rubric.md`.
 
+`editppt run finalize` treats each recorded `pages/page_NNN/page.pptx` as the authoritative page output. It assembles the final deck by copying the first slide from each page PPTX in page order, preserving that page worker's self-checked slide output. Do not use manifest-based whole-deck reconstruction as a fallback.
+
 When `editppt run next <run>` returns the finalize stage:
 
 ```bash
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/assemble_pptx_from_pages.py` (added, +381/-0)
```diff
@@ -0,0 +1,381 @@
+#!/usr/bin/env python3
+import argparse
+import json
+import posixpath
+import re
+import zipfile
+from pathlib import Path
+from xml.etree import ElementTree as ET
+
+
+REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
+PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
+OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
+CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
+ASPECT_16_9 = 16 / 9
+ASPECT_TOLERANCE = 0.03
+EMU_PER_INCH = 914400
+
+RELATIONSHIP = f"{{{REL_NS}}}Relationship"
+OVERRIDE = f"{{{CONTENT_TYPES_NS}}}Override"
+DEFAULT = f"{{{CONTENT_TYPES_NS}}}Default"
+
+
+IMAGE_REL = f"{OFFICE_REL_NS}/image"
+NOTES_MASTER_REL = f"{OFFICE_REL_NS}/notesMaster"
+NOTES_SLIDE_REL = f"{OFFICE_REL_NS}/notesSlide"
+SLIDE_REL = f"{OFFICE_REL_NS}/slide"
+SLIDE_LAYOUT_REL = f"{OFFICE_REL_NS}/slideLayout"
+SLIDE_MASTER_REL = f"{OFFICE_REL_NS}/slideMaster"
+THEME_REL = f"{OFFICE_REL_NS}/theme"
+
+
+CONTENT_TYPES = {
+    ".bin": "application/vnd.openxmlformats-officedocument.presentationml.printerSettings",
+    ".gif": "image/gif",
+    ".jpeg": "image/jpeg",
+    ".jpg": "image/jpeg",
+    ".png": "image/png",
+    ".svg": "image/svg+xml",
+    ".xml": "application/xml",
+    ".rels": "application/vnd.openxmlformats-package.relationships+xml",
+}
+
+
+def emu(value):
+    return int(round(float(value) * EMU_PER_INCH))
+
+
+def is_wide_slide(width, height):
+    return abs((float(width) / float(height)) / ASPECT_16_9 - 1) <= ASPECT_TOLERANCE
+
+
+def slide_size_type(width, height):
+    return "wide" if is_wide_slide(width, height) else "custom"
+
+
+def rels_xml(relationships):
+    body = "".join(
+        f'<Relationship Id="{rel["id"]}" Type="{rel["type"]}" Target="{rel["target"]}"'
+        + (f' TargetMode="{rel["target_mode"]}"' if rel.get("target_mode") else "")
+        + "/>"
+        for rel in relationships
+    )
+    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{REL_NS}">{body}</Relationships>'
+
+
+def rel_source_part(rels_name):
+    directory = posixpath.dirname(rels_name)
+    if directory.endswith("/_rels"):
+        directory = posixpath.dirname(directory)
+    source = posixpath.basename(rels_name)[:-5]
+    return posixpath.normpath(posixpath.join(directory, source))
+
+
+def resolve_target(rels_name, target):
+    if not target or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
+        return None
+    source = rel_source_part(rels_name)
+    return posixpath.normpath(posixpath.join(posixpath.dirname(source), target))
+
+
+def relative_target(from_part, to_part):
+    source_dir = posixpath.dirname(from_part)
+    return posixpath.relpath(to_part, source_dir)
+
+
+def parse_relationships(z, rels_name):
+    if rels_name not in z.namelist():
+        return []
+    root = ET.fromstring(z.read(rels_name))
+    relationships = []
+    for rel in root.findall(RELATIONSHIP):
+        relationships.append(
+            {
+                "id": rel.attrib["Id"],
+                "type": rel.attrib["Type"],
+                "target": rel.attrib.get("Target", ""),
+                "target_mode": rel.attrib.get("TargetMode"),
+            }
+        )
+    return relationships
+
+
+def presentation_slide_parts(z):
+    rels = parse_relationships(z, "ppt/_rels/presentation.xml.rels")
+    slide_parts = []
+    for rel in rels:
+        if rel["type"] == SLIDE_REL and rel.get("target_mode") != "External":
+            slide_parts.append(posixpath.normpath(posixpath.join("ppt", rel["target"])))
+    if slide_parts:
+        return slide_parts
+    return sorted(name for name in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name))
+
+
+def slide_size_from_deck(deck):
+    slide = deck.get("slide", {})
+    return emu(slide.get("width", 13.333)), emu(slide.get("height", 7.5))
+
+
+def content_type_for_part(z, part_name):
+    suffix = Path(part_name).suffix.lower()
+    fallback = CONTENT_TYPES.get(suffix)
+    try:
+        root = ET.fromstring(z.read("[Content_Types].xml"))
+    except Exception:
+        return fallback
+    for override in root.findall(OVERRIDE):
+        if override.attrib.get("PartName") == "/" + part_name:
+            return override.attrib.get("ContentType", fallback)
+    for default in root.findall(DEFAULT):
+        if default.attrib.get("Extension", "").lower() == suffix.lstrip("."):
+            return default.attrib.get("ContentType", fallback)
+    return fallback
+
+
+def next_part_name(prefix, source_part, used_names):
+    suffix = Path(source_part).suffix.lower()
+    counter = 1
+    while True:
+        candidate = f"{prefix}{counter}{suffix}"
+        if candidate not in used_names:
+            used_names.add(candidate)
+            return candidate
+        counter += 1
+
+
+def common_content_types(slide_count, copied_parts, notes_indices=None):
+    notes_indices = notes_indices or []
+
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/build_pptx_from_manifest.py` (modified, +16/-86)
```diff
@@ -517,87 +517,24 @@ def write_common_parts(z, slide_count, width, height, notes_count):
 
 
 def write_pptx(manifest, out_path, manifest_path):
-    write_deck([{"manifest": manifest, "manifest_path": Path(manifest_path)}], out_path, [])
-
-
-def write_deck(page_entries, out_path, notes_entries):
-    if not page_entries:
-        raise ValueError("Deck has no pages")
-    first_slide = page_entries[0]["manifest"].get("slide", {})
-    width = emu(first_slide.get("width", 13.333))
-    height = emu(first_slide.get("height", 7.5))
+    width = emu(manifest.get("slide", {}).get("width", 13.333))
+    height = emu(manifest.get("slide", {}).get("height", 7.5))
     out = Path(out_path)
     out.parent.mkdir(parents=True, exist_ok=True)
-    notes_by_page = {int(entry.get("page_index", 0)): entry for entry in notes_entries if entry.get("text")}
-    notes_indices = sorted(notes_by_page)
-    normalized_entries = [
-        {**entry, "manifest": normalize_manifest(entry["manifest"])}
-        for entry in page_entries
-    ]
-    manifests = [entry["manifest"] for entry in normalized_entries]
+    normalized = normalize_manifest(manifest)
     media_index = 1
     with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
-        z.writestr("[Content_Types].xml", content_types_xml(manifests, notes_indices))
-        write_common_parts(z, len(page_entries), width, height, len(notes_by_page))
-        for slide_index, entry in enumerate(normalized_entries, start=1):
-            manifest = entry["manifest"]
-            notes_index = slide_index if slide_index in notes_by_page else None
-            z.writestr(f"ppt/slides/slide{slide_index}.xml", slide_xml(manifest))
-            z.writestr(f"ppt/slides/_rels/slide{slide_index}.xml.rels", rels_xml(manifest, media_index, notes_index))
-            base = Path(entry["manifest_path"]).resolve().parent
-            for item in manifest.get("images", []):
-                src = Path(item["path"])
-                if not src.is_absolute():
-                    src = base / src
-                z.write(src, f"ppt/media/image{media_index}{image_ext(src)}")
-                media_index += 1
-            if notes_index is not None:
-                note = notes_by_page[slide_index]
-                notes_xml = note.get("notes_xml")
-                if notes_xml and Path(notes_xml).exists():
-                    z.writestr(f"ppt/notesSlides/notesSlide{notes_index}.xml", Path(notes_xml).read_bytes())
-                else:
-                    z.writestr(f"ppt/notesSlides/notesSlide{notes_index}.xml", notes_slide_xml(note.get("text", "")))
-                z.writestr(f"ppt/notesSlides/_rels/notesSlide{notes_index}.xml.rels", notes_rels_xml(slide_index))
-
-
-def page_entries_from_deck_manifest(deck_manifest_path):
-    deck_path = Path(deck_manifest_path).resolve()
-    deck = json.loads(deck_path.read_text(encoding="utf-8"))
-    root = Path(deck.get("job_dir", deck_path.parent)).resolve()
-    entries = []
-    for page in deck.get("pages", []):
-        manifest_path = Path(page.get("manifest", ""))
-        if not manifest_path.is_absolute():
-            manifest_path = root / manifest_path
-        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
-        entries.append({"manifest": manifest, "manifest_path": manifest_path})
-    notes_path = deck.get("notes_manifest")
-    notes_entries = []
-    if notes_path:
-        notes_file = Path(notes_path)
-        if not notes_file.is_absolute():
-            notes_file = root / notes_file
-        if notes_file.exists():
-            notes_entries = json.loads(notes_file.read_text(encoding="utf-8")).get("notes", [])
-            for note in notes_entries:
-                notes_xml = note.get("notes_xml")
-                if notes_xml:
-                    notes_xml_path = Path(notes_xml)
-                    if not notes_xml_path.is_absolute():
-                        notes_xml_path = root / notes_xml_path
-                    note["notes_xml"] = str(notes_xml_path)
-    return entries, notes_entries
-
-
-def output_path_from_deck_manifest(deck_manifest_path):
-    deck_path = Path(deck_manifest_path).resolve()
-    deck = json.loads(deck_path.read_text(encoding="utf-8"))
-    root = Path(deck.get("job_dir", deck_path.parent)).resolve()
-    output = Path(deck.get("output", "deck_edited.pptx"))
-    if not output.is_absolute():
-        output = root / output
-    return output
+        z.writestr("[Content_Types].xml", content_types_xml([normalized], []))
+        write_common_parts(z, 1, width, height, 0)
+        z.writestr("ppt/slides/slide1.xml", slide_xml(normalized))
+        z.writestr("ppt/slides/_rels/slide1.xml.rels", rels_xml(normalized, media_index, None))
+        base = Path(manifest_path).resolve().parent
+        for item in normalized.get("images", []):
+            src = Path(item["path"])
+            if not src.is_absolute():
+                src = base / src
+            z.write(sr
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/finalize_deck_run.py` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ def main():
 
     out = final_output_path(run_dir, deck)
     out.parent.mkdir(parents=True, exist_ok=True)
-    run([sys.executable, SCRIPT_DIR / "build_pptx_from_manifest.py", "--deck-manifest", run_dir / "deck_manifest.json", "--out", out])
+    run([sys.executable, SCRIPT_DIR / "assemble_pptx_from_pages.py", run_dir, "--out", out])
     set_run_status(run_dir, "deck_built", "final pptx built")
 
     validation = out.parent / "validation.json"
```

**File**: `skills/image-to-editable-ppt/references/cli-helper.md` (modified, +2/-2)
```diff
@@ -91,7 +91,7 @@ Purpose: after the parent agent directly completes the current single page, self
 editppt run finalize <run>
 ```
 
-Purpose: after recording is complete, assemble and validate the final PPTX.
+Purpose: after recording is complete, assemble and validate the final PPTX by concatenating recorded page-level `page.pptx` files in page order. The final deck is not rebuilt from page manifests.
 
 ## Common Multi-Page Commands
 
@@ -131,7 +131,7 @@ Purpose: after the page worker writes `manifest.json`, `page.pptx`, `preview.png
 editppt run finalize <run>
 ```
 
-Purpose: after all pages are recorded, assemble, validate, and output the final PPTX.
+Purpose: after all pages are recorded, assemble, validate, and output the final PPTX. Final assembly copies the first slide from each recorded `pages/page_NNN/page.pptx` into the final deck, preserving the page worker's validated output instead of reinterpreting `manifest.json` to rebuild the slide.
 
 Concurrency slots come from `page_jobs.json.max_concurrent_pages`; the default is 6. In normal flow, prefer `editppt run next` to determine the next action. `editppt run status` is only for debugging or manual inspection.
 
```

**File**: `skills/image-to-editable-ppt/references/manifest-schema.md` (modified, +2/-0)
```diff
@@ -109,6 +109,8 @@ Includes:
 - validation path
 - page-local output hashes, which may be supplemented by `editppt run record`
 
+The `page_pptx` artifact is the authoritative slide package for final assembly. `editppt run finalize` concatenates recorded page-level `page.pptx` files in page order; it does not rebuild the final deck from page manifests.
+
 ## `pages/page_NNN/validation.json`
 
 Owner: created by the page worker, read by `editppt run record`.
```

#### Recent Merged Pull Requests:
- **PR #46** (2026-09-16): docs: use official e-iceblue sponsor logo (@ningzimu)
- **PR #45** (2026-09-16): docs: use product page for Spire affiliate links (@ningzimu)
- **PR #44** (2026-09-16): docs: add Spire.Presentation sponsor cards (@ningzimu)
- **PR #42** (2026-09-15): docs: embed demo video across multilingual documentation (@ningzimu)
- **PR #40** (2026-09-13): docs: revert WeChat community QR restoration (@ningzimu)
- **PR #39** (2026-09-13): docs: restore WeChat community QR code (@ningzimu)
- **PR #38** (2026-09-12): feat: release v0.4.0 editable tables and page recovery (@ningzimu)
- **PR #37** (2026-09-10): docs: add Codia NoteSlide sponsor cards (@ningzimu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
